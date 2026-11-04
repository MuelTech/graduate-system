# EXAM-B9 Owner Policy Clarification — Schedule Amendments, Missed Appeals and Result Reconsideration

Date: 2026-11-05, Asia/Manila.

This clarification authorizes the bounded EXAM-B9 implementation only. It does not authorize B10 and does not establish production readiness.

## 1. No retake/period subsystem in B9

B9 does not introduce ExamPeriod, retake counters, reset attempts or a generic second-attempt policy.

A schedule amendment is only a replacement/cancellation of a **never-started** appointment. A computed FAILED examination is not rescheduled by the appointment workflow. A rejected missed-exam appeal is not an automatic permission to self-book again.

For booking/admission protection:
- PENDING, APPROVED, TAKEN, PASSED, FAILED, APPEALED, MISSED and DISQUALIFIED remain blocking;
- RESCHEDULED and CANCELLED are historical non-blocking schedule outcomes;
- a valid PASSED — RECONSIDERED decision is also an effective pass/blocking outcome.

## 2. Seat ownership and history

Never rewrite the original application's `slotId`, `examDate` or `examTime` to represent a reschedule.

Introduce explicit one-time seat-release evidence on the old application (for example `seatReleasedAt`) and make B3/B9 capacity reconciliation count only applications whose seat remains owned.

Existing records start with null release evidence and therefore retain their current seat ownership until a legitimate B9 transition releases it.

A released seat must decrement the stored slot counter exactly once. A replacement application owns the new seat normally.

## 3. Applicant missed-exam appeal

The Applicant must target an exact owned application and provide a non-empty bounded reason.

Eligible only when:
- application status is PENDING or APPROVED;
- `actualStartedAt` is null;
- there is no B4 execution binding/deadline/content authority;
- there are no ApplicantAnswer rows;
- there is no score or B6 finalization evidence;
- the original appointment's **Asia/Manila calendar date is earlier than today's Asia/Manila date**.

The scheduled clock time passing on the same calendar date is not enough. Same-day late arrival remains the accepted B4 flow.

Filing the appeal:
- creates immutable/request evidence;
- changes the application to APPEALED;
- releases the stale past seat once;
- does not create a replacement application yet.

Duplicate/stale appeal requests reject.

## 4. Missed-appeal decision

Current active ADMIN is the bounded decision authority.

### Approve

Approval requires:
- the exact pending appeal;
- a required Admin decision reason;
- a selected active **future** slot;
- same Program as the Applicant/original application;
- available reconciled capacity.

Atomically:
- reserve the target seat;
- create a new PENDING application with the target slot's original date/time;
- mark the old application RESCHEDULED;
- mark/link the appeal APPROVED with target slot and replacement application;
- preserve every field on the old application that records its original appointment/history.

### Reject

Rejection requires a reason and atomically:
- marks the appeal REJECTED;
- marks the original application MISSED;
- creates no new application.

MISSED remains blocking; no automatic retry/rebooking policy is introduced.

## 5. Direct Admin cancellation/reschedule

Current active ADMIN may act on an exact never-started eligible application before execution exists.

A reason is required.

Cancellation:
- releases its seat exactly once;
- marks the application CANCELLED;
- records immutable amendment/audit evidence;
- creates no replacement application.

Reschedule:
- validates a future active same-Program target slot and capacity;
- releases the original seat and reserves the target seat atomically;
- creates a new PENDING application;
- marks the original RESCHEDULED;
- records old/new application and slot evidence.

Do not directly overwrite the old application's slot/date/time.

A pending Applicant missed appeal must be decided through the appeal workflow rather than bypassed by direct amendment.

## 6. Started/finalized protection

No B9 schedule mutation may operate when any attempt evidence exists, including:
- actual start/deadline/content/config binding;
- saved answers;
- score;
- finalization receipt/reason/time.

B4/B5/B6/B7/B8 evidence is immutable.

## 7. FAILED-result reconsideration

Current active ADMIN is the bounded authority for B9.

Eligible only when:
- the exact application is a **B8-managed** completed computed FAILED result;
- `validatedResultBasis` succeeds;
- application and score both remain FAILED;
- no prior reconsideration decision exists.

Legacy FAILED records without B8 provenance are not automatically eligible.

One successful action creates a separate immutable institutional decision:
- decision: `PASSED_RECONSIDERED`;
- required bounded reason;
- deciding Admin;
- decision timestamp;
- exact score/application linkage.

Do **not** edit:
- Applicant answers;
- MCQ/essay/total scores;
- passing threshold;
- scoring basis;
- `scoredAt`;
- original application status FAILED;
- original score status FAILED.

No PASSED→FAILED reconsideration, revoke, generic Mark Passed, regrade or score override is introduced.

## 8. Effective-result/downstream projection

After a valid reconsideration:
- the original computed result remains visibly FAILED;
- Admin and Applicant additionally see the institutional decision **PASSED — RECONSIDERED**;
- effective admission/COR eligibility treats the decision as a pass;
- scheduling treats the decision as a completed/pass outcome;
- Admin Applicant list/detail must use the same effective-pass authority.

The result breakdown must continue to show the original B8 scoring basis rather than relabeling the computation itself as PASSED.

## 9. Result-email boundary

Any result email already queued before reconsideration remains truthful historical evidence and is not deleted or rewritten.

After reconsideration, the existing generic B8 result-email action must not queue another email using the original computed FAILED template.

B9 does not invent a new reconsideration-specific email template. Portal/effective eligibility is authoritative; a future dedicated reconsideration notification may be separately authorized.

## 10. Audit/history

Prefer additive dedicated schedule-amendment/appeal and result-decision records because they carry domain state/history, not merely free-form logs.

Also write the existing AuditLog within the same transaction for approved/rejected/cancel/reschedule/reconsider operations.

No historical APPEALED/FAILED/DISQUALIFIED row is backfilled or guessed into the new B9 evidence model.
