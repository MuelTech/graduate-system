import crypto from "crypto";
import nodemailer, { type Transporter } from "nodemailer";
import Handlebars from "handlebars";
import dotenv from "dotenv";
import { EmailRepository } from "../repositories/email.repository";
import {
  EMAIL_CATEGORY_LABELS,
  getTemplateDefinition,
  isRetiredTemplateKey,
  type EmailCategory,
} from "../config/email-templates.registry";
import {
  buildPortalUrl,
  htmlToPlainText,
  resolveAppPublicUrl,
  wrapEaristEmailHtml,
} from "./email-layout";

dotenv.config();

export type EmailDeliveryMode = "smtp" | "dry_run" | "disabled";

export interface SendTemplateEmailOptions {
  /** Backward-compatible alias for idempotencyKey (used by Exam B8 result email). */
  jobId?: string;
  idempotencyKey?: string;
  recipientName?: string;
  batchId?: string;
  triggeredById?: string;
  forceSend?: boolean;
  ctaLabel?: string;
  ctaUrl?: string;
  /** Kept for caller compatibility; unused by MySQL persistent queue. */
  removeOnComplete?: boolean;
  removeOnFail?: boolean;
}

export interface BatchRecipientItem {
  to: string;
  recipientName?: string;
  variables?: Record<string, string>;
  idempotencyKey?: string;
}

export interface EnqueueEmailResult {
  queued: boolean;
  skipped?: boolean;
  deduplicated?: boolean;
  reason?: string;
  logId?: string;
  mode: EmailDeliveryMode;
}

const emailRepository = new EmailRepository();

let cachedTransporter: Transporter | null = null;
let cachedTransporterKey = "";
let workerWakeHandler: (() => void) | null = null;

export function registerEmailWorkerWakeHandler(handler: (() => void) | null) {
  workerWakeHandler = handler;
}

function wakeWorkerIfRegistered() {
  if (workerWakeHandler) {
    try {
      workerWakeHandler();
    } catch {
      // Best-effort wakeup; safety poll will still pick up queued rows.
    }
  }
}

export function isSmtpConfigured(): boolean {
  const host = process.env.SMTP_HOST?.trim() || "";
  const user = process.env.SMTP_USER?.trim() || "";
  const pass = process.env.SMTP_PASS?.trim() || "";
  if (!host || !user || !pass) return false;
  if (user.startsWith("<") || pass.startsWith("<")) return false;
  return true;
}

export function getEmailDeliveryMode(): EmailDeliveryMode {
  const explicit = process.env.EMAIL_MODE?.trim().toLowerCase();
  if (explicit === "smtp" || explicit === "dry_run" || explicit === "disabled") {
    return explicit;
  }

  const isTestEnv =
    process.env.NODE_ENV === "test" || Boolean(process.env.VITEST);
  if (isTestEnv) return "disabled";

  return isSmtpConfigured() ? "smtp" : "dry_run";
}

function getSmtpTransporter(): Transporter {
  const host = process.env.SMTP_HOST?.trim() || "";
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER?.trim() || "";
  const pass = process.env.SMTP_PASS?.trim() || "";
  const secure =
    process.env.SMTP_SECURE?.trim().toLowerCase() === "true" || port === 465;

  const key = `${host}:${port}:${secure}:${user}:${pass.length}`;
  if (!cachedTransporter || cachedTransporterKey !== key) {
    cachedTransporter = nodemailer.createTransport({
      host,
      port,
      secure,
      pool: true,
      maxConnections: 2,
      maxMessages: 100,
      rateDelta: 1000,
      rateLimit: 5,
      auth: { user, pass },
    });
    cachedTransporterKey = key;
  }
  return cachedTransporter;
}

export function resetEmailTransporterForTests() {
  cachedTransporter = null;
  cachedTransporterKey = "";
}

function normalizeVariables(
  variables: Record<string, string>,
  recipientName?: string,
): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const [k, v] of Object.entries(variables)) {
    normalized[k] = v == null ? "" : String(v);
  }

  // Seamless alias support between legacy `student_name` and canonical `recipient_name`
  if (!normalized.recipient_name) {
    normalized.recipient_name =
      recipientName?.trim() ||
      normalized.student_name ||
      normalized.panelist_name ||
      "User";
  }
  if (!normalized.student_name && normalized.recipient_name) {
    normalized.student_name = normalized.recipient_name;
  }
  if (!normalized.portal_link) {
    normalized.portal_link = buildPortalUrl("/login");
  }
  if (!normalized.schedule_message && normalized.defense_stage) {
    normalized.schedule_message =
      normalized.schedule_action?.toLowerCase() === "updated"
        ? `Please be informed that the schedule details for your ${normalized.defense_stage} Defense have been updated by the Office of the Graduate School.`
        : `Please be informed that your ${normalized.defense_stage} Defense has been officially scheduled by the Office of the Graduate School.`;
  }
  if (!normalized.assignment_message && normalized.defense_stage && normalized.panel_role) {
    normalized.assignment_message = `You have been formally designated to serve as ${normalized.panel_role} for the ${normalized.defense_stage} Defense of ${normalized.student_name || "the candidate"}.`;
  }
  return normalized;
}

function resolveSenderAddress(): string {
  return (
    process.env.EMAIL_FROM?.trim() ||
    process.env.SMTP_FROM?.trim() ||
    "EARIST Graduate School <noreply@graduate-system.edu.ph>"
  );
}

export class EmailService {
  /**
   * Dispatches a rendered email immediately via pooled SMTP.
   * Used by the MySQL EmailWorker and direct SMTP verification.
   */
  static async sendRawSmtp(params: {
    to: string;
    subject: string;
    html: string;
    text?: string | null;
  }) {
    if (!isSmtpConfigured()) {
      throw new Error(
        "SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS in backend/.env.",
      );
    }

    const transporter = getSmtpTransporter();
    return transporter.sendMail({
      from: resolveSenderAddress(),
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text || htmlToPlainText(params.html),
    });
  }

  /**
   * Backward-compatible direct send helper that logs and dispatches via SMTP.
   */
  static async sendDirectEmail(
    to: string,
    subject: string,
    html: string,
    templateKey?: string,
  ) {
    const text = htmlToPlainText(html);
    const created = await emailRepository.createLog({
      recipient: to,
      subject,
      templateKey,
      htmlBody: html,
      textBody: text,
      status: "PROCESSING",
      attemptCount: 1,
      lastAttemptAt: new Date(),
    });

    try {
      const info = await EmailService.sendRawSmtp({ to, subject, html, text });
      await emailRepository.markSent(created.id);
      return info;
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "SMTP delivery failed";
      await emailRepository.updateLogStatus(created.id, "FAILED", message);
      throw error;
    }
  }

  /**
   * Compiles both subject and body with Handlebars, wraps in the unified
   * EARIST Graduate School HTML layout, and returns rendered parts.
   */
  static compileRenderedEmail(params: {
    templateKey?: string;
    category?: EmailCategory;
    subjectTemplate: string;
    bodyHtmlTemplate: string;
    variables: Record<string, string>;
    recipientName?: string;
    ctaLabel?: string;
    ctaUrl?: string;
  }): { subject: string; html: string; text: string; category: EmailCategory } {
    const def = params.templateKey
      ? getTemplateDefinition(params.templateKey)
      : undefined;
    const vars = normalizeVariables(params.variables, params.recipientName);

    const compiledSubject = Handlebars.compile(params.subjectTemplate)(vars).trim();
    const compiledBody = Handlebars.compile(params.bodyHtmlTemplate)(vars);

    const category: EmailCategory =
      params.category ?? def?.category ?? "SYSTEM_TEST";
    const categoryLabel =
      EMAIL_CATEGORY_LABELS[category] ?? "Graduate School Notice";

    const ctaUrl =
      params.ctaUrl ??
      (def?.ctaVariable ? vars[def.ctaVariable] : undefined) ??
      vars.portal_link;
    const ctaLabel = params.ctaLabel ?? def?.ctaLabel ?? "Open Portal";

    const html = wrapEaristEmailHtml({
      categoryLabel,
      title: compiledSubject,
      bodyHtml: compiledBody,
      ctaLabel,
      ctaUrl,
    });
    const text = htmlToPlainText(html);

    return { subject: compiledSubject, html, text, category };
  }

  /**
   * Enqueues a transactional email into the durable MySQL persistent queue
   * (`email_logs`) and immediately wakes the background worker.
   */
  static async sendTemplateEmail(
    to: string,
    templateKey: string,
    variables: Record<string, string>,
    options?: SendTemplateEmailOptions,
  ): Promise<EnqueueEmailResult> {
    const mode = getEmailDeliveryMode();
    const cleanRecipient = to?.trim();
    if (!cleanRecipient) {
      return { queued: false, skipped: true, reason: "EMPTY_RECIPIENT", mode };
    }

    if (isRetiredTemplateKey(templateKey) && !options?.forceSend) {
      return { queued: false, skipped: true, reason: "TEMPLATE_RETIRED", mode };
    }

    if (mode === "disabled" && !options?.forceSend) {
      return { queued: false, skipped: true, reason: "EMAIL_MODE_DISABLED", mode };
    }

    const def = getTemplateDefinition(templateKey);
    const dbTemplate = await emailRepository.getTemplateByKey(templateKey);

    if (!dbTemplate && !def) {
      throw new Error(`Email template '${templateKey}' not found.`);
    }

    if (dbTemplate && !dbTemplate.isActive && !options?.forceSend) {
      return { queued: false, skipped: true, reason: "TEMPLATE_PAUSED", mode };
    }

    const subjectTemplate = dbTemplate?.subject ?? def!.defaultSubject;
    const bodyHtmlTemplate = dbTemplate?.bodyHtml ?? def!.defaultBodyHtml;
    const idempotencyKey = options?.idempotencyKey ?? options?.jobId ?? null;

    let rendered: {
      subject: string;
      html: string;
      text: string;
      category: EmailCategory;
    };

    try {
      rendered = EmailService.compileRenderedEmail({
        templateKey,
        subjectTemplate,
        bodyHtmlTemplate,
        variables,
        recipientName: options?.recipientName,
        ctaLabel: options?.ctaLabel,
        ctaUrl: options?.ctaUrl,
      });
    } catch (error: unknown) {
      const msg =
        error instanceof Error ? error.message : "Template compilation error";
      await emailRepository.createLog({
        recipient: cleanRecipient,
        recipientName:
          options?.recipientName ?? variables.recipient_name ?? variables.student_name ?? null,
        subject: subjectTemplate,
        templateKey,
        category: def?.category ?? null,
        batchId: options?.batchId ?? null,
        idempotencyKey,
        status: "FAILED",
        errorMessage: `Template Compilation Error: ${msg}`,
        triggeredById: options?.triggeredById ?? null,
      });
      throw error;
    }

    if (mode === "dry_run") {
      const logged = await emailRepository.createLog({
        recipient: cleanRecipient,
        recipientName:
          options?.recipientName ?? variables.recipient_name ?? variables.student_name ?? null,
        subject: rendered.subject,
        templateKey,
        category: rendered.category,
        batchId: options?.batchId ?? null,
        idempotencyKey,
        htmlBody: rendered.html,
        textBody: rendered.text,
        status: "SENT",
        sentAt: new Date(),
        triggeredById: options?.triggeredById ?? null,
      });
      return {
        queued: true,
        deduplicated: logged.deduplicated,
        logId: logged.id,
        mode,
      };
    }

    const logged = await emailRepository.createLog({
      recipient: cleanRecipient,
      recipientName:
        options?.recipientName ?? variables.recipient_name ?? variables.student_name ?? null,
      subject: rendered.subject,
      templateKey,
      category: rendered.category,
      batchId: options?.batchId ?? null,
      idempotencyKey,
      htmlBody: rendered.html,
      textBody: rendered.text,
      status: "QUEUED",
      triggeredById: options?.triggeredById ?? null,
    });

    if (!logged.deduplicated) {
      wakeWorkerIfRegistered();
    }

    return {
      queued: true,
      deduplicated: logged.deduplicated,
      logId: logged.id,
      mode,
    };
  }

  /**
   * Enqueues personalized transactional emails for a group of recipients
   * (e.g., 24h exam reminders or defense committee assignments) under one batchId.
   */
  static async sendBatch(
    recipients: BatchRecipientItem[] | string[],
    templateKey: string,
    sharedVariables: Record<string, string> = {},
    options?: { batchId?: string; triggeredById?: string },
  ): Promise<{ batchId: string; queuedCount: number; skippedCount: number }> {
    const batchId =
      options?.batchId ?? `batch_${crypto.randomBytes(6).toString("hex")}`;

    const items: BatchRecipientItem[] = recipients.map((entry) =>
      typeof entry === "string" ? { to: entry } : entry,
    );

    const seen = new Set<string>();
    let queuedCount = 0;
    let skippedCount = 0;

    for (const item of items) {
      const normalizedEmail = item.to?.trim().toLowerCase();
      if (!normalizedEmail || seen.has(normalizedEmail)) {
        skippedCount += 1;
        continue;
      }
      seen.add(normalizedEmail);

      try {
        const res = await EmailService.sendTemplateEmail(
          item.to.trim(),
          templateKey,
          { ...sharedVariables, ...(item.variables ?? {}) },
          {
            recipientName: item.recipientName,
            idempotencyKey: item.idempotencyKey,
            batchId,
            triggeredById: options?.triggeredById,
          },
        );
        if (res.queued && !res.skipped) {
          queuedCount += 1;
        } else {
          skippedCount += 1;
        }
      } catch (err: unknown) {
        skippedCount += 1;
        console.error(
          `[EmailService] Batch item failed for ${item.to}:`,
          err instanceof Error ? err.message : err,
        );
      }
    }

    return { batchId, queuedCount, skippedCount };
  }

  /**
   * Renders a live EARIST-branded HTML preview of a template using sample variables.
   */
  static async renderTemplatePreview(
    templateKey: string,
    overrides?: { subject?: string; bodyHtml?: string },
  ) {
    const def = getTemplateDefinition(templateKey);
    const dbTemplate = await emailRepository.getTemplateByKey(templateKey);
    if (!def && !dbTemplate) {
      throw new Error(`Email template '${templateKey}' not found.`);
    }

    const sampleVars: Record<string, string> = {
      ...(def?.sampleVariables ?? {
        recipient_name: "Sample User",
        portal_link: buildPortalUrl("/login"),
      }),
    };
    if (sampleVars.portal_link) {
      const pathPart = sampleVars.portal_link.replace(/^https?:\/\/[^/]+/, "") || "/login";
      sampleVars.portal_link = buildPortalUrl(pathPart);
    }
    if (sampleVars.reset_link) {
      sampleVars.reset_link = buildPortalUrl("/reset-password?token=sample-preview-token");
    }

    return EmailService.compileRenderedEmail({
      templateKey,
      subjectTemplate:
        overrides?.subject ?? dbTemplate?.subject ?? def!.defaultSubject,
      bodyHtmlTemplate:
        overrides?.bodyHtml ?? dbTemplate?.bodyHtml ?? def!.defaultBodyHtml,
      variables: sampleVars,
      recipientName: sampleVars.recipient_name,
    });
  }

  /**
   * Sends an immediate test email (either a template with sample data or a
   * connectivity test) and persists the outcome in `email_logs`.
   */
  static async sendTestEmail(params: {
    to: string;
    templateKey?: string;
    triggeredById: string;
  }) {
    const mode = getEmailDeliveryMode();
    const recipient = params.to.trim();

    let rendered: { subject: string; html: string; text: string; category: EmailCategory };
    let templateKey: string | null = null;

    if (params.templateKey) {
      const preview = await EmailService.renderTemplatePreview(params.templateKey);
      rendered = {
        ...preview,
        subject: `[TEST] ${preview.subject}`,
      };
      templateKey = params.templateKey;
    } else {
      rendered = EmailService.compileRenderedEmail({
        category: "SYSTEM_TEST",
        subjectTemplate: "EARIST GS-IS Email Delivery Test",
        bodyHtmlTemplate: `<p>Dear Administrator,</p>
<p>This is a live test message sent from the <strong>EARIST Graduate School Information System</strong> Email Manager.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border:1px solid #e5e0d8;border-left:4px solid #8b1e1e;background:#faf8f5;border-radius:6px;">
  <tr><td style="padding:14px 16px;font-size:14px;line-height:1.6;color:#2c2c2c;">
    <strong>Delivery Mode:</strong> ${mode.toUpperCase()}<br/>
    <strong>Queue Backend:</strong> MySQL Persistent Queue<br/>
    <strong>Portal URL:</strong> {{portal_link}}
  </td></tr>
</table>
<p>If you can read this message, your outgoing email formatting and delivery pipeline are working properly.</p>`,
        variables: {
          recipient_name: "Administrator",
          portal_link: buildPortalUrl("/admin/emails"),
        },
        ctaLabel: "Open Email Manager",
        ctaUrl: buildPortalUrl("/admin/emails"),
      });
    }

    if (mode === "dry_run" || mode === "disabled") {
      const now = new Date();
      const created = await emailRepository.createLog({
        recipient,
        recipientName: "Test Recipient",
        subject: rendered.subject,
        templateKey,
        category: "SYSTEM_TEST",
        htmlBody: rendered.html,
        textBody: rendered.text,
        status: "SENT",
        attemptCount: 1,
        lastAttemptAt: now,
        sentAt: now,
        triggeredById: params.triggeredById,
      });
      return {
        logId: created.id,
        status: "SENT" as const,
        mode,
        deliveredViaSmtp: false,
        message:
          "Test email rendered and recorded in Dry Run mode. Configure SMTP credentials and EMAIL_MODE=smtp to send over live SMTP.",
      };
    }

    const created = await emailRepository.createLog({
      recipient,
      recipientName: "Test Recipient",
      subject: rendered.subject,
      templateKey,
      category: "SYSTEM_TEST",
      htmlBody: rendered.html,
      textBody: rendered.text,
      status: "PROCESSING",
      attemptCount: 1,
      lastAttemptAt: new Date(),
      triggeredById: params.triggeredById,
    });

    try {
      await EmailService.sendRawSmtp({
        to: recipient,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      });
      await emailRepository.markSent(created.id);
      return {
        logId: created.id,
        status: "SENT" as const,
        mode,
        deliveredViaSmtp: true,
        message: `Test email successfully sent to ${recipient}.`,
      };
    } catch (error: unknown) {
      const errMsg =
        error instanceof Error ? error.message : "SMTP delivery failed";
      await emailRepository.updateLogStatus(created.id, "FAILED", errMsg);
      return {
        logId: created.id,
        status: "FAILED" as const,
        mode,
        deliveredViaSmtp: false,
        error: errMsg,
        message: `SMTP delivery failed: ${errMsg}`,
      };
    }
  }

  static async verifySmtpConnection(): Promise<{
    ok: boolean;
    mode: EmailDeliveryMode;
    message: string;
  }> {
    const mode = getEmailDeliveryMode();
    if (!isSmtpConfigured()) {
      return {
        ok: false,
        mode,
        message: "SMTP credentials are not configured in backend/.env.",
      };
    }
    try {
      await getSmtpTransporter().verify();
      return { ok: true, mode, message: "SMTP connection verified." };
    } catch (error: unknown) {
      return {
        ok: false,
        mode,
        message:
          error instanceof Error
            ? error.message
            : "Unable to verify SMTP connection.",
      };
    }
  }

  static getDeliveryHealth(workerRunning = false) {
    return {
      mode: getEmailDeliveryMode(),
      queueEngine: "MYSQL_PERSISTENT",
      smtpConfigured: isSmtpConfigured(),
      smtpHost: process.env.SMTP_HOST?.trim() || null,
      smtpPort: Number(process.env.SMTP_PORT) || 587,
      fromAddress: resolveSenderAddress(),
      publicUrl: resolveAppPublicUrl(),
      workerRunning,
    };
  }
}
