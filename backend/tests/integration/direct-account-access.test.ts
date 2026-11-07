// Opt-in, local disposable database only. Never connects to the configured application schema.
import { randomUUID, createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, writeFileSync, readdirSync, cpSync, rmSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import mysql, { type Connection, type RowDataPacket } from "mysql2/promise";
import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { readConfiguredAccountAccess } from "../../src/access/account-access.store";
import { canAuthorizeDirectCapability } from "../../src/access/account-access";

describe.skipIf(process.env.FACULTY_1_DB_TEST !== "1")("FACULTY-1 real MariaDB migration/integrity", () => {
  const database = `faculty1_test_${randomUUID().replace(/-/g, "")}`;
  const migration = "20261108000000_direct_account_access";
  const ids = Object.fromEntries(["actor", "admin", "faculty", "student", "custom", "profile", "role", "feature", "program", "studentRow", "adviser", "thesis", "schedule", "panel", "audit"].map(key => [key, randomUUID()]));
  let connection: Connection | undefined;
  let client: PrismaClient | undefined;
  let created = false;
  let foundationApplied = false;
  let folder: string | undefined;
  let config: string;
  let legacyTables: string[];
  let before: string;
  let after: string;
  let emptyAccessCounts: number[];

  function assertDisposableDatabase() {
    if (!/^faculty1_test_[0-9a-f]{32}$/.test(database)) throw new Error("Unsafe disposable database identity.");
  }
  function deploy() {
    return execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy", "--config", config], { encoding: "utf8", stdio: "pipe", timeout: 45_000 });
  }
  async function snapshot() {
    const values = [];
    for (const table of legacyTables) {
      // Names come from this isolated database's information_schema, never a request body.
      if (!/^[a-z0-9_]+$/.test(table)) throw new Error("Unexpected table identifier.");
      const [rows] = await connection!.query(`SELECT * FROM \`${table}\``);
      values.push([table, JSON.parse(JSON.stringify(rows)).sort((a: unknown, b: unknown) => JSON.stringify(a).localeCompare(JSON.stringify(b)))]);
    }
    return createHash("sha256").update(JSON.stringify(values)).digest("hex");
  }

  beforeAll(async () => {
    if (!process.env.FACULTY_1_DB_SERVER_URL) throw new Error("An explicit isolated test-server URL is required; application DATABASE_URL/.env is never used.");
    const url = new URL(process.env.FACULTY_1_DB_SERVER_URL);
    if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error("Only a LOCAL disposable database is supported.");
    if (url.pathname !== "/" && url.pathname !== "") throw new Error("Use a server-only URL without an application schema.");
    // Never connect to an application schema. No live inventory is read.
    url.pathname = "/";
    url.search = "";
    connection = await mysql.createConnection(url.toString());
    assertDisposableDatabase();
    await connection.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    created = true;
    await connection.query(`USE \`${database}\``);
    await connection.query("SET SESSION sql_mode = 'STRICT_ALL_TABLES'");
    url.pathname = `/${database}`;
    // Keep all generated config under the workspace; remove only this exact random folder.
    mkdirSync(path.resolve(".tmp"), { recursive: true });
    folder = mkdtempSync(path.resolve(".tmp/faculty1-"));
    const migrations = path.join(folder, "migrations");
    for (const item of readdirSync("prisma/migrations")) {
      if (item < migration || item === "migration_lock.toml") cpSync(path.resolve("prisma/migrations", item), path.join(migrations, item), { recursive: true });
    }
    config = path.join(folder, "prisma.config.ts");
    writeFileSync(config, `export default ${JSON.stringify({ schema: path.resolve("prisma/schema.prisma"), migrations: { path: migrations }, datasource: { url: url.toString() } })}`);
    deploy();
    client = new PrismaClient({ adapter: new PrismaMariaDb(url.toString().replace("mysql://", "mariadb://")) });
    await client.$connect();
    for (const [key, role] of [["actor", "ADMIN"], ["admin", "ADMIN"], ["faculty", "PANELIST"], ["student", "STUDENT"], ["custom", "CUSTOM"]] as const) {
      await client.user.create({ data: { id: ids[key], email: `${ids[key]}@example.invalid`, firstName: "Synthetic", lastName: key, passwordHash: "unusable-test-hash", role } });
    }
    await client.panelist.create({ data: { id: ids.profile, userId: ids.faculty, isExternal: true, isAvailableAsAdviser: false } });
    await client.customRole.create({ data: { id: ids.role, roleName: "Synthetic legacy role", createdById: ids.actor } });
    await client.roleFeatureAccess.create({ data: { id: ids.feature, roleId: ids.role, featureKey: "legacy.unknown", canView: true, canEdit: true } });
    await client.user.update({ where: { id: ids.custom }, data: { customRoleId: ids.role } });
    await client.program.create({ data: { id: ids.program, programName: "Synthetic preservation", programType: "MASTERS" } });
    await client.student.create({ data: { id: ids.studentRow, userId: ids.student, programId: ids.program } });
    // Historical relationship fixture is intentionally separate from this External profile.
    await client.adviserAssignment.create({ data: { id: ids.adviser, studentId: ids.studentRow, adviserId: ids.actor, assignedDate: new Date("2020-01-01"), isActive: false } });
    await client.thesisRecord.create({ data: { id: ids.thesis, studentId: ids.studentRow, assignmentId: ids.adviser } });
    await client.defenseSchedule.create({ data: { id: ids.schedule, thesisId: ids.thesis, defenseDate: new Date("2020-01-01"), defenseTime: new Date("1970-01-01T08:00:00Z"), venueOrLink: "Synthetic", setById: ids.actor, defenseType: "TITLE_DEFENSE" } });
    await client.panelAssignment.create({ data: { id: ids.panel, scheduleId: ids.schedule, userId: ids.faculty, role: "PANELIST", isActive: false } });
    await client.auditLog.create({ data: { id: ids.audit, actorId: ids.actor, actionType: "SYNTHETIC_PRESERVATION", oldValue: "immutable legacy evidence" } });
    const [tables] = await connection.execute<RowDataPacket[]>("SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME <> '_prisma_migrations' ORDER BY TABLE_NAME", [database]);
    legacyTables = tables.map(row => String(row.name));
    before = await snapshot();
    cpSync(path.resolve("prisma/migrations", migration), path.join(migrations, migration), { recursive: true });
    expect(deploy()).toContain(migration);
    foundationApplied = true;
    after = await snapshot();
    emptyAccessCounts = [await client.administratorAccess.count(), await client.accountCapabilityGrant.count()];
  }, 60_000);

  afterEach(async () => {
    if (client && foundationApplied) {
      await client.accountCapabilityGrant.deleteMany();
      await client.administratorAccess.deleteMany();
    }
  });

  afterAll(async () => {
    try {
      await client?.$disconnect();
      if (connection && created) {
        assertDisposableDatabase();
        await connection.query("SET FOREIGN_KEY_CHECKS = 0");
        await connection.query(`DROP DATABASE \`${database}\``);
        const [remaining] = await connection.execute<RowDataPacket[]>("SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?", [database]);
        expect(remaining).toHaveLength(0);
      }
    } finally {
      await connection?.end();
      if (folder) {
        const absolute = path.resolve(folder);
        if (path.dirname(absolute) !== path.resolve(".tmp") || !path.basename(absolute).startsWith("faculty1-")) throw new Error("Unsafe temporary folder cleanup.");
        rmSync(absolute, { recursive: true, force: true });
      }
    }
  }, 60_000);

  it("preserves every original table/row/credential/legacy relationship byte-for-byte", () => {
    expect(after).toBe(before);
    expect(emptyAccessCounts).toEqual([0, 0]);
  });

  it("deploys the full committed chain and has no migrations on repeat deploy", () => {
    expect(deploy()).toContain("No pending migrations");
  });

  it("does not bootstrap existing Admin, academic or CUSTOM accounts", async () => {
    for (const key of ["admin", "faculty", "custom"]) {
      expect((await readConfiguredAccountAccess(client!, ids[key])).capabilities).toEqual([]);
    }
  });

  const metadata = () => ({ userId: ids.admin, level: "RESTRICTED" as const, createdById: ids.actor, updatedById: ids.actor });
  const grant = () => ({ userId: ids.admin, capabilityKey: "students.view", createdById: ids.actor, updatedById: ids.actor });

  it("enforces one access-level record per User and one grant per User/key", async () => {
    await client!.administratorAccess.create({ data: metadata() });
    await expect(client!.administratorAccess.create({ data: metadata() })).rejects.toMatchObject({ code: "P2002" });
    await client!.accountCapabilityGrant.create({ data: grant() });
    await expect(client!.accountCapabilityGrant.create({ data: grant() })).rejects.toMatchObject({ code: "P2002" });
    await client!.accountCapabilityGrant.create({ data: { ...grant(), userId: ids.actor } });
  });

  it("rejects missing targets and creator/updater attribution via foreign keys", async () => {
    for (const field of ["userId", "createdById", "updatedById"] as const) {
      await expect(client!.administratorAccess.create({ data: { ...metadata(), [field]: randomUUID() } })).rejects.toMatchObject({ code: "P2003" });
      await expect(client!.accountCapabilityGrant.create({ data: { ...grant(), [field]: randomUUID() } })).rejects.toMatchObject({ code: "P2003" });
    }
  });

  it("rejects absent/invalid Admin levels in SQL and does not default to Full", async () => {
    await expect(connection!.execute("INSERT INTO administrator_access (user_id,created_by_id,updated_by_id,updated_at) VALUES (?,?,?,NOW(3))", [ids.admin, ids.actor, ids.actor])).rejects.toBeDefined();
    await expect(connection!.execute("INSERT INTO administrator_access (user_id,level,created_by_id,updated_by_id,updated_at) VALUES (?,'SUPER_ADMIN',?,?,NOW(3))", [ids.admin, ids.actor, ids.actor])).rejects.toBeDefined();
    await expect(connection!.execute("INSERT INTO administrator_access (user_id,level,created_by_id,updated_by_id,updated_at) VALUES (?,'full',?,?,NOW(3))", [ids.admin, ids.actor, ids.actor])).rejects.toBeDefined();
  });

  it("keeps attribution and target User rows from cascading away", async () => {
    await client!.administratorAccess.create({ data: metadata() });
    await client!.accountCapabilityGrant.create({ data: grant() });
    await expect(client!.user.delete({ where: { id: ids.admin } })).rejects.toMatchObject({ code: "P2003" });
  });

  it("resolves persisted grants without enabling live authorization; revocation is reread", async () => {
    await client!.administratorAccess.create({ data: metadata() });
    await client!.accountCapabilityGrant.create({ data: grant() });
    const access = await readConfiguredAccountAccess(client!, ids.admin);
    expect(access.capabilities).toEqual(["students.view"]);
    expect(canAuthorizeDirectCapability(access, "students.view")).toBe(false);
    await client!.accountCapabilityGrant.deleteMany();
    expect((await readConfiguredAccountAccess(client!, ids.admin)).capabilities).toEqual([]);
  });

  it("denies invalid persisted categories and unknown keys rather than trusting SQL existence", async () => {
    await client!.administratorAccess.create({ data: { ...metadata(), level: "FULL" } });
    await client!.accountCapabilityGrant.create({ data: { ...grant(), capabilityKey: "essay.evaluate" } });
    expect((await readConfiguredAccountAccess(client!, ids.admin)).status).toBe("INVALID_CONFIGURATION");
    await client!.accountCapabilityGrant.deleteMany();
    await client!.accountCapabilityGrant.create({ data: { ...grant(), capabilityKey: "legacy.unknown" } });
    expect((await readConfiguredAccountAccess(client!, ids.admin)).capabilities).toEqual([]);
    await client!.administratorAccess.create({ data: { ...metadata(), userId: ids.student, level: "FULL" } });
    expect((await readConfiguredAccountAccess(client!, ids.student)).status).toBe("UNSUPPORTED_ACCOUNT");
  });
});
