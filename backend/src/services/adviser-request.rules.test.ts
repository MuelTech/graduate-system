import { describe, expect, it } from "vitest";
import {
  ADVISER_CANDIDATE_ROLES,
  evaluateAdviserResponseTransition,
  evaluateCandidateEligibility,
  evaluateTitleDefenseGate,
  isAdviserCandidateRole,
  isOpenAdviserRequest,
  isRetryableClosedRequest,
  isFinalApprovedRequest,
  mapAdviserResponseToOverallStatus,
} from "./adviser-request.rules";

const validPanelist = {
  defenseRole: "PANELIST",
  userRole: "PANELIST",
  userIsActive: true,
  hasPanelistProfile: true,
  panelistIsActive: true,
  isAvailableAsAdviser: true,
};

describe("ADVISER_CANDIDATE_ROLES", () => {
  it("includes Chairman and Panelist only", () => {
    expect([...ADVISER_CANDIDATE_ROLES]).toEqual(["CHAIRMAN", "PANELIST"]);
    expect(isAdviserCandidateRole("CHAIRMAN")).toBe(true);
    expect(isAdviserCandidateRole("PANELIST")).toBe(true);
    expect(isAdviserCandidateRole("FACILITATOR")).toBe(false);
    expect(isAdviserCandidateRole("RAPPORTEUR")).toBe(false);
    expect(isAdviserCandidateRole("ADVISER")).toBe(false);
  });
});

describe("evaluateTitleDefenseGate", () => {
  it("rejects when there is no formal passed Title Defense conclusion", () => {
    const r = evaluateTitleDefenseGate({
      hasPassedTitleConclusion: false,
      hasOfficialSelectedTitle: false,
    });
    expect(r.allowed).toBe(false);
    if (!r.allowed) {
      expect(r.statusCode).toBe(400);
      expect(r.reason).toMatch(/formally PASSED Title Defense/i);
    }
  });

  it("rejects when conclusion exists but no official selected title", () => {
    const r = evaluateTitleDefenseGate({
      hasPassedTitleConclusion: true,
      hasOfficialSelectedTitle: false,
    });
    expect(r.allowed).toBe(false);
    if (!r.allowed) {
      expect(r.reason).toMatch(/official selected title/i);
    }
  });

  it("allows when both formal PASSED and selected title exist", () => {
    expect(
      evaluateTitleDefenseGate({
        hasPassedTitleConclusion: true,
        hasOfficialSelectedTitle: true,
      }).allowed,
    ).toBe(true);
  });
});

describe("evaluateCandidateEligibility", () => {
  it("rejects Facilitator and Rapporteur with explicit role error", () => {
    const fac = evaluateCandidateEligibility({
      ...validPanelist,
      defenseRole: "FACILITATOR",
    });
    expect(fac.eligible).toBe(false);
    if (!fac.eligible) expect(fac.reason).toMatch(/FACILITATOR/);

    const rap = evaluateCandidateEligibility({
      ...validPanelist,
      defenseRole: "RAPPORTEUR",
    });
    expect(rap.eligible).toBe(false);
    if (!rap.eligible) expect(rap.reason).toMatch(/RAPPORTEUR/);
  });

  it("rejects CHAIRMAN/PANELIST seat when User.role is not PANELIST", () => {
    const r = evaluateCandidateEligibility({
      ...validPanelist,
      defenseRole: "CHAIRMAN",
      userRole: "ADMIN",
    });
    expect(r.eligible).toBe(false);
    if (!r.eligible) expect(r.reason).toMatch(/PANELIST user role/i);
  });

  it("rejects CHAIRMAN/PANELIST seat with no Panelist profile", () => {
    const r = evaluateCandidateEligibility({
      ...validPanelist,
      hasPanelistProfile: false,
      panelistIsActive: null,
      isAvailableAsAdviser: null,
    });
    expect(r.eligible).toBe(false);
    if (!r.eligible) expect(r.reason).toMatch(/Panelist profile/i);
  });

  it("rejects inactive Panelist profile and isAvailableAsAdviser=false", () => {
    expect(
      evaluateCandidateEligibility({
        ...validPanelist,
        panelistIsActive: false,
      }).eligible,
    ).toBe(false);
    expect(
      evaluateCandidateEligibility({
        ...validPanelist,
        isAvailableAsAdviser: false,
      }).eligible,
    ).toBe(false);
  });

  it("rejects inactive User", () => {
    expect(
      evaluateCandidateEligibility({
        ...validPanelist,
        userIsActive: false,
      }).eligible,
    ).toBe(false);
  });

  it("accepts valid active PANELIST profile as Chairman or Panelist", () => {
    expect(
      evaluateCandidateEligibility({
        ...validPanelist,
        defenseRole: "CHAIRMAN",
      }).eligible,
    ).toBe(true);
    expect(evaluateCandidateEligibility(validPanelist).eligible).toBe(true);
  });
});

describe("request path open / retry (including legacy RequestStatus)", () => {
  it("blocks status=PENDING + adviser PENDING", () => {
    expect(
      isOpenAdviserRequest({
        status: "PENDING",
        adviserStatus: "PENDING",
        deanStatus: "PENDING",
      }),
    ).toBe(true);
  });

  it("blocks status=PENDING + CONFORMED waiting for Dean", () => {
    expect(
      isOpenAdviserRequest({
        status: "PENDING",
        adviserStatus: "CONFORMED",
        deanStatus: "PENDING",
      }),
    ).toBe(true);
  });

  it("legacy status=REJECTED with default PENDING statuses allows retry", () => {
    const row = {
      status: "REJECTED",
      adviserStatus: "PENDING",
      deanStatus: "PENDING",
    };
    expect(isOpenAdviserRequest(row)).toBe(false);
    expect(isRetryableClosedRequest(row)).toBe(true);
  });

  it("legacy status=APPROVED with default PENDING statuses is not open and not retryable", () => {
    const row = {
      status: "APPROVED",
      adviserStatus: "PENDING",
      deanStatus: "PENDING",
    };
    expect(isOpenAdviserRequest(row)).toBe(false);
    expect(isRetryableClosedRequest(row)).toBe(false);
    expect(isFinalApprovedRequest(row)).toBe(true);
  });

  it("allows retry after Adviser DECLINED or Dean REJECTED", () => {
    expect(
      isRetryableClosedRequest({
        status: "REJECTED",
        adviserStatus: "DECLINED",
        deanStatus: "PENDING",
      }),
    ).toBe(true);
    expect(
      isOpenAdviserRequest({
        status: "PENDING",
        adviserStatus: "DECLINED",
        deanStatus: "PENDING",
      }),
    ).toBe(false);
    expect(
      isOpenAdviserRequest({
        status: "PENDING",
        adviserStatus: "CONFORMED",
        deanStatus: "REJECTED",
      }),
    ).toBe(false);
  });

  it("legacy APPROVED is closed but NOT retryable", () => {
    const row = {
      status: "APPROVED",
      adviserStatus: "PENDING",
      deanStatus: "PENDING",
    };
    expect(isOpenAdviserRequest(row)).toBe(false);
    expect(isRetryableClosedRequest(row)).toBe(false);
    expect(isFinalApprovedRequest(row)).toBe(true);
  });
});

describe("evaluateAdviserResponseTransition", () => {
  const base = {
    requestedAdviserId: "adv-1",
    authenticatedUserId: "adv-1",
    adviserStatus: "PENDING",
    deanStatus: "PENDING",
    overallStatus: "PENDING",
  };

  it("rejects another adviser with 403", () => {
    const r = evaluateAdviserResponseTransition({
      ...base,
      authenticatedUserId: "other",
      decision: "CONFORMED",
    });
    expect(r.allowed).toBe(false);
    if (!r.allowed) expect(r.statusCode).toBe(403);
  });

  it("rejects invalid decision with 400", () => {
    const r = evaluateAdviserResponseTransition({
      ...base,
      decision: "MAYBE",
    });
    expect(r.allowed).toBe(false);
    if (!r.allowed) expect(r.statusCode).toBe(400);
  });

  it("allows PENDING → CONFORMED and PENDING → DECLINED", () => {
    expect(
      evaluateAdviserResponseTransition({ ...base, decision: "CONFORMED" })
        .allowed,
    ).toBe(true);
    expect(
      evaluateAdviserResponseTransition({ ...base, decision: "DECLINED" })
        .allowed,
    ).toBe(true);
  });

  it("rejects repeat response after CONFORMED or DECLINED", () => {
    expect(
      evaluateAdviserResponseTransition({
        ...base,
        adviserStatus: "CONFORMED",
        decision: "DECLINED",
      }).allowed,
    ).toBe(false);
    expect(
      evaluateAdviserResponseTransition({
        ...base,
        adviserStatus: "DECLINED",
        decision: "CONFORMED",
      }).allowed,
    ).toBe(false);
  });

  it("rejects response after Dean finalized request", () => {
    const approved = evaluateAdviserResponseTransition({
      ...base,
      deanStatus: "APPROVED",
      decision: "DECLINED",
    });
    expect(approved.allowed).toBe(false);
    if (!approved.allowed) expect(approved.statusCode).toBe(409);

    const rejected = evaluateAdviserResponseTransition({
      ...base,
      overallStatus: "REJECTED",
      decision: "CONFORMED",
    });
    expect(rejected.allowed).toBe(false);
    if (!rejected.allowed) expect(rejected.statusCode).toBe(409);
  });

  it("maps CONFORMED to overall PENDING and DECLINED to overall REJECTED", () => {
    expect(mapAdviserResponseToOverallStatus("CONFORMED")).toBe("PENDING");
    expect(mapAdviserResponseToOverallStatus("DECLINED")).toBe("REJECTED");
  });
});
