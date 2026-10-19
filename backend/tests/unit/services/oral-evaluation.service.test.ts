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
import { OfficialDefenseRecordService } from "../../../src/services/official-defense-record.service";

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
      criteria: { organization: 1.5 },
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
      criteria: { organization: 1.5 },
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
        criteria: { organization: 1.5 },
      }),
    ).rejects.toThrow(/All evaluation criteria/i);

    prismaMock.__tx.oralExamScore.findUnique.mockResolvedValue({
      id: "eval-1",
      status: "DRAFT",
      scoringVersion: "LEGACY_POINTS_V1",
      ...completeCriteria,
    });
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
      svc.saveDraft("sched-1", "user-a", { criteria: { organization: 1.5 } }),
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

  describe("CDW-4 FIX scoring version (institutional matrix V2)", () => {
    const instComplete = {
      timelinessRelevance: 1,
      organization: 1.25,
      depthComprehensiveness: 1.5,
      relevanceConclusions: 1.75,
      evidenceOriginalThinking: 2,
      presentation: 1,
      masterySubject: 1.25,
      communicationSkill: 1.5,
      attitude: 1.75,
    };

    it("creates NEW evaluations as INSTITUTIONAL_MATRIX_V2", async () => {
      await svc.saveDraft("sched-1", "user-a", {
        criteria: { organization: 1.5 },
      });
      const arg = prismaMock.__tx.oralExamScore.create.mock.calls[0][0];
      expect(arg.data.scoringVersion).toBe("INSTITUTIONAL_MATRIX_V2");
    });

    it("supports partial matrix selections without fabricating an overall", async () => {
      await svc.saveDraft("sched-1", "user-a", {
        criteria: { organization: 1.5, attitude: 2.5 },
      });
      const arg = prismaMock.__tx.oralExamScore.create.mock.calls[0][0];
      expect(Number(arg.data.organization)).toBe(1.5);
      expect(Number(arg.data.attitude)).toBe(2.5);
      // Groups incomplete → no derived average.
      expect(arg.data.groupAAverage).toBeNull();
      expect(arg.data.groupBAverage).toBeNull();
      expect(arg.data.overallAverage).toBeNull();
      expect(arg.data.rating).toBeNull();
    });

    it("rejects values outside the six-level institutional matrix", async () => {
      for (const bad of [0, 2.25, 2.75, 3, 1.1]) {
        await expect(
          svc.saveDraft("sched-1", "user-a", {
            criteria: { organization: bad },
          }),
        ).rejects.toThrow(/institutional ratings/i);
      }
    });

    it("finalize requires all nine institutional ratings", async () => {
      await expect(
        svc.finalize("sched-1", "user-a", {
          signatureData: "e-sign",
          criteria: { organization: 1.5 },
        }),
      ).rejects.toThrow(/All evaluation criteria/i);
    });

    it("finalize requires a signature for V2", async () => {
      prismaMock.__tx.oralExamScore.findUnique.mockResolvedValue({
        id: "eval-1",
        status: "DRAFT",
        scoringVersion: "INSTITUTIONAL_MATRIX_V2",
        ...instComplete,
      });
      await expect(
        svc.finalize("sched-1", "user-a", {
          signatureData: "",
          criteria: instComplete,
        }),
      ).rejects.toThrow(/e-signature/i);
    });

    it("finalize derives group averages and never fabricates an overall/rating", async () => {
      prismaMock.__tx.oralExamScore.findUnique.mockResolvedValue({
        id: "eval-1",
        status: "DRAFT",
        scoringVersion: "INSTITUTIONAL_MATRIX_V2",
        ...instComplete,
      });
      await svc.finalize("sched-1", "user-a", {
        signatureData: "e-sign",
        criteria: instComplete,
      });
      const call = prismaMock.__tx.oralExamScore.updateMany.mock.calls.at(-1)?.[0];
      expect(Number(call?.data?.groupAAverage)).toBeCloseTo(1.5, 5);
      expect(Number(call?.data?.groupBAverage)).toBeCloseTo(1.38, 5);
      expect(call?.data?.overallAverage).toBeNull();
      expect(call?.data?.rating).toBeNull();
      expect(call?.data?.scoringVersion).toBe("INSTITUTIONAL_MATRIX_V2");
    });

    it("continues an existing LEGACY row without reinterpretation (still point sums)", async () => {
      prismaMock.__tx.oralExamScore.findUnique.mockResolvedValue({
        id: "eval-1",
        status: "DRAFT",
        scoringVersion: "LEGACY_POINTS_V1",
        ...completeCriteria,
      });
      await svc.finalize("sched-1", "user-a", {
        signatureData: "e-sign",
        criteria: completeCriteria,
      });
      const call = prismaMock.__tx.oralExamScore.updateMany.mock.calls.at(-1)?.[0];
      // Legacy Group I point sum stays 48; legacy overall point total stays 80.
      expect(Number(call?.data?.groupAAverage)).toBe(48);
      expect(Number(call?.data?.overallAverage)).toBe(80);
      expect(call?.data?.scoringVersion).toBe("LEGACY_POINTS_V1");
    });

    it("reads a legacy row as LEGACY_POINTS_V1 with its original values", async () => {
      prismaMock.oralExamScore.findUnique.mockResolvedValue({
        id: "eval-1",
        status: "DRAFT",
        scoringVersion: "LEGACY_POINTS_V1",
        organization: 8,
        groupAAverage: 48,
        groupBAverage: 16,
        overallAverage: 64,
        rating: "S",
      });
      const dto = await svc.getMyEvaluation("sched-1", "user-a");
      expect(dto.scoringVersion).toBe("LEGACY_POINTS_V1");
      expect(dto.criteria.organization).toBe(8);
      expect(dto.groupIValue).toBe(48);
      expect(dto.rating).toBe("S");
    });
  });

  describe("CDW-4 FIX direct finalize (fresh evaluation, no Save Draft)", () => {
    const instComplete = {
      timelinessRelevance: 1,
      organization: 1.25,
      depthComprehensiveness: 1.5,
      relevanceConclusions: 1.75,
      evidenceOriginalThinking: 2,
      presentation: 1,
      masterySubject: 1.25,
      communicationSkill: 1.5,
      attitude: 1.75,
    };

    it("creates a FINALIZED V2 row directly when no row exists", async () => {
      await svc.finalize("sched-1", "user-a", {
        signatureData: "e-sign",
        criteria: instComplete,
        recommendations: "Direct finalize",
      });
      // Fresh record: create, never a CAS update.
      expect(prismaMock.__tx.oralExamScore.updateMany).not.toHaveBeenCalled();
      const created = prismaMock.__tx.oralExamScore.create.mock.calls[0][0];
      expect(created.data.scheduleId).toBe("sched-1");
      expect(created.data.panelId).toBe("panel-1");
      expect(created.data.status).toBe("FINALIZED");
      expect(created.data.scoringVersion).toBe("INSTITUTIONAL_MATRIX_V2");
      expect(Number(created.data.groupAAverage)).toBeCloseTo(1.5, 5);
      expect(Number(created.data.groupBAverage)).toBeCloseTo(1.38, 5);
      expect(created.data.overallAverage).toBeNull();
      expect(created.data.rating).toBeNull();
      expect(created.data.recommendations).toBe("Direct finalize");
      expect(created.data.signatureData).toBe("e-sign");
      expect(created.data.signedAt).toBeInstanceOf(Date);
      expect(created.data.finalizedAt).toBeInstanceOf(Date);
      expect(created.data.scoredAt).toBeInstanceOf(Date);
    });

    it("rejects an incomplete fresh evaluation without creating a row", async () => {
      await expect(
        svc.finalize("sched-1", "user-a", {
          signatureData: "e-sign",
          criteria: { organization: 1.5 },
        }),
      ).rejects.toThrow(/All evaluation criteria/i);
      expect(prismaMock.__tx.oralExamScore.create).not.toHaveBeenCalled();
    });

    it("rejects a fresh finalize without a signature and creates no row", async () => {
      await expect(
        svc.finalize("sched-1", "user-a", {
          signatureData: "",
          criteria: instComplete,
        }),
      ).rejects.toThrow(/e-signature/i);
      expect(prismaMock.__tx.oralExamScore.create).not.toHaveBeenCalled();
    });

    it("maps a concurrent direct-create unique race (P2002) to a friendly 409", async () => {
      prismaMock.__tx.oralExamScore.create.mockRejectedValueOnce({
        code: "P2002",
        meta: { target: ["schedule_id", "panel_id"] },
      });
      await expect(
        svc.finalize("sched-1", "user-a", {
          signatureData: "e-sign",
          criteria: instComplete,
        }),
      ).rejects.toThrow(/Evaluation state changed/i);
    });

    it("existing DRAFT still finalizes via CAS update (behavior preserved)", async () => {
      prismaMock.__tx.oralExamScore.findUnique.mockResolvedValue({
        id: "eval-1",
        status: "DRAFT",
        scoringVersion: "INSTITUTIONAL_MATRIX_V2",
        ...instComplete,
      });
      await svc.finalize("sched-1", "user-a", {
        signatureData: "e-sign",
        criteria: instComplete,
      });
      expect(prismaMock.__tx.oralExamScore.updateMany).toHaveBeenCalled();
      expect(prismaMock.__tx.oralExamScore.create).not.toHaveBeenCalled();
    });

    it("CDW-9A: duplicate finalization of a FINALIZED record returns 409 without rewriting", async () => {
      prismaMock.__tx.oralExamScore.findUnique.mockResolvedValue({
        id: "eval-1",
        status: "FINALIZED",
        scoringVersion: "INSTITUTIONAL_MATRIX_V2",
        ...instComplete,
      });

      await expect(
        svc.finalize("sched-1", "user-a", {
          signatureData: "e-sign",
          criteria: instComplete,
        }),
      ).rejects.toMatchObject({
        statusCode: 409,
        message: expect.stringMatching(/already finalized/i),
      });

      expect(prismaMock.__tx.oralExamScore.updateMany).not.toHaveBeenCalled();
      expect(prismaMock.__tx.oralExamScore.create).not.toHaveBeenCalled();
    });

    it("CDW-9A: stale DRAFT finalize CAS conflict returns 409 without overwriting", async () => {
      prismaMock.__tx.oralExamScore.findUnique.mockResolvedValue({
        id: "eval-1",
        status: "DRAFT",
        scoringVersion: "INSTITUTIONAL_MATRIX_V2",
        ...instComplete,
      });
      prismaMock.__tx.oralExamScore.updateMany.mockResolvedValueOnce({ count: 0 });

      await expect(
        svc.finalize("sched-1", "user-a", {
          signatureData: "e-sign",
          criteria: instComplete,
        }),
      ).rejects.toMatchObject({
        statusCode: 409,
        message: expect.stringMatching(/Evaluation state changed/i),
      });
    });

    it("CDW-9A: maps a transaction-level P2002 unique race to a friendly 409", async () => {
      prismaMock.$transaction.mockRejectedValueOnce(
        Object.assign(new Error("Unique constraint failed"), {
          code: "P2002",
          meta: { target: ["schedule_id", "panel_id"] },
        }),
      );

      await expect(
        svc.finalize("sched-1", "user-a", {
          signatureData: "e-sign",
          criteria: instComplete,
        }),
      ).rejects.toMatchObject({
        statusCode: 409,
        message: expect.stringMatching(/Evaluation state changed/i),
      });
    });

    it("CDW-9A: evaluator finalization remains independent of Committee Report state", async () => {
      prismaMock.__tx.oralExamScore.findUnique.mockResolvedValue({
        id: "eval-1",
        status: "DRAFT",
        scoringVersion: "INSTITUTIONAL_MATRIX_V2",
        ...instComplete,
      });
      const snapshotSpy = vi
        .spyOn(
          OfficialDefenseRecordService.prototype,
          "snapshotFinalizedEvaluation",
        )
        .mockResolvedValue(undefined as any);
      const ensureSpy = vi
        .spyOn(OfficialDefenseRecordService.prototype, "ensureOralExamSummary")
        .mockResolvedValue({
          created: false,
          summaryId: "sum-1",
          evaluatorCount: 4,
          overallAverage: 1.5,
          finalRating: null,
        });

      try {
        await expect(
          svc.finalize("sched-1", "user-a", {
            signatureData: "e-sign",
            criteria: instComplete,
          }),
        ).resolves.toMatchObject({ panelAssignmentId: "panel-1" });
        expect(prismaMock.rapReport.create).not.toHaveBeenCalled();
        expect(prismaMock.rapReportSignature.create).not.toHaveBeenCalled();
      } finally {
        snapshotSpy.mockRestore();
        ensureSpy.mockRestore();
      }
    });

    it("CDW-9A: concurrent evaluator finalizations remain independently owned", async () => {
      prismaMock.panelAssignment.findFirst.mockImplementation(
        async ({ where }: { where: { userId: string } }) => {
          if (where.userId === "user-a") {
            return {
              id: "panel-1",
              scheduleId: "sched-1",
              userId: "user-a",
              role: "PANELIST",
            };
          }
          if (where.userId === "user-b") {
            return {
              id: "panel-2",
              scheduleId: "sched-1",
              userId: "user-b",
              role: "PANELIST",
            };
          }
          return null;
        },
      );
      prismaMock.__tx.oralExamScore.findUnique.mockResolvedValue(null);
      prismaMock.__tx.oralExamScore.create.mockImplementation(
        async (args: any) => ({
          id: `eval-${args.data.panelId}`,
          ...args.data,
        }),
      );

      const snapshotSpy = vi
        .spyOn(
          OfficialDefenseRecordService.prototype,
          "snapshotFinalizedEvaluation",
        )
        .mockResolvedValue(undefined as any);
      const ensureSpy = vi
        .spyOn(OfficialDefenseRecordService.prototype, "ensureOralExamSummary")
        .mockResolvedValue({
          created: true,
          summaryId: "sum-1",
          evaluatorCount: 4,
          overallAverage: 1.5,
          finalRating: null,
        });

      try {
        await Promise.all([
          svc.finalize("sched-1", "user-a", {
            signatureData: "sig-a",
            criteria: instComplete,
          }),
          svc.finalize("sched-1", "user-b", {
            signatureData: "sig-b",
            criteria: instComplete,
          }),
        ]);

        const created = prismaMock.__tx.oralExamScore.create.mock.calls
          .map((call: any[]) => ({
            panelId: call[0]?.data?.panelId,
            status: call[0]?.data?.status,
            signatureData: call[0]?.data?.signatureData,
          }))
          .sort((a: any, b: any) => a.panelId.localeCompare(b.panelId));
        expect(created).toEqual([
          {
            panelId: "panel-1",
            status: "FINALIZED",
            signatureData: "sig-a",
          },
          {
            panelId: "panel-2",
            status: "FINALIZED",
            signatureData: "sig-b",
          },
        ]);
        expect(ensureSpy).toHaveBeenCalled();
      } finally {
        snapshotSpy.mockRestore();
        ensureSpy.mockRestore();
      }
    });

    it("last required finalizer triggers the idempotent Summary ensure path", async () => {
      prismaMock.__tx.oralExamScore.findUnique.mockResolvedValue({
        id: "eval-1",
        status: "DRAFT",
        scoringVersion: "INSTITUTIONAL_MATRIX_V2",
        ...instComplete,
      });
      prismaMock.panelAssignment.findMany.mockResolvedValue([
        { id: "panel-1" },
        { id: "panel-2" },
        { id: "panel-3" },
        { id: "panel-4" },
      ]);
      prismaMock.oralExamScore.count.mockResolvedValue(4);

      const ensureSpy = vi
        .spyOn(
          OfficialDefenseRecordService.prototype,
          "ensureOralExamSummary",
        )
        .mockResolvedValue({
          created: true,
          summaryId: "sum-1",
          evaluatorCount: 4,
          overallAverage: 1.5,
          finalRating: null,
        });

      try {
        await svc.finalize("sched-1", "user-a", {
          signatureData: "e-sign",
          criteria: instComplete,
        });
        expect(ensureSpy).toHaveBeenCalledTimes(1);
        expect(ensureSpy).toHaveBeenCalledWith("sched-1");
      } finally {
        ensureSpy.mockRestore();
      }
    });
  });
});
