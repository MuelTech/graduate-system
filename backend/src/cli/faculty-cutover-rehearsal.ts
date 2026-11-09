import "dotenv/config";
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { captureSnapshot, connectRehearsal, runDatabaseBatch } from "../access/cutover-rehearsal.database";
import { inventory, integrityEvidence, nextBatch, reconcile, validateManifest, type Manifest, type Snapshot } from "../access/cutover-rehearsal";

async function main() {
  const args = process.argv.slice(2), accepted = ["--capture", "--baseline", "--manifest", "--evidence", "--schema", "--dry-run", "--apply", "--restore", "--max-batches"];
  if (args.includes("--help")) {
    console.log("FACULTY-16 isolated rehearsal only. Set FACULTY_16_DB_SERVER_URL (separate local port) and DATABASE_URL (comparison only).\nCapture: --schema faculty16_test_<uuid32> --capture <protected-new-baseline.json> --evidence <new-inventory.json>\nReconcile: --schema ... --baseline <baseline.json> --manifest <approved.json> --evidence <new-report.json> [--dry-run | --apply | --restore] [--max-batches 1..1000]\nDefault: dry-run. Never use application/staging/production data. See docs/runbooks/faculty-16-cutover-rehearsal.md."); return;
  }
  const values = new Map<string, string>(), flags = new Set<string>();
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!accepted.includes(arg) || values.has(arg) || flags.has(arg)) throw new Error("Unknown or duplicate option.");
    if (["--dry-run", "--apply", "--restore"].includes(arg)) flags.add(arg);
    else { if (!args[i + 1] || args[i + 1].startsWith("--")) throw new Error("Missing option value."); values.set(arg, args[++i]); }
  }
  if (flags.size > 1 || (values.has("--capture") && (flags.size || values.has("--baseline") || values.has("--manifest")))) throw new Error("Conflicting rehearsal modes.");
  const schema = values.get("--schema"), evidence = values.get("--evidence");
  if (!schema || !evidence || !process.env.FACULTY_16_DB_SERVER_URL || !process.env.DATABASE_URL) throw new Error("Explicit schema, evidence and isolated/application URL comparison are required.");
  // Reserve a new private evidence file before any DB connection/mutation; never overwrite an earlier run.
  writeFileSync(evidence, JSON.stringify({ status: "IN_PROGRESS_OR_INTERRUPTED" }), { flag: "wx", mode: 0o600 });
  const commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const baseline: Snapshot | undefined = values.has("--baseline") ? JSON.parse(readFileSync(values.get("--baseline")!, "utf8")) : undefined;
  const manifest: Manifest | undefined = values.has("--manifest") ? JSON.parse(readFileSync(values.get("--manifest")!, "utf8")) : undefined;
  if (!values.has("--capture") && (!baseline || !manifest)) throw new Error("Baseline and manifest are required.");
  if (baseline && (baseline.schema !== schema || baseline.sourceCommit !== commit)) throw new Error("Source commit/schema drift; recapture/review is required.");
  if (baseline && manifest) validateManifest(baseline, manifest);
  const limit = Number(values.get("--max-batches") ?? 1000);
  if (!Number.isInteger(limit) || limit < 1 || limit > 1000) throw new Error("Invalid batch bound.");
  const db = await connectRehearsal(process.env.FACULTY_16_DB_SERVER_URL, process.env.DATABASE_URL, schema);
  try {
    if (values.has("--capture")) {
      await db.query("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE"); await db.beginTransaction();
      try {
        const snapshot = await captureSnapshot(db, schema, commit, true);
        const report = inventory(snapshot);
        writeFileSync(values.get("--capture")!, JSON.stringify(snapshot), { flag: "wx", mode: 0o600 });
        writeFileSync(evidence, JSON.stringify(report, null, 2), { mode: 0o600 }); await db.rollback();
      } catch (error) { await db.rollback(); throw error; }
    } else {
      const dryRun = !flags.has("--apply") && !flags.has("--restore");
      let changed = 0;
      for (let i = 0; i < limit; i++) {
        const result = await runDatabaseBatch(db, baseline!, manifest!, { dryRun, restore: flags.has("--restore") });
        if (!result.next || dryRun) break; changed++;
      }
      await db.query("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE"); await db.beginTransaction();
      try {
        const after = await captureSnapshot(db, schema, commit, true), progress = reconcile(baseline!, manifest!, after);
        let projected = after, proposedBatches = 0;
        if (dryRun) for (let i = 0; i < limit; i++) {
          const candidate = nextBatch(baseline!, manifest!, projected).next;
          if (!candidate) break; projected = candidate; proposedBatches++;
        }
        writeFileSync(evidence, JSON.stringify({ mode: dryRun ? "DRY_RUN" : flags.has("--restore") ? "RESTORE" : "APPLY_REHEARSAL",
          committedBatches: changed, proposedBatches, applied: progress.applied, restored: progress.restored,
          heldOut: manifest!.mappings.filter(m => m.disposition === "BLOCKED"),
          integrity: integrityEvidence(baseline!, after), projectedIntegrity: dryRun ? integrityEvidence(after, projected) : null,
          inventory: inventory(after) }, null, 2), { mode: 0o600 });
        await db.rollback();
      } catch (error) { await db.rollback(); throw error; }
    }
    console.log("FACULTY-16 rehearsal evidence written. Activation remains disabled.");
  } finally { await db.end(); }
}
if (require.main === module) main().catch(() => { console.error("FACULTY-16 rehearsal rejected or interrupted. Inspect the protected inputs and durable journal; no credentials are logged."); process.exitCode = 1; });
