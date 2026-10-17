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
    expect(history.items[0].rapAvailable).toBe(true);
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
    expect(history.items[0].rapAvailable).toBe(true);
  });

  it("E: authorization is the CURRENT assignment — a replacement Panelist sees history", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(currentRow());
    prismaMock.defenseSchedule.findMany.mockResolvedValue([currentRow(), concludedRow()]);

    const history = await makeService().getHistory(CURRENT_ID, "new-panelist");
    expect(history.items).toHaveLength(1);
    expect(prismaMock.panelAssignment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { scheduleId: CURRENT_ID, userId: "new-panelist" },
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
  });

  it("returns the exact historical manuscript + FINALIZED RAP + original-role annotations", async () => {
    const detail = await makeService().getHistoryDetail(CURRENT_ID, "sched-prop-1", "new-panelist");

    expect(detail.manuscript?.id).toBe("doc-prop-1");
    expect(detail.rap?.status).toBe("FINALIZED");
    expect(detail.rap?.isStructured).toBe(true);
    expect(detail.rap?.contentVersion).toBe(3);
    expect(detail.rap?.signatureProgress).toEqual({ required: 2, signed: 1 });
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
    expect(detail.rap?.isStructured).toBe(false);
    expect(detail.rap?.bodyDocument).toBeNull();
    expect(detail.rap?.decisionsAndRecommendations).toBe("Legacy committee notes.");
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
    expect(detail.rap).toBeNull();
  });
});
