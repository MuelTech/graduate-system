import { describe, expect, it } from "vitest";
import {
  ADVISER_CANDIDATE_ROLES,
  evaluateAdviserResponseTransition,
  evaluateCandidateEligibility,
  evaluateDeanResponseTransition,
  evaluateTitleDefenseGate,
  isAdviserCandidateRole,
  isOpenAdviserRequest,
  isRetryableClosedRequest,
  isFinalApprovedRequest,
  mapAdviserResponseToOverallStatus,
  mapDeanDecisionToOverallStatus,
} from "../../../src/services/adviser-request.rules";
import {
  evaluateStudentThesisJourney,
  type JourneySnapshot,
} from "../../../src/services/student-thesis-journey.rules";
import { isTitleStageComplete } from "../../../src/services/stage-completion";

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
      hasFinalizedTitleRap: false,
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
      hasFinalizedTitleRap: true,
    });
    expect(r.allowed).toBe(false);
    if (!r.allowed) {
      expect(r.reason).toMatch(/official selected title/i);
    }
  });

  it("CP1: rejects PASSED + selected title when Title RAP is not finalized", () => {
    const r = evaluateTitleDefenseGate({
      hasPassedTitleConclusion: true,
      hasOfficialSelectedTitle: true,
      hasFinalizedTitleRap: false,
    });
    expect(r.allowed).toBe(false);
    if (!r.allowed) {
      expect(r.reason).toMatch(/Title RAP/i);
      expect(r.reason).not.toMatch(/formally PASSED Title Defense conclusion/i);
    }
  });

  it("allows when formal PASSED + selected title + finalized Title RAP exist", () => {
    expect(
      evaluateTitleDefenseGate({
        hasPassedTitleConclusion: true,
        hasOfficialSelectedTitle: true,
        hasFinalizedTitleRap: true,
      }).allowed,
    ).toBe(true);
  });
});

describe("CP1 Journey / GS-020 consistency", () => {
  function journeySnap(over: Partial<JourneySnapshot>): JourneySnapshot {
    return {
      compExamPassed: true,
      titlePassed: false,
      selectedTitleId: null,
      selectedTitleText: null,
      titleRapFinalized: false,
      titleAdminState: "NONE",
      adviserRequest: null,
      activeAdviser: null,
      proposalPassed: false,
      proposalRapFinalized: false,
      proposalAdminState: "NONE",
      strikeEligible: false,
      strikeRequired: false,
      finalPassed: false,
      finalAdminState: "NONE",
      ...over,
    };
  }

  function adviserUnlockedInJourney(snap: JourneySnapshot): boolean {
    const dto = evaluateStudentThesisJourney(snap);
    const step = dto.steps.find((s) => s.key === "ADVISER_REQUEST");
    return step != null && step.state !== "LOCKED";
  }

  function gs020Allows(input: {
    hasPassedTitleConclusion: boolean;
    hasOfficialSelectedTitle: boolean;
    hasFinalizedTitleRap: boolean;
  }): boolean {
    return evaluateTitleDefenseGate(input).allowed;
  }

  const cases = [
    {
      name: "PASSED + title + RAP not finalized",
      snap: journeySnap({
        titlePassed: true,
        selectedTitleId: "t",
        selectedTitleText: "T",
        titleRapFinalized: false,
      }),
      gate: {
        hasPassedTitleConclusion: true,
        hasOfficialSelectedTitle: true,
        hasFinalizedTitleRap: false,
      },
    },
    {
      name: "PASSED + title + RAP finalized",
      snap: journeySnap({
        titlePassed: true,
        selectedTitleId: "t",
        selectedTitleText: "T",
        titleRapFinalized: true,
      }),
      gate: {
        hasPassedTitleConclusion: true,
        hasOfficialSelectedTitle: true,
        hasFinalizedTitleRap: true,
      },
    },
    {
      name: "not PASSED + title + RAP finalized",
      snap: journeySnap({
        titlePassed: false,
        selectedTitleId: "t",
        selectedTitleText: "T",
        titleRapFinalized: true,
      }),
      gate: {
        hasPassedTitleConclusion: false,
        hasOfficialSelectedTitle: true,
        hasFinalizedTitleRap: true,
      },
    },
    {
      name: "PASSED + no title + RAP finalized",
      snap: journeySnap({
        titlePassed: true,
        selectedTitleId: null,
        selectedTitleText: null,
        titleRapFinalized: true,
      }),
      gate: {
        hasPassedTitleConclusion: true,
        hasOfficialSelectedTitle: false,
        hasFinalizedTitleRap: true,
      },
    },
  ];

  for (const c of cases) {
    it(`agrees on Adviser Request availability: ${c.name}`, () => {
      const journey = adviserUnlockedInJourney(c.snap);
      const gs020 = gs020Allows(c.gate);
      expect(journey, "journey vs GS-020 must agree").toBe(gs020);
      expect(isTitleStageComplete({
        outcome: c.snap.titlePassed ? "PASSED" : null,
        hasSelectedTitle: Boolean(c.snap.selectedTitleId),
        titleRapFinalized: c.snap.titleRapFinalized,
      })).toBe(gs020);
    });
  }
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

  it("rejects external Panelists even when marked available as adviser", () => {
    const external = evaluateCandidateEligibility({
      ...validPanelist,
      isExternal: true,
    });
    expect(external.eligible).toBe(false);
    if (!external.eligible) {
      expect(external.reason).toMatch(/External panelists/i);
    }

    const externalAvailable = evaluateCandidateEligibility({
      ...validPanelist,
      isExternal: true,
      isAvailableAsAdviser: true,
    });
    expect(externalAvailable.eligible).toBe(false);
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

describe("evaluateDeanResponseTransition", () => {
  const conformed = {
    adviserStatus: "CONFORMED",
    deanStatus: "PENDING",
    overallStatus: "PENDING",
  };

  it("allows APPROVED and REJECTED only after CONFORME", () => {
    expect(
      evaluateDeanResponseTransition({ ...conformed, decision: "APPROVED" })
        .allowed,
    ).toBe(true);
    expect(
      evaluateDeanResponseTransition({ ...conformed, decision: "REJECTED" })
        .allowed,
    ).toBe(true);
  });

  it("rejects before Adviser CONFORME", () => {
    const r = evaluateDeanResponseTransition({
      decision: "APPROVED",
      adviserStatus: "PENDING",
      deanStatus: "PENDING",
      overallStatus: "PENDING",
    });
    expect(r.allowed).toBe(false);
    if (!r.allowed) expect(r.statusCode).toBe(409);
  });

  it("rejects when adviser DECLINED or Dean already decided", () => {
    expect(
      evaluateDeanResponseTransition({
        decision: "APPROVED",
        adviserStatus: "DECLINED",
        deanStatus: "PENDING",
        overallStatus: "REJECTED",
      }).allowed,
    ).toBe(false);
    expect(
      evaluateDeanResponseTransition({
        ...conformed,
        deanStatus: "APPROVED",
        decision: "REJECTED",
      }).allowed,
    ).toBe(false);
    expect(
      evaluateDeanResponseTransition({
        ...conformed,
        deanStatus: "REJECTED",
        decision: "APPROVED",
      }).allowed,
    ).toBe(false);
  });

  it("rejects invalid decision and maps overall status", () => {
    const bad = evaluateDeanResponseTransition({
      ...conformed,
      decision: "MAYBE",
    });
    expect(bad.allowed).toBe(false);
    if (!bad.allowed) expect(bad.statusCode).toBe(400);

    expect(mapDeanDecisionToOverallStatus("APPROVED")).toBe("APPROVED");
    expect(mapDeanDecisionToOverallStatus("REJECTED")).toBe("REJECTED");
  });
});
