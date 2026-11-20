import type {
  CourseProgressStatus,
  CurriculumGroupType,
} from "@/types/curriculum";

export const COURSE_STATUS_OPTIONS: Array<{
  value: CourseProgressStatus;
  label: string;
}> = [
  { value: "NOT_TAKEN", label: "Not Taken" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "PASSED", label: "Passed" },
  { value: "CREDITED", label: "Credited (Transfer / Shifted)" },
  { value: "INCOMPLETE", label: "Incomplete (INC)" },
  { value: "FAILED", label: "Failed" },
  { value: "DROPPED", label: "Dropped" },
];

export const COURSE_STATUS_LABEL: Record<CourseProgressStatus, string> = {
  NOT_TAKEN: "Not Taken",
  IN_PROGRESS: "In Progress",
  PASSED: "Passed",
  CREDITED: "Credited",
  INCOMPLETE: "Incomplete (INC)",
  FAILED: "Failed",
  DROPPED: "Dropped",
};

export const COURSE_STATUS_TONE: Record<CourseProgressStatus, string> = {
  NOT_TAKEN: "border-gray-200 bg-gray-50 text-gray-600",
  IN_PROGRESS: "border-sky-200 bg-sky-50 text-sky-700",
  PASSED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  CREDITED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  INCOMPLETE: "border-amber-200 bg-amber-50 text-amber-800",
  FAILED: "border-red-200 bg-red-50 text-red-700",
  DROPPED: "border-gray-200 bg-gray-100 text-gray-600",
};

export const SEMESTER_OPTIONS = ["1st Sem", "2nd Sem", "Summer"] as const;

export const CURRICULUM_GROUP_TYPE_OPTIONS: Array<{
  value: CurriculumGroupType;
  label: string;
}> = [
  { value: "FOUNDATION", label: "Foundation Courses" },
  { value: "MAJOR", label: "Major Courses" },
  { value: "COGNATE", label: "Cognate / Elective Courses" },
  { value: "FOREIGN_LANGUAGE", label: "Foreign Language" },
  { value: "THESIS", label: "Thesis" },
  { value: "DISSERTATION", label: "Dissertation" },
  { value: "BRIDGING", label: "Bridging Program" },
  { value: "OTHER", label: "Other" },
];

export function isGradedCourseStatus(status: CourseProgressStatus): boolean {
  return (
    status === "PASSED" ||
    status === "FAILED" ||
    status === "INCOMPLETE" ||
    status === "DROPPED" ||
    status === "CREDITED"
  );
}
