/**
 * CP5 — Proposal/Final evaluator evaluation lifecycle.
 * Ownership is always derived from authenticated user + schedule assignment.
 * Client panelId is never ownership authority.
 */
import prisma from "../config/database";
import { AppError } from "../utils/AppError";
import { DefenseCommitteePolicy } from "./defense-committee.policy";
import {
  areAllCriteriaComplete,
  assertEvaluationSessionEditable,
  calculateEvaluationScores,
  canFinalizeEvaluation,
  CRITERION_LIMITS,
  isEvaluatorRole,
  isNumericalEvaluationComplete,
  isNumericalEvaluationDefense,
  isValidOralRating,
  mergeOptionalField,
  mergePartialCriteria,
  validateCriterionValue,
  type CriterionKey,
  type CriteriaInput,
} from "./oral-evaluation.rules";

const CRITERION_KEYS = Object.keys(CRITERION_LIMITS) as CriterionKey[];
const committeePolicy = new DefenseCommitteePolicy();

function evaluatorRoleList(): string[] {
  return committeePolicy.getEvaluatorRoles("PROPOSAL_DEFENSE") as string[];
}

export interface OralEvaluationDto {
  scheduleId: string;
  defenseType: string;
  panelAssignmentId: string;
  assignmentRole: string;
  status: "DRAFT" | "FINALIZED";
  criteria: Record<CriterionKey, number | null>;
  groupIValue: number | null;
  groupIIValue: number | null;
  overallValue: number | null;
  rating: string | null;
  recommendations: string | null;
  signedAt: string | null;
  finalizedAt: string | null;
  isLocked: boolean;
}

export class OralEvaluationService {
  private async resolveOwnAssignment(scheduleId: string, userId: string) {
    const assignment = await prisma.panelAssignment.findFirst({
      where: { scheduleId, userId },
    });
    if (!assignment) {
      throw new AppError(
        "You are not assigned to this defense session.",
        403,
      );
    }
    return assignment;
  }

  private toDto(
    scheduleId: string,
    defenseType: string,
    assignment: { id: string; role: string },
    row: {
      status: string;
      timelinessRelevance: unknown;
      organization: unknown;
      depthComprehensiveness: unknown;
      relevanceConclusions: unknown;
      evidenceOriginalThinking: unknown;
      presentation: unknown;
      masterySubject: unknown;
      communicationSkill: unknown;
      attitude: unknown;
      groupAAverage: unknown;
      groupBAverage: unknown;
      overallAverage: unknown;
      rating: string | null;
      recommendations: string | null;
      signedAt: Date | null;
      finalizedAt: Date | null;
    } | null,
  ): OralEvaluationDto {
    const num = (v: unknown): number | null => {
      if (v === null || v === undefined) return null;
      const n = typeof v === "number" ? v : Number(v);
      return Number.isFinite(n) ? n : null;
    };
    return {
      scheduleId,
      defenseType,
      panelAssignmentId: assignment.id,
      assignmentRole: assignment.role,
      status: (row?.status as "DRAFT" | "FINALIZED") ?? "DRAFT",
      criteria: {
        timelinessRelevance: num(row?.timelinessRelevance),
        organization: num(row?.organization),
        depthComprehensiveness: num(row?.depthComprehensiveness),
        relevanceConclusions: num(row?.relevanceConclusions),
        evidenceOriginalThinking: num(row?.evidenceOriginalThinking),
        presentation: num(row?.presentation),
        masterySubject: num(row?.masterySubject),
        communicationSkill: num(row?.communicationSkill),
        attitude: num(row?.attitude),
      },
      groupIValue: num(row?.groupAAverage),
      groupIIValue: num(row?.groupBAverage),
      overallValue: num(row?.overallAverage),
      rating: row?.rating ?? null,
      recommendations: row?.recommendations ?? null,
      signedAt: row?.signedAt ? row.signedAt.toISOString() : null,
      finalizedAt: row?.finalizedAt ? row.finalizedAt.toISOString() : null,
      isLocked: row?.status === "FINALIZED",
    };
  }

  private async getScheduleOrThrow(scheduleId: string) {
    const schedule = await prisma.defenseSchedule.findUnique({
      where: { id: scheduleId },
    });
    if (!schedule) throw new AppError("Defense session not found.", 404);
    return schedule;
  }

  private assertNumericalStage(defenseType: string) {
    if (!isNumericalEvaluationDefense(defenseType)) {
      throw new AppError(
        "Title Defense does not use Group I / Group II numerical evaluation.",
        400,
      );
    }
  }

  private assertSessionEditable(sessionStatus: string | null | undefined) {
    const gate = assertEvaluationSessionEditable(sessionStatus);
    if (!gate.ok) throw new AppError(gate.reason, gate.statusCode);
  }

  /**
   * CP5-FIX1: recompute session status from committed DB state.
   * Idempotent; never regresses CONCLUDED/CANCELLED.
   */
  async recomputeEvaluationSessionStatus(scheduleId: string): Promise<void> {
    const schedule = await prisma.defenseSchedule.findUnique({
      where: { id: scheduleId },
      select: { defenseType: true, sessionStatus: true },
    });
    if (!schedule) return;
    if (
      schedule.sessionStatus === "CONCLUDED" ||
      schedule.sessionStatus === "CANCELLED"
    ) {
      return;
    }
    const evaluatorRoles = evaluatorRoleList();
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
    const complete = isNumericalEvaluationComplete(
      schedule.defenseType,
      assignments.length,
      finalized,
    );
    if (complete && assignments.length > 0) {
      await prisma.defenseSchedule.updateMany({
        where: {
          id: scheduleId,
          sessionStatus: { in: ["SCHEDULED", "IN_PROGRESS", "AWAITING_CONCLUSION"] },
        },
        data: { sessionStatus: "AWAITING_CONCLUSION" },
      });
    } else if (
      schedule.sessionStatus === "SCHEDULED" ||
      schedule.sessionStatus === "IN_PROGRESS" ||
      schedule.sessionStatus === "AWAITING_CONCLUSION"
    ) {
      // Not all finalized → evaluation phase continues only if not closed.
      if (schedule.sessionStatus === "AWAITING_CONCLUSION") {
        await prisma.defenseSchedule.updateMany({
          where: { id: scheduleId, sessionStatus: "AWAITING_CONCLUSION" },
          data: { sessionStatus: "IN_PROGRESS" },
        });
      }
    }
  }

  private assertEvaluatorRole(role: string) {
    if (!isEvaluatorRole(role)) {
      throw new AppError(
        `Role ${role} cannot submit oral examination evaluations.`,
        403,
      );
    }
  }

  async getMyEvaluation(scheduleId: string, userId: string): Promise<OralEvaluationDto> {
    const schedule = await this.getScheduleOrThrow(scheduleId);
    // CP5-FIX1: assignment auth BEFORE stage disclosure.
    const assignment = await this.resolveOwnAssignment(scheduleId, userId);
    this.assertEvaluatorRole(assignment.role);
    this.assertNumericalStage(schedule.defenseType);
    const row = await prisma.oralExamScore.findUnique({
      where: { scheduleId_panelId: { scheduleId, panelId: assignment.id } },
    });
    return this.toDto(scheduleId, schedule.defenseType, assignment, row);
  }

  /**
   * Save/own Draft upsert. Ignores client-derived totals and client timestamps.
   * Body panelId is not ownership (ignored except optional mismatch reject).
   */
  async saveDraft(
    scheduleId: string,
    userId: string,
    input: {
      criteria?: CriteriaInput;
      rating?: string | null;
      recommendations?: string | null;
      clientPanelId?: string | null;
    },
  ): Promise<OralEvaluationDto> {
    const schedule = await this.getScheduleOrThrow(scheduleId);
    // CP5-FIX1: assignment auth BEFORE stage disclosure.
    const assignment = await this.resolveOwnAssignment(scheduleId, userId);
    this.assertEvaluatorRole(assignment.role);
    this.assertNumericalStage(schedule.defenseType);
    this.assertSessionEditable(schedule.sessionStatus);

    if (
      input.clientPanelId &&
      String(input.clientPanelId) !== String(assignment.id)
    ) {
      throw new AppError(
        "Panel assignment does not match the authenticated evaluator.",
        403,
      );
    }

    const now = new Date();

    try {
      await prisma.$transaction(async (tx) => {
        // CP5-FIX2: re-check session editability inside the write transaction.
        const current = await tx.defenseSchedule.findUnique({
          where: { id: scheduleId },
          select: { sessionStatus: true },
        });
        this.assertSessionEditable(current?.sessionStatus);

        const existing = await tx.oralExamScore.findUnique({
          where: { scheduleId_panelId: { scheduleId, panelId: assignment.id } },
        });
        if (existing?.status === "FINALIZED") {
          throw new AppError("Evaluation is already finalized.", 409);
        }

        // CP5-FIX1: PATCH merge — absent fields preserve stored values.
        const merged = mergePartialCriteria(
          {
            timelinessRelevance: (existing as any)?.timelinessRelevance,
            organization: (existing as any)?.organization,
            depthComprehensiveness: (existing as any)?.depthComprehensiveness,
            relevanceConclusions: (existing as any)?.relevanceConclusions,
            evidenceOriginalThinking: (existing as any)?.evidenceOriginalThinking,
            presentation: (existing as any)?.presentation,
            masterySubject: (existing as any)?.masterySubject,
            communicationSkill: (existing as any)?.communicationSkill,
            attitude: (existing as any)?.attitude,
          },
          input.criteria ?? {},
        );
        const validated: Partial<Record<CriterionKey, number | null>> = {};
        for (const key of CRITERION_KEYS) {
          const result = validateCriterionValue(key, merged[key]);
          if (!result.ok) throw new AppError(result.reason, 400);
          validated[key] = result.value;
        }

        const rating = mergeOptionalField<string>(
          existing?.rating as string | null,
          (input ?? {}) as Record<string, unknown>,
          "rating",
        );
        if (rating !== null && rating !== "" && !isValidOralRating(rating)) {
          throw new AppError("Invalid evaluation rating value.", 400);
        }
        const recommendations = mergeOptionalField<string>(
          existing?.recommendations as string | null,
          (input ?? {}) as Record<string, unknown>,
          "recommendations",
        );

        const derived = calculateEvaluationScores(validated);
        const data = {
          timelinessRelevance: validated.timelinessRelevance,
          organization: validated.organization,
          depthComprehensiveness: validated.depthComprehensiveness,
          relevanceConclusions: validated.relevanceConclusions,
          evidenceOriginalThinking: validated.evidenceOriginalThinking,
          presentation: validated.presentation,
          masterySubject: validated.masterySubject,
          communicationSkill: validated.communicationSkill,
          attitude: validated.attitude,
          groupAAverage: derived.groupIValue,
          groupBAverage: derived.groupIIValue,
          overallAverage: derived.overallValue,
          rating: (rating || null) as never,
          recommendations,
          scoredAt: now,
        };

        if (existing) {
          const updated = await tx.oralExamScore.updateMany({
            where: {
              id: existing.id,
              status: "DRAFT",
              scheduleId,
              panelId: assignment.id,
            },
            data,
          });
          if (updated.count === 0) {
            throw new AppError(
              "Evaluation state changed. Refresh and try again.",
              409,
            );
          }
        } else {
          await tx.oralExamScore.create({
            data: {
              scheduleId,
              panelId: assignment.id,
              status: "DRAFT",
              ...data,
            },
          });
        }

        if (
          schedule.sessionStatus === "SCHEDULED" ||
          schedule.sessionStatus === "UNSCHEDULED"
        ) {
          await tx.defenseSchedule.updateMany({
            where: {
              id: scheduleId,
              sessionStatus: { in: ["SCHEDULED", "UNSCHEDULED"] },
            },
            data: { sessionStatus: "IN_PROGRESS" },
          });
        }
      });
    } catch (err: any) {
      // Concurrent first-create unique race → friendly 409.
      if (err?.code === "P2002" || err?.meta?.target) {
        throw new AppError(
          "Evaluation state changed. Refresh and try again.",
          409,
        );
      }
      throw err;
    }

    const row = await prisma.oralExamScore.findUnique({
      where: { scheduleId_panelId: { scheduleId, panelId: assignment.id } },
    });
    return this.toDto(scheduleId, schedule.defenseType, assignment, row);
  }

  async finalize(
    scheduleId: string,
    userId: string,
    input: {
      signatureData: string;
      criteria?: CriteriaInput;
      rating?: string | null;
      recommendations?: string | null;
      clientPanelId?: string | null;
      clientSignedAt?: string | null;
      clientFinalizedAt?: string | null;
    },
  ): Promise<OralEvaluationDto> {
    const schedule = await this.getScheduleOrThrow(scheduleId);
    // CP5-FIX1: assignment auth BEFORE stage disclosure.
    const assignment = await this.resolveOwnAssignment(scheduleId, userId);
    this.assertEvaluatorRole(assignment.role);
    this.assertNumericalStage(schedule.defenseType);
    this.assertSessionEditable(schedule.sessionStatus);

    if (
      input.clientPanelId &&
      String(input.clientPanelId) !== String(assignment.id)
    ) {
      throw new AppError(
        "Panel assignment does not match the authenticated evaluator.",
        403,
      );
    }

    const existing = await prisma.oralExamScore.findUnique({
      where: { scheduleId_panelId: { scheduleId, panelId: assignment.id } },
    });
    if (existing?.status === "FINALIZED") {
      throw new AppError("Evaluation is already finalized.", 409);
    }

    const criteria = mergePartialCriteria(
      {
        timelinessRelevance: (existing as any)?.timelinessRelevance,
        organization: (existing as any)?.organization,
        depthComprehensiveness: (existing as any)?.depthComprehensiveness,
        relevanceConclusions: (existing as any)?.relevanceConclusions,
        evidenceOriginalThinking: (existing as any)?.evidenceOriginalThinking,
        presentation: (existing as any)?.presentation,
        masterySubject: (existing as any)?.masterySubject,
        communicationSkill: (existing as any)?.communicationSkill,
        attitude: (existing as any)?.attitude,
      },
      input.criteria ?? {},
    );
    const validated: Partial<Record<CriterionKey, number | null>> = {};
    for (const key of CRITERION_KEYS) {
      const result = validateCriterionValue(key, criteria[key]);
      if (!result.ok) throw new AppError(result.reason, 400);
      validated[key] = result.value;
    }
    const derived = calculateEvaluationScores(validated);
    const complete = areAllCriteriaComplete(validated);
    const gate = canFinalizeEvaluation({
      status: existing?.status ?? null,
      criteriaComplete: complete,
      signaturePresent: Boolean(input.signatureData?.trim()),
    });
    if (!gate.allowed) throw new AppError(gate.reason, gate.statusCode);

    if (
      input.rating !== null &&
      input.rating !== undefined &&
      input.rating !== "" &&
      !isValidOralRating(input.rating)
    ) {
      throw new AppError("Invalid evaluation rating value.", 400);
    }

    // Server-authoritative timestamps (ignore client signedAt/finalizedAt).
    const signedAt = new Date();
    const finalizedAt = signedAt;
    const rating = mergeOptionalField<string>(
      existing?.rating as string | null,
      (input ?? {}) as Record<string, unknown>,
      "rating",
    );
    const recommendations = mergeOptionalField<string>(
      existing?.recommendations as string | null,
      (input ?? {}) as Record<string, unknown>,
      "recommendations",
    );

    await prisma.$transaction(async (tx) => {
      // CP5-FIX2: re-check session editability inside the write transaction.
      const current = await tx.defenseSchedule.findUnique({
        where: { id: scheduleId },
        select: { sessionStatus: true },
      });
      this.assertSessionEditable(current?.sessionStatus);

      const result = await tx.oralExamScore.updateMany({
        where: {
          scheduleId,
          panelId: assignment.id,
          status: "DRAFT",
        },
        data: {
          status: "FINALIZED",
          timelinessRelevance: validated.timelinessRelevance,
          organization: validated.organization,
          depthComprehensiveness: validated.depthComprehensiveness,
          relevanceConclusions: validated.relevanceConclusions,
          evidenceOriginalThinking: validated.evidenceOriginalThinking,
          presentation: validated.presentation,
          masterySubject: validated.masterySubject,
          communicationSkill: validated.communicationSkill,
          attitude: validated.attitude,
          groupAAverage: derived.groupIValue,
          groupBAverage: derived.groupIIValue,
          overallAverage: derived.overallValue,
          rating: (rating || null) as never,
          recommendations,
          signatureData: input.signatureData.trim(),
          signedAt,
          finalizedAt,
          scoredAt: signedAt,
        },
      });
      if (result.count === 0) {
        throw new AppError(
          "Evaluation state changed. Refresh and try again.",
          409,
        );
      }
    });

    // CP5-FIX1: recompute AFTER commit so concurrent last-finalizers both commit first.
    await this.recomputeEvaluationSessionStatus(scheduleId);

    // CP7: persist official Criteria snapshot (identity metadata only).
    try {
      const { OfficialDefenseRecordService } = await import(
        "./official-defense-record.service"
      );
      await new OfficialDefenseRecordService().snapshotFinalizedEvaluation(
        scheduleId,
        assignment.id,
      );
    } catch {
      // Snapshot is non-blocking for evaluator finalize; backfill on official read.
    }

    // CP7: when all required evaluators are FINALIZED, generate Oral Summary once.
    try {
      const counts = await this.getFinalizedEvaluatorCount(scheduleId);
      if (
        counts.evaluatorAssignments > 0 &&
        counts.finalizedEvaluations >= counts.evaluatorAssignments
      ) {
        const { OfficialDefenseRecordService } = await import(
          "./official-defense-record.service"
        );
        await new OfficialDefenseRecordService().ensureOralExamSummary(
          scheduleId,
        );
      }
    } catch {
      // Summary generation is idempotent; conclusion still enforces existence.
    }

    const row = await prisma.oralExamScore.findUnique({
      where: { scheduleId_panelId: { scheduleId, panelId: assignment.id } },
    });
    return this.toDto(scheduleId, schedule.defenseType, assignment, row);
  }

  /** Session evaluator completion for conclusion readiness (FINALIZED only). */
  async getFinalizedEvaluatorCount(scheduleId: string): Promise<{
    evaluatorAssignments: number;
    finalizedEvaluations: number;
  }> {
    const evaluatorRoles = evaluatorRoleList();
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
    return {
      evaluatorAssignments: assignments.length,
      finalizedEvaluations: finalized,
    };
  }
}
