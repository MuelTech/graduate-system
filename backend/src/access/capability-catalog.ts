/** Internal business actions, never URLs, UI labels, or workflow assignments. */
export type AccessAccountCategory = "ADMIN" | "FACULTY";

interface CapabilityDefinition {
  readonly category: AccessAccountCategory;
  readonly directGrantable: boolean;
  readonly requires: readonly string[];
}

function administrative(...requires: string[]): CapabilityDefinition {
  return Object.freeze({ category: "ADMIN", directGrantable: true, requires: Object.freeze(requires) });
}

export const CAPABILITY_CATALOG = Object.freeze({
  "applicants.view": administrative(),
  "students.view": administrative(),
  "students.comprehensive_exam.manage": administrative("students.view"),
  "waivers.view": administrative(),
  "waivers.manage": administrative("waivers.view"),
  "cor.view": administrative(),
  "cor.verify": administrative("cor.view"),
  "exam.schedules.view": administrative(),
  "exam.schedules.manage": administrative("exam.schedules.view"),
  "exam.records.view": administrative(),
  "exam.starts.authorize": administrative("exam.records.view"),
  "exam.results.finalize": administrative("exam.records.view"),
  "exam.results.reconsider": administrative("exam.records.view"),
  "exam.questions.view": administrative(),
  "exam.questions.manage": administrative("exam.questions.view"),
  "exam.configuration.manage": administrative(),
  "faculty.view": administrative(),
  "faculty.manage": administrative("faculty.view"),
  "adviser.requests.view": administrative(),
  "adviser.requests.review": administrative("adviser.requests.view"),
  "defense.applications.view": administrative(),
  "defense.applications.review": administrative("defense.applications.view"),
  "defense.schedules.view": administrative(),
  "defense.schedules.manage": administrative("defense.schedules.view"),
  "defense.records.view": administrative(),
  "repository.view": administrative(),
  "repository.manage": administrative("repository.view"),
  "memos.manage": administrative(),
  "settings.view": administrative(),
  "settings.manage": administrative("settings.view"),
  // Catalog entries only: no email service/queue/delivery integration in FACULTY-1.
  "email.configuration.manage": administrative(),
  "email.logs.view": administrative(),
  "storage.health.view": administrative(),
  "storage.integrity.scan": administrative("storage.health.view"),
  "audit.view": administrative(),
  "administrator_access.manage": Object.freeze({
    category: "ADMIN", directGrantable: false, requires: Object.freeze([]),
  }) satisfies CapabilityDefinition,
  // School-wide; eligibility stays with the future essay workflow. No Program scope.
  "essay.evaluate": Object.freeze({
    category: "FACULTY", directGrantable: true, requires: Object.freeze([]),
  }) satisfies CapabilityDefinition,
});

export type CapabilityKey = keyof typeof CAPABILITY_CATALOG;
export const CAPABILITY_KEYS: readonly CapabilityKey[] = Object.freeze(
  Object.keys(CAPABILITY_CATALOG) as CapabilityKey[],
);
export const FULL_ADMINISTRATOR_CAPABILITIES: readonly CapabilityKey[] = Object.freeze(
  CAPABILITY_KEYS.filter(key => CAPABILITY_CATALOG[key].category === "ADMIN"),
);

export function isCapabilityKey(value: unknown): value is CapabilityKey {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(CAPABILITY_CATALOG, value);
}

/** Validate prospective configuration. This function never grants/writes access. */
export function validateDirectCapabilityKeys(
  category: AccessAccountCategory,
  values: readonly unknown[],
): readonly CapabilityKey[] {
  if (category !== "ADMIN" && category !== "FACULTY") throw new Error("Unknown account category.");
  if (!Array.isArray(values)) throw new Error("Capability keys must be an array.");
  const result = new Set<CapabilityKey>();
  for (const value of values) {
    if (!isCapabilityKey(value)) throw new Error("Unknown capability key.");
    const definition = CAPABILITY_CATALOG[value];
    if (definition.category !== category || !definition.directGrantable) {
      throw new Error("Capability cannot be directly granted to this account category.");
    }
    if (result.has(value)) throw new Error("Duplicate capability key.");
    result.add(value);
  }
  return Object.freeze([...result].sort());
}

/** Explicit same-category read prerequisites; no route/module wildcard expansion. */
export function expandCapabilityPrerequisites(keys: readonly CapabilityKey[]): readonly CapabilityKey[] {
  const result = new Set<CapabilityKey>();
  function visit(key: CapabilityKey): void {
    if (!isCapabilityKey(key)) throw new Error("Unknown capability key.");
    if (result.has(key)) return;
    result.add(key);
    for (const dependency of CAPABILITY_CATALOG[key].requires) {
      if (!isCapabilityKey(dependency) ||
          CAPABILITY_CATALOG[dependency].category !== CAPABILITY_CATALOG[key].category) {
        throw new Error("Invalid capability prerequisite.");
      }
      visit(dependency);
    }
  }
  keys.forEach(visit);
  return Object.freeze([...result].sort());
}
