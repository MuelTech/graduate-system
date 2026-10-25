# GS-020 Official Adviser Request Form — Implementation Plan

**Date:** 2026-10-25  
**Repository:** `MuelTech/graduate-system`  
**Target branch:** `feat/official-adviser-request-form`  
**Starting `main` / branch HEAD:** `17d7953f40c6c26833f451cea395f3333a220be2`  
**Workflow authority:** `docs/superpowers/DEFENSE_WORKFLOW_SOURCE_OF_TRUTH.md`  
**Document authority:** `docs/superpowers/DOCUMENT_LIFECYCLE_SOURCE_OF_TRUTH.md`  
**Tracking index:** `docs/superpowers/GSIS_IMPLEMENTATION_CHECKLIST.md`  
**Official form:** **EARIST-QSF-GS-020 Rev. 00 (06.20.25) — Adviser Request**  
**Status:** DESIGN / DOCUMENTATION ACCEPTED FOR IMPLEMENTATION PREPARATION; NO GS-020 RENDERER OR LIVE FORM INTEGRATION IMPLEMENTED YET

## 1. Goal

Complete the official-document side of the already-existing GS-020 Adviser Request workflow without creating a second paper/upload process.

The current business sequence remains:

```text
Title stage complete
      ↓
Student chooses one eligible Adviser candidate
      ↓
Student reviews exact request + reason
      ↓
Student e-signs and submits exact request
      ↓
Requested Adviser
      ├── DECLINES
      └── CONFORMES
                ↓
Dean/Admin
      ├── REJECTS
      └── APPROVES
                ↓
Active AdviserAssignment
                ↓
Immutable finalized GS-020 snapshot
                ↓
Authorized View / Download
```

This package adds the official EARIST GS-020 representation and the minimum missing signature/snapshot behavior needed to make that representation trustworthy.

It must not redesign Adviser candidacy, Dean approval authority, AdviserAssignment authority, or the broader Faculty/adviser-capacity roadmap.

## 2. Verified existing baseline

The repository already contains the GS-020 workflow and must be reused.

Current `AdviserRequest` data includes:

- `studentId`;
- `requestedAdviserId`;
- nullable `reason`;
- overall request `status`;
- `sourceDefenseScheduleId` linking the passed Title Defense source;
- `adviserStatus`;
- `adviserRespondedAt`;
- `adviserRemarks`;
- `deanStatus`;
- `deanReviewedById`;
- `deanReviewedAt`;
- `deanRemarks`;
- `requestDate`.

Existing product surfaces already cover:

- Student Adviser Request selection/submission;
- requested Adviser CONFORME/DECLINE;
- Admin/Dean approval/rejection;
- creation of the active `AdviserAssignment` only after the accepted sequence;
- Adviser request visibility through My Advisees / Adviser Request surfaces.

The official GS-020 PDF renderer/output is the missing piece. Do not recreate the existing request workflow in parallel.

## 3. Project-owner-approved design decisions

### 3.1 Finalized-only official document

The official GS-020 is available only after the exact request has:

1. a valid Student e-signature;
2. Adviser `CONFORMED`; and
3. Dean `APPROVED`.

Pending, declined, rejected, or otherwise incomplete requests may show ordinary workflow/status UI but do not receive a finalized official GS-020 download.

No draft official-PDF lifecycle is required in this package.

### 3.2 Student signature is an explicit request action

The supplied form explicitly provides **Graduate Student — Signature Over Printed Name**.

Before submission, the Student must review the exact request and e-sign it. The signing action must bind to the exact request state being submitted, including at minimum:

- Student identity;
- requested Adviser;
- request content/reason;
- request/signing timestamp;
- signature evidence.

After the signed request is submitted, the requested Adviser or request content must not be silently changed beneath that signature.

A materially different later request requires a new Adviser Request and a new Student signature.

Authentication/session identity alone must never be rendered as a fabricated Student signature image.

### 3.3 Adviser CONFORME remains explicit; no invented Adviser signature image

The Student chooses whom to request, but that choice does not create the Adviser relationship.

The requested Adviser must still explicitly:

- `CONFORME`; or
- decline.

The supplied form shows **CONFORME: Adviser** but does not establish a separate **Signature Over Printed Name** requirement for the Adviser. Preserve the existing explicit CONFORME actor/date as workflow evidence. Do not add a mandatory Adviser signature image unless later EARIST evidence requires one.

### 3.4 Dean approval remains authoritative; printed Dean identity is blank for now

The existing Dean/Admin approval actor and timestamp remain authoritative workflow/audit evidence.

The project currently has no approved institutional-office-holder source for the printed Dean identity/signature. Therefore the first GS-020 output must:

- retain the official Dean/approval labels from the form;
- leave the printed Dean name/signature area blank;
- not substitute the logged-in Admin name as the institutional Dean;
- not hard-code a Dean name;
- not fabricate a Dean signature.

Future **System Settings / Institutional Officials** work may provide an authoritative Dean display identity for newly finalized official records.

That future configuration must not retroactively rewrite older finalized GS-020 snapshots.

### 3.5 Immutable snapshot instead of permanent PDF storage

The first implementation will preserve an immutable finalized **data snapshot** and render the PDF on demand.

Do not permanently store a PDF binary merely because a user downloads/views GS-020.

At finalization, preserve enough exact data to reproduce the historical document, including:

- form code: `EARIST-QSF-GS-020`;
- revision: `Rev. 00`;
- form effective date/reference: `06.20.25`;
- exact Adviser Request ID;
- Student printed/display name;
- Student Number;
- Program display value;
- requested Adviser display name;
- exact request reason/content used by the form;
- request date;
- Student signature evidence;
- Student `signedAt`;
- Adviser CONFORME state/date;
- Dean approval state/date;
- the institutional display values applicable at finalization, blank where no authority exists;
- finalized/snapshot timestamp;
- any explicit renderer-contract version needed for deterministic reproduction.

View/Download must render from this immutable snapshot, not from mutable current/latest profile or office-holder records.

If a future form revision is introduced, an old Rev. 00 snapshot must continue to use the Rev. 00 renderer/contract rather than silently adopting the new layout.

Permanent generated-document binary archival/versioning remains a separate future records-management package.

### 3.6 Authorized visibility

After finalization, the same authoritative GS-020 record is read-only and available to:

- the owning Student;
- the requested Adviser for that exact request;
- authorized Admin/Dean users.

No other defense participant gains direct GS-020 access merely by being Chairman, Panelist, Rapporteur, Facilitator, or another committee member.

Primary placement:

- **Student:** existing `/student/thesis/adviser-request` page;
- **Adviser:** My Advisees / Adviser Request record/history;
- **Admin:** Adviser Request review/history, with later reuse possible in an accepted unified Student-document surface.

The Student must never be asked to download the generated GS-020 and upload it back into GS-IS.

### 3.7 Historical preservation

A finalized GS-020 remains historical evidence of the exact request that created that Adviser relationship.

If a future approved workflow later replaces or ends the Adviser relationship:

- preserve the old GS-020 snapshot;
- do not rewrite the requested Adviser;
- do not update it to the new Adviser;
- do not replace its Student signature;
- do not apply newly configured Dean identity retroactively.

A future replacement relationship may create its own new record according to the then-approved policy.

## 4. Official form reconstruction contract

The project-owner-supplied image of **EARIST-QSF-GS-020 Rev. 00 (06.20.25)** is the visual reference for GS020-1A.

Observed form content to preserve includes the official layout and fields for:

- date;
- requested Adviser;
- request reason;
- Graduate Student printed name;
- Student No.;
- Program;
- Student signature-over-printed-name area;
- **CONFORME:** Adviser area;
- Dean, Graduate School approval area;
- form identity / revision footer.

Do not add a Thesis/Dissertation Title field solely because GS-IS has title data elsewhere; the supplied GS-020 form does not establish such a printed field.

Do not invent new institutional wording, signature roles, calculations, or approval fields.

## 5. Implementation checkpoints

## GS020-1A — Official renderer only

### Goal

Reconstruct the supplied GS-020 as a pure server-owned official-form renderer and stop for project-owner visual acceptance.

### Scope

Create the renderer inside the existing official-document architecture, preferably:

`backend/src/documents/official-defense/adviser-request/`

Reuse accepted shared official-form helpers/assets where appropriate. Do not refactor the entire official-document directory solely because GS-020 is not a defense-session document.

Implement:

- explicit typed display input;
- PDF bytes output;
- official masthead/form identity;
- exact one-page geometry/layout based on the supplied reference;
- bounded text/line handling;
- Student signature-image placement as an optional renderer input;
- blank-capable Dean display/signature region;
- representative sample-generation script;
- focused renderer tests.

Representative samples should cover at least:

- normal values;
- long Student / Adviser / Program / reason values;
- Student signature present;
- Dean printed identity blank.

### Renderer purity

GS020-1A must not:

- query Prisma;
- read `AdviserRequest` directly;
- choose/validate Adviser eligibility;
- infer workflow status;
- authorize users;
- save signature evidence;
- add API/controller routes;
- change Student/Adviser/Admin UI;
- create the immutable snapshot model/fields;
- populate institutional Dean identity;
- redesign existing GS-020 workflow transitions.

### Stop condition

After fresh sample PDFs are generated:

1. compare with the supplied official GS-020 reference;
2. correct layout/spacing/typography/lines/signature region as needed;
3. repeat until the project owner visually accepts the form;
4. **STOP**.

Do not continue automatically to GS020-1B.

## GS020-1B — Student e-signature + finalized record integration

Start only after GS020-1A visual acceptance.

### 1B-A — Exact request signing

Add the minimum additive persistence needed to preserve:

- Student signature evidence;
- Student signing timestamp;
- exact request binding / mutation guard.

The exact Prisma shape is not locked by this plan. Source-audit the existing signature helpers/models first and reuse accepted secure patterns where appropriate.

Required behavior:

- Student chooses eligible Adviser and completes existing request details;
- before submit, show a review/sign confirmation containing the exact requested Adviser and relevant request content;
- Student signs explicitly;
- server revalidates ownership/request eligibility;
- submitted signed request becomes immutable with respect to signed Adviser/content under the ordinary flow.

### 1B-B — Finalized snapshot

When the same request reaches Adviser `CONFORMED` + Dean `APPROVED`, freeze the GS-020 snapshot.

Snapshot creation should be atomic with the authoritative final approval / active AdviserAssignment transition where practical so the system does not end in a normal success state with an approved request but missing required official-record snapshot.

If snapshot creation fails, fail closed rather than fabricate/reconstruct a supposedly finalized record later from mutable current data.

Do not create a generic GeneratedDocument platform in this package; use the narrowest additive structure that preserves the accepted GS-020 snapshot contract and can be generalized later if needed.

### 1B-C — PDF mapping and routes

Add a bounded service that maps only the immutable finalized snapshot into the accepted GS020-1A renderer.

Provide authorization-checked availability/View/Download behavior for:

- owning Student;
- requested Adviser for that exact request;
- authorized Admin/Dean.

Never expose raw signature evidence in ordinary JSON DTOs if a server-side renderer can consume it internally.

Readable downloaded filename should identify the Student + Adviser Request / GS-020 without exposing internal UUIDs as the primary user-facing name.

### 1B-D — UI integration

#### Student

On existing `/student/thesis/adviser-request`:

- keep the existing request workflow;
- add the Review & Sign step before final request submission;
- after final approval, show the finalized record with **View GS-020** / **Download GS-020**;
- do not add an upload control for GS-020.

#### Adviser

In My Advisees / Adviser Request context:

- retain existing CONFORME/DECLINE behavior;
- after the request is finalized, expose read-only **View/Download GS-020** for the requested Adviser;
- do not introduce an Adviser signature pad unless separately approved.

#### Admin

In Adviser Request review/history:

- retain existing Dean Approve/Reject behavior;
- after approval/finalization, expose read-only **View/Download GS-020**;
- printed Dean identity/signature remains blank in the form for this package.

## 6. Authorization and integrity invariants

GS020-FORM must prove all of the following:

1. Student can sign only their own eligible Adviser Request.
2. Student signature is bound to the exact requested Adviser/request content.
3. Adviser CONFORME remains mandatory before Dean approval.
4. Dean approval remains mandatory before active AdviserAssignment/finalized GS-020.
5. No finalized official GS-020 exists for incomplete/declined/rejected requests.
6. Student cannot edit a submitted signed request underneath the signature.
7. Renderer never discovers mutable current values on its own.
8. Finalized PDF is produced only from the immutable GS-020 snapshot.
9. Owning Student can access only their own finalized GS-020.
10. Requested Adviser can access only GS-020 records for requests addressed to them.
11. Admin/Dean access remains explicitly authorized.
12. Other committee members do not inherit GS-020 access.
13. Raw Student signature evidence is not leaked through ordinary DTOs.
14. Printed Dean identity/signature remains blank until authoritative Institutional Officials configuration exists.
15. Later institutional settings do not rewrite prior snapshots.
16. Later Adviser relationship changes do not rewrite prior snapshots.
17. No Student upload/re-upload requirement is introduced.
18. No Title/Proposal/Final defense authority is changed by this package.

## 7. Verification

### GS020-1A

Run at minimum:

- renderer unit tests;
- blank/normal/long-value sample generation;
- Student-signature sample;
- blank-Dean sample;
- backend TypeScript/build checks appropriate to the renderer;
- visual comparison against the supplied official form;
- project-owner visual acceptance.

### GS020-1B focused tests

Cover at minimum:

- Student owner signing success;
- wrong Student denied;
- unsigned request cannot be submitted under the new signed contract;
- signature bound to exact requested Adviser/content;
- post-sign mutation blocked;
- Adviser CONFORME required;
- Dean approval required;
- declined/rejected request has no finalized GS-020;
- approved request freezes exactly one authoritative snapshot;
- approval/snapshot/AdviserAssignment atomicity or equivalent fail-closed invariant;
- Student own View/Download success;
- cross-Student access denied;
- requested Adviser access success;
- unrelated Adviser/Panelist denied;
- Admin access success;
- PDF mapping uses snapshot, not live current profile values;
- raw signature evidence omitted from ordinary DTOs;
- blank Dean identity retained;
- later mutable-data changes do not change rendered historical values.

Run proportional Adviser Request / Student Journey / AdviserAssignment regressions because GS020-1B touches the existing GS-020 transition path.

Frontend checks should cover Student Review & Sign, approved-record actions, Adviser record visibility, and Admin record visibility.

Manual/browser QA is project-owner-owned unless explicitly delegated to the coding agent.

## 8. Explicitly out of scope

Do not include in GS020-FORM:

- Faculty identity / multi-permission refactor;
- adviser-capacity policy or load caps;
- changing the Title Defense adviser-candidate pool;
- allowing external advisers;
- generic saved-signature profile/vault;
- Adviser signature-image requirement;
- Dean digital-signature policy;
- System Settings / Institutional Officials implementation;
- retroactive Dean-name population;
- permanent generated-PDF storage/archive manager;
- generic GeneratedDocument platform;
- PREDEF-3 manuscript rebinding;
- post-start committee recovery;
- unrelated official forms;
- broader Student document-center redesign.

## 9. Acceptance sequence

```text
Documentation accepted
      ↓
GS020-1A renderer
      ↓
Project-owner visual QA / corrections
      ↓
GS020-1A accepted
      ↓
GS020-1B exact request signing + snapshot + access integration
      ↓
Focused/proportional automated verification
      ↓
Independent remote source review
      ↓
Project-owner manual UI acceptance
      ↓
Documentation acceptance update
      ↓
PR / merge only when explicitly requested
```

No checkpoint should be represented as accepted merely because files/routes exist. Acceptance requires the documented authority, tests, and project-owner review appropriate to that checkpoint.
