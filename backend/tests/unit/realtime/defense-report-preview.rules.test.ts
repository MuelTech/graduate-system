import { describe, expect, it } from "vitest";

import {
  DEFENSE_REPORT_PREVIEW_EVENT,
  DEFENSE_REPORT_PREVIEW_MAX_BYTES,
  parseDefenseReportPreviewPayload,
} from "../../../src/realtime/defense-report-preview.rules";
import {
  DEFENSE_REALTIME_EVENT_METADATA_KEYS,
  DEFENSE_REALTIME_EVENT_NAMES,
} from "../../../src/realtime/defense-realtime.types";
import {
  buildDefenseRealtimeEvent,
} from "../../../src/realtime/defense-realtime.publisher";

function validBody() {
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        attrs: { textAlign: "left" },
        content: [
          { type: "text", text: "Committee suggestions", marks: ["italic", "bold"] },
        ],
      },
    ],
  };
}

function payload(overrides: Record<string, unknown> = {}) {
  return {
    scheduleId: "sched-1",
    baseBodyVersion: 3,
    previewSequence: 7,
    body: validBody(),
    ...overrides,
  };
}

describe("parseDefenseReportPreviewPayload", () => {
  it("accepts and canonicalizes a valid report preview", () => {
    const result = parseDefenseReportPreviewPayload(payload());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.preview.scheduleId).toBe("sched-1");
    expect(result.preview.baseBodyVersion).toBe(3);
    expect(result.preview.previewSequence).toBe(7);
    expect(result.preview.body).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          attrs: { textAlign: "left" },
          content: [{ type: "text", text: "Committee suggestions", marks: ["bold", "italic"] }],
        },
      ],
    });
  });

  it("is a transport-only event, never a canonical persisted-domain event", () => {
    expect(DEFENSE_REPORT_PREVIEW_EVENT).toBe("report:preview");
    expect(
      (Object.values(DEFENSE_REALTIME_EVENT_NAMES) as readonly string[]).includes(
        DEFENSE_REPORT_PREVIEW_EVENT,
      ),
    ).toBe(false);
    expect(
      (DEFENSE_REALTIME_EVENT_METADATA_KEYS as Record<string, unknown>)[
        DEFENSE_REPORT_PREVIEW_EVENT
      ],
    ).toBeUndefined();
  });

  it("can never be built by the canonical post-commit publisher", () => {
    expect(() =>
      buildDefenseRealtimeEvent(
        DEFENSE_REPORT_PREVIEW_EVENT as never,
        { scheduleId: "sched-1" } as never,
        {
          createEventId: () => "evt-1",
          now: () => new Date("2026-10-17T00:00:00.000Z"),
        },
      ),
    ).toThrow(/Unknown defense realtime event/);
  });

  it.each([
    undefined,
    null,
    [],
    "payload",
    42,
  ])("rejects a non-object payload (%j)", (value) => {
    expect(parseDefenseReportPreviewPayload(value)).toEqual({
      ok: false,
      code: "INVALID",
    });
  });

  it.each([
    undefined,
    null,
    "",
    "   ",
    "defense:sched-1",
    "sched 1",
    "../../etc",
    "a".repeat(129),
    42,
  ])("rejects an invalid schedule id (%j)", (scheduleId) => {
    expect(parseDefenseReportPreviewPayload(payload({ scheduleId }))).toEqual({
      ok: false,
      code: "INVALID",
    });
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, "3", null])(
    "rejects an invalid baseBodyVersion (%j)",
    (baseBodyVersion) => {
      expect(parseDefenseReportPreviewPayload(payload({ baseBodyVersion }))).toEqual({
        ok: false,
        code: "INVALID",
      });
    },
  );

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, "7", null])(
    "rejects an invalid previewSequence (%j)",
    (previewSequence) => {
      expect(parseDefenseReportPreviewPayload(payload({ previewSequence }))).toEqual({
        ok: false,
        code: "INVALID",
      });
    },
  );

  it.each([
    null,
    {},
    { type: "doc" },
    { type: "doc", content: "not-an-array" },
    { type: "doc", content: [{ type: "image" }] },
    {
      type: "doc",
      content: [
        {
          type: "paragraph",
          attrs: { style: "color:red" },
          content: [],
        },
      ],
    },
  ])("rejects a malformed report body (%j)", (body) => {
    expect(parseDefenseReportPreviewPayload(payload({ body }))).toEqual({
      ok: false,
      code: "INVALID",
    });
  });

  it("rejects a body above the accepted serialized payload bound", () => {
    const chunk = "x".repeat(20_000);
    const body = {
      type: "doc",
      content: Array.from({ length: 6 }, () => ({
        type: "paragraph",
        content: [{ type: "text", text: chunk, marks: [] }],
      })),
    };

    const result = parseDefenseReportPreviewPayload(payload({ body }));

    expect(result).toEqual({ ok: false, code: "INVALID" });
    expect(JSON.stringify(result)).not.toContain(chunk);
  });

  it("exposes a 100 KiB bound matching the default REST JSON body limit", () => {
    expect(DEFENSE_REPORT_PREVIEW_MAX_BYTES).toBe(100 * 1024);
  });

  it("never echoes report text in a rejection", () => {
    const secret = "untrusted-report-text";
    const result = parseDefenseReportPreviewPayload(
      payload({
        body: {
          type: "doc",
          content: [{ type: "paragraph", attrs: { style: secret }, content: [] }],
        },
      }),
    );

    expect(JSON.stringify(result)).not.toContain(secret);
  });
});
