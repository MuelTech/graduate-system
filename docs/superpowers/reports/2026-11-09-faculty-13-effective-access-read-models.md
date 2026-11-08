# FACULTY-13 — Effective-access and Faculty-work read models

Date: 2026-11-09 (Asia/Manila). Branch: `feat/faculty-admin-access`.

**Status: FACULTY-13 accepted for continuation** at `584360296c43a63c74045d6eacc111a05bcf548c` after independent remote commit-diff/source review. FACULTY-14 remains deferred / not started pending project-owner approval.

Starting local and actual remote HEAD: `7e76882bd6628ed6a340d0308369b5051fad887c`. Worktree was clean. Before edits, verified branch, local HEAD and `git ls-remote origin refs/heads/feat/faculty-admin-access`. The sandbox SSH attempt was denied; the authorized network retry verified the actual remote. Ending commit and final local/remote comparison are reported at delivery, avoiding a self-referential commit hash here.

## Pre-implementation coverage ledger

Captured in the chat before production edits and reproduced here. The live Faculty/Admin source of truth, design, plan section 3.4/FACULTY-13, FACULTY-12/11/10 reports, Defense source of truth, Student Journey reference, checklist and verification policy supplied the bounded authority review. This is a self-access read-model ledger, not a new architecture audit.

Every work value below is a presentation hint only. It never authorizes an operation. Sensitive exclusions apply to `/auth/me`; exact workflow APIs retain their separate permitted projections and authorization.

| Source / existing authority | Exact current-account ownership | Permitted reduction | Fields excluded from self-access | Failure / integrity semantics |
| --- | --- | --- | --- | --- |
| `auth.routes.ts`, `AuthController`, `loadCurrentAccount`, `currentAccountResponse` | Signed token supplies only User ID; fresh persisted User establishes current role/activity/credential state | Preserve the existing own identity/configured-access DTO; append `facultyWork` | Password hash, private profile/account graph, other accounts | Existing 401/403/503 authentication semantics; invalid credential state denied; required password change returns unavailable access and null work |
| `resolveConfiguredAccountAccess`, `ACCOUNT_ACCESS_SELECT`, capability catalog | Exact current User's `administratorAccess` and `capabilityGrants` | Existing resolution status, level, own resolved keys | Other users' grants, target Faculty Management grants, catalog descriptions/hidden metadata | Missing/invalid Admin level, malformed/unknown/duplicate/wrong-category grants retain explicit denied status and null work; zero-grant valid Restricted remains RESOLVED |
| Configured Faculty `essay.evaluate` | Current active `FACULTY` or legacy-compatible `PANELIST` with valid resolved academic configuration | `essayEvaluations.relevant` from the grant alone | Applicant/application IDs, essay answers, evaluator drafts, scores, exam queue | Invalid configuration gives null work; no queue call or copied B7 eligibility; External classification does not suppress a valid grant |
| `AdviserAssignment`, `AdviserWorkspaceRepository`, workspace's `resolveSingleActiveAdviser` invariant | Own `adviserId`, `isActive=true`; nested active assignments include ALL Advisers of each candidate Student | Sole-active-advisee count | Student identities/numbers, profile, thesis, manuscripts, review remarks | Canonical resolver detects duplicates across own or different Advisers; controlled 409 with the existing workspace message; missing/different sole authority also 409; DB failure 503 |
| `AdviserRequestService.listMyAdviserRequests` | `requestedAdviserId === current User ID`, no status/availability/classification cutoff | Count of all own addressed GS-020 requests, including history | Request/Student/schedule IDs, reasons, signatures, names/emails/remarks | Count-only reader uses the existing inbox predicate; failures propagate as 503, never empty work |
| `AdviserCertificationRecordService.listSources` academic branch | `adviserId === current User ID`, `status=ISSUED`, Proposal/Final defense stage | Count of exact own issuer records | Certification/thesis/document IDs, signatures, manuscript title/path, private Student content | Same academic list ownership/stage/status scope; no current-assignment or recency requirement; DB failure 503. Count does not certify renderability or replace exact source/document validation |
| `ProposalAdviserReviewService.listReviewTasks`, `FinalAdviserReviewService.listReviewTasks`, `AdviserWorkspaceService` | Queues first require the current User's sole active Adviser relationship | No additional count required: every legitimate review task already contributes active-advisee relevance | Task state, manuscripts, document IDs, remarks | Reuse the active relationship invariant; do not query detailed queues, duplicate review state machines or inherit their per-Student queries |
| `PanelistDashboardRepository.getAssignments`, `DefenseWorkspaceService`, `DefenseHistoryService.assertAssignedToCurrent` | Exact own `PanelAssignment.userId` and `isActive=true`, independent of committee role | Count of readable own assignments | Student/schedule/assignment IDs, grades, verdicts, evaluator drafts, notes/signatures | Same accepted assignment-read predicate, no date/session-status cutoff; concluded history stays represented. Corrected inactive rows confer no entry authority; DB failure 503 |

## Additive self-access contract

The only generic self-access endpoint remains **GET `/api/auth/me`**. The controller composes `EffectiveAccessService` after `authenticateJWT` establishes `req.currentAccount`. `currentAccountResponse()` and its original synchronous contract remain unchanged.

Existing fields are preserved exactly:

```ts
{
  user: { id, email, role, mustChangePassword },
  configuredAccess: { status, administratorLevel, capabilities },
  directAccessEnforcementEnabled,
  // Only new field:
  facultyWork: {
    essayEvaluations: { relevant: boolean },
    myAdvisees: {
      relevant: boolean,
      activeAdviseeCount: number,
      addressedRequestCount: number,
      issuedCertificationCount: number
    },
    myDefenses: { relevant: boolean, assignmentCount: number }
  } | null
}
```

`facultyWork` is populated only for resolved academic accounts. A valid academic account with no work receives all false/zero values. Admin, Student, Applicant and CUSTOM receive null. An academic account whose configured access is invalid/unavailable receives null alongside the existing explicit non-RESOLVED status, never a fabricated successful zero summary. `mustChangePassword=true` preserves `configuredAccess.status=UNAVAILABLE` and null work without querying workflow sources. Account/profile inactivity remains denied by the existing authentication loader.

`Cache-Control: no-store` is preserved on successes and controller failures, and is now set before authentication on this exact route so authentication failures also carry it. No server-side cache, second generic endpoint, JWT capability authority, frontend state input, alternate-account lookup or account matching by email/name is introduced.

## Work semantics and authority boundaries

Essay relevance comes exclusively from the current configured `essay.evaluate` grant. It stays true for an empty pending queue and for valid External Faculty. No FACULTY-12 grading queue, B7 evidence scan or pending-count logic runs. FACULTY-12 stays dormant and independently reauthorizes its exact reads/writes.

My Advisees is relevant if any of its three counts is positive. The active relationship reader selects only candidate Students' complete active assignment sets and uses the canonical sole-active resolver. It is one Prisma relation read with no per-Student application calls and no loaded Student profile/thesis/review content. A second active Adviser is a conflict rather than ordinary counted work. Nothing rewrites assignments.

The addressed-request reader counts the same exact own inbox as `listMyAdviserRequests`, including pending CONFORME and pending Dean review before any assignment exists. It deliberately counts historical inbox entries too, matching that accepted inbox's visibility rather than inventing a status cutoff. Availability=false or later External classification does not erase an already-addressed request. GS-020 response/Dean transition authority is unchanged.

The own-issued GS-017 reader counts only the existing academic issuer-list predicate. It retains context after a relationship ends, without exposing record data, checking current availability, inventing a recency cutoff or granting current Student/Adviser authority. Another Faculty member's certification cannot count. Exact GS-017 reads/PDFs continue their own ownership/source/document checks.

My Defenses counts exact own active assignment rows using the same read authority as the dashboard/workspace/history entry point. `isActive` describes assignment authority, not whether the session is ongoing: a legitimately readable concluded assignment remains counted regardless of age. Scheduled, ongoing, concluded and cancelled contexts use the existing read predicate; no new session-status policy is invented. An old corrected/removed inactive row does not count. The historical attempts reachable through a current schedule's history are not separately counted as new assignments. Adviser requests, review queues, RAP slots and `pendingTasks` aggregates do not feed this count. Chairman/Panelist/Rapporteur/Facilitator/Adviser remain contextual roles.

Admin retains only its own current configured level/capabilities. Full resolves the existing enumerated administrative catalog without Faculty essay authority; valid Restricted with zero grants receives an authenticated RESOLVED empty capability list and null Faculty work. No Admin operational aggregates or matching Faculty accounts are queried.

These booleans/counts authorize nothing: essay relevance cannot grade, My Advisees cannot authorize a guessed Student/thesis, My Defenses cannot authorize a guessed schedule, and Admin summaries cannot replace endpoint guards. No middleware accepts a summary as authority. Automated negative checks obtain true work summaries and still receive 404/403 from the existing exact Adviser/Defense services for guessed resources.

## Failure, freshness and privacy

All workflow readers execute anew on every valid academic self-access request. Subsequent requests reflect grant changes, relationship creation/end, addressed requests/transitions, new own-issued records, Defense assignment changes and current account/profile/password readiness. Request transitions that retain accepted inbox visibility retain relevance. There are no new transactions, locks, mutations, realtime subscriptions or persistence.

Unexpected reader/database errors become a controlled generic 503; they do not become zero counts or stale prior work. Known authority-integrity conflicts retain controlled 409 semantics and no partial success body. Negative, non-integer, unsafe or unavailable counts also fail with 503. `configuredAccess.status` continues distinguishing invalid/unavailable configuration from a valid no-grant/no-work account. No granted work is returned on either kind of failure.

The new output consists exclusively of booleans and finite nonnegative safe integer counts. It excludes Student IDs/numbers, Applicant/application IDs, thesis IDs, schedule/assignment/request/document/certification IDs, signatures/signature data, password hashes, other-user emails, manuscript metadata/text/file paths, private evaluator drafts, grades, verdicts, notes, private profiles and raw audit rows. Existing self User ID/email remain part of the accepted identity contract. Count readers never load detailed request/certification/Defense objects or signature material; the Adviser integrity read uses only internal assignment/Adviser identities and does not serialize them.

## Verification actually executed

All tests/builds ran from `backend`; diff checks ran from the repository root. Synthetic database delegates exercise the real HTTP route, authentication loader, configured resolver, service and bounded readers; no live database or grants were used.

| Check | Result |
| --- | --- |
| Initial smallest suite | 63/64 passed; authentication-error no-store header was absent. Added the route-local header before authentication. |
| Smallest suite after correction | 1 file / 64 tests PASS |
| Directly affected regression command below | **30 files / 922 tests PASS**, zero failures/skips |
| Final focused suite after expanding all responsibility combinations to both FACULTY and PANELIST: `npm test -- --run tests/unit/routes/faculty-13-effective-access.routes.test.ts --maxWorkers=4` | **1 file / 72 tests PASS**, zero failures/skips |
| `npm run build` after final production changes | **PASS**, TypeScript exit 0 |
| Repository-root `git diff --check` | **PASS** |
| Frontend/browser/manual QA | NOT EXECUTED; no frontend change |
| Hosted CI | NOT OBSERVED; no hosted PASS claimed |
| Real DB/migrations/contention | NOT EXECUTED; no new locks/transactions/schema. FACULTY-12's five-case isolated MariaDB contention readiness gate remains unverified/open |

The affected run includes current auth, account access/catalog, Adviser workspace/request/signing/records/documents, dashboard/Defense history/workspace, FACULTY-10 configuration/eligibility and FACULTY-12 authorization. No full backend sweep. The final focused expansion changes only the synthetic test matrix; the prior 30-file result is reported separately rather than inflated to an unexecuted combined total. The existing Vite native-loader/CommonJS configuration warning remains unchanged.

```powershell
npm test -- --run tests/unit/routes/faculty-13-effective-access.routes.test.ts tests/unit/middlewares/auth.middleware.test.ts tests/unit/services/auth.login.test.ts tests/unit/repositories/auth.repository.login.test.ts tests/unit/access/account-access.test.ts tests/unit/access/account-access.store.test.ts tests/unit/access/capability-catalog.test.ts tests/unit/services/adviser-workspace.service.test.ts tests/unit/repositories/adviser-workspace.repository.test.ts tests/unit/routes/adviser-workspace.routes.test.ts tests/unit/services/adviser-request.service.test.ts tests/unit/services/adviser-request.rules.test.ts tests/unit/services/adviser-request-signing.test.ts tests/unit/services/adviser-request-record.service.test.ts tests/unit/services/adviser-certification-document.service.test.ts tests/unit/services/adv5-adviser-document-auth.test.ts tests/unit/services/adv5-document-service-auth.test.ts tests/unit/services/panelist-dashboard.service.test.ts tests/unit/services/panelist-dashboard.rules.test.ts tests/unit/repositories/panelist-dashboard.repository.test.ts tests/unit/services/defense-history.service.test.ts tests/unit/services/defense-history.rules.test.ts tests/unit/services/defense-workspace.service.test.ts tests/unit/services/defense-workspace.manuscript-binding.test.ts tests/unit/services/faculty-10-configuration.test.ts tests/unit/services/faculty-10-adviser-eligibility.test.ts tests/unit/routes/faculty-10-configuration.routes.test.ts tests/unit/controllers/faculty-10-configuration.controller.test.ts tests/unit/repositories/faculty-12-essay-evaluation.test.ts tests/unit/routes/faculty-12-essay-evaluation.routes.test.ts --maxWorkers=4
npm run build
```

## Exact changed files

Production backend (7):

- `backend/src/controllers/auth.controller.ts`
- `backend/src/repositories/adviser-workspace.repository.ts`
- `backend/src/repositories/panelist-dashboard.repository.ts`
- `backend/src/routes/auth.routes.ts`
- `backend/src/services/adviser-certification-record.service.ts`
- `backend/src/services/adviser-request.service.ts`
- `backend/src/services/effective-access.service.ts`

Verification (1):

- `backend/tests/unit/routes/faculty-13-effective-access.routes.test.ts`

Documentation (3):

- `docs/superpowers/GSIS_IMPLEMENTATION_CHECKLIST.md`
- `docs/superpowers/plans/2026-11-08-faculty-admin-access-implementation.md`
- `docs/superpowers/reports/2026-11-09-faculty-13-effective-access-read-models.md`

## Preserved scope and stop

No schema, migration, frontend, login/redirect/sidebar/dashboard change, FACULTY-14+ implementation, scoring/review/GS-020 transition change, operational dashboard aggregate, account conversion/provisioning, real grant, live enforcement, environment/request/database activation switch, deployment or merge to main. FACULTY-10/12 and direct-access activation constants remain false. No real-DB readiness gate was closed. Independent remote commit-diff/source review is complete. The live `feat/faculty-admin-access` branch was verified at `584360296c43a63c74045d6eacc111a05bcf548c` during review. Stop after FACULTY-13; FACULTY-14 remains deferred / not started pending explicit project-owner approval.


## Independent-review acceptance — 2026-11-09 (Asia/Manila)

Independent remote commit-diff/source review is complete for FACULTY-13 commit `584360296c43a63c74045d6eacc111a05bcf548c`. The live `feat/faculty-admin-access` branch was verified at that exact implementation SHA, and the pushed range from `7e76882bd6628ed6a340d0308369b5051fad887c` was reconciled as one commit changing exactly 11 files.

The review verified that `GET /api/auth/me` remains the single generic self-access endpoint and preserves its existing `user`, `configuredAccess`, and `directAccessEnforcementEnabled` fields while additively returning only a minimized `facultyWork` projection. The response is derived from the fresh persisted current account established by authentication, never from stale JWT role/capability claims or a matched alternate account.

Faculty work is populated only for a resolved academic account. Required password change, inactive account/profile, malformed configured access, wrong-category/duplicate/unknown grants and other invalid authority states do not expose usable work. A valid academic account with genuinely no work receives a truthful all-false/all-zero summary; a workflow read/integrity failure returns a controlled error rather than silently fabricating empty work. `Cache-Control: no-store` remains in force, including authentication/read failures on the self-access route.

Essay Evaluation relevance comes only from the current resolved `essay.evaluate` grant, including valid External Faculty and valid zero-pending-work states; FACULTY-12 queue/B7 eligibility is not duplicated or queried for navigation. My Advisees relevance is reduced from the accepted sole-active-Adviser invariant, exact addressed GS-020 ownership and exact own-issued GS-017 issuer scope. Pending addressed requests remain represented before assignment/Dean approval, and historical addressed/issuer context is not erased by availability, later External classification or an invented recency cutoff. Multiple-active-Adviser corruption preserves the existing fail-closed conflict instead of being normalized into an ordinary count.

My Defenses uses the same current exact `PanelAssignment.userId + isActive=true` read predicate used by the Panelist dashboard and the current-schedule Defense History entry authority. There is no date/session-status cutoff, so legitimately readable concluded assignment context remains represented; corrected inactive assignments do not. Adviser work, Essay Evaluation access and aggregate pending-task counts do not fabricate Defense relevance, and committee roles remain contextual rather than account permissions.

The added self-access data consists only of booleans and nonnegative counts. The review found no new Student numbers/IDs, Applicant IDs, thesis/schedule/request/document/certification IDs, signatures, manuscript data, evaluator drafts, grades, verdicts, other-user email, audit rows or credentials in the Faculty work projection. The projection is explicitly presentation-only: exact Essay, Adviser and Defense APIs continue to reauthorize guessed/deep-linked resources independently.

Admin behavior remains current-account-only. Full and Restricted Administrator access continues through the accepted configured-access resolver; a valid Restricted Admin with zero grants remains authenticated with a resolved empty capability list and `facultyWork=null`. FACULTY-13 does not search for a matching Faculty account by name/email or query Admin operational dashboard aggregates.

No acceptance-blocking authorization, privacy, read-model or scope issue remained. No schema/migration, frontend, login/redirect/sidebar/dashboard change, grant provisioning, live enforcement, activation switch or FACULTY-14+ implementation was included.

Evidence classes remain separate. Codex reported 30 affected files / 922 tests passed, a final focused 72-test suite PASS, backend build PASS and repository-root diff check PASS. The independent review inspected the pushed production source, focused tests and underlying Adviser/Defense ownership rules; it did not rerun those local commands. GitHub hosted CI was not observed, and browser/manual QA was not executed because this package changed no frontend. FACULTY-13 introduced no new lock/transaction behavior, so no new real-DB contention run is required for this package. The previously recorded FACULTY-12 five-case isolated MariaDB contention gate remains open and is not closed by this acceptance.

**Acceptance checkpoint:** FACULTY-13 is accepted for continuation at `584360296c43a63c74045d6eacc111a05bcf548c`. The effective-access/work projection remains a read-only presentation seam; no live Faculty/Admin enforcement is activated. FACULTY-14 remains deferred / not started pending explicit project-owner approval.
