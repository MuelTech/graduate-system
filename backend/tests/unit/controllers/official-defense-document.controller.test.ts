import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  generate: vi.fn(),
  generateSummary: vi.fn(),
}));

vi.mock("../../../src/config/database", () => ({ default: {} }));
vi.mock("../../../src/services/thesis.service", () => ({
  ThesisService: class {
    generateOfficialCriteriaPdf = mocks.generate;
    generateOralExamSummaryPdf = mocks.generateSummary;
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

  it("returns the GS-011 PDF with a safe deterministic filename", async () => {
    const pdf = Buffer.from("%PDF-1.7\noral examination summary");
    mocks.generateSummary.mockResolvedValue(pdf);
    const res = makeRes();

    await controller.getOralExamSummaryPdf(makeReq(), res);

    expect(mocks.generateSummary).toHaveBeenCalledWith("sched-1", {
      userId: "admin-1",
      role: "ADMIN",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "application/pdf");
    expect(res.setHeader).toHaveBeenCalledWith(
      "Content-Disposition",
      'attachment; filename="oral-examination-summary-sched-1.pdf"',
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

  it("sanitizes the scheduleId in the filename", async () => {
    mocks.generateSummary.mockResolvedValue(Buffer.from("%PDF-1.7"));
    const res = makeRes();

    await controller.getOralExamSummaryPdf(
      makeReq({ scheduleId: "../../etc" }),
      res,
    );

    const disposition = res.setHeader.mock.calls.find(
      ([name]: [string]) => name === "Content-Disposition",
    )?.[1] as string;
    expect(disposition).toBe('attachment; filename="oral-examination-summary-etc.pdf"');
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
