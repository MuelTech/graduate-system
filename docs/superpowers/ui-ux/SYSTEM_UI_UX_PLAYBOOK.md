# System UI/UX Playbook

**Project:** EARIST Graduate School Information System  
**Status:** CANONICAL UI/UX IMPLEMENTATION GUARDRAIL  
**Applies to:** UI/UX refinement packages on refactor/system-ui-ux and descendants  
**Companion audit:** docs/superpowers/ui-ux/UI_UX_AUDIT.md

---

## 1. Purpose

This document defines how UI/UX refinement must be implemented across the EARIST Graduate School Information System.

It is not a frozen mockup, a requirement that all pages look identical, or permission to redesign business workflows.

The UI/UX strategy is iterative:

1. inspect the actual screen and applicable workflow authority;
2. identify the user problem;
3. define one bounded improvement;
4. implement with shared patterns where appropriate;
5. validate code and real interaction;
6. manually review the result;
7. accept, revise, or reject;
8. use accepted patterns as precedent for future similar work.

The goal is a coherent institutional product: clear, calm, professional, efficient for administrative work, understandable for students/applicants/panelists, responsive, and accessible.

---

# 2. Authority and conflict order

UI/UX work is subordinate to domain authority.

For any page, read applicable canonical project documentation before changing wording, actions, state presentation, or data behavior.

General authority order:

1. current accepted repository behavior and current canonical source-of-truth;
2. current accepted design/spec/plan for the affected domain;
3. this UI/UX playbook for presentation and interaction;
4. approved internal UI reference implementations;
5. older plans/comments/screens.

When a visual idea conflicts with domain authority, domain authority wins.

Never infer institutional policy from a visual pattern.

---

# 3. Non-negotiable project rules

Every UI/UX package must preserve the engineering discipline already used by the project.

Do not:

- merge/rebase/force-push as part of a bounded package unless explicitly instructed;
- start the next package automatically;
- perform unrelated cleanup;
- invent EARIST policy;
- weaken Defense completion gates;
- derive PASS/FAIL automatically from scores;
- replace exact certified-document authority with “latest file” fallback;
- add payment processing;
- expose public raw storage paths;
- create Admin academic override powers;
- create a generic filesystem manager;
- alter another workflow stage merely because shared code exists;
- copy business behavior from stale/historical branches;
- treat UI state as domain authority.

One package must solve one bounded problem.

---

# 4. UI/UX is not strictly frontend-only

UI/UX work may include a minimal backend read-model or API-response change when the screen requires authoritative information that already exists.

Allowed example:

- expose an existing defense date, assignment, timestamp, status reason, or related-record summary needed by the page.

Conditions:

1. existing domain meaning is preserved;
2. no new state transition is created;
3. no permission or authority is relaxed;
4. no new institutional policy is invented;
5. backend change is explicitly listed in package scope;
6. focused tests cover the response change.

Not allowed inside an ordinary UI/UX package:

- changing who may approve, verify, conclude, sign, or review;
- weakening eligibility or completion gates;
- changing authentication/credential authority;
- inventing a new domain status;
- automatically converting scores/data into academic decisions;
- changing transactional authority.

If the desired UI reveals a functional problem, stop and create a separate bounded functional package.

---

# 5. External visual references

External/private visual references are reviewer/prompter tools, not coding-agent dependencies.

The coding agent is not expected to access an external reference repository.

Any useful external design quality must first be translated into this repository's documentation or into an explicitly accepted internal reference implementation.

Agent implementation authority is limited to:

- current repository code;
- canonical repository documentation;
- the bounded package prompt;
- explicitly listed Approved Reference Implementations.

Do not tell an agent to “copy” or “match” an inaccessible external system.

---

# 6. Product design direction

Target character:

- institutional;
- modern;
- restrained;
- readable;
- workflow-aware;
- task-oriented;
- calm rather than decorative;
- consistent across roles without erasing legitimate role differences.

Avoid both extremes:

- old-style dense portal with weak hierarchy;
- overly decorative consumer/SaaS dashboard with excessive gradients, animation, cards, and novelty.

The application should feel like one system.

---

# 7. Core UX questions

Every refined screen should make these questions easy to answer:

1. Where am I?
2. What record/task am I working on?
3. What is the current authoritative state?
4. What has already been completed?
5. What is still required?
6. What can I do now?
7. What is blocked?
8. Why is it blocked?
9. Who is responsible for the next action?
10. What happens after I act?

Not every screen must display all ten explicitly, but the user should not be forced to infer them from implementation details.

---

# 8. Information architecture

## 8.1 Organize by user task and domain

Navigation should reflect meaningful system areas, not database tables.

Examples:

- Thesis Management is a domain grouping.
- Defense Applications, Scheduling, Defense Records, RAP Reports, and Adviser Request Review are task-oriented child destinations.

Do not create a new sidebar destination merely because a database model exists.

## 8.2 Preserve accepted terminology

A single domain concept should use one consistent user-facing name unless the context genuinely changes the meaning.

Before renaming:

- verify canonical docs;
- verify current domain state meaning;
- verify whether the term appears in another actor's workflow.

Do not replace precise academic terminology merely because a shorter phrase looks better.

## 8.3 Role-specific architecture is valid

Admin, Applicant, Student, and Panelist do not need identical navigation.

Consistency means shared interaction language and hierarchy, not identical menus.

---

# 9. Navigation and wayfinding

## 9.1 Sidebar

The sidebar is primary portal navigation.

Requirements:

- current destination must be visually identifiable;
- nested parent must remain active when a child/deep route is active;
- collapsed state must preserve accessible identification;
- mobile navigation must remain usable;
- role-specific locked workflow navigation must preserve backend-authoritative lock state;
- no misleading clickable item for a genuinely locked destination.

## 9.2 Breadcrumbs

Breadcrumbs are required by default for meaningful nested pages such as:

- list → record detail;
- record detail → summary;
- record detail → criteria/evaluation;
- repository → submission;
- scoring list → scoring detail;
- nested settings detail.

Top-level dashboard or simple root pages normally do not require breadcrumbs.

Breadcrumb rules:

1. represent information hierarchy, not browser history;
2. ancestors are clickable when valid;
3. current page is the final non-clickable item;
4. labels use user-facing domain names, not raw route segments;
5. dynamic record items use a safe concise identifier/name;
6. do not expose sensitive data unnecessarily in breadcrumbs;
7. mobile may collapse intermediate items when necessary;
8. breadcrumbs do not replace the page title.

Example:

Thesis Management > Defense Records > Defense Session > Summary

## 9.3 Back links

Use a Back link when it improves task flow, but do not use it as the only hierarchy cue on deep pages.

Avoid relying on browser history for domain navigation.

---

# 10. Page hierarchy

Use a predictable hierarchy for most application pages:

1. Breadcrumbs, when nested;
2. PageHeader;
3. optional status/context summary;
4. primary content;
5. supporting detail/history.

## 10.1 PageHeader

A shared PageHeader should support:

- title;
- one concise description;
- primary action;
- secondary actions;
- optional contextual status or metadata.

Primary actions should be visually discoverable and normally placed consistently in the header or the task section they control.

Avoid duplicate page titles in the portal header and page body.

## 10.2 Page type and width

Use task-based width. These are the initial canonical content-width baselines:

### Narrow — `max-w-3xl` / 48rem / 768px

Use for:

- focused forms;
- confirmation/review flows;
- reading-oriented content.

### Medium — `max-w-6xl` / 72rem / 1152px

Use for:

- record detail;
- workflow review;
- mixed form/detail pages.

### Wide — full available portal content width

Use for:

- data tables;
- dashboards;
- dense management surfaces.

Wide pages should not invent a smaller max-width merely for visual symmetry.

A page may use a narrower inner section inside a wider page when the task genuinely benefits from it, but the reason must come from content/task needs rather than arbitrary styling.

Do not set max width independently per page when one of these categories already fits.

## 10.3 Section hierarchy

Sections should have:

- clear title when needed;
- optional short description;
- content;
- actions near the content they affect.

Avoid creating a titled section for trivial single-line content.

---

# 11. Spacing and rhythm

Use a small canonical spacing vocabulary based on the existing Tailwind 4px grid.

## 11.1 Canonical spacing scale

| Intent | Value | Preferred utility examples | Typical use |
| --- | ---: | --- | --- |
| Micro | 4px | `gap-1`, `p-1` | icon micro-spacing, very tight metadata |
| Tight | 8px | `gap-2`, `space-y-2` | icon + label, badge groups, label → control |
| Compact | 12px | `gap-3`, `p-3` | compact related controls, small grouped content |
| Standard | 16px | `gap-4`, `p-4` | normal content blocks, field groups, mobile surface padding |
| Section | 24px | `gap-6`, `p-6` | standard section separation, desktop surface padding |
| Major | 32px | `gap-8`, `p-8` | major page-section separation |
| Exceptional | 48px | `gap-12`, `py-12` | rare large separation / empty-state breathing room |

Do not create arbitrary 18px, 22px, 27px, 35px, or similar values unless a component-level requirement proves necessary.

## 11.2 Outer page padding

Initial baseline:

- mobile: **16px** — `p-4`;
- tablet/small desktop: **24px** — `sm:p-6`;
- large desktop: **32px** — `xl:p-8` only where the page/shell benefits from the additional space.

The portal shell or shared PageContainer should own outer page padding. Individual pages must not add a second equivalent outer padding layer and create accidental double gutters.

## 11.3 Section rhythm

Default intent:

- PageHeader → first major content: **24px**;
- normal major sections: **24px**;
- visually distinct major workflow/record groups: **32px** when needed;
- related content inside one section: **16px**;
- tight metadata/action clusters: **8–12px**.

Prefer `space-y-6` / `gap-6` as the normal page-section rhythm before reaching for larger separation.

## 11.4 Card and surface padding

Use:

- compact surface: **12–16px**;
- standard surface: **16px mobile**, up to **24px desktop** when content density allows.

Existing shadcn Card defaults are a valid starting point. Do not override every Card to larger padding merely to make it feel “premium”.

## 11.5 Form spacing

Default intent:

- label → control/helper relationship: **8px**;
- related controls inside one field group: **8–12px**;
- field → field: **16px**;
- form section → form section: **24px**.

Long forms may use 24px between complex field groups, but ordinary forms should not become excessively tall.

## 11.6 Action spacing

- buttons in one action group: **8px**;
- icon + button label: use the shared Button component defaults;
- primary/secondary action groups may use **8–12px** depending on available width.

Prefer shared containers/components over repeating magic margin/padding values everywhere.

When an Approved Reference Implementation exists for the same page type, match its rhythm unless a real task difference requires otherwise.

---

# 12. Typography

Typography must communicate hierarchy before color does.

## 12.1 Canonical application type scale

Use the following initial baseline inside authenticated portals:

| Role | Size | Weight | Preferred utility intent |
| --- | ---: | ---: | --- |
| Page title | 24px mobile / 30px desktop | 700 | `text-2xl sm:text-3xl font-bold` |
| Section title | 20px | 600 | `text-xl font-semibold` |
| Subsection / prominent card title | 16px | 600 | `text-base font-semibold` |
| Standard body | 14px | 400 | `text-sm` |
| Reading/explanatory body | 16px | 400 | `text-base` when longer-form readability benefits |
| Form label | 14px | 500–600 | `text-sm font-medium` / `font-semibold` only when emphasis is justified |
| Supporting / muted text | 14px | 400 | `text-sm text-muted-foreground` |
| Table header / compact metadata | 12px | 600 | `text-xs font-semibold` |
| Caption / timestamp / tertiary metadata | 12px | 400–500 | `text-xs` |

Use the smallest number of type levels that still makes hierarchy obvious.

## 12.2 Typography rules

- avoid oversized marketing-style headings inside authenticated portals;
- page titles should normally use the PageHeader rather than one-off heading styling;
- standard operational body text is generally 14px;
- use 16px body text for reading-heavy descriptions or long-form content where readability matters more than density;
- table text may be dense but must remain legible;
- do not rely on all-caps for hierarchy except compact table/header metadata where appropriate;
- avoid coloring every heading with strong brand color;
- do not use font size alone to imply domain authority or destructive severity.

## 12.3 Font family

The current system-wide family remains the existing Calibri/Segoe UI-oriented stack until a separate bounded font decision is approved.

Font-family changes are system-level decisions. Do not change fonts in one page only.

---

# 13. Color and brand usage

Current EARIST tokens are the canonical starting palette.

## 13.1 Current canonical palette

| Token / intent | Value |
| --- | --- |
| EARIST primary | `#8B1A1A` |
| EARIST secondary | `#A83240` |
| EARIST accent / gold | `#D4A843` |
| Light red surface | `#FDF0F0` |
| Cream surface | `#FFF8EC` |
| Main neutral surface | `#F4F6F9` |
| Border gray | `#D0D7E3` |
| Body text | `#4A4A5A` |
| Success | `#1E7E4E` |
| Warning | `#9B5C00` |
| Base content surface | `#FFFFFF` |

Use CSS variables / semantic component variants instead of hardcoding these hex values repeatedly in pages.

## 13.2 Brand usage

The visual balance should be predominantly neutral. Strong EARIST brand color is reserved for meaningful emphasis rather than coloring every surface.

Strong brand red should primarily support:

- sidebar/navigation identity;
- primary actions;
- selected/active states;
- deliberate emphasis.

Gold accent should be restrained and should not compete with the primary action.

Avoid simultaneous strong red on page title + icon + border + card + badge + button unless the semantic context genuinely requires it.

## 13.3 Semantic color discipline

Semantic state colors must not be overridden merely to create visual variety.

The current `--destructive` token shares a similar red family with the brand primary. Therefore semantics must come from component role and context, not from hex color alone.

Do not introduce page-local “status colors” as new hardcoded hex values. If the existing semantic palette is insufficient, introduce/refine a token in a bounded design-foundation package rather than inventing a one-off color.

## 13.4 Suggested semantic families

### Success / completed

Examples:

- Verified
- Completed
- Passed
- Finalized

Use success styling where the domain meaning is truly positive/completed.

### Warning / waiting

Examples:

- waiting for another actor;
- pending review;
- incomplete prerequisite that is not an error.

### Informational / current

Examples:

- current workflow step;
- available action;
- scheduled/in-progress context where not semantically success/error.

### Neutral

Examples:

- draft;
- N/A;
- not started;
- informational metadata.

### Destructive / error

Examples:

- rejected;
- failed;
- validation error;
- irreversible destructive action.

Do not use destructive red for a non-destructive comparison difference. The accepted COR behavior where Different is review information rather than rejection is an example of this principle.

Color must never be the only status signal.

---

# 14. Surfaces, cards, borders, radius, and elevation

Use cards to group meaningfully distinct content, not as default decoration.

## 14.1 Surface hierarchy

Default application surface preference:

- page background: neutral `--background` / EARIST surface gray;
- normal content surface: white/card surface + subtle border/ring;
- grouped card/section: same neutral content language with only enough separation to show grouping;
- overlay/floating UI: stronger elevation is allowed.

## 14.2 Radius baseline

The existing root radius is `0.625rem` (**10px**) and remains the base.

Use the existing component radius system rather than page-local arbitrary radii:

- compact controls: approximately **8px** / shared `rounded-md`-level treatment;
- standard controls/cards: approximately **10px** / shared `rounded-lg` treatment;
- prominent grouped surfaces: approximately **14px** / `rounded-xl` only where the existing component or composition calls for it;
- pill shapes: `rounded-full` only for badges, avatars, compact status chips, and controls that are intentionally pill-shaped.

Do not mix many radius styles on the same page for decoration.

## 14.3 Elevation baseline

Use:

- ordinary static surface: border/ring with **no shadow** by default;
- slight separation where needed: **shadow-sm**;
- dialogs/dropdowns/popovers/floating overlays: stronger overlay elevation such as **shadow-lg** when supported by the shared primitive.

Avoid `shadow-md` / `shadow-lg` on ordinary static cards.

## 14.4 Borders

Use the shared border token and subtle separators before stronger shadow.

Colored borders are semantic accents, not a default section-decoration technique.

Avoid:

- card inside card inside card;
- thick colored top borders on every section;
- multiple competing accent colors in one task area;
- arbitrary page-local radius/shadow recipes.

---

# 15. Icons

Use Lucide as the default icon family.

Do not introduce additional icon libraries or emoji-based navigation without an approved need.

General sizing intent:

- small inline/status icon;
- normal control/navigation icon;
- larger empty-state/illustrative icon.

Icon-only buttons must have an accessible name.

Icons are supportive; labels carry primary meaning for important actions.

---

# 16. Actions and buttons

## 16.1 Action hierarchy

Prefer one obvious primary action per task area.

Secondary actions should not visually compete with the primary action.

Tertiary/navigation actions may use ghost/link treatment.

## 16.2 Destructive actions

Destructive styling is reserved for actions with destructive or strongly negative consequence.

Use AlertDialog or equivalent deliberate confirmation for irreversible/high-impact actions.

Confirmation copy should state the consequence, not merely “Are you sure?”

## 16.3 Pending state

Mutation buttons should:

- disable repeated submission when appropriate;
- show a clear pending label or loading affordance;
- preserve enough width/stability to avoid distracting layout shifts;
- report success/failure through the appropriate feedback channel.

---

# 17. Dialogs, alerts, and confirmation

Use:

- Dialog for focused non-destructive modal tasks;
- AlertDialog for destructive/high-impact confirmation;
- Alert for persistent contextual information;
- toast for transient completion feedback.

Do not use native browser alert() and confirm() as the normal product interaction pattern.

Do not use a toast for information the user must read before proceeding.

Dialogs must:

- have a clear title;
- explain consequence/context;
- keep primary/secondary actions predictable;
- support keyboard focus;
- restore focus correctly when closed.

---

# 18. Toast and transient feedback

Use one global toast system.

Sonner is already in the stack; avoid adding another toast library.

Toast is appropriate for:

- save success;
- small non-blocking mutation success;
- transient retryable error when context remains visible.

Prefer inline error/status when:

- the page failed to load;
- a form field is invalid;
- the user must understand why a workflow is blocked;
- an error needs persistent action.

Do not emit duplicate toast + inline success message unless both serve distinct purposes.

---

# 19. Loading, empty, and error states

## 19.1 Loading

Use meaningful Skeleton layouts when the target structure is known.

Use spinner/progress for:

- button submission;
- discrete operation;
- small indeterminate wait.

Avoid page-wide blank screens with only “Loading...” when a skeleton can preserve context.

### 19.1.1 Layout stability during asynchronous rendering

Loading behavior must preserve spatial context and avoid unnecessary layout shift.

Requirements:

- initial loading, confirmed empty, error, and background refetch are different states;
- do not render an empty state until a successful response confirms there are no records;
- when the final structure is known, use structural skeletons that approximate the final dimensions rather than replacing a large surface with a tiny loading label;
- preserve already-usable data during background refetch when safe instead of collapsing the page back to an initial-loading state;
- keep stable page/table shells mounted during routine filter, pagination, or refetch transitions when practical;
- reserve predictable space for asynchronous controls, status badges, avatars, and other elements when their late appearance would noticeably shift surrounding content;
- a loading treatment should reduce uncertainty without creating a fake progress story.

The practical goal is not zero pixel movement in every case. It is to prevent avoidable loading -> empty -> loaded flashes, table-width jumps, and major content reflow.

## 19.2 Empty state

A reusable EmptyState should support:

- icon;
- title;
- explanation;
- optional action.

Differentiate:

- no records exist;
- no assigned work;
- no search/filter results;
- no notifications/history.

## 19.3 Error state

Choose the narrowest correct level:

- field;
- form;
- section;
- page;
- transient action.

Error copy should explain recovery when possible.

Do not leak raw backend stack traces or implementation details.

## 19.4 State ownership and effects

Do not ban `useState` or `useEffect`. Choose state ownership based on what the state represents.

Preferred ownership:

- ordinary API/server state -> TanStack Query or the established query/cache layer when appropriate;
- data derived from existing state -> direct computation; use `useMemo` only when the computation or referential stability genuinely benefits from it;
- genuine temporary interaction state -> local `useState` (for example dialog open/close, selected row, sidebar state, draft input, search/filter controls);
- effects -> real synchronization or side effects such as browser/DOM APIs, subscriptions, timers, storage persistence/restoration, imperative focus/scroll, canvas, or third-party integration.

Avoid duplicating query/server data into local state or synchronizing derived values through `useEffect + setState` without a clear reason.

When client-only information is required, avoid using a mount-time effect to make a major first-render layout correction if responsive CSS, a stable initial state, or another declarative approach can solve the same problem.

---

# 20. Forms

## 20.1 Field composition

Use a consistent form-field structure:

1. Label;
2. required/optional context when needed;
3. control;
4. helper description when useful;
5. validation/error.

## 20.2 Required vs optional

Do not force the user to infer optionality from missing asterisk alone.

For long forms, explicitly mark optional fields when it reduces uncertainty.

## 20.3 Read-only and authoritative data

Visually distinguish:

- editable input;
- read-only value;
- system-derived value;
- official/authoritative value.

Do not render authoritative values as editable controls merely for visual symmetry.

## 20.4 Validation

Prefer inline validation near the field.

For server/domain errors, preserve the domain message at the correct level without exposing internals.

## 20.5 Long forms

Group by user task, not database model.

Use section headings and descriptions sparingly.

---

# 21. Tables and record lists

Use tables for scan/comparison-heavy repeated records.

Use cards/list items when:

- records have heterogeneous content;
- there are few items;
- mobile presentation benefits substantially.

A management table pattern should support only the features the screen needs from:

- search;
- filters;
- sort;
- pagination;
- status;
- row actions;
- bulk selection;
- responsive overflow.

Do not automatically implement every feature.

## 21.1 Filter behavior

Filters should be:

- discoverable;
- reversible;
- visibly active;
- compatible with no-results feedback.

Reuse existing shared DataTableFilter where applicable.

## 21.2 Row actions

Prefer:

- direct primary row action when there is one dominant action;
- DropdownMenu when several secondary actions would clutter the row.

Do not hide the only important action behind an overflow menu just for visual minimalism.

## 21.3 Table layout stability

Record-heavy pages must define intentional column behavior instead of relying on accidental content-driven sizing.

For each important column, decide whether it is:

- fixed/stable width;
- bounded;
- flexible;
- wrapping;
- intentionally truncating with another way to access the full value.

`table-fixed` is not mandatory. The requirement is predictable behavior appropriate to the data.

During asynchronous transitions:

- preserve the toolbar/table frame and header when practical;
- use skeleton rows that follow the final column structure when a table skeleton is useful;
- avoid replacing an established table with a tiny loading block during ordinary pagination/filter/refetch;
- preserve prior usable rows while the next query loads when that is safe and understandable;
- keep pagination/action areas spatially stable where practical;
- use stable row keys;
- long names, programs, emails, badges, and action controls must not cause avoidable column jumps or horizontal page overflow.

---

# 22. Record-detail pages

A record detail page should generally prioritize:

1. identity/title;
2. current status;
3. primary valid action;
4. key context;
5. workflow state/requirements;
6. supporting information;
7. history/audit.

Do not give every subsection equal visual weight.

Important state and valid next action should be visible without scrolling through many unrelated sections when practical.

---

# 23. Workflow-specific components

Because this is a stateful academic information system, generic SaaS components are not enough.

The following project-level patterns are encouraged when the real page warrants them.

## 23.1 WorkflowStepper / JourneyTimeline

Use to communicate progression when the backend already exposes authoritative ordered states.

It may show:

- completed;
- current;
- available;
- waiting;
- locked.

Do not create a second frontend progression model.

## 23.2 NextActionPanel

Use when the user benefits from an explicit summary of:

- current status;
- next valid action;
- responsible actor;
- block reason;
- relevant requirement.

The panel is explanatory only. Backend/domain remains authoritative.

## 23.3 RequirementList / BlockReason

Use when an action depends on multiple prerequisites.

Show satisfied vs unsatisfied conditions only when the underlying data is authoritative and useful.

---

# 24. Responsive design

Every UI iteration must consider narrow/mobile behavior.

Review:

- sidebar/navigation;
- breadcrumbs;
- page header;
- page actions;
- tables;
- filters;
- dialogs;
- forms;
- workflow components;
- sticky/fixed elements;
- touch targets.

Do not solve mobile merely by shrinking text.

Prefer CSS breakpoints and intrinsic layout for first-render responsiveness. Do not use post-mount JavaScript state correction for basic mobile/desktop layout when CSS can express the same behavior without flicker.

Possible adaptations:

- stack page actions;
- collapse breadcrumb middle items;
- horizontal table scroll when comparison must be preserved;
- card/list transformation only when it does not hide important comparisons;
- Sheet/Drawer only when an approved need exists.

---

# 25. Accessibility

Minimum expectations:

- semantic HTML where possible;
- keyboard-accessible interactive controls;
- visible focus;
- useful accessible names;
- labels associated with form fields;
- status not communicated by color alone;
- meaningful icon descriptions where needed;
- dialogs manage focus correctly;
- disabled/locked states are understandable;
- sufficient contrast.

Tooltips can supplement labels but should not hide critical information that must be read.

---

# 26. Motion

Motion is functional, not decorative.

Use restrained transition for:

- hover/focus;
- sidebar/menu expansion;
- dialog/sheet;
- skeleton/progress;
- state change where it helps orientation.

Avoid:

- delayed entrance animations on every card;
- large parallax/marketing motion in portal workflows;
- animation that obscures state changes or slows task completion.

---

# 27. Design-system primitive strategy

Do not install components simply because they are popular.

## 27.1 Existing and preferred

Reuse current project primitives first:

- Alert
- Badge
- Button
- Card
- Dialog
- DocumentViewer
- Input
- Label
- Pagination
- Select
- Separator
- Sonner
- Switch
- Tabs
- Textarea
- Lucide
- Tailwind

## 27.2 High-value additions

Introduce through bounded packages when the screen needs them:

- Breadcrumbs
- PageHeader
- AlertDialog
- Tooltip
- DropdownMenu
- Skeleton
- EmptyState
- shared DataTable composition
- WorkflowStepper / Timeline
- NextActionPanel
- global Toaster wiring

## 27.3 Demand-driven

Add only after an approved use case:

- Sheet / Drawer
- Popover
- Command / Combobox
- Accordion / Collapsible
- ScrollArea
- Checkbox
- RadioGroup
- Calendar / DatePicker

Do not add a second component library to solve a problem already covered by the current stack.

---

# 28. Searchable selection

When a selector has too many options for ordinary Select, an accessible searchable Combobox may be appropriate.

Business matching and UI search are different concepts.

A searchable UI may help users locate an existing Program/User, but it must not introduce fuzzy domain authority where the backend requires exact existing records.

Example: COR Program authority remains an explicit existing Program selection/unique-exact resolution rule. Search convenience must not become fuzzy automatic authority.

---

# 29. Portal shell refinement

Shared shell extraction is allowed only when it preserves role-specific behavior.

Good candidates for shared primitives:

- sidebar container;
- mobile overlay;
- top header;
- page container;
- user menu/avatar treatment;
- breadcrumbs;
- shared nav item styling.

Keep role-specific:

- destination set;
- workflow lock/navigation semantics;
- role-specific notification behavior;
- role-specific contextual actions.

Avoid a giant highly-conditional PortalShell that becomes harder to maintain than the separate layouts.

---

# 30. Approved Reference Implementations

The playbook defines rules. Accepted pages define concrete precedent.

A page/component may become an Approved Reference Implementation only after explicit UI/UX acceptance.

Once approved, future packages of the same type should inspect it before creating a new variant.

Reuse may include:

- spacing rhythm;
- content width;
- PageHeader structure;
- breadcrumb treatment;
- action placement;
- table/filter structure;
- surface treatment;
- typography scale;
- responsive behavior;
- shared components.

Do not copy:

- page-specific data;
- domain-specific rules;
- actions/permissions;
- backend assumptions;
- text that belongs to another workflow.

## Initial approved-reference registry

### Reference: Admin Dashboard + restrained Admin shell

- Paths:
  - `frontend/src/app/(portal)/admin/dashboard/page.tsx`
  - `frontend/src/app/(portal)/admin/layout.tsx`
  - `frontend/src/components/ui/page-header.tsx`
  - `frontend/src/components/ui/skeleton.tsx`
- Accepted commit: `89a233f3e7a6cea0ac49208a0a0726fe1ab634be`
- Implementation chain:
  - `b82cb448ba46fc2ce3b2ed0b0b48304fe73c3a06` — Admin Dashboard + restrained shell refinement
  - `89a233f3e7a6cea0ac49208a0a0726fe1ab634be` — accepted FIX for active thesis-pipeline semantics and long Program-name visibility
- Pattern type: wide operational Admin dashboard + Admin portal-shell visual baseline.
- Reuse:
  - shell-owned outer gutters and page rhythm;
  - PageHeader ownership of page identity;
  - restrained neutral surfaces with EARIST brand emphasis;
  - dashboard section hierarchy based on operational priority rather than arbitrary counts;
  - structural Skeleton loading, explicit empty/error states, and restrained functional motion;
  - accessible sidebar active/focus/collapse/mobile behavior;
  - clear separation between Admin-owned action queues and workflow monitoring;
  - user-facing wording that reflects authoritative domain meaning rather than raw implementation terminology.
- Do not copy:
  - Dashboard-specific KPIs, metrics, queue definitions, section order, or backend read model into unrelated pages;
  - Admin-only routes, navigation, permissions, or shell behavior into other roles;
  - Thesis/COR/Defense/RAP semantics into other domains;
  - dashboard card composition where a table, form, detail page, or workflow view better fits the task.

This reference is concrete precedent, not a requirement that future screens become dashboard-like. Reuse only the parts that match the target page type and task.

Existing legacy pages remain non-authoritative unless explicitly added to this registry.

---

# 31. Iteration protocol

For every UI/UX package:

## Step 1 — Read

Read:

- CONTEXT.md for orientation;
- this playbook;
- UI_UX_AUDIT.md;
- applicable canonical domain docs;
- package-specific accepted specs/plans;
- any approved reference implementation listed by the prompt.

## Step 2 — Verify repository state

Before editing, report:

- branch;
- expected parent SHA;
- actual HEAD;
- remote/local relationship if available;
- worktree state.

Hard-stop on the wrong parent or unrelated dirty changes unless explicitly resolved.

## Step 3 — Audit the target screen

Before changing code, identify:

- user role;
- task;
- current hierarchy;
- current authoritative state source;
- current actions and permissions;
- current loading/error/empty behavior;
- state ownership and asynchronous-rendering risks;
- table/column/layout-stability risks where applicable;
- responsive risks;
- reusable components already present.

## Step 4 — State exact bounded goal

The package prompt must define:

- what user problem is being solved;
- allowed files/areas;
- whether backend read support is permitted;
- business behavior that must remain unchanged;
- non-goals.

## Step 5 — Implement

Prefer:

- shared primitives;
- project tokens;
- existing dependency stack;
- minimal changes.

Do not redesign unrelated pages.

## Step 6 — Validate

Run package-appropriate:

- frontend TypeScript/typecheck;
- targeted lint;
- build when practical/relevant;
- focused tests;
- backend checks if backend contract changed.

Do not change production behavior solely to hide an unrelated failing check.

## Step 7 — Manual UI/UX QA

Check changed screens in real runtime when executable:

- desktop;
- narrow/mobile where applicable;
- keyboard basics;
- loading/error/empty paths that can be exercised;
- no avoidable loading -> empty -> loaded flash;
- no unexpected table-column or major layout shift during data transitions;
- background refetch behavior when relevant;
- main action;
- destructive confirmation if changed;
- workflow state preservation.

Report PASS / FAIL / NOT EXECUTABLE honestly.

## Step 8 — Commit and stop

Commit/push only the assigned package.

Report:

- starting HEAD;
- ending HEAD;
- parent SHA;
- exact changed files;
- behavior changed;
- tests/checks;
- manual QA;
- known limitations;
- worktree state;
- push state.

Then stop.

Exact stop rule:

STOP after this task. Do not start the next package until explicitly instructed.

---

# 32. Review and acceptance

The coding-agent report is evidence, not authority.

The reviewer/prompter must independently inspect:

- actual remote branch HEAD;
- commit parent;
- changed files;
- diff;
- relevant final source;
- whether scope was respected.

For UI packages, source review alone may not prove visual quality. Manual screenshots/runtime review may still be required.

Acceptance states:

- ACCEPTED;
- NOT ACCEPTED;
- NOT EXECUTABLE for specific validation only, not as a substitute for acceptance.

If rejected, issue only a bounded FIX for the same package. Do not auto-advance.

---

# 33. Package sizing

Good UI/UX package examples:

- introduce shared Breadcrumb + PageHeader foundation and apply to one pilot page;
- refine Admin Defense Applications list using accepted page hierarchy;
- standardize one record-detail pattern;
- replace native confirmation on one workflow area;
- add loading/empty/error states for one module;
- refine one portal shell;
- add one shared status taxonomy component and migrate one bounded screen set.

Bad package examples:

- redesign all Admin pages;
- convert every Card in the repository;
- add every missing shadcn primitive;
- standardize all forms and tables at once;
- refactor all four portal layouts plus every page.

---

# 34. Content design rules

User-facing copy should be:

- concise;
- specific;
- role-aware;
- based on real system state;
- free of implementation jargon where not necessary.

Prefer:

- “Waiting for Chairman conclusion”
over
- “State is AWAITING_CONCLUSION”

when the raw state name is not useful to the user.

But do not paraphrase away meaningful official terminology.

Never invent policy explanation to make a screen feel complete.

If policy is unresolved, show only what the accepted system can truthfully state.

---

# 35. Security and privacy in UI

Do not improve “convenience” by weakening privacy.

Preserve:

- authorized document routes;
- role-based access;
- no public raw storage paths;
- no sensitive record leakage in breadcrumb/URL labels;
- synthetic data in tests and examples;
- no reuse of real uploaded PII in screenshots/docs/tests.

UI previews and reference examples must avoid real user PII.

---

# 36. Performance awareness

UI polish should not introduce avoidable heavy client behavior.

Prefer:

- existing server/API data;
- TanStack Query cache patterns already in use;
- lightweight icons;
- skeletons rather than fake delays;
- virtualized/advanced table behavior only if real data scale proves necessary.

Do not add a large UI dependency for one minor interaction when current primitives can solve it.

---

# 37. Dark mode

Dark mode is not an initial UI/UX priority.

Current CSS contains dark tokens and dependencies may support them, but enabling/refining dark mode would significantly expand QA surface.

Do not include dark-mode work in unrelated refinement packages.

It may become a separate future initiative if explicitly requested.

---

# 38. Font decisions

The current system uses a Calibri/Segoe UI-oriented stack.

A future system-wide font refinement may be considered, but:

- do not change font per page;
- do not add multiple font families casually;
- assess readability, loading, and institutional tone;
- perform it as a bounded system-level package.

Typography hierarchy can and should improve even before a font-family change.

---

# 39. Definition of a successful refinement

A UI/UX package is successful when the changed area is:

- easier to understand;
- easier to navigate;
- more visually coherent;
- consistent with accepted project patterns;
- responsive;
- accessible at a practical baseline;
- faithful to authoritative workflow behavior;
- no more complex than necessary.

“Looks modern” alone is not an acceptance criterion.

---

# 40. Working principle

Refine the system by building reusable precedent.

Each accepted iteration should either:

1. improve one bounded screen with existing standards; or
2. establish a reusable standard that makes future pages easier to refine.

The playbook is the rule set.

The audit is the improvement map.

Approved Reference Implementations are the concrete examples.

Canonical domain documents remain the business authority.
