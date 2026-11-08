# FACULTY-11 — Faculty Management UI

Date: 2026-11-09 (Asia/Manila). Branch: `feat/faculty-admin-access`.

**Status: FACULTY-11 accepted for continuation** at `8c554405d39fc9685e71ba380512c4dd0bd9e03d` after independent remote commit-diff/source review. FACULTY-12 remains deferred / not started pending project-owner approval. This accepts source readiness against the dormant FACULTY-10 backend; it is not a live Faculty Management rollout.

Starting local and actual remote HEAD: `630c5819bf4815e16da56073ecb0096ad8b5b260`; worktree clean. Verified before edits using `git branch --show-current`, `git rev-parse HEAD`, and `git ls-remote origin refs/heads/feat/faculty-admin-access`. The initial sandbox SSH attempt was denied; the authorized network retry verified the actual remote. The delivery commit contains this report; its exact SHA and final local/remote comparison are recorded in the delivery response.

## Exact changed files

Frontend production files:

- `frontend/src/app/(portal)/admin/layout.tsx`
- `frontend/src/app/(portal)/admin/users/panelists/page.tsx`
- `frontend/src/components/admin/faculty/faculty-detail.tsx`
- `frontend/src/components/admin/faculty/faculty-form.tsx`
- `frontend/src/components/admin/faculty/temporary-credential.tsx`
- `frontend/src/lib/faculty-management.ts`
- `frontend/src/types/faculty.ts`

Frontend verification files:

- `frontend/scripts/verify-faculty-11-management.mjs`
- `frontend/scripts/faculty-11-fixture-server.mjs`
- `frontend/e2e/faculty-management.spec.ts`

Minimal backend support and directly affected tests:

- `backend/src/routes/admin-panelist.routes.ts`
- `backend/src/controllers/admin-panelist.controller.ts`
- `backend/src/services/admin-panelist.service.ts`
- `backend/tests/unit/routes/faculty-10-configuration.routes.test.ts`
- `backend/tests/unit/controllers/faculty-10-configuration.controller.test.ts`
- `backend/tests/unit/services/faculty-10-configuration.test.ts`

Documentation:

- `docs/superpowers/plans/2026-11-08-faculty-admin-access-implementation.md`
- `docs/superpowers/GSIS_IMPLEMENTATION_CHECKLIST.md`
- `docs/superpowers/reports/2026-11-09-faculty-11-management-ui.md`

No dependency, schema, migration, seed, activation constant, production mapping, or account data changed.

## Information architecture and interaction

The existing technical route `/admin/users/panelists` now presents **Faculty Management**. The shared PageHeader owns page identity and Create Faculty. A wide management table supports name/email/affiliation/specialization search, Internal/External and Active/Inactive filters, clear-filter recovery, and ten-row client pagination. Rows show identity/email, classification, effective account status, Essay Evaluation, Adviser availability, and View. The list does not fetch assignment history or unrelated administrative data.

View opens an independently fetched, bounded detail dialog: Faculty Profile, Account Status, Faculty Access, Adviser Availability, and secondary Account Activity. Edit opens the persisted detail in a separate form. Account status changes require an inline consequence confirmation within the established shared Dialog. Ordinary reversible configuration edits use normal Save feedback.

Create/edit, detail, and one-time credential handoff are separate components. Existing Card, PageHeader, Badge, Button, Input, Label, Switch, Skeleton and Base UI Dialog primitives provide the visual and keyboard behavior. Filters stack at narrow widths; the comparison table scrolls within its container. Dialogs scroll within the viewport. Credential close has an explicit final-focus target because the creation form's submit button no longer exists after handoff. Switches explicitly disable during pending, view-only, and confirmation states; External availability is additionally disabled.

Initial structural loading, failed request with Retry, genuine empty registry, and filtered no matches are distinct. Background refresh retains rows while withholding mutation authority. A failed refresh replaces the data surface with its truthful error rather than presenting stale rows or a false empty state. Focused tests verify slash-delimited active navigation on the retained route and descendants.

Only the User Management **Panelists → Faculty** label changes in the Admin shell. Custom Roles remains; no Administrators destination or unrelated navigation changes were introduced.

### Optional assignments deferred

The accepted Faculty-management DTO has no authoritative bounded assignment summary. The optional section is omitted. No broad Defense/Student API is queried, no count/history is inferred, and no private workflow evidence is added to `faculty.view`. Adding an assignment projection would increase this package's privacy surface without being necessary for its canonical account/configuration task.

## Backend support and view/manage presentation

There was no existing authoritative page-specific view/manage projection. Added only `GET /api/admin/panelists/management-context`, registered before `/:id`. It uses the existing JWT/current-account, ADMIN and `requireFacultyCapability("faculty.view")` guards. The service also enforces the existing dormant gate and `faculty.view`, then consults the accepted OperationalAuthorization resolver. Its entire success response is `{ canManage: boolean }`, with `Cache-Control: private, no-store`. It exposes no raw actor grants, access level, or unrelated modules and reads no Faculty/Student/Defense records.

The page loads this context and the bounded list in parallel. Only server `canManage: true` permits create/edit, and controls fail closed while refresh is pending or failed. Queries are partitioned by the signed-in account ID; that ID is cache context, not inferred permission. Authority refreshes on mount and window focus. The detail shares the same account partition. There is no role/email inference, fake grant array, generic capability client, or generic permission endpoint. Existing backend mutation checks remain authoritative for tampered/guessed requests and revocation.

`FACULTY_CONFIGURATION_ENABLED` remains **false**, with no new activation mechanism. Normal dormant reads, writes, and the new context read return controlled 503. The UI says Faculty Management is currently unavailable and offers Retry; it does not pretend management is live.

## Read and mutation contracts

The new `FacultyResponse` describes the accepted FACULTY-10 DTO, separately from defense-participant types. Its display mapper copies explicit fields: profile/User IDs, names/title/suffix/email, nullable qualification/affiliation/specialization, account/profile activity, Internal/External, effective Adviser availability, Essay Evaluation, and bounded creation/update names/times. Account status requires both User and profile active; External effective availability is false. Raw role/grant keys and credentials are excluded from the display model and list/detail query cache.

POST `/admin/panelists` and PUT `/admin/panelists/:id` use the same explicit allowlisted payload builder:

| Form value | Submitted field/value |
| --- | --- |
| Email, first name, last name | `email`, `firstName`, `lastName`; trimmed strings |
| Title, suffix | `title`, `suffix`; trimmed strings or null |
| Qualification | `highestEducationalAttainment`; trimmed string or null |
| Office / affiliation | `officeAffiliation`; trimmed string or null |
| Specialization | `specialization`; trimmed string or null |
| Active / Inactive | `isActive`; boolean |
| Internal / External | `isExternal`; boolean |
| Available as Adviser | `isAvailableAsAdviser = !isExternal && selectedAvailability` |
| Essay Evaluation | `capabilityKeys = ["essay.evaluate"]` if selected, otherwise `[]` |

No arbitrary properties are spread into a request. There is no password/reset input or submitted `password`, no Admin configuration, Program evaluator relation, or committee-role control. New creation defaults to active/Internal, unavailable as Adviser and no direct grant. The backend retains responsibility for new Faculty identity and mandatory first-sign-in password change.

Changing to External clears and disables Adviser availability, and the payload independently forces it false. Returning to Internal does not silently restore a previous true value. Internal Faculty can explicitly enable availability. Helper copy states that availability concerns new assignments and preserves current/history relationships; no assignment editing or load counters exist.

Successful writes invalidate the Faculty query prefix, refreshing the list and invalidating detail for its next read. The UI shows the persisted read model rather than inserting draft form values. Errors preserve useful drafts. Controlled DR-7 409 retains the attempted form classification and explains institutional review; no silent reclassification, relationship repair or assignment ending occurs. Duplicate-identity 409 has a safe email message. Validation 400, authenticated denial 403, expired session 401, unavailable 503, missing record 404 and unexpected failures have safe distinct handling. Existing 401 sign-out/session recovery and authenticated 403 behavior remain unchanged. Unknown server text is not copied into UI.

## Temporary credential handling

Successful POST `{ account, temporaryPassword }` opens an intentional **Temporary password** handoff with first-sign-in change instruction, Copy, selectable fallback and Done. It uses ordinary awaited API work instead of a React Query mutation, so the raw creation response never enters a query/mutation cache. The password exists only in the success dialog's parent component state and is cleared on Done, Escape, close button, or backdrop close. It is absent on later list/detail/edit reads and discarded on page unmount/reload.

No URL/query state, browser storage, logging, audit, email or automatic delivery is introduced. Clipboard writing happens only after Copy. No surname/default-password copy or editable password field remains in this management surface.

## Verification evidence

Commands below were run locally from the indicated directory. No full repository sweep was needed: backend changes are one page-specific read and existing guards/writes remain intact.

| Directory | Command | Result |
| --- | --- | --- |
| `frontend` | `node scripts/verify-faculty-11-management.mjs` | PASS: 20 tests; real mapper/payload/filter/error functions and component event handlers with synthetic hook/API/query seams, plus critical source boundaries/navigation |
| `frontend` | `node node_modules/typescript/bin/tsc --noEmit` | PASS |
| `frontend` | `node node_modules/eslint/bin/eslint.js 'src/app/(portal)/admin/users/panelists/page.tsx' 'src/app/(portal)/admin/layout.tsx' src/components/admin/faculty/faculty-form.tsx src/components/admin/faculty/faculty-detail.tsx src/components/admin/faculty/temporary-credential.tsx src/lib/faculty-management.ts src/types/faculty.ts e2e/faculty-management.spec.ts scripts/verify-faculty-11-management.mjs scripts/faculty-11-fixture-server.mjs` | PASS; verifier lint also rerun after its final assertions |
| `frontend` | `npm run build` | PASS: compilation, TypeScript, all 68 static pages, including retained Faculty route; final build rerun after account-scoped authority/focus refinements |
| `backend` | `npm test -- --run tests/unit/services/faculty-10-configuration.test.ts tests/unit/routes/faculty-10-configuration.routes.test.ts tests/unit/controllers/faculty-10-configuration.controller.test.ts` | PASS: 3 files / 156 tests; zero skips/failures |
| `backend` | `npm run build` | PASS |
| repository root | `git diff --check` | PASS |

Non-blocking existing build/runtime warnings concern the Next middleware convention, Node module registration deprecation and Vitest configuration loading. They were not changed in this package.

### Browser and visual evidence

The optional `agent-browser` CLI was unavailable. Used the repository's installed Playwright and Chrome with an isolated synthetic preview:

1. From `frontend`, run `node scripts/faculty-11-fixture-server.mjs` in a separate process.
2. In PowerShell: `$env:E2E_FACULTY_FIXTURE='1'; $env:E2E_BASE_URL='http://localhost:4311'; node node_modules/@playwright/test/cli.js test e2e/faculty-management.spec.ts --project=chrome`.

**PASS: 3 Chrome scenarios.** Desktop list/detail/edit, active Faculty navigation, Internal/External filtering and controls, Essay Evaluation, status confirmation, controlled 400/409 draft preservation, successful persisted refresh, view-only controls, narrow 390px viewport, keyboard filter traversal/switch operation/dialog Escape/reopen/focus restoration, create defaults, one-time password Copy, storage absence and later-detail absence, loading, genuine/filtered empty, 503/403 recovery and Retry were exercised. The desktop flow recorded zero uncaught page errors; no framework error overlay was present in the tested recovery state.

Initial test selectors needed adjustment for Base UI's switch plus hidden input and Next's separate route-announcement alert. A strengthened keyboard check then found lost focus when the credential handoff closed after its originating form had unmounted; an explicit final-focus target fixed it and the complete three-scenario browser run passed. A subsequent bounded review explicitly disabled non-native switches during pending/view-only/confirmation; the final focused verifier covers those disabled props.

Desktop, mobile list and mobile form screenshots were generated under ignored `frontend/test-results/faculty-11-*.png` and visually inspected. Responsive table overflow is confined to its container; the narrow page has no document-wide horizontal overflow. The fixture preview was stopped after QA. It runs only loopback synthetic auth/data and does not start the real backend, change any production gate, or touch a database.

This is automated browser interaction plus screenshot inspection, **not project-owner manual acceptance**. Live database/provisioning/permission rollout and exhaustive assistive-technology QA were not executed. The 401 message is covered by focused runtime tests; a live expired-session browser journey was not executed. Hosted CI was **NOT OBSERVED**. Independent remote source review remains pending.

## Stop and preserved boundaries

No schema/migration, account conversion, live activation, production Faculty provisioning, email delivery, password-reset management, committee/Adviser assignment, load policy, Faculty portal/essay workflow, Administrators Management, generic permission-aware sidebar, or Custom Roles retirement was implemented. No merge to `main`. Stop after FACULTY-11; FACULTY-12 remains deferred / not started.


## Independent-review acceptance — 2026-11-09 (Asia/Manila)

Independent remote commit-diff/source review is complete for FACULTY-11 commit `8c554405d39fc9685e71ba380512c4dd0bd9e03d`. The live `feat/faculty-admin-access` branch was verified at that exact implementation SHA during review, and the pushed range was reconciled as one commit changing exactly 19 files.

The review independently verified the new Faculty Management list/detail/create/edit flow, the User Management **Faculty** navigation label on the retained technical route, strict FACULTY-10 request mapping, Internal/External behavior, Internal-only Adviser availability, Essay Evaluation presentation, status confirmation, truthful loading/error/empty states and removal of legacy Panelist-account/password-reset behavior. The one-time temporary credential remains outside React Query/browser storage/URLs and is cleared when the handoff closes; ordinary Faculty read models do not contain the credential.

The page-specific `GET /api/admin/panelists/management-context` support read was accepted as a bounded FACULTY-11 seam: it is registered before `/:id`, requires current Administrator plus `faculty.view`, reuses the accepted current OperationalAuthorization resolver, returns only `{ canManage: boolean }`, reads no Faculty/Student/Defense records, uses `Cache-Control: private, no-store`, and remains behind the same dormant Faculty-configuration gate. It does not expose raw grants/access levels or create the generic capability-aware Admin client reserved for later packages. Mutation APIs remain authoritative even when UI controls are hidden or disabled.

Optional Faculty assignment summaries remain intentionally deferred. No safe bounded summary exists in the accepted FACULTY-10 DTO, and FACULTY-11 does not widen `faculty.view` into Student/Defense history solely for decoration.

Evidence classes remain separate. Codex reported 20 focused frontend checks and 156 focused backend tests PASS, TypeScript/scoped ESLint PASS, frontend/backend builds PASS and diff checks PASS. Codex also reported three synthetic Chrome scenarios PASS with desktop/mobile screenshots visually inspected. The independent review inspected the pushed source/diff, tests and E2E source; it did not independently rerun those local commands or inspect the ignored screenshot artifacts. GitHub hosted CI/status workflows were not observed. Project-owner manual acceptance remains separate.

**Acceptance checkpoint:** FACULTY-11 is accepted for continuation at `8c554405d39fc9685e71ba380512c4dd0bd9e03d`. Faculty Management remains code-owned/dormant with controlled 503 behavior; no schema/migration, data conversion, production provisioning, live permission activation, generic permission-aware Admin navigation or later Faculty package is accepted by this checkpoint. FACULTY-12 remains deferred / not started pending explicit project-owner approval.
