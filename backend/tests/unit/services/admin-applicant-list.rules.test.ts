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
  it("Entrance Examination requires no authoritative PASSED exam", () => {
    const where = buildApplicantListWhere({ stage: "EXAM" });
    expect(where.AND).toContainEqual({
      examApplications: { none: { status: "PASSED" } },
    });
  });

  it("COR / Enrollment requires an authoritative PASSED exam", () => {
    const where = buildApplicantListWhere({ stage: "COR" });
    expect(where.AND).toContainEqual({
      examApplications: { some: { status: "PASSED" } },
    });
  });

  it("adds no stage clause for empty or unknown stage values (including legacy ALIGNMENT)", () => {
    expect(buildApplicantListWhere({ stage: "" })).toEqual({
      AND: [{ admissionStatus: "APPLICANT", user: { role: "APPLICANT" } }],
    });
    expect(buildApplicantListWhere({ stage: "ALIGNMENT" })).toEqual({
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
  examStatuses: string[];
};

const STAGE_CASES: StageCase[] = [
  { label: "no exam", examStatuses: [] },
  { label: "PENDING only", examStatuses: ["PENDING"] },
  { label: "DISQUALIFIED only", examStatuses: ["DISQUALIFIED"] },
  { label: "PASSED", examStatuses: ["PASSED"] },
  { label: "historical PASSED + newer DISQUALIFIED", examStatuses: ["DISQUALIFIED", "PASSED"] },
];

function recordFor(testCase: StageCase) {
  return {
    admissionStatus: "APPLICANT",
    user: { role: "APPLICANT" },
    examApplications: testCase.examStatuses.map((status) => ({ status })),
  };
}

/** Minimal evaluator for the subset of Prisma where clauses this module emits. */
function matchesWhere(where: any, record: any): boolean {
  if (where.AND) return where.AND.every((w: any) => matchesWhere(w, record));
  if (where.OR) return where.OR.some((w: any) => matchesWhere(w, record));
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
  const stages: AdmissionStage[] = ["EXAM", "COR"];

  it("every record matching a stage filter derives to that same stage", () => {
    for (const stage of stages) {
      const where = buildApplicantListWhere({ stage });
      for (const testCase of STAGE_CASES) {
        const record = recordFor(testCase);
        const derived = deriveAdmissionStage({
          hasPassedExam: testCase.examStatuses.includes("PASSED"),
        });
        expect(
          matchesWhere(where, record),
          `${stage} filter vs "${testCase.label}"`,
        ).toBe(derived === stage);
      }
    }
  });
});

describe("deriveAdmissionStage", () => {
  it("treats no passed exam as Entrance Examination", () => {
    expect(deriveAdmissionStage({ hasPassedExam: false })).toBe("EXAM");
  });

  it("treats a passed exam as COR / Enrollment", () => {
    expect(deriveAdmissionStage({ hasPassedExam: true })).toBe("COR");
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
