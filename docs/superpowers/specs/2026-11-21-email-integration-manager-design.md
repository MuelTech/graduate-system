# Email Integration & Admin Email Manager Design Specification

**System:** EARIST Graduate School Information System (GS-IS)
**Branch:** `feat/email-integration-manager` (merged to `main` via PR #67 at `0e210895`)
**Status:** ✅ ACCEPTED & MERGED — 2026-11-21
**Date:** 2026-11-21
**Related Checklist Sections:** §8 (Email Integration), §14 (Collaborator Review Queue), §15 (Immediate Priority Queue), §17 (Auth & Credential UX), §21.1–§21.2 (Account Recovery & Background Workers)

---

## 1. Purpose & Design Goals

Replace the incomplete, broken, and Redis-dependent email scaffolding with a **24/7 operational, crash-proof, zero-spam transactional email system** built for real EARIST Graduate School operations:

1. **Zero Extra Infrastructure (Pure MySQL Persistent Queue):** Remove Redis/BullMQ/Memurai/Docker dependencies from email delivery. Use MySQL (`email_logs`) as the single persistent queue, retry store, idempotency guard, and delivery audit log, drained by a built-in Node.js background worker.
2. **Full 4-Cycle Transactional Coverage:** Cover **Accounts & Security** (all 4 roles, including self-service `/forgot-password`), **Entrance Examination & COR Onboarding**, **Academic Progress & Written Comprehensive Examination**, and **Thesis & Dissertation Defense Lifecycle**.
3. **Zero Spam & No Redundant Noise:** Explicitly exclude mass broadcasts (`memo_broadcast`, `general_broadcast`), in-defense committee report signature emails (`rap_distributed`, `rap_finalized`), and unreviewed plagiarism emails (`strike_result`).
4. **Unified EARIST Institutional Email Layout:** Wrap every email body in a responsive, table-based, inline-CSS EARIST Graduate School HTML frame with auto-generated plain-text fallback and clean canonical portal links (`APP_PUBLIC_URL`).
5. **Dedicated Admin Email Manager (`/admin/emails`):** Replace the broken blank `Email Templates` tab under `/admin/settings` with a dedicated, low-icon, typographic **Email Manager** page in the Admin sidebar (`Delivery Logs`, `Templates`, `Automated Triggers`).
6. **Non-Blocking Failure Isolation:** Automated workflow emails are always best-effort post-commit (except explicit transactional queue-claim flows like Entrance Exam result release). An SMTP outage can never roll back or break core academic database transactions.

---

## 2. Audit of Existing Issues Addressed by This Spec

- **Broken Admin Settings UI (`settings/page.tsx`):** Rendered blank rows because it read `template.key` and `template.description` instead of Prisma's `templateKey` and `subject` (`variablesDescription`).
- **Broken Subject Compilation (`email.service.ts`):** Compiled `bodyHtml` with Handlebars but never compiled `template.subject`, and never checked `template.isActive`.
- **Broken `FRONTEND_URL` Links:** `.env` uses comma-separated origins for CORS (`http://localhost:3000,http://127.0.0.1:3000`), causing malformed links inside emails.
- **Broken `cron.worker.ts`:** Ran every minute (`* * * * *`), queried nonexistent `status: "APPROVED"`, and lacked deduplication.
- **Collaborator Branches (`fix/email-direct-smtp-fallback`, `feat/email-integration`):** Direct synchronous SMTP loops blocked HTTP requests and swallowed errors; older branch targeted removed `waiver.service.ts` and legacy 2-strike WCE logic. Neither branch is merged as-is.

---

## 3. Queue, Delivery & Reliability Architecture (Pure MySQL)

### 3.1 Single Source of Truth (`email_logs`)
Every enqueued email creates a durable row in `email_logs` with `status = QUEUED`, pre-rendered `subject`, `htmlBody`, `textBody`, `category`, optional `batchId`, and optional unique `idempotencyKey`.

### 3.2 Background Email Worker (`backend/src/workers/email.worker.ts`)
- Started automatically in `backend/src/index.ts` and stopped cleanly on `httpServer.close` (`SIGTERM`/`SIGINT` safe).
- **Wake-up + Safety Sweep:** Wakes immediately when `EmailService` enqueues new jobs, plus runs a lightweight 5-second poll sweep to pick up delayed retries and any pending rows.
- **Startup Crash Recovery:** On server startup, any row stuck in `PROCESSING` (e.g., after a power outage or process crash, or `lockedAt` older than 5 minutes) is safely reset back to `QUEUED` so no email is silently lost.
- **Atomic Row Claiming:** Claims due rows (`status = QUEUED` and `nextAttemptAt IS NULL OR nextAttemptAt <= NOW()`) via conditional update so concurrent ticks never double-send the same row.
- **Pooled & Throttled SMTP Transport:**
  - `nodemailer.createTransport({ host, port, secure: port === 465, pool: true, maxConnections: 2, maxMessages: 100, rateDelta: 1000, rateLimit: 5, auth: { user, pass } })`.
  - Respects Gmail App Password and institutional SMTP pacing limits even during 100+ examinee 24-hour reminder runs.
- **Automatic Exponential Retry:**
  - `maxAttempts = 3` (configurable).
  - Backoff schedule after transient SMTP failure: **30 seconds → 2 minutes → 10 minutes**.
  - After final attempt failure, status transitions to `FAILED` with the sanitized `errorMessage` preserved for Admin inspection and 1-click Retry.
- **Idempotency (`idempotencyKey`):**
  - Maps callers' deterministic keys (e.g., B8 `exam-result-{appId}-{scoreId}-{scoredAt}-{template}`, daily `exam-reminder-24h-{appId}`) to `EmailLog.idempotencyKey` (`UNIQUE`, nullable).
  - Duplicate enqueue attempts safely resolve to the existing log row without creating duplicate emails.

### 3.3 Environment Modes & URL Safety
| Env Variable | Values / Behavior |
|---|---|
| `EMAIL_MODE` | `smtp` (real SMTP send), `dry_run` (renders & records `SENT` in `email_logs` without connecting to SMTP — ideal for local UI QA), `disabled` (default in `NODE_ENV=test` / Vitest unless explicitly overridden) |
| `APP_PUBLIC_URL` | Single canonical URL for email links & buttons (e.g., `http://localhost:3000` for local dev or `https://graduate.earist.app` for production). Falls back safely to the **first** comma-separated origin of `FRONTEND_URL`. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` (or `SMTP_FROM`) | Standard SMTP sender configuration (supports Gmail App Password, Brevo, institutional SMTP). Never committed to git. |

---

## 4. Database Schema Changes (Single Additive Migration)

Migration name: `20261121070000_email_mysql_queue_and_password_reset`

1. **`EmailStatus` enum:** Add `PROCESSING` (`QUEUED`, `PROCESSING`, `SENT`, `FAILED`).
2. **`EmailLog` (`email_logs`) additive columns:**
   - `recipient_name` (`VARCHAR(180)`, nullable)
   - `category` (`VARCHAR(50)`, nullable — `ACCOUNTS`, `ADMISSIONS_EXAM`, `ACADEMIC`, `THESIS_DEFENSE`, `SYSTEM_TEST`)
   - `batch_id` (`VARCHAR(64)`, nullable)
   - `idempotency_key` (`VARCHAR(191)`, unique, nullable)
   - `html_body` (`LONGTEXT`, nullable — stores rendered email for durable worker delivery & Admin retry/preview)
   - `text_body` (`LONGTEXT`, nullable — auto-generated plain-text fallback)
   - `attempt_count` (`INT`, default `0`)
   - `max_attempts` (`INT`, default `3`)
   - `next_attempt_at` (`DATETIME(3)`, nullable)
   - `locked_at` (`DATETIME(3)`, nullable)
   - `last_attempt_at` (`DATETIME(3)`, nullable)
   - `triggered_by_id` (`VARCHAR(191)`, nullable FK → `users.user_id` `ON DELETE SET NULL`)
   - `updated_at` (`DATETIME(3)`, default `NOW(3)`)
   - Indexes on `(status, next_attempt_at)`, `(batch_id)`, `(category)`, `(created_at)`.
3. **`EntranceExamApplication` (`entrance_exam_applications`) additive column:**
   - `reminder_24h_sent_at` (`DATETIME(3)`, nullable) for daily cron deduplication.
4. **New table `PasswordResetToken` (`password_reset_tokens`):**
   - `token_id` (`UUID` PK), `user_id` (FK → `users.user_id` `ON DELETE CASCADE`), `token_hash` (`VARCHAR(64)` UNIQUE — SHA-256 of 32-byte random token), `expires_at` (`DATETIME(3)`), `used_at` (`DATETIME(3)`, nullable), `requested_ip` (`VARCHAR(64)`, nullable), `created_at` (`DATETIME(3)`).
   - Indexes on `(user_id)`, `(expires_at)`.

---

## 5. Unified EARIST Branded Email Layout & Copy Standard

All emails are rendered through one shared layout builder (`backend/src/services/email-layout.ts`):
- **Header:** EARIST Crimson (`#8B1E1E`) banner with gold accent border (`#D4AF37`), white institutional header (`EULOGIO "AMANG" RODRIGUEZ INSTITUTE OF SCIENCE AND TECHNOLOGY` / `Office of the Graduate School`). No external image URLs that break in Gmail/Outlook/testmail.
- **Body Card:** `max-width: 600px`, warm neutral canvas (`#F8F6F2`), crisp white paper card (`#FFFFFF`), category kicker, clear subject heading, personalized greeting (`Dear {{recipient_name}},`), concise formal body, optional structured key-value summary box (with separate `Date:` and `Time: ... (Philippine Time)` rows for scheduled events), a single solid crimson CTA button with a plain-text fallback link beneath it, and formal institutional closing (`Respectfully, Office of the Graduate School`).
- **Footer:** Automated notice disclaimer and campus address (`Office of the Graduate School, Nagtahan, Sampaloc, Manila`), avoiding special-character em-dashes and middots across subjects, bodies, and footers.
- **Plain-Text Fallback:** Automatically strips HTML into clean readable plain text for `text` MIME part (reduces spam filtering).
- **Copy Compliance:** Strictly follows `docs/superpowers/USER_FACING_COPY_SOURCE_OF_TRUTH.md`: shortest truthful wording, zero internal manual citations (`Manual §7.14.3`), zero raw enum strings, and **policy-only temporary password guidance** (*"Your temporary password is your LAST NAME in ALL CAPS. You will be required to change it upon signing in."*) — never printing raw plaintext passwords in emails.

---

## 6. Complete Email Coverage Matrix (22 Transactional Templates across 4 Cycles)

### Cycle 1 — Accounts & Security (`ACCOUNTS`, 6 templates)
| # | Template Key | Trigger | Recipient | Variables |
|---|---|---|---|---|
| 1 | `applicant_registered` | Public `/register` succeeds | Applicant | `recipient_name`, `applicant_id`, `program_name`, `portal_link` |
| 2 | `faculty_account_created` | Admin creates Faculty account | Faculty | `recipient_name`, `login_email`, `portal_link` |
| 3 | `admin_account_created` | Full Admin creates Admin account | Administrator | `recipient_name`, `login_email`, `access_level`, `portal_link` |
| 4 | `account_password_reset` | Admin resets password (**Applicant, Student, Faculty, or Admin**) | User | `recipient_name`, `login_identifier`, `portal_link` |
| 5 | `password_reset_link` | Self-service `/forgot-password` request (**all 4 roles**) | User | `recipient_name`, `reset_link`, `expiry_minutes` |
| 6 | `account_status_changed` | Admin deactivates or reactivates account (**all 4 roles**) | User | `recipient_name`, `status_label`, `status_message`, `portal_link` |

### Cycle 2 — Entrance Examination & COR Onboarding (`ADMISSIONS_EXAM`, 7 templates)
| # | Template Key | Trigger | Recipient | Variables |
|---|---|---|---|---|
| 7 | `exam_scheduled` | Applicant books slot, Admin assigns same-day slot, or Admin approves reschedule | Applicant | `recipient_name`, `program_name`, `exam_date`, `exam_time`, `portal_link` |
| 8 | `exam_reminder_24h` | Daily `8:00 AM Asia/Manila` cron for tomorrow's `PENDING` exams (deduplicated via `reminder24hSentAt`) | Applicant | `recipient_name`, `program_name`, `exam_date`, `exam_time`, `portal_link` |
| 9 | `ecat_result_pass` | Admin releases `PASSED` result (B8/B10 audited path) | Applicant | `recipient_name`, `portal_link` |
| 10 | `ecat_result_fail` | Admin releases `FAILED` result (B8/B10 audited path) | Applicant | `recipient_name`, `portal_link` |
| 11 | `ecat_result_reconsidered` | Admin records `PASSED — RECONSIDERED` decision | Applicant | `recipient_name`, `portal_link` |
| 12 | `credential_dispatch` | Admin verifies COR & promotes Applicant to Student | Student | `recipient_name`, `student_number`, `program_name`, `portal_link` |
| 13 | `cor_rejected` | Admin rejects uploaded COR | Applicant | `recipient_name`, `remarks`, `portal_link` |

### Cycle 3 — Academic Progress & Comprehensive Exam (`ACADEMIC`, 2 templates)
| # | Template Key | Trigger | Recipient | Variables |
|---|---|---|---|---|
| 14 | `comp_exam_recorded` | Admin records or corrects Written Comprehensive Exam attempt (PR #62 hook) | Student | `recipient_name`, `attempt_number`, `result`, `outcome_note`, `portal_link` |
| 15 | `residency_warning` | Admin sends residency advisory (manual/future scheduled check) | Student | `recipient_name`, `warning_details`, `portal_link` |

### Cycle 4 — Thesis & Dissertation Lifecycle (`THESIS_DEFENSE`, 7 templates)
| # | Template Key | Trigger | Recipient | Variables |
|---|---|---|---|---|
| 16 | `adviser_request_received` | Student submits signed Adviser Request | Requested Faculty | `recipient_name`, `student_name`, `program_name`, `portal_link` |
| 17 | `adviser_assigned` | Dean approves Adviser Request (GS-020 finalized) | Student & Adviser | `recipient_name`, `student_name`, `adviser_name`, `portal_link` |
| 18 | `adviser_request_declined` | Adviser declines OR Dean rejects Adviser Request | Student | `recipient_name`, `decision_label`, `remarks`, `portal_link` |
| 19 | `defense_application_status` | Admin approves or rejects Title/Proposal/Final Defense Application | Student | `recipient_name`, `defense_stage`, `status_label`, `remarks`, `portal_link` |
| 20 | `defense_schedule` | Admin schedules OR corrects (`DEF-CORR-1`) defense schedule | Student | `recipient_name`, `defense_stage`, `schedule_action`, `defense_date`, `defense_time`, `venue`, `portal_link` |
| 21 | `defense_panel_assignment` | Admin assigns, updates role, or removes committee member (`DEF-CORR-1`) | Faculty (Chairman, Panelist, Adviser, Rapporteur, Facilitator) | `recipient_name`, `assignment_action`, `panel_role`, `student_name`, `defense_stage`, `defense_date`, `defense_time`, `venue`, `portal_link` |
| 22 | `defense_concluded` | Admin concludes defense & releases official verdict | Student | `recipient_name`, `defense_stage`, `verdict_label`, `remarks`, `portal_link` |

### Explicitly Excluded (Not Implemented / Legacy Calls Removed)
- `rap_distributed` & `rap_finalized` (in-defense signing is already required inside Defense Workspace; remove legacy email call in `thesis.controller.ts`).
- `memo_broadcast` & `general_broadcast` (Memos remain in-app + in-app notifications only to prevent mass email spam; remove legacy `EmailService.sendBatch` call in `memo.service.ts`).
- `strike_result` (deferred until STRIKE Objective 8 is redesigned).
- Legacy unused `cor_verified` key consolidated into `credential_dispatch`.

---

## 7. Self-Service Forgot Password Specification (`/forgot-password` & `/reset-password`)

1. **Public Entry:** Add a clean `"Forgot password?"` link on `/login` leading to `/forgot-password` (same EARIST seal & campus-backdrop auth card design as `/login` and `/change-password`).
2. **Request Endpoint (`POST /api/auth/forgot-password`):**
   - Accepts `{ email }` (case-insensitive trimmed email, works across Applicant, Student, Faculty, and Admin).
   - Rate-limited per IP and per email (prevents email bombing).
   - **Non-enumerating response:** Always returns `200 OK` with *"If an active account matches that email address, a password reset link has been sent."*
   - For active accounts: invalidates any prior unused reset tokens for that user, generates a 32-byte cryptographically random token, stores only its **SHA-256 hash** in `password_reset_tokens` with **30-minute expiry**, and enqueues `password_reset_link` containing `{APP_PUBLIC_URL}/reset-password?token={rawToken}`.
   - Deactivated accounts (`isActive = false` or `panelist.isActive = false`) do **not** receive reset links.
3. **Verify & Reset Endpoints (`GET /api/auth/reset-password/validate?token=...`, `POST /api/auth/reset-password`):**
   - Validates token hash existence, `usedAt IS NULL`, `expiresAt > NOW()`, and active user status.
   - Enforces the same password policy as `/change-password` (minimum length, confirmation match).
   - Atomically updates `passwordHash`, sets `mustChangePassword = false`, **increments `User.tokenVersion`** (immediately invalidating all active JWT & Defense Socket.IO sessions per PR #66), marks `usedAt = NOW()`, and records an `AuditLog` (`PASSWORD_RESET_SELF_SERVICE`).

---

## 8. Dedicated Admin Email Manager UI (`/admin/emails`)

### Navigation & Authorization
- Added to the Admin Sidebar right beside `Announcements & Memos` as **Email Manager** (`/admin/emails`), governed by existing `settings.manage` capability (`ADMIN_CAPABILITIES.SYSTEM_SETTINGS`).
- Remove the broken blank `Email Templates` tab from `/admin/settings` so Email Management has a single authoritative surface.
- Backend routes mounted under `/api/admin/emails/*` (`authenticateJWT`, `requireRole(["ADMIN"])`, `requireAdminCapability("settings.manage")`), keeping legacy `/api/admin/email-logs/logs` backward-compatible or cleanly redirected.

### UI Structure (Low-Icon, Paper-Faithful Typographic Layout — 3 Tabs)
1. **Delivery Logs Tab:**
   - Compact status bar showing **Delivery Mode** (`SMTP Active` / `Dry Run` / `Disabled`), **Worker State** (`Running`), and a **Send Test Email** button (opens modal accepting any email address such as `{namespace}.test@inbox.testmail.app` + optional template selector).
   - Summary KPI strip: `Total`, `Sent`, `Queued`, `Failed`, `Delivery Rate`.
   - Filters: Status (`All Statuses`, `Sent`, `Queued`, `Processing`, `Failed`), Category (the 4 cycles + `System Test`), Time Window (`Last 7 Days`, `Last 30 Days` default, `Last 90 Days`, `All Time` — synced to both table and KPI strip), and Recipient/Subject/Template search.
   - Table: Timestamp, Recipient, Subject (plus error excerpt if any), Attempts (`1/3`), Status pill (plus `Next retry: <time>` when `QUEUED` on backoff), Actions (`View`, `Resend` for `SENT`/`FAILED` non-token logs, `Retry` for failed rows) + **Retry All Failed** action.
   - **Resend to Original or Corrected Email (`POST /api/admin/emails/logs/:id/resend`):** Allows Admins to resend any stored `SENT` or `FAILED` notification to either the original email or a corrected address (e.g., after fixing a user's email typo in User Management), automatically suggesting an updated profile email when a uniquely matching user is found, preserving the original log immutably, creating a new queued `EmailLog` + `AuditLog` (`EMAIL_RESENT`), and blocking single-use expiring `password_reset_link` logs (`409`).
   - Detail Modal: Exact recipient, subject, status, attempts/next-retry timing, error message (if failed), `Resend Email` / `Retry Delivery` actions, and rendered HTML preview in a sandboxed `iframe` (`srcDoc`).
2. **Templates Tab:**
   - Grouped cleanly by the **4 Lifecycle Cycles** with clear human-readable names, trigger descriptions, Active/Paused status badge, and `Edit` button.
   - Editor View:
     - **Active / Paused toggle** (`isActive` — pausing a template cleanly suppresses that automated email without breaking workflows).
     - Editable **Subject** (supports Handlebars variables) and **Body HTML**.
     - Clickable **Variable Chips** showing exact supported variables for that template.
     - **Live EARIST Branded Preview** (server-rendered with realistic sample data inside a sandboxed `iframe`).
     - **Send Test Email** button (dispatches this template with sample variables to a chosen test email).
     - **Reset to Default** button (restores canonical copy from the template registry).
3. **Automated Triggers Tab:**
   - Clean operational reference table listing all 22 automated triggers, their cycle, target role(s), linked template status (`Active` / `Paused`), and the daily **24-Hour Entrance Exam Reminder** schedule (`8:00 AM Philippine Time`) with a manual **Run Reminder Check Now** action for Admin/QA.

---

## 9. Phased Implementation & Verification Plan

| Phase | Deliverables | Verification (per `ENGINEERING_VERIFICATION_POLICY.md`) |
|---|---|---|
| **Phase 1 — Schema, Core Queue Engine, Layout, Cron & Seed** | Prisma migration (`20261121070000_email_mysql_queue_and_password_reset`), template registry (`22` canonical templates), EARIST HTML wrapper + plain-text generator, `APP_PUBLIC_URL` helper, upgraded `EmailService` + `EmailRepository` (MySQL persistent queue, idempotency, retry), `email.worker.ts` (crash recovery, throttling, exponential backoff), fixed daily 8 AM Manila `cron.worker.ts`, updated `seed.ts` & `.env.example`. | `prisma validate`, `prisma generate`, apply migration locally, seed templates, focused backend unit tests (`email-service`, `email-worker`, `email-layout`, `cron-reminder`), backend `tsc`. |
| **Phase 2 — Lifecycle Triggers & Self-Service Forgot Password** | Wire all 22 triggers across Auth, Admin Users (Applicants/Students/Faculty/Admins), Exam, COR, Comp Exam, Adviser Requests, Defense Applications/Scheduling/Correction/Conclusion; remove legacy `memo_broadcast` & `rap_distributed` email calls; verify B10 result-email auth boundary; implement `/api/auth/forgot-password` & `/api/auth/reset-password` + frontend `/forgot-password` & `/reset-password` pages + `/login` link. | Focused backend unit/route tests for triggers & forgot/reset password (including `user.findUnique` + `tokenVersion` invalidation), affected exam/memo/defense regressions, frontend `tsc` & scoped ESLint. |
| **Phase 3 — Admin Email Manager API & Dedicated `/admin/emails` UI** | Backend `/api/admin/emails/*` endpoints (stats, filtered logs, detail, single/bulk retry, SMTP health/test-send, template list/update/toggle/preview/reset, trigger overview & manual reminder run); dedicated `/admin/emails` 3-tab UI; Admin sidebar & capability wiring; remove broken `Email Templates` tab from `/admin/settings`. | Focused route/RBAC tests, frontend `tsc --noEmit`, scoped ESLint, Next.js production build (`npm run build`), `git diff --check`. |
| **Phase 4 — Live End-to-End QA (`SMTP + testmail.app`) & Checklist Sync** | Configure local untracked `backend/.env` with Gmail/Brevo SMTP + `testmail.app` test inbox; verify live rendering, links, retries, forgot-password, and key triggers across all 4 cycles; update `GSIS_IMPLEMENTATION_CHECKLIST.md`. | Live `testmail.app` inspection + full backend/frontend verification baseline before PR merge to `main`. |

---

## 10. Acceptance & Verification Evidence (PR #67 — `0e210895`)

- **Schema & Seed:** Migration #64 (`20261121070000_email_mysql_queue_and_password_reset`) applied cleanly to local MySQL; 22 canonical templates synchronized via `backend/src/cli/sync-email-templates.ts` and retired keys removed.
- **Automated Verification:**
  - Backend: `tsc` 0 errors; full Vitest suite **278 passed | 9 skipped | 0 failed** (4,116 tests passed), including unit/route tests for MySQL persistent queue, exponential retry, layout/copy invariants, enum sanitization, verified CTA routes, daily 24-hour reminder cron, self-service password reset + `tokenVersion` invalidation, RBAC (`settings.manage`), time-window filtering, and audited resend fallback.
  - Frontend: `tsc --noEmit` 0 errors; scoped ESLint 0 errors/warnings; Next.js production build **71/71 pages** passed.
  - Diff hygiene: `git diff --check` passed; verified no `.env` secrets committed.
- **Live QA (Project Owner — 2026-11-21):**
  - Verified live Gmail SMTP (`smtp.gmail.com:587`, STARTTLS) delivery, branded EARIST HTML rendering, defense committee notifications, self-service `/forgot-password` on `https://graduate.earist.app/`, and Admin `/admin/emails` delivery monitoring.
  - Live QA findings resolved prior to merge: sanitized raw Prisma defense/WCE enums (`PROPOSAL_DEFENSE` → `Proposal Defense`, `REDEFENSE_REQUIRED` → `Re-Defense Required`, `PASSED` → `Passed`), removed special characters (`—` / `·`), aligned all email CTA paths to actual Next.js routes, switched password-reset auth pages to `getClientBackendBaseUrl()`, added `Resend` to original/corrected email and time-window filtering, and removed the redundant `Preview Notification` button from `/admin/thesis/scheduling`.
- **Operational Configuration Boundary:** SMTP credentials (`SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`/`SMTP_FROM`), `EMAIL_MODE=smtp`, and `APP_PUBLIC_URL=https://graduate.earist.app` remain strictly in untracked runtime `.env`.
