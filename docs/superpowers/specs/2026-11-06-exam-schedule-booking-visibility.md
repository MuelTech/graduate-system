# EXAM-SCHEDULE-BOOKINGS-1 — Exam Schedule Booking Visibility

**Status:** DOCUMENTED — IMPLEMENTATION NOT YET STARTED  
**Date:** 2026-11-06  
**Branch:** `feat/exam-schedule-booking-visibility`  
**Verified base `main`:** `3a456567a7469c4cdc0ac69c012fdf2e79ee6a4c`

## 1. Purpose

After acceptance and merge of the Phase B core Entrance Examination scope, the
project owner identified a bounded Admin usability gap on **Entrance Exam
Schedules**:

- the schedule list shows booked capacity such as `2 / 5 booked`;
- the Admin cannot directly see which Applicants occupy those booked seats;
- the Admin cannot directly confirm when the booking/application record was
  created for that schedule.

This package adds **read-only booking visibility** to the existing Exam Schedule
management surface. It does not reopen the accepted Phase B scheduling rules.

## 2. Verified current state

The current Admin schedule table presents:

```text
Program | Schedule | Capacity | Availability | Action
```

Capacity is summarized from the authoritative schedule state, for example:

```text
2 / 5 booked
3 seats available
```

The current `GET /exam/slots` projection returns schedule/program/count data but
does not include Applicant identity for each booking.

Authoritative booking/application records already exist in
`EntranceExamApplication`. Relevant existing evidence includes:

- `id` — Exam Record / examination application identifier;
- `studentId`;
- `slotId`;
- `status`;
- `createdAt`;
- `seatReleasedAt`;
- Student/User identity;
- Student `pinnacleApplicantId`.

No schema change is expected for the target visibility.

## 3. User question this package must answer

From one schedule row, an Admin should be able to answer:

> Who is currently booked into this schedule, and when was each booking record
> created?

This is an operational lookup only. It does not grant new scheduling authority.

## 4. Target presentation

Keep the accepted schedule-management list compact. Do **not** place multiple
Applicant names directly into the main table.

Preferred capacity presentation:

```text
2 / 5 booked
3 seats available
View bookings
```

`View bookings` is a secondary action associated with Capacity, not a competing
primary row action. The existing **Edit** action remains the schedule-management
action in the Action column.

Opening `View bookings` should show a focused dialog or equivalent secondary
detail surface for the selected schedule.

For each current booking, show only operationally useful fields:

- Applicant name;
- Pinnacle Applicant ID;
- **Booking recorded** date/time;
- current Exam State;
- **View Exam Record** navigation.

The detail surface should also identify the selected Program and schedule
date/time so the Admin always knows which schedule is being inspected.

## 5. Meaning of “Booking recorded”

Use `EntranceExamApplication.createdAt` as the authoritative timestamp for
**Booking recorded**.

This label is intentionally neutral.

Do **not** label the timestamp as:

- “Applicant booked at”;
- “Self-booked at”;
- “Assigned by Admin at”;

because the current application record does not by itself prove which actor
initiated the booking.

Display ordinary date/time in **Philippine Time (Asia/Manila)** consistently with
the accepted Exam UI timezone convention.

## 6. Current seats vs historical/released records

The primary booking list must represent **current seat holders** for the schedule.

Current seat holder:

```text
seatReleasedAt === null
```

This keeps `View bookings` aligned with the schedule's current occupied-seat
semantics and prevents released/rescheduled historical applications from being
presented as current occupants.

If implementation chooses to expose historical/released records, they must be:

- visually separated from current bookings;
- clearly identified as no longer occupying a seat;
- excluded from the current booked-seat count.

Historical visibility is optional for this first package and must not expand the
scope unnecessarily.

## 7. Read-model boundary

A bounded **ADMIN-only read model** may be added because all required facts
already exist authoritatively.

Preferred architecture:

```text
Entrance Exam Schedules
        ↓
schedule summary remains compact
        ↓
View bookings
        ↓
ADMIN-only schedule-bookings read model
        ↓
current seat-holder identity + booking timestamp + exam state + record id
```

Do not overload the existing full schedule list with large Applicant arrays if a
focused per-schedule read is clearer and cheaper.

The read model should expose only fields required by this UI. It must not expose:

- answers;
- correct-answer data;
- scores not needed for Exam State;
- private exam content;
- authentication/internal authorization details;
- unrelated Student profile data.

Deterministic ordering should be used, preferably `createdAt` then application
`id`.

## 8. Protected behavior — must not change

This package must not change:

- Program matching;
- schedule wall-clock semantics;
- `Asia/Manila` scheduling authority;
- `maxSlots` / `slotsTaken` rules;
- capacity consistency checks;
- booking atomicity/locking;
- same-day Admin assignment rules;
- Applicant self-booking rules;
- alignment/waiver clearance rules;
- blocking examination-record rules;
- seat release/reschedule behavior;
- Start Now authorization;
- actual exam start/deadline authority;
- scoring, essay evaluation, reconsideration or results;
- Email Integration.

No capacity override or reconciliation action is introduced.

## 9. Explicitly out of scope

The following owner idea is deliberately deferred to a separate functional
package:

```text
Assign Applicant
→ Create Schedule
→ Create & Assign
```

EXAM-SCHEDULE-BOOKINGS-1 must not create schedules, silently auto-create
schedules, or change the accepted assignment workflow.

Also out of scope:

- actor provenance for self-booking vs Admin assignment unless an existing
  authoritative source is independently proven;
- schema changes for booking source/provenance;
- bulk attendance/check-in behavior;
- editing Applicants from the booking viewer;
- moving/rescheduling an Applicant from the booking viewer.

## 10. Expected implementation surfaces

Implementation should inspect the live branch before editing, but likely bounded
surfaces include:

Backend:

- `backend/src/repositories/exam.repository.ts`;
- `backend/src/services/exam.service.ts`;
- existing Exam route/controller files;
- focused unit/contract tests for the new Admin read projection.

Frontend:

- `frontend/src/app/(portal)/admin/exam/slots/page.tsx`;
- `frontend/src/types/index.ts` or a more local typed projection;
- focused schedule UI contract tests/helpers as appropriate.

Avoid unrelated cleanup.

## 11. Acceptance criteria

Automated/source acceptance should prove:

1. Admin can open booking details for a specific schedule.
2. Only bookings for that exact schedule are returned.
3. Primary list represents current seat holders only.
4. Applicant name and Pinnacle Applicant ID are authoritative.
5. `Booking recorded` comes from `EntranceExamApplication.createdAt`.
6. Current Exam State is rendered from authoritative application state, not
   recomputed from the browser clock.
7. **View Exam Record** targets the correct application ID.
8. Empty schedule state is truthful and concise.
9. Released/rescheduled records are not counted as current occupants.
10. Existing schedule capacity, booking, assignment and lifecycle mutations are
    unchanged.
11. Read model is ADMIN-only and data-minimized.
12. Desktop/narrow/dialog presentation remains readable and keyboard-usable.
13. Email Integration remains untouched.

## 12. Verification strategy

Use the smallest test set that proves the changed risk.

Expected focused verification:

- new backend service/repository/route contract tests;
- focused Admin schedule UI contract tests;
- frontend `npx tsc --noEmit`;
- scoped ESLint for changed frontend files;
- `git diff --check`;
- production build only if composition/routing changes make it useful.

Real-database contention suites are not required for a read-only projection
unless implementation unexpectedly changes scheduling writes or transaction
semantics. If that happens, stop and report scope expansion instead of silently
continuing.

Independent remote source/diff review remains required after implementation.
Project-owner browser/manual/visual QA remains a separate final gate.

## 13. Package boundary

This is a **post-Phase-B bounded usability follow-up**. It does not invalidate or
reopen the accepted Phase B core Exam scope merged by PR #47.

Implementation must stop after EXAM-SCHEDULE-BOOKINGS-1 and must not continue into
`Create & Assign`, Email Integration, or another Exam package without explicit
project-owner authorization.
