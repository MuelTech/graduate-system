# EXAM-CONTENT-6 — Verified bank import and content QA evidence

Date: 2026-10-29 (Asia/Manila). Controlled development-database operations and
automated/source evidence only. **EXAM-CONTENT-6 and Phase A are NOT formally
accepted. Independent review and project-owner Admin/Applicant browser/content
QA remain pending. No manual/browser/content QA was performed by the agent.**

Repository: `MuelTech/graduate-system`. Existing branch:
`feat/exam-content-integration`. Accepted starting local and fetched remote HEAD:
`11084461810ba355e7d0d57217f0e63dbc2255d9`. Initial and resumed fetches matched
that checkpoint exactly; the tree was clean. No fast-forward was necessary.
No new branch, reset, rebase, stash, merge, or change to `main` was used.

The canonical source of truth, implementation plan, checklist, and EC1–EC5
reports were consulted before operations. Accepted architecture was reused.
The sole repository change in this package is this report. The database/private
media import is local development state; pushing this report does not populate
another developer's database or deploy the bank elsewhere.

## Source/package evidence

Controlled input: `backend/exam-content/olsat/manifest.json` and `assets/`.

- 72 questions, numbered 1–72; all 72 explicitly `VERIFIED`.
- 108 unique referenced PNG assets: 18 question stimuli and 90 option images.
- 109 package files total; no missing, extra, or unreferenced files.
- Read-only CLI preflight passed before cleanup and again after cleanup:
  `PREFLIGHT_OK`, 72 validated, 0 imported, 0 media created, 108 assets.
- Every expected category/subtype distribution matched; see the tables below.
- Manifest SHA-256 remained
  `0327342827f9afafeadb65b88f18e9bb4f21b2c513fe6edfdb9104ab16abd3d9`.
- Exact package fingerprint:
  `a0126af9597439db7b8536ec2cae6a753cfeece68d3b038f9c1eb6c7dd83f263`.
- Before import and after both imports, every on-disk source file's raw Git blob
  hash matched the corresponding blob from the accepted starting commit.
  All 109 files were checked, including every image. No source file was edited,
  reformatted, renamed, regenerated, cropped, resized, or re-encoded.
- Source-package Git diff against the accepted checkpoint was empty.

## Pre-import DB evidence and revised cleanup authorization

`npx prisma migrate status`, run from `backend`, reported **44 migrations and
database schema up to date**. The required
`20261029020000_exam_import_identity` migration was additionally read from the
migration ledger: finished, with no rollback timestamp. No migration deployment,
schema change, or new migration was needed or performed. Backend build passed
before using the compiled operational CLI.

Initial state: **0 import markers, 0 sourced questions, 0 sourced OLSAT rows**.
The complete development bank comprised the following nine questions. Both
`sourceImportId` and `sourceQuestionNumber` were null for every row. MCQ below
means runtime `MULTIPLE_CHOICE`. Prefixes identify temporary content only.

| Exact question ID | Order | Runtime type | Stimulus | Identifying text prefix | Options | ApplicantAnswer refs | Selected-option refs |
| --- | ---: | --- | --- | --- | ---: | ---: | ---: |
| `1874e36c-a37d-4eac-ad2c-f9e8dfe80f12` | 1 | ESSAY | NONE | UIUX Fixture — Discuss how graduate research… | 0 | 1 | 0 |
| `985312f0-7d11-411c-a1b0-fface6261d52` | 1 | MCQ | NONE | [DEMO] Which statement best describes academic research? | 4 | 0 | 0 |
| `1f6a36e2-02b2-42d0-8111-654ed05b061f` | 2 | MCQ | NONE | [DEMO] If all graduate students are researchers… | 4 | 0 | 0 |
| `aa7ab07f-da93-4005-a6fd-823dba758850` | 3 | MCQ | NONE | [DEMO] Which source is generally most appropriate… | 4 | 0 | 0 |
| `f598ec72-dc5a-4cc4-91c8-0f2d78a99d4c` | 4 | MCQ | NONE | [DEMO] What is the main purpose of citing sources… | 4 | 0 | 0 |
| `78d646f5-b907-44b7-a930-7b7ddee1e266` | 5 | MCQ | NONE | [DEMO] Which practice best demonstrates responsible academic work? | 4 | 0 | 0 |
| `315fd8ae-3b9c-45aa-9d5f-d0729a07f91a` | 6 | ESSAY | NONE | [DEMO] In 3–5 sentences, explain why… | 0 | 0 | 0 |
| `d0acd8de-3eee-47aa-bacc-400fdf36473e` | 7 | MCQ | STRUCTURED | Study the number pattern below… | 5 | 0 | 0 |
| `eb8e32d2-48e6-4a1a-b198-97e8f5ba346b` | 8 | MCQ | IMAGE | For the stimulus image, upload a very simple test image containing: | 5 | 0 | 0 |

The initial execution correctly stopped without deletion because the UIUX essay
had one persisted answer. The owner then explicitly confirmed all nine questions
and the involved attempt as development/synthetic data and authorized a bounded
synthetic lifecycle reset, with accounts/profiles and unrelated data preserved.
That revised authorization also positively identified the image QA row despite
its wording differing from the originally supplied example. No classification
was based solely on null source identity.

### Affected attempt inventory, captured before mutation

| Model | Exact ID | Relevant pre-reset state |
| --- | --- | --- |
| ApplicantAnswer | `aef14dc0-5d7f-4c36-ab50-a4845a6f3998` | Belongs to the application below and the UIUX essay above; selected option null; synthetic essay present. Essay text was not reproduced. |
| EntranceExamScore | `8e161032-a292-4f63-907a-7700e75a0e46` | Same application; result `PENDING`. |
| EntranceExamApplication | `6862322f-ca35-4e2b-830d-175bb4639c09` | `TAKEN`; one answer and one score; only application for the affected Student. |
| Student, preserved | `1d29b966-081b-4364-bf4c-bd69cf89e30d` | `APPLICANT`; owning User also remains `APPLICANT`. |
| User, preserved | `1cdb2c1e-edd9-41cd-823a-66853ae15ed9` | Account and all scalar fields unchanged. |
| ExamSlot, preserved | `c6cdc6eb-75e4-4426-8ac6-292a34b66ecd` | Capacity 5; `slotsTaken = 0`, but actual application count was 1. |

There were four applications overall and two scores. Only the application linked
to the persisted synthetic answer was required for this reset. The other three
applications were inventoried and preserved, together with their remaining score:

| Preserved application ID | Status | Slot ID | Occupancy before and after |
| --- | --- | --- | --- |
| `40225e70-adea-4299-8768-8e57c6754d14` | PENDING | `c84a8fee-70a5-40c3-8cf5-9e87c5d3d0be` | 1 recorded / 1 application |
| `5d3213a8-ecf8-447a-9e91-78ae7605fb32` | PASSED | `726bf8fe-3f0a-4edc-99cd-db29443a60a8` | 1 recorded / 1 application |
| `bb1485d0-ecf6-4ae4-b9e2-366b0b4b7bb5` | PENDING | `657e6459-9c79-4623-828d-c9cdc649b647` | 1 recorded / 1 application |

The preserved PASSED application's score ID is
`ddbda696-34d7-40b4-bb27-97f66ea7c02c`; its ENROLLED Student and STUDENT User
were unchanged. No other application's status, schedule, score, or account was
reset merely because it existed in the development database.

### Exact transactional cleanup and preservation checks

A one-off workspace-external Prisma harness first produced a read-only inventory.
Its explicitly selected IDs and expected relationships were then rechecked inside
one **Serializable** transaction (60-second timeout). It locked the affected slot,
application, and exact nine question rows. The transaction asserted the entire
question-ID set and the expected answer/score/application relationships before
deleting anything. It did not introduce a permanent reset command or endpoint.

The transaction performed, in order:

1. Explicitly deleted the one authorized synthetic answer by its exact ID and
   application ID; required delete count 1.
2. Deleted the one score by its exact ID and application ID; required count 1.
3. Deleted the one application by its exact ID, Student ID, and slot ID;
   required count 1.
4. Counted remaining applications for the exact affected slot and assigned that
   count to `slotsTaken`. Result: **0 remaining applications / slotsTaken 0**.
   It did not decrement the already-zero counter or delete the slot.
5. Required **zero question-answer references and zero selected-option references**
   across all nine question candidates, then deleted only the nine exact IDs.
   Their **30 options** were removed by the existing question-option cascade.
   No answer was silently removed by question cascade.
6. Required the empty pre-import question/option/import-marker state, absence of
   all affected attempt state, and unchanged unrelated-record digests before commit.

**Committed cleanup:** 1 answer, 1 score, 1 application, 9 questions, 30 options.
No broad null-source deletion predicate was used. The answer reference was **not
zero at initial inventory**; it became zero through the expressly authorized
synthetic-answer deletion before any question was deleted.

Immediate post-cleanup checks: **0 total/demo/temp questions, 0 options,
0 import markers, 0 sourced OLSAT questions**. The affected Student had **0 exam
applications**, and the removed application had **0 answers / 0 scores**. Thus
the removed TAKEN application no longer supplies a stale scheduling/status block
for that account. This is a database-state assertion, not a browser lifecycle test.
Other eligibility/profile rules were not changed.

Before/after sorted-row SHA-256 digests and counts matched for **59 preserved
model/row sets**. These covered all non-mutated Prisma models and the unrelated
applications, scores, answers, and slots. **All 56 Users and 44 Students were
preserved with every scalar field unchanged**, including admission/role/profile
state. All six existing ExamMedia rows were preserved; formerly attached QA media
was left unattached. No storage garbage collection was performed. The final
post-import verification again matched these preserved records, accounting
separately for the 108 newly imported media rows.

## Import evidence and idempotency

Only after the successful reset, empty-state verification, repeated preflight,
and complete source-byte comparison was `npm run exam-content:import` executed.

| Invocation | CLI result | Questions imported | Media objects created |
| --- | --- | ---: | ---: |
| First real development-bank import | `IMPORTED` | 72 | 108 |
| One identical repeat, after full reconciliation | `ALREADY_IMPORTED` | 0 | 0 |

Both commands exited 0. Neither reported conflict, failure, or compensation
warnings. The import marker is **`olsat`**, with exactly one row, declared count
72, and fingerprint matching the complete authoritative package.

Between the first successful reconciliation and the identical repeat, sorted
complete-row digests/counts were captured for the question, option, media, and
import-marker tables. All remained exactly unchanged after the repeat:
72 questions, 360 options, 114 total media rows, 1 marker. The 114 media rows
include six preserved staging/QA rows; only **108 distinct imported-bank media
references** are used as imported-asset evidence.

## Post-import database/content evidence

Final bank: **72 authoritative imported questions; 0 original demo/temp/QA
questions**. All 72 runtime response types are `MULTIPLE_CHOICE`. There are
360 options: 270 text and 90 image.

Source identity: 72 distinct source numbers, min 1, max 72, 0 nulls, 0 duplicates.
All questions have `sourceImportId = olsat`, and runtime order equals source
question number. There are no unsourced questions left in the active shared bank.

| Source question category | Source and DB-compatible count | Runtime stimulus |
| --- | ---: | --- |
| TEXT_MULTIPLE_CHOICE | 25 | NONE |
| STRUCTURED_STIMULUS_TEXT_CHOICES | 29 | STRUCTURED |
| VISUAL_STIMULUS_VISUAL_CHOICES | 18 | IMAGE |

| Structured subtype | Source and imported DB count |
| --- | ---: |
| MATRIX | 12 |
| WORD_BANK | 4 |
| NUMBER_SEQUENCE | 4 |
| ALPHANUMERIC_SEQUENCE | 1 |
| WORD_SERIES | 2 |
| GROUPED_NUMBER_ROWS | 4 |
| LETTER_SEQUENCE | 1 |
| LOGICAL_PREMISES | 1 |

The read-only reconciliation harness compared **every question and every option
directly with parsed manifest data**, independently of the importer's prepared
question mapping. For all 72 it checked source identity, runtime order, canonical
text, response type, stimulus mode, exact option count/text/label/order, text/image
mode, and exactly one correct option whose label equals verified `correctAnswer`.
**72/72 answer mappings matched.** No answer keys or full protected questions are
reproduced in this report.

All **29 structured payloads passed strict deep equality** with the manifest,
preserving nested matrix rows/cells, grouped rows, list/premise ordering, numeric
versus string identity, fractions, and literal question marks. All 29 also passed
the actual shared frontend `readStructuredStimulus` guard, loaded without a browser.
No content was flattened or inferred. Labels were checked exactly, including
F/G/H/J/K. The actual Applicant option-view helper preserved labels/order and
returned the stored option IDs for **all 360 selection callbacks**.

Importer source review confirms `isCorrect` is derived only from verified
`correctAnswer`; `answerKeyCandidate` is allowed source provenance but is not
read as scoring authority. Runtime projections contain no candidate metadata.
No source package asset paths were persisted as runtime question/option content.

All of these checks passed again after the identical import.

| Broken-reference check across current DB | Count |
| --- | ---: |
| Question → import marker | 0 |
| Question stimulus → media | 0 |
| Option → media | 0 |
| Option → question | 0 |
| ApplicantAnswer → question | 0 |
| ApplicantAnswer selected option → option | 0 |
| ApplicantAnswer → application | 0 |
| EntranceExamScore → application | 0 |

All **9 ExamSlots** were reconciled read-only against actual application counts:
**0 occupancy mismatches**. Only the exact affected slot was written during reset;
all other slot rows remained unchanged.

## Media evidence

- 18 IMAGE stimulus references and 90 image-option references: **108 references**.
- All references are valid opaque UUIDs resolving to 108 existing ExamMedia rows.
- Each of the 108 unique source assets maps to a distinct media identity; no
  source asset is missing, reused, or substituted in that mapping.
- For **108/108**, recorded SHA-256, checksum algorithm, size, and detected MIME
  equal the exact source bytes. All are PNG.
- The real private storage provider opened **all 108 managed objects**; their
  full bytes were compared byte for byte with the source asset and separately
  checked by SHA-256, MIME, and length: **108/108 PASS**, 2,701,556 image bytes.
- The entire media reconciliation passed both before and after idempotency.
- Six old staging/QA media records remain unchanged and unreferenced by the new
  bank. They were excluded from the imported-bank asset count.
- No image processing or public/static/source-path delivery was introduced.
  This report includes no storage keys or private storage filesystem paths.

## Rendering/security evidence

Real database rows were fetched using the production Applicant and Admin selects
and passed through their production DTO projection functions. A recursive check
over all 72 Applicant questions found **no correctness, correctAnswer,
answer-key/candidate metadata, source provenance, storage key/provider, checksum,
fingerprint, or package/private-object path exposure**. Admin options correctly
retain boolean `isCorrect`. Removing that Admin-only field made Admin and
Applicant projected content deeply identical for every question.

Source/contract review confirms both surfaces compose the accepted shared
`StimulusRenderer` / `OptionContentRenderer` / `ExamMediaImage`. The existing
structured renderer retains matrix/group boundaries and ordered lists/premises.
Persisted labels drive both surfaces; Applicant submission still uses option IDs.
No source-question-number-specific UI branch was added.

Private media remains behind authenticated `/api/exam-engine/media/:mediaId`:
Admin/Applicant roles, existing Applicant ownership/time/attachment checks,
private/no-store response headers, opaque UUID references, and generic errors.
The shared client still uses Bearer-authenticated fetch and temporary Blob URLs.
Existing focused route, eligibility, media service, projection, and frontend
contract tests passed. These are automated/source assurances; no real-account
browser session or manual visual comparison is claimed. Authentication and
scheduling policy were unchanged.

No bounded content defect was found, so **no runtime code, renderer, schema,
migration, source content, or test fixture was changed**.

## Owner manual/browser/content QA matrix

**Pending owner execution. The agent did not perform manual/browser/content QA.**
All rows below have runtime response type `MULTIPLE_CHOICE`. Source categories
are abbreviated only in this matrix: TEXT = TEXT_MULTIPLE_CHOICE; STRUCTURED =
STRUCTURED_STIMULUS_TEXT_CHOICES; VISUAL = VISUAL_STIMULUS_VISUAL_CHOICES.

| Source number | Source type | Structured subtype | Expected stimulus mode | Expected option mode |
| --- | --- | --- | --- | --- |
| 1 | TEXT | — | NONE | TEXT |
| 2 | STRUCTURED | MATRIX | STRUCTURED | TEXT |
| 4 | VISUAL | — | IMAGE | IMAGE |
| 6 | STRUCTURED | WORD_BANK | STRUCTURED | TEXT |
| 9 | STRUCTURED | NUMBER_SEQUENCE | STRUCTURED | TEXT |
| 23 | STRUCTURED | ALPHANUMERIC_SEQUENCE | STRUCTURED | TEXT |
| 25 | STRUCTURED | WORD_SERIES | STRUCTURED | TEXT |
| 36 | STRUCTURED | MATRIX | STRUCTURED | TEXT |
| 40 | STRUCTURED | LOGICAL_PREMISES | STRUCTURED | TEXT |
| 42 | STRUCTURED | GROUPED_NUMBER_ROWS | STRUCTURED | TEXT |
| 47 | STRUCTURED | LETTER_SEQUENCE | STRUCTURED | TEXT |
| 72 | TEXT | — | NONE | TEXT |

This covers early/middle/late order, all eight structured forms, text, and visual
content. Source 4 also covers persisted non-A/B/C labels F/G/H/J/K. The owner
should compare Admin preview with Applicant rendering, exact visual assets,
labels/order, structured boundaries, and selection behavior. Numbering refers
to source question numbers, not newly generated database IDs.

## Focused verification commands and results

Commands below ran from `backend` unless stated otherwise.

| Command/check | Exact result |
| --- | --- |
| `git fetch origin feat/exam-content-integration` (repository root) | Approved remote checkpoint matched local HEAD. |
| `npx prisma migrate status` | Exit 0; 44 migrations; database schema up to date. |
| Read-only required-migration ledger query | Import-identity migration finished, not rolled back. |
| `npm run build` | Exit 0; TypeScript backend build passed before operational CLI. |
| `npm run exam-content:preflight` before reset | Exit 0; PREFLIGHT_OK, 72 validated, 0/0 writes. |
| One-off `ec6-reset.cjs`, read-only mode | Complete candidate/attempt/slot inventory and preserved-row digests captured. |
| One-off `ec6-reset.cjs --apply` | Exit 0; exact-ID Serializable transaction committed; expected counts and preservation assertions passed. |
| One-off `ec6-verify.cjs --source-only` after reset | Exit 0; 109 source blobs match approved checkpoint, expected SHA-256/counts. |
| `npm run exam-content:preflight` after reset | Exit 0; PREFLIGHT_OK, 72 validated, 0/0 writes. |
| `npm run exam-content:import`, first invocation | Exit 0; IMPORTED, 72 questions, 108 media. |
| One-off `ec6-verify.cjs` | Exit 0; RECONCILIATION_OK; all questions/options/structured forms/projections/private image bytes reconciled. |
| `npm run exam-content:import`, identical repeat | Exit 0; ALREADY_IMPORTED, 0 questions, 0 media. |
| Complete bank-table before/after digest comparison | Exit 0; all question/option/media/import rows unchanged. |
| One-off `ec6-verify.cjs --after-idempotency` | Exit 0; RECONCILIATION_OK again, including source integrity, preservation and all-slot occupancy. |
| `git diff --check` and `git diff --cached --check` (repository root) | PASS. |

The one-off operational/read-only harnesses and JSON evidence were kept outside
the repository. No generic reset/import verification endpoint or tool was added.
Their checks are described above so independent review can distinguish real DB
and object-byte evidence from the mocked/synthetic unit tests below.

Exact focused automated test command:

```powershell
npm test -- tests/unit/services/exam-content-package.test.ts tests/unit/services/exam-content-import.test.ts tests/unit/services/exam-content-real-package.test.ts tests/unit/repositories/exam-content-import.repository.test.ts tests/unit/cli/exam-content-import.test.ts tests/unit/repositories/exam-engine.repository.test.ts tests/unit/services/exam-media.service.test.ts tests/unit/services/exam-media-access.test.ts tests/unit/routes/exam-media.routes.test.ts tests/unit/services/applicant-exam-content.contract.test.ts tests/unit/services/admin-exam-editor.contract.test.ts tests/unit/services/exam-media-client.contract.test.ts
```

**12 files / 186 tests passed; 0 failed or skipped; exit 0.** The existing Vite
CommonJS/config-loader advisory was informational. Unit/contract tests use their
existing synthetic/mocked isolation; real DB and private-byte checks were separate.

Intentionally not run: broad backend suite, frontend rebuild/lint/typecheck
(no runtime/frontend source changes), browser/Playwright/manual/content QA,
hosted CI, production deployment, schema deployment/reset, media garbage
collection, or synthetic rebooking/submission that would recreate attempt state.
The actual shared frontend structured guard and option-view helpers were exercised
against the imported data programmatically; this does not certify browser layout.

## Deferred Phase B issues and review stop

No Phase B work was implemented. Retained exclusions include:

- MCQ reload persistence, autosave, refresh/reconnect/session recovery;
- Admin exam-duration configuration, the fixed three-hour timer, timer source of
  truth and authoritative remaining-time restoration;
- timeout/auto-submit/lock and exam-attempt snapshots;
- scheduling semantics and eligibility policy;
- submission/incomplete-answer/scoring lifecycle and scoring denominator;
- duplicate-answer handling and cross-question selected-option validation;
- essay lifecycle redesign;
- shared-bank activation/selection policy.

The one-time synthetic reset and slot counter reconciliation do not redesign
those lifecycle policies. The known full-browser-reload selection loss remains
deferred and was not treated as a Phase A blocker.

All seven original development/demo questions and both EC5 temporary QA questions
are gone from the active bank. The authoritative manifest/assets remain unchanged.
Canonical acceptance/checklist documents were not edited. Stop after committing
and pushing this evidence on the existing branch; wait for independent review
and project-owner Admin/Applicant content/browser QA. **Neither EC6 nor Phase A
is formally accepted by this report, and examination production readiness is not
claimed. Phase B must not begin automatically.**
