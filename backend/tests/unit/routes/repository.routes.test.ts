import { describe, expect, it, vi } from "vitest";
import { authenticateJWT, requireRole, type AuthenticatedRequest } from "../../../src/middlewares/auth.middleware";
import repositoryRoutes from "../../../src/routes/repository.routes";

/**
 * DL-10 route-shape + authorization tests.
 *
 * The public Repository routes must not consult authentication at all, while
 * the Admin publication routes must require an authenticated ADMIN.
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

const layers = routes(repositoryRoutes);

describe("DL-10 public Repository routes are auth-free", () => {
  it("GET / has exactly one handler (no auth middleware)", () => {
    const route = findRoute(layers, "/", "get");
    expect(route).toBeDefined();
    expect(route?.stack.length).toBe(1);
  });

  it("GET /:id has exactly one handler (no auth middleware)", () => {
    const route = findRoute(layers, "/:id", "get");
    expect(route).toBeDefined();
    expect(route?.stack.length).toBe(1);
  });
});

describe("DL-10 admin Repository routes require ADMIN", () => {
  const adminRoutes: Array<[string, string]> = [
    ["/admin/entries", "get"],
    ["/admin/entries/:id/publish", "put"],
    ["/admin/entries/:id/unpublish", "put"],
  ];

  it.each(adminRoutes)("%s %s starts with authenticateJWT", (path, method) => {
    const route = findRoute(layers, path, method);
    expect(route).toBeDefined();
    expect(route?.stack.length).toBe(3);
    expect(route?.stack[0]?.handle).toBe(authenticateJWT);
  });

  it("route ordering does not treat 'admin' as a publication id", () => {
    const adminIndex = layers.findIndex(
      (layer) => layer.route?.path === "/admin/entries",
    );
    const idIndex = layers.findIndex((layer) => layer.route?.path === "/:id");
    expect(adminIndex).toBeGreaterThanOrEqual(0);
    expect(adminIndex).toBeLessThan(idIndex);
  });
});

describe("DL-10 requireRole enforcement", () => {
  it("rejects non-admin roles with 403 and never calls next", () => {
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as any;
    const next = vi.fn();
    const mw = requireRole(["ADMIN"]);

    for (const role of ["STUDENT", "PANELIST", "APPLICANT"]) {
      res.status.mockClear();
      next.mockClear();
      mw({ user: { userId: "u", role } } as AuthenticatedRequest, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    }
  });

  it("allows ADMIN through", () => {
    const res = {} as any;
    const next = vi.fn();
    const mw = requireRole(["ADMIN"]);
    mw({ user: { userId: "u", role: "ADMIN" } } as AuthenticatedRequest, res, next);
    expect(next).toHaveBeenCalled();
  });
});
