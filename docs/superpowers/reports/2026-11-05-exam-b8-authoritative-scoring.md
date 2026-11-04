# EXAM-B8 — Authoritative Scoring and Result Publication

Date: 2026-11-05, Asia/Manila.

**IMPLEMENTED / PUSHED — INDEPENDENT REVIEW PENDING.** B8 is not accepted.
Phase B remains incomplete; B9/B10 are not authorized by this package.

## Starting state and scope

After the owner synchronized the initially stale local checkout, verified existing
branch `feat/exam-engine-scheduling`, clean worktree, local HEAD, cached upstream
and live feature HEAD at `dade7ddfae704a9974db1048226ab533ddb0312f`.
Local/cached/live main matched `a6dc6f57c6e8130482c814e90703765972fddaa9`;
feature was 40 ahead / 0 behind main, tracking divergence 0/0. Live refs were
verified through the GitHub connector after direct sandbox SSH access failed.
No branch creation, main mutation, reset, rebase, force push, PR or merge.
Final delivery records the exact normal commit/push and verified live remote HEAD.

The owner-confirmed [B8 policy](2026-11-05-exam-b8-owner-policy.md) governs the
configuration-driven calculation. Historical B1/B4/B6/B7 wording describes those
packages at delivery, rather than overriding the explicit B8 policy. Existing
Phase A content/keys/assets/import/emphasis/renderers, B0A finality, B0B containment,
B2 immutable revision and B3/B4/B5/B6/B7 authorities remain protected. Installed
Next.js and React guidance informed the bounded frontend changes.

## Configuration and B4 compatibility

Existing ADMIN-only Question Bank → Exam Configuration remains the single current
settings owner. Its four editable values are nullable:

- `examDurationMinutes`: positive safe whole minutes, preserving existing bounds;
- `mcqPointsPerCorrectItem`: positive finite numeric points;
- `essayMaximumScore`: positive finite numeric points;
- `passingThreshold`: finite numeric percentage, `0 < value <= 100`.

Responses always expose system-defined `passingThresholdUnit: "PERCENT"` and
`timezone: "Asia/Manila"`. Numeric strings, NaN/Infinity, zero/negative thresholds,
values above 100 and editable-unit requests reject. Completeness requires all
four valid values. Historical stored null thresholds remain readable/incomplete;
there is no 75 default or migration rewrite. The UI labels the percentage,
preserves empty values, distinguishes saved complete/incomplete settings and keeps
duplicate-save/error/readback protection.

New B4 Start requires complete configuration before writing `actualStartedAt`,
`deadlineAt`, `contentRevisionId` or `executionConfiguration`. Its exact values,
fixed unit and timezone are frozen once. Repeated existing starts retain their
recorded deadline/content. Shared historical binding accepts the original null
threshold/null-unit pair, preserving B4 timing, B5 drafts, B6 receipts and B7 reads.
The B8 scorer specifically requires the complete frozen PERCENT configuration;
it never repairs an older attempt using today's settings.

## Schema and immutable evidence

Additive migration: `20261105000000_exam_result_scoring`.

`EntranceExamScore` gains nullable `scoredAt` (DATETIME(3)), `scoringBasis` (JSON),
`resultEmailQueuedAt` (DATETIME(3)) and `resultEmailTemplateKey` (VARCHAR(64)).
Legacy columns and old migrations are preserved. There is no backfill, settings
rewrite, result reclassification or fabricated provenance.

Version 1 scoring basis contains:

```text
version, applicationId, contentRevisionId, finalizationReceiptId
mcqQuestionCount, mcqCorrectCount
mcqPointsPerCorrectItem, mcqEarnedPoints, mcqMaximumPoints
essayScore, essayMaximum
finalEarnedPoints, maximumPossiblePoints
passingThreshold, passingThresholdUnit = PERCENT, result
```

Counts/version are integers; all point/threshold amounts are canonical decimal
strings. The exact numerator/denominator/threshold reproduce the decision without
mutable tables. `scoredAt` separately records computation completion. There is no
answer key in the public projection. Write-once behavior is enforced by the
application-locked mutation path; no database-trigger immutability claim is made.

Chosen legacy-column semantics are explicit: before B8, a B6 PENDING score's
`multipleChoiceScore` contains the raw MCQ correct count. At successful B8 scoring
it becomes earned MCQ points; the raw count remains in immutable `scoringBasis`.
Final DTOs distinguish correct/question counts from earned/maximum points and
identify legacy provenance. Historical final values are not rewritten.

## One exact scoring transaction

`scoreLockedApplication` is internal and requires the exact application lock.
Both callers use READ COMMITTED and `FOR UPDATE`, then reread current authority.

1. Recover an already-computed result only if its immutable evidence validates;
   do not reread answers or create another result.
2. For a new result, require complete B6 receipt/count/reason/timing evidence,
   TAKEN application, PENDING score/null total and completed immutable B7 evaluation.
3. Resolve the exact B2 revision and exactly one essay, retaining B4 binding checks.
4. Read all exact finalized persisted answers, validate question/type/option
   membership and frozen-key integrity, and independently count correct MCQs.
   Missing/cleared/wrong MCQs earn zero; there is no negative marking.
5. Reconcile raw correctness against B6's transitional score and answered count
   against the receipt. Inconsistency requires staff review.
6. Validate the exact B7 essay Decimal against the captured maximum; calculate,
   record basis/time/aggregates and transition application plus score to matching
   PASSED or FAILED atomically. Answers and B7 evaluation are not edited by scoring.

For correct count C, frozen MCQ count N, frozen per-item points P and B7 essay E:

```text
MCQ earned = C × P
MCQ maximum = N × P
final earned = MCQ earned + E
maximum possible = MCQ maximum + frozen essay maximum
PASS iff final earned × 100 >= maximum possible × frozen passing percentage
```

No ordinary floating-point arithmetic, formatted-string comparison or rounded
percentage decides the result. An isolated `Prisma.Decimal.clone` uses 1024
significant digits, covering database score precision and the finite numeric
configuration exponent range, including subnormal points. It does not change
global Decimal settings. Unrepresentable DECIMAL(65,30) aggregates fail closed
before writes instead of relying on database rounding. Percentage division and
two-place formatting occur only in the display projection. Exact equality passes;
74.9999% against 75% fails even when displayed as 75.00%.

Saving a new valid B7 evaluation invokes this scorer before the same transaction
commits. Failure rolls back evaluation, evaluator/time, score, basis and application
together. There is no committed evaluated-but-unscored crash window for a valid
new attempt. Existing B7-completed pending records may use ADMIN-only
`POST /exam/scores/:applicationId/finalize` with no scoring payload. The existing
Exam Record shows **Finalize Result** only for the evaluated TAKEN transitional
state. The same scorer handles recovery/repeats; incomplete frozen policy returns
staff-review guidance. Direct regrading remains rejected.

## Publication, DTOs and existing UI

`completedResultStatus` is shared by Applicant publication, Admin detail eligibility
and result email. Any B4/B6/B7/B8 evidence makes the record require complete B8
provenance: matching final states, complete receipt/evaluation/score, canonical
validated formula/configuration/identity and computation timestamp. Partial,
corrupt or inconsistent evidence fails closed. TAKEN/PENDING remains unavailable.

`getLatestResult` no longer counts current bank questions, forces essay max 30 or
computes a dynamic 75% threshold. Current Program totals/configuration/bank state
never supply new-result denominators. Historical consistent final records retain
recorded status/scores with LEGACY provenance and null maxima, percentage,
threshold and computation time. No fabricated historical basis is created.

Both roles receive the same allowlisted `result` projection: status, provenance,
MCQ correct/question counts, earned/maximum MCQ points, essay earned/maximum,
total/possible, display percentage, frozen passing percentage and computation time.
Applicant additionally retains exam/finalization dates. Decimal amounts are strings;
correct counts are integers. No internal JSON/configuration, key or correctness
detail leaves the projection. Existing Admin compatibility aggregate fields remain
presentation-only; compatibility Program maxima are explicitly null and their mutable columns are not selected. The final UI uses the shared result projection.

The shared `ResultBreakdown` renders identical numbers for Admin and Applicant,
including fractional points and percentage context. B8 final states replace final-
pending wording immediately after grade success. Exact frozen essay review,
evaluator/time, existing Breadcrumb/PageHeader, B4 Start Authorization and Exam
Records list ownership remain. Partial evidence disables email and shows review
guidance. No Score Management destination, score editor or threshold override.

## Result-email idempotency and limits

Existing `ecat_result_pass` / `ecat_result_fail` templates remain. Under the exact
application lock, eligibility is reread/validated and a deterministic job identity
is derived from application ID, score ID, computation time (or explicit legacy
identity) and template. EmailService forwards this identity to BullMQ with
`removeOnComplete: false` and `removeOnFail: false`.

Queue acceptance precedes recording queued timestamp/template. A rejected queue
attempt records neither. Acceptance followed by database/network acknowledgment
failure retries the same retained BullMQ identity, protecting against another job.
Concurrent requests serialize and subsequent accepted calls return already queued.
Queued metadata means accepted for processing, never delivered/SENT. Generic
EmailLog and SMTP worker semantics are unchanged. Retained job identity must not
be removed as part of ordinary automatic queue cleanup. No SMTP exactly-once
delivery or end-to-end Redis/SMTP execution is claimed: tests execute real MariaDB
locking with a controlled queue handoff and separately verify actual EmailService
forwards the exact BullMQ options.

## Automated and real-database evidence

| Evidence class | Actual result |
| --- | --- |
| Related exam unit/HTTP/controlled component selection | 53 files / 1,181 tests PASS, no skips/failures. Schema/finality/configuration changes justify broader exam-domain regression; no unrelated full-repository suite. |
| Final focused result/evaluation/configuration/UI/email subset | 7 files / 182 tests PASS; overlaps the related selection, not additional independent cases. |
| Final read/HTTP subset after removing unused Program maximum projections | 5 files / 101 tests PASS; overlapping regression coverage. |
| B8 real MariaDB harness | 33/33 PASS. |
| Directly affected B7 real MariaDB regression | 26/26 PASS. |
| B6 real MariaDB regression | 20/20 PASS: 19 direct checks plus one nested regression wrapper. |
| Nested B5/B4/B0A/B2 | B5 11/11, including B4 11/11, B0A 5/5 and B2 4/4 PASS; counts overlap wrappers. |
| Prisma generate / validate | PASS. |
| Backend build/typecheck | PASS. |
| Frontend TypeScript / scoped ESLint | PASS, no diagnostics. |
| Frontend production build | PASS, all 68 static pages generated. |
| `git diff --check` | PASS. |

B8 calculation checks cover configured points 1/fractions, wrong/missing/cleared
MCQs, zero/max essay, maximum score, exact equality, below-threshold display
rounding, fractional threshold and 100%. Negative/zero/above-100 configuration
cannot replace the real stored document. New incomplete start has no execution
writes. Historical null scoring preserves read/draft/receipt/evaluation authority
while scoring fails. Later mutable Program/configuration/key/text changes do not
alter the result. Other cases cover B6 mismatch, corrupt frozen key, incomplete/
invalid B7, atomic grade-to-result, repeat/concurrent scoring, post-write rollback,
matching role projections, partial-basis publication/email rejection, legacy truth,
simultaneous/repeated email requests, queue failure and acceptance-before-DB-failure.

Engine: MariaDB 10.4.32 / InnoDB; host default REPEATABLE-READ, explicit application
transactions READ COMMITTED. Independent connections observed through
`SHOW FULL PROCESSLIST` waiting on the actual application `FOR UPDATE` before
releasing the holder: B8 scoring **1068 / 1059**, email **1058 / 1064**.
B7 competing evaluation regression observed **785 / 780**. Fresh-client readback
and injected failure after actual result writes passed. These are real database
contention checks, separate from controlled UI tests and queue-adapter assertions.

Initial runs exposed obsolete pending-only fixtures, missing new mocked delegates,
and synthetic revision/latest-result ordering and preservation-FK setup issues.
Fixtures were corrected without weakening production guards. Final passing runs
above establish the reported results. Build warnings concern existing Next
middleware and Node/Vite deprecations; no framework/dependency changes were made.

## Migration rehearsal and configured database protection

The B8 harness deploys the full committed pre-B8 migration chain into an exact
UUID-named disposable local database. Representative fixtures include B6-finalized
B7-complete/PENDING and B7-pending records, legacy TAKEN/PASSED/FAILED, B5 answer
revision/text, B7 evaluator/time and historical null-threshold execution/configuration.
Applying actual B8 SQL preserves every original-column value and relevant FK.
All four new fields remain null; stored null configuration stays null. Migration
status is up to date and redeploy reports no pending migrations.

Final preexisting-column SHA-256 before/after:
`05c0cf121641cdc1ff488b875b94bd804ecce70811d714327c5d7007539c8d75`.
Configured protected exam/configuration snapshot before/after all harnesses:
`6029852cd6dc38da7a4851f1d2d87e0c4fc47fae0cbfa83eb798151ca995362c`.
Disposable databases are removed by validated exact identity and absence verified.

**Configured development DB: UNCHANGED / NOT MIGRATED.** Any pending B5/B6/B7/B8
migrations remain owner-controlled preparation. No configured reset, `db push`,
canonical import or real configuration/result mutation was performed.

## Reproduction

From backend, PowerShell:

```powershell
npm run prisma:generate
npx prisma validate
npm run build
$files = rg --files tests/unit | Where-Object {
  $_ -match '[\\/](exam-(answer|result|configuration|question-set|engine|media|content|emphasis|record|schedule|execution|assignment|draft|finalization|expiry|essay)|applicant-(exam-content|results)|admin-exam-editor)'
}
npm test -- $files --maxWorkers=4
$env:EXAM_B8_DB_TEST = '1'
npm test -- tests/integration/exam-result-scoring-contention.test.ts --reporter=verbose
$env:EXAM_B7_DB_TEST = '1'
npm test -- tests/integration/exam-essay-evaluation-contention.test.ts --reporter=verbose
$env:EXAM_B6_DB_TEST = '1'
npm test -- tests/integration/exam-finalization-contention.test.ts --reporter=verbose
# frontend
npx tsc --noEmit
npx eslint 'src/app/(portal)/admin/exam/applications/[id]/page.tsx' 'src/app/(portal)/applicant/results/page.tsx' src/components/admin/exam/essay-evaluation-panel.tsx src/components/exam-content/result-breakdown.tsx src/components/exam-content/exam-configuration-dialog.tsx src/lib/exam-configuration.ts src/types/index.ts
npm run build
# root
git diff --check
```

B2/content projection runtime is unchanged, so the conditional standalone Phase A
Question Bank verifier was not required; directly affected Phase A unit/contract
checks are included in the exam-domain selection.

## Deferred acceptance gates and delivery boundary

**Project-owner manual/browser QA: DEFERRED / NOT EXECUTED — consolidated Phase B lifecycle/manual acceptance gate**

Owner walkthrough must cover complete/incomplete settings and starts, configured
sample/fractional calculations, threshold equality/below-threshold, essay evaluation
to final result, matching Applicant/Admin views, later settings/bank edits, result
email/repeated click and historical results. Automated evidence is not manual QA.

**Hosted CI: NOT EXECUTED / no hosted PASS claimed.** This is a feature-branch-only
normal push without a PR or main merge; final delivery separately checks workflow
evidence for the actual commit. Independent source review and owner acceptance
remain pending.

STOP after B8 delivery. No B9 reconsideration, regrade, score/threshold override,
revoke, no-show appeal, retake, reschedule, ExamPeriod or seat release is added.
B10 remains the separately authorized lifecycle/acceptance gate.

## Exact changed files

49 files in this bounded package:

```text
backend/prisma/migrations/20261105000000_exam_result_scoring/migration.sql
backend/prisma/schema.prisma
backend/src/controllers/exam.controller.ts
backend/src/interfaces/exam-configuration.interfaces.ts
backend/src/interfaces/exam.interfaces.ts
backend/src/repositories/exam-essay-evaluation.projection.ts
backend/src/repositories/exam-execution.repository.ts
backend/src/repositories/exam-result.repository.ts
backend/src/repositories/exam.repository.ts
backend/src/routes/exam.routes.ts
backend/src/services/email.service.ts
backend/src/services/exam-configuration.rules.ts
backend/src/services/exam-result.rules.ts
backend/src/services/exam.service.ts
backend/tests/fixtures/exam-essay-evaluation.ts
backend/tests/fixtures/exam-execution.ts
backend/tests/integration/exam-draft-contention.test.ts
backend/tests/integration/exam-essay-evaluation-contention.test.ts
backend/tests/integration/exam-execution-contention.test.ts
backend/tests/integration/exam-finalization-contention.test.ts
backend/tests/integration/exam-result-scoring-contention.test.ts
backend/tests/unit/repositories/exam-configuration.repository.test.ts
backend/tests/unit/repositories/exam-execution.repository.test.ts
backend/tests/unit/repositories/exam-record.repository.test.ts
backend/tests/unit/repositories/exam-result.repository.test.ts
backend/tests/unit/routes/exam-configuration.routes.test.ts
backend/tests/unit/routes/exam-draft.routes.test.ts
backend/tests/unit/routes/exam-essay-evaluation.routes.test.ts
backend/tests/unit/routes/exam-finalization.routes.test.ts
backend/tests/unit/routes/exam-result.routes.test.ts
backend/tests/unit/services/applicant-results.contract.test.ts
backend/tests/unit/services/exam-configuration-ui.contract.test.ts
backend/tests/unit/services/exam-configuration.rules.test.ts
backend/tests/unit/services/exam-essay-evaluation-ui.contract.test.ts
backend/tests/unit/services/exam-record-detail.service.test.ts
backend/tests/unit/services/exam-result-email-queue.test.ts
backend/tests/unit/services/exam-result-scoring.rules.test.ts
backend/tests/unit/services/exam-result.service.test.ts
docs/superpowers/GSIS_IMPLEMENTATION_CHECKLIST.md
docs/superpowers/plans/2026-11-01-exam-engine-scheduling-phase-b.md
docs/superpowers/reports/2026-11-05-exam-b8-authoritative-scoring.md
docs/superpowers/ui-ux/UI_UX_AUDIT.md
frontend/src/app/(portal)/admin/exam/applications/[id]/page.tsx
frontend/src/app/(portal)/applicant/results/page.tsx
frontend/src/components/admin/exam/essay-evaluation-panel.tsx
frontend/src/components/exam-content/exam-configuration-dialog.tsx
frontend/src/components/exam-content/result-breakdown.tsx
frontend/src/lib/exam-configuration.ts
frontend/src/types/index.ts
```
