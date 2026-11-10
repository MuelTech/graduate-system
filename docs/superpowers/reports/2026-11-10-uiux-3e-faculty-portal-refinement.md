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

---

## 6. Verification & Evidence Record

### 6.1 Automated Verifier & Unit Suites (Executed — PASS)

- `node scripts/verify-faculty-14-portal.mjs` (in `frontend`): **44 / 44 PASS** (includes new UIUX-3E Part A `isFacultyNavAreaVisible` and layout snapshot-filtering checks, plus UIUX-3E Part B `projectFacultyDashboard` across all 8 responsibility combinations, task/waiting separation, and date/time formatting).
- `node scripts/verify-adv6-adviser-actions.mjs` (in `frontend`): **10 / 10 PASS**
- `node scripts/verify-adv7-fix1-my-advisees-ux.mjs` (in `frontend`): **10 / 10 PASS**
- `node scripts/verify-cdw4-workspace.mjs` (in `frontend`): **9 / 9 PASS**
- `node scripts/verify-cdw2-contracts.mjs` (in `frontend`): **11 / 11 PASS**
- `node scripts/verify-faculty-2-session.mjs` (in `frontend`): **19 / 19 PASS**
- `node scripts/verify-faculty-3-compatibility.mjs` (in `frontend`): **8 / 8 PASS**
- `npx vitest run tests/unit/services/panelist-dashboard.rules.test.ts` (in `backend`): **21 / 21 PASS**
- Note: Historical `verify-adv7-navigation-consolidation.mjs` (6/8 pass, 2 fail) fails at baseline because its single-line regex pre-dates FACULTY-14's multi-line `area` properties in `layout.tsx`.

### 6.2 TypeScript, Scoped ESLint, Production Build, and Diff Check (Executed — PASS)

- Frontend TypeScript (`node node_modules/typescript/bin/tsc --noEmit`): **PASS** (0 errors)
- Scoped ESLint (`npx eslint "src/lib/faculty-access.ts" "src/lib/panelist-dashboard.ts" "src/app/(portal)/panelist/layout.tsx" "src/app/(portal)/panelist/dashboard/page.tsx" "scripts/verify-faculty-14-portal.mjs" "scripts/faculty-14-fixture-server.mjs" "e2e/faculty-portal.spec.ts"`): **PASS** (0 errors, 0 warnings)
- Frontend Production Build (`npm run build` in `frontend`): **PASS** (compiled in 10.2s, TypeScript 7.4s, 69/69 static and dynamic routes generated)
- `git diff --check`: **PASS**

### 6.3 Synthetic Playwright Browser Verification & Manual/Visual QA Status

- **Synthetic Playwright browser run (`e2e/faculty-portal.spec.ts`):** **INCOMPLETE / NOT CLAIMED AS BROWSER QA PASS.** An initial run against the synthetic fixture server passed 39 of 40 tests (including all 36 FACULTY-14 regression tests and all 3 new UIUX-3E Part B richer-dashboard tests), while 1 new Part A test timed out waiting to observe the transient `"Loading Faculty access"` state under a fixed 500ms `accessDelay`. The test was updated to use deterministic `page.route` holding on `**/api/auth/me`, and execution was stopped per project-owner instruction without re-running the browser suite. Browser QA is therefore **not claimed as PASS**.
- **Hosted CI:** **NOT OBSERVED**.
- **Project-owner manual/visual QA and acceptance:** **PENDING / NOT EXECUTED**. UIUX-3E is not marked visually accepted and is not promoted into the Approved Reference Implementation registry.

### 6.4 Safety & Scope Boundaries Confirmed

- **Database / schema / migration changes:** None. Zero development/XAMPP, staging, or production databases were accessed, inspected, migrated, or modified.
- **Activation gates:** `ADMINISTRATOR_MANAGEMENT_ENABLED`, `DIRECT_ACCESS_ENFORCEMENT_ENABLED`, and `OPERATIONAL_ENFORCEMENT_ENABLED` remain `false`.
- **FACULTY-18:** Not started.
