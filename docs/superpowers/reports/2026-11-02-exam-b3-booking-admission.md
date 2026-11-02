# EXAM-B3 — Canonical schedule time and atomic booking admission

Date: 2026-11-02 (Asia/Manila).

**EXAM-B3 ACCEPTED FOR PHASE B PROGRESSION — 2026-11-02**. Independent remote source review: **PASS — no blocking issue found**. Project-owner manual/browser QA: **DEFERRED / NOT EXECUTED**, not reported as PASS.

## Verified starting state and authorities

Existing shared branch: `feat/exam-engine-scheduling`; working tree clean.
Local HEAD, origin tracking HEAD and live remote branch all matched
`d094b92d92a3c69367ef707c0a3673516ae00ec1`,
`docs(exam): close B2 review checkpoint`. Local/tracking/live main matched
`a6dc6f57c6e8130482c814e90703765972fddaa9`: 16 ahead, 0 behind. No unexpected
commits. No reset, rebase, history rewrite, branch recreation, old audit-branch
work, unrelated merge or main mutation. The owner request authorized B3 only,
including normal commit/push; delivery reports the final hashes after push.

Read checklist §7.2, Phase B plan/common protections/B3, audit §5/B-03/B-06/
concurrency/status-selection findings, accepted B0A/B0B/B1/B2 reports, examination
content source of truth, verification policy and UI/UX playbook/audit, particularly
accepted UIUX-2H. Traced actual JWT/role middleware, routes, controllers, services,
repository, MariaDB adapter contract, Student/Program/Slot/Application models,
Admin create/edit/status callers and Applicant availability/booking/display.
Applied the installed Next.js skill to the bounded Applicant change.

## Confirmed baseline defects

Read-only, in-memory execution of the exact starting service source reproduced
booking an inactive, past, foreign-Program slot for a Student with unsupported
alignment: the old path incremented capacity and created PENDING with the
Student Program even though the slot belonged to another Program. This is
baseline algorithm evidence, not a historical database mutation or live race test.

The old date-only comparison excluded `2026-11-15T00:00Z` when now was
`2026-11-15T02:00Z` (10AM Manila), despite a 4PM schedule still being future.
Browser-local formatting in Manila rendered the stored `1970-01-01T16:00Z`
time as midnight instead of the intended 4PM. Source inspection also confirmed
unlocked same-Student/capacity reads, unconditional increment, incomplete
request validation, and no backend booked-field/capacity-minimum guard.
Baseline unsafe concurrency was not exercised against historical records.

## Existing local data preflight

Before implementation, a read-only local transaction compared every slot counter
against **all** assigned application rows, independent of status:

| Slot ID | Stored slotsTaken | Actual applications |
| --- | --- | --- |
| `164a22df-9bda-40f7-b508-5f8c97e5617a` | 0 | 0 |
| `5d075d43-a594-4ddd-8f53-f57fa3ebaa28` | 0 | 0 |
| `657e6459-9c79-4623-828d-c9cdc649b647` | 1 | 1 |
| `726bf8fe-3f0a-4edc-99cd-db29443a60a8` | 1 | 1 |
| `b75c941a-def6-4953-ad50-0d7641dda56a` | 0 | 0 |
| `c098b8a2-d41c-4758-923e-9a690c573a37` | 0 | 0 |
| `c6cdc6eb-75e4-4426-8ac6-292a34b66ecd` | 0 | 0 |
| `c84a8fee-70a5-40c3-8cf5-9e87c5d3d0be` | 1 | 1 |
| `f8568994-d448-460a-a996-01c1817a5adb` | 0 | 0 |

**9 checked; zero drift; zero Students with multiple currently blocking
applications.** A later read-only check found all nine stored wall clocks
structurally interpretable and the same counter/count pairs. This cannot prove
the original human intention of legacy values; no offset correction was inferred.
No historical data, counters, application statuses or schedule times were repaired.

## Time and request contracts

`exam-schedule-time.ts` is the single backend schedule-time authority. It strictly
accepts `YYYY-MM-DD` in the existing database date range (1000–9999), rejecting
impossible dates by round-trip validation, and the accepted UIUX-2H time payload
`1970-01-01THH:mm:00.000Z`. Malformed, offset-bearing, non-minute and arbitrary
instant inputs are rejected. UTC components continue to carry the typed wall clock
to MariaDB DATE/TIME storage, without local constructors or local ISO round trips.

For comparisons, native `Intl.DateTimeFormat` explicitly names `Asia/Manila`,
Gregorian calendar, Latin digits and `h23`. Starting from the combined wall-clock
components, a bounded correction loop uses the actual IANA-zone projection to
derive the instant, then verifies the projected components exactly. There is no
hard-coded eight-hour offset, timezone environment dependency or new dependency.
For example, November 15, 2026 at 4PM becomes `2026-11-15T08:00:00.000Z` for
comparison while the stored/displayed wall clock stays 4PM. Midnight correctly
crosses the UTC date. Unsupported legacy storage fails closed with owner-review
guidance, never a fabricated corrected schedule.

The combined instant must be strictly greater than actual now. At 10AM Manila,
today 4PM is available, today 9AM is past, tomorrow 9AM is future; exact start
is no longer future for admission. Booking rechecks time immediately before
reservation after its potentially waiting reads. These checks authorize booking
only and implement no actual exam-start/grace/deadline policy.

Full create/update bodies accept exactly Program/date/time/capacity. Program and
slot IDs are bounded UUIDs; Program must exist. Capacity must be a positive
integer within signed database INT range; strings, fractions, zero, negative,
NaN/Infinity and oversized numbers reject. No default capacity or schedule-time
uniqueness rule. Client `slotsTaken`, `isActive` in full updates, Student IDs,
or other unsupported authority fields reject. Booking body is exactly `{slotId}`;
status body is exactly a real boolean `{isActive}`. Expected errors retain bounded
400/403/404/409 responses; unexpected scheduling failures return generic 500.

## Availability and atomic admission

JWT user → exact Student supplies identity and Program. Missing Student rejects;
only ALIGNED/CLEARED admit (including explicit rejection of null/unknown alignment).
Optional legacy query `programId` is checked against the Student Program; it never
authorizes another Program. The query reads active slots of the exact Program,
with assignment count in the same slot projection, ordered by date/time/ID.
Combined start filtering retains same-day future schedules. Full, invalid,
inconsistent, inactive, foreign or past slots are excluded. Invalid/drifting rows
are logged by exact slot ID/counts with owner-review guidance. No count is repaired.

Booking uses one interactive transaction:

1. Parameterized `SELECT student_id ... WHERE user_id = ? FOR UPDATE` locks the
   exact Student through its unique authenticated-user identity; reread eligibility.
2. Parameterized exact-slot `SELECT slot_id ... FOR UPDATE`; reread Program,
   active flag and combined future start.
3. Count all assigned applications and compare to `slotsTaken`; require valid
   capacity and a remaining seat. Read current Student applications after locks.
4. Reject existing **PENDING, APPROVED, TAKEN, PASSED, APPEALED, DISQUALIFIED**.
   **FAILED stays nonblocking**, preserving the transitional behavior.
5. Recheck time; conditional `updateMany` requires the locked counter/max/active
   values and `slotsTaken < maxSlots`. Exactly one affected row reserves a seat.
6. Create PENDING with exact Student/Program/Slot and copied wall-clock date/time;
   commit both writes together or roll both back.

Explicit **READ COMMITTED** isolation makes ordinary reads after a lock wait see
committed state even on the tested MariaDB default **REPEATABLE READ** host.
No pre-lock Student/application snapshot authorizes admission. All booking paths
share the Student → Slot order. Different Students serialize on the same slot;
the same Student serializes even when selecting different slots. No hidden retry,
application approval gate, seat decrement or period/attempt model is added.

## Admin mutations, UI and appeal boundary

Admin update and status PATCH take the same exact slot lock. They reread actual
assignments and fail closed for counter corruption. Admission/status mutations
require valid stored capacity; full Admin edits validate the replacement capacity
and may correct an invalid old maximum without touching the consistent counter. Once booked,
Program/date/time cannot change and capacity cannot fall below actual assignments.
Unassigned fields can change only with valid Program/future date/time/capacity.
Past/unsupported schedules cannot close/reopen; full updates cannot change the
booking flag. Close/Reopen changes only `isActive`; existing applications and
seat consumption persist, and booked Applicants retain their confirmed schedule.

Admin page source is unchanged: PageHeader/Create, filters, five-column table,
dominant Edit, shared dialog, confirmations, booked-field locks, inline errors
and loading/empty/retry behavior remain. The shared helper now projects **current
Manila** wall-clock components instead of browser-local now; at/past-start
classification matches admission. Past → Closed → Full → Open precedence,
wall-clock display and payload serialization remain intact. The Applicant page
reuses these pure helpers for confirmed/available/confirmation display and past
checks; no page redesign or separate JSX timezone logic.

Concrete appeal race: old missed-exam appeal could read PENDING outside its
transaction, wait while submission/grading makes that application FAILED and a
new booking commits, then unconditionally restore the old APPEALED blocking state.
Minimal integration now shares the Student lock, reads PENDING transactionally,
and conditionally updates **only still-PENDING** applications. A changed state
rejects. Approval still maps APPEALED → FAILED and rejection → DISQUALIFIED;
neither releases seats. Existing appeal time semantics remain unchanged and
deferred to B9, as do reconsideration/reschedule outcomes and broader lifecycle
coordination. No appeal policy was invented.

## Verification and reproducible commands

Final unit/component/HTTP run: **42 files / 814 tests PASS**, zero failures/skips.
This is **131 B3 tests** plus **683 related regressions**, selected within the
examination domain; the entire repository suite was not run.

```powershell
# From backend; scoped selection of affected examination tests.
$testFiles = rg --files tests/unit | Where-Object {
  $_ -match '[\\/](exam-(answer|result|configuration|question-set|engine|media|content|emphasis|record|schedule)|applicant-(exam-content|results)|admin-exam-editor)'
}
npm test -- $testFiles

# Run separately/sequentially: their source snapshots must not overlap fixtures.
$env:EXAM_B3_DB_TEST = '1'
npm test -- tests/integration/exam-booking-contention.test.ts --reporter=verbose
$env:EXAM_B0A_DB_TEST = '1'
npm test -- tests/integration/exam-answer-contention.test.ts
$env:EXAM_B2_DB_TEST = '1'
npm test -- tests/integration/exam-question-set.test.ts
npm run build
```

B3 real database: **10 tests PASS** on localhost MariaDB **10.4.32**, InnoDB,
default REPEATABLE-READ. Service/repository operations execute through real Prisma
clients and independent transaction connections. The harness intentionally makes
an ordinary read before the lock to expose a stale-snapshot strategy. It checks
different connection IDs, observes the waiting `FOR UPDATE` via `SHOW FULL
PROCESSLIST`, verifies it stays blocked, and only then releases the first worker.
Final verified contention run observed slot connections **159 / 160**, Student
connections **162 / 163**, and booking/edit slot connections **162 / 166**.

- Last seat: one successful booking, one bounded 409 full-capacity conflict;
  stored/actual count 2 with maximum 2 (one preexisting synthetic seat).
- Same Student/different slots: one successful PENDING, one 409 blocking-status
  conflict; one application and slot counters `[0,0,1]`.
- Rollback: observe the real increment inside the transaction, actually insert
  the application, inject a failure; observer sees counter 0 and no application.
- Real booked Program/date/time edits and below-booked capacity reject; valid
  capacity-only increase succeeds. An Admin edit waiting behind booking sees the
  newly committed assignment and rejects an identity change.
- Closing retains assignments/access; reopening admits another eligible booking.
- Actual Admin create preserves DATE/TIME 16:00; a same-day future 23:59 slot
  is returned and booked with copied date/time. The fixture has a documented
  next-day fallback only in the last minute of a Manila day.
- Synthetic drift rejects all mutations and excludes availability without repair;
  FAILED/APPEALED behavior is preserved. A delayed appeal cannot resurrect FAILED.

Fixtures are fresh UUID-scoped Program/User/Student/Slot/Application records.
Cleanup asserts zero remaining synthetic records. SHA-256 snapshots compare
all preexisting schedules/applications plus Question/Option/Media/Import/Answer
rows before/after and are identical. No canonical Question Bank writes.

Accepted regressions: **B0A 5 real-DB contention tests PASS**, **B2 4 real-DB
migration/integrity tests PASS**. B2 rehearses its existing migration only inside
its own disposable local database; B3 creates/applies no migration. Unit coverage
also preserves B0A submission/autosave, B0B finality/email, B1 draft configuration,
B2 immutable selection/key/media/history, and accepted authoring/rendering behavior.

Time tests execute conversion and frontend helper behavior in fresh subprocesses
with `TZ=UTC`, `Asia/Manila`, and `America/Los_Angeles`. Midnight, leap dates,
year rollover, same-day past/future, exact boundary and malformed inputs are
covered. Actual Applicant JSX is transpiled/static-rendered with controlled
query/hooks; tests verify exact booked labels, self-booking request and refresh,
plus accepted Admin helper/filter/precedence/capacity/serialization contracts.
These tests are separate from browser/manual QA. Initial route-test syntax and
test-only Link stub errors were fixed; final checks pass. Final backend compilation
also exposed nullable alignment; the allowlist now explicitly handles null safely
with additional booking/availability regressions.

From `frontend`:

```powershell
npx tsc --noEmit
npx eslint 'src/lib/admin-exam-schedules.ts' 'src/app/(portal)/applicant/schedule/page.tsx'
node scripts/verify-exam-content-6-ui-follow-up.mjs
```

Frontend TypeScript/scoped ESLint: **PASS**. Existing Question Bank verifier:
**11/11 PASS**. Production frontend build: **NOT RUN**; no route, component/API
wiring, framework or dependency change warrants it. Backend build/typecheck:
**PASS**. `git diff --check`: **PASS**. Existing Vite config advisory is informational.
Hosted CI: **NOT EXECUTED / no hosted PASS claimed**; current workflow triggers
main pushes or PRs targeting main, not this feature-branch-only push. No PR,
workflow modification, deployment or main merge is part of B3.

**Manual/browser QA: DEFERRED / NOT EXECUTED — project-owner decision.** The owner
accepted B3 for Phase B progression based on completed automated, real-database and
independent-review evidence, while reserving browser/manual lifecycle QA for the
consolidated Phase B gate. This is an explicit deferral, not a manual QA PASS.
Later owner QA should cover Admin create → exact Applicant Manila display → eligible
selection, foreign Program denial, same-day future/full handling, booked-field/minimum
guards, Close preventing selection while retaining access, and future Reopen.

## Exact changed files and remaining boundaries

```text
backend/src/controllers/exam.controller.ts
backend/src/repositories/exam.repository.ts
backend/src/services/exam.service.ts
backend/src/services/exam-schedule-time.ts
backend/src/services/exam-schedule.rules.ts
backend/tests/integration/exam-booking-contention.test.ts
backend/tests/unit/routes/exam-schedule.routes.test.ts
backend/tests/unit/services/exam-schedule-time.test.ts
backend/tests/unit/services/exam-schedule-ui.contract.test.ts
backend/tests/unit/services/exam-schedule.service.test.ts
frontend/src/app/(portal)/applicant/schedule/page.tsx
frontend/src/lib/admin-exam-schedules.ts
docs/superpowers/GSIS_IMPLEMENTATION_CHECKLIST.md
docs/superpowers/plans/2026-11-01-exam-engine-scheduling-phase-b.md
docs/superpowers/reports/2026-11-02-exam-b3-booking-admission.md
```

Schema/migration/dependencies: **UNCHANGED; no B3 migration**. No changes to
content/source fidelity, private media, B1 runtime configuration consumers, B2
attempt binding, actual exam start/late-entry/grace, duration/timers/deadlines,
autosave/finalization/scoring, appeal outcomes, cancellation/reassignment or seat-release rules.
Historical audit reports remain unchanged. Only the checklist, plan and this new
report are documentation changes.

**PD-1 unresolved:** scheduled versus actual authorized start, late entry/grace,
full-duration versus scheduled deadline, timeout behavior. Existing 60-second/
three-hour behavior elsewhere remains legacy, not newly approved policy.
**PD-5 unresolved:** examination-period identity/reset, retakes/rescheduling,
appeal interaction and seat-consumption/release. No ExamPeriod/periodId, academic
year/semester assumption, one-attempt-per-period constraint or automatic reset.
The guarantee is at most one currently blocking application **winning concurrent
booking admission** for the same Student under the unchanged status contract.
Existing latest/status selection disagreements and broader grading/appeal lifecycle
coordination remain later-package concerns, not a new institutional attempt policy.

The real tests establish the local tested flow, not deployment-engine evidence or
protection against direct out-of-band database writers. Syntactically valid legacy
times retain their stored meaning; original human intent is not reconstructed.
## Independent review and owner checkpoint

- Reviewed remote implementation commit: `f7cd211149cd5edf0d2feee9bbd97e70707c3947`.
- The B3 implementation is exactly one commit on top of accepted B2 documentation
  checkpoint `d094b92d92a3c69367ef707c0a3673516ae00ec1`; the shared Phase B branch
  was 17 commits ahead of `main` and zero behind at review.
- Independent remote source review: **PASS — no blocking issue found** across
  Asia/Manila wall-clock conversion, strict scheduling validation, authenticated
  Student/Program/alignment authority, Student → Slot row locking, READ COMMITTED
  rereads, last-seat conditional reservation, rollback, counter reconciliation,
  booked-slot mutation guards, Close/Reopen semantics, Applicant display, accepted
  UIUX-2H boundaries, appeal race containment, focused tests and B3 scope.
- Project-owner decision on 2026-11-02: **ACCEPTED FOR PHASE B PROGRESSION**.
- Manual/browser QA: **DEFERRED / NOT EXECUTED** by project-owner decision; it remains
  future evidence and must never be reported as passed unless actually performed.
- Hosted CI remains **NOT EXECUTED / no hosted PASS claimed** for this branch-only
  checkpoint.
- PD-1 and PD-5 remain unresolved exactly as listed above. B4 and all later packages
  remain separately authorized work; acceptance of B3 does not authorize automatic
  continuation.

Next action, when separately authorized by the owner, is the bounded EXAM-B4 package.
Phase B remains incomplete and is not production-ready.
