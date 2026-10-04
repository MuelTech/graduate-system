/**
 * CP7 — RAP lifecycle after formal conclusion.
 * Signature slots come from evaluator-role policy only.
 * Own-signature CAS; last required signer finalizes the RAP server-side.
 */
import prisma from "../config/database";
import { AppError } from "../utils/AppError";
import {
  resolveRapSignatureRequirements,
} from "./rap-signature.policy";

export interface RapCreationInput {
  scheduleId: string;
  thesisId: string;
  defenseType: string;
  venue?: string | null;
  selectedTitle?: string | null;
  decisionsAndRecommendations: string;
  /** Authenticated Rapporteur who finalized notes/content. */
  generatedById: string;
}

export interface RapContentInput {
  defenseType: string;
  officialTitle: string | null;
  outcome: string;
  rapporteurNotes: string | null;
  panelRecommendations?: string | null;
}

/**
 * Shared RAP content builder. Used by both the formal-conclusion transaction
 * and the deferred Title RAP generation after Rapporteur finalization.
 */
export function buildRapContent(input: RapContentInput): string {
  return [
    `Defense Type: ${input.defenseType}`,
    input.officialTitle ? `Official Title: ${input.officialTitle}` : null,
    `Formal Outcome: ${input.outcome}`,
    "",
    "=== RAPPORTEUR FINALIZED NOTES ===",
    input.rapporteurNotes ?? "",
    input.panelRecommendations
      ? `\n=== EVALUATOR RECOMMENDATIONS ===\n${input.panelRecommendations}`
      : null,
  ]
    .filter((line) => line !== null)
    .join("\n");
}

export class RapReportService {
  /**
   * Create the official RAP exactly once after formal conclusion.
   * generatedBy = Rapporteur who finalized notes (not the Chairman).
   * Initial status FOR_SIGNATURE — no Admin "Generate & Distribute" required.
   */
  async createRapAfterConclusion(
    tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
    input: RapCreationInput,
  ) {
    const participants = await tx.panelAssignment.findMany({
      where: { scheduleId: input.scheduleId },
      select: { userId: true, role: true },
    });

    const requirements = resolveRapSignatureRequirements(
      participants.map((p) => ({
        userId: p.userId,
        role: String(p.role),
      })),
      input.defenseType,
    );

    if (requirements.length === 0) {
      throw new AppError(
        "No evaluator signatories exist for this defense session.",
        409,
      );
    }

    const generatedAt = new Date();
    const rap = await tx.rapReport.create({
      data: {
        scheduleId: input.scheduleId,
        thesisId: input.thesisId,
        defenseType: input.defenseType as never,
        reportDate: generatedAt,
        venue: input.venue ?? null,
        decisionsAndRecommendations: input.decisionsAndRecommendations,
        selectedTitle: input.selectedTitle ?? null,
        status: "FOR_SIGNATURE",
        generatedById: input.generatedById,
        generatedAt,
      },
    });

    await tx.rapReportSignature.createMany({
      data: requirements.map((req) => ({
        rapId: rap.id,
        userId: req.userId,
        roleAtDefense: req.roleAtDefense,
        required: req.required,
        isSigned: false,
      })),
    });

    return rap;
  }

  /**
   * 2026-10-04 Title correction: converge on exactly one official Title RAP once
   * BOTH the formal conclusion and the finalized Rapporteur minutes exist.
   *
   * Safe under near-simultaneous Chairman/Rapporteur transactions:
   * - reads committed state in its own transaction after the caller commits;
   * - idempotent (no-op when a RAP already exists);
   * - a unique race (P2002) converges on the RAP created by the other path.
   */
  async ensureRapAfterTitlePrerequisites(scheduleId: string) {
    try {
      return await prisma.$transaction(async (tx) => {
        const existing = await tx.rapReport.findUnique({
          where: { scheduleId },
        });
        if (existing) return existing;

        const schedule = await tx.defenseSchedule.findUnique({
          where: { id: scheduleId },
          select: {
            defenseType: true,
            venueOrLink: true,
            rapporteurNotes: true,
            rapporteurNotesFinalizedAt: true,
            rapporteurNotesFinalizedById: true,
          },
        });
        if (!schedule || String(schedule.defenseType) !== "TITLE_DEFENSE") {
          return null;
        }
        if (
          !schedule.rapporteurNotesFinalizedAt ||
          !schedule.rapporteurNotes ||
          !schedule.rapporteurNotesFinalizedById
        ) {
          return null;
        }

        // generatedById must be the assigned Rapporteur who finalized the notes.
        const finalizerAssignment = await tx.panelAssignment.findFirst({
          where: {
            scheduleId,
            userId: schedule.rapporteurNotesFinalizedById,
            role: "RAPPORTEUR",
          },
          select: { id: true },
        });
        if (!finalizerAssignment) return null;

        const conclusion = await tx.defenseConclusion.findUnique({
          where: { scheduleId },
          select: {
            thesisId: true,
            outcome: true,
            selectedTitle: { select: { titleText: true } },
          },
        });
        if (!conclusion) return null;

        const officialTitle = conclusion.selectedTitle?.titleText ?? null;
        const content = buildRapContent({
          defenseType: "TITLE_DEFENSE",
          officialTitle,
          outcome: String(conclusion.outcome),
          rapporteurNotes: schedule.rapporteurNotes,
        });

        return this.createRapAfterConclusion(tx, {
          scheduleId,
          thesisId: conclusion.thesisId,
          defenseType: "TITLE_DEFENSE",
          venue: schedule.venueOrLink ?? null,
          selectedTitle: officialTitle,
          decisionsAndRecommendations: content,
          generatedById: schedule.rapporteurNotesFinalizedById,
        });
      });
    } catch (err: unknown) {
      // Unique-race convergence: the other path created the RAP first.
      if ((err as { code?: string })?.code === "P2002") {
        return prisma.rapReport.findUnique({ where: { scheduleId } });
      }
      throw err;
    }
  }

  /**
   * CP7-FIX1: own-slot CAS only. Aggregate recompute runs AFTER commit so
   * concurrent final signers both commit first, then recompute converges.
   */
  async signRapSlot(
    sigId: string,
    userId: string,
    signatureData: string,
  ) {
    const trimmed = (signatureData ?? "").trim();
    if (!trimmed) {
      throw new AppError("Signature evidence is required.", 400);
    }
    if (!trimmed.startsWith("data:image/")) {
      throw new AppError(
        "Signature must be image evidence (data:image/...).",
        400,
      );
    }

    const rapId = await prisma.$transaction(async (tx) => {
      const updated = await tx.rapReportSignature.updateMany({
        where: {
          id: sigId,
          userId,
          OR: [{ isSigned: false }, { isSigned: null }],
        },
        data: {
          isSigned: true,
          signatureData: trimmed,
          signedAt: new Date(),
        },
      });
      if (updated.count === 0) {
        const existing = await tx.rapReportSignature.findUnique({
          where: { id: sigId },
          select: { userId: true, isSigned: true },
        });
        if (!existing) {
          throw new AppError("Signature request not found.", 404);
        }
        if (existing.userId !== userId) {
          throw new AppError(
            "You may only sign your own RAP signature slot.",
            403,
          );
        }
        throw new AppError("Signature already recorded.", 409);
      }

      const slot = await tx.rapReportSignature.findUnique({
        where: { id: sigId },
        select: { rapId: true },
      });
      if (!slot) throw new AppError("Signature request not found.", 404);
      return slot.rapId;
    });

    // CP7-FIX1: committed-state recompute (never downgrades FINALIZED).
    const status = await this.recomputeRapStatus(rapId);
    return { signatureId: sigId, rapId, status };
  }

  /**
   * CP7-FIX1: monotonic aggregate recompute from committed required slots.
   * FINALIZED is never downgraded; finalizedAt is set once server-side.
   */
  async recomputeRapStatus(
    rapId: string,
  ): Promise<"FOR_SIGNATURE" | "PARTIALLY_SIGNED" | "FINALIZED"> {
    const slots = await prisma.rapReportSignature.findMany({
      where: { rapId },
      select: { required: true, isSigned: true },
    });
    const required = slots.filter((s) => s.required !== false);
    const signedRequired = required.filter((s) => s.isSigned === true);
    let next: "FOR_SIGNATURE" | "PARTIALLY_SIGNED" | "FINALIZED";
    if (required.length === 0 || signedRequired.length === 0) {
      next = "FOR_SIGNATURE";
    } else if (signedRequired.length < required.length) {
      next = "PARTIALLY_SIGNED";
    } else {
      next = "FINALIZED";
    }

    const current = await prisma.rapReport.findUnique({
      where: { id: rapId },
      select: { status: true, finalizedAt: true },
    });
    if (!current) return next;

    // Never downgrade FINALIZED.
    if (current.status === "FINALIZED") {
      if (!current.finalizedAt) {
        await prisma.rapReport.update({
          where: { id: rapId },
          data: { finalizedAt: new Date() },
        });
      }
      return "FINALIZED";
    }

    if (next === "FINALIZED") {
      // Conditional finalize — race-safe, set finalizedAt once.
      const result = await prisma.rapReport.updateMany({
        where: { id: rapId, status: { not: "FINALIZED" } },
        data: { status: "FINALIZED", finalizedAt: current.finalizedAt ?? new Date() },
      });
      if (result.count === 0) {
        const winner = await prisma.rapReport.findUnique({
          where: { id: rapId },
          select: { status: true },
        });
        if (winner?.status === "FINALIZED") return "FINALIZED";
      }
      return "FINALIZED";
    }

    await prisma.rapReport.updateMany({
      where: {
        id: rapId,
        status: { notIn: ["FINALIZED"] },
      },
      data: { status: next },
    });
    return next;
  }

  async getStudentRapAccess(scheduleId: string, userId: string) {
    const schedule = await prisma.defenseSchedule.findUnique({
      where: { id: scheduleId },
      include: {
        thesis: {
          include: {
            student: {
              select: { userId: true },
            },
          },
        },
        conclusion: {
          select: { outcome: true, concludedAt: true, finalRemarks: true },
        },
        rapReports: {
          include: {
            signatures: {
              include: {
                user: { select: { firstName: true, lastName: true } },
              },
            },
            generatedBy: { select: { firstName: true, lastName: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });
    if (!schedule) throw new AppError("Defense session not found.", 404);

    const ownerUserId = schedule.thesis?.student?.userId ?? null;
    if (!ownerUserId || ownerUserId !== userId) {
      throw new AppError("You may only view your own defense RAP.", 403);
    }

    const rap = schedule.rapReports[0] ?? null;
    // CP7-FIX1: FINALIZED only — ALL_SIGNED is not official completion.
    const finalized = rap?.status === "FINALIZED";

    return {
      scheduleId,
      defenseType: String(schedule.defenseType),
      formalOutcome: schedule.conclusion?.outcome ?? null,
      rapStatus: rap?.status ?? null,
      finalizedAt: rap?.finalizedAt?.toISOString() ?? null,
      generatedAt: rap?.generatedAt?.toISOString() ?? null,
      // Student-safe: finalized official content only — never live draft notes.
      officialContent: finalized
        ? {
            selectedTitle: rap?.selectedTitle ?? null,
            decisionsAndRecommendations: rap?.decisionsAndRecommendations ?? null,
            venue: rap?.venue ?? null,
            reportDate: rap?.reportDate?.toISOString() ?? null,
            signatories: (rap?.signatures ?? []).map((s) => ({
              name: s.user ? `${s.user.firstName} ${s.user.lastName}` : null,
              roleAtDefense: s.roleAtDefense ?? null,
              isSigned: s.isSigned === true,
              signedAt: s.signedAt?.toISOString() ?? null,
            })),
          }
        : null,
      message: !schedule.conclusion
        ? "Defense records are being finalized."
        : finalized
          ? "Official RAP is available."
          : "RAP is awaiting required signatures.",
    };
  }
}
