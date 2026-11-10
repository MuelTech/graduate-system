# FACULTY-18 — Integrated Acceptance & Production-Readiness Verification

- **Date:** 2026-11-11 (Asia/Manila; initial verification began 2026-11-10 at `5839544`, recorded at `6dbdaa8`, followed by the 2026-11-11 pre-acceptance correction / closure pass).
- **Branch:** `feat/faculty-admin-access`
- **Verified starting HEAD (initial pass / closure pass):** `583954422e89ed2c9dd59f3d3b505e0e12f807e7` -> `6dbdaa81af208ade415e3303c4fc6f79f0baf1bb`
- **Overall determination:** **FACULTY-18 PRE-ACCEPTANCE CLOSURE EXECUTED — NOT YET ACCEPTED (project-owner manual/browser QA & formal acceptance for FACULTY-17, FACULTY-17A, FACULTY-11, FACULTY-15, and uncovered FACULTY-14 flows, plus independent review of this closure pass, remain open).**
- **Activation status:** **ALL NINE CODE-OWNED ACTIVATION GATES REMAIN `false`. NO CONTROLLED ACTIVATION, LIVE CUTOVER, DEPLOYMENT, OR ACCOUNT BOOTSTRAP/CONVERSION OCCURRED.**

---

## 1. Executive determination, closure updates, and blocker classification

### Closure pass updates (2026-11-11)

All concrete technical, test, harness, and `migrate status` evidence gaps identified during initial FACULTY-18 readiness verification (`6dbdaa8`) are now resolved:

1. **Project-owner `npx prisma migrate status` evidence recorded:** The project owner independently executed `npx prisma migrate status` against local development `graduate_system` on `localhost:3306` and observed `58 migrations found in prisma/migrations` and `Database schema is up to date!`. This is recorded strictly as project-owner evidence that the local development database has no pending Prisma migrations (no synthetic or additional DB claims fabricated).
2. **Real production ownership defect fixed — `PUT /api/notifications/:id/read`:** Initial FACULTY-18 inspection discovered a production authorization/ownership defect where `PUT /api/notifications/:id/read` (`NotificationController.markAsRead` -> `NotificationService.markAsRead` -> `NotificationRepository.markAsRead`) updated `prisma.notification.update({ where: { id } })` without scoping to `req.user.userId`. This closure pass fixes the chain across controller/service/repository to bind `userId` (`updateMany({ where: { id, userId }, data: { isRead: true } })` + `findFirst({ where: { id, userId } })`), returning an identical `404` (`"Notification not found."`) for both missing IDs and another user's notifications without leaking existence, and hiding unexpected DB errors behind a generic `500`. Focused positive/negative ownership tests (`backend/tests/unit/routes/notification-ownership.routes.test.ts`, 5/5 PASS) verify route auth, self-mark ignoring forged body `userId`, foreign/missing indistinguishability, and direct service/repo boundaries.
3. **Playwright harness/selector fixes verified in Google Chrome:** Fixed `frontend/scripts/faculty-11-fixture-server.mjs` (returns `/api/auth/me` with `configuredAccess` and `FULL_ADMINISTRATOR_CAPABILITIES`) + `frontend/e2e/faculty-management.spec.ts:88` (`/api/auth/me` passthrough), and fixed `frontend/e2e/faculty-portal.spec.ts:920` (`"Loading Faculty access"` -> `"Loading account access"`). Re-running in Google Chrome passed **3/3** on `e2e/faculty-management.spec.ts` and **40/40** on `e2e/faculty-portal.spec.ts` (alongside 6/6 on `e2e/faculty-17a-login.spec.ts` and 37/37 on `e2e/administrators-management.spec.ts` verified at `5839544`).
4. **Five post-change backend unit tests reconciled & broadened FACULTY suite clean:** Updated stale mocks/expectations in `adviser-certification-document.controller.test.ts`, `adviser-request-record.controller.test.ts`, `faculty-3-compatibility.test.ts`, `faculty-12-essay-evaluation.routes.test.ts`, and `thesis.repository.active-adviser.test.ts` to match accepted FACULTY-17 (`503` on retired `CUSTOM`), UIUX-3E (`db.panelist.findUnique`), and FACULTY-17B (`include.adviser`) behavior. All **89/89** FACULTY + notification backend unit files (**2,624/2,624 tests**) now pass with zero failures and zero skips.
5. **Three legacy ADV frontend static scripts updated & clean:** Updated `verify-adv3-my-advisees.mjs` (`11/11`), `verify-adv4-advisee-detail.mjs` (`16/16`), and `verify-adv7-navigation-consolidation.mjs` (`8/8`) to parse `navItems` entries structurally across multi-line formatting (matching FACULTY-14's `Essay Evaluations` item); **22/22** affected frontend scripts (**368/368 checks**) now pass.

### Corrected blocker classification

- **Remaining acceptance blockers (preventing `FACULTY-18 ACCEPTED` today):**
  1. **FACULTY-17 formal project-owner QA & acceptance pending (`🔍`):** Independent scoped source review and owner local `migrate deploy` + `migrate status` (`58 migrations found`, `Database schema is up to date!`) are recorded, but **project-owner QA and formal package acceptance remain pending**.
  2. **FACULTY-17A formal project-owner smoke QA & acceptance pending (`🔍`):** Independent scoped source review and owner local `migrate deploy` + `migrate status` (`58 migrations found`, `Database schema is up to date!`) are recorded, but **project-owner smoke QA and formal package acceptance remain pending**.
  3. **Project-owner manual/browser QA pending on UI packages:** Formal project-owner manual/browser QA remains pending/unclaimed for **FACULTY-11**, **FACULTY-15**, and any uncovered **FACULTY-14** flows (e.g., essay-grading workflow outside UIUX-3E's owner-accepted Dashboard and sidebar refinement), plus independent review of this closure commit.
- **Evidence status (not a feature-branch acceptance blocker):**
  - **Hosted CI (`NOT OBSERVED`):** `gh` CLI was unavailable; `.github/workflows/ci.yml` runs on pushes to `main` and pull requests targeting `main`, so absence of feature-branch CI runs is evidence status rather than a branch-level readiness blocker.
- **Separate post-acceptance activation & target-environment requirements (not blocking `READY FOR SEPARATELY AUTHORIZED CONTROLLED ACTIVATION` once owner QA/acceptances complete):**
  - Explicit **DR-1** Full Administrator bootstrap identity designation for **staging/production** (a separate bounded local-development-only DR-1 bootstrap for `admin@earist.edu.ph` in XAMPP `graduate_system` on `localhost:3306` was subsequently authorized and recorded on 2026-11-11 in [the DR-1 local-dev bootstrap report](2026-11-11-dr1-local-dev-initial-full-administrator-bootstrap.md), leaving staging/production unbootstrapped), **DR-2** live account disposition authorization, and explicit controlled rollout/gate-activation authorization remain required before actual cutover or toggling any code-owned flag from `false`.

*(Historical note from initial `6dbdaa8` verification: prior to this closure pass, initial `6dbdaa8` verification recorded the `NotificationRepository.markAsRead` ownership gap, the 2 Playwright harness/selector failures, the 5 post-change backend test drifts, the 3 single-line ADV script regex mismatches, and missing `prisma migrate status`.)*

---

## 2. Dependency preflight ledger (FACULTY-0 through FACULTY-17B plus UIUX-3E)

| Package / Gate | Canonical Status | Source / Evidence Commits | Owner QA / Remaining Prerequisite |
| --- | --- | --- | --- |
| `FACULTY-0` | ✅ Accepted audit & implementation plan | `docs/superpowers/reports/2026-11-08-faculty-admin-access-audit.md` | N/A (planning baseline) |
| `FACULTY-1` | ✅ Accepted direct-access foundation | `56b1ecb` | Gate stays `false` |
| `FACULTY-2` | ✅ Accepted current-account auth | `62de9f5` | Normal login sanity confirmed by owner |
| `FACULTY-3` | ✅ Accepted identity compatibility (`FACULTY` + `PANELIST`) | `6d03ab7` | 2 unit mocks synced in FACULTY-18 closure pass (`db.panelist.findUnique`) |
| `FACULTY-4` | ✅ Accepted backend + **real-MariaDB readiness CLOSED** | Impl `33b3910`; MariaDB `9170adf` -> `af5b1d4` (5/5 PASS) | Management gate stays `false` |
| `FACULTY-5` | ✅ Accepted Admission & Student guards (18 endpoints) | `e0fb5ad` | Guard gate stays `false` |
| `FACULTY-6` | ✅ Accepted Exam Admin guards (32 mapped + 2 excluded) | `7fd57d9`, correction `987b75b` | Guard gate stays `false` |
| `FACULTY-7` | ✅ Accepted Defense & Adviser guards (25 mapped + 15 classified) | `ff12c6c`, correction `ec68ff3` | Guard gate stays `false` |
| `FACULTY-8` | ✅ Accepted Private Files & Official Records guards | `f94d02f`, correction `76cc0ae` | Guard gate stays `false` |
| `FACULTY-9` | ✅ Accepted Operational, Settings & Dashboard guards | `a22777b` | Guard gate stays `false` |
| `FACULTY-10` | ✅ Accepted Faculty Config & New-Adviser Eligibility | `772e283` | Config gate stays `false` |
| `FACULTY-11` | ✅ Accepted for continuation (Faculty Management UI) | `8c55440` | **Project-owner manual QA pending**; fixture updated in closure pass (`3/3` Chrome PASS) |
| `FACULTY-12` | ✅ Accepted backend + **real-MariaDB readiness CLOSED** | Impl `c0059b9`; MariaDB `9170adf` -> `af5b1d4` (5/5 PASS) | Essay gate stays `false`; 4 `"CUSTOM"` `403`->`503` route test assertions synced in closure pass |
| `FACULTY-13` | ✅ Accepted `/api/auth/me` effective-access & `facultyWork` | `5843602` | Presentation read model only |
| `FACULTY-14` | ✅ Accepted for continuation (Faculty Portal & Essay UI) | `cbf1547` | Dashboard/sidebar covered by UIUX-3E owner QA; uncovered essay-grading UI manual QA remains owner evidence |
| `FACULTY-15` | ✅ Accepted for continuation (Administrators Management UI) | `60e5595`, review `d4141dc` | **Project-owner manual/browser QA pending** |
| `FACULTY-16` | ✅ Accepted clean-source operator cutover rehearsal | `8c53771`, `f86a52f`, `8c463bc` | Actual environment DR-1/DR-2 inventory/execution requires separate activation authorization |
| `FACULTY-17` | **🔍 BLOCKER — Owner QA & formal acceptance PENDING** | `833d2e6`, `b3d1a14`, `8bbe6b4`, `9febfd3` | Owner local `migrate deploy` + `migrate status` (`58 migrations found`, `Database schema is up to date!`) recorded; **owner QA & formal acceptance pending** |
| `FACULTY-17A` | **🔍 BLOCKER — Owner smoke QA & formal acceptance PENDING** | `f29c994`, `aea0895`, `55e5023` | Owner local `migrate deploy` + `migrate status` (`58 migrations found`, `Database schema is up to date!`) recorded; **owner smoke QA & formal acceptance pending** |
| `FACULTY-17B` | ✅ Accepted DR-5 / DR-6 / DR-7 alignment | `5c99312`, `cbc5b2e`, review `e7a68a1` | `thesis.repository.active-adviser.test.ts` expectation synced in closure pass |
| `UIUX-3E` | ✅ Accepted Faculty Portal refinement (owner accepted 2026-11-10) | `030ffb4`, `4e866d3`, `369cb32`, `9a5aa78`, `6b2b7a6` | `e2e/faculty-portal.spec.ts:920` selector fixed in closure pass (`40/40` Chrome PASS) |

---

## 3. Code-owned activation gates verification

Direct inspection of `backend/src/access/*.ts` confirmed **all 9 rollout constants remain literally `false`**, with zero environment, database, header, query, or request override paths:

| # | Exact File & Line | Constant | Value |
| --- | --- | --- | --- |
| 1 | `backend/src/access/account-access.ts:8` | `DIRECT_ACCESS_ENFORCEMENT_ENABLED` | `false` |
| 2 | `backend/src/access/administrator-management.ts:7` | `ADMINISTRATOR_MANAGEMENT_ENABLED` | `false` |
| 3 | `backend/src/access/admission-student-authorization.ts:10` | `ADMISSION_STUDENT_CAPABILITY_ENFORCEMENT_ENABLED` | `false` |
| 4 | `backend/src/access/exam-administration-authorization.ts:10` | `EXAM_ADMINISTRATION_CAPABILITY_ENFORCEMENT_ENABLED` | `false` |
| 5 | `backend/src/access/defense-adviser-authorization.ts:8` | `DEFENSE_ADVISER_CAPABILITY_ENFORCEMENT_ENABLED` | `false` |
| 6 | `backend/src/access/private-record-authorization.ts:8` | `PRIVATE_RECORD_ENFORCEMENT_ENABLED` | `false` |
| 7 | `backend/src/access/operational-authorization.ts:10` | `OPERATIONAL_ENFORCEMENT_ENABLED` | `false` |
| 8 | `backend/src/access/faculty-configuration.ts:8` | `FACULTY_CONFIGURATION_ENABLED` | `false` |
| 9 | `backend/src/access/faculty-essay-authorization.ts:8` | `FACULTY_ESSAY_EVALUATION_ENABLED` | `false` |

---

## 4. Verification executed in FACULTY-18 (evidence classes kept strictly separate)

### 4.1 Static, Schema, Typecheck, Lint & Build (FACULTY-18 + 2026-11-11 Closure Pass)

| Check | Directory | Exact Command | Result |
| --- | --- | --- | --- |
| Prisma schema validate (`5839544`) | `backend` | `npx prisma validate` (`DATABASE_URL=mysql://ci:ci@127.0.0.1:3306/ci_placeholder`) | **PASS** (58 migration folders intact) |
| Prisma client generate (`5839544`) | `backend` | `npm run prisma:generate` | **PASS** (Prisma Client v7.10.0) |
| Owner local `prisma migrate status` (2026-11-11) | owner local dev DB (`graduate_system` @ `localhost:3306`) | `npx prisma migrate status` | **PASS (owner-reported)**: `58 migrations found in prisma/migrations`, `Database schema is up to date!` |
| Backend TypeScript check (post-notification fix) | `backend` | `npx tsc --noEmit` | **PASS** (0 errors) |
| Backend production build (post-notification fix) | `backend` | `npm run build` | **PASS** |
| Frontend TypeScript check (post-closure edits) | `frontend` | `node node_modules/typescript/bin/tsc --noEmit` | **PASS** (0 errors) |
| Frontend ESLint (at `5839544`; scoped rerun on edited harness/E2E files) | `frontend` | `npm run lint` (`5839544`), then `node node_modules/eslint/bin/eslint.js e2e/faculty-management.spec.ts e2e/faculty-portal.spec.ts scripts/faculty-11-fixture-server.mjs` | **PASS** (0 errors; 33 pre-existing warnings at `5839544`; 0 errors/warnings on edited files) |
| Frontend production build (`5839544`, `frontend/src` unchanged in closure) | `frontend` | `npm run build` | **PASS** (69 routes built cleanly) |
| Repository diff whitespace | repo root | `git diff --check` | **PASS** (verified after final doc writes) |

### 4.2 Focused & Broadened FACULTY-0–17B, UIUX-3E & Notification Backend Suites

- **Pre-closure baseline (`6dbdaa8`):** 81 non-stale files ran across `task-323` (`80/81` files, `2,498/2,499` tests PASS; 1 CPU-contention timeout in `faculty-16-source-provenance.test.ts`) + `task-335` single-worker rerun (`13/13` PASS).
- **Post-closure focused suite (`task-563`, after notification ownership & 5 backend test fixes):** `npx vitest run tests/unit/routes/notification-ownership.routes.test.ts tests/unit/controllers/adviser-certification-document.controller.test.ts tests/unit/controllers/adviser-request-record.controller.test.ts tests/unit/services/faculty-3-compatibility.test.ts tests/unit/routes/faculty-12-essay-evaluation.routes.test.ts tests/unit/repositories/thesis.repository.active-adviser.test.ts tests/unit/controllers/defcorr1-schedule-notification-safety.test.ts tests/unit/services/defcorr1-notification.service.test.ts --maxWorkers=4` -> **8/8 files PASS, 125/125 tests PASS** (0 failures, 0 skips).
- **Post-closure broadened FACULTY + Notification suite (`task-570`, `--maxWorkers=4 --testTimeout=15000`):** All **89/89** FACULTY-0–17B, UIUX-3E, access, auth, realtime, guard, document, official-defense, migration, and notification backend unit suites (**2,624/2,624 tests**) **PASSED** (0 failures, 0 skips).

### 4.3 Full Backend Vitest Regression Suite (Pre-Closure Baseline at `5839544`)

Executed in `backend/` at `5839544` with `DATABASE_URL=mysql://ci:ci@127.0.0.1:3306/ci_placeholder` (live XAMPP `:3306` never modified):

- Command: `npm test -- --maxWorkers=4` (`steps/194`)
- Result: **287 passed | 24 failed | 14 skipped (325 test files)**; **5,618 passed | 198 failed | 275 skipped (6,091 tests)** (exit code 1).
- Complete accounting of the **24 failing files** at `5839544`:
  - **5 post-FACULTY-17/17B/UIUX-3E unit-test mock/expectation drifts (now ALL FIXED & PASSING in `task-563` / `task-570`):**
    1. `tests/unit/controllers/adviser-certification-document.controller.test.ts` (was 3 failed -> now 13/13 PASS).
    2. `tests/unit/controllers/adviser-request-record.controller.test.ts` (was 3 failed -> now 12/12 PASS).
    3. `tests/unit/services/faculty-3-compatibility.test.ts` (was 2 failed -> now 43/43 PASS).
    4. `tests/unit/routes/faculty-12-essay-evaluation.routes.test.ts` (was 4 failed -> now 46/46 PASS).
    5. `tests/unit/repositories/thesis.repository.active-adviser.test.ts` (was 1 failed -> now 3/3 PASS).
  - **19 pre-existing pre-FACULTY-2 / B10 / pre-FACULTY-15 baseline failures (outside this closure pass):**
    - 7 frontend-importing UI contract tests (`applicant-results.contract.test.ts`, `exam-assignment-ui.contract.test.ts`, `exam-b9-ui.contract.test.ts`, `exam-essay-evaluation-ui.contract.test.ts`, `exam-execution-ui.contract.test.ts`, `exam-slot-bookings-ui.contract.test.ts`, `exam-ui-content-refinement.contract.test.ts`).
    - 1 FACULTY-15 UI regex contract (`exam-configuration-ui.contract.test.ts`, `<AdminCan>` wrapper).
    - 10 pre-FACULTY-2/6/9 legacy route/controller suites (`exam-draft.routes.test.ts`, `exam-finalization.routes.test.ts`, `exam-configuration.routes.test.ts`, `exam-question-set.routes.test.ts`, `exam-slot-bookings.routes.test.ts`, `exam-schedule.routes.test.ts`, `manuscript-upload-commit.test.ts`, `admin-storage.routes.test.ts`, `exam-record.routes.test.ts`, `exam-engine-content.controller.test.ts`).
    - 1 pre-FACULTY incomplete schedule fixture (`thesis.repository.application-timestamps.test.ts`).
- **14 fully skipped integration files (261 skipped tests) + 3 partially skipped files (14 skipped tests) = 275 skipped tests total:** 14 opt-in isolated DB suites safely skipped when `*_DB_TEST` env vars are unset (`261` tests), plus `tests/integration/direct-account-access.test.ts` (`3` passed, `9` DB tests skipped), `tests/unit/storage/local-storage.symlink.test.ts` (`1` passed, `4` Windows symlink tests skipped), and `tests/unit/storage/local-storage.provider.test.ts` (`14` passed, `1` skipped).

### 4.4 Frontend Static Verifier Scripts (Post-Closure `task-564`)

Executed `node --test` sequentially across all **22** affected scripts in `frontend/scripts/`:

- **22/22 scripts PASSED (368/368 checks, 0 failures):**
  - Updated structural ADV scripts: `verify-adv3-my-advisees.mjs` (**11/11 PASS**), `verify-adv4-advisee-detail.mjs` (**16/16 PASS**), `verify-adv7-navigation-consolidation.mjs` (**8/8 PASS**).
  - Previously passing core & realtime/PDF scripts rerun after closure edits: `verify-faculty-2-session.mjs` (19/19), `verify-faculty-3-compatibility.mjs` (8/8), `verify-faculty-11-management.mjs` (20/20), `verify-faculty-14-portal.mjs` (45/45), `verify-faculty-15-admin.mjs` (50/50), `verify-gs020-1b-adviser-request.mjs` (18/18), `verify-adv1-scheduling-adviser.mjs` (7/7), `verify-adv5-adviser-documents-history.mjs` (8/8), `verify-adv6-adviser-actions.mjs` (19/19), `verify-adv7-fix1-my-advisees-ux.mjs` (10/10), `verify-cdw2-contracts.mjs` (11/11), `verify-cdw4-workspace.mjs` (9/9), `verify-defcorr-1b-correction-ui.mjs` (12/12), `verify-predef-1b0-manuscript-title.mjs` (14/14), `verify-predef-1bc-certification.mjs` (11/11), `verify-predef-2-submission-context.mjs` (10/10), `verify-form-int-4-official-pdf-actions.mjs` (19/19), `verify-cdw8b-realtime.mjs` (22/22), `verify-cdw8c-acceptance.mjs` (24/24).

### 4.5 Synthetic Google Chrome Playwright Browser Verification

Executed sequentially against real Next.js dev servers (`distDir: .next-qa-18` via isolated preload wrapper leaving pre-existing `localhost:3000` dev server untouched and restoring exact original `frontend/tsconfig.json` bytes) using Google Chrome (`--project=chrome`):

| Spec | Fixture Server | Result | Exact Observation |
| --- | --- | --- | --- |
| `frontend/e2e/faculty-management.spec.ts` | `faculty-11-fixture-server.mjs` (`:4311`) | **3/3 PASS** (`task-577`, post-closure fix) | Desktop list/detail/edit/status/conflict/view-only, narrow layout/keyboard/create/one-time password, loading/empty/503/403/Retry PASS *(failed `0/3` prior to closure fixture & route passthrough fix)* |
| `frontend/e2e/faculty-portal.spec.ts` | `faculty-14-fixture-server.mjs` (`:4313`) | **40/40 PASS** (`task-577`, post-closure fix) | Login, all 8 responsibility combinations, External boundaries, Essay grading/revocation/media, immersive Defense, UIUX-3E sidebar stability (`:920` fixed) & rich dashboard PASS |
| `frontend/e2e/faculty-17a-login.spec.ts` | `faculty-17a-fixture-server.mjs` (`:4317`) | **6/6 PASS** (`task-371` at `5839544`, unchanged) | Shared `person@gmail.com` separate Faculty/Admin login, cross-password rejection, sign-out switching, 4-role selector |
| `frontend/e2e/administrators-management.spec.ts` | `faculty-15-fixture-server.mjs` (`:4315`) | **37/37 PASS** (`task-378` at `5839544`, unchanged) | Full/Restricted/zero-grant navigation & containment, create/edit/demote/self-demotion revocation, access recovery, `/admin/users/roles` redirects/denials, 4-role login |

### 4.6 Preserved Real-MariaDB Evidence & Hosted CI Status

No migration or capability/access-fence source changed after `9170adfc9d6fa1215c51c4278cc1dde3fa12c1ab` (`notification.*` changes are self-contained ownership enforcement outside FACULTY-4/FACULTY-12 contention paths). Previously closed isolated MariaDB 10.4.32 evidence remains valid without rerunning contention suites:

- **FACULTY-4 (`5/5`) & FACULTY-12 (`5/5`) Real-MariaDB Contention Closure (2026-11-10):** Source commit `9170adfc9d6fa1215c51c4278cc1dde3fa12c1ab`, evidence commit `af5b1d473a7ca94acdb4b05e3282611faeaea13e` (`backend/tests/integration/administrator-access-contention.test.ts` and `backend/tests/integration/faculty-12-essay-contention.test.ts` against isolated `127.0.0.1:33319`).
- **FACULTY-16 Clean Committed Operator Cutover Rehearsal:** Source commit `8c53771`, `docs/superpowers/reports/evidence/2026-11-09-faculty-16-rehearsal.json` (`8/8` isolated MariaDB 10.4.32 + `66/66` unit = `74/74`).
- **FACULTY-17 Custom Roles Retirement & Operator Regression:** Source commit `833d2e6`, `docs/superpowers/reports/evidence/2026-11-10-faculty-17-retirement.json` (`10 + 8` tests on MariaDB 10.4.32, 57 migrations, 71 tables).
- **FACULTY-17A Same-Gmail Role-Scoped Identity & Operator Regression:** Source commit `f29c994`, `docs/superpowers/reports/evidence/2026-11-10-faculty-17a-identity.json` (`81/81` replay on MariaDB 10.4.32, 58 migrations, triggers `users_email_identity_insert` & `users_email_identity_update`).
- **Project-owner local development migration verification (2026-11-11):** `npx prisma migrate status` against `graduate_system` on `localhost:3306` confirmed `58 migrations found in prisma/migrations` and `Database schema is up to date!`.
- **Hosted CI (evidence status, not a branch acceptance blocker):** **NOT OBSERVED** (`gh` CLI unavailable; `.github/workflows/ci.yml` executes on pushes to `main` and pull requests targeting `main`).

---

## 5. Integrated Scenario Matrix verification mapping

| Scenario | Backend / Integrated Test Evidence | Frontend / Playwright Evidence | Current Verdict |
| --- | --- | --- | --- |
| Essay Evaluator only (school-wide pending essays across Programs, no Admin, no MCQ/Adviser/Defense) | `tests/unit/repositories/faculty-12-essay-evaluation.test.ts`, `faculty-12-essay-evaluation.routes.test.ts` (46/46 PASS), `faculty-12-essay-contention.test.ts` (`af5b1d4`), `faculty-13-effective-access.routes.test.ts` | `verify-faculty-14-portal.mjs` (45/45), `faculty-portal.spec.ts` (40/40 PASS) | **Backend & Chrome UI verified** (owner E2E essay manual QA separate) |
| Internal available Adviser without assignment (canonical ODP eligibility, no arbitrary My Advisees) | `tests/unit/services/faculty-10-adviser-eligibility.test.ts`, `adviser-workspace.service.test.ts`, `faculty-13-effective-access.routes.test.ts` | `verify-adv3-my-advisees.mjs` (11/11), `verify-adv6-adviser-actions.mjs` (19/19), `faculty-portal.spec.ts` (40/40) | **Backend & Chrome UI verified** |
| Existing Adviser & availability preserved (unavailable does not erase active assignments) | `faculty-10-configuration.test.ts`, `faculty-7-defense-adviser-boundaries.test.ts`, `adviser-workspace.service.test.ts`, `proposal-adviser-review.service.test.ts`, `final-adviser-review.service.test.ts` | `faculty-management.spec.ts` (3/3 Chrome PASS) + `verify-faculty-11-management.mjs` (20/20) | **Backend & Chrome UI verified** (owner FACULTY-11 manual QA separate) |
| Historical Adviser permanently locks Internal -> External (DR-7) | `tests/unit/services/faculty-10-configuration.test.ts` (`cbc5b2e`/`5c99312`) | `verify-faculty-11-management.mjs` (20/20) | **Backend verified** |
| External Faculty: never Adviser, no advisees, retains Chairman/Panelist/Rapporteur/Facilitator Defense seats (DR-5) | `tests/unit/routes/faculty-external-adviser-isolation.routes.test.ts`, `faculty-7-defense-adviser-boundaries.test.ts`, `faculty-8-official-records.test.ts`, `faculty-8-private-documents.test.ts`, `panelist-dashboard.service.test.ts` | `faculty-portal.spec.ts` test #13 (External read-only Profile & no Adviser nav) + UIUX-3E External variant (#39) | **Backend & Chrome UI verified** |
| Multiple Faculty responsibilities (union only, no escalation) | `tests/unit/routes/faculty-13-effective-access.routes.test.ts` | `faculty-portal.spec.ts` 8 responsibility combinations (#3-#10) & #38 (rich dashboard) | **Backend & Chrome UI verified** |
| Faculty with no active work (common portal usable, zero-value academic cards hidden, guessed APIs 403/404) | `faculty-13-effective-access.routes.test.ts`, `faculty-7-defense-adviser-boundaries.test.ts` | `faculty-portal.spec.ts` combination 0 (#3) & UIUX-3E no-work variant (#39) | **Backend & Chrome UI verified** |
| Removed committee member (historical attribution preserved; future active REST/socket/preview denied) | `defcorr1-schedule-correction.test.ts`, `defense-realtime.authorization.test.ts`, `defense-realtime.server.test.ts`, `defense-report-preview.authorization.test.ts`, `defense-report-preview.server.test.ts`, `cdw6-history.routes.test.ts` | `verify-defcorr-1b-correction-ui.mjs` (12/12), `verify-cdw8b-realtime.mjs`, `verify-cdw8c-acceptance.mjs` | **Verified** |
| Different Defense roles on different schedules | `oral-evaluation.service.test.ts`, `defense-conclusion.service.test.ts`, `defense-collaboration.controller.test.ts`, `cp9-panelist-assignments.test.ts` | `verify-cdw4-workspace.mjs` (9/9) | **Verified** |
| Ineligible Adviser request after CONFORME (DR-6: reviewer rejects with reason, immutable GS-020, Student retries) | `adviser-request.service.test.ts`, `adviser-request.rules.test.ts`, `adviser-request-signing.test.ts`, `faculty-10-adviser-eligibility.test.ts` | `verify-gs020-1b-adviser-request.mjs` (18/18), `verify-adv6-adviser-actions.mjs` (19/19) | **Verified** |
| Full Administrator (complete approved Admin catalog, Admin Management, no Faculty academic override, protected security audit) | `administrator-access.service.test.ts`, `administrator-access.routes.test.ts`, `administrator-access-contention.test.ts` (`af5b1d4`), `settings-access-audit.test.ts`, `faculty-12-essay-evaluation.routes.test.ts` | `administrators-management.spec.ts` #1, #3, #5, #27 (37/37 Chrome PASS), `verify-faculty-15-admin.mjs` (50/50) | **Backend, MariaDB & Chrome UI verified** (owner QA pending for FACULTY-15) |
| Restricted Administrator & zero-grant Restricted | `faculty-5..10` route/service/boundary tests, `faculty-9-dashboard.test.ts` | `administrators-management.spec.ts` #2, #6, #10-#17, #29 (Chrome PASS) | **Backend & Chrome UI verified** |
| Current-account revocation, disabled/demoted/removed seat & realtime eviction (`403` != logout) | `auth.middleware.test.ts`, `account-access.test.ts`, `faculty-5..10`, `defense-realtime.*`, `administrator-access-contention.test.ts` | `administrators-management.spec.ts` #18-#22, #25-#26; `faculty-portal.spec.ts` #14, #28, #30, #33 | **Verified** *(note transient cold-compile `visibilitychange` flake observed once in `task-378` on `faculty-portal.spec.ts` #35/#40)* |
| Same-Gmail Faculty/Admin dual accounts (DR-4) | `tests/integration/faculty-17a-identity.test.ts` (`f29c994`, MariaDB `81/81`), `tests/unit/access/faculty-17a-email.test.ts`, `auth.login.test.ts` | `faculty-17a-login.spec.ts` (**6/6 Chrome PASS**) | **Backend/UI verified; FACULTY-17A formal owner acceptance PENDING** |
| `CUSTOM` retirement & preservation of `PanelRole.PANELIST` / academic history | `tests/integration/faculty-17-retirement.test.ts` (`833d2e6`), `faculty-17-retirement.routes.test.ts`, grep audit (`0` runtime/schema/frontend occurrences) | `administrators-management.spec.ts` #30-#37 (`/admin/users/roles` redirects/denials, 4 login choices, `/about`, `/faq`) | **Backend/UI verified; FACULTY-17 formal owner acceptance PENDING** |
| Upgrade / restart / rollback compatibility | `tests/unit/migrations/*`, `faculty-16-cutover-rehearsal.test.ts` (`f86a52f`), `faculty-17-retirement.test.ts`, `faculty-17a-identity.test.ts`, owner `npx prisma migrate status` (`58 migrations`, `Database schema is up to date!`) | N/A (backend/DB rehearsal) | **Isolated MariaDB & owner local `migrate status` verified** |

---

## 6. Reconciled Final Coverage Ledger

All routes below live under `/api` (mounted via `backend/src/routes/index.ts`). Because code-owned flags remain `false`, dormant mode preserves legacy behavior except `/api/admin/administrators*`, `/api/admin/panelists*`, and `/api/exam/essay-evaluations*`, which return controlled `503` while dormant. Zero unclassified administrative routes exist.

### 6.1 Administrative & Shared HTTP Endpoints

| Router / Group | Exact Methods & Paths | Owning Package | Required Capability / Ownership / Policy | Positive & Negative Evidence | Ledger Status |
| --- | --- | --- | --- | --- | --- |
| App & Public | `GET /api/health`, `GET /api/programs`, `USE /uploads` (`403`) | Core | Public read or hard-denied static `/uploads` (`403`) | `app.ts:36-46`; `program.routes.ts:7` | Classified |
| Auth & Self-Access | `POST /api/auth/register` (Public Applicant); `POST /api/auth/login` (4-role selector); `GET /api/auth/me` (`authenticateJWT`, allowlisted on `mustChangePassword`); `POST /api/auth/change-password` | `FACULTY-1/2/3/13/17/17A` | Server-reloaded current User (`loadCurrentAccount`, `EffectiveAccessService`), role-scoped normalized email | `auth.login.test.ts`, `auth.middleware.test.ts`, `faculty-13-effective-access.routes.test.ts`, `faculty-17-retirement.routes.test.ts`, `faculty-17a-login.spec.ts` | Classified (FACULTY-17/17A owner acceptance pending) |
| Applicant Self | `GET /api/applicant/profile` | Core | `requireRole(["APPLICANT"])`, self `req.user.userId` | `applicant.routes.ts:11-16`, `auth.middleware.test.ts` | Classified |
| Administrator Access | `GET /api/admin/administrators`, `GET /:userId`, `POST /`, `PATCH /:userId`, `DELETE /:userId/access` | `FACULTY-4/15` | `assertFullAdministrator` + `administrator_access.manage`, singleton fence + actor `FOR UPDATE`, last-Full guard (`ADMINISTRATOR_MANAGEMENT_ENABLED=false` -> `503`) | `administrator-access.routes.test.ts`, `administrator-access.service.test.ts`, `administrator-access-contention.test.ts` (`af5b1d4`), `administrators-management.spec.ts` | Classified (FACULTY-15 owner QA pending) |
| Admission & Student Admin (18) | `/api/admin/applicants` (`GET /`, `GET /:id` -> `applicants.view`; `PUT /:id/waiver/{validate,reject}` -> `waivers.manage`; `PUT /:id/cor/{verify,reject}` & `PUT /:id/promote` -> `cor.verify`), `/api/cor` (`GET /pending` -> `cor.view`; `POST /{verify,reject}/:id` -> `cor.verify`), `/api/waivers` (`GET /` -> `waivers.view`; `PUT /:id/{validate,reject}` -> `waivers.manage`), `/api/admin/students` (`GET /`, `GET /:id`, `GET /:id/journey` -> `students.view`; `PUT /:id/comprehensive-exam` -> `students.comprehensive_exam.manage`), `POST /api/student/:id/comprehensive-exam` | `FACULTY-5` | `requireRole(["ADMIN"])` + `requireAdmissionStudentCapability(...)` + service `loadCurrentAccount` + tx fence (`verifyAndPromote`, `rejectUpload`, `validateWaiver`) | `faculty-5-admission-student.routes.test.ts`, `admission-student-authorization.test.ts`, `faculty-5-authority-boundary.test.ts`, `faculty-5-business-regression.test.ts`, `faculty-5-dormant.routes.test.ts` | Classified |
| COR / Student / Waiver Self | `POST /api/cor/upload`, `GET /api/cor/my-upload` (`APPLICANT`); `GET /api/student/journey` (`STUDENT`); `GET /api/waivers/me`, `GET /api/waivers/me/download` (`authenticateJWT`, own applicant/student profile) | Core / `FACULTY-5` | Exact own `userId` (`cor.routes.ts:11-12`, `student.routes.ts:8-13`, `waiver.routes.ts:16-17`) | `cor.lifecycle.service.test.ts`, `cor.repository.atomic.test.ts`, `student-thesis-journey.service.test.ts` | Classified |
| Exam Admin (32 mapped + 2 excluded) | `/api/exam`: `GET /slots`, `GET /slots/:id/bookings`, `GET /assignment-options/:studentId`, `GET /applications/:id/amendment-options`, `GET /appeals` (`exam.schedules.view`); `POST /slots`, `PUT /slots/:id`, `PATCH /slots/:id/status`, `POST /assignments`, `POST /applications/:id/{missed-appeal/approve,missed-appeal/reject,reschedule,cancel-appointment}`, `PATCH /appeals/:id/{approve,reject}` (`exam.schedules.manage`); `GET /applications`, `GET /applications/:id`, `/api/exam-engine/admin/applications/:applicationId/execution` (`exam.records.view`); `POST .../start-authorization` (`exam.starts.authorize`); `POST /api/exam/scores/:id/finalize` (`exam.results.finalize`); `POST /api/exam/applications/:id/reconsider-result` (`exam.results.reconsider`); `GET /exam-engine/admin/{questions,question-set}` & shared `GET /exam-engine/media/:mediaId` Admin branch (`exam.questions.view`); `POST/PUT/DELETE /exam-engine/admin/questions`, `POST /exam-engine/admin/media`, `PUT/POST /exam-engine/admin/question-set{,/publish}` (`exam.questions.manage`); `GET/PUT /exam-engine/admin/configuration` (`exam.configuration.manage`). Excluded in enabled mode: `POST /api/exam/scores/:id/{grade,send-email}` | `FACULTY-6` | `requireRole(["ADMIN"])` + `requireExamAdministrationCapability` / `excludeExamAdministrationAction` + tx fence + explicit `assertExcluded` | `faculty-6-exam-administration.routes.test.ts`, `exam-administration-authorization.test.ts`, `faculty-6-exam-boundaries.test.ts`, `faculty-6-frozen-results.test.ts` | Classified |
| Exam Applicant Execution | `POST /api/exam/applications/:id/missed-appeal`, `GET /api/exam/slots/available`, `POST /api/exam/schedule`, `GET /api/exam/status`, `POST /api/exam/appeal` (`409` retired), `GET /api/exam/result`, `/api/exam-engine` Applicant execution + retired `409` routes, shared `GET /exam-engine/media/:mediaId` Applicant branch | `Exam B0-B10` / `FACULTY-6` | `requireRole(["APPLICANT"])` + exact owner `student.userId === actorId` + bound started execution | `exam-execution.routes.test.ts`, `exam-amendment.routes.test.ts`, `exam-answer.controller.test.ts` (note 10 pre-FACULTY-2/B10/6 legacy route/controller test mocks fail in full suite) | Classified |
| Faculty Essay Evaluation (4) | `GET /api/exam/essay-evaluations`, `GET /:id`, `POST /:id/grade`, `GET /:id/media/:mediaId/content` | `FACULTY-12` | Router `authenticateJWT`, `facultyEssayAuthorization.assert` (`FACULTY`/`PANELIST`, active profile, `!mustChangePassword`, `essay.evaluate`), tx `lockEvaluator` + `FOR UPDATE`, `503` while `FACULTY_ESSAY_EVALUATION_ENABLED=false` | `faculty-12-essay-evaluation.test.ts`, `faculty-12-essay-contention.test.ts` (`af5b1d4`), `faculty-12-essay-evaluation.routes.test.ts` (46/46 PASS) | Classified |
| Defense & Adviser Admin (25 mapped + 15 classified) | `/api/thesis`: 25 mapped capabilities (`adviser.requests.{view,review}`, `defense.applications.{view,review}`, `defense.schedules.{view,manage}`, `defense.records.view`); 15 explicit enabled-target Admin denials/exclusions/deferences (unrestricted `/adviser/available` Student-only ODP alias, `/eligibility/:defenseType`, `/defense/:scheduleId/lobby`, 10 FACULTY-8 official-record/PDF routes delegated to FACULTY-8, `/rap-reports/:rapId/remind` `excludeDefenseAdviserAdministration`, and retired `409` `POST /rap-reports/:rapId/distribute` tested on both Full/Restricted) | `FACULTY-7/8/10/17B` | `requireRole(["ADMIN"])` + `requireDefenseAdviserCapability` / `excludeDefenseAdviserAdministration` + tx fence + manual participant & auto-Adviser checks | `faculty-7-defense-adviser.routes.test.ts`, `faculty-7-defense-adviser-boundaries.test.ts`, `thesis.repository.review-audit.test.ts`, `defcorr1-schedule-correction.routes.test.ts`, `faculty-10-adviser-eligibility.test.ts` | Classified |
| Student / Academic Thesis, Adviser & CDW | Student defense/journey/eligibility/resubmit/adviser-request & Student PDF/RAP routes; Academic Proposal/Final Adviser reviews, Adviser Workspace, Panelist assignments/dashboard, Evaluation, RAP signing, Chairman start/conclusion, Rapporteur notes/finalize, CDW annotations/report/history | `FACULTY-3/7/10/17B` / `UIUX-3E` / `CDW` | Exact ownership (`student.userId === userId`), sole internal active `AdviserAssignment`, exact `requestedAdviserId === userId`, or active exact `PanelAssignment` seat & contextual role | `adviser-workspace.service.test.ts`, `adviser-request.service.test.ts`, `proposal-adviser-review.service.test.ts`, `final-adviser-review.service.test.ts`, `panelist-dashboard.service.test.ts`, `faculty-external-adviser-isolation.routes.test.ts`, `defense-realtime.authorization.test.ts`, `faculty-3-compatibility.test.ts` (43/43 PASS), `thesis.repository.active-adviser.test.ts` (3/3 PASS) | Classified |
| Faculty Config & Self Profile | `/api/admin/panelists`: `GET /management-context` (`faculty.view`), `GET /`, `GET /:id` (`faculty.view`), `POST /`, `PUT /:id` (`faculty.manage`); `/api/panelists`: `GET /me` (academic), `PATCH /me/availability` (denied when `FACULTY_CONFIGURATION_ENABLED=true`) | `FACULTY-3/10/11/17B` | `requireFacultyCapability` (`503` while `FACULTY_CONFIGURATION_ENABLED=false`), `denyFacultySelfAvailability`, DR-7 lock, bounded DTOs | `faculty-10-configuration.routes.test.ts`, `faculty-10-configuration.controller.test.ts`, `faculty-10-configuration.test.ts`, `admin-panelist.repository.test.ts` | Classified |
| Settings, Storage, Email Logs, Dashboard | `GET /settings` (`settings.view`), `PUT /settings/:key` (`settings.manage`), `GET/PUT /settings/email-templates*` (`email.configuration.manage`), `GET /settings/audit-logs` (`audit.view`), `DELETE/POST /settings/audit-logs*` (excluded); `GET /admin/email-logs/logs` (`email.logs.view`); `GET /admin/storage/health` (`storage.health.view`), `POST /admin/storage/integrity-scan` (`storage.integrity.scan`); `GET /admin/dashboard` (per-section capability containment) | `FACULTY-9` | `requireOperationalCapability` / `excludeOperationalAction` + `OperationalAuthorization` tx fence + protected access-audit deletion preserved | `faculty-9-operations.routes.test.ts`, `faculty-9-operations.test.ts`, `faculty-9-dashboard.test.ts`, `settings-access-audit.test.ts`, `storage-health.service.test.ts`, `storage-health.controller.test.ts` (note pre-FACULTY-9 `admin-storage.routes.test.ts` stack length fails) | Classified |
| Repository, Databank, Memos, Evaluation | `GET /databank` & `GET /repository/admin/entries` (`repository.view`), `PUT /repository/admin/entries/:id/{publish,unpublish,metadata}` (`repository.manage`), `GET /repository/{,:id}` (`optionalAuthenticateJWT`, member download excluding respondent data), `GET /databank/public{,/:id}` (guest-only), Student `/databank/archive*`; `POST /memos` & `PATCH /memos/:id/archive` (`memos.manage`), `GET /memos` (`memos.manage` for Admin, audience filter for others); `POST /evaluation/request` (`STUDENT`), `POST /evaluation/:id/assign` (excluded) | `FACULTY-9` | `OperationalAuthorization`, tx fence, `canReadMemoAudience`, Student researcher-only raw data | `faculty-9-repository-memo.test.ts`, `repository.routes.test.ts`, `repository.controller.test.ts`, `repository-publication.service.test.ts`, `databank-archive.service.test.ts`, `faculty-3-memo.test.ts` | Classified |
| Own Notifications (FACULTY-18 closure fix) | `GET /api/notifications`, `PUT /api/notifications/:id/read` | Core / `FACULTY-18 closure` | `authenticateJWT`; `getMyNotifications` filters `where: { userId }`; **`markAsRead` now enforces `{ id, userId }` via `updateMany` + `findFirst` returning identical `404` on foreign or missing IDs** | `notification.controller.ts:7-34`, `notification.service.ts:13-24`, `notification.repository.ts:35-43`, `notification-ownership.routes.test.ts` (5/5 PASS) | Classified & Fixed |

### 6.2 `DocumentService` Private File Classes & Official Output / PDF / Media Paths

| Class / Endpoint | Exact Handler / Location | Owning Package | Capability / Ownership Policy | Evidence | Status |
| --- | --- | --- | --- | --- | --- |
| `cor-upload` | `DocumentService` (`document.service.ts:242-247, 388`) | `FACULTY-8` | Owner (`STUDENT`/`APPLICANT`) OR Admin `cor.view` | `faculty-8-private-documents.test.ts`, `faculty-8-private-records.routes.test.ts` | Classified |
| `thesis-document` | `DocumentService` (`:248-292, 394-398`) | `FACULTY-8/17B` | Student owner OR active internal Adviser (not External) / bound active committee OR Admin `defense.applications.view` / contextual `defense.schedules.view`; Admin denied `RESPONDENT_DATA` | `faculty-8-private-documents.test.ts`, `adv5-document-service-auth.test.ts`, `cdw6-document-auth.test.ts`, `cp8-document-auth.test.ts`, `document-auth.stage-aware.test.ts` | Classified |
| `rap-report` | `DocumentService` (`:293-298, 390`) | `FACULTY-8` | No owner; Admin `defense.records.view` | `faculty-8-private-documents.test.ts` | Classified |
| `student-requirement` | `DocumentService` (`:299-304, 389`) | `FACULTY-8` | Student owner OR Admin `students.view` | `faculty-8-private-documents.test.ts` | Classified |
| `plagiarism-result` | `DocumentService` (`:305-310, 391-393`) | `FACULTY-8` | Same-thesis Student owner OR Admin `defense.applications.view` | `faculty-8-private-documents.test.ts` | Classified |
| `memo` | `DocumentService` (`:311-317, 362-371`) | `FACULTY-9` | Dormant: unarchived authenticated fallback; Enabled: Admin `memos.manage` (no creator bypass) or `canReadMemoAudience` + unarchived | `faculty-9-private-documents.test.ts`, `faculty-9-repository-memo.test.ts` | Classified |
| `elibrary-manuscript` | `DocumentService` (`:318-338, 372-383`) | `FACULTY-9` | Valid same-thesis link + Student owner OR `isPublic` active member (`STUDENT`/`ADMIN`/`FACULTY`/`PANELIST`, never `APPLICANT`) OR Admin `repository.view` | `faculty-9-private-documents.test.ts`, `faculty-9-repository-memo.test.ts` | Classified |
| `elibrary-respondent-data` | `DocumentService` (`:339-354, 372-376`) | `FACULTY-9` | Enabled: exact current `STUDENT` owner only; Admin/Full/`repository.view`/`FACULTY`/`PANELIST` denied | `faculty-9-private-documents.test.ts`, `faculty-9-repository-memo.test.ts` | Classified |
| Official Records & PDFs (`GS-017`, `GS-020`, `FORM-INT-1..4`, Student `GS-006/007/RAP`, Waiver) | `/api/thesis/adviser-certifications{,/:id/pdf}`, `/adviser/requests/{records,:id/pdf}`, `/defense/:scheduleId/records/{criteria/:paId{,/pdf},summary{,/pdf},application/pdf,evaluations/pdf}`, `/student/defense/:scheduleId/{application{,/pdf},rap}`, `/api/waivers/me/download` | `FACULTY-8/17B` & `UIUX-3E` | Student own / internal Faculty issuer or requestedAdviser / active evaluator JSON (`signatureData` stripped); Admin `defense.applications.view` / contextual `defense.schedules.view` / `adviser.requests.view` / `defense.records.view` per route | `faculty-8-official-records.test.ts`, `official-defense-document.service.test.ts`, `official-defense-summary-document.service.test.ts`, `official-defense-application-document.service.test.ts`, `official-defense-evaluation-bundle.service.test.ts`, `adviser-certification-document.service.test.ts`, `adviser-request-record.service.test.ts`, `cp7-official-defense-records.test.ts`, `verify-form-int-4-official-pdf-actions.mjs` | Classified |
| Exam Media & Essay Images | `GET /api/exam-engine/media/:mediaId`, `GET /api/exam/essay-evaluations/:id/media/:mediaId/content` | `FACULTY-6/12` | Admin `exam.questions.view` or bound `APPLICANT`; active `FACULTY`/`PANELIST` with `essay.evaluate` and pending frozen essay (`FACULTY-12`) | `exam-media.service.test.ts`, `exam-media-access.test.ts`, `faculty-12-essay-evaluation.routes.test.ts` | Classified |

### 6.3 Realtime / Socket.IO Surface

Single Socket.IO server (`backend/src/realtime/defense-realtime.server.ts`, attached in `backend/src/index.ts:14`):

| Surface | Policy & Current-Account Enforcement | Evidence | Status |
| --- | --- | --- | --- |
| Socket handshake (`defense-realtime.auth.ts:28-58`) | Reads JWT exclusively from `socket.handshake.auth.token`, runs `loadCurrentAccount(userId)`, requires active `FACULTY`/`PANELIST`, `!mustChangePassword`, active `Panelist` profile | `defense-realtime.auth.test.ts`, `faculty-3-realtime.test.ts` | Classified |
| `defense:join` & `defense:leave` (`defense-realtime.authorization.ts:28-52`) | Validates active defense status (`SCHEDULED`/`IN_PROGRESS`/`AWAITING_CONCLUSION`), exact `panelAssignment.isActive === true` + `DEFENSE_CURRENT_ACCOUNT_FILTER` | `defense-realtime.authorization.test.ts`, `defense-realtime.server.test.ts` | Classified |
| 9 CDW-8 server events (`defense-realtime.types.ts:10-20`) | Pre-delivery re-query (`resolveDefenseDeliveryAuthorization`) + `socket.leave` eviction of stale/revoked/removed seats before emit | `defense-realtime.publish.test.ts`, `defense-realtime.publisher.test.ts`, `defense-realtime.bootstrap.test.ts` | Classified |
| `report:preview` (`defense-report-preview.server.ts`) | Verified room membership, active `RAPPORTEUR` assignment + `DEFENSE_CURRENT_ACCOUNT_FILTER`, editable report check, per-recipient eviction before emit | `defense-report-preview.authorization.test.ts`, `defense-report-preview.rules.test.ts`, `defense-report-preview.server.test.ts`, `defense-report-preview.store.test.ts` | Classified |

### 6.4 `CUSTOM` / `CustomRole` / `RoleFeatureAccess` Repository Audit

- `backend/prisma/` & `backend/scripts/`: **0 occurrences** (historical migrations preserved).
- `frontend/src/`: **0 runtime `CUSTOM` or `CustomRole` occurrences** (`CustomError` in `auth.ts` is NextAuth error class; nav group `"Other"` is admin sidebar label; CSS `@custom-variant` is Tailwind).
- `backend/src/`: **1 intentional rejection guard only** (`backend/src/access/cutover-rehearsal.ts:133-136`, refusing un-retired pre-FACULTY-17 schemas/rows).
- `backend/tests/fixtures/`: **0 occurrences**. `backend/tests/`: only negative rejection/isolation/retirement tests and forged/stale JWT claim tests where DB identity is active `ADMIN`/`FACULTY`/`STUDENT`.

---

## 7. Next Actions Required Before FACULTY-18 Acceptance & Activation

1. Complete project-owner manual/browser QA and record formal acceptance for **FACULTY-17** and **FACULTY-17A** (owner local `npx prisma migrate status` already confirmed `58 migrations found` and `Database schema is up to date!`).
2. Complete project-owner manual/browser acceptance for **FACULTY-11** and **FACULTY-15**, plus any genuinely uncovered **FACULTY-14** interactive flows (outside UIUX-3E's owner-accepted Dashboard and sidebar refinement), and independent review of this closure pass. Once satisfied, FACULTY-18 can conclude `READY FOR SEPARATELY AUTHORIZED CONTROLLED ACTIVATION`.
3. Only **after** FACULTY-18 acceptance, obtain separate explicit project-owner authorizations for **staging/production DR-1** (initial Full Administrator bootstrap identity; bounded local-dev-only bootstrap for `admin@earist.edu.ph` in XAMPP `graduate_system` was separately authorized and recorded on 2026-11-11 in [the DR-1 local-dev bootstrap report](2026-11-11-dr1-local-dev-initial-full-administrator-bootstrap.md)), **DR-2** (live account disposition), and controlled rollout/gate activation from `false`.
