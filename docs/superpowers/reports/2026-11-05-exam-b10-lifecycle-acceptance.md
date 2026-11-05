# EXAM-B10 — Focused Lifecycle Regression and Acceptance Gate

Date: 2026-11-05, Asia/Manila.

**B10 CORE AUTOMATED GATE INCOMPLETE — EXISTING ESLINT ERROR — INDEPENDENT REVIEW PENDING — OWNER MANUAL/BROWSER QA PENDING — EMAIL INTEGRATION DEFERRED**

The resumed core behavior, real-database, migration and content checks passed.
The declared relevant frontend ESLint gate failed on an existing JSX apostrophe
at `frontend/src/components/exam-content/applicant-appointment-gate.tsx:137`.
No production source was changed to remove it. Therefore the overall core
automated gate is **not PASS**. See section 11 for the authoritative resumed-run
results; sections 1–8 and 10 preserve the first-run evidence and its stop point.

Production source, schema, migrations, dependencies and canonical content were unchanged by the first B10 diagnostic run. The run correctly stopped after reproducing the result-email authorization defect. The project owner subsequently clarified that collaborator-owned email integration is not yet functional/accepted and is outside the agreed core Exam Phase B acceptance scope. The defect remains documented below as a known deferred Email Integration issue; it is not fixed. B10 may resume the remaining core examination lifecycle gates. B10 is not yet accepted; Phase B remains incomplete.

## 1. Verified starting refs and accepted chain

Repository: `MuelTech/graduate-system`; existing branch only:
`feat/exam-engine-scheduling`.

| Starting check | Verified result |
| --- | --- |
| Local HEAD | `6937c3331504b36b6acfb973bd15e7f7d6523a83` |
| Upstream/tracking HEAD | `6937c3331504b36b6acfb973bd15e7f7d6523a83` |
| Live remote feature HEAD | `6937c3331504b36b6acfb973bd15e7f7d6523a83` |
| Local/tracking/live main | `a6dc6f57c6e8130482c814e90703765972fddaa9` |
| Feature versus main | 47 ahead / 0 behind |
| Feature versus upstream | 0 ahead / 0 behind |
| Worktree | Clean |

Live refs were obtained using `git ls-remote origin` after sandbox SSH access
initially failed. No branch creation, reset, rebase, history rewrite, main
modification, force push or PR.

B0A, B0B, B1, B2, B3 booking/capacity, B3 same-day Admin assignment, B4, B5,
B6, B7, B8 and B9 remain accepted for Phase B progression. Their accepted policy
is not reopened. Read current checklist, Phase B plan, UI audit, verification
policy, content authority and accepted package reports, including B8/B9 and the
B9 owner policy. Historical transitional text does not override later acceptance.

## 2. Deferred Email Integration finding: result-email mutation omits current actor authorization

**Invariant:** the sensitive result-email action must reject an inactive user or
a user whose current role is no longer ADMIN, despite a previously issued valid
ADMIN token. The B10 authorization gate explicitly requires inactive-user and
wrong-role rejection. Existing grading, result finalization and B9 decision paths
recheck current active ADMIN authority; this email path does not.

**Classification:** previously uncovered authorization gap in the B0B/B8 result-email path, retained through B9. B10 introduced no production regression. **Owner scope decision, 2026-11-05:** email integration is collaborator-owned and not yet functional/accepted, so this finding is deferred to the dedicated Email Integration feature. It is a real known defect, but no longer blocks the B10 **core examination lifecycle** gate. Result-email queue/delivery/current-actor behavior must remain excluded from Phase B production-readiness claims.

**Affected source:**

- `backend/src/routes/exam.routes.ts`: send-email authenticates JWT and checks its role.
- `backend/src/middlewares/auth.middleware.ts`: authentication and `requireRole`
  use token claims; neither rereads current account role/activity.
- `backend/src/controllers/exam.controller.ts`, `confirmResultAndEmail`: forwards
  only application identity, omitting authenticated actor identity.
- `backend/src/services/exam.service.ts`, `confirmResultAndEmail`: forwards only
  application identity and the queue callback.
- `backend/src/repositories/exam.repository.ts`, `queueResultEmail`: locks the
  application and validates result/email evidence, but never resolves the actor.

**Executable reproduction:**
`backend/tests/unit/routes/exam-b10-result-email-authorization.test.ts`.
It runs the actual Express router, JWT/role middleware, controller, service and
repository. Only database delegates and external email handoff are controlled.
The synthetic B8 result is checked with actual `validatedResultBasis()` before
the request. No database connection, real email, Redis or SMTP is used.

1. Sign a valid expiring ADMIN token for the synthetic actor.
2. Set current user persistence to ADMIN/inactive, or APPLICANT/active.
3. POST `{}` to `/scores/:applicationId/send-email` for the valid B8 result.
4. Require HTTP 403, no queue handoff and no queued-evidence write.

| Actor persistence | Expected | Observed |
| --- | --- | --- |
| ADMIN, active (positive control) | 200; one queue handoff | PASS |
| ADMIN, inactive; earlier ADMIN JWT | 403; no handoff/write | **200; one handoff; one score queued-evidence write; zero actor lookups** |
| APPLICANT, active; earlier ADMIN JWT | 403; no handoff/write | **200; one handoff; one score queued-evidence write; zero actor lookups** |

Result: **1 passed / 2 failed**, process exit 1. The failing expectations are
deliberately committed as acceptance evidence, not skipped or inverted to claim
success. The mock handoff proves the production call boundary, not actual delivery.

**Recommended bounded correction:**
`EXAM-B8-CORR-1 — Result-email current actor authorization`.
Carry the authenticated actor through this existing action and revalidate current
active ADMIN authority within the locked repository transaction before enqueue or
the already-queued return. Preserve scoring, deterministic queue identity,
reconsideration/email containment, legacy result semantics and existing templates.
Require regression checks for active, inactive, demoted and absent actors.
This is a recommendation only; no correction was implemented or begun. The owner directed that the eventual correction be completed with the separate Email Integration feature rather than inside B10.

Unsupported email body fields were also inspected. Existing accepted B0B route
tests explicitly expect forged recipient/template fields to be ignored while
using server-selected recipient/template. That established behavior is not
silently reclassified or changed here. Reconcile the B10 strict-body matrix with
that accepted contract during review; the demonstrated current-actor defect is
independently sufficient to block B10.

## 3. Configured development database and safety

Owner-reported evidence: after pulling B9, the owner ran `npx prisma migrate
deploy` against local MySQL `graduate_system`; Prisma found 53 migrations,
applied `20261105010000_exam_amendments_reconsideration`, and reported all
migrations successfully applied. This is **owner-reported runtime evidence**,
not independently inspected migration state.

B10 ran no configured-database migration/deploy/reset/db-push, fixture insertion,
cleanup, import or configuration mutation. Existing B9 harness reads its protected
configured-table snapshot before/after. All its mutations and committed migration
deploys target its exact generated disposable database. Cleanup verified removal
of that exact generated database and zero remaining synthetic records.

Configured protected snapshot before/after:
`2da7a10cc8b91fdf49175b98b52db8e317157730117b0d310d1ebbb4f320e33e`.
This covers the harness's declared exam/configuration tables, not every database
table and not independent validation of the owner's migration report.

## 4. Executed commands and results

Commands below use the existing installed dependency baseline; no upgrade.

```powershell
# backend
npm test -- tests/unit --maxWorkers=4
npm run prisma:generate
npx prisma validate
npm run build
$env:EXAM_B9_DB_TEST = '1'
npm test -- tests/integration/exam-amendments-reconsideration-contention.test.ts --reporter=verbose
npm test -- tests/unit/routes/exam-b10-result-email-authorization.test.ts --reporter=verbose
# frontend
npx tsc --noEmit
npm run build
# root, evidence delivery only after STOP
git diff --check
```

| Evidence class | Actual result |
| --- | --- |
| Existing complete backend unit suite, before adding blocker regression | **258 files; 3,925 passed / 5 skipped / 0 failed**, 33.18 seconds |
| B9 real MariaDB harness | **51 passed / 0 failed / 0 skipped**, 16.84 seconds |
| New B10 authorization regression | **1 passed / 2 failed / 0 skipped**; acceptance blocker |
| All distinct executed test cases | **3,977 passed / 2 failed / 5 skipped** across those runs; no overall PASS |
| Prisma generate / validate | PASS; generated client reported v7.10.0, existing installation |
| Backend TypeScript/build | PASS |
| Frontend standalone TypeScript | PASS |
| Frontend production build | PASS; 68 pages generated |
| Frontend relevant/full ESLint | **NOT EXECUTED — stopped at functional blocker** |
| Standalone Phase A UI verifier | **NOT EXECUTED — stopped at functional blocker** |
| Complete integrated B10 journey/new harness | **NOT COMPLETED — stopped at functional blocker** |

The full unit suite was intentional for the explicitly requested final acceptance
gate. It includes directly affected controlled React/handler/contract tests,
content/media tests, authorization routes and COR/Admin Applicant regressions.
Five existing conditional skips remain skips, not passes. The full suite has not
been rerun after adding the deliberately failing B10 regression.

## 5. Cross-package evidence matrix

Paths in this matrix are relative to `backend/tests`; U = `unit`, I =
`integration`. Every named existing U test ran in the full unit command above.
All rows share the completed static/build checks in section 4; those checks are
not behavioral or browser evidence. Only the B9 I harness was rerun in B10.
Other I harnesses below identify remaining reruns, not claimed current PASS.

| Package/invariant | Executed automated verifier | Real-DB evidence in this B10 run | Owner scenario | Remaining limitation |
| --- | --- | --- | --- | --- |
| B0A answer/finality locks | U/repositories/exam-answer.repository.test.ts; U/controllers/exam-answer.controller.test.ts; U/services/exam-answer.service.test.ts | I/exam-answer-contention.test.ts rerun pending | D | Lock/rollback rerun pending |
| B0B pending result/email containment | U/services/exam-result.service.test.ts; U/routes/exam-result.routes.test.ts; U/services/applicant-results.contract.test.ts | B9 original-email/reconsideration test PASS; B8 harness rerun pending | F/I | Current-actor email blocker |
| B1 configuration | U/services/exam-configuration.rules.test.ts; U/repositories/exam-configuration.repository.test.ts; U/routes/exam-configuration.routes.test.ts; U/services/exam-configuration-ui.contract.test.ts | B9 fixture uses complete config; no complete B10 setup journey | A | Integration journey pending |
| B2 immutable membership/content/key/media | U/repositories/exam-question-set.repository.test.ts; U/routes/exam-question-set.routes.test.ts; U/repositories/exam-media.repository.test.ts | I/exam-question-set.test.ts rerun pending | A/F | Exact publication-to-attempt journey pending |
| B3 booking/capacity | U/services/exam-schedule.service.test.ts; U/routes/exam-schedule.routes.test.ts; U/services/exam-schedule-time.test.ts | B9 replacement versus booking and final replacement seat PASS | A/G/H | I/exam-booking-contention.test.ts last-seat admission rerun pending |
| B3 same-day Admin assignment | U/services/exam-assignment-ui.contract.test.ts; U/services/exam-schedule.service.test.ts | B9 no-retake/Admin-assignment blocks PASS | A | B3 mixed assignment/self-booking contention rerun pending |
| B4 start/deadline | U/repositories/exam-execution.repository.test.ts; U/routes/exam-execution.routes.test.ts; U/services/exam-execution-ui.contract.test.ts | B9 same-day Start/appeal and Start/cancel races PASS | B | I/exam-execution-contention.test.ts duplicate Start/restart rerun pending |
| B5 versioned drafts/recovery | U/routes/exam-draft.routes.test.ts; U/services/exam-draft-queue.test.ts; U/services/exam-execution-ui.contract.test.ts | B9 fixtures save actual drafts; dedicated race rerun pending | C/D | I/exam-draft-contention.test.ts and integrated reconnect/drain pending |
| B6 explicit/expiry finalization | U/routes/exam-finalization.routes.test.ts; U/services/exam-expiry-worker.test.ts; U/services/exam-execution-ui.contract.test.ts | B9 uses actual finalization in computed-result fixtures | D/E | I/exam-finalization-contention.test.ts explicit/expiry/startup/races rerun pending |
| B7 essay evaluation | U/routes/exam-essay-evaluation.routes.test.ts; U/services/exam-essay-evaluation-ui.contract.test.ts | B9 uses actual B7 grade-to-result path | F | I/exam-essay-evaluation-contention.test.ts graders rerun pending |
| B8 scoring/result/email | U/services/exam-result-scoring.rules.test.ts; U/routes/exam-result.routes.test.ts; U/services/exam-result-email-queue.test.ts | B9 valid computed FAILED and downstream projections PASS | F/I | I/exam-result-scoring-contention.test.ts full arithmetic/scoring/email race rerun pending; current-actor blocker |
| B9 missed appeals/amendments | U/routes/exam-amendment.routes.test.ts; U/services/exam-b9-ui.contract.test.ts | I/exam-amendments-reconsideration-contention.test.ts: appeal/release/approval/rejection/cancel/reschedule/history/targets/no-retake PASS | G/H | Owner execution pending |
| B9 reconsideration and effective pass | U/services/applicant-results.contract.test.ts; U/repositories/cor.repository.lifecycle.test.ts; U/repositories/admin-applicant.repository.test.ts | Same B9 I harness: decision immutability/concurrency, COR preliminary/transaction, profile, list/filter/count/detail, booking and preserved email PASS | I | Owner execution pending |
| Phase A content/media/rendering | U/services/exam-content-real-package.test.ts; U/services/exam-emphasis-real-map.test.ts; U/services/exam-media-access.test.ts; U/services/exam-media-client.contract.test.ts; U/services/applicant-exam-content.contract.test.ts | B2 exact private-reference retention rerun pending | A/B/F/J | Static contracts are not visual acceptance; standalone UI verifier pending |

## 6. Real MariaDB contention and complete-chain rehearsal

Executed B9 harness: MariaDB **10.4.32**, InnoDB; host default
REPEATABLE-READ; application transactions READ COMMITTED. Independent connections
waited on actual `FOR UPDATE`, observed through `SHOW FULL PROCESSLIST`, before
the holder was released. This is real database evidence, not mocked locking.

| Race | Observed connection IDs | Outcome |
| --- | --- | --- |
| Two Admin appeal approvals | 261 / 256 | One replacement |
| Start first / cancellation second | 264 / 259 | Started record protected |
| Cancellation first / Start second | 267 / 262 | Released record cannot start |
| Same-day Start versus appeal | 270 / 265 | B4 semantics retained |
| Prior-date appeal versus Start | 273 / 268 | B9 semantics retained |
| Replacement versus self-booking | 276 / 271 | No duplicate reservation |
| Sorted two-target reschedule | 279 / 274 | No target oversubscription |
| Two Students, last replacement seat | 282 / 277 | Only winner releases original seat |
| Concurrent reconsideration | 279 / 280 | One separate immutable decision |

The B9 harness deployed the full committed chain from the earliest migration
through pre-B9 into a fresh generated database, inserted representative legacy
and B5–B8 evidence, then deployed actual B9. Old appointment/counter/answer/
receipt/evaluation/scoring columns were preserved; seat release remained null
and both new B9 tables empty. `prisma migrate status` was up to date; repeated
isolated deploy reported no pending migrations. Original-column SHA-256:
`dbefc0b0ae6f3f11fe431c4b20998a48af73e07a6a5b27c22a43769a324d7831`.

**This proves full-chain applicability and the B9 cutover, not a completed
combined B4–B9 staged preservation gate.** The individual B4/B5/B6/B7/B8 staged
migration, duplicate Start, stale draft, draft/submit/expiry, expiry worker,
grader, duplicate-scoring and email-contention reruns stopped at the blocker.
No aggregate real-contention PASS is claimed for all B10 requirements.

## 7. Authorization, wrong-record and legacy gates

Existing U route suites for execution, drafts, finalization, essay grading,
results, question sets/configuration, media and amendments all passed in the
full unit run. They exercise actual JWT/role middleware and strict route/body/
ownership boundaries with controlled persistence. B9's real suite additionally
verifies wrong ownership, reason, current Admin, partial execution fields,
invalid targets, corrupt decisions and exact history.

The first-run authorization matrix exposed the deferred email defect above. For the resumed B10 core gate, enumerate and complete stale/wrong-record/current-actor coverage for **core examination mutations**. Do not count the result-email mutation in the core pass/fail matrix and do not claim it secure or accepted. Its diagnostic test/result remains historical evidence for the Email Integration feature.

Legacy evidence in the B9 real run: answer-bearing/score-bearing never-started
records reject amendments; historical FAILED without B8 basis rejects
reconsideration; ambiguous legacy APPEALED cannot acquire a new dedicated appeal
decision; migration does not fabricate release/amendment/decision evidence.
Existing unit suites cover legacy execution/finality/result truth. The full
B10 representative legacy gate (including staged B4–B8 no-fabrication checks)
remains pending. Historical records are not repaired or reinterpreted.

## 8. Phase A, warnings, logs and hosted CI

The full unit run includes `exam-content-real-package.test.ts`: **72 verified
questions / 108 actual images**, plus real emphasis-map, importer, content/media
privacy and controlled rendering regressions. No canonical import, source
regeneration, typography-map application or bank mutation occurred. This verifies
repository package content, not a fresh configured-bank reconciliation or owner
physical-source/browser acceptance.

Nonblocking warnings observed: Vitest/Vite native-config advisory; Next.js
middleware-to-proxy deprecation; Node `module.register()` deprecation. These are
warnings, distinct from the two failing authorization tests. No dependency or
framework upgrade was attempted.

Output captured only in OS temporary files: `exam-b10-unit-results.txt`,
`exam-b10-b9-db.txt`, `exam-b10-frontend-build.txt`, and
`exam-b10-authorization-reproduction.txt`. No new repository-root or other
repository B10 logs. Pre-existing user log files were retained.

**Hosted CI: NOT EXECUTED / no hosted PASS claimed**.
The current workflow triggers main pushes and PRs targeting main, neither of
which is part of this package. Exact pushed-commit hosted workflow/status evidence
is checked at delivery and reported in the final chat. Local checks do not imply
hosted success. No new PR or CI workflow change.

## 9. Owner manual/browser checklist — pending, not acceptance evidence

**Project-owner manual/browser QA: PENDING OWNER EXECUTION.** The resumed B10 checklist applies to the core examination lifecycle only. Codex performed no owner/browser QA. Email sending/queue/delivery scenarios are explicitly deferred to the separate Email Integration feature and are not required for core B10 acceptance.

Use separate ordinary UI-created Applicants for mutually exclusive journeys.
Record exact application/schedule identity and expected/actual outcome per row.
Use only synthetic accounts controlled by the owner. No direct configured-DB SQL,
machine-clock alteration, fabricated dates or Codex-inserted manual fixtures.
If unavailable, replace the relevant pending entry with
`NOT EXECUTED — prerequisite data unavailable`; never mark it PASS.

| Journey / scenario | Prerequisite, action and expected observation | Status |
| --- | --- | --- |
| A1 Configuration | Admin → Exam Questions → Exam Configuration. Inspect duration, MCQ points, essay maximum and percentage; validate invalid/empty fields, save and reopen exact values. No invented defaults. | PENDING OWNER EXECUTION |
| A2 Incomplete settings | On a separate eligible booked Applicant, attempt Start with incomplete settings; no start/deadline. Restore valid settings through UI before further journeys. | PENDING OWNER EXECUTION |
| A3 Publish | In Question Set, review deterministic selected membership and exactly one owner-approved essay; save then publish. Do not regenerate/re-import canonical content. | PENDING OWNER EXECUTION |
| A4 Self-booking | Eligible registered Applicant books a future same-Program active slot; verify original Manila date/time, booked count and reduced remaining capacity on both roles. | PENDING OWNER EXECUTION |
| A5 Same-day assignment | If available, Admin → Exam Records → Assign Applicant; search eligible unbooked Applicant, select today's active slot with capacity, review and confirm. One record and one seat. | PENDING OWNER EXECUTION |
| B1 Normal/late Start | At/after today's scheduled time, Applicant explicitly starts. Same-day late entry needs no different-date appeal. Original appointment remains; deadline equals actual start plus captured duration. | PENDING OWNER EXECUTION |
| B2 Early authorization | With a separate early appointment today, Start is blocked; Admin authorizes exact record. Timer starts only when Applicant starts, not at authorization. | PENDING OWNER EXECUTION |
| B3 Recovery/clock | Refresh, reopen and reconnect active exam; same application/deadline/content. Test browser-local wall-clock offset via a browser-only supported mechanism if practical, without changing machine clock; authority must not extend. | PENDING OWNER EXECUTION |
| C1 MCQ persistence | Select, wait for Saved, change, wait, then Clear answer and wait. Refresh after each acknowledgment; exact choice/clear and navigator state return. | PENDING OWNER EXECUTION |
| C2 Essay persistence | Type continuously beyond save max-wait; observe truthful save state. Refresh after Saved. Clear to blank, wait, reopen; blank remains. | PENDING OWNER EXECUTION |
| C3 Reconnect/conflict | With separate tabs/device, save a newer answer; reconnect a stale editor. Observe resync/conflict, preserved unsaved text and explicit refresh behavior. No stale overwrite. | PENDING OWNER EXECUTION |
| C4 Final drain | Type then immediately request Submit; pending saves resolve before confirmation/finalization. Failed/conflicting save prevents misleading readiness. | PENDING OWNER EXECUTION |
| D1 Incomplete cancel | Leave unanswered items, open Submit warning, verify count/consequence, cancel. No receipt or finalization; editing resumes. | PENDING OWNER EXECUTION |
| D2 Incomplete confirm | Reopen warning and acknowledge. Receipt records original application, answer counts and Applicant submission; unanswered items remain unanswered. Refresh recovers same receipt; editing is unavailable. | PENDING OWNER EXECUTION |
| D3 Complete submit | Separate complete attempt: submit, inspect receipt, refresh/reopen and retry response recovery. Same receipt, no later edits. | PENDING OWNER EXECUTION |
| E1 Closed-browser timeout | Start another attempt with known saved choice/essay/clear. Close/disconnect browser before deadline, leave backend running, reopen after deadline and sweep interval. Stable TIME_EXPIRED receipt, last acknowledged state only. | PENDING OWNER EXECUTION |
| E2 Catch-up | If an owner-controlled environment can safely restart backend, leave a started attempt overdue during downtime; restart and reopen. TIME_EXPIRED processing time is truthful; never-started appointment is untouched. | PENDING OWNER EXECUTION |
| F1 Essay review | Admin opens finalized exact record: frozen prompt and exact response, including No response submitted for blank/missing. Later mutable bank edits must not replace prompt. | PENDING OWNER EXECUTION |
| F2 Evaluation | Enter valid decimal/zero where practical; reject negative/over captured maximum. Save once; second grading attempt cannot overwrite. Evaluator/time and result are read-only. | PENDING OWNER EXECUTION |
| F3 Scoring/projection | Owner selects known settings/sample answers. Compare exact expected calculation, equality/below-threshold outcome and identical Admin/Applicant displayed breakdown. Later configuration/Program/bank edits do not alter old result. | PENDING OWNER EXECUTION |
| F4 Result email | Collaborator-owned email integration is not yet functional/accepted. Current-actor authorization, queue startup, repeat behavior and delivery belong to the dedicated Email Integration feature. Preserve the known B10 diagnostic finding; do not exercise or claim this path in core B10. | DEFERRED — EMAIL INTEGRATION FEATURE |
| G1 Same-day boundary | Today's late never-started record has no missed-appeal action; use B4 normal Start. | PENDING OWNER EXECUTION |
| G2 Prior-date filing | Requires an actual prior-Manila-date never-started appointment. Applicant files exact reasoned appeal. APPEALED, original seat releases once, no replacement yet. | PENDING OWNER EXECUTION |
| G3 Approval | Admin selects active future same-Program target with capacity and provides reason. Old RESCHEDULED, new PENDING linked; old appointment unchanged; exact old/new seat counts. | PENDING OWNER EXECUTION |
| G4 Rejection | Separate pending appeal: reject with reason. Old MISSED, no replacement and no further ordinary booking/assignment. | PENDING OWNER EXECUTION |
| H1 Cancel | Eligible never-started record: reasoned Admin cancellation. CANCELLED, one release, unchanged historical date/time, no replacement; repeat cannot release again. | PENDING OWNER EXECUTION |
| H2 Reschedule | Separate never-started record: choose valid future target and reason. Old RESCHEDULED/new PENDING with linked original history and exact counters. | PENDING OWNER EXECUTION |
| H3 Started protection | Started/finalized records expose no cancel/reschedule actions and reject attempted stale actions. | PENDING OWNER EXECUTION |
| I1 Reconsideration | Valid B8 computed FAILED: Admin → exact Exam Record → Reconsider Result; required reason and confirmation. One PASSED — RECONSIDERED decision with actor/time. | PENDING OWNER EXECUTION |
| I2 Preserved result | Compare before/after answers, MCQ/essay/total, threshold, basis/scored time and raw FAILED. Separate institutional pass appears; Applicant sees no internal reason. | PENDING OWNER EXECUTION |
| I3 Propagation | Applicant Result/profile/COR next step, Admin Applicants stage/filter/count/detail recognize effective pass. Complete owner-controlled COR verification if appropriate. No retake/scheduling permission. | PENDING OWNER EXECUTION |
| I4 Email | Reconsideration-specific email/queue behavior is outside core B10 because email integration is deferred. The B9 rule that no new reconsideration template is introduced remains documented, but no email QA PASS is required here. | DEFERRED — EMAIL INTEGRATION FEATURE |
| J1 Responsive | At desktop and narrow/mobile widths inspect Question Bank, booking, active exam, receipt, Admin record/actions and Results. Critical controls/readable content remain visible without clipping. | PENDING OWNER EXECUTION |
| J2 Keyboard/dialog | Tab order/focus, labeled controls, dialog focus return, Escape/cancel, disabled/loading duplicate protection and error/retry states are clear on those pages. | PENDING OWNER EXECUTION |

Timing prerequisites such as early, prior-date, cross-midnight or overdue records
must exist through legitimate UI/history. If unavailable, document the missing
prerequisite rather than altering configured data or clocks. Historical B3 owner
QA remains recorded in its accepted report; it does not substitute for executing
the new consolidated checklist.

## 10. Delivery, limitations and stop

New test-only file: `backend/tests/unit/routes/exam-b10-result-email-authorization.test.ts`.
Documentation: this report plus B10 blocker pointers in checklist, Phase B plan
and UI audit. No runtime changes, new migration, dependency/lockfile update,
canonical content change, UI redesign or generated repository log.

Normal commit/push is restricted to the existing feature branch. The final chat
records the exact evidence commit and verified local/tracking/live feature HEAD,
changed-file list, clean worktree and ahead/behind result. It is the final live
HEAD record for this report, avoiding an impossible self-referential commit hash.

No complete normal/timeout B10 journey, all-race gate, all-stage migration
preservation, full wrong-record matrix, lint gate, owner QA or production cutover
acceptance is claimed. Background expiry availability/latency, committed migration
deployment elsewhere, private-media storage and backups, retained BullMQ identity,
and real Redis/SMTP delivery remain operational/cutover concerns. Legacy unknown
authority stays unknown; no generic retake, revoke/regrade or new notification.

**B10 CORE EXAM GATE RESUMPTION AUTHORIZED — EMAIL INTEGRATION DEFERRED.** The known result-email authorization defect remains open for the dedicated Email Integration feature and must not be represented as fixed or production-ready. Resume the remaining automated/static/real-DB/legacy/content gates for the core examination lifecycle. Project-owner manual/browser QA: **PENDING OWNER EXECUTION** for the non-email journeys. B10 is not yet accepted and Phase B is not complete.

## 11. Resumed core gate — 2026-11-05

### 11.1 Baseline, owner scope and protected changes

Local HEAD, upstream and live feature HEAD all matched
`a54fb13591ca82441e9888c1f3c2ababdf5b9156`; local/tracking/live main remained
`a6dc6f57c6e8130482c814e90703765972fddaa9`. Worktree clean, feature 49 ahead /
0 behind main, tracking divergence 0/0. Live refs were verified with
`git ls-remote origin`. Fully reread the updated checklist, Phase B plan, UI audit
and this report before resuming automation.

Owner decision: **CORE EXAM GATE RESUMPTION AUTHORIZED — EMAIL INTEGRATION DEFERRED**.
Removed `backend/tests/unit/routes/exam-b10-result-email-authorization.test.ts`
from the active suite exactly as requested. Its expectations were neither inverted
nor skipped. Original reproduction, source, observed 200/queue/write and
1-positive/2-negative-failure evidence remain in section 2 and in commit
`16abd17fb8c97c8582e24411bcb0098101052e3f`. Removal is a scope decision,
**not a fix**. The final sentence in section 2 about blocking describes the first
run only; the owner decision supersedes it for core acceptance.

The separate collaborator-owned Email Integration feature remains responsible
for current actor authorization, queue/worker startup, Redis/BullMQ, SMTP,
delivery/retries/failures, recipients/templates and operational visibility.
Neither result-email mutation nor delivery is part of the core PASS claim.
Existing email-related checks embedded in accepted suites were left intact;
their execution supplies no Email Integration acceptance or security claim.

Production runtime source, schema, all 53 migrations, dependencies/lockfiles,
canonical questions/assets/emphasis, email code and frontend code are unchanged
from the resume baseline. No new branch, main modification, reset, rebase, force
push, PR or merge. No new core functional defect was reproduced.

### 11.2 Exact final automated results

| Gate | Final resumed result |
| --- | --- |
| Complete backend unit suite, including 33 additional core HTTP cases | **258 files PASS; 3,958 passed / 0 failed / 5 skipped**; 30.33 seconds |
| Standalone Phase A UI verifier | **11 passed / 0 failed / 0 skipped** |
| B3 real DB | **18 passed / 0 failed / 0 skipped** |
| B6 real DB outer harness | **20 passed / 0 failed / 0 skipped**: 19 direct checks + one regression wrapper |
| B5, nested under B6 | **11 passed**: 10 direct checks + one B4 wrapper |
| B4, nested under B5 | **11 passed**: nine direct checks + B0A and B2 wrappers |
| B0A, nested under B4 | **5 passed**, against the parent's generated disposable DB |
| B2, nested under B4 | **4 passed**, with its own generated disposable migration DB |
| B7 real DB | **26 passed / 0 failed / 0 skipped** |
| B8 real DB, extended with three B10 journeys | **36 passed / 0 failed / 0 skipped**; original 33 + three integrated journeys |
| B9 real DB | **51 passed / 0 failed / 0 skipped** |
| Frontend standalone `tsc --noEmit` | PASS |
| Relevant frontend ESLint | **FAIL: one existing error, five warnings**; see 11.8 |
| Frontend production build | PASS; 68 pages generated |
| Prisma generate/validate and backend build | First-run PASS retained; corresponding production/schema/dependency files are unchanged, so no duplicate run |
| `git diff --check` | PASS |

Top-level DB invocations contain **151 passing harness checks**. Nested runners
are reported separately above, not added to that top-level total. Across the nine
distinct DB suites there are **178 direct checks**, excluding four wrapper checks;
this is not added again to 151. Some unchanged suites contain incidental deferred
email checks; these totals are execution counts, not a core-only email acceptance.
The five existing environment-conditional unit skips remain skips, not passes.

The new test-only integration cases reuse the B8 disposable setup, real services
and repositories. A first attempt omitted a real-client argument for one internal
B2 assertion; the harness was corrected. A new missing-record unit fixture initially
returned a locking row for an absent application; it was corrected to return zero
rows. Neither was a production defect; no runtime behavior or guard was changed.
Only the final successful runs above establish PASS.

### 11.3 Commands and reproducible harness routing

Run database harnesses sequentially so protected source snapshots do not overlap.
Each direct harness generates and removes only its exact disposable database.
Do not run B0A alone against the configured URL; B4 supplies its isolated parent.

```powershell
# backend
npm test -- tests/unit --maxWorkers=4
$env:EXAM_B3_DB_TEST = '1'
npm test -- tests/integration/exam-booking-contention.test.ts --reporter=verbose
$env:EXAM_B8_DB_TEST = '1'
npm test -- tests/integration/exam-result-scoring-contention.test.ts --reporter=verbose
$env:EXAM_B6_DB_TEST = '1'
npm test -- tests/integration/exam-finalization-contention.test.ts --reporter=verbose
# B6 -> B5 -> B4 -> B0A and B2, with DATABASE_URL set by each parent
$env:EXAM_B7_DB_TEST = '1'
npm test -- tests/integration/exam-essay-evaluation-contention.test.ts --reporter=verbose
$env:EXAM_B9_DB_TEST = '1'
npm test -- tests/integration/exam-amendments-reconsideration-contention.test.ts --reporter=verbose
# frontend
npx tsc --noEmit
npx eslint 'src/app/(portal)/admin/exam' 'src/app/(portal)/applicant' src/components/admin/exam src/components/exam-content src/lib/exam-configuration.ts src/lib/exam-question-set.ts src/lib/exam-execution.ts src/lib/exam-drafts.ts src/lib/exam-media.client.ts src/lib/exam-content.ts src/lib/applicant-exam-content.ts src/lib/exam-record-state.ts src/lib/admin-exam-schedules.ts
node --test scripts/verify-exam-content-6-ui-follow-up.mjs
npm run build
# root
git diff --check
```

The accepted nested commands use the same Node/Vitest binary, exact suite path,
opt-in environment and generated parent `DATABASE_URL`; their assertions require
the recorded nested pass counts. No configured-database deploy/reset/db-push.

### 11.4 Integrated core journeys and cross-package evidence

Three new cases in `tests/integration/exam-result-scoring-contention.test.ts`:
`B10 configuration/publication/booking/start/recovery/{complete,incomplete,timeout}/evaluation/result journey`.
They create isolated Applicant identities and use actual configuration replacement,
B2 saved selection/publication, slot creation, booking, B4 start, versioned drafts,
B6 finalization/sweep, B7 grading and B8 result projections. No second scorer,
finalizer or booking implementation is embedded in the tests.

They verify pre-schedule start rejection, normal server start at the scheduled
instant, captured 60-minute deadline, deterministic exact published membership,
Applicant key/privacy allowlist, exact private media reference, MCQ save/clear/
change, blank/edit essay, stale revision rejection, fresh-instance draft/execution
recovery, no result before completion, preserved frozen config/key/prompt after
live edits, explicit incomplete rejection/acknowledgment, stable receipt/retry,
later write rejection and byte-identical final answers. Timeout advances the
**test-only JavaScript Date clock**, runs the actual sweep with no browser,
and repeats it without another finalization. It never changes the machine clock
or development database. Complete scoring passes at exact 75% equality;
incomplete and timed-out cases fail below threshold. Fractional points are exact;
both roles receive the same persisted breakdown. Browser reconnect/drain is
additionally covered by the existing executable queue/React tests, not inferred
from the database journey.

In the matrix below, paths are relative to `backend/tests`, U = `unit`, I =
`integration`. Every named U file ran in the final complete suite. All behavioral
rows passed; the shared frontend lint limitation in 11.8 prevents overall gate PASS.
Owner letters refer to section 9, which remains pending except deferred F4/I4.

| Package/invariant | Actual automated verifier/harness | Proven core authority | Owner/limitation |
| --- | --- | --- | --- |
| B0A answer/finality | U/repositories/exam-answer.repository.test.ts; U/controllers/exam-answer.controller.test.ts; I/exam-answer-contention.test.ts (nested 5) | Type/member/payload containment, terminal locking, both draft/final orders and rollback | D pending |
| B0B result containment | U/services/exam-result.service.test.ts; U/routes/exam-result.routes.test.ts; U/services/applicant-results.contract.test.ts; B10 journeys | Pending/inconsistent result unavailable; no fake FAILED | F pending; email deferred |
| B1 configuration | U/services/exam-configuration.rules.test.ts; U/routes/exam-configuration.routes.test.ts; U/repositories/exam-configuration.repository.test.ts; B10 journeys | Strict typed settings, complete new-start requirement, captured basis | A pending |
| B2 content authority | U/repositories/exam-question-set.repository.test.ts; U/routes/exam-question-set.routes.test.ts; I/exam-question-set.test.ts (nested 4); B10 journeys | Explicit membership, immutable correctness/order/media, real restrictive FKs, one essay | A/F pending |
| B3 booking/capacity | U/routes/exam-schedule.routes.test.ts; U/services/exam-schedule.service.test.ts; I/exam-booking-contention.test.ts (18) | Last seat, same Student, rollback, counters, original appointment | A pending |
| B3 same-day assignment | U/services/exam-assignment-ui.contract.test.ts; same B3 I harness | Same-day past-time exception, unchanged original time, mixed self/Admin contention, exact capacity | A pending |
| B4 timing/execution | U/repositories/exam-execution.repository.test.ts; U/routes/exam-execution.routes.test.ts; U/services/exam-execution-ui.contract.test.ts; I/exam-execution-contention.test.ts (nested 11) | Early authorization, normal/late same-date start, different-date rejection, stable actual-start/deadline, across midnight, wall-clock-independent monotonic UI | B pending |
| B5 drafts/recovery | U/routes/exam-draft.routes.test.ts; U/services/exam-draft-queue.test.ts; U/services/exam-execution-ui.contract.test.ts; I/exam-draft-contention.test.ts (nested 11); B10 journeys | Select/change/null clear, essay blank/edit, version conflict, recovery/reconnect/drain, no local-storage authority | C/D pending |
| B6 explicit/timeout | U/routes/exam-finalization.routes.test.ts; U/services/exam-expiry-worker.test.ts; I/exam-finalization-contention.test.ts (20); B10 journeys | Acknowledgment, stable receipt, no fabricated answer, boundary precedence, no-browser expiry, restart catch-up and repeated workers | D/E pending |
| B7 essay | U/routes/exam-essay-evaluation.routes.test.ts; U/services/exam-essay-evaluation-ui.contract.test.ts; I/exam-essay-evaluation-contention.test.ts (26) | One essay, exact frozen prompt/response/max, missing/blank truth, zero/decimal/max bounds, one evaluator | F pending |
| B8 scoring/projection | U/services/exam-result-scoring.rules.test.ts; U/services/exam-record-detail.service.test.ts; I/exam-result-scoring-contention.test.ts (36) | Frozen points/max/threshold/key, exact Decimal, equality PASS/below FAIL without rounding, raw-count mismatch fail-closed, config/bank/Program independence, matching role numbers | F pending; email excluded |
| B9 appeals/amendments | U/routes/exam-amendment.routes.test.ts; U/services/exam-b9-ui.contract.test.ts; I/exam-amendments-reconsideration-contention.test.ts (51) | Prior-date filing, same-day Start boundary, one release, reasoned target/capacity/approval/rejection, direct cancel/reschedule, preserved history/no retake | G/H pending |
| B9 reconsideration | U/services/applicant-results.contract.test.ts; U/repositories/cor.repository.lifecycle.test.ts; U/repositories/admin-applicant.repository.test.ts; same B9 I harness | One decision, unchanged original FAILED/answers/numbers/basis/scoredAt, Result/profile, COR preliminary+transaction, Admin list/count/filter/detail, scheduling block | I pending; I4 deferred |
| Phase A | U/services/exam-content-real-package.test.ts; U/services/exam-emphasis-real-map.test.ts; U/services/exam-media-access.test.ts; U/services/exam-media-client.contract.test.ts; U/services/applicant-exam-content.contract.test.ts; standalone frontend verifier | 72 VERIFIED questions, 108 real images, canonical source checks, emphasis/rendering/private-media contracts; 11 standalone UI checks | A/B/F/J pending; no owner visual PASS |

### 11.5 Real InnoDB race matrix

MariaDB **10.4.32**, InnoDB; host default REPEATABLE-READ. Accepted mutations
explicitly use READ COMMITTED. Independent worker connections execute actual
parameterized `FOR UPDATE`; harnesses observe blocked queries through
`SHOW FULL PROCESSLIST` before releasing the first holder.

| Core race | Passing actual verifier | Resumed-run observed connections where printed |
| --- | --- | --- |
| Last seat / two Applicants | B3 `two Applicants contend for the final seat` | 542 / 528 |
| Self-booking versus Admin assignment | B3 `Admin and Applicant self-booking share the same Student lock` | 529 / 525 |
| Duplicate Start | Nested B4 `concurrent Start` case | Nested runner asserts independent IDs and actual wait; stdout retained internally by parent |
| Stale draft | Nested B5 MCQ/essay competing-revision cases | Nested runner asserts actual wait |
| Draft versus submit | B6 `draft lock first` and `explicit lock first` cases | 644 / 654; 650 / 657 |
| Submit versus timeout | B6 explicit-first/expiry-first and wait-across-deadline cases | 661 / 648; 667 / 651; 670 / 663 |
| Draft versus expiry | B6 expiry-first and delayed-draft cases | 658 / 660; 650 / 666 |
| Expiry worker concurrency | B6 `two independent sweep services recover one result` | 670 / 669 |
| Concurrent essay graders | B7 `two real concurrent ADMIN evaluations` | 1049 / 1045 |
| Duplicate scoring/finalization | B8 `competing exact-application scorers`; B6 submit/submit | 612 / 603; 655 / 645 |
| Same-day/prior-date appeal versus Start | B9 `same-day-start` / `prior-date-appeal` | 1102 / 1096; 1105 / 1099 |
| Cancel versus Start, both orders | B9 `start-first` / `cancel-first` | 1095 / 1090; 1098 / 1093 |
| Replacement versus booking | B9 `reschedule and Applicant booking share the Student lock` | 1108 / 1101 |
| Two Admin appeal approvals | B9 `two Admin approvals serialize` | 1092 / 1087 |
| Two-slot reschedule | B9 `two-target-slot contention uses sorted slots` | 1111 / 1104 |
| Last replacement seat | B9 `two Students competing for the final replacement seat` | 1114 / 1107 |
| Concurrent reconsideration | B9 `two concurrent Admin reconsiderations` | 1111 / 1109 |

B6's separate Node startup process caught up an overdue examination and preserved
the last acknowledged response; receipt `d02e5546-0034-4b4c-8843-1e27c647d49e`.
This is automated restart evidence, not owner/manual restart QA. Email queue races
are excluded from this core matrix even when unchanged suites execute them.

### 11.6 Migration chain, legacy integrity and configured-data protection

The accepted B4/B5/B6/B7/B8/B9 migration harnesses were rerun (B4/B5 nested).
Each starts with a generated empty database, deploys the full committed prefix
from the earliest migration, inserts representative pre-cutover evidence,
applies its exact cutover migration, compares all original projected values,
then applies successors through B9. `prisma migrate status` and a second isolated
deploy verify up-to-date/no pending migrations. No new migration is needed.
This is staged preservation evidence across fresh databases, not a claim that
all cutover fixtures were inserted into one database at once.

| Cutover | Preserved / not fabricated |
| --- | --- |
| B2 (nested) | Existing questions/options/media/import/answers; initially empty selection/revisions; restrictive historical identity/media retention |
| B4 (nested) | Unbound clean and answer-bearing PENDING, legacy TAKEN; all six new start/authorization/deadline/content/config fields remain null |
| B5 (nested) | Original answer text/choice and application history; revision zero is technical baseline, not an invented edit history |
| B6 | Started/legacy/pending score and saved drafts preserved; historical receipt/time/reason/counts stay null |
| B7 | Legacy TAKEN/PASSED/FAILED scores preserved; no fabricated essay evaluation timestamp |
| B8 | Existing receipts/evaluation/answer revisions and null-threshold bindings preserved; no fabricated scoredAt/basis or historical denominator |
| B9 | Future/past unbound PENDING, old APPEALED, legacy FAILED, B8 PASSED/FAILED and existing B5–B8 evidence preserved; no seat-release/amendment/reconsideration backfill |

Original-column SHA-256 values printed by direct resumed harnesses:

- B6: `c980ec7172d553a0052549833229389984668b2055f2e3d9dfa4f764fcbafed1`.
- B7: `75802877ee8bae2efd67ded7c9c4c13ad989f20db7031aba5af500b42ca28666`.
- B8: `83ccbc42e52a393d9a917aafafdb468b93673f66428e9471f8b71bf05c3f1edb`.
- B9: `6796a917dbf35b0bc2f641efe9024f1e9cb1b68a06ed3ee15150a6fdc9cb92cf`.

Runtime legacy checks fail closed for unsafe new starts/answers/grades/scoring/
amendments and reconsideration, while valid historical results retain recorded
status/totals with unknown provenance/maxima/threshold. Old APPEALED records do
not become new reasoned appeals. B2's real reference tests and B10's exact-bound
media checks retain private question/option/media identities without source reimport.

Configured protected snapshot before/after direct B6/B7/B8/B9 harnesses:
`2da7a10cc8b91fdf49175b98b52db8e317157730117b0d310d1ebbb4f320e33e`.
B3's wider/different protected projection:
`0d93df51584448813dd62ff3350c4ed75ec9633e910f3c9e7c94559b27fe3b2e`.
Nested B0A runs only on its generated parent; nested B2 creates a separate generated
database. All exact cleanup/absence assertions passed. No configured fixtures,
deploy, reset, db-push or cleanup. The owner's reported 53 applied dev migrations
remain owner-reported evidence, not independently inspected migration state.

### 11.7 Core authorization / wrong-record matrix

All route suites below execute real Express/JWT/role/controller paths; core
transaction/read/write boundaries use controlled persistence. Database race and
cross-package authority evidence is independently covered by the real suites.
Added **33 core cases** across five existing route files. No email diagnostic is
in this matrix. Admin record access to another Applicant is legitimate Admin
authority, not a wrong-ownership failure; Applicant routes use exact JWT ownership.

| Core mutation | Actual verifier(s) and passed negatives | Current persistence behavior / applicability |
| --- | --- | --- |
| Self-booking | `exam-schedule.routes.test.ts`, `exam-schedule.service.test.ts`, B3 DB: anonymous/wrong role, forged Student/Program, malformed slot/body, foreign Program, inactive/full/past/drifting slot, blocking status | JWT user resolves Student; no general current-role/activity lookup is claimed for this accepted B3 path |
| Same-day assignment | Same suites plus assignment UI/B3 DB: anonymous/wrong JWT role, malformed selected Student/slot, forged capacity/time, invalid registration/alignment/Program/status/date | Selected Applicant role/registration is revalidated; no current Admin activity lookup is claimed where the path relies on JWT role |
| Start authorization | `exam-execution.routes.test.ts`, execution repository suite: malformed/missing ID, unsupported timing/config, stale started/terminal state, inactive/demoted Admin | New B10 cases prove current active ADMIN check before execution writes |
| Applicant Start | Same execution suites: anonymous/wrong role/owner, malformed/missing exact ID, unsupported body, stale state/date/binding, inactive/demoted Applicant | Current Applicant identity is revalidated before new execution |
| Draft write | `exam-draft.routes.test.ts`, answer repository: anonymous/wrong role/owner, malformed/missing application, foreign question/option/type, forged authority, stale revision/state, inactive/demoted Applicant | Current identity checked under active binding; no upsert on rejection |
| Submit | `exam-finalization.routes.test.ts`: anonymous/wrong role/owner, malformed exact ID/body, forged answers/actor/time/status authority, incomplete acknowledgment, stale terminal/partial receipt, inactive/demoted active Applicant | Before deadline current identity is required. At expiry, persisted execution may close despite later inactivity, per accepted B6 policy; this is not a fresh-start bypass |
| Essay evaluation | `exam-essay-evaluation.routes.test.ts`: anonymous/wrong JWT role, malformed/missing exact record, unsupported score/status fields, stale/nonfinal/partial evidence, invalid grade, inactive/demoted evaluator | Current active ADMIN required; Admin may grade another Applicant's exact authorized record |
| Finalize Result | Same suite and B8 DB: anonymous/wrong JWT role, malformed/missing record, unsupported scoring body, pending/corrupt/legacy basis, inactive/demoted Admin | New B10 cases prove current ADMIN check; valid completed repeat is idempotent by policy |
| Missed appeal | `exam-amendment.routes.test.ts`, B9 DB: anonymous/wrong role/owner, malformed/missing ID, forged actor/time/status/score, empty/oversized reason, stale TAKEN/same-day/started state, inactive/demoted Applicant | Current owned Applicant required; new missing/stale cases verify no schedule writes |
| Approve/reject appeal | Same suite/B9 DB: anonymous/wrong role, malformed/missing ID, unsupported authority/reason/target, stale TAKEN/duplicate decision/invalid targets, inactive/demoted Admin | Current ADMIN required; no double release/replacement |
| Cancel/reschedule | Same suite/B9 DB: anonymous/wrong role, malformed/missing ID, unsupported authority, stale TAKEN/started/finalized, invalid target/capacity/history, inactive/demoted Admin | Current ADMIN required; new route cases assert no application/seat writes |
| Reconsideration | Same suite/B9 DB: anonymous/wrong role, malformed/missing ID, client actor/time/status/score/basis, missing reason, stale TAKEN/PASSED/legacy/corrupt/prior decision, inactive/demoted Admin | Current ADMIN and valid B8 FAILED required; one separate decision, raw FAILED unchanged |

Malformed vs stale/missing cases use the accepted bounded 400/403/404/409
responses. Tests do not introduce a global session-revocation policy or broaden
current-account checks beyond the production paths named above. Result-email
current-actor authorization remains the explicitly known deferred defect.

### 11.8 Frontend static gate, warnings and remaining acceptance issue

`npx tsc --noEmit`: PASS. Production `npm run build`: PASS, 68 pages. Directly
affected React/handler/queue/contract tests ran in the full backend unit suite.
Standalone Phase A `node --test scripts/verify-exam-content-6-ui-follow-up.mjs`:
**11/11 PASS**, preserving pagination and neutral/shared semantic rendering.
Read-only canonical content/real-emphasis tests also passed in the unit suite:
**72 VERIFIED questions / 108 actual images**. No content or image changed.

The exact declared relevant ESLint command in 11.3 exits **1**:

```text
frontend/src/components/exam-content/applicant-appointment-gate.tsx
137:37 error: apostrophe must be escaped (react/no-unescaped-entities)
```

The text is `the missed appointment's seat; staff choose any approved` in the
missed-appeal dialog. `git show a54fb13591ca82441e9888c1f3c2ababdf5b9156:<path>`
confirms the same text existed at the resume baseline. This is a production JSX
lint error, **not a new core functional defect or merely a warning**. No rule was
disabled and the file was not excluded to manufacture a PASS. No runtime source
edit was authorized, so it remains unchanged. A separately authorized bounded
presentation correction is needed before the requested full core automated PASS
can be recorded; no correction package was begun.

Five existing nonfatal unused-variable/import warnings: Applicant alignment's
`isWaiverLoading`; Dashboard's `Button`/`Download`; Applicant layout's
`useEffect`/`setUnreadNotifications`. Existing Vite config and Next middleware/
Node module-registration advisories are nonblocking. No framework/dependency
upgrade or unrelated cleanup.

**No new core functional blocker was found. The overall B10 core automated
gate remains INCOMPLETE because the declared ESLint gate failed.** The success
wording requested by the owner is conditional on all gates passing and is not used.

### 11.9 Delivery, owner QA, hosted CI and stop

Section 9's core journeys remain **PENDING OWNER EXECUTION**. F4 and I4 remain
**DEFERRED — EMAIL INTEGRATION FEATURE**, not owner prerequisites for core B10.
No browser automation, screenshot or controlled React test is called owner QA.
Independent review remains pending. Phase B is not complete; no production-ready
system or accepted Email Integration claim is made.

Exact resume changes:

```text
M backend/tests/integration/exam-result-scoring-contention.test.ts
M backend/tests/unit/routes/exam-amendment.routes.test.ts
D backend/tests/unit/routes/exam-b10-result-email-authorization.test.ts
M backend/tests/unit/routes/exam-draft.routes.test.ts
M backend/tests/unit/routes/exam-essay-evaluation.routes.test.ts
M backend/tests/unit/routes/exam-execution.routes.test.ts
M backend/tests/unit/routes/exam-finalization.routes.test.ts
M docs/superpowers/GSIS_IMPLEMENTATION_CHECKLIST.md
M docs/superpowers/plans/2026-11-01-exam-engine-scheduling-phase-b.md
M docs/superpowers/reports/2026-11-05-exam-b10-lifecycle-acceptance.md
M docs/superpowers/ui-ux/UI_UX_AUDIT.md
```

Long outputs use only OS-temp `exam-b10-resume-{units,b3,b6,b7,b8,b9,frontend-lint,build}.txt`.
No new `.log` or `.txt` artifact inside the repository; pre-existing user files
remain. Generated databases and temporary migration directories were removed by
the exact harness cleanup. Normal commit/push remains on the existing branch;
the final chat records exact local/tracking/live HEAD, unchanged main,
ahead/behind and clean-worktree evidence without a self-referential commit hash.

**Hosted CI: NOT EXECUTED / no hosted PASS claimed.** Exact pushed-commit
workflow/status queries are checked at delivery and reported in the final chat.
Current workflow triggers main pushes and PRs targeting main; neither is created.

**STOP after evidence delivery.** A bounded authorization is needed for the
existing lint error before resuming the final automated PASS decision. No new
implementation package is started. Email Integration remains
**DEFERRED — NOT PART OF B10 CORE ACCEPTANCE**; its known security finding is open.
