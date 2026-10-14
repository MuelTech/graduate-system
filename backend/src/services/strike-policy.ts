/**
 * Centralized STRIKE / Plagiarism-before-Final policy.
 *
 * Single authority used by:
 *  - Student Thesis Journey STRIKE step
 *  - Final Defense application eligibility
 *  - Final Defense scheduling eligibility
 *
 * Default follows current established Final gates (OFF — client confirmation
 * required before making STRIKE mandatory). Optional ops override via env:
 *   STRIKE_BEFORE_FINAL_REQUIRED=true|false
 *
 * Do not add a second boolean elsewhere in the Final gate path.
 */
import {
  DEFAULT_FINAL_OPTIONAL_GATES,
  type FinalOptionalGateFlags,
} from "./defense-gates.config";

export interface StrikePolicy {
  /** Whether an eligible plagiarism result is required before Final Defense. */
  required: boolean;
  source: "DEFAULT" | "ENV";
}

export function resolveStrikePolicy(): StrikePolicy {
  const raw = String(process.env.STRIKE_BEFORE_FINAL_REQUIRED ?? "")
    .trim()
    .toLowerCase();
  if (raw === "true" || raw === "1" || raw === "yes") {
    return { required: true, source: "ENV" };
  }
  if (raw === "false" || raw === "0" || raw === "no") {
    return { required: false, source: "ENV" };
  }
  return {
    required: DEFAULT_FINAL_OPTIONAL_GATES.requireStrike,
    source: "DEFAULT",
  };
}

/** Final optional gates with the shared STRIKE policy applied. */
export function getFinalOptionalGates(): FinalOptionalGateFlags {
  return {
    ...DEFAULT_FINAL_OPTIONAL_GATES,
    requireStrike: resolveStrikePolicy().required,
  };
}
