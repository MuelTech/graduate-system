import { describe, expect, it } from "vitest";
import {
  canUnlockFinal,
  canUnlockProposal,
  computeStageCompletion,
  isProposalStageComplete,
  isTitleStageComplete,
} from "../../../src/services/stage-completion";

describe("stage completion (derived)", () => {
  it("Title is complete only with PASSED + selected title + finalized Title RAP", () => {
    expect(
      isTitleStageComplete({
        outcome: "PASSED",
        hasSelectedTitle: true,
        titleRapFinalized: true,
      }),
    ).toBe(true);

    expect(
      isTitleStageComplete({
        outcome: "PASSED",
        hasSelectedTitle: false,
        titleRapFinalized: true,
      }),
    ).toBe(false);

    expect(
      isTitleStageComplete({
        outcome: "PASSED",
        hasSelectedTitle: true,
        titleRapFinalized: false,
      }),
    ).toBe(false);

    // APPROVED-style / no conclusion must not complete Title
    expect(
      isTitleStageComplete({
        outcome: null,
        hasSelectedTitle: true,
        titleRapFinalized: true,
      }),
    ).toBe(false);
  });

  it("REVISION_REQUIRED does not unlock Proposal or Final", () => {
    expect(
      canUnlockProposal({
        outcome: "REVISION_REQUIRED",
        hasSelectedTitle: true,
        titleRapFinalized: true,
      }),
    ).toBe(false);

    expect(
      canUnlockFinal({
        outcome: "REVISION_REQUIRED",
        proposalRapFinalized: true,
      }),
    ).toBe(false);
  });

  it("FAILED does not unlock the next stage", () => {
    expect(
      canUnlockProposal({
        outcome: "FAILED",
        hasSelectedTitle: true,
        titleRapFinalized: true,
      }),
    ).toBe(false);
  });

  it("Proposal complete requires PASSED outcome and finalized Proposal RAP", () => {
    expect(
      isProposalStageComplete({
        outcome: "PASSED",
        proposalRapFinalized: true,
      }),
    ).toBe(true);
    expect(
      isProposalStageComplete({
        outcome: "PASSED",
        proposalRapFinalized: false,
      }),
    ).toBe(false);
  });

  it("CP1: stage-mirror alone does not unlock without formal prior-stage completion", () => {
    // Formal Title completion is required — not ThesisRecord.stage.
    expect(
      canUnlockProposal({
        outcome: null,
        hasSelectedTitle: false,
        titleRapFinalized: false,
      }),
    ).toBe(false);
    expect(
      canUnlockProposal({
        outcome: "PASSED",
        hasSelectedTitle: true,
        titleRapFinalized: true,
      }),
    ).toBe(true);
    expect(
      canUnlockFinal({
        outcome: null,
        proposalRapFinalized: false,
      }),
    ).toBe(false);
    expect(
      canUnlockFinal({
        outcome: "PASSED",
        proposalRapFinalized: true,
      }),
    ).toBe(true);
  });

  it("computeStageCompletion distinguishes post-defense vs complete", () => {
    expect(
      computeStageCompletion("TITLE", {
        stage: "TITLE",
        applicationStatus: "APPROVED",
        outcome: "PASSED",
        hasSelectedTitle: true,
        titleRapFinalized: false,
        proposalRapFinalized: false,
      }),
    ).toBe("POST_DEFENSE_IN_PROGRESS");

    expect(
      computeStageCompletion("TITLE", {
        stage: "TITLE",
        applicationStatus: "APPROVED",
        outcome: "PASSED",
        hasSelectedTitle: true,
        titleRapFinalized: true,
        proposalRapFinalized: false,
      }),
    ).toBe("COMPLETE");

    expect(
      computeStageCompletion("TITLE", {
        stage: "PROPOSAL",
        applicationStatus: "PENDING",
        outcome: null,
        hasSelectedTitle: true,
        titleRapFinalized: true,
        proposalRapFinalized: false,
      }),
    ).toBe("COMPLETE");

    expect(
      computeStageCompletion("TITLE", {
        stage: "TITLE",
        applicationStatus: "PENDING",
        outcome: null,
        hasSelectedTitle: false,
        titleRapFinalized: false,
        proposalRapFinalized: false,
      }),
    ).toBe("APPLICATION_IN_PROGRESS");
  });
});
