import prisma from "../config/database";
import { AppError } from "../utils/AppError";
import { EXAM_CONFIGURATION_KEY, validateExamConfiguration } from "../services/exam-configuration.rules";
import type { ExamConfigurationValues } from "../interfaces/exam-configuration.interfaces";

function readValues(row: { settingType: string; settingValue: string | null } | null): ExamConfigurationValues {
  if (!row) return { examDurationMinutes: null, mcqPointsPerCorrectItem: null, essayMaximumScore: null, passingThreshold: null };
  try {
    if (row.settingType !== "JSON" || row.settingValue === null) throw new Error("Invalid stored configuration");
    return validateExamConfiguration(JSON.parse(row.settingValue));
  } catch {
    // Corrupt persistence must not turn into fabricated defaults or raw JSON.
    throw new AppError("Exam configuration could not be read. Contact the system administrator.", 500);
  }
}

export class ExamConfigurationRepository {
  async getCurrent(): Promise<ExamConfigurationValues> {
    return readValues(await prisma.systemSetting.findUnique({
      where: { settingKey: EXAM_CONFIGURATION_KEY },
      select: { settingType: true, settingValue: true },
    }));
  }

  async replaceCurrent(values: ExamConfigurationValues, actorId: string): Promise<ExamConfigurationValues> {
    const data = {
      settingValue: JSON.stringify(values), settingType: "JSON" as const,
      isEditableByAdmin: false, lastModifiedById: actorId,
    };
    return readValues(await prisma.systemSetting.upsert({
      where: { settingKey: EXAM_CONFIGURATION_KEY },
      create: { settingKey: EXAM_CONFIGURATION_KEY, ...data }, update: data,
      select: { settingType: true, settingValue: true },
    }));
  }
}
