# Landing Page — Automatic Carousel Follow-Up

**Date:** 2026-11-10 (Asia/Singapore)
**Branch:** `feat/landing-page-redesign`
**Verified local/live starting HEAD:** `7b33a9f161776186a8cec924729411f45c3c4dda`
**Verified main at start:** `045316540d97364214792c7d441ae20a1e426d4c`
**Status:** Bounded owner-requested carousel correction; Refinement 2 has not begun.

## Request and resulting behavior

The owner requested removal of the circled numeric/Play UI and automatic animated rotation. The visible counter and Play words had already been removed in the [preceding cleanup](2026-11-10-landing-page-public-copy-cleanup.md), but an icon remained, mobile defaulted to manual navigation, and arrows/dots permanently paused rotation until the playback control was used. This package corrects those behavior gaps rather than treating the task as another label change.

- Autoplay now starts by default on desktop, tablet and mobile, with the existing approximately eight-second interval and gentle fade. No Play action is needed to start.
- Ordinary navigation presents only the edge arrows and slide indicators, with no numeric counter, Play text or playback icon.
- Selecting another slide through an arrow or indicator resets its timer. Automatic rotation resumes without a separate Play action after temporary interaction ends. A deliberate accessibility pause remains respected until explicitly resumed.
- Resting the mouse over plain hero imagery/text does not suspend playback. Hover over an actionable link/button temporarily pauses rotation so the target stays clickable. Pointer-type checks keep touch taps from leaving a synthetic mouse-hover pause stuck on mobile.
- Keyboard interaction/focus, offscreen position, hidden-document state and reduced-motion preferences retain their safeguards. A keyboard-focus-only Pause/Resume control remains available and becomes visible when focused; it is absent from the normal visual controls. Automatic slide changes remain silent to screen readers, while manual changes retain their status message and focus.
- The other photographic slide loads eagerly so its image is ready before automatic rotation reaches it. No image, data source, institutional copy, route or service changes.

This owner instruction supersedes the earlier mobile-manual default, persistent pause after manual navigation, and visible playback treatment recorded in the [original refinement plan](../plans/2026-11-09-landing-page-refinement.md) and earlier reports. Those records remain unchanged history. Existing content/provenance and protected-work boundaries continue to apply.

## Exact scope

1. `frontend/src/components/landing/announcements-section.tsx` — default autoplay at every width, fresh timing after slide selection, touch-safe interaction suspension, eager photo loading and focus-only pause/resume.
2. `frontend/src/app/(public)/public-site.css` — remove the playback-icon styling and style only the keyboard-focus pause/resume affordance; retain normal arrows/indicators and existing hero composition.
3. `frontend/scripts/verify-landing-refinement.mjs` — update expected autoplay behavior and verify touch navigation resumes automatically, keyboard pause/resume, and absence of the previous visible playback control.
4. `docs/superpowers/reports/2026-11-10-landing-page-autoplay-follow-up.md` — this isolated follow-up report.

## Verification and evidence

- TypeScript and scoped ESLint on the changed module/verifier: PASS.
- Focused Playwright verifier: seven regression groups PASS, covering desktop autoplay over plain hero content, action-hover suspension, keyboard pause, automatic continuation after manual navigation, mobile autoplay and touch taps, image loading, reduced motion, offscreen/visibility suspension, 320px reflow, catalog preservation and shared-shell navigation. No uncaught page error or data-mutating request observed in these guest-only checks.
- Real elapsed-time browser observation, without a virtual clock or navigation clicks: slides 1 → 2 → 3 appeared at approximately 0.04s, 7.5s and 15.6s after initial loading completed, with the pointer over plain hero content. No visible counter, playback text or playback icon was present. The source timer remains 8,000ms; timing begins before the load-completion observation timestamp.
- Rendered checks at 1440/820/390/320px confirmed no horizontal overflow, no old control text/counter, and the accessibility toggle clipped in its normal unfocused state. Existing preview/sample/caption copy remains absent from Home.
- Exact scope, whitespace and report-relative links checked before commit. This existing client-component behavior change does not add routing, dependencies or client/server boundaries; no production build or unrelated suite was repeated. Earlier build evidence remains in the preceding report. Local checks are not hosted CI or owner visual acceptance.

Session-local evidence: `C:/Users/admin/.codex/visualizations/2026/11/08/01a1bc0e-5506-7332-aa62-5fe2fb8400e2/autoplay-live-review.json`, `autoplay-live-slide*.png`, and `autoplay-ui-*.png`. Browser checks used the existing local frontend and installed Edge. Virtual-clock and controlled document-visibility simulation in the focused verifier are separate from the real elapsed-time observation.

## Protected work and stop

No other Home section, dedicated public page, login/registration page or workflow, auth/session, backend/API, Prisma/database, production data, RepositoryBrowser/functionality, chatbot, runtime asset, dependency/configuration, Faculty/Admin document/work, shared checklist, approved plan, previous report or unrelated canonical document changed. No seed, migration, deployment, merge to main or branch change.

Publish only this bounded correction to the existing feature branch and stop for owner review. Production content/integration dependencies and the separate Repository operational-verification workstream remain documented in prior reports; this task does not start them.
