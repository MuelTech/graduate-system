export interface ExamConfigurationValues {
  examDurationMinutes: number | null;
  mcqPointsPerCorrectItem: number | null;
  essayMaximumScore: number | null;
  passingThreshold: number | null;
}

export interface ExamConfiguration extends ExamConfigurationValues {
  passingThresholdUnit: "PERCENT";
  timezone: "Asia/Manila";
  isComplete: boolean;
}
