import express, { type NextFunction, type Request, type Response } from "express";
import { mkdtemp, rm } from "fs/promises";
import type { AddressInfo } from "net";
import { tmpdir } from "os";
import path from "path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { LocalStorageProvider } from "../../../src/storage/local-storage.provider";
import { createSecureUpload } from "../../../src/storage/secure-upload";
import { UploadTelemetry } from "../../../src/storage/upload-telemetry";
import type { UploadPolicy } from "../../../src/storage/upload-policy";

/**
 * DL-11: the secure upload pipeline records process-local telemetry for
 * successes and failures without changing upload behavior or leaking data.
 */

const PDF_BYTES = Buffer.from("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF\n");
const TEXT_BYTES = Buffer.from("definitely not a real document body");

let base: string;
let provider: LocalStorageProvider;
let telemetry: UploadTelemetry;
let server: ReturnType<express.Express["listen"]>;
let origin: string;
let tempFailureTelemetry: UploadTelemetry;

async function post(field: string, name: string, bytes: Buffer, type: string) {
  const form = new FormData();
  form.append(field, new Blob([new Uint8Array(bytes)], { type }), name);
  return fetch(`${origin}/upload`, { method: "POST", body: form });
}

beforeAll(async () => {
  base = await mkdtemp(path.join(tmpdir(), "dl11-telemetry-"));
  provider = new LocalStorageProvider({ root: path.join(base, "root") });
  telemetry = new UploadTelemetry();
  const secure = createSecureUpload(provider, telemetry);

  const tiny: UploadPolicy = {
    name: "tiny",
    storagePrefix: "tiny",
    maxFiles: 1,
    maxBytes: 32,
    allowedMimeTypes: null,
    fallbackExtensionsWhenUndetected: [],
  };

  const failingProvider = new LocalStorageProvider({
    root: path.join(base, "root-tempfail"),
  });
  vi.spyOn(failingProvider, "removeTemporaryDir").mockRejectedValue(
    new Error("temp finalization failed"),
  );
  tempFailureTelemetry = new UploadTelemetry();
  const secureFailing = createSecureUpload(failingProvider, tempFailureTelemetry);

  const app = express();
  app.post("/upload", secure("applicant-cor").single("file"), (req, res) => {
    res.json({ ok: true });
  });
  app.post("/tiny", secure(tiny).single("file"), (req, res) => {
    res.json({ ok: true });
  });
  app.post("/tempfail", secureFailing("applicant-cor").single("file"), (req, res) => {
    res.json({ ok: true });
  });
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    res.status(err?.statusCode ?? 500).json({ error: err?.message });
  });

  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
  await rm(base, { recursive: true, force: true });
});

describe("DL-11 upload telemetry instrumentation", () => {
  it("increments success on a completed secure upload", async () => {
    const before = telemetry.snapshot();
    const res = await post("file", "thesis.pdf", PDF_BYTES, "application/pdf");
    expect(res.status).toBe(200);
    const after = telemetry.snapshot();
    expect(after.attempts).toBe(before.attempts + 1);
    expect(after.successes).toBe(before.successes + 1);
    expect(after.failures).toBe(before.failures);
  });

  it("increments a VALIDATION failure for disallowed content", async () => {
    const before = telemetry.snapshot();
    const res = await post("file", "fake.pdf", TEXT_BYTES, "application/pdf");
    expect(res.status).toBe(400);
    const after = telemetry.snapshot();
    expect(after.failures).toBe(before.failures + 1);
    expect(after.recentFailures.at(-1)?.stage).toBe("VALIDATION");
    expect(after.recentFailures.at(-1)?.statusClass).toBe("4xx");
  });

  it("increments a MULTIPART failure for an oversized upload", async () => {
    const before = telemetry.snapshot();
    const form = new FormData();
    form.append(
      "file",
      new Blob([new Uint8Array(Buffer.alloc(64, 1))]),
      "big.bin",
    );
    const res = await fetch(`${origin}/tiny`, { method: "POST", body: form });
    expect(res.status).toBe(413);
    const after = telemetry.snapshot();
    expect(after.failures).toBe(before.failures + 1);
    expect(after.recentFailures.at(-1)?.stage).toBe("MULTIPART");
  });

  it("keeps recent failure events sanitized", async () => {
    await post("file", "secret-name.pdf", TEXT_BYTES, "application/pdf");
    const serialized = JSON.stringify(telemetry.snapshot().recentFailures);
    for (const forbidden of ["secret-name", "filename", "cor/", "storageKey", "path"]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it("records a TEMP_STORAGE failure when post-promotion temp finalization fails", async () => {
    const form = new FormData();
    form.append(
      "file",
      new Blob([new Uint8Array(PDF_BYTES)], { type: "application/pdf" }),
      "thesis.pdf",
    );
    const res = await fetch(`${origin}/tempfail`, { method: "POST", body: form });
    expect(res.status).toBeGreaterThanOrEqual(400);

    const snapshot = tempFailureTelemetry.snapshot();
    expect(snapshot.attempts).toBe(1);
    expect(snapshot.successes).toBe(0);
    expect(snapshot.failures).toBe(1);
    expect(snapshot.recentFailures[0]?.stage).toBe("TEMP_STORAGE");

    const serialized = JSON.stringify(snapshot.recentFailures);
    for (const forbidden of [
      "thesis",
      "filename",
      "cor/",
      "storageKey",
      "path",
      "root-tempfail",
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});
