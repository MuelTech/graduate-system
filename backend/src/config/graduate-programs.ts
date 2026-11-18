import type { PrismaClient, ProgramType } from "@prisma/client";

export interface CanonicalGraduateProgramSeed {
  readonly programName: string;
  readonly degreeName: string;
  readonly majorName: string | null;
  readonly programCode: string;
  readonly programType: ProgramType;
  readonly maxResidencyYears: number;
  readonly legacyProgramNames: readonly string[];
}

/**
 * Default Maximum Residence Rule (MRR) durations per EARIST Graduate School
 * Manual of Operations §7.11:
 *   - Master's programs: 4 years
 *   - Doctoral programs: 6 years
 */
export function defaultMaxResidencyYears(programType: ProgramType | "MASTERS" | "DOCTORAL"): number {
  return programType === "DOCTORAL" ? 6 : 4;
}

/**
 * Formats the authoritative display label stored in `Program.programName`.
 */
export function formatCanonicalProgramName(input: {
  degreeName: string;
  majorName?: string | null;
  programCode?: string | null;
}): string {
  const degree = input.degreeName.trim();
  const major = input.majorName?.trim() || "";
  const code = input.programCode?.trim() || "";
  const base = major ? `${degree} major in ${major}` : degree;
  return code ? `${base} (${code})` : base;
}

/**
 * Formats Course/Major for official forms (GS-006/007, GS-011, GS-017, GS-020).
 * Prefers structured `degreeName` + `majorName` and falls back to `programName`
 * for legacy or fixture records without structured metadata.
 */
export function formatOfficialProgramDisplay(program: {
  programName: string;
  degreeName?: string | null;
  majorName?: string | null;
  programCode?: string | null;
}): string {
  const degree = program.degreeName?.trim();
  if (degree) {
    const major = program.majorName?.trim();
    return major ? `${degree} major in ${major}` : degree;
  }
  return program.programName.trim();
}

/**
 * Authoritative 16 Graduate School Programs per EARIST Graduate School Manual
 * of Operations (§5.0 Curricular Programs & §7.11 Maximum Residence Rule).
 */
export const AUTHORITATIVE_GRADUATE_PROGRAMS: readonly CanonicalGraduateProgramSeed[] = [
  // Doctoral Programs (Professional Track, PQF Level 8, 6-year Max Residency)
  {
    programName: "Doctor of Education major in Educational Management (Ed.D.-EM)",
    degreeName: "Doctor of Education",
    majorName: "Educational Management",
    programCode: "Ed.D.-EM",
    programType: "DOCTORAL",
    maxResidencyYears: 6,
    legacyProgramNames: [
      "Doctor of Education Major in Educational Management",
      "Doctor of Education major in Educational Management",
    ],
  },
  {
    programName: "Doctor of Philosophy in Industrial Psychology (PhD-IP)",
    degreeName: "Doctor of Philosophy in Industrial Psychology",
    majorName: null,
    programCode: "PhD-IP",
    programType: "DOCTORAL",
    maxResidencyYears: 6,
    legacyProgramNames: [
      "Doctor of Philosophy in Industrial Psychology",
    ],
  },
  {
    programName: "Doctor of Public Administration (DPA)",
    degreeName: "Doctor of Public Administration",
    majorName: null,
    programCode: "DPA",
    programType: "DOCTORAL",
    maxResidencyYears: 6,
    legacyProgramNames: [
      "Doctor in Public Administration",
      "Doctor of Public Administration",
    ],
  },
  {
    programName: "Doctor of Business Administration (DBA)",
    degreeName: "Doctor of Business Administration",
    majorName: null,
    programCode: "DBA",
    programType: "DOCTORAL",
    maxResidencyYears: 6,
    legacyProgramNames: [
      "Doctor in Business Administration",
      "Doctor of Business Administration",
    ],
  },

  // Master's Programs (Academic Track, PQF Level 7, 4-year Max Residency)
  {
    programName: "Master of Arts in Education major in Administration and Supervision (MAEd)",
    degreeName: "Master of Arts in Education",
    majorName: "Administration and Supervision",
    programCode: "MAEd",
    programType: "MASTERS",
    maxResidencyYears: 4,
    legacyProgramNames: [
      "Master of Arts in Education Major in: Administration and Supervision",
    ],
  },
  {
    programName: "Master of Arts in Education major in Guidance and Counseling (MAEd)",
    degreeName: "Master of Arts in Education",
    majorName: "Guidance and Counseling",
    programCode: "MAEd",
    programType: "MASTERS",
    maxResidencyYears: 4,
    legacyProgramNames: [
      "Master of Arts in Education Major in: Guidance and Counseling",
    ],
  },
  {
    programName: "Master of Arts in Education major in Special Education (MAEd)",
    degreeName: "Master of Arts in Education",
    majorName: "Special Education",
    programCode: "MAEd",
    programType: "MASTERS",
    maxResidencyYears: 4,
    legacyProgramNames: [
      "Master of Arts in Education Major in: Special Education",
    ],
  },
  {
    programName: "Master of Arts in Industrial Education major in Hotel, Restaurant and Management (MAIE)",
    degreeName: "Master of Arts in Industrial Education",
    majorName: "Hotel, Restaurant and Management",
    programCode: "MAIE",
    programType: "MASTERS",
    maxResidencyYears: 4,
    legacyProgramNames: [
      "Master of Arts in Industrial Education Major in: Hotel and Restaurant Management",
    ],
  },
  {
    programName: "Master in Business Administration (MBA)",
    degreeName: "Master in Business Administration",
    majorName: null,
    programCode: "MBA",
    programType: "MASTERS",
    maxResidencyYears: 4,
    legacyProgramNames: [
      "Master in Business Administration",
    ],
  },
  {
    programName: "Master in Public Administration (MPA)",
    degreeName: "Master in Public Administration",
    majorName: null,
    programCode: "MPA",
    programType: "MASTERS",
    maxResidencyYears: 4,
    legacyProgramNames: [
      "Master in Public Administration",
    ],
  },
  {
    programName: "Master of Arts in Teaching major in Science (MAT)",
    degreeName: "Master of Arts in Teaching",
    majorName: "Science",
    programCode: "MAT",
    programType: "MASTERS",
    maxResidencyYears: 4,
    legacyProgramNames: [
      "Master of Arts in Teaching (MAT) Major in: Science",
    ],
  },
  {
    programName: "Master of Arts in Teaching major in Mathematics (MAT)",
    degreeName: "Master of Arts in Teaching",
    majorName: "Mathematics",
    programCode: "MAT",
    programType: "MASTERS",
    maxResidencyYears: 4,
    legacyProgramNames: [
      "Master of Arts in Teaching (MAT) Major in: Mathematics",
    ],
  },
  {
    programName: "Master of Arts in Teaching major in Electronics Technology (MAT)",
    degreeName: "Master of Arts in Teaching",
    majorName: "Electronics Technology",
    programCode: "MAT",
    programType: "MASTERS",
    maxResidencyYears: 4,
    legacyProgramNames: [
      "Master of Arts in Teaching (MAT) Major in: Electronics Technology",
    ],
  },
  {
    programName: "Master of Arts in Teaching major in Electrical Technology (MAT)",
    degreeName: "Master of Arts in Teaching",
    majorName: "Electrical Technology",
    programCode: "MAT",
    programType: "MASTERS",
    maxResidencyYears: 4,
    legacyProgramNames: [
      "Master of Arts in Teaching (MAT) Major in: Electrical Technology",
    ],
  },
  {
    programName: "Master of Arts in Industrial Psychology (MAIP)",
    degreeName: "Master of Arts in Industrial Psychology",
    majorName: null,
    programCode: "MAIP",
    programType: "MASTERS",
    maxResidencyYears: 4,
    legacyProgramNames: [
      "Master of Arts in Industrial Psychology",
    ],
  },
  {
    programName: "Master of Science in Mathematics (MSM)",
    degreeName: "Master of Science in Mathematics",
    majorName: null,
    programCode: "MSM",
    programType: "MASTERS",
    maxResidencyYears: 4,
    legacyProgramNames: [
      "Master of Science in Mathematics",
    ],
  },
];

/**
 * Reconciles existing Graduate School Program records in place (preserving UUIDs
 * and foreign keys) and seeds any missing authoritative offerings.
 */
export async function reconcileAuthoritativeGraduatePrograms(
  prismaClient: Pick<PrismaClient, "program">,
): Promise<{ updated: number; created: number }> {
  let updated = 0;
  let created = 0;

  for (const item of AUTHORITATIVE_GRADUATE_PROGRAMS) {
    const candidateNames = [item.programName, ...item.legacyProgramNames];
    const existing = await prismaClient.program.findFirst({
      where: {
        programName: { in: candidateNames },
      },
    });

    if (existing) {
      await prismaClient.program.update({
        where: { id: existing.id },
        data: {
          programName: item.programName,
          degreeName: item.degreeName,
          majorName: item.majorName,
          programCode: item.programCode,
          programType: item.programType,
          department: null,
          maxResidencyYears: item.maxResidencyYears,
          isActive: true,
        },
      });
      updated += 1;
    } else {
      await prismaClient.program.create({
        data: {
          programName: item.programName,
          degreeName: item.degreeName,
          majorName: item.majorName,
          programCode: item.programCode,
          programType: item.programType,
          department: null,
          maxResidencyYears: item.maxResidencyYears,
          isActive: true,
        },
      });
      created += 1;
    }
  }

  // Keep UIUX fixture non-public so it never shows up in public registration or active lists.
  await prismaClient.program.updateMany({
    where: { department: "UIUX Fixture" },
    data: { isActive: false },
  });

  return { updated, created };
}
