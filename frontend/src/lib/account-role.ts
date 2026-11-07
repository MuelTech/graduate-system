/** Session identity stays current; both academic identities use the existing portal. */
export function academicPortalRole(role: string | undefined): string | undefined {
  return role === "faculty" ? "panelist" : role;
}

/** Stored account roles only, never defense assignment roles. */
export function isAcademicAccountRole(role: unknown): boolean {
  return role === "PANELIST" || role === "FACULTY";
}
