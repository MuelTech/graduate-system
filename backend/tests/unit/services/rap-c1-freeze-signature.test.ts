import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * RAP-C1 — freeze + required signatures + conclusion readiness.
 *
 * Verifies the server-authoritative lifecycle: assigned-Rapporteur freeze creates
 * the exact stage-aware signature roster bound to a deterministic frozen
 * version/hash; required signers sign ONLY their own frozen slot; the final
 * required signature finalizes the RAP; and the read model never leaks raw
 * signature evidence.
 */

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
  $queryRaw: vi.fn(),
  defenseSchedule: { findUnique: vi.fn() },
  panelAssignment: { findFirst: vi.fn() },
  rapReport: { updateMany: vi.fn(), update: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
  rapReportSignature: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    createMany: vi.fn(),
    updateMany: vi.fn(),
    create: vi.fn(),
  },
}));

const { ensureSummary } = vi.hoisted(() => ({ ensureSummary: vi.fn() }));

vi.mock("../../../src/config/database", () => ({ default: prismaMock }));
vi.mock("../../../src/services/official-defense-record.service", () => ({
  OfficialDefenseRecordService: class {
    ensureOralExamSummary = ensureSummary;
  },
}));

import { DefenseCollaborationService } from "../../../src/services/defense-collaboration.service";
import { AppError } from "../../../src/utils/AppError";

prismaMock.$transaction.mockImplementation(
  async (fn: (tx: typeof prismaMock) => unknown) => fn(prismaMock),
);
prismaMock.$queryRaw.mockResolvedValue([]);

const VALID_BODY = {
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "Recommendation" }] }],
};

function member(userId: string, role: string) {
  return {
    id: `pa-${role}`,
    scheduleId: "sched-1",
    userId,
    role,
    user: { firstName: role[0], lastName: "X" },
  };
}

const FULL_ROSTER = [
  member("u-CHAIRMAN", "CHAIRMAN"),
  member("u-PANELIST", "PANELIST"),
  member("u-RAPPORTEUR", "RAPPORTEUR"),
  member("u-ADVISER", "ADVISER"),
  member("u-FACILITATOR", "FACILITATOR"),
];

function scheduleRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "sched-1",
    thesisId: "thesis-1",
    defenseType: "TITLE_DEFENSE",
    sessionStatus: "IN_PROGRESS",
    manuscriptDocumentId: null,
    defenseDate: new Date("2026-10-20T00:00:00.000Z"),
    defenseTime: new Date("1970-01-01T09:00:00.000Z"),
    venueOrLink: "Room 201",
    rapporteurNotes: null,
    thesis: {
      student: {
        studentNumber: "2020-001",
        user: { firstName: "Ana", lastName: "Cruz" },
        program: { programName: "MSIT" },
      },
    },
    panelAssignments: FULL_ROSTER,
    oralExamScores: [],
    oralExamSummary: { id: "sum-1" },
    rapReports: [],
    ...overrides,
  };
}

function draftRap(overrides: Record<string, unknown> = {}) {
  return {
    id: "rap-1",
    status: "DRAFT",
    bodyDocument: VALID_BODY,
    bodyVersion: 3,
    contentVersion: 0,
    frozenAt: null as Date | null,
    frozenById: null,
    frozenContentHash: null,
    decisionsAndRecommendations: null,
    reportDate: null,
    venue: null,
    signatures: [] as unknown[],
    ...overrides,
  };
}

function slot(userId: string, role: string, overrides: Record<string, unknown> = {}) {
  return {
    userId,
    roleAtDefense: role,
    required: true,
    isSigned: false,
    signedAt: null as Date | null,
    user: { firstName: role[0], lastName: "X" },
    ...overrides,
  };
}

function frozenRap(overrides: Record<string, unknown> = {}) {
  return draftRap({
    status: "FOR_SIGNATURE",
    contentVersion: 2,
    frozenAt: new Date("2026-10-21T00:00:00.000Z"),
    frozenById: "u-RAPPORTEUR",
    frozenContentHash: "f".repeat(64),
    signatures: [
      slot("u-CHAIRMAN", "CHAIRMAN"),
      slot("u-PANELIST", "PANELIST"),
      slot("u-RAPPORTEUR", "RAPPORTEUR"),
    ],
    ...overrides,
  });
}

const assignment = (role: string) => ({ id: `pa-${role}`, scheduleId: "sched-1", userId: `u-${role}`, role });

describe("RAP-C1 freeze (DefenseCollaborationService)", () => {
  const svc = new DefenseCollaborationService();

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(scheduleRow({ rapReports: [draftRap()] }));
    prismaMock.panelAssignment.findFirst.mockResolvedValue(assignment("RAPPORTEUR"));
    prismaMock.rapReport.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.rapReportSignature.createMany.mockResolvedValue({ count: 3 });
    ensureSummary.mockResolvedValue({ created: false, summaryId: "sum-1" });
  });

  it("freezes for the assigned Rapporteur and creates the exact signer roster", async () => {
    const result = await svc.freezeReportForSignatures("sched-1", "u-RAPPORTEUR");
    expect(result).toMatchObject({ frozen: true, alreadyFrozen: false, status: "FOR_SIGNATURE" });
    expect(result.contentHash).toMatch(/^[a-f0-9]{64}$/);
    const created = prismaMock.rapReportSignature.createMany.mock.calls[0][0].data as Array<{ userId: string; required: boolean }>;
    const users = created.map((c) => c.userId).sort();
    // TITLE excludes Adviser and Facilitator.
    expect(users).toEqual(["u-CHAIRMAN", "u-PANELIST", "u-RAPPORTEUR"]);
    expect(created.every((c) => c.required === true)).toBe(true);
  });

  it("includes the active Adviser for Proposal and excludes the Facilitator", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(
      scheduleRow({ defenseType: "PROPOSAL_DEFENSE", rapReports: [draftRap()] }),
    );
    await svc.freezeReportForSignatures("sched-1", "u-RAPPORTEUR");
    const created = prismaMock.rapReportSignature.createMany.mock.calls[0][0].data as Array<{ userId: string }>;
    const users = created.map((c) => c.userId).sort();
    expect(users).toEqual(["u-ADVISER", "u-CHAIRMAN", "u-PANELIST", "u-RAPPORTEUR"]);
    expect(users).not.toContain("u-FACILITATOR");
  });

  it("includes the active Adviser for Final Defense", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(
      scheduleRow({ defenseType: "FINAL_DEFENSE", rapReports: [draftRap()] }),
    );
    await svc.freezeReportForSignatures("sched-1", "u-RAPPORTEUR");
    const created = prismaMock.rapReportSignature.createMany.mock.calls[0][0].data as Array<{ userId: string }>;
    expect(created.map((c) => c.userId)).toContain("u-ADVISER");
  });

  it("rejects a non-Rapporteur caller with 403", async () => {
    prismaMock.panelAssignment.findFirst.mockResolvedValue(assignment("CHAIRMAN"));
    await expect(svc.freezeReportForSignatures("sched-1", "u-CHAIRMAN")).rejects.toMatchObject({ statusCode: 403 });
    expect(prismaMock.rapReportSignature.createMany).not.toHaveBeenCalled();
  });

  it("rejects a Rapporteur who is not the assigned Rapporteur (403)", async () => {
    prismaMock.panelAssignment.findFirst.mockResolvedValue(null);
    await expect(svc.freezeReportForSignatures("sched-1", "u-other")).rejects.toMatchObject({ statusCode: 403 });
  });

  it("requires a DRAFT report (rejects an already-frozen report via idempotent return)", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(
      scheduleRow({ rapReports: [draftRap({ status: "FOR_SIGNATURE", frozenAt: new Date(), frozenContentHash: "a".repeat(64) })] }),
    );
    const result = await svc.freezeReportForSignatures("sched-1", "u-RAPPORTEUR");
    expect(result).toMatchObject({ alreadyFrozen: true, contentHash: "a".repeat(64) });
    expect(prismaMock.rapReportSignature.createMany).not.toHaveBeenCalled();
  });

  it("rejects freezing an empty report (409)", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(
      scheduleRow({ rapReports: [draftRap({ bodyDocument: { type: "doc", content: [] } })] }),
    );
    await expect(svc.freezeReportForSignatures("sched-1", "u-RAPPORTEUR")).rejects.toMatchObject({ statusCode: 409 });
  });

  it("finalizes while evaluations remain DRAFT and the Summary is absent", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(
      scheduleRow({
        rapReports: [draftRap()],
        oralExamScores: [
          { panelId: "pa-CHAIRMAN", status: "DRAFT" },
          { panelId: "pa-PANELIST", status: "DRAFT" },
        ],
        oralExamSummary: null,
      }),
    );
    ensureSummary.mockRejectedValue(new AppError("Not all required evaluations are finalized.", 409));

    await expect(svc.freezeReportForSignatures("sched-1", "u-RAPPORTEUR")).resolves.toMatchObject({
      frozen: true,
      status: "FOR_SIGNATURE",
    });
    expect(ensureSummary).not.toHaveBeenCalled();
    expect(prismaMock.rapReport.updateMany).toHaveBeenCalled();
    expect(prismaMock.rapReportSignature.createMany).toHaveBeenCalled();
  });

  it("rejects finalization before the defense has started (SCHEDULED)", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(
      scheduleRow({ sessionStatus: "SCHEDULED", rapReports: [draftRap()] }),
    );
    await expect(svc.freezeReportForSignatures("sched-1", "u-RAPPORTEUR")).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(prismaMock.rapReport.updateMany).not.toHaveBeenCalled();
  });

  it("rejects a concluded attempt (409)", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(
      scheduleRow({ sessionStatus: "CONCLUDED", rapReports: [draftRap()] }),
    );
    await expect(svc.freezeReportForSignatures("sched-1", "u-RAPPORTEUR")).rejects.toMatchObject({ statusCode: 409 });
  });

  it("produces a deterministic frozen hash for identical content/metadata", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-21T00:00:00.000Z"));
    try {
      const a = await svc.freezeReportForSignatures("sched-1", "u-RAPPORTEUR");
      const b = await svc.freezeReportForSignatures("sched-1", "u-RAPPORTEUR");
      expect(a.contentHash).toBe(b.contentHash);
      expect(a.contentVersion).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("RAP-C1 signing (DefenseCollaborationService)", () => {
  const svc = new DefenseCollaborationService();
  const EVIDENCE = "data:image/png;base64,AAAA";

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(scheduleRow({ rapReports: [frozenRap()] }));
    prismaMock.rapReportSignature.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.rapReportSignature.createMany.mockResolvedValue({ count: 0 });
    // Default: one required slot signed → PARTIALLY_SIGNED.
    prismaMock.rapReportSignature.findMany.mockResolvedValue([
      { required: true, isSigned: true },
      { required: true, isSigned: false },
      { required: true, isSigned: false },
    ]);
    prismaMock.rapReport.findUnique.mockResolvedValue({ status: "FOR_SIGNATURE", finalizedAt: null });
    prismaMock.rapReport.updateMany.mockResolvedValue({ count: 1 });
  });

  function signerSlot(role: string) {
    prismaMock.panelAssignment.findFirst.mockResolvedValue(assignment(role));
    prismaMock.rapReportSignature.findFirst.mockResolvedValue({
      id: `sig-${role}`,
      required: true,
      isSigned: false,
    });
  }

  it("lets a required Chairman sign their own slot bound to the frozen version/hash", async () => {
    signerSlot("CHAIRMAN");
    const result = await svc.signReportForSignatures("sched-1", "u-CHAIRMAN", EVIDENCE);
    expect(result).toMatchObject({
      signed: true,
      status: "PARTIALLY_SIGNED",
      contentVersion: 2,
      reportId: "rap-1",
      finalizedNow: false,
    });
    expect(prismaMock.rapReportSignature.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: "u-CHAIRMAN" }),
        data: expect.objectContaining({
          isSigned: true,
          signatureData: EVIDENCE,
          signedContentHash: "f".repeat(64),
          signedContentVersion: 2,
        }),
      }),
    );
  });

  it("lets a required Panelist and Rapporteur sign their own slots", async () => {
    signerSlot("PANELIST");
    await expect(svc.signReportForSignatures("sched-1", "u-PANELIST", EVIDENCE)).resolves.toMatchObject({ signed: true });
    signerSlot("RAPPORTEUR");
    await expect(svc.signReportForSignatures("sched-1", "u-RAPPORTEUR", EVIDENCE)).resolves.toMatchObject({ signed: true });
  });

  it("lets a Chairman sign while their own evaluation is still DRAFT and no Summary exists", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(
      scheduleRow({
        rapReports: [frozenRap()],
        oralExamScores: [
          { panelId: "pa-CHAIRMAN", status: "DRAFT" },
          { panelId: "pa-PANELIST", status: "DRAFT" },
        ],
        oralExamSummary: null,
      }),
    );
    signerSlot("CHAIRMAN");
    await expect(svc.signReportForSignatures("sched-1", "u-CHAIRMAN", EVIDENCE)).resolves.toMatchObject({
      signed: true,
    });
  });

  it("rejects Committee Report signing before the defense has started (SCHEDULED)", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(
      scheduleRow({ sessionStatus: "SCHEDULED", rapReports: [frozenRap()] }),
    );
    signerSlot("CHAIRMAN");
    await expect(svc.signReportForSignatures("sched-1", "u-CHAIRMAN", EVIDENCE)).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(prismaMock.rapReportSignature.updateMany).not.toHaveBeenCalled();
  });

  it("lets the Adviser sign on Proposal/Final", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(
      scheduleRow({ defenseType: "PROPOSAL_DEFENSE", rapReports: [frozenRap()] }),
    );
    signerSlot("ADVISER");
    await expect(svc.signReportForSignatures("sched-1", "u-ADVISER", EVIDENCE)).resolves.toMatchObject({ signed: true });
  });

  it("rejects a non-signer / Facilitator / unrelated user with 403", async () => {
    prismaMock.panelAssignment.findFirst.mockResolvedValue(assignment("FACILITATOR"));
    prismaMock.rapReportSignature.findFirst.mockResolvedValue(null);
    await expect(svc.signReportForSignatures("sched-1", "u-FACILITATOR", EVIDENCE)).rejects.toMatchObject({ statusCode: 403 });

    prismaMock.panelAssignment.findFirst.mockResolvedValue(assignment("PANELIST"));
    prismaMock.rapReportSignature.findFirst.mockResolvedValue(null);
    await expect(svc.signReportForSignatures("sched-1", "u-PANELIST", EVIDENCE)).rejects.toMatchObject({ statusCode: 403 });
  });

  it("cannot sign another signer's slot (own-slot enforcement)", async () => {
    // The caller has no own slot for this RAP.
    prismaMock.panelAssignment.findFirst.mockResolvedValue(assignment("PANELIST"));
    prismaMock.rapReportSignature.findFirst.mockResolvedValue(null);
    await expect(svc.signReportForSignatures("sched-1", "u-PANELIST", EVIDENCE)).rejects.toMatchObject({ statusCode: 403 });
    expect(prismaMock.rapReportSignature.updateMany).not.toHaveBeenCalled();
  });

  it("rejects duplicate signing deterministically (409)", async () => {
    signerSlot("PANELIST");
    prismaMock.rapReportSignature.findFirst.mockResolvedValue({ id: "sig-PANELIST", required: true, isSigned: true });
    await expect(svc.signReportForSignatures("sched-1", "u-PANELIST", EVIDENCE)).rejects.toMatchObject({ statusCode: 409 });
  });

  it("rejects signing before freeze (RAP not frozen)", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(scheduleRow({ rapReports: [draftRap()] }));
    prismaMock.panelAssignment.findFirst.mockResolvedValue(assignment("PANELIST"));
    await expect(svc.signReportForSignatures("sched-1", "u-PANELIST", EVIDENCE)).rejects.toMatchObject({ statusCode: 409 });
  });

  it("rejects signing an already-FINALIZED RAP (409)", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(
      scheduleRow({ rapReports: [frozenRap({ status: "FINALIZED" })] }),
    );
    prismaMock.panelAssignment.findFirst.mockResolvedValue(assignment("PANELIST"));
    await expect(svc.signReportForSignatures("sched-1", "u-PANELIST", EVIDENCE)).rejects.toMatchObject({ statusCode: 409 });
  });

  it("requires image e-signature evidence (400)", async () => {
    signerSlot("PANELIST");
    await expect(svc.signReportForSignatures("sched-1", "u-PANELIST", "John Doe")).rejects.toMatchObject({ statusCode: 400 });
    await expect(svc.signReportForSignatures("sched-1", "u-PANELIST", "   ")).rejects.toMatchObject({ statusCode: 400 });
  });

  it("finalizes the RAP when the last required signature is recorded", async () => {
    signerSlot("PANELIST");
    prismaMock.rapReportSignature.findMany.mockResolvedValue([
      { required: true, isSigned: true },
      { required: true, isSigned: true },
      { required: true, isSigned: true },
    ]);
    const result = await svc.signReportForSignatures("sched-1", "u-PANELIST", EVIDENCE);
    expect(result.status).toBe("FINALIZED");
    expect(result.reportId).toBe("rap-1");
    expect(result.finalizedNow).toBe(true);
    expect(result.signatureProgress).toEqual({ required: 3, signed: 3 });
  });
});

describe("RAP-C1 report read model (no raw signature leakage)", () => {
  const svc = new DefenseCollaborationService();

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.panelAssignment.findFirst.mockResolvedValue(assignment("PANELIST"));
  });

  it("exposes signer status + readiness but never signatureData", async () => {
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(
      scheduleRow({
        rapReports: [frozenRap({ signatures: [slot("u-PANELIST", "PANELIST", { isSigned: true, signedAt: new Date("2026-10-22T00:00:00Z") })] })],
        oralExamScores: [
          { panelId: "pa-CHAIRMAN", status: "FINALIZED" },
          { panelId: "pa-PANELIST", status: "FINALIZED" },
        ],
      }),
    );
    const model = await svc.getReportReadModel("sched-1", "u-PANELIST");
    expect(model.reportStatus).toBe("FOR_SIGNATURE");
    expect(model.freeze.frozenContentHash).toBe("f".repeat(64));
    expect(model.signatureProgress).toEqual({ required: 1, signed: 1 });
    expect(model.mySignature).toMatchObject({ userId: "u-PANELIST", isSigned: true });
    expect(model.canSign).toBe(false);
    expect(JSON.stringify(model)).not.toContain("signatureData");
    expect(JSON.stringify(model)).not.toContain("base64");
  });

  it("reports finalization eligibility from report content only, not evaluations or Summary", async () => {
    prismaMock.panelAssignment.findFirst.mockResolvedValue(assignment("RAPPORTEUR"));
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(
      scheduleRow({
        rapReports: [draftRap()],
        oralExamScores: [
          { panelId: "pa-CHAIRMAN", status: "DRAFT" },
          { panelId: "pa-PANELIST", status: "DRAFT" },
        ],
        oralExamSummary: null,
      }),
    );
    const model = await svc.getReportReadModel("sched-1", "u-RAPPORTEUR");
    expect(model.canFreeze).toBe(true);
    expect(model.freezeReadiness.ready).toBe(true);
    expect(model.freezeReadiness.checks).toEqual([
      { key: "content", label: "Committee Report contains content", ok: true },
    ]);
    expect(model.freezeReadiness.checks.some((c) => c.key.startsWith("evaluation:"))).toBe(false);
    expect(model.freezeReadiness.checks.some((c) => c.key === "summary")).toBe(false);
  });

  it("does not offer finalization while the session is still SCHEDULED", async () => {
    prismaMock.panelAssignment.findFirst.mockResolvedValue(assignment("RAPPORTEUR"));
    prismaMock.defenseSchedule.findUnique.mockResolvedValue(
      scheduleRow({ sessionStatus: "SCHEDULED", rapReports: [draftRap()] }),
    );
    const model = await svc.getReportReadModel("sched-1", "u-RAPPORTEUR");
    expect(model.canFreeze).toBe(false);
  });
});
