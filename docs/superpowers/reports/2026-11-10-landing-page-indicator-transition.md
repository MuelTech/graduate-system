# Landing Page — Carousel Indicator Transition

**Date:** 2026-11-10 (Asia/Singapore)
**Branch:** `feat/landing-page-redesign`
**Verified local/live starting HEAD:** `0f7962f8cc0567c4afb0b14e528989d62b1fdf46`
**Verified main:** `045316540d97364214792c7d441ae20a1e426d4c`
**Status:** Owner-requested indicator refinement, awaiting rendered acceptance. Refinement 2 has not begun.

The owner circled the carousel indicators (also called pagination dots) and asked for smoother behavior. Their active state previously switched immediately between an 8px dot and a 28px gold pill.

## Change

- Animate marker width with the existing slide duration/easing: 900ms, `cubic-bezier(0.45, 0, 0.2, 1)`. The previous active marker contracts while the new one expands.
- Blend background and border colors over the same duration. The existing 44px button targets stay stationary throughout.
- Disable indicator transitions under reduced motion, matching the existing immediate slide selection behavior.
- Change only `frontend/src/app/(public)/public-site.css` and this isolated report. Existing slide movement, autoplay, selection state, markup, arrows, content, routes and other sections remain unchanged.

## Validation

- Targeted browser checks at 1440, 390 and 320px sampled native indicator transitions at 0%, 25%, 50%, 75% and 100%. Marker widths changed monotonically from `[28, 8, 8]` to `[8, 28, 8]`, with intermediate widths `[12.75, 23.234375, 8]` at 50%. All transition durations were 900ms.
- Button bounds stayed identical through all samples, with at least 44 × 44px targets. Reduced motion produced immediate `[8, 8, 28]` selection and zero transition duration. No uncaught browser errors were observed.
- Existing focused Playwright verifier: eight regression groups PASS, including slide continuity/wrap/rapid navigation, autoplay, touch, keyboard, reduced motion, reflow and shared-shell route checks.
- `git diff --check`: PASS. No new persistent test was added for this small CSS refinement. No TypeScript, dependencies or client/server boundaries changed; typechecking and a production build were not repeated. Local checks do not establish frame-rate guarantees, hosted CI or owner visual acceptance.

## Protected work

No changes to Faculty/Admin work or documentation, shared checklists, existing plans/reports, login/registration pages or workflows, chatbot, repository internals, backend/API/Prisma/database, dependencies, configuration or other public-page bodies. Normal feature-branch publication only; no deployment or merge. Stop for owner review.

The [horizontal slide transition report](2026-11-10-landing-page-horizontal-transition.md) remains the baseline for the slide movement itself.
