import { describe, expect, it } from "vitest";
import {
  buildApplicantListWhere,
  deriveAdmissionStage,
  hasAuthoritativePassedExam,
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

  it("COR / Enrollment requires an authoritative PASSED exam", () => {
    const where = buildApplicantListWhere({ stage: "COR" });
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
