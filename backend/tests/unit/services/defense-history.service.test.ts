import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  defenseSchedule: { findUnique: vi.fn(), findMany: vi.fn() },
  panelAssignment: { findFirst: vi.fn() },
  defenseAnnotation: { findMany: vi.fn() },
}));

vi.mock("../../../src/config/database", () => ({ default: prismaMock }));

import { DefenseHistoryService } from "../../../src/services/defense-history.service";

const CURRENT_ID = "sched-prop-2";

function currentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: CURRENT_ID,
    thesisId: "thesis-1",
    defenseType: "PROPOSAL_DEFENSE",
    defenseDate: new Date("2026-09-15T00:00:00Z"),
    createdAt: new Date("2026-08-20T00:00:00Z"),
    ...overrides,
  };
}

function concludedRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "sched-prop-1",
    thesisId: "thesis-1",
    defenseType: "PROPOSAL_DEFENSE",
    sessionStatus: "CONCLUDED",
    defenseDate: new Date("2026-07-01T00:00:00Z"),
    defenseTime: new Date("1970-01-01T09:00:00Z"),
    venueOrLink: "Room 2",
    createdAt: new Date("2026-06-01T00:00:00Z"),
    manuscriptDocumentId: "doc-prop-1",
    manuscriptDocument: {
      id: "doc-prop-1",
      thesisId: "thesis-1",
      docType: "PROPOSAL_CHAPTERS",
      defenseStage: "PROPOSAL",
      uploadedAt: new Date("2026-06-15T00:00:00Z"),
    },
    conclusion: {
      outcome: "REDEFENSE_REQUIRED",
      concludedAt: new Date("2026-07-05T00:00:00Z"),
    },
    panelAssignments: [
      {
        userId: "old-panelist",
        role: "PANELIST",
        user: { firstName: "Old", lastName: "Member" },
      },
      {
        userId: "old-rapporteur",
        role: "RAPPORTEUR",
        user: { firstName: "Rita", lastName: "Reporter" },
      },
    ],
    rapReports: [
      {
        id: "rap-prop-1",
        status: "FINALIZED",
        finalizedAt: new Date("2026-07-04T00:00:00Z"),
        bodyDocument: { type: "doc", content: [] },
        decisionsAndRecommendations: "Revise sampling.",
        contentVersion: 3,
        signatures: [
          { required: true, isSigned: true, signatureData: "data:image/png;base64,SECRET" },
          { required: true, isSigned: false, signatureData: null },
        ],
      },
    ],
    _count: { annotations: 2 },
    ...overrides,
  };
}

const annotationsStub = {
  listAttemptAnnotationsForHistory: vi.fn().mockResolvedValue([
    {
      id: "ann-1",
      scheduleId: "sched-prop-1",
      thesisDocumentId: "doc-prop-1",
      pageNumber: 4,
      selectedText: "sampling",
      anchor: { anchorVersion: 1, pageNumber: 4, selectedText: "sampling", rects: [], prefix: "", suffix: "" },
      author: { assignmentId: "pa-old", userId: "old-panelist", name: "Old Member", role: "PANELIST" },
      createdAt: "2026-07-02T00:00:00.000Z",
      updatedAt: "2026-07-02T00:00:00.000Z",
      comments: [
        {
          id: "cmt-1",
          annotationId: "ann-1",
          parentCommentId: null,
          body: "Please clarify.",
          author: { assignmentId: "pa-old", userId: "old-panelist", name: "Old Member", role: "PANELIST" },
          createdAt: "2026-07-02T00:00:00.000Z",
          updatedAt: "2026-07-02T00:00:00.000Z",
        },
      ],
    },
  ]),
};

function makeService() {
  return new DefenseHistoryService(annotationsStub as never);
}

describe("CDW-6 DefenseHistoryService — current schedule history resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.panelAssignment.findFirst.mockResolvedValue({
      id: "pa-new",
      scheduleId: CURRENT_ID,
      userId: "new-panelist",
      role: "PANELIST",
    });
    prismaMock.defenseAnnotation.findMany.mockResolvedValue([
      { scheduleId: "sched-prop-1", _count: { comments: 3 } },
    ]);
  });

  it("A: Proposal re-defense — Attempt 2 resolves Attempt 1 (REDEFENSE_REQUIRED) as same-stage", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(currentRow());
    prismaMock.defenseSchedule.findMany.mockResolvedValue([currentRow(), concludedRow()]);

    const history = await makeService().getHistory(CURRENT_ID, "new-panelist");

    expect(history.items).toHaveLength(1);
    expect(history.items[0].scheduleId).toBe("sched-prop-1");
    expect(history.items[0].relationship).toBe("SAME_STAGE_REDEFENSE");
    expect(history.items[0].stage).toBe("PROPOSAL");
    expect(history.items[0].verdict).toBe("REDEFENSE_REQUIRED");
    expect(history.items[0].manuscript?.id).toBe("doc-prop-1");
    expect(history.items[0].annotationCount).toBe(2);
    expect(history.items[0].commentCount).toBe(3);
    expect(history.items[0].reportAvailable).toBe(true);
    expect(history.items[0].committee.map((c) => c.role)).toEqual(["PANELIST", "RAPPORTEUR"]);
  });

  it("B: Title re-defense — Attempt 2 resolves the prior concluded Title attempt", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(
      currentRow({ defenseType: "TITLE_DEFENSE" }),
    );
    prismaMock.defenseSchedule.findMany.mockResolvedValue([
      currentRow({ defenseType: "TITLE_DEFENSE" }),
      concludedRow({
        defenseType: "TITLE_DEFENSE",
        manuscriptDocumentId: "doc-title-1",
        manuscriptDocument: {
          id: "doc-title-1",
          thesisId: "thesis-1",
          docType: "TITLE_PROPOSAL",
          defenseStage: "TITLE",
          uploadedAt: new Date("2026-06-15T00:00:00Z"),
        },
      }),
    ]);

    const history = await makeService().getHistory(CURRENT_ID, "new-panelist");
    expect(history.items[0].relationship).toBe("SAME_STAGE_REDEFENSE");
    expect(history.items[0].stage).toBe("TITLE");
    expect(history.items[0].manuscript?.id).toBe("doc-title-1");
  });

  it("C: Final progression — the latest PASSED Proposal is the previous stage", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(
      currentRow({
        id: "sched-final-1",
        defenseType: "FINAL_DEFENSE",
        defenseDate: new Date("2026-11-01T00:00:00Z"),
      }),
    );
    prismaMock.defenseSchedule.findMany.mockResolvedValue([
      currentRow({ id: "sched-final-1", defenseType: "FINAL_DEFENSE", defenseDate: new Date("2026-11-01T00:00:00Z") }),
      concludedRow({
        id: "sched-prop-1",
        conclusion: { outcome: "REDEFENSE_REQUIRED", concludedAt: new Date("2026-07-05T00:00:00Z") },
      }),
      concludedRow({
        id: "sched-prop-2",
        defenseDate: new Date("2026-09-01T00:00:00Z"),
        conclusion: { outcome: "PASSED", concludedAt: new Date("2026-09-05T00:00:00Z") },
        manuscriptDocumentId: "doc-prop-2",
        manuscriptDocument: {
          id: "doc-prop-2",
          thesisId: "thesis-1",
          docType: "PROPOSAL_CHAPTERS",
          defenseStage: "PROPOSAL",
          uploadedAt: new Date("2026-08-20T00:00:00Z"),
        },
      }),
    ]);

    const history = await makeService().getHistory("sched-final-1", "new-panelist");
    expect(history.items.map((i) => i.scheduleId)).toEqual(["sched-prop-2", "sched-prop-1"]);
    expect(history.items[0].relationship).toBe("PREVIOUS_STAGE");
    expect(history.items[1].relationship).toBe("OLDER_HISTORY");
    expect(history.items[0].manuscript?.id).toBe("doc-prop-2");
  });

  it("D: exact attempt binding — never substitutes a newer/current document", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(currentRow());
    prismaMock.defenseSchedule.findMany.mockResolvedValue([
      currentRow(),
      concludedRow({
        // Bound id and included document disagree → the binding cannot be proven.
        manuscriptDocumentId: "doc-prop-1",
        manuscriptDocument: {
          id: "doc-prop-9-newest",
          thesisId: "thesis-1",
          docType: "PROPOSAL_CHAPTERS",
          defenseStage: "PROPOSAL",
          uploadedAt: new Date("2026-09-10T00:00:00Z"),
        },
      }),
    ]);

    const history = await makeService().getHistory(CURRENT_ID, "new-panelist");
    expect(history.items[0].manuscript).toBeNull();
  });

  it("M: legacy attempt without a bound manuscript renders unavailable (no latest fallback)", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(currentRow());
    prismaMock.defenseSchedule.findMany.mockResolvedValue([
      currentRow(),
      concludedRow({ manuscriptDocumentId: null, manuscriptDocument: null }),
    ]);

    const history = await makeService().getHistory(CURRENT_ID, "new-panelist");
    expect(history.items[0].manuscript).toBeNull();
    expect(history.items[0].reportAvailable).toBe(true);
  });

  it("E: authorization is the CURRENT assignment — a replacement Panelist sees history", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(currentRow());
    prismaMock.defenseSchedule.findMany.mockResolvedValue([currentRow(), concludedRow()]);

    const history = await makeService().getHistory(CURRENT_ID, "new-panelist");
    expect(history.items).toHaveLength(1);
    expect(prismaMock.panelAssignment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          scheduleId: CURRENT_ID,
          userId: "new-panelist",
          isActive: true,
        },
      }),
    );
  });

  it("H: a user not assigned to the CURRENT schedule is denied", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(currentRow());
    prismaMock.panelAssignment.findFirst.mockResolvedValue(null);

    await expect(makeService().getHistory(CURRENT_ID, "stranger")).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it("queries candidates only for the same thesis and never exposes evaluator scores", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(currentRow());
    prismaMock.defenseSchedule.findMany.mockResolvedValue([currentRow(), concludedRow()]);

    const history = await makeService().getHistory(CURRENT_ID, "new-panelist");
    const call = prismaMock.defenseSchedule.findMany.mock.calls[0][0];
    expect(call.where).toEqual({ thesisId: "thesis-1" });
    expect(JSON.stringify(history)).not.toContain("signatureData");
    expect(JSON.stringify(history)).not.toContain("SECRET");
  });
});

describe("CDW-6 correction — historical report provenance (legacy Rapporteur notes)", () => {
  const NOTES = "Revise Chapter 3 and clarify the sampling discussion.";
  const NOTES_FINALIZED = new Date("2026-07-04T00:00:00Z");

  beforeEach(() => {
    vi.clearAllMocks();
    annotationsStub.listAttemptAnnotationsForHistory.mockClear();
    prismaMock.panelAssignment.findFirst.mockResolvedValue({
      id: "pa-new",
      scheduleId: CURRENT_ID,
      userId: "new-panelist",
      role: "PANELIST",
    });
    prismaMock.defenseAnnotation.findMany.mockResolvedValue([]);
    // Default normalized candidate set; individual tests override with the row
    // they are exercising (detail now resolves against the full set).
    prismaMock.defenseSchedule.findMany.mockResolvedValue([currentRow(), concludedRow()]);
  });

  function withNotes(overrides: Record<string, unknown> = {}) {
    return concludedRow({
      rapReports: [],
      rapporteurNotes: NOTES,
      rapporteurNotesFinalizedAt: NOTES_FINALIZED,
      ...overrides,
    });
  }

  it("A: a concluded attempt with only finalized Rapporteur notes exposes legacy report availability", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(currentRow());
    prismaMock.defenseSchedule.findMany.mockResolvedValue([currentRow(), withNotes()]);

    const history = await makeService().getHistory(CURRENT_ID, "new-panelist");
    expect(history.items[0].reportAvailable).toBe(true);
    expect(history.items[0].reportSource).toBe("LEGACY_RAPPORTEUR_NOTES");
  });

  it("B/C/D/E: detail returns the exact notes, legacy provenance, no fabricated body or signatures", async () => {
    prismaMock.defenseSchedule.findUnique.mockImplementation(({ where }: { where: { id: string } }) =>
      Promise.resolve(where.id === CURRENT_ID ? currentRow() : withNotes({ id: where.id })),
    );

    const detail = await makeService().getHistoryDetail(CURRENT_ID, "sched-prop-1", "new-panelist");
    expect(detail.report?.source).toBe("LEGACY_RAPPORTEUR_NOTES");
    expect(detail.report?.text).toBe(NOTES);
    expect(detail.report?.bodyDocument).toBeNull();
    expect(detail.report?.signatureProgress).toBeNull();
    expect(detail.report?.rapId).toBeNull();
    expect(detail.report?.status).toBeNull();
    expect(detail.report?.rapporteurNotesFinalizedAt).toBe(NOTES_FINALIZED.toISOString());
    expect(detail.report?.finalizedAt).toBe(NOTES_FINALIZED.toISOString());
  });

  it("F: notes without a finalization timestamp are shown as historical notes, not a finalized RAP", async () => {
    prismaMock.defenseSchedule.findUnique.mockImplementation(({ where }: { where: { id: string } }) =>
      Promise.resolve(
        where.id === CURRENT_ID
          ? currentRow()
          : withNotes({ id: where.id, rapporteurNotesFinalizedAt: null }),
      ),
    );
    prismaMock.defenseSchedule.findMany.mockResolvedValue([
      currentRow(),
      withNotes({ id: "sched-prop-1", rapporteurNotesFinalizedAt: null }),
    ]);

    const detail = await makeService().getHistoryDetail(CURRENT_ID, "sched-prop-1", "new-panelist");
    expect(detail.report?.source).toBe("LEGACY_RAPPORTEUR_NOTES");
    expect(detail.report?.finalizedAt).toBeNull();
    expect(detail.report?.rapporteurNotesFinalizedAt).toBeNull();
    // No modern finalized/signature claim is made.
    expect(detail.report?.status).toBeNull();
    expect(detail.report?.signatureProgress).toBeNull();
  });

  it("G: a FINALIZED structured RAP is preferred over legacy notes", async () => {
    prismaMock.defenseSchedule.findUnique.mockImplementation(({ where }: { where: { id: string } }) =>
      Promise.resolve(
        where.id === CURRENT_ID
          ? currentRow()
          : concludedRow({
              id: where.id,
              rapporteurNotes: NOTES,
              rapporteurNotesFinalizedAt: NOTES_FINALIZED,
              rapReports: [
                {
                  id: "rap-structured",
                  status: "FINALIZED",
                  finalizedAt: new Date("2026-07-04T00:00:00Z"),
                  bodyDocument: { type: "doc", content: [] },
                  decisionsAndRecommendations: null,
                  contentVersion: 2,
                  signatures: [{ required: true, isSigned: true }],
                },
              ],
            }),
      ),
    );

    const detail = await makeService().getHistoryDetail(CURRENT_ID, "sched-prop-1", "new-panelist");
    expect(detail.report?.source).toBe("STRUCTURED_RAP");
    expect(detail.report?.rapId).toBe("rap-structured");
    expect(detail.report?.bodyDocument).toEqual({ type: "doc", content: [] });
    expect(detail.report?.text).toBeNull();
    expect(detail.report?.signatureProgress).toEqual({ required: 1, signed: 1 });
  });

  it("H: a FINALIZED legacy RAP text is preferred over schedule Rapporteur notes", async () => {
    prismaMock.defenseSchedule.findUnique.mockImplementation(({ where }: { where: { id: string } }) =>
      Promise.resolve(
        where.id === CURRENT_ID
          ? currentRow()
          : concludedRow({
              id: where.id,
              rapporteurNotes: NOTES,
              rapporteurNotesFinalizedAt: NOTES_FINALIZED,
              rapReports: [
                {
                  id: "rap-legacy-text",
                  status: "FINALIZED",
                  finalizedAt: new Date("2026-07-04T00:00:00Z"),
                  bodyDocument: null,
                  decisionsAndRecommendations: "Legacy RAP committee record.",
                  contentVersion: 0,
                  signatures: [],
                },
              ],
            }),
      ),
    );

    const detail = await makeService().getHistoryDetail(CURRENT_ID, "sched-prop-1", "new-panelist");
    expect(detail.report?.source).toBe("LEGACY_RAP_TEXT");
    expect(detail.report?.text).toBe("Legacy RAP committee record.");
    expect(detail.report?.bodyDocument).toBeNull();
    expect(detail.report?.rapId).toBe("rap-legacy-text");
  });

  it("I: a DRAFT modern RAP never masquerades as official history (legacy notes fallback only)", async () => {
    prismaMock.defenseSchedule.findUnique.mockImplementation(({ where }: { where: { id: string } }) =>
      Promise.resolve(
        where.id === CURRENT_ID
          ? currentRow()
          : concludedRow({
              id: where.id,
              rapporteurNotes: NOTES,
              rapporteurNotesFinalizedAt: NOTES_FINALIZED,
              rapReports: [
                {
                  id: "rap-draft",
                  status: "DRAFT",
                  finalizedAt: null,
                  bodyDocument: { type: "doc", content: [] },
                  decisionsAndRecommendations: "draft body",
                  contentVersion: 0,
                  signatures: [],
                },
              ],
            }),
      ),
    );

    const detail = await makeService().getHistoryDetail(CURRENT_ID, "sched-prop-1", "new-panelist");
    expect(detail.report?.source).toBe("LEGACY_RAPPORTEUR_NOTES");
    expect(detail.report?.rapId).toBeNull();
    expect(detail.report?.bodyDocument).toBeNull();
  });

  it("I2: a DRAFT modern RAP with no legacy notes yields no historical report", async () => {
    prismaMock.defenseSchedule.findUnique.mockImplementation(({ where }: { where: { id: string } }) =>
      Promise.resolve(
        where.id === CURRENT_ID
          ? currentRow()
          : concludedRow({
              id: where.id,
              rapporteurNotes: null,
              rapporteurNotesFinalizedAt: null,
              rapReports: [
                {
                  id: "rap-draft",
                  status: "DRAFT",
                  finalizedAt: null,
                  bodyDocument: { type: "doc", content: [] },
                  decisionsAndRecommendations: "draft body",
                  contentVersion: 0,
                  signatures: [],
                },
              ],
            }),
      ),
    );

    const detail = await makeService().getHistoryDetail(CURRENT_ID, "sched-prop-1", "new-panelist");
    expect(detail.report).toBeNull();
  });
});

describe("CDW-6 DefenseHistoryService — attempt detail (read-only)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.panelAssignment.findFirst.mockResolvedValue({
      id: "pa-new",
      scheduleId: CURRENT_ID,
      userId: "new-panelist",
      role: "CHAIRMAN",
    });
    prismaMock.defenseSchedule.findUnique.mockImplementation(({ where }: { where: { id: string } }) =>
      Promise.resolve(where.id === CURRENT_ID ? currentRow() : concludedRow({ id: where.id })),
    );
    // Detail resolves against the full authoritative history set.
    prismaMock.defenseSchedule.findMany.mockResolvedValue([currentRow(), concludedRow()]);
  });

  it("returns the exact historical manuscript + FINALIZED RAP + original-role annotations", async () => {
    const detail = await makeService().getHistoryDetail(CURRENT_ID, "sched-prop-1", "new-panelist");

    expect(detail.manuscript?.id).toBe("doc-prop-1");
    expect(detail.report?.status).toBe("FINALIZED");
    expect(detail.report?.source).toBe("STRUCTURED_RAP");
    expect(detail.report?.contentVersion).toBe(3);
    expect(detail.report?.signatureProgress).toEqual({ required: 2, signed: 1 });
    expect(detail.annotations).toHaveLength(1);
    // F: the historical author's role is preserved (never remapped to the
    // caller's current CHAIRMAN role).
    expect(detail.annotations[0].author.role).toBe("PANELIST");
    expect(detail.committee.find((c) => c.userId === "old-rapporteur")?.role).toBe("RAPPORTEUR");
    // G: annotations are read for the HISTORICAL schedule + exact document only.
    expect(annotationsStub.listAttemptAnnotationsForHistory).toHaveBeenCalledWith(
      "sched-prop-1",
      "doc-prop-1",
    );
  });

  it("L: never exposes raw signature data or private evaluator scores", async () => {
    const detail = await makeService().getHistoryDetail(CURRENT_ID, "sched-prop-1", "new-panelist");
    const serialized = JSON.stringify(detail);
    expect(serialized).not.toContain("signatureData");
    expect(serialized).not.toContain("SECRET");
    expect(serialized).not.toContain("signature_data");
  });

  it("I: a historical schedule from another thesis is rejected", async () => {
    prismaMock.defenseSchedule.findUnique.mockImplementation(({ where }: { where: { id: string } }) =>
      Promise.resolve(
        where.id === CURRENT_ID
          ? currentRow()
          : concludedRow({ id: where.id, thesisId: "thesis-other" }),
      ),
    );

    await expect(
      makeService().getHistoryDetail(CURRENT_ID, "sched-prop-1", "new-panelist"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("J: a concluded schedule that is not prior/relevant cannot be injected as history", async () => {
    // Same thesis, but a LATER final attempt → forward in time, not history.
    prismaMock.defenseSchedule.findUnique.mockImplementation(({ where }: { where: { id: string } }) =>
      Promise.resolve(
        where.id === CURRENT_ID
          ? currentRow()
          : concludedRow({
              id: where.id,
              defenseType: "FINAL_DEFENSE",
              defenseDate: new Date("2026-12-01T00:00:00Z"),
              conclusion: { outcome: "REDEFENSE_REQUIRED", concludedAt: new Date("2026-12-05T00:00:00Z") },
            }),
      ),
    );

    await expect(
      makeService().getHistoryDetail(CURRENT_ID, "sched-final-9", "new-panelist"),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("J2: the current schedule cannot be requested as its own history target", async () => {
    await expect(
      makeService().getHistoryDetail(CURRENT_ID, CURRENT_ID, "new-panelist"),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("H2: the caller must still be assigned to the current schedule", async () => {
    prismaMock.panelAssignment.findFirst.mockResolvedValue(null);
    await expect(
      makeService().getHistoryDetail(CURRENT_ID, "sched-prop-1", "stranger"),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("M2: a legacy historical attempt with no binding returns null manuscript and no annotations", async () => {
    prismaMock.defenseSchedule.findUnique.mockImplementation(({ where }: { where: { id: string } }) =>
      Promise.resolve(
        where.id === CURRENT_ID
          ? currentRow()
          : concludedRow({ id: where.id, manuscriptDocumentId: null, manuscriptDocument: null }),
      ),
    );

    const detail = await makeService().getHistoryDetail(CURRENT_ID, "sched-prop-1", "new-panelist");
    expect(detail.manuscript).toBeNull();
    expect(detail.annotations).toEqual([]);
    expect(annotationsStub.listAttemptAnnotationsForHistory).not.toHaveBeenCalled();
  });

  it("legacy text-only RAP is exposed honestly as legacy content (no fabricated structure)", async () => {
    prismaMock.defenseSchedule.findUnique.mockImplementation(({ where }: { where: { id: string } }) =>
      Promise.resolve(
        where.id === CURRENT_ID
          ? currentRow()
          : concludedRow({
              id: where.id,
              rapReports: [
                {
                  id: "rap-legacy",
                  status: "FINALIZED",
                  finalizedAt: new Date("2026-07-04T00:00:00Z"),
                  bodyDocument: null,
                  decisionsAndRecommendations: "Legacy committee notes.",
                  contentVersion: 0,
                  signatures: [],
                },
              ],
            }),
      ),
    );

    const detail = await makeService().getHistoryDetail(CURRENT_ID, "sched-prop-1", "new-panelist");
    expect(detail.report?.source).toBe("LEGACY_RAP_TEXT");
    expect(detail.report?.bodyDocument).toBeNull();
    expect(detail.report?.text).toBe("Legacy committee notes.");
  });

  it("a non-FINALIZED historical RAP is not surfaced as official history", async () => {
    prismaMock.defenseSchedule.findUnique.mockImplementation(({ where }: { where: { id: string } }) =>
      Promise.resolve(
        where.id === CURRENT_ID
          ? currentRow()
          : concludedRow({
              id: where.id,
              rapReports: [
                {
                  id: "rap-draft",
                  status: "DRAFT",
                  finalizedAt: null,
                  bodyDocument: { type: "doc", content: [] },
                  decisionsAndRecommendations: "draft",
                  contentVersion: 0,
                  signatures: [],
                },
              ],
            }),
      ),
    );

    const detail = await makeService().getHistoryDetail(CURRENT_ID, "sched-prop-1", "new-panelist");
    expect(detail.report).toBeNull();
  });
});

describe("CDW-6 final correction — list/detail relationship parity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    annotationsStub.listAttemptAnnotationsForHistory.mockClear();
    annotationsStub.listAttemptAnnotationsForHistory.mockResolvedValue([]);
    prismaMock.panelAssignment.findFirst.mockResolvedValue({
      id: "pa-new",
      scheduleId: CURRENT_ID,
      userId: "new-panelist",
      role: "PANELIST",
    });
    prismaMock.defenseAnnotation.findMany.mockResolvedValue([]);
  });

  it("detail uses the normalized set: an older PASSED Proposal is OLDER_HISTORY, not PREVIOUS_STAGE", async () => {
    const finalCurrent = currentRow({
      id: "sched-final-1",
      defenseType: "FINAL_DEFENSE",
      defenseDate: new Date("2026-11-01T00:00:00Z"),
    });
    const prop1 = concludedRow({
      id: "sched-prop-1",
      defenseDate: new Date("2026-07-01T00:00:00Z"),
      conclusion: { outcome: "PASSED", concludedAt: new Date("2026-07-05T00:00:00Z") },
    });
    const prop2 = concludedRow({
      id: "sched-prop-2",
      defenseDate: new Date("2026-09-01T00:00:00Z"),
      conclusion: { outcome: "PASSED", concludedAt: new Date("2026-09-05T00:00:00Z") },
    });

    prismaMock.defenseSchedule.findUnique.mockImplementation(({ where }: { where: { id: string } }) => {
      if (where.id === finalCurrent.id) return Promise.resolve(finalCurrent);
      return Promise.resolve([prop1, prop2].find((row) => row.id === where.id) ?? null);
    });
    prismaMock.defenseSchedule.findMany.mockResolvedValue([finalCurrent, prop1, prop2]);

    const svc = makeService();
    const list = await svc.getHistory(finalCurrent.id, "new-panelist");
    expect(list.items.map((i) => [i.scheduleId, i.relationship])).toEqual([
      ["sched-prop-2", "PREVIOUS_STAGE"],
      ["sched-prop-1", "OLDER_HISTORY"],
    ]);

    const olderDetail = await svc.getHistoryDetail(finalCurrent.id, "sched-prop-1", "new-panelist");
    expect(olderDetail.relationship).toBe("OLDER_HISTORY");

    const previousDetail = await svc.getHistoryDetail(finalCurrent.id, "sched-prop-2", "new-panelist");
    expect(previousDetail.relationship).toBe("PREVIOUS_STAGE");
  });

  it("detail uses the normalized set: an older same-stage re-defense is OLDER_HISTORY", async () => {
    const attempt3 = currentRow({
      id: "sched-prop-3",
      defenseType: "PROPOSAL_DEFENSE",
      defenseDate: new Date("2026-11-01T00:00:00Z"),
    });
    const attempt1 = concludedRow({
      id: "sched-prop-1",
      defenseDate: new Date("2026-07-01T00:00:00Z"),
      conclusion: { outcome: "REDEFENSE_REQUIRED", concludedAt: new Date("2026-07-05T00:00:00Z") },
    });
    const attempt2 = concludedRow({
      id: "sched-prop-2",
      defenseDate: new Date("2026-09-01T00:00:00Z"),
      conclusion: { outcome: "REDEFENSE_REQUIRED", concludedAt: new Date("2026-09-05T00:00:00Z") },
    });

    prismaMock.defenseSchedule.findUnique.mockImplementation(({ where }: { where: { id: string } }) => {
      if (where.id === attempt3.id) return Promise.resolve(attempt3);
      return Promise.resolve([attempt1, attempt2].find((row) => row.id === where.id) ?? null);
    });
    prismaMock.defenseSchedule.findMany.mockResolvedValue([attempt3, attempt1, attempt2]);

    const svc = makeService();
    const list = await svc.getHistory(attempt3.id, "new-panelist");
    expect(list.items.map((i) => [i.scheduleId, i.relationship])).toEqual([
      ["sched-prop-2", "SAME_STAGE_REDEFENSE"],
      ["sched-prop-1", "OLDER_HISTORY"],
    ]);

    const primary = await svc.getHistoryDetail(attempt3.id, "sched-prop-2", "new-panelist");
    expect(primary.relationship).toBe("SAME_STAGE_REDEFENSE");

    const older = await svc.getHistoryDetail(attempt3.id, "sched-prop-1", "new-panelist");
    expect(older.relationship).toBe("OLDER_HISTORY");
  });

  it("detail rejects a non-concluded schedule that is not in the normalized history set", async () => {
    const current = currentRow();
    const unconcluded = concludedRow({
      id: "sched-prop-draft",
      conclusion: null,
    });

    prismaMock.defenseSchedule.findUnique.mockImplementation(({ where }: { where: { id: string } }) =>
      Promise.resolve(where.id === current.id ? current : unconcluded),
    );
    prismaMock.defenseSchedule.findMany.mockResolvedValue([current, unconcluded]);

    await expect(
      makeService().getHistoryDetail(CURRENT_ID, "sched-prop-draft", "new-panelist"),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});
