import { createServer, type Server as HttpServer } from "http";
import type { AddressInfo } from "net";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/config/database", () => ({ default: {} }));

import { createApp } from "../../../src/app";
import {
  getDefenseRealtimeServer,
  initializeDefenseRealtime,
  shutdownDefenseRealtime,
} from "../../../src/realtime/defense-realtime.server";

const store = {
  getSessionStatus: vi.fn(async () => "SCHEDULED"),
  hasPanelAssignment: vi.fn(async () => true),
  listAssignedUserIds: vi.fn(async () => new Set<string>()),
};

const logger = { info: vi.fn(), error: vi.fn() };

async function listen(httpServer: HttpServer): Promise<number> {
  await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
  return (httpServer.address() as AddressInfo).port;
}

async function close(httpServer: HttpServer): Promise<void> {
  if (!httpServer.listening) return;
  await new Promise<void>((resolve, reject) =>
    httpServer.close((error) => (error ? reject(error) : resolve())),
  );
}

describe("shared HTTP server bootstrap", () => {
  afterEach(async () => {
    await shutdownDefenseRealtime();
  });

  it("serves the REST health endpoint and Socket.IO from one HTTP server", async () => {
    const app = createApp();
    const httpServer = createServer(app);
    const port = await listen(httpServer);

    const server = initializeDefenseRealtime(httpServer, {
      store,
      logger,
      verifyToken: () => ({ userId: "u-1", role: "PANELIST" }),
    });

    expect(server.io.httpServer).toBe(httpServer);
    expect(getDefenseRealtimeServer()).toBe(server);
    expect(httpServer.listening).toBe(true);

    const response = await fetch(`http://127.0.0.1:${port}/api/health`);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: "ok",
      message: "Graduate School System API is running",
    });

    await shutdownDefenseRealtime();
    expect(getDefenseRealtimeServer()).toBeNull();
    await close(httpServer);
  });

  it("does not listen on a second port when realtime initializes", async () => {
    const app = createApp();
    const httpServer = createServer(app);
    const port = await listen(httpServer);

    const server = initializeDefenseRealtime(httpServer, {
      store,
      logger,
      verifyToken: () => ({ userId: "u-1", role: "PANELIST" }),
    });

    expect((httpServer.address() as AddressInfo).port).toBe(port);
    expect(server.io.httpServer).toBe(httpServer);

    await shutdownDefenseRealtime();
    await close(httpServer);
  });
});
