// Opt-in only. The application database singleton is mocked even when this file is skipped.
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import mysql, { type Connection } from "mysql2/promise";
import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../../src/config/database", () => ({ default: null }));
import { AdministratorAccessRepository } from "../../src/repositories/administrator-access.repository";
import { AdministratorAccessService } from "../../src/services/administrator-access.service";
import { isolatedAdministratorDatabaseServer } from "../helpers/isolated-administrator-database";

describe.skipIf(process.env.FACULTY_4_DB_TEST !== "1")("FACULTY-4 isolated MariaDB migration/contention", () => {
  const schema = `faculty4_test_${randomUUID().replace(/-/g, "")}`;
  const ids = { a: randomUUID(), b: randomUUID(), target: randomUUID() };
  let connection: Connection | undefined; let client: PrismaClient | undefined;
  let folder: string | undefined; let created = false; let service: AdministratorAccessService;
  function safeSchema() { if (!/^faculty4_test_[0-9a-f]{32}$/.test(schema)) throw new Error("Unsafe isolated schema identity."); }
  beforeAll(async () => {
    if (!process.env.FACULTY_4_DB_SERVER_URL || !process.env.DATABASE_URL) {
      throw new Error("Explicit isolated FACULTY_4_DB_SERVER_URL and application DATABASE_URL are required.");
    }
    const url = isolatedAdministratorDatabaseServer(process.env.FACULTY_4_DB_SERVER_URL, process.env.DATABASE_URL);
    url.pathname = "/"; url.search = "";
    connection = await mysql.createConnection(url.toString()); safeSchema();
    await connection.query(`CREATE DATABASE \`${schema}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`); created = true;
    await connection.query(`USE \`${schema}\``); url.pathname = `/${schema}`;
    mkdirSync(path.resolve(".tmp"), { recursive: true }); folder = mkdtempSync(path.resolve(".tmp/faculty4-"));
    const migrations = path.join(folder, "migrations"); cpSync(path.resolve("prisma/migrations"), migrations, { recursive: true });
    const config = path.join(folder, "prisma.config.ts");
    writeFileSync(config, `export default ${JSON.stringify({ schema: path.resolve("prisma/schema.prisma"), migrations: { path: migrations }, datasource: { url: url.toString() } })}`);
    execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy", "--config", config], { stdio: "pipe", timeout: 45000 });
    client = new PrismaClient({ adapter: new PrismaMariaDb(url.toString().replace("mysql://", "mariadb://")) });
    await client.$connect();
    service = new AdministratorAccessService(new AdministratorAccessRepository(client), () => true);
    for (const id of Object.values(ids)) await client.user.create({ data: { id, email: `${id}@example.invalid`,
      firstName: "Synthetic", lastName: "Administrator", role: "ADMIN", passwordHash: "unusable-synthetic-test-hash" } });
  }, 60000);
  beforeEach(async () => {
    await client!.auditLog.deleteMany(); await client!.accountCapabilityGrant.deleteMany();
    await client!.user.updateMany({ data: { isActive: true, mustChangePassword: false } });
    for (const id of Object.values(ids)) {
      const level = id === ids.target ? "RESTRICTED" : "FULL";
      await client!.administratorAccess.upsert({ where: { userId: id }, update: { level },
        create: { userId: id, level, createdById: ids.a, updatedById: ids.a } });
    }
  });
  afterAll(async () => {
    try {
      await client?.$disconnect();
      if (connection && created) { safeSchema(); await connection.query(`DROP DATABASE \`${schema}\``);
        const [remaining] = await connection.query("SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?", [schema]);
        expect(remaining).toHaveLength(0);
      }
    } finally {
      await connection?.end();
      if (folder) {
        const absolute = path.resolve(folder);
        if (path.dirname(absolute) !== path.resolve(".tmp") || !path.basename(absolute).startsWith("faculty4-")) throw new Error("Unsafe isolated test-folder cleanup.");
        rmSync(absolute, { recursive: true, force: true });
      }
    }
  }, 60000);
  it.each(["demote", "disable", "remove"])("serializes competing Full %s operations on real InnoDB locks", async operation => {
    const change = (id: string) => operation === "remove" ? service.removeAccess(id, id) : service.update(id, id,
      operation === "demote" ? { level: "RESTRICTED", capabilityKeys: [] } : { isActive: false });
    const results = await Promise.allSettled([change(ids.a), change(ids.b)]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(await client!.user.count({ where: { role: "ADMIN", isActive: true, administratorAccess: { is: { level: "FULL" } } } })).toBe(1);
  });
  it("rechecks a waiting actor after a committed Full revocation", async () => {
    await connection!.beginTransaction();
    try {
      await connection!.query("SELECT id FROM administrator_access_lock WHERE id = 1 FOR UPDATE");
      await connection!.query("UPDATE administrator_access SET level = 'RESTRICTED' WHERE user_id = ?", [ids.a]);
      // Attach rejection handler before releasing the fence; use a second pooled connection for the service.
      const result = service.update(ids.a, ids.target, { level: "FULL" }).then(value => ({ value }), error => ({ error }));
      await new Promise(resolve => setTimeout(resolve, 100)); await connection!.commit();
      expect(await result).toMatchObject({ error: { statusCode: 403 } });
      expect((await client!.administratorAccess.findUnique({ where: { userId: ids.target } }))?.level).toBe("RESTRICTED");
    } catch (error) { await connection!.rollback(); throw error; }
  });
  it("rolls back privileged changes when the database rejects required audit insertion", async () => {
    await connection!.query("CREATE TRIGGER faculty4_fail_audit BEFORE INSERT ON audit_logs FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'synthetic audit failure'");
    try {
      await expect(service.update(ids.a, ids.target, { isActive: false, capabilityKeys: ["students.view"] })).rejects.toBeDefined();
      expect((await client!.user.findUnique({ where: { id: ids.target } }))?.isActive).toBe(true);
      expect(await client!.accountCapabilityGrant.count({ where: { userId: ids.target } })).toBe(0);
      expect(await client!.auditLog.count()).toBe(0);
    } finally { await connection!.query("DROP TRIGGER faculty4_fail_audit"); }
  });
});
