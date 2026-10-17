import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  defenseSchedule: { findUnique: vi.fn(), updateMany: vi.fn() },
  panelAssignment: { findFirst: vi.fn(), findMany: vi.fn() },
  oralExamScore: { count: vi.fn() },
  rapReportSignature: {
    findUnique: vi.fn(),
    updateMany: vi.fn(),
    findMany: vi.fn(),
  },
  rapReport: { findUnique: vi.fn(), updateMany: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("../../../src/config/database", () => ({ default: prismaMock }));

import { RapporteurFinalizationService } from "../../../src/services/rapporteur-finalization.service";
import { RapReportService } from "../../../src/services/rap-report.service";

const STAGES = ["TITLE_DEFENSE", "PROPOSAL_DEFENSE", "FINAL_DEFENSE"] as const;

function scheduleRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "sched-1",
    defenseType: "TITLE_DEFENSE",
    sessionStatus: "CONCLUDED",
    rapporteurNotes: "Meaningful historical notes.",
    rapporteurNotesFinalizedAt: null,
    ...overrides,
  };
}

describe("CDW-7 correction — concluded attempts reject Rapporteur note finalization", () => {
  const svc = new RapporteurFinalizationService();

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    prismaMock.panelAssignment.findFirst.mockResolvedValue({
      id: "pa-rap",
      scheduleId: "sched-1",
      userId: "u-rap",
      role: "RAPPORTEUR",
    });
    prismaMock.$transaction.mockImplementation((fn: (tx: unknown) => unknown) =>
      Promise.resolve(fn(prismaMock)),
    );
    prismaMock.defenseSchedule.updateMany.mockResolvedValue({ count: 1 });
  });

  it("rejects CONCLUDED note finalization for every stage and never mutates", async () => {
    for (const defenseType of STAGES) {
      vi.clearAllMocks();
      vi.restoreAllMocks();
      prismaMock.panelAssignment.findFirst.mockResolvedValue({
        id: "pa-rap",
        scheduleId: "sched-1",
        userId: "u-rap",
        role: "RAPPORTEUR",
      });
      prismaMock.$transaction.mockImplementation((fn: (tx: unknown) => unknown) =>
        Promise.resolve(fn(prismaMock)),
      );
      prismaMock.defenseSchedule.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.defenseSchedule.findUnique.mockResolvedValue(
        scheduleRow({ defenseType, sessionStatus: "CONCLUDED" }),
      );

      await expect(
        svc.finalizeDefenseNotes("sched-1", "u-rap"),
        defenseType,
      ).rejects.toMatchObject({ statusCode: 409 });
      expect(prismaMock.defenseSchedule.updateMany, defenseType).not.toHaveBeenCalled();
    }
  });

  it("does not create/converge a Title RAP after conclusion", async () => {
    const ensureSpy = vi
      .spyOn(RapReportService.prototype, "ensureRapAfterTitlePrerequisites")
      .mockResolvedValue(null);
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(
      scheduleRow({ defenseType: "TITLE_DEFENSE", sessionStatus: "CONCLUDED" }),
    );

    await expect(
      svc.finalizeDefenseNotes("sched-1", "u-rap"),
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(ensureSpy).not.toHaveBeenCalled();
    expect(prismaMock.defenseSchedule.updateMany).not.toHaveBeenCalled();
  });

  it("Title legacy notes may still finalize in an active pre-conclusion state", async () => {
    vi.spyOn(RapReportService.prototype, "ensureRapAfterTitlePrerequisites").mockResolvedValue(null);
    prismaMock.defenseSchedule.findUnique
      .mockResolvedValueOnce(
        scheduleRow({ defenseType: "TITLE_DEFENSE", sessionStatus: "IN_PROGRESS" }),
      )
      .mockResolvedValueOnce({
        sessionStatus: "IN_PROGRESS",
        rapporteurNotesFinalizedAt: new Date("2026-10-20T00:00:00Z"),
        rapporteurNotesFinalizedById: "u-rap",
      });

    const result = await svc.finalizeDefenseNotes("sched-1", "u-rap");
    expect(result.finalized).toBe(true);
    expect(prismaMock.defenseSchedule.updateMany).toHaveBeenCalled();
  });
});

describe("CDW-7 correction — concluded attempts reject RAP signing (legacy and modern)", () => {
  const svc = new RapReportService();

  function slot(overrides: Record<string, unknown> = {}) {
    return {
      rapId: "rap-1",
      userId: "u-panel",
      isSigned: false,
      rapReport: {
        status: "FOR_SIGNATURE",
        frozenAt: new Date("2026-10-10T00:00:00Z"),
        frozenContentHash: "frozen-hash-1",
        contentVersion: 3,
        schedule: { sessionStatus: "IN_PROGRESS" },
      },
      ...overrides,
    };
  }

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation((fn: (tx: unknown) => unknown) =>
      Promise.resolve(fn(prismaMock)),
    );
    prismaMock.rapReportSignature.updateMany.mockResolvedValue({ count: 1 });
    vi.spyOn(RapReportService.prototype, "recomputeRapStatus").mockResolvedValue(
      "PARTIALLY_SIGNED",
    );
  });

  it("rejects a LEGACY (no frozen hash) RAP when the attempt is CONCLUDED", async () => {
    prismaMock.rapReportSignature.findUnique.mockResolvedValue(
      slot({
        rapReport: {
          status: "FOR_SIGNATURE",
          frozenAt: null,
          frozenContentHash: null,
          contentVersion: 0,
          schedule: { sessionStatus: "CONCLUDED" },
        },
      }),
    );

    await expect(
      svc.signRapSlot("sig-1", "u-panel", "data:image/png;base64,AAAA"),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(prismaMock.rapReportSignature.updateMany).not.toHaveBeenCalled();
  });

  it("rejects a MODERN frozen RAP when the attempt is CONCLUDED", async () => {
    prismaMock.rapReportSignature.findUnique.mockResolvedValue(
      slot({ rapReport: { ...slot().rapReport, schedule: { sessionStatus: "CONCLUDED" } } }),
    );

    await expect(
      svc.signRapSlot("sig-1", "u-panel", "data:image/png;base64,AAAA"),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(prismaMock.rapReportSignature.updateMany).not.toHaveBeenCalled();
  });

  it("fails closed when the attempt state cannot be resolved", async () => {
    prismaMock.rapReportSignature.findUnique.mockResolvedValue(
      slot({ rapReport: { ...slot().rapReport, schedule: null } }),
    );

    await expect(
      svc.signRapSlot("sig-1", "u-panel", "data:image/png;base64,AAAA"),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(prismaMock.rapReportSignature.updateMany).not.toHaveBeenCalled();
  });

  it("legacy compatibility signing still works for an ACTIVE attempt", async () => {
    prismaMock.rapReportSignature.findUnique.mockResolvedValue(
      slot({
        rapReport: {
          status: "FOR_SIGNATURE",
          frozenAt: null,
          frozenContentHash: null,
          contentVersion: 0,
          schedule: { sessionStatus: "IN_PROGRESS" },
        },
      }),
    );

    await svc.signRapSlot("sig-1", "u-panel", "data:image/png;base64,AAAA");
    expect(prismaMock.rapReportSignature.updateMany).toHaveBeenCalled();
  });

  it("modern frozen signing still binds hash/version for an ACTIVE attempt", async () => {
    prismaMock.rapReportSignature.findUnique.mockResolvedValue(slot());

    await svc.signRapSlot("sig-1", "u-panel", "data:image/png;base64,AAAA");
    const data = prismaMock.rapReportSignature.updateMany.mock.calls[0][0].data;
    expect(data.signedContentHash).toBe("frozen-hash-1");
    expect(data.signedContentVersion).toBe(3);
  });

  it("CDW-8B: returns authoritative schedule/report/version metadata for publication", async () => {
    prismaMock.rapReportSignature.findUnique.mockResolvedValue(
      slot({
        rapReport: {
          ...slot().rapReport,
          schedule: { id: "sched-1", sessionStatus: "IN_PROGRESS" },
        },
      }),
    );

    const result = await svc.signRapSlot(
      "sig-1",
      "u-panel",
      "data:image/png;base64,AAAA",
    );

    expect(result).toMatchObject({
      rapId: "rap-1",
      scheduleId: "sched-1",
      contentVersion: 3,
      status: "PARTIALLY_SIGNED",
      finalizedNow: false,
    });
  });

  it("CDW-8B: reports finalizedNow only when this signature finalizes the RAP", async () => {
    vi.spyOn(RapReportService.prototype, "recomputeRapStatus").mockResolvedValue(
      "FINALIZED",
    );
    prismaMock.rapReportSignature.findUnique.mockResolvedValue(
      slot({
        rapReport: {
          ...slot().rapReport,
          status: "PARTIALLY_SIGNED",
          schedule: { id: "sched-1", sessionStatus: "IN_PROGRESS" },
        },
      }),
    );

    const result = await svc.signRapSlot(
      "sig-1",
      "u-panel",
      "data:image/png;base64,AAAA",
    );

    expect(result.finalizedNow).toBe(true);
    expect(result.status).toBe("FINALIZED");
  });
});
