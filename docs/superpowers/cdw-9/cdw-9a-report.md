# CDW-9A — Evaluation and Oral Examination Summary Convergence Hardening

- **System:** EARIST Graduate School Information System (GS-IS)
- **Repository:** MuelTech/graduate-system
- **Branch:** `refactor/collaborative-defense-workspace`
- **Starting HEAD:** `74584c31737243ba071f059b4c844153de32a142`
- **Implementation commits:**
  - `676d2c02d33aee1ae04bd3e94a9a51a58a91aee4` — convergence hardening
  - `bc695f36016f487908af64715ed43a64b609d3ee` — stale evaluation draft version guard
  - `b167f8c4c40cdac9b67fc3db590f81e9f94462de` — CDW-9A FIX-1 explicit stale-draft recovery
  - `cc11d58df4a397faa10c9a76f1ffc917544847db` — CDW-9A FIX-2 authoritative finalized display
- **Final pre-acceptance documentation HEAD:** `83bd2d2fcfc27756e56e38182041eba2af666db3`
- **Status:** ACCEPTED / CLOSED
- **Date:** 2026-10-19
- **Schema change:** NONE
- **Migration:** NONE
- **Manual browser/multi-user QA:** NOT EXECUTED
- **CDW-9B:** NEXT / AUTHORIZED — NOT YET IMPLEMENTED
- **Next package:** CDW-9B — Committee Report Finalization and Signature Concurrency Hardening

---

## 1. Scope

CDW-9A hardens the existing evaluator-finalization and Oral Examination Summary
path against concurrent, duplicate, retried, and stale-client requests.

It does not redesign the workflow, change evaluator authority, change FIX-4
arithmetic, or alter the Chairman-only verdict gate.

---

## 2. Source audit findings

The existing implementation already contained the main concurrency foundations:

- unique `(scheduleId, panelId)` on evaluator records;
- DRAFT -> FINALIZED `updateMany` CAS with a DRAFT predicate;
- friendly `409` handling for direct-create `P2002` races;
- server-authoritative finalization timestamps;
- post-commit session recomputation;
- unique `OralExamSummary.scheduleId`;
- existing-summary idempotent return;
- Summary `P2002` winner re-read;
- confirmed FIX-4 institutional computation.

The bounded gaps closed by CDW-9A were:

1. a unique-constraint error escaping the finalization transaction boundary could
   leak as a raw Prisma error rather than the existing friendly `409`;
2. Summary `P2002` convergence returned the loser's computed evaluator count
   instead of the winning summary snapshot metadata;
3. evaluator finalization `409` did not refresh authoritative evaluation/workspace
   state in the frontend, unlike autosave conflicts;
4. draft saves and finalization had no content-version guard, so a stale tab could
   overwrite a newer DRAFT. Finalized rows were already protected by the DRAFT
   status CAS and `(scheduleId, panelId)` uniqueness.

No schema or migration change was required.

---

## 3. Production changes

### 3.1 Evaluator finalization

`backend/src/services/oral-evaluation.service.ts`

- Any `P2002` escaping the finalization transaction is now converted to the
  existing actionable conflict:
  `Evaluation state changed. Refresh and try again.` with HTTP `409`.
- Existing DRAFT CAS, direct-create unique handling, timestamps, privacy, and
  ownership behavior remain unchanged.

### 3.2 Oral Examination Summary convergence

`backend/src/services/official-defense-record.service.ts`

- On a `P2002` create collision, the losing request now returns the winning
  Summary snapshot's evaluator count when available, matching the existing-summary
  read path.
- The winner row remains the only authoritative Summary.
- Existing Summary rows are not updated or rewritten by a retry.

### 3.3 Evaluation row version guard

`backend/src/services/oral-evaluation.service.ts`,
`backend/src/controllers/thesis.controller.ts`

- Evaluation reads now expose the server row version as an ISO `updatedAt`.
- Draft saves and finalization accept an optional `expectedUpdatedAt`.
- When supplied, a mismatch returns `409 Evaluation state changed. Refresh and
  try again.` without writing.
- Existing-row CAS writes include the authoritative `updatedAt`, so a stale tab
  cannot overwrite a newer DRAFT between read and update.
- Legacy callers that omit the token retain the existing status/unique-constraint
  behavior.

### 3.4 Stale evaluator client — explicit recovery (CDW-9A FIX-1)

`frontend/src/components/defense-workspace/oral-evaluation-form.tsx`
`frontend/src/lib/evaluation/evaluation-autosave.ts`

- Autosave and finalization `409` responses now enter an explicit conflict state
  rather than only invalidating queries.
- The local unsaved criteria/recommendations remain visible and are not silently
  replaced.
- Automatic persistence is blocked while the conflict is unresolved
  (`markConflict()`), including debounce, flush, reconnect, and unmount-drain
  paths. No stale request is retried automatically.
- The evaluator sees:
  `This evaluation was updated in another tab or session. Your unsaved changes
  are still here. Reload the latest saved evaluation before continuing.`
- The explicit **Reload latest saved evaluation** action:
  - fetches the authoritative evaluator read;
  - replaces local criteria/recommendations;
  - adopts the authoritative row version;
  - resets the autosave baseline through
    `reconcileWithPersisted()`;
  - clears the conflict state and permits normal editing.
- If the authoritative record is already `FINALIZED`, edits stay locked and the
  finalized state is shown. Local stale data cannot overwrite it.
- Finalization still drains autosave through `flushAndWait()` before the
  irreversible request. A blocked conflict makes finalization unavailable.
- Autosave sends the current row version and updates it from the save response;
  finalization sends the drained version.
- No internal version/hash/database identifiers are displayed in faculty UI.

### 3.5 Authoritative finalized display (CDW-9A FIX-2)

`frontend/src/components/defense-workspace/oral-evaluation-form.tsx`

- When the authoritative evaluator record transitions from `DRAFT` to
  `FINALIZED`, the visible matrix and recommendations are now derived from the
  authoritative server record, not the stale local draft.
- This is a display derivation, not a state reset: normal DRAFT query refreshes
  retain local unsaved work.
- The finalized transition blocks the autosave controller via `markConflict()`,
  so no stale autosave, finalize retry, or unmount drain can be triggered by the
  transition.
- The finalization dialog is not rendered in the locked state.
- No explicit **Reload latest saved evaluation** action is required once the
  authoritative record is finalized.
- Local stale values are retained only in inactive component state and are never
  presented as the finalized record or persisted.

---

## 4. Preserved invariants

- Only the authenticated assigned evaluator may draft/finalize that evaluator's
  own record.
- Finalized evaluations remain immutable.
- Summary generation requires all required evaluator records to be FINALIZED for
  the exact attempt.
- Exactly one authoritative Summary exists per attempt.
- FIX-4 arithmetic is unchanged:
  - Group A = finalized Group I average;
  - Group B = finalized Group II average;
  - row Average = `(Group A + Group B) / 2`;
  - two-decimal half-up academic rounding;
  - internal aggregate remains the mean of finalized row averages.
- Rating and Remarks remain null/deferred.
- Summary generation does not write a verdict.
- The assigned Chairman remains the sole formal verdict authority.
- Committee Report finalization/signing remains parallel to evaluation/Summary
  work under FIX-6.
- No new realtime event or socket academic write path was added.

---

## 5. Tests added or strengthened

### Evaluator finalization

`backend/tests/unit/services/oral-evaluation.service.test.ts`

- duplicate finalization of a FINALIZED record returns `409` without rewriting;
- stale DRAFT finalization CAS conflict returns `409`;
- stale DRAFT save/finalize version mismatch returns `409` without update;
- finalization CAS includes the authoritative row version;
- transaction-level `P2002` maps to the friendly `409`;
- concurrent evaluator finalizations remain independently owned and signed;
- finalization remains independent of Committee Report state.

`backend/tests/unit/services/oral-evaluation-controller-patch.test.ts`

- `expectedUpdatedAt` is passed through to draft save and finalization.

### Oral Examination Summary

`backend/tests/unit/services/fix4-oral-summary.test.ts`

- two simultaneous `ensureOralExamSummary` calls converge to one authoritative
  Summary under `P2002`;
- a P2002 loser returns the winning Summary snapshot's evaluator count.

Existing FIX-4 tests continue to cover:

- exact institutional Group A / Group B / row Average arithmetic;
- two-decimal rounding, including `1.225 -> 1.23`;
- no Summary before all evaluators finalize;
- mixed scoring-version rejection;
- missing/invalid group average rejection;
- repeated ensure idempotency;
- no verdict write;
- evaluator-row composition and non-evaluator exclusion.

### Frontend contract

`frontend/scripts/verify-cdw9a-evaluation-convergence.mjs`

- finalization `409` refreshes own evaluation and workspace state;
- autosave `409` reconciliation remains;
- autosave and finalization carry the authoritative row version;
- autosave drain still precedes the irreversible finalize request.

`frontend/scripts/verify-cdw9a-fix1-stale-recovery.mjs`

- conflict blocks automatic retry and unmount-drain persistence;
- explicit reconciliation resets the saved baseline and allows a normal save;
- reconciliation refuses to replace a baseline while a save is in flight;
- conflict UI preserves local work and requires explicit reload;
- conflict enters recovery mode and disables further edits;
- explicit reload adopts the authoritative snapshot and row version;
- conflict recovery is not invoked automatically;
- FINALIZED authoritative state hides the conflict and locks edits;
- FINALIZED transition displays authoritative matrix/recommendation values;
- FINALIZED transition blocks stale autosave/dispose and hides finalization UI;
- normal DRAFT refresh does not use a per-version remount key;
- finalization still drains autosave first.

`frontend/scripts/verify-cdw-live-1b-evaluation.mjs`

- autosave payload now includes the authoritative row version alongside private
  criteria/recommendations and never signatures;
- finalized rows use the locked/mounted-finalized autosave guard.

`frontend/scripts/verify-cdw-live-1c-acceptance.mjs`

- finalized evaluation remains server-immutable and the frontend blocks autosave
  on the authoritative locked transition.

---

## 6. Verification

| Check | Result |
|---|---|
| Focused backend suite (9 directly affected files) | **263 passed / 0 failed** |
| `backend npm run build` (`tsc`) | **PASS** |
| CDW-9A frontend verifier | **4 passed / 0 failed** |
| Frontend `npx tsc --noEmit` | **PASS** |
| Scoped frontend ESLint on changed frontend files | **PASS** |
| `git diff --check` | **clean** (line-ending notices only) |
| Schema/migration change | **NONE** |
| Hosted CI | **NOT OBSERVED / NOT CLAIMED** |
| Manual browser/multi-user QA | **NOT EXECUTED** |

### CDW-9A FIX-1/FIX-2 verification (frontend-only)

| Check | Result |
|---|---|
| Stale-recovery verifier (behavioral controller + DRAFT/FINALIZED UI contract) | **12 passed / 0 failed** |
| Existing CDW-9A verifier | **4 passed / 0 failed** |
| CDW-LIVE-1B evaluation autosave verifier | **24 passed / 0 failed** |
| CDW-LIVE-1C acceptance verifier | **31 passed / 0 failed** |
| CDW-LIVE-1 FIX-3 verifier | **17 passed / 0 failed** |
| Frontend `npx tsc --noEmit` | **PASS** |
| Scoped ESLint on changed files | **PASS** |
| Frontend production build | **PASS** |
| `git diff --check` | **clean** (line-ending notices only) |
| Backend production/schema/migration change | **NONE** |

Focused backend files:

- `oral-evaluation.service.test.ts`
- `fix4-oral-summary.test.ts`
- `oral-evaluation.institutional.rules.test.ts`
- `oral-evaluation.rules.test.ts`
- `oral-evaluation-controller-patch.test.ts`
- `defense-conclusion.service.test.ts`
- `cp7-fix2-conclusion-privacy.test.ts`
- `cp7-official-defense-records.test.ts`
- `defense-collaboration.service.test.ts`

The previous pre-CDW-9 multi-user replay remains **WAIVED / NOT REQUIRED**. It is
not represented as Manual QA PASS, full replay PASS, or full E2E PASS.

---

## 7. Acceptance

**Final status: ACCEPTED / CLOSED.**

Independent remote source review: **PASS**. Review verified the actual remote
commits/diff/source for evaluator finalization CAS/version behavior, transaction
and direct-create `P2002` handling, Summary uniqueness and `P2002` convergence,
DRAFT stale-client recovery, authoritative FINALIZED display, and the preserved
academic/domain boundaries. No remaining blocking CDW-9A defect was found.

Accepted implementation chain:

- starting baseline: `74584c31737243ba071f059b4c844153de32a142`;
- `676d2c02d33aee1ae04bd3e94a9a51a58a91aee4` — convergence hardening;
- `bc695f36016f487908af64715ed43a64b609d3ee` — stale evaluation draft version guard;
- `b167f8c4c40cdac9b67fc3db590f81e9f94462de` — FIX-1 explicit stale-draft recovery;
- `cc11d58df4a397faa10c9a76f1ffc917544847db` — FIX-2 authoritative finalized display;
- final pre-acceptance documentation HEAD: `83bd2d2fcfc27756e56e38182041eba2af666db3`.

Accepted behavior includes both bounded corrections:

- FIX-1: DRAFT-vs-DRAFT conflicts preserve local work, block automatic
  persistence, and require explicit **Reload latest saved evaluation** before
  authoritative content/version replaces the local baseline.
- FIX-2: authoritative FINALIZED transitions immediately display server
  criteria/recommendations, lock editing, block stale autosave/unmount drain, and
  require no explicit reload.

Evidence provenance remains separate:

- agent-local focused tests/verifiers and build/static checks are recorded in
  Section 6;
- independent review is remote source/diff verification, not agent execution;
- targeted two-tab stale-evaluation Manual QA: **NOT EXECUTED**;
- the waived pre-CDW-9 multi-user replay remains **WAIVED / NOT REQUIRED**, not a
  manual/browser/full-E2E PASS;
- hosted CI: **NOT OBSERVED / NOT CLAIMED**.

CDW-9A FIX-1/FIX-2 introduced **no backend production, schema, or migration
change**. FIX-4 arithmetic, Rating/Remarks deferral, Summary verdict independence,
Chairman verdict authority, Committee Report parallelism, and the realtime event
count remain unchanged.

Acceptance reconciliation:
`docs/superpowers/cdw-9/cdw-9a-acceptance-reconciliation-2026-10-19.md`.

Next package: **CDW-9B — Committee Report Finalization and Signature Concurrency
Hardening**, status **NEXT / AUTHORIZED — NOT YET IMPLEMENTED**.

---

## 8. Known limitations

- Concurrency evidence is deterministic service-level interleaving and unique
  race coverage; it is not a live MariaDB contention benchmark or browser
  multi-user replay.
- No actual simultaneous role-separated browser sessions were executed.
- Targeted two-tab stale-draft Manual QA: **NOT EXECUTED**.
- Summary concurrency remains dependent on the existing database unique
  constraint; no schema change was needed.
- CDW-9A does not add audit logging, performance/index work, or accessibility
  hardening. Those remain CDW-9C/CDW-9D/CDW-9E.

---

## 9. Boundary confirmation

- CDW-9B is **NEXT / AUTHORIZED — NOT YET IMPLEMENTED**; no CDW-9B implementation
  was started.
- CDW-9C through CDW-9F remain **PLANNED / NOT YET IMPLEMENTED**.
- Backend production: **NO CHANGE** in CDW-9A FIX-1/FIX-2.
- FIX-4 computation: **NO CHANGE**.
- Verdict authority: **NO CHANGE**.
- Committee Report sequencing: **NO CHANGE**.
- Realtime event count: **NO CHANGE**.
- Schema/migration: **NONE**.
