# CDW-LIVE-1 MANUAL-QA FIX-6 — Parallel Committee Report Signing + Faculty UI Language

**System:** EARIST Graduate School Information System (GS-IS)  
**Repository:** MuelTech/graduate-system  
**Branch:** `refactor/collaborative-defense-workspace`  
**Design baseline HEAD:** `ac76d58f0bfac72a6774f25151881ddaa08ae6d2`  
**Parent workflow authority:** `docs/superpowers/DEFENSE_WORKFLOW_SOURCE_OF_TRUTH.md`  
**Collaborative workspace authority:** `docs/superpowers/COLLABORATIVE_DEFENSE_WORKSPACE_AND_RAP_SOURCE_OF_TRUTH.md`  
**Implementation plan:** `docs/superpowers/plans/2026-10-15-collaborative-defense-workspace-implementation.md`  
**UI/UX authority:** `docs/superpowers/ui-ux/SYSTEM_UI_UX_PLAYBOOK.md`  
**Status:** DESIGN APPROVED / NOT YET IMPLEMENTED  
**Date:** 2026-10-19  
**Expected schema change:** NONE  
**Expected migration:** NONE  
**Expected document-processing work:** NONE  
**CDW-9:** NOT STARTED

---

## 0. Why FIX-6 exists

Project-owner end-to-end manual testing confirmed that the current defense implementation is mechanically working across the complete flow. The test then exposed a workflow mismatch with actual defense practice.

The current implementation serializes the work too aggressively:

```text
all required evaluations finalized
        ↓
Oral Examination Summary ready
        ↓
Rapporteur can finalize/freeze Committee Report
        ↓
Committee Report signatures
        ↓
Chairman verdict
```

That sequence is too restrictive.

During a real defense, committee work is concurrent:

- a Panelist may be reading/reviewing the Committee Report while still completing scores;
- the Rapporteur may finish the official Committee Report before every evaluator has finalized;
- a required signer may be ready to sign the Committee Report before finishing their own evaluation.

The system should support that realistic parallel work while preserving one strict final convergence point: the Chairman's formal verdict.

This package also corrects faculty-facing UI language that currently exposes implementation terminology such as `freeze`, frozen version numbers, and other wording that is not natural to end users.

---

## 1. Confirmed workflow correction

After the Chairman starts the defense:

```text
                     ┌─ Evaluation work
                     │    Chairman/Panelists draft
DEFENSE IN_PROGRESS ─┤    and finalize independently
                     │
                     └─ Committee Report work
                          Rapporteur drafts
                          ↓
                          Finalize Committee Report
                          ↓
                          Required signers may sign
```

The two branches are independent until formal conclusion.

### 1.1 Evaluation branch

- Chairman and assigned evaluator Panelists own their own evaluations.
- Evaluation DRAFT/autosave remains private.
- Each evaluator reviews, draws their evaluation signature, and FINALIZES their own record when ready.
- Finalizing an evaluation remains irreversible under the existing rules.
- When the last required evaluator finalizes, Oral Examination Summary generation remains automatic/idempotent.

### 1.2 Committee Report branch

- Assigned Rapporteur remains the only report-body author/editor.
- Rapporteur may finalize the Committee Report once the report content is complete.
- Rapporteur does not wait for every required evaluator to finalize.
- Rapporteur does not wait for the Oral Examination Summary.
- Finalizing the Committee Report makes the report body immutable for signing and creates/reconciles the required stage-aware signature slots.
- Required signers may review/sign immediately.
- Chairman/Panelists may sign even when their own evaluation is still DRAFT.
- Rapporteur may sign their own required report slot immediately after report finalization.
- Existing stage-aware signer policy remains unchanged.

### 1.3 Formal verdict convergence gate

The assigned Chairman may record PASSED or REDEFENSE_REQUIRED only when all authoritative requirements are complete:

- all required evaluator records are FINALIZED/e-signed;
- Oral Examination Summary exists for the current schedule;
- Committee Report has been finalized for signing;
- every required Committee Report signature is complete;
- Committee Report signing lifecycle is complete/finalized;
- no DefenseConclusion already exists.

Scores never auto-decide the verdict.

---

## 2. What does NOT change

FIX-6 does not change:

- numerical evaluator authority: Chairman + assigned evaluator Panelists;
- individual-evaluation ownership/privacy;
- stage-aware Committee Report signer roster;
- Title: Chairman + Panelists + Rapporteur;
- Proposal/Final: active Adviser + Chairman + Panelists + Rapporteur;
- Facilitator exclusion from required Committee Report signatures;
- Chairman-only formal verdict authority;
- PASSED / REDEFENSE_REQUIRED result set;
- evaluation/Summary arithmetic;
- FIX-4 two-decimal Summary computation;
- report immutable snapshot/version/hash integrity;
- signature-to-exact-report binding;
- concluded-attempt immutability;
- realtime persisted-domain event taxonomy;
- schema;
- migrations;
- official PDF/form rendering;
- Download/Print;
- CDW-9.

Internal code may retain legacy names such as `RapReport`, `RapSignature`, `freeze`, `frozenAt`, `contentVersion`, and snapshot/hash fields.

---

## 3. Committee Report finalization authority

The faculty-facing action is:

**Finalize Committee Report**

Finalization is available only to the assigned Rapporteur while the report remains editable.

Required conditions:

- current user is the assigned Rapporteur for the exact schedule;
- report is still DRAFT/editable;
- required report content is present according to existing content rules;
- latest draft/autosave has persisted successfully;
- session is in an allowed active pre-conclusion state.

Must NOT be prerequisites:

- all evaluations finalized;
- Oral Examination Summary ready;
- Rapporteur's own unrelated evaluation state;
- a Chairman verdict.

Internal implementation may keep the current freeze endpoint/transaction if appropriate. The user-facing operation is report finalization.

---

## 4. Committee Report signing authority

Once the Committee Report is finalized:

- create/reconcile required signature slots using the existing stage-aware signer policy;
- allow every required signer to review/sign their own slot;
- do not check that a Chairman/Panelist's evaluation is FINALIZED merely to permit Committee Report signing;
- do not expose or permit signing another person's slot;
- bind every signature to the same immutable finalized report content/hash/version;
- preserve server-authoritative timestamps;
- preserve duplicate/double-sign protection.

Report-signing eligibility and evaluation-finalization eligibility are separate concerns.

---

## 5. Faculty-facing UI language — exact approved copy

This section is normative for FIX-6 implementation. Coding agents must not invent alternative visible wording without project-owner approval.

### 5.1 Rapporteur — editable report

Header:

**Committee Report**

Status:

**Draft**

Primary irreversible action:

**Finalize Committee Report**

Do not render a large **Committee Report readiness** checklist of evaluator/Summary completion above the editor.

Evaluation completion is not a prerequisite for report finalization.

### 5.2 Finalization confirmation

Dialog/confirmation title:

**Finalize Committee Report?**

Body:

**Once finalized, the report can no longer be edited. Required committee members can review and sign it immediately.**

Do **not** add a secondary sentence explaining that evaluations may be completed separately. That workflow rule remains canonical, but it is unnecessary in this confirmation because the interface already communicates the independent workstreams and the Chairman's verdict gate.

Actions:

- **Cancel**
- **Finalize Report**

Pending action:

**Finalizing…**

Error copy should describe the recoverable failure in plain language, for example:

**The Committee Report could not be finalized. Please try again.**

Copy rationale:

- explain the direct irreversible consequence: the report becomes non-editable;
- explain the immediate user-relevant next capability: required members can sign;
- do not narrate the separate Evaluation workflow in the confirmation.

This follows the system-wide UI rule in `docs/superpowers/ui-ux/SYSTEM_UI_UX_PLAYBOOK.md`: **Do not explain what the UI already demonstrates.**

Do not use:

- Freeze this report for signatures?
- Freeze for Signatures
- Confirm Freeze
- Freezing…

### 5.3 Finalized report — unsigned required signer

Header:

**Committee Report**

Status badge:

**Ready for Signatures**

Progress:

**<signed> of <required> signatures completed**

Current-user helper:

**Your signature is required. Review the finalized report before signing.**

Action:

**Review & Sign**

Do not show raw content version.

### 5.4 Finalized report — signatures in progress

Status badge:

**Awaiting Signatures**

Progress:

**<signed> of <required> signatures completed**

If current user already signed:

**Signed**

Optional own timestamp:

**You signed this Committee Report on <date/time>.**

Do not display the full cross-signer audit roster to ordinary faculty users.

### 5.5 Committee Report complete

Status badge:

**Committee Report Complete**

Progress may remain:

**<required> of <required> signatures completed**

The Admin Defense Records surface may continue to expose the full signer audit where authorized.

---

## 6. Review & Sign dialog — exact approved copy

### Step 1

Dialog title:

**Review and Sign Committee Report**

Description:

**Please review the finalized Committee Report before signing. Your signature will be recorded for this report and cannot be changed after confirmation.**

Supporting text:

**Nothing is signed until you confirm your signature in the next step.**

Actions:

- **Cancel**
- **Continue to Sign**

Do not show:

- frozen report/version;
- V1;
- version 1;
- contentVersion;
- snapshot/hash.

### Step 2

Dialog title:

**Add Your Signature**

Description:

**Draw your signature below, then confirm to sign the Committee Report.**

Signature pad remains draw-only for this flow.

Actions:

- **Back**
- **Confirm Signature**

Pending action:

**Signing…**

Success state outside the modal:

**Signed**

---

## 7. Formal Verdict faculty-facing copy

The Chairman's Formal Verdict area is the strict completion gate.

Use concise user-facing progress, not internal readiness diagnostics.

Recommended rows:

- **Evaluations** — `<finalized> of <required> finalized`
- **Committee Report Signatures** — `<signed> of <required> completed`

If report signer slots do not exist yet:

- **Committee Report Signatures — Waiting for finalized report**

The UI must not imply that the Committee Report waits for evaluations.

Do not expose separate faculty-facing rows such as:

- Oral Examination Summary ready;
- Committee Report frozen;
- RAP finalized;
- content version;
- snapshot/hash.

Those remain server-authoritative internal requirements.

Formal Result controls remain hidden/disabled until the backend conclusion-readiness decision is true.

---

## 8. Terminology boundary

Preferred ordinary faculty-facing terms:

- Committee Report
- Draft
- Finalize Committee Report
- Finalize Report
- Finalized Committee Report
- Ready for Signatures
- Awaiting Signatures
- Review & Sign
- Review and Sign Committee Report
- Add Your Signature
- Confirm Signature
- Signed
- Committee Report Complete
- Evaluations
- Requirements for Verdict / Formal Verdict

Avoid ordinary faculty-facing:

- RAP Report
- RAP finalized
- freeze
- frozen
- Freeze for Signatures
- Confirm Freeze
- frozen snapshot
- V1
- version 1 / contentVersion
- hash
- readiness service
- internal enum names.

Admin/audit/debug surfaces may expose technical metadata only when it serves a real operational need.

---

## 9. Legacy /panelist/signatures surface

The existing secondary E-Signatures page still contains legacy **RAP Report** wording.

FIX-6 should reconcile visible terminology on that surface where it references the same Committee Report workflow:

- **RAP Report** -> **Committee Report**
- **pending RAP signatures** -> **pending Committee Report signatures**
- **official RAP record** -> **Committee Report**
- other equivalent visible legacy labels -> plain Committee Report terminology.

Do not rename backend routes/models merely for wording symmetry.

The active Defense Workspace remains the preferred primary signing flow.

---

## 10. Realtime behavior

No new persisted domain event is required.

Existing events remain sufficient:

- `report.ready_for_signature` after authoritative report finalization;
- `rap.signature.recorded` after signature persistence;
- `rap.finalized` after all required report signatures complete;
- `evaluation.finalized` independently for evaluator completion;
- `defense.concluded` after Chairman verdict.

REST/database state remains authoritative.

Clients continue to invalidate/refetch authoritative state.

The key change is authorization/readiness sequencing, not event count.

---

## 11. Likely implementation surfaces

Backend likely affected:

- `backend/src/services/rap-report.service.ts`
- `backend/src/services/rapporteur-finalization.service.ts`
- `backend/src/services/rap-snapshot.rules.ts`
- `backend/src/services/rap-signature.policy.ts`
- collaboration/report read-model capability logic;
- focused unit tests around report finalization/signing/conclusion readiness.

Frontend likely affected:

- `frontend/src/components/defense-workspace/rap-signature-panel.tsx`
- `frontend/src/components/defense-workspace/committee-report-panel.tsx`
- `frontend/src/components/defense-workspace/committee-report-signature-dialog.tsx`
- `frontend/src/components/defense-workspace/chairman-verdict-panel.tsx`
- `frontend/src/app/(portal)/panelist/signatures/page.tsx`
- focused verifier(s) for exact approved UI copy and absence of leaked technical wording.

Inspect actual source before implementing; do not change a file merely because it appears in this likely list.

---

## 12. Automated acceptance

At minimum prove:

1. assigned Rapporteur can finalize a valid DRAFT Committee Report while one or more required evaluator records remain DRAFT;
2. report finalization does not require Oral Examination Summary existence;
3. finalization still produces immutable report content and required signer slots;
4. required Chairman/Panelist can sign the finalized Committee Report while their own evaluation remains DRAFT;
5. signing still binds to the exact immutable report version/hash internally;
6. no signer can sign another person's slot;
7. evaluation finalization remains unchanged and own-record only;
8. last evaluator finalization still generates Summary correctly/idempotently;
9. Chairman conclusion remains blocked while any required evaluation is incomplete;
10. Chairman conclusion remains blocked while any required Committee Report signature is incomplete;
11. Chairman conclusion becomes available only after all authoritative gates pass;
12. no score-derived verdict;
13. Rapporteur UI no longer renders Committee Report readiness based on evaluator/Summary completion;
14. Rapporteur action says **Finalize Committee Report**;
15. confirmation says **Finalize Committee Report?** and **Finalize Report**;
16. faculty signing UI contains no **Freeze for Signatures** / **Confirm Freeze**;
17. faculty signing UI contains no visible V1 / version 1 / Frozen version / contentVersion;
18. signing dialog uses the exact approved Step 1/Step 2 language or an explicitly project-owner-approved equivalent;
19. legacy secondary signing page uses Committee Report terminology;
20. existing signer roster policy is unchanged;
21. no schema/migration;
22. no document/PDF work;
23. CDW-9 not started.

---

## 13. Targeted project-owner manual QA

Use one active defense attempt.

Required evidence:

1. Start defense.
2. Leave at least one Chairman/Panelist evaluation in DRAFT.
3. As Rapporteur, complete the Committee Report.
4. Verify **Finalize Committee Report** is available despite unfinished evaluation(s).
5. Finalize the report.
6. Verify report becomes read-only and signature actions become available.
7. As a required Chairman/Panelist whose evaluation is still DRAFT, open the same defense and **Review & Sign** the Committee Report.
8. Verify signing succeeds.
9. Verify that evaluator can still return to and finalize their own evaluation afterward.
10. Verify Chairman Formal Verdict remains unavailable while any evaluation remains incomplete.
11. Finalize all required evaluations; verify Summary generation.
12. Complete all remaining required Committee Report signatures.
13. Verify Chairman Formal Verdict becomes available only now.
14. Record PASSED or REDEFENSE_REQUIRED.
15. Verify CONCLUDED/read-only historical state.
16. Verify no ordinary faculty surface displays freeze/V1/version/snapshot/hash jargon.

Sequential role switching is acceptable when simultaneous authenticated clients are impractical. Record true simultaneous realtime observation separately and truthfully.

---

## 14. Documentation precedence

FIX-6 supersedes older project wording only on these bounded points:

1. the old requirement that all evaluator records/Summary must be complete before Committee Report finalization;
2. any implication that a signer must finalize their evaluation before signing the Committee Report;
3. faculty-facing freeze/version/RAP implementation terminology.

FIX-5 remains historically accepted for its signer-visibility, draw-only signature, Admin Defense Records, and terminology-cleanup work except where this document explicitly supersedes it.

The canonical source-of-truth and implementation plan are reconciled with this document in the same documentation-only commit.

---

## 15. Gate

```text
DEV-NET-1
  [IMPLEMENTED / USER CONFIRMED WORKING]
      ->
FIX-5
  [BOUNDED UX ACCEPTED]
      ->
PROJECT-OWNER END-TO-END EXECUTION
  [MECHANICALLY PASS; WORKFLOW SEQUENCING CORRECTION IDENTIFIED]
      ->
FIX-6 PARALLEL REPORT SIGNING + UI LANGUAGE
  [DESIGN APPROVED / IMPLEMENTATION REQUIRED]
      ->
TARGETED FIX-6 MANUAL QA
      ->
FINAL END-TO-END ACCEPTANCE
      ->
CDW-9
  [NOT STARTED]
```

Do not begin CDW-9 as part of FIX-6.
