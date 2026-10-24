import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../../../src/config/database", () => ({ default: {} }));
import { ScheduledDefenseSubmissionService } from "../../../src/services/scheduled-defense-submission.service";
import { DefenseApplicationDocumentHistoryService } from "../../../src/services/defense-document-history.service";

const ADMIN = { userId: "admin", role: "ADMIN" };
const doc = {
  id: "doc-v1",
  thesisId: "thesis-1",
  docType: "PROPOSAL_CHAPTERS",
  defenseStage: "PROPOSAL",
  manuscriptTitle: "Exact V1 Title",
  originalFilename: "v1.pdf",
};
const schedule = {
  id: "schedule-1",
  thesisId: "thesis-1",
  defenseType: "PROPOSAL_DEFENSE",
  manuscriptDocumentId: "doc-v1",
  manuscriptDocument: doc,
};
const cert = {
  id: "cert-1",
  thesisId: "thesis-1",
  stage: "PROPOSAL",
  manuscriptDocumentId: "doc-v1",
  status: "ISSUED",
  pdfAvailable: true,
};
const findUnique = vi.fn();
const evidence = vi.fn();
const certifications = vi.fn();
const service = new ScheduledDefenseSubmissionService(
  { defenseSchedule: { findUnique } } as never,
  { getStageSupportingEvidence: evidence },
  { listAdviserCertifications: certifications },
);

describe("PREDEF-2 exact scheduled submission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findUnique.mockResolvedValue(schedule);
    evidence.mockResolvedValue([]);
    certifications.mockResolvedValue([cert]);
  });
  it("returns the exact bound historical v1, with no current/latest manuscript query", async () => {
    const result = await service.getSubmission("schedule-1", ADMIN);
    expect(result.manuscript).toMatchObject({
      id: "doc-v1",
      manuscriptTitle: "Exact V1 Title",
      originalFilename: "v1.pdf",
    });
    expect(result.manuscriptIntegrityError).toBeNull();
    expect(findUnique).toHaveBeenCalledExactlyOnceWith({
      where: { id: "schedule-1" },
      select: expect.objectContaining({
        manuscriptDocumentId: true,
        manuscriptDocument: expect.any(Object),
      }),
    });
    expect(JSON.stringify(findUnique.mock.calls)).not.toMatch(
      /isCurrent|orderBy|findFirst|findMany/,
    );
    expect(result.certification.record?.id).toBe("cert-1");
  });
  it.each([
    { manuscriptDocumentId: null },
    { manuscriptDocument: null },
    { manuscriptDocument: { ...doc, id: "doc-v2" } },
    { manuscriptDocument: { ...doc, thesisId: "other-thesis" } },
    { manuscriptDocument: { ...doc, defenseStage: "FINAL" } },
    { manuscriptDocument: { ...doc, docType: "FINAL_MANUSCRIPT" } },
    { manuscriptDocument: { ...doc, docType: "COR" } },
  ])(
    "surfaces invalid exact binding %j without recovery",
    async (overrides) => {
      findUnique.mockResolvedValue({ ...schedule, ...overrides });
      const result = await service.getSubmission("schedule-1", ADMIN);
      expect(result.manuscript).toBeNull();
      expect(result.manuscriptIntegrityError).toMatch(/exact schedule-bound/);
      expect(result.certification.record).toBeNull();
      expect(certifications).not.toHaveBeenCalled();
    },
  );
  it.each(["PROPOSAL", "FINAL"])(
    "selects only exact %s certification and stage evidence",
    async (stage) => {
      findUnique.mockResolvedValue({
        ...schedule,
        defenseType: `${stage}_DEFENSE`,
        manuscriptDocument: {
          ...doc,
          defenseStage: stage,
          docType: stage === "FINAL" ? "FINAL_MANUSCRIPT" : "PROPOSAL_CHAPTERS",
        },
      });
      certifications.mockResolvedValue([
        { ...cert, stage, manuscriptDocumentId: "newer-doc" },
        { ...cert, stage: "TITLE" },
        { ...cert, stage, thesisId: "other" },
        { ...cert, stage },
      ]);
      const result = await service.getSubmission("schedule-1", ADMIN);
      expect(result.certification.record).toMatchObject({
        stage,
        manuscriptDocumentId: "doc-v1",
      });
      expect(evidence).toHaveBeenCalledWith("thesis-1", stage);
      expect(certifications).toHaveBeenCalledWith(ADMIN, "thesis-1", stage);
    },
  );
  it("uses the exact Title package and never queries GS-017", async () => {
    findUnique.mockResolvedValue({
      ...schedule,
      defenseType: "TITLE_DEFENSE",
      manuscriptDocument: {
        ...doc,
        docType: "TITLE_PROPOSAL",
        defenseStage: "TITLE",
        manuscriptTitle: null,
      },
    });
    const result = await service.getSubmission("schedule-1", ADMIN);
    expect(result.manuscript?.id).toBe("doc-v1");
    expect(result.manuscript?.manuscriptTitle).toBeNull();
    expect(result.certification).toEqual({
      integrityState: "NOT_APPLICABLE",
      record: null,
    });
    expect(certifications).not.toHaveBeenCalled();
  });
  it.each(
    [
      [],
      [{ ...cert, manuscriptDocumentId: "doc-v2" }],
      [{ ...cert, status: "CHANGES_REQUESTED" }],
      [cert, { ...cert, id: "cert-2" }],
    ].map((rows) => ({ rows })),
  )(
    "fails closed on missing or ambiguous exact certification $rows",
    async ({ rows }) => {
      certifications.mockResolvedValue(rows);
      const result = await service.getSubmission("schedule-1", ADMIN);
      expect(result.certification.record).toBeNull();
      expect(result.certification.integrityState).toBe(
        rows.length === 2 ? "AMBIGUOUS" : "MISSING",
      );
    },
  );
  it("preserves safe unavailable GS-017 metadata for an exact legacy certification", async () => {
    certifications.mockResolvedValue([
      {
        ...cert,
        pdfAvailable: false,
        unavailableReason: "GS-017 is unavailable.",
      },
    ]);
    expect(
      (await service.getSubmission("schedule-1", ADMIN)).certification.record
        ?.pdfAvailable,
    ).toBe(false);
  });
  it.each(["STUDENT", "PANELIST", "APPLICANT", ""])(
    "denies %s before reading context",
    async (role) => {
      await expect(
        service.getSubmission("schedule-1", { userId: "actor", role }),
      ).rejects.toMatchObject({ statusCode: 403 });
      expect(findUnique).not.toHaveBeenCalled();
    },
  );
  it("rejects absent schedule", async () => {
    findUnique.mockResolvedValue(null);
    await expect(service.getSubmission("missing", ADMIN)).rejects.toMatchObject(
      { statusCode: 404 },
    );
  });
  it("whitelists manuscript metadata", async () => {
    findUnique.mockResolvedValue({
      ...schedule,
      manuscriptDocument: {
        ...doc,
        storageKey: "private",
        filePath: "private",
        checksum: "private",
        signatureData: "private",
      },
    });
    expect(
      JSON.stringify(await service.getSubmission("schedule-1", ADMIN)),
    ).not.toMatch(/storageKey|filePath|checksum|signatureData|private/);
  });
});

describe("PREDEF-2 stage supporting evidence reuses accepted currentness and history", () => {
  const row = (
    id: string,
    docType: string,
    stage = "PROPOSAL",
    isCurrent = true,
  ) => ({
    id,
    docType,
    defenseStage: stage,
    originalFilename: `${id}.pdf`,
    uploadedAt: new Date("2026-10-01"),
    isCurrent,
    supersedesDocumentId: isCurrent ? "rejected-old" : null,
    verifiedMimeType: "application/pdf",
    sizeBytes: 42,
  });
  it("keeps COR/receipt current, excludes wrong-stage evidence and Title packages, retains rejected replacements", async () => {
    const getStageDocuments = vi
      .fn()
      .mockResolvedValue([
        row("cor", "COR"),
        row("receipt", "RECEIPT"),
        row("rejected-old", "COR", "PROPOSAL", false),
        row("wrong", "RECEIPT", "FINAL"),
        row("title", "TITLE_PROPOSAL"),
      ]);
    const history = new DefenseApplicationDocumentHistoryService({
      getStageDocuments,
    } as never);
    const slots = await history.getStageSupportingEvidence(
      "thesis-1",
      "PROPOSAL",
    );
    expect(getStageDocuments).toHaveBeenCalledExactlyOnceWith(
      "thesis-1",
      "PROPOSAL",
    );
    expect(slots).toHaveLength(2);
    expect(slots[0]).toMatchObject({
      docType: "COR",
      current: { id: "cor" },
      history: [{ id: "rejected-old", isCurrent: false }],
      integrityState: "OK",
    });
    expect(slots[1]).toMatchObject({
      docType: "RECEIPT",
      current: { id: "receipt" },
      integrityState: "OK",
    });
    expect(JSON.stringify(slots)).not.toContain("wrong");
  });
  it("does not choose a newest upload among multiple current rows", async () => {
    const history = new DefenseApplicationDocumentHistoryService({
      getStageDocuments: vi
        .fn()
        .mockResolvedValue([row("a", "COR"), row("b", "COR")]),
    } as never);
    expect(
      (await history.getStageSupportingEvidence("t", "PROPOSAL"))[0],
    ).toMatchObject({ current: null, integrityState: "AMBIGUOUS" });
  });
});
