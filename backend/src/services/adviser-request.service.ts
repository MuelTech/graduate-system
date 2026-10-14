/**
 * GS-020 Adviser Request domain (WP2–WP4).
 *
 * Implements:
 *  - Student ODP adviser candidates + request creation (WP2)
 *  - Requested Adviser CONFORME / Decline (WP3, write-once)
 *  - Dean review + APPROVE/REJECT with transactional AdviserAssignment (WP4)
 *
 * Canonical assignment path: Student request → Adviser CONFORME → Dean APPROVED
 * → AdviserAssignment. Assignment is never created outside that path.
 */
import prisma from "../config/database";
import { AppError } from "../utils/AppError";
import type {
  DeanResponseInput,
  RequestAdviserInput,
  AdviserResponseInput,
} from "../interfaces/thesis.interfaces";
import {
  evaluateCandidateEligibility,
  evaluateTitleDefenseGate,
  evaluateAdviserResponseTransition,
  evaluateDeanResponseTransition,
  isOpenAdviserRequest,
  mapAdviserResponseToOverallStatus,
  mapDeanDecisionToOverallStatus,
} from "./adviser-request.rules";
import { isRapStatusComplete } from "./stage-completion";

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

    let hasFinalizedTitleRap = false;
    if (conclusion) {
      // RAP must belong to the same defense session as this PASSED conclusion.
      const titleRaps = await prisma.rapReport.findMany({
        where: {
          scheduleId: conclusion.scheduleId,
          defenseType: "TITLE_DEFENSE",
        },
        select: { status: true },
      });
      hasFinalizedTitleRap = titleRaps.some((r) => isRapStatusComplete(r.status));
    }

    const gate = evaluateTitleDefenseGate({
      hasPassedTitleConclusion: Boolean(conclusion),
      hasOfficialSelectedTitle: Boolean(conclusion?.selectedTitleId),
      hasFinalizedTitleRap,
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
        isExternal: panelist?.isExternal ?? null,
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

    // Atomic write-once transition: only succeeds if the row is still pre-response.
    // Prevents concurrent CONFORME/Decline from overwriting each other.
    const expectedPreState = {
      id: requestId,
      requestedAdviserId: adviserUserId,
      status: "PENDING" as const,
      adviserStatus: "PENDING" as const,
      deanStatus: "PENDING" as const,
    };

    const data =
      gate.decision === "CONFORMED"
        ? {
            // Waiting for Dean — overall status stays PENDING. No assignment.
            adviserStatus: "CONFORMED" as const,
            adviserRespondedAt: now,
            adviserRemarks: remarks,
          }
        : {
            // DECLINED — closed + retryable. Do not mutate Dean fields.
            adviserStatus: "DECLINED" as const,
            adviserRespondedAt: now,
            adviserRemarks: remarks,
            status: mapAdviserResponseToOverallStatus("DECLINED"),
          };

    const result = await prisma.adviserRequest.updateMany({
      where: expectedPreState,
      data,
    });

    if (result.count === 0) {
      throw new AppError(
        "Adviser request state changed or has already been responded to.",
        409,
      );
    }

    return prisma.adviserRequest.findUnique({ where: { id: requestId } });
  }

  /**
   * WP4: Dean/Admin review queue — CONFORMED + Dean PENDING only.
   * Shows the actual requested adviser; no replacement picker data.
   */
  async listDeanReviewRequests() {
    const rows = await prisma.adviserRequest.findMany({
      where: {
        status: "PENDING",
        adviserStatus: "CONFORMED",
        deanStatus: "PENDING",
      },
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
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            panelist: {
              select: { specialization: true, officeAffiliation: true },
            },
          },
        },
        sourceDefenseSchedule: {
          select: {
            id: true,
            conclusion: {
              select: {
                selectedTitle: { select: { id: true, titleText: true } },
              },
            },
            panelAssignments: {
              select: { userId: true, role: true },
            },
          },
        },
      },
      orderBy: { requestDate: "desc" },
    });

    return rows.map((row) => {
      const role =
        row.sourceDefenseSchedule?.panelAssignments.find(
          (p) => p.userId === row.requestedAdviserId,
        )?.role ?? null;
      return {
        id: row.id,
        student: {
          id: row.student.id,
          name: `${row.student.user.firstName} ${row.student.user.lastName}`,
          studentNumber: row.student.studentNumber,
          program: row.student.program?.programName ?? null,
        },
        officialTitle:
          row.sourceDefenseSchedule?.conclusion?.selectedTitle?.titleText ??
          null,
        requestedAdviser: {
          userId: row.requestedAdviser.id,
          name: `${row.requestedAdviser.firstName} ${row.requestedAdviser.lastName}`,
          specialization: row.requestedAdviser.panelist?.specialization ?? null,
          officeAffiliation:
            row.requestedAdviser.panelist?.officeAffiliation ?? null,
        },
        titleDefenseRole: role,
        reason: row.reason,
        requestDate: row.requestDate,
        status: row.status,
        adviserStatus: row.adviserStatus,
        adviserRespondedAt: row.adviserRespondedAt,
        adviserRemarks: row.adviserRemarks,
        deanStatus: row.deanStatus,
        deanReviewedAt: row.deanReviewedAt,
        deanRemarks: row.deanRemarks,
        sourceDefenseScheduleId: row.sourceDefenseScheduleId,
      };
    });
  }

  /**
   * WP4: Dean APPROVE / REJECT — transactional write-once.
   * APPROVE creates AdviserAssignment for request.requestedAdviserId only.
   * REJECT creates no assignment; Student may retry later.
   */
  async deanDecideAdviserRequest(
    deanUserId: string,
    requestId: string,
    input: DeanResponseInput,
  ) {
    const existing = await prisma.adviserRequest.findUnique({
      where: { id: requestId },
    });
    if (!existing) {
      throw new AppError("Adviser request not found.", 404);
    }

    const gate = evaluateDeanResponseTransition({
      decision: String(input.decision || ""),
      adviserStatus: String(existing.adviserStatus),
      deanStatus: String(existing.deanStatus),
      overallStatus: String(existing.status),
    });
    if (!gate.allowed) {
      throw new AppError(gate.reason, gate.statusCode);
    }

    const now = new Date();
    const remarks = input.remarks?.trim() ? input.remarks.trim() : null;

    try {
      return await prisma.$transaction(async (tx) => {
        // Re-read + conditional state protection inside the transaction.
        const current = await tx.adviserRequest.findUnique({
          where: { id: requestId },
        });
        if (!current) {
          throw new AppError("Adviser request not found.", 404);
        }
        if (
          current.status !== "PENDING" ||
          current.adviserStatus !== "CONFORMED" ||
          current.deanStatus !== "PENDING"
        ) {
          throw new AppError(
            "Adviser request state changed or has already been decided.",
            409,
          );
        }

        // Serialize per Student before active-assignment check + create.
        // Prevents two different CONFORMED requests from both inserting
        // an active AdviserAssignment (check-then-insert race).
        await tx.$queryRaw`SELECT student_id FROM students WHERE student_id = ${current.studentId} FOR UPDATE`;

        if (gate.decision === "APPROVED") {
          const active = await tx.adviserAssignment.findFirst({
            where: { studentId: current.studentId, isActive: true },
          });
          if (active) {
            throw new AppError(
              "An active adviser assignment already exists for this student.",
              409,
            );
          }

          // Hard invariant: external panelists can never become advisers
          // (request may predate Admin marking the panelist external).
          const requestedPanelist = await tx.panelist.findUnique({
            where: { userId: current.requestedAdviserId },
          });
          if (!requestedPanelist || requestedPanelist.isExternal === true) {
            throw new AppError(
              "External panelists cannot be assigned as thesis/dissertation advisers.",
              409,
            );
          }
        }

        const expectedPreState = {
          id: requestId,
          status: "PENDING" as const,
          adviserStatus: "CONFORMED" as const,
          deanStatus: "PENDING" as const,
        };

        // approvedById is approval-only compatibility. Never written on REJECT.
        const updateData =
          gate.decision === "APPROVED"
            ? {
                deanStatus: gate.decision,
                deanReviewedById: deanUserId,
                deanReviewedAt: now,
                deanRemarks: remarks,
                status: mapDeanDecisionToOverallStatus(gate.decision),
                // Compatibility mirror only — not authoritative for GS-020.
                approvedById: deanUserId,
              }
            : {
                deanStatus: gate.decision,
                deanReviewedById: deanUserId,
                deanReviewedAt: now,
                deanRemarks: remarks,
                status: mapDeanDecisionToOverallStatus(gate.decision),
              };

        const updated = await tx.adviserRequest.updateMany({
          where: expectedPreState,
          data: updateData,
        });
        if (updated.count === 0) {
          throw new AppError(
            "Adviser request state changed or has already been decided.",
            409,
          );
        }

        // Assignment only after CONFORME + Dean APPROVED, same transaction.
        if (gate.decision === "APPROVED") {
          await tx.adviserAssignment.create({
            data: {
              studentId: current.studentId,
              adviserId: current.requestedAdviserId,
              assignedDate: now,
              isActive: true,
            },
          });
        }

        return tx.adviserRequest.findUnique({ where: { id: requestId } });
      });
    } catch (error: unknown) {
      // Map lock/deadlock/serialization conflicts to domain 409.
      const message = error instanceof Error ? error.message : String(error);
      const isConcurrency =
        /deadlock|lock wait timeout|serialization|WSREP|ER_LOCK/i.test(message);
      if (isConcurrency && !(error instanceof AppError)) {
        throw new AppError(
          "Adviser assignment conflict: another decision is in progress. Please retry.",
          409,
        );
      }
      throw error;
    }
  }
}
