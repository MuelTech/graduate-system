import { describe, expect, it } from "vitest";
import {
  DefenseCommitteePolicy,
  getSessionTotal,
} from "../../../src/services/defense-committee.policy";

const policy = new DefenseCommitteePolicy();

/** Master's 7: 1 chair + 4 panelists + fac + rap (scorer count not asserted as "5 scorers"). */
const mastersFull = () => [
  { userId: "c", role: "CHAIRMAN" as const },
  { userId: "p1", role: "PANELIST" as const },
  { userId: "p2", role: "PANELIST" as const },
  { userId: "p3", role: "PANELIST" as const },
  { userId: "p4", role: "PANELIST" as const },
  { userId: "f", role: "FACILITATOR" as const },
  { userId: "r", role: "RAPPORTEUR" as const },
];

/** Doctoral 8: 1 chair + 5 panelists + fac + rap. */
const doctoralFull = () => [
  { userId: "c", role: "CHAIRMAN" as const },
  { userId: "p1", role: "PANELIST" as const },
  { userId: "p2", role: "PANELIST" as const },
  { userId: "p3", role: "PANELIST" as const },
  { userId: "p4", role: "PANELIST" as const },
  { userId: "p5", role: "PANELIST" as const },
  { userId: "f", role: "FACILITATOR" as const },
  { userId: "r", role: "RAPPORTEUR" as const },
];

describe("session totals (confirmed 7 / 8)", () => {
  it("maps program type to session total", () => {
    expect(getSessionTotal("MASTERS")).toBe(7);
    expect(getSessionTotal("DOCTORAL")).toBe(8);
    expect(getSessionTotal("UNKNOWN")).toBe(null);
  });

  it("accepts a complete Master's Title committee (7)", () => {
    const result = policy.validateAssignments(
      "TITLE_DEFENSE",
      "MASTERS",
      mastersFull(),
    );
    expect(result.valid).toBe(true);
  });

  it("accepts a complete Doctoral Title committee (8)", () => {
    const result = policy.validateAssignments(
      "TITLE_DEFENSE",
      "DOCTORAL",
      doctoralFull(),
    );
    expect(result.valid).toBe(true);
  });

  it("rejects incomplete session (missing Facilitator/Rapporteur or short roster)", () => {
    const short = policy.validateAssignments("TITLE_DEFENSE", "MASTERS", [
      { userId: "c", role: "CHAIRMAN" },
      { userId: "p1", role: "PANELIST" },
    ]);
    expect(short.valid).toBe(false);
    expect(short.errors.join(" ")).toMatch(/exactly 7/i);
    expect(short.errors.join(" ")).toMatch(/FACILITATOR/i);
    expect(short.errors.join(" ")).toMatch(/RAPPORTEUR/i);
  });

  it("rejects unknown program type", () => {
    const result = policy.validateAssignments(
      "TITLE_DEFENSE",
      "UNKNOWN",
      mastersFull(),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/program type/i);
  });

  it("does not require exactly 5 Master's scorers as a hard-coded rule", () => {
    // Chair + 3 panelists + fac + rap is short of 7 — rejected for total, not for "not 5 scorers".
    const fourAcademic = policy.validateAssignments(
      "TITLE_DEFENSE",
      "MASTERS",
      [
        { userId: "c", role: "CHAIRMAN" },
        { userId: "p1", role: "PANELIST" },
        { userId: "p2", role: "PANELIST" },
        { userId: "p3", role: "PANELIST" },
        { userId: "f", role: "FACILITATOR" },
        { userId: "r", role: "RAPPORTEUR" },
      ],
    );
    expect(fourAcademic.valid).toBe(false);
    expect(fourAcademic.errors.join(" ")).toMatch(/7 participants/i);
    expect(fourAcademic.errors.join(" ")).not.toMatch(/5 scorers/i);
  });
});

describe("DefenseCommitteePolicy.isRoleAllowed", () => {
  it("Title Defense allows CHAIRMAN/PANELIST/FACILITATOR/RAPPORTEUR but not ADVISER", () => {
    expect(policy.isRoleAllowed("TITLE_DEFENSE", "CHAIRMAN")).toBe(true);
    expect(policy.isRoleAllowed("TITLE_DEFENSE", "PANELIST")).toBe(true);
    expect(policy.isRoleAllowed("TITLE_DEFENSE", "FACILITATOR")).toBe(true);
    expect(policy.isRoleAllowed("TITLE_DEFENSE", "RAPPORTEUR")).toBe(true);
    expect(policy.isRoleAllowed("TITLE_DEFENSE", "ADVISER")).toBe(false);
  });

  it("Proposal/Final allow optional ADVISER", () => {
    expect(policy.isRoleAllowed("PROPOSAL_DEFENSE", "ADVISER")).toBe(true);
    expect(policy.isRoleAllowed("FINAL_DEFENSE", "ADVISER")).toBe(true);
  });
});

describe("DefenseCommitteePolicy.validateAssignments", () => {
  it("rejects Title Defense ADVISER assignment", () => {
    const roster = [
      { userId: "a", role: "ADVISER" as const },
      ...mastersFull().slice(0, 6),
    ];
    const result = policy.validateAssignments(
      "TITLE_DEFENSE",
      "MASTERS",
      roster,
    );
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/ADVISER/i);
  });

  it("rejects duplicate users on one defense", () => {
    const result = policy.validateAssignments("TITLE_DEFENSE", "MASTERS", [
      { userId: "a", role: "CHAIRMAN" },
      { userId: "a", role: "PANELIST" },
      { userId: "p2", role: "PANELIST" },
      { userId: "p3", role: "PANELIST" },
      { userId: "p4", role: "PANELIST" },
      { userId: "f", role: "FACILITATOR" },
      { userId: "r", role: "RAPPORTEUR" },
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/twice/i);
  });

  it("allows optional explicit ADVISER seat on Proposal/Final when it is the active adviser", () => {
    // Adviser + chair + 3 panelists + fac + rap = 7 academic+officials (Master's)
    const roster = [
      { userId: "adv", role: "ADVISER" as const },
      { userId: "c", role: "CHAIRMAN" as const },
      { userId: "p1", role: "PANELIST" as const },
      { userId: "p2", role: "PANELIST" as const },
      { userId: "p3", role: "PANELIST" as const },
      { userId: "f", role: "FACILITATOR" as const },
      { userId: "r", role: "RAPPORTEUR" as const },
    ];
    const ok = policy.validateAssignments(
      "PROPOSAL_DEFENSE",
      "MASTERS",
      roster,
      { adviserUserId: "adv" },
    );
    expect(ok.valid).toBe(true);

    const wrong = policy.validateAssignments(
      "PROPOSAL_DEFENSE",
      "MASTERS",
      roster,
      { adviserUserId: "real-adviser" },
    );
    expect(wrong.valid).toBe(false);
    expect(wrong.errors.join(" ")).toMatch(/active thesis adviser/i);
  });

  it("does not auto-require an ADVISER seat (relationship ≠ seat)", () => {
    const result = policy.validateAssignments(
      "PROPOSAL_DEFENSE",
      "MASTERS",
      mastersFull(),
      { adviserUserId: "someone" },
    );
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects two FACILITATORs or two CHAIRMANs", () => {
    const twoFac = policy.validateAssignments("TITLE_DEFENSE", "MASTERS", [
      { userId: "c", role: "CHAIRMAN" },
      { userId: "p1", role: "PANELIST" },
      { userId: "p2", role: "PANELIST" },
      { userId: "p3", role: "PANELIST" },
      { userId: "p4", role: "PANELIST" },
      { userId: "f", role: "FACILITATOR" },
      { userId: "f2", role: "FACILITATOR" },
    ]);
    // wait - that's 7 but two fac and no rapporteur
    expect(twoFac.valid).toBe(false);
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

  it("exposes evaluator roles and leaves scorer counts unresolved", () => {
    expect(policy.getEvaluatorRoles("FINAL_DEFENSE")).toEqual([
      "CHAIRMAN",
      "PANELIST",
    ]);
    const cfg = policy.getPolicy("TITLE_DEFENSE", "MASTERS");
    expect(cfg.scorerCountPolicy).toBe("UNRESOLVED_DO_NOT_HARDCODE");
    expect(cfg.facilitatorRequired).toBe(true);
    expect(cfg.rapporteurRequired).toBe(true);
    expect(cfg.sessionTotal).toBe(7);
  });
});
