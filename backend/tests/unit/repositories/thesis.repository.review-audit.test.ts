import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => {
  const tx = {
    thesisRecord: { updateMany: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  return {
    $transaction: vi.fn(async (fn: (client: unknown) => unknown) => fn(tx)),
    __tx: tx,
  };
});

vi.mock("../../../src/config/database", () => ({ default: prismaMock }));

import { ThesisRepository } from "../../../src/repositories/thesis.repository";

function tx() {
  return prismaMock.__tx;
}

beforeEach(() => {
  vi.clearAllMocks();
  tx().thesisRecord.updateMany.mockResolvedValue({ count: 1 });
  tx().auditLog.create.mockResolvedValue({ id: "log-1" });
});

describe("DL-8 FIX1 atomic application decision", () => {
  it("reject claims PENDING + exact stage, then audits the claimed state", async () => {
    const repo = new ThesisRepository();
    const result = await repo.rejectApplication({
      thesisId: "thesis-1",
      actorId: "admin-1",
      reason: "Upload a clearer COR",
      stage: "TITLE",
    });

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(tx().thesisRecord.updateMany).toHaveBeenCalledWith({
      where: { id: "thesis-1", status: "PENDING", stage: "TITLE" },
      data: { status: "REJECTED", rejectionReason: "Upload a clearer COR" },
    });
    const audit = tx().auditLog.create.mock.calls[0][0];
    expect(audit.data.actionType).toBe("DEFENSE_APPLICATION_REJECT");
    expect(audit.data.actorId).toBe("admin-1");
    expect(audit.data.targetId).toBe("thesis-1");
    expect(audit.data.oldValue).toBe("PENDING");
    expect(JSON.parse(audit.data.newValue)).toEqual({
      stage: "TITLE",
      reason: "Upload a clearer COR",
    });
    expect(result).toMatchObject({ status: "REJECTED", stage: "TITLE" });
  });

  it("reject fails closed (409) and writes no audit when the claim misses", async () => {
    tx().thesisRecord.updateMany.mockResolvedValue({ count: 0 });
    const repo = new ThesisRepository();
    await expect(
      repo.rejectApplication({
        thesisId: "thesis-1",
        actorId: "admin-1",
        reason: "reason",
        stage: "TITLE",
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(tx().auditLog.create).not.toHaveBeenCalled();
  });

  it("approve claims PENDING + exact stage, then audits", async () => {
    const repo = new ThesisRepository();
    await repo.approveApplication({
      thesisId: "thesis-1",
      actorId: "admin-2",
      stage: "PROPOSAL",
    });
    expect(tx().thesisRecord.updateMany).toHaveBeenCalledWith({
      where: { id: "thesis-1", status: "PENDING", stage: "PROPOSAL" },
      data: { status: "APPROVED", rejectionReason: null },
    });
    const audit = tx().auditLog.create.mock.calls[0][0];
    expect(audit.data.actionType).toBe("DEFENSE_APPLICATION_APPROVE");
    expect(audit.data.oldValue).toBe("PENDING");
    expect(JSON.parse(audit.data.newValue)).toEqual({ stage: "PROPOSAL" });
  });

  it("approve fails closed (409) and writes no audit when the claim misses", async () => {
    tx().thesisRecord.updateMany.mockResolvedValue({ count: 0 });
    const repo = new ThesisRepository();
    await expect(
      repo.approveApplication({
        thesisId: "thesis-1",
        actorId: "admin-2",
        stage: "FINAL",
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(tx().auditLog.create).not.toHaveBeenCalled();
  });

  it("concurrent decisions: only the single winning claim audits", async () => {
    // First decision claims the PENDING row; the loser's conditional update
    // affects zero rows and therefore cannot write a contradictory audit.
    const repo = new ThesisRepository();
    tx().thesisRecord.updateMany
      .mockResolvedValueOnce({ count: 1 }) // winner
      .mockResolvedValueOnce({ count: 0 }); // loser

    await repo.approveApplication({ thesisId: "t", actorId: "a", stage: "TITLE" });
    await expect(
      repo.rejectApplication({
        thesisId: "t",
        actorId: "b",
        reason: "late",
        stage: "TITLE",
      }),
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(tx().auditLog.create).toHaveBeenCalledTimes(1);
    expect(tx().auditLog.create.mock.calls[0][0].data.actionType).toBe(
      "DEFENSE_APPLICATION_APPROVE",
    );
  });

  it("duplicate approve cannot produce a second decision audit", async () => {
    const repo = new ThesisRepository();
    tx().thesisRecord.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    await repo.approveApplication({ thesisId: "t", actorId: "a", stage: "TITLE" });
    await expect(
      repo.approveApplication({ thesisId: "t", actorId: "a2", stage: "TITLE" }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(tx().auditLog.create).toHaveBeenCalledTimes(1);
  });

  it("audit failure rolls the decision back", async () => {
    tx().auditLog.create.mockRejectedValue(new Error("audit unavailable"));
    const repo = new ThesisRepository();
    await expect(
      repo.rejectApplication({
        thesisId: "thesis-1",
        actorId: "admin-1",
        reason: "reason",
        stage: "TITLE",
      }),
    ).rejects.toThrow(/audit unavailable/);
  });

  it("does not place storage internals in decision audit values", async () => {
    const repo = new ThesisRepository();
    await repo.rejectApplication({
      thesisId: "thesis-1",
      actorId: "admin-1",
      reason: "reason",
      stage: "TITLE",
    });
    const audit = tx().auditLog.create.mock.calls[0][0];
    const serialized = JSON.stringify(audit.data);
    expect(serialized).not.toContain("filePath");
    expect(serialized).not.toContain("storageKey");
    expect(serialized).not.toContain("checksum");
  });
});
