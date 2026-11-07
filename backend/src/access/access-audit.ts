import type { CapabilityKey } from "./capability-catalog";
import type { AdminAccessLevel } from "./account-access";

export const ACCESS_AUDIT_ACTIONS = Object.freeze({
  ADMINISTRATOR_CREATED: "ADMINISTRATOR_ACCESS_CREATED",
  ADMINISTRATOR_LEVEL_CHANGED: "ADMINISTRATOR_ACCESS_LEVEL_CHANGED",
  ADMINISTRATOR_STATUS_CHANGED: "ADMINISTRATOR_ACCESS_STATUS_CHANGED",
  ADMINISTRATOR_BOOTSTRAPPED: "ADMINISTRATOR_ACCESS_BOOTSTRAPPED",
  CAPABILITY_GRANTED: "ACCOUNT_CAPABILITY_GRANTED",
  CAPABILITY_REVOKED: "ACCOUNT_CAPABILITY_REVOKED",
} as const);
export type AccessAuditAction = typeof ACCESS_AUDIT_ACTIONS[keyof typeof ACCESS_AUDIT_ACTIONS];

/** Future deletion guards must also protect unknown future actions in these namespaces. */
export function isProtectedAccessAuditAction(action: unknown): boolean {
  return typeof action === "string" &&
    (action.startsWith("ADMINISTRATOR_ACCESS_") || action.startsWith("ACCOUNT_CAPABILITY_"));
}

export interface AccessAuditState {
  readonly administratorLevel: AdminAccessLevel | null;
  readonly capabilities: readonly CapabilityKey[];
  readonly isActive: boolean;
}

/** Transaction writers added later must persist this together with the access change. */
export interface AccessAuditEvent {
  readonly version: 1;
  readonly action: AccessAuditAction;
  readonly actorUserId: string;
  readonly targetUserId: string;
  readonly occurredAt: string;
  readonly before: AccessAuditState | null;
  readonly after: AccessAuditState | null;
}
