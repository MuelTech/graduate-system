import { beforeEach, describe, expect, it, vi } from "vitest";
const execution = vi.hoisted(() => ({ media: vi.fn() }));
vi.mock("../../../src/config/database", () => ({ default: {} }));
vi.mock("../../../src/repositories/exam-execution.repository", () => ({ ExamExecutionRepository: class { media = execution.media; } }));
import { ExamEngineService } from "../../../src/services/exam-engine.service";
beforeEach(() => vi.resetAllMocks());
describe("media delegates to exact B4 owned execution/content authority", () => {
  it("passes authenticated owner, exact application and requested media together", async () => {
    execution.media.mockResolvedValue("bound-revision");
    expect(await new ExamEngineService().assertApplicantQuestionAccess("jwt-user", "exact-app", "media-id")).toBe("bound-revision");
    expect(execution.media).toHaveBeenCalledWith("jwt-user", "exact-app", "media-id");
  });
  it.each(["unowned", "unstarted", "expired", "terminal", "legacy-unbound", "unrelated-media"])("retains %s denial without a live-bank fallback", async reason => {
    execution.media.mockRejectedValue(new Error(reason));
    await expect(new ExamEngineService().assertApplicantQuestionAccess("u", "a", "m")).rejects.toThrow(reason);
  });
});
