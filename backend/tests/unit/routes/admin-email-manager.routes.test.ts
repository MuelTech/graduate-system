import express from "express";
import jwt from "jsonwebtoken";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    user: { findUnique: vi.fn() },
    emailTemplate: { findMany: vi.fn(), findUnique: vi.fn(), upsert: vi.fn() },
    emailLog: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    auditLog: { create: vi.fn() },
  },
}));

vi.mock("../../../src/config/database", () => ({ default: prismaMock }));

import emailRoutes from "../../../src/routes/email.routes";

async function request(
  app: express.Express,
  method: "GET" | "POST" | "PUT",
  path: string,
  token: string,
  body?: unknown,
) {
  const server = app.listen(0);
  const { port } = server.address() as { port: number };
  try {
    const res = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const json = await res.json().catch(() => null);
    return { status: res.status, body: json };
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

describe("Admin Email Manager Routes (/api/admin/emails)", () => {
  const app = express();
  app.use(express.json());
  app.use("/api/admin/emails", emailRoutes);

  let fullAdminToken = "";
  let restrictedWithoutSettingsToken = "";
  let studentToken = "";

  beforeAll(() => {
    process.env.JWT_SECRET = "test-jwt-secret-email-manager";
    fullAdminToken = jwt.sign(
      { userId: "admin-full", role: "ADMIN", tokenVersion: 1 },
      process.env.JWT_SECRET,
    );
    restrictedWithoutSettingsToken = jwt.sign(
      { userId: "admin-restricted", role: "ADMIN", tokenVersion: 1 },
      process.env.JWT_SECRET,
    );
    studentToken = jwt.sign(
      { userId: "student-1", role: "STUDENT", tokenVersion: 1 },
      process.env.JWT_SECRET,
    );
  });

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.user.findUnique.mockImplementation(async ({ where }: any) => {
      if (where.id === "admin-full") {
        return {
          id: "admin-full",
          role: "ADMIN",
          isActive: true,
          tokenVersion: 1,
          adminAccessLevel: "FULL",
          adminCapabilities: [],
          panelist: null,
        };
      }
      if (where.id === "admin-restricted") {
        return {
          id: "admin-restricted",
          role: "ADMIN",
          isActive: true,
          tokenVersion: 1,
          adminAccessLevel: "RESTRICTED",
          adminCapabilities: ["students.manage"],
          panelist: null,
        };
      }
      return {
        id: "student-1",
        role: "STUDENT",
        isActive: true,
        tokenVersion: 1,
        adminAccessLevel: null,
        adminCapabilities: [],
        panelist: null,
      };
    });
  });

  it("blocks non-ADMIN and Restricted Admins without settings.manage", async () => {
    const resStudent = await request(app, "GET", "/api/admin/emails/templates", studentToken);
    expect(resStudent.status).toBe(403);

    const resRestricted = await request(
      app,
      "GET",
      "/api/admin/emails/templates",
      restrictedWithoutSettingsToken,
    );
    expect(resRestricted.status).toBe(403);
  });

  it("lists all 22 canonical templates with human names, categories, and active status", async () => {
    prismaMock.emailTemplate.findMany.mockResolvedValue([
      {
        templateKey: "applicant_registered",
        subject: "Custom Welcome",
        bodyHtml: "<p>Hello {{recipient_name}}</p>",
        isActive: false,
        updatedAt: new Date("2026-11-21T00:00:00.000Z"),
      },
    ]);

    const res = await request(app, "GET", "/api/admin/emails/templates", fullAdminToken);
    expect(res.status).toBe(200);
    expect(res.body.templates).toHaveLength(22);

    const welcome = res.body.templates.find(
      (t: any) => t.templateKey === "applicant_registered",
    );
    expect(welcome).toMatchObject({
      name: "Applicant Registration Welcome",
      category: "ACCOUNTS",
      isActive: false,
      isCustomized: true,
    });
  });

  it("previews and updates a template cleanly with Handlebars validation", async () => {
    prismaMock.emailTemplate.findUnique.mockResolvedValue(null);
    const preview = await request(
      app,
      "POST",
      "/api/admin/emails/templates/exam_scheduled/preview",
      fullAdminToken,
      { subject: "Exam on {{exam_date}}", bodyHtml: "<p>Dear {{recipient_name}}</p>" },
    );
    expect(preview.status).toBe(200);
    expect(preview.body.subject).toContain("Exam on November 28, 2026");
    expect(preview.body.html).toContain("Office of the Graduate School");

    prismaMock.emailTemplate.upsert.mockResolvedValue({
      id: "tpl-1",
      templateKey: "exam_scheduled",
      subject: "Exam on {{exam_date}}",
      bodyHtml: "<p>Dear {{recipient_name}}</p>",
      isActive: true,
      updatedAt: new Date(),
    });
    prismaMock.auditLog.create.mockResolvedValue({});

    const updated = await request(
      app,
      "PUT",
      "/api/admin/emails/templates/exam_scheduled",
      fullAdminToken,
      { subject: "Exam on {{exam_date}}", bodyHtml: "<p>Dear {{recipient_name}}</p>", isActive: true },
    );
    expect(updated.status).toBe(200);
    expect(updated.body.message).toBe("Email template saved.");
  });

  it("returns paginated delivery logs and stats and supports retrying failed logs", async () => {
    prismaMock.emailLog.findMany.mockResolvedValue([
      {
        id: "log-f1",
        recipient: "qa@inbox.testmail.app",
        subject: "Test",
        status: "FAILED",
        attemptCount: 3,
        maxAttempts: 3,
        errorMessage: "SMTP timeout",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    prismaMock.emailLog.count.mockResolvedValue(1);
    prismaMock.emailLog.groupBy.mockResolvedValue([
      { status: "FAILED", _count: { _all: 1 } },
    ]);

    const logs = await request(app, "GET", "/api/admin/emails/logs?status=FAILED", fullAdminToken);
    expect(logs.status).toBe(200);
    expect(logs.body.data).toHaveLength(1);
    expect(logs.body.stats.failed).toBe(1);

    prismaMock.emailLog.findUnique.mockResolvedValue({
      id: "log-f1",
      status: "FAILED",
      htmlBody: "<p>Retry me</p>",
    });
    prismaMock.emailLog.update.mockResolvedValue({
      id: "log-f1",
      status: "QUEUED",
      attemptCount: 0,
    });

    const retried = await request(
      app,
      "POST",
      "/api/admin/emails/logs/log-f1/retry",
      fullAdminToken,
    );
    expect(retried.status).toBe(200);
    expect(retried.body.log.status).toBe("QUEUED");
  });
});
