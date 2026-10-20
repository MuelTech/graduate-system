# Adviser Workflow and My Advisees — Implementation Plan

**Date:** 2026-10-20  
**Repository:** MuelTech/graduate-system  
**Baseline branch:** `main`  
**Baseline HEAD:** `467e0bebcefb2cb24aaacfe3bf5fc5750652e308`  
**Implementation branch:** `refactor/adviser-workflow`  
**Parent workflow authority:** `docs/superpowers/DEFENSE_WORKFLOW_SOURCE_OF_TRUTH.md`  
**Cross-cutting verification authority:** `docs/superpowers/ENGINEERING_VERIFICATION_POLICY.md`  
**Plan status:** ADV-0 COMPLETE; ADV-1 ACCEPTED / CLOSED at `b1a83ec8bba91247c03b9411ff2531210ae3dc2f`; reproduced Proposal Scheduling bug manually verified fixed by the project owner; ADV-2 ACCEPTED / CLOSED at `6e042a3d81feff89098773a5dc81aec882fa6a8a`; ADV-3 IMPLEMENTED / INDEPENDENT SOURCE REVIEW PASS at `69f55d83d79a318c16d7a30207821ba10b19f399` with project-owner visual QA deferred; ADV-4 IMPLEMENTED / INDEPENDENT SOURCE REVIEW PASS at `9b032d439f0432fa7e908a4e6b568c1339dfc7ec` with project-owner visual QA deferred; ADV-5 IMPLEMENTED / INDEPENDENT SOURCE REVIEW PASS at `e3c64450495ee4c9a378c7a877f67783a0d52b8d`; project-owner visual QA pending

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
- **Incoming Requests**
- **Review Tasks**

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

### 3.3 Incoming Requests

Shows Adviser Requests where `requestedAdviserId` is the authenticated Panelist.

The user may CONFORME or decline according to the existing GS-020 transition rules.

A pending/conformed request must not be presented as an active advisee until Dean APPROVED has created the active AdviserAssignment.

### 3.4 Review Tasks

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
- `GET /thesis/adviser/workspace` provides authenticated Adviser-scoped Active Advisees, Incoming Requests, and Proposal/Final Review Tasks by composing existing authorities;
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
- three modes are present: Active Advisees, Incoming Requests, Review Tasks;
- My Advisees is discoverable in Panelist navigation while legacy Adviser Requests / Adviser Reviews entries remain for compatibility until ADV-7;
- active-advisee cards do not infer a current working title from historical Title Defense wording;
- Incoming Requests reuse the existing GS-020 status helpers and label historical wording as `Title Defense title`;
- Review Tasks use faculty-facing stage/status wording and retain existing Adviser Reviews as the mutation surface;
- loading, error/integrity, and empty states are distinct;
- no advisee-detail route, request/review mutation consolidation, history/documents exposure, redirects, or later ADV package work was introduced.

Goal: implement the parent Adviser workspace.

UI:

- Active Advisees;
- Incoming Requests;
- Review Tasks;
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
- Active Advisee cards now expose a bounded `View advisee` link while Incoming Requests remain non-advisee request context;
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

Goal: make My Advisees the primary Adviser workflow surface.

- Incoming Requests performs/reuses CONFORME/Decline.
- Review Tasks and Advisee detail perform/reuse Request Changes / Certify & Sign.
- Existing backend transition rules remain unchanged.
- Dashboard Adviser tasks deep-link into My Advisees context.

Do not delete compatibility routes until new routes are proven.

### ADV-7 — Navigation consolidation / compatibility redirects

Goal: simplify Panelist navigation only after My Advisees is accepted.

- add/retain **My Advisees** as canonical Adviser destination;
- remove standalone **Adviser Requests** and **Adviser Reviews** sidebar items;
- legacy index routes should redirect/deep-link safely to the matching My Advisees mode where feasible;
- do not break bookmarked exact task links without an explicit redirect strategy.

This is navigation consolidation, not domain authority change.

### ADV-8 — Assembled regression / QA gate

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

- user-facing language should say **My Advisees**, **Incoming Requests**, and **Review Tasks**;
- avoid technical labels such as AdviserAssignment, assignmentId, reviewedDocumentId, or enum names;
- do not duplicate explanatory text the UI already demonstrates;
- task queues should show the next action and why it is actionable;
- use read-only history for concluded attempts;
- request/certification actions must clearly distinguish reversible review remarks from irreversible certification;
- keep Adviser and Panelist defense roles conceptually distinct even when the same account performs both at different times.

The accepted My Advisees pattern should be added to `SYSTEM_UI_UX_PLAYBOOK.md` only after implementation and project-owner visual acceptance. Do not pre-declare it an Approved Reference.

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
