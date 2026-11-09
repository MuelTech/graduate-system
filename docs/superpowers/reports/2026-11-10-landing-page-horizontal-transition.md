# Landing Page — Smooth Horizontal Slide Transition

**Date:** 2026-11-10 (Asia/Singapore)
**Branch:** `feat/landing-page-redesign`
**Verified local/live starting HEAD:** `05d1b8caa41e1dcfc57fb18826b1dca5252b6e45`
**Verified main at start:** `045316540d97364214792c7d441ae20a1e426d4c`
**Status:** Bounded owner-requested motion refinement, awaiting rendered acceptance. Refinement 2 has not begun.

## Requested correction and behavior

The owner accepted the slide composition/autoplay but requested a smoother right-to-left transition. The previous implementation hid the old panel immediately and faded in the replacement over 320ms, so it did not create continuous horizontal travel.

- The departing and arriving panels now move together across the viewport over **900ms**, using the same easing curve and GPU-friendly transform animation. Their edges meet continuously; the image and HTML copy move as one composition rather than fading through an empty base background.
- Autoplay, Next and indicator selections bring the next panel in from the right and send the old panel off to the left. The Previous arrow reverses travel to match its direction.
- Last-to-first autoplay/Next transitions use the same forward motion. No cloned endpoint, long reverse track movement, or visible reset is needed.
- At most two panels are painted during motion. Only the active panel is available to assistive technology and keyboard interaction; the departing panel is inert and hidden from assistive technology. It is hidden visually after motion completes. Heading, controls and institutional identity remain stable outside the moving panels.
- Rapid navigation is coalesced to the latest requested destination and applied after the current movement finishes, preventing overlapping transitions and abrupt position resets. Focus remains on the control used.
- Animation completion normally settles the frame. A short fallback timeout also cleans up cancelled animations, hidden-tab interruptions and reduced-motion changes during motion. Reduced-motion navigation remains immediate.
- Existing eight-second autoplay, action-hover/keyboard pause behavior, touch-safe automatic continuation, focus-only pause/resume, controls, content, route destinations, image loading and public-copy cleanup remain unchanged.

## Exact changed files

1. `frontend/src/components/landing/announcements-section.tsx` — departing/active frame state, transition direction, queued navigation, completion cleanup and semantic active-panel handling.
2. `frontend/src/app/(public)/public-site.css` — paired horizontal transforms, 900ms timing shared from the component, temporary compositor hints and clipped viewport. Remove the old fade keyframe.
3. `frontend/scripts/verify-landing-refinement.mjs` — distinguish the single semantic active panel from the briefly painted outgoing panel; add motion, wrap, queue and cancellation regressions.
4. `docs/superpowers/reports/2026-11-10-landing-page-horizontal-transition.md` — this isolated follow-up report.

## Verification

- TypeScript and scoped ESLint on the changed module/verifier: PASS.
- Focused Playwright verifier: **eight regression groups PASS**. The added motion group samples native animation positions at multiple progress points, verifies adjoining panel edges, monotonic horizontal travel and constant opacity, then checks forward wrap, reversed Previous motion, rapid destination changes, mid-transition reduced motion and cancelled-animation recovery. Existing autoplay, touch, focus, reduced-motion, route, content, reflow and image checks remain passing.
- Natural browser motion was also sampled without a virtual clock or animation seeking at 1440, 390 and 320px during last-to-first navigation. Incoming X progressed from the viewport width to zero while outgoing X progressed to minus the viewport width; panel edges met within a fraction of a CSS pixel, no horizontal page overflow occurred, and the outgoing frame was cleaned up. No uncaught browser error was observed.
- Source/diff review and `git diff --check` verify the bounded scope. This existing client-component/CSS motion change adds no routing, dependencies or client/server boundary; no production build or unrelated suite was repeated. Local evidence is not hosted CI or owner visual acceptance.

Session-local evidence: `C:/Users/admin/.codex/visualizations/2026/11/08/01a1bc0e-5506-7332-aa62-5fe2fb8400e2/horizontal-motion-review.json`, `motion-mid-*.png` and `motion-settled-*.png`. Geometry checks establish continuity/direction; no frame-rate benchmark or all-device performance certification is claimed.

## Protected work and handoff

No other Home section, shared Navbar/Footer/layout, dedicated public page, backend/API/Prisma/database, auth/session, login/registration workflow/page, portal role, RepositoryBrowser/functionality, chatbot, runtime asset, catalog/contact data, dependency/configuration, Faculty/Admin document/work, shared checklist, approved plan, previous report or unrelated canonical document change. No migration, seed, deployment, merge or branch switch.

Publish only this bounded feature-branch correction and stop for owner review. The [autoplay follow-up](2026-11-10-landing-page-autoplay-follow-up.md), [public-copy cleanup](2026-11-10-landing-page-public-copy-cleanup.md) and inherited content/integration boundaries remain in force except for the fade treatment replaced here.
