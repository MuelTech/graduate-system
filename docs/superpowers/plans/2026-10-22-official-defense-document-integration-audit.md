# FORM-INT-0 — Official Defense Document Integration Readiness Audit

**System:** EARIST Graduate School Information System (GS-IS)  
**Repository:** `MuelTech/graduate-system`  
**Branch:** `feat/official-defense-document-integration`  
**Audit base:** `main` @ `401219c8c22f5b56247a79fa42f99bfe2ee8d41c`  
**Status:** ACCEPTED AS INTEGRATION PLANNING BASELINE  
**Runtime/schema changes:** none  
**Next package:** FORM-INT-1

## Purpose

FORM-INT-0 records the production integration path for the three accepted official defense form families before any PDF route, controller, Admin action, schema, or persistence behavior is added.

This audit is a planning/source-of-truth checkpoint. Each later implementation package must still verify the exact repository state it changes.

## Confirmed architecture

The repository already has the authoritative defense-record layer required for initial integration:

- `OfficialDefenseRecordService.getOfficialCriteria(scheduleId, panelAssignmentId, actor?)`;
- `OfficialDefenseRecordService.getSummaryReadModel(scheduleId, actor?)`;
- `OfficialDefenseRecordService.getAdminDefenseRecordDetail(scheduleId)`;
- schedule-scoped Admin Defense Records;
- finalized evaluator `OralExamScore` rows with `officialSnapshot` and evaluator signature evidence;
- persisted `OralExamSummary.snapshotData`;
- exact `DefenseSchedule` + `PanelAssignment` committee context.

The integration must extend these existing records rather than introduce a second defense workflow.

There is currently no generated-document orchestration service, no PDF endpoints for the three accepted renderers, no generated-document persistence/versioning model, and no active Admin Download / Print wiring.

## Exact binding rule

Official documents must be generated from an exact `DefenseSchedule.id`.

Do not generate an official copy from:

- `thesisId` alone;
- a latest/current schedule fallback;
- `pickCurrentDefenseSchedule()` when a specific attempt is intended;
- the current active Adviser when the exact schedule already records the historical Adviser seat.

Historical attempt integrity takes precedence over convenience projections.

## Source-to-renderer map

### 1. Individual Oral Examination Criteria / Evaluation

Authoritative source:

- exact `DefenseSchedule`;
- exact evaluator `PanelAssignment`;
- finalized `OralExamScore`;
- `OralExamScore.officialSnapshot`;
- `OralExamScore.signatureData`.

Renderer mapping:

- Candidate / Course / Date: exact schedule/student/program context;
- Group I + Group II criteria: `officialSnapshot.criteria`;
- Group I / Group II averages: `officialSnapshot.groupIValue` / `groupIIValue`;
- Recommendations: `officialSnapshot.recommendations`;
- Rating: current V2 snapshot value, blank when null;
- Remarks: blank unless a distinct authoritative source is later introduced;
- Evaluator printed name: exact evaluator assignment identity;
- Signature image: exact evaluator `OralExamScore.signatureData`.

Availability:

- evaluator role must be `CHAIRMAN` or `PANELIST`;
- score must be `FINALIZED`;
- exact schedule + panel assignment binding must match;
- current institutional form supports `INSTITUTIONAL_MATRIX_V2` only;
- required signature evidence must be present and valid.

Legacy `LEGACY_POINTS_V1` rows must fail closed. Do not rescale or convert them to the current 1.00–2.50 form.

### 2. GS-011 Oral Examination Summary

Authoritative source:

- exact `OralExamSummary`;
- persisted `snapshotData`;
- exact schedule committee context for stage-specific Adviser display.

Renderer mapping:

- Candidate / Course / Date / Student No.: persisted summary snapshot;
- examiner rows: `snapshot.evaluators`;
- Group A / Group B / Average: persisted snapshot values; do not recalculate during rendering;
- Submitted by Chairman: snapshot evaluator whose `functionalRole === "CHAIRMAN"`;
- Member names: snapshot `PANELIST` evaluators;
- Adviser: exact schedule `ADVISER` seat for Proposal/Final only;
- Dean: blank unless an authoritative attestation/display-name source exists.

The first integration remains wet-signature only for GS-011. Do not reuse evaluator, RAP, Adviser Certification, or other signature evidence.

Legacy or mixed scoring-version summaries must fail closed.

### 3. GS-006 / GS-007 Defense Application

Authoritative anchor:

- exact `DefenseSchedule.id`;
- exact schedule → thesis → student/program;
- exact schedule `PanelAssignment` roster;
- centralized `DefenseCommitteePolicy`.

Renderer mapping:

- variant: `Program.programType`;
- application type: exact `DefenseSchedule.defenseType`;
- identity: exact schedule student/program context;
- defense date/time/link: exact schedule;
- Adviser: exact schedule Adviser seat for Proposal/Final only;
- printed Panelist names: Chairman first, followed by actual Panelists;
- Facilitator / Rapporteur: exact schedule seats;
- institutional approval names: blank unless an authoritative source is introduced.

Accepted committee presentation:

| Stage | Program | Printed committee structure |
| --- | --- | --- |
| Title | Master's | 5 × Panelist = Chairman + 4 Panelists; Facilitator; Rapporteur; no Adviser |
| Proposal / Final | Master's | Adviser; 4 × Panelist = Chairman + 3 Panelists; Facilitator; Rapporteur |
| Title | Doctoral | 6 × Panelist = Chairman + 5 Panelists; Facilitator; Rapporteur; no Adviser |
| Proposal / Final | Doctoral | Adviser; 5 × Panelist = Chairman + 4 Panelists; Facilitator; Rapporteur |

`CHAIRMAN` remains `CHAIRMAN` in GS-IS. Only the printed row label is `Panelist`.

## Defense Application fields currently lacking authoritative data

The following fields must remain blank in the first integration unless a later approved data-capture package introduces an authoritative source:

- stage-specific application date/time;
- amount paid;
- official receipt number;
- personal Gmail;
- Dean display name;
- VPAA display name;
- President display name.

Do not populate them from current time, `ThesisRecord.createdAt`, unused thesis-level payment fields, uploaded receipt OCR, generic `User.email`, or role-directory guesses.

## Authorization and signature boundary

Initial PDF authority:

- Individual Criteria PDF: Admin initially; owning evaluator may be considered later without broadening cross-evaluator access;
- GS-011 PDF: Admin only;
- GS-006/GS-007 PDF: Admin only.

Rules:

- new controllers must always pass the authenticated actor to official-record services;
- Criteria generation must prove the exact panel assignment belongs to the exact schedule;
- no Student or unrelated Panelist may access another evaluator's form;
- PDF routes return PDF bytes only, never raw signature evidence or storage paths;
- no public PDF URLs or query-string auth tokens;
- `OralExamScore.signatureData` is the only signature source for the Individual Criteria form;
- `RapReportSignature.signatureData` is RAP-only;
- `AdviserCertification.signatureData` is not reusable for these forms.

## Admin UI ownership

Use the existing schedule-scoped Admin Defense Record detail:

`frontend/src/app/(portal)/admin/thesis/defense-records/[scheduleId]/page.tsx`

Section ownership:

- Defense Application → GS-006 / GS-007;
- Evaluation Results → per-evaluator Individual Evaluation PDF;
- Oral Examination Summary → GS-011;
- Committee Report → later GS Form No. 22 package.

Do not add a separate generic Defense Documents inventory and do not print the whole browser page as the official form.

## Prerequisite correction

### FORM-INT-PRE1 — Defense Record status alignment — ACCEPTED

Accepted implementation:

`ae68d14b7af037e0570c21336de1ea7c43fb424c`

The obsolete Title Defense completion exemption has been removed from `backend/src/services/defense-record-status.rules.ts`.

Current official-record runtime already treats Title, Proposal, and Final Defense as using evaluator scoring/finalization and producing official evaluator Criteria + Oral Examination Summary.

Current accepted projection:

- Title, Proposal, and Final all require Summary ready + FINALIZED RAP after conclusion before `COMPLETE`;
- no academic outcome is inferred by the projection;
- missing Summary or non-finalized RAP remains `AWAITING_COMPLETION`.

PRE1 changed only:

- `backend/src/services/defense-record-status.rules.ts`;
- `backend/tests/unit/services/defense-record-status.rules.test.ts`.

No renderer, schema, API, route, frontend, scoring, verdict, RAP-lifecycle, or committee-policy change was included.

## Additional integration constraints

- Validate evaluator signature image data before embedding; malformed evidence must fail closed.
- Production logo assets must be resolved server-side and included in deployment packaging.
- Panelist order for GS-006/007 must be deterministic: Chairman first, then actual Panelists using a stable ordering strategy; do not infer Chairman from arbitrary row order.
- On-demand rendering is acceptable for the first Criteria/Summary integration because their authoritative source records are finalized/locked.
- Generated-document persistence/versioning remains deferred.
- Initial GS-006/007 output is a current-record print; immutable archival copy/versioning requires a separate approved package.
- No Prisma migration is expected for FORM-INT-1 through FORM-INT-4.

## Accepted bounded implementation sequence

1. **FORM-INT-PRE1 — ACCEPTED** — corrected stale Title Defense record-status projection.
2. **FORM-INT-1 — NEXT** — shared official-document orchestration + Individual Criteria PDF endpoint.
3. **FORM-INT-2** — GS-011 Summary PDF endpoint.
4. **FORM-INT-3** — GS-006 / GS-007 Defense Application PDF endpoint.
5. **FORM-INT-4** — Admin Download / Print activation, availability metadata, frontend/security/regression hardening.

Optional later package only if institutionally required:

- generated-document persistence/versioning;
- immutable archived official copies;
- additional digital-signature modes;
- institutional approval-signature policy.

## Explicit non-goals

FORM-INT-0 does not authorize:

- new academic workflow;
- score-to-verdict automation;
- legacy score conversion;
- generic template platform;
- GS Form No. 22 implementation;
- automatic Dean/VPAA/President signatures;
- inferred payment/application metadata;
- latest-schedule fallback;
- new Prisma schema solely for initial PDF generation.

## Acceptance

FORM-INT-0 is accepted as the integration planning baseline.

The audit itself changed no runtime behavior, schema, API, renderer, or UI. Each implementation package must remain independently reviewable and must stop at its own boundary.
