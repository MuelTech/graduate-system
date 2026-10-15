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

const COLLAB_ROUTES: Array<[string, string]> = [
  ["/defense/:scheduleId/collaboration/annotations", "get"],
  ["/defense/:scheduleId/collaboration/annotations", "post"],
  ["/defense/:scheduleId/collaboration/annotations/:annotationId/comments", "post"],
  ["/defense/:scheduleId/collaboration/report", "get"],
  ["/defense/:scheduleId/collaboration/report", "put"],
  ["/defense/:scheduleId/collaboration/report/freeze", "post"],
  ["/defense/:scheduleId/collaboration/conclusion-readiness", "get"],
];

describe("CDW-1 collaborative defense routes", () => {
  it.each(COLLAB_ROUTES)("%s %s requires authenticateJWT + a role guard", (path, method) => {
    const route = findRoute(layers, path, method);
    expect(route).toBeDefined();
    // authenticateJWT + requireRole + controller handler
    expect(route?.stack.length).toBe(3);
    expect(route?.stack[0]?.handle).toBe(authenticateJWT);
  });
});
