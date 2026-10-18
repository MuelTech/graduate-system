# CDW-LIVE-1 MANUAL-QA FIX-2 — Evaluation Finalization UX + Chairman Rail Layout

- **Branch:** `refactor/collaborative-defense-workspace`
- **Starting HEAD:** `07aaf41bc67ab11c8edde836f249ad7e50a8779e`
- **Status:** **IMPLEMENTED — PENDING INDEPENDENT REVIEW**
- **Date:** 2026-10-18
- **Scope:** evaluation finalization UX + Chairman role-rail layout only
- **Migration:** **NONE**
- **Backend production changes:** **NONE**

This package does not mark itself ACCEPTED and does not start CDW-9.

---

## 1. Root cause of the rail overlap/crowding

The evaluator card combined three layout behaviors inside an already-scrollable flex column:

1. the card root used `flex min-h-0 flex-col`;
2. the content area used `min-h-0 flex-1`;
3. the action footer used `sticky bottom-0`.

Inside the RoleRail scroll container, that allowed the card to compress and let the sticky
footer float over the following Chairman cards. The inline Review/Signature block also
expanded the card significantly.

## 2. Layout correction

- Removed the evaluator `flex`/`min-h-0`/`flex-1` sizing so the card has natural height.
- Replaced the sticky footer with a normal-flow action row.
- RoleRail remains the single vertical scroll container.
- Added `[&>*]:shrink-0` to the RoleRail scroll container so stacked cards cannot be
  compressed into overlapping sections.
- Chairman stack remains, in order:
  1. My Evaluation
  2. Evaluation Completion
  3. Formal Verdict
  4. read-only concluded result when present
  5. Committee Roster
- No absolute/floating signature panel, no magic fixed heights, no z-index workaround.
- Opening the modal is portaled by the shared Dialog primitive and does not resize the rail.

## 3. Removed evaluator Save now

- The individual evaluation form no longer renders a manual **Save now** button.
- Autosave remains unchanged: 2 s debounce, 10 s maximum window, serialized requests,
  newest-state follow-up, offline/reconnect, unmount draining.
- Concise status remains: `Not saved yet`, `Unsaved changes`, `Saving…`, `Saved`,
  `Offline — changes not saved`, `Save failed`.
- `Saved` still requires server confirmation.
- The Rapporteur Committee Report Save now/flush behavior was not changed.

## 4. Finalization UX

The editable card now ends with a compact normal-flow row:

```text
[ Review & Finalize ]                    ✓ Saved
```

Clicking **Review & Finalize** opens the shared Dialog primitive in a centered two-step
flow.

### Step 1 — Review Evaluation

- Group I criteria and selected institutional ratings.
- Group II criteria and selected ratings.
- Group I Average and Group II Average.
- Recommendations.
- Incomplete warning when not all nine criteria are selected.
- Actions: **Cancel**, **Continue to Sign**.
- Continue is disabled while incomplete.
- No Overall/Rating formula was invented.

### Step 2 — Sign Your Evaluation

- Existing Type / Draw / Clear signature experience.
- Large signature surface, responsive width, internally scrollable dialog.
- Irreversible-action explanation.
- Actions: **Back**, **Confirm Finalize**.
- Back returns to Step 1 and clears the transient signature.
- Cancel/close clears transient signature and does not finalize.
- Only **Confirm Finalize** calls the existing finalize mutation.

The modal uses `frontend/src/components/ui/dialog.tsx` (no parallel modal framework).

## 5. Signature canvas

- Draw canvas intrinsic size increased from 360×120 to **720×240**, displayed responsively
  with preserved aspect ratio and `touch-none`.
- Pointer-coordinate translation now scales from the rendered rectangle to intrinsic
  canvas coordinates:

```ts
canvasX = (clientX - rect.left) * (canvas.width / rect.width)
canvasY = (clientY - rect.top) * (canvas.height / rect.height)
```

- Type and Draw still emit PNG data-URL evidence through the existing contract.
- Accessible labels added for typed and drawn signatures.
- No signature autosave or persistent signature storage.

## 6. Autosave → finalize boundary

The existing accepted CDW-LIVE-1B boundary is preserved:

1. Confirm Finalize starts the existing finalize mutation.
2. The mutation calls `controller.flushAndWait()`.
3. If the newest draft cannot be server-confirmed, it throws and never calls the finalize
   endpoint; the dialog remains open with an accessible error.
4. Only after successful convergence does it POST to
   `/thesis/defense/:scheduleId/evaluation/finalize`.
5. Duplicate Confirm Finalize is blocked by `confirmingRef` and the pending mutation state.

No second draft-save path was added.

## 7. Finalized state and Chairman separation

- Successful finalize closes the dialog and invalidates the evaluation + workspace queries.
- The form becomes read-only/locked and shows a compact state:

```text
✓ Evaluation finalized
Signed <authoritative timestamp>
```

- Chairman and Panelist use the same `OralEvaluationForm` and finalization dialog.
- Chairman **Formal Verdict** remains a separate RoleRail card and is never inside the
  evaluation modal or automatically triggered by finalization.
- Evaluation Completion remains status-only and never exposes another evaluator's private
  values.

## 8. Files changed

- `frontend/src/components/defense-workspace/oral-evaluation-form.tsx`
- `frontend/src/components/defense-workspace/evaluation-finalization-dialog.tsx` (new)
- `frontend/src/components/defense-workspace/e-signature-pad.tsx`
- `frontend/src/components/defense-workspace/role-rail.tsx`
- `frontend/scripts/verify-cdw-live-1-manual-qa-fix-2.mjs` (new)
- `frontend/scripts/verify-cdw4-matrix.mjs` (updated old sticky/Save-now expectation)
- `frontend/scripts/verify-cdw-live-1b-evaluation.mjs` (updated Save-now expectation)
- `frontend/scripts/verify-cdw-live-1c-acceptance.mjs` (updated finalize payload assertion)
- `docs/superpowers/cdw-live-1/cdw-live-1-manual-qa-fix-2-evaluation-finalization-ux-design.md`
  (status only)
- `docs/superpowers/cdw-live-1/cdw-live-1-manual-qa-fix-2-report.md` (this report)

No backend or Prisma file changed.

## 9. Verification

| Check | Result |
|---|---|
| New `verify-cdw-live-1-manual-qa-fix-2.mjs` | **20 passed / 0 failed** |
| CDW-LIVE-1A verifier | **42 passed / 0 failed** |
| CDW-LIVE-1B verifier | **24 passed / 0 failed** |
| CDW-LIVE-1C verifier | **31 passed / 0 failed** |
| CDW-LIVE-1 manual-QA FIX-1 verifier | **13 passed / 0 failed** |
| CDW-4 matrix verifier | **19 passed / 0 failed** |
| CDW-4 workspace verifier | **9 passed / 0 failed** |
| All frontend verification scripts (17) | **365 passed / 0 failed** |
| `npx tsc --noEmit` | **clean** |
| Scoped `npx eslint` | **clean** |
| Frontend production build | **pass** |
| `npx prisma validate` | **valid** |
| New migration | **NONE** |
| `git diff --check` | **clean** |

## 10. Manual QA

**NOT EXECUTED — ENVIRONMENT LIMITATION.**

Independent authenticated Chairman/Panelist sessions with a live defense were not
available in this environment. No manual browser PASS is claimed. Automated source/contract
verification and the production build passed; manual Panelist and Chairman QA remain
user-owned.

## 11. Remaining limitations

- Hard browser unload/refresh/crash can still lose never-saved local changes.
- No persistent local draft/signature recovery.
- Evaluation multi-tab CAS remains unavailable.
- Preview/realtime best-effort behavior is unchanged.
- Full multi-user/manual QA remains user-owned.

## 12. Confirmations

- No backend academic authority expansion.
- No evaluation draft realtime event.
- No signature autosave or automatic finalization.
- No report authority or report preview regression.
- No schema/migration change.
- No CDW-9 work.

**Recommendation: READY FOR INDEPENDENT REVIEW.**
