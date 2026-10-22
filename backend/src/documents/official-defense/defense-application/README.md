# TEMPLATE-3: Defense Application (GS-006 / GS-007)

Status: **ACCEPTED VISUAL BASELINE / PUBLISHED — TEMPLATE-3 FIX-1 REQUIRED BEFORE INTEGRATION** (2026-10-22).
Merged to `main` via PR #37.
Starting implementation HEAD: `8ddb390980cd8537c30014c4e90c8dc0cb2d794d`.
Accepted remote HEAD: `959233de1d9be7209a3792702fb392056b605613`.

`renderDefenseApplication(input): Promise<Uint8Array>` draws one A4 portrait PDF using
`pdf-lib`. One discriminated input and one renderer implement this bounded form family.
There is no application bootstrap, filesystem/network access, database/repository lookup,
HTTP/auth concern, workflow/eligibility decision, payment verification, signature retrieval,
or latest-record fallback.

Both actual reference photographs were inspected before authoring:

- `backend/.temp/official-form-inputs/template-3/gs-006-masters-defense-application.jpg`
- `backend/.temp/official-form-inputs/template-3/gs-007-doctoral-defense-application.jpg`

Photographs are never embedded. Only the existing clean production logo JPEGs are embedded.

## Controlled institutional variants

| Printed detail | Master's GS-006 | Doctoral GS-007 |
| --- | --- | --- |
| Program heading | `MASTERS PROGRAM` | `DOCTORAL PROGRAM` |
| Printed detail | Master's GS-006 | Doctoral GS-007 |
| --- | --- | --- |
| Adviser slots | Title: none; Proposal/Final: 1 | Title: none; Proposal/Final: 1 |
| Printed `Panelist` rows — Title | **5** = Chairman + 4 Panelists | **6** = Chairman + 5 Panelists |
| Printed `Panelist` rows — Proposal/Final | **4** = Chairman + 3 Panelists | **5** = Chairman + 4 Panelists |
| Facilitator slots | 1 | 1 |
| Rapporteur slots | 1 | 1 |
| Session total | **7** at every stage | **8** at every stage |
| Printed Chairman label | None; Chairman is displayed under a `Panelist` row | None; Chairman is displayed under a `Panelist` row |
| Masthead/application section | Lower placement | 14 pt higher, following the photograph |
| Approval blocks | More vertical separation | More compact arrangement |
| Footer | `EARIST-QSF-GS-006 Rev. 01 (06.20.25)` | `EARIST-QSF-GS-007 Rev. 01 (06.20.25)` |

The printed labels are presentation only and do not change GS-IS committee membership or evaluator authority. The `CHAIRMAN` remains Chairman in system data, but because neither GS-006 nor GS-007 prints a dedicated Chairman label, the Chairman is rendered into a row labelled `Panelist`. Later integration must supply the printed Panelist names in deterministic order: Chairman first, then actual Panelists. The renderer must not infer roles from unordered data.

The generated form follows the centralized stage/program committee policy used by Admin scheduling. Master's Title has no Adviser and prints five `Panelist` rows for Chairman + four Panelists; Master's Proposal/Final includes the active Adviser and prints four `Panelist` rows for Chairman + three Panelists. Doctoral Title has no Adviser and prints six `Panelist` rows for Chairman + five Panelists; Doctoral Proposal/Final includes the active Adviser and prints five `Panelist` rows for Chairman + four Panelists. These rules supersede the original photographed-row interpretation where it conflicts with the current GS-IS policy.

Both photographs have the same printed fee table: Proposal and Final columns each show
`300` for Defense Fee, Administrative and Technical Fee, and Energy and Venue Fee, followed
by `P 900.00`. These are literal printed strings, not calculated fees or an amount-paid rule.
The total row's first cell remains blank as photographed; no new Total label is added.
The unlabelled right committee column stays blank for the printed signing area.

## Explicit typed input

`DefenseApplicationRenderInput` uses `variant: "masters" | "doctoral"` and contains only:

- logo bytes/MIME types;
- `applicationType: "title" | "proposal" | "final" | null`;
- `studentName`, `courseAndMajor`, `studentNumber`, `cellphoneNumber`;
- upper `applicantDateAndTime`, independent of the lower defense schedule fields;
- `amountPaid`, `officialReceiptNumber`, `dateOfApplication`, `personalGmail`;
- `defenseDate`, `defenseTime`, `defenseLink`;
- explicit committee display values: Master's `adviserName`, bounded `panelistNames`
  in physical row order, `facilitatorName`, and `rapporteurName`;
- explicit `deanName`, `vicePresidentName`, and `presidentName`.

Empty strings and absent Panelist names leave printed slots blank.
No missing identity is fabricated. After TEMPLATE-3 FIX-1, allowed printed Panelist-name capacity is stage-specific: GS-006 Title 5, GS-006 Proposal/Final 4, GS-007 Title 6, and GS-007 Proposal/Final 5. These are display slots; the first supplied name may represent the authoritative Chairman while retaining the printed `Panelist` label.
All dates, amounts, O.R. identifiers, contact values, and schedule values are rendered as supplied.
There is no O.R./Gmail validation, course specialization inference, approval state, scoring,
payment-state determination, signature image, or automatic signing.

Selection marks only the explicit input. `QA_APPLICATION_MARKER` isolates the current dummy
`X`; neither blank reference establishes an official X/check/circle convention.
The marker is presentation only and can be changed after institutional confirmation.

## Layout and bounded text

Accepted helpers are reused without modifying them:

- `pdf-layout.ts`: A4, rules, and image containment used by the masthead;
- `pdf-text.ts`: measured wrapping, bounded font reduction, and field-specific overflow errors;
- `institutional-header.ts`: accepted two-logo institutional masthead.

Variant-specific placement is applied with a page graphics translation, leaving accepted
TEMPLATE-1/TEMPLATE-2 outputs unchanged. The nearest Doctoral logo box is 22 pt from the top;
Master's is 36 pt. Footer text has more than 36 pt of bottom clearance.

Identity fields first try 12 pt single-line boxes at 10-8 pt text sizes. Genuine wrapping gets
a bounded 20 pt region, up to 24 pt of additional space across the identity section. The
table and Prepared by position follow this extra height; approval spacing remains bounded.
Excess individual or combined content throws a field-specific `RangeError`.
Table geometry always retains every printed row. Committee names fit one bounded line above
their rule; captions remain below it. Approval names have a bounded two-line region.
Schedule cells have their own bounded widths. Nothing is ellipsized, silently truncated,
allowed to overlap, or continued onto another page.

The measured static selection line is drawn with intentional spaces preserved inside its
parentheses; the shared wrapping helper normally normalizes repeated whitespace.
No shared helper was changed for this form-specific presentation.

Standard PDF Times and Helvetica follow the reference's serif heading and sans-serif body.
WinAnsi supports common Latin names, including accented Latin letters; unsupported scripts
fail explicitly and would need a separately approved embedded-font decision.

## Development samples

From `backend/`:

```powershell
npm run forms:sample:application
npm run forms:sample:application -- --rasterize
npm test -- tests/unit/documents/official-defense/defense-application.renderer.test.ts tests/unit/documents/official-defense/oral-exam-summary.renderer.test.ts tests/unit/documents/official-defense/oral-exam-criteria.renderer.test.ts
npm run build
```

Optional `--rasterize` invokes local Poppler `pdftoppm` at 150 dpi; set `PDFTOPPM_PATH`
if it is not on PATH. Poppler is development QA tooling only.
The script reads production logos without reference photographs or application bootstrap.
Metadata dates are fixed at the Unix epoch for reproducible PDF bytes.

Ignored outputs under `backend/.tmp/official-form-samples/`:

| Variant | PDF | PNG |
| --- | --- | --- |
| Master's blank | `defense-application-gs006-blank.pdf` | `defense-application-gs006-blank.png` |
| Master's filled | `defense-application-gs006.pdf` | `defense-application-gs006.png` |
| Master's long | `defense-application-gs006-long.pdf` | `defense-application-gs006-long.png` |
| Doctoral blank | `defense-application-gs007-blank.pdf` | `defense-application-gs007-blank.png` |
| Doctoral filled | `defense-application-gs007.pdf` | `defense-application-gs007.png` |
| Doctoral long | `defense-application-gs007-long.pdf` | `defense-application-gs007-long.png` |

Filled examples use `MAEd` / `EdD` with fictitious identities. The Doctoral filled example
leaves two Panelist slots blank; its long-value stress example explicitly supplies six
distinct fictitious Panelist identities. Facilitator/Rapporteur remain separate identities.
The stress examples use long course, email, O.R., schedule, committee, and approval-name values.
None of the dummy values defines an academic, payment, or signature rule.

## Visual QA checkpoint (2026-10-22)

Three PDF-generation/raster-review passes inspected all six variants against the photographs:

1. Checked printed text, fees, fixed committee capacity, table proportions, identity rules,
   approval blocks, and footer. Found an X placement issue caused by normalized spaces,
   a tight Doctoral heading gap, and insufficient footer bottom clearance.
2. Preserved measured selection spaces, placed the marker within the correct parentheses,
   raised the Doctoral masthead/application section, and moved both footers upward.
   Reviewed every variant; the normal email still reserved an unnecessary second line.
3. Rebalanced only the Email label/value widths, regenerated all six PDFs/PNGs, and inspected
   them again. Normal fields are compact; long course/email/approval names remain bounded.
   No clipping, text/line overlap, or missing footer was observed. Printed committee signing
   lines, unused slots, and lower-page whitespace are preserved.

Fifteen TEMPLATE-3 tests pass, plus all eight TEMPLATE-2 and nine TEMPLATE-1 tests (32 total).
Coverage includes deterministic valid one-page A4 bytes for both forms, exact labels/codes,
physical slot counts and blank slots, literal fee text independent of payment values, explicit
selection-marker position, unchanged display values, no inferred identities/approval/payment,
long-value bounds, overflow rejection, and the production import boundary.
Backend TypeScript build and `git diff --check` pass.

Accepted TEMPLATE-1/TEMPLATE-2 files, shared helpers, sample scripts/tests, and all retained
PDF/PNG samples were checked against pre-implementation hashes and remain unchanged.
No new assets/dependencies, API/UI, schema, extraction/storage, waiver, scoring, or workflow
changes are included.

Fidelity limits: exact original fonts and millimeter measurements cannot be recovered from
perspective photographs. Standard fonts replace the photographed condensed body typography.
Color logos retain their supplied colors and existing 141/207 px resolution limits. Clean
vector geometry removes paper holes, skew, grain, shadows, and scan artifacts. Footer placement
is slightly higher to retain a safe print margin. No photographed background is embedded.

Project-owner visual acceptance was granted on 2026-10-22. TEMPLATE-3 is accepted and published at `959233de1d9be7209a3792702fb392056b605613`.

FORM-DX-1 is complete at `299ca18a89e8fae54785326935fce966995302d8`. The remaining pre-integration blocker is TEMPLATE-3 FIX-1, which must align the generated committee rows with the centralized stage/program committee policy.

Do not start GS-IS integration or GS Form No. 22 until TEMPLATE-3 FIX-1 is verified.


## Acceptance record

Project-owner visual acceptance was granted on 2026-10-22.

Published implementation:

- `959233de1d9be7209a3792702fb392056b605613` — `feat(documents): add defense application renderers`

Accepted points:

- one controlled `masters` / `doctoral` renderer family;
- GS-006 and GS-007 printed capacities remain documented as layout facts, not committee policy;
- exact confirmed GS-006/GS-007 footers retained;
- explicit caller-supplied application/payment/schedule/committee/approval display values;
- no DB/API/payment verification/signature/workflow inference;
- three visual QA passes over six variants with no observed clipping or overlap;
- fifteen TEMPLATE-3 tests plus existing TEMPLATE-1/TEMPLATE-2 tests, backend build, and diff checks passed;
- accepted TEMPLATE-1/TEMPLATE-2/shared renderer files remained unchanged.

The published renderer remains the accepted visual baseline. FORM-DX-1 is complete at `299ca18a89e8fae54785326935fce966995302d8`. Before GS-IS integration, TEMPLATE-3 FIX-1 must align GS-006 committee capacity and defense-type Adviser visibility with the project-owner-confirmed generated-form rule.

## TEMPLATE-3 FIX-1 clarification (2026-10-22)

The project owner clarified that the generated Defense Application must follow the actual Admin/backend committee policy rather than preserve the photographed committee-row count when the two differ.

Authoritative generated-form behavior:

- `CHAIRMAN` remains Chairman in GS-IS but is displayed under the form's printed `Panelist` label;
- GS-006 Master's Title: no Adviser + 5 printed Panelist rows = Chairman + 4 Panelists + Facilitator + Rapporteur = 7 participants;
- GS-006 Master's Proposal/Final: Adviser + 4 printed Panelist rows = Chairman + 3 Panelists + Facilitator + Rapporteur = 7 participants;
- GS-007 Doctoral Title: no Adviser + 6 printed Panelist rows = Chairman + 5 Panelists + Facilitator + Rapporteur = 8 participants;
- GS-007 Doctoral Proposal/Final: Adviser + 5 printed Panelist rows = Chairman + 4 Panelists + Facilitator + Rapporteur = 8 participants;
- no dedicated printed Chairman label is introduced;
- renderer presentation must not mutate or reinterpret stored committee roles;
- the centralized `DefenseCommitteePolicy` remains the participant-count authority.

This is a bounded renderer/layout correction. It must be completed and visually verified before authoritative GS-IS mapping or Download / Print integration begins.
