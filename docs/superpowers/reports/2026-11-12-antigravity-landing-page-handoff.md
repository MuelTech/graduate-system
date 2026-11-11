# EARIST GS-IS — Antigravity Landing Page Handoff

Prepared on **2026-11-12, Asia/Singapore**. This is a continuation brief for the owner's next Antigravity session. It does not define or authorize an unspecified new feature. No application source was changed while preparing this handoff.

## 1. Start here

- Workspace: `C:/Users/admin/Desktop/Project/graduate/graduate-system`
- Repository: `MuelTech/graduate-system`
- Origin: `git@github.com:MuelTech/graduate-system.git`
- Current branch: **`feat/landing-page-redesign`**
- Verified local and live feature code HEAD: **`c5c8e5d8022ebb42dd0e9d45d497284d9835fba7`**. A later documentation-only handoff commit may be on top of this code baseline.
- Worktree was clean before this new handoff file was created. Recheck it before doing work; preserve any subsequent owner changes.
- Remote `main` verified through connected GitHub today: **`b16e2e2ebc86e80fc3a30e6822e252eb9cb5c050`**. It has advanced since the earlier reports' `045316540d97364214792c7d441ae20a1e426d4c` baseline. Do not describe main as unchanged or automatically merge/rebase it. The intervening main changes were not reviewed in this handoff task.
- Preview used in previous sessions: `http://localhost:3000`. Check whether the existing frontend is still running before starting another server.

Use the existing local Next.js application. Do not replace it with a newly generated app, framework, hosted website, or generic template. The owner will describe the next feature in Antigravity; do not infer it from the remaining refinement plan.

## 2. Owner's intent and communication preferences

We are iteratively improving the **EARIST Graduate School landing page**. The owner wants a polished, production-facing design that feels intentional and institutional, without generic AI-looking decoration. Communicate in clear Taglish, explain concrete changes, implement a bounded feature, inspect the rendered result, and stop for owner review before moving to another package.

The owner provided PASUC screenshots as **composition references**: a large full-width hero carousel directly under the Navbar, substantial image or statement backgrounds, readable HTML headlines/copy, useful buttons, edge arrows and bottom indicators. Adapt the structure to EARIST's existing identity; do not copy PASUC branding, content, event dates, statistics or images.

A previous layout with a contained photograph/story on the left and announcement/account sidebar on the right was explicitly rejected. Do not restore that composition. The later full-width hero and slide arrangement were accepted for continuation; whole-site visual/content acceptance and the final indicator refinement are not recorded as fully approved.

## 3. Scope and protected work

Current work is **frontend presentation**, using local/mock presentation data where appropriate. No backend integration is part of this stream.

Do not modify:

- `feat/faculty-admin-access` work or associated specifications, plans, reports or source-of-truth documentation. Do not switch to that branch.
- `GSIS_IMPLEMENTATION_CHECKLIST.md`, `CONTEXT.md`, shared checklists/roadmaps, or unrelated canonical documents. Add isolated landing-specific plans/reports in the existing `docs/superpowers/plans/` or `docs/superpowers/reports/` folders.
- Login/registration pages or workflows, authentication/session handling, portals, roles or authorization. Landing labels/links may point to existing destinations.
- Backend/API/services, Prisma/schema/migrations/seeds, database or production data.
- RepositoryBrowser internals, live research-query/citation/document/access behavior, or chatbot files/content/behavior.
- Dependencies, configuration, ignore rules or unrelated page bodies for a presentation task.

Dedicated `/about`, `/programs`, `/repository` and legacy `/faq` bodies are outside this Home redesign. Navbar/Footer changes naturally affect their shared shell and need smoke checks. Do not delete those routes merely because a Home CTA was removed.

No deployment, merge to main, force push, branch deletion or external messages. Previously approved delivery workflow: inspect local/live state, stage exact reviewed paths, normal commit/push to the existing feature branch, report the ending SHA, then stop for rendered review. Never stage unrelated changes with a blanket add.

## 4. Current Home and navigation

Home order:

1. Full-width featured hero carousel (`#news`).
2. Compact applicant-access band immediately below the carousel.
3. About the Graduate School (`#about`).
4. Complete Graduate Programs directory (`#programs`).
5. Graduate Research feature.
6. Contact (`#contact`).
7. Institutional Footer; existing chatbot remains in the shared public layout.

Navbar: identity/Home → `/`; News → `/#news`; About → `/#about`; Programs → `/#programs`; Research Repository → `/repository`; Contact → `/#contact`. Account actions are visually separate: Sign In → `/login`, Create Account → `/register`. Preserve root-qualified anchors from deeper routes, sticky-header clearance, mobile menu disclosure, Escape/focus return and the skip link.

The mounted Home FAQ/Getting Started section was removed at the owner's request because a chatbot is available. This does not establish that the chatbot has accurate answers for every FAQ. Old `#getting-started` and `#faq` anchors remain as compatibility anchors in the applicant band; their presence does not mean a visible FAQ section should return.

The redundant Home **View All Graduate Programs** and **About the Graduate School** CTAs to dedicated pages were removed. Preserve the complete Home content and existing dedicated routes.

## 5. Applicant wording — important distinction

Actual applicant registration/application occurs in the separate Pinnacle system:

`https://earistweb.pinnacle.com.ph/aims/applicants/`

This GS-IS portal gives registered applicants existing account/examination access. The owner rejected **Register for GS-IS** as the main landing action.

- **Explore Programs** → `/#programs`.
- **Entrance Examination** → existing `/login`; this is sign-in access, not an immediate exam attempt.
- **Create Account** → existing `/register`; local portal account creation remains available.
- **Apply through Pinnacle** → the external application URL, clearly distinct from local account access.
- Helper: **For applicants registered in Pinnacle. Sign in or create an account to access examination services.**
- Prerequisite: **A Pinnacle Applicant ID is required.**

Do not imply automatic Pinnacle account linking, open admissions, exam eligibility or immediate exam start. Do not introduce “Take Exam Now” or change the destination workflows.

## 6. Carousel baseline to preserve

Current three local features:

| Slide | Treatment | Actions |
| --- | --- | --- |
| Graduate study at EARIST. | Full-width academic courtyard image and burgundy scrim; left-aligned HTML copy | Explore Programs; Entrance Examination |
| Registered in Pinnacle? | Centered text-led burgundy statement | Entrance Examination; Create Account; Applicant ID guidance |
| Explore graduate research. | Full-width library image and burgundy scrim; left-aligned HTML copy | Browse Research Repository; Explore Programs |

Institutional identity remains fixed while slide content moves. Ordinary visible controls are edge arrows and bottom **carousel indicators / pagination dots** only. No numeric slide counter, visible Play words/icon or public design-review banner.

- Autoplay every **8,000ms**, on desktop/tablet/mobile, without clicking Play.
- **900ms paired horizontal transition**, `cubic-bezier(0.45, 0, 0.2, 1)`. Incoming slide moves from the right while departing slide moves left. Last → first retains this direction without a visible track reset. Previous reverses direction.
- Current state retains active and previous panels plus direction; rapid navigation queues the latest requested destination until the current transition settles.
- Up to two panels are painted during motion. Only the active panel is interactive/exposed to assistive technology; outgoing content is `inert`/`aria-hidden`, then visually hidden. Use `.public-carousel__slide[data-active="true"]` when checking the semantic active panel; `:not([hidden])` can match two panels during animation.
- Animation-end settles the frame, with a cancellation/reduced-motion fallback timeout.
- Manual arrow/dot selection resets timing and automatically continues after temporary interaction ends; it does not require Play to resume.
- Mouse hovering an actionable link/button temporarily pauses autoplay. Hover over plain hero imagery/text does not. Touch taps must not leave synthetic hover stuck.
- Keyboard interaction/focus, hidden document and offscreen state suspend rotation. Reduced motion disables autoplay/slide animation. A **keyboard-focus-only Pause/Resume button** is retained and appears when focused; do not remove this accessibility control because ordinary playback UI was removed.
- No repeated screen-reader announcements for autoplay; manual selection retains a status message and control focus.
- Indicators morph from **8px dots to a 28px gold pill** using the same 900ms width easing; background/border colors blend over that duration. Former active marker contracts as the new one expands. The **44 × 44px button targets stay fixed**. Reduced motion makes marker changes immediate.

Keep the authentic EARIST seal, existing typography, burgundy/cream palette and restrained gold accents. Avoid decorative statistics, gradients/glows, repeated dashboard cards, or unrelated animation libraries.

## 7. Content, images and functional limits

- Presentation should look production-facing. The owner explicitly removed **“Design preview,” “Sample content — design review only,”** and **“Design placeholder image — not EARIST photography”** from Home. Do not reintroduce these visible labels based on old documents or legacy content properties.
- This label removal does not turn mocked content into verified official news or generated images into genuine EARIST photography. Preserve truthful alt text and provenance in code/docs. Do not invent news dates/events/deadlines, awards, statistics, people, publications or admissions claims.
- Three existing generated WebP assets are under `frontend/public/images/landing/v2/`: `hero-campus-preview.webp`, `research-preview.webp`, `about-preview.webp`. They depict fictional academic spaces. Preserve the authentic seal separately. Suitable internet images were allowed by the owner if needed; document the source/use basis and do not portray another institution as EARIST.
- `public-site-content.ts` still contains legacy preview/sample/FAQ fields. Their existence is not an instruction to mount them. The shared image helper defaults to captions for existing consumers; Home disables them. Dedicated About was not redesigned by that cleanup.
- Preserve all **7 master's programs, 4 doctoral programs and 9 majors**, including parent-major relationships, in the shared working catalog. Never replace them with random mocked degrees. Catalog reference selected earlier: `https://earist.edu.ph/graduate-school-2/`; institutional/Graduate School content sources are recorded in code and prior reports. Reverify official sources if introducing new factual copy.
- About describes the Graduate School, professional practice, research and leadership; distinguish Graduate School goals from institution-wide EARIST goals. Avoid software/platform marketing copy.
- Research has a truthful link to `/repository`; no fake publication cards/counts, duplicate live search or seeded records. Last recorded operational state: real Repository catalog empty and populated/authenticated behavior not verified. This was not re-tested during handoff.
- Contact/platform details remain a working snapshot awaiting client confirmation. Inquiry submission is intentionally unavailable: retain validation, explicit **not sent** messaging and entered values. No fake success or delivery integration.
- Inherited expanded chatbot overflow at 320px remains documented and outside scope. Keep launcher/control clearance; do not claim chatbot behavior/containment was fixed.

## 8. File map and local checks

All paths below are relative to the workspace in section 1.

| Path | Purpose |
| --- | --- |
| `frontend/src/app/(public)/page.tsx` | Home section assembly |
| `frontend/src/app/(public)/layout.tsx` | Shared public Navbar/main/Footer/chatbot/skip link |
| `frontend/src/app/(public)/public-site.css` | Scoped `.earist-public` styles, carousel motion/indicators/responsive rules; edits can affect other public routes |
| `frontend/src/components/landing/hero-section.tsx` | Carousel wrapper and applicant-access band |
| `frontend/src/components/landing/announcements-section.tsx` | Carousel data, state, autoplay, controls and accessibility |
| `frontend/src/components/landing/navbar.tsx`, `footer.tsx` | Public navigation and shared shell |
| `frontend/src/components/landing/about-section.tsx`, `programs-section.tsx`, `repository-section.tsx`, `contact-section.tsx` | Home body sections |
| `frontend/src/components/landing/inquiry-form.tsx` | Existing non-delivering inquiry form |
| `frontend/src/components/landing/preview-image.tsx` | Image helper; preserve default behavior for other consumers |
| `frontend/src/content/public-site-content.ts` | Local content, full catalog, contact/platform snapshot, provenance and legacy fields |
| `frontend/scripts/verify-landing-refinement.mjs` | Focused guest-only Edge/Playwright regression checks |

Frontend stack from the local manifest: Next.js 16.3.8, React 19.2.4, TypeScript, Tailwind 4, existing Lucide icons. Do not upgrade/install dependencies for the handoff or an ordinary presentation refinement.

From `frontend/`, use existing dependencies:

```powershell
# Start only if no existing appropriate dev server is running:
npm run dev

# With the frontend running on localhost:3000:
node scripts/verify-landing-refinement.mjs
node node_modules/typescript/bin/tsc --noEmit

# Scope ESLint to changed TS/TSX/JS files, for example:
node node_modules/eslint/bin/eslint.js src/components/landing/announcements-section.tsx
```

Verifier defaults to installed Microsoft Edge (`msedge`) and supports `LANDING_BASE_URL` and `LANDING_BROWSER_CHANNEL`. Do not install another browser automatically. Run `git diff --check` at repository root. Build when routing, shared rendering, asset wiring or client/server boundaries justify it; small CSS-only changes do not need repeated unrelated suites.

**Previously observed evidence, not rerun for this documentation handoff:** eight regression groups PASS at the latest code baseline; indicator transition checks at 1440/390/320px PASS; previous horizontal-motion change passed TypeScript/scoped ESLint. Last production-build evidence belongs to the earlier public-copy cleanup, not a fresh build at the indicator commit. No hosted CI, frame-rate guarantee, final owner acceptance or deployment is implied.

Review changed surfaces at desktop/tablet/mobile (approximately 1440/820/390/320px), all slides and wraparound, reduced motion, keyboard/touch, navigation from deeper routes, image loading, no closed-chatbot page overflow and preserved catalog. Only run checks relevant to the new feature; update meaningful assertions if intended behavior changes.

## 9. Reading order and superseded decisions

Read these repository-local documents; this handoff summarizes the latest decisions:

1. [Indicator transition](2026-11-10-landing-page-indicator-transition.md)
2. [Horizontal slide transition](2026-11-10-landing-page-horizontal-transition.md)
3. [Automatic carousel follow-up](2026-11-10-landing-page-autoplay-follow-up.md)
4. [Visitor-facing copy cleanup](2026-11-10-landing-page-public-copy-cleanup.md)
5. [Full-width hero correction](2026-11-09-landing-page-refinement-1-correction-report.md)
6. [Refinement working plan](../plans/2026-11-09-landing-page-refinement.md)
7. [V2 design specification](../specs/2026-11-08-landing-page-redesign-v2-design.md), [V2 plan](../plans/2026-11-08-landing-page-redesign-v2.md), [V2 consolidated report](2026-11-08-landing-page-redesign-v2-report.md), [asset provenance ledger](2026-11-08-landing-page-redesign-v2-assets.md)

Older documents are historical. Their visible sample/placeholder labels, contained opening/sidebar, gentle fade, mobile-manual default, permanent pause after manual selection, and ordinary visible Play control were superseded by the later owner corrections. Do not restore them or rewrite the old documents to change history.

Refinement 1 and its bounded follow-ups are implemented. **Refinement 2 (cohesive About/Programs/Research/Contact/Footer body refinement) has not started.** It is a recorded possible next package, not the unspecified new feature requested for the next session. Do not start it automatically.

Optional session-local visual evidence (not required to reconstruct the code): `C:/Users/admin/.codex/visualizations/2026/11/08/01a1bc0e-5506-7332-aa62-5fe2fb8400e2/`, including `correction-final-*.png`, `clean-ui-*.png`, `autoplay-ui-*.png`, `motion-mid-*.png`, `motion-settled-*.png` and `horizontal-motion-review.json`. Prefer the running app for current motion review; static screenshots cannot prove smoothness.

## 10. First action in Antigravity

Read this handoff and narrowly relevant source, inspect current branch/worktree and local/live commits, then use the owner's new feature description to define the bounded frontend change. If no feature description accompanies the handoff, briefly confirm the current baseline and ask what feature the owner wants to add. Do not implement a guessed feature or start a broader redesign simply to demonstrate progress.

For an actual implementation pass: preserve unrelated work, state the affected presentation scope, implement and inspect it in the existing app, run appropriate checks, add an isolated landing report if needed, publish only exact approved paths using the established feature-branch workflow, and stop for review. Separate local evidence, integration limitations and owner acceptance in the handoff/result.
