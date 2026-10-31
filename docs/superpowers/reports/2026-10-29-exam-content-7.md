# EXAM-CONTENT-7 — Semantic text-emphasis fidelity

Execution date: **2026-10-30 (Asia/Manila)**. The report filename follows the
owner-requested package path. Implementation and automated/source/database
evidence only; **EC7 and Phase A are NOT formally accepted**. Independent review
and owner physical-source/browser QA remain required.

| Delivery boundary | Result |
| --- | --- |
| Semantic-emphasis architecture/support | PASS, subject to independent review and owner browser QA |
| Real 72-question emphasis annotation population | **NOT RUN / PENDING OWNER SOURCE MAP** |
| Real source scans or verified owner emphasis map available | No; fixed real sidecar path absent |
| Real OLSAT emphasis inferred or populated | None |
| EC6 pagination/text-color follow-ups | Still separate and open; not implemented |
| Phase B | Not started |

## Starting state and scope

Repository: `MuelTech/graduate-system`. Existing branch:
`feat/exam-content-integration`. Exact approved fetched remote and verified local
starting HEAD: `9057e5696a532ceba4dd0bdb4d1592314bb59d7a`. The initial local
inspection was at `558d9fccff2804cad12cde25fc3fa4426f3d73a2`; fetch and the
permitted `git pull --ff-only origin feat/exam-content-integration` established
the approved clean checkpoint before implementation. No additional branch,
reset, rebase, stash, force operation, or merge to/change of `main` was used.

The canonical source of truth, plan, checklist, EC6 evidence and relevant accepted
EC1–EC5 interfaces/rules/repositories/renderers were reviewed. The owner explicitly
authorized this package while the two EC6 UI follow-ups remain open. This package
adds semantic bold/underline only; it does not close those follow-ups or accept EC6.

## Persistence and span contract

One additive migration:
`backend/prisma/migrations/20261030000000_exam_text_emphasis/migration.sql`.
It adds nullable JSON columns `exam_questions.question_text_emphasis` and
`exam_options.option_text_emphasis`, exposed as `questionTextEmphasis` and
`optionTextEmphasis`. There are no backfills, default annotations, ID/text rewrites,
deletions, or new source-import/answer authorities. Plain strings remain canonical.

Each nonempty metadata array contains at most 128 exact-key objects:

```ts
{ start: number; end: number; style: "BOLD" | "UNDERLINE" }
```

Offsets are **zero-based UTF-16 code units, end-exclusive**, directly in the
canonical JavaScript string. This agrees with JavaScript `length`/`slice` and
textarea selection indices. Endpoints splitting a surrogate pair are rejected.
The editor maps textarea CRLF/CR normalization back to original canonical offsets,
without rewriting the string merely to apply a mark.

Null/absent/empty metadata normalizes to no emphasis. Validation rejects negative,
fractional/nonfinite, empty, reversed, and out-of-bounds ranges; unsupported
styles/keys; malformed objects/collections; duplicate identical marks; overlapping
same-style marks; and nonempty marks on image-only options. Different styles may
overlap; adjacent same-style ranges are allowed. Valid spans are sorted into a
deterministic order. Invalid ranges are never clamped or silently repaired.

Backend API/projection validation and the self-contained frontend helper follow
the same contract. A parity test enumerates bounded UTF-16 endpoint/style
combinations plus malformed/overlap cases, comparing acceptance and normalized
values. Keeping frontend helpers local preserves the existing independently
buildable frontend/backend structure and requires no bundler-root change.

## Backend and correctness boundary

Existing exam input interfaces, whole-question validation, partial-update merge,
Prisma persistence, explicit selects, and output allowlists now carry the two
semantic fields. No unrelated question model or HTTP route was added.

Question-emphasis-only edits leave options untouched. Option emphasis updates
retain the supplied existing option IDs, including when saved Applicant answers
reference those options. Existing historical-option removal protection remains.
Focused repository tests exercise both emphasis-only question edits and in-place
option edits while answer-reference counts are nonzero, alongside existing
referenced-option replacement rejection tests.

Partial updates retain unchanged marks. If text changes without replacement marks,
inherited marks are cleared. An explicit replacement is validated against the new
plain text. UI edits always clear old marks before allowing reapplication.

Applicant outputs contain only the validated semantic spans and previously safe
content fields. They still exclude `isCorrect`, `correctAnswer`, candidate/answer
metadata, storage/provider metadata, and source/package paths. Unknown fields
nested inside a mark are rejected, not copied through. Admin alone retains
option correctness. Legacy/null fields project as null safely.

## Admin editing and shared rendering

The focused `SemanticTextEditor` keeps the existing plain textarea. Admin selects
text and uses **Bold**, **Underline**, **Remove selected formatting**, or
**Clear all formatting**. It provides a labeled per-field preview, keyboard-
reachable native buttons, selection retention for mouse activation, and a live
status message. It is used for question/instruction text and textual options.
No general WYSIWYG, HTML, Markdown, font, color, or document model was introduced.

Every actual plain-text change, including a same-length substitution or deletion,
clears **all marks in that field** and visibly tells the Admin to reapply them.
Removing selected formatting trims only the intersecting portions of marks,
retaining valid outside fragments. Image/text conversion clears option emphasis;
an invalid nonempty image-option mark is also rejected at save/API boundaries.
Question-only edits still omit untouched options, preserving their exact identities.

`SemanticText` renders escaped React string nodes with controlled `strong` and
`u` elements, including overlap segmentation. It preserves exact original text
and whitespace/newlines. No `dangerouslySetInnerHTML`, persisted HTML, raw markup
parser, or dynamic style injection exists. Malformed client metadata falls back
to the exact plain string; backend projection rejects malformed persisted marks.

The same renderer is composed into:

- Admin Question Bank list and editor preview;
- Applicant multiple-choice question/instruction text;
- Applicant essay question/instruction text;
- shared textual answer-option rendering on both surfaces.

Image choices continue using the existing authenticated private-media renderer.
Correct/selected states remain independent of source emphasis. Applicant
selection callbacks and submissions retain option-ID authority.

Source comparison against the exact starting checkpoint, after removing only the
new semantic import/composition, found the **entire Applicant exam page unchanged**.
The equivalent Admin comparison preserved its entire page, including pagination
and existing color classes. No timer/state/autosave/navigation/submission code,
pagination control, or assessment-text color was changed. Next.js and React skill
review covered pure composition, client boundaries, stable keys/IDs, native
controls, labels/status, no render-time effects, and absence of HTML injection.

## Verified sidecar and reproducibility

Operator/schema instructions are in `backend/exam-content/EMPHASIS.md`.
The fixed optional file is **`backend/exam-content/olsat-emphasis.json`**, outside
the immutable `olsat/` package inventory. It is deliberately absent in this commit.
No actual emphasis was guessed from wording, capitalization, answers, or an LLM.

Version 1 binds to `packageKey: olsat`, the accepted manifest SHA-256
`0327342827f9afafeadb65b88f18e9bb4f21b2c513fe6edfdb9104ab16abd3d9`,
`UTF16_CODE_UNITS`, and explicit VERIFIED reviewer/time attestation. Each unique
field annotation binds a source question number, a question-text target or exact
option label/order target, exact UTF-8 text SHA-256, and explicit spans. It does
not duplicate full protected text. `[]` explicitly clears a targeted field;
untargeted fields remain unchanged. Reviewer attestation requires owner/source
verification; the program does not claim to verify uncommitted physical pages.

The CLI bounds the fixed regular sidecar to 1 MiB, rejects symlinks, and accepts
only default/read-only `--dry-run` or explicit `--apply`. Unknown/ambiguous arguments
fail. There is no HTTP endpoint or caller-selected path. Missing sidecar fails
before loading the database module. Summaries/errors contain only safe status/counts.

Base preflight still verifies the immutable package/fingerprint. Sidecar parsing
rejects wrong manifest/schema/index convention, absent verification, unknown
source question/option identity, image-only targets, text-hash mismatches,
duplicate targets, and malformed ranges. Existing-bank reconciliation checks the
import marker/fingerprint/count and complete source-question identity set, then
resolves **all targets before any writes**. Database target text hashes must also
match; ambiguous duplicate option identities fail closed.

Read-only preflight returns `PREFLIGHT_OK`, zero changed fields, and a would-change
count. Apply performs only semantic-column updates in one **Serializable** Prisma
transaction (60-second timeout, 10-second maximum wait). It never creates,
deletes, or replaces questions/options, changes correctness/media/source IDs,
or touches Applicant answers. Failure propagates for transaction rollback.
Changed metadata returns `APPLIED`; an identical second apply returns
`ALREADY_APPLIED` with zero writes. Synthetic tests verified both commands,
identity preservation, mismatches before mutation, and transaction rollback wiring.
Real annotation apply/idempotency was **not run** without an authoritative map.

Fresh environment sequence, after reviewed migration deployment and Prisma generation:

```powershell
npm run build
npm run exam-content:preflight
npm run exam-content:import
# Only after the verified real sidecar has been supplied:
npm run exam-emphasis:preflight
npm run exam-emphasis:apply
```

Existing imported environments skip base import and run only annotation preflight/
apply once the verified map exists. Repeating apply checks idempotency. This
package did **not** delete or re-import the 72-question bank or change the original
manifest/package fingerprint semantics.

## Migration and real database preservation evidence

- Before migration: `prisma migrate status` passed with **44 migrations**, schema
  up to date. A read-only baseline covered all **62 Prisma models**.
- `prisma generate` passed with installed Prisma Client 7.10.0; schema validation
  passed. DB-to-schema SQL diff showed **only the two nullable JSON additions**.
- `prisma migrate deploy` successfully applied
  `20261030000000_exam_text_emphasis` to the local development MySQL database.
- After deployment: **45 migrations**, schema up to date; DB-to-schema diff with
  `--exit-code` returned 0 and **No difference detected**.
- A post-deploy read of all 62 models, removing only the two newly added columns,
  matched every original sorted-row SHA-256 digest and count. **All previous
  persisted scalar data remained unchanged**. This includes 56 Users, 44 Students,
  3 applications, 1 score, 9 slots, 114 media records, and the `olsat` import marker.
- **72 imported questions / 360 options** remain, with identical IDs, plain text,
  labels/order, correctness, source identity, and media references. Source numbers
  are still exactly **1–72**, unique and nonnull. All 72 correct-option mappings
  and **108 imported-bank media references** are unchanged.
- All 72 new question emphasis fields and all 360 option emphasis fields are
  initially **null**. No real-bank annotation data was written.
- Current ApplicantAnswer count is 0, unchanged; broken question/selected-option
  reference checks returned 0. Synthetic tests separately cover nonzero persisted
  answer references during Admin metadata edits.
- Production Applicant selects/projections were exercised read-only on all 72
  real rows: safe null semantic fields, no correctness/private/source-path leakage.
- All **109 source package files** were compared as raw Git blobs against the
  approved checkpoint: exact match. Manifest SHA-256 above is unchanged. No missing
  or extra package files, source diff, visual changes, or replacement assets.

The baseline/post-deploy digest evidence was captured outside the repository;
no database dump, personal data, protected full questions, answers, or private
storage paths are committed here. No database reset or recovery operation ran.

## Focused automated verification

Exact final backend command:

```powershell
npm test -- tests/unit/services/text-emphasis.test.ts tests/unit/services/exam-emphasis.test.ts tests/unit/services/semantic-text.contract.test.ts tests/unit/cli/exam-emphasis.test.ts tests/unit/migrations/exam-text-emphasis.test.ts tests/unit/services/exam-content.rules.test.ts tests/unit/repositories/exam-engine.repository.test.ts tests/unit/services/admin-exam-editor.contract.test.ts tests/unit/services/applicant-exam-content.contract.test.ts tests/unit/services/exam-content-package.test.ts tests/unit/services/exam-content-import.test.ts tests/unit/services/exam-content-real-package.test.ts tests/unit/services/exam-media-client.contract.test.ts tests/unit/routes/exam-media.routes.test.ts tests/unit/services/exam-media-access.test.ts
```

**15 files / 285 tests passed; 0 failures or skips.** New tests cover range/style
validation, Unicode and CRLF offsets, parity, selection apply/remove/edit safety,
real React static markup/HTML escaping, overlap/endpoints/whitespace, DTO privacy,
Admin option identity, migration source, verified source/text identity, read-only
preflight, metadata-only application, identical rerun, ambiguous identity rejection,
and transaction-failure propagation. Existing importer/media/authorization and
mixed-content tests remain passing. CLI transaction tests use an isolated mocked
transaction with synthetic records; they do not claim a real-map DB apply rehearsal.

| Working directory | Command/check | Final result |
| --- | --- | --- |
| backend | `npx prisma generate` | PASS |
| backend | `npx prisma validate` | PASS |
| backend | `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` before deploy | Only intended two nullable JSON columns |
| backend | `npx prisma migrate deploy` | PASS; one migration applied |
| backend | `npx prisma migrate status` after deploy | PASS; 45 migrations, schema up to date |
| backend | `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code` after deploy | PASS, exit 0; no difference |
| backend | `npm run build` | PASS |
| backend | `npm run exam-content:preflight` | PREFLIGHT_OK, 72 validated, 108 assets, 109 files, zero imported/media created |
| backend | `npm run exam-emphasis:preflight` with absent real sidecar | Expected fail-closed exit 1, EMPHASIS_NOT_APPLIED; no DB operation or inferred annotations |
| frontend | `npx tsc --noEmit` | PASS |
| frontend | `npm run build` | PASS; TypeScript and 68 static pages |
| frontend | Scoped ESLint command below | 0 errors; 1 existing unchanged Applicant navigation warning |
| repository | `git diff --check` and `git diff --cached --check` | PASS |

Exact scoped lint command, from `frontend`:

```powershell
npx eslint src/components/exam-content/semantic-text.tsx src/components/exam-content/semantic-text-editor.tsx src/components/exam-content/admin-question-editor.tsx src/components/exam-content/applicant-question-renderer.tsx src/components/exam-content/option-content-renderer.tsx src/lib/text-emphasis.ts src/lib/exam-content.ts src/lib/applicant-exam-content.ts src/types/index.ts "src/app/(portal)/admin/exam/questions/page.tsx" "src/app/(portal)/applicant/exam/page.tsx"
```

Scoped Prettier was applied to new helpers/tests/components and affected shared
frontend files; the two large pages were not broadly reformatted. Initial exact-
shape test expectations were updated for the new nullable fields. All final tests
and builds above passed. Existing Vite CommonJS/config-loader, Next middleware/
proxy, and Node module-registration notices remain informational.

Intentionally not run: real emphasis apply or its DB idempotency run, real source
annotation/OCR/inference, base re-import/reset, browser/Playwright/manual/source QA,
full unrelated backend suite, full frontend lint, hosted CI, deployment, media GC,
or any Phase B lifecycle operation. Static React rendering and selection-helper
tests do not certify browser text selection/layout or physical-source fidelity.

## Exact repository files changed

```text
backend/exam-content/EMPHASIS.md
backend/package.json
backend/prisma/schema.prisma
backend/prisma/migrations/20261030000000_exam_text_emphasis/migration.sql
backend/src/cli/exam-emphasis.ts
backend/src/interfaces/exam-content.interfaces.ts
backend/src/repositories/exam-content.projection.ts
backend/src/repositories/exam-engine.repository.ts
backend/src/services/exam-content.rules.ts
backend/src/services/exam-emphasis.service.ts
backend/src/shared/text-emphasis.ts
backend/tests/unit/cli/exam-emphasis.test.ts
backend/tests/unit/migrations/exam-text-emphasis.test.ts
backend/tests/unit/repositories/exam-engine.repository.test.ts
backend/tests/unit/services/applicant-exam-content.contract.test.ts
backend/tests/unit/services/exam-content.rules.test.ts
backend/tests/unit/services/exam-emphasis.test.ts
backend/tests/unit/services/semantic-text.contract.test.ts
backend/tests/unit/services/text-emphasis.test.ts
frontend/src/app/(portal)/admin/exam/questions/page.tsx
frontend/src/app/(portal)/applicant/exam/page.tsx
frontend/src/components/exam-content/admin-question-editor.tsx
frontend/src/components/exam-content/applicant-question-renderer.tsx
frontend/src/components/exam-content/option-content-renderer.tsx
frontend/src/components/exam-content/semantic-text-editor.tsx
frontend/src/components/exam-content/semantic-text.tsx
frontend/src/lib/applicant-exam-content.ts
frontend/src/lib/exam-content.ts
frontend/src/lib/text-emphasis.ts
frontend/src/types/index.ts
docs/superpowers/reports/2026-10-29-exam-content-7.md
```

## Owner QA and stop boundary

### Post-implementation independent review

The actual GitHub commit/diff at
`09e09260e5b1ab539b567b3b51b1e7b146e928d5` was independently reviewed after
the implementation report was produced. Review result: **PASS — no blocking
architectural or package-scope defect found**.

The review confirmed the additive migration, bounded span contract, safe React
rendering, correctness non-exposure, fixed-path verified-sidecar workflow, and
separation from both EC6 UI follow-ups and Phase B.

### Project-owner browser checkpoint

The project owner manually observed **Admin bold/underline authoring/rendering
working**. This is recorded only for the behavior actually observed; no broader
manual claim is inferred.

The owner intentionally chose to skip a separate full Applicant browser QA pass
for this checkpoint. Applicant semantic rendering therefore remains supported by:

- independent source review of the shared `SemanticText` /
  `OptionContentRenderer` path;
- focused automated contract/rendering coverage.

This must not be described as project-owner Applicant manual/browser QA.

Real 72-question source-specific emphasis remains **NOT RUN / PENDING
OWNER-VERIFIED SOURCE MAP**. The real `olsat-emphasis.json` remains absent. No
source-specific bold/underline may be inferred from wording, capitalization,
answers, OCR, or an LLM.

Therefore the current checkpoint is:

- EC7 architecture/support implementation review: **PASS**;
- Admin owner browser observation: **PASS for observed bold/underline behavior**;
- Applicant full owner browser QA: **OWNER-SKIPPED**;
- real OLSAT emphasis population/source comparison: **PENDING**;
- formal EC7 acceptance: **PENDING**.

EC6 pagination discoverability and neutral assessment-body color remain separate
and are the next bounded implementation work. No timer/duration, timeout,
autosave/recovery/reload persistence, scheduling, submission/scoring, essay
lifecycle, or question activation/selection work was implemented.

Neither EXAM-CONTENT-7 nor Phase A is formally accepted by this checkpoint.
