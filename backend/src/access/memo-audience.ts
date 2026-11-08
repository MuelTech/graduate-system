import { isAcademicAccountRole } from "../utils/academic-account";

/** Management is a separate capability check; this describes ordinary audience reads. */
export function canReadMemoAudience(memo: { isArchived: boolean; targetAudience: string; programId?: string | null },
  role: string, programId?: string | null): boolean {
  if (memo.isArchived !== false) return false;
  if (memo.targetAudience === "ALL") return true;
  if (isAcademicAccountRole(role)) return memo.targetAudience === "PANELISTS";
  return role === "STUDENT" && (memo.targetAudience === "STUDENTS" ||
    (memo.targetAudience === "PROGRAM" && Boolean(programId) && memo.programId === programId));
}
