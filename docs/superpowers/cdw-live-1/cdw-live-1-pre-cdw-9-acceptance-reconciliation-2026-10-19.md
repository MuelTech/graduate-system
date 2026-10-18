# CDW-LIVE-1 Pre-CDW-9 Acceptance Reconciliation — 2026-10-19

**Repository:** MuelTech/graduate-system  
**Branch:** `refactor/collaborative-defense-workspace`  
**Accepted product-code baseline before this docs-only reconciliation:** `3e5ed6847db737e6395d531c04ee5f3b9b5c9812`  
**Status:** PRE-CDW-9 GATE CLOSED — FIX-6 FINAL ACCEPTED / CLOSED; ADDITIONAL FULL MULTI-USER REPLAY WAIVED / NOT REQUIRED  
**Next package:** CDW-9 — Hardening and production readiness  
**Schema/migration change in this reconciliation:** NONE  
**Production-code change in this reconciliation:** NONE

---

## 1. Purpose

This document records the current pre-CDW-9 project state after FIX-6 implementation, independent source review, autosave-finalization correction, and the later UI simplifications.

It supersedes only the **current gate/status conclusions** in the 2026-10-18 acceptance reconciliation. The older document remains historical evidence of the state and expectations that existed before FIX-6.

---

## 2. Accepted FIX-6 result

FIX-6 is **FINAL ACCEPTED / CLOSED**.

The accepted behavior is:

```text
DEFENSE IN_PROGRESS
  ├─ Evaluation work
  │    Chairman / evaluator Panelists draft and finalize independently
  │
  └─ Committee Report work
       Rapporteur drafts
       -> Finalize Committee Report
       -> required signers may sign immediately

Both workstreams
       ↓
strict Chairman Formal Verdict convergence gate
```

Committee Report finalization does not wait for all evaluator records or the Oral Examination Summary.

A required Chairman/Panelist may sign the finalized Committee Report while that person's own evaluation is still DRAFT.

The Chairman may record PASSED or REDEFENSE_REQUIRED only after all authoritative convergence requirements are satisfied.

Scores do not auto-decide the verdict.

---

## 3. FIX-6 implementation chain

Key FIX-6 commits on the branch:

- `2ff912d2d9bbad6a0316f2c83d74b0fe6747b340` — initial parallel report-signing implementation;
- `9aa7d9370baeb9a39d97655e2da212e9dc81b07a` — autosave drain / stale-body finalization correction;
- `c9f9ef4110e42832aea21e6ca0fb9a4f3e12b73d` — single-step Committee Report signing simplification;
- `3e5ed6847db737e6395d531c04ee5f3b9b5c9812` — redundant manual Save and redundant finalization prose removed.

The accepted product-code baseline before this docs-only reconciliation is therefore:

`3e5ed6847db737e6395d531c04ee5f3b9b5c9812`

---

## 4. Verification and acceptance provenance

Evidence classes remain separate.

### Independent remote source review

Independent review verified the actual pushed branch/source for the FIX-6 sequence and corrections, including:

- report finalization no longer requires evaluator/Summary completion;
- report signing remains own-slot and bound to immutable finalized content;
- evaluator finalization remains independent;
- Chairman Formal Verdict remains the strict convergence gate;
- autosave `flushAndWait()` precedes irreversible finalization;
- `expectedBodyVersion` stale-client protection remains;
- the single-step signature flow does not weaken signer authority;
- the redundant `Save now` control was removed without removing autosave/recovery;
- the redundant Evaluation-sequencing sentence was removed from faculty UI.

### Agent-local automated evidence

The coding-agent reports recorded targeted automated/static evidence for the implementation and corrections.

For the final bounded UI cleanup, the agent reported:

- 3 focused verifier scripts / 120 passed / 0 failed;
- FIX-6 verifier: 15 passed / 0 failed;
- frontend TypeScript clean;
- scoped frontend lint clean;
- `git diff --check` clean;
- no backend production-code change;
- no schema/migration change.

Earlier FIX-6 correction reports also recorded focused autosave and backend regression evidence.

These are **agent-local** results unless a hosted workflow is separately observed.

Hosted CI is not inferred from local results.

---

## 5. Manual-QA decision

The project owner explicitly decided that another full role-separated multi-user replay is **not required** before CDW-9.

Reason:

- the changed FIX-6 ordering/authorization rules are directly covered by focused regression tests;
- the actual remote implementation was independently source-reviewed;
- the autosave-before-finalize race has dedicated regression coverage and source verification;
- the latest UI changes are low-risk presentation/interaction simplifications and do not change backend authority.

Record the additional replay as:

```text
Additional pre-CDW-9 multi-user manual replay
WAIVED / NOT REQUIRED
```

Do **not** record it as:

```text
Manual QA PASS
```

because that replay was not executed.

This is a risk-based acceptance decision, not a rewrite of evidence provenance.

---

## 6. Current authoritative pre-CDW-9 invariants

The following remain mandatory:

- Evaluation authority: Chairman + assigned evaluator Panelists only.
- Committee Report author: assigned Rapporteur only.
- Committee Report signer policy remains stage-aware.
- Title required report signers: Chairman + Panelists + Rapporteur.
- Proposal/Final required report signers: active Adviser + Chairman + Panelists + Rapporteur.
- Facilitator is not a required report signer.
- Report signing and evaluation finalization may proceed independently.
- Finalized report content is immutable for signing.
- Signatures remain bound to the exact finalized report content/version/hash internally.
- Oral Examination Summary generation remains automatic/idempotent after all required evaluator records finalize.
- Formal Verdict remains Chairman-only.
- Formal Verdict remains blocked until every authoritative evaluation, Summary, report-finalization, and report-signature requirement is complete.
- Scores never auto-decide PASSED / REDEFENSE_REQUIRED.
- Concluded attempts remain immutable/read-only.

---

## 7. UI/UX baseline entering CDW-9

Accepted faculty-facing behavior includes:

- no redundant manual `Save now` when reliable autosave owns routine Committee Report persistence;
- save-state feedback and conflict recovery remain available;
- Committee Report finalization uses concise consequence-focused copy;
- no redundant explanation of the parallel Evaluation workstream in the finalization confirmation;
- finalized report signing is single-step:
  `Sign Committee Report -> draw signature -> Confirm Signature`;
- internal terms such as freeze/version/hash remain hidden from ordinary faculty UI.

System-wide UI rule:

> **Do not explain what the UI already demonstrates.**

---

## 8. Pre-CDW-9 gate

Current state:

```text
CDW-0 through CDW-8                 ACCEPTED / CLOSED
CDW-LIVE-1 core                     ACCEPTED / CLOSED
FIX-1 through FIX-5                 ACCEPTED at recorded bounded gates
FIX-6                               FINAL ACCEPTED / CLOSED
Additional full multi-user replay   WAIVED / NOT REQUIRED
CDW-9                               NEXT / AUTHORIZED
```

No further FIX-6 implementation or acceptance task is required before CDW-9 unless a new concrete regression is discovered.

---

## 9. CDW-9 boundary

CDW-9 is hardening / production-readiness work, not a workflow redesign.

Current planned focus remains:

- concurrency around final evaluation / Summary generation;
- concurrent final Committee Report signatures;
- idempotency;
- stale-client handling;
- large-manuscript performance;
- pagination/lazy-loading when measured;
- indexing for schedule/document/thread queries;
- audit logging;
- accessibility/keyboard navigation;
- responsive QA;
- security regression;
- migration rollback/read compatibility.

Measure performance before adding speculative caching.

Do not use CDW-9 to silently change evaluator authority, signer policy, Chairman verdict authority, Summary arithmetic, or the accepted parallel FIX-6 workflow.
