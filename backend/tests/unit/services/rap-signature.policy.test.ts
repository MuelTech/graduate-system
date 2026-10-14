import { describe, expect, it } from "vitest";
import {
  RAP_SIGNATURE_POLICY_MODE,
  getRapSignatoryRoles,
  isRapReadyToFinalize,
  rapStatusAfterSignatures,
  resolveRapSignatureRequirements,
} from "../../../src/services/rap-signature.policy";
import { DefenseCommitteePolicy } from "../../../src/services/defense-committee.policy";

/**
 * RAP-1: RAP signatory policy is stage-aware and is NOT identical to numerical
 * evaluator authority. Canonical authority: Defense Workflow SOT §15.3.
 *
 * Title            = Chairman + Panelists + Rapporteur (no Adviser, no Facilitator)
 * Proposal / Final = Adviser + Chairman + Panelists + Rapporteur (no Facilitator)
 * Dean             = separate approving authority, never a committee signature slot.
 */
describe("RAP-1 stage-aware RAP signatory policy", () => {
  it("declares the stage/form-specific policy mode", () => {
    expect(RAP_SIGNATURE_POLICY_MODE).toBe("FORM_SPECIFIC");
  });

  it("Title RAP roles = CHAIRMAN + PANELIST + RAPPORTEUR", () => {
    expect(getRapSignatoryRoles("TITLE_DEFENSE")).toEqual([
      "CHAIRMAN",
      "PANELIST",
      "RAPPORTEUR",
    ]);
  });

  it("Proposal RAP roles = ADVISER + CHAIRMAN + PANELIST + RAPPORTEUR", () => {
    expect(getRapSignatoryRoles("PROPOSAL_DEFENSE")).toEqual([
      "ADVISER",
      "CHAIRMAN",
      "PANELIST",
      "RAPPORTEUR",
    ]);
  });

  it("Final RAP roles = same categories as Proposal", () => {
    expect(getRapSignatoryRoles("FINAL_DEFENSE")).toEqual(
      getRapSignatoryRoles("PROPOSAL_DEFENSE"),
    );
  });

  it("Title: Chairman + all actual Panelists + Rapporteur; no Adviser/Facilitator", () => {
    const slots = resolveRapSignatureRequirements(
      [
        { userId: "chair", role: "CHAIRMAN" },
        { userId: "p1", role: "PANELIST" },
        { userId: "p2", role: "PANELIST" },
        { userId: "p3", role: "PANELIST" },
        { userId: "f", role: "FACILITATOR" },
        { userId: "r", role: "RAPPORTEUR" },
      ],
      "TITLE_DEFENSE",
    );
    expect(slots.map((s) => s.userId).sort()).toEqual([
      "chair",
      "p1",
      "p2",
      "p3",
      "r",
    ]);
    expect(slots.every((s) => s.required)).toBe(true);
    expect(slots.find((s) => s.userId === "f")).toBeUndefined();
  });

  it("Title: a malformed legacy Adviser assignment is still excluded", () => {
    const slots = resolveRapSignatureRequirements(
      [
        { userId: "chair", role: "CHAIRMAN" },
        { userId: "r", role: "RAPPORTEUR" },
        { userId: "legacy-adviser", role: "ADVISER" },
      ],
      "TITLE_DEFENSE",
    );
    expect(slots.map((s) => s.userId).sort()).toEqual(["chair", "r"]);
    expect(slots.find((s) => s.userId === "legacy-adviser")).toBeUndefined();
  });

  it("Proposal: Adviser + Chairman + Panelists + Rapporteur; no Facilitator", () => {
    const slots = resolveRapSignatureRequirements(
      [
        { userId: "chair", role: "CHAIRMAN" },
        { userId: "p1", role: "PANELIST" },
        { userId: "p2", role: "PANELIST" },
        { userId: "f", role: "FACILITATOR" },
        { userId: "r", role: "RAPPORTEUR" },
        { userId: "a", role: "ADVISER" },
      ],
      "PROPOSAL_DEFENSE",
    );
    expect(slots.map((s) => s.userId).sort()).toEqual([
      "a",
      "chair",
      "p1",
      "p2",
      "r",
    ]);
    expect(slots.every((s) => s.required)).toBe(true);
    expect(slots.find((s) => s.userId === "f")).toBeUndefined();
  });

  it("Final: same signatory role categories as Proposal", () => {
    const slots = resolveRapSignatureRequirements(
      [
        { userId: "chair", role: "CHAIRMAN" },
        { userId: "p1", role: "PANELIST" },
        { userId: "f", role: "FACILITATOR" },
        { userId: "r", role: "RAPPORTEUR" },
        { userId: "a", role: "ADVISER" },
      ],
      "FINAL_DEFENSE",
    );
    expect(slots.map((s) => s.userId).sort()).toEqual([
      "a",
      "chair",
      "p1",
      "r",
    ]);
    expect(slots.find((s) => s.userId === "f")).toBeUndefined();
  });

  it("never creates a Dean signature slot", () => {
    const slots = resolveRapSignatureRequirements(
      [
        { userId: "chair", role: "CHAIRMAN" },
        { userId: "dean", role: "DEAN" },
      ],
      "FINAL_DEFENSE",
    );
    expect(slots.find((s) => s.userId === "dean")).toBeUndefined();
    expect(slots.every((s) => s.roleAtDefense !== "DEAN")).toBe(true);
  });

  it("de-duplicates repeated user slots defensively", () => {
    const slots = resolveRapSignatureRequirements(
      [
        { userId: "chair", role: "CHAIRMAN" },
        { userId: "chair", role: "CHAIRMAN" },
        { userId: "r", role: "RAPPORTEUR" },
      ],
      "TITLE_DEFENSE",
    );
    expect(slots.map((s) => s.userId).sort()).toEqual(["chair", "r"]);
  });

  it("RAP signatory roles remain separate from numerical evaluator authority", () => {
    const evaluators = new DefenseCommitteePolicy().getEvaluatorRoles(
      "PROPOSAL_DEFENSE",
    );
    expect(evaluators).toEqual(["CHAIRMAN", "PANELIST"]);
    // Adviser and Rapporteur sign the RAP but are not numerical evaluators.
    expect(evaluators).not.toContain("ADVISER");
    expect(evaluators).not.toContain("RAPPORTEUR");
  });

  it("first required signature → FOR_SIGNATURE → PARTIALLY_SIGNED", () => {
    expect(
      rapStatusAfterSignatures([
        { required: true, isSigned: false },
        { required: true, isSigned: false },
      ]),
    ).toBe("FOR_SIGNATURE");

    expect(
      rapStatusAfterSignatures([
        { required: true, isSigned: true },
        { required: true, isSigned: false },
      ]),
    ).toBe("PARTIALLY_SIGNED");
  });

  it("last required signature → FINALIZED", () => {
    expect(
      rapStatusAfterSignatures([
        { required: true, isSigned: true },
        { required: true, isSigned: true },
      ]),
    ).toBe("FINALIZED");
  });

  it("only required slots block finalization", () => {
    expect(
      isRapReadyToFinalize([
        { required: true, isSigned: true },
        { required: false, isSigned: false },
      ]),
    ).toBe(true);

    expect(
      isRapReadyToFinalize([
        { required: true, isSigned: true },
        { required: true, isSigned: false },
      ]),
    ).toBe(false);
  });
});
