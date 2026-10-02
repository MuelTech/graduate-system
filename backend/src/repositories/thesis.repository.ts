import prisma from "../config/database";
import { canCreateDefenseSchedule } from "../services/defense-application-workflow";
import { DefenseCommitteePolicy } from "../services/defense-committee.policy";
import { AppError } from "../utils/AppError";
import type { ManagedUploadInput } from "../storage/managed-upload";
import {
  validateCurrentEvidenceCounts,
  type DefenseEvidenceDocType,
  type DefenseEvidenceStage,
} from "../services/defense-evidence.rules";
import { DEFENSE_REVIEW_ACTIONS } from "../services/defense-review-events";

/** DL-6: builds a stage/type-scoped evidence row from DL-2 managed metadata. */
function toDocumentData(
  thesisId: string,
  defenseStage: DefenseEvidenceStage,
  docType: DefenseEvidenceDocType,
  upload: ManagedUploadInput,
  options?: { isCurrent?: boolean; supersedesDocumentId?: string | null },
) {
  return {
    thesisId,
    docType,
    defenseStage,
    filePath: upload.filePath,
    storageKey: upload.storageKey,
    storageProvider: upload.storageProvider,
    originalFilename: upload.originalFilename,
    verifiedMimeType: upload.verifiedMimeType,
    sizeBytes: upload.sizeBytes,
    checksum: upload.checksum,
    checksumAlgorithm: upload.checksumAlgorithm,
    uploadedById: upload.uploadedById,
    isCurrent: options?.isCurrent ?? true,
    supersedesDocumentId: options?.supersedesDocumentId ?? null,
    uploadedAt: new Date(),
  };
}

export class ThesisRepository {
  async getStudentByUserId(userId: string) {
    return prisma.student.findUnique({ where: { userId } });
  }

  async getStudentById(studentId: string) {
    return prisma.student.findUnique({
      where: { id: studentId },
      include: {
        program: {
          select: { id: true, programName: true, programType: true },
        },
      },
    });
  }

  async getThesisById(thesisId: string) {
    return prisma.thesisRecord.findUnique({ where: { id: thesisId } });
  }

  async getDefenseScheduleForScoring(scheduleId: string) {
    return prisma.defenseSchedule.findUnique({
      where: { id: scheduleId },
      select: { id: true, defenseType: true },
    });
  }

  /** Read model for formal conclusion preconditions (scores complete, not already concluded). */
  async getSessionPanelAssignments(scheduleId: string, userId: string) {
    return prisma.panelAssignment.findMany({
      where: { scheduleId },
      select: { id: true, userId: true, role: true },
    });
  }

  async getDefenseScheduleForConclude(scheduleId: string) {
    const schedule = await prisma.defenseSchedule.findUnique({
      where: { id: scheduleId },
      include: {
        conclusion: { select: { id: true } },
        thesis: {
          include: {
            thesisTitles: { select: { id: true } },
          },
        },
        panelAssignments: {
          select: { id: true, role: true, userId: true },
        },
        oralExamScores: { select: { id: true, status: true, panelId: true } },
        oralExamSummary: { select: { id: true } },
      },
    });
    if (!schedule) return null;

    // CP5-FIX1: centralized evaluator policy (not a local literal set).
    const evaluatorRoles = new DefenseCommitteePolicy().getEvaluatorRoles(
      schedule.defenseType as never,
    );
    const evaluatorAssignmentIds = schedule.panelAssignments
      .filter((p) => (evaluatorRoles as string[]).includes(p.role))
      .map((p) => p.id);
    const evaluatorSet = new Set(evaluatorAssignmentIds);

    // FINALIZED only, and only rows owned by evaluator assignments.
    const finalizedEvaluatorScores = schedule.oralExamScores.filter(
      (s) => s.status === "FINALIZED" && evaluatorSet.has(s.panelId),
    ).length;

    return {
      defenseType: schedule.defenseType as string,
      alreadyConcluded: !!schedule.conclusion,
      evaluatorAssignments: evaluatorAssignmentIds.length,
      submittedEvaluatorScores: finalizedEvaluatorScores,
      finalizedEvaluatorScores,
      thesisTitleIds: schedule.thesis.thesisTitles.map((t) => t.id),
      sessionStatus: schedule.sessionStatus as string,
      rapporteurNotesFinalized: Boolean(schedule.rapporteurNotesFinalizedAt),
      oralSummaryExists: Boolean(schedule.oralExamSummary),
    };
  }

  async getPendingDefenses() {
    return prisma.thesisRecord.findMany({
      where: {
        status: "PENDING",
      },
      include: {
        student: { include: { user: true } },
        thesisTitles: true,
        thesisDocuments: true,
        assignment: { include: { adviser: true } },
      },
    });
  }

  async getApprovedDefenses() {
    // APPROVED != PASSED: these rows are ready for scheduling only.
    // Titles stay unselected until Title Defense conclusion.
    return prisma.thesisRecord.findMany({
      where: {
        status: "APPROVED",
      },
      include: {
        student: { include: { user: true } },
        thesisTitles: true,
        thesisDocuments: true,
        assignment: { include: { adviser: true } },
      },
    });
  }

  /**
   * Server-side paginated approved applications for Scheduling & Panels.
   * Search: student name, student number, email, program name.
   */
  async getApprovedApplicationsPaginated(params: {
    page: number;
    pageSize: number;
    search?: string;
    defenseType?: string;
    programId?: string;
  }) {
    const { page, pageSize, search, defenseType, programId } = params;
    const where: Record<string, unknown> = { status: "APPROVED" };

    if (defenseType && defenseType !== "ALL") {
      const stageMap: Record<string, string> = {
        TITLE_DEFENSE: "TITLE",
        PROPOSAL_DEFENSE: "PROPOSAL",
        FINAL_DEFENSE: "FINAL",
      };
      const stage = stageMap[defenseType] ?? defenseType;
      where.stage = stage;
    }
    if (programId && programId !== "ALL") {
      where.student = { programId };
    }
    if (search && search.trim()) {
      const q = search.trim();
      where.student = {
        ...(where.student as object),
        OR: [
          { studentNumber: { contains: q } },
          { user: { firstName: { contains: q } } },
          { user: { lastName: { contains: q } } },
          { user: { email: { contains: q } } },
          { program: { programName: { contains: q } } },
        ],
      };
    }

    const [data, total] = await prisma.$transaction([
      prisma.thesisRecord.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          student: {
            include: {
              user: { select: { id: true, firstName: true, lastName: true, email: true } },
              program: { select: { id: true, programName: true, programType: true } },
            },
          },
          thesisTitles: {
            select: { id: true, titleText: true, isSelected: true },
          },
          assignment: {
            include: {
              adviser: { select: { id: true, firstName: true, lastName: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.thesisRecord.count({ where }),
    ]);

    return { data, total, page, pageSize };
  }

  /**
   * Server-backed panelist search for the committee combobox.
   * Only active PANELIST accounts; small pages for "load more".
   */
  async searchActivePanelists(params: {
    page: number;
    pageSize: number;
    search?: string;
  }) {
    const { page, pageSize, search } = params;
    const q = search?.trim();
    const where = {
      role: "PANELIST" as const,
      isActive: true,
      panelist: { isActive: true },
      ...(q
        ? {
            OR: [
              { firstName: { contains: q } },
              { lastName: { contains: q } },
              { email: { contains: q } },
              { panelist: { specialization: { contains: q } } },
              { panelist: { officeAffiliation: { contains: q } } },
            ],
          }
        : {}),
    };

    const [data, total] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          panelist: {
            select: {
              isExternal: true,
              isAvailableAsAdviser: true,
              specialization: true,
              officeAffiliation: true,
            },
          },
        },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      }),
      prisma.user.count({ where }),
    ]);

    return { data, total, page, pageSize };
  }

  async getRejectedDefenses() {
    return prisma.thesisRecord.findMany({
      where: { status: "REJECTED" },
      include: {
        student: { include: { user: true } },
        thesisTitles: true,
        thesisDocuments: true,
        assignment: { include: { adviser: true } },
      },
    });
  }

  async getAllDefenses() {
    return prisma.thesisRecord.findMany({
      include: {
        student: { include: { user: true } },
        thesisTitles: true,
        thesisDocuments: true,
        assignment: { include: { adviser: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async findNonCancelledSchedules(thesisId: string) {
    return prisma.defenseSchedule.findMany({
      where: { thesisId, sessionStatus: { not: "CANCELLED" } },
      select: {
        id: true,
        defenseType: true,
        sessionStatus: true,
        createdAt: true,
      },
    });
  }

  async getActiveAdviserAssignment(studentId: string) {
    return prisma.adviserAssignment.findFirst({
      where: { studentId, isActive: true },
      orderBy: { assignedDate: "desc" },
    });
  }

  async getAllAdviserRequests() {
    return prisma.adviserRequest.findMany({
      include: {
        student: { include: { user: true, program: true } },
        requestedAdviser: true,
      },
      orderBy: { requestDate: "desc" },
    });
  }

  async getAllActiveAssignments() {
    return prisma.adviserAssignment.findMany({
      where: { isActive: true },
      include: {
        student: { include: { user: true, program: true } },
        adviser: { include: { panelist: true } },
        thesisRecords: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { assignedDate: "desc" },
    });
  }

  /**
   * Candidate pool for defense participation: all active PANELIST accounts.
   * Adviser availability (`isAvailableAsAdviser`) only affects adviser assignment,
   * not eligibility to chair / evaluate / facilitate / report.
   */
  async getActivePanelistCandidates() {
    return prisma.user.findMany({
      where: {
        role: "PANELIST",
        isActive: true,
        panelist: { isActive: true },
      },
      include: { panelist: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });
  }

  async getAvailableAdvisers() {
    return prisma.user.findMany({
      where: { role: "PANELIST", panelist: { isAvailableAsAdviser: true, isActive: true } },
      include: { panelist: true },
    });
  }

  async getActiveThesis(studentId: string) {
    return prisma.thesisRecord.findFirst({
      where: { studentId },
      orderBy: { createdAt: "desc" },
    });
  }

  /** DL-6: proposed titles for a thesis record (resubmission eligibility). */
  async getProposedTitles(thesisId: string) {
    return prisma.thesisTitle.findMany({
      where: { thesisId },
      select: { id: true },
    });
  }

  async createTitleDefense(
    studentId: string,
    assignmentId: string | null,
    titles: string[],
    evidence: {
      conceptPaper: ManagedUploadInput;
      cor: ManagedUploadInput;
      receipt: ManagedUploadInput;
    },
  ) {
    return prisma.$transaction(async (tx) => {
      // DL-6 FIX1: serialize concurrent initial Title applications per Student.
      await tx.$queryRaw`SELECT student_id FROM students WHERE student_id = ${studentId} FOR UPDATE`;

      // After acquiring the lock, re-check the active/blocking-thesis rule.
      const existing = await tx.thesisRecord.findFirst({
        where: { studentId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: { id: true, status: true },
      });
      if (existing && existing.status !== "FAILED") {
        throw new AppError(
          "You already have an active Thesis Record in progress.",
          409,
        );
      }

      // 1. Create the base Thesis Record linked to the Adviser Assignment
      const thesis = await tx.thesisRecord.create({
        data: {
          studentId,
          assignmentId,
          stage: "TITLE",
          status: "PENDING",
        },
      });

      // 2. Insert the 3 proposed titles
      for (const title of titles) {
        await tx.thesisTitle.create({
          data: { thesisId: thesis.id, titleText: title },
        });
      }

      // 3. Stage-scoped Title evidence (§16) — package + COR + fee proof,
      //    persisting the full DL-1/DL-2 managed metadata + currentness.
      await tx.thesisDocument.createMany({
        data: [
          toDocumentData(thesis.id, "TITLE", "TITLE_PROPOSAL", evidence.conceptPaper),
          toDocumentData(thesis.id, "TITLE", "COR", evidence.cor),
          toDocumentData(thesis.id, "TITLE", "RECEIPT", evidence.receipt),
        ],
      });

      return thesis;
    });
  }

  async updateThesisToProposal(
    thesisId: string,
    evidence: { cor: ManagedUploadInput; receipt: ManagedUploadInput },
  ) {
    return prisma.$transaction(async (tx) => {
      // DL-6 FIX1: serialize and re-check the exact pre-Proposal stage.
      await tx.$queryRaw`SELECT thesis_id FROM thesis_records WHERE thesis_id = ${thesisId} FOR UPDATE`;
      const current = await tx.thesisRecord.findUnique({
        where: { id: thesisId },
        select: { stage: true },
      });
      if (!current || current.stage !== "TITLE") {
        throw new AppError(
          "Proposal application has already been started for this Thesis Record.",
          409,
        );
      }
      const existing = await tx.thesisDocument.findMany({
        where: {
          thesisId,
          defenseStage: "PROPOSAL",
          docType: { in: ["COR", "RECEIPT"] },
          isCurrent: true,
        },
        select: { id: true },
      });
      if (existing.length > 0) {
        throw new AppError(
          "Proposal supporting evidence already exists for this Thesis Record.",
          409,
        );
      }

      // New stage application starts a fresh review cycle; clear prior outcome
      // so Title PASSED cannot be mistaken for Proposal PASSED.
      const thesis = await tx.thesisRecord.update({
        where: { id: thesisId },
        data: { stage: "PROPOSAL", status: "PENDING", outcome: null },
      });

      // CP3-FIX1: do NOT create another PROPOSAL_CHAPTERS — the Adviser-certified
      // manuscript (AdviserCertification.reviewedDocumentId) is authoritative.
      await tx.thesisDocument.createMany({
        data: [
          toDocumentData(thesisId, "PROPOSAL", "COR", evidence.cor),
          toDocumentData(thesisId, "PROPOSAL", "RECEIPT", evidence.receipt),
        ],
      });

      return thesis;
    });
  }

  async updateThesisToFinal(
    thesisId: string,
    evidence: { cor: ManagedUploadInput; receipt: ManagedUploadInput },
  ) {
    return prisma.$transaction(async (tx) => {
      // DL-6 FIX1: serialize and re-check the exact pre-Final stage.
      await tx.$queryRaw`SELECT thesis_id FROM thesis_records WHERE thesis_id = ${thesisId} FOR UPDATE`;
      const current = await tx.thesisRecord.findUnique({
        where: { id: thesisId },
        select: { stage: true },
      });
      if (!current || current.stage !== "PROPOSAL") {
        throw new AppError(
          "Final application has already been started for this Thesis Record.",
          409,
        );
      }
      const existing = await tx.thesisDocument.findMany({
        where: {
          thesisId,
          defenseStage: "FINAL",
          docType: { in: ["COR", "RECEIPT"] },
          isCurrent: true,
        },
        select: { id: true },
      });
      if (existing.length > 0) {
        throw new AppError(
          "Final supporting evidence already exists for this Thesis Record.",
          409,
        );
      }

      const thesis = await tx.thesisRecord.update({
        where: { id: thesisId },
        data: { stage: "FINAL", status: "PENDING", outcome: null },
      });

      // CP4: do NOT create another FINAL_MANUSCRIPT — certified manuscript is authoritative.
      await tx.thesisDocument.createMany({
        data: [
          toDocumentData(thesisId, "FINAL", "COR", evidence.cor),
          toDocumentData(thesisId, "FINAL", "RECEIPT", evidence.receipt),
        ],
      });

      return thesis;
    });
  }

  /**
   * DL-6: append-only supporting-evidence replacement for a REJECTED
   * application. Locks the thesis row to serialize competing resubmissions,
   * conditionally transitions REJECTED -> PENDING (affected-row checked),
   * supersedes the current row per slot (never overwrites/deletes), inserts new
   * current versions, re-checks the required current evidence set, and writes
   * the audit entry in the same transaction.
   */
  async resubmitWithEvidence(params: {
    thesisId: string;
    studentId: string;
    stage: DefenseEvidenceStage;
    replacements: Array<{
      docType: DefenseEvidenceDocType;
      upload: ManagedUploadInput;
    }>;
    audit: { actorId: string; description: string };
    /** DL-8: prior rejection reason, retained in the resubmit audit event. */
    previousRejectionReason?: string | null;
  }) {
    const { thesisId, studentId, stage, replacements, audit, previousRejectionReason } = params;

    return prisma.$transaction(async (tx) => {
      // Serialize competing resubmissions for this application.
      await tx.$queryRaw`SELECT thesis_id FROM thesis_records WHERE thesis_id = ${thesisId} FOR UPDATE`;

      // Re-check the exact REJECTED application for this stage.
      const current = await tx.thesisRecord.findUnique({
        where: { id: thesisId },
        select: { studentId: true, status: true, stage: true },
      });
      if (
        !current ||
        current.studentId !== studentId ||
        current.status !== "REJECTED" ||
        current.stage !== stage
      ) {
        throw new AppError(
          "Only a rejected application for this stage can be resubmitted.",
          409,
        );
      }

      const createdIds: string[] = [];
      const supersededIds: string[] = [];
      const replacementDetail: Array<{
        docType: string;
        supersededDocumentId: string | null;
        createdDocumentId: string;
      }> = [];

      for (const { docType, upload } of replacements) {
        const currentRows = await tx.thesisDocument.findMany({
          where: { thesisId, defenseStage: stage, docType, isCurrent: true },
          select: { id: true },
        });
        // Ambiguous legacy current rows: fail closed rather than guess/repair.
        if (currentRows.length > 1) {
          throw new AppError(
            "Multiple current evidence rows found for this slot; refusing to choose an authoritative version.",
            409,
          );
        }
        const supersededId = currentRows[0]?.id ?? null;
        if (supersededId) {
          await tx.thesisDocument.updateMany({
            where: { id: supersededId, isCurrent: true },
            data: { isCurrent: false },
          });
          supersededIds.push(supersededId);
        }

        const created = await tx.thesisDocument.create({
          data: toDocumentData(thesisId, stage, docType, upload, {
            isCurrent: true,
            supersedesDocumentId: supersededId,
          }),
          select: { id: true },
        });
        createdIds.push(created.id);
        replacementDetail.push({
          docType,
          supersededDocumentId: supersededId,
          createdDocumentId: created.id,
        });
      }

      // Every required stage slot must have EXACTLY ONE current row.
      const currentDocs = await tx.thesisDocument.findMany({
        where: { thesisId, defenseStage: stage, isCurrent: true },
        select: { docType: true },
      });
      const counts: Record<string, number> = {};
      for (const doc of currentDocs) {
        counts[doc.docType] = (counts[doc.docType] ?? 0) + 1;
      }
      const issues = validateCurrentEvidenceCounts(stage, counts);
      const ambiguous = issues.filter((i) => i.kind === "AMBIGUOUS");
      if (ambiguous.length > 0) {
        throw new AppError(
          `Ambiguous current supporting evidence: ${ambiguous
            .map((i) => `${i.docType} (${i.count})`)
            .join(", ")}.`,
          409,
        );
      }
      const missing = issues.filter((i) => i.kind === "MISSING");
      if (missing.length > 0) {
        throw new AppError(
          `Missing current supporting evidence: ${missing
            .map((i) => i.docType)
            .join(", ")}.`,
          400,
        );
      }

      // Finalize the transition only after the evidence shape is authoritative.
      const claimed = await tx.thesisRecord.updateMany({
        where: { id: thesisId, studentId, status: "REJECTED", stage },
        data: { status: "PENDING", rejectionReason: null },
      });
      if (claimed.count !== 1) {
        throw new AppError(
          "Only a rejected application for this stage can be resubmitted.",
          409,
        );
      }

      await tx.auditLog.create({
        data: {
          actorId: audit.actorId,
          actionType: DEFENSE_REVIEW_ACTIONS.RESUBMIT,
          targetTable: "thesis_records",
          targetId: thesisId,
          description: audit.description,
          newValue: JSON.stringify({
            stage,
            previousRejectionReason: previousRejectionReason ?? null,
            replacements: replacementDetail,
            createdIds,
            supersededIds,
          }),
        },
      });

      return { createdIds, supersededIds };
    });
  }

  /** Current stage-bound supporting evidence for an application. */
  async getCurrentEvidence(thesisId: string, stage: DefenseEvidenceStage) {
    return prisma.thesisDocument.findMany({
      where: { thesisId, defenseStage: stage, isCurrent: true },
      orderBy: { uploadedAt: "asc" },
    });
  }

  /** Full supporting-evidence history for a stage (current + superseded). */
  async getEvidenceHistory(thesisId: string, stage: DefenseEvidenceStage) {
    return prisma.thesisDocument.findMany({
      where: { thesisId, defenseStage: stage },
      orderBy: [{ docType: "asc" }, { uploadedAt: "desc" }],
    });
  }

  async createAdviserRequest(
    studentId: string,
    requestedAdviserId: string,
    reason?: string,
  ) {
    return prisma.adviserRequest.create({
      data: {
        studentId,
        requestedAdviserId,
        reason,
        status: "PENDING",
        requestDate: new Date(),
        // Approver is the Dean only after approval — never a placeholder actor.
        approvedById: null,
        adviserStatus: "PENDING",
        deanStatus: "PENDING",
      },
    });
  }

  /**
   * @deprecated Direct approval bypass is retired.
   * Use AdviserRequestService.deanDecideAdviserRequest (GS-020 CONFORME → Dean).
   */
  async approveAdviserRequest(
    requestId: string,
    adviserId: string,
    adminId: string,
  ) {
    throw new Error(
      "Direct adviser assignment is retired. Use the GS-020 Dean decision endpoint (CONFORME → Dean APPROVED).",
    );
  }

  /**
   * Application review status only. Never selects a winning title here â€”
   * title selection happens at Title Defense conclusion.
   */
  async updateThesisStatus(
    thesisId: string,
    status: "PENDING" | "APPROVED" | "REJECTED",
    options?: { rejectionReason?: string | null },
  ) {
    return prisma.thesisRecord.update({
      where: { id: thesisId },
      data: {
        status,
        rejectionReason:
          status === "REJECTED" ? options?.rejectionReason ?? null : null,
      },
    });
  }

  /**
   * DL-8: canonical Admin rejection writes status + reason and the durable
   * review audit event in one transaction.
   */
  async rejectApplication(params: {
    thesisId: string;
    actorId: string | null;
    reason: string;
    stage: string;
    fromStatus: string;
  }) {
    const { thesisId, actorId, reason, stage, fromStatus } = params;
    return prisma.$transaction(async (tx) => {
      const updated = await tx.thesisRecord.update({
        where: { id: thesisId },
        data: { status: "REJECTED", rejectionReason: reason },
        select: { id: true, status: true, rejectionReason: true, stage: true },
      });
      await tx.auditLog.create({
        data: {
          actorId,
          actionType: DEFENSE_REVIEW_ACTIONS.REJECT,
          targetTable: "thesis_records",
          targetId: thesisId,
          oldValue: fromStatus,
          newValue: JSON.stringify({ stage, reason }),
          description: `Defense ${stage} application rejected: ${reason}`,
        },
      });
      return updated;
    });
  }

  /** DL-8: canonical Admin approval writes status + audit atomically. */
  async approveApplication(params: {
    thesisId: string;
    actorId: string | null;
    stage: string;
    fromStatus: string;
  }) {
    const { thesisId, actorId, stage, fromStatus } = params;
    return prisma.$transaction(async (tx) => {
      const updated = await tx.thesisRecord.update({
        where: { id: thesisId },
        data: { status: "APPROVED", rejectionReason: null },
        select: { id: true, status: true, rejectionReason: true, stage: true },
      });
      await tx.auditLog.create({
        data: {
          actorId,
          actionType: DEFENSE_REVIEW_ACTIONS.APPROVE,
          targetTable: "thesis_records",
          targetId: thesisId,
          oldValue: fromStatus,
          newValue: JSON.stringify({ stage }),
          description: `Defense ${stage} application approved.`,
        },
      });
      return updated;
    });
  }

  /** REJECTED -> PENDING without creating a duplicate active thesis record. */
  async resubmitApplication(thesisId: string) {
    return prisma.thesisRecord.update({
      where: { id: thesisId },
      data: { status: "PENDING", rejectionReason: null },
    });
  }

  async scheduleDefense(
    thesisId: string,
    adminId: string,
    data: {
      defenseDate: string;
      defenseTime: string;
      venueOrLink: string;
      defenseType: string;
      assignments: Array<{ userId: string; role: string }>;
    },
  ) {
    return prisma.$transaction(async (tx) => {
      // Hard guard: never create a second non-cancelled schedule for the same
      // thesis + defense type (rescheduling is a separate, unimplemented workflow).
      const existing = await tx.defenseSchedule.findMany({
        where: {
          thesisId,
          defenseType: data.defenseType.toUpperCase() as
            | "TITLE_DEFENSE"
            | "PROPOSAL_DEFENSE"
            | "FINAL_DEFENSE",
          sessionStatus: { not: "CANCELLED" },
        },
        select: { id: true, defenseType: true, sessionStatus: true, createdAt: true },
      });
      const gate = canCreateDefenseSchedule({
        defenseType: data.defenseType,
        schedules: existing,
      });
      if (!gate.allowed) {
        throw new Error(gate.reason);
      }

      const schedule = await tx.defenseSchedule.create({
        data: {
          thesisId,
          defenseDate: new Date(data.defenseDate),
          defenseTime: new Date(`1970-01-01T${data.defenseTime}:00.000Z`),
          venueOrLink: data.venueOrLink,
          defenseType: data.defenseType.toUpperCase() as
            | "TITLE_DEFENSE"
            | "PROPOSAL_DEFENSE"
            | "FINAL_DEFENSE",
          setById: adminId,
        },
      });

      // Dynamic Defense Committee â€” validated before this transaction.
      await tx.panelAssignment.createMany({
        data: data.assignments.map((a) => ({
          scheduleId: schedule.id,
          userId: a.userId,
          role: a.role as
            | "CHAIRMAN"
            | "PANELIST"
            | "ADVISER"
            | "RAPPORTEUR"
            | "FACILITATOR",
        })),
      });

      // APPROVED -> SCHEDULED (still not PASSED)
      await tx.thesisRecord.update({
        where: { id: thesisId },
        data: { status: "SCHEDULED" },
      });
      await tx.defenseSchedule.update({
        where: { id: schedule.id },
        data: { sessionStatus: "SCHEDULED" },
      });

      return tx.defenseSchedule.findUnique({
        where: { id: schedule.id },
        include: {
          panelAssignments: {
            include: { user: true },
          },
        },
      });
    });
  }

  async getPanelistAssignments(userId: string) {
    const rows = await prisma.panelAssignment.findMany({
      where: { userId },
      include: {
        schedule: {
          include: {
            thesis: {
              include: {
                student: {
                  include: {
                    user: true,
                    program: { select: { programName: true } },
                  },
                },
                thesisDocuments: true,
              },
            },
          },
        },
        // Own evaluation status only — never other evaluators' score content.
        // Relation is scoped to this PanelAssignment (panelId).
        oralExamScores: {
          select: { panelId: true, status: true },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // CP3-FIX1: stage-aware document visibility — Title panel does not see
    // Proposal pre-review manuscripts (and vice versa).
    const defenseTypeToStage: Record<string, string> = {
      TITLE_DEFENSE: "TITLE",
      PROPOSAL_DEFENSE: "PROPOSAL",
      FINAL_DEFENSE: "FINAL",
    };
    const evaluatorRoles = new DefenseCommitteePolicy()
      .getEvaluatorRoles("PROPOSAL_DEFENSE" as never)
      .map(String);

    return rows.map((row) => {
      const defenseType = String(row.schedule?.defenseType ?? "");
      const stage = defenseType ? defenseTypeToStage[defenseType] : null;
      const docs = row.schedule?.thesis?.thesisDocuments ?? [];
      const filtered = stage
        ? docs.filter(
            (d) => d.defenseStage == null || d.defenseStage === stage,
          )
        : docs;

      // CP9: own evaluation status from own assignment + own OralExamScore only.
      // Title never uses Proposal/Final numerical evaluation. Non-evaluators: NONE.
      let evaluationStatus: "NOT_STARTED" | "DRAFT" | "FINALIZED" | "NONE" =
        "NONE";
      const isNumerical =
        defenseType === "PROPOSAL_DEFENSE" || defenseType === "FINAL_DEFENSE";
      const isEvaluatorRole =
        evaluatorRoles.includes(String(row.role)) && isNumerical;
      if (isEvaluatorRole) {
        // oralExamScores relation is already scoped to this PanelAssignment.
        const ownScore = row.oralExamScores?.[0] ?? null;
        evaluationStatus =
          ownScore?.status === "FINALIZED"
            ? "FINALIZED"
            : ownScore?.status === "DRAFT"
              ? "DRAFT"
              : "NOT_STARTED";
      }

      return {
        ...row,
        evaluationStatus,
        schedule: row.schedule
          ? {
              ...row.schedule,
              thesis: {
                ...row.schedule.thesis,
                thesisDocuments: filtered,
              },
            }
          : row.schedule,
      };
    });
  }

  async submitOralExamScore(
    panelId: string,
    scheduleId: string,
    data: any,
    evaluatorRoles: string[],
  ) {
    return prisma.$transaction(async (tx) => {
      const panel = await tx.panelAssignment.findUnique({
        where: { id: panelId },
      });
      if (!panel || panel.scheduleId !== scheduleId) {
        throw new Error("Panel assignment not found for this defense.");
      }
      if (!evaluatorRoles.includes(panel.role)) {
        throw new Error(
          `Role ${panel.role} cannot submit oral examination scores.`,
        );
      }

      // Persist score only. Completing scores never mutates official outcome (§13.3–13.4).
      const score = await tx.oralExamScore.create({
        data: {
          panelId,
          scheduleId,
          timelinessRelevance: data.timelinessRelevance,
          organization: data.organization,
          depthComprehensiveness: data.depthComprehensiveness,
          relevanceConclusions: data.relevanceConclusions,
          evidenceOriginalThinking: data.evidenceOriginalThinking,
          groupAAverage: data.groupAAverage,
          presentation: data.presentation,
          masterySubject: data.masterySubject,
          communicationSkill: data.communicationSkill,
          attitude: data.attitude,
          groupBAverage: data.groupBAverage,
          overallAverage: data.overallAverage,
          rating: data.rating,
          recommendations: data.recommendations,
          scoredAt: new Date(),
        },
      });

      // Completion is evaluator-only — Adviser/Facilitator/Rapporteur never block.
      const assignedCount = await tx.panelAssignment.count({
        where: { scheduleId, role: { in: evaluatorRoles as any } },
      });
      const submittedCount = await tx.oralExamScore.count({
        where: { scheduleId },
      });

      if (assignedCount > 0 && submittedCount >= assignedCount) {
        // All required evaluator scores are in → AWAITING_CONCLUSION only.
        // Official outcome, OralExamSummary rating, and RAP are created solely by concludeDefense.
        await tx.defenseSchedule.update({
          where: { id: scheduleId },
          data: { sessionStatus: "AWAITING_CONCLUSION" },
        });
      } else if (assignedCount > 0) {
        await tx.defenseSchedule.update({
          where: { id: scheduleId },
          data: { sessionStatus: "IN_PROGRESS" },
        });
      }

      return score;
    });
  }
  async getPendingRapReports(userId: string) {
    // CP7-FIX2: never serialize other users' signature image evidence.
    return prisma.rapReportSignature.findMany({
      where: {
        userId,
        isSigned: false,
      },
      select: {
        id: true,
        rapId: true,
        userId: true,
        roleAtDefense: true,
        required: true,
        isSigned: true,
        signedAt: true,
        rapReport: {
          select: {
            id: true,
            status: true,
            defenseType: true,
            generatedAt: true,
            thesis: {
              select: {
                student: {
                  select: {
                    user: {
                      select: { firstName: true, lastName: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  // CP7: own-signature CAS via RapReportService (PNG evidence + finalizedAt).
  async signRapReport(sigId: string, userId: string, signatureData: string) {
    const { RapReportService } = await import("../services/rap-report.service");
    return new RapReportService().signRapSlot(sigId, userId, signatureData);
  }

  // Get current lobby state
  async getLobbyStatus(scheduleId: string) {
    const schedule = await prisma.defenseSchedule.findUnique({
      where: { id: scheduleId },
      include: {
        panelAssignments: {
          include: {
            user: true,
          }
        },
        oralExamScores: {
          select: { panelId: true, recommendations: true },
        },
        oralExamSummary: true,
        thesis: {
          include: {
            student: {
              include: { user: true },
            },
            thesisTitles: true,
          },
        },
      },
    });

    if (!schedule) throw new Error("Schedule not found");

    return {
      studentName: `${schedule.thesis.student.user.firstName} ${schedule.thesis.student.user.lastName}`,
      defenseType: schedule.defenseType,
      proposedTitles: schedule.thesis.thesisTitles.map((t) => ({
        id: t.id,
        titleText: t.titleText,
        isSelected: t.isSelected,
      })),
      rapporteurNotes: schedule.rapporteurNotes,
      isConcluded: !!schedule.oralExamSummary,
      panelStatuses: schedule.panelAssignments.map((panel: any) => {
        const hasScored = schedule.oralExamScores.some(
          (score) => score.panelId === panel.id,
        );
        return {
          panelId: panel.id,
          userId: panel.userId,
          panelistName: `${panel.user.firstName} ${panel.user.lastName}`,
          role: panel.role,
          status: hasScored ? "Ready" : "Scoring...",
        };
      }),
    };
  }

  // Update Rapporteur Notes
  async updateRapporteurNotes(scheduleId: string, notes: string) {
    return prisma.defenseSchedule.update({
      where: { id: scheduleId },
      data: { rapporteurNotes: notes },
    });
  }

  /**
   * CP7 formal conclusion transaction (Chairman authority).
   * All authoritative checks are re-verified inside the transaction.
   * Creates DefenseConclusion + one RAP + required evaluator signature slots.
   * Never invents OralRating. Never defaults missing outcome to PASSED.
   */
  async concludeDefense(
    scheduleId: string,
    chairmanUserId: string,
    options: {
      outcome: "PASSED" | "REVISION_REQUIRED" | "FAILED";
      selectedTitleId?: string | null;
      finalRemarks?: string | null;
    },
  ) {
    const { RapReportService } = await import("../services/rap-report.service");
    const rapService = new RapReportService();

    return prisma.$transaction(async (tx) => {
      const schedule = await tx.defenseSchedule.findUnique({
        where: { id: scheduleId },
        include: {
          oralExamScores: true,
          panelAssignments: true,
          conclusion: true,
          oralExamSummary: true,
          thesis: {
            include: {
              thesisTitles: true,
              student: { select: { studentNumber: true } },
            },
          },
        },
      });

      if (!schedule) throw new AppError("Defense session not found.", 404);

      // Re-verify Chairman assignment inside the transaction.
      const chairmanAssignment = schedule.panelAssignments.find(
        (p) => p.userId === chairmanUserId && String(p.role) === "CHAIRMAN",
      );
      if (!chairmanAssignment) {
        throw new AppError(
          "Only the assigned session Chairman may record the formal academic result.",
          403,
        );
      }

      if (schedule.conclusion) {
        throw new AppError(
          "Defense has already been concluded. A second conclusion is not allowed.",
          409,
        );
      }

      if (String(schedule.sessionStatus) !== "AWAITING_CONCLUSION") {
        throw new AppError(
          "Formal conclusion requires the session to be awaiting conclusion.",
          409,
        );
      }

      if (!schedule.rapporteurNotesFinalizedAt || !schedule.rapporteurNotes) {
        throw new AppError(
          "Rapporteur defense notes must be finalized before the formal academic result can be recorded.",
          409,
        );
      }

      // CP7-FIX1 Issue 10: RAP generator must be the Rapporteur finalizer — no Chairman fallback.
      const rapporteurFinalizerId = schedule.rapporteurNotesFinalizedById;
      if (!rapporteurFinalizerId) {
        throw new AppError(
          "Rapporteur notes finalizer identity is missing. Official RAP cannot be generated.",
          409,
        );
      }
      const rapporteurAssignment = schedule.panelAssignments.find(
        (p) =>
          p.userId === rapporteurFinalizerId &&
          String(p.role) === "RAPPORTEUR",
      );
      if (!rapporteurAssignment) {
        throw new AppError(
          "Rapporteur notes finalizer is not the assigned session Rapporteur. Data integrity check failed.",
          409,
        );
      }

      const outcome = options.outcome;
      const selectedTitleId = options.selectedTitleId ?? null;
      const finalRemarks =
        options.finalRemarks != null && String(options.finalRemarks).trim() !== ""
          ? String(options.finalRemarks)
          : null;

      const isTitle = String(schedule.defenseType) === "TITLE_DEFENSE";

      // Title: validate selected title only for PASSED.
      if (isTitle && outcome === "PASSED") {
        if (!selectedTitleId) {
          throw new AppError(
            "Title Defense PASSED requires selecting one of the student's proposed titles.",
            400,
          );
        }
        const title = schedule.thesis.thesisTitles.find(
          (t) => t.id === selectedTitleId,
        );
        if (!title) {
          throw new AppError(
            "Selected title must be one of the student's proposed titles.",
            400,
          );
        }
        await tx.thesisTitle.updateMany({
          where: { thesisId: schedule.thesisId },
          data: { isSelected: false },
        });
        await tx.thesisTitle.update({
          where: { id: selectedTitleId },
          data: { isSelected: true },
        });
      } else if (isTitle && outcome !== "PASSED") {
        // Do not fabricate an official selected title for non-PASSED.
        await tx.thesisTitle.updateMany({
          where: { thesisId: schedule.thesisId },
          data: { isSelected: false },
        });
      }

      // Proposal/Final: require evaluator completion + existing Summary.
      if (!isTitle) {
        // CP7-FIX1 Issue 9: centralized evaluator-role policy.
        const evaluatorRoles = new DefenseCommitteePolicy()
          .getEvaluatorRoles(schedule.defenseType as never)
          .map(String);
        const evaluatorAssignments = schedule.panelAssignments.filter((p) =>
          evaluatorRoles.includes(String(p.role)),
        );
        const finalized = schedule.oralExamScores.filter(
          (s) =>
            s.status === "FINALIZED" &&
            evaluatorAssignments.some((a) => a.id === s.panelId),
        );
        if (
          evaluatorAssignments.length === 0 ||
          finalized.length < evaluatorAssignments.length
        ) {
          throw new AppError(
            "All required evaluator evaluations must be finalized before formal conclusion.",
            409,
          );
        }
        if (!schedule.oralExamSummary) {
          throw new AppError(
            "Oral Examination Summary must exist before formal conclusion.",
            409,
          );
        }
      }

      const officialTitle =
        schedule.thesis.thesisTitles.find((t) => t.isSelected)?.titleText ??
        (selectedTitleId
          ? schedule.thesis.thesisTitles.find((t) => t.id === selectedTitleId)
              ?.titleText
          : null) ??
        null;

      // RAP content: finalized Rapporteur notes + FINALIZED evaluator recommendations.
      const evaluatorRoleSet = new Set(
        new DefenseCommitteePolicy()
          .getEvaluatorRoles(schedule.defenseType as never)
          .map(String),
      );
      const panelRecommendations = schedule.oralExamScores
        .filter(
          (s) =>
            s.status === "FINALIZED" &&
            schedule.panelAssignments.some(
              (p) =>
                p.id === s.panelId &&
                evaluatorRoleSet.has(String(p.role)),
            ),
        )
        .map((s) => s.recommendations)
        .filter(Boolean)
        .join("\n\n");

      const rapContent = [
        `Defense Type: ${String(schedule.defenseType)}`,
        officialTitle ? `Official Title: ${officialTitle}` : null,
        `Formal Outcome: ${outcome}`,
        "",
        "=== RAPPORTEUR FINALIZED NOTES ===",
        schedule.rapporteurNotes,
        panelRecommendations
          ? `\n=== EVALUATOR RECOMMENDATIONS ===\n${panelRecommendations}`
          : null,
      ]
        .filter((line) => line !== null)
        .join("\n");

      // Formal conclusion record (sole source of academic outcome).
      const conclusion = await tx.defenseConclusion.create({
        data: {
          scheduleId,
          thesisId: schedule.thesisId,
          outcome,
          selectedTitleId: isTitle ? selectedTitleId : null,
          finalRemarks,
          concludedById: chairmanUserId,
          concludedAt: new Date(),
        },
      });

      // Compat-mirror into ThesisStatus for existing UI. Never invents rating.
      const legacyStatus =
        outcome === "PASSED"
          ? ("PASSED" as const)
          : outcome === "FAILED"
            ? ("FAILED" as const)
            : ("REVISION" as const);
      await tx.thesisRecord.update({
        where: { id: schedule.thesisId },
        data: { outcome, status: legacyStatus },
      });

      await tx.defenseSchedule.update({
        where: { id: scheduleId },
        data: { sessionStatus: "CONCLUDED" },
      });

      // RAP created once. generatedBy = Rapporteur who finalized notes (no Chairman fallback).
      const rapReport = await rapService.createRapAfterConclusion(tx, {
        scheduleId,
        thesisId: schedule.thesisId,
        defenseType: String(schedule.defenseType),
        venue: schedule.venueOrLink,
        selectedTitle: officialTitle,
        decisionsAndRecommendations: rapContent,
        generatedById: rapporteurFinalizerId,
      });

      return { conclusion, rapReport };
    });
  }

  // CP7-FIX2: Admin RAP list — explicit select; never expose signatureData.
  async getAllRapReports() {
    return prisma.rapReport.findMany({
      select: {
        id: true,
        scheduleId: true,
        status: true,
        defenseType: true,
        generatedAt: true,
        finalizedAt: true,
        selectedTitle: true,
        createdAt: true,
        thesis: {
          select: {
            student: {
              select: {
                studentNumber: true,
                user: { select: { firstName: true, lastName: true } },
                program: { select: { programName: true } },
              },
            },
          },
        },
        schedule: {
          select: {
            defenseDate: true,
            defenseType: true,
            panelAssignments: {
              select: { userId: true, role: true },
            },
          },
        },
        signatures: {
          select: {
            id: true,
            userId: true,
            roleAtDefense: true,
            required: true,
            isSigned: true,
            signedAt: true,
            user: {
              select: { firstName: true, lastName: true, email: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * CP7-FIX1 Issue 1: legacy distribute is retired.
   * Never mutates RapReport lifecycle status.
   */
  async distributeRapReport(rapId: string) {
    const { AppError: AE } = await import("../utils/AppError");
    void rapId;
    throw new AE(
      "Manual RAP distribution is retired. Signature routing begins automatically after formal conclusion.",
      409,
    );
  }

  // CP7-FIX2: reminder metadata only — no raw signature evidence.
  async getMissingSignaturesForRap(rapId: string) {
    return prisma.rapReportSignature.findMany({
      where: { rapId, isSigned: false },
      select: {
        id: true,
        rapId: true,
        userId: true,
        roleAtDefense: true,
        required: true,
        isSigned: true,
        signedAt: true,
        user: { select: { firstName: true, lastName: true, email: true } },
        rapReport: {
          select: { id: true, status: true, defenseType: true },
        },
      },
    });
  }
}
