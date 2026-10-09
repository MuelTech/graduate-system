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

Accepted Exam Management precedent: UIUX-2C uses the user-facing label **Exam Records** for the entrance-exam operational list while intentionally keeping the existing technical route `/admin/exam/applications` and backend application model/endpoint unchanged. One row represents one entrance-exam record, not a second Applicant profile. The list owns exam-specific schedule/state monitoring; person-level admission context remains with Applicants / Applicant Profile. A clearer user-facing task label may differ from a legacy technical route when domain behavior is unchanged and the distinction is documented.

Accepted UIUX-2D and UIUX-2E complete that transition. **Exam Records is now the Admin operational workspace for entrance-exam monitoring, essay grading, completed assessment/result review, and result-email actions.** `TAKEN` records surface as **Needs Essay Grading** and open the nested Exam Record detail for grading; `PASSED` / `FAILED` records use the same detail surface for the recorded result and result-email action. The former Score Management destination is retired from Admin navigation; `/admin/exam/scores` remains only as a compatibility redirect to `/admin/exam/applications`. The legacy read endpoints `GET /exam/scores/queue` and `GET /exam/scores/review` are retired. The working mutations `POST /exam/scores/:id/grade` and `POST /exam/scores/:id/send-email` are intentionally retained under the `/exam/scores` namespace and do **not** require renaming merely because the UI action moved into Exam Records. Existing COR Validation and Waiver Validation placement/behavior remains unchanged by this precedent.

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

Accepted nested-detail precedent: the Admin Applicant Profile uses the shared `Breadcrumb` as `Applicants / <Applicant Name>`, with a clickable parent and non-clickable `aria-current="page"` record label. This establishes the reusable list → person-detail wayfinding pattern without requiring every record type to use the same number of breadcrumb levels.

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

### Reference: Admin Applicants list

- Primary path:
  - `frontend/src/app/(portal)/admin/users/applicants/page.tsx`
- Supporting read-model/rules path:
  - `backend/src/services/admin-applicant-list.rules.ts`
- Accepted commit: `ac5b54e424c4fb8849262b2a2f64a45c95743a82`
- Implementation chain:
  - `6845e545a66f1c9ca8b7d46eb402aad333edbe13` — Applicants admission-journey registry refinement
  - `ac5b54e424c4fb8849262b2a2f64a45c95743a82` — accepted FIX for long Program-name readability, typography hierarchy, stage-filter consistency, and query-safe failure behavior
- Pattern type: wide Admin record-management/list page with search, filters, pagination, workflow-state projection, and one dominant row action.
- Reuse:
  - the shared PageHeader hierarchy established by the Admin reference;
  - compact filter surfaces with discoverable labels, reversible filters, and clear no-results behavior;
  - canonical list typography: 14px operational/form/primary row text, 12px compact table headers and genuinely secondary metadata, with neutral primary row identity rather than repeated strong brand color;
  - fixed canonical type sizes with deliberate responsive breakpoints rather than continuously fluid scaling; browser zoom and OS/accessibility scaling must remain usable;
  - bounded selectors whose opened option list keeps long authoritative names fully readable; local wrapping/wider popup treatment is preferred over silently clipping meaningful values;
  - intentional table column sizing, local horizontal overflow when necessary, and stable structural Skeleton rows;
  - distinction between initial loading, same-query background refresh, confirmed empty, and query-specific failure;
  - query-cache behavior that never presents unrelated previous-filter rows as if they matched a newly requested filter after failure;
  - a single clear row action when one dominant action exists;
  - human-readable workflow/current-state text derived from authoritative backend/read-model state rather than raw enum labels.
- Do not copy:
  - Applicant-specific Admission Progress stages, Current State mappings, active-Applicant scope, Entrance Exam semantics, COR semantics, or Program/Stage filter rules into unrelated domains;
  - the exact six-column schema into pages whose comparison task requires different information;
  - a frontend-derived workflow model when the target domain lacks authoritative backend state;
  - table presentation into detail/form/workflow screens where another composition is more appropriate.

The Applicants reference demonstrates a list-page pattern, not a universal DataTable abstraction. Extract shared table/filter primitives only when repeated accepted screens prove the need.

### Reference: Admin Applicant Profile / detail

- Primary path:
  - `frontend/src/app/(portal)/admin/users/applicants/[id]/page.tsx`
- Shared primitive introduced:
  - `frontend/src/components/ui/breadcrumb.tsx`
- Supporting read-model paths:
  - `backend/src/services/admin-applicant.service.ts`
  - `backend/src/repositories/admin-applicant.repository.ts`
- Accepted commit: `74a836886727ec5f808819566235400da5e0c95b`
- Implementation chain:
  - `81333c29e7889eaf3c4b454fc2c0e57adffed69f` — initial Applicant Profile/detail refinement
  - `74a836886727ec5f808819566235400da5e0c95b` — accepted density/read-model cleanup removing redundant Account Access and incomplete Activity History
- Pattern type: person-centric, cross-workflow Admin record-detail page that summarizes authoritative state while delegating process operations to their owning modules.
- Reuse:
  - breadcrumb → PageHeader → current-state summary → primary record content hierarchy;
  - the record/person name as PageHeader identity rather than a generic “Profile” heading;
  - a restrained Current Admission State surface that combines human-readable condition with compact workflow progression;
  - one dominant workflow/detail surface plus one compact contextual-detail surface instead of equal-weight card stacks;
  - consolidated metadata/academic context using description-list semantics and content-driven height;
  - structural detail Skeletons that approximate the final composition and distinct loading/error/not-found states;
  - bounded backend read-model additions when the page needs existing authoritative data such as Program type or prerequisite academic relations;
  - fail-closed presentation when authoritative workflow data is absent or null;
  - contextual links to the operational workspace that owns the action instead of duplicating mutations on the profile.
- Information-architecture rule:
  - a person/profile detail is a longitudinal overview of the record;
  - dedicated management modules remain the authoritative operational workspaces for Waiver, Entrance Exam, COR, and similar process-specific work;
  - summary pages may show current status and key context, but should not recreate full queues, attempt history, review diagnostics, or mutation workflows owned elsewhere.
- Deliberate exclusions from the accepted profile:
  - no redundant Account Access block when identity/account type adds no actionable support value;
  - no “Activity History” projection when the available audit query does not represent a complete lifecycle; keep audit infrastructure intact and build a normalized timeline only as a separate feature if later justified;
  - no standalone duplicate Admission Status/eligibility card when the Admission Journey already communicates the same progression;
  - no inline Waiver validation/rejection, Exam operations, COR Verify/Reject/Promote, or password/account-recovery controls.
- Do not copy:
  - Applicant-specific Alignment → Entrance Exam → COR semantics into unrelated domains;
  - Applicant-specific prerequisite labels into Student/Thesis/Defense details without domain authority;
  - the exact 2/3 + 1/3 composition when another record type has different content density;
  - “history” UI merely because audit rows exist; history labels must match the completeness and meaning of their source data.

This reference establishes the current detail-page precedent, not a universal profile template. Preserve the hierarchy and ownership principles while adapting sections to the target record’s real task and domain authority.

### Reference: Admin Entrance Exam Records list

- Primary path:
  - `frontend/src/app/(portal)/admin/exam/applications/page.tsx`
- Navigation label path:
  - `frontend/src/app/(portal)/admin/layout.tsx`
- Accepted commit: `9e03e0192e6131149c172a90e0ea6531017247b0`
- Pattern type: wide operational Admin record list for one domain-specific process record per row.
- User-facing information architecture:
  - sidebar/page terminology is **Exam Records / Entrance Exam Records** even though the legacy route remains `/admin/exam/applications`;
  - one row represents an entrance-exam record, not a duplicate Applicant registry;
  - the accepted list focuses on Applicant, Program, Exam Schedule, Exam State, and one restrained row action;
  - Applicant identity is intentionally compact (name + Pinnacle ID), while broader person/admission context remains owned by Applicants / Applicant Profile;
  - no KPI/statistic-card layer is required when filters + the operational table answer the page task directly.
- Accepted presentation-only state projection from persisted `ExamAppStatus`:
  - `PENDING` / `APPROVED` → **Scheduled**;
  - `TAKEN` → **Needs Essay Grading**;
  - `PASSED` → **Passed**;
  - `FAILED` → **Failed**;
  - `APPEALED` → **Appeal Pending**;
  - `DISQUALIFIED` → **Disqualified**;
  - unknown/unrecognized values fail visibly as **Unknown** rather than inventing a domain transition.
- Reuse:
  - compact Search + exact Program-ID + Exam State filters with reversible Clear behavior;
  - human-readable state labels may project authoritative enums without creating new persisted statuses;
  - structural table Skeletons, explicit initial-error Retry, and distinct empty vs filtered-no-results states;
  - stable wide-table composition with local horizontal overflow on constrained widths;
  - one dominant **View** action into the accepted nested Exam Record detail rather than duplicating record work inside the list.
- Deliberate boundaries in the accepted main page:
  - essay grading remains off the list itself; **Needs Essay Grading** routes the Admin into the nested Exam Record detail where the response and scoring control belong;
  - Passed/Failed records use the same nested detail for the persisted assessment result and result-email action rather than a separate score-review workspace;
  - Score Management was retired as a standalone Admin destination in UIUX-2E at `8adea9f3bdb6797d8861212ecd92b9106a183c0d`; `/admin/exam/scores` is compatibility redirect only;
  - the retired Score Management reads `GET /exam/scores/queue` and `GET /exam/scores/review` must not be reintroduced merely to recreate the old workspace;
  - `POST /exam/scores/:id/grade` and `POST /exam/scores/:id/send-email` remain intentional backend action routes used by Exam Record detail and are not unfinished route migrations;
  - `APPEALED` is display-only as **Appeal Pending** here; the existing missed-exam appeal transition semantics were not redesigned and Approve/Reject controls are intentionally absent;
  - COR Validation and Waiver Validation were not changed.
- Do not copy:
  - these exact ExamAppStatus labels into unrelated workflows;
  - the legacy `/applications` route name as user-facing terminology merely because it exists technically;
  - the retired Score Management workspace into future entrance-exam UI;
  - exam-specific schedule/result semantics into Applicant, Thesis, Defense, or other record lists.

This reference establishes the accepted entrance-exam **main-list** baseline. The nested detail/grading/result pattern is separately accepted below.

### Reference: Admin Entrance Exam Record detail

- Primary path:
  - `frontend/src/app/(portal)/admin/exam/applications/[id]/page.tsx`
- Supporting read-model/API paths:
  - `backend/src/interfaces/exam.interfaces.ts`
  - `backend/src/repositories/exam.repository.ts`
  - `backend/src/services/exam.service.ts`
  - `backend/src/controllers/exam.controller.ts`
  - `backend/src/routes/exam.routes.ts`
- Accepted detail/grading commit: `ee7bfca95faa9de1abec624d15fffc49614ce222`
- Accepted Score Management retirement follow-up: `8adea9f3bdb6797d8861212ecd92b9106a183c0d`
- Pattern type: medium-width, state-aware operational detail for one entrance-exam record.
- Reuse:
  - shared Breadcrumb as `Exam Records / <Applicant Name>`;
  - PageHeader owns record identity (Applicant name + Pinnacle ID + Program) with a restrained **View Applicant Profile** contextual link rather than duplicating person/admission details;
  - a prominent **Current Exam State** surface precedes compact Exam Information and state-dependent Assessment;
  - Scheduled/unsupported states show an honest unavailable assessment instead of empty score cards;
  - `TAKEN` / **Needs Essay Grading** shows the authoritative read-only MCQ score, all submitted essay responses in deterministic order, one bounded essay-score input, and **Save Essay Grade**;
  - `PASSED` / `FAILED` shows persisted MCQ, Essay, Total, Result, and actual grader identity when recorded; missing grader identity is **Not recorded**, never an invented user;
  - result email is an action on the completed record and reports queueing, not delivery.
- Bounded backend contract:
  - `GET /exam/applications/:id` is the ADMIN-only record-detail read model;
  - it exposes only the record identity/schedule/program score configuration, persisted score/grader identity, and ESSAY responses needed by the screen;
  - it does not expose correct answers or create new domain authority.
- Intentional action-route ownership:
  - `POST /exam/scores/:id/grade` remains the existing ADMIN-only essay-grading action;
  - `POST /exam/scores/:id/send-email` remains the existing ADMIN-only result-email action;
  - these routes intentionally keep the `/exam/scores` namespace even though the user-facing work now lives in Exam Records. Do not rename them solely for URL symmetry.
- Retired Score Management architecture:
  - the Admin sidebar no longer exposes **Score Management**;
  - `/admin/exam/scores` is compatibility redirect only;
  - `GET /exam/scores/queue` and `GET /exam/scores/review` are retired;
  - **Needs Essay Grading** in Exam Records replaces the old grading queue as the operational entry point;
  - Passed/Failed Exam Record detail replaces the old Score Review workspace.
- Authority boundaries:
  - the frontend does not preview, recompute, or newly establish PASS/FAIL policy; it calls the existing grading action and refetches the persisted result;
  - no fake grading timestamp is shown because no dedicated authoritative grading-event timestamp exists;
  - no persistent delivery/sent state is fabricated from a successful queue request;
  - `APPEALED` remains missed-exam appeal context and read-only on this page; Approve/Reject/Reschedule behavior remains a separate unresolved domain package;
  - COR Validation, Waiver Validation, Exam Slots, and Exam Questions were not changed by UIUX-2D/UIUX-2E.
- Do not copy:
  - entrance-exam scoring or appeal semantics into other record-detail domains;
  - the exact Assessment composition where another workflow has different authority;
  - score-derived PASS/FAIL behavior as a generic UI rule.

This reference establishes the accepted entrance-exam **detail + grading/result** pattern while preserving backend/domain authority and keeping legacy implementation details out of the user-facing information architecture.


### Reference: Admin Students List — UIUX-2F

- Page: `frontend/src/app/(portal)/admin/users/students/page.tsx`; backend list read model: `backend/src/repositories/admin-student.repository.ts` and `backend/src/controllers/admin-student.controller.ts`.
- Accepted final commit: `cbcb13800886be727e103b0df502340fe161d41c` (initial registry/backend `790e3def573c1bf0d2cb2f3e8981d06761a71880`; visual table/filter alignment `a1cc62c8ea1dac736d8cef217bcc2adbcf74013e`; accepted identity correction `cbcb13800886be727e103b0df502340fe161d41c`).
- Pattern: wide, person-centric **graduate student registry**, separate from Applicants' admissions lifecycle.
- Accepted UI: PageHeader; compact Search / exact Program ID / Student Status filter card; **Student | Program | Comprehensive Exam | Thesis Progress | Student Status | Action** table; server pagination; no KPI cards; one accessible View action to the profile.
- Student identity uses **three separate lines**: emphasized name, student number, then email (not combined with a separator). Reuse Applicant-table readable 14px primary / 12px secondary type, `px-4 py-3` row rhythm, intentional column widths, responsive local overflow.
- The registry includes only `ENROLLED`, `GRADUATED`, `DISMISSED`; excludes `APPLICANT` even for malformed/unsupported status values. Search is debounced and backend-backed; filters run before count/pagination.
- Missing Comprehensive Exam is `NOT_RECORDED`, distinct from a persisted `PENDING`; no thesis record is distinct from an actual latest ThesisRecord stage/status. Latest administrative ThesisRecord data is **not** proof of formal academic stage completion.
- Query-scoped loading/refetch treatment, structural table Skeleton, initial request error/Retry, distinct no-students/no-match states are part of this accepted list pattern.
- Do not copy the exact table geometry or Student/Comp Exam academic semantics into unrelated lists.

### Reference: Admin Student Profile / detail — UIUX-2G

- Page: `frontend/src/app/(portal)/admin/users/students/[id]/page.tsx`; bounded data contract: `backend/src/interfaces/admin-student.interfaces.ts`, `backend/src/repositories/admin-student.repository.ts`, `backend/src/services/admin-student.service.ts`, `backend/src/routes/admin-student.routes.ts`.
- Accepted final commit: `d80b95cef0f9124b3b4141c4fe5af58887e32316` (initial UI and read models `ecb35b3f15fae4e4ac9d2fe27a01cbcabac47a56`; dead-space layout correction `d80b95cef0f9124b3b4141c4fe5af58887e32316`).
- Pattern: longitudinal **academic monitoring and support overview**, not another Thesis Management operational workspace.
- Accepted hierarchy: clickable Students breadcrumb → student name PageHeader with number/program/status → compact full-width **Current Academic State** → main two-column area (dominant **Academic Journey** left; shorter **Comprehensive Examination** and **Account Support** cards right) → **full-width Student & Academic Details** below.
- The full-width details surface is grouped into **Personal Information**, **Academic Information**, and **Adviser & Residency** and uses responsive 1-/2-/3-column presentation. Content-driven card heights eliminate the initial layout's dead space; do not artificially stretch content.
- `GET /admin/students/:id` is an ADMIN-only explicit nullable student-detail projection; ADMIN-only `GET /admin/students/:id/journey` resolves the student server-side and delegates to the existing `StudentThesisJourneyService.getJourney` / central evaluator. The original STUDENT-only `/thesis/journey` remains role-protected. Never implement a second frontend progression calculator or treat `ThesisRecord.stage/status` as formal Defense completion.
- Journey/lock reason/next action are backend-authoritative; independent journey failure renders an isolated Retry state without losing loaded identity/details; initial skeleton, not-found, server error, and missing-data states remain distinct.
- **Defense Records** contextual action opens the existing general `/admin/thesis/defense-records` workspace. **Student-specific prefiltering/return navigation is a deferred future improvement**, not currently implemented.
- **Known functional issues NOT resolved by visual acceptance:** Comprehensive Exam recording overwrites the latest record, making full attempt history and strike counts unreliable; recording controls may remain visible for an enrolled student whose latest result is already `PASSED`; `PUT /admin/students/:id/comprehensive-exam` lacks server-side admission-status eligibility enforcement despite the page's enrolled-only UI visibility check. Review attempt/two-strike authority and server-side permission in a separately approved functional package.
- The **Reset Student Password** button in Account Support is intentionally disabled. `AUTH-RECOVERY-1` (Admin-assisted secure random temporary password, forced change, audit/session safeguards, later optional email integration) is **not implemented**. No authentication or email-delivery functionality was added.
- Do not generalize Student journey gates into unrelated profiles; no Admin stage override/force-complete authority is created by this reference.

The user manually accepted both Students page designs. Acceptance registers the UI/UX references **only**; it does not certify deferred business, account-recovery, or navigation functionality.

### Reference: Panelist My Defenses — UIUX-3B

- Page: `frontend/src/app/(portal)/panelist/defenses/page.tsx`; presentation helpers: `frontend/src/lib/panelist-defenses.ts`; manuscript viewer: `frontend/src/components/panelist/manuscript-dialog.tsx`.
- **Accepted final implementation commit:** `bf706c1ab12aa8291e648ae74c6ee4a41cebadec` on `refactor/system-ui-ux`. **Status: ACCEPTED** by project owner after screenshot-based manual desktop UI/UX review (2026-10-08).
- Implementation chain:
  - `96970f04de47655c5f481dabd6f4882a7b08d95e` — searchable assignment registry, stage/session filtering, contextual action, pagination, and structural Skeleton.
  - `7d3e6dbc053b2ed550103936f7734cdae3e4ee00` — compact cards, quick filters, assignment-scoped View Manuscript, Materials display restriction, and backend panelist document-access correction.
  - `8e44aa9c2326a3c06793caadcec51ce3f1388df4` — defense venue and safe meeting-link display.
  - `d152459c45aaff248304437489dedcf1d1a3d577` — intermediate two-column layout, **not** the accepted layout.
  - `8f248671d896ade3f0a2a75b9501d0c6aa931af6` — accepted full-width, faculty-readable cards, enlarged student identity and key information, larger actions, and matching Skeletons.
  - `bf706c1ab12aa8291e648ae74c6ee4a41cebadec` — final neutral `Venue / Meeting Details` label and `Open Meeting Link` action; no assumption that a URL proves an online-only defense.
- **Pattern type:** wide, faculty-oriented **assigned defense registry** with one full-width card per defense, comfortable type (20px student identity, ~16px operational details, 44px action targets), and meaningful grouped information rather than tiny text or stretched empty space.
- **Accepted hierarchy:** shared PageHeader → All / Upcoming / In Progress / Completed quick filters plus Search / Defense Stage / Session Status controls → full-width assignment cards (student identity and student number/program; independent authoritative session status; defense stage and assigned role; date/time; physical venue or meeting link; own evaluation progress only where relevant; authorized actions) → pagination.
- **Reusable UX precedent:** prioritise legibility for faculty users; group schedule and venue near one another; show meeting/location information without inferring delivery mode; place secondary `View Manuscript` before one clear primary `Continue Evaluation`, `Open Defense`, or `View Defense` action as eligibility allows; responsive full-width cards, structural card-shaped Skeletons, distinct no-record/no-match/error/refresh feedback.
- **Role/authority boundaries:** `Continue Evaluation` requires an assigned Proposal/Final numerical evaluator with own `NOT_STARTED` or `DRAFT` score in an editable session; Title/Facilitator/Rapporteur do **not** get invented numerical scoring. `CONCLUDED` uses a read-only label; `CANCELLED` exposes no workspace action. `Upcoming` requires future valid scheduled wall-clock date/time and never means merely `SCHEDULED`.
- **Manuscript boundary:** `View Manuscript` retrieves a document selected by the existing assignment-scoped Defense Workspace service, reuses the authenticated viewer, and shows only the authorized Title Proposal Package or exact certified Proposal/Final manuscript; it must not enumerate generic admission/COR/receipt/evidence uploads. FIX-1 narrowed PANELIST document-route access to known academic manuscript types; the existing active-Adviser authorization path remains separate. Stage-specific certified selection must not be replaced by a generic `thesisDocuments` list.
- **Known limitations/follow-up:** UIUX-3D subsequently removed the redundant `Materials` and `Defense Workspaces` sidebar entries and converted only their index routes into redirects (commit `7f78f4df9d1a5dc613f38a80307b0fc275ac73cb`); that navigation consolidation is implemented and source-reviewed, **pending independent browser QA**, not a separate Approved Reference. The canonical `/panelist/defense-workspace/[scheduleId]` remains unchanged and UIUX-3C workspace refinement is future work. The list's upcoming cutoff uses a mount-time snapshot. Responsive/mobile, keyboard, and live error/loading interaction checks remain to be independently exercised where not evidenced.
- **Validation provenance:** coding-agent reports for the initial and FIX packages recorded frontend TypeScript/scoped ESLint PASS; FIX-1 backend build and unit tests PASS (1,075 passed / 5 skipped) after the document-access security correction. The frontend production build remained blocked by the unrelated pre-existing `/login` Suspense/prerender issue. The later direct layout/wording commits were verified through GitHub source/diff checks, **not** through a fresh full typecheck/build or automated browser test. Project-owner acceptance concerns the final **visual/UI/UX direction** after manual screenshots, not certification of every runtime, security, mobile, or end-to-end behavior.
- **Do not copy:** panelist role gates, defense-status interpretation, manuscript access, or this exact full-width card shape into unrelated registry/workflow pages without considering their audience and data density.

This is the **eighth** explicitly accepted UI/UX reference. The Panelist Dashboard remains a separate, unaccepted implementation checkpoint.

### Reference: Student Dashboard — UIUX-4A

- **Primary page:** `frontend/src/app/(portal)/student/dashboard/page.tsx`; pure presentation projections: `frontend/src/lib/student-dashboard.ts`. **Accepted implementation commit:** `2e5acbcdd6696556683b6026dbf59c9643e0589a` (`feat(uiux): refine student dashboard into academic overview`), parent `5d9c2b6f25b8225434f34942d53826a22086b4af`, branch `refactor/system-ui-ux`.
- **Review status:** **ACCEPTED visual/UI/UX reference** by project owner on 2026-10-08 ("okay yung dashboard ng student for me"; owner subsequently requested documentation promotion). The reviewer independently verified the remote commit, two-file diff, key data flows, and pure helper logic in source. This is **not** a claim that manual browser regression, every state fixture, mobile/keyboard checks, or end-to-end correctness have passed.
- **Pattern type:** personalized **Student academic overview**, not an Admin operational KPI board, faculty task queue, duplicate Academic Journey, or collection of equal-weight shortcut cards. Prioritize the student's **current progress, next responsibility or waiting reason, and important updates**.
- **Accepted content hierarchy:** shared PageHeader with actual first name/program/student number → two restrained **Academic Status** summaries (Comprehensive Examination and Current Thesis Stage) → prominent full-width **Your Next Step** → compact five-milestone **Thesis Journey** → conditional **Defense Schedule** → secondary **Recent Notifications** and **Announcements** previews. No redundant Quick Links section (sidebar already supplies navigation); the misleading raw "Requirements submitted: X" counter was removed.
- **Academic authority:** `GET /thesis/journey` through the existing `useStudentThesisJourney()` hook/query key is the **only** thesis-stage source: `currentStep`, `steps`, `state`, `defenseStatus`, `lockReason`, `nextAction`, `defenseSession`, and `policy.strikeRequired`. Reuse existing journey route/label and wall-clock formatting helpers. `GET /student/journey` supplies STUDENT-scoped identity, program, and the most recent Comprehensive Exam entry ordered `createdAt desc` (`take: 1`); do not use that legacy DTO to calculate formal Thesis Journey progress.
- **Next-step classification:** one primary action only when the current canonical step is `CURRENT`/`AVAILABLE`, or an explicitly returned/rejected defense application supports resubmission. `WAITING` and `LOCKED` have **no submission CTA**; status explanations distinguish Admin review, approval awaiting schedule, adviser vs Dean decision, awaiting official result, and RAP/signature finalization. `FAILED`, `REVISION_REQUIRED`, and `CANCELLED_SESSION` preserve distinct informational outcomes without inventing self-service permissions. `currentStep === null` says **Thesis journey completed**, **not** graduated or cleared. A `nextAction` string alone is not authority.
- **Milestone presentation:** Title Defense → Adviser Request → Proposal Defense → STRIKE/Plagiarism → Final Defense, using canonical step states. STRIKE with `policy.strikeRequired === false` is labeled **Not required** (not falsely shown as a completed student task); do not derive artificial completion percentages or skip thesis gates.
- **Defense schedule:** show the first canonical stage that has session status `SCHEDULED`, `IN_PROGRESS`, or `AWAITING_CONCLUSION`; do not present concluded/cancelled sessions as active. Display actual stage/date/time/status and neutral **Venue / Meeting Details**. Calendar date/time are stored as wall-clock fields; safe complete HTTP(S) meeting URLs may be opened, while room/building text remains non-clickable. A URL is not proof of online-only delivery.
- **Recent updates:** authenticated `GET /notifications` (up to three preview items, unread indicator, no implicit mark-read mutation) and audience-filtered `GET /memos` (up to two previews), with dedicated View All routes, section-level Skeletons/error/Retry, and independent failures that must not erase the thesis overview.
- **Reusable design guidance:** visual hierarchy driven by the student's next meaningful step; action versus dependency copy; compact academic summaries; conditional session detail; limited secondary updates; honest missing/loading/error states; responsive single-column fallback. Reuse standard UI primitives, spacing and restrained EARIST color hierarchy. Detailed step tasks remain on Student Thesis Journey pages, not on the Dashboard.
- **Validation provenance:** coding agent reported frontend `npx tsc --noEmit` **PASS**, targeted ESLint for the two changed files **PASS**, and build compilation/TypeScript **PASS**; overall `npm run build` **FAILED** at the pre-existing unrelated `/login` `useSearchParams()`/Suspense prerender issue. No frontend unit-test harness for `resolveNextStep`/venue projection; focused automated tests and comprehensive browser QA were **NOT EXECUTED**. Review/acceptance of this visual pattern must not be represented as passing those checks.
- **Known limitations/follow-up:** presentation of **latest** Comprehensive Exam status from `/student/journey` and Thesis Journey eligibility based on **any recorded PASSED** attempt can disagree if later records have different outcomes; test multi-attempt histories before claiming consistent eligibility. The schedule preview relies on session status, not an independent date-based upcoming cutoff, so stale `SCHEDULED` data needs end-to-end scenario coverage. Student Curriculum remains a placeholder and is not promoted by Dashboard acceptance. The source switched from server rendering to a client component for canonical Journey hook and independent section loading/error states; review auth/error behavior in runtime. No backend read models, academic mutations, or sidebar were changed.
- **Do not copy:** inferred graduation/clearance status, placeholder program/comp-exam values as academic facts, Student Journey gates or this next-step classifier into other roles. Any new workflow authority or backend contract change requires a separate approved package.

**UIUX-4A is the ninth Approved Reference Implementation.** UIUX-3A Panelist Dashboard and UIUX-3D navigation consolidation retain their separately documented pending manual-review limitations; they are **not** additional approved references.

### Reference: Admin Entrance Exam Schedules — UIUX-2H

- **Primary page:** `frontend/src/app/(portal)/admin/exam/slots/page.tsx`; pure presentation/wall-clock helper: `frontend/src/lib/admin-exam-schedules.ts`; Admin navigation label remains on the existing `/admin/exam/slots` route. **Initial refinement:** `6cab773dd61f2615c81ce3b13e766d6393d73002`. **Accepted final / FIX-1:** `ebde771a976efdcdd4147af576db74a0f4e6df3c` (`fix(uiux): clarify exam schedule booking controls`) on `refactor/system-ui-ux`.
- **Review status:** **ACCEPTED visual/UI/UX reference** by the project owner on 2026-10-10 after the FIX-1 booking-control refinement. Independent source review verified the remote final SHA, exact two-file FIX-1 diff, final booking labels/control placement, and availability projection. Acceptance is visual/UI/UX approval, **not** a claim that browser regression, every schedule state, or backend scheduling edge case has passed end to end.
- **Pattern type:** wide Admin **schedule-management list**. Use natural task terminology in the UI while retaining technical route/model names internally: sidebar **Exam Schedules**, PageHeader **Entrance Exam Schedules**, and **Create Schedule**. The accepted composition deliberately has **no KPI/statistic-card layer** because the operational list itself answers the task.
- **Accepted hierarchy:** shared PageHeader + Create Schedule → compact **Upcoming / Past / All** quick filters with exact Program and Availability filters → five-column **Program | Schedule | Capacity | Availability | Action** table → filtered pagination → shared Create/Edit Schedule Dialog. Initial loading uses structural table Skeletons; request error has Retry; true empty data and filtered-no-match states are distinct; usable rows remain mounted during background refresh where safe.
- **Schedule/availability presentation:** date and start time are grouped under **Schedule**; capacity is textual first (`booked / maximum`, seats remaining) with a secondary occupancy bar. User-facing availability is **Past → Closed → Full → Open** in that precedence. A past record must never read Open simply because `isActive` is still true; **Closed** is presentation terminology for future `isActive === false`, not a new backend status.
- **Row/action hierarchy:** the table exposes one clear **Edit** action. FIX-1 removed row-level Activate/Deactivate and deletion-like Trash semantics. For future schedules, the Edit Dialog owns the secondary booking-state mutation: **Close for Booking** or **Reopen for Booking**, with explicit confirmation that closing prevents **new** applicant selection while existing booked applicants remain assigned. Past schedules expose no booking-state mutation control; Create mode has none.
- **Booked-schedule safeguards:** once `slotsTaken > 0`, Program, Exam Date, and Start Time remain disabled in Edit and the UI explains why. Capacity may not be reduced below the current booked count in the client presentation/validation. This frontend safeguard does **not** substitute for missing server enforcement.
- **Wall-clock precedent:** `examDate` (`@db.Date`) and `examTime` (`@db.Time(0)`) represent schedule wall-clock fields. UIUX-2H replaced the prior local `Date` / `toISOString()` round-trip path with a dedicated UTC-component wall-clock projection so displayed/edit values do not shift by browser offset. Use the shared helper consistently for Upcoming/Past classification and display; do not introduce independent timezone conversions in JSX.
- **Backend authority preserved:** the existing Admin create/update/toggle routes, `ExamSlot` model, applicant booking contract, program scoping, and `isActive` payload remain unchanged. Source review confirms the booking-state PATCH only updates `ExamSlot.isActive`; it does not delete or reassign `EntranceExamApplication` records. UI wording must not imply that closing a schedule cancels the exam or removes booked applicants.
- **Known deferred functional issues:** applicant availability still uses repository logic equivalent to `examDate >= new Date()` against a date-only field, which can mishandle **same-day** future schedules after midnight; fix under a separate functional package before claiming same-day booking correctness. The full-replace slot update also lacks an independent backend guard enforcing `maxSlots >= slotsTaken`; UIUX-2H's client minimum is not authoritative server protection. Pre-existing rows written through the old local→UTC path may already contain shifted wall-clock values and were not data-migrated.
- **Validation provenance:** coding-agent reports for UIUX-2H/FIX-1 record frontend `npx tsc --noEmit` **PASS** and scoped ESLint **PASS**. Production build compilation and TypeScript completed, but overall `npm run build` still **FAILED** only at the pre-existing unrelated `/login` `useSearchParams()`/Suspense prerender issue. No frontend unit-test harness exists for the pure helper; Playwright/browser runtime QA was **NOT EXECUTED** in the agent environment. Project-owner visual acceptance must not be restated as automated/runtime PASS.
- **Reusable design guidance:** operational scheduling pages benefit from task-language labels, compact exact filters, one dominant row action, meaningful capacity text, explicit temporal/bookability states, focused shared Dialogs, and high-impact secondary mutations moved out of the scan-heavy table. Do not copy Entrance Exam date/time, capacity, applicant-booking, or `isActive` semantics into unrelated scheduling domains without their own authority review.

**UIUX-2H is the tenth Approved Reference Implementation.** UIUX-3A Panelist Dashboard and UIUX-3D navigation consolidation remain separately documented pending checkpoints, not additional approved references.

### Reference: Admin COR Verification — UIUX-2I

- **Primary page:** `frontend/src/app/(portal)/admin/exam/cor/page.tsx`; Admin navigation label in `frontend/src/app/(portal)/admin/layout.tsx`; terminology consistency follow-up in `frontend/src/app/(portal)/admin/users/applicants/[id]/page.tsx`. **Main refinement:** `8c4401b8d36e763d2f62eef4e84b6844bd726a9e` (`refactor(uiux): refine admin COR verification`). **Accepted final / FIX-1:** `5e88b63ce65551f7a5996b63b7f0aa31671d8498` (`fix(uiux): align COR verification terminology`) on `refactor/system-ui-ux`.
- **Review status:** **ACCEPTED visual/UI/UX reference** by the project owner on 2026-10-10 after the terminology consistency FIX. Independent source review verified the final remote SHA, exact one-line FIX-1 diff, canonical `COR Verification` wording in the sidebar/page/contextual Applicant Profile link, and unchanged destination `/admin/exam/cor`. Acceptance is visual/UI/UX approval, **not** a claim that browser regression, every extraction state, document-viewer path, or end-to-end verification/rejection scenario has passed.
- **Pattern type:** Admin **document-verification master-detail workspace**, not a generic data table. Use task language that reflects the real workflow: the person is already academically enrolled through EARIST/Pinnacle; this screen verifies the uploaded Certificate of Registration and confirms the official Student information used inside this system.
- **Accepted hierarchy:** shared PageHeader **COR Verification** → optional inline success/error feedback → left **Pending COR Reviews** queue with integrated pending count → right selected review workspace: Applicant summary → **Uploaded COR** / authenticated View COR → **Confirm COR Information** → **Student Record Details** → collapsed **Extraction Details** → Reject / Verify actions. On constrained widths, queue and detail stack into one column.
- **Queue behavior:** primary applicant identity at readable operational size; Program, filename, upload date, and extraction status remain secondary. Selected state is communicated with more than color. Initial queue loading uses structural Skeleton rows; request failure has Retry; true no-pending state says all reviews are complete; background refresh preserves usable loaded data where practical.
- **Comparison and extraction authority:** compare **Current Applicant Record** with **Confirmed COR Information** for Name, Email, and Program, using Match / Different / No existing data / Not extracted as assistive labels. A difference does **not** automatically reject the COR. Parser/OCR extraction remains suggestion-only: no automatic verification/rejection, no fuzzy authority, and no Program creation. Exact unique Program matching may preselect an existing graduate Program while manual Admin confirmation remains authoritative.
- **Student-record terminology:** **Student Record Details** contains Student Number (required) and Registration Number (optional under the existing contract), not “credentials.” The primary action is **Verify COR & Create Student Record** and confirmation asks **Verify COR and create this Student record?** This is user-facing workflow language only. The backend **updates the existing User and Student rows** and creates the authoritative `CorRecord`; it does **not** create a duplicate account or duplicate Student entity, does not generate a new password, and retains the existing account/password.
- **Verification authority:** existing backend safeguards remain canonical: exact current PENDING COR, Applicant-state and APPLICANT-role checks, passed Entrance Exam gate, existing Program requirement, validated confirmed email/identity fields, transactional claim/update, `CorRecord` creation, and audit behavior. Confirmed Name, Email, Program, Student Number, and optional Registration Number become the system's authoritative Student/COR information according to the existing transaction. UI text must not imply a second EARIST/Pinnacle enrollment.
- **Rejection behavior:** **Reject COR** uses the shared Dialog, requires a rejection reason, and explains that the current COR submission is rejected while the applicant may submit a new COR. Existing backend rules retain prior history and permit rejection only for the exact current PENDING submission; rejection is not deletion.
- **Feedback and supporting detail:** native browser `alert()` was removed. Verification/rejection successes and failures use visible inline feedback because a global Toaster is not currently mounted. Failed verification preserves Admin-entered corrections. Technical extraction status/method/parser/extractor/diagnostic information remains collapsed secondary support context rather than main verification authority.
- **Validation provenance:** coding-agent report for UIUX-2I recorded frontend `npx tsc --noEmit` **PASS**, scoped ESLint **PASS**, and production compilation/TypeScript **PASS** before overall `npm run build` **FAILED** at the pre-existing unrelated `/login` `useSearchParams()`/Suspense prerender issue. FIX-1 separately reported TypeScript and targeted ESLint **PASS**; full build was intentionally not rerun for the one-line wording change. No frontend unit harness was available and runtime/browser QA was **NOT EXECUTED** in the agent environment. Source verification must not be represented as live end-to-end validation.
- **Reusable design guidance:** use master-detail composition when an Admin must inspect evidence and confirm authoritative values; distinguish provisional/current data from confirmed authoritative data; keep machine extraction assistive; place technical diagnostics behind disclosure; use consequence-aware confirmation copy for high-impact transitions; and prefer natural workflow terminology over internal lifecycle verbs such as “promote.” Do not copy COR enrollment-transition, identity, document, or extraction authority into unrelated review workflows.

**UIUX-2I is the eleventh Approved Reference Implementation.** UIUX-3A Panelist Dashboard and UIUX-3D navigation consolidation remain separately documented pending checkpoints, not additional approved references.

Existing legacy pages remain non-authoritative unless explicitly added to this registry.

---

# 30A. Implementation checkpoints awaiting UI/UX acceptance

## UIUX-3A — Panelist Dashboard and Adviser Availability (IMPLEMENTED; NOT ACCEPTED)

- **Branch:** `refactor/system-ui-ux`
- **Implementation commit:** `990210051756cf2713fcedc61ad9cdfd0555ea08` (parent `51e4c2448278d96a40b8a7b8fc041e326fe9bfec`).
- **Review status:** implementation pushed and source reviewed; manual runtime/visual acceptance is **pending**. The Dashboard is **not** an Approved Reference Implementation; UIUX-3B My Defenses is independently accepted as the eighth reference.
- **Primary screens:** `frontend/src/app/(portal)/panelist/dashboard/page.tsx` and `frontend/src/app/(portal)/panelist/profile/page.tsx`.

Implementation checkpoint (as of `9902100`):

- Dashboard uses the shared PageHeader, two operational KPIs (**Upcoming Defenses**, **Pending Tasks**), an action-only **Needs Your Attention** list (five initially, expandable), conditional **Active Defense**, **Upcoming Defense Sessions** (earliest valid future **Next Defense** plus up to three compact future sessions), a separate **Waiting on Others** read-only list, and **Recent Notifications** sourced from notification records, not an audit log.
- The new PANELIST-only `GET /thesis/defense/panelist/dashboard` aggregates authenticated-user assignments, own RAP signature slots, Adviser Requests, and Proposal/Final Adviser Review queues. `panelist-dashboard.rules.ts` projects and orders tasks and waiting states; no new academic mutation, state transition, or signer authority is introduced. Dashboard presentation must continue to defer to canonical defense/evaluator/RAP/adviser policy.
- Actionable responsibilities include authorized Proposal/Final evaluator work, eligible Chairman conclusion, Rapporteur minutes, Title Chairman start at the scheduled time, own required RAP signing, unanswered Adviser Requests, and eligible active-Adviser manuscript reviews. Waiting for Dean approval, student revisions, other signatories, or legitimate Chairman prerequisites remains informational and excluded from the Pending Tasks count.
- Adviser Availability moved from Dashboard to a narrowly scoped Profile card, using existing profile/availability endpoints and retaining external-panelist restrictions.
- Initial loading uses structural Dashboard Skeletons; notifications have section loading/error states; errors offer Retry and routine refetch retains loaded data.

**Pending UIUX-3A FIX-1 (agreed visual correction; NOT YET IMPLEMENTED):**

- The current standalone `Waiting on Others` full-sized Dashboard card creates avoidable visual repetition. Move the read-only waiting preview into **Needs Your Attention** as a **compact, collapsible subsection**, with an independent waiting count and clear separation from actionable tasks.
- Hide the subsection when there are no waiting items. Preserve legitimate waiting information, authorization, task priority, Pending Tasks calculation, and the existing loading behavior. No backend workflow modification is authorized by this visual correction.
- Re-review layout, responsive behavior, focus/keyboard accessibility, loading/empty/error states, and waiting/task semantics in a real browser after FIX-1.

**Verification and remaining limits:** The coding-agent report for `9902100` states backend build and unit tests passed (1,074 pass / 5 skipped), frontend TypeScript/scoped lint passed, and frontend build reached the known unrelated `/login` `useSearchParams()` prerender/Suspense failure. Frontend unit tests have no harness; manual browser QA was **not executed** in that report. Backend task-capability projection currently duplicates some workspace capability logic, presenting drift risk; pre-existing Proposal/Final Rapporteur finalization capability mismatch in the Defense Workspace also remains. These are tracked limitations, not accepted behavior or permission to expand UIUX-3A.

**Acceptance gate:** The project owner must inspect the final UIUX-3A/FIX-1 runtime and explicitly accept it before this screen can be promoted into the approved-reference registry. Do not promote the Panelist Dashboard into the accepted registry until its own FIX-1 and manual acceptance are complete; the eleven currently accepted references (including UIUX-4A Student Dashboard, UIUX-2H Admin Entrance Exam Schedules, and UIUX-2I Admin COR Verification) remain independent.

---

## UIUX-3D — Panelist Navigation Consolidation (IMPLEMENTED; MANUAL QA PENDING)

- **Branch / implementation commit:** `refactor/system-ui-ux` at `7f78f4df9d1a5dc613f38a80307b0fc275ac73cb` (parent `6bd4065eb24bcafb1a7db1b20d20e7595871eebd`).
- **Scope:** only `frontend/src/app/(portal)/panelist/layout.tsx`, `materials/page.tsx`, and `scoring/page.tsx` changed. This is a navigation cleanup **on top of accepted UIUX-3B**, not a separate Approved Reference Implementation or UIUX-3C Defense Workspace redesign. UIUX-4A Student Dashboard remains the ninth reference, UIUX-2H Admin Entrance Exam Schedules is the tenth, and UIUX-2I Admin COR Verification is independently accepted as the eleventh.
- **New navigation:** **My Defenses** is the sole sidebar entry for a panelist's assigned defense sessions. Redundant **Materials** and **Defense Workspaces** links and unused icons are removed; Dashboard, Profile, Adviser Requests, Adviser Reviews, E-Signatures, Repository, Announcements, and Notifications remain.
- **Index compatibility:** `/panelist/materials` and `/panelist/scoring` are minimal Next.js server-component redirects to `/panelist/defenses`, without fetching assignments or enumerating `thesisDocuments`. Direct existing `/panelist/scoring/[id]` and `/panelist/defense-lobby/[scheduleId]` legacy links still redirect to `/panelist/defense-workspace/[scheduleId]`, preserving the selected schedule.
- **Active navigation:** the **My Defenses** sidebar item is active for the My Defenses index, canonical Defense Workspace, and retained legacy defense route families; route matching respects exact paths or a slash-delimited descendant to avoid matching unrelated portal pages.
- **Preserved authority:** the existing canonical Defense Workspace is **not** deleted or redirected, and evaluation/scoring, Chairman conclusion, Rapporteur minutes, signatures, and role-specific controls are unchanged. Accepted **View Manuscript** still resolves the selected defense's authorized stage/certified manuscript through the existing Defense Workspace read model and authenticated document viewer; no new COR/receipt or non-authoritative document listing is introduced. My Defenses cards, filters, paging, schedule, and meeting labels are unchanged.
- **Verified:** independent GitHub review confirmed branch HEAD, parent, and exact three-file diff; removed navigation entries and server redirects are present; canonical workspace and two legacy nested redirect pages are unchanged in the reviewed source.
- **Agent-reported checks:** frontend `npx tsc --noEmit` PASS; targeted ESLint on three changed files PASS; frontend production build compiled and type-checked, but total build remains **FAIL** at the known unrelated `/login` `useSearchParams()`/Suspense prerender issue. These checks were reported by the coding agent, **not rerun** during source review.
- **Pending acceptance gate:** live browser verification of old-index redirects, selected-workspace navigation, active sidebar state, mobile/collapsed sidebar, keyboard/focus, and authorized manuscript access is **NOT EXECUTED** in the coding-agent report. Do not label UIUX-3D as manually accepted until the project owner confirms this review; documentation of implementation does not certify end-to-end behavior.
- **Deferred cleanup:** `stageManuscriptDocType` remains unused in `frontend/src/lib/panelist-defenses.ts` after retiring Materials; remove only under a separately authorized cleanup. UIUX-3A Dashboard FIX-1 and UIUX-3C Defense Workspace refinement remain separate, pending packages.

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
