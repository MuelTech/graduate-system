/**
 * Module-aligned Administrator Capabilities and Route Access Helpers.
 *
 * Matches backend/src/config/admin-capabilities.ts and the 4 Admin Sidebar
 * module groups:
 * 1. User Management
 * 2. Exam Management
 * 3. Thesis Management
 * 4. Institutional & System
 */

export const ADMIN_CAPABILITIES = {
  // 1. User Management (Administrators Management is exclusively Full Admin)
  USERS_APPLICANTS: "USERS_APPLICANTS",
  USERS_STUDENTS: "USERS_STUDENTS",
  USERS_FACULTY: "USERS_FACULTY",

  // 2. Exam Management
  EXAMS_SCHEDULES: "EXAMS_SCHEDULES",
  EXAMS_RECORDS: "EXAMS_RECORDS",
  EXAMS_QUESTIONS: "EXAMS_QUESTIONS",
  EXAMS_COR: "EXAMS_COR",
  EXAMS_WAIVER: "EXAMS_WAIVER",

  // 3. Thesis Management
  THESIS_APPLICATIONS: "THESIS_APPLICATIONS",
  THESIS_SCHEDULING: "THESIS_SCHEDULING",
  THESIS_RECORDS: "THESIS_RECORDS",
  THESIS_ADVISERS: "THESIS_ADVISERS",

  // 4. Institutional & System
  SYSTEM_ANALYTICS: "SYSTEM_ANALYTICS",
  SYSTEM_SETTINGS: "SYSTEM_SETTINGS",
  SYSTEM_MEMOS: "SYSTEM_MEMOS",
  SYSTEM_REPOSITORY: "SYSTEM_REPOSITORY",
} as const;

export type AdminCapabilityKey =
  (typeof ADMIN_CAPABILITIES)[keyof typeof ADMIN_CAPABILITIES];

export type AdminAccessLevel = "FULL" | "RESTRICTED";

export interface AdminCapabilityOption {
  key: AdminCapabilityKey;
  label: string;
  description: string;
  href: string;
}

export interface AdminCapabilityGroup {
  groupTitle: string;
  groupDescription: string;
  capabilities: AdminCapabilityOption[];
}

export const ADMIN_CAPABILITY_GROUPS: AdminCapabilityGroup[] = [
  {
    groupTitle: "User Management",
    groupDescription:
      "Manage applicant admissions, enrolled graduate students, and faculty accounts.",
    capabilities: [
      {
        key: ADMIN_CAPABILITIES.USERS_APPLICANTS,
        label: "Applicants",
        description: "View and manage applicant admission records",
        href: "/admin/users/applicants",
      },
      {
        key: ADMIN_CAPABILITIES.USERS_STUDENTS,
        label: "Students",
        description: "View and manage graduate student records and residency",
        href: "/admin/users/students",
      },
      {
        key: ADMIN_CAPABILITIES.USERS_FACULTY,
        label: "Faculty",
        description: "Create and manage internal & external faculty accounts",
        href: "/admin/users/panelists",
      },
    ],
  },
  {
    groupTitle: "Exam Management",
    groupDescription:
      "Manage entrance examination slots, applicant exam records, question bank, COR, and waivers.",
    capabilities: [
      {
        key: ADMIN_CAPABILITIES.EXAMS_SCHEDULES,
        label: "Exam Schedules",
        description: "Create and manage entrance exam schedule slots",
        href: "/admin/exam/slots",
      },
      {
        key: ADMIN_CAPABILITIES.EXAMS_RECORDS,
        label: "Exam Records & Essay Evaluation",
        description: "Manage applicant exam records, essay grading, and results",
        href: "/admin/exam/applications",
      },
      {
        key: ADMIN_CAPABILITIES.EXAMS_QUESTIONS,
        label: "Exam Questions",
        description: "Configure entrance examination questions and sets",
        href: "/admin/exam/questions",
      },
      {
        key: ADMIN_CAPABILITIES.EXAMS_COR,
        label: "COR Verification",
        description: "Review and verify uploaded Certificates of Registration",
        href: "/admin/exam/cor",
      },
      {
        key: ADMIN_CAPABILITIES.EXAMS_WAIVER,
        label: "Waiver Validation",
        description: "Validate bridging course waivers for non-aligned applicants",
        href: "/admin/exam/waiver",
      },
    ],
  },
  {
    groupTitle: "Thesis Management",
    groupDescription:
      "Manage defense applications, panel scheduling, defense records, and adviser requests.",
    capabilities: [
      {
        key: ADMIN_CAPABILITIES.THESIS_APPLICATIONS,
        label: "Defense Applications",
        description: "Review student title, proposal, and final defense applications",
        href: "/admin/thesis/applications",
      },
      {
        key: ADMIN_CAPABILITIES.THESIS_SCHEDULING,
        label: "Scheduling & Panels",
        description: "Schedule defense sessions and assign defense committees",
        href: "/admin/thesis/scheduling",
      },
      {
        key: ADMIN_CAPABILITIES.THESIS_RECORDS,
        label: "Defense Records & RAP Reports",
        description: "View defense records, scores, and RAP report generation",
        href: "/admin/thesis/defense-records",
      },
      {
        key: ADMIN_CAPABILITIES.THESIS_ADVISERS,
        label: "Adviser Request Review",
        description: "Review and approve student adviser requests and assignments",
        href: "/admin/thesis/advisers",
      },
    ],
  },
  {
    groupTitle: "Institutional & System",
    groupDescription:
      "Access institutional analytics, system settings, announcements, and the research repository.",
    capabilities: [
      {
        key: ADMIN_CAPABILITIES.SYSTEM_ANALYTICS,
        label: "Analytics & Reports",
        description: "View institutional analytics and graduate school reports",
        href: "/admin/analytics",
      },
      {
        key: ADMIN_CAPABILITIES.SYSTEM_SETTINGS,
        label: "System Settings & Storage Health",
        description: "Manage academic programs, system configuration, and storage health",
        href: "/admin/settings",
      },
      {
        key: ADMIN_CAPABILITIES.SYSTEM_MEMOS,
        label: "Announcements & Memos",
        description: "Publish and manage official announcements and memos",
        href: "/admin/memos",
      },
      {
        key: ADMIN_CAPABILITIES.SYSTEM_REPOSITORY,
        label: "Repository",
        description: "Manage published graduate research repository entries",
        href: "/admin/repository",
      },
    ],
  },
];

export const ALL_ADMIN_CAPABILITY_KEYS: AdminCapabilityKey[] =
  Object.values(ADMIN_CAPABILITIES);

export const CAPABILITY_LABELS: Record<AdminCapabilityKey, string> =
  ADMIN_CAPABILITY_GROUPS.reduce(
    (acc, group) => {
      for (const item of group.capabilities) {
        acc[item.key] = item.label;
      }
      return acc;
    },
    {} as Record<AdminCapabilityKey, string>,
  );

/**
 * Maps an Admin portal route prefix to its required capability (or "FULL_ONLY" / "ALWAYS").
 */
export function getRequiredCapabilityForAdminPath(
  pathname: string,
): AdminCapabilityKey | "FULL_ONLY" | "ALWAYS" {
  if (
    pathname === "/admin" ||
    pathname === "/admin/dashboard" ||
    pathname.startsWith("/admin/notifications")
  ) {
    return "ALWAYS";
  }

  if (
    pathname.startsWith("/admin/users/administrators") ||
    pathname.startsWith("/admin/users/roles")
  ) {
    return "FULL_ONLY";
  }

  if (pathname.startsWith("/admin/users/applicants")) {
    return ADMIN_CAPABILITIES.USERS_APPLICANTS;
  }
  if (pathname.startsWith("/admin/users/students")) {
    return ADMIN_CAPABILITIES.USERS_STUDENTS;
  }
  if (
    pathname.startsWith("/admin/users/panelists") ||
    pathname.startsWith("/admin/users/faculty")
  ) {
    return ADMIN_CAPABILITIES.USERS_FACULTY;
  }

  if (pathname.startsWith("/admin/exam/slots")) {
    return ADMIN_CAPABILITIES.EXAMS_SCHEDULES;
  }
  if (
    pathname.startsWith("/admin/exam/applications") ||
    pathname.startsWith("/admin/exam/scores")
  ) {
    return ADMIN_CAPABILITIES.EXAMS_RECORDS;
  }
  if (pathname.startsWith("/admin/exam/questions")) {
    return ADMIN_CAPABILITIES.EXAMS_QUESTIONS;
  }
  if (pathname.startsWith("/admin/exam/cor")) {
    return ADMIN_CAPABILITIES.EXAMS_COR;
  }
  if (pathname.startsWith("/admin/exam/waiver")) {
    return ADMIN_CAPABILITIES.EXAMS_WAIVER;
  }

  if (pathname.startsWith("/admin/thesis/applications")) {
    return ADMIN_CAPABILITIES.THESIS_APPLICATIONS;
  }
  if (pathname.startsWith("/admin/thesis/scheduling")) {
    return ADMIN_CAPABILITIES.THESIS_SCHEDULING;
  }
  if (
    pathname.startsWith("/admin/thesis/defense-records") ||
    pathname.startsWith("/admin/thesis/rap-reports")
  ) {
    return ADMIN_CAPABILITIES.THESIS_RECORDS;
  }
  if (pathname.startsWith("/admin/thesis/advisers")) {
    return ADMIN_CAPABILITIES.THESIS_ADVISERS;
  }

  if (pathname.startsWith("/admin/analytics")) {
    return ADMIN_CAPABILITIES.SYSTEM_ANALYTICS;
  }
  if (pathname.startsWith("/admin/settings")) {
    return ADMIN_CAPABILITIES.SYSTEM_SETTINGS;
  }
  if (pathname.startsWith("/admin/memos")) {
    return ADMIN_CAPABILITIES.SYSTEM_MEMOS;
  }
  if (pathname.startsWith("/admin/repository")) {
    return ADMIN_CAPABILITIES.SYSTEM_REPOSITORY;
  }

  return "ALWAYS";
}

export function canAdminAccessPath(
  pathname: string,
  accessLevel?: AdminAccessLevel | string | null,
  capabilities?: string[] | null,
): boolean {
  const normalizedLevel = accessLevel ?? "FULL";
  if (normalizedLevel === "FULL") {
    return true;
  }

  const requirement = getRequiredCapabilityForAdminPath(pathname);
  if (requirement === "ALWAYS") {
    return true;
  }
  if (requirement === "FULL_ONLY") {
    return false;
  }

  const capList = Array.isArray(capabilities) ? capabilities : [];
  return capList.includes(requirement);
}
