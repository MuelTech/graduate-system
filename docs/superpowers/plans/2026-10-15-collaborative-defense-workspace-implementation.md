# Collaborative Defense Workspace and RAP — Implementation Plan

**Date:** 2026-10-15  
**Last synchronized:** 2026-10-17  
**Repository:** MuelTech/graduate-system  
**Historical documentation branch:** refactor/unified-defense-lifecycle  
**Historical baseline implementation HEAD:** e33d2291fea04a36da34ac73713c3865997876a3  
**Implementation branch:** refactor/collaborative-defense-workspace  
**Accepted production implementation HEAD through CDW-8:** `a9a179446284ea928faca8991de34deadc856e1b`  
**CDW-8C acceptance package HEAD:** `f6011c1eaa73706cce0fb950ceea2a64dad80fc7`  
**Canonical functional authority:** docs/superpowers/COLLABORATIVE_DEFENSE_WORKSPACE_AND_RAP_SOURCE_OF_TRUTH.md  
**Parent workflow authority:** docs/superpowers/DEFENSE_WORKFLOW_SOURCE_OF_TRUTH.md  
**Plan status:** CDW-0 through CDW-8 implemented and accepted; CDW-8 ACCEPTED / CLOSED; CDW-9 not started

---

## 0. Purpose

This plan turns the collaborative Defense Workspace Source of Truth into bounded implementation packages.

It intentionally absorbs the previously planned standalone WF-C1c RAP-before-conclusion task. Do not implement a temporary post-defense RAP flow only to replace it immediately with the collaborative workspace.

The implementation must be phased because this feature crosses:

- PDF rendering and text-selection;
- new persisted annotation/comment data;
- defense authorization;
- evaluator UI;
- Rapporteur report authoring;
- RAP freezing/signatures;
- formal conclusion readiness;
- defense history;
- later realtime synchronization.

The first objective is correctness and a testable foundation. Realtime is added only after the persisted REST/UI workflow is accepted.

### 0.1 Current implementation status — 2026-10-17

This plan is intentionally retained as an implementation-history document. The pre-CDW baseline sections below explain why the packages existed; they do **not** describe the current branch after CDW-0 through CDW-8.

| Package | Current status | Accepted outcome |
|---|---|---|
| CDW-0 | ACCEPTED | PDF/annotation feasibility + scoring/schema audits completed |
| CDW-1 | ACCEPTED | collaborative persistence, REST authorization, report freeze/signature data foundation |
| CDW-2 | ACCEPTED | exact attempt-bound Student Document viewer |
| CDW-3 | ACCEPTED | persisted annotations/comments + polling foundation |
| CDW-4 | ACCEPTED | immersive role-aware workspace + evaluator lifecycle/privacy |
| CDW-5 | ACCEPTED | in-system free-form rich-text Rapporteur Committee Report authoring |
| RAP-C1 | ACCEPTED | freeze/sign/finalize RAP before Chairman verdict |
| CDW-6 | ACCEPTED | attempt-based Defense History + manual prior/current comparison |
| CDW-7 | ACCEPTED / CLOSED | assembled workflow acceptance/regression, concluded immutability, historical signature read-model cleanup |
| CDW-8 | ACCEPTED / CLOSED | Socket.IO transport/auth rooms, nine post-commit invalidation events, workspace-level client synchronization, polling fallback, and CDW-8C acceptance completed |
| CDW-9 | NOT STARTED | production hardening remains future work |

Accepted CDW-8 production implementation HEAD:

    a9a179446284ea928faca8991de34deadc856e1b

CDW-8C acceptance package HEAD:

    f6011c1eaa73706cce0fb950ceea2a64dad80fc7

Acceptance report:

    docs/superpowers/cdw-8/cdw-8c-acceptance-report.md

Manual browser multi-user QA remains explicitly NOT EXECUTED; it was not treated as a discovered acceptance blocker.

The accepted foundation deliberately keeps exact institutional form rendering separate from authoring/workflow. The in-system canonical records are authoritative; future official-form rendering may consume those records for exact EARIST PDF/print/download layouts without becoming another editable source of truth.

---

## 1. Historical baseline facts at e33d229 (pre-CDW implementation)

> **Historical baseline only.** The facts in this section were true at the planning baseline and are retained to explain the migration/refactor path. Where they conflict with the accepted CDW-0 through CDW-7 implementation, the accepted implementation and canonical Source of Truth control.

The following are current implementation facts and must be treated as migration inputs, not target behavior.

### 1.1 Defense Workspace

Current route:

    frontend/src/app/(portal)/panelist/defense-workspace/[scheduleId]/page.tsx

Current behavior:

- normal Panelist portal layout remains visible;
- workspace uses a two-column/card-oriented layout;
- student document is displayed with an iframe;
- current polling refreshes SCHEDULED / IN_PROGRESS / AWAITING_CONCLUSION every 20 seconds;
- Chairman/Panelists have the unified evaluator lifecycle from WF-C1b;
- Rapporteur has a notes textarea;
- Chairman has Summary/conclusion controls.

### 1.2 Evaluation

Relevant files include:

- backend/src/services/oral-evaluation.service.ts
- backend/src/services/oral-evaluation.rules.ts
- frontend/src/components/defense-workspace/oral-evaluation-form.tsx
- backend/prisma/schema.prisma

Current evaluator records already support:

- DRAFT;
- e-signature evidence;
- FINALIZED;
- finalizedAt/signedAt;
- official snapshot;
- immutable finalized record.

Current scoring semantics use criterion point limits such as 10 and 15 and group subtotals, while the newly supplied paper reference presents a 1.00–2.50 matrix. This must be reconciled before changing persisted meaning.

WF-C1b currently allows Title scoring only IN_PROGRESS but preserves Proposal/Final SCHEDULED-or-IN_PROGRESS editability. The new collaborative design changes the target to IN_PROGRESS-only official scoring for all stages.

### 1.3 Document viewer

Relevant file:

    frontend/src/components/ui/document-viewer.tsx

Current PDF path:

- authenticated fetch to Blob;
- PDF rendered in an iframe.

That is adequate for viewing but not for application-controlled text selection/highlight geometry. The collaborative workspace requires a PDF.js-based browser layer or an equivalent controlled renderer.

The backend already has pdfjs-dist for native PDF extraction, but frontend compatibility/worker bundling still requires a POC.

### 1.4 Rapporteur and RAP

Relevant files include:

- backend/src/services/rapporteur-finalization.service.ts
- backend/src/services/rap-report.service.ts
- backend/src/services/rap-signature.policy.ts
- backend/src/services/defense-conclusion.service.ts
- backend/src/repositories/thesis.repository.ts
- frontend/src/components/defense-workspace/rapporteur-notes-workspace.tsx
- frontend/src/app/(portal)/panelist/signatures/page.tsx

Current gaps:

- Rapporteur authoring is a single notes textarea, not the target structured Committee Report;
- RapReportService is explicitly built around createRapAfterConclusion;
- buildRapContent currently includes Formal Outcome;
- Title has deferred post-conclusion RAP creation paths;
- the pending-signature page signs directly and its report preview is only a placeholder;
- no frozen content hash/version is bound to signatures;
- new canonical conclusion readiness does not yet require the pre-conclusion collaborative RAP sequence.

### 1.5 Data model

Existing models already include:

- DefenseSchedule;
- PanelAssignment;
- OralExamScore;
- OralExamSummary;
- RapReport;
- RapReportSignature;
- DefenseConclusion;
- ThesisDocument.

Missing collaborative concepts include:

- attempt/document-bound annotations;
- comment threads/replies;
- source links from report items to annotations;
- explicit frozen report snapshot/version/hash suitable for proving all signers saw the same content.

Schema changes are therefore expected for the collaborative feature. They must be additive and migration-safe.

---

## 2. Branch and commit strategy

1. Keep refactor/unified-defense-lifecycle as the documentation/canonical workflow baseline.
2. Commit the new Source of Truth and this implementation plan as docs-only.
3. Create refactor/collaborative-defense-workspace from that documentation commit.
4. Implement one bounded package at a time.
5. After each package:
   - inspect the actual remote diff;
   - run focused tests;
   - run required backend/frontend verification;
   - manually review affected UI where relevant;
   - do not begin the next package until the current package is accepted.
6. Do not implement later Socket.IO work early.

Suggested package commit prefixes:

- feat(defense-collab)
- refactor(defense-workspace)
- refactor(rap)
- test(defense-collab)

Exact commit messages may be chosen per package.

---

## 3. Phase CDW-0 — Technical spike and semantic audits

### Goal

Remove the two largest unknowns before committing to production schema/UI behavior:

1. PDF highlighting integration;
2. evaluation-scale reconciliation.

### CDW-0A — PDF annotation POC

Build an isolated proof of concept, not the production feature.

Acceptance:

- load one authenticated thesis PDF through the existing secure document endpoint;
- render with a controllable PDF.js text layer;
- select text;
- create a visual highlight;
- serialize page + selected text + geometry;
- reload the viewer and restore the highlight from serialized data;
- zoom without losing anchor placement;
- prove it works in the current Next.js build.

Library evaluation:

- evaluate a maintained open-source React PDF highlighter/annotation library;
- verify license;
- verify current React/Next.js compatibility;
- verify pdfjs-dist worker/build compatibility;
- confirm custom highlight/comment rendering is possible;
- do not adopt the library merely because the demo works.

No database migration is required for the POC.

### CDW-0B — Evaluation scoring audit

Compare:

- supplied individual evaluator form;
- current backend criterion limits/calculations;
- current OralExamScore schema;
- current official snapshot/summary behavior.

Produce one explicit implementation decision before changing code:

- preserve existing numeric semantics but present a familiar visual matrix; or
- migrate to the institutional 1.00–2.50 scale with a documented safe conversion/migration; or
- another client-confirmed mapping.

Do not guess a conversion.

### CDW-0C — Schema design review

Finalize additive models/fields for:

- DefenseAnnotation;
- DefenseAnnotationComment;
- a persisted Rapporteur-owned rich-text document body (JSON/document model or equivalent safe representation);
- optional source-annotation/source-comment traceability for inserted material;
- report freeze metadata;
- content hash/version;
- signature-to-version binding.

No destructive migration.

### Exit criteria

Do not start CDW-1 until the PDF POC passes and evaluation semantics are explicitly resolved.

---

## 4. Phase CDW-1 — Collaborative data model and REST authorization foundation

### Goal

Create server-authoritative persistence and authorization before building the final UI.

### Recommended schema direction

Conceptual model:

    DefenseAnnotation
      id
      scheduleId
      thesisDocumentId
      authorAssignmentId
      pageNumber
      selectedText
      anchorData
      anchorVersion
      createdAt
      updatedAt

    DefenseAnnotationComment
      id
      annotationId
      authorAssignmentId
      body
      createdAt
      updatedAt

No hard-delete requirement for MVP.

For report integrity, extend RapReport or add a related version/snapshot model with:

- frozenAt;
- frozenById;
- contentVersion;
- frozenSnapshot;
- contentHash.

Extend RapReportSignature so the signed evidence can be associated with the exact frozen content version/hash.

Use actual final schema names only after reviewing Prisma conventions in the repository.

### REST endpoints

Representative contracts; exact routing may follow existing thesis routes.

- GET defense workspace annotations for schedule/document
- POST annotation
- POST annotation reply/comment
- GET annotation thread/list
- GET report draft/read model
- PUT Rapporteur report draft
- POST report finalize-for-signatures
- GET conclusion readiness

Authorization rules:

- assignment required for committee workspace;
- exact schedule required;
- exact authorized ThesisDocument required;
- annotation creation only for authorized roles/states;
- report edits Rapporteur-only;
- concluded/frozen records reject writes.

### Tests

Must cover:

- cross-schedule access denied;
- cross-thesis document injection denied;
- non-assigned user denied;
- Panelist/Chairman annotation allowed in correct states;
- Facilitator/Adviser annotation write blocked under initial policy;
- Rapporteur reads comments and may reply;
- concluded history rejects writes;
- frozen collaboration rejects new academic comments;
- exact document binding.

### Non-goals

- no Socket.IO;
- no final PDF UI;
- no report signing redesign yet.

---

## 5. Phase CDW-2 — Interactive Student Document viewer

### Goal

Replace iframe-only rendering inside the Defense Workspace with an annotation-capable viewer while keeping the original file immutable.

### Frontend direction

Create a dedicated collaborative manuscript viewer rather than weakening the generic DocumentViewer security contract.

The final Defense Workspace must not expose the browser's generic/native PDF toolbar as its primary UX. Render an EARIST-native viewer shell over the controlled PDF rendering layer.

Capabilities:

- authenticated PDF load;
- PDF.js canvas/text layer;
- text selection;
- highlight rendering;
- selected-thread focus;
- application-controlled page navigation/page indicator;
- zoom and fit-width controls;
- exact comment -> PDF anchor navigation;
- restore stored anchors;
- error/loading states;
- no direct manuscript editing.

The original PDF bytes remain immutable. Collaboration data is stored/rendered separately.

### Integration

The workspace must receive the exact authoritative document identifier for the attempt.

Do not use thesis-global "latest document" fallback that can leak another stage/attempt document.

### Tests

- correct document selected for Title/Proposal/Final;
- unauthorized file remains inaccessible;
- serialized highlights restore after reload;
- zoom/page changes preserve highlight placement;
- legacy/scanned PDFs fail gracefully when text selection is unavailable;
- no mutation of the source file.

### Non-goals

- no realtime;
- no automatic OCR-driven annotation anchoring;
- no automatic diff.

---

## 6. Phase CDW-3 — Shared annotations, comment rail, and polling

### Goal

Deliver usable multi-user collaboration without Socket.IO.

### UI

Student Document tab:

- highlight text;
- add comment;
- shared highlight markers;
- right-side comments rail;
- Selected and All Comments views;
- reply;
- click comment -> navigate/focus PDF anchor;
- author + role + timestamp.

Use React Query invalidation/refetch and modest polling during active/pre-defense states.

### State rules

Writable:

- SCHEDULED;
- IN_PROGRESS;
- AWAITING_CONCLUSION while RAP is DRAFT.

Read-only:

- RAP FOR_SIGNATURE or FINALIZED;
- CONCLUDED;
- CANCELLED.

### Tests

Use at least two committee identities in integration/manual QA:

- Panelist A comment becomes visible to Panelist B after refresh/poll;
- Rapporteur sees the same thread;
- unauthorized user never sees it;
- reload preserves comments;
- previous document annotations do not appear on the current document.

### Exit criteria

The collaboration foundation must feel correct under polling before realtime work is considered.

---

## 7. Phase CDW-4 — Immersive Defense Workspace and evaluator UX

### Goal

Build the final workspace shell and integrate the official evaluator flow without changing evaluator authority.

### Layout

- sidebar-free focus mode;
- compact workspace header;
- collapsible left role rail;
- center Committee Report / Student Document tabs;
- collapsible shared comments rail;
- for Rapporteur, keep the same Shared Comments rail available in both Committee Report and Student Document tabs;
- in Committee Report mode, comments act as reference material and may expose Insert into Report;
- in Student Document mode, comments retain exact highlight/page navigation;
- responsive drawer behavior on smaller screens.

### Evaluator rail

After CDW-0B resolves scoring semantics:

- Group I and Group II layout follows the institutional form;
- use familiar rating columns/controls;
- Recommendations remains clearly separate;
- show derived group/overall values according to confirmed semantics;
- Save Draft;
- Review;
- E-Sign + Finalize;
- locked official state.

### All-stage Start Defense correction

Target:

- SCHEDULED = pre-defense review only;
- Chairman Start Defense -> IN_PROGRESS;
- only IN_PROGRESS allows official scoring.

This changes Proposal/Final from the current SCHEDULED-or-IN_PROGRESS scoring behavior. Server rules, tests, and frontend capability semantics must change together.

### Privacy

Do not expose another evaluator's live numeric selections to fellow Panelists.

Shared manuscript comments remain visible according to role policy.

### Tests

- Title/Proposal/Final all block scoring while SCHEDULED;
- Chairman starts session;
- scoring opens only after IN_PROGRESS;
- evaluation save/finalize/e-sign still works;
- left rail collapse does not change backend state;
- finalized evaluation remains locked;
- Rapporteur/Facilitator/Adviser never gain evaluator controls.

---

## 8. Phase CDW-5 — Rapporteur rich-text Committee Report composer

### Goal

Replace the single notes textarea as the primary new-attempt authoring model with a system-owned Committee Report that has a **free-form Rapporteur-controlled rich-text body**.

Do not model Committee Suggestions, General Observations, Research/Title Recommendations, or similar headings as mandatory fixed body fields.

The editor itself is **not** a paper-form/page-layout replica. Exact GS Form No. 22 reproduction, printable institutional forms, PDF generation, and print/download fidelity are explicitly deferred to a later unified Official Defense Forms / Document Processing phase.

### UI

Rapporteur:

- Committee Report tab editable while DRAFT;
- familiar rich-text composing controls appropriate to the approved editor library;
- compact non-editable defense context (for example student, stage, program, date) rather than a literal reproduction of the paper form;
- Student Document tab for direct manuscript/PDF review;
- persistent/collapsible Shared Comments rail while either Committee Report or Student Document is active;
- optional Insert into Report action from a selected comment while composing;
- long comments may be visually clamped with Show more/Show less, but full content remains available;
- Insert into Report must copy the full comment content, not only a truncated preview;
- save draft;
- Preview Report (clean read-only content preview, not an institutional paper-form renderer);
- report status/readiness.

Chairman/Panelist:

- Committee Report tab read-only while DRAFT;
- can see current report after polling/refetch.

The system separately renders non-editable institutional metadata such as student identity, program, defense stage/date, committee roster, prepared-by identity, RAP status, and signature state. Those values must not depend on the Rapporteur manually typing them into the rich-text body.

### Report preview foundation and deferred Official Defense Forms

CDW-5 should build only the report authoring/read-model foundation needed by the workflow.

The Preview Report may compose:

- exact defense-attempt identity;
- compact authoritative student/program/defense context;
- the Rapporteur-authored rich-text body;
- current report lifecycle state.

It must preserve the distinction between report-body content and system-owned metadata. A sample heading such as Statement of the Problem or General Observation is not automatically a required schema field.

Explicit CDW-5 non-goals:

- no exact GS Form No. 22 reproduction;
- no Individual Evaluation printable form;
- no Oral Examination Summary printable form;
- no institutional PDF generator;
- no exact print CSS/page geometry;
- no Panelist / Conforme output table implementation;
- no official signature-image placement;
- no template revision/version framework;
- no dependency on the reference DOCX to complete this phase.

A later dedicated Official Defense Forms / Document Processing source of truth should define those concerns consistently across all defense forms instead of creating a one-off Rapporteur-only renderer.

Do not expose other signers' raw signature images in the live authoring UI. If the paper template contains Approved by / OIC-Dean, do not create a Dean digital signature slot, workflow action, or RAP completion gate until policy is confirmed.

### Editor-library decision

Use a maintained open-source rich-text editor compatible with the current Next.js/React stack rather than building a document editor from scratch.

The target is basic Word/Google-Docs-like composing familiarity, not a full office-suite clone.

Required initial editor capabilities should be bounded to what the report actually needs, such as:

- paragraph/headings;
- bold/italic/underline;
- bullet/numbered lists;
- indentation/alignment where supported;
- undo/redo;
- safe paste;
- controlled serialization.

Do not implement page-layout editing, arbitrary floating objects, or simultaneous multi-author editing of the report body.

### Optional Insert into Report behavior

If implemented in this phase:

- clicking Insert into Report copies the selected committee comment into the current editor insertion point or another explicitly chosen location;
- the operation uses the full stored comment body even when the rail currently shows only a shortened preview;
- it never automatically creates a mandatory section;
- the inserted text becomes normal Rapporteur-owned editable content;
- the Rapporteur may rewrite, move, combine, format, or delete it;
- the source comment remains intact;
- optional sourceAnnotationId/sourceCommentId metadata may be retained for traceability;
- source-comment changes do not silently update previously inserted report text.

This convenience action may be deferred if necessary. Manual reading plus free-form report authoring remains an acceptable first implementation.

### Data compatibility

Legacy rapporteurNotes must remain readable.

Do not destructively erase old RapReport text.

A migration may map new rich-text document content into RapReport or a related model while preserving legacy fields for old records.

### Report content rules

- formal verdict is not a prerequisite and must not be embedded as required pre-signature content;
- report body structure and wording are controlled by the assigned Rapporteur;
- fixed system metadata remains authoritative outside the editable body;
- the exact serialized draft is frozen into the RAP snapshot before signatures.

### Tests

- only assigned Rapporteur edits;
- non-Rapporteur view only;
- Rapporteur can freely create/reorder headings, paragraphs, and lists without mandatory report sections;
- fixed student/defense/committee metadata is system-owned and not editable body content;
- the authoring surface does not require literal GS Form page geometry;
- draft serialization saves and reloads without losing supported formatting;
- Insert into Report, if implemented, preserves the original annotation/comment and produces editable copied text rather than a live binding;
- Preview Report uses authoritative attempt context plus the current report body without pretending to be the official institutional form;
- draft remains editable until freeze;
- report remains DRAFT before freeze;
- no verdict required to create/save report;
- no official-form/PDF/print implementation is introduced in this phase.

---

## 9. Phase RAP-C1 — Pre-conclusion RAP freeze, workspace signing, and centralized conclusion readiness

### Goal

Complete the old WF-C1c requirement in the final collaborative architecture.

This is a correctness-critical package.

### Backend changes

Retire new-attempt dependence on:

- createRapAfterConclusion;
- deferred Title RAP generation after conclusion;
- Formal Outcome inside pre-conclusion RAP content.

Implement:

- Rapporteur finalize-for-signatures;
- immutable frozen snapshot/version/hash;
- stage-aware signature slot creation;
- own-slot signature CAS bound to frozen content;
- monotonic RAP aggregate status;
- centralized conclusion-readiness service;
- safe Oral Examination Summary recovery when evaluations are complete but Summary creation previously failed.

### Canonical sequence

    SCHEDULED
      -> IN_PROGRESS
      -> all evaluators FINALIZED
      -> Oral Examination Summary ready
      -> Rapporteur freezes Committee Report
      -> FOR_SIGNATURE
      -> required signers sign
      -> RAP FINALIZED
      -> Chairman PASSED / REDEFENSE_REQUIRED
      -> CONCLUDED

### Signature policy

Title:

- Chairman;
- Panelists;
- Rapporteur.

Proposal/Final:

- active Adviser;
- Chairman;
- Panelists;
- Rapporteur.

Facilitator excluded.

### Signing UI

Sign inside the Defense Workspace after viewing the actual frozen report.

The frozen report view must be the same immutable version/hash for every signer.

Rapporteur signing-progress visibility:

- show required signer name and functional role;
- show Pending / Signed;
- show signed timestamp when available;
- show aggregate progress such as 4 of 6 signed;
- do not expose raw signatureData or another signer's private signature blob/image in the live status UI.

RAP-C1 signs the **canonical frozen report content/version**, not a particular HTML/PDF visual layout. Exact institutional PDF/form rendering remains deferred to the later Official Defense Forms / Document Processing phase. That later renderer must consume the canonical frozen record rather than changing what was signed.

Change /panelist/signatures from primary signing surface to a secondary task inbox/history:

- pending item identifies student/stage;
- Open Defense Workspace;
- no placeholder-only blind signing path for new attempts.

Polling/refetch remains sufficient for RAP-C1 correctness. Socket.IO/WebSocket realtime is deliberately deferred to the later realtime phase.

### Deferred official document processing

The current collaborative-workspace plan does not implement final institutional document rendering.

A later dedicated source of truth should cover all official defense forms together, including:

- Individual Oral Examination Evaluation;
- Oral Examination Summary;
- Suggestions of the Evaluation Committee / RAP (including GS Form No. 22 where applicable);
- canonical-record-to-template mapping;
- template revision/versioning;
- institutional headers, typography, margins, pagination, and print CSS;
- PDF/download generation;
- authorized signature rendering/placement;
- DRAFT/frozen/final output labels;
- print/download authorization.

Workflow signatures remain bound to canonical immutable records even before that presentation layer exists.

### Conclusion gate

Server and repository-level enforcement should reject Chairman conclusion when any of the following is missing:

- evaluator assignment/finalization;
- Summary;
- frozen report;
- required RAP signature;
- RAP FINALIZED.

No auto verdict.

### Immutability

Do not mutate the frozen RAP after Chairman verdict.

DefenseConclusion is separate.

### Historical compatibility

Existing concluded records created under older sequence remain readable.

No fabricated backfill.

### Required tests

At minimum:

- Title cannot conclude before RAP final;
- Proposal cannot conclude before RAP final;
- Final cannot conclude before RAP final;
- one missing Panelist signature blocks;
- missing Rapporteur signature blocks;
- Proposal/Final missing Adviser signature blocks;
- Facilitator never blocks;
- Title has no Adviser slot;
- all signatures -> RAP FINALIZED;
- verdict remains Chairman-only;
- report generation/freeze does not require outcome;
- verdict does not mutate signed content/hash;
- re-defense schedule isolation;
- Summary self-healing path;
- legacy concluded attempt remains readable;
- pending signature task opens workspace;
- no CONCLUDED + pending required signature state for new attempts.

---

## 10. Phase CDW-6 — Defense History and revision traceability

**Status: IMPLEMENTED (2026-10-17) — READY FOR USER REVIEW.** Delivered as the
attempt-based, read-only Defense History read model
(`backend/src/services/defense-history.rules.ts` + `defense-history.service.ts`, routes
`GET /thesis/defense/:scheduleId/history[/:historicalScheduleId]`), the generalized
historical bound-manuscript document rule, and the frontend `defense-history-panel.tsx`
(which replaced the CP8 `ProposalHistoryPanel` / "Proposal Context" tab). No database
migration. Manual visual/runtime QA remains user-owned. See
`docs/superpowers/cdw-6/cdw-6-report.md`.

### Goal

Make prior defense evidence usable during a later defense without reopening history.

### Read model

For the current thesis/schedule, expose relevant history:

- previous same-stage attempts;
- previous academic stage;
- exact historical manuscript;
- finalized RAP;
- annotations/comments;
- formal verdict;
- committee metadata.

Do not automatically expose detailed prior individual evaluator scores to replacement/current Panelists unless a separate permission rule allows it.

### UI

Student Document tab:

- Defense History control;
- Current Manuscript default;
- Previous Same-Stage Attempt section when re-defense;
- Previous Stage section for normal progression;
- View Previous Manuscript;
- View Previous RAP;
- View Historical Annotations;
- Compare with Current.

### Compare

Initial implementation is manual side-by-side.

- lazy-load previous PDF only when opened;
- historical side read-only;
- current side follows current collaboration state.

### Tests

- Proposal Attempt 2 sees Proposal Attempt 1 after REDEFENSE_REQUIRED;
- Final sees relevant Proposal history after Proposal PASSED;
- Title re-defense sees prior Title attempt;
- current annotations never leak into historical attempt and vice versa;
- committee replacement does not alter old authors/roles;
- no historical write endpoints.

---

## 11. Phase CDW-7 — Acceptance and regression pass before realtime

### Goal

Prove that the complete foundation works correctly without Socket.IO.

Required manual scenarios:

1. Pre-defense:
   - assigned Panelist opens future scheduled defense;
   - reads manuscript;
   - highlights/comments;
   - another committee member sees it after polling/refetch;
   - evaluation remains closed.

2. Live defense:
   - Chairman starts;
   - evaluators score/e-sign/finalize;
   - Rapporteur drafts report while reading comments;
   - Panelists can view report draft.

3. RAP finalization:
   - all evaluations complete;
   - Summary ready;
   - Rapporteur freezes report;
   - all signers review/sign;
   - report finalizes;
   - Chairman records verdict.

4. Historical:
   - reopen concluded workspace;
   - no edits;
   - no signatures;
   - manuscript/comments/report/evaluation history remain visible as permitted.

5. Re-defense / later stage:
   - prior evidence visible read-only;
   - current attempt data isolated.

Run full backend/frontend verification expected by the repository.

Do not begin Socket.IO until this phase is accepted.

---

## 12. Phase CDW-8 — Socket.IO realtime synchronization

**Status as of 2026-10-17:** ACCEPTED / CLOSED.

Accepted production implementation HEAD:

    a9a179446284ea928faca8991de34deadc856e1b

CDW-8C acceptance package HEAD:

    f6011c1eaa73706cce0fb950ceea2a64dad80fc7

Detailed technical design:

    docs/superpowers/cdw-8/cdw-8-realtime-integration-design.md

Acceptance report:

    docs/superpowers/cdw-8/cdw-8c-acceptance-report.md

The technical design fixes the server bootstrap, JWT/room authorization, post-commit event contracts, React Query invalidation map, reconnect behavior, polling fallback, test matrix, and deployment assumptions. It supplements this plan without changing domain authority.

### Completed implementation package sequence

CDW-8 was implemented in three bounded packages:

1. **CDW-8A — Backend Realtime Foundation**
   - Socket.IO backend/bootstrap;
   - shared HTTP server;
   - JWT handshake authentication;
   - `defense:<scheduleId>` room authorization;
   - reconnect/reauthorization;
   - realtime publisher + event contracts;
   - focused backend transport/auth tests;
   - **no frontend realtime integration yet**.

2. **CDW-8B — Domain Events + Frontend Synchronization**
   - wire canonical post-commit defense events;
   - add `socket.io-client`;
   - one workspace-level socket lifecycle;
   - React Query invalidation/refetch mapping;
   - reconnect convergence;
   - retain polling fallback;
   - **no academic workflow redesign**.

3. **CDW-8C — Acceptance / Regression / Multi-user QA**
   - unauthorized/state-exclusion regression;
   - replacement-member reauthorization;
   - payload privacy;
   - duplicate/stale/out-of-order safety;
   - socket-unavailable REST/polling fallback;
   - multi-user browser QA;
   - full backend/frontend regression.

Hard gates were satisfied:

- CDW-8A was independently reviewed and accepted before CDW-8B;
- CDW-8B was independently reviewed and accepted before CDW-8C;
- CDW-8C was accepted and CDW-8 was closed before CDW-9 became eligible to begin. CDW-9 remains NOT STARTED.

The detailed scope and exit criteria for each package are authoritative in `docs/superpowers/cdw-8/cdw-8-realtime-integration-design.md` §21.

### Goal

Improve latency/coordination without changing domain authority.

### Architecture

REST/service/database remain authoritative.

After commit, emit small events to:

    defense:<scheduleId>

Suggested events:

- defense.started
- annotation.created
- annotation.comment.created
- report.draft.updated
- evaluation.finalized
- report.ready_for_signature
- rap.signature.recorded
- rap.finalized
- defense.concluded

Clients should normally invalidate/refetch relevant React Query keys rather than trust unverified duplicate state.

### Socket authorization

On connection/join:

- authenticate user;
- verify current schedule assignment;
- verify session is eligible for active/pre-defense room;
- join only authorized room(s).

On reconnect:

- re-authorize;
- refetch authoritative state.

### Historical mode

Do not join socket rooms for CONCLUDED historical viewing.

### Tests

- unauthorized room join denied;
- user removed/replaced before start loses access after reauthorization;
- events emitted only after committed writes;
- reconnect converges to DB truth;
- no duplicate academic writes caused by event replay;
- conclusion event shifts clients to view-only state;
- REST-only workflow still works if realtime layer is unavailable.

### Non-goals

- live cursor;
- typing indicator;
- CRDT;
- collaborative manuscript editing.

---

## 13. Phase CDW-9 — Hardening and production readiness

Focus:

- concurrency around final evaluation/Summary creation;
- concurrent final RAP signatures;
- idempotency;
- stale-client error messaging;
- large manuscript performance;
- annotation pagination/lazy-loading if needed;
- indexing for schedule/document/thread queries;
- audit logging;
- accessibility/keyboard navigation;
- responsive QA;
- security regression;
- migration rollback/read-compatibility.

Performance should be measured before adding speculative caching.

---

## 14. Package guardrails for coding agents

Every package prompt must include:

- exact starting branch/HEAD;
- package scope;
- explicit files/modules likely involved;
- authoritative Source of Truth sections;
- forbidden out-of-scope behavior;
- required focused tests;
- full verification requirements;
- expected report format.

Agents must not:

- implement Socket.IO before CDW-8;
- auto-decide verdict from scores;
- make Rapporteur an evaluator;
- make Adviser an evaluator under current policy;
- make Facilitator a required RAP signer;
- put Adviser in Title committee/RAP;
- reintroduce permanent selected-title authority;
- mutate old attempts;
- auto-carry annotations into revised manuscripts;
- expose live individual evaluator scores to other Panelists;
- allow report edits after freeze;
- include formal outcome in a RAP that must be signed before conclusion;
- use frontend-only checks as academic authorization.

---

## 15. Expected schema/migration posture

Unlike WF-C1a/WF-C1b, this feature is expected to require additive migrations.

Probable additions:

- annotation table;
- annotation comment/reply table;
- report structured-content representation;
- report freeze/version/hash fields;
- signature version/hash binding;
- supporting indexes.

Migration rules:

- additive first;
- keep legacy fields readable;
- no destructive drop in the initial collaborative branch;
- no automatic conversion of old notes/comments that never existed;
- no attempt to synthesize historical annotations;
- existing RapReport rows remain readable;
- old concluded attempts remain historical even if they lack new fields.

---

## 16. Definition of done for the overall initiative

The initiative is complete only when:

- pre-defense review works;
- the exact manuscript is annotatable without modifying the file;
- the Defense Workspace uses an EARIST-native collaborative PDF viewer instead of browser-native PDF chrome as the primary review surface;
- shared comments are persisted and authorized;
- Rapporteur can keep comments visible in both report-composer and Student Document modes;
- long comments can be expanded and Insert into Report copies the full stored content;
- evaluator UI follows confirmed institutional scoring semantics;
- all stages open official scoring only after Start Defense;
- Rapporteur free-form rich-text report composer works without mandatory body sections;
- report draft is visible read-only to committee;
- report freezes before signatures;
- required stage-aware signatures complete before verdict;
- signing occurs with actual report preview inside the workspace;
- Chairman conclusion uses centralized backend readiness;
- historical mode is immutable and lightweight;
- re-defense and previous-stage revision traceability work;
- current/past committee changes preserve history;
- realtime is an enhancement over a passing REST foundation;
- full regression suite and manual workflow acceptance pass.

---

## 17. Deferred follow-up candidates

After the core initiative is stable, separately consider:

- automatic textual/semantic manuscript diff;
- AI-assisted revision checklist;
- presence indicators;
- official institutional form rendering/export/print/download for Committee Report/RAP, Individual Evaluation, and Oral Examination Summary, including exact pagination/geometry, signature placement, and template versioning;
- explicit frozen-RAP correction/version withdrawal workflow;
- expanded Adviser collaboration rights if confirmed;
- Dean digital approval/signature if confirmed.

These are not prerequisites for the collaborative Defense Workspace foundation.
