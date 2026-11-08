import { beforeEach, describe, expect, it, vi } from "vitest";
const methods = vi.hoisted(() => ({ getManagementContext: vi.fn(), getAllPanelists: vi.fn(), getPanelistById: vi.fn(), createPanelist: vi.fn(), updatePanelist: vi.fn() }));
vi.mock("../../../src/services/admin-panelist.service", () => ({ AdminPanelistService: class { constructor() { Object.assign(this, methods); } } }));
import { AdminPanelistController } from "../../../src/controllers/admin-panelist.controller";
import { AppError } from "../../../src/utils/AppError";
const controller = new AdminPanelistController();
const response = () => ({ status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis(), setHeader: vi.fn() }) as any;
beforeEach(() => { vi.resetAllMocks(); });
describe("FACULTY-10 controller identity and creation response", () => {
  it("page context uses authenticated identity, no-store and safe failure responses", async () => {
    methods.getManagementContext.mockResolvedValue({ canManage: false });
    const res = response(); const req = { user: { userId: "actor" }, query: { actorId: "attacker" } } as any;
    await controller.getManagementContext(req, res);
    expect(methods.getManagementContext).toHaveBeenCalledWith("actor");
    expect(res.json).toHaveBeenCalledWith({ canManage: false });
    expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "private, no-store");
    for (const statusCode of [403, 503]) {
      methods.getManagementContext.mockRejectedValue(new AppError("Unavailable", statusCode));
      await controller.getManagementContext(req, res); expect(res.status).toHaveBeenLastCalledWith(statusCode);
    }
    methods.getManagementContext.mockRejectedValue(new Error("SQL private"));
    await controller.getManagementContext(req, res);
    expect(res.status).toHaveBeenLastCalledWith(500);
    expect(res.json).toHaveBeenLastCalledWith({ error: "Faculty configuration is unavailable." });
  });
  it("list and detail pass only authenticated actor identity", async () => {
    methods.getAllPanelists.mockResolvedValue([]); methods.getPanelistById.mockResolvedValue({ id: "profile" });
    const req = { user: { userId: "actor", role: "ADMIN" }, params: { id: "profile" }, query: { actorId: "attacker" } } as any;
    await controller.getAllPanelists(req, response()); await controller.getPanelistById(req, response());
    expect(methods.getAllPanelists).toHaveBeenCalledWith("actor"); expect(methods.getPanelistById).toHaveBeenCalledWith("profile", "actor");
  });
  it("creation response is no-store and mutations derive actor from authentication", async () => {
    const created = { account: { id: "profile" }, temporaryPassword: "synthetic-one-time-response" };
    methods.createPanelist.mockResolvedValue(created); const res = response();
    const body = { firstName: "Faculty", actorId: "attacker" };
    await controller.createPanelist({ user: { userId: "actor", role: "ADMIN" }, body } as any, res);
    expect(methods.createPanelist).toHaveBeenCalledWith(body, "actor"); expect(res.status).toHaveBeenCalledWith(201);
    expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "private, no-store"); expect(res.json).toHaveBeenCalledWith(created);
    await controller.updatePanelist({ user: { userId: "actor", role: "ADMIN" }, params: { id: "profile" }, body } as any, response());
    expect(methods.updatePanelist).toHaveBeenCalledWith("profile", body, "actor");
  });
  it("unauthenticated writes never enter provisioning", async () => {
    const res = response(); await controller.createPanelist({ body: {} } as any, res);
    expect(res.status).toHaveBeenCalledWith(401); expect(methods.createPanelist).not.toHaveBeenCalled();
  });
  it("unexpected persistence failures never serialize hashes, credentials or database details", async () => {
    methods.createPanelist.mockRejectedValue(new Error("passwordHash=private-hash; SQL details")); const res = response();
    await controller.createPanelist({ user: { userId: "actor" }, body: {} } as any, res);
    expect(res.status).toHaveBeenCalledWith(500); expect(res.json).toHaveBeenCalledWith({ error: "Faculty configuration is unavailable." });
  });
  it("controlled authorization/conflict errors preserve status", async () => {
    methods.updatePanelist.mockRejectedValue(new AppError("This Adviser classification requires institutional review.", 409));
    const res = response(); await controller.updatePanelist({ user: { userId: "actor" }, params: { id: "profile" }, body: {} } as any, res);
    expect(res.status).toHaveBeenCalledWith(409);
  });
});
