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
    defenseSchedule: { update: vi.fn() },
  };
  return {
    defenseSchedule: { findUnique: vi.fn(), update: vi.fn() },
    panelAssignment: { findFirst: vi.fn(), findMany: vi.fn() },
    oralExamScore: {
      findUnique: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
    },
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
      sessionStatus: "SCHEDULED",
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
    prismaMock.__tx.oralExamScore.count.mockResolvedValue(1);
    prismaMock.__tx.panelAssignment.findMany.mockResolvedValue([
      { id: "panel-1" },
      { id: "panel-2" },
      { id: "panel-3" },
      { id: "panel-4" },
    ]);
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

  it("Test 6: Title Defense numerical evaluation rejected", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue({
      id: "sched-1",
      defenseType: "TITLE_DEFENSE",
      sessionStatus: "SCHEDULED",
    });
    await expect(
      svc.saveDraft("sched-1", "user-a", { criteria: {} }),
    ).rejects.toThrow(/Title Defense does not use Group I/i);
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
});
