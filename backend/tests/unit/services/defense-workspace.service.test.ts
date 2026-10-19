import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => {
  const client = {
    defenseSchedule: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    panelAssignment: { findFirst: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  return {
    ...client,
    $transaction: vi.fn(async (fn: (tx: typeof client) => unknown) => fn(client)),
    __tx: client,
  };
});

vi.mock("../../../src/config/database", () => ({ default: prismaMock }));

import { DefenseWorkspaceService } from "../../../src/services/defense-workspace.service";

function scheduleRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "sched-1",
    defenseType: "PROPOSAL_DEFENSE",
    sessionStatus: "IN_PROGRESS",
    defenseDate: new Date("2026-09-30T00:00:00Z"),
    defenseTime: new Date("1970-01-01T14:00:00Z"),
    venueOrLink: "Room 101",
    rapporteurNotes: "draft notes",
    conclusion: null,
    thesisId: "thesis-1",
    thesis: {
      student: {
        id: "st-1",
        studentNumber: "2026-1",
        user: { firstName: "Ana", lastName: "Student" },
        program: { programName: "MIT" },
      },
      thesisTitles: [{ id: "t1", titleText: "Title A" }],
      thesisDocuments: [
        {
          id: "doc-p",
          docType: "PROPOSAL_CHAPTERS",
          defenseStage: "PROPOSAL",
          uploadedAt: new Date(),
          thesisId: "thesis-1",
        },
      ],
      adviserCertifications: [
        {
          defenseStage: "PROPOSAL_DEFENSE",
          status: "ISSUED",
          reviewedDocumentId: "doc-p",
        },
      ],
    },
    panelAssignments: [
      {
        id: "pa-eval",
        role: "PANELIST",
        user: { id: "u-eval", firstName: "Eva", lastName: "Evaluator" },
      },
      {
        id: "pa-rap",
        role: "RAPPORTEUR",
        user: { id: "u-rap", firstName: "Rob", lastName: "Rapporteur" },
      },
      {
        id: "pa-fac",
        role: "FACILITATOR",
        user: { id: "u-fac", firstName: "Fay", lastName: "Fac" },
      },
    ],
    oralExamScores: [{ panelId: "pa-eval", status: "DRAFT" }],
    ...overrides,
  };
}

describe("DefenseWorkspaceService (CP6)", () => {
  const svc = new DefenseWorkspaceService();

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(scheduleRow());
    prismaMock.panelAssignment.findFirst.mockResolvedValue({
      id: "pa-eval",
      scheduleId: "sched-1",
      userId: "u-eval",
      role: "PANELIST",
    });
  });

  it("Test 1: unassigned caller gets 403", async () => {
    prismaMock.panelAssignment.findFirst.mockResolvedValue(null);
    await expect(svc.getWorkspace("sched-1", "u-x")).rejects.toThrow(
      /not assigned/i,
    );
    expect(prismaMock.defenseSchedule.findUnique).toHaveBeenCalled();
  });

  it("Test 2/3: Proposal PANELIST canEvaluate, cannot edit notes", async () => {
    // Certified manuscript binding for Proposal workspace
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(
      scheduleRow({
        thesis: {
          student: {
            id: "st-1",
            studentNumber: "2026-1",
            user: { firstName: "Ana", lastName: "Student" },
            program: { programName: "MIT" },
          },
          thesisTitles: [],
          thesisDocuments: [
            {
              id: "doc-a",
              docType: "PROPOSAL_CHAPTERS",
              defenseStage: "PROPOSAL",
              uploadedAt: new Date("2026-01-01"),
              thesisId: "thesis-1",
            },
            {
              id: "doc-b",
              docType: "PROPOSAL_CHAPTERS",
              defenseStage: "PROPOSAL",
              uploadedAt: new Date("2026-02-01"),
              thesisId: "thesis-1",
            },
          ],
          adviserCertifications: [
            {
              defenseStage: "PROPOSAL_DEFENSE",
              status: "ISSUED",
              reviewedDocumentId: "doc-a",
            },
          ],
        },
      }),
    );
    prismaMock.panelAssignment.findFirst.mockResolvedValue({
      id: "pa-eval",
      scheduleId: "sched-1",
      userId: "u-eval",
      role: "PANELIST",
    });
    const ws = await svc.getWorkspace("sched-1", "u-eval");
    expect(ws.myAssignment.role).toBe("PANELIST");
    expect(ws.capabilities.canEvaluate).toBe(true);
    expect(ws.capabilities.canEditRapporteurNotes).toBe(false);
    expect(ws.rapporteurDraft).toBeNull();
    // Test 4: exact certified manuscript A, not newer B
    expect(ws.documents.map((d) => d.id)).toEqual(["doc-a"]);
  });

  it("Test 6: missing certification binding returns 409 (no latest fallback)", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(
      scheduleRow({
        thesis: {
          student: {
            id: "st-1",
            studentNumber: "2026-1",
            user: { firstName: "Ana", lastName: "Student" },
            program: { programName: "MIT" },
          },
          thesisTitles: [],
          thesisDocuments: [
            {
              id: "doc-b",
              docType: "PROPOSAL_CHAPTERS",
              defenseStage: "PROPOSAL",
              uploadedAt: new Date("2026-02-01"),
              thesisId: "thesis-1",
            },
          ],
          adviserCertifications: [],
        },
      }),
    );
    await expect(svc.getWorkspace("sched-1", "u-eval")).rejects.toThrow(
      /Certified defense manuscript is unavailable/i,
    );
  });

  it("Test 4: Proposal RAPPORTEUR can edit notes, cannot evaluate", async () => {
    prismaMock.panelAssignment.findFirst.mockResolvedValue({
      id: "pa-rap",
      scheduleId: "sched-1",
      userId: "u-rap",
      role: "RAPPORTEUR",
    });
    const ws = await svc.getWorkspace("sched-1", "u-rap");
    expect(ws.capabilities.canEvaluate).toBe(false);
    expect(ws.capabilities.canEditRapporteurNotes).toBe(true);
    expect(ws.rapporteurDraft?.notes).toBe("draft notes");
  });

  it("Test 5: FACILITATOR cannot evaluate", async () => {
    prismaMock.panelAssignment.findFirst.mockResolvedValue({
      id: "pa-fac",
      scheduleId: "sched-1",
      userId: "u-fac",
      role: "FACILITATOR",
    });
    const fac = await svc.getWorkspace("sched-1", "u-fac");
    expect(fac.capabilities.canEvaluate).toBe(false);
  });

  it("WF-C1b: Title Chairman + Panelist are evaluators; Rapporteur/Facilitator are not", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(
      scheduleRow({ defenseType: "TITLE_DEFENSE", sessionStatus: "IN_PROGRESS" }),
    );

    prismaMock.panelAssignment.findFirst.mockResolvedValue({
      id: "pa-eval",
      scheduleId: "sched-1",
      userId: "u-eval",
      role: "PANELIST",
    });
    const panelist = await svc.getWorkspace("sched-1", "u-eval");
    expect(panelist.capabilities.canEvaluate).toBe(true);
    expect(panelist.evaluationStatus).toBe("DRAFT");
    expect(panelist.evaluationProgress.evaluatorAssignments).toBe(1);
    expect(panelist.evaluationProgress.finalizedEvaluations).toBe(0);
    expect(
      panelist.roster.find((r) => r.userId === "u-eval")?.evaluationStatus,
    ).toBe("DRAFT");
    expect(panelist.proposedTitles.length).toBeGreaterThan(0);
    expect(panelist.capabilities.canViewTitleChairmanResult).toBe(false);

    prismaMock.panelAssignment.findFirst.mockResolvedValue({
      id: "pa-chair",
      scheduleId: "sched-1",
      userId: "u-chair",
      role: "CHAIRMAN",
    });
    const chair = await svc.getWorkspace("sched-1", "u-chair");
    expect(chair.capabilities.canEvaluate).toBe(true);
    expect(chair.capabilities.canViewTitleChairmanResult).toBe(true);
    expect(chair.capabilities.canViewTitleDeliberation).toBe(true);

    prismaMock.panelAssignment.findFirst.mockResolvedValue({
      id: "pa-rap",
      scheduleId: "sched-1",
      userId: "u-rap",
      role: "RAPPORTEUR",
    });
    const rap = await svc.getWorkspace("sched-1", "u-rap");
    expect(rap.capabilities.canEvaluate).toBe(false);
    expect(rap.evaluationStatus).toBe("NONE");

    prismaMock.panelAssignment.findFirst.mockResolvedValue({
      id: "pa-fac",
      scheduleId: "sched-1",
      userId: "u-fac",
      role: "FACILITATOR",
    });
    const fac = await svc.getWorkspace("sched-1", "u-fac");
    expect(fac.capabilities.canEvaluate).toBe(false);
  });

  it("Test 8: notes updateMany count=0 → 409", async () => {
    prismaMock.panelAssignment.findFirst.mockResolvedValue({
      id: "pa-rap",
      userId: "u-rap",
      role: "RAPPORTEUR",
    });
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(
      scheduleRow({ sessionStatus: "IN_PROGRESS" }),
    );
    prismaMock.defenseSchedule.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      svc.saveRapporteurNotes("sched-1", "u-rap", "x"),
    ).rejects.toThrow(/state changed or notes are closed/i);
  });

  it("Test 7/8: roster status + evaluation privacy", async () => {
    const ws = await svc.getWorkspace("sched-1", "u-eval");
    const evalRoster = ws.roster.find((r) => r.userId === "u-eval");
    expect(evalRoster?.evaluationStatus).toBe("DRAFT");
    const rapRoster = ws.roster.find((r) => r.userId === "u-rap");
    expect(rapRoster?.evaluationStatus).toBe("NONE");
    // No other evaluator criteria exposed
    expect(JSON.stringify(ws)).not.toContain("timelinessRelevance");
    expect(ws.rapporteurDraft).toBeNull();
  });

  it("Test 9–13: rapporteur notes authorization", async () => {
    // Panelist denied
    await expect(
      svc.saveRapporteurNotes("sched-1", "u-eval", "x"),
    ).rejects.toThrow(/Rapporteur/i);

    // Unassigned denied
    prismaMock.panelAssignment.findFirst.mockResolvedValue(null);
    await expect(
      svc.saveRapporteurNotes("sched-1", "u-x", "x"),
    ).rejects.toThrow(/not assigned/i);

    // Rapporteur allowed
    prismaMock.panelAssignment.findFirst.mockResolvedValue({
      id: "pa-rap",
      userId: "u-rap",
      role: "RAPPORTEUR",
    });
    prismaMock.defenseSchedule.updateMany.mockResolvedValue({ count: 1 });
    await expect(
      svc.saveRapporteurNotes("sched-1", "u-rap", "hello"),
    ).resolves.toEqual({ saved: true });

    // Closed session 409
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(
      scheduleRow({ sessionStatus: "CONCLUDED" }),
    );
    await expect(
      svc.saveRapporteurNotes("sched-1", "u-rap", "hello"),
    ).rejects.toThrow(/closed/i);
  });

  it("Test 14–16: document stage isolation in workspace DTO", async () => {
    const titleWs = await (async () => {
      prismaMock.defenseSchedule.findUnique.mockResolvedValue(
        scheduleRow({
          defenseType: "TITLE_DEFENSE",
          thesis: {
            student: {
              id: "st-1",
              studentNumber: "1",
              user: { firstName: "A", lastName: "B" },
              program: { programName: "MIT" },
            },
            thesisTitles: [],
            thesisDocuments: [
              {
                id: "d-title",
                docType: "TITLE_PROPOSAL",
                defenseStage: "TITLE",
                isCurrent: true,
                uploadedAt: new Date(),
              },
              {
                id: "d-final",
                docType: "FINAL_MANUSCRIPT",
                defenseStage: "FINAL",
                isCurrent: true,
                uploadedAt: new Date(),
              },
            ],
          },
        }),
      );
      return svc.getWorkspace("sched-1", "u-eval");
    })();
    expect(titleWs.documents.map((d) => d.id)).toEqual(["d-title"]);
  });

  it("WF-C1b: Title Chairman cannot record a result before evaluations + Summary are ready", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(
      scheduleRow({
        defenseType: "TITLE_DEFENSE",
        sessionStatus: "IN_PROGRESS",
        rapporteurNotesFinalizedAt: null,
      }),
    );
    prismaMock.panelAssignment.findFirst.mockResolvedValue({
      id: "pa-chair",
      scheduleId: "sched-1",
      userId: "u-chair",
      role: "CHAIRMAN",
    });
    const ws = await svc.getWorkspace("sched-1", "u-chair");
    expect(ws.capabilities.canRecordFormalResult).toBe(false);
    expect(ws.capabilities.canStartDefense).toBe(false);
    // Title now has a real evaluator-completion gate.
    expect(ws.evaluationProgress.evaluatorAssignments).toBe(1);
    expect(ws.evaluationProgress.finalizedEvaluations).toBe(0);
  });

  it("WF-C1b: Title Chairman may record a result once evaluators finalize and Summary exists", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(
      scheduleRow({
        defenseType: "TITLE_DEFENSE",
        sessionStatus: "AWAITING_CONCLUSION",
        rapporteurNotesFinalizedAt: null,
        oralExamScores: [{ panelId: "pa-eval", status: "FINALIZED" }],
        oralExamSummary: { id: "sum-1", overallAverage: 80, finalRating: null },
        // CDW-7/RAP-C1: the in-system Committee Report must be FINALIZED.
        rapReports: [{ status: "FINALIZED" }],
      }),
    );
    prismaMock.panelAssignment.findFirst.mockResolvedValue({
      id: "pa-chair",
      scheduleId: "sched-1",
      userId: "u-chair",
      role: "CHAIRMAN",
    });
    const ws = await svc.getWorkspace("sched-1", "u-chair");
    expect(ws.capabilities.canRecordFormalResult).toBe(true);
    expect(ws.evaluationProgress.finalizedEvaluations).toBe(1);
    // CDW-4 FIX: no committee-facing Oral Summary aggregate is exposed.
    expect(ws).not.toHaveProperty("oralSummary");
  });

  it("2026-10-04: scheduled Title exposes start capability but not conclusion readiness", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(
      scheduleRow({
        defenseType: "TITLE_DEFENSE",
        sessionStatus: "SCHEDULED",
        rapporteurNotesFinalizedAt: null,
      }),
    );
    prismaMock.panelAssignment.findFirst.mockResolvedValue({
      id: "pa-chair",
      scheduleId: "sched-1",
      userId: "u-chair",
      role: "CHAIRMAN",
    });
    const ws = await svc.getWorkspace("sched-1", "u-chair");
    expect(ws.capabilities.canStartDefense).toBe(true);
    expect(ws.capabilities.canRecordFormalResult).toBe(false);
    // CDW-4: SCHEDULED exposes Start but NOT official scoring.
    expect(ws.capabilities.evaluationOpen).toBe(false);
  });

  it("CDW-7: CONCLUDED attempts are immutable — Rapporteur notes cannot be saved at any stage", async () => {
    for (const defenseType of [
      "TITLE_DEFENSE",
      "PROPOSAL_DEFENSE",
      "FINAL_DEFENSE",
    ]) {
      vi.clearAllMocks();
      prismaMock.defenseSchedule.findUnique.mockResolvedValue(
        scheduleRow({
          defenseType,
          sessionStatus: "CONCLUDED",
          rapporteurNotesFinalizedAt: null,
        }),
      );
      prismaMock.panelAssignment.findFirst.mockResolvedValue({
        id: "pa-rap",
        scheduleId: "sched-1",
        userId: "u-rap",
        role: "RAPPORTEUR",
      });
      prismaMock.defenseSchedule.updateMany.mockResolvedValue({ count: 1 });

      await expect(
        svc.saveRapporteurNotes("sched-1", "u-rap", "post-conclusion notes"),
        defenseType,
      ).rejects.toMatchObject({ statusCode: 409 });
      expect(prismaMock.defenseSchedule.updateMany, defenseType).not.toHaveBeenCalled();
    }
  });

  it("CDW-4: assigned Chairman starts a SCHEDULED defense for EVERY stage (atomic)", async () => {
    for (const defenseType of ["TITLE_DEFENSE", "PROPOSAL_DEFENSE", "FINAL_DEFENSE"]) {
      vi.clearAllMocks();
      prismaMock.defenseSchedule.findUnique.mockResolvedValue({
        defenseType,
        sessionStatus: "SCHEDULED",
        conclusion: null,
      });
      prismaMock.panelAssignment.findFirst.mockResolvedValue({
        id: "pa-chair",
        scheduleId: "sched-1",
        userId: "u-chair",
        role: "CHAIRMAN",
      });
      prismaMock.defenseSchedule.updateMany.mockResolvedValue({ count: 1 });
      await expect(svc.startDefense("sched-1", "u-chair")).resolves.toEqual({
        started: true,
        sessionStatus: "IN_PROGRESS",
        transitioned: true,
      });
      const where = prismaMock.defenseSchedule.updateMany.mock.calls[0][0].where;
      expect(where).toMatchObject({ id: "sched-1", sessionStatus: "SCHEDULED" });
      expect(prismaMock.auditLog.create).toHaveBeenCalledTimes(1);
      const audit = prismaMock.auditLog.create.mock.calls[0][0].data;
      expect(audit).toMatchObject({
        actorId: "u-chair",
        actionType: "DEFENSE_SESSION_STARTED",
        targetTable: "defense_schedules",
        targetId: "sched-1",
        oldValue: null,
        ipAddress: null,
      });
      expect(JSON.parse(audit.newValue)).toMatchObject({
        scheduleId: "sched-1",
        defenseType,
        previousStatus: "SCHEDULED",
        newStatus: "IN_PROGRESS",
      });
      expect(audit.newValue).not.toMatch(
        /signature|criteria|recommendation|reportBody|manuscript|password|token|storagePath/i,
      );
    }
  });

  it("CDW-4: start is idempotent while already active", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue({
      defenseType: "PROPOSAL_DEFENSE",
      sessionStatus: "IN_PROGRESS",
      conclusion: null,
    });
    prismaMock.panelAssignment.findFirst.mockResolvedValue({
      id: "pa-chair",
      scheduleId: "sched-1",
      userId: "u-chair",
      role: "CHAIRMAN",
    });
    await expect(svc.startDefense("sched-1", "u-chair")).resolves.toEqual({
      started: true,
      sessionStatus: "IN_PROGRESS",
      transitioned: false,
    });
    expect(prismaMock.defenseSchedule.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.auditLog.create).not.toHaveBeenCalled();
  });

  it("CDW-8B: a lost start race reports no local transition", async () => {
    prismaMock.defenseSchedule.findUnique
      .mockResolvedValueOnce({
        defenseType: "PROPOSAL_DEFENSE",
        sessionStatus: "SCHEDULED",
        conclusion: null,
      })
      .mockResolvedValueOnce({ sessionStatus: "IN_PROGRESS" });
    prismaMock.panelAssignment.findFirst.mockResolvedValue({
      id: "pa-chair",
      scheduleId: "sched-1",
      userId: "u-chair",
      role: "CHAIRMAN",
    });
    prismaMock.defenseSchedule.updateMany.mockResolvedValue({ count: 0 });

    await expect(svc.startDefense("sched-1", "u-chair")).resolves.toEqual({
      started: true,
      sessionStatus: "IN_PROGRESS",
      transitioned: false,
    });
    expect(prismaMock.auditLog.create).not.toHaveBeenCalled();
  });

  it("CDW-4: only the assigned Chairman may start; other roles are rejected", async () => {
    for (const role of ["PANELIST", "RAPPORTEUR", "ADVISER", "FACILITATOR"]) {
      vi.clearAllMocks();
      prismaMock.defenseSchedule.findUnique.mockResolvedValue({
        defenseType: "FINAL_DEFENSE",
        sessionStatus: "SCHEDULED",
        conclusion: null,
      });
      prismaMock.panelAssignment.findFirst.mockResolvedValue({
        id: `pa-${role}`,
        scheduleId: "sched-1",
        userId: `u-${role}`,
        role,
      });
      await expect(
        svc.startDefense("sched-1", `u-${role}`),
      ).rejects.toMatchObject({ statusCode: 403 });
      expect(prismaMock.auditLog.create).not.toHaveBeenCalled();
    }
  });

  it("CDW-4: a concluded session cannot be started", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue({
      defenseType: "TITLE_DEFENSE",
      sessionStatus: "CONCLUDED",
      conclusion: { id: "c-1" },
    });
    prismaMock.panelAssignment.findFirst.mockResolvedValue({
      id: "pa-chair",
      scheduleId: "sched-1",
      userId: "u-chair",
      role: "CHAIRMAN",
    });
    await expect(svc.startDefense("sched-1", "u-chair")).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it("CDW-4 privacy: roster exposes status only; a fellow evaluator sees no private numeric values", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(
      scheduleRow({
        sessionStatus: "IN_PROGRESS",
        oralExamSummary: { id: "sum-1", overallAverage: 88, finalRating: null },
      }),
    );
    prismaMock.panelAssignment.findFirst.mockResolvedValue({
      id: "pa-eval",
      scheduleId: "sched-1",
      userId: "u-eval",
      role: "PANELIST",
    });
    const ws = await svc.getWorkspace("sched-1", "u-eval");

    // Roster entries carry ONLY non-private status fields.
    for (const entry of ws.roster) {
      expect(Object.keys(entry).sort()).toEqual(
        ["evaluationStatus", "name", "role", "userId"].sort(),
      );
    }
    const serialized = JSON.stringify(ws);
    for (const privateField of [
      "criteria",
      "groupIValue",
      "groupIIValue",
      "overallValue",
      "recommendations",
      "signatureData",
      "signedAt",
    ]) {
      expect(serialized).not.toContain(privateField);
    }
    // CDW-4 FIX: the live workspace exposes NO Oral Summary aggregate for anyone.
    expect(ws).not.toHaveProperty("oralSummary");
    expect(serialized).not.toContain("overallAverage");
    expect(serialized).not.toContain("finalRating");
  });

  it("CDW-4 FIX: no role receives an Oral Summary aggregate from the live workspace", async () => {
    for (const role of ["CHAIRMAN", "PANELIST", "RAPPORTEUR", "ADVISER", "FACILITATOR"]) {
      prismaMock.defenseSchedule.findUnique.mockResolvedValue(
        scheduleRow({
          sessionStatus: "AWAITING_CONCLUSION",
          oralExamSummary: { id: "sum-1", overallAverage: 88, finalRating: "VS" },
        }),
      );
      prismaMock.panelAssignment.findFirst.mockResolvedValue({
        id: `pa-${role}`,
        scheduleId: "sched-1",
        userId: `u-${role}`,
        role,
      });
      const ws = await svc.getWorkspace("sched-1", `u-${role}`);
      expect(ws).not.toHaveProperty("oralSummary");
      const serialized = JSON.stringify(ws);
      expect(serialized).not.toContain("overallAverage");
      expect(serialized).not.toContain("finalRating");
      expect(serialized).not.toContain("sum-1");
    }
  });

  it("CDW-4 FIX: Chairman still receives evaluation progress + roster status", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(
      scheduleRow({
        sessionStatus: "AWAITING_CONCLUSION",
        oralExamSummary: { id: "sum-1", overallAverage: 88, finalRating: null },
        oralExamScores: [{ panelId: "pa-eval", status: "FINALIZED" }],
      }),
    );
    prismaMock.panelAssignment.findFirst.mockResolvedValue({
      id: "pa-chair",
      scheduleId: "sched-1",
      userId: "u-chair",
      role: "CHAIRMAN",
    });
    const ws = await svc.getWorkspace("sched-1", "u-chair");
    expect(ws.evaluationProgress).toBeDefined();
    expect(ws.roster.length).toBeGreaterThan(0);
    expect(ws).not.toHaveProperty("oralSummary");
  });

  it("CDW-4: evaluationOpen is true only for an evaluator on an IN_PROGRESS session", async () => {
    // Proposal PANELIST, IN_PROGRESS → open
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(
      scheduleRow({ defenseType: "PROPOSAL_DEFENSE", sessionStatus: "IN_PROGRESS" }),
    );
    prismaMock.panelAssignment.findFirst.mockResolvedValue({
      id: "pa-eval",
      scheduleId: "sched-1",
      userId: "u-eval",
      role: "PANELIST",
    });
    const open = await svc.getWorkspace("sched-1", "u-eval");
    expect(open.capabilities.canEvaluate).toBe(true);
    expect(open.capabilities.evaluationOpen).toBe(true);

    // Same evaluator while SCHEDULED → closed
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(
      scheduleRow({ defenseType: "PROPOSAL_DEFENSE", sessionStatus: "SCHEDULED" }),
    );
    const closed = await svc.getWorkspace("sched-1", "u-eval");
    expect(closed.capabilities.evaluationOpen).toBe(false);
    expect(closed.capabilities.canStartDefense).toBe(false);
  });
});
