/**
 * CP7 — Official defense record generation and read models.
 *
 * Oral Examination Summary is generated only from FINALIZED evaluator
 * assignments. WF-C1b: Title, Proposal, and Final Defense all produce the
 * official evaluator Criteria + Oral Examination Summary. FIX-4 derives
 * institutional V2 Summary rows from finalized Group I/II averages with
 * decimal-safe two-decimal rounding; Rating/Remarks and the formal verdict
 * remain deferred/separate. Academic outcome is never written here.
 */
import prisma from "../config/database";
import { Prisma } from "@prisma/client";
import { AppError } from "../utils/AppError";
import { DefenseCommitteePolicy } from "./defense-committee.policy";
import { deriveDefenseRecordStatus } from "./defense-record-status.rules";
import { RapReportService } from "./rap-report.service";
import { isEvaluationStage } from "./oral-evaluation.rules";
import {
  INSTITUTIONAL_MATRIX_V2,
  LEGACY_POINTS_V1,
  type OralEvaluationScoringVersionValue,
} from "./oral-evaluation.institutional.rules";
import {
  meanAcademicValues,
  roundAcademicValue,
} from "./academic-number.rules";

const committeePolicy = new DefenseCommitteePolicy();

/**
 * CDW-4 FIX: official snapshots must record which scoring semantics produced the
 * values. A row without an explicit marker is legacy (pre-migration).
 */
function scoringVersionOf(row: { scoringVersion?: unknown } | null | undefined): OralEvaluationScoringVersionValue {
  return row?.scoringVersion === INSTITUTIONAL_MATRIX_V2
    ? INSTITUTIONAL_MATRIX_V2
    : LEGACY_POINTS_V1;
}

/** UIUX-2M: bounded, validated list filters for the Admin Defense Records index. */
const DEFENSE_TYPE_VALUES = [
  "TITLE_DEFENSE",
  "PROPOSAL_DEFENSE",
  "FINAL_DEFENSE",
] as const;
const RECORD_STATUS_VALUES = [
  "IN_PROGRESS",
  "AWAITING_COMPLETION",
  "COMPLETE",
] as const;
type DefenseTypeValue = (typeof DEFENSE_TYPE_VALUES)[number];

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** FIX-4: a V2 group average must remain inside the institutional 1.00–2.50 scale. */
function assertInstitutionalGroupAverage(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 1 || value > 2.5) {
    throw new AppError(
      `Cannot generate the Oral Examination Summary: a finalized evaluator has an invalid ${label} average.`,
      409,
    );
  }
}

/** Stable evaluator packet order: createdAt ascending, then assignment id. */
function compareBundleAssignments(
  a: { id: string; createdAt: Date },
  b: { id: string; createdAt: Date },
): number {
  const aTime = a.createdAt.getTime();
  const bTime = b.createdAt.getTime();
  if (aTime !== bTime) return aTime - bTime;
  return a.id.localeCompare(b.id);
}

export interface SummaryEvaluatorRow {
  panelAssignmentId: string;
  userId: string;
  evaluatorName: string;
  functionalRole: string;
  groupIValue: number | null;
  groupIIValue: number | null;
  /** FIX-4: canonical Summary row Average for institutional V2 rows. */
  averageValue: number | null;
  /** Legacy point total; null for INSTITUTIONAL_MATRIX_V2. */
  overallValue: number | null;
  rating: string | null;
  recommendations: string | null;
  /** CDW-4 FIX: scoring semantics for this evaluator row. */
  scoringVersion: OralEvaluationScoringVersionValue;
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

/**
 * FORM-INT-2: exact frozen source for the official GS-011 document. Identity and
 * examiner data come only from the persisted summary snapshot; only the
 * stage-specific Adviser seat is resolved from the exact schedule.
 */
export interface OfficialSummaryDocumentSource {
  scheduleId: string;
  defenseType: string;
  summaryId: string | null;
  snapshot: OralExamSummarySnapshot | null;
  adviserName: string | null;
}

export interface DefenseApplicationAssignmentSource {
  panelAssignmentId: string;
  userId: string;
  role: string;
  name: string;
  createdAt: string;
}

/**
 * FORM-INT-3: exact current-record source for GS-006/GS-007. Identity, program,
 * schedule metadata, and committee seats all come from the exact schedule.
 * This is a current-record print source; nothing is persisted or versioned.
 */
export interface OfficialDefenseApplicationDocumentSource {
  scheduleId: string;
  defenseType: string;
  defenseDate: string;
  defenseTime: string;
  venueOrLink: string | null;
  studentName: string | null;
  studentNumber: string | null;
  cellphone: string | null;
  programName: string | null;
  programType: string | null;
  assignments: DefenseApplicationAssignmentSource[];
}

export interface OfficialEvaluationBundleAssignment {
  panelAssignmentId: string;
  role: string;
  userId: string;
  createdAt: string;
}

/**
 * FORM-INT-4 FIX-1: exact evaluator packet source. Only CHAIRMAN/PANELIST
 * assignments become pages; Chairman is first, Panelists follow in stable
 * schedule order. The document service still reads each evaluator through the
 * accepted `getOfficialCriteria` authority.
 */
export interface OfficialEvaluationBundleSource {
  scheduleId: string;
  defenseType: string;
  programType: string;
  studentName: string | null;
  evaluatorAssignments: OfficialEvaluationBundleAssignment[];
}

/** Narrow identity source for canonical readable filenames. */
export interface OfficialDocumentIdentitySource {
  scheduleId: string;
  defenseType: string;
  studentName: string | null;
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
  /** CDW-4 FIX: scoring semantics the frozen criteria were recorded under. */
  scoringVersion: OralEvaluationScoringVersionValue;
  snapshotAt: string;
}

export class OfficialDefenseRecordService {
  /**
   * Idempotent, race-safe Oral Examination Summary generation.
   * Uses OralExamSummary.scheduleId uniqueness as the convergence point.
   *
   * Transaction-aware: pass `db` (a Prisma transaction client) to run all reads
   * and the create on the caller's transaction — required by the locked RAP
   * freeze so Summary generation cannot open a second connection that deadlocks
   * on the parent DefenseSchedule row lock. Ordinary callers omit `db` and use
   * the shared client.
   */
  async ensureOralExamSummary(
    scheduleId: string,
    db: Prisma.TransactionClient = prisma,
  ): Promise<{
    created: boolean;
    summaryId: string;
    evaluatorCount: number;
    overallAverage: number;
    finalRating: string | null;
  }> {
    const schedule = await db.defenseSchedule.findUnique({
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

    if (!isEvaluationStage(String(schedule.defenseType))) {
      throw new AppError(
        "This defense session does not generate an Oral Examination Summary.",
        400,
      );
    }

    const evaluatorRoles = committeePolicy
      .getEvaluatorRoles(schedule.defenseType as never)
      .map(String);

    const assignments = await db.panelAssignment.findMany({
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
    const finalizedRows = await db.oralExamScore.findMany({
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
    const existing = await db.oralExamSummary.findUnique({
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

    // FIX-4: one attempt may not mix legacy point rows with the institutional
    // matrix. There is no authorized cross-version conversion; fail closed.
    const scoringVersions = new Set(
      finalizedRows.map((r) => scoringVersionOf(r)),
    );
    if (scoringVersions.size > 1) {
      throw new AppError(
        "Cannot generate the Oral Examination Summary from mixed scoring versions. All required evaluations must use the same scoring model.",
        409,
      );
    }
    const summaryScoringVersion =
      [...scoringVersions][0] ?? LEGACY_POINTS_V1;

    const rowByPanel = new Map(finalizedRows.map((r) => [r.panelId, r]));
    const evaluators: SummaryEvaluatorRow[] = [];
    let overallAverage: number;

    if (summaryScoringVersion === INSTITUTIONAL_MATRIX_V2) {
      const rowAverages: number[] = [];

      for (const assignment of assignments) {
        const row = rowByPanel.get(assignment.id);
        const groupIValue = roundAcademicValue(row?.groupAAverage);
        const groupIIValue = roundAcademicValue(row?.groupBAverage);

        if (groupIValue === null || groupIIValue === null) {
          throw new AppError(
            "Cannot generate the institutional Oral Examination Summary: a finalized evaluator is missing a Group I or Group II average.",
            409,
          );
        }
        assertInstitutionalGroupAverage(groupIValue, "Group I");
        assertInstitutionalGroupAverage(groupIIValue, "Group II");

        const averageValue = meanAcademicValues([groupIValue, groupIIValue]);
        if (averageValue === null) {
          throw new AppError(
            "Cannot generate the institutional Oral Examination Summary: an evaluator row average could not be computed safely.",
            409,
          );
        }
        rowAverages.push(averageValue);

        evaluators.push({
          panelAssignmentId: assignment.id,
          userId: assignment.userId,
          evaluatorName: `${assignment.user.firstName} ${assignment.user.lastName}`,
          functionalRole: String(assignment.role),
          groupIValue,
          groupIIValue,
          averageValue,
          // V2 has no individual Overall or Rating; the Summary row Average is
          // intentionally a separate field.
          overallValue: null,
          rating: null,
          recommendations: row?.recommendations ?? null,
          scoringVersion: INSTITUTIONAL_MATRIX_V2,
        });
      }

      const computedOverall = meanAcademicValues(rowAverages);
      if (computedOverall === null) {
        throw new AppError(
          "Cannot generate the institutional Oral Examination Summary: the internal overall average could not be computed safely.",
          409,
        );
      }
      overallAverage = computedOverall;
    } else {
      for (const assignment of assignments) {
        const row = rowByPanel.get(assignment.id);
        evaluators.push({
          panelAssignmentId: assignment.id,
          userId: assignment.userId,
          evaluatorName: `${assignment.user.firstName} ${assignment.user.lastName}`,
          functionalRole: String(assignment.role),
          groupIValue: toNumber(row?.groupAAverage),
          groupIIValue: toNumber(row?.groupBAverage),
          averageValue: null,
          overallValue: toNumber(row?.overallAverage),
          rating: (row?.rating as string | null) ?? null,
          recommendations: row?.recommendations ?? null,
          scoringVersion: LEGACY_POINTS_V1,
        });
      }

      // Legacy semantics remain unchanged, but missing historical values must
      // never be silently converted to zero.
      const overallValues = evaluators
        .map((e) => e.overallValue)
        .filter((v): v is number => v !== null);
      if (overallValues.length !== evaluators.length) {
        throw new AppError(
          "Cannot generate the Oral Examination Summary: a finalized evaluator is missing an overall average.",
          409,
        );
      }
      overallAverage =
        overallValues.reduce((a, b) => a + b, 0) / overallValues.length;
    }

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
      const created = await db.oralExamSummary.create({
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
        const winner = await db.oralExamSummary.findUnique({
          where: { scheduleId },
        });
        if (winner) {
          const winnerSnapshot = winner.snapshotData as
            | OralExamSummarySnapshot
            | null;
          return {
            created: false,
            summaryId: winner.id,
            evaluatorCount:
              winnerSnapshot?.evaluatorCount ?? evaluators.length,
            overallAverage: Number(winner.overallAverage ?? overallAverage),
            finalRating: winner.finalRating ?? null,
          };
        }
      }
      throw error;
    }
  }

  /**
   * CDW-4 FIX: the detailed Oral Examination Summary is an ADMIN-side official
   * record. Committee accounts (including the session Chairman) are no longer
   * authorized to read it — the live workspace exposes only evaluation progress
   * and roster status. Issue 12: Title never fabricates numerical content.
   *
   * `actor` is optional for internal callers; when supplied, only ADMIN passes.
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
      },
    });
    if (!schedule) throw new AppError("Defense session not found.", 404);

    // Authorization: ADMIN only (committee-facing fallback removed in CDW-4 FIX).
    if (actor && actor.role !== "ADMIN") {
      throw new AppError(
        "Detailed Oral Examination Summary is restricted to Admin.",
        403,
      );
    }

    // WF-C1b: every canonical defense stage has an official evaluator Summary.
    if (!isEvaluationStage(String(schedule.defenseType))) {
      throw new AppError(
        "This defense session does not use an Oral Examination Summary.",
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
   * FORM-INT-2: exact persisted Oral Examination Summary source for official
   * GS-011 rendering. This never regenerates, mutates, or recomputes a summary.
   * ADMIN-only; Proposal/Final require exactly one exact-schedule ADVISER seat.
   */
  async getOfficialSummaryDocumentSource(
    scheduleId: string,
    actor: { userId: string; role: string },
  ): Promise<OfficialSummaryDocumentSource> {
    if (actor.role !== "ADMIN") {
      throw new AppError(
        "Official document generation is restricted to Admin.",
        403,
      );
    }

    const schedule = await prisma.defenseSchedule.findUnique({
      where: { id: scheduleId },
      select: {
        id: true,
        defenseType: true,
        oralExamSummary: {
          select: { id: true, snapshotData: true },
        },
      },
    });
    if (!schedule) throw new AppError("Defense session not found.", 404);

    const defenseType = String(schedule.defenseType);
    const summary = schedule.oralExamSummary;

    // Title Defense has no Adviser seat. Proposal/Final use only the exact
    // historical ADVISER assignment on this schedule - never the current active
    // AdviserAssignment or another attempt.
    let adviserName: string | null = null;
    if (defenseType !== "TITLE_DEFENSE") {
      const advisers = await prisma.panelAssignment.findMany({
        where: { scheduleId, role: "ADVISER" },
        include: {
          user: { select: { firstName: true, lastName: true } },
        },
      });
      if (advisers.length !== 1) {
        throw new AppError(
          "The defense schedule has no unambiguous Adviser seat.",
          409,
        );
      }
      adviserName =
        `${advisers[0].user.firstName} ${advisers[0].user.lastName}`.trim() ||
        null;
      if (!adviserName) {
        throw new AppError(
          "The defense schedule Adviser has no printable name.",
          409,
        );
      }
    }

    return {
      scheduleId,
      defenseType,
      summaryId: summary?.id ?? null,
      snapshot: (summary?.snapshotData ?? null) as OralExamSummarySnapshot | null,
      adviserName,
    };
  }

  /**
   * FORM-INT-3: exact current-record source for the GS-006/GS-007 Defense
   * Application. ADMIN-only, read-only, and anchored to the exact schedule.
   * The student's generic User.email is deliberately not selected because the
   * form's personal-Gmail field has no approved authoritative source.
   */
  async getOfficialDefenseApplicationDocumentSource(
    scheduleId: string,
    actor: { userId: string; role: string },
  ): Promise<OfficialDefenseApplicationDocumentSource> {
    if (actor.role !== "ADMIN") {
      throw new AppError(
        "Official document generation is restricted to Admin.",
        403,
      );
    }

    const schedule = await prisma.defenseSchedule.findUnique({
      where: { id: scheduleId },
      include: {
        thesis: {
          include: {
            student: {
              include: {
                user: { select: { firstName: true, lastName: true } },
                program: {
                  select: { programName: true, programType: true },
                },
              },
            },
          },
        },
        panelAssignments: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
          // Stable fallback ordering; the document mapper also sorts explicitly.
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        },
      },
    });
    if (!schedule) throw new AppError("Defense session not found.", 404);

    const student = schedule.thesis?.student ?? null;
    const studentName = student
      ? `${student.user.firstName} ${student.user.lastName}`.trim()
      : "";
    const assignments = Array.isArray(schedule.panelAssignments)
      ? schedule.panelAssignments
      : [];

    return {
      scheduleId: schedule.id,
      defenseType: String(schedule.defenseType),
      defenseDate: schedule.defenseDate.toISOString(),
      defenseTime: schedule.defenseTime.toISOString(),
      venueOrLink: schedule.venueOrLink ?? null,
      studentName: studentName || null,
      studentNumber: student?.studentNumber ?? null,
      cellphone: student?.cellphone ?? null,
      programName: student?.program?.programName ?? null,
      programType: student?.program?.programType
        ? String(student.program.programType)
        : null,
      assignments: assignments.map((assignment) => ({
        panelAssignmentId: assignment.id,
        userId: assignment.userId,
        role: String(assignment.role),
        name: `${assignment.user.firstName} ${assignment.user.lastName}`.trim(),
        createdAt: assignment.createdAt.toISOString(),
      })),
    };
  }

  /**
   * FORM-INT-4 FIX-1: exact evaluator packet source for one schedule.
   * ADMIN-only. Evaluator roles come from DefenseCommitteePolicy; non-evaluator
   * committee seats never become pages. Raw DB ordering is never authoritative.
   */
  async getOfficialEvaluationBundleSource(
    scheduleId: string,
    actor: { userId: string; role: string },
  ): Promise<OfficialEvaluationBundleSource> {
    if (actor.role !== "ADMIN") {
      throw new AppError(
        "Official document generation is restricted to Admin.",
        403,
      );
    }

    const schedule = await prisma.defenseSchedule.findUnique({
      where: { id: scheduleId },
      include: {
        thesis: {
          include: {
            student: {
              include: {
                user: { select: { firstName: true, lastName: true } },
                program: { select: { programType: true } },
              },
            },
          },
        },
        panelAssignments: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        },
      },
    });
    if (!schedule) throw new AppError("Defense session not found.", 404);

    const defenseType = String(schedule.defenseType);
    if (!["TITLE_DEFENSE", "PROPOSAL_DEFENSE", "FINAL_DEFENSE"].includes(defenseType)) {
      throw new AppError(
        "This defense session does not generate evaluator forms.",
        422,
      );
    }

    const programType = String(schedule.thesis?.student?.program?.programType ?? "");
    if (programType !== "MASTERS" && programType !== "DOCTORAL") {
      throw new AppError(
        "The defense schedule has an unsupported program type for evaluator forms.",
        422,
      );
    }

    const policy = committeePolicy.getPolicy(
      defenseType as never,
      programType as never,
    );
    const evaluatorRoles = committeePolicy
      .getEvaluatorRoles(defenseType as never)
      .map(String);
    const assignments = Array.isArray(schedule.panelAssignments)
      ? schedule.panelAssignments
      : [];
    const evaluators = assignments.filter((assignment) =>
      evaluatorRoles.includes(String(assignment.role)),
    );

    const seenUsers = new Set<string>();
    for (const evaluator of evaluators) {
      if (seenUsers.has(evaluator.userId)) {
        throw new AppError(
          "The defense committee cannot assign the same evaluator to more than one seat.",
          409,
        );
      }
      seenUsers.add(evaluator.userId);
    }

    const chairmen = evaluators.filter(
      (assignment) => String(assignment.role) === "CHAIRMAN",
    );
    if (chairmen.length !== 1) {
      throw new AppError(
        "The printable evaluator packet requires exactly one Chairman assignment.",
        409,
      );
    }

    const panelists = evaluators
      .filter((assignment) => String(assignment.role) === "PANELIST")
      .sort(compareBundleAssignments);
    if (panelists.length !== policy.panelistCount) {
      throw new AppError(
        `The printable evaluator packet requires exactly ${policy.panelistCount} Panelist assignment(s) for this stage (got ${panelists.length}).`,
        409,
      );
    }

    const student = schedule.thesis?.student ?? null;
    const studentName = student
      ? `${student.user.firstName} ${student.user.lastName}`.trim()
      : "";

    return {
      scheduleId: schedule.id,
      defenseType,
      programType,
      studentName: studentName || null,
      evaluatorAssignments: [chairmen[0], ...panelists].map((assignment) => ({
        panelAssignmentId: assignment.id,
        role: String(assignment.role),
        userId: assignment.userId,
        createdAt: assignment.createdAt.toISOString(),
      })),
    };
  }

  /**
   * FORM-INT-4 FIX-1: narrow exact-schedule identity for canonical readable
   * filenames. This deliberately does not read the Admin detail/RAP read model.
   */
  async getOfficialDocumentIdentity(
    scheduleId: string,
    actor: { userId: string; role: string },
  ): Promise<OfficialDocumentIdentitySource> {
    if (actor.role !== "ADMIN") {
      throw new AppError(
        "Official document generation is restricted to Admin.",
        403,
      );
    }

    const schedule = await prisma.defenseSchedule.findUnique({
      where: { id: scheduleId },
      include: {
        thesis: {
          include: {
            student: {
              include: {
                user: { select: { firstName: true, lastName: true } },
              },
            },
          },
        },
      },
    });
    if (!schedule) throw new AppError("Defense session not found.", 404);

    const student = schedule.thesis?.student ?? null;
    const studentName = student
      ? `${student.user.firstName} ${student.user.lastName}`.trim()
      : "";

    return {
      scheduleId: schedule.id,
      defenseType: String(schedule.defenseType),
      studentName: studentName || null,
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
        scoringVersion: scoringVersionOf(row),
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
      scoringVersion: scoringVersionOf(row),
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
   * CP7 Admin Defense Records — read-only list. No academic mutation surface.
   *
   * UIUX-2M: supports bounded server-backed filters (`defenseType`,
   * `recordStatus`) and exposes a stage-aware `recordStatus` +
   * `recordStatusDetail` completion projection derived only from existing
   * authoritative fields. `recordStatus` is a UI projection, not a persisted
   * lifecycle enum, and is never an academic result.
   *
   * `defenseType` filters at the DB level. `recordStatus` is derived, so it can
   * only be filtered in memory; in that case the matching rows are projected and
   * filtered before paging. When no `recordStatus` filter is requested the
   * existing DB pagination is preserved.
   */
  async listAdminDefenseRecords(params?: {
    page?: number;
    pageSize?: number;
    search?: string;
    defenseType?: string;
    recordStatus?: string;
  }) {
    const page = Math.max(1, Number(params?.page ?? 1) || 1);
    const pageSize = Math.min(
      100,
      Math.max(1, Number(params?.pageSize ?? 10) || 10),
    );
    const search = (params?.search ?? "").trim();
    const defenseTypeFilter = String(params?.defenseType ?? "")
      .trim()
      .toUpperCase();
    const recordStatusFilter = String(params?.recordStatus ?? "")
      .trim()
      .toUpperCase();
    // Validate/bound the params: unrecognized values are ignored, never passed
    // through to Prisma (which would throw a raw validation error).
    const hasDefenseTypeFilter = (
      DEFENSE_TYPE_VALUES as readonly string[]
    ).includes(defenseTypeFilter);
    const hasRecordStatusFilter = (
      RECORD_STATUS_VALUES as readonly string[]
    ).includes(recordStatusFilter);

    let where: Prisma.DefenseScheduleWhereInput = search
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
    if (hasDefenseTypeFilter) {
      where = {
        ...where,
        defenseType: defenseTypeFilter as DefenseTypeValue,
      };
    }

    const include = {
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
        orderBy: { createdAt: "desc" as const },
        take: 1,
      },
    } as const;

    type ScheduleRow = Prisma.DefenseScheduleGetPayload<{
      include: typeof include;
    }>;
    const mapRow = (s: ScheduleRow) => {
      const formalResult = s.conclusion?.outcome ?? null;
      const summaryReady = Boolean(s.oralExamSummary);
      const rapStatus = s.rapReports[0]?.status
        ? String(s.rapReports[0].status)
        : null;
      const projection = deriveDefenseRecordStatus({
        defenseType: String(s.defenseType),
        sessionStatus: String(s.sessionStatus),
        formalResult: formalResult ? String(formalResult) : null,
        summaryReady,
        rapStatus,
      });
      return {
        scheduleId: s.id,
        studentName: s.thesis?.student
          ? `${s.thesis.student.user.firstName} ${s.thesis.student.user.lastName}`
          : null,
        studentNumber: s.thesis?.student?.studentNumber ?? null,
        program: s.thesis?.student?.program?.programName ?? null,
        defenseType: String(s.defenseType),
        defenseDate: s.defenseDate?.toISOString() ?? null,
        defenseTime: s.defenseTime?.toISOString() ?? null,
        sessionStatus: String(s.sessionStatus),
        formalResult: formalResult ? String(formalResult) : null,
        summaryReady,
        rapStatus,
        recordStatus: projection.status,
        recordStatusDetail: projection.detail,
      };
    };

    if (hasRecordStatusFilter) {
      // Derived filter: project all matching rows, then filter + page in memory.
      const rows = await prisma.defenseSchedule.findMany({
        where,
        orderBy: { defenseDate: "desc" },
        include,
      });
      const filtered = rows
        .map(mapRow)
        .filter((r) => r.recordStatus === recordStatusFilter);
      const total = filtered.length;
      const start = (page - 1) * pageSize;
      return {
        data: filtered.slice(start, start + pageSize),
        total,
        page,
        pageSize,
      };
    }

    // No derived filter: preserve DB-level pagination.
    const [rows, total] = await prisma.$transaction([
      prisma.defenseSchedule.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { defenseDate: "desc" },
        include,
      }),
      prisma.defenseSchedule.count({ where }),
    ]);
    return {
      data: rows.map(mapRow),
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
    // RAP-1 FIX-2: reconcile OPEN RAP signature slots against the canonical
    // stage-aware policy before reading them, so pre-RAP-1 records show the
    // authoritative committee signers. Idempotent and a strict no-op for
    // FINALIZED RAPs; mirrors the established guarded snapshot-backfill read.
    await new RapReportService().reconcileOpenRapSignatures(scheduleId);

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
