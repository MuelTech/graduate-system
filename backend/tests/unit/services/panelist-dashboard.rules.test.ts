import { describe, expect, it } from "vitest";
import {
  buildPanelistDashboard,
  defenseTypeLabel,
  evaluationStatusLabel,
  parseWallClockMs,
  roleLabel,
  sessionStatusLabel,
  stageLabel,
  type DashboardAdviserRequestInput,
  type DashboardAssignmentInput,
  type DashboardRapSlotInput,
  type DashboardReviewTaskInput,
  type DashboardSignedRapSlotInput,
} from "../../../src/services/panelist-dashboard.rules";

/**
 * Fixed wall-clock "now": Oct 8 2026 03:00 server-local.
 * nowWallClockMs uses the server-local components so this is deterministic.
 */
const NOW = new Date(2026, 9, 8, 3, 0, 0);

function assignment(
  overrides: Partial<DashboardAssignmentInput> = {},
): DashboardAssignmentInput {
  return {
    assignmentId: "pa-1",
    role: "PANELIST",
    evaluationStatus: "NONE",
    scheduleId: "sched-1",
    defenseType: "PROPOSAL_DEFENSE",
    sessionStatus: "SCHEDULED",
    defenseDate: "2026-10-20",
    defenseTime: "09:00:00",
    venueOrLink: "Room 101",
    conclusionPresent: false,
    rapporteurNotesFinalized: false,
    oralSummaryReady: false,
    studentName: "Ana Student",
    studentNumber: "2026-1",
    programName: "MIT",
    ...overrides,
  };
}

function rapSlot(
  overrides: Partial<DashboardRapSlotInput> = {},
): DashboardRapSlotInput {
  return {
    id: "sig-1",
    rapId: "rap-1",
    roleAtDefense: "PANELIST",
    defenseType: "PROPOSAL_DEFENSE",
    generatedDate: "2026-10-05",
    studentName: "Ana Student",
    studentNumber: "2026-1",
    ...overrides,
  };
}

function adviserRequest(
  overrides: Partial<DashboardAdviserRequestInput> = {},
): DashboardAdviserRequestInput {
  return {
    id: "req-1",
    studentName: "Ana Student",
    studentNumber: "2026-1",
    officialTitle: "A Title",
    requestDate: "2026-10-01",
    status: "PENDING",
    adviserStatus: "PENDING",
    deanStatus: "PENDING",
    ...overrides,
  };
}

function reviewTask(
  overrides: Partial<DashboardReviewTaskInput> = {},
): DashboardReviewTaskInput {
  return {
    thesisId: "thesis-1",
    studentName: "Ana Student",
    studentNumber: "2026-1",
    officialTitle: "A Title",
    stage: "PROPOSAL",
    reviewStatus: "AWAITING_REVIEW",
    manuscriptUploadedAt: "2026-10-02",
    ...overrides,
  };
}

function signedRap(
  overrides: Partial<DashboardSignedRapSlotInput> = {},
): DashboardSignedRapSlotInput {
  return {
    id: "sig-signed",
    defenseType: "PROPOSAL_DEFENSE",
    studentName: "Ana Student",
    signedDate: "2026-10-04",
    ...overrides,
  };
}

function build(overrides: Partial<Parameters<typeof buildPanelistDashboard>[0]> = {}) {
  return buildPanelistDashboard({
    now: NOW,
    assignments: [],
    pendingRapSlots: [],
    signedRapSlots: [],
    adviserRequests: [],
    proposalReviewTasks: [],
    finalReviewTasks: [],
    ...overrides,
  });
}

describe("panelist-dashboard rules", () => {
  it("1. no assignments → zero KPIs and empty sections", () => {
    const view = build();
    expect(view.kpis).toEqual({ upcomingDefenses: 0, pendingTasks: 0 });
    expect(view.needsAttention).toEqual([]);
    expect(view.activeDefenses).toEqual([]);
    expect(view.upcomingDefenses).toEqual([]);
    expect(view.waitingOnOthers).toEqual([]);
  });

  it("2. counts future scheduled defenses and sorts them chronologically", () => {
    const view = build({
      assignments: [
        assignment({
          assignmentId: "pa-b",
          scheduleId: "sched-b",
          role: "FACILITATOR",
          defenseDate: "2026-10-25",
          defenseTime: "14:00:00",
        }),
        assignment({
          assignmentId: "pa-a",
          scheduleId: "sched-a",
          role: "FACILITATOR",
          defenseDate: "2026-10-20",
          defenseTime: "09:00:00",
        }),
      ],
    });
    expect(view.kpis.upcomingDefenses).toBe(2);
    expect(view.upcomingDefenses.map((d) => d.scheduleId)).toEqual([
      "sched-a",
      "sched-b",
    ]);
    expect(view.needsAttention).toEqual([]);
  });

  it("3. excludes cancelled, concluded, past, in-progress and invalid-date sessions", () => {
    const view = build({
      assignments: [
        assignment({ scheduleId: "s-cancel", role: "FACILITATOR", sessionStatus: "CANCELLED" }),
        assignment({ scheduleId: "s-concl", role: "FACILITATOR", sessionStatus: "CONCLUDED" }),
        assignment({
          scheduleId: "s-past",
          role: "FACILITATOR",
          defenseDate: "2026-10-01",
        }),
        assignment({ scheduleId: "s-active", role: "FACILITATOR", sessionStatus: "IN_PROGRESS" }),
        assignment({ scheduleId: "s-nodate", role: "FACILITATOR", defenseDate: null }),
      ],
    });
    expect(view.kpis.upcomingDefenses).toBe(0);
    expect(view.upcomingDefenses).toEqual([]);
    // Active (IN_PROGRESS) is not an upcoming event.
    expect(view.activeDefenses.map((d) => d.scheduleId)).toEqual(["s-active"]);
  });

  it("4. active defenses surface assigned IN_PROGRESS sessions", () => {
    const view = build({
      assignments: [assignment({ role: "RAPPORTEUR", sessionStatus: "IN_PROGRESS", defenseType: "TITLE_DEFENSE" })],
    });
    expect(view.activeDefenses).toHaveLength(1);
    expect(view.activeDefenses[0]).toMatchObject({
      scheduleId: "sched-1",
      defenseType: "TITLE_DEFENSE",
      stageLabel: "Title",
      roleLabel: "Rapporteur",
      studentName: "Ana Student",
      href: "/panelist/defense-workspace/sched-1",
    });
  });

  it("5. evaluator NOT_STARTED/DRAFT is actionable; FINALIZED is not", () => {
    const notStarted = build({
      assignments: [assignment({ evaluationStatus: "NOT_STARTED" })],
    });
    expect(notStarted.needsAttention).toHaveLength(1);
    expect(notStarted.needsAttention[0]).toMatchObject({
      category: "EVALUATION",
      actionLabel: "Continue Evaluation",
      priority: 2,
      href: "/panelist/defense-workspace/sched-1",
    });

    const draft = build({ assignments: [assignment({ evaluationStatus: "DRAFT" })] });
    expect(draft.needsAttention).toHaveLength(1);

    const finalized = build({
      assignments: [assignment({ evaluationStatus: "FINALIZED" })],
    });
    expect(finalized.needsAttention).toEqual([]);
  });

  it("6. Title Defense never produces a numerical evaluation task", () => {
    const view = build({
      assignments: [
        assignment({
          defenseType: "TITLE_DEFENSE",
          role: "PANELIST",
          evaluationStatus: "NOT_STARTED",
        }),
      ],
    });
    expect(view.needsAttention.filter((t) => t.category === "EVALUATION")).toEqual([]);
  });

  it("7. evaluator on an active session is priority 1", () => {
    const view = build({
      assignments: [assignment({ sessionStatus: "IN_PROGRESS", evaluationStatus: "DRAFT" })],
    });
    expect(view.needsAttention[0]).toMatchObject({ category: "EVALUATION", priority: 1 });
  });

  it("8. Title chairman start action appears only once the session is due", () => {
    const future = build({
      assignments: [
        assignment({
          defenseType: "TITLE_DEFENSE",
          role: "CHAIRMAN",
          defenseDate: "2026-10-20",
        }),
      ],
    });
    expect(future.needsAttention.filter((t) => t.category === "TITLE_START")).toEqual([]);

    const due = build({
      assignments: [
        assignment({
          defenseType: "TITLE_DEFENSE",
          role: "CHAIRMAN",
          defenseDate: "2026-10-07",
          defenseTime: "09:00:00",
        }),
      ],
    });
    const start = due.needsAttention.find((t) => t.category === "TITLE_START");
    expect(start).toMatchObject({ actionLabel: "Start Defense", priority: 2 });
  });

  it("9. eligible Chairman conclusion is actionable; blocked conclusion waits on others", () => {
    const eligible = build({
      assignments: [
        assignment({
          role: "CHAIRMAN",
          sessionStatus: "AWAITING_CONCLUSION",
          rapporteurNotesFinalized: true,
          oralSummaryReady: true,
        }),
      ],
    });
    expect(eligible.needsAttention.map((t) => t.category)).toContain(
      "CHAIRMAN_CONCLUSION",
    );
    expect(eligible.needsAttention[0]).toMatchObject({
      actionLabel: "Record Conclusion",
      priority: 1,
    });

    const blocked = build({
      assignments: [
        assignment({
          role: "CHAIRMAN",
          sessionStatus: "AWAITING_CONCLUSION",
          evaluationStatus: "FINALIZED",
          rapporteurNotesFinalized: false,
          oralSummaryReady: false,
        }),
      ],
    });
    expect(blocked.needsAttention.filter((t) => t.category === "CHAIRMAN_CONCLUSION")).toEqual([]);
    expect(blocked.waitingOnOthers.some((w) => w.id === "chairman-prereq:sched-1")).toBe(true);
  });

  it("9b. Chairman's own unfinished evaluation is actionable, not a waiting item", () => {
    const view = build({
      assignments: [
        assignment({
          role: "CHAIRMAN",
          sessionStatus: "IN_PROGRESS",
          evaluationStatus: "DRAFT",
        }),
      ],
    });
    expect(view.needsAttention.map((t) => t.category)).toContain("EVALUATION");
    expect(
      view.waitingOnOthers.filter((w) => w.id === "chairman-prereq:sched-1"),
    ).toEqual([]);
  });

  it("10. Rapporteur finalization eligibility and completion", () => {
    const eligible = build({
      assignments: [
        assignment({ role: "RAPPORTEUR", sessionStatus: "IN_PROGRESS" }),
      ],
    });
    expect(eligible.needsAttention[0]).toMatchObject({
      category: "RAPPORTEUR_FINALIZE",
      actionLabel: "Open Minutes",
      priority: 1,
    });

    const completed = build({
      assignments: [
        assignment({
          role: "RAPPORTEUR",
          sessionStatus: "IN_PROGRESS",
          rapporteurNotesFinalized: true,
        }),
      ],
    });
    expect(completed.needsAttention.filter((t) => t.category === "RAPPORTEUR_FINALIZE")).toEqual([]);

    const tooEarly = build({
      assignments: [
        assignment({ role: "RAPPORTEUR", sessionStatus: "SCHEDULED" }),
      ],
    });
    expect(tooEarly.needsAttention.filter((t) => t.category === "RAPPORTEUR_FINALIZE")).toEqual([]);
  });

  it("11. pending RAP signature is a Review & Sign task; waiting RAP is not actionable", () => {
    const view = build({ pendingRapSlots: [rapSlot()] });
    expect(view.needsAttention[0]).toMatchObject({
      category: "RAP_SIGNATURE",
      actionLabel: "Review & Sign",
      priority: 2,
      href: "/panelist/signatures",
    });
    expect(view.kpis.pendingTasks).toBe(1);
  });

  it("12. adviser request awaiting response is actionable; awaiting Dean is waiting-only", () => {
    const actionable = build({ adviserRequests: [adviserRequest()] });
    expect(actionable.needsAttention[0]).toMatchObject({
      category: "ADVISER_REQUEST",
      actionLabel: "Review Request",
    });

    const waitingDean = build({
      adviserRequests: [adviserRequest({ adviserStatus: "CONFORMED", deanStatus: "PENDING" })],
    });
    expect(waitingDean.needsAttention).toEqual([]);
    expect(waitingDean.waitingOnOthers.some((w) => w.id === "adviser-dean:req-1")).toBe(true);
    expect(waitingDean.kpis.pendingTasks).toBe(0);
  });

  it("13. adviser manuscript awaiting review is actionable; awaiting revision is waiting-only", () => {
    const actionable = build({ proposalReviewTasks: [reviewTask()] });
    expect(actionable.needsAttention[0]).toMatchObject({
      category: "ADVISER_MANUSCRIPT_REVIEW",
      actionLabel: "Review Manuscript",
      stage: "Proposal",
    });

    const finalReview = build({
      finalReviewTasks: [reviewTask({ stage: "FINAL" })],
    });
    expect(finalReview.needsAttention[0].stage).toBe("Final");

    const awaitingRevision = build({
      proposalReviewTasks: [reviewTask({ reviewStatus: "CHANGES_REQUESTED" })],
    });
    expect(awaitingRevision.needsAttention).toEqual([]);
    expect(
      awaitingRevision.waitingOnOthers.some((w) => w.id === "manuscript-revision:PROPOSAL:thesis-1"),
    ).toBe(true);
  });

  it("14. facilitator receives no evaluator or conclusion tasks", () => {
    const view = build({
      assignments: [
        assignment({
          role: "FACILITATOR",
          sessionStatus: "IN_PROGRESS",
          evaluationStatus: "NOT_STARTED",
        }),
      ],
    });
    expect(view.needsAttention).toEqual([]);
  });

  it("15. waiting items never contribute to pendingTasks", () => {
    const view = build({
      adviserRequests: [adviserRequest({ adviserStatus: "CONFORMED", deanStatus: "PENDING" })],
      signedRapSlots: [signedRap()],
    });
    expect(view.waitingOnOthers.length).toBeGreaterThan(0);
    expect(view.kpis.pendingTasks).toBe(0);
  });

  it("16. distinct legitimate actions on the same academic record count separately", () => {
    const view = build({
      adviserRequests: [adviserRequest()],
      proposalReviewTasks: [reviewTask()],
    });
    expect(view.kpis.pendingTasks).toBe(2);
    expect(
      view.needsAttention.map((t) => t.category).sort(),
    ).toEqual(["ADVISER_MANUSCRIPT_REVIEW", "ADVISER_REQUEST"]);
  });

  it("17. priority 1 sorts before priority 2; ties break on earliest date then id", () => {
    const view = build({
      assignments: [
        assignment({
          assignmentId: "pa-sched",
          scheduleId: "s-later",
          evaluationStatus: "NOT_STARTED",
          defenseDate: "2026-10-25",
        }),
        assignment({
          assignmentId: "pa-active",
          scheduleId: "s-active",
          evaluationStatus: "DRAFT",
          sessionStatus: "IN_PROGRESS",
        }),
      ],
      pendingRapSlots: [rapSlot({ id: "sig-a", generatedDate: "2026-10-01" })],
    });
    expect(view.needsAttention[0].scheduleId).toBe("s-active");
    expect(view.needsAttention[0].priority).toBe(1);
    // Remaining tier-2 tasks ordered by authoritative date asc (RAP 10-01 < eval 10-25).
    expect(view.needsAttention[1].category).toBe("RAP_SIGNATURE");
    expect(view.needsAttention[2].category).toBe("EVALUATION");
  });

  it("18. session with an invalid defenseTime is not an upcoming event", () => {
    const view = build({
      assignments: [
        assignment({ role: "FACILITATOR", defenseTime: null }),
      ],
    });
    expect(view.upcomingDefenses).toEqual([]);
    expect(view.kpis.upcomingDefenses).toBe(0);
  });

  it("helpers map domain enums to readable labels", () => {
    expect(stageLabel("TITLE_DEFENSE")).toBe("Title");
    expect(stageLabel("PROPOSAL_DEFENSE")).toBe("Proposal");
    expect(stageLabel("FINAL_DEFENSE")).toBe("Final");
    expect(defenseTypeLabel("FINAL_DEFENSE")).toBe("Final Defense");
    expect(roleLabel("CHAIRMAN")).toBe("Chairman");
    expect(roleLabel("RAPPORTEUR")).toBe("Rapporteur");
    expect(evaluationStatusLabel("DRAFT")).toBe("Draft saved");
    expect(sessionStatusLabel("AWAITING_CONCLUSION")).toBe("Awaiting formal conclusion");
    expect(parseWallClockMs("2026-10-20", "09:00:00")).toBe(
      Date.UTC(2026, 9, 20, 9, 0, 0),
    );
    expect(parseWallClockMs(null, "09:00:00")).toBeNull();
    expect(parseWallClockMs("2026-10-20", null)).toBeNull();
  });
});
