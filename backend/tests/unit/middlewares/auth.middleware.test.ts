import jwt from "jsonwebtoken";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
  },
}));

vi.mock("../../../src/config/database", () => ({
  default: dbMock,
}));

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

describe("REST JWT authentication (shared verifier + live session check)", () => {
  const originalSecret = process.env.JWT_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = SECRET;
    dbMock.user.findUnique.mockResolvedValue({
      isActive: true,
      role: "PANELIST",
      tokenVersion: 1,
      panelist: { isActive: true },
    });
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalSecret;
    }
  });

  it("accepts a valid bearer token for an active user and attaches the exact identity", async () => {
    const token = jwt.sign(
      { userId: "u-1", role: "PANELIST", tokenVersion: 1 },
      SECRET,
    );
    const req = makeReq(`Bearer ${token}`);
    const res = makeRes();
    const next = vi.fn();

    await authenticateJWT(req as never, res as never, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect((req as { user?: unknown }).user).toEqual({
      userId: "u-1",
      role: "PANELIST",
    });
  });

  it("immediately rejects a deactivated user account with 403 ACCOUNT_DEACTIVATED", async () => {
    dbMock.user.findUnique.mockResolvedValue({
      isActive: false,
      role: "STUDENT",
      tokenVersion: 2,
      panelist: null,
    });
    const token = jwt.sign(
      { userId: "u-disabled", role: "STUDENT", tokenVersion: 1 },
      SECRET,
    );
    const req = makeReq(`Bearer ${token}`);
    const res = makeRes();
    const next = vi.fn();

    await authenticateJWT(req as never, res as never, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "ACCOUNT_DEACTIVATED" }),
    );
  });

  it("immediately rejects an inactive Faculty profile even if User.isActive is true", async () => {
    dbMock.user.findUnique.mockResolvedValue({
      isActive: true,
      role: "FACULTY",
      tokenVersion: 1,
      panelist: { isActive: false },
    });
    const token = jwt.sign(
      { userId: "u-fac", role: "FACULTY", tokenVersion: 1 },
      SECRET,
    );
    const req = makeReq(`Bearer ${token}`);
    const res = makeRes();
    const next = vi.fn();

    await authenticateJWT(req as never, res as never, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "ACCOUNT_DEACTIVATED" }),
    );
  });

  it("immediately rejects a stale tokenVersion after password reset or reactivation with 401 SESSION_INVALIDATED", async () => {
    dbMock.user.findUnique.mockResolvedValue({
      isActive: true,
      role: "STUDENT",
      tokenVersion: 2,
      panelist: null,
    });
    const token = jwt.sign(
      { userId: "u-1", role: "STUDENT", tokenVersion: 1 },
      SECRET,
    );
    const req = makeReq(`Bearer ${token}`);
    const res = makeRes();
    const next = vi.fn();

    await authenticateJWT(req as never, res as never, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "SESSION_INVALIDATED" }),
    );
  });

  it("returns 401 when no authentication token is provided", async () => {
    const res = makeRes();
    const next = vi.fn();

    await authenticateJWT(makeReq() as never, res as never, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("returns 403 for an invalid token", async () => {
    const res = makeRes();
    const next = vi.fn();

    await authenticateJWT(makeReq("Bearer not-a-jwt") as never, res as never, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("returns 403 for an expired token", async () => {
    const token = jwt.sign({ userId: "u-1", role: "PANELIST" }, SECRET, {
      expiresIn: -10,
    });
    const res = makeRes();
    const next = vi.fn();

    await authenticateJWT(makeReq(`Bearer ${token}`) as never, res as never, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("returns 500 when JWT_SECRET is missing", async () => {
    delete process.env.JWT_SECRET;
    const res = makeRes();
    const next = vi.fn();

    await authenticateJWT(makeReq("Bearer anything") as never, res as never, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
