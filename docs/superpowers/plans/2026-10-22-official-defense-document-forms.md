# Official Defense Document Forms — Initiative Plan

**System:** EARIST Graduate School Information System (GS-IS)  
**Repository:** `MuelTech/graduate-system`  
**Initiative branch:** `feat/official-defense-document-forms`  
**Branch baseline:** `main` @ `d8ac8479fd34226dc837cba9048a1db5a1f72776`  
**Date:** 2026-10-22  
**Status:** TEMPLATE-1 + TEMPLATE-2 ACCEPTED / PUBLISHED — TEMPLATE-3 AUTHORIZED NEXT

## 1. Purpose

This document records the bounded starting contract for the next thesis/dissertation document-generation initiative.

The Collaborative Defense Workspace and Adviser Workflow initiatives are closed. This initiative must consume the existing authoritative defense records; it must not introduce a second defense state machine, reinterpret academic records, or invent institutional policy.

The initial target is **clean, printable official-form rendering** for three form families already supported by authoritative GS-IS data.

## 2. Approved initial scope

### TEMPLATE-1 — Oral Examination Criteria / Individual Evaluation

Reference evidence supplied by the project owner on 2026-10-22 shows the current EARIST Graduate School form with:

- EARIST institutional header and two logos;
- Candidate, Course, and Date fields;
- Group I with five criteria;
- Group II with four criteria;
- fixed institutional matrix:
  - 1.00 — E — Excellent
  - 1.25 — HS — Highly Satisfactory
  - 1.50 — VS — Very Satisfactory
  - 1.75 — S — Satisfactory
  - 2.00 — BS — Barely Satisfactory
  - 2.50 — F — Fail
- Group I Average;
- Group II Average;
- Recommendations;
- Summary of Evaluation;
- Rating;
- Remarks;
- signature over printed name of Panelist.

The supplied photograph does **not** confirm a form code/revision for this form. Do not invent one.

Authoritative system source for later integration:

- `OralExamScore`;
- `OralExamScore.officialSnapshot`;
- exact `PanelAssignment`;
- stored evaluator signature evidence;
- current scoring version.

Legacy `LEGACY_POINTS_V1` rows must retain their historical meaning. They must not be converted into the institutional matrix without an explicit institutional conversion rule.

### TEMPLATE-2 — Oral Examination Summary Sheet

Confirmed reference:

**EARIST-QSF-GS-011 Rev. 01 (06.20.25)**

Reference evidence supplied by the project owner on 2026-10-22 shows:

- institutional header and two logos;
- Graduate School heading;
- Candidate;
- Course;
- Date;
- Student No.;
- Panel of Examiners table;
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
- footer code `EARIST-QSF-GS-011 Rev. 01 (06.20.25)`.

Authoritative system source for later integration:

- persisted `OralExamSummary`;
- `OralExamSummary.snapshotData`;
- finalized evaluator identities and values from the exact defense attempt.

The renderer must not infer a verdict, Rating, Remarks, Adviser concurrence signature, Chairman/Member GS-011 signature, or Dean attestation signature from unrelated records.

Whether GS-011 sign-off remains wet-signature only or receives a dedicated digital-signature workflow is an institutional policy question and is **not** part of static-template reconstruction.

### TEMPLATE-3 — Defense Application

Confirmed references supplied by the project owner on 2026-10-22:

- **EARIST-QSF-GS-006 Rev. 01 (06.20.25)** — Master's Program;
- **EARIST-QSF-GS-007 Rev. 01 (06.20.25)** — Doctoral Program.

Both forms cover Application for Title / Proposal / Final Defense and include:

- institutional header and two logos;
- student/application identity fields;
- payment / O.R. fields;
- defense date/time/link;
- Examination Committee table;
- Prepared by — Dean, Graduate School;
- Recommending Approval — Vice President for Academic Affairs;
- Approved — President.

GS-006 and GS-007 should be treated as variants of one document family where practical, rather than two unrelated renderers.

The static template must preserve the printed institutional structure. Dynamic population must later use current authoritative GS-IS records and must not invent missing committee members, advisers, approval signatures, payment facts, or approval states.

## 3. Explicitly deferred from this first scope

### GS Form No. 22 / Committee Report / Rapporteur Report

The Committee Report renderer is deliberately deferred until after the first three form families are implemented and accepted.

Reason:

- report content is dynamic and may span multiple pages;
- it requires pagination and continuation-page rules;
- signature evidence is bound to the exact frozen report content/hash/version;
- the final form has separate Prepared by and Dean approval areas;
- the output needs a stronger document-layout/pagination package than the static forms.

Existing `RapReport.frozenContent`, `frozenContentHash`, and `RapReportSignature` remain authoritative. Deferral does not reopen or change the RAP lifecycle.

Also deferred:

- Defense Packet / bundled full-record generator;
- generic Admin-managed form-template platform;
- template upload/version-management UI;
- automatic Dean signature insertion;
- new institutional signature workflows;
- new academic scoring or verdict rules;
- whole-page browser `window.print()` substitutes.

## 4. Template reconstruction strategy

The supplied photographs are **visual references**, not production backgrounds.

The official digital templates should be reconstructed cleanly using:

- project-supplied clean EARIST institutional logo;
- project-supplied clean Graduate School logo;
- drawn text, rules, tables, lines, and signature areas;
- A4 page geometry;
- deterministic PDF output.

Do not embed the photographed paper as the production template because it contains perspective distortion, scan noise, shadows, page holes, and non-digital artifacts.

The two clean logo assets have been copied into `backend/assets/official-forms/` for the pending TEMPLATE-1 commit. Reference photographs remain local-only inputs under `backend/.temp/official-form-inputs/` and must not be committed.

## 5. Agent/workflow allocation

### Codex — template reconstruction and visual fidelity

Codex owns the initial static-template packages:

1. TEMPLATE-1 — Oral Examination Criteria;
2. TEMPLATE-2 — GS-011 Oral Examination Summary Sheet;
3. TEMPLATE-3 — GS-006 / GS-007 Defense Application.

For each template:

1. reconstruct a clean digital A4 layout from the supplied reference;
2. use the clean logo assets;
3. keep all student/committee/score/signature values as explicit dynamic fields/placeholders;
4. generate sample PDF output using dummy data only;
5. render the generated PDF for visual comparison;
6. iterate on spacing, typography, table geometry, logo placement, and page layout;
7. stop at static-template visual acceptance.

No database, API, authorization, or business-rule integration should be added during the initial template package unless separately approved.

### DeepSeek — GS-IS integration after template approval

After a template is visually accepted, DeepSeek may implement the bounded integration package:

- authoritative data mapping;
- backend rendering service integration;
- Admin authorization;
- secure generation/download endpoints;
- server-side signature embedding where already authorized;
- Admin Defense Record Download / Print activation;
- unit/contract/security tests;
- storage/provenance work if approved for that package.

Static template approval must happen before system-data integration.

## 6. Rendering architecture direction

Current backend dependencies already include `pdf-lib`. The initial implementation should prefer the existing Node/backend environment and avoid introducing Chromium/Puppeteer unless exact fidelity proves impractical after a real prototype.

### 6.1 Responsibility boundaries

Keep the existing document concerns separate:

```text
backend/src/
├── extraction/            ← uploaded document → structured information
├── storage/               ← private file persistence / managed uploads
├── documents/
│   └── official-defense/  ← structured information → official PDF
└── services/
    └── official-defense-document.service.ts
                            ← later domain/auth/render orchestration
```

This distinction is intentional:

- `extraction/` reads information from uploaded files;
- `storage/` owns private file persistence and managed upload mechanics;
- `documents/official-defense/` renders structured values into official documents;
- the later service layer resolves authorization and authoritative domain data, maps it into form-specific render DTOs, selects the renderer, and returns/stores the result as approved by the package.

### 6.2 Proposed renderer folder structure

Use this as the target shape, but create folders/files only when the corresponding package needs them:

```text
backend/src/documents/official-defense/
├── shared/
│   ├── pdf-layout.ts
│   ├── pdf-text.ts
│   ├── pdf-table.ts
│   └── institutional-header.ts
│
├── oral-exam-criteria/
│   ├── oral-exam-criteria.types.ts
│   └── oral-exam-criteria.renderer.ts
│
├── oral-exam-summary/
│   ├── oral-exam-summary.types.ts
│   └── oral-exam-summary.renderer.ts
│
├── defense-application/
│   ├── defense-application.types.ts
│   └── defense-application.renderer.ts
│
└── index.ts
```

TEMPLATE-1 must not create the TEMPLATE-2 or TEMPLATE-3 renderer files merely to fill out the tree. Start with:

- the Oral Examination Criteria form-specific types/renderer;
- A4/layout primitives that TEMPLATE-1 genuinely needs;
- shared institutional-header logic because the confirmed form family uses the same two-logo EARIST header;
- additional shared helpers only when they reduce real duplication.

Do **not** pre-build:

- a generic `FormRenderer` hierarchy;
- a `FormTemplate` database model;
- a template registry;
- a document factory;
- a generated-document manager;
- arbitrary page-layout editing;
- an Admin template-management UI.

Those abstractions are deferred until multiple accepted templates prove they are necessary.

### 6.3 Renderer contract

Each renderer must be pure with respect to the application/domain layer:

```text
authoritative defense record
        ↓
later integration service
        ↓
form-specific typed render input
        ↓
approved renderer
        ↓
PDF bytes
```

The renderer must not:

- query Prisma;
- call repositories;
- determine authorization;
- inspect an Express request;
- write an Express response;
- determine academic workflow state;
- derive a verdict;
- fetch the "latest" attempt/document as a fallback.

For TEMPLATE-1, the render input should make dynamic fields explicit, including candidate/program/date, criterion values, Group I/II averages, recommendations, rating/remarks where applicable, evaluator printed name, and optional signature image bytes/placeholders. The exact type should follow the approved form semantics and must not introduce a new scoring formula.

Later DeepSeek integration will map authoritative `OralExamScore`, `officialSnapshot`, exact `PanelAssignment`, schedule/student/program context, and authorized signature evidence into this DTO.

### 6.4 Static assets

Keep binary institutional assets outside TypeScript source, for example:

```text
backend/assets/official-forms/
├── earist-logo.<approved-format>
└── graduate-school-logo.<approved-format>
```

The project owner has supplied clean logo assets. Their final repository filenames/format may be chosen during TEMPLATE-1 implementation after checking print quality and aspect ratio.

Reference photographs are visual QA inputs, not production page backgrounds.

### 6.5 Existing PDF code is not the precedent

`backend/src/controllers/waiver.controller.ts` contains an older one-off `pdf-lib` generator. It was independently created and must **not** be treated as the architecture for this initiative.

Reusable from that area:

- the fact that `pdf-lib` is already an installed backend dependency.

Not reusable as an architectural pattern:

- PDF drawing directly inside a controller;
- mixing domain/data access, layout, and HTTP response handling;
- its hard-coded page geometry;
- its visual/form conventions.

Do not refactor or alter the waiver flow during Official Defense Forms work.

Likewise, `backend/src/extraction/`, PDF.js native PDF extraction, and the intentionally unavailable OCR fallback are separate document→data concerns. They remain valid for their own workflows but are not the data→PDF rendering architecture.

### 6.6 TEMPLATE-1 QA support

A bounded development/sample path may be added for TEMPLATE-1, for example:

`backend/scripts/generate-official-form-samples.ts`

Sample output should go to a gitignored temporary path such as:

```text
backend/.tmp/official-form-samples/
├── oral-exam-criteria.pdf
└── oral-exam-criteria.png
```

Generated samples are QA artifacts and should not be committed unless the project later explicitly adopts golden binary fixtures.

Poppler or another available local PDF rasterizer may be used only to convert the generated PDF to an image for visual comparison. It is not production rendering infrastructure.

### 6.7 Tests

Unit tests should mirror the renderer responsibility, for example:

```text
backend/tests/unit/documents/official-defense/
└── oral-exam-criteria.renderer.test.ts
```

Tests should verify deterministic structural behavior that is reasonable to automate, such as:

- valid PDF bytes;
- A4 dimensions;
- expected page count;
- required labels/text;
- handling of realistic long placeholder values;
- no clipping/overflow where measurable;
- deterministic rendering inputs.

Automated tests do not replace visual comparison and project-owner approval.

### 6.8 Later integration layer

After static visual acceptance, DeepSeek may add:

`backend/src/services/official-defense-document.service.ts`

That service may own:

- role/authorization context;
- authoritative exact-attempt reads;
- secure server-side signature retrieval;
- domain-record → renderer-DTO mapping;
- renderer selection;
- HTTP/controller-facing result metadata;
- persistence/provenance only if separately approved.

Controllers should remain thin and should not own institutional page drawing.

Raw signature evidence must remain server-side. Do not expose base64 signature data through the general Admin Defense Record read model merely to generate PDFs in the browser.

## 7. Existing Admin integration target

The accepted Admin Defense Record detail page already owns section-level disabled `Download / Print` controls.

Future activation should remain section-owned:

- Evaluation Results → Individual Evaluation forms;
- Oral Examination Summary → GS-011 Summary;
- Defense Application / relevant Admin application surface → GS-006 / GS-007;
- Committee Report → later GS Form No. 22 package.

Do not add fake download links, no-op controls, or print the whole Defense Record screen.

## 8. Pre-implementation repository consistency item

Before document readiness is used as an official completion signal, reconcile the stale Title Defense record-status projection in:

`backend/src/services/defense-record-status.rules.ts`

The newer canonical workflow and current runtime evaluation services treat Title, Proposal, and Final Defense as using the evaluator scoring/finalization lifecycle. The stale projection still carries an older assumption that Title Defense has no numerical Criteria/Summary requirement.

This must be corrected in a bounded prerequisite package using the current canonical Defense Workflow SOT and current runtime behavior as authority. The forms initiative must not copy the stale assumption.

## 9. Policy boundaries that must not be invented

The following remain explicit boundaries until institutional/client confirmation:

- no invented form code/revision for Oral Examination Criteria;
- no automatic reuse of Individual Evaluation signature evidence as a GS-011 signature;
- no automatic Adviser concurrence signature on GS-011;
- no automatic Dean attestation/signature on GS-011;
- no automatic Dean/VPAA/President signatures on GS-006/GS-007;
- no invented mapping that turns Adviser, Facilitator, or Rapporteur into numerical evaluators;
- no fabricated committee member to fill a printed row;
- no silent reinterpretation of legacy scoring;
- no score-derived PASSED / REDEFENSE_REQUIRED verdict;
- no inferred official title where the exact defense attempt has none.

## 10. Recommended implementation order

```text
DOC-FORM-0
Documentation + template/readiness audit + bounded stale-status correction
        ↓
TEMPLATE-1
Oral Examination Criteria static PDF
        ↓
project-owner visual acceptance
        ↓
TEMPLATE-2
GS-011 static PDF
        ↓
project-owner visual acceptance
        ↓
TEMPLATE-3
GS-006 / GS-007 static PDFs
        ↓
project-owner visual acceptance
        ↓
approved-template integration packages
        ↓
Admin authenticated Download / Print
        ↓
security + regression + visual/print QA
        ↓
GS Form No. 22 / Rapporteur renderer as a later initiative package
```

## 11. Acceptance rule for template work

A template is not accepted merely because PDF generation succeeds.

Acceptance requires:

- correct institutional text and confirmed form code/revision where known;
- correct page size/orientation;
- accurate logo/header hierarchy;
- accurate table structure;
- accurate field placement;
- stable typography and spacing;
- printable output with no clipping/overflow;
- dynamic placeholder values fitting realistic data;
- visual comparison against the supplied institutional reference;
- project-owner visual approval.

## 12. Original documentation-only checkpoint

The original planning checkpoint was documentation only.

It does not:

- add a PDF endpoint;
- add a renderer;
- add template assets;
- alter Prisma schema;
- alter defense workflow;
- alter evaluator authority;
- alter RAP signatures;
- enable any Download / Print button.

Implementation was subsequently authorized for TEMPLATE-1 only, as recorded below.

## 13. TEMPLATE-1 implementation and acceptance checkpoint (2026-10-22)

**ACCEPTED / PUBLISHED.** Project-owner visual approval was granted after the bounded refinement pass. TEMPLATE-2 is authorized next; TEMPLATE-3 and GS-IS integration remain separately gated.

- Starting implementation HEAD: `74b09e8475d7767b3e573b70d3c7151c23c2241b`; verified against GitHub before implementation.
- Both planning documents were re-read; the reference photograph and both clean logos were actually viewed locally before coding.
- Renderer: `backend/src/documents/official-defense/oral-exam-criteria/oral-exam-criteria.renderer.ts`.
- Explicit typed input: `oral-exam-criteria.types.ts`; logo/signature bytes, identity, date, nine criterion choices, both averages, recommendations, rating, remarks, and evaluator printed name. No averages, verdicts, or academic interpretation are computed.
- Shared helpers are limited to A4/rules/image containment, bounded measured text, and the institutional masthead.
- Production logo files are byte-identical copies of the supplied clean JPEGs. Their provenance, native dimensions, hashes, and print-resolution limitations are recorded in `backend/assets/official-forms/README.md`.
- The renderer returns PDF bytes and has no filesystem, database, repository, HTTP, authorization, or workflow dependency.
- Dev-only generation: `npm run forms:sample:criteria -- --rasterize` from `backend/` produces blank, filled, and long-value samples under `.tmp/official-form-samples/`. The command works without reference inputs or application bootstrap. Poppler is QA-only.
- Six focused tests pass: valid/deterministic single-page A4 PDF, institutional labels/matrix, explicit supplied values, long-value completeness/print-safe bounds, blank cells/optional PNG signature embedding, overflow rejection, and malformed-matrix rejection.
- `npm run build` passes. No new dependency, Prisma/schema, controller, route, UI, waiver, extraction, storage, scoring, verdict, or stale-status change is included.
- Visual QA used three PDF/raster review passes over blank, filled, and long-value examples. The first pass caught default filled table rectangles; the second verified border-only tables and field placement; the final pass refined recommendation line spacing, summary-column dividers, and the signature area. Final PNGs were inspected for clipping and overlap.

Known fidelity limits: the photograph does not establish exact typefaces or physical dimensions; these are reconstructed. Color logos are retained from the supplied clean assets, fine seal lettering remains limited by the 141/207 px originals, and photocopy noise/skew/shading are replaced by straight vector geometry and uniform gray bands. Matrix numbers use the requested consistent two-decimal notation. No form code or revision is invented.

The detailed renderer contract, sample commands, limits, and QA notes are in `backend/src/documents/official-defense/oral-exam-criteria/README.md`.

### Accepted publication state

TEMPLATE-1 was published on `feat/official-defense-document-forms` through:

- `d06e7967f2212bd86a2a869e4ed1dcfd90c498db` — `feat(documents): add oral examination criteria renderer`
- `9e76390623739dbb9ec0e609baf6c78880d6edce` — `fix(documents): refine oral examination criteria layout`

Accepted remote HEAD for TEMPLATE-1: `9e76390623739dbb9ec0e609baf6c78880d6edce`.

Final accepted visual refinements include:

- compact inline Candidate / Course / Date fields;
- filled sample Course value corrected to `MAEd`;
- preserved long-value wrapping behavior;
- tightened evaluator printed-name / signature-line relationship while retaining the intentional lower-page whitespace;
- `X` retained only as an explicitly unconfirmed QA marker, not an institutional scoring rule;
- regenerated blank, filled, and long-value samples with no observed clipping or overlap;
- eight focused renderer tests and backend build passing.

### Next authorized package

**TEMPLATE-2 — EARIST-QSF-GS-011 Rev. 01 (06.20.25) — Oral Examination Summary Sheet**

TEMPLATE-2 remains static-template only. It may reuse accepted TEMPLATE-1 shared PDF/header helpers where appropriate, but it must not add database/API/UI integration, invent GS-011 signature policy, or start TEMPLATE-3.

## 14. TEMPLATE-2 implementation checkpoint (2026-10-22)

**ACCEPTED / PUBLISHED.** TEMPLATE-1 remains accepted/published. Project-owner visual approval for TEMPLATE-2 was granted on 2026-10-22. TEMPLATE-3 is authorized next; GS-IS integration remains deferred.

- Verified branch: `feat/official-defense-document-forms`; starting local and GitHub remote HEAD: `84002a713e3c9a0342e6414e662793fcfa0308ed`.
- Re-read both initiative documents and the accepted TEMPLATE-1 implementation/shared helpers.
  Inspected the actual local GS-011 reference pixels before coding.
- Renderer and typed contract: `backend/src/documents/official-defense/oral-exam-summary/`.
  Explicit logo bytes, identity fields, six bounded examiner rows, independent Chairman/five Member
  display-name slots, Adviser name, and Dean name. All ratings/Average are supplied strings.
- Reuses accepted A4/rules, bounded measured text, image containment, and institutional masthead
  without changing shared files or TEMPLATE-1. GS-011 geometry remains form-specific.
- Preserves six printed examiner rows, one Chairman/five Member lines, and Adviser/Dean areas. The confirmed reference identity remains `EARIST-QSF-GS-011 Rev. 01 (06.20.25)`, while the visible footer is omitted from generated PDFs per project-owner instruction. Unused slots remain blank.
- Pure typed input to PDF bytes: no I/O, DB/repository/API/auth/workflow, signature retrieval,
  scorer-role inference, average calculation, or verdict inference.
- Dev command: `npm run forms:sample:summary -- --rasterize` from `backend/`.
  Blank, filled (`MAEd`), and long-value PDF/PNG pairs remain ignored under
  `backend/.tmp/official-form-samples/`; no reference photographs or generated artifacts are committed.
- Two visual QA passes inspected all three variants. The second centered table text and added
  clearance beside long signatory names. Final samples show no observed clipping/overlap.
- Eight TEMPLATE-2 tests plus nine existing TEMPLATE-1 tests pass; backend TypeScript build passes.
  See the renderer README for sample paths, contract, overflow behavior, fidelity limits, and QA notes.
- Existing production logos are reused; no new assets/dependencies, controller/waiver changes,
  Prisma/schema, extraction/storage, scoring/workflow, API, or UI changes are included.

The clean reconstruction uses standard PDF fonts and the supplied color logos.
Exact original typefaces/physical measurements remain approximate because the source is a
perspective photocopy photograph; existing logo resolution limits fine seal lettering.
Project-owner visual approval was granted on 2026-10-22. Accepted remote HEAD for TEMPLATE-2: `5ffd5d5e03524ce12f0f65b0629e97d66e264b1d`.

### TEMPLATE-2 footer refinement requested by project owner

The visible `EARIST-QSF-GS-011 Rev. 01 (06.20.25)` footer is omitted from generated
TEMPLATE-2 PDFs per the latest project-owner instruction. This supersedes the earlier
footer reproduction requirement for the current output; the reference form identity remains
unchanged. Field/table/signatory geometry is retained. This footer omission is part of the accepted TEMPLATE-2 output.


### TEMPLATE-2 accepted publication state

TEMPLATE-2 was published on `feat/official-defense-document-forms` as:

- `5ffd5d5e03524ce12f0f65b0629e97d66e264b1d` — `feat(documents): add oral examination summary sheet renderer`

Final accepted points:

- pure typed input to PDF bytes with no DB/API/workflow/signature retrieval;
- accepted shared helpers reused unchanged;
- six physical examiner rows and one Chairman/five Member printed lines;
- explicit caller-supplied ratings, averages, and signatory display names;
- blank/filled/long-value variants visually reviewed with no observed clipping or overlap;
- filled QA sample uses `Course: MAEd`;
- visible GS-011 footer omitted per project-owner instruction while the confirmed form identity remains documented;
- eight TEMPLATE-2 tests, nine TEMPLATE-1 tests, backend build, and diff checks passed;
- TEMPLATE-1 and shared helper output remained unchanged.

### Next authorized package

**TEMPLATE-3 — GS-006 / GS-007 Defense Application**

TEMPLATE-3 remains static-template only. Implement GS-006 and GS-007 as controlled variants of one document family where practical. Do not add GS-IS integration, approval-signature inference, payment-rule changes, GS Form No. 22, or a generic template platform.
