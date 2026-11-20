import { describe, expect, it, vi } from "vitest";
import {
  evaluateActiveUserSession,
  verifyActiveUserSession,
} from "../../../src/services/session-validation.service";
import { createDefenseSocketAuthMiddleware } from "../../../src/realtime/defense-realtime.auth";
import { verifyAccessToken } from "../../../src/utils/jwt";
import jwt from "jsonwebtoken";

const SECRET = "phase1-session-invalidation-secret";

describe("Phase 1 — Immediate JWT & Realtime Session Invalidation", () => {
  describe("verifyAccessToken tokenVersion parsing", () => {
    it("preserves legacy tokens without tokenVersion and parses valid integer tokenVersion", () => {
      const legacyToken = jwt.sign({ userId: "u-1", role: "STUDENT" }, SECRET);
      expect(verifyAccessToken(legacyToken, SECRET)).toEqual({
        userId: "u-1",
        role: "STUDENT",
      });

      const versionedToken = jwt.sign(
        { userId: "u-1", role: "STUDENT", tokenVersion: 3 },
        SECRET,
      );
      expect(verifyAccessToken(versionedToken, SECRET)).toEqual({
        userId: "u-1",
        role: "STUDENT",
        tokenVersion: 3,
      });
    });
  });

  describe("evaluateActiveUserSession", () => {
    it("accepts active user with matching tokenVersion", () => {
      expect(
        evaluateActiveUserSession(
          { userId: "u-1", role: "STUDENT", tokenVersion: 2 },
          { isActive: true, role: "STUDENT", tokenVersion: 2, panelist: null },
        ),
      ).toEqual({ ok: true });
    });

    it("rejects missing user with SESSION_INVALIDATED", () => {
      const result = evaluateActiveUserSession(
        { userId: "u-missing", role: "STUDENT", tokenVersion: 1 },
        null,
      );
      expect(result).toMatchObject({ ok: false, code: "SESSION_INVALIDATED" });
    });

    it("immediately rejects deactivated user with ACCOUNT_DEACTIVATED", () => {
      const result = evaluateActiveUserSession(
        { userId: "u-1", role: "STUDENT", tokenVersion: 1 },
        { isActive: false, role: "STUDENT", tokenVersion: 1, panelist: null },
      );
      expect(result).toMatchObject({ ok: false, code: "ACCOUNT_DEACTIVATED" });
    });

    it("immediately rejects inactive Faculty profile with ACCOUNT_DEACTIVATED", () => {
      const result = evaluateActiveUserSession(
        { userId: "u-fac", role: "FACULTY", tokenVersion: 1 },
        {
          isActive: true,
          role: "FACULTY",
          tokenVersion: 1,
          panelist: { isActive: false },
        },
      );
      expect(result).toMatchObject({ ok: false, code: "ACCOUNT_DEACTIVATED" });
    });

    it("immediately rejects stale tokenVersion (including legacy tokens without claim once bumped to >= 2)", () => {
      const staleVersioned = evaluateActiveUserSession(
        { userId: "u-1", role: "ADMIN", tokenVersion: 1 },
        { isActive: true, role: "ADMIN", tokenVersion: 2, panelist: null },
      );
      expect(staleVersioned).toMatchObject({
        ok: false,
        code: "SESSION_INVALIDATED",
      });

      const staleLegacy = evaluateActiveUserSession(
        { userId: "u-1", role: "ADMIN" },
        { isActive: true, role: "ADMIN", tokenVersion: 2, panelist: null },
      );
      expect(staleLegacy).toMatchObject({
        ok: false,
        code: "SESSION_INVALIDATED",
      });
    });
  });

  describe("verifyActiveUserSession DB lookup", () => {
    it("queries User isActive, role, tokenVersion, and panelist.isActive", async () => {
      const findUnique = vi.fn().mockResolvedValue({
        isActive: true,
        role: "FACULTY",
        tokenVersion: 4,
        panelist: { isActive: true },
      });

      const result = await verifyActiveUserSession(
        { userId: "u-fac", role: "FACULTY", tokenVersion: 4 },
        { user: { findUnique } as never },
      );

      expect(result).toEqual({ ok: true });
      expect(findUnique).toHaveBeenCalledWith({
        where: { id: "u-fac" },
        select: {
          isActive: true,
          role: true,
          tokenVersion: true,
          panelist: { select: { isActive: true } },
        },
      });
    });
  });

  describe("Defense Socket.IO handshake active-session check", () => {
    it("rejects socket handshake with ACCOUNT_DEACTIVATED when verifyActiveSession fails", async () => {
      const token = jwt.sign(
        { userId: "u-fac", role: "FACULTY", tokenVersion: 1 },
        SECRET,
      );
      const middleware = createDefenseSocketAuthMiddleware({
        verifyToken: (t) => verifyAccessToken(t, SECRET),
        verifyActiveSession: async () => ({
          ok: false,
          code: "ACCOUNT_DEACTIVATED",
          error: "Account deactivated",
        }),
      });

      const err = await new Promise<Error | undefined>((resolve) => {
        const socket = {
          handshake: { auth: { token } },
          data: {} as Record<string, unknown>,
        };
        middleware(socket, (nextErr) => resolve(nextErr));
      });

      expect(err).toBeInstanceOf(Error);
      expect(err?.message).toBe("ACCOUNT_DEACTIVATED");
    });

    it("accepts socket handshake when verifyActiveSession succeeds", async () => {
      const token = jwt.sign(
        { userId: "u-fac", role: "FACULTY", tokenVersion: 2 },
        SECRET,
      );
      const middleware = createDefenseSocketAuthMiddleware({
        verifyToken: (t) => verifyAccessToken(t, SECRET),
        verifyActiveSession: async () => ({ ok: true }),
      });

      const socket = {
        handshake: { auth: { token } },
        data: {} as Record<string, unknown>,
      };
      const err = await new Promise<Error | undefined>((resolve) => {
        middleware(socket, (nextErr) => resolve(nextErr));
      });

      expect(err).toBeUndefined();
      expect(socket.data.userId).toBe("u-fac");
      expect(socket.data.role).toBe("FACULTY");
    });
  });
});
