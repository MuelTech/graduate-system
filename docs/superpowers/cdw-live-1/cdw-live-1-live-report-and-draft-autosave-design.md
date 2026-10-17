# CDW-LIVE-1 — Live Rapporteur Preview + Draft Autosave Design

**System:** EARIST Graduate School Information System (GS-IS)  
**Repository:** MuelTech/graduate-system  
**Branch:** `refactor/collaborative-defense-workspace`  
**Design baseline HEAD:** `b269e20e75ec1602a6343710878f9ab517b469db`  
**Accepted CDW-8 production implementation HEAD:** `a9a179446284ea928faca8991de34deadc856e1b`  
**CDW-8C acceptance package HEAD:** `f6011c1eaa73706cce0fb950ceea2a64dad80fc7`  
**Parent functional authority:** `docs/superpowers/COLLABORATIVE_DEFENSE_WORKSPACE_AND_RAP_SOURCE_OF_TRUTH.md`  
**Implementation-plan authority:** `docs/superpowers/plans/2026-10-15-collaborative-defense-workspace-implementation.md`  
**Status:** CONFIRMED DESIGN — NOT IMPLEMENTED  
**Date:** 2026-10-17

---

## 0. Why this package exists

CDW-8 is already ACCEPTED / CLOSED. It solved low-latency synchronization of persisted defense events without changing REST/database authority.

Two usability risks remain outside the accepted CDW-8 scope:

1. the Rapporteur can lose unsaved Committee Report text after an accidental reload, tab close, browser crash, or offline interruption before clicking **Save Draft**; and
2. authorized committee viewers see the Rapporteur's report only after a saved draft is persisted, so they cannot follow the wording closely enough for live committee brainstorming during the defense.

The same durability concern exists for an evaluator's own DRAFT criteria/recommendations: unsaved local form state can be lost before **Save Draft**.

CDW-LIVE-1 addresses those two issues without reopening CDW-8 acceptance and without turning GS-IS into a multi-author document editor.

---

## 1. Scope

CDW-LIVE-1 has exactly two product behaviors:

### A. Rapporteur Committee Report

- the assigned Rapporteur remains the **only editor** of the report body;
- authorized committee viewers remain **read-only**;
- Rapporteur edits are autosaved to the existing authoritative REST/database draft;
- while the report is editable, authorized viewers may receive an **ephemeral live preview** of the Rapporteur's current unsaved body through Socket.IO;
- persisted `report.draft.updated` continues to mean that an authoritative saved draft exists and viewers must refetch REST state.

### B. Individual Evaluation

- Chairman/Panelist evaluation DRAFT criteria and recommendations autosave privately through the existing REST draft endpoint;
- no evaluator draft values, scores, recommendations, or signature evidence are broadcast to other evaluators;
- **Review & Finalize** remains an explicit, signed, irreversible action;
- `evaluation.finalized` continues to broadcast readiness/progress metadata only.

---

## 2. Explicit non-goals

CDW-LIVE-1 does **not** add:

- Panelist/Chairman editing of the Rapporteur report;
- multiple simultaneous report editors;
- CRDT/Yjs;
- operational transform;
- merge/conflict UI between multiple authors;
- live cursors;
- presence avatars;
- page-presence indicators;
- generic typing indicators;
- live text-selection broadcasting;
- live evaluator scores;
- evaluation-draft Socket.IO messages;
- automatic evaluation finalization;
- automatic report freeze;
- automatic RAP signing;
- automatic defense conclusion;
- localStorage/IndexedDB persistence of sensitive evaluation/report drafts;
- a new academic workflow state;
- a Prisma schema/migration unless a later implementation audit proves one is strictly necessary.

Live cursors/presence may be considered later as a separate UX enhancement. They are not required for CDW-LIVE-1.

---

## 3. Authority model

The accepted role boundary does not change.

### Rapporteur Report

```text
Assigned Rapporteur
  = single authoritative editor

Chairman / Panelists / other authorized committee viewers
  = read-only viewers
```

Only the backend may decide whether the sender is the current assigned Rapporteur and whether the exact report is currently editable.

A broad account role is not enough.

### Individual Evaluation

Each required evaluator owns only their own DRAFT/finalized evaluation.

Autosave does not create shared evaluation visibility.

---

## 4. Three distinct report states

The implementation must keep these concepts separate.

### 4.1 Local editing state

The Rapporteur's newest editor contents in the current browser.

This may be newer than the server.

### 4.2 Ephemeral live preview

A best-effort Socket.IO view of the Rapporteur's newest local report body for authorized read-only committee viewers.

It is:

- temporary;
- not persisted by the socket layer;
- not an academic source of truth;
- not placed into the authoritative React Query cache;
- allowed to disappear on disconnect/reload;
- replaced by authoritative REST state whenever a persisted draft is refetched.

### 4.3 Saved authoritative draft

The REST/database Committee Report DRAFT, protected by the existing body version / compare-and-swap behavior.

This is the only draft that survives reload and the only draft that can later be frozen for signatures.

---

## 5. Rapporteur autosave

### 5.1 Write path

Autosave must reuse the existing report REST write path.

```text
Rapporteur edits
  -> local dirty state
  -> debounce
  -> existing authenticated REST PUT report draft
  -> backend authorization + validation
  -> bodyVersion / CAS
  -> database commit
  -> existing report.draft.updated event
  -> viewers invalidate/refetch
```

Socket.IO must not persist report content.

### 5.2 Timing target

Initial target:

- approximately **2 seconds idle debounce** after the latest edit;
- do not allow a continuously typing user to remain unsaved indefinitely; target a **maximum online unsaved window of about 10 seconds**;
- flush a pending draft when practical on editor blur/tab change/navigation;
- do not claim browser-unload delivery is guaranteed.

These values may be tuned during QA without changing the academic model.

### 5.3 Request serialization

Do not allow overlapping autosave writes from one mounted Rapporteur editor.

Required behavior:

1. at most one report save request in flight;
2. edits that happen while a save is in flight mark the draft dirty again;
3. when the in-flight save succeeds, immediately schedule/send the newest body if it changed;
4. the next request uses the newest server-returned `bodyVersion`;
5. a stale CAS response must never silently overwrite newer content.

The existing explicit **Save Draft** button may remain as a manual **Save now** action and should flush the same autosave pipeline rather than create a second competing save path.

### 5.4 Save-state UI

The Rapporteur must receive a clear status such as:

- Unsaved changes
- Saving...
- Saved
- Offline — changes not saved
- Save conflict — refresh/reconcile required

If a draft is dirty/pending, accidental reload/navigation should use an appropriate unsaved-change warning where the browser permits it.

No UI may say **Saved** before the server confirms persistence.

---

## 6. Rapporteur live preview

### 6.1 Purpose

During a live defense, committee members may need to see how the Rapporteur is wording the Committee Report so they can verbally correct or refine the record while it is being written.

Panelists/Chairman still cannot edit the report.

### 6.2 Transport-only message

CDW-8's nine canonical domain events remain unchanged.

CDW-LIVE-1 may add one **ephemeral transport message**, separate from the persisted-domain event list:

```text
report:preview
```

It is not a persisted domain event and must not be processed through the post-commit realtime publisher.

A conceptual payload is:

```text
{
  scheduleId,
  baseBodyVersion,
  previewSequence,
  body
}
```

The exact runtime type may vary, but it must contain only what is necessary to render the live report preview.

### 6.3 Sender authorization

Before relaying a preview, the server must verify:

- valid authenticated socket identity;
- exact current `PanelAssignment`;
- sender is the assigned Rapporteur for that exact defense;
- the report is still editable under existing backend authority;
- the attempt is not CONCLUDED/CANCELLED;
- the report is not frozen/for-signature/finalized;
- the payload passes the same structural/size safety limits appropriate for the report body.

If any check fails, the preview is dropped.

A removed/replaced Rapporteur must not be able to continue streaming report content.

### 6.4 Viewer authorization

Preview delivery is limited to currently authorized active committee room members who already have permission to view the Committee Report.

Never deliver live report content to:

- the Student;
- unrelated users;
- historical-only viewers outside an active room;
- CONCLUDED/CANCELLED rooms;
- a user removed from the current committee.

### 6.5 Throttling

Do not emit one event per keystroke.

Initial target:

- throttle/coalesce editor changes to roughly **500–1000 ms** for preview delivery;
- always send the latest normalized body snapshot in that interval;
- dropped/intermediate preview packets are acceptable because the feature is best-effort.

### 6.6 Viewer rendering

Live preview must be held in **component-local ephemeral state**, separate from authoritative React Query report data.

Viewer behavior:

```text
Saved REST report
  + optional newer ephemeral live preview
  -> render "Live preview — unsaved" when preview is newer
```

When `report.draft.updated` arrives:

1. invalidate/refetch `["committeeReport", scheduleId]`;
2. authoritative REST state wins;
3. clear/reconcile the ephemeral preview when the saved version catches up.

On disconnect/reconnect:

- do not replay preview history;
- refetch authoritative saved REST state;
- a later new preview may resume.

On freeze/finalization/conclusion:

- discard any ephemeral preview immediately;
- render authoritative locked/frozen REST state only.

### 6.7 Privacy/logging

Unlike CDW-8's metadata-only persisted events, `report:preview` intentionally carries report body content.

Therefore:

- it must be authorized as report content, not treated as harmless metadata;
- application logs must not log the report body payload;
- production deployment must use the normal HTTPS/WSS transport;
- no socket history/replay store may retain preview bodies;
- no analytics payload should capture the report text by default.

---

## 7. Evaluation autosave

### 7.1 Private write path

Evaluation autosave uses only the evaluator's existing authenticated REST draft endpoint.

```text
Evaluator changes criterion/recommendation
  -> local private state
  -> debounce
  -> PUT own evaluation DRAFT
  -> server authorizes exact evaluator
  -> database draft saved
```

No new Socket.IO message is needed.

### 7.2 Privacy boundary

The following remain private to the evaluator and authorized backend reads:

- criterion selections;
- Group I/II draft values;
- recommendations;
- signature evidence;
- incomplete draft state.

Other Panelists/Chairman must not receive those values in realtime merely because autosave exists.

### 7.3 Timing and serialization

Use the same general durability behavior as report autosave:

- approximately 2-second idle debounce;
- do not leave continuous online work unsaved indefinitely;
- at most one autosave request in flight per mounted evaluation form;
- if the evaluator changes values during an in-flight save, persist the newest state afterward;
- clear saved/dirty indicators only after the server confirms the draft.

Because the existing evaluation draft model may not have a report-style body version/CAS token, the client must at minimum serialize its own requests so an older request from the same mounted form cannot complete after a newer request and overwrite it.

Multi-tab same-evaluator conflict hardening may be handled in CDW-9 if the current backend does not expose a version token.

### 7.4 Finalization boundary

Autosave must never:

- generate/capture a signature automatically;
- click/trigger Review & Finalize;
- finalize an incomplete evaluation;
- lock the evaluation;
- emit `evaluation.finalized`.

The evaluator must still explicitly review, provide their own e-signature, and confirm finalization.

---

## 8. Offline/reload behavior

Autosave materially reduces accidental-loss risk but does not make the browser an offline document system.

### Online

- edits autosave in the background;
- saved status is server-confirmed;
- reload restores the last successful server draft.

### Temporary internet loss without reload

- current local unsaved values remain in browser memory;
- UI must show offline/unsaved state;
- when connectivity returns, the latest local draft should be eligible to flush through REST.

### Reload/close while offline or before debounce completes

- unsaved local edits may still be lost;
- use an unsaved-change warning where possible;
- local persistent recovery storage is intentionally deferred because report/evaluation content can be sensitive on shared devices.

---

## 9. Existing CDW-8 behavior that must remain intact

CDW-LIVE-1 must not regress:

- exact JWT socket authentication;
- exact current `PanelAssignment` room membership;
- stale-member eviction;
- SCHEDULED / IN_PROGRESS / AWAITING_CONCLUSION active-room rules;
- CONCLUDED/CANCELLED exclusion;
- the nine canonical persisted realtime events;
- REST/database authority;
- polling fallback;
- no academic socket write path;
- evaluator privacy;
- report freeze/version/signature integrity;
- concluded-attempt immutability;
- historical mode without active realtime rooms.

The new preview transport is a bounded exception for **ephemeral display only**, not a change to academic write authority.

---

## 10. Manual QA scenarios

### Report autosave durability

1. Rapporteur edits report and stops typing.
2. UI shows Saving then Saved without pressing Save Draft.
3. Reload browser.
4. Last server-confirmed content remains.
5. Edit again, disconnect network, verify Offline/Unsaved state.
6. Reconnect without reload and verify latest local draft saves.

### Live report preview

1. Open the same active defense as Rapporteur and Panelist/Chairman in separate authenticated browser contexts.
2. Rapporteur types in the report.
3. Viewer sees near-realtime **Live preview — unsaved** text without edit controls.
4. Rapporteur pauses; autosave succeeds.
5. Viewer refetches authoritative saved report and live-preview marker clears.
6. Freeze report; any live preview disappears and cannot resume.
7. Remove/replace Rapporteur if safe test data permits; old Rapporteur preview attempts are rejected.

### Evaluation autosave

1. Evaluator changes criteria and recommendations.
2. Wait for autosave.
3. Reload and confirm the evaluator's own saved DRAFT returns.
4. Open another evaluator account and prove the first evaluator's draft values are not visible.
5. Finalize own evaluation explicitly with signature.
6. Other clients receive readiness/status refresh only, not private scores.

---

## 11. Automated acceptance requirements

At minimum verify:

### Rapporteur autosave

- debounce/coalescing;
- one in-flight request;
- latest changes saved after an in-flight request;
- bodyVersion updated from server response;
- stale CAS never silently overwrites;
- explicit Save Draft/Save now uses the same save pipeline;
- dirty/saving/saved/error/offline state transitions.

### Live preview

- only assigned Rapporteur can send;
- broad role cannot spoof sender authority;
- removed Rapporteur rejected;
- frozen/concluded/cancelled report rejects preview;
- active authorized viewer receives preview;
- removed/unassigned viewer does not;
- payload size/shape validation;
- preview body is not logged/persisted;
- no React Query academic cache mutation from preview;
- saved REST refetch supersedes preview;
- preview discarded on freeze/conclusion/reconnect convergence.

### Evaluation autosave

- private draft autosaves;
- requests serialized;
- no signature autosave;
- no automatic finalize;
- no socket event containing private draft values;
- reload uses server-saved own draft;
- finalized evaluation remains immutable.

Run the full CDW-8 realtime/security regression after implementation.

---

## 12. Implementation boundary

Expected production areas include:

### Frontend

- Committee Report authoring panel;
- read-only report viewer;
- evaluation form;
- Defense Workspace realtime hook/client;
- a small reusable debounced/serialized autosave helper if justified.

### Backend

- Socket.IO server/client event contract for `report:preview`;
- exact Rapporteur sender authorization using existing domain authority;
- payload validation/size guard.

The implementation should reuse existing report and evaluation REST endpoints. A new REST academic-write endpoint is not expected.

No Prisma migration is expected.

---

## 13. Package gate relative to CDW-9

Sequence:

```text
CDW-8 ACCEPTED / CLOSED
  -> CDW-LIVE-1 design
  -> CDW-LIVE-1 implementation + regression + manual QA
  -> CDW-LIVE-1 acceptance
  -> CDW-9 hardening / production readiness
```

CDW-9 must not absorb unfinished CDW-LIVE-1 behavior.

If implementation discovers that this feature requires a schema redesign, multi-writer merge model, CRDT, or an academic privacy-policy change, STOP and redesign the package before coding further.

---

## 14. Definition of done

CDW-LIVE-1 is complete only when:

- Rapporteur report DRAFT autosaves through REST without overlapping writes;
- server-confirmed save state is visible;
- accidental reload after a successful autosave restores the saved report;
- authorized committee viewers can see a near-realtime read-only unsaved report preview;
- preview content never becomes authoritative academic state by socket alone;
- persisted report saves still use `report.draft.updated` + REST refetch;
- evaluation criteria/recommendations autosave privately to the evaluator's own DRAFT;
- no private evaluation draft value is broadcast to other evaluators;
- Review & Finalize remains manual, signed, and irreversible;
- report freeze/signatures/conclusion remain explicit;
- no Panelist/Chairman gains report edit authority;
- no live cursor/presence/CRDT feature is added;
- CDW-8 authorization/privacy/polling/history behavior still passes regression;
- manual multi-user report-preview behavior is executed where the environment permits, otherwise explicitly reported as NOT EXECUTED.
