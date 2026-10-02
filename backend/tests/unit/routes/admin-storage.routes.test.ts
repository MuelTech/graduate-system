import { describe, expect, it } from "vitest";
import { authenticateJWT } from "../../../src/middlewares/auth.middleware";
import adminStorageRoutes from "../../../src/routes/admin-storage.routes";

/**
 * DL-11: the storage health/scan routes are ADMIN-only. There is no public
 * storage endpoint.
 */
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

function findRoute(
  layers: StackLayer[],
  path: string,
  method: string,
): StackLayer["route"] {
  return layers.find(
    (layer) => layer.route?.path === path && layer.route.methods[method],
  )?.route;
}

const layers = routes(adminStorageRoutes);

describe("DL-11 admin storage routes", () => {
  it("GET /health requires authenticateJWT + ADMIN", () => {
    const route = findRoute(layers, "/health", "get");
    expect(route).toBeDefined();
    expect(route?.stack.length).toBe(3);
    expect(route?.stack[0]?.handle).toBe(authenticateJWT);
  });

  it("POST /integrity-scan requires authenticateJWT + ADMIN", () => {
    const route = findRoute(layers, "/integrity-scan", "post");
    expect(route).toBeDefined();
    expect(route?.stack.length).toBe(3);
    expect(route?.stack[0]?.handle).toBe(authenticateJWT);
  });

  it("exposes no public (unauthenticated) storage route", () => {
    for (const layer of layers) {
      expect(layer.route?.stack[0]?.handle).toBe(authenticateJWT);
    }
  });
});
