import express from "express";
import { createServer, type Server } from "http";
import { once } from "events";
import type { AddressInfo } from "net";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { EXAM_PNG, EXAM_JPEG } from "../../fixtures/exam-images";
import { AppError } from "../../../src/utils/AppError";

const content = vi.hoisted(() => vi.fn());
vi.mock("../../../src/config/database", () => ({ default: {} }));
vi.mock("../../../src/services/exam-media.service", () => ({ ExamMediaService: class { getContent = content; } }));
vi.mock("../../../src/utils/jwt", () => ({
  JwtConfigurationError: class extends Error {},
  verifyAccessToken: (token: string) => {
    if (["ADMIN", "APPLICANT", "STUDENT", "PANELIST"].includes(token)) return { userId: "user1", role: token };
    throw new Error("Invalid token");
  },
}));
import router from "../../../src/routes/exam-engine.routes";

let server: Server;
let url: string;
beforeAll(async () => {
  const app = express();
  app.use("/api/exam-engine", router);
  server = createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/exam-engine/media/c523f44d-c5ae-4b82-91bf-ccaf165ad567`;
});
afterAll(async () => {
  const closed = once(server, "close");
  server.close();
  server.closeAllConnections();
  await closed;
});
beforeEach(() => {
  content.mockReset();
  content.mockResolvedValue({ bytes: EXAM_PNG, mimeType: "image/png" });
});
function get(role?: string) { return fetch(url, { headers: role ? { Authorization: `Bearer ${role}` } : {} }); }

describe("authenticated private image HTTP contract", () => {
  it.each(["ADMIN", "APPLICANT"])("returns validated image bytes for authenticated %s with confidential headers", async role => {
    const response = await get(role);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("content-length")).toBe(String(EXAM_PNG.length));
    expect(response.headers.get("content-disposition")).toBe('inline; filename="exam-image.png"');
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("cross-origin-resource-policy")).toBe("same-origin");
    expect(Buffer.from(await response.arrayBuffer())).toEqual(EXAM_PNG);
    expect(content).toHaveBeenCalledWith("c523f44d-c5ae-4b82-91bf-ccaf165ad567", { userId: "user1", role });
  });

  it("uses the detected JPEG content type and generic filename", async () => {
    content.mockResolvedValue({ bytes: EXAM_JPEG, mimeType: "image/jpeg" });
    const response = await get("ADMIN");
    expect(response.headers.get("content-type")).toBe("image/jpeg");
    expect(response.headers.get("content-disposition")).toBe('inline; filename="exam-image.jpg"');
    expect(Buffer.from(await response.arrayBuffer())).toEqual(EXAM_JPEG);
  });

  it.each([[undefined, 401], ["invalid", 403], ["STUDENT", 403], ["PANELIST", 403]] as const)("rejects missing/invalid/disallowed credentials: %s", async (role, status) => {
    const response = await get(role);
    expect(response.status).toBe(status);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(content).not.toHaveBeenCalled();
  });

  it.each(["Media missing", "Outside scheduled context", "Unattached media"])("conceals private existence and details: %s", async reason => {
    content.mockRejectedValue(new AppError(`${reason}: private/key/source.png`, 404));
    const response = await get("APPLICANT");
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Exam media not found." });
  });

  it("never leaks unexpected storage/database errors", async () => {
    content.mockRejectedValue(new Error("storageKey provider C:/private/source.png isCorrect"));
    const response = await get("ADMIN");
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Could not retrieve exam media." });
  });
});
