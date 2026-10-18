// CDW-LIVE-1 MANUAL-QA FIX-1 — preview convergence + LAN realtime diagnostics.
//
// Run: node --experimental-strip-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/verify-cdw-live-1-manual-qa-fix-1.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  reportPreviewDispositionForEvent,
  shouldDisplayLiveReportPreview,
  isNewerLiveReportPreview,
} from "../src/lib/realtime/report-preview.ts";
import { normalizeDefenseRealtimeBaseUrl } from "../src/lib/realtime/defense-socket-url.ts";

const root = process.cwd();
const read = (relative) => readFileSync(resolve(root, relative), "utf8");

const PANEL = "src/components/defense-workspace/committee-report-panel.tsx";
const HOOK = "src/hooks/use-defense-realtime.ts";
const NEXT_CONFIG = "next.config.ts";
const FRONTEND_ENV = ".env.example";
const BACKEND_ENV = "../backend/.env.example";

function preview(overrides = {}) {
  return {
    scheduleId: "sched-1",
    baseBodyVersion: 4,
    previewSequence: 2,
    senderUserId: "rapporteur-1",
    body: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "unsaved", marks: [] }],
        },
      ],
    },
    ...overrides,
  };
}

test("report.draft.updated never clears the viewer preview by itself", () => {
  assert.equal(reportPreviewDispositionForEvent("report.draft.updated"), "keep");
});

test("freeze/sign/final/conclusion events clear the preview immediately", () => {
  for (const event of [
    "report.ready_for_signature",
    "rap.signature.recorded",
    "rap.finalized",
    "defense.concluded",
  ]) {
    assert.equal(reportPreviewDispositionForEvent(event), "clear", event);
  }
});

test("unrelated realtime events leave the preview alone", () => {
  for (const event of [
    "defense.started",
    "annotation.created",
    "annotation.comment.created",
    "evaluation.finalized",
  ]) {
    assert.equal(reportPreviewDispositionForEvent(event), "keep", event);
  }
});

test("preview remains visible while authoritative bodyVersion is behind", () => {
  const value = preview({ baseBodyVersion: 4 });

  assert.equal(
    shouldDisplayLiveReportPreview({
      preview: value,
      scheduleId: "sched-1",
      reportStatus: "DRAFT",
      authoritativeBodyVersion: 4,
    }),
    true,
  );
  assert.equal(
    shouldDisplayLiveReportPreview({
      preview: value,
      scheduleId: "sched-1",
      reportStatus: "DRAFT",
      authoritativeBodyVersion: 5,
    }),
    false,
    "saved REST bodyVersion catches up and naturally supersedes the preview",
  );
});

test("frozen/terminal statuses never display a preview", () => {
  for (const status of [
    "FOR_SIGNATURE",
    "PARTIALLY_SIGNED",
    "ALL_SIGNED",
    "DISTRIBUTED",
    "FINALIZED",
  ]) {
    assert.equal(
      shouldDisplayLiveReportPreview({
        preview: preview(),
        scheduleId: "sched-1",
        reportStatus: status,
        authoritativeBodyVersion: 4,
      }),
      false,
      status,
    );
  }
});

test("preview sequence ordering and sender replacement remain intact", () => {
  assert.equal(
    isNewerLiveReportPreview(preview({ previewSequence: 2 }), preview({ previewSequence: 3 })),
    true,
  );
  assert.equal(
    isNewerLiveReportPreview(preview({ previewSequence: 3 }), preview({ previewSequence: 3 })),
    false,
  );
  assert.equal(
    isNewerLiveReportPreview(
      preview({ senderUserId: "old", previewSequence: 9 }),
      preview({ senderUserId: "new", previewSequence: 1 }),
    ),
    true,
  );
});

test("the socket hook delegates clearing to the disposition helper", () => {
  const hook = read(HOOK);

  assert.match(hook, /reportPreviewDispositionForEvent\(event\.eventName\)/);
  assert.match(hook, /reportPreviewDispositionForEvent[\s\S]*?"clear"/);
  assert.doesNotMatch(
    hook,
    /"report\.draft\.updated"\s*\|\|[\s\S]{0,240}?setLiveReportPreview\(null\)/,
  );
  assert.match(
    hook,
    /event\.eventName === "report\.draft\.updated"[\s\S]{0,120}?throttleRef\.current\?\.clear\(\)/,
  );
});

test("viewer status is a compact stable slot, not a shifting paragraph", () => {
  const panel = read(PANEL);

  assert.match(panel, /Live — unsaved/);
  assert.match(panel, /title="Live preview/);
  assert.match(panel, /min-w-\[6\.75rem\]/);
  assert.doesNotMatch(panel, /This is the Rapporteur&apos;s current wording/);
  assert.match(panel, /ReportDocumentView doc=\{livePreview\.body\}/);
});

test("viewer remains read-only: no authoring controls in the read-only branch", () => {
  const panel = read(PANEL);
  const readonlyStart = panel.indexOf("function ReportReadOnly");
  const readonly = panel.slice(readonlyStart);

  assert.ok(readonlyStart >= 0);
  assert.doesNotMatch(readonly, /RichTextReportEditor/);
  assert.doesNotMatch(readonly, /controllerRef/);
  assert.doesNotMatch(readonly, /Save now/);
});

test("LAN realtime URL normalization strips /api and trailing slashes", () => {
  assert.equal(
    normalizeDefenseRealtimeBaseUrl("http://192.168.1.101:5000"),
    "http://192.168.1.101:5000",
  );
  assert.equal(
    normalizeDefenseRealtimeBaseUrl("http://192.168.1.101:5000/api"),
    "http://192.168.1.101:5000",
  );
  assert.equal(
    normalizeDefenseRealtimeBaseUrl("http://192.168.1.101:5000/api/"),
    "http://192.168.1.101:5000",
  );
});

test("LAN setup documents both frontend and backend origins", () => {
  const nextConfig = read(NEXT_CONFIG);
  const frontendEnv = read(FRONTEND_ENV);
  const backendEnv = read(BACKEND_ENV);

  assert.match(nextConfig, /allowedDevOrigins:\s*\["192\.168\.1\.101"\]/);
  assert.match(frontendEnv, /NEXT_PUBLIC_BACKEND_API_URL="http:\/\/192\.168\.1\.101:5000"/);
  assert.match(backendEnv, /FRONTEND_URL=.*192\.168\.1\.101:3000/);
});

test("transport diagnostics expose only safe target/transport metadata", () => {
  const hook = read(HOOK);
  const start = hook.indexOf("transport unavailable");
  const block = hook.slice(start, start + 700);

  assert.match(block, /target: normalizeDefenseRealtimeBaseUrl/);
  assert.match(block, /transport: engine\?\.transport\?\.name/);
  assert.match(block, /reason: error\?\.message/);
  assert.doesNotMatch(block, /accessToken|token:|auth:|report body|signature/i);
});

test("REST polling fallback remains present", () => {
  const hook = read(HOOK);
  const panel = read(PANEL);
  const page = read(
    "src/app/(portal)/panelist/defense-workspace/[scheduleId]/page.tsx",
  );

  assert.match(hook, /REST polling remains active|socket\.disconnect\(\)/);
  assert.match(panel, /20000/);
  assert.match(page, /20000/);
});
