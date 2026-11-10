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

If the same real person legitimately performs both Faculty and administrative duties, the target model uses a separate Faculty account and a separate Admin account so academic and administrative activity remain clearly separated in authentication, navigation, authorization, and audit history.

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

A selected role must be validated server-side against the authenticated account. Frontend selection alone is never authorization.

---

## 5. Faculty model

Faculty is the academic account identity.

Faculty functionality is not one fixed bundle shared by every Faculty member. The Faculty experience is derived from two distinct sources:

### 5.1 Configured Faculty access

Configured access is explicitly controlled through authorized administration.

The initial approved configured Faculty access for this feature is:

- **Essay Evaluation**

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

If implementation discovers an existing authoritative program-scoping rule needed for Essay Evaluation, preserve that rule and document it in the implementation plan. Do not invent new Program Chair identity or authority.

---

## 7. Internal and External Faculty

Faculty profiles must preserve the distinction between **Internal** and **External**.

The existing client policy is:

- Internal Faculty may potentially serve as Advisers;
- External Faculty must not be assigned as Advisers;
- External Faculty may participate in defense work where the current Defense policy permits, including the supported External Panelist scenario.

This source of truth does not broaden which defense committee roles an External Faculty member may occupy. Exact committee-role eligibility continues to come from the Defense workflow/policy.

### 7.1 Available as Adviser

Use **Available as Adviser** as the administration-facing concept for whether an Internal Faculty member may receive a new Adviser assignment.

Rules:

- the setting is controlled by authorized administration, not by Faculty self-service;
- Internal Faculty may be Available or Unavailable as Adviser;
- External Faculty are always unavailable/not applicable as Adviser;
- External Faculty must never appear as valid Adviser candidates;
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

---

## 9. Dynamic Faculty dashboard and navigation

The Faculty portal keeps a Faculty Dashboard/Home, and its navigation is structured around the Faculty member's classification and configured permissions without causing layout shifts or tab flickering:

- **Always visible for all Faculty (Internal and External):**
  - `Dashboard`
  - `Profile`
  - `My Defenses` *(visible to all Faculty because any Internal or External Faculty member may serve on a defense committee)*
  - `E-Signatures`
  - `Repository`
  - `Announcements`
- **Conditional on Faculty account profile/permissions:**
  - `Essay Evaluations` — visible **only** when `Essay Evaluation` access is enabled for that specific Faculty account (e.g., for a Faculty member who serves as Program Chair / Essay Evaluator).
  - `My Advisees` — visible **only** for **Internal Faculty**. Because External Faculty can never serve as Advisers, `My Advisees` is hidden from the sidebar and dashboard for External Faculty.
- **Header-only utility navigation:**
  - `Notifications` is omitted from the sidebar navigation list to keep the sidebar clean; users access their Notifications page via the top-header **Notification Bell** icon ("View All Notifications").

Examples:

| Faculty state | Expected Faculty sidebar areas |
| --- | --- |
| Internal Faculty (standard) | Dashboard, Profile, My Defenses, My Advisees, E-Signatures, Repository, Announcements |
| Internal Faculty + Essay Evaluator (e.g. Program Chair) | Dashboard, Profile, Essay Evaluations, My Defenses, My Advisees, E-Signatures, Repository, Announcements |
| External Faculty (standard) | Dashboard, Profile, My Defenses, E-Signatures, Repository, Announcements |
| External Faculty + Essay Evaluator | Dashboard, Profile, Essay Evaluations, My Defenses, E-Signatures, Repository, Announcements |

Dynamic navigation is a usability projection of authority, not the authority itself. Backend/API checks must enforce every protected read/write action even when a link is hidden.

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

## 12. Administrator Management & Default Password Policy

A dedicated **Administrators** management surface is required.

The user-facing design should support:

- Administrator list;
- account status;
- access level (Full Administrator / Restricted Administrator);
- access summary;
- permission/access editor for authorized Full Administrators.

Because the project currently has a very small Admin population, direct per-Administrator configuration is the approved user-facing direction.

The UI should not require arbitrary custom role creation for normal administration access management.

### 12.1 Default Password Policy for Faculty and Administrators

When an authorized Administrator creates a new Faculty account or a new Administrator account:

- the default password is the user's **LAST NAME in ALL CAPS** (e.g., `"Marcial"` → `MARCIAL`);
- the account is created with `mustChangePassword = true`, requiring the user to change their password upon first login;
- the creation modal must display a clear informational banner explaining this default password rule.

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

- Faculty receive the approved direct Faculty access (`canEvaluateEssays`) plus assignment-driven work;
- Admin accounts receive direct administrative capabilities (`adminAccessLevel` + `adminCapabilities`).

---

## 15. Permission architecture principles

The technical implementation must follow these principles:

- use module/task-aligned capability keys grouped cleanly by Admin sidebar sections (`User Management`, `Exam Management`, `Thesis Management`, `Institutional & System`);
- enforce permissions at the backend/API boundary;
- use the same effective-access result to drive frontend navigation and controls without route/tab skeleton flickering;
- preserve assignment-scoped authorization for Adviser and Defense work;
- fail closed when authority cannot be established;
- do not infer access merely from a visible page, dashboard card, or account profile;
- do not broaden Admin authority into academic authority.

Approved Admin capability catalog:

- **User Management:** `applicants.manage`, `students.manage`, `faculty.manage` *(Administrators Management is locked exclusively to Full Administrators)*
- **Exam Management:** `exam.schedules.manage`, `exam.records.manage`, `exam.questions.manage`, `cor.verify`, `waivers.manage`
- **Thesis Management:** `defense.applications.manage`, `defense.schedules.manage`, `defense.records.view`, `adviser.requests.manage`
- **Institutional & System:** `analytics.view`, `memos.manage`, `repository.manage`, `settings.manage`

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

## 17. Surgical Zero-Breakage Migration Strategy

Because the repository currently operates on synthetic/seed data while having 45+ existing Defense and Adviser workflow files coupled to `model Panelist` (`user.panelist`), `PanelRole.PANELIST`, and existing `/api/thesis/defense/panelist/...` endpoints, the implementation uses a **Surgical Separation** strategy:

- **Account Role & User-Facing UI:** Migrate the account identity to `FACULTY` (`UserRole.FACULTY`) across login, session, navigation, headers, and Admin management surfaces.
- **Internal Relational & Endpoint Stability:** Preserve the Prisma `model Panelist` (`user.panelist`) and `PanelRole.PANELIST` enum as well as existing backend endpoint paths (`/api/panelists`, `/api/admin/panelists`, `/api/thesis/defense/panelist/...`) alongside clean `/api/faculty` and `/api/admin/faculty` aliases, and accept `FACULTY` (and `PANELIST` for unit test compatibility) in backend role checks so 100% of existing Defense, Collaborative Workspace, RAP Signature, and Adviser workflows remain unbroken.
- **Synthetic Seed Data:** Update `seed.ts` to provision clean synthetic accounts for Full Administrator, Restricted Administrator, Internal Faculty, External Faculty, and Essay Evaluator / Program Chair Faculty.

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
- authorize Admin academic overrides.

---

## 19. Implementation and verification workflow

1. Update canonical specification documents and create a clean, 4-phase implementation plan.
2. Execute the 4 logical phases continuously (end-to-end) without introducing temporary compatibility bloat.
3. Verify code integrity using TypeScript (`tsc --noEmit`), backend unit tests, and frontend production build.
4. **No automated Playwright browser test suite is required** for this feature; UI/UX testing and visual verification in the browser are performed directly by the project owner.

---

## 20. Acceptance scenarios

The final feature must support at least these behavioral scenarios:

1. **Essay Evaluator only:** Faculty sees Essay Evaluations; no Adviser or Defense authority is fabricated.
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
