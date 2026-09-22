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
 * Centralized defense-committee policy (source of truth §12).
 *
 * Confirmed: session totals 7 (Master's) / 8 (Doctoral); Facilitator + Rapporteur
 * required; no auto Adviser seat; no duplicate person.
 *
 * NOT hard-coded: exact Master's/Doctoral scorer counts, Chairman/Adviser seat
 * counting semantics, Adviser scoring (OPEN_QUESTION).
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

/** Facilitator/Rapporteur never score; Adviser scoring is OPEN_QUESTION. */
const EVALUATOR_ROLES: DefensePanelRole[] = ["CHAIRMAN", "PANELIST"];

const SESSION_TOTALS = {
  MASTERS: 7,
  DOCTORAL: 8,
} as const;

function buildPolicy(
  defenseType: DefenseTypeName,
  sessionTotal: number,
): DefenseCommitteePolicyConfig {
  const academicSeatCount = sessionTotal - 2; // minus Facilitator + Rapporteur
  const isTitle = defenseType === "TITLE_DEFENSE";
  return {
    allowedRoles: isTitle ? COMMON_ROLES : PROPOSAL_FINAL_ROLES,
    requiredRoles: ["CHAIRMAN"],
    sessionTotal,
    academicSeatCount,
    facilitatorRequired: true,
    rapporteurRequired: true,
    maximumRoleCount: {
      ADVISER: isTitle ? 0 : 1,
      FACILITATOR: 1,
      RAPPORTEUR: 1,
      CHAIRMAN: 1,
      PANELIST: academicSeatCount, // remaining after chair/adviser; total academic seats still enforced
    },
    evaluatorRoles: EVALUATOR_ROLES,
    scorerCountPolicy: "UNRESOLVED_DO_NOT_HARDCODE",
  };
}

export function getSessionTotal(programType: ProgramTypeKey): number | null {
  if (programType === "MASTERS") return SESSION_TOTALS.MASTERS;
  if (programType === "DOCTORAL") return SESSION_TOTALS.DOCTORAL;
  return null;
}

export class DefenseCommitteePolicy {
  getPolicy(
    defenseType: DefenseTypeName,
    programType: ProgramTypeKey = "UNKNOWN",
  ): DefenseCommitteePolicyConfig {
    // Default to Master's layout for UI introspection when program is unknown;
    // validateAssignments still rejects UNKNOWN programType at schedule time.
    const total =
      getSessionTotal(programType) ?? SESSION_TOTALS.MASTERS;
    return buildPolicy(defenseType, total);
  }

  isRoleAllowed(defenseType: DefenseTypeName, role: DefensePanelRole): boolean {
    return this.getPolicy(defenseType).allowedRoles.includes(role);
  }

  getEvaluatorRoles(defenseType: DefenseTypeName): DefensePanelRole[] {
    return [...EVALUATOR_ROLES];
  }

  isEvaluatorRole(
    defenseType: DefenseTypeName,
    role: DefensePanelRole,
  ): boolean {
    return EVALUATOR_ROLES.includes(role);
  }

  getRequiredSignatoryRoles(defenseType: DefenseTypeName): DefensePanelRole[] {
    // UNRESOLVED (§15.3 OPEN_QUESTION): form-specific RAP / GS-011 signatories.
    // Interim default lives in rap-signature.policy.ts (all assigned participants).
    return ["CHAIRMAN"];
  }

  validateAssignments(
    defenseType: DefenseTypeName,
    programType: ProgramTypeKey,
    assignments: CommitteeAssignmentInput[],
    adviserContext?: ActiveAdviserContext,
  ): CommitteeValidationResult {
    const errors: string[] = [];

    if (programType === "UNKNOWN") {
      errors.push(
        "Student program type (Master's/Doctoral) is required to validate the defense committee.",
      );
      return { valid: false, errors };
    }

    const policy = this.getPolicy(defenseType, programType);

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

    // Session officials (form-supported): exactly one Facilitator and one Rapporteur.
    if ((roleCounts.FACILITATOR ?? 0) !== 1) {
      errors.push("Defense committee requires exactly one FACILITATOR.");
    }
    if ((roleCounts.RAPPORTEUR ?? 0) !== 1) {
      errors.push("Defense committee requires exactly one RAPPORTEUR.");
    }

    // Chairman designation (kept as explicit role until seat-counting is confirmed).
    if ((roleCounts.CHAIRMAN ?? 0) !== 1) {
      errors.push("Defense committee requires exactly one CHAIRMAN.");
    }

    if ((roleCounts.ADVISER ?? 0) > 1) {
      errors.push("At most one ADVISER assignment is allowed.");
    }

    // Confirmed session total (7 Master's / 8 Doctoral).
    if (assignments.length !== policy.sessionTotal) {
      errors.push(
        `Defense session for ${programType} requires exactly ${policy.sessionTotal} participants (got ${assignments.length}).`,
      );
    }

    // Academic seats (CHAIRMAN + PANELIST + optional ADVISER) fill the non-official slots.
    const academicUsed =
      (roleCounts.CHAIRMAN ?? 0) +
      (roleCounts.PANELIST ?? 0) +
      (roleCounts.ADVISER ?? 0);
    if (academicUsed !== policy.academicSeatCount) {
      errors.push(
        `Committee academic seats must total ${policy.academicSeatCount} (CHAIRMAN/PANELIST/optional ADVISER); got ${academicUsed}.`,
      );
    }

    // Proposal/Final: an explicit ADVISER seat must be the active adviser (never auto-injected).
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
