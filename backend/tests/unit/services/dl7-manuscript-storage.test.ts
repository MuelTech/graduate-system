import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * DL-7: Proposal/Final manuscript integration with managed storage + versioning.
 *
 * These tests drive the real services against a mocked Prisma client so we can
 * assert exactly what is persisted and which authority fields are used.
 */

const prismaMock = vi.hoisted(() => {
  const tx = {
    $queryRaw: vi.fn(async () => []),
    thesisDocument: { create: vi.fn(), updateMany: vi.fn() },
    adviserCertification: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
    },
  };
  return {
    student: { findUnique: vi.fn() },
    thesisRecord: { findFirst: vi.fn(), findUnique: vi.fn() },
    adviserAssignment: { findFirst: vi.fn(), findMany: vi.fn() },
    thesisDocument: { create: vi.fn(), updateMany: vi.fn() },
    adviserCertification: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
    },
    defenseConclusion: { findFirst: vi.fn() },
    rapReport: { findFirst: vi.fn(), count: vi.fn() },
    plagiarismResult: { count: vi.fn() },
    $transaction: vi.fn(async (fn: any) => fn(tx)),
    __tx: tx,
  };
});

vi.mock("../../../src/config/database", () => ({ default: prismaMock }));

import { ProposalAdviserReviewService } from "../../../src/services/proposal-adviser-review.service";
import { FinalAdviserReviewService } from "../../../src/services/final-adviser-review.service";
import type { ManagedUploadInput } from "../../../src/storage/managed-upload";

function managed(overrides: Partial<ManagedUploadInput> = {}): ManagedUploadInput {
  return {
    filePath: "C:/private/root/manuscripts/abc",
    storageKey: "manuscripts/abc",
    storageProvider: "local",
    originalFilename: "chapters.pdf",
    verifiedMimeType: "application/pdf",
    sizeBytes: 12345,
    checksum: "deadbeef",
    checksumAlgorithm: "sha256",
    uploadedById: "student-user",
    ...overrides,
  };
}

function makeStudent() {
  return {
    id: "student-1",
    studentNumber: "2026-001",
    user: { id: "student-user", firstName: "Ana", lastName: "Student" },
  };
}

function makeThesis(overrides: Record<string, unknown> = {}) {
  return {
    id: "thesis-1",
    student: {
      id: "student-1",
      studentNumber: "2026-001",
      user: { id: "student-user", firstName: "Ana", lastName: "Student" },
      adviserAssignments: [
        { adviser: { id: "adviser-1", firstName: "Bob", lastName: "Adviser" } },
      ],
    },
    thesisTitles: [],
    defenseSchedules: [
      {
        defenseType: "TITLE_DEFENSE",
        conclusion: { selectedTitle: { titleText: "Official Title" } },
      },
    ],
    thesisDocuments: [],
    adviserCertifications: [],
    plagiarismResults: [],
    ...overrides,
  };
}

function proposalCertifiedRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "cert-1",
    status: "AWAITING_REVIEW",
    defenseStage: "PROPOSAL_DEFENSE",
    reviewedDocumentId: "doc-1",
    reviewRemarks: null,
    signatureData: null,
    signedAt: null,
    adviser: { id: "adviser-1", firstName: "Bob", lastName: "Adviser" },
    reviewedDocument: {
      id: "doc-1",
      uploadedAt: new Date("2026-10-01T00:00:00Z"),
      originalFilename: "chapters.pdf",
      verifiedMimeType: "application/pdf",
      sizeBytes: 12345,
      storageKey: "manuscripts/abc",
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();

  prismaMock.student.findUnique.mockResolvedValue(makeStudent());
  prismaMock.adviserAssignment.findFirst.mockResolvedValue({
    id: "assign-1",
    studentId: "student-1",
    adviserId: "adviser-1",
    isActive: true,
  });
  prismaMock.defenseConclusion.findFirst.mockImplementation(async (args: any) => {
    if (args?.where?.schedule?.defenseType === "PROPOSAL_DEFENSE") {
      return { outcome: "PASSED", scheduleId: "prop-sched" };
    }
    return { selectedTitleId: "t1", scheduleId: "title-sched" };
  });
  prismaMock.rapReport.findFirst.mockResolvedValue({ id: "rap-1" });
  prismaMock.rapReport.count.mockResolvedValue(1);
  prismaMock.plagiarismResult.count.mockResolvedValue(0);
  prismaMock.thesisRecord.findFirst.mockResolvedValue(makeThesis());
  prismaMock.thesisRecord.findUnique.mockResolvedValue(makeThesis());

  // Outer pre-transaction ISSUED guard: nothing issued by default.
  prismaMock.adviserCertification.findFirst.mockResolvedValue(null);

  // Transaction internals.
  prismaMock.__tx.$queryRaw.mockResolvedValue([]);
  prismaMock.__tx.adviserCertification.findFirst.mockResolvedValue(null);
  prismaMock.__tx.adviserCertification.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.__tx.adviserCertification.create.mockResolvedValue({});
  prismaMock.__tx.thesisDocument.updateMany.mockResolvedValue({ count: 0 });
  prismaMock.__tx.thesisDocument.create.mockImplementation(async (args: any) => ({
    id: "doc-1",
    uploadedAt: new Date(),
    ...args.data,
  }));
});

describe("DL-7 Proposal manuscript managed persistence", () => {
  const svc = new ProposalAdviserReviewService();

  it("persists full DL-1/DL-2 metadata + stage/slot + version head", async () => {
    await svc.submitManuscriptForReview("student-user", managed());

    const createArgs = prismaMock.__tx.thesisDocument.create.mock.calls[0]?.[0];
    expect(createArgs.data).toEqual(
      expect.objectContaining({
        thesisId: "thesis-1",
        docType: "PROPOSAL_CHAPTERS",
        defenseStage: "PROPOSAL",
        filePath: "C:/private/root/manuscripts/abc",
        storageKey: "manuscripts/abc",
        storageProvider: "local",
        originalFilename: "chapters.pdf",
        verifiedMimeType: "application/pdf",
        sizeBytes: 12345,
        checksum: "deadbeef",
        checksumAlgorithm: "sha256",
        uploadedById: "student-user",
        isCurrent: true,
        supersedesDocumentId: null,
      }),
    );
    // No physical rename: the promoted key is persisted as-is.
    expect(createArgs.data.storageKey).toBe("manuscripts/abc");
    expect(createArgs.data.uploadedAt).toBeInstanceOf(Date);
  });

  it("serializes the review cycle on the thesis row (FOR UPDATE lock)", async () => {
    await svc.submitManuscriptForReview("student-user", managed());
    expect(prismaMock.__tx.$queryRaw).toHaveBeenCalled();
    // Single current head: current rows are demoted before the new head.
    expect(prismaMock.__tx.thesisDocument.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          thesisId: "thesis-1",
          defenseStage: "PROPOSAL",
          docType: "PROPOSAL_CHAPTERS",
          isCurrent: true,
        }),
        data: { isCurrent: false },
      }),
    );
  });

  it("resubmit supersedes the exact previously bound document and preserves remarks", async () => {
    prismaMock.__tx.adviserCertification.findFirst
      .mockResolvedValueOnce(null) // ISSUED check
      .mockResolvedValueOnce({
        id: "cert-1",
        status: "CHANGES_REQUESTED",
        defenseStage: "PROPOSAL_DEFENSE",
        reviewedDocumentId: "doc-1",
        reviewRemarks: "Please revise Ch. 2",
      });
    prismaMock.__tx.thesisDocument.create.mockResolvedValue({
      id: "doc-2",
      uploadedAt: new Date(),
    });

    await svc.submitManuscriptForReview("student-user", managed({ storageKey: "manuscripts/v2" }));

    const createArgs = prismaMock.__tx.thesisDocument.create.mock.calls[0]?.[0];
    expect(createArgs.data.supersedesDocumentId).toBe("doc-1");
    expect(createArgs.data.isCurrent).toBe(true);

    const updateArgs = prismaMock.__tx.adviserCertification.updateMany.mock.calls[0]?.[0];
    expect(updateArgs.where).toEqual(
      expect.objectContaining({ id: "cert-1", status: { not: "ISSUED" } }),
    );
    expect(updateArgs.data).toEqual(
      expect.objectContaining({
        status: "AWAITING_REVIEW",
        reviewedDocumentId: "doc-2",
        reviewRemarks: "Please revise Ch. 2",
      }),
    );
  });

  it("fails closed when the in-transaction ISSUED race is detected", async () => {
    prismaMock.__tx.adviserCertification.findFirst.mockResolvedValueOnce({
      id: "cert-issued",
      status: "ISSUED",
    });
    await expect(
      svc.submitManuscriptForReview("student-user", managed()),
    ).rejects.toThrow(/already issued/i);
    expect(prismaMock.__tx.thesisDocument.create).not.toHaveBeenCalled();
    expect(prismaMock.__tx.adviserCertification.updateMany).not.toHaveBeenCalled();
  });

  it("removes the latest-upload fallback: unbound legacy manuscript is not authority", async () => {
    prismaMock.thesisRecord.findUnique.mockResolvedValue(
      makeThesis({
        thesisDocuments: [
          { id: "legacy-latest", uploadedAt: new Date("2026-10-05") },
          { id: "legacy-old", uploadedAt: new Date("2026-09-01") },
        ],
        adviserCertifications: [],
      }),
    );
    const dto = await svc.getStudentReviewState("student-user");
    expect(dto.manuscript).toBeNull();
    expect(dto.reviewStatus).toBe("NONE");
  });

  it("resolves the exact bound manuscript, not a newer one", async () => {
    prismaMock.thesisRecord.findUnique.mockResolvedValue(
      makeThesis({
        thesisDocuments: [
          { id: "doc-newer", uploadedAt: new Date("2026-10-06") },
          { id: "doc-bound", uploadedAt: new Date("2026-09-01") },
        ],
        adviserCertifications: [proposalCertifiedRow({ reviewedDocumentId: "doc-bound" })],
      }),
    );
    const dto = await svc.getStudentReviewState("student-user");
    expect(dto.manuscript?.documentId).toBe("doc-bound");
  });
});

describe("DL-7 Final manuscript managed persistence", () => {
  const svc = new FinalAdviserReviewService();

  it("persists FINAL_MANUSCRIPT / FINAL with managed metadata and version head", async () => {
    await svc.submitManuscriptForReview("student-user", managed({ originalFilename: "final.pdf" }));

    const createArgs = prismaMock.__tx.thesisDocument.create.mock.calls[0]?.[0];
    expect(createArgs.data).toEqual(
      expect.objectContaining({
        thesisId: "thesis-1",
        docType: "FINAL_MANUSCRIPT",
        defenseStage: "FINAL",
        storageKey: "manuscripts/abc",
        storageProvider: "local",
        originalFilename: "final.pdf",
        verifiedMimeType: "application/pdf",
        sizeBytes: 12345,
        checksum: "deadbeef",
        checksumAlgorithm: "sha256",
        uploadedById: "student-user",
        isCurrent: true,
        supersedesDocumentId: null,
      }),
    );
    expect(prismaMock.__tx.$queryRaw).toHaveBeenCalled();
  });

  it("fails closed on latest-upload fallback for Final", async () => {
    prismaMock.thesisRecord.findUnique.mockResolvedValue(
      makeThesis({
        thesisDocuments: [{ id: "legacy-latest", uploadedAt: new Date("2026-10-05") }],
        adviserCertifications: [],
      }),
    );
    const dto = await svc.getStudentReviewState("student-user");
    expect(dto.manuscript).toBeNull();
    expect(dto.reviewStatus).toBe("NONE");
  });

  it("blocks Final manuscript upload when a Final certification is already issued", async () => {
    prismaMock.adviserCertification.findFirst.mockResolvedValue({
      id: "cert-issued",
      status: "ISSUED",
      defenseStage: "FINAL_DEFENSE",
    });
    await expect(
      svc.submitManuscriptForReview("student-user", managed()),
    ).rejects.toThrow(/already issued/i);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});
