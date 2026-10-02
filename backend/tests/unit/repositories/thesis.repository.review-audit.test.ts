import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => {
  const tx = {
    thesisRecord: { update: vi.fn() },
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
  tx().thesisRecord.update.mockResolvedValue({
    id: "thesis-1",
    status: "REJECTED",
    rejectionReason: "reason",
    stage: "TITLE",
  });
  tx().auditLog.create.mockResolvedValue({ id: "log-1" });
});

describe("DL-8 canonical application review audit", () => {
  it("reject writes status + reason and the review audit in one transaction", async () => {
    const repo = new ThesisRepository();
    const result = await repo.rejectApplication({
      thesisId: "thesis-1",
      actorId: "admin-1",
      reason: "Upload a clearer COR",
      stage: "TITLE",
      fromStatus: "PENDING",
    });

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(tx().thesisRecord.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "thesis-1" },
        data: expect.objectContaining({
          status: "REJECTED",
          rejectionReason: "Upload a clearer COR",
        }),
      }),
    );
    const audit = tx().auditLog.create.mock.calls[0][0];
    expect(audit.data.actionType).toBe("DEFENSE_APPLICATION_REJECT");
    expect(audit.data.actorId).toBe("admin-1");
    expect(audit.data.targetTable).toBe("thesis_records");
    expect(audit.data.targetId).toBe("thesis-1");
    expect(audit.data.oldValue).toBe("PENDING");
    expect(JSON.parse(audit.data.newValue)).toEqual({
      stage: "TITLE",
      reason: "Upload a clearer COR",
    });
    expect(result).toMatchObject({ status: "REJECTED" });
  });

  it("approve writes status + audit in one transaction", async () => {
    tx().thesisRecord.update.mockResolvedValue({
      id: "thesis-1",
      status: "APPROVED",
      rejectionReason: null,
      stage: "PROPOSAL",
    });
    const repo = new ThesisRepository();
    await repo.approveApplication({
      thesisId: "thesis-1",
      actorId: "admin-2",
      stage: "PROPOSAL",
      fromStatus: "PENDING",
    });

    expect(tx().thesisRecord.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "APPROVED", rejectionReason: null }),
      }),
    );
    const audit = tx().auditLog.create.mock.calls[0][0];
    expect(audit.data.actionType).toBe("DEFENSE_APPLICATION_APPROVE");
    expect(audit.data.actorId).toBe("admin-2");
    expect(audit.data.oldValue).toBe("PENDING");
  });

  it("fails the whole review operation when the audit write fails", async () => {
    tx().auditLog.create.mockRejectedValue(new Error("audit unavailable"));
    const repo = new ThesisRepository();
    await expect(
      repo.rejectApplication({
        thesisId: "thesis-1",
        actorId: "admin-1",
        reason: "reason",
        stage: "TITLE",
        fromStatus: "PENDING",
      }),
    ).rejects.toThrow(/audit unavailable/);
  });

  it("does not place storage internals in rejection audit values", async () => {
    const repo = new ThesisRepository();
    await repo.rejectApplication({
      thesisId: "thesis-1",
      actorId: "admin-1",
      reason: "reason",
      stage: "TITLE",
      fromStatus: "PENDING",
    });
    const audit = tx().auditLog.create.mock.calls[0][0];
    const serialized = JSON.stringify(audit.data);
    expect(serialized).not.toContain("filePath");
    expect(serialized).not.toContain("storageKey");
    expect(serialized).not.toContain("checksum");
  });
});
