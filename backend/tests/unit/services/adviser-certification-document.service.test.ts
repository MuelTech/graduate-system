import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ adviserCertification: { findUnique: vi.fn(), findMany: vi.fn() } }));
vi.mock("../../../src/config/database", () => ({ default: db }));
import { OfficialDefenseDocumentService } from "../../../src/services/official-defense-document.service";
import { AdviserCertificationRecordService, type AdviserCertificationSource } from "../../../src/services/adviser-certification-record.service";
import type { InstitutionalLogos } from "../../../src/documents/official-defense/shared/institutional-header";

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZ1kAAAAASUVORK5CYII=";
let logos: InstitutionalLogos;
beforeAll(async () => {
  const assets = path.resolve(__dirname, "../../../assets/official-forms");
  logos = {
    earist: { mimeType: "image/jpeg", bytes: await readFile(path.join(assets, "earist-logo.jpg")) },
    graduateSchool: { mimeType: "image/jpeg", bytes: await readFile(path.join(assets, "graduate-school-logo.jpg")) },
  };
});

function source(stage = "PROPOSAL_DEFENSE"): AdviserCertificationSource {
  return {
    id: "cert-1", thesisId: "thesis-1", adviserId: "issuer", defenseStage: stage, status: "ISSUED",
    reviewedDocumentId: "doc-v1", signedAt: new Date("2026-10-24T16:30:00.000Z"), signatureData: PNG,
    adviser: { id: "issuer", firstName: "Andrea", lastName: "Adviser" },
    thesis: { id: "thesis-1", student: { userId: "student", user: { firstName: "Alex", lastName: "Student" }, program: { programName: "Master of Arts in Education" } },
      // Deliberately unrelated current/legacy values; neither may supply the title.
      workingTitle: "Wrong Working Title", thesisTitles: [{ titleText: "Wrong Historical Title" }],
      thesisDocuments: [{ id: "doc-v2", manuscriptTitle: "Wrong Newer Title", isCurrent: true }],
    },
    reviewedDocument: { id: "doc-v1", thesisId: "thesis-1", docType: stage === "FINAL_DEFENSE" ? "FINAL_MANUSCRIPT" : "PROPOSAL_CHAPTERS",
      defenseStage: stage === "FINAL_DEFENSE" ? "FINAL" : "PROPOSAL", manuscriptTitle: "Exact Title A", originalFilename: "reviewed-v1.pdf" },
  } as unknown as AdviserCertificationSource;
}

const admin = { userId: "admin", role: "ADMIN" };
beforeEach(() => { vi.clearAllMocks(); db.adviserCertification.findUnique.mockResolvedValue(source()); db.adviserCertification.findMany.mockResolvedValue([source()]); });

function setup() {
  const render = vi.fn(async () => Buffer.from("%PDF-1.7\nGS-017"));
  const loadLogos = vi.fn(async () => logos);
  const service = new OfficialDefenseDocumentService({ renderCertification: render, loadLogos });
  return { service, render, loadLogos };
}

describe("PREDEF-1B/1C exact GS-017 mapping and ownership", () => {
  it.each(["PROPOSAL_DEFENSE", "FINAL_DEFENSE"])("maps %s from the exact issued document, issuer signature, and Manila server date", async stage => {
    const row = source(stage);
    db.adviserCertification.findUnique.mockResolvedValue(row);
    const { service, render } = setup();
    const result = await service.generateAdviserCertificationPdf(row.id, admin);
    expect(Buffer.from(result.pdf).toString()).toContain("%PDF-");
    expect(result.filename).toContain("Alex-Student-");
    expect(result.filename).toContain("Adviser-Certification-GS-017.pdf");
    expect(render).toHaveBeenCalledWith(expect.objectContaining({
      manuscriptTitle: "Exact Title A", studentName: "Alex Student", adviserPrintedName: "Andrea Adviser",
      programName: "Master of Arts in Education", issuedDay: "25", issuedMonthYear: "October 2026",
      stage: stage === "PROPOSAL_DEFENSE" ? "proposal" : "final",
      adviserSignature: { mimeType: "image/png", bytes: Buffer.from(PNG.split(",")[1], "base64") },
    }));
    expect(JSON.stringify(render.mock.calls)).not.toMatch(/Wrong Newer|Wrong Historical|Wrong Working/);
    expect(db.adviserCertification.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "cert-1" } }));
  });

  it.each([
    ["issuer", "PANELIST", true], ["unrelated-adviser", "PANELIST", false],
    ["student", "STUDENT", true], ["other-student", "STUDENT", false],
    ["admin", "ADMIN", true], ["committee-chairman", "PANELIST", false],
    ["committee-panelist", "PANELIST", false], ["rapporteur", "PANELIST", false],
    ["facilitator", "PANELIST", false], ["issuer", "STUDENT", false], ["student", "PANELIST", false],
    ["admin", "APPLICANT", false], ["", "ADMIN", false],
  ])("authorizes %s (%s) only through ownership or Admin", async (userId, role, allowed) => {
    const { service, render } = setup();
    const call = service.generateAdviserCertificationPdf("cert-1", { userId: userId as string, role: role as string });
    if (allowed) { await call; expect(render).toHaveBeenCalledTimes(1); }
    else { await expect(call).rejects.toMatchObject({ statusCode: 404, message: "Adviser certification not found." }); expect(render).not.toHaveBeenCalled(); }
  });

  it.each([
    ["non-issued", row => { row.status = "AWAITING_REVIEW"; }],
    ["changes requested", row => { row.status = "CHANGES_REQUESTED"; }],
    ["Title stage", row => { row.defenseStage = "TITLE_DEFENSE"; }],
    ["missing binding", row => { row.reviewedDocumentId = null; }],
    ["missing document", row => { row.reviewedDocument = null; }],
    ["wrong document ID", row => { row.reviewedDocument!.id = "doc-v2"; }],
    ["cross-thesis", row => { row.reviewedDocument!.thesisId = "other-thesis"; }],
    ["wrong type", row => { row.reviewedDocument!.docType = "FINAL_MANUSCRIPT"; }],
    ["wrong stage", row => { row.reviewedDocument!.defenseStage = "FINAL"; }],
    ["missing title", row => { row.reviewedDocument!.manuscriptTitle = null; }],
    ["blank title", row => { row.reviewedDocument!.manuscriptTitle = " \t "; }],
    ["wrong issuer", row => { row.adviser.id = "someone-else"; }],
    ["blank issuer", row => { row.adviser.firstName = ""; row.adviser.lastName = ""; }],
    ["missing date", row => { row.signedAt = null; }],
    ["invalid date", row => { row.signedAt = new Date("invalid"); }],
    ["missing program", row => { row.thesis.student.program = null; }],
    ["missing signature", row => { row.signatureData = null; }],
    ["legacy typed signature", row => { row.signatureData = "Andrea Adviser"; }],
    ["malformed base64", row => { row.signatureData = "data:image/png;base64,!!!!"; }],
    ["unusable image", row => { row.signatureData = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB"; }],
    ["unsupported image", row => { row.signatureData = "data:image/svg+xml;base64,PHN2Zz4="; }],
  ] as Array<[string, (row: AdviserCertificationSource) => void]>)("fails closed for %s without invoking the renderer", async (_label, change) => {
    const row = source(); change(row);
    db.adviserCertification.findUnique.mockResolvedValue(row);
    const { service, render } = setup();
    await expect(service.generateAdviserCertificationPdf("cert-1", admin)).rejects.toMatchObject({ isOperational: true });
    expect(render).not.toHaveBeenCalled();
  });

  it("returns a uniform not-found response for missing certification", async () => {
    db.adviserCertification.findUnique.mockResolvedValue(null);
    await expect(setup().service.generateAdviserCertificationPdf("missing", admin)).rejects.toMatchObject({ statusCode: 404 });
  });

  it.each(["STUDENT", "PANELIST", "ADMIN"])("scopes %s record lists at the database boundary and exposes safe metadata only", async role => {
    const { service } = setup();
    const records = await service.listAdviserCertifications({ userId: "actor", role }, "thesis-1", "PROPOSAL");
    const where = db.adviserCertification.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ status: "ISSUED", thesisId: "thesis-1", defenseStage: "PROPOSAL_DEFENSE" });
    if (role === "PANELIST") expect(where).toMatchObject({ adviserId: "actor" });
    if (role === "STUDENT") expect(where).toMatchObject({ thesis: { student: { userId: "actor" } } });
    expect(records[0]).toMatchObject({ id: "cert-1", manuscriptDocumentId: "doc-v1", manuscriptTitle: "Exact Title A", pdfAvailable: true });
    expect(JSON.stringify(records)).not.toMatch(/signatureData|data:image|storageKey|filePath|checksum|hash/);
  });

  it("keeps legacy-null-title records readable, with GS-017 unavailable and no fallback", async () => {
    const row = source(); row.reviewedDocument!.manuscriptTitle = null;
    db.adviserCertification.findMany.mockResolvedValue([row]);
    const records = await setup().service.listAdviserCertifications(admin, "thesis-1");
    expect(records[0]).toMatchObject({ manuscriptTitle: null, pdfAvailable: false, manuscriptDocumentId: "doc-v1" });
    expect(records[0].unavailableReason).toMatch(/no recorded title/);
  });

  it("does not expose invalid cross-thesis document metadata", async () => {
    const row = source(); row.reviewedDocument!.thesisId = "other";
    db.adviserCertification.findMany.mockResolvedValue([row]);
    expect((await setup().service.listAdviserCertifications(admin, "thesis-1"))[0]).toMatchObject({ manuscriptDocumentId: null, manuscriptTitle: null, originalFilename: null, pdfAvailable: false });
  });

  it("does not list another Student's certifications or guess a stage", async () => {
    db.adviserCertification.findMany.mockResolvedValue([]);
    expect(await setup().service.listAdviserCertifications({ userId: "other-student", role: "STUDENT" }, "thesis-1")).toEqual([]);
    await expect(setup().service.listAdviserCertifications(admin, "thesis-1", "TITLE")).rejects.toMatchObject({ statusCode: 400 });
  });

  it.each(["PROPOSAL_DEFENSE", "FINAL_DEFENSE"])("renders real one-page A4 %s PDF bytes with the bound title and signature", async stage => {
    db.adviserCertification.findUnique.mockResolvedValue(source(stage));
    const service = new OfficialDefenseDocumentService({ loadLogos: async () => logos });
    const { pdf } = await service.generateAdviserCertificationPdf("cert-1", admin);
    expect(Buffer.from(pdf).subarray(0, 5).toString()).toBe("%PDF-");
    const doc = await PDFDocument.load(pdf);
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getPage(0).getWidth()).toBeCloseTo(595.28);
    expect(doc.getPage(0).getHeight()).toBeCloseTo(841.89);
  });
});
