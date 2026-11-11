# Landing Page Refinement 1 — Featured Opening and Information Architecture

**Date:** 2026-11-09 (Asia/Singapore)
**Repository / branch:** `MuelTech/graduate-system` / `feat/landing-page-redesign`
**Verified local/live starting HEAD:** `3583afc00edca19f58f676062350cc048ff93300`
**Verified main at package start:** `045316540d97364214792c7d441ae20a1e426d4c`
**Authority:** [Approved refinement plan](../plans/2026-11-09-landing-page-refinement.md).
**Status:** Refinement 1 implemented and locally verified; ready for owner rendered review. Whole-site visual/copy acceptance remains pending. Refinements 2–3 have not begun. Not production-content ready.

## 1. Delivered behavior

- Home now opens with a single featured News / Announcements composition. EARIST Graduate School identity and applicant access remain present while three local sample slides change. The previous separate Hero and lower News block are no longer both mounted.
- The three existing sample entries have real headline-selection controls, previous/next navigation, current-slide indication, and pause/play. Sample entries do not pretend to open article routes. The third sample summary was adjusted to describe an illustrated feature rather than the previous text-only layout.
- Larger screens default to approximately eight-second rotation with a gentle fade. Below 900px, manual navigation is the default; visitors may explicitly play. Reduced motion suppresses both autoplay and the fade.
- Hover, keyboard focus, offscreen positioning, and hidden-document state suspend rotation. Manual slide selection and explicit Pause stop it until deliberate Play. Explicit Play can resume with focus still on that control after pointer exit; another focus change pauses again. Hidden slides leave the accessibility/tab sequence; automatic changes are not repeatedly announced. Manual selections produce a concise status message without moving focus.
- Public navigation is Home → News → About → Programs → Research Repository → Contact. About/Programs use Home anchors; Research Repository retains `/repository`. Account links read Sign In / Create Account without changing either destination page.
- Opening actions are Explore Programs (`/#programs`) and Entrance Examination (`/login`). Nearby local account creation (`/register`) is distinct from Apply through Pinnacle (external application system). The Pinnacle Applicant ID prerequisite remains visible. No immediate exam-start or open-admissions claim is added.
- Home order is featured opening → About → full Programs → Research → Contact → Footer. The Home Getting Started/FAQ component is unmounted; its old hash targets retain compact account guidance, not a visible FAQ. The legacy `/faq` route remains available and unpromoted.
- Redundant Home links to `/about` and `/programs` are removed. Their routes remain unchanged. Footer navigation reflects the new IA, removes Getting Started, and distinguishes external application from local account access.
- Full-width tablet/mobile carousel controls reserve right-edge clearance for the unchanged chatbot launcher; controls wrap at 320px rather than extending beneath it. No widget style or behavior is changed.
- About/Programs/Research/Contact body compositions otherwise remain the inherited treatments for the separately reviewed Refinement 2. The Programs introductory sentence now describes the directory instead of directing visitors toward registration; the complete verified catalog is unchanged.

## 2. Exact package files

| Path | Change |
| --- | --- |
| `frontend/src/app/(public)/page.tsx` | Home section order; remove separate News and Home FAQ mounts. |
| `frontend/src/app/(public)/public-site.css` | Named opening/carousel styles; six-link desktop masthead fit. Other section styling is retained. |
| `frontend/src/components/landing/hero-section.tsx` | Fixed institutional heading and applicant actions around the featured carousel. |
| `frontend/src/components/landing/announcements-section.tsx` | Bounded client carousel with accessible manual/playback controls. |
| `frontend/src/components/landing/navbar.tsx` | New public navigation order/Home item and local account-link wording. |
| `frontend/src/components/landing/footer.tsx` | Matching public IA and account/external-platform labels. |
| `frontend/src/components/landing/about-section.tsx` | Remove redundant dedicated-page CTA only. |
| `frontend/src/components/landing/programs-section.tsx` | Remove redundant directory CTA and clarify introductory copy. |
| `frontend/src/content/public-site-content.ts` | One sample News summary; catalog, institutional facts, contact data, and image metadata unchanged. |
| `frontend/scripts/verify-landing-refinement.mjs` | Focused guest-only Playwright regression checks; no fixtures, authentication, or data writes. |
| `docs/superpowers/reports/2026-11-09-landing-page-refinement-1-report.md` | This package report and asset-use reconciliation. |

No package manifests/lockfiles, dependencies, framework configuration, global/root styles, shared UI primitives, or new runtime assets are included.

## 3. Verification actually executed

| Check | Result / limit |
| --- | --- |
| `node node_modules/typescript/bin/tsc --noEmit` | PASS at final source. |
| Scoped ESLint | PASS on the eight affected typed source files and the new verifier. No unrelated lint sweep. |
| `node scripts/verify-landing-refinement.mjs` | PASS, seven regression groups described below, against the existing local frontend using installed Microsoft Edge. |
| `node node_modules/next/dist/bin/next build` | PASS at final source: optimized compilation, framework TypeScript, and 68 static pages. Final validation followed the Play/focus interaction and launcher-clearance corrections and their focused regression checks. |
| Build warning | Existing Next middleware-file convention deprecation warning; no migration attempted. |
| Responsive rendered review | Home, About, Programs, Repository at 1440/820/390/320px: HTTP 200, one route H1, loaded visible images, no uncaught page errors, no page-level horizontal overflow with chatbot closed. Screenshots inspected; 1200px masthead fit also checked. |
| Actual 200% browser zoom | PASS for those four pages. Isolated Edge profile, browser settings zoom confirmed as 2; 1440px outer window produced 708 CSS pixels, DPR 2, visual viewport scale 1. Reflow and compact menu/Escape/focus return passed. This was browser zoom, not pinch zoom or only a narrowed viewport. |
| Protected scope and whitespace | Exact diff reviewed; protected paths excluded; `git diff --check` passed. Final staged scope and live publication are rechecked before delivery. |

The focused verifier covers: (1) Home IA, complete 11-program/9-major catalog, real action destinations and removed CTAs; (2) desktop autoplay, hover/focus pause, manual stop, explicit pause and deliberate resume; (3) offscreen suspension and document visibility; (4) mobile manual default, wraparound, keyboard headline selection, focus retention, hidden panels, images and sample labels; (5) reduced-motion behavior; (6) 320px reflow and stable slide height; (7) shared-shell route loading, cross-route Contact anchors, mobile menu closing and Escape/focus return on `/about`, `/programs`, `/repository`, and `/faq`.

Timing tests use Playwright's virtual clock installed before navigation. Offscreen checks use actual browser scrolling; document visibility specifically uses a controlled `document.hidden`/`visibilitychange` simulation. No repository response, publication, authenticated identity, or production data is mocked. The verifier observed zero uncaught browser errors and zero data-mutating requests during these guest navigation/carousel cases. This does not claim inquiry delivery or authenticated transaction verification.

Local evidence is under `C:/Users/admin/.codex/visualizations/2026/11/08/01a1bc0e-5506-7332-aa62-5fe2fb8400e2`: `refinement1-final-*.png`, `refinement1-final-opening-*.png`, `refinement1-preview-*.png`, `refinement1-responsive-review.json`, `refinement1-zoom200-*.png`, and `refinement1-zoom-review.json`. These are session-local QA artifacts, not durable Git assets or hosted CI. Earlier `initial`/`opening` screenshots are intermediate evidence; use `final`/`preview` captures for owner review.

Superdesign CLI preflight could not start because npm cache creation was denied. The already-approved implementation direction was implemented directly in the existing frontend; no Superdesign canvas result, remote design generation, dependency installation, or extra repository discovery documents are claimed.

## 4. Review imagery and content provenance

No images were downloaded, generated, replaced, or re-encoded in this package. The featured carousel reuses these tracked V2 assets, all 1536 × 1024:

| Review item | Existing runtime image | Recorded SHA-256 |
| --- | --- | --- |
| Sample announcement headline | `frontend/public/images/landing/v2/hero-campus-preview.webp` | `b032dee284a073092a95ef97611b53329c2212086b0d3407ab8e82d347388551` |
| Sample Graduate School update | `frontend/public/images/landing/v2/about-preview.webp` | `85f0ac1fb58058f26bf1bd990b8f2971a50c04733bba7911bc5e551f0b08a61b` |
| Sample campus information | `frontend/public/images/landing/v2/research-preview.webp` | `25a533f819646a1886d1878b6f0df9bd1dcec337a19a593977891eef2ad2128c` |

Generation/source history remains in the unchanged [V2 asset ledger](2026-11-08-landing-page-redesign-v2-assets.md). These depict fictional academic settings, not verified EARIST facilities, events, or research. Existing subject-specific alt text and the adjacent **Design placeholder image — not EARIST photography** captions remain. New feature crops use 2:1 on desktop, 2.4:1 at tablet widths, and 16:9 below 600px, with existing cover/object-position behavior. All three crops and loaded images were reviewed through manual slide selection.

The institutional seal remains unchanged. All sample entries retain **Sample content — design review only**; the shared page-level review notice remains visible. No dates, admissions deadlines, real events, publications, institutional statistics, article destinations, or documentary claims were invented.

## 5. Boundaries, dependencies, and stop

No edits to backend/services/APIs, Prisma/schema/migrations/database, production data, authentication/session, login/registration pages or workflow, portal authorization, roles, Faculty/Admin work, RepositoryBrowser/query/citation/document/access code, chatbot files/content/behavior, dedicated public-page bodies, or unrelated canonical documentation. No seed, migration, external message, deployment, or merge to main. Faculty/Admin documents, shared checklists, CONTEXT, approved plan, and previous V2 specification/plan/reports remain untouched.

Inquiry sending is still unavailable; existing form behavior and working contact/platform snapshot remain unchanged. Repository's real empty catalog is preserved; populated/authenticated filtering, citations, viewer/download, and enforcement remain a separate verification workstream. The inherited expanded-chatbot overflow at 320px and its legacy answers are not fixed or reverified by this package.

Production still needs approved genuine EARIST photography, approved News/content destinations, confirmed contacts/platforms, and separately authorized inquiry integration. Owner visual/copy acceptance is pending. Publish this bounded package with a normal feature-branch commit/push, report the exact ending SHA externally, and stop for rendered review. Do not start Refinement 2 automatically.
