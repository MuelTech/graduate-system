# CDW-5 — Rapporteur Rich-Text Committee Report Authoring Foundation

Branch: `refactor/collaborative-defense-workspace`. This is the authoring
foundation, NOT the official-form/PDF phase and NOT RAP-C1.

## Decisions (approved)
1. The assigned Rapporteur's first save get-or-creates an editable DRAFT
   `RapReport` (status DRAFT, no signature slots). Conclusion-time
   `createRapAfterConclusion` becomes idempotent (reuses an existing report) so the
   current conclusion flow cannot crash on `unique(scheduleId)`. Freeze / signing /
   status transitions remain RAP-C1.
2. Editor: Tiptap 3.32.0 (`@tiptap/react`, `@tiptap/pm`, `@tiptap/core`,
   `@tiptap/starter-kit`) configured to exactly the canonical server document
   model. StarterKit bundles underline, so no extra extension is needed; alignment
   was omitted (optional) to keep the dependency set minimal.
3. Preview Report shows the current local editor state, labelled when it includes
   unsaved changes.

## What was built
- Backend: report read model now returns `reportId` + compact system context
  (`studentNumber`, `program`, `defenseDate`); `canEditBody` is true for the
  assigned Rapporteur when the session is writable and the report is absent or an
  unfrozen DRAFT; `saveReportDraft` creates the DRAFT on first save and applies an
  optional `expectedBodyVersion` CAS (`409 Report changed…` on mismatch);
  `createRapAfterConclusion` reuses an existing report.
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
