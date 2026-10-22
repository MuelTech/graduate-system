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

const layers = routes(thesisRoutes);
const PDF_PATH = "/defense/:scheduleId/records/criteria/:panelAssignmentId/pdf";

function findRoute(path: string, method: string): StackLayer["route"] {
  return layers.find(
    (layer) => layer.route?.path === path && layer.route.methods[method],
  )?.route;
}

describe("FORM-INT-1 individual evaluation PDF route", () => {
  it("is an authenticated ADMIN-only GET route", () => {
    const route = findRoute(PDF_PATH, "get");
    expect(route).toBeDefined();
    // authenticateJWT + requireRole + controller handler
    expect(route?.stack.length).toBe(3);
    expect(route?.stack[0]?.handle).toBe(authenticateJWT);
    expect(Object.keys(route?.methods ?? {})).toEqual(["get"]);
  });

  it("rejects an unauthenticated request through the existing auth boundary", () => {
    const next = vi.fn();
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as any;

    authenticateJWT({ headers: {} } as any, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects non-ADMIN roles with 403 and allows ADMIN", () => {
    const route = findRoute(PDF_PATH, "get");
    const roleGuard = route?.stack[1]?.handle as (req: any, res: any, next: any) => void;
    expect(typeof roleGuard).toBe("function");

    for (const role of ["PANELIST", "STUDENT", "FACULTY"]) {
      const next = vi.fn();
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
      } as any;
      roleGuard({ user: { userId: "u1", role } }, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    }

    const adminNext = vi.fn();
    roleGuard({ user: { userId: "admin-1", role: "ADMIN" } }, {} as any, adminNext);
    expect(adminNext).toHaveBeenCalledTimes(1);
  });

  it("keeps the existing JSON Criteria route unchanged", () => {
    const jsonRoute = findRoute(
      "/defense/:scheduleId/records/criteria/:panelAssignmentId",
      "get",
    );
    expect(jsonRoute).toBeDefined();
    expect(jsonRoute?.stack.length).toBe(3);
  });
});
