/**
 * CP6 — Role-aware Defense Workspace read model.
 * Academic authority stays with CP5 evaluator lifecycle + CP7 conclusion.
 * This service is presentation/session context only.
 */
import prisma from "../config/database";
import { AppError } from "../utils/AppError";
import { DefenseCommitteePolicy } from "./defense-committee.policy";
import { isEvaluatorRole, assertEvaluationSessionEditable } from "./oral-evaluation.rules";
import { selectCertifiedProposalManuscript, selectCertifiedFinalManuscript } from "./proposal-adviser-review.rules";

const committeePolicy = new DefenseCommitteePolicy();

const DOC_BY_DEFENSE: Record<
  string,
  { docType: string; defenseStage: string }
> = {
  TITLE_DEFENSE: { docType: "TITLE_PROPOSAL", defenseStage: "TITLE" },
  PROPOSAL_DEFENSE: { docType: "PROPOSAL_CHAPTERS", defenseStage: "PROPOSAL" },
  FINAL_DEFENSE: { docType: "FINAL_MANUSCRIPT", defenseStage: "FINAL" },
};

export type WorkspaceRole =
  | "CHAIRMAN"
  | "PANELIST"
  | "RAPPORTEUR"
  | "FACILITATOR"
  | "ADVISER"
  | string;

export interface DefenseWorkspaceDto {
  schedule: {
    id: string;
    defenseType: string;
    sessionStatus: string;
    defenseDate: string | null;
    defenseTime: string | null;
    venueOrLink: string | null;
  };
  student: {
    id: string | null;
    studentNumber: string | null;
    name: string;
    program: string | null;
  };
  myAssignment: {
    panelAssignmentId: string;
    role: WorkspaceRole;
  };
  capabilities: {
    canEvaluate: boolean;
    canEditRapporteurNotes: boolean;
    canViewTitleDeliberation: boolean;
    canViewTitleChairmanResult: boolean;
    canFinalizeRapporteurNotes: boolean;
    canRecordFormalResult: boolean;
    canViewFinalizedRapporteurNotes: boolean;
  };
  documents: Array<{
    id: string;
    docType: string;
    defenseStage: string | null;
    uploadedAt: string | null;
    displayName: string;
  }>;
  proposedTitles: Array<{ id: string; titleText: string }>;
  roster: Array<{
    userId: string;
    name: string;
    role: string;
    evaluationStatus: "NOT_STARTED" | "DRAFT" | "FINALIZED" | "NONE";
  }>;
  rapporteurDraft: { notes: string | null } | null;
  rapporteurNotesFinalizedAt: string | null;
  evaluationStatus: "NOT_STARTED" | "DRAFT" | "FINALIZED" | "NONE";
  sessionStatus: string;
  conclusionsPresent: boolean;
  evaluationProgress: {
    evaluatorAssignments: number;
    finalizedEvaluations: number;
  };
  oralSummary: {
    ready: boolean;
    overallAverage: number | null;
    finalRating: string | null;
  } | null;
  formalResult: string | null;
  rapStatus: string | null;
}

function wallDate(v: Date | null | undefined): string | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function wallTime(v: Date | null | undefined): string | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export class DefenseWorkspaceService {
  private async resolveOwnAssignment(scheduleId: string, userId: string) {
    const assignment = await prisma.panelAssignment.findFirst({
      where: { scheduleId, userId },
    });
    if (!assignment) {
      throw new AppError("You are not assigned to this defense session.", 403);
    }
    return assignment;
  }

  async getWorkspace(
    scheduleId: string,
    userId: string,
  ): Promise<DefenseWorkspaceDto> {
    const schedule = await prisma.defenseSchedule.findUnique({
      where: { id: scheduleId },
      include: {
        thesis: {
          include: {
            student: {
              include: {
                user: {
                  select: { firstName: true, lastName: true },
                },
                program: { select: { programName: true, programType: true } },
              },
            },
            thesisTitles: {
              select: { id: true, titleText: true },
            },
            thesisDocuments: {
              where: {
                docType: {
                  in: ["TITLE_PROPOSAL", "PROPOSAL_CHAPTERS", "FINAL_MANUSCRIPT"],
                },
              },
              select: {
                id: true,
                docType: true,
                defenseStage: true,
                uploadedAt: true,
                thesisId: true,
              },
              orderBy: { uploadedAt: "desc" },
            },
            adviserCertifications: {
              where: {
                status: "ISSUED",
                defenseStage: {
                  in: ["PROPOSAL_DEFENSE", "FINAL_DEFENSE"],
                },
              },
              select: {
                defenseStage: true,
                reviewedDocumentId: true,
                status: true,
              },
              take: 2,
            },
          },
        },
        panelAssignments: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        },
        oralExamScores: {
          select: { panelId: true, status: true },
        },
        conclusion: {
          select: { id: true, outcome: true },
        },
        oralExamSummary: {
          select: { id: true, overallAverage: true, finalRating: true },
        },
        rapReports: {
          select: { status: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });
    if (!schedule) throw new AppError("Defense session not found.", 404);

    // CP6: assignment auth BEFORE role-safe DTO assembly.
    const myAssignment = await this.resolveOwnAssignment(scheduleId, userId);
    const role = String(myAssignment.role) as WorkspaceRole;
    const defenseType = String(schedule.defenseType);
    const isEvaluator = isEvaluatorRole(role) && defenseType !== "TITLE_DEFENSE";
    const canEditRapporteurNotes = role === "RAPPORTEUR";
    const canViewTitleDeliberation =
      defenseType === "TITLE_DEFENSE" &&
      (role === "CHAIRMAN" || role === "PANELIST");
    // CP6-FIX1: Chairman-only formal-result informational block.
    const canViewTitleChairmanResult =
      defenseType === "TITLE_DEFENSE" && role === "CHAIRMAN";

    const allDocs = schedule.thesis?.thesisDocuments ?? [];
    const thesisId = schedule.thesisId;
    const certs = schedule.thesis?.adviserCertifications ?? [];
    let docs: Array<{
      id: string;
      docType: string;
      defenseStage: string | null;
      uploadedAt: string | null;
      displayName: string;
    }> = [];

    if (defenseType === "PROPOSAL_DEFENSE") {
      const cert = certs.find((c) => c.defenseStage === "PROPOSAL_DEFENSE");
      const exact = selectCertifiedProposalManuscript(
        allDocs.map((d) => ({
          id: d.id,
          thesisId: d.thesisId ?? thesisId,
          docType: d.docType,
          defenseStage: d.defenseStage ?? null,
        })),
        cert ?? null,
        thesisId,
      );
      if (!exact) {
        throw new AppError(
          "Certified defense manuscript is unavailable for this session.",
          409,
        );
      }
      docs = [
        {
          id: exact.id,
          docType: exact.docType,
          defenseStage: exact.defenseStage,
          uploadedAt:
            allDocs.find((d) => d.id === exact.id)?.uploadedAt?.toISOString() ??
            null,
          displayName: "Certified Proposal Manuscript",
        },
      ];
    } else if (defenseType === "FINAL_DEFENSE") {
      const cert = certs.find((c) => c.defenseStage === "FINAL_DEFENSE");
      const exact = selectCertifiedFinalManuscript(
        allDocs.map((d) => ({
          id: d.id,
          thesisId: d.thesisId ?? thesisId,
          docType: d.docType,
          defenseStage: d.defenseStage ?? null,
        })),
        cert ?? null,
        thesisId,
      );
      if (!exact) {
        throw new AppError(
          "Certified defense manuscript is unavailable for this session.",
          409,
        );
      }
      docs = [
        {
          id: exact.id,
          docType: exact.docType,
          defenseStage: exact.defenseStage,
          uploadedAt:
            allDocs.find((d) => d.id === exact.id)?.uploadedAt?.toISOString() ??
            null,
          displayName: "Certified Final Manuscript",
        },
      ];
    } else {
      const docRule = DOC_BY_DEFENSE[defenseType];
      docs = allDocs
        .filter(
          (d) =>
            docRule &&
            d.docType === docRule.docType &&
            (d.defenseStage === docRule.defenseStage || d.defenseStage == null),
        )
        .slice(0, 1)
        .map((d) => ({
          id: d.id,
          docType: d.docType,
          defenseStage: d.defenseStage,
          uploadedAt: d.uploadedAt ? d.uploadedAt.toISOString() : null,
          displayName: "Title Defense Proposal Package",
        }));
    }

    const evaluationByPanel = new Map(
      schedule.oralExamScores.map((s) => [s.panelId, s.status as string]),
    );

    const roster = schedule.panelAssignments.map((pa) => {
      const r = String(pa.role);
      let evaluationStatus: DefenseWorkspaceDto["roster"][number]["evaluationStatus"] =
        "NONE";
      if (isEvaluatorRole(r) && defenseType !== "TITLE_DEFENSE") {
        const st = evaluationByPanel.get(pa.id);
        evaluationStatus =
          st === "FINALIZED"
            ? "FINALIZED"
            : st === "DRAFT"
              ? "DRAFT"
              : "NOT_STARTED";
      }
      return {
        userId: pa.user.id,
        name: `${pa.user.firstName} ${pa.user.lastName}`,
        role: r,
        evaluationStatus,
      };
    });

    const myScore = evaluationByPanel.get(myAssignment.id);
    const evaluationStatus: DefenseWorkspaceDto["evaluationStatus"] =
      !isEvaluator || defenseType === "TITLE_DEFENSE"
        ? "NONE"
        : myScore === "FINALIZED"
          ? "FINALIZED"
          : myScore === "DRAFT"
            ? "DRAFT"
            : "NOT_STARTED";

    // CP7 readiness
    const evaluatorRoles = committeePolicy
      .getEvaluatorRoles(defenseType as never)
      .map(String);
    const evaluatorAssignments = schedule.panelAssignments.filter((p) =>
      evaluatorRoles.includes(String(p.role)),
    );
    const finalizedEvaluations = evaluatorAssignments.filter(
      (p) => evaluationByPanel.get(p.id) === "FINALIZED",
    ).length;
    const notesFinalizedAt = schedule.rapporteurNotesFinalizedAt ?? null;
    const isChairman = role === "CHAIRMAN";
    const canFinalizeRapporteurNotes =
      role === "RAPPORTEUR" && !notesFinalizedAt;
    const canViewFinalizedRapporteurNotes =
      Boolean(notesFinalizedAt) &&
      (isChairman || role === "RAPPORTEUR") &&
      !schedule.conclusion;
    const summaryReady = Boolean(schedule.oralExamSummary);
    const canRecordFormalResult =
      isChairman &&
      !schedule.conclusion &&
      String(schedule.sessionStatus) === "AWAITING_CONCLUSION" &&
      Boolean(notesFinalizedAt) &&
      (defenseType === "TITLE_DEFENSE" || summaryReady);

    return {
      schedule: {
        id: schedule.id,
        defenseType,
        sessionStatus: schedule.sessionStatus,
        defenseDate: wallDate(schedule.defenseDate),
        defenseTime: wallTime(schedule.defenseTime),
        venueOrLink: schedule.venueOrLink ?? null,
      },
      student: {
        id: schedule.thesis?.student?.id ?? null,
        studentNumber: schedule.thesis?.student?.studentNumber ?? null,
        name: schedule.thesis?.student
          ? `${schedule.thesis.student.user.firstName} ${schedule.thesis.student.user.lastName}`
          : "Student",
        program: schedule.thesis?.student?.program?.programName ?? null,
      },
      myAssignment: {
        panelAssignmentId: myAssignment.id,
        role,
      },
      capabilities: {
        canEvaluate: isEvaluator,
        canEditRapporteurNotes,
        canViewTitleDeliberation,
        canViewTitleChairmanResult,
        canFinalizeRapporteurNotes,
        canRecordFormalResult,
        canViewFinalizedRapporteurNotes,
      },
      documents: docs,
      proposedTitles:
        defenseType === "TITLE_DEFENSE"
          ? (schedule.thesis?.thesisTitles ?? []).slice(0, 3)
          : [],
      roster,
      // Draft notes visible only to assigned Rapporteur; finalized content also to Chairman.
      rapporteurDraft: canEditRapporteurNotes
        ? { notes: schedule.rapporteurNotes }
        : canViewFinalizedRapporteurNotes
          ? { notes: schedule.rapporteurNotes }
          : null,
      rapporteurNotesFinalizedAt: notesFinalizedAt
        ? notesFinalizedAt.toISOString()
        : null,
      evaluationStatus,
      sessionStatus: schedule.sessionStatus,
      conclusionsPresent: Boolean(schedule.conclusion),
      evaluationProgress: {
        evaluatorAssignments: evaluatorAssignments.length,
        finalizedEvaluations,
      },
      oralSummary: schedule.oralExamSummary
        ? {
            ready: true,
            overallAverage: Number(schedule.oralExamSummary.overallAverage),
            finalRating: schedule.oralExamSummary.finalRating ?? null,
          }
        : { ready: false, overallAverage: null, finalRating: null },
      formalResult: schedule.conclusion
        ? String(schedule.conclusion.outcome)
        : null,
      rapStatus: schedule.rapReports?.[0]?.status ?? null,
    };
  }

  /** CP6/CP7: only the session Rapporteur may write draft notes; locked after finalization. */
  async saveRapporteurNotes(
    scheduleId: string,
    userId: string,
    notes: string,
  ): Promise<{ saved: true }> {
    const schedule = await prisma.defenseSchedule.findUnique({
      where: { id: scheduleId },
      select: {
        sessionStatus: true,
        rapporteurNotesFinalizedAt: true,
      },
    });
    if (!schedule) throw new AppError("Defense session not found.", 404);

    const assignment = await this.resolveOwnAssignment(scheduleId, userId);
    if (String(assignment.role) !== "RAPPORTEUR") {
      throw new AppError(
        "Only the assigned Rapporteur may edit defense notes.",
        403,
      );
    }

    // CP7: finalized notes are immutable through the normal workspace.
    if (schedule.rapporteurNotesFinalizedAt) {
      throw new AppError(
        "Defense notes are finalized and can no longer be edited.",
        409,
      );
    }

    // Allow notes while session is active/finalizing; block closed sessions.
    const status = schedule.sessionStatus;
    if (status === "CONCLUDED" || status === "CANCELLED") {
      throw new AppError(
        "Defense notes are closed for this session.",
        409,
      );
    }

    const result = await prisma.defenseSchedule.updateMany({
      where: {
        id: scheduleId,
        rapporteurNotesFinalizedAt: null,
        sessionStatus: { notIn: ["CONCLUDED", "CANCELLED"] },
      },
      data: { rapporteurNotes: notes },
    });
    // CP6-FIX1: close-state race — conditional update affected 0 rows.
    if (result.count === 0) {
      throw new AppError(
        "Defense notes state changed or notes are closed for this session.",
        409,
      );
    }
    return { saved: true };
  }
}

// Re-export for tests
export { assertEvaluationSessionEditable, committeePolicy };
