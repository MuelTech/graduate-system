import { beforeEach, describe, expect, it, vi } from "vitest";
import { RepositoryPublicationService } from "../../../src/services/repository-publication.service";

/**
 * DL-10: Research Repository publication service.
 *
 * The public projection must be identical no matter who reads it, and must
 * never leak paths, internal documents/certifications, signatures, checksums,
 * student number, email, or internal ids.
 */

function makeRepo() {
  return {
    searchPublished: vi.fn(),
    findPublishedById: vi.fn(),
    findAllForAdmin: vi.fn(),
    findAdminById: vi.fn(),
    getPublicationState: vi.fn(),
    publishIfPrivate: vi.fn(),
    unpublishIfPublic: vi.fn(),
  };
}

function publishedRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "elib-1",
    title: "Impact of AI",
    abstract: "An abstract",
    keywords: "ai, education ,, machine learning",
    publishedAt: new Date("2026-05-01T00:00:00Z"),
    thesis: {
      student: {
        user: { firstName: "Jane", lastName: "Doe" },
        program: { programName: "MS Computer Science" },
      },
    },
    ...overrides,
  };
}

function adminRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "elib-1",
    title: "Impact of AI",
    abstract: "An abstract",
    keywords: "ai, education",
    isPublic: false,
    publishedAt: null,
    createdAt: new Date("2026-04-01T00:00:00Z"),
    thesis: {
      student: {
        studentNumber: "2026-0001",
        user: { firstName: "Jane", lastName: "Doe" },
        program: { programName: "MS Computer Science" },
      },
    },
    ...overrides,
  };
}

beforeEach(() => vi.clearAllMocks());

describe("DL-10 public projection", () => {
  it("projects only safe public fields and normalizes keywords to an array", async () => {
    const repo = makeRepo();
    repo.searchPublished.mockResolvedValue([publishedRow()]);
    const svc = new RepositoryPublicationService(repo as never);

    const [dto] = await svc.listPublished();

    expect(dto).toEqual({
      id: "elib-1",
      title: "Impact of AI",
      author: "Jane Doe",
      program: "MS Computer Science",
      abstract: "An abstract",
      keywords: ["ai", "education", "machine learning"],
      publishedAt: "2026-05-01T00:00:00.000Z",
      artifact: { available: false, policyResolved: false },
    });
  });

  it("passes the search query through and never inspects a caller role", async () => {
    const repo = makeRepo();
    repo.searchPublished.mockResolvedValue([]);
    const svc = new RepositoryPublicationService(repo as never);

    await svc.listPublished("machine");

    expect(repo.searchPublished).toHaveBeenCalledWith("machine");
    // No role parameter exists on the public surface at all.
    expect(svc.listPublished.length).toBeLessThanOrEqual(1);
  });

  it("returns null publication date and empty keywords safely", async () => {
    const repo = makeRepo();
    repo.searchPublished.mockResolvedValue([
      publishedRow({ keywords: null, publishedAt: null, abstract: null }),
    ]);
    const svc = new RepositoryPublicationService(repo as never);

    const [dto] = await svc.listPublished();

    expect(dto.keywords).toEqual([]);
    expect(dto.publishedAt).toBeNull();
    expect(dto.abstract).toBeNull();
  });

  it("never serializes paths, respondent data, certifications, signatures, checksums, or internal ids", async () => {
    const repo = makeRepo();
    repo.searchPublished.mockResolvedValue([
      publishedRow({
        fullPaperPath: "/srv/secret/final.pdf",
        respondentDataPath: "../../respondents.xlsx",
        thesisId: "thesis-1",
        approvedById: "admin-1",
        storageKey: "k",
        checksum: "c",
        signatureData: "sig",
        thesisDocuments: [{ filePath: "/srv/secret/doc.pdf" }],
        adviserCertifications: [{ id: "cert" }],
        statisticianCertification: { id: "stat" },
        grammarianCertification: { id: "gram" },
        researchVariableForms: [{ id: "var" }],
      }),
    ]);
    const svc = new RepositoryPublicationService(repo as never);

    const [dto] = await svc.listPublished();
    const serialized = JSON.stringify(dto);

    for (const forbidden of [
      "fullPaperPath",
      "respondentDataPath",
      "filePath",
      "storageKey",
      "checksum",
      "signatureData",
      "thesisDocuments",
      "adviserCertifications",
      "statisticianCertification",
      "grammarianCertification",
      "researchVariableForms",
      "thesisId",
      "approvedById",
      "studentNumber",
      "srv/secret",
      "respondents.xlsx",
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it("getPublished returns the safe projection", async () => {
    const repo = makeRepo();
    repo.findPublishedById.mockResolvedValue(publishedRow());
    const svc = new RepositoryPublicationService(repo as never);

    const dto = await svc.getPublished("elib-1");
    expect(dto.id).toBe("elib-1");
    expect(dto.artifact).toEqual({ available: false, policyResolved: false });
  });

  it("getPublished throws a 404 for private or unknown ids", async () => {
    const repo = makeRepo();
    repo.findPublishedById.mockResolvedValue(null);
    const svc = new RepositoryPublicationService(repo as never);

    await expect(svc.getPublished("private-archive")).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe("DL-10 admin publication list", () => {
  it("exposes student number and nested publication state but no raw paths", async () => {
    const repo = makeRepo();
    repo.findAllForAdmin.mockResolvedValue([adminRow()]);
    const svc = new RepositoryPublicationService(repo as never);

    const [dto] = await svc.listAdminEntries();

    expect(dto).toEqual({
      id: "elib-1",
      title: "Impact of AI",
      author: "Jane Doe",
      studentNumber: "2026-0001",
      program: "MS Computer Science",
      abstract: "An abstract",
      keywords: ["ai", "education"],
      archiveRegisteredAt: "2026-04-01T00:00:00.000Z",
      publication: { isPublished: false, publishedAt: null },
      artifact: { available: false, policyResolved: false },
    });
    const serialized = JSON.stringify(dto);
    expect(serialized).not.toContain("fullPaperPath");
    expect(serialized).not.toContain("respondentDataPath");
    expect(serialized).not.toContain("storageKey");
  });
});

describe("DL-10 publish transition", () => {
  it("404 when the archive id does not exist", async () => {
    const repo = makeRepo();
    repo.getPublicationState.mockResolvedValue(null);
    const svc = new RepositoryPublicationService(repo as never);

    await expect(svc.publishMetadata("missing", "admin-9")).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(repo.publishIfPrivate).not.toHaveBeenCalled();
  });

  it("409 when the archive is already published", async () => {
    const repo = makeRepo();
    repo.getPublicationState.mockResolvedValue({ id: "elib-1", isPublic: true });
    const svc = new RepositoryPublicationService(repo as never);

    await expect(svc.publishMetadata("elib-1", "admin-9")).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(repo.publishIfPrivate).not.toHaveBeenCalled();
  });

  it("publishes a private archive with the JWT admin actor and a server timestamp", async () => {
    const repo = makeRepo();
    repo.getPublicationState.mockResolvedValue({ id: "elib-1", isPublic: false });
    repo.publishIfPrivate.mockResolvedValue(1);
    repo.findAdminById.mockResolvedValue(
      adminRow({ isPublic: true, publishedAt: new Date("2026-10-03T00:00:00Z") }),
    );
    const svc = new RepositoryPublicationService(repo as never);
    const before = Date.now();

    const dto = await svc.publishMetadata("elib-1", "admin-9");

    const call = repo.publishIfPrivate.mock.calls[0];
    expect(call[0]).toBe("elib-1");
    expect(call[1]).toBe("admin-9");
    expect(call[2]).toBeInstanceOf(Date);
    expect(call[2].getTime()).toBeGreaterThanOrEqual(before);
    expect(dto.publication.isPublished).toBe(true);
  });

  it("maps a concurrent race (0 rows updated) to 409, never a Prisma error", async () => {
    const repo = makeRepo();
    repo.getPublicationState.mockResolvedValue({ id: "elib-1", isPublic: false });
    repo.publishIfPrivate.mockResolvedValue(0);
    const svc = new RepositoryPublicationService(repo as never);

    await expect(svc.publishMetadata("elib-1", "admin-9")).rejects.toMatchObject({
      statusCode: 409,
    });
  });
});

describe("DL-10 unpublish transition", () => {
  it("404 when the archive id does not exist", async () => {
    const repo = makeRepo();
    repo.getPublicationState.mockResolvedValue(null);
    const svc = new RepositoryPublicationService(repo as never);

    await expect(svc.unpublishMetadata("missing")).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(repo.unpublishIfPublic).not.toHaveBeenCalled();
  });

  it("409 when the archive is already private", async () => {
    const repo = makeRepo();
    repo.getPublicationState.mockResolvedValue({ id: "elib-1", isPublic: false });
    const svc = new RepositoryPublicationService(repo as never);

    await expect(svc.unpublishMetadata("elib-1")).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(repo.unpublishIfPublic).not.toHaveBeenCalled();
  });

  it("unpublishes a public archive without deleting the private archive", async () => {
    const repo = makeRepo();
    repo.getPublicationState.mockResolvedValue({ id: "elib-1", isPublic: true });
    repo.unpublishIfPublic.mockResolvedValue(1);
    repo.findAdminById.mockResolvedValue(adminRow({ isPublic: false }));
    const svc = new RepositoryPublicationService(repo as never);

    const dto = await svc.unpublishMetadata("elib-1");

    expect(repo.unpublishIfPublic).toHaveBeenCalledWith("elib-1");
    expect(dto.publication.isPublished).toBe(false);
  });

  it("maps a concurrent race (0 rows updated) to 409", async () => {
    const repo = makeRepo();
    repo.getPublicationState.mockResolvedValue({ id: "elib-1", isPublic: true });
    repo.unpublishIfPublic.mockResolvedValue(0);
    const svc = new RepositoryPublicationService(repo as never);

    await expect(svc.unpublishMetadata("elib-1")).rejects.toMatchObject({
      statusCode: 409,
    });
  });
});
