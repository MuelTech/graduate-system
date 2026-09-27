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
  calculateEvaluationScores,
  canEditEvaluation,
  canFinalizeEvaluation,
  CRITERION_LIMITS,
  isEvaluatorRole,
  isNumericalEvaluationComplete,
  isNumericalEvaluationDefense,
  isValidOralRating,
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
    this.assertNumericalStage(schedule.defenseType);
    const assignment = await this.resolveOwnAssignment(scheduleId, userId);
    this.assertEvaluatorRole(assignment.role);
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
    this.assertNumericalStage(schedule.defenseType);
    const assignment = await this.resolveOwnAssignment(scheduleId, userId);
    this.assertEvaluatorRole(assignment.role);

    // Optional legacy panelId: must match own assignment if supplied.
    if (
      input.clientPanelId &&
      String(input.clientPanelId) !== String(assignment.id)
    ) {
      throw new AppError(
        "Panel assignment does not match the authenticated evaluator.",
        403,
      );
    }

    const criteria = input.criteria ?? {};
    const validated: Partial<Record<CriterionKey, number | null>> = {};
    for (const key of CRITERION_KEYS) {
      const result = validateCriterionValue(key, criteria[key]);
      if (!result.ok) throw new AppError(result.reason, 400);
      validated[key] = result.value;
    }
    if (
      input.rating !== null &&
      input.rating !== undefined &&
      input.rating !== "" &&
      !isValidOralRating(input.rating)
    ) {
      throw new AppError("Invalid evaluation rating value.", 400);
    }

    const derived = calculateEvaluationScores(validated);
    const now = new Date();

    await prisma.$transaction(async (tx) => {
      const existing = await tx.oralExamScore.findUnique({
        where: { scheduleId_panelId: { scheduleId, panelId: assignment.id } },
      });
      if (existing?.status === "FINALIZED") {
        throw new AppError("Evaluation is already finalized.", 409);
      }

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
        // Server-derived only (legacy column names = point subtotals).
        groupAAverage: derived.groupIValue,
        groupBAverage: derived.groupIIValue,
        overallAverage: derived.overallValue,
        rating:
          input.rating === null || input.rating === undefined || input.rating === ""
            ? null
            : (input.rating as never),
        recommendations: input.recommendations ?? null,
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

      // Session progress: Draft → IN_PROGRESS (never AWAITING_CONCLUSION from draft).
      if (schedule.sessionStatus === "SCHEDULED" || schedule.sessionStatus === "UNSCHEDULED") {
        await tx.defenseSchedule.update({
          where: { id: scheduleId },
          data: { sessionStatus: "IN_PROGRESS" },
        });
      } else if (schedule.sessionStatus === "IN_PROGRESS") {
        // stay
      } else if (schedule.sessionStatus === "AWAITING_CONCLUSION") {
        // Keep awaiting only if still all finalized; draft cannot appear after finalize of self,
        // but another draft may exist — recompute below on finalize only.
      }
    });

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
    this.assertNumericalStage(schedule.defenseType);
    const assignment = await this.resolveOwnAssignment(scheduleId, userId);
    this.assertEvaluatorRole(assignment.role);

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

    const criteria = {
      ...(Object.fromEntries(
        CRITERION_KEYS.map((k) => [k, (existing as any)?.[k] ?? null]),
      ) as CriteriaInput),
      ...(input.criteria ?? {}),
    };
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

    await prisma.$transaction(async (tx) => {
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
          rating:
            input.rating === null || input.rating === undefined || input.rating === ""
              ? (existing?.rating as never) ?? null
              : (input.rating as never),
          recommendations: input.recommendations ?? existing?.recommendations ?? null,
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

      // Recompute session progress from FINALIZED evaluators only.
      const evaluatorRoles = evaluatorRoleList();
      const assignments = await tx.panelAssignment.findMany({
        where: { scheduleId, role: { in: evaluatorRoles as never[] } },
        select: { id: true },
      });
      const finalized = await tx.oralExamScore.count({
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
      await tx.defenseSchedule.update({
        where: { id: scheduleId },
        data: {
          sessionStatus: complete ? "AWAITING_CONCLUSION" : "IN_PROGRESS",
        },
      });
    });

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
