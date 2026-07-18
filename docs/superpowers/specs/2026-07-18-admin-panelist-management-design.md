# Admin Panelist Management — Design Spec

**Date:** 2026-07-18
**Status:** Approved
**Author:** MiMo Code Agent

---

## Overview

Enhance the existing Admin Panelist Management page with additional fields (Title, Suffix), dropdown menus for standardized data, View/Edit modals, and default password generation. The backend API and basic CRUD are already implemented — this design adds missing UI features and field enhancements.

---

## Goals

1. Add Title and Suffix fields to panelist registration
2. Implement dropdown menus for Qualification, Affiliation, and Specialization
3. Auto-generate default password (LASTNAME uppercase) for new panelists
4. Implement View modal showing full profile and creation logs
5. Implement Edit modal with password change and account status toggle
6. Follow existing codebase patterns (3-layer architecture, shadcn/ui, TanStack Query)

---

## Scope

| In Scope | Out of Scope |
|----------|--------------|
| Add Title/Suffix fields to schema | Panelist self-service profile page |
| Add dropdown options for fields | Defense assignment features |
| View modal with creation logs | Bulk import/export |
| Edit modal with password change | Password reset email |
| Account activation/deactivation | Login history tracking |

---

## Existing Implementation (No Changes Needed)

| Component | File | Status |
|-----------|------|--------|
| Backend Routes | `panelist.routes.ts` | ✅ Complete |
| Backend Controller | `panelist.controller.ts` | ✅ Complete |
| Backend Service | `panelist.service.ts` | ✅ Complete |
| Backend Repository | `panelist.repository.ts` | ✅ Complete |
| Frontend List Page | `admin/users/panelists/page.tsx` | ✅ Functional (basic) |

---

## Schema Changes

### User Model Additions

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `title` | String? | null | Dr., Prof., Mr., Ms., Mrs., Engr., Atty. |
| `suffix` | String? | null | Jr., Sr., II, III, IV |

### Panelist Model (No Changes)

Current fields are sufficient:
- `highestEducationalAttainment` → renamed to "Qualification" in UI
- `officeAffiliation` → renamed to "Affiliation" in UI
- `specialization` → kept as-is

---

## Dropdown Options

### Title
```
Dr., Prof., Mr., Ms., Mrs., Engr., Atty.
```

### Suffix
```
Jr., Sr., II, III, IV, None
```

### Highest Educational Attainment (Qualification)
```
Doctorate Degree
Master's Degree
Bachelor's Degree
```

### Office Affiliation (Affiliation)
```
College of Education
College of Business Administration
College of Arts and Sciences
College of Engineering
College of Computer and Information Sciences
College of Public Administration
External / Other
```

### Specialization
```
Education Management
Business Administration
Information Technology
Computer Science
Engineering
Arts and Sciences
Guidance and Counseling
Public Administration
Other
```

---

## API Changes

### Update User Model

| Endpoint | Change |
|----------|--------|
| `POST /api/panelists` | Accept `title`, `suffix` in request body |
| `PUT /api/panelists/:id` | Accept `title`, `suffix`, `password` (optional) in request body |

### Request/Response Schemas

**POST /api/panelists (Create)**
```json
{
  "email": "panelist4@earist.edu.ph",
  "firstName": "Juan",
  "lastName: "Dela Cruz",
  "title": "Dr.",
  "suffix": "Jr.",
  "highestEducationalAttainment": "Doctorate Degree",
  "officeAffiliation": "College of Education",
  "specialization": "Education Management",
  "isExternal": false
}
```

**Response:**
```json
{
  "id": "uuid",
  "user": {
    "firstName": "Juan",
    "lastName": "Dela Cruz",
    "email": "panelist4@earist.edu.ph",
    "title": "Dr.",
    "suffix": "Jr."
  },
  "highestEducationalAttainment": "Doctorate Degree",
  "officeAffiliation": "College of Education",
  "specialization": "Education Management",
  "isExternal": false,
  "isAvailableAsAdviser": true,
  "isActive": true,
  "createdAt": "2026-07-18T10:00:00Z"
}
```

**PUT /api/panelists/:id (Update)**
```json
{
  "firstName": "Juan",
  "lastName": "Dela Cruz",
  "title": "Prof.",
  "suffix": "Sr.",
  "highestEducationalAttainment": "Doctorate Degree",
  "officeAffiliation": "College of Education",
  "specialization": "Education Management",
  "isExternal": false,
  "isAvailableAsAdviser": true,
  "isActive": true,
  "password": "NEWPASSWORD123"  // optional - only if changing
}
```

---

## Frontend Components

### 1. Create Panelist Modal

| Field | Input Type | Required |
|-------|------------|----------|
| Title | Select dropdown | Yes |
| First Name | Input text | Yes |
| Last Name | Input text | Yes |
| Suffix | Select dropdown | No |
| Email | Input email | Yes |
| Qualification | Select dropdown | Yes |
| Affiliation | Select dropdown | Yes |
| Specialization | Select dropdown | Yes |
| Is External | Checkbox | Yes |

**Behavior:**
- No password field — auto-generated as `lastName.toUpperCase()`
- On success: show toast with default password, refresh table

### 2. Edit Panelist Modal

| Field | Input Type | Required |
|-------|------------|----------|
| Title | Select dropdown | Yes |
| First Name | Input text | Yes |
| Last Name | Input text | Yes |
| Suffix | Select dropdown | No |
| Email | Input email | Yes |
| Qualification | Select dropdown | Yes |
| Affiliation | Select dropdown | Yes |
| Specialization | Select dropdown | Yes |
| Is External | Checkbox | Yes |
| Is Available as Adviser | Switch | Yes |
| Account Status (Active) | Switch | Yes |
| New Password | Input password | No (only if changing) |

**Behavior:**
- Password field only shown when admin wants to reset password
- On success: show toast, refresh table

### 3. View Panelist Modal

| Section | Content |
|---------|---------|
| **Header** | Title + Full Name + Suffix + Email |
| **Professional** | Qualification, Affiliation, Specialization |
| **Status Badges** | External (badge), Adviser Available (badge), Active (badge) |
| **Account Info** | Created At (formatted date), Created By (admin name) |
| **Activity** | Defenses Assigned count |

**Behavior:**
- Read-only display
- Close button only

---

## Table Columns (Updated)

| # | Column | Width | Source |
|---|--------|-------|--------|
| 1 | Name | auto | `title` + `firstName` + `lastName` + `suffix` |
| 2 | Email | auto | `user.email` |
| 3 | Qualification | auto | `highestEducationalAttainment` |
| 4 | Affiliation | auto | `officeAffiliation` |
| 5 | Type | 100px | `isExternal` badge |
| 6 | Status | 100px | `isActive` badge |
| 7 | Actions | 120px | View, Edit, Toggle Active |

---

## File Structure

### Modified Files

| File | Changes |
|------|---------|
| `backend/prisma/schema.prisma` | Add `title`, `suffix` to User model |
| `backend/src/controllers/panelist.controller.ts` | Pass title/suffix to service |
| `backend/src/services/panelist.service.ts` | Handle title/suffix, password reset |
| `backend/src/repositories/panelist.repository.ts` | Include title/suffix in queries |
| `frontend/src/types/index.ts` | Update PanelistResponse interface |
| `frontend/src/app/(portal)/admin/users/panelists/page.tsx` | Add modals, dropdowns, updated table |

### New Files

None — all changes are modifications to existing files.

---

## Implementation Order

| Phase | Task |
|-------|------|
| 1 | Schema migration (add title, suffix to User) |
| 2 | Backend updates (repository, service, controller) |
| 3 | Frontend types update |
| 4 | Create Panelist Modal with dropdowns |
| 5 | Edit Panelist Modal with password reset |
| 6 | View Panelist Modal with creation logs |
| 7 | Table updates (columns, actions) |
| 8 | Test all flows |

---

## Testing Checklist

| Test | Expected Result |
|------|-----------------|
| Create panelist with all fields | Panelist created, default password shown |
| Create panelist without suffix | Panelist created successfully |
| View panelist | Modal shows all info + creation details |
| Edit panelist info | Changes saved, table refreshes |
| Edit panelist password | Password updated, toast confirms |
| Deactivate panelist | Status changes to inactive |
| Activate panelist | Status changes to active |
| Search by name | Filters correctly |
| Filter by type | Shows correct panelists |
| Pagination | Works with filtered results |

---

*End of Spec*
