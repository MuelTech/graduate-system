import { beforeEach, describe, expect, it, vi } from "vitest";

import { AdviserWorkspaceService } from "../../../src/services/adviser-workspace.service";
import type { AdviserWorkspaceRepository } from "../../../src/repositories/adviser-workspace.repository";
import type { AdviserRequestService } from "../../../src/services/adviser-request.service";
import type { ProposalAdviserReviewService } from "../../../src/services/proposal-adviser-review.service";
import type { FinalAdviserReviewService } from "../../../src/services/final-adviser-review.service";

function student(overrides: Record<string, unknown> = {}) {
  return {
    id: "student-1",
    studentNumber: "2026-001",
    user: { firstName: "Ana", lastName: "Cruz" },
    program: { programName: "MS Information Technology" },
    thesisRecords: [
      { id: "thesis-1", stage: "PROPOSAL", status: "APPROVED" },
    ],
    ...overrides,
  };
}

function activeAssignment(overrides: Record<string, unknown> = {}) {
  return {
    id: "asg-1",
    studentId: "student-1",
    adviserId: "adviser-a",
    assignedDate: new Date("2026-10-01T00:00:00.000Z"),
    student: student(),
    ...overrides,
  };
}

function activeRow(assignment: ReturnType<typeof activeAssignment>) {
  return {
    id: assignment.id,
    studentId: assignment.studentId,
    adviserId: assignment.adviserId,
    assignedDate: assignment.assignedDate,
  };
}

function proposalTask(overrides: Record<string, unknown> = {}) {
  return {
    thesisId: "thesis-1",
    student: { id: "student-1", name: "Ana Cruz", studentNumber: "2026-001" },
    officialTitle: "Historical Title Wording",
    reviewStatus: "AWAITING_REVIEW",
    reviewRemarks: null,
    manuscriptDocumentId: "doc-proposal",
    manuscriptUploadedAt: "2026-10-02T00:00:00.000Z",
    ...overrides,
  };
}

function finalTask(overrides: Record<string, unknown> = {}) {
  return {
    ...proposalTask(),
    manuscriptDocumentId: "doc-final",
    stage: "FINAL" as const,
    ...overrides,
  };
}

function requestRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "request-1",
    student: {
      id: "student-1",
      name: "Ana Cruz",
      studentNumber: "2026-001",
      program: "MS Information Technology",
    },
    officialTitle: "Historical Title Wording",
    sourceDefenseScheduleId: "title-schedule-1",
    titleDefenseRole: "PANELIST",
    reason: "Request",
    requestDate: new Date("2026-09-20T00:00:00.000Z"),
    status: "PENDING",
    adviserStatus: "PENDING",
    adviserRespondedAt: null,
    adviserRemarks: null,
    deanStatus: "PENDING",
    deanReviewedAt: null,
    deanRemarks: null,
    ...overrides,
  };
}

describe("AdviserWorkspaceService", () => {
  const repo = {
    listActiveAssignmentsForAdviser: vi.fn(),
    listActiveAdviserAssignmentsForStudents: vi.fn(),
    findStudentForAdviseeDetail: vi.fn(),
  };
  const requests = { listMyAdviserRequests: vi.fn() };
  const proposalReviews = { listReviewTasks: vi.fn() };
  const finalReviews = { listReviewTasks: vi.fn() };

  const service = new AdviserWorkspaceService(
    repo as unknown as AdviserWorkspaceRepository,
    requests as unknown as AdviserRequestService,
    proposalReviews as unknown as ProposalAdviserReviewService,
    finalReviews as unknown as FinalAdviserReviewService,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    repo.listActiveAssignmentsForAdviser.mockResolvedValue([]);
    repo.listActiveAdviserAssignmentsForStudents.mockResolvedValue([]);
    repo.findStudentForAdviseeDetail.mockResolvedValue(null);
    requests.listMyAdviserRequests.mockResolvedValue([]);
    proposalReviews.listReviewTasks.mockResolvedValue([]);
    finalReviews.listReviewTasks.mockResolvedValue([]);
  });

  it("returns only the authenticated Adviser's active advisees", async () => {
    const assignment = activeAssignment();
    repo.listActiveAssignmentsForAdviser.mockResolvedValue([assignment]);
    repo.listActiveAdviserAssignmentsForStudents.mockResolvedValue([
      activeRow(assignment),
    ]);

    const result = await service.getWorkspace("adviser-a");

    expect(repo.listActiveAssignmentsForAdviser).toHaveBeenCalledWith("adviser-a");
    expect(result.activeAdvisees).toHaveLength(1);
    expect(result.activeAdvisees[0]).toMatchObject({
      assignmentId: "asg-1",
      student: {
        id: "student-1",
        name: "Ana Cruz",
        studentNumber: "2026-001",
        program: "MS Information Technology",
      },
      research: {
        thesisId: "thesis-1",
        currentStage: "PROPOSAL",
        currentStatus: "APPROVED",
      },
    });
  });

  it("does not turn another Adviser's assignment into this Adviser's advisee", async () => {
    // The repository is responsible for the adviserId + isActive scoping; a
    // caller-specific query for Adviser B returns no rows for Adviser A.
    repo.listActiveAssignmentsForAdviser.mockImplementation(async (id: string) =>
      id === "adviser-a" ? [activeAssignment()] : [],
    );

    const result = await service.getWorkspace("adviser-b");

    expect(repo.listActiveAssignmentsForAdviser).toHaveBeenCalledWith("adviser-b");
    expect(result.activeAdvisees).toEqual([]);
  });

  it("uses the authenticated Adviser's own request inbox, not the Admin-wide list", async () => {
    const request = requestRow();
    requests.listMyAdviserRequests.mockResolvedValue([request]);

    const result = await service.getWorkspace("adviser-a");

    expect(requests.listMyAdviserRequests).toHaveBeenCalledWith("adviser-a");
    expect(requests.listMyAdviserRequests).toHaveBeenCalledTimes(1);
    expect(result.incomingRequests).toEqual([request]);
  });

  it("keeps a pending/conformed request separate from Active Advisees", async () => {
    repo.listActiveAssignmentsForAdviser.mockResolvedValue([]);
    requests.listMyAdviserRequests.mockResolvedValue([
      requestRow({ status: "CONFORMED", adviserStatus: "CONFORMED" }),
    ]);

    const result = await service.getWorkspace("adviser-a");

    expect(result.activeAdvisees).toEqual([]);
    expect(result.incomingRequests).toHaveLength(1);
    expect(result.incomingRequests[0].status).toBe("CONFORMED");
  });

  it("composes Proposal and Final review tasks with explicit stages", async () => {
    const assignment = activeAssignment();
    repo.listActiveAssignmentsForAdviser.mockResolvedValue([assignment]);
    repo.listActiveAdviserAssignmentsForStudents.mockResolvedValue([
      activeRow(assignment),
    ]);
    proposalReviews.listReviewTasks.mockResolvedValue([proposalTask()]);
    finalReviews.listReviewTasks.mockResolvedValue([
      finalTask({ manuscriptDocumentId: "doc-final" }),
    ]);

    const result = await service.getWorkspace("adviser-a");

    expect(result.reviewTasks).toHaveLength(2);
    expect(result.reviewTasks.map((task) => task.stage)).toEqual([
      "PROPOSAL",
      "FINAL",
    ]);
    expect(result.activeAdvisees[0].review).toEqual({
      hasOpenTask: true,
      stages: ["PROPOSAL", "FINAL"],
    });
  });

  it("returns the bounded detail overview for the current active Adviser", async () => {
    repo.findStudentForAdviseeDetail.mockResolvedValue({
      ...student(),
      adviserAssignments: [
        {
          id: "asg-1",
          adviserId: "adviser-a",
          assignedDate: new Date("2026-10-01T00:00:00.000Z"),
        },
      ],
    });
    proposalReviews.listReviewTasks.mockResolvedValue([proposalTask()]);

    const result = await service.getAdviseeDetail("adviser-a", "student-1");

    expect(result.assignment).toEqual({
      assignmentId: "asg-1",
      assignedDate: "2026-10-01T00:00:00.000Z",
    });
    expect(result.student.id).toBe("student-1");
    expect(result.reviewContext.stages).toEqual(["PROPOSAL"]);
    expect(result.reviewContext.tasks[0].manuscriptDocumentId).toBe(
      "doc-proposal",
    );
  });

  it("denies a cross-Adviser detail lookup with the same not-found response", async () => {
    repo.findStudentForAdviseeDetail.mockResolvedValue({
      ...student(),
      adviserAssignments: [
        {
          id: "asg-b",
          adviserId: "adviser-b",
          assignedDate: new Date("2026-10-01T00:00:00.000Z"),
        },
      ],
    });

    await expect(
      service.getAdviseeDetail("adviser-a", "student-1"),
    ).rejects.toMatchObject({ statusCode: 404, message: "Advisee not found." });
  });

  it("denies a former/inactive Adviser because only active assignments are loaded", async () => {
    repo.findStudentForAdviseeDetail.mockResolvedValue({
      ...student(),
      adviserAssignments: [],
    });

    await expect(
      service.getAdviseeDetail("former-adviser", "student-1"),
    ).rejects.toMatchObject({ statusCode: 404, message: "Advisee not found." });
  });

  it("fails closed for duplicate active Adviser rows in detail", async () => {
    repo.findStudentForAdviseeDetail.mockResolvedValue({
      ...student(),
      adviserAssignments: [
        { id: "asg-1", adviserId: "adviser-a", assignedDate: new Date() },
        { id: "asg-2", adviserId: "adviser-b", assignedDate: new Date() },
      ],
    });

    await expect(
      service.getAdviseeDetail("adviser-a", "student-1"),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("does not reveal a duplicate Student to a non-owner Adviser", async () => {
    repo.findStudentForAdviseeDetail.mockResolvedValue({
      ...student(),
      adviserAssignments: [
        { id: "asg-1", adviserId: "adviser-a", assignedDate: new Date() },
        { id: "asg-2", adviserId: "adviser-b", assignedDate: new Date() },
      ],
    });

    await expect(
      service.getAdviseeDetail("adviser-c", "student-1"),
    ).rejects.toMatchObject({ statusCode: 404, message: "Advisee not found." });
  });

  it("fails the workspace closed for duplicate active rows for one Student", async () => {
    const first = activeAssignment({ id: "asg-1" });
    const second = activeAssignment({ id: "asg-2" });
    repo.listActiveAssignmentsForAdviser.mockResolvedValue([first, second]);
    repo.listActiveAdviserAssignmentsForStudents.mockResolvedValue([
      activeRow(first),
      activeRow(second),
    ]);

    await expect(service.getWorkspace("adviser-a")).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(requests.listMyAdviserRequests).not.toHaveBeenCalled();
  });

  it("detects a cross-Adviser duplicate for Adviser A's candidate Student", async () => {
    const asgA = activeAssignment({ id: "asg-a", adviserId: "adviser-a" });
    const asgB = activeAssignment({
      id: "asg-b",
      adviserId: "adviser-b",
      assignedDate: new Date("2026-10-02T00:00:00.000Z"),
    });
    repo.listActiveAssignmentsForAdviser.mockResolvedValue([asgA]);
    // The second active row belongs to another Adviser and is not in the
    // candidate query, but must still invalidate the Student.
    repo.listActiveAdviserAssignmentsForStudents.mockResolvedValue([
      activeRow(asgA),
      activeRow(asgB),
    ]);

    await expect(service.getWorkspace("adviser-a")).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(requests.listMyAdviserRequests).not.toHaveBeenCalled();
  });

  it("detects the symmetric cross-Adviser duplicate for Adviser B", async () => {
    const asgA = activeAssignment({ id: "asg-a", adviserId: "adviser-a" });
    const asgB = activeAssignment({
      id: "asg-b",
      adviserId: "adviser-b",
      assignedDate: new Date("2026-10-02T00:00:00.000Z"),
    });
    repo.listActiveAssignmentsForAdviser.mockResolvedValue([asgB]);
    repo.listActiveAdviserAssignmentsForStudents.mockResolvedValue([
      activeRow(asgA),
      activeRow(asgB),
    ]);

    await expect(service.getWorkspace("adviser-b")).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it("does not infer a current working title from historical Title data", async () => {
    repo.findStudentForAdviseeDetail.mockResolvedValue({
      ...student({
        thesisTitles: [{ id: "title-1", titleText: "Legacy title", isSelected: true }],
        defenseSchedules: [
          {
            defenseType: "TITLE_DEFENSE",
            conclusion: { selectedTitle: { titleText: "Old selected title" } },
          },
        ],
      }),
      adviserAssignments: [
        { id: "asg-1", adviserId: "adviser-a", assignedDate: new Date() },
      ],
    });

    const result = await service.getAdviseeDetail("adviser-a", "student-1");

    expect(result.research.workingTitle).toBeNull();
  });

  it("does not expose raw relations or private academic evidence", async () => {
    const assignment = activeAssignment();
    repo.listActiveAssignmentsForAdviser.mockResolvedValue([assignment]);
    repo.listActiveAdviserAssignmentsForStudents.mockResolvedValue([
      activeRow(assignment),
    ]);
    repo.findStudentForAdviseeDetail.mockResolvedValue({
      ...student(),
      adviserAssignments: [
        { id: "asg-1", adviserId: "adviser-a", assignedDate: new Date() },
      ],
    });

    const workspace = JSON.stringify(await service.getWorkspace("adviser-a"));
    const detail = JSON.stringify(
      await service.getAdviseeDetail("adviser-a", "student-1"),
    );

    for (const serialized of [workspace, detail]) {
      expect(serialized).not.toMatch(
        /adviserAssignments|thesisDocuments|signatureData|signature_data|evaluator|score|COR|RECEIPT|receipt/i,
      );
    }
  });
});
