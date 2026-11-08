# FACULTY-8 — Private Files and Official-Record Guard Closure

- Date: 2026-11-08 (Asia/Manila).
- Status: **FACULTY-8 accepted for continuation** at correction HEAD `76cc0ae8da9e2aca109ccd729356f793faf909b6` after independent remote commit-diff/source review and bounded GS-011 frozen-attempt identity correction review. FACULTY-9 remains deferred / not started.
- Branch: `feat/faculty-admin-access`.
- Starting feature/local/remote HEAD: `cddd60cc5d916c3a02ac002f4d6ff9135dfb01d0`.
- Fetched `origin/main`: `045316540d97364214792c7d441ae20a1e426d4c`.
- Starting worktree/index: clean; local/feature remote drift `0 0`; main/feature drift `0 20`.
- Fetch succeeded after using the permitted escalation for `.git/FETCH_HEAD`; no merge, rebase, reset, branch creation, history rewrite, or database operation.

## Authority and corrected scope

The existing [audit](2026-11-08-faculty-admin-access-audit.md), [implementation plan](../plans/2026-11-08-faculty-admin-access-implementation.md), Faculty/Admin Source of Truth and approved design, Document Lifecycle, Defense Workflow, Collaborative Defense Workspace/RAP, accepted PREDEF-1B/1C and GS-020 authorities, official Defense integration plans, and Engineering Verification Policy govern this package. The user's FACULTY-8 scope correction supersedes the broader attachment's Memo/eLibrary instructions. The completed repository audit was not repeated.

FACULTY-9-owned work is **deferred**: Memo attachments, `MemoAudience`/Program/archive handling, Memo Management, Research Repository manuscript downloads, eLibrary respondent-data downloads, repository publication, broader Storage and operational administration. Their existing policy was not activated, redesigned, or certified by this delivery. FACULTY-8 supplies no `memos.manage` or `repository.view` implementation mapping. The frontend proxy allowlist is unchanged; `memo` was not added. No FACULTY-9 implementation was started.

## Complete generic registry classification

All eight existing entries are inventoried. The registry type now requires an entry for each classified model. Capability checks below describe the **enabled synthetic target**, not live rollout.

| Model type | Owner / academic authority retained | Admin target authority / exact context | Package |
| --- | --- | --- | --- |
| `cor-upload` | Exact owning Applicant/Student User | `cor.view`; no Student-registry or essay substitute | FACULTY-8 |
| `thesis-document` | Exact owning Student; sole active Adviser for academic manuscript types; active exact committee assignment with existing CP8/CDW history rules | `defense.applications.view` for same-thesis valid academic manuscript or stage-scoped application evidence; `defense.schedules.view` only for exact same-thesis/stage schedule context. Manuscripts must be the exact attempt binding; COR/receipt use accepted same-thesis/stage supporting history. No schedule capability for instruments or arbitrary manuscripts. Admin denied `RESPONDENT_DATA` | FACULTY-8 |
| `rap-report` | Existing registry has no owner/academic file grant; none invented | `defense.records.view` | FACULTY-8 |
| `student-requirement` | Exact owning Student | `students.view` | FACULTY-8 |
| `plagiarism-result` | Exact owning Student through same Thesis relationship | `defense.applications.view`, same-thesis integrity required | FACULTY-8 |
| `memo` | Existing creator and extra-auth policy unchanged | No FACULTY-8 capability mapping; audience/Program/archive authorization deferred | FACULTY-9 |
| `elibrary-manuscript` | Existing researcher/publication behavior unchanged | No FACULTY-8 capability mapping; publication/download policy deferred | FACULTY-9 |
| `elibrary-respondent-data` | Existing policy unchanged | No FACULTY-8 mapping or new privacy authority; eLibrary raw-data download policy deferred | FACULTY-9 |

For thesis `RESPONDENT_DATA`, original Student ownership is preserved while enabled Admin access, including Full, is denied. Faculty/committee/essay authority never substitutes for researcher ownership or institutional privacy authorization. No new respondent-data capability was invented. This does **not** claim that the deferred eLibrary respondent-data route has been secured.

Academic thesis access keeps the existing sole-active-Adviser, active assignment query, stage/type, exact historical attempt binding, certified Proposal and CP8/CDW history rules. Supporting evidence cannot gain committee access merely by being mislabeled as a bound manuscript. Contradictory academic type/stage is denied. Availability, issuer history and old records are not rewritten.

## Endpoint / capability matrix

All paths below are GET requests. The owning services independently authorize; route middleware is an additional boundary.

| Endpoint | Admin target capability | Additional authority |
| --- | --- | --- |
| `/api/documents/:modelType/:id/file` | Registry matrix above | Authorization finishes before resolving any physical path or stream |
| `/api/thesis/adviser-certifications` | `defense.applications.view` or `defense.schedules.view` | Admin must supply exact `thesisId`; schedule-only results are filtered to exact same-thesis/stage/manuscript schedule binding |
| `/api/thesis/adviser-certifications/:certificationId/pdf` | Same contextual GS-017 mapping | Direct PDF independently checks the exact certification; schedule-only Admin needs matching attempt binding |
| `/api/thesis/adviser/requests/records` | `adviser.requests.view` | Finalized request records only |
| `/api/thesis/adviser/requests/:id/pdf` | `adviser.requests.view` | Exact finalized snapshot, signature and hash validated |
| `/api/thesis/defense/:scheduleId/records/criteria/:panelAssignmentId` | `defense.records.view` | Exact schedule/evaluator; owning active academic evaluator retains safe JSON access |
| `/api/thesis/defense/:scheduleId/records/criteria/:panelAssignmentId/pdf` | `defense.records.view` | Admin print authority; exact schedule/evaluator; validated signature retained internally |
| `/api/thesis/defense/:scheduleId/records/summary` | `defense.records.view` | Detailed Summary remains Admin-only |
| `/api/thesis/defense/:scheduleId/records/summary/pdf` | `defense.records.view` | Existing persisted Summary source and historical Adviser seat |
| `/api/thesis/defense/:scheduleId/records/application/pdf` | `defense.records.view` | Existing exact GS-006/GS-007 schedule/stage source |
| `/api/thesis/defense/:scheduleId/records/evaluations/pdf` | `defense.records.view` | Existing exact evaluator packet and ordering |
| `/api/thesis/defense/records` | Existing FACULTY-7 `defense.records.view` guard retained | Admin list |
| `/api/thesis/defense/:scheduleId/records` | Existing FACULTY-7 `defense.records.view` guard retained | Admin detail |
| `/api/thesis/student/defense/:scheduleId/application` and `/pdf` | No Admin substitute | Existing exact Student ownership; current-account validation in the PDF/source boundary |

GS-017 preserves exact issuer `adviserId`, owning Student, issued status, same-thesis reviewed document, stage/type/title, issuer identity, server issue timestamp and signature validation. Committee membership grants no certification rights. Schedule authority cannot expose another attempt's certification. Ordinary metadata contains no raw signature.

GS-020 preserves exact owning Student and requested Adviser, independent of current AdviserAssignment. Student signature, Adviser CONFORME, Dean APPROVED, immutable finalized timestamp, snapshot and hash remain authoritative. No current-profile rebuild, signature format change, form revision change or print/fill/upload flow. Ordinary metadata omits signatures, hash and snapshot; the PDF controller continues returning bytes only.

## Service boundaries and current account

`PrivateRecordAuthorization` is a small code-owned adapter restricted to the six existing FACULTY-8 read capabilities. It reuses `loadCurrentAccount`, `resolveConfiguredAccountAccess` and `hasConfiguredCapability`; it is not another capability resolver. Enabled reads resolve current User identity, activity, credential state and academic profile, and fail closed on missing/invalid Admin access or unknown, duplicate and wrong-category grants. Stale caller/JWT roles or cached grants cannot restore access. Calls reload current authority; no cross-request cache or request-supplied grant is used.

Guards cover GS-017/020 source/list services, official Criteria JSON and internal print source, Summary read/source, Defense Application source, evaluation bundle source, document identity/filename, all Admin PDF wrappers and owning ThesisService delegates. Omitting the actor cannot bypass the official Criteria or Summary boundary. Existing FACULTY-7 Admin list/detail guards remain intact. Shared academic routes still require exact ownership/issuer/request/evaluator authority after account validation.

The internal Criteria print source is separate from the safe JSON DTO. JSON omits raw `signatureData` and projects only approved snapshot fields, including when stored JSON contains extra internal fields. Print rendering still receives the exact signature through the existing validation/mapping contract. Conflicting frozen schedule/evaluator identity is denied. Historical snapshot data is never replaced or written on a read; legacy snapshot-less Criteria retain the existing in-memory rendering projection. The accepted evaluation-finalization snapshot writer is unchanged.

The private storage root, managed `storageKey`, legacy `filePath` fallback, containment/symlink provider, MIME and original filename selection remain intact. Success and denial audit events remain, including target current-account denials. Streaming retains `private, no-store` and now explicitly sets `nosniff`. Unexpected retrieval errors return a generic message rather than an internal filesystem error. No direct `/uploads` serving or storage-provider change was introduced.

## Dormant rollout and preservation

- `PRIVATE_RECORD_ENFORCEMENT_ENABLED` is code-owned and **false**. `DIRECT_ACCESS_ENFORCEMENT_ENABLED` and existing package switches are unchanged/off. Enabled coverage uses bounded constructor injection only.
- No environment/request/JWT/frontend/DB setting can activate these guards. No real Admin mapping, provisioning or document grant was performed. Legacy dormant behavior remains pending complete coverage and separately authorized rollout.
- No capability key, role, Prisma schema, migration, storage provider, physical layout, renderer/template or frontend change.
- No signature, score, outcome, title or timestamp backfill. No historical snapshot/hash mutation, scoring change, committee role change, or Adviser replacement.
- Full Admin remains separate from Adviser, Chairman, evaluator and Rapporteur authority. `essay.evaluate` grants none of these file/record powers.

## Verification

Focused related run: **31 files passed; 847 tests passed; 5 skipped (852 total)**. The five skips are the provider/symlink tests that cannot create symlinks on this Windows host. They are not claimed as passing. No full backend suite was run. The command, from `backend`, was:

```powershell
npx vitest run tests/unit/services/faculty-8-private-documents.test.ts tests/unit/services/faculty-8-official-records.test.ts tests/unit/routes/faculty-8-private-records.routes.test.ts tests/unit/controllers/faculty-8-document.controller.test.ts tests/unit/services/adv5-document-service-auth.test.ts tests/unit/services/adv5-adviser-document-auth.test.ts tests/unit/services/document-auth.stage-aware.test.ts tests/unit/services/document.schedule-binding-auth.test.ts tests/unit/services/cp8-document-auth.test.ts tests/unit/services/cdw6-document-auth.test.ts tests/unit/services/adviser-certification-document.service.test.ts tests/unit/services/adviser-request-record.service.test.ts tests/unit/services/cp7-official-defense-records.test.ts tests/unit/services/cp7-fix1-authority.test.ts tests/unit/services/cp7-fix1-controller.test.ts tests/unit/services/cp7-fix2-conclusion-privacy.test.ts tests/unit/services/official-defense-document.service.test.ts tests/unit/services/official-defense-summary-document.service.test.ts tests/unit/services/official-defense-application-document.service.test.ts tests/unit/services/official-defense-evaluation-bundle.service.test.ts tests/unit/services/official-defense-document-filename.test.ts tests/unit/controllers/official-defense-document.controller.test.ts tests/unit/controllers/adviser-request-record.controller.test.ts tests/unit/controllers/adviser-certification-document.controller.test.ts tests/unit/routes/official-defense-document.routes.test.ts tests/unit/routes/faculty-7-defense-adviser.routes.test.ts tests/unit/services/faculty-7-defense-adviser-boundaries.test.ts tests/unit/storage/local-storage.provider.test.ts tests/unit/storage/local-storage.symlink.test.ts tests/unit/storage/storage.service.test.ts tests/unit/services/scheduled-defense-submission.service.test.ts
```

After the final explicit Criteria snapshot DTO projection and its privacy regression, the affected subset was rerun: **7 files / 284 tests passed**:

```powershell
npx vitest run tests/unit/services/faculty-8-private-documents.test.ts tests/unit/services/faculty-8-official-records.test.ts tests/unit/routes/faculty-8-private-records.routes.test.ts tests/unit/controllers/faculty-8-document.controller.test.ts tests/unit/services/cp7-official-defense-records.test.ts tests/unit/services/cp7-fix1-authority.test.ts tests/unit/services/official-defense-document.service.test.ts
npm run build
```

Backend `npm run build`: **PASS**. `git diff --check`: **PASS**. Existing Vite configuration warning remains; no tooling/configuration change was made. Earlier focused failures were resolved: empty-actor legacy not-found compatibility retained; new parameterized fixtures corrected; old Summary fixtures supplied their actual frozen identities; read-time backfill assertions now require no historical writes. Ownership/assignment denial assertions were retained. Renderer-reader mocks now use the explicit internal print method. FACULTY-7's deferred route test list transfers only the newly owned FACULTY-8 reads to their dedicated matrix.

No memo/repository policy tests or frontend tests/build were required because those surfaces were not changed. Manual/browser QA and hosted CI: **NOT EXECUTED / NOT CLAIMED**. No real-DB or contention rehearsal; no application/XAMPP database access.

## Delivery and limits

The original delivery commit contains this report and changes only FACULTY-8. The accepted implementation is the original FACULTY-8 commit `f94d02f87c471602a7a2a6e3f9a5775653790ac9` plus the bounded correction at `76cc0ae8da9e2aca109ccd729356f793faf909b6`. The plan/checklist now record **FACULTY-8 accepted for continuation** after independent review.

Independent remote commit-diff/source review is complete for the FACULTY-8 implementation and its bounded correction. Target capability enforcement remains synthetic/source-ready and dormant, not a claim of deployed Restricted access. The deferred Memo/eLibrary/Repository/Storage policies, hosted-CI/manual/real-DB evidence gaps, and Windows symlink verification limitation remain outside this acceptance. FACULTY-9 was not started and remains deferred pending project-owner approval.

## Exact changed files

- `backend/src/access/private-document-context.ts`
- `backend/src/access/private-record-authorization.ts`
- `backend/src/controllers/document.controller.ts`
- `backend/src/middlewares/private-record-capability.middleware.ts`
- `backend/src/routes/thesis.routes.ts`
- `backend/src/services/adviser-certification-record.service.ts`
- `backend/src/services/adviser-request-record.service.ts`
- `backend/src/services/document.service.ts`
- `backend/src/services/official-defense-document.service.ts`
- `backend/src/services/official-defense-record.service.ts`
- `backend/src/services/thesis.service.ts`
- `backend/tests/unit/controllers/faculty-8-document.controller.test.ts`
- `backend/tests/unit/routes/faculty-7-defense-adviser.routes.test.ts`
- `backend/tests/unit/routes/faculty-8-private-records.routes.test.ts`
- `backend/tests/unit/routes/official-defense-document.routes.test.ts`
- `backend/tests/unit/services/cp7-fix1-authority.test.ts`
- `backend/tests/unit/services/cp7-fix2-conclusion-privacy.test.ts`
- `backend/tests/unit/services/cp7-official-defense-records.test.ts`
- `backend/tests/unit/services/faculty-8-official-records.test.ts`
- `backend/tests/unit/services/faculty-8-private-documents.test.ts`
- `backend/tests/unit/services/official-defense-application-document.service.test.ts`
- `backend/tests/unit/services/official-defense-document.service.test.ts`
- `backend/tests/unit/services/official-defense-evaluation-bundle.service.test.ts`
- `backend/tests/unit/services/official-defense-summary-document.service.test.ts`
- `docs/superpowers/GSIS_IMPLEMENTATION_CHECKLIST.md`
- `docs/superpowers/plans/2026-11-08-faculty-admin-access-implementation.md`
- `docs/superpowers/reports/2026-11-08-faculty-8-private-file-official-record-guards.md`

## Independent-review correction — GS-011 frozen attempt identity

Correction starting local/fetched remote HEAD: `f94d02f87c471602a7a2a6e3f9a5775653790ac9` on `feat/faculty-admin-access`; worktree/index clean and branch drift `0 0`. At correction delivery, status remained **FACULTY-8 implemented / pending independent review**; the subsequent independent review accepted the corrected package at `76cc0ae8da9e2aca109ccd729356f793faf909b6`.

Independent review found that the Summary JSON boundary checked frozen attempt identity but the GS-011 PDF source did not. `getOfficialSummaryDocumentSource()` now rejects a non-null persisted snapshot with HTTP 409 and the existing JSON-boundary error message when its `scheduleId` or `defenseType` differs from the requested exact schedule. The check occurs before historical Adviser-seat resolution. `mapOfficialSummaryToRenderInput()` independently rejects either mismatch against its source identity, so an inconsistent injected source cannot reach the renderer.

The source still returns the exact persisted snapshot without repair, regeneration, mutation or backfill. Valid frozen Student/evaluator/result values, Proposal/Final historical Adviser selection, Title's absent Adviser, and existing Admin/capability boundaries remain unchanged. Existing positive stage fixtures now explicitly carry matching frozen stage identities; malformed injected/persisted fixtures remain deliberately mismatched in the new regressions.

Ten new cases cover both mismatch dimensions at the mapping, injected PDF, real source, and enabled Full/Restricted source-to-PDF boundaries. They assert denial before rendering/Adviser lookup and unchanged persisted data. The new tests reproduced the finding before the fix: 10 failed, 97 existing tests passed. After the correction, verification from `backend` was:

```powershell
npx vitest run tests/unit/services/official-defense-summary-document.service.test.ts tests/unit/services/faculty-8-official-records.test.ts
npm run build
```

- Focused tests: **2 files / 107 tests passed; none skipped**.
- Backend build: **PASS**.
- Repository-root `git diff --check`: **PASS**.
- Manual/browser, hosted CI and real-DB checks: **NOT EXECUTED / NOT CLAIMED**. Existing broader-package limitations above remain; this correction did not rerun or certify those checks. The existing Vite configuration warning remains unchanged.
- No schema, migration, frontend, renderer/template, snapshot-write or enforcement-switch change. No Memo/eLibrary/Repository/Storage policy work, no FACULTY-9 or other package work, and no merge to `main`.

Exact correction files:

- `backend/src/services/official-defense-record.service.ts`
- `backend/src/services/official-defense-document.service.ts`
- `backend/tests/unit/services/official-defense-summary-document.service.test.ts`
- `backend/tests/unit/services/faculty-8-official-records.test.ts`
- `docs/superpowers/reports/2026-11-08-faculty-8-private-file-official-record-guards.md`


## Independent-review acceptance — 2026-11-09 (Asia/Manila)

Independent remote commit-diff/source review is complete for the original FACULTY-8 implementation `f94d02f87c471602a7a2a6e3f9a5775653790ac9` and the bounded correction `76cc0ae8da9e2aca109ccd729356f793faf909b6`. The live `feat/faculty-admin-access` branch was verified at the correction HEAD during review.

The original acceptance blocker was the GS-011 Summary PDF path lacking the frozen `scheduleId` / `defenseType` attempt-identity validation already present in the Summary JSON read model. The correction closes that gap at both `getOfficialSummaryDocumentSource()` and `mapOfficialSummaryToRenderInput()`, before Adviser resolution/rendering, and adds focused regressions for both mismatch dimensions across persisted-source and PDF paths. The review found no remaining FACULTY-8 blocker and no scope drift into schema/migrations, frontend, renderer/template redesign, enforcement activation, or FACULTY-9.

Evidence classes remain separate: Codex reported the package and correction test/build results above; the independent review verified the pushed remote diff/source and regression intent, not a second execution of the Windows test commands. GitHub hosted CI, manual/browser QA and real-DB checks were not executed or claimed for this acceptance.

**Acceptance checkpoint:** FACULTY-8 is accepted for continuation at correction HEAD `76cc0ae8da9e2aca109ccd729356f793faf909b6`. Direct-access/private-record enforcement remains dormant. FACULTY-9 remains deferred / not started and requires explicit project-owner approval before implementation.
