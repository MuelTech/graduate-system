import { EmailStatus, Prisma } from "@prisma/client";
import prisma from "../config/database";
import {
  EMAIL_TEMPLATE_REGISTRY,
  RETIRED_EMAIL_TEMPLATE_KEYS,
} from "../config/email-templates.registry";

export interface EnqueueEmailLogInput {
  recipient: string;
  recipientName?: string | null;
  subject: string;
  templateKey?: string | null;
  category?: string | null;
  batchId?: string | null;
  idempotencyKey?: string | null;
  htmlBody?: string | null;
  textBody?: string | null;
  status?: EmailStatus;
  attemptCount?: number;
  maxAttempts?: number;
  lastAttemptAt?: Date | null;
  errorMessage?: string | null;
  triggeredById?: string | null;
  sentAt?: Date | null;
}

export interface EmailLogFilterQuery {
  page?: number;
  limit?: number;
  status?: EmailStatus;
  category?: string;
  templateKey?: string;
  batchId?: string;
  search?: string;
  days?: number;
}

/** Exponential retry backoff schedule (in milliseconds): 30s -> 2m -> 10m. */
export const EMAIL_RETRY_BACKOFF_MS = [30_000, 120_000, 600_000] as const;

export function computeNextRetryDelayMs(attemptCount: number): number {
  const index = Math.max(0, Math.min(attemptCount - 1, EMAIL_RETRY_BACKOFF_MS.length - 1));
  return EMAIL_RETRY_BACKOFF_MS[index];
}

export class EmailRepository {
  /**
   * Creates a durable EmailLog row. When an idempotencyKey already exists,
   * returns the existing record with `deduplicated: true` instead of throwing.
   */
  async createLog(
    data: EnqueueEmailLogInput,
  ): Promise<{ id: string; status: EmailStatus; deduplicated: boolean }> {
    const idempotencyKey = data.idempotencyKey?.trim() || null;

    if (idempotencyKey) {
      const existing = await prisma.emailLog.findUnique({
        where: { idempotencyKey },
        select: { id: true, status: true },
      });
      if (existing) {
        return { id: existing.id, status: existing.status, deduplicated: true };
      }
    }

    try {
      const created = await prisma.emailLog.create({
        data: {
          recipient: data.recipient.trim(),
          recipientName: data.recipientName?.trim() || null,
          subject: data.subject,
          templateKey: data.templateKey || null,
          category: data.category || null,
          batchId: data.batchId || null,
          idempotencyKey,
          htmlBody: data.htmlBody || null,
          textBody: data.textBody || null,
          status: data.status ?? "QUEUED",
          attemptCount: data.attemptCount ?? 0,
          maxAttempts: data.maxAttempts ?? 3,
          nextAttemptAt: (data.status ?? "QUEUED") === "QUEUED" ? new Date() : null,
          lastAttemptAt: data.lastAttemptAt ?? null,
          errorMessage: data.errorMessage || null,
          triggeredById: data.triggeredById || null,
          sentAt: data.sentAt ?? (data.status === "SENT" ? new Date() : null),
        },
        select: { id: true, status: true },
      });
      return { id: created.id, status: created.status, deduplicated: false };
    } catch (error: unknown) {
      if (
        idempotencyKey &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const existing = await prisma.emailLog.findUnique({
          where: { idempotencyKey },
          select: { id: true, status: true },
        });
        if (existing) {
          return { id: existing.id, status: existing.status, deduplicated: true };
        }
      }
      throw error;
    }
  }

  async updateLogStatus(
    logId: string,
    status: EmailStatus,
    errorMessage?: string | null,
  ) {
    return prisma.emailLog.update({
      where: { id: logId },
      data: {
        status,
        errorMessage: errorMessage ?? null,
        lockedAt: status === "PROCESSING" ? new Date() : null,
        sentAt: status === "SENT" ? new Date() : undefined,
      },
    });
  }

  /**
   * Startup and periodic crash recovery: releases any PROCESSING rows whose
   * lock is older than `staleMinutes` back to QUEUED so interrupted sends recover.
   */
  async recoverStaleProcessingLogs(staleMinutes = 5): Promise<number> {
    const cutoff = new Date(Date.now() - staleMinutes * 60_000);
    const result = await prisma.emailLog.updateMany({
      where: {
        status: "PROCESSING",
        OR: [{ lockedAt: null }, { lockedAt: { lt: cutoff } }],
      },
      data: {
        status: "QUEUED",
        lockedAt: null,
        nextAttemptAt: new Date(),
      },
    });
    return result.count;
  }

  /**
   * Atomically claims up to `limit` due QUEUED rows for delivery by the worker.
   */
  async claimNextDueLogs(limit = 5) {
    const now = new Date();
    const candidates = await prisma.emailLog.findMany({
      where: {
        status: "QUEUED",
        htmlBody: { not: null },
        OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
      },
      orderBy: [{ nextAttemptAt: "asc" }, { createdAt: "asc" }],
      take: limit,
    });

    const claimed = [];
    for (const row of candidates) {
      const claimResult = await prisma.emailLog.updateMany({
        where: { id: row.id, status: "QUEUED" },
        data: {
          status: "PROCESSING",
          lockedAt: now,
          lastAttemptAt: now,
          attemptCount: { increment: 1 },
        },
      });
      if (claimResult.count === 1) {
        claimed.push({
          ...row,
          status: "PROCESSING" as EmailStatus,
          attemptCount: row.attemptCount + 1,
        });
      }
    }
    return claimed;
  }

  async markSent(logId: string) {
    return prisma.emailLog.update({
      where: { id: logId },
      data: {
        status: "SENT",
        sentAt: new Date(),
        lockedAt: null,
        nextAttemptAt: null,
        errorMessage: null,
      },
    });
  }

  async scheduleRetryOrFail(
    logId: string,
    attemptCount: number,
    maxAttempts: number,
    errorMessage: string,
  ): Promise<{ finalStatus: EmailStatus; nextAttemptAt: Date | null }> {
    const sanitizedError = errorMessage.slice(0, 1500);
    if (attemptCount < maxAttempts) {
      const nextAttemptAt = new Date(
        Date.now() + computeNextRetryDelayMs(attemptCount),
      );
      await prisma.emailLog.update({
        where: { id: logId },
        data: {
          status: "QUEUED",
          lockedAt: null,
          nextAttemptAt,
          errorMessage: sanitizedError,
        },
      });
      return { finalStatus: "QUEUED", nextAttemptAt };
    }

    await prisma.emailLog.update({
      where: { id: logId },
      data: {
        status: "FAILED",
        lockedAt: null,
        nextAttemptAt: null,
        errorMessage: sanitizedError,
      },
    });
    return { finalStatus: "FAILED", nextAttemptAt: null };
  }

  async retryLog(logId: string) {
    const existing = await prisma.emailLog.findUnique({
      where: { id: logId },
      select: { id: true, status: true, htmlBody: true },
    });
    if (!existing) return null;
    if (existing.status !== "FAILED") {
      return { error: "Only failed emails can be retried." as const };
    }
    if (!existing.htmlBody) {
      return {
        error:
          "This legacy log entry has no stored message body and cannot be retried." as const,
      };
    }

    const updated = await prisma.emailLog.update({
      where: { id: logId },
      data: {
        status: "QUEUED",
        attemptCount: 0,
        nextAttemptAt: new Date(),
        lockedAt: null,
        errorMessage: null,
      },
    });
    return { log: updated };
  }

  async retryAllFailed(filters?: { category?: string; templateKey?: string }) {
    const where: Prisma.EmailLogWhereInput = {
      status: "FAILED",
      htmlBody: { not: null },
    };
    if (filters?.category) where.category = filters.category;
    if (filters?.templateKey) where.templateKey = filters.templateKey;

    const result = await prisma.emailLog.updateMany({
      where,
      data: {
        status: "QUEUED",
        attemptCount: 0,
        nextAttemptAt: new Date(),
        lockedAt: null,
        errorMessage: null,
      },
    });
    return result.count;
  }

  async getTemplateByKey(templateKey: string) {
    return prisma.emailTemplate.findUnique({
      where: { templateKey },
    });
  }

  async getAllTemplates() {
    return prisma.emailTemplate.findMany({
      where: {
        templateKey: {
          notIn: [...RETIRED_EMAIL_TEMPLATE_KEYS],
        },
      },
      orderBy: { templateKey: "asc" },
    });
  }

  async updateTemplate(
    templateKey: string,
    data: { subject?: string; bodyHtml?: string; isActive?: boolean },
    userId: string,
  ) {
    const def = EMAIL_TEMPLATE_REGISTRY.find((t) => t.templateKey === templateKey);
    return prisma.emailTemplate.upsert({
      where: { templateKey },
      update: {
        ...(data.subject !== undefined ? { subject: data.subject } : {}),
        ...(data.bodyHtml !== undefined ? { bodyHtml: data.bodyHtml } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        updatedById: userId,
      },
      create: {
        templateKey,
        subject: data.subject ?? def?.defaultSubject ?? templateKey,
        bodyHtml: data.bodyHtml ?? def?.defaultBodyHtml ?? "",
        variablesDescription: def?.variablesDescription ?? null,
        isActive: data.isActive ?? true,
        createdById: userId,
        updatedById: userId,
      },
    });
  }

  async getLogById(logId: string) {
    return prisma.emailLog.findUnique({
      where: { id: logId },
      include: {
        triggeredBy: {
          select: { id: true, firstName: true, lastName: true, email: true, role: true },
        },
      },
    });
  }

  async getPaginatedLogs(page: number, limit: number) {
    return this.getFilteredPaginatedLogs({ page, limit });
  }

  async getFilteredPaginatedLogs(filters: EmailLogFilterQuery) {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(Math.max(1, filters.limit ?? 20), 100);
    const skip = (page - 1) * limit;

    const where: Prisma.EmailLogWhereInput = {};
    if (filters.status) where.status = filters.status;
    if (filters.category) where.category = filters.category;
    if (filters.templateKey) where.templateKey = filters.templateKey;
    if (filters.batchId) where.batchId = filters.batchId;
    if (filters.days && filters.days > 0) {
      where.createdAt = {
        gte: new Date(Date.now() - filters.days * 24 * 60 * 60 * 1000),
      };
    }
    if (filters.search?.trim()) {
      const term = filters.search.trim();
      where.OR = [
        { recipient: { contains: term } },
        { recipientName: { contains: term } },
        { subject: { contains: term } },
        { templateKey: { contains: term } },
      ];
    }

    const [logs, total] = await Promise.all([
      prisma.emailLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          recipient: true,
          recipientName: true,
          subject: true,
          templateKey: true,
          category: true,
          batchId: true,
          status: true,
          attemptCount: true,
          maxAttempts: true,
          nextAttemptAt: true,
          lastAttemptAt: true,
          errorMessage: true,
          sentAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.emailLog.count({ where }),
    ]);

    return {
      data: logs,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async getDeliveryStats(days?: number) {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const windowWhere: Prisma.EmailLogWhereInput | undefined =
      days && days > 0
        ? { createdAt: { gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) } }
        : undefined;
    const [grouped, last24hSent, last24hFailed] = await Promise.all([
      prisma.emailLog.groupBy({
        by: ["status"],
        ...(windowWhere ? { where: windowWhere } : {}),
        _count: { _all: true },
      }),
      prisma.emailLog.count({
        where: { status: "SENT", sentAt: { gte: since24h } },
      }),
      prisma.emailLog.count({
        where: { status: "FAILED", updatedAt: { gte: since24h } },
      }),
    ]);

    const counts: Record<EmailStatus, number> = {
      QUEUED: 0,
      PROCESSING: 0,
      SENT: 0,
      FAILED: 0,
    };
    for (const row of grouped) {
      counts[row.status] = row._count._all;
    }

    const total = counts.QUEUED + counts.PROCESSING + counts.SENT + counts.FAILED;
    const finalized = counts.SENT + counts.FAILED;
    const deliveryRate =
      finalized > 0 ? Math.round((counts.SENT / finalized) * 1000) / 10 : 100;

    return {
      total,
      sent: counts.SENT,
      queued: counts.QUEUED,
      processing: counts.PROCESSING,
      failed: counts.FAILED,
      deliveryRate,
      last24hSent,
      last24hFailed,
    };
  }
}
