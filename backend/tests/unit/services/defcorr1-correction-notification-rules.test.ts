import { describe, expect, it } from "vitest";
import type { DefenseScheduleAuditSnapshot } from "../../../src/services/defense-audit";
import { buildDefenseCorrectionNotifications } from "../../../src/services/defense-schedule-notification.rules";

function member(
  userId: string,
  role: string,
  assignmentId = `pa-${userId}`,
): DefenseScheduleAuditSnapshot["committee"][number] {
  return {
    assignmentId,
    userId,
    displayName: `${userId} Name`,
    role,
  };
}

function snapshot(
  schedule: Partial<DefenseScheduleAuditSnapshot["schedule"]> = {},
  committee: DefenseScheduleAuditSnapshot["committee"] = [
    member("chair", "CHAIRMAN"),
    member("panel-a", "PANELIST"),
    member("panel-b", "PANELIST"),
    member("panel-c", "PANELIST"),
    member("fac", "FACILITATOR"),
    member("rap", "RAPPORTEUR"),
    member("adviser", "ADVISER"),
  ],
): DefenseScheduleAuditSnapshot {
  return {
    scheduleId: "sched-1",
    thesisId: "thesis-1",
    defenseType: "PROPOSAL_DEFENSE",
    schedule: {
      defenseDate: "2026-11-10T00:00:00.000Z",
      defenseTime: "1970-01-01T09:00:00.000Z",
      venueOrLink: "Room 201",
      ...schedule,
    },
    committee,
  };
}

describe("DEF-CORR-1 correction notification rules", () => {
  it("notifies only the added and removed members for a roster-only replacement", () => {
    const before = snapshot();
    const after = snapshot({}, [
      member("chair", "CHAIRMAN"),
      member("panel-a", "PANELIST"),
      member("panel-b", "PANELIST"),
      member("panel-new", "PANELIST"),
      member("fac", "FACILITATOR"),
      member("rap", "RAPPORTEUR"),
      member("adviser", "ADVISER"),
    ]);

    const notices = buildDefenseCorrectionNotifications({
      studentUserId: "student-1",
      before,
      after,
    });

    expect(notices.map((notice) => [notice.userId, notice.type])).toEqual([
      ["panel-c", "DEFENSE_ASSIGNMENT"],
      ["panel-new", "DEFENSE_ASSIGNMENT"],
    ]);
    expect(notices.find((notice) => notice.userId === "panel-c")?.title).toMatch(
      /removed/i,
    );
    expect(notices.find((notice) => notice.userId === "panel-new")?.title).toMatch(
      /assignment/i,
    );
    for (const unchanged of ["student-1", "chair", "panel-a", "panel-b", "fac", "rap", "adviser"]) {
      expect(notices.some((notice) => notice.userId === unchanged)).toBe(false);
    }
  });

  it("notifies the student and every current participant once for a schedule-only change", () => {
    const before = snapshot();
    const after = snapshot({
      defenseDate: "2026-11-11T00:00:00.000Z",
      defenseTime: "1970-01-01T10:30:00.000Z",
    });

    const notices = buildDefenseCorrectionNotifications({
      studentUserId: "student-1",
      before,
      after,
    });

    expect(notices).toHaveLength(8);
    expect(notices.every((notice) => notice.type === "DEFENSE_SCHEDULE")).toBe(true);
    expect(new Set(notices.map((notice) => notice.userId)).size).toBe(8);
    expect(notices.map((notice) => notice.userId)).toEqual(
      expect.arrayContaining([
        "student-1",
        "chair",
        "panel-a",
        "panel-b",
        "panel-c",
        "fac",
        "rap",
        "adviser",
      ]),
    );
    expect(notices.every((notice) => notice.relatedRecordId === "sched-1")).toBe(
      true,
    );
  });

  it("does not duplicate a changed member's schedule notice with an assignment notice", () => {
    const before = snapshot();
    const after = snapshot(
      { venueOrLink: "Room 505" },
      [
        member("chair", "CHAIRMAN"),
        member("panel-a", "PANELIST"),
        member("panel-b", "PANELIST"),
        member("panel-new", "PANELIST"),
        member("fac", "FACILITATOR"),
        member("rap", "RAPPORTEUR"),
        member("adviser", "ADVISER"),
      ],
    );

    const notices = buildDefenseCorrectionNotifications({
      studentUserId: "student-1",
      before,
      after,
    });

    expect(notices.filter((notice) => notice.userId === "panel-new")).toHaveLength(1);
    expect(notices.find((notice) => notice.userId === "panel-new")?.type).toBe(
      "DEFENSE_ASSIGNMENT",
    );
    expect(notices.filter((notice) => notice.userId === "panel-c")).toHaveLength(1);
    expect(notices.find((notice) => notice.userId === "panel-c")?.type).toBe(
      "DEFENSE_ASSIGNMENT",
    );
    expect(notices.find((notice) => notice.userId === "chair")?.type).toBe(
      "DEFENSE_SCHEDULE",
    );
  });

  it("treats an active role change as one assignment notice without remove/add duplication", () => {
    const before = snapshot({}, [
      member("chair", "CHAIRMAN"),
      member("panel-a", "PANELIST"),
      member("panel-b", "PANELIST"),
      member("panel-c", "PANELIST"),
      member("fac", "FACILITATOR"),
      member("rap", "RAPPORTEUR"),
      member("adviser", "ADVISER"),
    ]);
    const after = snapshot({}, [
      member("chair", "CHAIRMAN"),
      member("panel-a", "PANELIST"),
      member("panel-b", "PANELIST"),
      member("rap", "PANELIST"),
      member("panel-c", "FACILITATOR"),
      member("fac", "RAPPORTEUR"),
      member("adviser", "ADVISER"),
    ]);

    const notices = buildDefenseCorrectionNotifications({
      studentUserId: "student-1",
      before,
      after,
    });

    expect(notices.filter((notice) => notice.userId === "panel-c")).toHaveLength(1);
    expect(notices.find((notice) => notice.userId === "panel-c")).toMatchObject({
      type: "DEFENSE_ASSIGNMENT",
      title: "Defense committee assignment",
    });
    expect(notices.find((notice) => notice.userId === "panel-c")?.message).toMatch(
      /Facilitator/i,
    );
    expect(notices.find((notice) => notice.userId === "fac")?.message).toMatch(
      /Rapporteur/i,
    );
  });

  it("produces no notifications when nothing changed", () => {
    expect(
      buildDefenseCorrectionNotifications({
        studentUserId: "student-1",
        before: snapshot(),
        after: snapshot(),
      }),
    ).toEqual([]);
  });
});
