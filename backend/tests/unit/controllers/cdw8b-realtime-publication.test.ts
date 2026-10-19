import { beforeEach, describe, expect, it, vi } from "vitest";

const publishDefenseRealtimeEvent = vi.hoisted(() => vi.fn());
const publishDefenseRealtimeSequence = vi.hoisted(() => vi.fn());

vi.mock("../../../src/realtime/defense-realtime.publish", () => ({
  publishDefenseRealtimeEvent,
  publishDefenseRealtimeSequence,
}));

vi.mock("../../../src/config/database", () => ({ default: {} }));

import { ThesisController } from "../../../src/controllers/thesis.controller";

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
    body: {},
    ...overrides,
  } as never;
}

describe("CDW-8B thesis controller realtime publication", () => {
  let controller: any;
  let res: ReturnType<typeof makeRes>;

  beforeEach(() => {
    vi.clearAllMocks();
    res = makeRes();
    controller = new ThesisController();
    (controller as unknown as Record<string, unknown>).thesisService = {
      concludeDefense: vi.fn(),
      signRapReport: vi.fn(),
    };
    (controller as unknown as Record<string, unknown>).oralEvaluation = {
      finalize: vi.fn(),
    };
    (controller as unknown as Record<string, unknown>).defenseWorkspace = {
      startDefense: vi.fn(),
    };
  });

  it("emits defense.started for a real SCHEDULED -> IN_PROGRESS transition", async () => {
    controller.defenseWorkspace.startDefense.mockResolvedValue({
      started: true,
      sessionStatus: "IN_PROGRESS",
      transitioned: true,
    });

    await controller.startDefense(makeReq(), res as never);

    expect(publishDefenseRealtimeEvent).toHaveBeenCalledWith("defense.started", {
      scheduleId: "sched-1",
      sessionStatus: "IN_PROGRESS",
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("does not emit for an idempotent already-active start", async () => {
    controller.defenseWorkspace.startDefense.mockResolvedValue({
      started: true,
      sessionStatus: "IN_PROGRESS",
      transitioned: false,
    });

    await controller.startDefense(makeReq(), res as never);

    expect(publishDefenseRealtimeEvent).not.toHaveBeenCalled();
  });

  it("does not emit for an idempotent AWAITING_CONCLUSION start", async () => {
    controller.defenseWorkspace.startDefense.mockResolvedValue({
      started: true,
      sessionStatus: "AWAITING_CONCLUSION",
      transitioned: false,
    });

    await controller.startDefense(makeReq(), res as never);

    expect(publishDefenseRealtimeEvent).not.toHaveBeenCalled();
  });

  it("does not emit when start is rejected", async () => {
    controller.defenseWorkspace.startDefense.mockRejectedValue({
      statusCode: 403,
      message: "Only the assigned session Chairman may start the defense.",
    });

    await controller.startDefense(makeReq(), res as never);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(publishDefenseRealtimeEvent).not.toHaveBeenCalled();
  });

  it("emits evaluation.finalized with schedule identity only", async () => {
    controller.oralEvaluation.finalize.mockResolvedValue({
      status: "FINALIZED",
      overallAverage: null,
      recommendations: "private",
      signatureData: "data:image/png;base64,AAAA",
    });

    await controller.finalizeOralEvaluation(
      makeReq({ body: { signatureData: "data:image/png;base64,AAAA", criteria: {} } }),
      res as never,
    );

    expect(publishDefenseRealtimeEvent).toHaveBeenCalledWith(
      "evaluation.finalized",
      { scheduleId: "sched-1" },
    );
    const payload = publishDefenseRealtimeEvent.mock.calls[0][1] as Record<
      string,
      unknown
    >;
    expect(Object.keys(payload)).toEqual(["scheduleId"]);
    expect(JSON.stringify(payload)).not.toMatch(
      /criteria|average|recommendation|signature/i,
    );
  });

  it("does not emit when evaluation finalize fails", async () => {
    controller.oralEvaluation.finalize.mockRejectedValue({
      statusCode: 409,
      message: "Evaluation is already finalized.",
    });

    await controller.finalizeOralEvaluation(
      makeReq({ body: { signatureData: "data:image/png;base64,AAAA", criteria: {} } }),
      res as never,
    );

    expect(res.status).toHaveBeenCalledWith(409);
    expect(publishDefenseRealtimeEvent).not.toHaveBeenCalled();
  });

  it("emits rap.signature.recorded for the legacy active signing path", async () => {
    controller.thesisService.signRapReport.mockResolvedValue({
      signatureId: "sig-1",
      rapId: "rap-1",
      scheduleId: "sched-1",
      contentVersion: 2,
      status: "PARTIALLY_SIGNED",
      finalizedNow: false,
    });

    await controller.signRapReport(
      makeReq({
        params: { sigId: "sig-1" },
        body: { signatureData: "data:image/png;base64,AAAA" },
      }),
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
    ]);
  });

  it("emits signature.recorded then rap.finalized for the last legacy signer", async () => {
    controller.thesisService.signRapReport.mockResolvedValue({
      signatureId: "sig-1",
      rapId: "rap-1",
      scheduleId: "sched-1",
      contentVersion: 2,
      status: "FINALIZED",
      finalizedNow: true,
    });

    await controller.signRapReport(
      makeReq({
        params: { sigId: "sig-1" },
        body: { signatureData: "data:image/png;base64,AAAA" },
      }),
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

  it("does not emit legacy signing events when the attempt cannot be resolved", async () => {
    controller.thesisService.signRapReport.mockResolvedValue({
      signatureId: "sig-1",
      rapId: "rap-1",
      scheduleId: null,
      contentVersion: 0,
      status: "PARTIALLY_SIGNED",
      finalizedNow: false,
    });

    await controller.signRapReport(
      makeReq({
        params: { sigId: "sig-1" },
        body: { signatureData: "data:image/png;base64,AAAA" },
      }),
      res as never,
    );

    expect(publishDefenseRealtimeSequence).not.toHaveBeenCalled();
  });

  it("does not emit when legacy signing fails", async () => {
    controller.thesisService.signRapReport.mockRejectedValue({
      statusCode: 409,
      message: "This defense attempt is concluded and is read-only.",
    });

    await controller.signRapReport(
      makeReq({
        params: { sigId: "sig-1" },
        body: { signatureData: "data:image/png;base64,AAAA" },
      }),
      res as never,
    );

    expect(res.status).toHaveBeenCalledWith(409);
    expect(publishDefenseRealtimeSequence).not.toHaveBeenCalled();
  });

  it("emits defense.concluded without the verdict", async () => {
    controller.thesisService.concludeDefense.mockResolvedValue({
      conclusion: { id: "concl-1", outcome: "PASSED" },
      rapReport: { id: "rap-1", status: "FINALIZED", generatedAt: new Date() },
    });

    await controller.concludeDefense(makeReq({ body: { outcome: "PASSED" } }), res as never);

    expect(publishDefenseRealtimeEvent).toHaveBeenCalledWith(
      "defense.concluded",
      { scheduleId: "sched-1", sessionStatus: "CONCLUDED" },
    );
    const payload = publishDefenseRealtimeEvent.mock.calls[0][1] as Record<
      string,
      unknown
    >;
    expect(payload).not.toHaveProperty("outcome");
    expect(JSON.stringify(payload)).not.toContain("PASSED");
  });

  it("does not emit when conclusion fails or is duplicated", async () => {
    controller.thesisService.concludeDefense.mockRejectedValue({
      statusCode: 409,
      message: "Defense has already been concluded.",
    });

    await controller.concludeDefense(makeReq({ body: { outcome: "PASSED" } }), res as never);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(publishDefenseRealtimeEvent).not.toHaveBeenCalled();
  });
});
