/**
 * CP7 — RAP helpers.
 *
 * NOTE (RAP-C1): `createRapAfterConclusion` and `ensureRapAfterTitlePrerequisites`
 * are LEGACY COMPATIBILITY HELPERS ONLY. They are NOT reachable from the current
 * formal-conclusion path: a new conclusion requires an in-system Committee Report
 * that has already been authored, frozen, fully signed, and FINALIZED, and the
 * conclusion transaction never creates a RAP. Signature slots come from the
 * stage-aware RAP signatory policy (§15.3). Own-signature CAS; the last required
 * signer finalizes the RAP server-side.
 */
import prisma from "../config/database";
import { AppError } from "../utils/AppError";
import {
  getRapSignatoryRoles,
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

/** RAP-1 FIX-2: outcome of reconciling an existing OPEN RAP's signature slots. */
export interface RapReconciliationResult {
  reconciled: boolean;
  rapId: string | null;
  skippedFinalized: boolean;
  added: number;
  removed: number;
  roleFilled: number;
}

/** Candidate thesis title used only to resolve an attempt-bound selectedTitleId. */
export interface AttemptTitleCandidate {
  id: string;
  titleText: string;
  /**
   * Present for typing/compatibility only. It is intentionally IGNORED here:
   * thesis-global selection must never influence an attempt's title context.
   */
  isSelected?: boolean | null;
}

/**
 * Resolve the attempt-bound Title context used by a RAP.
 *
 * 2026-10-15 correction: a Title Defense attempt records only a verdict and does
 * not create a binding selected title. Only a `selectedTitleId` explicitly bound
 * to THIS attempt may be used. Thesis-global `ThesisTitle.isSelected` must NEVER
 * be consulted, so a new canonical attempt (attemptSelectedTitleId = null) cannot
 * inherit an older attempt's title. Historical attempt-bound ids still resolve to
 * their text for legacy historical context.
 */
export function resolveAttemptTitleContext(input: {
  /** This attempt's bound selectedTitleId (DefenseConclusion / request). */
  attemptSelectedTitleId?: string | null;
  /** Thesis titles, used only to resolve the attempt-bound id to its text. */
  thesisTitles?: AttemptTitleCandidate[] | null;
}): { selectedTitleId: string | null; officialTitle: string | null } {
  const id = input.attemptSelectedTitleId ?? null;
  if (!id) return { selectedTitleId: null, officialTitle: null };
  const title = (input.thesisTitles ?? []).find((t) => t.id === id) ?? null;
  if (!title) return { selectedTitleId: null, officialTitle: null };
  return { selectedTitleId: id, officialTitle: title.titleText };
}

/**
 * Shared RAP content builder. Used by both the formal-conclusion transaction
 * and the deferred Title RAP generation after Rapporteur finalization.
 *
 * `Official Title:` is emitted only when an attempt-bound historical title exists
 * (legacy). A new canonical attempt passes officialTitle = null and omits the line.
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
   * LEGACY COMPATIBILITY HELPER — do NOT call from the current formal-conclusion
   * path. New conclusions require an in-system Committee Report that has already
   * been authored, frozen, fully signed, and FINALIZED BEFORE the verdict; that
   * path never creates a RAP. This helper remains only for older
   * admin/compatibility flows and historical convergence.
   */
  async createRapAfterConclusion(
    tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
    input: RapCreationInput,
  ) {
    // LEGACY compatibility guard. The canonical RAP lifecycle is now: Rapporteur
    // authors in-system → Save Draft → freeze → required signatures → FINALIZED →
    // Chairman verdict. `createRapAfterConclusion` is no longer reachable from the
    // formal-conclusion path (which requires an existing FINALIZED report). If it
    // is ever invoked (older admin/compatibility flow), it converges on an existing
    // FINALIZED report and otherwise FAILS CLOSED so a non-finalized report can
    // never be silently bypassed.
    const existing = await tx.rapReport.findUnique({
      where: { scheduleId: input.scheduleId },
    });
    if (existing) {
      const status = String(existing.status);
      if (status === "FINALIZED") {
        // Safe compatibility: reuse the already-finalized report.
        return existing;
      }
      if (status === "DRAFT") {
        throw new AppError(
          "The Committee Report must complete the required RAP lifecycle (freeze and signatures) before the defense can be formally concluded. The report is still a draft.",
          409,
        );
      }
      // FOR_SIGNATURE / PARTIALLY_SIGNED / ALL_SIGNED / DISTRIBUTED.
      throw new AppError(
        "Required RAP signatures must be completed before the defense can be formally concluded.",
        409,
      );
    }

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
        "No required RAP signatories exist for this defense session.",
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
            selectedTitleId: true,
            selectedTitle: { select: { id: true, titleText: true } },
          },
        });
        if (!conclusion) return null;

        // Parity with the immediate conclusion path: attempt-bound context only.
        const attemptTitle = resolveAttemptTitleContext({
          attemptSelectedTitleId: conclusion.selectedTitleId,
          thesisTitles: conclusion.selectedTitle
            ? [
                {
                  id: conclusion.selectedTitle.id,
                  titleText: conclusion.selectedTitle.titleText,
                },
              ]
            : [],
        });
        const officialTitle = attemptTitle.officialTitle;
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
   *
   * CDW-7 correction: when the RAP carries a frozen collaborative snapshot
   * (`frozenContentHash`), this legacy-compatible route enforces the SAME
   * RAP-C1 invariants as the workspace signing flow: the report must be open for
   * signatures, and the signature is bound to the exact frozen content
   * version/hash. A genuinely legacy RAP (no frozen snapshot) keeps the previous
   * compatibility behavior.
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

    const transactionResult = await prisma.$transaction(async (tx) => {
      const slot = await tx.rapReportSignature.findUnique({
        where: { id: sigId },
        select: {
          rapId: true,
          userId: true,
          isSigned: true,
          rapReport: {
            select: {
              status: true,
              frozenAt: true,
              frozenContentHash: true,
              contentVersion: true,
              schedule: { select: { id: true, sessionStatus: true } },
            },
          },
        },
      });
      if (!slot) throw new AppError("Signature request not found.", 404);
      if (slot.userId !== userId) {
        throw new AppError(
          "You may only sign your own Committee Report signature slot.",
          403,
        );
      }
      if (slot.isSigned === true) {
        throw new AppError("Signature already recorded.", 409);
      }

      const rap = slot.rapReport;
      // CDW-7: a CONCLUDED attempt is historical and read-only. This applies to
      // BOTH modern frozen RAPs and legacy RAPs without a frozen snapshot.
      // Missing attempt state fails closed — never guess.
      const sessionStatus = String(rap?.schedule?.sessionStatus ?? "");
      if (!rap?.schedule) {
        throw new AppError(
          "The defense attempt for this signature could not be verified.",
          409,
        );
      }
      if (sessionStatus === "CONCLUDED") {
        throw new AppError(
          "This defense attempt is concluded and is read-only.",
          409,
        );
      }
      if (sessionStatus === "CANCELLED") {
        throw new AppError("This defense session was cancelled.", 409);
      }

      const frozenHash = rap?.frozenContentHash ?? null;
      if (frozenHash) {
        const status = String(rap?.status ?? "");
        if (status !== "FOR_SIGNATURE" && status !== "PARTIALLY_SIGNED") {
          throw new AppError(
            "The Committee Report is not open for signatures.",
            409,
          );
        }
      }

      const data: {
        isSigned: boolean;
        signatureData: string;
        signedAt: Date;
        signedContentHash?: string;
        signedContentVersion?: number | null;
      } = {
        isSigned: true,
        signatureData: trimmed,
        signedAt: new Date(),
      };
      if (frozenHash) {
        data.signedContentHash = frozenHash;
        data.signedContentVersion = rap?.contentVersion ?? null;
      }

      const updated = await tx.rapReportSignature.updateMany({
        where: {
          id: sigId,
          userId,
          OR: [{ isSigned: false }, { isSigned: null }],
        },
        data,
      });
      if (updated.count === 0) {
        throw new AppError("Signature already recorded.", 409);
      }

      return {
        rapId: slot.rapId,
        scheduleId: rap?.schedule?.id ?? null,
        contentVersion: rap?.contentVersion ?? 0,
        previousStatus: String(rap?.status ?? ""),
      };
    });

    // CP7-FIX1: committed-state recompute (never downgrades FINALIZED).
    const status = await this.recomputeRapStatus(transactionResult.rapId);
    return {
      signatureId: sigId,
      rapId: transactionResult.rapId,
      scheduleId: transactionResult.scheduleId,
      contentVersion: transactionResult.contentVersion,
      status,
      finalizedNow:
        transactionResult.previousStatus !== "FINALIZED" &&
        status === "FINALIZED",
    };
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

  /**
   * RAP-1 FIX-2: reconcile required signature slots on an OPEN (non-FINALIZED)
   * RAP against the authoritative committee roster and the canonical stage-aware
   * RAP signatory policy.
   *
   * - Adds missing required slots (idempotent: a user that already has any slot
   *   is never duplicated).
   * - Retires only UNSIGNED rows that clearly conflict with the roster/policy:
   *   a slot held by a non-required user, or a recorded non-canonical role
   *   (e.g. ADVISER / DEAN on TITLE_DEFENSE).
   * - Repairs UNSIGNED rows whose recorded role is missing or differs from the
   *   authoritative roster role. Signed rows keep their recorded role label.
   * - Never removes signed evidence, never fabricates signatures, never changes
   *   RAP status, and is a strict no-op for FINALIZED RAPs (history immutable).
   * - If the roster currently yields no canonical signers it does nothing, so a
   *   read can never destructively wipe slots from an incomplete roster.
   * - On the @@unique([rapId,userId]) concurrent-insert race it converges
   *   without failing the caller.
   *
   * Precondition: ADMIN-only. It is invoked from the ADMIN-gated Defense Record
   * detail read (getAdminDefenseRecordDetail) and is idempotent and guarded,
   * matching the established official-record snapshot-backfill read pattern.
   */
  async reconcileOpenRapSignatures(
    scheduleId: string,
  ): Promise<RapReconciliationResult> {
    const empty = (rapId: string | null, skipped: boolean) => ({
      reconciled: false,
      rapId,
      skippedFinalized: skipped,
      added: 0,
      removed: 0,
      roleFilled: 0,
    });

    const rap = await prisma.rapReport.findUnique({
      where: { scheduleId },
      select: { id: true, status: true },
    });
    if (!rap) return empty(null, false);
    if (String(rap.status) === "FINALIZED") return empty(rap.id, true);

    const schedule = await prisma.defenseSchedule.findUnique({
      where: { id: scheduleId },
      select: { defenseType: true },
    });
    if (!schedule) return empty(rap.id, false);

    const defenseType = String(schedule.defenseType);
    const participants = await prisma.panelAssignment.findMany({
      where: { scheduleId },
      select: { userId: true, role: true },
    });
    const requirements = resolveRapSignatureRequirements(
      participants.map((p) => ({ userId: p.userId, role: String(p.role) })),
      defenseType,
    );
    // Safety: if the roster currently yields no canonical signers, never perform
    // a destructive reconciliation on a read. Missing slots recover once the
    // roster is valid again; unsigned slots are preserved meanwhile.
    if (requirements.length === 0) return empty(rap.id, false);

    const requiredRoleByUser = new Map(
      requirements.map((r) => [r.userId, r.roleAtDefense]),
    );

    const existing =
      (await prisma.rapReportSignature.findMany({
        where: { rapId: rap.id },
        select: { id: true, userId: true, roleAtDefense: true, isSigned: true },
      })) ?? [];
    const canonicalRoles = new Set(getRapSignatoryRoles(defenseType).map(String));
    const requiredUserIds = new Set(requirements.map((r) => r.userId));

    // Retire only UNSIGNED rows that clearly conflict with the current roster /
    // stage policy: any slot held by a user who is not a required signer, or any
    // slot with a recorded non-canonical role. Null/legacy roles on expected
    // users are repaired below, not deleted. Signed evidence is never removed.
    const toRemove = existing.filter(
      (s) =>
        s.isSigned !== true &&
        (!requiredUserIds.has(s.userId) ||
          (s.roleAtDefense != null &&
            !canonicalRoles.has(String(s.roleAtDefense)))),
    );
    const removedIds = new Set(toRemove.map((s) => s.id));
    const effectiveExisting = existing.filter((s) => !removedIds.has(s.id));
    const effectiveUserIds = new Set(effectiveExisting.map((s) => s.userId));

    const toCreate = requirements.filter((r) => !effectiveUserIds.has(r.userId));
    // Repair UNSIGNED rows whose recorded role is missing or differs from the
    // authoritative roster role. Signed rows keep their recorded role label.
    const toRoleFill = effectiveExisting.filter(
      (s) =>
        s.isSigned !== true &&
        requiredRoleByUser.has(s.userId) &&
        String(s.roleAtDefense ?? "") !==
          String(requiredRoleByUser.get(s.userId) ?? ""),
    );

    const added = toCreate.length;
    const removed = toRemove.length;
    const roleFilled = toRoleFill.length;

    if (added === 0 && removed === 0 && roleFilled === 0) {
      return empty(rap.id, false);
    }

    try {
      await prisma.$transaction(async (tx) => {
        if (removedIds.size > 0) {
          await tx.rapReportSignature.deleteMany({
            where: { id: { in: [...removedIds] } },
          });
        }
        if (added > 0) {
          await tx.rapReportSignature.createMany({
            data: toCreate.map((r) => ({
              rapId: rap.id,
              userId: r.userId,
              roleAtDefense: r.roleAtDefense,
              required: r.required,
              isSigned: false,
            })),
          });
        }
        for (const slot of toRoleFill) {
          await tx.rapReportSignature.updateMany({
            where: { id: slot.id },
            data: { roleAtDefense: requiredRoleByUser.get(slot.userId) ?? null },
          });
        }
      });
    } catch (err: unknown) {
      if ((err as { code?: string })?.code === "P2002") {
        // A concurrent reconciliation inserted the same (rapId,userId) slot
        // first; our transaction rolled back. The committed state already
        // satisfies the policy, so converge without failing the read.
        return empty(rap.id, false);
      }
      throw err;
    }

    return {
      reconciled: true,
      rapId: rap.id,
      skippedFinalized: false,
      added,
      removed,
      roleFilled,
    };
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
