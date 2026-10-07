import { describe, expect, it, vi } from "vitest";

// Avoid importing the Redis-backed email service when loading the router.
vi.mock("../../../src/services/email.service", () => ({
  EmailService: { sendTemplateEmail: vi.fn(), sendBatch: vi.fn() },
}));

import { authenticateJWT } from "../../../src/middlewares/auth.middleware";
import examRoutes from "../../../src/routes/exam.routes";

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

const layers = routes(examRoutes);

describe("Exam record detail route", () => {
  it("GET /applications/:id requires authenticateJWT + ADMIN", () => {
    const route = findRoute(layers, "/applications/:id", "get");
    expect(route).toBeDefined();
    expect(route?.stack.length).toBe(3);
    expect(route?.stack[0]?.handle).toBe(authenticateJWT);
  });

  it("keeps the existing ADMIN-only list route intact", () => {
    const route = findRoute(layers, "/applications", "get");
    expect(route).toBeDefined();
    expect(route?.stack[0]?.handle).toBe(authenticateJWT);
  });
});
