/**
 * WP10 Dean Adviser Request Review DTO (matches listDeanReviewRequests).
 */
export interface DeanAdviserReviewDto {
  id: string;
  student: {
    id: string;
    name: string;
    studentNumber: string | null;
    program: string | null;
  };
  officialTitle: string | null;
  requestedAdviser: {
    userId: string;
    name: string;
    specialization: string | null;
    officeAffiliation: string | null;
  };
  titleDefenseRole: string | null;
  reason: string | null;
  requestDate: string;
  status: string;
  adviserStatus: string;
  adviserRespondedAt: string | null;
  adviserRemarks: string | null;
  deanStatus: string;
  deanReviewedAt: string | null;
  deanRemarks: string | null;
  sourceDefenseScheduleId: string | null;
}

export const adminDeanReviewQueryKey = [
  "admin",
  "thesis",
  "adviser",
  "dean-review",
] as const;

export function titleDefenseRoleLabel(role: string | null): string {
  if (role === "CHAIRMAN") return "Chairman";
  if (role === "PANELIST") return "Panelist";
  return "Title Defense panel member";
}
