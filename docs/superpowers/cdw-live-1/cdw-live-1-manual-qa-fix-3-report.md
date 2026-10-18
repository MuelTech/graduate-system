# CDW-LIVE-1 MANUAL-QA FIX-3 — Evaluator Signature + Formal Verdict + Committee Roster UX

- **Branch:** `refactor/collaborative-defense-workspace`
- **Starting HEAD:** `2bb48e7b874924d7fefc7e6a3883877d65e3b8e1`
- **Status:** **IMPLEMENTED (FIX-3A) - PENDING INDEPENDENT REVIEW**
- **Date:** 2026-10-18
- **Scope:** FIX-3 evaluator signature, Formal Verdict copy, Committee Roster affordance
- **Migration:** **NONE**
- **Academic workflow change:** **NONE**

This package does not mark itself ACCEPTED and does not start CDW-9.

---

## 1. Individual evaluation signature — draw-only

The official individual form is **Signature over Printed Name of Panelist**. The evaluator
now supplies only a drawn signature; the printed name remains system-derived for eventual
official-form rendering and is intentionally not shown or re-entered in the signing modal.

Changes:

- `ESignaturePad` gained a bounded `allowTyped` prop (default `true`).
- The evaluation finalization dialog passes `allowTyped={false}`.
- In draw-only mode the pad renders the large canvas, a “Draw your signature” label, and
  **Clear**; no Type tab and no typed-name input exist.
- Existing FIX-2 canvas behavior remains: 720×240 intrinsic surface, responsive display,
  rendered-to-intrinsic pointer scaling, `touch-none`, accessible draw label, PNG data-URL
  evidence.
- Back/Cancel/close clears the transient signature; only Confirm Finalize submits it.

Other signing flows (for example RAP signatures) continue to use the shared component with
its default Type/Draw modes unchanged.

## 2. Authoritative printed evaluator name

No free-text name field was added.

**FIX-3A update:** the visible printed-name copy and the temporary
`myAssignment.name` read-model plumbing were removed because the signing modal does not
need to display or re-enter the printed name. The authoritative assignment/roster remains
the identity source for eventual official-form rendering.

- The frontend passes no evaluator-name copy into the signing dialog.
- The dialog shows only the draw canvas, Clear, and the explicit signing action.
- No client-supplied printed name is accepted as identity authority.
- No schema, migration, or second identity source was added.

## 3. Formal Verdict — faculty-facing readiness

The Chairman card now shows exactly two readiness rows:

```text
Formal Verdict

✓ Evaluation Signatures — 5 of 5 completed
○ Committee Report Signatures — 3 of 6 completed
```

Before report signature slots exist:

```text
○ Committee Report Signatures - Waiting for report
```

No `0 of 0` is rendered. The technical rows were removed from the faculty UI:

- Oral Examination Summary ready
- Committee Report frozen
- RAP finalized
- “Unavailable until the Committee Report is finalized.”

The backend gates are unchanged. The formal-result selector and Record Formal Verdict
action still render only inside `data.readyForConclusion === true`. Verdict values remain
PASSED / Re-defense Required via the existing explicit confirmation flow; scores never
auto-decide the verdict.

## 4. Committee Roster affordance

The native `details`/`summary` remains. The summary now has a right-aligned `ChevronDown`
that rotates 180° with `group-open:rotate-180`, uses a restrained transition, and respects
`motion-reduce`. The entire summary remains clickable and keyboard/native accessible.

## 5. FIX-2 behavior preserved

- No evaluator Save now.
- Private evaluation DRAFT autosave and server-confirmed states.
- Review & Finalize opens the centered shared Dialog.
- Step 1 review; Step 2 signing.
- No inline signature block in the role rail.
- Natural-height evaluation card; no sticky footer.
- RoleRail remains the scroll container with non-shrinking stacked sections.
- Evaluation Completion, Formal Verdict, concluded result, and Committee Roster remain
  separate cards in order.
- `flushAndWait()` remains before the finalize POST; failed flush blocks finalize.
- Duplicate-submit protection and finalized locking remain.
- Chairman and Panelist share the same evaluator flow.

## 6. Files changed

Frontend production:

- `frontend/src/components/defense-workspace/e-signature-pad.tsx`
- `frontend/src/components/defense-workspace/evaluation-finalization-dialog.tsx`
- `frontend/src/components/defense-workspace/oral-evaluation-form.tsx`
- `frontend/src/components/defense-workspace/chairman-verdict-panel.tsx`
- `frontend/src/components/defense-workspace/role-rail.tsx`
- `frontend/src/types/defense-workspace.ts`

Backend read model:

- `backend/src/services/defense-workspace.service.ts` — **FIX-3A removed** the temporary
  `myAssignment.name` read-model field and related plumbing; printed identity remains
  system-derived for eventual official-form rendering.

Tests/verification:

- `frontend/scripts/verify-cdw-live-1-manual-qa-fix-3.mjs` (new)
- `frontend/scripts/verify-cdw-live-1-manual-qa-fix-2.mjs` (prop plumbing expectation)
- `frontend/scripts/verify-rap-c1.mjs` (old technical-copy assertion updated)
- `backend/tests/unit/services/defense-workspace.service.test.ts` (printed-name read model)

Documentation:

- `docs/superpowers/cdw-live-1/cdw-live-1-manual-qa-fix-3-signature-verdict-roster-ux-design.md`
  (status only)
- `docs/superpowers/cdw-live-1/cdw-live-1-manual-qa-fix-3-report.md` (this report)

## 7. Verification

| Check | Result |
|---|---|
| New `verify-cdw-live-1-manual-qa-fix-3.mjs` | **17 passed / 0 failed** |
| FIX-2 verifier | **20 passed / 0 failed** |
| CDW-LIVE-1B verifier | **24 passed / 0 failed** |
| CDW-LIVE-1C verifier | **31 passed / 0 failed** |
| CDW-4 matrix / workspace | **19 / 9 passed / 0 failed** |
| RAP-C1 verifier | **13 passed / 0 failed** |
| All frontend verification scripts (18) | **382 passed / 0 failed** |
| Backend workspace focused test | **24 passed / 0 failed** |
| Full backend suite | **157 files / 1831 passed / 5 skipped / 0 failed** |
| Backend build | **pass** |
| `npx tsc --noEmit` | **clean** |
| Scoped `npx eslint` | **clean** (one pre-existing `<img>` warning) |
| Frontend production build | **pass** |
| `npx prisma validate` | **valid** |
| New migration | **NONE** |
| `git diff --check` | **clean** |

## 8. Manual QA

**NOT EXECUTED — ENVIRONMENT LIMITATION** for both Panelist and Chairman browser flows,
and therefore for the Formal Verdict UI. No manual PASS is claimed. Automated/source
verification and the production build passed; live-defense browser QA remains user-owned.

## 9. Remaining limitations

- Hard browser unload/refresh/crash can still lose never-saved local changes.
- No persistent local draft/signature recovery.
- Evaluation multi-tab CAS remains unavailable.
- Manual Panelist/Chairman/verdict browser QA remains user-owned.
- Official PDF/form rendering remains out of scope.

## 10. Confirmations

- No backend academic authority expansion; only the exact assignment name was exposed in
  the existing read model.
- No evaluation draft realtime event, score broadcast, or signature autosave.
- No schema/migration change.
- No CDW-9 work.

**Recommendation: READY FOR INDEPENDENT REVIEW.**
