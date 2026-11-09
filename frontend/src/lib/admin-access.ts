// One code-owned catalog. This pure module has no Prisma, database or secrets.
import {
  CAPABILITY_CATALOG,
  FULL_ADMINISTRATOR_CAPABILITIES,
  validateDirectCapabilityKeys,
  expandCapabilityPrerequisites,
  type CapabilityKey,
} from "../../../backend/src/access/capability-catalog";
import { ApiError } from "./api-error";

export type AdminCapability = Exclude<CapabilityKey, "essay.evaluate">;
export interface AdminAccess {
  accountId: string;
  email: string;
  status: string;
  level: "FULL" | "RESTRICTED" | null;
  capabilities: readonly AdminCapability[];
}
export const adminKey = (id: string, ...parts: string[]) =>
  ["admin-private", id, ...parts] as const;
export const ADMINISTRATORS_API = "/admin/administrators";
const object = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
export function readAdminAccess(value: unknown, id: string): AdminAccess {
  if (
    !object(value) ||
    !object(value.user) ||
    value.user.id !== id ||
    value.user.role !== "ADMIN" ||
    value.user.mustChangePassword !== false ||
    typeof value.user.email !== "string" ||
    !object(value.configuredAccess)
  )
    throw new ApiError("Account access is unavailable.", 503);
  const config = value.configuredAccess;
  if (config.status !== "RESOLVED") {
    if (
      ![
        "MISSING_ADMIN_LEVEL",
        "INVALID_CONFIGURATION",
        "UNAVAILABLE",
        "INACTIVE",
      ].includes(String(config.status))
    )
      throw new ApiError("Account access is unavailable.", 503);
    return {
      accountId: id,
      email: value.user.email,
      status: String(config.status),
      level: null,
      capabilities: [],
    };
  }
  if (
    !["FULL", "RESTRICTED"].includes(String(config.administratorLevel)) ||
    !Array.isArray(config.capabilities)
  )
    throw new ApiError("Account access is unavailable.", 503);
  const keys = config.capabilities;
  if (
    keys.some(
      (key) =>
        typeof key !== "string" ||
        !(key in CAPABILITY_CATALOG) ||
        CAPABILITY_CATALOG[key as CapabilityKey].category !== "ADMIN",
    ) ||
    new Set(keys).size !== keys.length
  )
    throw new ApiError("Account access is unavailable.", 503);
  if (config.administratorLevel === "RESTRICTED") {
    try {
      validateDirectCapabilityKeys("ADMIN", keys);
    } catch {
      throw new ApiError("Account access is unavailable.", 503);
    }
    if (expandCapabilityPrerequisites(keys).length !== keys.length)
      throw new ApiError("Account access is unavailable.", 503);
  } else if (
    keys.length !== FULL_ADMINISTRATOR_CAPABILITIES.length ||
    FULL_ADMINISTRATOR_CAPABILITIES.some((key) => !keys.includes(key))
  )
    throw new ApiError("Account access is unavailable.", 503);
  return {
    accountId: id,
    email: value.user.email,
    status: "RESOLVED",
    level: config.administratorLevel as "FULL" | "RESTRICTED",
    capabilities: [...keys].sort() as AdminCapability[],
  };
}
export function adminAllows(access: AdminAccess | null, key: AdminCapability) {
  return access?.status === "RESOLVED" && access.capabilities.includes(key);
}
export function fullAdministrator(access: AdminAccess | null) {
  return (
    access?.level === "FULL" &&
    adminAllows(access, "administrator_access.manage")
  );
}

/** Labels are presentation metadata for the existing catalog, never new grants. */
export const ADMIN_CAPABILITY_LABELS: Record<AdminCapability, string> = {
  "applicants.view": "View Applicants",
  "students.view": "View Students",
  "students.comprehensive_exam.manage": "Record Comprehensive Examination",
  "waivers.view": "View Waivers",
  "waivers.manage": "Review Waivers",
  "cor.view": "View COR Submissions",
  "cor.verify": "Verify COR",
  "exam.schedules.view": "View Exam Schedules",
  "exam.schedules.manage": "Manage Exam Schedules and Assignments",
  "exam.records.view": "View Exam Records",
  "exam.starts.authorize": "Authorize Examination Start",
  "exam.results.finalize": "Finalize Exam Results",
  "exam.results.reconsider": "Reconsider Exam Results",
  "exam.questions.view": "View Exam Questions",
  "exam.questions.manage": "Manage Exam Questions",
  "exam.configuration.manage": "Manage Exam Configuration",
  "faculty.view": "View Faculty",
  "faculty.manage": "Manage Faculty",
  "adviser.requests.view": "View Adviser Requests",
  "adviser.requests.review": "Review Adviser Requests",
  "defense.applications.view": "View Defense Applications",
  "defense.applications.review": "Review Defense Applications",
  "defense.schedules.view": "View Defense Schedules",
  "defense.schedules.manage": "Manage Defense Schedules and Committees",
  "defense.records.view": "View Defense Records",
  "repository.view": "View Repository Archive",
  "repository.manage": "Manage Repository Publications",
  "memos.manage": "Manage Announcements and Memos",
  "settings.view": "View System Settings",
  "settings.manage": "Manage System Settings",
  "email.configuration.manage": "Manage Email Templates",
  "email.logs.view": "View Email Logs",
  "storage.health.view": "View Storage Health",
  "storage.integrity.scan": "Run Storage Integrity Scan",
  "audit.view": "View Audit Logs",
  "administrator_access.manage": "Manage Administrators",
};
export const ADMIN_GRANTABLE_KEYS = Object.keys(CAPABILITY_CATALOG).filter(
  (key) => {
    const definition = CAPABILITY_CATALOG[key as CapabilityKey];
    return definition.category === "ADMIN" && definition.directGrantable;
  },
) as AdminCapability[];
export const capabilityGroup = (key: AdminCapability) =>
  key.startsWith("exam.")
    ? "Examination"
    : key.startsWith("defense.") || key.startsWith("adviser.")
      ? "Thesis and Defense"
      : key.startsWith("settings.") ||
          key.startsWith("email.") ||
          key.startsWith("storage.") ||
          key.startsWith("audit.")
        ? "Settings and Operations"
        : "Accounts and Records";
export function directAdminKeys(values: unknown): AdminCapability[] {
  return [
    ...validateDirectCapabilityKeys("ADMIN", values as unknown[]),
  ] as AdminCapability[];
}
export function prerequisiteLabels(key: AdminCapability) {
  return CAPABILITY_CATALOG[key].requires.map(
    (dependency) => ADMIN_CAPABILITY_LABELS[dependency as AdminCapability],
  );
}

export interface AdminDestination {
  href: string;
  label: string;
  group: string;
  capability?: AdminCapability;
  fullOnly?: boolean;
}
export const ADMIN_DESTINATIONS: readonly AdminDestination[] = [
  { href: "/admin/dashboard", label: "Dashboard", group: "Home" },
  {
    href: "/admin/users/applicants",
    label: "Applicants",
    group: "User Management",
    capability: "applicants.view",
  },
  {
    href: "/admin/users/students",
    label: "Students",
    group: "User Management",
    capability: "students.view",
  },
  {
    href: "/admin/users/panelists",
    label: "Faculty",
    group: "User Management",
    capability: "faculty.view",
  },
  {
    href: "/admin/users/administrators",
    label: "Administrators",
    group: "User Management",
    fullOnly: true,
  },
  {
    href: "/admin/exam/slots",
    label: "Exam Schedules",
    group: "Exam Management",
    capability: "exam.schedules.view",
  },
  {
    href: "/admin/exam/applications",
    label: "Exam Records",
    group: "Exam Management",
    capability: "exam.records.view",
  },
  {
    href: "/admin/exam/questions",
    label: "Exam Questions",
    group: "Exam Management",
    capability: "exam.questions.view",
  },
  {
    href: "/admin/exam/cor",
    label: "COR Verification",
    group: "Exam Management",
    capability: "cor.view",
  },
  {
    href: "/admin/exam/waiver",
    label: "Waiver Validation",
    group: "Exam Management",
    capability: "waivers.view",
  },
  {
    href: "/admin/thesis/applications",
    label: "Defense Applications",
    group: "Thesis Management",
    capability: "defense.applications.view",
  },
  {
    href: "/admin/thesis/scheduling",
    label: "Scheduling & Panels",
    group: "Thesis Management",
    capability: "defense.schedules.view",
  },
  {
    href: "/admin/thesis/defense-records",
    label: "Defense Records",
    group: "Thesis Management",
    capability: "defense.records.view",
  },
  {
    href: "/admin/thesis/advisers",
    label: "Adviser Request Review",
    group: "Thesis Management",
    capability: "adviser.requests.view",
  },
  {
    href: "/admin/analytics",
    label: "Analytics & Reports",
    group: "Other",
    fullOnly: true,
  },
  {
    href: "/admin/settings/storage",
    label: "Storage Health",
    group: "Other",
    capability: "storage.health.view",
  },
  {
    href: "/admin/settings",
    label: "System Settings",
    group: "Other",
    capability: "settings.view",
  },
  {
    href: "/admin/memos",
    label: "Announcements & Memos",
    group: "Other",
    capability: "memos.manage",
  },
  {
    href: "/admin/repository",
    label: "Repository",
    group: "Other",
    capability: "repository.view",
  },
  { href: "/admin/notifications", label: "Notifications", group: "Other" },
];
export const settingsReadable = (access: AdminAccess | null) =>
  [
    "settings.view",
    "audit.view",
    "email.configuration.manage",
    "email.logs.view",
    "exam.configuration.manage",
  ].some((key) => adminAllows(access, key as AdminCapability));
export function adminDestinationAllowed(
  access: AdminAccess | null,
  destination: AdminDestination,
) {
  if (
    destination.href === "/admin/dashboard" ||
    destination.href === "/admin/notifications"
  )
    return true;
  if (destination.href === "/admin/settings") return settingsReadable(access);
  return destination.fullOnly
    ? fullAdministrator(access)
    : destination.capability
      ? adminAllows(access, destination.capability)
      : false;
}
export function adminRouteAllowed(access: AdminAccess | null, path: string) {
  const alias =
    path === "/admin/exam/scores"
      ? "/admin/exam/applications"
      : path === "/admin/thesis/rap-reports"
        ? "/admin/thesis/defense-records"
        : path;
  const destination = [...ADMIN_DESTINATIONS]
    .sort((a, b) => b.href.length - a.href.length)
    .find((item) => alias === item.href || alias.startsWith(`${item.href}/`));
  return destination ? adminDestinationAllowed(access, destination) : false;
}
// Dormant legacy aggregate contains every one of these sources. Never fetch it
// for a partial grant set and then hide data after receiving it.
export const DASHBOARD_READ_KEYS: readonly AdminCapability[] = [
  "students.view",
  "defense.applications.view",
  "defense.schedules.view",
  "defense.records.view",
  "waivers.view",
  "adviser.requests.view",
  "cor.view",
  "audit.view",
];
export const canRequestDashboard = (access: AdminAccess | null) =>
  DASHBOARD_READ_KEYS.every((key) => adminAllows(access, key));

export interface AdministratorAccount {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  mustChangePassword: boolean;
  level: "FULL" | "RESTRICTED" | null;
  capabilityKeys: AdminCapability[];
  configuredAccess: { status: string; capabilities: AdminCapability[] };
  managed: boolean;
}
export function readAdministrator(value: unknown): AdministratorAccount {
  if (
    !object(value) ||
    value.role !== "ADMIN" ||
    ["id", "email", "firstName", "lastName"].some(
      (key) => typeof value[key] !== "string",
    ) ||
    typeof value.isActive !== "boolean" ||
    typeof value.mustChangePassword !== "boolean" ||
    !object(value.configuredAccess)
  )
    throw new ApiError("Administrator details are unavailable.", 503);
  let keys: AdminCapability[] = [];
  let managed = false;
  try {
    keys = directAdminKeys(value.capabilityKeys);
    managed =
      (value.level === "FULL" || value.level === "RESTRICTED") &&
      ["RESOLVED", "INACTIVE"].includes(String(value.configuredAccess.status));
  } catch {
    /* invalid/unmapped targets remain read-only; never bootstrap */
  }
  return {
    id: String(value.id),
    email: String(value.email),
    firstName: String(value.firstName),
    lastName: String(value.lastName),
    isActive: value.isActive,
    mustChangePassword: value.mustChangePassword,
    level:
      value.level === "FULL" || value.level === "RESTRICTED"
        ? value.level
        : null,
    capabilityKeys: keys,
    configuredAccess: {
      status: String(value.configuredAccess.status),
      capabilities: [],
    },
    managed,
  };
}
export function administratorError(error: unknown) {
  const status = error instanceof ApiError ? error.statusCode : undefined;
  if (status === 401) return "Your session has expired. Sign in again.";
  if (status === 403)
    return "Your access has changed. Return to the Dashboard.";
  if (status === 503)
    return "Administrators Management is temporarily unavailable. Try again.";
  if (status === 404)
    return "This Administrator account is no longer available.";
  if (
    status === 409 &&
    error instanceof Error &&
    error.message === "At least one active Full Administrator must remain."
  )
    return "At least one active Full Administrator must remain.";
  if (
    status === 409 &&
    error instanceof Error &&
    error.message === "Administrator identity already exists."
  )
    return "An account with this email already exists.";
  if (status === 409)
    return "This account changed or requires review. Reload its details before trying again.";
  if (status === 400) return "Check the account details and selected access.";
  return "Unable to complete Administrator management. Try again.";
}
