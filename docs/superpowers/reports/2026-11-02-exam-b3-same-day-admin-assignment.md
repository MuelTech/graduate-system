# EXAM-B3 Follow-up — Admin Same-Day Schedule Assignment

Date: 2026-11-02 (Asia/Manila).

**IMPLEMENTED / PUSHED — INDEPENDENT REVIEW AND PROJECT-OWNER ACCEPTANCE PENDING**.
Not ACCEPTED; not an Approved Reference Implementation; B4 remains unauthorized.

## Starting state and scope

- Existing branch: `feat/exam-engine-scheduling`.
- Local HEAD, origin tracking HEAD and live feature HEAD all matched
  `7135ec3d8b851c66f908b737d62fcec5c1599e28`; clean worktree; tracking ahead/behind 0/0.
- Local/tracking/live main matched `a6dc6f57c6e8130482c814e90703765972fddaa9`;
  feature was 25 ahead / 0 behind main. Live refs were rechecked before delivery.
- No branch creation, reset, rebase, force push, history rewrite, PR or main mutation.
- Current checklist, Phase B plan/audit, B3 report, owner admission clarifications,
  verification policy, content authority and UI/UX playbook/audit informed the work.
  Actual Applicant registry/profile, Exam Records, self-booking, middleware,
  time helpers, transactions and shared UI/query patterns were traced.

## Implemented authority

`GET /api/exam/assignment-options/:studentId` and `POST /api/exam/assignments`
both require existing JWT authentication plus exact ADMIN role middleware.
Applicant self-booking remains on its existing APPLICANT-only route.

The assignment body accepts exactly `{ studentId, slotId }`, both bounded UUIDs.
No Program, counter, capacity, time-bypass or account-provisioning input is accepted.
The mutation resolves the exact selected Student after a parameterized row lock;
it requires APPLICANT admission state, APPLICANT account role, a nonblank existing
Pinnacle Applicant ID, and ALIGNED or CLEARED alignment. Program comes from that
Student, never from the client. No external Pinnacle lookup or new credentials.

All currently blocking B3 statuses remain blocking: PENDING, APPROVED, TAKEN,
PASSED, APPEALED, DISQUALIFIED. Any blocking row rejects, including an older row
behind a newer FAILED. FAILED remains nonblocking under the accepted transitional
contract; no period, reset or retake policy is inferred.

The locked slot must exist, match the exact Student Program, be active, have
structurally valid DATE/TIME storage, and belong to today's Asia/Manila calendar
date. Earlier, exact-current and future wall clocks on that date are allowed for
Admin assignment only. A different date rejects, including future dates.
The slot's original date/time and active state are never rewritten by assignment.

Actual assigned application rows (all statuses) must equal slotsTaken; capacity
must be valid and have a remaining seat. Drift, invalid storage, closed/full/
foreign/cross-date slots fail closed without repair or override. Expected
validation/conflict/not-found errors retain bounded 400/409/404 responses;
unauthenticated/forbidden roles receive existing 401/403 middleware responses.
Unexpected scheduling errors are generic 500 responses. Admin domain rejection
uses 409 so the existing API client's 403 authentication handling does not log
the Admin out for a failed eligibility safeguard.

The options read locks/rereads the selected Student, supplies a bounded identity/
Program/alignment/eligibility/reason DTO, and queries active exact-Program slots
for today's stored date in the same READ COMMITTED transaction. It verifies time,
actual counts and remaining seats before projecting original schedule/capacity.
It does not reserve seats. Mutation independently repeats all checks.

## Transaction and concurrency

Both operations call the same private B3 admission implementation. Self-booking
still uses JWT user → Student and strictly future combined Manila start; no public
or client-controlled bypass flag was introduced.

Assignment uses Student → Slot row locks, READ COMMITTED current-state rereads,
post-lock application/count checks, and a final same-day recheck immediately
before reservation (including midnight rollover). Conditional reservation still
requires exact locked counter/maximum/active values and counter < maximum. Creating
PENDING with copied Student/Program/slot/date/time commits with the increment;
failure rolls both writes back. Existing booking/edit/status/appeal behavior is
preserved. Admin and Applicant admission contend on the same physical Student row.

## Admin interaction

One **Assign Applicant** primary action belongs to the existing Entrance Exam
Records PageHeader. The shared Dialog handles registered Applicant search via the
accepted paginated `/admin/applicants` API; there is no duplicate directory.
Selection loads the exact Applicant's server options and displays identity,
Pinnacle ID, email, Program, alignment and assignment eligibility. Admin selects
only a returned same-day slot, reviews original Manila wall clock plus booked/
maximum/remaining seats, then confirms. It explicitly states the original schedule
remains unchanged. No Applicant Profile mutation or new sidebar destination.

Mutation disables confirmation/back/cancel and dismissal while pending, with a
synchronous ref guard against duplicate clicks before rerender and retries off.
Rejection retains the bounded server reason, exits review, clears selected slot
and refetches authority; no override is exposed. Success invalidates Exam Records,
Applicant registry and assignment-options caches, resets list filters/page to show
the new record, closes/unmounts the form and shows the existing Sonner feedback.

Table columns, row View, search/filter controls, pagination and existing list
loading/error/empty markup are unchanged (the page diff is one import and one
PageHeader actions prop). Shared Dialog title/description/focus handling, labeled
search, native radio fieldset/legend, responsive layout and bounded scrolling are
retained. Runtime focus/mobile/visual acceptance remains owner QA.

## Verification

Focused automated run: **12 files / 232 tests PASS**, no skips/failures:

```powershell
# backend
npm test -- tests/unit/services/exam-assignment-ui.contract.test.ts tests/unit/services/exam-schedule.service.test.ts tests/unit/services/exam-schedule-time.test.ts tests/unit/routes/exam-schedule.routes.test.ts tests/unit/routes/exam-record.routes.test.ts tests/unit/services/exam-schedule-ui.contract.test.ts tests/unit/services/admin-applicant-list.rules.test.ts tests/unit/repositories/admin-applicant.repository.test.ts tests/unit/services/admin-applicant-detail.service.test.ts tests/unit/repositories/admin-applicant-detail.repository.test.ts tests/unit/services/exam-record-detail.service.test.ts tests/unit/repositories/exam-record.repository.test.ts
$env:EXAM_B3_DB_TEST = '1'
npm test -- tests/integration/exam-booking-contention.test.ts --reporter=verbose
npm run build
# frontend
npx tsc --noEmit
npx eslint 'src/components/admin/exam/assign-applicant-dialog.tsx' 'src/app/(portal)/admin/exam/applications/page.tsx'
npm run build
# repository root
git diff --check
```

Tests cover actual JWT/role HTTP boundaries (including CUSTOM denial), malformed/
unsupported payloads, exact selected identity, future/current/past same-day time,
ordinary self-booking past rejection, cross-date, closed/full/foreign/invalid
slots, eligibility and every blocking status, FAILED compatibility, count drift,
lost conditional reservation, missing records and midnight recheck. Existing
timezone tests run fresh UTC/Manila/Los Angeles processes. **11 new UI checks**
execute transpiled components with controlled hooks/query results and static
rendering: action/dialog, registered selection, identity/Program, eligible slots,
original schedule/capacity, review, duplicate/pending, rejection/refresh, success
invalidation, and existing table/filter/View behavior. These are not browser QA.

Real database: **16/16 PASS** on local MariaDB **10.4.32**, InnoDB, host default
REPEATABLE-READ. Reused accepted UUID fixture/snapshot/independent-connection
harness; six new checks plus ten original B3 regressions. Final run observed
Student lock wait **340 / 336**, final-seat Slot wait **343 / 338**, and mixed
Admin/self-booking Student wait **346 / 341**. Harness waits for actual process-list
FOR UPDATE contention before releasing the first transaction. Only one assignment
wins for one Student; final seat reaches exact maximum without overbooking.
Real insert failure rolls back both writes; past-time Admin assignment succeeds
with original appointment unchanged; real drift rejects without repair.

Cleanup asserted zero synthetic Program/User/Student/Slot/Application records.
SHA-256 snapshots of preexisting schedule/application and Question/Option/Media/
Import/Answer rows matched before/after. No canonical bank mutation. One final
rerun invocation ended with Windows host exit `-1073741819` before npm output;
retry with shell profile disabled completed all 16 checks and cleanup successfully.

Backend build/typecheck: **PASS**. Frontend TypeScript and scoped ESLint: **PASS**.
Production frontend build: **PASS** (68 pages); run deliberately for new component/
API/type wiring. Existing middleware/Node deprecation notices are nonblocking.
`git diff --check`: **PASS**. Initial local lint findings were corrected; final
checks pass. No whole-repository suite was run; directly affected regressions
cover shared B3 admission and reused read models.

**Project-owner manual/browser QA: EXECUTED 2026-11-02 — redundant explicit `Asia/Manila` labels were identified in the Admin assignment dialog. A bounded copy-only follow-up removed the timezone label from the dialog description, same-day schedule legend, and review timestamp; backend `Asia/Manila` scheduling authority is unchanged. Post-fix owner recheck and final acceptance remain pending.**

Hosted CI: **NOT EXECUTED / no hosted PASS claimed**. Existing CI triggers main
pushes and PRs targeting main, not this branch-only push. No workflow change/PR.

## Exact changed files

```text
backend/src/controllers/exam.controller.ts
backend/src/repositories/exam.repository.ts
backend/src/routes/exam.routes.ts
backend/src/services/exam-schedule-time.ts
backend/src/services/exam-schedule.rules.ts
backend/src/services/exam.service.ts
backend/tests/integration/exam-booking-contention.test.ts
backend/tests/unit/routes/exam-schedule.routes.test.ts
backend/tests/unit/services/exam-assignment-ui.contract.test.ts
backend/tests/unit/services/exam-schedule.service.test.ts
frontend/src/app/(portal)/admin/exam/applications/page.tsx
frontend/src/components/admin/exam/assign-applicant-dialog.tsx
docs/superpowers/GSIS_IMPLEMENTATION_CHECKLIST.md
docs/superpowers/plans/2026-11-01-exam-engine-scheduling-phase-b.md
docs/superpowers/ui-ux/UI_UX_AUDIT.md
docs/superpowers/reports/2026-11-02-exam-b3-same-day-admin-assignment.md
```

Schema, migrations, dependencies, accepted content/media/renderers and owner
clarification report: **UNCHANGED**. No B4 start authorization, actor/timestamp,
actual-start/deadline/timer/config/content binding, attempt, autosave, expiry,
scoring, appeal/reschedule, reconsideration or later-package implementation.
An assigned earlier appointment does not itself authorize immediate exam start;
that remains B4. Different-date missed appointments and period/seat-release policy
remain B9/PD-5. Local DB tests establish tested service behavior, not deployed
engine guarantees or protection against direct out-of-band database writers.

Final commit/live remote SHA and clean pushed state are reported in the delivery
message, avoiding a self-referential hash in this report. Stop for independent
review and owner acceptance; do not begin B4.
