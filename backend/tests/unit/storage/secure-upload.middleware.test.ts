import express, { type NextFunction, type Request, type Response } from "express";
import { mkdtemp, readdir, rm } from "fs/promises";
import { existsSync } from "fs";
import type { AddressInfo } from "net";
import { tmpdir } from "os";
import path from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { LocalStorageProvider } from "../../../src/storage/local-storage.provider";
import { createSecureUpload } from "../../../src/storage/secure-upload";
import {
  cleanupRequestUploads,
  commitRequestUploads,
} from "../../../src/storage/request-uploads";
import type { UploadPolicy } from "../../../src/storage/upload-policy";

const PDF_BYTES = Buffer.from("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF\n");
const TEXT_BYTES = Buffer.from("not a real document, just plain text bytes here");

let base: string;
let provider: LocalStorageProvider;
let server: ReturnType<express.Express["listen"]>;
let origin: string;

async function post(
  route: string,
  field: string,
  name: string,
  bytes: Buffer,
  type: string,
) {
  const form = new FormData();
  form.append(field, new Blob([new Uint8Array(bytes)], { type }), name);
  return fetch(`${origin}${route}`, { method: "POST", body: form });
}

async function permanentFiles(): Promise<string[]> {
  const root = path.join(base, "root");
  const out: string[] = [];
  async function walk(dir: string) {
    if (!existsSync(dir)) return;
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === ".tmp") continue;
        await walk(full);
      } else {
        out.push(full);
      }
    }
  }
  await walk(root);
  return out;
}

beforeAll(async () => {
  base = await mkdtemp(path.join(tmpdir(), "dl2-middleware-"));
  provider = new LocalStorageProvider({ root: path.join(base, "root") });
  const secure = createSecureUpload(provider);

  const smallPolicy: UploadPolicy = {
    name: "tiny",
    storagePrefix: "tiny",
    maxFiles: 1,
    maxBytes: 32,
    allowedMimeTypes: null,
    fallbackExtensionsWhenUndetected: [],
  };

  const app = express();
  app.post("/upload", secure("applicant-cor").single("file"), (req, res) => {
    const file = req.file as Express.Multer.File & { storageMeta?: unknown };
    res.json({ ok: true, path: file.path, meta: file.storageMeta });
  });
  app.post("/tiny", secure(smallPolicy).single("file"), (req, res) => {
    res.json({ ok: true });
  });
  app.post("/fail", secure("evaluation-instrument").single("file"), async (req, res) => {
    // Simulates a domain-service rejection after the object was promoted.
    await cleanupRequestUploads(req, provider);
    res.status(400).json({ error: "domain rejected" });
  });
  app.post("/commit", secure("evaluation-instrument").single("file"), (req, res) => {
    commitRequestUploads(req);
    res.json({ ok: true, path: (req.file as Express.Multer.File).path });
  });
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    res.status(err?.statusCode ?? 500).json({ error: err?.message, code: err?.code, name: err?.name });
  });

  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
  await rm(base, { recursive: true, force: true });
});

describe("secure upload middleware", () => {
  it("accepts allowed content, promotes it, and returns verified metadata", async () => {
    const res = await post("/upload", "file", "thesis.pdf", PDF_BYTES, "application/pdf");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(existsSync(body.path)).toBe(true);
    expect(body.meta.verifiedMimeType).toBe("application/pdf");
    expect(body.meta.sizeBytes).toBe(PDF_BYTES.length);
    expect(body.meta.checksumAlgorithm).toBe("sha256");
    expect(body.meta.storageKey.startsWith("cor/")).toBe(true);
  });

  it("rejects spoofed content and leaves no permanent orphan", async () => {
    const before = (await permanentFiles()).length;
    const res = await post("/upload", "file", "fake.pdf", TEXT_BYTES, "application/pdf");
    expect(res.status).toBe(400);
    expect((await permanentFiles()).length).toBe(before);
  });

  it("rejects oversized uploads with 413", async () => {
    const res = await post(
      "/tiny",
      "file",
      "big.bin",
      Buffer.alloc(64, 1),
      "application/octet-stream",
    );
    expect(res.status).toBe(413);
  });

  it("rejects unexpected fields", async () => {
    const res = await post("/upload", "other", "x.pdf", PDF_BYTES, "application/pdf");
    expect(res.status).toBe(400);
  });

  it("does not leave temporary files after a successful request", async () => {
    await post("/upload", "file", "thesis.pdf", PDF_BYTES, "application/pdf");
    const tempRoot = provider.temporaryRoot();
    const children = existsSync(tempRoot) ? await readdir(tempRoot) : [];
    expect(children).toEqual([]);
  });

  it("cleans up the promoted object when a domain service rejects", async () => {
    const before = (await permanentFiles()).length;
    const res = await post("/fail", "file", "instrument.pdf", PDF_BYTES, "application/pdf");
    expect(res.status).toBe(400);
    expect((await permanentFiles()).length).toBe(before);
  });

  it("keeps the promoted object after a successful commit", async () => {
    const res = await post("/commit", "file", "instrument.pdf", PDF_BYTES, "application/pdf");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(existsSync(body.path)).toBe(true);
  });
});
