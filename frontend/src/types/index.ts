// APPLICANT & EXAM INTERFACES
export interface ApplicantStatus {
  alignmentStatus: string;
  strikeCount: number;
  programId: string;
  confirmedSlot?: {
    id: string;
    examDate: string;
    examTime: string;
    programName: string;
  };
}

export interface ExamSlot {
  id: string;
  programId: string;
  examDate: string;
  examTime: string;
  maxSlots: number;
  slotsTaken: number;
  isActive: boolean;
  program?: { programName: string };
}

export interface Program {
  id: string;
  programName: string;
}

export interface PendingCorUpload {
  id: string;
  originalFilename: string;
  filePath: string;
  createdAt: string;
  student: {
    programId: string;
    user: {
      firstName: string;
      lastName: string;
      email: string;
    };
  };
}

// PANELIST INTERFACES
export interface PanelistAssignmentData {
  id: string;
  role: string;
  schedule: {
    id: string;
    defenseDate: string;
    defenseTime?: string;
    venueOrLink?: string;
    defenseType: string;
    status?: string; // "SCHEDULED" or "COMPLETED"
    thesis: {
      student: {
        programId: string;
        user: {
          firstName: string;
          lastName: string;
        };
      };
      thesisDocuments?: DocumentData[];
    };
  };
}

export interface DefenseData {
  defenseType: string;
  defenseDate: string;
  thesis: {
    student: {
      programId: string;
      user: {
        firstName: string;
        lastName: string;
      };
    };
    thesisDocuments?: Array<{ id: string; docType: string; filePath: string }>;
  };
}

export interface DocumentData {
  id: string;
  docType: string;
  filePath: string;
  uploadedAt: string;
}

export interface RapReportSignatureDoc {
  id: string;
  rapReport: {
    defenseType: string;
    generatedAt: string;
    thesis: {
      student: {
        user: {
          firstName: string;
          lastName: string;
        };
      };
    };
  };
}

export interface Panelist {
  id: string;
  firstName: string;
  lastName: string;
  department: string;
}

export interface PanelistResponse {
  id: string;
  user: {
    firstName: string;
    lastName: string;
    email: string;
    isActive: boolean;
  };
  isExternal: boolean;
  highestEducationalAttainment: string;
  officeAffiliation: string;
  specialization: string;
  isAvailableAsAdviser: boolean;
}

// ADMIN THESIS INTERFACES
export interface AdminThesisApplication {
  id: string;
  stage: string;
  status: string;
  createdAt: string;
  student: {
    programId: string;
    user: {
      firstName: string;
      lastName: string;
      email: string;
    };
  };
  thesisDocuments?: ThesisDocument[];
  thesisTitles?: ThesisTitle[];
  assignment?: {
    adviser?: {
      firstName: string;
    };
  };
}

export interface ThesisDocument {
  docType: string;
  filePath: string;
}

export interface ThesisTitle {
  id: string;
  titleText: string;
  isSelected: boolean;
}

export interface MappedApplication {
  id: string;
  studentName: string;
  studentNumber: string;
  program: string;
  stage: string;
  dateSubmitted: string;
  status: string;
  requirements: {
    name: string;
    met: boolean;
    path: string;
  }[];
  proposedTitles: ThesisTitle[] | null;
  adviser: string | null;
}

export interface AdviserRequestUI {
  id: string;
  studentName: string;
  studentNumber: string;
  program: string;
  requestDate: string;
  preferredAdviser: string | null;
  researchInterest: string;
  status: string;
}

export interface ActiveAssignmentUI {
  id: string;
  studentName: string;
  studentNumber: string;
  program: string;
  adviserName: string;
  adviserType: string;
  assignedDate: string;
  thesisStage: string;
  lastActivity: string;
  progress: number;
}

export interface AvailableAdviserUI {
  id: string;
  name: string;
  advisees: number;
  maxAdvisees: number;
  specialization: string;
}

export interface AuditLogItem {
  id: string;
  createdAt: string;
  actionType: string;
  targetTable: string;
  targetId: string;
  description: string;
  actor?: {
    firstName: string;
    lastName: string;
    role: string;
  };
}
