import { describe, expect, it } from "vitest";

import {
  canReadHistoricalBoundManuscript,
  classifyHistoryRelationship,
  defenseStageRank,
  isPriorAttempt,
  resolveHistoryScheduleIds,
  type HistoryAttemptInput,
} from "../../../src/services/defense-history.rules";

function attempt(overrides: Partial<HistoryAttemptInput> & { scheduleId: string }): HistoryAttemptInput {
  return {
    defenseType: "PROPOSAL_DEFENSE",
    outcome: "PASSED",
    defenseDate: "2026-08-01",
    createdAt: "2026-07-01T00:00:00.000Z",
    concludedAt: "2026-08-05T00:00:00.000Z",
    ...overrides,
  };
}

describe("CDW-6 defense history rules — stage ranking + ordering", () => {
  it("ranks the canonical defense stages", () => {
    expect(defenseStageRank("TITLE_DEFENSE")).toBe(1);
    expect(defenseStageRank("PROPOSAL_DEFENSE")).toBe(2);
    expect(defenseStageRank("FINAL_DEFENSE")).toBe(3);
    expect(defenseStageRank("SOMETHING_ELSE")).toBeNull();
  });

  it("treats an attempt as prior only when it strictly precedes the current one", () => {
    const current = attempt({ scheduleId: "c", defenseDate: "2026-09-01" });
    expect(isPriorAttempt(attempt({ scheduleId: "h", defenseDate: "2026-08-01" }), current)).toBe(true);
    expect(isPriorAttempt(attempt({ scheduleId: "h", defenseDate: "2026-09-01" }), current)).toBe(false);
    expect(isPriorAttempt(attempt({ scheduleId: "h", defenseDate: "2026-10-01" }), current)).toBe(false);
    // Same calendar date → falls back to createdAt for a strict decision.
    expect(
      isPriorAttempt(
        attempt({ scheduleId: "h", defenseDate: "2026-09-01", createdAt: "2026-06-01T00:00:00.000Z" }),
        current,
      ),
    ).toBe(true);
    // Unprovable ordering → fail closed.
    expect(
      isPriorAttempt(
        attempt({ scheduleId: "h", defenseDate: null, createdAt: null }),
        attempt({ scheduleId: "c", defenseDate: null, createdAt: null }),
      ),
    ).toBe(false);
  });
});

describe("CDW-6 defense history rules — relationship classification", () => {
  it("classifies a strictly earlier same-stage attempt as a re-defense", () => {
    expect(
      classifyHistoryRelationship(
        attempt({ scheduleId: "h", defenseType: "TITLE_DEFENSE", outcome: "REDEFENSE_REQUIRED" }),
        attempt({ scheduleId: "c", defenseType: "TITLE_DEFENSE" }),
      ),
    ).toBe("SAME_STAGE_REDEFENSE");
  });

  it("classifies the immediately preceding PASSED stage as the previous stage", () => {
    expect(
      classifyHistoryRelationship(
        attempt({ scheduleId: "h", defenseType: "PROPOSAL_DEFENSE", outcome: "PASSED" }),
        attempt({ scheduleId: "c", defenseType: "FINAL_DEFENSE", defenseDate: "2026-11-01" }),
      ),
    ).toBe("PREVIOUS_STAGE");
  });

  it("does not promote a non-PASSED adjacent attempt to previous-stage context", () => {
    expect(
      classifyHistoryRelationship(
        attempt({ scheduleId: "h", defenseType: "PROPOSAL_DEFENSE", outcome: "REDEFENSE_REQUIRED" }),
        attempt({ scheduleId: "c", defenseType: "FINAL_DEFENSE", defenseDate: "2026-11-01" }),
      ),
    ).toBe("OLDER_HISTORY");
  });

  it("classifies a non-adjacent earlier stage as older history", () => {
    expect(
      classifyHistoryRelationship(
        attempt({ scheduleId: "h", defenseType: "TITLE_DEFENSE", outcome: "PASSED" }),
        attempt({ scheduleId: "c", defenseType: "FINAL_DEFENSE", defenseDate: "2026-11-01" }),
      ),
    ).toBe("OLDER_HISTORY");
  });

  it("never classifies a later/future stage as history, and fails closed on unknown types", () => {
    expect(
      classifyHistoryRelationship(
        attempt({ scheduleId: "h", defenseType: "FINAL_DEFENSE", defenseDate: "2026-12-01" }),
        attempt({ scheduleId: "c", defenseType: "PROPOSAL_DEFENSE", defenseDate: "2026-09-01" }),
      ),
    ).toBeNull();
    expect(
      classifyHistoryRelationship(
        attempt({ scheduleId: "h", defenseType: "BOGUS" }),
        attempt({ scheduleId: "c", defenseType: "FINAL_DEFENSE" }),
      ),
    ).toBeNull();
  });
});

describe("CDW-6 defense history rules — resolution + deterministic ordering", () => {
  const current = attempt({
    scheduleId: "sched-final-2",
    defenseType: "FINAL_DEFENSE",
    defenseDate: "2026-11-01",
    concludedAt: null,
    outcome: null,
  });

  it("orders same-stage, then previous-stage, then older history (newest first)", () => {
    const items = resolveHistoryScheduleIds(current, [
      attempt({ scheduleId: "title-1", defenseType: "TITLE_DEFENSE", defenseDate: "2026-05-01", concludedAt: "2026-05-05T00:00:00.000Z" }),
      attempt({ scheduleId: "prop-1", defenseType: "PROPOSAL_DEFENSE", outcome: "REDEFENSE_REQUIRED", defenseDate: "2026-07-01", concludedAt: "2026-07-05T00:00:00.000Z" }),
      attempt({ scheduleId: "prop-2", defenseType: "PROPOSAL_DEFENSE", outcome: "PASSED", defenseDate: "2026-09-01", concludedAt: "2026-09-05T00:00:00.000Z" }),
      attempt({ scheduleId: "final-1", defenseType: "FINAL_DEFENSE", outcome: "REDEFENSE_REQUIRED", defenseDate: "2026-09-20", concludedAt: "2026-09-25T00:00:00.000Z" }),
    ]);

    expect(items.map((i) => i.scheduleId)).toEqual(["final-1", "prop-2", "prop-1", "title-1"]);
    expect(items.map((i) => i.relationship)).toEqual([
      "SAME_STAGE_REDEFENSE",
      "PREVIOUS_STAGE",
      "OLDER_HISTORY",
      "OLDER_HISTORY",
    ]);
  });

  it("excludes the current schedule, non-concluded attempts, and future/unrelated schedules", () => {
    const items = resolveHistoryScheduleIds(current, [
      current,
      attempt({ scheduleId: "not-concluded", outcome: null, concludedAt: null }),
      attempt({ scheduleId: "final-3-future", defenseType: "FINAL_DEFENSE", defenseDate: "2027-01-01" }),
      attempt({ scheduleId: "prop-1", defenseType: "PROPOSAL_DEFENSE", defenseDate: "2026-07-01" }),
    ]);
    expect(items.map((i) => i.scheduleId)).toEqual(["prop-1"]);
  });

  it("is deterministic when concluded timestamps tie (falls back to defense date)", () => {
    const items = resolveHistoryScheduleIds(current, [
      attempt({ scheduleId: "prop-a", defenseDate: "2026-08-01", concludedAt: "2026-08-05T00:00:00.000Z" }),
      attempt({ scheduleId: "prop-b", defenseDate: "2026-09-01", concludedAt: "2026-08-05T00:00:00.000Z" }),
    ]);
    expect(items.map((i) => i.scheduleId)).toEqual(["prop-b", "prop-a"]);
  });
});

describe("CDW-6 defense history rules — historical bound-manuscript access", () => {
  type Schedule = {
    id: string;
    defenseType: string;
    manuscriptDocumentId?: string | null;
    defenseDate?: string | null;
    createdAt?: string | null;
    conclusion?: { outcome?: string | null } | null;
    panelAssignments?: Array<{ userId: string }>;
  };

  function schedule(overrides: Partial<Schedule> & { id: string }): Schedule {
    return {
      defenseType: "PROPOSAL_DEFENSE",
      manuscriptDocumentId: null,
      defenseDate: "2026-08-01",
      createdAt: "2026-07-01T00:00:00.000Z",
      conclusion: null,
      panelAssignments: [],
      ...overrides,
    };
  }

  it("grants a current committee member read access to the exact bound prior manuscript", () => {
    const schedules: Schedule[] = [
      schedule({
        id: "prop-1",
        manuscriptDocumentId: "doc-prop-1",
        conclusion: { outcome: "REDEFENSE_REQUIRED" },
        panelAssignments: [{ userId: "old-panelist" }],
      }),
      schedule({
        id: "prop-2",
        defenseType: "PROPOSAL_DEFENSE",
        manuscriptDocumentId: "doc-prop-2",
        defenseDate: "2026-09-15",
        conclusion: null,
        panelAssignments: [{ userId: "new-panelist" }],
      }),
    ];
    expect(
      canReadHistoricalBoundManuscript({
        documentId: "doc-prop-1",
        documentStage: "PROPOSAL",
        documentDocType: "PROPOSAL_CHAPTERS",
        schedules,
        userId: "new-panelist",
      }),
    ).toBe(true);
  });

  it("denies a user not assigned to the CURRENT attempt", () => {
    const schedules: Schedule[] = [
      schedule({ id: "prop-1", manuscriptDocumentId: "doc-prop-1", conclusion: { outcome: "REDEFENSE_REQUIRED" }, panelAssignments: [{ userId: "old-panelist" }] }),
      schedule({ id: "prop-2", defenseDate: "2026-09-15", panelAssignments: [{ userId: "someone-else" }] }),
    ];
    expect(
      canReadHistoricalBoundManuscript({ documentId: "doc-prop-1", documentStage: "PROPOSAL", documentDocType: "PROPOSAL_CHAPTERS", schedules, userId: "new-panelist" }),
    ).toBe(false);
  });

  it("denies a non-concluded historical schedule", () => {
    const schedules: Schedule[] = [
      schedule({ id: "prop-1", manuscriptDocumentId: "doc-prop-1", conclusion: null, panelAssignments: [{ userId: "old" }] }),
      schedule({ id: "prop-2", defenseDate: "2026-09-15", panelAssignments: [{ userId: "new-panelist" }] }),
    ];
    expect(
      canReadHistoricalBoundManuscript({ documentId: "doc-prop-1", documentStage: "PROPOSAL", documentDocType: "PROPOSAL_CHAPTERS", schedules, userId: "new-panelist" }),
    ).toBe(false);
  });

  it("denies a document that is NOT the exact attempt binding, and mismatched document stages", () => {
    const schedules: Schedule[] = [
      schedule({ id: "prop-1", manuscriptDocumentId: "doc-prop-1", conclusion: { outcome: "PASSED" }, panelAssignments: [{ userId: "old" }] }),
      schedule({ id: "final-1", defenseType: "FINAL_DEFENSE", defenseDate: "2026-10-01", panelAssignments: [{ userId: "final-panelist" }] }),
    ];
    // A document that no schedule binds is never granted.
    expect(
      canReadHistoricalBoundManuscript({ documentId: "doc-unbound", documentStage: "PROPOSAL", documentDocType: "PROPOSAL_CHAPTERS", schedules, userId: "final-panelist" }),
    ).toBe(false);
    // The bound manuscript must match the historical attempt's stage/docType.
    expect(
      canReadHistoricalBoundManuscript({ documentId: "doc-prop-1", documentStage: "FINAL", documentDocType: "FINAL_MANUSCRIPT", schedules, userId: "final-panelist" }),
    ).toBe(false);
    expect(
      canReadHistoricalBoundManuscript({ documentId: "doc-prop-1", documentStage: null, documentDocType: "PROPOSAL_CHAPTERS", schedules, userId: "final-panelist" }),
    ).toBe(false);
    // Supporting evidence can never be a bound-manuscript grant.
    expect(
      canReadHistoricalBoundManuscript({ documentId: "doc-prop-1", documentStage: "PROPOSAL", documentDocType: "COR", schedules, userId: "final-panelist" }),
    ).toBe(false);
  });

  it("denies a NON-PRIOR same-stage attempt (an earlier attempt's committee cannot read a later one)", () => {
    // Both concluded Proposal attempts. The caller sits on the EARLIER one; the
    // later attempt is forward in time and must NOT be readable as history.
    const schedules: Schedule[] = [
      schedule({
        id: "prop-1",
        defenseDate: "2026-07-01",
        conclusion: { outcome: "REDEFENSE_REQUIRED" },
        panelAssignments: [{ userId: "early-panelist" }],
      }),
      schedule({
        id: "prop-2",
        defenseDate: "2026-09-15",
        manuscriptDocumentId: "doc-prop-2",
        conclusion: { outcome: "PASSED" },
        panelAssignments: [{ userId: "late-panelist" }],
      }),
    ];
    expect(
      canReadHistoricalBoundManuscript({
        documentId: "doc-prop-2",
        documentStage: "PROPOSAL",
        documentDocType: "PROPOSAL_CHAPTERS",
        schedules,
        userId: "early-panelist",
      }),
    ).toBe(false);
  });

  it("does not grant access through a future or unrelated schedule", () => {
    const schedules: Schedule[] = [
      schedule({ id: "prop-1", manuscriptDocumentId: "doc-prop-1", conclusion: { outcome: "PASSED" }, defenseDate: "2026-09-15" }),
      schedule({ id: "title-0", defenseType: "TITLE_DEFENSE", defenseDate: "2026-05-01", panelAssignments: [{ userId: "title-only" }] }),
    ];
    // Current (title) attempt precedes the bound (proposal) attempt → not history.
    expect(
      canReadHistoricalBoundManuscript({ documentId: "doc-prop-1", documentStage: "PROPOSAL", documentDocType: "PROPOSAL_CHAPTERS", schedules, userId: "title-only" }),
    ).toBe(false);
  });

  it("still grants a historical attempt's own committee access to its own binding", () => {
    const schedules: Schedule[] = [
      schedule({ id: "prop-1", manuscriptDocumentId: "doc-prop-1", conclusion: { outcome: "PASSED" }, panelAssignments: [{ userId: "old-panelist" }] }),
      schedule({ id: "prop-2", defenseDate: "2026-09-15", panelAssignments: [{ userId: "old-panelist" }] }),
    ];
    expect(
      canReadHistoricalBoundManuscript({ documentId: "doc-prop-1", documentStage: "PROPOSAL", documentDocType: "PROPOSAL_CHAPTERS", schedules, userId: "old-panelist" }),
    ).toBe(true);
  });
});
