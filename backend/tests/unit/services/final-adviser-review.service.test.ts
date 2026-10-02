import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => {
  const tx = {
    $queryRaw: vi.fn(async () => []),
    thesisDocument: { create: vi.fn(), updateMany: vi.fn() },
    adviserCertification: {
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
    },
  };
  return {
    student: { findUnique: vi.fn() },
    thesisRecord: { findFirst: vi.fn(), findUnique: vi.fn() },
    adviserAssignment: { findFirst: vi.fn(), findMany: vi.fn() },
    thesisDocument: { create: vi.fn() },
    adviserCertification: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
    },
    defenseConclusion: { findFirst: vi.fn() },
    rapReport: { count: vi.fn() },
    plagiarismResult: { count: vi.fn() },
    $transaction: vi.fn(async (fn: any) => fn(tx)),
    __tx: tx,
  };
});

vi.mock("../../../src/config/database", () => ({ default: prismaMock }));
vi.mock("file-type", () => ({
  fileTypeFromFile: vi.fn(async () => ({ mime: "application/pdf" })),
}));
vi.mock("fs/promises", () => ({
  default: { unlink: vi.fn() },
  unlink: vi.fn(),
}));

import { FinalAdviserReviewService } from "../../../src/services/final-adviser-review.service";

function studentRow() {
  return {
    id: "student-1",
    studentNumber: "2026-001",
    user: { id: "student-user", firstName: "Ana", lastName: "Student" },
  };
}

function thesisRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "thesis-1",
    student: {
      id: "student-1",
      studentNumber: "2026-001",
      user: { id: "student-user", firstName: "Ana", lastName: "Student" },
      adviserAssignments: [
        {
          adviser: { id: "adviser-1", firstName: "Bob", lastName: "Adviser" },
        },
      ],
    },
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

function managed(overrides: Record<string, unknown> = {}) {
  return {
    filePath: "uploads/final.pdf",
    storageKey: "manuscripts/test-final",
    storageProvider: "local",
    originalFilename: "final.pdf",
    verifiedMimeType: "application/pdf",
    sizeBytes: 2048,
    checksum: "def",
    checksumAlgorithm: "sha256",
    uploadedById: "student-user",
    ...overrides,
  };
}

describe("FinalAdviserReviewService (CP4)", () => {
  const svc = new FinalAdviserReviewService();

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.student.findUnique.mockResolvedValue(studentRow());
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
    prismaMock.rapReport.count.mockResolvedValue(1);
    prismaMock.plagiarismResult.count.mockResolvedValue(0);
    prismaMock.adviserCertification.findFirst.mockResolvedValue(null);
    prismaMock.thesisDocument.create.mockImplementation(async (a: any) => ({
      id: "doc-1",
      uploadedAt: new Date(),
      ...a.data,
    }));
    prismaMock.adviserCertification.create.mockImplementation(async (a: any) => ({
      id: "cert-1",
      ...a.data,
    }));
    prismaMock.adviserCertification.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.thesisRecord.findFirst.mockResolvedValue(thesisRow());
    prismaMock.thesisRecord.findUnique.mockResolvedValue(thesisRow());
    prismaMock.$transaction.mockImplementation(async (fn: any) => fn(prismaMock.__tx));
    prismaMock.__tx.$queryRaw.mockResolvedValue([]);
    prismaMock.__tx.thesisDocument.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.__tx.thesisDocument.create.mockImplementation(async (a: any) => ({
      id: "doc-1",
      uploadedAt: new Date(),
      ...a.data,
    }));
    prismaMock.__tx.adviserCertification.findFirst.mockResolvedValue(null);
    prismaMock.__tx.adviserCertification.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.__tx.adviserCertification.create.mockResolvedValue({});
  });

  it("Test 1: Final review submit creates FINAL_MANUSCRIPT + AWAITING_REVIEW", async () => {
    prismaMock.thesisRecord.findUnique.mockResolvedValue(
      thesisRow({
        thesisDocuments: [{ id: "doc-1", uploadedAt: new Date() }],
        adviserCertifications: [
          {
            id: "cert-1",
            status: "AWAITING_REVIEW",
            defenseStage: "FINAL_DEFENSE",
            reviewedDocumentId: "doc-1",
            adviser: { id: "adviser-1", firstName: "Bob", lastName: "Adviser" },
            reviewedDocument: { id: "doc-1", uploadedAt: new Date() },
            reviewRemarks: null,
            signatureData: null,
            signedAt: null,
          },
        ],
      }),
    );
    await svc.submitManuscriptForReview("student-user", managed());
    expect(prismaMock.__tx.thesisDocument.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          docType: "FINAL_MANUSCRIPT",
          defenseStage: "FINAL",
        }),
      }),
    );
    const dto = await svc.getStudentReviewState("student-user");
    expect(dto.reviewStatus).toBe("AWAITING_REVIEW");
  });

  it("Test 3: no active Adviser rejects Final manuscript submit", async () => {
    prismaMock.adviserAssignment.findFirst.mockResolvedValue(null);
    await expect(
      svc.submitManuscriptForReview("student-user", managed({ filePath: "uploads/x.pdf", originalFilename: "x.pdf" })),
    ).rejects.toThrow(/active Thesis Adviser/i);
    expect(prismaMock.thesisDocument.create).not.toHaveBeenCalled();
  });

  it("Test 10: stale request changes uses client expected doc in predicate", async () => {
    prismaMock.thesisRecord.findUnique.mockResolvedValue(
      thesisRow({
        thesisDocuments: [
          { id: "doc-b", uploadedAt: new Date() },
          { id: "doc-a", uploadedAt: new Date("2026-09-01") },
        ],
        adviserCertifications: [
          {
            id: "cert-1",
            status: "AWAITING_REVIEW",
            defenseStage: "FINAL_DEFENSE",
            reviewedDocumentId: "doc-b",
            adviser: { id: "adviser-1", firstName: "Bob", lastName: "Adviser" },
            reviewedDocument: { id: "doc-b", uploadedAt: new Date() },
            reviewRemarks: null,
            signatureData: null,
            signedAt: null,
          },
        ],
      }),
    );
    prismaMock.adviserCertification.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      svc.requestChanges("adviser-1", "thesis-1", {
        remarks: "stale",
        expectedReviewedDocumentId: "doc-a",
      }),
    ).rejects.toThrow(/review state changed/i);
    expect(prismaMock.adviserCertification.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          reviewedDocumentId: "doc-a",
          defenseStage: "FINAL_DEFENSE",
          status: "AWAITING_REVIEW",
        }),
      }),
    );
  });

  it("Test 13/15: certify requires expected token and uses atomic predicate", async () => {
    await expect(
      svc.certify("adviser-1", "thesis-1", {
        signatureData: "sig",
        expectedReviewedDocumentId: "",
      }),
    ).rejects.toThrow(/Reviewed manuscript identifier/i);

    prismaMock.thesisRecord.findUnique.mockResolvedValue(
      thesisRow({
        thesisDocuments: [{ id: "doc-b", uploadedAt: new Date() }],
        adviserCertifications: [
          {
            id: "cert-1",
            status: "AWAITING_REVIEW",
            defenseStage: "FINAL_DEFENSE",
            reviewedDocumentId: "doc-b",
            adviser: { id: "adviser-1", firstName: "Bob", lastName: "Adviser" },
            reviewedDocument: { id: "doc-b", uploadedAt: new Date() },
            reviewRemarks: null,
            signatureData: null,
            signedAt: null,
          },
        ],
      }),
    );
    prismaMock.__tx.adviserCertification.updateMany.mockResolvedValue({ count: 1 });
    await svc.certify("adviser-1", "thesis-1", {
      signatureData: "sig",
      expectedReviewedDocumentId: "doc-b",
    });
    const call = prismaMock.__tx.adviserCertification.updateMany.mock.calls[0]?.[0];
    expect(call?.where?.defenseStage).toBe("FINAL_DEFENSE");
    expect(call?.where?.reviewedDocumentId).toBe("doc-b");
    expect(call?.data?.status).toBe("ISSUED");
    expect(call?.data?.reviewedDocumentId).toBeUndefined();
  });

  function awaitingThesis() {
    return thesisRow({
      thesisDocuments: [{ id: "doc-a", uploadedAt: new Date() }],
      adviserCertifications: [
        {
          id: "cert-1",
          status: "AWAITING_REVIEW",
          defenseStage: "FINAL_DEFENSE",
          reviewedDocumentId: "doc-a",
          adviser: { id: "adviser-1", firstName: "Bob", lastName: "Adviser" },
          reviewedDocument: { id: "doc-a", uploadedAt: new Date() },
          reviewRemarks: null,
          signatureData: null,
          signedAt: null,
        },
      ],
    });
  }

  async function withStrikeEnv(required: boolean, eligible: boolean, fn: () => Promise<void>) {
    const prev = process.env.STRIKE_BEFORE_FINAL_REQUIRED;
    process.env.STRIKE_BEFORE_FINAL_REQUIRED = required ? "true" : "false";
    prismaMock.plagiarismResult.count.mockResolvedValue(eligible ? 1 : 0);
    try {
      await fn();
    } finally {
      if (prev === undefined) delete process.env.STRIKE_BEFORE_FINAL_REQUIRED;
      else process.env.STRIKE_BEFORE_FINAL_REQUIRED = prev;
    }
  }

  it("Test A: STRIKE OFF allows Final Adviser Request Changes", async () => {
    await withStrikeEnv(false, false, async () => {
      prismaMock.thesisRecord.findUnique.mockResolvedValue(awaitingThesis());
      prismaMock.adviserCertification.updateMany.mockResolvedValue({ count: 1 });
      await svc.requestChanges("adviser-1", "thesis-1", {
        remarks: "ok",
        expectedReviewedDocumentId: "doc-a",
      });
      expect(prismaMock.adviserCertification.updateMany).toHaveBeenCalled();
    });
  });

  it("Test B/C/E: STRIKE ON blocks Request Changes and Certify on existing manuscript", async () => {
    await withStrikeEnv(true, false, async () => {
      prismaMock.thesisRecord.findUnique.mockResolvedValue(awaitingThesis());

      await expect(
        svc.requestChanges("adviser-1", "thesis-1", {
          remarks: "x",
          expectedReviewedDocumentId: "doc-a",
        }),
      ).rejects.toThrow(/STRIKE/i);
      expect(prismaMock.adviserCertification.updateMany).not.toHaveBeenCalled();

      await expect(
        svc.certify("adviser-1", "thesis-1", {
          signatureData: "sig",
          expectedReviewedDocumentId: "doc-a",
        }),
      ).rejects.toThrow(/STRIKE/i);
      expect(prismaMock.__tx.adviserCertification.updateMany).not.toHaveBeenCalled();
      expect(prismaMock.adviserCertification.updateMany).not.toHaveBeenCalled();
    });
  });

  it("Test D: STRIKE ON + eligible allows Adviser action", async () => {
    await withStrikeEnv(true, true, async () => {
      prismaMock.thesisRecord.findUnique.mockResolvedValue(awaitingThesis());
      prismaMock.adviserCertification.updateMany.mockResolvedValue({ count: 1 });
      await svc.requestChanges("adviser-1", "thesis-1", {
        remarks: "ok",
        expectedReviewedDocumentId: "doc-a",
      });
      expect(prismaMock.adviserCertification.updateMany).toHaveBeenCalled();
    });
  });

  it("Test F: incomplete Proposal blocks Final Adviser mutation", async () => {
    prismaMock.defenseConclusion.findFirst.mockImplementation(async (args: any) => {
      if (args?.where?.schedule?.defenseType === "PROPOSAL_DEFENSE") {
        return { outcome: "PENDING", scheduleId: null };
      }
      return { selectedTitleId: "t1", scheduleId: "title-sched" };
    });
    prismaMock.thesisRecord.findUnique.mockResolvedValue(awaitingThesis());
    await expect(
      svc.requestChanges("adviser-1", "thesis-1", {
        remarks: "x",
        expectedReviewedDocumentId: "doc-a",
      }),
    ).rejects.toThrow(/Proposal Defense must be formally PASSED/i);
    await expect(
      svc.certify("adviser-1", "thesis-1", {
        signatureData: "sig",
        expectedReviewedDocumentId: "doc-a",
      }),
    ).rejects.toThrow(/Proposal Defense must be formally PASSED/i);
    expect(prismaMock.adviserCertification.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.__tx.adviserCertification.updateMany).not.toHaveBeenCalled();
  });

  async function captureError(fn: () => Promise<unknown>) {
    try {
      await fn();
      throw new Error("expected rejection");
    } catch (e: any) {
      return e;
    }
  }

  it("Test 1/2/3/4: unauthorized caller gets 403 before Proposal/STRIKE checks", async () => {
    prismaMock.adviserAssignment.findFirst.mockResolvedValue(null);
    prismaMock.thesisRecord.findUnique.mockResolvedValue(awaitingThesis());
    // If prerequisites ran, Proposal incomplete would throw 400 — force incomplete Proposal
    prismaMock.defenseConclusion.findFirst.mockImplementation(async (args: any) => {
      if (args?.where?.schedule?.defenseType === "PROPOSAL_DEFENSE") {
        return { outcome: "PENDING", scheduleId: null };
      }
      return { selectedTitleId: "t1", scheduleId: "title-sched" };
    });
    const prevStrike = process.env.STRIKE_BEFORE_FINAL_REQUIRED;
    process.env.STRIKE_BEFORE_FINAL_REQUIRED = "true";
    prismaMock.plagiarismResult.count.mockResolvedValue(0);

    try {
      const rc = await captureError(() =>
        svc.requestChanges("other-panelist", "thesis-1", {
          remarks: "x",
          expectedReviewedDocumentId: "doc-a",
        }),
      );
      expect(rc.statusCode).toBe(403);
      expect(rc.message).toMatch(/active adviser/i);
      expect(rc.message).not.toMatch(/Proposal Defense/i);
      expect(rc.message).not.toMatch(/STRIKE/i);

      const cert = await captureError(() =>
        svc.certify("other-panelist", "thesis-1", {
          signatureData: "sig",
          expectedReviewedDocumentId: "doc-a",
        }),
      );
      expect(cert.statusCode).toBe(403);
      expect(cert.message).toMatch(/active adviser/i);
      expect(cert.message).not.toMatch(/Proposal Defense/i);
      expect(cert.message).not.toMatch(/STRIKE/i);
      expect(prismaMock.adviserCertification.updateMany).not.toHaveBeenCalled();
      expect(prismaMock.__tx.adviserCertification.updateMany).not.toHaveBeenCalled();
    } finally {
      if (prevStrike === undefined)
        delete process.env.STRIKE_BEFORE_FINAL_REQUIRED;
      else process.env.STRIKE_BEFORE_FINAL_REQUIRED = prevStrike;
    }
  });

  it("Test 5/6: authorized adviser still receives prerequisite errors", async () => {
    // Proposal incomplete → 400
    prismaMock.defenseConclusion.findFirst.mockImplementation(async (args: any) => {
      if (args?.where?.schedule?.defenseType === "PROPOSAL_DEFENSE") {
        return { outcome: "PENDING", scheduleId: null };
      }
      return { selectedTitleId: "t1", scheduleId: "title-sched" };
    });
    prismaMock.thesisRecord.findUnique.mockResolvedValue(awaitingThesis());
    const proposalErr = await captureError(() =>
      svc.requestChanges("adviser-1", "thesis-1", {
        remarks: "x",
        expectedReviewedDocumentId: "doc-a",
      }),
    );
    expect(proposalErr.statusCode).toBe(400);
    expect(proposalErr.message).toMatch(/Proposal Defense/i);

    // STRIKE pending → 400
    prismaMock.defenseConclusion.findFirst.mockImplementation(async (args: any) => {
      if (args?.where?.schedule?.defenseType === "PROPOSAL_DEFENSE") {
        return { outcome: "PASSED", scheduleId: "prop-sched" };
      }
      return { selectedTitleId: "t1", scheduleId: "title-sched" };
    });
    prismaMock.rapReport.count.mockResolvedValue(1);
    const prev = process.env.STRIKE_BEFORE_FINAL_REQUIRED;
    process.env.STRIKE_BEFORE_FINAL_REQUIRED = "true";
    prismaMock.plagiarismResult.count.mockResolvedValue(0);
    try {
      const strikeErr = await captureError(() =>
        svc.certify("adviser-1", "thesis-1", {
          signatureData: "sig",
          expectedReviewedDocumentId: "doc-a",
        }),
      );
      expect(strikeErr.statusCode).toBe(400);
      expect(strikeErr.message).toMatch(/STRIKE/i);
      expect(strikeErr.message).not.toMatch(/active adviser/i);
    } finally {
      if (prev === undefined) delete process.env.STRIKE_BEFORE_FINAL_REQUIRED;
      else process.env.STRIKE_BEFORE_FINAL_REQUIRED = prev;
    }
  });
});
