# Admin Students Management — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Admin Student Management page with live API integration, replacing mock data with real student information and comprehensive exam management.

**Architecture:** Backend follows 3-layer pattern (Controller → Service → Repository). Frontend uses Next.js App Router with TanStack Query for data fetching. Single "View" action opens comprehensive detail page.

**Tech Stack:** Express.js 5, Prisma 7, MariaDB, Next.js 16, shadcn/ui, TanStack Query 5, lucide-react

## Global Constraints

- Backend: Express.js 5, TypeScript, 3-layer architecture (Controller → Service → Repository)
- Frontend: Next.js 16 App Router, TypeScript, shadcn/ui, TanStack Query
- Database: MariaDB via Prisma ORM, UUID primary keys, snake_case columns with `@map()`
- Auth: JWT middleware `authenticateJWT` + `requireRole(["ADMIN"])`
- Styling: EARIST brand colors via `--earist-*` CSS variables
- File naming: kebab-case for backend, kebab-case for frontend components

---

## File Structure

### New Files (Backend)

| File | Purpose |
|------|---------|
| `backend/src/repositories/admin-student.repository.ts` | Data access for admin student operations |
| `backend/src/services/admin-student.service.ts` | Business logic for student management |
| `backend/src/controllers/admin-student.controller.ts` | Request handlers |
| `backend/src/routes/admin-student.routes.ts` | Route definitions |

### New Files (Frontend)

| File | Purpose |
|------|---------|
| `frontend/src/app/(portal)/admin/users/students/[id]/page.tsx` | Student detail page |

### Modified Files

| File | Changes |
|------|---------|
| `backend/src/routes/index.ts` | Import and mount admin-student routes |
| `frontend/src/app/(portal)/admin/users/students/page.tsx` | Rewrite with API integration |
| `frontend/src/types/index.ts` | Add AdminStudentListItem, AdminStudentDetail interfaces |

---

## Task 1: Backend Repository

**Files:**
- Create: `backend/src/repositories/admin-student.repository.ts`

**Interfaces:**
- Consumes: Prisma client, AdminStudentListQuery interface
- Produces: findStudents, findStudentById, updateCompExamStatus, countStudents

- [ ] **Step 1: Create repository file**

```typescript
// backend/src/repositories/admin-student.repository.ts

import prisma from "../config/database";
import { Prisma } from "@prisma/client";

export interface AdminStudentListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  program?: string;
  thesisStage?: string;
  status?: string;
}

export class AdminStudentRepository {
  async countStudents(filters: AdminStudentListQuery): Promise<number> {
    const where = this.buildWhereClause(filters);
    return prisma.student.count({ where });
  }

  async findStudents(filters: AdminStudentListQuery) {
    const where = this.buildWhereClause(filters);
    const page = filters.page || 1;
    const pageSize = filters.pageSize || 10;
    const skip = (page - 1) * pageSize;

    const students = await prisma.student.findMany({
      where,
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        program: {
          select: {
            id: true,
            programName: true,
          },
        },
        thesisRecords: {
          select: {
            stage: true,
            status: true,
          },
          take: 1,
          orderBy: { createdAt: "desc" },
        },
        compExamRecords: {
          select: {
            status: true,
          },
          orderBy: { createdAt: "desc" },
        },
        adviserAssignments: {
          where: { isActive: true },
          select: {
            adviser: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    });

    return students.map((student) => {
      const thesis = student.thesisRecords[0];
      const compExam = student.compExamRecords[0];
      const adviser = student.adviserAssignments[0]?.adviser;

      return {
        id: student.id,
        firstName: student.user.firstName,
        lastName: student.user.lastName,
        email: student.user.email,
        studentNumber: student.studentNumber || "N/A",
        program: student.program,
        thesisStage: thesis?.stage || "NONE",
        thesisStatus: thesis?.status || "NONE",
        compExamStatus: compExam?.status || "PENDING",
        compExamStrikes: student.compExamRecords.filter((r) => r.status === "FAILED").length,
        adviser: adviser ? `${adviser.firstName} ${adviser.lastName}` : "None",
        admissionStatus: student.admissionStatus,
        enrollmentDate: student.enrollmentDate?.toISOString() || null,
      };
    });
  }

  async findStudentById(studentId: string) {
    return prisma.student.findUnique({
      where: { id: studentId },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        program: {
          select: {
            id: true,
            programName: true,
          },
        },
        thesisRecords: {
          select: {
            stage: true,
            status: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        compExamRecords: {
          select: {
            status: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
        adviserAssignments: {
          where: { isActive: true },
          select: {
            adviser: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
            assignedDate: true,
          },
          take: 1,
        },
        residencyTracking: {
          select: {
            startDate: true,
            maxYears: true,
          },
        },
      },
    });
  }

  async updateCompExamStatus(studentId: string, status: "PENDING" | "PASSED" | "FAILED") {
    // Find the latest comp exam record or create a new one
    const latestRecord = await prisma.compExamRecord.findFirst({
      where: { studentId },
      orderBy: { createdAt: "desc" },
    });

    if (latestRecord) {
      return prisma.compExamRecord.update({
        where: { id: latestRecord.id },
        data: { status },
      });
    } else {
      return prisma.compExamRecord.create({
        data: {
          studentId,
          status,
        },
      });
    }
  }

  private buildWhereClause(filters: AdminStudentListQuery): Prisma.StudentWhereInput {
    const where: Prisma.StudentWhereInput = {
      admissionStatus: "ENROLLED",
    };

    if (filters.search) {
      where.OR = [
        { user: { firstName: { contains: filters.search } } },
        { user: { lastName: { contains: filters.search } } },
        { user: { email: { contains: filters.search } } },
        { studentNumber: { contains: filters.search } },
      ];
    }

    if (filters.program) {
      where.programId = filters.program;
    }

    if (filters.status) {
      where.admissionStatus = filters.status as any;
    }

    return where;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/repositories/admin-student.repository.ts
git commit -m "feat(backend): add admin student repository"
```

---

## Task 2: Backend Service

**Files:**
- Create: `backend/src/services/admin-student.service.ts`

**Interfaces:**
- Consumes: AdminStudentRepository
- Produces: listStudents, getStudentDetail, updateCompExamStatus

- [ ] **Step 1: Create service file**

```typescript
// backend/src/services/admin-student.service.ts

import { AdminStudentRepository, AdminStudentListQuery } from "../repositories/admin-student.repository";
import { AppError } from "../utils/AppError";

export class AdminStudentService {
  private repository = new AdminStudentRepository();

  async listStudents(query: AdminStudentListQuery) {
    const page = query.page || 1;
    const pageSize = query.pageSize || 10;

    const [students, total] = await Promise.all([
      this.repository.findStudents(query),
      this.repository.countStudents(query),
    ]);

    return { students, total, page, pageSize };
  }

  async getStudentDetail(id: string) {
    const student = await this.repository.findStudentById(id);
    if (!student) {
      throw new AppError("Student not found!", 404);
    }
    return student;
  }

  async updateCompExamStatus(studentId: string, status: "PENDING" | "PASSED" | "FAILED") {
    const student = await this.repository.findStudentById(studentId);
    if (!student) {
      throw new AppError("Student not found!", 404);
    }

    // Check if student is already dismissed (2 strikes)
    const strikeCount = student.compExamRecords.filter((r) => r.status === "FAILED").length;
    if (strikeCount >= 2 && status === "FAILED") {
      throw new AppError("Student has reached maximum attempts (2 strikes). Cannot record another failure.", 400);
    }

    return this.repository.updateCompExamStatus(studentId, status);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/services/admin-student.service.ts
git commit -m "feat(backend): add admin student service"
```

---

## Task 3: Backend Controller

**Files:**
- Create: `backend/src/controllers/admin-student.controller.ts`

**Interfaces:**
- Consumes: AdminStudentService
- Produces: listStudents, getStudentDetail, updateCompExamStatus

- [ ] **Step 1: Create controller file**

```typescript
// backend/src/controllers/admin-student.controller.ts

import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { AdminStudentService } from "../services/admin-student.service";
import { AppError } from "../utils/AppError";

export class AdminStudentController {
  private service = new AdminStudentService();

  listStudents = async (req: Request, res: Response): Promise<void> => {
    try {
      const query = {
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string) : 10,
        search: (req.query.search as string) || "",
        program: (req.query.program as string) || "",
        thesisStage: (req.query.thesisStage as string) || "",
        status: (req.query.status as string) || "",
      };
      const result = await this.service.listStudents(query);
      res.status(200).json(result);
    } catch (error: unknown) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({ error: error.message });
      } else if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: "An unexpected error occurred." });
      }
    }
  };

  getStudentDetail = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const result = await this.service.getStudentDetail(id);
      res.status(200).json(result);
    } catch (error: unknown) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({ error: error.message });
      } else if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: "An unexpected error occurred." });
      }
    }
  };

  updateCompExamStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const { status } = req.body;

      if (!status || !["PENDING", "PASSED", "FAILED"].includes(status)) {
        throw new AppError("Invalid status. Must be PENDING, PASSED, or FAILED.", 400);
      }

      const result = await this.service.updateCompExamStatus(id, status);
      res.status(200).json({ message: "Comprehensive exam status updated.", result });
    } catch (error: unknown) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({ error: error.message });
      } else if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: "An unexpected error occurred." });
      }
    }
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/controllers/admin-student.controller.ts
git commit -m "feat(backend): add admin student controller"
```

---

## Task 4: Backend Routes

**Files:**
- Create: `backend/src/routes/admin-student.routes.ts`
- Modify: `backend/src/routes/index.ts`

**Interfaces:**
- Consumes: AdminStudentController
- Produces: Mounted routes

- [ ] **Step 1: Create routes file**

```typescript
// backend/src/routes/admin-student.routes.ts

import { Router } from "express";
import { AdminStudentController } from "../controllers/admin-student.controller";
import { authenticateJWT, requireRole } from "../middlewares/auth.middleware";

const router = Router();
const controller = new AdminStudentController();

// List all students
router.get(
  "/",
  authenticateJWT,
  requireRole(["ADMIN"]),
  controller.listStudents
);

// Get student detail
router.get(
  "/:id",
  authenticateJWT,
  requireRole(["ADMIN"]),
  controller.getStudentDetail
);

// Update comprehensive exam status
router.put(
  "/:id/comprehensive-exam",
  authenticateJWT,
  requireRole(["ADMIN"]),
  controller.updateCompExamStatus
);

export default router;
```

- [ ] **Step 2: Add routes to index.ts**

```typescript
// Add to backend/src/routes/index.ts

import adminStudentRoutes from "./admin-student.routes";

// Mount the route
app.use("/api/admin/students", adminStudentRoutes);
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/admin-student.routes.ts backend/src/routes/index.ts
git commit -m "feat(backend): add admin student routes"
```

---

## Task 5: Frontend Types

**Files:**
- Modify: `frontend/src/types/index.ts`

**Interfaces:**
- Consumes: None
- Produces: AdminStudentListItem, AdminStudentDetail

- [ ] **Step 1: Add interfaces to types file**

```typescript
// Add to frontend/src/types/index.ts

// ADMIN STUDENT INTERFACES
export interface AdminStudentListItem {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  studentNumber: string;
  program: { id: string; programName: string };
  thesisStage: string;
  thesisStatus: string;
  compExamStatus: string;
  compExamStrikes: number;
  adviser: string;
  admissionStatus: string;
  enrollmentDate: string | null;
}

export interface AdminStudentDetail extends AdminStudentListItem {
  cellphone: string;
  dateOfBirth: string;
  curriculumType: string;
  alignmentStatus: string;
  residencyStartDate: string | null;
  residencyMaxYears: number | null;
  compExamRecords: { status: string; createdAt: string }[];
  adviserAssignment: { adviser: { firstName: string; lastName: string }; assignedDate: string } | null;
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/types/index.ts
git commit -m "feat(frontend): add admin student types"
```

---

## Task 6: Frontend Students List Page

**Files:**
- Rewrite: `frontend/src/app/(portal)/admin/users/students/page.tsx`

**Interfaces:**
- Consumes: AdminStudentListItem, apiClientRequest
- Produces: List view with search, filters, pagination

- [ ] **Step 1: Rewrite students page with API integration**

The page should:
1. Use `apiClientRequest` to fetch from `/admin/students`
2. Display summary cards (Total, Active, Graduated, No Adviser)
3. Search by name, student number, email
4. Filter by program and thesis stage
5. Table with columns: Student, Program, Thesis Stage, Comp Exam, Adviser, Status
6. View action that navigates to `/admin/users/students/[id]`
7. Client-side pagination (10 per page)

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/(portal)/admin/users/students/page.tsx
git commit -m "feat(frontend): rewrite students list page with API integration"
```

---

## Task 7: Frontend Student Detail Page

**Files:**
- Create: `frontend/src/app/(portal)/admin/users/students/[id]/page.tsx`

**Interfaces:**
- Consumes: AdminStudentDetail, apiClientRequest
- Produces: Detail view with Profile, Comp Exam, Thesis Progress, Academic Info

- [ ] **Step 1: Create student detail page**

The page should:
1. Fetch student data from `/admin/students/:id`
2. Display Profile section (name, student number, email, program, enrollment date, status)
3. Display Comprehensive Exam section (status badge, strike count, mark as Passed/Failed buttons)
4. Display Thesis Progress section (current stage, status, adviser)
5. Display Academic Info section (residency, curriculum type, alignment status)
6. Use `useMutation` for comp exam status updates
7. Show toast notifications on success/error

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/(portal)/admin/users/students/[id]/page.tsx
git commit -m "feat(frontend): create student detail page"
```

---

## Task 8: Testing

- [ ] **Step 1: Test list page**
  - Load students page
  - Verify real data displays
  - Test search functionality
  - Test filters
  - Test pagination

- [ ] **Step 2: Test detail page**
  - Click View on a student
  - Verify all sections display correctly
  - Test comp exam status update (mark as Passed)
  - Test comp exam status update (mark as Failed)
  - Verify toast notifications

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix: integration testing fixes"
```

---

## Task 9: Push to Remote

- [ ] **Step 1: Push branch**

```bash
git push -u origin feature/admin-students-management
```

- [ ] **Step 2: Create Pull Request**

```bash
gh pr create --title "feat: admin students management" --body "Implements admin student list and detail page with comprehensive exam management."
```

---

*End of Plan*
