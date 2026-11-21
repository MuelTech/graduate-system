import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  prismaMock,
  sendMailMock,
  verifyMock,
} = vi.hoisted(() => ({
  prismaMock: {
    emailTemplate: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
    emailLog: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
    entranceExamApplication: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
  sendMailMock: vi.fn(),
  verifyMock: vi.fn(),
}));

vi.mock("../../src/config/database", () => ({ default: prismaMock }));
vi.mock("nodemailer", () => ({
  default: {
    createTransport: vi.fn(() => ({
      sendMail: sendMailMock,
      verify: verifyMock,
    })),
  },
}));

import {
  EMAIL_TEMPLATE_REGISTRY,
  RETIRED_EMAIL_TEMPLATE_KEYS,
  getTemplateDefinition,
} from "../../src/config/email-templates.registry";
import {
  buildPortalUrl,
  htmlToPlainText,
  resolveAppPublicUrl,
  wrapEaristEmailHtml,
} from "../../src/services/email-layout";
import {
  EmailService,
  getEmailDeliveryMode,
  resetEmailTransporterForTests,
} from "../../src/services/email.service";
import {
  EmailRepository,
  computeNextRetryDelayMs,
} from "../../src/repositories/email.repository";
import { processDueEmailQueueBatch } from "../../src/workers/email.worker";
import { runExamReminder24hCheck } from "../../src/workers/cron.worker";

describe("Phase 1: Email Registry, Layout, MySQL Persistent Queue & Cron", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    resetEmailTransporterForTests();
    process.env = { ...originalEnv };
    delete process.env.APP_PUBLIC_URL;
    delete process.env.EMAIL_MODE;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe("Canonical Template Registry (22 templates / 4 cycles)", () => {
    it("contains exactly 22 active transactional templates with unique keys and excludes retired spam/redundant keys", () => {
      expect(EMAIL_TEMPLATE_REGISTRY).toHaveLength(22);
      const keys = EMAIL_TEMPLATE_REGISTRY.map((t) => t.templateKey);
      expect(new Set(keys).size).toBe(22);

      for (const retired of RETIRED_EMAIL_TEMPLATE_KEYS) {
        expect(keys).not.toContain(retired);
      }

      const categories = new Set(EMAIL_TEMPLATE_REGISTRY.map((t) => t.category));
      expect(Array.from(categories).sort()).toEqual([
        "ACADEMIC",
        "ACCOUNTS",
        "ADMISSIONS_EXAM",
        "THESIS_DEFENSE",
      ]);
    });

    it("enforces formal institutional formatting with no em-dashes or middots in any canonical template", () => {
      for (const tpl of EMAIL_TEMPLATE_REGISTRY) {
        expect(tpl.defaultSubject).not.toMatch(/[—·]/);
        expect(tpl.defaultBodyHtml).not.toMatch(/[—·]/);
        expect(tpl.defaultBodyHtml).not.toContain("&middot;");
      }
    });

    it("enforces policy-only wording for temporary passwords (never raw password variable)", () => {
      for (const key of [
        "faculty_account_created",
        "admin_account_created",
        "account_password_reset",
      ]) {
        const tpl = getTemplateDefinition(key);
        expect(tpl).toBeDefined();
        expect(tpl!.defaultBodyHtml).toContain("LAST NAME in ALL CAPS");
        expect(tpl!.variables).not.toContain("temp_password");
        expect(tpl!.variables).not.toContain("password");
      }
    });
  });

  describe("URL Resolution & Branded EARIST Layout", () => {
    it("resolves APP_PUBLIC_URL or first origin from comma-separated FRONTEND_URL", () => {
      process.env.FRONTEND_URL = "http://localhost:3000,http://127.0.0.1:3000";
      expect(resolveAppPublicUrl()).toBe("http://localhost:3000");
      expect(buildPortalUrl("/login")).toBe("http://localhost:3000/login");

      process.env.APP_PUBLIC_URL = "https://gsis.earist.edu.ph/";
      expect(resolveAppPublicUrl()).toBe("https://gsis.earist.edu.ph");
      expect(buildPortalUrl("student/journey")).toBe(
        "https://gsis.earist.edu.ph/student/journey",
      );
    });

    it("wraps email content in the institutional EARIST frame and strips cleanly to plain text", () => {
      const html = wrapEaristEmailHtml({
        categoryLabel: "Entrance Exam & COR",
        title: "Entrance Examination Schedule Confirmed",
        bodyHtml: "<p>Dear Maria Santos,</p><p>Your exam is confirmed.</p>",
        ctaLabel: "View Schedule",
        ctaUrl: "https://gsis.earist.edu.ph/applicant/schedule",
      });

      expect(html).toContain("Office of the Graduate School");
      expect(html).toContain("Respectfully,");
      expect(html).toContain("#8b1e1e");
      expect(html).toContain("View Schedule");
      expect(html).toContain("Nagtahan, Sampaloc, Manila");
      expect(html).not.toContain("&middot;");
      expect(html).not.toContain("localhost:3000/logo");

      const text = htmlToPlainText(html);
      expect(text).toContain("Dear Maria Santos,");
      expect(text).toContain("View Schedule");
      expect(text).not.toContain("<table");
    });
  });

  describe("EmailService — Subject/Body Compilation, Pausing & Idempotency", () => {
    it("compiles Handlebars variables in BOTH subject and body and enqueues durable QUEUED log in smtp mode", async () => {
      process.env.EMAIL_MODE = "smtp";
      prismaMock.emailTemplate.findUnique.mockResolvedValue({
        templateKey: "defense_schedule",
        subject: "{{defense_stage}} Defense {{schedule_action}} — {{defense_date}}",
        bodyHtml: "<p>Dear {{recipient_name}}, Venue: {{venue}}</p>",
        isActive: true,
      });
      prismaMock.emailLog.findUnique.mockResolvedValue(null);
      prismaMock.emailLog.create.mockResolvedValue({
        id: "log-1",
        status: "QUEUED",
      });

      const result = await EmailService.sendTemplateEmail(
        "student@inbox.testmail.app",
        "defense_schedule",
        {
          recipient_name: "Juan Dela Cruz",
          defense_stage: "Proposal",
          schedule_action: "Scheduled",
          defense_date: "December 5, 2026",
          defense_time: "2:00 PM",
          venue: "Room 301",
          portal_link: "http://localhost:3000/student/thesis/proposal-defense",
        },
        { idempotencyKey: "defense-sched-1" },
      );

      expect(result).toEqual({
        queued: true,
        deduplicated: false,
        logId: "log-1",
        mode: "smtp",
      });
      expect(prismaMock.emailLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            recipient: "student@inbox.testmail.app",
            subject: "Proposal Defense Scheduled — December 5, 2026",
            status: "QUEUED",
            idempotencyKey: "defense-sched-1",
            category: "THESIS_DEFENSE",
          }),
        }),
      );
      const createdHtml = prismaMock.emailLog.create.mock.calls[0][0].data.htmlBody;
      expect(createdHtml).toContain("Dear Juan Dela Cruz, Venue: Room 301");
      expect(createdHtml).toContain("Office of the Graduate School");
    });

    it("skips enqueueing when a template is paused (isActive = false)", async () => {
      process.env.EMAIL_MODE = "smtp";
      prismaMock.emailTemplate.findUnique.mockResolvedValue({
        templateKey: "exam_scheduled",
        subject: "Exam",
        bodyHtml: "<p>Hi</p>",
        isActive: false,
      });

      const res = await EmailService.sendTemplateEmail(
        "a@inbox.testmail.app",
        "exam_scheduled",
        { recipient_name: "Ana" },
      );

      expect(res.queued).toBe(false);
      expect(res.skipped).toBe(true);
      expect(res.reason).toBe("TEMPLATE_PAUSED");
      expect(prismaMock.emailLog.create).not.toHaveBeenCalled();
    });

    it("rejects retired spam/redundant templates cleanly", async () => {
      process.env.EMAIL_MODE = "smtp";
      const res = await EmailService.sendTemplateEmail(
        "a@inbox.testmail.app",
        "memo_broadcast",
        { recipient_name: "Ana" },
      );
      expect(res.queued).toBe(false);
      expect(res.reason).toBe("TEMPLATE_RETIRED");
    });

    it("deduplicates repeated idempotencyKey enqueues without inserting twice", async () => {
      process.env.EMAIL_MODE = "smtp";
      prismaMock.emailTemplate.findUnique.mockResolvedValue(null); // falls back to registry
      prismaMock.emailLog.findUnique.mockResolvedValue({
        id: "existing-log-99",
        status: "SENT",
      });

      const res = await EmailService.sendTemplateEmail(
        "applicant@inbox.testmail.app",
        "ecat_result_pass",
        { student_name: "Maria", portal_link: "http://localhost:3000/applicant/results" },
        { jobId: "exam-result-app1-score1-pass" },
      );

      expect(res.deduplicated).toBe(true);
      expect(res.logId).toBe("existing-log-99");
      expect(prismaMock.emailLog.create).not.toHaveBeenCalled();
    });

    it("defaults to disabled mode in Vitest unless EMAIL_MODE is explicitly set", () => {
      expect(getEmailDeliveryMode()).toBe("disabled");
    });
  });

  describe("MySQL EmailWorker — Claim, Send, Exponential Retry & Failure", () => {
    it("computes exponential backoff 30s -> 2m -> 10m", () => {
      expect(computeNextRetryDelayMs(1)).toBe(30_000);
      expect(computeNextRetryDelayMs(2)).toBe(120_000);
      expect(computeNextRetryDelayMs(3)).toBe(600_000);
    });

    it("claims due QUEUED logs, sends via SMTP, and marks SENT", async () => {
      process.env.EMAIL_MODE = "smtp";
      process.env.SMTP_HOST = "smtp.gmail.com";
      process.env.SMTP_PORT = "587";
      process.env.SMTP_USER = "gsis@earist.edu.ph";
      process.env.SMTP_PASS = "app-pass-1234";

      prismaMock.emailLog.findMany.mockResolvedValue([
        {
          id: "log-10",
          recipient: "faculty@inbox.testmail.app",
          subject: "Faculty Account Ready",
          htmlBody: "<p>Hello</p>",
          textBody: "Hello",
          status: "QUEUED",
          attemptCount: 0,
          maxAttempts: 3,
        },
      ]);
      prismaMock.emailLog.updateMany.mockResolvedValue({ count: 1 });
      sendMailMock.mockResolvedValue({ messageId: "<msg-1>" });
      prismaMock.emailLog.update.mockResolvedValue({ id: "log-10", status: "SENT" });

      const count = await processDueEmailQueueBatch(5, 2);

      expect(count).toBe(1);
      expect(sendMailMock).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "faculty@inbox.testmail.app",
          subject: "Faculty Account Ready",
        }),
      );
      expect(prismaMock.emailLog.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "log-10" },
          data: expect.objectContaining({ status: "SENT" }),
        }),
      );
    });

    it("re-queues with exponential backoff on transient failure and marks FAILED after maxAttempts", async () => {
      const repo = new EmailRepository();
      prismaMock.emailLog.update.mockResolvedValue({});

      const retryRes = await repo.scheduleRetryOrFail("log-a", 1, 3, "421 Try again later");
      expect(retryRes.finalStatus).toBe("QUEUED");
      expect(retryRes.nextAttemptAt).toBeInstanceOf(Date);

      const failRes = await repo.scheduleRetryOrFail("log-a", 3, 3, "550 Mailbox unavailable");
      expect(failRes.finalStatus).toBe("FAILED");
      expect(failRes.nextAttemptAt).toBeNull();
    });
  });

  describe("Daily 24h Entrance Exam Reminder Cron", () => {
    it("queries tomorrow's active PENDING unreleased exams, enqueues personalized reminders, and stamps reminder24hSentAt", async () => {
      process.env.EMAIL_MODE = "dry_run";
      prismaMock.entranceExamApplication.findMany.mockResolvedValue([
        {
          id: "app-101",
          examTime: new Date("1970-01-01T09:00:00.000Z"),
          program: { programName: "Master in Business Administration" },
          student: {
            user: {
              email: "maria@inbox.testmail.app",
              firstName: "Maria",
              lastName: "Santos",
              isActive: true,
            },
          },
        },
      ]);
      prismaMock.emailTemplate.findUnique.mockResolvedValue(null);
      prismaMock.emailLog.findUnique.mockResolvedValue(null);
      prismaMock.emailLog.create.mockResolvedValue({ id: "log-rem-1", status: "SENT" });
      prismaMock.entranceExamApplication.update.mockResolvedValue({});

      const summary = await runExamReminder24hCheck(
        new Date("2026-11-21T00:00:00.000Z"), // 08:00 Asia/Manila on 2026-11-21 -> tomorrow is 2026-11-22
      );

      expect(summary).toEqual({
        targetDate: "2026-11-22",
        matchedCount: 1,
        queuedCount: 1,
        skippedCount: 0,
      });
      expect(prismaMock.entranceExamApplication.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: "PENDING",
            seatReleasedAt: null,
            reminder24hSentAt: null,
          }),
        }),
      );
      expect(prismaMock.entranceExamApplication.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "app-101" },
          data: { reminder24hSentAt: expect.any(Date) },
        }),
      );
    });
  });
});
