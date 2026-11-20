import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  prismaMock,
  sendTemplateEmailMock,
  sendBatchMock,
  disconnectSocketsMock,
} = vi.hoisted(() => ({
  prismaMock: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    passwordResetToken: {
      findUnique: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  sendTemplateEmailMock: vi.fn(),
  sendBatchMock: vi.fn(),
  disconnectSocketsMock: vi.fn(),
}));

vi.mock("../../src/config/database", () => ({ default: prismaMock }));
vi.mock("../../src/services/email.service", () => ({
  EmailService: {
    sendTemplateEmail: sendTemplateEmailMock,
    sendBatch: sendBatchMock,
  },
}));
vi.mock("../../src/realtime/defense-realtime.registry", () => ({
  disconnectUserDefenseSockets: disconnectSocketsMock,
}));

import {
  PasswordResetService,
  hashPasswordResetToken,
  resetPasswordRateLimitersForTests,
} from "../../src/services/password-reset.service";
import { EmailLifecycle } from "../../src/services/email-lifecycle.helper";

describe("Phase 2: Self-Service Password Reset & Lifecycle Email Dispatchers", () => {
  const service = new PasswordResetService();

  beforeEach(() => {
    vi.clearAllMocks();
    resetPasswordRateLimitersForTests();
    prismaMock.$transaction.mockImplementation(async (cb: any) => cb(prismaMock));
    sendTemplateEmailMock.mockResolvedValue({ queued: true, mode: "dry_run" });
    sendBatchMock.mockResolvedValue({ batchId: "b1", queuedCount: 2, skippedCount: 0 });
  });

  it("returns generic non-enumerating success for unknown and deactivated accounts without creating tokens or sending email", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(null);
    const unknownRes = await service.requestPasswordReset("nobody@example.com", "127.0.0.1");
    expect(unknownRes.message).toContain("If an active account matches");
    expect(prismaMock.passwordResetToken.create).not.toHaveBeenCalled();
    expect(sendTemplateEmailMock).not.toHaveBeenCalled();

    prismaMock.user.findUnique.mockResolvedValueOnce({
      id: "u-inactive",
      email: "inactive@earist.edu.ph",
      firstName: "Ina",
      lastName: "Ctive",
      role: "STUDENT",
      isActive: false,
      panelist: null,
    });
    const inactiveRes = await service.requestPasswordReset("inactive@earist.edu.ph", "127.0.0.1");
    expect(inactiveRes.message).toContain("If an active account matches");
    expect(prismaMock.passwordResetToken.create).not.toHaveBeenCalled();
    expect(sendTemplateEmailMock).not.toHaveBeenCalled();
  });

  it("stores only SHA-256 hash of reset token and dispatches password_reset_link with raw token in URL", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "u-1",
      email: "student@earist.edu.ph",
      firstName: "Juan",
      lastName: "Dela Cruz",
      role: "STUDENT",
      isActive: true,
      panelist: null,
    });
    prismaMock.passwordResetToken.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.passwordResetToken.create.mockResolvedValue({ id: "tok-1" });

    await service.requestPasswordReset("student@earist.edu.ph", "10.0.0.1");

    expect(prismaMock.passwordResetToken.create).toHaveBeenCalledTimes(1);
    const storedHash = prismaMock.passwordResetToken.create.mock.calls[0][0].data.tokenHash;
    expect(storedHash).toMatch(/^[a-f0-9]{64}$/);

    expect(sendTemplateEmailMock).toHaveBeenCalledWith(
      "student@earist.edu.ph",
      "password_reset_link",
      expect.objectContaining({
        recipient_name: "Juan Dela Cruz",
        expiry_minutes: "30",
        reset_link: expect.stringContaining("/reset-password?token="),
      }),
      expect.anything(),
    );

    const sentLink: string = sendTemplateEmailMock.mock.calls[0][2].reset_link;
    const rawToken = decodeURIComponent(sentLink.split("token=")[1]);
    expect(hashPasswordResetToken(rawToken)).toBe(storedHash);
  });

  it("completes reset atomically, increments tokenVersion, clears mustChangePassword, disconnects sockets, and audits", async () => {
    const rawToken = "a".repeat(64);
    const tokenHash = hashPasswordResetToken(rawToken);
    prismaMock.passwordResetToken.findUnique.mockResolvedValue({
      id: "tok-9",
      userId: "u-9",
      tokenHash,
      usedAt: null,
      expiresAt: new Date(Date.now() + 10 * 60_000),
      user: {
        id: "u-9",
        email: "faculty@earist.edu.ph",
        isActive: true,
        role: "FACULTY",
        panelist: { isActive: true },
      },
    });
    prismaMock.passwordResetToken.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    prismaMock.user.update.mockResolvedValue({});
    prismaMock.auditLog.create.mockResolvedValue({});

    const res = await service.completePasswordReset(rawToken, "NewStrongPass123!");
    expect(res.message).toContain("password has been reset");
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "u-9" },
        data: expect.objectContaining({
          mustChangePassword: false,
          tokenVersion: { increment: 1 },
        }),
      }),
    );
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actionType: "PASSWORD_RESET_SELF_SERVICE",
          targetId: "u-9",
        }),
      }),
    );
    expect(disconnectSocketsMock).toHaveBeenCalledWith("u-9", "SESSION_INVALIDATED");
  });

  it("rejects expired or already-used reset tokens", async () => {
    const rawToken = "b".repeat(64);
    prismaMock.passwordResetToken.findUnique.mockResolvedValue({
      id: "tok-old",
      userId: "u-9",
      tokenHash: hashPasswordResetToken(rawToken),
      usedAt: new Date(),
      expiresAt: new Date(Date.now() + 10 * 60_000),
      user: { id: "u-9", email: "x@y.com", isActive: true, role: "STUDENT", panelist: null },
    });

    const validation = await service.validateResetToken(rawToken);
    expect(validation.valid).toBe(false);
    await expect(
      service.completePasswordReset(rawToken, "ValidPassword123!"),
    ).rejects.toThrow("invalid or has expired");
  });

  it("dispatches WCE and account password reset lifecycle helpers with policy-safe payloads", async () => {
    const dispatched = await EmailLifecycle.sendAccountPasswordReset({
      email: "student@inbox.testmail.app",
      firstName: "Maria",
      lastName: "Santos",
      loginIdentifier: "2026-GS-001",
      triggeredById: "admin-1",
    });
    expect(dispatched).toBe(true);
    expect(sendTemplateEmailMock).toHaveBeenCalledWith(
      "student@inbox.testmail.app",
      "account_password_reset",
      expect.objectContaining({
        recipient_name: "Maria Santos",
        login_identifier: "2026-GS-001",
      }),
      expect.objectContaining({ triggeredById: "admin-1" }),
    );

    EmailLifecycle.sendCompExamRecorded({
      email: "student@inbox.testmail.app",
      firstName: "Maria",
      lastName: "Santos",
      attemptNumber: 1,
      result: "PASSED",
      isDismissed: false,
      attemptsRemaining: 0,
      triggeredById: "admin-1",
    });
    expect(sendTemplateEmailMock).toHaveBeenCalledWith(
      "student@inbox.testmail.app",
      "comp_exam_recorded",
      expect.objectContaining({
        attempt_number: "1",
        result: "PASSED",
        outcome_note: expect.stringContaining("Title Defense"),
      }),
      expect.anything(),
    );
  });
});
