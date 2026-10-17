# CDW-6 — Defense History and revision traceability

**Branch:** `refactor/collaborative-defense-workspace`
**Scope:** generalize the CP8 "Final → prior Proposal" context into an attempt-based,
server-authoritative Defense History that a later defense may READ without reopening,
copying, or mutating any historical attempt.
**Canonical authority:** `docs/superpowers/COLLABORATIVE_DEFENSE_WORKSPACE_AND_RAP_SOURCE_OF_TRUTH.md`
§12; `docs/superpowers/DEFENSE_WORKFLOW_SOURCE_OF_TRUTH.md` §21; implementation plan CDW-6.
**Migration:** NONE (`NO NEW DATABASE MIGRATION ADDED`).

## 1. History is attempt-based

History is derived from immutable attempt records, never from mutable current state. The
resolution chain for a historical item is always:

```
current DefenseSchedule (:scheduleId, the workspace whose assignment grants authority)
  → same thesis
  → prior CONCLUDED DefenseSchedule
      → that exact schedule.manuscriptDocumentId (the attempt binding)
      → that exact schedule's annotations/comments
      → that exact schedule's FINALIZED RapReport
      → that exact schedule's DefenseConclusion
      → that exact schedule's PanelAssignment roster
```

It is explicitly **not** derived from `ThesisDocument.isCurrent`/latest, the current
`AdviserCertification`, thesis-global status, the current committee, or a RAP without a
schedule binding.

## 2. Resolution, categories, and ordering

`backend/src/services/defense-history.rules.ts` holds the pure shared rules
(`defenseStageRank`, `isPriorAttempt`, `classifyHistoryRelationship`,
`resolveHistoryScheduleIds`, `canReadHistoricalBoundManuscript`).

- **SAME_STAGE_REDEFENSE** — a strictly earlier attempt of the same defense type
  (re-defense). The immediately preceding same-stage attempt is prioritized.
- **PREVIOUS_STAGE** — the immediately preceding academic stage
  (`TITLE → PROPOSAL → FINAL`) **and** that attempt was formally `PASSED` (normal
  progression). A non-PASSED adjacent attempt is downgraded to older history.
- **OLDER_HISTORY** — any other prior concluded same-thesis attempt (secondary context).

Ordering is deterministic: relationship rank (same-stage → previous-stage → older), then
newest concluded first, then defense date, then createdAt, then schedule id. Candidates
that are not concluded, cannot be proven prior, are the current attempt, or are a
later/future stage are excluded. "Unprovable ordering" fails closed.

## 3. Attempt binding (manuscript / RAP / annotations)

`DefenseHistoryService` (`backend/src/services/defense-history.service.ts`) resolves a
history item's manuscript **only** from `DefenseSchedule.manuscriptDocumentId`, and only
when the included document matches that exact id, belongs to the same thesis, is the
attempt's exact stage, and is one of the canonical manuscript types
(`TITLE_PROPOSAL` / `PROPOSAL_CHAPTERS` / `FINAL_MANUSCRIPT`). Anything else → the
manuscript is `null` ("unavailable"); today's current/latest document is never
substituted.

Annotations/comments are read through the **one** shared read shape
(`DefenseCollaborationService.listAttemptAnnotationsForHistory`, which `listAnnotations`
also calls), scoped by BOTH `scheduleId` and the exact `thesisDocumentId`. Historical
authors keep their **original** role (e.g. `PANELIST` in Attempt 1 is never remapped to
the caller's current `CHAIRMAN`).

RAP history exposes the exact **FINALIZED** `RapReport` only: `status`, `finalizedAt`,
`bodyDocument` (structured CDW-5 body), `decisionsAndRecommendations` (legacy text),
`isStructured`, `contentVersion`, and signature **progress** counts. A non-FINALIZED
report is not surfaced as official history, and raw `signatureData` is never returned.

## 4. Authorization

- A read requires a `PanelAssignment` on the **CURRENT** schedule (`:scheduleId`) — the
  authority is the current assignment, never an account role and never a historical
  assignment.
- The historical schedule must belong to the **same thesis** (cross-thesis → 404, which
  avoids confirming another thesis's attempt), be a genuinely prior/relevant concluded
  attempt (else 403), and not be the current schedule.
- A **replacement** current Panelist who was never on the old committee therefore gains
  **read-only** historical context. They do not become a member of the historical
  attempt and gain no write authority there.

### Historical manuscript access (documents)

`canPanelistAccessThesisDocument` (`backend/src/services/document.service.ts`) now calls
the shared `canReadHistoricalBoundManuscript` rule (replacing the narrow CP8
Final→passed-Proposal exception). Access is granted only when the document is the EXACT
`manuscriptDocumentId` of a concluded prior attempt, its stage/docType match that
attempt, and the caller is assigned to a current schedule that treats the attempt as
relevant history. Supporting evidence (COR/receipt/plagiarism/instruments) can never be
granted (docType guard). Storage paths/public URLs are never exposed — the historical
viewer loads through the existing authenticated document proxy.

## 5. What is exposed — and hidden

Exposed per historical attempt: schedule id, defense type, stage, relationship, date/time/
venue, session status, formal verdict, concludedAt, exact bound manuscript metadata,
finalized-RAP availability, annotation/comment counts, and the committee roster with
roles. Detail adds: the historical manuscript (read-only), historical annotations/
comments/replies with original authors/roles/timestamps, the FINALIZED RAP (structured or
legacy), and RAP signer **status** progress.

Hidden (never returned): prior individual evaluator criterion values / group averages /
overall / rating / official snapshots, raw signature evidence (`signatureData`), storage
paths, and internal authorization fields. The Admin-only Oral Examination Summary privacy
is untouched.

## 6. API (read-only)

```
GET /thesis/defense/:scheduleId/history                        → { scheduleId, defenseType, items[] }
GET /thesis/defense/:scheduleId/history/:historicalScheduleId  → attempt detail
```

Both are `authenticateJWT + requireRole(["PANELIST"])` and then current-assignment
authorized inside the service. There are **no history write routes**. Existing
collaboration write endpoints still require the exact target-schedule assignment and a
writable attempt state, so historical reads confer no historical write authority.

## 7. Frontend

- **Control:** a `Defense History` button in the Student Document experience
  (`defense-history-panel.tsx`); Current Manuscript remains the default.
- **Panel:** grouped by the three relationships; selecting an attempt opens read-only
  modes: **View Previous Manuscript**, **View Previous RAP**, **View Historical
  Annotations**, **Compare with Current** (disabled when unavailable).
- **Historical viewer:** reuses `CollaborativeManuscriptViewer` with **no**
  `onTextSelection` (no creation) and no composer; a visible read-only banner.
- **RAP:** structured bodies reuse `ReportDocumentCanvas` + `ReportDocumentView`
  (`normalizeReportDocument`); legacy text is labelled "Legacy historical report".
- **Compare:** manual desktop side-by-side — historical (read-only) beside the current
  attempt through `CollaborationViewerPane`. No diff engine, no compliance verdict.
- **Isolation:** React Query keys include the current schedule AND the historical
  schedule; history has no mutations, so current-attempt polling can never overwrite
  historical data.
- The CP8 `ProposalHistoryPanel` + "Proposal Context" tab + `DefenseWorkspaceDto.
  proposalHistory` were removed — there is exactly ONE history system.

## 8. Legacy / incomplete history

Historical rows may lack a binding, RAP, or annotations from before CDW existed. The read
model renders honest states: "Historical manuscript unavailable", "Finalized RAP
unavailable", "No historical annotations recorded", "Legacy historical report". It never
substitutes the current document, invents annotations, fabricates a structured body, or
reuses current committee metadata as historical metadata.

## 9. Privacy

The history read model contains no detailed prior private evaluator criteria/scores and no
raw signature evidence; the frontend additionally asserts these are absent. Admin-only
Oral Examination Summary behavior is unchanged.

## 10. Verification

Backend: `npx prisma validate`, `npx prisma generate`, `npm run build`, `npx vitest run`
→ **139 files / 1528 passed / 5 skipped**.

Frontend: `verify-pdf-anchors` (10), `verify-viewer-core` (13), `verify-cdw2-contracts`
(11), `verify-cdw3-collaboration` (24), `verify-cdw4-workspace` (9), `verify-cdw4-matrix`
(19), `verify-cdw5-report` (57), `verify-rap-c1` (13), **`verify-cdw6-history` (13)** →
**169 assertions, 0 fail**; plus `npx tsc --noEmit`, scoped `npx eslint`, `npm run build`
— all clean.

Focused new tests: `defense-history.rules.test.ts`, `defense-history.service.test.ts`,
`cdw6-document-auth.test.ts`, `cdw6-history-annotation-read.test.ts`,
`cdw6-history.routes.test.ts`; `document.schedule-binding-auth.test.ts` updated for the
generalized (older-history) authority.

## 11. Deferred (unchanged)

Automatic PDF/visual/text diff, semantic diff, AI revision-compliance judgement,
automatic "recommendation addressed" status, historical annotations carried into the
current manuscript, reuse of old evaluation/RAP/signature rows, official GS Form
rendering/PDF/print, Socket.IO realtime, and CDW-7 acceptance work are **not**
implemented.
