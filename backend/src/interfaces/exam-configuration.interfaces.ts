export interface ExamConfigurationValues {
  examDurationMinutes: number | null;
  mcqPointsPerCorrectItem: number | null;
  essayMaximumScore: number | null;
  passingThreshold: null;
}

export interface ExamConfiguration extends ExamConfigurationValues {
  passingThresholdUnit: null;
  timezone: "Asia/Manila";
  isComplete: false;
}
