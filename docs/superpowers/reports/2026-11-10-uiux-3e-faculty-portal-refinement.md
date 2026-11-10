# UIUX-3E Implementation Report — Faculty Portal UI/UX Refinement: Sidebar Navigation Stability + Richer Faculty Dashboard

- **Date:** 2026-11-10
- **Branch:** `feat/faculty-admin-access`
- **Starting HEAD:** `4f98c1ebb42964389e173ddc6e094c38ea8e8410`
- **Status:** **IMPLEMENTED / PENDING INDEPENDENT REVIEW** (not visually accepted; not an Approved Reference Implementation; project-owner browser/visual acceptance pending)

---

## 1. Executive Summary

UIUX-3E delivers two coordinated frontend refinements for the Faculty portal (`/panelist/*`) as a prerequisite before FACULTY-18:

1. **Part A — Sidebar Navigation Stability:** Eliminates sidebar flickering and vertical layout shifting (~132px upward/downward jump of lower navigation items) during ordinary same-account route navigation by filtering sidebar links with a pure presentation helper (`isFacultyNavAreaVisible(access.snapshot, item.area)`) backed by the last confirmed same-account `FacultyWork` snapshot while `/auth/me` revalidates in the background. Protected route content remains strictly gated by `FacultyRouteGate` until the fresh `/auth/me` check resolves, revoked areas (`relevant: false`) are removed as soon as the fresh response returns, and access-resolution failures (`query.isError`) fail closed (`snapshot === null`).
2. **Part B — Richer Faculty Dashboard:** Refines `frontend/src/app/(portal)/panelist/dashboard/page.tsx` using the earlier UIUX-3A (`990210051756cf2713fcedc61ad9cdfd0555ea08`) operational overview and its agreed FIX-1 direction as structural reference while preserving the FACULTY-13/14 (`cbf15478e38d3c483c417e45888aefd6577ed303`) dynamic account-scoped relevance architecture. All nine sections (**Page Header** with bounded `Refresh`, **Your Work**, conditional **Upcoming Defenses** KPI, conditional **Pending Tasks** KPI, conditional **Active Defense**, **Needs Your Attention** with task expansion, embedded compact collapsible **Waiting on Others** with independent count, conditional **Upcoming Defense Sessions** with highlighted **Next Defense**, and **Recent Notifications**) are driven by existing account-scoped read models (`GET /auth/me`, `GET /thesis/defense/panelist/dashboard`, and `GET /notifications`) with zero backend, database, schema, or activation-gate changes.

---

## 2. Parallel Read-Only Subagent Investigations

Two read-only `research` subagents investigated Part A and Part B in parallel before any file edits:

### 2.1 Subagent 1 — Part A: Sidebar Navigation Stability (`dea9a7ee-c710-41f1-b0d7-20ae4fc059b2`)

- **Files inspected:**
  - `frontend/src/app/(portal)/panelist/layout.tsx` (`FacultyShell`, `navItems`, `isNavItemActive`, `isImmersiveDefenseWorkspaceRoute`)
  - `frontend/src/components/faculty/faculty-access-provider.tsx` (`FacultyPortalProvider`, `AccountQueries`, `AccessReader`, `FacultyRouteGate`)
  - `frontend/src/lib/faculty-access.ts` (`FacultyWork`, `FacultyArea`, `readFacultyWork`, `facultyAreaForPath`, `facultyKey`)
- **Confirmed root cause of sidebar flickering and vertical shift:**
  1. On every route transition inside `/panelist/*`, `FacultyRouteGate` runs `useEffect(() => { void refresh() }, [path, refresh])`, triggering `query.refetch()` on `/auth/me`.
  2. While `query.isFetching === true`, `AccessReader` retains the last confirmed same-account data in `snapshot = query.isError ? null : (query.data ?? null)`, but sets `work: query.isFetching ? null : snapshot` (`work = null`).
  3. Because `FacultyShell` in `frontend/src/app/(portal)/panelist/layout.tsx` filtered `navItems` using `access.work?.[item.area].relevant === true`, the three conditional middle items (`Essay Evaluations`, `My Defenses`, `My Advisees` at indices 2–4) were removed from the DOM on every route change while `/auth/me` was in flight, causing `E-Signatures`, `Repository`, `Announcements`, and `Notifications` to jump upward by up to 132px and then shift back down once `/auth/me` completed.
  4. No CSS geometry defect, layout remount (`FacultyPortalProvider` and `AccountQueries` remain mounted across same-account `/panelist/*` route changes), or scrollbar overflow bug contributed to the shift.
- **Recommended minimal correction:** Filter sidebar navigation items using `access.snapshot` via a dedicated presentation helper (`isFacultyNavAreaVisible(access.snapshot, ...)`), while keeping `FacultyRouteGate` and all page/API gates strictly bound to fresh `access.work` and `access.loading`.

### 2.2 Subagent 2 — Part B: Richer Faculty Dashboard (`f71b7b02-fa9d-4327-a7af-2984dca9a051`)

- **Files inspected:**
  - `frontend/src/app/(portal)/panelist/dashboard/page.tsx` (current FACULTY-14 `cbf15478e38d3c483c417e45888aefd6577ed303` and historical UIUX-3A `990210051756cf2713fcedc61ad9cdfd0555ea08`)
  - `frontend/src/lib/panelist-dashboard.ts`
  - `backend/src/services/panelist-dashboard.service.ts`, `backend/src/services/panelist-dashboard.rules.ts`, `backend/src/repositories/panelist-dashboard.repository.ts`
  - `frontend/src/components/layout/notification-bell.tsx`, `frontend/src/app/(portal)/panelist/notifications/page.tsx`
- **Read-model findings:**
  - `GET /auth/me` (`facultyWork`) provides authoritative relevance flags and summary counts (`essayEvaluations.relevant`, `myAdvisees.{relevant, activeAdviseeCount, addressedRequestCount, issuedCertificationCount}`, `myDefenses.{relevant, assignmentCount}`).
  - `GET /thesis/defense/panelist/dashboard` (`PanelistDashboardView`) already returns authoritative account-scoped `kpis` (`upcomingDefenses`, `pendingTasks`), `needsAttention` (priority-sorted actionable Defense and Adviser tasks with exact deep links), `activeDefenses` (`IN_PROGRESS` sessions only), `upcomingDefenses` (`SCHEDULED` sessions with `defenseDate >= today` sorted chronologically), and `waitingOnOthers` (read-only informational dependencies).
  - `GET /notifications` returns the authenticated account's notification records (`id`, `title`, `message`, `isRead`, `createdAt`).
  - All nine dashboard sections are fully supported by existing backend read models without any backend or schema extension.

---

## 3. Implementation Details

### 3.1 Part A — Sidebar Navigation Stability

- **`frontend/src/lib/faculty-access.ts`**:
  - Added `isFacultyNavAreaVisible(snapshot: FacultyWork | null | undefined, area?: FacultyArea): boolean`:
    - Returns `true` for unconditional navigation items (`area === undefined`: `Dashboard`, `Profile`, `E-Signatures`, `Repository`, `Announcements`, `Notifications`).
    - Returns `snapshot?.[area]?.relevant === true` for conditional academic work areas (`essayEvaluations`, `myAdvisees`, `myDefenses`).
- **`frontend/src/app/(portal)/panelist/layout.tsx`**:
  - Updated `FacultyShell` sidebar filtering to call `isFacultyNavAreaVisible(access.snapshot, "area" in item ? item.area : undefined)` instead of reading transient `access.work`.
  - Preserved `FacultyRouteGate` around `<main>` so protected route content continues to wait for `checkedPath === path && !access.loading` and fresh `access.work` validation.
  - Preserved `AccountQueries` (`key={accountId}`) so switching User IDs or signing out immediately discards any retained snapshot and TanStack Query cache.
  - Preserved desktop expanded/collapsed navigation, mobile drawer/overlay, keyboard/focus restoration, Escape key handling, `My Defenses` active-route matching across `/panelist/{defenses,defense-workspace,defense-lobby,scoring,materials}`, and immersive Defense Workspace mode (`/panelist/defense-workspace*`).

### 3.2 Part B — Richer Faculty Dashboard

- **`frontend/src/lib/panelist-dashboard.ts`**:
  - Added pure helpers `isAdviserTask(task)`, `isAdviserWaitingItem(item)`, and `projectFacultyDashboard(work, data)` (`FacultyDashboardProjection`):
    - Computes `hasDetailedWork = Boolean(work.myAdvisees.relevant || work.myDefenses.relevant)`.
    - Shows `Upcoming Defenses` KPI and `Upcoming Defense Sessions` section **only** when `work.myDefenses.relevant === true`.
    - Shows `Pending Tasks` KPI and `Needs Your Attention` section **only** when `hasDetailedWork === true`.
    - Filters `needsAttention` and `waitingOnOthers` by matching relevance (`isAdviserTask` / `isAdviserWaitingItem` -> `work.myAdvisees.relevant`; Defense items -> `work.myDefenses.relevant`).
    - Computes `pendingTasksCount` strictly from `attention.length` (actionable tasks only; `waitingOnOthers` never contributes to `Pending Tasks`).
    - Projects `activeDefenses` and `upcomingDefenses` only when `work.myDefenses.relevant === true`.
- **`frontend/src/app/(portal)/panelist/dashboard/page.tsx`**:
  - **1. Page Header:** `PageHeader` with title `"Faculty Dashboard"`, description `"Your academic work and next actions."`, and bounded `"Refresh"` button (`refetches` `tasks` when `detailed` and `notifications`).
  - **2. Your Work:** Concise responsibility summary card (`Essay Evaluations`, `My Advisees`, `My Defenses`) with entry links, or `"No current academic work."` when no academic work is relevant.
  - **3. Upcoming Defenses & 4. Pending Tasks (KPIs):** Rendered dynamically when relevant (`data-testid="kpi-upcoming-defenses"` and `data-testid="kpi-pending-tasks"`), with structural loading `Skeleton` and `"—"` error fallback.
  - **5. Needs Your Attention:** Lists up to 5 actionable tasks initially (`MAX_VISIBLE_TASKS = 5`) with category icon, task title, `studentName · stage · responsibility`, `statusText · formatWallDate(date)`, and authorized deep link (`task.href`), plus `"Show N more task(s)"` / `"Show fewer tasks"` expansion, empty state (`"No tasks need your attention."`), and error/retry state (`"Unable to load your tasks."` + `"Retry tasks"`).
  - **6. Active Defense:** Rendered **only** when `work.myDefenses.relevant && !tasks.isPending && !tasks.isError && projection.activeDefenses.length > 0`. Displays `"In progress"` badge, student name, `stageLabel · roleLabel · programName`, and `"Open Defense Workspace"` link.
  - **7. Upcoming Defense Sessions:** Rendered when `work.myDefenses.relevant === true`, with `"View All Defenses"` link to `/panelist/defenses`, highlighted `Next Defense` card (role badge, student name, stage/program, `formatWallDate` · `formatWallTime`, `venueOrLink`, `"Open Defense Workspace"` link) plus up to 3 subsequent sessions (`MAX_VISIBLE_OTHER_UPCOMING = 3`), or `"No upcoming defenses are scheduled."` when empty.
  - **8. Waiting on Others:** Embedded inside `Needs Your Attention` as a compact, collapsible informational subsection (`aria-expanded`, independent `${projection.waiting.length} waiting` badge, `"Informational — not counted in Pending Tasks"`), rendered **only** when `projection.waiting.length > 0`.
  - **9. Recent Notifications:** Queries `GET /notifications` under `facultyKey(accountId, "notifications")` (`enabled: Boolean(work)`), displaying up to 5 recent notifications with unread dot (`aria-label="Unread"`), title, message, wall-clock date, `"View All Notifications"` link to `/panelist/notifications`, and independent loading skeleton, error/retry (`"Unable to load notifications."` + `"Retry notifications"`), and empty state (`"No notifications to show."`).

---

## 4. Microcopy Review Against `USER_FACING_COPY_SOURCE_OF_TRUTH.md`

- Checked all visible strings in `frontend/src/app/(portal)/panelist/dashboard/page.tsx`:
  - Headings: `"Faculty Dashboard"`, `"Your Work"`, `"Active Defense"`, `"Needs Your Attention"`, `"Upcoming Defense Sessions"`, `"Recent Notifications"`.
  - KPI labels & subtitles: `"Upcoming Defenses"` (`"Scheduled defense sessions assigned to you"`), `"Pending Tasks"` (`"Actionable items needing your response"`).
  - Waiting subsection: `"Waiting on Others"`, `"<N> waiting"`, `"Informational — not counted in Pending Tasks"`.
  - Empty states: `"No current academic work."`, `"No tasks need your attention."`, `"No upcoming defenses are scheduled."`, `"No notifications to show."`.
  - Error & recovery states: `"Unable to load your tasks."` / `"Retry tasks"`, `"Unable to load upcoming defense sessions."`, `"Unable to load notifications."` / `"Retry notifications"`.
  - Actions: `"Refresh"`, `"Review Essays"`, `"Open My Advisees"`, `"Open My Defenses"`, `"Open Defense Workspace"`, `"View All Defenses"`, `"View All Notifications"`, `"View record"`.
- Zero internal enum identifiers, database/table names, authorization mechanics, or inverse-condition explanations are exposed.

---

## 5. Changed Files

### 5.1 Initial UIUX-3E Package (`030ffb4`, doc fix `d7b8e85`)

1. `frontend/src/lib/faculty-access.ts`
2. `frontend/src/app/(portal)/panelist/layout.tsx`
3. `frontend/src/lib/panelist-dashboard.ts`
4. `frontend/src/app/(portal)/panelist/dashboard/page.tsx`
5. `frontend/scripts/verify-faculty-14-portal.mjs`
6. `frontend/scripts/faculty-14-fixture-server.mjs`
7. `frontend/e2e/faculty-portal.spec.ts`
8. `docs/superpowers/reports/2026-11-10-uiux-3e-faculty-portal-refinement.md`
9. `docs/superpowers/ui-ux/UI_UX_AUDIT.md`
10. `docs/superpowers/ui-ux/SYSTEM_UI_UX_PLAYBOOK.md`
11. `docs/superpowers/plans/2026-11-08-faculty-admin-access-implementation.md`

### 5.2 Bounded Correction — Adviser Waiting Classification & External Faculty Adviser Data Isolation (starting HEAD `d7b8e858370e81674bdc779b415ddc8993d49c0f`)

1. `frontend/src/lib/panelist-dashboard.ts`
2. `frontend/scripts/verify-faculty-14-portal.mjs`
3. `backend/src/repositories/panelist.repository.ts`
4. `backend/src/services/adviser-request.service.ts`
5. `backend/src/services/adviser-workspace.service.ts`
6. `backend/src/repositories/panelist-dashboard.repository.ts`
7. `backend/src/services/panelist-dashboard.service.ts`
8. `backend/tests/unit/services/adviser-request.service.test.ts`
9. `backend/tests/unit/services/adviser-workspace.service.test.ts`
10. `backend/tests/unit/services/panelist-dashboard.service.test.ts`
11. `backend/tests/unit/repositories/panelist-dashboard.repository.test.ts`
12. `backend/tests/unit/routes/faculty-external-adviser-isolation.routes.test.ts`
13. `docs/superpowers/reports/2026-11-10-uiux-3e-faculty-portal-refinement.md`

### 5.3 Final Bounded Correction — External Faculty Isolation across Effective Access, GS-020, and GS-017 (starting HEAD `4e866d37649d1abf8964aa2205cbef2d997c8b20`)

1. `backend/src/services/effective-access.service.ts`
2. `backend/src/services/adviser-request-record.service.ts`
3. `backend/src/services/adviser-certification-record.service.ts`
4. `backend/tests/unit/routes/faculty-13-effective-access.routes.test.ts`
5. `backend/tests/unit/services/adviser-request-record.service.test.ts`
6. `backend/tests/unit/services/adviser-certification-document.service.test.ts`
7. `backend/tests/unit/services/faculty-8-official-records.test.ts`
8. `backend/tests/unit/routes/faculty-external-adviser-isolation.routes.test.ts`
9. `docs/superpowers/reports/2026-11-10-uiux-3e-faculty-portal-refinement.md`
10. `docs/superpowers/ui-ux/UI_UX_AUDIT.md`
11. `docs/superpowers/ui-ux/SYSTEM_UI_UX_PLAYBOOK.md`
12. `docs/superpowers/plans/2026-11-08-faculty-admin-access-implementation.md`

### 5.4 Final Bounded Correction — Fail-Closed Active Internal Panelist Profile Validation (starting HEAD `369cb328160f68c8d1d5fb82b0ad6b82ba6bc854`)

1. `backend/src/repositories/panelist.repository.ts`
2. `backend/src/services/adviser-request-record.service.ts`
3. `backend/src/services/adviser-certification-record.service.ts`
4. `backend/tests/unit/repositories/panelist.repository.test.ts` (new)
5. `backend/tests/unit/services/adviser-request-record.service.test.ts`
6. `backend/tests/unit/services/adviser-certification-document.service.test.ts`
7. `backend/tests/unit/services/faculty-8-official-records.test.ts`
8. `backend/tests/unit/routes/faculty-external-adviser-isolation.routes.test.ts`
9. `docs/superpowers/reports/2026-11-10-uiux-3e-faculty-portal-refinement.md`
10. `docs/superpowers/ui-ux/UI_UX_AUDIT.md`
11. `docs/superpowers/ui-ux/SYSTEM_UI_UX_PLAYBOOK.md`
12. `docs/superpowers/plans/2026-11-08-faculty-admin-access-implementation.md`

---

## 6. Initial UIUX-3E Verification & Evidence Record

### 6.1 Automated Verifier & Unit Suites (Executed — PASS)

- `node scripts/verify-faculty-14-portal.mjs` (in `frontend`): **44 / 44 PASS** (includes new UIUX-3E Part A `isFacultyNavAreaVisible` and layout snapshot-filtering checks, plus UIUX-3E Part B `projectFacultyDashboard` across all 8 responsibility combinations, task/waiting separation, and date/time formatting).
- `node scripts/verify-adv6-adviser-actions.mjs` (in `frontend`): **19 / 19 PASS**
- `node scripts/verify-adv7-fix1-my-advisees-ux.mjs` (in `frontend`): **10 / 10 PASS**
- `node scripts/verify-cdw4-workspace.mjs` (in `frontend`): **9 / 9 PASS**
- `node scripts/verify-cdw2-contracts.mjs` (in `frontend`): **11 / 11 PASS**
- `node scripts/verify-faculty-2-session.mjs` (in `frontend`): **19 / 19 PASS**
- `node scripts/verify-faculty-3-compatibility.mjs` (in `frontend`): **8 / 8 PASS**
- `npx vitest run tests/unit/services/panelist-dashboard.rules.test.ts` (in `backend`): **21 / 21 PASS**
- `node scripts/verify-adv7-navigation-consolidation.mjs` (in `frontend`): **6 / 8 — 2 FAIL** ("My Advisees is the sole Adviser sidebar entry…" and "My Advisees base and nested routes keep generic active matching"). Its single-line `{ href, label }` regex does not match the multi-line `My Defenses` / `My Advisees` entries that carry FACULTY-14 `area` properties. UIUX-3E did not change the `navItems` declaration (only the `.filter(...)` call), so this is **inferred** to be a pre-existing failure; it was **not re-executed at the starting HEAD** to confirm.

### 6.2 TypeScript, Scoped ESLint, Production Build, and Diff Check (Executed — PASS)

- Frontend TypeScript (`node node_modules/typescript/bin/tsc --noEmit`): **PASS** (0 errors)
- Scoped ESLint (`npx eslint "src/lib/faculty-access.ts" "src/lib/panelist-dashboard.ts" "src/app/(portal)/panelist/layout.tsx" "src/app/(portal)/panelist/dashboard/page.tsx" "scripts/verify-faculty-14-portal.mjs" "scripts/faculty-14-fixture-server.mjs" "e2e/faculty-portal.spec.ts"`): **PASS** (0 errors, 0 warnings)
- Frontend Production Build (`npm run build` in `frontend`): **PASS** (compiled in 10.2s, TypeScript 7.4s, 69/69 static and dynamic routes generated)
- `git diff --check`: **PASS** (final, after removing trailing blank lines at EOF in three files)
- **Timing caveat:** TypeScript, scoped ESLint, production build, and the frontend verifiers ran **before** two later changes: (1) the Part A Playwright test in `frontend/e2e/faculty-portal.spec.ts` was rewritten to hold `/auth/me` deterministically with `page.route`, and (2) trailing blank lines at EOF were removed from `faculty-portal.spec.ts`, `verify-faculty-14-portal.mjs`, and `panelist-dashboard.ts`. Application source was unchanged apart from the EOF whitespace. Per project-owner instruction, these checks were **not re-run** after those edits. Scoped ESLint was run once, before the final one-line TypeScript fix in `dashboard/page.tsx` (removing an invalid generic argument from `apiClientRequest`); after that fix, TypeScript was re-run and passed.

### 6.3 Synthetic Playwright Browser Verification & Manual/Visual QA Status

- **Synthetic Playwright browser run (`e2e/faculty-portal.spec.ts`):** **INCOMPLETE / NOT CLAIMED AS BROWSER QA PASS.** An initial run against the synthetic fixture server passed 39 of 40 tests (including all 36 FACULTY-14 regression tests and all 3 new UIUX-3E Part B richer-dashboard tests), while 1 new Part A test timed out waiting to observe the transient `"Loading Faculty access"` state under a fixed 500ms `accessDelay`. The test was updated to use deterministic `page.route` holding on `**/api/auth/me`, and execution was stopped per project-owner instruction without re-running the browser suite. Browser QA is therefore **not claimed as PASS**.
- **Hosted CI:** **NOT OBSERVED**.
- **Project-owner manual/visual QA and acceptance:** **PENDING / NOT EXECUTED**. UIUX-3E is not marked visually accepted and is not promoted into the Approved Reference Implementation registry.

### 6.4 Safety & Scope Boundaries Confirmed

- **Database / schema / migration changes:** None. Zero development/XAMPP, staging, or production databases were accessed, inspected, migrated, or modified.
- **Activation gates:** `ADMINISTRATOR_MANAGEMENT_ENABLED`, `DIRECT_ACCESS_ENFORCEMENT_ENABLED`, and `OPERATIONAL_ENFORCEMENT_ENABLED` remain `false`.
- **FACULTY-18:** Not started.

---

## 7. Bounded Correction Record — Waiting Classification & External Faculty Adviser Isolation

- **Starting HEAD for correction:** `d7b8e858370e81674bdc779b415ddc8993d49c0f`
- **Status:** **IMPLEMENTED / PENDING INDEPENDENT REVIEW** (not visually accepted; Playwright **NOT RUN**; project-owner browser QA **PENDING**)

### 7.1 Part A — Adviser Waiting-Data Classification Correction (`frontend/src/lib/panelist-dashboard.ts`)

- **Incorrect prior behavior:** `isAdviserWaitingItem()` previously checked `item.id.startsWith("wait:adviser")` (a synthetic identifier not emitted by the backend) and applied `/^\/panelist\/(?:advisees|adviser-requests|adviser-reviews)(?:\/|$)/` directly to `item.href`, which failed on backend Adviser links carrying query strings (e.g., `/panelist/advisees?tab=requests&requestId=...` and `/panelist/advisees?tab=reviews&stage=...&thesisId=...`).
- **Corrected production DTO classification & URL handling:**
  - Recognizes actual production backend Adviser waiting identifiers emitted by `backend/src/services/panelist-dashboard.rules.ts`:
    - `adviser-dean:<requestId>` -> Adviser waiting (`true`)
    - `manuscript-revision:<stage>:<thesisId>` -> Adviser waiting (`true`)
  - Explicitly recognizes Defense waiting identifiers first so stable backend identifiers take precedence over URL fragment heuristics:
    - `rap-awaiting-signatures:<id>` -> Defense waiting (`false`)
    - `chairman-prereq:<scheduleId>` -> Defense waiting (`false`)
  - When falling back to `item.href`, extracts the pathname before `?` or `#` (`item.href.split(/[?#]/, 1)[0]`) before matching `/^\/panelist\/(?:advisees|adviser-requests|adviser-reviews)(?:\/|$)/`, handling query-string Adviser URLs accurately while preventing prefix collisions (`/panelist/advisees-archive`) and query-fragment false positives.
  - Preserves legitimate Adviser waiting items for Internal Adviser accounts and prevents Adviser waiting items from surfacing to External Faculty (`myAdvisees.relevant === false`), without altering backend workflow states or historical records.

### 7.2 Part B — External Faculty Adviser Data Isolation

- **Shared `Panelist.isExternal` lookup:** Added `PanelistRepository.isExternalFaculty(userId)` (`backend/src/repositories/panelist.repository.ts`), querying `prisma.panelist.findUnique({ where: { userId }, select: { isExternal: true } })` with zero silent error swallowing.
- **Direct Adviser inbox (`GET /thesis/adviser/requests/mine`):** `AdviserRequestService.listMyAdviserRequests(adviserUserId)` now checks `await this.panelists.isExternalFaculty(adviserUserId)` before querying `adviserRequest.findMany`, throwing `AppError("External Faculty cannot serve as Thesis Adviser.", 403)` for External Faculty. Scope remains strictly bound to authenticated `req.user.userId` (`countMyAdviserRequests` for `/auth/me` remains unchanged to preserve FACULTY-13).
- **Adviser workspace (`GET /thesis/adviser/workspace`):** Closed the zero-assignment bypass in `AdviserWorkspaceService.getWorkspace(adviserUserId)`: after `assertSingleActiveAdviserForCandidates` (which continues failing closed with 409 on any anomalous active `AdviserAssignment`), `getWorkspace` checks `await this.repository.isExternalFaculty?.(adviserUserId)` and throws `AppError("External Faculty cannot serve as Thesis Adviser.", 403)` before calling `listMyAdviserRequests`, `proposalReviews.listReviewTasks`, or `finalReviews.listReviewTasks`. Internal Faculty workspace access is preserved.
- **Aggregate Faculty Dashboard (`GET /thesis/defense/panelist/dashboard`):** Added `PanelistDashboardRepository.isExternalFaculty(userId)` (backed by `PanelistRepository.isExternalFaculty`) and updated `PanelistDashboardService.getDashboard(userId, now)`:
  - Evaluates `isExternal` alongside Defense repository reads (`getAssignments`, `getPendingRapSlots`, `getSignedRapSlots`).
  - When `isExternal === true`, preserves all Defense assignments, Defense tasks, active/upcoming sessions, Defense KPIs, and Defense waiting records while skipping `adviserRequests.listMyAdviserRequests`, `proposalReviews.listReviewTasks`, and `finalReviews.listReviewTasks` and passing empty arrays for the Adviser portion (no 403 on Defense dashboard).
  - When `isExternal === false`, loads and returns Internal Faculty Adviser tasks and waiting items alongside Defense data.
  - Database/service errors propagate rather than silently degrading into empty data.
- **Existing review queue guards verified:** Inspected `ProposalAdviserReviewService.listReviewTasks()` and `FinalAdviserReviewService.listReviewTasks()`; both already enforce `isExternalActiveAdviser(assignment)` and `isActiveAdviserForStudent()` (`user?.panelist?.isExternal !== true`), returning `[]` for External Faculty, and are additionally skipped by `PanelistDashboardService` for External accounts.

### 7.3 Bounded Correction Verification Results

- **Focused frontend regression check (`node scripts/verify-faculty-14-portal.mjs` in `frontend`):** **45 / 45 PASS** (covers exact `adviser-dean:` and `manuscript-revision:` DTO IDs, query-string URL fallback + fragment collision defense, Defense waiting classification for `rap-awaiting-signatures:` and `chairman-prereq:`, Internal Adviser retention without inflating `Pending Tasks`, and External Faculty exclusion of Adviser waiting items).
- **Focused backend unit, repository, service, and route/controller suites (`npx vitest run ...` in `backend`):** **9 files / 141 tests PASS**:
  - `tests/unit/services/adviser-request.service.test.ts` (29/29 PASS)
  - `tests/unit/services/adviser-workspace.service.test.ts` (25/25 PASS)
  - `tests/unit/services/panelist-dashboard.service.test.ts` (6/6 PASS)
  - `tests/unit/services/panelist-dashboard.rules.test.ts` (21/21 PASS)
  - `tests/unit/repositories/panelist-dashboard.repository.test.ts` (7/7 PASS)
  - `tests/unit/repositories/adviser-workspace.repository.test.ts` (5/5 PASS)
  - `tests/unit/services/proposal-adviser-review.service.test.ts` (26/26 PASS)
  - `tests/unit/services/final-adviser-review.service.test.ts` (17/17 PASS)
  - `tests/unit/routes/faculty-external-adviser-isolation.routes.test.ts` (5/5 PASS)
- **Backend TypeScript (`npx tsc --noEmit` in `backend`):** **PASS** (0 errors)
- **Frontend TypeScript (`node node_modules/typescript/bin/tsc --noEmit` in `frontend`):** **PASS** (0 errors)
- **Scoped ESLint (`npx eslint "src/lib/panelist-dashboard.ts" "src/lib/faculty-access.ts" "src/app/(portal)/panelist/layout.tsx" "src/app/(portal)/panelist/dashboard/page.tsx" "scripts/verify-faculty-14-portal.mjs"` in `frontend`):** **PASS** (0 errors, 0 warnings; backend has no ESLint configuration)
- **Frontend Production Build (`npm run build` in `frontend`):** **PASS** (compiled in 6.7s, TypeScript 2.9s, 69/69 routes generated)
- **`git diff --check`:** **PASS**
- **Playwright synthetic browser verification:** **NOT RUN** (not executed for this bounded correction; left to project-owner local browser QA).
- **Project-owner browser/visual QA and independent review:** **PENDING**.
- **Safety boundaries confirmed:** Zero database access, zero migrations, all activation gates (`ADMINISTRATOR_MANAGEMENT_ENABLED`, `DIRECT_ACCESS_ENFORCEMENT_ENABLED`, `OPERATIONAL_ENFORCEMENT_ENABLED`) remain `false`, and FACULTY-18 was not started.

---

## 8. Final Bounded Correction — External Faculty Adviser Isolation Across `/auth/me`, GS-020, and GS-017

- **Starting HEAD for final correction:** `4e866d37649d1abf8964aa2205cbef2d997c8b20`
- **Status:** **IMPLEMENTED / PENDING INDEPENDENT REVIEW** (not visually accepted; Playwright **NOT RUN**; project-owner browser QA **PENDING**)

### 8.1 Correction A — `/auth/me` Effective Access (`backend/src/services/effective-access.service.ts`)

- Updated `EffectiveAccessService.currentAccount(account)` to resolve authoritative current `Panelist.isExternal` directly via `this.defenses.isExternalFaculty(account.id)` (`PanelistDashboardRepository.isExternalFaculty` -> `PanelistRepository.isExternalFaculty`) in parallel with `countSoleActiveAdvisees` and `countReadableAssignments`.
- **External Faculty without anomalous active `AdviserAssignment`:** Returns `myAdvisees: { relevant: false, activeAdviseeCount: 0, addressedRequestCount: 0, issuedCertificationCount: 0 }` and does **not** query `requests.countMyAdviserRequests` or `certifications.countOwnIssuedSources`. Preserves exact `myDefenses` assignment counts/relevance and `essayEvaluations` capability relevance.
- **External Faculty with anomalous active `AdviserAssignment`:** Preserves DR-5 fail-closed conflict (`AppError("External Faculty cannot serve as Thesis Adviser.", 409)`) without exposing Adviser counts or workspace data.
- **Internal Faculty:** Preserves all existing FACULTY-13 behavior (active advisees, historical addressed requests, issued GS-017 certifications, unavailable-for-new-assignments retention, Defense assignments, Essay Evaluator capability).

### 8.2 Correction B — GS-020 Official Adviser Request Records (`backend/src/services/adviser-request-record.service.ts`)

- Protected `GET /adviser/requests/records` (`list()`) and `GET /adviser/requests/:id/pdf` (`generatePdf()` via `source()`) by enforcing `isAcademicAccountRole(actor.role) && await this.panelists.isExternalFaculty(actor.userId)` inside `currentActor(actor)` BEFORE querying `prisma.adviserRequestOfficialRecord`.
- **External Faculty:** Denied with `AppError("External Faculty cannot serve as Thesis Adviser.", 403)` before touching official records or rendering PDFs.
- **Internal Faculty / Students / Authorized Admins:** Preserved existing access to finalized GS-020 records and PDFs; zero historical signed records/hashes rewritten or modified.

### 8.3 Correction C — GS-017 Adviser Certification Records (`backend/src/services/adviser-certification-record.service.ts`)

- Protected both `listSources()` (`GET /adviser-certifications`) and `getSource()` (`GET /adviser-certifications/:certificationId/pdf`) via a shared `currentActor(actor)` guard enforcing `isAcademicAccountRole(actor.role) && await this.panelists.isExternalFaculty(actor.userId)` BEFORE querying `prisma.adviserCertification`.
- **External Faculty:** Denied with `AppError("External Faculty cannot serve as Thesis Adviser.", 403)` across metadata listing, source retrieval, and PDF generation before reading certification rows or invoking the renderer.
- **Internal Faculty / Students / Authorized Admins:** Preserved existing access, ownership, Student reads, and Admin capability rules without modifying historical signatures or document bindings.

### 8.4 Final Bounded Correction Verification Results

- **Focused backend suites (`npx vitest run ...` in `backend`):** **11 files / 335 tests PASS**:
  - `tests/unit/routes/faculty-13-effective-access.routes.test.ts` (73/73 PASS)
  - `tests/unit/services/adviser-request-record.service.test.ts` (33/33 PASS)
  - `tests/unit/services/adviser-certification-document.service.test.ts` (50/50 PASS)
  - `tests/unit/services/faculty-8-official-records.test.ts` (64/64 PASS)
  - `tests/unit/routes/faculty-external-adviser-isolation.routes.test.ts` (6/6 PASS)
  - `tests/unit/routes/faculty-8-private-records.routes.test.ts` (21/21 PASS)
  - `tests/unit/services/adviser-request.service.test.ts` (29/29 PASS)
  - `tests/unit/services/adviser-workspace.service.test.ts` (25/25 PASS)
  - `tests/unit/services/panelist-dashboard.service.test.ts` (6/6 PASS)
  - `tests/unit/services/panelist-dashboard.rules.test.ts` (21/21 PASS)
  - `tests/unit/repositories/panelist-dashboard.repository.test.ts` (7/7 PASS)
- **Untouched controller unit tests note:** Running `tests/unit/controllers/adviser-certification-document.controller.test.ts` (10/13 pass, 3 fail) and `tests/unit/controllers/adviser-request-record.controller.test.ts` (9/12 pass, 3 fail) failed only on their pre-existing mock fallback (`current.role = "CUSTOM"`, retired in FACULTY-17, returning 503 vs 403 for `CHAIRMAN`/`RAPPORTEUR`/`FACILITATOR`). Those two files were not modified and use mocked `ThesisService` classes rather than the changed services.
- **Backend TypeScript (`npx tsc --noEmit` in `backend`):** **PASS** (0 errors)
- **Backend ESLint:** Not configured in `backend` (not run).
- **Frontend build / TypeScript / regression suites:** Not re-run (zero frontend code changed in this correction).
- **`git diff --check`:** **PASS**
- **Playwright synthetic browser verification:** **NOT RUN** (left to project-owner local browser QA).
- **Project-owner browser/visual QA and independent review:** **PENDING**.
- **Safety boundaries confirmed:** Zero database access or migrations, all activation gates (`ADMINISTRATOR_MANAGEMENT_ENABLED`, `DIRECT_ACCESS_ENFORCEMENT_ENABLED`, `OPERATIONAL_ENFORCEMENT_ENABLED`) remain `false`, FACULTY-4/FACULTY-12 readiness gates remain open, and FACULTY-18 was not started.

---

## 9. Final Bounded Correction — Fail-Closed Active Internal Panelist Profile Validation

- **Starting HEAD for final bounded correction:** `369cb328160f68c8d1d5fb82b0ad6b82ba6bc854`
- **Status:** **IMPLEMENTED / PENDING INDEPENDENT REVIEW** (not visually accepted; Playwright **NOT RUN**; project-owner browser QA **PENDING**)

### 9.1 Shared Active Internal Panelist Validation (`backend/src/repositories/panelist.repository.ts`)

- Added `PanelistRepository.assertActiveInternalFaculty(userId)`, querying `prisma.panelist.findUnique({ where: { userId }, select: { isActive: true, isExternal: true } })` and establishing all three conditions:
  1. The `Panelist` profile exists (`panelist !== null`).
  2. `Panelist.isActive === true`.
  3. `Panelist.isExternal === false`.
- Missing, inactive, or External Panelist profiles fail closed with `AppError("External Faculty cannot serve as Thesis Adviser.", 403)`; database errors propagate cleanly without being masked as missing/denied.
- Existing `PanelistRepository.isExternalFaculty(userId)` semantics (`panelist?.isExternal === true`) were intentionally preserved untouched so unrelated Defense and effective-access callers do not change behavior.

### 9.2 Protected GS-020 and GS-017 Boundaries

- **GS-020 (`backend/src/services/adviser-request-record.service.ts`):** `AdviserRequestRecordService.currentActor(actor)` now calls `await this.panelists.assertActiveInternalFaculty(actor.userId)` whenever `isAcademicAccountRole(actor.role)` is true, protecting `list()` (`GET /adviser/requests/records`) and `generatePdf()` (`GET /adviser/requests/:id/pdf` via `source()`) before querying `prisma.adviserRequestOfficialRecord`.
- **GS-017 (`backend/src/services/adviser-certification-record.service.ts`):** `AdviserCertificationRecordService.currentActor(actor)` now calls `await this.panelists.assertActiveInternalFaculty(actor.userId)` whenever `isAcademicAccountRole(actor.role)` is true, protecting `listSources()` (`GET /adviser-certifications`), `getSource()`, and downstream PDF generation (`GET /adviser-certifications/:certificationId/pdf`) before querying `prisma.adviserCertification`.
- **Preserved access:** Active Internal Faculty (`isActive: true, isExternal: false`), Students (`STUDENT`), authorized Admins (`ADMIN`), and External Faculty Defense access are all preserved without modifying historical signed records, hashes, or workflows. Note: in full HTTP route stacks with active upstream middleware checks, missing/inactive `User.panelist` profiles already fail closed with 403 (`"Current account access is unavailable."`) before reaching the controller, while direct `PanelistRepository.assertActiveInternalFaculty` lookups fail closed at the service boundary with 403 (`"External Faculty cannot serve as Thesis Adviser."`) before GS-020/GS-017 DB queries.

### 9.3 Active Internal Panelist Validation Verification Results

- **Focused backend suites (`npx vitest run ...` in `backend`):** **5 files / 168 tests PASS**:
  - `tests/unit/repositories/panelist.repository.test.ts` (8/8 PASS)
  - `tests/unit/services/adviser-request-record.service.test.ts` (35/35 PASS)
  - `tests/unit/services/adviser-certification-document.service.test.ts` (52/52 PASS)
  - `tests/unit/services/faculty-8-official-records.test.ts` (66/66 PASS)
  - `tests/unit/routes/faculty-external-adviser-isolation.routes.test.ts` (7/7 PASS)
- **Backend TypeScript (`npx tsc --noEmit` in `backend`):** **PASS** (0 errors)
- **`git diff --check`:** **PASS**
- **Frontend build / TypeScript / verifiers:** Not re-run (zero frontend code changed in this correction).
- **Playwright synthetic browser verification:** **NOT RUN** (left to project-owner local browser QA).
- **Project-owner browser/visual QA and independent review:** **PENDING**.
- **Safety boundaries confirmed:** Zero database access or migrations, all exported activation flags in `backend/src/access/*.ts` (`ADMINISTRATOR_MANAGEMENT_ENABLED`, `DIRECT_ACCESS_ENFORCEMENT_ENABLED`, `OPERATIONAL_ENFORCEMENT_ENABLED`, `PRIVATE_RECORD_ENFORCEMENT_ENABLED`, `FACULTY_CONFIGURATION_ENABLED`, `FACULTY_ESSAY_EVALUATION_ENABLED`, `DEFENSE_ADVISER_CAPABILITY_ENFORCEMENT_ENABLED`, `ADMISSION_STUDENT_CAPABILITY_ENFORCEMENT_ENABLED`, `EXAM_ADMINISTRATION_CAPABILITY_ENFORCEMENT_ENABLED`) remain `false`, and FACULTY-18 was not started.
