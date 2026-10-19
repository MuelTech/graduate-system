# CDW-9B — Committee Report Finalization and Signature Concurrency Hardening

- **System:** EARIST Graduate School Information System (GS-IS)
- **Repository:** MuelTech/graduate-system
- **Branch:** `refactor/collaborative-defense-workspace`
- **Starting HEAD:** `527de80389d246086031092262dbba9b30347a26`
- **Implementation commit:** `8fb6f9996c24ff0e93a87d468a4a26a87ce39e6a`
- **Status:** IMPLEMENTED / PENDING INDEPENDENT REVIEW
- **Date:** 2026-10-19
- **Schema change:** NONE
- **Migration:** NONE
- **Manual browser concurrency QA:** NOT EXECUTED
- **CDW-9C:** PLANNED / NOT YET IMPLEMENTED — NOT STARTED
- **Next authorized implementation authority:** CDW-9B review/acceptance; CDW-9C is not authorized automatically

---

## 1. Scope

CDW-9B hardens existing Committee Report finalization and signing behavior under
duplicate, retried, stale-client, and near-simultaneous requests.

It does not redesign the workflow or change:

- Rapporteur authority;
- stage-aware signer policy;
- FIX-6 parallel Evaluation / Committee Report sequencing;
- FIX-4 arithmetic;
- Chairman verdict authority;
- realtime event count;
- schema or migrations.

---

## 2. Source audit findings

The current implementation already contained the main correctness protections:

- exact-attempt `withAttemptLock` serialization for freeze and signing;
- `bodyVersion` / `expectedBodyVersion` CAS for report authoring/finalization;
- DRAFT-only / unfrozen draft writes;
- existing-freeze idempotent return;
- immutable frozen snapshot/hash/content version;
- unique `(rapId, userId)` signer slots and `createMany(skipDuplicates)`;
- own-slot `updateMany` CAS for signing;
- signature binding to the frozen content hash/version;
- committed-state aggregate recompute;
- non-downgrading `FINALIZED` status;
- existing realtime invalidation events.

The concrete bounded gaps found were:

1. modern signing reported `finalizedNow: status === "FINALIZED"`, so a concurrent
   request that merely observed another request's final transition could claim it;
2. legacy signing used `previousStatus !== FINALIZED && status === FINALIZED`,
   which had the same concurrent-final-signer ambiguity;
3. aggregate recompute could return `PARTIALLY_SIGNED` when its conditional
   partial update lost to a concurrent finalizer, even though the persisted RAP
   was already `FINALIZED`;
4. an anomalous `FINALIZED` row with missing `finalizedAt` was repaired using an
   unconditional update, allowing concurrent recomputes to replace the timestamp;
5. Committee Report finalization/signing `409` responses did not invalidate
   authoritative queries or close stale confirmation/signature dialogs.

No schema or migration change was required.

---

## 3. Production changes

### 3.1 Truthful aggregate transition

`backend/src/services/rap-report.service.ts`

- Added `recomputeRapStatusWithTransition()` returning
  `{ status, transitionedToFinalized }`.
- The existing `recomputeRapStatus()` remains as a status-only wrapper.
- `transitionedToFinalized` is true only for the request whose conditional update
  actually moves the RAP to `FINALIZED`.
- A concurrent request that observes an already-final RAP returns
  `FINALIZED` with `transitionedToFinalized: false`.
- A partial-update loser re-reads the winner and returns `FINALIZED` when the
  persisted aggregate finalized concurrently.
- An anomalous `FINALIZED` row missing `finalizedAt` is repaired with
  `updateMany({ status: FINALIZED, finalizedAt: null })`, so the timestamp is set
  once.

Both `signReportForSignatures()` and legacy-compatible `signRapSlot()` now use
the transition metadata for `finalizedNow`. This prevents false
`rap.finalized` event publication by a request that did not win the transition.

### 3.2 Stale finalize/sign client behavior

`frontend/src/components/defense-workspace/rap-signature-panel.tsx`

- Finalization `409` closes the stale confirmation, keeps a concise faculty
  message, and invalidates:
  - `committeeReport`;
  - `defenseWorkspace`;
  - `conclusionReadiness`.
- Signing `409` closes the stale signature dialog, clears its error, and
  invalidates the same authoritative queries.
- The signature evidence is not automatically reused or resubmitted.
- No force-overwrite or automatic retry path was added.

### 3.3 Preserved report authoring behavior

No change was made to `ReportAutosaveController` or the Rapporteur finalization
drain:

- `flushAndWait()` still precedes the irreversible freeze request;
- finalization still sends the authoritative `expectedBodyVersion`;
- autosave conflict still blocks finalization;
- explicit **Reload saved version** remains the recovery path;
- no manual force overwrite exists.

---

## 4. Preserved invariants

- Assigned Rapporteur remains the single authoritative writer.
- Finalization is not signing; the Rapporteur slot is not auto-signed.
- Required signers may sign while their own evaluation is still `DRAFT`.
- Report finalization remains independent of evaluations and Summary.
- Each signer can mutate only their own required slot.
- Signed slots cannot be rewritten.
- All signatures bind the exact frozen content hash/version.
- One authoritative frozen report artifact exists per attempt.
- `FINALIZED` cannot downgrade.
- `finalizedAt` is stable/set once.
- Chairman verdict remains blocked until all convergence gates pass.
- Realtime event taxonomy is unchanged.

---

## 5. Tests added or strengthened

### Freeze/finalization

`backend/tests/unit/services/defense-collaboration.service.test.ts`

- concurrent freeze update loser returns the winning frozen artifact;
- existing bodyVersion pinning and stale finalization rejection remain covered;
- duplicate/idempotent freeze and signer-slot creation remain covered.

### Aggregate RAP status

`backend/tests/unit/services/cp7-fix1-authority.test.ts`

- partial recompute losing to a concurrent finalizer returns `FINALIZED`;
- finalization transition is reported exactly once;
- anomalous `FINALIZED` with missing `finalizedAt` is repaired conditionally;
- non-downgrade behavior remains covered.

### Signing

`backend/tests/unit/services/rap-c1-freeze-signature.test.ts`

- modern signing does not claim `finalizedNow` when another concurrent signer won;
- duplicate signing rejects without rewriting signature evidence;
- own-slot, hash/version binding, and final-signature convergence remain covered.

`backend/tests/unit/services/cdw7-immutability.test.ts`

- legacy-compatible signing reports `finalizedNow` only for the winning request.

`backend/tests/unit/services/cdw7-acceptance-regression.test.ts`

- existing frozen-signature compatibility tests use the transition-aware recompute.

### Frontend

`frontend/scripts/verify-cdw9b-report-signature-hardening.mjs`

- conflict policy invalidates all authoritative reads;
- finalization `409` closes stale confirmation and refreshes;
- signing `409` closes stale dialog and refreshes;
- signature dialog never auto-submits or reuses evidence;
- Rapporteur finalization still drains autosave and sends its body version.

---

## 6. Verification

| Check | Result |
|---|---|
| Focused backend service suite (8 files) | **238 passed / 0 failed** |
| Focused controller/support suite (4 files) | **57 passed / 0 failed** |
| Backend `npm run build` (`tsc`) | **PASS** |
| CDW-9B frontend verifier | **5 passed / 0 failed** |
| RAP-C1 verifier | **13 passed / 0 failed** |
| FIX-6 verifier | **15 passed / 0 failed** |
| FIX-5 verifier | **17 passed / 0 failed** |
| CDW-9A verifier | **4 passed / 0 failed** |
| CDW-LIVE-1B evaluation verifier | **24 passed / 0 failed** |
| CDW-LIVE-1C acceptance verifier | **31 passed / 0 failed** |
| Frontend `npx tsc --noEmit` | **PASS** |
| Scoped frontend ESLint | **PASS** |
| Frontend production build | **PASS** |
| `git diff --check` | **clean** (line-ending notices only) |
| Schema/migration change | **NONE** |
| Hosted CI | **NOT OBSERVED / NOT CLAIMED** |
| Targeted Committee Report concurrency Manual QA | **NOT EXECUTED** |

The previously waived full pre-CDW-9 multi-user replay remains
**WAIVED / NOT REQUIRED** and is not represented as a PASS.

---

## 7. Known limitations

- Concurrency evidence is deterministic service-level interleaving and CAS/P2002
  coverage, not a live MariaDB contention benchmark.
- No two-browser concurrent finalize/signature QA was executed.
- No hosted CI evidence is claimed.
- A transient database failure after a signature commit can still leave aggregate
  recompute to a later request; no new retry queue or background reconciler was
  introduced in CDW-9B.

---

## 8. Boundary confirmation

- Backend changed: **YES** (aggregate recompute metadata and timestamp
  conditional repair).
- Frontend changed: **YES** (stale finalize/sign 409 recovery).
- Schema/migration: **NONE**.
- Signer policy: **NO CHANGE**.
- FIX-6 parallel sequencing: **NO CHANGE**.
- FIX-4 arithmetic: **NO CHANGE**.
- Verdict authority: **NO CHANGE**.
- Realtime persisted-event count: **NO CHANGE**.
- CDW-9C: **NOT STARTED**.
