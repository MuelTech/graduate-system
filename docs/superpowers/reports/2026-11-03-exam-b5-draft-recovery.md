# EXAM-B5 — Persisted MCQ/Essay Drafts, Autosave and Recovery

Date: 2026-11-03, Asia/Manila.

**IMPLEMENTED / PUSHED — INDEPENDENT REVIEW PENDING**. This is not B5 acceptance,
an Approved Reference Implementation, or examination production readiness.

## Starting state and delivery scope

Verified existing branch `feat/exam-engine-scheduling`, clean worktree, local HEAD,
upstream/tracking HEAD and live remote feature HEAD all at
`f99c1932fc5ef7eda1c49cf1027f6848f085c42f`. Tracking divergence: 0 ahead / 0 behind.
Live main matched `a6dc6f57c6e8130482c814e90703765972fddaa9`; feature was 31 ahead /
0 behind main. Live refs were read using `git ls-remote` after restricted SSH
initially failed. No branch creation, main change, reset, rebase, history rewrite,
force push, PR or merge. Final delivery records the actual implementation/live
remote SHA without a self-referential hash inside this commit.

Read the current checklist, Phase B plan, B0A/B2/B3/same-day assignment/B4 reports,
verification policy, content authority and full UI/UX playbook/audit. Inspected the
actual answer schema, validation, locking, final submission, B4 execution, exact B2
projection, page/query/API conventions, migrations and real MariaDB harnesses.
Next.js and React skill guidance informed the client implementation. Current source
and this explicit B5 authorization supersede historical transitional descriptions.

## Schema and additive migration

`20261103010000_exam_answer_draft_revision` adds only
`ApplicantAnswer.draftRevision` / `applicant_answers.draft_revision INTEGER NOT NULL DEFAULT 0`.
Existing application/question uniqueness and foreign keys remain intact. Zero is
a technical concurrency baseline, **not** a historical edit count. No answer-value
backfill, historical timestamp, parallel answer system or historical migration edit.

**Configured development database: UNCHANGED / B5 NOT APPLIED.** Runtime environments
must apply the committed migration with `prisma migrate deploy` before using B5.
Implementation used only disposable local databases for migration execution;
there was no configured-database reset, `db push`, bank import or configuration edit.

## Authenticated read/write contract

Under `/api/exam-engine`, APPLICANT-only JWT-protected contracts:

| Method | Exact application route | Contract |
| --- | --- | --- |
| GET | `/applications/:applicationId/drafts` | Array of persisted safe drafts from this execution's exact frozen revision. |
| PATCH | `/applications/:applicationId/drafts` | One versioned MCQ or essay update; returns acknowledged representation and new revision. |
| PATCH | `/applications/:applicationId/autosave` | Compatibility URL using the **same new versioned contract**; old unversioned bodies reject. |

The retired implicit `/questions`, `/autosave`, `/submit` paths remain rejected.
There is no latest-application or mutable-bank fallback.

Write bodies contain exactly `questionId`, `expectedRevision`, and exactly one of:

- `selectedOptionId: UUID | null` for a frozen MULTIPLE_CHOICE question;
- `essayAnswer: string` for a frozen ESSAY question, including `""` and whitespace.

`expectedRevision` is a nonnegative integer below signed INT maximum. UUIDs are
validated/normalized; unknown fields, missing/contradictory representations,
wrong types, foreign/nonmember questions/options and malformed IDs reject before
persistence. Essay capacity remains 65535 UTF-8 bytes; no word-count grading rule.

Read/acknowledgment DTOs allowlist only `questionId`, `revision`, and the applicable
answer representation. No correctness, key, score, source-bank state, answer-row ID,
storage metadata or configuration is exposed. Responses remain private/no-store.
Reads filter question IDs to the exact application-bound revision and validate the
stored representation against frozen type/options; incompatible rows fail closed.
Absent drafts have no row; clients use base revision zero for their first write.

Both operations independently verify exact JWT ownership before the application
lock and again from the active bound application after it. Foreign ownership returns
404. Existing B4 eligibility, ACTIVE binding, authoritative deadline and frozen
content checks apply. Unstarted, blocked, expired, terminal and legacy-unbound
records reject. The deadline is checked again after the operation; crossing it
rolls a draft transaction back rather than extending examination time.

## Versioning, clear and competing devices

Reuse the B0A parameterized exact application `SELECT status ... FOR UPDATE` and
PENDING/APPROVED allowlist. Within the same READ COMMITTED transaction, load the
current answer revision, compare `expectedRevision`, then upsert value + revision
atomically. The first acknowledged draft is revision 1; each successful subsequent
write advances by one. A stale request receives 409 with refresh guidance, without
writing. Repeating an already-committed request also returns conflict; there is no
silent successful replay or last-writer-wins policy. Lost responses recover by read.

MCQ selection, replacement and `null` clearing all retain the same unique answer
row and version. Essay edits and explicit `""` clearing do likewise. The opposite
representation is stored as null. Older requests therefore cannot recreate or
resurrect a cleared choice/text. Competing devices from revision 4 cannot both save:
the lock winner advances to 5 and the stale writer rejects. No device prohibition
or essay merge policy is introduced.

## Applicant scheduling, hydration and save state

The exact execution and frozen questions load before initial draft hydration.
The page remains gated until the draft read succeeds. Server values restore MCQ
selection, essay text and Question Navigator answered/unanswered state. Reopening
creates a fresh queue and reads persistence; mounted memory is presentation state.
No localStorage, sessionStorage, IndexedDB, persistent protected-content cache or
synchronous unload request was added.

`ExamDraftQueue` serializes network writes and coalesces later local edits. MCQ saves
schedule after 100ms; essay debounce is 600ms with a 3000ms maximum wait using a
monotonic clock, so continuous typing cannot postpone the first save indefinitely.
In-flight responses update acknowledged revisions without replacing newer local
values; the next queued write uses the newly acknowledged base. Navigation, essay
blur and visibility loss attempt flush. Routine successful autosave has no manual
Save action or per-keystroke toast.

Visible states: **Unsaved changes**, **Saving…**, **Saved**, save failure with
**Retry save**, and changed-elsewhere conflict with **Refresh saved answers**.
Saved is shown only after reading or acknowledging the current state. Database
revision counters stay hidden. Failure retains local values while mounted and
stops automatic repeated writes; retry first resolves server state.

Offline pauses the queue and retains mounted edits behind the existing B4 access
gate. Reconnect/focus/visibility return first refreshes execution authority, then
reads drafts. Clean fields adopt current server values. Dirty fields whose base is
unchanged can retry safely; if the server advanced to different content, local
work remains visible as a conflict and no stale content is resent. The explicit
refresh action replaces local edits from authoritative readback. A lost response
with the same persisted value is reconciled without replay. Competing essay text
is never automatically merged. B4's persisted deadline, monotonic countdown,
15-second authority polling, media context and expired/terminal presentation remain.

## Final submission handoff

Before opening final confirmation, lock editing, resolve server authority and drain
pending writes. A known failure/conflict cannot present confirmation as ready.
Confirmation blocks answer editing; the final action independently repeats the
resync/drain and reads the latest queue snapshot, including explicit blank essays.
Duplicate preparation/submission clicks are guarded. Final submission remains the
existing `{ answers: [...] }` authoritative snapshot under B0A, with unchanged
scoring and incomplete-answer behavior.

Draft-first and submit-first contenders share the same application lock. Draft
first commits, then final snapshot replaces it. Submit first makes waiting/later
drafts reject from the current terminal status. Final submission now explicitly
uses READ COMMITTED as well: real contention with a preliminary snapshot exposed
an upsert reading stale pre-draft state under host-default REPEATABLE READ. The
new isolation ensures post-lock reads see the committed draft without weakening
the locking/current-status authority. Final answer/status/score writes still roll
back together. B5 introduces no terminal receipt or submit retry/expiry redesign.

## Automated and real database verification

- Exam-domain unit/component/HTTP selection: **48 files / 1025 tests PASS**, no
  failures/skips. This includes B5 API/queue/component checks plus directly affected
  B0A/B0B/B1/B2/B3/B4, immutable content, accepted renderers/emphasis, media and result
  regressions. Broadened within the exam domain for schema/authorization/locking;
  no unrelated whole-repository suite.
- After the monotonic scheduling refinement and frontend formatting: affected
  queue/component checks **2 files / 36 tests PASS**.
- Existing Phase A Question Bank/content UI verifier: **11/11 PASS**.
- B5 disposable-MariaDB harness: **11/11 PASS**, comprising ten direct B5 checks and
  one wrapper executing **B4 11/11 PASS**, including **B0A 5/5 PASS** and **B2 4/4 PASS**.
  Nested runner wrapper counts are reported separately, not inflated into a new
  independent-test total.

Real engine: MariaDB **10.4.32**, InnoDB, host default REPEATABLE-READ. B5 draft and
final transactions explicitly use READ COMMITTED. Independent connections were
observed executing and waiting on actual `FOR UPDATE` through `SHOW FULL PROCESSLIST`
before releasing the first transaction. Final B5 lock-wait connection pairs:
**1152 / 1147** (MCQ), **1161 / 1150** (essay), **1161 / 1153** (draft then final),
**1167 / 1156** (final then waiting draft).

Verified: one winner/two-client conflicts, delayed/duplicate stale rejection,
nonresurrectable MCQ and essay clears, fresh Prisma connection readback, both
draft/final orders and post-TAKEN rejection, injected exception after real answer
write restoring prior value + revision, and B4 ownership/content/deadline guards.
B0A/B4 fixtures now supply explicit revisions and owned synthetic identities;
B2's historical-schema rehearsal inserts answer fixtures via original-column SQL
so newer generated Prisma fields cannot invalidate that historical test.

Migration rehearsal deployed the complete committed pre-B5 chain into an empty
UUID-named local database, inserted nonempty legacy answer and terminal/application
fixtures, then deployed actual B5 SQL. Exact original-column SHA-256 was preserved:
`7a25c0aec1c3ac909cde0c8982a77f02e7662d5f88b6f8e68a4880455b434b3f`.
Existing answer got technical revision zero; values stayed exact. Status was up
to date and repeat deploy had no pending migrations. Disposable databases were
removed by exact generated name and absence verified. Protected configured
exam/configuration snapshot was identical before/after:
`2ef0b2d1874d3fdd6635919d752881450f034d8acfe59b8e1f2257d80a8cd906`.

Initial harness attempts exposed the real final-read isolation issue above and
test-only fixture/command problems (charset replacement, malformed test-call edit,
historical-schema Prisma insert, and a fake-timer wait). Those were corrected;
only final successful runs establish PASS. The existing frontend verifier was
rerun successfully from its required frontend working directory after an initial
wrong-working-directory invocation. No runtime safeguard was relaxed for tests.

Static/build checks: **backend build/typecheck PASS; Prisma generate/validate PASS;
frontend TypeScript PASS; scoped ESLint PASS; frontend production build PASS
(68 pages); git diff --check PASS**. Existing Next middleware/Node/Vite advisories
are nonblocking. No dependency, lockfile or framework configuration changes.

Reproduction (PowerShell):

```powershell
# backend
$files = rg --files tests/unit | Where-Object {
  $_ -match '[\\/](exam-(answer|result|configuration|question-set|engine|media|content|emphasis|record|schedule|execution|assignment|draft)|applicant-(exam-content|results)|admin-exam-editor)'
}
npm test -- $files
$env:EXAM_B5_DB_TEST = '1'
npm test -- tests/integration/exam-draft-contention.test.ts --reporter=verbose
npx prisma generate
npx prisma validate
npm run build
# frontend
npx tsc --noEmit
npx eslint 'src/app/(portal)/applicant/exam/page.tsx' src/lib/exam-drafts.ts
node --test scripts/verify-exam-content-6-ui-follow-up.mjs
npm run build
# repository root
git diff --check
```

## Manual/browser QA and hosted CI

**Project-owner manual/browser QA: DEFERRED / NOT EXECUTED — consolidated Phase B lifecycle/manual acceptance gate**

The eventual owner gate includes refresh with saved MCQs, refresh with saved essay,
MCQ clear, blank essay clear, offline/online recovery, long continuous typing,
two tabs/devices, stale conflict, and immediate submit during an in-flight save.
Controlled component/handler tests and static rendering are automated evidence,
not manual/browser QA or visual acceptance.

**Hosted CI: NOT EXECUTED / no hosted PASS claimed.** Current CI triggers pushes
to main and PRs targeting main. This delivery is a normal feature-branch-only push;
no PR, workflow change, deployment or main merge is authorized here.

## Exact changed files

```text
backend/prisma/schema.prisma
backend/prisma/migrations/20261103010000_exam_answer_draft_revision/migration.sql
backend/src/controllers/exam-engine.controller.ts
backend/src/repositories/exam-engine.repository.ts
backend/src/routes/exam-engine.routes.ts
backend/src/services/exam-answer.rules.ts
backend/src/services/exam-engine.service.ts
backend/tests/integration/exam-answer-contention.test.ts
backend/tests/integration/exam-draft-contention.test.ts
backend/tests/integration/exam-execution-contention.test.ts
backend/tests/integration/exam-question-set.test.ts
backend/tests/unit/controllers/exam-answer.controller.test.ts
backend/tests/unit/repositories/exam-answer.repository.test.ts
backend/tests/unit/routes/exam-draft.routes.test.ts
backend/tests/unit/services/exam-answer.service.test.ts
backend/tests/unit/services/exam-draft-queue.test.ts
backend/tests/unit/services/exam-execution-ui.contract.test.ts
frontend/src/app/(portal)/applicant/exam/page.tsx
frontend/src/lib/exam-drafts.ts
docs/superpowers/GSIS_IMPLEMENTATION_CHECKLIST.md
docs/superpowers/plans/2026-11-01-exam-engine-scheduling-phase-b.md
docs/superpowers/reports/2026-11-03-exam-b5-draft-recovery.md
docs/superpowers/ui-ux/UI_UX_AUDIT.md
```

## Protected scope and stop

Accepted Phase A content/rendering/media, B0A containment, B0B result protection,
B1 configuration, B2 immutability, B3 admission/capacity and B4 execution authority
remain protected. No source-bank/configuration/canonical asset mutation, score
policy, passing threshold, grading, result publication, retake/period rule, appeal,
reschedule or reconsideration change.

B6 still owns timeout auto-submit, workers/no-browser finalization, immutable
receipt, finalization reason and submit-vs-expire state machine. B7/B8/B9/B10 and
unrelated features were not implemented or authorized. **STOP after normal B5
commit/push; independent review remains pending. Do not begin B6.**
