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
  };
  capabilities: {
    canEvaluate: boolean;
    canEditRapporteurNotes: boolean;
    canViewTitleDeliberation: boolean;
    canViewTitleChairmanResult: boolean;
    canFinalizeRapporteurNotes: boolean;
    canRecordFormalResult: boolean;
    canViewFinalizedRapporteurNotes: boolean;
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
  oralSummary: {
    ready: boolean;
    overallAverage: number | null;
    finalRating: string | null;
  } | null;
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
  rating: string | null;
  recommendations: string | null;
  signedAt: string | null;
  finalizedAt: string | null;
  isLocked: boolean;
}
