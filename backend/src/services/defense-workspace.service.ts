/**
 * CP6 — Role-aware Defense Workspace read model.
 * Academic authority stays with CP5 evaluator lifecycle + CP7 conclusion.
 * This service is presentation/session context only.
 */
import prisma from "../config/database";
import { AppError } from "../utils/AppError";
import { DefenseCommitteePolicy } from "./defense-committee.policy";
import { isEvaluatorRole, assertEvaluationSessionEditable } from "./oral-evaluation.rules";
import { selectAuthoritativeAttemptManuscript } from "./defense-attempt-manuscript.rules";

const committeePolicy = new DefenseCommitteePolicy();

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
    /** 2026-10-04: assigned Chairman may start a scheduled Title Defense. */
    canStartTitleDefense: boolean;
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
  /**
   * CP8: prior Proposal context for Final Defense only.
   * Absent/null for Title and Proposal workspaces.
   */
  proposalHistory: {
    manuscript: {
      id: string;
      docType: string;
      defenseStage: string | null;
      uploadedAt: string | null;
      displayName: string;
    } | null;
    rap: {
      id: string;
      status: "FINALIZED";
      finalizedAt: string | null;
      decisionsAndRecommendations: string | null;
    } | null;
  } | null;
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
                isCurrent: true,
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
        manuscriptDocument: {
          select: { id: true, docType: true, defenseStage: true, uploadedAt: true },
        },
      },
    });
    if (!schedule) throw new AppError("Defense session not found.", 404);

    // CP6: assignment auth BEFORE role-safe DTO assembly.
    const myAssignment = await this.resolveOwnAssignment(scheduleId, userId);
    const role = String(myAssignment.role) as WorkspaceRole;
    const defenseType = String(schedule.defenseType);
    const isEvaluator = isEvaluatorRole(role, defenseType);
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
    /** CP8: prior Proposal context — only for FINAL_DEFENSE. */
    let proposalHistory: DefenseWorkspaceDto["proposalHistory"] = null;

    const attemptDocDisplayName =
      defenseType === "PROPOSAL_DEFENSE"
        ? "Certified Proposal Manuscript"
        : defenseType === "FINAL_DEFENSE"
          ? "Certified Final Manuscript"
          : "Title Defense Proposal Package";

    const toWorkspaceDoc = (d: {
      id: string;
      docType: string;
      defenseStage: string | null;
      uploadedAt?: Date | string | null;
    }) => ({
      id: d.id,
      docType: String(d.docType),
      defenseStage: d.defenseStage ?? null,
      uploadedAt: d.uploadedAt ? new Date(d.uploadedAt).toISOString() : null,
      displayName: attemptDocDisplayName,
    });

    // CDW-2 correction: an already-bound schedule returns its EXACT attempt
    // manuscript — even if a newer/current document or certification exists.
    const boundDocument = schedule.manuscriptDocument;
    if (boundDocument) {
      docs = [toWorkspaceDoc(boundDocument)];
    } else {
      const derived = selectAuthoritativeAttemptManuscript(
        allDocs,
        certs,
        defenseType,
        thesisId,
      );
      if (derived) {
        docs = [toWorkspaceDoc(derived)];
        // Safe one-time binding for an ACTIVE (non-concluded) attempt only;
        // concluded attempts are never re-bound from current state.
        if (String(schedule.sessionStatus) !== "CONCLUDED") {
          await prisma.defenseSchedule.updateMany({
            where: { id: scheduleId, manuscriptDocumentId: null },
            data: { manuscriptDocumentId: derived.id },
          });
        }
      } else if (defenseType === "PROPOSAL_DEFENSE" || defenseType === "FINAL_DEFENSE") {
        throw new AppError(
          "Certified defense manuscript is unavailable for this session.",
          409,
        );
      }
    }

    if (defenseType === "FINAL_DEFENSE") {
      // CDW-2 correction: the authoritative prior Proposal context is the exact
      // manuscript BOUND to the formally PASSED Proposal attempt, resolved as ONE
      // historical unit together with that same attempt's FINALIZED RAP. Today's
      // current AdviserCertification is NOT the authority (it can drift).
      const passedProposal = await this.loadPassedProposalAttempt(thesisId);

      proposalHistory = {
        manuscript: passedProposal?.manuscript
          ? {
              id: passedProposal.manuscript.id,
              docType: passedProposal.manuscript.docType,
              defenseStage: passedProposal.manuscript.defenseStage,
              uploadedAt: passedProposal.manuscript.uploadedAt
                ? new Date(passedProposal.manuscript.uploadedAt).toISOString()
                : null,
              displayName: "Previous Proposal Manuscript",
            }
          : null,
        rap: passedProposal?.rap ?? null,
      };
    }

    const evaluationByPanel = new Map(
      schedule.oralExamScores.map((s) => [s.panelId, s.status as string]),
    );

    const roster = schedule.panelAssignments.map((pa) => {
      const r = String(pa.role);
      let evaluationStatus: DefenseWorkspaceDto["roster"][number]["evaluationStatus"] =
        "NONE";
      if (isEvaluatorRole(r, defenseType)) {
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
      !isEvaluator
        ? "NONE"
        : myScore === "FINALIZED"
          ? "FINALIZED"
          : myScore === "DRAFT"
            ? "DRAFT"
            : "NOT_STARTED";

    // CP7 readiness. WF-C1b: every stage (incl. Title) has evaluator assignments
    // derived from the stage-aware committee policy (CHAIRMAN + PANELIST).
    const isTitleDefense = defenseType === "TITLE_DEFENSE";
    const evaluatorRoles = committeePolicy
      .getEvaluatorRoles(defenseType as never)
      .map(String);
    const evaluatorAssignments = schedule.panelAssignments.filter((p) =>
      evaluatorRoles.includes(String(p.role)),
    );
    const finalizedEvaluations = evaluatorAssignments.filter(
      (p) => evaluationByPanel.get(p.id) === "FINALIZED",
    ).length;
    const evaluationsComplete =
      evaluatorAssignments.length > 0 &&
      finalizedEvaluations >= evaluatorAssignments.length;
    const notesFinalizedAt = schedule.rapporteurNotesFinalizedAt ?? null;
    const isChairman = role === "CHAIRMAN";
    const sessionStatusValue = String(schedule.sessionStatus);
    const canFinalizeRapporteurNotes =
      role === "RAPPORTEUR" &&
      !notesFinalizedAt &&
      (!isTitleDefense ||
        sessionStatusValue === "IN_PROGRESS" ||
        sessionStatusValue === "AWAITING_CONCLUSION" ||
        sessionStatusValue === "CONCLUDED");
    const canViewFinalizedRapporteurNotes =
      Boolean(notesFinalizedAt) &&
      (isChairman || role === "RAPPORTEUR") &&
      !schedule.conclusion;
    const summaryReady = Boolean(schedule.oralExamSummary);
    const canStartTitleDefense =
      isTitleDefense &&
      isChairman &&
      !schedule.conclusion &&
      sessionStatusValue === "SCHEDULED";
    // WF-C1b: the Chairman may record the formal result only once the session is
    // awaiting conclusion, every required evaluator has finalized, and the Oral
    // Examination Summary exists. Title no longer needs Rapporteur notes/RAP yet
    // (RAP-before-conclusion is deferred to WF-C1c); Proposal/Final keep the
    // accepted Rapporteur-notes requirement.
    const canRecordFormalResult =
      isChairman &&
      !schedule.conclusion &&
      sessionStatusValue === "AWAITING_CONCLUSION" &&
      evaluationsComplete &&
      summaryReady &&
      (isTitleDefense ? true : Boolean(notesFinalizedAt));

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
        canStartTitleDefense,
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
      proposalHistory,
    };
  }

  /**
   * CDW-2 correction: resolve the authoritative PRIOR PROPOSAL attempt as ONE
   * historical unit for Final Defense Proposal Context:
   *
   *   same thesis
   *   → formally PASSED PROPOSAL_DEFENSE DefenseConclusion (latest by concludedAt)
   *   → that exact Proposal DefenseSchedule
   *   → exact schedule.manuscriptDocumentId manuscript
   *   → that same schedule's FINALIZED RAP
   *
   * REVISION_REQUIRED / FAILED / REDEFENSE_REQUIRED attempts are not PASSED and
   * are therefore never selected. A legacy PASSED attempt with no binding yields
   * manuscript = null (reconciliation) — no fallback to today's current/latest
   * document or certification. The RAP is preserved when separately provable.
   */
  private async loadPassedProposalAttempt(thesisId: string): Promise<{
    scheduleId: string;
    manuscript: {
      id: string;
      docType: string;
      defenseStage: string | null;
      uploadedAt: Date | null;
    } | null;
    rap: {
      id: string;
      status: "FINALIZED";
      finalizedAt: string | null;
      decisionsAndRecommendations: string | null;
    } | null;
  } | null> {
    const conclusion = await prisma.defenseConclusion.findFirst({
      where: {
        thesisId,
        outcome: "PASSED",
        schedule: { defenseType: "PROPOSAL_DEFENSE" },
      },
      orderBy: { concludedAt: "desc" },
      select: {
        scheduleId: true,
        schedule: {
          select: {
            manuscriptDocumentId: true,
            manuscriptDocument: {
              select: {
                id: true,
                docType: true,
                defenseStage: true,
                uploadedAt: true,
              },
            },
          },
        },
      },
    });
    if (!conclusion?.scheduleId) return null;

    const boundId = conclusion.schedule?.manuscriptDocumentId ?? null;
    const boundDoc = conclusion.schedule?.manuscriptDocument ?? null;
    // The bound document is authoritative ONLY when it is the exact bound id.
    const manuscript =
      boundDoc && boundId && boundDoc.id === boundId ? boundDoc : null;

    const rap = await prisma.rapReport.findFirst({
      where: {
        scheduleId: conclusion.scheduleId,
        defenseType: "PROPOSAL_DEFENSE",
        status: "FINALIZED",
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        finalizedAt: true,
        decisionsAndRecommendations: true,
      },
    });

    return {
      scheduleId: conclusion.scheduleId,
      manuscript,
      rap: rap
        ? {
            id: rap.id,
            status: "FINALIZED" as const,
            finalizedAt: rap.finalizedAt ? rap.finalizedAt.toISOString() : null,
            decisionsAndRecommendations: rap.decisionsAndRecommendations ?? null,
          }
        : null,
    };
  }

  /**
   * 2026-10-04 Title correction: the assigned Chairman explicitly starts a
   * scheduled Title Defense, moving it SCHEDULED → IN_PROGRESS. This is the
   * earliest phase in which the panel has begun deliberation, so the Chairman
   * may record the formal result and the Rapporteur may finalize minutes.
   *
   * Idempotent while already active; never touches Proposal/Final sessions.
   */
  async startTitleDefense(
    scheduleId: string,
    userId: string,
  ): Promise<{ started: true; sessionStatus: string }> {
    const schedule = await prisma.defenseSchedule.findUnique({
      where: { id: scheduleId },
      select: {
        defenseType: true,
        sessionStatus: true,
        conclusion: { select: { id: true } },
      },
    });
    if (!schedule) throw new AppError("Defense session not found.", 404);
    if (String(schedule.defenseType) !== "TITLE_DEFENSE") {
      throw new AppError(
        "Only Title Defense uses the digital start action.",
        400,
      );
    }

    const assignment = await this.resolveOwnAssignment(scheduleId, userId);
    if (String(assignment.role) !== "CHAIRMAN") {
      throw new AppError(
        "Only the assigned session Chairman may start the Title Defense.",
        403,
      );
    }
    if (schedule.conclusion) {
      throw new AppError("Defense has already been concluded.", 409);
    }

    const status = String(schedule.sessionStatus);
    if (status === "IN_PROGRESS" || status === "AWAITING_CONCLUSION") {
      return { started: true, sessionStatus: status };
    }
    if (status !== "SCHEDULED") {
      throw new AppError(
        "Title Defense can be started only from a scheduled session.",
        409,
      );
    }

    const result = await prisma.defenseSchedule.updateMany({
      where: { id: scheduleId, sessionStatus: "SCHEDULED" },
      data: { sessionStatus: "IN_PROGRESS" },
    });
    if (result.count === 0) {
      const refreshed = await prisma.defenseSchedule.findUnique({
        where: { id: scheduleId },
        select: { sessionStatus: true },
      });
      return {
        started: true,
        sessionStatus: String(refreshed?.sessionStatus ?? "IN_PROGRESS"),
      };
    }
    return { started: true, sessionStatus: "IN_PROGRESS" };
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
        defenseType: true,
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

    // 2026-10-04 Title correction: the Chairman may record the formal result
    // before the Rapporteur finalizes, so Title notes stay editable after
    // conclusion until they are finalized.
    const isTitle = String(schedule.defenseType) === "TITLE_DEFENSE";
    const blockedStatuses = isTitle
      ? ["CANCELLED"]
      : ["CONCLUDED", "CANCELLED"];
    const status = String(schedule.sessionStatus);
    if (blockedStatuses.includes(status)) {
      throw new AppError(
        "Defense notes are closed for this session.",
        409,
      );
    }

    const result = await prisma.defenseSchedule.updateMany({
      where: {
        id: scheduleId,
        rapporteurNotesFinalizedAt: null,
        sessionStatus: { notIn: blockedStatuses as never },
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
