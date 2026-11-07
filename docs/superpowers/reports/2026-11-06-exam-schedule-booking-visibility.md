# EXAM-SCHEDULE-BOOKINGS-1 — Exam Schedule Booking Visibility

Date: 2026-11-06 (Asia/Manila).

**ACCEPTED — INDEPENDENT REMOTE REVIEW PASS; PROJECT-OWNER FUNCTIONAL/MANUAL + VISUAL QA PASS — 2026-11-07.**

## Verified starting state

- Repository: `MuelTech/graduate-system`.
- Existing branch: `feat/exam-schedule-booking-visibility`.
- Starting live remote / checked-out HEAD:
  `80eb7c8290443440926a09acf38e48e30fe439e5`.
- Verified local/live `main`: `3a456567a7469c4cdc0ac69c012fdf2e79ee6a4c`.
- The workspace initially had clean `main` checked out. Fetched and checked out
  the existing remote feature branch as its local tracking branch; no additional
  feature branch was created. No merge/rebase/reset/history rewrite/force push or
  main modification. The implementation commit and final live/tracking state
  are supplied in delivery, avoiding a self-referential commit hash here.

Read the package specification, checklist, canonical copy guidance, UI/UX
playbook/audit and accepted B3 admission/same-day-assignment reports. Inspected
actual repository/service/controller/routes/JWT-role middleware, Admin schedules,
types, shared Exam State helper/badge and Dialog/tooltip/button/time patterns.
Applied installed Next.js and React guidance to the bounded frontend changes.

## API / minimized read model

`GET /api/exam/slots/:id/bookings` (frontend API client path
`/exam/slots/:id/bookings`) requires existing `authenticateJWT` and exact
`requireRole(['ADMIN'])`. No Applicant or other role gains access. No writes,
locks, capacity reads/reconciliation or scheduling authority are introduced.

The service validates the existing bounded schedule UUID contract. The repository
reads the exact `ExamSlot.id` and its applications with `seatReleasedAt: null`,
ordered by `createdAt ASC`, then application `id ASC`. Released history and
other-slot rows cannot appear in the selected relation. An existing schedule
with no current occupants returns `[]`; a missing schedule returns 404. Invalid
IDs return 400. Unexpected failures return a generic 500. Responses set
`Cache-Control: private, no-store`.

Successful response shape:

```ts
Array<{
  id: string;                 // EntranceExamApplication / Exam Record ID
  status: string;             // persisted application status
  createdAt: string;          // application createdAt serialized as ISO
  essayEvaluationCompleted: boolean;
  reconsidered: boolean;
  student: {
    pinnacleApplicantId: string | null;
    user: { firstName: string; lastName: string };
  };
}>
```

The two booleans are necessary presentation facts for the existing
`deriveExamState` helper: TAKEN may have completed essay evaluation while the
final result is pending; FAILED may carry a validated institutional pass decision.
The completion predicate matches the existing Exam Records list. Reconsideration
uses the existing `hasEffectiveExamPass` validator; incomplete evidence does not
fabricate a pass. These flags grant no grading/result/assignment authority.

Evaluation/result/configuration/decision evidence needed for those flags is
selected server-side and discarded before return. No scores, evaluator/decider
identity, justification, internal execution configuration or finalization evidence
is exposed. No answers, correct-answer data, questions/content, private media,
account credentials, unrelated Student fields or Email Integration information
is selected by the new read path. The existing all-schedules response is unchanged.

## Page-specific design and copy pass

- **Actor/task:** Admin inspecting who currently occupies one schedule and when
  each application record was created. The primary page task remains schedule
  management. Table hierarchy remains Program | Schedule | Capacity |
  Availability | Action; Applicant names have no home in that table.
- **Action ownership:** Users sits with the unchanged booked/available summary
  in Capacity, including when capacity is unavailable. Pencil stays in Action
  and calls the unchanged edit handler. Shared `IconTooltipButton` supplies
  matching tooltip/aria-label values **View bookings** / **Edit schedule** and
  visible keyboard focus. No generic action cluster or repeated visible labels.
- **Detail hierarchy:** one Dialog header identifies Program/date/start time;
  each semantic booking list row contains name/Pinnacle ID, Booking recorded,
  Exam State and View Exam Record. The latter links to
  `/admin/exam/applications/{applicationId}`. Schedule context is not repeated
  per occupant. Booking timestamps are formatted authoritatively in
  `Asia/Manila` without repeating a visible timezone caption.
- **Time/state authority:** Booking recorded is the application's `createdAt`,
  formatted by the existing `examinationTimestamp` helper with explicit
  `Asia/Manila`. Schedule date/time retains the accepted wall-clock helpers.
  State uses the shared `deriveExamState` / `ExamStateBadge`; no browser clock
  classifies an application's state and no new state is invented.
- **Async ownership:** the selected slot owns a keyed query in a conditionally
  mounted list. No booking request is made by a closed viewer; per-slot keys,
  zero cache retention and loading while fetching avoid showing another or an
  earlier occupancy snapshot. Errors show Retry; empty reads show exactly
  **No current bookings for this schedule.** Query state never overwrites capacity.
- **Narrow/readability pass:** single-column rows stack on narrow widths and use
  two metadata columns on wider layouts. Names/IDs/context use safe wrapping;
  badges wrap with automatic height. The dialog has a viewport-height limit and
  scrolling. The existing main table keeps its horizontal-scroll behavior.
- **Keyboard/dismissal:** shared Dialog focus management and close control are
  retained. The clicked Users button is captured as an explicit `finalFocus`
  target. Escape/close remain available during read pending/error/empty states;
  there is no mutation to protect from dismissal. Structural/contract checks
  verify this wiring, not a runtime browser-focus result.
- **Copy gate:** approved neutral Booking recorded, canonical Exam State terms,
  concise loading/error/empty wording, one home for context, no booking-source
  attribution, internal-workflow narration or role-confusing escalation. No
  extra confirmation is introduced for a read-only action.

## Protected behavior / scope evidence

**No schema migration was added. No scheduling write, capacity, assignment,
booking, seat-release or historical-record behavior changed.** No genuine
capacity-integrity defect was discovered requiring scope expansion. The viewer
does not compare or repair `slotsTaken` from its booking-row count.

An AST-assisted comparison against the verified starting commit, normalizing
line endings, confirmed **65 existing backend class members unchanged** across
the repository/service/controller and **9 existing frontend mutation, guard and
handler declarations unchanged** (save/toggle mutations, booked/past guards,
submit/toggle/edit/close handlers). Only new read methods and the single GET
route were added in backend source. Existing focused scheduling regressions pass.

Program matching, Manila scheduling authority/wall clocks, capacity integrity,
reconciliation, admission transactions/locks, self-booking, same-day assignment,
clearance/blocking records, releases/reschedules, Start Now/Applicant Start,
actual-start/deadline authority, autosave/finalization, essay grading, scoring,
results/reconsideration and Email Integration remain unchanged.

No Create & Assign, silent schedule creation, booking actor/provenance fields,
attendance, Applicant edits, rescheduling or bulk actions were implemented.

## Verification

Focused automated run: **6 files / 165 tests PASS**, no failures/skips:

```powershell
# backend
npm test -- tests/unit/routes/exam-slot-bookings.routes.test.ts tests/unit/services/exam-slot-bookings-ui.contract.test.ts tests/unit/routes/exam-schedule.routes.test.ts tests/unit/services/exam-schedule.service.test.ts tests/unit/services/exam-schedule-ui.contract.test.ts tests/unit/repositories/exam-record.repository.test.ts
npx tsc --noEmit

# frontend
npx tsc --noEmit
npx eslint 'src/app/(portal)/admin/exam/slots/page.tsx' 'src/components/admin/exam/schedule-bookings-dialog.tsx' 'src/types/index.ts'
npm run build

# repository
git diff --check
```

The new HTTP tests exercise actual JWT/role middleware, router, controller,
service and repository against a mocked Prisma read boundary. They verify exact
slot/released filters and deterministic query ordering, identity/createdAt/id
allowlists, unauthenticated/invalid-token/non-Admin denial before any read,
empty/missing/malformed/error cases, completed/partial evaluation evidence and
validated/invalid reconsideration. These are query-contract tests, not live DB
or concurrent execution evidence.

Frontend tests reuse the existing transpiled-JSX/controlled-hooks/static-render
infrastructure. They verify actual shared tooltip labels/accessibility/focus
classes, capacity association, Pencil/edit behavior, selected dialog context,
query isolation/encoding, close/focus wiring, all required row facts and exact
navigation, Manila timestamp rendering under UTC/Manila/Los Angeles host zones,
canonical states, pending/refetch/error/retry/empty behavior, unchanged mutation
bodies/guards and responsive wrapping/scrolling markup. They do not establish
browser layout, keyboard-focus or visual acceptance.

- Backend TypeScript: **PASS**.
- Frontend TypeScript: **PASS**.
- Scoped frontend ESLint: **PASS**, no findings.
- Frontend production build: **PASS**, 68 pages generated. Executed because this
  package adds a client Dialog/query/Link composition. Existing middleware and
  Node module-registration deprecation notices were nonblocking.
- `git diff --check`: **PASS**.
- No schema validation/migration, real-DB contention suites or full Phase B
  matrix was run; this package changes only a read projection and its viewer.
- Hosted CI: **NOT CLAIMED PASS**. Existing workflow triggers pushes to `main`
  or PRs targeting `main`, not a feature-branch-only push. No PR/workflow change
  is part of this package; final commit status is checked at delivery.

Manual/browser QA: NOT EXECUTED — PROJECT OWNER

Independent remote review: **PENDING — separate ChatGPT review required**.
No project-owner/manual/visual acceptance or Approved Reference status is claimed.

## Exact changed-file manifest

```text
backend/src/controllers/exam.controller.ts
backend/src/repositories/exam.repository.ts
backend/src/routes/exam.routes.ts
backend/src/services/exam.service.ts
backend/tests/unit/routes/exam-slot-bookings.routes.test.ts
backend/tests/unit/services/exam-slot-bookings-ui.contract.test.ts
frontend/src/app/(portal)/admin/exam/slots/page.tsx
frontend/src/components/admin/exam/schedule-bookings-dialog.tsx
frontend/src/types/index.ts
docs/superpowers/specs/2026-11-06-exam-schedule-booking-visibility.md
docs/superpowers/GSIS_IMPLEMENTATION_CHECKLIST.md
docs/superpowers/reports/2026-11-06-exam-schedule-booking-visibility.md
```

Commit/push only this package to the existing feature branch, verify live HEAD
and tracking state, then STOP. Create & Assign and all follow-up packages remain
outside this authorization.


## Owner-QA FIX-1 — 2026-11-07

Independent remote source/diff review of the initial implementation: **PASS**.

Project-owner browser QA identified one bounded presentation issue: the dialog's
visible **Philippine Time (Asia/Manila)** caption was redundant.

FIX-1 changes only that frontend copy plus its focused UI contract/documentation:

- the visible timezone caption is removed from the dialog;
- the original icon-only Users / **View bookings** control design is preserved
  unchanged, including its tooltip, `aria-label`, keyboard focus and
  return-focus behavior;
- `Booking recorded` still uses the unchanged `examinationTimestamp()`
  formatter, which explicitly formats in `Asia/Manila`;
- no backend/API/read-model/schema/capacity/assignment/scheduling mutation or
  Email Integration behavior changes.

Focused UI contract source was updated to require absence of the visible timezone
caption and continued Manila timestamp output across host timezones. This ChatGPT
GitHub-connector correction did **not** execute the test suite locally, so no new
automated PASS is claimed for FIX-1.

Project-owner browser recheck: **PASS — 2026-11-07**. Final package acceptance:
**PASS / ACCEPTED FOR MERGE**.


## Final acceptance — 2026-11-07

Final accepted source state before this documentation-only closure:
`297e598084c44dabf4d767046f1e2995beb305c8`.

Independent remote review of the implementation: **PASS**.

After the bounded FIX-1 removed the redundant visible timezone caption, the
project owner completed the final browser recheck and accepted both the
functionality and visual result:

- project-owner functional/manual QA: **PASS**;
- project-owner visual/UI QA: **PASS**;
- EXAM-SCHEDULE-BOOKINGS-1: **ACCEPTED FOR MERGE**.

No new automated FIX-1 PASS is claimed because the final copy-only source
correction was applied through the ChatGPT GitHub connector rather than a local
command-running environment. The previously reported implementation verification
remains historical evidence and the final owner browser recheck closes the
presentation gate.

The future **Create & Assign** workflow remains explicitly **DEFERRED** as a
separate functional package. It is not included in this branch's accepted scope.
