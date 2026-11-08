# FACULTY-12 — Faculty Essay Evaluation backend

Date: 2026-11-09 (Asia/Manila). Branch: `feat/faculty-admin-access`.
Starting local and actual remote HEAD: `248d4665923cdcbe95510951247f536e877e583b`; worktree clean, remote verified before edits with `git ls-remote origin refs/heads/feat/faculty-admin-access`.

**Status: FACULTY-12 accepted for continuation** at `c0059b9ebd0de569bb07d34a224506e0aa44f779` after independent remote commit-diff/source review. FACULTY-13 remains deferred / not started pending project-owner approval. This accepts source readiness only; it is not a live rollout or production activation. The delivery commit contains this report; its exact SHA and final local/remote comparison are recorded in the delivery response.

## Pre-implementation coverage ledger

Recorded before production-code edits from the live source. Paths below carry `/api` prefix. Faculty includes legacy `PANELIST` and future `FACULTY`; External classification does not restrict the configured essay grant.

| Action | Caller / authority | Projection / eligibility | Revalidation / preserved exclusions |
| --- | --- | --- | --- |
| New GET `/exam/essay-evaluations` | Current active academic User + exact active profile, password-ready, valid configured `essay.evaluate` | Paginated pending queue: reference, Applicant name/Pinnacle ID, Program context, exam/finalization time, pending status. Each candidate must pass the actual `requireEssayReview` pending resolver, not just TAKEN/score prefilters. | Fresh current actor in consistent read transaction; no Program authorization or broad Applicant/Admin records. Invalid evidence excluded, unexpected database failure fails the read. |
| New GET `/exam/essay-evaluations/:id` | Same Faculty grant | Exact same pending predicate; safe Applicant/context plus B7 frozen Applicant-safe essay question, exact finalized response/state, captured maximum. | Fresh current actor and exact B7 evidence in read transaction; no historical/result/MCQ/scoring/configuration projection. |
| New POST `/exam/essay-evaluations/:id/grade` | Same Faculty grant; only `{ essayScore: number }` | Same pending predicate and B7 bounds/precision; narrow completed receipt only. | READ COMMITTED: shared access fence → evaluator User/profile locks and fresh grants → exact application lock → reread B7 → immutable evaluation → existing `scoreLockedApplication` → commit. No regrade, result recovery/reconsideration/email/MCQ authority. |
| Exact frozen essay image helper under the new pending-detail route | Same Faculty grant and pending predicate, exact frozen essay image ID | Existing revision-bound media metadata and validated PNG/JPEG bytes only. | Reuse existing storage containment/checksum/MIME/size contract; no generic media/Question Bank entitlement. |
| Existing POST `/exam/scores/:id/grade`; ExamService/ExamRepository.gradeEssay | Dormant legacy ADMIN compatibility; target Exam Administration explicitly excludes ESSAY_EVALUATION, including Full | Existing Admin response/history retained on dormant legacy path. | Existing target route/service/repository exclusion remains; extract/reuse the existing locked B7/B8 write implementation for the new Faculty path rather than adding an academic Admin capability. |
| `requireEssayReview` | Internal exact finalized/frozen B7 resolver | Receipt/reason/time/count, binding, exact revision/single essay, finalized essay response, captured maximum, pending/complete/partial evaluation evidence | Reused for every Faculty queue/detail/write decision; no live bank/settings/Program maximum substitution. |
| `scoreLockedApplication` | Internal caller already holds application lock | Existing B8 frozen MCQ/config/threshold, Decimal calculation, immutable result provenance | Same transaction as B7 write; internal result is not returned through Faculty API. Calculation/publication authority unchanged. |
| GET `/exam/applications` and `/exam/applications/:id` | ADMIN with target `exam.records.view` | Existing bounded administrative/history model, including historical evaluator attribution | Unchanged; Faculty grant does not authorize these reads. No historical Admin IDs/times rewritten. |
| POST `/exam/scores/:id/finalize`; POST `/exam/applications/:id/reconsider-result`; POST `/exam/scores/:id/send-email` | Existing separate Admin finalize/reconsider capabilities; result email excluded in target | Existing result recovery/institutional/email workflow | Unchanged; no Faculty entry, new email integration, score override or manual MCQ change. |

No frontend, schema/migration, new permission model, Program evaluator relation, real grant provisioning or live activation is authorized. FACULTY-13 remains deferred / not started.

## Implemented API and authorization matrix

All paths below have `/api` prefix. The existing `/exam` router mounts the dedicated Faculty router, independently of the broad Admin Exam Records APIs.

| Operation | Endpoint | Exact target authority and response |
| --- | --- | --- |
| Pending queue | GET `/exam/essay-evaluations?cursor=<optional-application-uuid>` | Current active `FACULTY` or compatible `PANELIST`, exact active profile, password-ready, valid configured `essay.evaluate`. Returns `{ items, nextCursor }`; each item has `applicationId`, `applicant: { firstName, lastName, pinnacleApplicantId }`, `programName`, nullable `examDate`, `finalizedAt`, `status: PENDING`. |
| Pending detail | GET `/exam/essay-evaluations/:id` | Same current Faculty authority and pending predicate. Queue context plus `questionId`, Applicant-safe frozen `question`, `responseText`, `responseState` (MISSING/BLANK/SUBMITTED), and captured `maximumScore`. |
| Immutable grade | POST `/exam/essay-evaluations/:id/grade` | Same authority revalidated after write locks; only `{ essayScore: number }`. Returns only `applicationId`, `status: COMPLETED`, persisted `essayScore`, `maximumScore`, bounded `evaluator: { id, firstName, lastName }`, and `evaluatedAt`. |
| Exact pending essay image | GET `/exam/essay-evaluations/:id/media/:mediaId/content` | Same current Faculty authority and pending predicate; requested media must be the exact IMAGE stimulus on that frozen essay and belong to its recorded revision. Returns validated PNG/JPEG bytes, safe generic filename, no-store and nosniff headers. |

The queue scans at most 50 candidates per page with a 51st-row lookahead, ordered by application ID. The only coarse predicates are TAKEN, PENDING score and optional cursor. Every emitted row passes the actual B7 pending resolver. Invalid candidates consume scan positions but never appear as work; `nextCursor` permits reaching later valid rows even when a scan page has no valid items. Clients must follow the cursor until null before treating the entire workload as exhausted. No Program predicate, Faculty office/affiliation, evaluator assignment or Program-specific grant participates in authority.

Reads use a consistent REPEATABLE READ transaction, with a fresh actor/grant read before evidence queries. IDs are validated; guessed missing IDs return 404, and non-pending/corrupt evidence fails closed. All successful projections are explicit allowlists with `Cache-Control: private, no-store`. Queue exclusions catch controlled B7 evidence errors; unexpected database errors fail the request rather than becoming successful empty work.

Authorization reuses the existing configured-account resolver/catalog. `ESSAY_ACTOR_SELECT` selects the current User activity, identity, password readiness, exact profile ID/userId/activity, grant collection and access category. Missing, mismatched or inactive profiles, inactive Users, required password change, unknown/duplicate/malformed/wrong-category grants and Administrator metadata on academic accounts deny. Applicant, Student, CUSTOM, Restricted Admin and Full Admin deny. External status is neither queried nor used to deny essay access; valid explicitly granted External Faculty work normally. JWT role/grant claims, email, frontend data and Program are never authorization inputs.

No Faculty essay grant authorizes broad Applicant/Student/COR/Waiver/Question Bank/document/dashboard reads, MCQ editing, result finalize/reconsideration, scheduling/Start Now or email. Existing administrative routes retain their separate guards. Tests exercise Faculty denial at the actual broad Exam Record/finalize/reconsider/email routes and both Full/Restricted denial at Faculty and legacy grade routes.

### Dormant composition and legacy Admin denial

`FACULTY_ESSAY_EVALUATION_ENABLED` is code-owned **false**. The normal Faculty API/service/repository returns controlled 503 without a live grant workflow. Constructor injection is an internal synthetic-test/future-composition seam only; there is no request, environment, Settings, database or JWT activation switch. No real evaluator was provisioned.

The existing `/exam/scores/:id/grade` route still declares `excludeExamAdministrationAction("ESSAY_EVALUATION")`. ExamService and ExamRepository also retain their existing Exam Administration exclusion. Additionally, their new `assertLegacyAdminGrading()` guard denies that legacy writer whenever the Faculty essay target is composed, even if the older Exam Administration gate is still off. This prevents accidental academic Admin authority or the old application-first writer coexisting with the new target solely because activation gates differ. When both targets remain dormant, accepted legacy compatibility is unchanged. Full enumeration never acquires the Faculty essay capability.

## B7/B8 evidence and immutable writing

`requireEssayReview()` is unchanged. `requirePendingEssayReview()` delegates to it and requires PENDING, rejecting completed evaluation and stray partial B8 scoring metadata. The same helper governs queue, detail, media entitlement and the write path. This is not a second reconstruction of B7 rules.

B7 still establishes exact finalization receipt/reason/timing/count evidence, TAKEN application plus existing PENDING/null-total score, recorded B4 binding, exact B2 revision, exactly one essay, exact finalized essay answer representation, captured positive maximum and all-null pending evaluation tuple. Missing/null/blank responses retain their distinct meanings and exact text; no answer or score is fabricated. Completed and partial tuples, corrupt response representation, legacy/terminal/non-finalized attempts and invalid frozen content remain unavailable. Queue prefilters alone never make a record gradeable.

The existing locked B7 mutation was extracted into `writeLockedEssayEvaluation()`, shared by the legacy and new paths. It retains finite nonnegative JSON-number validation, captured maximum bound, DECIMAL(65,30) fractional precision validation, immutable first evaluation, server-derived evaluator and timestamp, and B7 reread after writing. Zero and supported fractions remain valid; all repeated/regrade attempts reject regardless of actor or identical score.

The helper writes only `essayScore`, `gradedById`, `essayEvaluatedAt`, then invokes the existing **unchanged** `scoreLockedApplication()` inside the same transaction. B8's frozen MCQ answers/keys, captured scoring configuration, percentage threshold, exact Decimal arithmetic and immutable result basis remain authoritative. No scoring formula or PASS/FAIL implementation was added or replaced. Faculty receives only the narrow completion receipt; the internal B8 result never reaches its API. Historical Admin grades/IDs/times are not rewritten, and ordinary Admin history remains under its own authorization.

One supporting malformed-content guard was required in `ExamQuestionSetRepository.checkedContent`: null/non-object frozen content or a missing/malformed options collection now produces a controlled evidence rejection before projection, rather than a TypeError. No valid frozen content is modified and no eligibility requirement is relaxed. Its focused regressions cover malformed content, null content and malformed frozen options. The shared B2/B4/B7 regressions pass.

### Locks, revocation and contention

The Faculty grade transaction is explicitly READ COMMITTED, with bounded transaction wait/timeout. Order:

1. Acquire the existing `administrator_access_lock` sentinel (exact id 1; absent sentinel is 503).
2. Lock evaluator User, then its exact academic profile, matching the accepted Faculty access/status writer order.
3. Reload current User/profile/access and revalidate the configured grant **after all waits**.
4. Lock the exact application and reread the canonical pending B7 evidence.
5. Write the first evaluation, execute B8, and commit together.

Holding the same access-change fence prevents a concurrent authorized grant/status writer from committing a revocation between validation and grade commit. If revocation/activity/credential/identity change commits while a grader is waiting for the fence, its fresh transactional read denies. Application serialization preserves one winner and one conflict for competing academic evaluators; original score/evaluator/time survive repeated attempts. A failure during B8 rolls back evaluation and scoring together.

Executed controlled transaction tests prove the modeled ordering, post-wait revalidation for grant/User/profile/password/identity changes, distinct FACULTY/PANELIST competing graders, immutable repeats and rollback behavior. These are **not real InnoDB contention proof**.

The opt-in `faculty-12-essay-contention.test.ts` reuses the existing isolated-server validator and committed-migration harness conventions. It requires explicit `FACULTY_12_DB_TEST=1` and `FACULTY_12_DB_SERVER_URL`, a local server-only URL on a **different port** from the application DATABASE_URL, and creates only a regex-validated UUID-named disposable schema. It never connects to the application schema/server. Five cases cover real grant/User/profile revocation while a second connection waits on the actual fence (observed via SHOW FULL PROCESSLIST), distinct authorized graders, and a trigger-induced post-evaluation B8 rollback. Cleanup validates exact schema and workspace temporary directory identity before removal.

**Real database status: safely SKIPPED, 5 cases.** No separate isolated test server was explicitly configured. The ordinary application database was not used for contention, migrations, fixtures or grants. The harness is committed for later isolated execution, but its real locking/rollback behavior is not claimed as verified here. Existing B7/B8 real-DB harnesses were not pointed at the ordinary app database.

## Exact changed files

Production backend (11):

- `backend/src/access/faculty-essay-authorization.ts`
- `backend/src/controllers/faculty-essay-evaluation.controller.ts`
- `backend/src/repositories/exam-essay-evaluation.writer.ts`
- `backend/src/repositories/faculty-essay-evaluation.repository.ts`
- `backend/src/repositories/exam-question-set.repository.ts`
- `backend/src/repositories/exam.repository.ts`
- `backend/src/routes/faculty-essay-evaluation.routes.ts`
- `backend/src/routes/exam.routes.ts`
- `backend/src/services/faculty-essay-evaluation.service.ts`
- `backend/src/services/exam-media.service.ts`
- `backend/src/services/exam.service.ts`

Focused/affected verification (7):

- `backend/tests/unit/repositories/faculty-12-essay-evaluation.test.ts`
- `backend/tests/unit/routes/faculty-12-essay-evaluation.routes.test.ts`
- `backend/tests/integration/faculty-12-essay-contention.test.ts`
- `backend/tests/unit/routes/exam-essay-evaluation.routes.test.ts`
- `backend/tests/unit/routes/exam-result.routes.test.ts`
- `backend/tests/unit/routes/exam-media.routes.test.ts`
- `backend/tests/unit/services/exam-media.service.test.ts`

Documentation (3):

- `docs/superpowers/reports/2026-11-09-faculty-12-essay-evaluation-backend.md`
- `docs/superpowers/plans/2026-11-08-faculty-admin-access-implementation.md`
- `docs/superpowers/GSIS_IMPLEMENTATION_CHECKLIST.md`

## Verification commands and results

All test/build commands ran from `backend`; diff checks from repository root. Counts overlap; they are not summed as independent evidence.

| Check | Actual result |
| --- | --- |
| Smallest new suite: `npm test -- --run tests/unit/repositories/faculty-12-essay-evaluation.test.ts` | Initial 135/136 passed; malformed frozen options raised TypeError, fixed by the bounded evidence guard above. |
| New repository/service and HTTP suites together | Initial 181 passed after the content guard. Later added identity, media and independently gated Admin-denial coverage. |
| Final directly changed grade/authority subset: `npm test -- --run tests/unit/repositories/faculty-12-essay-evaluation.test.ts tests/unit/routes/faculty-12-essay-evaluation.routes.test.ts tests/unit/routes/exam-essay-evaluation.routes.test.ts tests/unit/services/faculty-6-exam-boundaries.test.ts --maxWorkers=4` | 4 files / 323 tests PASS. |
| Final affected regression command below | 23 files / **916 tests PASS**, 1 isolated integration file / **5 tests SKIPPED**, zero failures. |
| `npm run build` | PASS after final production changes. |
| `git diff --check` | PASS. |
| Frontend typecheck/lint/build | Not run; no frontend files changed. |
| Browser/manual QA | NOT EXECUTED; backend-only package. |
| Hosted CI | NOT OBSERVED; no hosted PASS claimed. |

The affected selection is deliberately broader than the new suites because the change touches an academic write, shared frozen-content validation, the media integrity reader and the shared B7 writer. It includes B7/B8, exact arithmetic/result publication, current capability resolver/catalog, target Admin exclusions, existing Faculty grant management and directly related B2/B4/record/media regressions. No unrelated full-repository sweep.

```powershell
npm test -- --run tests/unit/repositories/faculty-12-essay-evaluation.test.ts tests/unit/routes/faculty-12-essay-evaluation.routes.test.ts tests/unit/routes/exam-essay-evaluation.routes.test.ts tests/unit/routes/exam-result.routes.test.ts tests/unit/routes/exam-media.routes.test.ts tests/unit/repositories/exam-result.repository.test.ts tests/unit/repositories/exam-record.repository.test.ts tests/unit/repositories/exam-question-set.repository.test.ts tests/unit/repositories/exam-execution.repository.test.ts tests/unit/services/exam-result-scoring.rules.test.ts tests/unit/services/exam-result.service.test.ts tests/unit/services/exam-result-email-queue.test.ts tests/unit/services/exam-record-detail.service.test.ts tests/unit/services/exam-media.service.test.ts tests/unit/services/exam-essay-evaluation-ui.contract.test.ts tests/unit/routes/faculty-6-exam-administration.routes.test.ts tests/unit/services/faculty-6-exam-boundaries.test.ts tests/unit/repositories/faculty-6-frozen-results.test.ts tests/unit/services/faculty-10-configuration.test.ts tests/unit/access/account-access.test.ts tests/unit/access/account-access.store.test.ts tests/unit/access/capability-catalog.test.ts tests/unit/access/exam-administration-authorization.test.ts tests/integration/faculty-12-essay-contention.test.ts --maxWorkers=4
npm run build
# repository root
git diff --check
```

The first affected run found 86 failures in three old B7/result/media HTTP files. A controlled baseline comparison temporarily restored the four affected production files at that point from starting HEAD, ran the unchanged three test files, then restored all implementation edits in a finally block. The untouched baseline reproduced **86 failures / 15 passes**. Those tests lacked FACULTY-2 current-account fixtures and expected obsolete invalid-token 403. Their test database delegates now provide explicit current synthetic accounts, separate from the B7 locked-evaluator fixture; invalid tokens correctly expect 401. Production authentication was not weakened and business assertions were retained. The three restored regression files then passed all **101 tests** and are included in the final 916-test selection. The existing Vite CommonJS/native-loader warning remains unchanged.

Cross-Program tests show the same configured evaluator sees valid pending rows for two different Programs and verify no Program predicate is sent to the queue query. Other executed cases cover legacy academic identity, External Faculty, all denied actor categories and malformed grants, pending/corrupt/finalized evidence, exact frozen prompt and response, missing/blank answers, captured maximum, safe DTOs, strict body/precision/zero/fractions, raw identity/grant JWT tampering, immutable completion, protected image bytes and separate Admin authority.

## Preserved scope and stop

No schema/migration, frontend, scoring formula, Program evaluator mapping, Program Chair, evaluator assignment/load policy, real provisioning/grant activation, result-email integration, new rubric/remarks, regrading, academic override or FACULTY-13+ work. No ordinary database changes or live activation. No merge to `main`. Independent remote commit-diff/source review is complete. The live `feat/faculty-admin-access` branch was verified at `c0059b9ebd0de569bb07d34a224506e0aa44f779` during review. Stop after FACULTY-12; FACULTY-13 remains deferred / not started pending explicit project-owner approval.


## Independent-review acceptance — 2026-11-09 (Asia/Manila)

Independent remote commit-diff/source review is complete for FACULTY-12 commit `c0059b9ebd0de569bb07d34a224506e0aa44f779`. The live `feat/faculty-admin-access` branch was verified at that exact implementation SHA. The pushed range from `248d4665923cdcbe95510951247f536e877e583b` contains one commit and exactly 21 changed files.

The review verified the new narrow Faculty queue/detail/grade and frozen-essay media endpoints; current active FACULTY or legacy-compatible PANELIST identity; active matching profile; password readiness; exact configured `essay.evaluate` grant; External Faculty compatibility; and denial of Student, Applicant, CUSTOM and Admin actors. The shared `resolveConfiguredAccountAccess()` rejects inactive User/profile and malformed, duplicate, unknown or wrong-category grant state before the Faculty grant can resolve.

Queue, detail, media entitlement and grade all reuse `requirePendingEssayReview()`, which delegates to the accepted B7 `requireEssayReview()` frozen-evidence resolver. The review confirmed that the queue's coarse TAKEN/PENDING predicates do not themselves confer eligibility, invalid evidence is excluded, guessed IDs cannot bypass detail/write eligibility, and the same exact frozen prompt/response/captured maximum is used. The exact essay image path is bound to the pending frozen essay's image ID and revision and reuses the existing managed-storage integrity checks.

The B7 evaluation write is shared through `writeLockedEssayEvaluation()`; the existing B8 `scoreLockedApplication()` remains unchanged and runs in the same transaction. The Faculty receipt is narrow and excludes MCQ/result/scoring breakdowns. The grade transaction acquires the shared Administrator access fence, then evaluator User/profile locks, revalidates current authority after waits, locks the application, rereads B7 evidence, writes the immutable first evaluation, invokes B8 and commits atomically. The legacy Admin route/service/repository remain excluded when the Faculty target is composed; while all rollout gates remain dormant, accepted legacy compatibility remains unchanged.

No acceptance-blocking authorization, frozen-evidence, scoring, privacy or scope issue remained. No schema/migration, frontend, Program evaluator mapping, real grant provisioning, result-email integration, live activation or FACULTY-13+ work was included.

Evidence classes remain separate. Codex reported 23 affected suites / 916 tests passed, five real MariaDB contention cases safely skipped, backend build PASS and diff checks PASS. The independent review inspected the pushed production source, tests and isolated contention harness; it did not execute the Windows test commands or run real InnoDB contention. The five-case real MariaDB harness remains **unverified** because no separate isolated server was configured. This is an explicit deployment/activation-readiness gate: do not claim the lock-race proof until the isolated harness is executed. GitHub hosted CI was not observed; browser/manual QA was not applicable to this backend-only package.

**Acceptance checkpoint:** FACULTY-12 is accepted for continuation at `c0059b9ebd0de569bb07d34a224506e0aa44f779`. The Faculty Essay Evaluation target remains code-owned/dormant and no live evaluator grants are activated. FACULTY-13 remains deferred / not started pending explicit project-owner approval.
