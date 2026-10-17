# CDW-LIVE-1A — Rapporteur Live Preview + Report Draft Autosave

- **Branch:** `refactor/collaborative-defense-workspace`
- **Starting HEAD:** `19f25384adda80503f7a70fa784e68953db8899c`
- **Status:** **IMPLEMENTED — PENDING INDEPENDENT REVIEW**
- **Date:** 2026-10-18
- **Scope:** CDW-LIVE-1A only (Rapporteur report autosave + ephemeral read-only live preview)
- **Migration:** NONE. No Prisma schema or migration change.
- **Authority:** `docs/superpowers/cdw-live-1/cdw-live-1-live-report-and-draft-autosave-design.md`; CDW-8 remains ACCEPTED / CLOSED.

This report does **not** declare CDW-LIVE-1 accepted/closed. CDW-LIVE-1B (evaluation
autosave) and CDW-LIVE-1C (final acceptance) are not started. CDW-9 is not started.

---

## 0. FIX-1 — unmount / in-flight durability race

**Reason.** Independent review identified a lifecycle race in the original CDW-LIVE-1A
autosave controller.

**Original race.**

1. Autosave for body A started.
2. The Rapporteur edited newer body B while A was in flight.
3. The panel unmounted and cleanup called `flushNow()` then `dispose()`.
4. `flushNow()` could not start a request because A was in flight.
5. `dispose()` immediately marked the controller disposed.
6. A completed; the disposed guard returned before processing dirty body B.
7. Body B was stranded.

**Fix / lifecycle strategy.** The controller now has three lifecycle states instead of a
single disposed flag:

```text
active  -> accepts edits/timers
draining -> rejects new edits, waits for in-flight work, then saves the newest dirty body
disposed -> all queued durability work has settled
```

`dispose()` now returns a promise and starts draining rather than discarding in-flight
state. Cleanup calls `void controller.dispose()` only; it no longer calls
`flushNow()` first. During draining:

- `update()` / `flushNow()` are rejected;
- an existing in-flight request is allowed to complete;
- its success records the server-returned `bodyVersion`, then immediately saves the newest
  dirty local body through the same serialized pipeline;
- only after no request is in flight and no persistable dirty work remains does the
  controller enter `disposed` and resolve the disposal promise;
- a CAS conflict or ordinary failure ends the drain without retry, never falsely marks the
  draft saved, and never overwrites server content.

The unmount flush is therefore a durability drain, not a second parallel request. Hard
browser unload/reload delivery is still **not** claimed as guaranteed.

**Regression tests added (actual controller behavior):**

- Test A — dirty edit during in-flight save + disposal drains B after A with A's returned
  `bodyVersion`.
- Test B — multiple edits while draining persist only the latest body C.
- Test C — concurrency counter never exceeds one request throughout the drain.
- Test D — conflict on the in-flight save while draining: no retry, no overwrite, conflict
  state preserved.
- Test D2 — conflict on the queued drain save: no further retry.
- Test E — clean disposal creates no request.
- Pending-dirty disposal flushes once when nothing is in flight.
- Late edits after disposal are ignored.

---

## 1. Implemented behavior

### 1.1 Rapporteur report autosave

The existing authoritative write remains:

```
PUT /thesis/defense/:scheduleId/collaboration/report
{ body, expectedBodyVersion }
```

The Rapporteur authoring surface now uses one serialized autosave controller instead of
the former manual-only mutation.

- Idle debounce: **2000 ms**.
- Maximum online unsaved window target: **10000 ms** from the first unsaved edit.
- At most **one** save request in flight per mounted editor.
- Edits made during an in-flight request remain dirty; after success the newest body is
  saved immediately using the server-returned `bodyVersion`.
- Manual **Save now** (renamed from Save Draft) flushes through the same pipeline.
- Flush also runs on window blur, tab visibility hidden, and restored connectivity.
- Unmount/tab switch enters the draining lifecycle described in §0: new edits stop, an
  in-flight request is awaited, and the newest dirty body is saved with the returned
  `bodyVersion` before disposal settles.
- `beforeunload` warning is shown only while unsaved/in-flight work exists. Browser unload
  delivery is not claimed as guaranteed.
- No localStorage / IndexedDB persistence was added.

CAS behavior:

- Every next request uses the latest server-confirmed `bodyVersion`.
- A 409/CAS conflict preserves local editor contents, stops automatic retries, and shows
  `Save conflict — refresh/reconcile required`.
- An explicit **Reload saved version** action refetches authoritative REST state and
  replaces local state. No automatic merge was implemented.
- A clean editor that refetches a newer authoritative `bodyVersion` adopts that saved body
  instead of silently overwriting it on the next edit.

Save-state UI: `Not saved yet` (new unsaved report), `Unsaved changes`, `Saving…`,
`Saved`, `Offline — changes not saved`, `Save failed`, and the conflict state. `Saved` is
shown only after a server-confirmed persistence (or for a body loaded from the server).

### 1.2 Ephemeral Rapporteur live preview

Client sender payload (transport-only):

```ts
{
  scheduleId: string;
  baseBodyVersion: number;
  previewSequence: number; // strictly increasing per socket session
  body: CanonicalReportDocument;
}
```

Server relay payload adds the authenticated sender identity:

```ts
{
  scheduleId,
  baseBodyVersion,
  previewSequence,
  body,
  senderUserId
}
```

- Event name: **`report:preview`**.
- Not a tenth persisted-domain event; not in `DEFENSE_REALTIME_EVENT_NAMES` or the
  publisher metadata allow-list; never routed through `DefenseRealtimePublisher` /
  `publishDefenseRealtimeEvent` / `publishDefenseRealtimeSequence`.
- Body is validated with the same strict ReportDocument validator used by the REST draft,
  then canonicalized.
- Serialized payload bound: **102400 bytes (100 KiB)**, matching the Express default JSON
  body limit used by the authoritative REST report endpoint.
- Sender throttle/coalescing: **750 ms**, always the newest normalized snapshot.
- Optional server acknowledgement: `{ ok: true }` or
  `{ ok: false, code: FORBIDDEN | NOT_ACTIVE | INVALID | STALE | DROPPED }`.

Sender authorization (per message):

- authenticated socket identity; client `userId`/`role` ignored;
- socket must have joined `defense:<scheduleId>`;
- exact current `PanelAssignment` must be `RAPPORTEUR`;
- active session (`SCHEDULED` / `IN_PROGRESS` / `AWAITING_CONCLUSION`);
- report absent (first-save authoring) or an unfrozen `DRAFT`;
- the same shared `isReportBodyEditable` rule used by the REST write path;
- removed/replaced Rapporteur is rejected on the next message;
- strictly increasing `previewSequence` per socket session.

Viewer authorization (per delivery):

- exact current `PanelAssignment` membership revalidated before delivery;
- active session only; `CONCLUDED` / `CANCELLED` receive nothing;
- stale members are evicted before emitting;
- the sender socket is excluded;
- no Student/unassigned/historical viewer receives preview;
- storage/revalidation failure drops the message (fail closed).

Preview body is never logged. Safe error logs contain only schedule id / code / event
metadata. Nothing is persisted or replayed.

### 1.3 Viewer state and ordering

- Live preview is held only in workspace-level ephemeral React state
  (`DefenseRealtimeProvider` / `useDefenseRealtime`).
- It is never written into the React Query `committeeReport` cache; no `setQueryData`.
- Display gate: matching schedule, report status `DRAFT`/`NOT_CREATED`, and authoritative
  `bodyVersion <= preview.baseBodyVersion`.
- Older/duplicate previews from the same sender are ignored; a replacement Rapporteur
  starts a new sender stream.
- Preview is cleared on `report.draft.updated`, freeze/sign/finalization events, conclusion,
  disconnect, connect-error, and reconnect join. Reconnect starts from REST state.
- Read-only chairman/panelist/adviser/facilitator views receive **no edit controls**; they
  see the marker **“Live preview — unsaved”**.
- Committee Report read-only polling remains **20000 ms**.

### 1.4 Boundaries preserved

- Only the exact assigned Rapporteur may edit/save the report.
- Freeze (`FOR_SIGNATURE` / `PARTIALLY_SIGNED` / `ALL_SIGNED` / `DISTRIBUTED` /
  `FINALIZED`) and `CONCLUDED`/`CANCELLED` are immutable; preview/autosave stop.
- No automatic freeze, signature, verdict, or conclusion.
- One workspace-level socket owner remains (the page calls `useDefenseRealtime` once; the
  context only distributes `sendReportPreview` and `liveReportPreview`).
- REST/database remain authoritative; polling remains the fallback.

---

## 2. Files changed

### Production

Backend:

- `backend/src/realtime/defense-report-preview.rules.ts` — new transport contract,
  validation/canonicalization, 100 KiB bound.
- `backend/src/realtime/defense-report-preview.authorization.ts` — new sender/viewer
  authorization port/rules.
- `backend/src/realtime/defense-report-preview.server.ts` — new preview handler and
  revalidating delivery/eviction.
- `backend/src/realtime/defense-report-preview.store.ts` — new narrow Prisma read port.
- `backend/src/services/report-edit-authority.rules.ts` — extracted shared report edit
  authority used by REST and preview.
- `backend/src/realtime/defense-realtime.server.ts` — registers `report:preview` on the
  existing Socket.IO server; no publisher change.
- `backend/src/services/defense-collaboration.service.ts` — uses the extracted shared
  authority rule (behavior unchanged).

Frontend:

- `frontend/src/lib/report/report-autosave.ts` — new debounced/serialized autosave controller.
- `frontend/src/lib/report/report-preview-throttle.ts` — new coalescing throttle.
- `frontend/src/lib/realtime/report-preview.ts` — new preview parser/ordering/display rules.
- `frontend/src/components/defense-workspace/defense-realtime-context.tsx` — new
  workspace-level distribution of preview send/state.
- `frontend/src/components/defense-workspace/committee-report-panel.tsx` — autosave UI,
  conflict/reload handling, live-preview viewer rendering.
- `frontend/src/hooks/use-defense-realtime.ts` — preview send/state, throttle, terminal
  cleanup, reconnect behavior.
- `frontend/src/app/(portal)/panelist/defense-workspace/[scheduleId]/page.tsx` — passes the
  single realtime owner's value into the workspace context.

### Tests / verification

- `backend/tests/unit/realtime/defense-report-preview.rules.test.ts`
- `backend/tests/unit/realtime/defense-report-preview.authorization.test.ts`
- `backend/tests/unit/realtime/defense-report-preview.server.test.ts`
- `backend/tests/unit/realtime/defense-report-preview.store.test.ts`
- `backend/tests/unit/services/report-edit-authority.rules.test.ts`
- `frontend/scripts/verify-cdw-live-1a-report.mjs`

### Documentation

- `docs/superpowers/cdw-live-1/cdw-live-1a-report.md` (this report)

---

## 3. Verification evidence

### Backend

| Check | Result |
|---|---|
| Focused realtime/report set | **14 files / 312 passed / 0 failed** |
| Full suite (`npx vitest run`) | **156 files / 1827 passed / 5 skipped / 0 failed** |
| `npm run build` | **pass** |

### Frontend

| Check | Result |
|---|---|
| All 13 verification scripts | **277 assertions, 0 failed** |
| New `verify-cdw-live-1a-report.mjs` | **42 passed, 0 failed** (33 original + 9 FIX-1) |
| CDW-8B / CDW-8C regression scripts | **22 / 24 passed, 0 failed** |
| `npx tsc --noEmit` | **clean** |
| Scoped `npx eslint` | **clean** |
| `npm run build` (Next.js) | **pass** |

### Database / hygiene

| Check | Result |
|---|---|
| `npx prisma validate` | **valid** |
| `npx prisma generate` | **success** (Prisma Client v7.10.0) |
| `git diff --check` | **clean** |
| New migration | **NONE** |

---

## 4. Manual QA

**NOT EXECUTED — ENVIRONMENT LIMITATION.**

The available environment exposes one authenticated desktop browser session with shared
origin/session cookies, so independent Rapporteur and Chairman/Panelist authenticated
contexts could not be established. No manual two-user PASS is claimed. Full multi-user
acceptance remains CDW-LIVE-1C.

Covered instead by automated/source verification: autosave timing/serialization/CAS/conflict
preservation/offline transitions; preview validation/authorization/state exclusion/stale
eviction/privacy/payload bound; throttle coalescing; viewer ordering/display gating; terminal
cleanup; canonical nine-event isolation; single socket owner; polling fallback.

---

## 5. Explicit confirmations

- No schema or migration change.
- No Panelist/Chairman report editing authority.
- No CRDT/Yjs, operational transform, Redis, presence, cursors, or typing indicators.
- No evaluation autosave, evaluation draft socket message, or live evaluator values.
- No `report:preview` persistence, replay, or publisher integration.
- No academic DB write from the preview path.
- Preview body is not logged.
- Canonical nine CDW-8 persisted-domain events unchanged.
- Polling intervals unchanged (Committee Report read-only 20 s).
- CDW-8 acceptance history not rewritten.
- CDW-LIVE-1B, CDW-LIVE-1C, and CDW-9 not started.

---

## 6. Recommendation

**CDW-LIVE-1A READY FOR INDEPENDENT REVIEW.**

No known acceptance blockers. Manual browser multi-user QA remains not executed and
user-owned; CDW-LIVE-1B must not begin until this package is independently reviewed.
