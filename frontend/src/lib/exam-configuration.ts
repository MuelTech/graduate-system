export interface ExamConfiguration {
  examDurationMinutes: number | null;
  mcqPointsPerCorrectItem: number | null;
  essayMaximumScore: number | null;
  passingThreshold: number | null;
  passingThresholdUnit: "PERCENT";
  timezone: "Asia/Manila";
  isComplete: boolean;
}

export const CONFIGURATION_FIELDS = [
  {
    key: "passingThreshold",
    label: "Passing Threshold",
    unit: "%",
    integer: false,
  },
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
    passingThreshold: config.passingThreshold?.toString() ?? "",
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
      (field.key === "passingThreshold" && value > 100) ||
      (field.integer &&
        (!Number.isSafeInteger(value) || !Number.isSafeInteger(value * 60_000)))
    ) {
      throw new Error(
        field.key === "passingThreshold"
          ? "Passing Threshold must be greater than 0 and at most 100 percent, or left blank."
          : `${field.label} must be a positive ${field.integer ? "whole number of minutes" : "number of points"} within safe arithmetic limits, or left blank.`,
      );
    }
    values[field.key] = value;
  }
  return values;
}
