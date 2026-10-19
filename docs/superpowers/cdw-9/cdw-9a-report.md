# CDW-9A — Evaluation and Oral Examination Summary Convergence Hardening

- **System:** EARIST Graduate School Information System (GS-IS)
- **Repository:** MuelTech/graduate-system
- **Branch:** `refactor/collaborative-defense-workspace`
- **Starting HEAD:** `74584c31737243ba071f059b4c844153de32a142`
- **Implementation commit:** `676d2c02d33aee1ae04bd3e94a9a51a58a91aee4`
- **Status:** IMPLEMENTED / PENDING INDEPENDENT REVIEW
- **Date:** 2026-10-19
- **Schema change:** NONE
- **Migration:** NONE
- **Manual browser/multi-user QA:** NOT EXECUTED
- **CDW-9B:** NOT STARTED
- **Next package:** CDW-9B — Committee Report Finalization and Signature Concurrency Hardening, only after CDW-9A review/acceptance

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
   state in the frontend, unlike autosave conflicts.

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

### 3.3 Stale evaluator client

`frontend/src/components/defense-workspace/oral-evaluation-form.tsx`

- A finalization `409` now invalidates the evaluator's own evaluation query and
  the authoritative Defense Workspace query.
- Local form state is not silently cleared; the backend/faculty-readable error
  message remains visible.
- No internal version/hash/database identifiers are added to faculty UI.

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
- transaction-level `P2002` maps to the friendly `409`;
- concurrent evaluator finalizations remain independently owned and signed;
- finalization remains independent of Committee Report state.

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
- autosave drain still precedes the irreversible finalize request.

---

## 6. Verification

| Check | Result |
|---|---|
| Focused backend suite (9 directly affected files) | **259 passed / 0 failed** |
| `backend npm run build` (`tsc`) | **PASS** |
| CDW-9A frontend verifier | **3 passed / 0 failed** |
| Frontend `npx tsc --noEmit` | **PASS** |
| Scoped frontend ESLint on changed component | **PASS** |
| `git diff --check` | **clean** (line-ending notices only) |
| Schema/migration change | **NONE** |
| Hosted CI | **NOT OBSERVED / NOT CLAIMED** |
| Manual browser/multi-user QA | **NOT EXECUTED** |

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

## 7. Known limitations

- Concurrency evidence is deterministic service-level interleaving and unique
  race coverage; it is not a live MariaDB contention benchmark or browser
  multi-user replay.
- No actual simultaneous role-separated browser sessions were executed.
- Summary concurrency remains dependent on the existing database unique
  constraint; no schema change was needed.
- CDW-9A does not add audit logging, performance/index work, or accessibility
  hardening. Those remain CDW-9C/CDW-9D/CDW-9E.

---

## 8. Boundary confirmation

- CDW-9B was not started.
- CDW-9C through CDW-9F were not started.
- FIX-4 computation: **NO CHANGE**.
- Verdict authority: **NO CHANGE**.
- Committee Report sequencing: **NO CHANGE**.
- Realtime event count: **NO CHANGE**.
- Schema/migration: **NONE**.
