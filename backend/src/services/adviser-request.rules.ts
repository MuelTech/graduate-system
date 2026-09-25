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

/**
 * Closed + retryable by Student (DECLINED / Dean REJECTED / legacy REJECTED).
 * status APPROVED is closed but NOT retryable.
 */
export function isRetryableClosedRequest(row: AdviserRequestRowLike): boolean {
  if (row.status === "APPROVED") return false;
  if (row.status === "REJECTED") return true;
  return row.adviserStatus === "DECLINED" || row.deanStatus === "REJECTED";
}

/** Closed and not retryable (legacy/current overall APPROVED, or Dean APPROVED). */
export function isFinalApprovedRequest(row: AdviserRequestRowLike): boolean {
  return row.status === "APPROVED" || row.deanStatus === "APPROVED";
}

export type AdviserResponseDecision = "CONFORMED" | "DECLINED";

export function isAdviserResponseDecision(
  value: unknown,
): value is AdviserResponseDecision {
  return value === "CONFORMED" || value === "DECLINED";
}

export type AdviserTransitionInput = {
  requestedAdviserId: string;
  authenticatedUserId: string;
  decision: string;
  adviserStatus: string;
  deanStatus: string;
  overallStatus?: string;
};

export type AdviserTransitionResult =
  | { allowed: true; decision: AdviserResponseDecision }
  | {
      allowed: false;
      reason: string;
      statusCode: number;
    };

/**
 * WP3: requested Adviser may respond only while adviserStatus is PENDING
 * and the request is not already closed by Adviser/Dean/overall status.
 */
export function evaluateAdviserResponseTransition(
  input: AdviserTransitionInput,
): AdviserTransitionResult {
  if (input.requestedAdviserId !== input.authenticatedUserId) {
    return {
      allowed: false,
      reason: "Only the requested adviser may respond to this request.",
      statusCode: 403,
    };
  }

  if (!isAdviserResponseDecision(input.decision)) {
    return {
      allowed: false,
      reason: "decision must be CONFORMED or DECLINED",
      statusCode: 400,
    };
  }

  if (
    input.deanStatus === "APPROVED" ||
    input.deanStatus === "REJECTED" ||
    input.overallStatus === "APPROVED" ||
    input.overallStatus === "REJECTED"
  ) {
    return {
      allowed: false,
      reason: "This adviser request is already closed and cannot be changed.",
      statusCode: 409,
    };
  }

  if (input.adviserStatus === "CONFORMED" || input.adviserStatus === "DECLINED") {
    return {
      allowed: false,
      reason: "Adviser has already responded to this request.",
      statusCode: 409,
    };
  }

  if (input.adviserStatus !== "PENDING") {
    return {
      allowed: false,
      reason: "Invalid adviser response transition.",
      statusCode: 409,
    };
  }

  return { allowed: true, decision: input.decision };
}

/**
 * Compatibility RequestStatus after an Adviser response.
 * CONFORMED → still PENDING (waiting for Dean).
 * DECLINED → REJECTED (closed + retryable; Dean fields untouched).
 */
export function mapAdviserResponseToOverallStatus(
  decision: AdviserResponseDecision,
): "PENDING" | "REJECTED" {
  return decision === "DECLINED" ? "REJECTED" : "PENDING";
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
