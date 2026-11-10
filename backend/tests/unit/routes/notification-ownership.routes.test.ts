import express from "express";
import jwt from "jsonwebtoken";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

interface NotificationRow {
  id: string;
  userId: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: Date;
}

const state = vi.hoisted(() => ({
  accounts: {} as Record<string, {
    id: string;
    role: string;
    isActive: boolean;
    mustChangePassword: boolean;
    panelist: { isActive: boolean } | null;
  }>,
  notifications: [] as NotificationRow[],
  throwOnUpdate: null as Error | null,
}));

const dbMock = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(async ({ where }: { where: { id: string } }) => state.accounts[where.id] ?? null),
  },
  notification: {
    findMany: vi.fn(async ({ where }: { where: { userId: string } }) =>
      state.notifications.filter((row) => row.userId === where.userId),
    ),
    updateMany: vi.fn(async ({ where, data }: { where: { id: string; userId: string }; data: { isRead: boolean } }) => {
      if (state.throwOnUpdate) throw state.throwOnUpdate;
      let count = 0;
      for (const row of state.notifications) {
        if (row.id === where.id && row.userId === where.userId) {
          row.isRead = data.isRead;
          count++;
        }
      }
      return { count };
    }),
    findFirst: vi.fn(async ({ where }: { where: { id: string; userId: string } }) =>
      state.notifications.find((row) => row.id === where.id && row.userId === where.userId) ?? null,
    ),
  },
}));

vi.mock("../../../src/config/database", () => ({ default: dbMock }));

import notificationRoutes from "../../../src/routes/notification.routes";
import { NotificationRepository } from "../../../src/repositories/notification.repository";
import { NotificationService } from "../../../src/services/notification.service";

describe("Notification ownership boundary (PUT /api/notifications/:id/read)", () => {
  const secret = "notification-ownership-test-secret";
  let server: ReturnType<typeof createServer>;
  let origin: string;

  beforeAll(async () => {
    vi.stubEnv("JWT_SECRET", secret);
    const app = express();
    app.use(express.json());
    app.use("/api/notifications", notificationRoutes);
    server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    state.throwOnUpdate = null;
    state.accounts = {
      "user-a": { id: "user-a", role: "STUDENT", isActive: true, mustChangePassword: false, panelist: null },
      "user-b": { id: "user-b", role: "FACULTY", isActive: true, mustChangePassword: false, panelist: { isActive: true } },
    };
    state.notifications = [
      {
        id: "notif-a",
        userId: "user-a",
        title: "Notice A",
        message: "Owned by User A",
        isRead: false,
        createdAt: new Date("2026-11-10T10:00:00.000Z"),
      },
      {
        id: "notif-b",
        userId: "user-b",
        title: "Notice B",
        message: "Owned by User B",
        isRead: false,
        createdAt: new Date("2026-11-10T10:05:00.000Z"),
      },
    ];
  });

  function req(path: string, userId?: string, method: "GET" | "PUT" = "PUT", body?: Record<string, unknown>) {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (userId) {
      headers.Authorization = `Bearer ${jwt.sign({ userId, role: state.accounts[userId]?.role ?? "STUDENT" }, secret)}`;
    }
    return fetch(`${origin}${path}`, {
      method,
      headers,
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  }

  it("requires authentication before reading or marking notifications as read", async () => {
    const res = await req("/api/notifications/notif-a/read");
    expect(res.status).toBe(401);
    expect(dbMock.notification.updateMany).not.toHaveBeenCalled();
  });

  it("allows an authenticated user to list and mark their own notification as read while ignoring body userId", async () => {
    const listRes = await req("/api/notifications", "user-a", "GET");
    expect(listRes.status).toBe(200);
    expect(await listRes.json()).toHaveLength(1);

    const readRes = await req("/api/notifications/notif-a/read", "user-a", "PUT", { userId: "user-b" });
    expect(readRes.status).toBe(200);
    expect(await readRes.json()).toMatchObject({ id: "notif-a", userId: "user-a", isRead: true });
    expect(dbMock.notification.updateMany).toHaveBeenCalledWith({
      where: { id: "notif-a", userId: "user-a" },
      data: { isRead: true },
    });
    expect(state.notifications.find((n) => n.id === "notif-b")?.isRead).toBe(false);
  });

  it("rejects marking another user's notification without leaking its existence", async () => {
    const foreignRes = await req("/api/notifications/notif-b/read", "user-a", "PUT");
    const foreignBody = await foreignRes.json();

    const missingRes = await req("/api/notifications/nonexistent-id/read", "user-a", "PUT");
    const missingBody = await missingRes.json();

    expect(foreignRes.status).toBe(404);
    expect(missingRes.status).toBe(404);
    expect(foreignBody).toEqual({ error: "Notification not found." });
    expect(missingBody).toEqual(foreignBody);
    expect(state.notifications.find((n) => n.id === "notif-b")?.isRead).toBe(false);
    expect(dbMock.notification.updateMany).toHaveBeenCalledWith({
      where: { id: "notif-b", userId: "user-a" },
      data: { isRead: true },
    });
  });

  it("enforces ownership directly at the service and repository boundaries", async () => {
    const repo = new NotificationRepository();
    const service = new NotificationService();

    await expect(repo.markAsRead("notif-b", "user-a")).resolves.toBeNull();
    await expect(service.markAsRead("notif-b", "user-a")).rejects.toMatchObject({
      statusCode: 404,
      message: "Notification not found.",
    });
    await expect(service.markAsRead("   ", "user-a")).rejects.toMatchObject({
      statusCode: 404,
      message: "Notification not found.",
    });
    expect(state.notifications.find((n) => n.id === "notif-b")?.isRead).toBe(false);

    const own = await service.markAsRead("notif-b", "user-b");
    expect(own).toMatchObject({ id: "notif-b", userId: "user-b", isRead: true });
  });

  it("never exposes raw database internals on unexpected repository errors", async () => {
    state.throwOnUpdate = new Error("SQL constraint secret=leak");
    const res = await req("/api/notifications/notif-a/read", "user-a", "PUT");
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(text).not.toMatch(/SQL|secret=leak/);
    expect(JSON.parse(text)).toEqual({ error: "Failed to update notification." });
  });
});
