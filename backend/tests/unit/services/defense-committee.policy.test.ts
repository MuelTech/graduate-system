import { describe, expect, it } from "vitest";
import {
  DefenseCommitteePolicy,
  getSessionTotal,
} from "../../../src/services/defense-committee.policy";

const policy = new DefenseCommitteePolicy();

/** Title Master's 7: 1 Chairman + 4 Panelists + Facilitator + Rapporteur, no Adviser. */
const titleMasters = () => [
  { userId: "c", role: "CHAIRMAN" as const },
  { userId: "p1", role: "PANELIST" as const },
  { userId: "p2", role: "PANELIST" as const },
  { userId: "p3", role: "PANELIST" as const },
  { userId: "p4", role: "PANELIST" as const },
  { userId: "f", role: "FACILITATOR" as const },
  { userId: "r", role: "RAPPORTEUR" as const },
];

/** Title Doctoral 8: 1 Chairman + 5 Panelists + Facilitator + Rapporteur, no Adviser. */
const titleDoctoral = () => [
  { userId: "c", role: "CHAIRMAN" as const },
  { userId: "p1", role: "PANELIST" as const },
  { userId: "p2", role: "PANELIST" as const },
  { userId: "p3", role: "PANELIST" as const },
  { userId: "p4", role: "PANELIST" as const },
  { userId: "p5", role: "PANELIST" as const },
  { userId: "f", role: "FACILITATOR" as const },
  { userId: "r", role: "RAPPORTEUR" as const },
];

/** Proposal/Final Master's 7: auto Adviser + Chairman + 3 Panelists + Fac + Rap. */
const proposalMasters = (adviser = "adv") => [
  { userId: adviser, role: "ADVISER" as const },
  { userId: "c", role: "CHAIRMAN" as const },
  { userId: "p1", role: "PANELIST" as const },
  { userId: "p2", role: "PANELIST" as const },
  { userId: "p3", role: "PANELIST" as const },
  { userId: "f", role: "FACILITATOR" as const },
  { userId: "r", role: "RAPPORTEUR" as const },
];

/** Proposal/Final Doctoral 8: auto Adviser + Chairman + 4 Panelists + Fac + Rap. */
const proposalDoctoral = (adviser = "adv") => [
  { userId: adviser, role: "ADVISER" as const },
  { userId: "c", role: "CHAIRMAN" as const },
  { userId: "p1", role: "PANELIST" as const },
  { userId: "p2", role: "PANELIST" as const },
  { userId: "p3", role: "PANELIST" as const },
  { userId: "p4", role: "PANELIST" as const },
  { userId: "f", role: "FACILITATOR" as const },
  { userId: "r", role: "RAPPORTEUR" as const },
];

describe("session totals + stage-specific policy config", () => {
  it("maps program type to session total", () => {
    expect(getSessionTotal("MASTERS")).toBe(7);
    expect(getSessionTotal("DOCTORAL")).toBe(8);
    expect(getSessionTotal("UNKNOWN")).toBe(null);
  });

  it("exposes confirmed stage-specific panelist quotas and adviser mode", () => {
    const titleM = policy.getPolicy("TITLE_DEFENSE", "MASTERS");
    expect(titleM.sessionTotal).toBe(7);
    expect(titleM.panelistCount).toBe(4);
    expect(titleM.adviserMode).toBe("NONE");
    expect(titleM.manualSelectionCount).toBe(7);

    const titleD = policy.getPolicy("TITLE_DEFENSE", "DOCTORAL");
    expect(titleD.sessionTotal).toBe(8);
    expect(titleD.panelistCount).toBe(5);
    expect(titleD.adviserMode).toBe("NONE");
    expect(titleD.manualSelectionCount).toBe(8);

    const propM = policy.getPolicy("PROPOSAL_DEFENSE", "MASTERS");
    expect(propM.sessionTotal).toBe(7);
    expect(propM.panelistCount).toBe(3);
    expect(propM.adviserMode).toBe("AUTOMATIC");
    expect(propM.manualSelectionCount).toBe(6);

    const finD = policy.getPolicy("FINAL_DEFENSE", "DOCTORAL");
    expect(finD.sessionTotal).toBe(8);
    expect(finD.panelistCount).toBe(4);
    expect(finD.adviserMode).toBe("AUTOMATIC");
    expect(finD.manualSelectionCount).toBe(7);
  });
});

describe("Title Defense validation (no Adviser)", () => {
  it("accepts complete Title Master's (7) and Doctoral (8)", () => {
    expect(
      policy.validateAssignments("TITLE_DEFENSE", "MASTERS", titleMasters())
        .valid,
    ).toBe(true);
    expect(
      policy.validateAssignments("TITLE_DEFENSE", "DOCTORAL", titleDoctoral())
        .valid,
    ).toBe(true);
  });

  it("rejects a Title roster with the wrong Panelist count", () => {
    const shortPanelists = [
      { userId: "c", role: "CHAIRMAN" as const },
      { userId: "p1", role: "PANELIST" as const },
      { userId: "p2", role: "PANELIST" as const },
      { userId: "p3", role: "PANELIST" as const },
      { userId: "f", role: "FACILITATOR" as const },
      { userId: "r", role: "RAPPORTEUR" as const },
    ]; // 3 panelists (needs 4)
    const result = policy.validateAssignments(
      "TITLE_DEFENSE",
      "MASTERS",
      shortPanelists,
    );
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/PANELIST/i);
  });

  it("rejects a Title Defense ADVISER seat", () => {
    const roster = [
      { userId: "adv", role: "ADVISER" as const },
      ...titleMasters().slice(0, 6),
    ];
    const result = policy.validateAssignments(
      "TITLE_DEFENSE",
      "MASTERS",
      roster,
    );
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/ADVISER/i);
  });

  it("does not auto-add or require an Adviser seat at Title even when one is active", () => {
    const result = policy.validateAssignments(
      "TITLE_DEFENSE",
      "MASTERS",
      titleMasters(),
      { adviserUserId: "active-adviser" },
    );
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(policy.getPolicy("TITLE_DEFENSE", "MASTERS").adviserMode).toBe("NONE");
  });
});

describe("Proposal/Final validation (automatic active Adviser)", () => {
  it("accepts Proposal Master's (7) with the active adviser", () => {
    const result = policy.validateAssignments(
      "PROPOSAL_DEFENSE",
      "MASTERS",
      proposalMasters("adv"),
      { adviserUserId: "adv" },
    );
    expect(result.valid).toBe(true);
  });

  it("accepts Final Doctoral (8) with the active adviser", () => {
    const result = policy.validateAssignments(
      "FINAL_DEFENSE",
      "DOCTORAL",
      proposalDoctoral("adv"),
      { adviserUserId: "adv" },
    );
    expect(result.valid).toBe(true);
  });

  it("rejects Proposal/Final without an ADVISER seat", () => {
    const result = policy.validateAssignments(
      "PROPOSAL_DEFENSE",
      "MASTERS",
      titleMasters(), // chair + 4 panelists + fac + rap, no adviser
      { adviserUserId: "adv" },
    );
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/ADVISER/i);
  });

  it("rejects an ADVISER seat that is not the student's active adviser", () => {
    const result = policy.validateAssignments(
      "PROPOSAL_DEFENSE",
      "MASTERS",
      proposalMasters("wrong"),
      { adviserUserId: "real-adviser" },
    );
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/active thesis adviser/i);
  });

  it("rejects Proposal/Final when there is no active adviser relationship", () => {
    const result = policy.validateAssignments(
      "PROPOSAL_DEFENSE",
      "MASTERS",
      proposalMasters("adv"),
      { adviserUserId: null },
    );
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/active thesis adviser/i);
  });
});

describe("shared invariants", () => {
  it("rejects unknown program type", () => {
    const result = policy.validateAssignments(
      "TITLE_DEFENSE",
      "UNKNOWN",
      titleMasters(),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/program type/i);
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

  it("rejects double Facilitator / Rapporteur", () => {
    const twoFac = policy.validateAssignments("TITLE_DEFENSE", "MASTERS", [
      { userId: "c", role: "CHAIRMAN" },
      { userId: "p1", role: "PANELIST" },
      { userId: "p2", role: "PANELIST" },
      { userId: "p3", role: "PANELIST" },
      { userId: "p4", role: "PANELIST" },
      { userId: "f", role: "FACILITATOR" },
      { userId: "f2", role: "FACILITATOR" },
    ]);
    expect(twoFac.valid).toBe(false);
    expect(twoFac.errors.join(" ")).toMatch(/FACILITATOR/i);
  });
});

describe("DefenseCommitteePolicy role/evaluator helpers", () => {
  it("allows CHAIRMAN/PANELIST/FACILITATOR/RAPPORTEUR at Title but not ADVISER", () => {
    expect(policy.isRoleAllowed("TITLE_DEFENSE", "CHAIRMAN")).toBe(true);
    expect(policy.isRoleAllowed("TITLE_DEFENSE", "PANELIST")).toBe(true);
    expect(policy.isRoleAllowed("TITLE_DEFENSE", "FACILITATOR")).toBe(true);
    expect(policy.isRoleAllowed("TITLE_DEFENSE", "RAPPORTEUR")).toBe(true);
    expect(policy.isRoleAllowed("TITLE_DEFENSE", "ADVISER")).toBe(false);
  });

  it("allows ADVISER at Proposal/Final", () => {
    expect(policy.isRoleAllowed("PROPOSAL_DEFENSE", "ADVISER")).toBe(true);
    expect(policy.isRoleAllowed("FINAL_DEFENSE", "ADVISER")).toBe(true);
  });

  it("treats CHAIRMAN and PANELIST as evaluators; Adviser/Facilitator/Rapporteur are not", () => {
    expect(policy.isEvaluatorRole("PROPOSAL_DEFENSE", "CHAIRMAN")).toBe(true);
    expect(policy.isEvaluatorRole("PROPOSAL_DEFENSE", "PANELIST")).toBe(true);
    expect(policy.isEvaluatorRole("PROPOSAL_DEFENSE", "ADVISER")).toBe(false);
    expect(policy.isEvaluatorRole("PROPOSAL_DEFENSE", "FACILITATOR")).toBe(
      false,
    );
    expect(policy.getEvaluatorRoles("FINAL_DEFENSE")).toEqual([
      "CHAIRMAN",
      "PANELIST",
    ]);
  });
});
