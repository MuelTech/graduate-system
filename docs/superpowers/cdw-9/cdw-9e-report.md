# CDW-9E — Accessibility, Keyboard, and Responsive Hardening

- **System:** EARIST Graduate School Information System (GS-IS)
- **Repository:** MuelTech/graduate-system
- **Branch:** `refactor/collaborative-defense-workspace`
- **Starting HEAD:** `6f6e7760e8081fea0adab1687028322d5a2a94b1`
- **Implementation commit:** `b5c751e1b777a44f2efe44b353ef6e814c7b4b3e`
- **FIX-1 commit:** `edb6f50995241b877476d3da53df7004a5a33db7`
- **FIX-2 commit:** `d10403fbdc0135d22fcc75cb0bf5f27697f66f05`
- **FIX-3 commit:** `1a119f6ca73ce46f979e57d47867943cd1721b0f`
- **FIX-4 commit:** `e4b24faf32eb7137351186f5bf323238382ab363`
- **FIX-5 commit:** `51e506cf244e30129614b7ed4c49f4e2e82f950b`
- **FIX-6 commit:** `cfcf5c1149f6e938ab38eeb4894fedbbd64407bc`
- **FIX-7 commit:** `8b04ef339b2d38d36cb307dd1f988105ccdc7468`
- **FIX-7 verifier reconciliation:** `4947ce0790ed7a558858d01afeab230d7324293c`
- **FIX-8 commit:** `6874fc154f9ee1dcd3a6dab949c870408c32eb35`
- **Status:** ACCEPTED / CLOSED with bounded post-acceptance desktop selection dismissal FIX-8 pending owner retest
- **Date:** 2026-10-19
- **Backend change:** NONE
- **Schema/migration:** NONE
- **Realtime protocol:** NONE
- **Targeted CDW-9E Manual Accessibility/Responsive QA:** NOT EXECUTED
- **Hosted CI:** NOT OBSERVED / NOT CLAIMED
- **CDW-9F:** NEXT / AUTHORIZED — NOT YET IMPLEMENTED

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

CDW-9E FIX-1 remains independently reviewed; final package acceptance is recorded below.

## 3B. FIX-2 — mobile anchored comment selection

Project-owner manual QA after CDW-9E acceptance found that phone users could
open the Defense Workspace but could not reliably create a new anchored comment
from manuscript text selection.

### Root cause

`manuscript-page.tsx` finalized candidate selection from the desktop `mouseup`
path. Native mobile text selection may complete through long-press + selection
handles without delivering that mouse event path, so the accepted anchor builder
was not reached reliably.

### Fix

- Extracted the existing anchor-building logic into one shared
  `processSelection()` path used by desktop and touch/mobile.
- Kept `mouseup` selection and collapsed-highlight hit-testing unchanged.
- Added touch/pointer mode and a debounced `selectionchange` completion path.
- The debounce waits for native selection handles to settle before creating one
  candidate anchor.
- Existing `removeAllRanges()` consumption remains, preventing duplicate
  candidate anchors from one completed selection.
- Read-only viewers still keep native selection/copy and do not create anchors or
  clear the selection.
- Event listeners and timers are cleaned up on unmount.

This is the same anchored-comment flow, not a new comment type or free-floating
comment feature.

### FIX-2 verification

- New FIX-2 mobile-selection verifier: **5 passed / 0 failed**.
- CDW-2 contracts + CDW-3 collaboration + FIX-2 verifiers: **40 passed / 0 failed**.
- Frontend TypeScript: **PASS**.
- Scoped ESLint for `manuscript-page.tsx`: **PASS**.
- Full frontend build: **NOT REQUIRED / NOT RUN**.
- Agent manual mobile QA: **NOT EXECUTED**.
- Project-owner phone retest remains pending:

  `phone/mobile viewport → long-press/select manuscript text → Add Comment composer appears → submit comment → comment appears in Shared Comments`

CDW-9E remains **ACCEPTED / CLOSED with bounded post-acceptance FIX-2 pending
owner mobile retest**.

## 3C. FIX-3 — native mobile selection pointer-cancel correction

FIX-2 automated checks passed, but actual project-owner phone QA still showed
that native text selection appeared while the Add Comment composer did not open.
The phone evidence confirmed that PDF rendering and the pdf.js text layer were
working; the failure was between native selection and the pending annotation
state.

### Root cause

On mobile, native long-press text selection can legitimately cancel the
originating pointer sequence:

```text
touch pointerdown
→ native long-press selection
→ pointercancel
→ selection handles appear
→ selectionchange
```

FIX-2 cleared the touch-selection mode on `pointercancel`, so the later
`selectionchange` was ignored before it could reach `processSelection()`.

### Fix

- Separate "pointer is active" from "native selection session is armed".
- `pointercancel` no longer disarms the mobile selection session; it re-arms the
  bounded session instead.
- `selectionchange` remains authoritative after touch initiation and schedules
  the same debounced `processSelection()` path.
- A 5-second bounded session timer disarms stale touch-selection state if no
  usable selection completes.
- Successful anchor creation clears the debounce/session timers, disarms the
  session, and consumes the browser selection as before.
- Unmount clears listeners and both timers.
- Desktop mouse selection, read-only selection/copy, collapsed highlight
  hit-testing, and the single shared `buildAnchor()` path are unchanged.

### FIX-3 verification

- Focused mobile-selection verifier: **6 passed / 0 failed**, including the
  explicit `pointerdown(touch) → pointercancel → selectionchange →
  processSelection()` contract.
- CDW-2 contracts + CDW-3 collaboration + mobile-selection verifiers:
  **41 passed / 0 failed**.
- Frontend TypeScript: **PASS**.
- Scoped ESLint for `manuscript-page.tsx`: **PASS**.
- Full frontend build: **NOT REQUIRED / NOT RUN**.
- Agent real-phone QA: **NOT EXECUTED**.
- Project-owner phone retest remains pending:

  `phone → open Student Document → long-press/select manuscript text → native selection appears → Add Comment composer appears → type comment → submit → comment appears in Shared Comments`

CDW-9E remains **ACCEPTED / CLOSED with bounded post-acceptance mobile comment
fix pending owner retest**.

## 3D. FIX-4 — mobile anchored comment action UX

FIX-3 restored mobile anchored selection, but project-owner phone QA found the
interaction hard to discover: the native selection highlight disappeared, the
Comments drawer did not open, and there was little visible confirmation that the
selected text had been captured.

### Fix

- The existing normalized `pendingAnchor` now drives a presentation-only draft
  highlight in the manuscript overlay.
- The draft highlight uses the existing anchor geometry and disappears whenever
  the pending anchor is replaced, cancelled, submitted, or no longer writable.
- On narrow/mobile layouts, a contextual **Add comment** button appears near the
  pending selection. It is clamped within the page so it stays usable near page
  edges.
- Tapping **Add comment** does not auto-open on selection and does not create an
  annotation. It:
  1. keeps the same pending anchor;
  2. ensures the rail view is `selected`;
  3. opens the existing mobile Shared Comments drawer.
- The existing `AnnotationCommentComposer` renders from the same pending anchor;
  persistence still happens only on composer submit.
- The existing drawer retains one-active-drawer state, focus trap, Escape,
  backdrop close, focus restoration, inert background, and left/right placement.
- Read-only viewers receive no pending anchor, draft highlight, or contextual
  action.
- No backend, API, annotation model, permissions, or realtime behavior changed.

### FIX-4 verification

- Mobile-selection verifier: **9 passed / 0 failed**.
- CDW-3 collaboration + CDW-4 workspace + mobile-selection verifiers:
  **42 passed / 0 failed**.
- Frontend TypeScript: **PASS**.
- Scoped ESLint for changed source: **PASS**.
- Full frontend build: **NOT REQUIRED / NOT RUN**.
- Agent real-phone QA: **NOT EXECUTED**.
- Project-owner phone retest remains pending:

  `phone → long-press/select manuscript text → temporary selected-text highlight remains visible → Add comment contextual button appears → tap Add comment → Shared Comments drawer opens → Selected tab / Add Comment composer visible → type comment → submit → persisted comment/highlight appears`

  Cancel path to verify:

  `select text → tap Cancel in composer → pending highlight/action disappear`

CDW-9E remains **ACCEPTED / CLOSED with bounded post-acceptance mobile comment
UX refinement pending owner retest**.

## 3E. FIX-5 — adjustable native mobile selection before comment finalization

Project-owner real-phone QA after FIX-4 found a regression in the mobile selection
lifecycle: the first selected word/paragraph was converted to a pending anchor too
quickly, the browser selection was consumed, and the native selection handles could
no longer be dragged to expand/shrink or dismiss the range naturally.

### Root cause

FIX-4 still reused the FIX-3 completion behavior that called
`processSelection()` after a 180 ms settled-selection debounce. That path called
`selection.removeAllRanges()`, so the first usable mobile range became final before
the user had finished adjusting the native handles. A synthesized compatibility
`mouseup` could also reach the immediate desktop-consume path.

### Fix

- `processSelection(consumeSelection)` remains the single anchor-geometry path.
- Desktop keeps `consumeSelection=true` and retains the accepted immediate
  mouse-selection behavior.
- Mobile settled selection now calls `processSelection(false)`: it updates the
  existing presentation-only `pendingAnchor` preview without consuming the native
  browser range.
- Once a valid mobile preview exists, the touch-selection session stays alive while
  the user adjusts native handles; later `selectionchange` events replace the draft
  anchor/highlight with the latest selected range.
- Compatibility `mouseup` is ignored while an active touch selection is
  non-collapsed, preventing accidental early consumption.
- If the native selection is dismissed/collapsed before committing, the pending
  draft is cleared through the existing collaboration cancel path.
- The contextual **Add comment** action is now the explicit mobile commit point:
  it disarms touch tracking, consumes the native selection, preserves the latest
  pending anchor, and then opens the existing Shared Comments drawer/composer.
- Read-only native selection/copy remains non-destructive.
- No backend, schema, API, annotation model, permission, realtime, or academic
  workflow behavior changed.

### FIX-5 evidence/status

- Remote product commit:
  `51e506cf244e30129614b7ed4c49f4e2e82f950b`.
- Independent connector source/diff review: **PASS** for the bounded selection
  lifecycle change and scope boundary.
- Focused mobile-selection source-contract verifier was updated to cover:
  adjustable preview without consumption, explicit Add comment finalization,
  cancellation on collapsed native selection, callback wiring, and synthesized
  mouseup protection.
- Automated verifier execution in this ChatGPT connector-only session:
  **NOT EXECUTED**.
- Frontend TypeScript / scoped ESLint in this ChatGPT connector-only session:
  **NOT EXECUTED**.
- Full frontend build: **NOT RUN / NOT REQUIRED by scope**.
- Project-owner real-phone FIX-5 retest: **PENDING**.

Owner acceptance flow:

`phone → long-press/select text → drag native handles to expand/shrink → pending highlight/button follows latest range → tap elsewhere cancels draft OR tap Add comment → Shared Comments drawer opens with latest selection → submit comment`

CDW-9E remains **ACCEPTED / CLOSED with bounded post-acceptance mobile selection
UX FIX-5 pending owner retest**.

## 3F. FIX-6 — stable mobile Add comment action placement

Project-owner real-phone QA after FIX-5 confirmed that native selection handles were
adjustable again, but the contextual **Add comment** action could be obscured by
Android/browser's native text-selection action menu because both were positioned
near the selected text.

### Fix

- Native browser text selection, handles, and action menu remain untouched.
- The pending draft highlight and FIX-5 adjustable selection lifecycle remain
  unchanged.
- Removed selection-relative Add comment positioning and its page-geometry
  clamping.
- The mobile-only **Add comment** action now uses a stable bottom-center fixed
  position in the visible viewport with safe-area-aware bottom spacing.
- The action remains visible only while a current-page pending anchor exists and
  continues to use the same explicit commit behavior:
  consume the native selection, preserve the latest pending anchor, then open the
  existing Shared Comments drawer/composer.
- Desktop behavior is unchanged because the action remains `lg:hidden`.
- No backend, schema, API, annotation model, permissions, realtime, or academic
  workflow behavior changed.

### FIX-6 evidence/status

- Remote product commit:
  `cfcf5c1149f6e938ab38eeb4894fedbbd64407bc`.
- Independent connector source/diff review: **PASS**; changed product scope is only
  `manuscript-page.tsx` plus the focused source-contract verifier.
- Focused verifier source was extended to require stable bottom-center positioning
  and to reject the old selection-relative positioning helpers.
- Automated verifier execution in this ChatGPT connector-only session:
  **NOT EXECUTED**.
- Frontend TypeScript / scoped ESLint in this ChatGPT connector-only session:
  **NOT EXECUTED**.
- Full frontend build: **NOT RUN / NOT REQUIRED by scope**.
- Project-owner real-phone FIX-6 retest: **PENDING**.

Owner acceptance flow:

`phone → long-press/select text → native Android menu may appear → drag handles as needed → Add comment remains reachable at bottom-center → tap Add comment → Shared Comments drawer opens with latest selection → submit comment`

CDW-9E remains **ACCEPTED / CLOSED with bounded post-acceptance mobile comment
action FIX-6 pending owner retest**.

## 3G. FIX-7 — contextual Add comment placement with native-toolbar clearance

Project-owner real-phone QA after FIX-6 found that the viewport-bottom action was
reliably reachable but too detached from the selected manuscript text. The preferred
interaction is to keep **Add comment** contextual near the selection while avoiding
the Android/browser native text-selection action menu.

### Fix

- Reverted the FIX-6 viewport-bottom placement only; FIX-5 adjustable native
  selection behavior remains unchanged.
- The mobile-only **Add comment** action is again positioned relative to the
  current pending anchor geometry.
- Placement now prefers **below the last selected rect with a 64 px vertical
  clearance**, keeping the action visually tied to the selection while leaving
  room for the browser-controlled native selection toolbar/handles.
- If there is insufficient room below the manuscript page, the action falls back
  above the first selected rect with a larger 108 px clearance.
- Horizontal placement remains clamped inside the manuscript page.
- The action still appears only for a valid pending selection and still uses the
  existing explicit commit behavior: consume native selection, preserve the latest
  pending anchor, then open the existing Shared Comments drawer/composer.
- Desktop behavior remains unchanged because the action stays `lg:hidden`.
- No backend, schema, API, annotation model, permission, realtime, or academic
  workflow behavior changed.

### FIX-7 evidence/status

- Remote product commit:
  `8b04ef339b2d38d36cb307dd1f988105ccdc7468`.
- Focused verifier reconciliation:
  `4947ce0790ed7a558858d01afeab230d7324293c`.
- Independent connector source/diff review: **PASS** for the bounded positioning
  change; FIX-5 selection lifecycle was not modified.
- The focused source-contract verifier now requires the contextual 64 px
  below-selection clearance / 108 px above fallback and no longer carries the
  superseded FIX-6 bottom-fixed assertion.
- Automated verifier execution in this ChatGPT connector-only session:
  **NOT EXECUTED**.
- Frontend TypeScript / scoped ESLint in this ChatGPT connector-only session:
  **NOT EXECUTED**.
- Full frontend build: **NOT RUN / NOT REQUIRED by scope**.
- Project-owner real-phone FIX-7 retest: **PENDING**.

Owner acceptance flow:

`phone → long-press/select text → adjust handles → native Android menu may remain visible → Add comment appears near selection with safe spacing → tap Add comment → Shared Comments opens with latest selection → submit comment`

CDW-9E remains **ACCEPTED / CLOSED with bounded post-acceptance mobile comment
action FIX-7 pending owner retest**.

## 3H. FIX-8 — desktop pending-selection dismissal

Project-owner desktop QA found that after selecting manuscript text, the browser
selection was consumed into the existing pending annotation draft, but a later normal
left-click did not clear that pending draft/highlight. The selection therefore appeared
stuck even though the native browser range had already been removed.

### Fix

- Desktop `mouseup` now explicitly accepts only the primary/left mouse button.
- If the mouseup creates a new valid text range, the existing desktop
  `processSelection()` path remains unchanged.
- If there is no new range and an unsaved `pendingAnchor` exists, a normal
  left-click clears that draft through the existing
  `onCancelPendingSelection` callback.
- The same click then continues through stored-highlight hit-testing, so clicking an
  existing annotation can both dismiss the draft and open the stored thread.
- Right/middle mouse buttons do not trigger draft cancellation.
- Mobile FIX-5 adjustable native selection, FIX-7 mobile action placement, read-only
  selection/copy, and backend/domain behavior are unchanged.

### FIX-8 evidence/status

- Remote product commit:
  `6874fc154f9ee1dcd3a6dab949c870408c32eb35`.
- Independent connector source/diff review: **PASS** for the bounded desktop
  dismissal change and unchanged mobile paths.
- Focused source-contract verifier was extended to require:
  primary-button gating, cancellation after a collapsed/no-new-range click, and
  preservation of stored-highlight hit-testing.
- Automated verifier execution in this ChatGPT connector-only session:
  **NOT EXECUTED**.
- Frontend TypeScript / scoped ESLint in this ChatGPT connector-only session:
  **NOT EXECUTED**.
- Full frontend build: **NOT RUN / NOT REQUIRED by scope**.
- Project-owner desktop FIX-8 retest: **PENDING**.

Owner acceptance flow:

`desktop → drag/select manuscript text → pending highlight appears → left-click elsewhere → pending highlight/draft clears`

Stored highlight sanity:

`desktop → create pending selection → left-click an existing stored highlight → pending draft clears and stored comment thread opens`

CDW-9E remains **ACCEPTED / CLOSED with bounded post-acceptance desktop selection
dismissal FIX-8 pending owner retest**.

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
- Draw-only signing remains a documented accessibility limitation and does not imply WCAG conformance.


## 9. Independent Acceptance

**Independent remote source/diff review: PASS.**

Independent review of the initial CDW-9E implementation found two bounded mobile
drawer defects. FIX-1 at `edb6f50995241b877476d3da53df7004a5a33db7`
corrected both:

- the Comments drawer can no longer orphan the workspace when no current document
  exists;
- the left Actions drawer now renders on the left while the right Comments drawer
  remains on the right.

The final remote source preserves the accepted focus trap, Escape behavior,
background `inert` / `aria-hidden` isolation, focus restoration, dialog
semantics, responsive containment, reduced-motion handling, draw-only signature
policy, academic authority, autosave/concurrency behavior, realtime behavior, and
backend/schema boundaries.

Evidence classification remains explicit:

- initial agent-local CDW-9E verifier: **9 passed / 0 failed**;
- initial combined affected verifier suite: **155 passed / 0 failed**;
- FIX-1 agent-local CDW-9E verifier: **12 passed / 0 failed**;
- FIX-1 CDW-9E + CDW-4 focused verifiers: **20 passed / 0 failed**;
- frontend TypeScript and scoped lint: **PASS** as reported;
- project-owner local development-server/runtime sanity after FIX-1: **PASS**;
- Targeted CDW-9E Manual Accessibility/Responsive QA: **NOT EXECUTED**;
- hosted CI: **NOT OBSERVED / NOT CLAIMED**.

The local development-server sanity check is not represented as keyboard,
screen-reader, viewport, or WCAG QA. The draw-only signature surface remains not
fully keyboard-equivalent and no WCAG compliance claim is made.

Under the documented risk-based acceptance rule, the project owner accepts the
package without converting unexecuted manual accessibility checks into a PASS.

**CDW-9E is ACCEPTED / CLOSED. CDW-9F is NEXT / AUTHORIZED — NOT YET
IMPLEMENTED.**
