# CDW-7 — Acceptance and regression pass before realtime

**Branch:** `refactor/collaborative-defense-workspace`
**Starting SHA:** `fd6de521e0996588e80986df8102a326b2d52198`
**Ending SHA:** the CDW-7 acceptance commit immediately following the starting SHA
**Scope:** prove the assembled Collaborative Defense Workspace + RAP workflow works as one
coherent, persisted workflow **without** Socket.IO. Primarily verification/regression; only
the smallest acceptance-blocking production corrections were made.
**Migration:** NONE (`NO NEW DATABASE MIGRATION ADDED`).

## 1. Acceptance matrix (state × role)

| State | Chairman | Panelist | Rapporteur | Facilitator | Adviser |
|---|---|---|---|---|---|
| SCHEDULED | review/annotate; **Start Defense only** | review/annotate; scoring closed | review/comment; no scoring | view-only | view-only |
| IN_PROGRESS | evaluate (own record), start done | evaluate (own record) | author report; comment; no scoring | view-only | view-only (Proposal/Final signer later) |
| AWAITING_CONCLUSION | evaluate complete → report freeze/sign → prepare verdict | evaluation closed (read-only) | freeze + sign own slot | no academic write | Proposal/Final: sign own slot |
| CONCLUDED | read-only; prior verdict | read-only | read-only | read-only | read-only |

Canonical operations verified: workspace read, exact manuscript read, annotation/comment
create, evaluation read/write/finalize, report draft edit/read, freeze, RAP signing,
conclusion readiness, formal conclusion, history read. **Historical writes do not exist**
(detail/list are GET-only; historical collaboration writes are rejected by the exact-target
rules).

## 2. Pre-defense — SCHEDULED

Verified by existing + new tests:

- the workspace resolves the **exact** `DefenseSchedule.manuscriptDocumentId`; a newer
  document/certification never rebinds it (`defense-workspace.manuscript-binding`,
  `dl7-*`, `cdw2` tests);
- evaluation is closed: `evaluationOpen` requires `IN_PROGRESS` for **all** stages
  (`defense-workspace.service`, `cdw4` verify); evaluation routes assert the same state;
- only the assigned Chairman may start (`startDefense` resolves the caller's
  `PanelAssignment`; Panelist → 403); unassigned users are denied;
- cross-schedule/cross-thesis document access is denied by the exact-binding stage rules.

## 3. Live defense — IN_PROGRESS

- Chairman + Panelists are the only numerical evaluators (`isEvaluatorRole`); Rapporteur,
  Facilitator, and Adviser receive no evaluator controls (`cdw4` verify / role rail).
- Evaluator privacy: the workspace/read models expose only the caller's own evaluation
  status/record; the detailed Oral Examination Summary remains ADMIN-only
  (`cp7-fix2-conclusion-privacy`).
- Rapporteur authors the in-system report and may comment; Chairman/Panelists see it
  read-only.
- Only IN_PROGRESS opens scoring for Title/Proposal/Final.

## 4. Evaluation lifecycle

- SCHEDULED → closed. IN_PROGRESS → own-record DRAFT/REVIEW → e-sign + finalize.
- FINALIZED is immutable; no reopen, no signature replacement, no score edit.
- Scores never choose the verdict (`assertOutcomeIndependentOfScore`; the Chairman panel
  exposes explicit PASSED / REDEFENSE_REQUIRED only).
- Covered by `cp7-fix2-*`, `defense-conclusion.service`, `oral-evaluation` suites.

## 5. RAP freeze

Freeze (`freezeReportForSignatures`) requires: assigned Rapporteur; DRAFT report; meaningful
body; session writable; all required evaluator records FINALIZED; Oral Examination Summary
existing or safely generated. It runs under the shared per-attempt `SELECT … FOR UPDATE`
lock with a body-version CAS, produces an immutable snapshot + `contentVersion` + server
SHA-256, creates the stage-aware required signer slots, and sets `FOR_SIGNATURE`. A second
freeze returns the existing snapshot. After freeze, the report body and collaboration layer
are read-only; existing comments remain readable (`rap-c1-freeze-signature`,
`defense-collaboration.service`).

## 6. RAP signer matrix

| Stage | Required signers |
|---|---|
| TITLE_DEFENSE | Chairman + assigned Panelists + Rapporteur |
| PROPOSAL_DEFENSE | active Adviser + Chairman + Panelists + Rapporteur |
| FINAL_DEFENSE | active Adviser + Chairman + Panelists + Rapporteur |

Facilitator is never a signer. Title has no Adviser slot. Dean remains a separate,
unconfirmed institutional area. Each signer signs only their own required slot for the exact
frozen content version/hash; the last required signature moves the RAP to `FINALIZED`
monotonically. Verified by `rap-signature.policy` + new CDW-7 signer-matrix tests.

## 7. Conclusion gate

Server-authoritative for **every** stage (`validateConclusionPreconditions` and the
repository transaction): session `AWAITING_CONCLUSION`; assigned Chairman; all required
evaluators FINALIZED; Summary ready; in-system RAP exists, frozen, fully signed, and
`FINALIZED`; no existing conclusion; explicit `PASSED` / `REDEFENSE_REQUIRED` only.

`NO RAP / DRAFT / FOR_SIGNATURE / PARTIALLY_SIGNED / ALL_SIGNED / DISTRIBUTED → 409`;
`FINALIZED → eligible subject to the other prerequisites`. Legacy Rapporteur notes never
substitute. Both `/conclusion` and `/conclude` resolve to the same controller handler
(route test). Non-Chairman → 403; second conclusion → 409; invalid/legacy verdicts → 400.

## 8. Concluded state

After conclusion the attempt is historical and immutable **for every stage and every
current/legacy write path**: no scoring/evaluation mutation, no annotation/comment
creation, no report edit/freeze, no RAP signature (modern frozen **and** legacy RAPs), no
Rapporteur note editing or note finalization, no post-conclusion RAP creation, and no
second verdict. Reads remain available (exact manuscript, historical comments, finalized
report, verdict as permitted). Evaluator privacy is preserved
(`cp7-fix2-conclusion-privacy`, `defense-collaboration.service` freeze/concluded write
guards).

## 9. Re-defense / history

Each attempt owns a new schedule, committee, evaluations, annotations, RAP, signature
slots, and conclusion; prior rows are never reused or reopened (`defense-history.service`,
`cdw6-*`). History is read-only, resolved from exact attempt bindings, with explicit report
provenance (structured RAP / legacy RAP text / legacy Rapporteur notes). A replacement
current committee member gains read-only prior context but no historical write authority;
future/unrelated attempts and non-bindings stay denied. Manual compare has no diff engine
and no compliance judgement.

## 10. Stale transitional audit

**Runtime defects found (acceptance-blocking) — fixed in CDW-7:**

1. **Dashboard actionable conclusion before RAP FINALIZED.** The Chairman
   `CHAIRMAN_CONCLUSION` task was created from `AWAITING_CONCLUSION + Summary +
   (Title || rapporteurNotesFinalized)`, bypassing RAP-C1. It is now gated on
   `rapStatus === "FINALIZED"` for every stage; the blocked reason points at the Committee
   Report, not legacy minutes.
2. **Dashboard pending RAP signature linked to `/panelist/signatures`** (a placeholder,
   blind-signing surface). The task now carries the attempt's `scheduleId` and opens the
   exact Defense Workspace, where the frozen report is reviewed before signing.
3. **Legacy signing route bypassed frozen binding.** `RapReportService.signRapSlot`
   (used by `POST /defense/rap-reports/:sigId/sign`) signed any own slot without the frozen
   content version/hash. For RAPs carrying a frozen snapshot it now requires
   `FOR_SIGNATURE`/`PARTIALLY_SIGNED` and writes `signedContentHash` +
   `signedContentVersion`; legacy RAPs without a snapshot keep the compatibility path.
4. **Workspace capability contradicted readiness.** `canRecordFormalResult` ignored the
   RAP (and exempted Title). It now requires a `FINALIZED` report at every stage, matching
   the authoritative conclusion gate.

**Comment/doc debt only (not fixed — no runtime authority):**

- `chairman-conclusion-panel.tsx` still contains a stale comment claiming the RAP-C1
  sequence is "not implemented until RAP-C1", plus a corrupted fallback glyph in the
  display string (the panel is read-only and only renders for concluded attempts).
- `rapporteur-notes-workspace.tsx` and `chairman-oral-summary.tsx` are unmounted dead
  components.
- `/panelist/signatures` remains a secondary inbox with a placeholder preview (accepted by
  RAP-C1 as non-primary); its backend path now enforces the frozen binding and the dashboard
  no longer routes actionable work there.
- The legacy `saveRapporteurNotes`/`rapporteurDraft` API remains for compatibility; the UI
  authors through the Committee Report.

## 11. Production fixes (smallest necessary)

- `backend/src/services/panelist-dashboard.rules.ts` — RAP-C1 conclusion gating; report
  authoring task; RAP signature task opens the workspace.
- `backend/src/repositories/panelist-dashboard.repository.ts` — exposes `rapStatus` and the
  slot's `scheduleId`.
- `backend/src/services/defense-workspace.service.ts` — `canRecordFormalResult` requires a
  FINALIZED RAP.
- `backend/src/services/rap-report.service.ts` — legacy signing route binds the frozen
  snapshot for canonical RAPs (compatibility preserved for legacy RAPs).

No schema change, no migration, no architecture change, no new authority.

## 12. Automated tests

New: `backend/tests/unit/services/cdw7-acceptance-regression.test.ts` (16 tests) connecting
the cross-feature invariants:
dashboard conclusion gate (all stages, all non-FINALIZED states), workspace capability,
legacy-sign frozen binding/own-slot/status, all-stage conclusion matrix, signer matrix.

Focused acceptance set (new + dashboard + workspace + conclusion + privacy + RAP-C1 +
collaboration + routes + history + signer policy): **294 passed**.

Full backend: `npx prisma validate` (valid), `npx prisma generate`, `npm run build`
(exit 0), `npx vitest run` → **140 files / 1565 passed / 5 skipped / 0 failed**.

## 13. Frontend verification

New `verify-cdw7-acceptance.mjs` (13 assertions): no realtime dependency; Current
Manuscript default; `evaluationOpen` scoring gate; Chairman-only Start; RAP-C1 verdict
panel + canonical verdict values; server readiness; freeze/sign present and report
read-only; pure collaboration policy closed after freeze/conclusion; role write matrix;
read-only history/compare; no raw signatures/private scores; in-system report authoring; no
Socket.IO; polling contract.

Full verifier set (10 scripts): **189 assertions, 0 fail**. `npx tsc --noEmit` clean;
`npm run build` exit 0. No frontend production source changed, so scoped eslint was not
re-run.

## 14. Manual QA

**MANUAL QA NOT EXECUTED.**

This environment has no seeded multi-user browser session, so the canonical manual
scenarios were not performed. Automated tests must not be read as a manual pass. The
project-owner checklist belongs to the CDW-7 review (pre-defense review → start → live
evaluation/privacy → report → freeze → signer matrix → verdict gate → concluded read-only →
history/re-defense → replacement committee).

## 15. Deferred (unchanged)

Socket.IO/WebSockets, live cursors/presence/typing, CRDT, automatic PDF/text/semantic
diff, AI revision-compliance judgement, official GS Form rendering/PDF/print, Dean
signature workflow, new verdict values, score-derived verdicts, major UI redesign, CDW-8,
CDW-9. No database migration.

## 16. Final correction — concluded-attempt immutability (all stages, all legacy paths)

Independent review found four remaining post-conclusion mutation paths inherited from the
superseded "conclude Title first, finalize notes/RAP later" flow. **CONCLUDED now means
immutable for every stage and every current/legacy write path.**

Closed:

1. **Title Rapporteur note editing after conclusion.** `saveRapporteurNotes` no longer has
   a Title-only exception: `CONCLUDED`/`CANCELLED` are rejected for TITLE, PROPOSAL, and
   FINAL, and the conditional update never runs. Both note routes
   (`PUT /workspace/rapporteur-notes` and legacy `PUT /notes`) share this method.
2. **Title note finalization after conclusion.** `finalizeDefenseNotes` rejects
   `CONCLUDED`/`CANCELLED` for every stage before any mutation; Title legacy finalization
   is bounded to `IN_PROGRESS`/`AWAITING_CONCLUSION` (never `SCHEDULED`/`CONCLUDED`).
3. **Deferred post-conclusion Title RAP creation.** The
   `ensureRapAfterTitlePrerequisites` call was removed from the active finalization path.
   Formal conclusion already requires a FINALIZED RAP, so note finalization never creates
   or converges a RAP after conclusion. The compatibility helper may remain for historical
   read/admin tooling but is unreachable from this mutation path; old records are neither
   deleted nor backfilled.
4. **Legacy RAP signing after conclusion.** `signRapSlot` now resolves the owning
   `DefenseSchedule.sessionStatus` through the RAP relation and rejects `CONCLUDED`
   (and `CANCELLED`) for modern frozen **and** legacy RAPs before any update. A missing
   attempt relation fails closed. Modern frozen signing still requires
   `FOR_SIGNATURE`/`PARTIALLY_SIGNED` and still binds `signedContentHash` +
   `signedContentVersion`; own-slot authorization, the CAS, and the finalization recompute
   are unchanged.

Legacy compatibility is now **read-only**: historical notes, reports, provenance, and
signatures remain readable; none of the above writes are permitted after conclusion.

Verification: new `backend/tests/unit/services/cdw7-immutability.test.ts` (8 tests) plus
the updated workspace/CP7/acceptance fixtures; focused set **190 passed**; full backend
**140 files / 1573 passed / 5 skipped**; frontend verification unchanged at **189
assertions, 0 fail**. No schema change, no migration.
