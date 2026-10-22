# Official Defense Document Forms — Next Initiative

**System:** EARIST Graduate School Information System (GS-IS)  
**Repository:** `MuelTech/graduate-system`  
**Active initiative branch:** `feat/official-defense-document-forms`  
**Branch base:** `main` @ `d8ac8479fd34226dc837cba9048a1db5a1f72776`  
**Documentation checkpoint:** `81c9d29b5cb6f7b6b2c7d5e454850d438eeb491f`  
**Status:** TEMPLATE-1 ACCEPTED / PUBLISHED — TEMPLATE-2 AWAITING VISUAL REVIEW
**Last updated:** 2026-10-22

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

Later GS-IS integration must render from the persisted Oral Examination Summary snapshot and exact finalized evaluator identities/values.

Do not infer or fabricate GS-011 signatures from other signature records.

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

### TEMPLATE-2 — Oral Examination Summary Sheet — AWAITING VISUAL REVIEW

Implemented from verified local/remote HEAD `84002a713e3c9a0342e6414e662793fcfa0308ed`
after viewing the local GS-011 reference. The pure renderer under
`backend/src/documents/official-defense/oral-exam-summary/` reuses accepted shared helpers unchanged.
It preserves six examiner rows, one Chairman/five Member lines, Adviser/Dean areas, and the exact
`EARIST-QSF-GS-011 Rev. 01 (06.20.25)` footer. Values and signatory names are explicit;
no averages, verdicts, committee identities, or signature evidence are inferred.

Blank, filled (`Course: MAEd`), and long-value PDF/PNG samples were generated under ignored
`backend/.tmp/official-form-samples/`. Two visual-review passes refined table-cell alignment
and long-name clearance. Eight TEMPLATE-2 tests, nine TEMPLATE-1 tests, and the backend build pass.
TEMPLATE-1 and shared helper files remain unchanged; no new assets/dependencies or system integration.
See the TEMPLATE-2 README and plan checkpoint for commands, QA details, and fidelity limits.

**Project-owner visual acceptance is pending. Do not start TEMPLATE-3.**

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

Proceed with the next bounded static-template package:

**TEMPLATE-2 — EARIST-QSF-GS-011 Rev. 01 (06.20.25) — Oral Examination Summary Sheet**

Inputs:

- Oral Examination Criteria institutional reference photo;
- clean EARIST institutional logo;
- clean Graduate School logo;
- this initiative overview;
- detailed plan:
  `docs/superpowers/plans/2026-10-22-official-defense-document-forms.md`.

TEMPLATE-2 inputs:

- GS-011 institutional reference photo;
- accepted production logo assets from `backend/assets/official-forms/`;
- accepted shared PDF helpers from TEMPLATE-1 where they genuinely apply;
- this initiative overview;
- detailed plan:
  `docs/superpowers/plans/2026-10-22-official-defense-document-forms.md`.

Expected TEMPLATE-2 output:

- clean static A4 GS-011 template;
- explicit typed render input;
- dummy-data sample PDF;
- render-and-compare visual QA evidence;
- no GS-IS data/API/UI integration yet.

TEMPLATE-1 acceptance notes remain in `backend/src/documents/official-defense/oral-exam-criteria/README.md`.

### TEMPLATE-2 footer refinement requested by project owner

The visible `EARIST-QSF-GS-011 Rev. 01 (06.20.25)` footer is omitted from generated
TEMPLATE-2 PDFs per the latest project-owner instruction. This supersedes the earlier
footer reproduction requirement for the current output; the reference form identity remains
unchanged. Field/table/signatory geometry is retained. Visual acceptance is still pending.
