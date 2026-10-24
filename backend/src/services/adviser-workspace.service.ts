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
  type AdviserDefenseHistoryRow,
  type AdviserDetailStudentRow,
  type AdviserResearchDocumentRow,
  type AdviserStudentActiveAssignmentRow,
  type AdviserWorkspaceStudentRow,
} from "../repositories/adviser-workspace.repository";
import {
  resolveAdviserAcademicDocument,
  resolveAdviserBoundAcademicManuscript,
} from "./adviser-document.rules";
import { DEFENSE_TYPE_TO_DOCUMENT_STAGE } from "./defense-history.rules";

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
export const ADVISER_RELATIONSHIP_INCONSISTENT_MESSAGE =
  "The active adviser relationship could not be verified. Correct the adviser record before continuing.";

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
   * PREDEF-1B0 exposes exact version titles on review tasks. Selecting a single
   * longitudinal working title remains deferred; historical Title Defense
   * selected/suggested titles are not reused.
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
  manuscriptTitle: string | null;
  originalFilename: string | null;
  manuscriptUploadedAt: string | null;
}

/** ADV-5 — safe academic document metadata. */
export interface AdviserResearchDocumentDto {
  id: string;
  stage: "TITLE" | "PROPOSAL" | "FINAL";
  kind:
    | "TITLE_PROPOSAL_PACKAGE"
    | "PROPOSAL_MANUSCRIPT"
    | "FINAL_MANUSCRIPT";
  uploadedAt: string;
  isCurrent: boolean;
  supersedesDocumentId: string | null;
}

export interface AdviserDefenseHistoryManuscriptDto {
  id: string;
  stage: "TITLE" | "PROPOSAL" | "FINAL";
  kind:
    | "TITLE_PROPOSAL_PACKAGE"
    | "PROPOSAL_MANUSCRIPT"
    | "FINAL_MANUSCRIPT";
  uploadedAt: string | null;
}

export interface AdviserDefenseHistoryReportDto {
  finalizedAt: string | null;
  bodyDocument: unknown | null;
  text: string | null;
}

/** ADV-5 — narrow adviser-safe concluded-attempt projection. */
export interface AdviserDefenseHistoryEntryDto {
  scheduleId: string;
  stage: "TITLE" | "PROPOSAL" | "FINAL" | null;
  defenseDate: string | null;
  concludedAt: string | null;
  verdict: string;
  manuscript: AdviserDefenseHistoryManuscriptDto | null;
  committeeReport: AdviserDefenseHistoryReportDto | null;
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
  researchDocuments: AdviserResearchDocumentDto[];
  defenseHistory: AdviserDefenseHistoryEntryDto[];
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
    manuscriptTitle: task.manuscriptTitle,
    originalFilename: task.originalFilename,
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

function iso(value: Date | null | undefined): string | null {
  return value ? new Date(value).toISOString() : null;
}

function isStructuredReportBody(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function meaningfulText(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function researchDocumentDto(
  row: AdviserResearchDocumentRow,
): AdviserResearchDocumentDto | null {
  const identity = resolveAdviserAcademicDocument({
    docType: row.docType,
    defenseStage: row.defenseStage,
  });
  if (!identity) return null;
  return {
    id: row.id,
    stage: identity.stage,
    kind: identity.kind,
    uploadedAt: row.uploadedAt.toISOString(),
    isCurrent: row.isCurrent !== false,
    supersedesDocumentId: row.supersedesDocumentId ?? null,
  };
}

function defenseHistoryDto(
  row: AdviserDefenseHistoryRow,
  thesisId: string,
): AdviserDefenseHistoryEntryDto | null {
  if (!row.conclusion) return null;
  const stage =
    (DEFENSE_TYPE_TO_DOCUMENT_STAGE[row.defenseType] as
      | "TITLE"
      | "PROPOSAL"
      | "FINAL"
      | undefined) ?? null;

  const manuscriptIdentity = resolveAdviserBoundAcademicManuscript({
    thesisId,
    defenseType: row.defenseType,
    manuscriptDocumentId: row.manuscriptDocumentId,
    document: row.manuscriptDocument,
  });

  const manuscript =
    manuscriptIdentity && row.manuscriptDocument
      ? {
          id: row.manuscriptDocument.id,
          stage: manuscriptIdentity.stage,
          kind: manuscriptIdentity.kind,
          uploadedAt: iso(row.manuscriptDocument.uploadedAt),
        }
      : null;

  const rap = row.rapReports[0] ?? null;
  let committeeReport: AdviserDefenseHistoryReportDto | null = null;
  if (rap && String(rap.status) === "FINALIZED") {
    const bodyDocument = isStructuredReportBody(rap.bodyDocument)
      ? rap.bodyDocument
      : null;
    const text = bodyDocument
      ? null
      : meaningfulText(rap.decisionsAndRecommendations);
    if (bodyDocument || text) {
      committeeReport = {
        finalizedAt: iso(rap.finalizedAt),
        bodyDocument,
        text,
      };
    }
  }

  return {
    scheduleId: row.id,
    stage,
    defenseDate: iso(row.defenseDate),
    concludedAt: iso(row.conclusion.concludedAt),
    verdict: String(row.conclusion.outcome),
    manuscript,
    committeeReport,
  };
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
    await this.assertSingleActiveAdviserForCandidates(adviserUserId, assignments);

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

    const thesisId = student.thesisRecords[0]?.id ?? null;
    let researchDocuments: AdviserResearchDocumentDto[] = [];
    let defenseHistory: AdviserDefenseHistoryEntryDto[] = [];
    if (thesisId) {
      const [documentRows, historyRows] = await Promise.all([
        this.repository.listAdviserResearchDocuments(thesisId),
        this.repository.listAdviserDefenseHistory(thesisId),
      ]);
      researchDocuments = documentRows
        .map(researchDocumentDto)
        .filter(
          (document): document is AdviserResearchDocumentDto =>
            document !== null,
        );
      defenseHistory = historyRows
        .map((row) => defenseHistoryDto(row, thesisId))
        .filter(
          (entry): entry is AdviserDefenseHistoryEntryDto => entry !== null,
        );
    }

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
      researchDocuments,
      defenseHistory,
    };
  }

  /**
   * Validate every candidate Student against ALL active assignments, not only
   * the rows owned by the authenticated Adviser. A second active Adviser on the
   * same Student is invalid authority and fails the workspace closed.
   */
  private async assertSingleActiveAdviserForCandidates(
    adviserUserId: string,
    assignments: AdviserActiveAssignmentRow[],
  ): Promise<void> {
    const studentIds = Array.from(
      new Set(assignments.map((assignment) => assignment.studentId)),
    );
    if (studentIds.length === 0) return;

    const activeRows =
      await this.repository.listActiveAdviserAssignmentsForStudents(studentIds);

    const byStudent = new Map<string, AdviserStudentActiveAssignmentRow[]>();
    for (const row of activeRows) {
      const rows = byStudent.get(row.studentId) ?? [];
      rows.push(row);
      byStudent.set(row.studentId, rows);
    }

    for (const studentId of studentIds) {
      const resolution = resolveSingleActiveAdviser(
        byStudent.get(studentId) ?? [],
      );
      if (resolution.status === "CONFLICT") {
        throw new AppError(MULTIPLE_ACTIVE_ADVISERS_WORKSPACE_MESSAGE, 409);
      }
      if (
        resolution.status !== "ACTIVE" ||
        resolution.assignment.adviserId !== adviserUserId
      ) {
        throw new AppError(ADVISER_RELATIONSHIP_INCONSISTENT_MESSAGE, 409);
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
