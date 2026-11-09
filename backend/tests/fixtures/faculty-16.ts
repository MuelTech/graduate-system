import { snapshotDigest, type Manifest, type Snapshot } from "../../src/access/cutover-rehearsal";

export function syntheticCutoverSnapshot(): Snapshot {
  const user = (id: string, role: string) => ({ user_id: id, email: `${id}@example.invalid`, role,
    password_hash: `unusable-synthetic-hash-${id}`, must_change_password: 0, is_active: 1 });
  return { version: 1, schema: `faculty16_test_${"a".repeat(32)}`, sourceCommit: "d".repeat(40), schemaDigest: "synthetic-schema",
    tables: {
      _prisma_migrations: [{ id: "migration-1", migration_name: "synthetic-committed-chain", checksum: "unchanged" }],
      users: [user("operator", "ADMIN"), user("restricted", "ADMIN"), user("faculty", "PANELIST"), user("external", "PANELIST"), user("unresolved", "ADMIN")],
      panelists: [
        { panelist_id: "profile-faculty", user_id: "faculty", is_active: 1, is_external: 0, is_available_as_adviser: 1 },
        { panelist_id: "profile-external", user_id: "external", is_active: 1, is_external: 1, is_available_as_adviser: 1 },
      ],
      administrator_access: [], account_capability_grants: [],
      adviser_assignments: [{ assignment_id: "historical-adviser", student_id: "student", adviser_id: "faculty", is_active: 0 }],
      panel_assignments: [{ panel_id: "panel-history", user_id: "faculty", role: "PANELIST", schedule_id: "schedule", is_active: 0 }],
      adviser_requests: [],
      adviser_request_signed_states: [{ request_id: "signed-request", payload: '{"exact":"signed"}', signature_data: "SYNTHETIC_SIGNATURE_BYTES", evidence_hash: "original-sha256" }],
      adviser_request_official_records: [{ request_id: "signed-request", snapshot: '{"exact":"official"}', evidence_hash: "original-official-hash" }],
      entrance_exam_scores: [{ score_id: "historic-grade", graded_by: "operator", essay_score: "22.500000000000000000000000000000" }],
      manuscript_submissions: [{ submission_id: "manuscript", file_path: "synthetic/exact-version.pdf", sha256: "unchanged-historical-output" }],
      audit_logs: [{ log_id: "historical-audit", actor_id: "faculty", action_type: "HISTORICAL_SIGNED", target_table: null, target_id: null,
        old_value: "original", new_value: "evidence", description: null, ip_address: null, created_at: "2020-01-01 00:00:00" }],
    } };
}
/** Synthetic approval only; never a real bootstrap candidate or a default deployment manifest. */
export function syntheticCutoverManifest(baseline: Snapshot): Manifest {
  return { version: 1, mode: "ISOLATED_REHEARSAL", baselineDigest: snapshotDigest(baseline), sourceCommit: baseline.sourceCommit,
    actorUserId: "operator", approvalReference: "SYNTHETIC-TEST-ONLY", approvedAt: "2026-11-09T00:00:00.000Z", mappings: [
      { userId: "operator", disposition: "APPROVED", decision: "Synthetic DR-1 bootstrap", target: { role: "ADMIN", level: "FULL", capabilities: [], normalizeExternalAvailability: false } },
      { userId: "restricted", disposition: "APPROVED", decision: "Synthetic existing Admin explicit direct configuration", target: { role: "ADMIN", level: "RESTRICTED", capabilities: ["students.view"], normalizeExternalAvailability: false } },
      { userId: "faculty", disposition: "APPROVED", decision: "Synthetic in-place identity and initial evaluator designation", target: { role: "FACULTY", level: null, capabilities: ["essay.evaluate"], normalizeExternalAvailability: false } },
      { userId: "external", disposition: "APPROVED", decision: "Synthetic explicit External availability normalization", target: { role: "FACULTY", level: null, capabilities: [], normalizeExternalAvailability: true } },
      { userId: "unresolved", disposition: "BLOCKED", decision: "Synthetic unconfigured Admin / blocked / denied" },
    ] };
}
