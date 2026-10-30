# EXAM-CONTENT-7A — ITALIC + structured textual-stimulus fidelity extension

Date: 2026-10-31 (Asia/Manila).

Status: architecture/support implemented; **STOP for independent review**.
No real source typography population or manual/browser QA is certified.
Formal EXAM-CONTENT-7 and Phase A acceptance remain pending.

## Git checkpoint and scope

- Repository: `MuelTech/graduate-system` (`git@github.com:MuelTech/graduate-system.git`).
- Existing branch only: `feat/exam-content-integration`.
- Approved starting local/remote HEAD: `f63d77d3c0cec42fba215da7bd0594dcab06c74d`.
- Starting working tree: clean.
- Final implementation HEAD: `3d8a7cbb7121f5aaf24291327a8e9c1f7d88e473` (`feat(exam): extend semantic emphasis fidelity`).
- This report is committed separately after the implementation; the report commit
  is the final delivery checkpoint, with its hash reported in the handoff.
- Local main remained `f5d5cbae4e8948a9a0065e0cfd469975f6427c86`;
  remote main remained `c8b05814924cdc3c741dc75f7bf0d06aeba5b6d0`.
  Their pre-existing difference was left alone. No branch creation, main merge,
  reset, rebase, history rewrite, or force push was performed.

Current source-of-truth, plan, checklist, physical-source audit, accepted CORR2
report, and emphasis operator contract were read before implementation. The
owner-reviewed source findings authorize this capability only; the scans were
not reinterpreted and no actual source offsets were generated.

## Runtime contract and persistence

`TextEmphasisSpan.style` now accepts only `BOLD | UNDERLINE | ITALIC` on both
backend and frontend. Canonical strings remain plain text. All existing UTF-16
zero-based/end-exclusive rules, surrogate boundaries, strict keys, 128-span
bound, same-style overlap rejection, adjacent-span allowance, deterministic
normalization, and cross-style overlap remain. Triple overlap is supported.
There is no rich-text dependency, stored HTML/Markdown, arbitrary CSS, additional
style, or markup-string rendering.

The only schema addition is nullable JSON
`ExamQuestion.structuredStimulusEmphasis`, mapped to
`exam_questions.structured_stimulus_emphasis`, beside canonical
`structuredStimulus`. The latter's shape/content is unchanged. Metadata is:

```ts
{ index: number; spans: TextEmphasisSpan[] }[] | null
```

The bounded surface is the five existing canonical string-item families:
WORD_BANK, ALPHANUMERIC_SEQUENCE, WORD_SERIES, LETTER_SEQUENCE, LOGICAL_PREMISES.
NUMBER_SEQUENCE, MATRIX, GROUPED_NUMBER_ROWS, images, and arbitrary JSON paths
remain outside the emphasis surface. Entries accept exactly index/spans;
indexes must be unique non-negative integers resolving to canonical string items.
At most 100 entries are accepted, matching existing structured item limits;
spans validate against each exact string. Empty item spans are dropped, entries
sort by index, and empty metadata becomes null. Malformed/unsupported/non-string/
out-of-range targets fail closed.

Partial server updates preserve omitted structured marks when normalized
canonical content is unchanged. Changed text, order, count, or subtype clears
inherited metadata when no explicit replacement is supplied. Leaving STRUCTURED
clears inherited structured metadata. Explicit replacements validate against the
final effective stimulus; nonempty replacements for unsupported final content
are rejected. Explicit []/null clears are supported. The server enforces these
rules independently of the editor.

Create/update persistence and explicit Admin/Applicant read projections carry the
separate field. SQL NULL uses Prisma.DbNull. Existing option identities and
answered-option removal guards remain intact. Applicant projection still omits
correctness, source/import authority, answer keys, and private storage metadata.
No new endpoint or permission change was made.

## Rendering and editing

SemanticText emits escaped React strings with controlled strong/u/em elements;
triple styles nest deterministically as strong > u > em. Invalid rendering
metadata falls back to exact plain text. SemanticTextEditor adds one Italic
selection action and help text. Existing remove-selection, clear-all, text-edit
clearing notice, and local preview behavior remain.

The structured editor reuses SemanticTextEditor for supported string items,
keeping metadata separate from its content draft. Editing an item clears that
item's stale marks; unaffected items retain their marks. Adding/removing items or
changing form clears all structured marks. Switching stimulus category also
clears them. There is no reorder UI; the draft helper clears marks on affected
changed indexes and clears all on index-count/form changes. Numeric/grid controls
retain their existing behavior.

Shared StructuredStimulusRenderer renders supported strings through SemanticText
with matching item metadata. Admin preview, Admin bank, Applicant MCQ and existing
essay content presentation pass that same field to the shared renderer. This last
change only supplies rendering metadata; essay lifecycle logic is untouched.
Numeric/grid/image rendering and accepted pagination/color behavior remain intact.
React review checked pure rendering, stable position keys with index-change
clearing, labeled native controls, existing client boundaries, and absence of
HTML injection or additional synchronization effects.

## Sidecar v2 and transactional reconciliation

The current schema is exclusively `schemaVersion: 2`; v1 is rejected. No real v1
file existed, so no parallel compatibility path was retained. QuestionText and
exact option label/order targets remain supported; the new bounded target is
`{ field: "structuredItem", index: number }` under a source question number.
The exact item's UTF-8 SHA-256 and UTF-16 spans are validated. Unknown keys,
implicit indexes, JSONPath/matrix targets, duplicate targets, mismatched source,
and invalid/unverified annotations reject the operation.

The entire sidecar resolves before writes. Structured targets additionally check
normalized source/database canonical structured content and existing metadata.
Targets are grouped by question, only listed item entries change in memory,
explicit spans [] clears one item, and omitted indexes remain. One normalized
structured-field write occurs per changed question; no marked items yields SQL
NULL. Question/option field behavior remains unchanged. All writes stay inside
the existing Serializable transaction. Preflight reports annotation counts and
persisted fields that would change, so two item changes on one question count
as one field. Identical apply returns ALREADY_APPLIED with zero writes.

All apply/clear/idempotency tests use synthetic isolated or mocked persistence;
no real sidecar command/application or bank mutation was performed.

## Migration and narrow development verification

Added and applied exactly:
`20261031000000_exam_structured_stimulus_emphasis`.

```sql
ALTER TABLE `exam_questions` ADD COLUMN `structured_stimulus_emphasis` JSON NULL;
```

No backfill, destructive SQL, reset, bank re-import, or other schema change.
`npx prisma generate` passed (Prisma Client 7.10.0). Initial migration status
identified only this new migration pending among 46. `npx prisma migrate deploy`
applied it successfully; subsequent status reported the schema up to date.
The local MySQL-protocol development engine represents JSON as nullable longtext
with CHECK(json_valid(structured_stimulus_emphasis)); live DDL confirmed that
constraint and NULL default. The Prisma/SQL contract remains nullable JSON.

A narrow before/after read compared only the imported OLSAT question/option rows,
including their existing content, identities, correctness, media references,
source identities and old emphasis fields. It did not inspect unrelated models
or perform a broad digest sweep. Both snapshots contained 72 questions / 360
options and matched SHA-256:
`3a85c8e3297c0f91472e3b2854a6754e2131a9151e497c040147849bd96a7879`.
All pre-existing question/option emphasis remained null. All 72 new structured
metadata values are null. Read-only local snapshot summaries are outside the
repository (`ec7a-before.json` / `ec7a-after.json`); no temporary script is tracked.

## Base package and real-source boundary

Normal read-only source preflight returned PREFLIGHT_OK: 72 questions, 360 source
options, 108 assets, 109 package files, 29 structured / 18 visual / 25 text items.
Exact manifest SHA remains:
`6fd4a1e7a0e9efe1d68b25d93198168f363a02f71c67ba7e1bc271ae4ffb1ed6`.
Computed package fingerprint remains:
`8fa052874c6276e8fefca396d3e9387febf90978cabc8fc43bcb627186af5738`.
There are zero manifest/asset changes in this package. Q24 is untouched.
`backend/exam-content/olsat-emphasis.json` does not exist. No real OLSAT marks,
including the reviewed ITALIC examples or Q25/Q45 structured terms, were populated.
The physical-source map/application/comparison remain a separate future package.

## Focused automated evidence

From backend:

```powershell
npm test -- tests/unit/services/structured-emphasis.test.ts tests/unit/services/structured-emphasis-rendering.contract.test.ts tests/unit/services/text-emphasis.test.ts tests/unit/services/semantic-text.contract.test.ts tests/unit/services/exam-emphasis.test.ts tests/unit/cli/exam-emphasis.test.ts tests/unit/services/exam-content.rules.test.ts tests/unit/repositories/exam-engine.repository.test.ts tests/unit/services/admin-exam-editor.contract.test.ts tests/unit/services/applicant-exam-content.contract.test.ts tests/unit/migrations/exam-text-emphasis.test.ts tests/unit/services/exam-content-real-package.test.ts
npm run build
```

Final focused run: **12 files / 273 tests passed, 0 failed/skipped**, exit 0.
Backend TypeScript build: **PASS**, exit 0. Coverage includes ITALIC overlap and
surrogates, triple-style segmentation and actual React markup/escaping, strict
structured validation/backend-frontend parity, server merge/clear rules, v2
hash/target parsing, grouped writes/omitted-item preservation, explicit item clear,
SQL-null CLI adaptation, zero-write repeat apply, question/option regressions,
repository create/update/Applicant filtering, draft/edit clearing, shared renderer
wiring, migration shape, and unchanged protected package identity.

Frontend `npx tsc --noEmit`: **PASS**. `npm run build`: **PASS**, including Next.js
production compilation, TypeScript, and generation of 68 pages. Focused ESLint on
eight touched editor/renderer/helper files: **PASS**, exit 0. Frontend contract and
actual renderer tests run in the existing backend Vitest harness using frontend
React; no new test framework/dependency was added. Automated source wiring tests
are not browser interaction evidence.

Early iteration found and corrected a CLI edit syntax error, two old ITALIC/fallback
expectations, and a new CLI fixture's mocked file size. The final focused run and
builds passed. An initial narrow verification script used nonexistent timestamp
fields and then an unsuitable JSON filter; the final explicit selections/readback
passed without data writes. Existing Vite config-loader, Next middleware naming,
and Node module.register deprecation notices were informational.

Scoped formatting and git diff/staged checks passed. Full repository suites,
thesis/dissertation/auth/analytics/email suites, unrelated frontend tests, broad
DB digest sweeps, hosted CI, deployment, and manual/browser QA were intentionally
not run. No Phase B timer/duration, timeout, autosave/recovery, scheduling,
submission/scoring, activation/selection, or essay lifecycle changes were made.

## Exact changed files

Implementation commit (28 files):

- `backend/exam-content/EMPHASIS.md`
- `backend/prisma/migrations/20261031000000_exam_structured_stimulus_emphasis/migration.sql`
- `backend/prisma/schema.prisma`
- `backend/src/cli/exam-emphasis.ts`
- `backend/src/interfaces/exam-content.interfaces.ts`
- `backend/src/repositories/exam-content.projection.ts`
- `backend/src/repositories/exam-engine.repository.ts`
- `backend/src/services/exam-content.rules.ts`
- `backend/src/services/exam-emphasis.service.ts`
- `backend/src/shared/text-emphasis.ts`
- `backend/tests/unit/cli/exam-emphasis.test.ts`
- `backend/tests/unit/migrations/exam-text-emphasis.test.ts`
- `backend/tests/unit/repositories/exam-engine.repository.test.ts`
- `backend/tests/unit/services/exam-emphasis.test.ts`
- `backend/tests/unit/services/structured-emphasis-rendering.contract.test.ts`
- `backend/tests/unit/services/structured-emphasis.test.ts`
- `backend/tests/unit/services/text-emphasis.test.ts`
- `frontend/src/app/(portal)/admin/exam/questions/page.tsx`
- `frontend/src/app/(portal)/applicant/exam/page.tsx`
- `frontend/src/components/exam-content/admin-question-editor.tsx`
- `frontend/src/components/exam-content/applicant-question-renderer.tsx`
- `frontend/src/components/exam-content/semantic-text-editor.tsx`
- `frontend/src/components/exam-content/semantic-text.tsx`
- `frontend/src/components/exam-content/stimulus-renderer.tsx`
- `frontend/src/components/exam-content/structured-stimulus-editor.tsx`
- `frontend/src/lib/exam-content.ts`
- `frontend/src/lib/text-emphasis.ts`
- `frontend/src/types/index.ts`

Evidence commit adds only:
`docs/superpowers/reports/2026-10-31-exam-content-7-fidelity-extension.md`.
Canonical acceptance docs are not changed. Owner manual QA, independent EC7A
review, real-source fidelity work, and formal EC7/Phase A acceptance remain pending.
Stop here; do not begin the real map or Phase B automatically.
