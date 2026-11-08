import { beforeEach, describe, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), findMany: vi.fn() }, $transaction: vi.fn(), $queryRaw: vi.fn(),
  eLibrary: { findMany: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  memo: { create: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
  student: { findUnique: vi.fn(), findMany: vi.fn() }, panelist: { findMany: vi.fn() },
  auditLog: { create: vi.fn() }, notification: { createMany: vi.fn() },
}));
const emails = vi.hoisted(() => ({ sendBatch: vi.fn() }));
vi.mock("../../../src/config/database", () => ({ default: db }));
vi.mock("../../../src/services/email.service", () => ({ EmailService: emails }));
import { OperationalAuthorization } from "../../../src/access/operational-authorization";
import { RepositoryPublicationService } from "../../../src/services/repository-publication.service";
import { RepositoryPublicationRepository } from "../../../src/repositories/repository-publication.repository";
import { DatabankService } from "../../../src/services/databank.service";
import { MemoService } from "../../../src/services/memo.service";
let current: any;
const auth = new OperationalAuthorization(true, async () => current);
const publication = new RepositoryPublicationService(new RepositoryPublicationRepository(), auth);
const databank = new DatabankService(auth); const memo = new MemoService(auth);
function account(keys: string[] = [], extra = {}) {
  current = { id: "actor", role: "ADMIN", isActive: true, mustChangePassword: false, panelist: null,
    administratorAccess: { level: "RESTRICTED" }, capabilityGrants: keys.map(capabilityKey => ({ capabilityKey })), ...extra };
}
const archive = () => ({ id: "entry", thesisId: "thesis", title: "Research", abstract: null, keywords: null,
  isPublic: false, publishedAt: null, createdAt: new Date(), fullPaperPath: "/private/manuscript", respondentDataPath: "/private/raw",
  thesis: { id: "thesis", student: { userId: "owner", studentNumber: "number", user: { firstName: "Author", lastName: "Student" }, program: null } } });
beforeEach(() => {
  vi.resetAllMocks(); account(); db.user.findUnique.mockImplementation(async () => current);
  db.$transaction.mockImplementation(async work => work(db)); db.$queryRaw.mockResolvedValue([{ id: 1 }]);
  db.eLibrary.findMany.mockResolvedValue([archive()]); db.eLibrary.findUnique.mockResolvedValue(archive());
  db.eLibrary.findFirst.mockResolvedValue(archive()); db.eLibrary.updateMany.mockResolvedValue({ count: 1 });
  db.eLibrary.update.mockResolvedValue(archive()); db.memo.create.mockResolvedValue({ id: "memo" });
  db.memo.findUnique.mockResolvedValue({ id: "memo", title: "Memo", isArchived: false });
  db.memo.findMany.mockResolvedValue([]); db.memo.update.mockResolvedValue({ id: "memo", isArchived: true });
  db.auditLog.create.mockResolvedValue({}); db.notification.createMany.mockResolvedValue({ count: 1 });
  db.user.findMany.mockResolvedValue([]); db.student.findMany.mockResolvedValue([]); db.panelist.findMany.mockResolvedValue([]);
  db.student.findUnique.mockResolvedValue({ programId: "own-program" });
});
const actions = [
  ["repository.view", () => publication.listAdminEntries("actor"), db.eLibrary.findMany],
  ["repository.view", () => databank.getAllEntries({ userId: "actor", role: "CUSTOM" }), db.eLibrary.findMany],
  ["repository.manage", () => publication.publishMetadata("entry", "actor"), db.eLibrary.updateMany],
  ["repository.manage", async () => { db.eLibrary.findUnique.mockResolvedValue({ ...archive(), isPublic: true }); return publication.unpublishMetadata("entry", "actor"); }, db.eLibrary.updateMany],
  ["repository.manage", () => publication.updateMetadata("entry", "actor", { title: "Corrected" }), db.eLibrary.update],
  ["memos.manage", () => memo.createMemo("actor", "Memo", "Contents", "ALL"), db.memo.create],
  ["memos.manage", () => memo.archiveMemo("actor", "memo"), db.memo.update],
  ["memos.manage", () => memo.getAllMemos("actor"), db.memo.findMany],
  ["memos.manage", () => memo.getMemosForUser("actor", "CUSTOM"), db.memo.findMany],
] as const;
describe.each(actions)("FACULTY-9 repository/memo %s", (key, invoke, work) => {
  it("requires exact action authority and accepts enumerated Full", async () => {
    account([key]); await invoke(); expect(work).toHaveBeenCalled();
    account([], { administratorAccess: { level: "FULL" } }); await invoke();
  });
  it.each([[], ["settings.manage"], ["email.logs.view"]].map(keys => ({ keys })))("denies missing/unrelated capabilities %j before work", async ({ keys }) => {
    account(keys); await expect(invoke()).rejects.toMatchObject({ statusCode: 403 }); expect(work).not.toHaveBeenCalled();
  });
  it.each([{ isActive: false }, { mustChangePassword: true }, { administratorAccess: null },
    { administratorAccess: { level: "INVALID" } }, { capabilityGrants: [{ capabilityKey: "unknown" }] },
    { capabilityGrants: [{ capabilityKey: "repository.view" }, { capabilityKey: "repository.view" }] },
    { capabilityGrants: [{ capabilityKey: "essay.evaluate" }] }, { id: "other" },
  ])("rejects invalid current access %j", async extra => {
    account([key], extra); await expect(invoke()).rejects.toMatchObject({ statusCode: 403 }); expect(work).not.toHaveBeenCalled();
  });
  it("revoked authority cannot be restored by the next direct call", async () => {
    account([key]); await invoke(); account([]); work.mockClear();
    await expect(invoke()).rejects.toMatchObject({ statusCode: 403 }); expect(work).not.toHaveBeenCalled();
  });
});
describe("FACULTY-9 Repository and Memo preservation", () => {
  it("repository.view does not manage publication, metadata or memos", async () => {
    account(["repository.view"]);
    for (const call of [() => publication.publishMetadata("entry", "actor"), () => publication.unpublishMetadata("entry", "actor"),
      () => publication.updateMetadata("entry", "actor", { title: "title" }), () => memo.createMemo("actor", "title", "text", "ALL")]) {
      await expect(call()).rejects.toMatchObject({ statusCode: 403 });
    }
  });
  it("a supplied ADMIN string is not an authenticated Databank actor", async () => {
    await expect(databank.getAllEntries("ADMIN" as never)).rejects.toMatchObject({ statusCode: 403 });
    account([], { role: "STUDENT", administratorAccess: null });
    await expect(databank.getAllEntries({ userId: "actor", role: "ADMIN" })).rejects.toMatchObject({ statusCode: 403 });
    expect(db.eLibrary.findMany).not.toHaveBeenCalled();
  });
  it("omitted direct actors cannot bypass archive or all-memo reads", async () => {
    account([], { administratorAccess: { level: "FULL" } });
    await expect(publication.listAdminEntries()).rejects.toMatchObject({ statusCode: 403 });
    await expect(publication.unpublishMetadata("entry")).rejects.toMatchObject({ statusCode: 403 });
    await expect(memo.getAllMemos()).rejects.toMatchObject({ statusCode: 403 });
  });
  it.each([["repository.view"], ["repository.manage"], []].map(keys => ({ keys })))("no blanket Admin respondent links with %j", async ({ keys }) => {
    account(keys);
    const dto = await publication.getPublished("entry", { userId: "actor", role: "ADMIN" });
    expect(dto.respondentDataUrl).toBeNull(); expect(dto.canDownloadRespondentData).toBe(false);
    expect(JSON.stringify(dto)).not.toContain("/private/"); expect(dto.canDownloadManuscript).toBe(true);
  });
  it("Full still cannot download another researcher's raw data", async () => {
    account([], { administratorAccess: { level: "FULL" } });
    const [dto] = await publication.listPublished(undefined, { userId: "actor", role: "ADMIN" });
    expect(dto.canDownloadRespondentData).toBe(false); expect(dto.respondentDataUrl).toBeNull();
  });
  it.each(["STUDENT", "PANELIST", "FACULTY", "ADMIN"])("published manuscript member behavior remains for %s", async role => {
    account([], { role, administratorAccess: role === "ADMIN" ? { level: "RESTRICTED" } : null,
      panelist: ["PANELIST", "FACULTY"].includes(role) ? { isActive: true } : null });
    expect((await publication.getPublished("entry", { userId: "actor", role: "CUSTOM" })).canDownloadManuscript).toBe(true);
  });
  it("researcher ownership is current Student identity, never a role claim", async () => {
    account([], { id: "owner", role: "STUDENT", administratorAccess: null });
    expect((await publication.getPublished("entry", { userId: "owner", role: "ADMIN" })).canDownloadRespondentData).toBe(true);
    current.role = "FACULTY"; current.panelist = { isActive: true };
    expect((await publication.getPublished("entry", { userId: "owner", role: "STUDENT" })).canDownloadRespondentData).toBe(false);
  });
  it("guest metadata has no downloads; private and unknown publications remain 404", async () => {
    const dto = await publication.getPublished("entry"); expect(dto.canDownloadManuscript).toBe(false); expect(dto.canDownloadRespondentData).toBe(false);
    db.eLibrary.findFirst.mockResolvedValue(null); await expect(publication.getPublished("private")).rejects.toMatchObject({ statusCode: 404 });
    await expect(publication.getPublished("missing")).rejects.toMatchObject({ statusCode: 404 });
  });
  it("optional identity cannot use invalid/password-gated authority for download links", async () => {
    account([], { mustChangePassword: true }); await expect(publication.getPublished("entry", { userId: "actor", role: "ADMIN" })).rejects.toMatchObject({ statusCode: 403 });
  });
  it.each(["FACULTY", "PANELIST"])("preserves active %s audience, ignores stale ADMIN claim", async role => {
    account([], { role, administratorAccess: null, panelist: { isActive: true } });
    await memo.getMemosForUser("actor", "ADMIN");
    expect(db.memo.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {
      isArchived: false, OR: [{ targetAudience: "ALL" }, { targetAudience: "PANELISTS" }],
    } }));
  });
  it("preserves Student Program audience and excludes archived memos", async () => {
    account([], { role: "STUDENT", administratorAccess: null }); await memo.getMemosForUser("actor", "ADMIN");
    expect(db.memo.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { isArchived: false, OR: [
      { targetAudience: "ALL" }, { targetAudience: "STUDENTS" }, { targetAudience: "PROGRAM", programId: "own-program" },
    ] } }));
  });
  it("non-Admin fallback cannot read the all-memo projection", async () => {
    account([], { role: "APPLICANT", administratorAccess: null }); await memo.getMemosForUser("actor", "ADMIN");
    expect(db.memo.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { isArchived: false, targetAudience: "ALL" } }));
  });
  it("Memo persistence keeps authenticated creator and audience/Program, notification behavior", async () => {
    account(["memos.manage"]); db.student.findMany.mockResolvedValue([{ user: { id: "student", email: "student@example.test", isActive: true } }]);
    await memo.createMemo("actor", "Memo", "Content", "PROGRAM", "program", "/private/attachment");
    expect(db.memo.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ createdById: "actor", targetAudience: "PROGRAM", programId: "program" }) }));
    expect(db.notification.createMany).toHaveBeenCalledWith({ data: [expect.objectContaining({ userId: "student", relatedRecordId: "memo", type: "MEMO" })] });
    expect(emails.sendBatch).toHaveBeenCalledWith(["student@example.test"], "memo_broadcast", expect.objectContaining({ memo_title: "Memo" }));
    expect(db.memo.create.mock.calls[0][0].include.createdBy).toEqual({ select: { id: true, firstName: true, lastName: true, role: true } });
  });
  it("revocation while waiting on the shared fence prevents publication and Memo writes", async () => {
    for (const [key, invoke, work] of actions.filter(([key]) => ["repository.manage", "memos.manage"].includes(key)).slice(0, 5)) {
      account([key]); db.$queryRaw.mockImplementation(async () => { account([]); return [{ id: 1 }]; });
      work.mockClear(); await expect(invoke()).rejects.toMatchObject({ statusCode: 403 }); expect(work).not.toHaveBeenCalled();
    }
  });
  it("audit failure rejects the transactional write before notifications", async () => {
    account(["memos.manage"]); db.auditLog.create.mockRejectedValue(new Error("audit unavailable"));
    await expect(memo.createMemo("actor", "Memo", "Content", "ALL")).rejects.toThrow("audit unavailable");
    expect(db.$transaction).toHaveBeenCalled(); expect(db.notification.createMany).not.toHaveBeenCalled(); expect(emails.sendBatch).not.toHaveBeenCalled();
  });
  it("Memo reads and writes project attachment links without physical paths", async () => {
    account(["memos.manage"]);
    db.memo.findMany.mockResolvedValue([{ id: "memo", attachmentUrl: "C:/private/memos/circular.pdf" }]);
    expect((await memo.getAllMemos("actor"))[0].attachmentUrl).toBe("/api/documents/memo/memo/file");
    db.memo.create.mockResolvedValue({ id: "memo", attachmentUrl: "C:/private/memos/circular.pdf" });
    const dto = await memo.createMemo("actor", "Memo", "Content", "ALL", undefined, "C:/private/memos/circular.pdf");
    expect(dto.attachmentUrl).toBe("/api/documents/memo/memo/file"); expect(JSON.stringify(dto)).not.toContain("C:/private");
  });
  it("existing archived state blocks a second archive and its audit", async () => {
    account(["memos.manage"]); db.memo.findUnique.mockResolvedValue({ id: "memo", isArchived: true });
    await expect(memo.archiveMemo("actor", "memo")).rejects.toThrow("already archived");
    expect(db.memo.update).not.toHaveBeenCalled(); expect(db.auditLog.create).not.toHaveBeenCalled();
  });
});
