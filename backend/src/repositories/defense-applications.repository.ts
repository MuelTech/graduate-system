import prisma from "../config/database";
import { Prisma } from "@prisma/client";
import {
  pickCurrentDefenseSchedule,
  summarizeCommittee,
  type CommitteeSummary,
  type PanelSeatForSummary,
  type ScheduleForPick,
} from "../services/defense-application-session";
import {
  deriveApplicationWorkflowBucket,
  filterDocumentsForStage,
  matchesStatusRefine,
  pickActiveCurrentStageSchedule,
  resolveDisplayStatus,
  type ApplicationWorkflowBucket,
} from "../services/defense-application-workflow";
import {
  resolveCurrentFinalApplicationDocuments,
  resolveCurrentProposalApplicationDocuments,
} from "../services/proposal-adviser-review.rules";
import type { DefenseStage } from "../interfaces/defense-eligibility.interfaces";

type AppDocRow = {
  id: string;
  docType: string;
  filePath: string;
  defenseStage?: string | null;
  thesisId?: string;
  isCurrent?: boolean | null;
};

/** Safe Admin/read-model document summary (no raw file paths). */
export type ApplicationDocumentDto = {
  id: string;
  docType: string;
  isCurrent: boolean;
};

/**
 * CP3-FIX2: Proposal current application documents use the certified
 * manuscript (ISSUED reviewedDocumentId) only — never all historical revisions.
 * DL-6: only current (isCurrent !== false) supporting evidence is returned;
 * superseded versions are history and are not exposed here.
 */
function resolveApplicationDocuments(row: {
  id: string;
  stage: DefenseStage;
  thesisDocuments: AppDocRow[];
  adviserCertifications?: Array<{
    status: string;
    defenseStage: string;
    reviewedDocumentId: string | null;
  }>;
}): ApplicationDocumentDto[] {
  const scoped = row.thesisDocuments.filter(
    (d) =>
      d.isCurrent !== false &&
      String(d.defenseStage || "").toUpperCase() ===
        String(row.stage || "").toUpperCase(),
  );
  const stageKey = String(row.stage).toUpperCase();
  const certs = row.adviserCertifications ?? [];
  const mapped = scoped.map((d) => ({
    id: d.id,
    thesisId: d.thesisId ?? row.id,
    docType: d.docType,
    defenseStage: d.defenseStage ?? null,
    filePath: d.filePath,
    isCurrent: d.isCurrent ?? true,
  }));

  let resolved = mapped;
  if (stageKey === "PROPOSAL") {
    const cert = certs.find((c) => c.defenseStage === "PROPOSAL_DEFENSE") ?? null;
    resolved = resolveCurrentProposalApplicationDocuments(mapped, cert, row.id);
  } else if (stageKey === "FINAL") {
    // CP4: Final current application uses certified Final manuscript only.
    const cert = certs.find((c) => c.defenseStage === "FINAL_DEFENSE") ?? null;
    resolved = resolveCurrentFinalApplicationDocuments(mapped, cert, row.id);
  }

  // Privacy: expose only safe identifiers, never raw file paths.
  return resolved.map((d) => ({
    id: d.id,
    docType: d.docType,
    isCurrent: (d as { isCurrent?: boolean }).isCurrent ?? true,
  }));
}

export function stageToDefenseType(stage: string): string {
  const map: Record<string, string> = {
    TITLE: "TITLE_DEFENSE",
    PROPOSAL: "PROPOSAL_DEFENSE",
    FINAL: "FINAL_DEFENSE",
  };
  return map[String(stage).toUpperCase()] ?? "TITLE_DEFENSE";
}

export function defenseTypeToStage(defenseType: string): DefenseStage {
  const map: Record<string, DefenseStage> = {
    TITLE_DEFENSE: "TITLE",
    PROPOSAL_DEFENSE: "PROPOSAL",
    FINAL_DEFENSE: "FINAL",
  };
  return map[String(defenseType).toUpperCase()] ?? "TITLE";
}

/** Explicit tab bucket wins. Status is a refine filter, not a re-bucket. */
export function normalizeWorkflowBucketParam(
  bucket?: string,
  status?: string,
): ApplicationWorkflowBucket | "ALL" {
  const b = String(bucket || "").toUpperCase();
  if (
    b === "NEEDS_REVIEW" ||
    b === "READY" ||
    b === "ACTIVE" ||
    b === "HISTORY"
  ) {
    return b;
  }
  const s = String(status || "").toUpperCase();
  if (s === "HISTORY") return "HISTORY";
  if (s === "PENDING") return "NEEDS_REVIEW";
  if (s === "APPROVED") return "READY";
  if (s === "SCHEDULED") return "ACTIVE";
  if (
    s === "REJECTED" ||
    s === "PASSED" ||
    s === "REVISION" ||
    s === "FAILED"
  ) {
    return "HISTORY";
  }
  return "ALL";
}

type SessionRow = ScheduleForPick & {
  defenseDate: Date;
  defenseTime: Date;
  venueOrLink: string | null;
  panelAssignments: PanelSeatForSummary[];
};

function buildStudentWhere(params: {
  search?: string;
  programId?: string;
}): Prisma.ThesisRecordWhereInput {
  const where: Prisma.ThesisRecordWhereInput = {};
  if (params.programId && params.programId !== "ALL") {
    where.student = { programId: params.programId };
  }
  if (params.search && params.search.trim()) {
    const q = params.search.trim();
    where.student = {
      ...(where.student as Prisma.StudentWhereInput),
      OR: [
        { studentNumber: { contains: q } },
        { user: { firstName: { contains: q } } },
        { user: { lastName: { contains: q } } },
        { user: { email: { contains: q } } },
        { program: { programName: { contains: q } } },
      ],
    } satisfies Prisma.StudentWhereInput;
  }
  return where;
}

function applicationInclude() {
  return {
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
      select: {
        id: true,
        docType: true,
        filePath: true,
        defenseStage: true,
        isCurrent: true,
      },
    },
    adviserCertifications: {
      where: {
        status: "ISSUED",
        defenseStage: {
          in: ["PROPOSAL_DEFENSE", "FINAL_DEFENSE"] as Array<
            "PROPOSAL_DEFENSE" | "FINAL_DEFENSE"
          >,
        },
      },
      select: {
        id: true,
        status: true,
        defenseStage: true,
        reviewedDocumentId: true,
      },
      take: 2,
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
  } as const;
}

function mapApplicationRow(row: {
  id: string;
  stage: DefenseStage;
  status: string;
  outcome?: string | null;
  rejectionReason?: string | null;
  createdAt: Date;
  student: unknown;
  thesisTitles: unknown;
  thesisDocuments: Array<{
    id: string;
    docType: string;
    filePath: string;
    defenseStage?: string | null;
    thesisId?: string;
    isCurrent?: boolean | null;
  }>;
  adviserCertifications?: Array<{
    status: string;
    defenseStage: string;
    reviewedDocumentId: string | null;
  }>;
  assignment: unknown;
  defenseSchedules: SessionRow[];
}) {
  const schedules = row.defenseSchedules;
  const workflowBucket = deriveApplicationWorkflowBucket({
    applicationStatus: row.status,
    stage: row.stage,
    schedules,
  });

  // READY: no session. ACTIVE: live session. HISTORY: concluded session context.
  let sessionForDisplay: SessionRow | null = null;
  if (workflowBucket === "ACTIVE") {
    sessionForDisplay = pickActiveCurrentStageSchedule(row.stage, schedules);
  } else if (workflowBucket === "HISTORY") {
    sessionForDisplay = pickCurrentDefenseSchedule(row.stage, schedules);
  }

  const seats = (sessionForDisplay?.panelAssignments ??
    []) as PanelSeatForSummary[];
  const committeeSummary: CommitteeSummary = summarizeCommittee(seats);
  const displayStatus = resolveDisplayStatus({
    workflowBucket,
    applicationStatus: row.status,
    outcome: row.outcome ?? null,
  });

  return {
    id: row.id,
    thesisId: row.id,
    recordKind: "APPLICATION" as const,
    workflowBucket,
    displayStatus,
    stage: row.stage,
    status: displayStatus,
    rawApplicationStatus: row.status,
    outcome: row.outcome ?? null,
    rejectionReason: row.rejectionReason ?? null,
    createdAt: row.createdAt,
    student: row.student,
    thesisTitles: row.thesisTitles,
    thesisDocuments: resolveApplicationDocuments(row),
    assignment: row.assignment,
    currentSchedule: sessionForDisplay
      ? {
          id: sessionForDisplay.id,
          defenseType: sessionForDisplay.defenseType,
          sessionStatus: sessionForDisplay.sessionStatus,
          defenseDate: sessionForDisplay.defenseDate,
          defenseTime: sessionForDisplay.defenseTime,
          venueOrLink: sessionForDisplay.venueOrLink,
          panelAssignments: sessionForDisplay.panelAssignments,
          committeeSummary,
        }
      : null,
  };
}

/**
 * Admin Defense Applications read model (bucketed list, history, summary).
 * Kept out of ThesisRepository so that file stays thesis pipeline + scheduling.
 */
export class DefenseApplicationsRepository {
  async getDefenseApplicationsPaginated(params: {
    page: number;
    pageSize: number;
    search?: string;
    stage?: string;
    status?: string;
    bucket?: string;
    programId?: string;
  }) {
    const { page, pageSize, search, stage, status, bucket, programId } = params;
    const requestedBucket = normalizeWorkflowBucketParam(bucket, status);
    const statusRefine = status && status !== "ALL" ? status : undefined;

    if (requestedBucket === "HISTORY") {
      return this.getDefenseHistoryPaginated({
        page,
        pageSize,
        search,
        stage,
        programId,
        statusRefine,
      });
    }

    const where: Prisma.ThesisRecordWhereInput = {
      ...buildStudentWhere({ search, programId }),
    };
    if (stage && stage !== "ALL") {
      where.stage = stage as DefenseStage;
    }
    if (requestedBucket === "NEEDS_REVIEW") {
      where.status = "PENDING";
    } else if (requestedBucket !== "ALL") {
      where.status = { in: ["APPROVED", "SCHEDULED", "PENDING"] };
    }

    const rows = await prisma.thesisRecord.findMany({
      where,
      include: applicationInclude(),
      orderBy: { createdAt: "desc" },
    });

    const filtered = rows
      .map((row) => mapApplicationRow(row as never))
      .filter((r) =>
        requestedBucket === "ALL"
          ? true
          : r.workflowBucket === requestedBucket,
      )
      .filter((r) => matchesStatusRefine(r.displayStatus, statusRefine));

    const total = filtered.length;
    const start = (page - 1) * pageSize;
    return {
      data: filtered.slice(start, start + pageSize),
      total,
      page,
      pageSize,
    };
  }

  /** Rejected apps + DefenseConclusion history (prior stages survive stage advance). */
  private async getDefenseHistoryPaginated(params: {
    page: number;
    pageSize: number;
    search?: string;
    stage?: string;
    programId?: string;
    statusRefine?: string;
  }) {
    const { page, pageSize, search, stage, programId, statusRefine } = params;
    const studentWhere = buildStudentWhere({ search, programId });

    const historyAppRows = await prisma.thesisRecord.findMany({
      where: {
        ...studentWhere,
        ...(stage && stage !== "ALL" ? { stage: stage as DefenseStage } : {}),
      },
      include: applicationInclude(),
      orderBy: { createdAt: "desc" },
    });

    const conclusionWhere: Prisma.DefenseConclusionWhereInput = {
      thesis: studentWhere,
    };
    if (stage && stage !== "ALL") {
      conclusionWhere.schedule = {
        is: { defenseType: stageToDefenseType(stage) as never },
      };
    }

    const conclusionRows = await prisma.defenseConclusion.findMany({
      where: conclusionWhere,
      include: {
        schedule: {
          include: {
            panelAssignments: {
              include: {
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
        thesis: {
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
                  select: {
                    id: true,
                    programName: true,
                    programType: true,
                  },
                },
              },
            },
            thesisTitles: {
              select: { id: true, titleText: true, isSelected: true },
            },
            thesisDocuments: {
              select: {
                id: true,
                docType: true,
                filePath: true,
                defenseStage: true,
                isCurrent: true,
              },
            },
            adviserCertifications: {
              where: {
                status: "ISSUED",
                defenseStage: {
          in: ["PROPOSAL_DEFENSE", "FINAL_DEFENSE"] as Array<
            "PROPOSAL_DEFENSE" | "FINAL_DEFENSE"
          >,
        },
              },
              select: {
                id: true,
                status: true,
                defenseStage: true,
                reviewedDocumentId: true,
              },
              take: 2,
            },
            assignment: {
              include: {
                adviser: {
                  select: { id: true, firstName: true, lastName: true },
                },
              },
            },
          },
        },
      },
      orderBy: { concludedAt: "desc" },
    });

    const conclusionMapped = conclusionRows.map((c) => {
      const seats = (c.schedule.panelAssignments ??
        []) as unknown as PanelSeatForSummary[];
      const stageName = defenseTypeToStage(c.schedule.defenseType);
      const displayStatus = resolveDisplayStatus({
        workflowBucket: "HISTORY",
        applicationStatus: "PASSED",
        outcome: c.outcome,
      });
      return {
        id: c.id,
        thesisId: c.thesisId,
        recordKind: "DEFENSE_HISTORY" as const,
        workflowBucket: "HISTORY" as ApplicationWorkflowBucket,
        displayStatus,
        stage: stageName,
        status: displayStatus,
        rawApplicationStatus: null as string | null,
        outcome: c.outcome,
        selectedTitleId: c.selectedTitleId ?? null,
        rejectionReason: null as string | null,
        createdAt: c.concludedAt,
        concludedAt: c.concludedAt,
        student: c.thesis.student,
        thesisTitles: c.thesis.thesisTitles,
        // Scope to THIS history record's stage (not ThesisRecord.current stage).
        // CP3-FIX2: Proposal history prefers certified manuscript authority.
        thesisDocuments: resolveApplicationDocuments({
          id: c.thesisId,
          stage: stageName,
          thesisDocuments: c.thesis.thesisDocuments.map((d) => ({
            ...d,
            thesisId: c.thesisId,
          })),
          adviserCertifications: (c.thesis as { adviserCertifications?: Array<{
            status: string;
            defenseStage: string;
            reviewedDocumentId: string | null;
          }> }).adviserCertifications,
        }),
        assignment: c.thesis.assignment,
        currentSchedule: {
          id: c.schedule.id,
          defenseType: c.schedule.defenseType,
          sessionStatus: c.schedule.sessionStatus,
          defenseDate: c.schedule.defenseDate,
          defenseTime: c.schedule.defenseTime,
          venueOrLink: c.schedule.venueOrLink,
          panelAssignments: c.schedule.panelAssignments,
          committeeSummary: summarizeCommittee(seats),
        },
        sortAt: c.concludedAt,
      };
    });

    const conclusionKeys = new Set(
      conclusionMapped.map((c) => `${c.thesisId}:${c.stage}`),
    );

    const historyAppMapped = historyAppRows
      .map((row) => ({ ...mapApplicationRow(row as never), sortAt: row.createdAt }))
      .filter((r) => r.workflowBucket === "HISTORY")
      .filter((r) => !conclusionKeys.has(`${r.thesisId}:${r.stage}`));

    const all = [...historyAppMapped, ...conclusionMapped]
      .filter((r) => matchesStatusRefine(r.displayStatus, statusRefine))
      .sort((a, b) => new Date(b.sortAt).getTime() - new Date(a.sortAt).getTime());

    const total = all.length;
    const start = (page - 1) * pageSize;
    return {
      data: all
        .slice(start, start + pageSize)
        .map(({ sortAt: _sortAt, ...row }) => row),
      total,
      page,
      pageSize,
    };
  }

  async getDefenseWorkflowSummary(params: {
    search?: string;
    stage?: string;
    programId?: string;
    status?: string;
  }) {
    const counts = {
      NEEDS_REVIEW: 0,
      READY: 0,
      ACTIVE: 0,
      HISTORY: 0,
    } as Record<ApplicationWorkflowBucket, number>;

    for (const bucket of [
      "NEEDS_REVIEW",
      "READY",
      "ACTIVE",
      "HISTORY",
    ] as const) {
      const result = await this.getDefenseApplicationsPaginated({
        page: 1,
        pageSize: 1,
        bucket,
        search: params.search,
        stage: params.stage,
        programId: params.programId,
        status: params.status,
      });
      counts[bucket] = result.total;
    }
    return counts;
  }
}
