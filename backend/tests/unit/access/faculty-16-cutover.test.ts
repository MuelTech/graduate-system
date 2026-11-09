import { describe, expect, it } from "vitest";
import { canonical, integrityEvidence, inventory, nextBatch, reconcile, snapshotDigest, validateManifest, type Manifest, type Snapshot } from "../../../src/access/cutover-rehearsal";
import { isolatedRehearsalUrl } from "../../../src/access/cutover-rehearsal.database";
import { syntheticCutoverManifest, syntheticCutoverSnapshot } from "../../fixtures/faculty-16";
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));
function applyAll(b: Snapshot, m: Manifest, current = b) { for (;;) { const next = nextBatch(b, m, current).next; if (!next) return current; current = next; } }

describe("FACULTY-16 manifest and durable reconciliation", () => {
  it("inventories target accounts without granting or mutating, and reports exact table evidence", () => {
    const b = syntheticCutoverSnapshot(), hash = snapshotDigest(b), report = inventory(b);
    expect(report.integrity.findings.map(f => f.code)).toContain("EXTERNAL_AVAILABILITY");
    expect(report.accounts.find(a => a.userId === "unresolved")?.configuredAccess.capabilities).toEqual([]);
    expect(snapshotDigest(b)).toBe(hash);
    expect(JSON.stringify(report)).not.toContain("unusable-synthetic-hash");
    expect(JSON.stringify(integrityEvidence(b, b))).not.toContain("SYNTHETIC_SIGNATURE_BYTES");
  });
  it("converts in place, preserves every unapproved field/table and repeats as a complete no-op", () => {
    const b = syntheticCutoverSnapshot(), m = syntheticCutoverManifest(b), final = applyAll(b, m);
    expect(reconcile(b, m, final).applied).toBe(4);
    expect(nextBatch(b, m, final).next).toBeNull();
    expect(final.tables.users.find(r => r.user_id === "faculty")?.role).toBe("FACULTY");
    expect(final.tables.users.find(r => r.user_id === "unresolved")).toEqual(b.tables.users.find(r => r.user_id === "unresolved"));
    for (const table of Object.keys(b.tables).filter(t => !["users", "panelists", "audit_logs", "administrator_access", "account_capability_grants"].includes(t))) expect(final.tables[table]).toEqual(b.tables[table]);
    expect(final.tables.users.map(({ role, ...r }) => r)).toEqual(b.tables.users.map(({ role, ...r }) => r));
    expect(final.tables.panelists.map(({ is_available_as_adviser, ...r }) => r)).toEqual(b.tables.panelists.map(({ is_available_as_adviser, ...r }) => r));
  });
  it("resumes from every committed boundary with identical final state", () => {
    const b = syntheticCutoverSnapshot(), m = syntheticCutoverManifest(b), expected = applyAll(b, m);
    let interrupted = b;
    for (let index = 0; index < 4; index++) {
      expect(snapshotDigest(applyAll(b, m, copy(interrupted)))).toBe(snapshotDigest(expected));
      interrupted = nextBatch(b, m, interrupted).next!;
    }
  });
  it.each([0, 1, 2, 3, 4])("restores exact business state from prefix %i, retains both journals and resumes restoration", count => {
    const b = syntheticCutoverSnapshot(), m = syntheticCutoverManifest(b); let current = b;
    for (let i = 0; i < count; i++) current = nextBatch(b, m, current).next!;
    for (let i = 0; i < count; i++) {
      current = nextBatch(b, m, copy(current), true).next!;
      expect(reconcile(b, m, current).restored).toBe(i + 1);
    }
    expect(nextBatch(b, m, current, true).next).toBeNull();
    const withoutLogs = copy(current); withoutLogs.tables.audit_logs = b.tables.audit_logs;
    expect(snapshotDigest(withoutLogs)).toBe(snapshotDigest(b));
    expect(current.tables.audit_logs.length).toBe(b.tables.audit_logs.length + count * 2);
    if (count) expect(() => nextBatch(b, m, current)).toThrow(/Restoration/);
  });
  it.each([
    ["credential", (s: Snapshot) => { s.tables.users[0].password_hash = "drift"; }],
    ["account email", (s: Snapshot) => { s.tables.users[0].email = "drift@example.invalid"; }],
    ["profile ID", (s: Snapshot) => { s.tables.panelists[0].panelist_id = "drift"; }],
    ["historical role", (s: Snapshot) => { s.tables.panel_assignments[0].role = "CHAIRMAN"; }],
    ["signature", (s: Snapshot) => { s.tables.adviser_request_signed_states[0].signature_data = "changed"; }],
    ["hash", (s: Snapshot) => { s.tables.adviser_request_official_records[0].evidence_hash = "changed"; }],
    ["direct grant", (s: Snapshot) => { s.tables.account_capability_grants.push({ user_id: "unresolved", capability_key: "students.view" }); }],
    ["ledger", (s: Snapshot) => { s.tables._prisma_migrations[0].checksum = "changed"; }],
    ["schema", (s: Snapshot) => { s.schemaDigest = "changed"; }],
    ["new account", (s: Snapshot) => { s.tables.users.push({ ...s.tables.users[0], user_id: "new" }); }],
    ["audit", (s: Snapshot) => { s.tables.audit_logs[0].description = "changed"; }],
  ] as const)("rejects %s drift without changing state", (_label, mutate) => {
    const b = syntheticCutoverSnapshot(), m = syntheticCutoverManifest(b), current = nextBatch(b, m, b).next!;
    mutate(current); const before = snapshotDigest(current);
    expect(() => nextBatch(b, m, current)).toThrow(/drift/); expect(snapshotDigest(current)).toBe(before);
  });
  it.each([
    (m: Manifest) => { m.mappings[1].target!.capabilities = ["*"]; },
    (m: Manifest) => { m.mappings[1].target!.capabilities = ["essay.evaluate"]; },
    (m: Manifest) => { m.mappings[1].target!.capabilities = ["administrator_access.manage"]; },
    (m: Manifest) => { m.mappings[1].target!.capabilities = ["students.view", "students.view"]; },
    (m: Manifest) => { m.mappings[0].target!.level = "RESTRICTED"; },
    (m: Manifest) => { m.mappings.pop(); },
    (m: Manifest) => { m.mappings.push(copy(m.mappings[0])); },
    (m: Manifest) => { m.mappings[4].target = copy(m.mappings[1].target); },
    (m: Manifest) => { m.baselineDigest = "changed"; },
    (m: Manifest) => { m.sourceCommit = "changed"; },
    (m: Manifest) => { m.approvalReference = ""; },
    (m: Manifest) => { m.mappings[2].target!.role = "ADMIN"; },
    (m: Manifest) => { (m as any).automaticRepair = true; },
    (m: Manifest) => { m.mappings[3].target!.normalizeExternalAvailability = false; },
    (m: Manifest) => { m.mappings[1].target!.role = "FACULTY"; m.mappings[1].target!.level = null; },
  ])("rejects malformed/unapproved/escalating mappings %#", mutate => {
    const b = syntheticCutoverSnapshot(), m = syntheticCutoverManifest(b); mutate(m);
    expect(() => validateManifest(b, m)).toThrow();
  });
  it.each(["DR-7_EXTERNAL_ADVISER", "DR-6_PENDING_INELIGIBLE", "DR-5_EXTERNAL_COMMITTEE_ROLE", "DUPLICATE_ACTIVE_ADVISER"])("holds %s unresolved without repairs", kind => {
    const b = syntheticCutoverSnapshot();
    if (kind === "DR-7_EXTERNAL_ADVISER") b.tables.adviser_assignments.push({ assignment_id: "bad", adviser_id: "external", student_id: "new-student", is_active: 1 });
    if (kind === "DR-6_PENDING_INELIGIBLE") b.tables.adviser_requests.push({ adviser_req_id: "pending-signed", requested_adviser_id: "external", dean_status: "PENDING" });
    if (kind === "DR-5_EXTERNAL_COMMITTEE_ROLE") b.tables.panel_assignments.push({ panel_id: "bad-external", user_id: "external", role: "CHAIRMAN", is_active: 1 });
    if (kind === "DUPLICATE_ACTIVE_ADVISER") b.tables.adviser_assignments.push(...["a", "b"].map(assignment_id => ({ assignment_id, adviser_id: "external", student_id: "same", is_active: 1 })));
    const m = syntheticCutoverManifest(b);
    expect(inventory(b).integrity.findings.map(f => f.code)).toContain(kind);
    expect(() => validateManifest(b, m)).toThrow(/Unresolved data decision/);
    m.mappings[3] = { userId: "external", disposition: "BLOCKED", decision: `${kind} unresolved / blocked / denied` };
    expect(() => validateManifest(b, m)).not.toThrow();
    expect(applyAll(b, m).tables.panelists.find(r => r.user_id === "external")).toEqual(b.tables.panelists.find(r => r.user_id === "external"));
  });
  it.each(["CUSTOM", "UNKNOWN"])("rejects retired/unknown %s accounts rather than converting them", role => {
    const b = syntheticCutoverSnapshot(); b.tables.users[1].role = role;
    const before = snapshotDigest(b);
    expect(() => validateManifest(b, syntheticCutoverManifest(b))).toThrow(/Retired Custom Roles/);
    expect(snapshotDigest(b)).toBe(before);
  });
  it("rejects pre-retirement schemas rather than reading or translating legacy grants", () => {
    const b = syntheticCutoverSnapshot(); b.tables.custom_roles = []; b.tables.role_feature_access = [];
    expect(() => validateManifest(b, syntheticCutoverManifest(b))).toThrow(/Retired Custom Roles/);
  });
  it("rejects changed approval, missing/forged/duplicate journals and partial writes", () => {
    const b = syntheticCutoverSnapshot(), m = syntheticCutoverManifest(b), current = nextBatch(b, m, b).next!;
    const changed = copy(m); changed.approvalReference = "different";
    expect(() => reconcile(b, changed, current)).toThrow();
    for (const mutate of [(s: Snapshot) => { s.tables.audit_logs.pop(); }, (s: Snapshot) => { s.tables.audit_logs.at(-1)!.old_value = "forged"; },
      (s: Snapshot) => { s.tables.audit_logs.push(copy(s.tables.audit_logs.at(-1)!)); }, (s: Snapshot) => { s.tables.administrator_access = []; }]) {
      const invalid = copy(current); mutate(invalid); expect(() => reconcile(b, m, invalid)).toThrow();
    }
  });
  it("requires the first Full to be credential-ready even when a later Full would satisfy the final population", () => {
    const b = syntheticCutoverSnapshot(); b.tables.users[0].must_change_password = 1;
    const m = syntheticCutoverManifest(b); m.mappings[1].target!.level = "FULL"; m.mappings[1].target!.capabilities = [];
    expect(() => validateManifest(b, m)).toThrow(/First Full bootstrap/);
  });
  it("canonicalizes table/row/key order without hiding any value changes", () => {
    const b = syntheticCutoverSnapshot(), reordered = copy(b); Object.values(reordered.tables).forEach(rows => rows.reverse());
    expect(snapshotDigest(reordered)).toBe(snapshotDigest(b)); expect(canonical({ b: 1, a: 2 })).toBe(canonical({ a: 2, b: 1 }));
  });
});

describe("FACULTY-16 isolation guard, with no database connection", () => {
  it.each(["mysql://root@localhost:3306/", "mysql://root@127.0.0.1:3306/", "mysql://root@[::1]:3306/",
    "mysql://root@remote:33316/", "mysql://root@localhost:33316/graduate_system", "mysql://root@localhost:33316/?database=graduate_system"])("rejects %s", url => {
    expect(() => isolatedRehearsalUrl(url, "mysql://root@localhost:3306/graduate_system", `faculty16_test_${"a".repeat(32)}`)).toThrow();
  });
  it("rejects the application schema even on a separate port", () => {
    expect(() => isolatedRehearsalUrl("mysql://root@localhost:33316/", "mysql://root@localhost:3306/app", "graduate_system")).toThrow();
  });
  it("accepts only the explicit separate server and disposable UUID schema", () => {
    expect(isolatedRehearsalUrl("mysql://root@localhost:33316/", "mysql://root@localhost:3306/app", `faculty16_test_${"a".repeat(32)}`).port).toBe("33316");
  });
});
