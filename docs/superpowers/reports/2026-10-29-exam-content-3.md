# EXAM-CONTENT-3 — Verified manifest importer implementation evidence

Date: 2026-10-29 (Asia/Manila). Implementation checkpoint pending independent
review. **EXAM-CONTENT-3 is not marked accepted.**

Repository: `MuelTech/graduate-system`. Branch: `feat/exam-content-integration`.
Verified starting local/fetched remote HEAD:
`1fec84faa56854cee993bc7c7c030057c54dc618`.
The initial dirty tree contained only the expected owner-provided, untracked
`backend/exam-content/olsat/manifest.json` and its 108 assets. No owner work was
reset, stashed, moved, renamed, overwritten, regenerated or deleted. `main`
was not changed and no additional branch was created.

## Actual source package and read-only verification

The controlled source package contains **109 files: one manifest and 108 PNG
assets**, totaling 2,794,905 bytes. There are 72 questions, numbered 1–72, and
all 72 explicitly declare `verificationStatus: VERIFIED`.

| Source question type | Count |
| --- | ---: |
| TEXT_MULTIPLE_CHOICE | 25 |
| STRUCTURED_STIMULUS_TEXT_CHOICES | 29 |
| VISUAL_STIMULUS_VISUAL_CHOICES | 18 |

| Runtime stimulus category | Count |
| --- | ---: |
| NONE | 25 |
| IMAGE | 18 |
| STRUCTURED | 29 |

| Structured discriminator | Count |
| --- | ---: |
| MATRIX | 12 |
| WORD_BANK | 4 |
| NUMBER_SEQUENCE | 4 |
| ALPHANUMERIC_SEQUENCE | 1 |
| WORD_SERIES | 2 |
| GROUPED_NUMBER_ROWS | 4 |
| LETTER_SEQUENCE | 1 |
| LOGICAL_PREMISES | 1 |

Visual assets comprise **18 question stimuli and 90 option images**. All 108
references are unique, exist with exact path casing, and pass the existing
exam-media byte-type/size policy with matching PNG extensions. No unreferenced
files, page scans, CSVs, archives, cache/temp files or extra source-package copies
were found in the repository. A high-confidence credential-marker scan of the
manifest reported zero matches; no environment/configuration files are included.

Real-package preflight: **PASS / PREFLIGHT_OK**, with `questionsImported: 0` and
`mediaObjectsCreated: 0`. The owner-provided files were SHA-256 snapshotted before
implementation and compared afterward without differences. Manifest SHA-256:
`0327342827f9afafeadb65b88f18e9bb4f21b2c513fe6edfdb9104ab16abd3d9`.
Scoped `.gitattributes` entries disable newline conversion for these source files;
this preserves exact source bytes and package fingerprints across checkouts.

## Importer architecture and validation

`preflightExamPackage` is a read-only validator with no database or private-provider
imports. It inventories the complete package, validates the versionless verified
extractor manifest, validates every question through EXAM-CONTENT-1, validates
every referenced image against EXAM-CONTENT-2, and captures bounded exact bytes
before any media promotion or DB mutation. Later import stages use that snapshot,
not rereads of mutable source paths.

The supported source types are exactly the three demonstrated above. They map
to existing `MULTIPLE_CHOICE` response semantics and NONE/STRUCTURED/IMAGE content.
Text and structured source types require text choices; the visual source type
requires an IMAGE stimulus and image-only choices. Unknown fields/types/schema
versions, non-VERIFIED items, missing or duplicate question numbers, incomplete
declared ranges, invalid text/options/labels/order, missing or unmatched answers,
unsupported/malformed structured content, missing/extra assets and invalid image
bytes all fail the complete preflight. Nothing invalid is silently skipped.

The accepted eight-subtype validator is reused unchanged. Structured rows,
groups, sequences, strings and numbers are preserved without flattening. Required
canonical text is preserved exactly, including meaningful whitespace. Question
number is retained as source identity and runtime question order. Option array
order is the default; explicit source option orders, if present for every option,
must be bounded and unique and are preserved. Labels such as F/G/H/J/K are never
replaced by index-derived letters. Exactly one option matching the verified
`correctAnswer` label receives `isCorrect: true`; candidate answers are ignored.

The known extractor envelope has no declared schema version; unknown explicit
version fields fail closed. `scope`/`rules` and extraction provenance are retained
in the committed manifest, not copied into runtime question DTOs or used to infer
answers. The complete declared question range must be present.

Package bounds: 2 MiB manifest; 500 questions; 13,501 files; directory depth 8;
128 MiB total image bytes; each image uses the existing lower-of-configured-limit
and 5 MiB cap. All accepted question/option/structured-content bounds still apply.

## Path containment

The operator entrypoint uses the fixed `backend/exam-content/olsat/` root. No
runtime `--root` or HTTP import route exists. Manifest paths must be canonical
relative POSIX paths below `assets/`, with safe ASCII segments and PNG/JPG/JPEG
extensions. Absolute/drive/URL/backslash/traversal/encoded/hidden path tricks fail.
Exact inventory matching catches casing mismatches even on Windows.

The root must resolve to the same real directory. Package symlinks/junctions and
non-regular files are rejected, including links that could escape the root.
Reads check real-path containment, file identity, regular-file status and bounded
size, use no-follow open where supported, and limit streamed bytes before
snapshotting. Source files are never promoted or moved out of the package.

## Media, atomic persistence and duplicate safety

`ExamContentImporter` passes each referenced source image's exact bytes to
`ExamMediaService.createImage`. There is no resize/crop/re-encoding/optimization.
Only resulting media UUIDs are bound to `stimulusMediaId` and option `mediaId`;
package paths never enter runtime media fields. The resulting questions are
validated again before one bounded repository transaction creates the import
identity and all question/option records. Existing questions are neither replaced
nor deleted. Applicant selection/scoring and API projections remain unchanged.

Migration: `backend/prisma/migrations/20261029020000_exam_import_identity/migration.sql`.
New `ExamContentImport` holds the fixed package key `olsat`, an exact-source
SHA-256 fingerprint, expected question count and creation timestamp. Questions
gain nullable `sourceImportId` and `sourceQuestionNumber`, with a composite unique
key and restrictive FK. The fingerprint covers length-prefixed manifest bytes,
sorted referenced asset paths and their exact bytes. No correctness authority is
duplicated. Legacy rows retain null source metadata; no backfill/rewrites occur.

A second identical import with the expected actual question count returns
`ALREADY_IMPORTED` before creating media. Changed package bytes or an incomplete
existing import produce `SOURCE_CONFLICT`, without repairing/replacing content.
Unique package and per-question identities prevent competing imports from
committing duplicates. A losing concurrent run reports failure and compensates
only its own newly created media; it does not overwrite the winner. This does not
reconcile later manual edits or implement historical question snapshots.

All question/option/import-marker writes share one Prisma transaction with a
60-second timeout and 10-second maximum wait. Media records/promotions precede
that transaction and cannot participate in a filesystem/DB distributed transaction.
On media/bank persistence failure, the importer attempts cleanup only for IDs
successfully created in that run. Guarded media deletion requires the same
provider/key and no question or option reference. Restrictive FKs protect races.

Cleanup first removes an unreferenced media row, then its private object. A
physical-delete failure leaves a detectable orphan rather than a broken live
question; a referenced object is retained. Cleanup errors do not stop later
cleanup attempts. Failures report only safe removed/retained/failed counts, never
raw provider/database exceptions or keys. A commit acknowledgement failure may
leave a complete authoritative import; linked media is protected, and a later
identical retry detects that complete import. Process crashes can still leave
unattached media records/objects requiring operator review. No success is returned
for a partial bank, and no pre-existing media is selected for compensation.

## Operator contract and deterministic summary

After build, `npm run exam-content:preflight` (or the CLI without arguments)
performs read-only preflight. It loads environment limits but never loads the DB
or private storage provider. Unknown/ambiguous arguments fail closed.

`npm run exam-content:import` explicitly selects `--apply`; this command was
**not executed** against the project development database. Controlled full-bank
execution remains EXAM-CONTENT-6 after owner authorization and migration review.

Summaries contain status (PREFLIGHT_OK / IMPORTED / ALREADY_IMPORTED), validated
and imported question counts, source type/stimulus/subtype counts, visual-option
count, asset/source-file counts and media-created count. They contain no answer
labels/correctness, filesystem paths, private keys/provider or raw media records.

## Automated verification and its limits

Importer orchestration tests use isolated/mocked DB and media interfaces with
synthetic packages. Existing media tests exercise real temporary private storage
and now include guarded compensation. Repository tests verify transactional write
boundaries and rejection propagation; migration tests verify additive identity
constraints. These are **not** a real database import/deployment rehearsal.

Read-only package-contract and CLI tests validate the actual owner-provided
manifest and images, assert the known distributions and source hashes, and prove
that default/preflight mode does not load DB/private-provider modules. Destructive
and failure tests modify only generated temporary synthetic fixtures.

Commands executed from `backend`, except Git/source-integrity checks at repo root:

```powershell
npx prisma format
npx prisma validate
npx prisma generate
npm run build
npm run exam-content:preflight
```

All passed. Prisma Client generation used installed 7.10.0. Unrelated pre-existing
formatting outside the exam/import models was restored after format, and final
schema validation passed again. The final build/preflight passed after adding
environment loading for consistent configured image limits.

```powershell
$baseline = Join-Path $env:TEMP 'exam-content-3-baseline.prisma'
git show 1fec84faa56854cee993bc7c7c030057c54dc618:backend/prisma/schema.prisma | Set-Content -LiteralPath $baseline
npx prisma migrate diff --from-schema $baseline --to-schema prisma/schema.prisma --script
```

Passed; generated SQL was compared programmatically to the committed migration
with comments/whitespace removed: **exact match**. No migration was deployed.

```powershell
npm test -- tests/unit/services/exam-content-package.test.ts tests/unit/services/exam-content-import.test.ts tests/unit/services/exam-content-real-package.test.ts tests/unit/repositories/exam-content-import.repository.test.ts tests/unit/cli/exam-content-import.test.ts tests/unit/migrations/exam-import-identity.test.ts tests/unit/services/exam-content.rules.test.ts tests/unit/repositories/exam-engine.repository.test.ts tests/unit/services/exam-media.service.test.ts tests/unit/repositories/exam-media.repository.test.ts tests/unit/routes/exam-media.routes.test.ts tests/unit/migrations/exam-mixed-content.test.ts tests/unit/migrations/exam-private-media.test.ts
```

**13 files / 214 tests passed**, no skips or failures. The existing Vite
CommonJS/config-loader advisory remains informational. Final focused follow-ups:

```powershell
npm test -- tests/unit/cli/exam-content-import.test.ts
npm test -- tests/unit/services/exam-content-import.test.ts
```

Passed 6 CLI tests after environment-loading adjustment and 9 orchestration tests
after clarifying the competing-import compensation case. No full-suite expansion
was needed. `git diff --check` and staged `git diff --cached --check` passed.
`git check-attr text` reports `unset` for source manifest/images; a final raw-byte
comparison verifies every staged source blob matches the original owner snapshot.

Intentionally not run: full backend suite; frontend build/lint/tests; real/dev or
production DB migration and full-bank import; hosted CI; browser/manual/UI/content
QA. The project development database was **not populated**. Phase 6 content
verification remains separate from this package's structural/type preflight.

## Deferred scope and stop boundary

No EXAM-CONTENT-4 Admin editor/UI; EXAM-CONTENT-5 Applicant renderer/UI;
EXAM-CONTENT-6 full-bank development import or final content QA; or Phase B timer,
autosave, recovery, submission, scheduling, activation/selection, scoring-denominator
or historical-snapshot changes were implemented. Existing user-authored questions
are retained, so future full-bank QA must consider the existing shared-bank policy.
No manual/browser QA is claimed. Commit/push on the existing branch, do not merge
`main`, and stop for independent review and project-owner authorization.

## Exact changed-file inventory

`.gitattributes`
`backend/package.json`
`backend/exam-content/olsat/assets/q004/option_F.png`
`backend/exam-content/olsat/assets/q004/option_G.png`
`backend/exam-content/olsat/assets/q004/option_H.png`
`backend/exam-content/olsat/assets/q004/option_J.png`
`backend/exam-content/olsat/assets/q004/option_K.png`
`backend/exam-content/olsat/assets/q004/stimulus.png`
`backend/exam-content/olsat/assets/q008/option_F.png`
`backend/exam-content/olsat/assets/q008/option_G.png`
`backend/exam-content/olsat/assets/q008/option_H.png`
`backend/exam-content/olsat/assets/q008/option_J.png`
`backend/exam-content/olsat/assets/q008/option_K.png`
`backend/exam-content/olsat/assets/q008/stimulus.png`
`backend/exam-content/olsat/assets/q012/option_F.png`
`backend/exam-content/olsat/assets/q012/option_G.png`
`backend/exam-content/olsat/assets/q012/option_H.png`
`backend/exam-content/olsat/assets/q012/option_J.png`
`backend/exam-content/olsat/assets/q012/option_K.png`
`backend/exam-content/olsat/assets/q012/stimulus.png`
`backend/exam-content/olsat/assets/q019/option_A.png`
`backend/exam-content/olsat/assets/q019/option_B.png`
`backend/exam-content/olsat/assets/q019/option_C.png`
`backend/exam-content/olsat/assets/q019/option_D.png`
`backend/exam-content/olsat/assets/q019/option_E.png`
`backend/exam-content/olsat/assets/q019/stimulus.png`
`backend/exam-content/olsat/assets/q022/option_F.png`
`backend/exam-content/olsat/assets/q022/option_G.png`
`backend/exam-content/olsat/assets/q022/option_H.png`
`backend/exam-content/olsat/assets/q022/option_J.png`
`backend/exam-content/olsat/assets/q022/option_K.png`
`backend/exam-content/olsat/assets/q022/stimulus.png`
`backend/exam-content/olsat/assets/q029/option_A.png`
`backend/exam-content/olsat/assets/q029/option_B.png`
`backend/exam-content/olsat/assets/q029/option_C.png`
`backend/exam-content/olsat/assets/q029/option_D.png`
`backend/exam-content/olsat/assets/q029/option_E.png`
`backend/exam-content/olsat/assets/q029/stimulus.png`
`backend/exam-content/olsat/assets/q031/option_A.png`
`backend/exam-content/olsat/assets/q031/option_B.png`
`backend/exam-content/olsat/assets/q031/option_C.png`
`backend/exam-content/olsat/assets/q031/option_D.png`
`backend/exam-content/olsat/assets/q031/option_E.png`
`backend/exam-content/olsat/assets/q031/stimulus.png`
`backend/exam-content/olsat/assets/q032/option_F.png`
`backend/exam-content/olsat/assets/q032/option_G.png`
`backend/exam-content/olsat/assets/q032/option_H.png`
`backend/exam-content/olsat/assets/q032/option_J.png`
`backend/exam-content/olsat/assets/q032/option_K.png`
`backend/exam-content/olsat/assets/q032/stimulus.png`
`backend/exam-content/olsat/assets/q041/option_A.png`
`backend/exam-content/olsat/assets/q041/option_B.png`
`backend/exam-content/olsat/assets/q041/option_C.png`
`backend/exam-content/olsat/assets/q041/option_D.png`
`backend/exam-content/olsat/assets/q041/option_E.png`
`backend/exam-content/olsat/assets/q041/stimulus.png`
`backend/exam-content/olsat/assets/q043/option_A.png`
`backend/exam-content/olsat/assets/q043/option_B.png`
`backend/exam-content/olsat/assets/q043/option_C.png`
`backend/exam-content/olsat/assets/q043/option_D.png`
`backend/exam-content/olsat/assets/q043/option_E.png`
`backend/exam-content/olsat/assets/q043/stimulus.png`
`backend/exam-content/olsat/assets/q048/option_F.png`
`backend/exam-content/olsat/assets/q048/option_G.png`
`backend/exam-content/olsat/assets/q048/option_H.png`
`backend/exam-content/olsat/assets/q048/option_J.png`
`backend/exam-content/olsat/assets/q048/option_K.png`
`backend/exam-content/olsat/assets/q048/stimulus.png`
`backend/exam-content/olsat/assets/q054/option_F.png`
`backend/exam-content/olsat/assets/q054/option_G.png`
`backend/exam-content/olsat/assets/q054/option_H.png`
`backend/exam-content/olsat/assets/q054/option_J.png`
`backend/exam-content/olsat/assets/q054/option_K.png`
`backend/exam-content/olsat/assets/q054/stimulus.png`
`backend/exam-content/olsat/assets/q056/option_F.png`
`backend/exam-content/olsat/assets/q056/option_G.png`
`backend/exam-content/olsat/assets/q056/option_H.png`
`backend/exam-content/olsat/assets/q056/option_J.png`
`backend/exam-content/olsat/assets/q056/option_K.png`
`backend/exam-content/olsat/assets/q056/stimulus.png`
`backend/exam-content/olsat/assets/q059/option_A.png`
`backend/exam-content/olsat/assets/q059/option_B.png`
`backend/exam-content/olsat/assets/q059/option_C.png`
`backend/exam-content/olsat/assets/q059/option_D.png`
`backend/exam-content/olsat/assets/q059/option_E.png`
`backend/exam-content/olsat/assets/q059/stimulus.png`
`backend/exam-content/olsat/assets/q063/option_A.png`
`backend/exam-content/olsat/assets/q063/option_B.png`
`backend/exam-content/olsat/assets/q063/option_C.png`
`backend/exam-content/olsat/assets/q063/option_D.png`
`backend/exam-content/olsat/assets/q063/option_E.png`
`backend/exam-content/olsat/assets/q063/stimulus.png`
`backend/exam-content/olsat/assets/q066/option_F.png`
`backend/exam-content/olsat/assets/q066/option_G.png`
`backend/exam-content/olsat/assets/q066/option_H.png`
`backend/exam-content/olsat/assets/q066/option_J.png`
`backend/exam-content/olsat/assets/q066/option_K.png`
`backend/exam-content/olsat/assets/q066/stimulus.png`
`backend/exam-content/olsat/assets/q068/option_F.png`
`backend/exam-content/olsat/assets/q068/option_G.png`
`backend/exam-content/olsat/assets/q068/option_H.png`
`backend/exam-content/olsat/assets/q068/option_J.png`
`backend/exam-content/olsat/assets/q068/option_K.png`
`backend/exam-content/olsat/assets/q068/stimulus.png`
`backend/exam-content/olsat/assets/q070/option_F.png`
`backend/exam-content/olsat/assets/q070/option_G.png`
`backend/exam-content/olsat/assets/q070/option_H.png`
`backend/exam-content/olsat/assets/q070/option_J.png`
`backend/exam-content/olsat/assets/q070/option_K.png`
`backend/exam-content/olsat/assets/q070/stimulus.png`
`backend/exam-content/olsat/manifest.json`
`backend/prisma/migrations/20261029020000_exam_import_identity/migration.sql`
`backend/prisma/schema.prisma`
`backend/src/cli/exam-content-import.ts`
`backend/src/interfaces/exam-content-import.interfaces.ts`
`backend/src/repositories/exam-content-import.repository.ts`
`backend/src/repositories/exam-media.repository.ts`
`backend/src/services/exam-content-import.service.ts`
`backend/src/services/exam-content-package.service.ts`
`backend/src/services/exam-media.service.ts`
`backend/tests/fixtures/exam-package.ts`
`backend/tests/unit/cli/exam-content-import.test.ts`
`backend/tests/unit/migrations/exam-import-identity.test.ts`
`backend/tests/unit/repositories/exam-content-import.repository.test.ts`
`backend/tests/unit/repositories/exam-media.repository.test.ts`
`backend/tests/unit/services/exam-content-import.test.ts`
`backend/tests/unit/services/exam-content-package.test.ts`
`backend/tests/unit/services/exam-content-real-package.test.ts`
`backend/tests/unit/services/exam-media.service.test.ts`
`docs/superpowers/reports/2026-10-29-exam-content-3.md`
