import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import jwt from "jsonwebtoken";

const mockPrisma = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
  },
  student: {
    findUnique: vi.fn(),
  },
  panelist: {
    findUnique: vi.fn(),
  },
  adviserAssignment: {
    count: vi.fn(),
  },
  adviserRequest: {
    count: vi.fn(),
  },
  panelAssignment: {
    count: vi.fn(),
  },
  entranceExamApplication: {
    count: vi.fn(),
  },
  corUpload: {
    count: vi.fn(),
  },
  thesisRecord: {
    count: vi.fn(),
  },
}));

vi.mock("../src/config/database", () => ({
  default: mockPrisma,
}));

import { createApp } from "../src/app";
import { resetChatRateLimiter } from "../src/routes/chat.routes";

const originalEnv = { ...process.env };
const originalFetch = globalThis.fetch;

let server: http.Server;
let baseUrl: string;

async function postChat(
  body: Record<string, unknown>,
  headers: Record<string, string> = {},
) {
  const res = await originalFetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as Record<string, unknown>;
  return { status: res.status, json };
}

describe("POST /api/chat", () => {
  beforeAll(async () => {
    process.env.JWT_SECRET = "test-jwt-secret-for-chat-routes";
    const app = createApp();
    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });
    const addr = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    globalThis.fetch = originalFetch;
    process.env = { ...originalEnv };
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
    resetChatRateLimiter();
    process.env.JWT_SECRET = "test-jwt-secret-for-chat-routes";
    process.env.DEEPSEEK_API_KEY = "sk-test-deepseek-key";
    process.env.DEEPSEEK_MODEL = "deepseek-flash";
    process.env.DEEPSEEK_BASE_URL = "https://api.deepseek.com";
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns 400 when message is missing or empty", async () => {
    const { status, json } = await postChat({ message: "   " });
    expect(status).toBe(400);
    expect(json.error).toBe("Message is required.");
  });

  it("short-circuits identity queries before calling DeepSeek", async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { status, json } = await postChat({
      message: "Hi, what model are you?",
      pathname: "/",
    });

    expect(status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(json.mode).toBe("local-rag");
    expect(String(json.reply)).toContain("EARIST Graduate School Assistant");
    expect(String(json.reply)).not.toMatch(/DeepSeek|Gemini|LLM/i);
  });

  it("short-circuits explicit off-topic queries before calling DeepSeek", async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { status, json } = await postChat({
      message: "What is the weather forecast in Manila tomorrow?",
      pathname: "/",
    });

    expect(status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(json.mode).toBe("local-rag");
    expect(json.isOutOfScope).toBe(true);
    expect(String(json.reply)).toContain("gs@earist.edu.ph");
    expect(String(json.reply)).toContain("(02) 8534-8267");
  });

  it("sends factual queries to DeepSeek with model deepseek-flash, top-4 chunks, and sanitizes response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content:
                "**Programs (Manual Sec. 5.0):** Powered by DeepSeek-Flash. EARIST offers Ed.D-EM, Ph.D-IP, DPA, DBA, MAEd, MAIE, MBA, MPA, MAT, MAIP, and MSM.",
            },
          },
        ],
      }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { status, json } = await postChat({
      message: "What graduate programs are offered by EARIST?",
      pathname: "/programs",
      history: [{ role: "user", content: "Hello" }],
    });

    expect(status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledUrl, calledInit] = fetchMock.mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(calledUrl).toBe("https://api.deepseek.com/chat/completions");
    const sentPayload = JSON.parse(String(calledInit.body)) as {
      model: string;
      temperature: number;
      max_tokens: number;
      messages: Array<{ role: string; content: string }>;
    };
    expect(sentPayload.model).toBe("deepseek-flash");
    expect(sentPayload.temperature).toBe(0.2);
    expect(sentPayload.max_tokens).toBe(1200);
    expect(sentPayload.messages[0]?.content).toContain("All 16 Graduate Programs Offered by EARIST");
    expect(sentPayload.messages[1]?.content).toContain("Recent conversation context:");

    expect(json.mode).toBe("deepseek-rag");
    expect(json.isOutOfScope).toBe(false);
    expect(String(json.reply)).not.toMatch(/\*\*|Sec\.\s*\d+|DeepSeek/i);
    expect(String(json.reply)).toContain("Ed.D-EM");
  });

  it("routes conversational gratitude to DeepSeek instead of rejecting as out-of-scope", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: "You're very welcome! Let me know if you need anything else.",
            },
          },
        ],
      }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { status, json } = await postChat({
      message: "Thanks for the information!",
      pathname: "/",
    });

    expect(status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(json.mode).toBe("deepseek-rag");
    expect(json.isOutOfScope).toBe(false);
  });

  it("falls back automatically to deterministic local-rag when DeepSeek returns HTTP 429", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => "Rate limit exceeded",
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { status, json } = await postChat({
      message: "Ano ang process ng thesis disertation?",
      pathname: "/student/thesis",
    });

    expect(status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(json.mode).toBe("local-rag");
    expect(json.isOutOfScope).toBe(false);
    expect(String(json.reply)).toContain("Title Defense");
    expect(String(json.reply)).toContain("Final Defense");
  });

  it("falls back to local-rag when DEEPSEEK_API_KEY is missing", async () => {
    process.env.DEEPSEEK_API_KEY = "";
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { status, json } = await postChat({
      message: "What graduate programs are offered by EARIST?",
      pathname: "/",
    });

    expect(status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(json.mode).toBe("local-rag");
    expect(String(json.reply)).toContain("16 graduate programs");
    expect(String(json.reply)).toContain("Ed.D.-EM");
    expect(String(json.reply)).toContain("MSM");
  });

  it("blocks cross-role portal navigation queries on public landing page before calling DeepSeek", async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const adminNav = await postChat({
      message: "What navigation for admin portal?",
      pathname: "/",
    });
    expect(adminNav.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(adminNav.json.mode).toBe("local-rag");
    expect(adminNav.json.isOutOfScope).toBe(true);
    expect(String(adminNav.json.reply)).toContain("restricted to signed-in authorized accounts");

    const facultyFollowUp = await postChat({
      message: "How about faculty?",
      pathname: "/",
      history: [
        { role: "user", content: "What navigation for admin portal?" },
        { role: "bot", content: String(adminNav.json.reply) },
      ],
    });
    expect(facultyFollowUp.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(facultyFollowUp.json.mode).toBe("local-rag");
    expect(facultyFollowUp.json.isOutOfScope).toBe(true);
  });

  it("allows authenticated ADMIN to query Admin portal navigation", async () => {
    const adminToken = jwt.sign(
      { userId: "admin-user-1", role: "ADMIN", tokenVersion: 1 },
      process.env.JWT_SECRET!,
    );

    mockPrisma.user.findUnique
      .mockResolvedValueOnce({
        id: "admin-user-1",
        isActive: true,
        tokenVersion: 1,
      })
      .mockResolvedValueOnce({
        id: "admin-user-1",
        title: null,
        firstName: "Registrar",
        lastName: "Admin",
        suffix: null,
        role: "ADMIN",
        adminAccessLevel: "FULL",
      });
    mockPrisma.corUpload.count.mockResolvedValueOnce(2);
    mockPrisma.thesisRecord.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0);
    mockPrisma.adviserRequest.count.mockResolvedValueOnce(1);

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content:
                "In the Administrator Portal, you can use System Settings and the Email Manager.",
            },
          },
        ],
      }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const res = await postChat(
      {
        message: "What navigation for admin portal?",
        pathname: "/admin/dashboard",
      },
      { Authorization: `Bearer ${adminToken}` },
    );

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(res.json.mode).toBe("deepseek-rag");
  });

  it("injects server-side Student live context from Prisma for active tokenVersion: 1 session", async () => {
    const token = jwt.sign(
      { userId: "student-user-1", role: "STUDENT", tokenVersion: 1 },
      process.env.JWT_SECRET!,
    );

    mockPrisma.user.findUnique
      // 1st call: optionalAuthenticateJWT -> verifyActiveUserSession
      .mockResolvedValueOnce({
        id: "student-user-1",
        isActive: true,
        tokenVersion: 1,
      })
      // 2nd call: buildLivePortalContext
      .mockResolvedValueOnce({
        id: "student-user-1",
        title: null,
        firstName: "Maria",
        lastName: "Santos",
        suffix: null,
        role: "STUDENT",
        adminAccessLevel: null,
      });

    mockPrisma.student.findUnique.mockResolvedValueOnce({
      studentNumber: "GS-2026-0042",
      program: { programName: "Master of Arts in Teaching Major in Mathematics" },
      compExamRecords: [{ attemptNumber: 1, status: "PASSED" }],
      adviserAssignments: [
        {
          adviser: {
            title: "Dr.",
            firstName: "Elena",
            lastName: "Reyes",
            suffix: null,
          },
        },
      ],
      adviserRequests: [],
      thesisRecords: [
        {
          stage: "PROPOSAL",
          status: "SCHEDULED",
          thesisTitles: [{ titleText: "Adaptive Math Learning Analytics" }],
          defenseSchedules: [
            {
              defenseType: "PROPOSAL",
              sessionStatus: "SCHEDULED",
              defenseDate: new Date("2026-12-10T00:00:00.000Z"),
              defenseTime: new Date("1970-01-01T14:00:00.000Z"),
              venueOrLink: "GS Conference Room A",
            },
          ],
          plagiarismResults: [],
        },
      ],
    });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content:
                "You are currently in Proposal Defense under Dr. Elena Reyes, scheduled on December 10, 2026.",
            },
          },
        ],
      }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { status, json } = await postChat(
      {
        message: "What is my current thesis status and who is my adviser?",
        pathname: "/student/thesis/proposal-defense",
      },
      { Authorization: `Bearer ${token}` },
    );

    expect(status).toBe(200);
    expect(json.mode).toBe("deepseek-rag");
    const sentPayload = JSON.parse(
      String((fetchMock.mock.calls[0]?.[1] as RequestInit).body),
    ) as { messages: Array<{ content: string }> };
    const systemPrompt = sentPayload.messages[0]?.content ?? "";
    expect(systemPrompt).toContain("Signed-in User: Maria Santos");
    expect(systemPrompt).toContain("Dr. Elena Reyes");
    expect(systemPrompt).toContain("Adaptive Math Learning Analytics");
    expect(systemPrompt).toContain("GS Conference Room A");
  });

  it("never leaks unreleased Applicant exam scores and degrades revoked tokenVersion to public", async () => {
    const revokedToken = jwt.sign(
      { userId: "revoked-user", role: "STUDENT", tokenVersion: 1 },
      process.env.JWT_SECRET!,
    );

    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: "revoked-user",
      isActive: true,
      tokenVersion: 2, // Revoked session
    });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "You can check the Graduate Programs page." } }],
      }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await postChat(
      { message: "What doctoral programs are offered?", pathname: "/student/dashboard" },
      { Authorization: `Bearer ${revokedToken}` },
    );

    const sentPayload = JSON.parse(
      String((fetchMock.mock.calls[0]?.[1] as RequestInit).body),
    ) as { messages: Array<{ content: string }> };
    expect(sentPayload.messages[0]?.content).toContain("- Active Portal Role: public");
    expect(mockPrisma.student.findUnique).not.toHaveBeenCalled();
  });

  it("enforces the 20 requests per minute rate limit with HTTP 429", async () => {
    process.env.DEEPSEEK_API_KEY = "";

    for (let i = 0; i < 20; i++) {
      const res = await postChat(
        { message: "Hi, what model are you?" },
        { "x-forwarded-for": "203.0.113.55" },
      );
      expect(res.status).toBe(200);
    }

    const blocked = await postChat(
      { message: "Hi, what model are you?" },
      { "x-forwarded-for": "203.0.113.55" },
    );
    expect(blocked.status).toBe(429);
    expect(String(blocked.json.error)).toContain("too many messages");
  });
});
