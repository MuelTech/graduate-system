/**
 * CP6 — Role-aware Defense Workspace read model.
 * Academic authority stays with CP5 evaluator lifecycle + CP7 conclusion.
 * This service is presentation/session context only.
 */
import prisma from "../config/database";
import { AppError } from "../utils/AppError";
import { DefenseCommitteePolicy } from "./defense-committee.policy";
import { isEvaluatorRole } from "./oral-evaluation.rules";
import { assertEvaluationSessionEditable } from "./oral-evaluation.rules";

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
  evaluationStatus: "NOT_STARTED" | "DRAFT" | "FINALIZED" | "NONE";
  sessionStatus: string;
  conclusionsPresent: boolean;
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
              },
              orderBy: { uploadedAt: "desc" },
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
        conclusion: { select: { id: true } },
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

    const docRule = DOC_BY_DEFENSE[defenseType];
    const docs = (schedule.thesis?.thesisDocuments ?? [])
      .filter((d) => {
        if (!docRule) return false;
        return (
          d.docType === docRule.docType &&
          (d.defenseStage === docRule.defenseStage || d.defenseStage == null)
        );
      })
      .slice(0, 3)
      .map((d) => ({
        id: d.id,
        docType: d.docType,
        defenseStage: d.defenseStage,
        uploadedAt: d.uploadedAt ? d.uploadedAt.toISOString() : null,
        displayName:
          d.docType === "TITLE_PROPOSAL"
            ? "Title Defense Proposal Package"
            : d.docType === "PROPOSAL_CHAPTERS"
              ? "Proposal Manuscript (Chapters 1–3)"
              : "Final Manuscript",
      }));

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
      },
      documents: docs,
      proposedTitles:
        defenseType === "TITLE_DEFENSE"
          ? (schedule.thesis?.thesisTitles ?? []).slice(0, 3)
          : [],
      roster,
      // Draft notes visible only to assigned Rapporteur.
      rapporteurDraft: canEditRapporteurNotes
        ? { notes: schedule.rapporteurNotes }
        : null,
      evaluationStatus,
      sessionStatus: schedule.sessionStatus,
      conclusionsPresent: Boolean(schedule.conclusion),
    };
  }

  /** CP6: only the session Rapporteur may write draft notes. */
  async saveRapporteurNotes(
    scheduleId: string,
    userId: string,
    notes: string,
  ): Promise<{ saved: true }> {
    const schedule = await prisma.defenseSchedule.findUnique({
      where: { id: scheduleId },
      select: { sessionStatus: true },
    });
    if (!schedule) throw new AppError("Defense session not found.", 404);

    const assignment = await this.resolveOwnAssignment(scheduleId, userId);
    if (String(assignment.role) !== "RAPPORTEUR") {
      throw new AppError(
        "Only the assigned Rapporteur may edit defense notes.",
        403,
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

    await prisma.defenseSchedule.updateMany({
      where: {
        id: scheduleId,
        sessionStatus: { notIn: ["CONCLUDED", "CANCELLED"] },
      },
      data: { rapporteurNotes: notes },
    });
    return { saved: true };
  }
}

// Re-export for tests
export { assertEvaluationSessionEditable, committeePolicy };
