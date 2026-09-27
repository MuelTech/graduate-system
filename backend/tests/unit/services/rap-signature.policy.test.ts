import { describe, expect, it } from "vitest";
import {
  RAP_REQUIRED_SIGNER_ROLES,
  RAP_SIGNATURE_POLICY_MODE,
  isRapReadyToFinalize,
  rapStatusAfterSignatures,
  resolveRapSignatureRequirements,
} from "../../../src/services/rap-signature.policy";

describe("CP7 RAP signature policy (evaluator signatories)", () => {
  it("uses evaluator-role signatories (not all participants)", () => {
    expect(RAP_SIGNATURE_POLICY_MODE).toBe("EVALUATOR_SIGNATORIES");
    expect(RAP_REQUIRED_SIGNER_ROLES).toEqual(["CHAIRMAN", "PANELIST"]);
  });

  it("Test 21/23: Proposal/Final slots = actual evaluators only (no Facilitator/Rapporteur/Adviser)", () => {
    const slots = resolveRapSignatureRequirements(
      [
        { userId: "chair", role: "CHAIRMAN" },
        { userId: "p1", role: "PANELIST" },
        { userId: "f", role: "FACILITATOR" },
        { userId: "r", role: "RAPPORTEUR" },
        { userId: "a", role: "ADVISER" },
      ],
      "PROPOSAL_DEFENSE",
    );
    expect(slots).toHaveLength(2);
    expect(slots.map((s) => s.userId).sort()).toEqual(["chair", "p1"]);
    expect(slots.every((s) => s.required)).toBe(true);
    expect(slots.find((s) => s.userId === "f")).toBeUndefined();
    expect(slots.find((s) => s.userId === "r")).toBeUndefined();
    expect(slots.find((s) => s.userId === "a")).toBeUndefined();
  });

  it("Test 22: Title RAP slots contain CHAIRMAN/PANELIST only", () => {
    const slots = resolveRapSignatureRequirements(
      [
        { userId: "chair", role: "CHAIRMAN" },
        { userId: "p1", role: "PANELIST" },
        { userId: "p2", role: "PANELIST" },
        { userId: "f", role: "FACILITATOR" },
        { userId: "r", role: "RAPPORTEUR" },
      ],
      "TITLE_DEFENSE",
    );
    expect(slots).toHaveLength(3);
    expect(slots.every((s) => ["CHAIRMAN", "PANELIST"].includes(s.roleAtDefense))).toBe(
      true,
    );
  });

  it("Test 23: first required signature → FOR_SIGNATURE → PARTIALLY_SIGNED", () => {
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

  it("Test 24: last required signature → FINALIZED", () => {
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
