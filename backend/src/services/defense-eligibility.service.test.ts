import { describe, expect, it } from "vitest";
import {
  DEFENSE_TYPE_STAGE,
  type MissingRequirement,
} from "../interfaces/defense-eligibility.interfaces";

describe("defense-eligibility interfaces", () => {
  it("maps defense types to thesis stages", () => {
    expect(DEFENSE_TYPE_STAGE.TITLE_DEFENSE).toBe("TITLE");
    expect(DEFENSE_TYPE_STAGE.PROPOSAL_DEFENSE).toBe("PROPOSAL");
    expect(DEFENSE_TYPE_STAGE.FINAL_DEFENSE).toBe("FINAL");
  });

  it("defines missing requirement shape", () => {
    const item: MissingRequirement = {
      code: "COMP_EXAM_PASSED",
      message: "Comprehensive Exam must be PASSED.",
      stage: "TITLE",
    };
    expect(item.code).toBe("COMP_EXAM_PASSED");
  });
});
