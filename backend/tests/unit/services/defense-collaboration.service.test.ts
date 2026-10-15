import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  defenseSchedule: { findUnique: vi.fn() },
  panelAssignment: { findFirst: vi.fn() },
  thesisDocument: { findUnique: vi.fn() },
  defenseAnnotation: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
  defenseAnnotationComment: { findUnique: vi.fn(), create: vi.fn() },
  rapReport: { updateMany: vi.fn(), findUnique: vi.fn() },
}));

vi.mock("../../../src/config/database", () => ({ default: prismaMock }));

import { DefenseCollaborationService } from "../../../src/services/defense-collaboration.service";

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
    rapporteurNotes: null,
    thesis: { student: { user: { firstName: "Ana", lastName: "Cruz" } } },
    rapReports: [] as unknown[],
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

  it("saves a Rapporteur draft and increments the body version", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(scheduleRow({ rapReports: [rapRow({ bodyVersion: 2 })] }));
    prismaMock.panelAssignment.findFirst.mockResolvedValue(assignmentRow("RAPPORTEUR"));
    prismaMock.rapReport.updateMany.mockResolvedValue({ count: 1 });
    await expect(svc.saveReportDraft("sched-1", "u-RAPPORTEUR", VALID_BODY)).resolves.toEqual({
      saved: true,
      bodyVersion: 3,
    });
    expect(prismaMock.rapReport.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ bodyVersion: { increment: 1 } }) }),
    );
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

  it("produces a deterministic frozen hash regardless of source key order", async () => {
    prismaMock.panelAssignment.findFirst.mockResolvedValue(assignmentRow("RAPPORTEUR"));
    prismaMock.rapReport.updateMany.mockResolvedValue({ count: 1 });

    const bodyA = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "z", marks: ["underline", "bold"] }] }] };
    const bodyB = { content: [{ content: [{ marks: ["bold", "underline"], text: "z", type: "text" }], type: "paragraph" }], type: "doc" };

    prismaMock.defenseSchedule.findUnique.mockResolvedValueOnce(scheduleRow({ rapReports: [rapRow({ bodyDocument: bodyA })] }));
    const first = await svc.freezeReportForSignatures("sched-1", "u-RAPPORTEUR");
    prismaMock.defenseSchedule.findUnique.mockResolvedValueOnce(scheduleRow({ rapReports: [rapRow({ bodyDocument: bodyB })] }));
    const second = await svc.freezeReportForSignatures("sched-1", "u-RAPPORTEUR");

    expect(first.contentHash).toBe(second.contentHash);
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
