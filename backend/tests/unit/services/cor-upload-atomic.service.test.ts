import crypto from "crypto";
import { existsSync } from "fs";
import { mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const repo = vi.hoisted(() => ({
  findStudentByUserId: vi.fn(),
  checkPassedExam: vi.fn(),
  getActiveUploadByStudentId: vi.fn(),
  getVerifiedUploadByStudentId: vi.fn(),
  createUploadWithAudit: vi.fn(),
}));

vi.mock("../../../src/repositories/cor.repository", () => ({
  CorRepository: class {
    findStudentByUserId = repo.findStudentByUserId;
    checkPassedExam = repo.checkPassedExam;
    getActiveUploadByStudentId = repo.getActiveUploadByStudentId;
    getVerifiedUploadByStudentId = repo.getVerifiedUploadByStudentId;
    createUploadWithAudit = repo.createUploadWithAudit;
    createUpload = vi.fn();
    createAuditLog = vi.fn();
  },
}));

vi.mock("file-type", () => ({
  fileTypeFromFile: vi.fn(async () => ({ mime: "application/pdf" })),
}));

import { CorService } from "../../../src/services/cor.service";

const PDF_BYTES = Buffer.from("%PDF-1.7\n%%EOF\n");
let workDir: string;

beforeAll(async () => {
  workDir = await mkdtemp(path.join(tmpdir(), "dl2-cor-"));
});

afterAll(async () => {
  await rm(workDir, { recursive: true, force: true });
});

beforeEach(() => {
  vi.clearAllMocks();
  repo.findStudentByUserId.mockResolvedValue({ id: "student-1" });
  repo.checkPassedExam.mockResolvedValue({ id: "exam-1" });
  repo.getActiveUploadByStudentId.mockResolvedValue(null);
  repo.getVerifiedUploadByStudentId.mockResolvedValue(null);
});

async function makeUploadFile(): Promise<string> {
  const filePath = path.join(workDir, crypto.randomBytes(6).toString("hex"));
  await writeFile(filePath, PDF_BYTES);
  return filePath;
}

describe("DL-2 FIX1 COR atomic persistence boundary", () => {
  it("success: persists via the atomic method and retains the file", async () => {
    repo.createUploadWithAudit.mockResolvedValue({ id: "cor-1" });
    const filePath = await makeUploadFile();
    const svc = new CorService();

    const result = await svc.uploadCor("user-1", {
      path: filePath,
      originalname: "cor.pdf",
    } as Express.Multer.File);

    expect(result.id).toBe("cor-1");
    expect(repo.createUploadWithAudit).toHaveBeenCalledTimes(1);
    // DL-3: the managed object is NOT renamed; storageKey keeps resolving to it.
    expect(existsSync(filePath)).toBe(true);
  });

  it("audit/persistence failure: no row retained and the file is removed", async () => {
    repo.createUploadWithAudit.mockRejectedValue(new Error("audit boundary failed"));
    const filePath = await makeUploadFile();
    const svc = new CorService();

    await expect(
      svc.uploadCor("user-1", {
        path: filePath,
        originalname: "cor.pdf",
      } as Express.Multer.File),
    ).rejects.toThrow(/audit boundary failed/);

    expect(existsSync(filePath)).toBe(false);
  });
});
