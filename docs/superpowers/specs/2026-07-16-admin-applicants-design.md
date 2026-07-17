# Admin Applicant Management — Design Spec

**Date:** 2026-07-16
**Status:** Approved
**Author:** MiMo Code Agent

---

## Overview

Redesign the Admin Portal's Applicant Management page (`/admin/users/applicants`) to replace hardcoded dummy data with live backend integration. The page displays a list of all applicants with key status indicators, and provides a "View" action that opens a comprehensive detail page for individual applicant review.

---

## Goals

1. Replace hardcoded table data with real API calls
2. Add working status filters
3. Implement a single "View" action that opens a detailed applicant profile page
4. Provide actionable buttons (Validate Waiver, Verify COR, Promote, Reset Strikes) within the detail page
5. Follow existing codebase patterns (3-layer architecture, TanStack Query, shadcn/ui)

---

## Scope

| In Scope | Out of Scope |
|----------|--------------|
| Applicant list table with filters | Exam Slots CRUD (already exists) |
| Applicant detail page | Waiver Queue page (already exists) |
| Backend API for applicant data | COR Validation page (already exists) |
| Backend API for actions (validate, verify, promote, reset) | Essay grading (already exists) |

---

## Existing Pages (No Changes)

| Page | URL | Purpose |
|------|-----|---------|
| Exam Slots | `/admin/exam/slots` | Create/manage exam schedules |
| Exam Scores | `/admin/exam/scores` | Grade essays, view scores |
| Waiver Queue | `/admin/exam/waiver` | Batch process waivers |
| COR Validation | `/admin/exam/cor` | Batch process CORs |
| Exam Applications | `/admin/exam/applications` | Exam-focused applicant view (links to detail page) |

---

## Design Decisions

### Decision 1: Single "View" Action vs Multiple Action Buttons

**Chosen:** Single "View" action that opens a comprehensive detail page.

**Rationale:** Instead of 5 separate action buttons (View Profile, Validate Waiver, View COR, Promote, Reset Strikes), one "View" button opens a detail page with all data and contextual actions. This reduces table clutter and provides better UX for comprehensive applicant review.

### Decision 2: Modals vs Separate Detail Pages

**Chosen:** Separate detail page (`/admin/users/applicants/[id]`).

**Rationale:** The detail page contains multiple sections (Profile, Alignment, Exam, COR, Admission, Activity Log) that would be too complex for a modal. A dedicated page provides better navigation and allows for future expansion.

### Decision 3: Relationship to Existing Exam Management Pages

**Chosen:** Keep existing pages, link via "View" action.

**Rationale:** The Waiver Queue and COR Validation pages serve a batch processing use case. The Applicant Detail page serves an individual review use case. Both update the same database records, so there's no data conflict.

---

## Table View Design

### URL
`/admin/users/applicants`

### Columns

| # | Column Header | Width | Data Source | Sortable | Filterable |
|---|---------------|-------|-------------|----------|------------|
| 1 | Name | auto | `user.firstName` + `user.lastName` + `user.email` | Yes | Yes |
| 2 | Pinnacle ID | 150px | `pinnacleApplicantId` | Yes | Yes |
| 3 | Program | auto | `program.programName` | Yes | Yes |
| 4 | Alignment | 130px | `alignmentStatus` enum | Yes | Yes |
| 5 | Exam | 130px | Derived from `examApplications` | Yes | Yes |
| 6 | COR | 120px | Derived from `corUploads` | Yes | Yes |
| 7 | Status | 130px | `admissionStatus` enum | Yes | Yes |
| 8 | Actions | 80px | - | No | No |

### Badge Colors

| Status | Badge Text | Color |
|--------|------------|-------|
| Aligned | Aligned | Green |
| Pending Waiver | Pending Waiver | Amber |
| Cleared | Cleared | Blue |
| Exam Not Scheduled | Not Scheduled | Gray |
| Exam Scheduled | Scheduled | Blue |
| Exam Passed | Passed | Green |
| Exam Failed | Failed | Red |
| COR None | -- | Gray |
| COR Pending | Pending | Amber |
| COR Verified | Verified | Green |
| Applicant | Applicant | Gray |
| Enrolled | Enrolled | Green |
| Disqualified | Disqualified | Red |

### Status Filters

| Filter Label | Filter Value | Logic |
|--------------|--------------|-------|
| All | (no filter) | Show all |
| Pending Alignment | `alignmentStatus = PENDING_WAIVER` | `students.alignment_status = 'PENDING_WAIVER'` |
| Waiver Cleared | `alignmentStatus = CLEARED` | `students.alignment_status = 'CLEARED'` |
| Exam Scheduled | Has scheduled exam | `examApplications` with `slotId` not null |
| Exam Passed | Exam passed | `examApplications.status = PASSED` |
| COR Pending | COR uploaded, not verified | `corUploads` with `isVerified = false` |
| Promoted to Student | Enrolled | `admissionStatus = ENROLLED` |

### Search

- Search by: Name, Email, Pinnacle ID, Program
- Case-insensitive partial match

### Pagination

- Server-side pagination
- Default page size: 10
- Options: 10, 25, 50

### Actions

| Action | Icon | Condition | Behavior |
|--------|------|-----------|----------|
| View | `Eye` | Always shown | Navigate to `/admin/users/applicants/[id]` |

---

## Detail Page Design

### URL
`/admin/users/applicants/[id]`

### Layout

```
┌─────────────────────────────────────────────────────────┐
│ ← Back to Applicants    Applicant Profile               │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  [Profile Section]                                      │
│                                                         │
│  [Progress Stepper]                                     │
│                                                         │
│  [Alignment Section]  [Exam Section]                    │
│                                                         │
│  [COR Section]        [Admission Section]               │
│                                                         │
│  [Activity Log]                                         │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

### Section 1: Profile Card

#### Fields

| Field | Source | Editable |
|-------|--------|----------|
| Avatar | Default placeholder | No |
| Full Name | `user.firstName` + `user.lastName` | No |
| Email | `user.email` | No |
| Pinnacle Applicant ID | `pinnacleApplicantId` | No |
| Phone | `cellphone` | Yes (inline edit) |
| Date of Birth | `dateOfBirth` | No |
| Program | `program.programName` | No |
| Undergraduate Course | `undergraduateCourse` | No |
| Registration Date | `createdAt` | No (formatted) |

---

### Section 2: Progress Stepper

#### Steps

| Step | Label | Status Logic |
|------|-------|--------------|
| 1 | Register & Align | `alignmentStatus = CLEARED` or `ALIGNED` |
| 2 | Schedule & Take Exam | `examApplications.status = PASSED` |
| 3 | Upload COR | `corUploads[0].corRecord.isVerified = true` |

#### Visual

```
① Register & Align ──── ② Schedule & Exam ──── ③ Upload COR
     ✓ (green)              ✓ (green)              ○ (gray)
```

---

### Section 3: Program Alignment

#### Fields

| Field | Source |
|-------|--------|
| Undergraduate Program | `undergraduateCourse` |
| Intended Graduate Program | `program.programName` |
| Alignment Status | `alignmentStatus` |
| Waiver Downloaded At | `bridgingWaiver.waiverFormDownloadedAt` |
| Validated By | `bridgingWaiver.validatedBy` (user name) |
| Validated At | `bridgingWaiver.validatedAt` |
| Admin Notes | `bridgingWaiver.adminNotes` |

#### Actions

| Action | Button | Condition | Effect |
|--------|--------|-----------|--------|
| Validate | Green button | `alignmentStatus = PENDING_WAIVER` | Updates `applicant_bridging_waivers.status` → `validated`, `students.alignment_status` → `cleared` |
| Reject | Red button | `alignmentStatus = PENDING_WAIVER` | Opens reject modal |

#### Reject Modal

| Field | Type | Required |
|-------|------|----------|
| Reason | Textarea | Yes |

---

### Section 4: Entrance Examination

#### Fields

| Field | Source |
|-------|--------|
| Exam Status | `examApplications[0].status` |
| MCQ Score | `examApplications[0].examScores.multipleChoiceScore` |
| Essay Score | `examApplications[0].examScores.essayScore` |
| Total Score | `examApplications[0].examScores.totalScore` |
| Exam Date | `examApplications[0].examSlot.examDate` |
| Exam Time | `examApplications[0].examSlot.examTime` |
| Venue/Link | `examApplications[0].examSlot.venueOrLink` |
| Strike Count | `strikeCount` |

#### Actions

| Action | Button | Condition | Effect |
|--------|--------|-----------|--------|
| Reset Strikes | Gray button | `strikeCount > 0` | Updates `strikeCount` → 0 |

---

### Section 5: Certificate of Registration (COR)

#### Fields

| Field | Source |
|-------|--------|
| COR Status | Derived from `corUploads[0]` |
| Upload Date | `corUploads[0].uploadedAt` |
| OCR Status | `corUploads[0].ocrStatus` |
| Original Filename | `corUploads[0].originalFilename` |
| Registration Number | `corUploads[0].corRecord.registrationNumber` |
| Academic Year | `corUploads[0].corRecord.academicYear` |
| Semester | `corUploads[0].corRecord.semester` |
| Program | `corUploads[0].corRecord.extractedProgramName` |
| Year Level | `corUploads[0].corRecord.extractedYearLevel` |
| Total Assessment | `corUploads[0].corRecord.totalAssessment` |
| Net Assessed | `corUploads[0].corRecord.netAssessed` |
| Outstanding Balance | `corUploads[0].corRecord.outstandingBalance` |
| Verified By | `corUploads[0].corRecord.verifiedBy` (user name) |
| Verified At | `corUploads[0].corRecord.verifiedAt` |
| Verification Method | `corUploads[0].corRecord.verificationMethod` |

#### Actions

| Action | Button | Condition | Effect |
|--------|--------|-----------|--------|
| View COR Document | Blue button | `corUploads[0]` exists | Opens PDF/image in new tab |
| Verify COR | Green button | `corUploads[0].corRecord.isVerified = false` | Opens verify modal |
| Reject COR | Red button | `corUploads[0].corRecord.isVerified = false` | Opens reject modal |

#### Verify Modal

| Field | Type | Options |
|-------|------|---------|
| Verification Method | Select | Manual, QR Auto, OCR Auto |

#### Reject Modal

| Field | Type | Required |
|-------|------|----------|
| Reason | Textarea | Yes |

---

### Section 6: Admission Status

#### Fields

| Field | Source |
|-------|--------|
| Current Status | `admissionStatus` |
| Enrollment Date | `enrollmentDate` (if enrolled) |

#### Eligibility Check

| Check | Condition | Icon |
|-------|-----------|------|
| Entrance Exam Passed | `examApplications.status = PASSED` | ✓ or ✗ |
| COR Verified | `corUploads[0].corRecord.isVerified = true` | ✓ or ✗ |

#### Actions

| Action | Button | Condition | Effect |
|--------|--------|-----------|--------|
| Promote to Student | Green button | Both checks pass | Opens confirmation dialog |

#### Promote Confirmation Dialog

| Field | Value |
|-------|-------|
| Applicant Name | `firstName` + `lastName` |
| Pinnacle ID | `pinnacleApplicantId` |
| Username | Student Number from COR |
| Password | Date of Birth (YYYYMMDD format) |

---

### Section 7: Activity Log

#### Fields

| Field | Source |
|-------|--------|
| Timestamp | `auditLogs.created_at` |
| Action | `auditLogs.action_type` |
| Description | `auditLogs.description` |
| Actor | `auditLogs.actor_id` → User name |

#### Log Entries to Display

| Action Type | Description |
|-------------|-------------|
| `registration_completed` | Registered |
| `alignment_check_completed` | Program alignment check: {status} |
| `waiver_downloaded` | Bridging waiver downloaded |
| `waiver_validated` | Waiver validated by {admin} |
| `waiver_rejected` | Waiver rejected by {admin} |
| `exam_slot_selected` | Exam slot selected |
| `exam_completed` | Exam completed - {status} |
| `cor_uploaded` | COR uploaded |
| `cor_verified` | COR verified - {method} |
| `cor_rejected` | COR rejected by {admin} |
| `role_promoted` | Promoted to Student |

---

## Backend API Design

### New Routes

| Method | Path | Auth | Role | Handler |
|--------|------|------|------|---------|
| `GET` | `/api/admin/applicants` | JWT | ADMIN | `listApplicants` |
| `GET` | `/api/admin/applicants/:id` | JWT | ADMIN | `getApplicantDetail` |
| `PUT` | `/api/admin/applicants/:id/waiver/validate` | JWT | ADMIN | `validateWaiver` |
| `PUT` | `/api/admin/applicants/:id/waiver/reject` | JWT | ADMIN | `rejectWaiver` |
| `PUT` | `/api/admin/applicants/:id/cor/verify` | JWT | ADMIN | `verifyCor` |
| `PUT` | `/api/admin/applicants/:id/cor/reject` | JWT | ADMIN | `rejectCor` |
| `PUT` | `/api/admin/applicants/:id/promote` | JWT | ADMIN | `promoteToStudent` |
| `PUT` | `/api/admin/applicants/:id/strikes/reset` | JWT | ADMIN | `resetStrikes` |

### Request/Response Schemas

#### GET /api/admin/applicants

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `pageSize` | number | 10 | Items per page |
| `search` | string | "" | Search term |
| `alignment` | string | "" | Filter by alignmentStatus |
| `exam` | string | "" | Filter by examStatus |
| `cor` | string | "" | Filter by corStatus |
| `status` | string | "" | Filter by admissionStatus |

**Response:**
```json
{
  "applicants": [
    {
      "id": "uuid",
      "firstName": "Juan",
      "lastName": "Dela Cruz",
      "email": "juan@gmail.com",
      "pinnacleApplicantId": "PIN-2026-001",
      "program": { "id": "uuid", "programName": "MSCS" },
      "alignmentStatus": "PENDING_WAIVER",
      "examStatus": "PASSED",
      "examScores": { "mcq": 85, "essay": 90, "total": 87.5 },
      "corStatus": "VERIFIED",
      "admissionStatus": "APPLICANT",
      "strikeCount": 0,
      "createdAt": "2026-07-14T10:00:00Z"
    }
  ],
  "total": 45,
  "page": 1,
  "pageSize": 10
}
```

#### GET /api/admin/applicants/:id

**Response:**
```json
{
  "id": "uuid",
  "firstName": "Juan",
  "lastName": "Dela Cruz",
  "email": "juan@gmail.com",
  "pinnacleApplicantId": "PIN-2026-001",
  "cellphone": "+639171234567",
  "dateOfBirth": "1998-01-15",
  "program": { "id": "uuid", "programName": "MSCS" },
  "undergraduateCourse": "BS Computer Science",
  "alignmentStatus": "PENDING_WAIVER",
  "isProgramAligned": false,
  "bridgingWaiver": {
    "id": "uuid",
    "status": "pending",
    "waiverFormDownloadedAt": "2026-07-15T14:30:00Z",
    "validatedBy": null,
    "validatedAt": null,
    "adminNotes": null
  },
  "examApplications": [{
    "id": "uuid",
    "status": "PASSED",
    "examSlot": { "examDate": "2026-07-20", "examTime": "09:00", "venueOrLink": "Room 301" },
    "examScores": { "multipleChoiceScore": 85, "essayScore": 90, "totalScore": 87.5 }
  }],
  "strikeCount": 0,
  "corUploads": [{
    "id": "uuid",
    "ocrStatus": "completed",
    "filePath": "/uploads/cor/abc.pdf",
    "originalFilename": "cor_juan.pdf",
    "uploadedAt": "2026-07-17T15:00:00Z",
    "corRecord": {
      "registrationNumber": "2026-00123",
      "academicYear": "2026-2027",
      "semester": "1st",
      "extractedProgramName": "MSCS",
      "extractedYearLevel": "1st Year",
      "totalAssessment": 45000,
      "netAssessed": 42000,
      "outstandingBalance": 0,
      "isVerified": true,
      "verificationMethod": "manual",
      "verifiedBy": { "firstName": "Admin", "lastName": "User" },
      "verifiedAt": "2026-07-17T16:00:00Z"
    }
  }],
  "admissionStatus": "APPLICANT",
  "enrollmentDate": null,
  "activityLog": [
    { "timestamp": "2026-07-14T10:00:00Z", "action": "registration_completed", "description": "Registered", "actor": "System" },
    { "timestamp": "2026-07-16T11:30:00Z", "action": "exam_completed", "description": "Exam completed - PASSED", "actor": "System" }
  ]
}
```

#### PUT /api/admin/applicants/:id/waiver/validate

**Response:**
```json
{
  "message": "Waiver validated. Exam scheduling unlocked.",
  "alignmentStatus": "CLEARED"
}
```

#### PUT /api/admin/applicants/:id/waiver/reject

**Request Body:**
```json
{
  "adminNotes": "Documents do not meet requirements"
}
```

**Response:**
```json
{
  "message": "Waiver rejected.",
  "alignmentStatus": "PENDING_WAIVER"
}
```

#### PUT /api/admin/applicants/:id/cor/verify

**Request Body:**
```json
{
  "verificationMethod": "manual"
}
```

**Response:**
```json
{
  "message": "COR verified.",
  "corStatus": "VERIFIED"
}
```

#### PUT /api/admin/applicants/:id/cor/reject

**Request Body:**
```json
{
  "reason": "COR is illegible"
}
```

**Response:**
```json
{
  "message": "COR rejected. Applicant notified.",
  "corStatus": "PENDING"
}
```

#### PUT /api/admin/applicants/:id/promote

**Response:**
```json
{
  "message": "Applicant promoted to Student. Credentials dispatched.",
  "studentNumber": "2026-00123",
  "credentials": {
    "username": "2026-00123",
    "password": "19980115"
  }
}
```

#### PUT /api/admin/applicants/:id/strikes/reset

**Response:**
```json
{
  "message": "Strike count reset.",
  "strikeCount": 0
}
```

---

## Frontend Types

### New Interfaces

```typescript
// frontend/src/types/index.ts

export interface AdminApplicantListItem {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  pinnacleApplicantId: string;
  program: { id: string; programName: string };
  alignmentStatus: string;
  examStatus: string;
  examScores: { mcq: number; essay: number; total: number } | null;
  corStatus: string;
  admissionStatus: string;
  strikeCount: number;
  createdAt: string;
}

export interface AdminApplicantDetail extends AdminApplicantListItem {
  cellphone: string;
  dateOfBirth: string;
  undergraduateCourse: string;
  isProgramAligned: boolean;
  bridgingWaiver: BridgingWaiverDetail | null;
  examApplications: ExamApplicationDetail[];
  corUploads: CorUploadDetail[];
  enrollmentDate: string | null;
  activityLog: ActivityLogEntry[];
}

export interface BridgingWaiverDetail {
  id: string;
  status: string;
  waiverFormDownloadedAt: string | null;
  validatedBy: { firstName: string; lastName: string } | null;
  validatedAt: string | null;
  adminNotes: string | null;
}

export interface ExamApplicationDetail {
  id: string;
  status: string;
  examSlot: { examDate: string; examTime: string; venueOrLink: string } | null;
  examScores: { multipleChoiceScore: number; essayScore: number; totalScore: number } | null;
}

export interface CorUploadDetail {
  id: string;
  ocrStatus: string;
  filePath: string;
  originalFilename: string;
  uploadedAt: string;
  corRecord: CorRecordDetail | null;
}

export interface CorRecordDetail {
  registrationNumber: string;
  academicYear: string;
  semester: string;
  extractedProgramName: string;
  extractedYearLevel: string;
  totalAssessment: number;
  netAssessed: number;
  outstandingBalance: number;
  isVerified: boolean;
  verificationMethod: string | null;
  verifiedBy: { firstName: string; lastName: string } | null;
  verifiedAt: string | null;
}

export interface ActivityLogEntry {
  timestamp: string;
  action: string;
  description: string;
  actor: string;
}
```

---

## File Structure

### New Files

```
backend/src/
├── controllers/
│   └── admin-applicant.controller.ts
├── services/
│   └── admin-applicant.service.ts
├── repositories/
│   └── admin-applicant.repository.ts
└── routes/
    └── admin-applicant.routes.ts

frontend/src/app/(portal)/admin/users/applicants/
├── page.tsx                              # REWRITE
└── [id]/
    └── page.tsx                          # NEW
```

### Modified Files

```
backend/src/routes/
└── index.ts                              # ADD admin-applicant routes

frontend/src/types/
└── index.ts                              # ADD new interfaces
```

---

## Implementation Order

| Phase | Task | Dependencies |
|-------|------|--------------|
| 1 | Backend: Repository | Prisma schema |
| 2 | Backend: Service | Repository |
| 3 | Backend: Controller | Service |
| 4 | Backend: Routes | Controller, middleware |
| 5 | Backend: Wire routes in index.ts | Routes |
| 6 | Frontend: Types | None |
| 7 | Frontend: List page (table) | Backend API |
| 8 | Frontend: Detail page | Backend API |
| 9 | Frontend: Action handlers | Backend API |

---

## Testing Checklist

| Test | Expected Result |
|------|-----------------|
| Load applicant list | Shows real data from database |
| Search applicants | Filters by name, email, Pinnacle ID |
| Filter by alignment | Shows only matching applicants |
| Filter by exam status | Shows only matching applicants |
| Click View | Navigates to detail page |
| Validate waiver | Updates status, shows success toast |
| Reject waiver | Opens modal, updates status |
| Verify COR | Opens modal, updates status |
| Promote to student | Shows confirmation, dispatches credentials |
| Reset strikes | Updates count to 0 |

---

## UI/UX Compliance

This design follows the specifications from:
- **EARIST GS UI/UX Design Documentation v8** — Applicant Management section
- **EARIST GS Schema Documentation v8** — Student, Exam, COR, Waiver models
- **GS System Workflow Revised 6-3-26** — Phase 2 Entrance Examination

---

*End of Spec*
