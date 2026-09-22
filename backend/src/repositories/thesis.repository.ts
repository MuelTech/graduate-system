import prisma from "../config/database";
import {
  pickCurrentDefenseSchedule,
  summarizeCommittee,
  type CommitteeSummary,
  type PanelSeatForSummary,
} from "../services/defense-application-session";
import {
  rapStatusAfterSignatures,
  resolveRapSignatureRequirements,
} from "../services/rap-signature.policy";

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
          select: { role: true },
        },
        oralExamScores: { select: { id: true } },
      },
    });
    if (!schedule) return null;

    const evaluatorRoles = new Set(["CHAIRMAN", "PANELIST"]);
    const evaluatorAssignments = schedule.panelAssignments.filter((p) =>
      evaluatorRoles.has(p.role),
    ).length;

    return {
      defenseType: schedule.defenseType as string,
      alreadyConcluded: !!schedule.conclusion,
      evaluatorAssignments,
      submittedEvaluatorScores: schedule.oralExamScores.length,
      thesisTitleIds: schedule.thesis.thesisTitles.map((t) => t.id),
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

  /**
   * Server-side paginated defense applications for Admin review UI.
   * Filters: stage, status, programId + search on name/number/email/program.
   */
  async getDefenseApplicationsPaginated(params: {
    page: number;
    pageSize: number;
    search?: string;
    stage?: string;
    status?: string;
    programId?: string;
  }) {
    const { page, pageSize, search, stage, status, programId } = params;
    const where: Record<string, unknown> = {};

    if (stage && stage !== "ALL") {
      where.stage = stage;
    }
    if (status && status !== "ALL") {
      if (status === "HISTORY") {
        where.status = {
          in: ["REJECTED", "PASSED", "REVISION", "FAILED"],
        };
      } else {
        where.status = status;
      }
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

    const [rows, total] = await prisma.$transaction([
      prisma.thesisRecord.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          student: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
              program: {
                select: { id: true, programName: true, programType: true },
              },
            },
          },
          thesisTitles: {
            select: { id: true, titleText: true, isSelected: true },
          },
          thesisDocuments: {
            select: { id: true, docType: true, filePath: true },
          },
          assignment: {
            include: {
              adviser: {
                select: { id: true, firstName: true, lastName: true },
              },
            },
          },
          defenseSchedules: {
            orderBy: { createdAt: "desc" as const },
            select: {
              id: true,
              defenseType: true,
              sessionStatus: true,
              defenseDate: true,
              defenseTime: true,
              venueOrLink: true,
              createdAt: true,
              panelAssignments: {
                select: {
                  role: true,
                  user: {
                    select: {
                      id: true,
                      firstName: true,
                      lastName: true,
                      email: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.thesisRecord.count({ where }),
    ]);

    // Attach the CURRENT stage's session + committee (not defenseSchedules[0]).
    const data = rows.map((row) => {
      const currentSchedule = pickCurrentDefenseSchedule(row.stage, row.defenseSchedules);
      const seats = (currentSchedule?.panelAssignments ?? []) as PanelSeatForSummary[];
      const committeeSummary: CommitteeSummary = summarizeCommittee(seats);
      const { defenseSchedules, ...rest } = row;
      return {
        ...rest,
        currentSchedule: currentSchedule
          ? {
              id: currentSchedule.id,
              defenseType: currentSchedule.defenseType,
              sessionStatus: currentSchedule.sessionStatus,
              defenseDate: currentSchedule.defenseDate,
              defenseTime: currentSchedule.defenseTime,
              venueOrLink: currentSchedule.venueOrLink,
              panelAssignments: currentSchedule.panelAssignments,
              committeeSummary,
            }
          : null,
      };
    });

    return { data, total, page, pageSize };
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

  async createTitleDefense(
    studentId: string,
    assignmentId: string | null,
    titles: string[],
    conceptPaperPath: string,
    corPath: string,
    receiptPath: string,
  ) {
    return prisma.$transaction(async (tx) => {
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

      // 3. Stage-scoped Title evidence (§16) — package + COR + fee proof
      await tx.thesisDocument.createMany({
        data: [
          {
            thesisId: thesis.id,
            docType: "TITLE_PROPOSAL",
            defenseStage: "TITLE",
            filePath: conceptPaperPath,
            uploadedAt: new Date(),
          },
          {
            thesisId: thesis.id,
            docType: "COR",
            defenseStage: "TITLE",
            filePath: corPath,
            uploadedAt: new Date(),
          },
          {
            thesisId: thesis.id,
            docType: "RECEIPT",
            defenseStage: "TITLE",
            filePath: receiptPath,
            uploadedAt: new Date(),
          },
        ],
      });

      return thesis;
    });
  }

  async updateThesisToProposal(
    thesisId: string,
    filePath: string,
    corPath: string,
    receiptPath: string,
  ) {
    return prisma.$transaction(async (tx) => {
      // New stage application starts a fresh review cycle; clear prior outcome
      // so Title PASSED cannot be mistaken for Proposal PASSED.
      const thesis = await tx.thesisRecord.update({
        where: { id: thesisId },
        data: { stage: "PROPOSAL", status: "PENDING", outcome: null },
      });

      // Proposal-scoped evidence only (Title package/receipt never counts here).
      await tx.thesisDocument.createMany({
        data: [
          {
            thesisId,
            docType: "PROPOSAL_CHAPTERS",
            defenseStage: "PROPOSAL",
            filePath: filePath,
            uploadedAt: new Date(),
          },
          {
            thesisId,
            docType: "COR",
            defenseStage: "PROPOSAL",
            filePath: corPath,
            uploadedAt: new Date(),
          },
          {
            thesisId,
            docType: "RECEIPT",
            defenseStage: "PROPOSAL",
            filePath: receiptPath,
            uploadedAt: new Date(),
          },
        ],
      });

      return thesis;
    });
  }

  async updateThesisToFinal(
    thesisId: string,
    filePath: string,
    corPath: string,
    receiptPath: string,
  ) {
    return prisma.$transaction(async (tx) => {
      const thesis = await tx.thesisRecord.update({
        where: { id: thesisId },
        data: { stage: "FINAL", status: "PENDING", outcome: null },
      });

      await tx.thesisDocument.createMany({
        data: [
          {
            thesisId,
            docType: "FINAL_MANUSCRIPT",
            defenseStage: "FINAL",
            filePath: filePath,
            uploadedAt: new Date(),
          },
          {
            thesisId,
            docType: "COR",
            defenseStage: "FINAL",
            filePath: corPath,
            uploadedAt: new Date(),
          },
          {
            thesisId,
            docType: "RECEIPT",
            defenseStage: "FINAL",
            filePath: receiptPath,
            uploadedAt: new Date(),
          },
        ],
      });

      return thesis;
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
        // Temporary placeholder until admin approves
        approvedById: requestedAdviserId,
      },
    });
  }

  async approveAdviserRequest(
    requestId: string,
    adviserId: string,
    adminId: string,
  ) {
    return prisma.$transaction(async (tx) => {
      const request = await tx.adviserRequest.update({
        where: { id: requestId },
        data: { status: "APPROVED", approvedById: adminId },
      });

      const assignment = await tx.adviserAssignment.create({
        data: {
          studentId: request.studentId,
          adviserId: adviserId,
          assignedDate: new Date(),
        },
      });
      return assignment;
    });
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
    return prisma.panelAssignment.findMany({
      where: { userId },
      include: {
        schedule: {
          include: {
            thesis: {
              include: {
                student: {
                  include: {
                    user: true,
                  },
                },
                thesisDocuments: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
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
    return prisma.rapReportSignature.findMany({
      where: {
        userId,
        isSigned: false,
      },
      include: {
        rapReport: {
          include: {
            thesis: {
              include: {
                student: {
                  include: {
                    user: true,
                  },
                },
              },
            },
            schedule: true,
          },
        },
      },
    });
  }

  // Securely save the Base64 signature and server timestamp
  async signRapReport(sigId: string, userId: string, signatureData: string) {
    const signature = await prisma.rapReportSignature.findFirst({
      where: { id: sigId, userId, isSigned: false },
    });

    if (!signature)
      throw new Error("Signature request not found or already signed!");

    return prisma.$transaction(async (tx) => {
      const signed = await tx.rapReportSignature.update({
        where: { id: sigId },
        data: {
          isSigned: true,
          signatureData,
          signedAt: new Date(),
        },
      });

      const slots = await tx.rapReportSignature.findMany({
        where: { rapId: signature.rapId },
        select: { required: true, isSigned: true },
      });

      // Only required signatories block finalization (form policy UNRESOLVED).
      const nextStatus = rapStatusAfterSignatures(slots);
      await tx.rapReport.update({
        where: { id: signature.rapId },
        data: {
          status:
            nextStatus === "FINALIZED"
              ? "FINALIZED"
              : nextStatus === "PARTIALLY_SIGNED"
                ? "PARTIALLY_SIGNED"
                : "FOR_SIGNATURE",
        },
      });

      return signed;
    });
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
   * Defense conclusion: records outcome, optionally selects the winning title
   * (Title Defense only), and opens a DRAFT Rapporteur Report task.
   * Only PASSED unlocks the next academic stage.
   */
  async concludeDefense(
    scheduleId: string,
    generatedById: string,
    options?: {
      outcome?: "PASSED" | "REVISION" | "REVISION_REQUIRED" | "FAILED";
      selectedTitleId?: string | null;
    },
  ) {
    return prisma.$transaction(async (tx) => {
      const schedule = await tx.defenseSchedule.findUnique({
        where: { id: scheduleId },
        include: {
          oralExamScores: true,
          panelAssignments: true,
          conclusion: true,
          thesis: { include: { thesisTitles: true } },
        },
      });

      if (!schedule) throw new Error("Schedule not found");
      if (schedule.conclusion) {
        throw new Error(
          "Defense has already been concluded. A second conclusion is not allowed.",
        );
      }

      const rawOutcome = options?.outcome ?? "PASSED";
      const outcome =
        rawOutcome === "REVISION" || rawOutcome === "REVISION_REQUIRED"
          ? ("REVISION_REQUIRED" as const)
          : rawOutcome === "FAILED"
            ? ("FAILED" as const)
            : ("PASSED" as const);
      const selectedTitleId = options?.selectedTitleId ?? null;

      // Title Defense conclusion must pick one of the student's proposed titles.
      if (schedule.defenseType === "TITLE_DEFENSE") {
        if (!selectedTitleId) {
          throw new Error(
            "Title Defense conclusion requires selecting an approved research title.",
          );
        }
        const title = schedule.thesis.thesisTitles.find(
          (t) => t.id === selectedTitleId,
        );
        if (!title) {
          throw new Error(
            "Selected title must be one of the student's proposed titles.",
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
      }

      const selectedTitle =
        schedule.thesis.thesisTitles.find((t) => t.isSelected)?.titleText ??
        schedule.thesis.thesisTitles.find((t) => t.id === selectedTitleId)
          ?.titleText ??
        "No Title";

      const panelRecommendations = schedule.oralExamScores
        .map((s) => s.recommendations)
        .filter(Boolean)
        .join("\n\n");
      const finalDecisions = `=== RAPPORTEUR NOTES ===\n${schedule.rapporteurNotes || ""}\n\n=== PANEL ===\n${panelRecommendations}`;

      const scoreCount = schedule.oralExamScores.length;
      const finalAverage = scoreCount
        ? schedule.oralExamScores.reduce(
            (acc, s) => acc + Number(s.overallAverage ?? 0),
            0,
          ) / scoreCount
        : 0;

      await tx.oralExamSummary.create({
        data: {
          scheduleId,
          overallAverage: finalAverage,
          finalRating:
            outcome === "PASSED"
              ? "VS"
              : outcome === "REVISION_REQUIRED"
                ? "S"
                : "BS",
          finalRemarks: `Defense outcome: ${outcome}`,
          attestedById: generatedById,
        },
      });

      // Formal conclusion record (sole source of academic outcome).
      const conclusion = await tx.defenseConclusion.create({
        data: {
          scheduleId,
          thesisId: schedule.thesisId,
          outcome,
          selectedTitleId:
            schedule.defenseType === "TITLE_DEFENSE" ? selectedTitleId : null,
          finalRemarks: `Defense outcome: ${outcome}`,
          concludedById: generatedById,
          concludedAt: new Date(),
        },
      });

      // Persist formal outcome. Compat-mirror into ThesisStatus for existing UI (Phase G).
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

      // Draft RAP only â€” Rapporteur must submit post-defense summary before completion.
      const rapReport = await tx.rapReport.create({
        data: {
          scheduleId,
          thesisId: schedule.thesisId,
          defenseType: schedule.defenseType,
          reportDate: new Date(),
          decisionsAndRecommendations: finalDecisions,
          selectedTitle,
          status: "FOR_SIGNATURE",
          generatedById,
        },
      });

      // Signature slots from policy (form-specific sets UNRESOLVED — interim all participants).
      const signatureRequirements = resolveRapSignatureRequirements(
        schedule.panelAssignments.map((p) => ({
          userId: p.userId,
          role: p.role as string,
        })),
        schedule.defenseType as string,
      );
      await tx.rapReportSignature.createMany({
        data: signatureRequirements.map((req) => ({
          rapId: rapReport.id,
          userId: req.userId,
          roleAtDefense: req.roleAtDefense,
          required: req.required,
        })),
      });

      return { conclusion, rapReport };
    });
  }

  // Fetch ALL RAP Reports for Admin Management Page
  async getAllRapReports() {
    return prisma.rapReport.findMany({
      include: {
        thesis: {
          include: {
            student: {
              include: { user: true, program: true },
            },
          },
        },
        schedule: {
          include: {
            panelAssignments: {
              include: { user: true },
            },
          },
        },
        signatures: {
          include: {
            user: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  // Update RAP Report status to DISTRIBUTED
  async distributeRapReport(rapId: string) {
    return prisma.rapReport.update({
      where: { id: rapId },
      data: { status: "DISTRIBUTED" },
      include: {
        signatures: { include: { user: true } },
      },
    });
  }

  // Fetch missing signatures to remind them
  async getMissingSignaturesForRap(rapId: string) {
    return prisma.rapReportSignature.findMany({
      where: { rapId, isSigned: false },
      include: { user: true, rapReport: true },
    });
  }
}
