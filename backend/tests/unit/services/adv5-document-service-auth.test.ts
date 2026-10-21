import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  thesisDocument: { findUnique: vi.fn() },
  auditLog: { create: vi.fn() },
}));

const storageMock = vi.hoisted(() => ({
  storageService: {
    resolveReadPath: vi.fn(),
    pickMimeType: vi.fn(),
    pickOriginalFilename: vi.fn(),
  },
}));

vi.mock("../../../src/config/database", () => ({ default: prismaMock }));
vi.mock("../../../src/storage", () => storageMock);

import { DocumentService } from "../../../src/services/document.service";

function thesisDocument(overrides: Record<string, unknown> = {}) {
  return {
    id: "doc-1",
    thesisId: "thesis-1",
    docType: "PROPOSAL_CHAPTERS",
    defenseStage: "PROPOSAL",
    storageKey: "managed/doc-1",
    filePath: "/private/doc-1.pdf",
    verifiedMimeType: "application/pdf",
    originalFilename: "proposal.pdf",
    thesis: {
      id: "thesis-1",
      student: {
        user: { id: "owner-1" },
        adviserAssignments: [],
      },
      adviserCertifications: [],
      defenseSchedules: [],
    },
    ...overrides,
  } as never;
}

describe("ADV-5 DocumentService authority regression", () => {
  const service = new DocumentService();

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.user.findUnique.mockResolvedValue({
      role: "PANELIST",
      isActive: true,
    });
    prismaMock.auditLog.create.mockResolvedValue({});
    storageMock.storageService.resolveReadPath.mockResolvedValue(
      "/private/doc-1.pdf",
    );
    storageMock.storageService.pickMimeType.mockReturnValue("application/pdf");
    storageMock.storageService.pickOriginalFilename.mockReturnValue(
      "proposal.pdf",
    );
  });

  it("keeps owner access unchanged", async () => {
    prismaMock.thesisDocument.findUnique.mockResolvedValue(
      thesisDocument({
        docType: "COR",
        defenseStage: "PROPOSAL",
      }),
    );

    await expect(
      service.resolveDocument("thesis-document", "doc-1", "owner-1", "STUDENT"),
    ).resolves.toMatchObject({ mimeType: "application/pdf" });
  });

  it("keeps Admin access unchanged", async () => {
    prismaMock.thesisDocument.findUnique.mockResolvedValue(
      thesisDocument({
        docType: "RECEIPT",
        defenseStage: "FINAL",
      }),
    );

    await expect(
      service.resolveDocument("thesis-document", "doc-1", "admin-1", "ADMIN"),
    ).resolves.toMatchObject({ mimeType: "application/pdf" });
  });

  it("allows a valid active-Adviser academic manuscript", async () => {
    prismaMock.thesisDocument.findUnique.mockResolvedValue(
      thesisDocument({
        thesis: {
          id: "thesis-1",
          student: {
            user: { id: "owner-1" },
            adviserAssignments: [{ adviserId: "adviser-1" }],
          },
          adviserCertifications: [],
          defenseSchedules: [],
        },
      }),
    );

    await expect(
      service.resolveDocument(
        "thesis-document",
        "doc-1",
        "adviser-1",
        "PANELIST",
      ),
    ).resolves.toMatchObject({ mimeType: "application/pdf" });
  });

  it("denies non-manuscript evidence to the active Adviser", async () => {
    prismaMock.thesisDocument.findUnique.mockResolvedValue(
      thesisDocument({
        docType: "COR",
        defenseStage: "PROPOSAL",
        thesis: {
          id: "thesis-1",
          student: {
            user: { id: "owner-1" },
            adviserAssignments: [{ adviserId: "adviser-1" }],
          },
          adviserCertifications: [],
          defenseSchedules: [],
        },
      }),
    );

    await expect(
      service.resolveDocument(
        "thesis-document",
        "doc-1",
        "adviser-1",
        "PANELIST",
      ),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("keeps a valid same-stage committee assignment working", async () => {
    prismaMock.thesisDocument.findUnique.mockResolvedValue(
      thesisDocument({
        thesis: {
          id: "thesis-1",
          student: {
            user: { id: "owner-1" },
            adviserAssignments: [],
          },
          adviserCertifications: [],
          defenseSchedules: [
            {
              id: "sched-1",
              defenseType: "PROPOSAL_DEFENSE",
              manuscriptDocumentId: "doc-1",
              panelAssignments: [{ userId: "panelist-1" }],
              conclusion: null,
            },
          ],
        },
      }),
    );

    await expect(
      service.resolveDocument(
        "thesis-document",
        "doc-1",
        "panelist-1",
        "PANELIST",
      ),
    ).resolves.toMatchObject({ mimeType: "application/pdf" });
  });
});
