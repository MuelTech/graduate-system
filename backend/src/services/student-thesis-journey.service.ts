/**
 * Student Thesis Journey read model (WP5).
 *
 * One authoritative Student-authenticated journey response for sidebar,
 * currentStep redirect, lock reasons, adviser state, and STRIKE policy.
 *
 * Academic completion comes from formal domain records only.
 */
import prisma from "../config/database";
import { AppError } from "../utils/AppError";
import { isRapStatusComplete } from "./stage-completion";
import { resolveStrikePolicy } from "./strike-policy";
import {
  evaluateStudentThesisJourney,
  type AdminSessionState,
  type DefenseSessionSummary,
  type JourneySnapshot,
  type StudentThesisJourneyDto,
} from "./student-thesis-journey.rules";

/** RAP completion for the exact defense session that owns the formal conclusion. */
async function hasFinalizedRapForSession(
  scheduleId: string | null | undefined,
  defenseType: "TITLE_DEFENSE" | "PROPOSAL_DEFENSE",
): Promise<boolean> {
  if (!scheduleId) return false;
  const rows = await prisma.rapReport.findMany({
    where: { scheduleId, defenseType },
    select: { status: true },
  });
  return rows.some((r) => isRapStatusComplete(r.status));
}

function toAdminState(row: {
  status: string;
  stage: string;
  outcome: string | null;
  schedules: Array<{
    sessionStatus?: string | null;
    conclusion?: { outcome: string } | null;
  }>;
} | null): AdminSessionState {
  if (!row) return "NONE";
  const concluded = row.schedules.find((s) => s.conclusion)?.conclusion;
  if (concluded) {
    if (concluded.outcome === "PASSED") return "CONCLUDED_PASSED";
    return concluded.outcome === "FAILED"
      ? "CONCLUDED_FAILED"
      : "CONCLUDED_OTHER";
  }
  const latest = row.schedules[0];
  const sessionStatus = latest?.sessionStatus;
  if (sessionStatus === "IN_PROGRESS") return "IN_PROGRESS";
  if (sessionStatus === "AWAITING_CONCLUSION") return "AWAITING_CONCLUSION";
  if (sessionStatus === "CANCELLED") return "CANCELLED";
  if (row.schedules.length > 0) return "SCHEDULED";
  if (row.status === "REJECTED") return "REJECTED";
  if (row.status === "APPROVED") return "APPROVED_READY";
  if (row.status === "PENDING") return "SUBMITTED";
  return "NONE";
}

/** Stage-scoped session summary for Student display (no internal IDs). */
function toSessionSummary(
  schedule: {
    defenseDate: Date | string;
    defenseTime: Date | string;
    venueOrLink: string | null;
    sessionStatus: string;
    defenseType: string;
    conclusion?: { outcome: string } | null;
  } | null,
  defenseType: DefenseSessionSummary["defenseType"],
): DefenseSessionSummary | null {
  if (!schedule) return null;
  return {
    defenseType,
    defenseDate:
      schedule.defenseDate instanceof Date
        ? schedule.defenseDate.toISOString()
        : String(schedule.defenseDate ?? ""),
    defenseTime:
      schedule.defenseTime instanceof Date
        ? schedule.defenseTime.toISOString()
        : String(schedule.defenseTime ?? ""),
    venueOrLink: schedule.venueOrLink ?? null,
    sessionStatus: schedule.sessionStatus,
  };
}

function pickSessionSchedule<T extends { conclusion?: unknown }>(
  rows: T[],
): T | null {
  // Prefer the schedule that owns a formal conclusion (CP1-FIX1 session authority).
  return rows.find((s) => s.conclusion) ?? rows[0] ?? null;
}

export class StudentThesisJourneyService {
  async getJourney(userId: string): Promise<StudentThesisJourneyDto> {
    const student = await prisma.student.findUnique({
      where: { userId },
      include: {
        compExamRecords: true,
        adviserAssignments: {
          where: { isActive: true },
          include: {
            adviser: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { assignedDate: "desc" },
          take: 1,
        },
        adviserRequests: {
          include: {
            requestedAdviser: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });
    if (!student) {
      throw new AppError("Student profile not found.", 404);
    }

    const thesis = await prisma.thesisRecord.findFirst({
      where: { studentId: student.id },
      orderBy: { createdAt: "desc" },
      include: {
        thesisTitles: true,
        defenseSchedules: {
          include: {
            conclusion: {
              include: {
                selectedTitle: {
                  select: { id: true, titleText: true },
                },
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
        plagiarismResults: {
          orderBy: { submittedAt: "desc" },
        },
      },
    });

    const schedules = thesis?.defenseSchedules ?? [];

    // Latest formal PASSED conclusion per defense type (deterministic).
    const titleSession = schedules.find(
      (s) => s.defenseType === "TITLE_DEFENSE" && s.conclusion?.outcome === "PASSED",
    );
    const proposalSession = schedules.find(
      (s) =>
        s.defenseType === "PROPOSAL_DEFENSE" && s.conclusion?.outcome === "PASSED",
    );
    const titleConclusion = titleSession?.conclusion ?? null;
    const proposalConclusion = proposalSession?.conclusion ?? null;
    const finalConclusion = schedules.find(
      (s) =>
        s.defenseType === "FINAL_DEFENSE" && s.conclusion?.outcome === "PASSED",
    )?.conclusion;

    // selectedTitle MUST come from formal conclusion.selectedTitleId.
    const selectedTitle = titleConclusion?.selectedTitle ?? null;

    // Title/Proposal RAP must belong to the same defense session as the
    // authoritative conclusion (scheduleId), not merely the same thesis.
    const titleRapFinalized = await hasFinalizedRapForSession(
      titleConclusion?.scheduleId ?? titleSession?.id ?? null,
      "TITLE_DEFENSE",
    );
    const proposalRapFinalized = await hasFinalizedRapForSession(
      proposalConclusion?.scheduleId ?? proposalSession?.id ?? null,
      "PROPOSAL_DEFENSE",
    );

    const activeAssignment = student.adviserAssignments[0] ?? null;
    const openRequest =
      student.adviserRequests.find(
        (r) =>
          (r.status === "PENDING" || r.status === "APPROVED") &&
          (r.adviserStatus === "PENDING" ||
            r.deanStatus === "PENDING" ||
            r.adviserStatus === "CONFORMED"),
      ) ?? student.adviserRequests[0] ?? null;

    // Real plagiarism evidence only (PlagiarismResult.isEligible).
    const strikeEligible = (thesis?.plagiarismResults ?? []).some(
      (p) => p.isEligible === true,
    );

    const policy = resolveStrikePolicy();

    // Stage-scoped admin context: ThesisRecord.stage/status only apply to the
    // matching current stage. Prior-stage status must not make a later stage
    // look submitted/approved.
    const rowsFor = (
      defenseType: "TITLE_DEFENSE" | "PROPOSAL_DEFENSE" | "FINAL_DEFENSE",
    ) => schedules.filter((s) => s.defenseType === defenseType);

    const adminFor = (
      defenseType: "TITLE_DEFENSE" | "PROPOSAL_DEFENSE" | "FINAL_DEFENSE",
      stage: "TITLE" | "PROPOSAL" | "FINAL",
    ) => {
      const rows = rowsFor(defenseType);
      const latest = rows[0] ?? null;
      if (latest) {
        return toAdminState({
          status: thesis?.status ?? "PENDING",
          stage: thesis?.stage ?? stage,
          outcome: thesis?.outcome ?? null,
          schedules: rows.map((s) => ({
            sessionStatus: s.sessionStatus,
            conclusion: s.conclusion,
          })),
        });
      }
      // No session for this stage — only use ThesisRecord if it is the current stage.
      if (thesis && thesis.stage === stage) {
        return toAdminState({
          status: thesis.status,
          stage: thesis.stage,
          outcome: thesis.outcome,
          schedules: [],
        });
      }
      return "NONE";
    };

    const sessionSummaryFor = (
      defenseType: "TITLE_DEFENSE" | "PROPOSAL_DEFENSE" | "FINAL_DEFENSE",
    ): DefenseSessionSummary | null => {
      const rows = rowsFor(defenseType);
      const chosen = pickSessionSchedule(rows);
      return toSessionSummary(chosen, defenseType);
    };

    const snapshot: JourneySnapshot = {
      compExamPassed: student.compExamRecords.some((c) => c.status === "PASSED"),
      titlePassed: Boolean(titleConclusion),
      selectedTitleId: selectedTitle?.id ?? null,
      selectedTitleText: selectedTitle?.titleText ?? null,
      titleRapFinalized,
      titleAdminState: adminFor("TITLE_DEFENSE", "TITLE"),
      titleSession: sessionSummaryFor("TITLE_DEFENSE"),
      adviserRequest: openRequest
        ? {
            id: openRequest.id,
            status: openRequest.status,
            adviserStatus: openRequest.adviserStatus,
            deanStatus: openRequest.deanStatus,
            requestedAdviserId: openRequest.requestedAdviserId,
            requestedAdviserName: `${openRequest.requestedAdviser.firstName} ${openRequest.requestedAdviser.lastName}`,
          }
        : null,
      activeAdviser: activeAssignment
        ? {
            userId: activeAssignment.adviser.id,
            name: `${activeAssignment.adviser.firstName} ${activeAssignment.adviser.lastName}`,
          }
        : null,
      proposalPassed: Boolean(proposalConclusion),
      proposalRapFinalized,
      proposalSession: sessionSummaryFor("PROPOSAL_DEFENSE"),
      proposalAdminState: adminFor("PROPOSAL_DEFENSE", "PROPOSAL"),
      strikeEligible,
      strikeRequired: policy.required,
      finalPassed: Boolean(finalConclusion),
      finalAdminState: adminFor("FINAL_DEFENSE", "FINAL"),
      finalSession: sessionSummaryFor("FINAL_DEFENSE"),
    };

    return evaluateStudentThesisJourney(snapshot);
  }
}
