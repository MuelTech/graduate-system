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

Essay Evaluation access is school-wide for the current entrance-exam essay workload. A Faculty member with this access may see and evaluate all pending eligible entrance-exam essays regardless of Program. No Faculty-to-Program evaluator assignment is required. Program may be shown as context or as a queue filter, but it is not an authorization boundary.

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

Admin may assign External Faculty to Chairman, Panelist, Rapporteur, or Facilitator for an exact Defense schedule. External Faculty must never be assigned as Adviser or receive student advisees. These are contextual Defense assignments, not permanent Faculty capabilities.

---

## 6. Faculty portal

The Faculty portal keeps a Dashboard/Home as a consistent landing point.

Its sections and navigation are dynamic from effective Faculty work.

### 6.1 Effective Faculty work sources

Configured:

- Essay Evaluation.

Assignment-driven:

- Adviser assignments;
- defense assignments.

### 6.2 Dynamic navigation scenarios

**Essay Evaluator only**

- Dashboard
- Essay Evaluations

**Assigned Adviser only**

- Dashboard
- My Advisees

**Defense participant only**

- Dashboard
- My Defenses

**Essay Evaluator + assigned Adviser**

- Dashboard
- Essay Evaluations
- My Advisees

**Essay Evaluator + defense participant**

- Dashboard
- Essay Evaluations
- My Defenses

**Multiple applicable responsibilities**

- Dashboard
- all relevant authorized destinations

Do not show unavailable work areas merely to display zero counts.

### 6.3 Dynamic dashboard

Dashboard content should summarize actionable/relevant work only.

Examples:

**Essay Evaluator only**
- pending Essay Evaluations;
- completed Essay Evaluations if useful.

**Adviser**
- relevant advisee work/status requiring attention.

**Defense participant**
- upcoming/current defense work allowed by the accepted Defense workflow.

The dashboard is not authorization. APIs must independently enforce authority.

---

## 7. Essay Evaluation

Multiple-choice scoring is automated by the system.

Faculty Essay Evaluation is the manual academic responsibility for the essay portion.

Expected Faculty task flow:

```text
Faculty signs in
  -> Essay Evaluations
  -> sees all pending eligible entrance-exam essays, regardless of Program
  -> opens essay submission
  -> reviews answer and accepted evaluation criteria
  -> records allowed score/remarks
  -> saves/submits according to existing Exam workflow
```

Do not create a manual multiple-choice checking workflow.

Do not let Faculty arbitrarily modify system-computed MCQ scores.

Essay Evaluation authorization is based on the Faculty member's configured Essay Evaluation access, not on Program membership or a Program Chair role. The queue may provide Program-based filtering for usability without changing the school-wide authorization scope.

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

The initial Full Administrator must be explicitly approved by the project owner and established through a controlled, operator-authorized, auditable bootstrap. Do not infer the initial account from Gmail/email, role name, seed account, creator, or creation order. Actual account designation and environment bootstrap require separate authorization.

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

## 11. Administrator access editor

The access editor should be task/module oriented.

Example conceptual grouping:

- Applicants
- Students
- COR Verification
- Examination
- Defense Administration
- Faculty
- Curriculum
- Analytics / Reports
- Settings
- Administrator Management

Exact grouping and capability granularity must be defined from the repository audit and accepted domain behavior.

Do not bind authorization directly to literal frontend URLs.

Do not let a Restricted Administrator change their own high-privilege access.

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

A person with both responsibilities has two separate User accounts, but the accounts may share the same Gmail/email. The selected role must be included in server-side account resolution so the correct distinct account is authenticated. Each account keeps its own password, User ID, session, permissions, and audit attribution. Password recovery must also be role-scoped. Preserve same-role uniqueness and Applicant-to-Student promotion semantics.

The target design does not require a combined Faculty + Admin account/session.

---

## 13. Custom Roles retirement behavior

The target UI does not require a user-facing Custom Roles page.

Instead:

- Faculty access is configured directly for the Faculty account where appropriate;
- Admin capabilities are configured directly for the Admin account;
- Adviser/Defense work remains assignment-derived.

The approved target is complete retirement of the legacy Custom Roles subsystem, not reuse as internal permission machinery. Remove `UserRole.CUSTOM`, `User.customRoleId`, `CustomRole`, `RoleFeatureAccess`, and legacy `other` login compatibility, along with the mock page/navigation/APIs/seeds/obsolete copy. Use a new forward Prisma migration; never rewrite historical migrations. Before removal, audit all code, seed, test, FK and migration consumers. Development-only CUSTOM test accounts may be removed through a separately controlled development cleanup; preserve unrelated User records and all academic, Defense and audit history. This approval does not authorize staging/production inventory or cleanup.

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
- all pending eligible entrance-exam essays across Programs are available in the Essay Evaluations queue;
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
- External Faculty may be assigned by Admin as Chairman, Panelist, Rapporteur, or Facilitator for the exact Defense schedule;
- External Faculty cannot be selected/assigned as Adviser or receive student advisees;
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

## 18. Implementation-plan handoff requirements

The coding agent's first technical package should be repository audit + implementation planning only, with no production implementation unless separately authorized.

The plan must:

- map current `UserRole`, `Panelist`, auth/session/middleware/routes;
- map Faculty/Panelist dashboard/navigation;
- map Exam essay-grading authority;
- map Adviser eligibility/request/assignment flows;
- map defense assignments and role checks;
- map `CUSTOM`, `CustomRole`, `RoleFeatureAccess`;
- identify reusable vs retiring infrastructure;
- define migration/compatibility strategy;
- define backend capability enforcement;
- define frontend dynamic navigation/dashboard strategy;
- define exact work packages in dependency order;
- give each package scope, non-goals, verification, and stop condition.

The plan must not invent new product behavior or user-facing terminology.

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


## 21. Owner-approved decision register (2026-11-09)

These decisions are approved product/business rules. Code implementation and live-environment authorization are tracked separately.

- **DR-1 — Initial Full Administrator:** Require at least one active Full Administrator for privileged Administrator Management. Explicit project-owner designation only; use a controlled, operator-authorized and auditable bootstrap. No inference from email, role name, seed account, creator, or account order. Actual identity/provisioning remains separately authorized.
- **DR-2 — Custom Roles retirement:** Completely remove the legacy CUSTOM account/permission subsystem from the target architecture: enum value, User.customRoleId, CustomRole/RoleFeatureAccess models and tables, Other Roles authentication, mock UI/API/seeds/copy. Use a forward migration and preserve migration history and unrelated academic/Defense/audit records. Development-only CUSTOM test accounts may be removed by separately controlled development cleanup. No production data access is authorized.
- **DR-3 — Essay Evaluation:** Resolved; school-wide pending eligible entrance-exam essay access across Programs.
- **DR-4 — Same Gmail, separate accounts:** Separate Faculty and Admin User records may share one Gmail/email. Login role selects the distinct account. IDs, passwords, sessions, permissions and audit attribution stay separate. Authentication and recovery must be role-scoped; preserve same-role uniqueness and Applicant/Student promotion behavior. Engineering implementation remains pending.
- **DR-5 — External Defense roles:** Admin may assign External Faculty as Chairman, Panelist, Rapporteur or Facilitator on an exact schedule. External Faculty cannot be Adviser or receive student advisees.
- **DR-6 — Ineligible pending Adviser request:** If the requested Adviser becomes inactive/unavailable after CONFORME but before Dean approval, the existing authorized Admin/Dean reviewer may reject with a reason. Preserve the request and signed CONFORME unchanged; the Student may submit a new request to another eligible Internal Faculty member.
- **DR-7 — Internal Adviser classification lock:** An Internal Faculty member who has ever held an authoritative AdviserAssignment cannot be reclassified as External, even after the assignment ends. Backend-enforced; no Admin override.

No decision above authorizes live account conversion, actual database cleanup, production deployment, or activation by itself.
