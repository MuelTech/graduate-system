export interface ExamConfiguration {
  examDurationMinutes: number | null;
  mcqPointsPerCorrectItem: number | null;
  essayMaximumScore: number | null;
  passingThreshold: null;
  passingThresholdUnit: null;
  timezone: "Asia/Manila";
  isComplete: false;
}

export const CONFIGURATION_FIELDS = [
  {
    key: "examDurationMinutes",
    label: "Exam Duration",
    unit: "minutes",
    integer: true,
  },
  {
    key: "mcqPointsPerCorrectItem",
    label: "MCQ Points per Correct Item",
    unit: "points",
    integer: false,
  },
  {
    key: "essayMaximumScore",
    label: "Essay Maximum Score",
    unit: "points",
    integer: false,
  },
] as const;

export type ConfigurationDraft = Record<
  (typeof CONFIGURATION_FIELDS)[number]["key"],
  string
>;

export function configurationDraft(
  config: ExamConfiguration,
): ConfigurationDraft {
  return {
    examDurationMinutes: config.examDurationMinutes?.toString() ?? "",
    mcqPointsPerCorrectItem: config.mcqPointsPerCorrectItem?.toString() ?? "",
    essayMaximumScore: config.essayMaximumScore?.toString() ?? "",
  };
}

export function configurationPayload(draft: ConfigurationDraft) {
  const values: Record<string, number | null> = {};
  for (const field of CONFIGURATION_FIELDS) {
    const text = draft[field.key].trim();
    if (!text) {
      values[field.key] = null;
      continue;
    }
    const value = Number(text);
    if (
      !/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(text) ||
      !Number.isFinite(value) ||
      value <= 0 ||
      value > Number.MAX_SAFE_INTEGER ||
      (field.integer &&
        (!Number.isSafeInteger(value) || !Number.isSafeInteger(value * 60_000)))
    ) {
      throw new Error(
        `${field.label} must be a positive ${field.integer ? "whole number of minutes" : "number of points"} within safe arithmetic limits, or left blank.`,
      );
    }
    values[field.key] = value;
  }
  return { ...values, passingThreshold: null };
}
