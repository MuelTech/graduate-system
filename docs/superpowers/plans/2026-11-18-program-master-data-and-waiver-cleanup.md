# Graduate School Program Master Data & Pre-Exam Bridging Waiver Cleanup — Phased Implementation Plan

- **Date:** 2026-11-18
- **Status:** Implemented (Phases 1–3 complete on branch `feat/program-master-data-and-waiver-cleanup`; ready for owner review)
- **Master checklist:** `docs/superpowers/GSIS_IMPLEMENTATION_CHECKLIST.md` (§3 & §15)
- **Policy & form authorities:**
- *EARIST Graduate School Manual of Operations* (§2.0, §4.0, §5.0 Curricular Programs, §7.1.1 EGAT, §7.3.4 Bridging Program, §7.11 Length of Study / Maximum Residence Rule, §7.14 Change of Program, §7.24 Plan of Coursework)
- `EARIST-QSF-GS-014 Rev. 01` (*Dean's Endorsement to Enroll in the Bridging Program*)
- `EARIST-QSF-GS-023 Rev. 00` (*Waiver to Shift in the New Curriculum*)
- Client & project-owner confirmation to remove the pre-exam Bridging Waiver & Program Alignment gate during Applicant Registration and Entrance Examination

---

## 1. Context & Policy Authority

1. **Why the Pre-Exam Bridging Waiver & Program Alignment Gate Is Removed:**
   - Earlier system versions merged two distinct EARIST processes into a synthetic `"BRIDGING WAIVER FORM"` that blocked Applicants from booking or taking the Entrance Examination (`EGAT`) unless an Admin manually validated their waiver.
   - Official EARIST policy and forms clarify three separate concepts:
     1. **Bridging Program Endorsement (`EARIST-QSF-GS-014 Rev. 01`):** A Dean endorsement letter (Thru: Director, SARRMS) to an undergraduate college enabling an already-admitted student to enroll in 9 units of bridging courses (Manual §7.3.4) as part of their **Plan of Coursework** (§7.24.1.3). It is **not** a pre-exam applicant waiver.
     2. **Waiver to Shift in the New Curriculum (`EARIST-QSF-GS-023 Rev. 00`):** A waiver signed by an existing/returning graduate student transitioning from an older curriculum to a newer curriculum (2 credited foundation courses + refereed journal publication requirement). It does not apply to incoming Applicants registering for the Entrance Exam.
     3. **Change of Program / Shifting (Manual §7.14):** A transfer between graduate degree programs by an enrolled Graduate Student using a *Graduate School Shifting Form* (prohibited after Title Proposal completion).
   - Removing the pre-exam alignment/waiver gate restores the canonical admission flow:
     `Applicant Registration → Book & Take Entrance Exam (EGAT) → Pass Exam → Upload COR → Admin Verification → Enrolled Student`
2. **Establishing Authoritative Graduate School Program Master Data First:**
   - Cleaning up Applicant Registration (`/register`) and removing the `UndergraduateProgram` prerequisite field pairs naturally with establishing the authoritative 16 Graduate School programs, structured `degreeName` / `majorName` / `programCode`, Admin management under `Admin -> System Settings -> Programs`, and handbook-aligned Maximum Residence defaults (**4 years** Master's / **6 years** Doctoral per Manual §7.11) before implementing the future **Curriculum Checklist / Plan of Coursework** package.
   - Manual §2.0 and §4.0 confirm the Graduate School was reunified under one Dean and Associate Dean with no separate undergraduate college department layer on `Program`.
3. **Explicit Scope Exclusion — `/admin/analytics`:**
   - The `/admin/analytics` module (including `institutional-reports-tab.tsx` and `src/lib/mock/analytics-data.ts`) currently uses hardcoded mock data and is **explicitly excluded** from this phased initiative. Analytics & Reports will be addressed separately under Checklist §8 / §14.

---

## 2. Authoritative 16 Graduate School Programs (Manual §5.0 & §7.11)

### 2.1 Doctoral Programs (`DOCTORAL` — Professional Track, PQF Level 8, Default Max Residency: 6 Years)

| # | Full Display Name (`programName`) | Degree Title (`degreeName`) | Major (`majorName`) | Code (`programCode`) | Max Residency |
| :-: | :--- | :--- | :--- | :--- | :---: |
| 1 | Doctor of Education major in Educational Management (Ed.D.-EM) | Doctor of Education | Educational Management | `Ed.D.-EM` | 6 |
| 2 | Doctor of Philosophy in Industrial Psychology (PhD-IP) | Doctor of Philosophy in Industrial Psychology | `null` | `PhD-IP` | 6 |
| 3 | Doctor of Public Administration (DPA) | Doctor of Public Administration | `null` | `DPA` | 6 |
| 4 | Doctor of Business Administration (DBA) | Doctor of Business Administration | `null` | `DBA` | 6 |

### 2.2 Master's Programs (`MASTERS` — Academic Track, PQF Level 7, Default Max Residency: 4 Years)

| # | Full Display Name (`programName`) | Degree Title (`degreeName`) | Major (`majorName`) | Code (`programCode`) | Max Residency |
| :-: | :--- | :--- | :--- | :--- | :---: |
| 5 | Master of Arts in Education major in Administration and Supervision (MAEd) | Master of Arts in Education | Administration and Supervision | `MAEd` | 4 |
| 6 | Master of Arts in Education major in Guidance and Counseling (MAEd) | Master of Arts in Education | Guidance and Counseling | `MAEd` | 4 |
| 7 | Master of Arts in Education major in Special Education (MAEd) | Master of Arts in Education | Special Education | `MAEd` | 4 |
| 8 | Master of Arts in Industrial Education major in Hotel, Restaurant and Management (MAIE) | Master of Arts in Industrial Education | Hotel, Restaurant and Management | `MAIE` | 4 |
| 9 | Master in Business Administration (MBA) | Master in Business Administration | `null` | `MBA` | 4 |
| 10 | Master in Public Administration (MPA) | Master in Public Administration | `null` | `MPA` | 4 |
| 11 | Master of Arts in Teaching major in Science (MAT) | Master of Arts in Teaching | Science | `MAT` | 4 |
| 12 | Master of Arts in Teaching major in Mathematics (MAT) | Master of Arts in Teaching | Mathematics | `MAT` | 4 |
| 13 | Master of Arts in Teaching major in Electronics Technology (MAT) | Master of Arts in Teaching | Electronics Technology | `MAT` | 4 |
| 14 | Master of Arts in Teaching major in Electrical Technology (MAT) | Master of Arts in Teaching | Electrical Technology | `MAT` | 4 |
| 15 | Master of Arts in Industrial Psychology (MAIP) | Master of Arts in Industrial Psychology | `null` | `MAIP` | 4 |
| 16 | Master of Science in Mathematics (MSM) | Master of Science in Mathematics | `null` | `MSM` | 4 |

---

## 3. Phased Implementation Plan

### Phase 1 (`PROG-1`): Graduate School Program Master Data & Admin Programs Tab (`/admin/settings`)

**Goal:** Replace hardcoded/unstructured program names and legacy `5`/`7`-year residency seeds with Admin-managed Program Master Data wired into `Admin -> System Settings -> Programs`, Student/Admin residency displays, and official PDF Course/Major mappers.

1. **Additive Prisma Schema & Seed Reconciliation:**
   - Update `model Program` in `backend/prisma/schema.prisma` with additive fields:
     - `degreeName String? @map("degree_name")`
     - `majorName String? @map("major_name")`
     - `programCode String? @map("program_code")`
     - `isActive Boolean @default(true) @map("is_active")`
   - Add an additive migration; keep existing `programName`, `programType`, `maxResidencyYears`, and `department` columns non-destructively so existing foreign keys (`Student.programId`, `ExamSlot.programId`, `EntranceExamApplication.programId`, `RequirementsChecklist.programId`, `Memo.programId`) remain intact.
   - Update `backend/prisma/seed.ts` (and safe reconciliation logic) to populate the 16 authoritative programs with `degreeName`, `majorName`, `programCode`, `isActive: true`, `maxResidencyYears` (`4` for `MASTERS`, `6` for `DOCTORAL`), and clear obsolete college department strings from `department` without breaking or duplicating existing program IDs referenced by students/exams.
2. **Backend API & Authorization:**
   - Expose Admin CRUD endpoints under `SYSTEM_SETTINGS` (`settings.manage`) capability with `AuditLog` tracking:
     - `GET` (Admin list including active/inactive programs)
     - `POST` (create new program / major offering, validating `programType`, `degreeName`, optional `majorName`, `programCode`, `maxResidencyYears`)
     - `PUT` / `PATCH` (update program fields or toggle `isActive`)
   - Ensure public `GET /api/programs` returns active Graduate School programs (`isActive: true`) sorted consistently by type and display name.
3. **Frontend — Wire `Admin -> System Settings -> Programs` Tab:**
   - Implement the currently placeholder `"programs"` tab in `frontend/src/app/(portal)/admin/settings/page.tsx`:
     - Filterable table (`All / Doctoral / Master's` and `Active / Inactive` status filters).
     - Add / Edit Program dialog with `Program Type`, `Degree Title`, `Major / Specialization` (optional), `Acronym / Code`, `Max Residency (Years)` (auto-defaulting to `4` for Master's and `6` for Doctoral while remaining editable), and `Active` toggle.
4. **Residency & Official PDF Integration:**
   - Ensure `backend/src/repositories/admin-student.repository.ts` falls back to `student.program.maxResidencyYears` when `ResidencyTracking.maxYears` is absent, matching `/student/profile` (`frontend/src/app/(portal)/student/profile/page.tsx`) so both views display authoritative `4`-year / `6`-year Max Residency values.
   - Update official PDF form mappers (`GS-006/007`, `GS-011`, `GS-020`) to prefer structured `program.degreeName` and `program.majorName` when populated (with safe fallback to `programName` for legacy rows).
   - *(Excluded)* Leave `/admin/analytics` untouched until the dedicated Analytics package.

**Phase 1 Verification Gate:** Prisma `validate` / `generate` / additive migration rehearsal, backend unit/integration tests for Program CRUD, `SYSTEM_SETTINGS` capability guard, `AuditLog`, official PDF Course/Major mapping, Admin Student residency projection, frontend TypeScript (`tsc --noEmit`), scoped ESLint, and production build.

---

### Phase 2 (`WAIVER-CLEANUP-1`): Backend Removal of Program Alignment & Bridging Waiver Gate

**Goal:** Eliminate the synthetic pre-exam Program Alignment check, Bridging Waiver blocker, and `/api/waivers` endpoints from registration, exam scheduling/assignment, and admin applicant workflows without destructive DB drops.

1. **Registration Flow (`auth.service.ts`, `auth.repository.ts`, `auth.interfaces.ts`):**
   - Remove `undergraduateProgramId` requirement, `checkProgramAlignment()`, `PENDING_WAIVER` / `isProgramAligned` assignment, and automatic `ApplicantBridgingWaiver` creation from `AuthService.register()` and `AuthRepository.registerApplicant()`.
   - Owner-confirmed: Remove `Date of Birth` (`dateOfBirth`) requirement and registration assignment from `AuthService.register()`, keeping `Student.dateOfBirth` nullable in the database for historical compatibility.
2. **Entrance Exam Engine & Scheduling (`exam.service.ts`, `exam-schedule.rules.ts`, `exam-execution.repository.ts`, `exam-amendment.repository.ts`):**
   - Remove `requireEligibleAlignment()` and `alignmentStatus` checks from slot discovery, self-booking, same-day Admin assignment (`assignmentBlockReason`), exam start/execution, and schedule amendment flows so every registered Applicant can book or be assigned an exam slot immediately.
3. **Retire Waiver Module & Admin Capability Cleanup:**
   - Remove/unmount `/api/waivers` routes, `waiver.controller.ts` (including the non-official PDF generator), `waiver.service.ts`, and `waiver.repository.ts`.
   - Remove `bridgingWaivers` counter from `admin-dashboard.service.ts` (`needsAttention`) and `admin-dashboard.rules.ts` (`waiver_validated` / `waiver_rejected` feed labels only if no longer emitted; keep historical AuditLog reading safe).
   - Remove `EXAMS_WAIVER` (`waivers.manage`) from active `ADMIN_CAPABILITY_GROUPS` in backend and frontend `admin-capabilities.ts` (ignoring/sanitizing stale stored capability keys cleanly for existing Restricted Admin records).
   - Remove `alignmentStatus` filtering and waiver mutations from `admin-applicant-list.rules.ts`, `admin-applicant.service.ts`, and `admin-applicant.repository.ts`.
4. **Non-Destructive Database Policy:**
   - Keep historical `ApplicantBridgingWaiver` / `UndergraduateProgram` tables and nullable `Student.alignmentStatus` / `isProgramAligned` / `undergraduateProgramId` / `previousMastersProgramId` columns in `schema.prisma` untouched (unused by active workflows) so historical migrations and existing records never break.

**Phase 2 Verification Gate:** Focused backend auth, exam scheduling/assignment, exam execution, admin applicant, and admin capability tests, full affected backend suite, TypeScript, and backend build.

---

### Phase 3 (`WAIVER-CLEANUP-2`): Frontend Cleanup Across Registration, Applicant, Student, and Admin Portals

**Goal:** Remove all UI surfaces, navigation items, blockers, and badges tied to Program Alignment and Bridging Waivers across all portals.

1. **Applicant Registration (`frontend/src/app/(auth)/register/page.tsx`):**
   - Remove the `Date of Birth` (`dateOfBirth`) input and validation from Step 2 (*Personal Information*).
   - Remove the `Prerequisite Program` (`undergraduateProgramId`) dropdown and *"Used for Program Alignment Check"* helper text from Step 3 (*Program Selection*).
   - Populate Master's / Doctoral choices dynamically from active `GET /api/programs` data (showing Degree + Major cleanly).
2. **Applicant Portal (`frontend/src/app/(portal)/applicant/*` & navigation):**
   - Remove `/applicant/alignment` page and its sidebar navigation link.
   - Remove the Alignment Status card/step from `/applicant/dashboard` and remove the `PENDING_WAIVER` lock from `/applicant/schedule`.
3. **Admin Portal (`frontend/src/app/(portal)/admin/*` & components):**
   - Remove `/admin/exam/waiver` page, sidebar navigation link, and `/admin/dashboard` *"Bridging Waivers"* counter card.
   - Remove Alignment Status filter/column/badge, Prerequisite Program row, and Bridging Waiver approve/reject controls from `/admin/users/applicants`, `/admin/users/applicants/[id]`, and `AssignApplicantDialog`.
   - Remove `waiver_validated` / `waiver_rejected` filter options from `/admin/settings` Audit Logs filter if retired, or retain cleanly for historical viewing.
4. **Student Portal & Admin Student Detail:**
   - Remove the Program Alignment badge and Prerequisite Program row from `/student/profile` and `/admin/users/students/[id]`.

**Phase 3 Verification Gate:** Frontend TypeScript (`tsc --noEmit`), scoped ESLint, affected frontend UI contract checks, and `next build` production build; project-owner manual/browser QA across Registration, Applicant, Admin, and Student portals.

---

## 4. Downstream Dependency Ordering

Once Phases 1–3 (`PROG-1`, `WAIVER-CLEANUP-1`, `WAIVER-CLEANUP-2`) are accepted and merged:
1. **Curriculum Master / Plan of Coursework (Checklist §3):** Build Curriculum Versions, Course Groups (`Foundation`, `Major`, `Cognate`, `Thesis`, and optional `Bridging` for enrolled students per `GS-014` & Manual §7.3.4 / §7.24), Student Curriculum Checklist UI, and COR reconciliation on top of the clean 16-program master data.
2. **Written Comprehensive Exam History & 3-Strike Tracking (Checklist §22 & Manual §7.15):** Implement per-component (`Foundation`, `Major`, `Cognate`) attempt history and 3rd-attempt disqualification tracking.
3. **Remaining Handbook Policies:** LOA (`ON_LEAVE`) vs. MRR exclusion (§7.13), 5-advisee-per-semester faculty cap (§7.20.3), and post-Title Program Shifting restriction (§7.14.3).
