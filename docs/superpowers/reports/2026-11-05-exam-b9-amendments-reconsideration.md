# EXAM-B9 — Schedule amendments, missed appeals and FAILED-result reconsideration

**Date:** 2026-11-05
**Repository:** `MuelTech/graduate-system`
**Branch:** `feat/exam-engine-scheduling`
**Status:** ACCEPTED FOR PHASE B PROGRESSION — 2026-11-05
**Acceptance:** Independent remote source review: **PASS — no blocking issue found**. B10 is the authorized final Phase B regression/manual acceptance gate.
**Policy:** [Owner-confirmed B9 policy](2026-11-05-exam-b9-owner-policy.md)

## Delivery and verified baseline

Before implementation, local HEAD, tracking HEAD and the live GitHub feature ref all matched `c42d8813e43a9025f654d40c2563cccb0d00598d`. Local/tracking/live `main` matched `a6dc6f57c6e8130482c814e90703765972fddaa9`; the feature was **43 ahead / 0 behind** main and the worktree was clean. The same live refs were checked again before creating the B9 commit. Work stayed on the existing feature branch. No branch recreation, reset, rebase, force push, PR or main merge is part of this package.

The implementation commit is recorded in the delivery section below. The following documentation commit adds this report and updates the checklist, phase plan and UI audit. Final local/tracking/live-ref agreement and both exact commit IDs are reported after the normal push.

## Schema and migration

One additive migration, `20261105010000_exam_amendments_reconsideration`, adds:

- Nullable `EntranceExamApplication.seatReleasedAt` and a slot/release index.
- Appended `ExamAppStatus` values `MISSED`, `RESCHEDULED`, `CANCELLED`.
- `ExamScheduleAmendment`, with one original application, immutable request type/reason/requester/time, bounded pending/approved/rejected decision fields, target slot and unique replacement application link.
- `ExamResultDecision`, unique per application and per score, with the sole decision enum `PASSED_RECONSIDERED`, required reason, deciding Admin and decision time.
- Restrictive foreign keys retaining original applications, scores, actor identities and replacement/target relationships.

No B5–B8 migration was edited. There is no data rewrite, decision fabrication, seat-release backfill, legacy-appeal interpretation, `db push`, ExamPeriod or attempt-number model. All existing seat markers migrate to null; both new tables start empty.

**Configured development DB protection:** the owner reported migrations through B8. Codex did not deploy B9 or write fixtures to that database. All B9 and affected real-database mutation/rehearsal work used generated disposable MariaDB databases. After independent B9 review, the B9 migration remains owner-action pending / not independently confirmed applied. It must be applied before the B10 owner/browser runtime walkthrough.

## Appointment authority and capacity

`seatReleasedAt = null` means the application owns its original seat. A non-null marker is permanent release evidence. Reconciliation counts only unreleased applications. Release conditionally changes the exact application and decrements the stored slot counter once in the same transaction. It cannot make the counter negative. Replacement reservation rechecks the locked target's active state, Program, strict future time, capacity and unreleased count before incrementing and creating a new PENDING application.

Every scheduling mutation takes **Student → all involved slots sorted by ID → exact original application**, then rereads authority under **READ COMMITTED**. A preliminary lookup supplies identities and ownership only. Existing B3 and B4 writers keep compatible lock order; B4 rejects released appointments. No Application → Slot → Student writer was introduced. Slot identity edits remain prohibited when any historical application references the slot, even if its seat was released; minimum capacity uses active reservations.

Amendments require never-started PENDING/APPROVED authority: no actual start, deadline, content revision, execution configuration, answers, score, finalization timestamp/reason/receipt or finalization counts. Partial evidence fails closed. A complete prior Start Now authorization alone is permitted; a partial authorization pair fails. Original application date/time must still equal its original slot. No successful action rewrites or detaches that history.

## Exact appeal and Admin contracts

All reasons are required, trimmed and bounded to **1–2,000 characters**. UUID identifiers are validated. Unsupported payload fields are rejected; actor and timestamps come from the server. New responses use `Cache-Control: private, no-store`, with bounded unexpected-error messages.

| Route under `/exam` | Actor | Body and committed effect |
| --- | --- | --- |
| `POST /applications/:id/missed-appeal` | Exact owning active Applicant | `{reason}`; original appointment date must be **earlier than today's Asia/Manila calendar date**. Creates one pending amendment, sets APPEALED, releases/decrements the stale seat once and audits. No replacement at filing. |
| `POST /applications/:id/missed-appeal/approve` | Current active ADMIN | `{reason,targetSlotId}`; requires a complete pending appeal/release pair and a different active future same-Program target. Reserves target, creates new PENDING application, sets old RESCHEDULED and records decision/replacement link and audit atomically. |
| `POST /applications/:id/missed-appeal/reject` | Current active ADMIN | `{reason}`; sets amendment REJECTED and old application MISSED with decision/audit. No replacement and no second seat decrement. |
| `POST /applications/:id/cancel-appointment` | Current active ADMIN | `{reason}`; only an eligible never-started PENDING/APPROVED appointment with no pending appeal. Sets CANCELLED, releases once, records amendment and audit. |
| `POST /applications/:id/reschedule` | Current active ADMIN | `{reason,targetSlotId}`; same never-started eligibility and target/reservation safeguards. Sets old RESCHEDULED, creates/link new PENDING application and audits. |
| `GET /applications/:id/amendment-options` | Current active ADMIN | Validates exact record eligibility and returns only consistent, available future active same-Program target options. Mutation independently locks/revalidates the chosen target. |
| `POST /applications/:id/reconsider-result` | Current active ADMIN | `{reason}`; records the separate institutional decision described below. |

The original `/exam/appeal` mutation and old appeal approval/rejection routes now fail with guidance to the exact reasoned flow. The APPEALED→FAILED approval and APPEALED→DISQUALIFIED rejection repository mutations were removed. Legacy ambiguous rows are neither reclassified nor given fabricated request/release evidence; legacy APPEALED records cannot bypass the new dedicated pending-appeal authority.

Same-day late arrival remains accepted B4 Start behavior, even after the scheduled time. B9 appeal eligibility begins only on a later Manila calendar date, never from browser-local time. Duplicate filing/approval/rejection/cancellation/reschedule requests reread and reject after the winner commits.

## Deterministic discovery and no-retake boundary

`GET /exam/status` orders by creation time and ID, skips CANCELLED/RESCHEDULED history, returns the exact current `applicationId`, original appointment, status, server-owned `canAppealMissedExam`, booking flag and bounded request context. Execution discovery excludes released history; multiple blocking execution candidates retain staff-review containment. Applicant profile progression uses the validated effective pass helper.

Blocking statuses are **PENDING, APPROVED, TAKEN, PASSED, FAILED, APPEALED, MISSED, DISQUALIFIED**. Only explicit CANCELLED/RESCHEDULED history is nonblocking. Computed FAILED and rejected-appeal MISSED cannot self-book or receive ordinary Admin assignment. Reconsideration leaves FAILED in place, so it also remains booking-blocking. There is no automatic second exam, retry counter, reset, retake window or ExamPeriod subsystem.

## Separate institutional reconsideration

Under the exact application lock, the repository rechecks current active ADMIN, rereads application/score/decision, requires `validatedResultBasis()` and matching B8 computed FAILED, rejects any prior decision, and creates one `ExamResultDecision` plus AuditLog in one transaction. The decision time cannot precede scoring time. Concurrent Admins serialize; the loser cannot overwrite or create a second decision. There is no update/delete/revoke route.

PASSED, pending/taken, APPEALED, legacy FAILED, partial/corrupt B8 and inactive/unauthorized actors are ineligible. Client score/status/threshold/basis/time/actor fields are rejected.

Reconsideration changes **none** of the original application FAILED status, score FAILED status, answers, MCQ/essay/total, threshold, scoring basis, `scoredAt`, content binding or finalization receipt. Publication separately validates decision type, exact application/score links, reason, actor/time and complete B8 failure evidence.

Applicant result keeps original B8 `status: failed` and breakdown, adding `computedStatus: failed`, `effectiveStatus: passed_reconsidered`, and a bounded institutional decision/date. Internal Admin justification is absent. Admin Exam Record exposes the original computed FAILED, separate **PASSED — RECONSIDERED**, reason, deciding Admin and actual time. Exam Records list/filter presentation uses a separate validated reconsidered flag and does not rewrite persisted FAILED.

## Downstream authority and email

- **COR:** both the preliminary pass check and the inner verify-and-promote transaction accept an ordinary recorded PASSED or a fully validated reconsidered B8 failure. Existing COR identity, current upload, confirmation and promotion safeguards remain. Corrupt decisions cannot grant admission.
- **Admin Applicants:** one validated decision-ID set drives list filtering, counts and row `hasPassedExam`/Admission Stage. Detail uses the same effective-pass validation. An aligned reconsidered Applicant reaches COR stage while raw exam status remains FAILED. Applicant profile progression also reaches the existing COR step without exposing justification.
- **Email:** generic B8 result email rejects once any institutional decision exists, before the already-queued shortcut. Existing queued timestamp, template key and deterministic retained BullMQ identity are untouched. No new email template, revocation or email-worker redesign was introduced. The earlier FAILED notification remains truthful evidence of its original computed outcome.
- **Audit:** filing, approval, rejection, direct cancellation, direct reschedule and reconsideration record actor, exact application, reason and bounded old/new authority in the same transaction. No full answer content is copied to audit. Injected failures after actual writes prove rollback of audit and domain/capacity changes together.

## Existing UI surfaces

No sidebar or separate management workspace was added. Applicant Examination uses the server status flag for **Appeal Missed Exam**, exact original appointment and reason confirmation, then **Missed Exam Appeal Pending**; Applicants choose no target. Same-day states keep existing Start. MISSED has no retry booking action. Active examination, draft/timer and final receipt flows remain owned by B4–B6.

The individual Admin Exam Record owns future-slot selection and required reason/confirmation for approve, reject, reschedule and cancellation. Started/finalized records have no appointment actions. History shows request/date/release/decision and links old/replacement records. Eligible B8 FAILED exposes **Reconsider Result** with score-preservation confirmation; committed decision becomes read-only. Generic result email is hidden after reconsideration. Applicant Results shows separate effective pass, unchanged original ResultBreakdown and available COR next steps. New Missed/Rescheduled/Cancelled states use truthful labels.

Dialogs retain reasons after errors, guard duplicate clicks synchronously, disable in-flight submission and refresh exact record/list and directly affected query caches after settlement. Existing primitives, wall-clock helpers and state-aware record composition are reused.

## Verification evidence

Related suites were broadened because B9 changes schema, scheduling locks/capacity, result authority and COR/Applicant consumers. This is **not** a repository-wide or B10 acceptance claim.

| Evidence class | Executed result |
| --- | --- |
| Related unit/HTTP/controlled React contracts | **76 files / 1,413 tests PASS**, including new B9 actual route/auth/body tests, new B9 UI handler/state contracts and affected B0–B8, COR lifecycle and Admin Applicant tests. Final run used `--maxWorkers=4`. |
| New B9 contracts, overlapping the total above | **54 tests PASS** across B9 HTTP/UI and Applicant Results contracts; not additive to 1,413. |
| Disposable B9 MariaDB suite | **51 tests PASS**, including migration, real independent connections and observed InnoDB waits. |
| Directly affected B3 disposable MariaDB regression | **18 tests PASS**. Its harness now creates/migrates/drops an isolated database rather than placing fixtures in the configured DB. Earlier FAILED-nonblocking/implicit-appeal expectations are superseded by explicit B9 policy. |
| B8 and B6 disposable MariaDB regressions | **53 tests PASS** across two files: **33 B8 + 20 B6**. |
| Nested regressions inside B6 | B5 **11**, B4 **11**, B0A **5**, B2 **4** PASS; nested coverage, not additional B6 tests or independent new B9 tests. |
| Prisma | Generate and validate PASS. Migration diff generated from schemas, not by mutating the configured DB. |
| Backend | `npm run build` / TypeScript PASS. |
| Frontend | `npx tsc --noEmit`, scoped ESLint over all changed frontend TS/TSX, and `npm run build` PASS. |
| Diff | `git diff --check` and staged diff check PASS. |
| Project-owner manual/browser QA | **DEFERRED / NOT EXECUTED — consolidated Phase B lifecycle/manual acceptance gate.** Automated static rendering/handlers are not browser or visual acceptance. |
| Hosted CI | **NOT EXECUTED / no hosted PASS claimed.** Existing workflow triggers pushes to main and PRs targeting main; this package creates neither. |
| Independent review | **PASS — no blocking issue found. B9 accepted for Phase B progression.** |

One earlier parallel 76-file run hit the existing 5-second timeout in the read-only verified-content package check. That file passed alone (72 verified questions / 108 images), and the final four-worker 76-file run passed all 1,413 tests. Initial B9 synchronous-validation assertion and UI date/encoding expectation failures were corrected before the passing final runs. Existing Vitest configuration, Next middleware deprecation and Node runtime warnings do not change the successful check results; no unrelated framework migration was made.

### Real migration and contention details

The B9 harness migrates the full committed pre-B9 chain into a fresh UUID database, inserts representative future/past PENDING, APPEALED, legacy FAILED, B8 PASSED/FAILED and B5–B8 started/finalized/scored evidence, then deploys the actual B9 migration. Every old column, appointment, status, counter, answer, receipt, evaluation and scoring basis is preserved. New seat markers are null and both new tables empty. Migration status and repeat deploy confirm no pending migrations. Restrictive relations preserve existing identities.

Independent MariaDB connections observed actual lock waits for both start/cancel orders, same-day Start versus appeal, prior-date appeal versus Start, replacement versus self-booking, two Admin approvals, sorted two-slot changes, competing Students for the last replacement seat and two reconsiderations. Assertions check winner/loser outcomes, no double release/replacement/decision, exact counters and preserved history. Failure injection rolls back reservation, new application, old state, amendment/decision and audit together.

The suite verifies reason/ownership, every partial execution/finalization field, answer/score-bearing legacy records, previous authorization-only eligibility, all invalid target cases, no-retake blocks, separate public/Admin results and Applicant progression, real COR promotion, Admin list/filter/count/detail, corrupt decision gates and preserved queued original-email metadata. Test cleanup drops only the exact generated databases, verifies removal and leaves zero synthetic records. The protected configured-data SHA-256 snapshot before/after B9, B8 and B6 was:

`fcd68cb79d09c7c5b81bb3acb0bf8f4ddea145ca5d58054550532b001311465f`

B3 uses a separately defined wider protected-table projection and also verified its unchanged configured snapshot. These are integrity checks, not a claim that Codex applied B9 to the development DB.

**Owner-reported configured dev DB deployment, 2026-11-05:** after pulling the accepted B9 branch, the project owner ran `npx prisma migrate deploy` against local MySQL `graduate_system`. Prisma applied `20261105010000_exam_amendments_reconsideration` and reported **All migrations have been successfully applied**. This is owner-reported runtime evidence, not an independently inspected database state. The Prisma 8 upgrade notice is informational and outside B10 scope.

## Remaining boundary

Independent source review is complete and B9 is accepted for Phase B progression. The project owner reports the B9 migration is now applied on the configured development DB; the consolidated manual/browser lifecycle walkthrough remains pending as the B10 acceptance gate. That walkthrough includes same-day Start, prior-date appeals/reasons, approval/rejection, old/new history and released capacity, direct amendments, started-attempt protection, FAILED/MISSED booking blocks, separate reconsidered display, immutable scores, COR/Applicant stage and result-email behavior, plus mobile/keyboard/dialog checks.

B10 regression/acceptance is now authorized as the final Phase B gate. B10 must not introduce generic retakes/resets, Program Chair/Faculty authority, revoke/regrade or notification-template expansion. Phase B is not complete or production-ready until B10 automated evidence, independent review and explicit project-owner manual/browser acceptance are recorded.

## Exact changed files and commits

The inventory below covers the implementation plus this package's four documentation files. Paths are repository-relative. No canonical content, assets, B5–B8 migration, workflow or dependency manifest changed.

- `backend/prisma/migrations/20261105010000_exam_amendments_reconsideration/migration.sql`
- `backend/prisma/schema.prisma`
- `backend/src/controllers/exam-amendment.controller.ts`
- `backend/src/interfaces/exam.interfaces.ts`
- `backend/src/repositories/admin-applicant.repository.ts`
- `backend/src/repositories/applicant.repository.ts`
- `backend/src/repositories/cor.repository.ts`
- `backend/src/repositories/exam-amendment.repository.ts`
- `backend/src/repositories/exam-execution.repository.ts`
- `backend/src/repositories/exam.repository.ts`
- `backend/src/routes/exam.routes.ts`
- `backend/src/services/admin-applicant-list.rules.ts`
- `backend/src/services/admin-applicant.service.ts`
- `backend/src/services/applicant.service.ts`
- `backend/src/services/exam-amendment.rules.ts`
- `backend/src/services/exam-effective-result.rules.ts`
- `backend/src/services/exam-schedule.rules.ts`
- `backend/src/services/exam.service.ts`
- `backend/tests/fixtures/exam-execution.ts`
- `backend/tests/integration/exam-amendments-reconsideration-contention.test.ts`
- `backend/tests/integration/exam-booking-contention.test.ts`
- `backend/tests/unit/repositories/admin-applicant.repository.test.ts`
- `backend/tests/unit/repositories/cor.repository.lifecycle.test.ts`
- `backend/tests/unit/repositories/exam-result.repository.test.ts`
- `backend/tests/unit/routes/exam-amendment.routes.test.ts`
- `backend/tests/unit/services/applicant-results.contract.test.ts`
- `backend/tests/unit/services/exam-b9-ui.contract.test.ts`
- `backend/tests/unit/services/exam-essay-evaluation-ui.contract.test.ts`
- `backend/tests/unit/services/exam-execution-ui.contract.test.ts`
- `backend/tests/unit/services/exam-schedule.service.test.ts`
- `docs/superpowers/GSIS_IMPLEMENTATION_CHECKLIST.md`
- `docs/superpowers/plans/2026-11-01-exam-engine-scheduling-phase-b.md`
- `docs/superpowers/reports/2026-11-05-exam-b9-amendments-reconsideration.md`
- `docs/superpowers/ui-ux/UI_UX_AUDIT.md`
- `frontend/src/app/(portal)/admin/exam/applications/[id]/page.tsx`
- `frontend/src/app/(portal)/admin/exam/applications/page.tsx`
- `frontend/src/app/(portal)/admin/exam/slots/page.tsx`
- `frontend/src/app/(portal)/applicant/exam/page.tsx`
- `frontend/src/app/(portal)/applicant/results/page.tsx`
- `frontend/src/app/(portal)/applicant/schedule/page.tsx`
- `frontend/src/components/admin/exam/exam-record-actions.tsx`
- `frontend/src/components/exam-content/applicant-appointment-gate.tsx`
- `frontend/src/components/exam-content/result-breakdown.tsx`
- `frontend/src/lib/exam-record-state.ts`
- `frontend/src/types/index.ts`

Implementation commit: `1b9270ea528beefcd3ce8efb89eb65db5311fd0c`. Documentation follows in a normal descendant commit; final delivery identifies the live pushed HEAD.
