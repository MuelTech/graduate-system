# Landing Page Redesign — Implementation Plan

**Project:** EARIST Graduate School Information System (GS-IS)
**Date:** 2026-11-08
**Branch:** `feat/landing-page-redesign`
**Status:** Approved audit/plan; Task 1 authorized; Tasks 2 and 3 require separate instruction.
**Verified starting remote HEAD:** `eb9c392e4f17782325ffbb9330f5564faf605395`
**Parent / starting main:** `045316540d97364214792c7d441ae20a1e426d4c`

## 1. Authority and execution boundary

Read and follow:

- [Approved Landing Page design specification](../specs/2026-11-08-landing-page-redesign-design.md).
- [User-Facing Copy Source of Truth](../USER_FACING_COPY_SOURCE_OF_TRUTH.md).
- [System UI/UX Playbook](../ui-ux/SYSTEM_UI_UX_PLAYBOOK.md).
- [Engineering Verification Policy](../ENGINEERING_VERIFICATION_POLICY.md).

Current accepted domain behavior and canonical repository authority govern behavior. Copy authority governs wording; the playbook governs presentation and interaction; the approved bounded design governs this redesign. External craft references cannot change product behavior, information architecture, content authority, authentication, roles, or authorization.

This plan persists the completed repository audit and accepted three-task decomposition. The current authorization is: commit this plan, implement and commit **Task 1 only**, then stop. Task 1 includes its own focused verification and owner handoff; the later Task 3 does not defer those checks.

## 2. Verified repository state and parallel-development safety

The live GitHub branch was verified again before persisting this plan and still points to the starting SHA above. That commit adds only the Landing Page design specification to its parent. The original local checkout was clean on `main`; the existing checkout is being reused on the requested feature branch.

Before each implementation package and before publishing commits:

1. Recheck remote branch HEAD, local HEAD, branch, and worktree changes.
2. Inspect intervening commits and preserve unrelated work. Do not reset, overwrite, merge, rebase, or force-push to manufacture the expected base.
3. Stage exact package paths and inspect staged diffs. Keep the plan commit separate from Task 1 source changes.
4. If remote advancement prevents a safe fast-forward publication, inspect it and report the conflict rather than overwrite it.

## 3. Repository-grounded audit

| Surface | Finding at the starting commit |
| --- | --- |
| Home composition | `frontend/src/app/(public)/page.tsx` mounts Hero, Programs, Repository, and Announcements. It lacks the approved compact access-guidance layer and repeats centered section/card treatments. |
| Hero | `hero-section.tsx` references absent `/images/campus-hero.jpg`, uses a dark gradient and bouncing scroll indicator, and labels GS-IS registration as “Start Your Application” without its Applicant ID prerequisite. It has an unnecessary client boundary for static content. |
| Programs | `programs-section.tsx` contains six hard-coded program/department/residency cards disconnected from the database, generic career copy, and undefined `--earist-muted-foreground`. |
| Research | `repository-section.tsx` contains three sample publications with names, years, and abstracts, an inert search field, and “Read More” links that all lead to the repository index. |
| Announcements | Five hard-coded May–June 2026 entries imply current news; their destinations are FAQ/Repository rather than announcement details. “View All” leads to FAQ. |
| Navbar | Already provides EARIST/Graduate School identity, public destinations, and account links. Its mobile toggle lacks `aria-expanded`/`aria-controls`; account links do not close the disclosure. Desktop fit near the `md` breakpoint needs runtime review. |
| Footer | Includes placeholder `#` social destinations, unsupported mission/contact content, and `/privacy`/`/terms` links with no matching app routes found. Low-opacity text needs contrast review. |
| Dormant sections | CTA, Features, How It Works, and Portal components retain generic marketing, workflow claims, or legacy role wording. Do not mount or clean them up in Task 1. |
| Shared public shell | `frontend/src/app/(public)/layout.tsx` owns Navbar, Footer, main, and ChatbotWidget. Shell edits affect Home, Programs, Repository, FAQ, and About. Authentication pages have a separate layout. |

This is source/asset evidence, not browser/manual acceptance. No dedicated Landing verifier was found in the existing frontend scripts or tests.

## 4. Content, data, and composition decisions

### Hero and access guidance

- Use an editorial, non-photo composition centered on EARIST Graduate School identity and the purpose of GS-IS.
- Use **Register for GS-IS** as the dominant `/register` action and **Sign In** as the secondary `/login` action.
- State concisely that a Pinnacle Applicant ID is required before GS-IS registration. The existing registration page requires an Applicant ID issued after initial application processing; the accepted spec also establishes the Pinnacle prerequisite.
- Give existing users a concise account-access cue. Avoid role selectors, role-specific portal links, role-card grids, migration language, or role-dependent rendering.
- Integrate compact public Programs/Research guidance without another prominent CTA row or repeated registration CTA.
- Remove the missing photo, dark photo overlay, scroll indicator, and purposeless animation.

### Programs

- Replace the six-card catalog with a graduate-study introduction and `/programs` link.
- Do not reproduce program names, departments, residency limits, counts, or admissions-availability claims.
- `GET /api/programs` is public and returns database graduate/undergraduate records, but does not establish admissions availability. No new landing request is needed for the approved static pathway.
- The destination Programs page contains its own hard-coded content and inert search. Record that limitation; do not modify it or use it as authoritative landing content.

### Research

- Use a composition distinct from Programs: a reading-oriented introduction and `/repository` pathway.
- Remove sample publications and the inert search, rather than replace them with different synthetic data.
- The existing Repository page mounts `RepositoryBrowser`, which uses the public publication API. Public discovery exposes published metadata; full-text document access retains existing sign-in/authorization boundaries.
- Keep research search, records, citations, and document interactions at the existing destination. Do not import the full browser into Home or change publication/document access.

### Announcements and institutional information

- Remove Announcements from Home composition. Leave the dormant component and barrel export unchanged.
- Memos require authentication; settings require Admin authorization. Do not expose or repurpose either as a public announcement/contact source.
- Do not claim “no announcements”; omission is not a database empty state.
- Do not invent programs, availability, deadlines, statistics, research, testimonials, contact details, or institutional claims. Prefer less content over unsupported content.

## 5. Asset strategy

- `frontend/public` contains starter SVGs, not an approved campus photograph.
- Existing owner-supplied assets are documented in `backend/assets/official-forms/README.md`: EARIST seal `earist-logo.jpg` (141×141) and Graduate School seal `graduate-school-logo.jpg` (207×207). Both were visually inspected during the audit.
- If appropriate to the implemented hierarchy, copy the EARIST seal unchanged to `frontend/public/images/landing/earist-logo.jpg`. Preserve the backend original and its consumers. Use it modestly with explicit dimensions, appropriate alt text, and original proportions/colors.
- No external asset is required for the non-photo design. A later photo direction would require an authorized institutional photograph; do not use stock or generated campus imagery.
- Do not enlarge the low-resolution seals into hero artwork, trace, recolor, or invent a substitute mark.

## 6. Expected file set and shared-component decisions

| Task | Expected path | Intended change |
| --- | --- | --- |
| Plan | `docs/superpowers/plans/2026-11-08-landing-page-redesign.md` | Persist this approved plan in a separate first commit. |
| 1 | `frontend/src/app/(public)/page.tsx` | Compose revised Home and remove Announcements import/rendering. |
| 1 | `frontend/src/components/landing/hero-section.tsx` | Institutional hero, truthful registration/access guidance, optional seal, static server component. |
| 1 | `frontend/src/components/landing/programs-section.tsx` | Replace hard-coded cards with the Programs pathway. |
| 1 | `frontend/src/components/landing/repository-section.tsx` | Replace fake publications/search with the Research pathway. |
| 1, if used | `frontend/public/images/landing/earist-logo.jpg` | Byte-preserving copy of the owner-supplied seal. |
| 2 only | `frontend/src/components/landing/navbar.tsx` | Limited disclosure accessibility/interaction corrections. |
| 2 only | `frontend/src/components/landing/footer.tsx` | Remove unsupported content and invalid/placeholder destinations; bounded local contrast correction. |

A Navbar visual redesign is unnecessary: preserve identity, destination set, and general shell. Task 2 may add disclosure state/control attributes, focus/touch improvements, consistent closing after navigation, and appropriate keyboard dismissal. Change the breakpoint only if runtime review establishes crowding.

A bounded Footer content correction is necessary to remove the inherited placeholder/unsupported content. Preserve useful internal navigation and the shell; do not create duplicate footers or pathname-dependent variants. Review inherited effects on all five public routes.

No changes are expected to public/root layouts, global CSS, shared UI primitives, dependencies, API helpers, backend, unrelated public pages, landing barrel exports, or dormant sections. Task 1 must not touch Navbar, Footer, or ChatbotWidget.

## 7. Responsive and accessibility requirements

- Establish mobile content order deliberately: institutional identity, purpose, registration prerequisite/action, existing-user action, public pathways.
- Keep CTA priority clear when stacked; avoid horizontal strips, fixed heights that clip copy, and overflowing long institutional names.
- Use intrinsic layout and CSS breakpoints, existing font family, EARIST tokens, and spacing vocabulary. Do not change system fonts or global tokens.
- Use one `h1`, logical headings, labelled sections where useful, descriptive links, visible focus, adequate contrast, and practical touch targets.
- Preserve meaningful information at browser zoom; reserve image dimensions to avoid layout shift.
- Mark decorative icons appropriately. Use meaningful image alt text without needless repetition.
- Avoid decorative motion. Respect reduced-motion preference if functional transitions are added.
- Owner QA should check whether the unchanged floating chatbot obscures landing actions at narrow widths. Do not modify chatbot behavior/content in this package.

## 8. Anti-slop and microcopy checkpoints

Review after composition and before delivery:

- one dominant hierarchy per section; editorial rhythm rather than identical centered stacks;
- distinct Programs and Research treatments; no repetitive cards, badges, icon grids, or ornamental statistics;
- restrained red/gold, neutral reading surfaces, and practical line lengths;
- every decorative element has an identity, information, or interaction purpose;
- no generic marketing claims, fake search, sample credibility content, or fabricated freshness;
- shortest truthful wording, no duplicated context, no internal terminology, exact institutional terms, and accurate action destinations/prerequisites;
- reuse existing stack/primitives where useful without changing shared primitives to suit one page.

No external `unslop` skill/reference was found in the available catalog or searched skill/plugin caches during the audit. If it becomes available, use it only as a subordinate craft-quality aid. Do not commit external skills or introduce a separate design-system dependency.

## 9. Risks and unresolved boundaries

- Navbar/Footer are shared: their findings remain visible until Task 2 and cannot be reported as resolved by Task 1.
- Programs, FAQ, About, and chatbot retain older unsupported content outside this package. Do not copy it into the redesigned landing sections or claim a system-wide content cleanup.
- Static landing introductions deliberately avoid API availability, session, cache, and loading/error-state dependencies. A future live preview needs its own bounded approval and appropriate state/contract verification.
- Small seals are unsuitable for enlargement. No approved campus photograph is available.
- Historical documentation mentions a `/login` production-build failure. This is not a current baseline result; report actual failures honestly and establish provenance without fixing Login here.
- Parallel work may touch overlapping files. Recheck exact remote/local relationships and review only package-owned diffs.
- Browser visual quality, responsive behavior, keyboard behavior, and owner acceptance cannot be inferred from static checks.

## 10. Accepted task decomposition and ordering

### Task 1 — Landing composition and content

Implement the Hero/access guidance, Programs and Research pathways, removal of announcement rendering, and optional existing seal. Keep changes within the Task 1 file set. Review content and anti-slop requirements, run Task 1 focused verification below, and commit only Task 1.

**Stop after Task 1. Do not begin Task 2 or Task 3 until explicitly instructed.**

### Task 2 — Bounded public-shell corrections

Only when separately authorized: apply limited Navbar accessibility and Footer content corrections. Keep the destination set and auth behavior intact. Review regressions on Home, Programs, Repository, FAQ, and About; do not redesign their page content. Verify and commit this package separately, then stop.

### Task 3 — Focused verification and owner handoff

Only when separately authorized: reconcile evidence for the complete redesign, review exact remote diff/scope and residual concerns, and prepare consolidated owner QA/handoff. Reuse valid prior results; rerun expensive checks only when changes or unresolved risk justify them. Record any later feature report under the dedicated Landing reports area, without updating canonical shared documentation. This task does not authorize new implementation or imply owner acceptance.

## 11. Verification strategy

For the plan-only commit: inspect exact diff and references, run `git diff --check`; no build or test suite is needed solely for Markdown.

For Task 1:

1. Inspect final and staged diffs against the package starting commit; confirm protected/shared files and dormant sections are unchanged.
2. Perform focused composition/content checks: no mounted stale announcements, sample publications, hard-coded program catalog, inert search, missing photo, or bouncing scroll cue; registration prerequisite and existing/public pathways remain clear.
3. Verify each changed link against existing routes and each image against actual assets. If copied, compare the seal bytes/hash to the original.
4. Run frontend `npx tsc --noEmit` and ESLint scoped to the four changed TSX files. Run `git diff --check`.
5. Run one frontend `npm run build`: changed component composition and removal of the hero client boundary justify build-level confidence. Do not repeatedly build without a new reason.
6. No dedicated Landing test harness exists. Use focused source/rendered-markup checks where useful; do not add a broad test framework or brittle sentence/layout tests.
7. Do not run unrelated backend suites, Prisma commands, or the complete frontend verifier collection. Broaden only for a concrete directly related failure/risk.

Owner manual/browser QA is **NOT EXECUTED by the coding agent**. Handoff should cover desktop and narrow/mobile hierarchy, zoom, keyboard/focus, CTA clarity/destinations, image readability, Programs/Research distinction, lack of fake/stale landing content, and chatbot overlap. Task 2 adds shared-shell route/menu/contrast regressions.

Report source checks, typecheck/lint/build, manual QA, and hosted CI separately. Historical or agent-local results are not hosted CI evidence. Independent source review must verify actual remote HEAD, commit relationships, exact files/diff, scope, and authority compliance.

## 12. Non-goals and delivery stop conditions

Do not modify Login, Forgot Password, registration behavior, authentication/session logic, roles, middleware, portal authorization, Faculty/Admin access, backend behavior, academic policy, unrelated public pages, chatbot behavior/content, shared canonical documentation, or dormant components as incidental cleanup.

The current delivery ends after the plan commit and verified Task 1 implementation commit(s). Report starting/ending HEAD, plan and implementation commit IDs, exact changed files, checks/results, deviations, residual Task 2 findings, owner QA items, and local/remote publication state. Do not proceed to Task 2, merge, deploy, or claim visual acceptance.
