import { AppError } from "../utils/AppError";
import type { ExamConfiguration, ExamConfigurationValues } from "../interfaces/exam-configuration.interfaces";

export const EXAM_CONFIGURATION_KEY = "entrance_exam_configuration";
const fields = ["examDurationMinutes", "mcqPointsPerCorrectItem", "essayMaximumScore", "passingThreshold"];

export function validateExamConfiguration(value: unknown): ExamConfigurationValues {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new AppError("Exam configuration must be an object.", 400);
  const data = value as Record<string, unknown>;
  if (Object.keys(data).length === 0) throw new AppError("Supply at least one configuration field; use null for unconfigured values.", 400);
  if (Object.keys(data).some(key => !fields.includes(key))) throw new AppError("Exam configuration contains unsupported fields.", 400);
  if (data.passingThreshold !== undefined && data.passingThreshold !== null) {
    throw new AppError("Passing threshold units and value require policy confirmation.", 400);
  }
  function number(name: string, integer = false): number | null {
    const entry = data[name];
    if (entry === null || entry === undefined) return null;
    if (typeof entry !== "number" || !Number.isFinite(entry) || entry <= 0 || entry > Number.MAX_SAFE_INTEGER ||
      (integer && (!Number.isSafeInteger(entry) || !Number.isSafeInteger(entry * 60_000)))) {
      const label = name === "examDurationMinutes" ? "Exam Duration" : name === "mcqPointsPerCorrectItem" ? "MCQ Points per Correct Item" : "Essay Maximum Score";
      throw new AppError(`${label} must be a positive ${integer ? "whole number of minutes within safe arithmetic limits" : "finite number within safe arithmetic limits"}, or null.`, 400);
    }
    return entry;
  }
  return {
    examDurationMinutes: number("examDurationMinutes", true),
    mcqPointsPerCorrectItem: number("mcqPointsPerCorrectItem"),
    essayMaximumScore: number("essayMaximumScore"),
    passingThreshold: null,
  };
}

export function examConfigurationDto(values: ExamConfigurationValues): ExamConfiguration {
  // Threshold semantics are unresolved, so no representable B1 draft is complete.
  return { ...values, passingThresholdUnit: null, timezone: "Asia/Manila", isComplete: false };
}
