import type { AdminAccessLevel } from "./account-access";

/** Data contract only: no database connection, export runner, import or grant writer. */
export interface AccessPreflightInventory {
  readonly version: 1;
  readonly mode: "READ_ONLY";
  readonly sourceCommit: string;
  readonly capturedAt: string;
  readonly accounts: readonly {
    readonly userId: string;
    readonly currentRole: string;
    readonly isActive: boolean;
    readonly mustChangePassword: boolean;
    readonly panelist: {
      readonly id: string;
      readonly isActive: boolean;
      readonly isExternal: boolean;
      readonly isAvailableAsAdviser: boolean;
    } | null;
    readonly customRoleId: string | null;
    readonly administratorLevel: AdminAccessLevel | null;
    /** Raw observations: unknown keys are evidence, never converted into grants. */
    readonly directCapabilityKeys: readonly string[];
  }[];
  readonly legacyRoles: readonly {
    readonly id: string;
    readonly isActive: boolean;
    readonly features: readonly { readonly featureKey: string; readonly canView: boolean; readonly canEdit: boolean }[];
  }[];
  readonly integrity: {
    readonly migrationNames: readonly string[];
    readonly tables: readonly { readonly table: string; readonly rowCount: number; readonly identityDigest: string }[];
    readonly findings: readonly {
      readonly code: string;
      readonly userIds: readonly string[];
      readonly recordIds: readonly string[];
    }[];
  };
}

/** A blank template is deliberately not an inventory and cannot masquerade as zero users. */
export function createAccessPreflightTemplate() {
  return Object.freeze({
    version: 1 as const,
    mode: "READ_ONLY" as const,
    inventoryStatus: "NOT_COLLECTED" as const,
    requiredSections: Object.freeze(["accounts", "legacyRoles", "integrity"] as const),
  });
}
