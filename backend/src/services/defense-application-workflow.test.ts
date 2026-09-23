import { describe, expect, it } from "vitest";
import {
  canCreateDefenseSchedule,
  canShowAssignSchedule,
  canShowCurrentSessionPanel,
  deriveApplicationWorkflowBucket,
  filterDocumentsForStage,
  findBlockingScheduleForScheduling,
  hasActiveCurrentStageSchedule,
  hasCurrentStageConclusion,
  isHistoricalDefenseRecord,
  matchesStatusRefine,
  pickActiveCurrentStageSchedule,
  resolveDisplayStatus,
} from "./defense-application-workflow";

const sched = (
  id: string,
  defenseType: string,
  sessionStatus: string,
  createdAt = "2026-09-01T00:00:00Z",
) => ({ id, defenseType, sessionStatus, createdAt });

describe("deriveApplicationWorkflowBucket", () => {
  it("APPROVED + no current-stage schedule => READY", () => {
    expect(
      deriveApplicationWorkflowBucket({
        applicationStatus: "APPROVED",
        stage: "TITLE",
        schedules: [],
      }),
    ).toBe("READY");
  });

  it("APPROVED + existing current-stage SCHEDULED schedule => ACTIVE (not READY)", () => {
    const schedules = [sched("s1", "TITLE_DEFENSE", "SCHEDULED")];
    const bucket = deriveApplicationWorkflowBucket({
      applicationStatus: "APPROVED",
      stage: "TITLE",
      schedules,
    });
    expect(bucket).toBe("ACTIVE");
    expect(canShowAssignSchedule(bucket)).toBe(false);
  });

  it("current Proposal + old concluded Title schedule + no Proposal schedule => READY", () => {
    const schedules = [
      sched("title-old", "TITLE_DEFENSE", "CONCLUDED", "2026-07-01T00:00:00Z"),
    ];
    const bucket = deriveApplicationWorkflowBucket({
      applicationStatus: "APPROVED",
      stage: "PROPOSAL",
      schedules,
    });
    expect(bucket).toBe("READY");
    expect(hasActiveCurrentStageSchedule("PROPOSAL", schedules)).toBe(false);
  });

  it("current Final + old Title/Proposal concluded + no Final schedule => READY", () => {
    const schedules = [
      sched("title-old", "TITLE_DEFENSE", "CONCLUDED", "2026-06-01T00:00:00Z"),
      sched("prop-old", "PROPOSAL_DEFENSE", "CONCLUDED", "2026-08-01T00:00:00Z"),
    ];
    expect(
      deriveApplicationWorkflowBucket({
        applicationStatus: "APPROVED",
        stage: "FINAL",
        schedules,
      }),
    ).toBe("READY");
  });

  it("SCHEDULED / IN_PROGRESS / AWAITING_CONCLUSION current-stage session => ACTIVE", () => {
    for (const sessionStatus of [
      "SCHEDULED",
      "IN_PROGRESS",
      "AWAITING_CONCLUSION",
    ]) {
      const bucket = deriveApplicationWorkflowBucket({
        applicationStatus: "SCHEDULED",
        stage: "TITLE",
        schedules: [sched("s1", "TITLE_DEFENSE", sessionStatus)],
      });
      expect(bucket).toBe("ACTIVE");
      expect(canShowAssignSchedule(bucket)).toBe(false);
      expect(canShowCurrentSessionPanel(bucket, true)).toBe(true);
    }
  });

  it("concluded current-stage defense => HISTORY", () => {
    expect(
      deriveApplicationWorkflowBucket({
        applicationStatus: "PASSED",
        stage: "TITLE",
        schedules: [sched("s1", "TITLE_DEFENSE", "CONCLUDED")],
      }),
    ).toBe("HISTORY");
  });

  it("PENDING => NEEDS_REVIEW", () => {
    expect(
      deriveApplicationWorkflowBucket({
        applicationStatus: "PENDING",
        stage: "TITLE",
        schedules: [],
      }),
    ).toBe("NEEDS_REVIEW");
  });

  it("REJECTED => HISTORY", () => {
    expect(
      deriveApplicationWorkflowBucket({
        applicationStatus: "REJECTED",
        stage: "TITLE",
        schedules: [],
      }),
    ).toBe("HISTORY");
  });

  it("cancelled current-stage schedule does not make READY look scheduled", () => {
    expect(
      deriveApplicationWorkflowBucket({
        applicationStatus: "APPROVED",
        stage: "TITLE",
        schedules: [sched("s1", "TITLE_DEFENSE", "CANCELLED")],
      }),
    ).toBe("READY");
  });

  it("UI invariant: never Assign + active session together", () => {
    const cases = [
      { applicationStatus: "APPROVED", stage: "TITLE" as const, schedules: [] },
      {
        applicationStatus: "APPROVED",
        stage: "TITLE" as const,
        schedules: [sched("s1", "TITLE_DEFENSE", "SCHEDULED")],
      },
      {
        applicationStatus: "SCHEDULED",
        stage: "TITLE" as const,
        schedules: [sched("s1", "TITLE_DEFENSE", "AWAITING_CONCLUSION")],
      },
    ];
    for (const c of cases) {
      const bucket = deriveApplicationWorkflowBucket(c);
      const hasActive = hasActiveCurrentStageSchedule(c.stage, c.schedules);
      const showAssign = canShowAssignSchedule(bucket);
      const showSession = canShowCurrentSessionPanel(bucket, hasActive);
      expect(showAssign && showSession).toBe(false);
    }
  });
});

describe("pickActiveCurrentStageSchedule", () => {
  it("ignores prior-stage and cancelled sessions", () => {
    const schedules = [
      sched("title", "TITLE_DEFENSE", "SCHEDULED"),
      sched("prop-cancelled", "PROPOSAL_DEFENSE", "CANCELLED"),
    ];
    expect(pickActiveCurrentStageSchedule("PROPOSAL", schedules)).toBe(null);
    expect(pickActiveCurrentStageSchedule("TITLE", schedules)?.id).toBe(
      "title",
    );
  });
});

describe("canCreateDefenseSchedule", () => {
  it("allows first scheduling", () => {
    expect(
      canCreateDefenseSchedule({
        defenseType: "TITLE_DEFENSE",
        schedules: [sched("old", "TITLE_DEFENSE", "CANCELLED")],
      }).allowed,
    ).toBe(true);
  });

  it("rejects a second non-cancelled schedule for the same defense type", () => {
    const schedules = [sched("s1", "TITLE_DEFENSE", "SCHEDULED")];
    const result = canCreateDefenseSchedule({
      defenseType: "TITLE_DEFENSE",
      schedules,
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/already exists/i);
    expect(findBlockingScheduleForScheduling("TITLE_DEFENSE", schedules)?.id).toBe(
      "s1",
    );
  });

  it("allows a later stage even when prior stage has a concluded schedule", () => {
    expect(
      canCreateDefenseSchedule({
        defenseType: "PROPOSAL_DEFENSE",
        schedules: [sched("title", "TITLE_DEFENSE", "CONCLUDED")],
      }).allowed,
    ).toBe(true);
  });
});

describe("isHistoricalDefenseRecord", () => {
  it("keeps concluded defenses in History after ThesisRecord advances", () => {
    // Title CONCLUDED + ThesisRecord.stage now PROPOSAL → Title stays history.
    expect(
      isHistoricalDefenseRecord({
        sessionStatus: "CONCLUDED",
        hasConclusion: true,
      }),
    ).toBe(true);
    // Current Proposal bucket is READY (not polluted by Title history).
    expect(
      deriveApplicationWorkflowBucket({
        applicationStatus: "APPROVED",
        stage: "PROPOSAL",
        schedules: [sched("title", "TITLE_DEFENSE", "CONCLUDED")],
      }),
    ).toBe("READY");
  });
});

describe("resolveDisplayStatus", () => {
  it("maps each bucket to a stable display status", () => {
    expect(
      resolveDisplayStatus({
        workflowBucket: "NEEDS_REVIEW",
        applicationStatus: "PENDING",
      }),
    ).toBe("PENDING");
    expect(
      resolveDisplayStatus({
        workflowBucket: "READY",
        applicationStatus: "APPROVED",
      }),
    ).toBe("APPROVED");
    expect(
      resolveDisplayStatus({
        workflowBucket: "ACTIVE",
        applicationStatus: "APPROVED",
      }),
    ).toBe("SCHEDULED");
    expect(
      resolveDisplayStatus({
        workflowBucket: "HISTORY",
        applicationStatus: "REJECTED",
      }),
    ).toBe("REJECTED");
    expect(
      resolveDisplayStatus({
        workflowBucket: "HISTORY",
        applicationStatus: "PASSED",
        outcome: "REVISION_REQUIRED",
      }),
    ).toBe("REVISION");
    expect(
      resolveDisplayStatus({
        workflowBucket: "HISTORY",
        applicationStatus: "PASSED",
        outcome: "PASSED",
      }),
    ).toBe("PASSED");
  });
});

describe("matchesStatusRefine", () => {
  it("ANDs status refine with the tab bucket instead of re-bucketing", () => {
    expect(matchesStatusRefine("REJECTED", "REJECTED")).toBe(true);
    expect(matchesStatusRefine("PASSED", "REJECTED")).toBe(false);
    expect(matchesStatusRefine("PASSED", "ALL")).toBe(true);
    expect(matchesStatusRefine("PASSED", undefined)).toBe(true);
  });
});

describe("filterDocumentsForStage", () => {
  const docs = [
    { id: "1", docType: "RECEIPT", defenseStage: "TITLE" },
    { id: "2", docType: "RECEIPT", defenseStage: "PROPOSAL" },
    { id: "3", docType: "PROPOSAL_CHAPTERS", defenseStage: "PROPOSAL" },
    { id: "4", docType: "FINAL_MANUSCRIPT", defenseStage: "FINAL" },
    { id: "5", docType: "COR", defenseStage: "TITLE" },
  ];

  it("Title history row does not include Proposal or Final docs", () => {
    const title = filterDocumentsForStage(docs, "TITLE");
    expect(title.map((d) => d.id).sort()).toEqual(["1", "5"]);
    expect(title.every((d) => d.defenseStage === "TITLE")).toBe(true);
  });

  it("Proposal history row does not include Title or Final docs", () => {
    const proposal = filterDocumentsForStage(docs, "PROPOSAL");
    expect(proposal.map((d) => d.id).sort()).toEqual(["2", "3"]);
    expect(proposal.every((d) => d.defenseStage === "PROPOSAL")).toBe(true);
  });

  it("Final history row only has Final docs", () => {
    const final = filterDocumentsForStage(docs, "FINAL");
    expect(final.map((d) => d.id)).toEqual(["4"]);
    expect(final.every((d) => d.defenseStage === "FINAL")).toBe(true);
  });
});

describe("hasCurrentStageConclusion", () => {
  const titleConcluded = {
    id: "t",
    defenseType: "TITLE_DEFENSE",
    sessionStatus: "CONCLUDED",
    createdAt: "2026-07-01T00:00:00Z",
  };
  const proposalConcluded = {
    id: "p",
    defenseType: "PROPOSAL_DEFENSE",
    sessionStatus: "CONCLUDED",
    createdAt: "2026-08-01T00:00:00Z",
  };
  const finalActive = {
    id: "f",
    defenseType: "FINAL_DEFENSE",
    sessionStatus: "SCHEDULED",
    createdAt: "2026-09-01T00:00:00Z",
  };

  it("PROPOSAL PENDING + prior Title CONCLUDED is not a current-stage conclusion", () => {
    expect(hasCurrentStageConclusion("PROPOSAL", [titleConcluded])).toBe(false);
  });

  it("FINAL + prior Title/Proposal concluded is not a current-stage conclusion", () => {
    expect(
      hasCurrentStageConclusion("FINAL", [titleConcluded, proposalConcluded]),
    ).toBe(false);
  });

  it("PROPOSAL + current PROPOSAL concluded blocks review", () => {
    expect(hasCurrentStageConclusion("PROPOSAL", [proposalConcluded])).toBe(
      true,
    );
    expect(
      hasCurrentStageConclusion("PROPOSAL", [
        titleConcluded,
        proposalConcluded,
      ]),
    ).toBe(true);
  });

  it("FINAL active session is not concluded (active lock uses hasActiveCurrentStageSchedule)", () => {
    expect(hasCurrentStageConclusion("FINAL", [finalActive])).toBe(false);
    expect(hasActiveCurrentStageSchedule("FINAL", [finalActive])).toBe(true);
  });
});
