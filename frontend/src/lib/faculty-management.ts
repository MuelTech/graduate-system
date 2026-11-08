import type { Faculty, FacultyForm, FacultyResponse } from "@/types/faculty";
import { ApiError } from "./api-error";

export const FACULTY_API = "/admin/panelists";
export const FACULTY_QUERY_KEY = ["facultyManagement"] as const;
export const emptyFacultyForm: FacultyForm = {
  firstName: "",
  lastName: "",
  title: "",
  suffix: "",
  email: "",
  qualification: "",
  affiliation: "",
  specialization: "",
  isExternal: false,
  isActive: true,
  isAvailableAsAdviser: false,
  essayEvaluation: false,
};

export function mapFaculty(dto: FacultyResponse): Faculty {
  const user = dto.user;
  if (!dto.id || dto.userId !== user.id || !Array.isArray(dto.capabilityKeys)) {
    throw new Error("Invalid Faculty response");
  }
  return {
    id: dto.id,
    userId: dto.userId,
    firstName: user.firstName,
    lastName: user.lastName,
    title: user.title ?? "",
    suffix: user.suffix ?? "",
    email: user.email,
    qualification: dto.highestEducationalAttainment ?? "",
    affiliation: dto.officeAffiliation ?? "",
    specialization: dto.specialization ?? "",
    isExternal: dto.isExternal,
    isActive: user.isActive && dto.isActive,
    isAvailableAsAdviser: !dto.isExternal && dto.isAvailableAsAdviser,
    essayEvaluation: dto.capabilityKeys.includes("essay.evaluate"),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    createdBy: user.createdBy
      ? `${user.createdBy.firstName} ${user.createdBy.lastName}`
      : "",
    updatedBy: user.updatedBy
      ? `${user.updatedBy.firstName} ${user.updatedBy.lastName}`
      : "",
  };
}

/** Explicit allowlist: never spread a DTO or draft into a management request. */
export function facultyPayload(form: FacultyForm) {
  const optional = (value: string) => value.trim() || null;
  return {
    email: form.email.trim(),
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    title: optional(form.title),
    suffix: optional(form.suffix),
    highestEducationalAttainment: optional(form.qualification),
    officeAffiliation: optional(form.affiliation),
    specialization: optional(form.specialization),
    isActive: form.isActive,
    isExternal: form.isExternal,
    isAvailableAsAdviser: !form.isExternal && form.isAvailableAsAdviser,
    capabilityKeys: form.essayEvaluation ? ["essay.evaluate"] : [],
  };
}

export function facultyName(faculty: {
  firstName: string;
  lastName: string;
  title: string | null;
  suffix: string | null;
}) {
  return [faculty.title, faculty.firstName, faculty.lastName, faculty.suffix]
    .filter(Boolean)
    .join(" ");
}

export function filterFaculty(
  rows: Faculty[],
  search: string,
  classification: string,
  status: string,
) {
  const query = search.trim().toLowerCase();
  return rows.filter(
    (row) =>
      (classification === "all" ||
        row.isExternal === (classification === "external")) &&
      (status === "all" || row.isActive === (status === "active")) &&
      (!query ||
        [facultyName(row), row.email, row.affiliation, row.specialization].some(
          (value) => value.toLowerCase().includes(query),
        )),
  );
}

export function facultyError(error: unknown): string {
  if (!(error instanceof ApiError))
    return "The Faculty request could not be completed. Try again.";
  switch (error.statusCode) {
    case 401:
      return "Your session has expired. Sign in again.";
    case 403:
      return "You do not have access to this Faculty action.";
    case 503:
      return "Faculty Management is currently unavailable.";
    case 400:
      return "Check the profile fields and access selections before saving.";
    case 404:
      return "This Faculty account is no longer available. Refresh the list.";
    case 409:
      if (
        error.message ===
        "This Adviser classification requires institutional review."
      ) {
        return "This Adviser classification requires institutional review. Keep the current classification until the case is resolved.";
      }
      if (error.message === "Account identity already exists.")
        return "An account already uses this email address.";
      return "This Faculty account needs review. Reload its details before trying again.";
    default:
      return "The Faculty request could not be completed. Try again.";
  }
}
