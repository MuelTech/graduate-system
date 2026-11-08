import express from "express";
import jwt from "jsonwebtoken";
import { createServer } from "node:http";
import { Prisma } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ user: { findUnique: vi.fn() }, auditLog: { findUnique: vi.fn() }, $executeRaw: vi.fn() }));
vi.mock("../../../src/config/database", () => ({ default: db }));
import settingsRoutes from "../../../src/routes/settings.routes";
import { SettingsRepository } from "../../../src/repositories/settings.repository";
import { SettingsService } from "../../../src/services/settings.service";
import { ACCESS_AUDIT_ACTIONS, PROTECTED_ACCESS_AUDIT_PREFIXES } from "../../../src/access/access-audit";
import { FACULTY_AUDIT_ACTIONS } from "../../../src/access/faculty-configuration";

let rows: { id: string; actionType: string }[];
let server: ReturnType<typeof createServer>; let url: string;
const secret = "faculty-4-audit-synthetic-secret";
beforeAll(async () => {
  vi.stubEnv("JWT_SECRET", secret);
  const app = express(); app.use(express.json()); app.use("/api/settings", settingsRoutes);
  server = createServer(app); await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  url = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/settings/audit-logs`;
});
afterAll(async () => { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); vi.unstubAllEnvs(); });
beforeEach(() => {
  vi.clearAllMocks(); rows = [
    ...Object.values(ACCESS_AUDIT_ACTIONS).map((actionType, i) => ({ id: `protected-${i}`, actionType })),
    { id: "future-admin", actionType: "ADMINISTRATOR_ACCESS_FUTURE" },
    { id: "future-capability", actionType: "ACCOUNT_CAPABILITY_FUTURE" },
    { id: "ordinary", actionType: "DOCUMENT_VIEW" },
  ];
  db.user.findUnique.mockResolvedValue({ id: "full-a", role: "ADMIN", isActive: true, mustChangePassword: false,
    administratorAccess: { level: "FULL" }, capabilityGrants: [], panelist: null });
  db.auditLog.findUnique.mockImplementation(async ({ where }) => rows.find(row => row.id === where.id) ?? null);
  db.$executeRaw.mockImplementation(async (strings, ...values) => {
    const query = Prisma.sql(strings, ...values);
    const firstPrefix = query.values.findIndex(value => PROTECTED_ACCESS_AUDIT_PREFIXES.includes(value as never));
    const ids = query.values.slice(0, firstPrefix);
    const prefixes = query.values.slice(firstPrefix).filter((_, index) => index % 2 === 0) as string[];
    expect(query.sql).toMatch(/DELETE FROM audit_logs WHERE log_id IN/);
    expect(query.sql).toMatch(/LEFT\(action_type, CHAR_LENGTH\(\?\)\) <> \?/);
    expect(query.sql).not.toMatch(/LIKE/);
    const deleted = rows.filter(row => ids.includes(row.id) && !prefixes.some(prefix => row.actionType.startsWith(prefix)));
    rows = rows.filter(row => !deleted.includes(row)); return deleted.length;
  });
});
describe("FACULTY-4 protected audit deletion", () => {
  it("preserves FACULTY-10 profile/status/access evidence under the existing protected prefix", async () => {
    const facultyRows = Object.values(FACULTY_AUDIT_ACTIONS).map((actionType, i) => ({ id: `faculty-${i}`, actionType }));
    rows.push(...facultyRows);
    expect(await new SettingsRepository().deleteAuditLogs(facultyRows.map(row => row.id))).toEqual({ count: 0 });
    for (const row of facultyRows) {
      await expect(new SettingsRepository().deleteAuditLog(row.id)).rejects.toMatchObject({ statusCode: 403 });
      expect(rows).toContainEqual(row);
    }
  });
  it.each(Object.values(ACCESS_AUDIT_ACTIONS))("denies single deletion of %s at the repository boundary", async action => {
    const row = rows.find(row => row.actionType === action)!;
    await expect(new SettingsRepository().deleteAuditLog(row.id)).rejects.toMatchObject({ statusCode: 403 });
    expect(rows).toContainEqual(row);
    const [strings, ...values] = db.$executeRaw.mock.calls[0]; const query = Prisma.sql(strings, ...values);
    expect(query.values).toEqual([row.id, "ADMINISTRATOR_ACCESS_", "ADMINISTRATOR_ACCESS_", "ACCOUNT_CAPABILITY_", "ACCOUNT_CAPABILITY_"]);
  });
  it("bulk deletion preserves all known/future protected events and deletes only ordinary rows", async () => {
    const result = await new SettingsService().deleteAuditLogs(rows.map(row => row.id));
    expect(result.count).toBe(1); expect(rows.every(row => row.id !== "ordinary")).toBe(true); expect(rows).toHaveLength(9);
  });
  it("retains ordinary single deletion and missing-record behavior", async () => {
    expect(await new SettingsService().deleteAuditLog("ordinary")).toMatchObject({ message: "Audit log deleted." });
    await expect(new SettingsService().deleteAuditLog("missing")).rejects.toMatchObject({ statusCode: 404 });
  });
  it("compares literal namespaces without treating underscores as SQL wildcards", async () => {
    rows.push({ id: "lookalike", actionType: "ADMINISTRATORxACCESSyFUTURE" });
    expect(await new SettingsService().deleteAuditLog("lookalike")).toMatchObject({ message: "Audit log deleted." });
    expect(rows.some(row => row.id === "future-admin")).toBe(true);
  });
  it("binds hostile identifiers as values without widening the DELETE", async () => {
    const hostile = "ordinary') OR 1=1 --";
    await expect(new SettingsService().deleteAuditLog(hostile)).rejects.toMatchObject({ statusCode: 404 });
    const [strings, ...values] = db.$executeRaw.mock.calls[0]; const query = Prisma.sql(strings, ...values);
    expect(query.values[0]).toBe(hostile); expect(query.sql).not.toContain(hostile); expect(rows).toHaveLength(10);
  });
  it("protects both actual generic Settings HTTP deletion aliases even from Full Admin", async () => {
    const headers = { Authorization: `Bearer ${jwt.sign({ userId: "full-a", role: "ADMIN" }, secret)}`, "Content-Type": "application/json" };
    expect((await fetch(`${url}/protected-0`, { method: "DELETE", headers })).status).toBe(403);
    const bulk = await fetch(`${url}/delete`, { method: "POST", headers, body: JSON.stringify({ ids: rows.map(row => row.id) }) });
    expect(bulk.status).toBe(200); expect((await bulk.json()).count).toBe(1);
    expect(rows).toHaveLength(9);
  });
  it.each([undefined, null, {}, "ordinary", [null], [""], Array(1001).fill("ordinary")])("rejects malformed bulk identifiers %j", async ids => {
    await expect(new SettingsService().deleteAuditLogs(ids as never)).rejects.toMatchObject({ statusCode: 400 });
    expect(db.$executeRaw).not.toHaveBeenCalled();
  });
});
