import type {
  ActiveAdviserContext,
  AdviserSeatMode,
  CommitteeAssignmentInput,
  CommitteeValidationResult,
  DefenseCommitteePolicyConfig,
  DefensePanelRole,
  ProgramTypeKey,
} from "../interfaces/defense-committee.interfaces";
import type { DefenseTypeName } from "../interfaces/defense-eligibility.interfaces";

/**
 * Centralized defense-committee policy (source of truth §3.3 / §12, confirmed
 * 2026-10-12 client clarification).
 *
 * Stage-specific, program-specific role quotas:
 *   TITLE  Master's  = 1 Chairman + 4 Panelists + 1 Facilitator + 1 Rapporteur (7, no Adviser)
 *   TITLE  Doctoral  = 1 Chairman + 5 Panelists + 1 Facilitator + 1 Rapporteur (8, no Adviser)
 *   PROP/FIN Master's= 1 active Adviser (auto) + 1 Chairman + 3 Panelists + 1 Facilitator + 1 Rapporteur (7)
 *   PROP/FIN Doctoral= 1 active Adviser (auto) + 1 Chairman + 4 Panelists + 1 Facilitator + 1 Rapporteur (8)
 *
 * Committee composition is authoritative here. It does NOT decide evaluator
 * numeric-scoring or signatory authority (that remains separate / OPEN_QUESTION).
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

/** Exact Panelist quota by stage + program type (2026-10-12 confirmed). */
function panelistCountFor(
  defenseType: DefenseTypeName,
  programType: ProgramTypeKey,
): number {
  const isDoctoral = programType === "DOCTORAL";
  const isTitle = defenseType === "TITLE_DEFENSE";
  if (isTitle) return isDoctoral ? 5 : 4;
  return isDoctoral ? 4 : 3;
}

function buildPolicy(
  defenseType: DefenseTypeName,
  programType: ProgramTypeKey,
  sessionTotal: number,
): DefenseCommitteePolicyConfig {
  const academicSeatCount = sessionTotal - 2; // minus Facilitator + Rapporteur
  const isTitle = defenseType === "TITLE_DEFENSE";
  const adviserMode: AdviserSeatMode = isTitle ? "NONE" : "AUTOMATIC";
  const panelistCount = panelistCountFor(defenseType, programType);
  return {
    allowedRoles: isTitle ? COMMON_ROLES : PROPOSAL_FINAL_ROLES,
    requiredRoles: isTitle ? ["CHAIRMAN"] : ["CHAIRMAN", "ADVISER"],
    sessionTotal,
    academicSeatCount,
    panelistCount,
    adviserMode,
    manualSelectionCount:
      sessionTotal - (adviserMode === "AUTOMATIC" ? 1 : 0),
    facilitatorRequired: true,
    rapporteurRequired: true,
    maximumRoleCount: {
      ADVISER: adviserMode === "AUTOMATIC" ? 1 : 0,
      FACILITATOR: 1,
      RAPPORTEUR: 1,
      CHAIRMAN: 1,
      PANELIST: panelistCount,
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
    const total = getSessionTotal(programType) ?? SESSION_TOTALS.MASTERS;
    return buildPolicy(defenseType, programType, total);
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
    // RAP-1: RAP / Committee Report required signatories are stage-aware and
    // centralized in rap-signature.policy.ts (getRapSignatoryRoles). They are
    // deliberately distinct from the numerical evaluator roles above. This
    // compatibility helper is not the RAP signatory authority.
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

    // Exactly one Chairman / Facilitator / Rapporteur on every stage.
    if ((roleCounts.CHAIRMAN ?? 0) !== 1) {
      errors.push("Defense committee requires exactly one CHAIRMAN.");
    }
    if ((roleCounts.FACILITATOR ?? 0) !== 1) {
      errors.push("Defense committee requires exactly one FACILITATOR.");
    }
    if ((roleCounts.RAPPORTEUR ?? 0) !== 1) {
      errors.push("Defense committee requires exactly one RAPPORTEUR.");
    }

    // Stage/program-specific Panelist quota.
    if ((roleCounts.PANELIST ?? 0) !== policy.panelistCount) {
      errors.push(
        `Defense committee requires exactly ${policy.panelistCount} PANELIST assignment(s) for this stage (got ${roleCounts.PANELIST ?? 0}).`,
      );
    }

    // Adviser seat: absent at Title; exactly one (the active adviser) at Proposal/Final.
    if (policy.adviserMode === "NONE") {
      if ((roleCounts.ADVISER ?? 0) > 0) {
        errors.push("This defense stage does not include an ADVISER seat.");
      }
    } else if ((roleCounts.ADVISER ?? 0) !== 1) {
      errors.push(
        "Proposal/Final Defense requires exactly one ADVISER assignment (the student's active adviser).",
      );
    } else {
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

    // Confirmed session total (7 Master's / 8 Doctoral).
    if (assignments.length !== policy.sessionTotal) {
      errors.push(
        `Defense session for ${programType} requires exactly ${policy.sessionTotal} participants (got ${assignments.length}).`,
      );
    }

    // Academic seats (CHAIRMAN + PANELIST + Adviser) fill the non-official slots.
    const academicUsed =
      (roleCounts.CHAIRMAN ?? 0) +
      (roleCounts.PANELIST ?? 0) +
      (roleCounts.ADVISER ?? 0);
    if (academicUsed !== policy.academicSeatCount) {
      errors.push(
        `Committee academic seats must total ${policy.academicSeatCount} (CHAIRMAN/PANELIST/Adviser); got ${academicUsed}.`,
      );
    }

    return { valid: errors.length === 0, errors };
  }
}
