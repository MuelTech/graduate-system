# TEMPLATE-2: Oral Examination Summary Sheet

Status: **ACCEPTED / PUBLISHED** (2026-10-22).
Starting implementation HEAD: `84002a713e3c9a0342e6414e662793fcfa0308ed`.
Accepted remote HEAD: `5ffd5d5e03524ce12f0f65b0629e97d66e264b1d`.

`renderOralExamSummary(input): Promise<Uint8Array>` reconstructs
**EARIST-QSF-GS-011 Rev. 01 (06.20.25)** as one A4 portrait page using `pdf-lib`.
It returns bytes without application bootstrap, filesystem access, database/repository reads,
HTTP/authorization concerns, attempt selection, scoring, verdicts, or signature retrieval.

The reference photograph was visually inspected at
`backend/.temp/official-form-inputs/template-2/gs-011-oral-examination-summary.jpg`.
It is never embedded. Only the two existing production logos are embedded as raster images.

## Explicit render contract

`OralExamSummaryRenderInput` supplies:

- both logo images as bytes and MIME types;
- explicit `stage` (`title`, `proposal`, or `final`) for stage-specific signatory layout;
- candidate name, Course display value, date, and student number;
- up to **six** examiner rows, each with `examinerName`, `groupARating`,
  `groupBRating`, and `average` strings, in caller-supplied order;
- an independent `submittedBy` block with `chairmanName` and up to **five**
  `memberNames`;
- explicit `adviserName` and `deanName` display values.

These capacities are physical slots observed in the reference, not committee membership
or evaluator-authority rules. Missing rows/names stay blank. No member is fabricated.
Examiner rows and signatory names are independent: the renderer never derives one from the other.
There is no signature-image input and no new GS-011 signature policy.

`stage` is a layout discriminator, not an adviser-data fallback. Title Defense has no
Adviser seat, so the renderer rejects a non-blank `adviserName` at `title` and omits the
entire Adviser concurrence block. Proposal/Final render the block from the caller-supplied
exact-schedule Adviser name; their missing/ambiguous seat rules remain in the service source.

Ratings and Average are display-ready strings. They are not converted, rounded, calculated,
validated against a scoring scale, or used to infer a verdict.
Course is displayed as supplied; no specialization is appended. The normal QA example uses `MAEd`.

## Layout and shared helpers

The accepted shared modules are reused **without changes**:

- `pdf-layout.ts`: A4 geometry and rules;
- `pdf-text.ts`: bounded measurement, wrapping, fitting, and explicit overflow errors;
- `institutional-header.ts`: two-logo masthead, including its existing image-containment helper.

GS-011 has its own table geometry and signatory layout. The shared masthead is translated
18 pt down on this page; TEMPLATE-1 output is unaffected.
The printed table always contains six body rows and four columns.
The Submitted by block retains one Chairman and five Member lines.
Proposal/Final retain the Adviser concurrence block and Dean attestation in their printed
lower-page areas. Title omits the Adviser block entirely and places the Dean attestation
in that freed region; no empty Adviser rule or label remains.
The form-code/revision footer is omitted from generated PDFs at the project owner's request.

Normal identity values occupy compact inline baselines just above their rules.
Only fields requiring a second line reserve extra height; table/Submitted by/Adviser
positions then shift together by at most 24 pt. The Proposal/Final Dean position remains
fixed; the Title Dean block moves with the identity shift into the freed Adviser region.
Names and values are measured, wrapped, and reduced within bounded sizes (body values down to 8 pt).
Table text is vertically centered and padded from borders; signatory names end near their rules.
Content that cannot fit throws a field-specific error instead of truncating, clipping,
or adding an unapproved page. More than six examiner rows or five Member names throws a `RangeError`.

Standard PDF Times and Helvetica fonts follow the reference's serif header/title and
sans-serif body. Their WinAnsi character set supports common Latin names, including
accented Latin letters; unsupported scripts fail explicitly and would need a later font decision.

## Development samples

From `backend/`:

```powershell
npm run forms:sample:summary
npm run forms:sample:summary -- --rasterize
npm test -- tests/unit/documents/official-defense/oral-exam-summary.renderer.test.ts tests/unit/documents/official-defense/oral-exam-criteria.renderer.test.ts
npm run build
```

Optional `--rasterize` uses local Poppler `pdftoppm` at 150 dpi.
Set `PDFTOPPM_PATH` to the executable path when needed.
Poppler is development QA tooling, not production infrastructure.
The script reads only the existing production logos and does not depend on local reference inputs.

Ignored outputs under `backend/.tmp/official-form-samples/`:

| Variant | PDF | Raster |
| --- | --- | --- |
| Blank (Proposal layout) | `oral-exam-summary-blank.pdf` | `oral-exam-summary-blank.png` |
| Title Defense | `oral-exam-summary-title.pdf` | `oral-exam-summary-title.png` |
| Filled (Proposal layout) | `oral-exam-summary.pdf` | `oral-exam-summary.png` |
| Final Defense | `oral-exam-summary-final.pdf` | `oral-exam-summary-final.png` |
| Long values | `oral-exam-summary-long.pdf` | `oral-exam-summary-long.png` |

The Title and Final variants share the filled fictitious values but use their stage layout:
Title omits the Adviser block and keeps Dean attestation; Final keeps both Adviser and Dean.
The filled fictitious example has five examiner rows and four Member names, leaving unused
printed slots blank. The stress example exercises all six rows, all five Member lines,
long candidate/course/student identifiers, and long signatory names.
Dummy ratings are supplied independently. No academic rule is established by the examples.
PDF metadata dates are fixed at the Unix epoch for reproducible bytes.

## Visual QA and checks (2026-10-22)

Two complete PDF-generation/raster-review passes inspected blank, filled, and long-value variants
against the actual photograph:

1. Verified header placement, four table columns, six body rows, one Chairman/five Member lines,
   concurrence/attestation areas, footer, and overall vertical balance. Identified low table-text
   placement and insufficient clearance beside full-width signatory names.
2. Centered cell text vertically and inset signatory names from rule endpoints; regenerated
   and visually inspected all three variants. No clipping, overlap, or footer loss was observed.
   Long identity fields wrap safely, all supplied names remain visible, unused rows stay blank,
   and intentional lower-page whitespace remains.

Eight TEMPLATE-2 tests and all nine existing TEMPLATE-1 tests pass. Tests cover deterministic valid
one-page A4 bytes, institutional labels and requested footer omission, unchanged explicit values and input, no inferred signers
or averages/verdicts, six-row capacity, blank slots, inline/signatory baseline proximity,
long-value page/cell bounds, explicit overflow failure, and the production import boundary.
The backend TypeScript build passes. No new dependencies or production assets were added.

Remaining fidelity limits: exact original typefaces and millimeter measurements cannot be
established from the perspective photograph. Clean vector borders replace skew/noise/shadows,
and the supplied logos retain their original colors rather than the photocopy's monochrome.
Fine logo lettering remains limited by the existing 141/207 px originals (see the asset README).
No photograph background, hole marks, or full-page scan artifacts are reproduced.

TEMPLATE-1 source, shared helpers, script/tests, and retained filled PDF/PNG were verified unchanged.
Project-owner visual acceptance was granted on 2026-10-22. TEMPLATE-2 is closed as the accepted GS-011 static renderer baseline. TEMPLATE-3 may proceed as the next bounded static-template package; GS-IS integration remains deferred.

## Project-owner footer refinement

The project owner requested removal of the visible `EARIST-QSF-GS-011 Rev. 01 (06.20.25)`
footer. Only that drawn text was removed; all field, table, and signatory positions are retained.
The reference identity remains documented above. Blank, filled, and long-value samples were regenerated and reviewed. This footer omission is part of the project-owner-accepted TEMPLATE-2 output.


## Acceptance record

Project-owner visual acceptance was granted on 2026-10-22 after the final GS-011 refinements.

Published implementation:

- `5ffd5d5e03524ce12f0f65b0629e97d66e264b1d` — `feat(documents): add oral examination summary sheet renderer`

Accepted points:

- six examiner slots and one Chairman/five Member lines follow the reviewed printed structure;
- explicit ratings/Average and signatory display values remain caller-supplied;
- no score calculation, verdict inference, committee fabrication, or signature inference is introduced;
- normal filled QA uses `Course: MAEd`;
- long values remain bounded and fail explicitly when they cannot fit;
- the visible `EARIST-QSF-GS-011 Rev. 01 (06.20.25)` footer is intentionally omitted from generated output per project-owner instruction;
- blank, filled, and long-value samples were visually reviewed with no observed clipping or overlap;
- eight TEMPLATE-2 tests, nine TEMPLATE-1 tests, and backend build passed.

TEMPLATE-2 is accepted and closed. TEMPLATE-3 / GS-006 + GS-007 is the next authorized static-template package.

## FORM-INT-2 FIX-1 — Title Adviser-block omission (2026-10-24)

The GS-011 integration source already resolved no Adviser for Title Defense, but the accepted
static renderer still drew the fixed Adviser concurrence block. Project-owner QA required the
entire block to be omitted for Title.

Implemented:

- `OralExamSummaryRenderInput.stage` is now required (`title` / `proposal` / `final`);
- rendering a `title` input with a non-blank `adviserName` fails explicitly;
- `title` output omits `Concurred In:`, the Adviser name/signature rule, and
  `Thesis/Dissertation Adviser`;
- `title` moves the unchanged Dean `Attested:` block into the freed lower-page region instead
  of leaving an intentional-looking empty gap;
- `proposal` and `final` retain the Adviser block, exact-schedule Adviser name, and the
  previously accepted lower-page geometry;
- evaluator rows, Submitted by lines, identity fields, and one-page A4 geometry are unchanged.

Verification performed in this package: focused renderer and summary-service tests, canonical
document regressions, TypeScript build, and raster inspection of Title/Proposal/Final samples.
Project-owner visual acceptance is still pending; this section records implementation, not
acceptance of the integration package.
