# TEMPLATE-1: Oral Examination Criteria

Status: **ACCEPTED / PUBLISHED** on 2026-10-22. Accepted remote HEAD: `9e76390623739dbb9ec0e609baf6c78880d6edce`. No system integration is included.

`renderOralExamCriteria(input): Promise<Uint8Array>` draws one A4 portrait PDF with `pdf-lib`. It imports only `pdf-lib`, its render-input types, and the local layout/header/text helpers. It does not read files, query data, bootstrap the application, inspect authorization, select attempts, or make academic decisions.

`OralExamCriteriaRenderInput` supplies the two logo images, candidate, course, display-ready date, five Group I choices, four Group II choices, both averages, recommendations, rating, remarks, printed evaluator name, and optional signature image bytes. Choices use the six printed matrix values; `null` leaves a row unmarked. All academic values, including averages, are placed exactly as supplied. A signature may be PNG or JPEG; omission reserves the space for wet signing. This contract grants no authority to reuse a signature from another document.

Text is measured, wrapped, and reduced only within bounded font sizes. Excess content throws a field-specific `RangeError` instead of being clipped, truncated, or moved to an unapproved continuation page. Identity fields first fit one compact inline line and allow a second line only when necessary; recommendations allow three ruled lines; rating/remarks and the printed name have bounded regions. Standard PDF Times and Helvetica fonts match the reference's serif masthead and sans-serif body without additional runtime dependencies. Their WinAnsi character set supports common Latin names (including accented Latin letters); other scripts require a future embedded-font decision.

The supplied reference form is blank and does **not** confirm an official selected-rating symbol. `QA_SELECTED_RATING_MARKER` currently holds `X` solely as an unconfirmed dummy visual marker for QA. It is isolated in the renderer for later replacement after confirmation. The selected criterion value remains the authoritative input; changing the glyph does not change any score, average, or academic rule. No checkmark convention is assumed.

## Development samples

From `backend/`:

```powershell
npm run forms:sample:criteria
npm run forms:sample:criteria -- --rasterize
npm test -- tests/unit/documents/official-defense/oral-exam-criteria.renderer.test.ts
npm run build
```

`--rasterize` calls local Poppler `pdftoppm` at 150 dpi. It is optional development tooling, never a production dependency. Set `PDFTOPPM_PATH` to its executable path if it is absent from `PATH`.

Generated files are ignored by `backend/.gitignore` under `.tmp/official-form-samples/`:

- `oral-exam-criteria.pdf` / `.png`: filled fictitious example;
- `oral-exam-criteria-blank.pdf` / `.png`: institutional layout for comparison;
- `oral-exam-criteria-long.pdf` / `.png`: long fictitious identity and free-text values.

The script loads only the two clean production logos from `backend/assets/official-forms/`. It has no dependency on the local-only reference photograph or `.temp/` inputs. PDF metadata dates are fixed at the Unix epoch for reproducible bytes; the printed examination date comes exclusively from the input.

## Visual QA checkpoint (2026-10-22)

The actual reference photograph and both logo images were inspected before authoring. Enlarged table and lower-summary crops were inspected locally. Three generation/raster-review passes checked blank, filled, and long-value samples:

1. The first pass exposed `pdf-lib`'s default black rectangle fills hiding both tables. Explicit border-only drawing corrected this; PDF text/geometry checks alone had passed.
2. The second pass confirmed readable tables, matrix marks, column widths, identity wrapping, averages, and lower-section placement.
3. The final refinement restored the summary-band column divider, aligned recommendation line spacing to the writing rules, and shortened/raised the signature line to better match the reference. The final samples were regenerated and inspected.

The clean reconstruction deliberately removes skew, noise, shadows, hole marks, and mottled photocopy shading. Summary bands use uniform dark/light gray with readable text. The supplied logos retain their original colors, whereas the photographed sheet is monochrome. Table values are consistently printed to two decimal places as requested (`1.00`, `2.00`, `2.50`), while the photograph abbreviates some trailing zeros. Font family/size and physical measurements are reconstructed from a perspective photograph, so exact original typefaces and millimeter geometry cannot be verified. The reference has no confirmed form code/revision and none is added.

Project-owner visual approval was granted on 2026-10-22. TEMPLATE-2 may proceed as the next bounded static-template package; all data/API/UI/workflow integration remains deferred.

## Bounded spacing/marker refinement (2026-10-22)

Starting checkout: `feat/official-defense-document-forms` at `d06e7967f2212bd86a2a869e4ed1dcfd90c498db`. This pass changes only TEMPLATE-1 visual presentation and related checks/documentation; it does not confer visual acceptance.

- Identity values are bottom-aligned in measured 12 pt single-line boxes, with each rule 1 pt below the text box (about 3 pt below the text baseline), replacing the unconditional 25 pt reserve. Candidate/Course widths are rebalanced from 149/95 pt to 116/139 pt so the normal full program example fits inline. Each field reserves 24 pt only if one-line fitting down to 8 pt is insufficient. Explicit values are retained without truncation.
- Group I and the following body content move upward together by the recovered height, preserving their internal spacing. The normal/blank table starts at 217 pt from the page top instead of 230 pt; the two-line long sample starts at 229 pt. This avoids creating a new gap between the tables.
- The signature rule remains 749 pt from the page top and its caption remains at 753 pt. The evaluator name is bottom-aligned to end immediately above that rule, retaining two-line support. An optional image fits in a 140 x 23 pt box ending 3 pt above the actual name text, so it follows the name's measured height. The intentional lower-page whitespace remains.
- The existing `X` is unchanged visually and explicitly documented as an unconfirmed QA glyph in the renderer, sample script, and test. Tests verify placement from selected values without defining an institutional symbol rule.
- Blank, filled, and long-value PDFs/PNGs were regenerated and compared with the same reference. Compact identity baselines, safe long-value wrapping, lower-page whitespace, and name/rule/caption spacing were visually checked; no clipping or overlap was observed. Eight focused tests and the backend build pass, including new checks for inline baseline proximity, conditional wrapping, signature-name proximity, and dummy-marker column placement.

This refinement was accepted and published. The accepted TEMPLATE-1 publication ends at `9e76390623739dbb9ec0e609baf6c78880d6edce`.

### Identity typography follow-up

After comparison with the local institutional reference, normal Candidate/Course/Date values and labels use 12 pt Helvetica (previously 9.5-10 pt values and 11 pt labels). Labels share the values' underline baseline. Candidate text retains its 116 pt region; Course retains a short underline for `MAEd` and a 116 pt text region; Date receives a 90 pt text region so `22 October 2026` fits at 12 pt. Horizontal label positions accommodate the larger lettering with a gap between neighboring fields, including wrapped long values. The one-line/two-line height policy, table typography, signature block, and lower-page whitespace are unchanged. Long stress-test inputs can still wrap or reduce within the existing bounds. The filled sample uses only the supplied abbreviation `MAEd`; no specialization is appended.


## Acceptance record

Project-owner visual acceptance was granted on 2026-10-22 after review of the final regenerated output.

Published commits:

- `d06e7967f2212bd86a2a869e4ed1dcfd90c498db` — initial TEMPLATE-1 renderer package
- `9e76390623739dbb9ec0e609baf6c78880d6edce` — final layout/sample refinements

Accepted points:

- Candidate, Course, and Date fields use the compact inline treatment;
- the normal filled sample uses `Course: MAEd`;
- long values remain bounded/wrappable without silent truncation;
- evaluator printed name, optional signature area, rule, and caption form a compact unit while preserving the reference's lower-page whitespace;
- the selected-cell `X` remains an unconfirmed QA glyph only and does not define institutional scoring policy;
- blank, filled, and long-value samples were visually reviewed with no observed clipping or overlap;
- focused renderer tests and backend build passed.

TEMPLATE-1 is closed as the accepted static renderer baseline. TEMPLATE-2 / GS-011 is the next authorized static-template package.
