import type { UserRole } from "@prisma/client";

/** Account identity only. Never use for PanelAssignment.role / PanelRole. */
export const ACADEMIC_ACCOUNT_ROLES = ["PANELIST", "FACULTY"] as const satisfies readonly UserRole[];

export function isAcademicAccountRole(role: unknown): role is typeof ACADEMIC_ACCOUNT_ROLES[number] {
  return role === "PANELIST" || role === "FACULTY";
}

/** A fresh array for Prisma `in` filters; no account/profile/assignment authority implied. */
export function academicAccountRoleFilter(): { in: UserRole[] } {
  return { in: [...ACADEMIC_ACCOUNT_ROLES] };
}
