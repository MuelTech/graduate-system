# EXAM-B6 — Explicit Submission, Expiry and Immutable Final Attempts

Date: 2026-11-04, Asia/Manila.

**ACCEPTED FOR PHASE B PROGRESSION — 2026-11-04**. Independent remote source review: **PASS — no blocking issue found**. Project-owner manual/browser QA remains **DEFERRED / NOT EXECUTED — consolidated Phase B lifecycle/manual acceptance gate**.

B6 is not accepted. B7/B8/B9/B10 are not authorized by this delivery. Phase B is
incomplete and the Applicant Entrance Examination is not production-certified.

## Verified starting state and scope

After the owner updated the previously stale checkout, verified local branch
`feat/exam-engine-scheduling`, local HEAD, cached upstream and live remote feature
HEAD all at `dd9031b2c8601410b2cb0722021b1276d451fb84`. Local/cached/live main matched
`a6dc6f57c6e8130482c814e90703765972fddaa9`; worktree clean; feature 34 ahead / 0
behind main, tracking divergence 0/0. Live refs were read with `git ls-remote`.
No new branch, main mutation, reset, rebase, history rewrite, force push, PR or merge.
Final delivery identifies the actual commit/live remote SHA after normal push;
this report avoids asserting a self-referential commit hash.

The checklist, Phase B plan, B0A/B4/B5 reports, B6 owner PD-4 policy, verification
policy, content source of truth and UI/UX authorities govern this package. Source
inspection covered application/answer/score/status models, B4 binding/deadline,
B5 revision/queue/read/write, all submit callers and backend worker/startup code.
The existing BullMQ email worker is email-specific; the existing cron worker
handles reminders. Neither becomes examination expiry infrastructure. The
Next.js skill informed the bounded Applicant-page work.

## Additive schema and migration

Committed migration: `20261104000000_exam_finalization_authority`.

Nullable fields on the existing `EntranceExamApplication`:

- `finalizedAt` / `finalized_at`: DATETIME(3), actual processing event time;
- `finalizationReason` / `finalization_reason`: `APPLICANT_SUBMITTED` or `TIME_EXPIRED`;
- `finalizationReceiptId` / `finalization_receipt_id`: unique nullable VARCHAR(36);
- `finalizationAnsweredCount` / `finalization_answered_count`: immutable integer;
- `finalizationQuestionCount` / `finalization_question_count`: immutable integer.

The stored counts keep receipt summaries stable without rebuilding them from
later workflow state. A composite `(status, finalized_at, deadline_at)` index
supports expiry discovery. Existing answer uniqueness, restrictive content FKs
and unique application score remain intact. No new attempt/period/no-show status,
retake identity, historical migration edit or backfill. `TAKEN` remains submitted /
ready for grading. Every new field remains NULL on historical terminal records.

**Configured development DB: UNCHANGED / NOT MIGRATED.** B5 deployment has not been
independently confirmed; the owner must apply committed pending migrations
separately. No `db push`, canonical import/reset, policy/configuration write or
configured-database migration was performed.

## One terminal authority and exact deadline precedence

`ExamFinalizationRepository` has one internal finalization transaction, shared by
Applicant submit and expiry. It validates/normalizes the exact application UUID,
checks JWT ownership before and after the B0A/B5 application `FOR UPDATE` lock,
then rereads current authority under READ COMMITTED. The expiry caller is internal.

Existing complete B6 evidence returns the original allowlisted receipt immediately,
without regenerating identity/time/reason or touching answers/score. Partial
metadata fails closed. A noneligible legacy terminal record never gains evidence.

For a new finalization, reuse B4's validated persisted start/configuration/duration,
deadline arithmetic and exact B2 content binding. Evaluate server time after
locking and rereading: strictly before deadline allows explicit submission;
`now >= deadlineAt` always produces `TIME_EXPIRED`, including an explicit request
that waited across deadline. An expiry contender before deadline is a no-op.
Active explicit submission also retains B4 live Applicant/Program/appointment
eligibility checks. Expiry closes an already-recorded valid execution from its
persisted authority; later live eligibility changes do not invent more time.

Read all persisted B5 answer rows under the same lock and validate every row
against frozen question type/options. Foreign question/option or contradictory
stored representation rejects before final writes. Missing rows remain missing;
MCQ null clears remain null; essay empty/whitespace remains byte-for-byte stored
text and counts as unanswered. B6 performs **no answer insert/update/upsert**.
There is no browser answer snapshot or fallback to the mutable bank.

The transaction writes receipt metadata plus TAKEN and creates exactly one
`PENDING` score containing only the existing raw count of correct frozen MCQs.
It does not apply B1 weighting/passing thresholds, invent essay grades, compute
PASS/FAIL or publish results. B7/B8 retain those responsibilities. A failure after
real score/finalization writes rolls the entire transaction back while previously
acknowledged drafts remain intact.

Draft and finalizer lock order is the same exact application authority. A draft
committed first is consumed unchanged; finalization first rejects waiting/later
drafts from terminal status. A draft obtaining authority at/after deadline still
fails B4 time checks. In-process guards only avoid redundant sweeps; database
locking and unique application/receipt/score authority provide process-wide safety.

## Explicit submit, incomplete confirmation and receipt contracts

APPLICANT-only JWT routes under `/api/exam-engine`:

| Method | Route | Contract |
| --- | --- | --- |
| POST | `/applications/:applicationId/submit` | `{}` or `{ acknowledgeIncomplete: boolean }`; returns the immutable receipt. |
| GET | `/applications/:applicationId/finalization` | `{ state: FINALIZED / PENDING / LEGACY_TERMINAL, receipt: object / null }`. |
| GET | `/applications/:applicationId/execution` | Existing B4 projection additionally includes nullable `finalization` receipt. |

All responses retain private/no-store behavior. Foreign ownership returns 404;
malformed UUIDs return 400. Unsupported fields reject: answers, deadline/start,
reason/time/receipt, content revision and scoring cannot be supplied by the client.
The legacy implicit `/submit` remains retired. The old arbitrary-answer repository
mutation and obsolete snapshot validators were removed; no second final mutation
path survives.

Before deadline the server independently counts unanswered frozen questions from
persisted drafts. Missing/false acknowledgment when incomplete returns 409 with
`code: INCOMPLETE_CONFIRMATION_REQUIRED`, `answeredCount`, `unansweredCount` and
plain-language confirmation guidance, without writes. `acknowledgeIncomplete: true`
permits incomplete submission. Timeout never needs acknowledgment.

Receipt allowlist: `receiptId`, `applicationId`, `finalizedAt`,
`finalizationReason`, `actualStartedAt`, `deadlineAt`, `contentRevisionId`,
`answeredCount`, `unansweredCount`, `questionCount`. No correctness, answer key,
score internals, source/storage metadata or private configuration is included.
Repeated submit, timeout-first then Applicant request, lost-response retry and
fresh-connection readback recover exactly the same receipt.

Legacy TAKEN/PASSED/FAILED/APPEALED/DISQUALIFIED records without B6 evidence remain
truthful legacy terminal state. GET returns `LEGACY_TERMINAL` and null receipt;
POST rejects. No invented historical reason, start, finalization time or receipt.

## Expiry sweep and startup catch-up

`startExamExpiryWorker()` is invoked from the backend startup entrypoint. It runs
catch-up immediately and then every 30 seconds, prevents overlapping invocations
of that worker, catches sweep failures for later retry and stops its interval on
HTTP server close. No Redis dependency, email queue reuse or scheduler framework.

The exported sweep pages potential candidates in batches of 100 by stable ID,
with a fixed server-time cutoff: PENDING/APPROVED, not finalized, recorded start,
due deadline, bound revision and non-null configuration. The same finalizer
validates full B4 evidence for each candidate. Failures log concise server-side
messages and do not stop subsequent candidates/pages or future intervals. Paging
past failed records prevents a damaged first batch from starving valid attempts.
Never-started/missed appointments are excluded; appointment date alone does nothing.

A restart after downtime processes overdue starts from the last persisted drafts.
`finalizedAt` is the actual processing time, distinct from the older deadline.
The interval introduces normal catch-up latency; the UI waits for authoritative
receipt evidence and does not pretend execution occurred while the server was off.

## Applicant UI and protected behavior

The existing B5 queue resolves/resynchronizes and drains pending saves before
confirmation and again before final submit. Incomplete confirmation states count
and unanswered-item consequence. Preparation/confirmation/commit lock editing;
synchronous guards prevent duplicate clicks. Only acknowledgment metadata is sent.

Successful finalization immediately renders the server receipt with reason in
plain language, timestamps and answer summary, and stops editable questions.
Execution polling/reopen recovers the same receipt. A failed final response locks
editing until exact receipt/status readback resolves whether commit occurred.
Zero time disables content immediately and truthfully says final status is being
retrieved; no completion claim exists before receipt. Timeout does not depend on
page mounting, browser timer, unload request, beacon or browser closure events.

B5 Saved/error/conflict/clear/version recovery and B4 monotonic countdown/persisted
deadline remain. Phase A source content, renderers, emphasis, assets and private
media are unchanged. No protected content is added to persistent local caches.

## Verification evidence

- Exam-domain related unit/HTTP/component selection: **50 files / 1,041 tests PASS**,
  no failures/skips. Broadened within the examination domain because schema,
  authorization, finality and shared locking changed; no unrelated full suite.
- Final focused B6 HTTP/worker + affected Applicant component checks:
  **3 files / 78 tests PASS**. This is a subset of the related suite, not additive.
  Covers roles/ownership/malformed IDs, unstarted/partial/invalid binding,
  active/expired/legacy, incomplete acknowledgment, persisted rows/clears,
  receipt privacy/replay, terminal draft rejection, worker overlap/errors/paging,
  UI queue ordering/confirmation/locks/zero/reopen/lost-response recovery.
- Real MariaDB **10.4.32 / InnoDB**, host default REPEATABLE-READ, application
  transactions explicitly READ COMMITTED: **20/20 harness checks PASS**:
  **19 direct B6 checks plus one nested regression wrapper**. The wrapper runs
  **B5 11/11**, including **B4 11/11**, **B0A 5/5**, **B2 4/4**. Nested counts
  overlap and are not independent new B6 tests.
- Real independent connection IDs were observed executing/waiting on `FOR UPDATE`
  through `SHOW FULL PROCESSLIST` before releasing the first holder. Final pairs:
  `305/295`, `312/298`, `318/301`, `294/304`, `300/307`, `308/310`, `321/313`,
  `300/316`, `321/319`. Cases cover submit/submit, both submit/expiry orders,
  draft/submit, submit/draft, expiry/draft, exact deadline, waiting submit crossing
  deadline and waiting draft crossing deadline, repeated/two-sweep idempotency,
  response-loss retry, fresh Prisma connection, unchanged answer rows and rollback
  after actual finalization/score writes.
- A **separate Node process** imports the compiled service and starts the actual
  startup worker against the disposable DB. It catches up an overdue examination,
  preserves the saved essay and reads the timeout receipt back from another client.
  Final test receipt: `cde03b5e-6d8b-42d0-a2ab-6ae704f87fbf`. Processing timestamp
  was after test launch and after the historical deadline. This is automated
  process-restart simulation, not manual restart of a deployed HTTP server.

Migration rehearsal deploys the complete committed pre-B6 chain into a UUID-named
local disposable database. Fixtures include a clean application, valid active B4
start/content/config, a legacy terminal record, existing B5 drafts and a PENDING
score row. Actual B6 SQL preserves every original-column value (SHA-256
`1d94c772f558533ae68afa8e0f54ac06f8198d0b0d3fb31e2900627145403d2b`), leaves old
B6 fields null, preserves FKs, checks nullable columns/indexes/receipt uniqueness,
reports migration status up to date and a second deploy with no pending migration.
Historical B4/B5 rehearsals now apply successor migrations only after comparing
their own original columns; their runtime regressions use the complete schema.

Disposable databases are removed by exact generated identity and absence verified.
Configured protected exam/configuration snapshot is identical before/after:
`2ef0b2d1874d3fdd6635919d752881450f034d8acfe59b8e1f2257d80a8cd906`.

Static/build evidence: **Prisma generate PASS; Prisma validate PASS; backend
build/typecheck PASS; frontend TypeScript PASS; scoped ESLint PASS; production
frontend build PASS (68 pages); Phase A verifier 11/11 PASS; git diff --check PASS**.
Existing Node/Vite/Next middleware advisories are nonblocking. No dependency,
lockfile, CI workflow or framework configuration change.

Initial verification attempts found a B6 error-subclass prototype issue, two
clear-state test-fixture issues and historical rehearsal ordering that included
newer columns in older preservation comparisons. They were fixed; only final
successful runs above establish PASS. No runtime guard was relaxed for a test.

Reproduction from `backend` (PowerShell):

```powershell
npx prisma generate
npx prisma validate
npm run build
$files = rg --files tests/unit | Where-Object {
  $_ -match '[\\/](exam-(answer|result|configuration|question-set|engine|media|content|emphasis|record|schedule|execution|assignment|draft|finalization|expiry)|applicant-(exam-content|results)|admin-exam-editor)'
}
npm test -- $files
$env:EXAM_B6_DB_TEST = '1'
npm test -- tests/integration/exam-finalization-contention.test.ts --reporter=verbose
# frontend
npx tsc --noEmit
npx eslint 'src/app/(portal)/applicant/exam/page.tsx' src/lib/exam-execution.ts
node --test scripts/verify-exam-content-6-ui-follow-up.mjs
npm run build
# root
git diff --check
```

## Manual/browser QA and hosted CI

**Project-owner manual/browser QA: DEFERRED / NOT EXECUTED — consolidated Phase B lifecycle/manual acceptance gate**

The owner gate must include incomplete explicit submit, complete explicit submit,
submit near deadline, browser closure before expiry, disconnect before expiry,
reopen after timeout, server restart/catch-up, lost response/retry, receipt recovery
and attempted edits after finalization. Automated UI checks are not manual QA.

**Hosted CI: NOT EXECUTED / no hosted PASS claimed.** The existing workflow runs
main pushes and PRs targeting main; this delivery is feature-branch-only without a
PR. Independent remote source review and project-owner acceptance remain pending.

## Exact changed files

```text
backend/prisma/migrations/20261104000000_exam_finalization_authority/migration.sql
backend/prisma/schema.prisma
backend/src/controllers/exam-engine.controller.ts
backend/src/index.ts
backend/src/repositories/exam-engine.repository.ts
backend/src/repositories/exam-execution.repository.ts
backend/src/repositories/exam-finalization.repository.ts
backend/src/routes/exam-engine.routes.ts
backend/src/services/exam-answer.rules.ts
backend/src/services/exam-engine.service.ts
backend/src/services/exam-finalization.rules.ts
backend/src/workers/exam-expiry.worker.ts
backend/tests/integration/exam-answer-contention.test.ts
backend/tests/integration/exam-draft-contention.test.ts
backend/tests/integration/exam-execution-contention.test.ts
backend/tests/integration/exam-finalization-contention.test.ts
backend/tests/unit/controllers/exam-answer.controller.test.ts
backend/tests/unit/repositories/exam-answer.repository.test.ts
backend/tests/unit/repositories/exam-engine.repository.test.ts
backend/tests/unit/routes/exam-finalization.routes.test.ts
backend/tests/unit/services/exam-answer.service.test.ts
backend/tests/unit/services/exam-execution-ui.contract.test.ts
backend/tests/unit/services/exam-expiry-worker.test.ts
docs/superpowers/GSIS_IMPLEMENTATION_CHECKLIST.md
docs/superpowers/plans/2026-11-01-exam-engine-scheduling-phase-b.md
docs/superpowers/reports/2026-11-04-exam-b6-finalization.md
docs/superpowers/ui-ux/UI_UX_AUDIT.md
frontend/src/app/(portal)/applicant/exam/page.tsx
frontend/src/lib/exam-execution.ts
```

## Delivery and remaining boundaries

Normal commit and push on `feat/exam-engine-scheduling` only. Final chat delivery
records exact commit/live feature HEAD, changed-file count, clean worktree and
branch relationship. Main remains unchanged. No PR is created.

B7 owns essay composition/evaluation/completion. B8 owns approved weighting,
threshold/rounding, final scoring and result publication. Existing legacy grading
policy defects remain for those packages; B6 does not repair or activate them.
B9 owns different-date missed appointments/no-show, amendments/appeals,
reconsideration and unresolved period/retake/seat-release policy. B10 remains the
consolidated lifecycle/acceptance gate. Independent B6 review is complete and B6 is
accepted for Phase B progression. B7 and later packages remain separately unauthorized
until explicitly approved by the project owner.
