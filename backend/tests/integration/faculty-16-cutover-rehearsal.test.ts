// Explicit isolated local port only. No application database singleton is imported.
import "dotenv/config";
import { randomUUID, createHash } from "node:crypto";
import { cpSync, mkdirSync, mkdtempSync, readdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import mysql, { type Connection } from "mysql2/promise";
import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { renderAdviserRequest } from "../../src/documents/official-defense/adviser-request/adviser-request.renderer";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { captureSnapshot, connectRehearsal, isolatedRehearsalUrl, runDatabaseBatch } from "../../src/access/cutover-rehearsal.database";
import { digest, integrityEvidence, inventory, reconcile, snapshotDigest, type Snapshot } from "../../src/access/cutover-rehearsal";
import { syntheticCutoverManifest } from "../fixtures/faculty-16";

const enabled = process.env.FACULTY_16_DB_TEST === "1" && Boolean(process.env.FACULTY_16_DB_SERVER_URL);
describe.skipIf(!enabled)("FACULTY-16 isolated real MariaDB migration and cutover rehearsal", () => {
  const schema = `faculty16_test_${randomUUID().replaceAll("-", "")}`;
  const restoreSchema = `faculty16_test_${randomUUID().replaceAll("-", "")}`;
  const cleanSchema = `faculty16_test_${randomUUID().replaceAll("-", "")}`;
  let db: Connection | undefined, prisma: PrismaClient | undefined, folder: string | undefined;
  let baseline: Snapshot, legacy: Snapshot, dump: string, pdfHash: string;
  let manifest: ReturnType<typeof syntheticCutoverManifest>;
  const logos = { earist: { mimeType: "image/jpeg" as const, bytes: new Uint8Array(readFileSync("assets/official-forms/earist-logo.jpg")) },
    graduateSchool: { mimeType: "image/jpeg" as const, bytes: new Uint8Array(readFileSync("assets/official-forms/graduate-school-logo.jpg")) } };
  async function historicalOutput(state: Snapshot) {
    const frozen = JSON.parse(String(state.tables.adviser_request_official_records[0].snapshot));
    return renderAdviserRequest({ ...frozen.renderInput, logos });
  }
  let created = false, restoreCreated = false, cleanCreated = false;
  let source: string, sourceProvenance: unknown;
  const server = process.env.FACULTY_16_DB_SERVER_URL!, application = process.env.DATABASE_URL!;
  const safeSchema = (name: string) => { if (!/^faculty16_test_[a-f0-9]{32}$/.test(name)) throw new Error("Unsafe schema cleanup."); return `\`${name}\``; };
  function deploy() {
    return execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy", "--config", path.join(folder!, "prisma.config.ts")],
      { encoding: "utf8", stdio: "pipe", timeout: 60_000 });
  }
  function mysqlArgs(name: string) {
    const u = isolatedRehearsalUrl(server, application, name);
    return ["--protocol=TCP", `--host=${u.hostname}`, `--port=${u.port}`, `--user=${decodeURIComponent(u.username)}`, `--password=${decodeURIComponent(u.password)}`];
  }
  beforeAll(async () => {
    // Refuse dirty/uncommitted rehearsal evidence before creating any disposable schema or output.
    const reviewed = require("../../scripts/faculty-cutover-rehearsal.cjs").loadReviewedOperator();
    reviewed.assertSource(); sourceProvenance = reviewed.provenance; source = reviewed.provenance.sourceCommit;
    const url = isolatedRehearsalUrl(server, application, schema);
    // Only now connect to the explicitly isolated server, never the application URL.
    db = await mysql.createConnection({ host: url.hostname, port: Number(url.port), user: decodeURIComponent(url.username), password: decodeURIComponent(url.password), dateStrings: true });
    await db.query(`CREATE DATABASE ${safeSchema(schema)} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`); created = true;
    await db.query(`USE ${safeSchema(schema)}`);
    mkdirSync(path.resolve(".tmp"), { recursive: true }); folder = mkdtempSync(path.resolve(".tmp/faculty16-"));
    const migrations = path.join(folder, "migrations"), split = "20261108000000_direct_account_access";
    for (const name of readdirSync("prisma/migrations").filter(name => name < split || name === "migration_lock.toml"))
      cpSync(path.resolve("prisma/migrations", name), path.join(migrations, name), { recursive: true });
    writeFileSync(path.join(folder, "prisma.config.ts"), `export default ${JSON.stringify({ schema: path.resolve("prisma/schema.prisma"), migrations: { path: migrations }, datasource: { url: url.toString() } })}`);
    deploy();
    prisma = new PrismaClient({ adapter: new PrismaMariaDb(url.toString().replace("mysql://", "mariadb://")) }); await prisma.$connect();
    for (const [id, role] of [["operator", "ADMIN"], ["restricted", "ADMIN"], ["faculty", "PANELIST"], ["external", "PANELIST"], ["unresolved", "ADMIN"], ["student", "STUDENT"]] as const) {
      await prisma.user.create({ data: { id, role, email: `${id}@example.invalid`, firstName: "Synthetic", lastName: id, passwordHash: `unusable-synthetic-${id}`, mustChangePassword: false } });
    }
    for (const id of ["faculty", "external"]) await prisma.panelist.create({ data: { id: `profile-${id}`, userId: id, isExternal: id === "external", isAvailableAsAdviser: true } });
    await prisma.program.create({ data: { id: "program", programName: "Synthetic Preservation", programType: "MASTERS" } });
    await prisma.student.create({ data: { id: "student-row", userId: "student", programId: "program" } });
    await prisma.adviserAssignment.create({ data: { id: "adviser", adviserId: "faculty", studentId: "student-row", assignedDate: new Date("2020-01-01"), isActive: true } });
    await prisma.thesisRecord.create({ data: { id: "thesis", studentId: "student-row", assignmentId: "adviser" } });
    await prisma.thesisDocument.create({ data: { id: "manuscript", thesisId: "thesis", docType: "PROPOSAL_CHAPTERS", defenseStage: "PROPOSAL", filePath: "synthetic/exact-version.pdf", uploadedAt: new Date("2020-01-01") } });
    await prisma.adviserCertification.create({ data: { id: "certification", thesisId: "thesis", adviserId: "faculty", defenseStage: "PROPOSAL_DEFENSE", reviewedDocumentId: "manuscript", status: "ISSUED", signatureData: "SYNTHETIC_CERT_SIGNATURE", signedAt: new Date("2020-01-01") } });
    await prisma.defenseSchedule.create({ data: { id: "schedule", thesisId: "thesis", defenseDate: new Date("2020-01-01"), defenseTime: new Date("1970-01-01T08:00:00Z"), venueOrLink: "Synthetic", setById: "operator", defenseType: "TITLE_DEFENSE" } });
    await prisma.panelAssignment.create({ data: { id: "panel", scheduleId: "schedule", userId: "faculty", role: "PANELIST", isActive: false } });
    await prisma.adviserRequest.create({ data: { id: "request", studentId: "student-row", requestedAdviserId: "faculty", requestDate: new Date("2020-01-01"), status: "APPROVED", adviserStatus: "CONFORMED", deanStatus: "APPROVED" } });
    const signed = { version: 1, exactText: "SYNTHETIC signed GS-020", manuscriptId: "exact-historical-version", renderInput: {
      requestDate: "January 1, 2020", requestedAdviserName: "Synthetic Faculty", reason: "synthetic preservation rehearsal",
      studentName: "Synthetic Student", studentNumber: "SYNTHETIC-0001", programName: "Synthetic Preservation" } };
    await prisma.adviserRequestSignedState.create({ data: { requestId: "request", payload: signed, signatureData: "SYNTHETIC_SIGNATURE_BYTES", evidenceHash: digest(signed), signedAt: new Date("2020-01-01") } });
    await prisma.adviserRequestOfficialRecord.create({ data: { requestId: "request", studentUserId: "student", requestedAdviserId: "faculty", snapshot: signed, signatureData: "SYNTHETIC_SIGNATURE_BYTES", evidenceHash: digest(signed), finalizedAt: new Date("2020-01-01") } });
    await prisma.examSlot.create({ data: { id: "exam-slot", programId: "program", examDate: new Date("2020-01-01"), examTime: new Date("1970-01-01T08:00:00Z"), maxSlots: 1 } });
    await prisma.entranceExamApplication.create({ data: { id: "exam-history", studentId: "student-row", programId: "program", slotId: "exam-slot", status: "TAKEN" } });
    await prisma.entranceExamScore.create({ data: { id: "grade-history", applicationId: "exam-history", gradedById: "operator", multipleChoiceScore: "20", essayScore: "22.5", totalScore: "42.5", status: "PASSED", essayEvaluatedAt: new Date("2020-01-01") } });
    await prisma.auditLog.create({ data: { id: "old-audit", actorId: "faculty", actionType: "SYNTHETIC_HISTORICAL", oldValue: "exact immutable attribution" } });
    legacy = await captureSnapshot(db, schema, source);
    const bytes = await historicalOutput(legacy); writeFileSync(path.join(folder, "historical.pdf"), bytes); pdfHash = createHash("sha256").update(bytes).digest("hex");
    cpSync(path.resolve("prisma/migrations"), migrations, { recursive: true }); deploy();
    // Reconnect with the same lossless driver configuration used by the CLI.
    await db.end(); db = await connectRehearsal(server, application, schema);
    baseline = await captureSnapshot(db, schema, source); manifest = syntheticCutoverManifest(baseline);
    const bin = process.env.FACULTY_16_MYSQL_BIN;
    if (!bin || !existsSync(path.join(bin, "mysqldump.exe")) || !existsSync(path.join(bin, "mysql.exe"))) throw new Error("Explicit local MariaDB tools required for actual backup/restore proof.");
    dump = execFileSync(path.join(bin, "mysqldump.exe"), [...mysqlArgs(schema), "--single-transaction", "--skip-comments", "--skip-add-locks", schema], { encoding: "utf8", maxBuffer: 20_000_000 });
    writeFileSync(path.join(folder, "snapshot.sql"), dump, { mode: 0o600 });
  }, 120_000);
  afterAll(async () => {
    try {
      await prisma?.$disconnect();
      if (db && cleanCreated) await db.query(`DROP DATABASE ${safeSchema(cleanSchema)}`);
      if (db && restoreCreated) await db.query(`DROP DATABASE ${safeSchema(restoreSchema)}`);
      if (db && created) await db.query(`DROP DATABASE ${safeSchema(schema)}`);
      if (db) {
        const [left] = await db.query("SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME IN (?,?)", [schema, restoreSchema]);
        expect(left).toHaveLength(0);
      }
    } finally {
      await db?.end();
      if (folder) {
        const absolute = path.resolve(folder);
        if (path.dirname(absolute) !== path.resolve(".tmp") || !path.basename(absolute).startsWith("faculty16-")) throw new Error("Unsafe rehearsal cleanup path.");
        rmSync(absolute, { recursive: true, force: true });
      }
    }
  }, 60_000);
  it("deploys the clean committed chain, upgrades a populated synthetic snapshot and redeploys as no-op", () => {
    // FACULTY-17 contracts only the obsolete structures; all business records survive.
    for (const table of Object.keys(legacy.tables).filter(name => !["_prisma_migrations", "custom_roles", "role_feature_access"].includes(name))) {
      const prior = table === "users" ? legacy.tables[table].map(({ custom_role_id, ...row }) => row) : legacy.tables[table];
      expect(baseline.tables[table]).toEqual(prior);
    }
    expect(baseline.tables.administrator_access).toHaveLength(0); expect(baseline.tables.account_capability_grants).toHaveLength(0);
    expect(deploy()).toContain("No pending migrations");
  });
  it("deploys all committed migrations at once into a completely empty disposable schema", async () => {
    await db!.query(`CREATE DATABASE ${safeSchema(cleanSchema)} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`); cleanCreated = true;
    const configPath = path.join(folder!, "prisma.config.ts"), original = readFileSync(configPath, "utf8");
    const url = isolatedRehearsalUrl(server, application, cleanSchema);
    try {
      writeFileSync(configPath, `export default ${JSON.stringify({ schema: path.resolve("prisma/schema.prisma"), migrations: { path: path.join(folder!, "migrations") }, datasource: { url: url.toString() } })}`);
      deploy(); const clean = await connectRehearsal(server, application, cleanSchema);
      try {
        const snapshot = await captureSnapshot(clean, cleanSchema, source);
        expect(snapshot.tables.users).toHaveLength(0); expect(snapshot.tables.administrator_access).toHaveLength(0);
        expect(snapshot.tables._prisma_migrations).toHaveLength(baseline.tables._prisma_migrations.length);
      } finally { await clean.end(); }
    } finally { writeFileSync(configPath, original); }
  }, 60_000);
  it("dry-runs with no DB changes or journal rows", async () => {
    expect((await runDatabaseBatch(db!, baseline, manifest, { dryRun: true })).next).not.toBeNull();
    expect(snapshotDigest(await captureSnapshot(db!, schema, source))).toBe(snapshotDigest(baseline));
  }, 30_000);
  it("rolls back both access and journal on real audit-write failure", async () => {
    await db!.query("CREATE TRIGGER faculty16_reject_audit BEFORE INSERT ON audit_logs FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='synthetic audit failure'");
    try {
      const guarded = await captureSnapshot(db!, schema, source), approved = syntheticCutoverManifest(guarded);
      await expect(runDatabaseBatch(db!, guarded, approved)).rejects.toThrow(/synthetic audit failure/);
      expect(snapshotDigest(await captureSnapshot(db!, schema, source))).toBe(snapshotDigest(guarded));
    } finally { await db!.query("DROP TRIGGER faculty16_reject_audit"); }
  }, 30_000);
  it("recovers after commit/disconnect and resumes batches; complete repeat is an exact no-op", async () => {
    await runDatabaseBatch(db!, baseline, manifest); await db!.end(); db = await connectRehearsal(server, application, schema);
    expect(reconcile(baseline, manifest, await captureSnapshot(db, schema, source)).applied).toBe(1);
    for (let i = 0; i < 3; i++) await runDatabaseBatch(db, baseline, manifest);
    const complete = await captureSnapshot(db, schema, source);
    expect(createHash("sha256").update(await historicalOutput(complete)).digest("hex")).toBe(pdfHash);
    expect((await runDatabaseBatch(db, baseline, manifest)).next).toBeNull();
    expect(snapshotDigest(await captureSnapshot(db, schema, source))).toBe(snapshotDigest(complete));
    const report = integrityEvidence(baseline, complete);
    for (const table of report.tables.filter(t => !["users", "panelists", "administrator_access", "account_capability_grants", "audit_logs"].includes(t.table))) expect(table.afterDigest).toBe(table.beforeDigest);
    expect(complete.tables.users.map(r => r.user_id).sort()).toEqual(baseline.tables.users.map(r => r.user_id).sort());
    writeFileSync(path.join(folder!, "integrity-evidence.json"), JSON.stringify(report, null, 2));
    console.log("FACULTY-16 real MariaDB integrity", JSON.stringify(report));
  }, 60_000);
  it("rejects real credential drift before resume/restoration and retains all journals", async () => {
    const before = await captureSnapshot(db!, schema, source);
    await db!.execute("UPDATE users SET password_hash='synthetic-drift' WHERE user_id='faculty'");
    try { await expect(runDatabaseBatch(db!, baseline, manifest, { restore: true })).rejects.toThrow(/State drift/); }
    finally { await db!.execute("UPDATE users SET password_hash=? WHERE user_id='faculty'", [baseline.tables.users.find(r => r.user_id === "faculty")!.password_hash]); }
    expect(snapshotDigest(await captureSnapshot(db!, schema, source))).toBe(snapshotDigest(before));
  }, 30_000);
  it("restores in reverse batches across disconnect, keeps audit evidence, and repeats as no-op", async () => {
    await runDatabaseBatch(db!, baseline, manifest, { restore: true }); await db!.end(); db = await connectRehearsal(server, application, schema);
    for (let i = 0; i < 3; i++) await runDatabaseBatch(db, baseline, manifest, { restore: true });
    const restored = await captureSnapshot(db, schema, source);
    expect(reconcile(baseline, manifest, restored).restored).toBe(4);
    const business = { ...restored, tables: { ...restored.tables, audit_logs: baseline.tables.audit_logs } };
    expect(snapshotDigest(business)).toBe(snapshotDigest(baseline));
    expect(restored.tables.audit_logs).toHaveLength(baseline.tables.audit_logs.length + 8);
    expect((await runDatabaseBatch(db, baseline, manifest, { restore: true })).next).toBeNull();
    expect(createHash("sha256").update(readFileSync(path.join(folder!, "historical.pdf"))).digest("hex")).toBe(pdfHash);
    expect(createHash("sha256").update(await historicalOutput(restored)).digest("hex")).toBe(pdfHash);
  }, 60_000);
  it("restores a real SQL backup into another isolated schema and exercises CLI capture/dry-run/apply/resume/restore", async () => {
    await db!.query(`CREATE DATABASE ${safeSchema(restoreSchema)} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`); restoreCreated = true;
    execFileSync(path.join(process.env.FACULTY_16_MYSQL_BIN!, "mysql.exe"), [...mysqlArgs(restoreSchema), restoreSchema], { input: dump, stdio: ["pipe", "pipe", "pipe"], timeout: 60_000 });
    const restored = await connectRehearsal(server, application, restoreSchema);
    try {
      const recovered = await captureSnapshot(restored, restoreSchema, source);
      expect(snapshotDigest({ ...recovered, schema })).toBe(snapshotDigest(baseline));
      expect(createHash("sha256").update(await historicalOutput(recovered)).digest("hex")).toBe(pdfHash);
      const run = (name: string, args: string[]) => execFileSync(process.execPath, ["scripts/faculty-cutover-rehearsal.cjs", "--schema", restoreSchema,
        "--evidence", path.join(folder!, `${name}.json`), ...args], { encoding: "utf8", timeout: 60_000, stdio: "pipe" });
      const baselineFile = path.join(folder!, "baseline.json"), manifestFile = path.join(folder!, "manifest.json");
      run("capture", ["--capture", baselineFile]);
      const captured = JSON.parse(readFileSync(baselineFile, "utf8"));
      expect(captured.sourceCommit).toBe(source);
      expect(JSON.parse(readFileSync(path.join(folder!, "capture.json"), "utf8")).sourceProvenance).toEqual(sourceProvenance);
      writeFileSync(manifestFile, JSON.stringify(syntheticCutoverManifest(captured)));
      const common = ["--baseline", baselineFile, "--manifest", manifestFile];
      run("dry-run", common);
      expect(JSON.parse(readFileSync(path.join(folder!, "dry-run.json"), "utf8"))).toMatchObject({ mode: "DRY_RUN", committedBatches: 0, proposedBatches: 4 });
      run("partial", [...common, "--apply", "--max-batches", "1"]);
      run("resumed", [...common, "--apply"]); run("repeat", [...common, "--apply"]);
      expect(JSON.parse(readFileSync(path.join(folder!, "repeat.json"), "utf8"))).toMatchObject({ committedBatches: 0, applied: 4 });
      run("restored", [...common, "--restore"]); run("restore-repeat", [...common, "--restore"]);
      expect(JSON.parse(readFileSync(path.join(folder!, "restore-repeat.json"), "utf8"))).toMatchObject({ committedBatches: 0, restored: 4 });
      expect(inventory(await captureSnapshot(restored, restoreSchema, source)).accounts.find(a => a.userId === "unresolved")?.configuredAccess.capabilities).toEqual([]);
      const [version] = await restored.query("SELECT VERSION() AS version");
      console.log("FACULTY-16 real MariaDB summary", JSON.stringify({ sourceProvenance, databaseVersion: (version as any[])[0].version, migrationCount: baseline.tables._prisma_migrations.length,
        tableCount: Object.keys(baseline.tables).length, accountCount: baseline.tables.users.length, gs020PdfSha256: pdfHash,
        restoredBusinessDigest: snapshotDigest(baseline), cleanChain: true, populatedUpgrade: true, sqlBackupRestored: true, appliedBatches: 4, restorationBatches: 4, heldOutAdminAccounts: 1 }));
    } finally { await restored.end(); }
  }, 180_000);
});
