# EC7E — Items Consolidation + Q40 Source Fidelity

Date: 2026-10-31

Repository: `MuelTech/graduate-system`

Branch: `feat/exam-content-integration`

## Context

EC7D passed independent review and simplified structured authoring to three
Admin-visible layouts. During resumed owner browser/source QA, the physical Q40
page demonstrated that the remaining `Numbered List` concept is not source-faithful.

Owner-verified Q40 source order:

1. `Assume that -`
2. `All As are Cs.`
3. `Some Ds are Cs.`
4. `No Bs are Cs.`
5. `We know that -`
6. answer choices

The three premise lines are vertically separated but have no numeric list markers.

The current canonical manifest instead has:

- questionText: `Assume that the following statements are true. We know that —`
- structured stimulus: three `LOGICAL_PREMISES` items

Because the shared question composition renders question text before the structured
stimulus, removing ordered-list markers alone would still leave Q40 out of source
order. EC7E must therefore correct both the Admin abstraction and canonical Q40
content representation.

## Scope

### 1. Admin structured authoring

Expose only two structured layouts:

- **Grid / Table**
- **Items**

Legacy mapping:

| Internal subtype | Admin layout |
| --- | --- |
| MATRIX | Grid / Table |
| GROUPED_NUMBER_ROWS | Grid / Table |
| WORD_BANK | Items |
| NUMBER_SEQUENCE | Items |
| ALPHANUMERIC_SEQUENCE | Items |
| WORD_SERIES | Items |
| LETTER_SEQUENCE | Items |
| LOGICAL_PREMISES | Items |

Do not remove or migrate the eight existing internal subtype values solely for
this UI simplification.

The visible per-cell Text/Number selector remains removed.

### 2. LOGICAL_PREMISES rendering

`LOGICAL_PREMISES` must render as plain vertically stacked textual lines with
no automatic numeric list markers.

Do not add a Q40-specific condition to the renderer.

Existing structured emphasis behavior for textual items must continue to work.

### 3. Canonical Q40 correction

Correct the canonical source package so Q40 follows the owner-verified physical
order.

Preferred bounded representation using the existing legacy shape:

- questionText contains only the leading prompt, `Assume that -`, using the
  project's established source punctuation normalization;
- `LOGICAL_PREMISES.items` contains the three premise lines followed by the
  trailing prompt `We know that -`;
- answer choices and correct answer remain unchanged.

This keeps the renderer generic: question text is rendered first, then the plain
stacked Items stimulus, then answer choices.

Do not create a renderer string-split special case and do not create a one-off Q40
database reconciler.

### 4. Source identity / re-import

Changing the canonical manifest changes the verified package identity.

Use the established clean development correction path rather than a one-off patch:

- update the canonical manifest;
- recompute/verify the corrected manifest SHA and package fingerprint;
- update any canonical import/source identity that must follow the manifest;
- because `olsat-emphasis.json` is bound to `manifestSha256`, update that binding
  only after proving all previously annotated target texts remain unchanged;
- re-run the emphasis preflight against the corrected package;
- perform the controlled clean development re-import if required by the importer
  identity model;
- reapply the already-reviewed emphasis map deterministically;
- verify repeat import/application idempotency.

No new semantic emphasis annotation should be invented for Q40 unless separately
verified from the physical source.

## Protected state

Do not change:

- Q40 answer labels or correct answer;
- unrelated question/option text;
- the 108 managed source image assets unless a source-reference update is strictly
  required by package identity tooling;
- scoring, attempts, timers, scheduling, autosave, submission, essay lifecycle;
- thesis/dissertation modules;
- Phase B functionality.

No Prisma migration is expected.

## Focused verification

Minimum evidence:

1. Admin shows exactly Grid / Table and Items.
2. No Numbered List option remains.
3. Existing LOGICAL_PREMISES loads/edit under Items.
4. LOGICAL_PREMISES renderer outputs stacked lines with no numeric markers.
5. Q40 renders in exact source order: leading prompt → premises → trailing prompt
   → choices.
6. Q40 answer labels/correct answer are unchanged.
7. All other 28 real structured source payloads remain readable/renderable.
8. Unchanged legacy payload round-trip behavior remains protected.
9. Q25/Q45 structured emphasis remains correct.
10. Existing reviewed emphasis targets remain text-hash compatible after the Q40
    manifest correction.
11. Corrected manifest/package/emphasis binding identities are internally consistent.
12. Controlled clean re-import, if performed, restores 72 questions / 360 options /
    108 media / 72 answer mappings with zero broken references.
13. Repeat import returns the expected already-imported/idempotent result.
14. Repeated emphasis application returns the expected already-applied/idempotent
    result.
15. Focused frontend TypeScript/lint and relevant Vitest contract tests pass.

## Stop boundary

Stop after EC7E implementation, focused verification, report, and push.

Do not claim owner browser QA.
Do not formally accept EXAM-CONTENT-7 or Phase A.
Do not begin Phase B.

The next step after independent EC7E review is resumed owner Admin/Applicant
physical-source QA.
