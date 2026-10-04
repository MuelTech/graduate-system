# COR Extraction and Student Credential Handoff — Design

**Date:** 2026-10-04  
**Branch:** `workflow/cor-extraction-autofill`  
**Base:** `workflow/title-defense` @ `cfbf4a69fb5ebec1117e1615192f546969651938`  
**Status:** Approved implementation design for the first authoritative EARIST COR parser slice.  
**Scope:** Applicant COR extraction, Admin-assisted verification, Applicant-to-Student promotion, and the directly related Student login credential handoff.

## 1. Problem statement

The current system already has a secure Applicant COR upload/extraction pipeline and a transactional Admin `verifyAndPromote` authority path, but the extraction layer does not yet map EARIST COR text into review suggestions. The Admin COR screen therefore still asks the reviewer to type values manually.

A real EARIST Certificate of Registration sample is now available. It establishes enough structure to define the first supported parser contract without inventing fields.

The same promotion flow also exposes an authentication mismatch:

- Student login currently requires Student Number + Date of Birth + Password.
- COR verification already assigns the Student Number and changes the existing account role from `APPLICANT` to `STUDENT`.
- The account password is not changed during promotion.
- The current credential email/UI implies a new/default password even though the existing password is actually retained.

This slice resolves those connected behaviors without refactoring unrelated authentication.

## 2. Business purpose

The Applicant portal exists primarily for the online admission/examination flow. After the required Entrance Examination gate is passed, the Applicant must prove official EARIST enrollment by submitting a COR.

Canonical transition:

~~~text
APPLICANT
  -> passes required Entrance Examination gate
  -> uploads COR
  -> system extracts review suggestions
  -> Admin compares suggestions with the actual COR and Applicant record
  -> Admin corrects/accepts values
  -> one transaction verifies COR and promotes account
  -> STUDENT
~~~

Extraction is assistive only. A successful parser result never has promotion authority.

## 3. Authority rules

1. Admin verification remains mandatory.
2. The actual uploaded COR remains the evidence of record.
3. Extracted values are suggestions, not authoritative profile data.
4. Admin may correct suggested values before verification.
5. Only Admin-confirmed values enter the authoritative promotion transaction.
6. `Student.studentNumber` becomes authoritative only after verification.
7. Promotion keeps the same `User` account and password; it changes the role from `APPLICANT` to `STUDENT`.
8. Applicant login must no longer work after promotion.
9. Student login must work using the confirmed Student Number and the existing password.
10. Date of Birth remains profile data but is not a normal Student login credential.

## 4. First supported EARIST COR field contract

### 4.1 Extract and present for Admin confirmation

| Field | Parser output | Admin use | Authoritative effect after confirmation |
|---|---|---|---|
| Student Number | string | editable | saved to `Student.studentNumber`; becomes Student login identifier |
| Registration Number | string | editable | stored with the verified COR record/reference |
| Student Name | raw + parsed components | comparison | identity evidence only in v1; do not silently overwrite User name fields |
| Program | string | comparison | identity/enrollment evidence only in v1; do not silently change program |
| College | string | comparison | evidence only in v1 |
| Email Address | string | comparison | evidence only in v1; do not silently overwrite account email |

### 4.2 COR name format

The supplied EARIST COR format places the family name first:

~~~text
SURNAME, FIRST NAME MIDDLE NAME/INITIAL
~~~

The parser should preserve the raw displayed value and also produce normalized comparison components where safely parseable:

~~~text
rawName
surname
firstName
middleNameOrInitial
~~~

Rules:

- The comma is the primary surname boundary for this supported format.
- Trim surrounding and repeated whitespace.
- Comparison may be case-insensitive.
- Preserve the COR spelling in the raw suggestion.
- If the format is ambiguous, leave parsed components partial/null and require Admin review.
- Do not mutate the Applicant/User name automatically from extraction.

## 5. Explicitly deferred fields

The parser may continue retaining bounded raw extracted text/pages for diagnostics, but v1 must not treat the following as review fields or authoritative data:

- Academic Year
- Semester / Term
- Curriculum Year
- Year Level
- Major
- Gender
- Age
- subject/course rows
- units
- section
- schedule
- room
- faculty
- assessed fees / tuition / MOOE
- financial aid / discounts
- payments / balances
- official receipt details
- signatures / approved-by / registrar text

### Why Academic Year, Semester, and Curriculum Year are deferred

An Applicant may upload a COR later than the student's actual first enrollment. Therefore the uploaded COR's current term must not be assumed to equal first enrollment or residency start.

This branch must not derive residency from the COR, Curriculum Year, Academic Year/Term, or the Admin verification timestamp.

In particular, the existing promotion code must not silently establish `residencyStartDate` from the verification time. Residency semantics require a separate institutional decision.

## 6. Extraction representation

`CorExtraction.suggestions` is the assistive parser boundary. Suggested shape:

~~~text
{
  studentNumber,
  registrationNumber,
  studentName: {
    raw,
    surname,
    firstName,
    middleNameOrInitial
  },
  program,
  college,
  emailAddress
}
~~~

The parser should be deterministic, versioned, and testable independently from upload/storage.

Recommended parser-version behavior:

- native PDF text is first supported input
- parser records an explicit extractor/parser version
- missing fields are allowed; partial suggestions still go to Admin
- malformed or ambiguous values do not fail the valid COR upload
- scanned/image-only inputs remain `MANUAL_REQUIRED` until OCR support is intentionally implemented

No real student COR containing personal information should be committed as a test fixture. Use synthetic normalized text fixtures that reproduce the supported layout.

## 7. Admin review UX

The Admin COR review must show both authorities at the same time:

- the actual uploaded COR through the existing private document viewer
- extracted suggestions
- the existing Applicant record values for comparison where available

Minimum review presentation:

~~~text
Student Number       [ extracted suggestion, editable ]
Registration Number  [ extracted suggestion, editable ]

Identity comparison
Name       Applicant value  <-> COR suggestion
Program    Applicant value  <-> COR suggestion
College                     <-> COR suggestion
Email      Applicant value  <-> COR suggestion
~~~

The UI may show match/mismatch indicators, but mismatch must not automatically reject or overwrite data.

The current Academic Year and Semester verification fields are removed from this v1 Admin promotion form.

## 8. Verified promotion transaction

The existing transactional `verifyAndPromote` authority pattern remains canonical.

The transaction must continue to fail closed unless:

- the supplied COR is the student's current `PENDING` submission
- the Student admission state is exactly `APPLICANT`
- the linked User role is exactly `APPLICANT`
- the required Entrance Examination gate is passed
- the Admin-confirmed Student Number is present and valid for persistence

The same transaction should:

- mark the exact COR submission `VERIFIED`
- persist the confirmed COR record/reference data
- assign the confirmed Student Number
- set the admission state to the accepted enrolled/student state
- change `User.role` from `APPLICANT` to `STUDENT`
- write the audit record

It must not:

- create a second User account
- reset or replace the password
- derive residency start from verification time
- auto-change name, email, or program based only on extraction
- grant thesis eligibility merely because the role became `STUDENT`

## 9. Student credential handoff

### Before promotion

~~~text
Applicant login
- Applicant ID
- existing password
~~~

### After promotion

~~~text
Student login
- confirmed Student Number
- same existing password
~~~

Date of Birth is removed only from the Student authentication requirement. The DOB record remains available in the student's profile and may be used by future approved identity/recovery workflows if explicitly designed.

The change is intentionally bounded. Do not alter Admin, Panelist, Other-role authentication, JWT/session architecture, password hashing, or forgot-password behavior unless a direct regression requires a minimal compatibility fix.

## 10. Credential notification

The promotion notification must not claim that a new password was generated when no password mutation occurred.

Preferred message semantics:

~~~text
Your COR has been verified and your account is now a Student account.
Student Number: <confirmed number>
Sign in through the Student portal using your Student Number and your existing account password.
~~~

Do not email plaintext passwords.

## 11. Current-state corrections captured by this design

The implementation must reconcile these known current behaviors:

- `CorExtraction.suggestions` is currently null/unmapped.
- Admin COR verification currently asks for Student Number, Academic Year, and Semester manually.
- Student login currently accepts Student Number + optional/required DOB + Password across frontend/backend paths.
- Admin COR UI currently describes DOB/default-password credential behavior inconsistently.
- `credential_dispatch` currently includes a `default_password` variable based on last name even though promotion does not actually reset the stored password.
- current promotion assigns `residencyStartDate = new Date()`; this conflicts with the now-deferred residency policy and must not remain an implicit authority rule.

## 12. Out of scope

- OCR implementation
- continuing-semester COR uploads for already-enrolled Students
- Academic Year/Semester enrollment history
- residency maximum years or official residency start calculation
- Curriculum Checklist implementation
- subject-to-curriculum matching
- automatic grade/progress import
- redesign of Applicant registration
- general authentication rewrite
- Defense UI/UX or template output changes

## 13. Future Curriculum Checklist note

Curriculum Checklist is a separate Student-progress module. It is expected to model the complete program curriculum rather than simply mirror the current COR subject table.

The current working assumption that `Thesis 1` may correspond to Title Defense and `Thesis 2` may cover Proposal/Final Defense is not an authoritative institutional rule. It must not be hard-coded until the client confirms the mapping.

## 14. Acceptance criteria

The branch is ready for acceptance when all of the following are demonstrated:

1. A supported native-text EARIST COR yields suggestions for Student Number, Registration Number, Name, Program, College, and Email.
2. Partial/missing suggestions do not invalidate an otherwise valid upload.
3. Admin sees the actual COR and suggestions together and can correct values.
4. Academic Year, Semester, Curriculum Year, residency, and subjects are not used by this v1 promotion form.
5. No extraction result can promote an Applicant without Admin verification.
6. Admin confirmation persists the Student Number and performs the existing atomic `APPLICANT -> STUDENT` transition.
7. The same User/password is retained.
8. Applicant login fails after promotion.
9. Student login succeeds with Student Number + existing password, without DOB.
10. DOB remains stored as profile data.
11. Credential messaging does not send or invent a default password.
12. Promotion no longer establishes residency start from the Admin verification timestamp.
13. Existing Admin/Panelist/Other login behavior remains unchanged.
