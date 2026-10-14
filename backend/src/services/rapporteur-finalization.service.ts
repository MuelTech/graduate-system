/**
 * CP7 — Rapporteur defense-notes finalization.
 * Irreversible content lock that feeds the RAP. Never records academic outcome.
 *
 * 2026-10-04 Title correction: the Chairman may record the Title result before the
 * Rapporteur finalizes. When that happens, the official Title RAP is generated here,
 * once, as soon as the finalized minutes exist.
 */
import prisma from "../config/database";
import { AppError } from "../utils/AppError";
import { DefenseCommitteePolicy } from "./defense-committee.policy";
import { isNumericalDefenseType } from "./official-defense-record.service";
import { RapReportService } from "./rap-report.service";

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
      where: { scheduleId, userId },
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
   * Finalize defense notes (irreversible).
   *
   * Proposal/Final: all evaluators FINALIZED + session AWAITING_CONCLUSION + notes non-empty.
   * Title: session SCHEDULED/IN_PROGRESS/CONCLUDED + notes non-empty. A Title result may
   * be recorded before the notes are finalized, so the deferred RAP is generated here.
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
      const finalizableStatuses = ["IN_PROGRESS", "AWAITING_CONCLUSION", "CONCLUDED"];
      if (!finalizableStatuses.includes(status)) {
        throw new AppError(
          "Title defense notes may be finalized only after the defense has started (in progress) or after the formal result is recorded.",
          409,
        );
      }
    } else {
      // Proposal/Final require full evaluator completion.
      const evaluatorRoles = committeePolicy
        .getEvaluatorRoles(defenseType as never)
        .map(String);
      const assignments = await prisma.panelAssignment.findMany({
        where: { scheduleId, role: { in: evaluatorRoles as never[] } },
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
    const isTitleStillActive =
      isTitle && schedule.sessionStatus === "IN_PROGRESS";

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
                    "CONCLUDED",
                  ] as never[],
                },
              }
            : { sessionStatus: "AWAITING_CONCLUSION" as never }),
        },
        data: {
          rapporteurNotesFinalizedAt: finalizedAt,
          rapporteurNotesFinalizedById: userId,
          ...(isTitleStillActive
            ? { sessionStatus: "AWAITING_CONCLUSION" as never }
            : {}),
        },
      });

      if (result.count === 0) {
        throw new AppError(
          "Defense notes state changed. Refresh and try again.",
          409,
        );
      }
    });

    // 2026-10-04: deferred Title RAP — converge on exactly one RAP once both the
    // formal conclusion and the finalized minutes exist. Runs after commit so it
    // observes the committed state of a near-simultaneous Chairman action.
    if (isTitle) {
      await new RapReportService().ensureRapAfterTitlePrerequisites(scheduleId);
    }

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

  /** Draft notes remain editable only before finalization. */
  async assertNotesEditable(scheduleId: string): Promise<void> {
    const schedule = await prisma.defenseSchedule.findUnique({
      where: { id: scheduleId },
      select: { rapporteurNotesFinalizedAt: true, sessionStatus: true },
    });
    if (!schedule) throw new AppError("Defense session not found.", 404);
    if (schedule.rapporteurNotesFinalizedAt) {
      throw new AppError(
        "Defense notes are finalized and can no longer be edited.",
        409,
      );
    }
  }
}

export { isNumericalDefenseType };
