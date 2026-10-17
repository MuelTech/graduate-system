import { describe, expect, it, vi } from "vitest";

vi.mock("../../../src/config/database", () => ({ default: {} }));

import {
  DefenseRealtimePublisher,
  defenseRealtimePublisher,
} from "../../../src/realtime/defense-realtime.publisher";
import {
  DEFENSE_REALTIME_EVENT_METADATA_KEYS,
  type DefenseRealtimeEventName,
} from "../../../src/realtime/defense-realtime.types";

const SAMPLES: Array<{
  name: DefenseRealtimeEventName;
  payload: Record<string, unknown>;
}> = [
  {
    name: "defense.started",
    payload: { scheduleId: "sched-1", sessionStatus: "IN_PROGRESS" },
  },
  {
    name: "annotation.created",
    payload: {
      scheduleId: "sched-1",
      thesisDocumentId: "doc-1",
      annotationId: "ann-1",
    },
  },
  {
    name: "annotation.comment.created",
    payload: {
      scheduleId: "sched-1",
      thesisDocumentId: "doc-1",
      annotationId: "ann-1",
      commentId: "comment-1",
    },
  },
  {
    name: "report.draft.updated",
    payload: { scheduleId: "sched-1", reportId: "rap-1", bodyVersion: 3 },
  },
  { name: "evaluation.finalized", payload: { scheduleId: "sched-1" } },
  {
    name: "report.ready_for_signature",
    payload: { scheduleId: "sched-1", reportId: "rap-1", contentVersion: 1 },
  },
  {
    name: "rap.signature.recorded",
    payload: { scheduleId: "sched-1", reportId: "rap-1", contentVersion: 1 },
  },
  {
    name: "rap.finalized",
    payload: { scheduleId: "sched-1", reportId: "rap-1", contentVersion: 1 },
  },
  {
    name: "defense.concluded",
    payload: { scheduleId: "sched-1", sessionStatus: "CONCLUDED" },
  },
];

function makePublisher(deliver = vi.fn(async () => true)) {
  const logger = { info: vi.fn(), error: vi.fn() };
  const transport = { deliver };
  const publisher = new DefenseRealtimePublisher({
    getTransport: () => transport,
    logger,
    createEventId: () => "evt-1",
    now: () => new Date("2026-10-17T00:00:00.000Z"),
  });
  return { publisher, deliver, logger, transport };
}

describe("DefenseRealtimePublisher", () => {
  it("targets the canonical defense room and generates the envelope server-side", async () => {
    const { publisher, deliver } = makePublisher();

    await expect(
      publisher.publish("annotation.created", {
        scheduleId: "sched-1",
        thesisDocumentId: "doc-1",
        annotationId: "ann-1",
      }),
    ).resolves.toBe(true);

    expect(deliver).toHaveBeenCalledWith({
      room: "defense:sched-1",
      eventName: "annotation.created",
      event: {
        eventId: "evt-1",
        scheduleId: "sched-1",
        occurredAt: "2026-10-17T00:00:00.000Z",
        thesisDocumentId: "doc-1",
        annotationId: "ann-1",
      },
    });
  });

  it("is a safe no-op when realtime is not initialized", async () => {
    const publisher = new DefenseRealtimePublisher({
      getTransport: () => null,
      logger: { info: vi.fn(), error: vi.fn() },
    });

    await expect(
      publisher.publish("evaluation.finalized", { scheduleId: "sched-1" }),
    ).resolves.toBe(false);
  });

  it("contains and logs transport failures without throwing", async () => {
    const { publisher, logger } = makePublisher(
      vi.fn(async () => {
        throw new Error("socket transport unavailable");
      }),
    );

    await expect(
      publisher.publish("defense.concluded", {
        scheduleId: "sched-1",
        sessionStatus: "CONCLUDED",
      }),
    ).resolves.toBe(false);
    expect(logger.error).toHaveBeenCalled();
  });

  it("refuses an unknown event name without throwing", async () => {
    const { publisher, deliver, logger } = makePublisher();

    await expect(
      publisher.publish("report.body" as never, { scheduleId: "sched-1" } as never),
    ).resolves.toBe(false);

    expect(deliver).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
  });

  it.each(SAMPLES)("keeps $name privacy-safe (exact metadata keys)", async ({ name, payload }) => {
    const { publisher, deliver } = makePublisher();

    await publisher.publish(name, payload as never);

    const delivered = deliver.mock.calls[0][0] as {
      event: Record<string, unknown>;
    };
    const expectedKeys = [
      "eventId",
      "scheduleId",
      "occurredAt",
      ...DEFENSE_REALTIME_EVENT_METADATA_KEYS[name],
    ].sort();

    expect(Object.keys(delivered.event).sort()).toEqual(expectedKeys);
  });

  it("strips undeclared/private fields even if a caller forces them in", async () => {
    const { publisher, deliver } = makePublisher();

    await publisher.publish("report.draft.updated", {
      scheduleId: "sched-1",
      reportId: "rap-1",
      bodyVersion: 2,
      bodyDocument: { type: "doc" },
      signatureData: "data:image/png;base64,secret",
      criterionValues: [1.0, 1.25],
      average: 1.1,
      recommendation: "private",
      storagePath: "/private/file.pdf",
    } as never);

    const delivered = deliver.mock.calls[0][0] as {
      event: Record<string, unknown>;
    };
    const serialized = JSON.stringify(delivered.event);

    expect(Object.keys(delivered.event).sort()).toEqual([
      "bodyVersion",
      "eventId",
      "occurredAt",
      "reportId",
      "scheduleId",
    ]);
    expect(serialized).not.toContain("signatureData");
    expect(serialized).not.toContain("bodyDocument");
    expect(serialized).not.toContain("criterionValues");
    expect(serialized).not.toContain("storagePath");
    expect(serialized).not.toContain("data:image");
  });

  it("refuses an invalid schedule id before delivery", async () => {
    const { publisher, deliver } = makePublisher();

    await expect(
      publisher.publish("evaluation.finalized", {
        scheduleId: "defense:all",
      } as never),
    ).resolves.toBe(false);

    expect(deliver).not.toHaveBeenCalled();
  });

  it("has a singleton that is safe before server initialization", async () => {
    await expect(
      defenseRealtimePublisher.publish("evaluation.finalized", {
        scheduleId: "sched-1",
      }),
    ).resolves.toBe(false);
  });
});
