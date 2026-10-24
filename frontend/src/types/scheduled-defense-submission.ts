import type { DefenseSupportingEvidenceSlot } from "./defense-document-history";
import type { CertificationRecord } from "@/components/shared/adviser-certification-records";

export interface ScheduledDefenseSubmission {
  scheduleId: string;
  thesisId: string;
  stage: "TITLE" | "PROPOSAL" | "FINAL";
  manuscriptDocumentId: string | null;
  manuscriptIntegrityError: string | null;
  manuscript: {
    id: string;
    docType: string;
    stage: string;
    manuscriptTitle: string | null;
    originalFilename: string | null;
  } | null;
  supportingEvidence: DefenseSupportingEvidenceSlot[];
  certification: { integrityState: string; record: CertificationRecord | null };
}
