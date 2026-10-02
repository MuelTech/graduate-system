import { describe, expect, it } from "vitest";
import {
  UploadTelemetry,
  UPLOAD_FAILURE_STAGES,
} from "../../../src/storage/upload-telemetry";

/**
 * DL-11: process-local upload pipeline telemetry. Sanitized operational
 * metadata only; no filename/user/path/storage-key/document content.
 */
describe("UploadTelemetry", () => {
  it("tracks attempts, successes and failures for the current process", () => {
    const telemetry = new UploadTelemetry();
    telemetry.recordAttempt();
    telemetry.recordAttempt();
    telemetry.recordSuccess();
    telemetry.recordFailure("VALIDATION", 400);

    const snapshot = telemetry.snapshot();
    expect(snapshot.scope).toBe("PROCESS_LOCAL_PIPELINE");
    expect(snapshot.attempts).toBe(2);
    expect(snapshot.successes).toBe(1);
    expect(snapshot.failures).toBe(1);
    expect(snapshot.recentFailures).toHaveLength(1);
    expect(snapshot.recentFailures[0].stage).toBe("VALIDATION");
    expect(snapshot.recentFailures[0].statusClass).toBe("4xx");
  });

  it("bounds the recent-failure ring and keeps the newest events", () => {
    const telemetry = new UploadTelemetry(5);
    for (let i = 0; i < 25; i++) {
      telemetry.recordFailure("PROMOTION", 500);
    }
    const snapshot = telemetry.snapshot();
    expect(snapshot.failures).toBe(25);
    expect(snapshot.recentFailures).toHaveLength(5);
  });

  it("classifies status codes without storing raw errors", () => {
    const telemetry = new UploadTelemetry();
    telemetry.recordFailure("MULTIPART", 413);
    telemetry.recordFailure("TEMP_STORAGE", 403);
    telemetry.recordFailure("UNKNOWN");
    const snapshot = telemetry.snapshot();
    expect(snapshot.recentFailures.map((e) => e.statusClass)).toEqual([
      "4xx",
      "4xx",
      null,
    ]);
  });

  it("exposes only sanitized fields in the DTO", () => {
    const telemetry = new UploadTelemetry();
    telemetry.recordAttempt();
    telemetry.recordFailure("VALIDATION", 400);
    const serialized = JSON.stringify(telemetry.snapshot());
    for (const forbidden of [
      "filename",
      "originalname",
      "storageKey",
      "filePath",
      "userId",
      "student",
      "path",
      "checksum",
      "content",
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it("exposes the bounded set of failure stages", () => {
    expect(UPLOAD_FAILURE_STAGES).toContain("MULTIPART");
    expect(UPLOAD_FAILURE_STAGES).toContain("VALIDATION");
    expect(UPLOAD_FAILURE_STAGES).toContain("PROMOTION");
    expect(UPLOAD_FAILURE_STAGES).toContain("TEMP_STORAGE");
  });

  it("is best-effort and never throws on unexpected input", () => {
    const telemetry = new UploadTelemetry();
    expect(() =>
      telemetry.recordFailure("NOT_A_STAGE" as never, NaN),
    ).not.toThrow();
  });
});
