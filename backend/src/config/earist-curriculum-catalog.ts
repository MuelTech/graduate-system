import type {
  CurriculumGroupType,
  CurriculumType,
  PrismaClient,
} from "@prisma/client";

export interface CurriculumCourseSeed {
  readonly courseCode: string;
  readonly courseTitle: string;
  readonly units: number;
  readonly isRequired: boolean;
  readonly prerequisiteNote?: string | null;
}

export interface CurriculumGroupSeed {
  readonly groupType: CurriculumGroupType;
  readonly label: string;
  readonly requiredUnits: number;
  readonly countsTowardWce: boolean;
  readonly selectionNote?: string | null;
  readonly courses: readonly CurriculumCourseSeed[];
}

export interface AuthoritativeCurriculumSeed {
  readonly programCode: string;
  readonly majorName: string | null;
  readonly versionCode: string;
  readonly label: string;
  readonly curriculumType: CurriculumType;
  readonly effectiveSchoolYear: string;
  readonly totalRequiredUnits: number;
  readonly isDefaultForNewStudents: boolean;
  readonly notes?: string | null;
  readonly groups: readonly CurriculumGroupSeed[];
}

function req(
  courseCode: string,
  courseTitle: string,
  units = 3,
  prerequisiteNote?: string,
): CurriculumCourseSeed {
  return {
    courseCode,
    courseTitle,
    units,
    isRequired: true,
    prerequisiteNote: prerequisiteNote ?? null,
  };
}

function opt(
  courseCode: string,
  courseTitle: string,
  units = 3,
  prerequisiteNote?: string,
): CurriculumCourseSeed {
  return {
    courseCode,
    courseTitle,
    units,
    isRequired: false,
    prerequisiteNote: prerequisiteNote ?? null,
  };
}

/**
 * Authoritative EARIST Graduate School Curriculum Catalog:
 * - 16 NEW Curricula (Effective S.Y. 2024-2025) matching all 16 programs
 * - 14 OLD Curricula (Pre-2024 checklists) for continuing/legacy students
 */
export const AUTHORITATIVE_CURRICULA: readonly AuthoritativeCurriculumSeed[] = [
  // =========================================================================
  // NEW CURRICULA (S.Y. 2024-2025) — DOCTORATE (4 PROGRAMS, 36 UNITS EACH)
  // =========================================================================
  {
    programCode: "Ed.D.-EM",
    majorName: "Educational Management",
    versionCode: "NEW-2024",
    label: "New Curriculum (S.Y. 2024-2025)",
    curriculumType: "NEW",
    effectiveSchoolYear: "2024-2025",
    totalRequiredUnits: 36,
    isDefaultForNewStudents: true,
    groups: [
      {
        groupType: "FOUNDATION",
        label: "Foundation Courses",
        requiredUnits: 6,
        countsTowardWce: true,
        courses: [
          req("DF701", "Advanced Educational Research", 3),
          req("DF702", "Advanced Educational Statistics", 3),
        ],
      },
      {
        groupType: "MAJOR",
        label: "Major Courses",
        requiredUnits: 15,
        countsTowardWce: true,
        courses: [
          req("EDDM703", "Financial Administration of Educational Institutions", 3),
          req("EDDM704", "Advanced School Plant & Property Management", 3),
          req("EDDM705", "Seminar in Strategic Management for School Development", 3),
          req("EDDM706", "Executive Training and Development for Educational Managers", 3),
          req("EDDM707", "Human Resource Management", 3),
        ],
      },
      {
        groupType: "COGNATE",
        label: "Cognate Courses",
        requiredUnits: 3,
        countsTowardWce: true,
        courses: [
          req("EDDC708", "Urban and Regional Planning for Educational Development", 3),
        ],
      },
      {
        groupType: "DISSERTATION",
        label: "Dissertation",
        requiredUnits: 12,
        countsTowardWce: false,
        courses: [
          req("DD709", "Dissertation 1", 3),
          req("DD710", "Dissertation 2", 9),
        ],
      },
    ],
  },
  {
    programCode: "PhD-IP",
    majorName: null,
    versionCode: "NEW-2024",
    label: "New Curriculum (S.Y. 2024-2025)",
    curriculumType: "NEW",
    effectiveSchoolYear: "2024-2025",
    totalRequiredUnits: 36,
    isDefaultForNewStudents: true,
    groups: [
      {
        groupType: "FOUNDATION",
        label: "Foundation Courses",
        requiredUnits: 6,
        countsTowardWce: true,
        courses: [
          req("DF701", "Advanced Methodology of Research", 3),
          req("DF702", "Advanced Statistics", 3),
        ],
      },
      {
        groupType: "MAJOR",
        label: "Major Courses",
        requiredUnits: 15,
        countsTowardWce: true,
        courses: [
          req("PHDIPM703", "Seminar in Planning, Developmental, and Strategic Human Resources", 3),
          req("PHDIPM704", "Seminar in Occupational and Health Safety in Human Workplace", 3),
          req("PHDIPM705", "Seminar on Current Trends and Issues in Human Capital Management", 3),
          req("PHDIPM706", "Seminar in Performance and Compensation Management System", 3),
          req("PHDIPM707", "Seminar in Organizational and Communication Development", 3),
        ],
      },
      {
        groupType: "COGNATE",
        label: "Cognate / Elective Course",
        requiredUnits: 3,
        countsTowardWce: true,
        courses: [
          req("PHDIPC708", "Seminar in Training and Development Program", 3),
        ],
      },
      {
        groupType: "DISSERTATION",
        label: "Dissertation",
        requiredUnits: 12,
        countsTowardWce: false,
        courses: [
          req("DD709", "Dissertation 1", 3),
          req("DD710", "Dissertation 2", 9),
        ],
      },
    ],
  },
  {
    programCode: "DPA",
    majorName: null,
    versionCode: "NEW-2024",
    label: "New Curriculum (S.Y. 2024-2025)",
    curriculumType: "NEW",
    effectiveSchoolYear: "2024-2025",
    totalRequiredUnits: 36,
    isDefaultForNewStudents: true,
    groups: [
      {
        groupType: "FOUNDATION",
        label: "Foundation Courses",
        requiredUnits: 6,
        countsTowardWce: true,
        courses: [
          req("DF701", "Advanced Methodology of Research", 3),
          req("DF702", "Advanced Statistics", 3),
        ],
      },
      {
        groupType: "MAJOR",
        label: "Major Courses",
        requiredUnits: 15,
        countsTowardWce: true,
        courses: [
          req("DPAM703", "Philosophical Foundations of Public Administration", 3),
          req("DPAM704", "Seminar in Public Policy and Processes", 3),
          req("DPAM705", "Legal Environment of Public Administration", 3),
          req("DPAM706", "National Security Administration and Crisis Management", 3),
          req("DPAM707", "Seminar in Organizational Development and Change", 3),
        ],
      },
      {
        groupType: "COGNATE",
        label: "Cognate / Elective Course",
        requiredUnits: 3,
        countsTowardWce: true,
        courses: [
          req("DPAC708", "Women's Empowerment and Development", 3),
        ],
      },
      {
        groupType: "DISSERTATION",
        label: "Dissertation",
        requiredUnits: 12,
        countsTowardWce: false,
        courses: [
          req("DD709", "Dissertation 1", 3),
          req("DD710", "Dissertation 2", 9),
        ],
      },
    ],
  },
  {
    programCode: "DBA",
    majorName: null,
    versionCode: "NEW-2024",
    label: "New Curriculum (S.Y. 2024-2025)",
    curriculumType: "NEW",
    effectiveSchoolYear: "2024-2025",
    totalRequiredUnits: 36,
    isDefaultForNewStudents: true,
    groups: [
      {
        groupType: "FOUNDATION",
        label: "Foundation Courses",
        requiredUnits: 6,
        countsTowardWce: true,
        courses: [
          req("DF701", "Advanced Research Methodology", 3),
          req("DF702", "Advanced Statistics", 3),
        ],
      },
      {
        groupType: "MAJOR",
        label: "Major Courses",
        requiredUnits: 15,
        countsTowardWce: true,
        courses: [
          req("DBAM703", "International Business Economics", 3),
          req("DBAM704", "Business Law and Practices", 3),
          req("DBAM705", "Global Strategy and Innovation Management", 3),
          req("DBAM706", "Project Planning Development and Evaluation", 3),
          req("DBAM707", "Advanced Strategic Management and Corporate Governance", 3),
        ],
      },
      {
        groupType: "COGNATE",
        label: "Cognate Courses",
        requiredUnits: 3,
        countsTowardWce: true,
        courses: [
          req("DBAC708", "Business Risk Management and Evaluation", 3),
        ],
      },
      {
        groupType: "DISSERTATION",
        label: "Dissertation",
        requiredUnits: 12,
        countsTowardWce: false,
        courses: [
          req("DD709", "Dissertation 1", 3),
          req("DD710", "Dissertation 2", 9),
        ],
      },
    ],
  },

  // =========================================================================
  // NEW CURRICULA (S.Y. 2024-2025) — MASTER'S (12 PROGRAMS, 30 UNITS EACH)
  // =========================================================================
  {
    programCode: "MAEd",
    majorName: "Administration and Supervision",
    versionCode: "NEW-2024",
    label: "New Curriculum (S.Y. 2024-2025)",
    curriculumType: "NEW",
    effectiveSchoolYear: "2024-2025",
    totalRequiredUnits: 30,
    isDefaultForNewStudents: true,
    groups: [
      {
        groupType: "FOUNDATION",
        label: "Foundation Courses",
        requiredUnits: 6,
        countsTowardWce: true,
        courses: [
          req("MF601", "Methodology of Research", 3),
          req("MF602", "Basic and Inferential Statistics", 3),
        ],
      },
      {
        groupType: "MAJOR",
        label: "Major Courses",
        requiredUnits: 15,
        countsTowardWce: true,
        courses: [
          req("MAMAS603", "Theories and Practices of Educational Management and School System", 3),
          req("MAMAS604", "School Finance", 3),
          req("MAMAS605", "School Plant and Property Management", 3),
          req("MAMAS606", "School-Based Assessment and Technology System Integration", 3),
          req("MAMAS607", "Educational Planning", 3),
        ],
      },
      {
        groupType: "COGNATE",
        label: "Cognate Courses",
        requiredUnits: 3,
        countsTowardWce: true,
        courses: [
          req("MACAS608", "School Community Relations", 3),
        ],
      },
      {
        groupType: "THESIS",
        label: "Thesis",
        requiredUnits: 6,
        countsTowardWce: false,
        courses: [
          req("MT609", "Thesis 1", 3),
          req("MT610", "Thesis 2", 3),
        ],
      },
    ],
  },
  {
    programCode: "MAEd",
    majorName: "Guidance and Counseling",
    versionCode: "NEW-2024",
    label: "New Curriculum (S.Y. 2024-2025)",
    curriculumType: "NEW",
    effectiveSchoolYear: "2024-2025",
    totalRequiredUnits: 30,
    isDefaultForNewStudents: true,
    notes: "Official summary totals 30 units (6 Foundation, 15 Major, 3 Cognate, 6 Thesis); MGCM609 Guidance Internship Program is included as an optional Major track item.",
    groups: [
      {
        groupType: "FOUNDATION",
        label: "Foundation Courses",
        requiredUnits: 6,
        countsTowardWce: true,
        courses: [
          req("MF601", "Methodology of Research", 3),
          req("MF602", "Basic and Inferential Statistics", 3),
        ],
      },
      {
        groupType: "MAJOR",
        label: "Major Courses",
        requiredUnits: 15,
        countsTowardWce: true,
        selectionNote: "Complete 15 units of Major Courses",
        courses: [
          req("MGCM603", "Philosophical, Psychological, and Sociological Foundations of Guidance", 3),
          req("MGCM604", "Organization and Administration of Guidance Services and Program Development", 3),
          req("MGCM605", "Psychological Testing Assessment", 3),
          req("MGCM606", "Counseling Theories, Tools and Techniques", 3),
          req("MGCM607", "Group Process", 3),
          opt("MGCM609", "Guidance Internship Program", 3),
        ],
      },
      {
        groupType: "COGNATE",
        label: "Cognate Courses",
        requiredUnits: 3,
        countsTowardWce: true,
        courses: [
          req("MGCC608", "Career Development", 3),
        ],
      },
      {
        groupType: "THESIS",
        label: "Thesis",
        requiredUnits: 6,
        countsTowardWce: false,
        courses: [
          req("MT609", "Thesis 1", 3),
          req("MT610", "Thesis 2", 3),
        ],
      },
    ],
  },
  {
    programCode: "MAEd",
    majorName: "Special Education",
    versionCode: "NEW-2024",
    label: "New Curriculum (S.Y. 2024-2025)",
    curriculumType: "NEW",
    effectiveSchoolYear: "2024-2025",
    totalRequiredUnits: 30,
    isDefaultForNewStudents: true,
    notes: "Group totals sum to 30 units (6 Foundation, 15 Major, 3 Cognate, 6 Thesis).",
    groups: [
      {
        groupType: "FOUNDATION",
        label: "Foundation Courses",
        requiredUnits: 6,
        countsTowardWce: true,
        courses: [
          req("MF601", "Methodology of Research", 3),
          req("MF602", "Basic and Inferential Statistics", 3),
        ],
      },
      {
        groupType: "MAJOR",
        label: "Major Courses",
        requiredUnits: 15,
        countsTowardWce: true,
        courses: [
          req("SPEDM603", "Nature, Concepts, and Theories of Exceptionality and Special Needs Education", 3),
          req("SPEDM604", "Psychoeducational Assessment of Learners with Special Needs", 3),
          req("SPEDM605", "Instructional Systems for Learners with Intellectual and Developmental Disabilities", 3),
          req("SPEDM606", "Training of Learners with Intellectual and Developmental Disabilities", 3),
          req("SPEDM607", "Internship in Special Needs Education", 3, "Pre-requisite: All major and cognate courses"),
        ],
      },
      {
        groupType: "COGNATE",
        label: "Cognate Courses",
        requiredUnits: 3,
        countsTowardWce: true,
        selectionNote: "Choose only 1 course (3 units)",
        courses: [
          opt("SPEDC608", "Guidance in Special Needs Education", 3),
          opt("SPEDC609", "Managing Inclusive Education in the 21st Century Schools", 3),
        ],
      },
      {
        groupType: "THESIS",
        label: "Thesis",
        requiredUnits: 6,
        countsTowardWce: false,
        courses: [
          req("MT609", "Thesis 1", 3),
          req("MT610", "Thesis 2", 3),
        ],
      },
    ],
  },
  {
    programCode: "MAIE",
    majorName: "Hotel, Restaurant and Management",
    versionCode: "NEW-2024",
    label: "New Curriculum (S.Y. 2024-2025)",
    curriculumType: "NEW",
    effectiveSchoolYear: "2024-2025",
    totalRequiredUnits: 30,
    isDefaultForNewStudents: true,
    groups: [
      {
        groupType: "FOUNDATION",
        label: "Foundation Courses",
        requiredUnits: 6,
        countsTowardWce: true,
        courses: [
          req("MF601", "Methodology of Research", 3),
          req("MF602", "Basic and Inferential Statistics", 3),
        ],
      },
      {
        groupType: "MAJOR",
        label: "Major Courses",
        requiredUnits: 15,
        countsTowardWce: true,
        courses: [
          req("MAMHRM603", "Banquet and Catering Operations", 3),
          req("MAMHRM604", "Cost Management in Food and Beverage Service", 3),
          req("MAMHRM605", "Seminar in Risk Analysis and Management in Food Service", 3),
          req("MAMHRM606", "Entrepreneurial Development with Project Study", 3),
          req("MAMHRM607", "Seminar in Tourism Services", 3),
        ],
      },
      {
        groupType: "COGNATE",
        label: "Cognate Courses",
        requiredUnits: 3,
        countsTowardWce: true,
        courses: [
          req("MACHRM608", "Organizational and Behavior Management", 3),
        ],
      },
      {
        groupType: "THESIS",
        label: "Thesis",
        requiredUnits: 6,
        countsTowardWce: false,
        courses: [
          req("MT609", "Thesis 1", 3),
          req("MT610", "Thesis 2", 3),
        ],
      },
    ],
  },
  {
    programCode: "MBA",
    majorName: null,
    versionCode: "NEW-2024",
    label: "New Curriculum (S.Y. 2024-2025)",
    curriculumType: "NEW",
    effectiveSchoolYear: "2024-2025",
    totalRequiredUnits: 30,
    isDefaultForNewStudents: true,
    groups: [
      {
        groupType: "FOUNDATION",
        label: "Foundation Courses",
        requiredUnits: 6,
        countsTowardWce: true,
        courses: [
          req("MAF601", "Research Methodology", 3),
          req("MAF602", "Basic and Inferential Statistics", 3),
        ],
      },
      {
        groupType: "MAJOR",
        label: "Major Courses",
        requiredUnits: 15,
        countsTowardWce: true,
        courses: [
          req("MBAM603", "Financial Management", 3),
          req("MBAM604", "Production and Operation Management", 3),
          req("MBAM605", "International Business", 3),
          req("MBAM606", "Marketing and Research Management", 3),
          req("MBAM607", "Human Resource Development and Organizational Behavior", 3),
        ],
      },
      {
        groupType: "COGNATE",
        label: "Cognate / Elective Course",
        requiredUnits: 3,
        countsTowardWce: true,
        courses: [
          req("MBAC608", "Management Policy and Strategic Management", 3),
        ],
      },
      {
        groupType: "THESIS",
        label: "Thesis",
        requiredUnits: 6,
        countsTowardWce: false,
        courses: [
          req("MAT609", "Thesis 1", 3),
          req("MAT610", "Thesis 2", 3),
        ],
      },
    ],
  },
  {
    programCode: "MPA",
    majorName: null,
    versionCode: "NEW-2024",
    label: "New Curriculum (S.Y. 2024-2025)",
    curriculumType: "NEW",
    effectiveSchoolYear: "2024-2025",
    totalRequiredUnits: 30,
    isDefaultForNewStudents: true,
    groups: [
      {
        groupType: "FOUNDATION",
        label: "Foundation Courses",
        requiredUnits: 6,
        countsTowardWce: true,
        courses: [
          req("MF601", "Methodology of Research", 3),
          req("MF602", "Basic and Inferential Statistics", 3),
        ],
      },
      {
        groupType: "MAJOR",
        label: "Major Courses",
        requiredUnits: 15,
        countsTowardWce: true,
        courses: [
          req("MPAM603", "Theory and Practice in Public Administration", 3),
          req("MPAM604", "Human Resource Development", 3),
          req("MPAM605", "Advanced Public Fiscal Administration", 3),
          req("MPAM606", "Philippine Political System", 3),
          req("MPAM607", "Organizational Development and Leadership Effectiveness", 3),
        ],
      },
      {
        groupType: "COGNATE",
        label: "Cognate / Elective Course",
        requiredUnits: 3,
        countsTowardWce: true,
        courses: [
          req("MPAC608", "Current Trends and Issues in Public Administration", 3),
        ],
      },
      {
        groupType: "THESIS",
        label: "Thesis",
        requiredUnits: 6,
        countsTowardWce: false,
        courses: [
          req("MT609", "Thesis 1", 3),
          req("MT610", "Thesis 2", 3),
        ],
      },
    ],
  },
  {
    programCode: "MAT",
    majorName: "Science",
    versionCode: "NEW-2024",
    label: "New Curriculum (S.Y. 2024-2025)",
    curriculumType: "NEW",
    effectiveSchoolYear: "2024-2025",
    totalRequiredUnits: 30,
    isDefaultForNewStudents: true,
    groups: [
      {
        groupType: "FOUNDATION",
        label: "Foundation Courses",
        requiredUnits: 6,
        countsTowardWce: true,
        courses: [
          req("MF601", "Methodology of Research", 3),
          req("MF602", "Basic and Inferential Statistics", 3),
        ],
      },
      {
        groupType: "MAJOR",
        label: "Major Courses",
        requiredUnits: 15,
        countsTowardWce: true,
        courses: [
          req("MATSM603", "Environmental Science for Teachers", 3),
          req("MATSM604", "Earth Science for Teachers", 3),
          req("MATSM605", "Chemistry for Teachers", 3),
          req("MATSM606", "Biology for Teachers", 3),
          req("MATSM607", "Physics for Teachers", 3, "Pre-requisite: All major and cognate courses"),
        ],
      },
      {
        groupType: "COGNATE",
        label: "Cognate Courses",
        requiredUnits: 3,
        countsTowardWce: true,
        selectionNote: "Choose only 1 course (3 units)",
        courses: [
          opt("MATSC608A", "Instructional Materials Development for Science Teaching", 3),
          opt("MATSC608B", "Mathematics for Science Teachers", 3),
          opt("MATSC608C", "Strategies and Techniques in Teaching Science", 3),
        ],
      },
      {
        groupType: "THESIS",
        label: "Thesis",
        requiredUnits: 6,
        countsTowardWce: false,
        courses: [
          req("MT609", "Thesis 1", 3),
          req("MT610", "Thesis 2", 3),
        ],
      },
    ],
  },
  {
    programCode: "MAT",
    majorName: "Mathematics",
    versionCode: "NEW-2024",
    label: "New Curriculum (S.Y. 2024-2025)",
    curriculumType: "NEW",
    effectiveSchoolYear: "2024-2025",
    totalRequiredUnits: 30,
    isDefaultForNewStudents: true,
    groups: [
      {
        groupType: "FOUNDATION",
        label: "Foundation Courses",
        requiredUnits: 6,
        countsTowardWce: true,
        courses: [
          req("MF601", "Methodology of Research", 3),
          req("MF602", "Basic and Inferential Statistics", 3),
        ],
      },
      {
        groupType: "MAJOR",
        label: "Major Courses",
        requiredUnits: 15,
        countsTowardWce: true,
        courses: [
          req("MATM603", "Analytic Geometry", 3),
          req("MATM604", "Math Analysis 1 (Differential Calculus)", 3),
          req("MATM605", "Math Analysis 2 (Integral Calculus)", 3),
          req("MATM606", "Number Theory", 3),
          req("MATM607", "Linear Algebra", 3),
        ],
      },
      {
        groupType: "COGNATE",
        label: "Cognate Courses",
        requiredUnits: 3,
        countsTowardWce: true,
        courses: [
          req("MATC608", "Current Trends and Issues in Teaching Mathematics", 3),
        ],
      },
      {
        groupType: "THESIS",
        label: "Thesis",
        requiredUnits: 6,
        countsTowardWce: false,
        courses: [
          req("MT609", "Thesis 1", 3),
          req("MT610", "Thesis 2", 3),
        ],
      },
    ],
  },
  {
    programCode: "MAT",
    majorName: "Electronics Technology",
    versionCode: "NEW-2024",
    label: "New Curriculum (S.Y. 2024-2025)",
    curriculumType: "NEW",
    effectiveSchoolYear: "2024-2025",
    totalRequiredUnits: 30,
    isDefaultForNewStudents: true,
    groups: [
      {
        groupType: "FOUNDATION",
        label: "Foundation Courses",
        requiredUnits: 6,
        countsTowardWce: true,
        courses: [
          req("MF601", "Methodology of Research", 3),
          req("MF602", "Basic and Inferential Statistics", 3),
        ],
      },
      {
        groupType: "MAJOR",
        label: "Major Courses",
        requiredUnits: 15,
        countsTowardWce: true,
        courses: [
          req("MELX 603", "Electrical/Electronic Theories and Principles", 3),
          req("MELX 604", "Audio/Video Devices", 3),
          req("MELX 605", "Basic Digital Circuits Concepts and Applications", 3),
          req("MELX 606", "Advanced Digital Circuits and Application", 3),
          req("MELX 607", "Pneumatic System", 3),
        ],
      },
      {
        groupType: "COGNATE",
        label: "Cognate / Elective Course",
        requiredUnits: 3,
        countsTowardWce: true,
        courses: [
          req("CELX 608", "Industrial Plant Layout and Management", 3),
        ],
      },
      {
        groupType: "THESIS",
        label: "Thesis",
        requiredUnits: 6,
        countsTowardWce: false,
        courses: [
          req("MT609", "Thesis 1", 3),
          req("MT610", "Thesis 2", 3),
        ],
      },
    ],
  },
  {
    programCode: "MAT",
    majorName: "Electrical Technology",
    versionCode: "NEW-2024",
    label: "New Curriculum (S.Y. 2024-2025)",
    curriculumType: "NEW",
    effectiveSchoolYear: "2024-2025",
    totalRequiredUnits: 30,
    isDefaultForNewStudents: true,
    groups: [
      {
        groupType: "FOUNDATION",
        label: "Foundation Courses",
        requiredUnits: 6,
        countsTowardWce: true,
        courses: [
          req("MF601", "Methodology of Research", 3),
          req("MF602", "Basic and Inferential Statistics", 3),
        ],
      },
      {
        groupType: "MAJOR",
        label: "Major Courses",
        requiredUnits: 15,
        countsTowardWce: true,
        courses: [
          req("MELC603", "Electrical/Electronic Theories and Principles", 3),
          req("MELC604", "Philippine Electrical Code (PEC), Application and Practices", 3),
          req("MELC605", "AC/DC Motor Circuits and Controllers", 3),
          req("MELC606", "Basic Digital Circuits Concepts and Applications", 3),
          req("MELC607", "Pneumatic System", 3),
        ],
      },
      {
        groupType: "COGNATE",
        label: "Cognate / Elective Course",
        requiredUnits: 3,
        countsTowardWce: true,
        courses: [
          req("CELX608", "Industrial Shop Layout and Management", 3),
        ],
      },
      {
        groupType: "THESIS",
        label: "Thesis",
        requiredUnits: 6,
        countsTowardWce: false,
        courses: [
          req("MT609", "Thesis 1", 3),
          req("MT610", "Thesis 2", 3),
        ],
      },
    ],
  },
  {
    programCode: "MAIP",
    majorName: null,
    versionCode: "NEW-2024",
    label: "New Curriculum (S.Y. 2024-2025)",
    curriculumType: "NEW",
    effectiveSchoolYear: "2024-2025",
    totalRequiredUnits: 30,
    isDefaultForNewStudents: true,
    groups: [
      {
        groupType: "FOUNDATION",
        label: "Foundation Courses",
        requiredUnits: 6,
        countsTowardWce: true,
        courses: [
          req("MFM601", "Advanced Psychological Statistics", 3),
          req("MFM602", "Advanced Research Method in Psychology", 3),
        ],
      },
      {
        groupType: "MAJOR",
        label: "Major Courses",
        requiredUnits: 15,
        countsTowardWce: true,
        courses: [
          req("MAIPM603", "Advanced Theories of Personality", 3),
          req("MAIPM604", "Advanced Psychological Assessment", 3),
          req("MAIPM605", "Advanced Industrial Psychology", 3),
          req("MAIPM606", "Counseling and Psychotherapy", 3),
          req("MAIPM607", "Industrial Apprenticeship (300 hours)", 3),
        ],
      },
      {
        groupType: "COGNATE",
        label: "Cognate / Elective Course",
        requiredUnits: 3,
        countsTowardWce: true,
        courses: [
          req("MACIP608", "Advanced Abnormal Psychology", 3),
        ],
      },
      {
        groupType: "THESIS",
        label: "Thesis",
        requiredUnits: 6,
        countsTowardWce: false,
        courses: [
          req("MT609", "Thesis 1", 3),
          req("MT610", "Thesis 2", 3),
        ],
      },
    ],
  },
  {
    programCode: "MSM",
    majorName: null,
    versionCode: "NEW-2024",
    label: "New Curriculum (S.Y. 2024-2025)",
    curriculumType: "NEW",
    effectiveSchoolYear: "2024-2025",
    totalRequiredUnits: 30,
    isDefaultForNewStudents: true,
    groups: [
      {
        groupType: "FOUNDATION",
        label: "Foundation Courses",
        requiredUnits: 6,
        countsTowardWce: true,
        courses: [
          req("MSMF601", "Fundamental Concepts of Mathematics", 3),
          req("MSMF602", "Theory of Numbers", 3),
        ],
      },
      {
        groupType: "MAJOR",
        label: "Major Courses",
        requiredUnits: 15,
        countsTowardWce: true,
        courses: [
          req("MSMM603", "Abstract Algebra", 3),
          req("MSMM604", "Complex Analysis", 3),
          req("MSMM605", "Linear Algebra", 3),
          req("MSMM606", "Geometry (Euclidean and Non-Euclidean)", 3),
          req("MSMM607", "Real Analysis", 3),
        ],
      },
      {
        groupType: "COGNATE",
        label: "Cognate Courses",
        requiredUnits: 3,
        countsTowardWce: true,
        courses: [
          req("MSMC608", "Graph Theory", 3),
        ],
      },
      {
        groupType: "THESIS",
        label: "Thesis",
        requiredUnits: 6,
        countsTowardWce: false,
        courses: [
          req("MT609", "Thesis 1", 3),
          req("MT610", "Thesis 2", 3),
        ],
      },
    ],
  },

  // =========================================================================
  // OLD CURRICULA (PRE-2024) — DOCTORATE (4 PROGRAMS)
  // =========================================================================
  {
    programCode: "PhD-IP",
    majorName: null,
    versionCode: "OLD-PRE2024",
    label: "Old Curriculum (Pre-2024)",
    curriculumType: "OLD",
    effectiveSchoolYear: "Pre-2024",
    totalRequiredUnits: 66,
    isDefaultForNewStudents: false,
    groups: [
      {
        groupType: "FOUNDATION",
        label: "Foundation Subjects",
        requiredUnits: 12,
        countsTowardWce: true,
        courses: [
          req("BDIP 101", "Research Strategies in Industrial Setting", 3),
          req("BDIP 102", "Advanced Contemporary Philosophies", 3),
          req("BDIP 103", "Behavioral Statistics and Computer Application", 3),
          req("BDIP 104", "Seminar in Ethical Theory", 3),
        ],
      },
      {
        groupType: "MAJOR",
        label: "Major Subjects",
        requiredUnits: 24,
        countsTowardWce: true,
        selectionNote: "Complete 24 units (8 courses) from the Major Subjects list",
        courses: [
          opt("MDIP 101", "Development of Training Programs", 3),
          opt("MDIP 102", "Advanced Human and Public Relations", 3),
          opt("MDIP 103", "Effective Stress Management", 3),
          opt("MDIP 104", "Management of Conflict (Alternative Dispute Resolutions)", 3),
          opt("MDIP 105", "Labor Law & Labor Management Relations", 3),
          opt("MDIP 106", "Human and Organizational Communications", 3),
          opt("MDIP 107", "Counseling Psychology", 3),
          opt("MDIP 108", "Legal and Ethical Issues in Industrial and Organizational Management", 3),
          opt("MDIP 109", "Management and Personnel Administration", 3),
          opt("MDIP 110", "Diagnosing Organizational Health", 3),
        ],
      },
      {
        groupType: "COGNATE",
        label: "Cognate / Elective Subjects",
        requiredUnits: 9,
        countsTowardWce: true,
        selectionNote: "Complete 9 units (3 courses) from Cognate/Elective Subjects",
        courses: [
          opt("CDIP 101", "Organizational Policy Formulation", 3),
          opt("CDIP 102", "Project Planning and Evaluation", 3),
          opt("CDIP 103", "Executive Management", 3),
          opt("CDIP 104", "Occupational and Career Development", 3),
        ],
      },
      {
        groupType: "FOREIGN_LANGUAGE",
        label: "Foreign Language",
        requiredUnits: 6,
        countsTowardWce: true,
        courses: [
          req("FL 1", "Foreign Language 1", 3),
          req("FL 2", "Foreign Language 2", 3),
        ],
      },
      {
        groupType: "DISSERTATION",
        label: "Dissertation",
        requiredUnits: 15,
        countsTowardWce: false,
        courses: [
          req("DS 201", "Seminar in Dissertation Writing", 3),
          req("DS 202", "Dissertation Writing", 12),
        ],
      },
    ],
  },
  {
    programCode: "Ed.D.-EM",
    majorName: "Educational Management",
    versionCode: "OLD-PRE2024",
    label: "Old Curriculum (Pre-2024)",
    curriculumType: "OLD",
    effectiveSchoolYear: "Pre-2024",
    totalRequiredUnits: 66,
    isDefaultForNewStudents: false,
    groups: [
      {
        groupType: "FOUNDATION",
        label: "Foundation Subjects",
        requiredUnits: 12,
        countsTowardWce: true,
        courses: [
          req("FS 201", "Comparative Philosophy of Education", 3),
          req("FS 202", "Advanced Research & Basic Computer Education", 3),
          req("FS 203", "Advanced Statistics in Education", 3),
          req("FS 204", "School Legislation", 3),
        ],
      },
      {
        groupType: "MAJOR",
        label: "Major Subjects",
        requiredUnits: 30,
        countsTowardWce: true,
        courses: [
          req("MEM 201", "Theories, Concepts & Practices in Educational Management", 3),
          req("MEM 202", "Systems Approach in Education", 3),
          req("MEM 203", "Financial Administration of Educational Institutions", 3),
          req("MEM 204", "Advanced School Plant & Property Management", 3),
          req("MEM 205", "Seminar in Educational Planning", 3),
          req("MEM 206", "Seminar in Management Control of Educational Institution", 3),
          req("MEM 207", "Personnel Policies and Practices", 3),
          req("MEM 208", "Issues & Problems in Education for National Development", 3),
          req("MEM 209", "Human Resource Development", 3),
          req("MEM 210", "Governmental Budgeting", 3),
        ],
      },
      {
        groupType: "COGNATE",
        label: "Cognate Subjects",
        requiredUnits: 9,
        countsTowardWce: true,
        selectionNote: "Choose only 1 field (9 units): Public Administration (CEM 201–203) or Business Administration (CEM 204–206)",
        courses: [
          opt("CEM 201", "Urban and Regional Planning", 3, "Public Administration field"),
          opt("CEM 202", "Seminar in Project Development & Industrial Planning, Design, Implementation and Evaluation", 3, "Public Administration field"),
          opt("CEM 203", "Nationalism for Development", 3, "Public Administration field"),
          opt("CEM 204", "Public Finance in Development Economy", 3, "Business Administration field"),
          opt("CEM 205", "Production and Marketing Management", 3, "Business Administration field"),
          opt("CEM 206", "Management, Accounting and Budgeting", 3, "Business Administration field"),
        ],
      },
      {
        groupType: "DISSERTATION",
        label: "Dissertation",
        requiredUnits: 15,
        countsTowardWce: false,
        courses: [
          req("DS 201", "Seminar in Dissertation Writing", 3),
          req("DS 202", "Dissertation Writing", 12),
        ],
      },
    ],
  },
  {
    programCode: "DPA",
    majorName: null,
    versionCode: "OLD-PRE2024",
    label: "Old Curriculum (Pre-2024)",
    curriculumType: "OLD",
    effectiveSchoolYear: "Pre-2024",
    totalRequiredUnits: 60,
    isDefaultForNewStudents: false,
    groups: [
      {
        groupType: "FOUNDATION",
        label: "Foundation Subjects",
        requiredUnits: 12,
        countsTowardWce: true,
        courses: [
          req("DPA 101", "Advanced Methodology of Research", 3),
          req("DPA 102", "Advanced Statistics w/ Computer Application", 3),
          req("DPA 103", "Theories & Applications in Organizational Management", 3),
          req("DPA 104", "Public Ethics & Social Responsibility", 3),
        ],
      },
      {
        groupType: "MAJOR",
        label: "Major Subjects",
        requiredUnits: 24,
        countsTowardWce: true,
        courses: [
          req("DPA 105", "Advanced Public Finance and Corporate Management", 3),
          req("DPA 106", "Administration Interpersonal Behavior", 3),
          req("DPA 107", "Legal Environment of Public Administration", 3),
          req("DPA 108", "Public Organization Theories & Design", 3),
          req("DPA 109", "Seminar on the Preparation and Administration of Development Model", 3),
          req("DPA 110", "Administrative Planning and Financial Management", 3),
          req("DPA 111", "Current Issues and Problems in Public Administration", 3),
          req("DPA 112", "Advanced Organizational Behavior & Labor Relation", 3),
        ],
      },
      {
        groupType: "COGNATE",
        label: "Cognate Subjects",
        requiredUnits: 9,
        countsTowardWce: true,
        selectionNote: "Complete 9 units (3 courses) from Cognate Subjects",
        courses: [
          opt("DPA 113", "Special Problems in Public Administration", 3),
          opt("DPA 114", "Management Information System", 3),
          opt("DPA 115", "Human Resource Development in Public Setting", 3),
          opt("DPA 116", "Evolutions & Development of Managerial Thoughts", 3),
          opt("DPA 117", "Corporate Business Planning & Safety", 3),
        ],
      },
      {
        groupType: "DISSERTATION",
        label: "Dissertation",
        requiredUnits: 15,
        countsTowardWce: false,
        courses: [
          req("DS 201", "Seminar in Dissertation Writing", 3),
          req("DS 202", "Dissertation Writing", 12),
        ],
      },
    ],
  },
  {
    programCode: "DBA",
    majorName: null,
    versionCode: "OLD-PRE2024",
    label: "Old Curriculum (Pre-2024)",
    curriculumType: "OLD",
    effectiveSchoolYear: "Pre-2024",
    totalRequiredUnits: 60,
    isDefaultForNewStudents: false,
    groups: [
      {
        groupType: "FOUNDATION",
        label: "Foundation Subjects",
        requiredUnits: 12,
        countsTowardWce: true,
        courses: [
          req("DBA 101", "Advanced Methodology of Research", 3),
          req("DBA 102", "Advanced Statistics w/ Computer Application", 3),
          req("DBA 103", "Philosophy of Business", 3),
          req("DBA 104", "Management Theories & Applications", 3),
        ],
      },
      {
        groupType: "MAJOR",
        label: "Major Subjects",
        requiredUnits: 24,
        countsTowardWce: true,
        courses: [
          req("DBA 105", "Advanced Business Economics", 3),
          req("DBA 106", "Fiscal & Monetary Policies", 3),
          req("DBA 107", "Legal Aspects of Business", 3),
          req("DBA 108", "Management of Global Enterprise", 3),
          req("DBA 109", "Advanced Strategic Management", 3),
          req("DBA 110", "Business Ethics & Corporate Social Responsibility", 3),
          req("DBA 111", "Project Planning Development & Evaluation", 3),
          req("DBA 112", "International Marketing", 3),
        ],
      },
      {
        groupType: "COGNATE",
        label: "Cognate Subjects",
        requiredUnits: 9,
        countsTowardWce: true,
        selectionNote: "Complete 9 units (3 courses) from Cognate Subjects",
        courses: [
          opt("DBA 113", "Comparative Banking System", 3),
          opt("DBA 114", "Organization Development", 3),
          opt("DBA 115", "Managerial Accounting", 3),
          opt("DBA 116", "Advanced Marketing Management", 3),
          opt("DBA 117", "Advanced Production & Operations Management", 3),
        ],
      },
      {
        groupType: "DISSERTATION",
        label: "Dissertation",
        requiredUnits: 15,
        countsTowardWce: false,
        courses: [
          req("DS 201", "Seminar in Dissertation Writing", 3),
          req("DS 202", "Dissertation Writing", 12),
        ],
      },
    ],
  },

  // =========================================================================
  // OLD CURRICULA (PRE-2024) — MASTER'S (10 PROGRAMS)
  // =========================================================================
  {
    programCode: "MAEd",
    majorName: "Special Education",
    versionCode: "OLD-PRE2024",
    label: "Old Curriculum (Pre-2024)",
    curriculumType: "OLD",
    effectiveSchoolYear: "Pre-2024",
    totalRequiredUnits: 45,
    isDefaultForNewStudents: false,
    groups: [
      {
        groupType: "FOUNDATION",
        label: "Foundation Subjects",
        requiredUnits: 12,
        countsTowardWce: true,
        courses: [
          req("FS 101", "Advanced Foundations of Education", 3),
          req("FS 102", "Methodology of Research and Statistics", 3),
          req("FS 103", "Basic and Inferential Statistics", 3),
          req("FS 104", "Legal Aspects of Education", 3),
        ],
      },
      {
        groupType: "MAJOR",
        label: "Major Subjects",
        requiredUnits: 18,
        countsTowardWce: true,
        courses: [
          req("MSE 101", "Psychological Educational Assessments of Learners with Special Needs", 3),
          req("MSE 102", "Instructional System for Mentally Retarded Children", 3),
          req("MSE 103", "Training Individuals with Mental Retardation for Independent Living", 3),
          req("MSE 104", "Principles and Strategies in Teaching Children with Mental Retardation", 3),
          req("MSE 105", "Internship in Special Education", 3),
          req("MSE 106", "Early Childhood Education of Exceptional Children", 3),
        ],
      },
      {
        groupType: "COGNATE",
        label: "Cognate Subjects",
        requiredUnits: 6,
        countsTowardWce: true,
        selectionNote: "Complete 6 units (2 courses) from Cognate Subjects",
        courses: [
          opt("CSE 101", "Nature, Concepts and Theories of Learning Disabilities", 3),
          opt("CSE 102", "Guidance in Special Education", 3),
          opt("CSE 103", "Education of Children with Multiple Disabilities", 3),
        ],
      },
      {
        groupType: "THESIS",
        label: "Thesis Writing",
        requiredUnits: 9,
        countsTowardWce: false,
        courses: [
          req("TS 101", "Seminar in Thesis Writing", 3),
          req("TS 102", "Thesis Writing", 6),
        ],
      },
    ],
  },
  {
    programCode: "MAEd",
    majorName: "Guidance and Counseling",
    versionCode: "OLD-PRE2024",
    label: "Old Curriculum (Pre-2024)",
    curriculumType: "OLD",
    effectiveSchoolYear: "Pre-2024",
    totalRequiredUnits: 54,
    isDefaultForNewStudents: false,
    groups: [
      {
        groupType: "FOUNDATION",
        label: "Foundation Subjects",
        requiredUnits: 12,
        countsTowardWce: true,
        courses: [
          req("FS 101", "Advanced Foundations of Education", 3),
          req("FS 102", "Methodology of Research and Statistics", 3),
          req("FS 103", "Basic and Inferential Statistics", 3),
          req("FS 104", "Legal Aspects of Education", 3),
        ],
      },
      {
        groupType: "MAJOR",
        label: "Major Subjects",
        requiredUnits: 27,
        countsTowardWce: true,
        courses: [
          req("MGC 101", "Philosophical, Psychological and Sociological Foundations of Guidance", 3),
          req("MGC 102", "Organization and Administration of Guidance Services and Program Development", 3),
          req("MGC 103", "Psychological Testing and Assessment", 3),
          req("MGC 104", "Counseling Techniques 1", 3),
          req("MGC 105", "Counseling Techniques 2", 3),
          req("MGC 106", "Groups Process", 3),
          req("MGC 107", "Career Guidance and Counseling", 3),
          req("MGC 108", "Current Trends and Issues in Guidance and Counseling", 3),
          req("MGC 109", "Guidance Internship (Practicum)", 3),
        ],
      },
      {
        groupType: "COGNATE",
        label: "Cognate / Elective Subjects",
        requiredUnits: 6,
        countsTowardWce: true,
        selectionNote: "Complete 6 units (2 courses) from Cognate/Elective Subjects",
        courses: [
          opt("CGC 101", "Personality Adjustment and Mental Hygiene", 3),
          opt("CGC 102", "Theories of Personality", 3),
          opt("CGC 103", "Abnormal Psychology", 3),
          opt("CGC 104", "Developmental Psychology", 3),
          opt("CGC 105", "Exceptional Psychology", 3),
        ],
      },
      {
        groupType: "THESIS",
        label: "Thesis Writing",
        requiredUnits: 9,
        countsTowardWce: false,
        courses: [
          req("TS 101", "Seminar in Thesis Writing", 3),
          req("TS 102", "Thesis Writing", 6),
        ],
      },
    ],
  },
  {
    programCode: "MAIP",
    majorName: null,
    versionCode: "OLD-PRE2024",
    label: "Old Curriculum (Pre-2024)",
    curriculumType: "OLD",
    effectiveSchoolYear: "Pre-2024",
    totalRequiredUnits: 45,
    isDefaultForNewStudents: false,
    groups: [
      {
        groupType: "FOUNDATION",
        label: "Foundation Subjects",
        requiredUnits: 12,
        countsTowardWce: true,
        courses: [
          req("BMIP 101", "Advanced Philosophy of Man", 3),
          req("BMIP 102", "Research Methodology in Behavioral Science", 3),
          req("BMIP 103", "Basic & Inferential Statistics", 3),
          req("BMIP 104", "Psychology of Communication", 3),
        ],
      },
      {
        groupType: "MAJOR",
        label: "Major Subjects",
        requiredUnits: 18,
        countsTowardWce: true,
        selectionNote: "Complete 18 units (6 courses) from Major Subjects",
        courses: [
          opt("MMIP 101", "Advanced Psychology of Human Development", 3),
          opt("MMIP 102", "Advanced Theories of Personality", 3),
          opt("MMIP 103", "Advanced Psychometrics", 3),
          opt("MMIP 104", "Advanced Industrial Psychology", 3),
          opt("MMIP 105", "Theories and Practice in Training Programs", 3),
          opt("MMIP 106", "Job Evaluation and Salary Administration", 3),
          opt("MMIP 107", "Organizational Development", 3),
          opt("MMIP 108", "Legal Aspects in Human Resource Management", 3),
          opt("MMIP 109", "Industrial Apprenticeship", 3, "200 hours in Personnel Services, Recruitment, or Training Programs"),
        ],
      },
      {
        groupType: "COGNATE",
        label: "Cognate / Elective Subjects",
        requiredUnits: 6,
        countsTowardWce: true,
        selectionNote: "Complete 6 units (2 courses) from Cognate/Elective Subjects",
        courses: [
          opt("CMIP 101", "Advanced Counseling Techniques in Industrial Setting", 3),
          opt("CMIP 102", "Advertising and Consumer's Psychology", 3),
          opt("CMIP 103", "Current Issues in Industrial Personnel Management", 3),
        ],
      },
      {
        groupType: "THESIS",
        label: "Thesis Writing",
        requiredUnits: 9,
        countsTowardWce: false,
        courses: [
          req("TS 101", "Seminar in Thesis Writing", 3),
          req("TS 102", "Thesis Writing", 6),
        ],
      },
    ],
  },
  {
    programCode: "MAT",
    majorName: "Science",
    versionCode: "OLD-PRE2024",
    label: "Old Curriculum (Pre-2024)",
    curriculumType: "OLD",
    effectiveSchoolYear: "Pre-2024",
    totalRequiredUnits: 45,
    isDefaultForNewStudents: false,
    groups: [
      {
        groupType: "FOUNDATION",
        label: "Foundation Subjects",
        requiredUnits: 12,
        countsTowardWce: true,
        courses: [
          req("FS 101", "Advanced Foundations of Education", 3),
          req("FS 102", "Methodology of Research and Statistics", 3),
          req("FS 103", "Basic and Inferential Statistics", 3),
          req("FS 104", "Legal Aspects of Education", 3),
        ],
      },
      {
        groupType: "MAJOR",
        label: "Major Subjects",
        requiredUnits: 18,
        countsTowardWce: true,
        selectionNote: "Complete 18 units (6 courses) from Major Subjects",
        courses: [
          opt("MSCI 101", "Environmental Science", 3),
          opt("MSCI 102", "Earth Science", 3),
          opt("MSCI 103", "Chemistry I", 3),
          opt("MSCI 104", "Chemistry II", 3),
          opt("MSCI 105", "Biology I", 3),
          opt("MSCI 106", "Biology II", 3),
          opt("MSCI 107", "Physics I (Mechanics)", 3),
          opt("MSCI 108", "Physics II (Electromagnetism)", 3),
        ],
      },
      {
        groupType: "COGNATE",
        label: "Cognate / Elective Subjects",
        requiredUnits: 6,
        countsTowardWce: true,
        selectionNote: "Complete 6 units (2 courses) from Cognate/Elective Subjects",
        courses: [
          opt("CSCI 101", "Applied Mathematics", 3),
          opt("CSCI 102", "Preparation of Instructional Materials", 3),
          opt("CSCI 103", "Current Trends and Techniques in Teaching Science", 3),
        ],
      },
      {
        groupType: "THESIS",
        label: "Thesis Writing",
        requiredUnits: 9,
        countsTowardWce: false,
        courses: [
          req("TS 101", "Seminar in Thesis Writing", 3),
          req("TS 102", "Thesis Writing", 6),
        ],
      },
    ],
  },
  {
    programCode: "MAEd",
    majorName: "Administration and Supervision",
    versionCode: "OLD-PRE2024",
    label: "Old Curriculum (Pre-2024)",
    curriculumType: "OLD",
    effectiveSchoolYear: "Pre-2024",
    totalRequiredUnits: 45,
    isDefaultForNewStudents: false,
    groups: [
      {
        groupType: "FOUNDATION",
        label: "Foundation Subjects",
        requiredUnits: 12,
        countsTowardWce: true,
        courses: [
          req("FS 101", "Advanced Foundations of Education", 3),
          req("FS 102", "Methodology of Research and Statistics", 3),
          req("FS 103", "Basic and Inferential Statistics", 3),
          req("FS 104", "Legal Aspects of Education", 3),
        ],
      },
      {
        groupType: "MAJOR",
        label: "Major Subjects",
        requiredUnits: 18,
        countsTowardWce: true,
        selectionNote: "Complete 18 units (6 courses) from Major Subjects",
        courses: [
          opt("MAS 101", "Theories and Practices of Modern School Administration", 3),
          opt("MAS 102", "Educational Planning", 3),
          opt("MAS 103", "School Finance and Business Management of Education", 3),
          opt("MAS 104", "Personnel Administration", 3),
          opt("MAS 105", "Organization and Administration of the Guidance Program", 3),
          opt("MAS 106", "Current Issues and Problems in Education", 3),
          opt("MAS 107", "School Plant and Property Management", 3),
        ],
      },
      {
        groupType: "COGNATE",
        label: "Cognate Subjects",
        requiredUnits: 6,
        countsTowardWce: true,
        selectionNote: "Complete 6 units (2 courses) from Cognate Subjects",
        courses: [
          opt("CAS 101", "Educational Leadership", 3),
          opt("CAS 102", "Organization and Management of Educational Institutions", 3),
          opt("CAS 103", "Curriculum Development", 3),
          opt("CAS 104", "Human Relations and Group Dynamics", 3),
          opt("CAS 105", "Feasibility Study", 3),
        ],
      },
      {
        groupType: "THESIS",
        label: "Thesis Writing",
        requiredUnits: 9,
        countsTowardWce: false,
        courses: [
          req("TS 101", "Seminar in Thesis Writing", 3),
          req("TS 102", "Thesis Writing", 6),
        ],
      },
    ],
  },
  {
    programCode: "MAT",
    majorName: "Mathematics",
    versionCode: "OLD-PRE2024",
    label: "Old Curriculum (Pre-2024)",
    curriculumType: "OLD",
    effectiveSchoolYear: "Pre-2024",
    totalRequiredUnits: 45,
    isDefaultForNewStudents: false,
    groups: [
      {
        groupType: "FOUNDATION",
        label: "Foundation Subjects",
        requiredUnits: 12,
        countsTowardWce: true,
        courses: [
          req("FS 101", "Advanced Foundations of Education", 3),
          req("FS 102", "Methodology of Research and Statistics", 3),
          req("FS 103", "Basic and Inferential Statistics", 3),
          req("FS 104", "Legal Aspects of Education", 3),
        ],
      },
      {
        groupType: "MAJOR",
        label: "Major Subjects",
        requiredUnits: 18,
        countsTowardWce: true,
        courses: [
          req("MMA 101", "Analytic Geometry", 3),
          req("MMA 102", "Mathematical Analysis I (Differential Calculus)", 3),
          req("MMA 103", "Mathematical Analysis II (Integral Calculus)", 3),
          req("MMA 104", "Geometry", 3),
          req("MMA 105", "Number Theory", 3),
          req("MMA 106", "Linear Algebra", 3),
        ],
      },
      {
        groupType: "COGNATE",
        label: "Cognate Subjects",
        requiredUnits: 6,
        countsTowardWce: true,
        selectionNote: "Choose only 2 courses (6 units)",
        courses: [
          opt("CMA 101", "Numerical Analysis", 3),
          opt("CMA 102", "Introduction to Probability", 3),
          opt("CMA 103", "Current Trends and Techniques in Teaching Mathematics", 3),
        ],
      },
      {
        groupType: "THESIS",
        label: "Thesis Writing",
        requiredUnits: 9,
        countsTowardWce: false,
        courses: [
          req("TS 101", "Seminar in Thesis Writing", 3),
          req("TS 102", "Thesis Writing", 6),
        ],
      },
    ],
  },
  {
    programCode: "MAIE",
    majorName: "Hotel, Restaurant and Management",
    versionCode: "OLD-PRE2024",
    label: "Old Curriculum (Pre-2024)",
    curriculumType: "OLD",
    effectiveSchoolYear: "Pre-2024",
    totalRequiredUnits: 45,
    isDefaultForNewStudents: false,
    groups: [
      {
        groupType: "FOUNDATION",
        label: "Foundation Subjects",
        requiredUnits: 12,
        countsTowardWce: true,
        courses: [
          req("FS 101", "Advanced Foundations of Education", 3),
          req("FS 102", "Methodology of Research and Statistics", 3),
          req("FS 103", "Basic and Inferential Statistics", 3),
          req("FS 104", "Legal Aspects of Education", 3),
        ],
      },
      {
        groupType: "MAJOR",
        label: "Major Subjects",
        requiredUnits: 18,
        countsTowardWce: true,
        selectionNote: "Complete 18 units (6 courses) from Major Subjects",
        courses: [
          opt("MHRM 101", "Quantity Cookery", 3),
          opt("MHRM 102", "Catering Management", 3),
          opt("MHRM 103", "Issues and Problem in HRM", 3),
          opt("MHRM 104", "Hotel and Cost Control Analysis", 3),
          opt("MHRM 105", "Hotel and Restaurant Facilities and Equipment Planning", 3),
          opt("MHRM 106", "Production and Marketing Management", 3),
          opt("MHRM 107", "Managerial Economics", 3),
        ],
      },
      {
        groupType: "COGNATE",
        label: "Cognate / Elective Subjects",
        requiredUnits: 6,
        countsTowardWce: true,
        selectionNote: "Choose only 2 courses (6 units)",
        courses: [
          opt("CHRM 101", "Project Study", 3),
          opt("CHRM 102", "Organization Management and Behavior", 3),
          opt("CHRM 103", "Maintenance and Safety Engineering", 3),
          opt("CHRM 104", "Current Trends and Techniques of Teaching", 3),
        ],
      },
      {
        groupType: "THESIS",
        label: "Thesis Writing",
        requiredUnits: 9,
        countsTowardWce: false,
        courses: [
          req("TS 101", "Seminar in Thesis Writing", 3),
          req("TS 102", "Thesis Writing", 6),
        ],
      },
    ],
  },
  {
    programCode: "MSM",
    majorName: null,
    versionCode: "OLD-PRE2024",
    label: "Old Curriculum (Pre-2024)",
    curriculumType: "OLD",
    effectiveSchoolYear: "Pre-2024",
    totalRequiredUnits: 45,
    isDefaultForNewStudents: false,
    groups: [
      {
        groupType: "FOUNDATION",
        label: "Foundation Subjects",
        requiredUnits: 12,
        countsTowardWce: true,
        courses: [
          req("BMSM 101", "Math Analysis", 3),
          req("BMSM 102", "Number Theory", 3),
          req("BMSM 103", "Set Theory and Logic", 3),
          req("BMSM 104", "Basic and Inferential Statistics", 3),
        ],
      },
      {
        groupType: "MAJOR",
        label: "Major Subjects",
        requiredUnits: 18,
        countsTowardWce: true,
        courses: [
          req("MMSM 101", "Linear Algebra", 3),
          req("MMSM 102", "Abstract Algebra", 3),
          req("MMSM 103", "Complex Analysis", 3),
          req("MMSM 104", "Real Analysis", 3),
          req("MMSM 105", "General Topology", 3),
          req("MMSM 106", "Graph Theory", 3),
        ],
      },
      {
        groupType: "COGNATE",
        label: "Cognate Subjects",
        requiredUnits: 6,
        countsTowardWce: true,
        selectionNote: "Choose only 2 courses (6 units)",
        courses: [
          opt("CMSM 101", "Probability Theory", 3),
          opt("CMSM 102", "Differential Equations", 3),
          opt("CMSM 103", "Multivariate Analysis", 3),
          opt("CMSM 104", "Linear Programming", 3),
          opt("CMSM 105", "Advanced Complex Analysis", 3),
          opt("CMSM 106", "Numerical Analysis", 3),
        ],
      },
      {
        groupType: "THESIS",
        label: "Thesis Writing",
        requiredUnits: 9,
        countsTowardWce: false,
        courses: [
          req("TS 101", "Seminar in Thesis Writing", 3),
          req("TS 102", "Thesis Writing", 6),
        ],
      },
    ],
  },
  {
    programCode: "MBA",
    majorName: null,
    versionCode: "OLD-PRE2024",
    label: "Old Curriculum (Pre-2024)",
    curriculumType: "OLD",
    effectiveSchoolYear: "Pre-2024",
    totalRequiredUnits: 48,
    isDefaultForNewStudents: false,
    groups: [
      {
        groupType: "FOUNDATION",
        label: "Foundation Subjects",
        requiredUnits: 12,
        countsTowardWce: true,
        courses: [
          req("MBA 101", "Research Methodology", 3),
          req("MBA 102", "Managerial Statistics", 3),
          req("MBA 103", "Strategic Management", 3),
          req("MBA 104", "Human Behavior Organization", 3),
        ],
      },
      {
        groupType: "MAJOR",
        label: "Major Subjects",
        requiredUnits: 18,
        countsTowardWce: true,
        courses: [
          req("MBA 105", "Financial Management", 3),
          req("MBA 106", "Marketing Management", 3),
          req("MBA 107", "Production and Operations Management", 3),
          req("MBA 108", "International Business", 3),
          req("MBA 109", "Human Resource Management", 3),
          req("MBA 110", "Business Ethics and Corporate Social Responsibility", 3),
        ],
      },
      {
        groupType: "COGNATE",
        label: "Cognate Subjects",
        requiredUnits: 9,
        countsTowardWce: true,
        selectionNote: "Complete 9 units (3 courses) from Cognate Subjects",
        courses: [
          opt("MBA 111", "Management Information System", 3),
          opt("MBA 112", "Organization Theory and Design", 3),
          opt("MBA 113", "Marketing Research", 3),
          opt("MBA 114", "Management Policy", 3),
          opt("MBA 115", "Entrepreneurial Managerial", 3),
          opt("MBA 116", "Managerial Accounting", 3),
          opt("MBA 117", "Economic Analysis of Business", 3),
        ],
      },
      {
        groupType: "THESIS",
        label: "Thesis Writing",
        requiredUnits: 9,
        countsTowardWce: false,
        courses: [
          req("TS 101", "Seminar in Thesis Writing", 3),
          req("TS 102", "Thesis Writing", 6),
        ],
      },
    ],
  },
  {
    programCode: "MPA",
    majorName: null,
    versionCode: "OLD-PRE2024",
    label: "Old Curriculum (Pre-2024)",
    curriculumType: "OLD",
    effectiveSchoolYear: "Pre-2024",
    totalRequiredUnits: 48,
    isDefaultForNewStudents: false,
    groups: [
      {
        groupType: "FOUNDATION",
        label: "Foundation Subjects",
        requiredUnits: 12,
        countsTowardWce: true,
        courses: [
          req("MPA 101", "Research Methodology", 3),
          req("MPA 102", "Managerial Statistics", 3),
          req("MPA 103", "Human Behavior in Organization with Human Rights", 3),
          req("MPA 104", "Theory and Practices in Public Administration", 3),
        ],
      },
      {
        groupType: "MAJOR",
        label: "Major Subjects",
        requiredUnits: 18,
        countsTowardWce: true,
        courses: [
          req("MPA 105", "Ethics in Government Service", 3),
          req("MPA 106", "Human Resource Development", 3),
          req("MPA 107", "Public Administration and Public Relations", 3),
          req("MPA 108", "Local Government Administration", 3),
          req("MPA 109", "Public Fiscal Administration", 3),
          req("MPA 110", "Philippine Constitution and its Implication to Society", 3),
        ],
      },
      {
        groupType: "COGNATE",
        label: "Cognate Subjects",
        requiredUnits: 9,
        countsTowardWce: true,
        selectionNote: "Complete 9 units (3 courses) from Cognate Subjects",
        courses: [
          opt("MPA 111", "Comparative Administration", 3),
          opt("MPA 112", "Interpersonal Relations", 3),
          opt("MPA 113", "Management Information Technology", 3),
          opt("MPA 114", "Civil Service Policies", 3),
        ],
      },
      {
        groupType: "THESIS",
        label: "Thesis Writing",
        requiredUnits: 9,
        countsTowardWce: false,
        courses: [
          req("TS 101", "Seminar in Thesis Writing", 3),
          req("TS 102", "Thesis Writing", 6),
        ],
      },
    ],
  },
];

function programMatchKey(programCode: string | null | undefined, majorName: string | null | undefined): string {
  return `${String(programCode ?? "").trim().toUpperCase()}::${String(majorName ?? "").trim().toLowerCase()}`;
}

export async function reconcileAuthoritativeCurricula(
  prismaClient: Pick<
    PrismaClient,
    | "program"
    | "curriculumVersion"
    | "curriculumCourseGroup"
    | "curriculumCourse"
    | "student"
  >,
): Promise<{ versionsCreated: number; versionsUpdated: number; studentsAssigned: number }> {
  const programs = await prismaClient.program.findMany({
    select: { id: true, programCode: true, majorName: true },
  });

  const programByKey = new Map<string, string>();
  for (const p of programs) {
    if (p.programCode) {
      programByKey.set(programMatchKey(p.programCode, p.majorName), p.id);
    }
  }

  let versionsCreated = 0;
  let versionsUpdated = 0;

  for (const seed of AUTHORITATIVE_CURRICULA) {
    const programId = programByKey.get(
      programMatchKey(seed.programCode, seed.majorName),
    );
    if (!programId) {
      continue;
    }

    const existingVersion = await prismaClient.curriculumVersion.findUnique({
      where: {
        programId_versionCode: {
          programId,
          versionCode: seed.versionCode,
        },
      },
      include: {
        groups: {
          include: {
            courses: {
              include: {
                _count: { select: { studentProgress: true } },
              },
            },
          },
        },
      },
    });

    if (!existingVersion) {
      await prismaClient.curriculumVersion.create({
        data: {
          programId,
          versionCode: seed.versionCode,
          label: seed.label,
          curriculumType: seed.curriculumType,
          effectiveSchoolYear: seed.effectiveSchoolYear,
          totalRequiredUnits: seed.totalRequiredUnits,
          isDefaultForNewStudents: seed.isDefaultForNewStudents,
          isActive: true,
          notes: seed.notes ?? null,
          groups: {
            create: seed.groups.map((g, gIdx) => ({
              groupType: g.groupType,
              label: g.label,
              requiredUnits: g.requiredUnits,
              countsTowardWce: g.countsTowardWce,
              selectionNote: g.selectionNote ?? null,
              displayOrder: gIdx + 1,
              courses: {
                create: g.courses.map((c, cIdx) => ({
                  courseCode: c.courseCode,
                  courseTitle: c.courseTitle,
                  units: c.units,
                  isRequired: c.isRequired,
                  prerequisiteNote: c.prerequisiteNote ?? null,
                  displayOrder: cIdx + 1,
                })),
              },
            })),
          },
        },
      });
      versionsCreated += 1;
      continue;
    }

    await prismaClient.curriculumVersion.update({
      where: { id: existingVersion.id },
      data: {
        label: seed.label,
        curriculumType: seed.curriculumType,
        effectiveSchoolYear: seed.effectiveSchoolYear,
        totalRequiredUnits: seed.totalRequiredUnits,
        isDefaultForNewStudents: seed.isDefaultForNewStudents,
        isActive: true,
        notes: seed.notes ?? null,
      },
    });

    // Reconcile groups and courses without dropping any course that has StudentCourseProgress.
    const existingGroupByTypeAndOrder = new Map(
      existingVersion.groups.map((g) => [`${g.groupType}::${g.displayOrder}`, g]),
    );
    const existingGroupByType = new Map<string, (typeof existingVersion.groups)[number]>();
    for (const g of existingVersion.groups) {
      if (!existingGroupByType.has(g.groupType)) {
        existingGroupByType.set(g.groupType, g);
      }
    }

    for (let gIdx = 0; gIdx < seed.groups.length; gIdx++) {
      const gSeed = seed.groups[gIdx];
      const existingGroup =
        existingGroupByTypeAndOrder.get(`${gSeed.groupType}::${gIdx + 1}`) ??
        existingGroupByType.get(gSeed.groupType);

      if (!existingGroup) {
        await prismaClient.curriculumCourseGroup.create({
          data: {
            curriculumVersionId: existingVersion.id,
            groupType: gSeed.groupType,
            label: gSeed.label,
            requiredUnits: gSeed.requiredUnits,
            countsTowardWce: gSeed.countsTowardWce,
            selectionNote: gSeed.selectionNote ?? null,
            displayOrder: gIdx + 1,
            courses: {
              create: gSeed.courses.map((c, cIdx) => ({
                courseCode: c.courseCode,
                courseTitle: c.courseTitle,
                units: c.units,
                isRequired: c.isRequired,
                prerequisiteNote: c.prerequisiteNote ?? null,
                displayOrder: cIdx + 1,
              })),
            },
          },
        });
        continue;
      }

      await prismaClient.curriculumCourseGroup.update({
        where: { id: existingGroup.id },
        data: {
          label: gSeed.label,
          requiredUnits: gSeed.requiredUnits,
          countsTowardWce: gSeed.countsTowardWce,
          selectionNote: gSeed.selectionNote ?? null,
          displayOrder: gIdx + 1,
        },
      });

      const existingCourseByCode = new Map(
        existingGroup.courses.map((c) => [c.courseCode.toUpperCase(), c]),
      );

      for (let cIdx = 0; cIdx < gSeed.courses.length; cIdx++) {
        const cSeed = gSeed.courses[cIdx];
        const matched = existingCourseByCode.get(cSeed.courseCode.toUpperCase());
        if (matched) {
          await prismaClient.curriculumCourse.update({
            where: { id: matched.id },
            data: {
              courseCode: cSeed.courseCode,
              courseTitle: cSeed.courseTitle,
              units: cSeed.units,
              isRequired: cSeed.isRequired,
              prerequisiteNote: cSeed.prerequisiteNote ?? null,
              displayOrder: cIdx + 1,
            },
          });
        } else {
          await prismaClient.curriculumCourse.create({
            data: {
              groupId: existingGroup.id,
              courseCode: cSeed.courseCode,
              courseTitle: cSeed.courseTitle,
              units: cSeed.units,
              isRequired: cSeed.isRequired,
              prerequisiteNote: cSeed.prerequisiteNote ?? null,
              displayOrder: cIdx + 1,
            },
          });
        }
      }
    }

    versionsUpdated += 1;
  }

  // Backfill missing curriculumVersionId for active/graduated/dismissed Students.
  const studentsAssigned = await assignMissingStudentCurriculumVersions(prismaClient);

  return { versionsCreated, versionsUpdated, studentsAssigned };
}

export async function assignMissingStudentCurriculumVersions(
  prismaClient: Pick<PrismaClient, "curriculumVersion" | "student">,
): Promise<number> {
  const allVersions = await prismaClient.curriculumVersion.findMany({
    where: { isActive: true },
    orderBy: [{ isDefaultForNewStudents: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      programId: true,
      curriculumType: true,
      isDefaultForNewStudents: true,
    },
  });

  const unassignedStudents = await prismaClient.student.findMany({
    where: {
      curriculumVersionId: null,
      admissionStatus: { in: ["ENROLLED", "GRADUATED", "DISMISSED"] },
    },
    select: { id: true, programId: true, curriculumType: true },
  });

  let studentsAssigned = 0;
  for (const stu of unassignedStudents) {
    const forProgram = allVersions.filter((v) => v.programId === stu.programId);
    if (forProgram.length === 0) continue;

    const chosen =
      (stu.curriculumType
        ? forProgram.find((v) => v.curriculumType === stu.curriculumType)
        : undefined) ??
      forProgram.find((v) => v.isDefaultForNewStudents) ??
      forProgram[0];

    await prismaClient.student.update({
      where: { id: stu.id },
      data: {
        curriculumVersionId: chosen.id,
        curriculumType: stu.curriculumType ?? chosen.curriculumType,
      },
    });
    studentsAssigned += 1;
  }

  return studentsAssigned;
}
