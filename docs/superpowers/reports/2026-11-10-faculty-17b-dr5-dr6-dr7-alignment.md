# FACULTY-17B — DR-5 / DR-6 / DR-7 Implementation Alignment

**Status: FACULTY-17B implemented / pending independent review.**

Date: 2026-11-10 (Asia/Manila). Branch: `feat/faculty-admin-access`. Initial starting HEAD: `2f8a3ec4b25174f9e1a79ffd63d0b7868de9f7ec`; initial FACULTY-17B implementation commit: `5c993122aa3c385e83df05ebbb1e15e6331118fd` (verified as the starting HEAD for the bounded DR-5 follow-up correction); worktree clean. The existing canonical plan (`docs/superpowers/plans/2026-11-08-faculty-admin-access-implementation.md`) remains the implementation authority.

## 1. Parallel Read-Only Investigation, Independent Review & Bounded Correction Summary

Three specialized read-only subagents investigated DR-5, DR-6, and DR-7 in parallel without modifying code, migrations, fixtures, tests, or databases. Following the initial FACULTY-17B commit (`5c993122aa3c385e83df05ebbb1e15e6331118fd`), independent source review passed DR-6 and DR-7 and identified one remaining DR-5 legacy/anomaly gap on auto-derived Proposal/Final Defense `ADVISER` seats and active-Adviser workspace/review authority when an active `AdviserAssignment` points to an External Faculty profile. The bounded DR-5 follow-up correction resolves this gap in full.

| Decision | Approved Policy Summary | Pre-FACULTY-17B Repository State & Independent-Review Finding | FACULTY-17B Action |
| --- | --- | --- | --- |
| **DR-5** | External Faculty may be assigned by Admin to `CHAIRMAN`, `PANELIST`, `RAPPORTEUR`, or `FACILITATOR` on an exact Defense schedule, and must never be assigned as `ADVISER`, become an Adviser candidate, or receive student advisees. | **Partially satisfied; required bounded correction for anomalous/legacy External active `AdviserAssignment` authority.** Candidate queries (`ThesisRepository.getActivePanelistCandidates`, `searchActivePanelists`), manual committee validation, and new Adviser eligibility (`evaluateCandidateEligibility`, `evaluateNewAdviserEligibility`) already allowed all four manual Defense roles for active External Faculty while rejecting External `ADVISER` candidacy, request creation, Dean approval, and manually submitted `ADVISER` seats. However, independent review of `5c993122aa3c385e83df05ebbb1e15e6331118fd` found that auto-derived Proposal/Final Defense `ADVISER` resolution (`ThesisRepository.scheduleDefense`, `DefenseScheduleCorrectionService.correctSchedule`, `assertManualDefenseParticipants`) and active-Adviser workspace/review/document surfaces (`AdviserWorkspaceRepository`, `AdviserWorkspaceService`, `EffectiveAccessService`, `ProposalAdviserReviewService`, `FinalAdviserReviewService`, `DocumentService`) trusted active `AdviserAssignment` rows without revalidating that the current Faculty profile is Internal (`isExternal !== true`). | **Corrected in backend runtime and regression suites.** Auto-derived Proposal/Final Defense `ADVISER` resolution and schedule correction (`requireSingleActiveAdviser`, `assertManualDefenseParticipants`, `ThesisRepository.getActiveAdviserAssignment`, `ThesisRepository.scheduleDefense`, `DefenseScheduleCorrectionService.correctSchedule`) now revalidate that the active `AdviserAssignment` points to an Internal Faculty profile (`isExternal !== true`) without requiring `isAvailableAsAdviser === true`, failing closed (`409 External Faculty cannot serve as Thesis Adviser.`) if External. Active-Adviser surfaces (`AdviserWorkspaceRepository`, `AdviserWorkspaceService`, `EffectiveAccessService`, `ProposalAdviserReviewService`, `FinalAdviserReviewService`, `DocumentService`) also revalidate `isExternal !== true` and fail closed without deleting or rewriting historical `AdviserAssignment` records. |
| **DR-6** | If the requested Adviser becomes inactive or unavailable after the Student signed the request and the Adviser recorded `CONFORME` before Dean approval, the authorized Admin/Dean reviewer may reject the pending request with a required rejection reason, preserving the original request and signed CONFORME unchanged, with no automatic transfer and allowing the Student to submit a new request to another eligible Internal Faculty member. | **Partially satisfied; required bounded correction for mandatory rejection reason.** Authorized reviewer gating (`adviser.requests.review`), post-CONFORME approval denial (`409`) when the requested Adviser becomes inactive/unavailable/external, immutable preservation of the original request and `AdviserRequestSignedState`, absence of automatic transfer, and Student retry (`isRetryableClosedRequest`) were already in place. However, `evaluateDeanResponseTransition` and `AdviserRequestService.deanDecideAdviserRequest` permitted `decision: "REJECTED"` without `remarks`, and the Admin/Dean review dialog labeled remarks as optional with an enabled submit button when blank. | **Corrected in backend and frontend.** `evaluateDeanResponseTransition` and `deanDecideAdviserRequest` now require a non-empty trimmed rejection reason (`400 Rejection reason is required.`) when `decision === "REJECTED"`, and the Admin/Dean review modal (`frontend/src/app/(portal)/admin/thesis/advisers/page.tsx`) requires a non-empty rejection reason before submitting a rejection. |
| **DR-7** | Once an Internal Faculty member has ever held an authoritative `AdviserAssignment` to a Student (including completed or inactive assignments), that Faculty member cannot subsequently be reclassified as External, enforced in backend services/API with no Admin override and preserving all historical `AdviserAssignment` records. | **Partially satisfied; required bounded correction for completed/inactive historical assignments.** `AdminPanelistService.updatePanelist` blocked Internal-to-External reclassification inside its fenced transaction with `409 This Adviser classification requires institutional review.` and no Admin override, and ignored pending requests or unapproved CONFORME records without an `AdviserAssignment`. However, `tx.adviserAssignment.findFirst` filtered by `isActive: true`, which would allow reclassifying an Internal Faculty member whose historical `AdviserAssignment` rows were all `isActive: false`. | **Corrected in backend service.** Removed `isActive: true` from `tx.adviserAssignment.findFirst({ where: { adviserId: before.userId }, select: { id: true } })` in `AdminPanelistService.updatePanelist` so any authoritative current or historical `AdviserAssignment` permanently blocks reclassification to External. |

---

## 2. Detailed Findings and Bounded Corrections by Decision

### 2.1 DR-5 — External Faculty Defense Role Eligibility and Active-Adviser Boundary

- **Inspected files and functions:**
  - `backend/src/services/active-adviser.rules.ts` (`resolveSingleActiveAdviser`, `requireSingleActiveAdviser`, `isExternalActiveAdviser`)
  - `backend/src/services/defense-participant-identity.ts` (`assertManualDefenseParticipants`)
  - `backend/src/services/defense-committee.policy.ts` (`DefenseCommitteePolicy.getPolicy`, `validateAssignments`)
  - `backend/src/repositories/thesis.repository.ts` (`getActivePanelistCandidates`, `searchActivePanelists`, `getActiveAdviserAssignment`, `scheduleDefense`)
  - `backend/src/services/defense-schedule-correction.service.ts` (`DefenseScheduleCorrectionService.correctSchedule`)
  - `backend/src/repositories/adviser-workspace.repository.ts` (`countSoleActiveAdvisees`, `listActiveAssignmentsForAdviser`, `isExternalFaculty`)
  - `backend/src/services/adviser-workspace.service.ts` (`getWorkspace`, `getAdviseeDetail`, `assertSingleActiveAdviserForCandidates`, `authorizeActiveAdviser`)
  - `backend/src/services/effective-access.service.ts` (`EffectiveAccessService.currentAccount`)
  - `backend/src/services/proposal-adviser-review.service.ts` (`callerIsSoleActiveAdviser`, `isActiveAdviserForStudent`, `loadReviewContext`, `toStudentDto`, `submitManuscriptForReview`, `listReviewTasks`, `getReviewTask`, `requestChanges`, `certify`)
  - `backend/src/services/final-adviser-review.service.ts` (`callerIsSoleActiveAdviser`, `isActiveAdviserForStudent`, `loadReviewContext`, `toDto`, `submitManuscriptForReview`, `listReviewTasks`, `getReviewTask`, `requestChanges`, `certify`)
  - `backend/src/services/document.service.ts` (`canPanelistAccessThesisDocument`, `MODEL_REGISTRY["thesis-document"]`)
  - `backend/src/services/adviser-request.rules.ts` (`evaluateCandidateEligibility`, `evaluateNewAdviserEligibility`)
  - `backend/src/services/adviser-request.service.ts` (`listOdpCandidates`, `createRequest`, `deanDecideAdviserRequest`)
- **Runtime behavior and bounded correction:**
  - `ThesisRepository.getActivePanelistCandidates` and `ThesisRepository.searchActivePanelists` filter by `role: { in: ["PANELIST", "FACULTY"] }`, `isActive: true`, and `panelist: { isActive: true }` without filtering by `isExternal` or `isAvailableAsAdviser`.
  - `assertManualDefenseParticipants` validates all committee participants (`CHAIRMAN`, `PANELIST`, `RAPPORTEUR`, `FACILITATOR`, and derived/submitted `ADVISER` seats) for active `FACULTY`/`PANELIST` account status and active profile status, permitting both Internal (`isExternal: false`) and External (`isExternal: true`) Faculty across all four manual roles on both `scheduleDefense` and `correctSchedule`.
  - External `ADVISER` assignment and advisee authority are blocked at every boundary:
    1. Title Defense (`adviserMode: "NONE"`) rejects any `ADVISER` seat (`400`).
    2. Proposal and Final Defense (`adviserMode: "EXPECTED_ADVISER"`) derive the `ADVISER` seat strictly from the Student's sole active `AdviserAssignment` and reject manual `ADVISER` input or substitution (`400`) on both `scheduleDefense` and `correctSchedule`.
    3. **Bounded DR-5 correction (auto-derived Proposal/Final Adviser):** `requireSingleActiveAdviser` (`active-adviser.rules.ts`), `ThesisRepository.getActiveAdviserAssignment`, `ThesisRepository.scheduleDefense`, `DefenseScheduleCorrectionService.correctSchedule` (which now passes `fullCommittee` including the derived `ADVISER` seat to `assertManualDefenseParticipants`), and `assertManualDefenseParticipants` (`defense-participant-identity.ts`) revalidate the current Faculty profile's `isExternal` classification before accepting an active `AdviserAssignment` for Proposal or Final Defense scheduling or schedule correction. If the active `AdviserAssignment` points to an External Faculty profile (`isExternal === true`), the operation fails closed with `409 ("External Faculty cannot serve as Thesis Adviser.")` without choosing another Faculty member, deleting or deactivating the `AdviserAssignment`, or rewriting historical evidence. Existing Internal Advisers with `isAvailableAsAdviser === false` remain valid for Proposal and Final Defense scheduling and correction because `isAvailableAsAdviser` controls new Adviser assignment eligibility only.
    4. **Bounded DR-5 correction (active Adviser / My Advisees / review / document authority):** `AdviserWorkspaceRepository`, `AdviserWorkspaceService`, `EffectiveAccessService`, `ProposalAdviserReviewService`, `FinalAdviserReviewService`, and `DocumentService` revalidate that an active `AdviserAssignment`'s Faculty profile is Internal (`isExternal !== true`). An External Faculty account with an anomalous active `AdviserAssignment` fails closed on `My Advisees` workspace/detail and `/api/auth/me` (`409`), receives `[]` on Proposal/Final review queues, is denied `getReviewTask` / `requestChanges` / `certify` / active-Adviser document access (`403`), and blocks Student Proposal/Final manuscript submission to an External active Adviser (`409`) without deleting or rewriting historical `AdviserAssignment` records.
    5. `evaluateCandidateEligibility` and `evaluateNewAdviserEligibility` enforce `input.isExternal === false`, so an External Faculty member who served as Title Defense `CHAIRMAN` or `PANELIST` is excluded from `listOdpCandidates`, rejected by `createRequest` (`400`), and rejected by `deanDecideAdviserRequest` (`409`).

### 2.2 DR-6 — Ineligible Adviser Request After CONFORME

- **Inspected files and functions:**
  - `backend/src/services/adviser-request.rules.ts` (`evaluateDeanResponseTransition`, `isOpenAdviserRequest`, `isRetryableClosedRequest`, `evaluateNewAdviserEligibility`)
  - `backend/src/services/adviser-request.service.ts` (`AdviserRequestService.deanDecideAdviserRequest`, `createRequest`, `listOdpCandidates`)
  - `backend/src/controllers/thesis.controller.ts` (`deanRespondAdviserRequest`)
  - `backend/src/routes/thesis.routes.ts` (`POST /adviser/requests/:id/dean-response`)
  - `frontend/src/app/(portal)/admin/thesis/advisers/page.tsx` (`AdminAdvisersPage`)
- **Runtime behavior and bounded correction:**
  - When a requested Adviser becomes inactive (`user.isActive: false` or `panelist.isActive: false`), unavailable (`isAvailableAsAdviser: false`), or external (`isExternal: true`) after `adviserStatus === "CONFORMED"`, `deanDecideAdviserRequest` blocks `decision: "APPROVED"` with `409 Conflict` while allowing an authorized reviewer (`adviser.requests.review` capability on an active `ADMIN` account, rechecked inside the transaction after the shared `administrator_access_lock` fence and `SELECT ... FOR UPDATE` on `students`) to record `decision: "REJECTED"`.
  - `evaluateDeanResponseTransition` in `backend/src/services/adviser-request.rules.ts` and `deanDecideAdviserRequest` in `backend/src/services/adviser-request.service.ts` now require a non-empty trimmed `remarks` string whenever `decision === "REJECTED"`, returning `400 ("Rejection reason is required.")` if omitted or blank. State-transition checks (`409` when already decided, closed, or not `CONFORMED`) continue to run first.
  - On `REJECTED`, only `deanStatus: "REJECTED"`, `deanReviewedById`, `deanReviewedAt`, `deanRemarks` (trimmed rejection reason), and `status: "REJECTED"` are written. Original request fields (`studentId`, `requestedAdviserId`, `reason`, `requestDate`, `sourceDefenseScheduleId`), CONFORME fields (`adviserStatus: "CONFORMED"`, `adviserRespondedAt`, `adviserRemarks`), and `AdviserRequestSignedState` (`payload`, `signatureData`, `evidenceHash`, `signedAt`) are completely untouched. No `AdviserAssignment` or `AdviserRequestOfficialRecord` is created, and no automatic Adviser replacement occurs.
  - Because `{ adviserStatus: "CONFORMED", deanStatus: "REJECTED" }` is closed and retryable (`isOpenAdviserRequest === false`, `isRetryableClosedRequest === true`), the Student can submit a new signed request (`createRequest`) to another eligible Internal Faculty member from the passed Title Defense committee while the rejected request and its signed evidence remain preserved.
  - In `frontend/src/app/(portal)/admin/thesis/advisers/page.tsx`, the rejection confirmation dialog now labels the field `Rejection Reason (Required)`, marks the textarea `required` when rejecting, and disables the `Reject Request` button until `remarks.trim()` is non-empty.

### 2.3 DR-7 — Permanent Internal-to-External Classification Lock

- **Inspected files and functions:**
  - `backend/src/services/admin-panelist.service.ts` (`AdminPanelistService.updatePanelist`)
  - `backend/src/access/faculty-configuration.ts` (`parseFacultyPatch`)
  - `backend/src/repositories/admin-panelist.repository.ts` (`AdminPanelistRepository`)
  - `frontend/src/lib/faculty-management.ts` (`facultyError`)
  - `frontend/src/components/admin/faculty/faculty-form.tsx` (`FacultyFormDialog`)
- **Authoritative historical assignment definition and bounded correction:**
  - An authoritative Adviser assignment is a persisted row in `adviser_assignments` (`AdviserAssignment`), which is created only upon Dean approval after Student signing and Adviser `CONFORME` (or pre-existing authoritative assignment records). A pending `AdviserRequest` or a signed `CONFORME` (`AdviserRequestSignedState`) without an `AdviserAssignment` row is not an authoritative assignment and does not lock classification.
  - In `AdminPanelistService.updatePanelist` (`backend/src/services/admin-panelist.service.ts:128`), removed `isActive: true` from the `tx.adviserAssignment.findFirst` check inside the fenced transaction (`administrator_access_lock` -> actor `FOR UPDATE` -> target `users` `FOR UPDATE` -> target `panelists` `FOR UPDATE`):
    ```ts
    if ((before.isExternal || isExternal) && await tx.adviserAssignment.findFirst({ where: { adviserId: before.userId }, select: { id: true } })) {
        throw new AppError("This Adviser classification requires institutional review.", 409);
    }
    ```
  - Consequently, any current (`isActive: true`) or completed/inactive (`isActive: false`) `AdviserAssignment` permanently blocks reclassifying an Internal Faculty member as External (`409 This Adviser classification requires institutional review.`), with no Admin override (including `FULL` Administrators) and without modifying or deleting any historical `AdviserAssignment` records. Non-classification edits (such as toggling `isAvailableAsAdviser: false` or updating profile metadata) remain permitted for Internal Faculty with current or historical assignments.

---

## 3. Data, Evidence, and Environment Safety Preservation

- **Zero schema or migration changes:** No Prisma schema changes or migration files were created or modified. All historical migrations remain untouched.
- **Zero database operations on development/staging/production:** In accordance with the FACULTY-17B database safety boundary, the local XAMPP/development database (`graduate_system`), staging, and production environments were not queried, inventoried, migrated, reset, or seeded. All automated tests ran strictly against synthetic in-memory mocks.
- **Historical evidence preserved:** All historical `PanelAssignment` records, all five `PanelRole` values, all `AdviserAssignment` records, signed GS-020 requests and `AdviserRequestSignedState` / `AdviserRequestOfficialRecord` evidence, GS-017 certifications, and `AuditLog` records remain untouched. Accepted FACULTY-7 and FACULTY-10 reports were not rewritten.
- **Activation and readiness gates:**
  - `ADMINISTRATOR_MANAGEMENT_ENABLED` (`backend/src/access/administrator-management.ts`), `DIRECT_ACCESS_ENFORCEMENT_ENABLED` (`backend/src/access/account-access.ts`), and `OPERATIONAL_ENFORCEMENT_ENABLED` (`backend/src/access/operational-authorization.ts`) — as well as `DEFENSE_ADVISER_CAPABILITY_ENFORCEMENT_ENABLED` and `FACULTY_CONFIGURATION_ENABLED` — remain unchanged and `false`.
  - FACULTY-4 and FACULTY-12 isolated real-MariaDB contention readiness gates remain **OPEN**.

---

## 4. Verification Ledger

All verification commands were executed locally by the implementation agent using synthetic test fixtures:

1. **Focused Backend Unit & Route Suites (Vitest):**
   - Command: `npx vitest run tests/unit/services/faculty-7-defense-adviser-boundaries.test.ts tests/unit/services/defcorr1-schedule-correction.test.ts tests/unit/repositories/thesis.repository.schedule-binding.test.ts tests/unit/services/adv1-scheduling-adviser.test.ts tests/unit/services/adviser-workspace.service.test.ts tests/unit/repositories/adviser-workspace.repository.test.ts tests/unit/routes/adviser-workspace.routes.test.ts tests/unit/routes/faculty-13-effective-access.routes.test.ts tests/unit/services/proposal-adviser-review.service.test.ts tests/unit/services/final-adviser-review.service.test.ts tests/unit/services/adv5-adviser-document-auth.test.ts tests/unit/services/adv5-document-service-auth.test.ts tests/unit/services/faculty-10-adviser-eligibility.test.ts tests/unit/services/faculty-10-configuration.test.ts tests/unit/services/adviser-request.rules.test.ts tests/unit/services/adviser-request.service.test.ts tests/unit/services/adviser-request-signing.test.ts tests/unit/routes/faculty-7-defense-adviser.routes.test.ts tests/unit/routes/faculty-10-configuration.routes.test.ts tests/unit/controllers/faculty-10-configuration.controller.test.ts`
   - Result: **20 test files passed / 626 tests passed / 0 failed**.
2. **Backend Build / TypeScript Check:**
   - Command: `npm run build` (in `backend`, running `tsc`)
   - Result: **PASS (exit code 0)**.
3. **Affected Frontend Verifiers, TypeScript, Scoped ESLint, and Next.js Build:**
   - Command: `node --experimental-strip-types --test scripts/verify-gs020-1b-adviser-request.mjs scripts/verify-faculty-11-management.mjs scripts/verify-faculty-15-admin.mjs`
   - Result: **88 tests passed / 0 failed**.
   - Command: `npx tsc --noEmit` (in `frontend`)
   - Result: **PASS (exit code 0)**.
   - Command: `npx eslint "src/app/(portal)/admin/thesis/advisers/page.tsx"` (in `frontend`)
   - Result: **PASS (exit code 0)**.
   - Command: `npm run build` (in `frontend`, running `next build`)
   - Result: **PASS (exit code 0)**.
4. **Git Hygiene Check:**
   - Command: `git diff --check`
   - Result: **PASS (exit code 0)**.

**Verification boundaries:**
- **Agent-reported automated checks:** Passed as listed above.
- **Independent remote commit-diff/source review:** DR-6 and DR-7 passed on `5c993122aa3c385e83df05ebbb1e15e6331118fd`; bounded DR-5 follow-up correction pending independent review.
- **Project-owner manual/browser QA:** Pending (not claimed as passed).
- **Hosted CI:** Not observed/claimed.

---

## 5. Changed Files Inventory

### Initial FACULTY-17B Commit (`5c993122aa3c385e83df05ebbb1e15e6331118fd`) & Bounded DR-5 Follow-Up Correction
1. `backend/src/services/active-adviser.rules.ts` — Added `EXTERNAL_ACTIVE_ADVISER_MESSAGE`, `isExternalActiveAdviser`, and `isExternal` check in `requireSingleActiveAdviser` (DR-5).
2. `backend/src/services/defense-participant-identity.ts` — Updated `assertManualDefenseParticipants` to validate all committee seats (including derived `ADVISER` rows) and reject External `ADVISER` rows (`409`) without requiring `isAvailableAsAdviser` (DR-5).
3. `backend/src/repositories/thesis.repository.ts` — Selected `adviser.panelist.isExternal` on active `AdviserAssignment` resolution in `getActiveAdviserAssignment` and `scheduleDefense` (DR-5).
4. `backend/src/services/defense-schedule-correction.service.ts` — Selected `adviser.panelist.isExternal` on active `AdviserAssignment` resolution and passed `fullCommittee` (including derived `ADVISER`) to `assertManualDefenseParticipants` in `correctSchedule` (DR-5).
5. `backend/src/repositories/adviser-workspace.repository.ts` — Added `isExternalFaculty`, included `adviser.panelist.isExternal` in `listActiveAssignmentsForAdviser`, and guarded `countSoleActiveAdvisees` against External active `AdviserAssignment` rows (DR-5).
6. `backend/src/services/adviser-workspace.service.ts` — Guarded `getWorkspace` (`assertSingleActiveAdviserForCandidates`) and `getAdviseeDetail` (`authorizeActiveAdviser`) so an External Faculty account with an anomalous active `AdviserAssignment` fails closed (`409`) (DR-5).
7. `backend/src/services/effective-access.service.ts` — Guarded `currentAccount` so an External Faculty account with an anomalous active `AdviserAssignment` (`activeAdviseeCount > 0`) fails closed (`409`) (DR-5).
8. `backend/src/services/proposal-adviser-review.service.ts` — Revalidated `isExternal !== true` in `callerIsSoleActiveAdviser`, `isActiveAdviserForStudent`, `loadReviewContext`, `toStudentDto`, `submitManuscriptForReview`, and `listReviewTasks` (DR-5).
9. `backend/src/services/final-adviser-review.service.ts` — Revalidated `isExternal !== true` in `callerIsSoleActiveAdviser`, `isActiveAdviserForStudent`, `loadReviewContext`, `toDto`, `submitManuscriptForReview`, and `listReviewTasks` (DR-5).
10. `backend/src/services/document.service.ts` — Excluded External active `AdviserAssignment` rows from `canPanelistAccessThesisDocument` and `MODEL_REGISTRY["thesis-document"]` (DR-5).
11. `backend/src/services/adviser-request.rules.ts` — Added `remarks` to `DeanTransitionInput` and required non-empty trimmed `remarks` when `decision === "REJECTED"` in `evaluateDeanResponseTransition` (DR-6).
12. `backend/src/services/adviser-request.service.ts` — Passed `remarks: input.remarks` into `evaluateDeanResponseTransition` in `deanDecideAdviserRequest` (DR-6).
13. `backend/src/services/admin-panelist.service.ts` — Removed `isActive: true` from `tx.adviserAssignment.findFirst` in `updatePanelist` so any current or completed/inactive historical `AdviserAssignment` permanently blocks Internal-to-External reclassification (DR-7).
14. `frontend/src/app/(portal)/admin/thesis/advisers/page.tsx` — Required non-empty rejection reason in the Admin/Dean reject confirmation dialog and disabled submission while blank (DR-6).
15. `backend/tests/unit/services/faculty-7-defense-adviser-boundaries.test.ts` — Added DR-5 regression tests for External Faculty across all four permitted manual roles, candidate query filters, manual External `ADVISER` rejection, auto-derived Proposal/Final Internal Adviser acceptance (including `isAvailableAsAdviser = false`), and auto-derived Proposal/Final External Adviser rejection on scheduling and schedule correction.
16. `backend/tests/unit/services/adviser-workspace.service.test.ts` — Added DR-5 regression test verifying `getWorkspace` and `getAdviseeDetail` fail closed when an active `AdviserAssignment` points to External Faculty.
17. `backend/tests/unit/routes/faculty-13-effective-access.routes.test.ts` — Added DR-5 regression test verifying `/api/auth/me` fails closed when an External Faculty account has an anomalous active `AdviserAssignment`.
18. `backend/tests/unit/services/proposal-adviser-review.service.test.ts` — Added DR-5 regression test verifying External Faculty with an anomalous active `AdviserAssignment` cannot access Proposal review tasks, actions, or Student submission.
19. `backend/tests/unit/services/final-adviser-review.service.test.ts` — Added DR-5 regression test verifying External Faculty with an anomalous active `AdviserAssignment` cannot access Final review tasks, actions, or Student submission.
20. `backend/tests/unit/services/adv5-document-service-auth.test.ts` — Added DR-5 regression test denying active-Adviser document access when the active `AdviserAssignment` points to External Faculty.
21. `backend/tests/unit/services/faculty-10-adviser-eligibility.test.ts` — Added DR-5 External Title Defense committee exclusion tests and DR-6 post-CONFORME ineligibility rejection, required-reason validation, signed-evidence preservation, and Student retry tests.
22. `backend/tests/unit/services/faculty-10-configuration.test.ts` — Added DR-7 active and completed/inactive historical `AdviserAssignment` permanent classification-lock tests, Full Admin non-override test, and pending-request/CONFORME non-assignment test.
23. `backend/tests/unit/services/adviser-request.rules.test.ts` — Added unit tests for required rejection reason on `REJECTED` in `evaluateDeanResponseTransition`.
24. `backend/tests/unit/services/adviser-request-signing.test.ts` — Updated legacy rejection test to verify required rejection reason (`400` when missing) and pass valid rejection remarks.
25. `frontend/scripts/verify-gs020-1b-adviser-request.mjs` — Added assertion verifying required rejection reason UI guard on the Admin/Dean Adviser request review page.
26. `docs/superpowers/plans/2026-11-08-faculty-admin-access-implementation.md` — Recorded `FACULTY-17B implemented / pending independent review` including the bounded DR-5 correction.
27. `docs/superpowers/GSIS_IMPLEMENTATION_CHECKLIST.md` — Recorded `FACULTY-17B implemented / pending independent review` across DR-5, DR-6, and DR-7 status rows.
28. `docs/superpowers/reports/2026-11-10-faculty-17b-dr5-dr6-dr7-alignment.md` — This implementation report.
