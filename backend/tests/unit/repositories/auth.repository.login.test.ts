import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  student: { findFirst: vi.fn() },
  user: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("../../../src/config/database", () => ({ default: prismaMock }));

import { AuthRepository } from "../../../src/repositories/auth.repository";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AuthRepository.findStudentByStudentNumber (COR-6 Student Number lookup)", () => {
  it("queries by studentNumber only and includes the linked User", async () => {
    prismaMock.student.findFirst.mockResolvedValue({ id: "student-1", user: { id: "user-1" } });

    const repo = new AuthRepository();
    const result = await repo.findStudentByStudentNumber("2026-0001");

    expect(prismaMock.student.findFirst).toHaveBeenCalledWith({
      where: { studentNumber: "2026-0001" },
      include: { user: true },
    });
    expect(result?.user).toEqual({ id: "user-1" });
  });

  it("never includes dateOfBirth in the authentication lookup predicate", async () => {
    prismaMock.student.findFirst.mockResolvedValue(null);

    const repo = new AuthRepository();
    await repo.findStudentByStudentNumber("2026-0001");

    const arg = prismaMock.student.findFirst.mock.calls[0][0] as {
      where: Record<string, unknown>;
    };
    expect(Object.keys(arg.where)).toEqual(["studentNumber"]);
    expect(JSON.stringify(arg)).not.toMatch(/dateOfBirth/i);
  });
});
