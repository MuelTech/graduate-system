# TEMPLATE-1: Oral Examination Criteria

Status: implemented for project-owner visual review; **not yet accepted**. No other form or system integration is included.

`renderOralExamCriteria(input): Promise<Uint8Array>` draws one A4 portrait PDF with `pdf-lib`. It imports only `pdf-lib`, its render-input types, and the local layout/header/text helpers. It does not read files, query data, bootstrap the application, inspect authorization, select attempts, or make academic decisions.

`OralExamCriteriaRenderInput` supplies the two logo images, candidate, course, display-ready date, five Group I choices, four Group II choices, both averages, recommendations, rating, remarks, printed evaluator name, and optional signature image bytes. Choices use the six printed matrix values; `null` leaves a row unmarked. All academic values, including averages, are placed exactly as supplied. A signature may be PNG or JPEG; omission reserves the space for wet signing. This contract grants no authority to reuse a signature from another document.

Text is measured, wrapped, and reduced only within bounded font sizes. Excess content throws a field-specific `RangeError` instead of being clipped, truncated, or moved to an unapproved continuation page. Identity fields allow two lines; recommendations allow three ruled lines; rating/remarks and the printed name have bounded regions. Standard PDF Times and Helvetica fonts match the reference's serif masthead and sans-serif body without additional runtime dependencies. Their WinAnsi character set supports common Latin names (including accented Latin letters); other scripts require a future embedded-font decision.

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

Project-owner visual approval is still required. TEMPLATE-2 and all data/API/UI/workflow integration remain deferred.
