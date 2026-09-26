import { beforeEach, describe, expect, it, vi } from "vitest";

const requestChanges = vi.fn();
const certify = vi.fn();

vi.mock("../../../src/services/proposal-adviser-review.service", () => {
  class ProposalAdviserReviewService {
    requestChanges = requestChanges;
    certify = certify;
    getStudentReviewState = vi.fn();
    submitManuscriptForReview = vi.fn();
    listReviewTasks = vi.fn();
    getReviewTask = vi.fn();
  }
  return { ProposalAdviserReviewService };
});

vi.mock("../../../src/services/thesis.service", () => ({
  ThesisService: class {
    constructor() {}
  },
}));

vi.mock("../../../src/services/student-thesis-journey.service", () => ({
  StudentThesisJourneyService: class {
    constructor() {}
  },
}));

import { ThesisController } from "../../../src/controllers/thesis.controller";

describe("CP3-FIX4 controller expectedReviewedDocumentId propagation", () => {
  const controller = new ThesisController();
  let res: any;

  beforeEach(() => {
    vi.clearAllMocks();
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    requestChanges.mockResolvedValue({ ok: true });
    certify.mockResolvedValue({ ok: true });
  });

  it("Test 1: Request Changes passes expectedReviewedDocumentId to service", async () => {
    const req: any = {
      user: { userId: "adviser-1" },
      params: { thesisId: "thesis-1" },
      body: {
        remarks: "Revise chapter 2",
        expectedReviewedDocumentId: "doc-a",
      },
    };
    await controller.requestProposalAdviserChanges(req, res);
    expect(requestChanges).toHaveBeenCalledWith("adviser-1", "thesis-1", {
      remarks: "Revise chapter 2",
      expectedReviewedDocumentId: "doc-a",
    });
  });

  it("Request Changes missing expected → 400, no service call", async () => {
    const req: any = {
      user: { userId: "adviser-1" },
      params: { thesisId: "thesis-1" },
      body: { remarks: "x" },
    };
    await controller.requestProposalAdviserChanges(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(requestChanges).not.toHaveBeenCalled();
  });

  it("Certify missing expected → 400, no service call", async () => {
    const req: any = {
      user: { userId: "adviser-1" },
      params: { thesisId: "thesis-1" },
      body: { signatureData: "sig" },
    };
    await controller.certifyProposalAdviserReview(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(certify).not.toHaveBeenCalled();
  });

  it("Certify passes expectedReviewedDocumentId to service", async () => {
    const req: any = {
      user: { userId: "adviser-1" },
      params: { thesisId: "thesis-1" },
      body: {
        signatureData: "sig",
        expectedReviewedDocumentId: "doc-b",
      },
    };
    await controller.certifyProposalAdviserReview(req, res);
    expect(certify).toHaveBeenCalledWith("adviser-1", "thesis-1", {
      signatureData: "sig",
      remarks: null,
      clientIssuedAt: null,
      expectedReviewedDocumentId: "doc-b",
    });
  });
});
