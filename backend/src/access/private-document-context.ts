import { resolveAdviserAcademicDocument, resolveAdviserBoundAcademicManuscript } from "../services/adviser-document.rules";

/** Same-thesis/stage supporting history is the accepted scheduled-submission model. */
export function isScheduledDocument(record: any, schedule: any): boolean {
  if (!record?.thesisId || schedule?.thesisId !== record.thesisId) return false;
  if (resolveAdviserBoundAcademicManuscript({ ...schedule, document: record })) return true;
  return ["COR", "RECEIPT"].includes(record.docType) &&
    `${record.defenseStage}_DEFENSE` === schedule.defenseType;
}

export function isDefenseApplicationDocument(record: any): boolean {
  return Boolean(record?.thesisId && record.thesis?.id === record.thesisId &&
    (resolveAdviserAcademicDocument(record) ||
      (["COR", "RECEIPT", "INSTRUMENTS", "PLAGIARISM_REPORT"].includes(record.docType) &&
        ["TITLE", "PROPOSAL", "FINAL"].includes(record.defenseStage))));
}

/** Inventory includes deferred classes without supplying a FACULTY-8 policy. */
export const PRIVATE_DOCUMENT_CLASSIFICATION = Object.freeze({
  "cor-upload": "FACULTY-8", "thesis-document": "FACULTY-8",
  "rap-report": "FACULTY-8", "student-requirement": "FACULTY-8",
  "plagiarism-result": "FACULTY-8", memo: "FACULTY-9",
  "elibrary-manuscript": "FACULTY-9", "elibrary-respondent-data": "FACULTY-9",
} as const);
