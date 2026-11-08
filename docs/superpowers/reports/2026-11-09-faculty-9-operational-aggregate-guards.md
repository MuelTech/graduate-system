# FACULTY-9 — Settings, operational surfaces and aggregate containment

Date: 2026-11-09 (Asia/Manila). Branch: `feat/faculty-admin-access`.
Starting local and actual remote HEAD: `00092857f154dc28db24e28baabab17c43238d22`; clean worktree verified before edits with `git status --short`, `git rev-parse HEAD`, and escalated `git ls-remote origin refs/heads/feat/faculty-admin-access`.

**Status: FACULTY-9 accepted for continuation** at `a22777becfb901973d2aec3e1548e360a60d25d0` after independent remote commit-diff/source review. FACULTY-10 remains deferred / not started pending project-owner approval.

## Bounded coverage ledger (recorded before implementation)

All paths have `/api` prefix. In the enabled target, Full resolves enumerated catalog capabilities; Restricted requires the exact key (including catalog prerequisites). No role string, request grant list, or supplied access snapshot authorizes a service. Each owning service reloads current account/access using the established loader/resolver; inactive, password-gated, malformed, wrong-category, duplicate and unknown grants fail closed. Route checks are additional. Production composition remains code-owned/dormant.

| Method/path or action | Exact capability / decision | Full behavior | Restricted behavior | Other authority preserved / service boundary |
| --- | --- | --- | --- | --- |
| GET `/settings` | `settings.view` | Allowlisted keys only | Same projection with key | SettingsService; no other settings/secrets/configuration |
| PUT `/settings/:key` | `settings.manage` | Allowlisted exact keys only | Same with key | SettingsService + repository canonical-key check; exam/access/security/unknown keys denied |
| GET `/settings/email-templates` | `email.configuration.manage` | Approved template administration | Requires key | SettingsService; does not imply log reads or sending |
| PUT `/settings/email-templates/:key` | `email.configuration.manage` | Existing template update | Requires key | SettingsService; no external delivery certification |
| GET `/settings/audit-logs` | `audit.view` | Read | Requires key | SettingsService; protected access evidence remains readable |
| DELETE `/settings/audit-logs/:id`; POST `/settings/audit-logs/delete` | Explicitly denied in target | Denied | Denied | SettingsService exclusion; existing repository protected-prefix deletion remains unchanged for dormant legacy behavior |
| GET `/admin/email-logs/logs` | `email.logs.view` | Read | Requires key | Dedicated email-log service; template authority is separate |
| GET `/admin/storage/health` | `storage.health.view` | Read existing diagnostic DTO | Requires key | StorageHealthService; no paths/provider/layout changes |
| POST `/admin/storage/integrity-scan` | `storage.integrity.scan` | Existing read-only scan | Requires key and health prerequisite | StorageHealthService; no repair/delete/cleanup |
| GET `/repository/admin/entries` | `repository.view` | Safe archive/publication queue | Requires key | RepositoryPublicationService; raw paths/signatures/datasets excluded |
| PUT `/repository/admin/entries/:id/publish`; `/unpublish`; `/metadata` | `repository.manage` | Existing metadata/publication transitions | Requires key and view prerequisite | RepositoryPublicationService; no file publication or privacy grant implied |
| GET `/databank` | `repository.view` | Safe legacy archive queue | Requires key | DatabankService takes authenticated actor identity, never `userRole === ADMIN` |
| GET `/repository`; `/repository/:id` | Public metadata; optional authenticated current member/owner affects download eligibility | Public/member rules | Public/member rules, no private archive grant | RepositoryPublicationService uses optional current-account validation; private/unknown remains 404; respondent download only exact current Student researcher |
| GET `/databank/public`; `/databank/public/:id` | Deprecated public metadata compatibility aliases only | Guest/public projection only | Guest/public projection only | Delegates to RepositoryPublicationService without caller context; no member/owner download eligibility is inferred on these aliases; private/unknown remains 404 |
| POST `/memos`; PATCH `/memos/:id/archive` | `memos.manage` | Existing management | Requires key | MemoService; creator/audience/Program/archive/notifications preserved |
| GET `/memos`; direct all-memo service read | `memos.manage` for Admin-wide projection | All memos | All memos only with key; otherwise denied | MemoService; Student ALL/STUDENTS/own PROGRAM and Faculty/PANELIST ALL/PANELISTS, unarchived only; other supported non-Admin audience ALL only |
| GET `/documents/memo/:id/file` | `memos.manage` for Admin; exact audience for others | Management read including archive | Requires key; no creator bypass after revocation | DocumentService; Student Program and Faculty/PANELIST audience + unarchived; no generic authenticated bypass |
| GET `/documents/elibrary-manuscript/:id/file` | `repository.view` for private Admin archive; existing member publication / Student owner | Safe private manuscript context with key | Private with key; published via current-member rule | DocumentService; preserve published Student/Faculty/PANELIST/Admin member access and exact original Student ownership |
| GET `/documents/elibrary-respondent-data/:id/file` | Exact original Student researcher only | No automatic raw-data access | No automatic raw-data access | DocumentService; repository view/manage, Full and ADMIN never substitute for unresolved institutional privacy authority |
| GET `/admin/dashboard` enrollment | `students.view` | Enumerated key | Only with key | AdminDashboardService; do not query/project missing sections |
| Dashboard thesis pipeline, application review / ready counts | `defense.applications.view` | Enumerated key | Only with key | Same service; shared authoritative application buckets; ready bucket requires application read, not schedule-only authority |
| Dashboard upcoming sessions, awaiting conclusion | `defense.schedules.view` | Enumerated key | Only with key | Same service; no Student identity/schedule leakage without schedule read |
| Dashboard RAP signature monitoring | `defense.records.view` | Enumerated key | Only with key | Same service; count only, no academic signing authority |
| Dashboard waiver / Adviser Request / COR / recent audit | `waivers.view` / `adviser.requests.view` / `cor.view` / `audit.view` respectively | Enumerated keys | Each source independently gated | Same service; unauthorized sources never fetched, fields omitted rather than fabricated zeros |
| POST `/evaluation/:id/assign` | Deferred Expert Evaluation, denied in target | Denied | Denied | EvaluationService exclusion; no expert capability invented |
| GET `/admin/panelists`; GET `/admin/panelists/:id`; POST `/admin/panelists`; PUT `/admin/panelists/:id` | Deferred to FACULTY-10, denied in FACULTY-9 target | Denied until owning package | Denied until owning package | AdminPanelistService exclusion only; no Faculty Management implementation/provisioning/grants/availability work |

Generic Settings safe keys are grounded in the existing Settings page's read/save contract: `ACADEMIC_YEAR`, `SEMESTER`, `ENROLLMENT_START`, `ENROLLMENT_END`, `TITLE_DEFENSE_START`, `TITLE_DEFENSE_END`, `PROPOSAL_DEFENSE_START`, `PROPOSAL_DEFENSE_END`, `FINAL_DEFENSE_START`, `FINAL_DEFENSE_END`. This package does not turn these stored values into new workflow policy. Exact requested and database canonical keys must agree; aliases, unknown keys, exam configuration, Administrator access, session/security and speculative configuration fail closed.

Existing FACULTY-5/6/7/8 actions remain owned by their accepted guards, including excluded essay/result-email/reminder/distribution/academic override paths. Public Programs is a read-only directory. Auth/account recovery, own notifications, Applicant/Student and exact academic assignment endpoints retain their existing ownership policies. No new Restricted entry point is inferred from a namespace or page label.

## Implementation and preservation

`OperationalAuthorization` is a bounded adapter over `loadCurrentAccount`, `resolveConfiguredAccountAccess`, `hasConfiguredCapability` and the enumerated catalog. It does not introduce a grant resolver or any capability. Shared reads use current account identity; enabled Admin actions require current resolved access. The supplied role is retained only for explicitly dormant compatibility. Unknown/malformed/duplicate/wrong-category Admin grants and inactive/credential-gated accounts are denied. Caller/body/JWT capability arrays are never used.

Enabled Settings/template, publication/metadata and Memo writes run behind the existing singleton Administrator-access fence, then the actor row lock and fresh account/access read, before domain reads/writes. Repositories bind to that transaction; publication/Memo audit records participate in the same transaction. Notifications and existing Memo email behavior follow the committed Memo creation. Synthetic revocation-at-fence tests prove authorization ordering; they do not prove real MariaDB contention/rollback semantics.

The accepted Exam Configuration repository exclusion and SQL protected access-audit prefix deletion logic are preserved. Enabled generic single/bulk audit deletion is explicitly unavailable even to Full: there is no approved destruction capability in this package. Dormant legacy deletion still uses the unchanged protected-prefix SQL predicate, with its existing focused regression tests. `audit.view` never authorizes deletion.

Dashboard authorization happens before source invocation. Each missing authority omits the source call and corresponding fields, including counts; a valid Admin with no dashboard module grants receives only empty structural objects. Full uses the enumerated keys. The existing enrollment/pipeline derivation, application buckets, COR actionable queue, schedule semantics and audit humanization are preserved. No generic dashboard/Analytics capability was introduced.

Public Repository metadata, private-versus-unknown 404 behavior, Student archive registration/ownership, and existing active Student/Faculty/PANELIST/Admin published-manuscript membership remain. Full/repository view/manage no longer creates respondent-data eligibility in the public projection. The enabled stream requires the exact current Student researcher and coherent archive/Thesis ownership; publication never creates raw-data rights. Exact institutional authority for other respondent-data readers remains unresolved and denied. No new raw-data permission/policy was invented.

Memo Student ALL/STUDENTS/own PROGRAM and Faculty/legacy PANELIST ALL/PANELISTS filtering remains unchanged. Enabled ordinary Applicant/CUSTOM reads are limited to active ALL-audience memos rather than inheriting the old all-memo fallback. Current Admin feed/attachments require `memos.manage`, including when the actor originally created the memo. Managers retain archived-state reads; ordinary audiences cannot stream archived attachments. No historical PANELISTS storage rename. Creator DTOs now select only ID/name/role, excluding credentials and private account fields. Attachment DTOs contain the canonical document URL instead of physical paths; existing pages already build that same URL by memo ID. The controller accepts attachment paths only from the server upload, ignoring body `attachmentUrl`. Creator identity, Program targeting, archive semantics, in-app notifications and existing Memo-triggered email invocation are preserved. This is not acceptance of Email Integration, result-email authority, delivery/queue reliability or external delivery.

No frontend/copy redesign was necessary. The copy/playbook authorities were consulted for safe API denials and attachment DTO compatibility: no raw keys or filesystem diagnostics in new authorization messages, no new institutional terminology. No navigation, Faculty Management, essay, Analytics, Curriculum, expert workflow, academic override, storage repair/delete, audit retention, schema/migration, provisioning/mapping, deployment, main merge or live Restricted rollout occurred.

`OPERATIONAL_ENFORCEMENT_ENABLED` is code-owned and **false**; existing switches are unchanged/off. Constructors expose bounded test/composition injection only. Runtime settings, environment, JWTs and request bodies cannot activate it. Enabled target behavior is synthetic/source-ready, not a claim that production Restricted access has been activated. Dormant streaming retains the legacy compatibility path until a separately reviewed coordinated rollout of all packages. The public respondent-link denial and safe Memo DTOs are compatible hardening independent of grant activation.

## Verification and delivery

The final broader run was deliberately limited to the operational changes and directly shared access/auth/private-document boundaries: **43 files passed; 1,212 tests passed; 0 failed; 0 skipped**. No full backend suite was run. Exact command, from `backend`:

```powershell
npx vitest run tests/unit/access tests/unit/services/faculty-9-operations.test.ts tests/unit/services/faculty-9-dashboard.test.ts tests/unit/services/faculty-9-repository-memo.test.ts tests/unit/services/faculty-9-private-documents.test.ts tests/unit/routes/faculty-9-operations.routes.test.ts tests/unit/services/repository-publication.service.test.ts tests/unit/repositories/repository-publication.repository.test.ts tests/unit/controllers/repository.controller.test.ts tests/unit/routes/repository.routes.test.ts tests/unit/controllers/databank-public-alias.test.ts tests/unit/services/databank-archive.service.test.ts tests/unit/repositories/databank-archive.repository.test.ts tests/unit/services/faculty-3-memo.test.ts tests/unit/services/admin-dashboard.service.test.ts tests/unit/services/admin-dashboard.rules.test.ts tests/unit/repositories/admin-dashboard.repository.test.ts tests/unit/services/storage-health.service.test.ts tests/unit/controllers/storage-health.controller.test.ts tests/unit/repositories/storage-health.repository.test.ts tests/unit/repositories/settings-access-audit.test.ts tests/unit/services/faculty-8-private-documents.test.ts tests/unit/services/faculty-8-official-records.test.ts tests/unit/routes/faculty-8-private-records.routes.test.ts tests/unit/controllers/faculty-8-document.controller.test.ts tests/unit/services/adv5-document-service-auth.test.ts tests/unit/services/adv5-adviser-document-auth.test.ts tests/unit/services/document-auth.stage-aware.test.ts tests/unit/services/document.schedule-binding-auth.test.ts tests/unit/services/cp8-document-auth.test.ts tests/unit/services/cdw6-document-auth.test.ts tests/unit/services/adviser-certification-document.service.test.ts tests/unit/services/adviser-request-record.service.test.ts tests/unit/services/official-defense-document.service.test.ts tests/unit/services/official-defense-summary-document.service.test.ts tests/unit/services/official-defense-application-document.service.test.ts tests/unit/services/official-defense-evaluation-bundle.service.test.ts tests/unit/middlewares/auth.middleware.test.ts
```

The smallest suites were run first: operational/dashboard **2 files / 161 passed**, then Repository/Memo/private-documents/HTTP **3 files / 224 passed**. After existing controller/route fixtures were adapted to authenticated identities and the additional guard, the first related **24-file run passed 717 tests**. Additional path-projection, archive-state and missing-Student regressions are included in the final 1,212-test run. Final safe-denial wording review was followed by **2 files / 281 tests passed**, using:

```powershell
npx vitest run tests/unit/services/faculty-9-operations.test.ts tests/unit/services/faculty-9-repository-memo.test.ts
npm run build
```

Backend `npm run build`: **PASS** after the final production-code changes. Repository-root `git diff --check`: **PASS**. Initial focused fixture failures were corrected (the test used a guessed Exam Configuration key instead of the actual exported constant; two table cases passed a string rather than a key array). Four first related-run failures were old route-count/authenticated-actor expectations; those were updated without removing denial assertions. The existing Vite CommonJS/native-loader warning remains; no tooling change was made.

No browser/manual QA, hosted CI, deployment validation, real-DB business/integration test or real multi-connection contention rehearsal was executed or claimed. One pre-existing Repository route-shape test imported the database module before it had a mock: the application's startup `$connect()` probe succeeded. No application-data query/mutation or schema operation was invoked by that test. A database mock was added before the passing related/final reruns; those runs were isolated. This incidental connectivity log is not database verification. No database credentials or real account records were inspected or written.

Independent remote commit-diff/source review is complete. The accepted FACULTY-9 implementation commit is `a22777becfb901973d2aec3e1548e360a60d25d0`; the live `feat/faculty-admin-access` branch was verified at that commit during review. Work still stops after FACULTY-9; FACULTY-10 remains deferred / not started pending project-owner approval.

## Exact changed files

43 files (source, focused regressions and three canonical progress/report documents):

- `backend/src/access/memo-audience.ts`
- `backend/src/access/operational-authorization.ts`
- `backend/src/access/operational-settings-policy.ts`
- `backend/src/controllers/admin-dashboard.controller.ts`
- `backend/src/controllers/databank.controller.ts`
- `backend/src/controllers/email.controller.ts`
- `backend/src/controllers/memo.controller.ts`
- `backend/src/controllers/repository.controller.ts`
- `backend/src/controllers/settings.controller.ts`
- `backend/src/controllers/storage-health.controller.ts`
- `backend/src/middlewares/operational-capability.middleware.ts`
- `backend/src/repositories/memo.repository.ts`
- `backend/src/repositories/repository-publication.repository.ts`
- `backend/src/repositories/settings.repository.ts`
- `backend/src/routes/admin-dashboard.routes.ts`
- `backend/src/routes/admin-panelist.routes.ts`
- `backend/src/routes/admin-storage.routes.ts`
- `backend/src/routes/databank.routes.ts`
- `backend/src/routes/email.routes.ts`
- `backend/src/routes/evaluation.routes.ts`
- `backend/src/routes/memo.routes.ts`
- `backend/src/routes/repository.routes.ts`
- `backend/src/routes/settings.routes.ts`
- `backend/src/services/admin-dashboard.service.ts`
- `backend/src/services/admin-panelist.service.ts`
- `backend/src/services/databank.service.ts`
- `backend/src/services/document.service.ts`
- `backend/src/services/email-log.service.ts`
- `backend/src/services/evaluation.service.ts`
- `backend/src/services/memo.service.ts`
- `backend/src/services/repository-publication.service.ts`
- `backend/src/services/settings.service.ts`
- `backend/src/services/storage-health.service.ts`
- `backend/tests/unit/controllers/repository.controller.test.ts`
- `backend/tests/unit/routes/faculty-9-operations.routes.test.ts`
- `backend/tests/unit/routes/repository.routes.test.ts`
- `backend/tests/unit/services/faculty-9-dashboard.test.ts`
- `backend/tests/unit/services/faculty-9-operations.test.ts`
- `backend/tests/unit/services/faculty-9-private-documents.test.ts`
- `backend/tests/unit/services/faculty-9-repository-memo.test.ts`
- `docs/superpowers/GSIS_IMPLEMENTATION_CHECKLIST.md`
- `docs/superpowers/plans/2026-11-08-faculty-admin-access-implementation.md`
- `docs/superpowers/reports/2026-11-09-faculty-9-operational-aggregate-guards.md`


## Independent-review acceptance — 2026-11-09 (Asia/Manila)

Independent remote commit-diff/source review is complete for FACULTY-9 commit `a22777becfb901973d2aec3e1548e360a60d25d0`. The review reconciled the exact 43-file commit against the canonical FACULTY-9 plan, action/capability ledger and live production paths.

The review verified the shared OperationalAuthorization/current-account boundary, exact Settings/key policy, distinct email-template/log capabilities, storage-health/integrity separation, Repository/Databank service-level guards, Memo management/audience/attachment behavior, raw respondent-data fail-closed ownership, dashboard no-query containment, and explicit target denial of generic audit deletion, legacy Expert assignment and deferred Faculty administration. No acceptance-blocking authorization, privacy or scope issue remained.

One documentation nuance was corrected during acceptance: the canonical `/repository` routes use optional authentication and may project current-member/owner download eligibility, while the deprecated `/databank/public*` aliases deliberately call the same publication service without caller context and therefore remain guest/public projections only. This is a documentation clarification, not a production-code correction.

Evidence classes remain separate. Codex reported 43 affected test files / 1,212 tests passed with zero skips/failures, a final 2-suite rerun of 281 tests, backend build PASS and diff checks PASS. The independent review inspected the pushed source/diff and corresponding regression coverage; it did not rerun those local Windows commands. GitHub hosted CI, browser/manual QA and real-DB business/contention verification were not executed or claimed.

**Acceptance checkpoint:** FACULTY-9 is accepted for continuation at `a22777becfb901973d2aec3e1548e360a60d25d0`. Operational enforcement remains code-owned/dormant. No schema/migration/frontend/live provisioning or Restricted rollout is accepted by this checkpoint. FACULTY-10 remains deferred / not started pending explicit project-owner approval.
