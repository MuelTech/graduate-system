# FACULTY-14 — Faculty portal and Essay Evaluations UI

Date: 2026-11-09 (Asia/Manila). Branch: `feat/faculty-admin-access`.

**Status: FACULTY-14 accepted for continuation** at `cbf15478e38d3c483c417e45888aefd6577ed303` after independent remote commit-diff/source review. FACULTY-15 remains deferred / not started pending project-owner approval. Project-owner manual/visual QA remains pending and separate from this source-continuation acceptance.

Starting local and actual remote HEAD: `3978de6bc12192e7ef6f8262c38fe35962a3f259`. Worktree was clean. Branch/local HEAD and `git ls-remote origin refs/heads/feat/faculty-admin-access` were verified before editing. The actual remote matched the requested starting commit. The ending commit and final local/remote comparison are reported at delivery rather than embedded as a self-referential SHA here.

## Pre-implementation ledger

Recorded in the chat before edits, reproduced with the implemented seams below. Authority remains the live Faculty/Admin source of truth/design/plan, accepted FACULTY-12/13 contracts, accepted Adviser/Defense workflows, Copy Source of Truth and UI/UX playbook. The old UIUX-3A Dashboard remains an unaccepted visual reference; the new hierarchy uses shared primitives and accepted My Defenses/My Advisees patterns instead. This is a bounded integration ledger, not another general architecture audit.

| Area / current source | Accepted authority | FACULTY-14 change | Technical compatibility / exclusions |
| --- | --- | --- | --- |
| Login page; `backend/src/services/auth.service.ts` | Persisted User and server-selected-role validation | Exactly Applicant / Student / Faculty / Administrator; new `faculty` server selector accepts both academic identities | Internal `panelist` alias and `other`/CUSTOM infrastructure remain; no stored-role conversion, role inferred from email, or registration redesign |
| `auth.ts`, `current-session.ts`, `account-role.ts` | NextAuth synchronizes fresh `/auth/me` identity; update payloads never supply authority | After sign-in, obtain refreshed session and map its actual identity through `academicPortalRole`; wait for initial session bootstrap | Both academic identities enter `/panelist/dashboard`; no `/faculty` tree or workspace chooser; credential gate retained |
| Faculty technical layout; accepted `/auth/me` `facultyWork` | Exact semantic relevance flags, never profile availability or token capability claims | Faculty Portal wording, conditional work links, common destinations and guarded direct-route presentation | `/panelist` and canonical/legacy Defense route families remain; no Admin navigation or new resource-authorization helper |
| Faculty Dashboard; `/thesis/defense/panelist/dashboard` | FACULTY-13 controls area relevance; existing detailed reader supplies only owned tasks | Relevant work rows and CTAs, bounded summaries, optional Needs Your Attention preview | No detailed reader for evaluator-only/no-work accounts; no queue scan for Dashboard totals; `pendingTasks` never becomes access authority |
| Profile; `GET /panelists/me` | Existing own safe profile | Read-only Faculty Profile: classification, specialization, affiliation, qualification | Remove Switch/mutation completely; no PATCH availability call, disabled legacy toggle or Faculty Management controls |
| My Advisees workspace and compatibility routes | Sole Adviser, addressed request and own issuer rights remain exact backend rules | Conditional integration only; addressed-only and issuer-only context can reach existing workspace | Keep `/panelist/advisees`, `?tab=requests`, `?tab=reviews`, request/review detail contexts and existing actions |
| My Defenses / immersive Defense Workspace | Exact backend schedule/committee authority | Conditional registry/navigation entry, preserved immersive chrome omission | Keep `/panelist/defenses`, `/panelist/defense-workspace/[scheduleId]`, legacy redirects, actual Panelist role wording and all academic actions |
| FACULTY-12 queue/detail/grade/media | Current academic grant and exact pending evidence rechecked by backend | New narrow queue/detail, semantic content, exact image loader, immutable-grade confirmation | No broad Admin Exam Record, legacy grade writer, MCQ/result/threshold/email/Start Now controls or copied B7 logic |
| React Query / API helper | Fresh own `/auth/me`; exact workflow APIs always reauthorize | Account-keyed access/Essay/profile/Dashboard queries; isolated private Faculty client; foreground/denial/mutation refresh | Existing legacy workspace keys remain safe inside the per-account cache; no persistent academic browser cache or client permission authority |
| NotificationBell and deep links | Existing owned notifications and academic routing helper | Scope bell queries by User ID; retain academic paths | No historical notification URL rewrite, new permission, or global Defense-role rename |

## Login and portal mapping

The ordinary selector now contains exactly **Applicant / Student / Faculty / Administrator**. Faculty submits `role: "faculty"`; AuthService validates the actual persisted User with `isAcademicAccountRole(user.role)`. Stored FACULTY and legacy PANELIST are both accepted, without rewriting either identity. ADMIN, CUSTOM, STUDENT and APPLICANT cannot authenticate through Faculty; academic accounts cannot authenticate through Administrator. The old `panelist` selector remains an internal compatibility alias. Backend CUSTOM/CustomRole infrastructure is untouched.

The selected form value no longer constructs a destination. After successful sign-in the page calls `getSession()` and `loginDestination()` on that server-synchronized identity. Both actual academic roles map to `/panelist/dashboard`; Applicant, Student and Admin map to their existing dashboards. Required password change maps to `/change-password`; unavailable/unsupported session identity produces a safe error, without a selected-role fallback. Initial sign-in waits until SessionProvider bootstrap finishes, preventing the observed initial CSRF-cookie race without disabling CSRF protection or altering NextAuth internals.

## Current access, navigation and cache

`FacultyPortalProvider` uses the authenticated session only to identify the current account, then `AccessReader` requests `/auth/me` with no-store. `readFacultyWork()` validates same User ID, academic account identity, password readiness, RESOLVED configured status and bounded boolean/nonnegative-integer work shape. It copies only the semantic work fields. Null/malformed/unavailable work is an error, not a fabricated all-zero state. No raw capability keys enter the Faculty UI model.

Dashboard and common Profile, E-Signatures, Repository, Announcements and Notifications destinations remain. Essay Evaluations, My Advisees and My Defenses appear only for the corresponding `relevant === true` flag. This supports evaluator-only, Adviser-only, addressed-request-only, issuer-record-only, Defense-only, all mixed combinations, External Faculty and valid no-work accounts. No Admin navigation appears.

While access is loading/refetching, conditional destinations are withheld. On failure they remain absent and the portal provides a controlled account-access error and Retry. A valid all-zero Faculty account gets Dashboard/common destinations and **No current academic work.** Direct work routes refresh once per pathname before showing content or an access-changed state with a safe Dashboard return. All actual APIs independently enforce exact access; no flag/count authorizes a Student, thesis, essay or schedule ID.

New keys use `["faculty", authenticatedUserId, ...]`. A private QueryClient is additionally mounted with a React key equal to the current account ID. Account switch/logout unmounts it, cancels/clears its queries and disposes image effects; existing Adviser/Defense generic keys cannot survive into another account or reuse the parent portal's cache. No persistent query store is added. NotificationBell uses `["notifications", authenticatedUserId]` and preserves its existing academic routing.

Access refreshes on window focus and return to visible foreground, route changes, successful mutations within the private Faculty query client and protected API 403. The shared API helper emits a read-refresh event on 403 while preserving its existing session refresh and no-sign-out behavior; 401 retains session-expired sign-out. The exact image loader also emits the access-refresh event on 403. If session synchronization itself becomes unavailable before the private query client can mount, the outer provider still supports Retry and foreground session recovery. No previously granted navigation survives a resolution failure.

Protected content is hidden during access revalidation. A still-mounted valid workspace can retain a score draft while hidden; failure/revocation removes the content. Score entry/confirmation are disabled during current-access revalidation. Password/account/session gates remain authoritative. No sockets, backend permission cache or client-supplied work fields were introduced.

## Dashboard and Profile

Dashboard prioritizes relevant work in one task-oriented surface rather than a fixed grid of zero KPIs. Essay Evaluations has a Review Essays CTA regardless of queue size. My Advisees shows only positive available context counts with truthful labels (active advisees, addressed requests, issued certifications), including historical context rather than calling all requests actionable. My Defenses shows the bounded assignment count without calling historical assignments upcoming. Labels handle singular/plural counts.

The existing owned detailed Dashboard reader runs only for relevant Adviser/Defense context. Its Needs Your Attention preview preserves backend task labels and exact deep links, filters by the corresponding relevant work area and shows at most five tasks. It does not confer access or mix Adviser tasks into Defense relevance. No-work and evaluator-only accounts do not query that reader or scan the Essay queue for totals.

Profile uses only existing `GET /panelists/me`, with an account-scoped key and concise loading/error/Retry states. The availability Switch, mutation and explanatory policy block are removed. Internal/External is read-only context, not an inferred Adviser right.

The retained shell preserves exact active navigation matching, icon-only accessible labels, mobile opening/closing and desktop collapse. Mobile background content is inert while the drawer is open; keyboard focus enters the drawer, Tab is contained, Escape closes it and returns focus. Closed mobile navigation is excluded from keyboard access. Sidebar animation applies to position/width so visibility and keyboard focus change immediately. The immersive Defense route retains its sidebar/header-free presentation; no Workspace action/UI was redesigned.

## Essay routes, cursor and rendering

| Faculty UI | Accepted backend API | Presentation |
| --- | --- | --- |
| `/panelist/essay-evaluations` | GET `/api/exam/essay-evaluations?cursor=...` | Applicant name/ID, Program context, submission date, Pending Evaluation and Review Essay; no scoring/result/Admin fields |
| `/panelist/essay-evaluations/[applicationId]` | GET `/api/exam/essay-evaluations/:id` | Exact pending question, stimulus, response state/text, captured maximum and bounded identity/context |
| Confirmation save | POST `/api/exam/essay-evaluations/:id/grade` | Exact `{ essayScore: number }`; no remarks, evaluator override or result fields |
| IMAGE stimulus | GET `/api/exam/essay-evaluations/:id/media/:mediaId/content` | Authenticated exact Faculty endpoint; validated PNG/JPEG blob with effect-owned object URL |

`visibleEssayPage()` follows empty scan pages until visible items appear or `nextCursor === null`. It never labels one empty scan page as final empty work. Non-progressing/repeated/backwards cursors and malformed page envelopes become controlled failures. Read failures/503 do not become empty results. After visible work exists, Load More seeks the next visible page through any intervening empty scans. Existing visible identities are deduplicated; Dashboard never scans this chain for an exact total.

Queue loading, refetching, failure, temporary unavailability, access change and genuine exhausted empty states are distinct. Program is context only; there is no Program evaluator assignment/filter authority. The narrow detail uses shared `SemanticText` and `StructuredStimulusRenderer`, not the Admin `EssayEvaluationPanel` or generic exam-execution image entitlement.

`MISSING` says **No response was recorded.** `BLANK` says **The response was left blank.** `SUBMITTED` preserves exact finalized text and whitespace. Emphasis remains controlled semantic React markup; structured content retains the accepted safe renderer and horizontal containment. Long identity/Program/essay content wraps responsively.

The image loader uses the current access token and the exact application/media route. It validates PNG/JPEG type and the existing 5 MB bound, creates a blob URL only on a valid successful response, aborts pending requests on disposal and revokes its own URL on unmount/retry/identity/token changes. Loading/error/Retry are explicit. 401 expires the session; 403 refreshes access. No image bytes, storage key/path or private academic response is persisted in browser storage.

## Immutable grading and recovery

Assistive input validation accepts finite scores from zero through the captured maximum, including fractions. Backend precision, eligibility and immutable academic-write authority remain unchanged. The shared Dialog identifies entered score/maximum and states **This evaluation is final and cannot be regraded.** Invalid scores cannot open confirmation. Pending state disables controls, prevents closing the dialog and uses an immediate in-flight guard against duplicate writes.

Success says **Essay evaluation saved.**, clears the score draft, removes pending-detail cache, invalidates the account's Essay queue and returns to it. It does not refetch pending-only detail as the success path or offer regrade. No PASS/FAIL, result-computed, MCQ, threshold or email claim is made from the narrow receipt.

- 400: bounded score feedback, draft retained.
- 403: current access refresh; revoked navigation/content disappear without ordinary forbidden sign-out.
- 404/409: exact essay is no longer available; remove grading controls and provide a queue return, without automatic grade retry.
- 503: truthful temporary-unavailable feedback; draft retained and the user may retry.
- 401: existing session-expired behavior.

## Verification actually executed

Frontend commands ran from `frontend`, backend commands from `backend`, and diff checks from repository root. No full repository sweep. Source checks and synthetic browser work are not hosted CI or owner acceptance.

| Check | Actual final result |
| --- | --- |
| `node scripts/verify-faculty-14-portal.mjs` | **42 PASS**: real access/parser/redirect/cursor/score/image-lifetime functions with injected network primitives |
| `node scripts/verify-faculty-2-session.mjs` | **17 PASS**, including 403 refresh event, no sign-out and current-session authority |
| `node scripts/verify-faculty-3-compatibility.mjs` | **8 PASS** |
| `node scripts/verify-adv6-adviser-actions.mjs` | **19 PASS** |
| `node scripts/verify-cdw4-workspace.mjs` | **9 PASS** |
| `node scripts/verify-cdw2-contracts.mjs` | **11 PASS** |
| `node scripts/verify-adv5-adviser-documents-history.mjs` | **8 PASS** |
| Frontend `node node_modules/typescript/bin/tsc --noEmit` | **PASS** after final production changes |
| Scoped ESLint command below | **PASS** after final production changes |
| Frontend `npm run build` | **PASS**: compilation, TypeScript and **69 static pages**, including Essay queue and retained technical routes |
| Smallest backend `npm test -- --run tests/unit/services/auth.login.test.ts --maxWorkers=4` | **42 PASS** |
| Affected backend command below | **6 suites / 236 tests PASS**, no failures/skips |
| Backend `npm run build` | **PASS** |
| Repository-root `git diff --check` | **PASS**; changed source also checked for valid UTF-8 |
| Full synthetic Chrome matrix | **36 PASS**, 42.2 seconds, zero skips; final focused visual/copy rerun **3 PASS**, 6.2 seconds |
| Hosted CI | **NOT OBSERVED**; no hosted PASS claimed |
| Real DB / production UI/backend integration | **NOT EXECUTED**; no live accounts, grants or data used |

```powershell
# frontend
node node_modules/eslint/bin/eslint.js 'src/app/(auth)/login/page.tsx' 'src/app/(portal)/panelist/layout.tsx' 'src/app/(portal)/panelist/dashboard/page.tsx' 'src/app/(portal)/panelist/profile/page.tsx' 'src/app/(portal)/panelist/essay-evaluations/page.tsx' 'src/app/(portal)/panelist/essay-evaluations/[applicationId]/page.tsx' src/components/faculty src/components/layout/notification-bell.tsx src/lib/faculty-access.ts src/lib/faculty-essays.ts src/lib/faculty-essay-media.client.ts src/lib/api.client.ts scripts/verify-faculty-14-portal.mjs scripts/faculty-14-fixture-server.mjs scripts/verify-faculty-2-session.mjs scripts/verify-cdw4-workspace.mjs scripts/verify-adv6-adviser-actions.mjs e2e/faculty-portal.spec.ts
node scripts/faculty-14-fixture-server.mjs
# separate shell, same frontend directory
$env:E2E_FACULTY_14_FIXTURE='1'; $env:E2E_BASE_URL='http://localhost:4313'
node node_modules/@playwright/test/cli.js test e2e/faculty-portal.spec.ts --project=chrome
# final visual/copy subset after singular/plural adjustment
node node_modules/@playwright/test/cli.js test e2e/faculty-portal.spec.ts --project=chrome --grep 'combination 7|mobile/collapsed|queue traverses'

# backend
npm test -- --run tests/unit/services/auth.login.test.ts tests/unit/middlewares/auth.middleware.test.ts tests/unit/repositories/auth.repository.login.test.ts tests/unit/services/faculty-3-compatibility.test.ts tests/unit/routes/faculty-13-effective-access.routes.test.ts tests/unit/routes/faculty-12-essay-evaluation.routes.test.ts --maxWorkers=4
npm run build
```

Earlier verification exposed and corrected Windows encoding in the two rewritten pages, invalid-score Dialog opening, initial NextAuth CSRF bootstrap timing, mobile visibility/focus timing and foreground recovery when the outer session synchronization itself failed. Fixture emphasis metadata was corrected to the accepted `style: BOLD` span format; the safe renderer correctly rejected its earlier malformed synthetic marks. Existing regression fixtures gained the browser Event dispatcher; source assertions changed only for the approved Faculty Portal label and whitespace-insensitive retained Adviser-link matching. Browser alert selectors were scoped away from Next.js's independent route announcer, and recovery checks account for safe foreground recovery rather than waiting for a Retry control that may already have disappeared. Final results above are observed passing runs, not the initial failures.

### Browser and visual evidence

The `agent-browser` CLI was unavailable. Used the installed Playwright/Chrome harness against a separate loopback-only synthetic Next.js/NextAuth preview (frontend 4313, fixture API 4314), without importing the production backend or connecting to a database. Initial smoke verification checked meaningful login content, all four choices, no page errors and no framework overlay. Browser tests exercise the real frontend hooks, query client, NextAuth credential/session flow and rendering; backend AuthService role compatibility is separately exercised by the real service with mocked repository fixtures.

The 36 scenarios cover both stored academic identities, all eight responsibility combinations, addressed-only and issuer-only context/deep links, External Faculty, Profile read-only behavior, no-work, loading/error/revocation/foreground recovery, direct unavailable routes, empty scans/continuation/repeated cursors, dormant 503 and recovery, exact frozen content/emphasis/structured/image rendering, image retry, response states, zero/fraction/invalid scores, confirmation/pending/success/conflicts, 400/403/404/409/503 handling, queue 401 expiry, account switch/logout cache separation, initial-session bootstrap, mobile/desktop collapse, keyboard focus, long content and immersive Defense route chrome omission. The immersive-route check uses an exact synthetic unavailable schedule response; it does not claim a live Defense session or retest its unchanged academic actions.

Representative desktop Dashboard/detail, collapsed-sidebar and mobile long-detail screenshots were generated under ignored `frontend/test-results/faculty-14-*.png` and visually inspected by the implementation agent. Long content remains readable and the mobile page has no document-wide horizontal overflow. Synthetic login/mobile checks recorded no uncaught page errors; no error overlay was present in the passing runs. Full-page captures may place sticky chrome at the captured scroll position; this is not owner visual acceptance. The synthetic preview was stopped after QA.

Microcopy review covered the shortest truthful wording, exact Faculty/work labels, no raw capability/enum/transaction language, distinct empty/error/response states, historical counts not mislabelled actionable, and only the necessary irreversible grading consequence. **Project-owner visual/manual acceptance remains separate and is not claimed.** Existing Next middleware-convention/Node registration deprecations and Vite configuration warnings remain; no unrelated tooling migration was attempted.

## Exact changed files

Backend production and verification (2):

- `backend/src/services/auth.service.ts`
- `backend/tests/unit/services/auth.login.test.ts`

Frontend production (14):

- `frontend/src/app/(auth)/login/page.tsx`
- `frontend/src/app/(portal)/panelist/layout.tsx`
- `frontend/src/app/(portal)/panelist/dashboard/page.tsx`
- `frontend/src/app/(portal)/panelist/profile/page.tsx`
- `frontend/src/app/(portal)/panelist/essay-evaluations/page.tsx`
- `frontend/src/app/(portal)/panelist/essay-evaluations/[applicationId]/page.tsx`
- `frontend/src/components/faculty/faculty-access-provider.tsx`
- `frontend/src/components/faculty/essay-detail.tsx`
- `frontend/src/components/faculty/essay-image.tsx`
- `frontend/src/components/layout/notification-bell.tsx`
- `frontend/src/lib/api.client.ts`
- `frontend/src/lib/faculty-access.ts`
- `frontend/src/lib/faculty-essays.ts`
- `frontend/src/lib/faculty-essay-media.client.ts`

Frontend verification (6):

- `frontend/scripts/verify-faculty-14-portal.mjs`
- `frontend/scripts/faculty-14-fixture-server.mjs`
- `frontend/e2e/faculty-portal.spec.ts`
- `frontend/scripts/verify-faculty-2-session.mjs`
- `frontend/scripts/verify-cdw4-workspace.mjs`
- `frontend/scripts/verify-adv6-adviser-actions.mjs`

Documentation (3):

- `docs/superpowers/GSIS_IMPLEMENTATION_CHECKLIST.md`
- `docs/superpowers/plans/2026-11-08-faculty-admin-access-implementation.md`
- `docs/superpowers/reports/2026-11-09-faculty-14-portal-essay-ui.md`

## Dormancy, remaining gate and stop

FACULTY-12's code-owned activation constant remains false; normal Faculty Essay APIs still return controlled unavailable responses while dormant. The UI is source-ready against that contract, not a live Essay Evaluation rollout. FACULTY-10/direct-access enforcement are not activated. No environment/request/Settings/database/client activation mechanism or real grant provisioning was added.

No schema/migration, role/data conversion, CUSTOM deletion/infrastructure retirement, Program evaluator mapping, new rubric/regrade/MCQ/PASS-FAIL/email authority, Adviser/Defense workflow redesign, Admin sidebar/dashboard permission integration, Administrators Management, deployment or main merge occurred. No FACULTY-15+ work began. FACULTY-12's five-case isolated real-MariaDB contention readiness gate remains **OPEN / UNVERIFIED**; no ordinary application database was used for that harness. Independent remote commit-diff/source review is complete. The live `feat/faculty-admin-access` branch was verified at `cbf15478e38d3c483c417e45888aefd6577ed303` during review. Project-owner manual/visual QA remains pending and is not claimed by this acceptance. Stop after FACULTY-14; FACULTY-15 remains deferred / not started pending explicit project-owner approval.


## Independent-review acceptance — 2026-11-09 (Asia/Manila)

Independent remote commit-diff/source review is complete for FACULTY-14 commit `cbf15478e38d3c483c417e45888aefd6577ed303`. The live `feat/faculty-admin-access` branch was verified at that exact implementation SHA, and the pushed range from `3978de6bc12192e7ef6f8262c38fe35962a3f259` was reconciled as one commit changing exactly 25 files.

The review verified the canonical visible login transition to **Applicant / Student / Faculty / Administrator**, with server-side Faculty selection accepting both stored FACULTY and legacy PANELIST academic identities while rejecting Admin/CUSTOM/Student/Applicant mismatches. Post-login routing is derived from the refreshed server-synchronized identity rather than the selected form value; both academic stored identities retain the technical `/panelist/dashboard` destination and no `/faculty` route migration or second workspace chooser is introduced.

The Faculty portal consumes the accepted FACULTY-13 self-access projection through an account-scoped private React Query client. Conditional Essay Evaluations / My Advisees / My Defenses destinations are withheld during revalidation and removed on access failure/revocation. The current-account ID scopes new Faculty queries, account switch/logout destroys the private cache, NotificationBell is keyed by the current User ID, and protected-route presentation refreshes current work before rendering. These UI flags remain presentation hints only; exact Essay, Adviser and Defense APIs continue to authorize guessed/deep-linked resources independently.

The review verified the My Advisees edge cases retained by FACULTY-13: addressed-request-only context reaches the existing Adviser Requests surface, while own-issued-GS-017-only context remains useful because the existing My Advisees Manuscript Reviews area independently exposes Adviser Certification Records. My Defenses and immersive `/panelist/defense-workspace/[scheduleId]` compatibility remain intact; actual Defense-role terminology such as Panelist is not globally renamed.

Faculty Profile is read-only and no longer contains the legacy self-service Adviser Availability Switch/PATCH. Admin-controlled availability therefore remains owned by Faculty Management.

The new Essay Evaluations UI uses only the accepted FACULTY-12 endpoints. Queue traversal correctly follows empty candidate-scan pages while `nextCursor` remains non-null, rejects repeated/backwards/non-progressing cursors and does not misreport a dormant/read failure as an empty workload. Detail reads the exact narrow frozen prompt/response/captured maximum projection; MISSING, BLANK and SUBMITTED response states remain distinct. IMAGE stimuli use the exact Faculty essay-media endpoint, with authenticated blob loading, PNG/JPEG/size validation, abort/retry handling and object-URL cleanup rather than the generic exam-execution media entitlement.

The grading UI sends only `{ essayScore }`, permits zero/fractions within the captured maximum as assistive client validation, requires an irreversible-action Dialog and prevents duplicate writes. Success clears the draft, invalidates the pending queue and reports only **Essay evaluation saved.**; it does not infer or expose PASS/FAIL, MCQ, total score or result-email state. 404/409 remove grading controls without regrade, 403 refreshes current Faculty access, 503 remains a truthful temporary-unavailable state and 401 retains session-expiry behavior.

No acceptance-blocking authorization, session/cache isolation, Essay Evaluation, privacy or scope issue remained. No schema/migration, live activation, real Faculty grant provisioning, role/data conversion, Program evaluator mapping, Defense/Adviser workflow redesign, Administrators Management or FACULTY-15+ work was included.

Evidence classes remain separate. Codex reported 42 new frontend verifier checks PASS, 72 related frontend checks PASS, backend 6 suites / 236 tests PASS, 36 synthetic Chrome scenarios PASS plus a final 3-scenario visual/copy subset PASS, frontend TypeScript/scoped ESLint/production build PASS, backend build PASS and repository-root diff check PASS. The independent review inspected the pushed production source, focused verifier/browser test source and underlying Adviser/Defense compatibility seams; it did not rerun those commands or inspect the implementation agent's ignored local screenshots. GitHub hosted CI was not observed.

**Project-owner manual/visual QA remains PENDING / NOT YET EXECUTED as an acceptance evidence class.** The implementation agent's synthetic browser runs and screenshot inspection do not substitute for owner manual/browser acceptance. FACULTY-14 is accepted here only for development continuation.

The previously recorded FACULTY-12 five-case isolated real-MariaDB contention gate remains **OPEN / UNVERIFIED** and is not closed by this UI acceptance.

**Acceptance checkpoint:** FACULTY-14 is accepted for continuation at `cbf15478e38d3c483c417e45888aefd6577ed303`. Faculty Essay Evaluation remains dormant/source-ready, not a live rollout. FACULTY-15 remains deferred / not started pending explicit project-owner approval.
