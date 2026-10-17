import { beforeEach, describe, expect, it, vi } from "vitest";

const listAnnotations = vi.fn();
const createAnnotation = vi.fn();
const createComment = vi.fn();
const getReportReadModel = vi.fn();
const saveReportDraft = vi.fn();
const freezeReportForSignatures = vi.fn();
const signReportForSignatures = vi.fn();
const getConclusionReadiness = vi.fn();

const publishDefenseRealtimeEvent = vi.hoisted(() => vi.fn());
const publishDefenseRealtimeSequence = vi.hoisted(() => vi.fn());

vi.mock("../../../src/services/defense-collaboration.service", () => ({
  DefenseCollaborationService: class {
    listAnnotations = listAnnotations;
    createAnnotation = createAnnotation;
    createComment = createComment;
    getReportReadModel = getReportReadModel;
    saveReportDraft = saveReportDraft;
    freezeReportForSignatures = freezeReportForSignatures;
    signReportForSignatures = signReportForSignatures;
    getConclusionReadiness = getConclusionReadiness;
  },
}));

vi.mock("../../../src/realtime/defense-realtime.publish", () => ({
  publishDefenseRealtimeEvent,
  publishDefenseRealtimeSequence,
}));

import { AppError } from "../../../src/utils/AppError";
import { DefenseCollaborationController } from "../../../src/controllers/defense-collaboration.controller";

function makeRes() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };
}

function makeReq(overrides: Record<string, unknown> = {}) {
  return {
    user: { userId: "u-1", role: "PANELIST" },
    params: { scheduleId: "sched-1" },
    query: {},
    body: {},
    ...overrides,
  } as never;
}

describe("DefenseCollaborationController (CDW-1)", () => {
  const controller = new DefenseCollaborationController();
  let res: ReturnType<typeof makeRes>;

  beforeEach(() => {
    vi.clearAllMocks();
    res = makeRes();
  });

  it("returns 401 when there is no authenticated user", async () => {
    await controller.getCollaborationAnnotations(makeReq({ user: undefined }), res as never);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(listAnnotations).not.toHaveBeenCalled();
  });

  it("lists annotations for the exact schedule + document", async () => {
    listAnnotations.mockResolvedValue([{ id: "ann-1" }]);
    await controller.getCollaborationAnnotations(
      makeReq({ query: { documentId: "doc-1" } }),
      res as never,
    );
    expect(listAnnotations).toHaveBeenCalledWith("sched-1", "u-1", "doc-1");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ annotations: [{ id: "ann-1" }] });
  });

  it("creates an annotation from body (document + anchor), server derives author", async () => {
    createAnnotation.mockResolvedValue({ id: "ann-2", thesisDocumentId: "doc-1" });
    await controller.createCollaborationAnnotation(
      makeReq({ body: { thesisDocumentId: "doc-1", anchor: { anchorVersion: 1 } } }),
      res as never,
    );
    expect(createAnnotation).toHaveBeenCalledWith("sched-1", "u-1", {
      thesisDocumentId: "doc-1",
      anchor: { anchorVersion: 1 },
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(publishDefenseRealtimeEvent).toHaveBeenCalledWith("annotation.created", {
      scheduleId: "sched-1",
      thesisDocumentId: "doc-1",
      annotationId: "ann-2",
    });
  });

  it("emits only annotation.created for an atomic highlight + initial comment", async () => {
    createAnnotation.mockResolvedValue({ id: "ann-3", thesisDocumentId: "doc-1" });
    await controller.createCollaborationAnnotation(
      makeReq({
        body: {
          thesisDocumentId: "doc-1",
          anchor: { anchorVersion: 1 },
          initialComment: "first note",
        },
      }),
      res as never,
    );

    expect(publishDefenseRealtimeEvent).toHaveBeenCalledTimes(1);
    expect(publishDefenseRealtimeEvent).toHaveBeenCalledWith("annotation.created", {
      scheduleId: "sched-1",
      thesisDocumentId: "doc-1",
      annotationId: "ann-3",
    });
  });

  it("creates a comment/reply and forwards the parent", async () => {
    createComment.mockResolvedValue({
      comment: { id: "c-1" },
      thesisDocumentId: "doc-1",
    });
    await controller.createAnnotationComment(
      makeReq({
        params: { scheduleId: "sched-1", annotationId: "ann-1" },
        body: { body: "note", parentCommentId: "c-root" },
      }),
      res as never,
    );
    expect(createComment).toHaveBeenCalledWith("sched-1", "u-1", {
      annotationId: "ann-1",
      body: "note",
      parentCommentId: "c-root",
    });
    expect(res.json).toHaveBeenCalledWith({ comment: { id: "c-1" } });
    expect(publishDefenseRealtimeEvent).toHaveBeenCalledWith(
      "annotation.comment.created",
      {
        scheduleId: "sched-1",
        thesisDocumentId: "doc-1",
        annotationId: "ann-1",
        commentId: "c-1",
      },
    );
  });

  it("returns the committee report read model", async () => {
    getReportReadModel.mockResolvedValue({ reportStatus: "DRAFT" });
    await controller.getCommitteeReport(makeReq(), res as never);
    expect(getReportReadModel).toHaveBeenCalledWith("sched-1", "u-1");
    expect(res.json).toHaveBeenCalledWith({ reportStatus: "DRAFT" });
  });

  it("saves the Rapporteur report draft from the body payload", async () => {
    saveReportDraft.mockResolvedValue({ saved: true, bodyVersion: 1, reportId: "rap-1" });
    await controller.saveCommitteeReportDraft(
      makeReq({ body: { body: { type: "doc", content: [] } } }),
      res as never,
    );
    expect(saveReportDraft).toHaveBeenCalledWith(
      "sched-1",
      "u-1",
      { type: "doc", content: [] },
      null,
    );
    expect(publishDefenseRealtimeEvent).toHaveBeenCalledWith(
      "report.draft.updated",
      {
        scheduleId: "sched-1",
        reportId: "rap-1",
        bodyVersion: 1,
      },
    );
  });

  it("CDW-5: forwards expectedBodyVersion for stale-draft safety", async () => {
    saveReportDraft.mockResolvedValue({ saved: true, bodyVersion: 3, reportId: "rap-1" });
    await controller.saveCommitteeReportDraft(
      makeReq({ body: { body: { type: "doc", content: [] }, expectedBodyVersion: 2 } }),
      res as never,
    );
    expect(saveReportDraft).toHaveBeenCalledWith(
      "sched-1",
      "u-1",
      { type: "doc", content: [] },
      2,
    );
  });

  it("freezes the report for signatures and emits only on the real transition", async () => {
    freezeReportForSignatures.mockResolvedValue({
      frozen: true,
      alreadyFrozen: false,
      reportId: "rap-1",
      contentVersion: 2,
    });
    await controller.freezeCommitteeReport(makeReq(), res as never);
    expect(freezeReportForSignatures).toHaveBeenCalledWith("sched-1", "u-1");
    expect(publishDefenseRealtimeEvent).toHaveBeenCalledWith(
      "report.ready_for_signature",
      {
        scheduleId: "sched-1",
        reportId: "rap-1",
        contentVersion: 2,
      },
    );
  });

  it("does not emit a freeze event for an idempotent alreadyFrozen response", async () => {
    freezeReportForSignatures.mockResolvedValue({
      frozen: true,
      alreadyFrozen: true,
      reportId: "rap-1",
      contentVersion: 2,
    });
    await controller.freezeCommitteeReport(makeReq(), res as never);
    expect(publishDefenseRealtimeEvent).not.toHaveBeenCalled();
  });

  it("signs the frozen RAP and emits signature.recorded without finalized", async () => {
    signReportForSignatures.mockResolvedValue({
      signed: true,
      status: "PARTIALLY_SIGNED",
      reportId: "rap-1",
      contentVersion: 2,
      finalizedNow: false,
    });
    await controller.signCommitteeReport(
      makeReq({ body: { signatureData: "data:image/png;base64,AAAA" } }),
      res as never,
    );
    expect(signReportForSignatures).toHaveBeenCalledWith(
      "sched-1",
      "u-1",
      "data:image/png;base64,AAAA",
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(publishDefenseRealtimeSequence).toHaveBeenCalledWith([
      {
        eventName: "rap.signature.recorded",
        payload: {
          scheduleId: "sched-1",
          reportId: "rap-1",
          contentVersion: 2,
        },
      },
    ]);
  });

  it("emits signature.recorded then rap.finalized for the last required signer", async () => {
    signReportForSignatures.mockResolvedValue({
      signed: true,
      status: "FINALIZED",
      reportId: "rap-1",
      contentVersion: 2,
      finalizedNow: true,
    });
    await controller.signCommitteeReport(
      makeReq({ body: { signatureData: "data:image/png;base64,AAAA" } }),
      res as never,
    );

    expect(publishDefenseRealtimeSequence).toHaveBeenCalledWith([
      {
        eventName: "rap.signature.recorded",
        payload: {
          scheduleId: "sched-1",
          reportId: "rap-1",
          contentVersion: 2,
        },
      },
      {
        eventName: "rap.finalized",
        payload: {
          scheduleId: "sched-1",
          reportId: "rap-1",
          contentVersion: 2,
        },
      },
    ]);
  });

  it("returns conclusion readiness", async () => {
    getConclusionReadiness.mockResolvedValue({ readyForConclusion: false });
    await controller.getConclusionReadiness(makeReq(), res as never);
    expect(getConclusionReadiness).toHaveBeenCalledWith("sched-1", "u-1");
  });

  it("does not publish when the underlying mutation fails", async () => {
    createAnnotation.mockRejectedValue(new AppError("not assigned", 403));
    await controller.createCollaborationAnnotation(
      makeReq({ body: { thesisDocumentId: "doc-1", anchor: { anchorVersion: 1 } } }),
      res as never,
    );
    expect(res.status).toHaveBeenCalledWith(403);
    expect(publishDefenseRealtimeEvent).not.toHaveBeenCalled();
  });

  it("does not publish a comment event when the comment write fails", async () => {
    createComment.mockRejectedValue(new AppError("Annotation not found.", 404));
    await controller.createAnnotationComment(
      makeReq({
        params: { scheduleId: "sched-1", annotationId: "ann-1" },
        body: { body: "note" },
      }),
      res as never,
    );
    expect(res.status).toHaveBeenCalledWith(404);
    expect(publishDefenseRealtimeEvent).not.toHaveBeenCalled();
  });

  it("does not publish a draft event on a stale CAS failure", async () => {
    saveReportDraft.mockRejectedValue(
      new AppError("Report changed. Refresh and review the latest version.", 409),
    );
    await controller.saveCommitteeReportDraft(
      makeReq({ body: { body: { type: "doc", content: [] }, expectedBodyVersion: 1 } }),
      res as never,
    );
    expect(res.status).toHaveBeenCalledWith(409);
    expect(publishDefenseRealtimeEvent).not.toHaveBeenCalled();
  });

  it("does not publish a freeze event when freeze readiness fails", async () => {
    freezeReportForSignatures.mockRejectedValue(
      new AppError("All required evaluator evaluations must be finalized.", 409),
    );
    await controller.freezeCommitteeReport(makeReq(), res as never);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(publishDefenseRealtimeEvent).not.toHaveBeenCalled();
  });

  it("does not publish signature events when the signature write fails", async () => {
    signReportForSignatures.mockRejectedValue(
      new AppError("You have already signed this RAP.", 409),
    );
    await controller.signCommitteeReport(
      makeReq({ body: { signatureData: "data:image/png;base64,AAAA" } }),
      res as never,
    );
    expect(res.status).toHaveBeenCalledWith(409);
    expect(publishDefenseRealtimeSequence).not.toHaveBeenCalled();
  });

  it("propagates an AppError status code from the service", async () => {
    listAnnotations.mockRejectedValue(new AppError("not assigned", 403));
    await controller.getCollaborationAnnotations(
      makeReq({ query: { documentId: "doc-1" } }),
      res as never,
    );
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: "not assigned" });
  });

  it("maps unexpected errors to a generic 500 without leaking internals", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      listAnnotations.mockRejectedValue(
        new Error("PrismaClientKnownRequestError: SELECT user_id FROM users WHERE ..."),
      );
      await controller.getCollaborationAnnotations(
        makeReq({ query: { documentId: "doc-1" } }),
        res as never,
      );
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: "Internal server error." });
      const payload = (res.json as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][0] as {
        error: string;
      };
      expect(payload.error).not.toMatch(/Prisma|SELECT|user_id|stack/i);
    } finally {
      spy.mockRestore();
    }
  });
});
