import { existsSync } from "fs";
import { writeFile } from "fs/promises";
import crypto from "crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const proposal = {
  submitManuscriptForReview: vi.fn(),
  getStudentReviewState: vi.fn(),
};
const finalReview = {
  submitManuscriptForReview: vi.fn(),
  getStudentReviewState: vi.fn(),
};

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
  const req: any = { user: { userId: "student-user" }, file: { path: permanent } };
  registerPromotedUpload(req, key, storageProvider);
  return req;
}

function makeRes() {
  return { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
}

beforeEach(() => {
  vi.clearAllMocks();
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
    );
  });
});
