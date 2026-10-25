# GS020-1B integration

The accepted Rev. 00 renderer is unchanged. Integration uses the existing
Student request -> Adviser CONFORME/Decline -> Dean APPROVE/REJECT transition.
No generated PDF binary is stored.

## Signing contract

`GET /thesis/adviser/candidates` supplies the authenticated Student's display
name, Student Number, Program, exact source Title schedule, and eligible candidates.
The Student page captures the chosen Adviser, exact optional reason, and identity
context when Review & Sign opens. Later background refreshes do not replace that
captured review. The existing shared `ESignaturePad` supplies explicit Type/Draw PNG
evidence. Closing/back, errors, and successful submission discard transient evidence.

`POST /thesis/adviser/request` accepts `requestedAdviserId`, optional `reason`,
`signatureData`, and `reviewedContext` containing `studentId`, `studentName`,
`studentNumber`, `programName`, `requestedAdviserName`, and
`sourceDefenseScheduleId`. An optional top-level `studentId` is never authoritative;
if supplied for another Student it is rejected. The authenticated user determines
ownership. Current server data must match the reviewed identity context, otherwise
the Student must review and sign again. Client signing timestamps are ignored.

Server-owned request date uses Asia/Manila; `signedAt` records the server instant.
The signed state freezes those values, the source conclusion/schedule, exact reason,
Student/Adviser identities, contract version, and signature evidence at submission.
A per-Student lock rechecks active/open requests to serialize duplicate submissions;
a nested Prisma create saves the request and its evidence atomically. Presentation
preflight rejects content that cannot fit the accepted one-page form before saving.

PNG/JPEG validation reuses the existing official-form decoder and a bounded shared
image validator: 1 MiB decoded data, at most 4096 pixels per side / 4 million pixels.
The scoped JSON parser allows the base64 envelope without changing other routes'
body limits. Pooled JPEG Buffers are copied into a view beginning at byte zero for
pdf-lib. Existing evaluator and Adviser error semantics remain unchanged.

## Persistence and immutability

Migration `20261025180000_adviser_request_signed_records` widens the optional reason
to TEXT and adds two separate one-to-one tables, each keyed by the exact request ID:

- `AdviserRequestSignedState`: JSON display state, LONGTEXT signature, signed timestamp,
  and SHA-256 integrity digest over canonical JSON plus exact evidence;
- `AdviserRequestOfficialRecord`: finalized display/workflow snapshot, exact copied
  signature, digest, timestamp, and immutable Student-user / requested-Adviser access IDs.

There is no backfill. Historical requests remain workflow history. Approved legacy
requests without evidence do not acquire a PDF. An unsigned pending request can be
rejected, but cannot receive a new approval/assignment/official record without a new
signed request. No normal API updates/deletes the evidence or finalized record.
The digest is an integrity guard, not a cryptographic digital-signature claim.

At APPROVE, the existing transaction and per-Student lock remain authoritative.
The exact signed Student ID, Adviser ID, reason, source schedule, date, signing
timestamp, and digest must match the request/evidence. The snapshot derives display
values exclusively from this preserved state. Approval, exactly one snapshot, and
the active AdviserAssignment commit together; any insert/validation failure rolls
the transaction back. REJECT and DECLINE create neither a snapshot nor assignment.

The snapshot fixes `EARIST-QSF-GS-020`, `Rev. 00`, `06.20.25`, and contract
`GS020-REV00-V1`, plus exact CONFORME/approval evidence and finalization time. Printed
Dean name/signature remain blank. Current profile, Program, active assignment, or
future institutional-official changes cannot alter historical display authority.

## Read-only access

- `GET /thesis/adviser/requests/records`: safe finalized metadata only;
- `GET /thesis/adviser/requests/:id/pdf`: exact finalized PDF, generated on demand.

Both use role middleware and independent record-service checks. Owning Student,
exact requested Adviser, and Admin may access the record; committee membership
alone grants nothing. Historical access does not depend on an active assignment.
Missing/corrupt/unsupported records fail closed without a mutable-profile fallback.
Raw evidence, digests, and snapshot JSON never enter ordinary response DTOs.

The authenticated Next proxy `/api/adviser-requests/[requestId]/pdf` forwards the
server session token, sets private/no-store headers, and serves inline PDF bytes to
`DocumentViewer`. Downloads reuse `downloadOfficialDefensePdf` and a sanitized
Student-name + Adviser-Request filename. Student, My Advisees' Adviser Requests,
and Admin Adviser Request Review share one record component. UI names/actions are
Adviser Request, View Adviser Request, and Download Adviser Request; no upload loop
or Adviser signature pad was added.

## Verification and acceptance

Focused backend coverage includes signing, stale review rejection, evidence mutation
guards, snapshot authority, rollback, exact-role/ownership authorization, real PDF
generation, and authenticated HTTP routes. Frontend verifier:

```sh
cd frontend
node --test scripts/verify-gs020-1b-adviser-request.mjs
```

The implementation agent reported 255 focused backend checks passed; the full
backend suite passed 2,571 tests with 5 skipped and 0 failed across 198 files; the
new frontend verifier passed 18 checks and the combined affected frontend verifiers
passed 118 checks. Prisma generate/validate, backend build, frontend TypeScript,
scoped ESLint, production build, and diff checks passed. The agent also reported
migration `20261025180000_adviser_request_signed_records` applied successfully to
local MySQL with all 41 migrations up to date; that local runtime claim was not
independently reproduced by remote review.

Independent remote source review passed on 2026-10-25 against implementation commit
`0b3c9f756d66d16b9a27a680264780599bca9242`. Project-owner acceptance followed the
same day. Full end-to-end manual/browser QA was explicitly waived by the project
owner rather than reported as passed; a legacy-account spot check confirmed that
older active AdviserAssignments without authoritative new signing/snapshot evidence
do not receive a fabricated finalized Adviser Request record. No hosted GitHub
workflow/status run was present for the implementation commit at review time.
