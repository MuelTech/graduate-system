import { describe, expect, it } from "vitest";

import {
  RAP_SNAPSHOT_SCHEMA_VERSION,
  buildRapSigningSnapshot,
  hashRapSnapshot,
  serializeRapSnapshot,
} from "../../../src/services/rap-snapshot.rules";

const BODY = {
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "Committee suggestions" }] }],
};

function input(overrides: Record<string, unknown> = {}) {
  return {
    scheduleId: "sched-1",
    thesisId: "thesis-1",
    defenseType: "PROPOSAL_DEFENSE",
    studentName: "Ana Cruz",
    studentNumber: "2020-001",
    programName: "MSIT",
    defenseDate: "2026-10-20",
    defenseTime: "09:00:00",
    venue: "Room 201",
    committee: [
      { role: "CHAIRMAN", userId: "u-chair", name: "Chair One" },
      { role: "PANELIST", userId: "u-pan", name: "Panel Two" },
      { role: "RAPPORTEUR", userId: "u-rap", name: "Rap Three" },
    ],
    preparedByUserId: "u-rap",
    preparedByName: "Rap Three",
    contentVersion: 1,
    frozenAt: "2026-10-20T01:00:00.000Z",
    body: BODY,
    ...overrides,
  } as never;
}

describe("buildRapSigningSnapshot / hashRapSnapshot (CDW-1 complete signing snapshot)", () => {
  it("is deterministic for the same input", () => {
    expect(hashRapSnapshot(buildRapSigningSnapshot(input()))).toBe(
      hashRapSnapshot(buildRapSigningSnapshot(input())),
    );
  });

  it("badges the snapshot with a schema version", () => {
    expect(buildRapSigningSnapshot(input()).schemaVersion).toBe(RAP_SNAPSHOT_SCHEMA_VERSION);
  });

  it("is insensitive to committee member ordering", () => {
    const a = input();
    const b = input({
      committee: [
        { role: "RAPPORTEUR", userId: "u-rap", name: "Rap Three" },
        { role: "PANELIST", userId: "u-pan", name: "Panel Two" },
        { role: "CHAIRMAN", userId: "u-chair", name: "Chair One" },
      ],
    });
    expect(hashRapSnapshot(buildRapSigningSnapshot(a))).toBe(hashRapSnapshot(buildRapSigningSnapshot(b)));
  });

  it("is insensitive to report-body key order", () => {
    const a = input();
    const b = input({
      body: { content: [{ content: [{ text: "Committee suggestions", type: "text" }], type: "paragraph" }], type: "doc" },
    });
    expect(hashRapSnapshot(buildRapSigningSnapshot(a))).toBe(hashRapSnapshot(buildRapSigningSnapshot(b)));
  });

  it("changes when the report body changes", () => {
    const changed = input({
      body: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "different" }] }] },
    });
    expect(hashRapSnapshot(buildRapSigningSnapshot(input()))).not.toBe(
      hashRapSnapshot(buildRapSigningSnapshot(changed)),
    );
  });

  it("changes when fixed metadata changes", () => {
    const base = hashRapSnapshot(buildRapSigningSnapshot(input()));
    expect(hashRapSnapshot(buildRapSigningSnapshot(input({ venue: "Room 999" })))).not.toBe(base);
    expect(hashRapSnapshot(buildRapSigningSnapshot(input({ studentName: "Other" })))).not.toBe(base);
    expect(hashRapSnapshot(buildRapSigningSnapshot(input({ contentVersion: 2 })))).not.toBe(base);
  });

  it("changes when the committee roster or roles change", () => {
    const base = hashRapSnapshot(buildRapSigningSnapshot(input()));
    const roleChanged = input({
      committee: [
        { role: "PANELIST", userId: "u-chair", name: "Chair One" },
        { role: "PANELIST", userId: "u-pan", name: "Panel Two" },
        { role: "RAPPORTEUR", userId: "u-rap", name: "Rap Three" },
      ],
    });
    expect(hashRapSnapshot(buildRapSigningSnapshot(roleChanged))).not.toBe(base);
  });

  it("does not include the Chairman verdict / outcome", () => {
    const serialized = serializeRapSnapshot(buildRapSigningSnapshot(input()));
    expect(serialized).not.toMatch(/outcome/i);
    expect(serialized).not.toMatch(/PASSED|REDEFENSE_REQUIRED/);
  });

  it("produces a 64-char SHA-256 hex for the complete snapshot", () => {
    expect(hashRapSnapshot(buildRapSigningSnapshot(input()))).toMatch(/^[a-f0-9]{64}$/);
  });
});
