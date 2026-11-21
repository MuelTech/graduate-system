import { Router, Response, NextFunction } from "express";
import {
  optionalAuthenticateJWT,
  type AuthenticatedRequest,
} from "../middlewares/auth.middleware";
import {
  buildGroundedResponseFallback,
  retrieveKnowledgeChunks,
} from "../services/chatbot-rag.service";
import { buildLivePortalContext } from "../services/chatbot-context.service";
import {
  generateDeepSeekReply,
  getDeepSeekConfig,
  type ChatHistoryTurn,
} from "../services/deepseek-chat.service";

const router = Router();

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 20;
const MAX_RATE_LIMIT_KEYS = 5_000;

const requestTimestamps = new Map<string, number[]>();

export function resetChatRateLimiter(): void {
  requestTimestamps.clear();
}

function getClientRateKey(req: AuthenticatedRequest): string {
  if (req.user?.userId) {
    return `user:${req.user.userId}`;
  }
  const forwarded = req.headers["x-forwarded-for"];
  const rawIp =
    typeof forwarded === "string"
      ? forwarded.split(",")[0]?.trim()
      : Array.isArray(forwarded)
        ? forwarded[0]?.trim()
        : req.ip || req.socket?.remoteAddress || "unknown";
  return `ip:${rawIp || "unknown"}`;
}

function chatRateLimiter(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const key = getClientRateKey(req);

  if (requestTimestamps.size > MAX_RATE_LIMIT_KEYS) {
    for (const [k, stamps] of requestTimestamps.entries()) {
      const fresh = stamps.filter((ts) => ts > windowStart);
      if (fresh.length === 0) {
        requestTimestamps.delete(k);
      } else {
        requestTimestamps.set(k, fresh);
      }
    }
  }

  const existing = requestTimestamps.get(key) ?? [];
  const recent = existing.filter((ts) => ts > windowStart);

  if (recent.length >= RATE_LIMIT_MAX_REQUESTS) {
    res.status(429).json({
      error:
        "You have sent too many messages in a short time. Please wait a moment and try again.",
    });
    return;
  }

  recent.push(now);
  requestTimestamps.set(key, recent);
  next();
}

interface ChatRequestBody {
  message?: unknown;
  pathname?: unknown;
  history?: unknown;
}

router.post(
  "/",
  optionalAuthenticateJWT,
  chatRateLimiter,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const body = (req.body ?? {}) as ChatRequestBody;
      const rawMessage =
        typeof body.message === "string" ? body.message.trim() : "";

      if (!rawMessage) {
        res.status(400).json({ error: "Message is required." });
        return;
      }

      const message = rawMessage.slice(0, 1000);
      const pathname =
        typeof body.pathname === "string"
          ? body.pathname.trim().slice(0, 200)
          : "/";
      const history: ChatHistoryTurn[] = Array.isArray(body.history)
        ? body.history
            .filter(
              (item): item is ChatHistoryTurn =>
                Boolean(item) &&
                typeof item === "object" &&
                ((item as ChatHistoryTurn).role === "user" ||
                  (item as ChatHistoryTurn).role === "bot") &&
                typeof (item as ChatHistoryTurn).content === "string",
            )
            .slice(-6)
        : [];

      // Derive verified role + live portal state strictly server-side from req.user
      const { role: activeRole, userContext } = await buildLivePortalContext(
        req.user,
        pathname,
      );

      const recentUserMessages = history
        .filter((turn) => turn.role === "user")
        .map((turn) => turn.content);

      // Retrieve top-4 knowledge chunks for the current query (hard-filtered by activeRole)
      let retrieval = retrieveKnowledgeChunks(
        message,
        activeRole,
        4,
        userContext,
        recentUserMessages,
      );

      // Enrich brief conversational follow-ups (e.g., "How about Doctoral?", "not 16?") with the last user turn
      const wordCount = message.split(/\s+/).filter(Boolean).length;
      const isShortFollowUp =
        wordCount <= 6 &&
        /\b(how about|what about|eh yung|eh sa|paano naman|how long|magkano|ilan|doctoral|masters|not\s+\d+|\d+\??|total)\b/i.test(
          message,
        );
      if (
        !retrieval.isGreeting &&
        !retrieval.isConversational &&
        !retrieval.isIdentityQuery &&
        !retrieval.isRoleRestricted &&
        retrieval.isOutOfScope &&
        isShortFollowUp
      ) {
        const lastUserTurn = [...history]
          .reverse()
          .find((turn) => turn.role === "user");
        if (lastUserTurn) {
          const combinedRetrieval = retrieveKnowledgeChunks(
            `${lastUserTurn.content} ${message}`,
            activeRole,
            4,
            userContext,
            recentUserMessages,
          );
          if (
            !combinedRetrieval.isOutOfScope &&
            !combinedRetrieval.isRoleRestricted
          ) {
            retrieval = {
              ...combinedRetrieval,
              query: message,
              language: retrieval.language,
            };
          }
        }
      }

      const { apiKey } = getDeepSeekConfig();

      // Identity guardrail, RBAC role-restricted portal queries, explicit off-topic queries,
      // or missing API key short-circuit BEFORE calling DeepSeek.
      // Greetings, conversational messages (thanks/ok/wait), pre-question openers, and allowed factual queries
      // are sent to DeepSeek with top-4 role-filtered chunks, recent history, and server-derived live state.
      if (
        !apiKey ||
        retrieval.isIdentityQuery ||
        retrieval.isRoleRestricted ||
        retrieval.isExplicitOutOfScope
      ) {
        const fallback = buildGroundedResponseFallback(
          retrieval,
          activeRole,
          userContext,
        );
        res.json({
          reply: fallback.reply,
          language: retrieval.language,
          mode: "local-rag",
          isOutOfScope:
            retrieval.isOutOfScope &&
            !retrieval.isConversational &&
            !retrieval.isGreeting,
        });
        return;
      }

      try {
        const deepSeekReply = await generateDeepSeekReply({
          message,
          history,
          retrieval,
          activeRole,
          userContext,
        });

        if (deepSeekReply) {
          res.json({
            reply: deepSeekReply,
            language: retrieval.language,
            mode: "deepseek-rag",
            isOutOfScope: false,
          });
          return;
        }
      } catch (err) {
        console.warn(
          "DeepSeek API call failed, serving deterministic local-RAG fallback:",
          err instanceof Error ? err.message : err,
        );
      }

      // Deterministic Local RAG Fallback when DeepSeek returns empty, times out, or errors out
      const fallback = buildGroundedResponseFallback(
        retrieval,
        activeRole,
        userContext,
      );
      res.json({
        reply: fallback.reply,
        language: retrieval.language,
        mode: "local-rag",
        isOutOfScope:
          retrieval.isOutOfScope &&
          !retrieval.isConversational &&
          !retrieval.isGreeting,
      });
    } catch (error) {
      console.error("Chat API error:", error);
      res.status(200).json({
        reply:
          "Sorry, I encountered a temporary issue processing your request. Please try again or visit the Frequently Asked Questions page.",
        language: "en",
        mode: "local-rag",
        isOutOfScope: false,
      });
    }
  },
);

export default router;
