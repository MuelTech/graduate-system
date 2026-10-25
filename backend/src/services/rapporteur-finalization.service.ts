/**
 * CP7 — Rapporteur defense-notes finalization.
 * Irreversible content lock that feeds the RAP. Never records academic outcome.
 *
 * CDW-7: a CONCLUDED attempt is historical and immutable. Legacy note
 * finalization is bounded to active pre-conclusion states; it never runs after
 * the formal verdict and never creates a RAP after conclusion. The former
 * deferred Title RAP path is retired.
 */
import prisma from "../config/database";
import { AppError } from "../utils/AppError";
import { DefenseCommitteePolicy } from "./defense-committee.policy";

const committeePolicy = new DefenseCommitteePolicy();

export interface FinalizeNotesResult {
  finalized: true;
  finalizedAt: string;
  finalizedById: string;
  sessionStatus: string;
}

export class RapporteurFinalizationService {
  private async resolveRapporteur(scheduleId: string, userId: string) {
    const assignment = await prisma.panelAssignment.findFirst({
      where: { scheduleId, userId, isActive: true },
    });
    if (!assignment) {
      throw new AppError("You are not assigned to this defense session.", 403);
    }
    if (String(assignment.role) !== "RAPPORTEUR") {
      throw new AppError(
        "Only the assigned Rapporteur may finalize defense notes.",
        403,
      );
    }
    return assignment;
  }

  /**
   * Finalize legacy defense notes (irreversible).
   *
   * CDW-7: CONCLUDED/CANCELLED attempts reject finalization at EVERY stage, and
   * no RAP is created/converged after conclusion.
   *
   * Proposal/Final: all evaluators FINALIZED + session AWAITING_CONCLUSION + notes non-empty.
   * Title: session IN_PROGRESS/AWAITING_CONCLUSION + notes non-empty (legacy compatibility).
   */
  async finalizeDefenseNotes(
    scheduleId: string,
    userId: string,
  ): Promise<FinalizeNotesResult> {
    const schedule = await prisma.defenseSchedule.findUnique({
      where: { id: scheduleId },
    });
    if (!schedule) throw new AppError("Defense session not found.", 404);

    await this.resolveRapporteur(scheduleId, userId);

    // CDW-7: concluded/cancelled attempts are immutable for every stage.
    const currentStatus = String(schedule.sessionStatus);
    if (currentStatus === "CONCLUDED") {
      throw new AppError(
        "This defense attempt is concluded and is read-only.",
        409,
      );
    }
    if (currentStatus === "CANCELLED") {
      throw new AppError("This defense session was cancelled.", 409);
    }

    if (schedule.rapporteurNotesFinalizedAt) {
      throw new AppError("Defense notes are already finalized.", 409);
    }

    const notes = (schedule.rapporteurNotes ?? "").trim();
    if (!notes) {
      throw new AppError(
        "Defense notes cannot be empty before finalization.",
        400,
      );
    }

    const defenseType = String(schedule.defenseType);
    const isTitle = defenseType === "TITLE_DEFENSE";

    if (isTitle) {
      const status = String(schedule.sessionStatus);
      // Bounded to active pre-conclusion states; never SCHEDULED/CONCLUDED.
      const finalizableStatuses = ["IN_PROGRESS", "AWAITING_CONCLUSION"];
      if (!finalizableStatuses.includes(status)) {
        throw new AppError(
          "Title defense notes may be finalized only while the defense is in progress or awaiting conclusion.",
          409,
        );
      }
    } else {
      // Proposal/Final require full evaluator completion.
      const evaluatorRoles = committeePolicy
        .getEvaluatorRoles(defenseType as never)
        .map(String);
      const assignments = await prisma.panelAssignment.findMany({
        where: {
          scheduleId,
          role: { in: evaluatorRoles as never[] },
          isActive: true,
        },
        select: { id: true },
      });
      const finalized = await prisma.oralExamScore.count({
        where: {
          scheduleId,
          status: "FINALIZED",
          panelId: { in: assignments.map((a) => a.id) },
        },
      });
      if (assignments.length === 0 || finalized < assignments.length) {
        throw new AppError(
          "All required evaluator evaluations must be finalized before defense notes can be finalized.",
          409,
        );
      }
      if (schedule.sessionStatus !== "AWAITING_CONCLUSION") {
        throw new AppError(
          "Defense notes may be finalized only after evaluations are complete and the session is awaiting conclusion.",
          409,
        );
      }
    }

    const finalizedAt = new Date();

    await prisma.$transaction(async (tx) => {
      const result = await tx.defenseSchedule.updateMany({
        where: {
          id: scheduleId,
          rapporteurNotesFinalizedAt: null,
          ...(isTitle
            ? {
                sessionStatus: {
                  in: [
                    "IN_PROGRESS",
                    "AWAITING_CONCLUSION",
                  ] as never[],
                },
              }
            : { sessionStatus: "AWAITING_CONCLUSION" as never }),
        },
        data: {
          rapporteurNotesFinalizedAt: finalizedAt,
          rapporteurNotesFinalizedById: userId,
          // WF-C1b: Title minutes finalization never forces AWAITING_CONCLUSION.
          // That state is owned solely by evaluator-completion recomputation, so a
          // Rapporteur cannot close the session before the panel finishes scoring.
        },
      });

      if (result.count === 0) {
        throw new AppError(
          "Defense notes state changed. Refresh and try again.",
          409,
        );
      }
    });

    // CDW-7: the former deferred Title RAP creation is retired. Formal
    // conclusion requires an already-FINALIZED RAP, so note finalization must
    // never create/mutate a RAP after conclusion.

    const updated = await prisma.defenseSchedule.findUnique({
      where: { id: scheduleId },
      select: {
        sessionStatus: true,
        rapporteurNotesFinalizedAt: true,
        rapporteurNotesFinalizedById: true,
      },
    });

    return {
      finalized: true,
      finalizedAt: (updated?.rapporteurNotesFinalizedAt ?? finalizedAt).toISOString(),
      finalizedById: updated?.rapporteurNotesFinalizedById ?? userId,
      sessionStatus: String(updated?.sessionStatus ?? "AWAITING_CONCLUSION"),
    };
  }

  /** Draft notes remain editable only before finalization and before conclusion. */
  async assertNotesEditable(scheduleId: string): Promise<void> {
    const schedule = await prisma.defenseSchedule.findUnique({
      where: { id: scheduleId },
      select: { rapporteurNotesFinalizedAt: true, sessionStatus: true },
    });
    if (!schedule) throw new AppError("Defense session not found.", 404);
    // CDW-7: concluded/cancelled attempts are immutable at every stage.
    const status = String(schedule.sessionStatus);
    if (status === "CONCLUDED" || status === "CANCELLED") {
      throw new AppError(
        "Defense notes are closed for this session.",
        409,
      );
    }
    if (schedule.rapporteurNotesFinalizedAt) {
      throw new AppError(
        "Defense notes are finalized and can no longer be edited.",
        409,
      );
    }
  }
}
