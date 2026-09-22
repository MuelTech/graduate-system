import type {
  ActiveAdviserContext,
  CommitteeAssignmentInput,
  CommitteeValidationResult,
  DefenseCommitteePolicyConfig,
  DefensePanelRole,
  ProgramTypeKey,
} from "../interfaces/defense-committee.interfaces";
import type { DefenseTypeName } from "../interfaces/defense-eligibility.interfaces";

/**
 * Centralized defense-committee policy.
 *
 * Exact Master's / Doctoral committee sizes are NOT hardcoded here —
 * they remain null until the client confirms. Change this module only
 * when those rules are confirmed.
 */
const COMMON_ROLES: DefensePanelRole[] = [
  "CHAIRMAN",
  "PANELIST",
  "FACILITATOR",
  "RAPPORTEUR",
];

const PROPOSAL_FINAL_ROLES: DefensePanelRole[] = [
  ...COMMON_ROLES,
  "ADVISER",
];

/** Provisional evaluator policy until client confirms Adviser scoring. */
const DEFAULT_EVALUATORS: DefensePanelRole[] = ["CHAIRMAN", "PANELIST"];

const DEFAULT_MAX_ROLE_COUNT: Partial<Record<DefensePanelRole, number | null>> =
  {
    ADVISER: 1,
    FACILITATOR: 1,
    RAPPORTEUR: 1,
    CHAIRMAN: 1,
    PANELIST: null,
  };

export const DEFENSE_COMMITTEE_POLICIES: Record<
  DefenseTypeName,
  DefenseCommitteePolicyConfig
> = {
  TITLE_DEFENSE: {
    allowedRoles: COMMON_ROLES,
    requiredRoles: ["CHAIRMAN"],
    minimumPanelists: null,
    maximumPanelists: null,
    maximumRoleCount: { ...DEFAULT_MAX_ROLE_COUNT, ADVISER: 0 },
    evaluatorRoles: DEFAULT_EVALUATORS,
    rapporteurRequired: false,
    facilitatorRequired: false,
  },
  PROPOSAL_DEFENSE: {
    allowedRoles: PROPOSAL_FINAL_ROLES,
    requiredRoles: ["CHAIRMAN"],
    minimumPanelists: null,
    maximumPanelists: null,
    maximumRoleCount: DEFAULT_MAX_ROLE_COUNT,
    evaluatorRoles: DEFAULT_EVALUATORS,
    rapporteurRequired: false,
    facilitatorRequired: false,
  },
  FINAL_DEFENSE: {
    allowedRoles: PROPOSAL_FINAL_ROLES,
    requiredRoles: ["CHAIRMAN"],
    minimumPanelists: null,
    maximumPanelists: null,
    maximumRoleCount: DEFAULT_MAX_ROLE_COUNT,
    evaluatorRoles: DEFAULT_EVALUATORS,
    rapporteurRequired: false,
    facilitatorRequired: false,
  },
};

export class DefenseCommitteePolicy {
  getPolicy(defenseType: DefenseTypeName): DefenseCommitteePolicyConfig {
    return DEFENSE_COMMITTEE_POLICIES[defenseType];
  }

  isRoleAllowed(defenseType: DefenseTypeName, role: DefensePanelRole): boolean {
    return this.getPolicy(defenseType).allowedRoles.includes(role);
  }

  getEvaluatorRoles(defenseType: DefenseTypeName): DefensePanelRole[] {
    return [...this.getPolicy(defenseType).evaluatorRoles];
  }

  isEvaluatorRole(
    defenseType: DefenseTypeName,
    role: DefensePanelRole,
  ): boolean {
    return this.getPolicy(defenseType).evaluatorRoles.includes(role);
  }

  getRequiredSignatoryRoles(defenseType: DefenseTypeName): DefensePanelRole[] {
    // Signatory set stays policy-driven; required roles + rapporteur when mandated.
    const policy = this.getPolicy(defenseType);
    const roles = new Set<DefensePanelRole>(policy.requiredRoles);
    if (policy.rapporteurRequired) roles.add("RAPPORTEUR");
    return [...roles];
  }

  validateAssignments(
    defenseType: DefenseTypeName,
    _programType: ProgramTypeKey,
    assignments: CommitteeAssignmentInput[],
    adviserContext?: ActiveAdviserContext,
  ): CommitteeValidationResult {
    const policy = this.getPolicy(defenseType);
    const errors: string[] = [];

    if (!Array.isArray(assignments) || assignments.length === 0) {
      errors.push("Defense committee must include at least one assignment.");
      return { valid: false, errors };
    }

    const seenUsers = new Set<string>();
    const roleCounts: Partial<Record<DefensePanelRole, number>> = {};

    for (const assignment of assignments) {
      const { userId, role } = assignment;

      if (!userId) {
        errors.push("Each committee assignment must include a userId.");
        continue;
      }
      if (seenUsers.has(userId)) {
        errors.push("The same user cannot be assigned twice to one defense.");
      }
      seenUsers.add(userId);

      if (!this.isRoleAllowed(defenseType, role)) {
        if (defenseType === "TITLE_DEFENSE" && role === "ADVISER") {
          errors.push("Title Defense cannot include an ADVISER assignment.");
        } else {
          errors.push(`Role ${role} is not allowed for ${defenseType}.`);
        }
        continue;
      }

      roleCounts[role] = (roleCounts[role] ?? 0) + 1;
    }

    for (const [role, max] of Object.entries(policy.maximumRoleCount)) {
      const r = role as DefensePanelRole;
      const count = roleCounts[r] ?? 0;
      if (max != null && count > max) {
        errors.push(
          max === 0
            ? `Role ${r} is not allowed for ${defenseType}.`
            : `At most ${max} ${r} assignment(s) allowed (got ${count}).`,
        );
      }
    }

    for (const required of policy.requiredRoles) {
      if ((roleCounts[required] ?? 0) < 1) {
        errors.push(`Defense committee requires a ${required}.`);
      }
    }

    if (policy.rapporteurRequired && (roleCounts.RAPPORTEUR ?? 0) < 1) {
      errors.push("Defense committee requires a RAPPORTEUR.");
    }
    if (policy.facilitatorRequired && (roleCounts.FACILITATOR ?? 0) < 1) {
      errors.push("Defense committee requires a FACILITATOR.");
    }

    if (
      policy.minimumPanelists != null &&
      assignments.length < policy.minimumPanelists
    ) {
      errors.push(
        `Defense committee requires at least ${policy.minimumPanelists} members.`,
      );
    }
    if (
      policy.maximumPanelists != null &&
      assignments.length > policy.maximumPanelists
    ) {
      errors.push(
        `Defense committee allows at most ${policy.maximumPanelists} members.`,
      );
    }

    // Proposal/Final: when an ADVISER seat is used, it must be the active adviser.
    if (
      (defenseType === "PROPOSAL_DEFENSE" || defenseType === "FINAL_DEFENSE") &&
      (roleCounts.ADVISER ?? 0) > 0
    ) {
      const adviserUserIds = assignments
        .filter((a) => a.role === "ADVISER")
        .map((a) => a.userId);
      const expected = adviserContext?.adviserUserId ?? null;
      if (!expected) {
        errors.push(
          "Proposal/Final Defense requires an active thesis adviser relationship before assigning ADVISER.",
        );
      } else if (!adviserUserIds.includes(expected)) {
        errors.push(
          "ADVISER assignment must be the student's active thesis adviser.",
        );
      }
    }

    return { valid: errors.length === 0, errors };
  }
}
