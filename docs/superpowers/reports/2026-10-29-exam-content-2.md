# EXAM-CONTENT-2 — Private exam media implementation evidence

Date: 2026-10-29 (Asia/Manila). Implementation checkpoint, pending independent
review and owner acceptance. This report does not mark EXAM-CONTENT-2 or Phase A
accepted.

Repository: `MuelTech/graduate-system`. Branch: `feat/exam-content-integration`.
Verified starting local and fetched remote HEAD:
`3dbf8addb3565409e8a5c7eaa492837723bd61e3`.
The owner pulled the accepted documentation checkpoint after the initial local
HEAD mismatch was reported. The subsequent starting-state check found the exact
approved HEAD and a clean tree. No reset, rebase, extra branch or merge was used.

## Persistence and accepted-contract integration

New `ExamMedia` rows hold a random UUID, unique private storage key, provider,
verified MIME, byte size, SHA-256 checksum/algorithm and creation timestamp.
Source filenames and source/extraction provenance are deliberately not stored.
There is no application operation to mutate or delete media: replacement creates
a new media identity. Unattached records remain available to Admin only.

The existing nullable `ExamQuestion.stimulusMediaId` and `ExamOption.mediaId`
now have indexed foreign keys to `ExamMedia.id`, with `ON DELETE RESTRICT` and
`ON UPDATE CASCADE`. Media deletion cannot silently clear a question/option's
reference. Existing question/option/answer IDs, text, order, correctness and
`selectedOptionId` semantics are unchanged. Question DTOs still expose opaque
media UUIDs only; new Prisma relations are absent from the existing explicit
question selects and output allowlists.

Migration:
`backend/prisma/migrations/20261029010000_exam_private_media/migration.sql`.
It creates `exam_media`, adds two indexes and two foreign keys. Existing nullable
fields stay nullable. No row rewriting, fabricated media, content ingestion or
backfill occurs. If speculative non-null dangling media IDs exist, adding the
foreign keys fails closed; the migration never clears or invents their content.
No database migration was executed by this package. Owner-controlled development
deployment/rehearsal remains required after independent review.

## Managed storage and image validation

`ExamMediaService.createImage(Buffer)` is an **internal service primitive**, not
an HTTP upload endpoint. It is available for a later authorized importer/editor.
It accepts bytes only, never a caller-supplied path, URL, source filename or
storage key. There is no Admin upload UI or creation endpoint in this package.

Creation reuses `LocalStorageProvider.ensureTemporaryDirectory`, exclusively
created server-named temporary files, `UploadPipeline.validateAndHash`,
`UploadPipeline.promote`, random managed keys and the existing private storage
root. Provider containment and symlink protections remain authoritative. Exact
input bytes are preserved; no image redrawing, re-encoding or resizing occurs.

The new central `exam-media` policy accepts only byte-detected PNG/JPEG,
one file, no extension fallback, and at most the lesser of configured
`MAX_FILE_SIZE` and 5 MiB. Empty/oversized buffers are rejected before writes.
PDF/SVG/GIF/plain-text or spoofed content cannot pass the strict image allowlist.
Size and SHA-256 metadata come from the shared pipeline, not caller claims.

Storage health now counts and scans media records using the existing integrity
scanner. This bounded integration is necessary because registering the new
managed namespace without its DB references would falsely classify valid images
as orphan objects. Scan output uses existing fingerprints rather than raw keys.
General storage maintenance/backfill behavior is unchanged.

## Authentication, authorization and retrieval

Endpoint: `GET /api/exam-engine/media/:mediaId`, authenticated with the existing
Bearer-token middleware and restricted to `ADMIN` or `APPLICANT` roles.
Its parameter is an opaque UUID, not a public/static URL or storage path.

- Admin can resolve existing media for question-bank administration, including
  media not yet attached to a question/option.
- Applicant access derives the Student from the authenticated User and selects
  that Student's latest exam application. It invokes the **same unchanged**
  `validateExamTime` used by the question endpoint. The existing slot/date fallback,
  three-hour window and 60-second early grace are preserved. No caller-supplied
  application/student ID or query parameter can substitute another context.
- After that gate, the media must be attached to an `IMAGE` stimulus or an option
  in the currently visible shared question bank. Unattached media is refused.
  The current question API exposes all bank questions; this package does not
  introduce per-program, activation or attempt-snapshot selection rules.

The former controller application lookup was moved intact into the exam service
so both question and media access reuse the same ownership lookup. No timer,
submission-status or scheduling policy was corrected or broadened.

Authentication/role failures return the existing 401/403 behavior. For Applicants,
ineligible exam context, malformed identity, unlinked/unknown media and missing
content return the same generic 404. Authorization runs before opening storage.
Unexpected retrieval errors return a generic 500 without database/storage details.

After authorization the service verifies namespace/provider, allowed MIME,
recorded bounds, contained storage stat, complete byte count, SHA-256 and detected
MIME. It buffers at most the configured image limit and returns bytes only after
all checks pass. Overlong/error streams close through async iteration. A missing,
unsafe or corrupt object yields generic 404 without partial image delivery.

Successful responses contain the validated `Content-Type`, byte `Content-Length`
and a fixed `inline; filename="exam-image.png"` (or `.jpg`). Successful and error
responses use `Cache-Control: private, no-store`, `Pragma: no-cache`,
`X-Content-Type-Options: nosniff` and `Cross-Origin-Resource-Policy: same-origin`.
No raw filesystem path, private storage key/provider, original filename, answer
correctness, media record or extraction metadata is serialized. The future
frontend must make an authenticated API request; possession of the UUID is not
authorization.

## Failure and cleanup behavior

Temporary validation/promotion failures clean the request directory. Temporary
finalization must finish before DB creation. A failure before media persistence
triggers best-effort deletion of the promoted object. A successful media record
is never deleted by later cleanup. Cleanup failures preserve the original error
and emit a fixed internal message without raw path/key details. Filesystem and DB
operations are not a distributed transaction; process crashes or failed cleanup
can require the existing read-only integrity scan and operator remediation.
There is no automatic media garbage collection or destructive cleanup endpoint.

## Focused automated evidence

Tests use synthetic PNG/JPEG fixtures only. The JPEG signature fixture exercises
the shared byte-detection policy; no browser rendering is claimed.

New tests cover real temporary-file validation/promotion with a temporary private
provider; allowed/spoofed/disallowed/empty/oversized content; UUID and metadata;
DB/promotion/temp-finalization/compensation failures; Admin retrieval; Applicant
context and attachment checks; unauthorized actors; missing/corrupt media;
bounded reading; safe errors; authenticated HTTP headers/bytes; private relation
projection; and migration source/foreign-key contracts. Database access and the
HTTP test token verifier are mocked; production authentication middleware and
role enforcement are exercised, and ownership/time gates have separate tests.
The HTTP checks are automated loopback tests, not browser/manual QA.

Updated storage-health tests verify media reference counts and scanner integrity
findings without false orphan reports or raw-key exposure. Existing EXAM-CONTENT-1
validation/projection/scoring tests remain passing, including `selectedOptionId`.

Commands executed from `backend`:

```powershell
npx prisma format
npx prisma validate
npx prisma generate
npm run build
```

All passed. Prisma Client generation used installed version 7.10.0. Unrelated
pre-existing formatting outside the exam model blocks was restored after format.
Final schema validation passed again after that scope-only restoration.

Exact migration comparison command (PowerShell):

```powershell
$baseline = Join-Path $env:TEMP 'exam-content-2-baseline.prisma'
git show 3dbf8addb3565409e8a5c7eaa492837723bd61e3:backend/prisma/schema.prisma | Set-Content -LiteralPath $baseline
npx prisma migrate diff --from-schema $baseline --to-schema prisma/schema.prisma --script
```

The generated SQL was also compared programmatically to the committed migration
after removing comments/whitespace: **exact match**. This is schema-diff/source
validation, not a deployed-database foreign-key rehearsal.

Initial focused command:

```powershell
npm test -- tests/unit/services/exam-media.service.test.ts tests/unit/services/exam-media-access.test.ts tests/unit/repositories/exam-media.repository.test.ts tests/unit/routes/exam-media.routes.test.ts tests/unit/migrations/exam-private-media.test.ts tests/unit/services/exam-content.rules.test.ts tests/unit/repositories/exam-engine.repository.test.ts tests/unit/controllers/exam-engine-content.controller.test.ts tests/unit/services/exam-engine-content.service.test.ts tests/unit/migrations/exam-mixed-content.test.ts tests/unit/storage/upload-policy.test.ts tests/unit/storage/upload-pipeline.test.ts tests/unit/storage/local-storage.provider.test.ts tests/unit/storage/local-storage.temp.test.ts tests/unit/storage/local-storage.symlink.test.ts tests/unit/storage/request-uploads.test.ts tests/unit/storage/checksum.test.ts tests/unit/repositories/storage-health.repository.test.ts tests/unit/services/storage-health.service.test.ts
```

Initial result: 18 files passed, one new migration assertion failed because it
matched referential `ON DELETE RESTRICT` as a destructive DELETE command; 220
tests passed, one failed, five skipped. The assertion was corrected without
changing the migration. Additional directly affected scanner/readiness/controller
tests were included to validate the bounded storage-diagnostics integration.

Final focused command:

```powershell
npm test -- tests/unit/services/exam-media.service.test.ts tests/unit/services/exam-media-access.test.ts tests/unit/repositories/exam-media.repository.test.ts tests/unit/routes/exam-media.routes.test.ts tests/unit/migrations/exam-private-media.test.ts tests/unit/services/exam-content.rules.test.ts tests/unit/repositories/exam-engine.repository.test.ts tests/unit/controllers/exam-engine-content.controller.test.ts tests/unit/services/exam-engine-content.service.test.ts tests/unit/migrations/exam-mixed-content.test.ts tests/unit/storage/upload-policy.test.ts tests/unit/storage/upload-pipeline.test.ts tests/unit/storage/local-storage.provider.test.ts tests/unit/storage/local-storage.temp.test.ts tests/unit/storage/local-storage.symlink.test.ts tests/unit/storage/request-uploads.test.ts tests/unit/storage/checksum.test.ts tests/unit/repositories/storage-health.repository.test.ts tests/unit/services/storage-health.service.test.ts tests/unit/storage/local-storage.diagnostics.test.ts tests/unit/services/storage-readiness.service.test.ts tests/unit/controllers/storage-health.controller.test.ts
```

Result: **22 files passed; 251 tests passed, 5 skipped (256 total)**. The five
skips are existing environment-dependent storage cases. Vite emits its existing
CommonJS/config-loader advisory. No unrelated failing tests were found.

The final extra nested-media question-projection case was checked separately
with `npm test -- tests/unit/repositories/exam-media.repository.test.ts` — all
four repository/projection tests passed.
`git diff --check` and the final staged `git diff --cached --check` also passed.

Intentionally not run: full backend suite; frontend lint/build/tests; live or
development database migration/deployment rehearsal; browser/manual/content QA;
hosted CI or production deployment. No frontend files changed.

## Exact files changed

1. `backend/prisma/schema.prisma`
2. `backend/prisma/migrations/20261029010000_exam_private_media/migration.sql`
3. `backend/src/controllers/exam-engine.controller.ts`
4. `backend/src/controllers/exam-media.controller.ts`
5. `backend/src/repositories/exam-media.repository.ts`
6. `backend/src/repositories/storage-health.repository.ts`
7. `backend/src/routes/exam-engine.routes.ts`
8. `backend/src/services/exam-engine.service.ts`
9. `backend/src/services/exam-media.service.ts`
10. `backend/src/services/storage-health.service.ts`
11. `backend/src/storage/upload-policy.ts`
12. `backend/tests/fixtures/exam-images.ts`
13. `backend/tests/unit/migrations/exam-private-media.test.ts`
14. `backend/tests/unit/repositories/exam-media.repository.test.ts`
15. `backend/tests/unit/repositories/storage-health.repository.test.ts`
16. `backend/tests/unit/routes/exam-media.routes.test.ts`
17. `backend/tests/unit/services/exam-media-access.test.ts`
18. `backend/tests/unit/services/exam-media.service.test.ts`
19. `backend/tests/unit/services/storage-health.service.test.ts`
20. `docs/superpowers/reports/2026-10-29-exam-content-2.md`

## Deferred work and stop boundary

The current shared-bank selection, attempt/status/timer/autosave/recovery,
duplicate/incomplete submission, essay/scoring-denominator/scheduling policies,
mutable-question historical snapshots and broad editing/history lifecycle remain
unchanged and deferred. Media records do not add those missing policies.

No EXAM-CONTENT-3 importer/package-path resolver/manifest/assets; EXAM-CONTENT-4
Admin editor/UI/upload widgets; EXAM-CONTENT-5 Applicant renderer/hooks/UI;
EXAM-CONTENT-6 bank import/content QA; or Phase B fixes were implemented.
No actual assessment files were read or committed for this package. No
manual/browser QA is claimed. Commit/push this package on the existing branch,
do not merge `main`, and stop for independent review and owner authorization.
