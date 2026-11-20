import { describe, expect, it, vi } from "vitest";
import type { NextFunction, Response } from "express";

vi.mock("../src/config/database", () => ({
  default: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

import prisma from "../src/config/database";
import {
  authenticateJWT,
  requireAnyAdminCapability,
  requireRole,
  type AuthenticatedRequest,
} from "../src/middlewares/auth.middleware";
import curriculumRoutes from "../src/routes/curriculum.routes";
import studentRoutes from "../src/routes/student.routes";
import adminStudentRoutes from "../src/routes/admin-student.routes";

interface StackLayer {
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: Array<{ handle: unknown }>;
  };
}

function findRoute(
  router: unknown,
  path: string,
  method: string,
): StackLayer["route"] {
  const layers = (router as { stack: StackLayer[] }).stack.filter(
    (layer) => layer.route,
  );
  return layers.find(
    (layer) => layer.route?.path === path && layer.route.methods[method],
  )?.route;
}

function makeMockRes() {
  const res = {
    statusCode: 200,
    body: null as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res as unknown as Response & { statusCode: number; body: unknown };
}

describe("Curriculum routes RBAC & registration", () => {
  it("protects Admin Curriculum Master routes with authenticateJWT + ADMIN + settings.manage", () => {
    const adminMasterPaths: Array<[string, string]> = [
      ["/admin", "get"],
      ["/admin/:versionId", "get"],
      ["/admin", "post"],
      ["/admin/:versionId", "put"],
      ["/admin/:versionId/groups", "post"],
      ["/admin/groups/:groupId", "put"],
      ["/admin/groups/:groupId", "delete"],
      ["/admin/groups/:groupId/courses", "post"],
      ["/admin/courses/:courseId", "put"],
      ["/admin/courses/:courseId", "delete"],
    ];

    for (const [path, method] of adminMasterPaths) {
      const route = findRoute(curriculumRoutes, path, method);
      expect(route, `Missing ${method.toUpperCase()} /api/curricula${path}`).toBeDefined();
      expect(route?.stack.length).toBe(4);
      expect(route?.stack[0]?.handle).toBe(authenticateJWT);
    }

    const programLookup = findRoute(
      curriculumRoutes,
      "/programs/:programId/versions",
      "get",
    );
    expect(programLookup).toBeDefined();
    expect(programLookup?.stack.length).toBe(4);
    expect(programLookup?.stack[0]?.handle).toBe(authenticateJWT);
  });

  it("protects Student curriculum routes with authenticateJWT + STUDENT", () => {
    for (const [path, method] of [
      ["/curriculum", "get"],
      ["/curriculum/courses/:courseId", "put"],
      ["/curriculum/publication", "put"],
    ] as const) {
      const route = findRoute(studentRoutes, path, method);
      expect(route, `Missing ${method.toUpperCase()} /api/student${path}`).toBeDefined();
      expect(route?.stack.length).toBe(3);
      expect(route?.stack[0]?.handle).toBe(authenticateJWT);
    }
  });

  it("protects Admin student curriculum routes with authenticateJWT + ADMIN + students.manage", () => {
    for (const [path, method] of [
      ["/:id/curriculum", "get"],
      ["/:id/curriculum/version", "patch"],
      ["/:id/curriculum/courses/:courseId", "put"],
      ["/:id/curriculum/verify-all", "post"],
      ["/:id/curriculum/publication", "put"],
    ] as const) {
      const route = findRoute(adminStudentRoutes, path, method);
      expect(route, `Missing ${method.toUpperCase()} /api/admin/students${path}`).toBeDefined();
      expect(route?.stack.length).toBe(4);
      expect(route?.stack[0]?.handle).toBe(authenticateJWT);
    }
  });

  it("rejects non-STUDENT from Student routes and restricted ADMIN lacking required capability", async () => {
    const studentOnly = requireRole(["STUDENT"]);
    const res1 = makeMockRes();
    const next1 = vi.fn() as unknown as NextFunction;
    studentOnly(
      { user: { userId: "u1", role: "ADMIN" } } as AuthenticatedRequest,
      res1,
      next1,
    );
    expect(res1.statusCode).toBe(403);
    expect(next1).not.toHaveBeenCalled();

    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      isActive: true,
      role: "ADMIN",
      adminAccessLevel: "RESTRICTED",
      adminCapabilities: ["dashboard.view"],
    } as never);

    const anyCap = requireAnyAdminCapability(["students.manage", "settings.manage"]);
    const res2 = makeMockRes();
    const next2 = vi.fn() as unknown as NextFunction;
    await anyCap(
      { user: { userId: "admin-r", role: "ADMIN" } } as AuthenticatedRequest,
      res2,
      next2,
    );
    expect(res2.statusCode).toBe(403);
    expect(next2).not.toHaveBeenCalled();

    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      isActive: true,
      role: "ADMIN",
      adminAccessLevel: "RESTRICTED",
      adminCapabilities: ["students.manage"],
    } as never);
    const res3 = makeMockRes();
    const next3 = vi.fn() as unknown as NextFunction;
    await anyCap(
      { user: { userId: "admin-s", role: "ADMIN" } } as AuthenticatedRequest,
      res3,
      next3,
    );
    expect(next3).toHaveBeenCalledTimes(1);
  });
});
