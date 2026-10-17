import { describe, expect, it, vi } from "vitest";

import {
  publishDefenseRealtimeEvent,
  publishDefenseRealtimeSequence,
} from "../../../src/realtime/defense-realtime.publish";

function makePublisher() {
  return {
    publish: vi.fn(async () => true),
  };
}

describe("defense realtime publication helpers", () => {
  it("publishes a single typed event", () => {
    const publisher = makePublisher();

    publishDefenseRealtimeEvent(
      "defense.started",
      { scheduleId: "sched-1", sessionStatus: "IN_PROGRESS" },
      publisher,
    );

    expect(publisher.publish).toHaveBeenCalledWith("defense.started", {
      scheduleId: "sched-1",
      sessionStatus: "IN_PROGRESS",
    });
  });

  it("contains a rejected publisher without throwing", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const publisher = {
      publish: vi.fn(async () => {
        throw new Error("transport down");
      }),
    };

    try {
      expect(() =>
        publishDefenseRealtimeEvent(
          "evaluation.finalized",
          { scheduleId: "sched-1" },
          publisher,
        ),
      ).not.toThrow();
      await vi.waitFor(() => expect(publisher.publish).toHaveBeenCalled());
    } finally {
      spy.mockRestore();
    }
  });

  it("contains a synchronous publisher throw without throwing", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const publisher = {
      publish: vi.fn(() => {
        throw new Error("sync transport failure");
      }),
    };

    try {
      expect(() =>
        publishDefenseRealtimeEvent(
          "evaluation.finalized",
          { scheduleId: "sched-1" },
          publisher,
        ),
      ).not.toThrow();
    } finally {
      spy.mockRestore();
    }
  });

  it("publishes a sequence in order, waiting for each event", async () => {
    const order: string[] = [];
    let releaseFirst: (() => void) | undefined;
    const publisher = {
      publish: vi.fn((eventName: string) => {
        order.push(eventName);
        if (eventName === "rap.signature.recorded") {
          return new Promise<boolean>((resolve) => {
            releaseFirst = () => resolve(true);
          });
        }
        return Promise.resolve(true);
      }),
    };

    publishDefenseRealtimeSequence(
      [
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
      ],
      publisher,
    );

    expect(order).toEqual(["rap.signature.recorded"]);
    releaseFirst?.();
    await vi.waitFor(() =>
      expect(order).toEqual(["rap.signature.recorded", "rap.finalized"]),
    );
  });

  it("continues a sequence after one event fails", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const order: string[] = [];
    const publisher = {
      publish: vi.fn((eventName: string) => {
        order.push(eventName);
        if (eventName === "rap.signature.recorded") {
          return Promise.reject(new Error("first failed"));
        }
        return Promise.resolve(true);
      }),
    };

    try {
      publishDefenseRealtimeSequence(
        [
          {
            eventName: "rap.signature.recorded",
            payload: {
              scheduleId: "sched-1",
              reportId: "rap-1",
              contentVersion: 1,
            },
          },
          {
            eventName: "rap.finalized",
            payload: {
              scheduleId: "sched-1",
              reportId: "rap-1",
              contentVersion: 1,
            },
          },
        ],
        publisher,
      );

      await vi.waitFor(() =>
        expect(order).toEqual(["rap.signature.recorded", "rap.finalized"]),
      );
    } finally {
      spy.mockRestore();
    }
  });
});
