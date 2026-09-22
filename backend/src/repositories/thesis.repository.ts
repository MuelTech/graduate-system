import prisma from "../config/database";

export class ThesisRepository {
  async getStudentByUserId(userId: string) {
    return prisma.student.findUnique({ where: { userId } });
  }

  async getStudentById(studentId: string) {
    return prisma.student.findUnique({ where: { id: studentId } });
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

    const [data, total] = await prisma.$transaction([
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
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.thesisRecord.count({ where }),
    ]);

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

      // 3. Save the uploaded concept paper, cor, and receipt
      await tx.thesisDocument.createMany({
        data: [
          {
            thesisId: thesis.id,
            docType: "PROPOSAL_CHAPTERS",
            filePath: conceptPaperPath,
            uploadedAt: new Date(),
          },
          {
            thesisId: thesis.id,
            docType: "COR",
            filePath: corPath,
            uploadedAt: new Date(),
          },
          {
            thesisId: thesis.id,
            docType: "RECEIPT",
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
  ) {
    return prisma.$transaction(async (tx) => {
      const thesis = await tx.thesisRecord.update({
        where: { id: thesisId },
        data: { stage: "PROPOSAL", status: "PENDING" },
      });

      await tx.thesisDocument.createMany({
        data: [
          {
            thesisId,
            docType: "PROPOSAL_CHAPTERS",
            filePath: filePath,
            uploadedAt: new Date(),
          },
          {
            thesisId,
            docType: "COR",
            filePath: corPath,
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
  ) {
    return prisma.$transaction(async (tx) => {
      const thesis = await tx.thesisRecord.update({
        where: { id: thesisId },
        data: { stage: "FINAL", status: "PENDING" },
      });

      await tx.thesisDocument.createMany({
        data: [
          {
            thesisId,
            docType: "FINAL_MANUSCRIPT",
            filePath: filePath,
            uploadedAt: new Date(),
          },
          {
            thesisId,
            docType: "COR",
            filePath: corPath,
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
    status: "PENDING" | "APPROVED" | "REJECTED" | "SCHEDULED" | "PASSED" | "FAILED" | "REVISION",
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

      // Save the individual evaluator's score
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

      // Completion is evaluator-only â€” Adviser/Facilitator/Rapporteur never block.
      const assignedCount = await tx.panelAssignment.count({
        where: { scheduleId, role: { in: evaluatorRoles as any } },
      });

      const submittedCount = await tx.oralExamScore.count({
        where: { scheduleId },
      });

      if (assignedCount > 0 && submittedCount >= assignedCount) {
        // All panelists have submitted
        // Calculate the grand final summary
        const allScores = await tx.oralExamScore.findMany({
          where: { scheduleId },
        });

        const grandOverAllAverage =
          allScores.reduce((acc, s) => acc + Number(s.overallAverage), 0) /
          submittedCount;
        let finalRating: any = "PASSED";
        if (grandOverAllAverage >= 1.0 && grandOverAllAverage <= 1.25)
          finalRating = "PASSED_WITH_MERIT";
        else if (grandOverAllAverage >= 3.0) finalRating = "FAILED";

        await tx.oralExamSummary.create({
          data: {
            scheduleId,
            overallAverage: grandOverAllAverage,
            finalRating,
          },
        });

        const scheduleRecord = await tx.defenseSchedule.findUnique({
          where: { id: scheduleId },
        });

        if (scheduleRecord) {
          // Update the Thesis status to PASSED or FAILED
          await tx.thesisRecord.update({
            where: { id: scheduleRecord.thesisId },
            data: { status: finalRating === "FAILED" ? "FAILED" : "PASSED" },
          });

          //Automated RAP Report Generation
          const rapReport = await tx.rapReport.create({
            data: {
              scheduleId,
              thesisId: scheduleRecord.thesisId,
              defenseType: scheduleRecord.defenseType,
              status: "DRAFT",

              generatedAt: new Date(),
            },
          });

          // Auto-assign all panelists to digitally sign this report
          const assignments = await tx.panelAssignment.findMany({
            where: { scheduleId },
          });

          for (const assignment of assignments) {
            await tx.rapReportSignature.create({
              data: {
                rapId: rapReport.id,
                userId: assignment.userId,
                isSigned: false,
              },
            });
          }
        }
      }

      return score;
    });
  }

  // Fetch RAP Reports assigned to this panelist that still need their signature
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
      // Update the signature record
      const signed = await tx.rapReportSignature.update({
        where: { id: sigId },
        data: {
          isSigned: true,
          signatureData,
          signedAt: new Date(), // Secure server-side timestamp
        },
      });

      // Check if all panelists have signed the RAP report
      const pendingSignatures = await tx.rapReportSignature.count({
        where: { rapId: signature.rapId, isSigned: false },
      });

      // If everyone has signed, move the report status from DRAFT to FINALIZED
      if (pendingSignatures === 0) {
        await tx.rapReport.update({
          where: { id: signature.rapId },
          data: { status: "FINALIZED" },
        });
      }

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
      outcome?: "PASSED" | "REVISION" | "FAILED";
      selectedTitleId?: string | null;
    },
  ) {
    return prisma.$transaction(async (tx) => {
      const schedule = await tx.defenseSchedule.findUnique({
        where: { id: scheduleId },
        include: {
          oralExamScores: true,
          panelAssignments: true,
          thesis: { include: { thesisTitles: true } },
        },
      });

      if (!schedule) throw new Error("Schedule not found");

      const outcome = options?.outcome ?? "PASSED";
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
            outcome === "PASSED" ? "VS" : outcome === "REVISION" ? "S" : "BS",
          finalRemarks: `Defense outcome: ${outcome}`,
          attestedById: generatedById,
        },
      });

      // Thesis stage status: only PASSED unlocks the next defense stage.
      await tx.thesisRecord.update({
        where: { id: schedule.thesisId },
        data: { status: outcome },
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
          status: "DRAFT",
          generatedById,
        },
      });

      // Required defense participants get signature slots (not oral-score-dependent).
      await tx.rapReportSignature.createMany({
        data: schedule.panelAssignments.map((panel) => ({
          rapId: rapReport.id,
          userId: panel.userId,
        })),
      });

      return rapReport;
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
