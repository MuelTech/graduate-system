/** Existing Settings page read/save contract. No implicit wildcard or key normalization. */
export const ORDINARY_SETTING_KEYS = Object.freeze([
  "ACADEMIC_YEAR", "SEMESTER", "ENROLLMENT_START", "ENROLLMENT_END",
  "TITLE_DEFENSE_START", "TITLE_DEFENSE_END", "PROPOSAL_DEFENSE_START",
  "PROPOSAL_DEFENSE_END", "FINAL_DEFENSE_START", "FINAL_DEFENSE_END",
] as const);
export const isOrdinarySettingKey = (key: unknown): key is typeof ORDINARY_SETTING_KEYS[number] =>
  typeof key === "string" && (ORDINARY_SETTING_KEYS as readonly string[]).includes(key);
