# EXAM-CONTENT-5 — Applicant mixed-content rendering

Date: 2026-10-29 (Asia/Manila). Implementation checkpoint pending independent
review and project-owner browser QA. **EXAM-CONTENT-5 is not marked accepted.**

Repository: `MuelTech/graduate-system`. Existing branch:
`feat/exam-content-integration`. Verified local and fetched remote starting HEAD:
`eb1f4d3815834c1cea744bd6560c7ed2c24ce0a6`. The tree was clean and already at
the approved accepted checkpoint; no fast-forward or other history operation was
needed. No new branch was created and `main` was not changed.

## Applicant integration and preserved contracts

The MCQ area now composes a small `ApplicantQuestionRenderer`: canonical text,
the accepted `StimulusRenderer`, and ordered choices using the accepted
`OptionContentRenderer`. Image stimuli/options therefore reuse `ExamMediaImage`;
there is no second image-fetch implementation or Applicant-only structured parser.

The renderer owns no answer state or scoring rules. It receives the current
question, selected option ID and selection callback from the existing exam page.
`applicantOptionViews` explicitly copies Applicant fields, uses the accepted
`optionLabel` fallback, defensively sorts by `order` and stable ID, and binds each
selection callback to the authoritative option ID. It never mutates the API
payload or reads extra correctness/internal fields from a wider runtime object.

Persisted F/G/H/J/K labels remain exactly those labels. Null labels display the
same neutral `Option <order + 1>` semantics as EXAM-CONTENT-4. The old index-derived
`getLetter` helper and text-only option rendering have been removed. Sorting
changes presentation only; it never changes IDs or derives labels from position.

Selections retain the existing `answers[questionId] = option.id` authority. The
pure `withApplicantAnswer` helper is the original immutable map update extracted
for focused verification; it preserves selections for every other question.
Returning to a question derives its checked option from the unchanged page map.
The final MCQ submission is still `{ questionId, selectedOptionId }`; labels,
positions, media UUIDs, text and correctness are not submitted as answer authority.

## Content modes and structured forms

Plain text/NONE remains supported. IMAGE stimuli use the existing opaque media
identity. Text choices wrap normally; image-only choices retain null option text
and render their image without invented replacement text or an additional content
model. All choices remain selectable using their stable option ID.

| Accepted structured type | Reused presentation |
| --- | --- |
| MATRIX | Table preserving rows/cells, with horizontal scrolling |
| GROUPED_NUMBER_ROWS | Table retaining grouped-row boundaries |
| NUMBER_SEQUENCE | Items in source sequence order |
| ALPHANUMERIC_SEQUENCE | Ordered alphanumeric items |
| WORD_SERIES | Ordered words |
| LETTER_SEQUENCE | Ordered letters |
| WORD_BANK | Ordered, separated word-bank items |
| LOGICAL_PREMISES | Distinct numbered premises |

The shared bounded validator/renderer preserves fractional strings, numbers and
literal `?` values. Unsupported/malformed structured content retains its existing
bounded alert rather than rendering raw JSON or crashing the whole exam page.
No question-number-specific logic or inferred mathematical meaning was added.

An existing essay question can also display its accepted stimulus above its text.
This adds only a shared-renderer composition; essay response, count, autosave,
grading and navigation semantics were not modified.

## Accessibility and responsive behavior

Each question uses a native fieldset/legend and same-name radio inputs. Each
radio is keyboard-focusable, has `value={option.id}` and controlled `checked`,
and references its visible source-label and content description. Native radio
keyboard behavior is used rather than introducing custom exam key handling.
Selected choices have an explicit `Selected` marker and icon as well as styling.

The native radio covers the option card, so text/image/card-area clicks select
the choice. Shared image retry buttons remain separate interactive controls
above the hit area; no button is nested inside an option button or label.
Image alt text uses the safe option-label context and never correctness.

Text choices remain full-width; visual choices use one column on small screens
and two at the existing small-screen breakpoint. Minimum-width containment on the
main question area and renderer lets wide shared tables scroll within the area
instead of expanding the portal. Existing private-image containment retains
aspect ratio and bounds. Sidebar breakpoints and navigation controls are unchanged.
These are implementation/source assurances, not claimed browser/visual QA.

## Private media, errors and correctness boundary

The accepted component fetches `/api/exam-engine/media/:mediaId` through the
resolved backend base URL with the current Applicant Bearer token and no-store
semantics. PNG/JPEG responses become ephemeral Blob/object URLs. Identity/token
replacement and unmount abort requests, revoke owned URLs and ignore late results;
decode failures release the URL and show the existing bounded retry state.

Loading, ordinary retrieval failure, decode failure and retry remain local to
the image component. They do not clear the page's answer map. Existing 401/403
session-expiry sign-out behavior is reused without alteration; session/refresh
answer recovery remains Phase B and is not newly guaranteed by this package.

No public/static image path, repository asset path, storage key/provider, raw
server exception, fingerprint or answer-key metadata is rendered. Applicant
fixtures/types and the new renderer use the existing Applicant `ExamQuestion` /
`ExamOption`, not Admin types. Shared renderer props and the new Applicant view
carry no correctness field; selected styling derives only from the chosen ID.
Existing backend safe projections and Admin-only upload authorization are
unchanged and their focused regression tests passed.

## Lifecycle preservation and deferred work

A programmatic source comparison against the exact starting commit confirms that
the existing schedule/status loading, countdown, in-progress timer, 60-second
essay autosave, formatting and final-submission block remain byte-for-byte
unchanged. The MCQ navigation block and the essay textarea/navigation/submission
dialog remainder also remain unchanged. The fixed `10800` timer initialization,
start gating, fetched question selection/filtering, sidebar navigation and status
transitions were not corrected or redesigned.

Known Phase B timer-source mismatch, timeout/auto-submit behavior, MCQ autosave,
refresh/reconnect/session recovery, incomplete/duplicate submissions, cross-question
option validation, shared-bank activation/selection, essay assumptions, scoring
denominator and scheduling/latest-application semantics remain deferred.

There are **no backend runtime/API/auth/projection, shared DTO, Prisma or migration
changes**. The only backend-directory addition is a contract test using the existing
Vitest harness. Existing EXAM-CONTENT-4 renderer/helper implementations are unchanged.
No new frontend test framework, endpoint or broader access rule was introduced.

## Focused automated verification

The new synthetic contract suite verifies persisted labels and neutral fallbacks;
immutable order/ID sorting and legacy ties; real selection callbacks returning
option IDs rather than media IDs/labels/indexes; text/image content; selections
remaining in the existing immutable map when navigating away/back; all eight
shared structured forms and unsupported fallback; safe Applicant fixtures/views;
and native radio/content-renderer source contracts. It does not simulate timers
or change lifecycle policy. No actual assessment image is used as a UI fixture.

Existing targeted tests additionally verify the private-image authentication and
Blob cleanup helper, Admin/Applicant content compatibility, Applicant projection
non-leakage, existing media eligibility checks, private retrieval, and Applicant
rejection from Admin upload. HTTP tests use isolated mocked identity/DB and
synthetic temporary fixtures, not the project development database or a browser.

Exact commands, from `frontend`:

```powershell
npx prettier --write src/components/exam-content/applicant-question-renderer.tsx src/lib/applicant-exam-content.ts
npx tsc --noEmit
npx eslint "src/app/(portal)/applicant/exam/page.tsx" src/components/exam-content/applicant-question-renderer.tsx src/lib/applicant-exam-content.ts
npm run build
```

Results: formatting and TypeScript **PASS**; targeted ESLint **PASS (0 errors,
1 existing warning in the unchanged appeal handler's `window.location.href`)**;
production build **PASS**, including TypeScript and 68 static pages. The existing
Next middleware/proxy and Node module-registration deprecation notices remain
informational. The Applicant page was not broadly reformatted.

Exact focused command, from `backend`:

```powershell
npm test -- tests/unit/services/applicant-exam-content.contract.test.ts tests/unit/services/exam-media-client.contract.test.ts tests/unit/services/admin-exam-editor.contract.test.ts tests/unit/repositories/exam-engine.repository.test.ts tests/unit/services/exam-media-access.test.ts tests/unit/routes/exam-media.routes.test.ts tests/unit/routes/exam-media-upload.routes.test.ts
```

**7 files / 92 tests passed**, no skips or failures. Vite's existing CommonJS
config-loader advisory remains informational. Repository `git diff --check` and
staged `git diff --cached --check` passed. Source/diff review applied the existing
Next.js/React guidance for client boundaries, stateless composition, accessible
controls, stable IDs/keys, shared rendering and side-effect ownership.

Intentionally not run: full backend suite/build, Prisma/migration checks, full
frontend lint, Playwright/browser suites, manual/browser/UI/content QA, hosted CI
and deployment. Backend build was unnecessary because runtime backend code did
not change; frontend code was type-checked and built. No browser acceptance is
claimed from compile or helper/source-contract tests.

## Data integrity and stop boundary

All **109 authoritative manifest/assets files remain byte-for-byte unchanged**
against the initial SHA-256 snapshot. The source package, all code-level fixture
files, and existing seven project development/demo DB questions were left intact.
No project DB operations or demo cleanup were run; the seven-question baseline
count is owner-provided context, not a newly queried live count.

`npm run exam-content:import` was **not executed**. The real 72-question bank was
not imported. EXAM-CONTENT-6 cleanup/import/content QA and all Phase B lifecycle,
scheduling, recovery, selection-policy and scoring work were **not implemented**.
No manual/browser QA is claimed. Stop after commit/push, do not merge `main`,
and await independent review, project-owner browser QA and explicit authorization.

## Exact files changed

1. `frontend/src/app/(portal)/applicant/exam/page.tsx`
2. `frontend/src/components/exam-content/applicant-question-renderer.tsx`
3. `frontend/src/lib/applicant-exam-content.ts`
4. `backend/tests/unit/services/applicant-exam-content.contract.test.ts`
5. `docs/superpowers/reports/2026-10-29-exam-content-5.md`
