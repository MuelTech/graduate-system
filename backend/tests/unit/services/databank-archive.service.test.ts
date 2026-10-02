import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DatabankArchiveService,
  DATABANK_ELIGIBILITY_REASONS,
} from "../../../src/services/databank-archive.service";

/**
 * DL-9: private Research Databank archival registration service.
 * A fake repository isolates the authority/eligibility rules.
 */

function makeRepo() {
  return {
    getStudentByUserId: vi.fn(),
    getThesisIdsForStudent: vi.fn(),
    getFinalConclusionsForThesis: vi.fn(),
    getFinalizedRapForSchedule: vi.fn(),
    getPassedTitleAuthoritiesForThesis: vi.fn(),
    getArchiveByThesisId: vi.fn(),
    createArchive: vi.fn(),
  };
}

function archiveRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "elib-1",
    thesisId: "thesis-1",
    title: "Official Title",
    abstract: null,
    keywords: null,
    isPublic: false,
    publishedAt: null,
    approvedById: null,
    createdAt: new Date("2026-10-01T00:00:00Z"),
    ...overrides,
  };
}

function finalConclusion(overrides: Record<string, unknown> = {}) {
  return {
    outcome: "PASSED",
    scheduleId: "sched-final",
    concludedAt: new Date("2026-09-01T00:00:00Z"),
    ...overrides,
  };
}

function titleAuthority(overrides: Record<string, unknown> = {}) {
  return {
    selectedTitleId: "title-1",
    selectedTitle: {
      id: "title-1",
      thesisId: "thesis-1",
      titleText: "Server Official Title",
    },
    ...overrides,
  };
}

function eligibleRepo(repo: ReturnType<typeof makeRepo>) {
  repo.getStudentByUserId.mockResolvedValue({ id: "student-1" });
  repo.getThesisIdsForStudent.mockResolvedValue(["thesis-1"]);
  repo.getFinalConclusionsForThesis.mockResolvedValue([finalConclusion()]);
  repo.getFinalizedRapForSchedule.mockResolvedValue({
    finalizedAt: new Date("2026-09-02T00:00:00Z"),
  });
  repo.getPassedTitleAuthoritiesForThesis.mockResolvedValue([titleAuthority()]);
  repo.getArchiveByThesisId.mockResolvedValue(null);
  repo.createArchive.mockImplementation(async (data: any) =>
    archiveRow({ title: data.title, abstract: data.abstract, keywords: data.keywords }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("DL-9 archive eligibility (context)", () => {
  it("eligible when Final PASSED + same-schedule Final RAP FINALIZED + official title", async () => {
    const repo = makeRepo();
    eligibleRepo(repo);
    const svc = new DatabankArchiveService(repo as never);

    const dto = await svc.getArchiveContext("user-1");
    expect(dto.eligible).toBe(true);
    expect(dto.reasons).toEqual([]);
    expect(dto.researchContext?.officialTitle).toBe("Server Official Title");
    expect(dto.researchContext?.thesisId).toBe("thesis-1");
    expect(dto.archive).toBeNull();
  });

  it("not eligible when the only Final result is not PASSED", async () => {
    const repo = makeRepo();
    eligibleRepo(repo);
    repo.getFinalConclusionsForThesis.mockResolvedValue([
      finalConclusion({ outcome: "REVISION_REQUIRED" }),
    ]);
    const svc = new DatabankArchiveService(repo as never);

    const dto = await svc.getArchiveContext("user-1");
    expect(dto.eligible).toBe(false);
    expect(dto.reasons).toContain(
      DATABANK_ELIGIBILITY_REASONS.FINAL_DEFENSE_NOT_PASSED,
    );
  });

  it("not eligible when there is no Final conclusion", async () => {
    const repo = makeRepo();
    eligibleRepo(repo);
    repo.getFinalConclusionsForThesis.mockResolvedValue([]);
    const svc = new DatabankArchiveService(repo as never);

    const dto = await svc.getArchiveContext("user-1");
    expect(dto.eligible).toBe(false);
    expect(dto.reasons).toContain(
      DATABANK_ELIGIBILITY_REASONS.FINAL_DEFENSE_NOT_PASSED,
    );
  });

  it("not eligible when Final PASSED but the same-schedule RAP is not FINALIZED", async () => {
    const repo = makeRepo();
    eligibleRepo(repo);
    repo.getFinalizedRapForSchedule.mockResolvedValue(null);
    const svc = new DatabankArchiveService(repo as never);

    const dto = await svc.getArchiveContext("user-1");
    expect(dto.eligible).toBe(false);
    expect(dto.reasons).toContain(
      DATABANK_ELIGIBILITY_REASONS.FINAL_RAP_NOT_FINALIZED,
    );
    // RAP is queried for the EXACT conclusion schedule (never another session).
    expect(repo.getFinalizedRapForSchedule).toHaveBeenCalledWith("sched-final");
  });

  it("fails closed with OFFICIAL_TITLE_MISSING when the official title authority is absent", async () => {
    const repo = makeRepo();
    eligibleRepo(repo);
    repo.getPassedTitleAuthoritiesForThesis.mockResolvedValue([]);
    const svc = new DatabankArchiveService(repo as never);

    const dto = await svc.getArchiveContext("user-1");
    expect(dto.eligible).toBe(false);
    expect(dto.reasons).toEqual([
      DATABANK_ELIGIBILITY_REASONS.OFFICIAL_TITLE_MISSING,
    ]);
  });

  it("fails closed on ambiguous completed contexts across theses (never picks latest)", async () => {
    const repo = makeRepo();
    eligibleRepo(repo);
    repo.getThesisIdsForStudent.mockResolvedValue(["thesis-a", "thesis-b"]);
    repo.getPassedTitleAuthoritiesForThesis.mockImplementation(async (thesisId: string) => [
      {
        selectedTitleId: `title-${thesisId}`,
        selectedTitle: {
          id: `title-${thesisId}`,
          thesisId,
          titleText: `Title ${thesisId}`,
        },
      },
    ]);
    const svc = new DatabankArchiveService(repo as never);

    const dto = await svc.getArchiveContext("user-1");
    expect(dto.eligible).toBe(false);
    expect(dto.reasons).toEqual([
      DATABANK_ELIGIBILITY_REASONS.RESEARCH_CONTEXT_AMBIGUOUS,
    ]);
  });

  it("throws 404 when the Student profile is missing", async () => {
    const repo = makeRepo();
    repo.getStudentByUserId.mockResolvedValue(null);
    const svc = new DatabankArchiveService(repo as never);
    await expect(svc.getArchiveContext("user-x")).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe("DL-9 multiple Final conclusions", () => {
  it("one valid + one passed-without-finalized-RAP → exactly one completed context", async () => {
    const repo = makeRepo();
    eligibleRepo(repo);
    repo.getFinalConclusionsForThesis.mockResolvedValue([
      finalConclusion({ scheduleId: "sched-a", concludedAt: new Date("2026-01-01") }),
      finalConclusion({ scheduleId: "sched-b", concludedAt: new Date("2026-12-01") }),
    ]);
    repo.getFinalizedRapForSchedule.mockImplementation(async (scheduleId: string) =>
      scheduleId === "sched-a" ? { finalizedAt: new Date("2026-01-02") } : null,
    );
    const svc = new DatabankArchiveService(repo as never);

    const dto = await svc.getArchiveContext("user-1");
    expect(dto.eligible).toBe(true);
    expect(dto.reasons).toEqual([]);
  });

  it("one valid + one non-PASSED (later) → earlier valid context is used", async () => {
    const repo = makeRepo();
    eligibleRepo(repo);
    repo.getFinalConclusionsForThesis.mockResolvedValue([
      finalConclusion({ scheduleId: "sched-a", concludedAt: new Date("2026-01-01") }),
      finalConclusion({
        scheduleId: "sched-b",
        outcome: "REVISION_REQUIRED",
        concludedAt: new Date("2026-12-01"),
      }),
    ]);
    repo.getFinalizedRapForSchedule.mockImplementation(async (scheduleId: string) =>
      scheduleId === "sched-a" ? { finalizedAt: new Date("2026-01-02") } : null,
    );
    const svc = new DatabankArchiveService(repo as never);

    const dto = await svc.getArchiveContext("user-1");
    expect(dto.eligible).toBe(true);
  });

  it("two valid completed Final contexts → RESEARCH_CONTEXT_AMBIGUOUS regardless of recency", async () => {
    const repo = makeRepo();
    eligibleRepo(repo);
    repo.getFinalConclusionsForThesis.mockResolvedValue([
      finalConclusion({ scheduleId: "sched-a", concludedAt: new Date("2026-01-01") }),
      finalConclusion({ scheduleId: "sched-b", concludedAt: new Date("2026-12-01") }),
    ]);
    repo.getFinalizedRapForSchedule.mockResolvedValue({
      finalizedAt: new Date("2026-12-02"),
    });
    const svc = new DatabankArchiveService(repo as never);

    const dto = await svc.getArchiveContext("user-1");
    expect(dto.eligible).toBe(false);
    expect(dto.reasons).toEqual([
      DATABANK_ELIGIBILITY_REASONS.RESEARCH_CONTEXT_AMBIGUOUS,
    ]);
  });
});

describe("DL-9 official title authority", () => {
  it("duplicate PASSED Title conclusions pointing at the same selectedTitleId resolve safely", async () => {
    const repo = makeRepo();
    eligibleRepo(repo);
    repo.getPassedTitleAuthoritiesForThesis.mockResolvedValue([
      titleAuthority(),
      titleAuthority(),
    ]);
    const svc = new DatabankArchiveService(repo as never);

    const dto = await svc.getArchiveContext("user-1");
    expect(dto.eligible).toBe(true);
    expect(dto.researchContext?.officialTitle).toBe("Server Official Title");
  });

  it("two PASSED Title conclusions with different selectedTitleId fail closed", async () => {
    const repo = makeRepo();
    eligibleRepo(repo);
    repo.getPassedTitleAuthoritiesForThesis.mockResolvedValue([
      titleAuthority(),
      titleAuthority({
        selectedTitleId: "title-2",
        selectedTitle: { id: "title-2", thesisId: "thesis-1", titleText: "Other Title" },
      }),
    ]);
    const svc = new DatabankArchiveService(repo as never);

    const dto = await svc.getArchiveContext("user-1");
    expect(dto.eligible).toBe(false);
    expect(dto.reasons).toEqual([
      DATABANK_ELIGIBILITY_REASONS.RESEARCH_CONTEXT_AMBIGUOUS,
    ]);
  });

  it("cross-thesis selected title fails closed", async () => {
    const repo = makeRepo();
    eligibleRepo(repo);
    repo.getPassedTitleAuthoritiesForThesis.mockResolvedValue([
      titleAuthority({
        selectedTitle: {
          id: "title-1",
          thesisId: "thesis-other",
          titleText: "Stolen Title",
        },
      }),
    ]);
    const svc = new DatabankArchiveService(repo as never);

    const dto = await svc.getArchiveContext("user-1");
    expect(dto.eligible).toBe(false);
    expect(dto.reasons).toEqual([
      DATABANK_ELIGIBILITY_REASONS.OFFICIAL_TITLE_MISSING,
    ]);
  });

  it("missing selected title relation fails closed", async () => {
    const repo = makeRepo();
    eligibleRepo(repo);
    repo.getPassedTitleAuthoritiesForThesis.mockResolvedValue([
      { selectedTitleId: "title-1", selectedTitle: null },
    ]);
    const svc = new DatabankArchiveService(repo as never);

    const dto = await svc.getArchiveContext("user-1");
    expect(dto.eligible).toBe(false);
    expect(dto.reasons).toEqual([
      DATABANK_ELIGIBILITY_REASONS.OFFICIAL_TITLE_MISSING,
    ]);
  });
});

describe("DL-9 private archive registration", () => {
  it("registers with server-derived title + private state and null legacy paths", async () => {
    const repo = makeRepo();
    eligibleRepo(repo);
    const svc = new DatabankArchiveService(repo as never);

    const dto = await svc.registerArchive("user-1", {
      abstract: "  My abstract  ",
      keywords: " ai, education ",
    });

    const data = repo.createArchive.mock.calls[0][0];
    expect(data).toEqual({
      thesisId: "thesis-1",
      title: "Server Official Title",
      abstract: "My abstract",
      keywords: "ai, education",
    });
    expect(dto.officialTitle).toBe("Server Official Title");
  });

  it("ignores client-supplied authority fields and paths", async () => {
    const repo = makeRepo();
    eligibleRepo(repo);
    const svc = new DatabankArchiveService(repo as never);

    await svc.registerArchive("user-1", {
      abstract: "ok",
      keywords: null,
      thesisId: "another-students-thesis",
      title: "Attacker supplied title",
      fullPaperPath: "/srv/private/secret.pdf",
      respondentDataPath: "../../data.zip",
      storageKey: "private/key",
      isPublic: true,
      publishedAt: "2020-01-01",
      approvedById: "admin-x",
    } as never);

    const data = repo.createArchive.mock.calls[0][0];
    expect(data.thesisId).toBe("thesis-1");
    expect(data.title).toBe("Server Official Title");
    expect(Object.keys(data).sort()).toEqual(
      ["abstract", "keywords", "thesisId", "title"].sort(),
    );
    const serialized = JSON.stringify(data);
    for (const forbidden of [
      "secret.pdf",
      "data.zip",
      "storageKey",
      "isPublic",
      "publishedAt",
      "approvedById",
      "another-students-thesis",
      "Attacker",
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it("normalizes empty optional metadata to null", async () => {
    const repo = makeRepo();
    eligibleRepo(repo);
    const svc = new DatabankArchiveService(repo as never);
    await svc.registerArchive("user-1", { abstract: "   ", keywords: "" });
    const data = repo.createArchive.mock.calls[0][0];
    expect(data.abstract).toBeNull();
    expect(data.keywords).toBeNull();
  });

  it("409 when an archive already exists for the thesis", async () => {
    const repo = makeRepo();
    eligibleRepo(repo);
    repo.getArchiveByThesisId.mockResolvedValue(archiveRow());
    const svc = new DatabankArchiveService(repo as never);
    await expect(svc.registerArchive("user-1", {})).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(repo.createArchive).not.toHaveBeenCalled();
  });

  it("maps a concurrent unique violation to a safe 409", async () => {
    const repo = makeRepo();
    eligibleRepo(repo);
    repo.createArchive.mockRejectedValue({ code: "P2002" });
    const svc = new DatabankArchiveService(repo as never);
    await expect(svc.registerArchive("user-1", {})).rejects.toMatchObject({
      statusCode: 409,
      message: /already registered/i,
    });
  });

  it("rejects registration when not eligible", async () => {
    const repo = makeRepo();
    eligibleRepo(repo);
    repo.getFinalizedRapForSchedule.mockResolvedValue(null);
    const svc = new DatabankArchiveService(repo as never);
    await expect(svc.registerArchive("user-1", {})).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(repo.createArchive).not.toHaveBeenCalled();
  });

  it("returns 409 for ambiguous context registration", async () => {
    const repo = makeRepo();
    eligibleRepo(repo);
    repo.getThesisIdsForStudent.mockResolvedValue(["thesis-a", "thesis-b"]);
    repo.getPassedTitleAuthoritiesForThesis.mockImplementation(async (thesisId: string) => [
      {
        selectedTitleId: `title-${thesisId}`,
        selectedTitle: {
          id: `title-${thesisId}`,
          thesisId,
          titleText: `Title ${thesisId}`,
        },
      },
    ]);
    const svc = new DatabankArchiveService(repo as never);
    await expect(svc.registerArchive("user-1", {})).rejects.toMatchObject({
      statusCode: 409,
    });
  });
});

describe("DL-9 archive DTO privacy + existing archive", () => {
  it("returns an existing archive without creating another", async () => {
    const repo = makeRepo();
    eligibleRepo(repo);
    repo.getArchiveByThesisId.mockResolvedValue(
      archiveRow({ abstract: "a", keywords: "k" }),
    );
    const svc = new DatabankArchiveService(repo as never);
    const dto = await svc.getArchiveContext("user-1");
    expect(dto.archive?.id).toBe("elib-1");
    expect(dto.archive?.officialTitle).toBe("Server Official Title");
    expect(repo.createArchive).not.toHaveBeenCalled();
  });

  it("never serializes raw paths/storage/checksum/signature fields", async () => {
    const repo = makeRepo();
    eligibleRepo(repo);
    repo.getArchiveByThesisId.mockResolvedValue(
      archiveRow({
        fullPaperPath: "/srv/private/x.pdf",
        respondentDataPath: "../../y.zip",
        storageKey: "k",
        checksum: "c",
        signatureData: "sig",
      }),
    );
    const svc = new DatabankArchiveService(repo as never);
    const dto = await svc.getArchiveContext("user-1");
    const json = JSON.stringify(dto);
    for (const forbidden of [
      "fullPaperPath",
      "respondentDataPath",
      "filePath",
      "storageKey",
      "checksum",
      "signatureData",
      "srv/private",
    ]) {
      expect(json).not.toContain(forbidden);
    }
  });
});
