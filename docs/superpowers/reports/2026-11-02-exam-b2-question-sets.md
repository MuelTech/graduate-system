# EXAM-B2 — Question selection and immutable content foundation

Date: 2026-11-02 (Asia/Manila).

Status: **ACCEPTED FOR PHASE B PROGRESSION — 2026-11-02**.
Independent remote source review: **PASS — no blocking issue**. Project-owner
manual/browser QA: **DEFERRED / NOT EXECUTED**, not reported as PASS. B0A/B0B/B1
remain accepted. B3 and every later implementation remain separately unauthorized.
Phase B is incomplete and is not production-ready.

## Baseline and scope

Before editing, verified clean `feat/exam-engine-scheduling`, local HEAD,
origin tracking HEAD and live remote branch at
`7083a28fffe75a8177a322eadf30e6f2b6429db7`,
`docs(exam): close B1 review checkpoint`. Local/tracking/live main all matched
`a6dc6f57c6e8130482c814e90703765972fddaa9`: 12 ahead, zero behind main.
There were no unexpected commits or worktree changes. Continued on that branch;
no reset, rebase, force push, main modification, branch recreation or unrelated merge.
The delivery response records the final local/remote commit identity after push.

Read the live checklist §7.2, Phase B plan/common protections/B2, lifecycle audit,
accepted B0A/B0B/B1 reports, content source of truth, engineering verification policy,
UI/UX playbook and audit. Inspected the bank/answer/import/media schema, all affected
repositories, projections, services/controllers/routes, Question Bank/editor/dialog
patterns and relevant tests. Applied the installed Next.js and React guidance to
the bounded client component. No new dependency or lockfile change.

## Persistence and migration

Migration: `20261102010000_exam_question_sets`.

Five additive models/tables:

| Prisma model / table | Purpose |
| --- | --- |
| `ExamQuestionSelection` / `exam_question_selection` | One row per explicitly selected existing bank question; initially empty. Selection FK cascades only this disposable draft membership if an unused question is deleted. |
| `ExamContentRevision` / `exam_content_revisions` | UUID identity, publication timestamp, authenticated publishing User FK. No mutable active pointer, sequential revision number, application or attempt relation. |
| `ExamRevisionQuestion` / `exam_revision_questions` | Revision + source question composite identity, unique frozen position, validated JSON content including internal correct flags. Restrictive FKs retain the source identity. |
| `ExamRevisionOption` / `exam_revision_options` | Every original option identity linked to its revision question and retained with restrictive FKs. |
| `ExamRevisionMedia` / `exam_revision_media` | Deduplicated opaque media IDs retained with restrictive FKs independently of mutable bank attachments. |

JSON is used only for copied generic Phase A question content; relational source
question, option, publisher and media references enforce retention. This avoids
duplicating the full content schema across normalized revision fields while
addressing integrity requirements that JSON alone cannot provide. Published content
has no update/delete repository method, route, or UI action. Immutability is enforced
by this application write-once API boundary; no database trigger claims are made.

Existing `ApplicantAnswer.question` deletion changes from CASCADE to RESTRICT and
`ApplicantAnswer.selectedOption` from SET NULL to RESTRICT. Existing application
deletion behavior is unchanged. SQL creates five tables and their indexes/FKs, then
recreates these two existing FKs with stronger deletion behavior. It contains no
data deletion/update, ID regeneration, default selection, backfill or historical
revision fabrication. Existing bank/import/option/media/answer content stays intact.
Legacy historical received sets remain **UNKNOWN**.

### Migration evidence

- Inspected SQL; `prisma validate`, client generation and backend build passed.
- Opt-in real-DB test creates an exact UUID-named disposable database on localhost,
  builds the pre-B2 schema from the verified starting commit, inserts synthetic
  preexisting question/option/media/import/application/answer fixtures, and applies
  the actual migration SQL. Exact before/after rows and IDs compare equal:
  **2 questions, 2 options, 1 media, 1 import and 1 ApplicantAnswer**. All new
  authority tables begin empty. New revision/reference tables use InnoDB.
- The disposable database is removed afterward by its exact generated name.
  No configured database reset is used. Tests also compare all configured local
  exam rows before/after rehearsal to ensure they remain untouched by the tests.
- After rehearsal, `prisma migrate deploy` successfully applied only B2 to the
  existing localhost development database. Exact before/after row comparisons
  preserved **72 questions, 360 options, 114 media, 1 import and 0 ApplicantAnswers**.
  The nonempty-answer preservation claim is established separately by rehearsal.
  All five new tables remained empty: no real selection/publication was performed.
- Final `prisma migrate status`: **Database schema is up to date**, 47 migrations.
  No reset, canonical re-import, sidecar application, source/assets change or media
  byte mutation. Other environments must apply the migration before using B2.

## Current selection and Admin HTTP authority

Existing engine namespace, actual JWT middleware + `requireRole(['ADMIN'])`:

- `GET /api/exam-engine/admin/question-set`: current persisted ordered membership,
  question summaries and latest publication summary (or null).
- `PUT /api/exam-engine/admin/question-set`: `{ questionIds: string[] }` replaces
  the complete draft membership and returns persisted readback.
- `POST /api/exam-engine/admin/question-set/publish`: same shape identifies the
  expected saved membership; rejects if it differs from current server membership.

Selection validates UUIDs, normalizes case, rejects duplicate/case-alias and unknown
IDs and unsupported/malformed payloads. Empty draft membership is valid; empty
publication rejects. There is no invented question count/minimum/maximum policy.
The existing Express body limit remains the technical request boundary. Membership
updates do not write bank content or source/import metadata. Imports/manual creation
do not create selection rows or publish content. Responses are private/no-store;
operational errors retain bounded messages and unexpected failures are generic.

HTTP tests use real signed tokens and the actual Express router, controller,
repository and authentication/role middleware with mocked database delegates:
ADMIN allowed; APPLICANT/STUDENT/PANELIST denied; missing and invalid tokens denied
before database access. No public Applicant revision/binding endpoint exists.

## Publication and immutable content

Publication uses one SERIALIZABLE transaction: read exact saved membership, compare
expected IDs, read selected bank questions/options in deterministic order, validate
generic content/key/identity, then create revision + question content + every option
reference + deduplicated media references in one nested write. Missing/incompatible
content or any persistence failure aborts the complete transaction. FK/conflict
errors become 409 with reload/retry guidance. No automatic hidden retry.

Questions freeze in ascending bank `order`, then `id`; options retain ascending
`order`, then `id`. Explicit revision `position` freezes the question sequence.
Legacy tied option orders remain exact; validation-only ranks do not rewrite their
stored values. All manual labels and original bank question/option IDs are retained.
Each publication owns a separate UUID identity and copied content. No current
publication winner, sequential numbering, deduplication or exactly-once HTTP
publication claim is made. Two accepted intentional requests may create separate
immutable sets. The latest-publication summary is informational, ordered by
timestamp then ID; it is never attempt binding authority. Concurrent draft saves
retain ordinary complete-replacement semantics; no stale-editor merge is claimed.

Copied content includes question type/text/order and semantic emphasis, stimulus
category/media ID/structured payload/structured emphasis, option IDs/labels/order/
text/emphasis/media IDs and internal `isCorrect`. Source-import metadata, storage
keys, checksums, paths and provider metadata are not copied. Generic Phase A
projection/validation is reused with all eight supported structured subtypes and
BOLD/UNDERLINE/ITALIC; there are no OLSAT/Q40 special branches or new list semantics.

Tests publish, change bank text/key/option text/order/media, deselect, and publish
again. Old content/key/membership stays exact; later publication captures new content.

## History protection and media retention

Question deletion checks ApplicantAnswer and revision membership before deleting;
referenced questions return 409 directing Admin to deselect. Database RESTRICT FKs
remain authoritative if a new reference races the guard. Never-used/unpublished
questions remain deletable, with only disposable selection membership cascading.
Existing source-import and media restrictions remain. No broad archive taxonomy.

Option replacement retains the existing ApplicantAnswer guard and adds a revision
option-reference guard before removal. In-place text/key/order edits that preserve
IDs remain supported and affect future publications. Existing editor conflict copy
now truthfully covers both saved answers and published sets.

`ExamMediaRepository.deleteUnreferenced` additionally requires no revision references.
The revision-media FK also rejects physical deletion. Real-DB tests remove all mutable
bank media attachments, then prove cleanup deletes zero rows and direct deletion
fails, while the revision retains its opaque media IDs. Existing private storage,
integrity checking, authorization and confidential delivery behavior is unchanged.

## B4 internal binding contract and transitional Applicant runtime

`ExamQuestionSetRepository.getForBinding(exactRevisionId)` reads **one exact**
published identity and ordered frozen question content, validates identities/content,
and returns internal questions/key, retained media IDs, publication identity/time,
plus an explicitly allowlisted `applicantQuestions` projection. Missing identity
fails closed. This is an internal server read, not an unauthenticated API and not
an attempt creation operation. Future B4 must authorize the owned attempt, bind the
exact ID once, and return only the safe projection rather than this internal bundle.

Applicant projection omits `isCorrect`, answer-key metadata, source/import metadata,
storage/provider/checksum/path authority and revision integrity fields. It retains
original question/option IDs, labels/order, all accepted content forms/emphasis and
opaque media IDs. Focused contracts explicitly check confidentiality and fidelity.

**B2 creates immutable content authority; B4 will bind and activate it per attempt.**
Live `GET /exam-engine/questions` deliberately still calls the legacy whole-bank
repository projection. Tests confirm selection/publication does not filter/redirect
that read. Applicant media remains attached-bank authorized under the existing
ownership/time check. No public revision/media bypass, attempt fields or fabricated
received sets were added. Legacy mutable-bank read/scoring risks remain until the
later authorized consumers replace them; this package does not claim to fix those
runtime semantics. Admin publication itself cannot switch an active Applicant's set.

## Question Bank UI

On the existing page: **Question Set → Exam Configuration → Add question**.
No sidebar destination or broad redesign. The bounded shared Dialog loads a fresh
cancellable selection + bank query when opened. It shows selected count, saved/dirty
state, order/type/text, select/deselect checkboxes, selected-only inspection, local
pagination, Save draft selection, publication confirmation and published-set feedback.
Selection lives across dialog pages; saving reconciles from server readback.

Loading/error/Retry, pending/disabled controls, synchronous duplicate-submit and
close guards, retained edits on failure, success feedback and stale-membership
conflict guidance are covered by executable component/handler tests. Focus/reconnect
refetch is disabled during editing. Publish is disabled until nonempty and saved;
confirmation explains frozen content/order and that later bank edits cannot alter
that set. UI explicitly says publication does not start an exam or change current
Applicant content and does not imply institutional composition approval. No raw
model names, hashes, internal IDs or implementation version labels are shown.
Existing Configuration/Add/Edit and media/structured previews remain in place.

## Verification

Final focused/backend related run: **37 files / 672 tests PASS, zero failures/skips**:
**668 unit/component/HTTP contracts plus 4 real-DB integration tests**. This includes
**70 B2 checks** (33 repository/rule, 21 HTTP, 12 component/handler, 4 real-DB) and
**602 directly affected regression checks**. One formatting-sensitive preexisting
B1 source contract failed during intermediate formatting; its original markup was
restored and the final affected checks passed. No behavior/authority was relaxed.

Covered regression files, relative to `backend/tests/unit`:

```text
repositories/exam-engine.repository.test.ts
repositories/exam-media.repository.test.ts
repositories/exam-content-import.repository.test.ts
repositories/exam-answer.repository.test.ts
repositories/exam-result.repository.test.ts
repositories/exam-configuration.repository.test.ts
repositories/exam-record.repository.test.ts
controllers/exam-engine-content.controller.test.ts
controllers/exam-answer.controller.test.ts
routes/exam-media.routes.test.ts
routes/exam-media-upload.routes.test.ts
routes/exam-result.routes.test.ts
routes/exam-configuration.routes.test.ts
routes/exam-record.routes.test.ts
services/exam-content.rules.test.ts
services/exam-content-package.test.ts
services/exam-content-real-package.test.ts
services/exam-content-import.test.ts
services/exam-emphasis.test.ts
services/exam-emphasis-real-map.test.ts
services/exam-engine-content.service.test.ts
services/admin-exam-editor.contract.test.ts
services/applicant-exam-content.contract.test.ts
services/exam-media-access.test.ts
services/exam-media.service.test.ts
services/exam-media-client.contract.test.ts
services/exam-answer.service.test.ts
services/exam-result.service.test.ts
services/exam-result-email-queue.test.ts
services/applicant-results.contract.test.ts
services/exam-configuration.rules.test.ts
services/exam-configuration-ui.contract.test.ts
services/exam-record-detail.service.test.ts
```

Add the three B2 unit files listed below plus
`tests/integration/exam-question-set.test.ts`; run with `EXAM_B2_DB_TEST=1`.
The opt-in test never uses/reset/imports the real canonical bank. Real DB coverage:
pre/post migration row preservation, rollback after actual nested revision writes,
FK question/option/media restrictions, media cleanup retention, immutable reads
under source changes, and future synthetic import isolation. No unnecessary
multi-connection contention scenario or numbering/winner claim.

Backend build/TypeScript: **PASS**. Prisma validate/generate/status: **PASS**.
Frontend `tsc --noEmit`: **PASS**. Scoped ESLint: **PASS** for Question Bank,
Question Set dialog, selection helpers and the changed editor. Existing Question
Bank verifier: **11/11 PASS**. React review covered client boundaries, hook order,
query/local-draft ownership, labels, async feedback and synchronous pending guards.
Production frontend build not run; focused typecheck/lint/component contracts cover this change.
The page uses the existing dialog/API-client pattern with no new routing, framework,
dependency or build configuration. Related verification was broadened for schema,
history, import, security and media impact; the entire repository suite was not run.

`git diff --check`: **PASS**; complete B2 diff and migration SQL inspected before commit.
Hosted CI: **NOT EXECUTED / no hosted PASS claimed**. Existing workflow triggers
main pushes and PRs to main; this package only pushes the existing feature branch
and creates no PR/deployment. Delivery checks report observed remote status separately.

**Manual/browser QA: DEFERRED / NOT EXECUTED — project-owner decision.** The owner
accepted B2 for Phase B progression based on completed migration/automated/real-DB
verification and independent remote source review, while reserving browser/manual
lifecycle QA for the later consolidated Phase B gate unless an intermediate
UI-sensitive package requires it. This is an explicit deferral, not a manual QA PASS.
Consolidated owner QA should still cover opening Question Set, selection across pages,
publication, subsequent bank edits, retained content using the internal read contract,
existing image/structured previews, and continued Configuration/Add/Edit usability.

## Exact changed files

```text
backend/prisma/schema.prisma
backend/prisma/migrations/20261102010000_exam_question_sets/migration.sql
backend/src/controllers/exam-engine.controller.ts
backend/src/controllers/exam-question-set.controller.ts
backend/src/repositories/exam-engine.repository.ts
backend/src/repositories/exam-media.repository.ts
backend/src/repositories/exam-question-set.repository.ts
backend/src/routes/exam-engine.routes.ts
backend/src/services/exam-question-set.rules.ts
backend/tests/fixtures/exam-question-set.ts
backend/tests/integration/exam-question-set.test.ts
backend/tests/unit/controllers/exam-engine-content.controller.test.ts
backend/tests/unit/repositories/exam-engine.repository.test.ts
backend/tests/unit/repositories/exam-media.repository.test.ts
backend/tests/unit/repositories/exam-question-set.repository.test.ts
backend/tests/unit/routes/exam-question-set.routes.test.ts
backend/tests/unit/services/exam-question-set-ui.contract.test.ts
frontend/src/app/(portal)/admin/exam/questions/page.tsx
frontend/src/components/exam-content/admin-question-editor.tsx
frontend/src/components/exam-content/exam-question-set-dialog.tsx
frontend/src/lib/exam-question-set.ts
docs/superpowers/GSIS_IMPLEMENTATION_CHECKLIST.md
docs/superpowers/plans/2026-11-01-exam-engine-scheduling-phase-b.md
docs/superpowers/reports/2026-11-02-exam-b2-question-sets.md
```

Only these three documentation files are updated. Accepted reports/audit/content
authorities, canonical manifest/assets/Q24/Q40, imports, emphasis map and B0A/B0B/B1
runtime behavior remain protected. B0A answer-writer bodies are unchanged; the same
repository only receives bounded content-deletion/option-removal guards.

## Policy and next gate

Physical exam confirms one essay assessment; its exact prompt remains intentionally
unencoded. No fake essay, fixed MCQ count, randomization, program-specific membership,
weight or 40-question rule is introduced. Scoring, passing threshold and start/
deadline/composition policy remain unresolved under their existing authorities.
A frozen question set does not certify a complete institutional examination.

## Independent review and owner checkpoint

- Reviewed remote implementation commit: `ab1e39d7abb0de0405e558ef0cdedda55d24402f`.
- Branch relationship at review: B2 was exactly one commit ahead of the accepted B1
  documentation checkpoint `7083a28fffe75a8177a322eadf30e6f2b6429db7`; the shared
  Phase B branch was thirteen commits ahead of `main` and zero behind.
- Independent remote source review: **PASS — no blocking issue found** across migration
  safety, restrictive historical-answer FKs, explicit selection, SERIALIZABLE publication,
  immutable copied content/key, source question/option/media retention, Applicant-safe
  projection, deletion/media guards, ADMIN-only routes, transitional legacy Applicant
  runtime, focused tests, real-DB integration evidence, and B2 scope.
- Project-owner decision on 2026-11-02: **ACCEPTED FOR PHASE B PROGRESSION**.
- Manual/browser QA: **DEFERRED / NOT EXECUTED** by project-owner decision; it remains
  future evidence and must never be reported as passed unless actually performed.
- Hosted CI remains **NOT EXECUTED / no hosted PASS claimed** for the branch-only checkpoint.
- B3 and every later Phase B package remain separately authorized work; acceptance
  of B2 does not authorize automatic continuation.

Next action, when separately authorized by the owner, is the bounded EXAM-B3 package.
