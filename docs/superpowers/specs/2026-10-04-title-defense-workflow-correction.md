# Title Defense Workflow Correction — Chairman / Rapporteur Independence

**Date:** 2026-10-04  
**Branch:** `workflow/title-defense`  
**Status:** CONFIRMED_PROJECT_DESIGN after manual Title Defense QA; implementation pending  
**Canonical parent:** `docs/superpowers/DEFENSE_WORKFLOW_SOURCE_OF_TRUTH.md`

---

## 1. Purpose

This correction fixes a Title Defense ordering defect found during manual UI testing.

Current implementation behavior incorrectly makes the Chairman wait for Rapporteur finalization before the Chairman can record the formal Title result / selected title. The same manual pass also found that Rapporteur **Save Draft** works while **Finalize** does not complete successfully.

This document is a bounded Title Defense correction. It does not authorize changes to Adviser Request, Proposal Defense, Final Defense, committee-size policy, or unresolved institutional rules.

## 2. Confirmed QA findings

### TD-1 — Chairman is incorrectly blocked by Rapporteur finalization

Observed current behavior:

```text
Defense scheduled / conducted
→ Rapporteur must finalize notes
→ only then Chairman can record the Title result / selected title
```

This dependency is incorrect.

The academic decision is reached by the panel during deliberation. The Chairman is the formal system authority who records that panel-agreed result. Completion of the minutes is a separate Rapporteur responsibility and must not be a prerequisite to recording the academic decision.

### TD-2 — Rapporteur Finalize does not work

Observed current behavior:

- Rapporteur **Save Draft** works.
- Rapporteur **Finalize** does not successfully complete the intended finalization action.

Implementation must trace the full finalization path rather than merely enabling the button:

```text
Finalize control
→ frontend handler
→ API request
→ authorization / validation
→ service/domain transition
→ persistence
→ refreshed UI state
```

## 3. Correct Title Defense role model

After the defense is in the appropriate post-deliberation phase, Chairman and Rapporteur responsibilities are independent:

```text
                 PANEL DELIBERATION
                        │
          ┌─────────────┴─────────────┐
          │                           │
          ▼                           ▼
      CHAIRMAN                    RAPPORTEUR
records panel-agreed            captures / saves
formal result                   draft minutes
          │                           │
if PASSED, records                   ▼
exactly one selected title      finalizes minutes/RAP
          │                           │
          └─────────────┬─────────────┘
                        ▼
              completion checks
                        │
PASSED + selected title + required RAP finalized/signed
                        │
                        ▼
                TITLE COMPLETE
                        │
                        ▼
             ADVISER REQUEST UNLOCK
```

The diagram shows responsibility independence, not a requirement that the two actions occur simultaneously.

## 4. Chairman conclusion rule

After panel deliberation:

- Chairman may record the panel-agreed formal Title result without waiting for Rapporteur notes/RAP finalization.
- If the result is `PASSED`, Chairman must record exactly one official title from the student's submitted three titles.
- Title Defense does not use the Proposal/Final Group I/II numerical evaluator-completion gate.
- Rapporteur draft/finalization state must not be used as a Chairman authorization or eligibility prerequisite.
- If `AWAITING_CONCLUSION` remains an implementation status, entry into that state must not require finalized Rapporteur notes/RAP.

The Chairman records the panel's decision; the Chairman is not modeled as independently choosing a title outside panel deliberation.

## 5. Rapporteur rule

The assigned Rapporteur:

- may capture notes while the defense is active;
- may save draft notes repeatedly;
- must be able to execute the intended Finalize action when required content/validation is satisfied;
- owns the official defense minutes/RAP workflow for the session;
- does not control whether the Chairman may record the academic conclusion.

Rapporteur finalization remains required evidence for Title-stage completion according to the canonical SOT.

## 6. Completion invariant

Removing the incorrect Chairman dependency must **not** weaken the Title completion gate.

Title is `COMPLETE` only when all required conditions are satisfied:

1. formal Title result = `PASSED`;
2. exactly one official selected title exists and belongs to the student's submitted Title proposals;
3. required Title RAP/minutes are finalized;
4. all required Title RAP signatures/finalization are complete.

Therefore:

- Chairman conclusion alone does not unlock Adviser Request.
- Selected title alone does not unlock Adviser Request.
- Rapporteur finalization alone does not unlock Adviser Request.
- Adviser Request unlocks only after full Title completion.

## 7. Implementation boundaries

In scope for the later bounded implementation pass:

- remove the Title-specific code/state guard that makes Chairman conclusion wait for Rapporteur finalization;
- fix the Rapporteur Finalize action end-to-end;
- keep authorization based on assigned session role;
- preserve selected-title validation;
- preserve full Title-stage completion / Adviser Request gate;
- add focused backend/frontend tests for the corrected ordering and finalization path.

Out of scope:

- Adviser Request redesign;
- Proposal Defense workflow correction;
- Final Defense workflow correction;
- committee-size policy changes;
- Proposal/Final evaluator scoring changes;
- unrelated UI redesign or refactor.

## 8. Acceptance criteria

The Title correction is not accepted until all of the following are verified:

1. A scheduled/conducted Title Defense can reach the correct Chairman conclusion phase without Rapporteur finalization.
2. Chairman can record the panel-agreed formal result while Rapporteur notes are still draft.
3. A `PASSED` Title conclusion requires exactly one valid submitted title.
4. Rapporteur **Save Draft** continues to work.
5. Rapporteur **Finalize** successfully completes its intended server/domain transition and the UI refreshes to the resulting state.
6. Unauthorized non-Chairman users cannot record the formal conclusion.
7. Unauthorized non-Rapporteur users cannot edit/finalize Rapporteur notes.
8. Chairman conclusion by itself does not mark Title `COMPLETE`.
9. Adviser Request remains locked until `PASSED` + selected title + required finalized/signed Title RAP.
10. Proposal/Final workflows are unchanged by this bounded correction.

## 9. Next step

After this documentation correction is reviewed for consistency, inspect the current Title implementation and produce one bounded coding task for `workflow/title-defense`.

Do not implement code from an older sequence that says:

```text
Rapporteur finalized
→ Chairman may conclude
```

That ordering is explicitly superseded by this correction.
