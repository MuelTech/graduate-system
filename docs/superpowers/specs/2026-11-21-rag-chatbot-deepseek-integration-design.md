# Multilingual RAG AI Chatbot (GS Assistant — DeepSeek Integration) Design Specification

**System:** EARIST Graduate School Information System (GS-IS)
**Branch:** `feat/rag-chatbot-deepseek` (off `main` at `31135a9f`)
**Status:** 🚧 APPROVED — IN IMPLEMENTATION (2026-11-21)
**Date:** 2026-11-21
**Related Checklist Sections:** Objective 6 (LLM-Driven RAG Chatbot), §8 / §14 (AI Chatbot Integration)

---

## 1. Purpose & Design Goals

Replace the static frontend keyword-matching widget (`frontend/src/components/chatbot/chatbot-widget.tsx`) with a **production-ready, multilingual (English / Tagalog / Taglish) RAG AI Assistant ("GS Assistant")** powered by the **DeepSeek API**, grounded on the 35-page **EARIST Graduate School Manual of Operations** and real production portal workflows:

1. **Backend-Owned Architecture (`POST /api/chat`):** Place the RAG engine, curated knowledge base, live user context resolver, rate limiter, and DeepSeek API client inside the Express backend (`backend/`). Keep `DEEPSEEK_API_KEY` strictly server-side with zero new npm dependencies (native `fetch`).
2. **Authoritative Server-Side Live Context:** Derive the signed-in user's role, profile, and live academic/portal status directly from Prisma via `optionalAuthenticateJWT` (with live `User.tokenVersion` + `isActive` validation). Never trust client-supplied identity or academic state.
3. **100% Production-Accurate Knowledge Base:** Port the proven 71-chunk hybrid RAG knowledge base from `graduate-system-evaluation`, reconciling every workflow chunk against the 35-page Manual of Operations PDF and current `main` (`PR #59`–`#67`)—retiring obsolete pre-exam waiver references and all Evaluation Edition text.
4. **All 5 Portal Roles + Exam Integrity:** Support tailored experiences for `public`, `applicant`, `student`, `faculty`, and `admin` across all 5 layouts, while strictly **hiding the chatbot on `/applicant/exam`** to protect entrance examination integrity.
5. **Graceful Degradation & Cost Protection:** Enforce per-IP/user rate limiting (`20 req/min`), a `15s` upstream timeout, and automatic deterministic local RAG fallback (`buildGroundedResponseFallback`) so the assistant never breaks if `DEEPSEEK_API_KEY` is missing, slow, or rate-limited.
6. **Zero Schema Migration:** Keep chat history ephemeral in client React state (with one-click reset). No new Prisma tables or database migrations are required for this milestone.

### Explicit Non-Goals
- No `@google/genai` or Gemini SDK installation.
- No database persistence of chat transcripts or admin chat-analytics dashboard in this phase (can be added later if needed).
- No per-reply navigation pill buttons inside chatbot bubbles (clean plain-text responses only).
- No modification to `Program` master data or dynamic DB-driven program chunk generation (curated JSON remains the authoritative source for program overview in this phase).

---

## 2. High-Level Architecture

```text
Browser (ChatbotWidget on Public, Applicant, Student, Panelist, Admin layouts; hidden on /applicant/exam)
   │  POST ${getClientBackendBaseUrl()}/api/chat
   │  Headers: Content-Type: application/json (+ Authorization: Bearer <JWT> when signed in)
   │  Body: { message, pathname, history }
   ▼
Express Backend (backend/src/routes/chat.routes.ts)
   ├─ 1. chatRateLimiter (20 req / 60s per userId or IP)
   ├─ 2. optionalAuthenticateJWT (verifies JWT + User.isActive + User.tokenVersion)
   ├─ 3. Input validation (message <= 1000 chars, history <= 6 turns, pathname <= 200 chars)
   ├─ 4. Hybrid RAG Retrieval (backend/src/services/chatbot-rag.service.ts)
   │     ├─ Language detector (en / tl / taglish)
   │     ├─ Greeting / Conversational / Identity / Explicit Out-of-Scope detectors
   │     ├─ Bilingual synonym expansion + TF-IDF Cosine + Lexical + Common-Inquiry scoring
   │     └─ Short follow-up enrichment using previous user turn when applicable
   ├─ 5. Server-Side Live Portal Context Builder (backend/src/services/chatbot-context.service.ts)
   │     └─ Bounded read-only Prisma queries scoped strictly to req.user.userId + req.user.role
   ├─ 6. Routing Decision:
   │     ├─ Short-circuit ONLY on `isIdentityQuery` OR `isExplicitOutOfScope` OR missing `DEEPSEEK_API_KEY`
   │     │   → return deterministic `buildGroundedResponseFallback(...)` (mode: "local-rag")
   │     └─ All other messages (greetings, thanks/small talk, pre-question openers, factual queries)
   │         → POST ${DEEPSEEK_BASE_URL}/chat/completions (model: DEEPSEEK_MODEL)
   │            with top-4 retrieved chunks + last 4 history turns + live portal state
   │         → sanitize via `cleanAssistantReply(...)` (mode: "deepseek-rag")
   │         → on timeout / non-2xx / empty reply → fall back to `buildGroundedResponseFallback(...)`
   ▼
JSON Response: { reply, language, mode, isOutOfScope }
```

---

## 3. DeepSeek API Configuration & Environment Variables

### 3.1 Request Contract
- **Endpoint:** `${DEEPSEEK_BASE_URL}/chat/completions` (default: `https://api.deepseek.com/chat/completions`)
- **HTTP Client:** Native Node.js `fetch` with `AbortSignal.timeout(15_000)` (`15s` hard timeout)
- **Payload:**
  ```json
  {
    "model": "deepseek-flash",
    "temperature": 0.2,
    "max_tokens": 1200,
    "messages": [
      { "role": "system", "content": "<systemInstruction>" },
      { "role": "user", "content": "<recentHistory + currentMessage>" }
    ]
  }
  ```
- **Model Note:** Defaults to `deepseek-flash` (DeepSeek V4.1 Flash) and is overridable via `DEEPSEEK_MODEL` so switching models never requires a code change. `max_tokens: 1200` (within the 1000–1500 headroom band) guarantees complete lists (e.g., all 4 Doctoral + 7 Master's programs with majors, full admission/enrollment requirements) are never truncated mid-sentence.

### 3.2 Environment Variables (`backend/.env.example`)
Document the following in `backend/.env.example` (never commit real secrets to `.env`):
```dotenv
# AI Chatbot Configuration (DeepSeek OpenAI-compatible API)
# Leave DEEPSEEK_API_KEY empty to run in deterministic local-RAG fallback mode.
DEEPSEEK_API_KEY=""
DEEPSEEK_MODEL="deepseek-flash"
DEEPSEEK_BASE_URL="https://api.deepseek.com"
```

---

## 4. Persona, Formatting & Model/Vendor Guardrails

All guardrails from the reference implementation are preserved and expanded for DeepSeek and `USER_FACING_COPY_SOURCE_OF_TRUTH.md`:

1. **Strict Plain Text Only:** No Markdown symbols (`*`, `**`, `#`, `###`, `---`, or backticks). Numbered steps use clean plain lines (`1. Title Defense - ...`).
2. **Concise Yet Complete ("sakto lang"):** 2–4 short sentences or a clean numbered list; never truncate full official lists (all 4 Doctoral + 7 Master's programs with majors, full admission/enrollment requirements, eligibility rules, or thesis steps).
3. **Human-Readable Institutional Staff Tone:** Strip all internal handbook/legal citations (`Manual Sec. X.X`, `Sec. 7.18`, `CMO No. 15`) and refer to portal pages by human-readable names (e.g., `Proposal Defense page`, `Student Dashboard`) instead of raw URL paths like `/student/thesis`.
4. **Expanded Model & Vendor Guardrail:**
   - Update `IDENTITY_QUERY_PATTERN`, `cleanAssistantReply()`, and System Prompt Rule 4 to detect and sanitize:
     - `DeepSeek`, `DeepSeek-V3`, `DeepSeek-V4`, `DeepSeek-R1`, `DeepSeek-Flash`, `DeepSeek-Chat`, `DeepSeek-Reasoner`
     - `Gemini`, `Hydrogen`, `ChatGPT`, `GPT`, `Claude`, `OpenAI`, `Anthropic`, `Google AI`
     - `large language model` / `LLM`
   - Always identify strictly as the **EARIST Graduate School Assistant**.
5. **Conversational & Pre-Question Handling:** Greetings, thank-you messages (`"Thanks for the information!"`, `"Salamat sa iyong impormasyon!"`), pauses (`"Wait lang"`), acknowledgments (`"Noted"`), and pre-question openers (`"May tanong ako sa thesis"`) go to DeepSeek (and have matching deterministic fallbacks) and receive **one short warm sentence** without out-of-scope rejections or unsolicited dashboard dumps.
6. **Live Portal State Discipline:** Only inject/surface `<LIVE_USER_PORTAL_STATE>` details in the answer when the user explicitly asks about their own status, step, title, adviser, schedule, or what to do on the current page.
7. **Multilingual Matching:** Detect and respond naturally in **English**, **Tagalog**, or **Taglish** matching the user's message.
8. **Canonical Official Contact Details:** Consistently use **`gs@earist.edu.ph`** and **`(02) 8534-8267`** (Nagtahan St., Sampaloc, Manila; satellite campus in GMA, Cavite) across `getOutOfScopeFallbackReply()`, the system prompt, and all knowledge chunks.

---

## 5. Knowledge Base Audit & Production Reconciliation

File: `backend/src/data/chatbot-knowledge.json` (ported from the 71-chunk reference base and cross-verified against the 35-page Manual of Operations PDF + current `main`):

| Area | Change Required for Production `main` |
|---|---|
| **Pre-Exam Bridging Waiver (`applicant-program-alignment-waiver` & references)** | **Retire obsolete `/applicant/alignment` blocker** (removed in PR #59). Keep the authentic Manual §7.3.4–§7.3.6 policy chunk (`admission-bridging-profed-nonthesis`: 9-unit Bridging Program for unrelated fields, 18 units ProfEd for non-education grads in education programs, Methodology of Research + Thesis 1 & 2 for non-thesis Master's entering Doctoral) framed accurately as an enrollment / Plan of Coursework policy endorsed by the Dean—not a pre-exam gate. Remove pre-exam waiver steps from `system-apply-pinnacle-register`, `enrollment-how-to-requirements-eligibility`, `applicant-exam-schedule-booking`, and `admin-role-overview`. |
| **Evaluation Edition Text** | Remove all references to *"Evaluation Edition"*, *"1-click entry"*, *"Scenario Switcher"*, and *"Page Guide"* from `system-login-portals-roles`, `admin-role-overview`, and `system-contact-evaluation-guides`. |
| **Registration & Password Reset** | Update `system-apply-pinnacle-register` to reflect the real 4-step registration setup (Applicant ID from EARIST Admissions Portal / Pinnacle, Personal Info, Program Selection, Password) and `system-login-portals-roles` to reflect real self-service **Forgot Password** (`/forgot-password` → `/reset-password` email link, PR #67) and role-specific sign-in identifiers (Applicant ID, Student Number, institutional email). |
| **Thesis & Defense Flows** | Align chunks with accepted production workflows: Title Defense requires 3 proposed titles, Proposal Package PDF, current COR, and defense-fee receipt with O.R. No. (`P 900.00`); GS-020 Adviser Request flows **Student e-sign → Adviser CONFORME → Dean APPROVE** (no Program Chair step in GS-IS); GS-017 Adviser Certification is system-owned (never uploaded by Student); Plan of Coursework / Curriculum Checklist is tracked under Student Curriculum (`PR #65`). |
| **Faculty / Panelist & Admin Guides** | Update faculty/panelist references to plain page names matching `/panelist/*` (Defense Workspace, My Advisees, Adviser Requests, Essay Evaluations, E-Signatures) and expand `admin-role-overview` to cover real Admin functions (COR verification, Exam Management, Thesis & Defense Scheduling, Email Manager, System Settings for Programs/Curricula/Institutional Officials, Repository archival). |
| **Programs Overview** | Keep curated `programs-all-overview` listing all **16 Graduate School Programs** in total: **4 Doctoral Programs** (`Ed.D.-EM`, `PhD-IP`, `DPA`, `DBA`) and **12 Master's Programs** (3 `MAEd` majors, `MAIE-HRM`, `MBA`, `MPA`, 4 `MAT` majors, `MAIP`, `MSM`) plus the 3 Cavite Campus offerings—100% aligned with `backend/src/config/graduate-programs.ts` and Manual §5.0. |
| **Role-Based Knowledge Isolation (RBAC)** | Enforce 3-layer least-privilege RBAC across all 5 roles: (1) hard role filtering in `retrieveKnowledgeChunks` (portal-internal chunks for `admin`, `faculty`, `student`, `applicant` are never retrievable by unauthorized roles); (2) `detectRoleRestrictedPortalQuery` short-circuiting cross-role portal/navigation queries (including short follow-ups like `"How about faculty?"`) BEFORE calling DeepSeek; (3) System Prompt Rule 8 forbidding cross-role portal leakage. Public pages strictly omit `Authorization` headers so `"Public & Admissions Guide"` never leaks signed-in portal internals. |
| **Contact Details** | Standardize every contact reference to `gs@earist.edu.ph` and `(02) 8534-8267`. |

---

## 6. Server-Side Live Portal Context (`chatbot-context.service.ts`)

When `optionalAuthenticateJWT` populates `req.user`, the backend executes a single bounded, read-only Prisma lookup (wrapped in `try/catch` so a transient DB lookup error never blocks answering policy questions):

| Verified Role | Authoritative Server-Derived Context Fields | Privacy / Integrity Rule |
|---|---|---|
| **`public`** (unauthenticated) | `pageTitle` mapped from `pathname` | Zero DB queries; no user identity. |
| **`applicant`** (`APPLICANT`) | Full name, applied `Program` name, latest `EntranceExamApplication` (`status`, formatted `examDate`/`examTime`, released `resultDecision` if published), latest `CorUpload` status (`PENDING`, `VERIFIED`, `REJECTED`). | **Never leak unreleased exam scores or raw item counts** before official Admin release (`resultDecision` / released state). |
| **`student`** (`STUDENT`) | Full name, `Program` name, `studentNumber`, `admissionStatus`, latest `CompExamRecord` outcome, active `ThesisRecord` (`stage`, `status`, `outcome`), selected `ThesisTitle`, active `AdviserAssignment` (adviser full name), latest pending `AdviserRequest` status, upcoming `DefenseSchedule` (`defenseType`, `sessionStatus`, formatted date/time/venue), latest `PlagiarismResult` status. | Scoped strictly to `student.userId === req.user.userId`. |
| **`faculty`** (`FACULTY` / `PANELIST`) | Full name, active advisee count (`AdviserAssignment` active count vs. 5-advisee cap), pending incoming `AdviserRequest` count, upcoming active `PanelAssignment` (`isActive: true`) defense count, and pending essay evaluations count (when `panelist.canEvaluateEssays === true`). | Only counts active assignments (`isActive: true`). |
| **`admin`** (`ADMIN`) | Full name, `adminAccessLevel`, live pending operational counts (pending `CorUpload`, pending `ThesisRecord` applications, `APPROVED` unscheduled defenses, pending `AdviserRequest` awaiting Dean approval). | Only surfaced when Admin explicitly asks about current pending workload/queues. |

---

## 7. Security, Rate Limiting & Exam Integrity

1. **Rate Limiting (`POST /api/chat`):** Lightweight in-memory sliding-window limiter (`20 requests per 60 seconds` keyed by `user:${req.user.userId}` when authenticated, or client IP when public; periodic cleanup to prevent memory growth). Returns `429 Too Many Requests` with a polite plain-text message; skipped/configurable cleanly in unit tests.
2. **Input Bounds:**
   - `message`: required non-empty string, trimmed, truncated/validated at max `1000` characters.
   - `pathname`: optional string, max `200` characters, mapped through a strict allowlist `resolvePageTitle(pathname)` (raw unrecognized paths fall back to `"EARIST Graduate School Portal"`).
   - `history`: optional array; sanitized to `{ role: "user" | "bot", content: string }`, capped to the last `4` turns (`<= 400` chars per turn) when sent to DeepSeek.
3. **Auth & Session Safety:** Uses `optionalAuthenticateJWT`, which already invokes `verifyActiveUserSession(identity)` (enforcing `isActive` and `User.tokenVersion`). Revoked or deactivated tokens degrade safely to unauthenticated `"public"` context without exposing private DB records.
4. **Entrance Exam Integrity:** `ChatbotWidget` checks `pathname.startsWith("/applicant/exam")` and returns `null` immediately—no floating trigger button, no open panel, and no keyboard shortcut while an Applicant is on the examination page.

---

## 8. Frontend Widget Design (`frontend/src/components/chatbot/chatbot-widget.tsx`)

`ChatbotWidget` is already mounted in all 5 layouts: `(public)`, `(portal)/applicant`, `(portal)/student`, `(portal)/panelist`, and `(portal)/admin`.

- **Role Resolution:** Uses `useSession()` (`session.user.role` mapped to `applicant | student | faculty | admin`) combined with `usePathname()` (so public pages use `"public"` when unauthenticated, and portal layouts match the signed-in role).
- **5 Role Modes (Header Subtitle, Welcome Message & Quick Questions):**
  - **Public:** Programs offered, how to apply, learning modalities, Graduate School Office contact details.
  - **Applicant:** Exam scheduling, Entrance Exam overview, COR upload & Student promotion, admission requirements.
  - **Student:** Max units per semester, Written Comprehensive Exam rules, 5-step Thesis Journey & 7-day rule, academic gown colors.
  - **Faculty / Panelist:** Defense Workspace guide, grading Entrance Exam essays, 1:5 adviser ratio rule, Rapporteur Report workflow.
  - **Admin:** Pending verification & scheduling workflows, COR verification, Email Manager & triggers, Curricula & Institutional Officials settings.
- **Transport:** Calls `POST ${getClientBackendBaseUrl()}/api/chat` with `Authorization: Bearer ${session.user.accessToken}` when signed in.
- **No Navigation Pill Buttons:** Renders clean plain-text bubbles (`whitespace-pre-line`), subtle amber tint for `isOutOfScope` replies, Reset Conversation button (`RotateCcw`), hydration-safe timestamps (`suppressHydrationWarning`), and a friendly error fallback message if the backend is temporarily unreachable.

---

## 9. Planned File Inventory

### Backend (`backend/`)
- `backend/src/data/chatbot-knowledge.json` — Reconciled 70-chunk Manual + Production Portal knowledge base.
- `backend/src/services/chatbot-rag.service.ts` — Hybrid TF-IDF + lexical + common inquiry retriever, EN/TL/Taglish detector, conversational intent handler, DeepSeek/vendor/markdown/citation sanitizer (`cleanAssistantReply`), and deterministic fallback (`buildGroundedResponseFallback`).
- `backend/src/services/chatbot-context.service.ts` — Bounded server-side Prisma live context builder + pathname-to-page-title resolver.
- `backend/src/services/deepseek-chat.service.ts` — Native `fetch` DeepSeek Chat Completions client (`deepseek-flash`, `temperature: 0.2`, `max_tokens: 1200`, `15s` timeout) + system prompt builder.
- `backend/src/routes/chat.routes.ts` — `POST /api/chat` with rate limiter, `optionalAuthenticateJWT`, follow-up enrichment, DeepSeek call, and deterministic fallback.
- `backend/src/routes/index.ts` — Mount `router.use('/chat', chatRoutes)`.
- `backend/.env.example` — Add `DEEPSEEK_API_KEY`, `DEEPSEEK_MODEL`, `DEEPSEEK_BASE_URL`.
- `backend/scripts/verify-chatbot-rag.mjs` — Ported & production-updated 70-case benchmark (including DeepSeek/vendor sanitization checks).
- `backend/src/__tests__/chatbot-rag.test.ts` & `backend/src/__tests__/chat.routes.test.ts` — Vitest automated unit & route tests.

### Frontend (`frontend/`)
- `frontend/src/components/chatbot/chatbot-widget.tsx` — Upgraded 5-role floating GS Assistant widget with `/applicant/exam` integrity hide and live `/api/chat` integration.

---

## 10. Verification & Acceptance Plan

Following `docs/superpowers/ENGINEERING_VERIFICATION_POLICY.md`, automated checks and manual/live QA will be executed and reported separately:

1. **RAG Benchmark Script:** Run `node backend/scripts/verify-chatbot-rag.mjs` and confirm **70/70 (100.0%)** pass, including explicit assertions that `cleanAssistantReply` strips `DeepSeek`, `DeepSeek-V4`, `DeepSeek-R1`, `DeepSeek-Flash`, `Gemini`, `ChatGPT`, `GPT`, `Claude`, `OpenAI`, `large language model`, Markdown syntax, and `Manual Sec.` citations.
2. **Backend Automated Tests & Typecheck:**
   - Focused Vitest suite (`chatbot-rag.test.ts`, `chat.routes.test.ts`) covering retrieval, DeepSeek fetch success/timeout/429/missing-key fallback, rate limiting, identity & off-topic short-circuits, conversational routing, and role-scoped live Prisma context (with `prisma.user.findUnique` returning active `tokenVersion: 1`).
   - Backend `.\node_modules\.bin\tsc.cmd` (0 errors) + full backend Vitest regression check before merge readiness.
3. **Frontend Typecheck & Production Build:**
   - Frontend `.\node_modules\.bin\tsc.cmd --noEmit` (0 errors) and `npm run build` (`71/71` pages).
4. **Live `/api/chat` & Browser QA (reported separately once executed):**
   - `"What graduate programs are offered by EARIST?"` → returns all 4 Doctoral + 7 Master's programs (with majors) in plain text.
   - `"Hi, what model are you?"` → identifies strictly as EARIST Graduate School Assistant (never mentions DeepSeek/Gemini/LLM).
   - `"Thanks for the information!"` / `"Salamat sa iyong impormasyon!"` → warm 1-sentence reply (not an out-of-scope rejection).
   - `"Ano ang process ng thesis disertation?"` → clean plain-text Taglish steps.
   - Verify widget is hidden on `/applicant/exam` and live personalized status answers work when signed in as Applicant, Student, Faculty, and Admin.

---

## 11. Phased Implementation Plan (Single Feature Branch: `feat/rag-chatbot-deepseek`)

1. **Phase 1 — Knowledge Base & Hybrid RAG Engine (`backend/`):** Port and reconcile `backend/src/data/chatbot-knowledge.json` against the 35-page Manual of Operations PDF and current `main` (PR #59–#67), build `backend/src/services/chatbot-rag.service.ts` with DeepSeek/vendor guardrails, and verify `node backend/scripts/verify-chatbot-rag.mjs` achieves **70/70 (100.0%)** alongside Vitest unit tests (`chatbot-rag.test.ts`).
2. **Phase 2 — DeepSeek Client, Server-Side Prisma Live Context & `POST /api/chat` (`backend/`):** Implement `chatbot-context.service.ts`, `deepseek-chat.service.ts`, `chat.routes.ts` (rate limiter + `optionalAuthenticateJWT` + automatic local-RAG fallback), mount at `/api/chat`, update `backend/.env.example`, and verify via `chat.routes.test.ts` + `tsc`.
3. **Phase 3 — 5-Role Floating `ChatbotWidget` & Exam Integrity Guard (`frontend/`):** Upgrade `frontend/src/components/chatbot/chatbot-widget.tsx` for all 5 roles (`public`, `applicant`, `student`, `faculty`, `admin`), live Bearer JWT requests via `getClientBackendBaseUrl()`, no per-reply nav pills, and strict hide on `/applicant/exam`; verify via `tsc --noEmit` and `npm run build`.
4. **Phase 4 — Full Verification & Live `/api/chat` QA:** Run full backend Vitest regression, benchmark script, backend/frontend builds, and live `/api/chat` checks (reported separately from automated tests per `ENGINEERING_VERIFICATION_POLICY.md`).

