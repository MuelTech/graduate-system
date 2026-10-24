import { existsSync } from "fs";
import { writeFile } from "fs/promises";
import crypto from "crypto";
import express from "express";
import type { AddressInfo } from "node:net";
import jwt from "jsonwebtoken";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const proposal = vi.hoisted(() => ({
  submitManuscriptForReview: vi.fn(),
  getStudentReviewState: vi.fn(),
}));
const finalReview = vi.hoisted(() => ({
  submitManuscriptForReview: vi.fn(),
  getStudentReviewState: vi.fn(),
}));

vi.mock("../../../src/services/proposal-adviser-review.service", () => ({
  ProposalAdviserReviewService: class {
    submitManuscriptForReview = proposal.submitManuscriptForReview;
    getStudentReviewState = proposal.getStudentReviewState;
  },
}));
vi.mock("../../../src/services/final-adviser-review.service", () => ({
  FinalAdviserReviewService: class {
    submitManuscriptForReview = finalReview.submitManuscriptForReview;
    getStudentReviewState = finalReview.getStudentReviewState;
  },
}));
vi.mock("../../../src/services/thesis.service", () => ({
  ThesisService: class {},
}));
vi.mock("../../../src/services/student-thesis-journey.service", () => ({
  StudentThesisJourneyService: class {},
}));

import { ThesisController } from "../../../src/controllers/thesis.controller";
import { AppError } from "../../../src/utils/AppError";
import { storageProvider } from "../../../src/storage";
import { generateStorageKey } from "../../../src/storage/storage-key";
import { registerPromotedUpload } from "../../../src/storage/request-uploads";
import thesisRoutes from "../../../src/routes/thesis.routes";
import { normalizeManuscriptTitle } from "../../../src/services/manuscript-title.rules";

const createdKeys: string[] = [];

async function stagePromotedFile(): Promise<{ key: string; permanent: string }> {
  const id = crypto.randomBytes(8).toString("hex");
  const dir = await storageProvider.ensureTemporaryDirectory(id);
  const temp = `${dir}/f`;
  await writeFile(temp, "manuscript-bytes");
  const key = generateStorageKey("test-manuscripts");
  const permanent = await storageProvider.promoteTemporaryFile(temp, key);
  createdKeys.push(key);
  return { key, permanent };
}

function makeReq(permanent: string, key: string) {
  const req: any = { user: { userId: "student-user" }, file: { path: permanent }, body: { manuscriptTitle: "Exact Submitted Title" } };
  registerPromotedUpload(req, key, storageProvider);
  return req;
}

function makeRes() {
  return { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PREDEF-1B0 actual authenticated multipart manuscript routes", () => {
  let server: ReturnType<express.Express["listen"]>;
  let origin: string;
  const secret = "predef-manuscript-test-secret-only";

  beforeAll(async () => {
    vi.stubEnv("JWT_SECRET", secret);
    const app = express();
    app.use("/thesis", thesisRoutes);
    server = app.listen(0, "127.0.0.1");
    await new Promise<void>(resolve => server.once("listening", resolve));
    origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    vi.unstubAllEnvs();
  });

  async function post(stage: string, title: string | undefined, role = "STUDENT", authenticated = true) {
    const form = new FormData();
    // Send file first too: multer must finish parsing before the title is read.
    form.append("document", new Blob(["%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF\n"], { type: "application/pdf" }), `${stage}.pdf`);
    if (title !== undefined) form.append("manuscriptTitle", title);
    form.append("userId", "other-student");
    form.append("thesisId", "other-thesis");
    const token = jwt.sign({ userId: "student-user", role }, secret, { expiresIn: "1h" });
    return fetch(`${origin}/thesis/${stage}-adviser-review/manuscript`, {
      method: "POST", body: form, headers: authenticated ? { Authorization: `Bearer ${token}` } : {},
    });
  }

  describe.each([["proposal", proposal], ["final", finalReview]] as const)("%s", (stage, service) => {
    it("forwards title and verified file together using authenticated Student identity", async () => {
      service.submitManuscriptForReview.mockImplementation(async (_user, upload, title) => {
        createdKeys.push(upload.storageKey);
        expect(normalizeManuscriptTitle(title)).toBe("Exact Submitted Title");
      });
      service.getStudentReviewState.mockResolvedValue({ reviewStatus: "AWAITING_REVIEW" });
      const response = await post(stage, "Exact Submitted Title");
      expect(response.status).toBe(200);
      expect(service.submitManuscriptForReview).toHaveBeenCalledWith("student-user", expect.objectContaining({
        uploadedById: "student-user", originalFilename: `${stage}.pdf`, verifiedMimeType: "application/pdf",
      }), "Exact Submitted Title");
      expect(service.submitManuscriptForReview.mock.calls[0][1].thesisId).toBeUndefined();
    });

    it.each([undefined, " \n\t "])("removes the promoted upload when title validation fails: %s", async title => {
      let permanent = "";
      service.submitManuscriptForReview.mockImplementation(async (_user, upload, suppliedTitle) => {
        createdKeys.push(upload.storageKey);
        permanent = upload.filePath;
        normalizeManuscriptTitle(suppliedTitle);
      });
      const response = await post(stage, title);
      expect(response.status).toBe(400);
      expect((await response.json()).error).toContain("Title is required");
      expect(permanent).not.toBe("");
      expect(existsSync(permanent)).toBe(false);
      expect(service.getStudentReviewState).not.toHaveBeenCalled();
    });

    it("removes the promoted upload after a persistence failure", async () => {
      let permanent = "";
      service.submitManuscriptForReview.mockImplementation(async (_user, upload) => {
        createdKeys.push(upload.storageKey);
        permanent = upload.filePath;
        throw new Error("insert failed");
      });
      expect((await post(stage, "Exact Title")).status).toBe(400);
      expect(existsSync(permanent)).toBe(false);
    });

    it("retains committed bytes if the subsequent read fails", async () => {
      let permanent = "";
      service.submitManuscriptForReview.mockImplementation(async (_user, upload) => {
        createdKeys.push(upload.storageKey);
        permanent = upload.filePath;
      });
      service.getStudentReviewState.mockRejectedValueOnce(new Error("read failed"));
      expect((await post(stage, "Exact Title")).status).toBe(400);
      expect(existsSync(permanent)).toBe(true);
    });

    it("rejects unauthenticated and non-Student callers before file persistence", async () => {
      expect((await post(stage, "Exact Title", "STUDENT", false)).status).toBe(401);
      expect((await post(stage, "Exact Title", "PANELIST")).status).toBe(403);
      expect(service.submitManuscriptForReview).not.toHaveBeenCalled();
    });
  });
});

afterEach(async () => {
  while (createdKeys.length) {
    const key = createdKeys.pop() as string;
    await storageProvider.delete(key);
  }
});

describe("DL-2 FIX1 manuscript persistence boundary", () => {
  const controller = new ThesisController();

  it("Proposal: post-commit read failure does NOT delete the committed file", async () => {
    proposal.submitManuscriptForReview.mockResolvedValue(undefined);
    proposal.getStudentReviewState.mockRejectedValue(new Error("read failed"));
    const { key, permanent } = await stagePromotedFile();

    await controller.submitProposalManuscriptForReview(makeReq(permanent, key), makeRes());

    expect(proposal.submitManuscriptForReview).toHaveBeenCalled();
    expect(existsSync(permanent)).toBe(true);
  });

  it("Proposal: pre-commit business failure removes the request-created file", async () => {
    proposal.submitManuscriptForReview.mockRejectedValue(
      new AppError("No active Thesis Record found.", 400),
    );
    const { key, permanent } = await stagePromotedFile();

    await controller.submitProposalManuscriptForReview(makeReq(permanent, key), makeRes());

    expect(existsSync(permanent)).toBe(false);
  });

  it("Final: post-commit read failure does NOT delete the committed file", async () => {
    finalReview.submitManuscriptForReview.mockResolvedValue(undefined);
    finalReview.getStudentReviewState.mockRejectedValue(new Error("read failed"));
    const { key, permanent } = await stagePromotedFile();

    await controller.submitFinalManuscriptForReview(makeReq(permanent, key), makeRes());

    expect(finalReview.submitManuscriptForReview).toHaveBeenCalled();
    expect(existsSync(permanent)).toBe(true);
  });

  it("Final: pre-commit business failure removes the request-created file", async () => {
    finalReview.submitManuscriptForReview.mockRejectedValue(
      new AppError("No active Thesis Record found.", 400),
    );
    const { key, permanent } = await stagePromotedFile();

    await controller.submitFinalManuscriptForReview(makeReq(permanent, key), makeRes());

    expect(existsSync(permanent)).toBe(false);
  });

  function makeManagedReq(permanent: string, key: string) {
    const req: any = {
      user: { userId: "student-user" },
      body: { manuscriptTitle: "Exact Submitted Title" },
      file: {
        path: permanent,
        originalname: "chapters.pdf",
        storageMeta: {
          storageKey: key,
          storageProvider: "local",
          originalFilename: "chapters.pdf",
          verifiedMimeType: "application/pdf",
          sizeBytes: 15,
          checksum: "checksum-value",
          checksumAlgorithm: "sha256",
        },
      },
    };
    registerPromotedUpload(req, key, storageProvider);
    return req;
  }

  it("Proposal: controller forwards DL-2 managed metadata to the service", async () => {
    proposal.submitManuscriptForReview.mockResolvedValue(undefined);
    proposal.getStudentReviewState.mockResolvedValue({});
    const { key, permanent } = await stagePromotedFile();

    await controller.submitProposalManuscriptForReview(
      makeManagedReq(permanent, key),
      makeRes(),
    );

    expect(proposal.submitManuscriptForReview).toHaveBeenCalledWith(
      "student-user",
      expect.objectContaining({
        filePath: permanent,
        storageKey: key,
        storageProvider: "local",
        originalFilename: "chapters.pdf",
        verifiedMimeType: "application/pdf",
        sizeBytes: 15,
        checksum: "checksum-value",
        checksumAlgorithm: "sha256",
        uploadedById: "student-user",
      }),
      "Exact Submitted Title",
    );
  });

  it("Final: controller forwards DL-2 managed metadata to the service", async () => {
    finalReview.submitManuscriptForReview.mockResolvedValue(undefined);
    finalReview.getStudentReviewState.mockResolvedValue({});
    const { key, permanent } = await stagePromotedFile();

    await controller.submitFinalManuscriptForReview(
      makeManagedReq(permanent, key),
      makeRes(),
    );

    expect(finalReview.submitManuscriptForReview).toHaveBeenCalledWith(
      "student-user",
      expect.objectContaining({
        filePath: permanent,
        storageKey: key,
        verifiedMimeType: "application/pdf",
        checksum: "checksum-value",
        uploadedById: "student-user",
      }),
      "Exact Submitted Title",
    );
  });
});
