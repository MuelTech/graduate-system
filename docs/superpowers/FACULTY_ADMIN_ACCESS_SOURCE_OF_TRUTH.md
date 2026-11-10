# Faculty and Administrator Access — Source of Truth

**Project:** EARIST Graduate School Information System (GS-IS)  
**Status:** CANONICAL PRODUCT / DOMAIN SOURCE OF TRUTH — APPROVED TARGET, IMPLEMENTATION PENDING  
**Approved:** 2026-11-08 (Asia/Manila)  
**Repository:** `MuelTech/graduate-system`

---

## 1. Purpose

This document defines the canonical product, access, and business rules for the future Faculty and Administrator model in GS-IS.

It resolves the previously open direction around:

- the broad `PANELIST` account identity;
- Faculty access and Faculty dashboard/navigation behavior;
- Internal vs External Faculty;
- Essay Evaluation access;
- Adviser availability and Adviser-page authority;
- defense committee assignments;
- Administrator access levels;
- Full Administrator authority;
- Restricted Administrator permissions;
- user-facing Custom Roles;
- Faculty/Admin login separation.

This document defines **what must be true**. It does not prescribe the final database schema, exact permission-key names, route migration sequence, or work-package decomposition. Those details must be derived from a repository audit and implementation plan.

---

## 2. Authority and conflict order

For this domain, use the following authority order:

1. this source of truth for Faculty/Admin identity, access, and business boundaries;
2. the current accepted domain source of truth for the affected workflow, especially Defense and Adviser workflows;
3. the current Faculty/Admin design specification;
4. `docs/superpowers/USER_FACING_COPY_SOURCE_OF_TRUTH.md` for visible wording;
5. `docs/superpowers/ui-ux/SYSTEM_UI_UX_PLAYBOOK.md` for presentation and interaction;
6. the approved implementation plan;
7. historical specs/plans/current legacy code only as migration evidence.

If an older Panelist/Custom Role document conflicts with this source of truth, this document wins for the new Faculty/Admin direction.

This source of truth does **not** silently override accepted Defense, Adviser, document-lifecycle, scoring, signature, or academic-result rules outside the access-model changes explicitly defined here.

---

## 3. Fixed system-role model

The conceptual system model remains exactly four system roles:

- **Applicant**
- **Student**
- **Faculty**
- **Admin**

Do not introduce a fifth conceptual role such as Staff, Personnel, Super Admin, Program Chair, Panelist, Adviser, Chairman, Rapporteur, or Facilitator.

### 3.1 Faculty replaces the broad Panelist account identity

The current broad `PANELIST` account identity is a legacy implementation concept that must migrate toward **FACULTY**.

This migration must not be implemented as a blind string rename. Existing user IDs, credentials, profiles, adviser history, defense assignments, signatures, evaluations, audit history, and other authoritative relationships must be preserved.

The word **Panelist** remains valid when it describes an actual defense assignment.

### 3.2 Admin remains a separate account role

Faculty and Admin are separate account roles in the approved target.

A Faculty account does not receive Admin access.

If the same real person legitimately performs both Faculty and administrative duties, the target model uses a separate Faculty account and a separate Admin account so academic and administrative activity remain clearly separated in authentication, navigation, authorization, and audit history. **The two separate accounts may use the same Gmail/email address.** The selected login role must disambiguate the account; each account retains its own User ID, password, session, access configuration, and audit attribution. Same-email support must not permit duplicate accounts within the same account role or weaken Applicant/Student identity and promotion rules.

No Faculty/Admin workspace switcher or combined Faculty+Admin session is required by this design.

---

## 4. Login model

The existing role-selection concept is retained.

The target login choices are:

- Applicant
- Student
- Faculty
- Administrator

After authentication, the user enters the portal for the selected account role.

Do not add a second post-login "Choose Workspace" screen.

A selected role must be validated server-side against the authenticated account. Authentication lookup must use the normalized email plus the selected account role, not email alone. Same-email Faculty/Admin accounts must resolve to the correct distinct User record and must never share credentials, sessions, grants, or audit identity. Password recovery must also identify the intended account role so a recovery request cannot reset the wrong account. Frontend selection alone is never authorization. Preserve Applicant ID and Student Number login, Applicant-to-Student promotion, and same-role email uniqueness.

---

## 5. Faculty model

Faculty is the academic account identity.

Faculty functionality is not one fixed bundle shared by every Faculty member. The Faculty experience is derived from two distinct sources:

### 5.1 Configured Faculty access

Configured access is explicitly controlled through authorized administration.

The initial approved configured Faculty access for this feature is:

- **Essay Evaluation**

Configured Essay Evaluation access is **school-wide** for the current entrance-exam essay workload. An authorized Faculty Essay Evaluator may see and evaluate **all pending eligible entrance-exam essays, regardless of Program**.

No Faculty-to-Program evaluator assignment or Program-scoped authorization relation is required by this feature. Program information may still be displayed or used as a queue/filtering aid, but Program is **not an authorization boundary** for Essay Evaluation.

Multiple-choice entrance-exam checking remains automated by the system. Faculty do not manually re-check or alter automatically computed multiple-choice scores as part of Essay Evaluation.

The system may expose relevant automatically computed exam information read-only when needed by the accepted evaluation workflow.

### 5.2 Assignment-driven Faculty work

The following are **not permanent Faculty permission checkboxes**:

- Adviser;
- Chairman;
- Panelist;
- Rapporteur;
- Facilitator;
- other defense-specific committee functions.

Authority for these areas comes from the authoritative workflow assignment.

Examples:

- Adviser work comes from an actual Adviser assignment;
- defense work comes from the exact defense schedule / committee assignment;
- a Faculty member may hold different defense roles in different defenses.

Do not add permanent controls such as "Panelist access", "Chairman access", or "Rapporteur access" to the Faculty profile.

---

## 6. Program Chair boundary

Program Chair is not introduced as a separate system role by this feature.

The client workflow may use Program Chairs as the Faculty members who perform Essay Evaluation, but the system-facing access for this feature is **Essay Evaluation**, not a new global Program Chair role.

Do not create a user-facing Program Chair role/capability solely to implement this Faculty/Admin feature.

For this feature, Essay Evaluation is not Program-scoped. A Faculty member with configured Essay Evaluation access is authorized for all pending eligible entrance-exam essays across Programs.

Do not introduce a Faculty-to-Program evaluator assignment, Program-scoped permission relation, or Program Chair identity solely for Essay Evaluation. Program information may be presented for context or filtering, but it must not narrow or broaden Essay Evaluation authorization unless a later separately approved policy changes this source of truth.

---

## 7. Internal and External Faculty

Faculty profiles must preserve the distinction between **Internal** and **External**.

The existing client policy is:

- Internal Faculty may potentially serve as Advisers;
- External Faculty must not be assigned as Advisers;
- External Faculty may be assigned by Admin to the contextual Defense roles **Chairman, Panelist, Rapporteur, and Facilitator** through the existing Defense committee-assignment workflow;
- External Faculty must never be assigned as Adviser or receive student advisees.

These are schedule-specific assignments, not permanent Faculty permissions. Admin selects the exact role for each defense. The four permitted External Defense roles do not create Adviser eligibility or bypass existing role-specific workflow checks.

### 7.1 Available as Adviser

Use **Available as Adviser** as the administration-facing concept for whether an Internal Faculty member may receive a new Adviser assignment.

Rules:

- the setting is controlled by authorized administration, not by Faculty self-service;
- Internal Faculty may be Available or Unavailable as Adviser;
- External Faculty are always unavailable/not applicable as Adviser;
- External Faculty must never appear as valid Adviser candidates;
- an Internal Faculty member who has ever held an authoritative AdviserAssignment to a Student cannot later be reclassified as External, even if the assignment is subsequently completed; enforce this at the backend and do not provide an Admin override;
- changing availability must not erase historical or existing authoritative Adviser assignments;
- availability is not itself an Adviser assignment.

This feature does not introduce a new adviser load cap. The current no-load-cap behavior remains authoritative unless a separate client-approved capacity policy is documented and implemented.

### 7.2 Adviser-page authority

Do not model "Adviser Page Access" as a manual permission checkbox.

The system derives Adviser work from authoritative Adviser assignments.

A Faculty member who is Available as Adviser but has no actual Adviser assignment does not gain authority over arbitrary Students.

A Faculty member with an authoritative Adviser assignment receives only the Adviser functionality permitted by the existing Adviser workflow for the assigned Student/research relationship.

---

## 8. Defense assignment authority

Defense committee authority remains contextual and schedule-specific.

The authoritative pattern remains equivalent to:

**Defense Schedule → Panel Assignment → Defense Role**

Roles such as Chairman, Panelist, Rapporteur, Facilitator, and Adviser retain their accepted defense meanings where applicable.

Administration chooses/maintains defense committee membership through the accepted defense scheduling/committee workflow, not through Faculty Management permission checkboxes.

Faculty Management may show a read-only summary of current/relevant defense assignments, but it must not become an alternate source of committee authority.

Historical defense assignments and attribution must remain preserved through the Faculty migration.

For External Faculty, the permitted contextual roles are Chairman, Panelist, Rapporteur, and Facilitator when selected by Admin in the exact schedule's committee workflow. External Faculty are never eligible for the Adviser role. Do not change PanelRole, PanelAssignment, historical assignment roles, or defense attribution as part of Custom Roles retirement.

---

## 9. Dynamic Faculty dashboard and navigation

The Faculty portal keeps a Faculty Dashboard/Home, but its content and navigation are dynamic.

The system computes the Faculty member's effective work from:

- configured Faculty access, such as Essay Evaluation;
- authoritative Adviser assignments;
- authoritative defense assignments.

Only relevant Faculty work areas should be shown.

Examples:

| Faculty state | Expected Faculty areas |
| --- | --- |
| Essay Evaluator only | Dashboard, Essay Evaluations |
| Adviser with active assignment | Dashboard, My Advisees |
| Faculty with defense assignment | Dashboard, My Defenses |
| Essay Evaluator + Adviser | Dashboard, Essay Evaluations, My Advisees |
| Essay Evaluator + defense assignment | Dashboard, Essay Evaluations, My Defenses |
| Multiple applicable responsibilities | Dashboard plus all authorized/relevant areas |

Do not fill the dashboard with irrelevant zero-value cards such as "0 Defenses" or "0 Advisees" for functions the Faculty member does not have.

Common account/profile/notification surfaces may remain where already accepted.

Dynamic navigation is a usability projection of authority, not the authority itself. Backend/API checks must enforce every protected read/write action even when a link is hidden.

### UIUX-3E — Faculty Portal UI/UX refinement before FACULTY-18

The project owner requested one bounded Faculty Portal refinement before FACULTY-18, combining (A) sidebar navigation stability and (B) a richer operational Faculty Dashboard. This is a separate prerequisite package; it is **not part of FACULTY-18 implementation** and does not change the Faculty access/authorization model.

**A. Sidebar navigation stability**

Keep the Faculty sidebar visually stable during ordinary same-account route navigation and access revalidation. The current source sets the Faculty work projection to null while `/auth/me` is fetching and filters conditional navigation links directly from that projection; this is a plausible source of the observed flicker/vertical shift and must be confirmed in a real browser before implementation.

The correction must:
- avoid removing/reinserting already-confirmed same-account navigation items merely because a routine route-change refresh is in flight;
- continue refreshing the current Faculty access projection and never use a stale projection to authorize protected page content or API requests;
- remove links when a successful fresh response confirms that the corresponding work is no longer relevant;
- fail closed on access-resolution failure/revocation, with a clear unavailable state and no stale protected content or actionable access;
- preserve account-switch/logout cache isolation, desktop collapse, mobile drawer/overlay, keyboard/focus behavior, and direct-route/API enforcement.

**B. Richer Faculty Dashboard**

Refine—not blindly restore—the earlier richer operational overview while retaining FACULTY-13/14 account-scoped dynamic relevance. The design may include:
- concise Your Work summaries for only responsibilities relevant to the authenticated account;
- Upcoming Defenses and Pending Tasks metrics when their corresponding work area is relevant;
- Needs Your Attention with actionable tasks and exact deep links;
- conditional Active Defense for an exact currently active assignment;
- Upcoming Defense Sessions, prioritizing the next scheduled assigned defense and a small bounded list of subsequent sessions;
- Waiting on Others as a compact, collapsible informational subsection with its own count, visually distinct from actionable work;
- Recent Notifications sourced from the authenticated account's notification records.

Render only authoritative, current, account-scoped information. Do not show irrelevant zero-value cards or infer Adviser, Defense, or Essay Evaluation authority from counts, links, or dashboard projections. Waiting-only dependencies never contribute to Pending Tasks. External Faculty must not receive Adviser/advisee sections. Preserve separate Faculty/Admin account identity and cache isolation.

**Acceptance boundary:** UIUX-3E must receive focused verification, independent source/diff review, and project-owner browser/visual acceptance before FACULTY-18 begins. It is a separate pre-FACULTY-18 prerequisite, not a new permission, workflow, or part of FACULTY-18 activation.

---

## 10. Faculty Management

The target User Management information architecture is:

- Applicants
- Students
- Faculty
- Administrators

The broad user-facing **Panelists** management concept is replaced by **Faculty**.

Faculty Management owns account/profile administration and direct Faculty configuration such as:

- identity/profile information;
- Internal / External classification;
- account status;
- Essay Evaluation access;
- Available as Adviser for Internal Faculty;
- relevant read-only assignment summaries where useful.

Faculty Management does not directly create Adviser assignments or defense committee assignments. Those remain in their authoritative workflows.

---

## 11. Administrator model

Admin remains one of the four fixed system roles.

Admin is an administrative/operational account role. Admin does not automatically imply unrestricted authority.

There are two administration access levels within the Admin role:

- **Full Administrator**
- **Restricted Administrator**

These are not additional conceptual system roles. Both remain Admin accounts.

### 11.1 Full Administrator

A Full Administrator has the complete approved administrative capability set and is the authority that can manage Administrator accounts/access.

At least one active Full Administrator is required for normal privileged Administrator Management operations. The initial Full Administrator must be explicitly designated and approved by the project owner through a controlled, operator-authorized, auditable bootstrap. Never infer initial Full authority from Gmail/email, role name, seed account, creator identity, account creation order, or an ordinary public/runtime API. The bootstrap policy is approved; actual account identity and environment execution remain separately authorized.

Full Administrator responsibilities include, subject to existing domain boundaries:

- manage Administrator accounts;
- grant/revoke Restricted Administrator capabilities;
- access all approved administrative modules;
- manage high-privilege administrative configuration;
- review/manage Faculty administration where the system permits;
- manage the administrative permission configuration itself.

Full Administrator does not gain academic or defense authority merely because of administrative privilege.

A Full Administrator cannot bypass accepted rules that require an actual Faculty/Adviser/defense assignment.

### 11.2 Restricted Administrator

A Restricted Administrator has only the administrative capabilities explicitly granted to that account.

Examples may include:

- Applicants;
- Students;
- COR Verification;
- Exam Scheduling;
- Exam Records;
- Defense Administration;
- Faculty Management;
- Curriculum;
- Analytics/Reports;
- Settings.

The exact technical capability catalog must be repository-audited and planned. Do not store authorization as literal frontend route names when stable capability keys can represent the business action.

Restricted Administrators must not:

- elevate their own permissions;
- grant themselves Full Administrator authority;
- manage Full Administrator privilege unless explicitly authorized by the high-privilege management rule;
- bypass backend authorization by navigating directly to a hidden route/API.

---

## 12. Administrator Management

A dedicated **Administrators** management surface is required.

The user-facing design should support:

- Administrator list;
- account status;
- access level (Full Administrator / Restricted Administrator);
- access summary;
- permission/access editor for authorized Full Administrators.

Because the project currently has a very small Admin population, direct per-Administrator configuration is the approved user-facing direction.

The UI should not require arbitrary custom role creation for normal administration access management.

---

## 13. Full Administrator safety rules

The implementation must preserve these safeguards:

1. At least one active Full Administrator must always remain.
2. A Restricted Administrator cannot self-elevate.
3. High-privilege Administrator access changes are controlled by Full Administrator authority.
4. Administrator access changes must be auditable with actor, target, change, and time.
5. Backend authorization is authoritative; frontend hiding/disabled controls are insufficient.
6. Full Administrator authority does not create academic/defense override authority.

Additional hardening such as re-authentication for sensitive changes may be planned separately if justified.

---

## 14. Custom Roles direction

The user-facing **Custom Roles** product concept is retired by the target design.

Do not require Administrators to create arbitrary roles such as "GS Office Staff", "Viewer", or "Program Chair" merely to grant access.

Instead:

- Faculty receive the approved direct Faculty access plus assignment-driven work;
- Admin accounts receive direct administrative capabilities.

The approved target architecture completely retires the legacy Custom Roles account/permission subsystem; it is not retained or repurposed as internal permission machinery. The bounded retirement includes:

- remove `CUSTOM` from `UserRole`;
- remove `User.customRoleId` and its relation/index;
- remove the `CustomRole` and `RoleFeatureAccess` Prisma models and their database tables;
- retire the legacy `other` → `CUSTOM` authentication path;
- remove the mock Custom Roles UI, navigation, APIs, seed fixtures, and obsolete user-facing copy/references.

Implement database removal only through a new forward Prisma migration. Never rewrite or delete historical migration files. Before dropping the tables/enum value/column, audit all runtime, test, seed, foreign-key, and migration references and prove no remaining target consumer depends on them. Remove only development-only CUSTOM test accounts through a separately controlled development cleanup if needed; do not delete unrelated User records or academic/Defense/audit history. Do not inspect or modify staging/production data under this development decision.

The replacement authority is the existing direct per-account Faculty/Admin capability model plus contextual Adviser/Defense assignments. No legacy RoleFeatureAccess rows are translated into new grants.

---

## 15. Permission architecture principles

The technical implementation must follow these principles:

- use stable capability/business-action semantics rather than literal route strings;
- enforce permissions at the backend/API boundary;
- use the same effective-access result to drive frontend navigation and controls;
- preserve assignment-scoped authorization for Adviser and Defense work;
- fail closed when authority cannot be established;
- do not infer access merely from a visible page, dashboard card, or account profile;
- do not broaden Admin authority into academic authority.

Illustrative capability names may include concepts such as:

- applicants.view / applicants.manage;
- students.view / students.manage;
- cor.verify;
- exam.schedules.manage;
- exam.records.view;
- faculty.manage;
- curriculum.manage;
- analytics.view;
- settings.manage;
- administrator_access.manage.

These examples are not a locked schema. The implementation plan must define the final catalog after auditing the live repository.

---

## 16. User-facing terminology

The following terms are approved target terminology for this feature:

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

Visible copy must still comply with `USER_FACING_COPY_SOURCE_OF_TRUTH.md`.

Do not invent alternate product terminology when an approved term already exists.

Do not expose internal model names, raw permission keys, route names, migration terminology, or legacy `PANELIST` account wording in ordinary new Faculty UI.

The word **Panelist** remains correct inside actual defense-role context.

---

## 17. Migration invariants

The future implementation must preserve these invariants:

- no duplicate Faculty accounts solely because `PANELIST` becomes `FACULTY`;
- existing user identity/credentials remain attached to the same authoritative person/account where the role migration applies;
- historical Adviser assignments remain preserved;
- historical defense assignments remain preserved;
- historical evaluation/signature/audit attribution remains preserved;
- defense-specific Panelist terminology is not globally renamed away;
- External Faculty cannot become Adviser through migration;
- legacy Custom Role data is not destroyed without an explicit migration decision;
- current accepted workflows continue to enforce their own authority.

Compatibility routes/internal names may remain temporarily when required for safe migration. User-facing migration and technical cleanup do not need to happen in one destructive step.

---

## 18. Explicit non-goals

This feature specification does not by itself:

- redesign the Defense workflow;
- redefine defense committee quotas;
- decide new External Faculty committee-role eligibility;
- create a Program Chair role;
- create a Faculty+Admin combined account/session;
- add an Adviser load cap;
- change automated multiple-choice scoring;
- change academic PASS/FAIL policy;
- change official-document/signature policy;
- authorize Admin academic overrides;
- require immediate deletion of legacy `PANELIST` routes/models or Custom Role tables.

---

## 19. Implementation workflow

Implementation must follow the project workflow:

1. accept this source of truth;
2. accept the companion design specification;
3. coding agent performs a repository/architecture audit;
4. coding agent writes a repository-grounded implementation plan;
5. that plan decomposes the work into small, dependency-ordered, independently reviewable packages;
6. one package is explicitly authorized per task prompt;
7. coding agent implements only that package and stops;
8. remote HEAD/diff is independently reviewed;
9. project owner performs manual/browser/UI QA where needed.

The implementation plan must not redefine this product behavior. If repository findings expose a genuine conflict or missing policy, record it as a decision/blocker instead of silently inventing new behavior.

---

## 20. Acceptance scenarios

The final feature must support at least these behavioral scenarios:

1. **Essay Evaluator only:** Faculty sees Essay Evaluations and may work on all pending eligible entrance-exam essays across Programs; no Adviser or Defense authority is fabricated.
2. **Internal Faculty available as Adviser, no assignment:** may be selected by the authoritative Adviser workflow, but has no arbitrary Student Adviser authority.
3. **Assigned Adviser:** Faculty receives the accepted Adviser functionality only for authoritative advisee relationships.
4. **External Panelist:** may receive permitted defense assignment functionality but cannot become an Adviser or appear as an Adviser candidate.
5. **Faculty with defense assignment:** My Defenses reflects the exact assigned defense/role.
6. **Faculty with multiple responsibilities:** dashboard/navigation combines only the applicable Faculty work areas.
7. **Restricted Administrator:** sees and can use only explicitly granted administrative capabilities.
8. **Full Administrator:** can manage Administrator access while remaining bound by academic/defense authority rules.
9. **Unauthorized direct navigation/API call:** denied even if a route is guessed manually.
10. **Same real person with Faculty and Admin duties:** uses separate Faculty and Admin accounts in the approved target.
11. **Historical records:** continue to identify actual defense Panelist/Chairman/Rapporteur roles correctly after Faculty identity migration.

---

## 21. Canonical decision summary

The approved direction is:

**Applicant / Student / Faculty / Admin remain the four system roles.**

**Faculty** is the academic identity. Faculty UI is dynamic from configured Essay Evaluation access plus authoritative Adviser/Defense assignments. Internal/External status is preserved; External Faculty cannot be Advisers; Available as Adviser is Admin-controlled for Internal Faculty.

**Admin** is a separate account role. Full Administrator has complete administrative access plus Administrator-access management. Restricted Administrator receives only selected administrative capabilities. Faculty accounts do not receive Admin access.

**Panelist/Chairman/Rapporteur/Facilitator/Adviser are not new global roles or permanent Faculty permissions.** Their authority remains contextual to the accepted workflow.

**Custom Roles is retired as a user-facing access-management concept, while reusable underlying permission infrastructure may be refactored after audit.**


## 22. Owner-approved decision register (2026-11-09)

The following product/business decisions were explicitly approved by the project owner. Approval of a policy does not imply that its code correction, live account mapping, institutional authorization, or deployment verification is complete.

- **DR-1 — Initial Full Administrator:** At least one active Full Administrator is required for privileged Administrator Management. The initial account must be explicitly approved by the project owner and established through a controlled, operator-authorized, auditable bootstrap. No automatic designation from email, role name, seed account, creator, or account order. Actual account identity and environment bootstrap remain pending separate authorization.
- **DR-2 — Custom Roles retirement:** Completely retire the legacy CUSTOM account/permission subsystem from the target architecture, including the CUSTOM enum value, User.customRoleId, CustomRole and RoleFeatureAccess models/tables, legacy Other Roles authentication, and mock UI. Use a forward migration; preserve migration history and unrelated academic/Defense/audit history. Development-only CUSTOM test accounts may be removed through a separately controlled development cleanup and replaced with approved Faculty/Admin test seeds. This decision does not authorize production data inspection or cleanup.
- **DR-3 — Essay Evaluation:** Resolved. Configured Faculty evaluators may evaluate all pending eligible entrance-exam essays school-wide across Programs; Program is not an authorization boundary.
- **DR-4 — Same Gmail, separate Faculty/Admin accounts:** Separate Faculty and Admin User records may share the same Gmail/email. The selected login role disambiguates them. Each account has its own ID, password, session, access configuration, and audit identity. Authentication and password recovery must be role-scoped. Preserve same-role uniqueness and Applicant/Student promotion semantics. The precise schema/auth implementation remains a follow-up engineering task.
- **DR-5 — External Defense roles:** Admin may assign External Faculty to Chairman, Panelist, Rapporteur, or Facilitator on an exact Defense schedule. External Faculty may never be Adviser or receive student advisees. These are contextual assignments, not permanent account permissions.
- **DR-6 — Ineligible pending Adviser request:** If the requested Adviser becomes inactive or unavailable after CONFORME but before Dean approval, the authorized existing Admin/Dean reviewer may reject the pending request with a recorded reason. Preserve the original request and signed CONFORME unchanged. The Student may submit a new request to another eligible Internal Faculty member.
- **DR-7 — Internal Adviser classification lock:** Once an Internal Faculty member has ever held an authoritative AdviserAssignment to a Student, that account/profile cannot be reclassified as External, even if the assignment is subsequently completed. Enforce the restriction server-side; no Admin override. External Faculty remain ineligible for Adviser assignments.

Implementation status is tracked separately in the existing implementation plan and checklist. DR-1 actual bootstrap, DR-2 live/production disposition, and deployment/activation gates remain unapproved until their separately stated prerequisites are satisfied.
