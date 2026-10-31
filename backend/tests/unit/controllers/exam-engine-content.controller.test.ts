import type { Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthenticatedRequest } from "../../../src/middlewares/auth.middleware";
import { AppError } from "../../../src/utils/AppError";

const service = vi.hoisted(() => ({ createQuestion: vi.fn(), updateQuestion: vi.fn() }));
vi.mock("../../../src/config/database", () => ({ default: {} }));
vi.mock("../../../src/services/exam-engine.service", () => ({
  ExamEngineService: class {
    createQuestion = service.createQuestion;
    updateQuestion = service.updateQuestion;
  },
}));
import { ExamEngineController } from "../../../src/controllers/exam-engine.controller";

function response() {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  return res;
}
beforeEach(() => vi.resetAllMocks());

describe("question mutation HTTP boundary", () => {
  it.each([400, 404, 409])("returns operational update status %i", async status => {
    service.updateQuestion.mockRejectedValue(new AppError("Bounded error.", status));
    const res = response();
    await new ExamEngineController().updateQuestion({ params: { id: "q1" }, body: {} } as AuthenticatedRequest, res as unknown as Response);
    expect(res.status).toHaveBeenCalledWith(status);
    expect(res.json).toHaveBeenCalledWith({ error: "Bounded error." });
  });

  it("returns 400 for invalid creation instead of 500", async () => {
    service.createQuestion.mockRejectedValue(new AppError("Invalid question.", 400));
    const res = response();
    await new ExamEngineController().createQuestion({ body: {} } as AuthenticatedRequest, res as unknown as Response);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("does not expose internal errors", async () => {
    service.createQuestion.mockRejectedValue(new Error("/private/storage database details"));
    const res = response();
    await new ExamEngineController().createQuestion({ body: {} } as AuthenticatedRequest, res as unknown as Response);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Could not create question." });
  });

  it("returns Admin DTOs on successful creation/update", async () => {
    const dto = { id: "q1", options: [{ id: "opt1", isCorrect: true }] };
    service.createQuestion.mockResolvedValue(dto);
    service.updateQuestion.mockResolvedValue(dto);
    const controller = new ExamEngineController();
    const created = response();
    await controller.createQuestion({ body: {} } as AuthenticatedRequest, created as unknown as Response);
    expect(created.status).toHaveBeenCalledWith(201);
    expect(created.json).toHaveBeenCalledWith(dto);
    const updated = response();
    await controller.updateQuestion({ params: { id: "q1" }, body: {} } as AuthenticatedRequest, updated as unknown as Response);
    expect(updated.status).toHaveBeenCalledWith(200);
    expect(updated.json).toHaveBeenCalledWith(dto);
  });
});
