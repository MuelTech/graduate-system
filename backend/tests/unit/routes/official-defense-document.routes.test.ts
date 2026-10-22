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
const CRITERIA_PDF_PATH = "/defense/:scheduleId/records/criteria/:panelAssignmentId/pdf";
const SUMMARY_PDF_PATH = "/defense/:scheduleId/records/summary/pdf";
const APPLICATION_PDF_PATH = "/defense/:scheduleId/records/application/pdf";

function findRoute(path: string, method: string): StackLayer["route"] {
  return layers.find(
    (layer) => layer.route?.path === path && layer.route.methods[method],
  )?.route;
}

function expectAdminOnlyRoute(path: string): void {
  const route = findRoute(path, "get");
  expect(route).toBeDefined();
  // authenticateJWT + requireRole + controller handler
  expect(route?.stack.length).toBe(3);
  expect(route?.stack[0]?.handle).toBe(authenticateJWT);
  expect(Object.keys(route?.methods ?? {})).toEqual(["get"]);

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
}

describe("FORM-INT-1 individual evaluation PDF route", () => {
  it("is an authenticated ADMIN-only GET route", () => {
    expectAdminOnlyRoute(CRITERIA_PDF_PATH);
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

  it("keeps the existing JSON Criteria route unchanged", () => {
    const jsonRoute = findRoute(
      "/defense/:scheduleId/records/criteria/:panelAssignmentId",
      "get",
    );
    expect(jsonRoute).toBeDefined();
    expect(jsonRoute?.stack.length).toBe(3);
  });
});

describe("FORM-INT-2 GS-011 Oral Examination Summary PDF route", () => {
  it("is an authenticated ADMIN-only GET route", () => {
    expectAdminOnlyRoute(SUMMARY_PDF_PATH);
  });

  it("keeps the existing JSON Summary route ADMIN-only and intact", () => {
    const jsonRoute = findRoute("/defense/:scheduleId/records/summary", "get");
    expect(jsonRoute).toBeDefined();
    expect(jsonRoute?.stack.length).toBe(3);
    expect(jsonRoute?.stack[0]?.handle).toBe(authenticateJWT);

    const roleGuard = jsonRoute?.stack[1]?.handle as (req: any, res: any, next: any) => void;
    const denied = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as any;
    const deniedNext = vi.fn();
    roleGuard({ user: { userId: "p1", role: "PANELIST" } }, denied, deniedNext);
    expect(denied.status).toHaveBeenCalledWith(403);
    expect(deniedNext).not.toHaveBeenCalled();

    const allowedNext = vi.fn();
    roleGuard({ user: { userId: "admin-1", role: "ADMIN" } }, {} as any, allowedNext);
    expect(allowedNext).toHaveBeenCalledTimes(1);
  });
});

describe("FORM-INT-3 Defense Application PDF route", () => {
  it("is an authenticated ADMIN-only GET route", () => {
    expectAdminOnlyRoute(APPLICATION_PDF_PATH);
  });

  it("keeps Criteria and Summary PDF routes intact", () => {
    expect(findRoute(CRITERIA_PDF_PATH, "get")).toBeDefined();
    expect(findRoute(SUMMARY_PDF_PATH, "get")).toBeDefined();
  });
});
