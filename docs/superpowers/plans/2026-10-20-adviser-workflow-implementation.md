# Adviser Workflow and My Advisees — Implementation Plan

**Date:** 2026-10-20  
**Last Updated:** 2026-10-21  
**Repository:** MuelTech/graduate-system  
**Baseline branch:** `main`  
**Baseline HEAD:** `467e0bebcefb2cb24aaacfe3bf5fc5750652e308`  
**Implementation branch:** `refactor/adviser-workflow`  
**Parent workflow authority:** `docs/superpowers/DEFENSE_WORKFLOW_SOURCE_OF_TRUTH.md`  
**Cross-cutting verification authority:** `docs/superpowers/ENGINEERING_VERIFICATION_POLICY.md`  
**Plan status:** COMPLETE / ACCEPTED — ADV-0 through ADV-8 are CLOSED. Final accepted Adviser product-code HEAD: `e887623921d0e5d38e17fdf9b70b5509e207274d` (`fix(adviser): fail closed on duplicate review authority`). ADV-8 final re-verification passed on 2026-10-21. Project-owner visual acceptance covers the final My Advisees main-workspace design; coding-agent final-gate browser QA was NOT EXECUTED and hosted CI was NOT OBSERVED.

---

## 0. Purpose

This plan completes the Adviser-facing workflow around the already-existing GS-020 Adviser Request, active AdviserAssignment, Proposal/Final Adviser manuscript review, Admin scheduling, and defense-history records.

The initiative has two goals:

1. correct the current Proposal/Final Admin Scheduling defect that resolves the Adviser from a legacy ThesisRecord relation instead of the Student's active AdviserAssignment; and
2. provide a coherent **My Advisees** workspace so an Adviser can understand and act on the longitudinal research context of the Students they supervise.

This is not a replacement for the defense workflow, Collaborative Defense Workspace, Student Thesis Journey, or Admin Student Management. It integrates existing authorities under one consistent Adviser relationship.

No separate specs document is required for this initiative. The Defense Workflow Source of Truth contains the canonical rules; this file owns the implementation sequence and package boundaries.

---

## 1. Current implementation facts / audit findings

### 1.1 Canonical assignment creation already exists

The current GS-020 path is already implemented:

Student Adviser Request -> requested Adviser CONFORME -> Dean APPROVED -> `AdviserAssignment` with `isActive = true`.

The Adviser Request itself is not an active Adviser relationship.

### 1.2 Proposal/Final gates already require an active Adviser

Proposal application, Proposal Adviser review/certification, Final Adviser review/certification, and schedule-time eligibility already rely on or re-check an active Adviser relationship.

Therefore a normal approved Proposal/Final application that reaches **Ready for Scheduling** is expected to have an active Adviser.

### 1.3 Current Admin Scheduling defect

The Admin Scheduling frontend derives its automatic Adviser row from the application projection's legacy `ThesisRecord.assignment -> adviser` relation.

However, the active Adviser is created later through `AdviserAssignment`, and the current Adviser workflow does not retroactively make `ThesisRecord.assignmentId` the canonical pointer.

This produces the observed mismatch:

```text
Student has active AdviserAssignment                  YES
Proposal eligibility / Adviser review sees Adviser   YES
Admin application can become Ready for Scheduling    YES
Scheduling projection sees ThesisRecord.assignment   NULL / STALE
Scheduling UI shows "Active thesis adviser not found"
```

This is a read-model integration bug, not a valid Proposal state.

### 1.4 Adviser-facing features already exist but are fragmented

Current Adviser/Panelist capabilities include:

- Adviser Request inbox / CONFORME or decline;
- Proposal Adviser Review queue;
- Final Adviser Review queue;
- Request Changes;
- Adviser Certification/e-sign;
- Panelist Dashboard task aggregation;
- My Defenses / Defense Workspace;
- Committee Report signing when required.

There is no accepted longitudinal **My Advisees** workspace that ties those responsibilities to the Student's research history.

### 1.5 Document authorization needs hardening review

The shared thesis-document read path currently recognizes active Adviser status. Because administrative evidence and academic manuscripts can coexist under ThesisDocument, this initiative must prove that active Adviser authority does not accidentally become blanket access to COR, receipts, or unrelated evidence.

---

## 2. Canonical invariants for implementation

1. **Active `AdviserAssignment` is the current Adviser authority.**
2. `ThesisRecord.assignmentId` is compatibility data and must not drive current Adviser resolution.
3. Incoming Adviser Requests are not Active Advisees.
4. Proposal/Final scheduling derives the automatic Adviser from the active AdviserAssignment and re-checks it on the server.
5. Admin cannot replace the automatic Adviser in Scheduling.
6. Title Defense has no Adviser committee seat.
7. My Advisees is academic supervision, not Admin Student Management.
8. Adviser document access is research-scoped; active Adviser status alone does not authorize COR/payment/admin evidence.
9. Student Journey / domain services remain progression authority; My Advisees does not calculate a second workflow state.
10. Historical concluded defense attempts remain immutable.
11. New current Advisers may read the minimum prior academic research history necessary for supervision, subject to explicit document/record boundaries.
12. Former inactive Advisers lose active-advisee authority; any historical access must come from another valid recorded authority.
13. Adviser is not a numerical evaluator of their own advisee under the current accepted evaluator policy.
14. Adviser may be a required Proposal/Final Committee Report signer without gaining evaluator authority.
15. Do not expose other users' raw signature data/private signature evidence.

---

## 3. Target Adviser information architecture

Target Panelist navigation:

```text
Dashboard
My Defenses
My Advisees
Profile
...
```

Adviser-specific standalone navigation is consolidated under My Advisees after the replacement routes are proven.

### 3.1 My Advisees parent workspace

Recommended task/context modes:

- **Active Advisees**
- **Adviser Requests**
- **Manuscript Reviews**

These are semantic workflow groupings, not three independent authority models.

### 3.2 Active Advisees

A row should answer:

- Who is the Student?
- What program are they in?
- What research stage are they currently in?
- What is the current working title when available?
- Is there an Adviser action waiting?
- When was the Adviser relationship established?

The server must return only Students whose active AdviserAssignment belongs to the authenticated user.

### 3.3 Adviser Requests

Shows Adviser Requests where `requestedAdviserId` is the authenticated Panelist.

The user may CONFORME or decline according to the existing GS-020 transition rules.

A pending/conformed request must not be presented as an active advisee until Dean APPROVED has created the active AdviserAssignment.

### 3.4 Manuscript Reviews

Shows Proposal/Final manuscript reviews where the authenticated user is the current active Adviser.

Actions continue to use the existing manuscript-review authority:

- inspect exact current review document;
- Request Changes;
- Certify & Sign;
- observe immutable ISSUED certification.

---

## 4. Advisee detail target

Suggested route:

`/panelist/advisees/[studentId]`

The detail page is longitudinal and read-mostly.

### 4.1 Overview

May contain:

- Student name;
- Student number;
- program;
- current research/thesis stage from authoritative journey/domain state;
- current working title when available;
- Adviser relationship status/date;
- concise next Adviser responsibility.

Do not include Admin account/enrollment mutation controls.

### 4.2 Research documents

Expose only documents that are relevant and authorized for academic supervision.

Initial allow-list/product scope:

- Title Defense Proposal Package;
- Proposal manuscript;
- Final manuscript;
- authorized manuscript version history.

Explicitly exclude from My Advisees merely-by-Adviser authority:

- COR;
- payment/receipt evidence;
- admission files;
- unrelated requirements;
- arbitrary ThesisDocument rows.

### 4.3 Defense history

The Adviser may see supervision-relevant prior context, including:

- defense stage;
- attempt date/session;
- formal verdict;
- submitted/bound research manuscript where authorized;
- finalized Committee Report / recommendations;
- relevant immutable history/re-defense attempts.

Do not automatically expose:

- private evaluator drafts;
- other users' signature blobs;
- unrestricted evaluator-by-evaluator detail;
- Admin-only repair/audit controls.

### 4.4 Adviser review context

Proposal/Final Adviser Reviews should be reachable inside the advisee context.

The page may surface the current task and history, but existing backend write endpoints remain the mutation authority unless a bounded package deliberately consolidates them without changing rules.

---

## 5. Admin Scheduling correction design

### 5.1 Read model

The Scheduling/Defense Applications projection must expose the **current active Adviser** resolved from the Student relationship, not from `ThesisRecord.assignmentId`.

Prefer an explicit field such as:

```ts
activeAdviser: {
  assignmentId: string;
  userId: string;
  firstName: string;
  lastName: string;
} | null
```

Naming may vary, but the response must not imply the legacy ThesisRecord relation is authoritative.

### 5.2 Frontend

Proposal/Final Scheduling:

- render the active Adviser as locked **Automatic**;
- include that Adviser in readiness/session participant count;
- submit the derived Adviser seat with the remaining committee assignments;
- never offer Adviser selection/edit from the committee picker.

Title:

- no Adviser row.

### 5.3 Server mutation

`scheduleDefense` continues to resolve/re-check the active Adviser independently.

Never trust a client-supplied Adviser userId without matching it to the current active AdviserAssignment.

### 5.4 Legacy mismatch cases

Add explicit regression behavior for:

- `ThesisRecord.assignmentId = null` + valid active AdviserAssignment -> scheduling works;
- stale legacy assignmentId + newer active AdviserAssignment -> active assignment wins;
- no active AdviserAssignment -> Proposal/Final scheduling blocked;
- invalid duplicate active AdviserAssignments -> do not silently choose arbitrary authority.

No schema migration is expected for the basic fix. Do not add one merely to re-link every ThesisRecord.

---

## 6. Package sequence

Packages are intentionally bounded. The coding agent must stop after each package and report exact evidence before proceeding unless the project owner explicitly authorizes grouped execution.

**Working protocol:** repository documentation/status synchronization is maintained by the project-planning ChatGPT session after independent review and acceptance. The coding agent is implementation-only by default and should not edit canonical documentation unless explicitly instructed for a package-specific reason.

### ADV-0 — Documentation / baseline lock

**Status:** COMPLETE by this documentation commit.

Scope:

- create `refactor/adviser-workflow` from verified `main`;
- update Defense Workflow SOT;
- add this implementation plan;
- no product code.

Verification:

- exact diff/reference review;
- Markdown/reference sanity;
- no claim of product/runtime verification.

### ADV-1 — Admin Scheduling active-Adviser resolution fix

**Status:** ACCEPTED / CLOSED

Accepted implementation:
- core ADV-1: `4992fc8306694f8ff37d8616a6fb39f06377b34c` — `fix(adviser): resolve scheduling adviser from active assignment`
- bounded FIX-1 read-model cleanup: `b1a83ec8bba91247c03b9411ff2531210ae3dc2f` — `fix(adviser): keep active adviser rows out of application dto`
- independent remote source review: PASS
- project-owner manual browser QA of the reproduced Proposal Scheduling defect: PASS
- hosted CI: NOT OBSERVED / NOT CLAIMED
- schema/migration: NONE

Accepted result: a legitimate Proposal/Final application resolves its automatic Adviser from the Student's active `AdviserAssignment`; null/stale `ThesisRecord.assignmentId` no longer hides the Adviser; duplicate active assignments fail closed; the internal `student.adviserAssignments` rows are not serialized as a second public authority path.

Goal: fix the reproduced Admin Proposal/Final scheduling defect.

Expected scope:

- Defense Applications/Scheduling read model;
- Scheduling frontend adviser resolution;
- targeted committee/read-model tests;
- stale legacy-link regression.

Acceptance invariants:

- valid active AdviserAssignment appears automatically;
- `ThesisRecord.assignmentId` may be null/stale without hiding the current Adviser;
- no active Adviser blocks Proposal/Final;
- Title remains adviser-free;
- Master's/Doctoral participant counts remain unchanged;
- no schema migration unless evidence proves one is necessary.

Verification proportional to bounded backend + frontend wiring:

- focused repository/service/policy tests;
- directly affected scheduling regressions;
- backend build/type validation when affected;
- frontend TypeScript + scoped lint for changed frontend source;
- production frontend build when route/API/type wiring makes it materially useful;
- `git diff --check`;
- manual browser QA recorded separately if executed.

### ADV-2 — Adviser read model + authorization foundation

**Status:** ACCEPTED / CLOSED

Accepted implementation:
- core ADV-2: `bea0ade4260a3a707a9f47e10dd320b83179891d` — `feat(adviser): add scoped adviser workspace read model`
- bounded FIX-1: `6e042a3d81feff89098773a5dc81aec882fa6a8a` — `fix(adviser): detect cross-adviser duplicate active assignments`
- independent remote source review: PASS
- manual/browser QA: NOT REQUIRED / NOT EXECUTED (backend-only read/authorization foundation)
- hosted CI: NOT OBSERVED / NOT CLAIMED
- schema/migration: NONE

Accepted result:
- `GET /thesis/adviser/workspace` provides authenticated Adviser-scoped Active Advisees, Adviser Requests, and Proposal/Final Manuscript Reviews by composing existing authorities;
- `GET /thesis/adviser/advisees/:studentId` provides a bounded overview only for the Student's current active Adviser;
- cross-Adviser and former/inactive Adviser detail access fail closed without Student enumeration;
- duplicate active AdviserAssignments are detected against all active rows for candidate Students in a bounded query, including cross-Adviser conflicts;
- no historical Title Defense wording is promoted to a current working title; `workingTitle` remains null until a separately-authorized current-title source exists;
- raw AdviserAssignment relations, thesis documents, COR/payment evidence, evaluator records, and signature data are not exposed by this read model.

Goal: add Adviser-scoped read models for My Advisees without UI consolidation yet.

Expected capabilities:

- active advisee list for authenticated Adviser;
- incoming request projection;
- review-task projection/reuse;
- advisee detail overview;
- server-side current-Adviser authorization.

Security focus:

- no cross-adviser Student access;
- no arbitrary StudentId enumeration;
- inactive/former Adviser denied active workspace;
- external Panelist cannot become active Adviser under existing rules;
- no raw private signature data.

### ADV-3 — My Advisees main workspace

**Status:** IMPLEMENTED / INDEPENDENT SOURCE REVIEW PASS — PROJECT-OWNER VISUAL QA DEFERRED

Implementation:
- `69f55d83d79a318c16d7a30207821ba10b19f399` — `feat(adviser): add my advisees workspace`
- independent remote source review: PASS
- reported focused verification: frontend TypeScript PASS; scoped ESLint PASS; ADV-3 verifier 11/11 PASS; `git diff --check` PASS
- manual/browser QA: NOT EXECUTED by coding agent; project owner explicitly chose to continue to ADV-4 before visual inspection, so visual QA remains deferred rather than passed
- hosted CI: NOT OBSERVED / NOT CLAIMED
- backend/schema changes: NONE

Implemented result:
- new `/panelist/advisees` parent workspace consumes the accepted single `GET /thesis/adviser/workspace` read model;
- three modes are present: Active Advisees, Adviser Requests, Manuscript Reviews;
- My Advisees is discoverable in Panelist navigation while legacy Adviser Requests / Adviser Reviews entries remain for compatibility until ADV-7;
- active-advisee cards do not infer a current working title from historical Title Defense wording;
- Adviser Requests reuse the existing GS-020 status helpers and label historical wording as `Title Defense title`;
- Manuscript Reviews use faculty-facing stage/status wording and retain existing Adviser Reviews as the mutation surface;
- loading, error/integrity, and empty states are distinct;
- no advisee-detail route, request/review mutation consolidation, history/documents exposure, redirects, or later ADV package work was introduced.

Goal: implement the parent Adviser workspace.

UI:

- Active Advisees;
- Adviser Requests;
- Manuscript Reviews;
- loading/error/empty distinctions;
- task-oriented filters/search only if justified by real data volume.

Use existing UI/UX playbook hierarchy and vocabulary. Do not create Admin-like Student Management controls.

### ADV-4 — Advisee detail + research overview

**Status:** IMPLEMENTED / INDEPENDENT SOURCE REVIEW PASS — PROJECT-OWNER VISUAL QA PENDING

Implementation:
- `9b032d439f0432fa7e908a4e6b568c1339dfc7ec` — `feat(adviser): add advisee detail overview`
- independent remote source review: PASS
- reported focused verification: frontend TypeScript PASS; scoped ESLint PASS; ADV-4 verifier 16/16 PASS; retained ADV-3 verifier 11/11 PASS; `git diff --check` PASS
- manual/browser QA: NOT EXECUTED by coding agent; project owner explicitly chose to continue before visual inspection, so visual QA remains deferred rather than passed
- hosted CI: NOT OBSERVED / NOT CLAIMED
- backend/schema changes: NONE

Implemented result:
- new `/panelist/advisees/[studentId]` detail page consumes only the accepted exact-advisee endpoint;
- Active Advisee cards now expose a bounded `View advisee` link while Adviser Requests remain non-advisee request context;
- the detail page shows Student identity, research stage, active Adviser relationship/date, and current review context;
- next Adviser responsibility is derived only from accepted review-task context and does not create a second thesis-progression authority;
- current working title is rendered only from `research.workingTitle`; no historical Title Defense wording is promoted to current title;
- 404, integrity conflict, generic error, and loading states are distinct and non-enumerating;
- no direct document/file access, Defense History, Committee Report, request/review mutation controls, or later ADV package work was introduced.

Goal: add the bounded longitudinal advisee-detail surface on top of the already-accepted ADV-2 exact-detail read model.

Include:

- Student/program identity;
- current research stage;
- current working title only when separately authorized and present;
- Adviser relationship/date;
- concise next Adviser responsibility derived from the accepted review-task context;
- research/review summary without exposing direct document files.

ADV-4 must consume the existing `GET /thesis/adviser/advisees/:studentId` authority. It must not add a parallel Student lookup or broaden backend access.

**Boundary with ADV-5:** direct research-document listing/download, manuscript history, defense history, finalized Committee Reports, and any adviser document-authorization hardening remain ADV-5. ADV-4 may summarize current Proposal/Final review context but must not introduce new document/file links from the detail page.

### ADV-5 — Academic document/history integration + access hardening

**Status:** IMPLEMENTED / INDEPENDENT SOURCE REVIEW PASS — PROJECT-OWNER VISUAL QA PENDING

Implementation:
- `e3c64450495ee4c9a378c7a877f67783a0d52b8d` — `feat(adviser): harden document access and expose history`
- independent remote source review: PASS
- reported security-focused backend verification: 8 focused/directly related test files, 80/80 PASS; backend TypeScript build PASS
- reported frontend verification: TypeScript PASS; scoped ESLint PASS; ADV-5 verifier 8/8 PASS; retained ADV-4 verifier 16/16 PASS; retained ADV-3 verifier 11/11 PASS; `git diff --check` PASS
- manual/browser QA: NOT EXECUTED by coding agent; project-owner visual inspection pending
- hosted CI: NOT OBSERVED / NOT CLAIMED
- schema/migration: NONE

Accepted source behavior:
- the former blanket active-Adviser `thesis-document` grant is removed;
- active-Adviser-derived file access now requires exactly one active Adviser row owned by the caller plus a valid academic document identity: `TITLE_PROPOSAL/TITLE`, `PROPOSAL_CHAPTERS/PROPOSAL`, or `FINAL_MANUSCRIPT/FINAL` (legacy null stage only when safely implied by the academic type);
- COR, RECEIPT, INSTRUMENTS, RESPONDENT_DATA, PLAGIARISM_REPORT, ambiguous rows, and contradictory academic type/stage identities no longer pass merely by Adviser status;
- owner/Admin and existing independent committee authorities remain separate and intact;
- exact advisee detail now returns deliberate academic research-document metadata and same-thesis concluded defense history only after current active-Adviser authorization succeeds;
- defense history uses only exact `DefenseSchedule.manuscriptDocumentId` bindings, hides invalid/missing bindings, exposes only FINALIZED Committee Report content, and excludes evaluator scores/criteria, annotations/comments, raw signatures, storage internals, and Admin repair data;
- the frontend adds read-only Research Documents and Defense History surfaces using the authenticated document viewer and safe Committee Report renderer, without moving Adviser request/review mutations into My Advisees.

Goal: expose the right academic research documents and immutable defense history to the current active Adviser while narrowing generic thesis-document authorization.

Pre-implementation audit finding:
- `backend/src/services/document.service.ts::canPanelistAccessThesisDocument` currently returns `true` immediately when the caller appears in the Student's active Adviser assignments.
- Because that early return happens before document-type filtering, an active Adviser can currently pass the generic `thesis-document` authorization check for same-thesis non-manuscript evidence such as COR/RECEIPT. Existing unit coverage explicitly preserves that behavior.
- ADV-5 must remove that blanket active-Adviser grant and replace it with an explicit academic-document allow-list / stage identity rule.

Academic Adviser document scope:
- Title Defense Proposal Package (`TITLE_PROPOSAL`);
- Proposal manuscripts (`PROPOSAL_CHAPTERS`);
- Final manuscripts (`FINAL_MANUSCRIPT`);
- authorized manuscript version/history rows for the same thesis where the document type/stage identity is valid.

Explicitly excluded merely-by-Adviser authority:
- COR;
- RECEIPT/payment evidence;
- INSTRUMENTS;
- RESPONDENT_DATA;
- PLAGIARISM_REPORT;
- arbitrary or ambiguous ThesisDocument rows;
- admission/account/Comprehensive Examination evidence;
- private evaluator drafts/scores/signature data.

History scope:
- immutable concluded defense attempts for the advisee's thesis;
- stage/date/formal verdict;
- exact attempt-bound manuscript identity when valid;
- finalized Committee Report/recommendations only;
- no private evaluator criteria/scores, raw signature blobs, or historical mutation controls.

The existing committee Defense History endpoints remain assignment-scoped to a current defense schedule and must not be repurposed by weakening their authorization. Adviser history should be exposed through the Adviser workspace/detail authority or a dedicated Adviser-scoped read path that first proves the current active Adviser relationship.

Required negative tests:

- current active Adviser can read allow-listed Title/Proposal/Final academic documents for own active advisee;
- active Adviser cannot read COR solely because it belongs to the same ThesisRecord;
- active Adviser cannot read receipt/payment evidence solely because it belongs to the same ThesisRecord;
- active Adviser cannot read instruments/respondent-data/plagiarism evidence solely by Adviser status;
- Adviser cannot read another Adviser's Student/documents/history;
- inactive former Adviser does not retain active workspace/document/history access;
- duplicate active Adviser state fails closed;
- ambiguous/mismatched manuscript stage/type fails closed;
- history uses exact concluded attempt bindings and never substitutes a latest/current manuscript;
- only FINALIZED Committee Report content is surfaced as official history; raw signature evidence and evaluator-private data remain excluded.

This package has a security/authorization blast radius and therefore justifies broader directly related document-authorization/history regressions under ENGINEERING_VERIFICATION_POLICY.

### ADV-6 — Adviser Requests + Adviser Reviews integration

**Status:** ACCEPTED / CLOSED at FIX-1

Accepted implementation:
- core ADV-6: `17d158c280f769427a878404251d0943ade14f2a` — `feat(adviser): integrate request and review actions`
- bounded FIX-1: `3497cb24ba9e9b5345ab6312c0276d9f5df4ad3c` — `fix(adviser): wait for resubmission before review actions`
- independent remote source review: PASS
- reported backend verification for core ADV-6: Panelist Dashboard focused rules 21/21 PASS; backend TypeScript build PASS
- reported frontend verification after FIX-1: TypeScript PASS; scoped ESLint PASS; ADV-6 verifier 19/19 PASS; retained ADV-3 11/11 PASS; ADV-4 16/16 PASS; ADV-5 8/8 PASS; `git diff --check` PASS
- production frontend build for core ADV-6: PASS, run specifically to validate the new `useSearchParams` Suspense boundary
- manual/browser QA: NOT EXECUTED by coding agent; project-owner visual/interaction QA pending
- hosted CI: NOT OBSERVED / NOT CLAIMED
- schema/migration: NONE
- backend domain transitions: unchanged except Dashboard Adviser-task href generation

Accepted result:
- My Advisees is the primary Adviser action surface for GS-020 request response and Proposal/Final Adviser manuscript review;
- Adviser Requests reuses the existing CONFORME / Decline transition and does not locally create an active Adviser relationship before Dean approval;
- Manuscript Reviews and exact Advisee detail share one Adviser Review action panel that loads the exact stage-specific task, uses the exact manuscript as the optimistic concurrency token, preserves Final STRIKE authority, and refreshes authoritative state on stale 409 without automatic resubmission;
- `CHANGES_REQUESTED` is now correctly read-only / waiting for Student resubmission, while mutation controls are exposed only for exact `AWAITING_REVIEW` state;
- `ISSUED` remains immutable/read-only;
- My Advisees tabs and exact Adviser task context are URL-addressable, with deep-link IDs matched only against the authenticated workspace projection before opening/fetching task detail;
- Panelist Dashboard Adviser Request / Adviser Review action and waiting links deep-link into the matching My Advisees context; unrelated Dashboard links remain unchanged;
- legacy `/panelist/adviser-requests` and `/panelist/adviser-reviews` routes remain functional and reuse shared action surfaces; their sidebar entries remain until ADV-7.

Goal: make My Advisees the primary Adviser workflow surface while preserving the existing GS-020 and Proposal/Final Adviser-review mutation authorities.

Integration contract:

- Adviser Requests performs CONFORME / Decline through the existing `POST /thesis/adviser/requests/:id/adviser-response` transition. The request remains distinct from an active advisee until Dean approval creates the active AdviserAssignment.
- Manuscript Reviews and the active Advisee detail reuse the existing stage-specific task-detail and mutation endpoints for Request Changes / Certify & Sign. `expectedReviewedDocumentId` optimistic concurrency remains mandatory; stale 409 state must refresh rather than auto-retry.
- Final review STRIKE/plagiarism eligibility behavior remains exactly as enforced by the existing Final Adviser Review read model/service; My Advisees must not recreate or bypass that rule.
- Shared frontend action components/hooks are preferred so My Advisees and the retained compatibility pages do not maintain divergent copies of mutation logic.
- My Advisees becomes URL-addressable by context: `tab=requests` / `tab=reviews`, with optional request/review identifiers for deterministic Dashboard deep links. Invalid/stale identifiers must fail safely without revealing another user's data.
- Dashboard Adviser Request and Adviser Manuscript Review actions/waiting links must point into the matching My Advisees context instead of the standalone legacy pages.
- Successful mutations invalidate/refetch the My Advisees workspace, affected exact advisee detail, legacy compatibility queue when applicable, and Panelist Dashboard so the same authoritative transition is reflected everywhere.

Compatibility boundary:

- `/panelist/adviser-requests` and `/panelist/adviser-reviews` remain functional in ADV-6.
- Do not remove their sidebar entries or redirect those routes yet; ADV-7 owns navigation consolidation.
- No backend transition rule, schema, Adviser authority, document authority, or review state machine change is expected.

Do not delete compatibility routes until the integrated My Advisees actions are independently source-reviewed and visually exercised.

### ADV-7 — Navigation consolidation / compatibility redirects

**Status:** ACCEPTED / CLOSED

Accepted implementation chain:
- core ADV-7: `943d56f9b61f2b14bff92eb00e8dda3f209d9dac` — `refactor(adviser): consolidate panelist navigation`
- FIX-1 current-workflow/UX refinement: `eccc53ebd063f16ceccbecf392e1930af66c1a2b` — `fix(adviser): refine my advisees workspace ux`
- FIX-2 card/history clarity refinement: `bf5d4267af32025c339d590e6350cb5e655b7d87` — `fix(adviser): refine advisee cards and history clarity`
- FIX-2b tab containment: `94495c626ed9b27cf327bbcfa8f36dfd7dfbd100` — `fix(adviser): contain advisee tab controls`
- My Defenses-aligned segmented tabs: `df84596aaada7b7a35a8b494a76e3216aa64c6e5` — `fix(adviser): align advisee tabs with defenses`
- accepted terminology: `97869699c608f4e3f5f07a544c5079408409c1f1` — `fix(adviser): clarify advisee workspace labels`
- independent remote source review: PASS
- project-owner screenshot/manual visual review: ACCEPTED for the final My Advisees main-workspace design
- hosted CI: NOT OBSERVED / NOT CLAIMED

Accepted result:
- My Advisees is the single Panelist navigation entry for Adviser work;
- legacy Adviser Requests / Adviser Reviews index routes redirect to the corresponding URL-addressable My Advisees contexts;
- Dashboard deep links remain exact and My Defenses route-family matching remains intact;
- the accepted visible modes are **Active Advisees**, **Adviser Requests**, and **Manuscript Reviews**;
- request/review badges represent actionable workload rather than unread state; zero badges are hidden and Active Advisees has no notification-style count;
- the final tabs use the accepted My Defenses-like segmented treatment; Active Advisee cards use a compact responsive grid with a prominent full-width **Open Advisee** action;
- historical exact-manuscript absence is communicated as **Historical manuscript version not linked**, without implying that the thesis has no Research Documents.

Goal: make **My Advisees** the single canonical Adviser navigation destination now that the integrated request/review surfaces are accepted.

Required consolidation:

- retain **My Advisees** in the Panelist sidebar and remove standalone **Adviser Requests** / **Adviser Reviews** sidebar entries;
- preserve the existing legacy index URLs as compatibility redirects:
  - `/panelist/adviser-requests` -> `/panelist/advisees?tab=requests`
  - `/panelist/adviser-reviews` -> `/panelist/advisees?tab=reviews`
- redirects must not introduce a second Adviser workflow UI or perform data/mutations before redirecting;
- current Dashboard Adviser-task deep links already target exact My Advisees context and must remain unchanged;
- My Advisees must stay active for `/panelist/advisees` and nested advisee detail routes;
- My Defenses active-route behavior must remain unchanged.

Repository audit for ADV-7 found only the two legacy index pages as compatibility Adviser routes; no accepted nested legacy exact-task route requires a separate redirect contract in this package. If implementation discovers another live legacy Adviser route, stop and report it rather than guessing.

This is navigation consolidation only: no Adviser authority, request/review transition, document/history authorization, Dashboard task semantics, schema, or migration changes are expected.

### ADV-8 — Assembled regression / QA gate

**Status:** ACCEPTED / CLOSED

Acceptance history:
- initial ADV-8 verification correctly BLOCKED on duplicate-active-Adviser authority in direct Proposal/Final review APIs;
- bounded ADV-8 FIX-1: `e887623921d0e5d38e17fdf9b70b5509e207274d` — `fix(adviser): fail closed on duplicate review authority`;
- independent remote diff/source review of FIX-1: PASS;
- final ADV-8 re-verification on 2026-10-21: PASS;
- focused Proposal review: 23/23 PASS; focused Final review: 14/14 PASS;
- Adviser-focused regression: 285/285 PASS;
- full backend regression: 169 files, 1,962 PASS, 5 environment-conditional storage tests skipped, 0 failed;
- frontend Adviser verifiers: 72/72 PASS;
- backend build, frontend TypeScript, scoped lint, frontend production build, and `git diff --check`: PASS in the final re-verification report;
- final-gate manual/browser QA: NOT EXECUTED by the verifying agent;
- hosted CI: NOT OBSERVED / NOT CLAIMED.

Accepted security result:
- Proposal and Final review services load all active AdviserAssignment rows and resolve the sole current Adviser through the canonical single-active-Adviser rule;
- zero active rows remain unauthorized, exactly one row is authoritative, and multiple active rows fail closed;
- Student manuscript submission uses the same single-active-Adviser invariant before manuscript/certification binding;
- review queues, direct task reads, Request Changes, and Certification revalidate current Adviser authority; ambiguous duplicate authority cannot mutate academic state;
- caller-excluding conflicts remain non-disclosing, while conflicts that include the caller produce the deterministic conflict behavior;
- no schema migration or mass backfill was introduced.

Goal: prove the complete Adviser workflow.

Minimum scenarios:

1. Title passed -> Student sends Adviser Request.
2. Requested Adviser sees Incoming Request, CONFORMEs.
3. Dean approves -> Student appears under Active Advisees.
4. Adviser can view authorized Title academic context.
5. Adviser cannot view COR/payment/admin-only evidence.
6. Student submits Proposal manuscript -> Adviser Review Task appears.
7. Adviser requests changes -> Student resubmits -> Adviser sees authoritative new version.
8. Adviser certifies exact Proposal manuscript.
9. Proposal application approved -> Admin Scheduling automatically shows active Adviser.
10. Admin cannot replace Adviser; remaining committee is assignable.
11. Schedule creation persists exact Adviser participant and correct total.
12. Same authority works for Final.
13. Re-defense/history remains immutable and correctly scoped.
14. Former/inactive Adviser loses active advisee access.
15. Cross-adviser unauthorized access fails.

Final evidence classes must remain separate:

- automated focused/broader regressions;
- TypeScript/lint/build;
- manual/browser QA if actually executed;
- hosted CI if actually observed;
- independent review of the actual pushed remote diff.

---

## 7. Data-model / migration policy

Do not introduce a new Adviser table or duplicate current-Adviser state.

Current authority already exists in `AdviserAssignment`.

`ThesisRecord.assignmentId` may remain temporarily for compatibility with older code/data, but:

- do not write new workflow behavior that depends on it as the current Adviser pointer;
- do not mass-backfill it merely to make Scheduling work;
- do not delete/migrate it in ADV-1 without a separate repository-wide usage audit;
- a later cleanup may deprecate/remove the field only after every consumer is proven migrated.

If implementation discovers schema constraints that genuinely require migration, stop and document the evidence before changing schema.

---

## 8. UI/UX rules

Use the existing SYSTEM_UI_UX_PLAYBOOK.

Specific Adviser guidance:

- user-facing language should say **My Advisees**, **Adviser Requests**, and **Manuscript Reviews**;
- avoid technical labels such as AdviserAssignment, assignmentId, reviewedDocumentId, or enum names;
- do not duplicate explanatory text the UI already demonstrates;
- task queues should show the next action and why it is actionable;
- use read-only history for concluded attempts;
- request/certification actions must clearly distinguish reversible review remarks from irreversible certification;
- keep Adviser and Panelist defense roles conceptually distinct even when the same account performs both at different times.

The project-owner-accepted My Advisees pattern is now registered in `SYSTEM_UI_UX_PLAYBOOK.md` as an Approved Reference. Future Adviser-facing refinements should preserve its accepted hierarchy, terminology, workload-count semantics, and authority boundaries unless a later bounded design explicitly supersedes them.

---

## 9. Non-goals / deferred items

This initiative does not automatically add:

- Adviser numerical scoring of their own advisee;
- Adviser editing of Committee Report content;
- Dean signature mechanics;
- exact institutional PDF/form rendering;
- AI manuscript comparison/compliance analysis;
- CRDT collaborative manuscript editing;
- Admin-like Student account management for Advisers;
- unrestricted access to evaluator private records;
- automatic Adviser replacement/transfer policy beyond existing assignment state;
- arbitrary post-start committee mutation.

Any of these requires a separate confirmed design.

---

## 10. Stop boundary

After ADV-0 documentation, do **not** start product-code implementation automatically.

The coding agent may begin only when the project owner explicitly authorizes ADV-1 or a clearly defined package.

After each implementation package:

1. coding agent reports exact branch, starting HEAD, ending HEAD, changed files, tests/checks, and unexecuted evidence;
2. this project workflow independently reviews the actual remote diff/source;
3. package is accepted or receives a bounded FIX;
4. only then proceed to the next authorized package.
