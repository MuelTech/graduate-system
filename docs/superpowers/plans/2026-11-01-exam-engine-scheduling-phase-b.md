# Phase B — Exam Engine / Scheduling Implementation Packages

**Date:** 2026-11-01

**Repository:** `MuelTech/graduate-system`

**Audit baseline:** `9ab8aa037b9c5a9f746bd0e6aef72478a3b76564` (accepted Phase A merge)

**Audit branch:** `feat/exam-engine-scheduling-audit`

**Status:** PROPOSED; INDEPENDENT REVIEW REQUIRED; NO PACKAGE IMPLEMENTED OR ACCEPTED

**Evidence:** [Phase B lifecycle audit](../reports/2026-11-01-exam-engine-scheduling-phase-b-audit.md)

**Authorities:** [Content source of truth](../EXAM_CONTENT_SOURCE_OF_TRUTH.md), [verification policy](../ENGINEERING_VERIFICATION_POLICY.md), [tracking index](../GSIS_IMPLEMENTATION_CHECKLIST.md) §7.2.

## 1. Purpose and acceptance rules

This is an evidence-derived remediation plan, not implementation authorization. The audit found useful existing ownership, private-media, authoring/projection, answer uniqueness and transaction boundaries. Preserve these and close specific gaps. Do not recreate accepted Phase A work or restore retired Score Management UI/routes.

Each package ends with a pushed, bounded diff, verification evidence, independent source review and owner acceptance/authorization before proceeding. A package marked complete by its implementer is not automatically accepted. Verify the then-approved baseline and branch before each future package; the present branch is only the audit workstream. Do not merge this audit into main or begin any package during this session.

Common protected scope for **every** package:

- No canonical OLSAT text/Q24/Q40, manifest/assets, emphasis-map or source-fidelity rewrite/reset/re-import.
- Retain mixed-content types, eight structured subtypes, semantic typography, exact labels/order, accepted Admin authoring compatibility and Applicant renderer composition.
- Keep media private, opaque-ID based, authenticated/context authorized, integrity validated and confidential/no-store. Never expose correct-option/key/source/storage metadata in Applicant DTOs.
- Retain JWT user → Student ownership and exact record authority. Preserve accepted Exam Schedules and Exam Records task ownership; grade/email mutations may retain their existing `/exam/scores` namespace.
- No unrelated Faculty/auth, thesis/defense, COR, notification-system redesign, public assets, randomization or assessment-policy invention.
- No fabricated legacy starts, deadlines, received-question sets, grades, signatures or period assignments. Reconcile ambiguous legacy state through an explicit migration/operator boundary.

When schema/auth/shared storage references change, apply the verification policy's broader related checks and additive migration rehearsal. Otherwise use focused tests and directly affected regressions, appropriate type/build/lint and diff checks. Browser/manual, live contention and hosted CI evidence must be reported separately and honestly. Add tests with each implementation package, not all at the end.

## 2. Dependency order and rationale

The first two packages contain current integrity defects without waiting for institutional policy. Frozen configuration/content and normalized schedule admission must precede accepted attempt timing; persisted drafts must precede safe automatic timeout finalization. Essay evaluation must precede complete scoring/publication acceptance. Post-assignment amendments require the attempt boundary so they cannot rewrite a running/completed examination.

| Order / ID | Bounded package | Dependencies | Policy prerequisite |
| --- | --- | --- | --- |
| 1 — EXAM-B0A | Answer payload and submitted-state containment | Audit/plan review + explicit authorization | None; preserve current incomplete-answer behavior pending decision. |
| 2 — EXAM-B0B | Pending-result and notification containment | Audit/plan review; may be reviewed independently of B0A | None; PENDING is not FAILED. |
| 3 — EXAM-B1 | Authoritative examination configuration | B0A/B0B accepted | PD-1/2/3 for published values; draft configuration can remain unpublished. |
| 4 — EXAM-B2 | Question activation/selection and immutable received-content support | B1 | PD-2; deterministic ordering remains unless separately changed. |
| 5 — EXAM-B3 | Canonical schedule time and atomic booking admission | B1; B2 if booking binds a published definition | PD-1 and PD-5 for admission windows/period identity. |
| 6 — EXAM-B4 | Owned server attempt and remaining-time authority | B1/B2/B3 | PD-1, PD-5; agreed migration treatment of existing apps. |
| 7 — EXAM-B5 | MCQ/essay draft persistence and recovery | B4; preserve B0A guards | PD-2 to render the accepted essay set; no new scoring decision. |
| 8 — EXAM-B6 | Final submission, expiry and immutable terminal attempts | B4/B5 | PD-4; PD-1 deadline/grace rules. |
| 9 — EXAM-B7 | Essay evaluation lifecycle | B2/B6 | PD-2; current ADMIN authority retained. |
| 10 — EXAM-B8 | Consistent scoring and final result publication | B1/B2/B6/B7 and B0B | PD-3; PD-2 weights/maxima. |
| 11 — EXAM-B9 | Assigned-schedule amendments and missed-exam appeals | B3/B4/B6; B8 for preserving finalized results | PD-5; post-result exceptions stay deferred unless explicitly authorized. |
| 12 — EXAM-B10 | Lifecycle regression and acceptance gate | All required preceding packages accepted | Required PDs resolved; explicit deferred exceptions recorded. |

These are review boundaries, not authorization to keep an incomplete system open to production use. B4's server contract must be used consistently by affected requests even if B5/B6 add richer persistence/expiry behavior later. Where an intermediate package cannot safely activate alone, keep it unpublished/inactive until its declared consumer package is accepted. Do not deploy partially connected authority paths.

## 3. EXAM-B0A — Answer payload and submitted-state containment

| Contract | Definition |
| --- | --- |
| Problem | Audit B-01/B-02: duplicate entries inflate scores, foreign options persist, invalid type/state combinations pass, draft writes can modify terminal answers, concurrent submissions lack a winning transition. |
| Authoritative behavior | Validate each supplied question once, enforce option membership and answer type before writing, compute points from validated unique answers, admit only eligible pre-submit application states, and serialize draft/final transitions. Accepted finalization cannot be overwritten through autosave or a competing submit. |
| Exact scope | Bounded submission/autosave DTO validation, explicit application-state allowlist, atomic submission transition and draft-write coordination using the current application identity. Preserve existing schedule-window values and existing allowance for omitted answers until PD-4. Reject duplicate IDs rather than silently accumulating them. No full timer/recovery redesign. |
| Likely surfaces | `exam-engine.controller.ts`, `exam-engine.service.ts`, `exam-engine.repository.ts`, bounded answer validation/types, relevant routes/tests; minimal submit-in-flight UI only if needed to prevent duplicate interaction. |
| Protected / out of scope | Common protections; no bank/key changes, duration/config/threshold change, new incomplete-answer policy or essay rubric. Existing transactional grouped final writes remain. |
| Migration | Prefer no schema migration: use application-level transactional predicates/locking appropriate to the database. If a version is necessary, stop for a narrowly reviewed additive migration; do not smuggle in the full attempt model. |
| Automated verification | Actual controller/service/repository failure cases for duplicates, contradictory entries, wrong/foreign IDs, unknown questions, nonarray/malformed bodies, wrong answer types and disallowed states. Prove score matches distinct persisted answers. Test competing submit and autosave-final interleavings; execute focused real DB contention before claiming serialization, with related media/projection regressions. |
| Owner / manual QA | Double-click submit, pending request then submit, direct autosave after submit, incomplete confirmation and valid image-option submission; use isolated synthetic records. |
| Stop / acceptance | Known payload inflation/foreign-option persistence and post-submit draft write paths closed; terminal winner established without new policy. B1/B4 not started. |
| Dependencies / policy | Audit review and explicit authorization; no unresolved institutional decision blocks rejection of inconsistent IDs or terminal mutation. |

## 4. EXAM-B0B — Pending-result and notification containment

| Contract | Definition |
| --- | --- |
| Problem | Audit B-05: a successful PENDING score response is rendered FAILED; direct email requests select failure template for any non-PASSED application. |
| Authoritative behavior | Awaiting evaluation remains visibly pending/unavailable, never a failed result. Result email requires an authoritative completed PASSED/FAILED result consistent with the application. |
| Exact scope | Correct PENDING response/UI handling and validate the existing send-email mutation's terminal-result prerequisite. Preserve persisted scores and existing final pass/fail calculations. Queue success remains queue success. |
| Likely surfaces | `exam.repository.ts:getLatestResult`, `exam.service.ts:getExamResult/confirmResultAndEmail`, `exam.controller.ts`, Applicant results page/DTO and focused tests. |
| Protected / out of scope | Common protections; no threshold/denominator rewrite, email-worker redesign, new publication approval or delivery audit system, historical scores reset. |
| Migration | None expected. |
| Automated verification | Successful MCQ submit with PENDING score never displays/emails FAILED. Missing/inconsistent/not-final states reject notification; finalized pass/fail select correct existing template. Test Applicant ownership and unauthorized email actor. |
| Owner / manual QA | Applicant results before and after grading; Admin direct invalid-state email attempt and normal queue confirmation. |
| Stop / acceptance | Premature failure display/email path closed; full scoring consolidation remains B8. |
| Dependencies / policy | Can be independently reviewed after audit authorization; no threshold/count/grade-authority policy needed. |

## 5. EXAM-B1 — Authoritative examination configuration

| Contract | Definition |
| --- | --- |
| Problem | Duration has no Admin authority; Program score fragments conflict with hard-coded maxima/75%. Future attempts need a stable effective configuration. |
| Authoritative behavior | Authorized Admin manages validated examination settings; effective versions are identifiable and cannot silently rewrite settings of an existing attempt. Incomplete settings cannot be published as authoritative. |
| Exact scope | Duration, units, start/deadline rule, score maxima/threshold representation, essay composition/weight and selection policy fields only to the extent approved in PD-1/2/3. Reuse Program configuration where sound. Add a bounded Admin configuration surface with explicit draft/effective semantics and safe read DTOs. Consumer rollout to B3/B4/B7/B8 must be explicit; do not claim constants gone while legacy code still uses them. |
| Likely surfaces | Program/exam configuration schema/repository/service/controller/routes/validation; Admin exam settings surface and types; Program totals/detail compatibility. |
| Protected / out of scope | Common protections; no actual attempt start, answer saving, scheduling amendment, content change or permission-system replacement. No hard-coded policy values presented as owner-approved. |
| Migration | Additive settings/versioning storage expected; reuse existing totals with explicit provenance. Preserve null/unknown legacy values; don't backfill three hours/75% as approved policy. Existing app settings cannot be fabricated. |
| Automated verification | Bounds/units/threshold validation, unauthorized mutation, publish incomplete config rejection, stable version identity, nullable legacy handling and accepted Admin detail compatibility. Migration rehearsal and broader related schema checks. |
| Owner / manual QA | Review proposed values/semantics, edit/publish/read them, reject invalid values and confirm historical/current settings are distinguishable. |
| Stop / acceptance | A reviewed config contract and Admin authority exist; consumers and transitional restrictions documented. No assertion that timer/scoring are aligned until consumer packages pass. |
| Dependencies / policy | B0A/B0B accepted. PD-1/2/3 block effective publication; owner may authorize a draft-only storage/UI package first if useful. |

## 6. EXAM-B2 — Activation, selection and immutable received content

| Contract | Definition |
| --- | --- |
| Problem | Entire mutable shared bank is served; no received-set identity/revision; delete cascades history; future starts need stable questions/options/media/key. |
| Authoritative behavior | Published examination membership/order is explicit. An attempt receives an immutable content/key revision and authorized private-media references; later Admin changes cannot rewrite it. Applicant payload never contains key or storage authority. |
| Exact scope | Bounded question activation/selection controls and immutable revision/snapshot support, preserving deterministic order and existing mixed-content payloads. Prevent destructive edits/deletes of received content or retain immutable revisions; define safe archive behavior. Provide a server operation B4 can bind exactly once. Do not randomly select/shuffle or modify canonical import data. |
| Likely surfaces | ExamQuestion/ExamOption relationships and additive definition/revision support; `exam-engine.repository.ts`, content projection/rules, Admin question bank/editor compatibility; media repository reference/context rules; importer compatibility tests. |
| Protected / out of scope | Common protections; original content representation stays intact. Freeze/copy by accepted schema, not an OLSAT-specific branch. No guessed historical received sets or bank resets. |
| Migration | Additive membership/revision/reference storage and historical deletion guards expected. Live bank remains original source; preserve media bytes referenced by snapshots. Legacy historical receipt remains unknown unless exact evidence exists. |
| Automated verification | Activation/membership and deterministic order; start-bound content unchanged after edit/deactivate/delete; media retained/private under revision references; safe Applicant projections; all supported structured/typography forms and option IDs preserved. Broader related schema/storage/auth regression and migration rehearsal. |
| Owner / manual QA | Review selected count/order/types, deselect questions without deleting source, compare existing renderer presentation, verify Admin edits affect only future starts. |
| Stop / acceptance | Immutable received-content contract is ready for B4; membership cannot silently drift and no content package changed. Activation not exposed as a complete attempt lifecycle. |
| Dependencies / policy | B1; PD-2 decides selection/composition. Randomization and unrelated bank taxonomy remain deferred. |

## 7. EXAM-B3 — Canonical schedule time and atomic booking admission

| Contract | Definition |
| --- | --- |
| Problem | Supplied slot IDs bypass program/active/future filters; DATE/TIME comparisons/conversions disagree; capacity and duplicate applications race. |
| Authoritative behavior | One approved wall-clock/timezone contract yields the same schedule instant to server/Admin/Applicant. Booking authorizes this Applicant, exact program, alignment, active future slot and a remaining seat atomically, under the accepted period rule. |
| Exact scope | Server scheduling DTO validation, canonical combined start conversion shared by comparisons, same-day availability, slot program/active/eligibility checks, bounded capacity reservation and one-active/period invariant. Validate create/edit capacity and freeze booked Program/date/time on the ordinary edit route. Closing for Booking still preserves booked access. Booking and attempt start remain distinct operations. |
| Likely surfaces | `exam.controller.ts`, `exam.service.ts`, `exam.repository.ts`, schema uniqueness/admission support where necessary; Admin schedule helpers/page and Applicant schedule/exam consumers; period/admission validation. |
| Protected / out of scope | Common protections; retain Applicant self-booking without a new Admin approval gate and accepted close/reopen semantics. No cancellation/amendment/appeal implementation beyond rejecting unsafe ordinary edits. |
| Migration | May require additive period/reservation/uniqueness support. Audit/reconcile existing duplicates/counters and ambiguous dates before constraints; never automatically shift old rows by a guessed offset. New admissions fail closed for unresolved legacy records. |
| Automated verification | Same-day future and past starts, UTC/Manila/negative-offset/midnight serialization, invalid dates/time/capacity, closed/foreign-program slots, invalid alignment, last-seat two-user contention and simultaneous same-user bookings to different slots. Prove rollback and booked-edit enforcement with real DB competing connections. |
| Owner / manual QA | Admin create → Applicant selection → exact same displayed/start instant; capacity/duplicate errors; booked edits blocked through API; close/reopen retains assignment. Review any legacy reconciliation separately. |
| Stop / acceptance | New booking/time authority and invariants proven; no attempt timers or amendment UI implemented. |
| Dependencies / policy | B1; B2 if binding a published exam at booking. PD-1 authorized start semantics/zone; PD-5 period/attempt consumption. Capacity may remain explicitly required with no invented default. |

## 8. EXAM-B4 — Server-owned attempt and remaining time

| Contract | Definition |
| --- | --- |
| Problem | Start is a read; no persisted start/deadline or received config/set; latest-app lookup and independent 10800 countdown cause ambiguous recovery. |
| Authoritative behavior | Start/re-entry identifies an exact owned application execution, atomically binds its effective config/content and records authorized start/deadline. Repeated calls/tabs cannot restart time or create another execution. Frontend renders server-derived remaining time and lifecycle state. |
| Exact scope | Add bounded start/get attempt contracts, ownership/status/window checks, idempotent start, authoritative timestamps/clock response and frontend restoration of state/time. Use the same authority for questions/autosave/submit/media context. Remove independent fixed duration initialization/labels and the misleading on-open claim; use an absolute deadline with authoritative resync on load/reconnect. |
| Likely surfaces | Application lifecycle or child attempt schema, `exam-engine` routes/controllers/services/repository/interfaces, Applicant exam page/types, media access delegation. First assess additive fields/relations on EntranceExamApplication; add a child only if accepted execution/retake cardinality requires one. |
| Protected / out of scope | Common protections; no wholesale model replacement. No new per-device prohibition. This package establishes terminal transition authority/guards; B6 supplies full receipt/expiry finalization. Do not leave a legacy mutation path bypassing the new state. |
| Migration | Additive start/deadline/config/content-binding/state/version expected. Explicit cutover for PENDING/TAKEN/graded legacy applications; never use createdAt or schedule start as fabricated actual-start evidence. |
| Automated verification | Concurrent repeated Start, owned/unowned IDs, disallowed/expired/appealed/disqualified applications, late entry/grace, exact deadline boundaries, stable timestamps after reload/device switch/restart, content/config frozen once, media negative-access cases and missing legacy bindings. |
| Owner / manual QA | Start late under approved rule, reload/reopen, change local clock, open another device, reconnect near deadline and verify server remaining time and identity. |
| Stop / acceptance | Every affected engine request uses one exact server lifecycle/time authority; browser cannot create more time. No claim of recovered answers or completed timeout finalization before B5/B6. |
| Dependencies / policy | B1/B2/B3; PD-1 and PD-5 settled, with approved legacy cutover. |

## 9. EXAM-B5 — Persisted drafts, autosave and recovery

| Contract | Definition |
| --- | --- |
| Problem | MCQs only persist at final submit; essay interval resets while typing, blank clearing does not save, stale writes win and no Applicant recovery endpoint exists. |
| Authoritative behavior | Server persists owned attempt drafts with type/membership/deadline/state checks and stale-write protection. Readback restores choices, essay text and navigator state. An acknowledged save remains recoverable after reload; client distinguishes unsaved/in-flight/failed state. |
| Exact scope | MCQ incremental upsert/change/clear, Applicant presentation/editing/recovery of the complete accepted essay set, explicit empty-text semantics, bounded save scheduling, version/sequence conflict handling, read recovery and network retry/resync. Finalization handoff must drain/resolve pending saves and preserve B0A terminal locks. Avoid an unreviewed local cache of protected content; any local durability requires an explicit bounded design. |
| Likely surfaces | ApplicantAnswer or attempt answer schema/version fields; engine draft/read API and DTOs; Applicant page/state/save helper; existing renderer selection callbacks reused. |
| Protected / out of scope | Common protections; no new score calculation or policy, no generic rewrite of defense autosave, no silent last-writer-wins across devices. |
| Migration | Additive answer revision/timestamp or equivalent concurrency metadata expected; preserve existing application/question uniqueness and legacy drafts honestly. No answer guessing/backfill. |
| Automated verification | Select/change/clear MCQ, wrong option/type/member rejects; continuous typing eventually saves; blank essay clears; delayed/reordered/duplicate requests; stale two-device updates; reload/reconnect hydration including navigator; failed save retry and terminal/deadline rejection. |
| Owner / manual QA | Network offline/online and browser refresh with saved/unsaved states, long continuous essay entry, clear essay, switch devices, immediate submit with save in flight. |
| Stop / acceptance | Acknowledged answers recover exactly; unsaved work/status is visible; stale or terminal writes cannot silently replace newer/final content. No background expiry scoring yet. |
| Dependencies / policy | B4 and B0A invariants; PD-2 accepted essay count. Writer conflict behavior can be conservative technical rejection/resync without inventing an institutional one-device rule. |

## 10. EXAM-B6 — Explicit submission, expiry and immutable final attempts

| Contract | Definition |
| --- | --- |
| Problem | No zero-time action or closed-browser finalization, non-idempotent retry, pre-write expiry race, no exact immutable final receipt. |
| Authoritative behavior | One atomic terminal transition consumes the authoritative saved answers and produces a stable receipt. Explicit submit and expiry compete safely; all later writes reject. Time expiry is enforced without browser cooperation and survives server downtime. |
| Exact scope | Atomic submit/timeout transition, incomplete-answer validation/acknowledgment per PD-4, flush/version reconciliation, immutable answer/config/content set, stable submit receipt and lost-response recovery. Add bounded catch-up/idempotent expiry execution using existing job infrastructure where sound; define exact precedence for deadline-crossing requests. Client zero-time shows authoritative expired/submitted outcome and disables edits. |
| Likely surfaces | Attempt/application terminal fields and receipt, engine service/repository/routes, bounded expiry job and server startup integration, Applicant exam UI/state and draft coordinator. |
| Protected / out of scope | Common protections; no fabricated unsent answers; no global queue/worker redesign or new extension/no-show appeal policy. Finalization must not require the browser to be open. |
| Migration | Additive finalization timestamp/reason/receipt support if not supplied by B4. Preserve old terminal records; do not retrospectively assert timeout/actual start. |
| Automated verification | Client timer zero plus server enforcement; no-browser expiry; restart catch-up; submit-vs-expire and save-vs-submit/expire races; exact boundary; repeated submit/worker idempotency; response lost after commit; transaction rollback; policy-approved incomplete submissions. Real DB contention and restart simulation required for those claims. |
| Owner / manual QA | Submit near expiry, disconnect/close before expiry, restart test environment, reopen result/receipt; verify warnings and final answers/locks. |
| Stop / acceptance | One recoverable terminal receipt and immutable final answer set, late writes rejected, unattended expiry proven. Final pass/fail remains pending B7/B8 where essays require grading. |
| Dependencies / policy | B4/B5; PD-1 deadline and PD-4 incomplete/timeout/no-show outcome. |

## 11. EXAM-B7 — Essay evaluation lifecycle

| Contract | Definition |
| --- | --- |
| Problem | Only first essay is shown to Applicant; aggregate grade is mutable without server state guards/history; zero/multiple essays lack coherent completion. |
| Authoritative behavior | The exact received essay set and approved scoring maximum/weight govern display, submitted text and evaluation. Current authorized ADMIN grades finalized immutable answers; completion is explicit. Direct regrade of completed results is rejected unless a separate exception workflow is authorized. |
| Exact scope | Connect the received essay set to Admin review and approved aggregate or per-essay evaluation; grade bounds derive from frozen config; validate reviewable terminal state, record evaluator/completion evidence and prevent concurrent overwrite. Zero-essay path has no fabricated required essay grade. Multi-essay evaluation follows PD-2. B5 already owns Applicant essay presentation/editing/recovery; do not repeat that UI work here. |
| Likely surfaces | Essay answer/evaluation schema as needed, `exam.service.ts` / `exam.repository.ts:gradeEssay`, controller DTO conversion, Admin record detail/read DTO and related types; regression coverage of B5's Applicant essay contract. |
| Protected / out of scope | Common protections; no future Faculty/Program Chair permission-system implementation, rubric invention, oral/defense scoring, or accepted structured editor redesign. |
| Migration | Additive evaluation/completion/history records if needed; existing aggregate scores remain legacy authoritative records with honest unknown metadata. No fake per-question historical grades or grading timestamps. |
| Automated verification | Zero/one/approved-multiple essay paths; numeric/type/max checks from frozen config; finalized-only review; wrong role/record, stale competing graders, repeated grade, immutable response, review completion and legacy aggregate compatibility. |
| Owner / manual QA | Applicant essay set → immutable Admin review → grade/save/refresh; verify exact response, bounds, completion and historical grader evidence. |
| Stop / acceptance | Approved essay lifecycle works without reopening answer edits or inventing evaluator authority. Overall scoring consistency/publication is B8. |
| Dependencies / policy | B2/B6 and PD-2. ADMIN authority is established; Program Chair and post-result regrade exceptions remain deferred, not blockers to this base package. |

## 12. EXAM-B8 — Authoritative scoring and result publication

| Contract | Definition |
| --- | --- |
| Problem | Live-bank denominators, forced essay max 30, dynamic 75% floor and stored Program fields disagree; regrading can move historical thresholds/results. |
| Authoritative behavior | Unique finalized answers and frozen question keys/config produce reproducible MCQ/essay totals and PASS/FAIL. Admin and Applicant read the same persisted assessment basis; pending remains pending. Result email uses that exact final assessment. |
| Exact scope | Consolidate score calculation and bounds/rounding into the authoritative server function, persist required calculation provenance/config version, reconcile completion with B7, align result/detail DTOs and prevent live bank edits/regrades from silently changing historical denominators. Keep B0B's publication prerequisite and define bounded repeat-email behavior without claiming delivery. |
| Likely surfaces | EntranceExamScore/assessment provenance, engine final MCQ scoring, `exam.repository.ts:gradeEssay/getLatestResult`, result/notification services, Admin detail and Applicant results/types. |
| Protected / out of scope | Common protections; no frontend authority to choose PASS/FAIL, no silent recomputation/reclassification of historical results, no COR/promotion rewrite or email-system redesign. |
| Migration | Additive immutable scoring basis/provenance as required. Existing scores retain recorded result; mark unverifiable denominator/config explicitly. Any historical correction is a separately reviewed operation. |
| Automated verification | Approved thresholds/rounding/weights and edge values, blanks, maximum totals, duplicate defense retained, bank/key/config edits after start, zero/multiple essay completion, identical Admin/Applicant basis, pending/final publication/email states and unauthorized requests. |
| Owner / manual QA | Review approved sample calculations, configured maxima vs displayed values, pending-to-final, historical result after bank/config change, correct queued pass/fail notification. |
| Stop / acceptance | One reproducible assessment basis, consistent views and final-result publication. No appeal/regrade exception machinery added. |
| Dependencies / policy | B1/B2/B6/B7 and B0B; PD-2/3 values and rounding approved. |

## 13. EXAM-B9 — Assigned-schedule amendments and appeals

| Contract | Definition |
| --- | --- |
| Problem | API can rewrite assigned slots; appeal is allowed after start, approved appeal masquerades as FAILED, counters never release and application selection is ambiguous. |
| Authoritative behavior | Ordinary booking closure preserves assignment. Approved cancellation/reschedule/appeal transitions preserve old application/attempt/result evidence and cannot rewrite active/finalized attempts. Admission/seat accounting and UI select an exact current record consistently. |
| Exact scope | Only PD-5-approved amendment/cancel/reschedule/no-show appeal operations, with exact application/attempt IDs, atomic state/version checks, before/after actor/reason audit and correct reservation release/retention. Replace false FAILED representation for appeal approval with explicit semantics. Integrate actions into accepted Exam Records/Schedules surfaces; provide notifications only for authoritative committed changes using existing mechanisms. |
| Likely surfaces | Application/schedule/appeal history/relations, scheduling service/repository/controller/routes; exact status/current-record projection across Applicant status/profile/engine/result; Admin Schedules/Exam Record action UI and Applicant appeal flow; bounded existing notification integration. |
| Protected / out of scope | Common protections; no post-final emergency override or grade appeal unless explicitly authorized; no schedule closure that secretly cancels an attempt; no deletion/reset of old attempts. |
| Migration | Additive amendment/appeal event/state support expected; preserve ambiguous legacy FAILED/appeal rows without guessing true exam results. Reconcile counters/history from evidence before backfill. |
| Automated verification | Correct appeal window/status/actor, denied early appeal, stale appeal-vs-submit/expiry, concurrent reschedule/capacity, exact old/new assignment, released/retained seat accounting, read-selection consistency, immutable completed attempts and notification failures after commit. |
| Owner / manual QA | End-to-end missed-exam appeal approval/rejection, permitted reschedule/cancellation, old history visible, new booking eligibility/capacity correct, running/completed attempt protected. |
| Stop / acceptance | Only approved amendment transitions work and preserve history/accounting; no unsanctioned override capability. |
| Dependencies / policy | B3/B4/B6; B8 if finalized results exist. PD-5 blocks new amendment authority; ordinary unsafe edits should already reject under B3. |

## 14. EXAM-B10 — Focused lifecycle regression and acceptance gate

| Contract | Definition |
| --- | --- |
| Problem | Existing coverage primarily proves content/media/read projections; lifecycle production readiness lacks end-to-end and real contention evidence. |
| Authoritative behavior | The complete accepted chain from Admin settings through booking, owned execution, saved answers, timing, terminal receipt and assessment behaves consistently under interruption/concurrency. |
| Exact scope | Close only remaining lifecycle regression gaps; record an explicit cross-package evidence matrix and production/cutover limitations. Run broader exam-related/backend/frontend checks as the declared final gate, rather than repeating full suites for every local edit. Any newly found functional defect gets its own bounded correction/review before acceptance. |
| Likely surfaces | Focused service/repository/API integration tests, isolated DB contention fixtures, Applicant/Admin browser journeys, lifecycle verification report and checklist references. Runtime fixes require a separately identified correction package. |
| Protected / out of scope | Common protections; no wholesale unrelated test/CI overhaul, no live candidate data edits, no assumption that passing unit tests equals owner QA or hosted CI. |
| Migration | None intended; rehearse combined required migrations and cutover on isolated representative legacy data. Confirm no fabricated history or broken private-media references. |
| Automated verification | Settings → book → start/reload → save/recover → explicit/timeout terminal → essay review → score/result/email eligibility; unauthorized and wrong-record matrix; lost response/disconnect/restart; live DB last-seat, duplicate Start/submit and stale draft contention; received content/keys/media remain private and stable. Include directly affected Phase A regressions. |
| Owner / manual QA | Real Admin/Applicant multi-tab/device walkthrough, no-show/appeal path, supported-browser timing, representative mixed-content display and historical records. Record exact scenarios and any explicit waiver, never inferred PASS. |
| Stop / acceptance | Independent remote review, owner-required QA and declared automated gates pass; remaining policy/deployment limits explicitly documented. Only owner acceptance can mark Phase B complete/production-ready for an agreed scope. |
| Dependencies / policy | All required packages and decisions resolved; any deferred exception must remain unavailable and not undermine the base lifecycle. |

## 15. Policy gate and migration discipline

The audit's **Policy Decisions Required** section is the decision register. Do not add clarification questions whose answers are already established (self-booking, current ADMIN grading, private media, deterministic order, configuration ownership).

PD-1 establishes duration/start/deadline/entry/grace and explicit institutional timezone. PD-2 establishes selected assessment composition/essay count/maxima/weights. PD-3 establishes passing threshold authority and rounding. PD-4 establishes incomplete/timeout/no-show outcomes. PD-5 resolves the documented one-attempt-per-period rule into a usable period/retry/appeal/amendment contract. Record approved answers in a dedicated examination lifecycle authority before activating dependent code; do not revise historical Phase A acceptance to encode them.

Review schema choices at the smallest package needing them. Prefer additive application/config/revision/answer extensions, existing storage/provider boundaries and accepted UI. Explain why any child Attempt or Definition entity is necessary from cardinality/history requirements; a model name is not a requirement. Preserve identifiable legacy records, unknown timing/content provenance and accepted scores. Do not convert old createdAt into actual-start or assume every old attempt saw today's 72 questions. No development-bank reset is a production migration strategy.

## 16. This audit package's delivery boundary

Only the audit report, this plan and a minimal §7.2 checklist status/link update are part of the current diff. Verify exact relative references, `git diff --check`, and base-to-head file allowlist; commit and push normally to `feat/exam-engine-scheduling-audit`. Report live remote starting SHA and pushed final SHA. No implementation tests/builds/migrations are required merely for these Markdown changes.

**STOP after audit documentation commit/push. The next action is independent review of the pushed audit/plan. EXAM-B0A, EXAM-B0B and all later packages remain unimplemented, unaccepted and unauthorized.**
