import type {
  CurriculumGroupType,
  CurriculumType,
} from "@prisma/client";
import { CurriculumRepository } from "../repositories/curriculum.repository";
import { AppError } from "../utils/AppError";
import {
  evaluateCurriculumProgress,
  getGradingScaleForProgram,
  normalizeProgramType,
  validateAndNormalizeCourseProgressInput,
  type CurriculumGroupLike,
  type CurriculumVersionLike,
  type StudentCourseProgressLike,
} from "./curriculum-checklist.rules";

const VALID_GROUP_TYPES: readonly CurriculumGroupType[] = [
  "FOUNDATION",
  "MAJOR",
  "COGNATE",
  "THESIS",
  "DISSERTATION",
  "FOREIGN_LANGUAGE",
  "BRIDGING",
  "OTHER",
];

function generateInternalVersionCode(
  curriculumType: CurriculumType,
  effectiveSchoolYear: string | null,
  label: string,
): string {
  const base = (effectiveSchoolYear || label)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  const suffix = Date.now().toString(36).toUpperCase().slice(-5);
  return `${curriculumType}-${base || "CUR"}-${suffix}`.slice(0, 64);
}

function formatPersonName(
  person: { firstName: string; lastName: string; suffix?: string | null } | null | undefined,
): string | null {
  if (!person) return null;
  const full = [person.firstName, person.lastName, person.suffix]
    .filter((v) => Boolean(v && v.trim()))
    .join(" ")
    .trim();
  return full || null;
}

function parseOptionalTrimmed(
  value: unknown,
  maxLength: number,
  fieldLabel: string,
): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  if (trimmed.length > maxLength) {
    throw new AppError(
      `${fieldLabel} must be ${maxLength} characters or fewer.`,
      400,
    );
  }
  return trimmed;
}

function parseRequiredTrimmed(
  value: unknown,
  minLength: number,
  maxLength: number,
  fieldLabel: string,
): string {
  const trimmed = String(value ?? "").trim();
  if (trimmed.length < minLength) {
    throw new AppError(
      `${fieldLabel} must be at least ${minLength} character${minLength === 1 ? "" : "s"}.`,
      400,
    );
  }
  if (trimmed.length > maxLength) {
    throw new AppError(
      `${fieldLabel} must be ${maxLength} characters or fewer.`,
      400,
    );
  }
  return trimmed;
}

function parseIntegerInRange(
  value: unknown,
  min: number,
  max: number,
  fieldLabel: string,
): number {
  const num = Number(value);
  if (!Number.isInteger(num) || num < min || num > max) {
    throw new AppError(
      `${fieldLabel} must be a whole number between ${min} and ${max}.`,
      400,
    );
  }
  return num;
}

export class CurriculumService {
  constructor(private readonly repository = new CurriculumRepository()) {}

  // ── Admin Curriculum Master Operations ────────────────────────────────────

  async listVersions(programId?: string) {
    const versions = await this.repository.listVersions(programId);
    return { versions };
  }

  async getVersion(versionId: string) {
    const version = await this.repository.getVersionById(versionId);
    if (!version) {
      throw new AppError("Curriculum version not found.", 404);
    }
    return { version };
  }

  async listProgramVersions(programId: string) {
    const program = await this.repository.findProgramById(programId);
    if (!program) {
      throw new AppError("Graduate program not found.", 404);
    }
    const versions = await this.repository.listVersionsByProgram(programId);
    return { program, versions };
  }

  async createVersion(adminId: string, body: Record<string, unknown>) {
    if (!adminId) {
      throw new AppError("Authenticated Admin identity is required.", 401);
    }
    const programId = parseRequiredTrimmed(
      body.programId,
      1,
      191,
      "Program ID",
    );
    const program = await this.repository.findProgramById(programId);
    if (!program) {
      throw new AppError("Selected graduate program was not found.", 404);
    }

    const label = parseRequiredTrimmed(body.label, 2, 191, "Curriculum label");

    const rawType = String(body.curriculumType ?? "NEW").trim().toUpperCase();
    if (rawType !== "NEW" && rawType !== "OLD") {
      throw new AppError("Curriculum type must be NEW or OLD.", 400);
    }
    const curriculumType = rawType as CurriculumType;

    const effectiveSchoolYear = parseOptionalTrimmed(
      body.effectiveSchoolYear,
      64,
      "Effective school year",
    );
    const providedVersionCode = parseOptionalTrimmed(
      body.versionCode,
      64,
      "Version code",
    );
    const versionCode =
      providedVersionCode ??
      generateInternalVersionCode(curriculumType, effectiveSchoolYear, label);
    const notes = parseOptionalTrimmed(body.notes, 2000, "Notes");
    const isDefaultForNewStudents = Boolean(body.isDefaultForNewStudents);
    const isActive =
      body.isActive === undefined ? true : Boolean(body.isActive);

    const version = await this.repository.createVersion(adminId, {
      programId,
      versionCode,
      label,
      curriculumType,
      effectiveSchoolYear,
      totalRequiredUnits: 0,
      isDefaultForNewStudents,
      isActive,
      notes,
    });
    return { version };
  }

  async updateVersion(
    adminId: string,
    versionId: string,
    body: Record<string, unknown>,
  ) {
    if (!adminId) {
      throw new AppError("Authenticated Admin identity is required.", 401);
    }
    const existing = await this.repository.getVersionById(versionId);
    if (!existing) {
      throw new AppError("Curriculum version not found.", 404);
    }

    const patch: {
      versionCode?: string;
      label?: string;
      curriculumType?: CurriculumType;
      effectiveSchoolYear?: string | null;
      isDefaultForNewStudents?: boolean;
      isActive?: boolean;
      notes?: string | null;
    } = {};

    if (body.versionCode !== undefined) {
      patch.versionCode = parseRequiredTrimmed(
        body.versionCode,
        1,
        64,
        "Version code",
      );
    }
    if (body.label !== undefined) {
      patch.label = parseRequiredTrimmed(body.label, 2, 191, "Curriculum label");
    }
    if (body.curriculumType !== undefined) {
      const rawType = String(body.curriculumType).trim().toUpperCase();
      if (rawType !== "NEW" && rawType !== "OLD") {
        throw new AppError("Curriculum type must be NEW or OLD.", 400);
      }
      patch.curriculumType = rawType as CurriculumType;
    }
    if (body.effectiveSchoolYear !== undefined) {
      patch.effectiveSchoolYear = parseOptionalTrimmed(
        body.effectiveSchoolYear,
        64,
        "Effective school year",
      );
    }
    if (body.isDefaultForNewStudents !== undefined) {
      patch.isDefaultForNewStudents = Boolean(body.isDefaultForNewStudents);
    }
    if (body.isActive !== undefined) {
      patch.isActive = Boolean(body.isActive);
    }
    if (body.notes !== undefined) {
      patch.notes = parseOptionalTrimmed(body.notes, 2000, "Notes");
    }

    const version = await this.repository.updateVersion(
      adminId,
      versionId,
      existing,
      patch,
    );
    return { version };
  }

  async createGroup(
    adminId: string,
    versionId: string,
    body: Record<string, unknown>,
  ) {
    if (!adminId) {
      throw new AppError("Authenticated Admin identity is required.", 401);
    }
    const version = await this.repository.getVersionById(versionId);
    if (!version) {
      throw new AppError("Curriculum version not found.", 404);
    }

    const rawType = String(body.groupType ?? "").trim().toUpperCase() as CurriculumGroupType;
    if (!VALID_GROUP_TYPES.includes(rawType)) {
      throw new AppError("Invalid course group type.", 400);
    }
    const label = parseRequiredTrimmed(body.label, 2, 191, "Group label");
    const requiredUnits = parseIntegerInRange(
      body.requiredUnits,
      0,
      120,
      "Required units",
    );
    const countsTowardWce =
      body.countsTowardWce !== undefined
        ? Boolean(body.countsTowardWce)
        : rawType !== "THESIS" && rawType !== "DISSERTATION";
    const selectionNote = parseOptionalTrimmed(
      body.selectionNote,
      191,
      "Selection note",
    );
    const displayOrder =
      body.displayOrder !== undefined
        ? parseIntegerInRange(body.displayOrder, 0, 500, "Display order")
        : version.groups.length + 1;

    const group = await this.repository.createGroup(adminId, versionId, {
      groupType: rawType,
      label,
      requiredUnits,
      countsTowardWce,
      selectionNote,
      displayOrder,
    });
    return { group };
  }

  async updateGroup(
    adminId: string,
    groupId: string,
    body: Record<string, unknown>,
  ) {
    if (!adminId) {
      throw new AppError("Authenticated Admin identity is required.", 401);
    }
    const existing = await this.repository.findGroupById(groupId);
    if (!existing) {
      throw new AppError("Curriculum course group not found.", 404);
    }

    const patch: {
      groupType?: CurriculumGroupType;
      label?: string;
      requiredUnits?: number;
      countsTowardWce?: boolean;
      selectionNote?: string | null;
      displayOrder?: number;
    } = {};

    if (body.groupType !== undefined) {
      const rawType = String(body.groupType).trim().toUpperCase() as CurriculumGroupType;
      if (!VALID_GROUP_TYPES.includes(rawType)) {
        throw new AppError("Invalid course group type.", 400);
      }
      patch.groupType = rawType;
    }
    if (body.label !== undefined) {
      patch.label = parseRequiredTrimmed(body.label, 2, 191, "Group label");
    }
    if (body.requiredUnits !== undefined) {
      patch.requiredUnits = parseIntegerInRange(
        body.requiredUnits,
        0,
        120,
        "Required units",
      );
    }
    if (body.countsTowardWce !== undefined) {
      patch.countsTowardWce = Boolean(body.countsTowardWce);
    }
    if (body.selectionNote !== undefined) {
      patch.selectionNote = parseOptionalTrimmed(
        body.selectionNote,
        191,
        "Selection note",
      );
    }
    if (body.displayOrder !== undefined) {
      patch.displayOrder = parseIntegerInRange(
        body.displayOrder,
        0,
        500,
        "Display order",
      );
    }

    const group = await this.repository.updateGroup(
      adminId,
      groupId,
      existing.curriculumVersionId,
      patch,
    );
    return { group };
  }

  async deleteGroup(adminId: string, groupId: string) {
    if (!adminId) {
      throw new AppError("Authenticated Admin identity is required.", 401);
    }
    const existing = await this.repository.findGroupById(groupId);
    if (!existing) {
      throw new AppError("Curriculum course group not found.", 404);
    }
    await this.repository.deleteGroupWithGuard(
      adminId,
      groupId,
      existing.curriculumVersionId,
      existing.label,
    );
    return { deleted: true };
  }

  async createCourse(
    adminId: string,
    groupId: string,
    body: Record<string, unknown>,
  ) {
    if (!adminId) {
      throw new AppError("Authenticated Admin identity is required.", 401);
    }
    const group = await this.repository.findGroupById(groupId);
    if (!group) {
      throw new AppError("Curriculum course group not found.", 404);
    }

    const courseCode = parseRequiredTrimmed(
      body.courseCode,
      1,
      32,
      "Course code",
    ).toUpperCase();
    const courseTitle = parseRequiredTrimmed(
      body.courseTitle,
      2,
      191,
      "Course title",
    );
    const units = parseIntegerInRange(body.units, 1, 30, "Units");
    const isRequired =
      body.isRequired === undefined ? true : Boolean(body.isRequired);
    const prerequisiteNote = parseOptionalTrimmed(
      body.prerequisiteNote,
      191,
      "Prerequisite note",
    );
    const displayOrder =
      body.displayOrder !== undefined
        ? parseIntegerInRange(body.displayOrder, 0, 500, "Display order")
        : 0;

    const course = await this.repository.createCourse(adminId, groupId, {
      courseCode,
      courseTitle,
      units,
      isRequired,
      prerequisiteNote,
      displayOrder,
    });
    return { course };
  }

  async updateCourse(
    adminId: string,
    courseId: string,
    body: Record<string, unknown>,
  ) {
    if (!adminId) {
      throw new AppError("Authenticated Admin identity is required.", 401);
    }
    const existing = await this.repository.findCourseById(courseId);
    if (!existing) {
      throw new AppError("Curriculum subject not found.", 404);
    }

    const patch: {
      courseCode?: string;
      courseTitle?: string;
      units?: number;
      isRequired?: boolean;
      prerequisiteNote?: string | null;
      displayOrder?: number;
    } = {};

    if (body.courseCode !== undefined) {
      patch.courseCode = parseRequiredTrimmed(
        body.courseCode,
        1,
        32,
        "Course code",
      ).toUpperCase();
    }
    if (body.courseTitle !== undefined) {
      patch.courseTitle = parseRequiredTrimmed(
        body.courseTitle,
        2,
        191,
        "Course title",
      );
    }
    if (body.units !== undefined) {
      patch.units = parseIntegerInRange(body.units, 1, 30, "Units");
    }
    if (body.isRequired !== undefined) {
      patch.isRequired = Boolean(body.isRequired);
    }
    if (body.prerequisiteNote !== undefined) {
      patch.prerequisiteNote = parseOptionalTrimmed(
        body.prerequisiteNote,
        191,
        "Prerequisite note",
      );
    }
    if (body.displayOrder !== undefined) {
      patch.displayOrder = parseIntegerInRange(
        body.displayOrder,
        0,
        500,
        "Display order",
      );
    }

    const course = await this.repository.updateCourse(adminId, courseId, patch);
    return { course };
  }

  async deleteCourse(adminId: string, courseId: string) {
    if (!adminId) {
      throw new AppError("Authenticated Admin identity is required.", 401);
    }
    const existing = await this.repository.findCourseById(courseId);
    if (!existing) {
      throw new AppError("Curriculum subject not found.", 404);
    }
    await this.repository.deleteCourseWithGuard(
      adminId,
      courseId,
      `${existing.courseCode} — ${existing.courseTitle}`,
    );
    return { deleted: true };
  }

  // ── Student & Admin Student Curriculum Checklist Operations ───────────────

  private async resolveChecklistContext(
    context: NonNullable<
      Awaited<
        ReturnType<CurriculumRepository["findStudentChecklistContextByStudentId"]>
      >
    >,
  ) {
    let resolvedVersion = context.curriculumVersion;
    let isFallbackVersion = false;

    if (!resolvedVersion && context.programId) {
      resolvedVersion = await this.repository.findFallbackCurriculumVersionForProgram(
        context.programId,
        context.curriculumType,
      );
      isFallbackVersion = Boolean(resolvedVersion);
    }

    const availableVersions = context.programId
      ? await this.repository.listVersionsByProgram(context.programId)
      : [];

    return {
      context,
      resolvedVersion,
      isFallbackVersion,
      availableVersions,
    };
  }

  private buildChecklistDto(params: {
    context: NonNullable<
      Awaited<
        ReturnType<CurriculumRepository["findStudentChecklistContextByStudentId"]>
      >
    >;
    resolvedVersion: Awaited<
      ReturnType<CurriculumRepository["findFallbackCurriculumVersionForProgram"]>
    >;
    isFallbackVersion: boolean;
    availableVersions: Awaited<
      ReturnType<CurriculumRepository["listVersionsByProgram"]>
    >;
  }) {
    const { context, resolvedVersion, isFallbackVersion, availableVersions } =
      params;
    const programType = normalizeProgramType(context.program?.programType);
    const gradingScale = getGradingScaleForProgram(programType);

    const progressMap = new Map<
      string,
      (typeof context.courseProgress)[number]
    >();
    const rulesProgressMap = new Map<string, StudentCourseProgressLike>();

    for (const row of context.courseProgress) {
      progressMap.set(row.curriculumCourseId, row);
      rulesProgressMap.set(row.curriculumCourseId, {
        curriculumCourseId: row.curriculumCourseId,
        status: row.status,
        rating: row.rating,
        isVerifiedByAdmin: row.isVerifiedByAdmin,
      });
    }

    const versionLike: CurriculumVersionLike | null = resolvedVersion
      ? {
          id: resolvedVersion.id,
          versionCode: resolvedVersion.versionCode,
          label: resolvedVersion.label,
          curriculumType: resolvedVersion.curriculumType,
          effectiveSchoolYear: resolvedVersion.effectiveSchoolYear,
          totalRequiredUnits: resolvedVersion.totalRequiredUnits,
          groups: resolvedVersion.groups.map(
            (g): CurriculumGroupLike => ({
              id: g.id,
              groupType: g.groupType,
              label: g.label,
              requiredUnits: g.requiredUnits,
              countsTowardWce: g.countsTowardWce,
              selectionNote: g.selectionNote,
              displayOrder: g.displayOrder,
              courses: g.courses.map((c) => ({
                id: c.id,
                courseCode: c.courseCode,
                courseTitle: c.courseTitle,
                units: c.units,
                isRequired: c.isRequired,
                prerequisiteNote: c.prerequisiteNote,
                displayOrder: c.displayOrder,
              })),
            }),
          ),
        }
      : null;

    const summary = versionLike
      ? evaluateCurriculumProgress({
          programType,
          version: versionLike,
          progressByCourseId: rulesProgressMap,
        })
      : null;

    const groupEvalById = new Map(
      (summary?.groups ?? []).map((g) => [g.groupId, g]),
    );

    const groups = resolvedVersion
      ? resolvedVersion.groups.map((g) => {
          const evalRow = groupEvalById.get(g.id);
          return {
            id: g.id,
            groupType: g.groupType,
            label: g.label,
            requiredUnits: g.requiredUnits,
            countsTowardWce: g.countsTowardWce,
            selectionNote: g.selectionNote,
            displayOrder: g.displayOrder,
            earnedUnitsRaw: evalRow?.earnedUnitsRaw ?? 0,
            earnedUnitsEffective: evalRow?.earnedUnitsEffective ?? 0,
            verifiedUnitsEffective: evalRow?.verifiedUnitsEffective ?? 0,
            inProgressUnits: evalRow?.inProgressUnits ?? 0,
            remainingUnits: evalRow?.remainingUnits ?? g.requiredUnits,
            isComplete: evalRow?.isComplete ?? false,
            courses: g.courses.map((c) => {
              const p = progressMap.get(c.id);
              return {
                id: c.id,
                courseCode: c.courseCode,
                courseTitle: c.courseTitle,
                units: c.units,
                isRequired: c.isRequired,
                prerequisiteNote: c.prerequisiteNote,
                displayOrder: c.displayOrder,
                progress: p
                  ? {
                      status: p.status,
                      rating: p.rating,
                      semester: p.semester,
                      schoolYear: p.schoolYear,
                      remarks: p.remarks,
                      encodedByRole: p.encodedByRole,
                      encodedByName: formatPersonName(p.encodedBy),
                      isVerifiedByAdmin: false,
                      verifiedByName: null,
                      verifiedAt: null,
                      updatedAt: p.updatedAt.toISOString(),
                    }
                  : {
                      status: "NOT_TAKEN" as const,
                      rating: null,
                      semester: null,
                      schoolYear: null,
                      remarks: null,
                      encodedByRole: null,
                      encodedByName: null,
                      isVerifiedByAdmin: false,
                      verifiedByName: null,
                      verifiedAt: null,
                      updatedAt: null,
                    },
              };
            }),
          };
        })
      : [];

    return {
      student: {
        id: context.id,
        studentNumber: context.studentNumber ?? null,
        fullName: formatPersonName(context.user) ?? "",
        admissionStatus: context.admissionStatus,
        programId: context.programId,
        programName: context.program?.programName ?? "",
        degreeName: context.program?.degreeName ?? null,
        majorName: context.program?.majorName ?? null,
        programCode: context.program?.programCode ?? null,
        programType,
        curriculumType: context.curriculumType ?? null,
      },
      curriculumVersion: resolvedVersion
        ? {
            id: resolvedVersion.id,
            versionCode: resolvedVersion.versionCode,
            label: resolvedVersion.label,
            curriculumType: resolvedVersion.curriculumType,
            effectiveSchoolYear: resolvedVersion.effectiveSchoolYear,
            totalRequiredUnits: resolvedVersion.totalRequiredUnits,
            isDefaultForNewStudents: resolvedVersion.isDefaultForNewStudents,
            isActive: resolvedVersion.isActive,
            notes: resolvedVersion.notes,
            isFallbackAssignment: isFallbackVersion,
          }
        : null,
      availableVersions,
      gradingScale,
      summary,
      groups,
    };
  }

  async getStudentChecklistByUserId(userId: string) {
    const context = await this.repository.findStudentChecklistContextByUserId(userId);
    if (!context) {
      throw new AppError("Student profile not found.", 404);
    }
    if (context.admissionStatus === "APPLICANT") {
      throw new AppError(
        "Curriculum checklist is available after enrollment promotion.",
        409,
      );
    }
    const resolved = await this.resolveChecklistContext(context);
    return this.buildChecklistDto(resolved);
  }

  async getStudentChecklistByStudentId(studentId: string) {
    const context =
      await this.repository.findStudentChecklistContextByStudentId(studentId);
    if (!context) {
      throw new AppError("Student not found.", 404);
    }
    if (context.admissionStatus === "APPLICANT") {
      throw new AppError(
        "Curriculum checklist is available for enrolled, graduated, or dismissed students only.",
        409,
      );
    }
    const resolved = await this.resolveChecklistContext(context);
    return this.buildChecklistDto(resolved);
  }

  async updateCourseProgress(params: {
    actorRole: "STUDENT" | "ADMIN";
    actorUserId: string;
    targetId: string; // userId when STUDENT, studentId when ADMIN
    courseId: string;
    body: Record<string, unknown>;
  }) {
    const context =
      params.actorRole === "STUDENT"
        ? await this.repository.findStudentChecklistContextByUserId(
            params.targetId,
          )
        : await this.repository.findStudentChecklistContextByStudentId(
            params.targetId,
          );

    if (!context) {
      throw new AppError("Student not found.", 404);
    }
    if (context.admissionStatus === "APPLICANT") {
      throw new AppError(
        "Curriculum coursework updates are only available for Student accounts.",
        409,
      );
    }

    const resolved = await this.resolveChecklistContext(context);
    if (!resolved.resolvedVersion) {
      throw new AppError(
        "No curriculum version is assigned to this student's program.",
        409,
      );
    }

    const targetCourse = resolved.resolvedVersion.groups
      .flatMap((g) => g.courses)
      .find((c) => c.id === params.courseId);

    if (!targetCourse) {
      throw new AppError(
        "The selected subject does not belong to the student's active curriculum version.",
        404,
      );
    }

    const normalized = validateAndNormalizeCourseProgressInput(
      context.program?.programType,
      {
        status: params.body.status,
        rating: params.body.rating,
        semester: params.body.semester,
        schoolYear: params.body.schoolYear,
        remarks: params.body.remarks,
      },
    );

    await this.repository.upsertStudentCourseProgress({
      studentId: context.id,
      courseId: targetCourse.id,
      courseCode: targetCourse.courseCode,
      actorUserId: params.actorUserId,
      actorRole: params.actorRole,
      status: normalized.status,
      rating: normalized.rating,
      semester: normalized.semester,
      schoolYear: normalized.schoolYear,
      remarks: normalized.remarks,
      fallbackVersionToBind: resolved.isFallbackVersion
        ? {
            id: resolved.resolvedVersion.id,
            curriculumType: resolved.resolvedVersion.curriculumType,
          }
        : null,
    });

    return params.actorRole === "STUDENT"
      ? this.getStudentChecklistByUserId(params.targetId)
      : this.getStudentChecklistByStudentId(params.targetId);
  }

  async assignStudentCurriculumVersion(
    studentId: string,
    adminId: string,
    body: Record<string, unknown>,
  ) {
    if (!adminId) {
      throw new AppError("Authenticated Admin identity is required.", 401);
    }
    const curriculumVersionId = parseRequiredTrimmed(
      body.curriculumVersionId,
      1,
      191,
      "Curriculum version ID",
    );
    const reason = parseRequiredTrimmed(
      body.reason,
      3,
      500,
      "Reason for curriculum version update",
    );

    const context =
      await this.repository.findStudentChecklistContextByStudentId(studentId);
    if (!context) {
      throw new AppError("Student not found.", 404);
    }
    if (context.admissionStatus === "APPLICANT") {
      throw new AppError(
        "Curriculum version assignment is only available for Student records.",
        409,
      );
    }

    const targetVersion =
      await this.repository.getVersionById(curriculumVersionId);
    if (!targetVersion) {
      throw new AppError("Selected curriculum version was not found.", 404);
    }
    if (targetVersion.programId !== context.programId) {
      throw new AppError(
        "Selected curriculum version belongs to a different graduate program.",
        400,
      );
    }

    await this.repository.assignStudentCurriculumVersion({
      studentId: context.id,
      adminId,
      oldVersionId: context.curriculumVersionId ?? null,
      oldCurriculumType: context.curriculumType ?? null,
      newVersion: {
        id: targetVersion.id,
        versionCode: targetVersion.versionCode,
        label: targetVersion.label,
        curriculumType: targetVersion.curriculumType,
      },
      reason,
    });

    return this.getStudentChecklistByStudentId(studentId);
  }
}
