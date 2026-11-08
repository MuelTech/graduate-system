# FACULTY-6 — Examination administrative guards

Date: 2026-11-08 (Asia/Manila). Status: **FACULTY-6 implemented / pending independent review**.

## Verified starting state and authorities

- Repository `MuelTech/graduate-system`; existing branch `feat/faculty-admin-access`.
- Fetched feature branch and main before implementation. Local/fetched feature HEAD: `0ad28910f67b7b584f01ccc4a9e931f298f0656d`.
- Local/fetched main: `045316540d97364214792c7d441ae20a1e426d4c`.
- Tree/index clean; local/remote feature drift `0 0`; `origin/main...HEAD` drift `0 14`. No fast-forward necessary.
- No new branch, merge, rebase, reset, history rewrite or force-push.
- Current Faculty/Admin canonical source, design, audit, plan, checklist and Engineering Verification Policy apply. FACULTY-1 through FACULTY-5 accepted prerequisites are preserved. Read the accepted Phase-B plan, content source of truth, B3/B4 contracts, B8/B9 owner policies and final B10 non-email acceptance. No accepted examination policy is reopened.

## Complete endpoint and alias inventory

All paths include the application's `/api` mount. This inventory has **32 mapped Admin surfaces plus 2 explicitly excluded legacy actions**. The shared media GET uses an Admin capability only for its current ADMIN branch; Applicant execution ownership/revision authority remains separate.

| Method | Exact endpoint | Target capability / policy |
| --- | --- | --- |
| GET | `/api/exam/slots` | `exam.schedules.view` |
| GET | `/api/exam/slots/:id/bookings` | `exam.schedules.view` |
| GET | `/api/exam/assignment-options/:studentId` | `exam.schedules.view` |
| GET | `/api/exam/applications/:id/amendment-options` | `exam.schedules.view` |
| GET | `/api/exam/appeals` | `exam.schedules.view` |
| POST | `/api/exam/slots` | `exam.schedules.manage` |
| PUT | `/api/exam/slots/:id` | `exam.schedules.manage` |
| PATCH | `/api/exam/slots/:id/status` | `exam.schedules.manage` |
| POST | `/api/exam/assignments` | `exam.schedules.manage` |
| POST | `/api/exam/applications/:id/missed-appeal/approve` | `exam.schedules.manage` |
| POST | `/api/exam/applications/:id/missed-appeal/reject` | `exam.schedules.manage` |
| POST | `/api/exam/applications/:id/reschedule` | `exam.schedules.manage` |
| POST | `/api/exam/applications/:id/cancel-appointment` | `exam.schedules.manage` |
| PATCH | `/api/exam/appeals/:id/approve` | `exam.schedules.manage` |
| PATCH | `/api/exam/appeals/:id/reject` | `exam.schedules.manage` |
| GET | `/api/exam/applications` | `exam.records.view` |
| GET | `/api/exam/applications/:id` | `exam.records.view` |
| GET | `/api/exam-engine/admin/applications/:applicationId/execution` | `exam.records.view` |
| POST | `/api/exam-engine/admin/applications/:applicationId/start-authorization` | `exam.starts.authorize` |
| POST | `/api/exam/scores/:id/finalize` | `exam.results.finalize` |
| POST | `/api/exam/applications/:id/reconsider-result` | `exam.results.reconsider` |
| GET | `/api/exam-engine/admin/questions` | `exam.questions.view` |
| GET | `/api/exam-engine/admin/question-set` | `exam.questions.view` |
| GET | `/api/exam-engine/media/:mediaId` | `exam.questions.view` |
| POST | `/api/exam-engine/admin/questions` | `exam.questions.manage` |
| PUT | `/api/exam-engine/admin/questions/:id` | `exam.questions.manage` |
| DELETE | `/api/exam-engine/admin/questions/:id` | `exam.questions.manage` |
| POST | `/api/exam-engine/admin/media` | `exam.questions.manage` |
| PUT | `/api/exam-engine/admin/question-set` | `exam.questions.manage` |
| POST | `/api/exam-engine/admin/question-set/publish` | `exam.questions.manage` |
| GET | `/api/exam-engine/admin/configuration` | `exam.configuration.manage` |
| PUT | `/api/exam-engine/admin/configuration` | `exam.configuration.manage` |
| POST | `/api/exam/scores/:id/grade` | **Excluded**: academic essay evaluation; enabled target denies all Admins |
| POST | `/api/exam/scores/:id/send-email` | **Excluded**: deferred result email; enabled target denies all Admins |

Legacy `PATCH /api/exam/appeals/:id/approve` and `/reject` remain retired compatibility responses after authorization (existing service 409 remains the legacy controller's HTTP 400); they are not revived as alternate B9 mutations. Other Admin aliases use their exact original method/path. Applicant-only routes and retired implicit Applicant execution URLs receive no administrative capability.

## Explicit excluded actions

- `POST /api/exam/scores/:id/grade`: academic essay evaluation, not Exam Administration. Enabled composition denies all administrative accounts, including Full and every Exam capability. No Admin `essay.evaluate` grant is accepted. Both `ExamService.gradeEssay` and `ExamRepository.gradeEssay` independently enforce the exclusion before the grading transaction. The existing dormant B7 grading code and its current actor check are preserved. No Faculty queue/evaluation implementation or grading-policy change.
- `POST /api/exam/scores/:id/send-email`: deferred Email Integration action. Enabled composition denies it, including Full; both service and repository queue entry enforce the exclusion before enqueue/transaction work. No email capability, template, recipient policy, queue/delivery change or readiness certification. Dormant legacy behavior remains; the separately tracked integration limitation is not represented as fixed.

## Code-owned dormant composition

`EXAM_ADMINISTRATION_CAPABILITY_ENFORCEMENT_ENABLED=false` is the bounded FACULTY-6 default. No environment variable, request field, JWT capability/role claim, frontend toggle or stored setting enables it. Constructors accept an internal authorization dependency for synthetic tests/future controlled composition. The exported production singleton uses only the dormant default. Existing global direct-access, Administrator management and FACULTY-5 switches remain unchanged/off.

Dormant assertions do no new account/fence reads and preserve current legacy ADMIN development behavior. FACULTY-2 authentication continues to load current identity, activity and credential state before role checks. No existing Admin is implicitly mapped to Full. No account bootstrap/mapping/provisioning, live Restricted access or global activation occurred.

Enabled enforcement reloads server account state using FACULTY-2 `loadCurrentAccount` and FACULTY-1 configured-access resolution. Full receives the explicitly enumerated administrative catalog; Restricted receives validated direct keys plus existing prerequisites. Missing/invalid level, unknown/duplicate/wrong-category grants, missing actor, inactive/non-ADMIN/credential-gated identities deny. No JWT/body capability or target User ID supplies authority. Caller role is independently resolved for shared private-media access, so a supplied ADMIN role cannot bypass the actual Applicant ownership/revision path.

Catalog prerequisites are unchanged: scheduling manage supplies scheduling view; question manage supplies question view; Start Now, finalize and reconsider each supply record read. Finalization and reconsideration do not supply each other. Scheduling does not supply `applicants.view` or a broad registry. Configuration's one accepted manage key owns both current read and replace.

## Route and business enforcement

Routes declare stable business keys after authentication/current role validation. Media-upload capability middleware precedes `secureUpload`, including temporary directory creation and permanent promotion. Controllers forward authentication-derived actor IDs separately from target/body data. Services independently reauthorize administrative reads/writes. Repositories enforce the same rule where controllers call them directly, and at existing transaction-owned business boundaries. Existing active-ADMIN transaction checks remain as legacy safeguards alongside enabled capability checks.

| Existing interactive transaction / operation | Fresh target authorization before workflow reads/locks/writes |
| --- | --- |
| B3 Admin assignment | `exam.schedules.manage` before existing Student → Slot ordering; Applicant self-booking does not acquire the Admin fence |
| Slot edit / close-reopen | `exam.schedules.manage` before existing Slot lock/capacity checks |
| B4 Start Now | `exam.starts.authorize` before existing Student → Slot → Application ordering |
| B9 approve/reject missed appeal, Admin reschedule/cancel | `exam.schedules.manage` before preliminary identity read, then original Student → sorted Slot(s) → Application ordering |
| B9 amendment options (transactional read) | `exam.schedules.view` through the shared locked helper; same original workflow locks |
| B8 result finalization/recovery | `exam.results.finalize` before exact Application lock and unchanged deterministic scorer |
| B9 result reconsideration | `exam.results.reconsider` before exact Application lock and immutable separate-decision logic |
| Question update/delete | `exam.questions.manage` before original validation/reference/write transaction |
| Question selection/publication | `exam.questions.manage` before original SERIALIZABLE membership/content transaction |

The common target transaction sequence acquires FACULTY-4's existing `administrator_access_lock` singleton, then locks the exact actor User and loads current credential/access/grant state before the owning transaction's first ordinary read. A missing fence denies; no runtime sentinel creation. All authorized FACULTY-4 access writers share that singleton, ordering revocation before authorization or after the protected operation's commit. Existing workflow lock order/isolation and atomic mutation/audit boundaries remain intact. Repeated guard evaluation does not change business rules or create a parallel workflow.

Non-interactive writers retain fresh service/business checks without a new fencing transaction: slot creation (recheck after Program lookup, immediately before create), question creation (service and repository), current configuration replacement (service and repository upsert), and media registration (before validation/storage access and again before its final DB create). Media upload retains existing compensation/cleanup. These single-query/storage workflows do not claim an in-flight revocation guarantee. Existing read-only assignment options, record/detail/execution, bank and configuration entry points recheck current capability at their business entry; no unrelated permission is required for their task context.

Internal primitives remain explicit: B4 reads raw current configuration and exact content binding under its own Applicant execution transaction; it does not require an Admin capability. The operator-only content importer retains `ExamContentImportRepository` and `ExamMediaService.createImage`/compensating discard contracts. No importer route or new authority was introduced.

## Minimum context and workflow preservation

Assignment selection loads only exact target Student ID, Program ID, admission/alignment/Pinnacle eligibility, selected Program identity/name, and necessary User role/name/email. It no longer loads the full Student row. Existing-application queries used for admission/assignment eligibility now select status only. Assignment-options response remains the established bounded Applicant identity/Program/eligibility/slot projection, not Applicant registry access.

Records retain their established safe projections: no bank correctness/answer key/storage metadata or private evaluator draft is added. Finalized essay context/immutable evaluation evidence remains read-only; reading a record does not grant academic evaluation. Admin media requires question read; Applicant media still uses exact current owner/started execution/deadline/bound revision membership, with confidential headers, byte validation and checksums unchanged.

B3 capacity/Manila dates, copied appointments, registered-Applicant eligibility, booking/assignment and amendment rules remain intact. Start Now records its original responsible actor/time and never starts the timer; only Applicant Start freezes content/config and calculates actual start/deadline. Existing drafts/final submission/expiry authority is unchanged. B8 keeps automatic MCQ and exact decimal frozen scoring; pending essay remains pending, not FAILED. B9 adds one separate `PASSED_RECONSIDERED` decision with reason/actor/time and leaves original FAILED status, score, basis and scoring timestamp unchanged. Current configuration/content changes do not rewrite started attempts or managed results.

## Verification and safe database skip

| Evidence class | Result |
| --- | --- |
| Focused final command below | **25 files / 718 tests PASS** |
| New FACULTY-6 behavior tests, counted once within the above | **173 tests PASS** across four new test files plus eight storage/controller cases added to affected existing suites |
| Final minimum-context/affected seam check | **3 files / 190 tests PASS** |
| Final controller denial/compatibility checks | **1 file / 46 tests PASS** |
| Backend `npm run build` after final production edits | PASS |
| `git diff --check` | PASS |
| Schema/migrations/frontend diff | Empty; no changes |
| Full backend suite / frontend tests/build | NOT RUN; bounded requested verification budget |
| Manual/browser QA / hosted CI / independent review | NOT EXECUTED / NOT EXECUTED / pending |
| Real database contention suites | Safely NOT EXECUTED; no isolated server configured |

The 25-file run includes actual JWT/current-account route authorization (with domain handlers isolated), real service/repository capability and transaction checks, actual private media promotion/cleanup, targeted B3–B9 lifecycle/content/config/result rules, original result-email compatibility containment and Applicant answer/execution regressions. Tests assert Full/exact-key/absent/unrelated authority across every mapped alias; view-only mutation denial; malformed/current/revoked/credential state; stale JWT/body escalation; all excluded actions for Full/every Admin Exam key; direct business-call denial; 14 real mutation-entry fence/revocation checks; Start Now timing/lock order; frozen B8 recovery and B9 decision preservation. Positive transactional seam tests deliberately reach retained domain authority rather than replacing business rules with permissive stubs. Synthetic account/transaction tests are not real InnoDB proof.

Initial focused runs exposed obsolete pre-FACULTY-2 HTTP account fixtures plus actor-forwarding/minimum-projection test expectations. Affected legacy execution/amendment/media-upload tests now explicitly supply current-account test snapshots and expect 401 for invalid tokens; their real workflow/current-actor repository checks are retained. New authorization HTTP tests use the real current-account loader with synthetic persistence, independently testing stale/malformed/revoked access. No production authentication check was weakened and no failing expectation was skipped/inverted to conceal a defect. The final focused runs have no failures or skips.

Read-only configuration inspection found application database `localhost:3306` and no isolated test-server URL. No real DB suite was opted in, and no scratch schema, migration, seed, reset or destructive connection was attempted on XAMPP. Existing exam contention harnesses can default to the application server; they were not invoked in destructive mode. Real shared-fence/workflow-lock contention and rollback remain a deployment-readiness limitation, including throughput from serializing protected Admin mutations behind the shared singleton.

Commands executed from `backend` (final evidence; earlier exploratory runs are superseded):

```text
npm test -- tests/unit/access/exam-administration-authorization.test.ts tests/unit/routes/faculty-6-exam-administration.routes.test.ts tests/unit/services/faculty-6-exam-boundaries.test.ts tests/unit/repositories/faculty-6-frozen-results.test.ts tests/unit/services/exam-schedule.service.test.ts tests/unit/services/exam-result.service.test.ts tests/unit/services/exam-record-detail.service.test.ts tests/unit/services/exam-engine-content.service.test.ts tests/unit/services/exam-media.service.test.ts tests/unit/services/exam-media-access.test.ts tests/unit/repositories/exam-execution.repository.test.ts tests/unit/repositories/exam-result.repository.test.ts tests/unit/repositories/exam-question-set.repository.test.ts tests/unit/repositories/exam-engine.repository.test.ts tests/unit/repositories/exam-record.repository.test.ts tests/unit/repositories/exam-configuration.repository.test.ts tests/unit/routes/exam-amendment.routes.test.ts tests/unit/routes/exam-execution.routes.test.ts tests/unit/routes/exam-media-upload.routes.test.ts tests/unit/services/exam-result-scoring.rules.test.ts tests/unit/services/exam-configuration.rules.test.ts tests/unit/services/exam-schedule-time.test.ts tests/unit/repositories/exam-media.repository.test.ts tests/unit/repositories/exam-answer.repository.test.ts tests/unit/services/exam-result-email-queue.test.ts

npm test -- tests/unit/services/exam-schedule.service.test.ts tests/unit/services/faculty-6-exam-boundaries.test.ts tests/unit/routes/exam-execution.routes.test.ts

npm test -- tests/unit/routes/exam-amendment.routes.test.ts

npm run build
```

## Exact changed files

- `backend/src/access/exam-administration-authorization.ts`
- `backend/src/controllers/exam-configuration.controller.ts`
- `backend/src/controllers/exam-engine.controller.ts`
- `backend/src/controllers/exam-execution.controller.ts`
- `backend/src/controllers/exam-media.controller.ts`
- `backend/src/controllers/exam-question-set.controller.ts`
- `backend/src/controllers/exam.controller.ts`
- `backend/src/middlewares/exam-administration-capability.middleware.ts`
- `backend/src/repositories/exam-amendment.repository.ts`
- `backend/src/repositories/exam-configuration.repository.ts`
- `backend/src/repositories/exam-engine.repository.ts`
- `backend/src/repositories/exam-execution.repository.ts`
- `backend/src/repositories/exam-question-set.repository.ts`
- `backend/src/repositories/exam.repository.ts`
- `backend/src/routes/exam-engine.routes.ts`
- `backend/src/routes/exam.routes.ts`
- `backend/src/services/exam-configuration.service.ts`
- `backend/src/services/exam-engine.service.ts`
- `backend/src/services/exam-media.service.ts`
- `backend/src/services/exam.service.ts`
- `backend/tests/fixtures/exam-administration-endpoints.ts`
- `backend/tests/unit/access/exam-administration-authorization.test.ts`
- `backend/tests/unit/repositories/faculty-6-frozen-results.test.ts`
- `backend/tests/unit/routes/exam-amendment.routes.test.ts`
- `backend/tests/unit/routes/exam-execution.routes.test.ts`
- `backend/tests/unit/routes/exam-media-upload.routes.test.ts`
- `backend/tests/unit/routes/faculty-6-exam-administration.routes.test.ts`
- `backend/tests/unit/services/exam-engine-content.service.test.ts`
- `backend/tests/unit/services/exam-schedule.service.test.ts`
- `backend/tests/unit/services/faculty-6-exam-boundaries.test.ts`
- `docs/superpowers/GSIS_IMPLEMENTATION_CHECKLIST.md`
- `docs/superpowers/plans/2026-11-08-faculty-admin-access-implementation.md`
- `docs/superpowers/reports/2026-11-08-faculty-6-examination-administrative-guards.md`

## Delivery and stop

No schema/migration or frontend/UI change. No live Administrator mapping/bootstrap/Restricted provisioning/activation, Faculty Essay Evaluation implementation, outside-exam file/Defense/settings guard, scoring/policy redesign or FACULTY-7 work. No implementation blocker or scope deviation; real DB contention and independent review remain explicit limitations. Plan/checklist state is **FACULTY-6 implemented / pending independent review**, not accepted.

Commit/push only FACULTY-6 to the existing feature branch. Final commit SHA and clean local/live-remote parity are reported after delivery to avoid a self-referential commit hash. Stop after delivery; do not activate Restricted access, implement Faculty Essay Evaluation or begin FACULTY-7.


## Bounded independent-review correction — Exam Records list projection

Independent review found that `ExamRepository.getAllApplications()` used over-broad application/User/Student relations and spread internal fields into `GET /api/exam/applications`. This correction narrows that list only to an explicit Prisma selection and deliberate response DTO. The response contains `id`, `status`, `student.pinnacleApplicantId`, `student.user.{firstName,lastName,email}`, `program.{id,programName}`, `slot.{examDate,examTime}`, `reconsidered` and `essayEvaluationCompleted`. Credentials/internal account fields (including `passwordHash`, `mustChangePassword`, `customRoleId`, `createdById`, `updatedById`), raw score/decision objects and internal evaluation evidence are not exposed. Existing flag predicates, record detail, capability mapping, ordering and B3–B10 business rules are unchanged.

Fetched/verified starting feature HEAD `7fd57d941309170612c72941e50eb308eaf1cfff` and main `045316540d97364214792c7d441ae20a1e426d4c`; tree/index clean, feature local/remote drift `0 0`, main/feature drift `0 15`. No branch/history operation or fast-forward was needed. Correction files only:

- `backend/src/repositories/exam.repository.ts`
- `backend/tests/unit/repositories/exam-record.repository.test.ts`
- `docs/superpowers/reports/2026-11-08-faculty-6-examination-administrative-guards.md`

Focused correction command (from `backend`): `npm test -- tests/unit/repositories/exam-record.repository.test.ts tests/unit/routes/faculty-6-exam-administration.routes.test.ts tests/unit/services/faculty-6-exam-boundaries.test.ts tests/unit/services/exam-record-detail.service.test.ts` — **4 files / 162 tests PASS**. Tests inspect the selected field allowlists and returned DTO, including overfilled persistence results; flag regressions also apply the actual Prisma select before calculation to catch missing internal evidence. Backend `npm run build` and `git diff --check` — **PASS**. No full suite, frontend build or real-DB contention run; no lock/write/schema/migration/frontend change. No live access activation or FACULTY-7 work. FACULTY-6 remains **implemented / pending independent review**; acceptance is not asserted.
