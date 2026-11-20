import { AppError } from "../utils/AppError";
import {
  evaluateCompExamSummary,
  type CompExamRecordLike,
} from "./comp-exam.rules";

export type CurriculumProgramType = "MASTERS" | "DOCTORAL";

export type CurriculumGroupTypeValue =
  | "FOUNDATION"
  | "MAJOR"
  | "COGNATE"
  | "THESIS"
  | "DISSERTATION"
  | "FOREIGN_LANGUAGE"
  | "BRIDGING"
  | "OTHER";

export type CourseProgressStatusValue =
  | "NOT_TAKEN"
  | "IN_PROGRESS"
  | "PASSED"
  | "FAILED"
  | "INCOMPLETE"
  | "DROPPED"
  | "CREDITED";

export type PublicationMilestoneStatusValue =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "SUBMITTED"
  | "VERIFIED";

export interface GradingScaleOption {
  value: string;
  label: string;
  percentRange: string;
  outcome: "PASSED" | "FAILED" | "INCOMPLETE" | "DROPPED";
  numericValue: number | null;
}

export interface GradingScaleInfo {
  programType: CurriculumProgramType;
  retentionGwaThreshold: number;
  incRemovalNote: string;
  options: readonly GradingScaleOption[];
}

export const INC_REMOVAL_NOTE =
  "Removal of INC must be completed within one (1) year; maximum removal grade is 1.25 (EARIST Manual §7.16.3).";

export const SEMESTER_OPTIONS = ["1st Sem", "2nd Sem", "Summer"] as const;

const MASTERS_GRADING_OPTIONS: readonly GradingScaleOption[] = [
  {
    value: "1.00",
    label: "1.00 — Excellent",
    percentRange: "97–100",
    outcome: "PASSED",
    numericValue: 1.0,
  },
  {
    value: "1.25",
    label: "1.25 — Very Good",
    percentRange: "94–96",
    outcome: "PASSED",
    numericValue: 1.25,
  },
  {
    value: "1.50",
    label: "1.50 — Good",
    percentRange: "91–93",
    outcome: "PASSED",
    numericValue: 1.5,
  },
  {
    value: "1.75",
    label: "1.75 — Fair",
    percentRange: "88–90",
    outcome: "PASSED",
    numericValue: 1.75,
  },
  {
    value: "2.00",
    label: "2.00 — Passed",
    percentRange: "85–87",
    outcome: "PASSED",
    numericValue: 2.0,
  },
  {
    value: "5.00",
    label: "5.00 — Failed",
    percentRange: "84 & below",
    outcome: "FAILED",
    numericValue: 5.0,
  },
  {
    value: "INC",
    label: "INC — Incomplete",
    percentRange: "—",
    outcome: "INCOMPLETE",
    numericValue: null,
  },
  {
    value: "DRP",
    label: "DRP — Dropped",
    percentRange: "—",
    outcome: "DROPPED",
    numericValue: null,
  },
];

const DOCTORAL_GRADING_OPTIONS: readonly GradingScaleOption[] = [
  {
    value: "1.00",
    label: "1.00 — Excellent",
    percentRange: "97–100",
    outcome: "PASSED",
    numericValue: 1.0,
  },
  {
    value: "1.25",
    label: "1.25 — Very Good",
    percentRange: "94–96",
    outcome: "PASSED",
    numericValue: 1.25,
  },
  {
    value: "1.50",
    label: "1.50 — Good",
    percentRange: "91–93",
    outcome: "PASSED",
    numericValue: 1.5,
  },
  {
    value: "1.75",
    label: "1.75 — Passed",
    percentRange: "88–90",
    outcome: "PASSED",
    numericValue: 1.75,
  },
  {
    value: "5.00",
    label: "5.00 — Failed",
    percentRange: "87 & below",
    outcome: "FAILED",
    numericValue: 5.0,
  },
  {
    value: "INC",
    label: "INC — Incomplete",
    percentRange: "—",
    outcome: "INCOMPLETE",
    numericValue: null,
  },
  {
    value: "DRP",
    label: "DRP — Dropped",
    percentRange: "—",
    outcome: "DROPPED",
    numericValue: null,
  },
];

export function normalizeProgramType(
  programType: string | null | undefined,
): CurriculumProgramType {
  return String(programType ?? "").toUpperCase() === "DOCTORAL"
    ? "DOCTORAL"
    : "MASTERS";
}

export function getGradingScaleForProgram(
  programType: string | null | undefined,
): GradingScaleInfo {
  const normalized = normalizeProgramType(programType);
  if (normalized === "DOCTORAL") {
    return {
      programType: "DOCTORAL",
      retentionGwaThreshold: 1.75,
      incRemovalNote: INC_REMOVAL_NOTE,
      options: DOCTORAL_GRADING_OPTIONS,
    };
  }
  return {
    programType: "MASTERS",
    retentionGwaThreshold: 2.0,
    incRemovalNote: INC_REMOVAL_NOTE,
    options: MASTERS_GRADING_OPTIONS,
  };
}

export function normalizeRatingInput(raw: unknown): string | null {
  if (raw === undefined || raw === null) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;

  const upper = trimmed.toUpperCase();
  if (upper === "INC" || upper === "INCOMPLETE") return "INC";
  if (upper === "DRP" || upper === "DROPPED") return "DRP";

  const parsed = Number(trimmed);
  if (Number.isFinite(parsed) && /^\d+(?:\.\d{1,2})?$/.test(trimmed)) {
    return parsed.toFixed(2);
  }
  return upper;
}

export function normalizeSemesterInput(raw: unknown): string | null {
  if (raw === undefined || raw === null) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;

  const lower = trimmed.toLowerCase();
  if (lower === "1st" || lower === "1st sem" || lower === "first" || lower === "1st semester") {
    return "1st Sem";
  }
  if (lower === "2nd" || lower === "2nd sem" || lower === "second" || lower === "2nd semester") {
    return "2nd Sem";
  }
  if (lower === "summer" || lower === "midyear" || lower === "intersession") {
    return "Summer";
  }
  throw new AppError(
    "Semester must be 1st Sem, 2nd Sem, or Summer.",
    400,
  );
}

const VALID_STATUSES: readonly CourseProgressStatusValue[] = [
  "NOT_TAKEN",
  "IN_PROGRESS",
  "PASSED",
  "FAILED",
  "INCOMPLETE",
  "DROPPED",
  "CREDITED",
];

export interface NormalizedCourseProgressInput {
  status: CourseProgressStatusValue;
  rating: string | null;
  semester: string | null;
  schoolYear: string | null;
  remarks: string | null;
}

export function validateAndNormalizeCourseProgressInput(
  programType: string | null | undefined,
  input: {
    status?: unknown;
    rating?: unknown;
    semester?: unknown;
    schoolYear?: unknown;
    remarks?: unknown;
  },
): NormalizedCourseProgressInput {
  const scale = getGradingScaleForProgram(programType);
  const normalizedRating = normalizeRatingInput(input.rating);

  const rawStatus =
    input.status !== undefined && input.status !== null && String(input.status).trim() !== ""
      ? (String(input.status).trim().toUpperCase() as CourseProgressStatusValue)
      : null;

  if (rawStatus !== null && !VALID_STATUSES.includes(rawStatus)) {
    throw new AppError("Invalid course progress status.", 400);
  }

  let matchedRating: GradingScaleOption | null = null;
  if (normalizedRating !== null) {
    matchedRating =
      scale.options.find((opt) => opt.value === normalizedRating) ?? null;
    if (!matchedRating) {
      if (scale.programType === "DOCTORAL" && normalizedRating === "2.00") {
        throw new AppError(
          "Rating 2.00 is not valid for Doctoral programs (minimum passing grade is 1.75 per EARIST Manual §7.16.1).",
          400,
        );
      }
      throw new AppError(
        `Invalid rating "${normalizedRating}" for ${
          scale.programType === "DOCTORAL" ? "Doctoral" : "Master's"
        } grading scale.`,
        400,
      );
    }
  }

  let status: CourseProgressStatusValue;
  let finalRating: string | null = matchedRating?.value ?? null;

  if (rawStatus === "NOT_TAKEN" || rawStatus === "IN_PROGRESS") {
    status = rawStatus;
    finalRating = null;
  } else if (rawStatus === null) {
    if (!matchedRating) {
      throw new AppError("Please specify a course status or rating.", 400);
    }
    status = matchedRating.outcome;
  } else if (rawStatus === "CREDITED") {
    if (matchedRating && matchedRating.outcome !== "PASSED") {
      throw new AppError(
        `A credited course cannot carry a "${matchedRating.value}" rating.`,
        400,
      );
    }
    status = "CREDITED";
  } else {
    if (matchedRating && matchedRating.outcome !== rawStatus) {
      throw new AppError(
        `Rating "${matchedRating.value}" does not match status "${rawStatus}".`,
        400,
      );
    }
    status = rawStatus;
  }

  const semester = normalizeSemesterInput(input.semester);
  const schoolYearRaw =
    input.schoolYear !== undefined && input.schoolYear !== null
      ? String(input.schoolYear).trim()
      : "";
  if (schoolYearRaw.length > 32) {
    throw new AppError("School year must be 32 characters or fewer.", 400);
  }

  const remarksRaw =
    input.remarks !== undefined && input.remarks !== null
      ? String(input.remarks).trim()
      : "";
  if (remarksRaw.length > 500) {
    throw new AppError("Remarks must be 500 characters or fewer.", 400);
  }

  return {
    status,
    rating: finalRating,
    semester,
    schoolYear: schoolYearRaw || null,
    remarks: remarksRaw || null,
  };
}

export interface CurriculumCourseLike {
  id: string;
  courseCode: string;
  courseTitle: string;
  units: number;
  isRequired: boolean;
  prerequisiteNote?: string | null;
  displayOrder: number;
}

export interface CurriculumGroupLike {
  id: string;
  groupType: CurriculumGroupTypeValue | string;
  label: string;
  requiredUnits: number;
  countsTowardWce: boolean;
  selectionNote?: string | null;
  displayOrder: number;
  courses: readonly CurriculumCourseLike[];
}

export interface CurriculumVersionLike {
  id: string;
  versionCode: string;
  label: string;
  curriculumType: "OLD" | "NEW" | string;
  effectiveSchoolYear?: string | null;
  totalRequiredUnits: number;
  groups: readonly CurriculumGroupLike[];
}

export interface StudentCourseProgressLike {
  curriculumCourseId: string;
  status: CourseProgressStatusValue | string;
  rating?: string | null;
  isVerifiedByAdmin: boolean;
}

export interface GroupProgressEvaluation {
  groupId: string;
  groupType: string;
  label: string;
  requiredUnits: number;
  countsTowardWce: boolean;
  earnedUnitsRaw: number;
  earnedUnitsEffective: number;
  verifiedUnitsEffective: number;
  inProgressUnits: number;
  remainingUnits: number;
  isComplete: boolean;
}

export type WceReadinessStatus = "READY" | "IN_PROGRESS" | "NOT_STARTED";

export interface CurriculumProgressSummary {
  programType: CurriculumProgramType;
  totalRequiredUnits: number;
  totalEarnedUnits: number;
  totalVerifiedUnits: number;
  totalInProgressUnits: number;
  totalRemainingUnits: number;
  completionPercent: number;
  wceRequiredUnits: number;
  wceEarnedUnits: number;
  wceVerifiedUnits: number;
  wceInProgressUnits: number;
  wceRemainingUnits: number;
  wceReadinessStatus: WceReadinessStatus;
  unofficialGwa: number | null;
  retentionGwaThreshold: number;
  meetsRetentionGwa: boolean | null;
  incCount: number;
  encodedCourseCount: number;
  verifiedCourseCount: number;
  groups: GroupProgressEvaluation[];
}

export function isCourseCompletedStatus(status: string): boolean {
  const upper = String(status).toUpperCase();
  return upper === "PASSED" || upper === "CREDITED";
}

export function evaluateCurriculumProgress(params: {
  programType: string | null | undefined;
  version: CurriculumVersionLike;
  progressByCourseId: Map<string, StudentCourseProgressLike>;
}): CurriculumProgressSummary {
  const scale = getGradingScaleForProgram(params.programType);
  const numericLookup = new Map<string, number>();
  for (const opt of scale.options) {
    if (opt.numericValue !== null) {
      numericLookup.set(opt.value, opt.numericValue);
    }
  }

  let totalRequiredUnits = 0;
  let totalEarnedUnits = 0;
  let totalVerifiedUnits = 0;
  let totalInProgressUnits = 0;
  let wceRequiredUnits = 0;
  let wceEarnedUnits = 0;
  let wceVerifiedUnits = 0;
  let wceInProgressUnits = 0;

  let weightedGradeSum = 0;
  let weightedUnitSum = 0;
  let incCount = 0;
  let encodedCourseCount = 0;
  let verifiedCourseCount = 0;

  const groupEvaluations: GroupProgressEvaluation[] = [];

  for (const group of params.version.groups) {
    let earnedUnitsRaw = 0;
    let verifiedUnitsRaw = 0;
    let inProgressUnitsRaw = 0;

    for (const course of group.courses) {
      const progress = params.progressByCourseId.get(course.id);
      if (!progress) continue;

      const statusUpper = String(progress.status).toUpperCase();
      if (statusUpper !== "NOT_TAKEN") {
        encodedCourseCount += 1;
      }
      if (progress.isVerifiedByAdmin) {
        verifiedCourseCount += 1;
      }
      if (statusUpper === "INCOMPLETE") {
        incCount += 1;
      }

      if (isCourseCompletedStatus(statusUpper)) {
        earnedUnitsRaw += course.units;
        if (progress.isVerifiedByAdmin) {
          verifiedUnitsRaw += course.units;
        }
      } else if (statusUpper === "IN_PROGRESS") {
        inProgressUnitsRaw += course.units;
      }

      const normalizedRating = normalizeRatingInput(progress.rating);
      if (normalizedRating && numericLookup.has(normalizedRating)) {
        const gradeValue = numericLookup.get(normalizedRating)!;
        weightedGradeSum += gradeValue * course.units;
        weightedUnitSum += course.units;
      }
    }

    // Cap effective units at group.requiredUnits for elective/choose-N pools.
    const earnedUnitsEffective = Math.min(earnedUnitsRaw, group.requiredUnits);
    const verifiedUnitsEffective = Math.min(
      verifiedUnitsRaw,
      group.requiredUnits,
    );
    const remainingUnits = Math.max(0, group.requiredUnits - earnedUnitsEffective);
    const inProgressUnits = Math.min(inProgressUnitsRaw, remainingUnits);
    const isComplete =
      group.requiredUnits > 0 ? earnedUnitsEffective >= group.requiredUnits : true;

    groupEvaluations.push({
      groupId: group.id,
      groupType: String(group.groupType),
      label: group.label,
      requiredUnits: group.requiredUnits,
      countsTowardWce: group.countsTowardWce,
      earnedUnitsRaw,
      earnedUnitsEffective,
      verifiedUnitsEffective,
      inProgressUnits,
      remainingUnits,
      isComplete,
    });

    totalRequiredUnits += group.requiredUnits;
    totalEarnedUnits += earnedUnitsEffective;
    totalVerifiedUnits += verifiedUnitsEffective;
    totalInProgressUnits += inProgressUnits;

    if (group.countsTowardWce) {
      wceRequiredUnits += group.requiredUnits;
      wceEarnedUnits += earnedUnitsEffective;
      wceVerifiedUnits += verifiedUnitsEffective;
      wceInProgressUnits += inProgressUnits;
    }
  }

  const resolvedTotalRequired =
    totalRequiredUnits > 0
      ? totalRequiredUnits
      : Math.max(0, params.version.totalRequiredUnits);
  const totalRemainingUnits = Math.max(0, resolvedTotalRequired - totalEarnedUnits);
  const completionPercent =
    resolvedTotalRequired > 0
      ? Math.min(100, Math.round((totalEarnedUnits / resolvedTotalRequired) * 100))
      : 0;

  const wceRemainingUnits = Math.max(0, wceRequiredUnits - wceEarnedUnits);
  let wceReadinessStatus: WceReadinessStatus = "NOT_STARTED";
  if (wceRequiredUnits > 0 && wceEarnedUnits >= wceRequiredUnits) {
    wceReadinessStatus = "READY";
  } else if (wceEarnedUnits > 0 || wceInProgressUnits > 0) {
    wceReadinessStatus = "IN_PROGRESS";
  }

  const unofficialGwa =
    weightedUnitSum > 0
      ? Math.round((weightedGradeSum / weightedUnitSum) * 100) / 100
      : null;
  const meetsRetentionGwa =
    unofficialGwa !== null
      ? unofficialGwa <= scale.retentionGwaThreshold
      : null;

  return {
    programType: scale.programType,
    totalRequiredUnits: resolvedTotalRequired,
    totalEarnedUnits,
    totalVerifiedUnits,
    totalInProgressUnits,
    totalRemainingUnits,
    completionPercent,
    wceRequiredUnits,
    wceEarnedUnits,
    wceVerifiedUnits,
    wceInProgressUnits,
    wceRemainingUnits,
    wceReadinessStatus,
    unofficialGwa,
    retentionGwaThreshold: scale.retentionGwaThreshold,
    meetsRetentionGwa,
    incCount,
    encodedCourseCount,
    verifiedCourseCount,
    groups: groupEvaluations,
  };
}

export interface ThesisRecordMilestoneLike {
  stage: string;
  status: string;
  outcome?: string | null;
  defenseSchedules?: ReadonlyArray<{
    defenseType: string;
    conclusion?: { outcome?: string | null } | null;
  }>;
}

export interface GraduationMilestoneInputLike {
  publicationStatus?: PublicationMilestoneStatusValue | string | null;
  publicationTitle?: string | null;
  publicationVenue?: string | null;
  publicationUrl?: string | null;
  publicationYear?: string | null;
  publicationNotes?: string | null;
  isPublicationVerified?: boolean;
  publicationVerifiedAt?: Date | string | null;
}

export interface GraduationRequirementsEvaluation {
  comprehensiveExam: {
    status: "NOT_RECORDED" | "PENDING" | "RETAKE_REQUIRED" | "PASSED" | "DISMISSED";
    label: string;
    attemptsUsed: number;
    maxAttempts: number;
    passedAt: string | null;
  };
  thesisOrDissertation: {
    status: "NOT_STARTED" | "IN_PROGRESS" | "PASSED";
    label: string;
    requirementName: string;
    currentStage: string | null;
  };
  publication: {
    status: PublicationMilestoneStatusValue;
    requirementDescription: string;
    title: string | null;
    venue: string | null;
    url: string | null;
    year: string | null;
    notes: string | null;
    isVerified: boolean;
    verifiedAt: string | null;
  };
}

export function evaluateGraduationRequirements(params: {
  programType: string | null | undefined;
  compExamRecords: readonly CompExamRecordLike[];
  thesisRecords: readonly ThesisRecordMilestoneLike[];
  milestone: GraduationMilestoneInputLike | null | undefined;
}): GraduationRequirementsEvaluation {
  const normalizedType = normalizeProgramType(params.programType);
  const compSummary = evaluateCompExamSummary(params.compExamRecords);

  const compLabelMap: Record<string, string> = {
    NOT_RECORDED: "Not yet taken",
    PENDING: "Pending result",
    RETAKE_REQUIRED: `Retake required (${compSummary.failedCount}/${compSummary.maxAttempts} failed)`,
    PASSED: "Passed",
    DISMISSED: "Disqualified (3/3 failed)",
  };

  const passedAtDate = compSummary.passedAttempt?.examDate ?? compSummary.passedAttempt?.createdAt ?? null;
  const passedAtIso =
    passedAtDate instanceof Date
      ? passedAtDate.toISOString()
      : passedAtDate
        ? String(passedAtDate)
        : null;

  const requirementName =
    normalizedType === "DOCTORAL" ? "Publicly Defended Dissertation" : "Thesis";

  let thesisStatus: "NOT_STARTED" | "IN_PROGRESS" | "PASSED" = "NOT_STARTED";
  let thesisLabel = "Not yet started";
  let currentStage: string | null = null;

  const hasFinalPassed = params.thesisRecords.some((tr) => {
    const schedules = tr.defenseSchedules ?? [];
    if (
      schedules.some(
        (s) =>
          s.defenseType === "FINAL_DEFENSE" && s.conclusion?.outcome === "PASSED",
      )
    ) {
      return true;
    }
    return tr.stage === "FINAL" && tr.outcome === "PASSED";
  });

  if (hasFinalPassed) {
    thesisStatus = "PASSED";
    thesisLabel =
      normalizedType === "DOCTORAL" ? "Dissertation Passed" : "Thesis Passed";
    currentStage = "FINAL";
  } else if (params.thesisRecords.length > 0) {
    thesisStatus = "IN_PROGRESS";
    const latest = params.thesisRecords[0];
    currentStage = latest.stage;
    const stageMap: Record<string, string> = {
      TITLE: "Title Defense stage",
      PROPOSAL: "Proposal Defense stage",
      FINAL: "Final Defense stage",
    };
    thesisLabel = stageMap[latest.stage] ?? "In progress";
  }

  const rawPubStatus = String(
    params.milestone?.publicationStatus ?? "NOT_STARTED",
  ).toUpperCase();
  const publicationStatus: PublicationMilestoneStatusValue =
    params.milestone?.isPublicationVerified || rawPubStatus === "VERIFIED"
      ? "VERIFIED"
      : rawPubStatus === "SUBMITTED"
        ? "SUBMITTED"
        : rawPubStatus === "IN_PROGRESS"
          ? "IN_PROGRESS"
          : "NOT_STARTED";

  const publicationDescription =
    normalizedType === "DOCTORAL"
      ? "Publication in a nationally/internationally indexed journal or juried creative work outlet (Manual §7.25.2)."
      : "At least one (1) publication in a refereed journal or juried creative work outlet (Manual §7.25.2).";

  const pubVerifiedAt = params.milestone?.publicationVerifiedAt ?? null;

  return {
    comprehensiveExam: {
      status: compSummary.standing,
      label: compLabelMap[compSummary.standing] ?? compSummary.standing,
      attemptsUsed: compSummary.attemptsUsed,
      maxAttempts: compSummary.maxAttempts,
      passedAt: passedAtIso,
    },
    thesisOrDissertation: {
      status: thesisStatus,
      label: thesisLabel,
      requirementName,
      currentStage,
    },
    publication: {
      status: publicationStatus,
      requirementDescription: publicationDescription,
      title: params.milestone?.publicationTitle ?? null,
      venue: params.milestone?.publicationVenue ?? null,
      url: params.milestone?.publicationUrl ?? null,
      year: params.milestone?.publicationYear ?? null,
      notes: params.milestone?.publicationNotes ?? null,
      isVerified: Boolean(params.milestone?.isPublicationVerified),
      verifiedAt:
        pubVerifiedAt instanceof Date
          ? pubVerifiedAt.toISOString()
          : pubVerifiedAt
            ? String(pubVerifiedAt)
            : null,
    },
  };
}
