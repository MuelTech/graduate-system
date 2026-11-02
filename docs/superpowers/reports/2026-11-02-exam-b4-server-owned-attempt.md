# EXAM-B4 — Server-Owned Attempt and Remaining Time

Requested package date: 2026-11-02. Implementation/verification completed 2026-11-03, Asia/Manila; the requested report filename is retained.

**ACCEPTED FOR PHASE B PROGRESSION — 2026-11-03**. Independent remote source review: **PASS — no blocking issue found**. Project-owner manual/browser QA is **DEFERRED / NOT EXECUTED** by owner decision and will be consolidated into the later Phase B lifecycle/manual acceptance gate.

## Starting state and bounded delivery

Existing branch: `feat/exam-engine-scheduling`. Before changes, local HEAD,
upstream/origin HEAD and live remote feature HEAD all matched
`284c1d921e639edee3f2ac72a58472f0148aeab7`. Live main matched
`a6dc6f57c6e8130482c814e90703765972fddaa9`. Worktree clean;
tracking divergence 0/0; feature 28 ahead / 0 behind main. Live refs were obtained
with `git ls-remote` after the sandbox initially denied SSH networking.

No branch creation, main change, reset, rebase, force push, history rewrite,
PR or merge. Final commit/live remote identity and clean delivery state are
recorded in the delivery message to avoid a self-referential commit hash here.

Authorities: current checklist, Phase B plan/audit, accepted B1/B2/B3 and same-day
assignment reports, owner admission clarification, verification policy, content
source of truth, UI/UX playbook/audit. Actual schema, configuration, revision
publication, engine/answer paths, media, schedule locks and both affected pages
were traced. Next.js and React best-practices skills informed the client work.
Historical accepted content, Q24/Q40, imports/assets/emphasis and renderer
semantics were not reopened.

## Owner clarification during implementation

The owner explicitly selected: **Allow normal start at or after the appointment
on the same date; require authorization for early start.** Thus B4 introduces
no separate late-entry cutoff or grace. Same-day late ADMIN authorization remains
available but is unnecessary once the normal time gate is satisfied. This
clarification supersedes older shorthand that every late arrival requires
authorization. A different-date new start always rejects. An execution already
started may continue across midnight until its own persisted deadline.

## Schema, migration and honest cutover

Migration: `20261103000000_exam_execution_authority`.

Six nullable, additive fields on the existing `EntranceExamApplication`:

- `startAuthorizedById` and `startAuthorizedAt`;
- `actualStartedAt` and `deadlineAt`, with millisecond precision;
- `executionConfiguration` JSON;
- `contentRevisionId`, with a restrictive FK to B2 publication.

Indexed authorization-actor and revision FKs preserve attribution/content.
No child attempt model, period, semester/year identifier, retake/reset rule,
new application status or migration backfill. The application's existing primary
key is the one-execution identity. There is no public authority-field editor.

Migration preserves all old columns. Legacy terminal/incompatible records and
pending records with prior answers/score remain **LEGACY_UNBOUND** when timing
and content were never recorded. They cannot acquire a fabricated current set,
configuration, start or deadline. Partial binding fails closed. Eligible
PENDING/APPROVED records without answers or score may explicitly start after
cutover under all current guards. Opening the old page was never recorded as an
actual start; no such historical event is inferred. No use of createdAt,
appointment, answer timestamps or grading timestamps as invented execution evidence.

**Configured development database at implementation delivery: NOT MIGRATED / untouched.**
The implementation agent correctly left it unchanged and rehearsed the migration only
against disposable local databases. After independent review and B4 acceptance, the
project owner reported successfully running `npx prisma migrate deploy` against the
configured development database on 2026-11-03. This is owner-reported runtime
preparation, not independently verified remote-source evidence. Other environments
must still apply the committed migration before using the new B4 code.

## Exact lifecycle and API authority

The existing application status remains the B0A terminal-write guard. B4 derives
READY, BLOCKED, ACTIVE, EXPIRED, TERMINAL and LEGACY_UNBOUND from persisted
timestamps/binding/status and current server time. EXPIRED is an access state,
not an assertion that answers have been finalized or a timeout receipt exists.

Authenticated APPLICANT contracts, under `/api/exam-engine`:

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/execution` | Initial owned-record discovery; no start/write. Ambiguous blocking records reject. |
| GET | `/applications/:applicationId/execution` | Exact owned state/timing recovery. |
| POST | `/applications/:applicationId/start` | Explicit, idempotent Applicant start. No supplied timing/config fields. |
| GET | `/applications/:applicationId/questions` | Exact active, immutable Applicant-safe content. |
| PATCH | `/applications/:applicationId/autosave` | Existing essay save through exact binding and B0A guards. |
| POST | `/applications/:applicationId/submit` | Existing bounded submission through exact binding and B0A guards. |

ADMIN-only routes:

- `GET /admin/applications/:applicationId/execution`;
- `POST /admin/applications/:applicationId/start-authorization`.

All successful/error engine responses are private/no-store. UUIDs and empty
mutation bodies are validated. JWT ownership is checked before and after locks;
another Applicant's exact record returns 404. Implicit legacy `/questions`,
`/autosave` and `/submit` now return 409 with reload guidance; they cannot select
arbitrary/latest mutable bank content or bypass the new execution.

Start and authorization lock **Student → Slot → Application** and reread under
**READ COMMITTED**, consistent with B3 ordering. Eligibility includes active
Applicant account, Applicant admission, existing Pinnacle ID, ALIGNED/CLEARED,
exact Student/application/slot Program, copied original appointment agreement,
valid active slot, valid status and reconciled booked capacity. Starting an
existing reserved seat does not demand an additional free seat or increment it.
Only today's Manila appointment can acquire a new start/authorization.

ADMIN authorization independently verifies the active ADMIN actor and exact
application. It records actor/time only. Repeated authorization preserves original
attribution. It never starts time, changes a slot, reserves/releases capacity,
or affects another Applicant. Manila date is rechecked immediately before write.
Started, finalized, appealed, disqualified or legacy-with-answers records reject.

The first Applicant Start records server time **after validating binding**, then
sets `deadlineAt = actualStartedAt + examDurationMinutes * 60_000`. The date gate
is rechecked before write, including a wait crossing midnight. Invalid/unconfigured
duration or unsupported deadline arithmetic/storage rejects. No fixed three-hour
value, school-closing cap or schedule-based duration is used. Repeated valid
Start returns the same persisted timestamps/configuration/content.

Booking closure does not revoke an already established execution or extend/change
its deadline. New Start/authorization requires an active valid slot. The accepted
B3 self-booking and same-day assignment code is unchanged; original slot date/time
is never rewritten by B4.

## B1 and B2 binding, content/media and answer protection

The first Start transaction reads the whole validated B1 configuration and freezes
duration, MCQ points, essay maximum, passing threshold, threshold unit and fixed
timezone. Explicit unconfigured scoring nulls remain null. Duration is required
for B4 timing; unresolved B1 scoring policy is not fabricated or newly activated.
B7/B8 own subsequent evaluation/scoring integration and policy gates. Later Admin
replacement cannot change the captured values. No settings history subsystem.

The same transaction selects the latest committed B2 publication ordered by
publication timestamp then ID, validates its nonempty immutable content, and binds
that exact revision FK once. A missing/invalid latest publication fails closed,
without falling back to the mutable bank or an arbitrary older set. All future
question/media/answer operations use the exact bound revision, including its
frozen key, original question/option identities, ordering and private media IDs.
Later publication, deselection, source text/key edits and configuration changes
cannot replace a started execution's content or timing.

Applicant projection preserves accepted renderers/emphasis/structured content
without exposing correctness, answer keys, import/source or storage metadata.
Media requests carry exact application identity, verify owner/active execution/
deadline/revision membership and then use B2's retained media references. Removing
a live bank attachment does not make received private media disappear. Unstarted,
unbound, terminal, expired, foreign-owner and unrelated-media access fails closed.
Existing byte validation, checksums, private storage and confidential headers remain.

B0A's application lock still serializes answer writes/submission. Under that lock,
the repository now checks actual binding/deadline and validates supplied question/
option/type membership against frozen content rather than the mutable bank. The
deadline is rechecked before writes and before TAKEN; transaction failure rolls
back answers/status/score. Duplicate/foreign/contradictory payload containment and
post-submit write rejection remain. Existing one-point MCQ increment and incomplete
submission behavior are retained pending later packages; capturing B1 scoring
values does not claim that B8's final scoring engine exists.

## Frontend behavior and limits

The existing individual Exam Record detail owns **Authorize Start Now**, with a
shared confirmation Dialog naming the exact Applicant. It separately displays
original appointment, authorization actor/time, actual start and deadline. The
original appointment uses the accepted wall-clock formatters throughout this
detail. No list-level Start Now, sidebar destination or Applicant Profile mutation.

The Applicant page initially reads server state. Start is a deliberate POST, with
duplicate-click/pending protection. Active content uses the same application and
revision after reopen. Timing uses the persisted deadline minus serverNow plus
monotonic elapsed time, conservatively anchored before the request. Changing the
device wall clock does not increase time. Status resynchronizes every 15 seconds,
on focus/reconnect and visibility return. Failure/offline locks access until
successful resynchronization. Queries are scoped to the signed-in Applicant and
do not retain unused protected content after unmount. Exact identity is pinned
after discovery. Expired/terminal/legacy/blocked states never restart time.

**B5 limitation:** answers are not hydrated after refresh. The page says so. MCQ
choices remain mounted-page state; the existing best-effort essay interval stays
transitional, with no new autosave/retry/versioning/recovery feature. B4 restores
execution/content/time only. The accepted Phase A renderer is not redesigned.

**B6 limitation:** expiry locks active access, but does not finalize without a
browser, create an immutable receipt or settle submit-vs-expire authority. No
background expiry worker, timeout scoring or incomplete-answer policy is added.
B7/B8 evaluation/final scoring/publication and B9 different-date rescheduling,
appeals, reconsideration and seat release remain separate. PD-5 remains unresolved.

## Verification evidence

Related exam unit/component/HTTP selection: **46 files / 965 tests PASS**,
zero failures/skips. This deliberately broadens within the exam domain for schema,
authorization, binding/media and answer-writer changes; no entire repository suite.
Coverage includes exact roles/IDs, authorization attribution without start, normal/
early/late/cross-date boundaries, invalid config/content, legacy cutover, state/
eligibility/capacity, exact timestamps, deadline/no closing cap, repeated Start,
refresh/new-instance recovery, private media and frozen key/projection. Controlled
React/component/clock tests cover per-record confirmation, authorization versus
actual start, pre-start/active/expired/blocked states, same-deadline second clock,
device-clock independence, reconnect contract and absence of fixed initialization.

**Real MariaDB 10.4.32 / InnoDB:** B4 harness **11/11 PASS**, including wrapper
checks invoking **5/5 existing B0A** and **4/4 existing B2** real-DB regressions.
The host default was REPEATABLE-READ; B4 deliberately uses READ COMMITTED.
Observed independent Student lock waits: **751/743**, **754/746**, **757/749**;
answer application lock wait: **763/755**. Requests execute real parameterized
FOR UPDATE and remain blocked before the first transaction is released.

- Concurrent Start: one exact application execution, identical start/deadline/set.
- Authorization-first early race: permission commits without time; waiting Start
  succeeds. Applicant-first early race: safe rejection, then authorization/retry.
- Independent clients and a separate Node process read the same persisted timing/
  revision after current config/publication changes. This is process-independent
  persistence evidence, not a manually executed restart of a deployed HTTP server.
- Injected failure after the real binding update rolls back all execution fields.
- Source content/key edits leave received content/key stable; unrelated question/
  option/media access rejects. B0A final/draft contention and rollback remain passing.

**Migration rehearsal:** applied the complete committed pre-B4 migration chain to
an empty UUID-named local test database using `prisma migrate deploy`; inserted
pre-B4 synthetic clean/legacy/terminal applications and legacy answer evidence;
then deployed the committed B4 migration. Original-column SHA-256 matched before/
after; all six authority fields remained null. Index/FK presence, migration status
up-to-date and a second deploy with no pending migrations passed. B2 additionally
rehearsed its historical migration in its own disposable database.

Final pre-B4 preservation hash:
`7e80692a9b08d0a15d33945d13d31d96f022fa5d26bf76f844fc4f80284dd934`.
Configured protected exam/configuration snapshot before/after:
`91a11a33755b2f1fe8ae2eb1ef43c9d56fc623a3513d2fe7f24f7933119ba9d1`.
Exact generated test databases were removed and absence verified. Synthetic
records were cleaned. No canonical bank/configuration/application mutation in
the configured development database, reset or `db push`.

Commands (backend unless noted):

```powershell
$testFiles = rg --files tests/unit | Where-Object {
  $_ -match '[\\/](exam-(answer|result|configuration|question-set|engine|media|content|emphasis|record|schedule|execution|assignment)|applicant-(exam-content|results)|admin-exam-editor)'
}
npm test -- $testFiles
$env:EXAM_B4_DB_TEST = '1'
npm test -- tests/integration/exam-execution-contention.test.ts --reporter=verbose
npx prisma generate
npx prisma validate
npm run build
# frontend: standalone tsc, ESLint on changed TS/TSX, production build
npx tsc --noEmit
node --test scripts/verify-exam-content-6-ui-follow-up.mjs
npm run build
# root
git diff --check
```

Backend build/typecheck, Prisma generate/validate, frontend TypeScript, scoped
ESLint, production frontend build (68 pages), Question Bank verifier **11/11**,
and diff checks: **PASS**. Existing Next middleware and Node/Vite deprecation
advisories remain nonblocking. Earlier test failures reflected obsolete legacy
fixtures and restrictive-FK test cleanup; those were corrected and final scoped
runs passed. Accepted B0A/B2 fixtures now represent their historical schema or
explicit synthetic B4 execution as appropriate, without weakening runtime guards.

**Project-owner manual/browser QA: DEFERRED / NOT EXECUTED by owner decision.**
The owner chose to consolidate manual/browser validation after the remaining
Phase B packages instead of stopping after B4. The later lifecycle/manual gate
must still cover normal start, early authorization, optional late authorization,
no-booking B3 assignment then start, different-date rejection, original
appointment preservation, refresh/reopen, another tab/device, local-clock
changes, reconnect near deadline and matching server time. Automated/static
rendering is not manual acceptance.

**Hosted CI: NOT EXECUTED / no hosted PASS claimed.** Existing workflow triggers
main pushes and PRs targeting main; this delivery creates neither. Independent
remote source review is complete with no blocking issue. B4 is accepted for
Phase B progression with owner manual/browser QA deferred to the consolidated
lifecycle gate. The next bounded package is B5; B6 and later remain separately
unauthorized.

## Exact changed files

The complete package file list follows (repository-relative).

```text
backend/prisma/migrations/20261103000000_exam_execution_authority/migration.sql
backend/prisma/schema.prisma
backend/src/controllers/exam-engine.controller.ts
backend/src/controllers/exam-execution.controller.ts
backend/src/controllers/exam-media.controller.ts
backend/src/repositories/exam-configuration.repository.ts
backend/src/repositories/exam-engine.repository.ts
backend/src/repositories/exam-execution.repository.ts
backend/src/repositories/exam-media.repository.ts
backend/src/repositories/exam-question-set.repository.ts
backend/src/routes/exam-engine.routes.ts
backend/src/services/exam-engine.service.ts
backend/src/services/exam-media.service.ts
backend/tests/fixtures/exam-execution.ts
backend/tests/integration/exam-answer-contention.test.ts
backend/tests/integration/exam-execution-contention.test.ts
backend/tests/integration/exam-question-set.test.ts
backend/tests/unit/controllers/exam-answer.controller.test.ts
backend/tests/unit/repositories/exam-answer.repository.test.ts
backend/tests/unit/repositories/exam-engine.repository.test.ts
backend/tests/unit/repositories/exam-execution.repository.test.ts
backend/tests/unit/repositories/exam-media.repository.test.ts
backend/tests/unit/repositories/exam-question-set.repository.test.ts
backend/tests/unit/routes/exam-execution.routes.test.ts
backend/tests/unit/routes/exam-media.routes.test.ts
backend/tests/unit/services/exam-answer.service.test.ts
backend/tests/unit/services/exam-configuration-ui.contract.test.ts
backend/tests/unit/services/exam-execution-ui.contract.test.ts
backend/tests/unit/services/exam-media-access.test.ts
backend/tests/unit/services/exam-media.service.test.ts
docs/superpowers/GSIS_IMPLEMENTATION_CHECKLIST.md
docs/superpowers/plans/2026-11-01-exam-engine-scheduling-phase-b.md
docs/superpowers/reports/2026-11-02-exam-b4-server-owned-attempt.md
docs/superpowers/ui-ux/UI_UX_AUDIT.md
frontend/src/app/(portal)/admin/exam/applications/[id]/page.tsx
frontend/src/app/(portal)/applicant/exam/page.tsx
frontend/src/components/admin/exam/start-authorization.tsx
frontend/src/components/exam-content/exam-configuration-dialog.tsx
frontend/src/components/exam-content/exam-execution-context.tsx
frontend/src/components/exam-content/exam-media-image.tsx
frontend/src/lib/exam-execution.ts
frontend/src/lib/exam-media.client.ts
```
