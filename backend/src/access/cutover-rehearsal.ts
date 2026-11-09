import { createHash } from "node:crypto";
import { resolveConfiguredAccountAccess } from "./account-access";
import { validateDirectCapabilityKeys } from "./capability-catalog";

/** Operator-only, synthetic/disposable rehearsal. Never imported by the application. */
export type Row = Record<string, string | number | null>;
export interface Snapshot {
  version: 1;
  schema: string;
  sourceCommit: string;
  schemaDigest: string;
  schemaEvidence?: { columns: Row[]; keys: Row[]; definitions: Row[][]; triggers: Row[] };
  tables: Record<string, Row[]>;
}
export interface Mapping {
  userId: string;
  disposition: "APPROVED" | "BLOCKED";
  decision: string;
  target?: {
    role: "ADMIN" | "FACULTY";
    level: "FULL" | "RESTRICTED" | null;
    capabilities: string[];
    normalizeExternalAvailability: boolean;
  };
}
export interface Manifest {
  version: 1;
  mode: "ISOLATED_REHEARSAL";
  baselineDigest: string;
  sourceCommit: string;
  actorUserId: string;
  approvalReference: string;
  approvedAt: string;
  mappings: Mapping[];
}
export interface Finding { code: string; userIds: string[]; recordIds: string[] }

export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
    .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  return JSON.stringify(value);
}
export function digest(value: unknown): string { return createHash("sha256").update(canonical(value)).digest("hex"); }
export function sortedSnapshot(state: Snapshot): Snapshot {
  return { ...state, tables: Object.fromEntries(Object.entries(state.tables).sort(([a], [b]) => a.localeCompare(b))
    .map(([table, rows]) => [table, [...rows].sort((a, b) => canonical(a).localeCompare(canonical(b)))])) };
}
export function snapshotDigest(state: Snapshot): string { return digest(sortedSnapshot(state)); }
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
function requireValue(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
function exactKeys(value: object, allowed: string[]) {
  requireValue(Object.keys(value).every(key => allowed.includes(key)), "Unknown manifest field.");
}
function text(value: unknown): value is string { return typeof value === "string" && value.trim().length > 0; }
function account(state: Snapshot, id: string): Row {
  const matches = state.tables.users.filter(row => row.user_id === id);
  requireValue(matches.length === 1, "Account identity is missing or duplicated."); return matches[0];
}
function profile(state: Snapshot, id: string): Row | undefined { return state.tables.panelists.find(row => row.user_id === id); }
function access(state: Snapshot, id: string) {
  const user = account(state, id), panel = profile(state, id);
  const admin = state.tables.administrator_access.find(row => row.user_id === id);
  return resolveConfiguredAccountAccess({ id, role: String(user.role), isActive: user.is_active === 1,
    panelist: panel ? { isActive: panel.is_active === 1 } : null,
    administratorAccess: admin ? { level: String(admin.level) } : null,
    capabilityGrants: state.tables.account_capability_grants.filter(row => row.user_id === id).map(row => ({ capabilityKey: String(row.capability_key) })) });
}

/** Target-schema inventory only; no retired-role or legacy-key translation exists. */
export function inventory(state: Snapshot) {
  const findings: Finding[] = [];
  const add = (code: string, userIds: string[], recordIds: string[] = []) => findings.push({ code, userIds, recordIds });
  const users = state.tables.users;
  requireValue(users && state.tables.panelists && state.tables.audit_logs && state.tables.administrator_access &&
    state.tables.account_capability_grants && state.tables._prisma_migrations, "Incomplete snapshot.");
  for (const user of users) {
    const id = String(user.user_id), panels = state.tables.panelists.filter(row => row.user_id === id), p = panels[0];
    const academic = ["PANELIST", "FACULTY"].includes(String(user.role));
    if (panels.length > 1 || (academic && panels.length !== 1) || (!academic && panels.length)) add("PROFILE_IDENTITY_MISMATCH", [id]);
    if (p && p.is_active !== user.is_active) add("PROFILE_ACTIVITY_MISMATCH", [id]);
    if (p?.is_external === 1 && p.is_available_as_adviser !== 0) add("EXTERNAL_AVAILABILITY", [id]);
    const active = (state.tables.adviser_assignments ?? []).filter(row => row.adviser_id === id && row.is_active === 1);
    if (p?.is_external === 1 && active.length) add("DR-7_EXTERNAL_ADVISER", [id], active.map(row => String(row.assignment_id)));
    const pending = (state.tables.adviser_requests ?? []).filter(row => row.requested_adviser_id === id && row.dean_status === "PENDING");
    if (pending.length && (!academic || !p || p.is_external !== 0 || p.is_available_as_adviser !== 1 || p.is_active !== 1 || user.is_active !== 1)) {
      add("DR-6_PENDING_INELIGIBLE", [id], pending.map(row => String(row.adviser_req_id)));
    }
    if (user.role === "ADMIN") {
      const history = [...(state.tables.adviser_assignments ?? []).filter(row => row.adviser_id === id),
        ...(state.tables.panel_assignments ?? []).filter(row => row.user_id === id)];
      if (history.length) add("DR-4_ACADEMIC_HISTORY", [id]);
    }
    if (!["ADMIN", "APPLICANT", "STUDENT", "PANELIST", "FACULTY"].includes(String(user.role))) {
      add("RETIRED_ACCOUNT_ROLE", [id]);
    }
  }
  const advisers = state.tables.adviser_assignments ?? [];
  for (const student of new Set(advisers.filter(row => row.is_active === 1).map(row => row.student_id))) {
    const active = advisers.filter(row => row.student_id === student && row.is_active === 1);
    if (active.length > 1) add("DUPLICATE_ACTIVE_ADVISER", active.map(row => String(row.adviser_id)), active.map(row => String(row.assignment_id)));
  }
  for (const row of state.tables.panel_assignments ?? []) {
    const p = profile(state, String(row.user_id));
    if (p?.is_external === 1 && row.is_active === 1 && row.role !== "PANELIST") add("DR-5_EXTERNAL_COMMITTEE_ROLE", [String(row.user_id)], [String(row.panel_id)]);
  }
  return {
    version: 1, mode: "READ_ONLY", inventoryStatus: "COLLECTED_SYNTHETIC_REHEARSAL", sourceCommit: state.sourceCommit,
    baselineDigest: snapshotDigest(state), schemaDigest: state.schemaDigest, schemaEvidence: state.schemaEvidence,
    accounts: users.map(user => ({ userId: user.user_id, currentRole: user.role, isActive: user.is_active === 1,
      mustChangePassword: user.must_change_password === 1,
      panelist: profile(state, String(user.user_id)) ?? null, configuredAccess: access(state, String(user.user_id)) })),
    authoritativeReferences: Object.fromEntries(Object.entries(state.tables).map(([table, rows]) => [table,
      rows.map(row => Object.fromEntries(Object.entries(row).filter(([column]) => /_id$/.test(column) || ["graded_by", "approved_by", "reviewed_by"].includes(column))))])),
    integrity: { migrationNames: state.tables._prisma_migrations.map(row => row.migration_name),
      tables: Object.entries(state.tables).map(([table, rows]) => ({ table, rowCount: rows.length, identityDigest: digest(sortedSnapshot(state).tables[table]) })), findings },
  };
}

export function validateManifest(baseline: Snapshot, input: unknown): asserts input is Manifest {
  requireValue(input && typeof input === "object", "Manifest must be an object.");
  const m = input as Manifest;
  exactKeys(m, ["version", "mode", "baselineDigest", "sourceCommit", "actorUserId", "approvalReference", "approvedAt", "mappings"]);
  requireValue(m.version === 1 && m.mode === "ISOLATED_REHEARSAL", "Only version 1 isolated rehearsal is supported.");
  requireValue(m.baselineDigest === snapshotDigest(baseline) && m.sourceCommit === baseline.sourceCommit, "Manifest baseline/commit drift.");
  requireValue(text(m.approvalReference) && text(m.actorUserId), "Explicit operator approval and actor are required.");
  requireValue(account(baseline, m.actorUserId).role === "ADMIN" && account(baseline, m.actorUserId).is_active === 1, "Rehearsal operator must be an existing active Admin.");
  requireValue(typeof m.approvedAt === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.000Z$/.test(m.approvedAt) &&
    Number.isFinite(Date.parse(m.approvedAt)) && new Date(m.approvedAt).toISOString() === m.approvedAt, "Approval requires a UTC whole-second timestamp.");
  requireValue(Array.isArray(m.mappings) && m.mappings.length > 0 && m.mappings.length <= 1000, "A bounded explicit mapping list is required.");
  const observed = inventory(baseline), seen = new Set<string>();
  requireValue(!baseline.tables.custom_roles && !baseline.tables.role_feature_access &&
    !baseline.tables.users.some(row => "custom_role_id" in row) &&
    !observed.integrity.findings.some(f => f.code === "RETIRED_ACCOUNT_ROLE"),
    "Retired Custom Roles schema/account requires separate disposition and the FACULTY-17 migration; conversion is unsupported.");
  requireValue(baseline.version === 1 && /^[a-f0-9]{40}$/.test(baseline.sourceCommit), "Invalid baseline version/commit.");
  requireValue(new Set(baseline.tables.users.map(row => row.user_id)).size === baseline.tables.users.length &&
    new Set(baseline.tables.users.map(row => row.email)).size === baseline.tables.users.length, "Duplicate authoritative account identity.");
  for (const mapping of m.mappings) {
    requireValue(mapping && typeof mapping === "object", "Invalid mapping.");
    exactKeys(mapping, ["userId", "disposition", "decision", "target"]);
    requireValue(text(mapping.userId) && !seen.has(mapping.userId) && text(mapping.decision), "Duplicate/missing identity or decision."); seen.add(mapping.userId);
    const user = account(baseline, mapping.userId);
    requireValue(["ADMIN", "PANELIST", "FACULTY"].includes(String(user.role)), "Unrelated identity cannot be converted.");
    requireValue(mapping.disposition === "APPROVED" || mapping.disposition === "BLOCKED", "Unknown disposition.");
    if (mapping.disposition === "BLOCKED") {
      requireValue(mapping.target === undefined && access(baseline, mapping.userId).capabilities.length === 0, "Held-out account must have no configured target capabilities."); continue;
    }
    const target = mapping.target;
    requireValue(target && typeof target === "object", "Approved mapping requires an explicit target.");
    exactKeys(target, ["role", "level", "capabilities", "normalizeExternalAvailability"]);
    requireValue(["ADMIN", "FACULTY"].includes(target.role) && typeof target.normalizeExternalAvailability === "boolean", "Invalid target identity/normalization decision.");
    requireValue((user.role === "ADMIN" && target.role === "ADMIN") || (["PANELIST", "FACULTY"].includes(String(user.role)) && target.role === "FACULTY"), "Account category cannot be merged or switched.");
    requireValue(!baseline.tables.administrator_access.some(row => row.user_id === mapping.userId) &&
      !baseline.tables.account_capability_grants.some(row => row.user_id === mapping.userId), "Existing target configuration requires separate reconciliation; hold it out.");
    const panels = baseline.tables.panelists.filter(row => row.user_id === mapping.userId);
    requireValue(target.role === "FACULTY" ? panels.length === 1 : panels.length === 0, "Approved target requires its existing exact profile category; no profile is invented.");
    requireValue(target.role !== "FACULTY" || [panels[0].is_active, panels[0].is_external, panels[0].is_available_as_adviser].every(value => value === 0 || value === 1), "Faculty classification/eligibility flags must be explicit.");
    requireValue(target.role === "ADMIN" ? ["FULL", "RESTRICTED"].includes(String(target.level)) : target.level === null, "Invalid target level.");
    validateDirectCapabilityKeys(target.role, target.capabilities);
    requireValue(target.level !== "FULL" || target.capabilities.length === 0, "Full uses the enumerated catalog, never copied grants.");
    requireValue(!target.normalizeExternalAvailability || (target.role === "FACULTY" && panels[0]?.is_external === 1 && panels[0].is_available_as_adviser === 1), "Normalization must be explicit External true-to-false only.");
    const blockers = observed.integrity.findings.filter(f => f.userIds.includes(mapping.userId) &&
      !(f.code === "EXTERNAL_AVAILABILITY" && target.normalizeExternalAvailability));
    requireValue(blockers.length === 0, `Unresolved data decision: ${blockers.map(f => f.code).join(", ")}`);
  }
  for (const user of baseline.tables.users.filter(row => ["ADMIN", "PANELIST", "FACULTY"].includes(String(row.role)))) {
    requireValue(seen.has(String(user.user_id)), "Every affected account requires an approved or blocked disposition.");
  }
  const projected = clone(baseline);
  const approved = m.mappings.filter(row => row.disposition === "APPROVED");
  requireValue(approved[0]?.target?.level === "FULL", "The first approved batch must bootstrap Full.");
  const first = account(baseline, approved[0].userId);
  requireValue(first.is_active === 1 && first.must_change_password === 0, "First Full bootstrap must be active and credential-ready before any other batch.");
  for (const mapping of approved) change(projected, baseline, m, mapping, false);
  requireValue(projected.tables.users.some(user => user.role === "ADMIN" && user.is_active === 1 &&
    user.must_change_password === 0 && access(projected, String(user.user_id)).administratorLevel === "FULL"), "At least one approved, active, credential-ready Full Administrator is required.");
}

function sqlTime(iso: string) { return iso.replace("T", " ").replace(".000Z", ""); }
function change(state: Snapshot, baseline: Snapshot, manifest: Manifest, mapping: Mapping, restore: boolean) {
  const target = mapping.target!, id = mapping.userId;
  account(state, id).role = restore ? account(baseline, id).role : target.role;
  if (target.normalizeExternalAvailability) profile(state, id)!.is_available_as_adviser = restore ? profile(baseline, id)!.is_available_as_adviser : 0;
  const stamp = { created_by_id: manifest.actorUserId, updated_by_id: manifest.actorUserId,
    created_at: sqlTime(manifest.approvedAt), updated_at: sqlTime(manifest.approvedAt) };
  if (restore) {
    state.tables.administrator_access = state.tables.administrator_access.filter(row => row.user_id !== id);
    state.tables.account_capability_grants = state.tables.account_capability_grants.filter(row => row.user_id !== id);
  } else {
    if (target.role === "ADMIN") state.tables.administrator_access.push({ user_id: id, level: target.level, ...stamp });
    for (const key of target.capabilities) state.tables.account_capability_grants.push({
      grant_id: digest([digest(manifest), id, key]).slice(0, 36), user_id: id, capability_key: key, ...stamp });
  }
}
export interface Progress { applied: number; restored: number; journal: Row[]; expected: Snapshot }
function journalRow(manifest: Manifest, index: number, mapping: Mapping, restore: boolean, before: Snapshot, after: Snapshot): Row {
  return { log_id: digest([digest(manifest), index]).slice(0, 36), actor_id: manifest.actorUserId,
    action_type: restore ? "ACCOUNT_CAPABILITY_CUTOVER_RESTORED" : "ACCOUNT_CAPABILITY_CUTOVER_REHEARSED",
    target_table: "users", target_id: mapping.userId, old_value: snapshotDigest(before), new_value: snapshotDigest(after),
    description: canonical({ manifestDigest: digest(manifest), index, restore }), ip_address: null, created_at: sqlTime(manifest.approvedAt) };
}

/** The durable journal is committed with each account change; no checkpoint file can get ahead of the DB. */
export function reconcile(baseline: Snapshot, manifest: Manifest, current: Snapshot): Progress {
  validateManifest(baseline, manifest);
  const originalLogs = new Set(baseline.tables.audit_logs.map(row => row.log_id));
  const extra = current.tables.audit_logs.filter(row => !originalLogs.has(row.log_id));
  const ordered = extra.map(row => {
    let description;
    try { description = JSON.parse(String(row.description)); } catch { throw new Error("Unrecognized journal/state drift."); }
    requireValue(description.manifestDigest === digest(manifest) && Number.isInteger(description.index), "Changed manifest or unrelated audit/state drift.");
    return { row, ...description };
  }).sort((a, b) => a.index - b.index);
  const expected = clone(baseline), approved = manifest.mappings.filter(row => row.disposition === "APPROVED");
  let applied = 0, restored = 0;
  for (const [index, event] of ordered.entries()) {
    requireValue(event.index === index && typeof event.restore === "boolean", "Interrupted/tampered journal.");
    requireValue(event.restore ? restored < applied : restored === 0 && applied < approved.length, "Invalid journal order.");
    const mapping = approved[event.restore ? applied - restored - 1 : applied];
    const before = clone(expected); change(expected, baseline, manifest, mapping, event.restore);
    const wanted = journalRow(manifest, index, mapping, event.restore, before, expected);
    requireValue(canonical(wanted) === canonical(event.row), "Journal integrity drift.");
    expected.tables.audit_logs.push(wanted);
    if (event.restore) restored++; else applied++;
  }
  requireValue(snapshotDigest(current) === snapshotDigest(expected), "State drift: credentials, identity, relationships, history, schema or access changed.");
  return { applied, restored, journal: ordered.map(event => event.row), expected };
}

export function nextBatch(baseline: Snapshot, manifest: Manifest, current: Snapshot, restore = false) {
  const progress = reconcile(baseline, manifest, current), approved = manifest.mappings.filter(row => row.disposition === "APPROVED");
  requireValue(restore || progress.restored === 0, "Restoration has begun; a new reviewed baseline/manifest is required.");
  if (restore ? progress.applied === progress.restored : progress.applied === approved.length) return { ...progress, next: null };
  const mapping = approved[restore ? progress.applied - progress.restored - 1 : progress.applied];
  const next = clone(current); change(next, baseline, manifest, mapping, restore);
  next.tables.audit_logs.push(journalRow(manifest, progress.journal.length, mapping, restore, current, next));
  return { ...progress, next };
}

/** Public evidence is hashes/counts/IDs only; never full snapshots, credentials or signed bytes. */
export function integrityEvidence(baseline: Snapshot, current: Snapshot) {
  return { beforeDigest: snapshotDigest(baseline), afterDigest: snapshotDigest(current),
    tables: Object.keys(baseline.tables).sort().map(table => ({ table,
      beforeCount: baseline.tables[table].length, afterCount: current.tables[table].length,
      beforeDigest: digest(sortedSnapshot(baseline).tables[table]), afterDigest: digest(sortedSnapshot(current).tables[table]) })) };
}
