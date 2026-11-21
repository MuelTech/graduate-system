import { describe, expect, it } from "vitest";
import {
  buildGroundedResponseFallback,
  CANONICAL_GS_EMAIL,
  CANONICAL_GS_PHONE,
  cleanAssistantReply,
  detectQueryLanguage,
  getKnowledgeBaseStats,
  retrieveKnowledgeChunks,
} from "../src/services/chatbot-rag.service";

describe("chatbot-rag.service", () => {
  it("loads the reconciled 71-chunk EARIST Graduate School knowledge base", () => {
    const stats = getKnowledgeBaseStats();
    expect(stats.totalChunks).toBe(71);
    expect(stats.categories.length).toBeGreaterThanOrEqual(8);
  });

  it("retrieves programs-all-overview as top-1 for general graduate program queries", () => {
    const retrieval = retrieveKnowledgeChunks(
      "What graduate programs are offered by EARIST?",
      "public",
    );
    expect(retrieval.isOutOfScope).toBe(false);
    expect(retrieval.hits[0]?.chunk.id).toBe("programs-all-overview");

    const fallback = buildGroundedResponseFallback(retrieval, "public");
    expect(fallback.reply).toContain("Ed.D-EM");
    expect(fallback.reply).toContain("Ph.D-IP");
    expect(fallback.reply).toContain("DPA");
    expect(fallback.reply).toContain("DBA");
    expect(fallback.reply).toContain("MAEd");
    expect(fallback.reply).toContain("MAIE");
    expect(fallback.reply).toContain("MBA");
    expect(fallback.reply).toContain("MPA");
    expect(fallback.reply).toContain("MAT");
    expect(fallback.reply).toContain("MAIP");
    expect(fallback.reply).toContain("MSM");
  });

  it("detects English, Tagalog, and Taglish accurately", () => {
    expect(detectQueryLanguage("What doctoral programs are offered?")).toBe("en");
    expect(detectQueryLanguage("Sino ang kasalukuyang presidente ng EARIST?")).toBe(
      "tl",
    );
    expect(
      detectQueryLanguage("Ano ang process ng thesis disertation?"),
    ).toBe("taglish");
  });

  it("detects identity queries including DeepSeek, Gemini, ChatGPT, and Claude", () => {
    const probes = [
      "Hi, what model are you?",
      "Are you DeepSeek?",
      "DeepSeek ka ba?",
      "Are you powered by DeepSeek-V4?",
      "Are you ChatGPT?",
      "Are you Claude?",
    ];

    for (const query of probes) {
      const result = retrieveKnowledgeChunks(query, "public");
      expect(result.isIdentityQuery, `Failed for: ${query}`).toBe(true);
      expect(result.isOutOfScope).toBe(false);

      const fallback = buildGroundedResponseFallback(result, "public");
      expect(fallback.reply).toContain("EARIST Graduate School Assistant");
      expect(fallback.reply).not.toMatch(
        /DeepSeek|Gemini|ChatGPT|\bGPT\b|Claude|OpenAI|large language model/i,
      );
    }
  });

  it("handles gratitude, pauses, and pre-question openers with warm 1-sentence replies", () => {
    const samples = [
      "Thanks for the information!",
      "Salamat sa iyong impormasyon!",
      "Wait lang",
      "May tanong ako sa thesis disertation",
    ];

    for (const query of samples) {
      const result = retrieveKnowledgeChunks(query, "student", 4, {
        userName: "Juan Dela Cruz",
      });
      expect(result.isConversational, `Failed for: ${query}`).toBe(true);
      expect(result.isOutOfScope).toBe(false);

      const fallback = buildGroundedResponseFallback(result, "student", {
        userName: "Juan Dela Cruz",
      });
      expect(fallback.reply.length).toBeLessThanOrEqual(120);
      expect(fallback.reply).not.toContain("\n\n");
    }
  });

  it("sanitizes DeepSeek, vendor names, Markdown symbols, and handbook section citations", () => {
    const raw =
      "### Summary\n* **Policy (Manual Sec. 7.11):** According to Sec. 7.18 and CMO No. 15, s. 2019: I am DeepSeek-V3, DeepSeek-R1, DeepSeek-Flash, DeepSeek, Gemini 4 Hydrogen, ChatGPT, GPT-4, Claude by OpenAI, a large language model built by Google.\n---";
    const cleaned = cleanAssistantReply(raw);

    expect(cleaned).not.toMatch(
      /\*\*|###|---|`|Sec\.\s*\d+|CMO\s*No\.|DeepSeek|Gemini|ChatGPT|\bGPT\b|Claude|OpenAI|large language model/i,
    );
    expect(cleaned).toContain("EARIST Graduate School Assistant");
  });

  it("returns canonical GS Office contact details on out-of-scope fallback", () => {
    const result = retrieveKnowledgeChunks(
      "What is the weather forecast in Manila tomorrow?",
      "public",
    );
    expect(result.isExplicitOutOfScope).toBe(true);
    expect(result.isOutOfScope).toBe(true);

    const fallback = buildGroundedResponseFallback(result, "public");
    expect(fallback.reply).toContain(CANONICAL_GS_EMAIL);
    expect(fallback.reply).toContain(CANONICAL_GS_PHONE);
    expect(fallback.reply).not.toContain("earistofficial1945");
  });

  it("routes bridging queries to the Manual §7.3.4 bridging chunk without retired waiver blockers", () => {
    const result = retrieveKnowledgeChunks(
      "Paano pag hindi aligned yung bachelor's degree ko sa kukunin kong Master's?",
      "applicant",
    );
    expect(result.isOutOfScope).toBe(false);
    expect(result.hits[0]?.chunk.id).toBe("admission-bridging-profed-nonthesis");

    const fallback = buildGroundedResponseFallback(result, "applicant");
    expect(fallback.reply).toContain("9-unit Bridging Program");
    expect(fallback.reply).not.toContain("/applicant/alignment");
  });
});
