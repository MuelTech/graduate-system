# EXAM-B1 — Current examination configuration foundation

Date: 2026-11-02 (Asia/Manila).

Status: **IMPLEMENTED — INDEPENDENT REVIEW / OWNER ACCEPTANCE PENDING**.
B0A/B0B remain accepted for Phase B progression. Phase B is incomplete and not
production-ready. This package is a configuration foundation; B2 and later work
require separate authorization.

## Verified baseline and authorities

Before edits the working tree was clean on `feat/exam-engine-scheduling`.
Local HEAD, origin tracking HEAD and live remote branch all matched
`ff378b0748ff29302bf47fc08a00578711b0cb64`,
`docs(exam): close B0B review checkpoint`. Local/origin/live remote main matched
`a6dc6f57c6e8130482c814e90703765972fddaa9`. Relationship: eight ahead, zero
behind main. The later commits only record accepted B0A/B0B checkpoints; no
unexpected implementation was present. Continued on that existing branch without
reset, rebase, force push, recreation, main change or unrelated merge. Final
commit/remote/worktree identifiers are reported after delivery verification.

Read current checklist §7.2, Phase B plan/common protections/B1, audit configuration/
Program/settings/timer/scoring evidence, accepted B0A/B0B reports, content source
of truth and engineering verification policy. Previously read unchanged policy,
content and UI/UX authorities were checked against current history. UI reading
included SYSTEM_UI_UX_PLAYBOOK form/dialog/state/copy rules and UI_UX_AUDIT
editable/read-only authority and pending-submit guidance, preserving accepted
Exam Records/Score Management retirement. Applied Next.js and React best-practices
guidance to the bounded Question Bank/dialog integration.

## Storage decision and compatibility

Inspected Program/SystemSetting/application/score/audit models, all generic
settings and Program route/controller/service/repository paths, field readers/
writers, Question Bank/authoring/dialog primitives and existing contract tests.

Program's nullable `examMcqTotal`, `examEssayTotal`, `examPassingScore` are
per-Program compatibility fragments. MCQ maximum total is not points per item.
They are not copied, repurposed, deleted, reconciled or overwritten. Existing
result reads/grading still disagree about these values; this is later work.

Selected one current JSON document in existing SystemSetting, behind a dedicated
exam-specific repository, validator, service and controller. Existing JSON storage,
unique setting key and lastModifiedBy User relation can represent the small
nullable document and actor without schema changes. A dedicated new model or
version/effective-date subsystem would add unnecessary persistence machinery.

The reserved internal key is `entrance_exam_configuration`; it never appears in
the exam API/UI. Reads parse and validate the stored document centrally; corrupt
JSON/type/unsupported fields fail closed with a bounded 500, not fabricated defaults.
An absent row yields explicit null values and performs no insert. Saves upsert
only that key, record the JWT Admin actor and mark it unavailable for generic
settings editing. Server-owned timezone/completeness are not stored as mutable
settings. No seed/backfill or real configuration write was performed by the agent.

The generic settings list excludes this key. Generic string updates first resolve
the canonical stored key through database collation and reject reserved-key
updates with 409, including case/accent aliases. A DB-side NOT predicate also
excludes the reserved key from the generic update. Other generic settings retain
their update behavior. This closes the bypass rather than relying on frontend
visibility or a JSON label alone.

A read-only local database preflight found zero rows under the reserved key.
There were 17 Programs: one with an MCQ total, one with an essay total, none with
a passing-score value. These are presence counts, not approved policy values.
No existing row was changed, reset, imported or migrated.

## Exact API contract and unresolved policy

Existing engine namespace, authenticated **ADMIN only**:

- `GET /api/exam-engine/admin/configuration`
- `PUT /api/exam-engine/admin/configuration`

Both successful responses use this typed shape (shown unconfigured):

```json
{
  "examDurationMinutes": null,
  "mcqPointsPerCorrectItem": null,
  "essayMaximumScore": null,
  "passingThreshold": null,
  "passingThresholdUnit": null,
  "timezone": "Asia/Manila",
  "isComplete": false
}
```

The first three fields may contain positive finite numbers; duration is whole
minutes. Point values may be fractional. Minutes describe a duration magnitude,
not an approved start/deadline/window rule. Missing values remain null. No
three-hour/180, one-point, 30-point, 75/75% or live-bank default is copied in.

Passing threshold accepts **null only**. Its unit and value remain unconfirmed;
the API rejects raw numbers, threshold objects and attempted unit mutations.
`passingThresholdUnit` stays null, and completeness necessarily remains false
because a required policy field is unresolved. Even when all three editable
values are supplied, the result is a draft, never activated attempt authority.
No Active toggle, publication model or policy-approval flag is invented.

PUT is an atomic **full replacement** of the current editable values, not a
partial merge: omitted fields become null. The UI always submits all editable
fields plus `passingThreshold: null`. At least one supported field must be
supplied; missing/empty bodies reject rather than accidentally clearing a draft.
Use explicit nulls to clear values. Response values come from persisted readback.

Validation rejects malformed objects, unsupported fields, numeric strings,
booleans/arrays, nonfinite values, zero/negative values and unsafe arithmetic.
Duration must be a safe integer and convert to integer milliseconds safely;
point values must not exceed JavaScript's safe numeric bound. These are technical
storage/arithmetic checks, not invented institutional min/max ranges. Timezone,
unit/completeness, arbitrary keys, actors and Program identifiers cannot be set
through this API. Unexpected persistence errors return generic 500 responses.
Configuration responses are private/no-store, including domain errors.

## Question Bank UI

Added **Exam Configuration** beside **Add question** on the existing Admin Question
Bank. Reuses shared Dialog, Input, Label, Button and current tokens. No sidebar,
generic settings exam page, Exam Record control or separate workflow is added.
Existing question list, pagination, authoring dialogs, media/typography/rendering
are preserved.

The dialog loads only when opened. It shows loading, load failure + Retry,
unconfigured blank fields, positive-value feedback, pending Saving state, save
failure and successful-save feedback. Passing Threshold is disabled with a policy
confirmation explanation; `Asia/Manila` is system-defined read-only text. The
draft notice states that these settings do not yet change examination timing or
grading. No storage key/hash/version/database terminology is shown.

Failed mutations keep the dialog/edits open. A synchronous in-flight guard prevents
duplicate saves, controls are disabled, and closing is blocked during save.
Success reconciles field state and query data from the server's persisted DTO.
Fresh cancellable/no-store reads on opening avoid stale cached initial values;
background focus/reconnect refresh is disabled while editing to avoid replacing
dirty drafts. No native alert is used for configuration feedback.

## Focused verification

From `backend`:

```powershell
npm test -- tests/unit/services/exam-configuration.rules.test.ts tests/unit/repositories/exam-configuration.repository.test.ts tests/unit/routes/exam-configuration.routes.test.ts tests/unit/services/exam-configuration-ui.contract.test.ts tests/unit/repositories/exam-answer.repository.test.ts tests/unit/repositories/exam-engine.repository.test.ts tests/unit/controllers/exam-answer.controller.test.ts tests/unit/services/exam-answer.service.test.ts tests/unit/services/exam-result.service.test.ts tests/unit/repositories/exam-result.repository.test.ts tests/unit/routes/exam-result.routes.test.ts tests/unit/services/exam-result-email-queue.test.ts tests/unit/services/applicant-results.contract.test.ts tests/unit/services/admin-exam-editor.contract.test.ts tests/unit/services/exam-engine-content.service.test.ts tests/unit/controllers/exam-engine-content.controller.test.ts tests/unit/services/exam-record-detail.service.test.ts tests/unit/repositories/exam-record.repository.test.ts tests/unit/routes/exam-record.routes.test.ts tests/unit/routes/exam-media.routes.test.ts tests/unit/routes/exam-media-upload.routes.test.ts
npm run build
```

Result: **21 files / 351 tests PASS**, zero skips/failures. This includes **116
B1 tests in four new files**, including **20 frontend configuration contracts**,
plus **235 directly affected B0A/B0B/content/record/media regressions**. Backend
build (`tsc`): **PASS**. No full repository suite was run.

Coverage: absent/partial/all-representable draft values, fixed timezone, no fake
defaults, numeric bounds/types, malformed/unsupported payloads, explicit nulls,
unresolved threshold rejection, round-trip values/actor and replacement omissions,
corrupt persistence, generic-key bypass and unrelated setting behavior. Actual
Express router/controller/service/repository HTTP tests use real signed JWTs and
real authentication/role middleware with mocked database delegates. ADMIN reads/
writes pass; Applicant/Student/Panelist/missing/invalid tokens reject before data
access. No live configuration is persisted by these tests.

Historical-result regression executes the actual config service/repository against
isolated in-memory delegates with a finalized PASSED score/application and legacy
Program fixture: no Program/application/score update is called and their values
remain unchanged. Unrelated settings are preserved. B0B regressions additionally
retain finalized stored outcomes/scores and current grading behavior. This is
focused automated evidence, not a live database write/migration rehearsal.

UI contracts execute actual transpiled dialog/form JSX and handlers with controlled
hooks/query/mutation dependencies and React static rendering. They cover loading,
Retry, blank values, disabled threshold/timezone context, invalid-input feedback,
in-flight duplicate suppression/close protection, failed-save retention, typed
request fields, authoritative readback and success messaging. These are component/
handler contracts, not browser/manual QA. Existing Question Bank authoring and
rendering contracts remain passing.

From `frontend`:

```powershell
npx tsc --noEmit
npx eslint src/components/exam-content/exam-configuration-dialog.tsx src/lib/exam-configuration.ts "src/app/(portal)/admin/exam/questions/page.tsx"
node --test scripts/verify-exam-content-6-ui-follow-up.mjs
npm run build
```

TypeScript and scoped ESLint: **PASS**, no diagnostics. Existing Question Bank
verifier: **11/11 PASS**, preserving pagination/neutral assessment typography.
Production build: **PASS**, compiled/typechecked and generated all 68 static
pages. Build was justified by the new page → dialog → API client wiring. Existing
Next middleware/proxy and Node module-registration deprecation notices remain
informational. React/Next review covered client boundaries, hook order, shared
primitives, labeled controls, async/error handling and cancellation.

`git diff --check` and staged diff check: **PASS**. Checkpoint links verified.
Schema/migrations/Prisma generation: **UNCHANGED / NOT RUN**; no migration or
rehearsal is applicable. Dependencies/lockfiles are unchanged. No live contention
claim is made or required; B1 adds no attempt/submission concurrency mechanism.

## Files and protected boundaries

Backend:

- `backend/src/interfaces/exam-configuration.interfaces.ts` (new)
- `backend/src/services/exam-configuration.rules.ts` (new)
- `backend/src/services/exam-configuration.service.ts` (new)
- `backend/src/repositories/exam-configuration.repository.ts` (new)
- `backend/src/controllers/exam-configuration.controller.ts` (new)
- `backend/src/routes/exam-engine.routes.ts` (ADMIN configuration routes only)
- `backend/src/repositories/settings.repository.ts` (reserved-document guard only)

Frontend:

- `frontend/src/lib/exam-configuration.ts` (new)
- `frontend/src/components/exam-content/exam-configuration-dialog.tsx` (new)
- `frontend/src/app/(portal)/admin/exam/questions/page.tsx` (bounded action/dialog composition)

Tests: four new B1 files named in the command above. Documentation: this report,
checklist §7.2 and Phase B plan B1/status checkpoint. Historical audit and accepted
B0A/B0B evidence are not rewritten.

B0A answer validation/serialization and B0B finality/email eligibility runtime files
are byte-unchanged. Schema, source bank/Q24/Q40, manifest/import/assets, structured
stimuli/emphasis, option IDs, private media and Applicant projection implementation
are unchanged. Existing Program data and historical results are not modified.

**Manual/browser QA: NOT EXECUTED — project-owner responsibility.**
**Hosted CI: NOT OBSERVED; no hosted result claimed.** No PR, CI change, deployment
or main merge is performed by this package.

## Consumer rollout and limits

All saved values are drafts; none becomes approved policy merely by saving.
Passing threshold unit/value and duration boundary/start/deadline rules remain
unresolved. No runtime consumer reads the new configuration in B1. Existing
three-hour timer/window, one-point submission increment, essay 30 fallback,
75%/live-bank denominator behavior and Program fragments remain legacy behavior,
not configuration authority. B3/B4 must deliberately integrate time/duration,
B7 grading and B8 scoring/results; B2/later packages own received-content and
immutable attempt/result bases. Those consumers must require complete approved
configuration and retain the basis actually used before activation.

There is one current draft document, no history/version/effective-date/activation
model. Concurrent Admin replacements use ordinary last-committed whole-document
saves; no stale-edit reconciliation is claimed. Policy completion and consumer
integration require separately reviewed changes. Stop after B1 commit/push and
remote/worktree verification; independent review and owner acceptance are pending.
