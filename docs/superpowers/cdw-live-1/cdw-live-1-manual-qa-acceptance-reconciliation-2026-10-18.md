# CDW-LIVE-1 Manual-QA Acceptance Reconciliation — 2026-10-18

**Repository:** MuelTech/graduate-system  
**Branch:** `refactor/collaborative-defense-workspace`  
**Implementation HEAD reconciled:** `13a4c38acbc72dc13902539da398127f674384e5`  
**Status:** BOUNDED MANUAL-QA FIXES RECONCILED; FIX-4 SUMMARY COMPUTATION IMPLEMENTED / SOURCE REVIEW PASS; FIX-5 COMMITTEE REPORT SIGNING + DEFENSE RECORDS UX IMPLEMENTED / SOURCE REVIEW PASS / PROJECT-OWNER TARGETED MANUAL QA PASS / BOUNDED UX ACCEPTED; FINAL END-TO-END MULTI-USER ACCEPTANCE READY / NEXT GATE

**CDW-9:** NOT STARTED

---

## 1. Purpose

This document reconciles the post-CDW-LIVE-1 manual-QA packages with the actual remote implementation state.

It does not replace the canonical Source of Truth. It records which bounded fixes are closed and what remains before CDW-9.

---

## 2. Reconciled package state

| Package | Reconciled state | Key result |
|---|---|---|
| CDW-LIVE-1 core | ACCEPTED / CLOSED | report autosave/live preview + private evaluator autosave |
| MANUAL-QA FIX-1 | IMPLEMENTED / SOURCE REVIEW PASS | preview convergence + LAN realtime diagnostics; user LAN retest reported working after restart |
| MANUAL-QA FIX-2 | IMPLEMENTED / SOURCE REVIEW PASS / SUPERSEDED BY FIX-3 | evaluator sidebar overlap fixed; Save now removed; centered Review -> Sign finalization dialog |
| MANUAL-QA FIX-3 | IMPLEMENTED / SOURCE REVIEW PASS / BOUNDED PRODUCT REVIEW ACCEPTED | draw-only individual evaluation signature, concise Formal Verdict readiness, roster chevron |
| MANUAL-QA FIX-3A | ACCEPTED FOR BOUNDED UX SCOPE | `Waiting for report` wording + redundant printed-name UI/plumbing removed |
| MANUAL-QA FIX-4 | IMPLEMENTED / SOURCE REVIEW PASS | institutional Summary numeric computation verified in source; project-owner manual inspection showed generated Group A/Group B/Average rows in Admin; full lifecycle not yet accepted |
| MANUAL-QA FIX-5 | BOUNDED UX ACCEPTED | implementation `13a4c38a`; independent source review PASS; project-owner targeted manual QA PASS for the corrected Committee Report signing and Admin Defense Records flow |
| Final end-to-end multi-user live-defense acceptance | READY / NEXT GATE | complete role-separated evaluation -> report -> signatures -> verdict -> concluded read-only workflow remains separate and must still be exercised |
| CDW-9 | NOT STARTED | hardening must wait for the final manual acceptance gate |

---

## 3. What is accepted at fd999e80

The following bounded behavior has been independently source-reviewed and accepted by the project owner at the visible product level:

- evaluator sidebar no longer overlaps following Chairman cards;
- evaluator DRAFT uses autosave without redundant Save now;
- Review & Finalize opens a centered two-step dialog;
- individual evaluation signature is Draw-only;
- no manual evaluator-name field or redundant printed-name copy appears in the signing modal;
- shared signature infrastructure may still expose Type where another authorized flow uses it;
- Formal Verdict shows only:
  - Evaluation Signatures;
  - Committee Report Signatures;
- before report signer slots exist, the Chairman sees **Waiting for report**, not Pending or 0 of 0;
- technical Oral Summary / report frozen / RAP finalized flags stay hidden from faculty-facing readiness while remaining mandatory backend gates;
- verdict controls remain gated by server `readyForConclusion`;
- Committee Roster has a visible native expand/collapse chevron;
- evaluation/report signature progress remains near-realtime through authoritative invalidation/refetch, with polling fallback;
- raw signature images and private evaluator DRAFT values are not broadcast.

No schema or migration was added by FIX-2/FIX-3/FIX-3A.

---

## 4. What is NOT yet claimed

The coding agents did not execute full authenticated multi-user browser QA for the complete live-defense lifecycle.

The project owner's acceptance of the bounded visible UX fixes must not be expanded into a claim that the entire role-separated workflow has already passed end to end.

The remaining manual acceptance must exercise, where practical, independent authenticated clients for:

- Chairman;
- required Panelist evaluator(s);
- Rapporteur;
- Adviser when required for Proposal/Final Committee Report signing.

---

## 5. Confirmed FIX-4 prerequisite before final manual acceptance

The current institutional matrix already derives each evaluator's Group I and Group II averages. EARIST has now confirmed the remaining Summary arithmetic:

```text
Summary Group A = finalized evaluator Group I Average
Summary Group B = finalized evaluator Group II Average
Summary Average = (Group A + Group B) / 2
```

All derived averages are rounded to **2 decimal places**. Example: `1.225 -> 1.23`.

Rating and Remarks remain deferred/null and must not block Summary generation or defense progression. Official PDF/print/download document processing remains a separate future phase.

FIX-4 now implements this rule and independently passed source review at `3b24c496`. During project-owner manual inspection, the generated institutional Summary was visible in Admin with two-decimal Group A/Group B/Average rows. That inspection is useful product evidence, but it is not a claim that every FIX-4 timing/pre-last-finalizer scenario or the complete live-defense lifecycle has passed. The same inspection exposed downstream UI/UX issues now owned by FIX-5.

Detailed authority:

    docs/superpowers/cdw-live-1/cdw-live-1-manual-qa-fix-4-oral-summary-computation-design.md

---

## 6. FIX-5 bounded acceptance after implementation

Manual inspection after FIX-4 exposed a stale Committee Report signing presentation and outdated Admin Defense Records information architecture. FIX-5 corrected those issues without changing academic or workflow authority.

Implementation at `13a4c38acbc72dc13902539da398127f674384e5` now provides:

- compact faculty Committee Report signature progress without the full cross-signer audit roster;
- own-signature action/status only for the current faculty user;
- centered two-step draw-only Committee Report signing;
- Admin Evaluation Results aligned to evaluation/signature status and timestamp;
- institutional V2 Summary limited to the confirmed Group A / Group B / Average presentation;
- full signer-level Committee Report audit retained in Admin;
- plain Committee Report terminology on the affected surfaces;
- stale post-conclusion report-creation copy removed.

Acceptance provenance is intentionally separated:

- coding-agent browser/manual QA: **NOT EXECUTED — ENVIRONMENT LIMITATION**;
- independent remote source/diff review: **PASS**;
- later project-owner targeted manual QA of the corrected flow: **PASS**.

Therefore FIX-5 is **accepted for its bounded UX scope**. This does not claim the complete role-separated live-defense lifecycle has passed.

Detailed authority:

    docs/superpowers/cdw-live-1/cdw-live-1-manual-qa-fix-5-committee-report-signing-defense-records-ux-design.md

Implementation report:

    docs/superpowers/cdw-live-1/cdw-live-1-manual-qa-fix-5-report.md

---

## 7. Final pre-CDW-9 manual acceptance scenario

Canonical final acceptance flow:

```text
Chairman Start Defense
  -> IN_PROGRESS
  -> Chairman/Panelists complete and finalize own evaluations
  -> Evaluation Signatures progress converges
  -> all required evaluations FINALIZED
  -> Rapporteur completes Committee Report
  -> report becomes ready for required signatures
  -> required stage-aware signers sign same frozen report
  -> Committee Report Signatures progress converges
  -> all hidden backend conclusion gates pass
  -> Formal Verdict controls become available
  -> Chairman records PASSED or REDEFENSE_REQUIRED
  -> CONCLUDED
  -> reopen attempt read-only
```

Acceptance must confirm:

1. evaluator DRAFT privacy across different evaluator accounts;
2. no verdict controls while required evaluation/report signatures are incomplete;
3. Committee Report signature counts reflect the actual stage-aware required signer set;
4. realtime progress updates without exposing raw signature evidence;
5. polling/refetch fallback still converges when realtime is unavailable;
6. final verdict is Chairman-only;
7. concluded records are immutable/read-only;
8. a concrete failure creates a bounded fix package instead of weakening the workflow gate.

---

## 8. Gate

Current state:

```text
CDW-LIVE-1 core ACCEPTED / CLOSED
  -> FIX-1 IMPLEMENTED / SOURCE REVIEW PASS
  -> FIX-2 IMPLEMENTED / SOURCE REVIEW PASS
  -> FIX-3 + FIX-3A BOUNDED UX ACCEPTED
  -> FIX-4 ORAL EXAMINATION SUMMARY COMPUTATION  [IMPLEMENTED / SOURCE REVIEW PASS]
  -> FIX-5 COMMITTEE REPORT SIGNING + DEFENSE RECORDS UX  [BOUNDED UX ACCEPTED]
  -> FINAL END-TO-END MULTI-USER LIVE-DEFENSE MANUAL ACCEPTANCE  [READY / NEXT GATE]
  -> CDW-9  [NOT STARTED]
```

Do not start CDW-9 until the final multi-user live-defense acceptance is completed, unless the project owner explicitly changes that gate.
