# CDW-5 — Rapporteur Rich-Text Committee Report Authoring Foundation

Branch: `refactor/collaborative-defense-workspace`. This is the authoring
foundation, NOT the official-form/PDF phase and NOT RAP-C1.

## Decisions (approved)
1. The assigned Rapporteur's first save get-or-creates an editable DRAFT
   `RapReport` (status DRAFT, no signature slots). The legacy conclusion-time RAP
   path FAILS CLOSED when the attempt already owns a non-finalized report (a
   DRAFT / awaiting-signature report may not be concluded); only an existing
   FINALIZED report is safely reused. Freeze / signing / status transitions remain
   RAP-C1.
2. Editor: Tiptap 3.32.0 (`@tiptap/react`, `@tiptap/pm`, `@tiptap/core`,
   `@tiptap/starter-kit`, plus `@tiptap/extension-text-align` for alignment
   PRESERVATION only) configured to exactly the canonical server document model.
   StarterKit bundles underline, so no extra underline extension is needed.
3. Preview Report shows the current local editor state, labelled when it includes
   unsaved changes.

## What was built
- Backend: report read model now returns `reportId` + compact system context
  (`studentNumber`, `program`, `defenseDate`); `canEditBody` is true for the
  assigned Rapporteur when the session is writable and the report is absent or an
  unfrozen DRAFT; `saveReportDraft` creates the DRAFT on first save and applies an
  optional `expectedBodyVersion` CAS (`409 Report changed…` on mismatch). The
  legacy conclusion path rejects an existing non-finalized report and reuses only
  a FINALIZED one.
- Frontend: Tiptap rich-text editor + accessible toolbar (headings 1–3, bold,
  italic, underline, bullet/ordered lists, undo/redo); XSS-safe read-only renderer;
  authoring panel (Save Draft + Preview Report + status) vs read-only committee
  view with a clear empty state; "Insert into Report" copies the FULL comment body
  at the caret (no live binding); report composer bridge so the Shared Comments
  rail can insert into the center-pane editor.

## Not implemented (deferred)
Official GS Form No. 22 / printable forms, PDF generation, print CSS, Individual
Evaluation / Oral Examination Summary printable forms, RAP signatures, RAP-C1,
WebSocket/Socket.IO.

## Migration
NO NEW DATABASE MIGRATION ADDED — CDW-1's `RapReport.bodyDocument` / `bodyVersion`
/ `contentVersion` / freeze/hash fields already support this phase.

## Verification
Backend: `prisma validate`, `npm run build`, full suite 134 files / 1400 passed /
5 skipped. Frontend: 100 verify assertions across the 7 scripts (incl. new
`verify-cdw5-report` 14) + `tsc --noEmit` + scoped eslint + `npm run build`.

## CDW-5 FIX (functional corrections)

1. **Tiptap ⇄ canonical adapter.** Tiptap emits mark OBJECTS
   (`marks: [{ type: "bold" }]`) while the canonical server model stores STRINGS
   (`marks: ["bold"]`). Added `lib/report/tiptap-adapter.ts`
   (`toTiptapDocument` / `fromTiptapDocument`) and made normalization
   mark-object-aware so formatting is never lost across editor → Preview → Save →
   reload. The editor now exchanges canonical documents with the app.
2. **Conclusion safety.** `createRapAfterConclusion` now FAILS CLOSED (409) when
   the attempt already has a non-finalized report (DRAFT / FOR_SIGNATURE /
   PARTIALLY_SIGNED); only FINALIZED is safely reused. Because it runs inside the
   formal-conclusion transaction, the throw aborts the whole conclusion. Freeze /
   signature-slot creation / status transitions remain RAP-C1.
3. **Insert bridge lifecycle.** The "Insert into Report" handler is now registered
   by the editor component and cleared on unmount, so Preview Report (editor
   unmounted) hides Insert into Report and no destroyed editor can receive
   content.
4. **Unsaved status.** The header label is now driven by the local dirty flag
   only (`Draft (unsaved)` vs `Draft`).
5. **Legacy editable draft.** An editable legacy DRAFT with no `bodyDocument` now
   shows the legacy text read-only in the authoring surface; it is never
   converted or overwritten.

NO NEW DATABASE MIGRATION ADDED.

## CDW-5 FINAL functional correction

- **All-stage Title conclusion guard.** The fail-closed check previously lived
  only in `createRapAfterConclusion`, which Title's legacy "conclude while notes
  are draft" path skips. `ThesisRepository.concludeDefense` now loads the exact
  schedule's `RapReport` inside the formal-conclusion transaction and, BEFORE any
  authoritative write, rejects any existing report whose status is not FINALIZED
  (DRAFT / FOR_SIGNATURE / PARTIALLY_SIGNED / any other non-finalized state) with a
  controlled 409. No RapReport at all preserves the current legacy behavior.
  RAP-C1 remains responsible for the real draft → freeze → signatures → FINALIZED
  lifecycle.
- **textAlign preservation.** `toTiptapDocument` previously dropped canonical
  `attrs.textAlign`. The editor now registers `@tiptap/extension-text-align`
  configured for `["heading","paragraph"]` (no alignment toolbar controls), so a
  canonical left/center/right/justify survives canonical → Tiptap → canonical.
- **Verification (final):** backend full suite 134 files / 1404 passed / 5 skipped;
  frontend 118 verify assertions across the 7 scripts (incl. `verify-cdw5-report`
  32) + `tsc --noEmit` + scoped eslint + `npm run build`.

## CDW-5 UI refinement — document-like authoring surface

Presentation-only refinement of the Committee Report experience. No workflow,
document-model, authorization, or persistence change; **no backend/domain code
and no database migration** were touched.

**What changed**

- The Rapporteur editor, Preview Report, and the Chairman/Panelist read-only
  view now share three reusable classes in `report-body.css`:
  `cdwReportWorkspace` (neutral `--earist-surface-gray` work surface),
  `cdwReportCanvas` (centered white document; originally ~800px, later
  calibrated to US Letter — see "Word Layout Fidelity" below), and `cdwReportBody`
  (document typography). `ReportDocumentCanvas` in `report-document-view.tsx`
  is the single shared wrapper.
- Document margins are responsive (reduced proportionally on narrower screens).
  The canvas is `width: 8.5in; max-width: 100%` (US Letter; see below), so narrow
  layouts flow instead of forcing horizontal paper overflow.
- Typography: 16px body, `line-height: 1.7`, restrained heading scale with
  useful before/after spacing, and academic list indentation/spacing (nested
  lists indent distinctly; a list-item's own paragraph no longer doubles the
  paragraph rhythm). The project's existing safe font stack is used — no custom
  fonts.
- Toolbar: unchanged command set (undo/redo, H1–H3, bold/italic/underline,
  bullet/numbered lists) presented as a white control bar over the gray
  workspace. No font/size/line-spacing/table/image/page-break/header/print
  controls were added.
- The workspace scrolls around the centered document; the toolbar and the
  Save Draft / Preview Report footer remain pinned. The legacy report notice
  remains above the document surface and is never converted.

**Editor / Preview / read-only parity:** all three render the body through the
same `cdwReportWorkspace` → `cdwReportCanvas` → `cdwReportBody` classes, so the
authored content reads identically in every mode. Preview remains a content
preview, explicitly not the official institutional form.

**Still deferred (unchanged):** true pagination / fixed page height / page
splitting / page-break separators / print CSS / PDF / GS Form No. 22 /
signatures / RAP-C1 / WebSocket. Exact institutional rendering remains the
future Official Defense Forms / Document Processing phase.

**Verification (UI refinement):** backend files were not modified, so the
backend/domain suite was not re-run. Frontend: 120 assertions across the 7
verify scripts (`verify-cdw5-report` now 34, including 2 new static
presentation contracts) + `npx tsc --noEmit` + scoped `eslint` +
`npm run build` — all clean.

## CDW-5 authoring ergonomics — semantic Tab / Shift+Tab indentation

Adds the missing document-editor keyboard interaction. This is an editor-behavior
change only; the bounded canonical model gained one optional paragraph
attribute. **No database migration.**

**Behavior**

- **Tab inside a list item** → structural list nesting (`sinkListItem`); nothing
  is inserted, and no spaces or literal `\t` characters are stored.
- **Shift+Tab inside a list item** → structural outdent (`liftListItem`).
- **Tab in a normal paragraph** → the paragraph's bounded canonical
  `indentLevel` increases by one (maximum 6).
- **Shift+Tab in a normal paragraph** → decreases by one; at level 0 it does
  nothing (indentation never goes negative).
- Headings are not indentable. If no semantic operation is possible the shortcut
  returns `false`, so Tab keeps its default browser focus behavior — there is no
  unconditional keyboard trap.

**Canonical model**

- Paragraph attrs are a closed set: `textAlign?` and `indentLevel?` only.
- `indentLevel` is an integer 0–6; level 0 is represented by **omission** (never
  stored explicitly). Negatives, decimals, strings, and out-of-range values are
  rejected by the server (`report-body.rules.ts`) and dropped by the frontend
  normalizer.
- `report-body.rules.ts` now also fails closed on any unknown paragraph/heading
  attribute, so no arbitrary `style` / `className` / pixel field can be
  persisted.
- Canonicalization is deterministic (attrs emitted in a fixed `textAlign` →
  `indentLevel` order), so the freeze/hash output is stable and pre-indent
  documents are unchanged.
- No arbitrary style objects are stored: the canonical body stays
  presentation-independent (`indentLevel: 2`, never `marginLeft: "37px"`).

**Tiptap boundary**

- A small local extension (`report-paragraph-indent.ts`) adds the bounded
  `indentLevel` attribute to paragraphs, exposes `increaseReportIndent` /
  `decreaseReportIndent`, and registers Tab / Shift+Tab. It uses a lower
  priority so the built-in list Tab handlers keep precedence, and it delegates
  to the structural list commands for the list case.
- The Tiptap ⇄ canonical adapter round-trips `indentLevel` unchanged (with
  `textAlign` and marks when present), so indentation survives Editor → Save →
  reload.

**Preview / read-only parity**

- The editor renders `data-indent-level` via the extension's `renderHTML`; the
  read-only renderer emits the same attribute. Both are styled by the shared
  `.cdwReportBody p[data-indent-level]` rules, so the Editor, Preview Report, and
  the Chairman/Panelist read-only view indent identically. The step is a CSS
  variable reduced on narrow screens, and `margin-left` shrinks the text box
  rather than forcing horizontal overflow.

**Not pagination.** The editor remains one continuous document canvas. No page
size, page splitting, page-break node, or print pagination was added — that
belongs to the future Official Defense Forms / Document Rendering phase.

**Verification (authoring ergonomics):** backend `npx prisma validate` +
`npx prisma generate` + `npm run build` + full `npx vitest run` — 134 files /
1422 passed / 5 skipped (`report-body.rules.test.ts` now 34). Frontend: 127
assertions across the 7 verify scripts (`verify-cdw5-report` now 41) +
`npx tsc --noEmit` + scoped `eslint` + `npm run build` — all clean. (The
118/120 totals in the earlier CDW-5 sections are historical snapshots from their
own passes.)

**NO NEW DATABASE MIGRATION** — `RapReport.bodyDocument` already stores
structured JSON.

## CDW-5 Word-like academic formatting — controlled typography, alignment, line spacing

Brings the authoring experience closer to the Rapporteur's Word academic
workflow, without building a full word processor. The report model stays
structured, bounded, deterministic, and safe for Preview/read-only and a future
official PDF renderer. **No database migration.**

**Document defaults (system-owned, not authored values)**

- **Font family:** the document body uses a fixed `Arial, Helvetica, sans-serif`
  stack (`report-body.css`); the toolbar shows a static, non-selectable "Arial"
  field. No custom fonts and no multi-font picker.
- **Color:** document body text, headings, and list text are `#000000`. EARIST
  branding remains on the surrounding application UI only — there is no color
  picker.
- **Default size:** 12 pt (the previous 16px body equals 12 pt). A stored
  paragraph may set 11 pt.
- **Default line spacing:** 1.5. Both defaults apply when a paragraph carries no
  explicit attribute, so pre-existing content renders unchanged.

**Controlled font size and line spacing**

- Paragraph attrs gained `fontSizePt: 11 | 12` and
  `lineSpacing: 1 | 1.15 | 1.5 | 2 | 2.5 | 3`. Only semantic, bounded numbers
  are stored — never CSS strings, pixel values, colors, or font families.
- The toolbar exposes a compact **font-size selector (11/12)** and a
  **line-spacing dropdown** (1.0, 1.15, 1.5, 2.0, 2.5, 3.0), applied to the
  whole paragraph (block-level, applied to all compatible paragraphs in a
  multi-paragraph selection via `updateAttributes`). No per-character font-size
  marks are created.
- Headings stay semantic (`level`, `textAlign`) and are **not** size- or
  spacing-controlled; their presentation is defined in CSS.

**Alignment controls**

- The four canonical alignments — Align left, Align center, Align right, Justify
  — are exposed in the toolbar, reusing the existing `@tiptap/extension-text-align`
  and the existing canonical `textAlign` field. No new alignments were added.

**Canonical model + validation**

- Paragraph attrs remain a closed allow-list: `textAlign`, `indentLevel`,
  `fontSizePt`, `lineSpacing`. Unknown attrs still fail closed.
- `report-body.rules.ts` validates `fontSizePt` as exactly 11 or 12 and
  `lineSpacing` as exactly one of 1/1.15/1.5/2/2.5/3; strings, decimals, NaN,
  and out-of-range values are rejected; headings reject both.
- Canonicalization emits a fixed attr order —
  `textAlign` → `indentLevel` → `fontSizePt` → `lineSpacing` — so hashing stays
  deterministic. Documents that never used the new attrs canonicalize and hash
  exactly as before.

**Tiptap boundary + persistence**

- A small local extension (`report-paragraph-formatting.ts`) adds the bounded
  `fontSizePt` / `lineSpacing` attributes to paragraphs and exposes
  `setReportFontSize` / `setReportLineSpacing`. The adapter round-trips all four
  paragraph attrs (`textAlign`, `indentLevel`, `fontSizePt`, `lineSpacing`)
  plus marks, so formatting survives Editor → Save → reload.

**Preview / read-only parity**

- The editor emits `data-font-size-pt` / `data-line-spacing` (alongside
  `data-indent-level`) via `renderHTML`; the read-only renderer emits the same
  attributes. Both are styled by the shared `.cdwReportBody
  p[data-font-size-pt]` / `p[data-line-spacing]` rules, so the Editor, Preview
  Report, and the Chairman/Panelist read-only view render the same Arial, black,
  11/12 pt, line-spaced, aligned, indented document. CSS `pt` is used for
  fidelity; no pixel values are stored.

**Not pagination.** The editor remains one continuous document canvas. No page
size, page splitting, page-break node, print CSS, or PDF generation was added.

**Deferred (unchanged):** arbitrary fonts, arbitrary sizes, color picker,
highlight, super/subscript, tables, images, page numbers, true pagination, the
official GS Form No. 22 renderer, signatures, RAP-C1, and WebSocket.

**Verification (Word-like formatting):** backend `npx prisma validate` +
`npx prisma generate` + `npm run build` + full `npx vitest run` — 134 files /
1438 passed / 5 skipped (`report-body.rules.test.ts` now 50). Frontend: 138
assertions across the 7 verify scripts (`verify-cdw5-report` now 52) +
`npx tsc --noEmit` + scoped `eslint` + `npm run build` — all clean. (The
118/120/127 totals in the earlier CDW-5 sections are historical snapshots from
their own passes.)

**NO NEW DATABASE MIGRATION** — `RapReport.bodyDocument` already stores
structured JSON.

## CDW-5 Word Layout Fidelity — Letter page geometry and Word-like text flow

Final authoring/layout calibration of the Committee Report so horizontal text
flow and list indentation track the actual institutional Word (DOCX) reference
more closely. Presentation-only: no canonical model change, **no backend/domain
change, no database migration.**

**Page geometry**

- The reference is **US Letter**, not A4 (8.5in × 11in). The desktop authoring
  canvas is calibrated to Letter width: `.cdwReportCanvas { width: 8.5in;
  max-width: 100%; padding: 1in; }` — approximately **1in left/right document
  margins** (≈6.5in content region), matching the DOCX.
- `max-width: 100%` plus reduced padding at ≤960px (0.6in) and ≤640px
  (1.25rem) keep the document fluid on narrower viewports — Letter width is never
  forced and never causes horizontal overflow.
- **No fixed Letter page height.** The canvas stays vertically continuous.

**Word-like list geometry (hanging indent)**

- Ordered and bullet lists use `list-style-position: outside` with
  `padding-left: 0.5in`, so the text start is ≈0.5in and the marker hangs to its
  left; wrapped continuation lines align with the text start (not the marker).
  No inserted spaces or tab characters are used.
- Nested ordered items (`1.1`, `1.2`, `1.3`) sit deliberately deeper:
  `ol ol`/`ol ul` add `padding-left: 0.75in` → text start ≈1.25in, matching the
  Word reference. Nested bullets use a 0.5in step. Narrow viewports reduce these
  indents so no overflow occurs.

**Paragraph rhythm**

- The generic web-style `.cdwReportBody p { margin: 0.8em 0; }` is replaced by
  `margin: 0 0 0.2em` — minimal paragraph-after spacing; line spacing owns the
  internal leading (paragraph spacing is not conflated with line spacing).
- Document default line spacing is **single (1.0)**, matching the Word sample
  for this report style (previously 1.5). Explicitly stored `lineSpacing` values
  remain authoritative; documents without the attr simply use the new default —
  stored JSON is never rewritten.
- Nested list item paragraphs keep zero margin (`li > p { margin: 0 }`).

**No hardcoding / no distortion**

- No selectors or line breaks based on sample text ("Statement of the Problem",
  "CHAPTER 1", sample question wording). The geometry generalizes.
- No `letter-spacing`, `word-spacing`, `font-stretch`, or `transform: scale`
  hacks — Arial metrics are used normally; wrap fidelity comes from real page
  geometry.
- Arial, black text, 11/12 pt, alignment, and line-spacing controls are
  unchanged.

**Shared geometry.** Editor, Preview Report, and the Chairman/Panelist read-only
view all use the same `cdwReportWorkspace → cdwReportCanvas → cdwReportBody`
CSS — including Letter width, margins, list geometry, paragraph rhythm, and the
font-size/line-spacing/indent data-attribute rules. There is no preview-only
layout.

**Still deferred (unchanged):** fixed page height, page 1/2 splitting,
page-break node, automatic pagination, page count, print pagination, PDF
generation, the official GS Form renderer, RAP-C1, and WebSocket.

**Verification (Word layout fidelity):** no backend/domain files changed, so the
backend suite was not re-run. Frontend: 143 assertions across the 7 verify
scripts (`verify-cdw5-report` now 57) + `npx tsc --noEmit` + scoped `eslint` +
`npm run build` — all clean. (Earlier CDW-5 totals are historical snapshots.)

**NO NEW DATABASE MIGRATION** — layout is rendering policy, not persisted
content.
