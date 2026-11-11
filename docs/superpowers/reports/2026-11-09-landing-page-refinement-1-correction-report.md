# Refinement 1 Correction — Full-Width Featured Hero

**Date:** 2026-11-09 (Asia/Singapore)
**Repository / branch:** `MuelTech/graduate-system` / `feat/landing-page-redesign`
**Verified local/live starting HEAD:** `72b8068d58baf92453bf37f9ae9cc8474b51c5d5`
**Verified main at start:** `045316540d97364214792c7d441ae20a1e426d4c`
**Status:** Same Refinement 1 package, revised after owner visual rejection. Correction implemented and locally verified; owner visual/copy acceptance remains pending. Refinement 2 has not begun.

## 1. Owner finding and corrected interpretation

The owner rejected the previous contained opening: photograph/story on the left, preview-list/account sidebar on the right, and separate institutional heading above. Although its functionality passed local checks, its composition did not follow the supplied PASUC reference structure. The implementation interpretation was the problem, not an instruction to preserve that layout.

The owner's newer screenshots and clarification supersede the earlier sidebar/list treatment in the [working plan](../plans/2026-11-09-landing-page-refinement.md) and [first Refinement 1 report](2026-11-09-landing-page-refinement-1-report.md). Those documents remain historical evidence; no acceptance is retroactively claimed or rewritten. The approved route/content/workflow boundaries continue to apply.

The corrected opening is one **full-width hero carousel immediately after the shared masthead/review notice**. The image or statement background, large headline, concise supporting copy, and relevant buttons form one slide composition. Desktop navigation arrows sit at the viewport edges; slide indicators sit at the bottom. No introductory content grid, separate news card, or preview/account sidebar remains.

## 2. Implemented correction

- The carousel spans the full viewport, outside the capped body frame. Its inner text aligns with the existing institutional content gutter. Desktop hero height responds to viewport height with content-safe limits; tablet/mobile retain a stable 760px minimum and natural content growth where needed.
- The Graduate School identity remains visible within the hero. The first photographic slide is labelled News & Announcements. A centered burgundy statement slide follows the newly supplied text-led reference; a second photographic slide introduces the existing Research Repository. The EARIST palette/font family and authentic masthead seal remain unchanged.
- All three are explicitly local sample features, not official news/events: Graduate study at EARIST; Registered in Pinnacle; Explore graduate research. No dates, events, statistics, program claims, or publication records were invented.
- Each slide contains real actions relevant to its subject. Programs uses `/#programs`; examination uses existing `/login`; local account creation uses existing `/register`; research uses existing `/repository`. No fake article or event destinations are added. The existing per-item sample label and page-level preview notice remain visible.
- Applicant guidance is now a compact band **after** the hero, with local account creation, the Pinnacle Applicant ID prerequisite, and the clearly external Pinnacle application link. No competing sidebar or duplicated large action panel remains.
- Previous carousel behavior is preserved: approximately eight-second desktop rotation, manual default below 900px, pause/play, hover/focus suspension, manual selection stopping autoplay until explicit resume, offscreen/visibility suspension, reduced-motion support, focus retention, and hidden-slide tab exclusion. Mobile controls reserve right-edge space for the unchanged chatbot launcher.
- The prior section order, removed Home FAQ/redundant links, Navbar/Footer, complete catalog, dedicated public pages, and other Home body sections remain as at the starting commit. This correction does not advance into Refinement 2.

## 3. Exact changed files

| Path | Change |
| --- | --- |
| `frontend/src/components/landing/hero-section.tsx` | Full-width carousel followed by compact applicant guidance; remove the contained introductory composition. |
| `frontend/src/components/landing/announcements-section.tsx` | Replace sidebar/card markup with full-bleed photo/statement slides, in-slide actions, edge arrows, and bottom indicators. Preserve playback logic. |
| `frontend/src/app/(public)/public-site.css` | Replace the previous Refinement 1 opening styles as a bounded block; do not layer another set of overrides over the rejected layout. |
| `frontend/scripts/verify-landing-refinement.mjs` | Adapt interaction/image checks to the corrected structure; add full-viewport geometry and absence-of-sidebar regressions. |
| `docs/superpowers/reports/2026-11-09-landing-page-refinement-1-correction-report.md` | This correction report. |

## 4. Verification and rendered evidence

- **PASS:** TypeScript and scoped ESLint on the two changed TSX files and the focused verifier.
- **PASS:** `node scripts/verify-landing-refinement.mjs`, all seven guest-only regression groups. Full-width geometry, a dominant hero height, absence of the old sidebar, and real actions inside the visible slide are now explicitly checked alongside the preserved playback, keyboard, reduced-motion, reflow, catalog and shared-shell checks.
- **PASS:** One final `next build` at the corrected source: compilation, framework TypeScript, and 68 generated static pages. Existing middleware deprecation warning remains unchanged.
- **PASS:** All three slides at 1920, 1440, 820, 390 and 320 CSS pixels: fifteen rendered cases with viewport-width hero geometry, one visible slide, one route H1, loaded selected photographs, no horizontal overflow, and no uncaught page errors. Screenshots were inspected against the supplied full-width photographic and centered-statement references. The 320px layout preserves a stable slide height and usable controls.
- **PASS:** Actual 200% browser zoom for all three corrected slides using the isolated Edge profile: browser zoom confirmed as 2, 708 CSS pixels in a 1440px outer window, DPR 2, visual viewport scale 1, no horizontal overflow; compact-menu Escape/focus return passed.
- **PASS:** Exact scope/protected-file review, report-relative links, and `git diff --check`; final staged/publication checks are performed before delivery.

Browser checks used the existing local development frontend and installed Microsoft Edge. The focused timing/visibility test methods and guest-only limits are unchanged from the first report: virtual clock for timer checks, actual scrolling for offscreen checks, controlled document-visibility simulation, no mocked Repository response/record/account, no data-mutating request or external message. These results are local evidence, not hosted CI or owner visual approval.

Current screenshots/data are session-local under `C:/Users/admin/.codex/visualizations/2026/11/08/01a1bc0e-5506-7332-aa62-5fe2fb8400e2`: `correction-final-<width>-slide<1|2|3>.png`, `correction-responsive-review.json`, `correction-zoom200-slide*.png`, and `correction-zoom-review.json`. Final screenshots disable an in-progress finite transition for capture, showing its completed state. Earlier `correction-first`/`correction-centered` captures are intermediate, not final review images.

## 5. Assets, boundaries, and handoff

No image was downloaded, generated, re-encoded, or changed. Photo slides reuse `hero-campus-preview.webp` and `research-preview.webp`, with existing fictional-subject alt text and adjacent not-EARIST-photography captions; their dimensions/hashes/source remain in the unchanged [V2 provenance ledger](2026-11-08-landing-page-redesign-v2-assets.md). Images now cover the full hero and crop at 65% horizontal / 50% vertical. A burgundy scrim supports readable HTML text. The centered statement slide intentionally has no photograph. Existing About imagery below the hero is unchanged.

No backend/API/Prisma/database, authentication/session, login/registration page or workflow, portal, role, RepositoryBrowser/functionality, chatbot, runtime asset, dependency/configuration, unrelated page/body, shared checklist, Faculty/Admin documentation/work, approved plan, previous report, or other canonical-document change. No migration, seed, deployment, merge, force push, or branch change.

Approved real photography/news, confirmed contacts/platforms, inquiry delivery, and populated/authenticated Repository verification remain separate dependencies. The inherited expanded-chatbot 320px overflow remains outside this correction. Publish only this bounded correction to the existing feature branch, report the exact commit externally, and stop for owner review; do not begin Refinement 2 automatically.
