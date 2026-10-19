import { describe, expect, it, vi } from "vitest";

import {
  DEFENSE_AUDIT_ACTIONS,
  writeDefenseAudit,
} from "../../../src/services/defense-audit";

describe("CDW-9C defense audit writer", () => {
  it("writes allow-listed metadata and excludes sensitive fields", async () => {
    const create = vi.fn().mockResolvedValue({ id: "audit-1" });
    const db = { auditLog: { create } };

    await writeDefenseAudit(db as never, {
      actorId: "u-chair",
      actionType: DEFENSE_AUDIT_ACTIONS.SESSION_STARTED,
      targetTable: "defense_schedules",
      targetId: "sched-1",
      metadata: {
        scheduleId: "sched-1",
        defenseType: "PROPOSAL_DEFENSE",
        previousStatus: "SCHEDULED",
        newStatus: "IN_PROGRESS",
        signatureData: "data:image/png;base64,PRIVATE_SIGNATURE",
        recommendations: "PRIVATE_RECOMMENDATION",
        reportBody: "PRIVATE_REPORT_BODY",
        manuscriptText: "PRIVATE_MANUSCRIPT",
        storagePath: "/private/path.pdf",
        password: "PRIVATE_PASSWORD",
      } as never,
    });

    expect(create).toHaveBeenCalledTimes(1);
    const data = create.mock.calls[0][0].data;

    expect(data).toMatchObject({
      actorId: "u-chair",
      actionType: "DEFENSE_SESSION_STARTED",
      targetTable: "defense_schedules",
      targetId: "sched-1",
      oldValue: null,
      ipAddress: null,
    });
    expect(JSON.parse(data.newValue)).toEqual({
      scheduleId: "sched-1",
      defenseType: "PROPOSAL_DEFENSE",
      previousStatus: "SCHEDULED",
      newStatus: "IN_PROGRESS",
    });
    expect(data.newValue).not.toContain("PRIVATE_");
    expect(data.description).not.toContain("PRIVATE_");
  });
});
