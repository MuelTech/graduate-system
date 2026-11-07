# FACULTY-5 — Admission and Student administrative guards

Date: 2026-11-08 (Asia/Manila). Status: **FACULTY-5 implemented / pending independent review**.

## Verified starting state

- Repository `MuelTech/graduate-system`; existing branch `feat/faculty-admin-access`.
- Fetched `origin feat/faculty-admin-access main` before implementation. Local/fetched feature HEAD both `0b61e445ee944edcb365fc7b2559b8bd1364a54f`.
- Local/fetched main both `045316540d97364214792c7d441ae20a1e426d4c`.
- Tree/index clean; local vs remote drift `0 0`; `origin/main...HEAD` drift `0 12`. No fast-forward necessary.
- No branch creation, merge, rebase, reset, force-push or history rewrite.
- Read current canonical Faculty/Admin source of truth, design, audit, implementation plan, relevant checklist and Engineering Verification Policy. FACULTY-1 through FACULTY-4 acceptance and rollout limits remain intact.

## Exact endpoint inventory and capability mapping

All paths below include the application's `/api` mount. No additional administrative waiver read alias exists in these routers. Applicant detail remains an Applicant read, not a waiver-only read alias.

| Method | Exact path | Capability | Protected business entry |
| --- | --- | --- | --- |
| GET | `/api/admin/applicants` | `applicants.view` | `AdminApplicantService.listApplicants` |
| GET | `/api/admin/applicants/:id` | `applicants.view` | `AdminApplicantService.getApplicantDetail` |
| PUT | `/api/admin/applicants/:id/waiver/validate` | `waivers.manage` | `AdminApplicantService.validateWaiver` |
| PUT | `/api/admin/applicants/:id/waiver/reject` | `waivers.manage` | `AdminApplicantService.rejectWaiver` |
| GET | `/api/waivers` | `waivers.view` | `WaiverService.getAdminQueue` |
| PUT | `/api/waivers/:id/validate` | `waivers.manage` | `WaiverService.validateWaiver` → existing repository transaction |
| PUT | `/api/waivers/:id/reject` | `waivers.manage` | `WaiverService.rejectWaiver` |
| GET | `/api/cor/pending` | `cor.view` | `CorService.getPendingUploads` |
| POST | `/api/cor/verify/:id` | `cor.verify` | `CorService.verifyCor` → canonical `verifyAndPromote` transaction |
| POST | `/api/cor/reject/:id` | `cor.verify` | `CorService.rejectCor` → canonical `rejectUpload` transaction |
| PUT | `/api/admin/applicants/:id/cor/verify` | `cor.verify` | `AdminApplicantService.verifyCor` → same canonical COR authority |
| PUT | `/api/admin/applicants/:id/cor/reject` | `cor.verify` | `AdminApplicantService.rejectCor` → same canonical COR authority |
| PUT | `/api/admin/applicants/:id/promote` | `cor.verify` | Existing read-only/idempotent `promoteToStudent` compatibility operation |
| GET | `/api/admin/students` | `students.view` | `AdminStudentService.listStudents` |
| GET | `/api/admin/students/:id` | `students.view` | `AdminStudentService.getStudentDetail` |
| GET | `/api/admin/students/:id/journey` | `students.view` | `AdminStudentService.getStudentJourney` → existing exact Student journey evaluator |
| PUT | `/api/admin/students/:id/comprehensive-exam` | `students.comprehensive_exam.manage` | `AdminStudentService.updateCompExamStatus` |
| POST | `/api/student/:id/comprehensive-exam` | `students.comprehensive_exam.manage` | `StudentService.updateCompExam` |

The accepted catalog expands `waivers.manage` → `waivers.view`, `cor.verify` → `cor.view`, and comprehensive management → `students.view`. No registry capability is added to COR/waiver grants. Applicant profile access does not confer Student, COR mutation, waiver mutation, exam-administration or promotion authority. Full resolves only FACULTY-1's enumerated approved administrative catalog; Restricted resolves validated direct keys and catalog prerequisites.

## Guard architecture and dormant boundary

`ADMISSION_STUDENT_CAPABILITY_ENFORCEMENT_ENABLED=false` is a code-owned FACULTY-5 composition boundary. It has no environment-variable, request-body, JWT, frontend or stored-setting activation path. `DIRECT_ACCESS_ENFORCEMENT_ENABLED=false` and `ADMINISTRATOR_MANAGEMENT_ENABLED=false` are unchanged. No live Restricted Administrator is exposed/provisioned and no existing Admin is mapped or silently assigned Full.

Dormant mode deliberately preserves legacy server-resolved ADMIN route behavior. FACULTY-2 still authenticates each request from current account state and rejects inactive, non-ADMIN and password-change-required actors before ordinary administrative controllers. Dormant service/transaction capability assertions return without new access reads or locks; this explicitly retains the existing trusted internal service behavior during the unactivated rollout. It is not a fallback within enabled enforcement.

Enabled mode uses `AdmissionStudentAuthorization` with bounded constructor dependency injection for synthetic tests/future controlled composition. Production uses only its dormant singleton. Routes declare stable capability keys after authentication/current ADMIN checks. Controllers pass authenticated actor IDs separately from target IDs and body data. Each protected business service independently reloads current account state through FACULTY-2 `loadCurrentAccount`, then resolves the FACULTY-1 catalog; no cached grant or preauthorized request snapshot is accepted. Read methods now require an actor argument. Missing actor, unmapped/invalid Admin metadata, invalid/wrong-category/duplicate grants, non-ADMIN, inactive or password-gated actors cannot satisfy target authorization. Controller error handling preserves 403 for newly introduced business denials.

Existing authoritative transactions (COR verify/promote, COR rejection and canonical waiver validation) additionally:

1. Acquire FACULTY-4's existing singleton `administrator_access_lock` before any workflow/Student lock; missing fence denies without target writes.
2. Lock the exact actor User and reload identity, activity, credential state, level and grants from the transaction before its first ordinary read.
3. Require the operation capability, then execute the existing workflow locks, lifecycle/ownership gates, conditional writes and audit.

All authorized FACULTY-4 grant/level/status writers acquire that same singleton first. This orders a pending revocation before the operation's fresh authorization or holds revocation until the authorized operation commits. The existing transactions are retained, not replaced by another admission workflow. Shared fencing serializes these protected mutations when enabled; real InnoDB contention/performance remains a later deployment verification gate. Synthetic tests prove call ordering and denial behavior, not database locking semantics.

The Applicant waiver aliases, canonical waiver rejection and comprehensive recording paths do not already share an authoritative transaction. They receive independent current-actor service checks; their existing transitions, write ordering, audit behavior and known history defects remain unchanged. No new atomicity or in-flight revocation guarantee is claimed for those nontransactional workflows. All aliases use the same catalog capability even where historical workflow behavior differs.

## Minimum exact target context and preservation

Applicant COR aliases/promotion now query only exact Student ID, admission status and Student Number instead of the full Applicant profile/history. Waiver mutation aliases query only exact Student ID and waiver ID/status. Canonical COR preflight queries only upload ID/status/Student ID and the target admission status, User ID and role. It no longer loads target credentials, arbitrary profile data or unrelated histories. These are internal operation contexts, not new read APIs. COR queue retains its existing safe Applicant/COR task projection; no broad Applicant registry access is implied.

Applicant self-registration, Pinnacle ID, COR upload/verification, Student Number, ownership/privacy and Student journey rules are unchanged. Standalone promotion remains the accepted 409 for an unpromoted Applicant and an idempotent read for an already enrolled Student; COR verification remains the sole promotion transaction. Promotion still writes only accepted role/identity fields on the same User and does not replace `passwordHash` or set `mustChangePassword`. Existing continuity regression confirms original-password Student login and false credential-change state. Both comprehensive aliases preserve their existing recording behavior, including separately tracked history/strike defects. No capability permits Applicant/Student self-service impersonation.

## Focused verification

All tests use synthetic repositories/transaction doubles; no destructive database tests, migration rehearsal, seed, database mapping or live account writes were performed.

| Evidence | Result |
| --- | --- |
| New package tests (5 files, counted once) | **102 tests PASS**: 30 authorization/fence, 55 actual HTTP/controller/service, 9 repository boundary, 2 production-dormant HTTP, 6 business preservation |
| First package command below | 2 files / 85 tests PASS |
| Focused regression command below | 19 files / 324 tests PASS |
| Final affected/additional command below | 10 files / 108 tests PASS |
| `npm run build` after final production-source edits | PASS |
| `git diff --check` | PASS |
| Prisma/schema/migration diff | Empty; no schema or migration change |
| Frontend files/build/tests | Unchanged / NOT RUN |
| Full backend suite | NOT RUN; requested focused budget observed |
| Real database contention / manual/browser QA / hosted CI | NOT EXECUTED |
| Independent remote review | Pending; no acceptance claimed |

The test commands overlap; their per-run counts must not be summed as distinct tests. Together they cover 25 distinct focused test files. The matrix exercises all 18 aliases with Full, exact Restricted key and missing key; view-only mutation denial; COR/waiver separation from the Applicant registry; current revocation and stale JWT/body escalation attempts; non-ADMIN/malformed/unmapped/credential-state denial; direct service bypass attempts; transaction actor revalidation before target reads/writes; exact target projection; current waiver/comprehensive behavior; COR lifecycle/atomicity, original-password Student login and Student journey regressions. The dormant HTTP test uses production's actual default guard and retains unmapped legacy ADMIN behavior without inventing Full metadata. Environment strings cannot enable it.

Commands executed from `backend`:

```text
npm test -- tests/unit/access/admission-student-authorization.test.ts tests/unit/routes/faculty-5-admission-student.routes.test.ts

npm test -- tests/unit/repositories/faculty-5-authority-boundary.test.ts tests/unit/services/admin-applicant.cor-delegation.test.ts tests/unit/services/admin-applicant-detail.service.test.ts tests/unit/services/admin-applicant-list.rules.test.ts tests/unit/services/admin-student-detail.service.test.ts tests/unit/routes/admin-student.routes.test.ts tests/unit/services/cor.lifecycle.service.test.ts tests/unit/services/cor-workflow.regression.test.ts tests/unit/services/cor-upload-atomic.service.test.ts tests/unit/repositories/cor.repository.lifecycle.test.ts tests/unit/repositories/cor.repository.atomic.test.ts tests/unit/services/student-thesis-journey.rules.test.ts tests/unit/services/student-thesis-journey.service.test.ts tests/unit/middlewares/auth.middleware.test.ts tests/unit/access

npm test -- tests/unit/routes/faculty-5-dormant.routes.test.ts tests/unit/services/faculty-5-business-regression.test.ts tests/unit/routes/faculty-5-admission-student.routes.test.ts tests/unit/services/admin-applicant.cor-delegation.test.ts tests/unit/services/admin-applicant-detail.service.test.ts tests/unit/services/admin-student-detail.service.test.ts tests/unit/repositories/admin-applicant.repository.test.ts tests/unit/repositories/admin-applicant-detail.repository.test.ts tests/unit/repositories/admin-student.repository.test.ts tests/unit/access/account-access.store.test.ts

npm run build
```

## Exact changed files

- `backend/src/access/admission-student-authorization.ts`
- `backend/src/controllers/admin-applicant.controller.ts`
- `backend/src/controllers/admin-student.controller.ts`
- `backend/src/controllers/cor.controller.ts`
- `backend/src/controllers/student.controller.ts`
- `backend/src/controllers/waiver.controller.ts`
- `backend/src/middlewares/admission-student-capability.middleware.ts`
- `backend/src/repositories/admin-applicant.repository.ts`
- `backend/src/repositories/cor.repository.ts`
- `backend/src/repositories/waiver.repository.ts`
- `backend/src/routes/admin-applicant.routes.ts`
- `backend/src/routes/admin-student.routes.ts`
- `backend/src/routes/cor.routes.ts`
- `backend/src/routes/student.routes.ts`
- `backend/src/routes/waiver.routes.ts`
- `backend/src/services/admin-applicant.service.ts`
- `backend/src/services/admin-student.service.ts`
- `backend/src/services/cor.service.ts`
- `backend/src/services/student.service.ts`
- `backend/src/services/waiver.service.ts`
- `backend/tests/unit/access/admission-student-authorization.test.ts`
- `backend/tests/unit/repositories/faculty-5-authority-boundary.test.ts`
- `backend/tests/unit/routes/admin-student.routes.test.ts`
- `backend/tests/unit/routes/faculty-5-admission-student.routes.test.ts`
- `backend/tests/unit/routes/faculty-5-dormant.routes.test.ts`
- `backend/tests/unit/services/admin-applicant-detail.service.test.ts`
- `backend/tests/unit/services/admin-applicant.cor-delegation.test.ts`
- `backend/tests/unit/services/admin-student-detail.service.test.ts`
- `backend/tests/unit/services/faculty-5-business-regression.test.ts`
- `docs/superpowers/GSIS_IMPLEMENTATION_CHECKLIST.md`
- `docs/superpowers/plans/2026-11-08-faculty-admin-access-implementation.md`
- `docs/superpowers/reports/2026-11-08-faculty-5-admission-student-guards.md`

## Delivery limits and stop

No implementation blocker or scope deviation. No Prisma migration/schema change, frontend work, account bootstrap/mapping, live Restricted provisioning, global activation, exam-administration guard, Defense/file/settings change, permission UI or FACULTY-6 work. FACULTY-5 is implemented / pending independent review; acceptance is not asserted. Generic private files and other unguarded modules remain the owners of later packages, so these source-ready guards do not make the complete Restricted model safe to activate. Real database contention and independent review remain explicit limitations.

Commit/push only this package to the existing `feat/faculty-admin-access` branch. Final commit SHA and local/remote clean parity are reported after delivery to avoid a self-referential commit hash. Then stop; do not start FACULTY-6 or activate live Restricted access.
