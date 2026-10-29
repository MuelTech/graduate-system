import express from "express";
import { once } from "events";
import type { Server } from "http";
import type { AddressInfo } from "net";
import { mkdtemp, readdir, rm } from "fs/promises";
import path from "path";
import { tmpdir } from "os";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { LocalStorageProvider } from "../../../src/storage/local-storage.provider";
import { EXAM_PNG, EXAM_JPEG } from "../../fixtures/exam-images";

const db = vi.hoisted(() => ({ examMedia: { create: vi.fn(), findUnique: vi.fn() } }));
vi.mock("../../../src/config/database", () => ({ default: db }));
vi.mock("../../../src/utils/jwt", () => ({
  JwtConfigurationError: class extends Error {},
  verifyAccessToken: (token: string) => {
    if (["ADMIN", "APPLICANT", "STUDENT", "PANELIST"].includes(token)) return { userId: "u1", role: token };
    throw new Error("Invalid token");
  },
}));
let base: string;
let provider: LocalStorageProvider;
let server: Server;
let origin: string;
const records = new Map<string, Record<string, unknown>>();
beforeAll(async () => {
  base = await mkdtemp(path.join(tmpdir(), "exam-admin-upload-"));
  provider = new LocalStorageProvider({ root: base });
  vi.doMock("../../../src/storage/index", () => ({ storageProvider: provider }));
  const router = (await import("../../../src/routes/exam-engine.routes")).default;
  const app = express();
  app.use("/api/exam-engine", router);
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/exam-engine`;
});
beforeEach(() => {
  vi.clearAllMocks();
  db.examMedia.create.mockImplementation(async ({ data }) => { records.set(data.id, data); return { id: data.id }; });
  db.examMedia.findUnique.mockImplementation(async ({ where }) => records.get(where.id) ?? null);
});
afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>(resolve => server.close(() => resolve()));
  if (path.dirname(path.resolve(base)) !== path.resolve(tmpdir()) || !path.basename(base).startsWith("exam-admin-upload-")) throw new Error("Unsafe test cleanup target");
  await rm(base, { recursive: true, force: true });
});
async function permanentFiles() {
  return (await readdir(path.join(base, "exam-media")).catch(() => [])) as string[];
}
async function upload(bytes: Buffer, role: string | undefined = "ADMIN", files = 1) {
  const form = new FormData();
  for (let i = 0; i < files; i++) form.append("file", new Blob([new Uint8Array(bytes)], { type: "image/png" }), "synthetic.png");
  return fetch(`${origin}/admin/media`, { method: "POST", headers: role ? { Authorization: `Bearer ${role}` } : {}, body: form });
}

describe("Admin-only image upload with the actual secure promotion/request lifecycle", () => {
  it.each([["PNG", EXAM_PNG, "image/png"], ["JPEG", EXAM_JPEG, "image/jpeg"]] as const)("accepts %s, promotes exactly once, returns UUID only, and retains bytes after request commit", async (_name, bytes, mime) => {
    const before = (await permanentFiles()).length;
    const promotion = vi.spyOn(provider, "promoteTemporaryFile");
    const response = await upload(bytes);
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body).toEqual({ id: expect.stringMatching(/^[a-f0-9-]{36}$/) });
    expect((await permanentFiles()).length).toBe(before + 1);
    expect(promotion).toHaveBeenCalledTimes(1);
    expect(db.examMedia.create).toHaveBeenCalledTimes(1);
    expect(db.examMedia.create.mock.calls[0][0].data.verifiedMimeType).toBe(mime);
    expect(await readdir(provider.temporaryRoot())).toEqual([]);
    const retrieved = await fetch(`${origin}/media/${body.id}`, { headers: { Authorization: "Bearer ADMIN" } });
    expect(retrieved.status).toBe(200);
    expect(retrieved.headers.get("content-type")).toBe(mime);
    expect(Buffer.from(await retrieved.arrayBuffer())).toEqual(bytes);
    promotion.mockRestore();
  });

  it.each([[undefined, 401], ["APPLICANT", 403], ["STUDENT", 403], ["PANELIST", 403], ["invalid", 403]] as const)("rejects unauthorized role/token %s before promotion", async (role, status) => {
    const before = (await permanentFiles()).length;
    // Pass undefined explicitly; upload's default is overridden via a direct request.
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(EXAM_PNG)]), "synthetic.png");
    const response = await fetch(`${origin}/admin/media`, { method: "POST", body: form, headers: role ? { Authorization: `Bearer ${role}` } : {} });
    expect(response.status).toBe(status);
    expect(db.examMedia.create).not.toHaveBeenCalled();
    expect((await permanentFiles()).length).toBe(before);
  });

  it.each([Buffer.from("not a real PNG despite its name and MIME"), Buffer.from("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF\n")])("rejects spoofed/unsupported content %# through the shared image policy", async bytes => {
    const before = (await permanentFiles()).length;
    const response = await upload(bytes);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Upload one valid PNG or JPEG image." });
    expect(db.examMedia.create).not.toHaveBeenCalled();
    expect((await permanentFiles()).length).toBe(before);
  });

  it("rejects oversized files and multiple images without persistent objects", async () => {
    const before = (await permanentFiles()).length;
    const oversized = await upload(Buffer.alloc(5 * 1024 * 1024 + 1));
    expect(oversized.status).toBe(413);
    expect((await upload(EXAM_PNG, "ADMIN", 2)).status).toBe(400);
    expect((await permanentFiles()).length).toBe(before);
  });

  it("cleans the promoted request upload on DB failure and never leaks internal errors", async () => {
    const before = (await permanentFiles()).length;
    db.examMedia.create.mockRejectedValueOnce(new Error("storageKey provider C:/private/path"));
    const response = await upload(EXAM_PNG);
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Could not save exam image." });
    expect((await permanentFiles()).length).toBe(before);
    expect(await readdir(provider.temporaryRoot())).toEqual([]);
  });

  it("rejects an empty upload without registering media", async () => {
    const response = await fetch(`${origin}/admin/media`, { method: "POST", headers: { Authorization: "Bearer ADMIN" }, body: new FormData() });
    expect(response.status).toBe(400);
    expect(db.examMedia.create).not.toHaveBeenCalled();
  });
});
