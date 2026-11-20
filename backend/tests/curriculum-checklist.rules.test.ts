import { describe, expect, it } from "vitest";
import { AUTHORITATIVE_GRADUATE_PROGRAMS } from "../src/config/graduate-programs";
import { AUTHORITATIVE_CURRICULA } from "../src/config/earist-curriculum-catalog";
import {
  evaluateCurriculumProgress,
  getGradingScaleForProgram,
  validateAndNormalizeCourseProgressInput,
  type CurriculumVersionLike,
  type StudentCourseProgressLike,
} from "../src/services/curriculum-checklist.rules";

function buildSampleVersion(): CurriculumVersionLike {
  return {
    id: "ver-mat-math-new",
    versionCode: "NEW-2024",
    label: "New Curriculum (S.Y. 2024-2025)",
    curriculumType: "NEW",
    effectiveSchoolYear: "2024-2025",
    totalRequiredUnits: 30,
    groups: [
      {
        id: "grp-foundation",
        groupType: "FOUNDATION",
        label: "Foundation Courses",
        requiredUnits: 6,
        countsTowardWce: true,
        displayOrder: 1,
        courses: [
          {
            id: "c-mf601",
            courseCode: "MF601",
            courseTitle: "Methodology of Research",
            units: 3,
            isRequired: true,
            displayOrder: 1,
          },
          {
            id: "c-mf602",
            courseCode: "MF602",
            courseTitle: "Basic and Inferential Statistics",
            units: 3,
            isRequired: true,
            displayOrder: 2,
          },
        ],
      },
      {
        id: "grp-cognate",
        groupType: "COGNATE",
        label: "Cognate Courses",
        requiredUnits: 3,
        countsTowardWce: true,
        selectionNote: "Choose only 1 course (3 units)",
        displayOrder: 2,
        courses: [
          {
            id: "c-cog1",
            courseCode: "MATSC608A",
            courseTitle: "Cognate Option A",
            units: 3,
            isRequired: false,
            displayOrder: 1,
          },
          {
            id: "c-cog2",
            courseCode: "MATSC608B",
            courseTitle: "Cognate Option B",
            units: 3,
            isRequired: false,
            displayOrder: 2,
          },
        ],
      },
      {
        id: "grp-thesis",
        groupType: "THESIS",
        label: "Thesis",
        requiredUnits: 6,
        countsTowardWce: false,
        displayOrder: 3,
        courses: [
          {
            id: "c-t1",
            courseCode: "MT609",
            courseTitle: "Thesis 1",
            units: 3,
            isRequired: true,
            displayOrder: 1,
          },
          {
            id: "c-t2",
            courseCode: "MT610",
            courseTitle: "Thesis 2",
            units: 3,
            isRequired: true,
            displayOrder: 2,
          },
        ],
      },
    ],
  };
}

describe("EARIST Curriculum Checklist pure domain rules (Manual §7.9, §7.16, §7.24–25)", () => {
  describe("Program-aware grading scale & input validation", () => {
    it("allows 2.00 as passing for MASTERS and sets retention GWA threshold to 2.00", () => {
      const scale = getGradingScaleForProgram("MASTERS");
      expect(scale.retentionGwaThreshold).toBe(2.0);
      expect(scale.options.some((o) => o.value === "2.00" && o.outcome === "PASSED")).toBe(
        true,
      );

      const normalized = validateAndNormalizeCourseProgressInput("MASTERS", {
        rating: "2",
        semester: "1st",
        schoolYear: "2025-2026",
      });
      expect(normalized).toEqual({
        status: "PASSED",
        rating: "2.00",
        semester: "1st Sem",
        schoolYear: "2025-2026",
        remarks: null,
      });
    });

    it("rejects rating 2.00 for DOCTORAL and enforces 1.75 cutoff", () => {
      const scale = getGradingScaleForProgram("DOCTORAL");
      expect(scale.retentionGwaThreshold).toBe(1.75);
      expect(scale.options.some((o) => o.value === "2.00")).toBe(false);

      expect(() =>
        validateAndNormalizeCourseProgressInput("DOCTORAL", {
          status: "PASSED",
          rating: "2.00",
        }),
      ).toThrow(/not valid for Doctoral programs/i);

      const validDoctoral = validateAndNormalizeCourseProgressInput("DOCTORAL", {
        rating: "1.75",
        semester: "2nd sem",
      });
      expect(validDoctoral.status).toBe("PASSED");
      expect(validDoctoral.rating).toBe("1.75");
      expect(validDoctoral.semester).toBe("2nd Sem");
    });

    it("auto-derives FAILED / INCOMPLETE / DROPPED from rating and rejects contradictions", () => {
      expect(
        validateAndNormalizeCourseProgressInput("MASTERS", { rating: "5.00" }).status,
      ).toBe("FAILED");
      expect(
        validateAndNormalizeCourseProgressInput("MASTERS", { rating: "inc" }).status,
      ).toBe("INCOMPLETE");
      expect(
        validateAndNormalizeCourseProgressInput("MASTERS", { rating: "DRP" }).status,
      ).toBe("DROPPED");

      expect(() =>
        validateAndNormalizeCourseProgressInput("MASTERS", {
          status: "PASSED",
          rating: "5.00",
        }),
      ).toThrow(/does not match status/i);

      expect(() =>
        validateAndNormalizeCourseProgressInput("MASTERS", {
          status: "CREDITED",
          rating: "INC",
        }),
      ).toThrow(/credited course cannot carry/i);

      const credited = validateAndNormalizeCourseProgressInput("MASTERS", {
        status: "CREDITED",
        rating: "1.25",
      });
      expect(credited.status).toBe("CREDITED");
      expect(credited.rating).toBe("1.25");
    });

    it("clears rating when status is set to NOT_TAKEN or IN_PROGRESS", () => {
      const inProgress = validateAndNormalizeCourseProgressInput("MASTERS", {
        status: "IN_PROGRESS",
        rating: "1.25",
        semester: "Summer",
        schoolYear: "2025-2026",
      });
      expect(inProgress.status).toBe("IN_PROGRESS");
      expect(inProgress.rating).toBeNull();
      expect(inProgress.semester).toBe("Summer");
    });
  });

  describe("Progress evaluation, Choose-N capping, WCE separation, and unofficial GWA", () => {
    it("caps earned units per group at requiredUnits and separates WCE academic coursework from Thesis", () => {
      const version = buildSampleVersion();
      const progress = new Map<string, StudentCourseProgressLike>([
        [
          "c-mf601",
          {
            curriculumCourseId: "c-mf601",
            status: "PASSED",
            rating: "1.25",
            isVerifiedByAdmin: true,
          },
        ],
        [
          "c-mf602",
          {
            curriculumCourseId: "c-mf602",
            status: "PASSED",
            rating: "1.50",
            isVerifiedByAdmin: false,
          },
        ],
        // Student completed BOTH elective cognate options (6 raw units), but group only requires 3!
        [
          "c-cog1",
          {
            curriculumCourseId: "c-cog1",
            status: "PASSED",
            rating: "1.25",
            isVerifiedByAdmin: true,
          },
        ],
        [
          "c-cog2",
          {
            curriculumCourseId: "c-cog2",
            status: "CREDITED",
            rating: "1.00",
            isVerifiedByAdmin: false,
          },
        ],
        [
          "c-t1",
          {
            curriculumCourseId: "c-t1",
            status: "IN_PROGRESS",
            rating: null,
            isVerifiedByAdmin: false,
          },
        ],
      ]);

      const evalResult = evaluateCurriculumProgress({
        programType: "MASTERS",
        version,
        progressByCourseId: progress,
      });

      const cognateGroup = evalResult.groups.find((g) => g.groupId === "grp-cognate")!;
      expect(cognateGroup.earnedUnitsRaw).toBe(6);
      expect(cognateGroup.earnedUnitsEffective).toBe(3);
      expect(cognateGroup.verifiedUnitsEffective).toBe(3);
      expect(cognateGroup.isComplete).toBe(true);

      // WCE academic units = Foundation (6) + Cognate (3) = 9
      expect(evalResult.wceRequiredUnits).toBe(9);
      expect(evalResult.wceEarnedUnits).toBe(9);
      expect(evalResult.wceVerifiedUnits).toBe(6);
      expect(evalResult.wceReadinessStatus).toBe("READY");

      // Total degree = Foundation (6) + Cognate (3) + Thesis (6) = 15
      expect(evalResult.totalRequiredUnits).toBe(15);
      expect(evalResult.totalEarnedUnits).toBe(9);
      expect(evalResult.totalInProgressUnits).toBe(3);
      expect(evalResult.totalRemainingUnits).toBe(6);
      expect(evalResult.completionPercent).toBe(60);

      // Unofficial GWA: (1.25*3 + 1.50*3 + 1.25*3 + 1.00*3) / 12 = 1.25
      expect(evalResult.unofficialGwa).toBe(1.25);
      expect(evalResult.meetsRetentionGwa).toBe(true);
    });

    it("flags retention warning when doctoral unofficial GWA exceeds 1.75 and counts INCs", () => {
      const version = buildSampleVersion();
      const progress = new Map<string, StudentCourseProgressLike>([
        [
          "c-mf601",
          {
            curriculumCourseId: "c-mf601",
            status: "FAILED",
            rating: "5.00",
            isVerifiedByAdmin: false,
          },
        ],
        [
          "c-mf602",
          {
            curriculumCourseId: "c-mf602",
            status: "INCOMPLETE",
            rating: "INC",
            isVerifiedByAdmin: false,
          },
        ],
      ]);

      const evalResult = evaluateCurriculumProgress({
        programType: "DOCTORAL",
        version,
        progressByCourseId: progress,
      });

      expect(evalResult.incCount).toBe(1);
      expect(evalResult.unofficialGwa).toBe(5.0);
      expect(evalResult.meetsRetentionGwa).toBe(false);
    });
  });

  describe("Official EARIST Curriculum Catalog integrity (16 NEW + 14 OLD = 30)", () => {
    it("contains 16 default NEW curricula covering every authoritative program and 14 OLD curricula with clean labels", () => {
      const newCurricula = AUTHORITATIVE_CURRICULA.filter(
        (c) => c.curriculumType === "NEW",
      );
      const oldCurricula = AUTHORITATIVE_CURRICULA.filter(
        (c) => c.curriculumType === "OLD",
      );
      expect(newCurricula).toHaveLength(16);
      expect(oldCurricula).toHaveLength(14);
      expect(AUTHORITATIVE_CURRICULA).toHaveLength(30);

      for (const prog of AUTHORITATIVE_GRADUATE_PROGRAMS) {
        const matchNew = newCurricula.find(
          (c) =>
            c.programCode === prog.programCode &&
            (c.majorName ?? null) === (prog.majorName ?? null),
        );
        expect(
          matchNew,
          `Missing NEW curriculum for ${prog.programName}`,
        ).toBeDefined();
        expect(matchNew?.isDefaultForNewStudents).toBe(true);
        expect(matchNew?.label).toBe("New Curriculum (S.Y. 2024–2025)");
      }

      for (const oldCur of oldCurricula) {
        expect(oldCur.isDefaultForNewStudents).toBe(false);
        expect(oldCur.label).toBe("Old Curriculum");
        expect(oldCur.effectiveSchoolYear).toBeNull();
      }
    });

    it("has valid unique keys, matching group/total units, and sufficient courses per group", () => {
      const seenVersions = new Set<string>();

      for (const cur of AUTHORITATIVE_CURRICULA) {
        const versionKey = `${cur.programCode}::${cur.majorName ?? ""}::${cur.versionCode}`;
        expect(seenVersions.has(versionKey), `Duplicate version ${versionKey}`).toBe(
          false,
        );
        seenVersions.add(versionKey);

        const groupSum = cur.groups.reduce((acc, g) => acc + g.requiredUnits, 0);
        expect(
          groupSum,
          `${versionKey} totalRequiredUnits (${cur.totalRequiredUnits}) != group sum (${groupSum})`,
        ).toBe(cur.totalRequiredUnits);

        for (const grp of cur.groups) {
          const seenCodes = new Set<string>();
          let availableUnits = 0;
          for (const course of grp.courses) {
            const codeKey = course.courseCode.trim().toUpperCase();
            expect(
              seenCodes.has(codeKey),
              `Duplicate course code ${codeKey} in ${versionKey} / ${grp.label}`,
            ).toBe(false);
            seenCodes.add(codeKey);
            expect(course.units).toBeGreaterThan(0);
            availableUnits += course.units;
          }
          expect(
            availableUnits,
            `${versionKey} / ${grp.label} has fewer available units (${availableUnits}) than requiredUnits (${grp.requiredUnits})`,
          ).toBeGreaterThanOrEqual(grp.requiredUnits);
        }
      }
    });
  });
});
