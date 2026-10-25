import express from "express";
import jwt from "jsonwebtoken";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../../../src/utils/AppError";

const mocks = vi.hoisted(() => ({ pdf: vi.fn(), list: vi.fn(), create: vi.fn() }));
vi.mock("../../../src/config/database", () => ({ default: {} }));
vi.mock("../../../src/services/adviser-request-record.service", () => ({ AdviserRequestRecordService: class {
  list = mocks.list; generatePdf = mocks.pdf;
} }));
vi.mock("../../../src/services/thesis.service", () => ({ ThesisService: class { requestAdviser = mocks.create; } }));
import thesisRoutes from "../../../src/routes/thesis.routes";

describe("GS020-1B authenticated Adviser Request record routes", () => {
  let server: ReturnType<express.Express["listen"]>;
  let origin: string;
  const secret = "gs020-record-test-secret";
  beforeAll(async () => {
    vi.stubEnv("JWT_SECRET", secret);
    const app = express(); app.use(express.json()); app.use("/thesis", thesisRoutes);
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
    mocks.pdf.mockResolvedValue({ pdf: Buffer.from("%PDF-1.7\nGS020"), filename: "Sam-Student-Adviser-Request.pdf" });
    mocks.list.mockResolvedValue([{ id: "req-1", studentName: "Sam Student", pdfAvailable: true }]);
    mocks.create.mockResolvedValue({ id: "req-1" });
  });
  function headers(role?: string) {
    return role ? { Authorization: `Bearer ${jwt.sign({ userId: "actor", role }, secret)}` } : {};
  }

  it.each(["STUDENT", "PANELIST", "ADMIN"])("forwards exact authenticated %s identity to service authorization", async role => {
    const response = await fetch(`${origin}/thesis/adviser/requests/req-1/pdf`, { headers: headers(role) });
    expect(response.status).toBe(200);
    expect(mocks.pdf).toHaveBeenCalledWith("req-1", { userId: "actor", role });
    expect(response.headers.get("Content-Type")).toContain("application/pdf");
    expect(response.headers.get("Content-Disposition")).toContain("Sam-Student-Adviser-Request.pdf");
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it.each([undefined, "APPLICANT", "CHAIRMAN", "RAPPORTEUR", "FACILITATOR"])("denies unsupported or unauthenticated actor %s", async role => {
    for (const route of ["/thesis/adviser/requests/records", "/thesis/adviser/requests/req-1/pdf"]) {
      const response = await fetch(origin + route, { headers: headers(role) });
      expect(response.status).toBe(role ? 403 : 401);
    }
    expect(mocks.pdf).not.toHaveBeenCalled();
    expect(mocks.list).not.toHaveBeenCalled();
  });

  it("lists safe records through a route distinct from the Admin request queue", async () => {
    const response = await fetch(`${origin}/thesis/adviser/requests/records`, { headers: headers("STUDENT") });
    expect(response.status).toBe(200);
    expect(mocks.list).toHaveBeenCalledWith({ userId: "actor", role: "STUDENT" });
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(JSON.stringify(await response.json())).not.toMatch(/signatureData|base64|snapshot/);
  });

  it("keeps request creation on the existing Student endpoint and authenticated identity", async () => {
    const body = { requestedAdviserId: "candidate", signatureData: "explicit-test-evidence", userId: "forged-user" };
    const response = await fetch(`${origin}/thesis/adviser/request`, {
      method: "POST", headers: { ...headers("STUDENT"), "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    expect(response.status).toBe(201);
    expect(mocks.create).toHaveBeenCalledWith("actor", { requestedAdviserId: "candidate", reason: undefined,
      signatureData: "explicit-test-evidence", reviewedContext: undefined, studentId: undefined });
    const denied = await fetch(`${origin}/thesis/adviser/request`, {
      method: "POST", headers: { ...headers("PANELIST"), "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    expect(denied.status).toBe(403);
  });

  it("preserves domain denials and hides internal evidence in unexpected error responses", async () => {
    mocks.pdf.mockRejectedValueOnce(new AppError("Adviser Request record not found.", 404));
    const denied = await fetch(`${origin}/thesis/adviser/requests/other/pdf`, { headers: headers("STUDENT") });
    expect(denied.status).toBe(404);
    mocks.pdf.mockRejectedValueOnce(new Error("signatureData=private; snapshot=secret"));
    const failed = await fetch(`${origin}/thesis/adviser/requests/req-1/pdf`, { headers: headers("ADMIN") });
    expect(failed.status).toBe(500);
    expect(await failed.text()).not.toMatch(/signatureData|private|snapshot|secret/);
  });
});
