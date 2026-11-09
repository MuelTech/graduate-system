// Synthetic fixtures only, on a NEW data directory and a different loopback port.
import "dotenv/config";
import { randomUUID, createHash } from "node:crypto";
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import express from "express";
import type { Server } from "node:http";
import mysql, { type Connection } from "mysql2/promise";
import { PrismaClient, type UserRole } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import { isolatedAdministratorDatabaseServer } from "../helpers/isolated-administrator-database";
import { captureSnapshot } from "../../src/access/cutover-rehearsal.database";
import { digest, type Snapshot } from "../../src/access/cutover-rehearsal";
import { accountEmailWhere } from "../../src/utils/account-email";

const bound = vi.hoisted(() => ({ client: null as PrismaClient | null }));
vi.mock("../../src/config/database", () => ({ default: new Proxy({}, { get(_target, key) {
  if (!bound.client) throw new Error("Synthetic database not bound.");
  const value = (bound.client as any)[key];
  return typeof value === "function" ? value.bind(bound.client) : value;
} }) }));
import { AuthService } from "../../src/services/auth.service";
import { AdministratorAccessService } from "../../src/services/administrator-access.service";
import { AdministratorAccessRepository } from "../../src/repositories/administrator-access.repository";
import { AdminPanelistService } from "../../src/services/admin-panelist.service";
import { AdminPanelistRepository } from "../../src/repositories/admin-panelist.repository";
import { OperationalAuthorization } from "../../src/access/operational-authorization";
import authRoutes from "../../src/routes/auth.routes";

const migration = "20261110010000_role_scoped_email_identity";
const enabled = process.env.FACULTY_17A_DB_TEST === "1" && Boolean(process.env.FACULTY_17A_DB_SERVER_URL);
describe.skipIf(!enabled)("FACULTY-17A isolated database identity and real authentication", () => {
  const clean = `faculty17a_test_${randomUUID().replaceAll("-", "")}`;
  const populated = `faculty17a_test_${randomUUID().replaceAll("-", "")}`;
  const created: string[] = [], originalSecret = process.env.JWT_SECRET;
  const source = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  let db: Connection, client: PrismaClient, folder: string, server: URL, http: Server, base: string;
  let before: Snapshot, preservedHash: string;
  const secret = "faculty17a-synthetic-only-secret";
  const password = "Faculty-17A-Own-Password", adminPassword = "Admin-17A-Different-Password";
  let academicHash: string, adminHash: string;
  const safe = (name: string) => { if (!/^faculty17a_test_[a-f0-9]{32}$/.test(name)) throw new Error("Unsafe disposable schema."); return `\`${name}\``; };
  const urlFor = (name: string) => { safe(name); const url = new URL(server); url.pathname = `/${name}`; return url.toString(); };
  async function connect(name = populated) { return mysql.createConnection({ host: server.hostname, port: Number(server.port),
    user: decodeURIComponent(server.username), password: decodeURIComponent(server.password), database: name,
    dateStrings: true, supportBigNumbers: true, bigNumberStrings: true }); }
  function config(name: string, migrations = path.resolve("prisma/migrations")) {
    const file = path.join(folder, `${name}.config.ts`);
    writeFileSync(file, `export default ${JSON.stringify({ schema: path.resolve("prisma/schema.prisma"), migrations: { path: migrations }, datasource: { url: urlFor(name) } })}`);
    return file;
  }
  const deploy = (file: string) => execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy", "--config", file], { encoding: "utf8", stdio: "pipe", timeout: 60_000 });
  const snapshot = () => captureSnapshot(db, populated, source);
  function business(state: Snapshot) { return Object.fromEntries(Object.entries(state.tables).filter(([name]) => name !== "_prisma_migrations")
    .map(([name, rows]) => [name, name === "users" ? rows.map(({ email_admin_key, email_faculty_key, ...row }) => row) : rows])); }
  const input = (email: string) => ({ email, firstName: "Synthetic", lastName: "Separate", level: "RESTRICTED", capabilityKeys: ["students.view"] });
  const adminService = () => new AdministratorAccessService(new AdministratorAccessRepository(client), () => true);
  const facultyService = () => new AdminPanelistService(new OperationalAuthorization(true), new AdminPanelistRepository(client));
  async function insert(connection: Connection, email: string, role: UserRole, id: string = randomUUID()) {
    return connection.execute("INSERT INTO users (user_id,email,role,password_hash,first_name,last_name,updated_at) VALUES (?,?,?,'synthetic-unusable','Synthetic','Matrix',NOW(3))", [id, email, role]);
  }
  async function rawMigration() {
    const sql = readFileSync(`prisma/migrations/${migration}/migration.sql`, "utf8").replace(/--[^\n]*/g, "");
    try { for (const statement of sql.split(";").filter(part => part.trim())) await db.query(statement); }
    finally { await db.query("DROP TEMPORARY TABLE IF EXISTS `_faculty17a_email_identity_requires_review`"); }
  }
  async function request(route: string, token: string, body?: unknown) {
    return fetch(`${base}/api/auth/${route}`, { method: body ? "POST" : "GET", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
  }
  beforeAll(async () => {
    server = isolatedAdministratorDatabaseServer(process.env.FACULTY_17A_DB_SERVER_URL!, process.env.DATABASE_URL!);
    if (server.search || server.hash || !Number(server.port)) throw new Error("Explicit isolated port required.");
    db = await mysql.createConnection({ host: server.hostname, port: Number(server.port), user: decodeURIComponent(server.username), password: decodeURIComponent(server.password), dateStrings: true });
    for (const name of [clean, populated]) { await db.query(`CREATE DATABASE ${safe(name)} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`); created.push(name); }
    await db.query(`USE ${safe(populated)}`);
    mkdirSync(path.resolve(".tmp"), { recursive: true }); folder = mkdtempSync(path.resolve(".tmp/faculty17a-"));
    const prefix = path.join(folder, "migrations");
    for (const name of readdirSync("prisma/migrations").filter(name => name < migration || name === "migration_lock.toml")) cpSync(path.resolve("prisma/migrations", name), path.join(prefix, name), { recursive: true });
    deploy(config(populated, prefix));
    client = new PrismaClient({ adapter: new PrismaMariaDb(urlFor(populated).replace("mysql://", "mariadb://")) }); bound.client = client;
    academicHash = await bcrypt.hash(password, 4); adminHash = await bcrypt.hash(adminPassword, 4);
    for (const [id, email, role, passwordHash] of [["full", "full@gmail.com", "ADMIN", adminHash], ["existing", " Person+Tag@Gmail.COM ", "FACULTY", academicHash],
      ["promote", "promote@gmail.com", "APPLICANT", academicHash], ["student", "student@gmail.com", "STUDENT", academicHash]] as const) {
      await client.user.create({ data: { id, email, role, passwordHash, firstName: "Synthetic", lastName: id }, select: { id: true } });
    }
    await client.panelist.create({ data: { userId: "existing", isAvailableAsAdviser: false } });
    await client.program.create({ data: { id: "program", programName: "Synthetic Education", programType: "MASTERS" } });
    await client.undergraduateProgram.create({ data: { id: "undergrad", programName: "Synthetic Education" } });
    for (const id of ["promote", "student"]) await client.student.create({ data: { userId: id, programId: "program", studentNumber: id === "student" ? "SN-17A" : "PROMOTED-17A", pinnacleApplicantId: `APP-${id}` } });
    await client.administratorAccess.create({ data: { userId: "full", level: "FULL", createdById: "full", updatedById: "full" } });
    await client.auditLog.create({ data: { actorId: "existing", actionType: "SYNTHETIC_HISTORY", oldValue: "Preserved actor attribution" } });
    before = await snapshot(); preservedHash = digest(business(before));
    process.env.JWT_SECRET = secret;
    const app = express(); app.use(express.json()); app.use("/api/auth", authRoutes);
    await new Promise<void>(resolve => { http = app.listen(0, "127.0.0.1", () => resolve()); });
    base = `http://127.0.0.1:${(http.address() as { port: number }).port}`;
  }, 120_000);
  afterAll(async () => {
    if (originalSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = originalSecret;
    try {
      if (http) await new Promise<void>((resolve, reject) => http.close(error => error ? reject(error) : resolve()));
      await client?.$disconnect(); bound.client = null;
      if (db) for (const name of created) await db.query(`DROP DATABASE ${safe(name)}`);
      if (db) expect((await db.query("SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME IN (?,?)", [clean, populated]))[0]).toHaveLength(0);
    } finally {
      await db?.end();
      if (folder) { const absolute = path.resolve(folder); if (path.dirname(absolute) !== path.resolve(".tmp") || !path.basename(absolute).startsWith("faculty17a-")) throw new Error("Unsafe cleanup."); rmSync(absolute, { recursive: true, force: true }); }
    }
  }, 60_000);
  it("refuses normalization collisions before permanent DDL and without merging records", async () => {
    await insert(db, "collision@gmail.com", "ADMIN", "collision-a"); await insert(db, " collision@gmail.com", "STUDENT", "collision-b");
    const prior = await snapshot();
    try { await expect(rawMigration()).rejects.toMatchObject({ code: "ER_DUP_ENTRY" }); expect(await snapshot()).toEqual(prior); }
    finally { await db.execute("DELETE FROM users WHERE user_id IN ('collision-a','collision-b')"); }
  });
  it("refuses unexpected email foreign-key dependencies before permanent DDL", async () => {
    await db.query("CREATE TABLE synthetic_email_fk (id INT PRIMARY KEY, email VARCHAR(191), FOREIGN KEY (email) REFERENCES users(email)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    const prior = await snapshot();
    try { await expect(rawMigration()).rejects.toMatchObject({ code: "ER_DUP_ENTRY" }); expect(await snapshot()).toEqual(prior); }
    finally { await db.query("DROP TABLE synthetic_email_fk"); }
  });
  it("refuses unexpected email collation rather than changing identity equivalence", async () => {
    await db.query("ALTER TABLE users MODIFY email VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL");
    const prior = await snapshot();
    try { await expect(rawMigration()).rejects.toMatchObject({ code: "ER_DUP_ENTRY" }); expect(await snapshot()).toEqual(prior); }
    finally { await db.query("ALTER TABLE users MODIFY email VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL"); }
  });
  it("deploys the clean chain and upgrades populated data without changing original columns/history", async () => {
    expect(deploy(config(clean))).toContain(migration); expect(deploy(config(populated))).toContain(migration);
    expect(digest(business(await snapshot()))).toBe(preservedHash);
    expect(deploy(config(populated))).toContain("No pending migrations");
    expect((await client.user.findUnique({ where: accountEmailWhere("person+tag@gmail.com", "FACULTY") }))?.id).toBe("existing");
  }, 120_000);
  const roles = ["ADMIN", "FACULTY", "PANELIST", "APPLICANT", "STUDENT"] as const;
  for (const first of roles) for (const second of roles) it(`database role matrix ${first} + ${second}`, async () => {
    const email = `${randomUUID()}@gmail.com`; await insert(db, email, first);
    const pair = first === "ADMIN" && ["FACULTY", "PANELIST"].includes(second) || second === "ADMIN" && ["FACULTY", "PANELIST"].includes(first);
    if (pair) await expect(insert(db, email, second)).resolves.toBeDefined();
    else await expect(insert(db, email, second)).rejects.toMatchObject({ code: "ER_DUP_ENTRY" });
  });
  it("enforces case/ASCII-space equivalence without Gmail dot/plus rewriting", async () => {
    await insert(db, " Mixed.Email+Tag@Gmail.COM ", "ADMIN");
    await insert(db, "mixed.email+tag@gmail.com", "FACULTY");
    await expect(insert(db, "MIXED.EMAIL+TAG@gmail.com", "PANELIST")).rejects.toMatchObject({ code: "ER_DUP_ENTRY" });
    await insert(db, "mixedemail+tag@gmail.com", "STUDENT"); await insert(db, "mixed.email@gmail.com", "APPLICANT");
  });
  it("overwrites forged key fields on INSERT and UPDATE; role/email mutation cannot bypass uniqueness", async () => {
    await insert(db, "forged@gmail.com", "ADMIN", "forged-admin");
    await db.execute("UPDATE users SET email_admin_key=NULL, email_faculty_key='forged-override' WHERE user_id='forged-admin'");
    expect(await client.user.findUnique({ where: accountEmailWhere("forged@gmail.com", "ADMIN"), select: { emailAdminKey: true, emailFacultyKey: true } })).toEqual({ emailAdminKey: "forged@gmail.com", emailFacultyKey: null });
    await expect(db.execute("INSERT INTO users (user_id,email,role,password_hash,first_name,last_name,updated_at,email_admin_key) VALUES ('forged-second','forged@gmail.com','ADMIN','x','S','S',NOW(),'bypass')")).rejects.toMatchObject({ code: "ER_DUP_ENTRY" });
    await insert(db, "forged@gmail.com", "FACULTY", "forged-faculty");
    await expect(db.execute("UPDATE users SET role='STUDENT' WHERE user_id='forged-faculty'")).rejects.toMatchObject({ code: "ER_DUP_ENTRY" });
  });
  it.each([["ADMIN", "ADMIN", 1], ["FACULTY", "PANELIST", 1], ["ADMIN", "FACULTY", 2], ["APPLICANT", "ADMIN", 1], ["STUDENT", "FACULTY", 1], ["APPLICANT", "STUDENT", 1]] as const)("concurrent %s/%s creation has exactly %i successful inserts", async (left, right, count) => {
    const a = await connect(), b = await connect(), email = `${randomUUID()}@gmail.com`;
    try {
      const result = await Promise.allSettled([insert(a, email, left), insert(b, email.toUpperCase(), right)]);
      expect(result.filter(row => row.status === "fulfilled")).toHaveLength(count);
      expect(await client.user.count({ where: { OR: [{ emailAdminKey: email }, { emailFacultyKey: email }] } })).toBe(count);
    } finally { await a.end(); await b.end(); }
  });
  it("creates same-email Faculty/Admin through accepted provisioning in both directions, with bounded duplicate conflicts", async () => {
    const a = await adminService().create("full", input(" Provision.Pair@Gmail.COM "));
    const f = await facultyService().createPanelist({ email: "provision.pair@gmail.com", firstName: "S", lastName: "F", capabilityKeys: ["essay.evaluate"] }, "full");
    expect(a.account.id).not.toBe(f.account.userId); expect(a.temporaryPassword).not.toBe(f.temporaryPassword);
    await expect(adminService().create("full", input("PROVISION.PAIR@gmail.com"))).rejects.toMatchObject({ statusCode: 409 });
    await expect(facultyService().createPanelist({ email: "provision.pair@gmail.com", firstName: "S", lastName: "F", capabilityKeys: [] }, "full")).rejects.toMatchObject({ statusCode: 409 });
    // Faculty input is a strict allowlist; only its accepted fields are used.
    const reversedFaculty = await facultyService().createPanelist({ email: "reversed@gmail.com", firstName: "S", lastName: "F" }, "full");
    const reversedAdmin = await adminService().create("full", input("reversed@gmail.com"));
    expect(reversedFaculty.account.userId).not.toBe(reversedAdmin.account.id);
    const log = await client.auditLog.findMany({ where: { targetId: { in: [a.account.id, f.account.userId] } } });
    expect(log.length).toBeGreaterThan(0); expect(log.every(row => row.actorId === "full")).toBe(true);
  });
  it.each(["APPLICANT", "STUDENT"] as const)("provisioning cannot pair Faculty/Admin with an existing %s", async role => {
    const email = `${randomUUID()}@gmail.com`; await insert(db, email, role);
    await expect(adminService().create("full", input(email))).rejects.toMatchObject({ statusCode: 409 });
    await expect(facultyService().createPanelist({ email, firstName: "S", lastName: "F" }, "full")).rejects.toMatchObject({ statusCode: 409 });
  });
  it("authenticates each same-email account against its own password, selected role and User ID", async () => {
    for (const [id, role, hash] of [["shared-admin", "ADMIN", adminHash], ["shared-faculty", "FACULTY", academicHash]] as const)
      await client.user.create({ data: { id, email: "person@gmail.com", role, passwordHash: hash, firstName: "Same", lastName: role } });
    await client.panelist.create({ data: { userId: "shared-faculty", isAvailableAsAdviser: false } });
    await client.administratorAccess.create({ data: { userId: "shared-admin", level: "RESTRICTED", createdById: "full", updatedById: "full" } });
    await client.accountCapabilityGrant.create({ data: { userId: "shared-faculty", capabilityKey: "essay.evaluate", createdById: "full", updatedById: "full" } });
    for (const [role, selectedPassword, id] of [["admin", adminPassword, "shared-admin"], ["faculty", password, "shared-faculty"]]) {
      const result = await new AuthService().login({ role, email: " PERSON@gmail.COM ", password: selectedPassword });
      expect(result.user.id).toBe(id); expect((jwt.verify(result.token, secret) as jwt.JwtPayload).userId).toBe(id);
    }
    for (const [role, selectedPassword] of [["admin", password], ["faculty", adminPassword], ["admin", "wrong"]]) {
      await expect(new AuthService().login({ role, email: "person@gmail.com", password: selectedPassword })).rejects.toMatchObject({ statusCode: 401, message: "Invalid login credentials!" });
    }
    await expect(new AuthService().login({ role: "admin", email: "person+tag@gmail.com", password })).rejects.toMatchObject({ statusCode: 401, message: "Invalid login credentials!" });
  });
  it("Faculty email editing preserves its own ID/credentials and permits only the approved Admin pairing", async () => {
    const f = await facultyService().createPanelist({ email: "edit-faculty@gmail.com", firstName: "S", lastName: "F" }, "full");
    const original = await client.user.findUniqueOrThrow({ where: { id: f.account.userId }, select: { id: true, passwordHash: true } });
    await adminService().create("full", input("edit-target@gmail.com"));
    const updated = await facultyService().updatePanelist(f.account.id, { email: " Edit-Target@Gmail.COM " }, "full");
    expect(updated.userId).toBe(original.id); expect(updated.user.email).toBe("edit-target@gmail.com");
    expect(await client.user.findUniqueOrThrow({ where: { id: original.id }, select: { id: true, passwordHash: true } })).toEqual(original);
    await expect(facultyService().updatePanelist(f.account.id, { email: "person@gmail.com" }, "full")).rejects.toMatchObject({ statusCode: 409 });
  });
  it("concurrent email updates cannot create duplicate Faculty identities", async () => {
    await insert(db, "update-a@gmail.com", "FACULTY", "update-a"); await insert(db, "update-b@gmail.com", "PANELIST", "update-b");
    const a = await connect(), b = await connect();
    try {
      const result = await Promise.allSettled([a.execute("UPDATE users SET email='update-shared@gmail.com' WHERE user_id='update-a'"), b.execute("UPDATE users SET email='UPDATE-SHARED@gmail.com' WHERE user_id='update-b'")]);
      expect(result.filter(row => row.status === "fulfilled")).toHaveLength(1);
      expect(await client.user.count({ where: { emailFacultyKey: "update-shared@gmail.com" } })).toBe(1);
    } finally { await a.end(); await b.end(); }
  });
  it("retains legacy PANELIST login as the Faculty slot and rejects duplicate FACULTY identities", async () => {
    await client.user.create({ data: { id: "legacy", email: "legacy@gmail.com", role: "PANELIST", passwordHash: academicHash, firstName: "S", lastName: "Legacy" } });
    await client.panelist.create({ data: { userId: "legacy", isAvailableAsAdviser: false } });
    await insert(db, "legacy@gmail.com", "ADMIN");
    for (const role of ["faculty", "panelist"]) expect((await new AuthService().login({ role, email: "legacy@gmail.com", password })).user.id).toBe("legacy");
    await expect(insert(db, "legacy@gmail.com", "FACULTY")).rejects.toMatchObject({ code: "ER_DUP_ENTRY" });
  });
  it("current-account HTTP reads ignore forged email/role claims and preserve distinct capability/audit identities", async () => {
    for (const [id, forgedRole, expectedRole] of [["shared-faculty", "ADMIN", "FACULTY"], ["shared-admin", "FACULTY", "ADMIN"]]) {
      const token = jwt.sign({ userId: id, role: forgedRole, email: "full@gmail.com", mustChangePassword: false }, secret);
      const response = await request("me", token); expect(response.status).toBe(200);
      const body = await response.json(); expect(body.user.id).toBe(id); expect(body.user.role).toBe(expectedRole);
      expect(body.configuredAccess.administratorLevel).toBe(id === "shared-admin" ? "RESTRICTED" : null);
      expect(body.configuredAccess.capabilities).toEqual(id === "shared-admin" ? [] : ["essay.evaluate"]);
    }
  });
  it("authenticated password changes cannot select the other same-email account via body/email", async () => {
    const original = await client.user.findUniqueOrThrow({ where: { id: "shared-admin" }, select: { passwordHash: true } });
    const token = jwt.sign({ userId: "shared-faculty", role: "ADMIN" }, secret);
    const response = await request("change-password", token, { userId: "shared-admin", email: "person@gmail.com", role: "admin", newPassword: "Changed-Faculty-Only-17A" });
    expect(response.status).toBe(200);
    const faculty = await client.user.findUniqueOrThrow({ where: { id: "shared-faculty" } });
    expect(await bcrypt.compare("Changed-Faculty-Only-17A", faculty.passwordHash)).toBe(true);
    expect(await client.user.findUniqueOrThrow({ where: { id: "shared-admin" }, select: { passwordHash: true } })).toEqual(original);
    expect((jwt.verify((await response.json()).token, secret) as jwt.JwtPayload).userId).toBe("shared-faculty");
  });
  it("preserves Applicant ID, Student Number and same-record promotion with the existing password", async () => {
    const auth = new AuthService();
    expect((await auth.login({ role: "applicant", applicantId: "APP-promote", password })).user.id).toBe("promote");
    expect((await auth.login({ role: "student", studentNumber: "SN-17A", password })).user.id).toBe("student");
    await client.user.update({ where: { id: "promote" }, data: { role: "STUDENT" } });
    expect((await auth.login({ role: "student", studentNumber: "PROMOTED-17A", password })).user.id).toBe("promote");
    expect((await client.user.findUniqueOrThrow({ where: { id: "promote" } })).passwordHash).toBe(academicHash);
    await expect(auth.login({ role: "applicant", applicantId: "APP-promote", password })).rejects.toMatchObject({ statusCode: 403 });
  });
  it("public registration remains exclusive and cannot join an existing Faculty/Admin email", async () => {
    const auth = new AuthService();
    const data = { email: " Person@Gmail.COM ", password, applicantId: "NEW-17A", firstName: "S", lastName: "New", cellphone: "09000000000", dateOfBirth: "2000-01-01", programId: "program", programType: "Masters", undergraduateProgramId: "undergrad" };
    await expect(auth.register(data)).rejects.toMatchObject({ statusCode: 409 });
    const registered = await auth.register({ ...data, email: " Brand.New@Gmail.COM " });
    expect(registered.role).toBe("APPLICANT"); expect(registered.email).toBe("brand.new@gmail.com");
    await expect(adminService().create("full", input("brand.new@gmail.com"))).rejects.toMatchObject({ statusCode: 409 });
  });
  it("concurrent public registration returns one success and one bounded 409 without duplicate Applicants", async () => {
    const data = { email: "registration-race@gmail.com", password, firstName: "S", lastName: "Race", cellphone: "09000000000", dateOfBirth: "2000-01-01", programId: "program", programType: "Masters", undergraduateProgramId: "undergrad" };
    const result = await Promise.allSettled([new AuthService().register({ ...data, applicantId: "RACE-A" }), new AuthService().register({ ...data, applicantId: "RACE-B" })]);
    expect(result.filter(row => row.status === "fulfilled")).toHaveLength(1);
    const rejected = result.find(row => row.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason).toMatchObject({ statusCode: 409 });
    expect(await client.user.count({ where: { emailAdminKey: data.email } })).toBe(1);
  });
  it("matches the target Prisma schema and role-scoped reseeding preserves a promoted Applicant identity", async () => {
    for (const name of [clean, populated]) execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "diff", "--from-config-datasource", "--to-schema", "prisma/schema.prisma", "--exit-code", "--config", config(name)], { encoding: "utf8", stdio: "pipe", timeout: 60_000 });
    const seed = () => execFileSync(process.execPath, ["node_modules/ts-node/dist/bin.js", "--transpile-only", "prisma/seed.ts"], { env: { ...process.env, DATABASE_URL: urlFor(clean) }, encoding: "utf8", stdio: "pipe", timeout: 120_000 });
    seed();
    const seeded = new PrismaClient({ adapter: new PrismaMariaDb(urlFor(clean).replace("mysql://", "mariadb://")) });
    try {
      const applicant = await seeded.user.findUniqueOrThrow({ where: accountEmailWhere("applicant1@earist.edu.ph", "APPLICANT"), select: { id: true, passwordHash: true } });
      await seeded.user.update({ where: { id: applicant.id }, data: { role: "STUDENT" } });
      seed();
      expect(await seeded.user.findUniqueOrThrow({ where: { id: applicant.id }, select: { id: true, passwordHash: true, role: true } })).toEqual({ ...applicant, role: "STUDENT" });
    } finally { await seeded.$disconnect(); }
  }, 180_000);
  it("records sanitized execution and preservation evidence", async () => {
    const after = await snapshot(), [version] = await db.query("SELECT VERSION() AS version");
    const evidence = { source, sourceWorktree: execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim() ? "DIRTY" : "CLEAN", version, migration,
      migrationSha256: createHash("sha256").update(readFileSync(`prisma/migrations/${migration}/migration.sql`)).digest("hex"), preservedPreexistingDataSha256: preservedHash,
      migrationCount: after.tables._prisma_migrations.length, tableCount: Object.keys(after.tables).length, newTriggers: after.schemaEvidence!.triggers.map(row => row.TRIGGER_NAME) };
    writeFileSync(".tmp/faculty17a-evidence.json", JSON.stringify(evidence, null, 2) + "\n");
    console.log("FACULTY-17A synthetic evidence", JSON.stringify(evidence));
  });
});
