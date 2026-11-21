import {
  CANONICAL_GS_EMAIL,
  CANONICAL_GS_PHONE,
  cleanAssistantReply,
  type RetrievalResult,
  type UserLiveStateContext,
} from "./chatbot-rag.service";

export interface ChatHistoryTurn {
  role: "user" | "bot";
  content: string;
}

const DEFAULT_DEEPSEEK_BASE_URL = "https://api.deepseek.com";
const DEFAULT_DEEPSEEK_MODEL = "deepseek-flash";
const DEEPSEEK_TIMEOUT_MS = 15_000;
const DEEPSEEK_MAX_TOKENS = 1200;
const DEEPSEEK_TEMPERATURE = 0.2;

export function getDeepSeekConfig() {
  const apiKey = (process.env.DEEPSEEK_API_KEY ?? "").trim();
  const model = (process.env.DEEPSEEK_MODEL ?? "").trim() || DEFAULT_DEEPSEEK_MODEL;
  const baseUrl = (
    (process.env.DEEPSEEK_BASE_URL ?? "").trim() || DEFAULT_DEEPSEEK_BASE_URL
  ).replace(/\/+$/, "");

  return { apiKey, model, baseUrl };
}

function buildLivePortalStateBlock(
  activeRole: string,
  userContext?: UserLiveStateContext,
): string {
  const lines = [
    `- Active Portal Role: ${activeRole || "public"}`,
    `- Current Page: ${userContext?.pageTitle || "EARIST Graduate School Home"}`,
  ];

  if (userContext?.userName) {
    lines.push(`- Signed-in User: ${userContext.userName}`);
  }
  if (userContext?.program) {
    lines.push(`- Program: ${userContext.program}`);
  }
  if (userContext?.activeStatusSummary) {
    lines.push(`- Current Account Status: ${userContext.activeStatusSummary}`);
  }
  if (userContext?.liveDetailsSummary) {
    lines.push(`- Live Portal Records: ${userContext.liveDetailsSummary}`);
  }

  return lines.join("\n");
}

export function buildSystemInstruction(
  retrieval: RetrievalResult,
  activeRole: string,
  userContext?: UserLiveStateContext,
): string {
  const knowledgeContext =
    retrieval.hits.length > 0
      ? retrieval.hits
          .slice(0, 4)
          .map((hit, idx) => {
            const cleanEn = cleanAssistantReply(hit.chunk.answerEn);
            const cleanTl = cleanAssistantReply(hit.chunk.answerTl);
            return [
              `[Source ${idx + 1}: ${hit.chunk.title}]`,
              `English: ${cleanEn}`,
              `Tagalog/Taglish: ${cleanTl}`,
            ].join("\n");
          })
          .join("\n\n---\n\n")
      : "No specific EARIST Graduate School Manual of Operations section matched this message directly.";

  const languageRule =
    retrieval.language === "tl"
      ? "Respond naturally in polite, everyday Tagalog like a helpful university office staff member."
      : retrieval.language === "taglish"
        ? "Respond naturally in friendly, clear Taglish matching the user's conversational tone."
        : "Respond clearly, politely, and concisely in plain English like a helpful university staff member.";

  const livePortalState = buildLivePortalStateBlock(activeRole, userContext);

  return `You are the official EARIST Graduate School Assistant — a warm, helpful Graduate School Office staff guide for EARIST.

<LIVE_USER_PORTAL_STATE>
${livePortalState}
</LIVE_USER_PORTAL_STATE>

Language Instruction:
- ${languageRule}

Strict Response Format & Persona Rules:
1. PLAIN TEXT ONLY: Never use Markdown symbols (*, **, #, ###, ---, or backticks). For numbered steps, use simple plain lines like "1. Title Defense - ...".
2. CONCISE YET COMPLETE ("sakto lang"): Keep your answer focused, direct, and easy to scan (2 to 4 short sentences for simple questions, or a clean numbered list). Answer only what was asked without dumping unrelated background, BUT never omit or truncate items when the user asks for the list of graduate programs, admission/enrollment requirements, eligibility rules, or process steps — include all official items from <RETRIEVED_KNOWLEDGE_BASE>.
3. HUMAN-READABLE STAFF TONE: Never mention internal handbook codes or policy citations (no "Manual Sec. 7.10", "Sec. 7.18", "CMO No. 15", etc.), and refer to pages by plain name (e.g., "Proposal Defense page", "Student Dashboard") rather than raw URL paths like /student/thesis.
4. MODEL & IDENTITY GUARDRAIL: Never mention DeepSeek, DeepSeek-V3, DeepSeek-V4, DeepSeek-R1, DeepSeek-Flash, Gemini, Google, ChatGPT, GPT, Claude, OpenAI, Anthropic, or being a large language model. If asked who or what you are, state only that you are the EARIST Graduate School Assistant.
5. LIVE PORTAL STATE AWARENESS: Only include the user's <LIVE_USER_PORTAL_STATE> details when they explicitly ask about their own current status, step, title, adviser, pending tasks, or what to do on the current page. Do NOT add unsolicited summaries of their dashboard status or extra topic suggestions if they did not ask for them.
6. KNOWLEDGE BOUNDARY: For factual Graduate School inquiries, rely ONLY on <LIVE_USER_PORTAL_STATE> and <RETRIEVED_KNOWLEDGE_BASE> (and recent conversation context). Never invent fees, dates, or rules. If a substantive factual question is not answered in those sources, politely say it is outside your Graduate School information and refer them to ${CANONICAL_GS_EMAIL} or ${CANONICAL_GS_PHONE}.
7. CONVERSATIONAL & PRE-QUESTION MESSAGES: If the user sends a greeting, thank-you message (e.g., "Thanks for the information!", "Salamat sa iyong impormasyon!"), pause ("Wait lang"), closing, acknowledgment ("Ok", "Noted"), or pre-question opener ("May tanong ako sa thesis"), reply warmly and naturally in ONLY ONE short sentence without refusing them, without summarizing their dashboard, and without extra paragraphs.
8. STRICT ROLE-BASED ACCESS BOUNDARY: The current user's verified access role is "${activeRole || "public"}". NEVER reveal, describe, or speculate about internal portal navigation, sidebar menus, dashboards, pages, or tools belonging to other roles (for example: public visitors must never receive internal Administrator, Faculty, Student, or Applicant portal navigation; Applicants, Students, and Faculty must never receive internal Administrator or other-role portal workflows). If the user asks about another role's internal portal or tools, politely decline and state that portal guidance is limited to their current access level.

<RETRIEVED_KNOWLEDGE_BASE>
${knowledgeContext}
</RETRIEVED_KNOWLEDGE_BASE>`;
}

export function buildConversationInput(
  message: string,
  history: ChatHistoryTurn[],
): string {
  const recentHistory = history.slice(-4);
  if (recentHistory.length === 0) {
    return message;
  }

  const transcript = recentHistory
    .map(
      (turn) =>
        `${turn.role === "user" ? "User" : "Assistant"}: ${turn.content.slice(0, 400)}`,
    )
    .join("\n");

  return `Recent conversation context:\n${transcript}\n\nCurrent user question: ${message}`;
}

interface DeepSeekCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
}

export async function generateDeepSeekReply(params: {
  message: string;
  history: ChatHistoryTurn[];
  retrieval: RetrievalResult;
  activeRole: string;
  userContext?: UserLiveStateContext;
}): Promise<string | null> {
  const { apiKey, model, baseUrl } = getDeepSeekConfig();
  if (!apiKey) {
    return null;
  }

  const systemInstruction = buildSystemInstruction(
    params.retrieval,
    params.activeRole,
    params.userContext,
  );
  const userInput = buildConversationInput(params.message, params.history);

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: DEEPSEEK_TEMPERATURE,
      max_tokens: DEEPSEEK_MAX_TOKENS,
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: userInput },
      ],
    }),
    signal: AbortSignal.timeout(DEEPSEEK_TIMEOUT_MS),
  });

  if (!response.ok) {
    const errSnippet = await response.text().catch(() => "");
    throw new Error(
      `DeepSeek API responded with HTTP ${response.status}${errSnippet ? `: ${errSnippet.slice(0, 200)}` : ""}`,
    );
  }

  const data = (await response.json()) as DeepSeekCompletionResponse;
  const content = data?.choices?.[0]?.message?.content?.trim();
  if (!content) {
    return null;
  }

  return cleanAssistantReply(content);
}
