export const ADMIN_CAPABILITY_KEYS = [
  // 1. User Management
  "applicants.manage",
  "students.manage",
  "faculty.manage",
  // 2. Exam Management
  "exam.schedules.manage",
  "exam.records.manage",
  "exam.questions.manage",
  "cor.verify",
  "waivers.manage",
  // 3. Thesis Management
  "defense.applications.manage",
  "defense.schedules.manage",
  "defense.records.view",
  "adviser.requests.manage",
  // 4. Institutional & System
  "analytics.view",
  "memos.manage",
  "repository.manage",
  "settings.manage",
] as const;

export type AdminCapabilityKey = (typeof ADMIN_CAPABILITY_KEYS)[number];

const CAPABILITY_ALIASES: Record<string, AdminCapabilityKey> = {
  USERS_APPLICANTS: "applicants.manage",
  USERS_STUDENTS: "students.manage",
  USERS_FACULTY: "faculty.manage",
  EXAMS_SCHEDULES: "exam.schedules.manage",
  EXAMS_RECORDS: "exam.records.manage",
  EXAMS_QUESTIONS: "exam.questions.manage",
  EXAMS_COR: "cor.verify",
  EXAMS_WAIVER: "waivers.manage",
  THESIS_APPLICATIONS: "defense.applications.manage",
  THESIS_SCHEDULING: "defense.schedules.manage",
  THESIS_RECORDS: "defense.records.view",
  THESIS_ADVISERS: "adviser.requests.manage",
  SYSTEM_ANALYTICS: "analytics.view",
  SYSTEM_SETTINGS: "settings.manage",
  SYSTEM_MEMOS: "memos.manage",
  SYSTEM_REPOSITORY: "repository.manage",
};

export function isValidAdminCapability(key: unknown): key is AdminCapabilityKey {
  return (
    typeof key === "string" &&
    (ADMIN_CAPABILITY_KEYS as readonly string[]).includes(key)
  );
}

export function sanitizeAdminCapabilities(input: unknown): AdminCapabilityKey[] {
  let rawList: unknown = input;
  if (typeof rawList === "string") {
    try {
      rawList = JSON.parse(rawList);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(rawList)) return [];

  const valid = new Set<AdminCapabilityKey>();
  for (const item of rawList) {
    if (isValidAdminCapability(item)) {
      valid.add(item);
    } else if (typeof item === "string" && item in CAPABILITY_ALIASES) {
      valid.add(CAPABILITY_ALIASES[item]);
    }
  }
  return Array.from(valid);
}
