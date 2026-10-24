import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  generate: vi.fn(),
  generateSummary: vi.fn(),
  generateApplication: vi.fn(),
  generateBundle: vi.fn(),
  filename: vi.fn(),
}));

vi.mock("../../../src/config/database", () => ({ default: {} }));
vi.mock("../../../src/services/thesis.service", () => ({
  ThesisService: class {
    generateOfficialCriteriaPdf = mocks.generate;
    generateOralExamSummaryPdf = mocks.generateSummary;
    generateDefenseApplicationPdf = mocks.generateApplication;
    generateEvaluationBundlePdf = mocks.generateBundle;
    getOfficialDocumentFilename = mocks.filename;
  },
}));

import { AppError } from "../../../src/utils/AppError";
import { ThesisController } from "../../../src/controllers/thesis.controller";

function makeRes() {
  const res: any = {
    status: vi.fn(),
    setHeader: vi.fn(),
    send: vi.fn(),
    json: vi.fn(),
  };
  res.status.mockReturnValue(res);
  return res;
}

function makeReq(params: Record<string, string> = {}) {
  return {
    user: { userId: "admin-1", role: "ADMIN" },
    params: {
      scheduleId: "sched-1",
      panelAssignmentId: "p1",
      ...params,
    },
  } as any;
}

describe("ThesisController.getOfficialCriteriaPdf (FORM-INT-1)", () => {
  const controller = new ThesisController();

  beforeEach(() => vi.clearAllMocks());

  it("returns PDF bytes with a safe deterministic filename", async () => {
    const pdf = Buffer.from("%PDF-1.7\nindividual evaluation");
    mocks.generate.mockResolvedValue(pdf);
    const res = makeRes();

    await controller.getOfficialCriteriaPdf(makeReq(), res);

    expect(mocks.generate).toHaveBeenCalledWith("sched-1", "p1", {
      userId: "admin-1",
      role: "ADMIN",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "application/pdf");
    expect(res.setHeader).toHaveBeenCalledWith(
      "Content-Disposition",
      'attachment; filename="individual-evaluation-sched-1-p1.pdf"',
    );
    expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
    expect(res.send).toHaveBeenCalledTimes(1);
    const body = res.send.mock.calls[0][0];
    expect(Buffer.isBuffer(body)).toBe(true);
    expect(body.subarray(0, 5).toString()).toBe("%PDF-");
    expect(res.json).not.toHaveBeenCalled();
  });

  it("never returns a JSON body for the PDF endpoint contract", async () => {
    mocks.generate.mockResolvedValue(Buffer.from("%PDF-1.7"));
    const res = makeRes();

    await controller.getOfficialCriteriaPdf(makeReq(), res);

    expect(res.json).not.toHaveBeenCalled();
    const body = res.send.mock.calls[0][0];
    expect(String(body)).not.toContain("signatureData");
  });

  it("sanitizes route identifiers in the filename", async () => {
    mocks.generate.mockResolvedValue(Buffer.from("%PDF-1.7"));
    const res = makeRes();

    await controller.getOfficialCriteriaPdf(
      makeReq({ scheduleId: "../../etc", panelAssignmentId: "p 1" }),
      res,
    );

    const disposition = res.setHeader.mock.calls.find(
      ([name]: [string]) => name === "Content-Disposition",
    )?.[1] as string;
    expect(disposition).toBe('attachment; filename="individual-evaluation-etc-p1.pdf"');
  });

  it("rejects an unauthenticated request without generating a document", async () => {
    const res = makeRes();
    const req = { params: { scheduleId: "sched-1", panelAssignmentId: "p1" } } as any;

    await controller.getOfficialCriteriaPdf(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it("preserves AppError status codes (finalized/legacy failures)", async () => {
    mocks.generate.mockRejectedValue(
      new AppError("Legacy evaluations cannot be rendered on the current institutional form.", 422),
    );
    const res = makeRes();

    await controller.getOfficialCriteriaPdf(makeReq(), res);

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith({
      error: "Legacy evaluations cannot be rendered on the current institutional form.",
    });
    expect(res.send).not.toHaveBeenCalled();
  });
});

describe("ThesisController.getOralExamSummaryPdf (FORM-INT-2)", () => {
  const controller = new ThesisController();

  beforeEach(() => vi.clearAllMocks());

  it("returns the GS-011 PDF with the canonical readable filename", async () => {
    const pdf = Buffer.from("%PDF-1.7\noral examination summary");
    mocks.generateSummary.mockResolvedValue(pdf);
    mocks.filename.mockResolvedValue(
      "Juan-Dela-Cruz-Proposal-Defense-Oral-Examination-Summary.pdf",
    );
    const res = makeRes();

    await controller.getOralExamSummaryPdf(makeReq(), res);

    expect(mocks.generateSummary).toHaveBeenCalledWith("sched-1", {
      userId: "admin-1",
      role: "ADMIN",
    });
    expect(mocks.filename).toHaveBeenCalledWith("sched-1", "summary", {
      userId: "admin-1",
      role: "ADMIN",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "application/pdf");
    expect(res.setHeader).toHaveBeenCalledWith(
      "Content-Disposition",
      'attachment; filename="Juan-Dela-Cruz-Proposal-Defense-Oral-Examination-Summary.pdf"',
    );
    expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
    expect(res.setHeader).toHaveBeenCalledWith("X-Content-Type-Options", "nosniff");
    expect(res.send).toHaveBeenCalledTimes(1);
    const body = res.send.mock.calls[0][0];
    expect(Buffer.isBuffer(body)).toBe(true);
    expect(body.subarray(0, 5).toString()).toBe("%PDF-");
    expect(res.json).not.toHaveBeenCalled();
    expect(String(body)).not.toContain("signatureData");
  });

  it("uses the backend-provided readable filename without exposing the schedule id", async () => {
    mocks.generateSummary.mockResolvedValue(Buffer.from("%PDF-1.7"));
    mocks.filename.mockResolvedValue(
      "María-José-Dela-Cruz-Final-Defense-Oral-Examination-Summary.pdf",
    );
    const res = makeRes();

    await controller.getOralExamSummaryPdf(makeReq(), res);

    const disposition = res.setHeader.mock.calls.find(
      ([name]: [string]) => name === "Content-Disposition",
    )?.[1] as string;
    expect(disposition).toBe(
      'attachment; filename="María-José-Dela-Cruz-Final-Defense-Oral-Examination-Summary.pdf"',
    );
    expect(disposition).not.toContain("sched-1");
  });

  it("rejects an unauthenticated request without generating a document", async () => {
    const res = makeRes();
    const req = { params: { scheduleId: "sched-1" } } as any;

    await controller.getOralExamSummaryPdf(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(mocks.generateSummary).not.toHaveBeenCalled();
  });

  it("preserves the controlled unavailable-summary conflict", async () => {
    mocks.generateSummary.mockRejectedValue(
      new AppError("The Oral Examination Summary is not yet available for this defense.", 409),
    );
    const res = makeRes();

    await controller.getOralExamSummaryPdf(makeReq(), res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      error: "The Oral Examination Summary is not yet available for this defense.",
    });
    expect(res.send).not.toHaveBeenCalled();
  });
});

describe("ThesisController.getDefenseApplicationPdf (FORM-INT-3)", () => {
  const controller = new ThesisController();

  beforeEach(() => vi.clearAllMocks());

  it("returns the GS-006/GS-007 PDF with the canonical readable filename", async () => {
    const pdf = Buffer.from("%PDF-1.7\ndefense application");
    mocks.generateApplication.mockResolvedValue(pdf);
    mocks.filename.mockResolvedValue(
      "Juan-Dela-Cruz-Proposal-Defense-Application.pdf",
    );
    const res = makeRes();

    await controller.getDefenseApplicationPdf(makeReq(), res);

    expect(mocks.generateApplication).toHaveBeenCalledWith("sched-1", {
      userId: "admin-1",
      role: "ADMIN",
    });
    expect(mocks.filename).toHaveBeenCalledWith("sched-1", "application", {
      userId: "admin-1",
      role: "ADMIN",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "application/pdf");
    expect(res.setHeader).toHaveBeenCalledWith(
      "Content-Disposition",
      'attachment; filename="Juan-Dela-Cruz-Proposal-Defense-Application.pdf"',
    );
    expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
    expect(res.setHeader).toHaveBeenCalledWith("X-Content-Type-Options", "nosniff");
    expect(res.send).toHaveBeenCalledTimes(1);
    const body = res.send.mock.calls[0][0];
    expect(Buffer.isBuffer(body)).toBe(true);
    expect(body.subarray(0, 5).toString()).toBe("%PDF-");
    expect(res.json).not.toHaveBeenCalled();
    expect(String(body)).not.toContain("signatureData");
  });

  it("rejects an unauthenticated request without generating a document", async () => {
    const res = makeRes();
    const req = { params: { scheduleId: "sched-1" } } as any;

    await controller.getDefenseApplicationPdf(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(mocks.generateApplication).not.toHaveBeenCalled();
  });

  it("preserves the controlled invalid-committee conflict", async () => {
    mocks.generateApplication.mockRejectedValue(
      new AppError("The defense application requires exactly one Chairman assignment.", 409),
    );
    const res = makeRes();

    await controller.getDefenseApplicationPdf(makeReq(), res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      error: "The defense application requires exactly one Chairman assignment.",
    });
    expect(res.send).not.toHaveBeenCalled();
  });
});

describe("ThesisController.getOfficialEvaluationBundlePdf (FORM-INT-4 FIX-1)", () => {
  const controller = new ThesisController();

  beforeEach(() => vi.clearAllMocks());

  it("returns one merged evaluator PDF with a readable filename", async () => {
    const pdf = Buffer.from("%PDF-1.7\nbundled evaluations");
    mocks.generateBundle.mockResolvedValue(pdf);
    mocks.filename.mockResolvedValue(
      "Juan-Dela-Cruz-Title-Defense-Individual-Evaluations.pdf",
    );
    const res = makeRes();

    await controller.getOfficialEvaluationBundlePdf(makeReq(), res);

    expect(mocks.generateBundle).toHaveBeenCalledWith("sched-1", {
      userId: "admin-1",
      role: "ADMIN",
    });
    expect(mocks.filename).toHaveBeenCalledWith("sched-1", "evaluations", {
      userId: "admin-1",
      role: "ADMIN",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "application/pdf");
    expect(res.setHeader).toHaveBeenCalledWith(
      "Content-Disposition",
      'attachment; filename="Juan-Dela-Cruz-Title-Defense-Individual-Evaluations.pdf"',
    );
    expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
    expect(res.setHeader).toHaveBeenCalledWith("X-Content-Type-Options", "nosniff");
    expect(res.send).toHaveBeenCalledTimes(1);
    const body = res.send.mock.calls[0][0];
    expect(Buffer.isBuffer(body)).toBe(true);
    expect(body.subarray(0, 5).toString()).toBe("%PDF-");
    expect(res.json).not.toHaveBeenCalled();
  });

  it("rejects an unauthenticated request without generating a bundle", async () => {
    const res = makeRes();
    const req = { params: { scheduleId: "sched-1" } } as any;

    await controller.getOfficialEvaluationBundlePdf(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(mocks.generateBundle).not.toHaveBeenCalled();
  });

  it("preserves controlled all-or-nothing bundle errors", async () => {
    mocks.generateBundle.mockRejectedValue(
      new AppError("All required evaluator evaluations must be finalized before the printable packet can be generated.", 409),
    );
    const res = makeRes();

    await controller.getOfficialEvaluationBundlePdf(makeReq(), res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      error:
        "All required evaluator evaluations must be finalized before the printable packet can be generated.",
    });
    expect(res.send).not.toHaveBeenCalled();
  });
});
