import { beforeEach, describe, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({
  user: { findUnique: vi.fn() }, student: { findUnique: vi.fn() }, auditLog: { create: vi.fn() },
  memo: { findUnique: vi.fn() }, eLibrary: { findUnique: vi.fn() },
}));
const storage = vi.hoisted(() => ({ resolveReadPath: vi.fn(), pickMimeType: vi.fn(), pickOriginalFilename: vi.fn() }));
vi.mock("../../../src/config/database", () => ({ default: db }));
vi.mock("../../../src/storage", () => ({ storageService: storage }));
import { DocumentService } from "../../../src/services/document.service";
import { PrivateRecordAuthorization } from "../../../src/access/private-record-authorization";
import { OperationalAuthorization } from "../../../src/access/operational-authorization";
let current: any;
const load = async () => current;
const service = new DocumentService(new PrivateRecordAuthorization(true, load), new OperationalAuthorization(true, load));
function account(keys: string[] = [], extra = {}) {
  current = { id: "actor", role: "ADMIN", isActive: true, mustChangePassword: false, panelist: null,
    administratorAccess: { level: "RESTRICTED" }, capabilityGrants: keys.map(capabilityKey => ({ capabilityKey })), ...extra };
}
function archive() {
  return { id: "entry", thesisId: "thesis", isPublic: false, fullPaperPath: "private/manuscript", respondentDataPath: "private/raw",
    thesis: { id: "thesis", student: { userId: "owner", user: { id: "owner" } } } };
}
const read = (type: string, role = "ADMIN", userId = "actor") => service.resolveDocument(type, "entry", userId, role);
async function denied(call: Promise<unknown>) {
  await expect(call).rejects.toMatchObject({ statusCode: 403 }); expect(storage.resolveReadPath).not.toHaveBeenCalled();
  expect(db.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ actionType: "DOCUMENT_ACCESS_DENIED" }) }));
}
beforeEach(() => {
  vi.resetAllMocks(); account(); db.user.findUnique.mockImplementation(async () => current);
  db.student.findUnique.mockResolvedValue({ programId: "program" }); db.auditLog.create.mockResolvedValue({});
  db.memo.findUnique.mockResolvedValue({ id: "entry", createdById: "actor", targetAudience: "STUDENTS", isArchived: false });
  db.eLibrary.findUnique.mockResolvedValue(archive()); storage.resolveReadPath.mockResolvedValue("safe/resolved.pdf");
  storage.pickMimeType.mockReturnValue("application/pdf"); storage.pickOriginalFilename.mockReturnValue("original.pdf");
});
describe.each([["memo", "memos.manage"], ["elibrary-manuscript", "repository.view"]] as const)("FACULTY-9 private class %s", (type, key) => {
  it("requires exact capability, allows enumerated Full, ignores supplied role", async () => {
    account([key]); await read(type, "CUSTOM"); account([], { administratorAccess: { level: "FULL" } }); await read(type);
    expect(storage.resolveReadPath).toHaveBeenCalledTimes(2);
  });
  it.each([[], ["settings.manage"], ["essay.evaluate"]].map(keys => ({ keys })))("denies missing/unrelated authority %j before storage", async ({ keys }) => {
    account(keys); await denied(read(type));
  });
  it.each([{ isActive: false }, { mustChangePassword: true }, { administratorAccess: null },
    { capabilityGrants: [{ capabilityKey: "unknown" }] },
    { capabilityGrants: [{ capabilityKey: "repository.view" }, { capabilityKey: "repository.view" }] }, { id: "other" },
  ])("denies current-invalid authority %j", async extra => {
    account([key], extra); await denied(read(type));
  });
  it("revocation takes effect on the next direct document read", async () => {
    account([key]); await read(type); account([]); storage.resolveReadPath.mockClear(); await denied(read(type));
  });
});
describe("FACULTY-9 Memo audience and archive boundary", () => {
  it("current Restricted Admin without memos.manage cannot use creator identity or ALL audience", async () => {
    db.memo.findUnique.mockResolvedValue({ createdById: "actor", targetAudience: "ALL", isArchived: false });
    await denied(read("memo"));
  });
  it.each(["STUDENT", "FACULTY", "PANELIST", "APPLICANT"])("%s retains active ALL audience only", async role => {
    account([], { role, administratorAccess: null, panelist: ["FACULTY", "PANELIST"].includes(role) ? { isActive: true } : null });
    db.memo.findUnique.mockResolvedValue({ targetAudience: "ALL", isArchived: false }); await read("memo", "ADMIN");
    db.memo.findUnique.mockResolvedValue({ targetAudience: "ALL", isArchived: true }); storage.resolveReadPath.mockClear(); await denied(read("memo"));
  });
  it("retired CUSTOM cannot read even ALL memos through a stale ADMIN claim", async () => {
    account([], { role: "CUSTOM", administratorAccess: null, panelist: null });
    db.memo.findUnique.mockResolvedValue({ targetAudience: "ALL", isArchived: false });
    await denied(read("memo", "ADMIN"));
  });
  it.each(["FACULTY", "PANELIST"])("%s retains PANELISTS audience but no Student/Program access", async role => {
    account([], { role, administratorAccess: null, panelist: { isActive: true } });
    db.memo.findUnique.mockResolvedValue({ targetAudience: "PANELISTS", isArchived: false }); await read("memo");
    for (const targetAudience of ["STUDENTS", "PROGRAM"]) {
      db.memo.findUnique.mockResolvedValue({ targetAudience, programId: "program", isArchived: false });
      storage.resolveReadPath.mockClear(); await denied(read("memo"));
    }
  });
  it("Student reads own Program and STUDENTS, never another Program or PANELISTS", async () => {
    account([], { role: "STUDENT", administratorAccess: null });
    for (const targetAudience of ["PROGRAM", "STUDENTS"]) {
      db.memo.findUnique.mockResolvedValue({ targetAudience, programId: "program", isArchived: false }); await read("memo");
    }
    for (const row of [{ targetAudience: "PROGRAM", programId: "other-program" }, { targetAudience: "PANELISTS" }]) {
      db.memo.findUnique.mockResolvedValue({ ...row, isArchived: false }); storage.resolveReadPath.mockClear(); await denied(read("memo"));
    }
  });
  it("management capability retains archived attachment access", async () => {
    account(["memos.manage"]); db.memo.findUnique.mockResolvedValue({ isArchived: true }); await read("memo");
  });
  it("a missing Student profile cannot bypass the feed through a direct attachment URL", async () => {
    account([], { role: "STUDENT", administratorAccess: null }); db.student.findUnique.mockResolvedValue(null);
    db.memo.findUnique.mockResolvedValue({ targetAudience: "ALL", isArchived: false }); await denied(read("memo"));
  });
});
describe("FACULTY-9 Repository manuscript and raw-data privacy", () => {
  it.each([[], ["repository.view"], ["repository.manage"]].map(keys => ({ keys })))("raw data denies blanket Admin %j", async ({ keys }) => {
    account(keys); await denied(read("elibrary-respondent-data"));
  });
  it("Full does not gain raw respondent data", async () => {
    account([], { administratorAccess: { level: "FULL" } }); await denied(read("elibrary-respondent-data"));
  });
  it("preserves exact current Student researcher, not cross-owner or stale Student role", async () => {
    account([], { role: "STUDENT", id: "owner", administratorAccess: null });
    await read("elibrary-respondent-data", "ADMIN", "owner"); await read("elibrary-manuscript", "ADMIN", "owner");
    current.id = "actor"; storage.resolveReadPath.mockClear(); await denied(read("elibrary-respondent-data", "STUDENT"));
    current.id = "owner"; current.role = "FACULTY"; current.panelist = { isActive: true };
    await denied(read("elibrary-respondent-data", "STUDENT", "owner"));
  });
  it.each(["STUDENT", "FACULTY", "PANELIST", "ADMIN"])("published manuscript retains current %s member access without private/raw access", async role => {
    account([], { role, administratorAccess: role === "ADMIN" ? { level: "RESTRICTED" } : null,
      panelist: ["FACULTY", "PANELIST"].includes(role) ? { isActive: true } : null });
    db.eLibrary.findUnique.mockResolvedValue({ ...archive(), isPublic: true }); await read("elibrary-manuscript", "CUSTOM");
    storage.resolveReadPath.mockClear(); await denied(read("elibrary-respondent-data"));
    db.eLibrary.findUnique.mockResolvedValue(archive()); await denied(read("elibrary-manuscript"));
  });
  it("publication does not grant Applicant, CUSTOM or essay authority private manuscript access", async () => {
    for (const role of ["APPLICANT", "CUSTOM", "FACULTY"]) {
      account(role === "FACULTY" ? ["essay.evaluate"] : [], { role, administratorAccess: null, panelist: role === "FACULTY" ? { isActive: true } : null });
      await denied(read("elibrary-manuscript"));
    }
  });
  it("corrupt cross-thesis archive cannot grant Full manuscript or researcher raw access", async () => {
    db.eLibrary.findUnique.mockResolvedValue({ ...archive(), thesisId: "other" });
    account([], { administratorAccess: { level: "FULL" } }); await denied(read("elibrary-manuscript"));
    account([], { role: "STUDENT", id: "owner", administratorAccess: null }); await denied(read("elibrary-respondent-data", "STUDENT", "owner"));
  });
  it.each([{ isActive: false }, { mustChangePassword: true }, { panelist: null }, { panelist: { isActive: false } }])("inactive/credential-gated academic member %j denied before document lookup", async extra => {
    account([], { role: "FACULTY", administratorAccess: null, panelist: { isActive: true }, ...extra });
    await denied(read("elibrary-manuscript")); expect(db.eLibrary.findUnique).not.toHaveBeenCalled();
  });
});
