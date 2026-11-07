# FACULTY-2 — Current-account authentication and credential boundary

- Date: 2026-11-08 (Asia/Manila)
- Repository/branch: `MuelTech/graduate-system`, `feat/faculty-admin-access` (existing branch retained).
- Verified starting local and fetched remote HEAD: `019a7f078b1d4fa60db4be8beca8ef508c925f08`.
- Verified local/fetched remote `main`: `045316540d97364214792c7d441ae20a1e426d4c`; no drift from the approved main baseline. Main is an ancestor of the starting feature HEAD, six feature commits ahead, zero main-only commits.
- Starting worktree/index: clean; local and remote feature branch identical (`0 0`). No fast-forward was needed.
- Status: implemented and locally verified; independent remote review and owner manual/browser QA remain pending. FACULTY-3 has not started.
- Authorities: [source of truth](../FACULTY_ADMIN_ACCESS_SOURCE_OF_TRUTH.md), [design](../specs/2026-11-08-faculty-admin-access-design.md), [audit](2026-11-08-faculty-admin-access-audit.md), [plan](../plans/2026-11-08-faculty-admin-access-implementation.md), [checklist](../GSIS_IMPLEMENTATION_CHECKLIST.md), [verification policy](../ENGINEERING_VERIFICATION_POLICY.md).

## Implementation boundary

Email login explicitly accepts only the current selector values: `admin → ADMIN`, `panelist → PANELIST`, `other → CUSTOM`. Applicant ID and trimmed Student Number retain their own login paths. Unknown/forged selectors fail before lookup; email role mismatch and inactive accounts cannot receive a token. Correct passwords are verified against the existing stored hashes. Public registration still explicitly creates APPLICANT, even if a caller supplies a privileged role.

Required and optional REST auth now verify the token, then load the exact current User from the database on each request. Token role/password flags are compatibility claims, not authority. Required auth sets the server actor from the current stored role. A disabled account receives 403, a missing account/invalid/expired/missing token receives 401, and account-storage failures fail closed with 503. Optional auth continues only with public authority when verification/current-account/credential checks fail. Existing workflow role, ownership, lifecycle and intentional not-found rules run after this boundary and were not rewritten.

The selected role-change contract is identity continuity: a token identifies the same User, while each request derives its current role. An old ADMIN token cannot retain ADMIN authority after a stored role change. Applicant-to-Student promotion can synchronize the same account to STUDENT without replacing its password or forcing a password change. No token-role equality requirement breaks this accepted handoff.

`mustChangePassword` gates every existing account role before normal authenticated API work. The complete backend exception list is:

| Method | Exact original pathname | Purpose |
| --- | --- | --- |
| GET | `/api/auth/me` | Safe session/current-account synchronization |
| POST | `/api/auth/change-password` | Existing authenticated credential replacement |

Query strings do not change the selected pathname; path prefixes, extra suffixes, trailing slashes and alternate methods cannot widen the gate. There is no backend logout endpoint. NextAuth logout remains local and reachable outside protected portal middleware. Password change clears the stored flag; subsequent requests use the updated flag even when the token contains old credential claims. The existing page still signs out after successful change and asks for login again. Its presentation is unchanged.

Socket handshakes load the current active account and require the existing PANELIST account/profile with clear credential state. Exact-assignment room joins, delivery recipient queries and report-preview sender queries additionally constrain current User activity/role/password state and active profile. Existing assignment/lifecycle checks and stale-member eviction remain intact. This closes a shared account/session bypass without changing committee roles or workflow policy.

## Self-access and session contract

`GET /api/auth/me` takes identity only from authenticated middleware, returns `Cache-Control: no-store`, and exposes:

- `user`: own `id`, `email`, current stored `role`, current `mustChangePassword`;
- `configuredAccess`: FACULTY-1 configuration resolution `status`, `administratorLevel`, typed `capabilities`;
- `directAccessEnforcementEnabled`: the existing code-owned false activation flag.

No password hash, signature, other-account grant, personal profile, Student ID, assignment list or workflow draft is returned. Flagged credentials receive no configured capabilities. Missing/invalid/unsupported configuration returns the foundation's denied preview with empty capabilities. This response is a configuration projection for future consumers, not activation of Full/Restricted or essay permissions. Legacy APIs keep their existing workflow checks; broad direct-access enforcement remains off.

NextAuth performs an uncached self-account read on every JWT/session read or update, with a five-second request timeout. Client-supplied session-update role/token/password fields are ignored. A 401 ends the NextAuth session. A 403 retains the login token but clears projected role authority with `ACCOUNT_FORBIDDEN`. Storage/network/invalid-response failures clear projected authority with `ACCOUNT_UNAVAILABLE`; there is no fallback to stale role or credentials, and later successful reads can recover. SessionProvider's existing foreground refetch and the API helper's session reads use this same contract. No grants are embedded as long-lived token authority.

Frontend middleware applies the generic credential gate, permits the existing password page for every authenticated role, blocks stale portal access using synchronized role, and responds with a safe 503 during account-loading failure. Both API helpers preserve forbidden status/body through `ApiError`; client 403 refreshes the current session and does not sign out. Client 401 signs out; server 401 redirects to login. Server authenticated fetches explicitly disable caching.

No schema, migration, access-version, seed, real grant, real account or existing credential backfill changed. Per-request reads need no access-version field for this package.

## Focused verification

Final backend focused command, run from `backend`:

```powershell
npx vitest run tests/unit/middlewares/auth.middleware.test.ts tests/unit/services/auth.login.test.ts tests/unit/repositories/auth.repository.login.test.ts tests/unit/services/cor.lifecycle.service.test.ts tests/unit/services/cor-workflow.regression.test.ts tests/unit/repositories/cor.repository.lifecycle.test.ts tests/unit/services/cor-frontend-credentials.contract.test.ts tests/unit/services/document-auth.stage-aware.test.ts tests/unit/services/cp8-document-auth.test.ts tests/unit/routes/official-defense-document.routes.test.ts tests/unit/realtime
```

Result: **21 files, 355 tests passed, zero failures/skips**. Coverage includes email-role combinations/forged selectors/inactivity, stale account disable/role changes, generic credential API denial and exact exceptions, HTTP password-change/unlock, expired/invalid tokens, minimal self projection/storage failure, optional-public authority, public Applicant registration, Applicant/Student login, COR promotion/original-password continuity, and directly affected document/socket authorization/delivery/preview regressions. Persistence is mocked; no database reset or destructive test ran.

An intermediate run found one old COR continuity fixture without `isActive`; it now explicitly represents an active account. The corrected regression and final selected batch pass. Initial build validation also exposed ES target incompatibility with `Object.hasOwn`; the selector check uses `Object.prototype.hasOwnProperty.call`, with prototype-forgery tests.

| Command (working directory) | Final result |
| --- | --- |
| `node --test scripts/verify-faculty-2-session.mjs` (`frontend`) | 17 runtime checks passed: current identity, credential synchronization, 401/403/outage behavior, malformed/foreign responses, recovery, client/server API errors, ignored client session tampering, frontend credential/portal gate |
| `npm run build` (`backend`) | Passed; TypeScript compilation |
| `npx tsc --noEmit` (`frontend`) | Passed |
| `npm run build` (`frontend`) | Passed; optimized build, TypeScript and 68 static pages generated |
| `npx eslint src/auth.ts src/middleware.ts src/types/next-auth.d.ts src/lib/current-session.ts src/lib/api.client.ts src/lib/api.server.ts src/lib/api-error.ts scripts/verify-faculty-2-session.mjs` (`frontend`) | Passed; verifier lint rerun after adding its final middleware cases also passed |
| `git diff --check` (repository root) | Passed |

Non-blocking tool warnings: Vite config native-loader compatibility notice; Next.js existing middleware convention deprecation; Node `module.register()` deprecation. No dependency/framework upgrade was attempted.

## Limitations and unexecuted checks

- Manual/browser QA: NOT EXECUTED, explicitly the project owner's responsibility. Focused runtime module/HTTP tests are not browser acceptance.
- Hosted CI and independent remote source review: not executed/claimed by this agent.
- Full repository suites, live database tests, migrations/rehearsals, resets, production data inspections and deployments: NOT EXECUTED. No schema/access-version change was needed.
- Current account/grants are read per request; there is no cross-request authorization cache. This adds a database read/dependency to authenticated requests and an uncached backend request to session reads.
- Existing token lifetime remains 24 hours. This package does not add a token denylist or revoke every issued token on password change/logout; those recovery/reset/session safeguards remain separate checklist work. Current disabled/role/credential state is enforced on subsequent reads, including socket joins/delivery. Re-enabled accounts can use otherwise valid identity tokens again.
- This boundary does not cancel a request already in flight or introduce later transaction-level grant mutation/locking fences. Workflow transaction authority remains with its planned packages. Connected sockets are checked before join/sending/delivery, with stale-member eviction before protected delivery; no new idle-socket polling process was introduced.
- FACULTY-1 source/storage and accepted evidence were not reworked. Direct access remains dormant; no real Full Administrator or essay evaluator grants were provisioned.
- FACULTY-3 identity conversion, terminology/login/portal redesign, access-management editor/bootstrap, recovery, Faculty Management, workflow changes, Custom Roles retirement, dual-account identifiers and Email Integration were not started.

## Exact changed files

- `backend/src/controllers/auth.controller.ts`
- `backend/src/middlewares/auth.middleware.ts`
- `backend/src/realtime/defense-realtime.auth.ts`
- `backend/src/realtime/defense-realtime.store.ts`
- `backend/src/realtime/defense-report-preview.store.ts`
- `backend/src/routes/auth.routes.ts`
- `backend/src/services/auth.service.ts`
- `backend/src/services/current-account.ts`
- `backend/tests/unit/middlewares/auth.middleware.test.ts`
- `backend/tests/unit/realtime/defense-realtime.auth.test.ts`
- `backend/tests/unit/realtime/defense-realtime.store.test.ts`
- `backend/tests/unit/realtime/defense-report-preview.store.test.ts`
- `backend/tests/unit/services/auth.login.test.ts`
- `backend/tests/unit/services/cor-workflow.regression.test.ts`
- `docs/superpowers/GSIS_IMPLEMENTATION_CHECKLIST.md`
- `docs/superpowers/plans/2026-11-08-faculty-admin-access-implementation.md`
- `docs/superpowers/reports/2026-11-08-faculty-2-current-account-authentication.md`
- `frontend/scripts/verify-faculty-2-session.mjs`
- `frontend/src/auth.ts`
- `frontend/src/lib/api-error.ts`
- `frontend/src/lib/api.client.ts`
- `frontend/src/lib/api.server.ts`
- `frontend/src/lib/current-session.ts`
- `frontend/src/middleware.ts`
- `frontend/src/types/next-auth.d.ts`

## Delivery and stop

The delivery commit is the commit containing this report (`git log -1 --format=%H -- docs/superpowers/reports/2026-11-08-faculty-2-current-account-authentication.md`). Commit/push and final worktree/remote equality are verified after creating that commit and reported in the task's final response. No merge, rebase, reset, force push, history rewrite or extra branch is part of delivery.

Stop after committing/pushing FACULTY-2 to `feat/faculty-admin-access`. FACULTY-3 requires separate authorization.
