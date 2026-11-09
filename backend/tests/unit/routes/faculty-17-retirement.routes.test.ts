import express from "express";
import type { Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const repo = vi.hoisted(() => ({ findUserByEmail: vi.fn(), findUserByEmailAndRole: vi.fn() }));
vi.mock("../../../src/repositories/auth.repository", () => ({ AuthRepository: class {
  findUserByEmail = repo.findUserByEmail;
  findUserByEmailAndRole = repo.findUserByEmailAndRole;
} }));
vi.mock("../../../src/config/database", () => ({ default: {} }));
const compare = vi.hoisted(() => vi.fn());
vi.mock("bcryptjs", () => ({ default: { compare } }));
import authRoutes from "../../../src/routes/auth.routes";

describe("FACULTY-17 real HTTP retired-login boundary", () => {
  let server: Server, base: string;
  beforeAll(async () => {
    const app = express(); app.use(express.json()); app.use("/api/auth", authRoutes);
    await new Promise<void>(resolve => { server = app.listen(0, "127.0.0.1", () => resolve()); });
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  });
  beforeEach(() => vi.clearAllMocks());
  afterAll(async () => { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); });
  it.each(["other", "custom", "CUSTOM", "OTHER", "Other Roles"])("rejects manually posted %s before account/password lookup", async role => {
    const response = await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, email: "retired@example.invalid", password: "synthetic", selectedRole: "admin" }) });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid selected login role." });
    expect(repo.findUserByEmail).not.toHaveBeenCalled(); expect(repo.findUserByEmailAndRole).not.toHaveBeenCalled(); expect(compare).not.toHaveBeenCalled();
  });
});
