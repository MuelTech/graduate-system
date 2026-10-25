# DEF-CORR-1 — Defense Schedule & Committee Correction Implementation Plan

**Date:** 2026-10-24  
**Repository:** `MuelTech/graduate-system`  
**Target branch:** `feat/defense-schedule-committee-correction`  
**Starting `main` / branch HEAD:** `3aa00efb6264a5f92dd09d4f9feade143682a68f`  
**Parent authority:** `docs/superpowers/DEFENSE_WORKFLOW_SOURCE_OF_TRUTH.md`  
**UI authority:** `docs/superpowers/ui-ux/SYSTEM_UI_UX_PLAYBOOK.md`  
**Tracking index:** `docs/superpowers/GSIS_IMPLEMENTATION_CHECKLIST.md`  
**Status:** ACCEPTED ON FEATURE BRANCH — Checkpoints A/B/C complete; independent remote review passed; project-owner manual UI result accepted on 2026-10-25. Final pre-documentation implementation HEAD: `9615af591d47e4d004fb74926031a9192770886d`. Not yet merged to `main`.

## 1. Goal

Implement one bounded Admin recovery flow for an already-scheduled defense:

> **Manage Schedule & Committee**

The flow allows an authorized Admin to correct the current defense date, time, Venue / Meeting Details, and manually assigned committee members **only while the exact defense session remains `SCHEDULED`**.

The implementation must preserve:

- the exact defense attempt and `DefenseSchedule.id`;
- the exact schedule-bound manuscript;
- the authoritative Proposal/Final Adviser relationship;
- valid Master's/Doctoral committee composition;
- historical author/participant attribution;
- automatic immutable audit evidence;
- current scoring, RAP, conclusion, official-document, and PREDEF authority boundaries.

This package is a correction of the current scheduled state. It is **not** cancellation/rescheduling by creating another attempt.

## 1.1 Implementation sequencing — one package, three checkpoints

DEF-CORR-1 remains **one bounded feature on one branch**. The checkpoints below are implementation sequencing boundaries, not separate initiatives, branches, or acceptance packages.

### Checkpoint A — Backend authority + assignment lifecycle — COMPLETE FOR CONTINUATION

Checkpoint A was implemented and independently reviewed at ending HEAD:

`ed3d6c3e70231a67c045eead9b6609a8baceeac5`

Implemented foundation:

- backward-compatible active/inactive lifecycle for `PanelAssignment`;
- additive Prisma migration `20261024230000_panel_assignment_active_lifecycle`;
- current-roster/current-authority filtering to active assignments;
- preservation of assignment-bound annotation/comment and exact historical assignment attribution;
- Admin-only schedule/committee correction mutation;
- `SCHEDULED`-only correction guard;
- exact schedule/manuscript/attempt preservation;
- canonical committee revalidation and automatic Adviser authority;
- canonical initial-schedule and correction AuditLog events;
- focused and full-backend verification.

Checkpoint A is accepted **for continuation to Checkpoint B only**. Overall DEF-CORR-1 remains active/not accepted.

### Checkpoint B — Admin Manage Schedule & Committee UI — COMPLETE FOR CONTINUATION

Checkpoint B was implemented and independently reviewed at ending HEAD:

`c408488ddbac186b167961086512d8d143d4d01f`

Implemented UI integration:

- Scheduled detail remains read-only by default;
- **Manage Schedule & Committee** is shown only for the exact `SCHEDULED` session;
- entering edit mode refreshes the exact authoritative detail first;
- exact current date/time/Venue or Meeting Details and active committee are preloaded;
- existing `DefenseScheduleForm`, `DefenseCommitteeBuilder`, and `DefenseReviewSummary` are reused;
- Proposal/Final Adviser is displayed as **Automatic**, cannot be edited, and is omitted from the correction payload;
- Title renders no Adviser seat;
- Save/Cancel/no-op guard + focused confirmation are implemented;
- successful correction refreshes the exact schedule and affected list/count caches while keeping the same selected schedule;
- lifecycle `409` refreshes authoritative state and exits correction if the session is no longer `SCHEDULED`;
- no audit-history UI or notification refinement was introduced.

Checkpoint B is accepted **for continuation to Checkpoint C only**. Overall DEF-CORR-1 remains active/not accepted.

### Checkpoint C — Bounded notifications + consolidated integrity verification — COMPLETE / ACCEPTED

Checkpoint C implementation commit:

`0403144`

Implemented behavior:

- reused the existing `Notification` model with `DEFENSE_SCHEDULE` and `DEFENSE_ASSIGNMENT`; no new notification type or schema change;
- schedule changes notify the Student and current active committee;
- added/re-added members receive one assignment notice;
- removed members receive one removal notice;
- unchanged members receive no assignment notice;
- schedule+roster corrections deduplicate notices by recipient and event purpose;
- notification creation is best-effort after the authoritative correction transaction;
- initial scheduling now uses the actual seeded `defense_schedule` template and supported student variables;
- correction email templates were intentionally not expanded because no compatible assignment/removal template exists;
- consolidated backend/frontend verification and final browser QA were completed.

Checkpoint C was accepted without redesigning notifications/email or introducing a second audit/history UI.

The known complete-state PATCH / simultaneous-Admin last-write-wins risk is a **future hardening item**, not an implicit Checkpoint C scope expansion. Do not add optimistic concurrency/version-token semantics unless separately approved.

### Checkpoint A evidence

- Starting documented checkpoint HEAD: `cae4540c0774f1a589fd999d192fa14dbe5dd725`.
- Production/schema commit: `c2cc59c54201c660a1144829d31655bd2520e236`.
- Checkpoint A ending/test commit: `ed3d6c3e70231a67c045eead9b6609a8baceeac5`.
- Migration: `20261024230000_panel_assignment_active_lifecycle`.
- Focused checkpoint tests: **27 passed / 0 failed**.
- Full backend suite: **192 test files passed / 2,473 tests passed / 5 environment-conditional skips / 0 failures**.
- `npx prisma generate`: passed.
- `npx prisma validate`: passed.
- `npx tsc --noEmit`: passed.
- backend build: passed.
- `npx prisma migrate status`: 40 migrations found; only the new DEF-CORR-1 migration was pending on the local database at report time.
- Live multi-connection contention test: **NOT EXECUTED**.
- Browser/manual QA: **NOT EXECUTED — backend/domain checkpoint only**.
- Hosted CI: **NOT EXECUTED**.
- Notifications/email refinement: deferred to Checkpoint C.
- Frontend/UI work: not started in Checkpoint A.

**Checkpoint B runtime note:** the pending DEF-CORR-1 migration was applied locally before Checkpoint B browser QA.

### Checkpoint B evidence

- Starting HEAD: `767a32d4d62f88bef7aad3016951f8a82c080d75`.
- Checkpoint B ending commit: `c408488ddbac186b167961086512d8d143d4d01f`.
- Local migration `20261024230000_panel_assignment_active_lifecycle` was applied before runtime QA.
- Changed files were limited to the Admin Scheduling frontend/shared scheduling components and a focused verifier; no backend contract/schema/migration change was required.
- Correction endpoint used: `PATCH /thesis/defense/schedules/:scheduleId`.
- Payload includes date/time/venue + manual committee roles only; Adviser is excluded and remains server-derived.
- Frontend typecheck: passed.
- Scoped ESLint: passed.
- Checkpoint B verifier: **11/11 passed**.
- Combined Adviser/scheduling verification: **18/18 passed**.
- Frontend production build: passed; existing Next.js middleware-deprecation and Node module-registration warnings remain.
- Browser/manual QA: **EXECUTED — PASS** against a real seeded `SCHEDULED` Proposal defense; verified read-only default, Manage flow, exact preload, schedule change, Panelist replacement, Automatic Adviser, confirmation, persisted save/re-entry, Cancel discard, no-op Save guard, and non-`SCHEDULED` lock. Test record restored afterward.
- Full backend suite was not rerun because Checkpoint B changed no backend source and Checkpoint A's backend suite remained accepted.
- Hosted CI / production-runtime validation: **NOT EXECUTED**.
- Concurrency hardening: simultaneous Admin edits remain last-write-wins because the complete-state PATCH has no version token; explicitly deferred unless separately approved.
- Notification/email refinement: not started in Checkpoint B and remains for Checkpoint C.

### Checkpoint C evidence

- Starting HEAD: `28881d53ec85e248ebd7e0bf28b6084b37dcfc27`.
- Checkpoint C implementation commit: `0403144`.
- Notification audit confirmed the initial controller called nonexistent `defense_scheduled` with panelist-oriented tags while the seeded template is `defense_schedule` with `student_name`, `defense_date`, `defense_time`, and `venue`. The initial email path now uses that seeded template and sends to the Student; email remains best-effort after scheduling.
- In-app notifications reuse existing `NotificationType.DEFENSE_SCHEDULE` and `DEFENSE_ASSIGNMENT`; no enum, template family, preference UI, or notification architecture redesign was introduced.
- Correction notices are derived only from authoritative before/after snapshots: schedule changes notify the Student and current active committee; added/re-added members receive one assignment notice; removed members receive one removal notice; role changes use one assignment notice; unchanged members do not receive assignment notices.
- Notices deduplicate by recipient. A schedule+roster correction produces one intentional notice per affected user, with `relatedRecordType = DEFENSE_SCHEDULE` and `relatedRecordId = scheduleId`.
- Notification creation is outside the correction transaction and failures are caught/logged. Correction, AuditLog, active roster, and authority changes remain committed if notification creation fails.
- Removed-member authority: browser/runtime verification returned `403 You are not assigned to this defense session` for the exact Defense Workspace.
- Added-member authority: browser/runtime verification returned `200` with the new `PANELIST` role for the exact Defense Workspace.
- Historical attribution and unchanged-member dedup remain covered by the automated rules/authority tests.
- Adviser invariant: Proposal/Final Adviser remains the server-derived active Adviser and automatic seat; Title remains Adviser-free.
- Full backend suite: **194 test files / 2,483 passed / 5 environment-conditional skips / 0 failures**.
- Checkpoint C focused notification/email/correction tests: **31 passed / 0 failed**.
- Prisma generate/validate: passed. Migration status: database schema up to date at 40 migrations.
- Backend TypeScript/build and frontend TypeScript/scoped ESLint/build: passed.
- Frontend Checkpoint B + Adviser/scheduling verifiers: **18/18 passed**.
- Browser/manual QA: **EXECUTED — PASS**. Verified Admin correction, in-app notification effects, removed-member `403`, added-member `200` as `PANELIST`, unchanged-member single schedule notice, and non-`SCHEDULED` Manage lock. The test fixture was restored afterward.
- Hosted CI: **NOT EXECUTED**.
- Remaining risks: simultaneous Admin last-write-wins remains a future hardening item; initial-scheduling committee email is not expanded because only a student-facing seeded schedule template exists.
- **Independent remote review:** PASS. The final review found one inaccurate initial-scheduling success claim, corrected at `b356a0891523da0c1bca399f6cb1e2198127b61b`; the redundant lifecycle suffix was then removed at `9615af591d47e4d004fb74926031a9192770886d` after project-owner feedback.
- **Project-owner manual UI acceptance:** PASS on 2026-10-25.
- **Final accepted pre-documentation implementation HEAD:** `9615af591d47e4d004fb74926031a9192770886d`.
- **Status:** DEF-CORR-1 is fully accepted on the feature branch and ready for PR/merge preparation; it is not yet merged to `main`.

### Sequencing rule

An agent may implement all three checkpoints on the same branch, but it must **not treat the package as one uninterrupted coding pass**. Each checkpoint has a review/report boundary. A defect discovered in an earlier checkpoint must be corrected before proceeding rather than deferred into a later layer.

## 2. Confirmed project decisions

### 2.1 Editable scope

While the exact session remains `SCHEDULED`, Admin may correct:

- defense date;
- defense time;
- Venue / Meeting Details;
- Chairman;
- Panelists;
- Rapporteur;
- Facilitator.

Proposal/Final Adviser is not editable from Scheduling. It remains derived from the current authoritative active `AdviserAssignment`.

### 2.2 Lock boundary

Normal correction is allowed only before the defense starts.

Reject the mutation once the session is no longer `SCHEDULED`, including:

- `IN_PROGRESS`;
- `AWAITING_CONCLUSION`;
- `CONCLUDED`;
- cancelled/otherwise closed states.

Exceptional post-start substitution is a different future recovery workflow.

### 2.3 Audit policy

No mandatory reason field.

Every successful initial schedule creation and every successful DEF-CORR-1 correction must automatically preserve the actor and exact before/after state in `AuditLog`.

The Audit Log is the canonical historical trail. Defense Application and Scheduling details remain focused on the current operational state.

### 2.4 Notification policy

Reuse existing notification/email capability where practical.

This package may notify newly assigned/affected participants but must not redesign the notification or email subsystem. Audit success must not depend on email delivery success.

## 3. Checkpoint A implemented baseline

### 3.1 Application approval already has canonical actor audit

`ThesisRepository.approveApplication()` writes:

- `AuditLog.actorId`;
- `DEFENSE_APPLICATION_APPROVE`;
- exact thesis/application target;
- old/new state;
- server timestamp.

Preserve this behavior unchanged.

### 3.2 Initial scheduling now has canonical schedule audit evidence

Initial scheduling continues to:

- use `POST /defense/:id/schedule`;
- persist `DefenseSchedule.setById = adminId`;
- create the initial active `PanelAssignment` roster in the same transaction;
- move the session to `SCHEDULED`.

Checkpoint A additionally writes `DEFENSE_SCHEDULE_CREATED` for new schedules with the exact schedule + initial active roster snapshot. `DefenseSchedule.setById` remains intact. No historical audit backfill was introduced.

### 3.3 PanelAssignment active/inactive lifecycle is implemented

`PanelAssignment` now includes:

- `scheduleId`;
- `userId`;
- `role`;
- `isActive Boolean @default(true)`;
- `createdAt`.

The additive migration preserves existing rows as active.

Because `DefenseAnnotation` and `DefenseAnnotationComment` store exact `authorAssignmentId` foreign keys, replaced members are deactivated rather than deleted/reassigned. Historical exact-assignment identity remains available for attribution.

### 3.4 Implemented assignment-lifecycle behavior

Canonical behavior after Checkpoint A:

- current roster/authorization uses only `isActive = true`;
- replacing a member deactivates the old assignment rather than deleting/reassigning it;
- the replacement receives a new active assignment;
- if the same user already has an inactive row for the same schedule, that row is reactivated under the existing `scheduleId + userId` uniqueness rule;
- safe role correction for the same active user updates the assignment role;
- immutable AuditLog before/after snapshots preserve the correction history;
- inactive assignment rows remain available for historical annotation/comment and exact official-record attribution.

No per-assignment `assignedById` was added; AuditLog remains the canonical change history.

### 3.5 Active-assignment filtering was audited in Checkpoint A

Checkpoint A updated current-roster/current-authority reads to require active assignments across the high-risk defense surfaces, including:

- defense workspace assignment resolution;
- oral evaluation ownership/completion counts;
- Rapporteur/finalization authority;
- collaborative annotation/comment/report write authority;
- defense realtime/report-preview membership;
- current defense-history access;
- panelist dashboard and assignment lists;
- RAP participant/signature derivation;
- scheduled-defense/current committee projections;
- official Summary/evaluation bundle/Defense Application/Admin Defense Record committee projections;
- Adviser candidate derivation from the passed Title committee;
- thesis document authorization;
- conclusion/Chairman/evaluator authority.

Historical exact-assignment author/record reads intentionally remain unfiltered by `isActive` where exact attribution is required.

## 4. Server mutation design

### 4.1 Route

Add one schedule-scoped Admin mutation route, preferred shape:

```http
PATCH /defense/schedules/:scheduleId
```

It must use the existing authenticated Admin authorization pattern.

Do not expose a Student/Adviser/Panelist mutation path.

### 4.2 Request contract

Use one complete correction payload for the editable current state:

```ts
{
  defenseDate: string;
  defenseTime: string;
  venueOrLink: string;
  assignments: Array<{
    userId: string;
    role: "CHAIRMAN" | "PANELIST" | "RAPPORTEUR" | "FACILITATOR";
  }>;
}
```

Do not accept an editable Adviser assignment in the correction payload.

For Proposal/Final, resolve the active Adviser server-side and combine it with the submitted editable roster before canonical committee validation.

### 4.3 Transaction

The correction must run as one transaction.

Inside the transaction:

1. lock/reload the exact `DefenseSchedule`;
2. verify it exists and remains `SCHEDULED`;
3. defensively reject if a conclusion/closed attempt state already exists;
4. preserve `manuscriptDocumentId`, `defenseType`, `thesisId`, and attempt identity;
5. resolve the authoritative Adviser for Proposal/Final;
6. validate the resulting full committee using the existing `DefenseCommitteePolicy`;
7. capture the exact **before** schedule + active-roster snapshot;
8. update date/time/venue;
9. deactivate removed/replaced current assignments without destroying assignment-bound history;
10. create/reactivate/update active assignments needed for the corrected roster;
11. capture the exact **after** snapshot;
12. write the immutable correction `AuditLog` record;
13. commit.

If audit creation fails, the correction must roll back.

Do not create a second `DefenseSchedule`.

### 4.4 Audit snapshot

Use machine-readable JSON in `oldValue` / `newValue`.

Minimum snapshot:

```json
{
  "scheduleId": "...",
  "thesisId": "...",
  "defenseType": "PROPOSAL_DEFENSE",
  "schedule": {
    "defenseDate": "...",
    "defenseTime": "...",
    "venueOrLink": "..."
  },
  "committee": [
    {
      "assignmentId": "...",
      "userId": "...",
      "displayName": "...",
      "role": "PANELIST"
    }
  ]
}
```

The audit row must use the authenticated Admin as `actorId`.

No reason is required.

Use action names consistent with the existing audit conventions. At minimum the system needs distinct human-readable semantics for:

- initial defense schedule/roster creation;
- post-scheduling schedule/committee correction.

Add/update audit-label mapping so Admin audit surfaces do not display raw internal action codes.

## 5. Initial scheduling alignment

Update the existing initial scheduling transaction so that new schedules also write a canonical AuditLog snapshot.

Required semantics:

- authenticated Admin actor;
- exact created schedule;
- exact initial active roster;
- date/time/venue;
- defense type/thesis identity;
- same transaction as schedule + roster creation.

Existing `DefenseSchedule.setById` remains intact.

Do not retroactively generate audit rows for legacy schedules.

## 6. Notification behavior

Keep notifications secondary to the authoritative transaction.

After a successful correction commit:

- newly assigned participant(s) may receive the existing defense assignment/schedule email/notification pattern;
- removed participants must lose active-session authorization immediately regardless of notification delivery;
- unchanged participants do not need duplicate assignment notices merely because another member changed;
- if date/time/venue changes, reuse an existing suitable schedule notification path where practical;
- email/notification failure must not roll back a successfully audited schedule correction.

Do not add a new generalized notification architecture.

## 7. Frontend — Scheduling & Panels

Primary surfaces:

- `frontend/src/app/(portal)/admin/thesis/scheduling/page.tsx`;
- `frontend/src/components/admin/defense-scheduling/scheduled-defense-detail.tsx`;
- existing Ready/Scheduled committee builder components where reuse is safe.

### 7.1 Scheduled state

Keep the accepted Scheduled master-detail state concise and read-only by default.

While the selected session is `SCHEDULED`, show one:

> **Manage Schedule & Committee**

action.

Do not show this action after the session leaves `SCHEDULED`.

### 7.2 Edit mode

Use the existing Scheduling workspace/right-side context rather than introducing a disconnected page.

Edit mode should:

- preload current date/time/venue;
- preload the current active committee;
- reuse the accepted role/quota roster pattern;
- show Proposal/Final Adviser as locked **Automatic**;
- omit Adviser entirely for Title;
- use the same canonical policy/readiness checks as initial scheduling;
- contain no mandatory reason field;
- provide Save/Cancel;
- use a focused confirmation for the final consequential save.

After success:

- refresh Ready/Scheduled queries/current schedule detail;
- exit edit mode;
- show the new authoritative current state;
- use concise success feedback.

Do not render the complete audit history inside this detail panel.

## 8. Exact invariants

DEF-CORR-1 must prove all of the following:

1. Application approval authority is unchanged.
2. Exact `DefenseSchedule.id` is unchanged.
3. Exact `manuscriptDocumentId` is unchanged.
4. `defenseType` is unchanged.
5. Thesis/student identity is unchanged.
6. Proposal/Final Adviser comes only from the authoritative active AdviserAssignment.
7. Title has no Adviser seat.
8. Correct Master's/Doctoral committee composition remains mandatory.
9. Replaced members lose current-session authority.
10. Historical annotation/comment authors remain attributable to their original users.
11. No score/signature/RAP/conclusion record is rewritten by this flow.
12. No correction is allowed after the session leaves `SCHEDULED`.
13. No second schedule/attempt is created.
14. Every successful correction has one immutable actor + before/after audit trail.
15. No mandatory reason is introduced.

## 9. Verification

### 9.1 Backend focused tests

Cover at minimum:

- ADMIN-only route;
- schedule not found;
- `SCHEDULED` success;
- `IN_PROGRESS` / `AWAITING_CONCLUSION` / concluded rejection;
- date-only correction;
- venue/time correction;
- Chairman replacement;
- Panelist replacement;
- Rapporteur replacement;
- Facilitator replacement;
- Proposal/Final Adviser tampering impossible;
- Title no-Adviser policy;
- Master's committee validation;
- Doctoral committee validation;
- invalid roster fails without mutation/audit;
- replaced assignment becomes inactive and loses authorization;
- exact annotation/comment historical authorship survives replacement;
- inactive member cannot access current defense workspace/realtime/collaboration/evaluation paths;
- reactivation of a previously inactive same user remains unique and valid;
- exact manuscript binding unchanged;
- audit before/after snapshot;
- audit actor = authenticated Admin;
- audit failure rolls back mutation;
- initial schedule creation now writes its schedule/roster audit;
- notification/email failure does not roll back authoritative success.

### 9.2 Regression scope

Because active/inactive assignment authority is cross-cutting, run proportional regressions for:

- committee policy;
- scheduling;
- defense workspace;
- oral evaluation;
- collaboration annotations/comments;
- realtime membership;
- RAP/finalization;
- defense history/current assignment access;
- official current committee projections.

Run backend build/typecheck and Prisma validation/migration checks if the assignment lifecycle field requires a schema migration.

### 9.3 Frontend verification

Cover:

- Manage action visible only for `SCHEDULED`;
- current values prefilled;
- Adviser locked/automatic for Proposal/Final;
- no Adviser for Title;
- no reason field;
- role quotas and readiness validation;
- successful save refreshes exact current schedule;
- cancel preserves current state;
- post-start sessions show no correction action;
- no verbose audit feed added to the Scheduled detail.

Use scoped ESLint/TypeScript plus the directly affected verifier/tests. Run a full production build only when changed structure/imports/routes/configuration justify it or focused checks reveal a problem.

## 10. Manual/browser QA

Before acceptance, project-owner QA should exercise at least:

1. Open an existing `SCHEDULED` defense in Scheduling & Panels.
2. Enter **Manage Schedule & Committee**.
3. Change date/time/venue and save.
4. Re-open and confirm the exact updated current state.
5. Replace one Panelist and confirm:
   - new member appears;
   - old member is gone from the active roster;
   - old member no longer has current-session access;
   - new member has current-session access.
6. Confirm Proposal/Final Adviser cannot be edited.
7. Confirm a valid Master's/Doctoral roster is enforced.
8. Inspect Audit Log and verify actor + before/after schedule/committee evidence.
9. Start the defense, then confirm **Manage Schedule & Committee** is unavailable and the backend rejects direct correction attempts.
10. If pre-defense annotations/comments exist from a removed member, confirm they remain attributed to the original author.

If a manual check is not executed, report it as **NOT EXECUTED** rather than inferring PASS from tests.

## 11. Out of scope

Do not include:

- post-`SCHEDULED` emergency participant substitution;
- cancellation/rescheduling workflow redesign;
- creation of another defense attempt;
- PREDEF-3 manuscript re-certification/rebinding;
- Adviser relationship correction from Scheduling;
- scoring/evaluation policy changes;
- RAP/signature/conclusion changes;
- official PDF redesign;
- generated-document archival redesign;
- mandatory correction reason;
- full Audit Log UI redesign;
- notification/email subsystem redesign;
- historical audit backfill for schedules created before this package.

## 12. Acceptance checkpoint

Checkpoint completion was used as the staged acceptance path:

- **Checkpoint A complete** means backend/domain authority is implemented and reviewed enough to proceed to UI.
- **Checkpoint B complete** means the Admin correction UI is implemented and reviewed enough to proceed to consolidation.
- **Checkpoint C complete** means the bounded notification reuse and consolidated verification have been completed.

DEF-CORR-1 acceptance gates are now satisfied:

- ✅ Checkpoints A, B, and C complete on `feat/defense-schedule-committee-correction`;
- ✅ focused/proportional automated verification complete;
- ✅ migration validation complete;
- ✅ independent remote source review complete;
- ✅ project-owner manual/browser review accepted on 2026-10-25;
- ✅ documentation records the final implementation commit/evidence.

Do not create separate branches for A/B/C unless a later verified defect or scope change requires isolation.

The project owner has accepted the completed DEF-CORR-1 package. Merge to `main` remains a separate explicit repository action; this document update does not perform the merge.
