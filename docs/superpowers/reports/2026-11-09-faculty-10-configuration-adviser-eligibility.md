# FACULTY-10 — Faculty configuration and new-Adviser eligibility backend

Date: 2026-11-09 (Asia/Manila). Branch: `feat/faculty-admin-access`.
Starting local and actual remote HEAD: `976fd0464dc63e92c8c259077221339d24d43611`; worktree clean. Remote verified with `git ls-remote origin refs/heads/feat/faculty-admin-access` before edits.

**Status: FACULTY-10 implemented / pending independent review.** No acceptance or FACULTY-11 start.

## Pre-implementation coverage ledger

This ledger was recorded before production-code edits. All paths below have `/api` prefix. Full uses enumerated catalog capabilities; Restricted requires the exact capability, with the catalog's `faculty.manage` → `faculty.view` prerequisite. Faculty/Student cannot administer accounts. Administrative actor identity is server-derived and reloaded through the existing OperationalAuthorization/current-account/access resolver, including after the access fence. No new permission model or capability.

| Action and current entry point | Authority / Full | Restricted | Faculty/Student preservation | Target read/mutation and exclusions |
| --- | --- | --- | --- | --- |
| GET `/admin/panelists`; AdminPanelistService.getAllPanelists | `faculty.view` | Exact key | No administrative access | Explicit bounded Faculty/profile/account DTOs; only compatible FACULTY/PANELIST identity with matching profile; no hashes/credentials/Admin access/private account internals |
| GET `/admin/panelists/:id`; getPanelistById | `faculty.view` | Exact key | No administrative access | Same bounded detail, only approved Faculty direct-grant summary |
| POST `/admin/panelists`; createPanelist | `faculty.manage` | Key with view prerequisite | No public/academic provisioning | Validated identity/profile fields, new FACULTY account only; random 32-byte temporary credential + bcrypt cost 12; mustChangePassword; one-time creation response only; no existing-account conversion |
| PUT `/admin/panelists/:id`; updatePanelist, ordinary profile/identity | `faculty.manage` | Exact key | Existing own profile GET remains | Exact academic target lock/reread, bounded patch, atomic audit; no password reset or actor/role/history override |
| Same PUT, account/profile active status | `faculty.manage` | Exact key | Existing assignments and signed records unchanged | `isActive` updates User and profile together; omitted status unchanged; no relationship deletion/reassignment |
| Same PUT, Internal/External | `faculty.manage` | Exact key | Existing committee/history unchanged | External stored/effective availability false; conflicting explicit availability=true denied; active-Adviser Internal→External or existing External-Adviser anomaly is DR-7 conflict, no automatic repair |
| Same PUT, `capabilityKeys` | `faculty.manage` | Exact key | Faculty cannot configure self | Only `essay.evaluate`, school-wide, existing direct grants; reject unknown/Admin/category/duplicate/contextual-role authority; protected atomic before/after access audit; no essay workflow |
| Same PUT, Available as Adviser | `faculty.manage` | Exact key | Unavailable is not loss of an existing Adviser relationship | Internal flag only; no load cap, Program permission or assignment grant |
| PATCH `/panelists/me/availability`; PanelistService.toggleAvailability | Denied in enabled target, including direct service call | Denied | Retain GET `/panelists/me` and addressed-request/history rights | Self-service write retired behind the same code-owned target gate; no alternative self-write helper |
| GET `/thesis/adviser/candidates`; AdviserRequestService.listOdpCandidates | No Admin substitute | No Admin substitute | Current active/password-ready Student's own passed Title ODP only | Same-session PASSED/concluded Title + complete RAP; CHAIRMAN/PANELIST, current active academic User/profile, Internal, explicitly available; no unrestricted directory or Program/load policy |
| POST `/thesis/adviser/request`; createRequest | No Admin substitute | No Admin substitute | Exact authenticated Student/signing ownership | Same canonical eligibility at submission and again inside fenced transaction; guessed candidate IDs denied; exact reviewed/signed context retained |
| POST `/thesis/adviser/requests/:id/dean-response`; deanDecideAdviserRequest | Existing `adviser.requests.review` | Same key and view prerequisite | CONFORME and immutable signed GS-020 remain mandatory | Access fence/current actor + Student/workflow/target locks; same current eligibility immediately before new assignment; DR-6 ineligible pending request fails closed without modifying signed evidence |
| POST `/thesis/adviser/assign`; ThesisService.assignAdviser | Existing `adviser.requests.review` | Same key | No direct assignment from Faculty Management | Existing canonical Dean delegate only, ignores arbitrary substitute adviser ID |
| GET `/thesis/adviser/available`; ThesisService.getAvailableAdvisers | No Admin substitute | No Admin substitute | Student-only compatibility alias of exact ODP candidate list | Retire the unrestricted repository directory helper; no credential/profile graph leakage |

Read target identity must be Faculty/legacy PANELIST with the exact profile relation. Target account/profile need not already be active for authorized administration/reactivation, but malformed target access configuration fails closed. Current Administrator must be active, password-ready, and have valid resolved access; stale JWT role/grants never authorize.

Management is a new hardened backend contract behind a code-owned **false** activation constant, analogous to Administrator Management. When dormant it returns controlled unavailable responses rather than exposing the insecure legacy writer. No real accounts/grants are provisioned. Enabled tests use bounded composition injection. Self-toggle denial and transactional new-assignment fencing share this gate; rollout requires coordinated review of the prior package gates.

Implemented bounded mutation fields: `email`, `firstName`, `lastName`, `title`, `suffix`, `highestEducationalAttainment`, `officeAffiliation`, `specialization`, `isActive`, `isExternal`, `isAvailableAsAdviser`, `capabilityKeys`. Create requires email/first/last name; default active/Internal, unavailable and no configured grants. Update preserves omitted fields and credentials. Unknown fields, passwords/hashes, role/Admin level, contextual committee roles, Student/assignment IDs, load limits, creator/updater overrides and signed/history rewrites are rejected.

FACULTY-9 Expert assignment, generic audit deletion, privacy and operational guards remain unchanged. No schema/migration, frontend, FACULTY-11+, Program Chair/evaluator mapping, data conversion, production grant activation or historical rewrite is included.

## Implementation record

The technical `/admin/panelists` API and Panelist profile/table identifiers remain intact. Administrative reads explicitly select safe profile/identity data and build DTOs field by field, including bounded creator/updater names and only the approved Faculty grant summary. No password hash, credential flag, custom-role internals, Administrator metadata or unrelated grants are serialized. A wrong-role, missing/mismatched profile, or malformed target access configuration fails closed. Inactive academic targets may be administered/reactivated; current administrative actors must be active, password-ready and resolve valid current capabilities.

The four Faculty-management routes and services use the existing `OperationalAuthorization` adapter, loader, resolver and catalog. `FACULTY_CONFIGURATION_ENABLED` is code-owned and **false**, with no runtime switch. All hardened management requests return controlled 503 while dormant; this deliberately replaces the former insecure legacy CRUD path instead of re-exposing it. Enabled tests inject the existing adapter. Full obtains `faculty.view`/`faculty.manage` through enumeration; Restricted requires the key. This is backend source readiness, not production activation. Existing earlier-package switches are unchanged. The old repository transaction writers are explicitly retired with 403, preventing alternate unaudited provisioning/profile mutation.

Create requires `email`, `firstName`, `lastName`. Optional fields are the exact ledger contract. Text is bounded to 191 characters, nullable profile fields accept null/empty string, booleans must be actual booleans, and unknown/prohibited fields fail closed. Default creation is active/Internal, unavailable as Adviser, with no direct grants. New academic accounts use `FACULTY`; no existing PANELIST account is converted. Duplicate identity conflicts return controlled 409; no email aliases, dual-account identity policy or schema change is invented.

Provisioning follows the accepted Administrator convention: 32 cryptographic random bytes encoded as base64url, bcrypt cost 12, stored hash only and `mustChangePassword=true`. Only a successful committed creation returns `{ account, temporaryPassword }`, with `Cache-Control: private, no-store`. The temporary credential never enters ordinary list/detail/update DTOs, audit, email or persisted plaintext. Unexpected controller errors are generic, preventing database exceptions from disclosing hashes. Profile/grant/status changes do not reset existing credentials or their gate.

Faculty Management accepts only the Faculty-category direct `essay.evaluate` grant (plus an empty list to revoke it). It is school-wide: no Program evaluator mapping, Program Chair, committee-role permission or new key. Academic targets alone may receive it; Admin/Student/CUSTOM/Applicant targets are denied. Duplicate, unknown, Admin-category, contextual-role and malformed lists are rejected. New grants use server actor/time fields; unchanged grants are preserved.

Sensitive writes reuse the existing shared access fence, then actor validation; existing-target updates lock the target User and exact profile, reread and validate the target, conditionally constrain the User write to academic roles, update only owned fields, and write audit in the same transaction. `isActive` synchronizes User and profile; omitted values preserve current state. Classification/availability never mutate AdviserAssignment, committee assignments, signed-state, official-record or historical IDs. External availability is false; explicit External+available=true input is rejected. Existing Internal Advisers may become unavailable for new assignments while their current/historical relationships remain intact.

Grant/revoke evidence uses the established `ACCOUNT_CAPABILITY_GRANTED` / `ACCOUNT_CAPABILITY_REVOKED` events with actor, target, timestamp and before/after access state. Creation and profile/status/classification/availability changes use `ACCOUNT_CAPABILITY_FACULTY_CREATED` / `ACCOUNT_CAPABILITY_FACULTY_CONFIGURED`, within the already-protected namespace. Audit failure rejects the entire mutation. The generic audit deletion implementation and protected prefixes are unchanged; focused tests verify that these new event strings cannot be erased through that existing repository path. No audit-retention redesign.

The enabled target denies `PATCH /panelists/me/availability` at route and service boundaries; the low-level self setter also denies when the code-owned gate is activated. Ordinary own profile reads remain and project External availability as false. Current academic identity/credentials are rechecked for enabled direct self-profile reads. Dormant legacy self-toggle behavior remains until separately authorized coordinated activation; no claim of production retirement is made.

`evaluateNewAdviserEligibility` centralizes active academic User + existing active profile + explicitly Internal/available state. `evaluateCandidateEligibility` adds the accepted Chairman/evaluator Panelist ODP role requirement. Missing/null flags fail closed. The same exact passed/concluded Title context and same-session completed RAP source supplies candidate listing and request validation. No unrestricted directory or Program/load policy substitutes for it.

Enabled request submission rechecks current Student identity, obtains the shared fence and actor/target User locks before the Student workflow lock, then re-reads the candidate context and exact reviewed Student/Adviser display context before persisting immutable signed evidence. The earlier UI result cannot authorize submission. Dean approval preserves current `adviser.requests.review`, CONFORME, conditional decision, sole-active-assignment and exact signed-evidence rules. Its enabled transaction shares the same fence, locks the requested academic User/profile, applies the common eligibility predicate, and rechecks exact ODP/source context immediately before finalized-record/assignment creation. A later display-name edit does not rewrite the frozen signed display values or independently prevent valid approval.

`GET /thesis/adviser/available` is now a Student-only compatibility alias of those ODP candidates; the repository's unrestricted directory helper returns 410. The existing assign alias still delegates exclusively to the canonical Dean workflow and cannot substitute a caller-supplied Adviser. No Faculty Management action assigns Students or committees. Existing unavailable-but-assigned Adviser workspace/document authority continues to use exact active AdviserAssignment; addressed requests and historical records are not revoked by this configuration package.

## Explicit unresolved cases and preservation

- **DR-6:** eligibility/activity/availability revoked after a signed request or CONFORME prevents a new assignment with a controlled conflict. No automatic rejection, deletion, new signature, requested-Adviser switch, signed-state change or recovery UX is invented. Pending request/evidence remain unchanged on failure.
- **DR-7:** Internal→External with an active Adviser relationship is a controlled conflict. Existing External-with-active-Adviser anomalies are also held for institutional review rather than repaired or legitimized by configuration; configuration writes against those anomalies are denied. Existing assignments, committee history and GS-020 are retained.
- No Adviser load cap, Program-scoped essay/Adviser authority, permanent committee-role grants, Adviser replacement or academic override.
- FACULTY-9 Expert assignment exclusion, generic audit deletion denial, private-data rules and operational/dashboard guards remain intact. Its old Faculty-exclusion tests transfer to the FACULTY-10 matrix; Expert/audit denials remain tested.
- No schema/migration, frontend, FACULTY-11+, data conversion, production provisioning/grant activation, deployment or main merge. UI for the new create response/strict patch fields belongs to FACULTY-11; Essay Evaluation endpoints remain FACULTY-12.

## Verification and delivery

Smallest tests were run first. The new configuration suite passed its initial 122 cases; one old eligibility fixture lacked explicit `isExternal=false` and was corrected to reflect real profile state. The first new eligibility run passed **36 tests**, and new HTTP/controller suites passed **22 tests**. A directly related 14-file run had **616 passed / 1 failed**: an old External-denial error-text assertion expected the previous sentence. It now asserts the controlled 409 while retaining its no-assignment/no-update assertions; the affected 2-file rerun passed **64 tests**. The first build exposed an incorrect Prisma update-input type; it was corrected to the typed unchecked mutation input while field assignment remains explicitly allowlisted.

Broader verification was justified by shared eligibility, transactional access and existing Adviser history boundaries. Exact command from `backend` (**45 files passed; 1,586 tests passed; 0 failed; 0 skipped**):

```powershell
npx vitest run tests/unit/access tests/unit/services/faculty- tests/unit/routes/faculty- tests/unit/controllers/faculty- tests/unit/services/adviser-request.rules.test.ts tests/unit/services/adviser-request.service.test.ts tests/unit/services/adviser-request-signing.test.ts tests/unit/services/adviser-request-record.service.test.ts tests/unit/services/adviser-workspace.service.test.ts tests/unit/repositories/adviser-workspace.repository.test.ts tests/unit/routes/adviser-workspace.routes.test.ts tests/unit/repositories/thesis.repository.active-adviser.test.ts tests/unit/repositories/admin-panelist.repository.test.ts tests/unit/repositories/administrator-legacy-bypass.test.ts tests/unit/repositories/settings-access-audit.test.ts tests/unit/services/active-adviser.rules.test.ts tests/unit/services/adv5-adviser-document-auth.test.ts tests/unit/services/adv5-document-service-auth.test.ts tests/unit/services/adviser-certification-document.service.test.ts tests/unit/middlewares/auth.middleware.test.ts tests/unit/services/auth.login.test.ts tests/unit/repositories/auth.repository.login.test.ts
```

This is a Vitest path-filter command, not a claim that a full backend suite ran; the nonexistent `active-adviser.rules.test.ts` filter matches no additional file. The actual active-Adviser repository/workspace/document suites are included. Following final collision, conditional-target and Dean-fence regressions, the exact focused rerun was **4 files / 185 tests passed; 0 failed/skipped**:

```powershell
npx vitest run tests/unit/services/faculty-10-configuration.test.ts tests/unit/services/faculty-10-adviser-eligibility.test.ts tests/unit/routes/faculty-10-configuration.routes.test.ts tests/unit/controllers/faculty-10-configuration.controller.test.ts
npm run build
```

Backend `npm run build`: **PASS** after final production changes. Repository-root `git diff --check`: **PASS**. The existing Vite CommonJS/native-loader warning remains; no tooling change. Prior package tests were adapted only for explicitly retired/transferred surfaces (Faculty exclusion, Student-only available alias, retired low-level writer/directory), and the strict Internal fixture/controlled denial assertion. A pure repository flag test now mocks the application database singleton to avoid startup connections.

No full backend suite, browser/manual QA, hosted CI, real-DB business/contention testing, migration execution or deployment validation was performed. New and affected runs use mocked database composition; transaction rollback and lock-order tests prove the modeled contract, not real MariaDB locking/rollback behavior. There was no live account inventory, provisioning, grant mapping or production data access. Real multi-connection fence/target-contention and coordinated activation remain release-readiness work, not claimed acceptance.

Independent remote source/diff review remains required. The ending commit, clean-worktree result and actual post-push remote equality are reported in the delivery response rather than embedded as a self-referential commit hash. Stop after FACULTY-10; FACULTY-11 remains deferred / not started.

## Exact changed files

30 files:

- `backend/src/access/faculty-configuration.ts`
- `backend/src/controllers/admin-panelist.controller.ts`
- `backend/src/middlewares/faculty-capability.middleware.ts`
- `backend/src/repositories/admin-panelist.repository.ts`
- `backend/src/repositories/panelist.repository.ts`
- `backend/src/repositories/thesis.repository.ts`
- `backend/src/routes/admin-panelist.routes.ts`
- `backend/src/routes/panelist.routes.ts`
- `backend/src/routes/thesis.routes.ts`
- `backend/src/services/admin-panelist.service.ts`
- `backend/src/services/adviser-request.rules.ts`
- `backend/src/services/adviser-request.service.ts`
- `backend/src/services/panelist.service.ts`
- `backend/src/services/thesis.service.ts`
- `backend/tests/unit/controllers/faculty-10-configuration.controller.test.ts`
- `backend/tests/unit/repositories/admin-panelist.repository.test.ts`
- `backend/tests/unit/repositories/administrator-legacy-bypass.test.ts`
- `backend/tests/unit/repositories/settings-access-audit.test.ts`
- `backend/tests/unit/routes/faculty-10-configuration.routes.test.ts`
- `backend/tests/unit/routes/faculty-7-defense-adviser.routes.test.ts`
- `backend/tests/unit/routes/faculty-9-operations.routes.test.ts`
- `backend/tests/unit/services/adviser-request.rules.test.ts`
- `backend/tests/unit/services/adviser-request.service.test.ts`
- `backend/tests/unit/services/faculty-10-adviser-eligibility.test.ts`
- `backend/tests/unit/services/faculty-10-configuration.test.ts`
- `backend/tests/unit/services/faculty-3-compatibility.test.ts`
- `backend/tests/unit/services/faculty-9-operations.test.ts`
- `docs/superpowers/GSIS_IMPLEMENTATION_CHECKLIST.md`
- `docs/superpowers/plans/2026-11-08-faculty-admin-access-implementation.md`
- `docs/superpowers/reports/2026-11-09-faculty-10-configuration-adviser-eligibility.md`
