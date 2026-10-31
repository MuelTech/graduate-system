# EC7D — Structured Stimulus Admin Authoring Simplification

Date: 2026-10-31

Repository: `MuelTech/graduate-system`

Branch: `feat/exam-content-integration`

## Context

Final owner Admin QA for Phase A found that the verified imported OLSAT bank is
correct, but the structured-stimulus authoring UI is unnecessarily complex.

The current editor exposes eight source-oriented internal forms:

- MATRIX
- WORD_BANK
- NUMBER_SEQUENCE
- ALPHANUMERIC_SEQUENCE
- WORD_SERIES
- GROUPED_NUMBER_ROWS
- LETTER_SEQUENCE
- LOGICAL_PREMISES

It also exposes a per-cell `Text / Number` selector for grid/numeric content.
That duplicates decisions already implied by the structured payload and allows
confusing states that later fail validation.

This is an Admin authoring/configuration defect, not an imported-content defect.

## Existing persistence boundary

Do not redesign the database for EC7D.

`ExamQuestion.stimulusType` remains:

- NONE
- IMAGE
- STRUCTURED

Structured content remains in nullable JSON `structuredStimulus`, with separate
`structuredStimulusEmphasis` metadata.

No Prisma migration is required.

The existing verified 72-question bank must not be reset, re-imported, or
bulk-rewritten for this correction.

## Target Admin mental model

Admin should configure **layout**, not source-extraction taxonomy.

Expose only these three authoring families:

1. **Grid / Table**
2. **Inline Items**
3. **Numbered List**

Legacy/internal types map to those families:

| Existing internal type | Admin family |
| --- | --- |
| MATRIX | Grid / Table |
| GROUPED_NUMBER_ROWS | Grid / Table |
| WORD_BANK | Inline Items |
| NUMBER_SEQUENCE | Inline Items |
| ALPHANUMERIC_SEQUENCE | Inline Items |
| WORD_SERIES | Inline Items |
| LETTER_SEQUENCE | Inline Items |
| LOGICAL_PREMISES | Numbered List |

Existing stored subtype/payload values remain valid and supported.

## Backward-compatibility rule

Opening an existing/imported question and saving it without changing structured
content must preserve its stored subtype and payload exactly, including existing
number-vs-string JSON representation where applicable.

The UI may derive a three-family view from the stored subtype, but it must not
silently convert untouched legacy/imported JSON.

If the Admin intentionally changes the layout family, the editor may create a new
bounded generic representation for that edited content, but the conversion must
be explicit and must clear stale structured emphasis as required by the existing
server rules.

## New content representation

For newly authored generic structured content, prefer a small forward-facing
layout vocabulary rather than adding more source-specific subtypes.

The implementation may introduce backward-compatible generic JSON discriminators
such as:

- GRID
- ITEMS
- NUMBERED_LIST

provided that:

- existing eight subtype payloads remain readable/renderable/editable;
- no existing bank rows are automatically migrated;
- API/server validation remains fail-closed;
- Admin and Applicant renderers support both legacy and new generic forms;
- structured emphasis remains separate from canonical text content.

If adding those generic discriminators would materially enlarge the package,
Codex must stop and report rather than silently broadening EC7D. A compatibility
adapter over the existing types is acceptable if it produces the same simplified
Admin UX without rewriting stored content.

## Cell/item value rule

Remove the visible per-cell `Text / Number` selector.

Visible editing uses plain text inputs.

Do not collapse the entire structured stimulus into a single textarea. Preserve:

- row boundaries for Grid / Table;
- item boundaries for Inline Items;
- item order for Numbered List.

Existing imported numeric JSON values may retain hidden compatibility metadata in
the editor draft solely so an untouched save can round-trip exactly. The Admin
must not need to choose primitive JSON types.

## UI behavior

### Grid / Table

Show a row/column editor:

- Add row
- Remove row
- Add column
- Remove column

Each cell is one text input.

### Inline Items

Show ordered item inputs:

- Add item
- Remove item

Existing semantic text emphasis editing remains available where the underlying
content supports it.

### Numbered List

Show ordered text items with numbered presentation.

- Add item
- Remove item

Do not expose source-extraction subtype terminology as the primary Admin choice.

## Validation / UX

Validation messages must describe the visible layout, not hidden internal types.

No visible control combination should create a state that the selected layout can
never save.

Keep strict bounds for row/item counts and text length.

Unknown/malformed structured JSON continues to fail closed.

## Protected accepted state

EC7D must not change:

- `backend/exam-content/olsat/manifest.json`;
- the 108 source assets;
- `backend/exam-content/olsat-emphasis.json`;
- the imported 72 questions / 360 options;
- question/option IDs;
- option labels/orders;
- correct-answer mappings;
- media identities;
- source/import identity;
- already-applied emphasis metadata;
- exam scoring/scheduling/attempt behavior.

No Phase B work belongs in EC7D.

## Verification

At minimum prove:

1. existing representative legacy forms load into the correct family;
2. unchanged existing/imported structured content round-trips without JSON drift;
3. Grid / Table no longer shows Text/Number selectors;
4. Inline Items no longer shows Text/Number selectors;
5. Numbered List edits/rendering work;
6. existing MATRIX and GROUPED_NUMBER_ROWS render unchanged;
7. existing WORD_BANK / NUMBER_SEQUENCE / ALPHANUMERIC_SEQUENCE / WORD_SERIES /
   LETTER_SEQUENCE render unchanged;
8. existing LOGICAL_PREMISES render unchanged;
9. Q25/Q45 structured emphasis remains intact;
10. Admin preview and Applicant shared renderer remain consistent;
11. no protected package/database content is rewritten as part of implementation.

Owner manual/browser QA resumes after independent EC7D review.

## Acceptance boundary

EC7D is complete only after implementation, focused automated verification, and
independent remote review pass.

Phase A remains pending until the owner then completes the resumed Admin/Applicant
physical-source QA.

Phase B must not start before formal Phase A acceptance.
