# Official Defense Document Forms — Initiative Plan

**System:** EARIST Graduate School Information System (GS-IS)  
**Repository:** `MuelTech/graduate-system`  
**Initiative branch:** `feat/official-defense-document-forms`  
**Branch baseline:** `main` @ `d8ac8479fd34226dc837cba9048a1db5a1f72776`  
**Date:** 2026-10-22  
**Status:** STATIC FORM PHASE CLOSED — FORM-INT-0 ACCEPTED — FORM-INT-PRE1 ACCEPTED — FORM-INT-1 ACCEPTED — FORM-INT-2 CORE INTEGRATION ACCEPTED / FIX-1 TITLE LAYOUT PENDING — FORM-INT-3 ACCEPTED — FORM-INT-4 FIX-1/FIX-2/FIX-3/FIX-4 ACCEPTED — PAYMENT/O.R. POLICY PENDING

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

## 15. TEMPLATE-3 implementation checkpoint (2026-10-22)

**ACCEPTED / PUBLISHED.** Project-owner visual approval was granted on 2026-10-22. TEMPLATE-1 and TEMPLATE-2 remain accepted/published. The original TEMPLATE-3 visual baseline was later superseded only for the bounded committee-row presentation rules recorded in TEMPLATE-3 FIX-1 below.

- Branch: `feat/official-defense-document-forms`; starting local/remote HEAD:
  `8ddb390980cd8537c30014c4e90c8dc0cb2d794d`; initial working tree clean.
- Fully re-read both initiative documents and reviewed the accepted renderers/shared helpers.
  Actual reference filenames were enumerated and both photographs viewed at pixel level:
  `gs-006-masters-defense-application.jpg` and `gs-007-doctoral-defense-application.jpg`.
- New family: `backend/src/documents/official-defense/defense-application/`.
  One discriminated typed input (`masters`/`doctoral`) and one renderer return PDF bytes.
  There is no file/DB/repository/API/auth/workflow lookup, payment validation, signature retrieval,
  scoring, academic rule, or latest-record fallback.
- Original reconstruction followed the photographed committee rows. Post-merge verification against the centralized `DefenseCommitteePolicy` establishes that printed capacity is stage-specific, not fixed only by program: Master's Title = Chairman + 4 Panelists; Master's Proposal/Final = Adviser + Chairman + 3 Panelists; Doctoral Title = Chairman + 5 Panelists; Doctoral Proposal/Final = Adviser + Chairman + 4 Panelists. Neither form prints a dedicated Chairman label, so Chairman occupies a printed `Panelist` row while remaining `CHAIRMAN` in GS-IS.
- Adviser visibility is stage-specific for both programs: no Adviser at Title; the active Adviser is automatically included at Proposal/Final. Printed labels never redefine evaluator authority or stored committee roles.
- Program-specific masthead/application positioning, committee capacity, lower approval spacing,
  and the exact `EARIST-QSF-GS-006 Rev. 01 (06.20.25)` /
  `EARIST-QSF-GS-007 Rev. 01 (06.20.25)` footers are preserved.
- Shared A4/rules, bounded text, image containment, and institutional header are reused unchanged.
  No accepted TEMPLATE-1/TEMPLATE-2 source, README, script, tests, or retained samples changed.
- Both references print the same fee text: three 300 entries and P 900.00 in each Proposal/Final column.
  This is drawn as static text independently of explicit Amount Paid/O.R. values; no formula or payment state.
- The input explicitly supplies selection, applicant identity/contact/date-time, payment/O.R./application date,
  defense date/time/link, committee display slots, and Dean/VPAA/President names.
  No extra fields, signatures, approval states, specialization, or workflow mapping are introduced.
- The isolated `X` is an unconfirmed dummy QA marker only, not an official institutional marking rule.
- Dev command: `npm run forms:sample:application -- --rasterize` from `backend/`.
  Six dummy-data PDF/PNG pairs remain ignored under `backend/.tmp/official-form-samples/`.
  Normal examples use `MAEd` and `EdD`; all reference photographs remain local-only.
- Three visual-review passes inspected all six variants. Refinements corrected marker placement,
  Doctoral title/header spacing, footer print clearance, and normal email wrapping.
  Latest PNGs show no observed clipping/overlap; long values remain bounded.
- Fifteen TEMPLATE-3, eight TEMPLATE-2, and nine TEMPLATE-1 tests pass (32 total), including exact form identities,
  deterministic one-page A4 output, printed capacities/blank slots, explicit values, static fee text,
  marker placement, long-value bounds, overflow errors, and production import boundaries.
  Backend TypeScript build and diff checks pass.
- No new assets/dependencies, schema, API/UI, extraction/storage, waiver, payment verification,
  signature/approval workflow, committee/scoring/verdict, or stale-status change is included.

Exact original fonts/physical measurements remain approximate because the sources are perspective photographs.
Standard PDF fonts and supplied color logos are used; fine logo lettering retains existing resolution limits.
Clean vector geometry removes scan defects; footer positions retain safe bottom margins.
See the TEMPLATE-3 README for the contract, all sample paths, QA details, and remaining fidelity limits.

Accepted remote HEAD for TEMPLATE-3: `959233de1d9be7209a3792702fb392056b605613`.

The published TEMPLATE-3 visual baseline remains the source for the form's institutional styling, but committee-row behavior now requires TEMPLATE-3 FIX-1 before integration. The forms initiative was merged to `main` via PR #37 at `552d8fa9c1a584a17aca1492fc6ee32a5a9b537c`.


## 16. FORM-DX-1 — official-form sample-script TypeScript project coverage

**COMPLETE / PASS.** Published as `299ca18a89e8fae54785326935fce966995302d8` and merged to `main` through PR #37.

After TEMPLATE-3 publication, VS Code showed TypeScript diagnostics in
`backend/scripts/generate-defense-application-samples.ts` for Node built-ins/globals, including:

- `node:child_process`;
- `node:fs/promises`;
- `node:path`;
- `process`;
- `__dirname`;
- the resulting implicit-`any` callback diagnostic.

Repository inspection confirms:

- `backend/package.json` already includes `@types/node`;
- `backend/tsconfig.json` already declares `types: ["node"]`;
- the production config has `rootDir: "./src"`;
- the production config includes only `src/**/*`;
- all three official-form QA generators live under `backend/scripts/`;
- the sample commands execute with `ts-node --transpile-only`;
- therefore the backend production `tsc` build does not type-check these scripts.

This explains why renderer tests/build/sample generation could pass while VS Code still reports errors in the scripts: the files are outside the configured backend TypeScript project and are being analyzed with inferred/editor settings.

### Required bounded correction

Fix TypeScript/editor coverage for:

- `generate-oral-exam-criteria-samples.ts`;
- `generate-oral-exam-summary-samples.ts`;
- `generate-defense-application-samples.ts`.

The correction must not:

- widen the production `rootDir` in a way that changes emitted `dist` structure;
- change renderer behavior or accepted PDF output;
- add application/domain logic;
- change Prisma/API/UI/workflow code.

Prefer a dedicated scripts TypeScript config and an explicit no-emit type-check command if that is the smallest clean solution.

### Acceptance

FORM-DX-1 is complete only when:

- VS Code diagnostics for the three sample generators are resolved under the repository TypeScript project configuration;
- a dedicated script type-check passes;
- existing TEMPLATE-1/TEMPLATE-2/TEMPLATE-3 tests pass;
- backend production build still emits/behaves as before;
- all three sample-generation commands still run;
- `git diff --check` passes.

FORM-DX-1 is complete. Integration remains gated only by the bounded TEMPLATE-3 FIX-1 committee-presentation correction documented below.

## 17. TEMPLATE-3 FIX-1 — Defense Application committee-role alignment

**ACCEPTED / MERGED.** Implementation `03cbc80c92b7a9cf538b82b96b920cb373f81a94` was independently reviewed and merged to `main` via PR #38 at `48e7e02f546de894d9591b0e4a271b9629f1bdbd`.

This post-merge clarification changes presentation geometry only. It does not change GS-IS committee roles, evaluator authority, scoring, scheduling, or defense workflow.

### Authoritative source

The generated Defense Application must follow the existing centralized policy used by Admin scheduling:

`backend/src/services/defense-committee.policy.ts`

The Admin committee builder consumes the same policy, so the PDF must not maintain a conflicting independent participant count.

Current authoritative session rules:

| Stage | Program | Adviser | Chairman | Panelists | Facilitator | Rapporteur | Session total | Printed `Panelist` rows |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Title | Master's | 0 | 1 | 4 | 1 | 1 | 7 | **5** |
| Proposal / Final | Master's | 1 | 1 | 3 | 1 | 1 | 7 | **4** |
| Title | Doctoral | 0 | 1 | 5 | 1 | 1 | 8 | **6** |
| Proposal / Final | Doctoral | 1 | 1 | 4 | 1 | 1 | 8 | **5** |

### Printed-role mapping

The Defense Application forms have no dedicated printed Chairman label. Therefore:

- GS-IS `CHAIRMAN` remains `CHAIRMAN` in domain data and authorization;
- the generated GS-006 / GS-007 Defense Application displays that person's name in a row labelled `Panelist`;
- actual `PANELIST` members follow in the remaining printed Panelist rows;
- the integration layer will later supply names in deterministic printed order;
- the static renderer must not query committee data or infer who is Chairman.

### GS-006 Master's required output

For **Title Defense**:

- no Adviser row;
- five printed Panelist rows = Chairman + four Panelists;
- Facilitator;
- Rapporteur;
- seven total participants.

For **Proposal Defense** and **Final Defense**:

- Adviser row;
- four printed Panelist rows = Chairman + three Panelists;
- Facilitator;
- Rapporteur;
- seven total participants.

Therefore GS-006 printed Panelist capacity is stage-dependent: 5 for Title and 4 for Proposal/Final.

### GS-007 Doctoral required output

For **Title Defense**:

- no Adviser row;
- six printed Panelist rows = Chairman + five Panelists;
- Facilitator;
- Rapporteur;
- eight total participants.

For **Proposal Defense** and **Final Defense**:

- Adviser row;
- five printed Panelist rows = Chairman + four Panelists;
- Facilitator;
- Rapporteur;
- eight total participants.

Therefore GS-007 also needs stage-dependent Adviser visibility and printed Panelist capacity: 6 for Title and 5 for Proposal/Final.

### Reference-form authority

The supplied GS-006 / GS-007 photographs remain valid visual references for institutional style, typography, fields, fee table, approval blocks, and general geometry. Their photographed committee-row arrangement does not override the centralized GS-IS committee policy.

### FIX-1 acceptance

Before GS-IS integration:

- GS-006 Title: no Adviser + 5 printed Panelist rows;
- GS-006 Proposal/Final: Adviser + 4 printed Panelist rows;
- GS-007 Title: no Adviser + 6 printed Panelist rows;
- GS-007 Proposal/Final: Adviser + 5 printed Panelist rows;
- keep Chairman stored/authorized as `CHAIRMAN` while presenting the name under a printed `Panelist` label;
- do not introduce a separate printed Chairman label;
- do not mutate system committee roles or duplicate committee-count logic;
- update samples/tests/docs;
- rerun TEMPLATE-1/TEMPLATE-2/TEMPLATE-3 tests, `npm run forms:check`, backend build, sample generation, and `git diff --check`;
- perform visual QA for all four stage/program combinations and confirm one-page A4 output plus safe signatory/footer clearance.

TEMPLATE-3 FIX-1 is accepted. The next package is FORM-INT-0, an analysis-only integration readiness audit. Production integration must not begin until that audit is reviewed and accepted.

## 18. FORM-INT-0 — Official Defense Document integration readiness audit

**COMPLETE / ACCEPTED AS INTEGRATION PLANNING BASELINE.**

Branch:

`feat/official-defense-document-integration`

Actual audit base:

`401219c8c22f5b56247a79fa42f99bfe2ee8d41c`

Dedicated audit record:

`docs/superpowers/plans/2026-10-22-official-defense-document-integration-audit.md`

FORM-INT-0 made no runtime, schema, API, renderer, or UI changes. Its accepted planning conclusions are:

- Individual Evaluation uses the exact finalized evaluator `OralExamScore.officialSnapshot` plus that evaluator's exact signature evidence;
- GS-011 uses the persisted `OralExamSummary.snapshotData` and does not reuse unrelated signatures;
- GS-006/GS-007 is anchored to the exact `DefenseSchedule.id` plus exact committee assignments;
- official generation must not use thesis-level latest/current schedule fallback;
- the accepted TEMPLATE-3 FIX-1 committee presentation remains authoritative;
- unavailable Defense Application fields remain blank rather than inferred;
- first integration is on-demand rendering; generated-document persistence/versioning stays deferred;
- Admin Defense Record detail remains the owning UI surface for official outputs;
- the stale Title Defense record-status projection is a prerequisite correction before exposing document readiness.

The audit is a planning baseline, not permission to broaden scope. Each implementation package must still verify its exact repository dependencies.

## 19. FORM-INT-PRE1 — Defense Record status alignment

**ACCEPTED / COMPLETE.**

Implementation:

`ae68d14b7af037e0570c21336de1ea7c43fb424c` — `fix(defense-records): align title completion with summary lifecycle`

Purpose:

Correct the stale Title Defense completion projection before official-document readiness is activated.

Current inconsistency:

- `defense-record-status.rules.ts` still carries the old assumption that Title Defense has no numerical Criteria/Summary requirement;
- current official-record runtime and source-of-truth now treat Title, Proposal, and Final as producing evaluator Criteria + Oral Examination Summary.

Scope:

- `backend/src/services/defense-record-status.rules.ts`;
- `backend/tests/unit/services/defense-record-status.rules.test.ts`;
- comments/documentation only if needed to describe the corrected projection.

Required result:

- Title, Proposal, and Final must not reach COMPLETE merely because conclusion/RAP state is complete when the required Oral Examination Summary is absent;
- no academic result is inferred from scores;
- this remains a UI/readiness projection only.

Explicit exclusions:

- no renderer changes;
- no PDF endpoints;
- no controller/route work;
- no Admin UI;
- no Prisma/schema/migration;
- no scoring/verdict changes;
- no committee-policy changes;
- no GS Form No. 22 work.

Accepted result:

- the obsolete Title-specific Summary exemption was removed;
- Title, Proposal, and Final now require Summary ready + FINALIZED RAP after conclusion before the record projection becomes `COMPLETE`;
- focused status tests cover the corrected Title matrix;
- no renderer, API, route, frontend, schema, scoring, verdict, RAP-lifecycle, or committee-policy change was included.

Agent-reported verification for PRE1:

- focused status tests: 12/12 PASS;
- official-defense-record service tests: 41/41 PASS;
- backend TypeScript build: PASS;
- `git diff --check`: PASS.

The implementation was independently source/diff reviewed before acceptance.

## 20. FORM-INT-1 — Individual Oral Examination Criteria PDF integration

**ACCEPTED / COMPLETE.**

Implementation:

`9e1a89d4de7ad5f78fe5aefc35027ca2de8e08ca` — `feat(documents): integrate individual evaluation PDF`

Use the accepted FORM-INT-0 mapping and PRE1 readiness baseline.

Scope should remain limited to the first official document:

- exact schedule + evaluator assignment binding;
- finalized `OralExamScore.officialSnapshot`;
- evaluator signature image validation/decoding;
- server-side production logo loading;
- mapping to the accepted TEMPLATE-1 renderer;
- authenticated Admin PDF endpoint;
- focused authorization, exact-binding, V2-only, malformed-signature, and renderer-mapping tests.

Accepted result:

- new `OfficialDefenseDocumentService` reuses `OfficialDefenseRecordService.getOfficialCriteria(...)`;
- exact schedule + panel assignment binding remains authoritative;
- only finalized `INSTITUTIONAL_MATRIX_V2` evaluator records render;
- legacy scoring fails closed without conversion;
- exact evaluator signature data is validated/decoded server-side;
- accepted production logos are loaded from `backend/assets/official-forms/`;
- new ADMIN-only PDF route:
  `GET /thesis/defense/:scheduleId/records/criteria/:panelAssignmentId/pdf`;
- existing JSON Criteria route remains unchanged;
- no frontend, schema, GS-011, GS-006/GS-007, workflow, or persistence changes were included.

Agent-reported verification:

- 40 new FORM-INT-1 tests PASS;
- 86 renderer/official-record regression tests PASS;
- 52 controller/route regression tests PASS;
- `npm run forms:check` PASS;
- backend TypeScript build PASS;
- compiled `dist` asset loading PASS;
- `git diff --check` PASS.

Independent remote source/diff review found no blocking correctness or authorization defect.

Operational requirement: production packaging must retain `backend/assets/official-forms/` alongside the compiled backend because the accepted loader resolves from module location rather than copying assets into `dist`.

## 21. FORM-INT-2 — GS-011 Oral Examination Summary PDF integration

**CORE INTEGRATION ACCEPTED — TITLE LAYOUT FIX REQUIRED.**

Implementation:

`d16f2819df176a470e68bfd1301873fbee9ea119` — `feat(documents): integrate oral exam summary PDF`

Reuse the accepted FORM-INT-1 orchestration/asset/route pattern where it genuinely applies.

Scope:

- exact `scheduleId` authority;
- exact persisted `OralExamSummary.snapshotData`;
- V2-only/mixed-version fail-closed validation;
- examiner rows from the persisted snapshot only;
- Chairman/Member display names from snapshot evaluator roles;
- exact schedule Adviser seat for Proposal/Final only;
- Dean/attestation blank unless an authoritative current source exists;
- wet-signature-only GS-011 output for the first integration;
- ADMIN-only PDF route and focused tests.

Accepted result:

- exact persisted `OralExamSummary.snapshotData` is the official GS-011 academic/identity source;
- no Summary regeneration or live-score reconstruction occurs during PDF generation;
- examiner rows preserve persisted snapshot order;
- Group A / Group B / Average are read directly from persisted snapshot values;
- exactly one Chairman is used for Submitted by; Panelists fill Member names;
- Title correctly resolves no Adviser value, but the accepted static renderer still draws the fixed Adviser concurrence block; project-owner QA now requires that entire block to be omitted for Title Defense;
- Proposal/Final require exactly one exact-schedule ADVISER assignment and retain the Adviser concurrence block;
- Dean remains blank;
- no digital signature evidence is loaded or reused;
- legacy/mixed/unknown scoring versions fail closed;
- new ADMIN-only endpoint:
  `GET /thesis/defense/:scheduleId/records/summary/pdf`;
- no frontend, GS-006/GS-007, schema, workflow, or persistence changes were included.

Agent-reported verification:

- 82 focused FORM-INT-1/2 service/controller/route tests PASS;
- 73 renderer/official-summary regression tests PASS;
- 52 controller/route regression tests PASS;
- `npm run forms:check` PASS;
- backend TypeScript build PASS;
- `git diff --check` PASS.

Independent remote source/diff review found no blocking correctness, authorization, signature-reuse, or frozen-snapshot defect in the data/source binding. Later project-owner visual QA identified a Title-only presentation defect: a blank Adviser value still leaves the printed Adviser concurrence block visible. FORM-INT-2 therefore remains open for the bounded FIX-1 below.

Minor hardening note: because the persisted `OralExamSummary` relation already belongs to the exact schedule, the implementation is correctly attempt-bound. A future bounded hardening pass may additionally assert that the snapshot's own `scheduleId` and `defenseType` metadata match the owning schedule.

## 22. FORM-INT-3 — GS-006 / GS-007 Defense Application PDF integration

**ACCEPTED / COMPLETE.**

Implementation:

`8393a368dd56230e6669a85de42cc3880f60b2da` — `feat(documents): integrate defense application PDF`

Use the accepted TEMPLATE-3 FIX-1 committee presentation and exact schedule binding.

Scope:

- exact `DefenseSchedule.id`;
- exact schedule student/program/stage context;
- program type → GS-006 Master's / GS-007 Doctoral variant;
- exact schedule committee assignments;
- Chairman first in printed `Panelist` rows, followed by actual Panelists;
- Proposal/Final exact schedule Adviser; Title no Adviser;
- Facilitator and Rapporteur exact schedule seats;
- currently unavailable application/payment/approval identity fields remain blank;
- ADMIN-only PDF endpoint;
- no signature inference/reuse;
- focused tests for all stage/program combinations and fail-closed committee validation.

Implementation review result:

- exact schedule-bound data source and ADMIN-only endpoint are correct;
- GS-006/GS-007 variant and stage mappings are correct;
- centralized committee policy is reused rather than duplicated;
- Chairman-first printed presentation and deterministic Panelist ordering are correct;
- unavailable application/payment/personal-Gmail/approval fields remain blank;
- wall-clock defense time is preserved;
- no signature reuse, schema change, frontend activation, or persistence/versioning was added.

Acceptance closure:

FORM-INT-3 FIX-1 is accepted at `d387526ad153df54b674b7b4b9b7ef09478a7676`.

The schedule block now uses Date/Time on its first line and a bounded full-width Link/Venue row beneath it. Exact authoritative `venueOrLink` text is preserved and may wrap; realistic physical venues, Google Meet links, and a long Teams-style URL render completely without truncation or URL rewriting. The committee table and approval/footer blocks shift only as needed while remaining one-page A4. Deliberately extreme content still fails explicitly.

Agent-reported FIX-1 verification:

- TEMPLATE-3 renderer tests: 47 PASS;
- FORM-INT-3 application service tests: 38 PASS;
- required combined regression set: 172 PASS;
- `npm run forms:check` PASS;
- backend build PASS;
- `git diff --check` PASS;
- 10 Defense Application sample PDFs generated;
- four representative Master's/Doctoral long venue/link outputs rasterized at 150 dpi and visually inspected with no observed clipping, overlap, broken borders, signatory/footer collision, or unsafe margins.

Independent remote diff/source review confirmed the fix is renderer-scoped and found no blocking layout or integration defect.

## 23. FORM-INT-3 FIX-1 — Defense Application Link/Venue capacity hardening

**ACCEPTED / COMPLETE.**

Implementation:

`d387526ad153df54b674b7b4b9b7ef09478a7676` — `fix(documents): harden defense application venue layout`

Scope:

- TEMPLATE-3 schedule-row layout only, plus directly affected tests/samples/docs;
- preserve exact `venueOrLink` display text;
- support realistic physical venues and normal meeting URLs without truncation/ellipsizing;
- keep GS-006/GS-007 one-page A4;
- preserve committee rows, approval blocks, footer, form codes, and accepted stage/program structures;
- regression-check all six stage/program combinations plus long venue/URL fixtures;
- visually inspect Master's and Doctoral output after geometry changes.

Do not change schedule/domain data, committee policy, route/auth behavior, blank-field rules, schema, or frontend activation.

FORM-INT-4 is now unblocked.

## 24. FORM-INT-4 — Admin Download / Print activation and hardening

**MANUAL QA FAILED / FIX-1 REQUIRED.**

Implementation:

`02043af2d8b99156046622438eb3635089417465` — `feat(documents): activate admin official PDF actions`

Activate the three accepted official-document PDF endpoints in the schedule-scoped Admin Defense Record UI:

- Defense Application → GS-006 / GS-007;
- Evaluation Results → per-evaluator Individual Evaluation PDF;
- Oral Examination Summary → GS-011.

Add only the minimum availability metadata/read-model changes required to show correct enabled/disabled actions and reasons. Preserve authenticated blob download/open behavior, exact `scheduleId` / evaluator binding, and existing section ownership.

Implemented result:

- Defense Overview now calls the exact schedule GS-006/GS-007 endpoint;
- Evaluation Results has an exact per-evaluator PDF action using `panelAssignmentId`;
- Individual actions enable only from `hasOfficialCriteria`;
- GS-011 action enables only from `oralExamSummary.ready`;
- Committee Report remains a disabled document placeholder;
- authenticated PDF retrieval is centralized in `official-defense-documents.client.ts`;
- bearer token is sent only in the Authorization header;
- PDF MIME/signature/empty-response validation is enforced before download;
- backend filenames are sanitized and deterministic fallbacks exist;
- scoped loading and Sonner error feedback are implemented;
- stale deferred-document assertions in the FIX-4/FIX-5 verifiers were narrowly superseded;
- no backend production, renderer, schema, workflow, GS Form No. 22, or new role-access change was included.

Agent-reported verification:

- new FORM-INT-4 verifier: 18/18 PASS;
- updated FIX-4/FIX-5 verifiers: 27/27 PASS;
- frontend TypeScript, scoped ESLint, build, and `git diff --check`: PASS;
- backend official-document regression slice: 172/172 PASS;
- `npm run forms:check` and backend build: PASS.

Independent remote source/diff review found no blocking implementation or security defect.

Manual-QA result:

Project-owner runtime inspection on 2026-10-23 rejected the current evaluator-download UX and UUID-oriented filenames.

Observed product defects:

1. Evaluation Results exposes one PDF button per evaluator. This is cumbersome for Admin printing and conflicts with the existing section-owned design precedent that Evaluation Results should produce a bundled evaluator packet.
2. Downloaded official PDFs use internal UUIDs as the visible filename identifier, making files difficult for ordinary users to recognize.

Required correction is FORM-INT-4 FIX-1:

- replace per-row evaluator PDF actions with one section-level Download / Print action;
- generate one exact-schedule, multi-page Individual Evaluations PDF containing Chairman + all Panelists, one accepted TEMPLATE-1 form per page;
- bundle availability requires every required evaluator form to be finalized, signed, and renderable;
- retain the single-evaluator endpoint only as an internal/exact-record capability if still useful;
- change Admin-facing Content-Disposition filenames for Defense Application, bundled Individual Evaluations, and GS-011 Summary to sanitized `<Student>-<Defense-Stage>-<Document-Type>.pdf` naming;
- internal UUIDs remain route identifiers but are not the normal visible filename;
- backend schedule context is authoritative for student/stage naming;
- no client-side PDF merge.

Repeat manual QA after FIX-1 before FORM-INT-4 can be accepted.

Do not add a generic Defense Documents inventory, browser-page printing as the official form, schema changes, generated-document persistence/versioning, GS Form No. 22, or new Student/Panelist document access.


## 25. FORM-INT-4 FIX-1 — Bundled Individual Evaluation PDF + readable official filenames

**IMPLEMENTED / SOURCE-REVIEWED.**

Implementation:

`53649871ff2690fa8450b2d884ae6497ffab4bb6` — `fix(documents): bundle evaluations and use readable filenames`

Manual-QA-driven correction only.

### Bundled evaluator packet

Admin Evaluation Results owns one section-level Download / Print action. The official output is one server-generated multi-page PDF for the exact defense schedule:

- evaluator roles only: Chairman + Panelists;
- Chairman first, then Panelists in deterministic schedule order;
- one evaluator form per page;
- each page uses the accepted TEMPLATE-1 renderer and exact finalized/signed evaluator source;
- no partial packet: if any required evaluator is unavailable or invalid, fail closed;
- no browser/client PDF merging.

### Readable filename convention

Normal user-facing filenames must omit opaque UUIDs and use authoritative student name + stage + document type.

Examples:

- `Juan-Dela-Cruz-Title-Defense-Application.pdf`
- `Juan-Dela-Cruz-Title-Defense-Individual-Evaluations.pdf`
- `Juan-Dela-Cruz-Title-Defense-Oral-Examination-Summary.pdf`

Equivalent Proposal Defense and Final Defense names follow the same convention.

The backend owns authoritative naming through Content-Disposition. Frontend continues sanitizing header-derived filenames and keeps a safe fallback.

### Still deferred

- GS Form No. 22;
- generated-document persistence/versioning;
- full Defense Packet across different document families;
- Student/Panelist official PDF access;
- unrelated workflow/UI redesign.


## 26. FORM-INT-4 FIX-2 — Individual Evaluation vector check marks

**IMPLEMENTED / SOURCE-REVIEWED.**

Implementation:

`9d1c9d494706725612685038f9fade913f2df387` — `fix(documents): render evaluation selections as check marks`

The former dummy X marker was replaced with renderer-local vector check geometry. Score authority, snapshot mapping, signatures, page ordering, bundling, filenames, API behavior, and workflow semantics are unchanged.

Agent-reported verification:

- TEMPLATE-1 renderer: 11/11 PASS;
- bundle service: 26/26 PASS;
- FORM-INT-1 service: 31/31 PASS;
- combined renderer/service slice: 68/68 PASS;
- forms check/build/diff checks PASS;
- standalone and bundled raster QA showed centered check marks with no X text or layout regression.

## 27. FORM-INT-4 FIX-3 — Defense Application stage check + form-code omission

**IMPLEMENTED / SOURCE-REVIEWED — FINAL OWNER VISUAL QA PENDING.**

Implementation:

`d00cf90f08c952f4981d6bebbf2b7be38cbd697e` — `fix(documents): refine defense application stage markers`

Project-owner decisions applied:

- selected Title / Proposal / Final stage is marked with a renderer-local vector check;
- no X text and no Unicode check glyph dependency;
- visible `EARIST-QSF-GS-006 Rev. 01 (06.20.25)` / `EARIST-QSF-GS-007 Rev. 01 (06.20.25)` text is omitted;
- Master's/Doctoral variants remain distinct internally and continue to control accepted stage/program geometry.

Agent-reported verification:

- TEMPLATE-3: 48/48 PASS;
- FORM-INT-3 service: 38/38 PASS;
- bundle regression: 26/26 PASS;
- TEMPLATE-1 check-mark regression: 11/11 PASS;
- forms check/build/diff checks PASS;
- six stage/program samples rasterized and visually inspected as one-page A4.

Final project-owner gate: regenerate/download one live Defense Application and visually confirm the check mark + code omission before marking FORM-INT-4 complete.


## 28. FORM-INT-4 FIX-4 — Defense Application field-authority follow-up — ACCEPTED / COMPLETE

Project-owner manual QA after FORM-INT-4 FIX-3 identified remaining blank GS-006 / GS-007 fields whose authority must be explicit before the integration can close.

### Resolved automatic mappings

- `Cellphone No.` → exact Student's `Student.cellphone`.
- `Email (Personal Gmail Only)` → exact Student user's `User.email`.
  - Applicant registration already rejects non-`@gmail.com` email server-side.
  - Development panelist `@earist.edu.ph` accounts do not affect this student field.
- `Date and Time` → server-owned timestamp of the latest successful application submission/resubmission for the exact stage.
- `Date of Application` → date portion of that same exact timestamp.
- rejected → corrected → successfully resubmitted applications print the latest successful resubmission timestamp, because that current corrected application version is the one reviewed/scheduled.
- remove `Note: Please write legibly` from generated digital output.

### Timestamp authority constraint

Do not map these fields from generic `ThesisRecord.createdAt` or `updatedAt`.

The current lifecycle reuses one ThesisRecord across Title → Proposal → Final, so:

- `createdAt` can represent the original Title record rather than Proposal/Final application filing;
- `updatedAt` can change for unrelated workflow mutations.

Implemented at `d931159d705b6f7466f2732e2162ce10e5a0dd45` with three nullable stage-specific `ThesisRecord` timestamps:

- `titleApplicationSubmittedAt`
- `proposalApplicationSubmittedAt`
- `finalApplicationSubmittedAt`

No historical backfill or schema default was added. Initial successful submissions write only their exact stage timestamp; successful rejected-application resubmissions update only the exact current stage timestamp.

### Still awaiting client confirmation

- `Amount Paid`
- `O.R. No.`

Until confirmed:

- do not derive Amount Paid from the pre-printed 300/900 fee table;
- do not assume receipt upload means the amount is 900;
- do not extract or fabricate an O.R. number from filename/upload metadata;
- keep these fields blank in official output unless the client confirms an authoritative capture/verification source.

### Acceptance result

FIX-4 is accepted.

Confirmed behavior:

1. Cellphone continues from exact `Student.cellphone`.
2. Student Gmail now comes from exact Student `User.email`.
3. exact stage-aware submission/resubmission timestamps are persisted server-side.
4. `Date and Time` + `Date of Application` render from the same exact stage event in Asia/Manila.
5. `Note: Please write legibly` is removed.
6. legacy pre-migration applications with null timestamps intentionally render blank filing fields rather than guessed dates.
7. Amount Paid / O.R. remain unresolved and blank pending client policy.

Agent-reported checks: TEMPLATE-3 48/48, official Defense Application service/source 44/44, repository timestamp coverage including all three initial stages and all three resubmissions, bundle 26/26, TEMPLATE-1 11/11, Prisma validate/generate/migrate status, forms check, backend build, and diff check all passed.

Independent remote review confirmed the additive migration and bounded mapping behavior.

This follow-up did not alter committee policy, scoring, evaluator bundles, GS-011 mapping, signatures, verdicts, or unrelated workflow behavior.


## 29. FORM-INT-2 FIX-1 — Title GS-011 Adviser-block omission

**REQUIRED / NOT YET IMPLEMENTED.**

Project-owner QA on 2026-10-24 clarified the stage-specific presentation contract for GS-011.

### Problem

The current source correctly sets Title Defense Adviser value to blank because Title has no Adviser assignment, but the static GS-011 renderer always draws:

- `Concurred In:`;
- the Adviser name/signature rule;
- `Thesis/Dissertation Adviser`.

That leaves a non-applicable Adviser section visible on Title Defense output.

### Required behavior

**Title Defense**

- omit the entire Adviser concurrence block;
- do not render `Concurred In:`;
- do not render the Adviser name/signature rule;
- do not render `Thesis/Dissertation Adviser`;
- retain the Dean `Attested` block;
- preserve all evaluator rows, Submitted by names, candidate/course/date/student number, and accepted page geometry;
- keep the PDF one-page A4 and visually balanced.

**Proposal Defense / Final Defense**

- preserve the current Adviser concurrence block;
- populate from exactly one `ADVISER` `PanelAssignment` on the exact `DefenseSchedule`;
- missing/ambiguous Adviser remains fail-closed;
- never substitute the Student's current/live Adviser or another defense attempt.

### Bounded implementation scope

Expected files are limited to the GS-011 renderer/types or render mapping only if necessary, focused tests, sample generator/fixtures, and directly affected documentation.

Do not change:

- `OralExamSummary.snapshotData` authority;
- scoring/version rules;
- evaluator ordering or Chairman/Member authority;
- routes or ADMIN authorization;
- digital-signature policy;
- Dean authority/source;
- GS-006/GS-007 behavior;
- defense workflow/session semantics;
- database schema.

### Acceptance gate

Before closing FIX-1:

1. focused tests cover Title omission and Proposal/Final preservation;
2. generate/rasterize representative Title, Proposal, and Final GS-011 outputs;
3. visually verify that Title contains no Adviser concurrence block and Proposal/Final still do;
4. verify the Dean `Attested` area remains intact;
5. run relevant GS-011/official-document regressions and backend build;
6. project-owner visual QA accepts the Title output.
