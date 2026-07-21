# Admin Student Management — Design Spec

**Date:** 2026-07-22
**Status:** Approved
**Author:** MiMo Code Agent

---

## Overview

Implement the Admin Student Management page with live API integration, replacing the current mock data. The page displays all enrolled students with their academic status and provides a detail view for comprehensive exam management.

---

## Workflow Reference

From `GS_System_Workflow_Revised-6-3-26_Updated.docx`:

| Phase | Description |
|-------|-------------|
| **Phase 3** | Comprehensive Examination — Manual/Admin-Verified, face-to-face, paper-based |
| **Phase 4** | Student Portal — Dashboard, Profile, Curriculum, AI Chatbot, Notifications |

### Comprehensive Exam Rules

| Rule | Description |
|------|-------------|
| **2-strike policy** | Student has 2 attempts for comprehensive exam |
| **1st failure** | 1 strike, can retry |
| **2nd failure** | 2 strikes, dismissed from program |
| **Pass** | Proceed to thesis workflow |
| **Admin action** | Manually records pass/fail status |

---

## Student Journey (6 Steps)

```
1. Admissions & Enrollment
       ↓
2. Comprehensive Examination (must PASS to proceed)
       ↓
3. Thesis Adviser Assignment
       ↓
4. Title Defense
       ↓
5. Proposal Defense
       ↓
6. Final Defense
```

---

## Design

### Table Columns

| # | Column | Source |
|---|--------|--------|
| 1 | Student | Name + Email + Student Number |
| 2 | Program | `program.programName` |
| 3 | Thesis Stage | `thesisRecords[0].stage` |
| 4 | Comp Exam | `compExamRecords[0].status` + strike count |
| 5 | Adviser | `adviserAssignments[0].adviser.name` |
| 6 | Status | `admissionStatus` badge |

### Table Actions

| Action | Icon | Purpose |
|--------|------|---------|
| **View** | Eye | Opens student detail page |

---

## Student Detail Page

### Section 1: Profile

| Field | Source |
|-------|--------|
| Full Name | `user.firstName` + `user.lastName` |
| Student Number | `studentNumber` |
| Email | `user.email` |
| Program | `program.programName` |
| Enrollment Date | `enrollmentDate` |
| Status | `admissionStatus` badge |

### Section 2: Comprehensive Exam

| Field | Source |
|-------|--------|
| Status | `compExamRecords[0].status` badge |
| Strike Count | Count of FAILED records |

| Strike Count | Status | Actions Available |
|--------------|--------|-------------------|
| 0 | PENDING | Mark as Passed, Mark as Failed |
| 1 | FAILED (1 strike) | Mark as Passed, Mark as Failed |
| 2 | DISMISSED | None (student dismissed) |

### Section 3: Thesis Progress

| Field | Source |
|-------|--------|
| Current Stage | `thesisRecords[0].stage` |
| Status | `thesisRecords[0].status` |
| Adviser | `adviserAssignments[0].adviser.name` |

### Section 4: Academic Info

| Field | Source |
|-------|--------|
| Residency Start | `residencyStartDate` |
| Max Residency | `residencyTracking.maxYears` |
| Curriculum Type | `curriculumType` |
| Alignment Status | `alignmentStatus` |

---

## Backend Changes

### New Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/admin/students` | List all students (paginated) |
| `GET` | `/api/admin/students/:id` | Get student detail |

### Existing Endpoints (No Changes)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/api/student/:id/comprehensive-exam` | Update comp exam status |

---

## Frontend Changes

### New Files

| File | Purpose |
|------|---------|
| `frontend/src/app/(portal)/admin/users/students/[id]/page.tsx` | Student detail page |

### Modified Files

| File | Changes |
|------|---------|
| `frontend/src/app/(portal)/admin/users/students/page.tsx` | Rewrite with API integration |
| `frontend/src/types/index.ts` | Add StudentListResponse, StudentDetail interfaces |

---

## Implementation Order

| Phase | Task |
|-------|------|
| 1 | Backend: Add list and detail endpoints |
| 2 | Frontend: Add TypeScript interfaces |
| 3 | Frontend: Rewrite students list page |
| 4 | Frontend: Create student detail page |
| 5 | Testing |

---

## Testing Checklist

| Test | Expected Result |
|------|-----------------|
| Load students | Table shows real data from API |
| Search by name | Filters correctly |
| Filter by program | Shows correct students |
| Filter by thesis stage | Shows correct students |
| Click View | Navigates to detail page |
| Detail page shows profile | All fields displayed correctly |
| Detail page shows comp exam | Status and strike count displayed |
| Mark comp exam as Passed | Status updates, strike count remains |
| Mark comp exam as Failed | Status updates, strike count increments |
| Pagination | Works with filtered results |

---

*End of Spec*
