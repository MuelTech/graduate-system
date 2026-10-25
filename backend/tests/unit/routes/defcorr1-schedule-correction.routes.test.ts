import { describe, expect, it, vi } from "vitest";

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

describe("DEF-CORR-1 Admin schedule correction route", () => {
  it("exposes PATCH /defense/schedules/:scheduleId behind authentication and Admin authorization", () => {
    const route = routes(thesisRoutes).find(
      (layer) =>
        layer.route?.path === "/defense/schedules/:scheduleId" &&
        layer.route.methods.patch,
    )?.route;

    expect(route).toBeDefined();
    expect(route?.stack).toHaveLength(3);
    expect(route?.stack[0]?.handle).toBe(authenticateJWT);
  });

  it("does not expose the correction mutation through other write methods", () => {
    const writes = routes(thesisRoutes).filter(
      (layer) =>
        layer.route?.path === "/defense/schedules/:scheduleId" &&
        ["post", "put", "delete"].some(
          (method) => layer.route?.methods[method],
        ),
    );
    expect(writes).toHaveLength(0);
  });
});
