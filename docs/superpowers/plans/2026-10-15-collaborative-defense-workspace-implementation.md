# Collaborative Defense Workspace and RAP — Implementation Plan

**Date:** 2026-10-15  
**Last synchronized:** 2026-10-19<br>
**Repository:** MuelTech/graduate-system  
**Historical documentation branch:** refactor/unified-defense-lifecycle  
**Historical baseline implementation HEAD:** e33d2291fea04a36da34ac73713c3865997876a3  
**Implementation branch:** refactor/collaborative-defense-workspace  
**Accepted production implementation HEAD through CDW-8:** `a9a179446284ea928faca8991de34deadc856e1b`  
**CDW-8C acceptance package HEAD:** `f6011c1eaa73706cce0fb950ceea2a64dad80fc7`  
**Accepted CDW-LIVE-1 core HEAD:** `0b06149889a1645919ecea557ca63562e1680208`  
**Accepted pre-CDW-9 product-code baseline:** `3e5ed6847db737e6395d531c04ee5f3b9b5c9812`  
**Latest acceptance reconciliation:** docs/superpowers/cdw-9/cdw-9a-acceptance-reconciliation-2026-10-19.md<br>
**Current next package:** CDW-9F — Migration / Read Compatibility and Final Production-Readiness Gate (NEXT / AUTHORIZED — NOT YET IMPLEMENTED)<br>
**Canonical functional authority:** docs/superpowers/COLLABORATIVE_DEFENSE_WORKSPACE_AND_RAP_SOURCE_OF_TRUTH.md  
**Parent workflow authority:** docs/superpowers/DEFENSE_WORKFLOW_SOURCE_OF_TRUTH.md  
**Plan status:** CDW-0 through CDW-8 ACCEPTED / CLOSED; CDW-LIVE-1 core and FIX-1 through FIX-6 are implemented/accepted at their recorded bounded gates; FIX-6 parallel Evaluation / Committee Report sequencing, autosave-before-finalize protection, single-step Committee Report signing, and redundant-control cleanup are FINAL ACCEPTED / CLOSED; the project owner waived an additional full multi-user manual replay based on targeted regression evidence + independent source review under the risk-based verification policy; CDW-9 is NEXT / AUTHORIZED; CDW-9 is split into bounded packages CDW-9A through CDW-9F; CDW-9A through CDW-9E are ACCEPTED / CLOSED; CDW-9F is NEXT / AUTHORIZED — NOT YET IMPLEMENTED

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

### 0.1 Current implementation status — 2026-10-19

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
| CDW-LIVE-1 core | ACCEPTED / CLOSED | single-writer Rapporteur live read-only preview + report autosave + private evaluator draft autosave |
| CDW-LIVE-1 MANUAL-QA FIX-1 | IMPLEMENTED / SOURCE REVIEW PASS | preview/save convergence + stable live-preview status + LAN realtime diagnostics; user LAN retest reported working after restart |
| CDW-LIVE-1 MANUAL-QA FIX-2 | IMPLEMENTED / SOURCE REVIEW PASS / SUPERSEDED BY FIX-3 | evaluator rail cleanup + autosave-only status + centered two-step Review -> Sign -> Confirm Finalize modal |
| CDW-LIVE-1 MANUAL-QA FIX-3 | IMPLEMENTED / SOURCE REVIEW PASS / BOUNDED PRODUCT REVIEW ACCEPTED | draw-only individual evaluation signature + concise Formal Verdict readiness + Committee Roster collapse affordance |
| CDW-LIVE-1 MANUAL-QA FIX-3A | ACCEPTED FOR BOUNDED UX SCOPE | `Waiting for report` readiness wording + removal of redundant printed-name copy/plumbing |
| CDW-LIVE-1 MANUAL-QA FIX-4 | IMPLEMENTED / SOURCE REVIEW PASS | institutional Oral Examination Summary generated from finalized Group I/II averages; row Average = (A+B)/2; 2-decimal rounding; Rating/Remarks deferred |
| CDW-LIVE-1 MANUAL-QA FIX-5 | BOUNDED UX ACCEPTED | implementation `13a4c38a`; independent source review PASS; project-owner targeted manual QA PASS for Committee Report signing and Admin Defense Records alignment; later FIX-6 supersedes only its serialized report-finalization assumption and technical faculty-facing copy |
| CDW-LIVE-1 MANUAL-QA FIX-6 | FINAL ACCEPTED / CLOSED | parallel evaluation/report workstreams, autosave-safe finalization, single-step signing, and concise faculty UI independently source-reviewed and accepted |
| Additional pre-CDW-9 multi-user replay | WAIVED / NOT REQUIRED | project owner explicitly waived another full replay after FIX-6 because targeted regressions + independent source review sufficiently cover the changed sequence; this is not recorded as a manual-QA PASS |
| CDW-9 | NEXT / AUTHORIZED | production hardening is the final planned phase; execution is split into CDW-9A through CDW-9F; CDW-9A through CDW-9E are ACCEPTED / CLOSED; CDW-9F is NEXT / AUTHORIZED — NOT YET IMPLEMENTED |

Accepted CDW-8 production implementation HEAD:

    a9a179446284ea928faca8991de34deadc856e1b

CDW-8C acceptance package HEAD:

    f6011c1eaa73706cce0fb950ceea2a64dad80fc7

Acceptance report:

    docs/superpowers/cdw-8/cdw-8c-acceptance-report.md

Core CDW-LIVE-1 was independently accepted before manual QA. Subsequent real-device/manual QA found bounded usability issues rather than a domain-model failure. FIX-1 is implemented and the LAN symptom was retested successfully by the user after restart. FIX-2 was implemented/source-reviewed, then superseded by the bounded FIX-3/FIX-3A refinements. FIX-3/FIX-3A are implemented, independently source-reviewed, and accepted for their visible UI/UX scope. A later source audit found one substantive pre-CDW-9 workflow blocker: institutional Oral Examination Summary generation still rejected the new matrix because older code treated Overall/Rating as unconfirmed. EARIST confirmed the bounded numeric Summary rule; FIX-4 implemented it and independently passed source review at `3b24c496`. Project-owner manual inspection then confirmed the Summary is generated and visible with institutional Group A/Group B/Average rows, while exposing a separate bounded UX problem: stale inline Committee Report signing, overexposed faculty signer rosters, and outdated Admin Defense Records presentation. FIX-5 implements that UX alignment at `13a4c38a`, independently passed source review, and subsequently passed project-owner targeted manual QA for the corrected flow. The project owner then exercised the complete current defense path successfully and confirmed the implementation is mechanically working, but identified a real-world workflow mismatch: the Rapporteur and required Committee Report signers must not be forced to wait for every evaluation/Summary before report finalization/signing. FIX-6 documents that correction and the associated faculty-facing language cleanup. FIX-5 remains accepted for its bounded UX scope, but its serialized report-finalization assumption is superseded by FIX-6.

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
   - run focused tests and directly affected regressions first;
   - use the risk-based verification rules in `docs/superpowers/ENGINEERING_VERIFICATION_POLICY.md`;
   - broaden to full suites/builds only when the changed surface or acceptance gate justifies it;
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

## 12A. Pre-CDW-9 Enhancement — CDW-LIVE-1 Live Rapporteur Preview + Draft Autosave

**Status as of 2026-10-18:** CDW-LIVE-1A ACCEPTED at `11ca4890e734f20a399e862ad0f73ca23a23ff92` (FIX-1 included); CDW-LIVE-1B ACCEPTED at `f10f074b1b2c7ea065ce9ee874439f63951f57f2`; CDW-LIVE-1C VERIFIED — PENDING INDEPENDENT REVIEW; overall CDW-LIVE-1 PENDING FINAL INDEPENDENT ACCEPTANCE; CDW-9 NOT STARTED.

Detailed design:

    docs/superpowers/cdw-live-1/cdw-live-1-live-report-and-draft-autosave-design.md

### Why this is separate from CDW-8

CDW-8 is already ACCEPTED / CLOSED and remains the baseline for persisted realtime synchronization. CDW-LIVE-1 is a newly identified UX/durability enhancement and must not rewrite CDW-8 acceptance history.

### Goal

Improve live committee review and protect high-value draft work without changing academic authority.

### Rapporteur report target

- assigned Rapporteur remains the only report editor;
- Chairman/Panelists and other authorized committee viewers remain read-only;
- report body autosaves through the existing authenticated REST/database draft path;
- bodyVersion/CAS remains authoritative;
- no manual **Save now** control; autosave is authoritative for routine drafting, while blur/visibility/unmount/finalization use the existing serialized flush/drain pipeline;
- Socket.IO may carry a throttled ephemeral `report:preview` body snapshot to authorized active viewers;
- the preview is local/ephemeral viewer state, not authoritative React Query state;
- persisted `report.draft.updated` still causes REST refetch and supersedes the preview;
- freeze/signature/finalization/conclusion remain explicit manual transitions.

### Individual evaluation target

- an evaluator's own criteria/recommendations autosave privately through the existing REST DRAFT endpoint;
- draft saves are serialized/debounced;
- no live score or recommendation broadcast;
- no signature autosave;
- Review & Finalize remains explicit, signed, irreversible, and continues to emit only readiness/status synchronization.

### Realtime/security boundary

The nine CDW-8 canonical persisted-domain events remain unchanged.

`report:preview` is a transport-only message, not a tenth persisted-domain event. It may be accepted only from the exact current assigned Rapporteur while the report remains editable and may be delivered only to currently authorized report viewers in the exact active defense room.

### Explicitly out of scope

- Panelist/Chairman report editing;
- multi-author report editing;
- live cursors/presence;
- generic typing indicators;
- CRDT/Yjs/OT;
- evaluator draft broadcasting;
- local persistent offline draft storage;
- new academic workflow state;
- CDW-9 hardening work.

### Entry/exit sequencing

```text
CDW-8 ACCEPTED / CLOSED
  -> CDW-LIVE-1A ACCEPTED (11ca489, FIX-1 included)
  -> CDW-LIVE-1B ACCEPTED (f10f074)
  -> CDW-LIVE-1C ACCEPTED (0b061498)
  -> CDW-LIVE-1 core ACCEPTED / CLOSED
  -> MANUAL-QA FIX-1 IMPLEMENTED (9e6d00c)
  -> MANUAL-QA FIX-2 IMPLEMENTED / SOURCE REVIEW PASS (dc1745f)
  -> MANUAL-QA FIX-3 IMPLEMENTED / SOURCE REVIEW PASS (700f014)
  -> MANUAL-QA FIX-3A ACCEPTED FOR BOUNDED UX SCOPE (fd999e80)
  -> MANUAL-QA FIX-4 IMPLEMENTED / SOURCE REVIEW PASS
  -> MANUAL-QA FIX-5 BOUNDED UX ACCEPTED
  -> MANUAL-QA FIX-6 FINAL ACCEPTED / CLOSED
  -> ADDITIONAL FULL MULTI-USER REPLAY WAIVED / NOT REQUIRED
  -> CDW-9 NEXT / AUTHORIZED
```

The project owner has explicitly changed and closed the pre-CDW-9 gate: no additional full multi-user replay is required before CDW-9. This waiver is not a manual-QA PASS claim; it is a risk-based acceptance decision grounded in targeted regressions and independent source review.

---

## 12.2 Pre-CDW-9 MANUAL-QA FIX-2 — Evaluation Finalization UX

**Status:** IMPLEMENTED / SOURCE REVIEW PASS — superseded by the later FIX-3/FIX-3A bounded refinements.

Detailed design:

    docs/superpowers/cdw-live-1/cdw-live-1-manual-qa-fix-2-evaluation-finalization-ux-design.md

### Goal

Remove evaluator-side friction discovered during manual QA without changing academic authority or backend workflow semantics.

### Required UX

- remove the evaluator **Save now** button because criteria/recommendations already autosave privately;
- keep explicit save-state feedback such as Saving, Saved, Offline, and Save failed;
- keep one primary **Review & Finalize** action;
- open a centered modal instead of expanding signature/finalization UI inside the narrow left rail;
- Step 1 = Review Evaluation;
- Step 1 action = Continue to Sign;
- Step 2 = E-Signature with a comfortably sized signing surface; FIX-3 later narrows the individual evaluation to draw-only and system-derived printed name;
- Step 2 final action = **Confirm Finalize**;
- flush/drain the newest evaluator autosave before the irreversible finalize request;
- finalization failure must keep the evaluation editable and explain the error;
- successful finalization locks the evaluation and replaces editable controls with a compact finalized state.

### Chairman-specific guardrail

The Chairman uses the same two-step modal for the Chairman's own evaluation. **Formal Verdict remains separate** and is never merged into evaluation signing/finalization.

The Chairman role rail must remain a scrollable, non-overlapping stack. Evaluation Completion, Formal Verdict, and Committee Roster must not be displaced or covered by an inline signature editor.

### Expected implementation posture

- frontend-focused;
- reuse existing evaluator draft and finalize endpoints;
- no new academic workflow state;
- no new realtime event;
- no schema change;
- no Prisma migration;
- no CDW-9 work.

### Gate

This package must be independently reviewed and manually QA'd before CDW-9 begins.

---

## 12.3 Pre-CDW-9 MANUAL-QA FIX-3 — Evaluator Signature + Verdict + Roster UX

**Status:** IMPLEMENTED / INDEPENDENT SOURCE REVIEW PASS / BOUNDED PRODUCT REVIEW ACCEPTED, including FIX-3A refinement at `fd999e80bcf211f8506565b2955e3dce22d483c4`.

Detailed design:

    docs/superpowers/cdw-live-1/cdw-live-1-manual-qa-fix-3-signature-verdict-roster-ux-design.md

### Goal

Resolve the remaining faculty-facing manual-QA issues found after FIX-2 without changing backend academic authority or conclusion gates.

### Required UX

- individual Oral Examination evaluation uses **drawn signature only**;
- evaluator does not type/re-enter their own name;
- printed evaluator name is derived from the authenticated defense assignment and is reserved for official form rendering / authorized display;
- do not remove Type capability globally from shared signature infrastructure if other document flows still use it;
- Chairman Formal Verdict readiness shows only:
  - **Evaluation Signatures** — completed/required evaluator count;
  - **Committee Report Signatures** — completed/required report-signature count, or **Waiting for report** before slots exist;
- do not show `0 of 0` for not-yet-created report signature slots;
- do not expose `Oral Examination Summary ready`, `Committee Report frozen`, or `RAP finalized` as separate faculty-facing checklist rows;
- all hidden backend conclusion requirements remain mandatory;
- Committee Roster remains collapsible and gains a visible chevron/expand-collapse affordance using native details/summary semantics where practical.

### Expected implementation posture

Frontend-focused. A minimal read-model addition for the authenticated evaluator's display/printed name is allowed only if the current frontend cannot derive it safely from the existing exact assignment/roster data. Do not create a second identity source.

No academic workflow change.
No evaluator-role change.
No conclusion-rule weakening.
No schema change.
No Prisma migration.
No CDW-9 work.

### Gate

At the FIX-3/FIX-3A checkpoint, full authenticated multi-user replay remained the planned final pre-CDW-9 gate. That historical gate was later superseded by the FIX-6 acceptance decision recorded in the 2026-10-19 pre-CDW-9 reconciliation.

---

## 12.4 Final end-to-end multi-user live-defense manual acceptance

**Status:** CLOSED BY PROJECT-OWNER ACCEPTANCE DECISION — the earlier end-to-end run exposed the FIX-6 sequencing mismatch; FIX-6 is now implemented and independently source-reviewed. An additional full replay was explicitly waived based on targeted regression evidence + independent source review. This is not recorded as a manual-QA PASS.

Required corrected workflow:

1. Chairman starts the defense.
2. Evaluation work and Committee Report work may proceed in parallel.
3. Chairman and required Panelists may continue drafting their own evaluations.
4. Rapporteur authors the Committee Report and may **Finalize Committee Report** as soon as the report content is ready; report finalization does not wait for evaluator finalization or the Oral Examination Summary.
5. Once the Committee Report is finalized, required stage-aware signers may choose **Sign Committee Report** immediately, including Chairman/Panelists whose evaluations are still DRAFT.
6. Evaluators independently finalize/e-sign their own evaluations when ready.
7. Once every required evaluator is FINALIZED, the Oral Examination Summary generates from authoritative finalized values.
8. Chairman's Formal Verdict surface reflects authoritative progress without serializing the two workstreams.
9. Formal Result controls remain unavailable until every authoritative conclusion gate passes: all required evaluations finalized/e-signed, Summary ready, Committee Report finalized, all required report signatures complete, report finalized/completed, and no existing conclusion.
10. Chairman records PASSED or REDEFENSE_REQUIRED.
11. Attempt becomes CONCLUDED and read-only.
12. Reopen the concluded workspace and verify immutable historical state.

The workflow above remains the canonical behavior. A second full role-separated browser replay is no longer required as a pre-CDW-9 prerequisite. If future hardening or product QA exposes a concrete defect, create a bounded correction instead of weakening the workflow gate.

Acceptance provenance must remain truthful: the waived replay is **NOT EXECUTED / NOT REQUIRED**, not PASS.

## 12.5 Pre-CDW-9 MANUAL-QA FIX-4 — Oral Examination Summary Computation

**Status:** IMPLEMENTED / INDEPENDENT SOURCE REVIEW PASS. Manual product inspection confirmed generated institutional Summary rows are visible in Admin; this is not a claim that the full live-defense lifecycle has passed.

Detailed design:

    docs/superpowers/cdw-live-1/cdw-live-1-manual-qa-fix-4-oral-summary-computation-design.md

Implementation report:

    docs/superpowers/cdw-live-1/cdw-live-1-manual-qa-fix-4-report.md

### Goal

Remove the current institutional Summary-generation blocker without inventing Rating/Remarks semantics and without starting official document processing.

### Confirmed computation

For every finalized required evaluator:

- Group A = finalized Group I Average;
- Group B = finalized Group II Average;
- Summary row Average = `(Group A + Group B) / 2`;
- Group I Average, Group II Average, and Summary row Average are rounded to **2 decimal places**;
- example: `(1.20 + 1.25) / 2 = 1.225 -> 1.23`;
- Rating = deferred/null;
- Remarks = deferred/null.

Required numerical evaluator rows remain Chairman + assigned evaluator Panelists only.

When all required evaluators are FINALIZED, Summary generation must be automatic/idempotent and must no longer reject merely because Rating/Remarks are unresolved.

### Internal aggregate compatibility

If the existing `OralExamSummary.overallAverage` persistence field must remain populated, derive it from the arithmetic mean of the finalized per-evaluator Summary row averages and round it to 2 decimal places. Treat it as an internal compatibility/read-model aggregate, not a new confirmed visible field on the supplied Summary Sheet and never as automatic verdict authority.

### Explicit non-goals

FIX-4 does **not** implement:

- exact Oral Examination Summary Sheet PDF/template rendering;
- exact Individual Evaluation PDF/template rendering;
- Committee Report/RAP PDF rendering;
- institutional headers/logos/form codes/page geometry;
- signature-image placement;
- Download / Print enablement;
- template revision/versioning;
- Rating or Remarks policy;
- automatic verdict.

The Admin Defense Records surface may read/display canonical Summary data. Existing Download / Print placeholders remain deferred to the future Official Defense Forms / Document Processing phase.

### Gate

FIX-4 implementation and independent source review are complete. Its numeric Summary behavior is part of the accepted implementation baseline. Later FIX-5/FIX-6 corrections are also closed; the 2026-10-19 reconciliation supersedes the earlier requirement for another full role-separated replay before CDW-9.

---

## 12.6 Pre-CDW-9 MANUAL-QA FIX-5 — Committee Report Signing + Defense Records UX Alignment

**Status:** IMPLEMENTED / INDEPENDENT SOURCE REVIEW PASS / PROJECT-OWNER TARGETED MANUAL QA PASS — BOUNDED UX ACCEPTED.

**Implementation HEAD:** `13a4c38acbc72dc13902539da398127f674384e5`

Detailed design:

    docs/superpowers/cdw-live-1/cdw-live-1-manual-qa-fix-5-committee-report-signing-defense-records-ux-design.md

Implementation report:

    docs/superpowers/cdw-live-1/cdw-live-1-manual-qa-fix-5-report.md

### Goal

Align the stale Committee Report signing experience with the accepted evaluator-signing UX and simplify the Admin Defense Record detail so it presents only operationally useful, institutionally confirmed data.

### Accepted bounded product result

Committee workspace:

- full cross-signer roster/timestamps are no longer rendered to ordinary committee viewers;
- aggregate required-signature progress remains;
- each signer sees only their own signing action/status;
- signing uses a centered single-step **Sign Committee Report -> Draw Signature -> Confirm Signature** modal because the finalized report is already visible on the page;
- Committee Report signing is draw-only;
- backend signer policy, frozen-report binding, endpoint authority, realtime invalidation, and conclusion gates remain unchanged.

Admin Defense Records:

- **Evaluation Results** uses `Evaluator | Role | Evaluation Status | Signature Status | Signed At`;
- redundant `Overall` and `Criteria` registry columns are removed without deleting underlying evaluation data;
- institutional V2 **Oral Examination Summary** shows `Examiner | Role | Group A | Group B | Average`;
- internal compatibility aggregate and deferred Final Rating are hidden from the V2 presentation;
- **Committee Report** retains the full Admin signer audit `Signer | Role | Signature Status | Signed At`;
- affected user-facing `RAP / Committee Report` / `RAP finalized` wording is replaced with plain Committee Report language;
- stale wording that placed report creation after formal conclusion is removed.

### Acceptance provenance

- agent-local automated/static/build evidence is recorded in the FIX-5 report;
- independent remote source/diff review: **PASS**;
- project-owner targeted manual QA of the corrected flow: **PASS**;
- coding-agent browser/manual QA remained **NOT EXECUTED — ENVIRONMENT LIMITATION** and is not retroactively restated as agent-executed QA.

### Explicit non-goals preserved

FIX-5 did not change:

- numerical evaluator authority;
- Committee Report signer policy;
- report freeze/version/hash semantics;
- Summary computation;
- Rating/Remarks policy;
- Chairman-only verdict authority;
- realtime domain-event count;
- schema or migrations;
- PDF/document rendering;
- Download / Print;
- CDW-9.

### Gate

FIX-5 remains accepted for its bounded UX scope. Its serialized report-finalization assumption was superseded by FIX-6. FIX-6 is now FINAL ACCEPTED / CLOSED; the project owner waived an additional full replay, so CDW-9 is the next authorized package.

---

## 12.7 Pre-CDW-9 MANUAL-QA FIX-6 — Parallel Committee Report Signing + Faculty UI Language

**Status:** FINAL ACCEPTED / CLOSED — IMPLEMENTED + INDEPENDENT SOURCE REVIEW PASS + TARGETED REGRESSION EVIDENCE ACCEPTED.

Detailed design:

    docs/superpowers/cdw-live-1/cdw-live-1-manual-qa-fix-6-parallel-report-signing-and-ui-language-design.md

### Why this package exists

Project-owner end-to-end testing confirmed the current code path works, but the implemented sequence is too strict for a real defense session. Panelists may be reviewing/signing the Committee Report while their own scores are still being completed. The system must support that parallel work without weakening the Chairman's final verdict gate.

### Confirmed rule

- Rapporteur may finalize the Committee Report when its content is ready.
- Report finalization does not require all evaluator records to be FINALIZED.
- Report finalization does not require the Oral Examination Summary to exist.
- Required Committee Report signers may sign immediately after report finalization.
- A Chairman/Panelist may sign the Committee Report while their own evaluation is still DRAFT.
- Evaluation finalization remains own-record only and independent.
- Chairman verdict remains blocked until all required evaluations, Summary, finalized Committee Report, and required report signatures are complete.

### UX language authority

FIX-6 also makes exact user-facing copy part of the design. Coding agents must implement the approved strings/meaning and must not surface internal engineering terminology such as `freeze`, `contentVersion`, `V1`, snapshot/hash identifiers, or unexplained `RAP` labels to ordinary faculty users.

### Expected impact

- bounded backend readiness/finalization rule update;
- bounded faculty Committee Report UI update;
- focused tests/verifiers;
- docs reconciliation;
- no schema/migration expected;
- no signer-role change;
- no evaluation arithmetic change;
- no verdict-authority change;
- no document/PDF rendering;
- CDW-9 is authorized next and remains unimplemented by FIX-6.

### Gate

FIX-6 implementation and independent source review are complete. Targeted regressions cover the changed parallel sequence, strict Chairman convergence gate, autosave-before-finalize ordering, signer authority, and approved faculty language.

The project owner explicitly waived an additional full multi-user manual replay before CDW-9 because the remaining risk is sufficiently covered by targeted automated evidence + independent source review. This waiver is recorded as **NOT EXECUTED / NOT REQUIRED**, not as manual-QA PASS.

Accepted product-code baseline before the docs-only reconciliation: `3e5ed6847db737e6395d531c04ee5f3b9b5c9812`.

**Next authorized package: CDW-9 — Hardening and production readiness.**

---

## 13. Phase CDW-9 — Hardening and production readiness

**Parent status:** NEXT / AUTHORIZED — CDW-9A through CDW-9E ACCEPTED / CLOSED; CDW-9F NEXT / AUTHORIZED — NOT YET IMPLEMENTED; CDW-9 NOT YET COMPLETE.

CDW-9 is the final planned production-hardening phase for the Collaborative
Defense Workspace. It is not a workflow redesign, a feature-expansion phase, or
permission to reopen accepted behavior. FIX-6 remains FINAL ACCEPTED / CLOSED. A
concrete regression may be corrected in the CDW-9 package that owns the affected
behavior; accepted behavior is not reopened for preference or cleanup.

The phase is executed through six bounded subpackages. The implementation plan
remains the detailed sequencing authority; the Source of Truth documents should
reference this section rather than duplicating it.

### 13.1 Package map and execution order

| Package | Status | Bounded purpose | Starts after |
|---|---|---|---|
| **CDW-9A** | **ACCEPTED / CLOSED** | Evaluation and Oral Examination Summary convergence hardening | Accepted pre-CDW-9 baseline + this plan |
| **CDW-9B** | **ACCEPTED / CLOSED** | Committee Report finalization and signature concurrency hardening | CDW-9A accepted |
| **CDW-9C** | **ACCEPTED / CLOSED** | Security and audit hardening | CDW-9B accepted |
| **CDW-9D** | **ACCEPTED / CLOSED** | Measured performance and query hardening | CDW-9C accepted |
| **CDW-9E** | **ACCEPTED / CLOSED** | Accessibility, keyboard, and responsive hardening | CDW-9D accepted |
| **CDW-9F** | **NEXT / AUTHORIZED — NOT YET IMPLEMENTED** | Migration/read compatibility and final production-readiness gate | CDW-9A through CDW-9E accepted |

Execution order is mandatory:

```text
CDW-9A
  -> independent review / acceptance
CDW-9B
  -> independent review / acceptance
CDW-9C
  -> independent review / acceptance
CDW-9D
  -> independent review / acceptance
CDW-9E
  -> independent review / acceptance
CDW-9F
  -> final CDW-9 acceptance
```

Do not collapse multiple subpackages into one implementation prompt, and do not
start the next subpackage automatically after one is accepted. A concrete defect
found during a later package is fixed in the package that owns the affected
behavior unless the project owner explicitly authorizes a separate bounded
correction.

### 13.2 Shared non-negotiable domain guardrails

These rules apply to every CDW-9 subpackage.

#### Verdict authority

- The assigned session Chairman is the sole formal academic verdict authority.
- `PASSED` and `REDEFENSE_REQUIRED` remain the only current new-attempt outcomes.
- Scores, averages, Summary readiness, or rating values never automatically
  determine the verdict.
- The Formal Verdict control remains hidden or disabled until the authoritative
  backend conclusion-readiness decision is true.

#### Evaluator authority and privacy

- Chairman and assigned evaluator Panelists own their own evaluations.
- Rapporteur is not an evaluator.
- Adviser is not an evaluator under current policy.
- Facilitator is not an evaluator.
- Evaluations remain private, own-record `DRAFT` -> signed/finalized -> immutable.
- No evaluator may read or mutate another evaluator's private draft scores,
  criteria, recommendations, or signature evidence.
- Evaluation finalization remains irreversible and own-record only.

#### Committee Report authority

- The assigned Rapporteur remains the single authoritative Committee Report
  writer.
- Chairman and Panelists may view the report but cannot directly edit its
  authoritative body.
- Committee Report finalization and signing remain parallel to evaluation and
  Summary completion until the Chairman verdict gate.
- Finalizing the report does not automatically sign the Rapporteur's slot.
- Report content cannot be silently changed after finalization/freeze.

#### Committee Report signing

- Required signers review and sign the exact finalized immutable report content.
- A required signer may sign while that signer's own evaluation is still `DRAFT`.
- Each user may sign only their own required slot.
- Every signature remains bound to the exact finalized report content/version/hash
  internally.
- Facilitator remains excluded from required Committee Report signing.
- Adviser participation remains stage-aware under the accepted policy:
  - Title: Chairman + Panelists + Rapporteur;
  - Proposal/Final: active Adviser + Chairman + Panelists + Rapporteur.

#### Formal verdict convergence

The Chairman may conclude only when all current canonical prerequisites remain
satisfied, including:

- all required evaluator records are `FINALIZED`/e-signed;
- the Oral Examination Summary exists and corresponds to the exact attempt;
- the Committee Report is finalized;
- every required Committee Report signature is complete;
- no prior `DefenseConclusion` exists;
- all other canonical conclusion prerequisites remain satisfied.

#### Manuscript and history integrity

- Attempt-bound manuscript evidence is immutable.
- Later revisions are new documents/versions, not overwrites.
- Annotations and comments do not mutate the source PDF.
- Annotations are not automatically promoted into the official Committee Report.
- Concluded attempts remain immutable and read-only.
- Old attempts, accepted signatures, and historical evidence must never be
  rewritten or backfilled with fabricated data.
- Realtime must never mutate historical attempts.

#### Title authority

- Do not reintroduce permanent system-selected-title authority.
- Title suggestions remain advisory/history content in the Committee Report.
- The Chairman records only the formal verdict for the Title attempt.

#### Realtime authority

- REST, domain services, and the database remain authoritative.
- Socket.IO remains synchronization/transport only.
- Persisted events occur only after successful persistence.
- Reconnect triggers authoritative refetch.
- The nine accepted persisted-domain events remain the canonical event set.
- `report:preview` remains an ephemeral transport message, not a tenth persisted
  domain event and never authoritative saved report content.
- No socket academic write path may be introduced.
- Polling fallback remains functional even when realtime is unavailable.

### 13.3 Shared verification and evidence discipline

Every subpackage must follow
`docs/superpowers/ENGINEERING_VERIFICATION_POLICY.md`.

- Use focused tests/verifiers for the changed behavior and directly affected
  regressions first.
- Broaden verification only when the change touches shared infrastructure,
  authorization/security, schema/migration/runtime boundaries, or when focused
  failures create uncertainty.
- Treat automated tests, static checks, builds, manual/browser QA, hosted CI, and
  source review as separate evidence classes.
- Do not claim manual/browser QA, multi-user replay, or hosted CI unless actually
  executed and observed.
- Each implementation must begin from the exact task prompt HEAD and verify the
  actual remote baseline before editing.
- No subpackage may silently change evaluator authority, signer policy, Summary
  arithmetic, verdict authority, title authority, realtime event count, or
  concluded-attempt immutability.

### 13.4 Stale-client behavior ownership

There is no separate CDW-9 stale-client package.

Stale-client behavior must remain close to the mutation that owns it so backend
conflict semantics and faculty-facing recovery are reviewed together:

- evaluation finalization / Summary conflicts -> **CDW-9A**;
- Committee Report draft/finalization/signature/freeze conflicts -> **CDW-9B**.

The implementation for each must return a deterministic, actionable conflict
result (for example `409` with a safe recovery path) without overwriting newer
persisted state or exposing internal identifiers to ordinary faculty UI.

### 13.5 CDW-9A — Evaluation and Oral Examination Summary Convergence Hardening

**Status:** ACCEPTED / CLOSED.

#### Purpose

Harden evaluator finalization and Oral Examination Summary generation under
concurrent, retried, and near-simultaneous completion without changing evaluator
ownership, scoring semantics, or verdict authority.

#### Exact scope

- Concurrent finalization of multiple required evaluator records.
- Simultaneous or near-simultaneous finalization of the last required evaluator.
- Exactly-once / convergence behavior for one Oral Examination Summary per exact
  defense attempt.
- Idempotent retry behavior for evaluation finalization and Summary generation.
- Evaluation-finalization CAS/version/unique-race handling.
- Stale evaluation-client behavior, including actionable `409` recovery that
  preserves the evaluator's private draft and prevents stale overwrite.
- Preservation of the confirmed institutional Summary arithmetic.

#### Affected technical concerns

- Evaluation finalization transaction boundaries and persistence uniqueness.
- Summary generation idempotency, race safety, and duplicate prevention.
- Existing evaluation version/CAS fields or equivalent conflict detection.
- Existing evaluator draft/finalize endpoints and conclusion-readiness reads.
- Deterministic conflict responses and faculty-facing recovery messaging owned by
  the evaluation surface.
- Focused concurrency and retry tests.

#### Preserved invariants

- Evaluator records remain individually owned and private.
- Finalized evaluations remain immutable.
- Every required evaluator must be `FINALIZED` before Summary generation.
- Summary rows derive only from finalized evaluator records.
- Summary generation never determines the academic verdict.
- FIX-4 arithmetic remains unchanged:
  - Group A = finalized evaluator Group I Average;
  - Group B = finalized evaluator Group II Average;
  - row Average = `(Group A + Group B) / 2`;
  - two-decimal rounding;
  - internal aggregate, if retained, is the mean of finalized row averages;
  - Rating and Remarks remain deferred/null unless separately authorized.
- Chairman + assigned evaluator Panelists remain the only numerical evaluator rows.

#### Explicit non-goals

- Redesigning Committee Report signing or report authority.
- Changing evaluator roles, signer policy, or scoring scale.
- Introducing automatic verdicts.
- Introducing Rating/Remarks policy.
- Adding a new realtime event or socket write path.
- Official PDF/print rendering.
- CDW-9B or later subpackage work.

#### Verification expectation

- Focused deterministic and concurrent tests for:
  - two or more finalizations completing close together;
  - last-evaluator finalization racing Summary generation;
  - repeated/retried finalization and Summary requests;
  - one Summary per exact attempt;
  - stale version/CAS conflict returning actionable failure without overwrite;
  - independence of Committee Report finalization from Summary readiness.
- Directly affected evaluation, Summary, readiness, and immutable-finalization
  regressions.
- Backend type/build validation when affected.
- Manual/browser QA remains project-owner owned and must not be claimed unless
  actually executed.

#### Acceptance / STOP boundary

CDW-9A was accepted after independent review of the actual pushed diff/source
confirmed the concurrency, idempotency, stale-client, privacy, and arithmetic
invariants above. The package is now **ACCEPTED / CLOSED**; no remaining blocking
CDW-9A defect was found. Do not begin CDW-9B without explicit project-owner
authorization even though it is the next authorized package.

#### Dependency / order

CDW-9A was the first CDW-9 implementation package. Its dependency on explicit
project-owner authorization and an exact starting-HEAD check was satisfied. CDW-9B
depends on CDW-9A being accepted; that prerequisite is now satisfied.

#### Implementation evidence

- Implementation commits:
  - `676d2c02d33aee1ae04bd3e94a9a51a58a91aee4`
    (`fix(cdw): harden evaluation summary convergence`);
  - `bc695f36016f487908af64715ed43a64b609d3ee`
    (`fix(cdw): guard stale evaluation drafts`);
  - `b167f8c4c40cdac9b67fc3db590f81e9f94462de`
    (`fix(cdw): recover stale evaluation drafts safely`);
  - `cc11d58df4a397faa10c9a76f1ffc917544847db`
    (`fix(cdw): sync authoritative finalized evaluation`).
- Implementation report: `docs/superpowers/cdw-9/cdw-9a-report.md`.
- Production hardening:
  - finalization converts any escaping transaction-level `P2002` unique race to
    the existing friendly `409` conflict;
  - Summary `P2002` convergence returns the winning row's authoritative snapshot
    evaluator count;
  - draft saves/finalization use an optional authoritative `updatedAt` row
    version guard and CAS predicate;
  - evaluator finalization `409` now refreshes the evaluator and workspace read
    models;
  - stale draft `409` enters an explicit conflict state, blocks automatic
    persistence, preserves local work, and requires an explicit
    **Reload latest saved evaluation** action before the authoritative snapshot
    and row version replace the local baseline;
  - an authoritative `FINALIZED` transition displays the server criteria and
    recommendations immediately, blocks stale autosave/unmount draining, hides
    the conflict/finalization UI, and needs no explicit reload.
- Schema/migration: **NONE**.
- Focused backend tests include concurrent finalization, duplicate/stale
  finalization, stale DRAFT version rejection, transaction-level unique-race
  mapping, simultaneous Summary ensure convergence, P2002 winner convergence,
  and the preserved FIX-4/verdict/Committee Report boundaries.
- Focused frontend verifiers:
  `frontend/scripts/verify-cdw9a-evaluation-convergence.mjs` and
  `frontend/scripts/verify-cdw9a-fix1-stale-recovery.mjs` (behavioral autosave
  conflict/reconcile coverage, explicit DRAFT recovery UI contract, and
  authoritative FINALIZED display/remount-safety contract).
- Manual browser/multi-user QA: **NOT EXECUTED**. The previously waived
  pre-CDW-9 replay remains **WAIVED / NOT REQUIRED**, not a PASS.

#### Acceptance review

- Independent remote source review: **PASS**.
- Review verified the actual remote commits/diff/source for finalization CAS,
  unique-race handling, Summary convergence, version conflict behavior,
  DRAFT-conflict recovery, authoritative FINALIZED display, and preserved domain
  boundaries.
- No remaining blocking CDW-9A defect was found.
- Targeted two-tab stale-evaluation Manual QA: **NOT EXECUTED**. The waived
  pre-CDW-9 replay remains **WAIVED / NOT REQUIRED** and is not represented as a
  manual/browser/full-E2E PASS.
- Acceptance reconciliation:
  `docs/superpowers/cdw-9/cdw-9a-acceptance-reconciliation-2026-10-19.md`.
- **CDW-9A is ACCEPTED / CLOSED.**

### 13.6 CDW-9B — Committee Report Finalization and Signature Concurrency Hardening

**Status:** ACCEPTED / CLOSED.

#### Purpose

Harden concurrent Committee Report finalization and signing so every required
signer converges on the same immutable report version without weakening the
parallel FIX-6 workflow or the Chairman verdict gate.

#### Exact scope

- Concurrent required Committee Report signatures.
- Duplicate and retried signing attempts.
- Final-signature convergence and exactly-once report-finalized behavior.
- Report finalization/freeze races against draft autosave and pending saves.
- Body-version / stale-client conflict behavior for report authoring and
  finalization.
- Idempotent report-finalization behavior.
- Deterministic stale-client recovery for report finalization and signing.
- Immutable content/hash/version binding across all signatures.

#### Affected technical concerns

- Report draft save CAS/body-version handling.
- Finalization transaction, snapshot/hash creation, and signer-slot reconciliation.
- Signature uniqueness/idempotency and final-signature aggregation.
- Existing `409` conflict paths and recovery UX owned by the report surface.
- Post-commit realtime publication remains best-effort and unchanged in count.
- Autosave drain / `flushAndWait()` ordering before irreversible finalization.

#### Preserved invariants

- Assigned Rapporteur is the single authoritative writer.
- Committee Report work proceeds in parallel with evaluation work.
- Report finalization does not wait for evaluator completion or Summary generation.
- Required signers may sign while their own evaluations remain `DRAFT`.
- Rapporteur finalization does not auto-sign the Rapporteur slot.
- Each user signs only their own required slot.
- Report body cannot be silently changed after finalization/freeze.
- All signatures bind the same exact finalized content/hash/version internally.
- Chairman verdict still waits for both workstreams to converge.

#### Explicit non-goals

- Changing evaluator authority or scoring semantics.
- Requiring evaluation/Summary completion before report finalization.
- Auto-signing any slot.
- Changing stage-aware signer policy.
- Reopening the accepted single-step signing UX.
- Adding a tenth persisted-domain event.
- CDW-9C or later subpackage work.

#### Verification expectation

- Focused concurrent-signature and duplicate/retry tests.
- Final-signature convergence and exactly-once finalization tests.
- Freeze-versus-save race tests, including stale body-version rejection.
- Signature-to-content/hash/version binding tests.
- Own-slot authorization and duplicate-sign protection tests.
- Regression proving report finalization remains independent of evaluations and
  Summary, while the Chairman verdict remains blocked until all gates pass.
- Directly affected autosave, report, signature, readiness, and realtime
  invalidation regressions.
- Manual/browser QA remains project-owner owned and is not claimed unless
  actually executed.

#### Acceptance / STOP boundary

Independent remote source review of the actual pushed commits/diffs confirmed
concurrency, idempotency, immutable binding, signer authorization, and
parallel-workflow invariants. No remaining blocking CDW-9B defect was found.
**CDW-9B is ACCEPTED / CLOSED.** After acceptance, **STOP**. Do not begin CDW-9C
without explicit project-owner implementation authorization.

#### Dependency / order

CDW-9A is accepted, so the CDW-9B dependency is satisfied. CDW-9B, CDW-9C, and
CDW-9D are **ACCEPTED / CLOSED**. CDW-9E is **ACCEPTED / CLOSED**.

#### Implementation evidence

- Implementation commits:
  - `8fb6f9996c24ff0e93a87d468a4a26a87ce39e6a`
    (`fix(cdw): harden report signature convergence`);
  - `cf355e91fda61482cded906868286fe82d9e80f9`
    (`fix(cdw): close report finalization race windows`);
  - `7a4ff5baa90e6d5eb7fb2e058dc7f1b614e8be55`
    (`fix(cdw): guard legacy signature retry reconciliation`).
- Implementation report: `docs/superpowers/cdw-9/cdw-9b-report.md`.
- Production hardening:
  - added transition-aware RAP aggregate recompute;
  - `finalizedNow` is truthful in modern and legacy-compatible signing;
  - concurrent partial recompute cannot return a stale non-finalized status when
    the persisted RAP already finalized;
  - anomalous `FINALIZED` rows receive `finalizedAt` once via conditional update;
  - finalize/sign `409` responses invalidate authoritative report/workspace/
    readiness state and close stale UI dialogs without retrying;
  - duplicate signed-slot retries reconcile committed aggregate state before
    returning `409`, healing a lost final recompute without rewriting evidence;
  - FIX-2: legacy-compatible duplicate retries validate the authoritative
    attempt/report state first; concluded, cancelled, missing-attempt, and
    closed modern reports reject before aggregate reconciliation while eligible
    active retries still heal;
  - Committee Report finalization sets a synchronous edit boundary, disables
    Tiptap/toolbar/Insert into Report, drains accepted edits, and restores
    editing only on safe failure.
- Schema/migration: **NONE**.
- Focused backend and frontend verification recorded in the implementation
  report, including
  `frontend/scripts/verify-cdw9b-report-signature-hardening.mjs`.
- Targeted Committee Report concurrency Manual QA: **NOT EXECUTED**. The waived
  pre-CDW-9 replay remains **WAIVED / NOT REQUIRED**, not a PASS.

Independent remote source review: **PASS**. CDW-9B, CDW-9C, and CDW-9D are
**ACCEPTED / CLOSED**. CDW-9E is **ACCEPTED / CLOSED**.

### 13.7 CDW-9C — Security and Audit Hardening

**Status:** ACCEPTED / CLOSED.

#### Purpose

Prove and harden the collaborative workspace's authorization, privacy, audit,
and immutability boundaries before production readiness.

#### Exact scope

- Defense-workspace authorization regression.
- Exact-attempt and exact-document authorization.
- Role-based read/write boundaries across Chairman, Panelists, Rapporteur,
  Adviser, Facilitator, Admin, and Student surfaces.
- Signature privacy and signature-evidence protection.
- Finalized and historical immutability enforcement.
- Realtime room authorization regression.
- Sensitive field/data-leak regression.
- Production audit coverage for material defense actions.

#### Affected technical concerns

- Existing authorization services/middleware and assignment-derived capabilities.
- Document retrieval authorization and storage-path containment.
- Signature evidence serialization and read-model field allow-lists.
- Finalized/concluded mutation rejection paths.
- Socket authentication, room join, stale-member eviction, and event delivery.
- Audit logging for material actions such as start, finalize, report finalize,
  sign, and conclude.
- Audit storage/query design that remains distinct from realtime synchronization.

#### Preserved invariants

- Authorization is based on exact current schedule/attempt assignment, not broad
  account role alone.
- No cross-thesis or cross-attempt document/annotation access.
- Raw signature evidence is not exposed unnecessarily.
- Private evaluator `DRAFT` scores/recommendations are not exposed to other
  evaluators.
- Unauthorized document/storage paths are not exposed.
- Faculty UI does not receive sensitive implementation details.
- Concluded attempts and historical records remain read-only.
- Audit logging does not become a second domain-event bus, workflow engine, or
  mutation path.

#### Explicit non-goals

- Redesigning authorization policy or expanding role authority.
- Making Admin a live committee collaborator.
- Adding a tenth realtime event.
- Replacing realtime events with audit records or vice versa.
- Exposing raw signature images in ordinary faculty/realtime surfaces.
- Official form rendering or Dean-signing authority.
- CDW-9D or later subpackage work.

#### Verification expectation

- Negative authorization tests across roles and exact attempts/documents.
- Realtime room join/denial, removed-member eviction, and reconnect denial tests.
- Payload and read-model privacy allow-list regression.
- Finalized/concluded immutability tests.
- Audit assertions for material actions and sensitive-field exclusion.
- Broader security regression is justified for this subpackage because the change
  touches shared authorization/security boundaries; broaden to related suites and
  builds as appropriate and state the reason.
- Manual/browser QA remains project-owner owned and is not claimed unless
  actually executed.

#### Implementation evidence

- Implementation commit: `c530a237eb7ad43da5ed99ddf6684f93ccfeb6e1`
  (`fix(cdw): harden defense security and audit boundaries`).
- Implementation report: `docs/superpowers/cdw-9/cdw-9c-report.md`.
- Added a shared allow-listed `AuditLog` writer and transaction-bound audit
  records for session start, evaluation finalization, Committee Report
  finalization, Committee Report signature (modern and legacy-compatible), and
  formal verdict recording.
- No concrete authorization, cross-attempt, evaluator-privacy, signature-privacy,
  document-binding, immutability, or realtime-authorization defect was found;
  existing protections remain covered by their focused regressions.
- Schema/migration: **NONE**. Frontend: **NONE**.
- Full backend suite: **160 files / 1882 passed / 5 skipped / 0 failed**.
- Backend build (`tsc`): **PASS**.
- Targeted CDW-9C Manual QA: **NOT EXECUTED**. Hosted CI:
  **NOT OBSERVED / NOT CLAIMED**.

#### Acceptance / STOP boundary

Independent remote source/diff review: **PASS**. The review confirmed the
authorization, privacy, immutability, audit, and realtime-boundary evidence. No
remaining blocking CDW-9C defect was found. **CDW-9C is ACCEPTED / CLOSED.**
After acceptance, **STOP**. Do not begin CDW-9D without explicit project-owner
implementation authorization.

#### Dependency / order

CDW-9B is accepted, so the CDW-9C dependency is satisfied. CDW-9C and CDW-9D
are **ACCEPTED / CLOSED**. CDW-9E is **ACCEPTED / CLOSED**.

### 13.8 CDW-9D — Measured Performance and Query Hardening

**Status:** ACCEPTED / CLOSED.

#### Purpose

Establish measured evidence for Defense Workspace performance and optimize only
proven bottlenecks.

#### Exact scope

- Measure representative large-manuscript performance first.
- Measure annotation/thread loading behavior.
- Inspect Defense Workspace query patterns.
- Inspect schedule/document/thread query plans where practical.
- Introduce pagination or lazy loading only when measurement justifies it.
- Introduce indexes only when justified by actual query patterns.
- Optimize proven bottlenecks.
- Validate realtime/polling behavior under representative load.

#### Affected technical concerns

- Representative dataset/fixture construction and repeatable measurement method.
- PDF/manuscript load and rendering behavior.
- Annotation/comment thread query volume and payload size.
- Workspace aggregate query patterns and N+1 risks.
- Database query plans/index usage where practical.
- Realtime invalidation/refetch load and polling fallback under active sessions.
- Before/after evidence retained in the package report.

#### Preserved invariants

- Performance must be measured before adding speculative caching.
- No caching, pagination, virtualisation, or schema/index change merely because
  it seems useful.
- PDF/manuscript bytes remain immutable.
- REST/database remains authoritative.
- Socket.IO remains invalidation-only.
- Polling fallback remains intact.
- No academic workflow or authority changes.

#### Explicit non-goals

- New product features or workflow states.
- Speculative caching or speculative denormalization.
- Indexes without measured query evidence.
- CRDT, presence, typing indicators, or manuscript diff.
- Changing polling intervals without measured justification.
- CDW-9E or later subpackage work.

#### Verification expectation

- Document the measurement environment, representative dataset, baseline
  metrics, bottleneck evidence, and reason for each optimization.
- Provide before/after measurements for every accepted optimization.
- Focused regression for changed query/loading behavior.
- Query-plan evidence where an index is introduced; any schema/index change must
  ship with an additive committed migration and explicit justification.
- Realtime/polling load validation under representative conditions.
- Manual/browser QA remains project-owner owned and is not claimed unless
  actually executed.

#### Implementation evidence

- Implementation commit: `801f3524282b71ecf7cb6f9f7e2b725680709064`
  (`perf(cdw): harden measured workspace query paths`).
- Implementation report: `docs/superpowers/cdw-9/cdw-9d-report.md`.
- Measurement harness:
  `backend/tests/performance/cdw9d-performance.test.ts`.
- Measured representative workload: 7 committee assignments, 4 evaluator rows,
  5 signatures, 5 document versions, 250 annotations / 750 comments, and a
  generated 250-page / 10.26 MiB manuscript.
- Accepted optimization: removed the redundant assignment query from workspace
  and Committee Report reads by using the exact roster already loaded with the
  attempt snapshot. Both read paths moved from **2 queries to 1**.
- Rejected as unsupported: pagination, lazy loading, caching, index/schema
  changes, polling interval changes, realtime changes, and manuscript/storage
  changes.
- No MySQL query plan was available; query-count/cardinality evidence was used.
- Schema/migration: **NONE**. Frontend: **NONE**.
- Full backend suite: **161 files / 1888 passed / 5 skipped / 0 failed**.
- Backend build (`tsc`): **PASS**.
- Targeted CDW-9D Manual QA: **NOT EXECUTED**. Hosted CI:
  **NOT OBSERVED / NOT CLAIMED**.

#### Acceptance / STOP boundary

Independent remote source/diff review: **PASS**. The review confirmed that
measurement preceded optimization, the evidence justifies each change, and no
speculative optimization or workflow change was introduced. No remaining
blocking CDW-9D defect was found. **CDW-9D is ACCEPTED / CLOSED.** After
acceptance, **STOP**. Do not begin CDW-9E without explicit project-owner
implementation authorization.

#### Dependency / order

CDW-9C is accepted, so the CDW-9D dependency is satisfied. CDW-9D is
**ACCEPTED / CLOSED**. CDW-9E is **ACCEPTED / CLOSED**.

### 13.9 CDW-9E — Accessibility, Keyboard, and Responsive Hardening

**Status:** ACCEPTED / CLOSED.

#### Purpose

Harden the accepted Defense Workspace interaction experience for keyboard,
assistive-technology, focus, and responsive use without redesigning it.

#### Exact scope

- Defense Workspace keyboard navigation.
- Focus behavior, focus trapping, focus restoration, and Escape/cancel behavior.
- Dialogs and signature flows.
- Evaluator finalization flow.
- Committee Report finalization/signing flow.
- Collapsible rails/drawers.
- Narrow/mobile layouts where applicable.
- Practical accessibility semantics, labels, and status announcements.
- Loading/error/conflict states.
- Responsive QA of the affected surfaces.

#### Affected technical concerns

- Shared Dialog/focus primitives and canvas signature pad accessibility.
- Role rail, comments rail, and responsive drawer behavior.
- Keyboard order and operable controls in dense workspace regions.
- Status/error/conflict messaging that remains perceivable without color alone.
- Layout stability and overflow on narrow screens.
- Existing verifiers, typecheck, and scoped lint for changed components.

#### Preserved invariants

- This is hardening, not a redesign.
- Accepted visual language and domain workflow remain unchanged.
- No new academic action, permission, or state is introduced.
- No UI copy invents policy or exposes implementation terminology.
- Existing loading/error/conflict recovery remains truthful.
- No unrelated UI/UX design decision is reopened solely because it is imperfect.

#### Explicit non-goals

- Redesigning Defense Workspace information architecture.
- Changing evaluator/report/verdict workflow.
- Adding presence, cursors, typing indicators, or collaborative editing.
- Broad unrelated accessibility cleanup outside the affected surfaces.
- CDW-9F or later subpackage work.

#### Verification expectation

- Focused component/verifier coverage for changed keyboard, focus, label, and
  responsive behavior where the repository supports it.
- TypeScript and scoped lint for changed frontend source.
- Targeted manual browser/keyboard/responsive QA where executable; otherwise
  report **NOT EXECUTED** and identify the project-owner-owned review.
- Do not treat source inspection as a substitute for manual accessibility QA.

#### Implementation evidence

- Implementation commit: `b5c751e1b777a44f2efe44b353ef6e814c7b4b3e`
  (`fix(cdw): harden workspace accessibility and responsive behavior`).
- Implementation report: `docs/superpowers/cdw-9/cdw-9e-report.md`.
- Mobile drawers: focus movement/trap, Escape close, background inertness, and
  trigger focus restoration.
- Center navigation: tablist/tab/tabpanel semantics and arrow/Home/End behavior.
- Dialogs: Review → Sign and Back focus handling; pending live status; errors
  remain role alert; pending irreversible actions remain non-dismissible.
- Draw-only signature pad: focusable canvas, accessible instructions/status, and
  Clear keyboard operation. Typed signatures remain disabled.
- Status/error surfaces now use polite status or alert semantics as appropriate.
- Responsive containment added for drawers/center layout without a desktop
  redesign.
- Backend/schema/realtime: **NONE**.
- CDW-9E verifier: **9 passed / 0 failed**. Combined affected verifier suite:
  **155 passed / 0 failed**. Frontend TypeScript: **PASS**. Scoped ESLint:
  **0 errors** (one pre-existing image warning). Frontend build: **PASS**.
- Targeted CDW-9E Manual Accessibility/Responsive QA: **NOT EXECUTED**. Hosted
  CI: **NOT OBSERVED / NOT CLAIMED**.

#### Independent acceptance

Independent remote source/diff review: **PASS**. The initial implementation's two
mobile-drawer defects were corrected by FIX-1
(`edb6f50995241b877476d3da53df7004a5a33db7`). The final remote source preserves
the accepted keyboard/focus, responsive, signing, authority, autosave,
realtime, backend, and schema boundaries.

Evidence remains correctly classified: initial agent-local verifier evidence
passed; FIX-1 focused verifiers passed; project-owner local development-server
sanity passed; Targeted CDW-9E Manual Accessibility/Responsive QA remains
**NOT EXECUTED**; hosted CI remains **NOT OBSERVED / NOT CLAIMED**. No WCAG
compliance is claimed, and draw-only signing remains not fully keyboard-equivalent.

Under the documented risk-based rule and explicit project-owner acceptance,
**CDW-9E is ACCEPTED / CLOSED**. **CDW-9F is NEXT / AUTHORIZED — NOT YET
IMPLEMENTED**.

#### Acceptance / STOP boundary

CDW-9E is accepted only after independent review and truthful manual-QA evidence
for the affected surfaces, or an explicit project-owner acceptance decision that
does not misstate unexecuted checks as passed. After acceptance, **STOP**. Do not
begin CDW-9F without explicit project-owner authorization.

#### Dependency / order

CDW-9D is accepted, so the CDW-9E dependency is satisfied. CDW-9E is
**IMPLEMENTED / PENDING INDEPENDENT REVIEW**. CDW-9F remains
**PLANNED / NOT YET IMPLEMENTED** and must not begin without CDW-9E acceptance and
explicit project-owner authorization.

### 13.10 CDW-9F — Migration / Read Compatibility and Final Production-Readiness Gate

**Status:** NEXT / AUTHORIZED — NOT YET IMPLEMENTED.

#### Purpose

Close CDW-9 by proving migration/read compatibility and production readiness
across the accepted collaborative workspace, then run the final risk-based
cross-package regression gate.

#### Exact scope

- Migration forward compatibility.
- Rollback planning/validation where the project’s supported deployment process
  permits it.
- Legacy record readability.
- Legacy scoring-version preservation.
- Concluded attempt readability.
- Historical Committee Report/signature readability.
- Production/deployment readiness related to the collaborative workspace.
- Final risk-based cross-package regression after CDW-9A through CDW-9E are
  accepted.

#### Affected technical concerns

- Prisma migration chain integrity and `migrate deploy` readiness.
- Read compatibility for legacy and concluded attempts.
- Legacy `LEGACY_POINTS_V1` and institutional `INSTITUTIONAL_MATRIX_V2` records.
- Historical report snapshots/signatures and read-only rendering.
- Runtime configuration, CORS/allowlists, WebSocket upgrade readiness, JWT
  transport, private document retrieval, and polling fallback.
- Final integration regression across the accepted collaborative workflow.

#### Preserved invariants

- No destructive migration, enum removal, historical rewrite, or fabricated
  backfill.
- Any schema change must ship with a committed additive migration; use
  `npx prisma migrate deploy`, never `prisma db push`.
- Legacy records remain readable and unchanged.
- Concluded attempts remain immutable/read-only.
- No new feature, workflow state, or authority expansion is introduced.
- CDW-9F is a convergence/acceptance gate, not permission to revisit accepted
  product decisions.

#### Explicit non-goals

- New features or workflow redesign.
- Rewriting historical acceptance evidence.
- Backfilling legacy records with fabricated data.
- Official PDF/form rendering.
- Dean signing authority, Facilitator authority, or Adviser evaluator authority.
- Starting a later initiative after CDW-9 acceptance.

#### Verification expectation

- Verify the complete migration chain and forward compatibility.
- Validate rollback/read-compatibility expectations where supported; report what
  was not executable.
- Run legacy/concluded-attempt read-compatibility regressions.
- Run a final risk-based cross-package regression. Broader or full suites are
  justified here because CDW-9F is an explicit final production-readiness gate;
  state the exact commands and reason.
- Validate backend/frontend builds and schema tooling appropriate to the final
  gate.
- Manual/browser QA and hosted CI must be reported truthfully as executed,
  waived, or not executed. A waived replay is not a manual-QA PASS.

#### Acceptance / STOP boundary

CDW-9F is the final CDW-9 acceptance gate. It may be accepted only after
CDW-9A through CDW-9E are accepted and independent review confirms migration/read
compatibility, production-readiness evidence, and final regression results.

After CDW-9F acceptance, **STOP CDW-9**. Do not begin any new initiative
automatically.

#### Dependency / order

CDW-9F starts only after CDW-9E is accepted. It is the last package in the CDW-9
sequence.

### 13.11 CDW-9 phase completion

CDW-9 is complete only when CDW-9A through CDW-9F are independently accepted in
order and the final production-readiness gate has passed under the evidence rules
above.

Until then, CDW-9 remains **NEXT / AUTHORIZED — NOT YET COMPLETE**. CDW-9A
through CDW-9D are **ACCEPTED / CLOSED**. CDW-9E is **IMPLEMENTED / PENDING
INDEPENDENT REVIEW**. CDW-9F remains **PLANNED / NOT YET IMPLEMENTED**.

### 13.12 Explicitly deferred / outside CDW-9

CDW-9 must not implement or authorize:

- CRDT/Yjs collaborative editing;
- multi-author Committee Report editing;
- live cursors;
- generic presence or typing indicators unless separately authorized;
- manuscript byte editing by committee members;
- AI manuscript comparison;
- automatic RAP recommendation-compliance checking;
- AI-based academic verdicts;
- automatic verdict selection from scores;
- official EARIST form/PDF rendering unless separately scoped;
- new Dean signing authority;
- new Facilitator academic authority;
- new Adviser evaluator authority;
- a permanent system-selected Title;
- unrelated Student/Admin workflow redesign;
- unrelated repository cleanup or refactoring.

---

## 14. Package guardrails for coding agents

Every package prompt must follow the cross-cutting engineering policy in:

`docs/superpowers/ENGINEERING_VERIFICATION_POLICY.md`

Do not make full-repository regression the default for every bounded change. Verification depth must match change risk.

Every package prompt must include:

- exact starting branch/HEAD;
- package scope;
- explicit files/modules likely involved;
- authoritative Source of Truth sections;
- forbidden out-of-scope behavior;
- required focused tests;
- risk-based verification requirements and any explicit reason a broad/full suite is required;
- expected report format.

Agents must not:

- reopen or rewrite CDW-8 acceptance history when implementing CDW-LIVE-1;
- implement Socket.IO before CDW-8;
- auto-decide verdict from scores;
- make Rapporteur an evaluator;
- make Adviser an evaluator under current policy;
- make Facilitator a required RAP signer;
- put Adviser in Title committee/RAP;
- reintroduce permanent selected-title authority;
- mutate old attempts;
- auto-carry annotations into revised manuscripts;
- expose live individual evaluator scores/draft recommendations to other Panelists;
- give Panelists/Chairman edit authority over the Rapporteur report;
- treat an ephemeral report preview as the authoritative saved report;
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
