import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * DL-7 correction: exact manuscript binding identity + phantom-work fail-closed.
 *
 * A certification's reviewedDocumentId is actionable only when it resolves to a
 * document on the same thesis with the stage's exact docType/defenseStage.
 * Invalid / unbound / missing bindings must never produce review work or actions.
 */

const prismaMock = vi.hoisted(() => {
  const tx = {
    $queryRaw: vi.fn(async () => []),
    thesisDocument: {
      create: vi.fn(),
      updateMany: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
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

function managed(): ManagedUploadInput {
  return {
    filePath: "C:/private/root/manuscripts/v2",
    storageKey: "manuscripts/v2",
    storageProvider: "local",
    originalFilename: "v2.pdf",
    verifiedMimeType: "application/pdf",
    sizeBytes: 100,
    checksum: "c",
    checksumAlgorithm: "sha256",
    uploadedById: "student-user",
  };
}

function proposalDoc(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    thesisId: "thesis-1",
    docType: "PROPOSAL_CHAPTERS",
    defenseStage: "PROPOSAL",
    originalFilename: "p.pdf",
    verifiedMimeType: "application/pdf",
    sizeBytes: 10,
    uploadedAt: new Date("2026-10-01"),
    ...overrides,
  };
}

function finalDoc(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    thesisId: "thesis-1",
    docType: "FINAL_MANUSCRIPT",
    defenseStage: "FINAL",
    originalFilename: "f.pdf",
    verifiedMimeType: "application/pdf",
    sizeBytes: 20,
    uploadedAt: new Date("2026-10-01"),
    ...overrides,
  };
}

function student() {
  return {
    id: "student-1",
    studentNumber: "2026-001",
    user: { id: "student-user", firstName: "Ana", lastName: "Student" },
  };
}

function thesis(overrides: Record<string, unknown> = {}) {
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

function proposalCert(overrides: Record<string, unknown> = {}) {
  return {
    id: "cert-1",
    status: "AWAITING_REVIEW",
    defenseStage: "PROPOSAL_DEFENSE",
    reviewedDocumentId: "doc-x",
    reviewRemarks: null,
    signatureData: null,
    signedAt: null,
    adviser: { id: "adviser-1", firstName: "Bob", lastName: "Adviser" },
    reviewedDocument: null,
    ...overrides,
  };
}

function finalCert(overrides: Record<string, unknown> = {}) {
  return {
    ...proposalCert(),
    defenseStage: "FINAL_DEFENSE",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.student.findUnique.mockResolvedValue(student());
  prismaMock.adviserAssignment.findFirst.mockResolvedValue({
    id: "assign-1",
    studentId: "student-1",
    adviserId: "adviser-1",
    isActive: true,
  });
  prismaMock.adviserAssignment.findMany.mockResolvedValue([
    { student: { id: "student-1", studentNumber: "2026-001", user: student().user } },
  ]);
  prismaMock.defenseConclusion.findFirst.mockImplementation(async (args: any) => {
    if (args?.where?.schedule?.defenseType === "PROPOSAL_DEFENSE") {
      return { outcome: "PASSED", scheduleId: "prop-sched" };
    }
    return { selectedTitleId: "t1", scheduleId: "title-sched" };
  });
  prismaMock.rapReport.findFirst.mockResolvedValue({ id: "rap-1" });
  prismaMock.rapReport.count.mockResolvedValue(1);
  prismaMock.plagiarismResult.count.mockResolvedValue(0);
  prismaMock.thesisRecord.findFirst.mockResolvedValue(thesis());
  prismaMock.thesisRecord.findUnique.mockResolvedValue(thesis());
  prismaMock.adviserCertification.findFirst.mockResolvedValue(null);

  prismaMock.__tx.$queryRaw.mockResolvedValue([]);
  prismaMock.__tx.thesisDocument.updateMany.mockResolvedValue({ count: 0 });
  prismaMock.__tx.thesisDocument.findUnique.mockResolvedValue(null);
  prismaMock.__tx.thesisDocument.findMany.mockResolvedValue([]);
  prismaMock.__tx.thesisDocument.create.mockResolvedValue({
    id: "doc-new",
    uploadedAt: new Date(),
  });
  prismaMock.__tx.adviserCertification.findFirst.mockResolvedValue(null);
  prismaMock.__tx.adviserCertification.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.__tx.adviserCertification.create.mockResolvedValue({});
});

describe("DL-7 Proposal invalid binding is never actionable", () => {
  const svc = new ProposalAdviserReviewService();

  async function expectNoAuthority(certRow: Record<string, unknown>) {
    prismaMock.thesisRecord.findUnique.mockResolvedValue(
      thesis({ thesisDocuments: [], adviserCertifications: [certRow] }),
    );
    const dto = await svc.getStudentReviewState("student-user");
    expect(dto.manuscript).toBeNull();
    expect(dto.reviewStatus).toBe("NONE");
    expect(dto.certification).toBeNull();
  }

  it("wrong docType (COR) is not a valid review manuscript", async () => {
    await expectNoAuthority(
      proposalCert({
        reviewedDocument: proposalDoc("doc-x", { docType: "COR" }),
      }),
    );
  });

  it("wrong defenseStage is not a valid review manuscript", async () => {
    await expectNoAuthority(
      proposalCert({
        reviewedDocument: proposalDoc("doc-x", { defenseStage: "FINAL" }),
      }),
    );
  });

  it("cross-thesis binding is not a valid review manuscript", async () => {
    await expectNoAuthority(
      proposalCert({
        reviewedDocument: proposalDoc("doc-x", { thesisId: "thesis-other" }),
      }),
    );
  });

  it("missing document relation is not a valid review manuscript", async () => {
    await expectNoAuthority(proposalCert({ reviewedDocument: null }));
  });

  it("unbound AWAITING_REVIEW / CHANGES_REQUESTED never nominates latest upload", async () => {
    for (const status of ["AWAITING_REVIEW", "CHANGES_REQUESTED"]) {
      prismaMock.thesisRecord.findUnique.mockResolvedValue(
        thesis({
          thesisDocuments: [proposalDoc("latest-upload")],
          adviserCertifications: [
            proposalCert({ status, reviewedDocumentId: null, reviewedDocument: null }),
          ],
        }),
      );
      const dto = await svc.getStudentReviewState("student-user");
      expect(dto.manuscript).toBeNull();
      expect(dto.reviewStatus).toBe("NONE");
    }
  });

  it("queue excludes invalid and unbound certifications", async () => {
    prismaMock.thesisRecord.findFirst.mockResolvedValue(
      thesis({
        thesisDocuments: [],
        adviserCertifications: [
          proposalCert({ reviewedDocument: proposalDoc("doc-x", { docType: "COR" }) }),
        ],
      }),
    );
    expect(await svc.listReviewTasks("adviser-1")).toHaveLength(0);

    prismaMock.thesisRecord.findFirst.mockResolvedValue(
      thesis({
        thesisDocuments: [proposalDoc("latest")],
        adviserCertifications: [
          proposalCert({ status: "CHANGES_REQUESTED", reviewedDocumentId: null }),
        ],
      }),
    );
    expect(await svc.listReviewTasks("adviser-1")).toHaveLength(0);
  });

  it("queue includes a valid exact binding", async () => {
    prismaMock.thesisRecord.findFirst.mockResolvedValue(
      thesis({
        thesisDocuments: [proposalDoc("doc-x")],
        adviserCertifications: [
          proposalCert({ reviewedDocument: proposalDoc("doc-x") }),
        ],
      }),
    );
    const items = await svc.listReviewTasks("adviser-1");
    expect(items).toHaveLength(1);
    expect(items[0].manuscriptDocumentId).toBe("doc-x");
  });

  it("Request Changes and Certify are blocked for an invalid binding", async () => {
    prismaMock.thesisRecord.findUnique.mockResolvedValue(
      thesis({
        thesisDocuments: [],
        adviserCertifications: [
          proposalCert({ reviewedDocument: proposalDoc("doc-x", { docType: "COR" }) }),
        ],
      }),
    );
    await expect(
      svc.requestChanges("adviser-1", "thesis-1", {
        remarks: "x",
        expectedReviewedDocumentId: "doc-x",
      }),
    ).rejects.toThrow(/no manuscript is currently awaiting|review state changed/i);
    await expect(
      svc.certify("adviser-1", "thesis-1", {
        signatureData: "sig",
        expectedReviewedDocumentId: "doc-x",
      }),
    ).rejects.toThrow(/current manuscript is required|review state changed/i);
    expect(prismaMock.adviserCertification.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.__tx.adviserCertification.updateMany).not.toHaveBeenCalled();
  });
});

describe("DL-7 Final invalid binding is never actionable", () => {
  const svc = new FinalAdviserReviewService();

  it("wrong-stage Final binding yields no usable manuscript", async () => {
    prismaMock.thesisRecord.findUnique.mockResolvedValue(
      thesis({
        thesisDocuments: [],
        adviserCertifications: [
          finalCert({
            reviewedDocument: finalDoc("doc-x", {
              docType: "PROPOSAL_CHAPTERS",
              defenseStage: "PROPOSAL",
            }),
          }),
        ],
      }),
    );
    const dto = await svc.getStudentReviewState("student-user");
    expect(dto.manuscript).toBeNull();
    expect(dto.reviewStatus).toBe("NONE");
    expect(dto.certification).toBeNull();
  });

  it("unbound Final certification does not enqueue review work", async () => {
    prismaMock.thesisRecord.findFirst.mockResolvedValue(
      thesis({
        thesisDocuments: [finalDoc("latest")],
        adviserCertifications: [
          finalCert({ status: "AWAITING_REVIEW", reviewedDocumentId: null }),
        ],
      }),
    );
    expect(await svc.listReviewTasks("adviser-1")).toHaveLength(0);
  });

  it("valid exact Final binding enqueues review work", async () => {
    prismaMock.thesisRecord.findFirst.mockResolvedValue(
      thesis({
        thesisDocuments: [finalDoc("doc-x")],
        adviserCertifications: [finalCert({ reviewedDocument: finalDoc("doc-x") })],
      }),
    );
    const items = await svc.listReviewTasks("adviser-1");
    expect(items).toHaveLength(1);
    expect(items[0].manuscriptDocumentId).toBe("doc-x");
  });
});

describe("DL-7 ambiguous legacy manuscript heads fail closed", () => {
  it("Proposal: two current heads with no valid binding -> 409, no mutation", async () => {
    const svc = new ProposalAdviserReviewService();
    prismaMock.__tx.adviserCertification.findFirst.mockResolvedValue(null);
    prismaMock.__tx.thesisDocument.findUnique.mockResolvedValue(null);
    prismaMock.__tx.thesisDocument.findMany.mockResolvedValue([
      { id: "old-1" },
      { id: "old-2" },
    ]);

    await expect(
      svc.submitManuscriptForReview("student-user", managed()),
    ).rejects.toThrow(/multiple current manuscript|reconcile/i);

    expect(prismaMock.__tx.thesisDocument.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.__tx.thesisDocument.create).not.toHaveBeenCalled();
    expect(prismaMock.__tx.adviserCertification.create).not.toHaveBeenCalled();
    expect(prismaMock.__tx.adviserCertification.updateMany).not.toHaveBeenCalled();
  });

  it("Final: two current heads with no valid binding -> 409, no mutation", async () => {
    const svc = new FinalAdviserReviewService();
    prismaMock.__tx.adviserCertification.findFirst.mockResolvedValue(null);
    prismaMock.__tx.thesisDocument.findUnique.mockResolvedValue(null);
    prismaMock.__tx.thesisDocument.findMany.mockResolvedValue([
      { id: "old-1" },
      { id: "old-2" },
    ]);

    await expect(
      svc.submitManuscriptForReview("student-user", managed()),
    ).rejects.toThrow(/multiple current manuscript|reconcile/i);

    expect(prismaMock.__tx.thesisDocument.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.__tx.thesisDocument.create).not.toHaveBeenCalled();
  });
});
