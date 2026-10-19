/**
 * CDW-1 (correction) — deterministic RAP signing snapshot.
 *
 * The frozen RAP that signatures bind to is the SYSTEM-OWNED record: fixed
 * institutional metadata PLUS the Rapporteur's free-form body. Hashing only the
 * editable body is too weak, so this module builds one canonical, immutable
 * signing snapshot and hashes THAT complete snapshot.
 *
 * Determinism rules:
 *  - fixed key order (built explicitly, never spread from client objects);
 *  - committee sorted by (role, userId, name) so roster ordering cannot change
 *    the hash;
 *  - the report body is canonicalized (stable key order, sorted marks);
 *  - the later Chairman verdict/outcome is NEVER part of the snapshot.
 */

import { createHash } from "node:crypto";

import {
  type CanonicalReportDocument,
  canonicalizeReportDocument,
} from "./report-body.rules";

export const RAP_SNAPSHOT_SCHEMA_VERSION = 1 as const;

export interface RapSnapshotCommitteeMember {
  role: string;
  userId: string;
  name: string;
}

export interface RapSigningSnapshotInput {
  scheduleId: string;
  thesisId: string;
  defenseType: string;
  studentName: string;
  studentNumber: string | null;
  programName: string | null;
  defenseDate: string | null;
  defenseTime: string | null;
  venue: string | null;
  committee: RapSnapshotCommitteeMember[];
  preparedByUserId: string | null;
  preparedByName: string | null;
  contentVersion: number;
  /** ISO timestamp of this freeze — part of the exact snapshot identity. */
  frozenAt: string;
  /** Rapporteur report body (validated controlled document). */
  body: unknown;
}

export interface RapSigningSnapshot {
  schemaVersion: typeof RAP_SNAPSHOT_SCHEMA_VERSION;
  scheduleId: string;
  thesisId: string;
  defenseType: string;
  student: { name: string; number: string | null };
  program: { name: string | null };
  defense: { date: string | null; time: string | null; venue: string | null };
  committee: RapSnapshotCommitteeMember[];
  preparedBy: { userId: string | null; name: string | null };
  contentVersion: number;
  frozenAt: string;
  body: CanonicalReportDocument;
}

/** Stable ordering for committee members (roster order must not affect the hash). */
export function sortCommittee(
  members: RapSnapshotCommitteeMember[],
): RapSnapshotCommitteeMember[] {
  return [...members]
    .map((m) => ({ role: String(m.role), userId: String(m.userId), name: String(m.name) }))
    .sort((a, b) => {
      if (a.role !== b.role) return a.role < b.role ? -1 : 1;
      if (a.userId !== b.userId) return a.userId < b.userId ? -1 : 1;
      if (a.name !== b.name) return a.name < b.name ? -1 : 1;
      return 0;
    });
}

export function buildRapSigningSnapshot(
  input: RapSigningSnapshotInput,
): RapSigningSnapshot {
  return {
    schemaVersion: RAP_SNAPSHOT_SCHEMA_VERSION,
    scheduleId: input.scheduleId,
    thesisId: input.thesisId,
    defenseType: input.defenseType,
    student: { name: input.studentName, number: input.studentNumber ?? null },
    program: { name: input.programName ?? null },
    defense: {
      date: input.defenseDate ?? null,
      time: input.defenseTime ?? null,
      venue: input.venue ?? null,
    },
    committee: sortCommittee(input.committee),
    preparedBy: {
      userId: input.preparedByUserId ?? null,
      name: input.preparedByName ?? null,
    },
    contentVersion: input.contentVersion,
    frozenAt: input.frozenAt,
    body: canonicalizeReportDocument(input.body),
  };
}

/** Deterministic JSON serialization of the complete signing snapshot. */
export function serializeRapSnapshot(snapshot: RapSigningSnapshot): string {
  return JSON.stringify(snapshot);
}

/** Server-generated SHA-256 (hex) of the COMPLETE signing snapshot. */
export function hashRapSnapshot(snapshot: RapSigningSnapshot): string {
  return createHash("sha256").update(serializeRapSnapshot(snapshot), "utf8").digest("hex");
}
