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

export function isValidAdminCapability(key: unknown): key is AdminCapabilityKey {
  return (
    typeof key === "string" &&
    (ADMIN_CAPABILITY_KEYS as readonly string[]).includes(key)
  );
}

export function sanitizeAdminCapabilities(input: unknown): AdminCapabilityKey[] {
  if (!Array.isArray(input)) return [];
  const valid = new Set<AdminCapabilityKey>();
  for (const item of input) {
    if (isValidAdminCapability(item)) {
      valid.add(item);
    }
  }
  return Array.from(valid);
}
