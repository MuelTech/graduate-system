import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ template: vi.fn(), createLog: vi.fn(), queueAdd: vi.fn(), compile: vi.fn() }));
vi.mock("../../../src/repositories/email.repository", () => ({ EmailRepository: class { getTemplateByKey = mocks.template; createLog = mocks.createLog; } }));
vi.mock("bullmq", () => ({ Queue: class { add = mocks.queueAdd; } }));
vi.mock("ioredis", () => ({ default: class { on() {} } }));
vi.mock("nodemailer", () => ({ default: { createTransport: () => ({}) } }));
vi.mock("handlebars", () => ({ default: { compile: mocks.compile } }));
import { EmailService } from "../../../src/services/email.service";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.template.mockResolvedValue({ subject: "Synthetic result", bodyHtml: "Synthetic template" });
  mocks.compile.mockReturnValue(() => "<p>Synthetic result</p>");
});

describe("B0B existing email queue handoff", () => {
  it.each(["ecat_result_pass", "ecat_result_fail"])("awaits the queue handoff for %s without claiming delivery", async template => {
    await EmailService.sendTemplateEmail("owner@example.invalid", template, { student_name: "Synthetic", portal_link: "https://example.invalid" });
    expect(mocks.template).toHaveBeenCalledWith(template);
    expect(mocks.queueAdd).toHaveBeenCalledExactlyOnceWith("send-single-email", { to: "owner@example.invalid", subject: "Synthetic result", html: "<p>Synthetic result</p>", templateKey: template });
    expect(mocks.createLog).not.toHaveBeenCalled();
  });

  it("rejects when the queue rejects", async () => {
    mocks.queueAdd.mockRejectedValue(new Error("Synthetic queue failure"));
    await expect(EmailService.sendTemplateEmail("owner@example.invalid", "ecat_result_pass", {})).rejects.toThrow("Synthetic queue failure");
  });

  it("rejects missing templates without queueing", async () => {
    mocks.template.mockResolvedValue(null);
    await expect(EmailService.sendTemplateEmail("owner@example.invalid", "ecat_result_fail", {})).rejects.toThrow();
    expect(mocks.queueAdd).not.toHaveBeenCalled();
  });

  it("propagates template-rendering failure instead of falsely reporting a handoff", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      mocks.compile.mockReturnValue(() => { throw new Error("Synthetic template failure"); });
      await expect(EmailService.sendTemplateEmail("owner@example.invalid", "ecat_result_fail", {})).rejects.toThrow("Synthetic template failure");
      expect(mocks.queueAdd).not.toHaveBeenCalled();
      expect(mocks.createLog).toHaveBeenCalledWith(expect.objectContaining({ status: "FAILED", templateKey: "ecat_result_fail" }));
    } finally { log.mockRestore(); }
  });
});
