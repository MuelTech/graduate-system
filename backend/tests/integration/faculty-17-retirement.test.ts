// Opt-in synthetic fixtures on a NEW local data directory and separate port only.
// DATABASE_URL is parsed for isolation; it is never connected to by this harness.
import "dotenv/config";
import { randomUUID, createHash } from "node:crypto";
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import mysql, { type Connection } from "mysql2/promise";
import { PrismaClient, PanelRole } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { isolatedAdministratorDatabaseServer } from "../helpers/isolated-administrator-database";
import { captureSnapshot } from "../../src/access/cutover-rehearsal.database";
import { digest, type Snapshot } from "../../src/access/cutover-rehearsal";
import { renderAdviserRequest } from "../../src/documents/official-defense/adviser-request/adviser-request.renderer";

const migration = "20261110000000_retire_custom_roles";
const enabled = process.env.FACULTY_17_DB_TEST === "1" && Boolean(process.env.FACULTY_17_DB_SERVER_URL);
describe.skipIf(!enabled)("FACULTY-17 isolated MariaDB retirement", () => {
  const clean = `faculty17_test_${randomUUID().replaceAll("-", "")}`;
  const populated = `faculty17_test_${randomUUID().replaceAll("-", "")}`;
  const created: string[] = [];
  let db: Connection, client: PrismaClient, folder: string, server: URL;
  let before: Snapshot, after: Snapshot, signedPdfHash: string;
  const source = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const safe = (name: string) => {
    if (!/^faculty17_test_[a-f0-9]{32}$/.test(name)) throw new Error("Unsafe disposable schema.");
    return `\`${name}\``;
  };
  const urlFor = (name: string) => { safe(name); const url = new URL(server); url.pathname = `/${name}`; return url.toString(); };
  function config(name: string, migrations = path.resolve("prisma/migrations")) {
    const file = path.join(folder, `${name}.config.ts`);
    writeFileSync(file, `export default ${JSON.stringify({ schema: path.resolve("prisma/schema.prisma"), migrations: { path: migrations }, datasource: { url: urlFor(name) } })}`);
    return file;
  }
  const deploy = (file: string) => execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy", "--config", file],
    { encoding: "utf8", stdio: "pipe", timeout: 60_000 });
  async function create(name: string) {
    await db.query(`CREATE DATABASE ${safe(name)} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    created.push(name);
  }
  async function snapshot() { return captureSnapshot(db, populated, source); }
  function preserved(state: Snapshot) {
    return Object.fromEntries(Object.entries(state.tables)
      .filter(([name]) => !["_prisma_migrations", "custom_roles", "role_feature_access"].includes(name))
      .map(([name, rows]) => [name, name === "users" ? rows.map(({ custom_role_id, email_admin_key, email_faculty_key, ...row }) => row) : rows]));
  }
  async function rawMigration() {
    const sql = readFileSync(`prisma/migrations/${migration}/migration.sql`, "utf8").replace(/--[^\n]*/g, "");
    try { for (const statement of sql.split(";").filter(part => part.trim())) await db.query(statement); }
    finally {
      await db.query("DROP TEMPORARY TABLE IF EXISTS `_faculty17_custom_users_require_separate_cleanup`");
      await db.query("DROP TEMPORARY TABLE IF EXISTS `_faculty17_unexpected_legacy_dependency`");
    }
  }
  async function pdf(state: Snapshot) {
    const record = JSON.parse(String(state.tables.adviser_request_official_records[0].snapshot));
    const bytes = await renderAdviserRequest({ ...record.renderInput, logos: {
      earist: { mimeType: "image/jpeg", bytes: new Uint8Array(readFileSync("assets/official-forms/earist-logo.jpg")) },
      graduateSchool: { mimeType: "image/jpeg", bytes: new Uint8Array(readFileSync("assets/official-forms/graduate-school-logo.jpg")) },
    } });
    return createHash("sha256").update(bytes).digest("hex");
  }
  beforeAll(async () => {
    server = isolatedAdministratorDatabaseServer(process.env.FACULTY_17_DB_SERVER_URL!, process.env.DATABASE_URL!);
    if (server.search || server.hash) throw new Error("Server-only URL required.");
    db = await mysql.createConnection({ host: server.hostname, port: Number(server.port), user: decodeURIComponent(server.username),
      password: decodeURIComponent(server.password), dateStrings: true, supportBigNumbers: true, bigNumberStrings: true });
    mkdirSync(path.resolve(".tmp"), { recursive: true }); folder = mkdtempSync(path.resolve(".tmp/faculty17-"));
    await create(clean); await create(populated);
    const prefix = path.join(folder, "migrations");
    for (const name of readdirSync("prisma/migrations").filter(name => name < migration || name === "migration_lock.toml"))
      cpSync(path.resolve("prisma/migrations", name), path.join(prefix, name), { recursive: true });
    deploy(config(populated, prefix));
    await db.query(`USE ${safe(populated)}`);
    client = new PrismaClient({ adapter: new PrismaMariaDb(urlFor(populated).replace("mysql://", "mariadb://")) });
    for (const [id, role] of [["admin", "ADMIN"], ["student", "STUDENT"], ["applicant", "APPLICANT"],
      ["faculty", "FACULTY"], ["chair", "PANELIST"], ["rapporteur", "FACULTY"], ["facilitator", "FACULTY"], ["adviser", "FACULTY"]] as const) {
      await client.user.create({ data: { id, role, email: `${id}@example.invalid`, passwordHash: `synthetic-preserve-${id}`,
        firstName: "Synthetic", lastName: id, mustChangePassword: id === "applicant" }, select: { id: true } });
      if (["FACULTY", "PANELIST"].includes(role)) await client.panelist.create({ data: { id: `profile-${id}`, userId: id, isAvailableAsAdviser: id === "adviser" } });
    }
    await client.administratorAccess.create({ data: { userId: "admin", level: "RESTRICTED", createdById: "admin", updatedById: "admin" } });
    await client.accountCapabilityGrant.create({ data: { userId: "admin", capabilityKey: "students.view", createdById: "admin", updatedById: "admin" } });
    await client.program.create({ data: { id: "program", programName: "Synthetic preservation", programType: "MASTERS" } });
    await client.student.create({ data: { id: "student-row", userId: "student", programId: "program", studentNumber: "SYNTHETIC" } });
    await client.adviserAssignment.create({ data: { id: "assignment", studentId: "student-row", adviserId: "adviser", assignedDate: new Date("2020-01-01"), isActive: true } });
    await client.thesisRecord.create({ data: { id: "thesis", studentId: "student-row", assignmentId: "assignment" } });
    await client.thesisDocument.create({ data: { id: "manuscript", thesisId: "thesis", docType: "PROPOSAL_CHAPTERS", defenseStage: "PROPOSAL", filePath: "synthetic/exact.pdf", checksum: "exact-checksum", uploadedAt: new Date("2020-01-01") } });
    await client.adviserCertification.create({ data: { id: "gs017", thesisId: "thesis", adviserId: "adviser", defenseStage: "PROPOSAL_DEFENSE", reviewedDocumentId: "manuscript", status: "ISSUED", signatureData: "SYNTHETIC-GS017-SIGNATURE", signedAt: new Date("2020-01-01") } });
    await client.defenseSchedule.create({ data: { id: "schedule", thesisId: "thesis", manuscriptDocumentId: "manuscript", defenseDate: new Date("2020-01-01"), defenseTime: new Date("1970-01-01T08:00:00Z"), defenseType: "TITLE_DEFENSE", setById: "admin" } });
    for (const [id, role] of [["chair", "CHAIRMAN"], ["faculty", "PANELIST"], ["adviser", "ADVISER"], ["rapporteur", "RAPPORTEUR"], ["facilitator", "FACILITATOR"]] as const)
      await client.panelAssignment.create({ data: { id: `seat-${id}`, scheduleId: "schedule", userId: id, role } });
    await client.oralExamScore.create({ data: { id: "score", scheduleId: "schedule", panelId: "seat-faculty", scoredAt: new Date("2020-01-01"), overallAverage: "1.25", status: "FINALIZED", signatureData: "SYNTHETIC-CRITERIA-SIGNATURE", officialSnapshot: { exact: "GS-011 historical criteria" } } });
    await client.oralExamSummary.create({ data: { id: "summary", scheduleId: "schedule", overallAverage: "1.25", snapshotData: { exact: "GS-011 historical summary" }, attestedById: "chair" } });
    await client.rapReport.create({ data: { id: "rap", scheduleId: "schedule", thesisId: "thesis", defenseType: "TITLE_DEFENSE", generatedById: "rapporteur", frozenById: "rapporteur", frozenContent: { exact: "signed report" }, frozenContentHash: "exact-rap-hash", contentVersion: 1 } });
    await client.rapReportSignature.create({ data: { rapId: "rap", userId: "faculty", roleAtDefense: "PANELIST", isSigned: true, signatureData: "SYNTHETIC-RAP-SIGNATURE", signedContentHash: "exact-rap-hash", signedContentVersion: 1 } });
    await client.defenseConclusion.create({ data: { scheduleId: "schedule", thesisId: "thesis", outcome: "PASSED", concludedById: "chair", finalRemarks: "Synthetic historical conclusion" } });
    await client.adviserRequest.create({ data: { id: "request", studentId: "student-row", requestedAdviserId: "adviser", requestDate: new Date("2020-01-01"), status: "APPROVED", adviserStatus: "CONFORMED", deanStatus: "APPROVED" } });
    const signed = { exact: "SYNTHETIC signed GS-020", renderInput: { requestDate: "January 1, 2020", requestedAdviserName: "Synthetic Adviser", reason: "Synthetic preservation", studentName: "Synthetic Student", studentNumber: "SYNTHETIC", programName: "Synthetic preservation" } };
    await client.adviserRequestSignedState.create({ data: { requestId: "request", payload: signed, signatureData: "SYNTHETIC-CONFORME", evidenceHash: digest(signed), signedAt: new Date("2020-01-01") } });
    await client.adviserRequestOfficialRecord.create({ data: { requestId: "request", studentUserId: "student", requestedAdviserId: "adviser", snapshot: signed, signatureData: "SYNTHETIC-CONFORME", evidenceHash: digest(signed), finalizedAt: new Date("2020-01-01") } });
    await client.auditLog.create({ data: { actorId: "faculty", actionType: "SYNTHETIC_HISTORY", oldValue: "exact historical attribution" } });
    // Historical SQL fixture only: the generated target client has no obsolete models.
    await db.execute("INSERT INTO custom_roles (role_id,role_name,created_by,updated_at) VALUES ('legacy-role','Synthetic retired role','admin',NOW())");
    await db.execute("INSERT INTO role_feature_access (access_id,role_id,feature_key,can_view,can_edit) VALUES ('feature','legacy-role','unknown.legacy',1,1)");
    await db.execute("UPDATE users SET custom_role_id='legacy-role' WHERE user_id='admin'");
    before = await snapshot(); signedPdfHash = await pdf(before);
  }, 120_000);
  afterAll(async () => {
    try {
      await client?.$disconnect();
      if (db) for (const name of created) await db.query(`DROP DATABASE ${safe(name)}`);
      if (db) {
        const [left] = await db.query("SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME IN (?,?)", [clean, populated]);
        expect(left).toHaveLength(0);
      }
    } finally {
      await db?.end();
      if (folder) {
        const absolute = path.resolve(folder);
        if (path.dirname(absolute) !== path.resolve(".tmp") || !path.basename(absolute).startsWith("faculty17-")) throw new Error("Unsafe fixture cleanup.");
        rmSync(absolute, { recursive: true, force: true });
      }
    }
  }, 60_000);
  it("deploys the entire chain into an empty schema and redeploys as a no-op", () => {
    expect(deploy(config(clean))).toContain(migration);
    expect(deploy(config(clean))).toContain("No pending migrations");
  }, 120_000);
  it.each([0, 1])("refuses remaining CUSTOM users (isActive=%i) before permanent DDL even in non-strict mode", async active => {
    await db.query("SET SESSION sql_mode = ''");
    await db.execute("INSERT INTO users (user_id,email,password_hash,role,first_name,last_name,is_active,updated_at) VALUES ('retired','retired@example.invalid','synthetic','CUSTOM','Synthetic','Retired',?,NOW())", [active]);
    const prior = await snapshot();
    try {
      await expect(rawMigration()).rejects.toMatchObject({ code: "ER_DUP_ENTRY" });
      expect(await snapshot()).toEqual(prior);
    } finally { await db.execute("DELETE FROM users WHERE user_id='retired'"); }
  });
  it("refuses invalid enum sentinel rows instead of coercing their identity", async () => {
    await db.query("SET SESSION sql_mode = ''");
    await db.execute("INSERT INTO users (user_id,email,password_hash,role,first_name,last_name,updated_at) VALUES ('invalid','invalid@example.invalid','synthetic','','Synthetic','Invalid',NOW())");
    const prior = await snapshot();
    try { await expect(rawMigration()).rejects.toMatchObject({ code: "ER_DUP_ENTRY" }); expect(await snapshot()).toEqual(prior); }
    finally { await db.execute("DELETE FROM users WHERE user_id='invalid'"); }
  });
  it("refuses unexpected incoming foreign keys before dropping any structure", async () => {
    await db.query("CREATE TABLE synthetic_dependency (id VARCHAR(191) PRIMARY KEY, role_id VARCHAR(191), FOREIGN KEY (role_id) REFERENCES custom_roles(role_id)) ENGINE=InnoDB");
    const prior = await snapshot();
    try { await expect(rawMigration()).rejects.toMatchObject({ code: "ER_DUP_ENTRY" }); expect(await snapshot()).toEqual(prior); }
    finally { await db.query("DROP TABLE synthetic_dependency"); }
  });
  it("upgrades a populated legacy schema without changing any unrelated row or credential", async () => {
    expect(deploy(config(populated))).toContain(migration); after = await snapshot();
    expect(preserved(after)).toEqual(preserved(before));
    expect(deploy(config(populated))).toContain("No pending migrations");
    expect(after.tables.users).toHaveLength(8);
  }, 90_000);
  it("removes the obsolete tables/column/FKs/enum and retains every Defense role/assignment", async () => {
    expect(after.tables.custom_roles).toBeUndefined(); expect(after.tables.role_feature_access).toBeUndefined();
    expect(after.schemaEvidence!.columns.filter(row => row.COLUMN_NAME === "custom_role_id")).toEqual([]);
    expect(after.schemaEvidence!.keys.filter(row => ["custom_roles", "role_feature_access"].includes(String(row.REFERENCED_TABLE_NAME)))).toEqual([]);
    const role = after.schemaEvidence!.columns.find(row => row.TABLE_NAME === "users" && row.COLUMN_NAME === "role")!;
    expect(String(role.COLUMN_TYPE)).toBe("enum('ADMIN','STUDENT','PANELIST','APPLICANT','FACULTY')");
    expect(Object.values(PanelRole)).toEqual(["CHAIRMAN", "PANELIST", "ADVISER", "RAPPORTEUR", "FACILITATOR"]);
    expect(after.tables.panel_assignments).toEqual(before.tables.panel_assignments);
    expect(after.tables.panel_assignments).toHaveLength(5);
    // captureSnapshot already checks every actual declared FK, including compound keys.
    expect(after.schemaEvidence!.keys.length).toBeGreaterThan(0);
  });
  it("preserves GS-011/017/020, scores, RAP signatures, conclusions and rendered GS-020 hash", async () => {
    for (const name of ["oral_exam_scores", "oral_exam_summary", "adviser_certifications", "adviser_request_signed_states", "adviser_request_official_records", "rap_reports", "rap_report_signatures", "defense_conclusions", "adviser_assignments", "audit_logs"]) {
      expect(before.tables[name]?.length, name).toBeGreaterThan(0); expect(after.tables[name]).toEqual(before.tables[name]);
    }
    expect(await pdf(after)).toBe(signedPdfHash);
    const [version] = await db.query("SELECT VERSION() AS version");
    const evidence = { version, source, sourceWorktree: execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim() ? "DIRTY" : "CLEAN",
      migration, migrationSha256: createHash("sha256").update(readFileSync(`prisma/migrations/${migration}/migration.sql`)).digest("hex"),
      tableCount: Object.keys(after.tables).length, preservedDataSha256: digest(preserved(after)), gs020PdfSha256: signedPdfHash,
      userCount: after.tables.users.length, defenseSeats: after.tables.panel_assignments.length };
    writeFileSync(".tmp/faculty17-evidence.json", JSON.stringify(evidence, null, 2) + "\n");
    console.log("FACULTY-17 synthetic integrity", JSON.stringify(evidence));
  });
  it("rebuilds repository seeds against the generated target client in the disposable clean schema", () => {
    execFileSync(process.execPath, ["node_modules/ts-node/dist/bin.js", "--transpile-only", "prisma/seed.ts"], {
      env: { ...process.env, DATABASE_URL: urlFor(clean) }, encoding: "utf8", stdio: "pipe", timeout: 120_000,
    });
  }, 120_000);
  it("matches the target Prisma schema after the clean chain and populated upgrade", () => {
    for (const name of [clean, populated]) execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "diff",
      "--from-config-datasource", "--to-schema", "prisma/schema.prisma", "--exit-code", "--config", config(name)],
    { encoding: "utf8", stdio: "pipe", timeout: 60_000 });
  }, 120_000);
});
