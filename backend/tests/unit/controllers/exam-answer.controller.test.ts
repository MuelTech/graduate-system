import type { Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthenticatedRequest } from "../../../src/middlewares/auth.middleware";
import { AppError } from "../../../src/utils/AppError";

const service = vi.hoisted(() => ({ getApplicationIdForUser: vi.fn(), submitAnswers: vi.fn(), autoSaveAnswer: vi.fn() }));
vi.mock("../../../src/config/database", () => ({ default: {} }));
vi.mock("../../../src/services/exam-engine.service", () => ({ ExamEngineService: class {
  getApplicationIdForUser = service.getApplicationIdForUser;
  submitAnswers = service.submitAnswers;
  autoSaveAnswer = service.autoSaveAnswer;
} }));
import { ExamEngineController } from "../../../src/controllers/exam-engine.controller";

const questionId = "aaaaaaaa-1111-4111-8111-111111111111";
const selectedOptionId = "bbbbbbbb-2222-4222-8222-222222222222";
const controller = new ExamEngineController();
function res() {
  const value = { status: vi.fn(), json: vi.fn() };
  value.status.mockReturnValue(value);
  return value;
}
function req(body: unknown) { return { user: { userId: "jwt-user" }, body } as AuthenticatedRequest; }
beforeEach(() => {
  vi.resetAllMocks();
  service.getApplicationIdForUser.mockResolvedValue("owned-app");
});

describe("B0A Applicant request boundary", () => {
  it.each([undefined, null, [], {}, { answers: null }, { answers: {} }, { answers: "x" }, { answers: [null] }, { answers: [{ questionId }] }, { answers: [], applicationId: "foreign" }])("rejects malformed submit body %# before calling persistence", async body => {
    const response = res();
    await controller.submitAnswers(req(body), response as unknown as Response);
    expect(response.status).toHaveBeenCalledWith(400);
    expect(service.submitAnswers).not.toHaveBeenCalled();
    expect(service.getApplicationIdForUser).not.toHaveBeenCalled();
  });

  it.each([undefined, null, [], {}, { questionId }, { questionId: "bad", essayAnswer: "x" }, { questionId, essayAnswer: 1 }, { questionId, essayAnswer: null }, { questionId, essayAnswer: "x", selectedOptionId }])("rejects malformed/contradictory autosave body %#", async body => {
    const response = res();
    await controller.autoSaveAnswer(req(body), response as unknown as Response);
    expect(response.status).toHaveBeenCalledWith(400);
    expect(service.autoSaveAnswer).not.toHaveBeenCalled();
  });

  it("uses JWT-derived application identity and preserves the bounded response", async () => {
    const result = { success: true, mcqScore: 1 };
    service.submitAnswers.mockResolvedValue(result);
    const response = res();
    await controller.submitAnswers(req({ answers: [{ questionId, selectedOptionId }] }), response as unknown as Response);
    expect(service.getApplicationIdForUser).toHaveBeenCalledWith("jwt-user");
    expect(service.submitAnswers).toHaveBeenCalledWith("owned-app", [{ questionId, selectedOptionId }]);
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith(result);
  });

  it("accepts empty essay text without inventing completeness policy", async () => {
    const response = res();
    await controller.autoSaveAnswer(req({ questionId, essayAnswer: "" }), response as unknown as Response);
    expect(service.autoSaveAnswer).toHaveBeenCalledWith("owned-app", questionId, "");
    expect(response.json).toHaveBeenCalledWith({ success: true });
  });

  it.each(["submitAnswers", "autoSaveAnswer"] as const)("returns state conflicts and hides internal errors on %s", async method => {
    const body = method === "submitAnswers" ? { answers: [] } : { questionId, essayAnswer: "x" };
    service[method].mockRejectedValueOnce(new AppError("Answer writes are closed.", 409));
    const conflict = res();
    await controller[method](req(body), conflict as unknown as Response);
    expect(conflict.status).toHaveBeenCalledWith(409);
    service[method].mockRejectedValueOnce(new Error("private database/answer-key details"));
    const failure = res();
    await controller[method](req(body), failure as unknown as Response);
    expect(failure.status).toHaveBeenCalledWith(500);
    expect(JSON.stringify(failure.json.mock.calls)).not.toMatch(/private|answer-key|database/);
  });
});
