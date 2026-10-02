import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  eLibrary: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    updateMany: vi.fn(),
  },
}));

vi.mock("../../../src/config/database", () => ({ default: prismaMock }));

import { RepositoryPublicationRepository } from "../../../src/repositories/repository-publication.repository";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("DL-10 RepositoryPublicationRepository", () => {
  it("public search always filters isPublic:true and never selects raw paths", async () => {
    prismaMock.eLibrary.findMany.mockResolvedValue([]);
    const repo = new RepositoryPublicationRepository();

    await repo.searchPublished("ml");

    const args = prismaMock.eLibrary.findMany.mock.calls[0][0];
    expect(args.where.isPublic).toBe(true);
    expect(args.select).not.toHaveProperty("fullPaperPath");
    expect(args.select).not.toHaveProperty("respondentDataPath");
    expect(args.select).not.toHaveProperty("approvedById");
    // Student number is internal and must not be part of the public projection.
    expect(args.select.thesis.select.student.select).not.toHaveProperty(
      "studentNumber",
    );
    const serializedWhere = JSON.stringify(args.where);
    expect(serializedWhere).toContain("ml");
  });

  it("public detail is filtered by BOTH id and isPublic:true", async () => {
    prismaMock.eLibrary.findFirst.mockResolvedValue(null);
    const repo = new RepositoryPublicationRepository();

    await repo.findPublishedById("elib-1");

    const args = prismaMock.eLibrary.findFirst.mock.calls[0][0];
    expect(args.where).toEqual({ id: "elib-1", isPublic: true });
    expect(args.select).not.toHaveProperty("fullPaperPath");
    expect(args.select).not.toHaveProperty("respondentDataPath");
  });

  it("admin list selects publication state + student number but never raw paths", async () => {
    prismaMock.eLibrary.findMany.mockResolvedValue([]);
    const repo = new RepositoryPublicationRepository();

    await repo.findAllForAdmin();

    const select = prismaMock.eLibrary.findMany.mock.calls[0][0].select;
    expect(select).toMatchObject({
      id: true,
      title: true,
      abstract: true,
      keywords: true,
      isPublic: true,
      publishedAt: true,
      createdAt: true,
    });
    expect(select).not.toHaveProperty("fullPaperPath");
    expect(select).not.toHaveProperty("respondentDataPath");
    expect(select).not.toHaveProperty("approvedById");
    expect(select.thesis.select.student.select.studentNumber).toBe(true);
  });

  it("publish is a conditional update from private to public with server timestamp + admin actor", async () => {
    prismaMock.eLibrary.updateMany.mockResolvedValue({ count: 1 });
    const repo = new RepositoryPublicationRepository();
    const publishedAt = new Date("2026-10-03T00:00:00Z");

    await repo.publishIfPrivate("elib-1", "admin-9", publishedAt);

    expect(prismaMock.eLibrary.updateMany).toHaveBeenCalledWith({
      where: { id: "elib-1", isPublic: false },
      data: {
        isPublic: true,
        publishedAt,
        approvedById: "admin-9",
      },
    });
  });

  it("unpublish is a conditional update from public to private without touching archive metadata", async () => {
    prismaMock.eLibrary.updateMany.mockResolvedValue({ count: 1 });
    const repo = new RepositoryPublicationRepository();

    await repo.unpublishIfPublic("elib-1");

    expect(prismaMock.eLibrary.updateMany).toHaveBeenCalledWith({
      where: { id: "elib-1", isPublic: true },
      data: { isPublic: false },
    });
  });

  it("getPublicationState reads only id + isPublic", async () => {
    prismaMock.eLibrary.findUnique.mockResolvedValue(null);
    const repo = new RepositoryPublicationRepository();

    await repo.getPublicationState("elib-1");

    expect(prismaMock.eLibrary.findUnique).toHaveBeenCalledWith({
      where: { id: "elib-1" },
      select: { id: true, isPublic: true },
    });
  });

  it("findAdminById uses a safe admin select", async () => {
    prismaMock.eLibrary.findUnique.mockResolvedValue(null);
    const repo = new RepositoryPublicationRepository();

    await repo.findAdminById("elib-1");

    const select = prismaMock.eLibrary.findUnique.mock.calls[0][0].select;
    expect(select).not.toHaveProperty("fullPaperPath");
    expect(select).not.toHaveProperty("respondentDataPath");
    expect(select).not.toHaveProperty("approvedById");
  });
});
