import { isAcademicAccountRole } from "../utils/academic-account";
import {
  type AccessAccountCategory, type CapabilityKey, FULL_ADMINISTRATOR_CAPABILITIES,
  expandCapabilityPrerequisites, isCapabilityKey, validateDirectCapabilityKeys,
} from "./capability-catalog";

/** Deliberately code-owned/off. No environment variable can activate this foundation. */
export const DIRECT_ACCESS_ENFORCEMENT_ENABLED: boolean = false;
export const DIRECT_ACCESS_PHASE = "FOUNDATION_ONLY" as const;
export type AdminAccessLevel = "FULL" | "RESTRICTED";

export interface AccountAccessSnapshot {
  id: string;
  role: string;
  isActive: boolean;
  panelist: { isActive: boolean } | null;
  administratorAccess: { level: string } | null;
  capabilityGrants: readonly { capabilityKey: string }[];
}

export type AccessResolutionStatus =
  | "RESOLVED" | "NOT_FOUND" | "INACTIVE" | "UNSUPPORTED_ACCOUNT"
  | "MISSING_ADMIN_LEVEL" | "INVALID_CONFIGURATION" | "UNAVAILABLE";

/** Configuration preview, not an authenticated actor or academic assignment. */
export interface ConfiguredAccountAccess {
  readonly userId: string | null;
  readonly status: AccessResolutionStatus;
  readonly category: AccessAccountCategory | null;
  readonly administratorLevel: AdminAccessLevel | null;
  readonly capabilities: readonly CapabilityKey[];
}

export function deniedConfiguredAccess(
  userId: string | null, status: Exclude<AccessResolutionStatus, "RESOLVED">,
): ConfiguredAccountAccess {
  return Object.freeze({ userId, status, category: null, administratorLevel: null, capabilities: Object.freeze([]) });
}

export function resolveConfiguredAccountAccess(snapshot: AccountAccessSnapshot | null): ConfiguredAccountAccess {
  if (!snapshot) return deniedConfiguredAccess(null, "NOT_FOUND");
  const { id, role, isActive, administratorAccess, panelist } = snapshot;
  if (typeof id !== "string" || !id.trim()) return deniedConfiguredAccess(null, "INVALID_CONFIGURATION");
  if (isActive !== true) return deniedConfiguredAccess(id, "INACTIVE");
  const category = role === "ADMIN" ? "ADMIN" : isAcademicAccountRole(role) ? "FACULTY" : null;
  if (!category) return deniedConfiguredAccess(id, "UNSUPPORTED_ACCOUNT");
  if (category === "FACULTY" && (!panelist || panelist.isActive !== true)) {
    return deniedConfiguredAccess(id, "INACTIVE");
  }
  if (category === "ADMIN" && !administratorAccess) return deniedConfiguredAccess(id, "MISSING_ADMIN_LEVEL");
  if (category === "FACULTY" && administratorAccess) return deniedConfiguredAccess(id, "INVALID_CONFIGURATION");
  const level = administratorAccess?.level ?? null;
  if (category === "ADMIN" && level !== "FULL" && level !== "RESTRICTED") {
    return deniedConfiguredAccess(id, "INVALID_CONFIGURATION");
  }
  try {
    if (!Array.isArray(snapshot.capabilityGrants)) throw new Error("Missing grant collection.");
    const direct = validateDirectCapabilityKeys(category, snapshot.capabilityGrants.map(row => row.capabilityKey));
    const capabilities = level === "FULL"
      ? FULL_ADMINISTRATOR_CAPABILITIES
      : expandCapabilityPrerequisites(direct);
    return Object.freeze({
      userId: id, status: "RESOLVED", category,
      administratorLevel: level as AdminAccessLevel | null, capabilities,
    });
  } catch {
    // Includes unknown, duplicate, wrong-category and malformed persisted grants.
    return deniedConfiguredAccess(id, "INVALID_CONFIGURATION");
  }
}

export function hasConfiguredCapability(access: ConfiguredAccountAccess, key: unknown): boolean {
  return access.status === "RESOLVED" && isCapabilityKey(key) && access.capabilities.includes(key);
}

/** All live enforcement stays off, even for explicitly configured synthetic accounts. */
export function canAuthorizeDirectCapability(access: ConfiguredAccountAccess, key: unknown): boolean {
  return DIRECT_ACCESS_ENFORCEMENT_ENABLED && hasConfiguredCapability(access, key);
}
