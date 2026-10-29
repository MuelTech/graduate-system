# EXAM-CONTENT-1 implementation evidence

Date: 2026-10-29 (Asia/Manila). Implementation checkpoint, pending independent
review and project-owner acceptance; this does not mark Phase A accepted.

Repository: `MuelTech/graduate-system`.
Branch: `feat/exam-content-integration`.
Approved starting local/fetched `main`: `f5d5cbae4e8948a9a0065e0cfd469975f6427c86`.
The working tree was clean before branch creation. No existing local or fetched
remote Phase A branch was found. No merge to `main` is part of this package.

## Persistent and API contract

`QuestionType` remains `MULTIPLE_CHOICE | ESSAY`. `ExamQuestion` gains
`stimulusType: NONE | IMAGE | STRUCTURED` (default `NONE`), nullable
`stimulusMediaId` (UUID domain identity), and nullable `structuredStimulus` JSON.
Canonical `questionText` remains required searchable/fallback/instruction text.

`ExamOption` retains `isCorrect` as the sole runtime answer authority and keeps
its existing ID and `order`. It gains nullable `label` and opaque UUID `mediaId`;
`optionText` becomes nullable so image-only choices need no invented text.
This package accepts exactly one of text or image per option. Independent columns
leave future text+image support possible without a destructive schema change.
There is no separate option-kind or duplicated question-level correct answer.

Media IDs are **reserved domain references**, not storage keys, provider metadata,
repository asset paths, URLs, or proof of an existing/authorized image. No media
record, storage operation, media endpoint, authorization, foreign-key lifecycle,
upload, retrieval, or public/static asset delivery is implemented here.
EXAM-CONTENT-2 must establish that private lifecycle before images can be served.

The external verified manifest was read as data only. Neither it nor its assets
were copied into the repository. All 29 structured stimuli were checked against
the validator without importing questions or media. Tests use synthetic content.

## Structured validation

`structuredStimulus` preserves the manifest's discriminator and payload keys:

| Discriminator | Payload | Validation |
| --- | --- | --- |
| `MATRIX` | `rows: (string \| number)[][]` | Nonempty rectangular rows, bounded text/finite numbers |
| `GROUPED_NUMBER_ROWS` | `groups: (string \| number)[][]` | Nonempty equal-width groups, numeric/fraction/`?` cells |
| `NUMBER_SEQUENCE` | `items: (string \| number)[]` | Finite numbers, numeric/fraction strings or `?` |
| `WORD_BANK` | `items: string[]` | Nonempty bounded strings |
| `ALPHANUMERIC_SEQUENCE` | `items: string[]` | Alphanumeric tokens or `?` |
| `WORD_SERIES` | `items: string[]` | Nonempty bounded strings |
| `LETTER_SEQUENCE` | `items: string[]` | Individual letters or `?` |
| `LOGICAL_PREMISES` | `items: string[]` | Nonempty bounded premise strings |

The last two subtypes were found in the actual manifest beyond the six examples
in the planning documents. Fraction strings remain strings; no structure is
flattened or inferred. Unknown discriminators/keys and malformed shapes fail
closed. Limits: 30 rows/groups, 30 cells per row, 100 list items, 500 characters
per cell/item, 26 options, 20,000 question-text and 10,000 option-text characters.
Orders must be nonnegative 32-bit integers. Labels are 1–8 uppercase letters/digits.
Media IDs accept UUID syntax only. Runtime validation is independent of Prisma's
open JSON type; structured JSON is validated again on projection.

`NONE` allows no stimulus data; `IMAGE` requires only a media ID; `STRUCTURED`
requires only a supported structured payload. MCQ requires at least two choices
and exactly one `isCorrect: true`; essay questions carry no options. Unknown
request fields, duplicated option IDs/labels/orders, and partially labeled sets
are rejected. All labels may be absent/null for legacy clients. Explicit source
labels are never inferred from array index; supplied orders are preserved.
Absent option order defaults to array index for existing text-only clients.

## Backend boundaries and compatibility

Create accepts `unknown` at the service boundary and validates before persistence.
Update accepts `unknown`, reads current content within the transaction, merges
the bounded patch and validates the effective question before writes. A stimulus
transition must clear the prior payload explicitly; MCQ-to-essay must explicitly
supply `options: []`. No unrelated answer/submission semantics were changed.
Question validation errors return HTTP 400, missing updates 404, and unsafe
historical-option replacement 409; unexpected mutation errors return a generic
500 message.

Applicant and Admin use separate explicit Prisma selects and DTO allowlists.
Applicant receives canonical text, response type, stimulus type/payload/media ID,
option identity/text/media ID/label/order and existing question ordering. It
never receives `isCorrect`, private paths, storage keys/provider, provenance or
arbitrary persisted metadata. Admin additionally receives option correctness.
Selection/scoring still uses `ApplicantAnswer.selectedOptionId` and
`ExamOption.isCorrect`, including image-only choices.

Migration: `backend/prisma/migrations/20261029000000_exam_mixed_content/migration.sql`.
Two `ALTER TABLE` statements add nullable/defaulted columns and relax text
nullability. No row backfill, table replacement, ID/order/correctness rewrite,
answer change, or destructive migration is required. Legacy labels stay null;
all existing text remains intact. Queries break legacy order ties by stable ID.
Metadata-only edits tolerate legacy tied option orders using a validation-only
index; they do not rewrite persisted options.

Updates with existing option IDs retain those IDs; foreign IDs are rejected.
Existing clients may still replace options without IDs when no removed option
is referenced by an Applicant answer. Replacement of referenced options fails
before deletion. This is a bounded integrity safeguard, not a full editing/history
redesign. The current Admin page omits IDs, so attempts to replace answered choices
will now be rejected; UI integration is deferred to EXAM-CONTENT-4.

Existing question deletion still cascades through its dependent records, mutable
content/correctness still lacks historical snapshots, and the wider editing and
concurrent attempt lifecycle remain deferred. Existing timer, autosave, essay,
submission, scheduling and question-selection concerns remain Phase B.
Frontend types/pages were inspected but not changed; their text-oriented contracts
and renderers need the explicitly separate EXAM-CONTENT-4/5 work.

## Automated verification

Added tests cover all observed structured forms, malformed/unsupported payloads,
legacy text/NONE, image-only options and opaque IDs, labels/order, MCQ/essay
combinations, bounded partial updates, Applicant projection privacy, Admin
correctness, stable option identities, historical replacement refusal, existing
selectedOptionId scoring, HTTP/service boundaries, and migration compatibility.

Commands run from `backend` unless stated otherwise:

- `npx prisma format` — passed; unrelated pre-existing schema formatting was
  restored afterward to keep the committed diff limited to the exam blocks.
- `npx prisma validate` — passed.
- `npx prisma generate` — passed (installed Prisma client 7.10.0).
- `npm run build` — passed.
- Approved baseline schema exported with `git show
  f5d5cbae4e8948a9a0065e0cfd469975f6427c86:backend/prisma/schema.prisma` to a
  temporary file; `npx prisma migrate diff --from-schema <baseline-file>
  --to-schema prisma/schema.prisma --script` — passed; SQL changes match the
  committed migration (column-clause order is immaterial).
- `npm test -- tests/unit/services/exam-content.rules.test.ts
  tests/unit/repositories/exam-engine.repository.test.ts
  tests/unit/services/exam-record-detail.service.test.ts
  tests/unit/repositories/exam-record.repository.test.ts
  tests/unit/routes/exam-record.routes.test.ts` — initial focused run: 5 files,
  99 tests passed.
- `npm test` — initial full run: 200 files passed, 2,655 tests passed, 5 skipped.
- Read-only `node -e` assertion against the supplied external manifest using
  compiled `validateStructuredStimulus` — 29 stimuli, all eight subtypes passed.
- `git diff --check` (repository root) — passed.

Final post-change run: `npx prisma validate; npm run build; npm test` — schema
validation and TypeScript build passed; **203 test files passed, 2,668 tests
passed, 5 skipped (2,673 total)**. This includes all five new focused test files
and the existing exam-record repository/service/route tests.
No live database migration/deployment or database-backed rehearsal was executed.
No frontend/shared contracts were modified, so no frontend checks are claimed.
Vitest emits the existing Vite CommonJS/config-loader advisory; it is not a failure.

Exact baseline diff command (PowerShell, from `backend`):

```powershell
$baseline = Join-Path $env:TEMP 'exam-content-1-baseline.prisma'
git show f5d5cbae4e8948a9a0065e0cfd469975f6427c86:backend/prisma/schema.prisma | Set-Content -LiteralPath $baseline
npx prisma migrate diff --from-schema $baseline --to-schema prisma/schema.prisma --script
```

Exact read-only manifest assertion (from `backend`, after build):

```powershell
node -e 'const fs = require("fs"); const { validateStructuredStimulus } = require("./dist/services/exam-content.rules"); const m = JSON.parse(fs.readFileSync("D:/Backup/BSIT-3B/CAPSTONE/Project/refactor/EXAM/results/OLSAT_Extraction_Verified/manifest.json", "utf8")); const stimuli = m.questions.map(q => q.stimulus).filter(s => s && s.type !== "IMAGE"); for (const s of stimuli) validateStructuredStimulus(s); console.log(JSON.stringify({validated: stimuli.length, subtypes: [...new Set(stimuli.map(s => s.type))]}));'
```

## Exact files changed

1. `backend/prisma/schema.prisma`
2. `backend/prisma/migrations/20261029000000_exam_mixed_content/migration.sql`
3. `backend/src/interfaces/exam-content.interfaces.ts`
4. `backend/src/repositories/exam-content.projection.ts`
5. `backend/src/repositories/exam-engine.repository.ts`
6. `backend/src/services/exam-content.rules.ts`
7. `backend/src/services/exam-engine.service.ts`
8. `backend/src/controllers/exam-engine.controller.ts`
9. `backend/tests/unit/services/exam-content.rules.test.ts`
10. `backend/tests/unit/services/exam-engine-content.service.test.ts`
11. `backend/tests/unit/repositories/exam-engine.repository.test.ts`
12. `backend/tests/unit/controllers/exam-engine-content.controller.test.ts`
13. `backend/tests/unit/migrations/exam-mixed-content.test.ts`
14. `docs/superpowers/reports/2026-10-29-exam-content-1.md`

## Stop boundary

No EXAM-CONTENT-2 private media; EXAM-CONTENT-3 source package/importer;
EXAM-CONTENT-4 Admin UI; EXAM-CONTENT-5 Applicant UI; EXAM-CONTENT-6 bank import;
or Phase B timer/autosave/submission/scheduling changes were implemented.
No manual/browser/content QA is claimed. Stop after commit/push and await
independent review and explicit owner authorization for the next package.
