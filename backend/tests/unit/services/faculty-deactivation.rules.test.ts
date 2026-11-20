import { describe, expect, it, vi, beforeEach } from "vitest";
import { evaluateFacultyDeactivationImpact } from "../../../src/services/faculty-deactivation.rules";

const repoMocks = vi.hoisted(() => ({
  findById: vi.fn(),
  findDeactivationImpactData: vi.fn(),
  updateWithUserTransaction: vi.fn(),
}));

vi.mock("../../../src/repositories/admin-panelist.repository", () => ({
  AdminPanelistRepository: class {
    findById = repoMocks.findById;
    findDeactivationImpactData = repoMocks.findDeactivationImpactData;
    updateWithUserTransaction = repoMocks.updateWithUserTransaction;
  },
}));

import { AdminPanelistService } from "../../../src/services/admin-panelist.service";

describe("Phase 2 — Faculty Deactivation Defense & Assignment Handoff Rules", () => {
  describe("evaluateFacultyDeactivationImpact", () => {
    it("allows clean deactivation with no confirmation when there are no active defenses, advisees, or pending requests", () => {
      const impact = evaluateFacultyDeactivationImpact({
        panelistId: "pan-1",
        userId: "user-1",
        panelAssignments: [],
        adviserAssignments: [],
        pendingAdviserRequests: [],
      });

      expect(impact.canDeactivate).toBe(true);
      expect(impact.blockedReason).toBeNull();
      expect(impact.requiresHandoffConfirmation).toBe(false);
    });

    it("hard-blocks deactivation when faculty has an IN_PROGRESS or AWAITING_CONCLUSION defense seat", () => {
      const impact = evaluateFacultyDeactivationImpact({
        panelistId: "pan-1",
        userId: "user-1",
        panelAssignments: [
          {
            role: "CHAIRMAN",
            schedule: {
              id: "sched-live",
              defenseType: "PROPOSAL_DEFENSE",
              sessionStatus: "IN_PROGRESS",
              defenseDate: new Date("2026-11-22T00:00:00Z"),
              thesis: { student: { user: { firstName: "Ana", lastName: "Cruz" } } },
            },
          },
          {
            role: "PANELIST",
            schedule: {
              id: "sched-await",
              defenseType: "FINAL_DEFENSE",
              sessionStatus: "AWAITING_CONCLUSION",
              defenseDate: new Date("2026-11-23T00:00:00Z"),
              thesis: { student: { user: { firstName: "Ben", lastName: "Diaz" } } },
            },
          },
        ],
        adviserAssignments: [],
        pendingAdviserRequests: [],
      });

      expect(impact.canDeactivate).toBe(false);
      expect(impact.blockedReason).toContain("active defense session");
      expect(impact.requiresHandoffConfirmation).toBe(false);
      expect(impact.blockingDefenses).toHaveLength(2);
    });

    it("requires handoff confirmation when faculty has SCHEDULED defenses, active advisees, or pending adviser requests", () => {
      const impact = evaluateFacultyDeactivationImpact({
        panelistId: "pan-1",
        userId: "user-1",
        panelAssignments: [
          {
            role: "RAPPORTEUR",
            schedule: {
              id: "sched-upcoming",
              defenseType: "TITLE_DEFENSE",
              sessionStatus: "SCHEDULED",
              defenseDate: new Date("2026-11-28T00:00:00Z"),
              thesis: { student: { user: { firstName: "Cara", lastName: "Reyes" } } },
            },
          },
        ],
        adviserAssignments: [
          {
            id: "adv-1",
            studentId: "stu-1",
            student: {
              studentNumber: "2026-0001",
              user: { firstName: "Dan", lastName: "Santos" },
            },
          },
        ],
        pendingAdviserRequests: [
          {
            id: "req-1",
            requestDate: new Date("2026-11-20T00:00:00Z"),
            student: { user: { firstName: "Eva", lastName: "Lim" } },
          },
        ],
      });

      expect(impact.canDeactivate).toBe(true);
      expect(impact.blockedReason).toBeNull();
      expect(impact.requiresHandoffConfirmation).toBe(true);
      expect(impact.scheduledDefenses).toHaveLength(1);
      expect(impact.activeAdvisees).toHaveLength(1);
      expect(impact.pendingAdviserRequests).toHaveLength(1);
    });
  });

  describe("AdminPanelistService.updatePanelist enforcement", () => {
    const service = new AdminPanelistService();

    beforeEach(() => {
      vi.clearAllMocks();
      repoMocks.findById.mockResolvedValue({
        id: "pan-1",
        userId: "user-1",
        isActive: true,
        user: { isActive: true },
      });
      repoMocks.updateWithUserTransaction.mockResolvedValue({ id: "pan-1" });
    });

    it("rejects deactivation with 409 when faculty has an IN_PROGRESS defense even if confirmHandoff is true", async () => {
      repoMocks.findDeactivationImpactData.mockResolvedValue({
        panelistId: "pan-1",
        userId: "user-1",
        panelAssignments: [
          {
            role: "PANELIST",
            schedule: {
              id: "sched-1",
              defenseType: "PROPOSAL_DEFENSE",
              sessionStatus: "IN_PROGRESS",
              defenseDate: new Date("2026-11-21T00:00:00Z"),
              thesis: { student: { user: { firstName: "Ana", lastName: "Cruz" } } },
            },
          },
        ],
        adviserAssignments: [],
        pendingAdviserRequests: [],
      });

      await expect(
        service.updatePanelist(
          "pan-1",
          { isActive: false, confirmHandoff: true },
          "admin-1",
        ),
      ).rejects.toMatchObject({ statusCode: 409 });
      expect(repoMocks.updateWithUserTransaction).not.toHaveBeenCalled();
    });

    it("rejects deactivation with 409 when scheduled defenses/advisees exist and confirmHandoff is not set", async () => {
      repoMocks.findDeactivationImpactData.mockResolvedValue({
        panelistId: "pan-1",
        userId: "user-1",
        panelAssignments: [],
        adviserAssignments: [
          {
            id: "adv-1",
            studentId: "stu-1",
            student: {
              studentNumber: "2026-0001",
              user: { firstName: "Dan", lastName: "Santos" },
            },
          },
        ],
        pendingAdviserRequests: [],
      });

      await expect(
        service.updatePanelist("pan-1", { isActive: false }, "admin-1"),
      ).rejects.toMatchObject({ statusCode: 409 });
      expect(repoMocks.updateWithUserTransaction).not.toHaveBeenCalled();
    });

    it("allows deactivation with confirmHandoff: true and passes handoff counts for audit", async () => {
      repoMocks.findDeactivationImpactData.mockResolvedValue({
        panelistId: "pan-1",
        userId: "user-1",
        panelAssignments: [
          {
            role: "PANELIST",
            schedule: {
              id: "sched-2",
              defenseType: "TITLE_DEFENSE",
              sessionStatus: "SCHEDULED",
              defenseDate: new Date("2026-11-29T00:00:00Z"),
              thesis: { student: { user: { firstName: "Cara", lastName: "Reyes" } } },
            },
          },
        ],
        adviserAssignments: [],
        pendingAdviserRequests: [],
      });

      await service.updatePanelist(
        "pan-1",
        { isActive: false, confirmHandoff: true },
        "admin-1",
      );

      expect(repoMocks.updateWithUserTransaction).toHaveBeenCalledWith(
        "pan-1",
        { isActive: false, confirmHandoff: true },
        "admin-1",
        undefined,
        {
          scheduledDefensesCount: 1,
          activeAdviseesCount: 0,
          pendingAdviserRequestsCount: 0,
        },
      );
    });
  });
});
