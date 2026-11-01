# EXAM-B0B — Pending-result and notification containment

Date: 2026-11-02 (Asia/Manila).

Status: **IMPLEMENTED — INDEPENDENT REVIEW / OWNER ACCEPTANCE PENDING**.
EXAM-B0A remains accepted for Phase B progression. Phase B is incomplete and not
production-ready. Stop after the B0B commit/push; B1 and later packages require
separate authorization.

## Starting state and authority

The working tree was clean on the existing shared implementation branch
`feat/exam-engine-scheduling`. Local HEAD, origin tracking HEAD and live remote
branch all matched `ad84c161ed718e1743cb0f385b715381de4eeeb2`,
`docs(exam): close B0A review checkpoint`. Local/origin/live remote main all
matched `a6dc6f57c6e8130482c814e90703765972fddaa9`. The branch was four commits
ahead and zero behind main. Inspected the intervening B0A acceptance-documentation
commits; no unexpected implementation was present. No branch recreation, main
change, reset, rebase, force push or unrelated merge was performed. Delivery
identifiers and final remote/worktree verification are reported after push.

Read the current checklist §7.2, Phase B audit B-05/§9, plan/common protections/
B0B, EXAM_CONTENT_SOURCE_OF_TRUTH, ENGINEERING_VERIFICATION_POLICY, accepted
B0A report, SYSTEM_UI_UX_PLAYBOOK and UI_UX_AUDIT. The unchanged source-of-truth
and verification-policy contents already read for B0A were checked against the
current branch. UI/UX reading included the accepted UIUX-2D/UIUX-2E Exam Record
detail/Score Management retirement checkpoint, unavailable/error state and honest
state/copy guidance. CONTEXT.md supplied orientation; the newer package request
and accepted domain authorities override its historical branch/workstream notes.
Applied the installed Next.js skill to the bounded Applicant page change.

## Baseline defect confirmed

Traced actual result route → controller → service → repository → Applicant page,
and Admin detail → existing send-email route/middleware → controller → service →
application lookup → EmailService/template rendering → BullMQ enqueue. Inspected
application/score models/enums, API error handling, result/frontend types, accepted
Admin state helpers, repository/service/route tests and frontend contract patterns.

The result query selected any scored application, including TAKEN/PENDING. The
service returned `status: pending` and converted null essay/total into zero.
The Applicant main result header interpreted any non-passed success as FAILED.
The email service caller checked only application existence and selected the fail
template for any non-PASSED state. Admin button visibility did not protect direct
authorized HTTP requests.

An in-memory execution of the exact starting service source reproduced a
TAKEN/PENDING record returning essayScore/totalScore zero, selecting the existing
Applicant FAILED header branch and requesting `ecat_result_fail`. No database,
Redis, SMTP or real recipient was used in that reproduction.

## Applicant contract and finalized-result preservation

The existing latest-scored-application query remains scoped to the authenticated
JWT user's Student. It retains PENDING as valid internal data rather than filtering
it out and silently falling back to an older finalized result. Existing
latest-scored selection semantics otherwise remain unchanged.

`ExamService.getExamResult` now returns:

- **404 AppError** when there is no scored result: `No examination result is available yet.`
- **409 AppError** when application and score do not agree on PASSED or FAILED:
  `Your examination result is not yet available. It may still be awaiting evaluation.`
- The existing successful completed-result DTO only for matching PASSED/PASSED
  or FAILED/FAILED. It returns the stored score values and recorded result; it
  never recalculates PASS/FAIL from the current denominator/threshold.

A small shared service-local predicate checks finality/agreement for both reads
and email. It admits only PASSED/FAILED with an existing matching score relation.
TAKEN/PENDING never reaches score conversion or completed-result presentation.
Unexpected errors receive a generic 500 response, distinct from expected 404/409.

The Applicant page reuses its existing Results Not Available surface for typed
ApiError 404/409. It no longer matches error-message substrings. A successful
pending, absent or unknown status also enters that neutral unavailable surface;
only exact `passed`/`failed` can reach the completed score layout. The FAILED
header has an explicit failed branch. Unexpected errors use Error Loading Results
and cannot expose raw internal messages or stale completed data.

This is the smallest compatible approach: existing API error transport and page
state are reused, with no new pending DTO/publication workflow or broad redesign.
The unsupported claim that email "has been sent" is replaced by the factual
`Result notifications use your registered email address.` No delivery state is
invented. Existing completed-result layout, scores, pass/COR instructions and
failed-result information otherwise remain unchanged.

## Email finality, authorization and queue semantics

The exact route-param application is queried with a narrow Prisma select:
application id/status, its linked score status, and linked Student/User firstName/
email. It no longer loads passwords, full User/Student rows or unused Program data.
The score's unique application relation establishes that the statuses belong to
the same record; they are not looked up independently from request body identities.

Before EmailService is called:

- Missing application → 404.
- Missing score, nonfinal application/score, or disagreement → 409; zero queue calls.
- PASSED + PASSED → `ecat_result_pass`.
- FAILED + FAILED → `ecat_result_fail`.

Recipient/name come only from the authoritative linked User, and the portal link
retains its existing server environment/fallback. Request-body recipient/template/
application overrides are ignored. The mutation remains on
`POST /exam/scores/:id/send-email` with authenticateJWT + ADMIN authorization.

The existing `await EmailService.sendTemplateEmail` handoff remains. A rejected
handoff produces a generic 500 rather than a success response or leaked queue/
template details. Inspection also found the template-rendering catch logged a
FAILED entry and returned silently without enqueueing. Its single `return` was
changed to `throw error` so the caller cannot claim queue success in that case.
The existing failure log, template API, queue/worker/retries and direct/batch send
mechanisms are otherwise unchanged. This also makes that failure visible to other
callers of the shared single-template helper; focused helper tests cover the
changed boundary. No live email was sent and no persistent delivery state was added.

Success means queue handoff only. Delivery, deduplication, repeat-send tracking
and version/publication authority remain outside B0B.

## Focused automated evidence

From `backend`:

```powershell
npm test -- tests/unit/services/exam-result.service.test.ts tests/unit/repositories/exam-result.repository.test.ts tests/unit/routes/exam-result.routes.test.ts tests/unit/services/applicant-results.contract.test.ts tests/unit/services/exam-result-email-queue.test.ts tests/unit/services/exam-record-detail.service.test.ts tests/unit/repositories/exam-record.repository.test.ts tests/unit/routes/exam-record.routes.test.ts tests/unit/repositories/exam-answer.repository.test.ts tests/unit/repositories/exam-engine.repository.test.ts tests/unit/controllers/exam-answer.controller.test.ts tests/unit/services/exam-answer.service.test.ts
npm run build
```

Results: **12 files / 182 tests PASS; zero skipped/failed**. Backend build
(`tsc`): **PASS**. The existing Vite native-config advisory remains informational.
No full backend/frontend suite was run.

New coverage includes the seven application statuses crossed with absent/PENDING/
PASSED/FAILED score states, both allowed final combinations, missing records,
persisted decimal values and unchanged recorded FAILED even where the current
derived threshold would suggest otherwise. Repository tests preserve current
live-count/30/75% behavior and current grading score/application writes.

Executable HTTP tests use real Express router/controller/service/repository and
real JWT verification/role middleware with synthetic signed tokens; only database
and EmailService are mocked. They prove ADMIN access, rejection of APPLICANT/
STUDENT/PANELIST/invalid/missing credentials before lookup/queue, typed pending/
missing-result errors, correct templates/recipient, rejection propagation, safe
unexpected-error responses and JWT-scoped result reads despite forged query/body
identities. Existing route tests retain retired reads and grading action boundaries.

Frontend verification is in `applicant-results.contract.test.ts`: **14 tests**
execute the actual page's transpiled JSX through React static rendering with
controlled query/session and primitive component dependencies. They cover
PENDING/unknown/missing status, typed 404/409 independent of wording, PASSED,
FAILED, unexpected error with stale data, loading, recipient wording, cache key/
owned request and accepted Admin TAKEN → Needs Essay Grading semantics. These
are component rendering contracts, not browser/manual QA.

Directly affected regressions preserve B0A payload/option/type/state checks,
PENDING score creation, final submission and terminal autosave containment, and
accepted Exam Record detail projection. B0A runtime files and accepted Admin
detail/state/redirect files were verified byte-unchanged against the starting SHA.

From `frontend`:

```powershell
npx tsc --noEmit
npx eslint "src/app/(portal)/applicant/results/page.tsx"
```

Both **PASS**, scoped lint with no diagnostics. A frontend production build was
not run: the change is confined to existing client-page state branches and copy,
with no framework, route, dependency or bundling change. TypeScript, scoped lint
and actual component rendering cover the changed risk. Repository and staged
`git diff --check`: **PASS**. Documentation checkpoint links verified.

Real database contention: **NOT EXECUTED / NOT REQUIRED FOR B0B**; no new
transaction/locking behavior or database mutation was introduced. No migrations,
generation, data reset or canonical-bank operation was performed.

## Changed files and scope

Runtime:

- `backend/src/controllers/exam.controller.ts`
- `backend/src/repositories/exam.repository.ts`
- `backend/src/services/exam.service.ts`
- `backend/src/services/email.service.ts` (failure propagation only)
- `frontend/src/app/(portal)/applicant/results/page.tsx`

New verification files:

- `backend/tests/unit/services/exam-result.service.test.ts`
- `backend/tests/unit/repositories/exam-result.repository.test.ts`
- `backend/tests/unit/routes/exam-result.routes.test.ts`
- `backend/tests/unit/services/exam-result-email-queue.test.ts`
- `backend/tests/unit/services/applicant-results.contract.test.ts`

Documentation: this report, checklist §7.2, and current Phase B plan status/B0B
checkpoint. Historical audit findings and B0A acceptance documentation are retained.

Schema/migrations: **NONE / UNCHANGED**. Dependencies/lockfiles: **UNCHANGED**.
Only Applicant Results frontend changed. Admin Exam Records, email action/error
toast, technical grade/send-email route names and redirect-only Score Management
compatibility page remain unchanged. UI/UX authorities read are listed above.
COR/pass downstream authority, accepted Phase A content/media/projections and
B0A answer serialization are unchanged.

**Manual/browser QA: NOT EXECUTED — project-owner responsibility.**
**Hosted CI: NOT OBSERVED / no CI result claimed.** Current CI triggers on
main pushes or PRs targeting main. This package creates no PR or CI change.

## Remaining limits and stop boundary

Live MCQ denominator, forced essay maximum 30, dynamic 75% threshold, Program
configuration disagreement and historical denominator drift remain B1/B2/B7/B8
work. B0B does not recompute/regrade/reset historical scores or invent final
grading from null fields. Grading lifecycle/versioning, publication/notification
history and repeat-email/delivery guarantees are not implemented. Existing result
selection remains latest scored application; this package does not redefine
attempt selection. Consistency is validated from the read result, with no new
transaction/version guaranteeing it against later regrading; broader immutable
result/publication authority remains a later package.

Stop after B0B push and exact remote/worktree verification. Independent review
and owner acceptance must precede separately authorized next work. No B1 work,
merge, deployment, self-acceptance or Phase B readiness claim is included.
