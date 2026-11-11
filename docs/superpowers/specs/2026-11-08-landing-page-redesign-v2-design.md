# Public Site and Landing Page V2 — Design Specification

**Project:** EARIST Graduate School Information System (GS-IS)
**Date:** 2026-11-08
**Repository / branch:** `MuelTech/graduate-system` / `feat/landing-page-redesign`
**Status:** Working V2 design authority. Tasks 1–3 have been implemented on the feature branch. The main Task 3 refinement is implemented, with one final Home Programs layout polish still pending before Task 3 closure. Task 4 remains the coordinated redesign of the dedicated `/programs` and `/about` routes. Current owner decisions use the complete selected official Graduate School program listing, keep FAQ on Home, add the public inquiry form, provide accessible smooth same-page navigation, and use official EARIST/Graduate School sources for About content. This document still does not establish final whole-site visual or production-content acceptance.
**Verified documentation starting HEAD:** `ab6086026ec68715035f36be91663b6e306af2fd`
**Verified current main / merge base:** `045316540d97364214792c7d441ae20a1e426d4c`

## 1. Purpose, authority, and historical state

Create a polished Graduate School public front door: photographic, editorial, recognizably EARIST, useful to prospective Applicants, existing users, and public researchers. The opening should establish an academic institution and place; account access should be easy to find without defining the entire page.

The project owner rejected the V1 design and implementation during manual visual QA. The V1 specification, plan, commits, and [feature report](../reports/2026-11-08-landing-page-redesign-report.md) remain historical evidence, not accepted visual precedents. V1's excessive emptiness, weak Hero, detached small seal, generic shared branding, plain content sections, missing news, and sparse Footer are explicit problems to solve.

Authority for V2:

1. The owner's current frontend-first instruction and adopted Public IA + Landing V2 audit/proposal govern this bounded visual direction.
2. Current canonical domain authority and actual accepted behavior govern workflows, permissions, institutional policy, and terminology.
3. [User-Facing Copy Source of Truth](../USER_FACING_COPY_SOURCE_OF_TRUTH.md) governs concise, truthful, role-appropriate wording.
4. [System UI/UX Playbook](../ui-ux/SYSTEM_UI_UX_PLAYBOOK.md) remains a consistency, interaction, accessibility, and behavioral guardrail. It is **not the visual template for V2**. Portal cards, operational page proportions, and the rejected V1 composition must not mechanically determine this public page.
5. [Engineering Verification Policy](../ENGINEERING_VERIFICATION_POLICY.md) governs proportionate verification. External anti-slop/design resources may support craft review but cannot override any authority above.

The existing Calibri/Segoe UI-oriented family is retained. Larger public display typography is scoped to this experience, with no system font replacement or portal type-scale rewrite.

## 2. Frontend-first scope and hard boundaries

First establish and visually validate the public experience with local frontend composition and assets. A complete design preview does not require production data integration.

In scope for later separately authorized packages: Home, shared public Navbar/Footer/layout, local public-only styles/content/images, and bounded visual refinements to `/programs`, `/repository`, and `/about`. The existing `/faq` route remains available for compatibility but is not promoted or scheduled for refinement unless the owner later re-authorizes a separate Help Center.

Do not modify backend routes/services, APIs, response contracts, database content, Prisma/schema/migrations, CMS, authentication/session logic, registration behavior, roles, middleware, portal authorization, Faculty/Admin implementation, Repository backend functionality, chatbot behavior/content, or shared canonical documentation. Do not run seeds or migrations to populate a preview. No dependencies are needed for this direction.

Do not add a public news feed, expose authenticated memos, or create news archive/article routes to make the design look complete. Those are future content/integration decisions. Existing public routes remain reachable; no route deletion or compatibility redirect is required.

## 3. Public information architecture and section order

### 3.1 Final masthead destinations

| Item | Destination | Purpose |
| --- | --- | --- |
| EARIST seal and institutional identity | `/` | Home; replaces a separate Home tab. |
| Programs | `/#programs` | Immediately expose study options on Home. |
| Research Repository | `/repository` | Dedicated repeat-use discovery resource. |
| News | `/#news` | Home News & Announcements feature. |
| About | `/#about` | Home institutional introduction. |
| Contact | `/#contact` | Home contact and official-platform section. |
| Sign In | `/login` | Existing account access. |
| Register | `/register` | Existing registration entry; no behavior change. |

Use root-qualified anchors so the shared Navbar also works from deeper routes. FAQ belongs on Home as the primary public FAQ surface. Do not promote or link the legacy `/faq` route from the new Landing/Footer while its content remains unreconciled; retain the route only for compatibility unless a separate Help Center is later authorized. `/programs` remains the deeper directory and `/about` remains a deeper institutional destination. Research remains a primary route because search, filtering, abstracts, citations, and document access are functional public-resource tasks. Contact is a Home section rather than a new route; Footer and relevant calls to action may also target `/#contact`.

### 3.2 Exact Home order

1. Institutional masthead; a compact visible design-review notice beneath it while preview assets/content remain.
2. Photographic Hero, including registration prerequisite and actions.
3. Graduate Programs (`programs`).
4. News & Announcements (`news`).
5. Graduate Research (`graduate-research`).
6. About the Graduate School (`about`).
7. Getting Started & FAQ (`getting-started`; FAQ subsection `faq`).
8. Contact Us (`contact`), including official-source contact and platform destinations with client-confirmation status where needed.
9. Institutional Footer.

Keep the old `graduate-study` anchor as an unobtrusive compatibility target at the Programs section if practical; it must not duplicate a section or confuse heading order. `graduate-research` already has a useful existing target.

## 4. Masthead and institutional identity

Use a solid warm-white masthead with a fine burgundy/gold detail, aligned to the page's content gutter. The desktop composition is identity left, five public links in the middle/right, and separated account actions at the end. Avoid a translucent SaaS toolbar treatment.

Render the actual EARIST seal, unchanged, at approximately 60–64 CSS pixels on desktop. Pair it with the full institutional name, Eulogio "Amang" Rodriguez Institute of Science and Technology, using the accepted compact lockup. Do not repeat a separate Graduate School line in the masthead; the Hero owns that page identity. Allow the institutional name to wrap cleanly without making the masthead unnecessarily tall. Desktop height is approximately 88–96px, allowed to grow with text/zoom.

Sign In is a quiet text action. Register is a compact outlined burgundy action. The Hero owns the strongest filled action. Use these labels consistently instead of alternating Login and Sign In.

Use the existing mobile disclosure semantics and improve rather than discard them: native trigger, `aria-expanded`, controlled panel, hidden collapsed links, Escape dismissal, focus return, and close after navigation. Collapse before identity/navigation crowding occurs, initially around 1200px and adjusted from actual fit rather than retaining `md` by habit. No role selector, portal menu, or session-driven account behavior is introduced.

On mobile, retain a 44–48px seal, the accepted compact institutional-name lockup, and menu trigger. Preserve the current Task 1 masthead hierarchy rather than reintroducing the removed duplicate Graduate School line.

## 5. Hero composition, message, and actions

Desktop: approximately 45% editorial text / 55% substantial photograph, with a 500–560px visual height as a target rather than a clipping fixed height. The warm-white copy area aligns with the masthead gutter; the photograph fills the adjoining right area with a deliberate crop. A thin gold rule or restrained burgundy edge may connect the two halves. Keep the photograph as a dominant visual, not a thumbnail inside another card.

Headline: **EARIST Graduate School**. Supporting copy: **Explore graduate programs, published research, and information for applicants and the EARIST academic community.** Use the full institutional name as supporting identity where needed, without duplicating a large seal in the Hero. GS-IS is a supporting account-service identifier, not the public headline.

Actions:

- Primary filled burgundy: **Explore Programs** → `/#programs`.
- Secondary outlined/text action: **Register for GS-IS** → `/register`.
- Concise nearby prerequisite, associated with registration: **A Pinnacle Applicant ID is required.**

Existing-user Sign In stays in the masthead; do not rebuild the V1 account-access column, role-card grid, or a competing access dashboard below the Hero.

Image direction: identifiable EARIST campus architecture or genuine Graduate School activity for production. For visual QA, a labelled substitute may demonstrate architecture, natural light, and academic context without pretending to document EARIST. Copy stays outside the photo; no readability-dependent dark overlay, fake campus signage, carousel, bouncing scroll cue, or floating statistics.

Mobile order: identity/headline, short supporting copy, primary and secondary actions with prerequisite, then a meaningful landscape image crop. Preserve photography and hierarchy; do not simply hide the image or make the hero a full-screen text panel.

## 6. Graduate Programs

Home must show the complete working Graduate School program offerings rather than a curated four-plus-four sample. Use a short introduction and two readable directory groups: **Master's Programs** and **Doctoral Programs**. Preserve degree names and published majors from the selected official EARIST Graduate School source. Long major lists may wrap or use subordinate rows; do not collapse them into invented summaries. No repeated icon cards, promotional descriptions, residency badges, invented career outcomes, admissions availability, or deadlines.

The Home composition must respond to the actual unequal group lengths. Do **not** force Master's and Doctoral groups into equal-height side-by-side columns when the result leaves a large dead area after the shorter group. Prefer a balanced editorial directory: each degree group may occupy its own full-width block, with its program rows flowing into responsive internal columns where useful. On narrow screens, keep a simple single-column reading order. The goal is compact visual rhythm without artificial spacing, duplicated content, or hiding official offerings.

Use **View All Graduate Programs** → `/programs`. Home entries can be non-interactive directory rows; do not give them false program-specific Apply links or invent detail routes. A program list must not change or preselect registration state.

The official EARIST Graduate School pages are now the public content references for program names and degree groupings:
- https://earist.edu.ph/graduate-school/
- https://earist.edu.ph/graduate-school-2/

For the current working catalog, use **https://earist.edu.ph/graduate-school-2/** as the selected official source of the program offerings displayed in the system. The older **https://earist.edu.ph/graduate-school/** remains provenance/comparison evidence only. Where the two official pages differ, do not expose audit-style conflict language to ordinary visitors. The selected page is the editable working source until the client supplies a correction; client corrections then replace the affected content directly. Preserve the source provenance in feature documentation. Do not invent degrees, majors, admissions availability, residency limits, deadlines, or program-specific application behavior.

`/programs` remains the deeper visual directory and should use the same working official listing. Any displayed search/type controls must actually filter that local list; otherwise omit them. This is frontend presentation only, not program administration or admissions integration.

## 7. News & Announcements

Restore this section between Programs and Research. Desktop: one featured editorial item on approximately half the width, optionally with a 16:9 image, and two or three compact rows beside it. Use headline, short summary, and restrained metadata, separated by rules rather than identical cards. Mobile: featured item first, then normal vertical rows; no horizontal-only carousel.

Design QA may use local sample entries with neutral titles such as **Sample announcement headline** and **Sample Graduate School update**. Each item must visibly say **Sample content — design review only**. Use **Sample date** or omit dates; do not fabricate calendar dates, admissions deadlines, events, policies, awards, achievements, speakers, or institutional claims. The section also states that the items are layout samples, not official announcements.

In the preview, items are non-link editorial articles with no pointer/hover affordance implying a destination. Do not add fake Read More/View All links, link samples to FAQ/Repository, or create an archive just for appearances. If a local disclosure is used, it must actually open clearly labelled sample text; it is not an official article. The initial preferred treatment needs no disclosure.

Current authenticated memos are not a public content source. Real news publishing, approved external article links, or `/news` routes require a separate future content/integration scope. News must remain visible for design review; the absence of a production feed is not a reason to delete the section again.

## 8. Graduate Research feature

Use a full-width burgundy feature as the page's strongest section contrast. Inside a shared gutter, place a large white heading, concise copy, and a cream action on roughly 60% width, with research/seminar/library photography on the remaining area. An image may extend slightly into the section padding if it remains aligned and responsive; avoid floating dashboard cards.

Heading: **Graduate research at EARIST**. Copy: **Explore published research titles, abstracts, and citations in the Research Repository.** Action: **Browse Research Repository** → `/repository`. Secondary access guidance may state: **Full-text access requires institutional sign-in where a manuscript is available.**

Use a labelled photographic substitute during QA if needed. Never fabricate publication titles, authors, abstracts, counts, awards, thumbnails, or sample research records. Home does not mount `RepositoryBrowser`, duplicate its filters, or include a fake search. Keep existing Repository functionality and document permissions intact.

## 9. About and Getting Started / FAQ

About is a lighter institutional composition: approximately 40% image/seal and 60% concise text, with a white or warm-cream surface. Use the separate Graduate School seal as a secondary identifier at 72–88px where useful, not as a replacement for the primary EARIST seal. Link **About the Graduate School** → `/about`.

Use official EARIST sources for institutional/About copy rather than system-generated placeholder prose. The official Graduate School page (`https://earist.edu.ph/graduate-school/`) is the primary Graduate School-specific reference and publishes Graduate School Goals covering professional/leadership development, advancement of knowledge and research, and values for progressive leadership. The official EARIST About page (`https://earist.edu.ph/about/`) may provide clearly institution-level Vision, Mission, Goals, Objectives, and Philosophy when broader EARIST context is useful. Keep Graduate School-specific and institution-wide statements clearly distinguished.

Do not borrow the current software/system Mission/Vision, technology-stack descriptions, role lists, or product-feature marketing from the legacy `/about` page. Do not fabricate history, leadership, rankings, enrollment counts, alumni totals, affiliations, testimonials, or outcome claims. Home About should remain concise; the dedicated `/about` route in Task 4 may present richer verified institutional context.

Getting Started is the primary public FAQ/help surface on Home. Keep a concise introductory column and a useful set of FAQ rows covering the verified public/account pathways, including registration's Pinnacle Applicant ID prerequisite, existing-user Sign In, Programs, and public Repository browsing. Use real `/register`, `/login`, `/programs`, and `/repository` destinations where an answer needs a next action. **Do not show `View All FAQs` or otherwise promote the legacy `/faq` route.** Expand the Home FAQ set only with verified, concise questions as needed; do not reproduce the whole applicant workflow or add unsupported policy.

Use native details/summary or an accessible existing accordion approach. Answers remain available by keyboard with visible focus; headings and controls must not be confused. The existing `/faq` route remains untouched for compatibility but is not part of the accepted new public IA until separately reviewed and re-authorized.

## 10. Contact Us and Institutional Footer

### 10.1 Contact Us section

Add a distinct Home **Contact Us** section before the Footer with anchor `contact`. It should combine concise institutional contact/platform information with a simple public inquiry form, without becoming another portal dashboard. A balanced desktop treatment may place contact/platform information on one side and the inquiry form on the other; stack naturally on narrow screens.

Current official-source review content:
- Newer official EARIST Graduate School page: **Nagtahan St, Sampaloc, Manila, 1008 Metro Manila**; **earistofficial1945@gmail.com**; **(02) 7738 5059**.
- Older official Graduate School page: **EARIST-Graduate School**, **(02) 7154914**, and Facebook/Twitter handle **earistgraduateschool**.
- Official EARIST website: **https://earist.edu.ph/**.
- Official-site-linked Applicants Access Module / Apply Online: **https://earistweb.pinnacle.com.ph/aims/applicants/**.
- The official EARIST site also links an Applicant's Inquiry Facebook destination. Treat external social destinations as official-site-linked review content; client confirmation may replace/update them.

Because the two official pages expose different-age contact information, display these details for design/client review without claiming they are final production contacts. The client may confirm, correct, remove, or replace individual details. Do not use the older `www.earist-edu.ph` string as the canonical website when the current official site is `earist.edu.ph`.

The inquiry form uses exactly these fields:

- **Full Name** — required.
- **Email Address** — required.
- **Contact Number** — optional.
- **Subject** — required free-text input.
- **Message / Inquiry** — required multiline input.
- **Privacy acknowledgment** — required checkbox.

Primary form action: **Send Inquiry**. Do not add category dropdowns, Applicant/Student ID, file uploads, address, date of birth, or other unnecessary personal data.

Privacy acknowledgment copy must be concise and truthful, for example: **I acknowledge that the information I provide will be used to respond to my inquiry.** Link to an approved Privacy Notice only when a real destination exists; do not invent a privacy URL.

The form UI, labels, required-state validation, error/success states, and accessibility may be implemented in the Task 3 refinement. Actual submission/storage/email delivery must use a real authorized server path. If no such path exists in the current repository, do not fake successful submission, silently discard the message, or invent a backend endpoint. Record the submission integration as a separate dependency unless explicitly authorized.

The section may also include clear actions such as **Open EARIST Website** and **Applicant Portal** when their destinations are real. Do not invent office hours, social URLs, or contact details.

### 10.2 Institutional Footer

Use a deep burgundy surface, thin gold top rule, and balanced aligned groups rather than identity beside one tall Quick Links list.

| Group | Content |
| --- | --- |
| Identity | Actual EARIST seal, Graduate School name, full institution name. |
| Study & Information | `/#programs`, `/#getting-started`, `/#about`. FAQ is read directly on Home; do not link the legacy `/faq` route. |
| Research & Updates | `/repository`, `/#news`. |
| Contact & Access | `/#contact`, official EARIST website/applicant platform links, `/login` labelled Sign In, `/register` labelled Register. |

Use a balanced four-group Footer now that official-source contact/platform references are available. Keep detailed address/phone/email content primarily in Contact Us so the Footer stays compact; it may repeat one concise contact line if useful. Social/platform links must resolve to real destinations and remain subject to client confirmation where the official pages are inconsistent.

Use roughly 48–64px desktop vertical padding, 16–24px within groups, and a compact lower copyright row. Add privacy/terms links only when real approved destinations exist. Do not show disabled social icons, `#` links, invented addresses, or public-facing "contact details pending" filler. Small meaningful seals need their original white backing, not recoloring or background-removal artifacts.

## 11. Visual system and page rhythm

Target roughly 1200px content width with 24–40px desktop gutters, 16–20px narrow gutters, and a consistent alignment grid. Major sections use approximately 64–88px desktop / 40–56px mobile vertical spacing. Related items use 16–28px; program/news rows are tighter without losing touch readability. Heights follow content. Do not enforce equally tall sections or add empty space to make a section feel premium.

| Treatment | Desktop target | Narrow target |
| --- | --- | --- |
| Hero heading | 60–68px, strong weight, compact line height | 36–40px, natural two/three-line wrap |
| Main section heading | 34–40px | 28–32px |
| Program/news title | 20–24px | 18–22px |
| Body | 17–18px, generous reading line height | 16–17px |
| Metadata/navigation | 13–16px according to task | Readable without shrinking labels to fit |

These are responsive public design targets, not global CSS token replacements or fixed heights. Retain the existing font family and allow zoom/text enlargement.

Reuse EARIST burgundy `#8B1A1A`, secondary red `#A83240`, gold `#D4A843`, cream `#FFF8EC`, white, and body neutral `#4A4A5A`. Gold is an accent/rule or controlled button treatment, not small text on white. Contrast must be checked for actual combinations. Explicitly set light text in Research/Footer so global paragraph/heading styles cannot defeat contrast.

Rhythm: warm-white photographic opening → readable program directory → white editorial news → full burgundy Research → warm institutional About → quiet help → practical Contact Us → burgundy Footer. Vary image, list, text, and color treatments. Use restrained corners and light borders; avoid putting every paragraph in a panel, deep repeated shadows, pills, KPI tiles, glow, blobs, generic gradient hero, or decorative seal watermarks.

Use existing React/Next/Tailwind primitives. Keep any new public CSS under an `.earist-public` wrapper and narrowly named component classes. Do not change root layout, global fonts/tokens, shared UI primitives, or portal styles. Scope must not restyle RepositoryBrowser or the chatbot through broad descendant rules. Functional hover/menu/accordion transitions may last around 120–180ms; no entrance delays, parallax, autoplay, or animation needed to discover content.

Same-page Home anchor navigation should scroll smoothly for ordinary motion settings while preserving the existing sticky-header `scroll-margin-top` behavior. Respect `prefers-reduced-motion: reduce` by disabling smooth scrolling and using immediate anchor behavior. Do not add a custom scroll-animation library or JavaScript timing choreography when CSS/native behavior is sufficient.

## 12. Asset inventory, preview treatment, and production replacement

| Existing asset | Provenance / size | Intended use |
| --- | --- | --- |
| `frontend/public/images/landing/earist-logo.jpg` | Owner-supplied seal copy; 141×141 | Masthead/Footer at modest sizes. |
| `backend/assets/official-forms/earist-logo.jpg` | Original owner-supplied seal; same bytes | Read-only provenance; preserve backend consumers. |
| `backend/assets/official-forms/graduate-school-logo.jpg` | Owner-supplied; 207×207 | Optional exact-byte frontend copy for About. |
| Starter SVGs in `frontend/public` | Framework boilerplate | Not institutional content or branding. |

See [official-form asset provenance](../../../backend/assets/official-forms/README.md). Preserve seal proportions, colors, and bytes. Higher-resolution official replacements are desirable for future reuse; do not upscale seals into hero art, trace them, or substitute a generic cap.

Missing: authorized campus, teaching/research, About, and news photographs, plus approved public news, program/catalog confirmation, institutional prose, and contact/social destinations.

For later implementation, proposed local review assets live under `frontend/public/images/landing/v2/`, with explicit `*-preview.webp` names for Hero, Research, About, and optional news imagery. Use licensed/authorized stock or generated academic-context images only as review assets. Do not generate fake EARIST seals, signage, official people, or documentary claims. A few suitable images/crops are preferable to a new image in every section.

While any sample remains:

- Show a compact public-page notice: **Design preview — marked imagery and sample content are for review only.** Do not gate it on `NODE_ENV`; a production build can still be used for design QA.
- Each non-institutional photograph visibly carries **Design placeholder image — not EARIST photography**, adjacent to the image and readable on mobile. Alt text must not identify a substitute as actual EARIST property or people.
- Each sample news item has its own sample label; a global notice alone is insufficient.
- Program snapshots lacking confirmation carry the section/list-level warning in section 6.
- Keep small frontend content/provenance notes identifying source, review status, image purpose/crop, and replacement need. No database fields, API contracts, or CMS are introduced.
- Preview entries remain visibly labelled until replaced; do not silently suppress labels for screenshots, build mode, or route changes. Branch push is not deployment approval.

Before production-content acceptance, the owner must approve actual institutional photographs/rights, catalog titles/degree groups, About copy, contacts, and any real news dates/body/destinations. Replace every affected preview asset/item and review alt text/crops. If no approved news exists, retain the section with a truthful compact state rather than samples presented as official news. Remove review notices only after no unapproved items remain on that page. If a replacement is missing, the design can be visually reviewed but cannot be reported production-content ready.

## 13. Responsive and accessibility expectations

Use CSS/intrinsic layout rather than post-mount viewport correction. Test at approximately 360/390px mobile, 768px tablet, 1024/1280px navigation transition, and 1440px desktop, plus 200% zoom and narrow reflow. At 320 CSS pixels, no page-level horizontal scrolling or clipped actions is acceptable.

Programs groups stack without forced horizontal scrolling. News becomes a normal list. Research copy/action precede the photograph. About and help follow logical reading order. Footer groups remain explicitly labelled and expand vertically without tiny links. The Hero does not require a viewport-height panel or hide its image.

Provide one route-level `h1`, logical section headings, semantic header/nav/main/footer, unique anchor IDs, and a visible-on-focus skip link to the shared main landmark. Reserve image space using dimensions/aspect ratio and sensible crops; use Next Image for appropriate local content, prioritize only the Hero, and lazy-load lower imagery. Avoid rendering a desktop image again solely for mobile.

Links/buttons need visible focus and practical minimum 44px targets. Label real search/filter controls. Mark decorative icons appropriately; meaningful seals/photos get suitable accessible descriptions. Respect reduced motion. Use normal-text contrast of at least 4.5:1 and large-text/non-text contrast of at least 3:1 where applicable. Color alone must not convey status or preview status.

Sticky masthead offsets must keep anchor headings and keyboard focus visible. Keep the chatbot mount/content/behavior unchanged and avoid broad styles affecting it. Check whether its existing launcher obscures actions; address surrounding layout clearance within public components or report a separately scoped chatbot issue rather than modifying the widget.

## 14. Coordinated deeper pages and deferred integration

- `/programs`: grouped full directory, restrained editorial header, working local search/type filtering if present, same program review status as Home, truthful GS-IS registration wording. No new fetch/contract or program administration.
- `/about`: institutional identity/public purpose and approved prose; remove unsupported statistics and software marketing from the redesigned presentation. Do not invent mission, vision, history, leadership, or outcomes. A labelled photo may support a concise preview until approved copy arrives.
- `/faq`: clear categories, useful reading width, accessible accordions, working local filtering if search remains. Verify reused policy wording against canonical authority; never infer policy from the old FAQ. Flag unresolved policy content for confirmation instead of fabricating replacements.
- `/repository`: coordinate the outer public page header/gutters with V2; retain the existing `RepositoryBrowser` and all its request, filter, citation, document, session, and authorization behavior. A redesign of that shared functional component is outside these initial packages.
- Navbar/Footer are shared by all five routes. Auth pages have a separate layout. Public-only CSS must not bleed into authenticated portals or shared widget internals.

New public news routes, CMS, backend reads, live Home catalog/research feeds, and production data publication are deferred decisions after visual validation. Do not portray visual completion as completion of those capabilities.

## 15. Visual acceptance and implementation stop

Review the whole public page, not just individual components. Success requires an immediate institutional identity, a strong photographic opening, actual seals, useful program content, unmistakably labelled preview news/images, distinct Research, credible About/help, and a balanced Footer. Reject sparse wireframe-like sections, generic SaaS cards, fabricated credibility, and empty space without a composition purpose.

Each later implementation package must verify its own responsive/keyboard behavior and affected shared routes, distinguish source/static checks from browser QA, and record owner feedback honestly. Passing typecheck, lint, build, or hosted CI does not establish visual acceptance. Placeholder-based visual acceptance does not establish authoritative production-content acceptance.

Current authorization ends after the new specification and [repository-grounded implementation plan](../plans/2026-11-08-landing-page-redesign-v2.md), the bounded historical-report update, their documentation commits, and the verified feature-branch push. No V2 source, asset generation/copying, dependencies, deployment, merge, canonical-document synchronization, or implementation task begins automatically.
