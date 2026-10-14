/**
 * UIUX-4A — Student Dashboard presentation projections (pure, no I/O).
 *
 * Interprets the authoritative Student Thesis Journey DTO into the Dashboard's
 * "Your Next Step", milestone overview, and defense-schedule display. It creates
 * no academic state, eligibility, or mutation authority:
 *
 * - next-action classification is gated on the canonical step `state`
 *   (CURRENT / AVAILABLE) plus the precise `defenseStatus`; a `nextAction`
 *   string alone never proves that an action is currently authorized;
 * - WAITING stays waiting, LOCKED exposes no enabled action;
 * - rejected/failed/revision/cancelled are distinct from ordinary waiting.
 */
import {
  defenseStatusDescription,
  JOURNEY_STEP_ORDER,
  journeyLabelFor,
  JOURNEY_STEP_ROUTES,
} from "@/lib/student-thesis-journey";
import type {
  DefenseSessionSummary,
  DefenseSubstatus,
  JourneyStepKey,
  JourneyStepView,
  StudentThesisJourney,
} from "@/types/student-thesis-journey";

/* ------------------------------------------------------------------ labels */

export function compExamStatusLabel(status: string | null | undefined): string {
  switch (String(status ?? "").toUpperCase()) {
    case "PASSED":
      return "Passed";
    case "FAILED":
      return "Failed";
    case "PENDING":
      return "Pending";
    default:
      return "Not recorded";
  }
}

const STEP_HEADINGS: Record<JourneyStepKey, string> = {
  TITLE_DEFENSE: "Prepare your Title Defense",
  ADVISER_REQUEST: "Request your Thesis Adviser",
  PROPOSAL_DEFENSE: "Prepare your Proposal Defense",
  STRIKE: "Complete your STRIKE / Plagiarism check",
  FINAL_DEFENSE: "Prepare your Final Defense",
};

const STEP_ACTIONS: Record<JourneyStepKey, string> = {
  TITLE_DEFENSE: "Open Title Defense",
  ADVISER_REQUEST: "Request an Adviser",
  PROPOSAL_DEFENSE: "Open Proposal Defense",
  STRIKE: "Open STRIKE / Plagiarism",
  FINAL_DEFENSE: "Open Final Defense",
};

function stepKind(
  key: JourneyStepKey,
): "Title" | "Proposal" | "Final" | null {
  if (key === "TITLE_DEFENSE") return "Title";
  if (key === "PROPOSAL_DEFENSE") return "Proposal";
  if (key === "FINAL_DEFENSE") return "Final";
  return null;
}

/* ------------------------------------------------------------------- venue */

export type VenueResolution =
  | { kind: "online"; url: string }
  | { kind: "physical"; text: string }
  | { kind: "none" };

function safeHttpUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!/^https?:\/\//i.test(trimmed)) return null;
  if (/\s/.test(trimmed)) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** Presentation-only interpretation of `venueOrLink`. No delivery-mode state. */
export function resolveDefenseVenue(
  venueOrLink: string | null | undefined,
): VenueResolution {
  const raw = String(venueOrLink ?? "").trim();
  if (!raw) return { kind: "none" };
  const url = safeHttpUrl(raw);
  if (url) return { kind: "online", url };
  return { kind: "physical", text: raw };
}

/* ----------------------------------------------------------- active session */

const ACTIVE_SESSION_STATUSES = new Set([
  "SCHEDULED",
  "IN_PROGRESS",
  "AWAITING_CONCLUSION",
]);

export interface ActiveDefense {
  stepKey: JourneyStepKey;
  label: string;
  session: DefenseSessionSummary;
}

/**
 * The relevant live/upcoming defense session: the first canonical step that
 * exposes an active `defenseSession`. Concluded/cancelled sessions are never
 * presented as upcoming.
 */
export function activeDefense(journey: StudentThesisJourney): ActiveDefense | null {
  for (const key of JOURNEY_STEP_ORDER) {
    const step = journey.steps.find((s) => s.key === key);
    const session = step?.defenseSession;
    if (session && ACTIVE_SESSION_STATUSES.has(String(session.sessionStatus))) {
      return {
        stepKey: key,
        label: journeyLabelFor(key, step?.label),
        session,
      };
    }
  }
  return null;
}

/* --------------------------------------------------------------- next step */

export type NextStepKind =
  | "ACTION"
  | "WAITING"
  | "LOCKED"
  | "REJECTED"
  | "FAILED"
  | "REVISION"
  | "CANCELLED"
  | "COMPLETED"
  | "UNAVAILABLE";

export interface DashboardNextStep {
  kind: NextStepKind;
  stepKey: JourneyStepKey | null;
  heading: string;
  explanation: string;
  statusLabel: string | null;
  action: { label: string; href: string } | null;
  secondaryAction: { label: string; href: string } | null;
}

function journeyLink(): { label: string; href: string } {
  return { label: "Review Thesis Journey", href: "/student/thesis" };
}

function waitingHeading(
  step: JourneyStepView,
  label: string,
  defenseStatus: DefenseSubstatus | null,
): string {
  switch (defenseStatus) {
    case "APPLICATION_UNDER_REVIEW":
      return `${label} under Admin review`;
    case "APPROVED_WAITING_SCHEDULE":
      return `${label} approved — awaiting schedule`;
    case "SCHEDULED":
      return `${label} scheduled`;
    case "DEFENSE_IN_PROGRESS":
      return `${label} in progress`;
    case "AWAITING_CONCLUSION":
      return `Awaiting the ${label} result`;
    case "FINALIZING_RECORDS":
      return `Finalizing ${label} records`;
    default:
      break;
  }
  // Non-defense waiting (Adviser Request): distinguish adviser vs Dean.
  const reason = step.lockReason ?? "";
  if (/dean/i.test(reason)) return "Waiting for Dean approval";
  if (/adviser/i.test(reason)) return "Waiting for adviser response";
  return `Waiting: ${label}`;
}

/**
 * Canonical projection of the authoritative Journey into one Dashboard next-step
 * presentation. Never fabricates an actionable state for a waiting/locked step.
 */
export function resolveNextStep(
  journey: StudentThesisJourney,
): DashboardNextStep {
  const currentKey = journey.currentStep;

  if (!currentKey) {
    return {
      kind: "COMPLETED",
      stepKey: null,
      heading: "Thesis journey completed",
      explanation:
        "All recorded thesis milestones are complete. Graduation and final clearance are confirmed separately by the Graduate School.",
      statusLabel: "Completed",
      action: { label: "Review Thesis Journey", href: "/student/thesis" },
      secondaryAction: null,
    };
  }

  const step = journey.steps.find((s) => s.key === currentKey);
  if (!step) {
    return {
      kind: "UNAVAILABLE",
      stepKey: currentKey,
      heading: "Thesis status unavailable",
      explanation:
        "Your current thesis status could not be determined. Open the Thesis Journey for details.",
      statusLabel: null,
      action: { label: "Open Thesis Journey", href: "/student/thesis" },
      secondaryAction: null,
    };
  }

  const label = journeyLabelFor(step.key, step.label);
  const route = JOURNEY_STEP_ROUTES[step.key];
  const kind = stepKind(step.key);
  const ds = step.defenseStatus ?? null;

  // Precise terminal/actionable substatuses first.
  if (ds === "REJECTED") {
    return {
      kind: "REJECTED",
      stepKey: step.key,
      heading: `${label} application returned`,
      explanation:
        step.detail ||
        (kind ? defenseStatusDescription(ds, kind, null) : null) ||
        "Review the feedback and resubmit your application.",
      statusLabel: "Action required",
      action: { label: `Resubmit ${label}`, href: route },
      secondaryAction: journeyLink(),
    };
  }
  if (ds === "FAILED") {
    return {
      kind: "FAILED",
      stepKey: step.key,
      heading: `${label} result: Failed`,
      explanation:
        step.detail ||
        (kind ? defenseStatusDescription(ds, kind, null) : null) ||
        "The formal defense result was recorded as Failed. Await Graduate School instructions.",
      statusLabel: "Failed",
      action: null,
      secondaryAction: journeyLink(),
    };
  }
  if (ds === "REVISION_REQUIRED") {
    return {
      kind: "REVISION",
      stepKey: step.key,
      heading: `${label} revision required`,
      explanation:
        step.detail ||
        (kind ? defenseStatusDescription(ds, kind, null) : null) ||
        "Follow the Graduate School / panel instructions for required revisions.",
      statusLabel: "Revision required",
      action: null,
      secondaryAction: journeyLink(),
    };
  }
  if (ds === "CANCELLED_SESSION") {
    return {
      kind: "CANCELLED",
      stepKey: step.key,
      heading: `${label} session cancelled`,
      explanation:
        step.detail ||
        (kind ? defenseStatusDescription(ds, kind, null) : null) ||
        "Your defense session was cancelled. Await rescheduling or further instructions.",
      statusLabel: "Cancelled",
      action: null,
      secondaryAction: journeyLink(),
    };
  }

  if (step.state === "LOCKED") {
    return {
      kind: "LOCKED",
      stepKey: step.key,
      heading: `${label} is locked`,
      explanation:
        step.lockReason ||
        "Complete the required prerequisite before you can continue.",
      statusLabel: "Locked",
      action: null,
      secondaryAction: journeyLink(),
    };
  }

  if (step.state === "WAITING") {
    return {
      kind: "WAITING",
      stepKey: step.key,
      heading: waitingHeading(step, label, ds),
      explanation:
        step.lockReason ||
        step.detail ||
        "Another authorized actor must act before this step can continue.",
      statusLabel: "Waiting",
      action: null,
      secondaryAction: { label: "View details", href: route },
    };
  }

  // CURRENT / AVAILABLE → the student can act now.
  return {
    kind: "ACTION",
    stepKey: step.key,
    heading: STEP_HEADINGS[step.key],
    explanation:
      step.nextAction ||
      step.detail ||
      "Continue this step in the Thesis Journey.",
    statusLabel: "Needs your action",
    action: { label: STEP_ACTIONS[step.key], href: route },
    secondaryAction: null,
  };
}

/* ------------------------------------------------------ milestone overview */

export function milestoneStateLabel(
  step: JourneyStepView,
  strikeRequired: boolean,
): string {
  if (step.key === "STRIKE" && !strikeRequired) return "Not required";
  switch (step.state) {
    case "COMPLETED":
      return "Completed";
    case "CURRENT":
      return "In progress";
    case "AVAILABLE":
      return "Available";
    case "WAITING":
      return "Waiting";
    case "LOCKED":
      return "Locked";
    default:
      return "—";
  }
}
