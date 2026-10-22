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
  /**
   * Printed Adviser display name for Proposal/Final Defense. Omit or leave
   * blank for Title/null; a nonblank value is rejected when no Adviser row is
   * printed rather than being silently discarded.
   */
  readonly adviserName?: string;
  /**
   * Printed Panelist display names, in row order. Capacity is determined by
   * program variant plus applicationType. The first name may later be supplied
   * from the authoritative Chairman assignment; the renderer does not infer
   * roles from names or reorder them.
   */
  readonly panelistNames: readonly string[];
  readonly facilitatorName: string;
  readonly rapporteurName: string;
}

/**
 * Presentation-only input for the GS-006/GS-007 family. `applicationType`
 * selects the stage-specific printed committee capacity and Adviser visibility;
 * it does not define or mutate GS-IS committee membership.
 */
export type DefenseApplicationRenderInput = DefenseApplicationCommonInput & (
  | { readonly variant: "masters"; readonly committee: CommitteeDisplayNames }
  | { readonly variant: "doctoral"; readonly committee: CommitteeDisplayNames }
);
