import express from "express";
import jwt from "jsonwebtoken";
import type { AddressInfo } from "node:net";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
const mocks = vi.hoisted(() => ({
  submission: vi.fn(),
  availability: vi.fn(),
  studentPdf: vi.fn(),
  adminPdf: vi.fn(),
  filename: vi.fn(),
  detail: vi.fn(),
}));
vi.mock("../../../src/config/database", () => ({ default: {} }));
vi.mock("../../../src/services/thesis.service", () => ({
  ThesisService: class {
    getScheduledDefenseSubmission = mocks.submission;
    getStudentDefenseApplicationAvailability = mocks.availability;
    generateStudentDefenseApplicationPdf = mocks.studentPdf;
    generateDefenseApplicationPdf = mocks.adminPdf;
    getOfficialDocumentFilename = mocks.filename;
    getScheduledDefenseDetail = mocks.detail;
  },
}));
import thesisRoutes from "../../../src/routes/thesis.routes";
import { AppError } from "../../../src/utils/AppError";

describe("PREDEF-2 authenticated read-only routes", () => {
  let server: ReturnType<express.Express["listen"]>;
  let origin: string;
  const secret = "predef-2-route-secret";
  const studentPath = "/thesis/student/defense/exact-schedule/application";
  const submissionPath = "/thesis/defense/schedules/exact-schedule/submission";
  const adminPdfPath = "/thesis/defense/exact-schedule/records/application/pdf";
  beforeAll(async () => {
    vi.stubEnv("JWT_SECRET", secret);
    const app = express();
    app.use("/thesis", thesisRoutes);
    server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve) => server.once("listening", resolve));
    origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    vi.unstubAllEnvs();
  });
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.submission.mockResolvedValue({
      scheduleId: "exact-schedule",
      manuscript: { id: "v1" },
    });
    mocks.availability.mockResolvedValue({
      scheduleId: "exact-schedule",
      available: true,
    });
    mocks.studentPdf.mockResolvedValue({
      pdf: Buffer.from("%PDF-1.7 app"),
      filename: "Student-Proposal-Defense-Application.pdf",
    });
    mocks.adminPdf.mockResolvedValue(Buffer.from("%PDF-1.7 app"));
    mocks.filename.mockResolvedValue(
      "Student-Proposal-Defense-Application.pdf",
    );
    mocks.detail.mockResolvedValue({ scheduleId: "exact-schedule" });
  });
  function request(path: string, role?: string, method = "GET") {
    return fetch(origin + path, {
      method,
      headers: role
        ? {
            Authorization: `Bearer ${jwt.sign({ userId: "actor", role }, secret)}`,
          }
        : {},
    });
  }
  it("forwards Student identity and exact schedule for readiness and PDF", async () => {
    expect((await request(studentPath, "STUDENT")).status).toBe(200);
    expect(mocks.availability).toHaveBeenCalledExactlyOnceWith(
      "exact-schedule",
      { userId: "actor", role: "STUDENT" },
    );
    const response = await request(`${studentPath}/pdf`, "STUDENT");
    expect(response.status).toBe(200);
    expect(mocks.studentPdf).toHaveBeenCalledExactlyOnceWith("exact-schedule", {
      userId: "actor",
      role: "STUDENT",
    });
    expect(response.headers.get("content-type")).toContain("application/pdf");
    expect(response.headers.get("content-disposition")).toContain(
      "Student-Proposal-Defense-Application.pdf",
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(await response.text()).toContain("%PDF-");
  });
  it.each([undefined, "ADMIN", "PANELIST", "APPLICANT"])(
    "denies %s at both Student routes",
    async (role) => {
      for (const path of [studentPath, `${studentPath}/pdf`])
        expect((await request(path, role)).status).toBe(role ? 403 : 401);
      expect(mocks.studentPdf).not.toHaveBeenCalled();
      expect(mocks.availability).not.toHaveBeenCalled();
    },
  );
  it.each([undefined, "STUDENT", "PANELIST", "APPLICANT"])(
    "preserves Admin-only detail, context and application for %s",
    async (role) => {
      for (const path of [
        "/thesis/defense/schedules/exact-schedule",
        submissionPath,
        adminPdfPath,
      ])
        expect((await request(path, role)).status).toBe(role ? 403 : 401);
      expect(mocks.submission).not.toHaveBeenCalled();
      expect(mocks.adminPdf).not.toHaveBeenCalled();
      expect(mocks.detail).not.toHaveBeenCalled();
    },
  );
  it("preserves existing Admin detail and official application behavior", async () => {
    expect(
      (await request("/thesis/defense/schedules/exact-schedule", "ADMIN"))
        .status,
    ).toBe(200);
    expect((await request(adminPdfPath, "ADMIN")).status).toBe(200);
    expect(mocks.adminPdf).toHaveBeenCalledWith("exact-schedule", {
      userId: "actor",
      role: "ADMIN",
    });
    expect((await request(submissionPath, "ADMIN")).status).toBe(200);
    expect(mocks.submission).toHaveBeenCalledWith("exact-schedule", {
      userId: "actor",
      role: "ADMIN",
    });
  });
  it("preserves non-owned/missing schedule denial without sending PDF or identity", async () => {
    mocks.studentPdf.mockRejectedValueOnce(
      new AppError("Defense session not found.", 404),
    );
    mocks.availability.mockRejectedValueOnce(
      new AppError("Defense session not found.", 404),
    );
    for (const path of [studentPath, `${studentPath}/pdf`]) {
      const response = await request(path, "STUDENT");
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({
        error: "Defense session not found.",
      });
      expect(response.headers.get("content-disposition")).toBeNull();
    }
  });
  it.each(["studentPdf", "availability", "submission"] as const)(
    "does not expose raw %s errors",
    async (method) => {
      mocks[method].mockRejectedValueOnce(
        new Error("signatureData storageKey checksum private"),
      );
      const response = await request(
        method === "submission"
          ? submissionPath
          : method === "availability"
            ? studentPath
            : `${studentPath}/pdf`,
        method === "submission" ? "ADMIN" : "STUDENT",
      );
      expect(response.status).toBe(500);
      expect(await response.text()).not.toMatch(
        /signatureData|storageKey|checksum|private/,
      );
    },
  );
  it.each(["POST", "PUT", "PATCH", "DELETE"])(
    "offers no %s mutation handler on new routes",
    async (method) => {
      for (const path of [studentPath, `${studentPath}/pdf`, submissionPath])
        expect((await request(path, "STUDENT", method)).status).toBe(404);
      expect(mocks.studentPdf).not.toHaveBeenCalled();
      expect(mocks.submission).not.toHaveBeenCalled();
    },
  );
});
