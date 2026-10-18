/** CP6 Defense Workspace frontend contract. */

export type WorkspaceRole =
  | "CHAIRMAN"
  | "PANELIST"
  | "RAPPORTEUR"
  | "FACILITATOR"
  | "ADVISER"
  | string;

export type EvaluationStatus =
  | "NOT_STARTED"
  | "DRAFT"
  | "FINALIZED"
  | "NONE";

export interface DefenseWorkspace {
  schedule: {
    id: string;
    defenseType: string;
    sessionStatus: string;
    defenseDate: string | null;
    defenseTime: string | null;
    venueOrLink: string | null;
  };
  student: {
    id: string | null;
    studentNumber: string | null;
    name: string;
    program: string | null;
  };
  myAssignment: {
    panelAssignmentId: string;
    role: WorkspaceRole;
    name: string;
  };
  capabilities: {
    canEvaluate: boolean;
    /** CDW-4: official scoring is open right now (IN_PROGRESS). Server-authoritative. */
    evaluationOpen: boolean;
    canEditRapporteurNotes: boolean;
    canViewTitleDeliberation: boolean;
    canViewTitleChairmanResult: boolean;
    canFinalizeRapporteurNotes: boolean;
    canRecordFormalResult: boolean;
    canViewFinalizedRapporteurNotes: boolean;
    /** CDW-4: assigned Chairman may Start Defense for ANY stage from SCHEDULED. */
    canStartDefense: boolean;
  };
  documents: Array<{
    id: string;
    docType: string;
    defenseStage: string | null;
    uploadedAt: string | null;
    displayName: string;
  }>;
  proposedTitles: Array<{ id: string; titleText: string }>;
  roster: Array<{
    userId: string;
    name: string;
    role: string;
    evaluationStatus: EvaluationStatus;
  }>;
  rapporteurDraft: { notes: string | null } | null;
  rapporteurNotesFinalizedAt: string | null;
  evaluationStatus: EvaluationStatus;
  sessionStatus: string;
  conclusionsPresent: boolean;
  evaluationProgress: {
    evaluatorAssignments: number;
    finalizedEvaluations: number;
  };
  formalResult: string | null;
  rapStatus: string | null;
}

export interface OralEvaluation {
  scheduleId: string;
  defenseType: string;
  panelAssignmentId: string;
  assignmentRole: string;
  status: "DRAFT" | "FINALIZED";
  criteria: Record<string, number | null>;
  groupIValue: number | null;
  groupIIValue: number | null;
  overallValue: number | null;
  /**
   * CDW-4 FIX: which scoring semantics this record uses. LEGACY_POINTS_V1 rows are
   * read-only in the workspace; INSTITUTIONAL_MATRIX_V2 uses the 1.00–2.50 matrix.
   */
  scoringVersion: "LEGACY_POINTS_V1" | "INSTITUTIONAL_MATRIX_V2";
  rating: string | null;
  recommendations: string | null;
  signedAt: string | null;
  finalizedAt: string | null;
  isLocked: boolean;
}
