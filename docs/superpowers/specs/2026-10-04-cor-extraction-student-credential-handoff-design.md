# COR Extraction and Student Credential Handoff — Design

**Date:** 2026-10-04  
**Branch:** `workflow/cor-extraction-autofill`  
**Base:** `workflow/title-defense` @ `cfbf4a69fb5ebec1117e1615192f546969651938`  
**Status:** Approved implementation design, revised 2026-10-05 to make Admin-confirmed COR identity/enrollment data authoritative at promotion.  
**Scope:** Applicant COR extraction, Admin-assisted verification, authoritative COR-to-Student profile synchronization, Applicant-to-Student promotion, and the directly related Student login credential handoff.

> **2026-10-05 authority correction:** This revision supersedes the earlier v1 rule that COR Name, Email, and Program were comparison-only and must not overwrite Applicant data. Applicant-entered identity/enrollment data is provisional. The actual uploaded COR remains the evidence of record; extraction remains suggestion-only; after Admin reviews the actual COR and confirms/corrects the values, the Admin-confirmed COR Name, Email, Program, Student Number, and Registration Number become the authoritative values used by the promotion transaction. College is not part of the active verification contract.

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
  -> Admin compares suggestions with the actual COR and provisional Applicant record
  -> Admin confirms/corrects the COR-derived values
  -> one transaction verifies COR, synchronizes authoritative Student profile data, and promotes account
  -> STUDENT
~~~

Extraction is assistive only. A successful parser result never has promotion authority. Applicant-entered Name, Email, and Program remain provisional until the COR is verified. The Admin-confirmed COR values—not the raw parser output—become authoritative during the verified promotion transaction.

## 3. Authority rules

1. Admin verification remains mandatory.
2. The actual uploaded COR remains the evidence of record.
3. Extraction is suggestion-only. Raw parser output never writes authoritative profile data and never promotes an Applicant.
4. Applicant-entered Name, Email, and Program are provisional admission data until COR verification.
5. Admin reviews the actual COR and may correct extraction suggestions before verification.
6. Only Admin-confirmed COR values enter the authoritative promotion transaction.
7. After verification, the confirmed COR Name becomes the authoritative `User.firstName` / `User.lastName` identity for this workflow.
8. After verification, the confirmed COR Email becomes the authoritative `User.email`.
9. After verification, the confirmed COR Program becomes the authoritative `Student.programId`, but only by resolving to an existing `Program`; the workflow must not auto-create or fuzzy-guess a Program.
10. `Student.studentNumber` becomes authoritative only after verification.
11. Registration Number is stored with the verified COR record/reference.
12. College is not part of the active authoritative COR verification contract and must not drive Student profile persistence.
13. Promotion keeps the same `User` account and password; it changes the role from `APPLICANT` to `STUDENT`.
14. Applicant login must no longer work after promotion.
15. Student login must work using the confirmed Student Number and the existing password.
16. Date of Birth remains profile data but is not a normal Student login credential.
17. Existing Applicant ID and Entrance Exam records remain historical admission evidence; COR synchronization must not rewrite that history.

## 4. First supported EARIST COR field contract

### 4.1 Extract and present for Admin confirmation

| Field | Parser output | Admin use | Authoritative effect after confirmation |
|---|---|---|---|
| Student Number | string | editable confirmation | saved to `Student.studentNumber`; becomes Student login identifier |
| Registration Number | string | editable confirmation | stored with the verified COR record/reference |
| Student Name | raw + parsed components | editable/confirmable identity review | confirmed surname -> `User.lastName`; confirmed first name plus middle name/initial -> `User.firstName` |
| Program | string | comparison + existing-Program resolution | confirmed value resolves to an existing `Program` and updates `Student.programId` |
| Email Address | string | editable/confirmable identity review | confirmed value updates `User.email` |

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
- During Admin confirmation, map the verified COR surname to `User.lastName`.
- For the current schema, map the verified COR first name plus any middle name/initial to `User.firstName`.
- The current parser does not authoritatively model suffix; do not invent or infer a suffix as part of this correction.

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
  emailAddress
}
~~~

College is no longer part of the active verification/review contract. Existing parser/type compatibility may temporarily retain a legacy `college` suggestion, but no Admin verification UI or authoritative persistence may depend on it; a later cleanup may remove that inert field if doing so is worthwhile.

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
Identity / enrollment review
Field     Current Applicant data   Confirmed COR value   Status
Name      provisional value        [ editable ]           Match | Different | No existing data | Not extracted
Email     provisional value        [ editable ]           Match | Different | No existing data | Not extracted
Program   provisional value        [ existing Program ]   Match | Different | No existing data | Not extracted

Student credentials
Student Number       [ extracted suggestion, editable ]
Registration Number  [ extracted suggestion, editable ]
~~~

Status semantics:

- **Match** — normalized Applicant and COR values agree.
- **Different** — they differ; after Admin confirmation, the confirmed COR value replaces the provisional Applicant value.
- **No existing data** — the Applicant record has no comparable value and the COR supplies one.
- **Not extracted** — extraction did not produce a reliable value; Admin must inspect the actual COR and provide/confirm the required value before verification.
- These statuses are review aids only. They never auto-reject, auto-promote, or write data.
- Red/destructive styling is reserved for actual validation or verification errors, not ordinary COR differences.

The actual COR document must remain visible/openable during review. Name, Email, and Program confirmation must be explicit human review steps. Program confirmation must resolve to an existing Program record; if no unique safe mapping exists, the Admin must select the correct existing Program while viewing the COR.

College is not shown as a comparison row and is not part of the promotion form.

The current Academic Year and Semester verification fields are removed from this v1 Admin promotion form.

## 8. Verified promotion transaction

The existing transactional `verifyAndPromote` authority pattern remains canonical.

The transaction must continue to fail closed unless:

- the supplied COR is the student's current `PENDING` submission
- the Student admission state is exactly `APPLICANT`
- the linked User role is exactly `APPLICANT`
- the required Entrance Examination gate is passed
- the Admin-confirmed Student Number is present and valid for persistence
- the Admin-confirmed COR Name is present and safely parseable into the current User name fields
- the Admin-confirmed COR Email passes the existing email validation and is not owned by another User
- the Admin-confirmed COR Program resolves to exactly one existing `Program` selected/confirmed by the Admin

The same transaction should atomically:

- mark the exact COR submission `VERIFIED`
- persist the confirmed COR record/reference data
- assign the confirmed Student Number
- update `User.firstName` / `User.lastName` from the Admin-confirmed COR Name
- update `User.email` from the Admin-confirmed COR Email
- update `Student.programId` to the Admin-confirmed existing Program
- set the admission state to the accepted enrolled/student state
- change `User.role` from `APPLICANT` to `STUDENT`
- write the audit record

Conflict behavior:

- If the confirmed email is already owned by another User, verification must fail with a controlled conflict and the whole transaction must roll back.
- If the COR Program cannot be mapped/selected to one existing Program, verification must stop; never create a Program automatically and never fuzzy-guess one.
- A difference between provisional Applicant data and the confirmed COR is not itself an error; it is the expected synchronization case.

It must not:

- create a second User account
- reset or replace the password
- derive residency start from verification time
- write Name, Email, or Program from raw extraction without Admin confirmation
- rewrite historical Applicant ID or Entrance Exam records
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

After a successful promotion, send the credential notification to the **Admin-confirmed COR email address**, because that email has become the authoritative `User.email`. Do not send the handoff notification to a stale provisional Applicant email when the two differ.

## 11. Current-state corrections captured by this design

The implementation must reconcile these known current behaviors:

- `CorExtraction.suggestions` is currently null/unmapped.
- Admin COR verification currently asks for Student Number, Academic Year, and Semester manually.
- Student login currently accepts Student Number + optional/required DOB + Password across frontend/backend paths.
- Admin COR UI currently describes DOB/default-password credential behavior inconsistently.
- `credential_dispatch` currently includes a `default_password` variable based on last name even though promotion does not actually reset the stored password.
- current promotion assigns `residencyStartDate = new Date()`; this conflicts with the now-deferred residency policy and must not remain an implicit authority rule.
- **Post-COR-8 correction:** the accepted implementation currently keeps Applicant Name, Email, and Program after promotion. That behavior is now superseded. These fields must be synchronized from Admin-confirmed COR values during the canonical promotion transaction.
- **Post-COR-8 correction:** the current Admin comparison UI treats COR identity values as comparison-only and shows College. The revised workflow must instead support explicit confirmation of Name, Email, and Program, remove College from the active review workflow, and show Match/Different/No existing data/Not extracted status aids.
- **Post-COR-8 correction:** the current notification path uses the pre-promotion Applicant email object. After authoritative email synchronization, the handoff notification must target the confirmed COR email.

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

1. A supported native-text EARIST COR yields suggestions for Student Number, Registration Number, Name, Program, and Email.
2. College does not participate in the active Admin verification or authoritative Student profile synchronization.
3. Partial/missing suggestions do not invalidate an otherwise valid upload; missing required confirmation values are resolved by Admin review of the actual COR.
4. Admin sees the actual COR, provisional Applicant values, COR suggestions, and explicit confirmation controls together.
5. Name, Email, and Program rows show clear Match / Different / No existing data / Not extracted review status without auto-rejection.
6. Academic Year, Semester, Curriculum Year, residency, and subjects are not used by this v1 promotion form.
7. No extraction result can promote or overwrite an Applicant without Admin verification.
8. Admin confirmation atomically persists Student Number and Registration Number, synchronizes confirmed COR Name/Email/Program, and performs the `APPLICANT -> STUDENT` transition.
9. A duplicate confirmed email fails closed and rolls back the transaction.
10. Program synchronization uses an existing Program only; ambiguous/missing mapping blocks verification and never creates or fuzzy-guesses a Program.
11. The same User/password is retained.
12. The credential notification is sent to the confirmed COR email and contains no generated/default/plaintext password.
13. Applicant login fails after promotion.
14. Student login succeeds with Student Number + existing password, without DOB.
15. DOB remains stored as profile data.
16. Promotion does not establish residency start from the Admin verification timestamp.
17. Existing Applicant ID / Entrance Exam history and Admin/Panelist/Other login behavior remain unchanged.

## 15. Supersession and COR-9 pause

This 2026-10-05 authority correction is newer than the original comparison-only v1 rule. Where older COR-1 through COR-8 documentation, comments, tests, or UI copy conflict with this section for Name, Email, Program, College, or notification recipient, this revised design is authoritative for subsequent work.

COR-9 manual end-to-end acceptance is paused until the authority synchronization, Admin review UX, and regression corrections defined in the implementation plan are implemented and accepted.
