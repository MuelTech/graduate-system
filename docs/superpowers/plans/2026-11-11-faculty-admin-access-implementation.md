# Faculty and Administrator Access — Implementation Plan

**Date:** 2026-11-11  
**Branch:** `feat/faculty-admin-role-access`  
**Canonical authority:** `docs/superpowers/FACULTY_ADMIN_ACCESS_SOURCE_OF_TRUTH.md`  
**Design specification:** `docs/superpowers/specs/2026-11-08-faculty-admin-access-design.md`

---

## 1. Architectural Approach: Surgical Zero-Breakage Migration

### 1.1 Why the previous approach failed
The previous attempt split the feature into 18 micro-packages with temporary compatibility layers, stripped existing EARIST visual styling (KPI cards, colored badges, action icons) in favor of bare unstyled tables, and used aggressive `staleTime: 0` + `refetchOnWindowFocus: "always"` + route-change re-fetching that set access state to `null` while loading—causing severe tab/sidebar flickering and layout shifting.

### 1.2 New Clean Strategy
1. **Surgical Role Separation (Zero Breakage for Defense & Adviser Workflows):**
   - Add `FACULTY` to `enum UserRole` in `schema.prisma` (keeping `PANELIST` in the enum only so existing unit-test fixtures continue to compile/pass, while all created and seeded Faculty accounts use `UserRole.FACULTY`).
   - Preserve the Prisma `model Panelist` (`user.panelist`) and `enum PanelRole` (`PANELIST`, `CHAIRMAN`, `RAPPORTEUR`, `FACILITATOR`, `ADVISER`) so all 45+ Defense, Collaborative Workspace, RAP Signature, and Adviser files remain 100% functional without risky rewrites.
   - Add `canEvaluateEssays Boolean @default(false) @map("can_evaluate_essays")` to `model Panelist`.
   - Add `adminAccessLevel AdminAccessLevel? @default(FULL) @map("admin_access_level")` (`enum AdminAccessLevel { FULL RESTRICTED }`) and `adminCapabilities Json? @map("admin_capabilities")` to `model User`.
2. **Zero-Flicker Frontend Access & Navigation:**
   - Include Faculty (`isExternal`, `isAvailableAsAdviser`, `canEvaluateEssays`) and Admin (`adminAccessLevel`, `adminCapabilities`) access metadata directly in the `/api/auth/login` and `/api/auth/me` payloads and NextAuth JWT/session, and keep previous data during background TanStack Query refetches (`placeholderData: keepPreviousData`, `staleTime: 60_000`)—never hiding the page or unmounting the sidebar on route/tab changes.
   - **Faculty Sidebar Visibility:**
     - Always visible: `Dashboard`, `Profile`, `My Defenses`, `E-Signatures`, `Repository`, `Announcements`.
     - Conditional: `Essay Evaluations` (visible when `canEvaluateEssays === true`), `My Advisees` (visible when `!isExternal`; hidden for External Faculty).
     - Header-only: `Notifications` is removed from both Faculty and Admin sidebars and accessed via the top-right `NotificationBell` ("View All Notifications").
3. **Cohesive EARIST UI/UX:**
   - Preserve and enhance the clean EARIST visual language across `Faculty Management`, `Administrators Management`, `Faculty Dashboard`, and `Essay Evaluations` (KPI summary cards, semantic colored badges, icon action buttons, and the amber Default Password info banner stating that default passwords are the user's **LAST NAME in ALL CAPS** with `mustChangePassword: true` on first login).
4. **Verification Policy (No Playwright):**
   - Verify via TypeScript (`tsc --noEmit`), backend unit tests, and frontend production build (`next build`).
   - Do **not** run automated Playwright browser tests; UI/UX testing is performed directly by the project owner in the browser.

---

## 2. Capability Catalog for Restricted Administrators

Grouped into **4 Module Cards** matching the Admin Sidebar:

| Module Group | Capability Key | Label | Covered Admin Routes |
| :--- | :--- | :--- | :--- |
| **User Management** | `applicants.manage` | Applicants | `/admin/users/applicants` |
| | `students.manage` | Students | `/admin/users/students` |
| | `faculty.manage` | Faculty | `/admin/users/panelists`, `/admin/users/faculty` |
| *(Full Admin Only)* | *(Full Admin Exclusive)* | Administrators | `/admin/users/administrators` |
| **Exam Management** | `exam.schedules.manage` | Exam Schedules | `/admin/exam/slots` |
| | `exam.records.manage` | Exam Records | `/admin/exam/applications`, `/admin/exam/scores` |
| | `exam.questions.manage` | Exam Questions | `/admin/exam/questions` |
| | `cor.verify` | COR Verification | `/admin/exam/cor` |
| | `waivers.manage` | Waiver Validation | `/admin/exam/waiver` |
| **Thesis Management** | `defense.applications.manage` | Defense Applications | `/admin/thesis/applications` |
| | `defense.schedules.manage` | Scheduling & Panels | `/admin/thesis/scheduling` |
| | `defense.records.view` | Defense Records | `/admin/thesis/defense-records`, `/admin/thesis/rap-reports` |
| | `adviser.requests.manage` | Adviser Request Review | `/admin/thesis/advisers` |
| **Institutional & System** | `analytics.view` | Analytics & Reports | `/admin/analytics` |
| | `memos.manage` | Announcements & Memos | `/admin/memos` |
| | `repository.manage` | Repository & Databank | `/admin/repository` |
| | `settings.manage` | System Settings & Storage Health | `/admin/settings`, `/admin/settings/storage` |

---

## 3. Four-Phase Continuous Execution Plan

### Phase 1 — Schema, Migration, & Synthetic Seed Data
1. Update `backend/prisma/schema.prisma`:
   - Add `FACULTY` to `enum UserRole`.
   - Add `enum AdminAccessLevel { FULL RESTRICTED }`.
   - Add `adminAccessLevel` and `adminCapabilities` to `model User`.
   - Add `canEvaluateEssays Boolean @default(false) @map("can_evaluate_essays")` to `model Panelist`.
2. Generate and apply Prisma migration & regenerate Prisma Client.
3. Update `backend/prisma/seed.ts` to seed:
   - Full Administrator (`admin@earist.edu.ph`) and Restricted Administrator (`staff.admin@earist.edu.ph`);
   - Internal Faculty with Essay Evaluation / Program Chair access (`UserRole.FACULTY`, `canEvaluateEssays: true`, `isAvailableAsAdviser: true`);
   - Internal Faculty advisers/panelists (`UserRole.FACULTY`, `isExternal: false`);
   - External Faculty panelists (`UserRole.FACULTY`, `isExternal: true`, `isAvailableAsAdviser: false`).

### Phase 2 — Backend Auth, Permission Guards, Essay Evaluation, & Admin Management APIs
1. Update `backend/src/middlewares/auth.middleware.ts`:
   - Normalize `FACULTY` and `PANELIST` in `requireRole(...)` so all existing routes accepting `PANELIST` seamlessly accept `FACULTY`.
   - Add `requireAdminCapability(capabilityKey)` and `requireFullAdmin` middleware helpers that verify active Admin status and granted capabilities from the database.
   - Add `requireEssayEvaluator` middleware that allows active `FACULTY` accounts with `canEvaluateEssays: true` (as well as authorized Admins where applicable).
2. Update the 7 backend domain checks (`thesis.repository.ts`, `adviser-certification-record.service.ts`, `adviser-request-record.service.ts`, `adviser-request.rules.ts`, `defense-conclusion.service.ts`, `document.service.ts`, `memo.service.ts`) so `UserRole.FACULTY` is treated identically to `UserRole.PANELIST`.
3. Update `auth.service.ts` and `auth.controller.ts`:
   - Accept `role === "faculty"` (and `"panelist"`) at login, validating that the user has a Faculty (`FACULTY`/`PANELIST`) account.
   - Expose `GET /api/auth/me` returning current `isActive`, `role`, `adminAccessLevel`, `adminCapabilities`, and `facultyProfile` (`isExternal`, `isAvailableAsAdviser`, `canEvaluateEssays`, `qualification`, `affiliation`, `specialization`).
4. Update `admin-panelist.repository.ts` / `admin-panelist.service.ts` and mount `/api/admin/faculty` alias alongside `/api/admin/panelists`:
   - Create new Faculty accounts with `role: UserRole.FACULTY`, `canEvaluateEssays`, `isExternal`, `isAvailableAsAdviser` (forced `false` when `isExternal`), and default password = `lastName.toUpperCase()` with `mustChangePassword: true`.
   - Include read-only summary counts of active advisees and defense assignments on Faculty records.
5. Remove self-service adviser availability mutation from Faculty self-service (`PATCH /api/panelists/me/availability` blocked for Faculty; Admin-controlled only) and mount `/api/faculty` alias alongside `/api/panelists`.
6. Create Administrator Management backend (`admin-administrator.routes.ts`, controller, service, repository) mounted at `/api/admin/administrators`:
   - List, view, create, and update Administrator accounts (`firstName`, `lastName`, `title`, `suffix`, `email`, `isActive`, `adminAccessLevel`, `adminCapabilities`, optional password reset).
   - Default password = `lastName.toUpperCase()` with `mustChangePassword: true`.
   - Enforce Last Active Full Administrator protection (cannot deactivate or demote the last active Full Administrator) and prevent self-deactivation/self-demotion.
7. Add Faculty Essay Evaluation backend endpoints (`/api/exam/faculty/essay-evaluations` and `/api/exam/faculty/essay-evaluations/:id` + `POST /api/exam/scores/:id/grade` accessible to `FACULTY` with `canEvaluateEssays: true`).

### Phase 3 — Frontend Auth, Zero-Flicker Faculty Portal, & Essay Evaluations UI
1. Update `frontend/src/auth.ts`, `frontend/src/middleware.ts`, and `frontend/src/app/(auth)/login/page.tsx`:
   - Login role selector: `Applicant`, `Student`, `Faculty`, `Administrator`.
   - Support both `/faculty/...` and `/panelist/...` routes for `faculty` role without redirect loops, and force `/change-password` when `mustChangePassword` is true for both Faculty and Admin accounts.
2. Update Faculty Portal layout (`frontend/src/app/(portal)/panelist/layout.tsx` and `/faculty/...` route alias):
   - Branding: `EARIST — Faculty Portal`.
   - Stable zero-flicker sidebar:
     - Always visible: `Dashboard`, `Profile`, `My Defenses`, `E-Signatures`, `Repository`, `Announcements`.
     - `Essay Evaluations` visible when `canEvaluateEssays` is true.
     - `My Advisees` visible when `!isExternal` (hidden for External Faculty).
     - `Notifications` removed from sidebar; accessible via top-right `NotificationBell` ("View All Notifications").
3. Update Faculty Profile (`panelist/profile/page.tsx`):
   - Clean read-only profile & academic status card showing Name, Email, Qualification, Affiliation, Specialization, Classification (`Internal` / `External`), `Essay Evaluation` status, and Admin-managed `Available as Adviser` status.
4. Build Faculty `Essay Evaluations` pages (`panelist/essay-evaluations/page.tsx` and `panelist/essay-evaluations/[applicationId]/page.tsx`) and enhance `Faculty Dashboard` (`panelist/dashboard/page.tsx`) with Essay Evaluation KPI/task integration when `canEvaluateEssays` is enabled.

### Phase 4 — Frontend Admin Portal (`Faculty Management`, `Administrators Management`, & Dynamic Sidebar)
1. Update Admin Layout (`frontend/src/app/(portal)/admin/layout.tsx`):
   - Under `User Management`: `Applicants`, `Students`, `Faculty`, `Administrators` (retiring `Custom Roles` from the sidebar).
   - Remove `Notifications` from the sidebar (kept accessible via top-right `NotificationBell`).
   - Filter sidebar items cleanly for Restricted Administrators based on their granted capabilities without skeleton flickering.
2. Update `Faculty Management` (`frontend/src/app/(portal)/admin/users/panelists/page.tsx` + `/admin/users/faculty` alias):
   - Clean EARIST KPI Summary Cards (`Active`, `Internal`, `External`, `Essay Evaluators`, `Available as Adviser`).
   - Search & Filter bar (All, Internal, External, Essay Evaluators, Available as Adviser, Active, Inactive).
   - Table with semantic colored badges (`Internal` blue, `External` purple, `Essay Evaluation` emerald/gray, `Available as Adviser` green/gray, `Active` green/gray) and `View`, `Edit`, `Activate/Deactivate` icon buttons.
   - Create / Edit / View Modals with the amber Default Password info banner (`LAST NAME in ALL CAPS`), `Essay Evaluation Access` toggle switch, `Available as Adviser` toggle switch (auto-disabled for External), and read-only Assignment Summary in View Modal.
3. Create `Administrators Management` (`frontend/src/app/(portal)/admin/users/administrators/page.tsx`):
   - Clean EARIST KPI Summary Cards (`Total Administrators`, `Active`, `Full Administrators`, `Restricted Administrators`).
   - Search & Filter bar (All, Full Administrator, Restricted Administrator, Active, Inactive).
   - Table with semantic colored badges and `View`, `Edit`, `Activate/Deactivate` icon buttons (protecting the last active Full Admin).
   - Create / Edit / View Modals with the amber Default Password info banner (`LAST NAME in ALL CAPS`), Access Level selector (`Full Administrator` vs `Restricted Administrator`), and the **4-Card Module Permission Editor** with "Select All in Group" toggles.
