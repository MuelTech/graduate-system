# TEMPLATE-3: Defense Application (GS-006 / GS-007)

Status: **TEMPLATE-3 FIX-1 ACCEPTED / MERGED** (2026-10-22).
Merged to `main` via PR #37.
Starting implementation HEAD: `8ddb390980cd8537c30014c4e90c8dc0cb2d794d`.
Accepted remote HEAD: `959233de1d9be7209a3792702fb392056b605613`.
FIX-1 implementation branch: `fix/defense-application-committee-layout`.
FIX-1 starting HEAD: `5d906730fce9f0430def864722a6230f21cec60b`.

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
- explicit committee display values: optional `adviserName` for both programs,
  bounded `panelistNames` in printed row order, `facilitatorName`, and `rapporteurName`;
- explicit `deanName`, `vicePresidentName`, and `presidentName`.

Empty strings and absent Panelist names leave printed slots blank.
No missing identity is fabricated. After TEMPLATE-3 FIX-1, allowed printed Panelist-name capacity is stage-specific: GS-006 Title 5, GS-006 Proposal/Final 4, GS-007 Title 6, and GS-007 Proposal/Final 5. These are display slots; the first supplied name may represent the authoritative Chairman while retaining the printed `Panelist` label. The renderer never infers which supplied name is Chairman and preserves the caller's order.

`adviserName` is printed only for Proposal/Final. A nonblank value at Title or null is rejected explicitly rather than silently discarded. For `applicationType: null`, the renderer uses the program's maximum blank Panelist capacity (5 Master's / 6 Doctoral) and no Adviser row; this is a neutral blank-form layout, not a Title inference, and no stage marker is printed.
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
The schedule block uses two bounded lines: Date of Defense and Time on the first line, and a
full-width Link/Venue line beneath it. `defenseLink` is always the exact supplied display text;
ordinary physical venues and meeting URLs may wrap onto multiple lines inside that measured
area. Nothing is ellipsized, truncated, URL-rewritten, or continued onto another page, and
truly excessive content still raises an explicit `RangeError` instead of clipping.

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
| Master's blank/null | `defense-application-gs006-blank.pdf` | `defense-application-gs006-blank.png` |
| Master's Title | `defense-application-gs006-title.pdf` | `defense-application-gs006-title.png` |
| Master's Title long | `defense-application-gs006-title-long.pdf` | `defense-application-gs006-title-long.png` |
| Master's Proposal | `defense-application-gs006-proposal.pdf` | `defense-application-gs006-proposal.png` |
| Master's Final long | `defense-application-gs006-final-long.pdf` | `defense-application-gs006-final-long.png` |
| Doctoral blank/null | `defense-application-gs007-blank.pdf` | `defense-application-gs007-blank.png` |
| Doctoral Title | `defense-application-gs007-title.pdf` | `defense-application-gs007-title.png` |
| Doctoral Title long | `defense-application-gs007-title-long.pdf` | `defense-application-gs007-title-long.png` |
| Doctoral Proposal | `defense-application-gs007-proposal.pdf` | `defense-application-gs007-proposal.png` |
| Doctoral Final long | `defense-application-gs007-final-long.pdf` | `defense-application-gs007-final-long.png` |

Filled examples use `MAEd` / `EdD` with fictitious identities. The Title samples exercise
five Master's / six Doctoral printed Panelist rows without an Adviser. The Proposal samples
and Final long samples exercise Adviser + four Master's / five Doctoral printed Panelist rows.
Normal samples show a realistic physical venue, the Master's Proposal sample uses a Google Meet
URL, the Doctoral Proposal sample uses a long Teams-style URL, and long samples use an extended
physical venue; all are fictitious QA values.
Long-value stress variants supply full printed capacities and long course, email, O.R.,
schedule, committee, and approval-name values. Facilitator and Rapporteur remain separate
identities. None of the dummy values defines an academic, payment, or signature rule.

## TEMPLATE-3 FIX-1 visual QA checkpoint (2026-10-22)

All ten PDFs were generated and rasterized at 150 dpi, then inspected for the four required
stage/program structures plus long and blank variants:

- **Master's Title:** five printed `Panelist` rows, no Adviser, Facilitator, Rapporteur.
- **Master's Proposal/Final:** Adviser, four printed `Panelist` rows, Facilitator, Rapporteur.
- **Doctoral Title:** six printed `Panelist` rows, no Adviser, Facilitator, Rapporteur.
- **Doctoral Proposal/Final:** Adviser, five printed `Panelist` rows, Facilitator, Rapporteur.

No dedicated Chairman label is printed. Supplied names remain in caller order; the first
printed Panelist name may later come from the authoritative Chairman assignment. The total
printed committee rows remain 7 for Master's and 8 for Doctoral at every stage, so the
lower-page Prepared by / approval blocks and footer did not require geometry changes.

The corrected samples remain one-page A4 with no observed clipping or text/line overlap.
Footer clearance and all signatory blocks remain intact. The blank/null samples use the
neutral maximum blank layout and print no stage marker or Adviser row.

Thirty-nine TEMPLATE-3 tests pass, plus all eight TEMPLATE-2 and nine TEMPLATE-1 tests (56 total).
Coverage includes deterministic valid one-page A4 bytes for all six stage/program combinations,
stage-specific Adviser visibility and printed Panelist capacity, no Chairman label, no role
inference from supplied names, blank and excessive slots, literal fee text, exact form codes,
long-value bounds, overflow rejection, null behavior, and the production import boundary.
`npm run forms:check`, the backend TypeScript build, and `git diff --check` pass.

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

FORM-DX-1 is complete at `299ca18a89e8fae54785326935fce966995302d8`. TEMPLATE-3 FIX-1 was independently reviewed, accepted at `03cbc80c92b7a9cf538b82b96b920cb373f81a94`, and merged to `main` via PR #38 at `48e7e02f546de894d9591b0e4a271b9629f1bdbd`.

The renderer is now ready for the separate FORM-INT-0 integration readiness audit. Do not bypass that audit by wiring production routes/UI directly.


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

The published renderer remains the accepted visual baseline. FORM-DX-1 is complete at `299ca18a89e8fae54785326935fce966995302d8`. TEMPLATE-3 FIX-1 applies the project-owner-confirmed stage-specific committee capacity and Adviser visibility described below and is now accepted/merged.

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

This bounded renderer/layout correction was independently reviewed and merged to `main` via PR #38. Production integration now proceeds only through the separate FORM-INT-0 readiness audit and later bounded integration packages.

## FORM-INT-3 FIX-1 — schedule Link/Venue capacity (2026-10-22)

Production integration exposed that the original single-line Link box was too narrow for
authoritative `venueOrLink` values (`Room 101, GS Building` already failed). The schedule block
now renders Date of Defense and Time on the first line and Link/Venue on a measured full-width
second line. Long physical venues and meeting URLs wrap inside that bounded row; committee,
approval, and footer geometry shift only as needed and remain one-page A4.

The exact supplied text is preserved: no truncation, ellipsis, abbreviation, URL rewriting, or
domain mutation. A value that cannot fit the bounded row still fails explicitly with
`RangeError`. Regression coverage includes realistic physical venues, Google Meet and long
Teams-style URLs, geometry/bounds checks, unchanged GS-006/GS-007 committee structures, and the
deliberate over-capacity failure.
