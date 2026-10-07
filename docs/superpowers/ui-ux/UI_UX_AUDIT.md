# UI/UX Current-State Audit

**Project:** EARIST Graduate School Information System  
**Audit baseline:** workflow/cor-extraction-autofill at 046504f8dc82626d249900cfaa9a9848a1a9d7b2  
**UI/UX branch:** refactor/system-ui-ux  
**Status:** INITIAL AUDIT / LIVING DOCUMENT  
**Companion authority:** docs/superpowers/ui-ux/SYSTEM_UI_UX_PLAYBOOK.md

---

## 1. Purpose

This document records the current UI/UX condition of the system and identifies improvement opportunities before page-by-page refinement begins.

This is not a visual redesign specification and it is not a fixed implementation roadmap. It is a living audit that provides a backlog of observable usability, information-architecture, consistency, accessibility, and interaction problems.

The system will be refined iteratively. Findings in this document may be re-prioritized, split, resolved, or expanded as real screens are reviewed and manually tested.

The audit must never be used to override accepted business rules, workflow authority, academic policy, security rules, or canonical source-of-truth documents.

---

## 2. Audit principles

The UI/UX phase is broader than styling.

The audit evaluates:

1. information architecture;
2. navigation and wayfinding;
3. page hierarchy;
4. workflow comprehension;
5. visual hierarchy;
6. interaction consistency;
7. feedback and system-state communication;
8. forms;
9. tables and list views;
10. detail screens;
11. responsive behavior;
12. accessibility;
13. reusable component coverage;
14. design-token and visual-language consistency;
15. content clarity and terminology consistency.

The audit does not assume that every finding requires code. Some findings may be solved through composition, shared components, wording, layout, or better use of existing data.

---

## 3. Authority boundaries

UI/UX findings do not authorize workflow changes.

For any proposed improvement, classify the required work before implementation:

### A. Presentation-only

Examples:

- spacing;
- typography;
- breadcrumbs;
- page headers;
- cards/surfaces;
- responsive layout;
- icon placement;
- status presentation;
- loading skeletons;
- empty states.

Normally frontend-only.

### B. Information-surfacing

The UI needs authoritative information that already exists in the system but is not currently exposed to the screen.

Examples:

- a workflow state;
- an existing timestamp;
- an assigned role/person;
- an existing block reason;
- a related-record summary.

A bounded backend read-model, query, or response change may be allowed when explicitly scoped and tested.

### C. Functional / authority change

Examples:

- changing a state transition;
- weakening an eligibility gate;
- changing who may perform an action;
- changing academic-result authority;
- changing authentication behavior;
- inventing a new domain state or institutional rule.

This is not ordinary UI/UX work. Stop and create a separate bounded functional package governed by the applicable canonical domain documentation.

---

## 4. Current frontend foundation

The audited frontend already has a capable implementation stack:

- Next.js App Router;
- React;
- TypeScript;
- Tailwind CSS;
- shadcn;
- Base UI;
- Lucide React;
- TanStack Query;
- NextAuth;
- Sonner;
- tw-animate-css;
- existing EARIST CSS design tokens.

This means the primary problem is not lack of a component framework. The main opportunity is to make the system use its existing tools consistently.

### Current reusable UI primitives observed

frontend/src/components/ui currently includes:

- alert;
- badge;
- button;
- card;
- dialog;
- document-viewer;
- input;
- label;
- pagination;
- select;
- separator;
- sonner;
- switch;
- tabs;
- textarea.

The system therefore has core controls but does not yet have a complete shared application-shell and workflow-oriented design layer.

---

## 5. Portal and route inventory

The system has four major authenticated portal surfaces:

- Admin;
- Applicant;
- Student;
- Panelist.

Each portal has a dedicated layout implementation.

The Admin area contains multiple nested management domains including:

- users;
- entrance examination;
- COR and waiver validation;
- thesis applications;
- scheduling and panels;
- defense records;
- RAP reports;
- adviser-request review;
- analytics;
- settings;
- repository;
- notifications and memos.

The Student area contains a workflow-oriented Thesis Journey and nested repository submission flows.

The Panelist area contains defense lobby/workspace, scoring, adviser requests/reviews, signatures, materials, repository, profile, and notifications.

Several routes are deeply nested. Representative examples include:

- frontend/src/app/(portal)/admin/thesis/defense-records/[scheduleId]/page.tsx
- frontend/src/app/(portal)/admin/thesis/defense-records/[scheduleId]/summary/page.tsx
- frontend/src/app/(portal)/admin/thesis/defense-records/[scheduleId]/criteria/[panelAssignmentId]/page.tsx
- frontend/src/app/(portal)/admin/users/applicants/[id]/page.tsx
- frontend/src/app/(portal)/admin/users/students/[id]/page.tsx
- frontend/src/app/(portal)/student/repository/submit/page.tsx
- frontend/src/app/(portal)/panelist/defense-lobby/[scheduleId]/page.tsx
- frontend/src/app/(portal)/panelist/defense-workspace/[scheduleId]/page.tsx
- frontend/src/app/(portal)/panelist/scoring/[id]/page.tsx

These routes create a strong need for consistent wayfinding.

---

## 6. Priority scale

### P0 — workflow/safety usability

A UX issue that can cause the user to misunderstand authority, state, destructive consequences, or the valid next action.

### P1 — major usability / consistency

A recurring system-level issue that materially affects navigation, comprehension, efficiency, or visual consistency.

### P2 — refinement

A meaningful polish issue that should be addressed after shared foundations exist.

### P3 — optional / future

Useful but not currently necessary for the core product experience.

Priority does not automatically define implementation order. Dependencies and bounded package scope still control execution.

---

# 7. Findings

## UX-IA-01 — No shared breadcrumb system for nested routes
**Status:** PARTIALLY ADDRESSED — UIUX-2B introduced and accepted the shared `Breadcrumb` on the Admin Applicant Profile at `74a836886727ec5f808819566235400da5e0c95b`; broader nested-route adoption remains page-by-page.

**Priority:** P1  
**Area:** Navigation / information architecture  
**Observed state:** A shared breadcrumb component now exists and has an accepted list → person-detail reference, but nested location context is not yet consistently represented across the rest of the system.

Some pages still use only local Back links. This helps return navigation but does not provide a consistent hierarchy model.

### Risk

Users may know the page title but not:

- which module owns the page;
- which parent record they came from;
- how deep they are in the workflow;
- how to return to an intermediate level.

### Recommendation

Create a shared breadcrumb pattern for nested portal pages.

Rules belong in the UI/UX playbook. Breadcrumbs must follow actual information hierarchy and must not invent domain relationships.

Top-level dashboard pages normally do not need breadcrumbs.

---

## UX-IA-02 — Portal shells are separately implemented and may drift
**Status:** PARTIALLY ADDRESSED — UIUX-1 established an accepted Admin shell baseline; Applicant/Student/Panelist shells remain iterative.

**Priority:** P1  
**Area:** Navigation / maintainability / consistency  
**Evidence paths:**

- frontend/src/app/(portal)/admin/layout.tsx
- frontend/src/app/(portal)/applicant/layout.tsx
- frontend/src/app/(portal)/student/layout.tsx
- frontend/src/app/(portal)/panelist/layout.tsx

The portal layouts repeat common concepts:

- fixed/collapsible sidebar;
- mobile overlay;
- portal branding;
- navigation rendering;
- sticky header;
- user/avatar area;
- sign-out;
- page-content wrapper;
- chatbot widget.

Role-specific navigation is valid, but duplicated shell structure can cause visual and behavioral drift.

### Recommendation

Audit for extraction of shared shell primitives without flattening role-specific behavior.

Potential primitives:

- PortalShell;
- PortalSidebar;
- PortalHeader;
- PageContainer;
- UserMenu;
- Breadcrumbs.

Do not force all roles into one navigation model when their behavior genuinely differs.

---

## UX-IA-03 — Navigation context is inconsistent across page types

**Priority:** P1  
**Area:** Wayfinding

The system currently mixes:

- sidebar active state;
- top-level portal title;
- page-local Back links;
- page titles;
- nested route context.

A single predictable hierarchy is not yet enforced.

### Recommendation

Every nested screen should answer:

- Where am I?
- What record/module am I inside?
- What is my parent location?
- What is this page for?

Use coordinated sidebar active state + breadcrumbs + page header instead of relying on only one cue.

---

## UX-IA-04 — Information architecture should be reviewed per role, not only per route

**Priority:** P1  
**Area:** Information architecture

A route can be technically organized but still be cognitively difficult if the role sees too many unrelated destinations or cannot distinguish workflow steps from reference pages.

### Recommendation

During refinement, review navigation grouping for each role:

- Admin: management domain grouping and operational priority;
- Applicant: admission progression and current next step;
- Student: academic journey vs supporting/reference destinations;
- Panelist: active assignments vs historical/reference destinations.

Do not change domain behavior merely to make navigation simpler.

---

## UX-PAGE-01 — No shared PageHeader pattern
**Status:** PARTIALLY ADDRESSED — shared `PageHeader` now exists and is accepted on the Admin Dashboard, Admin Applicants list, Admin Applicant Profile, and Admin Entrance Exam Records list; adoption remains page-by-page.

**Priority:** P1  
**Area:** Page hierarchy

No shared page-header primitive was found.

Pages can therefore independently decide:

- heading size;
- description placement;
- action placement;
- status placement;
- top spacing;
- Back-link placement.

### Recommendation

Create a shared PageHeader composition supporting:

- breadcrumb area above it;
- title;
- concise description/context;
- optional status/context metadata;
- primary and secondary page actions.

The component must be flexible enough for tables, forms, record details, and workflow screens.

---

## UX-PAGE-02 — Content width and density are not yet governed by page type

**Priority:** P1  
**Area:** Layout

Some pages use constrained widths such as max-w-3xl while management pages naturally need wide tables.

There is no documented rule deciding when content should be narrow, medium, or wide.

### Recommendation

Define width categories:

- narrow: focused form/reading flows;
- medium: record detail and workflow review;
- wide: tables, dashboards, dense administration.

The decision should follow task type, not individual developer preference.

---

## UX-PAGE-03 — Card use and surface treatment need standardization

**Priority:** P1  
**Area:** Visual hierarchy

The current stack makes Card easy to use, but a polished product should not wrap every block in a strong card.

Representative pages show different combinations of:

- Card;
- border-top accents;
- shadow-md;
- gray background sections;
- inline colored message boxes.

### Recommendation

Establish surface levels:

1. page background;
2. default content surface;
3. grouped card/section;
4. floating overlay/dialog.

Prefer borders and restrained shadows. Avoid nested-card visual noise.

---

## UX-PAGE-04 — Approved visual exemplars do not yet exist under a formal rule
**Status:** RESOLVED AS A FOUNDATION — the approved registry now includes the Admin Dashboard + restrained Admin shell at `89a233f3e7a6cea0ac49208a0a0726fe1ab634be`, the Admin Applicants list at `ac5b54e424c4fb8849262b2a2f64a45c95743a82`, the Admin Applicant Profile/detail at `74a836886727ec5f808819566235400da5e0c95b`, and the Admin Entrance Exam Records list at `9e03e0192e6131149c172a90e0ea6531017247b0`.

**Priority:** P1  
**Area:** Consistency / iteration

Existing pages may contain good patterns, but none should automatically become the visual authority for future work.

### Recommendation

After a page or shared pattern completes UI/UX review and is accepted, it may be explicitly designated as an Approved Reference Implementation.

Until then, existing pages are implementation evidence, not design authority.

---

## UX-WF-01 — Workflow comprehension needs to become a first-class UI concern

**Priority:** P0  
**Area:** Workflow UX

The system contains long, stateful academic workflows.

A user should not need to know backend terminology to determine:

- current stage;
- completed stages;
- blocked stages;
- reason for blocking;
- next valid action;
- responsible actor.

The Student Thesis Journey already contains state concepts such as COMPLETED, CURRENT, AVAILABLE, WAITING, and LOCKED. Similar clarity should be applied where appropriate without inventing a second progression model.

### Recommendation

Introduce shared workflow-oriented patterns where justified:

- WorkflowStepper / JourneyTimeline;
- CurrentStatus summary;
- NextActionPanel;
- BlockReason/RequirementList;
- responsible-role context.

These must be projections of authoritative backend/domain state.

---

## UX-WF-02 — Disabled actions should explain why

**Priority:** P0  
**Area:** Workflow feedback

A disabled button without context makes users guess whether the system is broken or whether a requirement is pending.

### Recommendation

For workflow-gated actions, pair disabled state with concise explanation derived from authoritative state when available.

Never remove a backend gate just to make the UI appear simpler.

---

## UX-WF-03 — Status meaning and color semantics need a system-wide taxonomy

**Priority:** P0  
**Area:** Status communication

The system has many meaningful states:

- PENDING;
- VERIFIED;
- REJECTED;
- PASSED;
- FAILED;
- FINALIZED;
- WAITING;
- LOCKED;
- CURRENT;
- AVAILABLE;
- DIFFERENT;
- N/A and others.

Without a shared semantic mapping, the same color can communicate different meanings and non-destructive differences can look like errors.

### Recommendation

Define semantic families in the playbook:

- success/completed;
- warning/waiting;
- neutral/inactive;
- informational/current/available;
- destructive/error/rejected/failed.

Domain-specific exceptions must be documented rather than improvised.

---

## UX-FBK-01 — Native browser confirmation/error patterns still appear in page logic

**Priority:** P1  
**Area:** Interaction consistency

Representative current page logic includes native confirm() and alert() behavior.

These controls work technically but do not match the rest of the application visual language and give limited control over copy, consequences, accessibility context, and pending state.

### Recommendation

Standardize:

- AlertDialog for critical/destructive confirmation;
- Dialog for non-destructive modal tasks;
- inline error surfaces for field/context errors;
- Sonner toast for transient operation feedback.

Native alert/confirm should not be the default application pattern.

---

## UX-FBK-02 — Sonner exists but system-wide toast integration is not clearly completed

**Priority:** P1  
**Area:** Feedback infrastructure  
**Evidence:**

- frontend/src/components/ui/sonner.tsx exists.
- No global Toaster mount was found in frontend/src/app/layout.tsx during the audit.

### Recommendation

Confirm intended theme/provider setup and wire one global application toaster when a bounded foundation package is approved.

Do not add duplicate toast systems.

---

## UX-FBK-03 — Loading states rely too often on plain text or local ad hoc markup
**Status:** PARTIALLY ADDRESSED — shared `Skeleton` and a structural dashboard loading composition are now accepted; legacy pages still require iterative remediation.

**Priority:** P1  
**Area:** Perceived performance / consistency

Representative pages display text such as loading messages without a shared skeleton pattern.

### Recommendation

Add reusable Skeleton and page-specific loading compositions.

Use:

- skeletons when the final layout is known;
- spinner/progress for action-specific waiting;
- plain text only where it is genuinely clearer.

Avoid fake progress percentages.

---

## UX-FBK-04 — Empty-state treatment is not standardized

**Priority:** P1  
**Area:** Feedback

Data-heavy systems frequently encounter:

- no records yet;
- no matching search result;
- no assigned work;
- no notifications;
- no completed records.

These situations are functionally different and should not all be represented by a blank table or generic “No data”.

### Recommendation

Create an EmptyState pattern with:

- restrained icon;
- clear title;
- concise explanation;
- optional relevant action.

Differentiate “nothing exists yet” from “filters returned no matches”.

---

## UX-FBK-05 — Error-state hierarchy should distinguish page, section, form, and action errors

**Priority:** P1  
**Area:** Feedback

Not every error should become a toast and not every error should replace the whole page.

### Recommendation

Define:

- page-load failure;
- section failure;
- form validation failure;
- mutation/action failure;
- permission/authorization failure.

Use the narrowest useful error surface.

---

## UX-FBK-06 — Async rendering and table layout instability can cause visible flicker

**Priority:** P1  
**Area:** Perceived performance / layout stability  
**Status:** SYSTEM-WIDE RULE DOCUMENTED — UIUX-1 established the first structural-skeleton exemplar, and UIUX-2A Admin Applicants is now the accepted record-list exemplar for stable table/filter/refetch behavior; legacy list/table pages remain iterative work.

Representative legacy patterns can visibly shift because:

- loading markup occupies far less space than the final table/content;
- loading, empty, and loaded states are not always cleanly separated;
- ordinary API data may be manually copied through effect/local-state flows;
- content-driven table widths may change after real values arrive;
- filters/pagination/refetch may temporarily collapse an established surface.

### Recommendation

Follow the playbook's layout-stability and state-ownership rules:

- distinguish initial loading, confirmed empty, error, and background refetch;
- use structural skeletons when final structure is known;
- keep stable table/header/tool/filter structure mounted when practical;
- preserve already-usable data during background refetch when safe;
- define intentional column behavior (fixed, bounded, flexible, wrap, or deliberate truncation);
- keep ordinary server state in the established query/cache layer when appropriate;
- derive computed values directly instead of synchronizing duplicate derived state through effects;
- use `useState` for genuine local interaction state and `useEffect` for real synchronization/side effects rather than treating either API as forbidden;
- manually check for loading -> empty -> loaded flashes, column-width jumps, overflow, and major layout shifts.

This is a quality rule, not a mandate to rewrite every existing page at once.

---

## UX-COMP-01 — High-value shared design primitives are missing
**Status:** PARTIALLY ADDRESSED — `PageHeader` and `Skeleton` were added and accepted in UIUX-1, and `Breadcrumb` was added and accepted in UIUX-2B; remaining primitives stay demand-driven.

**Priority:** P1  
**Area:** Design system

High-value candidates not currently present as reusable primitives include:

- PageHeader;
- AlertDialog;
- Tooltip;
- DropdownMenu;
- Skeleton;
- EmptyState;
- shared DataTable pattern;
- WorkflowStepper / Timeline;
- NextActionPanel.

These are not all required in one package.

### Recommendation

Add them when a real recurring need is approved. Do not install every possible shadcn primitive preemptively.

---

## UX-COMP-02 — Optional primitives should be demand-driven

**Priority:** P2  
**Area:** Dependency discipline

Potentially useful future primitives include:

- Sheet / Drawer;
- Popover;
- Command / Combobox;
- Accordion;
- ScrollArea;
- Checkbox;
- RadioGroup;
- Calendar / DatePicker.

### Recommendation

Do not add these merely because they are common in design systems.

Add them only when an accepted screen requirement benefits from them.

---

## UX-COMP-03 — Tables need a shared application-level pattern
**Status:** PARTIALLY ADDRESSED — UIUX-2A Admin Applicants and UIUX-2C Admin Entrance Exam Records now provide two accepted table/filter/list-page references at `ac5b54e424c4fb8849262b2a2f64a45c95743a82` and `9e03e0192e6131149c172a90e0ea6531017247b0`; a system-wide shared DataTable abstraction remains demand-driven.

**Priority:** P1  
**Area:** Admin efficiency

The system is record-heavy, especially in Admin.

A raw table component alone is not enough. Management pages may need consistent behavior for:

- search;
- filters;
- sort;
- pagination;
- row actions;
- status cells;
- empty state;
- loading state;
- responsive overflow;
- optional bulk selection.

### Recommendation

Define a shared DataTable pattern built from existing project components and established filters.

Do not force every list into a table. Cards may be more appropriate on mobile or for small heterogeneous records.

### Accepted UIUX-2A checkpoint — Admin Applicants list

The accepted Applicants list demonstrates the current record-management baseline:

- search + bounded Program and Admission Stage filters;
- readable long selector values without making the whole filter bar oversized;
- 14px form labels and primary operational row text, 12px table headers/secondary metadata;
- neutral primary row identity with restrained EARIST red reserved for deliberate emphasis/current state;
- structural table Skeletons and intentional column widths;
- stable refetch behavior without loading -> empty -> loaded flashes;
- query-specific failure handling that does not misrepresent stale rows from another filter as current results;
- explicit empty/no-results behavior;
- local horizontal table scrolling on constrained widths;
- a single dominant row action;
- human-readable workflow-state projection backed by authoritative server/read-model rules.

Applicant-specific admission stages and COR/Entrance Exam semantics remain domain-specific and must not be generalized into unrelated list pages.

### Accepted UIUX-2C checkpoint — Admin Entrance Exam Records list

The accepted Exam Records list adds a second operational-table precedent:

- user-facing **Exam Records** terminology replaces ambiguous **Applications** while the legacy technical route remains `/admin/exam/applications`;
- one row represents one entrance-exam record, not another Applicant profile;
- compact Search + exact Program-ID + Exam State filters lead directly into a five-column operational table: Applicant, Program, Exam Schedule, Exam State, Action;
- no KPI cards are required when they do not improve the record-monitoring task;
- persisted exam statuses are projected into human-readable list states without adding new persisted enums (`PENDING/APPROVED → Scheduled`, `TAKEN → Needs Essay Grading`, `PASSED → Passed`, `FAILED → Failed`, `APPEALED → Appeal Pending`, `DISQUALIFIED → Disqualified`);
- `APPEALED` is display-only on this accepted main page; the existing missed-exam appeal mutation semantics remain outside UIUX-2C;
- Score Management is intentionally still separate and transitional; showing **Needs Essay Grading** does not mean grading has already been migrated;
- structural Skeleton/error/empty/no-match states and one restrained View action preserve list stability and scope.

The exact entrance-exam state mapping is domain-specific and must not become a generic table convention.

---

## UX-COMP-04 — Searchable selectors may be needed for large data sets

**Priority:** P2  
**Area:** Forms / selection

Ordinary Select works for small lists but becomes inefficient for large lists such as programs, users, or records.

### Recommendation

When a real screen proves the need, introduce an accessible searchable Combobox pattern using existing stack-compatible primitives.

Do not add fuzzy matching where business authority requires exact selection.

---

## UX-FORM-01 — Form presentation needs a shared structure

**Priority:** P1  
**Area:** Forms

The system should not rely on every page independently deciding how to place:

- label;
- required/optional marker;
- helper text;
- input;
- validation error;
- dependent-field explanation.

### Recommendation

Define a consistent FormField composition even if the system does not adopt a new form library.

---

## UX-FORM-02 — Required, optional, read-only, and authoritative values must be visually distinct

**Priority:** P0  
**Area:** Forms / authority communication

Academic and administrative screens often combine:

- editable user input;
- system-derived values;
- official authoritative values;
- read-only historical values.

### Recommendation

The UI must visually communicate which values can be edited and where a value comes from when authority matters.

Do not present system-derived authority as an editable text box merely for layout consistency.

---

## UX-FORM-03 — Submission states should prevent duplicate actions

**Priority:** P0  
**Area:** Forms / mutation safety

Buttons that trigger mutations should expose pending state and prevent accidental repeated submission when appropriate.

### Recommendation

Standardize pending labels, disabled behavior, and mutation completion feedback.

---

## UX-TBL-01 — Filter/search state should be visible and reversible

**Priority:** P1  
**Area:** Tables / lists

When a user filters a record-heavy page, they should be able to understand that the list is filtered and clear the filter predictably.

### Recommendation

Standardize:

- filter placement;
- active-filter indicators;
- clear/reset behavior;
- no-results state.

Continue to reuse the established shared DataTableFilter where applicable rather than creating incompatible one-off filters.

---

## UX-DTL-01 — Record-detail pages need a consistent information hierarchy
**Status:** PARTIALLY ADDRESSED — UIUX-2B Admin Applicant Profile is the accepted person-centric record-detail exemplar at `74a836886727ec5f808819566235400da5e0c95b`; other detail domains remain iterative.

**Priority:** P1  
**Area:** Detail screens

Representative entities include:

- Applicant;
- Student;
- Defense record;
- COR;
- Adviser Request;
- Panel assignment/evaluation.

### Recommendation

A typical detail page should prioritize:

1. identity / record title;
2. current authoritative status;
3. primary valid action;
4. key metadata;
5. workflow/requirements;
6. supporting detail;
7. history/audit material only when the source accurately represents the history being claimed.

Exact ordering can vary by task. Do not add a generic timeline merely because audit rows exist; incomplete or entity-scoped audit data must not be presented as a complete record lifecycle.

---

## UX-DTL-02 — Important status/action information should not be buried in long card stacks
**Status:** PARTIALLY ADDRESSED — UIUX-2B replaced the legacy equal-weight Applicant Profile card stack with a Current Admission State summary, one grouped Admission Journey, and one compact Applicant Details surface.

**Priority:** P1  
**Area:** Detail screens

Large detail pages can become visually repetitive when every domain section is another full card.

### Recommendation

Consider a summary/header area followed by clearly separated sections. Use cards only where grouping materially helps comprehension.

---

## UX-RWD-01 — Responsive behavior should be task-specific
**Status:** PARTIALLY ADDRESSED — UIUX-1 improved Admin shell/mobile behavior and Dashboard narrow-layout handling; every future package still requires target-specific review.

**Priority:** P1  
**Area:** Responsive design

The portal shells already include mobile sidebar behavior, which is a useful foundation.

However responsiveness should also cover:

- long tables;
- filter bars;
- page-header actions;
- breadcrumbs;
- dialogs;
- forms;
- workflow timelines;
- touch-target sizes.

### Recommendation

Every accepted UI package should include desktop and narrow/mobile visual checks for the changed screen.

Responsive success is not merely “nothing overflows”.

---

## UX-A11Y-01 — Tooltip/focus support is needed for icon-only and collapsed navigation states
**Status:** PARTIALLY ADDRESSED — UIUX-1 added accessible names, focus-visible treatment, aria-current/expanded semantics, and stronger Admin sidebar states; broader portal coverage remains iterative.

**Priority:** P1  
**Area:** Accessibility

The Student journey already recognizes the need to explain status icons.

Collapsed sidebars and icon-only controls need similarly accessible names and explanations.

### Recommendation

Use:

- visible label where space permits;
- aria-label/title only as fallback;
- accessible Tooltip for contextual explanation;
- keyboard-accessible focus state.

---

## UX-A11Y-02 — Color must not be the only status indicator

**Priority:** P0  
**Area:** Accessibility / state communication

Workflow state is too important to encode only as red/yellow/green.

### Recommendation

Pair color with one or more of:

- text;
- icon;
- label;
- explicit status wording.

---

## UX-A11Y-03 — Focus and keyboard interaction need package-level review

**Priority:** P1  
**Area:** Accessibility

Interactive components should remain usable without a mouse.

### Recommendation

For changed interaction-heavy screens, manually verify:

- logical tab order;
- visible focus;
- keyboard activation;
- dialog focus containment/return;
- no inaccessible disabled pseudo-links.

---

## UX-VIS-01 — Typography currently lacks a documented application hierarchy
**Status:** RESOLVED AS A FOUNDATION — the canonical application type scale is documented in the playbook and was validated on both the Admin Dashboard and UIUX-2A Admin Applicants. The accepted operational baseline keeps primary reading/form/table-row text at 14px, compact table headers and genuinely secondary metadata at 12px, and uses deliberate responsive breakpoints while preserving browser/accessibility zoom.

**Priority:** P1  
**Area:** Visual language

Current global styles use Calibri/Segoe UI fallbacks and apply brand colors to headings.

The system has no documented scale for:

- page title;
- section title;
- card title;
- body;
- supporting text;
- label;
- table metadata.

### Recommendation

Define a compact, modern application hierarchy in the playbook.

Font-family changes should be evaluated deliberately rather than introduced piecemeal.

---

## UX-VIS-02 — EARIST brand color should be used with restraint

**Priority:** P1  
**Area:** Visual language

The current tokens already provide primary red, secondary red, gold accent, gray surface, border, success, and warning colors.

### Recommendation

Use neutral surfaces for the majority of the UI and reserve strong brand color for:

- primary navigation;
- primary action/emphasis;
- intentional highlights;
- selected/active states.

Avoid making every heading, icon, border, and button strongly branded simultaneously.

---

## UX-VIS-03 — Radius and elevation need consistent levels

**Priority:** P2  
**Area:** Visual language

The system uses rounded cards, inputs, dialogs, and shadows, but no formal surface/elevation scale is documented.

### Recommendation

Define a small number of radius/elevation conventions and reuse them.

Prefer subtle border-first treatment on ordinary content surfaces.

---

## UX-VIS-04 — Motion should remain restrained and purposeful

**Priority:** P2  
**Area:** Motion

The stack supports animation, but institutional systems benefit more from predictability than decorative motion.

### Recommendation

Use motion for:

- menu expansion;
- dialog/sheet transition;
- hover/focus state;
- loading indication;
- limited state transition.

Avoid ornamental page animations that delay task completion.

---

## UX-CONT-01 — Terminology needs a cross-screen consistency pass
**Status:** PARTIALLY ADDRESSED — UIUX-2C replaced the ambiguous Admin Exam Management label **Applications** with the task-oriented **Exam Records / Entrance Exam Records** while intentionally preserving the legacy technical route and backend model. Cross-screen terminology remains iterative.

**Priority:** P0  
**Area:** Content design

Domain terms must retain their accepted meaning.

Potential risk areas include alternate labels for the same concept, inconsistent capitalization, and wording that blurs workflow state with action authority.

### Recommendation

Before changing labels, verify terminology against:

- canonical source-of-truth;
- accepted specs;
- actual backend state meaning.

A prettier label is not valid if it changes domain meaning.

---

## UX-CONT-02 — Helper copy should explain consequence and next step, not internal implementation

**Priority:** P1  
**Area:** Content design

Users need operational guidance, not engineering internals.

### Recommendation

Prefer:

- what happened;
- why it matters;
- what the user can do next.

Avoid exposing implementation uncertainty, database terminology, raw API state, or developer-only concepts unless the page is explicitly administrative/diagnostic.

---

## UX-DESIGN-01 — External visual references must not become agent dependencies

**Priority:** P1  
**Area:** Process

The implementation agent may not have access to external/private visual reference repositories.

### Recommendation

Any useful visual qualities from external references must first be distilled into this repository's canonical UI/UX documentation by the reviewer/prompter.

The coding agent must implement from:

- repository code;
- canonical project docs;
- package prompt;
- explicitly approved internal reference implementations.

---

## UX-DESIGN-02 — Existing pages must not be treated as canonical visual references by default

**Priority:** P1  
**Area:** Process

Existing pages were created at different times and may contain legacy inconsistencies.

### Recommendation

Only pages/components explicitly listed as Approved Reference Implementations in the playbook may be used as visual precedent.

The approved registry now includes the Admin Dashboard + restrained Admin shell at `89a233f3e7a6cea0ac49208a0a0726fe1ab634be`, Admin Applicants list at `ac5b54e424c4fb8849262b2a2f64a45c95743a82`, Admin Applicant Profile/detail at `74a836886727ec5f808819566235400da5e0c95b`, and Admin Entrance Exam Records list at `9e03e0192e6131149c172a90e0ea6531017247b0`. Other legacy pages remain non-authoritative unless explicitly registered.

---

## UX-BE-01 — UI/UX work may require bounded backend read support

**Priority:** P1  
**Area:** Frontend/backend boundary

Some UX improvements may need existing authoritative data that is not exposed by the current API.

### Recommendation

Allow minimal, explicit read-model/API response additions when they:

- expose already-existing authoritative information;
- do not change workflow decisions;
- do not create new academic policy;
- include appropriate focused tests.

Any behavior/authority change is separate functional work.

---

## UX-QA-01 — Visual/manual QA must become part of UI acceptance

**Priority:** P1  
**Area:** Quality assurance

Typecheck and lint cannot prove that spacing, hierarchy, responsiveness, or user comprehension are correct.

### Recommendation

Every UI/UX package should report:

- code validation;
- desktop visual/manual check;
- narrow/mobile visual/manual check when applicable;
- important interaction checks;
- accessibility spot checks;
- workflow-state preservation.

If browser/manual execution is unavailable, report NOT EXECUTABLE rather than claiming PASS.

---

# 8. Design-system primitive inventory

## Existing and usable

Prefer current project implementations where appropriate:

- Button
- Card
- Dialog
- Badge
- Breadcrumb
- Alert
- Input
- Label
- Select
- Tabs
- Switch
- Textarea
- Separator
- Pagination
- PageHeader
- Skeleton
- Sonner
- Lucide icons
- Tailwind utilities and current CSS variables

## High-value additions

Add only through bounded packages where justified:

- AlertDialog
- Tooltip
- DropdownMenu
- EmptyState
- DataTable composition/pattern
- WorkflowStepper / Timeline
- NextActionPanel
- global Toast/Toaster wiring

## Demand-driven additions

Do not pre-install without an approved use case:

- Sheet / Drawer
- Popover
- Command / Combobox
- Accordion / Collapsible
- ScrollArea
- Checkbox
- RadioGroup
- Calendar / DatePicker

---

# 9. Initial foundation opportunities

The audit suggests the following foundation areas are likely to provide high leverage, but they are not automatically the first implementation package:

1. shared page hierarchy: Breadcrumbs + PageHeader + PageContainer conventions;
2. feedback foundation: AlertDialog + global toast wiring + error/loading/empty rules;
3. reusable status semantics;
4. shared data-table/list composition;
5. workflow comprehension patterns;
6. portal-shell consistency;
7. typography/spacing/surface token refinement.

Each must still be broken into bounded implementation packages.

---

# 10. Approved Reference Implementations

**Current state: four formally designated references.**

## Admin Dashboard + restrained Admin shell

- Accepted commit: `89a233f3e7a6cea0ac49208a0a0726fe1ab634be`
- Pattern type: wide operational Admin dashboard + Admin portal-shell visual baseline.
- Reusable precedent:
  - PageHeader/page-identity hierarchy;
  - shell-owned spacing/gutters;
  - restrained surface/brand treatment;
  - structural loading skeleton and explicit empty/error behavior;
  - accessible sidebar state/focus/mobile treatment;
  - separation of Admin-owned actions from workflow monitoring.
- Page-specific; do not copy Dashboard KPIs, queue definitions, or workflow read-model semantics into unrelated pages.

## Admin Applicants list

- Accepted commit: `ac5b54e424c4fb8849262b2a2f64a45c95743a82`
- Pattern type: wide record-management/list page.
- Reusable precedent:
  - compact search/filter/pagination composition;
  - 14px operational text with 12px compact table headers/secondary metadata;
  - readable long authoritative selector values;
  - stable structural table loading and query-safe refresh/error behavior;
  - intentional columns, local horizontal overflow when needed, and one dominant row action;
  - human-readable workflow projection backed by authoritative server/read-model rules.
- Page-specific; do not generalize Applicant admission stages, Exam/COR semantics, or exact table schema.

## Admin Applicant Profile / detail

- Accepted commit: `74a836886727ec5f808819566235400da5e0c95b`
- Implementation chain:
  - `81333c29e7889eaf3c4b454fc2c0e57adffed69f` — initial detail refinement;
  - `74a836886727ec5f808819566235400da5e0c95b` — accepted density/read-model FIX.
- Pattern type: person-centric, cross-workflow record-detail page.
- Reusable precedent:
  - shared Breadcrumb for list → record wayfinding;
  - record name as PageHeader identity;
  - prominent but restrained authoritative current-state summary;
  - compact workflow progression plus a grouped journey/details surface;
  - one compact contextual metadata/academic-details surface rather than many equal-weight cards;
  - detail Skeleton/error/not-found states shaped like the final page;
  - bounded backend read-model support for already-authoritative data;
  - contextual links to owning operational modules instead of duplicated mutations.
- Information-architecture precedent:
  - profile/detail = longitudinal overview;
  - process-specific management modules = authoritative operational workspaces;
  - do not expose a generic “Activity History” unless the source represents a complete enough lifecycle for that label;
  - audit infrastructure remains separate from whether a profile chooses to render history.
- Page-specific; do not generalize Applicant Alignment/Exam/COR progression or academic-prerequisite semantics into unrelated records.

## Admin Entrance Exam Records list

- Accepted commit: `9e03e0192e6131149c172a90e0ea6531017247b0`
- Pattern type: wide entrance-exam operational record list.
- Reusable precedent:
  - task-oriented **Exam Records** terminology may replace a misleading legacy technical label without requiring a route/schema rename;
  - one process record per row with compact person identity rather than duplicating the full person/profile surface;
  - exact authoritative Program filtering + human-readable presentation-only state projection;
  - five-column operational table with no decorative KPI layer when the list itself answers the task;
  - structural query loading/error/empty/no-match treatment and one dominant row action.
- Domain/transition boundaries:
  - `PENDING/APPROVED → Scheduled`, `TAKEN → Needs Essay Grading`, `PASSED → Passed`, `FAILED → Failed`, `APPEALED → Appeal Pending`, and `DISQUALIFIED → Disqualified` are presentation mappings only;
  - Score Management remains a transitional separate workspace; grading/detail migration is not yet accepted;
  - appeal mutation semantics were not redesigned; the main list only exposes the `APPEALED` state safely;
  - COR Validation and Waiver Validation were not changed.
- Page-specific; do not generalize entrance-exam state semantics or transitional links into unrelated list domains.

See `SYSTEM_UI_UX_PLAYBOOK.md` for the canonical registry and detailed reuse/do-not-copy rules.

Additional pages or shared patterns may be added only after implementation, manual UI/UX review, workflow verification, and explicit acceptance.

---

# 11. Audit limitations

This document is an initial repository-based audit, not a claim that every screen has been visually inspected in a running browser.

Some findings are based on:

- current route structure;
- reusable-component inventory;
- portal layout implementations;
- representative current pages;
- known workflow structure.

During iterative implementation, manual browser review may reveal additional problems not visible from source inspection alone.

New findings should be added without turning the document into a mandatory all-at-once backlog.

---

# 12. Audit acceptance rule

A finding is not “fixed” merely because a component exists.

A finding is resolved only when the affected user experience is implemented, validated, and accepted in its real context.

Examples:

- adding a Breadcrumb component does not resolve wayfinding until nested pages use it correctly;
- adding Skeleton does not resolve loading UX until relevant screens use meaningful skeleton layouts;
- adding Tooltip does not resolve accessibility until icon-only interactions expose useful accessible context.

---

# 13. Next step

Use docs/superpowers/ui-ux/SYSTEM_UI_UX_PLAYBOOK.md as the canonical implementation guardrail.

Then select one bounded UI/UX iteration at a time from this audit.

Do not implement the entire audit as one package.
