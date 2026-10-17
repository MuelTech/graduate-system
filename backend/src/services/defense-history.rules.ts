/**
 * CDW-6 — Defense History resolution rules (pure, server-authoritative).
 *
 * History is DERIVED from immutable attempt records: a concluded prior
 * `DefenseSchedule` of the SAME thesis, resolved through that exact schedule's
 * own binding. It is never inferred from the latest document, `isCurrent`, a
 * current AdviserCertification, thesis-global status, or the current committee.
 *
 * The module is shared by:
 *  - `DefenseHistoryService` (the read model), and
 *  - `canPanelistAccessThesisDocument` (historical bound-manuscript access),
 * so the relationship/ordering/authority rules exist exactly once.
 */

export type DefenseHistoryRelationship =
  | "SAME_STAGE_REDEFENSE"
  | "PREVIOUS_STAGE"
  | "OLDER_HISTORY";

const STAGE_RANK: Record<string, number> = {
  TITLE_DEFENSE: 1,
  PROPOSAL_DEFENSE: 2,
  FINAL_DEFENSE: 3,
};

/** Defense type → the ThesisDocument stage that belongs to that attempt. */
export const DEFENSE_TYPE_TO_DOCUMENT_STAGE: Record<
  string,
  "TITLE" | "PROPOSAL" | "FINAL"
> = {
  TITLE_DEFENSE: "TITLE",
  PROPOSAL_DEFENSE: "PROPOSAL",
  FINAL_DEFENSE: "FINAL",
};

/** The only document types that may serve as an attempt's bound manuscript. */
export const MANUSCRIPT_DOC_TYPES_BY_STAGE: Record<
  "TITLE" | "PROPOSAL" | "FINAL",
  string[]
> = {
  TITLE: ["TITLE_PROPOSAL"],
  PROPOSAL: ["PROPOSAL_CHAPTERS"],
  FINAL: ["FINAL_MANUSCRIPT"],
};

/** Relationship priority for the deterministic history ordering. */
const RELATIONSHIP_RANK: Record<DefenseHistoryRelationship, number> = {
  SAME_STAGE_REDEFENSE: 0,
  PREVIOUS_STAGE: 1,
  OLDER_HISTORY: 2,
};

export function defenseStageRank(defenseType: string): number | null {
  return STAGE_RANK[String(defenseType)] ?? null;
}

export interface HistoryAttemptInput {
  scheduleId: string;
  defenseType: string;
  /** Authoritative conclusion outcome; null/absent = not concluded. */
  outcome?: string | null;
  defenseDate?: Date | string | null;
  createdAt?: Date | string | null;
  concludedAt?: Date | string | null;
}

function toMs(value: Date | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(value);
  const time = date.getTime();
  return Number.isNaN(time) ? null : time;
}

/**
 * Strict attempt ordering. When both defense dates are provable they decide;
 * equal dates fall back to createdAt. Unprovable ordering fails closed (an
 * attempt that cannot be proven prior is never treated as history).
 */
export function isPriorAttempt(
  historical: HistoryAttemptInput,
  current: HistoryAttemptInput,
): boolean {
  const historicalDate = toMs(historical.defenseDate);
  const currentDate = toMs(current.defenseDate);
  if (historicalDate !== null && currentDate !== null && historicalDate !== currentDate) {
    return historicalDate < currentDate;
  }
  const historicalCreated = toMs(historical.createdAt);
  const currentCreated = toMs(current.createdAt);
  if (
    historicalCreated !== null &&
    currentCreated !== null &&
    historicalCreated !== currentCreated
  ) {
    return historicalCreated < currentCreated;
  }
  return false;
}

/**
 * Classify a prior concluded attempt relative to the current one.
 * Returns null when the attempt is not a valid history candidate:
 *  - unknown defense type;
 *  - a later/future stage (a stage becomes history only once you have advanced).
 */
export function classifyHistoryRelationship(
  historical: HistoryAttemptInput,
  current: HistoryAttemptInput,
): DefenseHistoryRelationship | null {
  const historicalRank = defenseStageRank(historical.defenseType);
  const currentRank = defenseStageRank(current.defenseType);
  if (historicalRank === null || currentRank === null) return null;
  if (historicalRank > currentRank) return null;
  if (historicalRank === currentRank) return "SAME_STAGE_REDEFENSE";
  if (currentRank - historicalRank === 1) {
    // The immediately preceding academic stage is prior-stage context only when
    // that attempt was formally PASSED (normal progression). Otherwise it is
    // secondary older history.
    return String(historical.outcome ?? "") === "PASSED"
      ? "PREVIOUS_STAGE"
      : "OLDER_HISTORY";
  }
  return "OLDER_HISTORY";
}

export interface ResolvedHistoryItem {
  scheduleId: string;
  defenseType: string;
  relationship: DefenseHistoryRelationship;
}

/**
 * Resolve the relevant prior attempts for the CURRENT schedule.
 *
 * Ordering (deterministic):
 *   1. Same-stage re-defense attempt (most recently concluded first);
 *   2. Latest PASSED immediately preceding academic stage;
 *   3. Remaining older concluded attempts (most recently concluded first).
 *
 * Excludes the current schedule itself, attempts without an authoritative
 * conclusion, and attempts that cannot be proven prior.
 */
export function resolveHistoryScheduleIds(
  current: HistoryAttemptInput,
  candidates: HistoryAttemptInput[],
): ResolvedHistoryItem[] {
  const items: Array<ResolvedHistoryItem & { concludedAt: number; defenseDate: number; createdAt: number }> = [];

  for (const candidate of candidates) {
    if (candidate.scheduleId === current.scheduleId) continue;
    if (!candidate.outcome) continue;
    if (!isPriorAttempt(candidate, current)) continue;
    const relationship = classifyHistoryRelationship(candidate, current);
    if (!relationship) continue;
    items.push({
      scheduleId: candidate.scheduleId,
      defenseType: String(candidate.defenseType),
      relationship,
      concludedAt: toMs(candidate.concludedAt) ?? 0,
      defenseDate: toMs(candidate.defenseDate) ?? 0,
      createdAt: toMs(candidate.createdAt) ?? 0,
    });
  }

  items.sort((a, b) => {
    const rank = RELATIONSHIP_RANK[a.relationship] - RELATIONSHIP_RANK[b.relationship];
    if (rank !== 0) return rank;
    if (b.concludedAt !== a.concludedAt) return b.concludedAt - a.concludedAt;
    if (b.defenseDate !== a.defenseDate) return b.defenseDate - a.defenseDate;
    if (b.createdAt !== a.createdAt) return b.createdAt - a.createdAt;
    return a.scheduleId.localeCompare(b.scheduleId);
  });

  return items.map(({ scheduleId, defenseType, relationship }) => ({
    scheduleId,
    defenseType,
    relationship,
  }));
}

export interface ThesisScheduleAccessInput {
  id: string;
  defenseType: string;
  manuscriptDocumentId?: string | null;
  defenseDate?: Date | string | null;
  createdAt?: Date | string | null;
  conclusion?: { outcome?: string | null } | null;
  panelAssignments?: Array<{ userId: string }> | null;
}

function toAttempt(schedule: ThesisScheduleAccessInput): HistoryAttemptInput {
  return {
    scheduleId: schedule.id,
    defenseType: String(schedule.defenseType),
    outcome: schedule.conclusion?.outcome ?? null,
    defenseDate: schedule.defenseDate ?? null,
    createdAt: schedule.createdAt ?? null,
    concludedAt: null,
  };
}

/**
 * CDW-6 historical manuscript authority (fail closed).
 *
 * A caller may read the document bound to a HISTORICAL attempt when ALL hold:
 *  - the document is the EXACT `manuscriptDocumentId` of a concluded prior
 *    attempt of this thesis (never a "latest"/`isCurrent` substitute);
 *  - the document stage matches that historical attempt's stage/docType;
 *  - at least one CURRENT schedule where the caller is assigned treats the
 *    historical attempt as relevant prior evidence (relationship ≠ null).
 *
 * The caller passes only the schedules of the SAME thesis, so cross-thesis
 * leakage is impossible here. Supporting evidence (COR/receipt/etc.) is never
 * bound via `manuscriptDocumentId` and therefore never granted by this rule.
 */
export function canReadHistoricalBoundManuscript(input: {
  documentId: string;
  documentStage: "TITLE" | "PROPOSAL" | "FINAL" | null;
  documentDocType: string | null;
  schedules: ThesisScheduleAccessInput[];
  userId: string;
}): boolean {
  const { documentId, documentStage, documentDocType, schedules, userId } = input;
  if (!documentId || !documentStage) return false;
  // A bound manuscript must be the attempt's exact academic manuscript type —
  // never supporting evidence (COR/receipt/plagiarism/instruments) even if some
  // row were bound to it.
  if (!documentDocType || !MANUSCRIPT_DOC_TYPES_BY_STAGE[documentStage].includes(documentDocType)) {
    return false;
  }

  for (const historical of schedules) {
    if (historical.manuscriptDocumentId !== documentId) continue;
    if (!historical.conclusion?.outcome) continue;
    if (DEFENSE_TYPE_TO_DOCUMENT_STAGE[String(historical.defenseType)] !== documentStage) {
      continue;
    }

    for (const current of schedules) {
      if (current.id === historical.id) continue;
      const assigned = (current.panelAssignments ?? []).some(
        (assignment) => assignment.userId === userId,
      );
      if (!assigned) continue;
      // The historical attempt must be genuinely PRIOR to the current one. The
      // relationship classifier is date-blind for same-stage pairs, so without
      // this guard an earlier attempt's committee could read a LATER attempt's
      // manuscript.
      if (!isPriorAttempt(toAttempt(historical), toAttempt(current))) continue;
      if (classifyHistoryRelationship(toAttempt(historical), toAttempt(current)) !== null) {
        return true;
      }
    }
  }

  return false;
}
