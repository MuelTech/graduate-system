import { Response } from "express";
import { EmailStatus } from "@prisma/client";
import prisma from "../config/database";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { EmailRepository } from "../repositories/email.repository";
import { EmailService } from "../services/email.service";
import {
  EMAIL_TEMPLATE_REGISTRY,
  getTemplateDefinition,
} from "../config/email-templates.registry";
import { isEmailWorkerRunning } from "../workers/email.worker";
import { runExamReminder24hCheck } from "../workers/cron.worker";
import { EXAM_SCHEDULE_TIMEZONE } from "../services/exam-schedule-time";

const emailRepository = new EmailRepository();

const VALID_STATUSES = new Set<string>(["QUEUED", "PROCESSING", "SENT", "FAILED"]);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const emailController = {
  // GET /api/admin/emails/health
  async getHealth(_req: AuthenticatedRequest, res: Response) {
    try {
      const [stats] = await Promise.all([emailRepository.getDeliveryStats()]);
      res.status(200).json({
        health: EmailService.getDeliveryHealth(isEmailWorkerRunning()),
        stats,
      });
    } catch (error: unknown) {
      console.error("[EmailController] Failed to fetch email health:", error);
      res.status(500).json({ error: "Failed to fetch email delivery health." });
    }
  },

  // POST /api/admin/emails/verify-smtp
  async verifySmtp(_req: AuthenticatedRequest, res: Response) {
    try {
      const result = await EmailService.verifySmtpConnection();
      res.status(200).json(result);
    } catch (error: unknown) {
      console.error("[EmailController] SMTP verification error:", error);
      res.status(500).json({ error: "Failed to verify SMTP connection." });
    }
  },

  // POST /api/admin/emails/test
  async sendTestEmail(req: AuthenticatedRequest, res: Response) {
    try {
      const to = String(req.body?.to ?? "").trim();
      const templateKey = req.body?.templateKey
        ? String(req.body.templateKey).trim()
        : undefined;

      if (!to || !EMAIL_PATTERN.test(to)) {
        res.status(400).json({ error: "Please enter a valid recipient email address." });
        return;
      }
      if (templateKey && !getTemplateDefinition(templateKey)) {
        res.status(404).json({ error: "Selected email template was not found." });
        return;
      }

      const result = await EmailService.sendTestEmail({
        to,
        templateKey,
        triggeredById: req.user!.userId,
      });
      res.status(200).json(result);
    } catch (error: unknown) {
      console.error("[EmailController] Failed to send test email:", error);
      res.status(500).json({
        error:
          error instanceof Error ? error.message : "Failed to send test email.",
      });
    }
  },

  // GET /api/admin/emails/logs (and legacy /api/admin/email-logs/logs)
  async getEmailLogs(req: AuthenticatedRequest, res: Response) {
    try {
      const page = parseInt(String(req.query.page ?? "1"), 10) || 1;
      const limit = parseInt(String(req.query.limit ?? "20"), 10) || 20;
      const rawStatus = req.query.status
        ? String(req.query.status).trim().toUpperCase()
        : undefined;
      const status =
        rawStatus && VALID_STATUSES.has(rawStatus)
          ? (rawStatus as EmailStatus)
          : undefined;
      const category = req.query.category
        ? String(req.query.category).trim().toUpperCase()
        : undefined;
      const templateKey = req.query.templateKey
        ? String(req.query.templateKey).trim()
        : undefined;
      const batchId = req.query.batchId
        ? String(req.query.batchId).trim()
        : undefined;
      const search = req.query.search
        ? String(req.query.search).trim()
        : undefined;

      const [result, stats] = await Promise.all([
        emailRepository.getFilteredPaginatedLogs({
          page,
          limit,
          status,
          category,
          templateKey,
          batchId,
          search,
        }),
        emailRepository.getDeliveryStats(),
      ]);

      res.status(200).json({
        ...result,
        stats,
      });
    } catch (error: unknown) {
      console.error("[EmailController] Failed to fetch email logs:", error);
      res.status(500).json({ error: "Failed to fetch email logs." });
    }
  },

  // GET /api/admin/emails/logs/:id
  async getEmailLogDetail(req: AuthenticatedRequest, res: Response) {
    try {
      const id = String(req.params.id ?? "").trim();
      const log = await emailRepository.getLogById(id);
      if (!log) {
        res.status(404).json({ error: "Email delivery log not found." });
        return;
      }
      const def = log.templateKey
        ? getTemplateDefinition(log.templateKey)
        : undefined;
      res.status(200).json({
        ...log,
        templateName: def?.name ?? (log.category === "SYSTEM_TEST" ? "System Test Email" : log.templateKey),
      });
    } catch (error: unknown) {
      console.error("[EmailController] Failed to fetch log detail:", error);
      res.status(500).json({ error: "Failed to fetch email log details." });
    }
  },

  // POST /api/admin/emails/logs/:id/retry
  async retryEmailLog(req: AuthenticatedRequest, res: Response) {
    try {
      const id = String(req.params.id ?? "").trim();
      const outcome = await emailRepository.retryLog(id);
      if (!outcome) {
        res.status(404).json({ error: "Email delivery log not found." });
        return;
      }
      if ("error" in outcome) {
        res.status(409).json({ error: outcome.error });
        return;
      }
      res.status(200).json({
        message: "Failed email re-queued for delivery.",
        log: outcome.log,
      });
    } catch (error: unknown) {
      console.error("[EmailController] Failed to retry email log:", error);
      res.status(500).json({ error: "Failed to re-queue email." });
    }
  },

  // POST /api/admin/emails/logs/retry-failed
  async retryAllFailed(req: AuthenticatedRequest, res: Response) {
    try {
      const category = req.body?.category
        ? String(req.body.category).trim().toUpperCase()
        : undefined;
      const templateKey = req.body?.templateKey
        ? String(req.body.templateKey).trim()
        : undefined;

      const count = await emailRepository.retryAllFailed({
        category,
        templateKey,
      });

      res.status(200).json({
        message:
          count > 0
            ? `${count} failed email${count === 1 ? "" : "s"} re-queued for delivery.`
            : "No failed emails available to retry.",
        requeuedCount: count,
      });
    } catch (error: unknown) {
      console.error("[EmailController] Failed to bulk retry emails:", error);
      res.status(500).json({ error: "Failed to retry failed emails." });
    }
  },

  // GET /api/admin/emails/templates
  async listTemplates(_req: AuthenticatedRequest, res: Response) {
    try {
      const dbTemplates = await emailRepository.getAllTemplates();
      const dbMap = new Map(dbTemplates.map((t) => [t.templateKey, t]));

      const templates = EMAIL_TEMPLATE_REGISTRY.map((def) => {
        const db = dbMap.get(def.templateKey);
        const subject = db?.subject ?? def.defaultSubject;
        const bodyHtml = db?.bodyHtml ?? def.defaultBodyHtml;
        const isActive = db?.isActive ?? true;
        const isCustomized =
          Boolean(db) &&
          (subject !== def.defaultSubject || bodyHtml !== def.defaultBodyHtml);

        return {
          templateKey: def.templateKey,
          name: def.name,
          category: def.category,
          categoryLabel: def.categoryLabel,
          triggerEvent: def.triggerEvent,
          recipientRole: def.recipientRole,
          variables: def.variables,
          subject,
          bodyHtml,
          isActive,
          isCustomized,
          updatedAt: db?.updatedAt ?? null,
        };
      });

      res.status(200).json({ templates });
    } catch (error: unknown) {
      console.error("[EmailController] Failed to list templates:", error);
      res.status(500).json({ error: "Failed to load email templates." });
    }
  },

  // PUT /api/admin/emails/templates/:key
  async updateTemplate(req: AuthenticatedRequest, res: Response) {
    try {
      const templateKey = String(req.params.key ?? "").trim();
      const def = getTemplateDefinition(templateKey);
      if (!def) {
        res.status(404).json({ error: "Email template not found." });
        return;
      }

      const subject =
        req.body?.subject !== undefined
          ? String(req.body.subject).trim()
          : undefined;
      const bodyHtml =
        req.body?.bodyHtml !== undefined ? String(req.body.bodyHtml) : undefined;
      const isActive =
        typeof req.body?.isActive === "boolean" ? req.body.isActive : undefined;

      if (subject !== undefined && subject.length === 0) {
        res.status(400).json({ error: "Subject cannot be empty." });
        return;
      }
      if (bodyHtml !== undefined && bodyHtml.trim().length === 0) {
        res.status(400).json({ error: "Email body cannot be empty." });
        return;
      }
      if (subject === undefined && bodyHtml === undefined && isActive === undefined) {
        res.status(400).json({ error: "No template changes were provided." });
        return;
      }

      // Verify Handlebars syntax before saving
      try {
        await EmailService.renderTemplatePreview(templateKey, {
          subject,
          bodyHtml,
        });
      } catch (compileError: unknown) {
        res.status(400).json({
          error: `Template syntax error: ${
            compileError instanceof Error ? compileError.message : "Invalid template"
          }`,
        });
        return;
      }

      const updated = await emailRepository.updateTemplate(
        templateKey,
        { subject, bodyHtml, isActive },
        req.user!.userId,
      );

      await prisma.auditLog
        .create({
          data: {
            actorId: req.user!.userId,
            actionType: "EMAIL_TEMPLATE_UPDATED",
            targetTable: "email_templates",
            targetId: updated.id,
            description: `Updated email template "${def.name}" (${templateKey})${
              isActive !== undefined ? ` — ${isActive ? "Active" : "Paused"}` : ""
            }.`,
          },
        })
        .catch(() => {});

      res.status(200).json({
        message: "Email template saved.",
        template: {
          templateKey: def.templateKey,
          name: def.name,
          category: def.category,
          categoryLabel: def.categoryLabel,
          triggerEvent: def.triggerEvent,
          recipientRole: def.recipientRole,
          variables: def.variables,
          subject: updated.subject,
          bodyHtml: updated.bodyHtml,
          isActive: updated.isActive,
          isCustomized:
            updated.subject !== def.defaultSubject ||
            updated.bodyHtml !== def.defaultBodyHtml,
          updatedAt: updated.updatedAt,
        },
      });
    } catch (error: unknown) {
      console.error("[EmailController] Failed to update template:", error);
      res.status(500).json({ error: "Failed to save email template." });
    }
  },

  // POST /api/admin/emails/templates/:key/preview
  async previewTemplate(req: AuthenticatedRequest, res: Response) {
    try {
      const templateKey = String(req.params.key ?? "").trim();
      if (!getTemplateDefinition(templateKey)) {
        res.status(404).json({ error: "Email template not found." });
        return;
      }

      const rendered = await EmailService.renderTemplatePreview(templateKey, {
        subject:
          typeof req.body?.subject === "string" ? req.body.subject : undefined,
        bodyHtml:
          typeof req.body?.bodyHtml === "string" ? req.body.bodyHtml : undefined,
      });

      res.status(200).json(rendered);
    } catch (error: unknown) {
      res.status(400).json({
        error:
          error instanceof Error
            ? `Preview failed: ${error.message}`
            : "Failed to render template preview.",
      });
    }
  },

  // POST /api/admin/emails/templates/:key/reset
  async resetTemplate(req: AuthenticatedRequest, res: Response) {
    try {
      const templateKey = String(req.params.key ?? "").trim();
      const def = getTemplateDefinition(templateKey);
      if (!def) {
        res.status(404).json({ error: "Email template not found." });
        return;
      }

      const updated = await emailRepository.updateTemplate(
        templateKey,
        {
          subject: def.defaultSubject,
          bodyHtml: def.defaultBodyHtml,
        },
        req.user!.userId,
      );

      await prisma.auditLog
        .create({
          data: {
            actorId: req.user!.userId,
            actionType: "EMAIL_TEMPLATE_RESET",
            targetTable: "email_templates",
            targetId: updated.id,
            description: `Reset email template "${def.name}" (${templateKey}) to institutional default.`,
          },
        })
        .catch(() => {});

      res.status(200).json({
        message: "Template restored to institutional default.",
        template: {
          templateKey: def.templateKey,
          name: def.name,
          category: def.category,
          categoryLabel: def.categoryLabel,
          triggerEvent: def.triggerEvent,
          recipientRole: def.recipientRole,
          variables: def.variables,
          subject: updated.subject,
          bodyHtml: updated.bodyHtml,
          isActive: updated.isActive,
          isCustomized: false,
          updatedAt: updated.updatedAt,
        },
      });
    } catch (error: unknown) {
      console.error("[EmailController] Failed to reset template:", error);
      res.status(500).json({ error: "Failed to reset email template." });
    }
  },

  // GET /api/admin/emails/triggers
  async listAutomatedTriggers(_req: AuthenticatedRequest, res: Response) {
    try {
      const dbTemplates = await emailRepository.getAllTemplates();
      const activeMap = new Map(
        dbTemplates.map((t) => [t.templateKey, t.isActive]),
      );

      const triggers = EMAIL_TEMPLATE_REGISTRY.map((def) => ({
        templateKey: def.templateKey,
        name: def.name,
        category: def.category,
        categoryLabel: def.categoryLabel,
        triggerEvent: def.triggerEvent,
        recipientRole: def.recipientRole,
        isActive: activeMap.get(def.templateKey) ?? true,
        deliveryType:
          def.templateKey === "exam_reminder_24h"
            ? "Scheduled Daily (8:00 AM Philippine Time)"
            : "Automatic Event-Driven",
      }));

      res.status(200).json({
        health: EmailService.getDeliveryHealth(isEmailWorkerRunning()),
        scheduledJobs: [
          {
            id: "exam_reminder_24h",
            name: "24-Hour Entrance Examination Reminder",
            cronExpression: "0 8 * * *",
            timezone: EXAM_SCHEDULE_TIMEZONE,
            scheduleDescription: "Runs daily at 8:00 AM (Philippine Time)",
            isActive: activeMap.get("exam_reminder_24h") ?? true,
          },
        ],
        triggers,
      });
    } catch (error: unknown) {
      console.error("[EmailController] Failed to load triggers:", error);
      res.status(500).json({ error: "Failed to load automated triggers." });
    }
  },

  // POST /api/admin/emails/triggers/run-exam-reminders
  async runExamRemindersNow(req: AuthenticatedRequest, res: Response) {
    try {
      const summary = await runExamReminder24hCheck(
        new Date(),
        req.user!.userId,
      );
      res.status(200).json({
        message:
          summary.queuedCount > 0
            ? `Queued ${summary.queuedCount} entrance examination reminder(s) for ${summary.targetDate}.`
            : `No unsent entrance examination reminders found for ${summary.targetDate}.`,
        summary,
      });
    } catch (error: unknown) {
      console.error("[EmailController] Manual exam reminder run failed:", error);
      res.status(500).json({ error: "Failed to run 24-hour reminder check." });
    }
  },
};
