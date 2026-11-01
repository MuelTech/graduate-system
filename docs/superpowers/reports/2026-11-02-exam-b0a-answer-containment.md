# EXAM-B0A — Answer payload and submitted-state containment

Date: 2026-11-02 (Asia/Manila).

Status: **IMPLEMENTED; INDEPENDENT REMOTE REVIEW AND PROJECT-OWNER ACCEPTANCE PENDING**.
Phase B remains incomplete and is not production-ready. Stop after this package;
B0B and all later packages require separate authorization.

## Baseline and authorization

Before edits, local branch was clean `main`. Local `main`, `origin/main`, and
live remote `main` all equaled `a6dc6f57c6e8130482c814e90703765972fddaa9`:
`Merge pull request #46 from MuelTech/feat/exam-engine-scheduling-audit`.
`feat/exam-engine-scheduling` existed neither locally nor remotely. Created it
directly from that exact commit and established its origin tracking branch with
a normal push. This is the shared Phase B implementation branch; this session
implements B0A only. No main changes, reset, rebase, force push or unrelated merge.
The final delivery message records the actual committed/pushed HEAD after push.

Authorities read: current checklist §7.2, Phase B audit (especially B-01/B-02,
submission and concurrency evidence), Phase B plan/common protections/B0A,
EXAM_CONTENT_SOURCE_OF_TRUTH, ENGINEERING_VERIFICATION_POLICY, and accepted
2026-10-29 EXAM-CONTENT-5 report. Inspected full engine routes, controller,
service, repository, related persistence models/enums, answer callers, state
presentation, AppError/validation conventions, transaction/locking references,
and directly affected content/media tests before editing runtime behavior.

## Confirmed defects at the baseline

The original method incremented correctness for each supplied entry, then upserted
the same application/question row. It persisted a foreign question's option even
though that option did not earn a point. Missing type/shape validation allowed
contradictory representations. Its negative state list omitted APPEALED and
DISQUALIFIED. Autosave was a standalone upsert with neither ESSAY nor terminal
state validation. Final submission's ordinary read before update could authorize
multiple contenders from the same pre-submit state.

An in-memory reproduction executed the exact baseline repository source from
the verified commit, without changing files or database records: two correct
entries plus one foreign option for the same question returned `mcqScore: 2`,
one distinct persisted answer and the foreign option as its final choice.
A subsequent autosave mutated that answer while application state was TAKEN.
This baseline reproduction is algorithm evidence, separate from the real database
verification below.

## Implemented contract

- Submission body is exactly `{ answers: [...] }`. Missing/nonarray answers and
  unsupported fields reject with AppError 400. Empty arrays and omitted questions
  remain allowed; there is no all-questions-required rule.
- At most 1000 supplied entries bounds request work, not assessment composition.
  Each entry is an object with UUID `questionId` and exactly one of UUID
  `selectedOptionId` or string `essayAnswer`. UUIDs normalize to lowercase;
  duplicate IDs, including case aliases and conflicting choices, reject rather
  than deduplicate. Unsupported authority fields and opposite fields, even null,
  reject. Essay text preserves whitespace/empty strings and is bounded by the
  existing MySQL TEXT capacity, 65535 UTF-8 bytes; no essay word policy is added.
- The repository revalidates unknown input, then verifies every supplied question
  against persistence before any answer/status/score write. MCQ requires an option
  found in that exact question's options. Unknown/foreign options, wrong answer
  representations and unknown question types reject. Correctness comes only from
  persisted `isCorrect`, after membership validation. No key metadata is returned.
- Each validated distinct MCQ contributes at most one existing score increment.
  Upserts use the same validated IDs/text that produced the score. Text and image
  choices both use opaque option UUIDs. MCQ writes clear essay text; essay writes
  clear selectedOptionId. Existing one-point behavior is retained without claiming
  institutional approval of future configuration/scoring policy.
- Autosave accepts only `{ questionId, essayAnswer }`, verifies an existing ESSAY,
  and never implements MCQ autosave. Both write paths admit **PENDING / APPROVED
  only**. TAKEN, PASSED, FAILED, APPEALED, DISQUALIFIED and unrecognized statuses
  reject with 409; a missing application rejects with 404.
- Applicant write controllers preserve bounded operational errors and replace
  unexpected internal errors with generic 500 messages. JWT-derived Student/latest
  application ownership is retained; no client-supplied application identity.

## Transaction and concurrency authority

Both repository writers begin an interactive Prisma transaction by executing a
parameterized, exact-primary-key locking read:

```sql
SELECT status FROM entrance_exam_applications
WHERE application_id = ? FOR UPDATE
```

The status returned by this locking/current read determines eligibility. This
avoids relying on a pre-transaction status or a repeatable-read snapshot. The
same application lock remains held until commit/rollback in both writers.
Final answer writes, TAKEN transition and MCQ score upsert remain one transaction.
All supplied database/type/membership validations finish before its first write.

An autosave holding authority first commits its draft before a waiting submit
acquires authority and finalizes. A submit holding authority first commits TAKEN
before a waiting autosave reads status, which rejects without writing. Competing
submits likewise have one winner; the other reads TAKEN and rejects. Rollback
releases authority without exposing partial finalization. Different application
rows are independent.

Reused the existing tagged Prisma SQL and transaction-scoped row-lock pattern
found in COR, thesis and manuscript workflows after inspecting its applicability:
here every contained answer writer shares one existing application identity.
Retained correct transactional grouped writes, unique application/question
upserts, server-owned correctness, ownership resolution and Applicant response
allowlists. Replaced the unsafe ordinary status read/negative list, per-entry
score accumulation without uniqueness validation, unconditional unvalidated
answer writes, and independent autosave. No broad collaborator-code rewrite.

## Focused verification

Final combined command, from `backend` in PowerShell:

```powershell
$env:EXAM_B0A_DB_TEST = '1'
npm test -- tests/integration/exam-answer-contention.test.ts tests/unit/repositories/exam-answer.repository.test.ts tests/unit/controllers/exam-answer.controller.test.ts tests/unit/services/exam-answer.service.test.ts tests/unit/repositories/exam-engine.repository.test.ts tests/unit/services/exam-engine-content.service.test.ts tests/unit/controllers/exam-engine-content.controller.test.ts tests/unit/services/applicant-exam-content.contract.test.ts tests/unit/services/exam-media-access.test.ts tests/unit/services/exam-media.service.test.ts tests/unit/services/exam-media-client.contract.test.ts tests/unit/repositories/exam-media.repository.test.ts tests/unit/routes/exam-media.routes.test.ts tests/unit/routes/exam-media-upload.routes.test.ts
```

Result: **14 files / 203 tests PASS; zero skipped or failed**. This comprises
**198 unit/contract regressions and 5 real-database tests**. New unit/controller/
service tests cover malformed/missing/nonarray/duplicate/contradictory payloads,
UUID case aliases, bounded bytes/work, unknown/foreign IDs, type mismatch,
unknown persisted types, distinct scoring/persistence, omissions, all seven
application states, exact lock identity, essay-only autosave, JWT ownership
delegation and bounded error responses. Existing image submission fixture now
uses real UUID shapes and PENDING instead of the nonexistent SCHEDULED enum.

Directly affected accepted regressions passed: Applicant projection/key omission,
mixed content/structured emphasis and Admin authoring compatibility, private media
storage/attachment/access/headers and client confidentiality, and Applicant
rendering/option-selection contracts. No full backend/frontend suite was run.

Backend `npm run build` (`tsc`): **PASS**. `git diff --check`: **PASS**.
The existing Vite native-config advisory is informational. No dependency change,
Prisma schema/migration/generation command or frontend build was needed.

### Real database evidence

**EXECUTED / PASS** on local MariaDB **10.4.32**, InnoDB,
**REPEATABLE-READ**, using installed Prisma/MariaDB adapter and independent
transaction connections. The repository itself executes all locking/answer/status/
score operations; a test gateway selects real clients and pauses the first
transaction immediately after acquiring its application lock.

Each contention case asserts different database connection IDs and observes the
second connection actively executing `FOR UPDATE` via `SHOW FULL PROCESSLIST`,
remaining blocked while the first transaction holds its lock. Only then does
the test release the first transaction and check the committed outcome:

1. Submit vs submit: one successful finalization; waiting submit rejects 409;
   one score and unchanged winning final answer set.
2. Autosave then submit: draft succeeds; waiting submit succeeds and replaces
   it with the final essay, score and TAKEN state.
3. Submit then autosave: waiting autosave rejects 409; later direct autosave
   also rejects; winning essay/choices/score remain unchanged.
4. Invalid foreign-option payload: no partial final answers/score/status change;
   a previously committed essay draft survives.
5. Injected score-write exception after real answer and status writes: real
   database transaction rolls all final writes back to PENDING/no answers/no score.

Initial observer assertions used MariaDB's information_schema transaction/lock
views, whose returned entries remained stale across cases even while final
outcomes were correct. Those verification attempts failed the observer assertion;
no concurrency PASS was claimed from them. The final harness uses current server
process execution and actual blocked-query completion instead. The final combined
run above passed all assertions.

Fixture creates only fresh UUID-scoped synthetic User/Student/Program/Slot/
Application/questions/options/answers/scores. Exact-ID cleanup in `afterAll`
asserts zero remaining fixture rows across all nine affected model types.
Canonical OLSAT/source-import/media records are never modified or reset. The
test is opt-in (`EXAM_B0A_DB_TEST=1`); ordinary tests/CI skip it without a database.
An explicit opt-out invocation was also checked: exit 0, one file/five tests
skipped, with no database setup performed. This is separate from the real PASS run.
Running it requires a prepared project schema and visibility of the worker
connections in `SHOW FULL PROCESSLIST`. Local evidence is not deployed-engine
or hosted-CI contention evidence.

## Changed files and protected scope

Runtime:

- `backend/src/controllers/exam-engine.controller.ts`
- `backend/src/services/exam-engine.service.ts`
- `backend/src/services/exam-answer.rules.ts` (new)
- `backend/src/repositories/exam-engine.repository.ts`

Verification:

- `backend/tests/unit/controllers/exam-answer.controller.test.ts` (new)
- `backend/tests/unit/services/exam-answer.service.test.ts` (new)
- `backend/tests/unit/repositories/exam-answer.repository.test.ts` (new)
- `backend/tests/integration/exam-answer-contention.test.ts` (new)
- `backend/tests/unit/repositories/exam-engine.repository.test.ts`

Documentation: this report, checklist §7.2 and the Phase B plan's current
checkpoint/status. Historical audit findings remain unchanged.

Schema/migrations: **UNCHANGED; none created or run**. UI/UX files: **NONE**;
UI/UX-specific authority reading was not triggered. Phase A content, Q24/Q40,
manifest/assets/imports, ordering/emphasis, projection implementation, private-media
implementation, Admin authoring and Applicant rendering are unchanged.

**Manual/browser QA: NOT EXECUTED — project-owner responsibility.**
**Hosted CI: NOT EXECUTED / no new run claimed.** Existing CI triggers on main
pushes or PRs targeting main, not this branch-only push; this package does not
create a PR, modify CI, deploy, or merge.

## Limits and review boundary

B0A protects the contained Applicant answer writers against each other. It does
not remediate historical invalid answers/scores, freeze the mutable question bank,
coordinate later appeal/grading redesign, add revisions against stale pre-submit
drafts, change latest-application selection, or provide submit receipts/retry
idempotency. Existing omitted saved essay drafts remain preserved when not supplied
at final submit, as before; completeness/draft reconciliation is not newly decided.
Existing schedule/time checks and values remain in the service before transactions;
deadline-crossing waits, canonical timezone/timer/expiry and config/content snapshots
remain later packages. No MCQ autosave/recovery, pending-result containment,
threshold/configuration, grading, appeal, scheduling-capacity or reconsideration
changes were included. No production readiness or owner acceptance is claimed.

Next action is independent review of the actual pushed B0A diff, followed by
owner QA/acceptance and separate authorization before any next package.
