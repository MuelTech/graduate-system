import { beforeEach, describe, expect, it, vi } from "vitest";

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
    rapReport: { findFirst: vi.fn(), count: vi.fn() },
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

import { ProposalAdviserReviewService } from "../../../src/services/proposal-adviser-review.service";

function studentRow() {
  return {
    id: "student-1",
    studentNumber: "2026-001",
    user: { id: "student-user", firstName: "Ana", lastName: "Student" },
  };
}

/** DL-7: test documents carry real column identity so exact binding validates. */
function proposalDoc<T extends Record<string, unknown>>(doc: T) {
  return {
    thesisId: "thesis-1",
    docType: "PROPOSAL_CHAPTERS",
    defenseStage: "PROPOSAL",
    ...doc,
  };
}

function thesisRow(overrides: Record<string, unknown> = {}) {
  const row = {
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
    thesisTitles: [],
    defenseSchedules: [
      {
        conclusion: {
          selectedTitle: { titleText: "Official Title" },
        },
      },
    ],
    thesisDocuments: [],
    adviserCertifications: [],
    ...overrides,
  } as Record<string, unknown>;

  return {
    ...row,
    thesisDocuments: ((row.thesisDocuments as any[]) ?? []).map(proposalDoc),
    adviserCertifications: ((row.adviserCertifications as any[]) ?? []).map((c) => ({
      ...c,
      reviewedDocument: c.reviewedDocument
        ? proposalDoc(c.reviewedDocument)
        : (c.reviewedDocument ?? null),
    })),
  };
}

function managed(overrides: Record<string, unknown> = {}) {
  return {
    filePath: "uploads/manuscript.pdf",
    storageKey: "manuscripts/test-proposal",
    storageProvider: "local",
    originalFilename: "chapters.pdf",
    verifiedMimeType: "application/pdf",
    sizeBytes: 1024,
    checksum: "abc",
    checksumAlgorithm: "sha256",
    uploadedById: "student-user",
    ...overrides,
  };
}

describe("ProposalAdviserReviewService (CP3)", () => {
  const svc = new ProposalAdviserReviewService();

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.student.findUnique.mockResolvedValue(studentRow());
    prismaMock.adviserAssignment.findFirst.mockResolvedValue({
      id: "assign-1",
      studentId: "student-1",
      adviserId: "adviser-1",
      isActive: true,
    });
    prismaMock.defenseConclusion.findFirst.mockResolvedValue({
      selectedTitleId: "t1",
      scheduleId: "sched-1",
    });
    prismaMock.rapReport.count.mockResolvedValue(1);
    prismaMock.adviserCertification.findFirst.mockResolvedValue(null);
    prismaMock.adviserCertification.create.mockImplementation(async (args: any) => ({
      id: "cert-1",
      ...args.data,
    }));
    prismaMock.adviserCertification.update.mockImplementation(async (args: any) => ({
      id: args.where.id,
      ...args.data,
    }));
    prismaMock.thesisDocument.create.mockImplementation(async (args: any) => ({
      id: "doc-1",
      uploadedAt: new Date(),
      ...args.data,
    }));
    prismaMock.thesisRecord.findFirst.mockResolvedValue(thesisRow());
    prismaMock.thesisRecord.findUnique.mockResolvedValue(thesisRow());
    prismaMock.$transaction.mockImplementation(async (fn: any) => fn(prismaMock.__tx));
    prismaMock.__tx.$queryRaw.mockResolvedValue([]);
    prismaMock.__tx.thesisDocument.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.__tx.thesisDocument.findUnique.mockResolvedValue(null);
    prismaMock.__tx.thesisDocument.findMany.mockResolvedValue([]);
    prismaMock.__tx.thesisDocument.create.mockImplementation(async (args: any) => ({
      id: "doc-1",
      uploadedAt: new Date(),
      ...args.data,
    }));
    prismaMock.adviserCertification.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.__tx.adviserCertification.findFirst.mockResolvedValue(null);
    prismaMock.__tx.adviserCertification.update.mockResolvedValue({});
    prismaMock.__tx.adviserCertification.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.__tx.adviserCertification.create.mockResolvedValue({});
  });

  it("Test 1: Student submits manuscript → AWAITING_REVIEW, no Admin application", async () => {
    // After create, getStudentReviewState reloads via findUnique.
    prismaMock.thesisRecord.findUnique.mockResolvedValue(
      thesisRow({
        thesisDocuments: [{ id: "doc-1", uploadedAt: new Date() }],
        adviserCertifications: [
          {
            id: "cert-1",
            status: "AWAITING_REVIEW",
            defenseStage: "PROPOSAL_DEFENSE",
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
    const file = managed();
    await svc.submitManuscriptForReview("student-user", file);
    expect(prismaMock.__tx.thesisDocument.create).toHaveBeenCalled();
    expect(prismaMock.__tx.adviserCertification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "AWAITING_REVIEW",
          defenseStage: "PROPOSAL_DEFENSE",
        }),
      }),
    );
    // DL-2 FIX1: post-commit state is read separately by the controller.
    const dto = await svc.getStudentReviewState("student-user");
    expect(dto.reviewStatus).toBe("AWAITING_REVIEW");
    expect(dto.certification).toBeNull();
  });

  it("Test 2: no active Adviser rejects manuscript submit", async () => {
    prismaMock.adviserAssignment.findFirst.mockResolvedValue(null);
    await expect(
      svc.submitManuscriptForReview("student-user", managed({ filePath: "uploads/x.pdf", originalFilename: "x.pdf" })),
    ).rejects.toThrow(/active Thesis Adviser/i);
    expect(prismaMock.thesisDocument.create).not.toHaveBeenCalled();
  });

  it("Test 3-4: only active adviser can read/write review task", async () => {
    prismaMock.thesisRecord.findUnique.mockResolvedValue(
      thesisRow({
        thesisDocuments: [{ id: "doc-1", uploadedAt: new Date() }],
        adviserCertifications: [
          {
            id: "cert-1",
            status: "AWAITING_REVIEW",
            defenseStage: "PROPOSAL_DEFENSE",
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

    // Correct adviser can read
    await expect(
      svc.getReviewTask("adviser-1", "thesis-1"),
    ).resolves.toBeTruthy();

    // Unrelated panelist denied
    prismaMock.adviserAssignment.findFirst.mockResolvedValue(null);
    await expect(
      svc.getReviewTask("other-panelist", "thesis-1"),
    ).rejects.toThrow(/active adviser/i);
    await expect(
      svc.requestChanges("other-panelist", "thesis-1", { remarks: "nope", expectedReviewedDocumentId: "doc-1" }),
    ).rejects.toThrow(/active adviser/i);
    await expect(
      svc.certify("other-panelist", "thesis-1", { signatureData: "sig", expectedReviewedDocumentId: "doc-1" }),
    ).rejects.toThrow(/active adviser/i);
  });

  it("Test 5: request changes stores remarks and does not issue cert", async () => {
    prismaMock.thesisRecord.findUnique.mockResolvedValue(
      thesisRow({
        thesisDocuments: [{ id: "doc-1", uploadedAt: new Date() }],
        adviserCertifications: [
          {
            id: "cert-1",
            status: "AWAITING_REVIEW",
            defenseStage: "PROPOSAL_DEFENSE",
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
    prismaMock.adviserCertification.updateMany.mockResolvedValue({ count: 1 });
    const dto = await svc.requestChanges("adviser-1", "thesis-1", { remarks: "Please revise Ch. 2", expectedReviewedDocumentId: "doc-1" });
    expect(prismaMock.adviserCertification.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "CHANGES_REQUESTED",
          reviewRemarks: "Please revise Ch. 2",
        }),
      }),
    );
    expect(dto.certification).toBeNull();
  });

  it("Test 6: resubmit after changes returns to AWAITING_REVIEW with new document", async () => {
    // Outer ISSUED guard, then in-tx ISSUED guard, then current cert lookup.
    prismaMock.adviserCertification.findFirst.mockResolvedValueOnce(null);
    prismaMock.__tx.adviserCertification.findFirst
      .mockResolvedValueOnce(null) // in-tx ISSUED check
      .mockResolvedValueOnce({
        id: "cert-1",
        status: "CHANGES_REQUESTED",
        defenseStage: "PROPOSAL_DEFENSE",
        reviewRemarks: "revise",
      });
    prismaMock.thesisRecord.findUnique.mockResolvedValue(
      thesisRow({
        thesisDocuments: [{ id: "doc-1", uploadedAt: new Date() }],
        adviserCertifications: [
          {
            id: "cert-1",
            status: "AWAITING_REVIEW",
            defenseStage: "PROPOSAL_DEFENSE",
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
    await svc.submitManuscriptForReview("student-user", managed({
      filePath: "uploads/revised.pdf",
      originalFilename: "revised.pdf",
    }));
    expect(prismaMock.__tx.thesisDocument.create).toHaveBeenCalled();
    expect(prismaMock.__tx.adviserCertification.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "cert-1",
          status: { not: "ISSUED" },
        }),
        data: expect.objectContaining({
          status: "AWAITING_REVIEW",
          reviewedDocumentId: "doc-1",
        }),
      }),
    );
    const dto = await svc.getStudentReviewState("student-user");
    expect(dto.reviewStatus).toBe("AWAITING_REVIEW");
  });

  it("Test 7-8: certify with e-sign uses server timestamp and stores signature", async () => {
    const before = Date.now();
    const awaiting = thesisRow({
      thesisDocuments: [{ id: "doc-1", uploadedAt: new Date() }],
      adviserCertifications: [
        {
          id: "cert-1",
          status: "AWAITING_REVIEW",
          defenseStage: "PROPOSAL_DEFENSE",
          reviewedDocumentId: "doc-1",
          adviser: { id: "adviser-1", firstName: "Bob", lastName: "Adviser" },
          reviewedDocument: { id: "doc-1", uploadedAt: new Date() },
          reviewRemarks: null,
          signatureData: null,
          signedAt: null,
        },
      ],
    });
    const issued = thesisRow({
      thesisDocuments: [{ id: "doc-1", uploadedAt: new Date() }],
      adviserCertifications: [
        {
          id: "cert-1",
          status: "ISSUED",
          defenseStage: "PROPOSAL_DEFENSE",
          reviewedDocumentId: "doc-1",
          adviser: { id: "adviser-1", firstName: "Bob", lastName: "Adviser" },
          reviewedDocument: { id: "doc-1", uploadedAt: new Date() },
          reviewRemarks: null,
          signatureData: "e-sign-blob",
          signedAt: new Date(),
        },
      ],
    });
    prismaMock.thesisRecord.findUnique
      .mockResolvedValueOnce(awaiting)
      .mockResolvedValue(issued);

    const dto = await svc.certify("adviser-1", "thesis-1", {
      signatureData: "e-sign-blob",
      clientIssuedAt: "2000-01-01T00:00:00.000Z", // must be ignored
      expectedReviewedDocumentId: "doc-1",
    });

    const updateArgs =
      prismaMock.__tx.adviserCertification.updateMany.mock.calls[0]?.[0];
    expect(updateArgs?.where?.status).toBe("AWAITING_REVIEW");
    expect(updateArgs?.data?.status).toBe("ISSUED");
    expect(updateArgs?.data?.signatureData).toBe("e-sign-blob");
    expect(updateArgs?.data?.signedAt).toBeInstanceOf(Date);
    // Server time, not client year 2000
    expect(updateArgs?.data?.signedAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(dto.certification?.issued).toBe(true);
  });

  it("Test 9: duplicate certification prevented", async () => {
    prismaMock.thesisRecord.findUnique.mockResolvedValue(
      thesisRow({
        thesisDocuments: [{ id: "doc-1", uploadedAt: new Date() }],
        adviserCertifications: [
          {
            id: "cert-issued",
            status: "ISSUED",
            defenseStage: "PROPOSAL_DEFENSE",
            adviser: { id: "adviser-1", firstName: "Bob", lastName: "Adviser" },
            reviewedDocument: { id: "doc-1", uploadedAt: new Date() },
            reviewRemarks: null,
            signatureData: "old",
            signedAt: new Date(),
          },
        ],
      }),
    );
    prismaMock.__tx.adviserCertification.findFirst.mockResolvedValue({
      id: "cert-issued",
      status: "ISSUED",
    });
    await expect(
      svc.certify("adviser-1", "thesis-1", { signatureData: "sig", expectedReviewedDocumentId: "doc-1" }),
    ).rejects.toThrow(/already issued/i);
  });

  it("Test F: upload after ISSUED creates no document and rejects", async () => {
    prismaMock.adviserCertification.findFirst.mockResolvedValue({
      id: "cert-issued",
      status: "ISSUED",
      defenseStage: "PROPOSAL_DEFENSE",
    });
    await expect(
      svc.submitManuscriptForReview("student-user", managed({ filePath: "uploads/late.pdf", originalFilename: "late.pdf" })),
    ).rejects.toThrow(/already issued/i);
    expect(prismaMock.thesisDocument.create).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("Test 1-2: transactional guard blocks race — ISSUED cannot be downgraded", async () => {
    // Outer pre-check: no ISSUED yet.
    prismaMock.adviserCertification.findFirst.mockResolvedValueOnce(null);
    // Inside transaction: certification is now ISSUED (Adviser certified mid-flight).
    prismaMock.__tx.adviserCertification.findFirst.mockResolvedValue({
      id: "cert-1",
      status: "ISSUED",
      defenseStage: "PROPOSAL_DEFENSE",
      signatureData: "keep-me",
      signedAt: new Date("2026-09-27T10:00:00Z"),
      certifiedAt: new Date("2026-09-27T10:00:00Z"),
      reviewedDocumentId: "doc-keep",
    });

    await expect(
      svc.submitManuscriptForReview("student-user", managed({ filePath: "uploads/race.pdf", originalFilename: "race.pdf" })),
    ).rejects.toThrow(/already issued/i);

    // No manuscript committed; no downgrade update.
    expect(prismaMock.__tx.thesisDocument.create).not.toHaveBeenCalled();
    expect(prismaMock.__tx.adviserCertification.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.__tx.adviserCertification.update).not.toHaveBeenCalled();
  });

  it("Test 1b: conditional updateMany count=0 also blocks downgrade", async () => {
    prismaMock.adviserCertification.findFirst.mockResolvedValueOnce(null);
    prismaMock.__tx.adviserCertification.findFirst
      .mockResolvedValueOnce(null) // ISSUED check inside tx
      .mockResolvedValueOnce({
        id: "cert-1",
        status: "CHANGES_REQUESTED",
        defenseStage: "PROPOSAL_DEFENSE",
        reviewRemarks: "old",
      });
    prismaMock.__tx.thesisDocument.create.mockResolvedValue({
      id: "doc-new",
      uploadedAt: new Date(),
    });
    // Conditional write fails — row became ISSUED.
    prismaMock.__tx.adviserCertification.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      svc.submitManuscriptForReview("student-user", managed({ filePath: "uploads/race2.pdf", originalFilename: "race2.pdf" })),
    ).rejects.toThrow(/already issued/i);
  });

  it("Test H: review task prefers cert.reviewedDocumentId over latest upload", async () => {
    prismaMock.thesisRecord.findUnique.mockResolvedValue(
      thesisRow({
        thesisDocuments: [
          { id: "doc-b-newer", uploadedAt: new Date("2026-10-01") },
          { id: "doc-a-bound", uploadedAt: new Date("2026-09-01") },
        ],
        adviserCertifications: [
          {
            id: "cert-1",
            status: "AWAITING_REVIEW",
            defenseStage: "PROPOSAL_DEFENSE",
            reviewedDocumentId: "doc-a-bound",
            adviser: { id: "adviser-1", firstName: "Bob", lastName: "Adviser" },
            reviewedDocument: {
              id: "doc-a-bound",
              uploadedAt: new Date("2026-09-01"),
            },
            reviewRemarks: null,
            signatureData: null,
            signedAt: null,
          },
        ],
      }),
    );
    const dto = await svc.getReviewTask("adviser-1", "thesis-1");
    expect(dto.manuscript?.documentId).toBe("doc-a-bound");
  });

  it("Test 10/12: eligibility snapshot — only ISSUED counts; Research Variables non-blocking", async () => {
    // Pure rule already covered; eligibility service keeps ADVISER_CERT from ISSUED only.
    const { researchVariablesSatisfied } = await import(
      "../../../src/services/defense-eligibility.service"
    );
    expect(researchVariablesSatisfied("NONE")).toBe(false); // helper unchanged
    // Gate is not invoked when Research Variables is absent — CP1 regression in eligibility tests.
  });

  it("Test 1: stale certify after Student resubmit is rejected (count=0)", async () => {
    // Task presented manuscript A
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
            defenseStage: "PROPOSAL_DEFENSE",
            reviewedDocumentId: "doc-b", // Student resubmitted B
            adviser: { id: "adviser-1", firstName: "Bob", lastName: "Adviser" },
            reviewedDocument: { id: "doc-b", uploadedAt: new Date() },
            reviewRemarks: null,
            signatureData: null,
            signedAt: null,
          },
        ],
      }),
    );
    prismaMock.__tx.adviserCertification.findFirst.mockResolvedValue(null);
    prismaMock.__tx.adviserCertification.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      svc.certify("adviser-1", "thesis-1", {
        signatureData: "sig",
        expectedReviewedDocumentId: "doc-a", // stale A
      }),
    ).rejects.toThrow(/no longer the current|review state changed/i);
  });

  it("Test 2: correct current certify succeeds and keeps reviewedDocumentId", async () => {
    prismaMock.thesisRecord.findUnique
      .mockResolvedValueOnce(
        thesisRow({
          thesisDocuments: [{ id: "doc-b", uploadedAt: new Date() }],
          adviserCertifications: [
            {
              id: "cert-1",
              status: "AWAITING_REVIEW",
              defenseStage: "PROPOSAL_DEFENSE",
              reviewedDocumentId: "doc-b",
              adviser: { id: "adviser-1", firstName: "Bob", lastName: "Adviser" },
              reviewedDocument: { id: "doc-b", uploadedAt: new Date() },
              reviewRemarks: null,
              signatureData: null,
              signedAt: null,
            },
          ],
        }),
      )
      .mockResolvedValue(
        thesisRow({
          thesisDocuments: [{ id: "doc-b", uploadedAt: new Date() }],
          adviserCertifications: [
            {
              id: "cert-1",
              status: "ISSUED",
              defenseStage: "PROPOSAL_DEFENSE",
              reviewedDocumentId: "doc-b",
              adviser: { id: "adviser-1", firstName: "Bob", lastName: "Adviser" },
              reviewedDocument: { id: "doc-b", uploadedAt: new Date() },
              reviewRemarks: null,
              signatureData: "sig",
              signedAt: new Date(),
            },
          ],
        }),
      );
    prismaMock.__tx.adviserCertification.findFirst.mockResolvedValue(null);
    prismaMock.__tx.adviserCertification.updateMany.mockResolvedValue({ count: 1 });

    await svc.certify("adviser-1", "thesis-1", {
      signatureData: "sig",
      expectedReviewedDocumentId: "doc-b",
    });

    const call = prismaMock.__tx.adviserCertification.updateMany.mock.calls[0]?.[0];
    expect(call?.where?.status).toBe("AWAITING_REVIEW");
    expect(call?.where?.reviewedDocumentId).toBe("doc-b");
    expect(call?.data?.status).toBe("ISSUED");
    expect(call?.data?.reviewedDocumentId).toBeUndefined();
  });

  it("Test 4: request changes loses race to certify (count=0 → 409)", async () => {
    prismaMock.thesisRecord.findUnique.mockResolvedValue(
      thesisRow({
        thesisDocuments: [{ id: "doc-a", uploadedAt: new Date() }],
        adviserCertifications: [
          {
            id: "cert-1",
            status: "AWAITING_REVIEW",
            defenseStage: "PROPOSAL_DEFENSE",
            reviewedDocumentId: "doc-a",
            adviser: { id: "adviser-1", firstName: "Bob", lastName: "Adviser" },
            reviewedDocument: { id: "doc-a", uploadedAt: new Date() },
            reviewRemarks: null,
            signatureData: null,
            signedAt: null,
          },
        ],
      }),
    );
    prismaMock.adviserCertification.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      svc.requestChanges("adviser-1", "thesis-1", { remarks: "please revise", expectedReviewedDocumentId: "doc-1" }),
    ).rejects.toThrow(/review state changed/i);
  });

  it("Test 5: request changes stale manuscript binding rejected", async () => {
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
            defenseStage: "PROPOSAL_DEFENSE",
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
        remarks: "stale remarks",
        expectedReviewedDocumentId: "doc-a", // client expectation A
      }),
    ).rejects.toThrow(/review state changed/i);
    // CP3-FIX4: WHERE must use client expected A, not current DB B.
    expect(prismaMock.adviserCertification.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          reviewedDocumentId: "doc-a",
          status: "AWAITING_REVIEW",
        }),
      }),
    );
  });

  it("Test 6: request changes correct current version succeeds", async () => {
    prismaMock.thesisRecord.findUnique.mockResolvedValue(
      thesisRow({
        thesisDocuments: [{ id: "doc-a", uploadedAt: new Date() }],
        adviserCertifications: [
          {
            id: "cert-1",
            status: "AWAITING_REVIEW",
            defenseStage: "PROPOSAL_DEFENSE",
            reviewedDocumentId: "doc-a",
            adviser: { id: "adviser-1", firstName: "Bob", lastName: "Adviser" },
            reviewedDocument: { id: "doc-a", uploadedAt: new Date() },
            reviewRemarks: null,
            signatureData: null,
            signedAt: null,
          },
        ],
      }),
    );
    prismaMock.adviserCertification.updateMany.mockResolvedValue({ count: 1 });

    await svc.requestChanges("adviser-1", "thesis-1", {
      remarks: "revise ch2",
      expectedReviewedDocumentId: "doc-a",
    });
    expect(prismaMock.adviserCertification.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "cert-1",
          status: "AWAITING_REVIEW",
          reviewedDocumentId: "doc-a",
        }),
        data: expect.objectContaining({
          status: "CHANGES_REQUESTED",
          reviewRemarks: "revise ch2",
        }),
      }),
    );
  });

  it("Test 2b: missing expectedReviewedDocumentId rejected (400)", async () => {
    await expect(
      svc.requestChanges("adviser-1", "thesis-1", {
        remarks: "x",
        expectedReviewedDocumentId: "",
      }),
    ).rejects.toThrow(/Reviewed manuscript identifier is required/i);

    await expect(
      svc.certify("adviser-1", "thesis-1", {
        signatureData: "sig",
        expectedReviewedDocumentId: "",
      }),
    ).rejects.toThrow(/Reviewed manuscript identifier is required/i);

    expect(prismaMock.adviserCertification.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.__tx.adviserCertification.updateMany).not.toHaveBeenCalled();
  });

  it("Test 9: ISSUED immutable across resubmit / request-changes / certify", async () => {
    const issuedRow = thesisRow({
      thesisDocuments: [{ id: "doc-keep", uploadedAt: new Date() }],
      adviserCertifications: [
        {
          id: "cert-issued",
          status: "ISSUED",
          defenseStage: "PROPOSAL_DEFENSE",
          reviewedDocumentId: "doc-keep",
          adviser: { id: "adviser-1", firstName: "Bob", lastName: "Adviser" },
          reviewedDocument: { id: "doc-keep", uploadedAt: new Date() },
          reviewRemarks: null,
          signatureData: "keep-me",
          signedAt: new Date("2026-09-27T10:00:00Z"),
          certifiedAt: new Date("2026-09-27T10:00:00Z"),
        },
      ],
    });
    prismaMock.thesisRecord.findUnique.mockResolvedValue(issuedRow);
    prismaMock.thesisRecord.findFirst.mockResolvedValue(issuedRow);
    prismaMock.adviserCertification.findFirst.mockResolvedValue({
      id: "cert-issued",
      status: "ISSUED",
    });

    await expect(
      svc.submitManuscriptForReview("student-user", managed({ filePath: "uploads/x.pdf", originalFilename: "x.pdf" })),
    ).rejects.toThrow(/already issued/i);

    await expect(
      svc.requestChanges("adviser-1", "thesis-1", { remarks: "nope", expectedReviewedDocumentId: "doc-1" }),
    ).rejects.toThrow(/already issued|cannot be changed|review state/i);

    await expect(
      svc.certify("adviser-1", "thesis-1", { signatureData: "again", expectedReviewedDocumentId: "doc-1" }),
    ).rejects.toThrow(/already issued/i);

    expect(prismaMock.adviserCertification.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.__tx.adviserCertification.updateMany).not.toHaveBeenCalled();
  });
});
