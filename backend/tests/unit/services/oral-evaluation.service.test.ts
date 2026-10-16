import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => {
  const tx = {
    oralExamScore: {
      findUnique: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
    },
    panelAssignment: { findMany: vi.fn() },
    defenseSchedule: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    oralExamSummary: { create: vi.fn() },
    defenseConclusion: { create: vi.fn() },
    rapReport: { create: vi.fn() },
    rapReportSignature: { create: vi.fn(), createMany: vi.fn() },
    thesisRecord: { update: vi.fn(), updateMany: vi.fn() },
  };
  return {
    defenseSchedule: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    panelAssignment: { findFirst: vi.fn(), findMany: vi.fn() },
    oralExamScore: {
      findUnique: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
    },
    oralExamSummary: { create: vi.fn() },
    defenseConclusion: { create: vi.fn() },
    rapReport: { create: vi.fn() },
    rapReportSignature: { create: vi.fn(), createMany: vi.fn() },
    thesisRecord: { update: vi.fn(), updateMany: vi.fn() },
    $transaction: vi.fn(async (fn: any) => fn(tx)),
    __tx: tx,
  };
});

vi.mock("../../../src/config/database", () => ({ default: prismaMock }));

import { OralEvaluationService } from "../../../src/services/oral-evaluation.service";

const completeCriteria = {
  timelinessRelevance: 8,
  organization: 8,
  depthComprehensiveness: 12,
  relevanceConclusions: 8,
  evidenceOriginalThinking: 12,
  presentation: 8,
  masterySubject: 8,
  communicationSkill: 8,
  attitude: 8,
};

describe("OralEvaluationService (CP5)", () => {
  const svc = new OralEvaluationService();

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.defenseSchedule.findUnique.mockResolvedValue({
      id: "sched-1",
      defenseType: "PROPOSAL_DEFENSE",
      // CDW-4: official scoring is editable only while IN_PROGRESS.
      sessionStatus: "IN_PROGRESS",
    });
    prismaMock.panelAssignment.findFirst.mockResolvedValue({
      id: "panel-1",
      scheduleId: "sched-1",
      userId: "user-a",
      role: "PANELIST",
    });
    prismaMock.oralExamScore.findUnique.mockResolvedValue(null);
    prismaMock.oralExamScore.create.mockImplementation(async (a: any) => ({
      id: "eval-1",
      status: "DRAFT",
      ...a.data,
    }));
    prismaMock.oralExamScore.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.$transaction.mockImplementation(async (fn: any) => fn(prismaMock.__tx));
    prismaMock.__tx.oralExamScore.findUnique.mockResolvedValue(null);
    prismaMock.__tx.oralExamScore.create.mockImplementation(async (a: any) => ({
      id: "eval-1",
      status: "DRAFT",
      ...a.data,
    }));
    prismaMock.__tx.oralExamScore.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.__tx.oralExamScore.count.mockResolvedValue(4);
    prismaMock.__tx.panelAssignment.findMany.mockResolvedValue([
      { id: "panel-1" },
      { id: "panel-2" },
      { id: "panel-3" },
      { id: "panel-4" },
    ]);
    prismaMock.__tx.defenseSchedule.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.__tx.defenseSchedule.update.mockResolvedValue({});
    prismaMock.__tx.defenseSchedule.findUnique.mockResolvedValue({
      sessionStatus: "IN_PROGRESS",
    });
    // Recompute (post-commit) uses top-level prisma.
    prismaMock.panelAssignment.findMany.mockResolvedValue([
      { id: "panel-1" },
      { id: "panel-2" },
      { id: "panel-3" },
      { id: "panel-4" },
    ]);
    prismaMock.oralExamScore.count.mockResolvedValue(4);
    prismaMock.defenseSchedule.updateMany.mockResolvedValue({ count: 1 });
  });

  it("Test 1: evaluator can save own partial draft", async () => {
    const dto = await svc.saveDraft("sched-1", "user-a", {
      criteria: { organization: 5 },
    });
    expect(prismaMock.__tx.oralExamScore.create).toHaveBeenCalled();
    expect(dto.status).toBe("DRAFT");
    expect(dto.panelAssignmentId).toBe("panel-1");
  });

  it("Test 3–5: non-evaluator roles denied", async () => {
    for (const role of ["RAPPORTEUR", "FACILITATOR", "ADVISER"]) {
      prismaMock.panelAssignment.findFirst.mockResolvedValue({
        id: "panel-x",
        scheduleId: "sched-1",
        userId: "user-x",
        role,
      });
      await expect(
        svc.saveDraft("sched-1", "user-x", { criteria: {} }),
      ).rejects.toThrow(/cannot submit oral examination/i);
    }
  });

  it("WF-C1b: Title Defense evaluator can save own Draft while IN_PROGRESS", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue({
      id: "sched-1",
      defenseType: "TITLE_DEFENSE",
      sessionStatus: "IN_PROGRESS",
    });
    const dto = await svc.saveDraft("sched-1", "user-a", {
      criteria: { organization: 5 },
    });
    expect(prismaMock.__tx.oralExamScore.create).toHaveBeenCalled();
    expect(dto.status).toBe("DRAFT");
    expect(dto.defenseType).toBe("TITLE_DEFENSE");
    expect(dto.panelAssignmentId).toBe("panel-1");
  });

  it("WF-C1b: Title Defense evaluation is blocked before the Chairman Start", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue({
      id: "sched-1",
      defenseType: "TITLE_DEFENSE",
      sessionStatus: "SCHEDULED",
    });
    await expect(
      svc.saveDraft("sched-1", "user-a", { criteria: { organization: 1 } }),
    ).rejects.toThrow(/Evaluation editing is closed/i);
    await expect(
      svc.finalize("sched-1", "user-a", {
        signatureData: "sig",
        criteria: completeCriteria,
      }),
    ).rejects.toThrow(/Evaluation editing is closed/i);
    expect(prismaMock.__tx.oralExamScore.create).not.toHaveBeenCalled();
    expect(prismaMock.__tx.oralExamScore.updateMany).not.toHaveBeenCalled();
  });

  it("WF-C1b: Title Defense evaluator can finalize with signature while IN_PROGRESS", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue({
      id: "sched-1",
      defenseType: "TITLE_DEFENSE",
      sessionStatus: "IN_PROGRESS",
    });
    prismaMock.__tx.oralExamScore.findUnique.mockResolvedValue({
      id: "eval-1",
      status: "DRAFT",
      ...completeCriteria,
    });
    await svc.finalize("sched-1", "user-a", {
      signatureData: "e-sign",
      criteria: completeCriteria,
    });
    const call = prismaMock.__tx.oralExamScore.updateMany.mock.calls[0]?.[0];
    expect(call?.where?.status).toBe("DRAFT");
    expect(call?.data?.status).toBe("FINALIZED");
    expect(call?.data?.signedAt).toBeInstanceOf(Date);
  });

  it("Test 7: client panelId cannot impersonate another evaluator", async () => {
    await expect(
      svc.saveDraft("sched-1", "user-a", {
        criteria: {},
        clientPanelId: "panel-other",
      }),
    ).rejects.toThrow(/does not match the authenticated evaluator/i);
  });

  it("Test 9: repeated draft upserts same logical record", async () => {
    prismaMock.__tx.oralExamScore.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValue({ id: "eval-1", status: "DRAFT" });
    await svc.saveDraft("sched-1", "user-a", { criteria: { organization: 1 } });
    await svc.saveDraft("sched-1", "user-a", { criteria: { organization: 2 } });
    expect(prismaMock.__tx.oralExamScore.updateMany).toHaveBeenCalled();
    expect(prismaMock.__tx.oralExamScore.create).toHaveBeenCalledTimes(1);
  });

  it("Test 16/17: finalize uses server timestamps and CAS DRAFT predicate", async () => {
    prismaMock.__tx.oralExamScore.findUnique.mockResolvedValue({
      id: "eval-1",
      status: "DRAFT",
      ...completeCriteria,
    });
    await svc.finalize("sched-1", "user-a", {
      signatureData: "e-sign",
      criteria: completeCriteria,
      clientSignedAt: "2000-01-01T00:00:00Z",
      clientFinalizedAt: "2000-01-01T00:00:00Z",
    });
    const call = prismaMock.__tx.oralExamScore.updateMany.mock.calls[0]?.[0];
    expect(call?.where?.status).toBe("DRAFT");
    expect(call?.where?.panelId).toBe("panel-1");
    expect(call?.data?.status).toBe("FINALIZED");
    expect(call?.data?.signedAt).toBeInstanceOf(Date);
    expect(call?.data?.signedAt?.getFullYear?.()).not.toBe(2000);
    // Group I sum of completeCriteria: 8+8+12+8+12 = 48
    expect(Number(call?.data?.groupAAverage)).toBe(48);
  });

  it("Test 14–15: finalize requires complete criteria and signature", async () => {
    await expect(
      svc.finalize("sched-1", "user-a", {
        signatureData: "e-sign",
        criteria: { organization: 5 },
      }),
    ).rejects.toThrow(/All evaluation criteria/i);

    await expect(
      svc.finalize("sched-1", "user-a", {
        signatureData: "",
        criteria: completeCriteria,
      }),
    ).rejects.toThrow(/e-signature/i);
  });

  it("Test 18–20: FINALIZED immutable; stale draft update 409", async () => {
    prismaMock.__tx.oralExamScore.findUnique.mockResolvedValue({
      id: "eval-1",
      status: "FINALIZED",
    });
    await expect(
      svc.saveDraft("sched-1", "user-a", { criteria: {} }),
    ).rejects.toThrow(/already finalized/i);

    prismaMock.__tx.oralExamScore.findUnique.mockResolvedValue({
      id: "eval-1",
      status: "DRAFT",
      ...completeCriteria,
    });
    prismaMock.__tx.oralExamScore.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      svc.saveDraft("sched-1", "user-a", { criteria: { organization: 1 } }),
    ).rejects.toThrow(/Evaluation state changed/i);
  });

  it("Test 1: partial Draft save preserves previous criteria", async () => {
    prismaMock.__tx.oralExamScore.findUnique.mockResolvedValue({
      id: "eval-1",
      status: "DRAFT",
      organization: 8,
      depthComprehensiveness: 12,
      recommendations: "Improve references",
      rating: "S",
    });
    await svc.saveDraft("sched-1", "user-a", {
      criteria: { attitude: 9 },
    });
    const call = prismaMock.__tx.oralExamScore.updateMany.mock.calls.at(-1)?.[0];
    expect(call?.data?.organization).toBe(8);
    expect(call?.data?.depthComprehensiveness).toBe(12);
    expect(call?.data?.attitude).toBe(9);
    expect(call?.data?.recommendations).toBe("Improve references");
    expect(call?.data?.rating).toBe("S");
  });

  it("Test 4–6: closed session mutations denied", async () => {
    for (const status of ["AWAITING_CONCLUSION", "CONCLUDED", "CANCELLED"]) {
      prismaMock.defenseSchedule.findUnique.mockResolvedValue({
        id: "sched-1",
        defenseType: "PROPOSAL_DEFENSE",
        sessionStatus: status,
      });
      await expect(
        svc.saveDraft("sched-1", "user-a", { criteria: { organization: 1 } }),
      ).rejects.toThrow(/Evaluation editing is closed/i);
      await expect(
        svc.finalize("sched-1", "user-a", {
          signatureData: "sig",
          criteria: completeCriteria,
        }),
      ).rejects.toThrow(/Evaluation editing is closed/i);
    }
    expect(prismaMock.__tx.oralExamScore.updateMany).not.toHaveBeenCalled();
  });

  it("CDW-4: Proposal/Final scoring is rejected while merely SCHEDULED", async () => {
    for (const defenseType of ["PROPOSAL_DEFENSE", "FINAL_DEFENSE"]) {
      prismaMock.defenseSchedule.findUnique.mockResolvedValue({
        id: "sched-1",
        defenseType,
        sessionStatus: "SCHEDULED",
      });
      await expect(
        svc.saveDraft("sched-1", "user-a", { criteria: { organization: 1 } }),
      ).rejects.toThrow(/Evaluation editing is closed/i);
      await expect(
        svc.finalize("sched-1", "user-a", {
          signatureData: "sig",
          criteria: completeCriteria,
        }),
      ).rejects.toThrow(/Evaluation editing is closed/i);
    }
    expect(prismaMock.__tx.oralExamScore.create).not.toHaveBeenCalled();
    expect(prismaMock.__tx.oralExamScore.updateMany).not.toHaveBeenCalled();
  });

  it("CDW-4 privacy: getMyEvaluation resolves only the caller's OWN assignment", async () => {
    prismaMock.panelAssignment.findFirst.mockResolvedValue({
      id: "panel-1",
      scheduleId: "sched-1",
      userId: "user-a",
      role: "PANELIST",
    });
    const mine = await svc.getMyEvaluation("sched-1", "user-a");
    expect(mine.panelAssignmentId).toBe("panel-1");

    // A different caller with no matching assignment is rejected (own-record only).
    prismaMock.panelAssignment.findFirst.mockResolvedValue(null);
    await expect(svc.getMyEvaluation("sched-1", "user-b")).rejects.toThrow(
      /not assigned/i,
    );
  });

  it("Test 10: unassigned caller gets 403 before any stage gate", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue({
      id: "sched-1",
      defenseType: "TITLE_DEFENSE",
      sessionStatus: "SCHEDULED",
    });
    prismaMock.panelAssignment.findFirst.mockResolvedValue(null);
    await expect(
      svc.saveDraft("sched-1", "user-a", { criteria: {} }),
    ).rejects.toThrow(/not assigned/i);
  });

  it("Test 11–12: finalize does not create Summary/Conclusion/RAP", async () => {
    prismaMock.__tx.oralExamScore.findUnique.mockResolvedValue({
      id: "eval-1",
      status: "DRAFT",
      ...completeCriteria,
    });
    const spy = {
      oralExamSummary: { create: vi.fn() },
      defenseConclusion: { create: vi.fn() },
      rapReport: { create: vi.fn() },
      rapReportSignature: { create: vi.fn() },
      thesisRecord: { update: vi.fn() },
    };
    // Service only uses oralExamScore/panelAssignment/defenseSchedule on tx.
    await svc.finalize("sched-1", "user-a", {
      signatureData: "e-sign",
      criteria: completeCriteria,
    });
    expect(spy.oralExamSummary.create).not.toHaveBeenCalled();
    expect(spy.defenseConclusion.create).not.toHaveBeenCalled();
    expect(spy.rapReport.create).not.toHaveBeenCalled();
    expect(spy.rapReportSignature.create).not.toHaveBeenCalled();
    expect(spy.thesisRecord.update).not.toHaveBeenCalled();
    expect(prismaMock.__tx.defenseSchedule.update).not.toHaveBeenCalled();
  });

  it("Test 13: concurrent first Draft unique race maps to 409", async () => {
    prismaMock.__tx.oralExamScore.findUnique.mockResolvedValue(null);
    prismaMock.__tx.oralExamScore.create.mockRejectedValueOnce({
      code: "P2002",
      meta: { target: ["schedule_id", "panel_id"] },
    });
    await expect(
      svc.saveDraft("sched-1", "user-a", { criteria: { organization: 3 } }),
    ).rejects.toThrow(/Evaluation state changed/i);
  });

  it("Test 6: Save Draft race — session cancelled inside transaction", async () => {
    prismaMock.__tx.defenseSchedule.findUnique.mockResolvedValue({
      sessionStatus: "CANCELLED",
    });
    await expect(
      svc.saveDraft("sched-1", "user-a", { criteria: { organization: 1 } }),
    ).rejects.toThrow(/Evaluation editing is closed/i);
    expect(prismaMock.__tx.oralExamScore.create).not.toHaveBeenCalled();
    expect(prismaMock.__tx.oralExamScore.updateMany).not.toHaveBeenCalled();
  });

  it("Test 7: Finalize race — session concluded inside transaction", async () => {
    prismaMock.__tx.defenseSchedule.findUnique.mockResolvedValue({
      sessionStatus: "CONCLUDED",
    });
    await expect(
      svc.finalize("sched-1", "user-a", {
        signatureData: "sig",
        criteria: completeCriteria,
      }),
    ).rejects.toThrow(/Evaluation editing is closed/i);
    expect(prismaMock.__tx.oralExamScore.updateMany).not.toHaveBeenCalled();
  });

  it("Test 8/9: finalize does not call CP7 writers on actual Prisma mock", async () => {
    prismaMock.__tx.defenseSchedule.findUnique.mockResolvedValue({
      sessionStatus: "IN_PROGRESS",
    });
    prismaMock.__tx.oralExamScore.findUnique.mockResolvedValue({
      id: "eval-1",
      status: "DRAFT",
      ...completeCriteria,
    });
    await svc.finalize("sched-1", "user-a", {
      signatureData: "e-sign",
      criteria: completeCriteria,
    });
    expect(prismaMock.__tx.oralExamSummary.create).not.toHaveBeenCalled();
    expect(prismaMock.__tx.defenseConclusion.create).not.toHaveBeenCalled();
    expect(prismaMock.__tx.rapReport.create).not.toHaveBeenCalled();
    expect(prismaMock.__tx.rapReportSignature.create).not.toHaveBeenCalled();
    expect(prismaMock.__tx.rapReportSignature.createMany).not.toHaveBeenCalled();
    expect(prismaMock.__tx.thesisRecord.update).not.toHaveBeenCalled();
    expect(prismaMock.__tx.thesisRecord.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.oralExamSummary.create).not.toHaveBeenCalled();
    expect(prismaMock.rapReport.create).not.toHaveBeenCalled();
    expect(prismaMock.rapReportSignature.create).not.toHaveBeenCalled();
    // Allowed: evaluation finalized + session recompute only
    expect(prismaMock.__tx.oralExamScore.updateMany).toHaveBeenCalled();
    expect(prismaMock.defenseSchedule.updateMany).toHaveBeenCalled();
  });
});
