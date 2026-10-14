# COR Extraction and Student Credential Handoff — Implementation Plan

**Date:** 2026-10-04  
**Branch:** `workflow/cor-extraction-autofill`  
**Design:** `docs/superpowers/specs/2026-10-04-cor-extraction-student-credential-handoff-design.md`  
**Implementation mode:** Execute one bounded task at a time. Commit after each accepted task unless a smaller atomic split is more appropriate. Do not expand into Curriculum Checklist, residency policy, continuing COR history, or Defense work.
**Revision:** 2026-10-05 authority correction. Applicant Name/Email/Program are provisional until COR verification; Admin-confirmed COR values become authoritative at promotion. This supersedes earlier comparison-only/no-overwrite language in COR-1 through COR-8.

## Pre-implementation rules

- Read `docs/superpowers/DOCUMENT_LIFECYCLE_SOURCE_OF_TRUTH.md` first.
- Read the design document above.
- Preserve the existing secure upload/storage and transactional promotion authority.
- Extraction is suggestion-only; raw parser output is never profile authority.
- The actual COR plus Admin confirmation is the authority boundary. Admin-confirmed COR Name, Email, Program, Student Number, and Registration Number become authoritative during promotion.
- College is not part of the active verification/persistence contract.
- Do not commit the real COR sample or any real student PII to the repository.
- Use synthetic fixtures based on the supported text layout.
- Do not implement OCR in this slice.
- If existing code conflicts with the approved design, the approved design overrides legacy comments/UI text for this branch.

---

## Supersession note for accepted COR-1 through COR-8

COR-1 through COR-8 below describe the historical accepted packages. Their parser, storage, auth, password, residency, and promotion-safety decisions remain valid except where explicitly superseded by the **Post-COR-8 authority correction** later in this plan.

In particular, any earlier statement that Name, Email, or Program are comparison-only / must not overwrite Applicant data is superseded. Any earlier Admin UI requirement to show College is also superseded.

Do not rewrite accepted Git history. Implement the correction as new bounded packages after COR-8.

---

## COR-1 — Define the parser contract and tests

### Goal

Turn the now-confirmed EARIST COR layout into a deterministic parser contract without touching promotion authority.

### Primary files

- `backend/src/extraction/cor-extraction.types.ts`
- new parser module under `backend/src/extraction/`
- focused parser tests / synthetic fixtures in the repository's existing test structure

### Required behavior

Define typed suggestions for:

- Student Number
- Registration Number
- Student Name
  - raw
  - surname
  - first name
  - middle name/initial when parseable
- Program
- College
- Email Address

Name parsing must support:

~~~text
SURNAME, FIRST NAME MIDDLE NAME/INITIAL
~~~

The parser must tolerate missing/ambiguous fields and return partial suggestions instead of throwing for ordinary layout variance.

### Must not parse as v1 authoritative suggestions

Academic Year, Semester, Curriculum Year, residency, subject rows, fees, payments, receipts, signatures.

### Tests

At minimum cover:

- full synthetic sample
- repeated whitespace
- uppercase/lowercase variation
- middle initial vs full middle name
- missing email
- missing registration number
- ambiguous/no-comma name -> raw value retained, components safely partial/null
- no false match from fee/payment/footer text

### Acceptance

Pure parser tests pass and no upload/promotion behavior has changed.

---

## COR-2 — Persist parser suggestions through the extraction pipeline

### Goal

Populate `CorExtraction.suggestions` after successful native PDF text extraction.

### Primary files

- `backend/src/extraction/cor-extraction.service.ts`
- `backend/src/extraction/cor-extraction.types.ts`
- extraction repository/tests as needed

### Required behavior

- Native PDF extraction remains the first supported path.
- After normalized text extraction, run the COR parser.
- Persist bounded typed suggestions.
- Keep parser/extractor version information explicit.
- Missing fields do not change extraction status to failed.
- Image/scanned inputs retain current manual/OCR-deferred behavior.
- Extraction failure never rolls back a valid upload and never promotes a user.

### Acceptance

A synthetic/native-text fixture produces persisted suggestions visible through the existing COR pending/detail data path or a narrowly added review endpoint.

---

## COR-3 — Expose suggestions and Applicant baseline to Admin review

### Goal

Give the Admin enough data to compare the COR against the existing Applicant record.

### Primary files

- COR repository/service/controller response mapping
- frontend `PendingCorUpload`/related types
- avoid exposing raw extraction text unless required for diagnostics

### Required review data

- extraction status/method
- suggestions
- Applicant:
  - first/last name
  - email
  - intended/current program identity
- existing private COR document URL/identifier

Do not make extracted suggestions authoritative in the response model.

### Acceptance

Admin review data contains both baseline identity data and extraction suggestions without changing persistence authority.

---

## COR-4 — Replace the manual Admin form with extraction-assisted review

### Goal

Make the existing Admin COR page the human verification authority.

### Primary file

- `frontend/src/app/(portal)/admin/exam/cor/page.tsx`

### Required behavior

- Keep the actual COR document viewer.
- Show extracted Student Number and Registration Number as editable fields.
- Show Name, Program, College, and Email as side-by-side comparison information.
- Pre-fill only from extraction suggestions.
- Allow Admin correction.
- Clearly distinguish extracted values from confirmed values.
- Remove Academic Year and Semester from this v1 promotion modal/form.
- Remove credential UI text that claims DOB/default-password behavior.
- Verification button remains explicit and human-triggered.

### Acceptance

Admin can review a COR, correct the proposed Student Number/Registration Number, and submit confirmation without AY/Semester inputs.

---

## COR-5 — Align verify-and-promote persistence with the approved v1 authority

### Goal

Keep the atomic promotion path while removing unsupported term/residency assumptions.

### Primary files

- `backend/src/services/cor.service.ts`
- `backend/src/repositories/cor.repository.ts`
- request/controller validation/types
- Prisma changes only if the existing schema cannot represent the approved confirmed data safely

### Required behavior

- Student Number is required.
- Registration Number is accepted/stored when confirmed.
- Academic Year and Semester are not required by this v1 verification request.
- Keep current-upload, PENDING, Applicant-role, and passed-exam checks.
- Preserve atomic COR verification + Student Number + admission state + role transition + audit.
- Do not create a second User.
- Do not mutate password.
- Do not auto-overwrite User name/email/program from extraction.
- Do not set `residencyStartDate` from Admin verification time.
- Audit should record the confirmed Student Number and promotion without logging secrets.

### Enrollment-date caution

Do not use `enrollmentDate` as a substitute for official first-enrollment/residency history unless its existing application semantics are explicitly verified. If retained for compatibility, document it as system confirmation/promotion timing rather than the authoritative academic residency start.

### Acceptance

Concurrent/double verification remains fail-closed and no residency start is inferred.

---

## COR-6 — Simplify Student login to Student Number + existing password

### Goal

Complete the credential handoff created by COR verification.

### Primary files

- `frontend/src/app/(auth)/login/page.tsx`
- `frontend/src/auth.ts`
- `backend/src/interfaces/auth.interfaces.ts`
- `backend/src/services/auth.service.ts`
- `backend/src/repositories/auth.repository.ts`
- related auth tests

### Required behavior

Before promotion:

~~~text
Applicant ID + existing password
~~~

After promotion:

~~~text
Student Number + same existing password
~~~

Implementation requirements:

- remove Date of Birth input from Student login UI
- stop sending `birthdate` as Student login credential
- Student lookup uses Student Number as the account identifier
- password verification remains bcrypt-based through the existing User password hash
- DOB remains stored in Student profile
- promoted users are rejected by Applicant login
- non-Student users cannot use Student login
- do not modify Admin/Panelist/Other login semantics

### Acceptance

Student login works without DOB and all unrelated role-login regression tests remain green.

---

## COR-7 — Correct credential notification behavior

### Goal

Make notification text match the actual credential transition.

### Primary files

- `backend/src/services/cor.service.ts`
- `backend/src/services/email.service.ts`
- `backend/prisma/seed.ts` or canonical template seeding/migration path
- any Admin confirmation copy that describes credentials

### Required behavior

- remove the false `default_password = LASTNAME` behavior
- do not send any plaintext password
- notification provides the confirmed Student Number
- notification tells the user to use the existing account password
- retain normal password-reset flow for users who forgot that password

### Acceptance

No code/template claims a password was changed unless an actual password mutation occurs.

---

## COR-8 — Automated regression coverage

### Required cases

1. Applicant cannot upload COR before passing the Entrance Exam gate.
2. Valid upload remains valid if extraction yields only partial suggestions.
3. Extraction success alone does not promote.
4. Admin can reject and Applicant can resubmit.
5. Only current PENDING upload can be verified.
6. Missing Student Number blocks verification.
7. Verification promotes exactly once.
8. Confirmed Student Number is saved.
9. Applicant login works before promotion.
10. Applicant login fails after promotion.
11. Student login succeeds after promotion using Student Number + original password.
12. DOB is not required for Student login.
13. Wrong password still fails.
14. Admin/Panelist/Other login behavior is unchanged.
15. Credential notification contains no generated/default plaintext password.
16. Verification does not establish `residencyStartDate`.

### Acceptance

Relevant backend and frontend test suites pass with no Defense workflow regressions.

---

## Post-COR-8 authority correction

COR-9 was attempted after COR-8 but could not be executed safely because no disposable full-stack QA environment was available. Before COR-9 is retried, implement and accept the following correction packages.

### COR-AUTH-1 — Make Admin-confirmed COR identity/enrollment data authoritative

#### Goal

Update the canonical atomic `verifyAndPromote` path so verified COR data replaces provisional Applicant Name, Email, and Program while preserving the same User/password and all existing fail-closed gates.

#### Required behavior

- Verification request carries Admin-confirmed:
  - Student Number
  - Registration Number (optional if absent on the actual COR)
  - COR Name components needed by the current schema
  - COR Email
  - existing Program selection/resolution
- Name mapping for the current schema:
  - COR surname -> `User.lastName`
  - COR first name + middle name/initial -> `User.firstName`
  - do not invent suffix data
- Email:
  - trim and validate using existing email rules
  - update `User.email` in the same transaction
  - if another User already owns the confirmed email, fail with a controlled conflict and roll back everything
- Program:
  - update `Student.programId` only to an existing Program selected/resolved from the actual COR
  - normalized unique match may pre-resolve
  - no fuzzy guessing
  - no automatic Program creation
  - ambiguous/no safe match blocks verification until Admin resolves it
- Student Number, Registration Number, role/admission transition, current-PENDING gate, exam gate, audit, concurrency, password preservation, and residency rules remain unchanged.
- Do not rewrite Applicant ID or Entrance Exam history.
- Return/use the confirmed email after the transaction so `credential_dispatch` goes to the new authoritative email, not the stale Applicant email.

#### Tests

Cover at minimum:

- Different Applicant Name -> confirmed COR Name persists.
- Different Applicant Email -> confirmed COR Email persists.
- Different Applicant Program -> confirmed existing Program persists.
- Matching values still succeed.
- Duplicate confirmed email -> entire transaction rolls back; COR remains unverified and no role/profile partial write is accepted.
- Missing/ambiguous Program mapping -> verification blocked before authoritative transition.
- Raw extraction alone still cannot write Name/Email/Program.
- Password hash remains untouched.
- Applicant ID / Entrance Exam history untouched.
- Notification recipient is the confirmed COR email.
- Existing exactly-once/current-PENDING/concurrency tests remain green.

#### Acceptance

One atomic Admin-authorized transaction synchronizes the confirmed COR identity/enrollment data and promotes exactly once, with no partial write on conflict.

---

### COR-AUTH-2 — Redesign Admin COR verification review/confirmation UX

#### Goal

Make the Admin UI clearly show what provisional Applicant values will be replaced by the verified COR and remove the debug-like comparison presentation.

#### Required behavior

Keep the actual private COR document viewer.

Primary review rows:

- Name
- Email
- Program

Do not show College in the active comparison/verification workflow.

Each row shows:

- Current Applicant data
- COR/confirmed value
- status:
  - Match
  - Different
  - No existing data
  - Not extracted

Status is a review aid only:

- no auto-reject
- no auto-promote
- no persistence until explicit Admin confirmation
- red/destructive styling only for actual errors; ordinary differences should use non-destructive warning styling

Name and Email:

- pre-fill from COR extraction when available
- editable so Admin can correct extraction against the actual COR

Program:

- show extracted COR Program
- show/respect the matched existing Program if uniquely resolvable
- allow Admin to choose the correct existing Program when needed
- never offer implicit Program creation from the COR string

Student Number and Registration Number remain in a separate **Confirm Student Credentials** section and are editable.

The UI must explain:

- Applicant values are provisional
- confirmed COR values will replace Name/Email/Program at verification
- differences do not automatically reject the COR
- the existing account/password is retained

Keep extraction diagnostics secondary/collapsible rather than the primary visual focus where practical.

#### Acceptance

Admin can view the actual COR, immediately understand Match/Different states, correct Name/Email/Program/Student Number/Registration Number, resolve Program to an existing record, and explicitly verify/promote.

---

### COR-AUTH-3 — Regression coverage for revised COR authority

#### Required cases

1. Raw extraction remains suggestion-only.
2. Admin-confirmed COR Name replaces provisional Applicant name.
3. Admin-confirmed COR Email replaces provisional Applicant email.
4. Admin-confirmed COR Program replaces provisional Applicant Program using an existing Program.
5. College has no active promotion/profile authority.
6. Duplicate confirmed email fails closed with no partial promotion.
7. Missing/ambiguous Program mapping blocks verification.
8. Match/Different/No existing data/Not extracted statuses do not auto-reject or auto-promote.
9. Student Number and Registration Number confirmation remains correct.
10. Same User id and password hash are retained.
11. Applicant ID and Entrance Exam history are unchanged.
12. Notification is addressed to the confirmed COR email and still contains no plaintext/default password.
13. Applicant login fails after promotion.
14. Student login succeeds with confirmed Student Number + original password.
15. DOB remains profile data and is not required for Student login.
16. `residencyStartDate` remains unaffected.
17. Exactly-once/current-PENDING/concurrency and Defense regressions remain green.

#### Acceptance

Focused and full regression suites pass with no weakening of existing COR/Defense authority tests.

---

## COR-9 — Manual end-to-end QA

Use a disposable/synthetic Applicant account and a privacy-safe test COR equivalent to the supported layout.

### Walkthrough

1. Applicant passes the Entrance Exam gate.
2. Applicant uploads native-text COR.
3. Confirm extraction status and suggestions.
4. Open Admin COR Validation.
5. Open the actual COR document.
6. Compare provisional Applicant vs COR Name/Program/Email and confirm the UI statuses (Match / Different / No existing data / Not extracted).
7. Confirm/correct COR Name and Email, resolve Program to the correct existing Program, and confirm/correct Student Number and Registration Number. College is not part of the verification workflow.
8. Verify & Promote.
9. Confirm COR is VERIFIED, Applicant is now STUDENT, and the Student/User Name, Email, Program, and Student Number equal the Admin-confirmed COR values.
10. Attempt old Applicant login -> must fail because role is no longer Applicant.
11. Student login with confirmed Student Number + original password -> must succeed.
12. Confirm Student login asks for no DOB.
13. Confirm DOB still exists in Student profile data.
14. Confirm no residency start was created from the verification timestamp.
15. Confirm notification is addressed to the confirmed COR email and uses Student Number + existing password semantics.

Record screenshots/results for manual acceptance, but do not commit real personal data.

---

## Completion boundary

This implementation is complete only when COR-1 through COR-8, COR-AUTH-1 through COR-AUTH-3, and the retried COR-9 satisfy their acceptance criteria.

Do not continue directly into:

- Curriculum Checklist
- Thesis 1/Thesis 2 defense mapping
- Academic Year/Semester tracking
- continuing Student COR uploads
- residency rules
- OCR

Those require separate design approval.
