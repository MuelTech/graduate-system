# CDW-8 — Socket.IO Realtime Integration Design

**System:** EARIST Graduate School Information System (GS-IS)  
**Repository:** MuelTech/graduate-system  
**Branch:** `refactor/collaborative-defense-workspace`  
**Documentation baseline HEAD:** `744e1ffbee1fa66d1039915b2b2c4d0789b8cbfc`  
**Accepted persisted-workflow baseline:** CDW-0 through CDW-7 at `3d8b7b294af10947e8dc88de825a413521d3a005`  
**Parent functional authority:** `docs/superpowers/COLLABORATIVE_DEFENSE_WORKSPACE_AND_RAP_SOURCE_OF_TRUTH.md` §13  
**Implementation-plan authority:** `docs/superpowers/plans/2026-10-15-collaborative-defense-workspace-implementation.md` §12  
**Status:** PROPOSED IMPLEMENTATION DESIGN — documentation only; CDW-8 production code is NOT started  
**Date:** 2026-10-17

---

## 0. Purpose

CDW-8 adds low-latency synchronization to the already accepted CDW-0 through CDW-7 workflow.

It does **not** create a new academic workflow, a second state store, or a socket-only command path.

The canonical architecture remains:

```
Client command
  -> authenticated REST endpoint
  -> existing authorization/business service
  -> database transaction / persistence
  -> successful commit
  -> small Socket.IO event
  -> authorized clients invalidate/refetch
  -> REST/database truth renders the UI
```

Socket.IO is therefore a delivery accelerator for invalidation signals. It must never become the source of truth for defense status, annotations, evaluations, report content, signatures, or verdicts.

---

## 1. Current implementation baseline

The accepted branch already provides the complete persisted workflow without realtime.

### 1.1 Backend facts

- Express currently starts directly from `backend/src/index.ts` with `app.listen(PORT)`.
- REST authentication uses `Authorization: Bearer <JWT>`.
- `authenticateJWT` verifies the token using `JWT_SECRET` and exposes `userId + role`.
- Exact committee authority comes from `PanelAssignment` for the target `DefenseSchedule`; broad account role alone is not academic authority.
- Writes already use service/repository authorization, transactions/CAS/locks where required.
- No Socket.IO dependency is currently installed.
- CDW-8 is expected to require **no database schema migration**.

### 1.2 Frontend facts

- NextAuth exposes the backend JWT as `session.user.accessToken`.
- `apiClientRequest` sends that token as a Bearer token for REST calls.
- The active workspace query is:
  - `["defenseWorkspace", scheduleId]` — 20-second polling while SCHEDULED / IN_PROGRESS / AWAITING_CONCLUSION.
- Collaboration query:
  - `["defenseAnnotations", scheduleId, documentId]` — 15-second polling while collaboration is writable.
- Committee Report query:
  - `["committeeReport", scheduleId]` — read-only committee viewers poll every 20 seconds; Rapporteur authoring does not poll.
- Own evaluation query:
  - `["oralEvaluation", scheduleId]`.
- Conclusion readiness query:
  - `["conclusionReadiness", scheduleId]` — 15-second polling.
- Existing polling is the accepted correctness fallback and must remain functional after CDW-8.

### 1.3 Accepted workflow invariants that realtime must not change

- SCHEDULED allows review/collaboration but not official scoring.
- Only the assigned Chairman starts the defense.
- Official evaluation is available only while IN_PROGRESS.
- Numerical evaluators are Chairman + Panelists only.
- Private draft/numeric evaluator content is never broadcast to other evaluators.
- Rapporteur owns the in-system free-form Committee Report.
- Report freeze locks report body + academic collaboration.
- Required signatures bind the exact frozen version/hash.
- RAP FINALIZED is required before formal verdict.
- Chairman alone records PASSED / REDEFENSE_REQUIRED.
- CONCLUDED attempts are immutable historical records.
- Historical attempts do not join realtime rooms.

---

## 2. Scope

CDW-8 covers **only the active Defense Workspace synchronization layer**.

Included:

- one Socket.IO server attached to the existing backend HTTP server;
- JWT-authenticated socket connections;
- schedule-room authorization from current `PanelAssignment`;
- one active room namespace pattern: `defense:<scheduleId>`;
- small post-commit domain notification events;
- frontend room join/leave/reconnect lifecycle;
- React Query invalidation/refetch mapping;
- polling fallback preserved;
- automated authorization/event-contract tests;
- multi-user manual verification.

Not included:

- global notification-system replacement;
- Admin dashboard realtime;
- Student portal realtime;
- presence indicators;
- online/offline member list;
- typing indicators;
- live cursors;
- CRDT/Yjs;
- simultaneous report co-editing;
- manuscript byte editing;
- automatic PDF/text/semantic diff;
- AI revision-compliance judgment;
- official form rendering/PDF/print work;
- Redis Socket.IO adapter / multi-instance scaling in this phase.

---

## 3. Core design decisions

### 3.1 REST remains the only command path

There are **no academic mutation socket events**.

Forbidden examples:

```
socket.emit("annotation.create", ...)
socket.emit("evaluation.finalize", ...)
socket.emit("report.freeze", ...)
socket.emit("rap.sign", ...)
socket.emit("defense.conclude", ...)
```

All such actions continue through the existing authenticated REST endpoints.

Socket events are server-to-client invalidation notifications only, except for transport-control events such as room join/leave.

### 3.2 Database remains authoritative

A received event must normally cause React Query invalidation/refetch.

Clients must not trust event payloads as a replacement for the REST read model.

Out-of-order, duplicate, or delayed events are therefore harmless: at worst they trigger an extra authoritative refetch.

### 3.3 Event publication is post-commit and best-effort

A realtime event may be published only after the corresponding service call has completed its authoritative persistence successfully.

If realtime publication fails:

- do **not** roll back or reinterpret an already committed academic write;
- do **not** return a false REST failure for an otherwise successful write;
- log the transport failure safely;
- allow polling/refetch to converge clients.

### 3.4 Existing polling remains during CDW-8

Do not remove or disable the current 15/20-second polling in the first realtime implementation.

Realtime reduces visible latency; polling remains the safety net for:

- disconnected clients;
- proxy/WebSocket failure;
- laptop sleep/wake;
- temporary network switching;
- event loss;
- implementation rollout.

Polling optimization belongs to later measured hardening, not CDW-8 correctness.

---

## 4. Backend server bootstrap

### 4.1 Current state

`backend/src/index.ts` currently calls:

```ts
app.listen(PORT)
```

### 4.2 Target bootstrap

Attach Express and Socket.IO to one Node HTTP server:

```
Express app
    |
Node HTTP Server
    |-- REST /api/*
    `-- Socket.IO /socket.io/*
```

Expected direction:

```ts
const httpServer = createServer(app);
const io = initializeDefenseRealtime(httpServer);
httpServer.listen(PORT);
```

Do not run a second network port for the defense socket.

### 4.3 Dependencies

Expected package additions:

Backend production dependency:
- `socket.io`

Frontend production dependency:
- `socket.io-client`

A backend test client dependency may be added only if genuinely needed for socket integration tests.

Socket.IO already provides TypeScript types; do not add speculative type packages.

### 4.4 Recommended module boundary

Exact file names may follow repository conventions, but the implementation should keep transport concerns isolated. Recommended shape:

```
backend/src/realtime/
  defense-realtime.types.ts
  defense-realtime.server.ts
  defense-realtime.publisher.ts

frontend/src/lib/realtime/
  defense-socket.ts
  defense-realtime-events.ts

frontend/src/hooks/
  use-defense-realtime.ts
```

The domain services must not import frontend concepts or React Query.

The publisher must be safe as a no-op when realtime is unavailable/not initialized.

---

## 5. Authentication

### 5.1 Reuse the existing JWT

CDW-8 must not invent a second authentication system.

The browser obtains the same `session.user.accessToken` already used by `apiClientRequest`.

The Socket.IO client sends the token through Socket.IO auth metadata, not a URL query string:

```ts
auth: { token: accessToken }
```

Avoid putting access tokens into the socket URL because URLs are more likely to be logged.

### 5.2 Server handshake

Server connection middleware:

1. read `socket.handshake.auth.token`;
2. reject missing token;
3. verify using the same `JWT_SECRET` semantics as REST;
4. attach only safe identity fields to `socket.data`, for example:
   - `userId`
   - `role`
5. reject invalid/expired token.

Prefer extracting a shared token-verification helper from the REST middleware rather than implementing materially different JWT rules twice.

### 5.3 Authentication failure behavior

A failed socket connection must not automatically invalidate the REST session by itself.

The workspace continues through REST/polling.

Normal REST 401/403 behavior remains authoritative for session expiration/logout.

---

## 6. Room authorization

### 6.1 Room naming

One room per current defense attempt:

```
defense:<scheduleId>
```

Do not use thesis-global rooms for this feature.

### 6.2 Join control event

Recommended transport-control event:

```
defense:join
```

Input:

```ts
{ scheduleId: string }
```

Use an acknowledgement response such as:

```ts
{ ok: true, room: "defense:<scheduleId>" }
```

or a safe denial:

```ts
{ ok: false, code: "FORBIDDEN" | "NOT_ACTIVE" | "NOT_FOUND" }
```

Do not expose another thesis/student's data in denial messages.

### 6.3 Join authorization algorithm

For the authenticated `socket.data.userId`:

1. validate the schedule id;
2. load the exact `DefenseSchedule`;
3. require a current `PanelAssignment` for that `scheduleId + userId`;
4. allow room membership only when session status is:
   - SCHEDULED
   - IN_PROGRESS
   - AWAITING_CONCLUSION
5. deny:
   - CONCLUDED
   - CANCELLED
   - missing schedule
   - missing assignment.

Account role alone is never enough.

### 6.4 Reconnect

Socket.IO rooms are connection-local.

On every reconnect:

1. obtain/use the currently valid NextAuth access token;
2. authenticate the new socket connection;
3. re-run `defense:join`;
4. re-check current `PanelAssignment`;
5. invalidate/refetch authoritative workspace state.

A user removed/replaced from the committee must fail the next reauthorization.

### 6.5 Stale room membership

Before broadcasting a defense domain event, the realtime publisher/server should revalidate current room membership against the exact schedule assignments and evict sockets whose `userId` is no longer assigned.

This check is transport authorization, not academic business-rule duplication.

The committee is small (7/8 participants), so correctness is preferred over speculative optimization.

If membership revalidation fails because the database is temporarily unavailable, drop the realtime event rather than broadening room access; REST/polling remains available.

### 6.6 Conclusion cleanup

`defense.concluded` is delivered to currently authorized room members after the conclusion commit.

After emission:

- server may remove sockets from that room;
- client invalidates/refetches;
- once authoritative workspace state reports CONCLUDED, the client must not rejoin.

Historical reopening remains REST-only.

---

## 7. Event envelope and privacy

### 7.1 Common envelope

Every domain event should use a small server-generated envelope:

```ts
interface DefenseRealtimeEventBase {
  eventId: string;      // server-generated UUID; transport tracing only
  scheduleId: string;
  occurredAt: string;   // server ISO timestamp
}
```

Entity/version metadata may be added only when useful for targeted invalidation/debugging.

### 7.2 Never include sensitive academic payloads

Realtime payloads must NOT include:

- evaluator criterion values;
- numeric grades/averages;
- evaluator recommendations;
- evaluation signature image/data URL;
- RAP signature image/data URL;
- report body document;
- comment body;
- entire annotation thread;
- formal evidence snapshots;
- storage paths;
- private student documents.

Authorized clients refetch these through existing REST authorization.

---

## 8. Canonical CDW-8 domain events

The original SOT candidate list is retained and one necessary lifecycle event is added: `defense.started`.

### 8.1 `defense.started`

Source:
- successful real SCHEDULED -> IN_PROGRESS transition from `POST /defense/:scheduleId/start`.

Payload:

```ts
{
  eventId,
  scheduleId,
  occurredAt,
  sessionStatus: "IN_PROGRESS"
}
```

Do not emit for an idempotent call that did not change persisted state.

Purpose:
- other committee clients immediately learn that official scoring may now be available after refetch.

### 8.2 `annotation.created`

Source:
- successful persisted annotation creation.

Payload:

```ts
{
  eventId,
  scheduleId,
  occurredAt,
  thesisDocumentId,
  annotationId
}
```

If an annotation is atomically created with an initial comment, this single event is sufficient; do not require a duplicate comment-created event for the same transaction.

### 8.3 `annotation.comment.created`

Source:
- successful persisted comment/reply creation.

Payload:

```ts
{
  eventId,
  scheduleId,
  occurredAt,
  thesisDocumentId,
  annotationId,
  commentId
}
```

No comment body in the event.

### 8.4 `report.draft.updated`

Source:
- successful explicit Committee Report Save Draft.

It is **not** emitted on every Tiptap keystroke.

Payload:

```ts
{
  eventId,
  scheduleId,
  occurredAt,
  reportId,
  bodyVersion
}
```

### 8.5 `evaluation.finalized`

Source:
- successful FINALIZED transition from `POST /defense/:scheduleId/evaluation/finalize`.

Payload:

```ts
{
  eventId,
  scheduleId,
  occurredAt
}
```

Do not include evaluator identity or private evaluation content unless a later explicitly authorized use case requires it.

No realtime event is required for private DRAFT saves.

### 8.6 `report.ready_for_signature`

Source:
- successful DRAFT -> FOR_SIGNATURE freeze transition.

Payload:

```ts
{
  eventId,
  scheduleId,
  occurredAt,
  reportId,
  contentVersion
}
```

Purpose:
- update report state/signature readiness;
- update workspace RAP status;
- make collaboration controls read-only after authoritative refetch.

### 8.7 `rap.signature.recorded`

Source:
- successful own-slot signature write through the canonical workspace signing route;
- the retained legacy active-signing compatibility route should publish the equivalent event when it successfully signs an active attempt.

Payload:

```ts
{
  eventId,
  scheduleId,
  occurredAt,
  reportId,
  contentVersion
}
```

No signer name and no signature evidence are required in the event.

### 8.8 `rap.finalized`

Source:
- the signature operation that actually moves the RAP to FINALIZED.

Payload:

```ts
{
  eventId,
  scheduleId,
  occurredAt,
  reportId,
  contentVersion
}
```

If the final signature causes both events, `rap.signature.recorded` and `rap.finalized` may be emitted in that order. Clients must tolerate duplicate invalidations.

### 8.9 `defense.concluded`

Source:
- successful formal conclusion transaction.

Payload:

```ts
{
  eventId,
  scheduleId,
  occurredAt,
  sessionStatus: "CONCLUDED"
}
```

Do not put the academic verdict into the socket payload. Clients refetch the authoritative workspace/conclusion.

---

## 9. Emit-point rules

Preferred placement: transport/application boundary after the existing service call resolves successfully.

This keeps Socket.IO out of domain authorization and transaction logic.

Conceptual controller flow:

```ts
const result = await service.authoritativeMutation(...);

// service has returned only after persistence/transaction completion
realtime.publishBestEffort("event.name", minimalPayload);

res.status(200).json(result);
```

`publishBestEffort` must catch/log its own transport errors.

### 9.1 Mutation-to-event map

| Existing mutation | Realtime event |
|---|---|
| Start Defense | `defense.started` |
| Create annotation | `annotation.created` |
| Create comment/reply | `annotation.comment.created` |
| Save Committee Report draft | `report.draft.updated` |
| Finalize own evaluation | `evaluation.finalized` |
| Freeze Committee Report | `report.ready_for_signature` |
| Sign RAP slot | `rap.signature.recorded` |
| Last required RAP signature | additionally `rap.finalized` |
| Formal conclusion | `defense.concluded` |

Do not emit for failed validation, authorization denial, transaction rollback, stale CAS failure, or idempotent no-op unless a persisted state transition actually occurred.

Where the current service return value does not distinguish "transition happened" from "idempotent existing state", a small return-metadata extension such as `changed` / `transitioned` / `finalizedNow` is permitted. It must not change academic semantics or schema.

---

## 10. Frontend socket lifecycle

### 10.1 One workspace-level owner

The Defense Workspace route should own one realtime hook/provider.

Do not create independent Socket.IO connections inside:

- comments rail;
- report panel;
- evaluation form;
- signature panel;
- verdict panel.

Recommended:

```
DefenseWorkspacePage
  -> useDefenseRealtime(scheduleId, authoritativeSessionStatus)
  -> existing child components unchanged except query invalidation effects
```

### 10.2 Connection lifecycle

For SCHEDULED / IN_PROGRESS / AWAITING_CONCLUSION:

1. read the current NextAuth session/access token;
2. establish Socket.IO connection;
3. on `connect`, emit `defense:join`;
4. on successful join, invalidate/refetch the workspace once;
5. subscribe to canonical domain events;
6. map each event to React Query invalidations.

On component unmount:
- leave the room if connected;
- remove listeners;
- disconnect the workspace socket.

For CONCLUDED / CANCELLED:
- do not connect/join.

### 10.3 Connection failure

No fatal page error is required merely because realtime is unavailable.

The current polling continues.

Optional development diagnostics may log connection failures, but do not display misleading academic error states for transport-only failure.

---

## 11. React Query invalidation contract

Use one pure event-to-query-key mapping so it can be unit-tested.

### 11.1 Query keys

Current keys:

```
["defenseWorkspace", scheduleId]
["defenseAnnotations", scheduleId, documentId]
["committeeReport", scheduleId]
["oralEvaluation", scheduleId]
["conclusionReadiness", scheduleId]
```

### 11.2 Mapping

| Event | Required invalidations |
|---|---|
| `defense.started` | workspace; own evaluation |
| `annotation.created` | exact annotations key |
| `annotation.comment.created` | exact annotations key |
| `report.draft.updated` | Committee Report |
| `evaluation.finalized` | workspace; Committee Report; conclusion readiness |
| `report.ready_for_signature` | Committee Report; workspace; conclusion readiness |
| `rap.signature.recorded` | Committee Report; workspace; conclusion readiness |
| `rap.finalized` | Committee Report; workspace; conclusion readiness |
| `defense.concluded` | workspace; Committee Report; conclusion readiness |

Notes:

- `evaluation.finalized` does not invalidate another user's private evaluation query. The originating evaluator's existing mutation already refreshes their own record.
- Report freeze does not need to refetch annotation content merely to become read-only; the workspace RAP status is authoritative for collaboration gating.
- Event handlers must confirm the event `scheduleId` matches the mounted workspace before invalidating.
- For annotation events, require the exact `thesisDocumentId` from the event to build the existing exact query key.
- Do not directly write academic records into React Query from event payloads.

---

## 12. Reconnect and convergence

On reconnect:

1. authenticate again;
2. rejoin/reauthorize the exact schedule;
3. invalidate:
   - workspace;
   - annotations for the exact current manuscript;
   - Committee Report;
   - conclusion readiness;
   - own evaluation when relevant.
4. allow existing polling to continue.

This authoritative refetch closes any event gap that occurred while disconnected.

No server-side event replay log is required in CDW-8.

---

## 13. Duplicate, stale, and out-of-order events

Clients must assume Socket.IO delivery can be duplicated or delayed.

Because domain events are invalidation hints:

- duplicate event -> duplicate/no-op invalidation;
- stale event -> refetch returns current DB truth;
- out-of-order events -> latest persisted state wins;
- reconnect after missed events -> full authoritative refetch converges.

Do not implement academic event sourcing, event replay, or client-side version conflict resolution in CDW-8.

---

## 14. Historical mode

Defense History (CDW-6) remains REST-only.

Rules:

- no `defense:<historicalScheduleId>` room join for a CONCLUDED historical attempt;
- no realtime event subscription for historical annotations/comments/RAP;
- manual comparison remains read-only;
- historical evidence is never mutated or carried forward by realtime.

A current active attempt may still show historical material through its existing REST history endpoints; those history records do not become members of the current realtime room.

---

## 15. Security rules

CDW-8 must preserve all CDW-1 through CDW-7 authorization boundaries.

Required:

1. valid JWT before socket connection is accepted;
2. current exact schedule assignment before room join;
3. active/pre-conclusion schedule status before room join;
4. reconnect always reauthorizes;
5. current assignment membership is rechecked before domain-event delivery;
6. event payloads contain no raw signature/evaluation/report/comment content;
7. sockets cannot execute academic writes;
8. CONCLUDED/CANCELLED cannot join;
9. socket failure never weakens REST authorization;
10. client-provided room names are never trusted directly — server derives `defense:<scheduleId>`.

Never authorize by:
- account role only;
- thesis membership only;
- a client-provided role;
- historical assignment alone.

---

## 16. Testing plan

### 16.1 Backend transport/auth tests

Required:

- missing token -> connection denied;
- invalid/expired token -> connection denied;
- valid token + current assignment + SCHEDULED -> join allowed;
- valid token + current assignment + IN_PROGRESS -> join allowed;
- valid token + current assignment + AWAITING_CONCLUSION -> join allowed;
- unassigned user -> join denied;
- CONCLUDED -> join denied;
- CANCELLED -> join denied;
- replaced/removed committee member -> denied after reauthorization;
- room name is derived server-side from schedule id.

### 16.2 Post-commit publication tests

For each instrumented mutation:

- successful authoritative write -> expected event;
- validation/403/409 failure -> no event;
- transaction/CAS failure -> no event;
- realtime publisher failure -> successful REST write remains successful;
- idempotent no-op -> no transition event when no persisted transition occurred.

### 16.3 Payload privacy tests

Assert event payloads do not contain:

- `signatureData`;
- score/criteria fields;
- evaluator recommendations;
- report body;
- comment body;
- storage path/public file URL.

### 16.4 Client mapping tests

Use pure helpers where possible:

- event -> exact React Query invalidation keys;
- wrong schedule id -> ignored;
- annotation event -> exact document query key;
- defense.concluded -> workspace/readiness/report refetch and room shutdown after authoritative state changes;
- reconnect -> full current-workspace convergence refetch.

### 16.5 REST fallback regression

Run the accepted CDW-7 regression suites with realtime disabled/unavailable.

The complete workflow must still work through REST + polling.

---

## 17. Manual multi-user acceptance

Manual QA requires at least two concurrently logged-in assigned committee identities, and preferably the Chairman + Panelist + Rapporteur when testing the complete chain.

Required scenario:

1. Open the same SCHEDULED defense in two browsers/accounts.
2. Panelist A creates an annotation; Panelist B sees it after event-triggered refetch without waiting for the normal poll interval.
3. A reply/comment appears the same way.
4. Chairman starts the defense; Panelist workspace refetches and official evaluation becomes available.
5. One evaluator finalizes; Chairman/Rapporteur completion/readiness surfaces refresh without private numeric-score leakage.
6. Rapporteur explicitly saves the Committee Report; read-only committee viewer refreshes the saved body.
7. Rapporteur freezes the report; all clients refetch, report becomes frozen, collaboration becomes read-only, signer controls become authoritative.
8. One required signer signs; progress refreshes for other members.
9. Last required signature finalizes RAP; Chairman readiness refreshes.
10. Chairman records PASSED or REDEFENSE_REQUIRED; all open clients refetch to CONCLUDED/read-only.
11. Refresh/reopen the concluded attempt; no socket room is joined.
12. Disconnect/block the socket transport and repeat a bounded update; existing polling still converges.
13. Remove/replace an assignment in a test setup, reconnect that user, and verify room reauthorization denies access.

Do not report these as passed unless they were actually executed.

---

## 18. Deployment posture

### 18.1 Initial assumption

CDW-8 assumes one backend Node process/instance.

No Redis Socket.IO adapter is required for the initial implementation.

### 18.2 Reverse proxy

Production proxy/load-balancer configuration must support WebSocket upgrade traffic for the Socket.IO path.

REST must continue working even if WebSocket upgrade is unavailable because Socket.IO/polling and the application's own REST polling provide fallback behavior.

### 18.3 Future horizontal scaling

If the backend later runs multiple replicas:

- add an appropriate Socket.IO cross-instance adapter (for example Redis);
- configure load-balancer/session-affinity requirements according to the selected transport/adapter setup;
- test room authorization and delivery across replicas.

Do not add multi-instance infrastructure speculatively in CDW-8.

---

## 19. Expected implementation files

Likely backend changes:

- `backend/package.json` / lockfile;
- `backend/src/index.ts`;
- new realtime server/types/publisher modules;
- `backend/src/middlewares/auth.middleware.ts` only if extracting shared JWT verification;
- `backend/src/controllers/defense-collaboration.controller.ts`;
- `backend/src/controllers/thesis.controller.ts`;
- narrowly impacted service return metadata if needed to detect real transitions;
- focused realtime tests.

Likely frontend changes:

- `frontend/package.json` / lockfile;
- new defense socket client/event mapping helpers;
- new workspace-level realtime hook;
- `frontend/src/app/(portal)/panelist/defense-workspace/[scheduleId]/page.tsx`;
- verification script/tests for event/query mapping.

No Prisma schema or migration change is expected.

If implementation appears to require a database migration or a new academic state model, stop and review the design before proceeding.

---

## 20. Strict non-goals

CDW-8 must not:

- change evaluator roles;
- expose another evaluator's live score choices;
- change RAP signer policy;
- change verdict semantics;
- change title-authority rules;
- mutate concluded history;
- auto-copy old annotations into a new attempt;
- replace REST writes with sockets;
- store academic state in Socket.IO memory;
- add presence, cursor, typing, CRDT, or simultaneous report editing;
- add automatic manuscript diff or AI compliance;
- implement official EARIST form rendering;
- add Dean signature authority;
- start CDW-9 hardening work.

---

## 21. Implementation package sequence

CDW-8 must be implemented in three bounded packages. This sequencing is part of the implementation design and is intended to keep transport/security, domain event wiring, and final acceptance independently reviewable.

### 21.1 CDW-8A — Backend Realtime Foundation

**Goal:** establish the Socket.IO transport and authorization foundation without changing frontend runtime behavior.

Scope:

- add backend `socket.io` dependency;
- convert the existing Express startup to a shared Node HTTP server;
- attach one Socket.IO server to that HTTP server;
- reuse/extract the existing JWT verification semantics for socket authentication;
- implement `defense:<scheduleId>` room authorization from the caller's current exact `PanelAssignment`;
- permit room membership only for SCHEDULED / IN_PROGRESS / AWAITING_CONCLUSION;
- deny CONCLUDED / CANCELLED / unassigned users;
- implement reconnect-time reauthorization rules;
- implement stale-membership revalidation/eviction before defense event delivery;
- add privacy-safe realtime event types/contracts;
- add a best-effort realtime publisher abstraction that can safely no-op when realtime is unavailable;
- add focused backend transport/auth/room tests.

Explicitly out of scope for CDW-8A:

- no `socket.io-client`;
- no React Query event handling;
- no production domain-event emit wiring yet;
- no UI changes;
- no schema/migration;
- no polling changes.

**Exit gate:** CDW-8A must be independently reviewed and accepted before CDW-8B starts.

### 21.2 CDW-8B — Domain Events + Frontend Synchronization

**Goal:** connect the accepted backend foundation to real persisted workflow transitions and update active Defense Workspace clients through authoritative refetch.

Scope:

- wire the canonical post-commit events:
  - `defense.started`
  - `annotation.created`
  - `annotation.comment.created`
  - `report.draft.updated`
  - `evaluation.finalized`
  - `report.ready_for_signature`
  - `rap.signature.recorded`
  - `rap.finalized`
  - `defense.concluded`;
- emit only after successful authoritative persistence/transaction completion;
- preserve REST success if realtime publication fails;
- add frontend `socket.io-client`;
- implement one workspace-level realtime connection owner;
- implement join/leave/reconnect cleanup;
- implement the documented React Query event-to-invalidation map;
- refetch authoritative state after reconnect;
- keep existing 15/20-second polling as fallback/convergence;
- verify CONCLUDED/CANCELLED workspaces do not join/rejoin;
- add focused backend event-publication and frontend event-mapping tests.

Explicitly out of scope for CDW-8B:

- no socket-based academic writes;
- no client-side authoritative academic cache;
- no polling removal;
- no presence/cursor/typing features;
- no schema/migration;
- no CDW-9 hardening.

**Exit gate:** CDW-8B must be independently reviewed and accepted before CDW-8C starts.

### 21.3 CDW-8C — Acceptance / Regression / Multi-user QA

**Goal:** prove the realtime layer accelerates synchronization without weakening the already accepted REST/database workflow.

Scope:

- full unauthorized-room and state-exclusion regression;
- replacement/removed-assignment reauthorization;
- event-payload privacy regression;
- duplicate/stale/out-of-order event safety;
- reconnect convergence;
- socket unavailable -> REST/polling workflow still functions;
- multi-user browser QA across annotation/comment, Start Defense, evaluation completion, report save/freeze, signatures, RAP finalization, and conclusion;
- verify concluded attempts are read-only and do not join rooms;
- run full backend/frontend regression expected by the repository;
- document exact manual-QA execution status and any remaining deployment caveats.

CDW-8C should be verification-first. Production changes are allowed only for small acceptance-blocking defects discovered during the pass; any larger redesign requires a new review before implementation.

**Exit gate:** CDW-8 is accepted/closed only after CDW-8C is accepted. Do not begin CDW-9 before that point.

### 21.4 Hard sequencing rule

```
CDW-8A
  -> independent remote-source review / acceptance
  -> CDW-8B
  -> independent remote-source review / acceptance
  -> CDW-8C
  -> final CDW-8 acceptance
  -> only then CDW-9
```

Do not collapse all three packages into one implementation prompt unless the project owner explicitly changes this sequencing decision.

---

## 22. Definition of done

CDW-8 is implementation-complete only when:

- Socket.IO is attached to the existing backend HTTP server;
- the same JWT identity model is reused;
- exact current assignment authorization controls room membership;
- only SCHEDULED / IN_PROGRESS / AWAITING_CONCLUSION join active rooms;
- reconnect reauthorizes and refetches;
- all canonical events are emitted only after successful persistence;
- `defense.started` synchronizes the scoring-open transition;
- event payloads are minimal and privacy-safe;
- React Query invalidation uses the existing authoritative REST reads;
- CONCLUDED clients converge to read-only and leave/do not rejoin;
- REST/polling workflow remains fully functional if realtime is unavailable;
- automated realtime/auth/privacy/regression tests pass;
- required manual multi-user scenarios are actually executed or explicitly reported as not executed;
- no schema migration, academic policy change, or out-of-scope realtime feature is introduced.

Until those conditions are proven, CDW-8 remains under implementation and CDW-9 must not begin.
