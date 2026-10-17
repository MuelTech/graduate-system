import jwt from "jsonwebtoken";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createDefenseSocketAuthMiddleware } from "../../../src/realtime/defense-realtime.auth";
import {
  JwtConfigurationError,
  JwtVerificationError,
  verifyAccessToken,
} from "../../../src/utils/jwt";

const SECRET = "cdw8-socket-auth-secret";

function sign(
  payload: Record<string, unknown> = { userId: "u-1", role: "PANELIST" },
  options: jwt.SignOptions = {},
) {
  return jwt.sign(payload, SECRET, options);
}

function makeSocket(auth: unknown, query: unknown = {}) {
  return {
    handshake: { auth, query },
    data: {} as Record<string, unknown>,
  };
}

function runMiddleware(
  middleware: ReturnType<typeof createDefenseSocketAuthMiddleware>,
  socket: ReturnType<typeof makeSocket>,
) {
  const next = vi.fn();
  middleware(socket as never, next);
  return next;
}

describe("Defense socket JWT authentication", () => {
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

  it("denies a connection with no token", () => {
    const socket = makeSocket(undefined);
    const next = runMiddleware(createDefenseSocketAuthMiddleware(), socket);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(socket.data).toEqual({});
  });

  it("denies an invalid token", () => {
    const socket = makeSocket({ token: "not-a-jwt" });
    const next = runMiddleware(createDefenseSocketAuthMiddleware(), socket);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(socket.data).toEqual({});
  });

  it("denies an expired token", () => {
    const socket = makeSocket({ token: sign(undefined, { expiresIn: -10 }) });
    const next = runMiddleware(createDefenseSocketAuthMiddleware(), socket);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(socket.data).toEqual({});
  });

  it("does not accept a token supplied through the URL query", () => {
    const token = sign();
    const socket = makeSocket(undefined, { token });
    const next = runMiddleware(createDefenseSocketAuthMiddleware(), socket);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(socket.data).toEqual({});
  });

  it("does not accept a client-supplied userId or role", () => {
    const token = sign();
    const socket = makeSocket({
      token,
      userId: "attacker",
      role: "ADMIN",
    });
    const next = runMiddleware(createDefenseSocketAuthMiddleware(), socket);

    expect(next).toHaveBeenCalledWith();
    expect(socket.data).toEqual({ userId: "u-1", role: "PANELIST" });
  });

  it("authenticates a valid token and exposes only the token identity", () => {
    const socket = makeSocket({ token: sign() });
    const next = runMiddleware(createDefenseSocketAuthMiddleware(), socket);

    expect(next).toHaveBeenCalledWith();
    expect(socket.data).toEqual({ userId: "u-1", role: "PANELIST" });
  });

  it("rejects a token without a userId or role payload", () => {
    const socket = makeSocket({ token: sign({ role: "PANELIST" }) });
    const next = runMiddleware(createDefenseSocketAuthMiddleware(), socket);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(socket.data).toEqual({});
  });
});

describe("verifyAccessToken (shared REST/socket verifier)", () => {
  const originalSecret = process.env.JWT_SECRET;

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalSecret;
    }
  });

  it("throws a configuration error when JWT_SECRET is missing", () => {
    delete process.env.JWT_SECRET;

    expect(() => verifyAccessToken("anything")).toThrow(JwtConfigurationError);
  });

  it("throws a verification error for an invalid token", () => {
    process.env.JWT_SECRET = SECRET;

    expect(() => verifyAccessToken("not-a-jwt")).toThrow(JwtVerificationError);
  });

  it("returns the exact identity from a valid token", () => {
    process.env.JWT_SECRET = SECRET;

    expect(verifyAccessToken(sign())).toEqual({
      userId: "u-1",
      role: "PANELIST",
    });
  });
});
