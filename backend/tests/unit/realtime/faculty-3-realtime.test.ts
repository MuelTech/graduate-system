import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ user: { findUnique: vi.fn() } }));
vi.mock("../../../src/config/database", () => ({ default: db }));
import { createDefenseSocketAuthMiddleware } from "../../../src/realtime/defense-realtime.auth";
import { createPrismaDefenseRealtimeStore, DEFENSE_CURRENT_ACCOUNT_FILTER } from "../../../src/realtime/defense-realtime.store";
import { createPrismaDefenseReportPreviewStore } from "../../../src/realtime/defense-report-preview.store";
import { authorizeDefenseRoomJoin, resolveDefenseDeliveryAuthorization } from "../../../src/realtime/defense-realtime.authorization";
import { authorizeDefenseReportPreviewSender, resolveDefenseReportPreviewDelivery } from "../../../src/realtime/defense-report-preview.authorization";

// Narrow in-memory Prisma read double. No database/server/schema is touched.
function fixture(role: string) {
  const account = { id: "academic-1", email: "synthetic@example.test", role, isActive: true,
    mustChangePassword: false, panelist: { isActive: true } };
  const seat = { scheduleId: "schedule-1", userId: account.id, isActive: true, role: "RAPPORTEUR" };
  const eligible = (where: any) => where.scheduleId === seat.scheduleId && where.isActive === seat.isActive &&
    where.user.isActive === account.isActive && where.user.mustChangePassword === account.mustChangePassword &&
    where.user.role.in.includes(account.role) && where.user.panelist.is.isActive === account.panelist.isActive;
  const client = {
    panelAssignment: {
      findFirst: vi.fn(async ({ where }: any) => eligible(where) && where.userId === seat.userId ? { id: "seat-preserved" } : null),
      findMany: vi.fn(async ({ where }: any) => eligible(where) && where.userId.in.includes(seat.userId) ? [{ userId: seat.userId }] : []),
    },
    defenseSchedule: { findUnique: vi.fn(async ({ where, select }: any) => {
      if (where.id !== seat.scheduleId) return null;
      const filter = select.panelAssignments?.where;
      return { sessionStatus: "IN_PROGRESS", rapReports: [],
        panelAssignments: filter && eligible({ ...filter, scheduleId: where.id }) && filter.userId === seat.userId ? [{ role: seat.role }] : [] };
    }) },
  };
  db.user.findUnique.mockImplementation(async () => account);
  return { account, seat, client, membership: createPrismaDefenseRealtimeStore(client as never), preview: createPrismaDefenseReportPreviewStore(client as never) };
}
async function handshake() {
  const socket = { handshake: { auth: { token: "synthetic" } }, data: {} as Record<string, unknown> };
  const next = vi.fn();
  await createDefenseSocketAuthMiddleware({ verifyToken: () => ({ userId: "academic-1", role: "ADMIN" }) })(socket, next);
  return { socket, next };
}
beforeEach(() => vi.clearAllMocks());

describe.each(["PANELIST", "FACULTY"])("FACULTY-3 realtime account/assignment boundary (%s)", role => {
  it("handshakes using current identity and revalidates exact room, delivery and preview", async () => {
    const { membership, preview, client } = fixture(role);
    const { socket, next } = await handshake();
    expect(next).toHaveBeenCalledWith(); expect(socket.data).toEqual({ userId: "academic-1", role });
    expect(await authorizeDefenseRoomJoin(membership, "schedule-1", "academic-1")).toMatchObject({ ok: true });
    expect(await authorizeDefenseRoomJoin(membership, "schedule-1", "unassigned")).toMatchObject({ ok: false });
    expect((await resolveDefenseDeliveryAuthorization(membership, "schedule-1", "annotation.created", ["academic-1", "unassigned"])).authorizedUserIds).toEqual(new Set(["academic-1"]));
    expect(await authorizeDefenseReportPreviewSender(preview, "schedule-1", "academic-1")).toEqual({ ok: true });
    expect(await authorizeDefenseReportPreviewSender(preview, "schedule-1", "unassigned")).toMatchObject({ ok: false });
    expect((await resolveDefenseReportPreviewDelivery(preview, "schedule-1", ["academic-1", "unassigned"])).authorizedUserIds).toEqual(new Set(["academic-1"]));
    expect(client.panelAssignment.findFirst.mock.calls[0][0].where.user).toEqual({
      isActive: true, mustChangePassword: false, role: { in: ["PANELIST", "FACULTY"] }, panelist: { is: { isActive: true } },
    });
  });
  it.each(["removed seat", "disabled account", "disabled profile", "password gate", "ADMIN", "CUSTOM"])("revokes delivery and preview immediately after %s", async change => {
    const { account, seat, membership, preview } = fixture(role);
    expect((await handshake()).next).toHaveBeenCalledWith();
    if (change === "removed seat") seat.isActive = false;
    else if (change === "disabled account") account.isActive = false;
    else if (change === "disabled profile") account.panelist.isActive = false;
    else if (change === "password gate") account.mustChangePassword = true;
    else account.role = change;
    expect(await authorizeDefenseRoomJoin(membership, "schedule-1", "academic-1")).toMatchObject({ ok: false });
    expect((await resolveDefenseDeliveryAuthorization(membership, "schedule-1", "annotation.created", ["academic-1"])).authorizedUserIds.size).toBe(0);
    expect(await authorizeDefenseReportPreviewSender(preview, "schedule-1", "academic-1")).toMatchObject({ ok: false });
    expect((await resolveDefenseReportPreviewDelivery(preview, "schedule-1", ["academic-1"])).authorizedUserIds.size).toBe(0);
  });
  it("does not derive Rapporteur authority from academic identity or a Panelist seat", async () => {
    const { seat, preview } = fixture(role); seat.role = "PANELIST";
    expect(await authorizeDefenseReportPreviewSender(preview, "schedule-1", "academic-1")).toMatchObject({ ok: false });
  });
});
it.each(["ADMIN", "CUSTOM", "APPLICANT", "STUDENT"])("denies %s socket impersonation despite a profile/assignment", async role => {
  const { membership } = fixture(role);
  const { next, socket } = await handshake();
  expect(next.mock.calls[0][0]).toBeInstanceOf(Error); expect(socket.data).toEqual({});
  expect(await authorizeDefenseRoomJoin(membership, "schedule-1", "academic-1")).toMatchObject({ ok: false });
});
it("uses the same current-account predicate for preview and room reads", () => {
  expect(DEFENSE_CURRENT_ACCOUNT_FILTER.role.in).toEqual(["PANELIST", "FACULTY"]);
});
