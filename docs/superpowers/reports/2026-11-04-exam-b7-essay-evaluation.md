# EXAM-B7 — Essay Evaluation Lifecycle

Owner authorization: 2026-11-04. Implementation/verification completed 2026-11-05,
Asia/Manila; the requested report filename is retained.

**ACCEPTED FOR PHASE B PROGRESSION — 2026-11-05.** Independent remote source review: **PASS — no blocking issue found**. Project-owner manual/browser QA remains **DEFERRED / NOT EXECUTED — consolidated Phase B lifecycle/manual acceptance gate**.

B7 is not accepted. This package does not authorize B8/B9/B10 or certify the
Applicant Entrance Examination as production-ready.

## 1. Verified starting state

Repository `MuelTech/graduate-system`, existing `feat/exam-engine-scheduling` only.
After the owner synchronized the initially stale checkout, local HEAD, cached
upstream and live remote feature HEAD all matched
`ee25a74c22dc9b71a2506ca4c1aba4311a07725b`. Local/cached/live main matched
`a6dc6f57c6e8130482c814e90703765972fddaa9`. Worktree clean; tracking divergence
0/0; feature 37 ahead / 0 behind main. Live refs were verified with `git ls-remote`.
No branch creation, reset, rebase, history rewrite, force push, PR, main mutation
or merge. Final delivery records the actual commit/live remote SHA.

The current checklist, Phase B plan, B2/B4/B5/B6 reports, B7 owner clarification,
engineering verification policy, content authority and UI/UX playbook/audit govern
this implementation. Actual schema, publication/binding, finalization, grade route,
Admin detail and result/email consumers were inspected. Next.js and React skill
guidance informed the bounded client component. No source assessment content,
import, assets, typography, dependency, lockfile or framework configuration changed.

## 2. Exactly-one-essay enforcement

`singleEssay` requires exactly one ESSAY in a published examination composition.
B2 still permits ordinary draft membership editing, including zero/multiple essays.
Publication checks composition before creating any new immutable revision. New
B4 first-start binding independently validates the latest revision before recording
execution authority, protecting against older invalid publications. There is no
fallback to an older revision or silent first-essay choice.

Published revisions and existing bindings are not rewritten or deleted. B7 review
of an already-bound zero/multiple-essay composition returns STAFF_REVIEW and has
no grading control. Generic Question Bank authoring may still contain many essays.

## 3. Schema and migration

One additive migration: `20261104010000_exam_essay_evaluation`.

`EntranceExamScore.essayEvaluatedAt` maps to nullable
`entrance_exam_scores.essay_evaluated_at DATETIME(3)`. Existing `essayScore` and
`gradedById` remain score/evaluator authority. No evaluation/history table or
persisted presentation status is added. No timestamp or grader backfill, no
historical migration edit, and no historical aggregate rewrite.

**Configured development database: UNCHANGED / NOT MIGRATED.** No reset, `db push`,
configured-database migration, bank/configuration mutation or canonical import.
Any unapplied B5/B6/B7 migrations remain an owner-controlled runtime preparation.

## 4. Frozen prompt, finalized response and captured maximum

The shared review resolver uses the exact application's `contentRevisionId` and
B2's internal validated exact-revision reader. Only the single essay's Applicant-safe
question projection leaves the resolver, including its frozen prompt, semantic
emphasis and stimulus. No key, correct-option flags or MCQ question correctness is
included. Later mutable bank prompt/type edits cannot change review.

The response is selected by the unique `(applicationId, frozen essay questionId)`
from persisted B5/B6 answers. It is never read through mutable bank type filtering.
Contradictory stored representation fails closed. Missing row returns null/MISSING;
empty and whitespace strings remain exact/BLANK; nonblank text remains exact/SUBMITTED.
The UI may say **No response submitted.** No row/text/score is invented. Admin must
explicitly enter a score, including zero if appropriate.

The maximum comes only from B4's recorded `executionConfiguration.essayMaximumScore`.
The existing B4 binding validator is reused, including duration/deadline/config
consistency. Null, malformed, nonnumeric, nonfinite or nonpositive captured maxima
fail closed. Mutable Program/current settings and a fixed 30-point maximum are
not grading authority. Valid fractional maxima/scores are supported without rounding.
The existing score column's DECIMAL(65,30) storage precision is checked explicitly;
unrepresentable tiny scores reject instead of silently rounding in MariaDB. This
storage check is not a 30-point grading bound or an institutional rounding policy.

## 5. One authoritative evaluation transaction

The existing ADMIN-only `POST /exam/scores/:id/grade` route is retained; `id` is the
exact application UUID. Controller accepts only `{ essayScore: JSON number }`.
Null/empty/numeric-string/nonfinite/negative/over-max and unsupported fields reject.
Service/repository boundaries also reject nonnumeric values without coercion.

`ExamRepository.gradeEssay` now performs one READ COMMITTED transaction:

1. Validate/normalize identity and acquire the exact application `FOR UPDATE` lock,
   matching B0A/B5/B6 serialization; reread application and its unique score.
2. Verify the evaluator is currently an active ADMIN.
3. Require complete B6 receipt/reason/time/count evidence, TAKEN application,
   existing PENDING score and null total. Either APPLICANT_SUBMITTED or TIME_EXPIRED
   is reviewable with consistent recorded timing. Partial/legacy/active/terminal
   incompatible states reject.
4. Resolve and validate exact content/config/response and captured maximum.
5. Require evaluation score/evaluator/time all null. A complete evaluation rejects
   a new grade with 409; partial evidence requires staff review.
6. Validate bounds/precision and write only `essayScore`, `gradedById`,
   `essayEvaluatedAt`. Return a safe authoritative evaluation projection.

Application remains TAKEN; score remains PENDING; total remains null. Answers,
receipt, received content/configuration and MCQ count are unchanged. The old
immediate total/75%/PASS/FAIL grading mutation is removed, not retained as another
callable method. Final scoring/legacy finalized-result denominator cleanup remains
B8; this package does not activate those computations for B7 records.

## 6. Completion, concurrency, legacy and Admin UI

New pending evidence is the all-null tuple; complete evidence is the all-present
score/evaluator/time tuple with a valid B6 attempt. Inconsistent evidence fails
closed. Same Admin, another Admin, identical score and changed-score repeats all
reject; no idempotent grading/regrade exception is introduced. A waiting grader
rereads committed evidence after the lock, receives 409 and cannot overwrite it.
An exception after the actual evaluation write rolls all three fields back.

`GET /exam/applications/:id` remains ADMIN-only, private/no-store, with a consistent
read transaction and an allowlisted `essayEvaluation` projection. States are
PENDING, COMPLETED or bounded UNAVAILABLE/STAFF_REVIEW/LEGACY; unavailable states
carry no fabricated B7 maximum/question/time. Existing historical aggregate fields
remain readable. Legacy TAKEN/PASSED/FAILED records cannot acquire a new B7 grade
merely because they contain an old essay score/grader. Legacy mutable-prompt
presentation is not used as B7 authority.

The existing individual Exam Record owns the evaluation panel. It renders the
frozen question and exact response, captured maximum and decimal-capable score input.
Save has synchronous duplicate-click/pending guards. Successful server evidence
immediately replaces editing with score/max, evaluator and evaluation time, then
refreshes exact detail/list authority. Conflicts/lost responses also refresh.

Completed TAKEN is shown as **Essay Evaluated — Final Result Pending** on detail
and list; pending remains **Needs Essay Grading**. List completion is a narrowly
scoped evidence-based presentation flag/filter, not grading authority or a new
persisted state. B4 Start Authorization and the existing record layout are retained.
No sidebar, queue or Score Management workspace is added.

B0B remains authoritative: Applicant result and result-email endpoints reject
TAKEN/PENDING even after successful B7 evaluation. No PASS/FAIL or email action is
enabled by this lifecycle. Existing legacy consistent final-result behavior remains.

## 7. Automated verification

Evidence classes and overlapping subsets are deliberately separate:

| Check | Actual result |
| --- | --- |
| Exam-domain related unit/HTTP/component selection | 52 files / 1,133 tests PASS; no skips/failures. Broadened within examination domain for schema/auth/content/binding/finality changes; no unrelated full-repository suite. |
| Final directly affected HTTP/UI/detail/result subset after list-evidence refinement | 5 files / 104 tests PASS; overlaps the related selection and includes the new list check. |
| B7 UI after formatting | 26/26 PASS; subset, not extra independent cases. |
| B7 real MariaDB harness | 26/26 PASS. |
| B6 real MariaDB regression harness | 20/20 PASS: 19 direct B6 checks plus nested regression wrapper. |
| Nested B5/B4/B0A/B2 | B5 11/11, including B4 11/11, B0A 5/5 and B2 4/4 PASS. Counts overlap wrappers. |
| B2 standalone real migration/integrity regression | 4/4 PASS; also included in nested regression. |
| Phase A Question Bank/content UI verifier | 11/11 PASS. |
| Prisma generate / validate | PASS. |
| Backend build / TypeScript | PASS. |
| Frontend standalone TypeScript / scoped ESLint | PASS. |
| Production frontend build | PASS; 68 generated pages. |
| `git diff --check` | PASS before commit. |

HTTP checks cover roles/auth, actual numeric/strict body contract, UUID identity,
complete finalization, status/score/config/content/evaluator guards, zero/decimal/max,
partial evidence, repeat rejection, safe DTO and B0B result/email containment.
Controlled React/handler/static-render checks cover exact prompt/response, blank
wording, captured bounds, zero/decimals/over-max/invalid authority, editable versus
read-only completion, evaluator/time, duplicate suppression, refresh, final-pending
wording, no B7 result/email and preserved Start Authorization.

Initial verification found obsolete legacy PASS/FAIL test expectations, a source
package test timeout under 52 simultaneous workers, and synthetic fixture problems
(new essay ordering, expanded slot counter and source encoding). Tests/fixtures
were corrected; related tests were run with four workers. No production authority
guard was weakened. Only final successful runs establish the PASS results above.

## 8. Real MariaDB contention and migration rehearsal

Engine: MariaDB 10.4.32 / InnoDB. Host default REPEATABLE-READ; grade explicitly
uses READ COMMITTED. Independent connections **607 / 602** were observed through
`SHOW FULL PROCESSLIST` executing/waiting on the application's real `FOR UPDATE`
before releasing the first holder. Admin A's 18 committed; Admin B's 20 received
409. Original score/evaluator/time remained. Fresh-client repeat readback and
injected failure after real writes also passed.

The 26 checks cover valid submission/timeout, zero/equal-max/decimal scores,
over-max/negative/nonfinite/null/string/empty/unrepresentable values, null captured
maximum, Program/current-configuration mutation, bank prompt/type mutation,
missing/empty/whitespace response, historical zero/two-essay revisions, new B4
start rejection, B2 draft/publication guards, concurrent/repeated grading, rollback,
TAKEN/PENDING/null-total preservation, result/email denial and legacy truth.

Rehearsal deployed the complete committed pre-B7 migration chain into an exact
UUID-named disposable local database. Fixtures included B6-finalized/PENDING,
legacy TAKEN, historical PASSED and FAILED graded rows, existing B5 answers and
B6 finalization/config/content evidence. Applying actual B7 SQL preserved every
original-column value and foreign key; all old evaluation timestamps stayed null.
Migration status was up to date and a second deploy had no pending migration.

Original-column before/after SHA-256:
`23adfb446d7192174c68d7d811f00cfd7099d61a4a45b0e1ca7fce7031181db8`.
Configured protected exam/configuration snapshot before/after:
`7bfe8c84ac6f7a4a945f0ac4aa8e3019b3b238b7cd7f6ad681ff21a76e9a204c`.
Disposable databases were removed by exact generated identity and absence verified;
no synthetic fixtures remain in the configured database. Historical B6 rehearsal
now compares its own original columns before applying successor migrations, as
the existing B4/B5 rehearsals already do.

Reproduction, from backend (PowerShell):

```powershell
npx prisma generate
npx prisma validate
npm run build
$files = rg --files tests/unit | Where-Object {
  $_ -match '[\\/](exam-(answer|result|configuration|question-set|engine|media|content|emphasis|record|schedule|execution|assignment|draft|finalization|expiry|essay)|applicant-(exam-content|results)|admin-exam-editor)'
}
npm test -- $files --maxWorkers=4
$env:EXAM_B7_DB_TEST = '1'
npm test -- tests/integration/exam-essay-evaluation-contention.test.ts --reporter=verbose
$env:EXAM_B6_DB_TEST = '1'
npm test -- tests/integration/exam-finalization-contention.test.ts --reporter=verbose
# frontend working directory
npx tsc --noEmit
npx eslint 'src/app/(portal)/admin/exam/applications/[id]/page.tsx' 'src/app/(portal)/admin/exam/applications/page.tsx' src/components/admin/exam/essay-evaluation-panel.tsx src/lib/exam-record-state.ts src/types/index.ts
node --test scripts/verify-exam-content-6-ui-follow-up.mjs
npm run build
# repository root
git diff --check
```

## 9. Owner/manual and hosted gates

**Project-owner manual/browser QA: DEFERRED / NOT EXECUTED — consolidated Phase B lifecycle/manual acceptance gate**

Required eventual walkthrough: finalized essay display, blank/missing essay, valid
grade, zero, max-bound rejection, refresh after saving, second Admin/repeated
request, frozen prompt after bank edit, captured maximum after settings/Program
edit, and final result remaining pending. Automated tests are not manual QA.

**Hosted CI: NOT EXECUTED / no hosted PASS claimed.** Existing CI triggers main
pushes and PRs targeting main; this is a feature-only push without a PR. Final
delivery checks hosted status separately. Independent source review and owner
acceptance remain pending.

## 10. Delivery and remaining boundaries

Normal commit/push on `feat/exam-engine-scheduling` only. The final delivery message
records the exact commit/live HEAD, clean worktree, tracking agreement and final
main relationship. Changed files are listed below.

B8 still owns MCQ points application, essay weighting, total possible/final total,
threshold units/value, rounding, PASS/FAIL, finalized scoring basis, publication
and final-result/email eligibility. B9 still owns reconsideration, regrade
exceptions, appeal/no-show/reschedule/retake/period/seat policy. B10 remains the
consolidated lifecycle/manual acceptance gate. No later package is authorized or
implemented here. Independent B7 review is complete and B7 is accepted for Phase B progression. **B8 implementation remains gated on owner-confirmed PD-2/PD-3 scoring values/units/rounding.**

## Exact changed files

<!-- Generated bounded package file list follows. -->

34 files in this bounded package:

```text
backend/prisma/migrations/20261104010000_exam_essay_evaluation/migration.sql
backend/prisma/schema.prisma
backend/src/controllers/exam.controller.ts
backend/src/interfaces/exam.interfaces.ts
backend/src/repositories/exam-essay-evaluation.projection.ts
backend/src/repositories/exam-execution.repository.ts
backend/src/repositories/exam-question-set.repository.ts
backend/src/repositories/exam.repository.ts
backend/src/services/exam-essay-evaluation.rules.ts
backend/src/services/exam-finalization.rules.ts
backend/src/services/exam.service.ts
backend/tests/fixtures/exam-essay-evaluation.ts
backend/tests/fixtures/exam-execution.ts
backend/tests/fixtures/exam-question-set.ts
backend/tests/integration/exam-essay-evaluation-contention.test.ts
backend/tests/integration/exam-finalization-contention.test.ts
backend/tests/integration/exam-question-set.test.ts
backend/tests/unit/repositories/exam-execution.repository.test.ts
backend/tests/unit/repositories/exam-question-set.repository.test.ts
backend/tests/unit/repositories/exam-record.repository.test.ts
backend/tests/unit/repositories/exam-result.repository.test.ts
backend/tests/unit/routes/exam-essay-evaluation.routes.test.ts
backend/tests/unit/routes/exam-execution.routes.test.ts
backend/tests/unit/routes/exam-question-set.routes.test.ts
backend/tests/unit/services/exam-essay-evaluation-ui.contract.test.ts
docs/superpowers/GSIS_IMPLEMENTATION_CHECKLIST.md
docs/superpowers/plans/2026-11-01-exam-engine-scheduling-phase-b.md
docs/superpowers/reports/2026-11-04-exam-b7-essay-evaluation.md
docs/superpowers/ui-ux/UI_UX_AUDIT.md
frontend/src/app/(portal)/admin/exam/applications/[id]/page.tsx
frontend/src/app/(portal)/admin/exam/applications/page.tsx
frontend/src/components/admin/exam/essay-evaluation-panel.tsx
frontend/src/lib/exam-record-state.ts
frontend/src/types/index.ts
```
