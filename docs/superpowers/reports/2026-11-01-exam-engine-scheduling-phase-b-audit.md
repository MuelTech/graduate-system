# Phase B — Exam Engine / Scheduling Audit

**Date:** 2026-11-01 (Asia/Manila)

**Repository:** `MuelTech/graduate-system`

**Status:** SOURCE AUDIT COMPLETE; INDEPENDENT REVIEW PASS; NO IMPLEMENTATION AUTHORIZED

**Branch:** `feat/exam-engine-scheduling-audit`

**Verified starting main / origin/main / live remote main:** `9ab8aa037b9c5a9f746bd0e6aef72478a3b76564`

**Companion plan:** [Phase B bounded packages](../plans/2026-11-01-exam-engine-scheduling-phase-b.md)

## 1. Executive assessment and stop boundary

The accepted Phase A content system is a sound foundation. The examination lifecycle is **not production-ready**. There is server-side schedule-window enforcement, authenticated ownership derivation, answer uniqueness, transactional final writes, private media, deterministic question ordering, and safe Applicant question projections. These should be retained.

There is no persisted actual-start/deadline/finalized attempt state or received-question snapshot. The Applicant runs an independent three-hour countdown; MCQs are saved only at final submission; essay autosave neither restores drafts nor locks on submission. Scheduling and scoring contain concrete integrity defects, beyond the already-known reload limitation.

**High-risk confirmed findings:**

| ID | Severity | Finding / affected source |
| --- | --- | --- |
| B-01 | HIGH | `ExamEngineRepository.submitAnswers` counts duplicate payload entries as separate correct answers, then upserts only one row per question. A foreign question's option can also be persisted. Actual-method in-memory reproduction confirmed both; see §8. |
| B-02 | HIGH | `autoSaveAnswer` checks time only and can change submitted/graded answers during the window. Final submission's read-then-update status guard does not serialize competing submissions. §§6–8. |
| B-03 | HIGH | `ExamService.scheduleExam` does not independently check slot program, active state, future start, or positive capacity configuration; capacity and duplicate-app checks are not atomic predicates. §5. |
| B-04 | HIGH | Independent browser duration conflicts with schedule-based server expiry; no automatic finalization saves MCQs when the browser closes or the server window expires. §6. |
| B-05 | HIGH | `ExamRepository.getLatestResult` returns PENDING scores; `ApplicantResultsPage` renders every successful non-passed result as FAILED. Grading and result reads also disagree about configured maxima/thresholds. §9. |
| B-06 | HIGH | Admin wall-clock storage and Applicant/server local-component conversions differ; a nominal 09:00 value displays as 17:00 in Manila. Assigned schedules can be edited through the API without lifecycle guards. §§5–6. |
| B-07 | HIGH | Live bank changes can alter received questions, grading denominators and historical prompts; question deletion cascades answer deletion. §10. |

Severity is audit triage, not a CVSS score. No production exploitation, deployed database condition, or live contention outcome is claimed. No CRITICAL severity is assigned without that evidence. All defects remain unfixed in this documentation package.

Mandatory stop: deliver this audit/plan/checklist update, verify docs, commit and push. Independent remote review and subsequent explicit authorization precede any implementation package.

## 2. Starting-state verification and authority

Before branch creation, `git status --short --branch` showed clean `main...origin/main`. `git branch --show-current` returned `main`; `git rev-parse main` and `git rev-parse origin/main` returned the full SHA above. A live `git ls-remote origin refs/heads/main` returned the identical SHA. The initial sandbox SSH attempt was denied; the approved retry succeeded. No fetch/fast-forward was needed because all three matched. `git show -s --format=fuller main` confirmed PR #45 and **Merge Phase A: Applicant Examination Mixed-Content Integration**. The new branch was created directly using `git switch -c feat/exam-engine-scheduling-audit main`. No rebase, reset, merge, or force push is part of this package.

Read the current checklist, content source of truth, complete 2026-10-29 integration plan, and engineering verification policy before deriving this assessment. Phase A's 2026-10-31 acceptance is controlling; earlier paragraphs describing incomplete content/typography are historical, not grounds to reopen it.

Additional material authority inspected:

- `ui-ux/SYSTEM_UI_UX_PLAYBOOK.md`: accepted UIUX-2C/D/E Exam Records/grading/detail ownership and UIUX-2H schedule wall-clock/booking safeguards; associated `ui-ux/UI_UX_AUDIT.md` checkpoints.
- `specs/2026-07-19-exam-applications-enhancement-design.md`: Applicant self-booking automatically confirms a schedule; no extra Admin application approval. It mentions **one attempt per period**, but supplies no period identity, reset boundary, or appeal/retake details.
- `reports/2026-10-29-exam-content-5.md`: explicitly defers timer, autosave, recovery, duplicate/incomplete submission, option validation, selection and scoring issues.
- `EXAM_CONTENT_SOURCE_OF_TRUTH.md` §§11–14 and integration-plan §§9–12: server authority, bounded packages, policy separation, accepted Phase A boundary.
- August 15 score-filter spec/plan: historical Score Management UI direction. Its lifecycle relevance is superseded by UIUX-2D/E and the actual redirect-only scores page; it is not an authority to restore the old queue/review routes or infer a grading timestamp from `createdAt`.

The current checklist also has an old claim that worker startup is commented out. Actual `backend/src/index.ts` imports the email worker and invokes `startCronJobs()`. Source wins here. The cron only sends reminders and is not an expiry mechanism. Unrelated/historical checklist sections were not edited.

## 3. Source inventory and execution map

Paths below are repository-relative. Function/model names and baseline line anchors identify supporting evidence; line numbers refer to the verified starting commit.

| Evidence key | Files / functions inspected | Role |
| --- | --- | --- |
| M | `backend/prisma/schema.prisma`: Program (130), ExamSlot (225), EntranceExamApplication (264), EntranceExamScore (285), ExamAppStatus (1395), QuestionType (1711), ExamMedia/ExamContentImport/ExamQuestion/ExamOption/ApplicantAnswer (1726–1809) | Persistence, constraints, cascades and missing lifecycle fields. |
| R | `backend/src/app.ts:createApp`, `routes/index.ts`, `routes/exam.routes.ts`, `routes/exam-engine.routes.ts`, `middlewares/auth.middleware.ts:authenticateJWT/requireRole` | Real `/api/exam` and `/api/exam-engine` mount/auth boundaries. |
| EC | `backend/src/controllers/exam-engine.controller.ts`: getAppId (15), Applicant questions (19), autosave (30), submit (43), Admin CRUD, getSchedule (95) | JWT-derived latest application; unvalidated answer bodies. `getSchedule` has no registered engine route. |
| ES | `backend/src/services/exam-engine.service.ts`: getApplicationIdForUser (13), assertApplicantQuestionAccess (24), validateExamTime (30), questions/autosave/submit (72/78/84) | Ownership resolution and fixed schedule-window gate. |
| ER | `backend/src/repositories/exam-engine.repository.ts`: getQuestionsForApplicant (25), autoSaveAnswer (33), submitAnswers (50), updateQuestion (137), deleteQuestion (179) | Shared bank, persistence, scoring, transaction and content mutation boundaries. |
| SC | `backend/src/controllers/exam.controller.ts` | Slot/status/appeal/result/grade/email request handling; grade conversion and 30-point bound (253 onward). |
| SS | `backend/src/services/exam.service.ts`: createSlot (10), scheduleExam (30), getApplicantStatus (83), updateSlot (119), appealMissedExam (219), getExamResult (264), gradeEssay (298), confirmResultAndEmail (310) | Scheduling and assessment workflow. |
| SR | `backend/src/repositories/exam.repository.ts`: getFutureActiveSlots (12), transactional booking helpers (24–47), status (57), updateSlot (72), detail (115), appeal decisions (207/220), getLatestResult (233), gradeEssay (262) | Queries, config overrides, grade transaction and appeal transitions. |
| C | `backend/src/services/exam-content.rules.ts:validateExamQuestion/mergeExamQuestionUpdate`; `repositories/exam-content.projection.ts`; `interfaces/exam-content.interfaces.ts`, `interfaces/exam.interfaces.ts` | Strong authoring validators and explicit safe projections, distinct from weak submission validation. |
| PM | `backend/src/services/exam-media.service.ts:getContent`, `repositories/exam-media.repository.ts:findForApplicant`, media controller/routes | Accepted private storage/access boundary and shared-bank attachment semantics. |
| I | `backend/src/services/exam-content-import.service.ts`, `repositories/exam-content-import.repository.ts:commit`; manifest shape/count only | All imported items enter the shared bank; no activation/publication selection. No content-fidelity re-audit. |
| P | `backend/src/routes/program.routes.ts`, `controllers/program.controller.ts`, `services/program.service.ts`, `repositories/program.repository.ts`; `routes/settings.routes.ts`, `services/settings.service.ts`, `repositories/settings.repository.ts`; config-field writer search | Program read endpoint and generic string settings; no authoritative Admin exam-settings consumer/mutation/UI discovered. |
| FE | `frontend/src/app/(portal)/applicant/exam/page.tsx` (complete); `lib/applicant-exam-content.ts`; `components/exam-content/applicant-question-renderer.tsx` | Actual local state, timer, draft, navigation and submission path. |
| FS | `frontend/src/app/(portal)/applicant/schedule/page.tsx`; `admin/exam/slots/page.tsx`; `lib/admin-exam-schedules.ts` | Self-booking, Admin create/edit/close/reopen, wall-clock helpers and client guards. |
| FA | `frontend/src/app/(portal)/admin/exam/questions/page.tsx`; `components/exam-content/admin-question-editor.tsx` contract; `admin/exam/applications/page.tsx`; `admin/exam/applications/[id]/page.tsx`; `admin/exam/scores/page.tsx`; `lib/exam-record-state.ts`; `types/index.ts` | Bank CRUD; accepted record list/detail; grade/email UI and retired scores redirect. |
| FR | `frontend/src/app/(portal)/applicant/results/page.tsx`; `lib/api.client.ts` | Result handling and request/session behavior; no durable retry queue. |
| W | `backend/src/index.ts`, `workers/cron.worker.ts`, `config/database.ts`; installed MariaDB adapter date/time formatter | Actual job startup, reminder-only scope and UTC serialization. |
| D | `backend/src/repositories/applicant.repository.ts`, `services/applicant.service.ts`; exam-pass gates in `services/cor.service.ts` and `repositories/cor.repository.ts` | Latest-app dashboard and PASSED dependency; downstream promotion not re-audited. |
| T | Test files in §12; backend/frontend package scripts; frontend verifier inventory | Evidence scope and absent lifecycle regression coverage. |

Searches covered all exam/answer/score/application writers under `backend/src`, timer/duration equivalents under both runtime trees and Prisma, configuration-field references, route mounts, jobs, and tests/verifiers. No separate exam attempt/configuration/answer recovery DTO or endpoint was found in those paths. Generic defense autosave/timers are separate domain code and are not used by the entrance exam.

## 4. Current end-to-end lifecycle and data relationships

```text
User (JWT APPLICANT) -> Student (userId unique) -> Program
                                                   |
Admin creates ExamSlot ----------------------------+
Applicant POST /exam/schedule
  -> transaction: alignment/status reads, capacity read, counter increment
  -> EntranceExamApplication(PENDING, slotId, copied examDate/examTime)
Applicant GET /exam/status -> first matching application (unordered)
Applicant clicks Start -> GET /exam-engine/questions
  -> latest application by createdAt -> schedule time gate -> entire live bank
  -> all MCQs + first ESSAY in page memory; no start write
MCQ selection -> React answers map only
Essay typing -> React essayText -> occasional PATCH /autosave
Explicit POST /submit -> transaction: payload answers + TAKEN + MCQ/PENDING score
Admin Exam Record -> POST /exam/scores/:id/grade
  -> mutable aggregate essay grade + total + PASSED/FAILED in one transaction
Applicant GET /exam/result -> latest scored application + live derived maxima
Admin POST /send-email -> queues pass/fail template
```

`ExamSlot` stores separate DATE and TIME, maxSlots, mutable slotsTaken and isActive. `EntranceExamApplication` links Student, Program and required Slot and duplicates schedule date/time; its status is the only broad lifecycle state. It has no startedAt, expiresAt, submittedAt, version, attempt number, period, frozen configuration or question set.

`ApplicantAnswer` is unique on `(applicationId, questionId)`. It references a live question and optionally a live option, with no composite constraint proving that option belongs to that question. It has no save timestamp/revision. Application/question deletion cascades answers; selected-option deletion sets its FK null. `EntranceExamScore` is unique per application; it has aggregate MCQ/essay/total, result status, grader ID and creation time, but no immutable grading event/history.

`ExamQuestion` is a global mutable bank with ordered options, type and Phase A content metadata. It has no program membership, activation state, exam-definition membership or immutable revision. Program's nullable `examMcqTotal`, `examEssayTotal`, `examPassingScore` are configuration fragments, not proof that the runtime consistently uses them.

### Classification summary

An area can contain correct sub-behavior and serious defects; the dominant area assessment does not erase those distinctions.

| Required area | Classification | Source-supported result |
| --- | --- | --- |
| A Admin configuration | PARTIALLY_IMPLEMENTED; duration authority MISSING; values POLICY_DEPENDENT | Program totals exist, question CRUD works; no duration setting; duplicated scoring rules. §§7,9. |
| B Scheduling | PARTIALLY_IMPLEMENTED / INCORRECT / UNSAFE | Real self-booking/edit/appeal APIs; weak mutation gates, time mismatch and race risks. §5. |
| C Attempts | MISSING authoritative attempt state; application reuse PARTIALLY_IMPLEMENTED | Ownership is real; Start is only a read; no start/deadline/final snapshot. §6. |
| D Timer | INCORRECT / UNSAFE | Fixed independent frontend countdown and fixed schedule-based server window disagree. §6. |
| E Timeout | PARTIALLY_IMPLEMENTED; automatic terminal transition MISSING | Server rejects new requests after window; no auto-submit/lock transition. §6. |
| F MCQ persistence | PARTIALLY_IMPLEMENTED; autosave/recovery MISSING | In-page state and final upsert work; full reload loses MCQ state. §8. |
| G Essay | PARTIALLY_IMPLEMENTED / INCORRECT / UNSAFE; composition POLICY_DEPENDENT | Authoring, upsert and Admin aggregate grading exist; first-only UI, weak draft/final lock and score rules. §§8–9. |
| H Final submission | PARTIALLY_IMPLEMENTED / INCORRECT / UNSAFE | Atomic grouped writes and serial terminal guard exist; no idempotent receipt or competing-submit guard. §8. |
| I Scoring/integrity | INCORRECT / UNSAFE; projection ALREADY_CORRECT | Duplicate inflation, invalid relationships, mutable denominator; Applicant key omission is correct. §§8–10. |
| J Activation/selection | MISSING controls/snapshot; ordering ALREADY_CORRECT; membership POLICY_DEPENDENT | Every bank item is served, deterministic order; no frozen received set. §10. |
| K Security/concurrency | PARTIALLY_IMPLEMENTED / INCORRECT / UNSAFE | JWT ownership/roles and private media retained; admission/state/transaction invariants incomplete. §11. |
| L Regression coverage | PARTIALLY_IMPLEMENTED | Substantial Phase A tests; very little execution coverage of lifecycle, no found contention/recovery suite. §12. |

## 5. Scheduling audit (B)

### Already-correct foundation

R restricts create/update/toggle and administrative record/appeal operations to ADMIN; booking/status/appeal/result routes to APPLICANT. SS.scheduleExam derives the Student from authenticated userId, rejects `PENDING_WAIVER`, blocks an existing PENDING/APPROVED/TAKEN/PASSED/APPEALED/DISQUALIFIED application, checks slot existence/capacity, and groups increment plus application creation in a transaction. A later creation failure therefore rolls back the increment. Applicant self-booking creates PENDING, which the accepted record projection calls Scheduled; PENDING is not evidence that Admin approval is missing.

FS Admin UI validates a positive integer capacity and prevents reducing it below the currently displayed bookings. It disables Program/date/time changes when bookings exist. Close for Booking changes only isActive; it preserves existing assignments. This is established accepted behavior and should remain distinct from exam cancellation.

### Defects and absent lifecycle

- **B-03 / HIGH — mutation bypasses list filters:** SR.getFutureActiveSlots filters supplied programId, isActive and date, and SS filters remaining capacity. But POST /schedule fetches slot by ID only. It does not require `slot.programId === student.programId`, isActive, future combined start, or the full allowed alignment set. The application is written with the Student program even when its slot belongs to another program. GET's client-supplied programId is not an ownership boundary. Frontend ALIGNED/CLEARED gating cannot secure the mutation.
- **Capacity concurrency / HIGH risk:** capacity is read, then an unconditional atomic increment occurs. The transaction provides rollback but no conditional increment/max check, explicit row lock or serializable/retry rule. Competing users may both pass the old remaining-capacity read. Same-user requests to different slots can both see no blocking application. M has neither one-active-application nor student/period uniqueness. The exact race/deadlock outcome depends on isolation/adapter and was not live-tested.
- **Assigned-slot edit / HIGH:** SS.updateSlot and SR.updateSlot accept program/date/time/capacity without rechecking assigned applicants, current status/start, or booked minimum. Client-disabled fields are bypassable by direct ADMIN requests. Slot-preferred engine timing and status UI immediately use the changed slot; copied application date/time stay old. Changing slot program can split application/slot program authority. Schedule-change notification is only a console placeholder. There is no version/conflict token or atomic amendment audit.
- **Same-day availability / PARTIAL:** `examDate >= new Date()` compares a date-only column to now rather than the combined future start. The accepted UIUX-2H authority already records same-day exclusion risk. Exact parameter/date truncation and deployed driver behavior were not exercised against MySQL here.
- **Validation / UNSAFE:** controllers pass slot bodies to services without a scheduling DTO validator. Prisma types/FKs enforce some storage constraints, not positive integer capacity, future dates, booked minimum or business-valid transitions. Past duplicate schedules are not prevented by an identified business constraint.
- **No cancellation/reschedule lifecycle:** only close/reopen booking and a missed-exam appeal path exist. No Applicant cancellation, reassignment, reserved-seat release or durable cancellation event was found. Closing a booked slot does not stop its Applicant's current engine access; that preservation matches the established booking-close meaning.
- **Appeal ambiguity:** SS.appealMissedExam allows a PENDING application once scheduled start has passed, not only after exam end. It reads Student/apps outside the supplied transaction client and updates without an atomic PENDING predicate. An appeal can race a final submission. Approval changes APPEALED to FAILED (enabling a new booking); rejection changes it to DISQUALIFIED. Neither releases the old slotsTaken nor records a separate no-show/appeal decision history. A FAILED application can represent real failure or approved missed-exam reschedule.
- **Status selection disagreement:** SS.getApplicantStatus chooses the first matching app from an unordered relation, excluding FAILED. The engine chooses latest by createdAt; result chooses latest with any score. After retries or concurrent booking these may refer to different records. A FAILED-only history becomes examStatus `none`, so the exam page's `failed` submitted-state branch is not normally supplied by /status.
- **No actual slot transition machine:** isActive is bookability; PAST/FULL/CLOSED/OPEN are UI projections, not persisted started/expired/cancelled slot states. Expired PENDING applications remain PENDING and block rebooking until appeal workflow changes them.

### Date/time semantics — B-06

M uses `@db.Date` and `@db.Time(0)`. FS Admin helper writes `examTime: 1970-01-01T09:00:00.000Z` for typed 09:00 and deliberately reads UTC components. Installed MariaDB adapter `formatDate/formatTime` also reads UTC components. This confirms the documented wall-clock contract locally.

FE exam/schedule and ES.validateExamTime instead use local `getFullYear/getMonth/getDate/getHours/getMinutes`; FE schedule/result and the Admin record time formatter use locale time conversion. No shared institution-zone conversion is applied. A read-only `Intl.DateTimeFormat` check of the same serialized time in Asia/Manila yielded **17:00**, where the Admin schedule helper presents **09:00**. The server constructs its boundary in host local time; different host/browser offsets and date rollovers can further disagree. This is a proven representation mismatch, not a claim about current live booking data. Legacy already-shifted rows require evidence-based reconciliation, not automatic offset subtraction.

**Owner clarification after audit review:** `Asia/Manila` is the authoritative institutional timezone for Entrance Examination scheduling. An Admin-entered wall-clock schedule such as **4:00 PM** must represent **4:00 PM Philippine time** for the Applicant and server-side lifecycle regardless of browser or server host timezone. This resolves the timezone authority; exact exam duration, late-entry, grace, and deadline semantics remain policy decisions.

## 6. Attempts, timer and timeout (C–E)

ES.getApplicationIdForUser resolves Student by unique userId then latest application descending createdAt. EC never accepts a caller's applicationId for questions, autosave or submission. This is **ALREADY_CORRECT** direct cross-app ownership protection. Reopening does not create a new attempt: it reads the same selected application, provided no newer one exists.

But no persisted attempt starts when Start is clicked. FE only GETs questions, sets in_progress and starts local counting. Application stays PENDING until submit. There is no actual start timestamp, expiry, completion timestamp, attempt identity/version beyond applicationId, re-entry lease or device session binding. Multiple tabs/devices are possible and share the same application writes without stale-update detection. No allowed-attempt count/period enforcement exists despite the historical one-attempt-per-period statement.

### Complete runtime duration inventory

| Source at baseline | Constant / behavior |
| --- | --- |
| FE exam page:58 | `useState(10800)`; local seconds reset on component remount. |
| FE exam page:151–160 | `setInterval` subtracts one per callback; clamps at zero; does not derive elapsed server time. |
| FE exam page:457 | Static duration label `3 Hours`. |
| FE exam page:479 | Static instruction saying the three-hour timer begins on opening. |
| ES:29,56 | Scheduled-three-hour comment and `examStart + 3 * 60 * 60 * 1000` backend deadline calculation. |
| ES:58–69 | 60,000 ms early grace; before start minus one minute rejects, after end rejects; exact end is allowed (`now > examEnd`). |

Searches for 180 minutes, 10,800/10800, three-hour/3-hour and multiplication equivalents found no additional entrance-exam runtime duration authority. The 60-second essay interval and 600-second red-warning threshold are separate timing constants. Duration is duplicated in frontend/backend code, absent from authoritative database/Admin settings.

Scheduled start and actual opening are **different in execution but conflated in instructions**: backend deadline always follows schedule; frontend always displays a fresh full duration after successful load. A late opener can see hours remaining when the server has minutes. Client clock changes affect gateway unlock; server time still gates the GET.

| Event | Actual behavior / classification |
| --- | --- |
| Refresh or close/reopen within server window | Same application, fresh 10800, empty MCQ/essay state, new fetch of live questions; server expiry does not extend. INCORRECT / UNSAFE. |
| Switch device/tab | Independent countdown/state, same derived app; no draft restoration or writer conflict handling. MISSING recovery/concurrency semantics. |
| Disconnect | Local timer continues according to browser scheduling; MCQs remain only in memory; essay failures logged; submit requires network. No durable queue/reconciliation. PARTIAL. |
| Delayed load/background throttling | Countdown starts after GET and decrements per callback rather than absolute deadline; background throttling can extend the displayed duration. Server remains schedule-gated. INCORRECT. |
| Countdown reaches zero | No auto-submit, disable, terminal state or effect calls handleFinalSubmit. Controls remain usable; repeated ticks stay zero. MISSING. |
| API called after server expiry | questions/autosave/submit and Applicant media-context checks fail at server schedule gate. Existing saved state/status is not finalized. PARTIALLY_IMPLEMENTED. |
| Request begins before expiry, commits after | Time check precedes the repository transaction/write and is not rechecked under a finalization lock. Boundary crossing is not proven prevented. PARTIAL. |
| Browser closed at expiry / server restart | No timeout worker or durable terminal transition. Restart does not reset schedule-based gate, but unsent MCQs never reached the server. MISSING finalization. |
| Expiry UI | Expired submit error is detected by message substring and changes to no_schedule/Examination Missed. Expired Start GET only alerts and leaves gateway. Autosave failure only logs. No authoritative expired view. PARTIAL. |

Stopping/changing frontend JavaScript can bypass the displayed countdown and leave local controls usable. It **cannot by itself bypass the real server schedule-end check** for a new request. The unsolved problems are mismatch, lost answers, missing terminal state and the pre-write check boundary, not total absence of server timing enforcement.

## 7. Admin configuration (A)

**PARTIALLY_IMPLEMENTED:** strong Admin question authoring supports MCQ/ESSAY, content/options, exact one correct MCQ option, labels and order. Program stores nullable score totals/threshold. Admin Exam Record displays configured totals; these are real existing capabilities.

**MISSING:** no authoritative duration source or Admin exam-configuration mutation/UI; no question-count/essay-count/weight configuration, bank activation, exam selection publication or attempt-scoped config snapshot. Program route is read-only. Searches found exam total writers in fixture seeding, not an operational configuration service. Generic ADMIN `/settings/:key` updates an existing SystemSetting string, but the inspected exam paths do not consume it for duration or scoring; it is not an exam-settings authority merely because it exists.

**INCORRECT / UNSAFE:** current effective rules are fragmented:

- ES fixed schedule + three hours; FE fixed opening + three hours.
- SC and SS grade validation each cap essay at 30; SR additionally caps at configured essayTotal or fallback 30.
- SR grading uses live MCQ bank count and `floor((mcqCount + essayTotal) * 0.75)`, ignoring stored examPassingScore.
- SR results replace configured MCQ total with current bank count, essay total with 30 and passing score with live 75% calculation. Admin detail continues displaying stored Program totals.

Thirty essay points, 75%, exact duration and configuration ownership/versioning are technical behavior, not newly established institutional policy. Existing program fields should be evaluated for reuse rather than replaced wholesale.

**Owner clarification after audit review:** the current physical entrance-examination form contains **one essay assessment**. The exact essay prompt/content is intentionally not being encoded as authoritative system content yet. The essay maximum score/weight remains **TBD pending client confirmation**. MCQ scoring is intended as **1 point per correct item**, also pending client confirmation. The passing threshold must be Admin-configurable and remains **TBD pending client confirmation**. Phase B should use a simple current examination configuration plus a persisted scoring basis on each finalized result; a full policy-version/effective-date subsystem is not required.

## 8. Answers, essay drafts and final submission (F–H, I)

### MCQ state and persistence

FE onSelect uses `withApplicantAnswer` to replace the selected option for a question while preserving other entries. Navigator and progress use this same answers map. This supports away/back navigation and changing an answer **ALREADY_CORRECTLY** within the mounted page. There is no MCQ API request at selection, localStorage/IndexedDB persistence, incremental save, or Applicant draft GET. Reload/reconnect cannot hydrate navigator/selection state from the backend. `/autosave` only destructures essayAnswer. Sending selectedOptionId there does not provide MCQ autosave.

Final submit upserts on application/question uniqueness. This correctly avoids duplicate answer rows across updates. It does **not** validate uniqueness of input entries or guarantee the score corresponds to the final persisted row.

### B-01: score inflation and relationship integrity

ER.submitAnswers loops `answers: any[]`, loads each live question/options, finds the submitted option in that question for scoring, increments mcqCorrect, then upserts the supplied IDs. No validated array/unique-ID/type/member-set contract runs before this loop. Correct-option authority is server `ExamOption.isCorrect`; no client boolean determines correctness. A foreign option earns no point in that lookup, **but is still persisted** if it exists, because the FK is only on option ID.

Read-only reproduction executed the actual repository class transpiled in memory, with a synthetic transaction/DB stub (no network, database or file writes). Payload: the same synthetic question twice with its correct option, then once with a foreign option. Observed result:

```text
mcqScore = 2
distinct persisted question-answer rows = 1
final persisted selectedOptionId = foreign-option
```

This isolates an actual algorithm defect; it is not a live-database integration test. Repeating all available options can also accumulate correct hits without making the final persisted selection correct. There is no clamp against question count. Invalid/missing question IDs may fail via FK and roll back, but unknown-question rejection is not a deliberate validation boundary. EssayAnswer on MCQs and selectedOptionId on essays are not consistently rejected. There is no received-question-set membership to check.

### Essay lifecycle

Admin can author any number of ESSAY questions with no options (C). ER sends them all. FE uses `.find(type === ESSAY)` and displays only the first; multiple essays are silently omitted and zero essays still leave a valid sidebar Submit action. **Owner review of the physical entrance-examination form confirms one essay assessment as the intended exam composition.** The current first-only frontend behavior therefore happens to match the intended count, but it is not yet an authoritative one-essay contract because authoring/runtime validation still permits zero or multiple essays. The exact essay prompt/content is intentionally deferred, and its maximum score/weight remains pending client confirmation. No live DB essay count was queried.

FE starts an interval only when essayText.trim() is nonempty. The effect depends on essayText, so each edit restarts the sixty-second interval: continuous typing can postpone saving indefinitely. Clearing text does not persist a blank; server may retain a previous draft. There is no save-status feedback, durable retry, revision, in-flight ordering, unload flush or recovery GET. Errors only reach console. Automatic reconnection retry is not implemented.

ES validates only time before ER.autoSaveAnswer upserts by app/question. No ESSAY type, submitted/application-status or snapshot check exists. This can create an essay field on an MCQ or modify a TAKEN/PASSED/FAILED application's answer while the server schedule is open. Final submission does not await pending autosave. A stale response arriving later can overwrite final essay text. Saved-but-omitted drafts survive final submit because only supplied answers are updated; after reload an old persisted essay can survive despite an empty new local draft. These are **INCORRECT / UNSAFE**, not merely policy questions.

### Final submission and retries

- **Correct transaction scope:** ER groups submitted answer upserts, TAKEN and score creation/update in one Prisma transaction. A DB failure rolls back these final-write operations together; there is no source evidence of intentionally partial final commits. Earlier autosaves are separate committed work.
- **Correct serial guard:** a submission that observes TAKEN/PASSED/FAILED rejects overwriting. Applicant UI switches to submitted on success and displays its success view on subsequent status fetch for selected terminal states.
- **Missing incomplete-answer authority:** FE modal explicitly shows MCQ progress and essay word count, warns that answers cannot change, and permits incomplete submission. Backend accepts `answers: []`; neither independently verifies required questions nor an explicit incomplete acknowledgment. This is current behavior; whether blanks must be disallowed remains policy-dependent.
- **Unsafe competing submit:** transaction reads status then later unconditionally updates it. There is no atomic compare-and-set, record version, explicit lock or serializable/retry contract. Two requests can pass the same old read; exact DB contention outcome was not exercised. FE has no submitting flag to disable double clicks.
- **Not idempotent:** serial repeat returns an error, not the original receipt. If commit succeeds but HTTP response is lost, retry can report already submitted. There is no receipt endpoint or reconciliation flow; a page reload can recover a terminal status but not an exact submission receipt.
- **State bypass:** only TAKEN/PASSED/FAILED are rejected by ER. APPEALED and DISQUALIFIED can submit within the schedule window; question fetch and autosave have no status prohibition at all. Newer-app selection also changes the implicit target without a client-bound application identifier.
- **Lock incomplete:** submitted page hides controls, but raw autosave/questions/media remain time-gated only. Resubmitting serially is blocked, yet essay changes and direct Admin regrading can alter the supposedly completed record. API errors are mostly 400 with strings, not stable lifecycle/recovery error codes.

## 9. Essay evaluation, scoring and result publication (G, I)

The accepted operational surface is **Exam Records → exact Exam Record**, not the old Score Management workspace. Admin sees deterministic ESSAY responses, auto-graded MCQ and aggregate essay score input; save invalidates exact detail/list queries. R enforces ADMIN, and SR.gradeEssay records authenticated adminId, total and both score/application result in a transaction. These are **ALREADY_CORRECT** foundations. Program Chair is a future permission decision, not a missing prerequisite to retaining current ADMIN grading.

Gaps:

- SR.gradeEssay only requires an application and score, not TAKEN/PENDING, submitted answer immutability, unresolved grading status, question completeness or a grading revision. Direct POST can regrade PASSED/FAILED, including a different Admin; previous grade/actor is overwritten. Client hiding the form after grading is not server protection.
- One aggregate essay score exists; no per-essay rubric/grade/maximum, grading completion set or weight model. Zero-essay exams still submit as TAKEN with PENDING score and require manual grade for a final result. Multiple essays have no per-question grading completion representation.
- Score bounds differ: controller coerces through `Number` (e.g. null/blank can become zero), controller/service bound 0–30, repository uses Program essayTotal `|| 30`; explicit zero falls back to 30. Frontend uses nullable configured max. These layers are inconsistent even before choosing policy.
- MCQ count is live, global and includes every MCQ. Missing answers earn no incremental point, but duplication can inflate points. No attempt-bound denominator, key revision, essay weight or passing policy is frozen. Changing correct flags changes later submission scoring; stored MCQ points are not automatically recomputed, while a later essay regrade recomputes threshold using the new count/config.
- Stored Program examPassingScore is bypassed by dynamic 75% floor. Result reads force essay maximum 30 even when grading used another configured value, and Admin detail may show a different configured MCQ maximum. Historical percentages can drift while persisted total/result stay unchanged.
- **B-05 / HIGH:** SR.getLatestResult's `score: { isNot: null }` means any score, not graded score. A successful final submit creates PENDING. SS returns `status: pending`, null essay/total coerced to zero; FR results uses `result.status === passed ? passed : failed`. It therefore announces FAILED before grading instead of an awaiting-grade state. The error-empty-state branch cannot catch a successful PENDING response.
- SS.confirmResultAndEmail checks only application existence; any non-PASSED status chooses fail template. ADMIN can directly queue a failure notification for PENDING/TAKEN/APPEALED etc. No final-result prerequisite or durable publication/version/deduplication state exists. UI only exposes the action on completed records and accurately says queued, not delivered.

COR upload/promotion already depends on an authoritative recorded PASSED application (`CorService` / `CorRepository.checkPassedExam`). That makes result integrity consequential. This audit traced the dependency only and did not change/re-audit downstream COR lifecycle.

## 10. Question activation, snapshots and answer-key confidentiality (I–J)

**ALREADY_CORRECT:** ER orders questions by order then id; options use order then id. C validates exactly one correct MCQ option and no options on essays. Applicant projection uses explicit select plus explicit output allowlist, excludes isCorrect/source import/key candidates/storage paths, and validates bounded structured content. Admin projection alone includes correctness. FE selection is by persisted option ID, not visible label or index. No accidental `isCorrect` exposure was found in inspected Applicant questions/status/result/submit responses. Submit returns aggregate mcqScore, not an answer key.

**MISSING:** no isActive/isPublished/exam membership on questions, selection UI or selected-count constraint, program-specific bank, randomization, revision freezing or question-receipt snapshot. Import creates all questions in the same global table; GET returns all rows without a filter. Every imported item and separately authored question is included automatically. This does not prove policy requires a subset or randomization; membership/composition is a decision, deterministic ordering can remain.

**B-07 / HIGH:** a mounted page holds its initial response, but server submit fetches live question/options. Refresh fetches a different set after Admin edits. Live edits can change wording, type, key, order or media during/after an exam. ER.updateQuestion correctly preserves option IDs and blocks removing options referenced by answers. However this does not freeze their meaning/correctness, protect unsaved active choices, or prevent whole-question deletion. ER.deleteQuestion directly deletes; M cascades its answers/options. Historical Admin essay prompts are read through the live question relation. No historical received content or scoring config is preserved.

Phase A media is private, attached-only for Applicant, role/context checked, no-store, checksummed and byte-type validated. Its context delegates to existing ES time checks; its attachment lookup is global-bank-based. Status restrictions or future frozen-set media references must be integrated in a later lifecycle package without weakening private storage/projections. This is a Phase B dependency, not reopening accepted Phase A media/source fidelity. No canonical questions, Q24/Q40, typography/emphasis map, manifest/assets or renderers were changed.

## 11. Security, transaction and concurrency matrix (K)

| Boundary | Existing protection | Gap / classification |
| --- | --- | --- |
| Caller identity / direct other-app answers | JWT + APPLICANT role, server user → Student → app lookup | ALREADY_CORRECT against supplying another applicationId; latest-app ambiguity remains. |
| Admin bank/config/grade/schedules | ADMIN route guard | ALREADY_CORRECT role foundation; server business validation incomplete. No permission expansion proposed. |
| Question/option IDs | Live DB FK; scorer searches current question options | Foreign option persists, wrong answer type accepted, no frozen-set membership; UNSAFE. |
| Final state | Serial TAKEN/PASSED/FAILED guard | Autosave bypass, APPEALED/DISQUALIFIED submit, concurrent read/write races; UNSAFE. |
| Expiry | Server Date check on questions/save/submit/media context | No durable terminal state or in-transaction deadline predicate; PARTIAL. |
| Booking capacity / duplicate app | Transaction + increment + prechecks | No atomic reservation or one-active/period invariant; UNSAFE concurrency risk. |
| Submit transaction | Answers + TAKEN + MCQ score commit/rollback together | Correct grouping; not idempotent/serialized with autosave, appeal, grading, bank edits. |
| Essay grade transaction | Score + app result + grader update together | Correct grouping; regrade/state/version/immutable history guard missing. |
| Autosave | Unique app/question upsert | Last-arrival wins; no sequence/revision; stale/cleared drafts and post-submit overwrite. |
| Question edits | Transaction; foreign option IDs rejected; referenced-option removal blocked | Whole delete cascades; live content/key mutation and unsaved choices unprotected. |
| Media and key | Private storage/context/attachment checks; explicit Applicant allowlist | Correct accepted boundary; later attempt/selection context must use same privacy protections. |

No cross-app IDOR was established for the actual Applicant engine controllers. Do not mislabel guessed question IDs as ability to write another Applicant's record. Risks here concern admission, allowed question/option relationships, lifecycle state and concurrency within the authenticated application's scope.

## 12. Existing automated coverage (L)

Inventory is **source inspection**, not fresh PASS claims. No repository suite/build, DB migration or browser QA was run for this docs package.

| Existing tests/verifiers | What they cover | What they do not establish |
| --- | --- | --- |
| `backend/tests/unit/repositories/exam-engine.repository.test.ts` | Safe projections/order; mixed-content CRUD, option identity preservation/foreign Admin ID rejection; one submit scoring image choices. | Duplicate payloads, foreign Applicant choice persistence, empty/invalid submit, concurrent terminal transitions. Its submit fixture uses `status: SCHEDULED`, which is not a real ExamAppStatus; this test is not lifecycle proof. |
| `backend/tests/unit/services/exam-media-access.test.ts` | Real ES user/latest-app resolution, missing profile/app, before/after three-hour window, early grace/fallback. | Terminal status, actual start, deadline restoration, canonical wall-clock across zones, time check/write race. |
| `backend/tests/unit/services/exam-engine-content.service.test.ts`; `controllers/exam-engine-content.controller.test.ts` | Admin question input validation and bounded HTTP errors. | Applicant lifecycle DTOs/authorization/time/submit execution. |
| `backend/tests/unit/services/applicant-exam-content.contract.test.ts` | Frontend helper execution for labels/IDs/order/in-page answer retention; static renderer checks. | Mounted reload, autosave/reconnect, timer, network failures, browser/device behavior. |
| `backend/tests/unit/repositories/exam-record.repository.test.ts`; `services/exam-record-detail.service.test.ts` | Admin bounded detail selection, ESSAY-only ordering, nullable numeric mapping and safe grader DTO. | Essay grade mutation bounds/transitions, regrading, configuration consistency or result publication. |
| `backend/tests/unit/routes/exam-record.routes.test.ts` | Registered read/retained mutation middleware shapes and retired queue/review routes. | Full unauthorized HTTP matrix: some test names say ADMIN but assert middleware count/auth identity rather than execute every role. |
| `backend/tests/unit/routes/exam-media.routes.test.ts`, `exam-media-upload.routes.test.ts`; services `exam-media.service.test.ts`, `exam-media-client.contract.test.ts`; repositories `exam-media.repository.test.ts` | Private media request roles/headers, content validation, context failure, attachment queries and client blob lifecycle. | Server attempt immutability or received-set media authority not yet implemented. |
| `backend/tests/unit/services/exam-content.rules.test.ts`, `admin-exam-editor.contract.test.ts`, `exam-content-package.test.ts`, `exam-content-real-package.test.ts`, `exam-content-import.test.ts`, `exam-emphasis*.test.ts`; repository/import/CLI/migration exam tests | Accepted Phase A validation/import/rollback/idempotency/emphasis/source-binding and authoring compatibility. | Runtime scheduling/drafts/submission/assessment lifecycle acceptance. |
| `frontend/scripts/verify-exam-content-6-ui-follow-up.mjs` | Bounded bank pagination/assessment text UI source assertions. | End-to-end exam correctness. |

Searches of backend tests and frontend verifiers found no dedicated execution tests for scheduleExam, capacity/duplicate booking contention, slot mutation invariants, appeals, MCQ autosave/recovery, zero timer behavior, server expiry finalization, gradeEssay/getLatestResult publication correctness, or Admin duration configuration. Defense-schedule and oral-exam tests are different domains. Frontend has Playwright as a dependency, but that does not supply an executed entrance-exam journey suite.

Highest-value missing regressions: duplicate/contradictory answers and cross-question options; final/draft/appeal races; same-user and last-seat booking; invalid/closed/past/foreign-program slots; UTC-component DATE/TIME round trips in multiple zones including midnight; repeated Start/reload/deadline stability; disconnected expiry and restart catch-up; stale autosave after finalization; pending result never FAILED or emailed; frozen bank/config under edits/deletes; zero/multiple essay behavior; grading bounds/threshold consistency/history; idempotent submit and lost-response recovery. The plan assigns these to bounded packages.

## 13. Policy Decisions Required

Only unresolved decisions that block the affected implementation are listed. They do not block technical containment of invalid IDs, duplicate score inflation, post-submit writes, or PENDING-as-FAILED output.

| Decision | Existing evidence / genuine unresolved part | Blocks |
| --- | --- | --- |
| PD-1 Duration and authorized start | `Asia/Manila` is now fixed as the institutional timezone. Current code still uses three hours with a one-minute early grace; decide duration scope/value, late-entry cutoff, grace, deadline rule and whether entry starts a fresh allotted duration or is capped by schedule end. | Config publication, start/timer/expiry acceptance. |
| PD-2 Assessment composition and essay scoring | Physical-form review confirms **one essay assessment**. Decide allowed MCQ bank membership/selection, essay maximum score/weighting, and any grading basis/rubric needed by the system. Exact essay prompt/content remains intentionally unencoded pending client confirmation. MCQs are intended as **1 point per correct item**, pending client confirmation. No randomization requirement is established. | Published selection, essay scoring, final scoring. |
| PD-3 Passing authority | Passing threshold must be Admin-configurable. Confirm the authoritative threshold value, units/rounding, program-specific variation if any, and whether existing Program `examPassingScore` is the intended storage source; hard-coded 75% is not policy approval. A full policy-version/effective-date subsystem is not required; finalized results must retain the scoring basis actually used. | Score configuration and final-result gate. |
| PD-4 Incomplete/timeout outcome | Decide whether explicit incomplete submissions are allowed and what final record/results to produce on timeout or no-show, using only server-received answers. Never invent unsent client answers. | Finalization validation and expired/no-show outcome. |
| PD-5 Attempts, period and appeals | July authority says one attempt per period. Define period identity, what consumes an attempt, failed-exam retry, no-show appeal eligibility/approval and post-assignment reschedule/cancellation authority. | Admission uniqueness, retries and schedule/appeal amendments. |

Current ADMIN grading and self-booking authority are established and need no new owner question to preserve them. Program Chair access, regrade/appeal exceptions after final results, optional capacity defaults and randomization can remain disabled/deferred; they do not block the base safe path. Concurrent devices must at minimum obey common server state and stale-write protection; a mandatory one-device policy is not invented. `Asia/Manila` is now the explicit institutional timezone authority and must not depend on browser locale or server host timezone.


### Owner-confirmed lifecycle and failure-recovery contract

The following cross-package behavior is now the Phase B recovery/fallback baseline. It does not authorize implementation by itself:

- **Refresh / browser reopen:** resume the same server-owned attempt, same deadline, and acknowledged saved answers; never restart a full local duration.
- **Disconnect / reconnect:** acknowledged server saves remain authoritative; unsaved/failed saves must be visible and safely retried or resynchronized without creating a new attempt.
- **Browser closed at expiry:** server-side expiry/finalization remains authoritative and must not require the browser to stay open.
- **Lost submit response:** if finalization committed but the HTTP response was lost, retry/reload must recover the same terminal state/receipt rather than create a duplicate submission.
- **Multiple tabs/devices:** all clients share the same attempt/deadline and stale writes cannot overwrite newer or finalized state. No mandatory one-device policy is introduced.
- **Autosave state:** the UI must distinguish saving/saved/failed or equivalent authoritative states; it must never claim persistence that the server did not acknowledge.
- **Server restart:** persisted attempt start/deadline/answers/final state survive restart; restart cannot reset examination time.
- **Timeout:** client UI locks for usability, but server time/finalization is authoritative even if client JavaScript freezes or is modified.
- **Timezone:** all institutional Entrance Examination scheduling uses `Asia/Manila`; Admin and Applicant must see the same intended Philippine wall-clock schedule.
- **Assigned schedule changes:** ordinary Admin edits must not silently rewrite an already-bound active attempt; later amendments/reschedules require the controlled lifecycle package.
- **Question/config stability:** an active/finalized attempt must retain the question set, answer key/scoring basis, and relevant configuration actually used so later Admin changes cannot alter historical results.
- **Pending essay grading:** awaiting evaluation remains pending and must never be presented or emailed as FAILED before authoritative grading completes.
- **Legacy records:** do not fabricate historical starts, deadlines, received-question sets, or scoring values where evidence does not exist.

## 14. Recommended remediation and architecture assessment

Use additive changes around existing Student/application/score relationships, validators, private storage and accepted Admin surfaces. First contain payload/state exploits and premature result publication. Then establish authoritative current configuration plus attempt/result scoring-basis snapshots and immutable received content, correct schedule admission/time, server attempt authority, persisted drafts, finalization/expiry, essay evaluation and consistent result scoring; close amendment/appeal history and run the lifecycle gate. See the companion plan for separate review boundaries.

The audit does not mandate a replacement exam platform or a separate model merely named Attempt. An additive authoritative lifecycle on EntranceExamApplication may be sufficient if it remains one execution per application; a child record is warranted only when accepted attempt policy requires it. Whatever representation is chosen must freeze effective settings/content, expose an exact owned identity, and support atomic draft/terminal transitions.

Evaluate against the requested chain:

| Intended link | Current assessment |
| --- | --- |
| Admin authoritative examination configuration | Fragments exist; operational authority incomplete. |
| Examination schedule → authorized Applicant | Real relationships/ownership; admission and time defects. |
| Server-authoritative attempt | Missing actual-start/deadline/terminal authority. |
| Persisted answers/autosave → authoritative remaining time | Final MCQ persistence and partial essay draft exist; recovery/time authority missing. |
| Timeout or explicit final submission → immutable final attempt | Grouped final writes exist; expiry/state/race/immutability gaps. |
| Authoritative scoring / essay evaluation | Server key and Admin grading exist; payload counts/config/publication/history unsafe. |

## 15. Verification, limitations and delivery scope

Performed: clean branch/base/live-remote verification; complete required authority reading and material supplemental sections; route-to-controller-to-service-to-repository/schema and UI/test tracing; targeted writer/config/duration/coverage searches; installed adapter formatter inspection; actual-repository in-memory duplicate/foreign-option reproduction; serialized wall-clock conversion check; manifest root/count read (72). The verifier was inline and left no script/test/artifact in the repository.

Documentation delivery checks: exact diff/reference inspection, relative Markdown target existence, `git diff --check`, and base-to-head file allowlist restricted to this report, its companion plan and a minimal checklist §7.2 status/link update. Final Git commit/push identifiers are reported in the delivery message, avoiding a self-referential commit hash in its own contents.

**NOT EXECUTED / NOT PROVEN:** live database state/counts/migration status; full source-fidelity/content audit (accepted Phase A); live multi-connection contention; browser/manual multi-role/device QA; deployed timezone/legacy-data correctness; disconnection/restart runtime tests; production exposure/exploitation; new hosted CI outcome; license/administration-policy verification. No tests/builds were rerun merely for Markdown. The synthetic repository check proves its algorithm with a stub, not DB locking/FK behavior in production.

No runtime, API, Prisma/schema, migrations, source questions/assets, typography/emphasis, private-media implementation, renderer or structured-authoring files were modified. No Phase B implementation, data mutation/import/reset or first package was performed. Phase A remains accepted; Phase B and every implementation package remain pending independent review and explicit authorization.
