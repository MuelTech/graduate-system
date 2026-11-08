# Public Site and Landing Page V2 — Implementation Plan

**Project:** EARIST Graduate School Information System (GS-IS)
**Date:** 2026-11-08
**Repository / branch:** `MuelTech/graduate-system` / `feat/landing-page-redesign`
**Status:** Working bounded implementation plan. Tasks 1–2 are implemented on `feat/landing-page-redesign` and owner-reviewed for continuation; Task 3 has not begun. Pre-Task-3 owner clarifications now add official program-source references, a Home Contact Us section, and official-source contact/platform review content.
**Verified documentation starting HEAD:** `ab6086026ec68715035f36be91663b6e306af2fd`
**Committed V2 specification / report update:** `da5d0d6c23d24c2232d8c0420f2e54cb858c8f55`
**Verified current main / feature merge base:** `045316540d97364214792c7d441ae20a1e426d4c`

## 1. Authority, objective, and current authorization

Implement the [V2 design specification](../specs/2026-11-08-landing-page-redesign-v2-design.md) in separately authorized visual packages. The owner adopted the Public IA + Landing V2 audit/proposal as the working direction. The specification was written and committed before this plan; the current branch was then audited against its section, navigation, asset, scope, and accessibility requirements.

The owner rejected the V1 design and implementation in manual visual QA. V1 evidence remains historical in its original specification, plan, commits, and [feature report](../reports/2026-11-08-landing-page-redesign-report.md). The report now records the rejection explicitly. Do not treat old approved/pending language as current visual acceptance or copy V1 as the visual precedent.

Follow current domain authority, [copy authority](../USER_FACING_COPY_SOURCE_OF_TRUTH.md), the [UI/UX playbook](../ui-ux/SYSTEM_UI_UX_PLAYBOOK.md), and [verification policy](../ENGINEERING_VERIFICATION_POLICY.md). The playbook is a consistency/accessibility/behavioral guardrail, **not V2's visual template**. Retain the existing font family while using the public display hierarchy defined in the specification. External design resources, if used later, are craft aids only.

Current delivery: commit this plan, verify the exact three-file documentation package, push both documentation commits, and stop. No application source, images, dependencies, deployment, merge, or implementation package is authorized now. The proposed task numbers below are V2 packages, unrelated to the historical V1 task numbers.

## 2. Verified branch/worktree and publication discipline

At the documentation start, live GitHub and local feature HEAD both matched `ab6086026ec68715035f36be91663b6e306af2fd`. Live main, local main, and origin/main matched `045316540d97364214792c7d441ae20a1e426d4c`. The feature was 5 ahead / 0 behind main; its merge base was that same main commit. The requested checkout was clean on `feat/landing-page-redesign`, with one registered worktree at `C:/Users/admin/Desktop/Project/graduate/graduate-system`.

The new specification and historical-report update are committed together as `da5d0d6c23d24c2232d8c0420f2e54cb858c8f55`. This plan is a separate subsequent documentation commit; its immutable SHA is reported in delivery rather than embedded into itself.

Before each later package and before publication:

1. Verify the live feature and main, local HEAD/branch, worktree changes, and ancestry. Do not rely solely on cached remote-tracking refs.
2. Inspect intervening commits and overlapping files. Preserve unrelated work; do not reset, rebase, merge, or force-push to recreate an expected baseline.
3. Stage only exact package paths; inspect staged diff and scope. Use normal fast-forward push to the requested feature branch. Remote divergence requires reconciliation/instruction rather than overwrite.
4. Record package starting/ending HEAD, actual files, checks, remaining content dependencies, and owner review state. A later main advance is a fact to report, not automatic authorization to merge it.

## 3. Current branch audited against the committed V2 specification

The audit is source, route/data-flow, document, and asset evidence. No fresh browser QA was performed for this documentation package.

| Current path / surface | Observed implementation | V2 gap and bounded resolution |
| --- | --- | --- |
| `frontend/src/app/(public)/page.tsx` | Mounts only Hero, Programs, Repository. | Add News, About, and Getting Started/FAQ; establish exact V2 order and real anchors. |
| `frontend/src/app/(public)/layout.tsx` | Shared Navbar/main/Footer/ChatbotWidget; no scoped public class or main skip target. | Add public-only styling boundary, skip link/main target, and visible review notice without changing providers or widget behavior. |
| `frontend/src/components/landing/navbar.tsx` | Generic cap, five route tabs, 64px height, `md` desktop breakpoint. Existing disclosure has controls/expanded/hidden/Escape/focus-return/close behavior. | Use real seal, larger lockup, deliberate compact breakpoint; preserve accessible disclosure and introduce final root-qualified anchor IA only when targets exist. |
| `hero-section.tsx` | Small detached 56px seal; identity beside account-access column; no photograph. | 45/55 photographic/editorial Hero, primary Programs action and secondary registration with prerequisite. |
| `programs-section.tsx` | Intro plus outbound link; `graduate-study` anchor. | Grouped degree directory and `programs` anchor; retain old anchor compatibility where practical. |
| `repository-section.tsx` | Plain reading block; `graduate-research` anchor. | Burgundy research feature and labelled image, truthful Repository link, no research fixtures or duplicated search. |
| `announcements-section.tsx` | Dormant five-item hard-coded news strip; stale dates, official-sounding claims, FAQ/Repository destinations. | Rewrite as local explicitly labelled editorial samples; no old entries or misleading links survive in the mounted section. |
| `footer.tsx` | Cap identity beside one tall Quick Links list. | Actual seal; three balanced link/identity groups until verified contact content supports a fourth. |
| `(public)/programs/page.tsx` | Nine hard-coded records, inert search, repeated cards, unconditional admissions-open claim. | Later grouped directory from the same frontend snapshot as Home; functional local filtering; no false availability or program-specific application behavior. |
| `(public)/about/page.tsx` | Software features/technology, unsupported stats and mission/vision. | Later institutional composition with verified identity/prose and labelled imagery; no invented replacement claims. |
| `(public)/faq/page.tsx` | Working client accordions, inert search, internal terminology and unverified policy/contact claims. | Later reading layout, working local search, accessible controls, source-checked answers; do not invent policy. |
| `(public)/repository/page.tsx` | Public header followed by shared functional `RepositoryBrowser`. | Refine only page-owned header/gutters; keep shared browser and its data/document/session behavior unchanged. |
| `components/repository/repository-browser.tsx` | Existing request/search/filter/citation/document/session interactions; also reused by portal routes. | Protected shared functional component in this plan. Styling must not reach it through broad descendant selectors. |
| `frontend/src/app/globals.css` and root layout | Existing EARIST tokens, Calibri/Segoe UI stack, shared providers and global element styles. | Reuse; no global changes. Apply named public component styles with explicit contrast overrides. |
| Public asset directory | Only the tracked EARIST seal plus starter SVGs; no suitable institutional photo. | Supply labelled review imagery in exact local paths; track chosen images explicitly despite ignore rules. |

Read-only source inspection confirms the existing Programs service returns graduate/undergraduate records, while the seed catalog differs from the hard-coded public page. This is not evidence of current admissions offerings. No new fetch or backend change is needed for visual QA. Authenticated memo routes are not a public news feed. Repository already has a live functional destination; Home needs only truthful introduction and navigation.

The public route group owns all five public pages, while auth pages use a different layout. Public CSS/layout edits still need cross-route review and must not restyle the nested chatbot or RepositoryBrowser. Dormant Features, Portal, CTA, How It Works, and landing barrel exports need no incidental cleanup.

## 4. Frontend implementation and asset decisions

### 4.1 Small public-only foundation

- Proposed new `frontend/src/app/(public)/public-site.css`, imported by the existing public layout, uses `.earist-public` plus named component classes. No `:root`, body, global `h1/p/button/input`, shared UI primitive, or broad widget/repository descendant restyling. Reuse existing EARIST tokens and font family.
- Proposed new `frontend/src/content/public-site-content.ts` holds only local public copy, provisional/confirmed program rows, image metadata/provenance references, and explicitly labelled news samples. It is a frontend module, not an API contract, database model, or CMS. Do not import runtime backend/Prisma code.
- Proposed `preview-image.tsx` is a small local Next Image/figure/caption helper that keeps placeholder labels visible; `design-preview-notice.tsx` provides the page-level review notice. No feature-flag/environment logic that hides samples in production builds.
- Prefer server components for static sections and existing Navbar client state. Native details/summary is sufficient for Home FAQs. Only local interactive directory filtering needs a new narrow client component.
- Continue direct section imports from Home; no landing barrel change is required. No dependency or configuration additions are proposed.

### 4.2 Chosen future image paths and provenance

| Path (not created in this documentation task) | Need / treatment |
| --- | --- |
| `frontend/public/images/landing/earist-logo.jpg` | Existing real owner-supplied EARIST seal; preserve bytes. |
| `frontend/public/images/landing/v2/hero-campus-preview.webp` | Required photographic Hero review asset, clearly not EARIST photography. |
| `frontend/public/images/landing/v2/research-preview.webp` | Required Research feature review asset; academic setting, no fake publication content. |
| `frontend/public/images/landing/v2/about-preview.webp` | About review image; may use an appropriate distinct crop of an authorized review source. |
| `frontend/public/images/landing/v2/graduate-school-logo.jpg` | Optional byte-preserving copy of the 207×207 owner-supplied backend asset for About. |
| `frontend/public/images/landing/v2/news-feature-preview.webp` | Optional featured-news image; reuse/crop a suitable review source rather than require another asset unnecessarily. |
| `docs/superpowers/reports/2026-11-08-landing-page-redesign-v2-assets.md` | Small later asset ledger: source/rights or generation provenance, output path, dimensions/crop, visible label, replacement requirement, approval status. |

The actual seals are documented in `backend/assets/official-forms/README.md`; backend originals/consumers remain unchanged. Temporary photography may be licensed/authorized stock or generated academic-context material. If generation is selected later, use the applicable image-generation workflow; do not generate assets during this documentation task. Avoid fake EARIST buildings/signage/people and invented documentary events.

`frontend/public/images/` is ignored by the current root `.gitignore`; the existing seal is tracked explicitly. Later packages must force-add only their exact selected image paths after checking provenance, size, and dimensions, then verify those assets are present in Git. Do not stage the entire ignored directory or change ignore rules as incidental cleanup.

### 4.3 Content handling without integration

Use the official EARIST Graduate School pages as the program-content references: https://earist.edu.ph/graduate-school/ and https://earist.edu.ph/graduate-school-2/. They differ in some majors/wording, so the current frontend list remains review content until the client confirms the reconciled catalog. Home and the later directory share this official-source/client-confirmation status; do not silently merge conflicts, invent degrees, assert a total count, or add program-specific Apply behavior.

News samples use neutral sample headlines, sample-date labels or no date, and no invented admissions deadlines, events, policies, institutional outcomes, or public article destinations. They are non-link editorial entries. Do not introduce `/news`, `/news/[slug]`, a CMS, API calls, or expose private memos.

Research contains no sample publications at all. About uses verified identity and concise public-purpose copy until approved institutional prose arrives. Home help covers only the verified account/public-browsing paths; detailed policy is not inferred from old FAQ text. Contact Us and Footer may now use official-source review content from the EARIST Graduate School pages: the newer page's Nagtahan St campus address, earistofficial1945@gmail.com and (02) 7738 5059; the older Graduate School page's (02) 7154914 and earistgraduateschool social handle; the current EARIST website; and the official-site-linked Applicants Access Module. Because the sources differ in age/detail, client confirmation is required before calling individual contact/social details final production content.

## 5. Six proposed implementation packages

Packages are sequential because they share Home, content, and scoped styles. Each requires explicit later authorization, focused verification, a bounded commit/handoff, and its own stop. Do not run all six automatically. Interim packages may be reviewed as partial progress; only the assembled result can receive whole-page visual acceptance.

### Task 1 — Public visual foundation, institutional masthead, and photographic Hero

**Visual goal:** Replace the weak opening with a substantial 45/55 Hero and actual seal branding. Establish scoped gutters/type/contrast, main skip target, and honest image-preview treatment. Keep the existing useful public route destinations temporarily; final anchor IA waits for Task 3 so partial packages do not introduce missing targets. Initially point Explore Programs to the existing `/#graduate-study` target; Task 2 moves it to the new `/#programs` target with compatibility retained.

**Exact likely files:**

- Modify `frontend/src/app/(public)/layout.tsx`, `frontend/src/components/landing/navbar.tsx`, `frontend/src/components/landing/hero-section.tsx`.
- Add `frontend/src/app/(public)/public-site.css`, `frontend/src/content/public-site-content.ts`, `frontend/src/components/landing/preview-image.tsx`, `frontend/src/components/landing/design-preview-notice.tsx`.
- Add `frontend/public/images/landing/v2/hero-campus-preview.webp` and the V2 asset ledger named in section 4.2. Reuse the existing EARIST seal; do not copy/change backend originals.

**Assets:** One strong labelled architectural/academic-context image, appropriate desktop/mobile crop, width/height and provenance. No new Hero seal artwork.

**Shared blast radius:** Navbar/layout/styles/notice appear on Home, Programs, Repository, FAQ, About. Auth layouts/providers and chatbot mount remain unchanged. Keep styles named narrowly enough that shared browser/widget internals do not inherit a new visual system accidentally.

**Responsive/accessibility:** Check full identity/navigation fit, compact breakpoint around 1200px, 44px menu targets, existing disclosure/Escape/focus behavior, collapsed tab order, skip link, readable prerequisite, explicit image dimensions, mobile copy-before-image order, and actual text contrast.

**Verification:** Scoped TypeScript/ESLint/diff checks; focused keyboard/menu and link/image checks; browser review at mobile/tablet/desktop and 200% zoom; cross-route shell smoke. Run one production build because the public layout adds scoped CSS/component imports and asset wiring. No backend suites. Record absent browser/backend access honestly.

**Stop:** Commit/handoff Task 1 only. State that original Footer, content sections, and temporary old navigation are not the final V2 result; obtain the next task instruction before continuing.

### Task 2 — Programs, Graduate Research, About, and Getting Started / FAQ

**Visual goal:** Replace V1's short outbound pathways with useful directory content, a burgundy photographic Research feature, institutional About, and concise practical help. Compose Home as Hero → Programs → Research → About → Getting Started for this intermediate package; Task 3 inserts News between Programs and Research.

**Exact likely files:**

- Modify `frontend/src/app/(public)/page.tsx`, `frontend/src/components/landing/hero-section.tsx` (Programs anchor only), `frontend/src/components/landing/programs-section.tsx`, `frontend/src/components/landing/repository-section.tsx`.
- Add `frontend/src/components/landing/about-section.tsx`, `frontend/src/components/landing/getting-started-section.tsx`.
- Extend `frontend/src/app/(public)/public-site.css`, `frontend/src/content/public-site-content.ts`, and the V2 asset ledger.
- Add `frontend/public/images/landing/v2/research-preview.webp`, `frontend/public/images/landing/v2/about-preview.webp`; optionally add `frontend/public/images/landing/v2/graduate-school-logo.jpg`.

**Assets/content:** Label each substitute photograph; preserve a copied Graduate School seal byte-for-byte. Use confirmed or visibly provisional source-derived program titles, not the current public-page claims. No invented publications, program totals, research statistics, institution history, or policy.

**Shared blast radius:** Home sections only, with tightly scoped style/content additions. Shared preview helper is reused, not rewritten into a global image component. No deeper route or RepositoryBrowser changes.

**Responsive/accessibility:** Stack degree groups; let long official titles wrap; establish unique `programs`, `graduate-research`, `about`, `getting-started`, and `faq` targets with sticky offsets. Use normal headings/rows rather than card grids. Verify Help disclosure semantics, label visibility, Research white text, image order, and CTA focus.

**Verification:** TypeScript, ESLint for changed TSX/TS, diff/link/anchor checks, image/hash/provenance review, and browser whole-Home rhythm/mobile/zoom checks. Confirm no Home research fixtures or backend requests. A build is needed only if new wiring/boundaries or a concrete issue warrants it; do not repeat Task 1's build mechanically.

**Stop:** Commit/handoff Task 2. Explicitly record that News and final Footer/navigation remain Task 3 and that a partial page is not whole-site acceptance.

### Task 3 — News design preview, final public navigation, Contact Us, and institutional Footer

**Visual goal:** Complete the intended Home rhythm with one featured sample plus compact news rows, introduce the final anchor navigation once all targets exist, add a practical Contact Us section backed by official-source review content, and replace the sparse Footer with balanced institutional groups.

**Exact likely files:**

- Modify `frontend/src/components/landing/announcements-section.tsx`, `frontend/src/components/landing/navbar.tsx`, `frontend/src/components/landing/footer.tsx`, `frontend/src/app/(public)/page.tsx`.
- Add `frontend/src/components/landing/contact-section.tsx` (or an equivalently scoped Home-only component).
- Extend `frontend/src/content/public-site-content.ts`, `frontend/src/app/(public)/public-site.css`, and the V2 asset ledger if an image is added.
- Optional image: `frontend/public/images/landing/v2/news-feature-preview.webp`.

**Assets/content:** Neutral locally defined News samples with per-item **Sample content — design review only** and section-level notice. Dates are explicitly samples or omitted. Optional image has its own visible not-EARIST caption. Footer uses the real seal. Contact Us may use the official EARIST-source review details recorded in the specification, including the current EARIST website and official-site-linked Applicants Access Module. Where the two official Graduate School pages differ, keep the content reviewable/client-confirmable rather than claiming final verification.

**Shared blast radius:** Final Navbar/Footer affect all five public routes. Final Navbar is logo → `/`, Programs → `/#programs`, Research Repository → `/repository`, News → `/#news`, About → `/#about`, Contact → `/#contact`, Sign In → `/login`, Register → `/register`. FAQ remains available from Home help/Footer via `/faq`, not as a primary masthead item. Footer reaches deeper pages, Home help, Contact Us, and official platform destinations. No new news route, fake article link, contact-form backend, or session-based behavior.

**Responsive/accessibility:** News is a vertical editorial list on mobile, not a horizontal strip. Samples are not falsely clickable. Contact details and platform actions must remain readable/clickable without tiny icon-only controls. Check active/focus treatment, mobile menu closing after cross-route hash navigation, real target positions beneath the masthead, four balanced Footer groups, white-text contrast, external-link semantics where appropriate, and widget clearance.

**Verification:** TypeScript, scoped ESLint/diff checks; verify exact final section order/anchor uniqueness including `contact`, all Navbar/Footer/platform links from all five routes, per-item sample labels at every viewport, and absence of old dated/official-sounding news. Confirm no invented contact endpoint or fake social destination was added. Browser review should assess the assembled Home and shared shell, not just isolated sections. No new API calls or backend tests.

**Stop:** Commit/handoff Task 3 for whole-Landing owner visual review before deeper page work. Record which contact/program details still await client confirmation. A rejection requires bounded revision/instruction; do not treat technically passing checks as acceptance or proceed automatically.

### Task 4 — Coordinated Programs, About, and FAQ public-page refinement

**Visual goal:** Make the three information destinations consistent with the accepted Landing/shell while keeping them useful deeper reading experiences. This is one coordinated information-page package, not an unrelated system-wide copy rewrite.

**Exact likely files:**

- Modify `frontend/src/app/(public)/programs/page.tsx`, `frontend/src/app/(public)/about/page.tsx`, `frontend/src/app/(public)/faq/page.tsx`.
- Add `frontend/src/components/programs/programs-directory.tsx` if needed for a narrow client-side local search/type-filter boundary; this directory is new, not an existing repository component.
- Extend `frontend/src/content/public-site-content.ts` and named deeper-page classes in `frontend/src/app/(public)/public-site.css`.

**Assets/content:** Reuse the already labelled About image and real seals; no additional photography is required. Programs shares Home's official EARIST-source/client-confirmation snapshot from the two Graduate School pages. Reconcile differing majors/wording only from client confirmation; do not silently combine the pages. Remove unsupported admissions-open text, statistics, and software mission/vision from the redesigned presentation. Use approved institutional prose if available. Verify detailed FAQ claims against canonical sources before reuse; omit or flag unresolved public-policy text for confirmation rather than inventing a replacement rule. Do not change the underlying workflow or chatbot text.

**Shared blast radius:** These three pages plus explicitly shared public content/styles. Local catalog/search/filtering does not alter registration options or API responses. Preserve `/programs`, `/about`, `/faq` and existing actual account actions. Do not introduce program detail routes or registration preselection.

**Responsive/accessibility:** Reading-oriented headers, natural title wrapping, accessible directory controls and result/empty feedback; real local filtering if search is shown. FAQ controls need proper state/relationships, keyboard operation, and labelled search. No internal schema/model terms or tiny dense metadata.

**Verification:** TypeScript, scoped ESLint/diff; focused local filter behavior for query/type/clear/no-match and FAQ disclosure/search where implemented; responsive/keyboard review of all three routes; check Home's shared content has not drifted. Add only focused tests if substantive filtering warrants them, not layout snapshots or sentence-mirroring tests. Build only for meaningful new client/server wiring or concrete uncertainty.

**Stop:** Commit/handoff these three routes. Record unresolved production content and owner review status; do not advance to Repository or integration automatically.

### Task 5 — Repository public-page framing

**Visual goal:** Coordinate the Repository's outer institutional header, gutters, and reading hierarchy while retaining its functional catalog as an existing resource.

**Exact likely files:** `frontend/src/app/(public)/repository/page.tsx`; page-owned classes in `frontend/src/app/(public)/public-site.css` only if necessary.

**Assets/content:** None required. No sample publications, replacement catalog data, new photos, live Home feeds, or new copy promising universal download availability.

**Shared blast radius:** Public route framing only. `frontend/src/components/repository/repository-browser.tsx`, its props contract, query keys, API helper, citation modal, document viewer/proxy, types, backend, and authenticated portal usages remain unchanged. Do not use CSS to redesign browser internals indirectly.

**Responsive/accessibility:** Avoid redundant oversized page/catalog titles, keep usable filter area width, preserve heading order and existing functional catalog controls. Check narrow viewports, shared masthead anchors, focus visibility, and loading/error/empty presentation as it actually exists.

**Verification:** TypeScript, scoped ESLint/diff; confirm protected shared-component/API files are byte-unchanged. Where a running environment and authorized accounts exist, smoke existing guest discovery/search and authenticated document/citation paths without changing permissions or data; otherwise mark those checks NOT EXECUTED and hand them to owner QA. Do not seed data, provision accounts, or modify backend to enable visual checks.

**Stop:** Commit/handoff the outer Repository refinement only. Shared functional browser defects or desired redesigns are separate scope.

### Task 6 — Consolidated verification and owner handoff

**Visual goal:** Assess the full public experience and record evidence, owner feedback, and production-content readiness separately. This is a review/handoff package, not permission for unbounded last-minute fixes or deployment.

**Exact likely files:** Add `docs/superpowers/reports/2026-11-08-landing-page-redesign-v2-report.md`; reconcile `docs/superpowers/reports/2026-11-08-landing-page-redesign-v2-assets.md`. Any concrete source correction must first be named and kept within the relevant authorized package's files; do not pre-authorize arbitrary changes here. Preserve the V1 report and rejection record.

**Assets/content:** Inventory every review image/sample, rights/provenance and replacement requirement. Missing approved production content is a recorded dependency, not a reason to build a backend or present samples as official.

**Shared blast radius:** Verify Home, Programs, Repository, FAQ, About, shared Navbar/Footer, deep-route anchor navigation, and unchanged chatbot clearance. Confirm auth/portal/backend/canonical boundaries in the complete actual diff.

**Responsive/accessibility:** Browser review of desktop/tablet/mobile, 320px reflow, 200% zoom, keyboard-only navigation/accordions, contrast, image crops/labels, sticky targets, footer groups, and menu resize/cross-route behavior. Report unavailable checks without claiming they passed.

**Verification:** Reconcile valid per-package results. Run final frontend typecheck and scoped lint when they are not already valid at the final source HEAD. Run one build if the final assembled wiring has not been built at its final state or a specific change invalidated prior evidence; do not run identical builds after report-only changes. Inspect full actual diff, tracked assets, local/remote ancestry and clean state. Do not run unrelated backend/Prisma/full-suite checks. Separate local checks, browser QA, hosted CI, independent source review, and owner visual/content acceptance in the report.

**Stop:** Deliver the exact verified commit/remote state and pending owner decisions. No merge, deployment, canonical sync, news integration, or next task starts automatically. A visually accepted preview may still be explicitly **NOT production-content ready**.

## 6. Dependencies and production-content gate

Implementation can progress without new backend/API/database/CMS work. The visual-preview dependencies are selected usable imagery, visible provenance labels, neutral news samples, official-source program/contact review content, and client confirmation where the official Graduate School pages conflict. Higher-resolution official logos are desirable but not required at the modest specified display sizes.

Production-content acceptance separately requires owner-approved real institutional photography/rights, a reconciled program catalog/degree grouping, About prose, confirmed contact/social destinations, and real news content/destinations or an approved honest empty state. Before removing any preview notice, replace or omit every unapproved item on that page and recheck its alt text, crop, wording, and links. No environment mode may silently turn a sample into authoritative content.

An official public-news publishing workflow, live catalog integration, institution-wide font changes, chatbot corrections, and deeper Repository component work are deferred scopes. They are not implicit prerequisites for visual acceptance and are not authorized by this plan.

## 7. Verification and commit checks for the current documentation-only package

This delivery should contain exactly:

1. Modified `docs/superpowers/reports/2026-11-08-landing-page-redesign-report.md` for the current owner verdict and preserved historical context.
2. Added `docs/superpowers/specs/2026-11-08-landing-page-redesign-v2-design.md`.
3. Added `docs/superpowers/plans/2026-11-08-landing-page-redesign-v2.md` (this file).

Review the exact staged/complete two-commit diff; validate local Markdown links and code-path references, section coverage, task file sets, execution stops, and hard boundaries. Run `git diff --check ab6086026ec68715035f36be91663b6e306af2fd...HEAD` after both commits. Use this documentation starting commit so the old V1 specification's historical Markdown hard breaks do not contaminate the new-package check.

No frontend/backend tests, lint, TypeScript, build, migrations, seeds, image generation, or browser QA is required or claimed for this documentation-only change. The earlier V1 technical evidence is not V2 verification. Verify normal push and live remote ending HEAD, current main, exact changed-file set, preserved ancestry, and clean local worktree before delivery. If hosted CI has not actually run, do not label local Markdown checks as hosted CI.

## 8. Delivery boundary

The present request ends after recording V1 rejection, committing the V2 specification/report update, committing this plan, and pushing those documentation commits to `feat/landing-page-redesign`. Return verified starting/ending HEAD, commit IDs, the three changed files, concise design/task summary, asset/content dependencies, and confirmation of no source/backend/canonical-document changes. Do not implement Task 1 or any later package until explicitly instructed.
