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
      defenseTime: new Date("1970-01-01T09:00:00.000Z"),
      venueOrLink: "Room 201",
      thesis: {
        student: {
          user: {
            email: "student@example.test",
            firstName: "Ana",
            lastName: "Cruz",
          },
        },
      },
      panelAssignments: [],
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
    expect(sendTemplateEmail).toHaveBeenCalledWith(
      "student@example.test",
      "defense_schedule",
      {
        student_name: "Ana Cruz",
        defense_date: "Nov 10, 2026",
        defense_time: "9:00 AM",
        venue: "Room 201",
      },
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      message: "Defense scheduled.",
      result: expect.objectContaining({ id: "sched-1" }),
    });
  });
});
