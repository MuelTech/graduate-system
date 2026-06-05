"use client";

import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Sparkles } from "lucide-react";

interface Message {
  id: string;
  role: "user" | "bot";
  content: string;
  timestamp: Date;
}

const botResponses: Record<string, string> = {
  programs:
    "We offer 15+ graduate programs including Masters and Doctoral degrees in Education, Public Administration, Computer Science, Nursing, Industrial Engineering, and Mathematics. Visit our /programs page for the full list.",
  apply:
    "To apply to EARIST Graduate School: 1) Register in Pinnacle to get your Applicant ID, 2) Visit /register to complete your GS System registration, 3) Take the entrance examination, 4) Upload your Certificate of Registration after enrollment in Pinnacle.",
  exam:
    "The entrance examination is scheduled through your Applicant Portal after registration. You must pass the Program Alignment Check first. The exam includes MCQ and Essay sections. Results are sent to your email.",
  thesis:
    "The thesis pipeline has three stages: Title Defense → Proposal Defense → Final Defense. Each stage has specific requirements that must be completed before advancing. Visit /faq for detailed information.",
  cor:
    "After passing the entrance exam, complete your enrollment in Pinnacle, download your COR, and upload it through your Applicant Portal. The Admin will verify it and promote you to Student role.",
  schedule:
    "You can schedule your entrance examination through the Exam Scheduling page in your Applicant Portal. Available slots are shown in real-time. Note: Exam scheduling is blocked if your alignment status is 'pending waiver'.",
  alignment:
    "The Program Alignment Check verifies if your undergraduate program matches your intended graduate program. If aligned, you proceed directly. If misaligned, you may need a Bridging Waiver from the GS Office.",
  repository:
    "The Research Repository contains published thesis and dissertation research from graduate school students and alumni. You can browse it at /repository without logging in.",
  contact:
    "You can reach the Graduate School Office at: Email: gs@earist.edu.ph | Phone: (02) 8534-8267 | Address: EARIST Main Campus, Manila, Philippines",
  login:
    "You can sign in to your portal at /login. Use your registered email and password. If you forgot your password, click 'Forgot your password?' on the login page.",
  register:
    "To register, visit /register. You'll need your Pinnacle Applicant ID first. Then complete the 4-step registration: Pinnacle ID, Personal Info, Program Selection, and Account Setup.",
  faq:
    "Visit our FAQ page at /faq for answers to common questions about admissions, enrollment, thesis defense, and system access.",
};

function getBotResponse(input: string): string {
  const lower = input.toLowerCase();

  if (lower.includes("program") || lower.includes("course") || lower.includes("degree"))
    return botResponses.programs;
  if (lower.includes("apply") || lower.includes("application") || lower.includes("admission"))
    return botResponses.apply;
  if (lower.includes("exam") || lower.includes("entrance") || lower.includes("ecat"))
    return botResponses.exam;
  if (lower.includes("thesis") || lower.includes("defense") || lower.includes("proposal") || lower.includes("final defense"))
    return botResponses.thesis;
  if (lower.includes("cor") || lower.includes("certificate of registration") || lower.includes("enrollment"))
    return botResponses.cor;
  if (lower.includes("schedule") || lower.includes("slot") || lower.includes("calendar"))
    return botResponses.schedule;
  if (lower.includes("align") || lower.includes("waiver") || lower.includes("bridging"))
    return botResponses.alignment;
  if (lower.includes("repository") || lower.includes("research") || lower.includes("published"))
    return botResponses.repository;
  if (lower.includes("contact") || lower.includes("email") || lower.includes("phone") || lower.includes("address"))
    return botResponses.contact;
  if (lower.includes("login") || lower.includes("sign in") || lower.includes("password"))
    return botResponses.login;
  if (lower.includes("register") || lower.includes("sign up"))
    return botResponses.register;
  if (lower.includes("faq") || lower.includes("help") || lower.includes("question"))
    return botResponses.faq;
  if (lower.includes("hello") || lower.includes("hi") || lower.includes("hey"))
    return "Hello! Welcome to the EARIST Graduate School Information System. How can I help you today? You can ask me about programs, admissions, exams, thesis defense, and more.";

  return "I'm here to help with questions about the EARIST Graduate School system. You can ask me about:\n\n• Graduate programs\n• Application process\n• Entrance examinations\n• Thesis pipeline\n• COR upload\n• Research repository\n\nOr visit /faq for our full FAQ page.";
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

export function ChatbotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: generateId(),
      role: "bot",
      content:
        "Hello! I'm the EARIST GS Assistant. How can I help you today? You can ask me about programs, admissions, exams, thesis defense, and more.",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  const handleSend = () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: generateId(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsTyping(true);

    setTimeout(() => {
      const botMessage: Message = {
        id: generateId(),
        role: "bot",
        content: getBotResponse(userMessage.content),
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botMessage]);
      setIsTyping(false);
    }, 800);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const quickQuestions = [
    "How to apply?",
    "Graduate programs",
    "Exam schedule",
    "Thesis defense",
  ];

  return (
    <>
      {/* Floating Trigger Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--earist-primary)] text-white shadow-lg transition-all hover:scale-105 hover:bg-[var(--earist-primary)]/90 hover:shadow-xl"
          aria-label="Open chatbot"
        >
          <div className="relative">
            <MessageCircle className="h-6 w-6" />
            <Sparkles className="absolute -right-1 -top-1 h-3 w-3 text-[var(--earist-accent)]" />
          </div>
        </button>
      )}

      {/* Chat Panel */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 flex h-[480px] w-[320px] flex-col rounded-lg border border-[var(--earist-border-gray)] bg-white shadow-2xl sm:w-[360px]">
          {/* Header */}
          <div className="flex items-center justify-between rounded-t-lg bg-[var(--earist-primary)] px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
                <Sparkles className="h-4 w-4 text-[var(--earist-accent)]" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">
                  GS Assistant
                </h3>
                <p className="text-xs text-white/70">
                  Ask me anything about EARIST GS
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="rounded-full p-1 text-white/70 transition-colors hover:bg-white/20 hover:text-white"
              aria-label="Close chatbot"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                      message.role === "user"
                        ? "bg-[var(--earist-primary)] text-white"
                        : "bg-[var(--earist-surface-gray)] text-[var(--earist-body-text)]"
                    }`}
                  >
                    <p className="whitespace-pre-line">{message.content}</p>
                    <p
                      className={`mt-1 text-xs ${
                        message.role === "user"
                          ? "text-white/50"
                          : "text-[var(--earist-body-text)]/50"
                      }`}
                    >
                      {message.timestamp.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              ))}

              {/* Typing Indicator */}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="rounded-lg bg-[var(--earist-surface-gray)] px-3 py-2">
                    <div className="flex gap-1">
                      <div className="h-2 w-2 animate-bounce rounded-full bg-[var(--earist-body-text)]/40 [animation-delay:-0.3s]" />
                      <div className="h-2 w-2 animate-bounce rounded-full bg-[var(--earist-body-text)]/40 [animation-delay:-0.15s]" />
                      <div className="h-2 w-2 animate-bounce rounded-full bg-[var(--earist-body-text)]/40" />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Quick Questions */}
          {messages.length <= 1 && (
            <div className="border-t border-[var(--earist-border-gray)] px-4 py-2">
              <p className="mb-2 text-xs text-[var(--earist-body-text)]">
                Quick questions:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {quickQuestions.map((question) => (
                  <button
                    key={question}
                    onClick={() => {
                      setInput(question);
                      setTimeout(() => {
                        const userMessage: Message = {
                          id: generateId(),
                          role: "user",
                          content: question,
                          timestamp: new Date(),
                        };
                        setMessages((prev) => [...prev, userMessage]);
                        setIsTyping(true);
                        setTimeout(() => {
                          const botMessage: Message = {
                            id: generateId(),
                            role: "bot",
                            content: getBotResponse(question),
                            timestamp: new Date(),
                          };
                          setMessages((prev) => [...prev, botMessage]);
                          setIsTyping(false);
                          setInput("");
                        }, 800);
                      }, 100);
                    }}
                    className="rounded-full border border-[var(--earist-border-gray)] px-2.5 py-1 text-xs text-[var(--earist-body-text)] transition-colors hover:border-[var(--earist-accent)] hover:text-[var(--earist-primary)]"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="border-t border-[var(--earist-border-gray)] p-3">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your question..."
                className="flex-1 rounded-lg border border-[var(--earist-border-gray)] px-3 py-2 text-sm transition-colors focus:border-[var(--earist-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--earist-primary)]"
                disabled={isTyping}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isTyping}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--earist-primary)] text-white transition-colors hover:bg-[var(--earist-primary)]/90 disabled:opacity-50 disabled:cursor-not-allowed"
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
