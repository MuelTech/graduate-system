import type { InstitutionalLogos } from "../shared/institutional-header";

/** Explicit presentation selection only; null leaves all three printed options unmarked. */
export type DefenseApplicationType = "title" | "proposal" | "final" | null;

interface DefenseApplicationCommonInput {
  readonly logos: InstitutionalLogos;
  readonly applicationType: DefenseApplicationType;
  readonly studentName: string;
  /** The single printed "Course & Major" field; nothing is appended or inferred. */
  readonly courseAndMajor: string;
  readonly studentNumber: string;
  readonly cellphoneNumber: string;
  /** Upper applicant field, independent of the lower Date of Defense/Time fields. */
  readonly applicantDateAndTime: string;
  readonly amountPaid: string;
  readonly officialReceiptNumber: string;
  readonly dateOfApplication: string;
  readonly personalGmail: string;
  readonly defenseDate: string;
  readonly defenseTime: string;
  readonly defenseLink: string;
  /** Display names only. No approval state or signature evidence. */
  readonly deanName: string;
  readonly vicePresidentName: string;
  readonly presidentName: string;
}
interface CommitteeDisplayNames {
  /** In printed order; absent names leave the corresponding remaining slots blank. */
  readonly panelistNames: readonly string[];
  readonly facilitatorName: string;
  readonly rapporteurName: string;
}

/** Physical variants from the photographs, not GS-IS committee membership policy. */
export type DefenseApplicationRenderInput = DefenseApplicationCommonInput & (
  | {
    readonly variant: "masters";
    readonly committee: CommitteeDisplayNames & {
      readonly adviserName: string;
      /** At most four physical Panelist slots on GS-006. */
      readonly panelistNames: readonly string[];
    };
  }
  | {
    readonly variant: "doctoral";
    readonly committee: CommitteeDisplayNames & {
      /** GS-007 has no printed Adviser slot. */
      readonly adviserName?: never;
      /** At most six physical Panelist slots on GS-007. */
      readonly panelistNames: readonly string[];
    };
  }
);
