import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
  $queryRaw: vi.fn(),
  defenseSchedule: { findUnique: vi.fn() },
  panelAssignment: { findFirst: vi.fn() },
  thesisDocument: { findUnique: vi.fn(), findFirst: vi.fn() },
  adviserCertification: { findFirst: vi.fn() },
  defenseAnnotation: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
  defenseAnnotationComment: { findUnique: vi.fn(), create: vi.fn() },
  rapReport: { updateMany: vi.fn(), update: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
}));

const { ensureSummary } = vi.hoisted(() => ({ ensureSummary: vi.fn() }));

vi.mock("../../../src/config/database", () => ({ default: prismaMock }));
vi.mock("../../../src/services/official-defense-record.service", () => ({
  OfficialDefenseRecordService: class {
    ensureOralExamSummary = ensureSummary;
  },
}));

import { DefenseCollaborationService } from "../../../src/services/defense-collaboration.service";
import { AppError } from "../../../src/utils/AppError";

// Mirror the repo's transaction-mock convention: run the interactive callback
// against the same mock client so `tx.<model>` resolves to the shared mocks.
// `clearAllMocks()` clears calls but keeps these implementations.
prismaMock.$transaction.mockImplementation(
  async (fn: (tx: typeof prismaMock) => unknown) => fn(prismaMock),
);
prismaMock.$queryRaw.mockResolvedValue([]);

const VALID_ANCHOR = {
  anchorVersion: 1,
  pageNumber: 1,
  selectedText: "hello",
  rects: [{ x: 0, y: 0, width: 0.1, height: 0.1 }],
  prefix: "",
  suffix: "",
};
const VALID_BODY = {
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "hi" }] }],
};

function scheduleRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "sched-1",
    thesisId: "thesis-1",
    defenseType: "TITLE_DEFENSE",
    sessionStatus: "IN_PROGRESS",
    manuscriptDocumentId: null,
    defenseDate: new Date("2026-10-20T00:00:00.000Z"),
    defenseTime: new Date("1970-01-01T09:00:00.000Z"),
    venueOrLink: "Room 201",
    rapporteurNotes: null,
    thesis: {
      student: {
        studentNumber: "2020-001",
        user: { firstName: "Ana", lastName: "Cruz" },
        program: { programName: "MSIT" },
      },
    },
    panelAssignments: [] as unknown[],
    rapReports: [] as unknown[],
    ...overrides,
  };
}

function certRow(overrides: Record<string, unknown> = {}) {
  return {
    status: "ISSUED",
    defenseStage: "PROPOSAL_DEFENSE",
    reviewedDocumentId: "doc-1",
    ...overrides,
  };
}

function assignmentRow(role: string) {
  return { id: `pa-${role}`, scheduleId: "sched-1", userId: `u-${role}`, role };
}

function documentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "doc-1",
    thesisId: "thesis-1",
    defenseStage: "TITLE",
    docType: "TITLE_PROPOSAL",
    isCurrent: true,
    ...overrides,
  };
}

function annotationRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "ann-1",
    scheduleId: "sched-1",
    thesisDocumentId: "doc-1",
    pageNumber: 1,
    selectedText: "hello",
    anchorData: { rects: VALID_ANCHOR.rects, prefix: "", suffix: "" },
    anchorVersion: 1,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    author: { id: "pa-CHAIRMAN", userId: "u-CHAIRMAN", role: "CHAIRMAN", user: { firstName: "C", lastName: "H" } },
    ...overrides,
  };
}

function rapRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "rap-1",
    scheduleId: "sched-1",
    status: "DRAFT",
    bodyDocument: null as unknown,
    bodyVersion: 0,
    contentVersion: 0,
    frozenAt: null as Date | null,
    frozenById: null as string | null,
    frozenContentHash: null as string | null,
    decisionsAndRecommendations: null as string | null,
    reportDate: null as Date | null,
    venue: null as string | null,
    ...overrides,
  };
}

describe("DefenseCollaborationService (CDW-1)", () => {
  const svc = new DefenseCollaborationService();

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(scheduleRow());
    prismaMock.panelAssignment.findFirst.mockResolvedValue(assignmentRow("PANELIST"));
    prismaMock.thesisDocument.findUnique.mockResolvedValue(documentRow());
    prismaMock.thesisDocument.findFirst.mockResolvedValue(documentRow());
    prismaMock.adviserCertification.findFirst.mockResolvedValue(null);
    ensureSummary.mockResolvedValue({
      created: false,
      summaryId: "sum-1",
      evaluatorCount: 1,
      overallAverage: 0,
      finalRating: null,
    });
    prismaMock.defenseAnnotation.create.mockImplementation(async (args: { data: Record<string, unknown> }) => ({
      ...annotationRow(),
      ...args.data,
      author: { id: args.data.authorAssignmentId, userId: "u", role: "PANELIST", user: { firstName: "P", lastName: "N" } },
    }));
  });

  // ---- Authorization -----------------------------------------------------

  it("denies a non-assigned caller with 403", async () => {
    prismaMock.panelAssignment.findFirst.mockResolvedValue(null);
    await expect(svc.listAnnotations("sched-1", "u-x", "doc-1")).rejects.toMatchObject({ statusCode: 403 });
  });

  it("allows a Chairman to create an annotation", async () => {
    prismaMock.panelAssignment.findFirst.mockResolvedValue(assignmentRow("CHAIRMAN"));
    await expect(
      svc.createAnnotation("sched-1", "u-CHAIRMAN", { thesisDocumentId: "doc-1", anchor: VALID_ANCHOR }),
    ).resolves.toMatchObject({ pageNumber: 1 });
  });

  it("allows a Panelist to create an annotation", async () => {
    await expect(
      svc.createAnnotation("sched-1", "u-PANELIST", { thesisDocumentId: "doc-1", anchor: VALID_ANCHOR }),
    ).resolves.toMatchObject({ scheduleId: "sched-1" });
  });

  it("blocks Adviser annotation writes with 403", async () => {
    prismaMock.panelAssignment.findFirst.mockResolvedValue(assignmentRow("ADVISER"));
    await expect(
      svc.createAnnotation("sched-1", "u-ADVISER", { thesisDocumentId: "doc-1", anchor: VALID_ANCHOR }),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(prismaMock.defenseAnnotation.create).not.toHaveBeenCalled();
  });

  it("blocks Facilitator annotation writes with 403", async () => {
    prismaMock.panelAssignment.findFirst.mockResolvedValue(assignmentRow("FACILITATOR"));
    await expect(
      svc.createAnnotation("sched-1", "u-FACILITATOR", { thesisDocumentId: "doc-1", anchor: VALID_ANCHOR }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("derives the author assignment server-side (client cannot forge it)", async () => {
    prismaMock.panelAssignment.findFirst.mockResolvedValue(assignmentRow("PANELIST"));
    await svc.createAnnotation("sched-1", "u-PANELIST", {
      thesisDocumentId: "doc-1",
      anchor: VALID_ANCHOR,
      // malicious/extra client fields are ignored
      authorAssignmentId: "pa-CHAIRMAN",
      scheduleId: "other",
    } as never);
    expect(prismaMock.defenseAnnotation.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ authorAssignmentId: "pa-PANELIST" }) }),
    );
  });

  it("allows the Rapporteur to comment (read + reply) but not annotate", async () => {
    prismaMock.panelAssignment.findFirst.mockResolvedValue(assignmentRow("RAPPORTEUR"));
    prismaMock.defenseAnnotation.findUnique.mockResolvedValue({ id: "ann-1", scheduleId: "sched-1" });
    prismaMock.defenseAnnotationComment.create.mockResolvedValue({
      id: "c-1",
      annotationId: "ann-1",
      parentCommentId: null,
      body: "note",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-01T00:00:00Z"),
      author: { id: "pa-RAPPORTEUR", userId: "u-RAPPORTEUR", role: "RAPPORTEUR", user: { firstName: "R", lastName: "P" } },
    });
    await expect(
      svc.createComment("sched-1", "u-RAPPORTEUR", { annotationId: "ann-1", body: "note" }),
    ).resolves.toMatchObject({ id: "c-1" });
    await expect(
      svc.createAnnotation("sched-1", "u-RAPPORTEUR", { thesisDocumentId: "doc-1", anchor: VALID_ANCHOR }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  // ---- Document binding --------------------------------------------------

  it("rejects a document from another thesis with 403", async () => {
    prismaMock.thesisDocument.findUnique.mockResolvedValue(documentRow({ thesisId: "thesis-2" }));
    await expect(
      svc.createAnnotation("sched-1", "u-PANELIST", { thesisDocumentId: "doc-1", anchor: VALID_ANCHOR }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("rejects a document from the wrong defense stage with 403", async () => {
    prismaMock.thesisDocument.findUnique.mockResolvedValue(documentRow({ defenseStage: "PROPOSAL", docType: "PROPOSAL_CHAPTERS" }));
    await expect(
      svc.createAnnotation("sched-1", "u-PANELIST", { thesisDocumentId: "doc-1", anchor: VALID_ANCHOR }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("rejects a non-current (superseded) document with 409", async () => {
    prismaMock.thesisDocument.findUnique.mockResolvedValue(documentRow({ isCurrent: false }));
    await expect(
      svc.createAnnotation("sched-1", "u-PANELIST", { thesisDocumentId: "doc-1", anchor: VALID_ANCHOR }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("rejects a missing document with 404", async () => {
    prismaMock.thesisDocument.findUnique.mockResolvedValue(null);
    await expect(
      svc.createAnnotation("sched-1", "u-PANELIST", { thesisDocumentId: "doc-1", anchor: VALID_ANCHOR }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  // ---- Anchor validation -------------------------------------------------

  it("rejects an invalid anchor (x+width>1) with 400 and does not persist", async () => {
    await expect(
      svc.createAnnotation("sched-1", "u-PANELIST", {
        thesisDocumentId: "doc-1",
        anchor: { ...VALID_ANCHOR, rects: [{ x: 0.95, y: 0, width: 0.1, height: 0.1 }] },
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(prismaMock.defenseAnnotation.create).not.toHaveBeenCalled();
  });

  // ---- Comment integrity -------------------------------------------------

  it("rejects a parent comment from a different annotation with 400", async () => {
    prismaMock.defenseAnnotation.findUnique.mockResolvedValue({ id: "ann-1", scheduleId: "sched-1" });
    prismaMock.defenseAnnotationComment.findUnique.mockResolvedValue({
      id: "c-parent",
      annotationId: "ann-OTHER",
      parentCommentId: null,
    });
    await expect(
      svc.createComment("sched-1", "u-PANELIST", { annotationId: "ann-1", body: "x", parentCommentId: "c-parent" }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects replying to a reply (one level only) with 400", async () => {
    prismaMock.defenseAnnotation.findUnique.mockResolvedValue({ id: "ann-1", scheduleId: "sched-1" });
    prismaMock.defenseAnnotationComment.findUnique.mockResolvedValue({
      id: "c-parent",
      annotationId: "ann-1",
      parentCommentId: "c-root",
    });
    await expect(
      svc.createComment("sched-1", "u-PANELIST", { annotationId: "ann-1", body: "x", parentCommentId: "c-parent" }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects a comment whose annotation belongs to another schedule with 403", async () => {
    prismaMock.defenseAnnotation.findUnique.mockResolvedValue({ id: "ann-1", scheduleId: "sched-OTHER" });
    await expect(
      svc.createComment("sched-1", "u-PANELIST", { annotationId: "ann-1", body: "x" }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  // ---- State / immutability ---------------------------------------------

  it("allows collaboration while SCHEDULED", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(scheduleRow({ sessionStatus: "SCHEDULED" }));
    await expect(
      svc.createAnnotation("sched-1", "u-PANELIST", { thesisDocumentId: "doc-1", anchor: VALID_ANCHOR }),
    ).resolves.toBeDefined();
  });

  it("allows collaboration while AWAITING_CONCLUSION with a DRAFT report", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(
      scheduleRow({ sessionStatus: "AWAITING_CONCLUSION", rapReports: [rapRow({ status: "DRAFT" })] }),
    );
    await expect(
      svc.createAnnotation("sched-1", "u-PANELIST", { thesisDocumentId: "doc-1", anchor: VALID_ANCHOR }),
    ).resolves.toBeDefined();
  });

  it("blocks writes once the report is frozen (FOR_SIGNATURE)", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(
      scheduleRow({ sessionStatus: "AWAITING_CONCLUSION", rapReports: [rapRow({ status: "FOR_SIGNATURE", frozenAt: new Date() })] }),
    );
    await expect(
      svc.createAnnotation("sched-1", "u-PANELIST", { thesisDocumentId: "doc-1", anchor: VALID_ANCHOR }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("blocks writes on a CONCLUDED attempt", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(scheduleRow({ sessionStatus: "CONCLUDED" }));
    await expect(
      svc.createAnnotation("sched-1", "u-PANELIST", { thesisDocumentId: "doc-1", anchor: VALID_ANCHOR }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("blocks writes on a CANCELLED attempt", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(scheduleRow({ sessionStatus: "CANCELLED" }));
    await expect(
      svc.createAnnotation("sched-1", "u-PANELIST", { thesisDocumentId: "doc-1", anchor: VALID_ANCHOR }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  // ---- Report read model / draft ----------------------------------------

  it("returns a legacy fallback when no collaborative body exists", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(
      scheduleRow({
        sessionStatus: "AWAITING_CONCLUSION",
        rapporteurNotes: "legacy notes",
        rapReports: [rapRow({ status: "FOR_SIGNATURE", decisionsAndRecommendations: "legacy body" })],
      }),
    );
    const model = await svc.getReportReadModel("sched-1", "u-PANELIST");
    expect(model.hasCollaborativeBody).toBe(false);
    expect(model.legacyContent.decisionsAndRecommendations).toBe("legacy body");
    expect(model.legacyContent.rapporteurNotes).toBe("legacy notes");
  });

  it("allows only the assigned Rapporteur to edit the report body", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(scheduleRow({ rapReports: [rapRow()] }));
    prismaMock.panelAssignment.findFirst.mockResolvedValue(assignmentRow("PANELIST"));
    await expect(svc.saveReportDraft("sched-1", "u-PANELIST", VALID_BODY)).rejects.toMatchObject({ statusCode: 403 });
  });

  it("saves a Rapporteur draft and returns the persisted body version", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(scheduleRow({ rapReports: [rapRow({ bodyVersion: 2 })] }));
    prismaMock.panelAssignment.findFirst.mockResolvedValue(assignmentRow("RAPPORTEUR"));
    prismaMock.rapReport.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.rapReport.findUnique.mockResolvedValue({ bodyVersion: 7 });
    await expect(svc.saveReportDraft("sched-1", "u-RAPPORTEUR", VALID_BODY)).resolves.toEqual({
      saved: true,
      bodyVersion: 7,
    });
    expect(prismaMock.rapReport.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ bodyVersion: { increment: 1 } }) }),
    );
  });

  it("CDW-5: creates an editable DRAFT report when none exists (assigned Rapporteur)", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(scheduleRow({ rapReports: [] }));
    prismaMock.panelAssignment.findFirst.mockResolvedValue(assignmentRow("RAPPORTEUR"));
    prismaMock.rapReport.create.mockResolvedValue({ id: "rap-1", bodyVersion: 1 });
    await expect(svc.saveReportDraft("sched-1", "u-RAPPORTEUR", VALID_BODY)).resolves.toEqual({
      saved: true,
      bodyVersion: 1,
    });
    expect(prismaMock.rapReport.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          scheduleId: "sched-1",
          status: "DRAFT",
          bodyVersion: 1,
        }),
      }),
    );
  });

  it("CDW-5: concurrent first-save converges via unique(scheduleId) (P2002 → update)", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(scheduleRow({ rapReports: [] }));
    prismaMock.panelAssignment.findFirst.mockResolvedValue(assignmentRow("RAPPORTEUR"));
    prismaMock.rapReport.create.mockRejectedValue({ code: "P2002" });
    prismaMock.rapReport.findUnique.mockResolvedValue({
      id: "rap-1",
      status: "DRAFT",
      frozenAt: null,
      bodyVersion: 1,
    });
    prismaMock.rapReport.updateMany.mockResolvedValue({ count: 1 });
    await expect(svc.saveReportDraft("sched-1", "u-RAPPORTEUR", VALID_BODY)).resolves.toMatchObject({
      saved: true,
    });
  });

  it("CDW-5: stale expectedBodyVersion returns 409 and never silently overwrites", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(scheduleRow({ rapReports: [rapRow({ bodyVersion: 5 })] }));
    prismaMock.panelAssignment.findFirst.mockResolvedValue(assignmentRow("RAPPORTEUR"));
    prismaMock.rapReport.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      svc.saveReportDraft("sched-1", "u-RAPPORTEUR", VALID_BODY, 4),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(prismaMock.rapReport.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ bodyVersion: 4 }) }),
    );
  });

  it("CDW-5: save only touches RapReport (no verdict/evaluation mutation)", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(scheduleRow({ rapReports: [rapRow({ bodyVersion: 1 })] }));
    prismaMock.panelAssignment.findFirst.mockResolvedValue(assignmentRow("RAPPORTEUR"));
    prismaMock.rapReport.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.rapReport.findUnique.mockResolvedValue({ bodyVersion: 2 });
    await svc.saveReportDraft("sched-1", "u-RAPPORTEUR", VALID_BODY);
    expect(prismaMock.rapReport.updateMany).toHaveBeenCalledTimes(1);
  });

  it("CDW-5: read model exposes compact system context for the Rapporteur editor", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(
      scheduleRow({ rapReports: [rapRow({ bodyDocument: VALID_BODY })] }),
    );
    prismaMock.panelAssignment.findFirst.mockResolvedValue(assignmentRow("RAPPORTEUR"));
    const model = await svc.getReportReadModel("sched-1", "u-RAPPORTEUR");
    expect(model.studentName).toBe("Ana Cruz");
    expect(model.studentNumber).toBe("2020-001");
    expect(model.program).toBe("MSIT");
    expect(model.defenseDate).toBe("2026-10-20T00:00:00.000Z");
    expect(model.body).toEqual(VALID_BODY);
    expect(model.canEditBody).toBe(true);
  });

  it("CDW-5: an editable empty DRAFT is offered to the assigned Rapporteur before any save", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(scheduleRow({ rapReports: [] }));
    prismaMock.panelAssignment.findFirst.mockResolvedValue(assignmentRow("RAPPORTEUR"));
    const model = await svc.getReportReadModel("sched-1", "u-RAPPORTEUR");
    expect(model.canEditBody).toBe(true);
    expect(model.reportId).toBeNull();
    expect(model.hasCollaborativeBody).toBe(false);
    expect(model.reportStatus).toBe("NOT_CREATED");
  });

  it("CDW-5: read-only roles never get an editable empty report", async () => {
    for (const role of ["CHAIRMAN", "PANELIST", "ADVISER", "FACILITATOR"]) {
      prismaMock.defenseSchedule.findUnique.mockResolvedValue(scheduleRow({ rapReports: [] }));
      prismaMock.panelAssignment.findFirst.mockResolvedValue(assignmentRow(role));
      const model = await svc.getReportReadModel("sched-1", `u-${role}`);
      expect(model.canEditBody).toBe(false);
    }
  });

  it("rejects a draft edit when the report is not DRAFT (frozen)", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(scheduleRow({ rapReports: [rapRow({ status: "FOR_SIGNATURE" })] }));
    prismaMock.panelAssignment.findFirst.mockResolvedValue(assignmentRow("RAPPORTEUR"));
    await expect(svc.saveReportDraft("sched-1", "u-RAPPORTEUR", VALID_BODY)).rejects.toMatchObject({ statusCode: 409 });
  });

  it("rejects a draft edit on a CONCLUDED attempt", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(scheduleRow({ sessionStatus: "CONCLUDED", rapReports: [rapRow()] }));
    prismaMock.panelAssignment.findFirst.mockResolvedValue(assignmentRow("RAPPORTEUR"));
    await expect(svc.saveReportDraft("sched-1", "u-RAPPORTEUR", VALID_BODY)).rejects.toMatchObject({ statusCode: 409 });
  });

  it("rejects an invalid report document with 400", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(scheduleRow({ rapReports: [rapRow()] }));
    prismaMock.panelAssignment.findFirst.mockResolvedValue(assignmentRow("RAPPORTEUR"));
    await expect(
      svc.saveReportDraft("sched-1", "u-RAPPORTEUR", { type: "doc", content: [{ type: "blockquote" }] }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  // ---- Freeze / hash -----------------------------------------------------

  it("freezes a draft report: sets FOR_SIGNATURE, frozenAt/By, contentVersion, and a server hash", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(scheduleRow({ rapReports: [rapRow({ bodyDocument: VALID_BODY })] }));
    prismaMock.panelAssignment.findFirst.mockResolvedValue(assignmentRow("RAPPORTEUR"));
    prismaMock.rapReport.updateMany.mockResolvedValue({ count: 1 });

    const result = await svc.freezeReportForSignatures("sched-1", "u-RAPPORTEUR");
    expect(result).toMatchObject({ frozen: true, alreadyFrozen: false, status: "FOR_SIGNATURE", contentVersion: 1 });
    expect(result.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(prismaMock.rapReport.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "FOR_SIGNATURE",
          frozenById: "u-RAPPORTEUR",
          frozenContentHash: result.contentHash,
        }),
      }),
    );
  });

  it("hashes the complete signing snapshot deterministically and includes fixed metadata", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-20T01:00:00.000Z"));
    try {
      prismaMock.panelAssignment.findFirst.mockResolvedValue(assignmentRow("RAPPORTEUR"));
      prismaMock.rapReport.updateMany.mockResolvedValue({ count: 1 });
      const freezeWith = async (venue: string) => {
        prismaMock.defenseSchedule.findUnique.mockResolvedValue(
          scheduleRow({ venueOrLink: venue, rapReports: [rapRow({ bodyDocument: VALID_BODY })] }),
        );
        return svc.freezeReportForSignatures("sched-1", "u-RAPPORTEUR");
      };
      const a = await freezeWith("Room A");
      const b = await freezeWith("Room A");
      const c = await freezeWith("Room B");
      expect(a.contentHash).toBe(b.contentHash);
      expect(a.contentHash).not.toBe(c.contentHash);
    } finally {
      vi.useRealTimers();
    }
  });

  it("is idempotent: a second freeze never replaces the existing snapshot", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(
      scheduleRow({ rapReports: [rapRow({ status: "FOR_SIGNATURE", frozenAt: new Date(), frozenContentHash: "a".repeat(64) })] }),
    );
    prismaMock.panelAssignment.findFirst.mockResolvedValue(assignmentRow("RAPPORTEUR"));

    const result = await svc.freezeReportForSignatures("sched-1", "u-RAPPORTEUR");
    expect(result).toMatchObject({ frozen: true, alreadyFrozen: true, contentHash: "a".repeat(64) });
    expect(prismaMock.rapReport.updateMany).not.toHaveBeenCalled();
  });

  it("rejects freezing when the report has no body content", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(scheduleRow({ rapReports: [rapRow({ bodyDocument: null })] }));
    prismaMock.panelAssignment.findFirst.mockResolvedValue(assignmentRow("RAPPORTEUR"));
    await expect(svc.freezeReportForSignatures("sched-1", "u-RAPPORTEUR")).rejects.toMatchObject({ statusCode: 409 });
  });

  // ---- Conclusion readiness ---------------------------------------------

  it("returns conclusion-readiness facts (blockers) without inventing a verdict", async () => {
    prismaMock.panelAssignment.findFirst.mockResolvedValue(assignmentRow("CHAIRMAN"));
    prismaMock.defenseSchedule.findUnique.mockResolvedValue({
      ...scheduleRow({ sessionStatus: "AWAITING_CONCLUSION" }),
      panelAssignments: [
        { id: "pa-CHAIRMAN", userId: "u-CHAIRMAN", role: "CHAIRMAN" },
        { id: "pa-PANELIST", userId: "u-PANELIST", role: "PANELIST" },
      ],
      oralExamScores: [
        { panelId: "pa-CHAIRMAN", status: "FINALIZED" },
        { panelId: "pa-PANELIST", status: "DRAFT" },
      ],
      oralExamSummary: null,
      conclusion: null,
      rapReports: [rapRow({ status: "FOR_SIGNATURE", frozenAt: new Date(), signatures: [] })],
    });

    const readiness = await svc.getConclusionReadiness("sched-1", "u-CHAIRMAN");
    expect(readiness.isChairman).toBe(true);
    expect(readiness.evaluatorAssignments).toBe(2);
    expect(readiness.finalizedEvaluations).toBe(1);
    expect(readiness.allEvaluationsFinalized).toBe(false);
    expect(readiness.readyForConclusion).toBe(false);
    expect(readiness.blockers.join(" ")).toMatch(/evaluations are finalized/i);
  });
});

describe("DefenseCollaborationService (CDW-1 final-review fixes)", () => {
  const svc = new DefenseCollaborationService();

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(scheduleRow());
    prismaMock.panelAssignment.findFirst.mockResolvedValue(assignmentRow("RAPPORTEUR"));
    prismaMock.thesisDocument.findUnique.mockResolvedValue(documentRow());
    prismaMock.thesisDocument.findFirst.mockResolvedValue(documentRow());
    ensureSummary.mockResolvedValue({
      created: false,
      summaryId: "sum-1",
      evaluatorCount: 1,
      overallAverage: 0,
      finalRating: null,
    });
  });

  it("pins the freeze to the exact read body version (a concurrent save cannot desync the hash)", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(
      scheduleRow({ rapReports: [rapRow({ bodyDocument: VALID_BODY, bodyVersion: 4 })] }),
    );
    prismaMock.rapReport.updateMany.mockResolvedValue({ count: 1 });
    await svc.freezeReportForSignatures("sched-1", "u-RAPPORTEUR");
    expect(prismaMock.rapReport.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ bodyVersion: 4 }) }),
    );
  });

  it("treats an empty/whitespace parentCommentId as no parent (no FK error)", async () => {
    prismaMock.defenseAnnotation.findUnique.mockResolvedValue({ id: "ann-1", scheduleId: "sched-1" });
    prismaMock.defenseAnnotationComment.create.mockResolvedValue({
      id: "c-1",
      annotationId: "ann-1",
      parentCommentId: null,
      body: "x",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-01T00:00:00Z"),
      author: { id: "pa-RAPPORTEUR", userId: "u-RAPPORTEUR", role: "RAPPORTEUR", user: { firstName: "R", lastName: "P" } },
    });
    await svc.createComment("sched-1", "u-RAPPORTEUR", { annotationId: "ann-1", body: "x", parentCommentId: "" });
    expect(prismaMock.defenseAnnotationComment.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.defenseAnnotationComment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ parentCommentId: null }) }),
    );
  });

  it("rejects a report draft while the session status is not writable (UNSCHEDULED)", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(
      scheduleRow({ sessionStatus: "UNSCHEDULED", rapReports: [rapRow()] }),
    );
    await expect(svc.saveReportDraft("sched-1", "u-RAPPORTEUR", VALID_BODY)).rejects.toMatchObject({
      statusCode: 409,
    });
  });
});

describe("DefenseCollaborationService — CDW-1 corrections", () => {
  const svc = new DefenseCollaborationService();

  function setStage(defenseType: string) {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(
      scheduleRow({ defenseType, rapReports: [rapRow({ status: "DRAFT", bodyDocument: VALID_BODY })] }),
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.panelAssignment.findFirst.mockResolvedValue(assignmentRow("PANELIST"));
    prismaMock.thesisDocument.findFirst.mockResolvedValue(documentRow());
    prismaMock.adviserCertification.findFirst.mockResolvedValue(null);
    ensureSummary.mockResolvedValue({
      created: false,
      summaryId: "sum-1",
      evaluatorCount: 1,
      overallAverage: 0,
      finalRating: null,
    });
  });

  // ---- Fix 1: Proposal/Final certified manuscript authority ----

  it("allows the exact certified Proposal manuscript", async () => {
    setStage("PROPOSAL_DEFENSE");
    prismaMock.thesisDocument.findUnique.mockResolvedValue(
      documentRow({ defenseStage: "PROPOSAL", docType: "PROPOSAL_CHAPTERS", isCurrent: true }),
    );
    prismaMock.adviserCertification.findFirst.mockResolvedValue(
      certRow({ defenseStage: "PROPOSAL_DEFENSE", reviewedDocumentId: "doc-1" }),
    );
    await expect(
      svc.createAnnotation("sched-1", "u-PANELIST", { thesisDocumentId: "doc-1", anchor: VALID_ANCHOR }),
    ).resolves.toBeDefined();
  });

  it("rejects a newer current-but-uncertified Proposal manuscript (the cert points elsewhere)", async () => {
    setStage("PROPOSAL_DEFENSE");
    prismaMock.thesisDocument.findUnique.mockResolvedValue(
      documentRow({ id: "doc-B", defenseStage: "PROPOSAL", docType: "PROPOSAL_CHAPTERS", isCurrent: true }),
    );
    prismaMock.adviserCertification.findFirst.mockResolvedValue(
      certRow({ defenseStage: "PROPOSAL_DEFENSE", reviewedDocumentId: "doc-A" }),
    );
    await expect(
      svc.createAnnotation("sched-1", "u-PANELIST", { thesisDocumentId: "doc-B", anchor: VALID_ANCHOR }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("allows the exact certified Final manuscript", async () => {
    setStage("FINAL_DEFENSE");
    prismaMock.thesisDocument.findUnique.mockResolvedValue(
      documentRow({ defenseStage: "FINAL", docType: "FINAL_MANUSCRIPT", isCurrent: true }),
    );
    prismaMock.adviserCertification.findFirst.mockResolvedValue(
      certRow({ defenseStage: "FINAL_DEFENSE", reviewedDocumentId: "doc-1" }),
    );
    await expect(
      svc.createAnnotation("sched-1", "u-PANELIST", { thesisDocumentId: "doc-1", anchor: VALID_ANCHOR }),
    ).resolves.toBeDefined();
  });

  it("rejects a newer current-but-uncertified Final manuscript", async () => {
    setStage("FINAL_DEFENSE");
    prismaMock.thesisDocument.findUnique.mockResolvedValue(
      documentRow({ id: "doc-B", defenseStage: "FINAL", docType: "FINAL_MANUSCRIPT", isCurrent: true }),
    );
    prismaMock.adviserCertification.findFirst.mockResolvedValue(
      certRow({ defenseStage: "FINAL_DEFENSE", reviewedDocumentId: "doc-A" }),
    );
    await expect(
      svc.createAnnotation("sched-1", "u-PANELIST", { thesisDocumentId: "doc-B", anchor: VALID_ANCHOR }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("treats the certified manuscript as authoritative even when a newer revision exists", async () => {
    setStage("FINAL_DEFENSE");
    prismaMock.thesisDocument.findUnique.mockResolvedValue(
      documentRow({ defenseStage: "FINAL", docType: "FINAL_MANUSCRIPT", isCurrent: false }),
    );
    prismaMock.adviserCertification.findFirst.mockResolvedValue(
      certRow({ defenseStage: "FINAL_DEFENSE", reviewedDocumentId: "doc-1" }),
    );
    await expect(
      svc.createAnnotation("sched-1", "u-PANELIST", { thesisDocumentId: "doc-1", anchor: VALID_ANCHOR }),
    ).resolves.toBeDefined();
  });

  it("rejects a Title proposal that is not the current authoritative package", async () => {
    setStage("TITLE_DEFENSE");
    prismaMock.thesisDocument.findUnique.mockResolvedValue(documentRow({ id: "doc-1", isCurrent: true }));
    prismaMock.thesisDocument.findFirst.mockResolvedValue(documentRow({ id: "doc-other" }));
    await expect(
      svc.createAnnotation("sched-1", "u-PANELIST", { thesisDocumentId: "doc-1", anchor: VALID_ANCHOR }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("rejects a Proposal write when there is no valid ISSUED certification (fail closed)", async () => {
    setStage("PROPOSAL_DEFENSE");
    prismaMock.thesisDocument.findUnique.mockResolvedValue(
      documentRow({ defenseStage: "PROPOSAL", docType: "PROPOSAL_CHAPTERS" }),
    );
    prismaMock.adviserCertification.findFirst.mockResolvedValue(null);
    await expect(
      svc.createAnnotation("sched-1", "u-PANELIST", { thesisDocumentId: "doc-1", anchor: VALID_ANCHOR }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  // ---- Fix 2: historical read vs live write ----

  it("keeps attempt annotations readable after the manuscript becomes non-current", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(scheduleRow({ sessionStatus: "CONCLUDED" }));
    prismaMock.thesisDocument.findUnique.mockResolvedValue(documentRow({ isCurrent: false }));
    prismaMock.defenseAnnotation.findMany.mockResolvedValue([annotationRow()]);
    await expect(svc.listAnnotations("sched-1", "u-PANELIST", "doc-1")).resolves.toHaveLength(1);
  });

  it("does not let another thesis/schedule read annotations for this document", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(scheduleRow({ thesisId: "thesis-2" }));
    prismaMock.thesisDocument.findUnique.mockResolvedValue(documentRow({ thesisId: "thesis-1" }));
    await expect(svc.listAnnotations("sched-1", "u-PANELIST", "doc-1")).rejects.toMatchObject({ statusCode: 403 });
  });

  // ---- Fix 3: freeze readiness (evaluator + Summary) ----

  it("rejects freeze when required evaluations are incomplete (Summary cannot be ensured)", async () => {
    setStage("TITLE_DEFENSE");
    prismaMock.panelAssignment.findFirst.mockResolvedValue(assignmentRow("RAPPORTEUR"));
    ensureSummary.mockRejectedValue(
      new AppError(
        "All required evaluator evaluations must be finalized before the Oral Examination Summary can be generated.",
        409,
      ),
    );
    await expect(svc.freezeReportForSignatures("sched-1", "u-RAPPORTEUR")).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(prismaMock.rapReport.updateMany).not.toHaveBeenCalled();
  });

  it("freezes when all required evaluations are finalized and the Summary is available", async () => {
    setStage("TITLE_DEFENSE");
    prismaMock.panelAssignment.findFirst.mockResolvedValue(assignmentRow("RAPPORTEUR"));
    ensureSummary.mockResolvedValue({
      created: true,
      summaryId: "sum-1",
      evaluatorCount: 2,
      overallAverage: 0,
      finalRating: null,
    });
    prismaMock.rapReport.updateMany.mockResolvedValue({ count: 1 });
    await expect(svc.freezeReportForSignatures("sched-1", "u-RAPPORTEUR")).resolves.toMatchObject({
      frozen: true,
      status: "FOR_SIGNATURE",
    });
    // CDW-3 correction: Summary generation runs on the SAME transaction client
    // that owns the DefenseSchedule lock (tx === the shared mock here).
    expect(ensureSummary).toHaveBeenCalledWith("sched-1", prismaMock);
  });

  // ---- Fix 4: meaningful content ----

  it("rejects freezing an empty/whitespace-only report body", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(
      scheduleRow({
        rapReports: [
          rapRow({
            status: "DRAFT",
            bodyDocument: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "   " }] }] },
          }),
        ],
      }),
    );
    prismaMock.panelAssignment.findFirst.mockResolvedValue(assignmentRow("RAPPORTEUR"));
    await expect(svc.freezeReportForSignatures("sched-1", "u-RAPPORTEUR")).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(prismaMock.rapReport.updateMany).not.toHaveBeenCalled();
  });

  // ---- Fix 7: canEditBody read model ----

  it("reports canEditBody=false when the session is not writable", async () => {
    prismaMock.panelAssignment.findFirst.mockResolvedValue(assignmentRow("RAPPORTEUR"));
    for (const sessionStatus of ["UNSCHEDULED", "CONCLUDED", "CANCELLED"]) {
      prismaMock.defenseSchedule.findUnique.mockResolvedValue(
        scheduleRow({ sessionStatus, rapReports: [rapRow({ status: "DRAFT", bodyDocument: VALID_BODY })] }),
      );
      const model = await svc.getReportReadModel("sched-1", "u-RAPPORTEUR");
      expect(model.canEditBody).toBe(false);
    }
  });

  it("reports canEditBody only for an assigned Rapporteur on a writable DRAFT", async () => {
    prismaMock.panelAssignment.findFirst.mockResolvedValue(assignmentRow("RAPPORTEUR"));
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(
      scheduleRow({
        sessionStatus: "IN_PROGRESS",
        rapReports: [rapRow({ status: "FOR_SIGNATURE", frozenAt: new Date(), bodyDocument: VALID_BODY })],
      }),
    );
    expect((await svc.getReportReadModel("sched-1", "u-RAPPORTEUR")).canEditBody).toBe(false);

    prismaMock.defenseSchedule.findUnique.mockResolvedValue(
      scheduleRow({ sessionStatus: "IN_PROGRESS", rapReports: [rapRow({ status: "DRAFT", bodyDocument: VALID_BODY })] }),
    );
    expect((await svc.getReportReadModel("sched-1", "u-RAPPORTEUR")).canEditBody).toBe(true);

    prismaMock.panelAssignment.findFirst.mockResolvedValue(assignmentRow("PANELIST"));
    expect((await svc.getReportReadModel("sched-1", "u-PANELIST")).canEditBody).toBe(false);
  });
});

describe("DefenseCollaborationService — CDW-2 schedule manuscript binding", () => {
  const svc = new DefenseCollaborationService();

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.panelAssignment.findFirst.mockResolvedValue(assignmentRow("PANELIST"));
    prismaMock.defenseAnnotation.create.mockResolvedValue(annotationRow());
  });

  it("annotates only the manuscript bound to the attempt (ignores a newer/current doc)", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(
      scheduleRow({ defenseType: "PROPOSAL_DEFENSE", manuscriptDocumentId: "doc-A" }),
    );
    prismaMock.thesisDocument.findUnique.mockResolvedValue(
      documentRow({ id: "doc-A", defenseStage: "PROPOSAL", docType: "PROPOSAL_CHAPTERS" }),
    );
    await expect(
      svc.createAnnotation("sched-1", "u-PANELIST", { thesisDocumentId: "doc-A", anchor: VALID_ANCHOR }),
    ).resolves.toBeDefined();

    prismaMock.thesisDocument.findUnique.mockResolvedValue(
      documentRow({ id: "doc-B", defenseStage: "PROPOSAL", docType: "PROPOSAL_CHAPTERS", isCurrent: true }),
    );
    prismaMock.defenseAnnotation.create.mockClear();
    await expect(
      svc.createAnnotation("sched-1", "u-PANELIST", { thesisDocumentId: "doc-B", anchor: VALID_ANCHOR }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(prismaMock.defenseAnnotation.create).not.toHaveBeenCalled();
  });

  it("rejects a cross-attempt document even when it is current", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(
      scheduleRow({ defenseType: "TITLE_DEFENSE", manuscriptDocumentId: "doc-A" }),
    );
    prismaMock.thesisDocument.findUnique.mockResolvedValue(documentRow({ id: "doc-C", isCurrent: true }));
    await expect(
      svc.createAnnotation("sched-1", "u-PANELIST", { thesisDocumentId: "doc-C", anchor: VALID_ANCHOR }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("keeps the legacy (unbound) Title behaviour when no binding is present", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(scheduleRow({ manuscriptDocumentId: null }));
    prismaMock.thesisDocument.findUnique.mockResolvedValue(documentRow({ id: "doc-1" }));
    prismaMock.thesisDocument.findFirst.mockResolvedValue(documentRow({ id: "doc-1" }));
    await expect(
      svc.createAnnotation("sched-1", "u-PANELIST", { thesisDocumentId: "doc-1", anchor: VALID_ANCHOR }),
    ).resolves.toBeDefined();
  });
});

describe("DefenseCollaborationService — CDW-3 atomic highlight + initial comment", () => {
  const svc = new DefenseCollaborationService();

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(scheduleRow());
    prismaMock.panelAssignment.findFirst.mockResolvedValue(assignmentRow("PANELIST"));
    prismaMock.thesisDocument.findUnique.mockResolvedValue(documentRow());
    prismaMock.thesisDocument.findFirst.mockResolvedValue(documentRow());
    prismaMock.adviserCertification.findFirst.mockResolvedValue(null);
  });

  /** Mirrors the real nested create: returns the embedded comments array. */
  function mockNestedCreate() {
    prismaMock.defenseAnnotation.create.mockImplementation(
      async (args: { data: Record<string, unknown> }) => {
        const nested = (args.data.comments as { create?: { body: string } } | undefined)
          ?.create;
        return {
          ...annotationRow(),
          ...args.data,
          comments: nested
            ? [
                {
                  id: "c-1",
                  annotationId: "ann-1",
                  parentCommentId: null,
                  body: nested.body,
                  createdAt: new Date("2026-01-01T00:00:00Z"),
                  updatedAt: new Date("2026-01-01T00:00:00Z"),
                  author: {
                    id: "pa-PANELIST",
                    userId: "u-PANELIST",
                    role: "PANELIST",
                    user: { firstName: "P", lastName: "N" },
                  },
                },
              ]
            : [],
          author: {
            id: args.data.authorAssignmentId,
            userId: "u-PANELIST",
            role: "PANELIST",
            user: { firstName: "P", lastName: "N" },
          },
        };
      },
    );
  }

  it("creates the annotation and its initial comment in ONE atomic write (no second request)", async () => {
    mockNestedCreate();
    const dto = await svc.createAnnotation("sched-1", "u-PANELIST", {
      thesisDocumentId: "doc-1",
      anchor: VALID_ANCHOR,
      initialComment: "  First thought  ",
    });

    expect(dto.comments.map((c) => c.body)).toEqual(["First thought"]);
    expect(dto.comments[0].author.role).toBe("PANELIST");

    const call = prismaMock.defenseAnnotation.create.mock.calls[0][0] as {
      data: { comments: { create: { body: string; authorAssignmentId: string } } };
    };
    expect(call.data.comments.create.body).toBe("First thought");
    expect(call.data.comments.create.authorAssignmentId).toBe("pa-PANELIST");
    // One create call = atomic; the separate comment endpoint is not used.
    expect(prismaMock.defenseAnnotation.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.defenseAnnotationComment.create).not.toHaveBeenCalled();
  });

  it("rejects an empty/whitespace initial comment with 400 and persists nothing (no orphan)", async () => {
    await expect(
      svc.createAnnotation("sched-1", "u-PANELIST", {
        thesisDocumentId: "doc-1",
        anchor: VALID_ANCHOR,
        initialComment: "   ",
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(prismaMock.defenseAnnotation.create).not.toHaveBeenCalled();
    expect(prismaMock.defenseAnnotationComment.create).not.toHaveBeenCalled();
  });

  it("rejects an over-length initial comment with 400 and persists nothing", async () => {
    await expect(
      svc.createAnnotation("sched-1", "u-PANELIST", {
        thesisDocumentId: "doc-1",
        anchor: VALID_ANCHOR,
        initialComment: "x".repeat(5001),
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(prismaMock.defenseAnnotation.create).not.toHaveBeenCalled();
  });

  it("rejects a non-string initial comment with 400", async () => {
    await expect(
      svc.createAnnotation("sched-1", "u-PANELIST", {
        thesisDocumentId: "doc-1",
        anchor: VALID_ANCHOR,
        initialComment: 123,
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(prismaMock.defenseAnnotation.create).not.toHaveBeenCalled();
  });

  it("still creates a plain annotation without an initial comment (backwards compatible)", async () => {
    mockNestedCreate();
    const dto = await svc.createAnnotation("sched-1", "u-PANELIST", {
      thesisDocumentId: "doc-1",
      anchor: VALID_ANCHOR,
    });
    expect(dto.comments).toEqual([]);
    const call = prismaMock.defenseAnnotation.create.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(call.data.comments).toBeUndefined();
  });

  it("leaves no orphan annotation when the atomic create fails", async () => {
    prismaMock.defenseAnnotation.create.mockRejectedValue(new Error("db down"));
    await expect(
      svc.createAnnotation("sched-1", "u-PANELIST", {
        thesisDocumentId: "doc-1",
        anchor: VALID_ANCHOR,
        initialComment: "hello",
      }),
    ).rejects.toThrow();
    expect(prismaMock.defenseAnnotationComment.create).not.toHaveBeenCalled();
  });
});

describe("DefenseCollaborationService — CDW-3 freeze/write serialization", () => {
  const svc = new DefenseCollaborationService();

  function frozenRap() {
    return rapRow({
      status: "FOR_SIGNATURE",
      frozenAt: new Date("2026-10-20T00:00:00Z"),
      frozenContentHash: "a".repeat(64),
    });
  }

  function writableSchedule() {
    return scheduleRow({ rapReports: [rapRow({ status: "DRAFT" })] });
  }

  function mockAnnotationCreate() {
    prismaMock.defenseAnnotation.create.mockResolvedValue(annotationRow());
  }

  beforeEach(() => {
    vi.clearAllMocks();
    // clearAllMocks keeps implementations, so re-establish the lock mock cleanly
    // (the race tests override $queryRaw to simulate a freeze winning).
    prismaMock.$transaction.mockImplementation(
      async (fn: (tx: typeof prismaMock) => unknown) => fn(prismaMock),
    );
    prismaMock.$queryRaw.mockReset();
    prismaMock.$queryRaw.mockResolvedValue([]);
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(writableSchedule());
    prismaMock.panelAssignment.findFirst.mockResolvedValue(assignmentRow("PANELIST"));
    prismaMock.thesisDocument.findUnique.mockResolvedValue(documentRow());
    prismaMock.thesisDocument.findFirst.mockResolvedValue(documentRow());
    prismaMock.adviserCertification.findFirst.mockResolvedValue(null);
    prismaMock.defenseAnnotation.findUnique.mockResolvedValue({ id: "ann-1", scheduleId: "sched-1" });
    prismaMock.defenseAnnotationComment.create.mockResolvedValue({
      id: "c-9",
      annotationId: "ann-1",
      parentCommentId: null,
      body: "reply",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-01T00:00:00Z"),
      author: { id: "pa-PANELIST", userId: "u-PANELIST", role: "PANELIST", user: { firstName: "P", lastName: "N" } },
    });
    prismaMock.rapReport.updateMany.mockResolvedValue({ count: 1 });
    ensureSummary.mockResolvedValue({
      created: false,
      summaryId: "sum-1",
      evaluatorCount: 1,
      overallAverage: 0,
      finalRating: null,
    });
  });

  function expectAttemptLockAcquired() {
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
    const strings = prismaMock.$queryRaw.mock.calls[0][0] as unknown as TemplateStringsArray;
    const sql = Array.from(strings).join("");
    expect(sql).toMatch(/defense_schedules/);
    expect(sql).toMatch(/FOR UPDATE/);
  }

  it("serializes annotation creation under the per-attempt lock", async () => {
    mockAnnotationCreate();
    await svc.createAnnotation("sched-1", "u-PANELIST", {
      thesisDocumentId: "doc-1",
      anchor: VALID_ANCHOR,
      initialComment: "hello",
    });
    expectAttemptLockAcquired();
  });

  it("serializes comment creation under the per-attempt lock", async () => {
    await svc.createComment("sched-1", "u-PANELIST", { annotationId: "ann-1", body: "reply" });
    expectAttemptLockAcquired();
  });

  it("serializes RAP freeze under the SAME per-attempt lock", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(
      scheduleRow({ rapReports: [rapRow({ bodyDocument: VALID_BODY })] }),
    );
    prismaMock.panelAssignment.findFirst.mockResolvedValue(assignmentRow("RAPPORTEUR"));
    await svc.freezeReportForSignatures("sched-1", "u-RAPPORTEUR");
    expectAttemptLockAcquired();
  });

  it("generates the Oral Examination Summary on the SAME transaction client as the freeze", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(
      scheduleRow({ rapReports: [rapRow({ bodyDocument: VALID_BODY })] }),
    );
    prismaMock.panelAssignment.findFirst.mockResolvedValue(assignmentRow("RAPPORTEUR"));
    await svc.freezeReportForSignatures("sched-1", "u-RAPPORTEUR");
    // The active tx (the shared mock here) is handed to the Summary service.
    expect(ensureSummary).toHaveBeenCalledWith("sched-1", prismaMock);
    expect(prismaMock.rapReport.updateMany).toHaveBeenCalled();
  });

  it("rejects an annotation when the RAP froze before the locked read (freeze won the race)", async () => {
    // Simulate the freeze committing between request start and lock acquisition:
    // the FOR UPDATE acquisition now observes a frozen RAP.
    prismaMock.$queryRaw.mockImplementation(async () => {
      prismaMock.defenseSchedule.findUnique.mockResolvedValue(
        scheduleRow({ rapReports: [frozenRap()] }),
      );
      return [];
    });
    await expect(
      svc.createAnnotation("sched-1", "u-PANELIST", {
        thesisDocumentId: "doc-1",
        anchor: VALID_ANCHOR,
        initialComment: "should not persist",
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(prismaMock.defenseAnnotation.create).not.toHaveBeenCalled();
  });

  it("rejects a comment when the RAP froze before the locked read (freeze won the race)", async () => {
    prismaMock.$queryRaw.mockImplementation(async () => {
      prismaMock.defenseSchedule.findUnique.mockResolvedValue(
        scheduleRow({ rapReports: [frozenRap()] }),
      );
      return [];
    });
    await expect(
      svc.createComment("sched-1", "u-PANELIST", { annotationId: "ann-1", body: "late" }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(prismaMock.defenseAnnotationComment.create).not.toHaveBeenCalled();
  });

  it("allows a pre-freeze comment to commit; a subsequent freeze still succeeds", async () => {
    // Case A: comment acquires the lock first on a writable DRAFT.
    await expect(
      svc.createComment("sched-1", "u-PANELIST", { annotationId: "ann-1", body: "pre-freeze" }),
    ).resolves.toMatchObject({ id: "c-9" });
    expect(prismaMock.rapReport.updateMany).not.toHaveBeenCalled();

    // The comment is valid pre-freeze history; freeze then proceeds.
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(
      scheduleRow({ rapReports: [rapRow({ bodyDocument: VALID_BODY })] }),
    );
    prismaMock.panelAssignment.findFirst.mockResolvedValue(assignmentRow("RAPPORTEUR"));
    await expect(svc.freezeReportForSignatures("sched-1", "u-RAPPORTEUR")).resolves.toMatchObject({
      frozen: true,
      status: "FOR_SIGNATURE",
    });
  });
});
