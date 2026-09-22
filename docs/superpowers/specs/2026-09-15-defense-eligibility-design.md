# Defense Eligibility Gates — Design Spec

**Date:** 2026-09-15
**Feature:** Enforce defense eligibility so only students with validated requirements can apply for and be scheduled for Title / Proposal / Final Defense
**Author:** MiMoCode + User (client clarification session)
**Branch:** `refactor/defense-eligibility`

---

## 1. Problem Statement

Students can reach a defense without a complete, validated requirement set.

1. **`scheduleDefense` has no business gate** — admin (or any caller of the service) can create a `DefenseSchedule` for any `thesisId` without checking comp exam, documents, prior RAP, certifications, or plagiarism.
2. **Title apply does not match the client** — code requires an active adviser before Title Defense; the client states **title proposal has no adviser**. `/references` is outdated on this point.
3. **Comp exam is UI-only** — student pages block the form when `CompExamRecord` is not `PASSED`, but `POST /thesis/defense/title` does not check it.
4. **Proposal / Final checklists are mostly display** — pages list adviser cert, RAP, variables, STRIKE, statistician cert, etc., but the API only requires 1–2 files and never verifies the rest.
5. **Admin “requirements” UI is fake** — `applications/page.tsx` maps `thesisDocuments` to `met: true` always.

**Goal:** One eligibility service is the source of truth for apply and schedule. Client workflow overrides `/references` where they conflict.

---

## 2. Client Truth (overrides `/references`)

| Topic | Client rule | Notes |
|-------|-------------|-------|
| Title proposal / Title Defense application | **No adviser required** | Remove adviser gate from `applyTitleDefense`. Adviser may be assigned later (e.g. after title selection) per existing adviser-request flows. |
| `/references` (`GS_System_Workflow_Revised-6-3-26_Updated.docx` and extracts) | **Outdated where it conflicts with client** | Do not re-introduce adviser as a Title prerequisite. |

**Open questions** (defaults used in this spec until client answers):

| Question | Default in this spec |
|----------|----------------------|
| Is adviser required for Proposal / Final apply? | **Yes** (adviser certification still applies at those stages) |
| Must comp exam stay PASSED for Proposal / Final, or only for Title? | **PASSED once is enough** for the whole thesis track (re-check not required later) |
| Is payment receipt required for Proposal / Final? | **Yes** (application + proof of payment) |
| STRIKE threshold | **&lt; 20%** (`PlagiarismResult.isEligible` / similarity) |
| Admin must set `ThesisRecord.status = APPROVED` before schedule? | **Yes** |

---

## 3. Scope

**In scope:**
- Central `DefenseEligibilityService` with pure-ish checks and a structured `MissingRequirement[]` result
- Hard gates on `applyTitleDefense`, `applyProposalDefense`, `applyFinalDefense`, `scheduleDefense`
- Align Title apply with client: **no adviser**
- Persist / verify the data those gates need (where already modeled)
- Return missing items on API errors and on `getApprovedDefenses` for admin UI
- Seed fixtures for pass/fail eligibility cases
- Backend unit tests for eligibility rules

**Out of scope (later / separate):**
- Full STRIKE API integration (gate on existing `PlagiarismResult` rows; mock writer is enough for tests)
- New upload UX for every certification (minimal: create records via existing admin/adviser paths or seed; expand UI later)
- Defense lobby JWT/status bugs (already known; separate fix)
- Rewriting `/references` Word docs (note outdated rules in this spec only)
- Custom roles / RBAC redesign

---

## 4. Eligibility Matrix (source of truth)

Legend: **R** = required and validated in system · **—** = not required · **g** = gate (API must throw if missing)

### 4.1 Student apply

| Data | Model | Title | Proposal | Final |
|------|-------|:-----:|:--------:|:-----:|
| Student enrolled (has `Student` row) | `Student` | R g | R g | R g |
| Comprehensive Exam PASSED | `CompExamRecord.status = PASSED` | R g | —* | —* |
| No 2-strike dismissal (not 2× FAILED) | `CompExamRecord` | R g | R g | R g |
| Active adviser | `AdviserAssignment.isActive` | **—** (client) | R g | R g |
| Title stage PASSED (or later stage) | `ThesisRecord` | — | R g | — |
| Proposal stage PASSED (or later) | `ThesisRecord` | — | — | R g |
| No other active thesis (not FAILED) | `ThesisRecord` | R g | — | — |
| 3 proposed titles | `ThesisTitle` | R g | — | — |
| Concept paper / chapters file | `ThesisDocument` | R g (upload) | R g (upload) | — |
| Final manuscript | `ThesisDocument` `FINAL_MANUSCRIPT` | — | — | R g (upload) |
| COR upload (current application) | `ThesisDocument` `COR` | R g | R g | R g |
| Application + payment receipt | `ThesisDocument` `RECEIPT` | R g | R g† | R g† |
| Adviser certification (stage) | `AdviserCertification` `ISSUED` | — | R g | R g |
| Prior stage RAP signed/finalized | `RapReport` | — | R g (Title) | R g (Proposal) |
| Research variables panel-approved | `ResearchVariableForm` | — | R g | — |
| Research instruments | `ThesisDocument` `INSTRUMENTS` | — | — | R g |
| Statistician certification | `StatisticianCertification` | — | — | R g |
| Plagiarism eligible (&lt; 20%) | `PlagiarismResult` | — | — | R g |

\* Comp exam is required once before Title; not re-gated later if already PASSED.  
† Receipt upload for Proposal/Final is not collected today — Task includes adding the field or mapping UI-only items; if not yet uploaded, gate fails with `RECEIPT`.

### 4.2 Admin schedule (`POST /thesis/defense/:thesisId/schedule`)

| Check | Rule |
|-------|------|
| Auth | ADMIN only (route) |
| Thesis exists | `ThesisRecord` |
| Status | `status === "APPROVED"` (admin reviewed) |
| Stage vs `defenseType` | `TITLE`↔`TITLE_DEFENSE`, `PROPOSAL`↔`PROPOSAL_DEFENSE`, `FINAL`↔`FINAL_DEFENSE` |
| All **apply-level** requirements for that stage | Same matrix as §4.1 (document/cert/RAP/plagiarism still valid) |
| Panel payload | chairman, lead, external (or the three role slots) + date + time + venue/link |

If any item fails: `AppError` 400 with `missing: MissingRequirement[]` in the response body.

### 4.3 `MissingRequirement` shape

```typescript
export type DefenseStage = "TITLE" | "PROPOSAL" | "FINAL";

export interface MissingRequirement {
  code:
    | "COMP_EXAM_PASSED"
    | "COMP_EXAM_DISMISSED"
    | "STUDENT_NOT_FOUND"
    | "ACTIVE_ADVISER"
    | "NO_ACTIVE_THESIS"
    | "THESIS_STAGE"
    | "THESIS_NOT_APPROVED"
    | "THREE_TITLES"
    | "CONCEPT_PAPER"
    | "PROPOSAL_CHAPTERS"
    | "FINAL_MANUSCRIPT"
    | "COR"
    | "RECEIPT"
    | "ADVISER_CERT"
    | "PRIOR_RAP"
    | "RESEARCH_VARIABLES"
    | "INSTRUMENTS"
    | "STATISTICIAN_CERT"
    | "PLAGIARISM_ELIGIBLE"
    | "SCHEDULE_PAYLOAD";
  message: string;
  stage: DefenseStage;
}

export interface EligibilityResult {
  eligible: boolean;
  missing: MissingRequirement[];
}
```

---

## 5. Architecture

```
apply* / scheduleDefense (thesis.service)
        │
        ▼
DefenseEligibilityService.assertCanApply(stage, studentId|thesisId)
DefenseEligibilityService.assertCanSchedule(thesisId, defenseType)
        │
        ▼
DefenseEligibilityRepository (reads only: CompExam, Adviser, Thesis, docs, RAP, certs, Plagiarism, …)
        │
        ▼
Prisma
```

- **Reads only** in the eligibility repository (no writes).
- `thesis.service` still owns apply/schedule writes and calls eligibility **first**.
- API errors: `AppError("Defense requirements not met", 400)` with `missing` serialized by the controller.

### 5.1 Client vs outdated references

| Rule | `/references` workflow | This system (client) |
|------|------------------------|----------------------|
| Adviser before Title Defense | Required | **Not required** |
| Comp exam before Title | Required (admin-verified) | Required (same) |
| Admin review then schedule | Required | Required (`APPROVED` + eligibility) |

---

## 6. File map

| File | Responsibility |
|------|----------------|
| `backend/src/interfaces/defense-eligibility.interfaces.ts` | `MissingRequirement`, `EligibilityResult`, `DefenseStage` |
| `backend/src/repositories/defense-eligibility.repository.ts` | All eligibility reads |
| `backend/src/services/defense-eligibility.service.ts` | Rules + `assert*` helpers |
| `backend/src/services/thesis.service.ts` | Call gates from apply/schedule |
| `backend/src/controllers/thesis.controller.ts` | Pass through `missing` on 400 |
| `backend/src/repositories/thesis.repository.ts` | No eligibility logic (keep writes) |
| `backend/prisma/seed.ts` | Pass/fail fixtures |
| `backend/src/services/defense-eligibility.service.test.ts` | Unit tests (Vitest) |
| `frontend/src/app/(portal)/admin/thesis/applications/page.tsx` | Show real missing items |
| `frontend/src/app/(portal)/admin/thesis/scheduling/page.tsx` | Disable schedule if ineligible |
| `frontend/src/app/(portal)/student/thesis/*` | Surface API `missing` (title: remove adviser messaging) |

---

## 7. Status flows (unchanged)

```
ThesisRecord: PENDING → APPROVED → SCHEDULED → PASSED | FAILED | REVISION
```

- Student apply → `PENDING`
- Admin approve (`POST /defense/:id/status`) → `APPROVED` (manual; schedule remains hard-gated)
- Admin schedule → `SCHEDULED` + `DefenseSchedule` + `PanelAssignment`

---

## 8. Security / conventions

- Follow `CONTEXT.md`: Controller → Service → Repository, `AppError`, kebab-case files
- Never trust frontend “met” flags; eligibility is backend-only truth
- Do not expand scope into lobby JWT fixes in this feature branch (track separately)

---

## 9. Acceptance criteria

1. Title apply **succeeds without adviser** when comp exam PASSED + files present.
2. Title apply **fails** with `COMP_EXAM_PASSED` when comp exam missing/PENDING/FAILED (unless dismissed separately).
3. Title apply **fails** with `COMP_EXAM_DISMISSED` when two FAILED comp exam records exist.
4. Proposal apply **fails** until Title `PASSED` and Proposal matrix items exist (adviser cert, Title RAP finalized, variables, receipt, COR, chapters).
5. Final apply **fails** until Proposal `PASSED` and Final matrix items exist (including `PLAGIARISM_ELIGIBLE`, `STATISTICIAN_CERT`, `INSTRUMENTS`).
6. `scheduleDefense` **fails** if thesis not `APPROVED`, stage/type mismatch, or any stage requirement missing — even for admin.
7. API error body includes `missing[]` with `code` + human `message`.
8. Seed produces at least one eligible and one blocked student for Title.
9. Unit tests cover the matrix rules above.
10. Admin UI cannot complete schedule when eligibility is false (button disabled + list of missing items).
