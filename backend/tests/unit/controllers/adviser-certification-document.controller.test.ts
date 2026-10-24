import express from "express";
import jwt from "jsonwebtoken";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ generate: vi.fn(), list: vi.fn() }));
vi.mock("../../../src/config/database", () => ({ default: {} }));
vi.mock("../../../src/services/thesis.service", () => ({ ThesisService: class {
  generateAdviserCertificationPdf = mocks.generate;
  listAdviserCertifications = mocks.list;
} }));
import thesisRoutes from "../../../src/routes/thesis.routes";
import { AppError } from "../../../src/utils/AppError";

describe("PREDEF-1C actual authenticated GS-017 routes and PDF response", () => {
  let server: ReturnType<express.Express["listen"]>;
  let origin: string;
  const secret = "predef-certification-test-secret";
  beforeAll(async () => {
    vi.stubEnv("JWT_SECRET", secret);
    const app = express(); app.use("/thesis", thesisRoutes);
    server = app.listen(0, "127.0.0.1");
    await new Promise<void>(resolve => server.once("listening", resolve));
    origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(async () => {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    vi.unstubAllEnvs();
  });
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.generate.mockResolvedValue({ pdf: Buffer.from("%PDF-1.7\nGS-017"), filename: "Alex-Student-Proposal-Defense-Adviser-Certification-GS-017.pdf" });
    mocks.list.mockResolvedValue([{ id: "cert-1", status: "ISSUED", manuscriptTitle: "Exact Title" }]);
  });
  function get(path: string, role?: string) {
    return fetch(origin + path, { headers: role ? { Authorization: `Bearer ${jwt.sign({ userId: "actor", role }, secret)}` } : {} });
  }

  it.each(["STUDENT", "PANELIST", "ADMIN"])("forwards the authenticated %s identity for independent service authorization", async role => {
    const response = await get("/thesis/adviser-certifications/cert-1/pdf", role);
    expect(response.status).toBe(200);
    expect(mocks.generate).toHaveBeenCalledWith("cert-1", { userId: "actor", role });
    expect(response.headers.get("Content-Type")).toContain("application/pdf");
    expect(response.headers.get("Content-Disposition")).toContain('attachment; filename="Alex-Student-');
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    const bytes = await response.text(); expect(bytes).toContain("%PDF-");
    expect(bytes).not.toMatch(/signatureData|storageKey|filePath|checksum/);
  });

  it.each([undefined, "APPLICANT", "CHAIRMAN", "RAPPORTEUR", "FACILITATOR"])("denies unsupported or unauthenticated role %s before generation", async role => {
    const response = await get("/thesis/adviser-certifications/cert-1/pdf", role);
    expect(response.status).toBe(role ? 403 : 401);
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it("preserves authorization-safe not-found responses from the service", async () => {
    mocks.generate.mockRejectedValueOnce(new AppError("Adviser certification not found.", 404));
    const response = await get("/thesis/adviser-certifications/other/pdf", "STUDENT");
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Adviser certification not found." });
  });

  it("returns only safe list metadata with explicit thesis and stage filters", async () => {
    const response = await get("/thesis/adviser-certifications?thesisId=thesis-1&stage=FINAL", "ADMIN");
    expect(response.status).toBe(200);
    expect(mocks.list).toHaveBeenCalledWith({ userId: "actor", role: "ADMIN" }, "thesis-1", "FINAL");
    expect(await response.json()).toEqual([{ id: "cert-1", status: "ISSUED", manuscriptTitle: "Exact Title" }]);
  });

  it("rejects multipart query-shaped filters", async () => {
    expect((await get("/thesis/adviser-certifications?stage=PROPOSAL&stage=FINAL", "ADMIN")).status).toBe(400);
    expect(mocks.list).not.toHaveBeenCalled();
  });

  it("never leaks internal errors through PDF or metadata failures", async () => {
    mocks.generate.mockRejectedValueOnce(new Error("signatureData=data:image/png; filePath=/private/path"));
    const pdf = await get("/thesis/adviser-certifications/cert-1/pdf", "ADMIN");
    expect(pdf.status).toBe(500); expect(await pdf.text()).not.toMatch(/signatureData|private|data:image/);
    mocks.list.mockRejectedValueOnce(new Error("storageKey=private; checksum=secret"));
    const list = await get("/thesis/adviser-certifications?thesisId=thesis-1", "ADMIN");
    expect(list.status).toBe(500); expect(await list.text()).not.toMatch(/storageKey|checksum|private/);
  });
});
