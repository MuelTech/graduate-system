# CDW-9E — Accessibility, Keyboard, and Responsive Hardening

- **System:** EARIST Graduate School Information System (GS-IS)
- **Repository:** MuelTech/graduate-system
- **Branch:** `refactor/collaborative-defense-workspace`
- **Starting HEAD:** `6f6e7760e8081fea0adab1687028322d5a2a94b1`
- **Implementation commit:** `b5c751e1b777a44f2efe44b353ef6e814c7b4b3e`
- **FIX-1 commit:** `edb6f50995241b877476d3da53df7004a5a33db7`
- **Status:** IMPLEMENTED / PENDING INDEPENDENT REVIEW
- **Date:** 2026-10-19
- **Backend change:** NONE
- **Schema/migration:** NONE
- **Realtime protocol:** NONE
- **Targeted CDW-9E Manual Accessibility/Responsive QA:** NOT EXECUTED
- **Hosted CI:** NOT OBSERVED / NOT CLAIMED
- **CDW-9F:** PLANNED / NOT YET IMPLEMENTED — NOT STARTED

---

## 1. Audited surfaces

- Defense Workspace shell, mobile Actions/Comments drawers, center tabs, header
- Individual evaluation form and autosave/save-conflict states
- Evaluator finalization dialog and signature step
- Committee Report authoring, autosave, finalization, and signing dialog
- Shared Comments rail, annotation threads, reply/comment composer
- Role rail, Start Defense failure state, completion tracker, roster disclosure
- Chairman formal verdict readiness/action
- Collaborative manuscript viewer loading/error states
- Institutional evaluation matrix and shared Dialog/Tabs primitives

## 2. Concrete defects found

1. Mobile Actions/Comments overlays were custom fixed panels without focus
   movement, Escape handling, focus trapping, background inertness, or reliable
   focus restoration.
2. Center Committee Report / Student Document controls used pressed-button
   semantics rather than tab semantics and had no keyboard arrow behavior.
3. The draw-only signature canvas had no focus target, no programmatic
   instructions, and no live status announcing ready/cleared state.
4. Several autosave/offline/conflict/error states were communicated only by text
   and color, without `status`/`alert` semantics.
5. Comment validation errors were not associated with the textarea and were not
   announced.
6. Moving from Review Evaluation to Sign Your Evaluation could lose a useful
   keyboard focus position; Back had no explicit focus target.
7. Start Defense and formal-verdict failures were not programmatically announced.
8. Comment list selection and several custom controls lacked an explicit visible
   focus treatment.

## 3. Fixes made

### Mobile drawers

- One active drawer state; opening Actions or Comments closes the other.
- Background workspace is `inert` and `aria-hidden` while a drawer is open.
- Drawer is `role="dialog"`, `aria-modal="true"`, with a labelled title.
- Focus moves to the first drawer control (Close).
- Tab / Shift+Tab are trapped inside the drawer.
- Escape closes the drawer.
- Closing restores focus to the exact trigger control used to open it.
- Drawer width is capped at `max-w-[88vw]`; content uses `min-w-0` and
  `overflow-x-hidden`.
- Reduced-motion behavior remains `motion-reduce:animate-none`.

### Center tabs

- Added `tablist` / `tab` / `tabpanel` semantics with `aria-selected`,
  `aria-controls`, and `aria-labelledby`.
- Active tab is the only tab in the normal tab order.
- Left/Right/Home/End move selection and focus.
- Active state includes a text-only “(selected)” cue for assistive technology
  in addition to the visual border/color treatment.
- Panel receives a visible focus ring for keyboard context.

### Dialogs and focus

- Shared Base UI Dialog focus trap/restoration remains in use.
- Evaluator Review → Sign focuses the signature surface.
- Back to Review focuses Continue to Sign, or the criteria warning when
  Continue is unavailable.
- Committee Report signing focuses the signature surface on open.
- Pending irreversible actions still cannot be dismissed by Escape, close,
  Cancel, or backdrop while the mutation is in flight.
- Pending state is announced through a polite live status and `aria-busy`.
- Dialog errors remain `role="alert"`.

### Signature pad

- Canvas is focusable when enabled and has a visible focus ring.
- Added an explicit accessible name and instructions.
- Signature ready/cleared/invalid status is exposed as a polite live status.
- Clear remains a keyboard-operable button.
- Disabled state is exposed through the normal disabled controls and canvas
  `aria-disabled`.
- Typed signature support remains unchanged: both draw-only flows still use
  `allowTyped={false}`.

### Status and errors

- Evaluation and Committee Report autosave states use `role="status"` /
  `aria-live="polite"`; save/conflict failures use `role="alert"`.
- Start Defense, report finalization/signing, formal verdict, comment, and
  manuscript-loading errors are announced.
- Reload/Retry recovery actions remain ordinary keyboard-reachable buttons.
- Existing recovery wording and CDW-9A/9B concurrency behavior are unchanged.

### Comments

- Textarea has an explicit accessible label.
- Validation errors are associated through `aria-describedby` and `aria-invalid`
  and announced with `role="alert"`.
- Character count is programmatically associated but not a live region.
- Ctrl/Cmd+Enter submission behavior is unchanged.
- Comment list items remain buttons with `aria-pressed` and visible focus rings.

## 3A. FIX-1 — mobile drawer state and placement

Independent review of CDW-9E found two concrete mobile-drawer defects.

### Orphaned Comments drawer state

- The mobile Comments trigger is no longer rendered when `hasDocument` is false.
- The active drawer is derived so a right drawer cannot remain active without a
  current document.
- If document availability changes while the right drawer is stored open, the
  stored state is cleared so it cannot reappear later.
- The background becomes inert/`aria-hidden` only while an actual drawer is
  active; there is no orphaned modal state.

### Left Actions drawer placement

- The reusable drawer now renders its panel before the backdrop for the left
  Actions drawer, producing `[Actions panel][backdrop]`.
- The right Comments drawer keeps `[backdrop][Comments panel]`.
- The same drawer implementation is retained; focus trap, initial focus, Escape,
  backdrop close, focus restoration, dialog semantics, responsive widths, and
  reduced-motion handling are preserved.

### FIX-1 verification

- CDW-9E verifier: **12 passed / 0 failed**.
- CDW-9E + CDW-4 workspace verifiers: **20 passed / 0 failed**.
- Frontend TypeScript: **PASS**.
- Scoped ESLint for `workspace-shell.tsx`: **PASS**.
- Targeted CDW-9E Manual Accessibility/Responsive QA remains **NOT EXECUTED**.

CDW-9E remains **IMPLEMENTED / PENDING INDEPENDENT REVIEW**.

## 4. Responsive evidence

Source-level responsive checks were performed for:

- 320 px / 375 px narrow drawer width (`max-w-[88vw]`, `min-w-0`);
- 768 px drawer/center-pane containment;
- desktop rails unchanged at `lg` / `xl`;
- evaluation matrix retains `overflow-x-auto`;
- dialog content remains `max-h-[85vh] overflow-y-auto`;
- dialog footer remains column-reverse on narrow screens;
- header controls wrap;
- signature canvas remains `h-auto w-full`;
- Committee Report toolbar wraps;
- long error/status text uses wrapping where added.

No desktop layout redesign or breakpoint change was introduced.

## 5. Signature-pad accessibility result

The draw-only signature surface is **not fully keyboard-equivalent**.

A keyboard user can focus the canvas, hear its instructions/status, operate Clear,
and navigate the dialog. A keyboard user cannot produce drawn signature evidence.
Typed signatures remain intentionally disabled for evaluation and Committee
Report signing because current signing policy requires drawn evidence.

This remains a product/policy limitation requiring a separate explicit
institutional decision. No fake keyboard signature fallback was added.

## 6. Automated evidence

| Check | Result |
|---|---|
| New CDW-9E source-contract verifier | **9 passed / 0 failed** |
| Combined affected verifier suite | **155 passed / 0 failed** |
| Frontend `npx tsc --noEmit` | **PASS** |
| Scoped frontend ESLint | **0 errors** (one pre-existing `<img>` warning in signature preview) |
| Frontend production build | **PASS** |
| `git diff --check` | **clean** (line-ending notices only) |
| `git show --check` | **clean** |
| Backend tests | Not run — backend unchanged |
| Hosted CI | **NOT OBSERVED / NOT CLAIMED** |

The verifier is a source-contract test. It does not replace manual keyboard,
screen-reader, or viewport QA.

## 7. Manual QA

**Targeted CDW-9E Manual Accessibility/Responsive QA: NOT EXECUTED**

No keyboard-only browser pass, screen-reader pass, real mobile viewport pass, or
WCAG conformance test was executed. No WCAG compliance is claimed.

## 8. Remaining limitations

- Draw-only signature input is not keyboard-equivalent.
- Automated tests do not prove real screen-reader behavior.
- No manual focus-trap, Escape, restoration, narrow-viewport, or touch-target
  verification was executed.
- No WCAG audit or certification is claimed.
- CDW-9E remains pending independent review and is not marked accepted here.
