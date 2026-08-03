# Admin Applicants Management — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Admin Applicant Management page with list view, detail page, and all backend APIs for applicant actions.

**Architecture:** Backend follows 3-layer pattern (Controller → Service → Repository). Frontend uses Next.js App Router with TanStack Query for data fetching. Single "View" action opens comprehensive detail page with contextual actions.

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
| `backend/src/repositories/admin-applicant.repository.ts` | Data access layer for admin applicant operations |
| `backend/src/services/admin-applicant.service.ts` | Business logic for applicant management |
| `backend/src/controllers/admin-applicant.controller.ts` | Request handlers for admin applicant endpoints |
| `backend/src/routes/admin-applicant.routes.ts` | Route definitions |

### New Files (Frontend)

| File | Purpose |
|------|---------|
| `frontend/src/app/(portal)/admin/users/applicants/[id]/page.tsx` | Applicant detail page |

### Modified Files

| File | Changes |
|------|---------|
| `backend/src/routes/index.ts` | Import and use admin-applicant routes |
| `frontend/src/app/(portal)/admin/users/applicants/page.tsx` | Rewrite with live API |
| `frontend/src/types/index.ts` | Add AdminApplicantListItem, AdminApplicantDetail interfaces |

---

## Task 1: Backend Types and Interfaces

**Files:**
- Create: `backend/src/interfaces/admin-applicant.interfaces.ts`

**Interfaces:**
- Consumes: Prisma types from `@prisma/client`
- Produces: Types used by repository, service, and controller

- [ ] **Step 1: Create interfaces file**

```typescript
// backend/src/interfaces/admin-applicant.interfaces.ts

export interface AdminApplicantListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  alignment?: string;
  exam?: string;
  cor?: string;
  status?: string;
}

export interface AdminApplicantListResponse {
  applicants: AdminApplicantListItem[];
  total: number;
  page: number;
  pageSize: number;
}

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

export interface RejectWaiverInput {
  adminNotes: string;
}

export interface VerifyCorInput {
  verificationMethod: "manual" | "qr_auto" | "ocr_auto";
}

export interface RejectCorInput {
  reason: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/interfaces/admin-applicant.interfaces.ts
git commit -m "feat(backend): add admin applicant interfaces"
```

---

## Task 2: Backend Repository

**Files:**
- Create: `backend/src/repositories/admin-applicant.repository.ts`

**Interfaces:**
- Consumes: Types from `admin-applicant.interfaces.ts`, Prisma client
- Produces: Methods used by service layer

- [ ] **Step 1: Create repository file**

```typescript
// backend/src/repositories/admin-applicant.repository.ts

import prisma from "../config/database";
import { Prisma } from "@prisma/client";
import { AdminApplicantListQuery } from "../interfaces/admin-applicant.interfaces";

export class AdminApplicantRepository {
  async countApplicants(filters: AdminApplicantListQuery): Promise<number> {
    const where = this.buildWhereClause(filters);
    return prisma.student.count({ where });
  }

  async findApplicants(filters: AdminApplicantListQuery) {
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
        examApplications: {
          include: {
            examScores: {
              select: {
                multipleChoiceScore: true,
                essayScore: true,
                totalScore: true,
              },
            },
            examSlot: {
              select: {
                examDate: true,
                examTime: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        corUploads: {
          include: {
            corRecord: {
              select: {
                isVerified: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    });

    return students.map((student) => {
      const examApp = student.examApplications[0];
      const corUpload = student.corUploads[0];

      let examStatus = "NOT_SCHEDULED";
      if (examApp) {
        examStatus = examApp.status;
      }

      let corStatus = "NONE";
      if (corUpload) {
        corStatus = corUpload.corRecord?.isVerified ? "VERIFIED" : "PENDING";
      }

      return {
        id: student.id,
        firstName: student.user.firstName,
        lastName: student.user.lastName,
        email: student.user.email,
        pinnacleApplicantId: student.pinnacleApplicantId || "",
        program: student.program,
        alignmentStatus: student.alignmentStatus || "ALIGNED",
        examStatus,
        examScores: examApp?.examScores
          ? {
              mcq: examApp.examScores.multipleChoiceScore,
              essay: examApp.examScores.essayScore,
              total: examApp.examScores.totalScore,
            }
          : null,
        corStatus,
        admissionStatus: student.admissionStatus,
        strikeCount: student.strikeCount || 0,
        createdAt: student.createdAt.toISOString(),
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
        bridgingWaiver: {
          include: {
            validatedByUser: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        examApplications: {
          include: {
            examScores: true,
            examSlot: true,
          },
          orderBy: { createdAt: "desc" },
        },
        corUploads: {
          include: {
            corRecord: {
              include: {
                verifiedByUser: {
                  select: {
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });
  }

  async findActivityLog(studentId: string) {
    const logs = await prisma.auditLog.findMany({
      where: { targetId: studentId },
      include: {
        actor: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return logs.map((log) => ({
      timestamp: log.createdAt.toISOString(),
      action: log.actionType,
      description: log.description || log.actionType,
      actor: log.actor
        ? `${log.actor.firstName} ${log.actor.lastName}`
        : "System",
    }));
  }

  async updateAlignmentStatus(studentId: string, status: string) {
    return prisma.student.update({
      where: { id: studentId },
      data: { alignmentStatus: status as any },
    });
  }

  async updateWaiverStatus(
    waiverId: string,
    status: string,
    validatedBy?: string,
    adminNotes?: string
  ) {
    return prisma.applicantBridgingWaiver.update({
      where: { id: waiverId },
      data: {
        status: status as any,
        validatedBy: validatedBy || null,
        validatedAt: status === "validated" ? new Date() : null,
        adminNotes: adminNotes || null,
      },
    });
  }

  async updateCorVerification(
    corRecordId: string,
    verified: boolean,
    verificationMethod?: string,
    verifiedBy?: string
  ) {
    return prisma.corRecord.update({
      where: { id: corRecordId },
      data: {
        isVerified: verified,
        verificationMethod: verificationMethod || null,
        verifiedBy: verifiedBy || null,
        verifiedAt: verified ? new Date() : null,
      },
    });
  }

  async promoteToStudent(studentId: string, studentNumber: string) {
    return prisma.$transaction(async (tx) => {
      await tx.student.update({
        where: { id: studentId },
        data: {
          admissionStatus: "ENROLLED",
          enrollmentDate: new Date(),
          studentNumber: studentNumber,
        },
      });

      await tx.user.update({
        where: {
          students: { some: { id: studentId } },
        },
        data: {
          role: "STUDENT",
        },
      });

      return { studentNumber };
    });
  }

  async resetStrikeCount(studentId: string) {
    return prisma.student.update({
      where: { id: studentId },
      data: { strikeCount: 0 },
    });
  }

  async createAuditLog(
    actorId: string | null,
    actionType: string,
    targetId: string,
    description: string,
    oldValue?: string,
    newValue?: string
  ) {
    return prisma.auditLog.create({
      data: {
        actorId,
        actionType,
        targetTable: "students",
        targetId,
        description,
        oldValue: oldValue || null,
        newValue: newValue || null,
      },
    });
  }

  private buildWhereClause(filters: AdminApplicantListQuery): Prisma.StudentWhereInput {
    const where: Prisma.StudentWhereInput = {
      user: { role: "APPLICANT" },
    };

    if (filters.search) {
      where.OR = [
        { user: { firstName: { contains: filters.search } } },
        { user: { lastName: { contains: filters.search } } },
        { user: { email: { contains: filters.search } } },
        { pinnacleApplicantId: { contains: filters.search } },
        { program: { programName: { contains: filters.search } } },
      ];
    }

    if (filters.alignment) {
      where.alignmentStatus = filters.alignment as any;
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
git add backend/src/repositories/admin-applicant.repository.ts
git commit -m "feat(backend): add admin applicant repository"
```

---

## Task 3: Backend Service

**Files:**
- Create: `backend/src/services/admin-applicant.service.ts`

**Interfaces:**
- Consumes: Repository methods, interfaces
- Produces: Methods used by controller

- [ ] **Step 1: Create service file**

```typescript
// backend/src/services/admin-applicant.service.ts

import { AdminApplicantRepository } from "../repositories/admin-applicant.repository";
import {
  AdminApplicantListQuery,
  AdminApplicantListResponse,
  AdminApplicantDetail,
  RejectWaiverInput,
  VerifyCorInput,
  RejectCorInput,
} from "../interfaces/admin-applicant.interfaces";
import { AppError } from "../utils/AppError";

export class AdminApplicantService {
  private repository = new AdminApplicantRepository();

  async listApplicants(
    query: AdminApplicantListQuery
  ): Promise<AdminApplicantListResponse> {
    const page = query.page || 1;
    const pageSize = query.pageSize || 10;

    const [applicants, total] = await Promise.all([
      this.repository.findApplicants(query),
      this.repository.countApplicants(query),
    ]);

    return { applicants, total, page, pageSize };
  }

  async getApplicantDetail(id: string): Promise<AdminApplicantDetail> {
    const student = await this.repository.findStudentById(id);
    if (!student) {
      throw new AppError("Applicant not found!", 404);
    }

    const activityLog = await this.repository.findActivityLog(id);

    const examApp = student.examApplications[0];
    const corUpload = student.corUploads[0];

    let examStatus = "NOT_SCHEDULED";
    if (examApp) {
      examStatus = examApp.status;
    }

    let corStatus = "NONE";
    if (corUpload) {
      corStatus = corUpload.corRecord?.isVerified ? "VERIFIED" : "PENDING";
    }

    return {
      id: student.id,
      firstName: student.user.firstName,
      lastName: student.user.lastName,
      email: student.user.email,
      pinnacleApplicantId: student.pinnacleApplicantId || "",
      cellphone: student.cellphone || "",
      dateOfBirth: student.dateOfBirth?.toISOString() || "",
      program: student.program,
      undergraduateCourse: student.undergraduateCourse || "",
      alignmentStatus: student.alignmentStatus || "ALIGNED",
      isProgramAligned: student.isProgramAligned || false,
      examStatus,
      examScores: examApp?.examScores
        ? {
            mcq: examApp.examScores.multipleChoiceScore,
            essay: examApp.examScores.essayScore,
            total: examApp.examScores.totalScore,
          }
        : null,
      corStatus,
      admissionStatus: student.admissionStatus,
      enrollmentDate: student.enrollmentDate?.toISOString() || null,
      strikeCount: student.strikeCount || 0,
      bridgingWaiver: student.bridgingWaiver
        ? {
            id: student.bridgingWaiver.id,
            status: student.bridgingWaiver.status,
            waiverFormDownloadedAt:
              student.bridgingWaiver.waiverFormDownloadedAt?.toISOString() || null,
            validatedBy: student.bridgingWaiver.validatedByUser,
            validatedAt:
              student.bridgingWaiver.validatedAt?.toISOString() || null,
            adminNotes: student.bridgingWaiver.adminNotes,
          }
        : null,
      examApplications: student.examApplications.map((app) => ({
        id: app.id,
        status: app.status,
        examSlot: app.examSlot
          ? {
              examDate: app.examSlot.examDate.toISOString(),
              examTime: app.examSlot.examTime,
              venueOrLink: app.examSlot.venueOrLink || "",
            }
          : null,
        examScores: app.examScores
          ? {
              multipleChoiceScore: app.examScores.multipleChoiceScore,
              essayScore: app.examScores.essayScore,
              totalScore: app.examScores.totalScore,
            }
          : null,
      })),
      corUploads: student.corUploads.map((upload) => ({
        id: upload.id,
        ocrStatus: upload.ocrStatus,
        filePath: upload.filePath,
        originalFilename: upload.originalFilename,
        uploadedAt: upload.uploadedAt.toISOString(),
        corRecord: upload.corRecord
          ? {
              registrationNumber: upload.corRecord.registrationNumber || "",
              academicYear: upload.corRecord.academicYear || "",
              semester: upload.corRecord.semester || "",
              extractedProgramName: upload.corRecord.extractedProgramName || "",
              extractedYearLevel: upload.corRecord.extractedYearLevel || "",
              totalAssessment: upload.corRecord.totalAssessment || 0,
              netAssessed: upload.corRecord.netAssessed || 0,
              outstandingBalance: upload.corRecord.outstandingBalance || 0,
              isVerified: upload.corRecord.isVerified,
              verificationMethod: upload.corRecord.verificationMethod,
              verifiedBy: upload.corRecord.verifiedByUser,
              verifiedAt: upload.corRecord.verifiedAt?.toISOString() || null,
            }
          : null,
      })),
      activityLog,
    };
  }

  async validateWaiver(
    studentId: string,
    adminId: string
  ): Promise<{ message: string; alignmentStatus: string }> {
    const student = await this.repository.findStudentById(studentId);
    if (!student) {
      throw new AppError("Applicant not found!", 404);
    }

    if (!student.bridgingWaiver) {
      throw new AppError("No pending waiver found!", 400);
    }

    if (student.bridgingWaiver.status !== "pending") {
      throw new AppError("Waiver is not in pending status!", 400);
    }

    await this.repository.updateWaiverStatus(
      student.bridgingWaiver.id,
      "validated",
      adminId
    );

    await this.repository.updateAlignmentStatus(studentId, "CLEARED");

    await this.repository.createAuditLog(
      adminId,
      "waiver_validated",
      studentId,
      "Bridging waiver validated"
    );

    return {
      message: "Waiver validated. Exam scheduling unlocked.",
      alignmentStatus: "CLEARED",
    };
  }

  async rejectWaiver(
    studentId: string,
    adminId: string,
    input: RejectWaiverInput
  ): Promise<{ message: string; alignmentStatus: string }> {
    const student = await this.repository.findStudentById(studentId);
    if (!student) {
      throw new AppError("Applicant not found!", 404);
    }

    if (!student.bridgingWaiver) {
      throw new AppError("No pending waiver found!", 400);
    }

    await this.repository.updateWaiverStatus(
      student.bridgingWaiver.id,
      "rejected",
      adminId,
      input.adminNotes
    );

    await this.repository.createAuditLog(
      adminId,
      "waiver_rejected",
      studentId,
      `Waiver rejected: ${input.adminNotes}`
    );

    return {
      message: "Waiver rejected.",
      alignmentStatus: "PENDING_WAIVER",
    };
  }

  async verifyCor(
    studentId: string,
    adminId: string,
    input: VerifyCorInput
  ): Promise<{ message: string; corStatus: string }> {
    const student = await this.repository.findStudentById(studentId);
    if (!student) {
      throw new AppError("Applicant not found!", 404);
    }

    const corUpload = student.corUploads[0];
    if (!corUpload) {
      throw new AppError("No COR upload found!", 400);
    }

    if (!corUpload.corRecord) {
      throw new AppError("No COR record found!", 400);
    }

    if (corUpload.corRecord.isVerified) {
      throw new AppError("COR is already verified!", 400);
    }

    await this.repository.updateCorVerification(
      corUpload.corRecord.id,
      true,
      input.verificationMethod,
      adminId
    );

    await this.repository.createAuditLog(
      adminId,
      "cor_verified",
      studentId,
      `COR verified via ${input.verificationMethod}`
    );

    return {
      message: "COR verified.",
      corStatus: "VERIFIED",
    };
  }

  async rejectCor(
    studentId: string,
    adminId: string,
    input: RejectCorInput
  ): Promise<{ message: string; corStatus: string }> {
    const student = await this.repository.findStudentById(studentId);
    if (!student) {
      throw new AppError("Applicant not found!", 404);
    }

    const corUpload = student.corUploads[0];
    if (!corUpload) {
      throw new AppError("No COR upload found!", 400);
    }

    await this.repository.createAuditLog(
      adminId,
      "cor_rejected",
      studentId,
      `COR rejected: ${input.reason}`
    );

    return {
      message: "COR rejected. Applicant notified.",
      corStatus: "PENDING",
    };
  }

  async promoteToStudent(
    studentId: string,
    adminId: string
  ): Promise<{ message: string; studentNumber: string; credentials: { username: string; password: string } }> {
    const student = await this.repository.findStudentById(studentId);
    if (!student) {
      throw new AppError("Applicant not found!", 404);
    }

    if (student.admissionStatus !== "APPLICANT") {
      throw new AppError("Applicant is not in applicant status!", 400);
    }

    const examApp = student.examApplications.find(
      (app) => app.status === "PASSED"
    );
    if (!examApp) {
      throw new AppError("Applicant has not passed the entrance exam!", 400);
    }

    const corUpload = student.corUploads[0];
    if (!corUpload?.corRecord?.isVerified) {
      throw new AppError("COR is not verified!", 400);
    }

    const studentNumber = corUpload.corRecord.registrationNumber || `STU-${Date.now()}`;

    const dob = student.dateOfBirth;
    const password = dob
      ? `${dob.getFullYear()}${String(dob.getMonth() + 1).padStart(2, "0")}${String(dob.getDate()).padStart(2, "0")}`
      : "password123";

    await this.repository.promoteToStudent(studentId, studentNumber);

    await this.repository.createAuditLog(
      adminId,
      "role_promoted",
      studentId,
      `Applicant promoted to Student. Student Number: ${studentNumber}`
    );

    return {
      message: "Applicant promoted to Student. Credentials dispatched.",
      studentNumber,
      credentials: {
        username: studentNumber,
        password,
      },
    };
  }

  async resetStrikes(
    studentId: string,
    adminId: string
  ): Promise<{ message: string; strikeCount: number }> {
    const student = await this.repository.findStudentById(studentId);
    if (!student) {
      throw new AppError("Applicant not found!", 404);
    }

    await this.repository.resetStrikeCount(studentId);

    await this.repository.createAuditLog(
      adminId,
      "strikes_reset",
      studentId,
      "Strike count reset to 0"
    );

    return {
      message: "Strike count reset.",
      strikeCount: 0,
    };
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/services/admin-applicant.service.ts
git commit -m "feat(backend): add admin applicant service"
```

---

## Task 4: Backend Controller

**Files:**
- Create: `backend/src/controllers/admin-applicant.controller.ts`

**Interfaces:**
- Consumes: Service methods
- Produces: Request handlers for routes

- [ ] **Step 1: Create controller file**

```typescript
// backend/src/controllers/admin-applicant.controller.ts

import { Request, Response } from "express";
import { AdminApplicantService } from "../services/admin-applicant.service";
import { AppError } from "../utils/AppError";

export class AdminApplicantController {
  private service = new AdminApplicantService();

  listApplicants = async (req: Request, res: Response): Promise<void> => {
    try {
      const query = {
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string) : 10,
        search: req.query.search as string || "",
        alignment: req.query.alignment as string || "",
        exam: req.query.exam as string || "",
        cor: req.query.cor as string || "",
        status: req.query.status as string || "",
      };

      const result = await this.service.listApplicants(query);
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

  getApplicantDetail = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const result = await this.service.getApplicantDetail(id);
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

  validateWaiver = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const adminId = (req as any).user.userId;
      const result = await this.service.validateWaiver(id, adminId);
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

  rejectWaiver = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const adminId = (req as any).user.userId;
      const { adminNotes } = req.body;

      if (!adminNotes) {
        throw new AppError("Admin notes are required for rejection!", 400);
      }

      const result = await this.service.rejectWaiver(id, adminId, { adminNotes });
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

  verifyCor = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const adminId = (req as any).user.userId;
      const { verificationMethod } = req.body;

      if (!verificationMethod) {
        throw new AppError("Verification method is required!", 400);
      }

      const result = await this.service.verifyCor(id, adminId, { verificationMethod });
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

  rejectCor = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const adminId = (req as any).user.userId;
      const { reason } = req.body;

      if (!reason) {
        throw new AppError("Reason is required for rejection!", 400);
      }

      const result = await this.service.rejectCor(id, adminId, { reason });
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

  promoteToStudent = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const adminId = (req as any).user.userId;
      const result = await this.service.promoteToStudent(id, adminId);
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

  resetStrikes = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const adminId = (req as any).user.userId;
      const result = await this.service.resetStrikes(id, adminId);
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
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/controllers/admin-applicant.controller.ts
git commit -m "feat(backend): add admin applicant controller"
```

---

## Task 5: Backend Routes

**Files:**
- Create: `backend/src/routes/admin-applicant.routes.ts`
- Modify: `backend/src/routes/index.ts`

**Interfaces:**
- Consumes: Controller methods, middleware
- Produces: Mounted routes

- [ ] **Step 1: Create routes file**

```typescript
// backend/src/routes/admin-applicant.routes.ts

import { Router } from "express";
import { AdminApplicantController } from "../controllers/admin-applicant.controller";
import { authenticateJWT, requireRole } from "../middlewares/auth.middleware";

const router = Router();
const controller = new AdminApplicantController();

// List all applicants
router.get(
  "/",
  authenticateJWT,
  requireRole(["ADMIN"]),
  controller.listApplicants
);

// Get applicant detail
router.get(
  "/:id",
  authenticateJWT,
  requireRole(["ADMIN"]),
  controller.getApplicantDetail
);

// Validate waiver
router.put(
  "/:id/waiver/validate",
  authenticateJWT,
  requireRole(["ADMIN"]),
  controller.validateWaiver
);

// Reject waiver
router.put(
  "/:id/waiver/reject",
  authenticateJWT,
  requireRole(["ADMIN"]),
  controller.rejectWaiver
);

// Verify COR
router.put(
  "/:id/cor/verify",
  authenticateJWT,
  requireRole(["ADMIN"]),
  controller.verifyCor
);

// Reject COR
router.put(
  "/:id/cor/reject",
  authenticateJWT,
  requireRole(["ADMIN"]),
  controller.rejectCor
);

// Promote to student
router.put(
  "/:id/promote",
  authenticateJWT,
  requireRole(["ADMIN"]),
  controller.promoteToStudent
);

// Reset strike count
router.put(
  "/:id/strikes/reset",
  authenticateJWT,
  requireRole(["ADMIN"]),
  controller.resetStrikes
);

export default router;
```

- [ ] **Step 2: Add routes to index.ts**

```typescript
// Add to backend/src/routes/index.ts

import adminApplicantRoutes from "./admin-applicant.routes";

// Mount the route
app.use("/api/admin/applicants", adminApplicantRoutes);
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/admin-applicant.routes.ts backend/src/routes/index.ts
git commit -m "feat(backend): add admin applicant routes"
```

---

## Task 6: Frontend Types

**Files:**
- Modify: `frontend/src/types/index.ts`

**Interfaces:**
- Consumes: None
- Produces: Types used by frontend components

- [ ] **Step 1: Add interfaces to types file**

```typescript
// Add to frontend/src/types/index.ts

// ADMIN APPLICANT INTERFACES
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

- [ ] **Step 2: Commit**

```bash
git add frontend/src/types/index.ts
git commit -m "feat(frontend): add admin applicant types"
```

---

## Task 7: Frontend Applicant List Page

**Files:**
- Rewrite: `frontend/src/app/(portal)/admin/users/applicants/page.tsx`

**Interfaces:**
- Consumes: Types, apiClientRequest, TanStack Query
- Produces: List view with filters

- [ ] **Step 1: Rewrite applicants page**

```typescript
"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiClientRequest } from "@/lib/api.client";
import { Eye, Search, ChevronLeft, ChevronRight, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { AdminApplicantListItem } from "@/types";

export default function AdminApplicantsPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [alignmentFilter, setAlignmentFilter] = useState("");
  const [examFilter, setExamFilter] = useState("");
  const [corFilter, setCorFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["adminApplicants", page, search, alignmentFilter, examFilter, corFilter, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: "10",
        search,
        alignment: alignmentFilter,
        exam: examFilter,
        cor: corFilter,
        status: statusFilter,
      });
      const res = await apiClientRequest(`/admin/applicants?${params.toString()}`);
      return res;
    },
  });

  const applicants: AdminApplicantListItem[] = data?.applicants || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / 10);

  const getAlignmentBadge = (status: string) => {
    switch (status) {
      case "ALIGNED":
        return <Badge className="bg-green-100 text-green-700">Aligned</Badge>;
      case "PENDING_WAIVER":
        return <Badge className="bg-amber-100 text-amber-700">Pending Waiver</Badge>;
      case "CLEARED":
        return <Badge className="bg-blue-100 text-blue-700">Cleared</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getExamBadge = (status: string) => {
    switch (status) {
      case "NOT_SCHEDULED":
        return <Badge variant="outline">Not Scheduled</Badge>;
      case "SCHEDULED":
        return <Badge className="bg-blue-100 text-blue-700">Scheduled</Badge>;
      case "PASSED":
        return <Badge className="bg-green-100 text-green-700">Passed</Badge>;
      case "FAILED":
        return <Badge className="bg-red-100 text-red-700">Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getCorBadge = (status: string) => {
    switch (status) {
      case "NONE":
        return <Badge variant="outline">--</Badge>;
      case "PENDING":
        return <Badge className="bg-amber-100 text-amber-700">Pending</Badge>;
      case "VERIFIED":
        return <Badge className="bg-green-100 text-green-700">Verified</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getAdmissionBadge = (status: string) => {
    switch (status) {
      case "APPLICANT":
        return <Badge variant="outline">Applicant</Badge>;
      case "ENROLLED":
        return <Badge className="bg-green-100 text-green-700">Enrolled</Badge>;
      case "DISQUALIFIED":
        return <Badge className="bg-red-100 text-red-700">Disqualified</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-(--earist-primary)">
            Applicant Management
          </h2>
          <p className="text-sm text-(--earist-body-text)">
            Manage all applicants and their application status
          </p>
        </div>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 text-gray-400 -translate-y-1/2" />
              <Input
                placeholder="Search by name, email, Pinnacle ID, or program..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-10"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                value={alignmentFilter}
                onChange={(e) => {
                  setAlignmentFilter(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-2 border rounded-md text-sm"
              >
                <option value="">All Alignment</option>
                <option value="ALIGNED">Aligned</option>
                <option value="PENDING_WAIVER">Pending Waiver</option>
                <option value="CLEARED">Cleared</option>
              </select>
              <select
                value={examFilter}
                onChange={(e) => {
                  setExamFilter(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-2 border rounded-md text-sm"
              >
                <option value="">All Exam Status</option>
                <option value="NOT_SCHEDULED">Not Scheduled</option>
                <option value="SCHEDULED">Scheduled</option>
                <option value="PASSED">Passed</option>
                <option value="FAILED">Failed</option>
              </select>
              <select
                value={corFilter}
                onChange={(e) => {
                  setCorFilter(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-2 border rounded-md text-sm"
              >
                <option value="">All COR Status</option>
                <option value="NONE">None</option>
                <option value="PENDING">Pending</option>
                <option value="VERIFIED">Verified</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-2 border rounded-md text-sm"
              >
                <option value="">All Admission Status</option>
                <option value="APPLICANT">Applicant</option>
                <option value="ENROLLED">Enrolled</option>
                <option value="DISQUALIFIED">Disqualified</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Applicants Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-sm text-gray-500 animate-pulse">Loading applicants...</p>
            </div>
          ) : applicants.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="mb-4 h-12 w-12 text-gray-300" />
              <p className="text-gray-500">No applicants found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Name</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Pinnacle ID</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Program</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Alignment</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Exam</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">COR</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Status</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {applicants.map((applicant) => (
                    <tr key={applicant.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-gray-900">
                            {applicant.firstName} {applicant.lastName}
                          </p>
                          <p className="text-sm text-gray-500">{applicant.email}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {applicant.pinnacleApplicantId}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {applicant.program.programName}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {getAlignmentBadge(applicant.alignmentStatus)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {getExamBadge(applicant.examStatus)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {getCorBadge(applicant.corStatus)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {getAdmissionBadge(applicant.admissionStatus)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/admin/users/applicants/${applicant.id}`}>
                          <Button variant="ghost" size="icon">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Showing {(page - 1) * 10 + 1} to {Math.min(page * 10, total)} of {total} applicants
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-gray-700">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setPage(page + 1)}
              disabled={page === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/\(portal\)/admin/users/applicants/page.tsx
git commit -m "feat(frontend): rewrite applicants list page with live API"
```

---

## Task 8: Frontend Applicant Detail Page

**Files:**
- Create: `frontend/src/app/(portal)/admin/users/applicants/[id]/page.tsx`

**Interfaces:**
- Consumes: Types, apiClientRequest, TanStack Query, shadcn/ui
- Produces: Detail page with sections and actions

- [ ] **Step 1: Create detail page**

```typescript
"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiClientRequest } from "@/lib/api.client";
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  Calendar,
  GraduationCap,
  FileText,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Shield,
  RotateCcw,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminApplicantDetail } from "@/types";
import { toast } from "sonner";

export default function ApplicantDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const applicantId = params.id as string;

  const [rejectNotes, setRejectNotes] = useState("");
  const [corReason, setCorReason] = useState("");
  const [verifyMethod, setVerifyMethod] = useState<"manual" | "qr_auto" | "ocr_auto">("manual");

  const { data: applicant, isLoading } = useQuery<AdminApplicantDetail>({
    queryKey: ["adminApplicantDetail", applicantId],
    queryFn: async () => {
      return await apiClientRequest(`/admin/applicants/${applicantId}`);
    },
  });

  const validateWaiverMutation = useMutation({
    mutationFn: async () => {
      return await apiClientRequest(`/admin/applicants/${applicantId}/waiver/validate`, {
        method: "PUT",
      });
    },
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ["adminApplicantDetail", applicantId] });
      queryClient.invalidateQueries({ queryKey: ["adminApplicants"] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const rejectWaiverMutation = useMutation({
    mutationFn: async () => {
      return await apiClientRequest(`/admin/applicants/${applicantId}/waiver/reject`, {
        method: "PUT",
        body: JSON.stringify({ adminNotes: rejectNotes }),
      });
    },
    onSuccess: (data) => {
      toast.success(data.message);
      setRejectNotes("");
      queryClient.invalidateQueries({ queryKey: ["adminApplicantDetail", applicantId] });
      queryClient.invalidateQueries({ queryKey: ["adminApplicants"] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const verifyCorMutation = useMutation({
    mutationFn: async () => {
      return await apiClientRequest(`/admin/applicants/${applicantId}/cor/verify`, {
        method: "PUT",
        body: JSON.stringify({ verificationMethod: verifyMethod }),
      });
    },
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ["adminApplicantDetail", applicantId] });
      queryClient.invalidateQueries({ queryKey: ["adminApplicants"] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const rejectCorMutation = useMutation({
    mutationFn: async () => {
      return await apiClientRequest(`/admin/applicants/${applicantId}/cor/reject`, {
        method: "PUT",
        body: JSON.stringify({ reason: corReason }),
      });
    },
    onSuccess: (data) => {
      toast.success(data.message);
      setCorReason("");
      queryClient.invalidateQueries({ queryKey: ["adminApplicantDetail", applicantId] });
      queryClient.invalidateQueries({ queryKey: ["adminApplicants"] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const promoteMutation = useMutation({
    mutationFn: async () => {
      return await apiClientRequest(`/admin/applicants/${applicantId}/promote`, {
        method: "PUT",
      });
    },
    onSuccess: (data) => {
      toast.success(data.message);
      toast.info(`Credentials: Username: ${data.credentials.username}, Password: ${data.credentials.password}`);
      queryClient.invalidateQueries({ queryKey: ["adminApplicantDetail", applicantId] });
      queryClient.invalidateQueries({ queryKey: ["adminApplicants"] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const resetStrikesMutation = useMutation({
    mutationFn: async () => {
      return await apiClientRequest(`/admin/applicants/${applicantId}/strikes/reset`, {
        method: "PUT",
      });
    },
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ["adminApplicantDetail", applicantId] });
      queryClient.invalidateQueries({ queryKey: ["adminApplicants"] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const getAlignmentBadge = (status: string) => {
    switch (status) {
      case "ALIGNED":
        return <Badge className="bg-green-100 text-green-700">Aligned</Badge>;
      case "PENDING_WAIVER":
        return <Badge className="bg-amber-100 text-amber-700">Pending Waiver</Badge>;
      case "CLEARED":
        return <Badge className="bg-blue-100 text-blue-700">Cleared</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getExamBadge = (status: string) => {
    switch (status) {
      case "NOT_SCHEDULED":
        return <Badge variant="outline">Not Scheduled</Badge>;
      case "SCHEDULED":
        return <Badge className="bg-blue-100 text-blue-700">Scheduled</Badge>;
      case "PASSED":
        return <Badge className="bg-green-100 text-green-700">Passed</Badge>;
      case "FAILED":
        return <Badge className="bg-red-100 text-red-700">Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getCorBadge = (status: string) => {
    switch (status) {
      case "NONE":
        return <Badge variant="outline">--</Badge>;
      case "PENDING":
        return <Badge className="bg-amber-100 text-amber-700">Pending</Badge>;
      case "VERIFIED":
        return <Badge className="bg-green-100 text-green-700">Verified</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getAdmissionBadge = (status: string) => {
    switch (status) {
      case "APPLICANT":
        return <Badge variant="outline">Applicant</Badge>;
      case "ENROLLED":
        return <Badge className="bg-green-100 text-green-700">Enrolled</Badge>;
      case "DISQUALIFIED":
        return <Badge className="bg-red-100 text-red-700">Disqualified</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatDateTime = (dateString: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-gray-500 animate-pulse">Loading applicant details...</p>
      </div>
    );
  }

  if (!applicant) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertTriangle className="mb-4 h-12 w-12 text-gray-300" />
        <p className="text-gray-500">Applicant not found</p>
        <Link href="/admin/users/applicants">
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Applicants
          </Button>
        </Link>
      </div>
    );
  }

  const isEligibleForPromotion =
    applicant.examStatus === "PASSED" && applicant.corStatus === "VERIFIED";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin/users/applicants">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-(--earist-primary)">
            Applicant Profile
          </h2>
          <p className="text-sm text-(--earist-body-text)">
            {applicant.firstName} {applicant.lastName} — {applicant.pinnacleApplicantId}
          </p>
        </div>
      </div>

      {/* Profile Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Profile
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <User className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Full Name</p>
                <p className="font-medium">{applicant.firstName} {applicant.lastName}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Email</p>
                <p className="font-medium">{applicant.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <FileText className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Pinnacle Applicant ID</p>
                <p className="font-medium">{applicant.pinnacleApplicantId}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Phone</p>
                <p className="font-medium">{applicant.cellphone || "N/A"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Calendar className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Date of Birth</p>
                <p className="font-medium">{formatDate(applicant.dateOfBirth)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <GraduationCap className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Program</p>
                <p className="font-medium">{applicant.program.programName}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <FileText className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Undergraduate Course</p>
                <p className="font-medium">{applicant.undergraduateCourse || "N/A"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Registered</p>
                <p className="font-medium">{formatDate(applicant.createdAt)}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Program Alignment */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Program Alignment
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div>
                <p className="text-sm text-gray-500">Status</p>
                {getAlignmentBadge(applicant.alignmentStatus)}
              </div>
            </div>

            {applicant.bridgingWaiver && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-700 mb-2">Bridging Waiver</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                  <p><span className="text-gray-500">Status:</span> {applicant.bridgingWaiver.status}</p>
                  <p><span className="text-gray-500">Downloaded:</span> {formatDateTime(applicant.bridgingWaiver.waiverFormDownloadedAt || "")}</p>
                  {applicant.bridgingWaiver.validatedBy && (
                    <p><span className="text-gray-500">Validated By:</span> {applicant.bridgingWaiver.validatedBy.firstName} {applicant.bridgingWaiver.validatedBy.lastName}</p>
                  )}
                  {applicant.bridgingWaiver.adminNotes && (
                    <p className="col-span-2"><span className="text-gray-500">Notes:</span> {applicant.bridgingWaiver.adminNotes}</p>
                  )}
                </div>
              </div>
            )}

            {applicant.alignmentStatus === "PENDING_WAIVER" && (
              <div className="flex gap-2">
                <Button
                  onClick={() => validateWaiverMutation.mutate()}
                  disabled={validateWaiverMutation.isPending}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  {validateWaiverMutation.isPending ? "Validating..." : "Validate Waiver"}
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    if (rejectNotes) {
                      rejectWaiverMutation.mutate();
                    }
                  }}
                  disabled={rejectWaiverMutation.isPending || !rejectNotes}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  {rejectWaiverMutation.isPending ? "Rejecting..." : "Reject"}
                </Button>
              </div>
            )}

            {applicant.alignmentStatus === "PENDING_WAIVER" && (
              <div>
                <label className="text-sm text-gray-500">Rejection Notes (required for reject)</label>
                <Textarea
                  value={rejectNotes}
                  onChange={(e) => setRejectNotes(e.target.value)}
                  placeholder="Enter rejection reason..."
                  className="mt-1"
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Entrance Examination */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Entrance Examination
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-500">Status</p>
                {getExamBadge(applicant.examStatus)}
              </div>
              {applicant.examScores && (
                <div className="space-y-2">
                  <p className="text-sm text-gray-500">Scores</p>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <p className="text-gray-500">MCQ</p>
                      <p className="font-medium">{applicant.examScores.mcq}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Essay</p>
                      <p className="font-medium">{applicant.examScores.essay}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Total</p>
                      <p className="font-medium">{applicant.examScores.total}</p>
                    </div>
                  </div>
                </div>
              )}
              <div>
                <p className="text-sm text-gray-500">Strike Count</p>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{applicant.strikeCount}</span>
                  {applicant.strikeCount > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => resetStrikesMutation.mutate()}
                      disabled={resetStrikesMutation.isPending}
                    >
                      <RotateCcw className="mr-1 h-3 w-3" />
                      Reset
                    </Button>
                  )}
                </div>
              </div>
            </div>
            {applicant.examApplications[0]?.examSlot && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-700 mb-2">Scheduled Exam</p>
                <div className="space-y-1 text-sm">
                  <p><span className="text-gray-500">Date:</span> {formatDate(applicant.examApplications[0].examSlot.examDate)}</p>
                  <p><span className="text-gray-500">Time:</span> {applicant.examApplications[0].examSlot.examTime}</p>
                  <p><span className="text-gray-500">Venue:</span> {applicant.examApplications[0].examSlot.venueOrLink}</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Certificate of Registration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Certificate of Registration (COR)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-500">Status</p>
              {getCorBadge(applicant.corStatus)}
            </div>

            {applicant.corUploads[0] && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <p><span className="text-gray-500">Uploaded:</span> {formatDateTime(applicant.corUploads[0].uploadedAt)}</p>
                  <p><span className="text-gray-500">OCR Status:</span> {applicant.corUploads[0].ocrStatus}</p>
                  {applicant.corUploads[0].corRecord && (
                    <>
                      <p><span className="text-gray-500">Reg No:</span> {applicant.corUploads[0].corRecord.registrationNumber}</p>
                      <p><span className="text-gray-500">Academic Year:</span> {applicant.corUploads[0].corRecord.academicYear}</p>
                      <p><span className="text-gray-500">Semester:</span> {applicant.corUploads[0].corRecord.semester}</p>
                      <p><span className="text-gray-500">Program:</span> {applicant.corUploads[0].corRecord.extractedProgramName}</p>
                      <p><span className="text-gray-500">Total Assessment:</span> ₱{applicant.corUploads[0].corRecord.totalAssessment.toLocaleString()}</p>
                      <p><span className="text-gray-500">Outstanding:</span> ₱{applicant.corUploads[0].corRecord.outstandingBalance.toLocaleString()}</p>
                      {applicant.corUploads[0].corRecord.verifiedBy && (
                        <p><span className="text-gray-500">Verified By:</span> {applicant.corUploads[0].corRecord.verifiedBy.firstName} {applicant.corUploads[0].corRecord.verifiedBy.lastName}</p>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {applicant.corStatus !== "VERIFIED" && applicant.corUploads[0] && (
              <div className="flex gap-2">
                <Button
                  onClick={() => verifyCorMutation.mutate()}
                  disabled={verifyCorMutation.isPending}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  {verifyCorMutation.isPending ? "Verifying..." : "Verify COR"}
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    if (corReason) {
                      rejectCorMutation.mutate();
                    }
                  }}
                  disabled={rejectCorMutation.isPending || !corReason}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  {rejectCorMutation.isPending ? "Rejecting..." : "Reject"}
                </Button>
              </div>
            )}

            {applicant.corStatus !== "VERIFIED" && applicant.corUploads[0] && (
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-sm text-gray-500">Verification Method</label>
                  <select
                    value={verifyMethod}
                    onChange={(e) => setVerifyMethod(e.target.value as any)}
                    className="w-full mt-1 px-3 py-2 border rounded-md text-sm"
                  >
                    <option value="manual">Manual</option>
                    <option value="qr_auto">QR Auto</option>
                    <option value="ocr_auto">OCR Auto</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-sm text-gray-500">Rejection Reason (required for reject)</label>
                  <input
                    type="text"
                    value={corReason}
                    onChange={(e) => setCorReason(e.target.value)}
                    placeholder="Enter rejection reason..."
                    className="w-full mt-1 px-3 py-2 border rounded-md text-sm"
                  />
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Admission Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5" />
            Admission Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-500">Current Status</p>
              {getAdmissionBadge(applicant.admissionStatus)}
            </div>

            {applicant.enrollmentDate && (
              <div>
                <p className="text-sm text-gray-500">Enrollment Date</p>
                <p className="font-medium">{formatDate(applicant.enrollmentDate)}</p>
              </div>
            )}

            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium text-gray-700 mb-2">Eligibility Check</p>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  {applicant.examStatus === "PASSED" ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600" />
                  )}
                  <span className="text-sm">Entrance Exam Passed</span>
                </div>
                <div className="flex items-center gap-2">
                  {applicant.corStatus === "VERIFIED" ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600" />
                  )}
                  <span className="text-sm">COR Verified</span>
                </div>
              </div>
            </div>

            {isEligibleForPromotion && applicant.admissionStatus === "APPLICANT" && (
              <Button
                onClick={() => {
                  if (confirm("Are you sure you want to promote this applicant to Student? Credentials will be sent via email.")) {
                    promoteMutation.mutate();
                  }
                }}
                disabled={promoteMutation.isPending}
                className="bg-green-600 hover:bg-green-700"
              >
                <GraduationCap className="mr-2 h-4 w-4" />
                {promoteMutation.isPending ? "Promoting..." : "Promote to Student"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Activity Log */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Activity Log
          </CardTitle>
        </CardHeader>
        <CardContent>
          {applicant.activityLog.length === 0 ? (
            <p className="text-sm text-gray-500">No activity recorded</p>
          ) : (
            <div className="space-y-3">
              {applicant.activityLog.map((log, index) => (
                <div key={index} className="flex gap-3 text-sm">
                  <div className="flex-shrink-0 w-32 text-gray-500">
                    {formatDateTime(log.timestamp)}
                  </div>
                  <div>
                    <p className="font-medium text-gray-700">{log.description}</p>
                    <p className="text-gray-500">by {log.actor}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/\(portal\)/admin/users/applicants/\[id\]/page.tsx
git commit -m "feat(frontend): add applicant detail page"
```

---

## Task 9: Integration Testing

**Files:**
- None (manual testing)

- [ ] **Step 1: Start backend server**

```bash
cd backend && npm run dev
```

- [ ] **Step 2: Start frontend server**

```bash
cd frontend && npm run dev
```

- [ ] **Step 3: Test list page**

1. Login as admin (`admin@earist.edu.ph`)
2. Navigate to `/admin/users/applicants`
3. Verify table shows real data
4. Test search functionality
5. Test filters

- [ ] **Step 4: Test detail page**

1. Click "View" on an applicant
2. Verify all sections display correctly
3. Test waiver validation (if applicable)
4. Test COR verification (if applicable)
5. Test promote to student (if eligible)

- [ ] **Step 5: Test edge cases**

1. Test with no applicants
2. Test with applicant who has pending waiver
3. Test with applicant who has verified COR
4. Test with applicant eligible for promotion

- [ ] **Step 6: Commit any fixes**

```bash
git add -A
git commit -m "fix: integration testing fixes"
```

---

## Task 10: Push to Remote

**Files:**
- None

- [ ] **Step 1: Push branch to remote**

```bash
git push -u origin feature/admin-applicants-management
```

- [ ] **Step 2: Create Pull Request**

```bash
gh pr create --title "feat: admin applicants management" --body "Implements admin applicant list and detail page with live backend integration."
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Backend interfaces | 1 new |
| 2 | Backend repository | 1 new |
| 3 | Backend service | 1 new |
| 4 | Backend controller | 1 new |
| 5 | Backend routes | 1 new + 1 modified |
| 6 | Frontend types | 1 modified |
| 7 | Frontend list page | 1 rewritten |
| 8 | Frontend detail page | 1 new |
| 9 | Integration testing | - |
| 10 | Push to remote | - |

**Total:** 6 new files, 3 modified files

---

*End of Plan*
