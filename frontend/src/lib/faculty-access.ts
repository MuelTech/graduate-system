import { academicPortalRole } from "./account-role";
import { ApiError } from "./api-error";

export interface FacultyWork {
  essayEvaluations: { relevant: boolean };
  myAdvisees: {
    relevant: boolean;
    activeAdviseeCount: number;
    addressedRequestCount: number;
    issuedCertificationCount: number;
  };
  myDefenses: { relevant: boolean; assignmentCount: number };
}
export type FacultyArea = keyof FacultyWork;
export const facultyKey = (accountId: string, ...parts: string[]) =>
  ["faculty", accountId, ...parts] as const;
export const FACULTY_ACCESS_CHANGED = "faculty-access-changed";

/** Destination uses only the refreshed server-derived session, never selected login value. */
export function loginDestination(
  user:
    | {
        role?: string;
        mustChangePassword?: boolean;
        currentAccountError?: string;
      }
    | undefined,
): string | null {
  if (!user || user.currentAccountError) return null;
  if (user.mustChangePassword) return "/change-password";
  const role = academicPortalRole(user.role?.toLowerCase());
  return ["panelist", "admin", "student", "applicant"].includes(role ?? "")
    ? `/${role}/dashboard`
    : null;
}

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;
const count = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

/** Strict own-account presentation contract. Null/invalid configuration is an
 * unavailable state, not a fabricated no-work account. Never authorizes IDs. */
export function readFacultyWork(
  value: unknown,
  accountId: string,
): FacultyWork {
  if (
    !record(value) ||
    !record(value.user) ||
    value.user.id !== accountId ||
    !["FACULTY", "PANELIST"].includes(String(value.user.role)) ||
    value.user.mustChangePassword !== false ||
    !record(value.configuredAccess) ||
    value.configuredAccess.status !== "RESOLVED" ||
    !record(value.facultyWork)
  ) {
    throw new ApiError("Account access is unavailable.", 503);
  }
  const {
    essayEvaluations: essay,
    myAdvisees: advisers,
    myDefenses: defenses,
  } = value.facultyWork;
  if (
    !record(essay) ||
    typeof essay.relevant !== "boolean" ||
    !record(advisers) ||
    typeof advisers.relevant !== "boolean" ||
    !count(advisers.activeAdviseeCount) ||
    !count(advisers.addressedRequestCount) ||
    !count(advisers.issuedCertificationCount) ||
    !record(defenses) ||
    typeof defenses.relevant !== "boolean" ||
    !count(defenses.assignmentCount)
  ) {
    throw new ApiError("Account access is unavailable.", 503);
  }
  return {
    essayEvaluations: { relevant: essay.relevant },
    myAdvisees: {
      relevant: advisers.relevant,
      activeAdviseeCount: advisers.activeAdviseeCount,
      addressedRequestCount: advisers.addressedRequestCount,
      issuedCertificationCount: advisers.issuedCertificationCount,
    },
    myDefenses: {
      relevant: defenses.relevant,
      assignmentCount: defenses.assignmentCount,
    },
  };
}

export function facultyAreaForPath(path: string): FacultyArea | null {
  if (/^\/panelist\/essay-evaluations(?:\/|$)/.test(path))
    return "essayEvaluations";
  if (
    /^\/panelist\/(?:advisees|adviser-requests|adviser-reviews)(?:\/|$)/.test(
      path,
    )
  )
    return "myAdvisees";
  if (
    /^\/panelist\/(?:defenses|defense-workspace|defense-lobby|scoring|materials)(?:\/|$)/.test(
      path,
    )
  )
    return "myDefenses";
  return null;
}
