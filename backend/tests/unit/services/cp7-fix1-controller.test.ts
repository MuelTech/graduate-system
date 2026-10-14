import { beforeEach, describe, expect, it, vi } from "vitest";

const distributeRapReport = vi.fn();
const signRapReport = vi.fn();
const getOfficialCriteria = vi.fn();
const getOralExamSummaryRecord = vi.fn();

vi.mock("../../../src/services/thesis.service", () => ({
  ThesisService: class {
    distributeRapReport = distributeRapReport;
    signRapReport = signRapReport;
    getOfficialCriteria = getOfficialCriteria;
    getOralExamSummaryRecord = getOralExamSummaryRecord;
    getLobbyStatus = vi.fn();
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

vi.mock("../../../src/services/oral-evaluation.service", () => ({
  OralEvaluationService: class {
    constructor() {}
  },
}));

vi.mock("../../../src/services/defense-workspace.service", () => ({
  DefenseWorkspaceService: class {
    getWorkspace = vi.fn();
  },
}));

import { AppError } from "../../../src/utils/AppError";
import { ThesisController } from "../../../src/controllers/thesis.controller";

describe("CP7-FIX1 controller authority", () => {
  const controller = new ThesisController();
  let res: any;

  beforeEach(() => {
    vi.clearAllMocks();
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
  });

  it("Test 1: distribute returns 409 and never calls status mutation service", async () => {
    await controller.distributeRapReport(
      { params: { rapId: "rap-1" } } as any,
      res,
    );
    expect(res.status).toHaveBeenCalledWith(409);
    expect(distributeRapReport).not.toHaveBeenCalled();
  });

  it("Test 16: RAP signing preserves AppError status codes", async () => {
    const cases: Array<[string, number]> = [
      ["blank", 400],
      ["wrong user", 403],
      ["missing", 404],
      ["already signed", 409],
    ];
    for (const [kind, status] of cases) {
      signRapReport.mockRejectedValueOnce(new AppError(kind, status));
      res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
      };
      await controller.signRapReport(
        {
          user: { userId: "u1" },
          params: { sigId: "sig-1" },
          body: { signatureData: "data:image/png;base64,x" },
        } as any,
        res,
      );
      expect(res.status).toHaveBeenCalledWith(status);
    }
  });

  it("Test 8/9: Summary controller passes actor into service (auth enforced there)", async () => {
    getOralExamSummaryRecord.mockResolvedValue({ ready: true });
    await controller.getOralExamSummary(
      {
        user: { userId: "chair-1", role: "PANELIST" },
        params: { scheduleId: "sched-1" },
      } as any,
      res,
    );
    expect(getOralExamSummaryRecord).toHaveBeenCalledWith("sched-1", {
      userId: "chair-1",
      role: "PANELIST",
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("Test 8: STUDENT Summary is rejected by service 403", async () => {
    getOralExamSummaryRecord.mockRejectedValue(
      new AppError("restricted", 403),
    );
    await controller.getOralExamSummary(
      {
        user: { userId: "s1", role: "STUDENT" },
        params: { scheduleId: "sched-1" },
      } as any,
      res,
    );
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("Test 17: Criteria controller passes actor; 403 from service preserved", async () => {
    getOfficialCriteria.mockRejectedValue(
      new AppError("not allowed", 403),
    );
    await controller.getOfficialCriteria(
      {
        user: { userId: "intruder", role: "PANELIST" },
        params: { scheduleId: "s", panelAssignmentId: "p" },
      } as any,
      res,
    );
    expect(getOfficialCriteria).toHaveBeenCalledWith("s", "p", {
      userId: "intruder",
      role: "PANELIST",
    });
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
