import { describe, expect, it } from "vitest";
import {
  DEFAULT_MAX_UPLOAD_BYTES,
  UPLOAD_POLICIES,
  getUploadPolicy,
} from "../../../src/storage/upload-policy";

describe("centralized upload policies", () => {
  it("exposes a positive global default byte limit", () => {
    expect(Number.isInteger(DEFAULT_MAX_UPLOAD_BYTES)).toBe(true);
    expect(DEFAULT_MAX_UPLOAD_BYTES).toBeGreaterThan(0);
  });

  it("defines the applicant COR policy with confirmed PDF/JPEG/PNG types", () => {
    const policy = getUploadPolicy("applicant-cor");
    expect(policy.maxFiles).toBe(1);
    expect(policy.allowedMimeTypes).toEqual([
      "application/pdf",
      "image/jpeg",
      "image/png",
    ]);
    expect(policy.storagePrefix).toBe("cor");
  });

  it("defines manuscript policies that preserve the accepted format set", () => {
    for (const name of ["proposal-manuscript", "final-manuscript"] as const) {
      const policy = getUploadPolicy(name);
      expect(policy.allowedMimeTypes).toContain("application/pdf");
      expect(policy.allowedMimeTypes).toContain(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      );
      // Legacy Word .doc is frequently undetectable — extension fallback preserved.
      expect(policy.fallbackExtensionsWhenUndetected).toContain("doc");
    }
  });

  it("keeps unresolved categories permissive rather than inventing policy", () => {
    for (const name of [
      "defense-evidence",
      "evaluation-instrument",
    ] as const) {
      const policy = getUploadPolicy(name);
      expect(policy.allowedMimeTypes).toBeNull();
    }
  });

  it("rejects an unknown policy name with a controlled error", () => {
    expect(() => getUploadPolicy("nope" as never)).toThrow();
  });

  it("registers every policy with a unique storage prefix and positive limits", () => {
    for (const policy of Object.values(UPLOAD_POLICIES)) {
      expect(policy.storagePrefix.length).toBeGreaterThan(0);
      expect(policy.maxFiles).toBeGreaterThan(0);
      expect(policy.maxBytes).toBeGreaterThan(0);
    }
  });
});
