import { beforeEach, describe, expect, it, vi } from "vitest";
import { STUDENT_SIGNATURE } from "../../fixtures/adviser-request-signed";
import {
  emptyUserSignatureVault,
  UserSignatureService,
} from "../../../src/services/user-signature.service";

const prismaMock = vi.hoisted(() => ({
  userSignature: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
  },
  $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(prismaMock)),
}));

vi.mock("../../../src/config/database", () => ({ default: prismaMock }));

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.userSignature.findUnique.mockResolvedValue(null);
  prismaMock.auditLog.create.mockResolvedValue({ id: "audit-1" });
});

describe("UserSignatureService", () => {
  it("returns empty vault when user has no saved signature", async () => {
    const service = new UserSignatureService(prismaMock);
    const result = await service.getVault("user-1");

    expect(result).toEqual(emptyUserSignatureVault());
    expect(result.hasSignature).toBe(false);
    expect(result.version).toBe(0);
  });

  it("creates initial signature with version 1 and writes audit log", async () => {
    const now = new Date("2026-11-17T04:00:00.000Z");
    prismaMock.userSignature.findUnique.mockResolvedValueOnce(null);
    prismaMock.userSignature.create.mockResolvedValueOnce({
      id: "sig-1",
      signatureData: STUDENT_SIGNATURE,
      method: "UPLOAD",
      version: 1,
      updatedAt: now,
    });

    const service = new UserSignatureService(prismaMock);
    const result = await service.saveVault("user-1", {
      signatureData: STUDENT_SIGNATURE,
      method: "upload",
    });

    expect(result).toEqual({
      hasSignature: true,
      signatureData: STUDENT_SIGNATURE,
      method: "UPLOAD",
      version: 1,
      updatedAt: now.toISOString(),
    });
    expect(prismaMock.userSignature.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user-1",
          signatureData: STUDENT_SIGNATURE,
          method: "UPLOAD",
          version: 1,
        }),
      }),
    );
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorId: "user-1",
          actionType: "USER_SIGNATURE_SAVED",
          targetTable: "user_signatures",
          targetId: "sig-1",
        }),
      }),
    );
  });

  it("increments version when updating an existing saved signature", async () => {
    const now = new Date("2026-11-17T04:10:00.000Z");
    prismaMock.userSignature.findUnique.mockResolvedValueOnce({
      id: "sig-1",
      version: 1,
      method: "UPLOAD",
    });
    prismaMock.userSignature.update.mockResolvedValueOnce({
      id: "sig-1",
      signatureData: STUDENT_SIGNATURE,
      method: "DRAW",
      version: 2,
      updatedAt: now,
    });

    const service = new UserSignatureService(prismaMock);
    const result = await service.saveVault("user-1", {
      signatureData: STUDENT_SIGNATURE,
      method: "DRAW",
    });

    expect(result.version).toBe(2);
    expect(result.method).toBe("DRAW");
    expect(prismaMock.userSignature.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1" },
        data: expect.objectContaining({
          method: "DRAW",
          version: 2,
        }),
      }),
    );
  });

  it("rejects malformed or non-image signature payloads with 400", async () => {
    const service = new UserSignatureService(prismaMock);

    await expect(
      service.saveVault("user-1", {
        signatureData: "data:image/png;base64,AQID",
        method: "DRAW",
      }),
    ).rejects.toMatchObject({ statusCode: 400 });

    await expect(
      service.saveVault("user-1", {
        signatureData: "   ",
        method: "DRAW",
      }),
    ).rejects.toMatchObject({ statusCode: 400 });

    await expect(
      service.saveVault("user-1", {
        signatureData: STUDENT_SIGNATURE,
        method: "TYPE",
      }),
    ).rejects.toMatchObject({ statusCode: 400 });

    await expect(
      service.saveVault("user-1", {
        signatureData: STUDENT_SIGNATURE,
        method: "FAX",
      }),
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(prismaMock.userSignature.create).not.toHaveBeenCalled();
    expect(prismaMock.userSignature.update).not.toHaveBeenCalled();
  });

  it("deletes saved signature, logs removal, and returns empty vault", async () => {
    prismaMock.userSignature.findUnique.mockResolvedValueOnce({
      id: "sig-1",
      version: 2,
      method: "DRAW",
    });
    prismaMock.userSignature.delete.mockResolvedValueOnce({ id: "sig-1" });

    const service = new UserSignatureService(prismaMock);
    const result = await service.deleteVault("user-1");

    expect(result).toEqual(emptyUserSignatureVault());
    expect(prismaMock.userSignature.delete).toHaveBeenCalledWith({
      where: { userId: "user-1" },
    });
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorId: "user-1",
          actionType: "USER_SIGNATURE_DELETED",
          targetTable: "user_signatures",
          targetId: "sig-1",
        }),
      }),
    );
  });
});
