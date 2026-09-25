/**
 * Student-side GS-020 Adviser Request domain (WP2 only).
 *
 * Implements:
 *  - ODP adviser candidates from the passed Title Defense session
 *  - Student adviser request creation
 *
 * Does NOT implement CONFORME/Decline, Dean decisions, or AdviserAssignment.
 */
import prisma from "../config/database";
import { AppError } from "../utils/AppError";
import type { RequestAdviserInput } from "../interfaces/thesis.interfaces";
import {
  evaluateCandidateEligibility,
  evaluateTitleDefenseGate,
  evaluateAdviserResponseTransition,
  isOpenAdviserRequest,
  mapAdviserResponseToOverallStatus,
} from "./adviser-request.rules";
import type { AdviserResponseInput } from "../interfaces/thesis.interfaces";

export interface OdpCandidateDto {
  userId: string;
  name: string;
  defenseRole: string;
  specialization: string | null;
  officeAffiliation: string | null;
  isExternal: boolean;
  isAvailableAsAdviser: boolean;
}

export interface OdpSeatEvaluation {
  userId: string;
  role: string;
  eligible: boolean;
  reason: string | null;
}

export interface PassedTitleDefenseContext {
  scheduleId: string;
  conclusionId: string;
  selectedTitleId: string;
  selectedTitleText: string;
  candidates: OdpCandidateDto[];
  /** Every ODP seat with eligibility reason — used for precise request errors. */
  seats: OdpSeatEvaluation[];
}

export class AdviserRequestService {
  /**
   * Authoritative source: DefenseConclusion.outcome = PASSED with selectedTitleId.
   * Never derive from ThesisRecord.status alone or application APPROVED.
   */
  async getPassedTitleDefenseContext(
    studentId: string,
  ): Promise<PassedTitleDefenseContext> {
    const conclusion = await prisma.defenseConclusion.findFirst({
      where: {
        thesis: { studentId },
        outcome: "PASSED",
        schedule: {
          defenseType: "TITLE_DEFENSE",
          sessionStatus: "CONCLUDED",
        },
      },
      orderBy: { concludedAt: "desc" },
      include: {
        selectedTitle: true,
        schedule: {
          include: {
            panelAssignments: {
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    role: true,
                    isActive: true,
                    panelist: {
                      select: {
                        isActive: true,
                        isAvailableAsAdviser: true,
                        specialization: true,
                        officeAffiliation: true,
                        isExternal: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    const gate = evaluateTitleDefenseGate({
      hasPassedTitleConclusion: Boolean(conclusion),
      hasOfficialSelectedTitle: Boolean(conclusion?.selectedTitleId),
    });
    if (!gate.allowed) {
      throw new AppError(gate.reason, gate.statusCode);
    }
    if (!conclusion?.selectedTitle || !conclusion.selectedTitleId) {
      throw new AppError(
        "Adviser Request requires an official selected title from Title Defense conclusion.",
        400,
      );
    }

    const candidates: OdpCandidateDto[] = [];
    const seats: OdpSeatEvaluation[] = [];
    for (const assignment of conclusion.schedule.panelAssignments) {
      const role = String(assignment.role);
      const panelist = assignment.user.panelist;
      const eligibility = evaluateCandidateEligibility({
        defenseRole: role,
        userRole: String(assignment.user.role),
        userIsActive: assignment.user.isActive,
        hasPanelistProfile: Boolean(panelist),
        panelistIsActive: panelist?.isActive ?? null,
        isAvailableAsAdviser: panelist?.isAvailableAsAdviser ?? null,
      });

      seats.push({
        userId: assignment.user.id,
        role,
        eligible: eligibility.eligible,
        reason: eligibility.eligible ? null : eligibility.reason,
      });

      if (!eligibility.eligible) continue;

      candidates.push({
        userId: assignment.user.id,
        name: `${assignment.user.firstName} ${assignment.user.lastName}`,
        defenseRole: role,
        specialization: panelist?.specialization ?? null,
        officeAffiliation: panelist?.officeAffiliation ?? null,
        isExternal: panelist?.isExternal ?? false,
        isAvailableAsAdviser: panelist?.isAvailableAsAdviser === true,
      });
    }

    return {
      scheduleId: conclusion.scheduleId,
      conclusionId: conclusion.id,
      selectedTitleId: conclusion.selectedTitleId,
      selectedTitleText: conclusion.selectedTitle.titleText,
      candidates,
      seats,
    };
  }

  /** Student-facing ODP candidates only — never the unrestricted faculty directory. */
  async listOdpCandidates(userId: string): Promise<{
    sourceDefenseScheduleId: string;
    selectedTitle: { id: string; titleText: string };
    candidates: OdpCandidateDto[];
  }> {
    const student = await prisma.student.findUnique({ where: { userId } });
    if (!student) throw new AppError("Student profile not found.", 404);

    const ctx = await this.getPassedTitleDefenseContext(student.id);
    return {
      sourceDefenseScheduleId: ctx.scheduleId,
      selectedTitle: {
        id: ctx.selectedTitleId,
        titleText: ctx.selectedTitleText,
      },
      candidates: ctx.candidates,
    };
  }

  async createRequest(userId: string, input: RequestAdviserInput) {
    const requestedAdviserId = String(input.requestedAdviserId || "").trim();
    if (!requestedAdviserId) {
      throw new AppError("requestedAdviserId is required.", 400);
    }

    const student = await prisma.student.findUnique({ where: { userId } });
    if (!student) throw new AppError("Student profile not found.", 404);

    const activeAssignment = await prisma.adviserAssignment.findFirst({
      where: { studentId: student.id, isActive: true },
    });
    if (activeAssignment) {
      throw new AppError("An active adviser assignment already exists.", 409);
    }

    // Legacy compatibility: only overall status PENDING can block.
    // WP1 defaults left REJECTED/APPROVED rows with adviserStatus/deanStatus=PENDING.
    const open = await prisma.adviserRequest.findFirst({
      where: {
        studentId: student.id,
        status: "PENDING",
        OR: [
          { adviserStatus: "PENDING" },
          { adviserStatus: "CONFORMED", deanStatus: "PENDING" },
        ],
      },
    });
    if (open && isOpenAdviserRequest(open)) {
      throw new AppError(
        "An adviser request is already waiting for Adviser response or Dean review.",
        409,
      );
    }

    const ctx = await this.getPassedTitleDefenseContext(student.id);
    const candidate = ctx.candidates.find((c) => c.userId === requestedAdviserId);
    if (!candidate) {
      const seat = ctx.seats.find((s) => s.userId === requestedAdviserId);
      if (seat && seat.reason) {
        throw new AppError(seat.reason, 400);
      }
      throw new AppError(
        "Requested adviser must be an eligible member of your passed Title Defense ODP.",
        400,
      );
    }

    // Persist the same passed Title Defense schedule that produced the pool.
    return prisma.adviserRequest.create({
      data: {
        studentId: student.id,
        requestedAdviserId,
        reason: input.reason ?? null,
        sourceDefenseScheduleId: ctx.scheduleId,
        status: "PENDING",
        adviserStatus: "PENDING",
        deanStatus: "PENDING",
        approvedById: null,
        requestDate: new Date(),
      },
    });
  }

  /**
   * WP3: requested Adviser inbox — server-scoped to authenticated userId only.
   * Never uses the Admin-wide request list.
   */
  async listMyAdviserRequests(adviserUserId: string) {
    const rows = await prisma.adviserRequest.findMany({
      where: { requestedAdviserId: adviserUserId },
      include: {
        student: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            program: { select: { programName: true } },
          },
        },
        requestedAdviser: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        sourceDefenseSchedule: {
          select: {
            id: true,
            conclusion: {
              select: {
                id: true,
                selectedTitle: { select: { id: true, titleText: true } },
              },
            },
            panelAssignments: {
              where: { userId: adviserUserId },
              select: { role: true },
            },
          },
        },
      },
      orderBy: { requestDate: "desc" },
    });

    return rows.map((row) => ({
      id: row.id,
      student: {
        id: row.student.id,
        name: `${row.student.user.firstName} ${row.student.user.lastName}`,
        studentNumber: row.student.studentNumber,
        program: row.student.program?.programName ?? null,
      },
      officialTitle:
        row.sourceDefenseSchedule?.conclusion?.selectedTitle?.titleText ?? null,
      sourceDefenseScheduleId: row.sourceDefenseScheduleId,
      titleDefenseRole:
        row.sourceDefenseSchedule?.panelAssignments?.[0]?.role ?? null,
      reason: row.reason,
      requestDate: row.requestDate,
      status: row.status,
      adviserStatus: row.adviserStatus,
      adviserRespondedAt: row.adviserRespondedAt,
      adviserRemarks: row.adviserRemarks,
      deanStatus: row.deanStatus,
      deanReviewedAt: row.deanReviewedAt,
      deanRemarks: row.deanRemarks,
    }));
  }

  /**
   * WP3: CONFORME / Decline only. Does not write Dean fields or create AdviserAssignment.
   */
  async respondAsAdviser(
    adviserUserId: string,
    requestId: string,
    input: AdviserResponseInput,
  ) {
    const request = await prisma.adviserRequest.findUnique({
      where: { id: requestId },
    });
    if (!request) {
      throw new AppError("Adviser request not found.", 404);
    }

    const gate = evaluateAdviserResponseTransition({
      requestedAdviserId: request.requestedAdviserId,
      authenticatedUserId: adviserUserId,
      decision: String(input.decision || ""),
      adviserStatus: String(request.adviserStatus),
      deanStatus: String(request.deanStatus),
      overallStatus: String(request.status),
    });
    if (!gate.allowed) {
      throw new AppError(gate.reason, gate.statusCode);
    }

    const now = new Date();
    const remarks = input.remarks?.trim() ? input.remarks.trim() : null;

    if (gate.decision === "CONFORMED") {
      // Waiting for Dean — overall status stays PENDING. No assignment.
      return prisma.adviserRequest.update({
        where: { id: requestId },
        data: {
          adviserStatus: "CONFORMED",
          adviserRespondedAt: now,
          adviserRemarks: remarks,
          deanStatus: "PENDING",
          status: "PENDING",
        },
      });
    }

    // DECLINED — closed + retryable. Do not mutate Dean fields.
    return prisma.adviserRequest.update({
      where: { id: requestId },
      data: {
        adviserStatus: "DECLINED",
        adviserRespondedAt: now,
        adviserRemarks: remarks,
        status: mapAdviserResponseToOverallStatus("DECLINED"),
      },
    });
  }
}
