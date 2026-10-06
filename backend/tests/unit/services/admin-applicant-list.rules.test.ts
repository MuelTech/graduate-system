import { describe, expect, it } from "vitest";
import {
  buildApplicantListWhere,
  deriveAdmissionStage,
  hasAuthoritativePassedExam,
  type AdmissionStage,
} from "../../../src/services/admin-applicant-list.rules";

describe("buildApplicantListWhere — active Applicant scope", () => {
  it("fails closed to admissionStatus APPLICANT + user role APPLICANT", () => {
    const where = buildApplicantListWhere({});
    expect(where).toEqual({
      AND: [{ admissionStatus: "APPLICANT", user: { role: "APPLICANT" } }],
    });
  });
});

describe("buildApplicantListWhere — search", () => {
  it("searches first name, last name, email and Pinnacle Applicant ID only", () => {
    const where = buildApplicantListWhere({ search: "ana" });
    const and = where.AND as unknown[];
    expect(and[1]).toEqual({
      OR: [
        { user: { firstName: { contains: "ana" } } },
        { user: { lastName: { contains: "ana" } } },
        { user: { email: { contains: "ana" } } },
        { pinnacleApplicantId: { contains: "ana" } },
      ],
    });
  });

  it("ignores blank/whitespace search", () => {
    expect(buildApplicantListWhere({ search: "   " })).toEqual({
      AND: [{ admissionStatus: "APPLICANT", user: { role: "APPLICANT" } }],
    });
  });
});

describe("buildApplicantListWhere — program filter", () => {
  it("filters by exact Program id", () => {
    const where = buildApplicantListWhere({ programId: "prog-9" });
    expect(where.AND).toContainEqual({ programId: "prog-9" });
  });
});

describe("buildApplicantListWhere — admission stage", () => {
  it("Program Alignment includes PENDING_WAIVER and missing/unknown alignment", () => {
    const where = buildApplicantListWhere({ stage: "ALIGNMENT" });
    expect(where.AND).toContainEqual({
      OR: [
        { alignmentStatus: null },
        { alignmentStatus: { notIn: ["ALIGNED", "CLEARED"] } },
      ],
    });
  });

  it("Entrance Examination requires cleared alignment and no authoritative PASSED exam", () => {
    const where = buildApplicantListWhere({ stage: "EXAM" });
    expect(where.AND).toContainEqual({
      alignmentStatus: { in: ["ALIGNED", "CLEARED"] },
    });
    expect(where.AND).toContainEqual({
      examApplications: { none: { status: "PASSED" } },
    });
  });

  it("COR / Enrollment requires cleared alignment AND an authoritative PASSED exam", () => {
    const where = buildApplicantListWhere({ stage: "COR" });
    expect(where.AND).toContainEqual({
      alignmentStatus: { in: ["ALIGNED", "CLEARED"] },
    });
    expect(where.AND).toContainEqual({
      examApplications: { some: { status: "PASSED" } },
    });
  });

  it("adds no stage clause for empty or unknown stage values", () => {
    expect(buildApplicantListWhere({ stage: "" })).toEqual({
      AND: [{ admissionStatus: "APPLICANT", user: { role: "APPLICANT" } }],
    });
    expect(buildApplicantListWhere({ stage: "SOMETHING" })).toEqual({
      AND: [{ admissionStatus: "APPLICANT", user: { role: "APPLICANT" } }],
    });
  });
});

/* ------------------------------------------------------------------------- */
/* Filter/derivation invariant.
 * A record returned by a stage filter must derive to that same stage. These
 * tests evaluate the real produced Prisma where clause against synthetic
 * records (not merely its shape). */

type StageCase = {
  label: string;
  alignmentStatus: string | null;
  examStatuses: string[];
};

const STAGE_CASES: StageCase[] = [
  { label: "null alignment, no exam", alignmentStatus: null, examStatuses: [] },
  {
    label: "null alignment + historical PASSED",
    alignmentStatus: null,
    examStatuses: ["PASSED"],
  },
  {
    label: "PENDING_WAIVER + historical PASSED",
    alignmentStatus: "PENDING_WAIVER",
    examStatuses: ["PASSED"],
  },
  { label: "ALIGNED, no exam", alignmentStatus: "ALIGNED", examStatuses: [] },
  { label: "CLEARED, no exam", alignmentStatus: "CLEARED", examStatuses: [] },
  {
    label: "ALIGNED, DISQUALIFIED only",
    alignmentStatus: "ALIGNED",
    examStatuses: ["DISQUALIFIED"],
  },
  { label: "ALIGNED + PASSED", alignmentStatus: "ALIGNED", examStatuses: ["PASSED"] },
  { label: "CLEARED + PASSED", alignmentStatus: "CLEARED", examStatuses: ["PASSED"] },
];

function recordFor(testCase: StageCase) {
  return {
    admissionStatus: "APPLICANT",
    user: { role: "APPLICANT" },
    alignmentStatus: testCase.alignmentStatus,
    examApplications: testCase.examStatuses.map((status) => ({ status })),
  };
}

/** Minimal evaluator for the subset of Prisma where clauses this module emits. */
function matchesWhere(where: any, record: any): boolean {
  if (where.AND) return where.AND.every((w: any) => matchesWhere(w, record));
  if (where.OR) return where.OR.some((w: any) => matchesWhere(w, record));
  if (Object.prototype.hasOwnProperty.call(where, "alignmentStatus")) {
    const clause = where.alignmentStatus;
    if (clause === null) return record.alignmentStatus === null;
    if (clause && typeof clause === "object" && "in" in clause) {
      return clause.in.includes(record.alignmentStatus);
    }
    if (clause && typeof clause === "object" && "notIn" in clause) {
      return !clause.notIn.includes(record.alignmentStatus);
    }
  }
  if (Object.prototype.hasOwnProperty.call(where, "examApplications")) {
    const clause = where.examApplications;
    const apps = record.examApplications ?? [];
    if (clause.some) return apps.some((a: any) => a.status === clause.some.status);
    if (clause.none) return apps.every((a: any) => a.status !== clause.none.status);
  }
  if (Object.prototype.hasOwnProperty.call(where, "admissionStatus")) {
    return record.admissionStatus === where.admissionStatus;
  }
  if (where.user && where.user.role) return record.user?.role === where.user.role;
  if (Object.prototype.hasOwnProperty.call(where, "programId")) {
    return record.programId === where.programId;
  }
  return true;
}

describe("stage filter <-> derivation invariant", () => {
  const stages: AdmissionStage[] = ["ALIGNMENT", "EXAM", "COR"];

  it("every record matching a stage filter derives to that same stage", () => {
    for (const stage of stages) {
      const where = buildApplicantListWhere({ stage });
      for (const testCase of STAGE_CASES) {
        const record = recordFor(testCase);
        const derived = deriveAdmissionStage({
          alignmentStatus: testCase.alignmentStatus,
          hasPassedExam: testCase.examStatuses.includes("PASSED"),
        });
        expect(
          matchesWhere(where, record),
          `${stage} filter vs "${testCase.label}"`,
        ).toBe(derived === stage);
      }
    }
  });

  it("ALIGNMENT filter matches historical-PASSED records with incomplete alignment and they derive ALIGNMENT", () => {
    const where = buildApplicantListWhere({ stage: "ALIGNMENT" });
    const cases = STAGE_CASES.filter((c) =>
      [
        "null alignment + historical PASSED",
        "PENDING_WAIVER + historical PASSED",
      ].includes(c.label),
    );
    expect(cases).toHaveLength(2);
    for (const testCase of cases) {
      expect(matchesWhere(where, recordFor(testCase))).toBe(true);
      expect(
        deriveAdmissionStage({
          alignmentStatus: testCase.alignmentStatus,
          hasPassedExam: testCase.examStatuses.includes("PASSED"),
        }),
      ).toBe("ALIGNMENT");
    }
  });

  it("COR filter excludes PASSED records whose alignment is incomplete", () => {
    const where = buildApplicantListWhere({ stage: "COR" });
    const cases = STAGE_CASES.filter((c) =>
      [
        "null alignment + historical PASSED",
        "PENDING_WAIVER + historical PASSED",
      ].includes(c.label),
    );
    for (const testCase of cases) {
      expect(matchesWhere(where, recordFor(testCase))).toBe(false);
    }
  });
});

describe("deriveAdmissionStage", () => {
  it("treats missing alignment authority as Program Alignment (fail closed)", () => {
    expect(deriveAdmissionStage({ alignmentStatus: null, hasPassedExam: false })).toBe("ALIGNMENT");
    expect(deriveAdmissionStage({ alignmentStatus: undefined, hasPassedExam: true })).toBe("ALIGNMENT");
  });

  it("treats PENDING_WAIVER as Program Alignment", () => {
    expect(deriveAdmissionStage({ alignmentStatus: "PENDING_WAIVER", hasPassedExam: false })).toBe("ALIGNMENT");
  });

  it("treats ALIGNED/CLEARED without a passed exam as Entrance Examination", () => {
    expect(deriveAdmissionStage({ alignmentStatus: "ALIGNED", hasPassedExam: false })).toBe("EXAM");
    expect(deriveAdmissionStage({ alignmentStatus: "CLEARED", hasPassedExam: false })).toBe("EXAM");
  });

  it("treats a passed exam as COR / Enrollment", () => {
    expect(deriveAdmissionStage({ alignmentStatus: "ALIGNED", hasPassedExam: true })).toBe("COR");
  });
});

describe("hasAuthoritativePassedExam", () => {
  it("is true only when an authoritative PASSED application exists", () => {
    expect(hasAuthoritativePassedExam([{ status: "PASSED" }])).toBe(true);
    expect(hasAuthoritativePassedExam([{ status: "DISQUALIFIED" }, { status: "PASSED" }])).toBe(true);
  });

  it("does not treat non-PASSED exam states as passed", () => {
    for (const status of ["PENDING", "APPROVED", "TAKEN", "FAILED", "DISQUALIFIED", "APPEALED"]) {
      expect(hasAuthoritativePassedExam([{ status }])).toBe(false);
    }
    expect(hasAuthoritativePassedExam([])).toBe(false);
  });
});
