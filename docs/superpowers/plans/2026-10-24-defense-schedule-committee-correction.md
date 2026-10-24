# DEF-CORR-1 — Defense Schedule & Committee Correction Implementation Plan

**Date:** 2026-10-24  
**Repository:** `MuelTech/graduate-system`  
**Target branch:** `feat/defense-schedule-committee-correction`  
**Starting `main` / branch HEAD:** `3aa00efb6264a5f92dd09d4f9feade143682a68f`  
**Parent authority:** `docs/superpowers/DEFENSE_WORKFLOW_SOURCE_OF_TRUTH.md`  
**UI authority:** `docs/superpowers/ui-ux/SYSTEM_UI_UX_PLAYBOOK.md`  
**Tracking index:** `docs/superpowers/GSIS_IMPLEMENTATION_CHECKLIST.md`  
**Status:** ACTIVE DOCUMENTED PACKAGE — IMPLEMENTATION NOT YET ACCEPTED

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

### Checkpoint A — Backend authority + assignment lifecycle

Implement the domain/security foundation first:

- add the backward-compatible active/inactive lifecycle for `PanelAssignment`;
- add and validate any required Prisma migration;
- make all current-roster/current-authority reads distinguish active assignments from historical inactive assignments;
- preserve assignment-bound annotation/comment authorship;
- add the Admin-only schedule/committee correction mutation;
- enforce `SCHEDULED`-only correction;
- preserve exact schedule/manuscript/attempt identity;
- revalidate committee policy and automatic Adviser authority;
- add canonical initial-schedule and correction AuditLog events;
- add focused/proportional backend tests.

**Stop after Checkpoint A.** Report exact changed files, migration, test evidence, remaining risks, and ending commit before starting frontend work. Do not begin Checkpoint B until Checkpoint A is reviewed/accepted for continuation.

### Checkpoint B — Admin Manage Schedule & Committee UI

After Checkpoint A is accepted for continuation:

- add the deliberate **Manage Schedule & Committee** action to the accepted Scheduled master-detail workspace;
- preload the exact current schedule and active roster;
- edit date/time/Venue or Meeting Details and manually assigned committee roles;
- keep Proposal/Final Adviser locked **Automatic** and omit Adviser for Title;
- reuse canonical committee-policy/readiness validation;
- provide Save/Cancel and focused confirmation;
- refresh the exact authoritative schedule/roster after save;
- keep audit history out of the operational detail UI;
- add directly affected frontend verification.

**Stop after Checkpoint B.** Report exact changed files, frontend verification, any backend contract adjustment, and ending commit before starting notification/consolidation work.

### Checkpoint C — Bounded notifications + consolidated integrity verification

After Checkpoint B is accepted for continuation:

- reuse existing schedule/assignment notification/email behavior only where practical;
- ensure newly assigned members receive appropriate bounded notice;
- ensure removed members immediately lose active-session authority regardless of notification delivery;
- avoid duplicate notices for unchanged members;
- run the cross-cutting backend regressions required by the assignment lifecycle change;
- run proportional frontend verification;
- perform/prepare the documented manual/browser QA matrix;
- update documentation with implementation evidence and final acceptance state.

Checkpoint C must **not** redesign notifications/email or introduce a second audit/history UI.

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

## 3. Current implementation audit

### 3.1 Application approval already has canonical actor audit

`ThesisRepository.approveApplication()` writes:

- `AuditLog.actorId`;
- `DEFENSE_APPLICATION_APPROVE`;
- exact thesis/application target;
- old/new state;
- server timestamp.

Preserve this behavior unchanged.

### 3.2 Initial scheduling has actor provenance but no canonical schedule audit event

Current initial scheduling:

- uses `POST /defense/:id/schedule`;
- persists `DefenseSchedule.setById = adminId`;
- creates the initial `PanelAssignment` roster in the same transaction;
- moves the session to `SCHEDULED`;
- sends scheduling email after the transaction.

Therefore the original roster is attributable to the scheduling Admin, but the roster/schedule snapshot is not currently represented as a dedicated `AuditLog` event.

DEF-CORR-1 should add a canonical schedule-created audit event for new schedules going forward. Do not remove `setById`, and do not fabricate/backfill historical audit rows.

### 3.3 PanelAssignment currently has no active/inactive lifecycle

Current `PanelAssignment` stores:

- `scheduleId`;
- `userId`;
- `role`;
- `createdAt`.

There is no current assignment-lifecycle marker.

This matters because `DefenseAnnotation` and `DefenseAnnotationComment` store `authorAssignmentId` foreign keys. A replaced member may already have pre-defense annotations/comments while the session is still `SCHEDULED`.

Therefore DEF-CORR-1 must **not** solve replacement by deleting a referenced assignment or by rewriting its `userId` to the replacement person.

### 3.4 Recommended assignment-lifecycle change

Add a backward-compatible active-state marker to `PanelAssignment`, preferably:

```text
isActive Boolean @default(true)
```

Existing rows migrate as active.

Canonical behavior:

- current roster/authorization uses only `isActive = true`;
- replacing a member deactivates the old assignment rather than deleting/reassigning it;
- the replacement receives a new active assignment;
- if the same user already has an inactive row for the same schedule, reactivate that row rather than violating the existing `scheduleId + userId` uniqueness rule;
- role correction for the same active user may update that assignment's role, with the immutable AuditLog before/after snapshot preserving the change;
- inactive assignment rows remain available to resolve historical annotation/comment authorship.

Do not add per-assignment `assignedById` merely to duplicate the Audit Log actor. AuditLog remains the canonical change history.

### 3.5 Active-assignment filtering is security-critical

The implementation must audit every current-roster or authorization read that treats any `PanelAssignment` row as current authority.

Known high-risk examples include:

- defense workspace assignment resolution;
- oral evaluation ownership;
- Rapporteur/finalization authority;
- collaborative annotation/comment write authority;
- defense realtime membership;
- current defense-history access checks;
- current panelist assignment/dashboard lists;
- RAP signer/current participant derivation;
- current official-record/current committee projections.

Historical annotation/comment author relations must continue resolving inactive assignment rows by exact assignment ID.

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

Checkpoint completion is **not** overall feature acceptance:

- **Checkpoint A complete** means backend/domain authority is implemented and reviewed enough to proceed to UI.
- **Checkpoint B complete** means the Admin correction UI is implemented and reviewed enough to proceed to consolidation.
- **Checkpoint C complete** means the bounded notification reuse and consolidated verification have been completed.

DEF-CORR-1 may be marked fully accepted only after:

- Checkpoints A, B, and C are complete on `feat/defense-schedule-committee-correction`;
- focused/proportional automated verification is complete;
- migration validation is complete if schema changes are introduced;
- independent remote source review is complete;
- project-owner manual/browser review of the correction flow is accepted;
- documentation records the final implementation commit/evidence.

Do not create separate branches for A/B/C unless a later verified defect or scope change requires isolation.

Do not merge to `main` until the project owner explicitly approves the completed DEF-CORR-1 package.
