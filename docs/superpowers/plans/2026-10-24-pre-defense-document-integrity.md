# Pre-Defense Document Integrity & Visibility — Implementation Plan

**Date:** 2026-10-24  
**Repository:** `MuelTech/graduate-system`  
**Target branch:** `feat/pre-defense-document-integrity`  
**Parent authority:** `docs/superpowers/DEFENSE_WORKFLOW_SOURCE_OF_TRUTH.md`  
**Document authority:** `docs/superpowers/DOCUMENT_LIFECYCLE_SOURCE_OF_TRUTH.md`  
**Tracking index:** `docs/superpowers/GSIS_IMPLEMENTATION_CHECKLIST.md`  
**Verification authority:** `docs/superpowers/ENGINEERING_VERIFICATION_POLICY.md`  
**Status:** APPROVED DESIGN / NOT YET IMPLEMENTED

## 1. Goal

Implement two bounded packages that strengthen exact Proposal/Final manuscript authority and preserve document visibility without recreating the old paper workflow:

1. **PREDEF-1 — GS-017 Adviser Certification + certification guardrail**
2. **PREDEF-2 — Defense Application / Scheduled Defense Submission Context**

The initiative is prevention-first. It must make it difficult for an Adviser to certify the wrong manuscript, make the resulting official certification transparent to the Student/Adviser/Admin, and keep the exact approved submission visible after scheduling.

## 2. Starting invariants — do not regress

- Proposal/Final manuscript review is separate from Defense Application supporting evidence.
- The active Adviser reviews the Student manuscript and either requests changes or certifies/e-signs it.
- `AdviserCertification.reviewedDocumentId` is the exact manuscript authority.
- `ISSUED` Adviser Certification is write-once under the ordinary workflow.
- Proposal/Final Defense Application does not ask the Student to upload a duplicate manuscript.
- COR and receipt/proof are stage-scoped supporting evidence and may be corrected independently through the rejected-application resubmission flow.
- Scheduling must use the authoritative exact manuscript; no current/latest manuscript fallback is allowed.
- GS-006/GS-007 generation is currently exact-schedule based and Admin-only.
- Existing official defense PDF renderers are server-owned and must not expose raw signature evidence or storage paths.

Before coding, reverify these invariants against the live branch and record the exact starting HEAD.

## 3. PREDEF-1 — GS-017 Adviser Certification + guardrail

### 3.1 Official-form renderer

Create a bounded official-form renderer for **EARIST-QSF-GS-017 Rev. 01 (06.20.25) — Thesis/Dissertation Adviser's Certification** under the existing official-defense document architecture.

Recommended location:

- `backend/src/documents/official-defense/adviser-certification/`

Reuse accepted shared official-form helpers where appropriate. Reconstruct from the project-owner-supplied GS-017 reference; do not invent printed fields, labels, signatures, or institutional policy.

The renderer input must be explicit display data. It must not query Prisma, authorize callers, infer the current Adviser, or search for a latest manuscript.

### 3.2 Authoritative field mapping

The service layer must derive printed values from authoritative records, including:

- owning Student identity;
- Graduate School program/course display identity;
- exact Proposal/Final manuscript title/document identity required by the official form;
- Proposal vs Final certification stage;
- server-owned certification/signing date;
- issuer Adviser printed name;
- the persisted Adviser certification signature for internal rendering only.

The exact `AdviserCertification.reviewedDocumentId` must be loaded and validated. If the reviewed document cannot be proven, fail closed rather than rendering from a current/latest manuscript.

No Title GS-017.

### 3.3 Certification confirmation guardrail

Refine the existing Adviser review action surface before `Certify & Sign`.

At minimum, the confirmation must show:

- Student name;
- Proposal or Final stage;
- exact manuscript filename/document identity;
- a **View Manuscript** action using the existing authorized document path;
- clear irreversible/exact-document copy stating that the certification will be bound to this exact manuscript.

Require an explicit acknowledgement before the final certification action is enabled/submitted.

The guardrail is additive UX. Server authorization and `expectedReviewedDocumentId`/exact-document checks remain authoritative and must not be weakened.

Suggested confirmation meaning:

> I confirm that I reviewed this exact manuscript and that it is the document I am certifying as ready for defense application.

Exact UI wording may be refined during implementation, but the semantic acknowledgement must remain.

### 3.4 GS-017 access policy

Authorized read-only access:

- issuer Adviser -> own issued GS-017;
- owning Student -> GS-017 for own thesis/dissertation;
- Admin -> GS-017 for Defense Application review and scheduled-defense record context.

Do not grant direct GS-017 access merely because a user is Chairman/Panelist on the defense.

Cross-Student, cross-thesis, and unrelated-Adviser access must fail closed.

Raw `signatureData`, storage paths, storage keys, and internal hashes must never be returned as ordinary document metadata. The PDF endpoint returns PDF bytes only.

### 3.5 Record-mode UX after issuance

After certification is issued, Adviser and Student surfaces should present:

- certification status;
- exact certified manuscript identity;
- certification date;
- **View GS-017** / **Download Copy**;
- clear copy that no additional upload/submission is required.

Do not label the record as a new task. Do not instruct printing or physical submission unless EARIST later confirms that policy.

Recommended Adviser surface: existing **My Advisees -> Manuscript Reviews -> selected review context**.

Recommended Student surface: existing Proposal/Final defense/manuscript status context and the relevant Defense Application requirements/status presentation.

### 3.6 Admin Defense Application integration

In the existing Admin Defense Application review detail, Proposal/Final should expose the exact certified manuscript and GS-017 as system-owned certification evidence.

GS-017 must not appear as an upload slot.

Admin rejection for COR/receipt/other supporting evidence must not invalidate the certification. Ordinary resubmission continues to replace only the affected evidence.

## 4. PREDEF-2 — Defense Application / Scheduled Defense Submission Context

### 4.1 Admin scheduled-defense context

Extend the existing read-only Scheduled Defense detail rather than creating another Admin module.

Recommended surface:

- `Admin -> Scheduling & Panels -> Scheduled -> selected defense`

Add a read-only **Defense Submission** / equivalent section containing:

- exact manuscript from `DefenseSchedule.manuscriptDocumentId`;
- GS-017 for Proposal/Final when applicable;
- stage-scoped COR;
- receipt/proof;
- other bounded approved application evidence that is necessary to understand the scheduled defense.

Do not infer a missing schedule manuscript from a newer/current upload. Missing exact binding must be surfaced as a data/integrity problem.

This package does **not** add committee editing/replacement controls.

### 4.2 Student completed Defense Application record

The physical workflow treats the Defense Application as part of Student application, but GS-IS must not recreate a manual print-fill-upload loop.

Once the exact schedule/committee data make the official GS-006/GS-007 complete:

- allow the owning Student to **View Official Application**;
- allow download of a copy if the existing document UX supports it;
- keep the record read-only;
- state that no additional upload, printing, or submission is required unless the Graduate School explicitly instructs otherwise.

The Student does not gain edit authority over approval, schedule, committee assignments, institutional signatories, or payment metadata.

### 4.3 Student route authorization

Current GS-006/GS-007 PDF access is Admin-only. Do not simply broaden the existing ADMIN middleware to every Student.

Prefer a dedicated Student-owned access path or a role-aware service boundary that proves:

- authenticated Student owns the ThesisRecord/DefenseSchedule;
- exact schedule is the source of the rendered form;
- cross-Student schedule access returns an authorization-safe failure;
- no raw storage/signature internals are exposed.

Admin generation/printing remains available through the existing Admin authority.

### 4.4 Adviser boundary

Adviser access to GS-006/GS-007 is not required by default. Adviser transparency in this initiative centers on the Adviser-issued GS-017 and the exact manuscript they certified.

## 5. Expected code surfaces to audit before edits

Backend:

- `backend/prisma/schema.prisma` — verify existing AdviserCertification fields; no migration expected unless the live audit proves a real missing authority field.
- `backend/src/services/proposal-adviser-review.service.ts`
- `backend/src/services/final-adviser-review.service.ts`
- `backend/src/services/official-defense-document.service.ts`
- `backend/src/controllers/thesis.controller.ts`
- `backend/src/routes/thesis.routes.ts`
- `backend/src/documents/official-defense/**`
- relevant document-authorization and Defense Application repositories/read models.

Frontend:

- `frontend/src/components/panelist/adviser-review-action-panel.tsx`
- My Advisees manuscript-review context/detail components;
- Student Proposal/Final defense/status pages;
- Admin Defense Application review detail;
- `frontend/src/components/admin/defense-scheduling/scheduled-defense-detail.tsx`
- existing official-PDF request/download helpers.

Tests/verifiers:

- Adviser review service tests;
- official-defense document route/service/renderer tests;
- document authorization tests;
- Admin Defense Application/Scheduling verifiers;
- Student ownership/access tests.

Exact changed-file set must be based on the live branch audit; this list is guidance, not permission for unrelated refactors.

## 6. Verification requirements

### PREDEF-1 focused checks

- Proposal GS-017 successful render from exact issued certification.
- Final GS-017 successful render from exact issued certification.
- Title request rejected/not applicable.
- missing/non-issued certification fails closed.
- missing/mismatched `reviewedDocumentId` fails closed.
- issuer Adviser authorized; unrelated Adviser denied.
- owning Student authorized; other Student denied.
- Admin authorized.
- ordinary Chairman/Panelist assignment alone does not grant GS-017.
- route returns PDF bytes without raw signature/storage metadata.
- Adviser certification cannot be submitted from the UI without explicit exact-document acknowledgement.
- existing server-side exact-document CAS/expected-document protections remain passing.

### PREDEF-2 focused checks

- Admin Scheduled detail shows the exact schedule-bound manuscript, not a current/latest replacement.
- Proposal/Final scheduled context surfaces applicable GS-017.
- supporting evidence remains stage-scoped.
- owning Student can view/download own completed GS-006/GS-007.
- Student cannot access another Student's application/schedule PDF.
- Student PDF access is read-only and cannot mutate application/schedule/committee data.
- Admin official-form behavior remains unchanged except for the intended contextual visibility.

### Regression evidence

- focused backend unit/service/route tests;
- relevant frontend static/verifier tests;
- backend build/typecheck required by repository policy;
- frontend build/lint/typecheck required by repository policy;
- no unrelated waiver/storage/extraction behavior changes.

Do not report source review as manual QA or local tests as hosted CI.

## 7. Manual visual/browser QA

Required before final acceptance:

1. Compare freshly generated Proposal GS-017 against the supplied official reference.
2. Compare freshly generated Final GS-017 against the supplied official reference.
3. Adviser review: open exact manuscript -> acknowledgement -> Certify & Sign -> issued record view.
4. Student Proposal/Final: issued GS-017 appears as read-only official record with no-upload guidance.
5. Admin Defense Application: exact certified manuscript + GS-017 visible together.
6. Admin Scheduled detail: manuscript/evidence context remains visible after scheduling.
7. Student scheduled state: completed GS-006/GS-007 is viewable as a read-only official record with no-action guidance.
8. Negative authorization checks for cross-Student/unrelated-Adviser access.

If browser/manual QA is not executed, report **NOT EXECUTED**; do not infer PASS from tests.

## 8. Out of scope

- PREDEF-3 certified-manuscript correction/re-certification/exact-document rebinding.
- DEF-CORR-1 committee member replacement, role correction, or schedule-management mutation.
- new Admin generic document override/delete controls.
- automatic latest-manuscript fallback.
- Student upload of GS-017.
- Adviser access to GS-006/GS-007 by default.
- unconfirmed physical-print or paper-submission instructions.
- institutional official/signatory configuration work already tracked separately.
- generated official-document persistence/version lifecycle unless separately approved.

## 9. Suggested implementation sequence

1. Verify branch/head/clean state; read canonical docs and this plan.
2. Audit live GS-017 data availability and existing Adviser certification routes.
3. Implement PREDEF-1 renderer + service/authorization + tests.
4. Implement PREDEF-1 Adviser guardrail and Adviser/Student/Admin record visibility.
5. Run focused verification and generate blank/representative GS-017 samples for visual QA.
6. Implement PREDEF-2 Admin Scheduled Defense Submission Context.
7. Implement Student-owned completed GS-006/GS-007 read-only access.
8. Run focused + proportional regression checks.
9. Perform project-owner visual/manual QA.
10. Independently review the remote diff before acceptance.
11. Update checklist/source-of-truth implementation status only after acceptance.

Suggested bounded commit progression:

- `feat(documents): add adviser certification form`
- `feat(adviser): confirm exact manuscript before certification`
- `feat(defense): surface pre-defense document context`

The agent may combine commits when technically necessary, but the review report must preserve PREDEF-1 vs PREDEF-2 scope boundaries.

## 10. Acceptance gate

PREDEF-1 is accepted only when the exact-document guardrail, GS-017 generation, authorization matrix, and required visual QA are complete.

PREDEF-2 is accepted only when Admin retains exact scheduled submission context and the owning Student can view the completed Defense Application record without gaining edit authority or being instructed to recreate a paper workflow.

Do not begin DEF-CORR-1 automatically after this branch. Merge/accept PREDEF first, return to `main`, then create the separate committee-correction branch if still approved.
