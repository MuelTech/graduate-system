# Official Defense Document Forms — Next Initiative

**System:** EARIST Graduate School Information System (GS-IS)  
**Repository:** `MuelTech/graduate-system`  
**Initiative state:** merged to `main` via PR #37  
**Branch base:** `main` @ `d8ac8479fd34226dc837cba9048a1db5a1f72776`  
**Documentation checkpoint:** `81c9d29b5cb6f7b6b2c7d5e454850d438eeb491f`  
**Status:** STATIC FORM PHASE CLOSED — FORM-INT-0 ACCEPTED — FORM-INT-PRE1 ACCEPTED — FORM-INT-1 ACCEPTED — FORM-INT-2 + TITLE LAYOUT FIX-1 ACCEPTED — FORM-INT-3 ACCEPTED — FORM-INT-4 FIX-1/FIX-2/FIX-3/FIX-4 ACCEPTED — PAYMENT/O.R. POLICY PENDING
**Last updated:** 2026-10-24

## Purpose

This file is the high-level continuation entry point for the Official Defense Document Forms initiative.

It records **what is active now**, what is intentionally deferred, which institutional references are available, and how template reconstruction and later GS-IS integration are split between agents.

For detailed package sequencing and technical boundaries, see:

`docs/superpowers/plans/2026-10-22-official-defense-document-forms.md`

## Previous initiatives already closed

The following initiatives are complete and must not be reopened as part of this work:

- Collaborative Defense Workspace — COMPLETE / CLOSED / merged;
- Adviser Workflow / My Advisees ADV-0 through ADV-8 — COMPLETE / CLOSED / merged.

The official document initiative is a **rendering/output layer over existing authoritative records**. It must not create a second defense workflow or reinterpret academic state.

## Current bounded scope

The first implementation phase covers three official form families.

### 1. Oral Examination Criteria / Individual Evaluation

Institutional reference photo supplied by the project owner on 2026-10-22.

Confirmed visible structure:

- EARIST institutional header with two logos;
- Candidate;
- Course;
- Date;
- Group I — five criteria;
- Group II — four criteria;
- fixed six-level matrix:
  - 1.00 — E — Excellent
  - 1.25 — HS — Highly Satisfactory
  - 1.50 — VS — Very Satisfactory
  - 1.75 — S — Satisfactory
  - 2.00 — BS — Barely Satisfactory
  - 2.50 — F — Fail
- Group I Average;
- Group II Average;
- Legend;
- Recommendations;
- Summary of Evaluation;
- Rating;
- Remarks;
- signature over printed name of Panelist.

The supplied reference does **not** establish an official form code/revision. Do not invent one.

Later GS-IS integration must use the authoritative evaluator record and official snapshot for the exact defense attempt.

### 2. Oral Examination Summary Sheet

Confirmed current form:

**EARIST-QSF-GS-011 Rev. 01 (06.20.25)**

Institutional reference photo supplied by the project owner on 2026-10-22.

Confirmed visible structure:

- EARIST institutional header with two logos;
- Graduate School;
- Oral Examination Summary Sheet;
- Candidate;
- Course;
- Date;
- Student No.;
- Panel of Examiners;
- Rating for Group A;
- Rating for Group B;
- Average;
- Submitted by:
  - Chairman;
  - Member rows;
- Concurred In:
  - Thesis/Dissertation Adviser;
- Attested:
  - Dean, Graduate School;
- official footer code and revision.

The accepted FORM-INT-2 GS-IS integration renders from the persisted Oral Examination Summary snapshot and exact finalized evaluator identities/values.

GS-011 Adviser authority is stage-aware and exact-schedule-bound, but project-owner QA identified one remaining Title-layout defect:

- Title Defense has no Adviser assignment;
- therefore Title GS-011 must omit the entire Adviser concurrence block: `Concurred In:`, the Adviser name/signature rule, and the `Thesis/Dissertation Adviser` label;
- the Dean `Attested` block remains;
- Proposal and Final keep the Adviser concurrence block and require exactly one `ADVISER` `PanelAssignment` on the exact `DefenseSchedule`;
- a missing or ambiguous Proposal/Final Adviser seat fails closed;
- the renderer/service must never substitute the Student's current/live Adviser or an Adviser from another defense attempt.

Current source already maps Title to no Adviser value and binds Proposal/Final to the exact schedule Adviser. The remaining work is a bounded stage-aware renderer/layout correction for Title only.

Do not infer or fabricate GS-011 signatures from other signature records. Dean/attestation remains blank until an authoritative institutional office-holder source is implemented.

### 3. Defense Application

Confirmed current forms:

- **EARIST-QSF-GS-006 Rev. 01 (06.20.25)** — Master's Program;
- **EARIST-QSF-GS-007 Rev. 01 (06.20.25)** — Doctoral Program.

Institutional reference photos supplied by the project owner on 2026-10-22.

Both are one document family with program-specific committee layouts.

Confirmed visible structure includes:

- institutional header with two logos;
- Application for Title / Proposal / Final Defense;
- student identity/application fields;
- payment and O.R. fields;
- Date of Application;
- defense date/time/link;
- Examination Committee;
- Prepared by — Dean, Graduate School;
- Recommending Approval — Vice President for Academic Affairs;
- Approved — President;
- program-specific footer code/revision.

GS-006 and GS-007 should share a renderer where practical, with the program-specific layout treated as a controlled variant.

## Reference assets now available

The project owner supplied:

- current institutional reference photos for:
  - Oral Examination Criteria;
  - GS-011 Oral Examination Summary Sheet;
  - GS-006 Master's Defense Application;
  - GS-007 Doctoral Defense Application;
- one clean EARIST institutional logo asset;
- one clean Graduate School logo asset.

The two clean logos are versioned in `backend/assets/official-forms/` as production assets. Reference photographs remain local-only inputs under `backend/.temp/official-form-inputs/` and must not be committed.

The photographed sheets are visual references only. They must not be used as production PDF backgrounds because they contain scan/photograph artifacts, perspective distortion, shadows, and page-hole marks.

The target is a clean digital reconstruction using the clean logos plus drawn text, tables, lines, and signature areas.

## Agent responsibility split

### Codex — static template reconstruction

Codex owns the first template phase.

Order:

1. Oral Examination Criteria;
2. GS-011 Oral Examination Summary Sheet;
3. GS-006 / GS-007 Defense Application.

Codex should:

- reconstruct each form as a clean A4 digital layout;
- use the supplied clean logo assets;
- keep all student, committee, score, date, payment, and signature values as explicit dynamic placeholders/fields;
- generate sample PDFs using dummy data only;
- render generated PDFs back to images;
- compare visually with the institutional references;
- iterate on geometry, spacing, typography, tables, and logo placement;
- stop after project-owner visual acceptance.

Codex must **not** add database/API/business-rule integration during the static-template package unless separately approved.

### DeepSeek — GS-IS integration after visual approval

DeepSeek owns the later system integration packages after a static template is approved.

Expected responsibilities:

- authoritative data mapping;
- backend renderer integration;
- Admin authorization;
- secure generation/download endpoints;
- server-side signature embedding where already authorized;
- Admin Download / Print activation;
- unit/contract/security tests;
- persistence/provenance work only if approved for that package.

## Current implementation checkpoint

**TEMPLATE-1 — Oral Examination Criteria — ACCEPTED**

Project-owner visual acceptance was recorded on 2026-10-22 after the spacing, signature-block, typography, and sample-data refinements. The accepted remote implementation ends at:

`9e76390623739dbb9ec0e609baf6c78880d6edce`

The implementation was published through two bounded commits:

- `d06e7967f2212bd86a2a869e4ed1dcfd90c498db` — `feat(documents): add oral examination criteria renderer`
- `9e76390623739dbb9ec0e609baf6c78880d6edce` — `fix(documents): refine oral examination criteria layout`

Why TEMPLATE-1 was first:

Why first:

- it is sufficiently complex to validate the rendering approach;
- it exercises the shared institutional header;
- it includes two rating tables;
- it includes legend, recommendations, summary, and signature placement;
- lessons from it can be reused for GS-011 and GS-006/007.

The first package remains **static-template only**. The typed renderer, minimal shared helpers, three dummy-data samples, and focused tests are implemented. It has no system-data/API/UI/workflow integration. See `backend/src/documents/official-defense/oral-exam-criteria/README.md` for the contract, generation commands, visual QA iterations, and fidelity limits.

TEMPLATE-1 is accepted as the static renderer baseline. TEMPLATE-2 is now authorized as the next bounded static-template package. GS-IS integration remains deferred until the approved template sequence reaches its integration phase.

### TEMPLATE-2 — Oral Examination Summary Sheet — ACCEPTED / PUBLISHED

Implemented from verified local/remote HEAD `84002a713e3c9a0342e6414e662793fcfa0308ed`
after viewing the local GS-011 reference. The pure renderer under
`backend/src/documents/official-defense/oral-exam-summary/` reuses accepted shared helpers unchanged.
It preserves six examiner rows, one Chairman/five Member lines, and Adviser/Dean areas. The reference remains
**EARIST-QSF-GS-011 Rev. 01 (06.20.25)**, while the visible footer is intentionally omitted from generated PDFs per project-owner instruction. Values and signatory names are explicit;
no averages, verdicts, committee identities, or signature evidence are inferred.

Blank, filled (`Course: MAEd`), and long-value PDF/PNG samples were generated under ignored
`backend/.tmp/official-form-samples/`. Two visual-review passes refined table-cell alignment
and long-name clearance. Eight TEMPLATE-2 tests, nine TEMPLATE-1 tests, and the backend build pass.
TEMPLATE-1 and shared helper files remain unchanged; no new assets/dependencies or system integration.
See the TEMPLATE-2 README and plan checkpoint for commands, QA details, and fidelity limits.

Project-owner visual acceptance was granted on 2026-10-22. TEMPLATE-2 was published at `5ffd5d5e03524ce12f0f65b0629e97d66e264b1d` and is closed as the accepted GS-011 static renderer baseline. TEMPLATE-3 is now authorized as the next bounded static-template package.

### TEMPLATE-3 — Defense Application — ACCEPTED / PUBLISHED

Starting local and remote HEAD were verified as `8ddb390980cd8537c30014c4e90c8dc0cb2d794d`
on `feat/official-defense-document-forms` with a clean working tree. Both actual local
reference photographs were visually inspected before coding.

The pure renderer under `backend/src/documents/official-defense/defense-application/`
implements one controlled Master's/Doctoral family. The originally reconstructed committee rows
followed the supplied reference photographs. A later project-owner clarification supersedes those
row-capacity assumptions for generated output: the GS-IS `CHAIRMAN` remains Chairman in the system
but is displayed in a printed row labelled `Panelist` because GS-006/GS-007 have no dedicated
Chairman label. Printed labels do not redefine system roles or evaluator authority.

Both confirmed GS-006/GS-007 code/revision footers remain visible. TEMPLATE-2's accepted
GS-011 footer omission is unchanged and is not applied to this family.
Payment/O.R., schedule, committee, and approval names are explicit display values.
Pre-printed 300/900 fee text is literal; no payment, approval, signature, identity, or
workflow fact is fetched, calculated, or inferred.

Accepted A4/rules, measured text, image containment, and masthead helpers are reused unchanged.
Three visual QA passes inspected all six blank/filled/long-value PDF/PNG variants.
Fifteen TEMPLATE-3 tests plus eight TEMPLATE-2/nine TEMPLATE-1 tests (32 total), backend
TypeScript build, and diff checks pass. Accepted files and retained samples remain unchanged.

Samples stay ignored under `backend/.tmp/official-form-samples/`.
See the TEMPLATE-3 README for all six PDF/PNG paths, generation commands, variant differences,
overflow behavior, policy boundaries, and fidelity limits.

Project-owner visual acceptance was granted on 2026-10-22. TEMPLATE-3 was published at `959233de1d9be7209a3792702fb392056b605613` and later merged to `main` via PR #37 at `552d8fa9c1a584a17aca1492fc6ee32a5a9b537c`.

**FORM-DX-1 is COMPLETE / PASS** at `299ca18a89e8fae54785326935fce966995302d8`. A scripts-local TypeScript project now covers all three official-form QA generators without changing production `dist` output; all 32 renderer tests, backend build, sample generation, and PDF hash regression checks passed.

After merge, the project owner clarified that the generated Defense Application must follow the existing Admin/backend `DefenseCommitteePolicy`, not a fixed committee count copied from the reference photograph. **TEMPLATE-3 FIX-1 is ACCEPTED / MERGED**: implementation `03cbc80c92b7a9cf538b82b96b920cb373f81a94` was independently reviewed and merged to `main` via PR #38 at `48e7e02f546de894d9591b0e4a271b9629f1bdbd`. Printed `Panelist` rows now represent the authoritative Chairman plus the stage-specific Panelist quota while keeping `CHAIRMAN` unchanged in GS-IS.

The static form phase is closed. **FORM-INT-0**, **FORM-INT-PRE1**, and **FORM-INT-1 — Individual Oral Examination Criteria PDF integration** are accepted. **FORM-INT-2 — GS-011 Oral Examination Summary PDF integration** at `d16f2819df176a470e68bfd1301873fbee9ea119` has accepted exact snapshot and exact-schedule Adviser authority, but project-owner QA identified one remaining Title-only presentation defect: the renderer still draws the Adviser concurrence block with a blank value. **FORM-INT-2 FIX-1** must remove that entire block for Title Defense while preserving Proposal/Final behavior.


## GS-011 Title Adviser-block correction — 2026-10-24

Project-owner visual QA clarified that a blank Adviser value is not sufficient for Title Defense.

Canonical target behavior:

- **Title Defense:** do not render `Concurred In:`, the Adviser name/signature rule, or the `Thesis/Dissertation Adviser` label. Keep the Dean `Attested` area and all other accepted GS-011 content.
- **Proposal Defense / Final Defense:** retain the Adviser concurrence block and populate it from exactly one `ADVISER` `PanelAssignment` on the exact defense schedule.
- Never use the Student's current/live Adviser or another attempt as fallback.
- Missing or ambiguous Proposal/Final Adviser assignment remains a fail-closed condition.

This is a renderer/layout correction only. It must not alter Oral Examination Summary snapshot authority, evaluator rows, scoring, signatures, authorization, routes, or defense workflow semantics.

**Implementation state (2026-10-24):** FIX-1 is implemented at `a5e68a07b7d8c0403cb2b4f34456e031ce798148`. `OralExamSummaryRenderInput` now carries an explicit `stage` discriminator; Title omits the entire Adviser concurrence block and places the Dean `Attested:` block in the freed lower-page region; Proposal/Final keep the Adviser block and exact-schedule Adviser. The mapping still fails closed for missing/ambiguous Proposal/Final Adviser seats and never falls back to a current/live Adviser. Focused GS-011 tests (49/49), broader official-document regressions (262/262), `forms:check`, backend build, and raster inspection of Title/Proposal/Final passed. Project-owner visual acceptance was granted on 2026-10-24 after reviewing the corrected Title GS-011 output.

## Defense Application field-authority decisions — 2026-10-23

Project-owner manual QA found that the generated GS-006 / GS-007 Defense Application still leaves several application-identity fields blank even though some of them already have authoritative GS-IS sources.

The following mappings are now canonical for future integration work:

| Printed field | Authoritative source / rule |
| --- | --- |
| Cellphone No. | Auto-fill from the exact Student record's `Student.cellphone`. |
| Email (Personal Gmail Only) | Auto-fill from the exact Student user's `User.email`. Applicant registration is already backend-enforced as `@gmail.com`; development-only `@earist.edu.ph` panelist accounts are unrelated to this student field. |
| Date and Time | Server-owned timestamp of the latest successful Defense Application submission or resubmission for the exact defense stage. |
| Date of Application | Date portion of the same exact latest successful submission/resubmission timestamp. |
| Amount Paid | **Client confirmation pending.** Do not infer from the printed fee table or receipt presence. |
| O.R. No. | **Client confirmation pending.** Do not infer from filename, upload metadata, or receipt presence. |

Submission-time semantics are now explicit:

- initial successful filing sets the stage application's submission timestamp;
- if Admin rejects the application and the Student later corrects/reuploads and successfully resubmits, the latest successful resubmission timestamp becomes authoritative for the printed current application;
- `Date and Time` and `Date of Application` are two presentations of that same authoritative event;
- generic `ThesisRecord.createdAt` is not sufficient for Proposal/Final because the same ThesisRecord is reused across Title → Proposal → Final;
- generic `ThesisRecord.updatedAt` must not be used because unrelated workflow changes can update it;
- implementation should therefore use an explicit server-owned, stage-aware application submission timestamp rather than infer from mutable lifecycle timestamps.

Paper-only instruction cleanup:

- remove the printed `Note: Please write legibly` from generated GS-006 / GS-007 PDFs because the application is system-generated rather than handwritten.

FORM-INT-4 FIX-4 now implements the resolved automatic mappings at `d931159d705b6f7466f2732e2162ce10e5a0dd45`.

Accepted persistence/mapping behavior:

- nullable stage-specific timestamps on `ThesisRecord`: Title, Proposal, and Final;
- no historical backfill or default timestamp;
- server-owned timestamp on successful initial filing;
- latest successful resubmission replaces only that exact stage's timestamp;
- exact schedule `defenseType` selects the stage timestamp when generating the PDF;
- existing legacy records with null timestamps intentionally print blank filing date/time fields rather than fabricated history;
- Student cellphone and Student user email are mapped from the exact schedule-bound student;
- application date/time is formatted deterministically in Asia/Manila;
- the paper-only `Note: Please write legibly` is removed.

Independent remote diff/source review confirmed the implementation is bounded and the legacy-null behavior shown during owner QA is expected, not a detection failure.

FIX-4 is accepted. The overall FORM-INT-4 initiative remains open only for the unresolved `Amount Paid` / `O.R. No.` client policy.

## Explicitly deferred

### GS Form No. 22 / Committee Report / Rapporteur Report

This renderer is deferred until the first three form families are complete and accepted.

Reason:

- report body is dynamic;
- output may be multi-page;
- pagination and continuation-page rules are required;
- signatures bind to the exact frozen report hash/version;
- Prepared by and Dean approval areas need separate handling.

The existing RAP lifecycle remains authoritative and unchanged.

Also deferred:

- Defense Packet / bundled full-record generator;
- generic Admin-managed template platform;
- template upload/version-management UI;
- automatic Dean signature insertion;
- new generic signature lifecycle;
- new scoring or verdict rules;
- whole-page browser print as a substitute for official PDF generation.

## Rendering direction

The current backend already includes `pdf-lib`.

Initial direction:

```text
authoritative GS-IS record
        ↓
document-specific render DTO
        ↓
approved static PDF renderer/template
        ↓
server-generated PDF
        ↓
authenticated Download / Print
```

Do not introduce Chromium/Puppeteer before a real `pdf-lib` prototype proves that exact fidelity cannot be achieved reasonably.

### Repository module boundary

Use a dedicated rendering module rather than extending extraction, storage, or a legacy controller:

```text
backend/src/
├── extraction/            ← uploaded document → structured information
├── storage/               ← private file persistence / managed uploads
├── documents/
│   └── official-defense/  ← structured information → official PDF
└── services/
    └── official-defense-document.service.ts
                            ← later orchestration/integration
```

The initial renderer structure should grow incrementally:

```text
backend/src/documents/official-defense/
├── shared/
│   ├── pdf-layout.ts
│   ├── pdf-text.ts
│   ├── pdf-table.ts
│   └── institutional-header.ts
├── oral-exam-criteria/
│   ├── oral-exam-criteria.types.ts
│   └── oral-exam-criteria.renderer.ts
├── oral-exam-summary/
│   ├── oral-exam-summary.types.ts
│   └── oral-exam-summary.renderer.ts
├── defense-application/
│   ├── defense-application.types.ts
│   └── defense-application.renderer.ts
└── index.ts
```

For TEMPLATE-1, create only the form-specific renderer and the minimum genuinely reusable shared primitives. Do not pre-build a generic form engine, template registry, document factory, generated-document manager, or Admin template-management framework.

Renderers must remain independent of Prisma, repositories, Express requests/responses, and authorization. They receive an explicit typed render input and return PDF bytes. Later integration maps authoritative domain records into those render inputs.

Static binary assets should live outside TypeScript source, for example:

`backend/assets/official-forms/`

The exact asset filenames may be finalized when the supplied clean logos are added.

### Existing PDF code is not the architectural precedent

`backend/src/controllers/waiver.controller.ts` contains an older one-off `pdf-lib` PDF generator. It was independently created and is **not** the architectural model for Official Defense Forms.

Treat only the installed `pdf-lib` dependency as reusable evidence.

Do not copy from the waiver implementation:

- controller-level PDF drawing;
- mixed data fetching + PDF layout + HTTP response concerns;
- its hard-coded page geometry;
- its visual conventions.

Do not refactor or modify the waiver flow as part of this initiative.

The existing `extraction/` modules, PDF.js native text extraction, and the intentionally unavailable OCR fallback retain their current responsibilities. They are document→data infrastructure and are not the generation architecture for these official forms.

## Signature boundary

Raw signature evidence must remain server-side.

Do not expose evaluator or committee raw signature image data through general Admin read models merely to generate a PDF in the browser.

A renderer that embeds authorized digital signatures should load them internally on the server.

No form may automatically reuse a signature created for another document unless institutional policy explicitly authorizes that reuse.

## Existing Admin UI direction

The current Admin Defense Record design already places document actions with their owning sections.

Keep that ownership model.

- Evaluation Results → Individual Evaluation forms;
- Oral Examination Summary → GS-011;
- Defense Application area → GS-006 / GS-007;
- Committee Report → later GS Form No. 22 package.

Do not reintroduce a separate fake Defense Documents inventory.

## Known repository consistency prerequisite

Before document readiness is used as an official completion signal, the stale Title Defense projection in:

`backend/src/services/defense-record-status.rules.ts`

must be reconciled with the newer canonical workflow/runtime, where Title, Proposal, and Final use the evaluator scoring/finalization lifecycle.

This correction must be bounded and must not reopen the defense workflow.

## Non-negotiable policy boundaries

Do not invent:

- Oral Examination Criteria form code/revision;
- missing institutional layouts;
- evaluator/signatory authority;
- Adviser scoring authority;
- GS-011 digital signature rules;
- Dean attestation signatures;
- Dean/VPAA/President signatures on GS-006/007;
- legacy-score conversion;
- score-derived verdicts;
- missing committee members merely to fill printed rows;
- an official title that is not bound to the exact defense attempt.

## Current branch state

The initiative branch started from the handoff-verified `main` baseline:

`d8ac8479fd34226dc837cba9048a1db5a1f72776`

The first branch commit is the detailed implementation-plan checkpoint:

`81c9d29b5cb6f7b6b2c7d5e454850d438eeb491f`

No runtime implementation was included in that commit.

## Next action

Proceed on:

`feat/official-defense-document-integration`

FORM-INT-4 correction chain now includes:

- base UI activation: `02043af2d8b99156046622438eb3635089417465`
- FIX-1 bundled evaluator packet + readable filenames: `53649871ff2690fa8450b2d884ae6497ffab4bb6`
- FIX-2 Individual Evaluation vector check marks: `9d1c9d494706725612685038f9fade913f2df387`
- FIX-3 Defense Application stage vector check + visible form-code/revision removal: `d00cf90f08c952f4981d6bebbf2b7be38cbd697e`
- FIX-4 authoritative applicant fields + stage-aware filing timestamps: `d931159d705b6f7466f2732e2162ce10e5a0dd45`

FIX-4 acceptance notes:

- Title / Proposal / Final filing timestamps are independently persisted and server-owned;
- successful resubmission updates only the exact rejected stage's timestamp;
- historical schedule printing resolves the timestamp by exact `DefenseSchedule.defenseType`, never by current mutable thesis stage;
- legacy records created before the migration keep null timestamps and therefore blank printed filing date/time fields until a new successful submission/resubmission occurs;
- Student cellphone/email mapping is correct; blank/development values reflect fixture data rather than renderer/source failure;
- Amount Paid and O.R. remain intentionally blank pending client confirmation.

Agent-reported FIX-4 verification includes TEMPLATE-3 48/48, official Defense Application service/source 44/44, evaluator bundle 26/26, TEMPLATE-1 11/11, Prisma validation/generation, migration deploy/status, forms check, backend build, diff check, and synthetic raster QA.

Independent remote review confirmed the additive nullable migration, exact-schedule timestamp selection, Student email mapping, blank payment/O.R. mapping, and intentional legacy-null behavior.

**FORM-INT-4 FIX-4 is ACCEPTED / COMPLETE.**

Do not implement Amount Paid / O.R. until the client confirms their authoritative capture/verification policy.

The overall Official Defense Document Forms integration remains open only for that payment/O.R. policy decision. GS Form No. 22 and generated-document persistence/versioning remain deferred.
