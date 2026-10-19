import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  rapReportSignature: { findMany: vi.fn() },
}));

vi.mock("../../../src/config/database", () => ({ default: prismaMock }));

import { ThesisRepository } from "../../../src/repositories/thesis.repository";

describe("CDW-7 read-model cleanup — legacy pending RAP inbox", () => {
  const repo = new ThesisRepository();

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.rapReportSignature.findMany.mockResolvedValue([]);
  });

  it("F: excludes CONCLUDED/CANCELLED attempts and only surfaces signable RAP states", async () => {
    await repo.getPendingRapReports("user-1");

    const args = prismaMock.rapReportSignature.findMany.mock.calls[0][0];
    // Own slots only, unsigned only.
    expect(args.where.userId).toBe("user-1");
    expect(args.where.isSigned).toBe(false);
    // Only canonical signable states.
    expect(args.where.rapReport.status.in).toEqual([
      "FOR_SIGNATURE",
      "PARTIALLY_SIGNED",
    ]);
    // Historical attempts never arrive as actionable inbox work.
    expect(args.where.rapReport.schedule.sessionStatus.notIn).toEqual([
      "CONCLUDED",
      "CANCELLED",
    ]);
    // Privacy: no signature evidence is selected/serialized.
    expect(JSON.stringify(args)).not.toContain("signatureData");
  });

  it("G: an ACTIVE pending slot is still returned", async () => {
    prismaMock.rapReportSignature.findMany.mockResolvedValue([
      {
        id: "sig-1",
        rapId: "rap-1",
        rapReport: {
          id: "rap-1",
          status: "FOR_SIGNATURE",
          schedule: { sessionStatus: "AWAITING_CONCLUSION" },
        },
      },
    ]);

    const rows = await repo.getPendingRapReports("user-1");
    expect(rows).toHaveLength(1);
  });
});
