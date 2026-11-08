import { beforeEach, describe, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({
  user: { findUnique: vi.fn() }, auditLog: { create: vi.fn() },
  corUpload: { findUnique: vi.fn() }, thesisDocument: { findUnique: vi.fn() },
  rapReport: { findUnique: vi.fn() }, studentRequirement: { findUnique: vi.fn() },
  plagiarismResult: { findUnique: vi.fn() }, memo: { findUnique: vi.fn() }, eLibrary: { findUnique: vi.fn() },
}));
const storage = vi.hoisted(() => ({ resolveReadPath: vi.fn(), pickMimeType: vi.fn(), pickOriginalFilename: vi.fn() }));
vi.mock("../../../src/config/database", () => ({ default: db }));
vi.mock("../../../src/storage", () => ({ storageService: storage }));
import { DocumentService } from "../../../src/services/document.service";
import { PrivateRecordAuthorization, PRIVATE_RECORD_ENFORCEMENT_ENABLED } from "../../../src/access/private-record-authorization";
import { PRIVATE_DOCUMENT_CLASSIFICATION } from "../../../src/access/private-document-context";
import { DIRECT_ACCESS_ENFORCEMENT_ENABLED } from "../../../src/access/account-access";

let current: any;
const load = vi.fn(async () => current);
const auth = new PrivateRecordAuthorization(true, load);
const service = new DocumentService(auth);
function actor(keys: string[] = [], extra = {}) {
  current = { id: "actor", role: "ADMIN", isActive: true, mustChangePassword: false, panelist: null,
    administratorAccess: { level: "RESTRICTED" }, capabilityGrants: keys.map(capabilityKey => ({ capabilityKey })), ...extra };
}
const inventory = [
  ["cor-upload", "corUpload", "cor.view", true],
  ["thesis-document", "thesisDocument", "defense.applications.view", true],
  ["rap-report", "rapReport", "defense.records.view", false],
  ["student-requirement", "studentRequirement", "students.view", true],
  ["plagiarism-result", "plagiarismResult", "defense.applications.view", true],
] as const;
function document() {
  return { id: "doc", thesisId: "thesis", docType: "PROPOSAL_CHAPTERS", defenseStage: "PROPOSAL",
    createdById: "actor", isArchived: false, isPublic: false,
    student: { userId: "owner", user: { id: "owner" } },
    thesis: { id: "thesis", student: { user: { id: "owner" }, adviserAssignments: [] },
      adviserCertifications: [], defenseSchedules: [] }, storageKey: "private/key" };
}
beforeEach(() => {
  vi.resetAllMocks(); actor();
  db.user.findUnique.mockImplementation(async () => current); db.auditLog.create.mockResolvedValue({});
  for (const [, model] of inventory) db[model].findUnique.mockResolvedValue(document());
  db.memo.findUnique.mockResolvedValue(document()); db.eLibrary.findUnique.mockResolvedValue(document());
  storage.resolveReadPath.mockResolvedValue("private/path"); storage.pickMimeType.mockReturnValue("application/pdf");
  storage.pickOriginalFilename.mockReturnValue("original.pdf");
});
const read = (model: string, claim = "ADMIN") => service.resolveDocument(model, "doc", "actor", claim);
const denied = async (call: Promise<unknown>) => {
  await expect(call).rejects.toMatchObject({ statusCode: 403 });
  expect(storage.resolveReadPath).not.toHaveBeenCalled();
  expect(db.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ actionType: "DOCUMENT_ACCESS_DENIED" }) }));
};

describe.each(inventory)("FACULTY-8 registry %s", (type, _model, key, owner) => {
  it("allows exact capability and Full, logs successful reads, uses current identity over stale claims", async () => {
    actor([key]); await read(type, "CUSTOM");
    actor([], { administratorAccess: { level: "FULL" } }); await read(type);
    expect(db.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ actionType: "DOCUMENT_VIEW" }) }));
  });
  it.each([[], ["exam.records.view"], ["essay.evaluate"]].map(keys => ({ keys })))("denies unrelated/absent grants %j before storage", async ({ keys }) => {
    actor(keys); await denied(read(type));
  });
  it.each([
    { isActive: false }, { mustChangePassword: true }, { administratorAccess: null },
    { administratorAccess: { level: "INVALID" } }, { capabilityGrants: [{ capabilityKey: "unknown" }] },
    { capabilityGrants: [{ capabilityKey: "cor.view" }, { capabilityKey: "cor.view" }] },
    { role: "CUSTOM" }, { id: "other" },
  ])("fails closed for invalid current authority %j", async extra => { actor([key], extra); await denied(read(type)); });
  it("revokes access on the next direct call", async () => {
    actor([key]); await read(type); actor([]); storage.resolveReadPath.mockClear(); await denied(read(type));
  });
  it("preserves exact owning Student access and cross-owner denial", async () => {
    actor([], { role: "STUDENT", administratorAccess: null }); await denied(read(type));
    if (owner) {
      current.id = "owner";
      await service.resolveDocument(type, "doc", "owner", "ADMIN");
    }
  });
});

describe("FACULTY-8 exact thesis context and academic separation", () => {
  it("missing current accounts fail before document or storage reads", async () => {
    current = null; await denied(read("cor-upload")); expect(db.corUpload.findUnique).not.toHaveBeenCalled();
  });
  it("a changed academic role cannot inherit Student ownership from a stale JWT", async () => {
    actor([], { id: "owner", role: "FACULTY", administratorAccess: null, panelist: { isActive: true } });
    await denied(service.resolveDocument("cor-upload", "doc", "owner", "STUDENT"));
  });
  it("contradictory manuscript stage/type cannot authorize an academic actor", async () => {
    actor([], { role: "FACULTY", administratorAccess: null, panelist: { isActive: true } });
    const row = document(); row.defenseStage = "FINAL";
    row.thesis.defenseSchedules = [{ manuscriptDocumentId: "doc", panelAssignments: [{ userId: "actor" }] }] as any;
    db.thesisDocument.findUnique.mockResolvedValue(row); await denied(read("thesis-document"));
  });
  it("schedule capability requires the exact same-thesis bound manuscript", async () => {
    actor(["defense.schedules.view"]); const row = document();
    row.thesis.defenseSchedules = [{ id: "schedule", thesisId: "thesis", defenseType: "PROPOSAL_DEFENSE", manuscriptDocumentId: "other" }] as any;
    db.thesisDocument.findUnique.mockResolvedValue(row); await denied(read("thesis-document"));
    (row.thesis.defenseSchedules[0] as any).manuscriptDocumentId = "doc";
    await read("thesis-document");
    (row.thesis.defenseSchedules[0] as any).thesisId = "unrelated";
    storage.resolveReadPath.mockClear(); await denied(read("thesis-document"));
  });
  it("scheduled evidence uses only same-thesis/stage COR and receipt history", async () => {
    actor(["defense.schedules.view"]); const row = document(); row.docType = "COR";
    row.thesis.defenseSchedules = [{ id: "schedule", thesisId: "thesis", defenseType: "FINAL_DEFENSE" }] as any;
    db.thesisDocument.findUnique.mockResolvedValue(row); await denied(read("thesis-document"));
    (row.thesis.defenseSchedules[0] as any).defenseType = "PROPOSAL_DEFENSE";
    await read("thesis-document"); row.docType = "INSTRUMENTS";
    storage.resolveReadPath.mockClear(); await denied(read("thesis-document"));
  });
  it.each(["RESPONDENT_DATA", "UNKNOWN"])("Full never authorizes thesis %s", async docType => {
    actor([], { administratorAccess: { level: "FULL" } }); db.thesisDocument.findUnique.mockResolvedValue({ ...document(), docType });
    await denied(read("thesis-document"));
  });
  it("preserves the respondent-data researcher owner without granting academic access", async () => {
    db.thesisDocument.findUnique.mockResolvedValue({ ...document(), docType: "RESPONDENT_DATA" });
    actor([], { role: "STUDENT", administratorAccess: null, id: "owner" });
    await service.resolveDocument("thesis-document", "doc", "owner", "STUDENT");
  });
  it.each(["thesis-document", "plagiarism-result"])("rejects corrupted cross-thesis %s even for Full", async type => {
    actor([], { administratorAccess: { level: "FULL" } }); const row = document(); row.thesis.id = "other";
    db[type === "thesis-document" ? "thesisDocument" : "plagiarismResult"].findUnique.mockResolvedValue(row);
    await denied(read(type));
  });
  it.each(["FACULTY", "PANELIST"])("preserves exact active Adviser and committee access for %s", async role => {
    actor([], { role, administratorAccess: null, panelist: { isActive: true } });
    const row = document(); row.thesis.student.adviserAssignments = [{ adviserId: "actor" }] as any;
    db.thesisDocument.findUnique.mockResolvedValue(row); await read("thesis-document");
    row.thesis.student.adviserAssignments = [];
    storage.resolveReadPath.mockClear(); await denied(read("thesis-document"));
    row.thesis.defenseSchedules = [{ id: "schedule", defenseType: "PROPOSAL_DEFENSE", manuscriptDocumentId: "doc", panelAssignments: [{ userId: "actor" }] }] as any;
    await read("thesis-document");
    (row.thesis.defenseSchedules[0] as any).panelAssignments = [{ userId: "unrelated" }];
    storage.resolveReadPath.mockClear(); await denied(read("thesis-document"));
  });
  it.each(["COR", "RECEIPT", "INSTRUMENTS", "RESPONDENT_DATA", "PLAGIARISM_REPORT"])("even a bound %s cannot grant committee access", async docType => {
    actor([], { role: "FACULTY", administratorAccess: null, panelist: { isActive: true } });
    const row = { ...document(), docType }; row.thesis.defenseSchedules = [{ id: "schedule", manuscriptDocumentId: "doc", panelAssignments: [{ userId: "actor" }] }] as any;
    db.thesisDocument.findUnique.mockResolvedValue(row); await denied(read("thesis-document"));
  });
  it.each([{ isActive: false }, { panelist: { isActive: false } }, { panelist: null }, { mustChangePassword: true }])("rejects inactive/password-gated academic identity %j", async extra => {
    actor([], { role: "FACULTY", administratorAccess: null, panelist: { isActive: true }, ...extra });
    await denied(read("thesis-document"));
  });
  it("essay Faculty cannot use a stale ADMIN claim for any owned business capability", async () => {
    actor(["essay.evaluate"], { role: "FACULTY", administratorAccess: null, panelist: { isActive: true } });
    for (const [type] of inventory) await denied(read(type, "ADMIN"));
  });
});

describe("FACULTY-9 deferral and dormant composition", () => {
  it("inventories all eight types with exactly three FACULTY-9 classifications", () => {
    expect(Object.keys(PRIVATE_DOCUMENT_CLASSIFICATION).sort()).toEqual([...inventory.map(row => row[0]), "memo", "elibrary-manuscript", "elibrary-respondent-data"].sort());
    expect(Object.values(PRIVATE_DOCUMENT_CLASSIFICATION).filter(value => value === "FACULTY-9")).toHaveLength(3);
  });
  it.each(["memo", "elibrary-manuscript", "elibrary-respondent-data"])("leaves %s on its existing policy without activating a new mapping", async type => {
    await read(type); expect(load).not.toHaveBeenCalled();
  });
  it("normal composition stays dormant and does not interpret runtime activation flags", async () => {
    expect(PRIVATE_RECORD_ENFORCEMENT_ENABLED).toBe(false); expect(DIRECT_ACCESS_ENFORCEMENT_ENABLED).toBe(false);
    vi.stubEnv("PRIVATE_RECORD_ENFORCEMENT_ENABLED", "true");
    try { await new DocumentService().resolveDocument("cor-upload", "doc", "actor", "ADMIN"); expect(load).not.toHaveBeenCalled(); }
    finally { vi.unstubAllEnvs(); }
  });
});
