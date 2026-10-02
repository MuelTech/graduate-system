import { describe, expect, it, vi } from "vitest";
import {
  DefenseApplicationDocumentHistoryService,
  type DefenseDocumentHistoryDto,
} from "../../../src/services/defense-document-history.service";

/**
 * DL-8: workflow-aware Admin document-history read model.
 * Uses a fake read repository so authority resolution is tested in isolation.
 */

function doc(overrides: Record<string, unknown>) {
  return {
    id: "doc-1",
    docType: "COR",
    defenseStage: "TITLE",
    originalFilename: "file.pdf",
    verifiedMimeType: "application/pdf",
    sizeBytes: 100,
    uploadedAt: new Date("2026-10-01T00:00:00Z"),
    isCurrent: true,
    supersedesDocumentId: null,
    ...overrides,
  };
}

function cert(overrides: Record<string, unknown> = {}) {
  return {
    id: "cert-1",
    status: "ISSUED",
    defenseStage: "PROPOSAL_DEFENSE",
    reviewedDocumentId: "p2",
    reviewRemarks: "Reviewed",
    signedAt: new Date("2026-10-02T00:00:00Z"),
    adviser: { id: "adviser-1", firstName: "Bob", lastName: "Adviser" },
    reviewedDocument: {
      id: "p2",
      thesisId: "thesis-1",
      docType: "PROPOSAL_CHAPTERS",
      defenseStage: "PROPOSAL",
    },
    ...overrides,
  };
}

function makeService(overrides: {
  thesis?: Record<string, unknown>;
  docs?: unknown[];
  certs?: unknown[];
  audit?: unknown[];
  schedule?: { id: string } | null;
}) {
  const repo = {
    getThesis: vi.fn(async () =>
      overrides.thesis ?? {
        id: "thesis-1",
        stage: "FINAL",
        status: "PENDING",
        rejectionReason: null,
        studentId: "student-1",
      },
    ),
    getStageDocuments: vi.fn(async () => overrides.docs ?? []),
    getAdviserCertifications: vi.fn(async () => overrides.certs ?? []),
    getReviewAuditEvents: vi.fn(async () => overrides.audit ?? []),
    getStageScheduleId: vi.fn(async () => overrides.schedule ?? null),
  };
  const svc = new DefenseApplicationDocumentHistoryService(repo as never);
  return { svc, repo };
}

function findSlot(dto: DefenseDocumentHistoryDto, docType: string) {
  return dto.supportingEvidence.find((s) => s.docType === docType);
}

describe("DL-8 supporting-evidence history", () => {
  it("Title: groups current vs previous and supersession", async () => {
    const { svc } = makeService({
      docs: [
        doc({
          id: "pkg-v1",
          docType: "TITLE_PROPOSAL",
          defenseStage: "TITLE",
          isCurrent: false,
          originalFilename: "package-v1.pdf",
        }),
        doc({
          id: "pkg-v2",
          docType: "TITLE_PROPOSAL",
          defenseStage: "TITLE",
          isCurrent: true,
          supersedesDocumentId: "pkg-v1",
          originalFilename: "package-v2.pdf",
        }),
        doc({ id: "cor-v1", docType: "COR", defenseStage: "TITLE" }),
        doc({ id: "rcpt-v1", docType: "RECEIPT", defenseStage: "TITLE" }),
      ],
    });
    const dto = await svc.getDocumentHistory("thesis-1", "TITLE");
    expect(dto.stage).toBe("TITLE");

    const pkg = findSlot(dto, "TITLE_PROPOSAL");
    expect(pkg?.integrityState).toBe("OK");
    expect(pkg?.current?.id).toBe("pkg-v2");
    expect(pkg?.current?.supersedesDocumentId).toBe("pkg-v1");
    expect(pkg?.history.map((d) => d.id)).toEqual(["pkg-v1"]);
    expect(findSlot(dto, "COR")?.current?.id).toBe("cor-v1");
    expect(findSlot(dto, "RECEIPT")?.current?.id).toBe("rcpt-v1");
    expect(dto.manuscriptReview).toBeNull();
  });

  it("Proposal: COR replacement grouping excludes the manuscript from support slots", async () => {
    const { svc } = makeService({
      thesis: {
        id: "thesis-1",
        stage: "PROPOSAL",
        status: "PENDING",
        rejectionReason: null,
        studentId: "student-1",
      },
      docs: [
        doc({ id: "cor-v1", docType: "COR", defenseStage: "PROPOSAL", isCurrent: false }),
        doc({ id: "cor-v2", docType: "COR", defenseStage: "PROPOSAL", isCurrent: true, supersedesDocumentId: "cor-v1" }),
        doc({ id: "rcpt-v1", docType: "RECEIPT", defenseStage: "PROPOSAL", isCurrent: true }),
        doc({ id: "p1", docType: "PROPOSAL_CHAPTERS", defenseStage: "PROPOSAL", isCurrent: false }),
        doc({ id: "p2", docType: "PROPOSAL_CHAPTERS", defenseStage: "PROPOSAL", isCurrent: true, supersedesDocumentId: "p1" }),
      ],
      certs: [cert()],
    });
    const dto = await svc.getDocumentHistory("thesis-1", "PROPOSAL");
    expect(dto.supportingEvidence.map((s) => s.docType)).toEqual(["COR", "RECEIPT"]);
    expect(findSlot(dto, "COR")?.current?.id).toBe("cor-v2");
    expect(findSlot(dto, "COR")?.history.map((d) => d.id)).toEqual(["cor-v1"]);
    expect(findSlot(dto, "RECEIPT")?.current?.id).toBe("rcpt-v1");
  });

  it("Final: stage-scoped grouping works the same way", async () => {
    const { svc } = makeService({
      thesis: { id: "thesis-1", stage: "FINAL", status: "PENDING", rejectionReason: null, studentId: "s" },
      docs: [
        doc({ id: "cor-v1", docType: "COR", defenseStage: "FINAL", isCurrent: true }),
        doc({ id: "rcpt-v1", docType: "RECEIPT", defenseStage: "FINAL", isCurrent: false }),
        doc({ id: "rcpt-v2", docType: "RECEIPT", defenseStage: "FINAL", isCurrent: true, supersedesDocumentId: "rcpt-v1" }),
      ],
    });
    const dto = await svc.getDocumentHistory("thesis-1", "FINAL");
    expect(findSlot(dto, "RECEIPT")?.current?.id).toBe("rcpt-v2");
    expect(findSlot(dto, "RECEIPT")?.history.map((d) => d.id)).toEqual(["rcpt-v1"]);
    expect(findSlot(dto, "COR")?.integrityState).toBe("OK");
  });

  it("does not infer currentness from latest timestamp", async () => {
    const { svc } = makeService({
      docs: [
        doc({ id: "cor-older-current", docType: "COR", isCurrent: true, uploadedAt: new Date("2026-01-01") }),
        doc({ id: "cor-newer-notcurrent", docType: "COR", isCurrent: false, uploadedAt: new Date("2026-12-01") }),
      ],
    });
    const dto = await svc.getDocumentHistory("thesis-1", "TITLE");
    expect(findSlot(dto, "COR")?.current?.id).toBe("cor-older-current");
    expect(findSlot(dto, "COR")?.history.map((d) => d.id)).toEqual(["cor-newer-notcurrent"]);
  });
});

describe("DL-8 ambiguity fails closed", () => {
  it("two current COR rows -> AMBIGUOUS, current null, no arbitrary pick", async () => {
    const { svc } = makeService({
      docs: [
        doc({ id: "cor-a", docType: "COR", isCurrent: true, uploadedAt: new Date("2026-01-01") }),
        doc({ id: "cor-b", docType: "COR", isCurrent: true, uploadedAt: new Date("2026-12-01") }),
      ],
    });
    const dto = await svc.getDocumentHistory("thesis-1", "TITLE");
    const cor = findSlot(dto, "COR");
    expect(cor?.integrityState).toBe("AMBIGUOUS");
    expect(cor?.current).toBeNull();
  });

  it("zero current rows -> MISSING", async () => {
    const { svc } = makeService({
      docs: [doc({ id: "cor-v1", docType: "COR", isCurrent: false })],
    });
    const dto = await svc.getDocumentHistory("thesis-1", "TITLE");
    expect(findSlot(dto, "COR")?.integrityState).toBe("MISSING");
    expect(findSlot(dto, "COR")?.history.map((d) => d.id)).toEqual(["cor-v1"]);
  });
});

describe("DL-8 prior-stage history", () => {
  it("uses the requested stage and queries only that stage", async () => {
    const { svc, repo } = makeService({
      thesis: { id: "thesis-1", stage: "FINAL", status: "PENDING", rejectionReason: null, studentId: "s" },
      docs: [doc({ id: "cor-prop", docType: "COR", defenseStage: "PROPOSAL", isCurrent: true })],
    });
    const dto = await svc.getDocumentHistory("thesis-1", "PROPOSAL");
    expect(repo.getStageDocuments).toHaveBeenCalledWith("thesis-1", "PROPOSAL");
    expect(repo.getStageScheduleId).toHaveBeenCalledWith("thesis-1", "PROPOSAL_DEFENSE");
    expect(dto.stage).toBe("PROPOSAL");
    expect(dto.supportingEvidence.every((s) => s.docType !== "TITLE_PROPOSAL")).toBe(true);
  });

  it("rejects an invalid stage", async () => {
    const { svc } = makeService({});
    await expect(svc.getDocumentHistory("thesis-1", "ALL")).rejects.toThrow(/stage/i);
  });

  it("404s an unknown thesis", async () => {
    const repo = {
      getThesis: vi.fn(async () => null),
      getStageDocuments: vi.fn(async () => []),
      getAdviserCertifications: vi.fn(async () => []),
      getReviewAuditEvents: vi.fn(async () => []),
      getStageScheduleId: vi.fn(async () => null),
    };
    const svc = new DefenseApplicationDocumentHistoryService(repo as never);
    await expect(svc.getDocumentHistory("missing", "TITLE")).rejects.toThrow(/not found/i);
  });
});

describe("DL-8 manuscript authority", () => {
  it("identifies the exact certified document, never the newer version head", async () => {
    const { svc } = makeService({
      thesis: { id: "thesis-1", stage: "PROPOSAL", status: "PENDING", rejectionReason: null, studentId: "s" },
      docs: [
        doc({ id: "p1", docType: "PROPOSAL_CHAPTERS", defenseStage: "PROPOSAL", isCurrent: false }),
        doc({ id: "p2", docType: "PROPOSAL_CHAPTERS", defenseStage: "PROPOSAL", isCurrent: false }),
        doc({ id: "p3", docType: "PROPOSAL_CHAPTERS", defenseStage: "PROPOSAL", isCurrent: true, supersedesDocumentId: "p2" }),
      ],
      certs: [cert({ status: "ISSUED", reviewedDocumentId: "p2", reviewedDocument: { id: "p2", thesisId: "thesis-1", docType: "PROPOSAL_CHAPTERS", defenseStage: "PROPOSAL" } })],
    });
    const dto = await svc.getDocumentHistory("thesis-1", "PROPOSAL");
    expect(dto.manuscriptReview?.certifiedDocumentId).toBe("p2");
    expect(dto.manuscriptReview?.bindingValid).toBe(true);
    const byId = Object.fromEntries((dto.manuscriptReview?.versions ?? []).map((v) => [v.id, v]));
    expect(byId.p2.isCertified).toBe(true);
    expect(byId.p2.isReviewedByAdviser).toBe(true);
    expect(byId.p3.isCertified).toBe(false);
    expect(byId.p3.isVersionHead).toBe(true);
  });

  it("wrong docType binding fails closed with a warning", async () => {
    const { svc } = makeService({
      docs: [doc({ id: "p2", docType: "PROPOSAL_CHAPTERS", defenseStage: "PROPOSAL", isCurrent: true })],
      certs: [cert({ status: "ISSUED", reviewedDocumentId: "p2", reviewedDocument: { id: "p2", thesisId: "thesis-1", docType: "COR", defenseStage: "PROPOSAL" } })],
    });
    const dto = await svc.getDocumentHistory("thesis-1", "PROPOSAL");
    expect(dto.manuscriptReview?.bindingValid).toBe(false);
    expect(dto.manuscriptReview?.certifiedDocumentId).toBeNull();
    expect(dto.manuscriptReview?.warning).toBeTruthy();
    expect((dto.manuscriptReview?.versions ?? []).every((v) => !v.isCertified)).toBe(true);
  });

  it("cross-thesis and unbound bindings fail closed", async () => {
    const { svc } = makeService({
      docs: [doc({ id: "p2", docType: "PROPOSAL_CHAPTERS", defenseStage: "PROPOSAL", isCurrent: true })],
      certs: [cert({ status: "ISSUED", reviewedDocumentId: "p2", reviewedDocument: { id: "p2", thesisId: "thesis-other", docType: "PROPOSAL_CHAPTERS", defenseStage: "PROPOSAL" } })],
    });
    const dto = await svc.getDocumentHistory("thesis-1", "PROPOSAL");
    expect(dto.manuscriptReview?.bindingValid).toBe(false);
    expect(dto.manuscriptReview?.certifiedDocumentId).toBeNull();

    const unbound = makeService({
      docs: [doc({ id: "p2", docType: "PROPOSAL_CHAPTERS", defenseStage: "PROPOSAL", isCurrent: true })],
      certs: [cert({ status: "AWAITING_REVIEW", reviewedDocumentId: null, reviewedDocument: null })],
    });
    const dto2 = await unbound.svc.getDocumentHistory("thesis-1", "PROPOSAL");
    expect(dto2.manuscriptReview?.bindingValid).toBe(false);
    expect(dto2.manuscriptReview?.certificationStatus).toBe("AWAITING_REVIEW");
    expect(dto2.manuscriptReview?.certifiedDocumentId).toBeNull();
  });

  it("no certification still reports versions read-only", async () => {
    const { svc } = makeService({
      docs: [doc({ id: "p1", docType: "PROPOSAL_CHAPTERS", defenseStage: "PROPOSAL", isCurrent: true })],
      certs: [],
    });
    const dto = await svc.getDocumentHistory("thesis-1", "PROPOSAL");
    expect(dto.manuscriptReview?.certificationStatus).toBe("NONE");
    expect(dto.manuscriptReview?.versions).toHaveLength(1);
    expect(dto.manuscriptReview?.certifiedDocumentId).toBeNull();
  });
});

describe("DL-8 review timeline + privacy", () => {
  it("maps reject reason, resubmit replacement chain, and legacy resubmit safely", async () => {
    const { svc } = makeService({
      audit: [
        {
          id: "a1",
          actionType: "DEFENSE_APPLICATION_REJECT",
          oldValue: "PENDING",
          newValue: JSON.stringify({ stage: "TITLE", reason: "Upload a clearer COR" }),
          description: "rejected",
          createdAt: new Date("2026-10-01T00:00:00Z"),
          actor: { id: "admin-1", firstName: "Ada", lastName: "Admin" },
        },
        {
          id: "a2",
          actionType: "DEFENSE_RESUBMIT",
          oldValue: null,
          newValue: JSON.stringify({
            stage: "TITLE",
            previousRejectionReason: "Upload a clearer COR",
            replacements: [
              { docType: "COR", supersededDocumentId: "cor-v1", createdDocumentId: "cor-v2" },
            ],
            createdIds: ["cor-v2"],
            supersededIds: ["cor-v1"],
          }),
          description: "resubmitted",
          createdAt: new Date("2026-10-02T00:00:00Z"),
          actor: { id: "student-user", firstName: "Ana", lastName: "Student" },
        },
        {
          id: "a3",
          actionType: "DEFENSE_RESUBMIT",
          oldValue: null,
          newValue: JSON.stringify({ createdIds: ["x"], supersededIds: ["y"] }),
          description: "legacy resubmit",
          createdAt: new Date("2026-10-03T00:00:00Z"),
          actor: null,
        },
      ],
    });
    const dto = await svc.getDocumentHistory("thesis-1", "TITLE");

    expect(dto.reviewTimeline.map((e) => e.type)).toEqual([
      "DEFENSE_APPLICATION_REJECT",
      "DEFENSE_RESUBMIT",
    ]);
    expect(dto.reviewTimeline[0].reason).toBe("Upload a clearer COR");
    expect(dto.reviewTimeline[0].actor?.name).toBe("Ada Admin");

    expect(dto.reviewTimeline[1].replacementSummary?.previousRejectionReason).toBe(
      "Upload a clearer COR",
    );
    expect(dto.reviewTimeline[1].replacementSummary?.replacements).toEqual([
      { docType: "COR", supersededDocumentId: "cor-v1", createdDocumentId: "cor-v2" },
    ]);

    // Legacy unscoped event is excluded from the stage-specific timeline.
    expect(
      dto.reviewTimeline.some((e) => e.description === "legacy resubmit"),
    ).toBe(false);
  });

  it("returns only the requested stage's structured events", async () => {
    const structured = (stage: string, reason?: string) => ({
      actionType: "DEFENSE_APPLICATION_REJECT",
      oldValue: "PENDING",
      newValue: JSON.stringify(reason ? { stage, reason } : { stage }),
      description: `${stage} event`,
      createdAt: new Date("2026-01-01T00:00:00Z"),
      actor: null,
    });
    const { svc } = makeService({
      audit: [
        structured("TITLE"),
        structured("PROPOSAL", "proposal reason"),
        structured("FINAL"),
        {
          actionType: "DEFENSE_RESUBMIT",
          oldValue: null,
          newValue: JSON.stringify({ createdIds: ["x"], supersededIds: ["y"] }),
          description: "legacy unscoped",
          createdAt: new Date("2026-01-02T00:00:00Z"),
          actor: null,
        },
      ],
    });

    expect(
      (await svc.getDocumentHistory("thesis-1", "TITLE")).reviewTimeline.map(
        (e) => e.description,
      ),
    ).toEqual(["TITLE event"]);
    expect(
      (await svc.getDocumentHistory("thesis-1", "PROPOSAL")).reviewTimeline.map(
        (e) => e.description,
      ),
    ).toEqual(["PROPOSAL event"]);
    const finalDto = await svc.getDocumentHistory("thesis-1", "FINAL");
    expect(finalDto.reviewTimeline.map((e) => e.description)).toEqual([
      "FINAL event",
    ]);
    expect(
      finalDto.reviewTimeline.some((e) => e.description === "legacy unscoped"),
    ).toBe(false);
  });

  it("keeps the live rejection reason for a currently rejected application", async () => {
    const { svc } = makeService({
      thesis: {
        id: "thesis-1",
        stage: "TITLE",
        status: "REJECTED",
        rejectionReason: "Live reason",
        studentId: "s",
      },
    });
    const dto = await svc.getDocumentHistory("thesis-1", "TITLE");
    expect(dto.application.isCurrentStage).toBe(true);
    expect(dto.application.currentThesisStage).toBe("TITLE");
    expect(dto.application.status).toBe("REJECTED");
    expect(dto.application.rejectionReason).toBe("Live reason");
  });

  it("does not reuse current-stage state for a prior-stage request", async () => {
    const { svc } = makeService({
      thesis: {
        id: "thesis-1",
        stage: "FINAL",
        status: "PENDING",
        rejectionReason: null,
        studentId: "s",
      },
    });

    const prior = await svc.getDocumentHistory("thesis-1", "PROPOSAL");
    expect(prior.stage).toBe("PROPOSAL");
    expect(prior.application.isCurrentStage).toBe(false);
    expect(prior.application.currentThesisStage).toBe("FINAL");
    expect(prior.application.status).toBeNull();
    expect(prior.application.rejectionReason).toBeNull();

    const current = await svc.getDocumentHistory("thesis-1", "FINAL");
    expect(current.application.isCurrentStage).toBe(true);
    expect(current.application.status).toBe("PENDING");
  });

  it("exposes official schedule availability when present", async () => {
    const { svc } = makeService({ schedule: { id: "sched-1" } });
    const dto = await svc.getDocumentHistory("thesis-1", "TITLE");
    expect(dto.officialRecord).toEqual({ scheduleId: "sched-1", available: true });
  });

  it("never serializes storage internals or e-signatures", async () => {
    const { svc } = makeService({
      docs: [doc({ id: "cor-v1" })],
      audit: [],
    });
    const dto = await svc.getDocumentHistory("thesis-1", "TITLE");
    const json = JSON.stringify(dto);
    for (const forbidden of ["filePath", "storageKey", "checksum", "signatureData", "storageProvider"]) {
      expect(json).not.toContain(forbidden);
    }
  });
});
