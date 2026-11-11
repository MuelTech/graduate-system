# Landing Page — Visitor-Facing Copy Cleanup

**Date:** 2026-11-10 (Asia/Singapore)
**Branch:** `feat/landing-page-redesign`
**Verified local/live starting HEAD:** `ad1076e64d97154f6ff88fe6f385ef58f3f885d7`
**Verified main at start:** `045316540d97364214792c7d441ae20a1e426d4c`
**Status:** Bounded follow-up to Refinement 1, for owner review; not the start of Refinement 2.

## Owner correction and authority

The owner requested a production-facing landing design and explicitly rejected the public preview banner, sample-content notes, image-placeholder captions, numeric slide counter, and prominent Play text shown in the marked screenshot. The new instruction supersedes the earlier requirement to display those review labels in the [refinement plan](../plans/2026-11-09-landing-page-refinement.md) and previous V2/refinement reports. Those documents remain unchanged historical records.

Review status, imagery provenance, and production dependencies belong in feature documentation/code metadata. Removing visible review language does not approve the current imagery as genuine EARIST photography or establish operational production readiness. Existing truthful image alt text and recorded provenance remain unchanged; no fictional image is relabelled as a real EARIST location.

## Changes and exact scope

| File | Change |
| --- | --- |
| `frontend/src/app/(public)/layout.tsx` | Unmount the shared design-preview banner; retain the public shell, providers, skip link and chatbot. This shell change naturally appears on all public routes. |
| `frontend/src/components/landing/announcements-section.tsx` | Remove review/sample language, image captions, hidden review-note description, numeric counter and visible Play/Pause words. Preserve accurate accessible control labels and slide state. |
| `frontend/src/app/(public)/public-site.css` | Remove obsolete hero label/counter/caption rules; update the hero viewport-height allowance for the removed banner; group a 44px icon-only playback control with the slide indicators. |
| `frontend/src/components/landing/preview-image.tsx` | Add an optional caption-display prop, defaulting to the previous behavior for existing consumers. |
| `frontend/src/components/landing/about-section.tsx` | Omit the Home About image caption. |
| `frontend/src/components/landing/repository-section.tsx` | Omit the Home Research image caption. |
| `frontend/scripts/verify-landing-refinement.mjs` | Replace old visible-review-label assertions with absence checks; retain loaded-image and carousel behavior regressions. |
| `docs/superpowers/reports/2026-11-10-landing-page-public-copy-cleanup.md` | This isolated follow-up report. |

The hero now follows the Navbar directly. Arrows and slide indicators remain; the playback control is a small icon beside the indicators rather than a separate text action at the far edge. Autoplay, explicit pause/resume, hover/focus suspension, keyboard behavior, reduced-motion support, and hidden-slide handling remain unchanged. Numeric slide context remains available through accessible slide labels, without a visible counter.

The Home About/Research changes affect only their captions, not their content composition. The dedicated About page retains the image helper's previous caption behavior; its body is not redesigned by this Home cleanup. No image bytes, source metadata, catalog entries, institutional claims, contact details, article destinations, form behavior, or service integration change.

## Verification

- TypeScript and scoped ESLint on the five affected TSX files and verifier: PASS.
- Focused guest-only Playwright verifier: all seven regression groups PASS, including autoplay/manual pause/resume, focus, reduced motion, stable 320px reflow, existing route destinations, complete catalog, and shared public-shell navigation. No uncaught page error or data-mutating request observed during these checks.
- Rendered review at 1440, 820, 390 and 320px, all three slides: no visible preview/sample/placeholder copy, no counter/Play words, no horizontal overflow, and hero top flush with the masthead bottom. Selected photographs were awaited through image load/decode for final screenshots.
- Production build: PASS, including compilation, framework TypeScript and 68 generated static pages. It was checked because the shared public layout/helper rendering changed. The existing middleware deprecation warning remains; no unrelated backend suites, migrations, seeds or deployment.
- Exact changed-file scope, local report references and whitespace checked before commit; final publication/worktree state verified separately.

Local screenshots: `C:/Users/admin/.codex/visualizations/2026/11/08/01a1bc0e-5506-7332-aa62-5fe2fb8400e2/clean-ui-*.png`. These are session-local evidence, not hosted CI or owner visual acceptance. Image provenance remains in the unchanged [V2 ledger](2026-11-08-landing-page-redesign-v2-assets.md) and [hero correction report](2026-11-09-landing-page-refinement-1-correction-report.md).

## Protected work and handoff

No backend/API/Prisma/database, auth/session, login/registration pages or workflows, portal roles, RepositoryBrowser/functionality, chatbot content/behavior, dedicated page bodies, dependencies/configuration, production data, approved plan, existing report, Faculty/Admin documentation, shared checklist or unrelated canonical-document change. No merge to main or deployment. The inherited expanded-chatbot limitation remains outside scope.

Approved real photography/news, contact/platform confirmation, inquiry delivery and populated/authenticated Repository verification remain documentation-level production dependencies. Stop after this bounded feature-branch handoff for owner review; do not start other section redesigns automatically.
