/**
 * CP7 — RAP lifecycle after formal conclusion.
 * Signature slots come from evaluator-role policy only.
 * Own-signature CAS; last required signer finalizes the RAP server-side.
 */
import prisma from "../config/database";
import { AppError } from "../utils/AppError";
import {
  rapStatusAfterSignatures,
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
   * Own-signature CAS. Blank signatures rejected. Double-sign → 409.
   * Last required signer sets RAP.status = FINALIZED and finalizedAt server-side.
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
    // Prefer CP6 PNG data URLs for new signatures.
    if (!trimmed.startsWith("data:image/")) {
      throw new AppError(
        "Signature must be image evidence (data:image/...).",
        400,
      );
    }

    return prisma.$transaction(async (tx) => {
      // CAS: only own unsigned slot.
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

      const slots = await tx.rapReportSignature.findMany({
        where: { rapId: slot.rapId },
        select: { required: true, isSigned: true },
      });

      const nextStatus = rapStatusAfterSignatures(slots);
      const finalize = nextStatus === "FINALIZED";
      await tx.rapReport.update({
        where: { id: slot.rapId },
        data: {
          status: finalize ? "FINALIZED" : nextStatus,
          ...(finalize ? { finalizedAt: new Date() } : {}),
        },
      });

      return {
        signatureId: sigId,
        rapId: slot.rapId,
        status: finalize ? "FINALIZED" : nextStatus,
      };
    });
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
    const finalized = rap?.status === "FINALIZED" || rap?.status === "ALL_SIGNED";

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
