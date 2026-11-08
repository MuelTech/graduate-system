# FACULTY-7 — Defense and Adviser administrative guards

Date: 2026-11-08 (Asia/Manila). Status: **implemented / pending independent review**. Not accepted by this implementation report.

## Baseline and scope

- Repository: `MuelTech/graduate-system`; existing branch `feat/faculty-admin-access` throughout.
- Fetched `origin feat/faculty-admin-access main` before implementation.
- Starting local HEAD and verified remote feature HEAD: `d0e867f5acdae3dde36e5bcbd385176f5639f550`.
- Verified remote main: `045316540d97364214792c7d441ae20a1e426d4c`.
- Starting index/worktree clean. Local/remote feature drift `0 / 0`; main/feature `0 / 17` (main is an ancestor). No fast-forward was needed.
- No merge, rebase, reset, new branch, history rewrite or force push. Delivery commit and final clean/parity evidence are provided in the final handoff.

Reviewed authorities: Faculty/Admin source of truth, design and implementation plan; implementation checklist; Engineering Verification Policy; Defense Workflow source of truth (including current Adviser, application review, exact scheduling/correction, session/evaluation, Chairman conclusion and RAP rules); Student Thesis Journey implementation reference; accepted GS-020 official-form plan; accepted DEF-CORR-1 plan; Collaborative Defense Workspace/RAP source of truth. FACULTY-1–6 remain accepted prerequisites.

This package adds administrative access boundaries and write-time identity checks. It does not replace GS-020 or the Defense state machine.

## Complete live Admin endpoint inventory and capability matrix

All paths below include `/api/thesis`. There are **25 capability-mapped endpoints**; no additional live administrative aliases were found in the thesis router. The separate legacy/shared/output inventory below classifies another 15 surfaces. Student and academic routes remain independently authorized and are not aliases for administrative operations.

| Endpoint | Required catalog capability |
| --- | --- |
| `GET /api/thesis/adviser/requests` | `adviser.requests.view` |
| `GET /api/thesis/adviser/requests/dean-review` | `adviser.requests.view` |
| `POST /api/thesis/adviser/requests/:id/dean-response` | `adviser.requests.review` |
| `GET /api/thesis/adviser/assignments` | `adviser.requests.view` |
| `POST /api/thesis/adviser/assign` | `adviser.requests.review` |
| `PUT /api/thesis/defense/:id/status` | `defense.applications.review` |
| `PUT /api/thesis/defense/:id/reject` | `defense.applications.review` |
| `GET /api/thesis/defense/applications/:thesisId/document-history` | `defense.applications.view` |
| `GET /api/thesis/panelist-candidates` | `defense.schedules.view` |
| `GET /api/thesis/defense/approved-applications` | `defense.schedules.view` |
| `GET /api/thesis/panelist-search` | `defense.schedules.view` |
| `GET /api/thesis/committee-policy` | `defense.schedules.view` |
| `POST /api/thesis/defense/:id/schedule` | `defense.schedules.manage` |
| `PATCH /api/thesis/defense/schedules/:scheduleId` | `defense.schedules.manage` |
| `GET /api/thesis/defense/pending` | `defense.applications.view` |
| `GET /api/thesis/defense/approved` | `defense.applications.view` |
| `GET /api/thesis/defense/applications` | `defense.applications.view` |
| `GET /api/thesis/defense/applications/summary` | `defense.applications.view` |
| `GET /api/thesis/defense/applications/:thesisId` | `defense.applications.view` |
| `GET /api/thesis/defense/all` | `defense.applications.view` |
| `GET /api/thesis/defense/schedules/:scheduleId/submission` | `defense.schedules.view` |
| `GET /api/thesis/defense/records` | `defense.records.view` |
| `GET /api/thesis/defense/:scheduleId/records` | `defense.records.view` |
| `GET /api/thesis/defense/schedules/:scheduleId` | `defense.schedules.view` |
| `GET /api/thesis/defense/rap-reports/all` | `defense.records.view` |

Catalog prerequisites remain unchanged: Adviser review expands to Adviser view; application review expands to application view; schedule management expands to schedule view. None grants Faculty/Student/Applicant registries, academic assignments or sibling mutations. Full access comes from the accepted enumerated Admin catalog, after validating the persisted access configuration.

## Deferred, excluded and retired surfaces

Enabled target mode denies the following **Admin branches**. Disabled/default composition preserves their existing compatibility behavior. Shared Student/Faculty paths keep their existing ownership and academic rules. Denial applies to synthetic Full as well as Restricted target actors: this package does not authorize deferred official/private outputs through an indirect administrative path.

| Endpoint | Classification / enabled-target treatment |
| --- | --- |
| `GET /api/thesis/adviser/available` | No accepted FACULTY-7 directory capability. Admin denied at route and business facade; Student compatibility retained. `/adviser/candidates` remains the Student's passed Title ODP source. FACULTY-10 owns directory/new-Adviser alignment. |
| `GET /api/thesis/adviser-certifications` | GS-017 official-record branch deferred to FACULTY-8; Admin denied at route. |
| `GET /api/thesis/adviser-certifications/:certificationId/pdf` | GS-017 PDF deferred to FACULTY-8; Admin denied at route. |
| `GET /api/thesis/adviser/requests/records` | GS-020 official-record branch deferred to FACULTY-8; Admin denied at route. |
| `GET /api/thesis/adviser/requests/:id/pdf` | GS-020 PDF deferred to FACULTY-8; Admin denied at route. |
| `GET /api/thesis/defense/:scheduleId/records/criteria/:panelAssignmentId` | Official individual evaluation/signature output deferred to FACULTY-8; Admin denied at route/facade; owning evaluator branch retained. |
| `GET /api/thesis/defense/:scheduleId/records/criteria/:panelAssignmentId/pdf` | Official PDF deferred to FACULTY-8; Admin denied at route. |
| `GET /api/thesis/defense/:scheduleId/records/summary` | Detailed official summary deferred to FACULTY-8; Admin denied at route/facade. Bounded Records detail remains separately mapped. |
| `GET /api/thesis/defense/:scheduleId/records/summary/pdf` | Official PDF deferred to FACULTY-8; Admin denied at route. |
| `GET /api/thesis/defense/:scheduleId/records/application/pdf` | Official GS-006/007 PDF deferred to FACULTY-8; Admin denied at route. |
| `GET /api/thesis/defense/:scheduleId/records/evaluations/pdf` | Official signed evaluation bundle deferred to FACULTY-8; Admin denied at route. |
| `GET /api/thesis/eligibility/:defenseType` | Caller-owned Student read model; no accepted arbitrary Admin/target-Student authority. Target Admin branch denied. |
| `GET /api/thesis/defense/:scheduleId/lobby` | Legacy shared polling surface; no accepted Admin academic/lobby authority. Target Admin branch denied. |
| `POST /api/thesis/defense/rap-reports/:rapId/distribute` | Retired. Existing controller and repository `409` retained, including enabled target mode. No revived distribution. |
| `POST /api/thesis/defense/rap-reports/:rapId/remind` | External email/message side effect with no accepted send capability. Target Admin denied at route and business facade; only dormant legacy path retained. No email sent during implementation/tests. |

The file/output classifications are minimal route closure only. Generic document streaming and owning GS-017/GS-020/private-file/PDF/official-output authorization are not implemented here. **FACULTY-8 has not started.** Those services and the broader application's remaining Admin branches must be closed in their authorized later packages before rollout.

`/defense/rap-reports/all` is a true read-only monitoring projection: report lifecycle and signature completion metadata, without signature bytes. It maps to `defense.records.view`. Records access does not authorize the reminder.

## Dormant composition and current actor architecture

`DEFENSE_ADVISER_CAPABILITY_ENFORCEMENT_ENABLED` is a code-owned `false`. There is no activation through environment variables, request data, JWT claims, frontend flags or database settings. `DefenseAdviserAuthorization` constructor injection is the bounded synthetic/future controlled composition seam; `ThesisService` passes that same instance to its affected owned services/repository. No global direct-access flag was enabled.

The existing JWT authentication reloads current account identity. The new middleware and business guards independently use the authenticated actor ID, reload current account/access state, and resolve validated direct grants plus catalog prerequisites. They do not consume caller actor IDs/grants, target IDs as authority or cached access lists. Inactive/non-Admin/credential-gated/missing-level/invalid-level/malformed/unknown/duplicate/wrong-category configurations fail closed in enabled mode.

Optional trailing read actor arguments preserve dormant internal signatures only: omission is denied by enabled guards. Mutations receive actor ID separately from business input. The legacy assignment wrapper now requires `requestId` specifically (the old `id` alias is not sufficient) and continues ignoring `adviserId`.

## Transaction protection and lock order

| Owning operation | Current-authority protection |
| --- | --- |
| Dean APPROVE/REJECT, including legacy assign | Fresh preflight, then shared fence + actor lock/reload in existing transaction, before existing Student lock and request/active-assignment reads; same conditional decision, signed evidence, frozen record and assignment writes. |
| Application approve/reject | Fresh service preflight; owning repository transaction takes shared fence + actor lock/reload before conditional exact-stage PENDING claim and durable audit. |
| Initial Defense scheduling | Fresh service preflight; owning schedule transaction takes shared fence + actor lock/reload before existing scheduling/manuscript reads, commit-time Adviser/committee/identity checks and writes/audit. |
| SCHEDULED correction | Fresh preflight; shared fence + actor lock/reload precedes existing exact schedule row lock and lifecycle/assignment reads; same correction/roster/audit transaction. |
| Administrative reads and document-history metadata | Fresh service-level reload/check; no transaction-duration revocation guarantee or new locks for reads. |
| Admin Records detail | Fresh owning-service check occurs before existing idempotent OPEN RAP-signature reconciliation. Existing reconciliation is retained, not newly granted report-authoring authority or a redesigned lifecycle. |

Fence sequence: `administrator_access_lock` row `1` FOR UPDATE → actor User row FOR UPDATE → current actor/grant reload/check → existing workflow locks/reads → domain validation → write. Missing sentinel fails closed with `503`; no runtime sentinel creation. All enabled protected writers share FACULTY-4's fence, so access removal cannot win while a protected mutation already holds it. Revocation that wins before a waiting mutation gets the fence is observed before domain writes. Existing domain locks are not reversed.

Synthetic contention tests pause the real owning transaction callbacks at the fence, revoke the current grants, release the wait and prove denial/no workflow or audit writes for all six mutation entry points (Dean, wrapper, approval, rejection, scheduling, correction). These tests are not real MariaDB concurrency evidence.

## Manual participants, Adviser and domain preservation

For both initial schedule and allowed correction, `assertManualDefenseParticipants` queries the transaction's User authority for every proposed manual ID. It requires an existing `PANELIST` or `FACULTY` User, active User, existing Panelist profile and active profile. ADMIN/STUDENT/APPLICANT/CUSTOM, missing users, inactive users, missing/inactive profiles and invalid IDs fail before writes. Earlier candidates, frontend state, body role labels and JWT roles are not trusted. Existing duplicate-person, role and stage/program quotas remain in the central committee policy; initial scheduling repeats that policy at the write boundary.

External Faculty policy is not expanded or redefined. The helper does not invent `isExternal` role restrictions or quotas. Existing accepted External Panelist participation remains valid. No new disputed External Chairman/Rapporteur/Facilitator case is adjudicated here; DR-5 remains separate.

Title remains Adviser-free. Proposal/Final scheduling re-resolves the sole active `AdviserAssignment` inside its transaction and persists that exact automatic seat, rejecting a conflicting submitted Adviser or duplicate Adviser seats. Missing/duplicate/invalid active relationship fails closed. Correction retains its automatic server-derived Adviser and rejects manual ADVISER input. Existing active relationships are not filtered by current new-Adviser availability and are not rewritten.

Dean approval retains the exact signed requested Adviser, CONFORME/current-state invariants, per-Student lock, conditional decision, single active relationship check and signed official snapshot transaction. The new-assignment write also rechecks academic/active User and active/internal/available profile; it does not impose new load caps or change availability configuration. This is a bounded approval eligibility check, not FACULTY-10's directory/configuration alignment.

Correction still requires the exact session to be `SCHEDULED` without conclusion. Same schedule/manuscript/attempt and historical assignment records remain intact. Removed current members are marked inactive and existing exact-assignment/workspace/realtime filtering denies future current authority. No post-start substitution, historical rewrite, score/verdict replacement or Adviser replacement was introduced.

## Academic separation

Every original academic route/account/assignment gate remains. Tests explicitly give a Full Admin, and a Restricted Admin with all seven FACULTY-7 capabilities, access to administrative work and deny score/evaluation draft/finalize, start/conclusion/conclude, workspace/notes, Rapporteur finalization, report edit/freeze/sign, RAP signatures and Adviser workspace/response actions. Direct realtime joins still require exact assignment. Targeted existing evaluator ownership, Chairman-only independent verdict, Rapporteur, signature/report immutability, last/current stage and attempt/history tests pass without weaker assertions.

## Response minimization

The affected legacy pending/approved/all application lists, Adviser request/active-assignment overviews and unpaginated committee candidates previously loaded complete Users. They now explicitly select identity (`id`, name, email) and, where needed, bounded profile fields (specialization, affiliation, Internal/External, activity and Adviser availability). No passwordHash, mustChangePassword, customRoleId, createdById, updatedById or unrelated User fields are selected through those relations. Candidate search already used a bounded select. Application/scheduled detail and document-history projections were already bounded at User relations.

Admin Records detail maps internal signature evidence to safe availability/completion booleans and metadata; it does not return the raw evidence it internally examines. RAP monitoring already uses explicit safe signature metadata. Existing raw/signed Criteria and official outputs are excluded from target routes pending FACULTY-8. New projection regression tests verify the actual Prisma selection objects at directly affected relation boundaries; existing Records/RAP privacy regressions also pass. This is not a repository-wide DTO refactor.

## Verification

No full backend repository suite was run. No frontend build/tests were run because frontend files did not change. All automated database calls in these focused tests use synthetic mocks.

Run from `backend`:

```powershell
npx vitest run tests/unit/routes/faculty-7-defense-adviser.routes.test.ts tests/unit/services/faculty-7-defense-adviser-boundaries.test.ts tests/unit/services/adviser-request.service.test.ts tests/unit/services/adviser-request.rules.test.ts tests/unit/services/adviser-request-signing.test.ts tests/unit/services/adv1-scheduling-adviser.test.ts tests/unit/services/defense-eligibility.service.test.ts tests/unit/repositories/defense-eligibility.repository.test.ts tests/unit/services/defense-committee.policy.test.ts tests/unit/services/defcorr1-schedule-correction.test.ts tests/unit/routes/defcorr1-schedule-correction.routes.test.ts tests/unit/repositories/thesis.repository.review-audit.test.ts tests/unit/repositories/thesis.repository.schedule-binding.test.ts tests/unit/repositories/defense-schedule-detail.repository.test.ts tests/unit/services/scheduled-defense-submission.service.test.ts tests/unit/controllers/scheduled-defense-submission.controller.test.ts tests/unit/services/cp7-official-defense-records.test.ts tests/unit/services/cp7-fix2-conclusion-privacy.test.ts tests/unit/services/defense-conclusion.service.test.ts tests/unit/services/oral-evaluation.service.test.ts tests/unit/services/oral-evaluation.rules.test.ts tests/unit/services/cdw6-history-annotation-read.test.ts tests/unit/services/cp9-panelist-assignments.test.ts tests/unit/realtime/defense-realtime.authorization.test.ts
```

PASS: **24 files / 566 tests**. Existing schedule-binding tests now supply a valid complete committee and current identities, retaining exact manuscript/audit assertions. Existing correction tests supply current identity fixtures. PREDEF route tests now provide current-account database fixtures required since FACULTY-2 instead of an empty database mock; original Student/Admin/ownership/privacy assertions remain. The correction route test accounts for the added middleware layer.

Additional targeted ownership/lifecycle/prerequisite regressions:

```powershell
npx vitest run tests/unit/services/cp7-fix1-authority.test.ts tests/unit/services/cp7-fix2-authority.test.ts tests/unit/services/cp7-fix1-controller.test.ts tests/unit/services/cdw7-immutability.test.ts tests/unit/services/cdw7-acceptance-regression.test.ts tests/unit/services/stage-completion.test.ts tests/unit/services/cdw9c-defense-audit.test.ts tests/unit/services/defense-document-history.service.test.ts tests/unit/routes/cdw6-history.routes.test.ts tests/unit/services/faculty-5-business-regression.test.ts tests/unit/services/faculty-6-exam-boundaries.test.ts tests/unit/repositories/faculty-6-frozen-results.test.ts
```

PASS: **12 files / 179 tests**. Unique combined focused coverage: **36 files / 745 tests**. After final source cleanup, the two new FACULTY-7 files were rerun: **2 files / 119 tests PASS** (not added again to the unique total).

```powershell
npm run build
```

PASS: backend TypeScript build after final source changes. Existing Vite config-loader future-compatibility warning remains; it does not fail tests.

From repository root: `git diff --check` PASS. Final staged diff and final clean/parity checks accompany delivery.

### Real database, manual QA and CI

Real MariaDB contention: **SAFELY SKIPPED**. Neither process environment nor backend local environment configuration provides an isolated `FACULTY_4_DB_SERVER_URL` or another isolated test-server endpoint. No normal XAMPP/application database was used for scratch/destructive testing. Real lock/isolation execution remains a readiness limitation before controlled activation, as in FACULTY-4–6.

Manual/browser QA: **NOT EXECUTED** (no UI change). Hosted CI and independent remote source review: **NOT EXECUTED by this implementation task**. Independent review is pending.

## Exact changed files

- `backend/src/access/defense-adviser-authorization.ts`
- `backend/src/controllers/thesis.controller.ts`
- `backend/src/middlewares/defense-adviser-capability.middleware.ts`
- `backend/src/repositories/thesis.repository.ts`
- `backend/src/routes/thesis.routes.ts`
- `backend/src/services/adviser-request.service.ts`
- `backend/src/services/defense-document-history.service.ts`
- `backend/src/services/defense-participant-identity.ts`
- `backend/src/services/defense-schedule-correction.service.ts`
- `backend/src/services/official-defense-record.service.ts`
- `backend/src/services/scheduled-defense-submission.service.ts`
- `backend/src/services/thesis.service.ts`
- `backend/tests/fixtures/defense-adviser-endpoints.ts`
- `backend/tests/unit/controllers/scheduled-defense-submission.controller.test.ts`
- `backend/tests/unit/repositories/thesis.repository.schedule-binding.test.ts`
- `backend/tests/unit/routes/defcorr1-schedule-correction.routes.test.ts`
- `backend/tests/unit/routes/faculty-7-defense-adviser.routes.test.ts`
- `backend/tests/unit/services/adviser-request-signing.test.ts`
- `backend/tests/unit/services/adviser-request.service.test.ts`
- `backend/tests/unit/services/defcorr1-schedule-correction.test.ts`
- `backend/tests/unit/services/faculty-7-defense-adviser-boundaries.test.ts`
- `docs/superpowers/GSIS_IMPLEMENTATION_CHECKLIST.md`
- `docs/superpowers/plans/2026-11-08-faculty-admin-access-implementation.md`
- `docs/superpowers/reports/2026-11-08-faculty-7-defense-adviser-administrative-guards.md`

## Non-goals and limitations

- No Prisma schema or migration changes; none were needed.
- No frontend/navigation/UI changes, Faculty Management, new role, new capability or committee policy.
- No Restricted Administrator provisioning/activation or mapping/bootstrap of existing Admins; no live access/configuration edits.
- No new email integration and no external messages sent.
- No private-file/PDF/official-output authorization implementation: FACULTY-8 not started.
- Read checks are fresh nontransactional checks, not a transaction-duration revocation fence. Participant eligibility is reread in the owning write transaction; a broader Faculty-configuration concurrency policy belongs to its owning future work.
- Existing schedule-correction simultaneous-editor last-write-wins behavior remains accepted/deferred; no new optimistic version token.
- Full rollout remains blocked by the previously accepted staged rollout boundary and later private-file/remaining-admin/configuration closure, independent review and real isolated-DB readiness validation. This package itself has no implementation blocker or unplanned schema/UI deviation.
- FACULTY-7 is **implemented / pending independent review** only. Stop after committing/pushing this package; do not proceed to FACULTY-8.
