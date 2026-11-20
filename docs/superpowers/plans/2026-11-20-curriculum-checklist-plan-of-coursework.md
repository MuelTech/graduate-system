# Phase 1 Implementation Plan & Architecture — Curriculum Checklist / Plan of Coursework (§3 & Manual §7.24)

**Branch:** `feat/curriculum-checklist-plan-of-coursework`  
**Starting `main`:** `f77b7dd1`  
**Date:** 2026-11-20  
**Related Manual Authority:** EARIST Graduate School Manual of Operations (§7.5, §7.9, §7.14, §7.16, §7.24, §7.25)

---

## 1. Purpose & Key Product Decisions

Because GS-IS does not connect to an external Registrar grading system, the **Curriculum Checklist / Plan of Coursework** serves as a **hybrid self-service & administrative tracking tool** rather than an automated transcript engine or hard workflow gate:

1. **Zero Hard Blocks on WCE or Thesis/Dissertation:** Encoding subjects or grades in the Curriculum Checklist is optional and advisory only. Neither `AdminStudentService.recordCompExamAttempt` nor `defense-eligibility.service.ts` nor `student-thesis-journey.rules.ts` blocks a student from taking the Written Comprehensive Examination or progressing through Title / Proposal / Final Defense based on checklist completeness.
2. **Hybrid Manual Encoding Authority:**
   - **Students** (`/student/curriculum`) can self-encode subject status, program-aware rating, semester, school year, remarks, and Research Publication milestone progress (`NOT_STARTED` / `IN_PROGRESS` / `SUBMITTED`).
   - **Graduate School Administrators** (`/admin/users/students/[id]`) can view, edit, assign/shift curriculum versions (`OLD` ↔ `NEW` with required audit reason), verify individual subjects or bulk-verify completed rows (`Verify All Passed`), and verify the Research Publication milestone.
   - Once verified by an Administrator (`isVerifiedByAdmin` / `isPublicationVerified`), a record is locked against Student edits (`409 Conflict`).
3. **One-Way Live Graduation Milestones:** Comprehensive Examination (`CompExamRecord`) and Thesis/Dissertation (`ThesisRecord` / `DefenseConclusion`) status are projected live into the Graduation Requirements card without duplicating or overriding their authoritative workflows.
4. **EARIST Program-Aware Grading Scale (Manual §7.9 & §7.16):**
   - **Master's:** `1.00`, `1.25`, `1.50`, `1.75`, `2.00` (passing); `5.00` (Failed), `INC`, `DRP`. Retention GWA ≤ `2.00`.
   - **Doctoral:** `1.00`, `1.25`, `1.50`, `1.75` (passing; `2.00` rejected with `400`); `5.00` (Failed), `INC`, `DRP`. Retention GWA ≤ `1.75`.
   - **INC Reminder (§7.16.3):** Displayed when `INC` is selected or present (*removal within 1 year; maximum removal grade is `1.25`*).
5. **Group `requiredUnits` & Version Preservation:** Completion per group caps earned units at `group.requiredUnits` to handle selectable elective/choose-N pools accurately. Existing students remain bound to their assigned `CurriculumVersion` when newer curricula are added.

---

## 2. Phase 1 Architecture Summary (Implemented on Branch)

### Phase 1A — Schema, Migration, Official Catalog & Pure Rules
- **Prisma Schema & Migration (`20261120010000_curriculum_checklist_plan_of_coursework`):**
  - Added `CurriculumVersion`, `CurriculumCourseGroup`, `CurriculumCourse`, `StudentCourseProgress`, `StudentGraduationMilestone`, and `Student.curriculumVersionId` (`ON DELETE SET NULL`).
- **Official Catalog & Seeding (`backend/src/config/earist-curriculum-catalog.ts`, `backend/prisma/seed.ts`, `backend/prisma/seed-curricula.ts`):**
  - Seeded **30 authoritative EARIST curricula** verified from official DOCX/PDF checklists: **16 NEW (`NEW-2024`, S.Y. 2024–2025, default for new students)** covering all 16 Graduate School programs + **14 OLD (`OLD-PRE2024`, Pre-2024)** covering continuing/legacy checklists.
  - Idempotent `reconcileAuthoritativeCurricula` and `assignMissingStudentCurriculumVersions`.
- **Auto-Assignment:**
  - `CorRepository.verifyAndPromote` assigns the program's active default `CurriculumVersion` upon Applicant → Student promotion.
  - `AdminStudentService.updateStudent` aligns `curriculumVersionId` when `programId` or `curriculumType` changes.
- **Pure Rules (`backend/src/services/curriculum-checklist.rules.ts`):**
  - Program-aware grade validation, per-group unit capping, WCE (`countsTowardWce`) vs Thesis/Dissertation separation, unofficial weighted GWA, and live graduation milestone projection.

### Phase 1B — Backend APIs & Authorization
- **Admin Curriculum Master (`/api/curricula/admin/*`, `settings.manage`):** Version/Group/Subject CRUD with `409 Conflict` delete guards when student progress exists, automatic version `totalRequiredUnits` recalculation, and `AuditLog`.
- **Program Versions Lookup (`/api/curricula/programs/:programId/versions`, `students.manage` or `settings.manage`):** Uses `requireAnyAdminCapability`.
- **Student Endpoints (`/api/student/curriculum/*`, `STUDENT`):** Read checklist, update unverified coursework rows, update unverified publication milestone.
- **Admin Student Endpoints (`/api/admin/students/:id/curriculum/*`, `students.manage`):** Read checklist, assign/shift curriculum version (audited), edit/verify individual subjects, bulk `verify-all`, and update/verify publication milestone.

### Phase 1C — Low-Icon Institutional Frontend
- **Student Portal (`/student/curriculum`):** Summary strip (Curriculum Version, WCE Academic Coursework Ref., Total Degree Units, Unofficial GWA vs Retention), grouped subject tables, program-aware Update Subject dialog, and live Requirements for Graduation card.
- **Admin Student Detail (`/admin/users/students/[id]`):** Curriculum Version display in Academic metadata, subtle non-blocking coursework advisory inside Comprehensive Examination card, and full `StudentCurriculumSection` with `Change Version`, `Verify All Passed`, `Edit / Verify` subject dialog, and Publication verification.
- **Admin System Settings (`/admin/settings` -> `Curricula`):** Program & track filter, version CRUD, and group/subject management.

---

## 3. Explicitly Deferred to Phase 2 (Follow-On)

- Enrolled-Student Bridging Program (`GS-014`) dynamic per-student bridging requirements (`9` units / `18` Prof Ed units).
- COR Subject Parser (`earist-cor.parser.ts` v2) assistive matching of enrolled subjects to `IN_PROGRESS` checklist items.
- Printable / PDF Plan of Coursework export and formal Curriculum Shift Waiver (`GS-023`) document workflow.
