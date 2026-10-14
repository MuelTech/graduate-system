import { describe, expect, it } from "vitest";
import {
  buildEnrollmentSnapshot,
  buildThesisPipeline,
  humanizeAuditAction,
} from "../../../src/services/admin-dashboard.rules";

describe("buildThesisPipeline", () => {
  it("counts only each student's latest thesis record so historical attempts do not double-count", () => {
    const records = [
      // s1: older FAILED Title attempt, newer active Proposal record.
      { studentId: "s1", stage: "TITLE", status: "FAILED", createdAt: new Date("2026-01-01"), id: "old" },
      { studentId: "s1", stage: "PROPOSAL", status: "PENDING", createdAt: new Date("2026-02-01"), id: "new" },
      { studentId: "s2", stage: "TITLE", status: "APPROVED", createdAt: new Date("2026-02-01"), id: "s2-1" },
      { studentId: "s3", stage: "FINAL", status: "PENDING", createdAt: new Date("2026-03-01"), id: "s3-1" },
    ];

    expect(buildThesisPipeline(records)).toEqual([
      { stage: "TITLE", count: 1 },
      { stage: "PROPOSAL", count: 1 },
      { stage: "FINAL", count: 1 },
    ]);
  });

  it("excludes a student whose only (latest) thesis record is FAILED", () => {
    const records = [
      { studentId: "s1", stage: "TITLE", status: "FAILED", createdAt: new Date("2026-01-01"), id: "s1-1" },
      { studentId: "s2", stage: "PROPOSAL", status: "APPROVED", createdAt: new Date("2026-02-01"), id: "s2-1" },
    ];

    expect(buildThesisPipeline(records)).toEqual([
      { stage: "TITLE", count: 0 },
      { stage: "PROPOSAL", count: 1 },
      { stage: "FINAL", count: 0 },
    ]);
  });

  it("counts a newer non-failed attempt once when an older attempt failed", () => {
    const records = [
      { studentId: "s1", stage: "TITLE", status: "FAILED", createdAt: new Date("2026-01-01"), id: "s1-old" },
      { studentId: "s1", stage: "TITLE", status: "PENDING", createdAt: new Date("2026-03-01"), id: "s1-new" },
    ];

    expect(buildThesisPipeline(records)).toEqual([
      { stage: "TITLE", count: 1 },
      { stage: "PROPOSAL", count: 0 },
      { stage: "FINAL", count: 0 },
    ]);
  });

  it("counts multiple historical records for one student only once", () => {
    const records = [
      { studentId: "s1", stage: "TITLE", status: "FAILED", createdAt: new Date("2026-01-01"), id: "a" },
      { studentId: "s1", stage: "TITLE", status: "REJECTED", createdAt: new Date("2026-02-01"), id: "b" },
      { studentId: "s1", stage: "PROPOSAL", status: "APPROVED", createdAt: new Date("2026-03-01"), id: "c" },
    ];

    expect(buildThesisPipeline(records)).toEqual([
      { stage: "TITLE", count: 0 },
      { stage: "PROPOSAL", count: 1 },
      { stage: "FINAL", count: 0 },
    ]);
  });

  it("counts every non-failed latest status under its current stage", () => {
    const records = [
      { studentId: "s1", stage: "TITLE", status: "APPROVED", createdAt: new Date("2026-01-01"), id: "1" },
      { studentId: "s2", stage: "PROPOSAL", status: "SCHEDULED", createdAt: new Date("2026-01-01"), id: "2" },
      { studentId: "s3", stage: "FINAL", status: "PASSED", createdAt: new Date("2026-01-01"), id: "3" },
      { studentId: "s4", stage: "TITLE", status: "REVISION", createdAt: new Date("2026-01-01"), id: "4" },
    ];

    expect(buildThesisPipeline(records)).toEqual([
      { stage: "TITLE", count: 2 },
      { stage: "PROPOSAL", count: 1 },
      { stage: "FINAL", count: 1 },
    ]);
  });

  it("is order-independent and breaks createdAt ties deterministically by id desc", () => {
    const records = [
      { studentId: "s1", stage: "FINAL", status: "PENDING", createdAt: new Date("2026-01-01"), id: "aaa" },
      { studentId: "s1", stage: "TITLE", status: "PENDING", createdAt: new Date("2026-01-01"), id: "bbb" },
    ];

    // Same timestamp -> higher id wins the "latest" selection.
    expect(buildThesisPipeline(records)).toEqual([
      { stage: "TITLE", count: 1 },
      { stage: "PROPOSAL", count: 0 },
      { stage: "FINAL", count: 0 },
    ]);
  });

  it("returns zero counts for every stage when there are no records", () => {
    expect(buildThesisPipeline([])).toEqual([
      { stage: "TITLE", count: 0 },
      { stage: "PROPOSAL", count: 0 },
      { stage: "FINAL", count: 0 },
    ]);
  });
});

describe("buildEnrollmentSnapshot", () => {
  it("aggregates total, degree level, and per-program counts", () => {
    const snapshot = buildEnrollmentSnapshot([
      { programName: "MSIT", programType: "MASTERS" },
      { programName: "MSIT", programType: "MASTERS" },
      { programName: "MBA", programType: "MASTERS" },
      { programName: "DIT", programType: "DOCTORAL" },
    ]);

    expect(snapshot.total).toBe(4);
    expect(snapshot.byDegreeLevel).toEqual([
      { degreeLevel: "MASTERS", count: 3 },
      { degreeLevel: "DOCTORAL", count: 1 },
    ]);
    expect(snapshot.topPrograms).toEqual([
      { programName: "MSIT", degreeLevel: "MASTERS", count: 2 },
      { programName: "DIT", degreeLevel: "DOCTORAL", count: 1 },
      { programName: "MBA", degreeLevel: "MASTERS", count: 1 },
    ]);
  });

  it("limits to the top five programs and breaks count ties by program name ascending", () => {
    const rows = [
      ...Array.from({ length: 5 }, () => ({ programName: "Alpha", programType: "MASTERS" as const })),
      ...Array.from({ length: 4 }, () => ({ programName: "Bravo", programType: "MASTERS" as const })),
      ...Array.from({ length: 3 }, () => ({ programName: "Charlie", programType: "MASTERS" as const })),
      ...Array.from({ length: 2 }, () => ({ programName: "Delta", programType: "MASTERS" as const })),
      ...Array.from({ length: 1 }, () => ({ programName: "Echo", programType: "DOCTORAL" as const })),
      ...Array.from({ length: 1 }, () => ({ programName: "Foxtrot", programType: "DOCTORAL" as const })),
    ];

    const snapshot = buildEnrollmentSnapshot(rows);
    expect(snapshot.topPrograms).toHaveLength(5);
    expect(snapshot.topPrograms.map((p) => p.programName)).toEqual([
      "Alpha",
      "Bravo",
      "Charlie",
      "Delta",
      "Echo",
    ]);
  });

  it("handles an empty enrollment set", () => {
    expect(buildEnrollmentSnapshot([])).toEqual({
      total: 0,
      byDegreeLevel: [
        { degreeLevel: "MASTERS", count: 0 },
        { degreeLevel: "DOCTORAL", count: 0 },
      ],
      topPrograms: [],
    });
  });
});

describe("humanizeAuditAction", () => {
  it("maps known internal codes to human-readable phrases", () => {
    expect(humanizeAuditAction("COR_VERIFY").action).toBe("Verified a COR submission");
    expect(humanizeAuditAction("COR_REJECT").action).toBe("Rejected a COR submission");
    expect(humanizeAuditAction("DEFENSE_APPLICATION_APPROVE").action).toBe(
      "Approved a defense application",
    );
    expect(humanizeAuditAction("DEFENSE_RESUBMIT").action).toBe(
      "Resubmitted a defense application",
    );
    expect(humanizeAuditAction("waiver_validated").action).toBe(
      "Validated a bridging waiver",
    );
  });

  it("never exposes an unmapped internal code as the user-facing sentence", () => {
    const result = humanizeAuditAction("SOME_INTERNAL_EVENT");
    expect(result.action).toBe("System activity");
    expect(result.action).not.toContain("SOME_INTERNAL_EVENT");
  });

  it("falls back to a readable description for unknown actions", () => {
    expect(humanizeAuditAction("SOME_INTERNAL_EVENT", "Updated a student record")).toEqual({
      action: "Updated a student record",
      detail: null,
    });
  });

  it("suppresses duplicated description text when a mapped phrase already exists", () => {
    expect(humanizeAuditAction("COR_VERIFY", "Verified a COR submission")).toEqual({
      action: "Verified a COR submission",
      detail: null,
    });
  });
});
