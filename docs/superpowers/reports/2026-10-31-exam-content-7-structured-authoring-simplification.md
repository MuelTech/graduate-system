# EC7D — Structured Stimulus Admin Authoring Simplification

Date: 2026-10-31 (Asia/Manila).

**Implemented with focused automated evidence. STOP for independent review.**
Owner manual/browser QA remains pending; Phase A is not formally accepted.

## Starting checkpoint and scope

- Repository: `MuelTech/graduate-system`.
- Existing branch: `feat/exam-content-integration`.
- Approved starting local/remote HEAD:
  `dd271de65c77452a81e0f0aa2db30e7460014354`.
- Starting working tree: clean.
- Remote main remains `c8b05814924cdc3c741dc75f7bf0d06aeba5b6d0`;
  local main remains `f5d5cbae4e8948a9a0065e0cfd469975f6427c86`.
  The pre-existing difference is untouched. No new branch, merge to main,
  reset, rebase, force push, or rewritten history.
- Delivery commit: `fix(exam): simplify structured stimulus authoring`;
  final verified pushed hash is recorded in the handoff.

The current source of truth, integration plan, dedicated EC7D plan, checklist,
physical-source audit, existing editor/helper/renderer, and relevant structured
contract tests were read before implementation. The verified bank/import/media
and EC7C application/idempotency checkpoints were not reopened.

## Admin behavior before and after

Before, the primary selector exposed eight source-oriented subtypes. Grid and
numeric entries also exposed a Text/Number selector for each cell/item, while
legacy value restrictions could reject an otherwise reasonable text edit.

After, the primary selector exposes exactly three layouts:

| Admin layout | Existing types loaded into it | New content representation |
| --- | --- | --- |
| Grid / Table | MATRIX, GROUPED_NUMBER_ROWS | MATRIX |
| Inline Items | WORD_BANK, NUMBER_SEQUENCE, ALPHANUMERIC_SEQUENCE, WORD_SERIES, LETTER_SEQUENCE | WORD_SERIES |
| Numbered List | LOGICAL_PREMISES | LOGICAL_PREMISES |

The eight stored types remain supported internally. The frontend selection keys
GRID/INLINE/NUMBERED are never persisted as new canonical discriminators.
The editor contains one layout selector and no primitive selectors. Grid cells
use plain text inputs; supported textual items retain their per-item plain-text
semantic editor and local preview. No whole-stimulus textarea replaces rows/items.

Grid / Table provides row boundaries, Add row, Remove row, Add column, and Remove
last column. Both legacy grid subtypes use those same labels. Inline Items and
Numbered List provide ordered entries, Add item, and Remove item. Numbered entries
are labeled List item 1, List item 2, etc.; preview uses the existing numbered
shared renderer. Existing row/column limits of 30 and item limit of 100 remain.

Choosing the same layout does nothing, preserving the existing draft and marks.
An intentional change to another layout replaces the rows/items with that layout's
initial draft and clears structured formatting; the editor help states that
behavior. Adding/removing items clears indexed formatting as before.

Validation messages now describe the visible layout: for example,
`Rows must have the same number of cells.`, `Enter at least one item.`, and
`Enter at least one list item.` Nonempty values, 500-character cells/items, equal
row widths, count bounds, supported shapes, and finite saved numbers remain
enforced. Unknown/malformed stored structured JSON continues to fail closed.

## Compatibility adapter and exact unchanged saves

The request permits an adapter over existing types. That option keeps EC7D within
the frontend editor/helper contract: no new backend discriminators, server/API
changes, Prisma schema changes, or renderer implementation are required.

The hidden draft field originalValue records the original string or number for
each loaded cell. When its visible text is unchanged, the builder returns that
exact primitive. New/changed entries are plain strings, so an Admin never chooses
a JSON primitive. Returning edited text to its original spelling also restores
the original primitive. Hidden draft metadata is not included in canonical output.

The builder first validates the existing subtype and returns it unchanged when
valid. Thus an untouched payload preserves its exact subtype, rows/groups/items
shape, item order, numbers, numeric strings, fractions, and gaps. Tests check both
deep equality and JSON serialization equality across all 29 real structured source
payloads. An ordinary compatible edit also retains the legacy subtype and keeps
all other untouched primitives intact.

If an actual text edit no longer fits a legacy numeric/letter/alphanumeric grammar,
the builder uses the selected layout's broad existing representation. For example,
an edited grouped-number grid containing words can use MATRIX; an edited numeric
or letter sequence containing phrases can use WORD_SERIES. The visible layout is
preserved, rather than forcing the Admin to understand a hidden source taxonomy.
When a numeric sequence becomes a textual WORD_SERIES, that edited payload's items
are represented as strings as required by the existing contract. Untouched saves
never take this path. Loaded malformed payloads are rejected before draft creation,
and adaptation does not repair invalid row shapes, blank entries, or limit errors.

The existing backend validator accepts the resulting canonical payloads in the
focused in-process frontend/API contract tests. No runtime server validation was
relaxed and no new persisted shape was introduced.

## Emphasis and renderer preservation

Untouched Q25/Q45 question text, structured values, and exact reviewed structured
emphasis survive the full question draft/save path. Their existing question text
emphasis and unchanged option emphasis also remain intact, and unchanged options
are still omitted from metadata-only save payloads.

Editing a formatted item's text clears only that item's stale marks through the
existing semantic editor behavior; unchanged items retain theirs. Removing/adding
items or changing layout clears structured marks to avoid index drift. Existing
server-authoritative stale-metadata validation remains unchanged.

`stimulus-renderer.tsx`, SemanticText, Admin preview wiring, and Applicant code are
unchanged. The existing shared renderer continues to consume all eight legacy
types. Tests render actual React output for all eight, including both grids,
the five inline families, and numbered LOGICAL_PREMISES. Grid/numeric/source
presentation and escaped semantic rendering have no separate replacement renderer.

## Focused automated evidence

The new `structured-authoring.contract.test.ts` contains 44 focused cases. It uses
the existing Vitest harness, actual frontend helpers/controlled component callbacks,
and React static rendering. Only the UI Button primitive and private image boundary
are mocked; tests do not duplicate editor action implementations or access a DB.
The suite checks family mappings, one visible selector/no primitive selectors,
actual add/edit/remove row/column/item callbacks, numbered rendering, bounds,
all real structured payload round-trips, numeric preservation, Q25/Q45 metadata,
malformed read/render rejection, and visible-family validation messages.

Final command, from backend:

```powershell
npm test -- tests/unit/services/structured-authoring.contract.test.ts tests/unit/services/admin-exam-editor.contract.test.ts tests/unit/services/structured-emphasis.test.ts tests/unit/services/structured-emphasis-rendering.contract.test.ts
```

Result: **4 files / 115 tests passed, 0 failed/skipped**, exit 0. These are the
existing focused frontend/helper/renderer/API-contract tests, not unrelated backend
suites. The existing Vite config-loader advisory was informational.

From frontend:

```powershell
npx tsc --noEmit
npx eslint src/lib/exam-content.ts src/components/exam-content/structured-stimulus-editor.tsx
```

Both passed, exit 0. Scoped Prettier formatting/checks and working/staged diff
checks passed. React review checked the controlled editor flow, labeled controls,
bounded operations, explicit layout resets, preserved client boundary, and absence
of new effects or injected markup.

No full frontend build was needed or run. No full repository, unrelated backend,
thesis/dissertation, auth, email, analytics, or Phase B suites were run. These
automated callback/static-render checks are not manual/browser QA.

## Exact files changed and protected state

- `frontend/src/components/exam-content/structured-stimulus-editor.tsx` — three
  visible layout families, plain text cells, and simplified row/item labels.
- `frontend/src/lib/exam-content.ts` — family mapping/defaults, hidden primitive
  preservation, bounded compatibility adapter, and layout-based messages.
- `backend/tests/unit/services/structured-authoring.contract.test.ts` — focused
  frontend/editor/renderer compatibility evidence in the existing test harness.
- `docs/superpowers/reports/2026-10-31-exam-content-7-structured-authoring-simplification.md`
  — this report.

Git checks confirm no changes under backend runtime, Prisma schema/migrations,
or the exam-content package, including the manifest, all 108 assets, and
`olsat-emphasis.json`. The shared renderer and frontend API types are unchanged.
No database command, apply, reset, migration, verification dump, or bank re-import
was executed. Consequently this implementation performed no rewrite of the
72-question/360-option bank, answer mappings, media records, source/import
identities, or already-applied emphasis metadata. Real-bank checks here read
committed source fixtures only; no new live-database QA is claimed.

No scoring, scheduling, attempts, timer, autosave, submission, essay lifecycle,
or other Phase B change. No deployment or broad UI refactor. Canonical acceptance
documents were not changed.

**STOP for independent EC7D review.** Owner manual/browser QA remains pending and
resumes after that review. Formal EC7 and Phase A acceptance remain pending
independent review plus resumed owner Admin/Applicant physical-source QA.


## Independent review addendum — 2026-10-31

Independent review of the actual pushed EC7D branch found **no blocking issue**.

Reviewed evidence:

- branch is exactly one implementation commit ahead of the approved EC7D start;
- changed files are limited to the structured Admin editor/helper, one focused test
  file, and this report;
- no backend runtime, Prisma schema/migration, renderer, manifest/assets, emphasis
  sidecar, API type, database operation, reset, re-import, or Phase B change exists
  in the EC7D implementation diff;
- the editor exposes exactly Grid / Table, Inline Items, and Numbered List;
- the visible Text/Number selector is removed;
- existing legacy subtypes map to those three visible families;
- the helper preserves original string/number primitives for unchanged loaded cells;
- all 29 real structured source payloads are asserted to round-trip with deep and
  JSON serialization equality;
- compatible edits preserve untouched primitives and only adapt a restrictive
  legacy subtype when the actual edited value no longer satisfies that hidden
  subtype grammar;
- Q25/Q45 structured emphasis and related question/option emphasis survive
  unchanged save paths;
- malformed/unsupported stored content continues to fail closed;
- focused verification reports 4 files / 115 tests passed, with frontend
  `tsc --noEmit` and scoped ESLint passing.

**EC7D Structured Stimulus Admin Authoring Simplification: INDEPENDENT REVIEW PASS.**

This does not certify owner manual/browser QA. Formal EXAM-CONTENT-7 and Phase A
acceptance remain pending the resumed owner Admin/Applicant source/configuration QA.


## Post-review owner QA note — EC7E follow-up

After the EC7D independent review passed, owner browser/source QA identified a
separate source-fidelity issue in Q40.

The EC7D implementation evidence remains valid for the three-layout simplification
it delivered. However, the physical source shows Q40 premises as plain stacked
lines without numeric list markers, and the closing `We know that -` prompt appears
after those premise lines.

The current canonical manifest places that closing prompt inside questionText
before the structured stimulus. Therefore formal EC7/Phase A acceptance is paused
for EC7E, which will:

- remove Numbered List from the Admin-facing structured choices;
- expose only Grid / Table and Items;
- map legacy LOGICAL_PREMISES to Items;
- render logical-premise items vertically without numbering;
- correct canonical Q40 source order without a renderer-only special case;
- reconcile package/emphasis source identity through the established clean
  development correction path.

This note does not retroactively change the EC7D independent review result; it
records a new owner-QA finding discovered afterward.
