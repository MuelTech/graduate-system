# Exam Applications Page Enhancement — Design Spec

**Date:** 2026-07-19
**Status:** Approved
**Author:** MiMo Code Agent

---

## Overview

Enhance the Exam Applications page to be fully functional with proper API integration, toast notifications, and consistent code patterns. The page focuses on exam-specific operations (slots, scores, status) and does NOT duplicate functionality from the Applicants page.

---

## Workflow Reference (Phase 2)

From `GS_System_Workflow_Revised-6-3-26_Updated.docx`:

| Step | What Happens | Admin Action |
|------|--------------|--------------|
| 1 | Applicant registers | None |
| 2 | Program Alignment Check | None (automatic) |
| 3 | Applicant selects exam slot | **None** (applicant does this) |
| 4 | Slot is locked | None (automatic) |
| 5 | Applicant takes exam | None |
| 6 | System auto-grades MCQ | None (automatic) |
| 7 | Admin reviews scores | **Review & Validate** (on Scores page) |
| 8 | Email notification sent | None (automatic) |

**Key Insight:** Admin does NOT approve applications. The applicant chooses their own schedule. Once they select a slot, it's automatically confirmed.

---

## Page Focus

| Page | Focus | Unique Features |
|------|-------|-----------------|
| **Applicants** | Full applicant journey | Alignment, Waiver, COR, Promote |
| **Exam Applications** | Exam-specific operations | Slots, Scores, Status |

---

## Current State Analysis

### What Exists (Working)
- Summary cards (Pending, Confirmed, Completed, Disqualified)
- Data table with columns
- Search and filter
- View Details modal
- Reset Strikes action
- Disqualify action
- Pagination

### What's Missing
- Toast notifications for user feedback
- Consistent API client usage (currently uses raw fetch)
- TanStack Query pattern (currently uses useEffect + useState)
- View Scores action (link to scores page)

---

## Design: Enhanced Exam Applications Page

### Table Columns

| # | Column | Width | Source |
|---|--------|-------|--------|
| 1 | Applicant | auto | `firstName` + `lastName` + `email` |
| 2 | Pinnacle ID | 150px | `pinnacleApplicantId` |
| 3 | Program | auto | `program.programName` |
| 4 | Scheduled Slot | 150px | `examSlot.examDate` + `examTime` |
| 5 | Status | 120px | Badge (Pending/Scheduled/Completed/Passed/Failed) |
| 6 | Actions | 120px | View Details, View Scores |

### Actions

| Action | Icon | Condition | Behavior |
|--------|------|-----------|----------|
| **View Details** | Eye | Always | Opens modal with full application info |
| **View Scores** | Clipboard | `status === "passed"` or `status === "failed"` | Links to `/admin/exam/scores` |

### View Details Modal

| Section | Content |
|---------|---------|
| **Applicant Info** | Name, Email, Pinnacle ID, Program |
| **Exam Details** | Scheduled Slot, Status |

### Filters

| Filter | Options |
|--------|---------|
| **Status** | All, Pending, Confirmed, Completed, Disqualified |
| **Search** | Name, Email, Pinnacle ID |

---

## Backend Changes

### Schema Changes

| Change | Reason |
|--------|--------|
| Remove `strikeCount` | Not needed - one attempt per period |
| Remove `applicationDate` | Handled by Pinnacle |

### Existing Endpoints (No Changes Needed)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/exam/applications` | Get all applications |

### Removed Endpoints

| Method | Endpoint | Reason |
|--------|----------|--------|
| `PATCH` | `/api/exam/applications/:id/reset-strikes` | No longer needed |
| `PATCH` | `/api/exam/applications/:id/disqualify` | No longer needed |

### No New Endpoints Needed

The workflow shows admin does NOT approve applications. The applicant selects their own schedule, which automatically confirms the application.

---

## Frontend Changes

### 1. Replace Raw Fetch with apiClientRequest

**Before:**
```typescript
const res = await fetch("http://localhost:5000/api/exam/applications", {
  headers: { Authorization: `Bearer ${session?.user?.accessToken}` },
});
```

**After:**
```typescript
const res = await apiClientRequest("/exam/applications");
```

### 2. Add Toast Notifications

```typescript
import { toast } from "sonner";

// On success
toast.success("Strike count reset successfully");

// On error
toast.error("Failed to reset strikes");
```

### 3. Add View Scores Action

```typescript
import { Clipboard } from "lucide-react";
import Link from "next/link";

// In table actions
<Link href="/admin/exam/scores">
  <Button variant="ghost" size="icon">
    <Clipboard className="h-4 w-4" />
  </Button>
</Link>
```

### 4. Consistent Auth Header

**Before:**
```typescript
// Inconsistent - some use session, some use localStorage
Authorization: `Bearer ${localStorage.getItem("accessToken")}`
```

**After:**
```typescript
// Always use apiClientRequest which handles auth
const result = await apiClientRequest("/exam/applications/123/reset-strikes", {
  method: "PATCH",
});
```

---

## File Structure

### Modified Files

| File | Changes |
|------|---------|
| `frontend/src/app/(portal)/admin/exam/applications/page.tsx` | Rewrite with apiClientRequest, toast, View Scores action |

---

## Implementation Order

| Phase | Task |
|-------|------|
| 1 | Update frontend types (if needed) |
| 2 | Rewrite page with apiClientRequest and TanStack Query |
| 3 | Add toast notifications |
| 4 | Add View Scores action |
| 5 | Test all flows |

---

## Testing Checklist

| Test | Expected Result |
|------|-----------------|
| Load applications | Table shows real data from API |
| Search by name | Filters correctly |
| Filter by status | Shows correct applications |
| View Details modal | Shows full application info |
| View Scores link | Navigates to scores page |
| Pagination | Works with filtered results |

---

*End of Spec*
