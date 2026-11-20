import crypto from "crypto";
import bcrypt from "bcryptjs";
import prisma from "../config/database";
import { AppError } from "../utils/AppError";
import { EmailService } from "./email.service";
import { buildPortalUrl } from "./email-layout";
import { disconnectUserDefenseSockets } from "../realtime/defense-realtime.registry";

const RESET_TOKEN_TTL_MINUTES = 30;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS_PER_EMAIL = 3;
const MAX_REQUESTS_PER_IP = 10;

const GENERIC_FORGOT_PASSWORD_MESSAGE =
  "If an active account matches that email address, a password reset link has been sent.";

const emailRateStore = new Map<string, number[]>();
const ipRateStore = new Map<string, number[]>();

function isRateLimited(
  store: Map<string, number[]>,
  key: string,
  maxRequests: number,
  nowMs: number,
): boolean {
  const recent = (store.get(key) ?? []).filter(
    (ts) => nowMs - ts < RATE_LIMIT_WINDOW_MS,
  );
  if (recent.length >= maxRequests) {
    store.set(key, recent);
    return true;
  }
  recent.push(nowMs);
  store.set(key, recent);
  return false;
}

export function resetPasswordRateLimitersForTests() {
  emailRateStore.clear();
  ipRateStore.clear();
}

export function hashPasswordResetToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

export class PasswordResetService {
  /**
   * Public non-enumerating forgot-password request across all 4 portal roles.
   * Never reveals whether an email exists or whether an account is deactivated.
   */
  async requestPasswordReset(
    rawEmail: string,
    requestedIp?: string | null,
  ): Promise<{ message: string }> {
    const email = String(rawEmail ?? "").trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new AppError("Please enter a valid email address.", 400);
    }

    const nowMs = Date.now();
    const cleanIp = requestedIp?.trim().slice(0, 64) || "unknown";
    if (
      isRateLimited(ipRateStore, cleanIp, MAX_REQUESTS_PER_IP, nowMs) ||
      isRateLimited(emailRateStore, email, MAX_REQUESTS_PER_EMAIL, nowMs)
    ) {
      return { message: GENERIC_FORGOT_PASSWORD_MESSAGE };
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { panelist: { select: { isActive: true } } },
    });

    if (!user || user.isActive === false) {
      return { message: GENERIC_FORGOT_PASSWORD_MESSAGE };
    }

    if (
      (user.role === "FACULTY" || user.role === "PANELIST") &&
      user.panelist &&
      user.panelist.isActive === false
    ) {
      return { message: GENERIC_FORGOT_PASSWORD_MESSAGE };
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashPasswordResetToken(rawToken);
    const expiresAt = new Date(nowMs + RESET_TOKEN_TTL_MINUTES * 60 * 1000);

    await prisma.$transaction(async (tx) => {
      // Invalidate any prior unused reset tokens for this user
      await tx.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date(nowMs) },
      });

      await tx.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
          requestedIp: cleanIp === "unknown" ? null : cleanIp,
        },
      });
    });

    const recipientName =
      `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || "User";
    const resetLink = buildPortalUrl(
      `/reset-password?token=${encodeURIComponent(rawToken)}`,
    );

    void EmailService.sendTemplateEmail(
      user.email,
      "password_reset_link",
      {
        recipient_name: recipientName,
        reset_link: resetLink,
        expiry_minutes: String(RESET_TOKEN_TTL_MINUTES),
      },
      { recipientName, ctaUrl: resetLink },
    ).catch((error: unknown) => {
      console.error(
        "[PasswordResetService] Failed to enqueue password_reset_link email:",
        error instanceof Error ? error.message : error,
      );
    });

    return { message: GENERIC_FORGOT_PASSWORD_MESSAGE };
  }

  async validateResetToken(rawToken: string): Promise<{
    valid: boolean;
    reason?: string;
  }> {
    const token = String(rawToken ?? "").trim();
    if (!token || token.length < 20) {
      return { valid: false, reason: "This password reset link is invalid or has expired." };
    }

    const tokenHash = hashPasswordResetToken(token);
    const record = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
          select: {
            isActive: true,
            role: true,
            panelist: { select: { isActive: true } },
          },
        },
      },
    });

    if (
      !record ||
      record.usedAt !== null ||
      record.expiresAt.getTime() <= Date.now() ||
      !record.user ||
      record.user.isActive === false ||
      ((record.user.role === "FACULTY" || record.user.role === "PANELIST") &&
        record.user.panelist &&
        record.user.panelist.isActive === false)
    ) {
      return { valid: false, reason: "This password reset link is invalid or has expired." };
    }

    return { valid: true };
  }

  async completePasswordReset(
    rawToken: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const token = String(rawToken ?? "").trim();
    const password = String(newPassword ?? "");
    if (!token || token.length < 20) {
      throw new AppError("This password reset link is invalid or has expired.", 400);
    }
    if (password.length < 8) {
      throw new AppError("New password must be at least 8 characters long.", 400);
    }

    const tokenHash = hashPasswordResetToken(token);
    const now = new Date();

    const record = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            isActive: true,
            role: true,
            panelist: { select: { isActive: true } },
          },
        },
      },
    });

    if (
      !record ||
      record.usedAt !== null ||
      record.expiresAt.getTime() <= now.getTime() ||
      !record.user ||
      record.user.isActive === false ||
      ((record.user.role === "FACULTY" || record.user.role === "PANELIST") &&
        record.user.panelist &&
        record.user.panelist.isActive === false)
    ) {
      throw new AppError("This password reset link is invalid or has expired.", 400);
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await prisma.$transaction(async (tx) => {
      const consumed = await tx.passwordResetToken.updateMany({
        where: { id: record.id, usedAt: null },
        data: { usedAt: now },
      });
      if (consumed.count !== 1) {
        throw new AppError("This password reset link has already been used.", 400);
      }

      // Invalidate any other pending tokens for this user
      await tx.passwordResetToken.updateMany({
        where: { userId: record.user.id, usedAt: null },
        data: { usedAt: now },
      });

      await tx.user.update({
        where: { id: record.user.id },
        data: {
          passwordHash,
          mustChangePassword: false,
          tokenVersion: { increment: 1 },
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: record.user.id,
          actionType: "PASSWORD_RESET_SELF_SERVICE",
          targetTable: "users",
          targetId: record.user.id,
          description: `User completed self-service password reset (${record.user.email}).`,
        },
      });
    });

    void disconnectUserDefenseSockets(record.user.id, "SESSION_INVALIDATED");

    return {
      message: "Your password has been reset. You may now sign in with your new password.",
    };
  }
}
