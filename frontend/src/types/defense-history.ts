/**
 * CDW-6 — Defense History read-model contract (frontend).
 *
 * History is read-only context derived from prior concluded attempts of the
 * current thesis. It never carries another attempt's live collaboration state,
 * prior individual evaluator scores, or raw signature evidence.
 */

export type DefenseHistoryRelationship =
  | "SAME_STAGE_REDEFENSE"
  | "PREVIOUS_STAGE"
  | "OLDER_HISTORY";

export type DefenseHistoryStage = "TITLE" | "PROPOSAL" | "FINAL";

export interface DefenseHistoryManuscript {
  id: string;
  docType: string;
  defenseStage: string | null;
  displayName: string;
  uploadedAt: string | null;
}

export interface DefenseHistoryRap {
  id: string;
  status: string;
  finalizedAt: string | null;
  /** Canonical CDW-5 structured body when present (validated before rendering). */
  bodyDocument: unknown | null;
  decisionsAndRecommendations: string | null;
  isStructured: boolean;
  contentVersion: number | null;
  signatureProgress: { required: number; signed: number };
}

export interface DefenseHistoryCommitteeMember {
  userId: string;
  name: string;
  role: string;
}

export interface DefenseHistoryItem {
  scheduleId: string;
  defenseType: string;
  stage: DefenseHistoryStage;
  relationship: DefenseHistoryRelationship;
  defenseDate: string | null;
  defenseTime: string | null;
  venueOrLink: string | null;
  sessionStatus: string;
  verdict: string | null;
  concludedAt: string | null;
  manuscript: DefenseHistoryManuscript | null;
  rapAvailable: boolean;
  annotationCount: number;
  commentCount: number;
  committee: DefenseHistoryCommitteeMember[];
}

export interface DefenseHistory {
  scheduleId: string;
  defenseType: string;
  items: DefenseHistoryItem[];
}

export interface DefenseHistoryAttemptDetail extends DefenseHistoryItem {
  rap: DefenseHistoryRap | null;
  /** Raw annotation read model — parsed defensively before rendering. */
  annotations: unknown;
}
