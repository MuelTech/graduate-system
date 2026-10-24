import { describe, expect, it, vi } from "vitest";

const sendTemplateEmail = vi.hoisted(() => vi.fn());

vi.mock("../../../src/config/database", () => ({ default: {} }));
vi.mock("../../../src/services/email.service", () => ({
  EmailService: { sendTemplateEmail },
}));

import { ThesisController } from "../../../src/controllers/thesis.controller";

describe("DEF-CORR-1 scheduling notification safety", () => {
  it("keeps authoritative scheduling success when assignment email queueing fails", async () => {
    const controller = new ThesisController();
    const scheduleDefense = vi.fn().mockResolvedValue({
      id: "sched-1",
      defenseDate: new Date("2026-11-10T00:00:00.000Z"),
      panelAssignments: [
        {
          user: {
            email: "panelist@example.test",
            firstName: "Panel",
            lastName: "Member",
          },
        },
      ],
    });
    (controller as unknown as { thesisService: unknown }).thesisService = {
      scheduleDefense,
    };
    sendTemplateEmail.mockRejectedValue(new Error("email queue unavailable"));

    const req = {
      user: { userId: "admin-1" },
      params: { id: "thesis-1" },
      body: {},
    };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    await controller.scheduleDefense(req as never, res as never);

    expect(scheduleDefense).toHaveBeenCalledWith("thesis-1", "admin-1", {});
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      message: "Defense scheduled and panelists notified",
      result: expect.objectContaining({ id: "sched-1" }),
    });
  });
});
