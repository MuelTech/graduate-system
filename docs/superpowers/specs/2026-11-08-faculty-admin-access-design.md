# Faculty and Administrator Access — Design Specification

**Date:** 2026-11-08  
**Status:** APPROVED DESIGN TARGET — IMPLEMENTATION PENDING  
**Canonical authority:** `docs/superpowers/FACULTY_ADMIN_ACCESS_SOURCE_OF_TRUTH.md`  
**Copy authority:** `docs/superpowers/USER_FACING_COPY_SOURCE_OF_TRUTH.md`  
**UI/UX authority:** `docs/superpowers/ui-ux/SYSTEM_UI_UX_PLAYBOOK.md`

---

## 1. Purpose

This specification translates the approved Faculty/Admin source of truth into user-visible feature behavior and information architecture.

It does not define the final database schema, migration implementation, exact permission-key catalog, or repository task decomposition. Those belong in the coding agent's repository-grounded implementation plan.

If this design conflicts with the canonical source of truth, the source of truth wins.

---

## 2. Target User Management information architecture

Target Admin navigation under User Management:

- Applicants
- Students
- Faculty
- Administrators

The user-facing `Panelists` account-management destination is replaced by `Faculty`.

The user-facing `Custom Roles` destination is retired from the target design.

Do not remove legacy routes/data blindly. Compatibility and migration are implementation-plan concerns.

---

## 3. Faculty Management — primary task

The primary Admin task is:

**Manage Faculty accounts, academic access, affiliation, and adviser availability without confusing account access with workflow assignments.**

Faculty Management should make it easy to understand:

1. who the Faculty member is;
2. whether the account is active;
3. whether the Faculty member is Internal or External;
4. whether Essay Evaluation is available to that Faculty member;
5. whether an Internal Faculty member is Available as Adviser;
6. which Adviser/Defense assignments already exist, as contextual summaries only.

### 3.1 Faculty list

The Faculty list should support a clear operational overview using concise information such as:

- Faculty name;
- Internal / External;
- account status;
- Essay Evaluation access summary when useful;
- Adviser availability when applicable.

Do not overload the list with all defense/adviser history.

### 3.2 Faculty detail

A Faculty detail surface should organize information into meaningful sections such as:

- Faculty Profile;
- Account Status;
- Faculty Access;
- Adviser Availability;
- Current / Relevant Assignments.

Exact layout is not frozen. Follow the UI/UX playbook and perform page-specific information-architecture review.

### 3.3 Faculty Access

Initial configured access:

- **Essay Evaluation**

Do not expose permanent controls for:

- Chairman;
- Panelist;
- Rapporteur;
- Facilitator;
- Adviser page access.

Those are assignment/workflow-derived.

### 3.4 Internal / External

The detail UI must make Internal/External status clear.

For Internal Faculty:

- Available as Adviser may be changed by an authorized Admin.

For External Faculty:

- Adviser availability is not applicable / unavailable;
- the UI must not present a valid control that could make the Faculty member an Adviser.

Visible wording must remain concise and governed by the Copy Source of Truth.

---

## 4. Adviser flow from Faculty Management

Faculty Management decides whether an Internal Faculty member is currently available to receive a new Adviser assignment.

It does not assign Students directly.

Expected flow:

```text
Faculty Management
  -> Internal Faculty
  -> Available as Adviser
  -> authoritative Adviser request/assignment workflow
  -> actual AdviserAssignment
  -> Faculty receives My Advisees functionality for assigned relationships
```

External Faculty must not appear as valid Adviser candidates.

Changing availability does not erase existing/historical Adviser assignments.

This design does not add an Adviser load cap.

---

## 5. Defense flow from Faculty Management

Faculty Management does not assign permanent defense roles.

Expected flow:

```text
Admin Defense Scheduling / Committee Assignment
  -> select permitted Faculty
  -> assign exact defense role
  -> save exact schedule assignment
  -> Faculty My Defenses reflects that assignment
```

Examples of contextual roles:

- Chairman;
- Panelist;
- Rapporteur;
- Facilitator;
- Adviser where the existing Defense workflow includes it.

The exact role authority remains schedule/assignment-specific.

Faculty detail may show assignment summaries, but those summaries must not become an alternate editor or source of defense authority.

---

## 6. Faculty portal

The Faculty portal keeps a Dashboard/Home as a consistent landing point, with a stable, zero-flicker sidebar and header experience.

### 6.1 Effective Faculty sidebar & navigation structure

- **Always visible for all Faculty (Internal & External):**
  - `Dashboard`
  - `Profile`
  - `My Defenses` *(always visible because any Faculty member may serve as a defense committee member)*
  - `E-Signatures`
  - `Repository`
  - `Announcements`
- **Conditional on Faculty account profile/permissions:**
  - `Essay Evaluations` — visible **only** when `Essay Evaluation` (`canEvaluateEssays`) is enabled for that specific Faculty user (e.g., Program Chair).
  - `My Advisees` — visible **only** for **Internal Faculty**. For External Faculty, `My Advisees` is hidden from the sidebar and dashboard because External Faculty cannot serve as Advisers.
- **Header-only utility navigation:**
  - `Notifications` is removed from the sidebar navigation list (in both Faculty and Admin portals) and is accessed via the top-header **Notification Bell** dropdown ("View All Notifications").

### 6.2 Dynamic navigation scenarios

**Internal Faculty (standard)**
- Dashboard, Profile, My Defenses, My Advisees, E-Signatures, Repository, Announcements

**Internal Faculty + Essay Evaluator (e.g. Program Chair)**
- Dashboard, Profile, Essay Evaluations, My Defenses, My Advisees, E-Signatures, Repository, Announcements

**External Faculty (standard)**
- Dashboard, Profile, My Defenses, E-Signatures, Repository, Announcements

**External Faculty + Essay Evaluator**
- Dashboard, Profile, Essay Evaluations, My Defenses, E-Signatures, Repository, Announcements

### 6.3 Dynamic dashboard & UI/UX stability

Dashboard content preserves the clean EARIST visual design (KPI summary cards, Needs Your Attention, Active/Upcoming Defenses, Waiting on Others, Recent Notifications) and conditionally includes **Pending Essay Evaluations** when `Essay Evaluation` access is enabled for that Faculty account.

Access state must be cached cleanly without resetting to `null` or flashing full-page skeletons when switching tabs or routes. The dashboard is not authorization; APIs independently enforce authority.

---

## 7. Essay Evaluation

Multiple-choice scoring is automated by the system.

Faculty Essay Evaluation is the manual academic responsibility for the essay portion.

Expected Faculty task flow:

```text
Faculty signs in
  -> Essay Evaluations
  -> sees only authorized/relevant essay work
  -> opens essay submission
  -> reviews answer and accepted evaluation criteria
  -> records allowed score/remarks
  -> saves/submits according to existing Exam workflow
```

Do not create a manual multiple-choice checking workflow.

Do not let Faculty arbitrarily modify system-computed MCQ scores.

Exact scoring/rubric semantics remain governed by the current accepted Exam workflow and repository behavior unless a separate approved change says otherwise.

---

## 8. Administrators Management — primary task

The primary Full Administrator task is:

**Manage Admin accounts and grant only the administrative access each Admin needs.**

Administrators Management is a dedicated destination under User Management.

### 8.1 Administrators list

Useful information includes:

- name;
- account status;
- access level;
- concise access summary.

Approved access-level terms:

- Full Administrator
- Restricted Administrator

These are not separate conceptual system roles.

### 8.2 Administrator detail

The detail surface should provide:

- profile/account status;
- access level;
- administrative capability editor where authorized;
- concise summary of granted access.

Do not expose raw internal permission keys as the ordinary user-facing labels.

---

## 9. Full Administrator

Full Administrator has the complete approved administrative capability set and can manage Administrator access.

Expected UI behavior:

- can open Administrators Management;
- can create/manage Admin accounts according to implementation policy;
- can grant/revoke Restricted Administrator capabilities;
- can manage high-privilege administrative access;
- sees all approved administrative modules.

The UI must preserve the rule that at least one active Full Administrator remains.

The UI must not imply that Full Administrator can perform Faculty-only academic actions or bypass assignment-based Defense/Adviser authority.

---

## 10. Restricted Administrator

Restricted Administrator sees only granted administrative work areas.

Example allowed set:

- Applicants;
- Students;
- COR Verification;
- Exam Scheduling.

Example denied set:

- Faculty Management;
- Curriculum Management;
- System Settings;
- Administrator access management.

The navigation should omit inaccessible destinations rather than exposing a long list of dead-end "Access denied" links.

Direct route/API attempts must still be denied server-side.

---

## 11. Administrator access editor & UI/UX standards

The access editor is organized into **4 clean Module Cards** matching the Admin sidebar groups:

1. **User Management:** `applicants.manage` (Applicants), `students.manage` (Students), `faculty.manage` (Faculty) *(Administrators Management is reserved exclusively for Full Administrators)*
2. **Exam Management:** `exam.schedules.manage` (Exam Schedules), `exam.records.manage` (Exam Records), `exam.questions.manage` (Exam Questions), `cor.verify` (COR Verification), `waivers.manage` (Waiver Validation)
3. **Thesis Management:** `defense.applications.manage` (Defense Applications), `defense.schedules.manage` (Scheduling & Panels), `defense.records.view` (Defense Records), `adviser.requests.manage` (Adviser Request Review)
4. **Institutional & System:** `analytics.view` (Analytics & Reports), `memos.manage` (Announcements & Memos), `repository.manage` (Repository & Databank), `settings.manage` (System Settings & Storage Health)

### 11.1 UI/UX Visual Standard (Faculty Management & Administrators Management)

Both `Faculty Management` and `Administrators Management` must follow the established, clean EARIST visual design:
- **Summary KPI Cards** at the top of the page (e.g., Active, Internal, External, Essay Evaluators, Available as Adviser for Faculty; Total, Active, Full Administrators, Restricted Administrators for Administrators).
- **Search and Filter Bar** inside a clean card.
- **Semantic Colored Badges** (`bg-blue-100 text-blue-700` for Internal/Restricted, `bg-purple-100 text-purple-700` for External/Full Admin, `bg-green-100 text-green-700` for Active/Enabled, `bg-gray-100 text-gray-500` for Inactive/Disabled).
- **Clean Action Icon Buttons** (`Eye` for View, `Edit` for Edit, `Power` for Activate/Deactivate) in the table row.
- **Default Password Info Banner:** Inside the Create Faculty and Create Administrator modals, display the amber informational banner stating that the default password is the user's **LAST NAME in ALL CAPS** and that they will be required to change it upon first login.

---

## 12. Login

Retain one role selector on the login page.

Target choices:

- Applicant
- Student
- Faculty
- Administrator

Do not add a second post-login workspace chooser.

Faculty credentials enter the Faculty portal.

Admin credentials enter the Admin portal.

The target design does not require a combined Faculty + Admin account/session.

---

## 13. Custom Roles retirement behavior

The target UI does not require a user-facing Custom Roles page.

Instead:

- Faculty access is configured directly for the Faculty account where appropriate;
- Admin capabilities are configured directly for the Admin account;
- Adviser/Defense work remains assignment-derived.

The implementation plan must determine how legacy Custom Role users/data are migrated and whether existing backend permission machinery is reusable.

Do not delete legacy data merely to simplify the UI.

---

## 14. User-facing copy constraints

Do not invent alternate terminology when the canonical term is already approved.

Approved terms for this feature include:

- Faculty
- Administrators
- Full Administrator
- Restricted Administrator
- Essay Evaluations
- My Advisees
- My Defenses
- Internal
- External
- Available as Adviser

The coding agent must read and follow `USER_FACING_COPY_SOURCE_OF_TRUTH.md`.

Avoid implementation-oriented labels such as:

- permission key names;
- raw enum values;
- route names;
- model names;
- `PANELIST` when the screen means the broad Faculty account identity;
- "Super Admin" as the ordinary approved label.

Use **Panelist** only when the user is looking at an actual defense assignment/role.

---

## 15. Empty and blocked states

Empty states should reflect the user's actual work.

Examples of intended behavior:

- Essay Evaluator with no pending essays: concise no-work state for Essay Evaluations;
- Faculty with no defense assignments: do not show an irrelevant My Defenses card merely to report zero;
- External Faculty adviser configuration: make the policy unavailable/not applicable rather than presenting a selectable invalid option;
- Restricted Administrator: do not show inaccessible modules as ordinary available destinations.

Exact wording must follow the Copy Source of Truth.

---

## 16. Authorization/UI relationship

Every relevant UI decision must have a corresponding backend authority check.

```text
Effective access / assignment
  -> frontend navigation and controls
  -> backend API authorization
```

Frontend hiding is not security.

Examples:

- Essay Evaluation APIs verify configured Faculty authority;
- Adviser APIs verify exact Adviser relationship/authority;
- Defense APIs verify exact schedule assignment and role;
- Admin APIs verify granted administrative capabilities;
- Administrator-access APIs verify Full Administrator/high-privilege management authority.

---

## 17. Required acceptance scenarios

### Scenario A — Essay Evaluator only

Given:
- active Faculty;
- Essay Evaluation enabled;
- no Adviser assignment;
- no defense assignment.

Then:
- Dashboard is available;
- Essay Evaluations is available;
- My Advisees is not shown as active work;
- My Defenses is not shown as active work;
- Adviser/Defense APIs remain denied without assignment.

### Scenario B — Internal Faculty available as Adviser

Given:
- Internal Faculty;
- Available as Adviser;
- no current Adviser assignment.

Then:
- Faculty may be selected by the authoritative Adviser workflow;
- no arbitrary Student Adviser authority exists yet;
- External-only restriction is not triggered.

### Scenario C — External Faculty / External Panelist

Given:
- External Faculty;
- permitted defense assignment.

Then:
- My Defenses reflects the assignment;
- Faculty may perform only the permitted defense functions for that exact assignment;
- Faculty cannot be selected/assigned as Adviser;
- Adviser availability cannot be enabled.

### Scenario D — Assigned Adviser

Given:
- Internal Faculty;
- authoritative Adviser assignment.

Then:
- My Advisees becomes relevant;
- Adviser authority is limited to accepted workflow scope and exact assigned relationship.

### Scenario E — Faculty with multiple responsibilities

Given:
- Essay Evaluation access;
- Adviser assignment;
- defense assignment.

Then:
- Dashboard summarizes all relevant work;
- navigation includes Essay Evaluations, My Advisees, My Defenses;
- no Admin navigation is added.

### Scenario F — Restricted Administrator

Given:
- Admin account;
- selected administrative capabilities only.

Then:
- only granted Admin destinations/actions are shown;
- direct unauthorized APIs/routes are denied;
- self-elevation is impossible.

### Scenario G — Full Administrator

Given:
- Admin account with Full Administrator authority.

Then:
- all approved Admin modules are available;
- Administrator access management is available;
- the last active Full Administrator cannot be removed/demoted into a state that leaves none;
- no Faculty/Defense academic authority is fabricated.

### Scenario H — Legacy migration

Given:
- existing broad Panelist account/history.

Then:
- the future Faculty identity preserves user/history relationships;
- historical defense role labels remain correct;
- no duplicate Faculty account is created solely for the rename;
- legacy Custom Role data is handled through explicit migration/compatibility logic.

---

## 18. Implementation and verification requirements

Implementation is structured into a 4-phase plan (`docs/superpowers/plans/2026-11-11-faculty-admin-access-implementation.md`) and executed continuously end-to-end without temporary compatibility bloat:

- **Phase 1:** Documentation alignment, Prisma schema update (`UserRole.FACULTY`, `Panelist.canEvaluateEssays`, `User.adminAccessLevel`, `User.adminCapabilities`), and synthetic seed data (`seed.ts`).
- **Phase 2:** Backend authentication, role & capability guards, Faculty Essay Evaluation endpoints, and Faculty/Administrators Management endpoints (preserving all 45+ existing Defense and Adviser endpoint contracts).
- **Phase 3:** Frontend Faculty portal (`Faculty Portal` branding, zero-flicker sidebar with `My Defenses` always visible, `My Advisees` visible for Internal Faculty only, `Essay Evaluations` visible when enabled, `Notifications` in header Bell icon only, read-only `Profile` adviser availability, and `Essay Evaluations` workspace).
- **Phase 4:** Frontend Admin portal (`Faculty Management` and `Administrators Management` with EARIST KPI cards, colored badges, action icons, and 4-card permission editor, plus dynamic Restricted Admin sidebar).

**Verification Policy:** Verify via TypeScript (`tsc --noEmit`), backend unit tests, and frontend production build. **Do not use automated Playwright tests**; UI/UX testing in the browser is performed directly by the project owner.

---

## 19. Non-goals of this design

This design does not:

- redesign Defense committee policy;
- create Program Chair as a new role;
- create Faculty+Admin combined credentials;
- create Adviser load limits;
- change exam MCQ scoring;
- redefine essay grading rules beyond access placement;
- change PASS/FAIL authority;
- change official-document/signature workflow;
- authorize Admin academic overrides;
- require immediate technical route/model renaming.

---

## 20. Design summary

Faculty and Admin remain separate role experiences.

**Faculty**
- dynamic academic portal;
- direct Essay Evaluation access where configured;
- Adviser work from actual Adviser assignments;
- Defense work from actual defense assignments;
- Internal/External policy preserved;
- External Faculty cannot be Advisers.

**Admin**
- dedicated administrative portal;
- Full Administrator or Restricted Administrator access level;
- direct per-Admin capability configuration;
- dedicated Administrators Management;
- no arbitrary Custom Roles required in the target UX.

The result should feel like one coherent GS-IS product while preserving strict domain authority and least-privilege behavior.
