// FORM-INT-4 — Admin official PDF actions.
//
// Run: node --experimental-strip-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/verify-form-int-4-official-pdf-actions.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = process.cwd();
const ADMIN =
  "src/app/(portal)/admin/thesis/defense-records/[scheduleId]/page.tsx";
const read = (relative) => readFileSync(resolve(ROOT, relative), "utf8");

const {
  OfficialDocumentError,
  fetchOfficialDefensePdf,
  parsePdfFilename,
  savePdfBlob,
  downloadOfficialDefensePdf,
} = await import("../src/lib/official-defense-documents.client.ts");

const PDF_BYTES = new TextEncoder().encode("%PDF-1.7\nfixture");
const BASE = "http://localhost:5000";

function pdfResponse({
  contentType = "application/pdf",
  filename = 'attachment; filename="defense-application-sched-1.pdf"',
  bytes = PDF_BYTES,
} = {}) {
  return new Response(new Blob([bytes], { type: contentType }), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      ...(filename ? { "Content-Disposition": filename } : {}),
    },
  });
}

function jsonResponse(status, error) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function fetchSpy(response) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, init });
    return response;
  };
  return { impl, calls };
}

test("sends the bearer token in the Authorization header and uses /api", async () => {
  const { impl, calls } = fetchSpy(pdfResponse());
  await fetchOfficialDefensePdf(
    "/thesis/defense/sched-1/records/application/pdf",
    "fallback.pdf",
    {
      getToken: async () => "token-123",
      backendBaseUrl: () => BASE,
      fetchImpl: impl,
    },
  );

  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].url,
    `${BASE}/api/thesis/defense/sched-1/records/application/pdf`,
  );
  assert.equal(calls[0].init.headers.Authorization, "Bearer token-123");
  assert.doesNotMatch(calls[0].url, /token-123|token=/);
});

test("accepts a PDF blob and prefers the backend Content-Disposition filename", async () => {
  const { impl } = fetchSpy(pdfResponse());
  const result = await fetchOfficialDefensePdf(
    "/thesis/defense/sched-1/records/application/pdf",
    "fallback.pdf",
    { getToken: async () => "t", backendBaseUrl: () => BASE, fetchImpl: impl },
  );

  assert.equal(result.filename, "defense-application-sched-1.pdf");
  assert.ok(result.blob instanceof Blob);
  assert.equal(await result.blob.text(), "%PDF-1.7\nfixture");
});

test("surfaces a controlled backend JSON error and status", async () => {
  const { impl } = fetchSpy(
    jsonResponse(422, "The finalized evaluation has an invalid Average value."),
  );

  await assert.rejects(
    fetchOfficialDefensePdf(
      "/thesis/defense/sched-1/records/criteria/p1/pdf",
      "fallback.pdf",
      { getToken: async () => "t", backendBaseUrl: () => BASE, fetchImpl: impl },
    ),
    (error) => {
      assert.ok(error instanceof OfficialDocumentError);
      assert.equal(error.statusCode, 422);
      assert.match(error.message, /invalid Average value/);
      return true;
    },
  );
});

test("409/422 JSON bodies are never treated as a PDF", async () => {
  for (const status of [409, 422]) {
    const { impl } = fetchSpy(jsonResponse(status, "conflict"));
    await assert.rejects(
      fetchOfficialDefensePdf("/x/pdf", "fallback.pdf", {
        getToken: async () => "t",
        backendBaseUrl: () => BASE,
        fetchImpl: impl,
      }),
      (error) => {
        assert.ok(error instanceof OfficialDocumentError);
        assert.equal(error.statusCode, status);
        return true;
      },
    );
  }
});

test("rejects an unexpected non-PDF 2xx response", async () => {
  const { impl } = fetchSpy(
    pdfResponse({ contentType: "text/html", bytes: new TextEncoder().encode("<html>") }),
  );
  await assert.rejects(
    fetchOfficialDefensePdf("/x/pdf", "fallback.pdf", {
      getToken: async () => "t",
      backendBaseUrl: () => BASE,
      fetchImpl: impl,
    }),
    /did not return a PDF/i,
  );
});

test("rejects an empty PDF response", async () => {
  const { impl } = fetchSpy(pdfResponse({ bytes: new Uint8Array() }));
  await assert.rejects(
    fetchOfficialDefensePdf("/x/pdf", "fallback.pdf", {
      getToken: async () => "t",
      backendBaseUrl: () => BASE,
      fetchImpl: impl,
    }),
    /empty/i,
  );
});

test("rejects a missing session token without calling fetch", async () => {
  const { impl, calls } = fetchSpy(pdfResponse());
  await assert.rejects(
    fetchOfficialDefensePdf("/x/pdf", "fallback.pdf", {
      getToken: async () => null,
      backendBaseUrl: () => BASE,
      fetchImpl: impl,
    }),
    /session/i,
  );
  assert.equal(calls.length, 0);
});

test("rejects absolute or query-string document URLs", async () => {
  for (const path of [
    "https://evil.example/x.pdf",
    "/x/pdf?token=abc",
    "//evil.example/x.pdf",
  ]) {
    await assert.rejects(
      fetchOfficialDefensePdf(path, "fallback.pdf", {
        getToken: async () => "t",
        backendBaseUrl: () => BASE,
        fetchImpl: async () => pdfResponse(),
      }),
      /path/i,
    );
  }
});

test("creates and revokes the object URL around the download click", async () => {
  const events = [];
  const anchor = {
    href: "",
    download: "",
    rel: "",
    style: {},
    click: () => events.push("click"),
    remove: () => events.push("remove"),
  };
  const fakeDocument = {
    createElement: () => anchor,
    body: { appendChild: () => events.push("append") },
  };

  savePdfBlob(new Blob(["x"], { type: "application/pdf" }), "test.pdf", {
    createObjectURL: () => {
      events.push("create");
      return "blob:test";
    },
    revokeObjectURL: (url) => events.push(`revoke:${url}`),
    document: fakeDocument,
  });

  assert.deepEqual(events, [
    "create",
    "append",
    "click",
    "remove",
    "revoke:blob:test",
  ]);
  assert.equal(anchor.download, "test.pdf");
});

test("download helper fetches then saves with cleanup", async () => {
  const events = [];
  const { impl, calls } = fetchSpy(pdfResponse());
  await downloadOfficialDefensePdf(
    "/thesis/defense/sched-1/records/summary/pdf",
    "fallback.pdf",
    {
      getToken: async () => "t",
      backendBaseUrl: () => BASE,
      fetchImpl: impl,
      saveEnv: {
        createObjectURL: () => "blob:x",
        revokeObjectURL: (url) => events.push(`revoke:${url}`),
        document: {
          createElement: () => ({
            href: "",
            download: "",
            rel: "",
            style: {},
            click: () => events.push("click"),
            remove: () => {},
          }),
          body: { appendChild: () => {} },
        },
      },
    },
  );
  assert.equal(calls.length, 1);
  assert.deepEqual(events, ["click", "revoke:blob:x"]);
});

test("parses and sanitizes backend filenames, including path traversal", () => {
  assert.equal(
    parsePdfFilename('attachment; filename="oral-examination-summary-sched-1.pdf"'),
    "oral-examination-summary-sched-1.pdf",
  );
  assert.equal(
    parsePdfFilename('attachment; filename="../../evil.pdf"'),
    "evil.pdf",
  );
  assert.equal(
    parsePdfFilename('attachment; filename="weird name<script>.pdf"'),
    "weird-name-script.pdf",
  );
  assert.equal(parsePdfFilename(null), null);
});

/* ------------------------------------------------------- page contract */

function between(source, start, end) {
  const from = source.indexOf(start);
  assert.notEqual(from, -1, `missing start marker: ${start}`);
  const to = source.indexOf(end, from);
  assert.notEqual(to, -1, `missing end marker: ${end}`);
  return source.slice(from, to);
}

test("page uses exact schedule PDF paths and the shared helper", () => {
  const admin = read(ADMIN);

  assert.match(admin, /@\/lib\/official-defense-documents\.client/);
  assert.match(admin, /downloadOfficialDefensePdf/);
  assert.match(
    admin,
    /\/thesis\/defense\/\$\{scheduleId\}\/records\/application\/pdf/,
  );
  assert.match(admin, /\/thesis\/defense\/\$\{scheduleId\}\/records\/summary\/pdf/);
  assert.match(
    admin,
    /\/thesis\/defense\/\$\{scheduleId\}\/records\/evaluations\/pdf/,
  );
  // The bundled packet supersedes the visible per-row evaluator workflow.
  assert.doesNotMatch(admin, /criteria\/\$\{e\.panelAssignmentId\}\/pdf/);
});

test("Evaluation Results has one section-level bundled action and no per-row PDF buttons", () => {
  const admin = read(ADMIN);
  const header = between(admin, "Evaluation Results", "</CardHeader>");

  assert.match(header, /OfficialPdfButton/);
  assert.match(header, /evaluationsReady/);
  assert.match(admin, /records\/evaluations\/pdf/);
  assert.doesNotMatch(admin, />\s*Action\s*</);
  assert.doesNotMatch(admin, /label="PDF"/);
  assert.doesNotMatch(admin, /criteria:\$\{e\.panelAssignmentId\}/);
  assert.doesNotMatch(admin, /individual-evaluation-\$\{scheduleId\}-\$\{e\.panelAssignmentId\}/);
});

test("bundle availability uses existing safe metadata only", () => {
  const admin = read(ADMIN);

  assert.match(admin, /data\.individualEvaluations\.length > 0/);
  assert.match(admin, /data\.individualEvaluations\.every/);
  assert.match(admin, /hasOfficialCriteria/);
  assert.match(admin, /!data\.oralExamSummary\.ready/);
  assert.match(
    admin,
    /Available after all evaluators finalize and sign their evaluations\./,
  );
  assert.match(
    admin,
    /Available after the official Oral Examination Summary is generated\./,
  );
});

test("frontend fallbacks stay readable and never expose a schedule UUID", () => {
  const admin = read(ADMIN);

  assert.match(admin, /Defense-Application\.pdf/);
  assert.match(admin, /Individual-Evaluations\.pdf/);
  assert.match(admin, /Oral-Examination-Summary\.pdf/);
  assert.doesNotMatch(admin, /records\/application\/pdf`,\s*`[^`]*\$\{scheduleId\}/);
});

test("Committee Report stays disabled with accurate wording", () => {
  const admin = read(ADMIN);
  const committee = between(admin, "Committee Report", "</CardHeader>");

  assert.match(committee, /DownloadPrintButton/);
  assert.match(admin, /Official Committee Report PDF is not available yet\./);
});

test("no browser printing, public PDF links, or query tokens", () => {
  const admin = read(ADMIN);

  assert.doesNotMatch(admin, /window\.print\(\)/);
  assert.doesNotMatch(admin, /<a[^>]+href=\{[^}]*pdf/i);
  assert.doesNotMatch(admin, /\?token=|\btoken=\$\{/);
  assert.doesNotMatch(admin, /https?:\/\/[^"'`]*records\/[^"'`]*pdf/);
});

test("loading is scoped and errors use Sonner", () => {
  const admin = read(ADMIN);

  assert.match(admin, /pending/);
  assert.match(admin, /Generating/);
  assert.match(admin, /toast\.error/);
  assert.match(admin, /"evaluations"/);
  assert.doesNotMatch(admin, /\balert\(/);
});

test("existing Defense Record sections remain intact", () => {
  const admin = read(ADMIN);

  for (const marker of [
    "Defense Overview",
    "Defense Committee",
    "Evaluation Results",
    "Oral Examination Summary",
    "Committee Report",
    "Student No.",
    "Formal Result",
  ]) {
    assert.match(admin, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});
