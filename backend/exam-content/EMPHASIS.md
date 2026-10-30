# Verified semantic text emphasis

The original `olsat/manifest.json` and 108 assets remain immutable. Do not infer
emphasis from words, capitalization, answers, or question types. No real OLSAT
emphasis sidecar is included: the owner must verify annotations against the
physical/source assessment before creating `exam-content/olsat-emphasis.json`.
This sibling file is outside the fixed base-package inventory/fingerprint.

## Physical-source audit update — 2026-10-30

The owner later supplied all 12 physical OLSAT test pages for direct source
comparison. That audit showed the currently implemented v1 contract is not yet
sufficient for final real-source population:

- verified source typography includes `ITALIC` in addition to `BOLD` and
  `UNDERLINE`;
- some structured textual stimuli carry meaningful source emphasis (including the
  Q25 and Q45 WORD_SERIES terms);
- Q24 option J has a source-text discrepancy that must be corrected before final
  text hashes/offsets are generated.

Therefore the runtime contract documented below describes the **currently
implemented support**, not the final accepted OLSAT fidelity contract. Do not
create/apply the production `olsat-emphasis.json` until the bounded Q24 source
correction and the reviewed ITALIC/structured-text extension are complete.

## Runtime contract

Canonical `questionText` and `optionText` stay plain strings. Nullable JSON fields
`questionTextEmphasis` / `optionTextEmphasis` contain an array of:

```ts
{ start: number; end: number; style: "BOLD" | "UNDERLINE" }
```

Offsets count **UTF-16 code units**, zero-based, end-exclusive, directly in the
canonical string. This is JavaScript's `length`/`slice` convention. Endpoints may
not split a surrogate pair. The Admin selection helper maps textarea-normalized
CRLF/CR selections back to the unchanged original canonical string.

Null, absent metadata, and an empty array mean no emphasis (normalized to null).
At most 128 marks per field are accepted. Unknown fields/styles, noninteger or
negative indices, empty/out-of-bounds ranges, duplicates, and overlapping marks
of the same style are rejected. Adjacent same-style ranges are allowed. Bold
and underline may overlap. Nonempty emphasis on an image-only option is rejected.
Input is never clamped or silently repaired. Valid spans are sorted deterministically.

React renders escaped strings and controlled `strong`/`u` elements, never HTML
injection or persisted Markdown. Invalid rendering metadata falls back to the
exact plain text. API validation/projection rejects invalid stored marks.

The Admin editor supports selection-based Bold, Underline, Remove selected
formatting, Clear all formatting, and a local preview for each field. Any actual
text change clears **all** marks in that field with a visible notice. Reapply
marks to the new text before saving. Image/text conversion clears option marks.
Unchanged option IDs are retained, and question-only edits omit unchanged options.

Partial API updates preserve unchanged marks. If text changes without supplying
replacement marks, inherited marks are cleared. Callers explicitly supplying new
marks must compute them against the new text; the same strict validation applies.

## Sidecar schema version 1

The JSON root has exactly these fields:

- `schemaVersion`: `1`.
- `packageKey`: `"olsat"`.
- `manifestSha256`:
  `0327342827f9afafeadb65b88f18e9bb4f21b2c513fe6edfdb9104ab16abd3d9`.
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

`textSha256` hashes the exact UTF-8 canonical field string, with no trim, Unicode
normalization, newline conversion, or full question-text duplication in the file.
`spans` must be an explicit array; `[]` deliberately clears a targeted field.
Omitted field targets are left unchanged. Duplicate targets, unknown questions,
unknown label/order pairs, image-only targets, text-hash mismatches, unverified
metadata, and malformed/unsupported schema fail the entire operation.

Synthetic examples live in `tests/unit/services/exam-emphasis.test.ts` and
`tests/unit/cli/exam-emphasis.test.ts`. They are fixtures, not real annotations;
do not copy them to the production sidecar.

## Operator sequence

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
Apply writes only the two semantic metadata columns inside one Serializable
Prisma transaction. It preserves question/option IDs, text, correctness, media,
source identities, and Applicant references. Failures roll back the transaction.
The first changed apply returns `APPLIED`; an identical rerun returns
`ALREADY_APPLIED` with zero writes. Applying a reviewed map deliberately replaces
only its listed field metadata; removing a target from the file does not clear it.
Review the preflight counts before applying a revised owner map.

No real annotation population or source/browser QA is certified by installing
this support. EC6 pagination/color follow-ups and all Phase B lifecycle work
remain separate.
