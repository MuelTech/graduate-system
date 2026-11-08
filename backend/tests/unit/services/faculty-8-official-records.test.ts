import { beforeEach, describe, expect, it, vi } from "vitest";
import { signedRequestEvidence, STUDENT_SIGNATURE } from "../../fixtures/adviser-request-signed";
const db = vi.hoisted(() => ({
  adviserCertification: { findUnique: vi.fn(), findMany: vi.fn() },
  adviserRequestOfficialRecord: { findUnique: vi.fn(), findMany: vi.fn() },
  defenseSchedule: { findUnique: vi.fn(), findMany: vi.fn() },
  panelAssignment: { findUnique: vi.fn(), findMany: vi.fn() },
  oralExamScore: { findUnique: vi.fn(), count: vi.fn(), updateMany: vi.fn() },
}));
vi.mock("../../../src/config/database", () => ({ default: db }));
import { PrivateRecordAuthorization } from "../../../src/access/private-record-authorization";
import { AdviserCertificationRecordService } from "../../../src/services/adviser-certification-record.service";
import { AdviserRequestRecordService, finalizedAdviserRequestSnapshot } from "../../../src/services/adviser-request-record.service";
import { adviserRequestEvidenceHash, type SignedAdviserRequestState } from "../../../src/services/adviser-request-signed-state";
import { OfficialDefenseRecordService } from "../../../src/services/official-defense-record.service";
import { OfficialDefenseDocumentService } from "../../../src/services/official-defense-document.service";
import { ThesisService } from "../../../src/services/thesis.service";

let current: any;
const load = vi.fn(async () => current);
const auth = new PrivateRecordAuthorization(true, load);
const certs = new AdviserCertificationRecordService(auth);
const requests = new AdviserRequestRecordService(auth);
const records = new OfficialDefenseRecordService(undefined, auth);
const thesis = new ThesisService(undefined, auth);
const actor = { userId: "actor", role: "ADMIN" };
const render = vi.fn(async () => Buffer.from("%PDF-1.7\nexact record"));
const docs = new OfficialDefenseDocumentService({ authorization: auth, loadLogos: async () => ({} as any), renderCertification: render });
function account(keys: string[] = [], extra = {}) {
  current = { id: "actor", role: "ADMIN", isActive: true, mustChangePassword: false, panelist: null,
    administratorAccess: { level: "RESTRICTED" }, capabilityGrants: keys.map(capabilityKey => ({ capabilityKey })), ...extra };
}
function certification() {
  return { id: "cert", thesisId: "thesis", adviserId: "issuer", defenseStage: "PROPOSAL_DEFENSE", status: "ISSUED",
    reviewedDocumentId: "manuscript", signatureData: STUDENT_SIGNATURE, signedAt: new Date("2026-10-01T00:00Z"),
    adviser: { id: "issuer", firstName: "Exact", lastName: "Issuer" },
    thesis: { id: "thesis", student: { userId: "owner", user: { firstName: "Sam", lastName: "Student" }, program: { programName: "MIT" } } },
    reviewedDocument: { id: "manuscript", thesisId: "thesis", defenseStage: "PROPOSAL", docType: "PROPOSAL_CHAPTERS", manuscriptTitle: "Exact Title", originalFilename: "exact.pdf" } };
}
function requestRecord() {
  const signed = signedRequestEvidence({ id: "req", studentId: "student-1", requestedAdviserId: "adviser-user", reason: "Exact reason",
    requestDate: new Date("2026-09-25"), sourceDefenseScheduleId: "schedule-1" });
  const finalizedAt = new Date("2026-09-27T08:00Z");
  const snapshot = finalizedAdviserRequestSnapshot(signed.payload as unknown as SignedAdviserRequestState, new Date("2026-09-26T08:00Z"), "dean", finalizedAt);
  return { requestId: "req", studentUserId: "student-user", requestedAdviserId: "adviser-user", snapshot, signatureData: STUDENT_SIGNATURE,
    evidenceHash: adviserRequestEvidenceHash(snapshot, STUDENT_SIGNATURE), finalizedAt,
    request: { status: "APPROVED", adviserStatus: "CONFORMED", deanStatus: "APPROVED" } };
}
const schedule = () => ({ id: "schedule", thesisId: "thesis", defenseType: "TITLE_DEFENSE", defenseDate: new Date("2026-10-01"),
  thesis: { student: { userId: "owner", user: { firstName: "Sam", lastName: "Student" }, program: { programName: "MIT" } } },
  oralExamSummary: null, conclusion: null });
function score() {
  return { id: "score", scheduleId: "schedule", panelId: "assignment", status: "FINALIZED", signatureData: STUDENT_SIGNATURE,
    signedAt: new Date("2026-10-01"), finalizedAt: new Date("2026-10-01"),
    officialSnapshot: { schemaVersion: 1, scheduleId: "schedule", panelAssignmentId: "assignment", defenseType: "TITLE_DEFENSE",
      evaluatorUserId: "evaluator", criteria: { organization: 1 }, groupIValue: 1, groupIIValue: 1, overallValue: null,
      rating: null, recommendations: "Exact recommendation", scoringVersion: "INSTITUTIONAL_MATRIX_V2" } };
}
beforeEach(() => {
  vi.resetAllMocks(); account(); render.mockResolvedValue(Buffer.from("%PDF-1.7\nexact record"));
  db.adviserCertification.findUnique.mockResolvedValue(certification()); db.adviserCertification.findMany.mockResolvedValue([certification()]);
  db.adviserRequestOfficialRecord.findUnique.mockResolvedValue(requestRecord()); db.adviserRequestOfficialRecord.findMany.mockResolvedValue([requestRecord()]);
  db.defenseSchedule.findMany.mockResolvedValue([]); db.defenseSchedule.findUnique.mockResolvedValue(schedule());
  db.panelAssignment.findUnique.mockResolvedValue({ id: "assignment", scheduleId: "schedule", userId: "evaluator", role: "PANELIST", isActive: true,
    user: { firstName: "Exact", lastName: "Evaluator" } });
  db.panelAssignment.findMany.mockResolvedValue([]); db.oralExamScore.count.mockResolvedValue(0); db.oralExamScore.findUnique.mockResolvedValue(score());
});

describe("FACULTY-8 GS-017 context and exact issuer ownership", () => {
  it("application reviewer can read the exact thesis; listing still requires thesisId", async () => {
    account(["defense.applications.view"]); await certs.getSource("cert", actor);
    await expect(certs.listSources(actor)).rejects.toMatchObject({ statusCode: 400 });
    const metadata = await docs.listAdviserCertifications(actor, "thesis", "PROPOSAL");
    expect(metadata).toHaveLength(1); expect(JSON.stringify(metadata)).not.toMatch(/base64|signatureData/);
    const result = await docs.generateAdviserCertificationPdf("cert", actor);
    expect(Buffer.from(result.pdf).toString()).toContain("%PDF-");
    expect(render.mock.calls[0][0]).toMatchObject({ manuscriptTitle: "Exact Title", adviserSignature: { mimeType: "image/png" } });
  });
  it("schedule capability alone requires exact thesis/stage/manuscript binding for list and PDF", async () => {
    account(["defense.schedules.view"]);
    await expect(certs.getSource("cert", actor)).rejects.toMatchObject({ statusCode: 404 });
    expect(await certs.listSources(actor, "thesis", "PROPOSAL")).toEqual([]);
    const exact = { id: "schedule", thesisId: "thesis", defenseType: "PROPOSAL_DEFENSE", manuscriptDocumentId: "manuscript" };
    for (const wrong of [{ thesisId: "other" }, { defenseType: "FINAL_DEFENSE" }, { manuscriptDocumentId: "other-version" }]) {
      db.defenseSchedule.findMany.mockResolvedValue([{ ...exact, ...wrong }]);
      await expect(docs.generateAdviserCertificationPdf("cert", actor)).rejects.toMatchObject({ statusCode: 404 });
    }
    db.defenseSchedule.findMany.mockResolvedValue([exact]);
    expect(await certs.listSources(actor, "thesis", "PROPOSAL")).toHaveLength(1);
    await docs.generateAdviserCertificationPdf("cert", actor);
    expect(db.defenseSchedule.findMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: {
      thesisId: "thesis", defenseType: "PROPOSAL_DEFENSE", manuscriptDocumentId: "manuscript" } }));
  });
  it.each([["owner", "STUDENT", true], ["issuer", "FACULTY", true], ["issuer", "PANELIST", true],
    ["committee", "FACULTY", false], ["other-owner", "STUDENT", false], ["owner", "FACULTY", false]])("preserves %s / %s exact authority", async (id, role, allowed) => {
    account([], { id, role, administratorAccess: null, panelist: role === "STUDENT" ? null : { isActive: true } });
    const call = certs.getSource("cert", { userId: id as string, role: "ADMIN" });
    if (allowed) await call; else await expect(call).rejects.toMatchObject({ statusCode: 404 });
  });
  it("unrelated capability never authorizes GS-017", async () => {
    account(["defense.records.view"]); await expect(docs.generateAdviserCertificationPdf("cert", actor)).rejects.toMatchObject({ statusCode: 404 });
    expect(render).not.toHaveBeenCalled();
  });
});

describe("FACULTY-8 GS-020 current capability and immutable record", () => {
  it("allows the exact capability and emits safe metadata plus reproducible PDF bytes", async () => {
    account(["adviser.requests.view"]); const before = JSON.stringify(requestRecord());
    const metadata = await requests.list(actor); expect(JSON.stringify(metadata)).not.toMatch(/base64|signatureData|snapshot|evidenceHash/);
    const a = await requests.generatePdf("req", actor); const b = await requests.generatePdf("req", actor);
    expect(a.pdf).toEqual(b.pdf); expect(Buffer.from(a.pdf).subarray(0, 5).toString()).toBe("%PDF-");
    expect(JSON.stringify(requestRecord())).toBe(before);
  });
  it.each([[], ["students.view"], ["defense.applications.view"], ["defense.records.view"]].map(keys => ({ keys })))("denies %j before accessing the snapshot", async ({ keys }) => {
    account(keys); await expect(requests.list(actor)).rejects.toMatchObject({ statusCode: 403 });
    await expect(requests.generatePdf("req", actor)).rejects.toMatchObject({ statusCode: 403 });
    expect(db.adviserRequestOfficialRecord.findUnique).not.toHaveBeenCalled(); expect(db.adviserRequestOfficialRecord.findMany).not.toHaveBeenCalled();
  });
  it.each([["student-user", "STUDENT", true], ["adviser-user", "FACULTY", true], ["adviser-user", "PANELIST", true],
    ["other-student", "STUDENT", false], ["committee", "FACULTY", false]])("keeps request-bound %s / %s ownership", async (id, role, allowed) => {
    account([], { id, role, administratorAccess: null, panelist: role === "STUDENT" ? null : { isActive: true } });
    const call = requests.generatePdf("req", { userId: id as string, role: "ADMIN" });
    if (allowed) await call; else await expect(call).rejects.toMatchObject({ statusCode: 404 });
  });
  it("capability cannot repair invalid hash evidence", async () => {
    account(["adviser.requests.view"]); db.adviserRequestOfficialRecord.findUnique.mockResolvedValue({ ...requestRecord(), evidenceHash: "wrong" });
    await expect(requests.generatePdf("req", actor)).rejects.toMatchObject({ statusCode: 409 });
  });
});

const officialReads = [
  () => records.getOfficialCriteria("schedule", "assignment", actor), () => records.getOfficialCriteriaForPrint("schedule", "assignment", actor),
  () => records.getSummaryReadModel("schedule", actor), () => records.getOfficialSummaryDocumentSource("schedule", actor),
  () => records.getOfficialDefenseApplicationDocumentSource("schedule", actor), () => records.getOfficialEvaluationBundleSource("schedule", actor),
  () => records.getOfficialDocumentIdentity("schedule", actor), () => docs.generateIndividualEvaluationPdf("schedule", "assignment", actor),
  () => docs.generateOralExamSummaryPdf("schedule", actor), () => docs.generateDefenseApplicationPdf("schedule", actor),
  () => docs.generateEvaluationBundlePdf("schedule", actor), () => docs.buildOfficialDocumentFilename("schedule", "application", actor),
  () => thesis.getOfficialCriteria("schedule", "assignment", actor), () => thesis.getOralExamSummaryRecord("schedule", actor),
  () => thesis.generateOfficialCriteriaPdf("schedule", "assignment", actor), () => thesis.generateOralExamSummaryPdf("schedule", actor),
  () => thesis.generateDefenseApplicationPdf("schedule", actor), () => thesis.generateEvaluationBundlePdf("schedule", actor),
];
describe("FACULTY-8 official Defense service closure", () => {
  it.each(officialReads.map((run, i) => ({ run, i })))("direct read/PDF boundary $i denies unrelated grants before data/renderer work", async ({ run }) => {
    account(["defense.schedules.view"]); await expect(run()).rejects.toMatchObject({ statusCode: 403 });
    expect(db.defenseSchedule.findUnique).not.toHaveBeenCalled(); expect(render).not.toHaveBeenCalled();
  });
  it("safe Criteria JSON omits signature while the protected print source preserves exact evidence", async () => {
    account(["defense.records.view"]); const frozen = score(); db.oralExamScore.findUnique.mockResolvedValue(frozen);
    Object.assign(frozen.officialSnapshot, { signatureData: STUDENT_SIGNATURE, storageKey: "internal-key" });
    const before = JSON.stringify(frozen);
    const safe = await records.getOfficialCriteria("schedule", "assignment", actor);
    expect(safe).not.toHaveProperty("signatureData"); expect(JSON.stringify(safe)).not.toMatch(/base64|signatureData|storageKey/);
    const print = await records.getOfficialCriteriaForPrint("schedule", "assignment", actor);
    expect(print.signatureData).toBe(STUDENT_SIGNATURE); expect(print.officialSnapshot).toEqual(frozen.officialSnapshot);
    expect(JSON.stringify(frozen)).toBe(before); expect(db.oralExamScore.updateMany).not.toHaveBeenCalled();
  });
  it("enabled Admin PDF wrapper supplies the validated exact signature to the unchanged render contract", async () => {
    account(["defense.records.view"]); const row = score();
    row.officialSnapshot.criteria = Object.fromEntries(["timelinessRelevance", "organization", "depthComprehensiveness",
      "relevanceConclusions", "evidenceOriginalThinking", "presentation", "masterySubject", "communicationSkill", "attitude"].map(key => [key, 1])) as any;
    const exactRender = vi.fn(async () => Buffer.from("%PDF-1.7\nexact criteria"));
    const service = new OfficialDefenseDocumentService({ authorization: auth, loadLogos: async () => ({} as any), render: exactRender });
    db.oralExamScore.findUnique.mockResolvedValue(row);
    const result = await service.generateIndividualEvaluationPdf("schedule", "assignment", actor);
    expect(Buffer.from(result).toString()).toBe("%PDF-1.7\nexact criteria");
    expect(exactRender).toHaveBeenCalledWith(expect.objectContaining({ evaluatorSignature: {
      mimeType: "image/png", bytes: Buffer.from(STUDENT_SIGNATURE.split(",")[1], "base64") } }));
    expect(db.oralExamScore.updateMany).not.toHaveBeenCalled();
  });
  it("does not backfill missing historical snapshots on a read", async () => {
    account(["defense.records.view"]); db.oralExamScore.findUnique.mockResolvedValue({ ...score(), officialSnapshot: null });
    await records.getOfficialCriteria("schedule", "assignment", actor); expect(db.oralExamScore.updateMany).not.toHaveBeenCalled();
  });
  it.each([{ scheduleId: "another-attempt" }, { panelAssignmentId: "other-assignment" }, { evaluatorUserId: "other-evaluator" }])("denies mismatched frozen Criteria identity %j", async extra => {
    account(["defense.records.view"]); const row = score(); Object.assign(row.officialSnapshot, extra);
    db.oralExamScore.findUnique.mockResolvedValue(row);
    await expect(records.getOfficialCriteria("schedule", "assignment", actor)).rejects.toMatchObject({ statusCode: 409 });
    await expect(records.getOfficialCriteriaForPrint("schedule", "assignment", actor)).rejects.toMatchObject({ statusCode: 409 });
    expect(db.oralExamScore.updateMany).not.toHaveBeenCalled();
  });
  it("denies another attempt's summary snapshot", async () => {
    account(["defense.records.view"]);
    db.defenseSchedule.findUnique.mockResolvedValue({ ...schedule(), oralExamSummary: { snapshotData: { scheduleId: "other-attempt", defenseType: "TITLE_DEFENSE", evaluators: [] } } });
    await expect(records.getSummaryReadModel("schedule", actor)).rejects.toMatchObject({ statusCode: 409 });
  });
  it("exact owning evaluator receives safe JSON only; other academic accounts and raw print are denied", async () => {
    account([], { id: "evaluator", role: "FACULTY", administratorAccess: null, panelist: { isActive: true } });
    const own = { userId: "evaluator", role: "ADMIN" };
    expect(await records.getOfficialCriteria("schedule", "assignment", own)).not.toHaveProperty("signatureData");
    await expect(records.getOfficialCriteriaForPrint("schedule", "assignment", own)).rejects.toMatchObject({ statusCode: 403 });
    current.id = "other"; await expect(records.getOfficialCriteria("schedule", "assignment", { userId: "other", role: "ADMIN" })).rejects.toMatchObject({ statusCode: 403 });
  });
  it("removed evaluator assignment and another defense attempt cannot authorize a read", async () => {
    account([], { id: "evaluator", role: "PANELIST", administratorAccess: null, panelist: { isActive: true } });
    const own = { userId: "evaluator", role: "PANELIST" };
    const original = await db.panelAssignment.findUnique();
    db.panelAssignment.findUnique.mockResolvedValue({ ...original, isActive: false });
    await expect(records.getOfficialCriteria("schedule", "assignment", own)).rejects.toMatchObject({ statusCode: 403 });
    db.panelAssignment.findUnique.mockResolvedValue({ ...original, scheduleId: "different-attempt" });
    await expect(records.getOfficialCriteria("schedule", "assignment", own)).rejects.toMatchObject({ statusCode: 404 });
  });
  it("omitted actor cannot bypass a public read or print source", async () => {
    await expect(records.getSummaryReadModel("schedule", undefined as any)).rejects.toMatchObject({ statusCode: 403 });
    await expect(records.getOfficialCriteria("schedule", "assignment", undefined as any)).rejects.toMatchObject({ statusCode: 403 });
    await expect(records.getOfficialCriteriaForPrint("schedule", "assignment", undefined as any)).rejects.toMatchObject({ statusCode: 403 });
  });
  it("Full and exact Restricted current capabilities authorize read sources despite stale claims", async () => {
    for (const extra of [{}, { administratorAccess: { level: "FULL" } }]) {
      account(["defense.records.view"], extra);
      const stale = { ...actor, role: "CUSTOM" };
      await records.getSummaryReadModel("schedule", stale); await records.getOfficialDocumentIdentity("schedule", stale);
      await records.getOfficialSummaryDocumentSource("schedule", stale);
    }
  });
});

describe("FACULTY-8 invalid current account across record families", () => {
  const all = ["defense.records.view", "defense.applications.view", "adviser.requests.view"];
  it.each([{ isActive: false }, { mustChangePassword: true }, { administratorAccess: null },
    { administratorAccess: { level: "UNKNOWN" } }, { capabilityGrants: [{ capabilityKey: "unknown" }] },
    { capabilityGrants: [{ capabilityKey: "essay.evaluate" }] },
    { capabilityGrants: [{ capabilityKey: "defense.records.view" }, { capabilityKey: "defense.records.view" }] },
    { role: "FACULTY", panelist: { isActive: false } }, { id: "other-account" },
  ])("fails closed for %j on every official read/PDF boundary", async extra => {
    account(all, extra);
    for (const run of [...officialReads, () => certs.getSource("cert", actor), () => certs.listSources(actor, "thesis"),
      () => requests.list(actor), () => requests.generatePdf("req", actor)]) {
      await expect(run()).rejects.toMatchObject({ statusCode: 403 });
    }
    expect(db.defenseSchedule.findUnique).not.toHaveBeenCalled();
  });
  it("revocation is visible on the next call across all three record families", async () => {
    account(all); await records.getSummaryReadModel("schedule", actor); await certs.getSource("cert", actor); await requests.list(actor);
    account([]); await expect(records.getSummaryReadModel("schedule", actor)).rejects.toMatchObject({ statusCode: 403 });
    await expect(certs.getSource("cert", actor)).rejects.toMatchObject({ statusCode: 404 });
    await expect(requests.list(actor)).rejects.toMatchObject({ statusCode: 403 });
  });
});
