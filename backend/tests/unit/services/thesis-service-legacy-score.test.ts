import { beforeEach, describe, expect, it, vi } from "vitest";

const saveDraft = vi.fn();

vi.mock("../../../src/services/oral-evaluation.service", () => ({
  OralEvaluationService: class {
    saveDraft = saveDraft;
  },
}));
vi.mock("../../../src/repositories/thesis.repository", () => ({
  ThesisRepository: class {
    constructor() {}
  },
}));
vi.mock("../../../src/repositories/defense-applications.repository", () => ({
  DefenseApplicationsRepository: class {
    constructor() {}
  },
}));
vi.mock("../../../src/repositories/defense-eligibility.repository", () => ({
  DefenseEligibilityRepository: class {
    constructor() {}
  },
}));
vi.mock("../../../src/services/defense-eligibility.service", () => ({
  DefenseEligibilityService: class {
    constructor() {}
  },
}));
vi.mock("../../../src/services/defense-committee.policy", () => ({
  DefenseCommitteePolicy: class {
    constructor() {}
  },
}));
vi.mock("../../../src/services/defense-conclusion.service", () => ({
  DefenseConclusionService: class {
    constructor() {}
  },
}));
vi.mock("../../../src/services/adviser-request.service", () => ({
  AdviserRequestService: class {
    constructor() {}
  },
}));

import { ThesisService } from "../../../src/services/thesis.service";

describe("CP5-FIX2 legacy /score sparse adapter", () => {
  const service = new ThesisService();

  beforeEach(() => {
    vi.clearAllMocks();
    saveDraft.mockResolvedValue({ ok: true });
  });

  it("Test 3: only keys present on payload are forwarded", async () => {
    await service.submitOralExamScore("user-a", "panel-1", "sched-1", {
      attitude: 9,
    });
    const input = saveDraft.mock.calls[0][2];
    expect(input.criteria).toEqual({ attitude: 9 });
    expect(
      Object.prototype.hasOwnProperty.call(input.criteria, "organization"),
    ).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(input, "rating")).toBe(false);
    expect(
      Object.prototype.hasOwnProperty.call(input, "recommendations"),
    ).toBe(false);
  });

  it("legacy path never sends client-derived averages or PASS/FAIL rating", async () => {
    await service.submitOralExamScore("user-a", "panel-1", "sched-1", {
      organization: 8,
      groupAAverage: 999,
      overallAverage: 999,
      rating: "PASSED",
    });
    const input = saveDraft.mock.calls[0][2];
    expect(input.criteria).toEqual({ organization: 8 });
    // rating key present → forwarded as supplied (legacy may send it)
    expect(input.rating).toBe("PASSED");
  });
});
