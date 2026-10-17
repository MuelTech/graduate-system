import { describe, expect, it, vi } from "vitest";

// thesis.routes imports controllers -> services -> prisma; replace the client.
vi.mock("../../../src/config/database", () => ({ default: {} }));

import { authenticateJWT } from "../../../src/middlewares/auth.middleware";
import thesisRoutes from "../../../src/routes/thesis.routes";

interface StackLayer {
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: Array<{ handle: unknown }>;
  };
}

function routes(router: unknown): StackLayer[] {
  return (router as { stack: StackLayer[] }).stack.filter((layer) => layer.route);
}

function findRoute(layers: StackLayer[], path: string, method: string): StackLayer["route"] {
  return layers.find((layer) => layer.route?.path === path && layer.route.methods[method])?.route;
}

const layers = routes(thesisRoutes);

const HISTORY_READ_ROUTES: Array<[string, string]> = [
  ["/defense/:scheduleId/history", "get"],
  ["/defense/:scheduleId/history/:historicalScheduleId", "get"],
];

describe("CDW-6 defense history routes (read-only)", () => {
  it.each(HISTORY_READ_ROUTES)("%s %s is authenticated + role-guarded", (path, method) => {
    const route = findRoute(layers, path, method);
    expect(route).toBeDefined();
    // authenticateJWT + requireRole + controller handler
    expect(route?.stack.length).toBe(3);
    expect(route?.stack[0]?.handle).toBe(authenticateJWT);
  });

  it("introduces NO history write route (POST/PUT/PATCH/DELETE)", () => {
    const historyWrites = layers.filter(
      (layer) =>
        layer.route?.path.includes("/history") &&
        Object.keys(layer.route.methods).some((method) => method !== "get"),
    );
    expect(historyWrites).toHaveLength(0);
  });

  it("the current-attempt workspace remains the assignment authority (no unguarded history route)", () => {
    for (const [path] of HISTORY_READ_ROUTES) {
      const route = findRoute(layers, path, "get");
      // Every history route is behind the authentication + role middleware stack;
      // exact schedule-assignment authority is enforced inside DefenseHistoryService.
      expect(route?.stack.length).toBe(3);
    }
  });
});
