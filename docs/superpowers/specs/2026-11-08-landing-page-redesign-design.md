# Landing Page Redesign — Design Specification

**Project:** EARIST Graduate School Information System (GS-IS)  
**Date:** 2026-11-08  
**Status:** APPROVED DESIGN DIRECTION — IMPLEMENTATION PENDING  
**Branch:** `feat/landing-page-redesign`  
**Starting main:** `045316540d97364214792c7d441ae20a1e426d4c`

## 1. Purpose

This specification defines the product, visual, content, and information-architecture direction for the GS-IS public Landing Page redesign.

The goal is to replace the current generic/template-like landing experience with a polished institutional Graduate School homepage that feels intentional, credible, modern, and clearly connected to EARIST.

This document defines **what the redesigned Landing Page should communicate and feel like**. It intentionally does not prescribe exact React component structure, Tailwind utilities, file decomposition, or implementation sequencing. Those decisions must come from a repository-grounded Codex audit and implementation plan.

## 2. Scope

This feature is limited to the **public Landing Page / public home experience**.

Authorized scope may include, when required by the approved implementation plan:

- `frontend/src/app/(public)/page.tsx`;
- Landing Page-specific components under `frontend/src/components/landing/`;
- Landing Page-specific visual assets;
- bounded adjustments to shared public Navbar/Footer only when needed for the accepted Landing Page direction and safe for the other public routes;
- responsive and accessibility refinements directly related to the Landing Page;
- visible Landing Page wording that follows the canonical copy authority.

## 3. Explicit non-goals

Do not change:

- Login page design or behavior;
- Forgot Password;
- authentication/session behavior;
- role validation;
- middleware;
- portal access or authorization;
- Applicant registration behavior;
- Faculty/Admin access implementation;
- PANELIST-to-FACULTY migration behavior;
- backend workflow authority;
- academic policies;
- public Programs, FAQ, About, or Repository page functionality unless a separately approved bounded change is required;
- chatbot behavior/content as part of this package;
- canonical shared documentation as part of this parallel branch.

The separate Faculty/Admin workstream remains independent.

## 4. Authority

The implementation must use the following precedence:

1. current accepted GS-IS domain behavior and canonical repository authority;
2. `docs/superpowers/USER_FACING_COPY_SOURCE_OF_TRUTH.md` for visible wording;
3. `docs/superpowers/ui-ux/SYSTEM_UI_UX_PLAYBOOK.md` for UI/UX rules;
4. this Landing Page design specification for the bounded redesign;
5. current Landing Page source as implementation baseline/evidence;
6. external design/anti-slop references as craft guidance only.

If an external design rule conflicts with GS-IS authority or this specification, GS-IS authority wins.

## 5. Current-state problems to correct

The redesign should directly address the following observed issues:

- the current page reads like a generic university/SaaS template instead of an official EARIST Graduate School experience;
- the centered hero, repeated CTA treatment, card-heavy sections, generic promotional wording, and decorative scroll indicator create an AI/template-like presentation;
- hero imagery references `/images/campus-hero.jpg`, but that asset is not present in the current repository public assets;
- the current Programs section uses a repetitive six-card presentation;
- the current Repository preview contains hard-coded sample research titles/authors and a non-functional search field;
- the current Announcements section contains hard-coded dated items that can become stale;
- the current Footer contains placeholder-style social links and unverified/static institutional content;
- several unused Landing components contain legacy concepts or wording that should not be revived blindly;
- the current page does not clearly establish an intentional hierarchy for prospective Applicants, existing users, Faculty, and public visitors.

## 6. Product character

Target visual character:

- institutional;
- editorial;
- modern;
- restrained;
- credible;
- readable;
- calm;
- distinctly EARIST;
- content-led rather than decoration-led.

The experience should feel like an **official Graduate School digital front door**, not a startup marketing page, admin dashboard, or generic AI-generated university template.

Avoid:

- excessive gradients;
- glow effects;
- decorative blobs;
- unnecessary pills/badges;
- card soup;
- icon-grid feature marketing;
- exaggerated rounded containers;
- fake statistics;
- fabricated testimonials/research;
- purposeless motion;
- generic SaaS headings;
- repeated sections with identical visual structure.

## 7. Anti-slop design guardrails

External anti-slop resources may be used by the implementing agent as a review aid, including the `heydamir/unslop` guidance when available in the Codex environment.

These references are subordinate to project authority.

Apply the following distilled guardrails:

1. **Design from the institution and user task, not from common landing-page patterns.**
2. **Use fewer, stronger visual moments.** Do not make every section visually loud.
3. **Avoid repetitive card grids when typography, spacing, lists, editorial composition, or divided layouts communicate hierarchy better.**
4. **One section should have one dominant hierarchy.**
5. **Do not add a decorative element unless it has a clear information, identity, or interaction purpose.**
6. **Use spacing, typography, scale, alignment, and contrast before adding containers.**
7. **Do not use marketing claims that cannot be verified from authoritative project/institutional information.**
8. **Do not use fake data as credibility decoration.**
9. **Keep motion subtle and functional.**
10. **Prefer deliberate asymmetry/editorial composition when it improves the page over default centered-stack layouts.**
11. **Do not mechanically remove cards, gradients, or icons; use them only where they genuinely improve communication.**
12. **Review the final page for recognizable AI-template patterns before acceptance.**

The external skill itself must not be committed into the application repository as production source unless separately authorized.

## 8. Landing Page information architecture

The target page should use the following conceptual hierarchy.

Exact visual implementation is for the Codex plan, but the information priorities must remain intact.

### 8.1 Institutional navigation

The public header should clearly establish:

- EARIST identity;
- Graduate School identity;
- access to legitimate public destinations;
- a clear existing-user sign-in path.

Do not make navigation visually compete with the hero.

Any Navbar change must account for its shared use by the other public routes.

### 8.2 Hero — EARIST Graduate School identity

The hero is the primary institutional statement.

It should:

- clearly identify EARIST Graduate School / GS-IS;
- communicate the public purpose without generic marketing language;
- provide one dominant action for the prospective Applicant;
- provide at most one clear secondary action for existing users;
- use a credible institutional visual treatment;
- avoid a generic dark-gradient-over-stock-photo look;
- avoid decorative bouncing/scroll indicators.

The hero must not claim unsupported admissions availability, deadlines, rankings, outcomes, or institutional statistics.

### 8.3 Access / user-path guidance

Immediately after or naturally integrated with the hero, users should be able to understand the main paths:

- prospective Applicant;
- existing Applicant/Student/Faculty user;
- public visitor seeking Programs or Research.

This should not become a large four-card "Role-Based Portals" grid.

Role/account wording must remain compatible with the approved future Faculty direction without implementing the Faculty migration in this feature.

### 8.4 Graduate Study at EARIST / Programs pathway

The page should introduce graduate study and provide a clear path to the Programs page.

Prefer an editorial/list-based or otherwise content-appropriate treatment rather than repeating six near-identical promotional cards.

Do not hard-code public program claims that cannot be supported by authoritative current data.

### 8.5 Graduate Research / Repository pathway

Research should feel distinct from the Programs section.

It should:

- establish the Research Repository as a credible public/institutional resource;
- direct users to the existing Repository page;
- avoid fabricated research titles, authors, abstracts, counts, or sample credibility content;
- avoid a fake/non-functional search control on the Landing Page.

If live authoritative repository information is not safely available in this bounded package, prefer a truthful static institutional introduction and link over synthetic preview data.

### 8.6 News & Announcements

Announcements may remain only when the implementation can present authoritative/current information without inventing data.

Do not ship stale hard-coded announcements as if they are current.

If no authoritative current announcement source exists within the bounded feature scope, use a simpler truthful alternative or omit the section rather than fabricate freshness.

### 8.7 Institutional information / contact

Provide only verified and useful Graduate School information.

Do not preserve placeholder social links, unsupported mission copy, or unverifiable contact information merely because it exists in the old Footer.

Any shared Footer change must be evaluated for impact on all public routes.

## 9. Copy direction

All visible wording must follow `USER_FACING_COPY_SOURCE_OF_TRUTH.md`.

Landing-specific copy should:

- be concise;
- sound institutional rather than promotional;
- state what the user can actually do;
- avoid vague claims such as "everything you need" or "advance your career" when unnecessary;
- avoid implementation terminology;
- avoid internal role/model names;
- preserve official academic/institutional terminology;
- avoid duplicating information already communicated by layout;
- use consistent action labels.

CTA wording must reflect actual behavior.

For example, do not imply that GS-IS itself begins the full institutional application process if the accepted flow requires an Applicant to first obtain a Pinnacle Applicant ID.

Exact final CTA wording may be finalized during implementation review if the current canonical application flow requires wording verification.

## 10. Imagery and assets

The final design should use credible institutional visual material.

Rules:

- do not reference missing assets;
- do not introduce random stock imagery merely to fill the hero;
- prefer real EARIST/Graduate School imagery when a properly authorized asset is available;
- if no approved photo is available, use an intentional non-photo institutional composition rather than a broken placeholder;
- decorative imagery must not overwhelm content or reduce text contrast;
- assets must be optimized appropriately for the web.

The Codex audit should determine what approved repository assets currently exist and identify any required asset dependency before implementation.

## 11. Visual hierarchy and composition

The redesign should:

- reduce repetitive centered sections;
- use stronger editorial rhythm;
- establish meaningful contrast between Programs, Research, and institutional information;
- use whitespace intentionally;
- avoid wrapping every content block in a card;
- maintain a restrained EARIST color presence;
- keep typography hierarchy strong without making every heading oversized/bold;
- preserve a practical reading width;
- avoid decorative complexity that creates no user value.

The page must remain coherent with the wider GS-IS visual language while having a public-facing institutional character distinct from portal dashboards.

## 12. Responsive behavior

The design must be intentional at narrow/mobile widths, not merely a desktop layout collapsed into one column.

At minimum:

- hero content remains readable and prioritized;
- CTA hierarchy remains clear;
- navigation remains usable;
- no horizontal overflow;
- no fixed-size decorative elements that obstruct content;
- Programs/Research treatments remain understandable without excessive vertical repetition;
- typography and spacing scale appropriately;
- touch targets remain practical.

## 13. Accessibility baseline

Preserve or improve:

- semantic heading order;
- keyboard-accessible navigation/actions;
- visible focus states;
- sufficient text/background contrast;
- meaningful link/button labels;
- reduced reliance on color alone;
- alt text for meaningful imagery;
- respect for reduced-motion preference when animation is introduced.

## 14. Shared public-layout boundary

`Navbar`, `Footer`, and `ChatbotWidget` are currently shared by public routes.

Therefore:

- changes to Navbar/Footer require explicit impact review against Programs, Repository, FAQ, and About;
- do not redesign unrelated public pages as a side effect;
- do not change Chatbot behavior/content in this package;
- prefer Landing-specific composition when a shared-layout change would unnecessarily broaden scope.

## 15. Content authority rules

Do not use placeholder/demo content in the final public Landing Page to make the design appear complete.

Specifically avoid:

- invented student/research names;
- invented publication titles;
- invented institutional statistics;
- invented deadlines;
- invented announcements;
- unsupported claims about rankings, outcomes, program counts, or admissions availability;
- placeholder social links.

When authoritative live data is unavailable, prefer less content over false content.

## 16. Codex responsibilities

After this spec is accepted, the Codex agent must:

1. verify the live feature-branch/base state;
2. read this specification and the canonical copy/UI authorities;
3. audit the current Landing Page and all directly affected shared public components;
4. inspect available public assets and data sources relevant to the design;
5. identify exact affected files and shared-boundary risks;
6. use the external `unslop` skill/reference if available as a **craft-quality audit aid only**;
7. produce a repository-grounded implementation plan;
8. identify any spec conflicts or authoritative-content gaps;
9. define focused verification appropriate to the UI-only scope;
10. STOP after the plan.

The first Codex task is **audit + implementation plan only**. It must not implement the redesign until the plan has been reviewed and approved.

## 17. Implementation-plan expectations

The plan should state:

- exact starting branch/HEAD;
- exact files expected to change;
- whether any shared Navbar/Footer change is necessary;
- asset strategy;
- section/component strategy;
- content/data strategy;
- responsive/accessibility strategy;
- anti-slop review checkpoints;
- focused TypeScript/lint/build or verifier checks;
- explicit non-goals;
- known risks;
- task ordering;
- stop condition.

The plan should not broaden into Login/Auth/Faculty/Admin work.

## 18. Manual QA and acceptance

The project owner performs final manual/browser QA.

The coding agent should report browser/manual QA honestly and must not claim project-owner acceptance.

Final review should include:

- desktop visual hierarchy;
- narrow/mobile layout;
- navigation;
- hero readability;
- CTA clarity;
- Programs/Research distinction;
- absence of fake/stale content;
- shared Navbar/Footer regressions if changed;
- keyboard/focus basics;
- obvious AI-template/slop patterns;
- wording quality.

The redesign is accepted only after project-owner visual review.

## 19. Parallel-development documentation rule

This branch intentionally does **not** update the shared canonical documentation files during parallel implementation.

Do not modify from this feature branch solely to record the Landing Page redesign:

- `SYSTEM_UI_UX_PLAYBOOK.md`;
- `USER_FACING_COPY_SOURCE_OF_TRUTH.md`;
- `GSIS_IMPLEMENTATION_CHECKLIST.md`.

Accepted implementation findings should instead be recorded in the dedicated Landing Page feature report under `docs/superpowers/reports/`.

A later documentation-synchronization session can review the accepted implementation and feature report, then decide what should be promoted into the canonical documentation after parallel workstreams have been reconciled.

## 20. Definition of success

The redesigned Landing Page succeeds when:

- it immediately feels like an official EARIST Graduate School experience;
- users can understand the main public and access pathways without unnecessary explanation;
- the visual hierarchy is intentional rather than template-derived;
- Programs and Research are presented credibly and distinctly;
- no fabricated/stale content is used to fill the layout;
- the design is substantially less card-heavy and less SaaS-like than the current page;
- visible wording is concise and authoritative;
- the page works well on desktop and mobile;
- authentication and portal behavior remain untouched;
- the project owner accepts the final visual result.
