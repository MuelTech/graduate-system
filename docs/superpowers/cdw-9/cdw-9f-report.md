# CDW-9F — Migration / Read Compatibility and Final Production-Readiness Gate

- **System:** EARIST Graduate School Information System (GS-IS)
- **Repository:** MuelTech/graduate-system
- **Branch:** `refactor/collaborative-defense-workspace`
- **Starting HEAD:** `494514bc88c422f0629d74e6989eb50b23f10e7a`
- **Test/evidence commit:** `38379267aa679bd5a8763129be5bff41f1fe7fe2`
- **Implementation ending HEAD:** `41b2239e2cc9157c35c60787c0bdd816731f6e2e`
- **Status:** ACCEPTED / CLOSED
- **Date:** 2026-10-20
- **Product-code change:** **NONE**
- **Schema change:** **NONE**
- **Migration added:** **NONE**
- **Manual/browser QA:** **NOT EXECUTED**
- **Hosted CI:** **NOT OBSERVED / NOT CLAIMED**
- **CDW-9A through CDW-9E:** ACCEPTED / CLOSED
- **CDW-9:** COMPLETE / CLOSED

---

## 1. Purpose and bounded scope

CDW-9F is the final convergence gate for the Collaborative Defense Workspace. It
proves that the accepted implementation can be carried into production without
rewriting historical data or weakening accepted academic authority.

Executed scope:

- complete Prisma migration-chain audit and executable replay;
- forward compatibility from a pre-CDW schema with legacy fixtures;
- rollback/recovery expectation audit;
- legacy scoring-version read compatibility;
- concluded-attempt and defense-history read compatibility;
- historical Committee Report / signature readability;
- production/runtime configuration audit;
- final risk-based cross-package regression.

No feature, workflow state, role, authority, or design change was introduced.

## 2. What changed

### Product code

**None.** The audit found no concrete production-readiness, migration,
compatibility, or regression defect that justified a product-code change.

### Tests

| File | Change | Reason |
|---|---|---|
| `backend/tests/unit/migrations/cdw9f-migration-readiness.test.ts` | **NEW** (7 source-contract tests) | Durable guard for migration ordering/integrity, required migrations, additive CDW changes, historical outcome preservation, scoring-version defaults, collaborative schema fields, and no `prisma db push` script |
| `frontend/scripts/verify-cdw-live-1c-acceptance.mjs` | Reconciled one obsolete assertion | It required `CDW-9B is NEXT / AUTHORIZED`, superseded by accepted CDW-9B through CDW-9E. Replaced with the stable claim that CDW-9A through CDW-9E are recorded as accepted; no feature assertion was weakened |
| `frontend/scripts/verify-cdw-live-1-manual-qa-fix-2.mjs` | Reconciled one obsolete assertion | It required the pre-CDW-9E canvas label `aria-label="Draw your signature"`. CDW-9E acceptance renamed the canvas to `aria-label="Signature drawing area"` while retaining the visible **Draw your signature** instruction. The assertion now matches the accepted accessible name and instruction; keyboard/focus coverage remains in `verify-cdw9e-accessibility.mjs` |

Both verifier changes are test-contract reconciliations. No source contract was
removed merely to obtain a pass; the superseding accepted documents were
inspected first (CDW-9E report §3 and plan sections 13.1/13.11).

### Schema / migration

**None.** The final committed migration remains:

`20261018090000_oral_evaluation_scoring_version`

CDW-9A through CDW-9E and the post-acceptance FIX-1 through FIX-8 added no
migration. CDW-9F adds none.

### Documentation

| File | Change |
|---|---|
| `docs/superpowers/cdw-9/cdw-9f-report.md` | This report |
| `docs/superpowers/plans/2026-10-15-collaborative-defense-workspace-implementation.md` | Current-status lines and the stale §13.11 CDW-9E status corrected; CDW-9F recorded as IMPLEMENTED / PENDING INDEPENDENT REVIEW; implementation evidence added to §13.10 |
| `docs/superpowers/COLLABORATIVE_DEFENSE_WORKSPACE_AND_RAP_SOURCE_OF_TRUTH.md` | Current-status occurrences synchronized to IMPLEMENTED / PENDING INDEPENDENT REVIEW; CDW-9 not complete |
| `docs/superpowers/DEFENSE_WORKFLOW_SOURCE_OF_TRUTH.md` | Current-status occurrence synchronized |

The stale statement that CDW-9E was still pending independent review was
corrected. Historical package reports (CDW-9A through CDW-9E) were not rewritten.

## 3. Migration readiness

### Chain audit

- **37** committed migration directories, 14-digit timestamp prefixes, unique and
  lexicographically ordered.
- First: `20260714133043_init`.
- Last: `20261018090000_oral_evaluation_scoring_version`.
- Required migrations present:
  - `20261016090000_cdw1_collaborative_defense_foundation`
  - `20261017090000_defense_schedule_manuscript_binding`
  - `20261018090000_oral_evaluation_scoring_version`
- CDW additive migrations contain no `DROP TABLE/COLUMN/INDEX`, `DELETE FROM`,
  `TRUNCATE`, `UPDATE \`…\`` or `INSERT INTO`.
- `20261015120000_add_redefense_required_outcome` retains `PASSED`,
  `REVISION_REQUIRED`, and `FAILED` while adding `REDEFENSE_REQUIRED`.
- The scoring-version migration adds a non-null column defaulting to
  `LEGACY_POINTS_V1` and performs no row rewrite.
- No package script uses `prisma db push`; the repository documents
  `npx prisma migrate deploy` as the staging/production path.

### Executable replay — empty disposable database

Environment: local **MariaDB 10.4.32**, dedicated disposable database
`cdw9f_verify_empty_20261020`. The database did not exist before the test and was
dropped afterward.

Result:

```text
37 migrations found
all 37 applied successfully
prisma migrate status -> Database schema is up to date!
prisma migrate diff --from-config-datasource --to-schema=prisma/schema.prisma --exit-code
-> No difference detected (exit 0)
```

### Executable replay — pre-CDW schema + legacy fixtures

A second disposable database (`cdw9f_verify_legacy_20261020`) was created and
advanced only through the **34 pre-CDW migrations** (through
`20261015120000_add_redefense_required_outcome`). Synthetic fixtures were then
inserted using only pre-CDW columns:

- 4 synthetic users (`@example.invalid`);
- program, student, thesis, and two manuscript versions;
- 2 concluded schedules (one legacy `PASSED`, one legacy `REVISION_REQUIRED`);
- 1 legacy 10/15-point finalized evaluation with synthetic signature evidence;
- 1 legacy `FINALIZED` RAP with legacy text;
- 2 legacy RAP signature slots (one signed, one unsigned);
- 2 legacy conclusions.

`npx prisma migrate deploy` then applied the three CDW migrations. Post-upgrade
checks: **29 passed / 0 failed**, including:

- `scoring_version = LEGACY_POINTS_V1` for the existing row;
- criterion values, group averages, overall average, rating, recommendation,
  status, and signature evidence unchanged;
- legacy RAP text unchanged, with `body_document`, `frozen_*`, and content
  versions remaining null/zero (no structured body or freeze fabricated);
- legacy signature evidence unchanged and `signed_content_hash/version` null;
- both legacy attempts remain `manuscript_document_id = NULL` even though a newer
  manuscript exists — **no latest-document backfill**;
- legacy rapporteur notes unchanged;
- legacy `PASSED` and `REVISION_REQUIRED` conclusions readable;
- outcome enum retains all legacy values plus `REDEFENSE_REQUIRED`;
- final schema diff empty (exit 0).

### Rollback / recovery findings

- Prisma Migrate does not generate automatic down migrations for this project.
  No down-migration support is claimed.
- MySQL/MariaDB DDL is not treated as a single transactional rollback unit across
  a migration file. A failed migration is recorded by Prisma and blocks further
  deploys until resolved.
- Supported recovery strategy:
  1. take a consistent database backup immediately before `migrate deploy`;
  2. if a migration fails, stop the deployment and restore the database backup,
     or apply an additive forward-fix migration after diagnosing the failure;
  3. do not edit or delete already-applied migration history;
  4. do not use `prisma db push` as a repair mechanism.
- The three CDW migrations are additive: nullable columns, new tables, new
  indexes/foreign keys, and a defaulted enum column. An older application
  revision can generally read the migrated schema because it selects only the
  columns it knows, but older code cannot understand collaborative records and
  must not be treated as a supported production rollback target for new data.
- Reverse migration (new schema → old schema) is not supported and was not
  attempted.

### Blockers / limitations

- No automatic down migration exists: **documented, not a defect**.
- No production database or production backup/restore rehearsal was executed.
- The replay used a local disposable MariaDB instance, not the production
  topology.

## 4. Read compatibility

| Area | Result | Evidence |
|---|---|---|
| Legacy scoring V1 | **PASS** | Migration default + executable legacy DB check + `oral-evaluation.service.test.ts`, `cp7-official-defense-records.test.ts`; legacy rows stay `LEGACY_POINTS_V1` and are read-only in the workspace |
| Institutional matrix V2 | **PASS** | New evaluations are created as `INSTITUTIONAL_MATRIX_V2`; mixed-version Summary construction is rejected; FIX-4 arithmetic/rounding tests remain green |
| Concluded attempts | **PASS** | Concluded/cancelled write paths reject; workspace capabilities close; history is read-only; executable DB check preserved concluded rows |
| Historical RAP / report | **PASS** | `DefenseHistoryService` distinguishes `STRUCTURED_RAP`, `LEGACY_RAP_TEXT`, and `LEGACY_RAPPORTEUR_NOTES`; frozen version/hash binding and `FINALIZED` precedence covered by history/RAP suites |
| Historical signatures | **PASS** | Progress metadata only in history; raw signature evidence absent from history/faculty/realtime reads; Admin official-criteria rendering remains an explicit authorized official-record surface |
| Legacy rapporteur notes | **PASS** | Notes remain readable as `LEGACY_RAPPORTEUR_NOTES`; no RAP row, structured body, or signature progress is fabricated for them |

### Concluded / history findings

- History authority comes from the caller's assignment on the **current**
  schedule; the historical attempt must belong to the same thesis and be a
  genuinely prior concluded attempt.
- The historical manuscript is the exact `manuscriptDocumentId` binding. A newer
  or current document is never substituted.
- Concluded attempts are never re-bound from current state.
- The pre-CDW upgrade left legacy attempts unbound rather than inventing a
  binding.
- `REDEFENSE_REQUIRED` creates a new attempt; prior attempt evidence remains
  read-only.
- Prior evaluator criteria/scores and raw signature evidence are not exposed by
  the history DTO.

### Historical Committee Report / signature findings

- A finalized structured RAP remains readable from its persisted attempt-bound
  body; legacy finalized RAP text remains readable; legacy notes remain readable.
- A DRAFT or non-finalized RAP is never surfaced as official history.
- Signature binding fields remain recorded against the frozen content hash and
  version; legacy signatures keep null binding fields and are not rewritten.
- Ordinary faculty/history/realtime reads do not expose raw signature blobs.
- Historical reports are read from persisted historical data and do not require
  regeneration from today's mutable state.

## 5. Production / runtime readiness

| Area | Result | Evidence |
|---|---|---|
| CORS / origins | **PASS — deployment prerequisite** | REST uses an explicit comma-separated `FRONTEND_URL` allowlist with `credentials: true`; no wildcard. If unset, the safe fallback is localhost only, so real production origins are denied rather than opened. Production must set `FRONTEND_URL` explicitly |
| Socket.IO / WebSocket | **PASS — proxy prerequisite** | Socket.IO attaches to the same HTTP server; CORS uses the same allowlist; handshake authentication and server-derived room authorization remain enforced; polling remains the transport fallback. A production reverse proxy must forward WebSocket upgrades or allow Socket.IO polling |
| JWT / auth transport | **PASS** | Socket token is read only from `handshake.auth.token`; query-string tokens and client-supplied identity are ignored; REST and Socket.IO share the same verified JWT identity |
| Private documents | **PASS** | `/api/documents/:modelType/:id/file` requires JWT plus service-level exact-document authorization; `/uploads` returns 403; responses use `Cache-Control: private, no-store`; the frontend proxy whitelists model types and path shape and never exposes storage paths |
| Polling fallback | **PASS** | Workspace 20 s; annotations 15 s; read-only Committee Report 20 s; conclusion readiness 15 s; realtime remains invalidation-only |
| Runtime / deployment config | **PASS — operator prerequisites** | Backend Node engine `>=22.13.0`; `UPLOAD_DIR` fails closed in production when unset/public/build-contained; `DATABASE_URL` required; frontend production requires explicit `BACKEND_API_URL` and `NEXT_PUBLIC_BACKEND_API_URL`; no secrets or developer-specific LAN IPs are tracked |
| Migrations | **PASS** | `npx prisma migrate deploy` is the documented production path; take a DB + storage backup first; no `db push` reliance |
| Realtime event boundary | **PASS** | Exactly the nine accepted persisted events; `report:preview` remains ephemeral transport, not a persisted domain event |

No production configuration defect requiring a bounded code change was found.

## 6. Verification

### Automated / local tests

| Command | Result |
|---|---|
| `cd backend && npm test` | **PASS** — 162 files / 1895 passed / 5 skipped / 0 failed |
| `cd backend && npx vitest run <11 focused migration/history/scoring/audit files>` | **PASS** — 11 files / 235 passed / 0 failed |
| `cd backend && npm run build` | **PASS** (`tsc`) |
| `cd frontend && npx tsc --noEmit` | **PASS** |
| `cd frontend && npm run lint` | **PASS** — 0 errors / 15 warnings (pre-existing unused-symbol and `<img>` warnings) |
| `cd frontend && npx eslint <two reconciled verifier files>` | **PASS** — 0 errors |
| `cd frontend && npm run build` | **PASS** — Next.js 16.3.8 / Turbopack; 67 static pages generated; pre-existing middleware-deprecation warning only |
| All 24 `frontend/scripts/verify-cdw*.mjs` | **PASS** — 454 passed / 0 failed |
| `verify-dev-net-1.mjs` | **PASS** — 19 passed / 0 failed |
| `verify-rap-c1.mjs` | **PASS** — 13 passed / 0 failed |
| `verify-pdf-anchors.mjs` | **PASS** — 10 passed / 0 failed |
| `verify-viewer-core.mjs` | **PASS** — 13 passed / 0 failed |
| `git diff --check` | **PASS** — line-ending notices only |

The full suites were run because CDW-9F is an explicit final
production-readiness gate, as allowed by the engineering verification policy.

### Static / source review

- Migration forward-additive audit and schema-field audit (new CDW-9F test).
- CORS, Socket.IO bootstrap/auth, JWT transport, private-document serving,
  polling intervals, origin resolution, storage configuration, and audit
  boundaries inspected in source.
- No hard-coded developer LAN IP found in tracked source (only documentation and
  test placeholders such as `192.168.1.123`).
- `prisma db push` appears only in the README warning and the plan prohibition.

### Migration execution

| Check | Result |
|---|---|
| `cd backend && npx prisma validate` | **PASS** — schema valid |
| `cd backend && npx prisma generate` | **PASS** — Prisma Client 7.10.0 |
| `cd backend && npx prisma migrate status` (development DB) | **PASS** — 37 migrations, up to date |
| Disposable empty DB → `npx prisma migrate deploy` | **PASS** — 37/37 applied |
| Post-deploy `prisma migrate status` | **PASS** — up to date |
| Post-deploy `prisma migrate diff … --exit-code` | **PASS** — no difference, exit 0 |
| Pre-CDW DB (34 migrations) + synthetic fixtures → `npx prisma migrate deploy` | **PASS** — 3/3 CDW migrations applied |
| Post-upgrade schema diff | **PASS** — no difference, exit 0 |
| Legacy read-compatibility assertions | **PASS** — 29/29 |
| Disposable databases | Created only for CDW-9F and dropped after verification |

### Manual / browser QA

**NOT EXECUTED.** No live multi-user defense, mobile/desktop browser pass,
keyboard/screen-reader pass, reverse-proxy WebSocket test, or backup/restore
rehearsal was performed in this package.

### Hosted CI

**NOT OBSERVED / NOT CLAIMED.** All results above are agent-local commands.

## 7. Known limitations and residual risks

1. **No manual/browser multi-user QA in this gate.** The final practical
   production acceptance remains owner-owned. This report does not convert any
   earlier waived replay into a PASS.
2. **No hosted CI evidence.** Local results are not GitHub Actions evidence.
3. **No production-topology migration.** The replay used a disposable local
   MariaDB 10.4.32 instance, not staging/production. A production backup and
   restore rehearsal remains an operator prerequisite.
4. **No automatic down migration.** Recovery depends on backup/restore or an
   additive forward fix.
5. **Reverse-proxy WebSocket upgrade not executed.** Operational configuration
   must forward upgrades or permit Socket.IO polling; the application fallback
   remains available.
6. **Production origin configuration is operator-owned.** `FRONTEND_URL`,
   `BACKEND_API_URL`, and `NEXT_PUBLIC_BACKEND_API_URL` must be set explicitly;
   an unset backend allowlist denies real origins rather than permitting a
   wildcard.
7. **Draw-only signature accessibility remains a documented limitation.** No
   WCAG compliance or screen-reader certification is claimed.
8. **Legacy storage debt remains.** `RapReport.filePath` and other legacy path
   fields remain readable and were not migrated in this package.

## 8. Scope confirmation

- No new feature, workflow state, role, or authority was introduced.
- No historical record was rewritten.
- No fabricated backfill was performed.
- No evaluator, Rapporteur, Chairman, Adviser, Facilitator, or Dean authority was
  expanded.
- No official EARIST PDF/form rendering, print/download, or Dean-signing work was
  started.
- No schema change and no migration were added.
- Exactly the nine persisted realtime events remain; `report:preview` remains
  ephemeral.
- `main` was not merged, rebased, reset, or force-pushed.
- The implementation/evidence commits did not self-accept CDW-9F. Independent
  remote review subsequently accepted the package and closed CDW-9.

## 9. Recommendation

**READY FOR INDEPENDENT CDW-9F REVIEW.**


## 10. Independent acceptance

**Independent remote source/diff review: PASS.**

The independent review verified the exact remote branch at implementation ending
HEAD `41b2239e2cc9157c35c60787c0bdd816731f6e2e` and confirmed the expected linear
package history:

`494514bc88c422f0629d74e6989eb50b23f10e7a`
→ `38379267aa679bd5a8763129be5bff41f1fe7fe2`
→ `41b2239e2cc9157c35c60787c0bdd816731f6e2e`.

Independent scope review confirmed:

- the evidence commit changes only the new CDW-9F migration-readiness test and
  two superseded verifier assertions;
- the documentation commit changes only the CDW-9F report, implementation plan,
  and the two canonical Source-of-Truth status lines;
- no product code, Prisma schema, or migration was changed by CDW-9F;
- the verifier reconciliations match already-accepted contracts rather than
  weakening current behavior;
- the repository contains 37 ordered migration directories from
  `20260714133043_init` through
  `20261018090000_oral_evaluation_scoring_version`;
- the CDW migrations were spot-checked as forward/additive, preserving legacy
  outcomes and defaulting pre-existing scoring rows to `LEGACY_POINTS_V1`;
- current source preserves explicit CORS origin parsing, shared REST/Socket.IO
  JWT verification, server-derived defense-room authorization, private document
  authorization, safe frontend document proxying, exact historical manuscript
  binding, legacy report provenance, and the canonical nine persisted realtime
  events.

The agent-local executable evidence is accepted as reported: full backend tests,
focused compatibility suites, frontend type/lint/build checks, all CDW verifier
scripts, and both disposable-database migration replays passed. Those commands
were not re-executed by the connector-only independent review and are not
represented as independently executed tests.

Manual/browser multi-user QA, hosted CI, production-topology migration,
backup/restore rehearsal, and reverse-proxy WebSocket testing remain truthfully
**NOT EXECUTED / NOT OBSERVED** for CDW-9F. They remain deployment/operator
considerations rather than hidden PASS claims. CDW-9F introduced no product-code
change, and the project owner's prior practical mobile/desktop UX acceptance for
CDW-9E remains the latest browser interaction evidence.

**CDW-9F is ACCEPTED / CLOSED. CDW-9 is COMPLETE / CLOSED.**

Per the accepted STOP boundary, no later initiative is authorized or started by
this acceptance.
