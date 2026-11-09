import mysql, { type Connection, type RowDataPacket } from "mysql2/promise";
import { digest, nextBatch, snapshotDigest, type Manifest, type Row, type Snapshot } from "./cutover-rehearsal";

const identifier = (value: string) => {
  if (!/^[a-zA-Z0-9_]+$/.test(value)) throw new Error("Unsafe SQL identifier.");
  return `\`${value}\``;
};
/** Server-only explicit URL, loopback and a different port even across loopback aliases. */
export function isolatedRehearsalUrl(server: string, application: string, schema: string): URL {
  const url = new URL(server), app = new URL(application);
  if (url.protocol !== "mysql:" || !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname.toLowerCase()) ||
    !["", "/"].includes(url.pathname) || url.search || url.hash || (url.port || "3306") === (app.port || "3306")) {
    throw new Error("An explicit separate local server-only URL on a different application port is required.");
  }
  if (!/^faculty16_test_[a-f0-9]{32}$/.test(schema)) throw new Error("Only UUID-named FACULTY-16 disposable schemas are permitted.");
  url.pathname = `/${schema}`; return url;
}
export async function connectRehearsal(server: string, application: string, schema: string) {
  const url = isolatedRehearsalUrl(server, application, schema);
  return mysql.createConnection({ host: url.hostname === "[::1]" ? "::1" : url.hostname, port: Number(url.port || "3306"),
    user: decodeURIComponent(url.username), password: decodeURIComponent(url.password), database: schema,
    dateStrings: true, supportBigNumbers: true, bigNumberStrings: true, multipleStatements: false });
}
async function rows(db: Connection, sql: string, values: string[] = []): Promise<Row[]> {
  const [result] = await db.query<RowDataPacket[]>(sql, values);
  return result.map(row => Object.fromEntries(Object.entries(row).map(([key, value]) => {
    if (value !== null && typeof value !== "string" && typeof value !== "number") throw new Error("Unsupported lossless snapshot value.");
    return [key, typeof value === "string" && /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d\.000$/.test(value) ? value.slice(0, -4) : value];
  })));
}
export async function captureSnapshot(db: Connection, schema: string, sourceCommit: string, lock = false): Promise<Snapshot> {
  if (!/^[a-f0-9]{40}$/.test(sourceCommit)) throw new Error("An exact source commit is required.");
  const tables = await rows(db, "SELECT TABLE_NAME AS name, ENGINE AS engine FROM information_schema.TABLES WHERE TABLE_SCHEMA=? ORDER BY TABLE_NAME", [schema]);
  if (tables.length === 0 || tables.some(table => table.engine !== "InnoDB")) throw new Error("Only an existing all-InnoDB rehearsal schema is supported.");
  const columns = await rows(db, "SELECT TABLE_NAME,COLUMN_NAME,COLUMN_TYPE,IS_NULLABLE,COLUMN_DEFAULT,EXTRA FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? ORDER BY TABLE_NAME,ORDINAL_POSITION", [schema]);
  const keys = await rows(db, "SELECT TABLE_NAME,CONSTRAINT_NAME,COLUMN_NAME,ORDINAL_POSITION,REFERENCED_TABLE_NAME,REFERENCED_COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=? ORDER BY TABLE_NAME,CONSTRAINT_NAME,ORDINAL_POSITION", [schema]);
  const triggers = await rows(db, "SELECT TRIGGER_NAME,EVENT_MANIPULATION,EVENT_OBJECT_TABLE,ACTION_STATEMENT,ACTION_TIMING FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=? ORDER BY TRIGGER_NAME", [schema]);
  const definitions = [];
  const data: Record<string, Row[]> = {};
  for (const table of tables) {
    const name = String(table.name);
    definitions.push(await rows(db, `SHOW CREATE TABLE ${identifier(name)}`));
    data[name] = await rows(db, `SELECT * FROM ${identifier(name)}${lock ? " FOR UPDATE" : ""}`);
  }
  // Check every actual FK, including compound keys, without disabling FK checks.
  const groups = new Map<string, Row[]>();
  for (const key of keys.filter(key => key.REFERENCED_TABLE_NAME !== null)) {
    const group = `${key.TABLE_NAME}:${key.CONSTRAINT_NAME}`;
    groups.set(group, [...(groups.get(group) ?? []), key]);
  }
  for (const group of groups.values()) {
    const present = group.map(key => `s.${identifier(String(key.COLUMN_NAME))} IS NOT NULL`).join(" AND ");
    const join = group.map(key => `s.${identifier(String(key.COLUMN_NAME))}=t.${identifier(String(key.REFERENCED_COLUMN_NAME))}`).join(" AND ");
    const orphan = await rows(db, `SELECT COUNT(*) AS n FROM ${identifier(String(group[0].TABLE_NAME))} s WHERE ${present} AND NOT EXISTS (SELECT 1 FROM ${identifier(String(group[0].REFERENCED_TABLE_NAME))} t WHERE ${join})`);
    if (Number(orphan[0].n) !== 0) throw new Error("Dangling authoritative foreign key; rehearsal denied.");
  }
  const schemaEvidence = { columns, keys, definitions, triggers };
  return { version: 1, schema, sourceCommit, schemaDigest: digest(schemaEvidence), schemaEvidence, tables: data };
}

/** Small allowlisted SQL delta only. Full-state comparison before and after proves its boundary. */
async function persistDelta(db: Connection, current: Snapshot, next: Snapshot) {
  for (const row of next.tables.users) {
    const old = current.tables.users.find(old => old.user_id === row.user_id)!;
    if (old.role !== row.role) await db.execute("UPDATE users SET role=? WHERE user_id=? AND role=?", [row.role, row.user_id, old.role]);
  }
  for (const row of next.tables.panelists) {
    const old = current.tables.panelists.find(old => old.panelist_id === row.panelist_id)!;
    if (old.is_available_as_adviser !== row.is_available_as_adviser) await db.execute(
      "UPDATE panelists SET is_available_as_adviser=? WHERE panelist_id=? AND is_available_as_adviser=?",
      [row.is_available_as_adviser, row.panelist_id, old.is_available_as_adviser]);
  }
  for (const [table, key] of [["account_capability_grants", "grant_id"], ["administrator_access", "user_id"], ["audit_logs", "log_id"]]) {
    for (const row of current.tables[table]) if (!next.tables[table].some(other => other[key] === row[key])) {
      if (table === "audit_logs") throw new Error("Audit evidence cannot be removed.");
      await db.execute(`DELETE FROM ${identifier(table)} WHERE ${identifier(key)}=?`, [row[key]]);
    }
    for (const row of next.tables[table]) if (!current.tables[table].some(other => other[key] === row[key])) {
      const columns = Object.keys(row);
      await db.execute(`INSERT INTO ${identifier(table)} (${columns.map(identifier).join(",")}) VALUES (${columns.map(() => "?").join(",")})`, Object.values(row));
    }
  }
}
export async function runDatabaseBatch(db: Connection, baseline: Snapshot, manifest: Manifest, options: { restore?: boolean; dryRun?: boolean } = {}) {
  await db.query("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE");
  await db.beginTransaction();
  try {
    // Offline maintenance only: all rows/ranges are locked, not just the access population.
    const current = await captureSnapshot(db, baseline.schema, baseline.sourceCommit, true);
    const result = nextBatch(baseline, manifest, current, options.restore);
    if (result.next && !options.dryRun) {
      await persistDelta(db, current, result.next);
      const after = await captureSnapshot(db, baseline.schema, baseline.sourceCommit, true);
      if (snapshotDigest(after) !== snapshotDigest(result.next)) throw new Error("Post-write integrity mismatch; entire batch rolled back.");
    }
    if (options.dryRun) await db.rollback(); else await db.commit();
    return result;
  } catch (error) { await db.rollback(); throw error; }
}
