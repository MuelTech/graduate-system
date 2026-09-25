import { describe, expect, it } from "vitest";
import {
  ADVISER_CANDIDATE_ROLES,
  evaluateCandidateEligibility,
  evaluateTitleDefenseGate,
  isAdviserCandidateRole,
  isOpenAdviserRequest,
  isRetryableClosedRequest,
} from "./adviser-request.rules";

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
  it("rejects Facilitator and Rapporteur", () => {
    expect(
      evaluateCandidateEligibility({
        defenseRole: "FACILITATOR",
        userIsActive: true,
      }).eligible,
    ).toBe(false);
    expect(
      evaluateCandidateEligibility({
        defenseRole: "RAPPORTEUR",
        userIsActive: true,
      }).eligible,
    ).toBe(false);
  });

  it("accepts active Chairman and Panelist", () => {
    expect(
      evaluateCandidateEligibility({
        defenseRole: "CHAIRMAN",
        userIsActive: true,
        panelistIsActive: true,
        isAvailableAsAdviser: true,
      }).eligible,
    ).toBe(true);
    expect(
      evaluateCandidateEligibility({
        defenseRole: "PANELIST",
        userIsActive: true,
      }).eligible,
    ).toBe(true);
  });

  it("rejects inactive user/panelist or unavailable adviser", () => {
    expect(
      evaluateCandidateEligibility({
        defenseRole: "PANELIST",
        userIsActive: false,
      }).eligible,
    ).toBe(false);
    expect(
      evaluateCandidateEligibility({
        defenseRole: "PANELIST",
        userIsActive: true,
        panelistIsActive: false,
      }).eligible,
    ).toBe(false);
    expect(
      evaluateCandidateEligibility({
        defenseRole: "PANELIST",
        userIsActive: true,
        isAvailableAsAdviser: false,
      }).eligible,
    ).toBe(false);
  });
});

describe("request path open / retry", () => {
  it("open while waiting for Adviser or Dean", () => {
    expect(
      isOpenAdviserRequest({ adviserStatus: "PENDING", deanStatus: "PENDING" }),
    ).toBe(true);
    expect(
      isOpenAdviserRequest({
        adviserStatus: "CONFORMED",
        deanStatus: "PENDING",
      }),
    ).toBe(true);
  });

  it("allows retry after Adviser DECLINED or Dean REJECTED", () => {
    expect(
      isRetryableClosedRequest({
        adviserStatus: "DECLINED",
        deanStatus: "PENDING",
      }),
    ).toBe(true);
    expect(
      isRetryableClosedRequest({
        adviserStatus: "CONFORMED",
        deanStatus: "REJECTED",
      }),
    ).toBe(true);
    expect(
      isOpenAdviserRequest({
        adviserStatus: "DECLINED",
        deanStatus: "PENDING",
      }),
    ).toBe(false);
    expect(
      isOpenAdviserRequest({
        adviserStatus: "CONFORMED",
        deanStatus: "REJECTED",
      }),
    ).toBe(false);
  });
});
