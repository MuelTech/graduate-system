# Landing Page Refinement — Working Direction and Iterative Plan

**Project:** EARIST Graduate School Information System (GS-IS)
**Date:** 2026-11-09 (Asia/Singapore)
**Repository / branch:** `MuelTech/graduate-system` / `feat/landing-page-redesign`
**Verified local and live feature starting HEAD:** `94ac44ad4ccc35df3bfd049233d254cc9ed390e8`
**Verified local and live main:** `045316540d97364214792c7d441ae20a1e426d4c`
**Status:** Documentation baseline for the owner-discussed refinement direction. No refinement implementation has begun. Deliver this plan first; each implementation pass requires its own instruction and rendered review before progression.

## 1. Authority and current scope

The owner's newer decisions in this session govern this separate refinement phase. Original V2 Tasks 1–6 are complete for continuation; whole-site visual/copy acceptance and production-content acceptance remain pending. Current styling is not permanently frozen.

Read the [V2 specification](../specs/2026-11-08-landing-page-redesign-v2-design.md), [V2 plan](2026-11-08-landing-page-redesign-v2.md), [Task 6 report](../reports/2026-11-08-landing-page-redesign-v2-report.md), and [asset/provenance ledger](../reports/2026-11-08-landing-page-redesign-v2-assets.md) for inherited content, verified behavior, and limitations. Their older layout, FAQ, and CTA decisions are superseded only where this plan records the newer owner direction. Preserve those files as historical records rather than rewriting their acceptance state.

The initial whole-public-site review is now narrowed to **Home and its shared public Navbar/Footer presentation**. Do not redesign the dedicated `/about`, `/programs`, `/repository`, or legacy `/faq` page bodies in these passes. Shared shell changes naturally appear there and require regression review.

The owner explicitly protects documentation associated with `feat/faculty-admin-access`, including shared checklists. Do not switch to or modify that branch, edit `GSIS_IMPLEMENTATION_CHECKLIST.md`, Faculty/Admin specifications/plans/reports/source-of-truth files, `CONTEXT.md`, or unrelated canonical documentation. Add only landing-refinement-specific plan/report files in the existing folders. No shared roadmap/status synchronization is part of this work.

## 2. Final information architecture

| Public Navbar item | Destination |
| --- | --- |
| Institutional seal/identity | `/` |
| Home | `/` |
| News | `/#news` |
| About | `/#about` |
| Programs | `/#programs` |
| Research Repository | `/repository` |
| Contact | `/#contact` |

Keep account actions visually separate. Working public-shell wording is **Sign In** (`/login`) and **Create Account** (`/register`); these are labels/links only, not changes to either destination page. Root-qualified Home anchors must work from deeper public routes. Preserve accessible menu disclosure, keyboard/Escape/focus behavior, reduced-motion navigation, and sticky-header clearance. Collapse navigation according to actual fit with the added Home item.

Home flow:

1. Featured News / Announcements Hero, with fixed Graduate School identity and applicant-access guidance.
2. About the Graduate School.
3. Graduate Programs.
4. Graduate Research.
5. Contact Us.
6. Institutional Footer.

The featured opening **replaces the separate static Hero plus lower News section**; do not stack two competing heroes or duplicate the same announcements below it. A compact latest-updates list may sit beside or immediately beneath the featured slides as part of the same opening feature.

Remove the mounted Home Getting Started/FAQ section and its obsolete Footer links. Keep essential applicant prerequisites beside the relevant access actions. Do not promote or delete the existing `/faq` route, change chatbot answers to compensate, or claim that the current chatbot is a verified replacement for all help. Task 6 records legacy chatbot-copy limitations; reconciliation is a separate workstream. Retain useful existing Home anchor compatibility where practical, without restoring a visible FAQ section or leaving links to missing targets.

## 3. Opening feature and carousel

Use a restrained EARIST editorial composition: burgundy, warm white/cream, modest gold accents, real unchanged institutional seal, existing font family, clear headings, and substantial supporting imagery. Keep the opening compact enough to expose the continuation of the page. Avoid excessive viewport-height whitespace, decorative statistics, gradients/glows, and repeated dashboard-style cards. The supplied PASUC screenshots are composition references only; do not copy their content, branding, statistics, or assets.

- Keep EARIST Graduate School identity and the applicant-access area visible while slides change.
- Show up to three local featured review items; each may contain an image, headline, short summary, and an optional action with a real relevant destination. No filler slides merely to reach three.
- Include clear previous/next controls, current-slide indication, and a visible pause/play control when autoplay is available. A single item needs no rotation controls.
- Working motion direction: gentle fade at approximately eight-second intervals on larger screens; manual navigation by default on smaller screens. Respect reduced motion with no autoplay or animated transition.
- Pause on hover and keyboard focus. Stop automatic rotation after manual navigation or explicit pause until the user deliberately resumes it. Pause when the feature is offscreen or the document is hidden.
- Keyboard users must reach only visible-slide controls/content; changing a slide must not unexpectedly move focus. Do not repeatedly announce automatic changes to screen readers. Keep touch controls usable without requiring swipe.
- On mobile, stack the featured content and latest-update list naturally. Keep images useful, text readable, and essential actions available without waiting for a slide.

These are the working interaction choices for the first preview, subject to owner rendered review. Accessibility reference: [W3C carousel guidance](https://www.w3.org/WAI/tutorials/carousels/) and [animation controls](https://www.w3.org/WAI/tutorials/carousels/animations/).

## 4. Applicant-facing actions and wording

Application happens in the separate Pinnacle system; this system retains its existing account creation and examination access. No automatic account linkage or immediate exam-start eligibility is implied.

| Action | Existing destination | Presentation |
| --- | --- | --- |
| Explore Programs | `/#programs` | Fixed opening action. |
| Entrance Examination | `/login` | Replaces the opening **Register for GS-IS** action; opens existing sign-in, not an exam attempt. |
| Create an account | `/register` | Nearby supporting link for first-time users of this portal. |
| Apply through Pinnacle | `https://earistweb.pinnacle.com.ph/aims/applicants/` | Clearly identified external application destination, separate from local account access. |

Working helper copy: **For applicants registered in Pinnacle. Sign in or create an account to access examination services.** Associate **A Pinnacle Applicant ID is required.** with local account creation. Do not use **Take Exam Now**, promise open admissions or instant exam access, change registration state, or add a new access route.

## 5. Remaining Home sections and Footer

**About:** Replace site-usage/software-oriented prose with a concise Graduate School introduction grounded in professional development, research, and leadership. Use the [official Graduate School goals](https://earist.edu.ph/graduate-school/). If broader institutional context is included, distinguish it from Graduate School goals and trace it to [About EARIST](https://earist.edu.ph/about/). Provenance belongs mainly in feature documentation/code comments; necessary preview labels remain visible. Do not invent history, leadership, affiliations, statistics, or outcomes.

**Programs:** Preserve all seven master's programs, four doctoral programs, and nine published majors in the shared selected working catalog from [Graduate School reference 2](https://earist.edu.ph/graduate-school-2/). Local/mock presentation does not authorize replacing verified offerings with fictional programs. Keep degree groups stacked, with balanced internal columns where readable and one column on narrow screens. Preserve majors with their parent program; do not force equal-height unequal groups. Remove **View All Graduate Programs** from Home because the complete listing is already present. No invented metadata, Apply actions, detail routes, search, or admissions claims.

**About CTA:** Remove the redundant Home **About the Graduate School** link to `/about`; Home should provide useful institutional content directly. Keep the destination route available for compatibility. These CTA removals do not authorize route deletion.

**Research:** Keep a distinctive, appropriately proportioned institutional feature and one truthful action to `/repository`. No fake publications, counts, duplicate search interface, or access promises. The existing RepositoryBrowser and all live query/citation/document/access behavior remain unchanged; do not mock its responses or seed records.

**Contact:** Retain the working contact/platform snapshot pending client confirmation. Make email/telephone access and inquiry unavailability clear before form entry. Preserve the existing fields, validation, unsent messaging, and entry retention. No delivery endpoint, fake success, new contact claims, or external messages.

**Footer:** Reflect Home → News → About → Programs → Research Repository → Contact ordering in the public links, with distinct official-platform/account access groups. Remove the old Getting Started link when its section is removed. Distinguish external Pinnacle application from local access; maintain chatbot-launcher/copyright clearance.

Refine shared gutters, type hierarchy, rules, image proportions, contextual action placement, and vertical rhythm across these sections. Tablet layouts need deliberate image sizing rather than very tall full-width photographs beneath short copy. Consolidate genuinely repeated public styles and remove only clearly unused styles within the affected scope. Small reusable public patterns are appropriate; no general component-system rewrite.

## 6. Mock content and images

Use local frontend presentation data; no CMS, public News API, authenticated memo feed, or backend integration. News remains visibly **Sample content — design review only**, with no invented real dates, events, deadlines, awards, or claims. A sample without an authorized relevant destination has no misleading Read More button. Persistent program/examination access links remain real.

Existing generated review images may be reused. Internet-sourced placeholders are allowed when their use/source can be documented; select suitable stock or otherwise authorized imagery, not arbitrary photos of another institution presented as EARIST. Keep fictional/generic imagery visibly labelled as review material and describe its actual subject in alt text. Preserve authentic seals unchanged. Render important headlines/actions as HTML rather than embedding all information into poster pixels.

Record any selected image's source/usage basis, original and runtime paths, dimensions, review label, alt/crop treatment, and production replacement requirement in a **new refinement-specific report/asset ledger** under `docs/superpowers/reports/`. Do not rewrite the V2 ledger. Explicitly track only selected runtime images despite the existing image-directory ignore rule; do not change ignore rules or add dependencies just for this pass.

## 7. Iterative packages and review stops

| Package | Bounded result | Likely files and verification |
| --- | --- | --- |
| Documentation baseline — current | This plan only; reconcile the conversation without editing application source or protected docs. | Inspect exact diff, local references, whitespace, branch/live HEAD, and publication scope. No application tests/build. Stop for plan review. |
| Refinement 1 — Opening and IA | Featured opening/carousel, fixed applicant actions, new Navbar, Home order, removal of mounted FAQ and redundant Home CTAs, and removal/retargeting of affected Footer links. Preserve existing body treatments until Refinement 2. | Home `page.tsx`; landing Hero/News/Navbar/Footer/About/Programs components as needed; public content/CSS; selected opening assets and a new feature report. Typecheck, scoped lint, focused carousel/link checks, rendered desktop/mobile review, shared-shell cross-route smoke. One build if new carousel client/server or asset wiring warrants it. Stop for owner review. |
| Refinement 2 — Cohesive Home body | Refine About, full Programs directory, Research, Contact, Footer composition, spacing, responsive imagery, and public-only CSS reuse. No dedicated-page-body redesign. | Affected landing components, public content/CSS, narrowly needed assets, feature report. Typecheck, scoped lint, content-preservation/link checks and whole-Home visual review. Build again only if new changes justify it. Stop for owner review. |
| Refinement 3 — Consolidated review | Reconcile evidence and owner feedback; record remaining production dependencies and acceptance state. | New refinement report. Any source fix must be named and bounded before editing; this gate is not permission for a broad rewrite. Check final affected surfaces and protected-file exclusion. Stop; no deployment/merge or next workstream. |

At each implementation pass, verify live feature/main and the local worktree before changes, inspect intervening commits, preserve unrelated work, publish only exact package paths with a normal feature-branch commit/push, and report the actual ending SHA. Do not advance automatically after technical checks. Later reports should distinguish local checks, browser review, hosted CI, and owner acceptance; do not update a shared checklist to track these packages.

## 8. Acceptance checks and hard boundaries

- Whole-Home desktop/tablet/mobile composition, approximately 1440/820/390/320 CSS pixels, navigation breakpoint fit, and 200% browser zoom. No clipped text/actions or page overflow with the chatbot closed.
- Carousel pause/resume/manual navigation, reduced motion, focus order, hidden-slide tab exclusion, image loading/crops, and visible sample/placeholder labels.
- Unique section targets, explicit Home item, root-qualified cross-route links, sticky offsets, keyboard menu/Escape/focus return, and useful examination/application/account wording.
- Complete unchanged working program/major data; Graduate School versus institution-level facts remain distinguished. No removed FAQ/redundant CTA links left in mounted Home/Footer.
- Shared Navbar/Footer smoke on `/about`, `/programs`, `/repository`, and compatibility `/faq`; do not interpret shell verification as authorization to redesign their bodies.
- Protected auth/registration/portal/backend/API/Prisma/database/RepositoryBrowser/chatbot and Faculty/Admin files unchanged; `git diff --check` for each package.

The earlier inherited chatbot panel overflow at 320px remains recorded. The owner has narrowed this pass to landing presentation; chatbot content/behavior and any widget-file containment fix remain outside these packages unless separately reauthorized. Maintain surrounding layout clearance rather than claiming the open-widget defect is fixed.

No backend/services, Prisma/schema/migrations, database/production data, authentication/session, login/registration pages, registration workflow, portal authorization, roles, Faculty/Admin work, RepositoryBrowser internals/contracts, chatbot content/behavior, dependencies, deployment, merge to main, force push, branch deletion, or unrelated documentation changes.

The real Repository catalog remains empty; populated filtering, actual citations, manuscripts/downloads, authenticated access, and runtime enforcement are still a separate operational-verification workstream. Approved EARIST photography, real News/destinations, confirmed contacts/platforms, and authorized inquiry delivery remain production dependencies. Visual acceptance alone does not make those integrations/content production-ready.
