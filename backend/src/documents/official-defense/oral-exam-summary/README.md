# TEMPLATE-2: Oral Examination Summary Sheet

Status: **IMPLEMENTED — AWAITING PROJECT-OWNER VISUAL REVIEW** (2026-10-22).
Starting local and verified remote HEAD: `84002a713e3c9a0342e6414e662793fcfa0308ed`.

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
Adviser concurrence and Dean attestation retain their printed areas.
The form-code/revision footer is omitted from generated PDFs at the project owner's request.

Normal identity values occupy compact inline baselines just above their rules.
Only fields requiring a second line reserve extra height; table/Submitted by/Adviser
positions then shift together by at most 24 pt. The Dean position remains fixed.
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
| Blank | `oral-exam-summary-blank.pdf` | `oral-exam-summary-blank.png` |
| Filled | `oral-exam-summary.pdf` | `oral-exam-summary.png` |
| Long values | `oral-exam-summary-long.pdf` | `oral-exam-summary-long.png` |

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
This checkpoint does not confer institutional/project-owner acceptance.
Stop for visual review; TEMPLATE-3 and all GS-IS integration remain deferred.

## Project-owner footer refinement

The project owner requested removal of the visible `EARIST-QSF-GS-011 Rev. 01 (06.20.25)`
footer. Only that drawn text was removed; all field, table, and signatory positions are retained.
The reference identity remains documented above. Blank, filled, and long-value samples
are regenerated for review; this request does not confer acceptance of the complete template.
