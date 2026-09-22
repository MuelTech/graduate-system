import { describe, expect, it } from "vitest";
import { DefenseCommitteePolicy } from "./defense-committee.policy";

const policy = new DefenseCommitteePolicy();

describe("DefenseCommitteePolicy.isRoleAllowed", () => {
  it("Title Defense allows CHAIRMAN/PANELIST/FACILITATOR/RAPPORTEUR but not ADVISER", () => {
    expect(policy.isRoleAllowed("TITLE_DEFENSE", "CHAIRMAN")).toBe(true);
    expect(policy.isRoleAllowed("TITLE_DEFENSE", "PANELIST")).toBe(true);
    expect(policy.isRoleAllowed("TITLE_DEFENSE", "FACILITATOR")).toBe(true);
    expect(policy.isRoleAllowed("TITLE_DEFENSE", "RAPPORTEUR")).toBe(true);
    expect(policy.isRoleAllowed("TITLE_DEFENSE", "ADVISER")).toBe(false);
  });

  it("Proposal/Final allow ADVISER", () => {
    expect(policy.isRoleAllowed("PROPOSAL_DEFENSE", "ADVISER")).toBe(true);
    expect(policy.isRoleAllowed("FINAL_DEFENSE", "ADVISER")).toBe(true);
  });
});

describe("DefenseCommitteePolicy.validateAssignments", () => {
  it("rejects Title Defense ADVISER assignment", () => {
    const result = policy.validateAssignments(
      "TITLE_DEFENSE",
      "MASTERS",
      [
        { userId: "a", role: "CHAIRMAN" },
        { userId: "b", role: "ADVISER" },
      ],
    );
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/ADVISER/i);
  });

  it("rejects duplicate users on one defense", () => {
    const result = policy.validateAssignments("TITLE_DEFENSE", "MASTERS", [
      { userId: "a", role: "CHAIRMAN" },
      { userId: "a", role: "PANELIST" },
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/twice/i);
  });

  it("enforces at most one ADVISER / FACILITATOR / RAPPORTEUR", () => {
    const result = policy.validateAssignments(
      "PROPOSAL_DEFENSE",
      "MASTERS",
      [
        { userId: "c", role: "CHAIRMAN" },
        { userId: "a", role: "ADVISER" },
        { userId: "b", role: "ADVISER" },
      ],
      { adviserUserId: "a" },
    );
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/ADVISER/i);
  });

  it("accepts a dynamic multi-PANELIST committee", () => {
    const result = policy.validateAssignments(
      "FINAL_DEFENSE",
      "DOCTORAL",
      [
        { userId: "c", role: "CHAIRMAN" },
        { userId: "a", role: "ADVISER" },
        { userId: "p1", role: "PANELIST" },
        { userId: "p2", role: "PANELIST" },
        { userId: "p3", role: "PANELIST" },
        { userId: "r", role: "RAPPORTEUR" },
        { userId: "f", role: "FACILITATOR" },
      ],
      { adviserUserId: "a" },
    );
    expect(result.valid).toBe(true);
  });

  it("requires Proposal/Final ADVISER to match active AdviserAssignment", () => {
    const wrong = policy.validateAssignments(
      "PROPOSAL_DEFENSE",
      "MASTERS",
      [
        { userId: "c", role: "CHAIRMAN" },
        { userId: "other", role: "ADVISER" },
      ],
      { adviserUserId: "real-adviser" },
    );
    expect(wrong.valid).toBe(false);
    expect(wrong.errors.join(" ")).toMatch(/active thesis adviser/i);

    const missingRel = policy.validateAssignments(
      "PROPOSAL_DEFENSE",
      "MASTERS",
      [
        { userId: "c", role: "CHAIRMAN" },
        { userId: "x", role: "ADVISER" },
      ],
      { adviserUserId: null },
    );
    expect(missingRel.valid).toBe(false);
  });

  it("does not hardcode exact committee sizes", () => {
    const two = policy.validateAssignments("TITLE_DEFENSE", "MASTERS", [
      { userId: "c", role: "CHAIRMAN" },
      { userId: "p", role: "PANELIST" },
    ]);
    expect(two.valid).toBe(true);

    const many = policy.validateAssignments("TITLE_DEFENSE", "DOCTORAL", [
      { userId: "c", role: "CHAIRMAN" },
      { userId: "p1", role: "PANELIST" },
      { userId: "p2", role: "PANELIST" },
      { userId: "p3", role: "PANELIST" },
      { userId: "p4", role: "PANELIST" },
      { userId: "p5", role: "PANELIST" },
    ]);
    expect(many.valid).toBe(true);
  });

  it("requires CHAIRMAN", () => {
    const result = policy.validateAssignments("TITLE_DEFENSE", "MASTERS", [
      { userId: "p", role: "PANELIST" },
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/CHAIRMAN/i);
  });
});

describe("DefenseCommitteePolicy evaluators", () => {
  it("treats CHAIRMAN and PANELIST as evaluators; ADVISER/FACILITATOR/RAPPORTEUR are not", () => {
    expect(policy.isEvaluatorRole("PROPOSAL_DEFENSE", "CHAIRMAN")).toBe(true);
    expect(policy.isEvaluatorRole("PROPOSAL_DEFENSE", "PANELIST")).toBe(true);
    expect(policy.isEvaluatorRole("PROPOSAL_DEFENSE", "ADVISER")).toBe(false);
    expect(policy.isEvaluatorRole("PROPOSAL_DEFENSE", "FACILITATOR")).toBe(
      false,
    );
    expect(policy.isEvaluatorRole("PROPOSAL_DEFENSE", "RAPPORTEUR")).toBe(
      false,
    );
  });

  it("exposes evaluator roles for scoring completion checks", () => {
    expect(policy.getEvaluatorRoles("FINAL_DEFENSE")).toEqual([
      "CHAIRMAN",
      "PANELIST",
    ]);
  });
});
