# EARIST Graduate School Portal — Master UI/UX Design System, Copy Standardization & Reusable Component Implementation Guide

> **Target Branch:** `feat/ui-design-system-overhaul`
> **Design Inspiration:** [`MuelTech/earist-graduation`](https://github.com/MuelTech/earist-graduation) + **Shadcn UI (`base-nova`)**
> **Purpose of this Document:** Self-contained blueprint for a new agent session to execute the full UI/UX overhaul across all 4 portals (**Admin, Faculty, Student, Applicant**) and **Auth** pages without losing context.
>
> **⚠️ OUT OF SCOPE (DO NOT MODIFY):**
> - **Landing Page (`frontend/src/app/page.tsx` and any landing-page-only components):** The user is actively developing the landing page in a separate branch. **Do NOT edit `frontend/src/app/page.tsx`** so there are zero merge conflicts when merging branches.

## 0. Core Design Philosophy: Modern EARIST Identity (60-30-10 Rule — Not a Blind Clone)

1. **Preserve 100% of Existing Functionality & Unique Features:**
   - All existing features, data flows, and layouts unique to `graduate-system` (such as the Admin Dashboard's *"Needs Your Attention"*, *"Enrollment Snapshot"*, *"Students by Thesis Stage"*, *"Workflow Monitoring"*, Faculty *Defense Workspace*, and Student *Thesis Journey*) remain 100% functional and intact.
   - We are **not** cloning `earist-graduation`'s screens; we are applying its **visual hierarchy, modern typography, and color balance** to our own Shadcn-based Graduate School system.
2. **Keep the EARIST Brand Colors Vibrant (Why the Old UI Looked "Matamlay"):**
   - Previously, the app forced *every* heading (`h1`–`h4`), form label, table header, and number into maroon (`#8B1A1A`) or dusty rose (`#A83240`). When everything is maroon, nothing stands out and the page looks flat/washed-out.
   - **New 60-30-10 Balance:**
     - **60% Clean Neutral Surfaces:** Warm cream canvas (`#FFF8F0`) + crisp white cards (`#FFFFFF`) with subtle `border-gray-100` borders and `shadow-sm`.
     - **30% High-Contrast Typography:** Crisp charcoal (`#333333`) for headings, KPI numbers, and primary text; `text-gray-500` (`#6B7280`) for descriptions and table headers.
     - **10% Vibrant EARIST Crimson & Gold Accents:** Deep EARIST Crimson (`#b71c1c`) for the Sidebar, vibrant EARIST Red (`#e02b20`) for primary buttons/active badges/progress bars, EARIST Gold (`#f9a825`) for brand highlights, plus semantic soft-tinted icon boxes (`red-50`, `amber-50`, `emerald-50`, `blue-50`) so KPI cards and status indicators pop visually.
3. **Typography Scale & Hierarchy (`Instrument Sans`):**
   - **Page Title (`h1`):** `text-2xl font-bold tracking-tight text-[#333333]`
   - **KPI Stat Value:** `text-3xl font-bold tracking-tight text-[#333333]`
   - **Card / Section Title (`h2`, `h3`):** `text-base font-bold text-[#333333]`
   - **Body / Table Cell:** `text-sm font-normal text-[#333333]`
   - **Form Label:** `text-sm font-medium text-gray-700`
   - **Subtitle / Helper / Caption:** `text-xs` or `text-sm text-gray-500`
   - **Table Column Header (`th`):** `text-xs font-semibold uppercase tracking-wider text-gray-500`

---

## 1. Visual & UX Audit Summary (What Must Be Fixed)

### 1.1 Redundant Top Header Titles & Missing Breadcrumbs
- **Current Problem:**
  - In [panelist/layout.tsx](file:///d:/Backup/BSIT-3B/CAPSTONE/Project/graduate-system/frontend/src/app/(portal)/panelist/layout.tsx), [student/layout.tsx](file:///d:/Backup/BSIT-3B/CAPSTONE/Project/graduate-system/frontend/src/app/(portal)/student/layout.tsx), and [applicant/layout.tsx](file:///d:/Backup/BSIT-3B/CAPSTONE/Project/graduate-system/frontend/src/app/(portal)/applicant/layout.tsx), the Sidebar brand header already says `EARIST / Faculty Portal` (or `Student Portal` / `Applicant Portal`), and right beside it the sticky white `<header>` repeats `Faculty Portal` / `Student Portal` / `Applicant Portal` in Calibri Maroon.
  - Meanwhile, [admin/layout.tsx](file:///d:/Backup/BSIT-3B/CAPSTONE/Project/graduate-system/frontend/src/app/(portal)/admin/layout.tsx) leaves the left side of the sticky white `<header>` completely blank (`<div />`).
- **Solution:**
  - Remove the repeated portal title from the sticky top `<header>` in all 4 layouts.
  - Place a **Desktop/Mobile Sidebar Toggle Button (`PanelLeft` / `Menu`)** + **Dynamic Shadcn `<PortalBreadcrumbs />`** on the left side of the sticky top header across all 4 portals:
    - Example in Admin: `Dashboard > User Management > Applicants`
    - Example in Student: `Dashboard > Thesis Journey > Proposal Defense`
    - Example in Faculty: `Dashboard > My Defenses`
  - Standardize the right side of the sticky top header across all 4 portals: **User Name + Role Badge Pill + `<NotificationBell />` + `#e02b20` Avatar Circle**.

### 1.2 Sidebar Container, Submenus, Tabs & Icon System Redesign
- **Current Problem:**
  - Sidebar uses washed-out `#8B1A1A` maroon with a heavy mustard-yellow (`#D4A843`) active block, plain un-badged logo icon, and a bottom collapse chevron bar that wastes vertical space.
  - Tabs (`tabs.tsx` and inline tab bars) use inconsistent bluish-gray (`#EEF2F7`) backgrounds or custom buttons per page.
  - Icons vary in size (`h-3.5`, `h-4`, `h-5`), color (`#A83240` dusty rose vs `#8B1A1A` maroon), and container shape across pages.
- **Solution — Sidebar Container (`admin`, `panelist`, `student`, `applicant` layouts):**
  - **Sidebar Outer Container (`<aside>`):** `bg-[#b71c1c] text-white shadow-xl border-r border-black/10` (`w-64` expanded, `w-[72px]` collapsed).
  - **Brand Header (`h-16 px-4 border-b border-white/15`):**
    - Rounded icon container `flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 text-[#f9a825] shadow-inner` wrapping `<GraduationCap className="h-6 w-6" />`.
    - Brand text: `text-base font-bold tracking-wide text-white` (`EARIST`) + `text-[11px] font-medium uppercase tracking-wider text-white/75` (`Admin Portal` / `Faculty Portal` / `Student Portal` / `Applicant Portal`).
  - **Top-Level Navigation Items:**
    - **Active Item:** `bg-white/20 text-white border-l-4 border-white font-semibold rounded-r-lg px-3.5 py-2.5 shadow-2xs` with crisp `text-white` icon (`h-5 w-5`).
    - **Inactive Item:** `text-white/80 hover:bg-white/10 hover:text-white rounded-lg px-3.5 py-2.5 font-medium transition-all` with `text-white/80 group-hover:text-white` icon (`h-5 w-5`).
  - **Collapsible Submenu Container (Admin & Student):**
    - `mt-1 ml-4 pl-3 border-l border-white/20 space-y-1`
    - **Active Submenu Item:** `bg-white/20 text-white font-semibold rounded-lg px-3 py-2`
    - **Inactive Submenu Item:** `text-white/75 hover:bg-white/10 hover:text-white rounded-lg px-3 py-2`
  - **Sidebar Toggle & Sign Out Footer:**
    - Move the desktop collapse toggle into the top sticky `<header>` (`<PanelLeft className="h-5 w-5" />` button right before `<PortalBreadcrumbs />`—standard Shadcn Sidebar pattern) while keeping a clean `border-t border-white/15 p-3` Sign Out footer at the bottom of the sidebar.
- **Solution — Standardized Tabs (`frontend/src/components/ui/tabs.tsx`):**
  - **Pill Tabs (`variant="default"`):**
    - `TabsList`: `bg-gray-100/90 p-1 rounded-xl border border-gray-200/70 h-10 gap-1`
    - `TabsTrigger`: `rounded-lg px-3.5 py-1.5 text-sm font-medium text-gray-600 hover:text-[#333333] data-active:bg-white data-active:text-[#e02b20] data-active:font-semibold data-active:shadow-xs transition-all`
  - **Line Tabs (`variant="line"`):**
    - `TabsList`: `border-b border-gray-200 bg-transparent gap-6 rounded-none p-0 h-10`
    - `TabsTrigger`: `rounded-none px-1 pb-2.5 text-sm font-medium text-gray-500 hover:text-[#333333] data-active:text-[#e02b20] data-active:font-semibold after:bg-[#e02b20] after:h-0.5`
- **Solution — Unified Icon System:**
  - **KPI / StatCard Icons (`stat-card.tsx`):** `h-11 w-11 rounded-xl flex items-center justify-center shrink-0` (`h-5 w-5` icon inside) using semantic soft tints:
    - `red`: `bg-red-50 text-[#e02b20]`
    - `amber`: `bg-amber-50 text-[#f9a825]`
    - `green`: `bg-emerald-50 text-emerald-600`
    - `blue`: `bg-blue-50 text-blue-600`
    - `purple`: `bg-purple-50 text-purple-600`
  - **Card / Section Header Icons:** `h-4 w-4 text-[#e02b20] shrink-0` (replacing dusty rose `#A83240`).
  - **Table Action Icons (`table-actions.tsx`):** Uniform `h-4 w-4` Lucide icons (`Eye` = View/Preview, `Pencil` = Edit, `Calendar` = Schedule, `CheckCircle2` = Approve/Verify, `Power` = Activate/Deactivate, `Trash2` = Delete) inside soft-tinted `rounded-lg` buttons.

### 1.3 Typography & Color Tokens (Eliminating "Matamlay" / Over-Maroon Look)
- **Current Problem:**
  - [globals.css](file:///d:/Backup/BSIT-3B/CAPSTONE/Project/graduate-system/frontend/src/app/globals.css) hardcodes `Calibri` and forces `h1, h2, h3 { color: var(--earist-primary) }` (`#8B1A1A`) and `h4, label { color: var(--earist-secondary) }` (`#A83240`), making every heading and label maroon/dusty-rose. Cards also use a heavy `#D0D7E3` border.
- **Solution:**
  - Load **`Instrument Sans`** via `next/font/google` in [layout.tsx](file:///d:/Backup/BSIT-3B/CAPSTONE/Project/graduate-system/frontend/src/app/layout.tsx).
  - Remove the global `h1`–`h4` and `label` maroon overrides in [globals.css](file:///d:/Backup/BSIT-3B/CAPSTONE/Project/graduate-system/frontend/src/app/globals.css).
  - Use the `MuelTech/earist-graduation` palette:
    - **Page Canvas Background (`--background`):** `#FFF8F0` (soft warm cream)
    - **Card / Header Surface (`--card`):** `#FFFFFF` with `border-gray-100 shadow-sm rounded-xl`
    - **Primary Text & Headings (`--foreground`):** `#333333` (crisp dark charcoal)
    - **Secondary / Muted Text & Table Headers (`--muted-foreground`):** `#6B7280` (`text-gray-500`)
    - **Form Labels (`label`):** `#374151` (`text-gray-700 font-medium`)
    - **Sidebar Surface (`--earist-sidebar`):** `#b71c1c`
    - **Primary Brand Action / CTA (`--earist-primary`):** `#e02b20` (hover `#b71c1c`)
    - **Warm Gold Accent (`--earist-accent`):** `#f9a825`

### 1.4 Eliminating Cramped Containers & Dead Space
- **Current Problem:**
  - Pages like Student Thesis Journey (`mx-auto max-w-3xl`), Profile pages, and several Admin/Faculty views restrict width inside the main viewport, leaving 40%+ empty dead space on the right.
- **Solution:**
  - Use full-width responsive containers (`w-full space-y-6`) inside `<main className="flex-1 p-4 sm:p-6 lg:p-8">`.
  - When a page has a form or status card + supporting context (such as Schedule, RAP, or Guidelines), use a responsive 12-column or 2-column grid (`grid gap-6 lg:grid-cols-12` or `lg:grid-cols-3`) instead of a narrow single column.

---

## 2. Wording, Copy & Label Corrections Across the System

Below are the exact copy/wording improvements to apply so the UI reads cleanly and consistently, without breaking any unit test assertions:

| Location | Current Redundant / Inconsistent Wording | Standardized Copy / Wording Fix |
| :--- | :--- | :--- |
| **All 4 Portal Top Headers** (`admin`, `panelist`, `student`, `applicant` layouts) | Top bar repeats `"Faculty Portal"`, `"Student Portal"`, `"Applicant Portal"` (already shown in Sidebar logo), while Admin top bar is blank. | Replace with dynamic **`<PortalBreadcrumbs />`** (e.g., `Dashboard > Thesis Journey > Proposal Defense` or `Dashboard > User Management > Applicants`). |
| **Student — Adviser Request (`APPROVED_ACTIVE`)** ([adviser-request/page.tsx](file:///d:/Backup/BSIT-3B/CAPSTONE/Project/graduate-system/frontend/src/app/(portal)/student/thesis/adviser-request/page.tsx)) | Page title: `"Adviser Request"`<br>Card title: `"Adviser Request complete"`<br>Body: `"Your Adviser Request process is complete."`<br>Title card: `"RECORDED TITLE (HISTORICAL)"` in a separate un-headered box. | - Move the recorded title into the unified `<ThesisJourneyShell>` header banner (`Approved Thesis Title`).<br>- Card title: **`"Adviser Officially Assigned"`** (with `Completed` badge).<br>- Body: **`"Your official thesis adviser has been approved by the Dean. You may now proceed to Proposal Defense."`** |
| **Student — Thesis Journey Next-Step Buttons** (`title-defense`, `adviser-request`, `proposal-defense`, `strike`, `final-defense`) | Inconsistent CTA labels:<br>- `Continue to Adviser Request`<br>- `Continue to Proposal Defense`<br>- `Continue in Thesis Journey` (used on Proposal Defense even when next step is known) | Standardize all step-completion CTAs to explicitly name the next unlocked destination:<br>- **`"Continue to Adviser Request"`**<br>- **`"Continue to Proposal Defense"`**<br>- **`"Continue to STRIKE / Plagiarism"`** (or **`"Continue to Final Defense"`** when STRIKE is not required)<br>- **`"Back to Thesis Journey"`** (outline button when a step is `LOCKED` or `WAITING`). |
| **Student — Concluded Defense Schedule & Application Record** ([defense-status-panel.tsx](file:///d:/Backup/BSIT-3B/CAPSTONE/Project/graduate-system/frontend/src/components/student/defense-status-panel.tsx)) | When a defense is already `Concluded` and `PASSED`, the schedule box still prints: `"The Defense Application is not yet available for this schedule."` above the nested `Defense RAP` card. | - Render **Defense Schedule** and **Official Defense RAP** as separate, sibling `<Card>` components (not nested).<br>- In `DefenseScheduleSummary`, when `session.sessionStatus === "CONCLUDED"` and the application PDF is unavailable, hide the redundant `"not yet available"` text (while keeping `<StudentOfficialApplicationRecord>` intact when direct-rendered or available). |
| **Student — Proposal & Final Defense Subtitle** (`proposal-defense/page.tsx`, `final-defense/page.tsx`) | `"Stage-scoped uploads for Proposal Defense (Cashier payment happens outside GS-IS — upload proof only)."` (Internal developer jargon `"Stage-scoped uploads"` / `"GS-IS"`). | **`"Complete your Adviser manuscript certification and upload your current semester COR and defense-fee proof of payment."`** |
| **Student Dashboard — Current Stage Subtitle** ([student/dashboard/page.tsx](file:///d:/Backup/BSIT-3B/CAPSTONE/Project/graduate-system/frontend/src/app/(portal)/student/dashboard/page.tsx)) | `"Based on your Student Thesis Journey."` | **`"Current milestone in your Thesis Journey."`** |
| **Table Action Buttons Across Admin & Faculty Pages** | Mix of icon-only buttons, `"View"`, `"Details"`, `"Review"`, `"Edit"`, `"Manage"` with varying sizes and colors. | Standardized via `<TableActions>` with consistent `h-4 w-4` Lucide icons and clear labels/tooltips (`View`, `Review`, `Edit`, `Schedule`, `Activate` / `Deactivate`). |

> [!CAUTION]
> **Unit-Tested Strings & Attributes That MUST Be Preserved:**
> Do **NOT** rename or remove these specific strings/attributes because backend/frontend unit tests assert them:
> 1. [admin/exam/slots/page.tsx](file:///d:/Backup/BSIT-3B/CAPSTONE/Project/graduate-system/frontend/src/app/(portal)/admin/exam/slots/page.tsx): Keep `aria-label="Edit schedule"`, `aria-label="Delete schedule"`, `aria-label="View bookings"`, `Schedule Exam`, `Create Exam Slot`, `Edit Exam Schedule`.
> 2. [admin/exam/applications/page.tsx](file:///d:/Backup/BSIT-3B/CAPSTONE/Project/graduate-system/frontend/src/app/(portal)/admin/exam/applications/page.tsx): Keep `Assign Marker` / essay assignment dialog labels tested in `exam-assignment-ui.contract.test.ts`.
> 3. [official-defense-application-record.tsx](file:///d:/Backup/BSIT-3B/CAPSTONE/Project/graduate-system/frontend/src/components/student/official-defense-application-record.tsx): Keep the component's internal text (`View Application`, `Download Application`, `The Defense Application is not yet available for this schedule.`) intact inside `StudentOfficialApplicationRecord` itself.
> 4. [admin/thesis/scheduling/page.tsx](file:///d:/Backup/BSIT-3B/CAPSTONE/Project/graduate-system/frontend/src/app/(portal)/admin/thesis/scheduling/page.tsx): Keep external panelist creation labels tested by `admin-ThesisSchedulingPage-external.test.ts`.

---

## 3. Reusable Component Library Specification

### 3.1 New Reusable Components to Create

1. **`frontend/src/components/ui/breadcrumb.tsx`**
   - Standard Shadcn `Breadcrumb`, `BreadcrumbList`, `BreadcrumbItem`, `BreadcrumbLink`, `BreadcrumbPage`, `BreadcrumbSeparator` (`ChevronRight`).
2. **`frontend/src/components/layout/portal-breadcrumbs.tsx`**
   - Uses `usePathname()` to render clickable breadcrumb trails in the top header bar of all 4 portals.
3. **`frontend/src/components/ui/stat-card.tsx`**
   - Props: `{ title: string; value: ReactNode; subtitle?: string; icon: LucideIcon; tone?: "red" | "amber" | "green" | "blue" | "purple" | "gray"; className?: string }`
   - Matches `earist-graduation` KPI cards (`bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex items-start justify-between`).
4. **`frontend/src/components/ui/filter-bar.tsx`**
   - Props: `{ searchValue?: string; onSearchChange?: (v: string) => void; searchPlaceholder?: string; onReset?: () => void; children?: ReactNode; className?: string }`
   - Standardized white card (`bg-white rounded-xl border border-gray-100 shadow-sm p-4`) wrapping search input (`Search` icon) and filter selects.
5. **`frontend/src/components/ui/table-actions.tsx`**
   - `TableActionButton` & `TableActionLink` with `variant: "view" | "primary" | "edit" | "success" | "warning" | "danger"` and uniform `h-4 w-4` icon sizing.
6. **`frontend/src/components/student/thesis-journey-shell.tsx`**
   - **`ThesisJourneyShell`**: Full-width wrapper for all 5 Student Thesis Journey routes (`title-defense`, `adviser-request`, `proposal-defense`, `strike`, `final-defense`):
     - Renders `PageHeader` + compact **Approved Thesis Title** pill banner (if `journey.selectedTitle?.titleText` exists).
     - Renders the **5-Step Horizontal Stepper** showing all 5 steps (`1. Title Defense`, `2. Adviser Request`, `3. Proposal Defense`, `4. STRIKE / Plagiarism`, `5. Final Defense`) with state icons (`COMPLETED`, `CURRENT`, `WAITING`, `LOCKED`) and clickable links for unlocked steps.
   - **`JourneyStepStatusCard`**: Reusable card for `LOCKED`, `COMPLETED`, and `WAITING` step states with clean badges and standardized next-step CTAs.
   - **`DocumentUploadSlot`**: Reusable document picker card with file preview, replace, and remove buttons used across `Title Defense`, `Proposal Defense`, and `Final Defense`.

### 3.2 Existing Shadcn Components to Upgrade (`frontend/src/components/ui/`)
- **[card.tsx](file:///d:/Backup/BSIT-3B/CAPSTONE/Project/graduate-system/frontend/src/components/ui/card.tsx):** `bg-white text-[#333333] rounded-xl border border-gray-100 shadow-sm`
- **[table.tsx](file:///d:/Backup/BSIT-3B/CAPSTONE/Project/graduate-system/frontend/src/components/ui/table.tsx):**
  - `TableHeader`: `bg-gray-50/80 border-b border-gray-100`
  - `TableHead`: `px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider`
  - `TableBody`: `divide-y divide-gray-100 bg-white`
  - `TableRow`: `hover:bg-gray-50/70 transition-colors`
  - `TableCell`: `px-6 py-4 text-sm text-[#333333] align-middle`
- **[page-header.tsx](file:///d:/Backup/BSIT-3B/CAPSTONE/Project/graduate-system/frontend/src/components/ui/page-header.tsx):** `text-2xl font-bold text-[#333333] tracking-tight` + `text-sm text-gray-500`
- **[button.tsx](file:///d:/Backup/BSIT-3B/CAPSTONE/Project/graduate-system/frontend/src/components/ui/button.tsx):** `default` variant `bg-[#e02b20] hover:bg-[#b71c1c] text-white shadow-xs`
- **[badge.tsx](file:///d:/Backup/BSIT-3B/CAPSTONE/Project/graduate-system/frontend/src/components/ui/badge.tsx):** Soft pill badges (`rounded-full px-2.5 py-0.5 text-xs font-medium`)

---

## 4. Step-by-Step 4-Phase Execution Plan

### Phase 1: Global Theme, Reusable UI Library & All 4 Portal Layouts
1. Update `frontend/src/app/layout.tsx` (`Instrument Sans`) and `frontend/src/app/globals.css` (new tokens, remove maroon `h1`–`h4`/`label` overrides).
2. Create `breadcrumb.tsx`, `portal-breadcrumbs.tsx`, `stat-card.tsx`, `filter-bar.tsx`, and `table-actions.tsx`.
3. Update `card.tsx`, `table.tsx`, `page-header.tsx`, `button.tsx`, `badge.tsx`, `input.tsx`, `select.tsx`, `dialog.tsx`, `tabs.tsx`.
4. Update `admin/layout.tsx`, `panelist/layout.tsx`, `student/layout.tsx`, and `applicant/layout.tsx` (new `#b71c1c` sidebar, `bg-white/20 border-l-4 border-white` active state, `<PortalBreadcrumbs />` in top header, unified right-side user/notification header).

### Phase 2: Student Thesis Journey Reusable Kit + Student & Applicant Portals
1. Create `frontend/src/components/student/thesis-journey-shell.tsx` (`ThesisJourneyShell`, `JourneyStepStatusCard`, `DocumentUploadSlot`).
2. Update `defense-status-panel.tsx` and `student-rap-panel.tsx` so Schedule and RAP are clean top-level cards and concluded defenses don't show noisy application-unavailable text.
3. Refactor all 5 Student Thesis Journey pages (`title-defense`, `adviser-request`, `proposal-defense`, `strike`, `final-defense`) to use `ThesisJourneyShell` (removing `max-w-3xl` dead space and redundant copy).
4. Refactor remaining Student pages (`dashboard`, `profile`, `curriculum`, `journey`, `repository`, `announcements`, `notifications`) and Applicant pages (`dashboard`, `profile`, `alignment`, `schedule`, `exam`, `results`, `cor-upload`, `notifications`).

### Phase 3: Admin Portal Pages
1. Update `admin/dashboard/page.tsx` (preserve *"Needs Your Attention"*, *"Enrollment Snapshot"*, *"Students by Thesis Stage"*, *"Upcoming Defenses"*, and *"Workflow Monitoring"*, styled with `StatCard` and `earist-graduation` tokens).
2. Refactor User Management (`applicants`, `students`, `faculty`, `administrators`) with `FilterBar`, `Table`, `Badge`, and `TableActions`.
3. Refactor Exam Management (`slots`, `applications`, `questions`, `cor`, `waiver`) and Thesis Management (`applications`, `scheduling`, `records`, `advisers`).
4. Refactor Institutional pages (`analytics`, `settings`, `storage`, `memos`, `repository`, `notifications`).

### Phase 4: Faculty Portal & Auth Pages + Verification
1. Refactor Faculty Portal pages (`dashboard`, `profile`, `essay-evaluations`, `defenses`, `advisees`, `signatures`, `repository`, `announcements`, `notifications`).
2. Refactor Auth pages (`login`, `register`, `change-password`).
3. Run verification:
   - `cd frontend; npx tsc --noEmit`
   - `cd backend; npm test -- --run`
