# FACULTY-3 — Faculty identity compatibility readers

Date: 2026-11-08 (Asia/Manila). Status: **IMPLEMENTED — independent review/acceptance pending**.

Only FACULTY-3 is implemented. FACULTY-4 was not started. This report does not independently accept the package or authorize migration deployment, account conversion, grants, or activation.

## Verified starting state

- Repository: `MuelTech/graduate-system`; branch: `feat/faculty-admin-access`.
- Fetched `origin/feat/faculty-admin-access` and `origin/main` before implementation.
- Local HEAD and fetched feature HEAD: `9d24ca9bf19f454d16fad6106d5a210f17f06ed0`.
- Local main and fetched main: `045316540d97364214792c7d441ae20a1e426d4c`.
- `git rev-list --left-right --count origin/main...HEAD`: `0 8`.
- Working tree and index were clean. No fast-forward was necessary. No branch creation, merge, rebase, reset, history rewrite, or force-push.

Read the canonical Faculty/Admin source of truth, design, FACULTY-0 audit/plan, implementation checklist, and Engineering Verification Policy. FACULTY-1/2 remain accepted prerequisites; only their identity reader/fixture seams change here.

## Normalizer contract and compatibility behavior

`backend/src/utils/academic-account.ts` owns `ACADEMIC_ACCOUNT_ROLES`, `isAcademicAccountRole`, and the Prisma `academicAccountRoleFilter`. Only exact stored account values `PANELIST` and `FACULTY` are academic identities. ADMIN, CUSTOM, APPLICANT, STUDENT, unknown/lowercase values, and defense roles such as CHAIRMAN/ADVISER are not normalized to Faculty. Classification supplies no assignment or capability authority.

The separate frontend bundle uses `frontend/src/lib/account-role.ts`: its stored-account predicate has the same bounded contract; `academicPortalRole` maps the synchronized lowercase `faculty` session identity to the existing `panelist` technical portal. Session identity itself remains `faculty`; it is not overwritten with the route alias. Existing open string NextAuth/session role types already admit the new identity; current-session validation now recognizes FACULTY explicitly. Defense assignment types remain unchanged.

Updated surfaces:

- Current-account loading recognizes FACULTY and rejects missing/inactive academic profiles for either identity. Current User state, active account/profile, and generic credential state remain authoritative. No claim comparison grants old ADMIN/CUSTOM privilege.
- The existing selected `panelist` email-login option accepts either stored academic identity and returns the actual stored role. Other selected roles retain exact matching. Login choices, wording, credential verification, and routes are not redesigned; a new `faculty` login selector is deliberately not exposed yet.
- Profile self routes and all existing academic thesis route guards admit both identities through the shared list. Profile lookup still uses the current User ID.
- Adviser candidacy and committee/adviser candidate queries support both accounts. Existing Internal/External, availability, lifecycle, and assignment rules remain unchanged.
- Adviser Requests, My Advisees, Proposal/Final manuscript reviews, GS-017 issuer ownership and GS-020 addressed-Adviser ownership retain exact User/assignment/record constraints. Record-list filters now constrain FACULTY by the same issuer/requested-Adviser IDs as PANELIST.
- Defense workspace/evaluation/collaboration routes accept both account identities; contextual PanelAssignment roles and exact schedule/lifecycle checks remain authoritative.
- Socket handshake uses the fresh current account. Room membership, recipient revalidation, and report-preview sender/recipient queries use both identities plus active account/profile, cleared password gate, and exact active assignment. Preview still requires the exact RAPPORTEUR seat and editable lifecycle.
- Thesis-file and published-manuscript readers recognize both identities; existing exact manuscript/assignment, owner, issuer, and document-type rules remain in place.
- The retained `MemoAudience.PANELISTS` feed covers both identities. Role-targeted memo notifications/emails include only matching active academic Users with active profiles. No audience enum/history rename. Other notifications remain keyed by exact User IDs/assignments; notification-link projection accepts FACULTY and retains `/panelist` destinations.
- Journey fixtures no longer force existing academic seed accounts back to PANELIST; they require an already-academic account and preserve its stored identity. The normal seed/provisioning writers remain legacy PANELIST writers. No new runtime writer emits FACULTY in this package, and no seed was executed.

## Enum migration and preservation evidence

New forward migration: `backend/prisma/migrations/20261108010000_faculty_identity_compatibility/migration.sql`.

```sql
ALTER TABLE `users` MODIFY `role` ENUM('ADMIN', 'STUDENT', 'PANELIST', 'CUSTOM', 'APPLICANT', 'FACULTY') NOT NULL DEFAULT 'APPLICANT';
```

FACULTY is appended, preserving existing value order and the APPLICANT default. This is one enum-expansion DDL statement, without DML. Prisma's schema-to-schema diff from the starting commit independently emitted the identical ALTER statement. A source comparison confirmed the entire Prisma schema differs from baseline by exactly the one additive UserRole value.

**Zero existing Users were converted.** The migration was not deployed to any database in this task. No password/hash, User/profile ID, AdviserAssignment/PanelAssignment ID/history, evaluation, signature, audit attribution, snapshot/hash, official-record owner, or capability/grant row was changed by the migration. Historical migration files were not edited.

Preserved technical contracts: `/panelist/...`, backend panelist/thesis namespaces, `Panelist` model and `panelists` table, all existing profile relations/IDs, `PanelRole.PANELIST` and every other PanelRole value/order, historical defense text and immutable records, `CUSTOM`, `CustomRole`, and `RoleFeatureAccess`. Direct-access enforcement remains code-owned and dormant; no real Faculty grants or Restricted Administrators were provisioned.

## Verification

Broader verification was justified by the shared identity/auth/schema boundary and its Adviser/Defense/document/realtime consumers. Automated HTTP/socket/store tests use synthetic fixtures; they are not browser QA or real-database migration evidence.

| Command / evidence | Result |
| --- | --- |
| Backend `npm run prisma:generate` | PASS, Prisma Client generated |
| Backend `npx prisma validate` | PASS |
| `npx prisma migrate diff --from-schema <archived-start>/backend/prisma/schema.prisma --to-schema prisma/schema.prisma --script` | PASS; exactly the enum ALTER above; no DB connection required |
| Backend `npm run build` | PASS after final production-source edits |
| Focused backend command below | **28 files / 609 tests PASS** |
| Frontend `node --test scripts/verify-faculty-2-session.mjs scripts/verify-faculty-3-compatibility.mjs` | **25 tests PASS** |
| Frontend `npx tsc --noEmit` | PASS |
| Frontend `npm run build` | PASS; 68 static pages generated, existing dynamic/technical routes retained |
| Frontend scoped ESLint command below | PASS |
| `git diff --check` and exact schema/historical-migration diff inspection | PASS |
| Manual/browser QA | NOT EXECUTED |
| Hosted CI / independent remote review | NOT EXECUTED / pending; no hosted or independent PASS claimed |

Focused backend command (run in `backend`):

```text
npm test -- tests/unit/services/faculty-3-compatibility.test.ts tests/unit/services/faculty-3-memo.test.ts tests/unit/realtime/faculty-3-realtime.test.ts tests/unit/migrations/faculty-3-enum-expansion.test.ts tests/unit/controllers/adviser-certification-document.controller.test.ts tests/unit/controllers/adviser-request-record.controller.test.ts tests/unit/services/adviser-request.service.test.ts tests/unit/services/adviser-request.rules.test.ts tests/unit/services/adviser-request-record.service.test.ts tests/unit/services/adviser-certification-document.service.test.ts tests/unit/services/adv5-document-service-auth.test.ts tests/unit/services/auth.login.test.ts tests/unit/middlewares/auth.middleware.test.ts tests/unit/access tests/unit/realtime
```

Scoped ESLint command (run in `frontend`):

```text
npx eslint src/middleware.ts src/lib/account-role.ts src/lib/current-session.ts src/components/layout/notification-bell.tsx scripts/verify-faculty-2-session.mjs scripts/verify-faculty-3-compatibility.mjs
```

Both identity matrices cover fresh account/session synchronization, exact profile ownership, addressed request inbox/response, sole AdviserAssignment detail, Proposal/Final queue scope, GS-017/GS-020 ownership and list filtering, exact defense workspace seat, academic file access, socket handshake/room/delivery/preview, and memo targeting. Denials cover current ADMIN/CUSTOM with academic claims, stale ADMIN/CUSTOM claims attempting Admin routes after current academic identity, nonacademic identities, missing/wrong assignments, inactive account/profile, missing profile, password gating, removed seats, wrong preview role and inactive delivery recipients. Existing 401/403 and valid-403 session retention checks pass.

### Broad-suite limitation, verified against starting commit

`npm test -- tests/unit --reporter=json --outputFile=<temporary-results.json>` was run both on the working source and a `git archive` of starting HEAD, using the same installed dependencies. No branch or history operation was used for the comparison.

- Starting commit: **3,765 passed, 372 failed, 5 skipped**; one additional suite failed to load (`applicant-results.contract.test.ts`, missing `./api-error` contract dependency).
- Working source broad run: **3,872 passed, 351 failed, 5 skipped** across **255 passing / 15 failing files**; the same suite-loading failure remains. This broad run preceded the final two manuscript-queue assertions, which passed in the final focused run above.
- Comparing failed assertion file/name pairs found **zero new failing assertions**; **21 baseline failures were fixed** by the bounded GS-017/GS-020 fixture updates.
- Passing related broad results: realtime 224; access 95; auth middleware 31; 52 Adviser/Defense/document/auth/panelist/Faculty service files 1,139; repositories 309; official-document renderers 118. These overlap the focused command and must not be added as distinct tests.
- Remaining failures are in existing manuscript-upload/scheduled-submission controller fixtures; exam amendment/configuration/draft/essay/execution/finalization/media/question-set/result/schedule/booking route fixtures; and the Applicant results frontend contract loader. Older route fixtures omit current-account DB mocks required by accepted FACULTY-2, or assume obsolete token-only behavior. These unrelated files were not reworked in FACULTY-3.

The broad suite is **not green**. No acceptance or full regression PASS is claimed. Some legacy unit tests opened the normal application DB for synthetic account reads; no scratch schema, reset, migration deployment, or seed/rehearsal was run there. An initial baseline attempt with an intentionally unreachable DB endpoint was cancelled, then the comparison was completed using the same development configuration; its temporary `.env` copy was removed.

### Isolated real-DB rehearsal — safely skipped

The configured application server is `localhost:3306`. Neither `FACULTY_1_DB_SERVER_URL` nor `FACULTY_3_DB_SERVER_URL` is configured, and no authenticated, genuinely isolated server was established. **No real enum/full-chain/destructive rehearsal was run.** No `graduate_system` scratch use, `faculty*_test_*` schema, normal-XAMPP reset/drop/reseed, or MariaDB/InnoDB filesystem manipulation occurred. Source validation is not a substitute for real isolated upgrade/preservation evidence. Rehearsal remains a deployment/readiness limitation for independent review.

## Audit boundaries and exact changed files

The FACULTY-0 area map and account-level PANELIST references were inspected across backend source, Prisma/seeds/fixtures, frontend source/session/routing, and tests/scripts. Additional audited surfaces intentionally unchanged: `backend/src/middlewares/auth.middleware.ts`, `backend/src/utils/jwt.ts`, `backend/src/services/{adviser-workspace,adviser-request,proposal-adviser-review,final-adviser-review,defense-workspace,defense-collaboration,official-defense-record,official-defense-document,notification,panelist,thesis}.service.ts`, `backend/src/repositories/{adviser-workspace,panelist,admin-panelist,memo,notification}.repository.ts`, `backend/src/realtime/defense-report-preview.store.ts` (inherits the updated shared filter), defense committee/evaluation/signature policies and interfaces, `backend/prisma/{seed,verify-journey-fixtures}.ts`, `frontend/src/{auth,middleware}.ts`, `frontend/src/types/{index,next-auth.d}.ts`, login/change-password and panelist layout, frontend defense-role helpers and notification links, and existing account/route/document/realtime suites. Defense-role comparisons remain contextual; legacy creation writers and unrelated UI copy remain deliberately unchanged.

Exact changed-file manifest follows. Ending commit/remote parity are reported in the delivery message to avoid a self-referential commit SHA.

- `backend/prisma/journey-fixtures.ts`
- `backend/prisma/migrations/20261108010000_faculty_identity_compatibility/migration.sql`
- `backend/prisma/schema.prisma`
- `backend/src/access/account-access.ts`
- `backend/src/realtime/defense-realtime.auth.ts`
- `backend/src/realtime/defense-realtime.store.ts`
- `backend/src/repositories/thesis.repository.ts`
- `backend/src/routes/panelist.routes.ts`
- `backend/src/routes/thesis.routes.ts`
- `backend/src/services/adviser-certification-record.service.ts`
- `backend/src/services/adviser-request-record.service.ts`
- `backend/src/services/adviser-request.rules.ts`
- `backend/src/services/auth.service.ts`
- `backend/src/services/current-account.ts`
- `backend/src/services/defense-conclusion.service.ts`
- `backend/src/services/document.service.ts`
- `backend/src/services/memo.service.ts`
- `backend/src/utils/academic-account.ts`
- `backend/tests/unit/access/account-access.test.ts`
- `backend/tests/unit/controllers/adviser-certification-document.controller.test.ts`
- `backend/tests/unit/controllers/adviser-request-record.controller.test.ts`
- `backend/tests/unit/middlewares/auth.middleware.test.ts`
- `backend/tests/unit/migrations/faculty-3-enum-expansion.test.ts`
- `backend/tests/unit/realtime/faculty-3-realtime.test.ts`
- `backend/tests/unit/services/adv5-document-service-auth.test.ts`
- `backend/tests/unit/services/adviser-certification-document.service.test.ts`
- `backend/tests/unit/services/adviser-request-record.service.test.ts`
- `backend/tests/unit/services/adviser-request.rules.test.ts`
- `backend/tests/unit/services/adviser-request.service.test.ts`
- `backend/tests/unit/services/auth.login.test.ts`
- `backend/tests/unit/services/faculty-3-compatibility.test.ts`
- `backend/tests/unit/services/faculty-3-memo.test.ts`
- `docs/superpowers/GSIS_IMPLEMENTATION_CHECKLIST.md`
- `docs/superpowers/plans/2026-11-08-faculty-admin-access-implementation.md`
- `docs/superpowers/reports/2026-11-08-faculty-3-identity-compatibility.md`
- `frontend/scripts/verify-faculty-2-session.mjs`
- `frontend/scripts/verify-faculty-3-compatibility.mjs`
- `frontend/src/components/layout/notification-bell.tsx`
- `frontend/src/lib/account-role.ts`
- `frontend/src/lib/current-session.ts`
- `frontend/src/middleware.ts`

## Delivery boundary

Commit/push is limited to FACULTY-3 on `feat/faculty-admin-access`. Independent review, isolated DB rehearsal, browser acceptance, deployment and any actual role conversion remain separate. The checklist/plan record implementation only. **FACULTY-4 was not started. Stop after delivery.**
