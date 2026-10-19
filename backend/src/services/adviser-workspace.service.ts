import { AppError } from "../utils/AppError";
import {
  resolveSingleActiveAdviser,
  type ActiveAdviserAssignmentLike,
} from "./active-adviser.rules";
import {
  AdviserRequestService,
} from "./adviser-request.service";
import {
  ProposalAdviserReviewService,
  type AdviserReviewQueueItem,
} from "./proposal-adviser-review.service";
import {
  FinalAdviserReviewService,
  type FinalReviewQueueItem,
} from "./final-adviser-review.service";
import {
  AdviserWorkspaceRepository,
  type AdviserActiveAssignmentRow,
  type AdviserDetailStudentRow,
  type AdviserWorkspaceStudentRow,
} from "../repositories/adviser-workspace.repository";

/**
 * ADV-2 — authenticated Adviser workspace read model.
 *
 * This service composes existing authorities:
 * - active AdviserAssignment for the current relationship;
 * - AdviserRequestService for the caller's own GS-020 inbox;
 * - Proposal/Final Adviser review queues for open review work.
 *
 * It does not duplicate GS-020 transitions, certification rules, or manuscript
 * review state, and it never writes.
 */

export const ADVISEE_NOT_FOUND_MESSAGE = "Advisee not found.";
export const MULTIPLE_ACTIVE_ADVISERS_WORKSPACE_MESSAGE =
  "More than one active adviser is recorded for this student. Correct the adviser record before continuing.";

export type AdviserReviewStage = "PROPOSAL" | "FINAL";

export interface AdviserWorkspaceStudentDto {
  id: string;
  name: string;
  studentNumber: string | null;
  program: string | null;
}

export interface AdviserResearchContextDto {
  thesisId: string | null;
  currentStage: string | null;
  currentStatus: string | null;
  /**
   * No separately-authorized current working-title source exists in the present
   * model. Historical Title Defense selected/suggested titles are not reused.
   */
  workingTitle: string | null;
}

export interface AdviserWorkspaceReviewContextDto {
  hasOpenTask: boolean;
  stages: AdviserReviewStage[];
}

export interface AdviserWorkspaceReviewTaskDto {
  stage: AdviserReviewStage;
  thesisId: string;
  student: {
    id: string;
    name: string;
    studentNumber: string | null;
  };
  officialTitle: string | null;
  reviewStatus: string;
  reviewRemarks: string | null;
  manuscriptDocumentId: string | null;
  manuscriptUploadedAt: string | null;
}

export interface AdviserActiveAdviseeDto {
  assignmentId: string;
  assignedDate: string;
  student: AdviserWorkspaceStudentDto;
  research: AdviserResearchContextDto;
  review: AdviserWorkspaceReviewContextDto;
}

export interface AdviserWorkspaceDto {
  activeAdvisees: AdviserActiveAdviseeDto[];
  incomingRequests: Awaited<
    ReturnType<AdviserRequestService["listMyAdviserRequests"]>
  >;
  reviewTasks: AdviserWorkspaceReviewTaskDto[];
}

export interface AdviserAdviseeDetailDto {
  assignment: {
    assignmentId: string;
    assignedDate: string;
  };
  student: AdviserWorkspaceStudentDto;
  research: AdviserResearchContextDto;
  reviewContext: {
    stages: AdviserReviewStage[];
    tasks: AdviserWorkspaceReviewTaskDto[];
  };
}

function personName(user: { firstName: string; lastName: string }): string {
  return `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();
}

function studentDto(student: AdviserWorkspaceStudentRow): AdviserWorkspaceStudentDto {
  return {
    id: student.id,
    name: personName(student.user),
    studentNumber: student.studentNumber ?? null,
    program: student.program?.programName ?? null,
  };
}

function researchContext(
  thesis: { id: string; stage: string; status: string } | undefined,
): AdviserResearchContextDto {
  return {
    thesisId: thesis?.id ?? null,
    currentStage: thesis?.stage ?? null,
    currentStatus: thesis?.status ?? null,
    workingTitle: null,
  };
}

function reviewTaskDto(
  task: (AdviserReviewQueueItem & { stage: "PROPOSAL" }) | FinalReviewQueueItem,
): AdviserWorkspaceReviewTaskDto {
  return {
    stage: task.stage,
    thesisId: task.thesisId,
    student: {
      id: task.student.id,
      name: task.student.name,
      studentNumber: task.student.studentNumber,
    },
    officialTitle: task.officialTitle,
    reviewStatus: task.reviewStatus,
    reviewRemarks: task.reviewRemarks,
    manuscriptDocumentId: task.manuscriptDocumentId,
    manuscriptUploadedAt: task.manuscriptUploadedAt,
  };
}

function reviewStagesFor(
  tasks: AdviserWorkspaceReviewTaskDto[],
  studentId: string,
): AdviserReviewStage[] {
  const stages = new Set<AdviserReviewStage>();
  for (const task of tasks) {
    if (task.student.id === studentId) stages.add(task.stage);
  }
  return [...stages];
}

export class AdviserWorkspaceService {
  constructor(
    private readonly repository: AdviserWorkspaceRepository = new AdviserWorkspaceRepository(),
    private readonly adviserRequests: AdviserRequestService = new AdviserRequestService(),
    private readonly proposalReviews: ProposalAdviserReviewService = new ProposalAdviserReviewService(),
    private readonly finalReviews: FinalAdviserReviewService = new FinalAdviserReviewService(),
  ) {}

  /**
   * One Adviser-scoped workspace projection. The caller's own incoming requests
   * remain separate from active advisees; only Dean-approved active assignments
   * produce an Active Advisee row.
   */
  async getWorkspace(adviserUserId: string): Promise<AdviserWorkspaceDto> {
    const assignments =
      await this.repository.listActiveAssignmentsForAdviser(adviserUserId);
    this.assertNoDuplicateAdviseeRelationships(assignments);

    const [incomingRequests, proposalTasks, finalTasks] = await Promise.all([
      this.adviserRequests.listMyAdviserRequests(adviserUserId),
      this.proposalReviews.listReviewTasks(adviserUserId),
      this.finalReviews.listReviewTasks(adviserUserId),
    ]);

    const reviewTasks: AdviserWorkspaceReviewTaskDto[] = [
      ...proposalTasks.map((task) =>
        reviewTaskDto({ ...task, stage: "PROPOSAL" }),
      ),
      ...finalTasks.map((task) => reviewTaskDto(task)),
    ];

    const activeAdvisees = assignments.map((assignment) => {
      const stages = reviewStagesFor(reviewTasks, assignment.student.id);
      return {
        assignmentId: assignment.id,
        assignedDate: assignment.assignedDate.toISOString(),
        student: studentDto(assignment.student),
        research: researchContext(assignment.student.thesisRecords[0]),
        review: {
          hasOpenTask: stages.length > 0,
          stages,
        },
      } satisfies AdviserActiveAdviseeDto;
    });

    return { activeAdvisees, incomingRequests, reviewTasks };
  }

  /**
   * Bounded overview for one CURRENT active advisee. Missing, inactive, or
   * non-owned relationships all return the same 404 to avoid enumeration.
   */
  async getAdviseeDetail(
    adviserUserId: string,
    studentId: string,
  ): Promise<AdviserAdviseeDetailDto> {
    const student = await this.repository.findStudentForAdviseeDetail(studentId);
    if (!student) throw new AppError(ADVISEE_NOT_FOUND_MESSAGE, 404);

    const assignment = this.authorizeActiveAdviser(
      adviserUserId,
      student.adviserAssignments,
    );

    const [proposalTasks, finalTasks] = await Promise.all([
      this.proposalReviews.listReviewTasks(adviserUserId),
      this.finalReviews.listReviewTasks(adviserUserId),
    ]);

    const tasks = [
      ...proposalTasks.map((task) =>
        reviewTaskDto({ ...task, stage: "PROPOSAL" }),
      ),
      ...finalTasks.map((task) => reviewTaskDto(task)),
    ].filter((task) => task.student.id === student.id);

    const stages = [...new Set(tasks.map((task) => task.stage))];

    return {
      assignment: {
        assignmentId: assignment.id,
        assignedDate: assignment.assignedDate.toISOString(),
      },
      student: studentDto(student),
      research: researchContext(student.thesisRecords[0]),
      reviewContext: { stages, tasks },
    };
  }

  /**
   * Duplicate active rows for the same Student are invalid data. Fail the whole
   * workspace deterministically rather than choosing a "latest" Adviser.
   */
  private assertNoDuplicateAdviseeRelationships(
    assignments: AdviserActiveAssignmentRow[],
  ): void {
    const byStudent = new Map<string, AdviserActiveAssignmentRow[]>();
    for (const assignment of assignments) {
      const rows = byStudent.get(assignment.studentId) ?? [];
      rows.push(assignment);
      byStudent.set(assignment.studentId, rows);
    }
    for (const rows of byStudent.values()) {
      if (resolveSingleActiveAdviser(rows).status === "CONFLICT") {
        throw new AppError(MULTIPLE_ACTIVE_ADVISERS_WORKSPACE_MESSAGE, 409);
      }
    }
  }

  /**
   * Exact detail authorization:
   * - no active row -> 404;
   * - duplicate active rows that include the caller -> 409;
   * - a single active row must belong to the caller, otherwise -> 404.
   */
  private authorizeActiveAdviser<
    T extends ActiveAdviserAssignmentLike & { assignedDate: Date },
  >(adviserUserId: string, rows: T[]): T {
    const active = rows ?? [];
    if (active.length === 0) {
      throw new AppError(ADVISEE_NOT_FOUND_MESSAGE, 404);
    }
    if (active.length > 1) {
      if (!active.some((row) => row.adviserId === adviserUserId)) {
        throw new AppError(ADVISEE_NOT_FOUND_MESSAGE, 404);
      }
      throw new AppError(MULTIPLE_ACTIVE_ADVISERS_WORKSPACE_MESSAGE, 409);
    }
    if (active[0].adviserId !== adviserUserId) {
      throw new AppError(ADVISEE_NOT_FOUND_MESSAGE, 404);
    }
    return active[0];
  }
}
