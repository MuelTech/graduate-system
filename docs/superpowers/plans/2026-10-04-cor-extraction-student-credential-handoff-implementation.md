# COR Extraction and Student Credential Handoff — Implementation Plan

**Date:** 2026-10-04  
**Branch:** `workflow/cor-extraction-autofill`  
**Design:** `docs/superpowers/specs/2026-10-04-cor-extraction-student-credential-handoff-design.md`  
**Implementation mode:** Execute one bounded task at a time. Commit after each accepted task unless a smaller atomic split is more appropriate. Do not expand into Curriculum Checklist, residency policy, continuing COR history, or Defense work.

## Pre-implementation rules

- Read `docs/superpowers/DOCUMENT_LIFECYCLE_SOURCE_OF_TRUTH.md` first.
- Read the design document above.
- Preserve the existing secure upload/storage and transactional promotion authority.
- Extraction is suggestion-only.
- Do not commit the real COR sample or any real student PII to the repository.
- Use synthetic fixtures based on the supported text layout.
- Do not implement OCR in this slice.
- If existing code conflicts with the approved design, the approved design overrides legacy comments/UI text for this branch.

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

## COR-9 — Manual end-to-end QA

Use a disposable/synthetic Applicant account and a privacy-safe test COR equivalent to the supported layout.

### Walkthrough

1. Applicant passes the Entrance Exam gate.
2. Applicant uploads native-text COR.
3. Confirm extraction status and suggestions.
4. Open Admin COR Validation.
5. Open the actual COR document.
6. Compare Applicant vs COR name/program/email.
7. Confirm or correct Student Number and Registration Number.
8. Verify & Promote.
9. Confirm COR is VERIFIED and Applicant is now STUDENT.
10. Attempt old Applicant login -> must fail because role is no longer Applicant.
11. Student login with confirmed Student Number + original password -> must succeed.
12. Confirm Student login asks for no DOB.
13. Confirm DOB still exists in Student profile data.
14. Confirm no residency start was created from the verification timestamp.
15. Confirm notification text uses Student Number + existing password semantics.

Record screenshots/results for manual acceptance, but do not commit real personal data.

---

## Completion boundary

This implementation is complete when COR-1 through COR-9 satisfy their acceptance criteria.

Do not continue directly into:

- Curriculum Checklist
- Thesis 1/Thesis 2 defense mapping
- Academic Year/Semester tracking
- continuing Student COR uploads
- residency rules
- OCR

Those require separate design approval.
