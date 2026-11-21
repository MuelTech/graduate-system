"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  MessageCircle,
  X,
  Send,
  Sparkles,
  RotateCcw,
} from "lucide-react";
import { getClientBackendBaseUrl } from "@/lib/backend-origin.client";

type PortalContextRole = "public" | "applicant" | "student" | "faculty" | "admin";

interface Message {
  id: string;
  role: "user" | "bot";
  content: string;
  timestamp: Date | null;
  isOutOfScope?: boolean;
}

interface ChatApiResponse {
  reply?: string;
  error?: string;
  isOutOfScope?: boolean;
}

const ROLE_LABELS: Record<PortalContextRole, string> = {
  public: "Public & Admissions Guide",
  applicant: "Applicant Portal Mode",
  student: "Graduate Student Mode",
  faculty: "Faculty / Panelist Mode",
  admin: "Administrator Mode",
};

const QUICK_QUESTIONS_BY_ROLE: Record<PortalContextRole, string[]> = {
  public: [
    "Paano mag-apply sa EARIST GS?",
    "Anong programs ang available?",
    "May online class ba?",
    "Contact details ng GS Office",
  ],
  applicant: [
    "Paano mag-schedule ng exam?",
    "Ilang items ang Entrance Exam?",
    "Paano mag-upload ng COR?",
    "Ano ang admission requirements?",
  ],
  student: [
    "Ilang units max per semester?",
    "Compre exam rules & passing rate",
    "Thesis defense steps & 7-day rule",
    "Anong kulay ng toga per program?",
  ],
  faculty: [
    "Paano gamitin ang Defense Workspace?",
    "Saan mag-grade ng Applicant essays?",
    "Ano ang 1:5 adviser ratio rule?",
    "Saan pipirma ng Rapporteur Report?",
  ],
  admin: [
    "Ano ang sakop ng Administrator?",
    "Paano gumagana ang Email Manager?",
    "Saan mina-manage ang curricula at officials?",
    "Ano ang current pending tasks ko?",
  ],
};

function generateId(): string {
  // Only called after client interaction — never for SSR initial markup.
  return Math.random().toString(36).substring(2, 9);
}

function getWelcomeMessage(portalRole: PortalContextRole): string {
  switch (portalRole) {
    case "applicant":
      return "Kumusta! Ako ang EARIST GS Assistant. Ask me in English, Tagalog, or Taglish about admissions, Entrance Exam scheduling, exam results, or COR upload.";
    case "student":
      return "Kumusta! Ako ang EARIST GS Assistant. Tanungin mo ako tungkol sa units load, Comprehensive Exam, Grading Scale, 5-Step Thesis Journey, STRIKE check, o graduation requirements.";
    case "faculty":
      return "Hello! I'm the EARIST GS Assistant. Ask me about the Defense Workspace, Entrance Exam essay grading, advisee caps (1:5), Rapporteur Reports, or Faculty policies.";
    case "admin":
      return "Hello! I'm the EARIST GS Assistant. Ask me about Graduate School policies, COR verification, defense scheduling, Email Manager, System Settings, or your current pending queues.";
    default:
      return "Hello! I'm the EARIST GS Assistant. You can ask me in English, Tagalog, or Taglish about graduate programs, admission requirements, thesis defense policies, or portal navigation.";
  }
}

export function ChatbotWidget() {
  const pathname = usePathname() || "/";
  const { data: session } = useSession();

  // Exam Integrity Guard: hide chatbot completely during the online Entrance Examination
  const isExamExecutionRoute = pathname.startsWith("/applicant/exam");

  const portalRole: PortalContextRole = useMemo(() => {
    if (pathname.startsWith("/applicant")) return "applicant";
    if (pathname.startsWith("/student")) return "student";
    if (pathname.startsWith("/panelist") || pathname.startsWith("/faculty")) {
      return "faculty";
    }
    if (pathname.startsWith("/admin")) return "admin";
    return "public";
  }, [pathname]);

  const [isOpen, setIsOpen] = useState(false);
  const [welcomeTimestamp, setWelcomeTimestamp] = useState<Date | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const displayedMessages = useMemo<Message[]>(
    () => [
      {
        id: "welcome",
        role: "bot",
        content: getWelcomeMessage(portalRole),
        timestamp: welcomeTimestamp,
      },
      ...messages,
    ],
    [portalRole, welcomeTimestamp, messages],
  );

  const visibleOpen = isOpen && !isExamExecutionRoute;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [displayedMessages, isTyping]);

  useEffect(() => {
    if (visibleOpen) {
      inputRef.current?.focus();
    }
  }, [visibleOpen]);

  if (isExamExecutionRoute) {
    return null;
  }

  const openChat = () => {
    setIsOpen(true);
    setWelcomeTimestamp((prev) => prev ?? new Date());
  };

  const resetChat = () => {
    setMessages([]);
    setWelcomeTimestamp(new Date());
    setInput("");
  };

  const sendMessage = async (rawText: string) => {
    const trimmed = rawText.trim();
    if (!trimmed || isTyping) return;

    const userMessage: Message = {
      id: generateId(),
      role: "user",
      content: trimmed,
      timestamp: new Date(),
    };

    const historySnapshot = messages
      .slice(-6)
      .map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsTyping(true);

    try {
      const apiBase = getClientBackendBaseUrl();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      // Only attach the authenticated session token on authenticated portal routes;
      // public pages strictly operate under unauthenticated public RBAC scope.
      if (portalRole !== "public" && session?.user?.accessToken) {
        headers.Authorization = `Bearer ${session.user.accessToken}`;
      }

      const response = await fetch(`${apiBase}/api/chat`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          message: trimmed,
          pathname,
          history: historySnapshot,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as ChatApiResponse;

      if (!response.ok) {
        const errorReply =
          data.error ||
          "Sorry, I couldn't process your request right now. Please try again in a moment.";
        setMessages((prev) => [
          ...prev,
          {
            id: generateId(),
            role: "bot",
            content: errorReply,
            timestamp: new Date(),
            isOutOfScope: false,
          },
        ]);
        return;
      }

      const botMessage: Message = {
        id: generateId(),
        role: "bot",
        content:
          data.reply ||
          "Sorry, I didn't receive a response. Please try asking again.",
        timestamp: new Date(),
        isOutOfScope: data.isOutOfScope ?? false,
      };
      setMessages((prev) => [...prev, botMessage]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: generateId(),
          role: "bot",
          content:
            "I'm temporarily unable to reach the Graduate School Assistant service. Please try again shortly or contact the Graduate School Office at gs@earist.edu.ph or (02) 8534-8267.",
          timestamp: new Date(),
          isOutOfScope: false,
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSend = () => {
    void sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const quickQuestions = QUICK_QUESTIONS_BY_ROLE[portalRole];

  return (
    <>
      {/* Floating Trigger Button */}
      {!visibleOpen && (
        <button
          onClick={openChat}
          className="fixed right-6 bottom-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-(--earist-primary) text-white shadow-lg transition-all hover:scale-105 hover:bg-(--earist-primary)/90 hover:shadow-xl"
          aria-label="Open chatbot"
        >
          <div className="relative">
            <MessageCircle className="h-6 w-6" />
            <Sparkles className="absolute -top-1 -right-1 h-3 w-3 text-(--earist-accent)" />
          </div>
        </button>
      )}

      {/* Chat Panel */}
      {visibleOpen && (
        <div className="fixed right-4 bottom-4 z-50 flex h-[520px] w-[calc(100vw-2rem)] max-w-[390px] flex-col rounded-xl border border-(--earist-border-gray) bg-white shadow-2xl sm:right-6 sm:bottom-6">
          {/* Header */}
          <div className="flex items-center justify-between rounded-t-xl bg-(--earist-primary) px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
                <Sparkles className="h-4 w-4 text-(--earist-accent)" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">
                  GS Assistant
                </h3>
                <p className="text-[11px] text-white/80">
                  {ROLE_LABELS[portalRole]} • EN / TL
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  onClick={resetChat}
                  title="Reset conversation"
                  className="rounded-full p-1.5 text-white/75 transition-colors hover:bg-white/20 hover:text-white"
                  aria-label="Reset conversation"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-full p-1 text-white/75 transition-colors hover:bg-white/20 hover:text-white"
                aria-label="Close chatbot"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-4">
              {displayedMessages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[88%] rounded-xl px-3.5 py-2.5 text-sm ${
                      message.role === "user"
                        ? "bg-(--earist-primary) text-white"
                        : message.isOutOfScope
                          ? "border border-amber-200 bg-amber-50/70 text-(--earist-body-text)"
                          : "bg-(--earist-surface-gray) text-(--earist-body-text)"
                    }`}
                  >
                    <p className="leading-relaxed whitespace-pre-line">
                      {message.content}
                    </p>

                    <p
                      suppressHydrationWarning
                      className={`mt-1.5 text-[10px] ${
                        message.role === "user"
                          ? "text-white/60"
                          : "text-(--earist-body-text)/50"
                      }`}
                    >
                      {message.timestamp
                        ? message.timestamp.toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : ""}
                    </p>
                  </div>
                </div>
              ))}

              {/* Typing Indicator */}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="rounded-xl bg-(--earist-surface-gray) px-3.5 py-2.5">
                    <div className="flex gap-1">
                      <div className="h-2 w-2 animate-bounce rounded-full bg-(--earist-body-text)/40 [animation-delay:-0.3s]" />
                      <div className="h-2 w-2 animate-bounce rounded-full bg-(--earist-body-text)/40 [animation-delay:-0.15s]" />
                      <div className="h-2 w-2 animate-bounce rounded-full bg-(--earist-body-text)/40" />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Quick Questions */}
          {messages.length === 0 && (
            <div className="border-t border-(--earist-border-gray) px-4 py-2.5">
              <p className="mb-1.5 text-[11px] font-medium text-gray-500">
                Quick questions:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {quickQuestions.map((question) => (
                  <button
                    key={question}
                    onClick={() => void sendMessage(question)}
                    disabled={isTyping}
                    className="rounded-full border border-(--earist-border-gray) bg-white px-2.5 py-1 text-left text-xs text-(--earist-body-text) transition-colors hover:border-(--earist-accent) hover:text-(--earist-primary)"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="border-t border-(--earist-border-gray) p-3">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask in English, Tagalog, or Taglish..."
                className="flex-1 rounded-lg border border-(--earist-border-gray) px-3 py-2 text-sm transition-colors focus:border-(--earist-primary) focus:ring-1 focus:ring-(--earist-primary) focus:outline-none"
                disabled={isTyping}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isTyping}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-(--earist-primary) text-white transition-colors hover:bg-(--earist-primary)/90 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Send message"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
