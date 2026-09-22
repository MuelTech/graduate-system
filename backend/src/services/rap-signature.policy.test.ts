import { describe, expect, it } from "vitest";
import {
  RAP_SIGNATURE_POLICY_MODE,
  isRapReadyToFinalize,
  rapStatusAfterSignatures,
  resolveRapSignatureRequirements,
} from "./rap-signature.policy";

describe("RAP signature policy (interim)", () => {
  it("marks policy as interim all-participants (form sets UNRESOLVED)", () => {
    expect(RAP_SIGNATURE_POLICY_MODE).toBe("INTERIM_ALL_PARTICIPANTS");
  });

  it("creates a required slot per assigned participant with role metadata", () => {
    const slots = resolveRapSignatureRequirements([
      { userId: "a", role: "CHAIRMAN" },
      { userId: "b", role: "PANELIST" },
      { userId: "f", role: "FACILITATOR" },
      { userId: "r", role: "RAPPORTEUR" },
    ]);
    expect(slots).toHaveLength(4);
    expect(slots.every((s) => s.required)).toBe(true);
    expect(slots.find((s) => s.userId === "f")?.roleAtDefense).toBe(
      "FACILITATOR",
    );
  });

  it("progresses RAP status from signatures", () => {
    const all = [
      { required: true, isSigned: false },
      { required: true, isSigned: false },
    ];
    expect(rapStatusAfterSignatures(all)).toBe("FOR_SIGNATURE");

    expect(
      rapStatusAfterSignatures([
        { required: true, isSigned: true },
        { required: true, isSigned: false },
      ]),
    ).toBe("PARTIALLY_SIGNED");

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
