import { AppError } from "../utils/AppError";
import { PROPOSAL_MANUSCRIPT_MIME_ALLOWLIST } from "../services/proposal-adviser-review.rules";

/**
 * DL-2: centralized, typed upload policies.
 *
 * Client MIME/extension/filename are never authoritative. Policies declare the
 * byte-detected content types accepted for a category. Categories whose exact
 * institutional formats are unresolved use a permissive policy
 * (`allowedMimeTypes: null`) so existing accepted behavior is not narrowed by
 * invented restrictions; size/count/empty/cleanup still apply.
 */

export interface UploadPolicy {
  name: string;
  /** Managed-storage key namespace for promoted permanent objects. */
  storagePrefix: string;
  maxFiles: number;
  maxBytes: number;
  /** Allowed verified MIME types, or null for unresolved/permissive categories. */
  allowedMimeTypes: readonly string[] | null;
  /**
   * Extensions accepted only when byte detection yields no MIME (legacy Word).
   * Never a substitute for detection when a MIME is present.
   */
  fallbackExtensionsWhenUndetected: readonly string[];
}

function parseMaxUploadBytes(raw: string | undefined): number {
  const parsed = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 5242880;
}

export const DEFAULT_MAX_UPLOAD_BYTES = parseMaxUploadBytes(
  process.env.MAX_FILE_SIZE,
);

function policy(p: Omit<UploadPolicy, "maxBytes"> & { maxBytes?: number }): UploadPolicy {
  return { maxBytes: p.maxBytes ?? DEFAULT_MAX_UPLOAD_BYTES, ...p };
}

export const UPLOAD_POLICIES = {
  "applicant-cor": policy({
    name: "applicant-cor",
    storagePrefix: "cor",
    maxFiles: 1,
    allowedMimeTypes: ["application/pdf", "image/jpeg", "image/png"],
    fallbackExtensionsWhenUndetected: [],
  }),
  "proposal-manuscript": policy({
    name: "proposal-manuscript",
    storagePrefix: "manuscripts",
    maxFiles: 1,
    // Same accepted set as ProposalAdviserReviewService.
    allowedMimeTypes: [...PROPOSAL_MANUSCRIPT_MIME_ALLOWLIST],
    fallbackExtensionsWhenUndetected: ["pdf", "doc", "docx"],
  }),
  "final-manuscript": policy({
    name: "final-manuscript",
    storagePrefix: "manuscripts",
    maxFiles: 1,
    allowedMimeTypes: [...PROPOSAL_MANUSCRIPT_MIME_ALLOWLIST],
    fallbackExtensionsWhenUndetected: ["pdf", "doc", "docx"],
  }),
  "defense-evidence": policy({
    name: "defense-evidence",
    storagePrefix: "evidence",
    maxFiles: 5,
    // Title package / COR / receipt formats are unresolved (DL-6).
    allowedMimeTypes: null,
    fallbackExtensionsWhenUndetected: [],
  }),
  "evaluation-instrument": policy({
    name: "evaluation-instrument",
    storagePrefix: "instruments",
    maxFiles: 1,
    // Research-instrument formats remain CLIENT_CONFIRMATION_REQUIRED.
    allowedMimeTypes: null,
    fallbackExtensionsWhenUndetected: [],
  }),
} as const;

export type UploadPolicyName = keyof typeof UPLOAD_POLICIES;

/**
 * DL-11: the deduplicated set of managed permanent namespaces. Health/scan
 * derive this from `UPLOAD_POLICIES` instead of duplicating the prefix strings
 * in multiple modules. `.tmp` is intentionally NOT a managed namespace.
 */
export const MANAGED_STORAGE_PREFIXES: readonly string[] = Array.from(
  new Set(Object.values(UPLOAD_POLICIES).map((entry) => entry.storagePrefix)),
);

export function getUploadPolicy(name: UploadPolicyName): UploadPolicy {
  const found = (UPLOAD_POLICIES as Record<string, UploadPolicy | undefined>)[
    name
  ];
  if (!found) {
    throw new AppError("Unknown upload policy.", 500);
  }
  return found;
}
