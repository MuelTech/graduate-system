import { describe, expect, it } from "vitest";
import { authenticateJWT } from "../../../src/middlewares/auth.middleware";
import adminStudentRoutes from "../../../src/routes/admin-student.routes";

interface StackLayer {
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: Array<{ handle: unknown }>;
  };
}

function routes(router: unknown): StackLayer[] {
  return (router as { stack: StackLayer[] }).stack.filter(
    (layer) => layer.route,
  );
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

const layers = routes(adminStudentRoutes);

describe("Admin students routes are ADMIN-only", () => {
  it("GET / requires authenticateJWT + ADMIN", () => {
    const route = findRoute(layers, "/", "get");
    expect(route).toBeDefined();
    expect(route?.stack.length).toBe(3);
    expect(route?.stack[0]?.handle).toBe(authenticateJWT);
  });

  it("GET /:id requires authenticateJWT + ADMIN", () => {
    const route = findRoute(layers, "/:id", "get");
    expect(route).toBeDefined();
    expect(route?.stack[0]?.handle).toBe(authenticateJWT);
  });

  it("PUT /:id/comprehensive-exam requires authenticateJWT + ADMIN", () => {
    const route = findRoute(layers, "/:id/comprehensive-exam", "put");
    expect(route).toBeDefined();
    expect(route?.stack[0]?.handle).toBe(authenticateJWT);
  });

  it("GET /:id/journey requires authenticateJWT + ADMIN", () => {
    const route = findRoute(layers, "/:id/journey", "get");
    expect(route).toBeDefined();
    expect(route?.stack.length).toBe(3);
    expect(route?.stack[0]?.handle).toBe(authenticateJWT);
  });
});
