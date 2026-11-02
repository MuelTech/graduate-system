# Exam Admission and Same-Day Start — Owner Clarifications

**Date:** 2026-11-02

**Repository:** `MuelTech/graduate-system`

**Branch:** `feat/exam-engine-scheduling`

**Documentation baseline:** `a88abadcb250dad9ece4f808244e104167cb39c2`

**Status:** OWNER-CLARIFIED / DOCUMENTED ONLY — NO IMPLEMENTATION IN THIS REPORT

## 1. Applicant registration ownership

- Applicants create their own GS-IS accounts through the existing self-registration flow.
- An existing EARIST Pinnacle Applicant ID is required before GS-IS registration.
- Graduate School staff do not create, provision, or issue GS-IS Applicant accounts or passwords.
- The Applicant may use their own device to complete registration. Staff may guide the Applicant, but account creation remains self-service.
- Pinnacle remains the source of the prerequisite Applicant ID; GS-IS remains a separate system and does not add a staff-created-account pathway.

## 2. Preserve normal appointment scheduling

- Existing B3 Applicant self-booking remains unchanged.
- The selected ExamSlot date/time remains the original appointment record.
- Normal Applicants follow their booked appointment unless an authorized same-day exception is granted for that exact application.
- Do not globally change an ExamSlot, alter its scheduled time, or affect other Applicants sharing the slot.

## 3. B3 follow-up — Admin same-day schedule assignment

This is a bounded follow-up within B3, not a new package family and not a separate walk-in application model.

For a registered Applicant who has no examination booking/application:

1. Admin finds the existing Applicant record.
2. Admin assigns an existing active ExamSlot for the current Asia/Manila calendar date.
3. The slot's scheduled wall-clock time may be earlier than the current time; this exception is available only through the Admin assignment operation.
4. The assignment must preserve the exact Student/Program match, ALIGNED/CLEARED eligibility, existing blocking-application rules, active-slot requirement, reconciled capacity counter, remaining capacity, Student → Slot transaction locking, and atomic capacity/application writes.
5. The original slot date/time and active state remain unchanged.
6. If the slot is closed, full, inconsistent, belongs to another Program, or is on another date, the assignment fails closed. No overbooking, fake slot, capacity bypass, or historical slot rewrite is allowed.
7. After assignment, B4's per-application Start Now authorization may be used for immediate same-day start.

Ordinary Applicant self-booking continues to reject past schedule times. This exception is Admin-only and does not alter the accepted B3 self-booking behavior.

## 4. B4 — Per-Applicant Start Now authorization and actual timer

For an Applicant who already has a booking:

- Admin may authorize the exact application to start before or after its scheduled wall-clock time when the Applicant is present on that same Asia/Manila calendar date.
- No new booking or slot reassignment is needed.
- The original appointment remains unchanged.

For an Applicant assigned through the B3 follow-up:

- Admin first assigns the existing same-day slot under the B3 safeguards.
- Admin then authorizes Start Now for that exact application.

Common rules:

- Only ADMIN may grant the per-application authorization.
- Authorization bypasses only the scheduled-time start gate for the same Manila calendar date.
- Authorization records the responsible Admin and authorization timestamp.
- Authorization does not start the timer. The Applicant initiates Start Examination when ready.
- The server records the actual successful start timestamp.
- The individual deadline is actual server start plus the valid B1-configured duration.
- No shared examination-day deadline based on school closing is introduced. Do not restore a hard-coded three-hour duration or invent a grace period.
- Applicant ownership, authentication, Program, alignment, blocking status, active-slot/capacity safeguards, immutable content binding, answer integrity, and result protections remain mandatory.

## 5. Different-date missed examinations

- The same-day assignment/Start Now exception cannot move an Applicant to another Manila calendar date.
- A missed appointment on a different date follows B9's controlled appeal/rescheduling process.
- Preserve the original application, booking, attempt, answers and result history.
- A missed appointment is not automatically a FAILED examination result.
- Seat release/retention and period/reset/retake rules remain unresolved under PD-5 and must not be guessed.

## 6. Explicit non-goals

- No B3W package.
- No separate WALK_IN account, Applicant type, or application source model.
- No staff-created Applicant accounts or staff-generated credentials.
- No nullable slot or fake appointment to represent a walk-in.
- No global schedule-time bypass or shared-slot modification.
- No capacity, Program, alignment, blocking-status, active-state, or identity bypass.
- No same-day exception for a different calendar date.
- No new school-closing deadline or fixed duration.
- No change to the accepted B3 baseline implementation in this documentation-only update.

## 7. Documentation and implementation sequence

1. The original B3 baseline remains accepted.
2. Implement and independently review the bounded B3 same-day Admin schedule-assignment follow-up.
3. Then implement B4 per-Applicant Start Now authorization, server-owned actual start, and individual configured-duration timer.
4. B9 remains responsible for different-date missed-exam appeals, rescheduling, and historical booking preservation.

Exact UI placement for assigning an Applicant who has no Exam Record yet remains subject to the existing Admin Applicants/Profile and Exam Records UI/UX ownership patterns. No new sidebar destination is approved. The pending UI follow-up is recorded in `docs/superpowers/ui-ux/UI_UX_AUDIT.md`; the accepted UIUX-2D/2E reference is not changed.

PD-5 examination-period identity, one-attempt-per-period, reset/retake, different-date appeal authority, and seat-release/retention remain unresolved.

**This report records owner clarifications only. It does not implement B3 follow-up or B4, accept any new UI, or authorize automatic progression.**