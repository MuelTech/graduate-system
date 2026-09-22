# Thesis/Dissertation Workflow Refactor — Implementation Plan

**Date:** 2026-09-23  
**Branch:** `refactor/defense-workflow`  
**Canonical spec:** `docs/superpowers/DEFENSE_WORKFLOW_SOURCE_OF_TRUTH_.md` (v1.3-draft)  
**Status:** Phases B–G implemented (core defense workflow refactor).  
**Supersedes for conflicts:** older plans/specs under `docs/superpowers/{plans,specs}/` lose to the source of truth.

---

## 0. Execution model

Work is split into stop-and-review phases. Do **not** start the next phase without an explicit go-ahead.

| User phase | Source-of-truth PART IX | Focus |
|---|---|---|
| **A** | Phase 0 | Audit + this plan. No production code. |
| **B** | Phase 1 | Workflow-state corrections (domain/state separation) |
| **C** | Phase 2 | Stage-specific requirements |
| **D** | Phases 3–4 | Committee policy + scheduling/routes |
| **E** | Phase 5 | Formal conclusion / progression (includes removing score→outcome coupling) |
| **F** | Phase 6 | RAP / signatures / post-defense progression deps |
| **G** | Phase 7 | UI alignment to backend truth |
| *(later)* | Phase 8 | Route integration + lifecycle tests (can be interleaved per phase) |

**Out of scope for this refactor (do not redesign):** panelist scoring UX, PDF/manuscript annotation, collaborative document comments, panelist notes, live document interaction. Scoring may be minimally corrected so it stops mutating official workflow state (Phase E).

**Deferred (spec §16.7, §34):** official form PDF generation (GS-006/007/011/022/017/020), Expert Evaluation (GS-021) workflow, institutional Dean→VPAA→President digitization.

---

## 1. Audit — current branch vs source of truth

### 1.1 What already aligns

| Area | Evidence |
|---|---|
| Title apply does not require adviser | `thesis.service.ts` `applyTitleDefense` + eligibility `evaluateApplyTitle` |
| Comp Exam PASSED gates Title apply | `evaluateApplyTitle` / `COMP_EXAM_PASSED` |
| Application review cannot set PASSED/FAILED | `updateDefenseStatus` allows only PENDING/APPROVED/REJECTED |
| APPROVED ≠ PASSED in scheduling | `scheduleDefense` sets SCHEDULED only; comments + `isStageUnlockedByPriorStatus` |
| Title conclusion requires selected title | `concludeDefense` + `defense-workflow.rules.validateTitleConclusionSelection` |
| Only PASSED unlocks next stage | `evaluateApplyProposal` / `evaluateApplyFinal` / student pipeline page |
| Unique panel seat per schedule | `@@unique([scheduleId, userId])` on `PanelAssignment` |
| Non-evaluator roles blocked from scoring | `submitOralExamScore` checks `evaluatorRoles` (CHAIRMAN, PANELIST) |
| Centralized committee + workflow rule modules | `defense-committee.policy.ts`, `defense-workflow.rules.ts`, `defense-eligibility.service.ts` |
| Unit tests green | 30 vitest tests (eligibility, committee, workflow rules) |
| Title package is one upload + 3 structured titles | `createTitleDefense` (conceptPaper + 3 ThesisTitle rows) |

### 1.2 P0 defects (must fix in this refactor)

| ID | Spec | Current behavior | Phase |
|---|---|---|---|
| **P0-1** | §7.3, §7.10, §13.4 | `thesis.repository.ts` `submitOralExamScore()` when last score lands: writes `OralExamSummary`, sets `ThesisRecord.status = PASSED/FAILED`, creates `RapReport` + signature slots for **all** panel assignments. Conflicts with `concludeDefense()`. | **E** |
| **P0-2** | §24 P0 | `thesis.routes.ts` registers `/defense/proposal`, `/defense/final`, `/defense/:id/schedule` **twice** (later `upload.fields` wins; first handlers dead). | **D** (routes) |
| **P0-3** | §12.5, §24 | `defense-committee.policy.ts`: `minimumPanelists`/`maximumPanelists` = `null`, `facilitatorRequired`/`rapporteurRequired` = `false`, `programType` param ignored (`_programType`). Always passed `'UNKNOWN'` from `scheduleDefense`. | **D** |

### 1.3 P1 defects

| ID | Spec | Current behavior | Phase |
|---|---|---|---|
| **P1-1** | §6 | `ThesisRecord.status` overloaded (review + schedule + outcome + revision). No separate Application / Session / Outcome / StageCompletion model. | **B** |
| **P1-2** | §16, §24 P1 | Requirements not stage-scoped. `hasDoc(docs, "COR"|"RECEIPT"|…)` any historical row. `conceptPaper` and `proposalChapters` both map to `PROPOSAL_CHAPTERS`. `adviserCertIssued` ignores `defenseStage`. | **C** |
| **P1-3** | §10.3.1, §24 | Research Variables hard-blocks Proposal when `researchVariablesApproved == false`. No `NOT_APPLICABLE`. | **C** |
| **P1-4** | §11.2–11.3, §24 | STRIKE / Statistician / Instruments are unconditional Final gates in `evaluateApplyFinal` + `evaluateSchedule`. Spec marks them `CLIENT_CONFIRMATION_REQUIRED`. | **C** |
| **P1-5** | §21 | `REVISION` is a dead-end (no correction/re-defense path). | **B** (safe interim) + later |
| **P1-6** | §7.4, §14.4, §18.4 | `POST /defense/:scheduleId/conclude` is `authenticateJWT` only — any logged-in user who can hit the route may conclude. No explicit concluder policy (OPEN_QUESTION). | **E** (conservative interim: restrict; do not invent who) |
| **P1-7** | §15.3, §24 | RAP signature slots = every `PanelAssignment`. Spec: form-specific signatories. | **F** (interim: do not invent; keep configurable/deferred) |
| **P1-8** | §12.6 | `scheduleDefense` auto-injects an `ADVISER` seat on Proposal/Final. Spec forbids treating `AdviserAssignment` as a committee seat until confirmed. | **D** |
| **P1-9** | §9.2 | Adviser request is Student → Admin assign. Missing Adviser CONFORME step (GS-020). `createAdviserRequest` even sets `approvedById: requestedAdviserId` as placeholder. | **C** (partial: model the gap; do not invent Dean digital chain) |
| **P1-10** | §17.6, §24 P2 | Student Proposal/Final pages use local mock `pending/uploaded/verified` arrays (several hard-coded `"verified"`). Final page mock STRIKE `{status:"passed", similarity:12}`. Proposal page mock 7 post-defense copies. | **G** |

### 1.4 Schema / model gaps vs §22

| Spec entity | Current | Gap |
|---|---|---|
| `GraduateResearchProject` | one `ThesisRecord` reused across stages via `stage` + `status` mutation (`updateThesisToProposal` flips stage) | Acceptable during migration **if** domain logic preserves one-project / many-stage-events (§5). History of Title outcome is lost when stage flips unless conclusion/RAP rows retained. |
| `DefenseApplication` + ApplicationStatus enum | `ThesisRecord.status` PENDING/APPROVED/REJECTED (+ REJECTED reason) | Missing DRAFT/SUBMITTED/UNDER_REVIEW/FOR_COMPLIANCE/WITHDRAWN; `FOR_COMPLIANCE` recommended vs REJECTED-for-everything (§6.1, terminology open). |
| `DefenseSession` status | `DefenseSchedule` has date/time/link but no session status (SCHEDULED/IN_PROGRESS/AWAITING_CONCLUSION/CONCLUDED/…) | Missing (§6.2). |
| `DefenseConclusion` | `OralExamSummary` (+ thesis status mutation) | No dedicated conclusion record with outcome + selectedTitleId + concludedBy + concludedAt (§22.8). |
| `DefenseRequirementEvidence` | `ThesisDocument` (docType only) | No stage, sourceType, verificationStatus (§16.1). |
| `DefenseParticipantAssignment` flags | `PanelAssignment.role` only | No `isEvaluator` / `isSignatory` / `isChair` independent of display role (§12.2). |
| `ResearchTitle` selection metadata | `ThesisTitle.isSelected` | No selectedAt/selectedBy (minor). |
| `RapSignatureRequirement` | `RapReportSignature` for all panels | No `roleAtDefense` / `required` (§15.3). |
| `AdviserCertification.defenseStage` | **exists** (`DefenseType`) | Eligibility ignores it (P1-2). |
| RAP status | DRAFT / DISTRIBUTED / ALL_SIGNED / FINALIZED | Close enough to §6.4; optional NOT_CREATED/FOR_SIGNATURE/PARTIALLY_SIGNED later. |
| Research Variables | `ResearchVariableForm` + `ResearchVarStatus` PENDING / APPROVED_BY_PANEL | Missing NOT_APPLICABLE (§10.3.1). |

### 1.5 Duplicate / route inventory (`thesis.routes.ts`)

| Method + path | Registered | Notes |
|---|---|---|
| `POST /defense/proposal` | 2× | 1st `upload.single("document")`, 2nd `upload.fields([document, cor])` — 2nd wins |
| `POST /defense/final` | 2× | same |
| `POST /defense/:id/schedule` | 2× | identical handlers |
| `GET /defense/:scheduleId/lobby` | 2× | 1st with comment-only role note, 2nd bare |

---

## 2. Confirmed rules (implement as specified)

These are **CONFIRMED_CLIENT**, **CONFIRMED_PROJECT_SCOPE**, **SUPPORTED_CURRENT_PUBLIC_GUIDANCE**, or non-negotiable invariants (§7). Implement them; do not wait.

### 2.1 Non-negotiable invariants (§7)

1. Application APPROVED never implies defense PASSED.  
2. Defense SCHEDULED never implies PASSED.  
3. Score completion never mutates official academic outcome.  
4. Outcome recorded only by authorized formal conclusion.  
5. Title PASSED conclusion requires exactly one selected proposed title.  
6. Proposal unlocks only on prior **stage completion**, not application approval.  
7. Final unlocks only on Proposal stage completion.  
8. Non-evaluator roles cannot submit scores (Facilitator/Rapporteur default no).  
9. Requirements validated against the correct defense stage.  
10. RAP generated from formal conclusion, not score submission.  
11. Same person not assigned twice to one defense (no multi-role until confirmed).  
12. Scheduling validates committee composition server-side.  
13. Frontend badges informational; backend is authoritative.

### 2.2 Stage gates (confirmed)

**Title entry:** student exists; Comp Exam **PASSED**; no blocking active research; exactly 3 proposed title names; Title Defense proposal package upload; current COR; stage-specific defense-fee proof (Cashier external). **No adviser.**

**Title completion → Proposal:** conclusion exists; outcome **PASSED**; exactly one official title; required Title RAP finalized; required Title post-defense records.

**Proposal entry:** Title stage complete; official title; active adviser; **Proposal-scoped** adviser certification; finalized Title RAP (internal ref, no duplicate upload); Research Variables **if applicable** (else NOT_APPLICABLE); Chapters 1–3; current COR; stage-specific fee proof.

**Final entry:** Proposal stage complete; active adviser; **Final-scoped** adviser certification; finalized Proposal RAP (internal ref); Chapters 1–5 manuscript; current COR; stage-specific fee proof.

**Final completion → Repository:** conclusion PASSED (or confirmed revision-clearance path); required post-defense corrections/clearance; databank submission; admin repository approval.

### 2.3 Committee (confirmed subset only)

| Rule | Status | Implement as |
|---|---|---|
| Master's **session total 7** | CONFIRMED_CLIENT + form | Session composition policy: total participants = 7 |
| Doctoral **session total 8** | CONFIRMED_CLIENT + form | total participants = 8 |
| Facilitator exactly 1 | form-supported | required session role |
| Rapporteur exactly 1 | form-supported | required session role |
| GS-006 layout: Adviser + 4 Panelist + Fac + Rap | SUPPORTED_CURRENT_FORM | Optional adviser seat (explicit, not auto-injected) + up to 4 panelist rows + fac + rap = 7 |
| GS-007 layout: 6 Panelist + Fac + Rap | SUPPORTED_CURRENT_FORM | Up to 6 panelist rows + fac + rap = 8 |
| Facilitator / Rapporteur are not scorers by default | form-supported | evaluatorRoles = CHAIRMAN, PANELIST only (already) |
| No duplicate person on one defense | §7.11 | keep unique user check |
| Adviser seat is **not** auto-added | §12.6 | remove auto-inject; optional explicit assignment only |
| Title may not include ADVISER **as a committee seat** until session-participation is confirmed | interim | keep Title ADVISER seat forbidden OR allow only if client confirms; **do not invent** Title adviser attendance |

**Do NOT hard-code:** 5 Master's scoring evaluators; whether Chairman/Adviser count inside 5/6; Adviser scoring; Facilitator/Rapporteur signing; committee reuse across stages.

**Program type:** derive from `Student.program.programType` (`MASTERS` / `DOCTORAL`). Map to policy. Unknown program type → reject scheduling with a clear error (do not silently use unrestricted policy).

### 2.4 Scoring / conclusion (confirmed)

- Score submission persists scores only (+ optional derived summary display).  
- All required evaluator scores → **AWAITING_CONCLUSION** (session state), not PASSED/FAILED.  
- Formal conclusion is the sole writer of academic outcome.  
- Title PASSED conclusion selects exactly one proposed title.  
- RAP draft created **once** from formal conclusion.

### 2.5 Requirements (confirmed)

- Stage-scoped evidence for COR, fee proof, manuscripts, adviser certification.  
- Fee payment external at Cashier; GS-IS stores proof (+ optional OR number/amount metadata).  
- Physical packaging (envelope, folder, ring-bind) = instructions / optional office checklist, **not** automatic uploads.  
- Title supporting content stays inside the uploaded proposal package (3 names structured).  
- Application Form / Process Flow PDF generation deferred.  
- GS-021 Expert Evaluation outside core defense workflow.  
- Prior-stage RAP used internally (no duplicate student upload of system-generated RAP).

### 2.6 Safe interim for unresolved areas

| Area | Interim behavior |
|---|---|
| `REVISION` / re-defense | Do **not** unlock next stage. Store outcome + leave post-defense path blocked. No invented clearance actor. |
| Conclusion authorization | Require **ADMIN** (or authenticated + explicit allow-list config) until client confirms Chairman/Dean/etc. Never rely on UI alone. |
| RAP signatories | Keep current “assigned participants get slots” **only as temporary default**, behind a policy function so form-specific sets can replace it without rewriting the conclusion flow. Document as UNRESOLVED. |
| STRIKE / statistician / instruments | Feature-flag / config `requireStrikeForFinal` etc., **default false** (not unconditional gates). Surfaces may show them as optional/pending confirmation. |
| Master's scorer count | Configurable; enforce **session totals + Fac + Rap**, not 5 scorers. |
| GS-006/007 approval chain | Do not digitize. Distinguish application-requirement approval from institutional defense approval (informational only). |

---

## 3. Open questions — do NOT invent (§27)

**Committee:** Master's “5 panelists” meaning; Chairman seat mapping (Master's/Doctoral); Adviser in Doctoral 6; Adviser Title session attendance; Adviser scoring; Facilitator/Rapporteur signatures; every-evaluator-signs-everything; same composition all stages; committee reuse.

**Scoring/conclusion:** who records official outcome; whether average auto-determines pass/fail; official GS-011 result categories; `REVISION` vs re-defense semantics; who clears corrections.

**Forms/signatures:** Dean→VPAA→President digital vs wet; when schedule is official; GS-011 signature mode; Adviser “Concurred In” scope; RAP e-sign roles; GS-022 usage; GS-011 six-row vs Master's layout.

**Requirements:** who records Research Variables `NOT_APPLICABLE`; STRIKE/statistician/instruments as Final gates; physical items office-tracking; “7 digital copies” meaning; Final copy counts; legacy 8-hard-copies/3-day rule; semester gap Proposal→Final.

Until answered: keep behavior **configurable/deferred**, not hard-coded.

---

## 4. Target domain state model (Phase B)

Keep physical tables pragmatic (§5 allows retaining `ThesisRecord` during migration) but **separate concepts in the domain**:

```text
ApplicationStatus   DRAFT → SUBMITTED → UNDER_REVIEW
                      ├→ FOR_COMPLIANCE → RESUBMITTED → UNDER_REVIEW
                      ├→ REJECTED → (resubmit) → SUBMITTED
                      ├→ WITHDRAWN
                      └→ APPROVED

DefenseSessionStatus  UNSCHEDULED → SCHEDULED → IN_PROGRESS
                      → AWAITING_CONCLUSION → CONCLUDED
                      | RESCHEDULED | CANCELLED

AcademicOutcome       PASSED | REVISION_REQUIRED | FAILED   (only via conclusion)

StageCompletion       derived: NOT_STARTED | ELIGIBLE | APPLICATION_IN_PROGRESS
                      | DEFENSE_IN_PROGRESS | POST_DEFENSE_IN_PROGRESS
                      | COMPLETE | BLOCKED
```

**Mapping from current `ThesisStatus` (migration-friendly):**

| Current `ThesisRecord.status` | ApplicationStatus | SessionStatus | Outcome |
|---|---|---|---|
| PENDING | SUBMITTED (or UNDER_REVIEW) | — | — |
| APPROVED | APPROVED | UNSCHEDULED | — |
| REJECTED | REJECTED (or FOR_COMPLIANCE if we adopt that label later) | — | — |
| SCHEDULED | APPROVED | SCHEDULED | — |
| PASSED | APPROVED | CONCLUDED | PASSED |
| FAILED | APPROVED | CONCLUDED | FAILED |
| REVISION | APPROVED | CONCLUDED | REVISION_REQUIRED |

**Phase B approach (minimal, reversible):** add explicit columns/fields rather than a full rewrite:

- `ThesisRecord.applicationStatus` (enum) — or keep `status` as application lifecycle and **stop** writing outcome into it.  
- `ThesisRecord.outcome` (nullable enum `DefenseOutcome`) — set only by conclusion.  
- `DefenseSchedule.sessionStatus` (enum) — set by schedule/conclusion/score-readiness.  
- `DefenseConclusion` table (or extend `OralExamSummary`) with `outcome`, `selectedTitleId`, `concludedBy`, `concludedAt`.  
- Derived `getStageCompletion(thesisId)` in domain service (not a stored enum at first).

**Invariant tests (Phase B):** application review API cannot set outcome; `isStageUnlockedByPriorStatus` only PASSED; REVISION does not unlock; stage flip (`updateThesisToProposal`) requires prior completion helper, not merely status string.

---

## 5. Phase-by-phase plan with exact files

### Phase B — Workflow-state corrections (Phase 1)

**Goal:** separate application review / session / outcome; derived stage completion; REVISION safe interim. **Do not** yet rewrite scoring side effects (that is Phase E) except where required to stop review APIs from writing outcomes (already partly done).

**Files:**

| Action | Path |
|---|---|
| Modify | `backend/prisma/schema.prisma` |
| Create | `backend/prisma/migrations/*_workflow_state_split/` (via `prisma migrate dev`) |
| Modify | `backend/src/interfaces/defense-eligibility.interfaces.ts` (or new `defense-workflow.interfaces.ts`) |
| Modify | `backend/src/services/defense-workflow.rules.ts` |
| Modify | `backend/src/services/defense-workflow.rules.test.ts` |
| Modify | `backend/src/services/thesis.service.ts` (`updateDefenseStatus`, resubmit, stage-transition helpers) |
| Modify | `backend/src/repositories/thesis.repository.ts` (`updateThesisStatus`, `resubmitApplication`, `updateThesisToProposal/Final`) |
| Modify | `backend/src/services/defense-eligibility.service.ts` (unlock checks use outcome/prior-stage completion, not overloaded status alone) |
| Modify | `backend/src/services/defense-eligibility.service.test.ts` |
| Create | `backend/src/services/stage-completion.ts` + test (derived completion) |
| Touch only if needed | `backend/src/controllers/thesis.controller.ts` |

**Tests:** status transition guards; REVISION does not unlock Proposal/Final; application approve/reject cannot set PASSED; derived completion matrix (passed without RAP ≠ COMPLETE).

**Migrations:** additive enums/columns + backfill from existing `status` mapping table above. No destructive drop of `ThesisStatus` yet.

---

### Phase C — Stage-specific requirements (Phase 2)

**Goal:** stage-scoped COR, fee proof, adviser certification; requirement provenance; conditional Research Variables; demote unconfirmed Final gates.

**Files:**

| Action | Path |
|---|---|
| Modify | `backend/prisma/schema.prisma` (`ThesisDocument.stage` or `DefenseRequirementEvidence`; `ResearchVariableForm` NOT_APPLICABLE; optional `verificationStatus`) |
| Create | migration |
| Modify | `backend/src/interfaces/defense-eligibility.interfaces.ts` (snapshot fields: stage-scoped booleans / evidence refs; `researchVariables: APPROVED \| NOT_APPLICABLE \| PENDING`) |
| Modify | `backend/src/repositories/defense-eligibility.repository.ts` (stage filters on docs + `AdviserCertification.defenseStage`) |
| Modify | `backend/src/services/defense-eligibility.service.ts` + tests |
| Modify | `backend/src/repositories/thesis.repository.ts` (`createTitleDefense`, `updateThesisToProposal`, `updateThesisToFinal` write stage-tagged evidence) |
| Modify | `backend/src/services/thesis.service.ts` (pass stage on uploads) |
| Modify | `backend/src/controllers/thesis.controller.ts` (proposal/final accept receipt + cor fields consistently after route cleanup in D — if routes not yet fixed, keep current field names and tag stage in service) |
| Modify | `backend/prisma/seed.ts` (stage-scoped fixtures; vars N/A case) |

**Rules to encode:**

- Distinguish Title package vs Proposal Chapters (new docType or `stage` discriminator; stop both → `PROPOSAL_CHAPTERS` without stage).  
- `adviserCertIssued` → `adviserCertIssuedForStage(PROPOSAL|FINAL)` using `defenseStage`.  
- `cor`/`receipt` must match current application stage (or linked current verified COR — prefer stage-associated upload for now).  
- Research Variables: `NOT_APPLICABLE` satisfies Proposal; `APPROVED_BY_PANEL` satisfies; `PENDING` blocks.  
- STRIKE / instruments / statistician: **not** in default Final gate set; config flags default **off**.  
- Reuse internal RAP for prior-stage eligibility (already `titleRapSigned` / `proposalRapSigned` — keep).  
- Physical items remain UI instructions only (Phase G).

**Tests:** Title receipt does not satisfy Proposal; Proposal cert does not satisfy Final; historical COR does not satisfy later stage; vars N/A allows Proposal; STRIKE missing does **not** block Final when flag off; STRIKE blocks only when flag on.

---

### Phase D — Committee and scheduling (Phases 3–4)

**Goal:** real program type; confirmed session totals + Fac/Rap; no auto-ADVISER seat; clean duplicate routes; server-side committee validation.

**Files:**

| Action | Path |
|---|---|
| Modify | `backend/src/interfaces/defense-committee.interfaces.ts` (program-keyed policy; session totals; configurable scorer counts) |
| Modify | `backend/src/services/defense-committee.policy.ts` + `defense-committee.policy.test.ts` |
| Modify | `backend/src/services/thesis.service.ts` (`scheduleDefense`: pass real programType; remove auto-ADVISER inject; optional explicit adviser seat only) |
| Modify | `backend/src/repositories/thesis.repository.ts` (`scheduleDefense` write sessionStatus; return program info for policy) |
| Modify | `backend/src/routes/thesis.routes.ts` (**dedupe** proposal, final, schedule, lobby) |
| Modify | `backend/src/controllers/thesis.controller.ts` (consistent proposal/final field handling: `document`, `cor`, `receipt`) |
| Modify | frontend scheduling components only if API contract changes: `frontend/src/components/admin/defense-scheduling/*` |
| Modify | `frontend/src/types/index.ts` if DTO fields change |
| Modify | `backend/src/services/defense-eligibility.service.ts` (`evaluateSchedule` + committee validation order) |

**Policy config shape (confirmed only):**

```text
MASTERS:   sessionTotal = 7
           facilitator = 1, rapporteur = 1
           panelistRows max = 4 (GS-006) OR configurable "academic committee 5" — NOT hard-coded as 5 scorers
           adviserSeat = optional explicit (not auto)
DOCTORAL:  sessionTotal = 8
           facilitator = 1, rapporteur = 1
           panelistRows max = 6
           adviserSeat = optional explicit (not auto) until seat question answered
evaluatorRoles: CHAIRMAN, PANELIST   // Adviser scoring = OPEN
```

**Route cleanup target (one each):**

- `POST /defense/proposal` — fields `document`, `cor`, `receipt`  
- `POST /defense/final` — fields `document`, `cor`, `receipt`  
- `POST /defense/:id/schedule`  
- `GET /defense/:scheduleId/lobby`

**Tests:** Fac/Rap required; session total enforced; unknown programType rejects; duplicate user rejected; auto-ADVISER gone; Title still no adviser seat; panelist max not set to 5 scorers for Master's.

---

### Phase E — Formal conclusion / progression (Phase 5)

**Goal:** score submission never concludes; single conclusion transaction; stage progression from conclusion only.

**Files:**

| Action | Path |
|---|---|
| Modify | `backend/src/repositories/thesis.repository.ts` (`submitOralExamScore` strip outcome/RAP/summary side effects; `concludeDefense` become sole writer; add already-concluded guard) |
| Create | `backend/src/services/defense-conclusion.service.ts` + test (authz interim + preconditions + title selection) |
| Modify | `backend/src/services/thesis.service.ts` (`submitOralExamScore`, `concludeDefense`) |
| Modify | `backend/src/services/defense-workflow.rules.ts` + tests (scoring complete → AWAITING_CONCLUSION only) |
| Modify | `backend/src/controllers/thesis.controller.ts` (`concludeDefense` authz + body validation) |
| Modify | `backend/src/routes/thesis.routes.ts` (conclude: role guard interim) |
| Modify | `backend/prisma/schema.prisma` if `DefenseConclusion` / `DefenseSchedule.sessionStatus` finalized in B |
| Minimal touch | panelist lobby UI only if it assumed auto-pass (`frontend/src/app/(portal)/panelist/defense-lobby/[scheduleId]/page.tsx`) — **no scoring UX redesign** |

**`submitOralExamScore` after Phase E:**

1. Validate assignment + evaluator role.  
2. Persist `OralExamScore`.  
3. If all evaluator scores present → set session `AWAITING_CONCLUSION` (and optional derived `OralExamSummary` **without** final academic rating mutation — or skip summary until conclusion).  
4. **Never** set Thesis outcome, **never** create RAP.

**`concludeDefense` after Phase E:**

1. Authz (interim ADMIN).  
2. Not already concluded.  
3. Required scores complete (or explicit override flag **not** implemented until client asks).  
4. Title + PASSED → valid `selectedTitleId` from proposed titles.  
5. Write conclusion record (outcome + title + actor + timestamp).  
6. Update thesis stage outcome field (not overloaded review status).  
7. Session → CONCLUDED.  
8. Create RAP draft **once** (signature policy still interim until Phase F).  
9. Recompute stage completion / next-stage eligibility.

**Tests:** last score does not change outcome; RAP count unchanged by scoring; conclude twice fails; Title conclude without title fails; only PASSED unlocks next stage.

---

### Phase F — RAP / signatures / post-defense dependencies (Phase 6)

**Goal:** RAP progression supports eligibility; do **not** invent unresolved signatory policy.

**Files:**

| Action | Path |
|---|---|
| Modify | `backend/prisma/schema.prisma` (`RapReportSignature.roleAtDefense`, `required` nullable/optional) |
| Create | migration |
| Modify | `backend/src/services/defense-conclusion.service.ts` or new `rap-workflow.service.ts` (create signature requirements via **policy function**) |
| Modify | `backend/src/services/defense-committee.policy.ts` (`getRequiredSignatoryRoles` — interim default + TODO OPEN_QUESTION) |
| Modify | `backend/src/repositories/thesis.repository.ts` (`signRapReport`, `distributeRapReport`) |
| Modify | `backend/src/services/defense-eligibility.repository.ts` (RAP finalized status alignment: ALL_SIGNED/FINALIZED) |
| Tests | signature slots created from policy function; interim default documented; eligibility uses finalized RAP only |

**Interim policy function (explicitly UNRESOLVED):** currently all assigned participants. Structure so swapping to form-specific sets (GS-011 Chairman/Members + Adviser concurrence + Dean attestation) is a config change, not a rewrite.

**Post-defense progression:** Final completion still requires conclusion PASSED + (future) corrections/clearance. Grammarian / corrected manuscript / databank gates stay **stubbed as derived COMPLETE checks**, not invented workflows. Do not build corrections actor until OPEN_QUESTION answered.

---

### Phase G — UI alignment (Phase 7)

**Goal:** remove mock/hard-coded requirement states; UI reflects backend eligibility. No panelist collaboration redesign.

**Files:**

| Action | Path |
|---|---|
| Modify | `frontend/src/app/(portal)/student/thesis/page.tsx` (pipeline cards from eligibility/read model) |
| Modify | `frontend/src/app/(portal)/student/thesis/title-defense/page.tsx` |
| Modify | `frontend/src/app/(portal)/student/thesis/proposal-defense/page.tsx` (remove mock verified + 7-copy UI or mark deferred) |
| Modify | `frontend/src/app/(portal)/student/thesis/final-defense/page.tsx` (remove mock STRIKE + mock verified) |
| Modify | `frontend/src/app/(portal)/student/thesis/adviser-request/page.tsx` (surface missing CONFORME step as informational if not yet backend-complete) |
| Modify | `frontend/src/app/(portal)/admin/thesis/applications/page.tsx` + `components/admin/defense-applications/*` |
| Modify | `frontend/src/app/(portal)/admin/thesis/scheduling/page.tsx` + `components/admin/defense-scheduling/*` (program totals; no auto-adviser; Fac/Rap counts) |
| Touch minimally | `frontend/src/app/(portal)/panelist/defense-lobby/[scheduleId]/page.tsx` (status labels only if they imply auto-pass) |
| Modify | `frontend/src/types/index.ts` |

**API:** ensure a student-facing eligibility/requirements read endpoint returns the same `MissingRequirement[]` / evidence provenance the service uses (extend existing journey or add `GET /thesis/eligibility/:stage`). Prefer extending `DefenseEligibilityService` read models over UI-only checks.

**Tests:** component-level where cheap; otherwise assert DTO shapes. Full E2E is Phase 8.

---

## 6. Acceptance traceability (spec §26 + §35)

| Tests (spec) | Phase |
|---|---|
| 1–10 Title eligibility / conclusion / unlock | B, C, E |
| 11–20 Proposal gates / vars N/A / stage-scope | C, E |
| 21–29 Final gates / STRIKE non-blocking / repository block | C, E, F |
| 30–35 Committee composition / roles / no duplicate / no auto-adviser seat | D |
| 36–40 Security (score, conclude, no double conclude, RAP signatories, audit) | E, F |
| 41–45 Routes uniqueness / upload fields | D |
| 46–65 Forms / generated documents | **Deferred** (documented; not core refactor) |
| 66–73 Title package, fee proof stage-scope, COR, vars N/A, physical, deferred PDFs, STRIKE config | C, G |

---

## 7. Spec inconsistency note (resolve before Phase D hard-coding)

§24 P0 says “Master's evaluator count = 5, Doctoral = 6.”  
§12.5 / §25 Phase 3 / test 30 say **do not hard-code 5 Master's scorers**.

**Decision for this refactor:** follow the careful wording — enforce **7/8 session totals** + Facilitator + Rapporteur + GS-006/GS-007 row maxima; keep scorer counts configurable; never hard-code 5 Master's evaluators (user instruction + §12.5).

---

## 8. Older plan/spec conflict log

| Source | Conflict with source of truth | Resolution |
|---|---|---|
| `specs/2026-09-15-defense-eligibility-design.md` §4.1 | STRIKE / instruments / statistician as Final **gates** | Source of truth §11.2–11.3: `CLIENT_CONFIRMATION_REQUIRED` → config default off |
| Same, §4.1 Research Variables always required | §10.3.1 conditional `IF ANY` | Implement NOT_APPLICABLE |
| Same, status flow `PENDING → APPROVED → SCHEDULED → PASSED\|FAILED\|REVISION` | §6 separates application/session/outcome | Phase B split |
| Same, `conceptPaper` ≡ `PROPOSAL_CHAPTERS` | §16.2 stage-specific types | Phase C stage-tag / distinct types |
| `plans/2026-09-15-defense-eligibility.md` snapshot `adviserCertIssued` any stage | §16.3 stage-scoped cert | Phase C |
| Historical UI “7 digital copies” | §10.5 OPEN / PROJECT_REFERENCE | Do not model 7 uploads |
| Legacy adviser-before-Title | §3.2 CONFIRMED_CLIENT no adviser | Already correct — preserve |

---

## 9. Phase A deliverables checklist

- [x] Read source of truth completely (2392 lines)  
- [x] Review `docs/superpowers/specs/` and `docs/superpowers/plans/`  
- [x] Audit current branch implementation  
- [x] Identify exact affected files per phase (§5)  
- [x] Produce/update this implementation plan  
- [x] Separate confirmed rules (§2) from open questions (§3)  
- [x] No production code modified  

**Stop here.** Awaiting explicit go-ahead for **Phase B**.
