# Verified semantic text emphasis

The controlled `olsat/manifest.json` and 108 assets retain exact-byte handling.
The owner-authorized Q24 option-J source correction revises the canonical manifest
identity; all assets remain unchanged. A Q24-specific reconciliation utility was
implemented temporarily but is **superseded and not part of the retained
architecture**. The selected development replacement has now been completed and
accepted: that machinery was removed, the corrected canonical package was
retained, the imported OLSAT development bank was safely reset after dependency
checks, and the corrected package was clean-imported through the normal importer.
Do not infer emphasis from words, capitalization, answers, or question types.
The owner-authorized real map now exists at `exam-content/olsat-emphasis.json`.
It has passed source/package validation and independent map review. EC7C applied
exactly 34 semantic fields and verified an identical second apply changed zero
fields. This sibling file is outside the fixed base-package inventory/fingerprint.

## Physical-source audit update — 2026-10-30

The owner later supplied all 12 physical OLSAT test pages for direct source
comparison. That audit showed the original v1 contract was insufficient for
final real-source population:

- verified source typography includes `ITALIC` in addition to `BOLD` and
  `UNDERLINE`;
- some structured textual stimuli carry meaningful source emphasis (including the
  Q25 and Q45 WORD_SERIES terms);
- Q24 option J had a source-text discrepancy; that corrected-bank checkpoint is
  now closed and accepted, so future text hashes/offsets must bind to the corrected
  canonical wording.

EC7A extends the runtime support below to all three semantic styles and the
bounded string-item structured surface. The architecture/support implementation
has passed independent review. EC7B now encodes the explicit owner-verified map,
and independent review of that committed map plus its read-only live preflight
has also passed with no blocking issue found. EC7C application evidence is below.
Owner manual/browser QA is intentionally deferred until after the reviewed map
has been applied, so the final visual pass can compare actual source-derived
formatting. That final owner comparison and formal acceptance remain pending.

## Runtime contract

Canonical `questionText` and `optionText` stay plain strings. Nullable JSON fields
`questionTextEmphasis` / `optionTextEmphasis` contain an array of:

```ts
{ start: number; end: number; style: "BOLD" | "UNDERLINE" | "ITALIC" }
```

Offsets count **UTF-16 code units**, zero-based, end-exclusive, directly in the
canonical string. This is JavaScript's `length`/`slice` convention. Endpoints may
not split a surrogate pair. The Admin selection helper maps textarea-normalized
CRLF/CR selections back to the unchanged original canonical string.

Null, absent metadata, and an empty array mean no emphasis (normalized to null).
At most 128 marks per field are accepted. Unknown fields/styles, noninteger or
negative indices, empty/out-of-bounds ranges, duplicates, and overlapping marks
of the same style are rejected. Adjacent same-style ranges are allowed. All three
different styles may overlap, including triple overlap. Nonempty emphasis on an
image-only option is rejected.
Input is never clamped or silently repaired. Valid spans are sorted deterministically.

React renders escaped strings and controlled `<strong>` / `<u>` / `<em>` elements, never HTML
injection or persisted Markdown. Invalid rendering metadata falls back to the
exact plain text. API validation/projection rejects invalid stored marks.

The Admin editor supports selection-based Bold, Underline, Italic, Remove selected
formatting, Clear all formatting, and a local preview for each field. Any actual
text change clears **all** marks in that field with a visible notice. Reapply
marks to the new text before saving. Image/text conversion clears option marks.
Unchanged option IDs are retained, and question-only edits omit unchanged options.

Partial API updates preserve unchanged marks. If text changes without supplying
replacement marks, inherited marks are cleared. Callers explicitly supplying new
marks must compute them against the new text; the same strict validation applies.

## Structured textual-stimulus metadata

Canonical `structuredStimulus` remains unchanged. The separate nullable JSON field
`ExamQuestion.structuredStimulusEmphasis` (SQL `structured_stimulus_emphasis`)
contains `{ index: number; spans: TextEmphasisSpan[] }[] | null`. Migration
`20261031000000_exam_structured_stimulus_emphasis` adds only this nullable column;
existing rows start with SQL NULL and no backfill is required.

Supported string `items` families: WORD_BANK, ALPHANUMERIC_SEQUENCE, WORD_SERIES,
LETTER_SEQUENCE, LOGICAL_PREMISES. NUMBER_SEQUENCE, MATRIX, GROUPED_NUMBER_ROWS,
images and arbitrary nested paths are excluded. Maximum 100 unique item entries,
matching the existing item limit, with at most 128 spans per exact item string.
Entries accept only `index` and explicit array `spans`; indexes must be non-negative
integers within the canonical string items. Normalization sorts indexes/spans,
drops empty item spans, and returns null when no marked items remain. Invalid,
non-string, unsupported, duplicate or out-of-range targets fail closed.

Server partial updates preserve omitted metadata when canonical structured content
is unchanged. Changed content (including order, item count or subtype) clears all
inherited structured metadata unless replacement metadata is explicitly supplied.
Leaving STRUCTURED clears inherited marks; explicit nonempty marks on unsupported
final content are rejected. Explicit replacements validate against the final
merged stimulus, including explicit []/null clears. Canonical validation normalizes
object keys before comparing content; textual values are never normalized.

The Admin structured editor reuses SemanticTextEditor for supported string items.
Editing an item's text clears that item's marks with the existing visible notice.
Adding/removing items or changing structured form clears all structured marks.
Switching stimulus category also clears structured metadata. Other unchanged item
marks stay with their indexes. Numeric/grid editing remains unchanged.
Admin preview/bank and Applicant MCQ/essay presentation pass the separate metadata
to the same shared StructuredStimulusRenderer. Each supported item uses SemanticText;
malformed rendering metadata falls back to all exact plain item strings.

## Sidecar schema version 2

The JSON root has exactly these fields:

- `schemaVersion`: `2` (v1 is rejected; no real v1 sidecar existed).
- `packageKey`: `"olsat"`.
- `manifestSha256`:
  `2cd14cd6578eafe14536db36833a07a085e7d7e091ed2f6d2a934f79b6f30c95`.
- `indexConvention`: `"UTF16_CODE_UNITS"`.
- `verification`: `{ "status": "VERIFIED", "verifiedBy": "<owner/reviewer>",
  "verifiedAt": "<ISO UTC timestamp>" }`. This is explicit owner/source
  attestation, not machine verification of the physical assessment.
- `annotations`: 1–2048 unique field targets. Each entry contains exactly:
  `sourceQuestionNumber`, `target`, `textSha256`, and `spans`.

Question targets: `{ "field": "questionText" }`.
Option targets: `{ "field": "optionText", "label": "<exact source label>",
"order": <exact runtime/source option order> }`. Orders use the existing import
contract: explicit source order when present, otherwise the zero-based option
array index. Do not use an array-index letter in place of the stored label.

Structured targets: `{ "field": "structuredItem", "index": <explicit item index> }`.
The source question number identifies the question, and the index must resolve to
a supported canonical string item. No label inference, JSONPath, or matrix cell
annotation is supported.

`textSha256` hashes the exact UTF-8 canonical field/item string, with no trim, Unicode
normalization, newline conversion, or full question-text duplication in the file.
`spans` must be an explicit array; `[]` deliberately clears a targeted field.
Omitted field targets are left unchanged. Duplicate targets, unknown questions,
unknown label/order pairs, image-only targets, text-hash mismatches, unverified
metadata, and malformed/unsupported schema fail the entire operation.

Synthetic examples live in `tests/unit/services/exam-emphasis.test.ts` and
`tests/unit/cli/exam-emphasis.test.ts`. They are fixtures, not real annotations;
do not copy them to the production sidecar.

## EC7B real-map checkpoint — 2026-10-31

The schema-v2 sidecar binds only the explicitly owner-authorized targets, with
verification `PROJECT_OWNER_APPROVED_PHYSICAL_SOURCE_MAP` at
`2026-10-31T09:39:09Z`. It contains 38 targets across 28 questions and 59 spans:
33 BOLD, 8 UNDERLINE, 18 ITALIC. Q67 is excluded. The protected corrected
manifest/package identity is unchanged.

Source-parser validation and the focused real-map integrity test passed.
Read-only database preflight returned `PREFLIGHT_OK`, `annotationsValidated: 38`,
`fieldsChanged: 0`, `fieldsWouldChange: 34` (27 question fields, 5 option fields,
2 grouped structured fields). Matching before/after reads confirmed all three
emphasis fields remain null across the 72 imported questions and 360 options.

EC7B stopped at preflight and is independently reviewed PASS. No real apply command
was run in that package. EC7C records the separately authorized application below.

## EC7C application checkpoint — 2026-10-31

The unchanged reviewed sidecar passed the exact 38-target / 34-field preflight.
The first transactional apply returned `APPLIED`, `fieldsChanged: 34`.
Readback matched the reviewed normalized metadata: 27 questionText fields,
5 Q24 optionText fields, and 2 structuredStimulus fields on Q25/Q45. Remaining
fields stayed null (45 / 355 / 70 respectively); Q67 remained unannotated.

Canonical bank content, question/option identities, correctness, media references,
all 108 managed bank media records, and the import marker were unchanged.
The identical second apply returned `ALREADY_APPLIED`, `fieldsChanged: 0`,
`fieldsWouldChange: 0`; its before/after snapshots matched exactly.
See `docs/superpowers/reports/2026-10-31-exam-content-7-typography-application.md`
for the operational evidence. Independent EC7C review is now PASS with no blocking
issue found. No manual/browser QA or formal EC7/Phase A acceptance is certified
by EC7C; those remain pending the deferred owner source comparison.

## Operator sequence

EC7E corrects canonical Q40 to leading prompt → unnumbered premise lines →
trailing prompt → choices. Its manifest SHA above and existing operator source
guard follow that correction. All 38 reviewed emphasis targets remain exactly
text-hash compatible; only the sidecar manifest binding changes. No Q40 marks
were added. The corrected package fingerprint is
`01ad6b100f65e312387779852a352dcff97d5fd2a0b707ba1901dc2c8aeac343`.
This source correction requires the accepted controlled **development-only**
clean bank replacement path because an existing `olsat` marker with the previous
fingerprint is a source conflict. This exception is for the authorized source
correction; adding formatting alone still never requires deleting questions.
Operational evidence and the EC7E review/owner-QA boundary are recorded in
`docs/superpowers/reports/2026-10-31-exam-content-7-items-and-q40-source-fidelity.md`.
The controlled replacement is complete: 72 questions / 360 options / 108 bank
media, 72/72 answer mappings, zero broken bank references, and unchanged unrelated
record hashes. Corrected-package live emphasis preflight planned 34 fields;
application restored exactly those 34 fields (27 question / 5 option / 2
structured). Identical repeats returned ALREADY_IMPORTED and ALREADY_APPLIED
with zero changes. EC7E independent remote review is PASS, the project owner confirmed the resulting correction, and EXAM-CONTENT-7 / Phase A are accepted as of 2026-10-31.

From `backend`, after installing dependencies and deploying reviewed migrations:

```powershell
npx prisma generate
npm run build
npm run exam-content:preflight
```

For a **fresh environment**, perform the authorized base verified bank import:

```powershell
npm run exam-content:import
```

For the **existing imported bank**, skip that import. Do not delete or re-import
questions to add formatting. Once the owner has supplied the verified sidecar:

```powershell
npm run exam-emphasis:preflight
npm run exam-emphasis:apply
npm run exam-emphasis:apply
```

The CLI uses only the fixed sibling sidecar path (maximum 1 MiB, regular contained
file, no symlink). Absent/invalid/unverified input fails closed with exit 1 and
`EMPHASIS_NOT_APPLIED`; it does not fabricate annotations or treat absence as
successful population. Missing sidecar is checked before importing the DB module.
There is no HTTP route or caller-selected path. No private details or annotation
text are included in CLI summaries/errors.

Both preflight and apply validate the entire base package and its unchanged
fingerprint, check the imported marker/count and complete source-question identity
set, then resolve all sidecar targets by source number and exact option label/order.
Every target's canonical text hash must match both the source and database.
All targets are resolved and validated before any write.

Preflight returns `PREFLIGHT_OK`, `fieldsChanged: 0`, and `fieldsWouldChange`.
Apply writes only the three semantic metadata columns inside one Serializable
Prisma transaction. It preserves question/option IDs, text, correctness, media,
source identities, and Applicant references. Failures roll back the transaction.
The first changed apply returns `APPLIED`; an identical rerun returns
`ALREADY_APPLIED` with zero writes. Applying a reviewed map deliberately replaces
only its listed field metadata; removing a target from the file does not clear it.
Structured annotations are grouped by question. After validating the entire sidecar,
source/database structured content, exact item hashes, and current metadata, the
reconciler changes only listed item targets in memory. `spans: []` clears that item;
omitted indexes survive. It normalizes and writes the complete structured metadata
field once per affected question, persisting SQL NULL if all marks are cleared.
Question/option semantics remain unchanged. `annotationsValidated` counts targets;
`fieldsWouldChange`/`fieldsChanged` count persisted fields (multiple changed items
on one question count as one field), making preflight deterministic and repeated
application idempotent with zero writes.

Review the preflight counts before applying a revised owner map.

Real owner-verified annotation population is present in the development database.
EC7A support, EC7B map review/preflight, EC7C apply/idempotency, EC7D structured
authoring simplification, and EC7E Items/Q40 source-fidelity correction have all
passed their required reviews. The project owner confirmed the final EC7E output
and authorized Phase A closure. **EXAM-CONTENT-7 and Phase A are accepted as of
2026-10-31.** EC6 pagination/color follow-ups remain closed. Phase B lifecycle
work remains separate and has not been started by this documentation update.
