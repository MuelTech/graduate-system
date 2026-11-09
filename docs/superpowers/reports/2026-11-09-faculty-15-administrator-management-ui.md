# FACULTY-15 — Administrators Management and permission-aware Admin UI

**Status:** Accepted for continuation at `60e559568b4a368666e5cd42fde64eeb3ec29daf` after independent remote commit-diff/source review. Project-owner manual/browser/visual QA remains pending and separate from this source-continuation acceptance.

**Date:** 2026-11-09 (Asia/Manila).

**Repository / branch:** `MuelTech/graduate-system` / `feat/faculty-admin-access`.

**Starting HEAD:** `bb368269e4fb479f030c6be388a5767d4a9f1b9a`. Both local and actual remote branch HEAD matched before editing; starting worktree was clean. The ending HEAD is the commit containing this report, identified in the delivery message.

## Scope and reconciliation

Executed the existing FACULTY-15 package, without replacing the accepted architecture/plan. Read the live source-of-truth, design, repository audit, implementation plan, FACULTY-4/9/13/14 dependency reports, engineering checklist/verification policy, copy source-of-truth and UI/UX playbook/audit. Reconciled those documents against current catalog, self-access projection, Administrator DTOs/routes/services, dashboard service and Admin pages before editing.

No production backend source, API, schema, migration, activation switch, real account, grant, bootstrap or conversion changed. DR-1 and DR-4 remain separate decisions. FACULTY-16/17/18 were not started. Custom Roles and mock Analytics remain existing Full-only compatibility destinations; this package does not implement those products or arbitrary role provisioning.

The implementation uses these existing contracts:

| Surface | Existing owner / bounded behavior |
| --- | --- |
| Own account and access | FACULTY-13 `/auth/me`; validate exact current ADMIN identity, credential readiness, resolved level and catalog capabilities. Invalid/unmapped/unavailable access has no inferred Full fallback. |
| Capability choices | Import the original dependency-free FACULTY-1 catalog directly; only direct-grantable ADMIN keys appear as human action labels. No wildcard, Faculty essay grant or editable Full-only management grant. Backend prerequisite expansion remains authoritative. |
| Administrator list/detail | FACULTY-4 GET `/admin/administrators?page=…&pageSize=25` and `/:userId`. Use the actual no-total page contract; mapped/inactive accounts can be edited, unmapped/invalid targets require review. |
| Account creation | FACULTY-4 POST with exactly identity, level and direct capability keys. Secure credential generation/audit/commit remain backend-owned. Show the returned temporary password once in component-local state after list/access synchronization; never put it in query/mutation caches, storage or logs. |
| Status/access changes | FACULTY-4 PATCH with level, direct capability keys and active status. Full demotion/deactivation receives confirmation. Preserve drafts on rejection and show the exact safe last-Full 409 message; no client-side last-Full counting or lock replacement. |
| Admin navigation | Separate Administrators destination; Full-only management and compatibility destinations; exact read/action capabilities for operational modules. Cross-module links use the same destination checks. Mobile focus cycle/Escape return and collapsed group expansion remain usable. |
| Dashboard | Existing FACULTY-9 aggregate only when the account owns every source capability. Partial Restricted accounts get authorized module links and no aggregate query; zero grants get account information and a safe no-work message. |
| Session/private work | Fresh self-access on route entry, foreground/visibility, shared 403 signal and successful mutations. Private QueryClients are isolated by account and resolved access fingerprint, then cleared on account/access change or failure. Pending refresh hides route content and portaled dialogs; unchanged access retains drafts. |

### Existing API constraints retained explicitly

The production operational gate remains false, so the legacy dashboard service can return all sources. The frontend therefore requires **all eight** source reads before requesting that aggregate: Students, Defense Applications, Defense Schedules, Defense Records, Waivers, Adviser Requests, COR and Audit. It never fetches a broad aggregate for a partial account and then hides unauthorized results. A Restricted account with all eight reads can also legitimately request it.

Applicant assignment currently searches the Applicants directory. Its UI requires `exam.schedules.manage` **and** `applicants.view`; the existing assignment entry is also available on Exam Schedules. There is no new directory API or added catalog prerequisite. Scheduled-defense listing and its workflow summary currently use the Defense Applications API, so those requests require `defense.applications.view`; Schedules-only access retains the bounded Ready list/exact schedule detail and withholds the incompatible list. The disabled Scheduled tab explains the required access. Unknown counts remain unavailable rather than becoming fabricated zeroes.

Settings tabs and requests are separated between settings reads/writes, audit reads, email-template configuration, email logs and exam configuration. Configuration-only, log-only and audit-only accounts do not fetch `/settings`. Existing email-log read and exam-configuration APIs are reachable from their own permitted Settings entries.

The backend package declares CommonJS. A narrow Turbopack loader compiles only the pure catalog to that existing module format, with repository source root resolution. No generated or manually copied grant catalog, package/module conversion or new dependency was introduced.

## Action presentation ledger

| Existing module | Restricted action presentation |
| --- | --- |
| Students | Comprehensive-exam recording requires `students.comprehensive_exam.manage`. |
| Faculty | Existing bounded `canManage` response is additionally constrained by current `faculty.manage`; a dormant legacy boolean cannot elevate a view-only account. |
| Exam Schedules | Create/edit/status require `exam.schedules.manage`; booking reads retain schedules-view authority and record links additionally require records-view. |
| Exam Records | Start authorization, appointment changes, finalization and reconsideration use their distinct existing capabilities. Historical records remain readable under records-view. |
| Exam Questions | Question create/edit/delete and question-set editing require questions-manage; configuration requires its independent configuration capability. |
| COR / Waivers | COR verification/rejection and waiver decisions require their corresponding action capabilities. |
| Defense Applications / Schedules | Approval/rejection requires applications-review; committee, scheduling and correction editors require schedules-manage. Exact reads do not imply writes. |
| Adviser Requests | Decision controls require requests-review. |
| Repository / Storage | Metadata/publication controls require repository-manage; integrity scanning requires scan authority. |
| Settings / Audit | Settings fields/save require settings-manage; audit is read-only. Unclassified generic audit deletion controls are removed. |
| Academic work | Admin essay grading controls are removed from the record screen. Faculty owns academic essay evaluation; Full administrative access confers no academic override. The unclassified result-email mutation is also withheld. |

Frontend checks are presentation, not authentication or authorization. Existing API guards, strict parsers, access fence, transactional audit, last-active-Full protection and academic/resource authority remain unchanged. The source ships for review on this feature branch; it is not an activation/deployment claim. With the actual Administrator management switch false, real management requests remain controlled 503 responses, including for a configured Full account. With operational/direct switches false, UI filtering does not claim to enforce Restricted backend access against tampered requests. Target denial behavior is verified through existing synthetic backend test seams.

## Verification evidence

Implementation-agent evidence only:

| Check | Result |
| --- | --- |
| New `node scripts/verify-faculty-15-admin.mjs` | 49 passed, zero failures/skips. Catalog parity, Full enumeration, every direct Admin grant, malformed/cross-category/prerequisite rejection, safe zero/unmapped access, route/aggregate boundaries, credential/cache boundaries and unchanged gates. |
| Related frontend verifiers | FACULTY-11: 20; FACULTY-14: 42; FACULTY-2 session: 17; FACULTY-3 compatibility: 8 passed (87 total). Updated FACULTY-11's test seam for the additional Admin capability check while preserving its existing context checks and no-visible-raw-key intent. |
| Focused backend regressions | 9 suites / 390 tests passed, zero failures/skips. Catalog/resolver; Administrator route/service; FACULTY-6/7 route guards; FACULTY-9 operations/dashboard; FACULTY-13 projection. Existing tests exercise target authorization, tampering/self-elevation and last-Full conflict semantics through synthetic test seams. |
| Backend build | `npm run build` passed. No backend production changes. |
| Frontend TypeScript / scoped ESLint | Passed; no scoped lint errors/warnings. |
| Frontend production build | `npm run build` passed on the final source (all 70 pages generated). |
| Synthetic Chrome | 29 scenarios passed in the complete final behavior run. An additional eight focused repeat runs passed for credential dismissal, mobile keyboard navigation, collapsed groups and source-read constraints. |
| Visual inspection | Implementation agent inspected synthetic mobile/desktop screenshots; stable mobile/desktop recapture passed in a final two-scenario visual subset. Screenshots/traces remain ignored local test artifacts. |
| Diff checks | `git diff --check` passed; staged check is repeated before commit. |

Browser fixtures bind only `127.0.0.1:4315/4316`, load the original pure catalog, and supply synthetic JSON plus a real NextAuth session/UI. They neither invoke the production backend nor touch MariaDB. Opt-in `E2E_ADMIN_FIXTURE=1` prevents accidental normal-suite execution. They prove UI wiring/interactions, not real database locking or live account provisioning.

Browser coverage includes Full list/detail/create; Restricted direct grants; strict POST/PATCH bodies; one-time credentials and dismissal; retained failure drafts; Full demotion conflict; deactivation confirmation; unmapped target; dormant 503/retry; no-total pagination; zero-grant/Student-only landings; guessed management URLs; question read-only controls; independent Settings reads; read-only Settings; current-access revocation, same-browser account switch, self-demotion and outage recovery; pending route/portal privacy; a resource 403 without an automatic fetch loop/logout; authorized Full aggregate; unmapped current identity; Schedules-only minimum reads; mobile Tab/Escape/focus return and collapsed desktop navigation.

Reproduce from `frontend`:

```powershell
node scripts/verify-faculty-15-admin.mjs
node scripts/faculty-15-fixture-server.mjs
# In a separate terminal while that isolated preview runs:
$env:E2E_ADMIN_FIXTURE='1'
$env:E2E_BASE_URL='http://localhost:4315'
node node_modules/@playwright/test/cli.js test e2e/administrators-management.spec.ts
```

Use the existing Playwright Chrome configuration. Stop the preview before a production build. The repository's existing Next middleware-convention and Node register deprecations, and Vitest native-config warning, are nonblocking existing toolchain notices.

**Project-owner manual/browser/visual acceptance remains pending and belongs to the project owner. It is not recorded as PASS.** Independent remote commit-diff/source review is complete and accepted for continuation at `60e559568b4a368666e5cd42fde64eeb3ec29daf`. Hosted CI was not observed for this delivery; local/synthetic execution evidence is not recorded as hosted CI.

## Dormancy and unresolved readiness gates

All three existing code-owned switches remain literal `false`: `ADMINISTRATOR_MANAGEMENT_ENABLED`, `DIRECT_ACCESS_ENFORCEMENT_ENABLED`, `OPERATIONAL_ENFORCEMENT_ENABLED`. No switch was made request/environment-controlled; no real Full/Restricted Administrator, bootstrap, grant, conversion or Restricted rollout occurred.

FACULTY-4's isolated real-MariaDB migration/full-chain/contention/audit-trigger/rollback verification remains unexecuted. FACULTY-12's five-case isolated InnoDB evaluator/access/grading contention proof also remains unexecuted. Their existing separate-server safeguards/readiness requirements remain intact; mock/unit success and browser 409 feedback do not close either gate. No normal XAMPP/application database, scratch schema, reset, reseed or live write was used here.

FACULTY-15 is accepted for continuation at `60e559568b4a368666e5cd42fde64eeb3ec29daf`. Stop here; FACULTY-16 remains deferred / not started pending explicit project-owner approval.

## Exact changed files

The following manifest includes this report and the two status-only canonical documentation updates. No backend source or migration appears in the change set.

- `docs/superpowers/GSIS_IMPLEMENTATION_CHECKLIST.md`
- `docs/superpowers/plans/2026-11-08-faculty-admin-access-implementation.md`
- `docs/superpowers/reports/2026-11-09-faculty-15-administrator-management-ui.md`
- `frontend/e2e/administrators-management.spec.ts`
- `frontend/next.config.ts`
- `frontend/scripts/capability-catalog-loader.cjs`
- `frontend/scripts/faculty-15-fixture-server.mjs`
- `frontend/scripts/verify-faculty-11-management.mjs`
- `frontend/scripts/verify-faculty-15-admin.mjs`
- `frontend/src/app/(portal)/admin/dashboard/page.tsx`
- `frontend/src/app/(portal)/admin/exam/applications/[id]/page.tsx`
- `frontend/src/app/(portal)/admin/exam/applications/page.tsx`
- `frontend/src/app/(portal)/admin/exam/cor/page.tsx`
- `frontend/src/app/(portal)/admin/exam/questions/page.tsx`
- `frontend/src/app/(portal)/admin/exam/slots/page.tsx`
- `frontend/src/app/(portal)/admin/exam/waiver/page.tsx`
- `frontend/src/app/(portal)/admin/layout.tsx`
- `frontend/src/app/(portal)/admin/repository/page.tsx`
- `frontend/src/app/(portal)/admin/settings/page.tsx`
- `frontend/src/app/(portal)/admin/settings/storage/page.tsx`
- `frontend/src/app/(portal)/admin/thesis/advisers/page.tsx`
- `frontend/src/app/(portal)/admin/thesis/applications/[id]/page.tsx`
- `frontend/src/app/(portal)/admin/thesis/defense-records/[scheduleId]/page.tsx`
- `frontend/src/app/(portal)/admin/thesis/defense-records/page.tsx`
- `frontend/src/app/(portal)/admin/thesis/scheduling/page.tsx`
- `frontend/src/app/(portal)/admin/users/administrators/page.tsx`
- `frontend/src/app/(portal)/admin/users/applicants/[id]/page.tsx`
- `frontend/src/app/(portal)/admin/users/applicants/page.tsx`
- `frontend/src/app/(portal)/admin/users/panelists/page.tsx`
- `frontend/src/app/(portal)/admin/users/students/[id]/page.tsx`
- `frontend/src/app/(portal)/admin/users/students/page.tsx`
- `frontend/src/components/admin/access/admin-access-provider.tsx`
- `frontend/src/components/admin/access/admin-dialog.tsx`
- `frontend/src/components/admin/access/email-logs.tsx`
- `frontend/src/components/admin/administrators/administrator-form.tsx`
- `frontend/src/components/admin/administrators/temporary-credential.tsx`
- `frontend/src/components/admin/defense-applications/application-row.tsx`
- `frontend/src/components/admin/defense-scheduling/email-preview-dialog.tsx`
- `frontend/src/components/admin/defense-scheduling/role-assignment-dialog.tsx`
- `frontend/src/components/admin/defense-scheduling/scheduled-defense-correction-editor.tsx`
- `frontend/src/components/admin/defense-scheduling/scheduled-defense-detail.tsx`
- `frontend/src/components/admin/defense-scheduling/scheduling-queue-panel.tsx`
- `frontend/src/components/admin/exam/assign-applicant-dialog.tsx`
- `frontend/src/components/admin/exam/exam-record-actions.tsx`
- `frontend/src/components/admin/exam/schedule-bookings-dialog.tsx`
- `frontend/src/components/admin/exam/start-authorization.tsx`
- `frontend/src/components/admin/faculty/faculty-detail.tsx`
- `frontend/src/components/admin/faculty/faculty-form.tsx`
- `frontend/src/components/admin/faculty/temporary-credential.tsx`
- `frontend/src/lib/admin-access.ts`


## Independent-review acceptance — 2026-11-09 (Asia/Manila)

Independent remote commit-diff/source review is complete for FACULTY-15 commit `60e559568b4a368666e5cd42fde64eeb3ec29daf`. The live `feat/faculty-admin-access` branch was verified at that exact implementation SHA, and the pushed range from `bb368269e4fb479f030c6be388a5767d4a9f1b9a` was reconciled as one commit changing exactly 50 files. The package changed frontend production/UI, verification and documentation only; no FACULTY-15 production backend source, schema, migration or activation mechanism changed.

The review verified that the Admin frontend consumes the existing FACULTY-13 `/auth/me` configured-access projection without inferring Full authority from the ADMIN role alone. Current identity, password readiness, configured-access status, Full/Restricted level and exact ADMIN-category capabilities are validated fail-closed. Valid zero-grant Restricted Administrators remain authenticated with a safe account landing; malformed, wrong-category, duplicate, unavailable, inactive or unmapped access never falls back to Full.

The frontend reuses the original FACULTY-1 capability catalog directly through a narrow build-time loader rather than maintaining a second grant authority. Full Administrator presentation requires the complete enumerated ADMIN catalog including the non-direct-grantable Administrator-management capability. Restricted presentation uses only the resolved effective capability set and cannot obtain `administrator_access.manage`, Faculty `essay.evaluate`, unknown keys or missing prerequisites through the UI.

Administrators Management is presented only to a current Full Administrator and reuses the accepted FACULTY-4 list/detail/create/PATCH contracts. The UI supports bounded list/detail, explicit Full/Restricted level, Active/Inactive state, direct capability configuration, safe unmapped-target review, last-active-Full conflict feedback and one-time temporary credential handoff. The temporary password remains component-local, bypasses React Query caches and persistent browser storage, and is cleared on dismissal. The FACULTY-4 access-removal API remains an existing backend operation; the accepted FACULTY-15 UI scope does not require a separate removal button, so its absence is not an acceptance blocker.

The dynamic Admin navigation and action controls map existing routes to approved catalog capabilities. Read authority does not automatically display mutation controls. Cross-module dependencies are bounded: Applicant assignment is presented only with both Exam Schedule management and Applicant read access, while Scheduled-defense summary/list requests that use the Defense Applications API are withheld without the corresponding Applications read grant. Settings reads are separated among general Settings, Audit, Email Templates, Email Logs and Exam Configuration rather than fetching unrelated settings data.

Dashboard containment was independently checked because `OPERATIONAL_ENFORCEMENT_ENABLED` remains false. The frontend requests the legacy broad `/admin/dashboard` aggregate only when the current account owns every read capability represented by that aggregate. Partial or zero-grant Restricted accounts instead receive authorized destination links and a safe no-work landing; the UI does not fetch the broad aggregate and hide unauthorized cards afterward.

Current-access and private-work caching are account/access scoped. The current-access query is keyed by authenticated Admin User ID; the operational QueryClient remounts on the resolved access fingerprint and clears on account/access changes or failure. Foreground/focus, the shared protected-resource 403 signal and successful mutations refresh current access. Route presentation refreshes access before rendering sensitive Admin pages, but these checks remain presentation only; existing backend route/service/resource authorization remains authoritative.

The review also verified that Full administrative authority does not recreate academic override authority: legacy Admin Essay Evaluation controls are removed from the Exam Record presentation, and unclassified result-email mutation UI is withheld. Custom Roles and mock Analytics remain compatibility/full-only destinations for later ownership; FACULTY-15 does not implement arbitrary Custom Roles, Analytics or FACULTY-17 retirement.

No acceptance-blocking authorization, capability-mapping, Dashboard-query, Administrator-management, privacy/cache or scope issue remained.

Evidence classes remain separate. Codex reported 49 new frontend verification checks PASS, 87 related frontend checks PASS, 9 backend suites / 390 tests PASS, 29 synthetic Chrome scenarios PASS plus focused repeat runs, frontend TypeScript/scoped ESLint/production build PASS, backend build PASS and repository-root diff check PASS. The independent review inspected the pushed production source, exact commit diff, FACULTY-1/FACULTY-4 authority semantics and committed verifier/browser-test intent; it did not rerun those local commands or inspect ignored local screenshots. GitHub hosted status/workflow runs were not observed for the reviewed SHA.

**Project-owner manual/browser/visual QA remains PENDING / NOT YET EXECUTED as an acceptance evidence class.** Synthetic browser runs and implementation-agent screenshot inspection do not substitute for owner acceptance. FACULTY-15 is accepted here for development continuation only.

All three code-owned switches remain literal `false`: `ADMINISTRATOR_MANAGEMENT_ENABLED`, `DIRECT_ACCESS_ENFORCEMENT_ENABLED`, and `OPERATIONAL_ENFORCEMENT_ENABLED`. No real Full/Restricted Administrator provisioning, bootstrap, grant activation, role/data conversion or live Restricted rollout occurred. DR-1 and DR-4 remain separately governed.

The FACULTY-4 isolated real-MariaDB migration/full-chain/contention/audit-trigger/rollback gate remains **OPEN / UNVERIFIED**. The FACULTY-12 five-case isolated InnoDB evaluator/access/grading contention gate also remains **OPEN / UNVERIFIED**. Neither is closed by FACULTY-15's mock/unit/browser evidence.

**Acceptance checkpoint:** FACULTY-15 is accepted for continuation at `60e559568b4a368666e5cd42fde64eeb3ec29daf`. Live Restricted enforcement/provisioning remains unactivated. FACULTY-16 remains deferred / not started pending explicit project-owner approval.
