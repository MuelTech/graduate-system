import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
  rapReport: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
  },
  rapReportSignature: {
    createMany: vi.fn(),
    findMany: vi.fn(),
    updateMany: vi.fn(),
  },
  defenseSchedule: { findUnique: vi.fn() },
  defenseConclusion: { findUnique: vi.fn() },
  panelAssignment: { findFirst: vi.fn(), findMany: vi.fn() },
  thesisTitle: { findMany: vi.fn() },
}));

vi.mock("../../../src/config/database", () => ({
  default: prismaMock,
}));

import {
  RapReportService,
  buildRapContent,
  resolveAttemptTitleContext,
} from "../../../src/services/rap-report.service";

describe("resolveAttemptTitleContext (attempt-bound title context)", () => {
  it("returns null when the attempt has no bound selected title", () => {
    expect(
      resolveAttemptTitleContext({
        attemptSelectedTitleId: null,
        thesisTitles: [{ id: "title-A", titleText: "Title A", isSelected: true }],
      }),
    ).toEqual({ selectedTitleId: null, officialTitle: null });
  });

  it("does not fall back to a thesis-global isSelected title (cross-attempt leakage)", () => {
    // Regression: a new canonical attempt (selectedTitleId = null) must never
    // inherit an older attempt's title via ThesisTitle.isSelected.
    const result = resolveAttemptTitleContext({
      attemptSelectedTitleId: null,
      thesisTitles: [
        { id: "title-A", titleText: "Title A", isSelected: true },
        { id: "title-B", titleText: "Title B", isSelected: false },
      ],
    });
    expect(result.officialTitle).toBeNull();
    expect(result.selectedTitleId).toBeNull();
  });

  it("resolves a historical attempt-bound id to its text", () => {
    expect(
      resolveAttemptTitleContext({
        attemptSelectedTitleId: "title-A",
        thesisTitles: [{ id: "title-A", titleText: "Title A", isSelected: false }],
      }),
    ).toEqual({ selectedTitleId: "title-A", officialTitle: "Title A" });
  });

  it("returns null for an unknown/blank/absent id", () => {
    expect(
      resolveAttemptTitleContext({ attemptSelectedTitleId: "zzz", thesisTitles: [] }),
    ).toEqual({ selectedTitleId: null, officialTitle: null });
    expect(resolveAttemptTitleContext({ attemptSelectedTitleId: "" })).toEqual({
      selectedTitleId: null,
      officialTitle: null,
    });
    expect(resolveAttemptTitleContext({})).toEqual({
      selectedTitleId: null,
      officialTitle: null,
    });
  });
});

describe("buildRapContent title line", () => {
  const base = {
    defenseType: "TITLE_DEFENSE",
    outcome: "PASSED",
    rapporteurNotes: "Panel notes",
  };

  it("omits the Official Title line when there is no attempt-bound title", () => {
    const content = buildRapContent({ ...base, officialTitle: null });
    expect(content).not.toMatch(/Official Title/);
    expect(content).not.toMatch(/Official Title: N\/A/);
  });

  it("includes the Official Title line only for a bound historical title", () => {
    const content = buildRapContent({ ...base, officialTitle: "Title A" });
    expect(content).toContain("Official Title: Title A");
  });
});

describe("RapReportService.ensureRapAfterTitlePrerequisites (deferred Title RAP)", () => {
  const svc = new RapReportService();

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (fn: any) => fn(prismaMock));
    prismaMock.rapReport.findUnique.mockResolvedValue(null);
    prismaMock.rapReportSignature.createMany.mockResolvedValue({ count: 1 });
    prismaMock.panelAssignment.findMany.mockResolvedValue([
      { userId: "chair-user", role: "CHAIRMAN" },
    ]);
    prismaMock.defenseSchedule.findUnique.mockResolvedValue({
      defenseType: "TITLE_DEFENSE",
      venueOrLink: null,
      rapporteurNotes: "Finalized panel notes",
      rapporteurNotesFinalizedAt: new Date("2026-10-15T00:00:00Z"),
      rapporteurNotesFinalizedById: "rap-user",
    });
    prismaMock.panelAssignment.findFirst.mockResolvedValue({ id: "rap-panel" });
  });

  it("uses only attempt-bound title context (null) — no thesis-global leakage", async () => {
    prismaMock.defenseConclusion.findUnique.mockResolvedValue({
      thesisId: "thesis-1",
      outcome: "PASSED",
      selectedTitleId: null,
      selectedTitle: null,
    });

    let created: any = null;
    prismaMock.rapReport.create.mockImplementation(async (args: any) => {
      created = args.data;
      return { id: "rap-1", ...args.data };
    });

    await svc.ensureRapAfterTitlePrerequisites("sched-2");

    expect(created).not.toBeNull();
    expect(created.selectedTitle).toBeNull();
    expect(created.decisionsAndRecommendations).not.toMatch(/Official Title/);
  });

  it("preserves a historical attempt-bound selected title as context", async () => {
    prismaMock.defenseConclusion.findUnique.mockResolvedValue({
      thesisId: "thesis-1",
      outcome: "PASSED",
      selectedTitleId: "title-A",
      selectedTitle: { id: "title-A", titleText: "Title A" },
    });

    let created: any = null;
    prismaMock.rapReport.create.mockImplementation(async (args: any) => {
      created = args.data;
      return { id: "rap-1", ...args.data };
    });

    await svc.ensureRapAfterTitlePrerequisites("sched-legacy");

    expect(created.selectedTitle).toBe("Title A");
    expect(created.decisionsAndRecommendations).toContain("Official Title: Title A");
  });
});
