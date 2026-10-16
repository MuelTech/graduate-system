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
