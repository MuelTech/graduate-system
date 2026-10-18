# CDW-LIVE-1 MANUAL-QA FIX-1 — Preview Convergence + LAN Realtime Diagnostics

- **Branch:** `refactor/collaborative-defense-workspace`
- **Starting HEAD:** `14860c61151240b9aec62d563b6e5a6ededa0217`
- **Status:** **IMPLEMENTED — INDEPENDENT SOURCE REVIEW COMPLETED; MANUAL QA CONTINUES**
- **Ending HEAD:** `9e6d00c0b7253cc55c7812008b54f4bb99dda4d9`
- **Date:** 2026-10-18
- **Scope:** manual-QA fix only (live-preview convergence + LAN realtime diagnosis)
- **Migration:** **NONE**
- **Backend production changes:** **NONE**

---

## 1. Manual-QA finding A — preview cleared too early

### Observed

```text
Rapporteur types
→ viewer sees Live preview — unsaved
→ Rapporteur blur triggers save
→ report.draft.updated arrives
→ viewer preview cleared immediately
→ REST refetch completes afterward
```

The viewer saw a flicker/disappearance because the hook discarded the ephemeral
preview before the authoritative REST `bodyVersion` had advanced.

### Root cause

`use-defense-realtime.ts` cleared `liveReportPreview` directly on
`report.draft.updated`, even though that event only signals that a save committed. The
viewer's REST report query had not necessarily refetched yet.

### Fix

- Added `reportPreviewDispositionForEvent()` in `report-preview.ts`.
- `report.draft.updated` now returns `"keep"`; it invalidates the report query but does
  **not** discard the preview.
- The existing `shouldDisplayLiveReportPreview()` gate remains authoritative: once the
  refetched report has `bodyVersion > preview.baseBodyVersion`, the preview stops
  rendering naturally.
- Freeze/sign/final/conclusion events still return `"clear"` and immediately stop preview
  acceptance:
  - `report.ready_for_signature`
  - `rap.signature.recorded`
  - `rap.finalized`
  - `defense.concluded`
- Disconnect/reconnect still intentionally resets ephemeral preview state and refetches
  authoritative REST state.

No preview content entered React Query, and no persistence/replay was added.

### UI stability refinement

Removed the large explanatory paragraph that appeared/disappeared above the report canvas.
The read-only header now reserves a stable compact slot and shows an inline badge:

```text
Live — unsaved
```

The badge carries a `title`/screen-reader explanation that the visible body is the
Rapporteur's current unsaved wording, not the saved Committee Report draft. The report
canvas keeps the amber "unsaved" border but no longer shifts vertically when preview
starts/stops. Panelists/Chairman remain read-only.

---

## 2. Manual-QA finding B — LAN Socket.IO `xhr poll error`

### Diagnosis performed

From the LAN address:

| Probe | Result |
|---|---|
| `GET http://192.168.1.101:5000/api/health` | **200** `{"status":"ok",...}` |
| `GET /socket.io/?EIO=4&transport=polling` with `Origin: http://192.168.1.101:3000` | **200**, `Access-Control-Allow-Origin: http://192.168.1.101:3000`, `Access-Control-Allow-Credentials: true` |
| Engine.IO open packet | `0{"sid":"...","upgrades":["websocket"],"pingInterval":25000,...}` |
| Socket.IO client transport probe to `http://192.168.1.101:5000` | transport negotiated; auth middleware returned expected `UNAUTHORIZED` for the deliberately invalid test token — **no xhr poll error** |
| Compiled browser API chunk | contains `http://192.168.1.101:5000` |
| Backend build/tests | pass |

### Root cause determination

No remaining application transport defect was found. The earlier `xhr poll error` is
consistent with stale client env or servers not restarted after the LAN/CORS changes:

- `NEXT_PUBLIC_BACKEND_API_URL` is compiled into browser chunks at dev start;
- backend CORS/socket origin is loaded at process start;
- before restart, the browser could still target `localhost:5000` or the backend still
  allowed only `localhost:3000`.

The repository LAN support from `14860c6` is correct and was preserved:
`next.config.ts` dev origin, LAN frontend API URL, comma-separated CORS origins, and the
shared REST/Socket.IO HTTP server. No second socket server or WebSocket-only shortcut was
introduced.

### Diagnostics improvement

Development-only `connect_error` logging now includes safe metadata:

- normalized backend target;
- current Engine.IO transport (when available);
- safe error message.

No token, auth payload, report body, evaluation data, or signature data is logged.
Production logging remains bounded. REST/polling fallback is unchanged.

### Residual

Repeated browser-level `xhr poll error` was **not reproduced** in the host LAN probes after
the restart. Phone/browser-level LAN QA is still user-owned; no PASS is claimed for a
browser session that was not executed.

---

## 3. Files changed

- `frontend/src/lib/realtime/report-preview.ts`
- `frontend/src/hooks/use-defense-realtime.ts`
- `frontend/src/components/defense-workspace/committee-report-panel.tsx`
- `frontend/scripts/verify-cdw-live-1-manual-qa-fix-1.mjs` (new)
- `frontend/scripts/verify-cdw-live-1a-report.mjs` (source expectation updated for the
  shared terminal-event disposition helper)
- `frontend/scripts/verify-cdw-live-1c-acceptance.mjs` (same)
- `docs/superpowers/cdw-live-1/cdw-live-1-manual-qa-fix-1-report.md` (this report)

No backend, schema, or migration file changed.

---

## 4. Verification

| Check | Result |
|---|---|
| New `verify-cdw-live-1-manual-qa-fix-1.mjs` | **13 passed / 0 failed** |
| CDW-LIVE-1A verifier | **42 passed / 0 failed** |
| CDW-LIVE-1B verifier | **24 passed / 0 failed** |
| CDW-LIVE-1C verifier | **31 passed / 0 failed** |
| CDW-8B / CDW-8C | **22 / 24 passed / 0 failed** |
| All frontend verification scripts (16) | **345 passed / 0 failed** |
| Focused backend realtime/CORS set | **12 files / 202 passed / 0 failed** |
| Full backend suite | **157 files / 1830 passed / 5 skipped / 0 failed** |
| `npx tsc --noEmit` | **clean** |
| Scoped `npx eslint` | **clean** |
| Frontend production build | **pass** |
| Backend `npm run build` | **pass** |
| `npx prisma validate` | **valid** |
| `git diff --check` | **clean** |
| New migration | **NONE** |

---

## 5. Manual QA

**Two-user browser report-preview QA: NOT EXECUTED — ENVIRONMENT LIMITATION.**

Independent authenticated Rapporteur/Panelist browser contexts were not available in this
environment. Automated convergence tests and host-level LAN transport probes were executed;
they are not represented as a manual two-user PASS.

LAN transport probes (health, Engine.IO handshake, CORS, transport negotiation) were
executed from the host and passed.

**Post-implementation user retest — 2026-10-18:** after restarting the development
servers and retesting from a phone over the LAN, the user reported that the realtime
behavior appeared to be working correctly. This closes the immediate LAN transport
symptom for manual QA, without converting unexecuted automated-agent browser scenarios
into a claimed PASS.

A separate Chairman/Panelist evaluation-finalization UI/UX issue was then identified
during manual QA. That issue is tracked as **CDW-LIVE-1 MANUAL-QA FIX-2** and must be
resolved before CDW-9.

---

## 6. Known limitations

- Hard browser unload/refresh/crash can still lose never-saved local changes.
- No persistent local draft recovery.
- Evaluation multi-tab CAS remains unavailable (no server version token).
- Preview is best-effort and disappears on disconnect/reload.
- If the LAN IP changes, update `frontend/.env`, `frontend/next.config.ts`, and backend
  `FRONTEND_URL`/`.env.example`, then restart both dev servers.
- Browser-level LAN/multi-user QA was not executed in this environment.

---

## 7. Confirmations

- No report authority expansion; Rapporteur remains sole writer, others read-only.
- No evaluation draft realtime event.
- No preview persistence or React Query authority.
- No new migration/schema change.
- No CDW-9 work.
- REST/polling fallback remains intact.

**Recommendation: READY FOR INDEPENDENT REVIEW.**
