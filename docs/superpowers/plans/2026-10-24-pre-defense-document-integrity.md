# Pre-Defense Document Integrity & Visibility — Implementation Plan

**Date:** 2026-10-24  
**Repository:** `MuelTech/graduate-system`  
**Target branch:** `feat/pre-defense-document-integrity`  
**Parent authority:** `docs/superpowers/DEFENSE_WORKFLOW_SOURCE_OF_TRUTH.md`  
**Document authority:** `docs/superpowers/DOCUMENT_LIFECYCLE_SOURCE_OF_TRUTH.md`  
**Tracking index:** `docs/superpowers/GSIS_IMPLEMENTATION_CHECKLIST.md`  
**Verification authority:** `docs/superpowers/ENGINEERING_VERIFICATION_POLICY.md`  
**Status:** PREDEF-1A + PREDEF-1B0 + PREDEF-1B/1C + PREDEF-2 ACCEPTED FOR DOCUMENTED SCOPE; PREDEF-3 DEFERRED; DEF-CORR-1 SEPARATE FUTURE PACKAGE

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
- PREDEF-1A GS-017 renderer is now the accepted/frozen presentation baseline; later packages must supply authoritative data into that contract rather than redesigning the PDF.
- PREDEF-1B0 adds exact manuscript-title metadata; rollout requires its additive migration. Legacy rows remain null rather than receiving titles inferred from historical Title Defense text.

Before coding, reverify these invariants against the live branch and record the exact starting HEAD.

## 2.1 Execution ownership and acceptance checkpoints

This plan is intentionally split between document reconstruction and workflow integration so the official GS-017 visual contract can be accepted before it is connected to live business data.

### PREDEF-1A — Codex: GS-017 renderer only

Codex owns the first bounded implementation pass:

- create/use `feat/pre-defense-document-integrity` from the verified current `main` HEAD;
- reconstruct **EARIST-QSF-GS-017 Rev. 01 (06.20.25)** inside the existing official-defense document architecture;
- implement the explicit typed renderer/input contract only;
- reuse accepted shared PDF helpers/assets where appropriate;
- add renderer-focused tests and a local sample-generation script for representative Proposal/Final data;
- generate fresh Proposal and Final sample PDFs for project-owner visual review.

PREDEF-1A must **not** add or change:

- live Prisma/service mapping from `AdviserCertification`;
- API/controller/route integration;
- Student/Adviser/Admin authorization;
- Adviser `Certify & Sign` workflow/guardrail;
- Student/Admin portal visibility;
- PREDEF-2 scheduled-submission behavior.

The renderer must remain pure: explicit display input -> PDF bytes. It must not query Prisma, perform authorization, discover the current Adviser, or search for a latest manuscript.

### PREDEF-1A visual acceptance gate

After Codex produces the renderer:

1. Generate representative Proposal and Final GS-017 samples.
2. Compare them visually with the supplied official GS-017 reference.
3. Correct spacing, typography, checkbox placement, rules/underlines, signature placement, masthead/footer identity, and page geometry as needed.
4. Repeat until the project owner explicitly accepts the rendered form.

Once accepted, the renderer layout and typed display contract become the **frozen presentation baseline** for the next phase. Later integration work must not casually redesign the PDF; changes require a verified renderer defect, a newly supplied official reference, or explicit project-owner approval.

### PREDEF-1B0 — Codex: exact manuscript-title authority

After PREDEF-1A visual acceptance, Codex owns one additional bounded data-authority package before live GS-017 integration:

- add a legacy-compatible nullable manuscript-title field to `ThesisDocument` (recommended name: `manuscriptTitle` / database `manuscript_title`);
- require a non-blank Thesis/Dissertation Title on every new Proposal/Final manuscript submission;
- persist title + uploaded manuscript as one exact versioned submission;
- when Adviser Request Changes leads to a replacement manuscript, create/preserve the new manuscript version with its own title snapshot while keeping earlier title/file history intact;
- update Student Proposal/Final submission UI to capture the required title;
- update Adviser review/read models to display the exact title alongside the exact manuscript/file identity;
- add focused migration/service/controller/frontend tests for title validation, persistence, version preservation, and safe DTO exposure.

PREDEF-1B0 must **not** yet implement GS-017 HTTP routes, Student/Admin GS-017 visibility, or PREDEF-2. It may touch the existing Proposal/Final manuscript submission and Adviser review surfaces only as required to establish exact title authority.

The additive schema migration is now expected because the live audit confirmed a missing authority field. The new column remains nullable for legacy compatibility, but new Proposal/Final submissions must fail validation when title is blank/missing.

#### PREDEF-1B0 acceptance evidence (2026-10-24; accepted for continuation)

- Migration `20261024120000_manuscript_version_title` adds nullable
  `ThesisDocument.manuscriptTitle` / `manuscript_title` as `TEXT`, without a
  default or backfill. Apply it before deploying the updated backend.
- Each new Proposal/Final upload requires a string title, trimmed at the edges,
  with a 2,000 UTF-16-code-unit maximum. Academic capitalization and internal
  content remain intact; missing/blank/non-string/oversized values fail server
  validation. There is no silent truncation or title inference.
- The existing shared manuscript transaction inserts the title with the exact
  file/storage metadata and rebinds the review atomically. Replacement versions
  keep separate title/file snapshots; earlier rows only lose `isCurrent`.
- Student submission panels capture title + file together. Adviser task details,
  review queues, and My Advisees review cards show the bound title and filename.
  Review DTO `officialTitle` is retained only as a compatibility alias of the
  exact bound manuscript title; historical Title Defense lookups are removed
  from these review projections. Legacy null titles remain readable and display
  as not recorded.
- Longitudinal `workingTitle` selection is deferred. Exact title authority is
  available on the manuscript/review DTO, with no second current-title policy.
- Prisma validate/generate, backend build, frontend TypeScript/scoped ESLint/
  production build, and diff checks passed. Related backend regressions:
  **775 passed / 5 environment-conditional skips across 59 files**. Frontend
  manuscript-title + accepted Adviser verifiers: **86 passed**.
- Prisma's schema diff matches the additive migration. The exact SQL was
  rehearsed on a session-only MariaDB temporary table, verifying legacy nulls,
  independent Proposal/Final title/file history, and transaction rollback.
  Permanent local tables were not migrated; migration status lists this package
  as the sole pending migration.
- Browser/manual role-flow QA: **NOT EXECUTED**. Hosted CI: **NOT EXECUTED**.
  The project owner intentionally deferred browser/manual QA to the larger PREDEF workflow. Independent remote source review found no blocker or scope violation, so PREDEF-1B0 is accepted for continuation without representing unexecuted QA as passed.
- The accepted GS-017 renderer, certification actions/guardrail, GS-017 routes,
  access policy, and PREDEF-2 behavior are unchanged. PREDEF-1B/1C and PREDEF-2
  have not been started.

### PREDEF-1B / PREDEF-1C — Codex: workflow and portal integration

After PREDEF-1B0 acceptance, Codex may continue with the bounded live integration package:

- map the exact issued Proposal/Final `AdviserCertification` into the accepted renderer contract;
- resolve `manuscriptTitle` only through the exact `AdviserCertification.reviewedDocumentId -> ThesisDocument` relation; fail closed if exact title metadata is unavailable rather than using historical Title Defense wording or a latest/current title;
- enforce exact `reviewedDocumentId` authority and no-latest fallback;
- add the Adviser exact-manuscript confirmation guardrail before `Certify & Sign`;
- implement bounded GS-017 PDF routes/service authorization for issuer Adviser, owning Student, and Admin;
- surface the issued certification in Adviser, Student, and Admin contexts;
- preserve the accepted record-mode/no-additional-upload wording;
- add service/route/authorization/frontend tests without modifying the accepted renderer design unless a verified integration defect requires it.

PREDEF-1B/1C must stop at the documented PREDEF-1 scope. PREDEF-2 begins only after PREDEF-1 integration is independently reviewed and accepted.

#### PREDEF-1B/1C acceptance evidence (2026-10-24; accepted for continuation)

- Existing `OfficialDefenseDocumentService` now generates GS-017 through the
  frozen renderer. `AdviserCertificationRecordService` loads only the exact
  certification, issuer, owning Student/program, and `reviewedDocument` relation.
  Issued state, same-thesis/type/stage/document binding, exact nonblank title,
  issuer identity, server `signedAt`, and usable signature evidence are required.
  Dates use the existing Asia/Manila instant formatter. No latest/current title
  or manuscript fallback, schema migration, or generated-document persistence.
- Authenticated `GET /thesis/adviser-certifications` returns explicit safe
  issued-record metadata, with optional thesis/stage filters. Student ownership
  and issuer-Adviser filters are applied in the query; Admin requires a thesis
  filter. `GET /thesis/adviser-certifications/:certificationId/pdf` independently
  proves owning Student, issuer Adviser, or Admin authority. Unrelated identities
  receive the same not-found response; committee assignment alone grants none.
- The accepted official signature decoder was extracted unchanged for reuse,
  retaining its evaluator API export. New Adviser signing uses the existing
  Type/Draw `ESignaturePad` to persist PNG image evidence. Adviser validation
  additionally checks usable PNG/JPEG bytes and bounded image dimensions.
  Missing titles or invalid evidence cannot produce a new issued certification.
- Legacy issued typed-string signatures are not converted into invented image
  evidence. Their records remain readable but official GS-017 printing is
  unavailable. Exact legacy null titles also remain readable/unavailable with
  no backfill or inference. This package does not re-sign or mutate issued rows.
- Confirmation displays the Student, stage, exact title/file, an exact-document
  View Manuscript action, and required acknowledgement. Acknowledgement belongs
  to the displayed document ID; refreshed/replaced documents cannot reuse it.
  Existing active-Adviser checks, expected-document CAS, stage gates, and issued
  write-once protections remain intact.
- Issued records are separate from workload: My Advisees review records/detail,
  Student Proposal/Final issued-status panels, and Admin application review use
  shared View GS-017 / Download Copy controls and no-extra-submission wording.
  Record caches and preview state are isolated by authenticated identity/context.
  Inline previews use an authenticated, non-caching bounded proxy. PDF/download
  helpers and responses are reused; no raw signature/storage fields are exposed.
- Focused backend verification: **129 passed across 5 files**. Proportional
  Adviser/document/application regressions: **606 passed across 32 files**.
  Frontend verifiers: **96 passed together**, plus the added session-isolation
  check (**11/11** in the final focused GS-017 verifier). Backend build, Prisma
  validation, frontend TypeScript/scoped lint/production build, and diff checks
  passed. No full repository suite was required or run.
- Browser/manual QA: **NOT EXECUTED — intentionally deferred to integrated
  PREDEF QA.** Hosted CI: **NOT EXECUTED**. Independent remote source review
  verified the exact issued binding, authorization matrix, signature/date mapping,
  document-bound acknowledgement, safe metadata exposure, and PREDEF-1 scope
  boundary with no blocker found. PREDEF-1B/1C is accepted for continuation
  without representing unexecuted QA as passed. PREDEF-2, PREDEF-3, and
  DEF-CORR-1 were not started.

### Handoff rule

The Codex report for PREDEF-1A must include the branch/start/end HEAD, changed files, renderer tests, sample-generation command/results, and paths/names of generated Proposal/Final samples. The DeepSeek handoff must reference the accepted renderer commit/HEAD and treat that artifact as the visual baseline rather than rebuilding GS-017 independently.

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
- exact Thesis/Dissertation Title stored on the reviewed manuscript version;
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

### PREDEF-2 acceptance evidence — 2026-10-24

- Verified starting local/remote HEAD: `37bf309e60d71d521abb158936000d5a705c976a` on the existing `feat/pre-defense-document-integrity`; clean starting tree.
- Admin Scheduled Defense embeds a read-only Defense Submission section backed by `GET /thesis/defense/schedules/:scheduleId/submission`. The existing schedule-detail and Admin official-document routes retain their Admin-only middleware and service guards.
- `ScheduledDefenseSubmissionService` reads only the exact schedule's `manuscriptDocumentId` relation and validates same-thesis/type/stage through the accepted binding helper. Invalid/missing bindings produce visible integrity errors; there is no current/newest manuscript query. Title uses its bound package without GS-017. Proposal/Final reuse accepted safe GS-017 metadata and require exactly one issued certification matching thesis, stage, and bound manuscript; mismatches/ambiguity yield no selected record. Exact legacy records may remain readable with printing disabled by the accepted GS-017 validation.
- COR/receipt reuse the stage evidence repository and history currentness rules (`isCurrent !== false`, historical replacements retained; multiple current rows fail closed). Wrong-stage rows are excluded. These are stage-current supporting records, **not an immutable snapshot of evidence used on the scheduling date**. No schema change is required or introduced.
- Student `GET /thesis/student/defense/:scheduleId/application` and `/application/pdf` independently require Student role and prove `schedule → thesis → Student.userId` ownership before mapping. Missing and non-owned schedules return the same safe 404. The Admin source remains explicitly Admin-only; a private exact-schedule loader, existing mapper, and existing GS-006/GS-007 renderer are shared. Availability runs the same mapper and renderer as download; incomplete/ambiguous committee data or renderer overflow cannot produce an official copy.
- Existing Student scheduled status embeds View Official Application / Download Copy after availability succeeds. Its authenticated inline proxy forwards the exact schedule ID and does not cache PDFs. Query/preview state is scoped by authenticated identity and schedule. Guidance: “This is your official Defense Application record. No additional upload or submission is required unless instructed by the Graduate School.”
- Existing schedule ID supplies attempt identity. No new attempt numbering, upload slot, print/fill/upload loop, committee correction, manuscript replacement/rebinding, or renderer redesign. PREDEF-3 and DEF-CORR-1 were not started.
- Independent remote source review verified the exact `DefenseSchedule.manuscriptDocumentId` authority, Title/Proposal/Final type-stage validation, exact GS-017 match, stage-scoped evidence currentness/ambiguity handling, Student ownership proof, Admin-only route preservation, shared exact-schedule mapper/renderer, safe metadata, and read-only UI boundary. No blocker or PREDEF-3/DEF-CORR-1 scope leak was found.
- Browser/manual QA: **NOT EXECUTED — intentionally deferred to integrated PREDEF QA.** Hosted CI: **NOT EXECUTED**. These are not represented as passed.
- Focused backend: **103 passed / 3 files**, including actual authenticated HTTP routes, cross-Student denial, exact-source/render parity for all three stages, and byte-identical real Admin/Student PDFs for Master's and Doctoral fixtures. Focused frontend: **10 passed**.
- Proportional regressions: **515 backend tests / 26 files**, covering scheduling, document authorization/history, official forms, certification/review, and Student journey; **92 frontend checks / 7 files**, covering scheduling, accepted title/certification integration, PDF retrieval, history, and viewer behavior. No whole-repository suite was run.
- Backend build, frontend TypeScript/build, scoped frontend lint, Prisma validation, and `git diff --check` passed. Existing Vite CommonJS/config-loader, Next.js middleware convention, and Node module registration deprecation warnings remain outside this package. Hosted CI: not executed/verified by this implementation run; local verification is not hosted CI evidence.
- Browser/manual QA: NOT EXECUTED — intentionally deferred to integrated PREDEF QA.
- Implementation remains subject to independent review and project-owner acceptance; this evidence does not mark PREDEF-2 accepted.

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

- `backend/prisma/schema.prisma` — add the now-confirmed legacy-compatible exact manuscript-title metadata field on `ThesisDocument`; an additive migration is expected for PREDEF-1B0.
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

1. Verify the current `feat/pre-defense-document-integrity` branch/head/clean state and read the canonical docs plus this plan.
2. **PREDEF-1A is accepted:** preserve the existing GS-017 renderer/layout/typed contract as the frozen visual baseline.
3. **Codex / PREDEF-1B0:** audit Proposal/Final manuscript submission, `ThesisDocument` versioning, and Adviser review DTOs/UI for the missing exact manuscript-title authority.
4. Add the legacy-compatible `ThesisDocument` manuscript-title field + additive migration; require non-blank title for new Proposal/Final manuscript submissions.
5. Persist title with each exact manuscript version; surface exact title + exact file in Adviser review; prove replacement manuscripts preserve independent title/file history.
6. Run PREDEF-1B0 focused backend/frontend/migration/build verification and independent remote review. Stop for project-owner acceptance.
7. **Codex / PREDEF-1B/1C:** map the exact issued `AdviserCertification.reviewedDocumentId` document—including its exact manuscript title—into the accepted GS-017 renderer.
8. Implement the Adviser exact-title/exact-manuscript confirmation guardrail and bounded Adviser/Student/Admin GS-017 access/record visibility.
9. Run PREDEF-1 focused authorization/regression checks and independently review the remote diff before marking PREDEF-1 accepted.
10. **DeepSeek / PREDEF-2:** implement Admin Defense Application/Scheduled Defense Submission Context.
11. Implement owning-Student read-only access to completed GS-006/GS-007 with no-additional-action guidance.
12. Run PREDEF-2 focused + proportional regression checks and required browser/manual QA.
13. Independently review the final remote diff and update checklist/source-of-truth implementation status only after project-owner acceptance.

Suggested bounded commit progression:

- Codex PREDEF-1A: `feat(documents): add adviser certification form` — accepted baseline
- Codex PREDEF-1B0: `feat(thesis): bind titles to manuscript versions`
- Codex PREDEF-1B/1C: `feat(adviser): integrate adviser certification record`
- DeepSeek PREDEF-2: `feat(defense): surface pre-defense document context`

Codex may proceed through the accepted PREDEF-1A and PREDEF-1B0 baselines into the separately bounded PREDEF-1B/1C GS-017 integration package, but must stop after PREDEF-1B/1C verification/owner review. Do not auto-continue into PREDEF-2. Later agents may split/merge commits when technically necessary, but the review report must preserve PREDEF-1A, PREDEF-1B0, PREDEF-1B/1C, and PREDEF-2 scope boundaries.

## 10. Acceptance gate

PREDEF-1 is accepted only when the exact-document guardrail, GS-017 generation, authorization matrix, and required visual QA are complete.

PREDEF-2 is accepted only when Admin retains exact scheduled submission context and the owning Student can view the completed Defense Application record without gaining edit authority or being instructed to recreate a paper workflow.

Do not begin DEF-CORR-1 automatically after this branch. Merge/accept PREDEF first, return to `main`, then create the separate committee-correction branch if still approved.
