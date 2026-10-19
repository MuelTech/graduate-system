import jwt from "jsonwebtoken";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { authenticateJWT } from "../../../src/middlewares/auth.middleware";

const SECRET = "cdw8-rest-auth-secret";

function makeReq(authorization?: string) {
  return { headers: authorization ? { authorization } : {} } as never;
}

function makeRes() {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
  };
  res.status.mockReturnValue(res);
  return res as never as {
    status: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
  };
}

describe("REST JWT authentication (shared verifier)", () => {
  const originalSecret = process.env.JWT_SECRET;

  beforeEach(() => {
    process.env.JWT_SECRET = SECRET;
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalSecret;
    }
  });

  it("accepts a valid bearer token and attaches the exact identity", () => {
    const token = jwt.sign({ userId: "u-1", role: "PANELIST" }, SECRET);
    const req = makeReq(`Bearer ${token}`);
    const res = makeRes();
    const next = vi.fn();

    authenticateJWT(req as never, res as never, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect((req as { user?: unknown }).user).toEqual({
      userId: "u-1",
      role: "PANELIST",
    });
  });

  it("returns 401 when no authentication token is provided", () => {
    const res = makeRes();
    const next = vi.fn();

    authenticateJWT(makeReq() as never, res as never, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("returns 403 for an invalid token", () => {
    const res = makeRes();
    const next = vi.fn();

    authenticateJWT(makeReq("Bearer not-a-jwt") as never, res as never, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("returns 403 for an expired token", () => {
    const token = jwt.sign({ userId: "u-1", role: "PANELIST" }, SECRET, {
      expiresIn: -10,
    });
    const res = makeRes();
    const next = vi.fn();

    authenticateJWT(makeReq(`Bearer ${token}`) as never, res as never, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("returns 500 when JWT_SECRET is missing", () => {
    delete process.env.JWT_SECRET;
    const res = makeRes();
    const next = vi.fn();

    authenticateJWT(makeReq("Bearer anything") as never, res as never, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
