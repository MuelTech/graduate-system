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
  isOpenAdviserRequest,
} from "./adviser-request.rules";

export interface OdpCandidateDto {
  userId: string;
  name: string;
  defenseRole: string;
  specialization: string | null;
  officeAffiliation: string | null;
  isExternal: boolean;
  isAvailableAsAdviser: boolean;
}

export interface PassedTitleDefenseContext {
  scheduleId: string;
  conclusionId: string;
  selectedTitleId: string;
  selectedTitleText: string;
  candidates: OdpCandidateDto[];
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
    for (const assignment of conclusion.schedule.panelAssignments) {
      const role = String(assignment.role);
      const panelist = assignment.user.panelist;
      const eligibility = evaluateCandidateEligibility({
        defenseRole: role,
        userIsActive: assignment.user.isActive,
        panelistIsActive: panelist?.isActive ?? null,
        isAvailableAsAdviser: panelist?.isAvailableAsAdviser ?? null,
      });
      if (!eligibility.eligible) continue;

      candidates.push({
        userId: assignment.user.id,
        name: `${assignment.user.firstName} ${assignment.user.lastName}`,
        defenseRole: role,
        specialization: panelist?.specialization ?? null,
        officeAffiliation: panelist?.officeAffiliation ?? null,
        isExternal: panelist?.isExternal ?? false,
        isAvailableAsAdviser: panelist?.isAvailableAsAdviser ?? true,
      });
    }

    return {
      scheduleId: conclusion.scheduleId,
      conclusionId: conclusion.id,
      selectedTitleId: conclusion.selectedTitleId,
      selectedTitleText: conclusion.selectedTitle.titleText,
      candidates,
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

    const open = await prisma.adviserRequest.findFirst({
      where: {
        studentId: student.id,
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
      // Distinguish excluded ODP seats from complete outsiders.
      const rawAssignment = ctx.scheduleId
        ? await prisma.panelAssignment.findUnique({
            where: {
              scheduleId_userId: {
                scheduleId: ctx.scheduleId,
                userId: requestedAdviserId,
              },
            },
          })
        : null;
      if (rawAssignment) {
        throw new AppError(
          `Role ${rawAssignment.role} is not eligible for adviser candidacy. Only Chairman and Panelist may be requested.`,
          400,
        );
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
}
