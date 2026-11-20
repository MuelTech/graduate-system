import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ template: vi.fn(), createLog: vi.fn(), compile: vi.fn() }));
vi.mock("../../../src/repositories/email.repository", () => ({
  EmailRepository: class {
    getTemplateByKey = mocks.template;
    createLog = mocks.createLog;
  },
}));
vi.mock("nodemailer", () => ({ default: { createTransport: () => ({}) } }));
vi.mock("handlebars", () => ({ default: { compile: mocks.compile } }));
import { EmailService } from "../../../src/services/email.service";

const originalMode = process.env.EMAIL_MODE;

beforeEach(() => {
  vi.resetAllMocks();
  process.env.EMAIL_MODE = "smtp";
  mocks.template.mockResolvedValue({
    subject: "Synthetic result",
    bodyHtml: "Synthetic template",
    isActive: true,
  });
  mocks.createLog.mockResolvedValue({ id: "log-1", status: "QUEUED", deduplicated: false });
  mocks.compile.mockReturnValue(() => "<p>Synthetic result</p>");
});

afterEach(() => {
  if (originalMode === undefined) delete process.env.EMAIL_MODE;
  else process.env.EMAIL_MODE = originalMode;
});

describe("B0B MySQL persistent email queue handoff", () => {
  it("preserves the exact B8 result job identity as durable idempotencyKey for deduplication", async () => {
    const options = { jobId: "exam-result-exact-identity" };
    await EmailService.sendTemplateEmail("owner@example.invalid", "ecat_result_pass", {}, options);
    expect(mocks.createLog).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        recipient: "owner@example.invalid",
        templateKey: "ecat_result_pass",
        status: "QUEUED",
        idempotencyKey: "exam-result-exact-identity",
      }),
    );
  });

  it.each(["ecat_result_pass", "ecat_result_fail"])(
    "awaits durable MySQL queue persistence for %s without claiming immediate delivery",
    async (template) => {
      await EmailService.sendTemplateEmail("owner@example.invalid", template, {
        student_name: "Synthetic",
        portal_link: "https://example.invalid",
      });
      expect(mocks.template).toHaveBeenCalledWith(template);
      expect(mocks.createLog).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          recipient: "owner@example.invalid",
          templateKey: template,
          status: "QUEUED",
        }),
      );
    },
  );

  it("rejects when the durable queue write rejects", async () => {
    mocks.createLog.mockRejectedValue(new Error("Synthetic queue failure"));
    await expect(
      EmailService.sendTemplateEmail("owner@example.invalid", "ecat_result_pass", {}),
    ).rejects.toThrow("Synthetic queue failure");
  });

  it("rejects unknown templates without queueing", async () => {
    mocks.template.mockResolvedValue(null);
    await expect(
      EmailService.sendTemplateEmail("owner@example.invalid", "nonexistent_template_xyz", {}),
    ).rejects.toThrow();
    expect(mocks.createLog).not.toHaveBeenCalled();
  });

  it("propagates template-rendering failure instead of falsely reporting a handoff", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      mocks.compile.mockReturnValue(() => {
        throw new Error("Synthetic template failure");
      });
      await expect(
        EmailService.sendTemplateEmail("owner@example.invalid", "ecat_result_fail", {}),
      ).rejects.toThrow("Synthetic template failure");
      expect(mocks.createLog).toHaveBeenCalledWith(
        expect.objectContaining({ status: "FAILED", templateKey: "ecat_result_fail" }),
      );
    } finally {
      log.mockRestore();
    }
  });
});
