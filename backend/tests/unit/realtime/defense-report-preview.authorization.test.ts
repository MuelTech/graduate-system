import { describe, expect, it, vi } from "vitest";

import {
  authorizeDefenseReportPreviewSender,
  resolveDefenseReportPreviewDelivery,
  type DefenseReportPreviewStore,
  type ReportPreviewSenderState,
} from "../../../src/realtime/defense-report-preview.authorization";

function makeState(
  overrides: Partial<ReportPreviewSenderState> = {},
): ReportPreviewSenderState {
  return {
    sessionStatus: "IN_PROGRESS",
    role: "RAPPORTEUR",
    rapStatus: "DRAFT",
    rapFrozenAt: null,
    ...overrides,
  };
}

function makeStore(
  overrides: Partial<DefenseReportPreviewStore> = {},
): DefenseReportPreviewStore {
  return {
    getSessionStatus: vi.fn(async () => "IN_PROGRESS"),
    listAssignedUserIds: vi.fn(async () => new Set(["u-1", "u-2"])),
    getReportPreviewSenderState: vi.fn(async () => makeState()),
    ...overrides,
  };
}

describe("authorizeDefenseReportPreviewSender", () => {
  it.each(["SCHEDULED", "IN_PROGRESS", "AWAITING_CONCLUSION"])(
    "allows the exact assigned Rapporteur while %s with no report yet",
    async (sessionStatus) => {
      const store = makeStore({
        getReportPreviewSenderState: vi.fn(async () =>
          makeState({ sessionStatus, rapStatus: null }),
        ),
      });

      await expect(
        authorizeDefenseReportPreviewSender(store, "sched-1", "rapporteur-1"),
      ).resolves.toEqual({ ok: true });
      expect(store.getReportPreviewSenderState).toHaveBeenCalledWith(
        "sched-1",
        "rapporteur-1",
      );
    },
  );

  it("allows an unfrozen DRAFT report", async () => {
    const store = makeStore();

    await expect(
      authorizeDefenseReportPreviewSender(store, "sched-1", "rapporteur-1"),
    ).resolves.toEqual({ ok: true });
  });

  it.each(["CHAIRMAN", "PANELIST", "ADVISER", "FACILITATOR", null])(
    "denies a %s assignment even when the session is active",
    async (role) => {
      const store = makeStore({
        getReportPreviewSenderState: vi.fn(async () => makeState({ role })),
      });

      await expect(
        authorizeDefenseReportPreviewSender(store, "sched-1", "u-2"),
      ).resolves.toEqual({ ok: false, code: "FORBIDDEN" });
    },
  );

  it("denies a user with no assignment", async () => {
    const store = makeStore({
      getReportPreviewSenderState: vi.fn(async () =>
        makeState({ role: null, rapStatus: null }),
      ),
    });

    await expect(
      authorizeDefenseReportPreviewSender(store, "sched-1", "u-9"),
    ).resolves.toEqual({ ok: false, code: "FORBIDDEN" });
  });

  it.each(["FOR_SIGNATURE", "PARTIALLY_SIGNED", "ALL_SIGNED", "DISTRIBUTED", "FINALIZED"])(
    "denies preview sending once the report is %s",
    async (rapStatus) => {
      const store = makeStore({
        getReportPreviewSenderState: vi.fn(async () => makeState({ rapStatus })),
      });

      await expect(
        authorizeDefenseReportPreviewSender(store, "sched-1", "rapporteur-1"),
      ).resolves.toEqual({ ok: false, code: "FORBIDDEN" });
    },
  );

  it("denies preview sending when frozenAt is set", async () => {
    const store = makeStore({
      getReportPreviewSenderState: vi.fn(async () =>
        makeState({ rapFrozenAt: new Date("2026-10-17T00:00:00.000Z") }),
      ),
    });

    await expect(
      authorizeDefenseReportPreviewSender(store, "sched-1", "rapporteur-1"),
    ).resolves.toEqual({ ok: false, code: "FORBIDDEN" });
  });

  it.each(["CONCLUDED", "CANCELLED", "UNSCHEDULED"])(
    "denies preview sending while the session is %s",
    async (sessionStatus) => {
      const store = makeStore({
        getReportPreviewSenderState: vi.fn(async () => makeState({ sessionStatus })),
      });

      await expect(
        authorizeDefenseReportPreviewSender(store, "sched-1", "rapporteur-1"),
      ).resolves.toEqual({ ok: false, code: "NOT_ACTIVE" });
    },
  );

  it("denies a missing schedule without exposing details", async () => {
    const store = makeStore({
      getReportPreviewSenderState: vi.fn(async () => null),
    });

    await expect(
      authorizeDefenseReportPreviewSender(store, "sched-missing", "rapporteur-1"),
    ).resolves.toEqual({ ok: false, code: "FORBIDDEN" });
  });

  it("rejects an invalid schedule id without querying the store", async () => {
    const store = makeStore();

    await expect(
      authorizeDefenseReportPreviewSender(store, "defense:sched-1", "u-1"),
    ).resolves.toEqual({ ok: false, code: "FORBIDDEN" });
    expect(store.getReportPreviewSenderState).not.toHaveBeenCalled();
  });
});

describe("resolveDefenseReportPreviewDelivery", () => {
  it.each(["SCHEDULED", "IN_PROGRESS", "AWAITING_CONCLUSION"])(
    "delivers to the exact current assignments while %s",
    async (sessionStatus) => {
      const store = makeStore({ getSessionStatus: vi.fn(async () => sessionStatus) });

      await expect(
        resolveDefenseReportPreviewDelivery(store, "sched-1", [
          "u-1",
          "u-2",
          "removed-user",
        ]),
      ).resolves.toEqual({
        deliver: true,
        authorizedUserIds: new Set(["u-1", "u-2"]),
      });
      expect(store.listAssignedUserIds).toHaveBeenCalledWith("sched-1", [
        "u-1",
        "u-2",
        "removed-user",
      ]);
    },
  );

  it.each(["CONCLUDED", "CANCELLED", "UNSCHEDULED"])(
    "drops delivery while %s",
    async (sessionStatus) => {
      const store = makeStore({ getSessionStatus: vi.fn(async () => sessionStatus) });

      await expect(
        resolveDefenseReportPreviewDelivery(store, "sched-1", ["u-1"]),
      ).resolves.toEqual({ deliver: false, authorizedUserIds: new Set() });
    },
  );

  it("drops delivery for a missing schedule", async () => {
    const store = makeStore({ getSessionStatus: vi.fn(async () => null) });

    await expect(
      resolveDefenseReportPreviewDelivery(store, "sched-1", ["u-1"]),
    ).resolves.toEqual({ deliver: false, authorizedUserIds: new Set() });
  });
});
