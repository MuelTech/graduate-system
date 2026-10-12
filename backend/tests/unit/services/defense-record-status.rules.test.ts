import { describe, expect, it } from "vitest";
import { deriveDefenseRecordStatus } from "../../../src/services/defense-record-status.rules";

/**
 * UIUX-2M: Admin Defense Records Record Status is a stage-aware UI completion
 * projection derived ONLY from existing authoritative fields. It never infers a
 * result from scores/session state and never rewrites sessionStatus.
 */
describe("deriveDefenseRecordStatus", () => {
  it("active session (not concluded) -> In Progress", () => {
    const r = deriveDefenseRecordStatus({
      defenseType: "PROPOSAL_DEFENSE",
      sessionStatus: "SCHEDULED",
      formalResult: null,
      summaryReady: false,
      rapStatus: null,
    });
    expect(r.status).toBe("IN_PROGRESS");
  });

  it("CONCLUDED session is treated as concluded even without a formal result", () => {
    const r = deriveDefenseRecordStatus({
      defenseType: "TITLE_DEFENSE",
      sessionStatus: "CONCLUDED",
      formalResult: null,
      summaryReady: false,
      rapStatus: null,
    });
    expect(r.status).toBe("AWAITING_COMPLETION");
  });

  it("Title concluded + RAP finalized -> Complete (no numerical summary needed)", () => {
    const r = deriveDefenseRecordStatus({
      defenseType: "TITLE_DEFENSE",
      sessionStatus: "CONCLUDED",
      formalResult: "PASSED",
      summaryReady: false,
      rapStatus: "FINALIZED",
    });
    expect(r.status).toBe("COMPLETE");
  });

  it("Title concluded + RAP not finalized -> Awaiting Completion", () => {
    const r = deriveDefenseRecordStatus({
      defenseType: "TITLE_DEFENSE",
      sessionStatus: "CONCLUDED",
      formalResult: "PASSED",
      summaryReady: false,
      rapStatus: "FOR_SIGNATURE",
    });
    expect(r.status).toBe("AWAITING_COMPLETION");
  });

  it("Proposal concluded + summary ready + RAP finalized -> Complete", () => {
    const r = deriveDefenseRecordStatus({
      defenseType: "PROPOSAL_DEFENSE",
      sessionStatus: "CONCLUDED",
      formalResult: "PASSED",
      summaryReady: true,
      rapStatus: "FINALIZED",
    });
    expect(r.status).toBe("COMPLETE");
  });

  it("Proposal concluded + summary ready + RAP awaiting signatures -> Awaiting Completion", () => {
    const r = deriveDefenseRecordStatus({
      defenseType: "PROPOSAL_DEFENSE",
      sessionStatus: "CONCLUDED",
      formalResult: "PASSED",
      summaryReady: true,
      rapStatus: "FOR_SIGNATURE",
    });
    expect(r.status).toBe("AWAITING_COMPLETION");
    expect(r.detail.toLowerCase()).toContain("rap");
  });

  it("Proposal concluded + summary not ready + RAP finalized -> Awaiting Completion", () => {
    const r = deriveDefenseRecordStatus({
      defenseType: "PROPOSAL_DEFENSE",
      sessionStatus: "CONCLUDED",
      formalResult: "PASSED",
      summaryReady: false,
      rapStatus: "FINALIZED",
    });
    expect(r.status).toBe("AWAITING_COMPLETION");
    expect(r.detail.toLowerCase()).toContain("summary");
  });

  it("Proposal concluded + summary not ready + RAP not finalized -> Awaiting Completion", () => {
    const r = deriveDefenseRecordStatus({
      defenseType: "FINAL_DEFENSE",
      sessionStatus: "CONCLUDED",
      formalResult: "FAILED",
      summaryReady: false,
      rapStatus: null,
    });
    expect(r.status).toBe("AWAITING_COMPLETION");
  });

  it("ALL_SIGNED RAP is not yet finalized -> Awaiting Completion", () => {
    const r = deriveDefenseRecordStatus({
      defenseType: "FINAL_DEFENSE",
      sessionStatus: "CONCLUDED",
      formalResult: "PASSED",
      summaryReady: true,
      rapStatus: "ALL_SIGNED",
    });
    expect(r.status).toBe("AWAITING_COMPLETION");
  });

  it("never returns a result-like status; only completion states", () => {
    const allowed = ["IN_PROGRESS", "AWAITING_COMPLETION", "COMPLETE"];
    for (const defenseType of ["TITLE_DEFENSE", "PROPOSAL_DEFENSE", "FINAL_DEFENSE"]) {
      const r = deriveDefenseRecordStatus({
        defenseType,
        sessionStatus: "CONCLUDED",
        formalResult: "PASSED",
        summaryReady: true,
        rapStatus: "FINALIZED",
      });
      expect(allowed).toContain(r.status);
      expect(r.detail.length).toBeGreaterThan(0);
    }
  });
});
