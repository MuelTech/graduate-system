/**
 * GS-020 pure domain rules (WP2).
 * Candidate eligibility + request-path gates only — no workflow transitions.
 */

/** Working ODP mapping: Chairman + evaluator Panelists only. */
export const ADVISER_CANDIDATE_ROLES = ["CHAIRMAN", "PANELIST"] as const;

/** Explicitly excluded from adviser candidacy. */
export const EXCLUDED_ADVISER_ROLES = [
  "FACILITATOR",
  "RAPPORTEUR",
  "ADVISER",
] as const;

export function isAdviserCandidateRole(role: string): boolean {
  return (ADVISER_CANDIDATE_ROLES as readonly string[]).includes(role);
}

export type AdviserRequestRowLike = {
  adviserStatus: string;
  deanStatus: string;
  status?: string;
};

/**
 * A request still waiting for Adviser response or Dean review blocks a new request.
 *
 * Legacy RequestStatus compatibility (WP1 default-filled rows):
 * - status REJECTED is closed even if adviserStatus/deanStatus look PENDING
 * - status APPROVED is closed (not an open request)
 * - status PENDING (or missing) is evaluated using Adviser/Dean statuses
 */
export function isOpenAdviserRequest(row: AdviserRequestRowLike): boolean {
  if (row.status === "REJECTED" || row.status === "APPROVED") {
    return false;
  }
  if (row.adviserStatus === "PENDING") return true;
  if (row.adviserStatus === "CONFORMED" && row.deanStatus === "PENDING") {
    return true;
  }
  return false;
}

export function isRetryableClosedRequest(row: AdviserRequestRowLike): boolean {
  if (row.status === "REJECTED" || row.status === "APPROVED") {
    return true;
  }
  return row.adviserStatus === "DECLINED" || row.deanStatus === "REJECTED";
}

export type TitleDefenseGateInput = {
  hasPassedTitleConclusion: boolean;
  hasOfficialSelectedTitle: boolean;
};

export type TitleDefenseGateResult =
  | { allowed: true }
  | { allowed: false; reason: string; statusCode: number };

/** Backend unlock: formal Title Defense PASSED + official selected title. */
export function evaluateTitleDefenseGate(
  input: TitleDefenseGateInput,
): TitleDefenseGateResult {
  if (!input.hasPassedTitleConclusion) {
    return {
      allowed: false,
      reason:
        "Adviser Request requires a formally PASSED Title Defense conclusion.",
      statusCode: 400,
    };
  }
  if (!input.hasOfficialSelectedTitle) {
    return {
      allowed: false,
      reason:
        "Adviser Request requires an official selected title from Title Defense conclusion.",
      statusCode: 400,
    };
  }
  return { allowed: true };
}

export type CandidateEligibilityInput = {
  defenseRole: string;
  /** Must be a real PANELIST user account. */
  userRole: string;
  userIsActive: boolean;
  /** Missing Panelist profile is NOT implicitly active/available. */
  hasPanelistProfile: boolean;
  panelistIsActive?: boolean | null;
  isAvailableAsAdviser?: boolean | null;
};

export type CandidateEligibilityResult =
  | { eligible: true }
  | { eligible: false; reason: string };

/**
 * GS-020 adviser candidacy requires ALL of:
 * - ODP role CHAIRMAN or PANELIST
 * - User.role = PANELIST
 * - User.isActive
 * - Panelist profile exists
 * - Panelist.isActive
 * - Panelist.isAvailableAsAdviser
 * No adviser load caps.
 */
export function evaluateCandidateEligibility(
  input: CandidateEligibilityInput,
): CandidateEligibilityResult {
  if (!isAdviserCandidateRole(input.defenseRole)) {
    return {
      eligible: false,
      reason: `Role ${input.defenseRole} is not eligible for adviser candidacy. Only Chairman and Panelist may be requested.`,
    };
  }
  if (input.userRole !== "PANELIST") {
    return {
      eligible: false,
      reason: "Adviser candidate must have a PANELIST user role.",
    };
  }
  if (!input.userIsActive) {
    return { eligible: false, reason: "User account is inactive." };
  }
  if (!input.hasPanelistProfile) {
    return {
      eligible: false,
      reason: "Adviser candidate requires an active Panelist profile.",
    };
  }
  if (input.panelistIsActive === false) {
    return { eligible: false, reason: "Panelist profile is inactive." };
  }
  if (input.isAvailableAsAdviser === false) {
    return {
      eligible: false,
      reason: "Panelist is not available as adviser.",
    };
  }
  return { eligible: true };
}
