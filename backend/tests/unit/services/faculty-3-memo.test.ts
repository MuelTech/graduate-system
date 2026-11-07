import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  panelist: { findMany: vi.fn() }, memo: { create: vi.fn(), findMany: vi.fn() },
  auditLog: { create: vi.fn() }, notification: { createMany: vi.fn() },
}));
const email = vi.hoisted(() => ({ sendBatch: vi.fn() }));
vi.mock("../../../src/config/database", () => ({ default: db }));
vi.mock("../../../src/services/email.service", () => ({ EmailService: email }));
import { MemoService } from "../../../src/services/memo.service";

beforeEach(() => {
  vi.clearAllMocks(); db.memo.create.mockResolvedValue({ id: "memo-1" });
  db.memo.findMany.mockResolvedValue([]); db.auditLog.create.mockResolvedValue({});
  db.notification.createMany.mockResolvedValue({ count: 2 }); email.sendBatch.mockResolvedValue(undefined);
});
describe("FACULTY-3 retained PANELISTS audience", () => {
  it.each(["PANELIST", "FACULTY"])("scopes %s feed to ALL + PANELISTS", async role => {
    await new MemoService().getMemosForUser("academic-1", role);
    expect(db.memo.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {
      isArchived: false, OR: [{ targetAudience: "ALL" }, { targetAudience: "PANELISTS" }],
    } }));
  });
  it("delivers notifications/emails to both active academic identities, excluding mismatched/disabled profiles", async () => {
    db.panelist.findMany.mockResolvedValue([
      ...["PANELIST", "FACULTY", "ADMIN", "CUSTOM", "STUDENT", "APPLICANT"].map(role => ({
        isActive: true, user: { id: role, email: `${role}@example.test`, isActive: true, role },
      })),
      { isActive: false, user: { id: "inactive-profile", email: "disabled@example.test", isActive: true, role: "FACULTY" } },
      { isActive: true, user: { id: "inactive-user", email: "disabled@example.test", isActive: false, role: "PANELIST" } },
    ]);
    await new MemoService().createMemo("admin", "Test", "Synthetic", "PANELISTS");
    const notifications = db.notification.createMany.mock.calls[0][0].data;
    expect(notifications.map((row: any) => row.userId)).toEqual(["PANELIST", "FACULTY"]);
    expect(notifications.every((row: any) => row.type === "MEMO" && row.relatedRecordId === "memo-1")).toBe(true);
    expect(email.sendBatch.mock.calls[0][0]).toEqual(["PANELIST@example.test", "FACULTY@example.test"]);
  });
});
