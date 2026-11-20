# Phase 1 Implementation Plan & Architecture — Curriculum Checklist / Plan of Coursework (§3 & Manual §7.24)

**Branch:** `feat/curriculum-checklist-plan-of-coursework`  
**Starting `main`:** `f77b7dd1`  
**Date:** 2026-11-20  
**Related Manual Authority:** EARIST Graduate School Manual of Operations (§7.5, §7.9, §7.14, §7.16, §7.24, §7.25)

---

## 1. Purpose & Key Product Decisions

Because GS-IS does not connect to an external Registrar grading system, the **Curriculum Checklist / Plan of Coursework** serves as a **simple, paper-faithful manual coursework tracking tool** rather than an automated transcript engine or hard workflow gate:

1. **Zero Hard Blocks on WCE or Thesis/Dissertation:** Encoding subjects or grades in the Curriculum Checklist is strictly optional and advisory. Neither `AdminStudentService.recordCompExamAttempt`, `defense-eligibility.service.ts`, nor `student-thesis-journey.rules.ts` blocks a student from taking the Written Comprehensive Examination or progressing through Title / Proposal / Final Defense based on checklist completeness.
2. **Simple Manual Coursework Tracking (Student & Admin):**
   - **Students** (`/student/curriculum`) can encode and update their own subject status, program-aware rating, semester, school year, and remarks.
   - **Graduate School Administrators** (`/admin/users/students/[id]`) can inspect and edit a student's encoded subjects and assign or shift their curriculum version (`Old Curriculum` ↔ `New Curriculum (S.Y. 2024–2025)`) with a required audit reason.
   - No `RECORD SOURCE` column, no `Verify All Passed` bulk action, and no post-verification student edit lock — keeping the experience lightweight and aligned with the official EARIST checklist form.
3. **Final Manuscript / Publication Stays in Repository:** Research publication / final manuscript submission belongs exclusively to the dedicated Repository module (`/student/repository` and `/admin/repository`), not a separate form inside Curriculum Checklist. Accordingly, the separate `StudentGraduationMilestone` table and Publication modal were dropped in migration `20261120020000_drop_student_graduation_milestones`, and `/student/curriculum` renders only the static paper-faithful **Required Units / Requirements for Graduation** summary box.
4. **EARIST Program-Aware Grading Scale (Manual §7.9 & §7.16):**
   - **Master's:** `1.00`, `1.25`, `1.50`, `1.75`, `2.00` (passing); `5.00` (Failed), `INC`, `DRP`. Retention GWA ≤ `2.00`.
   - **Doctoral:** `1.00`, `1.25`, `1.50`, `1.75` (passing; `2.00` rejected with `400`); `5.00` (Failed), `INC`, `DRP`. Retention GWA ≤ `1.75`.
   - **INC Reminder:** Displayed when `INC` is selected or present (*removal within 1 year; maximum removal grade is `1.25`*).
5. **Group `requiredUnits` & Version Preservation:** Completion per group caps earned units at `group.requiredUnits` to handle selectable elective / "Choose 1 / Choose 2" pools accurately. Existing students remain pinned to their assigned `CurriculumVersion` when newer curricula are added.
6. **Clean Institutional Copy (Zero Internal Codes or Manual Citations in UI):**
   - User-facing curriculum labels use **`New Curriculum (S.Y. 2024–2025)`** and **`Old Curriculum`** (no `NEW-2024`, `OLD-PRE2024`, or `Pre-2024` codes in UI copy).
   - User-facing portals omit internal handbook section citations (e.g., `Manual §7.14.3`, `Manual §7.15.4`, `§7.17.1`) and show concise, status-specific explanations.

---

## 2. Architecture Summary (Implemented on Branch)

### Phase 1A — Schema, Migrations, Official Catalog & Pure Rules
- **Prisma Schema & Migrations:**
  - `20261120010000_curriculum_checklist_plan_of_coursework` — Added `CurriculumVersion`, `CurriculumCourseGroup`, `CurriculumCourse`, `StudentCourseProgress`, and `Student.curriculumVersionId` (`ON DELETE SET NULL`).
  - `20261120020000_drop_student_graduation_milestones` — Dropped the temporary `StudentGraduationMilestone` table and `GraduationMilestoneStatus` enum so final manuscript/publication workflows remain exclusively in the Repository module.
- **Official Catalog & Seeding (`backend/src/config/earist-curriculum-catalog.ts`, `backend/prisma/seed.ts`, `backend/prisma/seed-curricula.ts`):**
  - Seeded **30 authoritative EARIST curricula** verified from official DOCX/PDF checklists: **16 `New Curriculum (S.Y. 2024–2025)`** versions (default for new students across all 16 Graduate School programs) + **14 `Old Curriculum`** versions for continuing/legacy students.
  - Idempotent `reconcileAuthoritativeCurricula` and `assignMissingStudentCurriculumVersions`.
- **Auto-Assignment & COR Promotion Integration:**
  - `CorRepository.verifyAndPromote` binds the confirmed `curriculumVersionId` (or falls back to the program's active default `CurriculumVersion`) upon Applicant → Student promotion.
  - `AdminStudentService.updateStudent` aligns `curriculumVersionId` when `programId` or `curriculumType` changes.
- **Pure Rules (`backend/src/services/curriculum-checklist.rules.ts`):**
  - Program-aware grade validation, per-group unit capping, academic coursework (`countsTowardWce`) vs Thesis/Dissertation separation, and unofficial weighted GWA calculation.

### Phase 1B — Backend APIs & Authorization
- **Admin Curriculum Master (`/api/curricula/admin/*`, `ADMIN` + `settings.manage`):**
  - `GET /api/curricula/admin`, `GET /api/curricula/admin/:versionId`, `POST /api/curricula/admin`, `PUT /api/curricula/admin/:versionId`
  - `POST /api/curricula/admin/:versionId/groups`, `PUT /api/curricula/admin/groups/:groupId`, `DELETE /api/curricula/admin/groups/:groupId`
  - `POST /api/curricula/admin/groups/:groupId/courses`, `PUT /api/curricula/admin/courses/:courseId`, `DELETE /api/curricula/admin/courses/:courseId`
  - Includes `409 Conflict` delete guards when student progress exists, automatic version `totalRequiredUnits` recalculation, and `AuditLog`.
- **Program Versions Lookup (`ADMIN` + `students.manage` | `settings.manage` | `cor.verify`):**
  - `GET /api/curricula/programs/:programId/versions` via `requireAnyAdminCapability`.
- **Student Endpoints (`STUDENT`):**
  - `GET /api/student/curriculum`
  - `PUT /api/student/curriculum/courses/:courseId`
- **Admin Student Endpoints (`ADMIN` + `students.manage`):**
  - `GET /api/admin/students/:id/curriculum`
  - `PATCH /api/admin/students/:id/curriculum/version` (audited with required reason)
  - `PUT /api/admin/students/:id/curriculum/courses/:courseId`

### Phase 1C — COR Parser v2 (`earist-cor-parser@2`) Auto-Detection & Fallback
- Updated `backend/src/services/cor-extraction.service.ts` / `earist-cor.parser.ts` (`earist-cor-parser@2`) to extract `Program`, `Major`, and `Curriculum` (e.g., `2024-2025` → New Curriculum vs. pre-2024 → Old Curriculum) **without** parsing individual subject rows.
- Updated Admin COR Verification (`/admin/exam/cor`) to preselect the matched Program and Curriculum Version with multi-layer fallback to the program's active default curriculum when the COR is non-PDF, scanned, or unrecognized, and to persist the Admin-confirmed `curriculumVersionId` on promotion.

### Phase 1D — Low-Icon Institutional Frontend & Copy Refinement
- **Student Portal (`/student/curriculum`):** Summary strip (Assigned Curriculum, Academic Coursework Units, Total Degree Units, Unofficial GWA vs Retention), grouped subject tables (`Code`, `Subject`, `Units`, `Status`, `Rating`, `Term / S.Y.`, `Action`), program-aware Encode/Update Subject dialog, and static EARIST paper-faithful **Required Units / Requirements for Graduation** summary box.
- **Admin Student Detail (`/admin/users/students/[id]`):**
  - Curriculum Version display in Academic metadata and full `StudentCurriculumSection` (`Change Curriculum` with required reason + subject encoding).
  - Removed the redundant `Coursework progress` box inside the **Comprehensive Examination** card (curriculum checklist is non-blocking and already rendered on the same page).
  - Removed internal handbook section citations (`Manual §7.14.3`, `Manual §7.15.4`, `§7.17.1`) and replaced the generic program-lock helper text with status-specific reasons (`GRADUATED`, `DISMISSED`, or completed Title Defense).
- **Admin System Settings (`/admin/settings` -> `Curricula`):** Streamlined Program dropdown selector + Version switcher (`New Curriculum (S.Y. 2024–2025)` / `Old Curriculum`) instead of a flat 30-row table, with full version, group, and subject CRUD.

---

## 3. Branch Commit Summary & Verification Snapshot

- `3a1ab6b8` — Schema, 30 official EARIST curricula seed, domain rules, and auto-assignment.
- `47804725` — Admin master, student checklist, and admin student curriculum APIs.
- `ac4465fa` — Student checklist (`/student/curriculum`), Admin student review, and `System Settings -> Curricula` UI.
- `d0ccfa00` — COR Parser v2 (`earist-cor-parser@2`) auto-detecting `Program`, `Major`, and `Curriculum` with fallback on `/admin/exam/cor`.
- `9ecbfe62` — UI & schema cleanup: dropped `StudentGraduationMilestone` (`20261120020000`), removed `RECORD SOURCE` / `Verify All Passed` / Publication modal, streamlined `Curricula` settings to Program + Version switcher, and cleaned labels to `New Curriculum (S.Y. 2024–2025)` / `Old Curriculum`.
- `880d3888` — Removed redundant coursework progress box inside the Comprehensive Examination card, replaced generic program-lock copy with status-specific wording, and removed internal manual section citations on `/admin/users/students/[id]`.

**Verified:**
- Database: 61 Prisma migrations applied cleanly (`prisma migrate status` up to date), Prisma Client regenerated, 30 curricula seeded/reconciled.
- Backend: `prisma validate`, `tsc --noEmit` (0 errors), `vitest run` (`272` passed / `9` skipped across `281` files; `4,065` passed / `187` skipped / `0` failed).
- Frontend: `tsc --noEmit` (0 errors), `eslint` (0 errors / 0 warnings), `npm run build` (`68/68` static pages, exit 0), `git diff --check` clean.

---

## 4. Explicitly Deferred to Phase 2 (Follow-On)

- Enrolled-Student Bridging Program (`GS-014`) dynamic per-student bridging requirements (`9` units / `18` Prof Ed units).
- Continuing Student COR-based onboarding (`CONT-STUDENT-1`) and pre-GSIS legacy standing initialization (`CONT-STUDENT-2`), which will reuse COR Parser v2 (`Program` + `Major` + `Curriculum`) to resolve the right checklist automatically.
- Printable / PDF Plan of Coursework export and formal Curriculum Shift Waiver (`GS-023`) document workflow.
