/**
 * CP7 — Official defense record generation and read models.
 *
 * Oral Examination Summary is generated only from FINALIZED evaluator
 * assignments. Title Defense never produces a numerical summary.
 * Academic outcome is never written here.
 */
import prisma from "../config/database";
import { Prisma } from "@prisma/client";
import { AppError } from "../utils/AppError";
import { DefenseCommitteePolicy } from "./defense-committee.policy";

const committeePolicy = new DefenseCommitteePolicy();

export function isNumericalDefenseType(defenseType: string): boolean {
  return (
    defenseType === "PROPOSAL_DEFENSE" || defenseType === "FINAL_DEFENSE"
  );
}

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export interface SummaryEvaluatorRow {
  panelAssignmentId: string;
  userId: string;
  evaluatorName: string;
  functionalRole: string;
  groupIValue: number | null;
  groupIIValue: number | null;
  overallValue: number | null;
  rating: string | null;
  recommendations: string | null;
}

export interface OralExamSummarySnapshot {
  schemaVersion: 1;
  scheduleId: string;
  defenseType: string;
  studentName: string | null;
  studentNumber: string | null;
  program: string | null;
  defenseDate: string | null;
  defenseTime: string | null;
  venueOrLink: string | null;
  evaluators: SummaryEvaluatorRow[];
  evaluatorCount: number;
  overallAverage: number;
  generatedAt: string;
}

export interface OfficialCriteriaDto {
  available: boolean;
  status: string;
  scheduleId: string;
  panelAssignmentId: string;
  defenseType: string;
  studentName: string | null;
  studentNumber: string | null;
  program: string | null;
  defenseDate: string | null;
  defenseTime: string | null;
  venueOrLink: string | null;
  evaluatorName: string | null;
  evaluatorUserId: string | null;
  functionalRole: string | null;
  criteria: Record<string, number | null>;
  groupIValue: number | null;
  groupIIValue: number | null;
  overallValue: number | null;
  rating: string | null;
  recommendations: string | null;
  signatureData: string | null;
  signedAt: string | null;
  finalizedAt: string | null;
  officialSnapshot: OralExamScoreOfficialSnapshot | null;
}

export interface OralExamScoreOfficialSnapshot {
  schemaVersion: 1;
  scheduleId: string;
  panelAssignmentId: string;
  defenseType: string;
  studentName: string | null;
  studentNumber: string | null;
  program: string | null;
  defenseDate: string | null;
  evaluatorName: string | null;
  evaluatorUserId: string | null;
  functionalRole: string | null;
  criteria: Record<string, number | null>;
  groupIValue: number | null;
  groupIIValue: number | null;
  overallValue: number | null;
  rating: string | null;
  recommendations: string | null;
  signedAt: string | null;
  finalizedAt: string | null;
  snapshotAt: string;
}

export class OfficialDefenseRecordService {
  /**
   * Idempotent, race-safe Oral Examination Summary generation.
   * Uses OralExamSummary.scheduleId uniqueness as the convergence point.
   */
  async ensureOralExamSummary(scheduleId: string): Promise<{
    created: boolean;
    summaryId: string;
    evaluatorCount: number;
    overallAverage: number;
    finalRating: string | null;
  }> {
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
                program: {
                  select: { programName: true, programType: true },
                },
              },
            },
          },
        },
      },
    });
    if (!schedule) throw new AppError("Defense session not found.", 404);

    if (!isNumericalDefenseType(String(schedule.defenseType))) {
      throw new AppError(
        "Title Defense does not generate a numerical Oral Examination Summary.",
        400,
      );
    }

    const evaluatorRoles = committeePolicy
      .getEvaluatorRoles(schedule.defenseType as never)
      .map(String);

    const assignments = await prisma.panelAssignment.findMany({
      where: { scheduleId, role: { in: evaluatorRoles as never[] } },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    if (assignments.length === 0) {
      throw new AppError(
        "No evaluator assignments exist for this defense session.",
        409,
      );
    }

    const assignmentIds = assignments.map((a) => a.id);
    const finalizedRows = await prisma.oralExamScore.findMany({
      where: {
        scheduleId,
        status: "FINALIZED",
        panelId: { in: assignmentIds },
      },
      include: {
        panel: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });

    if (finalizedRows.length < assignments.length) {
      throw new AppError(
        "All required evaluator evaluations must be finalized before the Oral Examination Summary can be generated.",
        409,
      );
    }

    // Existing summary is authoritative (idempotent).
    const existing = await prisma.oralExamSummary.findUnique({
      where: { scheduleId },
    });
    if (existing) {
      return {
        created: false,
        summaryId: existing.id,
        evaluatorCount:
          (existing.snapshotData as OralExamSummarySnapshot | null)
            ?.evaluatorCount ?? finalizedRows.length,
        overallAverage: Number(existing.overallAverage ?? 0),
        finalRating: existing.finalRating ?? null,
      };
    }

    const rowByPanel = new Map(finalizedRows.map((r) => [r.panelId, r]));
    const evaluators: SummaryEvaluatorRow[] = assignments.map((a) => {
      const row = rowByPanel.get(a.id);
      return {
        panelAssignmentId: a.id,
        userId: a.userId,
        evaluatorName: `${a.user.firstName} ${a.user.lastName}`,
        functionalRole: String(a.role),
        groupIValue: toNumber(row?.groupAAverage),
        groupIIValue: toNumber(row?.groupBAverage),
        overallValue: toNumber(row?.overallAverage),
        rating: (row?.rating as string | null) ?? null,
        recommendations: row?.recommendations ?? null,
      };
    });

    const overallValues = evaluators
      .map((e) => e.overallValue)
      .filter((v): v is number => v !== null);
    const overallAverage =
      overallValues.length > 0
        ? overallValues.reduce((a, b) => a + b, 0) / overallValues.length
        : 0;

    const snapshot: OralExamSummarySnapshot = {
      schemaVersion: 1,
      scheduleId,
      defenseType: String(schedule.defenseType),
      studentName: schedule.thesis?.student
        ? `${schedule.thesis.student.user.firstName} ${schedule.thesis.student.user.lastName}`
        : null,
      studentNumber: schedule.thesis?.student?.studentNumber ?? null,
      program: schedule.thesis?.student?.program?.programName ?? null,
      defenseDate: schedule.defenseDate
        ? schedule.defenseDate.toISOString()
        : null,
      defenseTime: schedule.defenseTime
        ? schedule.defenseTime.toISOString()
        : null,
      venueOrLink: schedule.venueOrLink ?? null,
      evaluators,
      evaluatorCount: evaluators.length,
      overallAverage,
      generatedAt: new Date().toISOString(),
    };

    try {
      const created = await prisma.oralExamSummary.create({
        data: {
          scheduleId,
          overallAverage,
          // Never fabricate an institutional rating from average or outcome.
          finalRating: null,
          finalRemarks: null,
          attestedById: null,
          snapshotData: snapshot as never,
        },
      });
      return {
        created: true,
        summaryId: created.id,
        evaluatorCount: evaluators.length,
        overallAverage,
        finalRating: null,
      };
    } catch (error: unknown) {
      // Concurrent last-finalizer race: unique(scheduleId) converges to one row.
      const code = (error as { code?: string })?.code;
      if (code === "P2002") {
        const winner = await prisma.oralExamSummary.findUnique({
          where: { scheduleId },
        });
        if (winner) {
          return {
            created: false,
            summaryId: winner.id,
            evaluatorCount: evaluators.length,
            overallAverage: Number(winner.overallAverage ?? overallAverage),
            finalRating: winner.finalRating ?? null,
          };
        }
      }
      throw error;
    }
  }

  /**
   * CP7-FIX1 Issue 3: detailed Summary is ADMIN or session CHAIRMAN only.
   * Issue 12: Title Defense never fabricates numerical Summary content.
   */
  async getSummaryReadModel(
    scheduleId: string,
    actor?: { userId: string; role: string },
  ) {
    const schedule = await prisma.defenseSchedule.findUnique({
      where: { id: scheduleId },
      include: {
        thesis: {
          include: {
            student: {
              include: {
                user: { select: { firstName: true, lastName: true } },
                program: { select: { programName: true } },
              },
            },
          },
        },
        oralExamSummary: true,
        conclusion: true,
        panelAssignments: {
          where: actor
            ? { userId: actor.userId }
            : { id: { in: [] } },
          select: { role: true },
          take: 1,
        },
      },
    });
    if (!schedule) throw new AppError("Defense session not found.", 404);

    // Authorization: ADMIN or session CHAIRMAN assignment.
    if (actor) {
      const isAdmin = actor.role === "ADMIN";
      const sessionRole = schedule.panelAssignments[0]
        ? String(schedule.panelAssignments[0].role)
        : null;
      const isChairman = sessionRole === "CHAIRMAN";
      if (!isAdmin && !isChairman) {
        throw new AppError(
          "Detailed Oral Examination Summary is restricted to Admin and the session Chairman.",
          403,
        );
      }
    }

    // Issue 12: Title has no numerical Summary.
    if (!isNumericalDefenseType(String(schedule.defenseType))) {
      throw new AppError(
        "Title Defense does not use numerical Oral Examination Summary.",
        400,
      );
    }

    const evaluatorRoles = committeePolicy
      .getEvaluatorRoles(schedule.defenseType as never)
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

    const summary = schedule.oralExamSummary;
    const snapshot = (summary?.snapshotData ?? null) as OralExamSummarySnapshot | null;

    return {
      scheduleId,
      defenseType: String(schedule.defenseType),
      ready: Boolean(summary),
      evaluatorAssignments: assignments.length,
      finalizedEvaluations: finalized,
      overallAverage: summary ? Number(summary.overallAverage) : null,
      finalRating: summary?.finalRating ?? null,
      generatedAt: summary?.createdAt?.toISOString() ?? null,
      studentName: schedule.thesis?.student
        ? `${schedule.thesis.student.user.firstName} ${schedule.thesis.student.user.lastName}`
        : null,
      studentNumber: schedule.thesis?.student?.studentNumber ?? null,
      program: schedule.thesis?.student?.program?.programName ?? null,
      defenseDate: schedule.defenseDate
        ? schedule.defenseDate.toISOString()
        : null,
      evaluators: snapshot?.evaluators ?? [],
      formalOutcome: schedule.conclusion?.outcome ?? null,
    };
  }

  /**
  /**
   * Official individual Oral Examination Criteria.
   * CP7-FIX1 Issue 8: authorization FIRST — before any snapshot backfill.
   * Available only for FINALIZED evaluator records with signature evidence.
   */
  async getOfficialCriteria(
    scheduleId: string,
    panelAssignmentId: string,
    actor?: { userId: string; role: string },
  ): Promise<OfficialCriteriaDto> {
    const schedule = await prisma.defenseSchedule.findUnique({
      where: { id: scheduleId },
      include: {
        thesis: {
          include: {
            student: {
              include: {
                user: { select: { firstName: true, lastName: true } },
                program: { select: { programName: true } },
              },
            },
          },
        },
      },
    });
    if (!schedule) throw new AppError("Defense session not found.", 404);

    const assignment = await prisma.panelAssignment.findUnique({
      where: { id: panelAssignmentId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!assignment || assignment.scheduleId !== scheduleId) {
      throw new AppError("Panel assignment not found for this defense.", 404);
    }

    // Authorization BEFORE any official-record side effect.
    if (actor) {
      const isAdmin = actor.role === "ADMIN";
      const isOwner = actor.userId === assignment.userId;
      if (!isAdmin && !isOwner) {
        throw new AppError(
          "You may not inspect another evaluator's individual Oral Examination Criteria.",
          403,
        );
      }
    }

    const evaluatorRoles = committeePolicy
      .getEvaluatorRoles(schedule.defenseType as never)
      .map(String);
    if (!evaluatorRoles.includes(String(assignment.role))) {
      throw new AppError(
        "Only evaluator assignments have Oral Examination Criteria records.",
        404,
      );
    }

    const row = await prisma.oralExamScore.findUnique({
      where: {
        scheduleId_panelId: { scheduleId, panelId: assignment.id },
      },
    });

    const base = {
      scheduleId,
      panelAssignmentId: assignment.id,
      defenseType: String(schedule.defenseType),
      studentName: schedule.thesis?.student
        ? `${schedule.thesis.student.user.firstName} ${schedule.thesis.student.user.lastName}`
        : null,
      studentNumber: schedule.thesis?.student?.studentNumber ?? null,
      program: schedule.thesis?.student?.program?.programName ?? null,
      defenseDate: schedule.defenseDate
        ? schedule.defenseDate.toISOString()
        : null,
      defenseTime: schedule.defenseTime
        ? schedule.defenseTime.toISOString()
        : null,
      venueOrLink: schedule.venueOrLink ?? null,
      evaluatorName: `${assignment.user.firstName} ${assignment.user.lastName}`,
      evaluatorUserId: assignment.userId,
      functionalRole: String(assignment.role),
    };

    if (!row || row.status !== "FINALIZED" || !row.signatureData || !row.finalizedAt) {
      return {
        ...base,
        available: false,
        status: (row?.status as string) ?? "NOT_STARTED",
        criteria: {},
        groupIValue: null,
        groupIIValue: null,
        overallValue: null,
        rating: null,
        recommendations: null,
        signatureData: null,
        signedAt: null,
        finalizedAt: null,
        officialSnapshot: null,
      };
    }

    // Safe idempotent snapshot backfill for pre-CP7 FINALIZED rows.
    let snapshot = (row.officialSnapshot ?? null) as OralExamScoreOfficialSnapshot | null;
    if (!snapshot) {
      snapshot = {
        schemaVersion: 1,
        scheduleId,
        panelAssignmentId: assignment.id,
        defenseType: base.defenseType,
        studentName: base.studentName,
        studentNumber: base.studentNumber,
        program: base.program,
        defenseDate: base.defenseDate,
        evaluatorName: base.evaluatorName,
        evaluatorUserId: base.evaluatorUserId,
        functionalRole: base.functionalRole,
        criteria: {
          timelinessRelevance: toNumber(row.timelinessRelevance),
          organization: toNumber(row.organization),
          depthComprehensiveness: toNumber(row.depthComprehensiveness),
          relevanceConclusions: toNumber(row.relevanceConclusions),
          evidenceOriginalThinking: toNumber(row.evidenceOriginalThinking),
          presentation: toNumber(row.presentation),
          masterySubject: toNumber(row.masterySubject),
          communicationSkill: toNumber(row.communicationSkill),
          attitude: toNumber(row.attitude),
        },
        groupIValue: toNumber(row.groupAAverage),
        groupIIValue: toNumber(row.groupBAverage),
        overallValue: toNumber(row.overallAverage),
        rating: (row.rating as string | null) ?? null,
        recommendations: row.recommendations ?? null,
        signedAt: row.signedAt?.toISOString() ?? null,
        finalizedAt: row.finalizedAt?.toISOString() ?? null,
        snapshotAt: new Date().toISOString(),
      };
      // Never overwrite academic values during backfill.
      await prisma.oralExamScore.updateMany({
        where: {
          id: row.id,
          status: "FINALIZED",
        },
        data: { officialSnapshot: snapshot as never },
      });
    }

    return {
      ...base,
      available: true,
      status: "FINALIZED",
      criteria: snapshot.criteria,
      groupIValue: snapshot.groupIValue,
      groupIIValue: snapshot.groupIIValue,
      overallValue: snapshot.overallValue,
      rating: snapshot.rating,
      recommendations: snapshot.recommendations,
      // Raw signature evidence is for official print rendering only.
      signatureData: row.signatureData,
      signedAt: row.signedAt?.toISOString() ?? null,
      finalizedAt: row.finalizedAt?.toISOString() ?? null,
      officialSnapshot: snapshot,
    };
  }

  /**
   * Write officialSnapshot at evaluation finalization (called from OralEvaluationService).
   * Never changes scores/signature/timestamps.
   */
  async snapshotFinalizedEvaluation(
    scheduleId: string,
    panelAssignmentId: string,
  ): Promise<void> {
    const schedule = await prisma.defenseSchedule.findUnique({
      where: { id: scheduleId },
      include: {
        thesis: {
          include: {
            student: {
              include: {
                user: { select: { firstName: true, lastName: true } },
                program: { select: { programName: true } },
              },
            },
          },
        },
      },
    });
    if (!schedule) return;

    const assignment = await prisma.panelAssignment.findUnique({
      where: { id: panelAssignmentId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!assignment) return;

    const row = await prisma.oralExamScore.findUnique({
      where: {
        scheduleId_panelId: { scheduleId, panelId: assignment.id },
      },
    });
    if (!row || row.status !== "FINALIZED" || row.officialSnapshot) return;

    const snapshot: OralExamScoreOfficialSnapshot = {
      schemaVersion: 1,
      scheduleId,
      panelAssignmentId: assignment.id,
      defenseType: String(schedule.defenseType),
      studentName: schedule.thesis?.student
        ? `${schedule.thesis.student.user.firstName} ${schedule.thesis.student.user.lastName}`
        : null,
      studentNumber: schedule.thesis?.student?.studentNumber ?? null,
      program: schedule.thesis?.student?.program?.programName ?? null,
      defenseDate: schedule.defenseDate
        ? schedule.defenseDate.toISOString()
        : null,
      evaluatorName: `${assignment.user.firstName} ${assignment.user.lastName}`,
      evaluatorUserId: assignment.userId,
      functionalRole: String(assignment.role),
      criteria: {
        timelinessRelevance: toNumber(row.timelinessRelevance),
        organization: toNumber(row.organization),
        depthComprehensiveness: toNumber(row.depthComprehensiveness),
        relevanceConclusions: toNumber(row.relevanceConclusions),
        evidenceOriginalThinking: toNumber(row.evidenceOriginalThinking),
        presentation: toNumber(row.presentation),
        masterySubject: toNumber(row.masterySubject),
        communicationSkill: toNumber(row.communicationSkill),
        attitude: toNumber(row.attitude),
      },
      groupIValue: toNumber(row.groupAAverage),
      groupIIValue: toNumber(row.groupBAverage),
      overallValue: toNumber(row.overallAverage),
      rating: (row.rating as string | null) ?? null,
      recommendations: row.recommendations ?? null,
      signedAt: row.signedAt?.toISOString() ?? null,
      finalizedAt: row.finalizedAt?.toISOString() ?? null,
      snapshotAt: new Date().toISOString(),
    };

    await prisma.oralExamScore.updateMany({
      where: {
        id: row.id,
        status: "FINALIZED",
      },
      data: { officialSnapshot: snapshot as never },
    });
  }

  /**
   * CP7 Admin Defense Records — read-only list.
   * No academic mutation surface.
   */
  async listAdminDefenseRecords(params?: {
    page?: number;
    pageSize?: number;
    search?: string;
  }) {
    const page = Math.max(1, Number(params?.page ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(params?.pageSize ?? 10)));
    const search = (params?.search ?? "").trim();

    const where = search
      ? {
          OR: [
            {
              thesis: {
                student: {
                  user: {
                    OR: [
                      { firstName: { contains: search } },
                      { lastName: { contains: search } },
                      { email: { contains: search } },
                    ],
                  },
                },
              },
            },
            {
              thesis: {
                student: { studentNumber: { contains: search } },
              },
            },
          ],
        }
      : {};

    const [rows, total] = await prisma.$transaction([
      prisma.defenseSchedule.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { defenseDate: "desc" },
        include: {
          thesis: {
            include: {
              student: {
                include: {
                  user: { select: { firstName: true, lastName: true } },
                  program: { select: { programName: true } },
                },
              },
            },
          },
          conclusion: { select: { outcome: true, concludedAt: true } },
          oralExamSummary: { select: { id: true, overallAverage: true } },
          rapReports: {
            select: { id: true, status: true, finalizedAt: true },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      }),
      prisma.defenseSchedule.count({ where }),
    ]);

    return {
      data: rows.map((s) => ({
        scheduleId: s.id,
        studentName: s.thesis?.student
          ? `${s.thesis.student.user.firstName} ${s.thesis.student.user.lastName}`
          : null,
        studentNumber: s.thesis?.student?.studentNumber ?? null,
        program: s.thesis?.student?.program?.programName ?? null,
        defenseType: String(s.defenseType),
        defenseDate: s.defenseDate?.toISOString() ?? null,
        sessionStatus: String(s.sessionStatus),
        formalResult: s.conclusion?.outcome ?? null,
        summaryReady: Boolean(s.oralExamSummary),
        rapStatus: s.rapReports[0]?.status ?? null,
      })),
      total,
      page,
      pageSize,
    };
  }

  /**
   * CP7 Admin Defense Records detail — read-only official outputs metadata.
   * Does not expose score-edit or Chairman-result mutation actions.
   */
  async getAdminDefenseRecordDetail(scheduleId: string) {
    const schedule = await prisma.defenseSchedule.findUnique({
      where: { id: scheduleId },
      include: {
        thesis: {
          include: {
            student: {
              include: {
                user: { select: { firstName: true, lastName: true } },
                program: { select: { programName: true, programType: true } },
              },
            },
            thesisTitles: {
              select: { id: true, titleText: true, isSelected: true },
            },
          },
        },
        panelAssignments: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        oralExamScores: {
          select: {
            panelId: true,
            status: true,
            overallAverage: true,
            signedAt: true,
            finalizedAt: true,
            signatureData: true,
          },
        },
        oralExamSummary: true,
        conclusion: true,
        rapReports: {
          include: {
            signatures: {
              include: {
                user: { select: { firstName: true, lastName: true } },
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });
    if (!schedule) throw new AppError("Defense session not found.", 404);

    const evaluatorRoles = committeePolicy
      .getEvaluatorRoles(schedule.defenseType as never)
      .map(String);
    const scoreByPanel = new Map(
      schedule.oralExamScores.map((s) => [s.panelId, s]),
    );

    const evaluations = schedule.panelAssignments
      .filter((p) => evaluatorRoles.includes(String(p.role)))
      .map((p) => {
        const row = scoreByPanel.get(p.id);
        const status =
          row?.status === "FINALIZED"
            ? "FINALIZED"
            : row?.status === "DRAFT"
              ? "DRAFT"
              : "NOT_STARTED";
        return {
          panelAssignmentId: p.id,
          evaluatorName: `${p.user.firstName} ${p.user.lastName}`,
          role: String(p.role),
          status,
          overallValue: row?.overallAverage != null ? Number(row.overallAverage) : null,
          hasOfficialCriteria: status === "FINALIZED" && Boolean(row?.signatureData),
          signedAt: row?.signedAt?.toISOString() ?? null,
          finalizedAt: row?.finalizedAt?.toISOString() ?? null,
        };
      });

    const summary = schedule.oralExamSummary;
    const snapshot = (summary?.snapshotData ?? null) as OralExamSummarySnapshot | null;
    const rap = schedule.rapReports[0] ?? null;

    return {
      scheduleId,
      defenseOverview: {
        studentName: schedule.thesis?.student
          ? `${schedule.thesis.student.user.firstName} ${schedule.thesis.student.user.lastName}`
          : null,
        studentNumber: schedule.thesis?.student?.studentNumber ?? null,
        program: schedule.thesis?.student?.program?.programName ?? null,
        defenseType: String(schedule.defenseType),
        defenseDate: schedule.defenseDate?.toISOString() ?? null,
        defenseTime: schedule.defenseTime?.toISOString() ?? null,
        venueOrLink: schedule.venueOrLink ?? null,
        sessionStatus: String(schedule.sessionStatus),
        formalResult: schedule.conclusion?.outcome ?? null,
        concludedAt: schedule.conclusion?.concludedAt?.toISOString() ?? null,
        committee: schedule.panelAssignments.map((p) => ({
          userId: p.userId,
          name: `${p.user.firstName} ${p.user.lastName}`,
          role: String(p.role),
        })),
        proposedTitles: schedule.thesis?.thesisTitles ?? [],
      },
      individualEvaluations: evaluations,
      oralExamSummary: summary
        ? {
            ready: true,
            overallAverage: Number(summary.overallAverage),
            finalRating: summary.finalRating ?? null,
            evaluatorCount: snapshot?.evaluatorCount ?? evaluations.length,
            rows: snapshot?.evaluators ?? [],
            generatedAt: summary.createdAt?.toISOString() ?? null,
          }
        : { ready: false, overallAverage: null, finalRating: null, rows: [] },
      rapReport: rap
        ? {
            id: rap.id,
            status: String(rap.status),
            generatedAt: rap.generatedAt?.toISOString() ?? null,
            finalizedAt: rap.finalizedAt?.toISOString() ?? null,
            selectedTitle: rap.selectedTitle ?? null,
            requiredSignatures: rap.signatures
              .filter((s) => s.required !== false)
              .length,
            signedSignatures: rap.signatures.filter((s) => s.isSigned === true)
              .length,
            signatories: rap.signatures.map((s) => ({
              name: s.user ? `${s.user.firstName} ${s.user.lastName}` : null,
              roleAtDefense: s.roleAtDefense ?? null,
              required: s.required !== false,
              isSigned: s.isSigned === true,
              signedAt: s.signedAt?.toISOString() ?? null,
            })),
          }
        : null,
    };
  }
}
