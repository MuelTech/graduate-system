import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DefenseScheduleAuditSnapshot } from "../../../src/services/defense-audit";

const createMany = vi.hoisted(() => vi.fn());

vi.mock("../../../src/repositories/notification.repository", () => ({
  NotificationRepository: class {
    createMany = createMany;
    getByUserId = vi.fn();
    markAsRead = vi.fn();
  },
}));

import { NotificationService } from "../../../src/services/notification.service";

function member(
  userId: string,
  role: string,
): DefenseScheduleAuditSnapshot["committee"][number] {
  return { assignmentId: `pa-${userId}`, userId, displayName: userId, role };
}

function snapshot(
  committee: DefenseScheduleAuditSnapshot["committee"],
): DefenseScheduleAuditSnapshot {
  return {
    scheduleId: "sched-1",
    thesisId: "thesis-1",
    defenseType: "PROPOSAL_DEFENSE",
    schedule: {
      defenseDate: "2026-11-10T00:00:00.000Z",
      defenseTime: "1970-01-01T09:00:00.000Z",
      venueOrLink: "Room 201",
    },
    committee,
  };
}

describe("DEF-CORR-1 notification service", () => {
  const service = new NotificationService();

  beforeEach(() => {
    vi.clearAllMocks();
    createMany.mockResolvedValue({ count: 1 });
  });

  it("writes the bounded correction notices through the existing repository", async () => {
    const before = snapshot([
      member("chair", "CHAIRMAN"),
      member("old-panelist", "PANELIST"),
    ]);
    const after = snapshot([
      member("chair", "CHAIRMAN"),
      member("new-panelist", "PANELIST"),
    ]);

    await expect(
      service.notifyDefenseCorrection({
        studentUserId: "student-1",
        before,
        after,
      }),
    ).resolves.toBe(2);

    expect(createMany).toHaveBeenCalledTimes(1);
    const rows = createMany.mock.calls[0][0];
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userId: "old-panelist",
          type: "DEFENSE_ASSIGNMENT",
          title: "Defense assignment removed",
          relatedRecordType: "DEFENSE_SCHEDULE",
          relatedRecordId: "sched-1",
        }),
        expect.objectContaining({
          userId: "new-panelist",
          type: "DEFENSE_ASSIGNMENT",
          title: "Defense committee assignment",
        }),
      ]),
    );
  });

  it("does not write when the authoritative snapshots are unchanged", async () => {
    const roster = snapshot([
      member("chair", "CHAIRMAN"),
      member("panel", "PANELIST"),
    ]);
    await expect(
      service.notifyDefenseCorrection({
        studentUserId: "student-1",
        before: roster,
        after: roster,
      }),
    ).resolves.toBe(0);
    expect(createMany).not.toHaveBeenCalled();
  });
});
