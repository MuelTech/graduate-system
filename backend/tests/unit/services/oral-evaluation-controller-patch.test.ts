import { beforeEach, describe, expect, it, vi } from "vitest";

const saveDraft = vi.fn();
const finalize = vi.fn();
const getMyEvaluation = vi.fn();

vi.mock("../../../src/services/oral-evaluation.service", () => {
  class OralEvaluationService {
    saveDraft = saveDraft;
    finalize = finalize;
    getMyEvaluation = getMyEvaluation;
  }
  return { OralEvaluationService };
});
vi.mock("../../../src/services/thesis.service", () => ({
  ThesisService: class {
    constructor() {}
  },
}));
vi.mock("../../../src/services/student-thesis-journey.service", () => ({
  StudentThesisJourneyService: class {
    constructor() {}
  },
}));
vi.mock("../../../src/services/proposal-adviser-review.service", () => ({
  ProposalAdviserReviewService: class {
    constructor() {}
  },
}));
vi.mock("../../../src/services/final-adviser-review.service", () => ({
  FinalAdviserReviewService: class {
    constructor() {}
  },
}));

import { ThesisController } from "../../../src/controllers/thesis.controller";

describe("CP5-FIX2 controller PATCH property presence", () => {
  const controller = new ThesisController();
  let res: any;

  beforeEach(() => {
    vi.clearAllMocks();
    res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    saveDraft.mockResolvedValue({ ok: true });
    finalize.mockResolvedValue({ ok: true });
  });

  it("Test 1: omitted rating/recommendations stay absent", async () => {
    const req: any = {
      user: { userId: "user-a" },
      params: { scheduleId: "sched-1" },
      body: { criteria: { attitude: 9 } },
    };
    await controller.saveOralEvaluationDraft(req, res);
    expect(saveDraft).toHaveBeenCalledTimes(1);
    const input = saveDraft.mock.calls[0][2];
    expect(input.criteria.attitude).toBe(9);
    expect(Object.prototype.hasOwnProperty.call(input, "rating")).toBe(false);
    expect(
      Object.prototype.hasOwnProperty.call(input, "recommendations"),
    ).toBe(false);
  });

  it("Test 2: explicit null rating/recommendations are preserved", async () => {
    const req: any = {
      user: { userId: "user-a" },
      params: { scheduleId: "sched-1" },
      body: {
        criteria: { attitude: 9 },
        rating: null,
        recommendations: null,
      },
    };
    await controller.saveOralEvaluationDraft(req, res);
    const input = saveDraft.mock.calls[0][2];
    expect(Object.prototype.hasOwnProperty.call(input, "rating")).toBe(true);
    expect(input.rating).toBeNull();
    expect(
      Object.prototype.hasOwnProperty.call(input, "recommendations"),
    ).toBe(true);
    expect(input.recommendations).toBeNull();
  });

  it("finalize also preserves absent optional fields", async () => {
    const req: any = {
      user: { userId: "user-a" },
      params: { scheduleId: "sched-1" },
      body: { signatureData: "sig" },
    };
    await controller.finalizeOralEvaluation(req, res);
    const input = finalize.mock.calls[0][2];
    expect(input.signatureData).toBe("sig");
    expect(Object.prototype.hasOwnProperty.call(input, "rating")).toBe(false);
    expect(
      Object.prototype.hasOwnProperty.call(input, "recommendations"),
    ).toBe(false);
  });
});
