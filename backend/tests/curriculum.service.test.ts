import { describe, expect, it, vi } from "vitest";
import { CurriculumService } from "../src/services/curriculum.service";
import type { CurriculumRepository } from "../src/repositories/curriculum.repository";
import { AppError } from "../src/utils/AppError";

function makeContext(overrides: Record<string, unknown> = {}) {
  return {
    id: "stu-1",
    userId: "user-stu-1",
    studentNumber: "2026-0001",
    admissionStatus: "ENROLLED",
    programId: "prog-mat-math",
    curriculumType: "NEW",
    curriculumVersionId: "ver-1",
    user: {
      id: "user-stu-1",
      firstName: "Ana",
      lastName: "Santos",
      suffix: null,
      email: "ana@earist.edu.ph",
    },
    program: {
      id: "prog-mat-math",
      programName: "Master of Arts in Teaching major in Mathematics (MAT)",
      degreeName: "Master of Arts in Teaching",
      majorName: "Mathematics",
      programCode: "MAT",
      programType: "MASTERS",
    },
    curriculumVersion: {
      id: "ver-1",
      programId: "prog-mat-math",
      versionCode: "NEW-2024",
      label: "New Curriculum (S.Y. 2024-2025)",
      curriculumType: "NEW",
      effectiveSchoolYear: "2024-2025",
      totalRequiredUnits: 9,
      isDefaultForNewStudents: true,
      isActive: true,
      notes: null,
      groups: [
        {
          id: "grp-1",
          curriculumVersionId: "ver-1",
          groupType: "FOUNDATION",
          label: "Foundation Courses",
          requiredUnits: 6,
          countsTowardWce: true,
          selectionNote: null,
          displayOrder: 1,
          courses: [
            {
              id: "course-1",
              groupId: "grp-1",
              courseCode: "MF601",
              courseTitle: "Methodology of Research",
              units: 3,
              isRequired: true,
              prerequisiteNote: null,
              displayOrder: 1,
            },
            {
              id: "course-2",
              groupId: "grp-1",
              courseCode: "MF602",
              courseTitle: "Basic and Inferential Statistics",
              units: 3,
              isRequired: true,
              prerequisiteNote: null,
              displayOrder: 2,
            },
          ],
        },
        {
          id: "grp-2",
          curriculumVersionId: "ver-1",
          groupType: "THESIS",
          label: "Thesis",
          requiredUnits: 3,
          countsTowardWce: false,
          selectionNote: null,
          displayOrder: 2,
          courses: [
            {
              id: "course-3",
              groupId: "grp-2",
              courseCode: "MT609",
              courseTitle: "Thesis 1",
              units: 3,
              isRequired: true,
              prerequisiteNote: null,
              displayOrder: 1,
            },
          ],
        },
      ],
    },
    courseProgress: [],
    ...overrides,
  };
}

function makeMockRepo(overrides: Partial<Record<keyof CurriculumRepository, unknown>> = {}) {
  const defaultCtx = makeContext();
  return {
    listVersions: vi.fn().mockResolvedValue([]),
    getVersionById: vi.fn().mockResolvedValue({
      id: "ver-old",
      programId: "prog-mat-math",
      versionCode: "OLD-PRE2024",
      label: "Old Curriculum",
      curriculumType: "OLD",
      groups: [],
    }),
    listVersionsByProgram: vi.fn().mockResolvedValue([
      {
        id: "ver-1",
        programId: "prog-mat-math",
        versionCode: "NEW-2024",
        label: "New Curriculum (S.Y. 2024–2025)",
        curriculumType: "NEW",
        effectiveSchoolYear: "2024-2025",
        totalRequiredUnits: 9,
        isDefaultForNewStudents: true,
        isActive: true,
      },
    ]),
    findProgramById: vi.fn().mockResolvedValue({
      id: "prog-mat-math",
      programName: "MAT Math",
      programType: "MASTERS",
      isActive: true,
    }),
    findGroupById: vi.fn().mockResolvedValue({
      id: "grp-1",
      curriculumVersionId: "ver-1",
      label: "Foundation Courses",
    }),
    findCourseById: vi.fn().mockResolvedValue({
      id: "course-1",
      courseCode: "MF601",
      courseTitle: "Methodology of Research",
      group: { id: "grp-1", curriculumVersionId: "ver-1", label: "Foundation Courses" },
    }),
    createVersion: vi.fn().mockResolvedValue({ id: "ver-new" }),
    updateVersion: vi.fn().mockResolvedValue({ id: "ver-1" }),
    createGroup: vi.fn().mockResolvedValue({ id: "grp-new" }),
    updateGroup: vi.fn().mockResolvedValue({ id: "grp-1" }),
    deleteGroupWithGuard: vi.fn().mockResolvedValue(undefined),
    createCourse: vi.fn().mockResolvedValue({ id: "course-new" }),
    updateCourse: vi.fn().mockResolvedValue({ id: "course-1" }),
    deleteCourseWithGuard: vi.fn().mockResolvedValue(undefined),
    findStudentChecklistContextByUserId: vi.fn().mockResolvedValue(defaultCtx),
    findStudentChecklistContextByStudentId: vi.fn().mockResolvedValue(defaultCtx),
    findFallbackCurriculumVersionForProgram: vi.fn().mockResolvedValue(null),
    upsertStudentCourseProgress: vi.fn().mockResolvedValue({ id: "prog-1" }),
    assignStudentCurriculumVersion: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as CurriculumRepository;
}

describe("CurriculumService", () => {
  describe("Student self-tracking & verified lock", () => {
    it("allows student to self-encode course progress with Master's 2.00 passing grade", async () => {
      const repo = makeMockRepo();
      const service = new CurriculumService(repo);

      await service.updateCourseProgress({
        actorRole: "STUDENT",
        actorUserId: "user-stu-1",
        targetId: "user-stu-1",
        courseId: "course-1",
        body: {
          status: "PASSED",
          rating: "2.00",
          semester: "1st Sem",
          schoolYear: "2025-2026",
        },
      });

      expect(repo.upsertStudentCourseProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          studentId: "stu-1",
          courseId: "course-1",
          actorRole: "STUDENT",
          status: "PASSED",
          rating: "2.00",
          semester: "1st Sem",
          schoolYear: "2025-2026",
        }),
      );
    });

    it("rejects Doctoral 2.00 rating with HTTP 400", async () => {
      const doctoralCtx = makeContext({
        program: {
          id: "prog-dba",
          programName: "Doctor of Business Administration (DBA)",
          degreeName: "Doctor of Business Administration",
          majorName: null,
          programCode: "DBA",
          programType: "DOCTORAL",
        },
      });
      const repo = makeMockRepo({
        findStudentChecklistContextByUserId: vi.fn().mockResolvedValue(doctoralCtx),
      });
      const service = new CurriculumService(repo);

      await expect(
        service.updateCourseProgress({
          actorRole: "STUDENT",
          actorUserId: "user-stu-1",
          targetId: "user-stu-1",
          courseId: "course-1",
          body: { status: "PASSED", rating: "2.00" },
        }),
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it("binds fallback default curriculum version automatically when student has null curriculumVersionId", async () => {
      const baseCtx = makeContext({ curriculumVersionId: null, curriculumVersion: null });
      const fallbackVersion = makeContext().curriculumVersion;
      const repo = makeMockRepo({
        findStudentChecklistContextByUserId: vi.fn().mockResolvedValue(baseCtx),
        findFallbackCurriculumVersionForProgram: vi
          .fn()
          .mockResolvedValue(fallbackVersion),
      });
      const service = new CurriculumService(repo);

      await service.updateCourseProgress({
        actorRole: "STUDENT",
        actorUserId: "user-stu-1",
        targetId: "user-stu-1",
        courseId: "course-1",
        body: { status: "IN_PROGRESS" },
      });

      expect(repo.upsertStudentCourseProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          fallbackVersionToBind: {
            id: "ver-1",
            curriculumType: "NEW",
          },
        }),
      );
    });
  });

  describe("Admin coursework editing, version shift & master CRUD guards", () => {
    it("allows Admin to encode student coursework and auto-generates versionCode when omitted on createVersion", async () => {
      const repo = makeMockRepo();
      const service = new CurriculumService(repo);

      await service.updateCourseProgress({
        actorRole: "ADMIN",
        actorUserId: "admin-1",
        targetId: "stu-1",
        courseId: "course-1",
        body: { status: "PASSED", rating: "1.25" },
      });
      expect(repo.upsertStudentCourseProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          actorRole: "ADMIN",
          status: "PASSED",
          rating: "1.25",
        }),
      );

      await service.createVersion("admin-1", {
        programId: "prog-mat-math",
        label: "New Curriculum (S.Y. 2026–2027)",
        curriculumType: "NEW",
        effectiveSchoolYear: "2026-2027",
      });
      expect(repo.createVersion).toHaveBeenCalledWith(
        "admin-1",
        expect.objectContaining({
          programId: "prog-mat-math",
          label: "New Curriculum (S.Y. 2026–2027)",
          versionCode: expect.stringMatching(/^NEW-2026-2027-/),
        }),
      );
    });

    it("requires audit reason and matching program when shifting student curriculum version", async () => {
      const repo = makeMockRepo();
      const service = new CurriculumService(repo);

      await expect(
        service.assignStudentCurriculumVersion("stu-1", "admin-1", {
          curriculumVersionId: "ver-old",
          reason: "ab",
        }),
      ).rejects.toMatchObject({ statusCode: 400 });

      const wrongProgramRepo = makeMockRepo({
        getVersionById: vi.fn().mockResolvedValue({
          id: "ver-other",
          programId: "other-prog",
          versionCode: "NEW-2024",
          label: "Other",
          curriculumType: "NEW",
          groups: [],
        }),
      });
      await expect(
        new CurriculumService(wrongProgramRepo).assignStudentCurriculumVersion(
          "stu-1",
          "admin-1",
          {
            curriculumVersionId: "ver-other",
            reason: "Shifted to old curriculum per GS-023",
          },
        ),
      ).rejects.toMatchObject({ statusCode: 400 });

      await service.assignStudentCurriculumVersion("stu-1", "admin-1", {
        curriculumVersionId: "ver-old",
        reason: "Continuing student enrolled under Pre-2024 checklist",
      });
      expect(repo.assignStudentCurriculumVersion).toHaveBeenCalledWith(
        expect.objectContaining({
          studentId: "stu-1",
          adminId: "admin-1",
          reason: "Continuing student enrolled under Pre-2024 checklist",
        }),
      );
    });

    it("propagates 409 Conflict when deleting group or course that has student progress", async () => {
      const repo = makeMockRepo({
        deleteCourseWithGuard: vi
          .fn()
          .mockRejectedValue(new AppError("Subject has student progress", 409)),
        deleteGroupWithGuard: vi
          .fn()
          .mockRejectedValue(new AppError("Group has student progress", 409)),
      });
      const service = new CurriculumService(repo);

      await expect(service.deleteCourse("admin-1", "course-1")).rejects.toMatchObject({
        statusCode: 409,
      });
      await expect(service.deleteGroup("admin-1", "grp-1")).rejects.toMatchObject({
        statusCode: 409,
      });
    });
  });
});
