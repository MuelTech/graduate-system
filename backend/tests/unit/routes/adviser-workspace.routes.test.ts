import { describe, expect, it } from "vitest";
import { authenticateJWT } from "../../../src/middlewares/auth.middleware";
import thesisRoutes from "../../../src/routes/thesis.routes";

/**
 * ADV-2: both Adviser workspace read endpoints are authenticated PANELIST
 * endpoints. They are read-only foundation routes; no mutation is added.
 */
interface StackLayer {
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: Array<{ handle: unknown }>;
  };
}

function routeLayers(): StackLayer[] {
  return (thesisRoutes as unknown as { stack: StackLayer[] }).stack.filter(
    (layer) => layer.route,
  );
}

function findGet(path: string): StackLayer["route"] {
  return routeLayers().find(
    (layer) => layer.route?.path === path && layer.route.methods.get,
  )?.route;
}

describe("ADV-2 adviser workspace routes", () => {
  it("GET /adviser/workspace is authenticated and PANELIST-gated", () => {
    const route = findGet("/adviser/workspace");

    expect(route).toBeDefined();
    expect(route?.stack[0]?.handle).toBe(authenticateJWT);
    expect(route?.stack.length).toBe(3);
  });

  it("GET /adviser/advisees/:studentId is authenticated and PANELIST-gated", () => {
    const route = findGet("/adviser/advisees/:studentId");

    expect(route).toBeDefined();
    expect(route?.stack[0]?.handle).toBe(authenticateJWT);
    expect(route?.stack.length).toBe(3);
  });
});
