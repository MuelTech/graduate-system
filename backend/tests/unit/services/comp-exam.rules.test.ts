import { describe, expect, it } from "vitest";
import {
  MAX_COMP_EXAM_ATTEMPTS,
  buildCompExamEmailFoundationPayload,
  buildCompExamNotificationCopy,
  evaluateCompExamSummary,
  generateCompExamCertificateNumber,
} from "../../../src/services/comp-exam.rules";

describe("comp-exam.rules", () => {
  it("evaluates an empty record list as NOT_RECORDED with 3 remaining attempts", () => {
    const res = evaluateCompExamSummary([]);
    expect(res.standing).toBe("NOT_RECORDED");
    expect(res.isPassed).toBe(false);
    expect(res.isDismissed).toBe(false);
    expect(res.attemptsUsed).toBe(0);
    expect(res.failedCount).toBe(0);
    expect(res.attemptsRemaining).toBe(MAX_COMP_EXAM_ATTEMPTS);
    expect(res.nextAttemptNumber).toBe(1);
    expect(res.passedAttempt).toBeNull();
  });

  it("treats a sole PENDING record as PENDING with 0 graded attempts", () => {
    const res = evaluateCompExamSummary([
      { id: "c1", attemptNumber: 1, status: "PENDING", createdAt: new Date() },
    ]);
    expect(res.standing).toBe("PENDING");
    expect(res.attemptsUsed).toBe(0);
    expect(res.attemptsRemaining).toBe(3);
    expect(res.nextAttemptNumber).toBe(1);
    expect(res.latestGradedAttempt).toBeNull();
  });

  it("evaluates 1 and 2 failed attempts as RETAKE_REQUIRED (not dismissed)", () => {
    const oneFail = evaluateCompExamSummary([
      { id: "c1", attemptNumber: 1, status: "FAILED", createdAt: new Date("2026-06-01") },
    ]);
    expect(oneFail.standing).toBe("RETAKE_REQUIRED");
    expect(oneFail.isDismissed).toBe(false);
    expect(oneFail.failedCount).toBe(1);
    expect(oneFail.attemptsRemaining).toBe(2);
    expect(oneFail.nextAttemptNumber).toBe(2);

    const twoFails = evaluateCompExamSummary([
      { id: "c1", attemptNumber: 1, status: "FAILED", createdAt: new Date("2026-06-01") },
      { id: "c2", attemptNumber: 2, status: "FAILED", createdAt: new Date("2026-07-01") },
    ]);
    expect(twoFails.standing).toBe("RETAKE_REQUIRED");
    expect(twoFails.isDismissed).toBe(false);
    expect(twoFails.failedCount).toBe(2);
    expect(twoFails.attemptsRemaining).toBe(1);
    expect(twoFails.nextAttemptNumber).toBe(3);
  });

  it("marks DISMISSED only upon 3 failed attempts without a passing attempt (Manual §7.15.4)", () => {
    const threeFails = evaluateCompExamSummary([
      { id: "c1", attemptNumber: 1, status: "FAILED", createdAt: new Date("2026-06-01") },
      { id: "c2", attemptNumber: 2, status: "FAILED", createdAt: new Date("2026-07-01") },
      { id: "c3", attemptNumber: 3, status: "FAILED", createdAt: new Date("2026-08-01") },
    ]);
    expect(threeFails.standing).toBe("DISMISSED");
    expect(threeFails.isDismissed).toBe(true);
    expect(threeFails.isPassed).toBe(false);
    expect(threeFails.attemptsUsed).toBe(3);
    expect(threeFails.attemptsRemaining).toBe(0);
    expect(threeFails.nextAttemptNumber).toBeNull();
  });

  it("evaluates PASSED on attempt 1, 2, or 3 cleanly and locks subsequent attempts", () => {
    const passOnThird = evaluateCompExamSummary([
      { id: "c1", attemptNumber: 1, status: "FAILED", createdAt: new Date("2026-06-01") },
      { id: "c2", attemptNumber: 2, status: "FAILED", createdAt: new Date("2026-07-01") },
      { id: "c3", attemptNumber: 3, status: "PASSED", createdAt: new Date("2026-08-01") },
    ]);
    expect(passOnThird.standing).toBe("PASSED");
    expect(passOnThird.isPassed).toBe(true);
    expect(passOnThird.isDismissed).toBe(false);
    expect(passOnThird.attemptsUsed).toBe(3);
    expect(passOnThird.attemptsRemaining).toBe(0);
    expect(passOnThird.nextAttemptNumber).toBeNull();
    expect(passOnThird.passedAttempt?.id).toBe("c3");
    expect(passOnThird.orderedRecords.map((r) => r.attemptNumber)).toEqual([3, 2, 1]);
  });

  it("builds deterministic certificate numbers and handbook-aligned notification/email payloads", () => {
    const ref = generateCompExamCertificateNumber(
      new Date("2026-11-20T00:00:00.000Z"),
      "ab12cd34-5678-90ef-1234-567890abcdef",
    );
    expect(ref).toBe("WCE-2026-AB12CD34");

    const passNotice = buildCompExamNotificationCopy({
      status: "PASSED",
      attemptNumber: 2,
      isDismissed: false,
    });
    expect(passNotice.type).toBe("EXAM_RESULT");
    expect(passNotice.message).toContain("Attempt 2 of 3");
    expect(passNotice.message).toContain("Title Defense");

    const dismissNotice = buildCompExamNotificationCopy({
      status: "FAILED",
      attemptNumber: 3,
      isDismissed: true,
    });
    expect(dismissNotice.title).toContain("Disqualified");
    expect(dismissNotice.message).toContain("§7.15.4");

    const email = buildCompExamEmailFoundationPayload({
      recipientEmail: "juan@earist.edu.ph",
      studentName: "Juan Dela Cruz",
      status: "FAILED",
      attemptNumber: 1,
      isDismissed: false,
    });
    expect(email.templateKey).toBe("comp_exam_recorded");
    expect(email.deliveryStatus).toBe("DEFERRED_SMTP_NOT_CONFIGURED");
    expect(email.variables.student_name).toBe("Juan Dela Cruz");
    expect(email.variables.result).toContain("2 remaining attempts");
  });
});
