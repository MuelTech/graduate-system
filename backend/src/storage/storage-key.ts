import crypto from "crypto";
import { AppError } from "../utils/AppError";

/**
 * DL-1: stable managed-storage key rules.
 *
 * A storage key is a provider-agnostic, non-public identifier for a managed
 * object. It is always a normalized relative POSIX-style path (forward
 * slashes) that can never be absolute, contain a parent traversal, contain a
 * null byte, or use platform-specific separators. The local provider resolves
 * keys against the configured private storage root and separately enforces
 * root containment, so key validation here is the first of two guards.
 */

const SEGMENT_PATTERN = /^[A-Za-z0-9._-]+$/;

export function normalizeStorageKey(key: string): string {
  if (typeof key !== "string" || key.length === 0) {
    throw new AppError("Invalid storage key.", 400);
  }
  if (key.includes("\u0000") || key.includes("\\")) {
    throw new AppError("Invalid storage key.", 400);
  }
  if (key.startsWith("/")) {
    throw new AppError("Invalid storage key.", 400);
  }
  // Reject Windows drive-letter roots (e.g. "C:/...") before segment checks.
  if (/^[A-Za-z]:/.test(key)) {
    throw new AppError("Invalid storage key.", 400);
  }

  const segments = key.split("/");
  for (const segment of segments) {
    if (segment.length === 0 || segment === "." || segment === "..") {
      throw new AppError("Invalid storage key.", 400);
    }
    if (!SEGMENT_PATTERN.test(segment)) {
      throw new AppError("Invalid storage key.", 400);
    }
  }

  return segments.join("/");
}

export function isValidStorageKey(key: string): boolean {
  try {
    normalizeStorageKey(key);
    return true;
  } catch {
    return false;
  }
}

/**
 * Generates a new random storage key, optionally namespaced by a trusted
 * caller-supplied prefix (e.g. "cor", "thesis"). The prefix is validated with
 * the same rules rather than trusted blindly.
 */
export function generateStorageKey(prefix?: string): string {
  const randomName = crypto.randomBytes(24).toString("hex");
  if (prefix === undefined) return randomName;
  const normalizedPrefix = normalizeStorageKey(prefix);
  return `${normalizedPrefix}/${randomName}`;
}
