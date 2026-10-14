import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "fs";

const prismaMock = vi.hoisted(() => {
  const makeModels = () => ({
    defenseSchedule: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    panelAssignment: { findMany: vi.fn(), findFirst: vi.fn() },
    rapReport: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    rapReportSignature: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
  });
  const root = makeModels();
  const tx = makeModels();
  return {
    ...root,
    $transaction: vi.fn(async (fn: (t: unknown) => unknown) => fn(tx)),
    __tx: tx,
  };
});

vi.mock("../../../src/config/database", () => ({ default: prismaMock }));

import { RapReportService } from "../../../src/services/rap-report.service";
import { DefenseCommitteePolicy } from "../../../src/services/defense-committee.policy";

const svc = new RapReportService();

const sig = (
  id: string,
  userId: string,
  roleAtDefense: string | null,
  isSigned = false,
) => ({ id, userId, roleAtDefense, isSigned });

const setDefenseType = (defenseType: string) =>
  prismaMock.defenseSchedule.findUnique.mockResolvedValue({
    id: "sched-1",
    defenseType,
  });

beforeEach(() => {
  vi.clearAllMocks();
  // Re-establish default implementations (clearAllMocks keeps implementations).
  prismaMock.__tx.rapReportSignature.createMany.mockResolvedValue({ count: 1 });
  prismaMock.__tx.rapReportSignature.deleteMany.mockResolvedValue({ count: 1 });
  prismaMock.__tx.rapReportSignature.updateMany.mockResolvedValue({ count: 1 });
});

describe("RAP-1 FIX-2 reconcile open RAP signature slots", () => {
  it("Test 1: open TITLE RAP missing Rapporteur gains the required Rapporteur slot", async () => {
    setDefenseType("TITLE_DEFENSE");
    prismaMock.rapReport.findUnique.mockResolvedValue({
      id: "rap-1",
      status: "FOR_SIGNATURE",
    });
    prismaMock.panelAssignment.findMany.mockResolvedValue([
      { userId: "u1", role: "CHAIRMAN" },
      { userId: "u2", role: "PANELIST" },
      { userId: "u3", role: "RAPPORTEUR" },
    ]);
    prismaMock.rapReportSignature.findMany.mockResolvedValue([
      sig("sig-c", "u1", "CHAIRMAN"),
      sig("sig-p", "u2", "PANELIST"),
    ]);

    const result = await svc.reconcileOpenRapSignatures("sched-1");

    expect(result.added).toBe(1);
    const createData = prismaMock.__tx.rapReportSignature.createMany.mock.calls[0][0]
      .data;
    expect(createData).toHaveLength(1);
    expect(createData[0]).toMatchObject({
      userId: "u3",
      roleAtDefense: "RAPPORTEUR",
      required: true,
    });
    expect(prismaMock.__tx.rapReportSignature.deleteMany).not.toHaveBeenCalled();
  });

  it("Test 2: open TITLE RAP with a stale unsigned Adviser slot removes it and adds Rapporteur", async () => {
    setDefenseType("TITLE_DEFENSE");
    prismaMock.rapReport.findUnique.mockResolvedValue({
      id: "rap-1",
      status: "PARTIALLY_SIGNED",
    });
    prismaMock.panelAssignment.findMany.mockResolvedValue([
      { userId: "u1", role: "CHAIRMAN" },
      { userId: "u2", role: "PANELIST" },
      { userId: "u3", role: "RAPPORTEUR" },
    ]);
    prismaMock.rapReportSignature.findMany.mockResolvedValue([
      sig("sig-c", "u1", "CHAIRMAN", true),
      sig("sig-p", "u2", "PANELIST", true),
      sig("sig-a", "u4", "ADVISER", false),
    ]);

    const result = await svc.reconcileOpenRapSignatures("sched-1");

    expect(result.removed).toBe(1);
    expect(prismaMock.__tx.rapReportSignature.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["sig-a"] } },
    });
    const createData = prismaMock.__tx.rapReportSignature.createMany.mock.calls[0][0]
      .data;
    expect(createData.map((d: { userId: string }) => d.userId)).toEqual(["u3"]);
  });

  it("Test 3: open PROPOSAL RAP missing Adviser + Rapporteur adds both, never Facilitator", async () => {
    setDefenseType("PROPOSAL_DEFENSE");
    prismaMock.rapReport.findUnique.mockResolvedValue({
      id: "rap-1",
      status: "FOR_SIGNATURE",
    });
    prismaMock.panelAssignment.findMany.mockResolvedValue([
      { userId: "uA", role: "ADVISER" },
      { userId: "u1", role: "CHAIRMAN" },
      { userId: "u2", role: "PANELIST" },
      { userId: "u3", role: "RAPPORTEUR" },
      { userId: "uF", role: "FACILITATOR" },
    ]);
    prismaMock.rapReportSignature.findMany.mockResolvedValue([
      sig("sig-c", "u1", "CHAIRMAN"),
      sig("sig-p", "u2", "PANELIST"),
    ]);

    const result = await svc.reconcileOpenRapSignatures("sched-1");

    expect(result.added).toBe(2);
    const ids = prismaMock.__tx.rapReportSignature.createMany.mock.calls[0][0].data.map(
      (d: { userId: string }) => d.userId,
    );
    expect(ids.sort()).toEqual(["u3", "uA"]);
    expect(ids).not.toContain("uF");
  });

  it("Test 4/5: never creates Facilitator or Dean slots and removes a stale unsigned Dean slot", async () => {
    setDefenseType("FINAL_DEFENSE");
    prismaMock.rapReport.findUnique.mockResolvedValue({
      id: "rap-1",
      status: "FOR_SIGNATURE",
    });
    prismaMock.panelAssignment.findMany.mockResolvedValue([
      { userId: "uA", role: "ADVISER" },
      { userId: "u1", role: "CHAIRMAN" },
      { userId: "u3", role: "RAPPORTEUR" },
      { userId: "uF", role: "FACILITATOR" },
    ]);
    prismaMock.rapReportSignature.findMany.mockResolvedValue([
      sig("sig-c", "u1", "CHAIRMAN"),
      sig("sig-r", "u3", "RAPPORTEUR"),
      sig("sig-d", "uDean", "DEAN", false),
    ]);

    await svc.reconcileOpenRapSignatures("sched-1");

    const created = prismaMock.__tx.rapReportSignature.createMany.mock.calls[0][0]
      .data as { userId: string }[];
    expect(created.map((d) => d.userId)).toEqual(["uA"]);
    expect(created.map((d) => d.userId)).not.toContain("uF");
    expect(created).not.toContainEqual(
      expect.objectContaining({ roleAtDefense: "DEAN" }),
    );
    expect(prismaMock.__tx.rapReportSignature.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["sig-d"] } },
    });
  });

  it("Test 6: already-signed valid slots are preserved (no delete, no duplicate)", async () => {
    setDefenseType("TITLE_DEFENSE");
    prismaMock.rapReport.findUnique.mockResolvedValue({
      id: "rap-1",
      status: "PARTIALLY_SIGNED",
    });
    prismaMock.panelAssignment.findMany.mockResolvedValue([
      { userId: "u1", role: "CHAIRMAN" },
      { userId: "u2", role: "PANELIST" },
      { userId: "u3", role: "RAPPORTEUR" },
    ]);
    prismaMock.rapReportSignature.findMany.mockResolvedValue([
      sig("sig-c", "u1", "CHAIRMAN", true),
      sig("sig-p", "u2", "PANELIST", false),
      sig("sig-r", "u3", "RAPPORTEUR", true),
    ]);

    const result = await svc.reconcileOpenRapSignatures("sched-1");

    expect(result.reconciled).toBe(false);
    expect(prismaMock.__tx.rapReportSignature.createMany).not.toHaveBeenCalled();
    expect(prismaMock.__tx.rapReportSignature.deleteMany).not.toHaveBeenCalled();
  });

  it("Test 7: FINALIZED RAP is left completely unchanged", async () => {
    prismaMock.rapReport.findUnique.mockResolvedValue({
      id: "rap-1",
      status: "FINALIZED",
    });

    const result = await svc.reconcileOpenRapSignatures("sched-1");

    expect(result.skippedFinalized).toBe(true);
    expect(result.reconciled).toBe(false);
    expect(prismaMock.panelAssignment.findMany).not.toHaveBeenCalled();
    expect(prismaMock.__tx.rapReportSignature.createMany).not.toHaveBeenCalled();
    expect(prismaMock.__tx.rapReportSignature.deleteMany).not.toHaveBeenCalled();
    expect(prismaMock.__tx.rapReportSignature.updateMany).not.toHaveBeenCalled();
  });

  it("Test 8: reconciliation is idempotent (second run makes no writes)", async () => {
    setDefenseType("TITLE_DEFENSE");
    prismaMock.rapReport.findUnique.mockResolvedValue({
      id: "rap-1",
      status: "FOR_SIGNATURE",
    });
    prismaMock.panelAssignment.findMany.mockResolvedValue([
      { userId: "u1", role: "CHAIRMAN" },
      { userId: "u2", role: "PANELIST" },
      { userId: "u3", role: "RAPPORTEUR" },
    ]);
    // First pass: missing Rapporteur.
    prismaMock.rapReportSignature.findMany.mockResolvedValueOnce([
      sig("sig-c", "u1", "CHAIRMAN"),
      sig("sig-p", "u2", "PANELIST"),
    ]);

    const first = await svc.reconcileOpenRapSignatures("sched-1");
    expect(first.added).toBe(1);

    // Second pass: the reconciled (complete) state now exists.
    prismaMock.rapReportSignature.findMany.mockResolvedValueOnce([
      sig("sig-c", "u1", "CHAIRMAN"),
      sig("sig-p", "u2", "PANELIST"),
      sig("sig-r", "u3", "RAPPORTEUR"),
    ]);
    prismaMock.__tx.rapReportSignature.createMany.mockClear();
    prismaMock.__tx.rapReportSignature.deleteMany.mockClear();

    const second = await svc.reconcileOpenRapSignatures("sched-1");
    expect(second.reconciled).toBe(false);
    expect(prismaMock.__tx.rapReportSignature.createMany).not.toHaveBeenCalled();
    expect(prismaMock.__tx.rapReportSignature.deleteMany).not.toHaveBeenCalled();
  });

  it("backfills null roleAtDefense on expected legacy rows", async () => {
    setDefenseType("TITLE_DEFENSE");
    prismaMock.rapReport.findUnique.mockResolvedValue({
      id: "rap-1",
      status: "FOR_SIGNATURE",
    });
    prismaMock.panelAssignment.findMany.mockResolvedValue([
      { userId: "u1", role: "CHAIRMAN" },
      { userId: "u2", role: "PANELIST" },
      { userId: "u3", role: "RAPPORTEUR" },
    ]);
    prismaMock.rapReportSignature.findMany.mockResolvedValue([
      sig("sig-c", "u1", null),
      sig("sig-p", "u2", null),
      sig("sig-r", "u3", null),
    ]);

    const result = await svc.reconcileOpenRapSignatures("sched-1");

    expect(result.roleFilled).toBe(3);
    const updates = prismaMock.__tx.rapReportSignature.updateMany.mock.calls;
    expect(updates).toContainEqual([
      { where: { id: "sig-c" }, data: { roleAtDefense: "CHAIRMAN" } },
    ]);
    expect(updates).toContainEqual([
      { where: { id: "sig-r" }, data: { roleAtDefense: "RAPPORTEUR" } },
    ]);
  });

  it("retires an orphan unsigned slot for a non-required user (legacy null-role adviser) and adds Rapporteur", async () => {
    setDefenseType("TITLE_DEFENSE");
    prismaMock.rapReport.findUnique.mockResolvedValue({
      id: "rap-1",
      status: "FOR_SIGNATURE",
    });
    prismaMock.panelAssignment.findMany.mockResolvedValue([
      { userId: "u1", role: "CHAIRMAN" },
      { userId: "u2", role: "PANELIST" },
      { userId: "u3", role: "RAPPORTEUR" },
    ]);
    prismaMock.rapReportSignature.findMany.mockResolvedValue([
      sig("sig-c", "u1", null),
      sig("sig-p", "u2", null),
      // Legacy orphan: no longer a required signer, recorded before roles existed.
      sig("sig-x", "uAdviser", null),
    ]);

    const result = await svc.reconcileOpenRapSignatures("sched-1");

    expect(result.removed).toBe(1);
    expect(result.roleFilled).toBe(2);
    expect(prismaMock.__tx.rapReportSignature.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["sig-x"] } },
    });
    const created = prismaMock.__tx.rapReportSignature.createMany.mock.calls[0][0]
      .data as { userId: string }[];
    expect(created.map((d) => d.userId)).toEqual(["u3"]);
  });

  it("does not reconcile destructively when the roster yields no canonical signers", async () => {
    setDefenseType("TITLE_DEFENSE");
    prismaMock.rapReport.findUnique.mockResolvedValue({
      id: "rap-1",
      status: "FOR_SIGNATURE",
    });
    // Roster temporarily has no canonical RAP role (e.g. mid re-assignment).
    prismaMock.panelAssignment.findMany.mockResolvedValue([
      { userId: "uF", role: "FACILITATOR" },
    ]);
    prismaMock.rapReportSignature.findMany.mockResolvedValue([
      sig("sig-c", "u1", "CHAIRMAN"),
      sig("sig-x", "uAdviser", null),
    ]);

    const result = await svc.reconcileOpenRapSignatures("sched-1");

    expect(result.reconciled).toBe(false);
    expect(prismaMock.__tx.rapReportSignature.deleteMany).not.toHaveBeenCalled();
    expect(prismaMock.__tx.rapReportSignature.createMany).not.toHaveBeenCalled();
  });

  it("corrects an unsigned slot whose recorded role differs from the roster role", async () => {
    setDefenseType("TITLE_DEFENSE");
    prismaMock.rapReport.findUnique.mockResolvedValue({
      id: "rap-1",
      status: "FOR_SIGNATURE",
    });
    prismaMock.panelAssignment.findMany.mockResolvedValue([
      { userId: "u1", role: "CHAIRMAN" },
      { userId: "u2", role: "PANELIST" },
      { userId: "u3", role: "RAPPORTEUR" },
    ]);
    prismaMock.rapReportSignature.findMany.mockResolvedValue([
      // Wrong-but-canonical role for a required user.
      sig("sig-c", "u1", "PANELIST"),
      sig("sig-p", "u2", "PANELIST"),
    ]);

    const result = await svc.reconcileOpenRapSignatures("sched-1");

    expect(result.roleFilled).toBe(1);
    expect(prismaMock.__tx.rapReportSignature.updateMany).toHaveBeenCalledWith({
      where: { id: "sig-c" },
      data: { roleAtDefense: "CHAIRMAN" },
    });
    const created = prismaMock.__tx.rapReportSignature.createMany.mock.calls[0][0]
      .data as { userId: string }[];
    expect(created.map((d) => d.userId)).toEqual(["u3"]);
  });

  it("does nothing when no RAP exists for the schedule", async () => {
    prismaMock.rapReport.findUnique.mockResolvedValue(null);

    const result = await svc.reconcileOpenRapSignatures("sched-1");

    expect(result.reconciled).toBe(false);
    expect(result.rapId).toBeNull();
    expect(prismaMock.panelAssignment.findMany).not.toHaveBeenCalled();
  });

  it("converges safely on a concurrent unique race (P2002) without failing the read", async () => {
    setDefenseType("TITLE_DEFENSE");
    prismaMock.rapReport.findUnique.mockResolvedValue({
      id: "rap-1",
      status: "FOR_SIGNATURE",
    });
    prismaMock.panelAssignment.findMany.mockResolvedValue([
      { userId: "u1", role: "CHAIRMAN" },
      { userId: "u2", role: "PANELIST" },
      { userId: "u3", role: "RAPPORTEUR" },
    ]);
    prismaMock.rapReportSignature.findMany.mockResolvedValue([
      sig("sig-c", "u1", "CHAIRMAN"),
      sig("sig-p", "u2", "PANELIST"),
    ]);
    // Another concurrent reconciliation inserted the same slot first.
    prismaMock.__tx.rapReportSignature.createMany.mockRejectedValue({
      code: "P2002",
    });

    await expect(
      svc.reconcileOpenRapSignatures("sched-1"),
    ).resolves.toMatchObject({ rapId: "rap-1" });
  });

  it("Test 9: numerical evaluator policy remains Chairman + Panelist only", () => {
    expect(
      new DefenseCommitteePolicy().getEvaluatorRoles("PROPOSAL_DEFENSE"),
    ).toEqual(["CHAIRMAN", "PANELIST"]);
    expect(
      new DefenseCommitteePolicy().getEvaluatorRoles("TITLE_DEFENSE"),
    ).toEqual(["CHAIRMAN", "PANELIST"]);
  });

  it("is wired into the Admin Defense Record detail read path", () => {
    const source = readFileSync(
      "src/services/official-defense-record.service.ts",
      "utf8",
    );
    expect(source).toContain("reconcileOpenRapSignatures(scheduleId)");
  });
});
