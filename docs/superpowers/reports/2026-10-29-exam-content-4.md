# EXAM-CONTENT-4 — Admin mixed-content question support

Date: 2026-10-29 (Asia/Manila). Implementation evidence only; **not accepted**.
Independent review and project-owner browser/content QA remain separate.

Repository: `MuelTech/graduate-system`. Existing branch:
`feat/exam-content-integration`. Starting local and fetched remote HEAD:
`fc2315228f2132c93b6550059a9996d4208ec974`. The starting tree was clean and
already synchronized; no pull, reset, rebase, stash, extra branch or merge was
needed. `main` remains unchanged.

## Corrected Admin baseline

The page now previews canonical text, response/stimulus category, structured or
image stimulus, ordered text/image choices, persisted labels and Admin-only
correct-answer indicators. Eight questions are displayed per page to bound the
number of mounted previews. Loading, reload, empty, validation, save, upload,
session, private-image and history-conflict failures have bounded visible states
instead of console/alert-only reporting. Existing deletion behavior remains
behind an explicit confirmation; its lifecycle was not redesigned.

The dialog uses the existing accessible Dialog primitives and labeled controls.
Response type, display order, canonical text and stimulus category are explicit.
The original single-page editor was separated into reusable rendering controls
and an Admin editor; no OLSAT-specific branch or extraction metadata is rendered.
The Next.js and React best-practices skills informed boundaries, lifecycle,
accessibility and component review. No external design service was used.

## Contracts, option identity and correctness

Frontend exam types now match the accepted backend DTO: response/stimulus unions,
nullable stimulus media/structured content, nullable option text, option question
identity, source label, order and media UUID. Admin options alone add `isCorrect`.
The Applicant page compiled against those types without any source modification.

Editor drafts retain every existing option ID, label, order, text, media ID and
correctness flag. UI-only stable option keys never enter API payloads. Modified
options retain their existing `id`; new choices omit it. Untouched options are
omitted from updates entirely, so editing question wording does not rewrite them.
This also permits metadata-only edits of legacy rows with tied default orders
without persisting a fabricated ordering. Actual option edits must satisfy the
accepted unique-order validation; referenced option removals still return 409.

Persisted labels drive display, including F/G/H/J/K. A null label uses a neutral
`Option <order + 1>` description rather than a fabricated letter. Manually entered
labels follow the accepted uppercase-letter/digit, length and all-or-none rules.
Option order is editable and preserved independently of label/array position;
previews sort by persisted order. No index-derived letter placeholder remains.

Text and image are explicit per-option modes. Image choices retain null text and
require an uploaded media UUID; fake text is never inserted. Changing mode is an
explicit replacement. Correctness is selected by stable option identity/key and
serialized only through `isCorrect`; exactly one MCQ choice must be marked.
Removing a correct choice requires an explicit new selection. Essays send an
empty option list; essay scoring/lifecycle is unchanged.

NONE sends null image/structured stimulus fields; IMAGE sends a media UUID and
null structured payload; STRUCTURED sends its validated payload and null media.
The UI can retain inactive draft values until save, but incompatible values are
explicitly cleared in the actual request. Backend validation remains authoritative.

## Reusable rendering and bounded structured editing

Generic stimulus/option/image renderers receive content fields only, never
`isCorrect`. Correct badges/radios remain in the Admin page/editor.

| Accepted form | Preview | Editor |
| --- | --- | --- |
| MATRIX | Table preserving rows/cells | Bounded editable rows, columns and cells |
| GROUPED_NUMBER_ROWS | Table preserving group/row boundaries | Editable groups and aligned columns |
| NUMBER_SEQUENCE | Ordered item list | Ordered numeric/fraction/gap cells |
| ALPHANUMERIC_SEQUENCE | Ordered alphanumeric items | Ordered text-item controls |
| WORD_SERIES | Ordered words | Ordered text-item controls |
| LETTER_SEQUENCE | Ordered letter items | Ordered text-item controls |
| WORD_BANK | Ordered, visually separated word bank | Ordered text-item controls |
| LOGICAL_PREMISES | Distinct numbered premises | Ordered premise rows |

Cell drafts retain original number-vs-string identity, including fraction strings
and literal `?`. Editable cell type is explicit for numeric/grid forms; no matrix,
group, sequence or premise is flattened into prose or stored as JSON text in
`questionText`. Rows/columns are bounded at 30, lists at 100 and cells/items at
500 characters, aligned with the accepted backend. There is no arbitrary JSON
editor. Unknown/malformed structured content produces a bounded unsupported state;
an Admin must explicitly choose valid replacement content before saving it.
Live previews derive from current valid draft content rather than a stale snapshot.

## Private preview and object-URL lifecycle

Images are fetched from the resolved browser backend base URL at
`/api/exam-engine/media/:mediaId` using the current session Bearer token, an abort
signal and `cache: no-store`. Only opaque UUIDs are accepted as identities.
Successful PNG/JPEG responses become bounded Blobs and then browser object URLs.
Unsupported/empty/oversized/error responses never create an object URL. HTTP
401/403 follows existing sign-out behavior; raw response error text is not shown.

Each media ID/token/retry owns a keyed request. Replacement/unmount aborts pending
fetches and revokes the owned object URL exactly once. Late responses after
cleanup are ignored. Decode failures show a bounded state and release the URL;
retry starts a fresh request. Next Image is explicitly unoptimized for these
private Blob URLs, so no optimizer/public URL or source-image transformation is
introduced. Existing `DocumentViewer` was inspected but left unchanged.

## Minimal Admin upload API

New contract: `POST /api/exam-engine/admin/media`, authenticated **ADMIN only**,
multipart field `file`, one image, response HTTP 201 `{ "id": "<UUID>" }`.
Applicant/Student/Faculty/anonymous access is rejected before upload handling.
No source path, key, provider, checksum, filename or public URL is returned.

The route reuses `secureUpload("exam-media").single("file")`: actual byte
detection, the existing configured/5-MiB image cap, private temporary storage,
SHA-256, promotion, containment protections and request artifact tracking.
The service registers that existing promoted object rather than calling
`createImage` or promoting a second copy. Before registration it validates
provider/namespace/MIME/size/hash metadata and rechecks content/hash by the managed
key; it never trusts the client filename or `file.path` as retrieval authority.

After DB registration, the controller calls `commitRequestUploads` and returns
only the UUID. DB/domain failure calls `cleanupRequestUploads`; middleware
validation failures retain its existing cleanup behavior. Route-local error
handling preserves bounded 400/413 responses without leaking internal exceptions.
Existing authenticated retrieval and Applicant projections remain unchanged.

Images remain immutable: replacement uploads create new UUIDs, and saving changes
the question/option reference. No generic deletion endpoint or media GC was added.
Successful uploads abandoned before question save can leave unattached, Admin-only
media; old replaced media is retained. This staging limitation is deliberately
documented instead of expanding into storage maintenance or history redesign.

## Focused automated verification

New tests use the existing backend Vitest harness. They import pure frontend
helpers to verify DTO/payload compatibility without adding a frontend framework.
Coverage includes all eight structured forms and malformed fallbacks, string/number
preservation, source labels, null text for image choices, untouched legacy options,
stable IDs/media/order, identity-based correctness and essay/stimulus clearing.

Object-URL tests use injected fetch/URL primitives: authenticated backend origin,
Bearer header, successful Blob creation, exact cleanup, in-flight abort/late
response protection, session failure, unsupported MIME, size bounds and path-ID
rejection. They are lifecycle-helper tests, not browser/DOM/manual QA.

Upload tests exercise the actual Express route, role middleware, secure multipart
pipeline, media service, temporary private provider, request commit/cleanup and
existing retrieval. Token verification and DB persistence are mocked; image
fixtures are synthetic. They verify PNG/JPEG, unauthorized roles, missing files,
spoofed/PDF/oversized/multiple files, one promotion/one record, UUID-only response,
retained successful bytes and cleanup on failed DB registration. Existing media,
question identity/scoring and upload tests remain passing.

Exact final focused command, from `backend`:

```powershell
npm test -- tests/unit/services/admin-exam-editor.contract.test.ts tests/unit/services/exam-media-client.contract.test.ts tests/unit/routes/exam-media-upload.routes.test.ts tests/unit/services/exam-media.service.test.ts tests/unit/routes/exam-media.routes.test.ts tests/unit/repositories/exam-engine.repository.test.ts tests/unit/services/exam-content.rules.test.ts tests/unit/storage/secure-upload.middleware.test.ts
```

**8 files / 184 tests passed**, no skips or failures. Earlier runs passed 182 and
183 cases before the final metadata/missing-file cases were added. Vite's existing
CommonJS/config-loader advisory remains informational.

Other commands and results:

| Working directory | Exact command | Result |
| --- | --- | --- |
| backend | `npm run build` | PASS |
| frontend | `npx tsc --noEmit` | PASS |
| frontend | `npx prettier --write "src/app/(portal)/admin/exam/questions/page.tsx" src/components/exam-content/*.tsx src/lib/exam-content.ts src/lib/exam-media.client.ts` | PASS, scoped formatting |
| frontend | `npx eslint "src/app/(portal)/admin/exam/questions/page.tsx" src/components/exam-content src/lib/exam-content.ts src/lib/exam-media.client.ts src/types/index.ts` | Final PASS, 0 errors/warnings |
| frontend | `npm run lint` | PASS, 0 errors / 39 warnings, all in unchanged files |
| frontend | `npm run build` | Final PASS, including TypeScript and 68 static pages |
| repository | `git diff --check` | PASS |
| repository | `git diff --cached --check` | PASS |

The initial targeted lint flagged synchronous initial loading state updates; these
were replaced with cancellable asynchronous request callbacks. A temporary unused
destructuring binding was also removed. Final targeted lint is clean. The full
frontend lint warnings cover existing unused declarations, existing Applicant
navigation and an existing signature image. Next's existing middleware/proxy and
Node module-registration deprecation notices are not package failures.

Both the Next.js and React component review covered client boundaries, labeled
controls/status/alerts, stable keys, current-token fetching, abort/revocation,
state derivation, immutable payload building and bounded rendering. This source
review and compile/helper coverage do not claim visual/browser acceptance.

## Independent review and acceptance addendum

Independent remote source/diff review completed on 2026-10-29 and passed the approved EXAM-CONTENT-4 Admin mixed-content rendering/editing, structured-content, option-identity preservation, private-image preview/upload, secure-upload integration, and scope checks.

Project-owner browser/visual QA was then completed against the development Admin Question Bank. The updated screen successfully rendered the seven existing development/demo questions and the owner approved the visible result. This acceptance does not claim that the real 72-question OLSAT bank was imported or content-QA'd; that remains EXAM-CONTENT-6.

No hosted CI is claimed for this feature-branch checkpoint.

**EXAM-CONTENT-4 acceptance: ACCEPTED — 2026-10-29.**

**Next authorized package:** EXAM-CONTENT-5 — Applicant Exam mixed-content renderer/UI, continuing on `feat/exam-content-integration`.

## Integrity, intentionally unexecuted work and stop boundary

All **109 authoritative manifest/assets files remain byte-for-byte unchanged**
against the initial SHA-256 snapshot. There are no source-package changes in the
diff. The Applicant exam page remained unchanged in EXAM-CONTENT-4.
No Prisma/schema/migration change was needed or made, so no Prisma commands or
migration deployment were run for this package. No importer/provenance projection
expansion was needed, and no private paths/provider metadata were added to DTOs.

`npm run exam-content:import` was **not executed**. The real development DB bank
was not populated, and no real assessment image was used as an upload test fixture.

EXAM-CONTENT-5 Applicant rendering, EXAM-CONTENT-6 controlled import/content QA,
and Phase B timer/autosave/recovery/submission/scheduling/selection/scoring/history
changes were not implemented in EXAM-CONTENT-4. Existing deletion/history and
staging limitations remain deferred.

## Exact files changed

1. `backend/src/controllers/exam-media.controller.ts`
2. `backend/src/routes/exam-engine.routes.ts`
3. `backend/src/services/exam-media.service.ts`
4. `backend/tests/unit/routes/exam-media-upload.routes.test.ts`
5. `backend/tests/unit/services/admin-exam-editor.contract.test.ts`
6. `backend/tests/unit/services/exam-media-client.contract.test.ts`
7. `backend/tests/unit/services/exam-media.service.test.ts`
8. `frontend/src/app/(portal)/admin/exam/questions/page.tsx`
9. `frontend/src/components/exam-content/admin-question-editor.tsx`
10. `frontend/src/components/exam-content/exam-image-upload.tsx`
11. `frontend/src/components/exam-content/exam-media-image.tsx`
12. `frontend/src/components/exam-content/option-content-renderer.tsx`
13. `frontend/src/components/exam-content/stimulus-renderer.tsx`
14. `frontend/src/components/exam-content/structured-stimulus-editor.tsx`
15. `frontend/src/lib/exam-content.ts`
16. `frontend/src/lib/exam-media.client.ts`
17. `frontend/src/types/index.ts`
18. `docs/superpowers/reports/2026-10-29-exam-content-4.md`
