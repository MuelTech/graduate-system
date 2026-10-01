# Document Lifecycle Implementation Plan

Date: 2026-10-02
Target branch: `refactor/document-lifecycle`

## Working protocol

- One bounded package at a time.
- Verify remote branch HEAD before every package.
- Agent implements, commits, pushes; independent review follows.
- No merge/force push/branch deletion unless explicitly requested.
- Preserve accepted Defense Workflow behavior.
- If an EARIST policy is unresolved, stop at a safe configurable/design boundary rather than inventing a rule.

## DL-0 — Documentation and audit baseline

Deliverables: this source of truth, architecture design, and plan. No production-code changes.

Acceptance: documents match current code, identify KEEP/REFACTOR/REPLACE/ADD/DEFER, and do not claim unresolved policy.

## DL-1 — Core storage metadata and provider abstraction

Scope:
- define storage provider/service for private local persistent storage first
- introduce stable storage key abstraction and backward-compatible legacy `filePath` resolver
- add metadata needed for new uploads: original filename, verified MIME, size, checksum, uploader/time as appropriate
- production-safe configuration validation for upload root
- no domain workflow changes

Tests: provider path containment, missing object, checksum helper, legacy path compatibility, config behavior.

## DL-2 — Secure upload pipeline and cleanup

Scope:
- central document-type upload policies
- temp/private upload lifecycle
- magic-byte validation for all covered upload categories
- size/file-count limits
- SHA-256/size metadata
- cleanup on validation/business/DB failures
- correct MIME/original filename on authorized retrieval
- idempotency/concurrency protections appropriate to endpoints

Apply first to existing shared middleware without weakening COR/Adviser safeguards.

Tests include invalid MIME spoof, oversized file, malformed/unsupported content, transaction failure cleanup, orphan prevention, unauthorized retrieval, path traversal, extensionless stored object MIME.

## DL-3 — Applicant COR lifecycle consolidation

Scope:
- preserve passed-exam gate
- preserve secure PDF/JPEG/PNG validation
- support rejected COR resubmission/history
- consolidate `/cor/*` and overlapping `/admin/applicants/*` verification behavior behind one canonical service authority
- keep verify + confirmed data + enrollment + role promotion atomic
- remove raw `filePath` exposure from Admin DTOs where not needed
- maintain audit log

Do not implement OCR auto-promotion.

## DL-4 — Native COR PDF extraction framework

Scope:
- add Node-compatible native PDF text extraction (planned `pdfjs-dist` unless implementation review selects an equivalent maintained library with positional text)
- persist extraction status/method/version and extracted suggestions
- fallback to manual review when no useful native text exists
- create an OCR strategy interface but do not require full OCR implementation

Do not implement an EARIST-template-specific parser until samples are supplied.

## DL-5 — EARIST COR parser (blocked on sample)

Prerequisite: user/client supplies representative authoritative COR PDF format(s).

Scope:
- deterministic template/version detection
- positional/anchor extraction for Student Number, Name, Program, Department/College and other confirmed fields
- normalization and validation
- Admin UI prefills suggestions alongside actual COR
- Admin confirmation/correction remains required

## DL-6 — Defense supporting evidence lifecycle

Scope:
- Title stage package/COR/receipt
- Proposal application COR/receipt
- Final application COR/receipt
- apply shared validation/metadata/cleanup/versioning
- support correction/resubmission without reuploading unrelated authoritative documents
- retain stage binding and existing eligibility rules

Do not add payment processing; receipt is a proof file only.

## DL-7 — Proposal/Final manuscript integration

Scope:
- migrate existing Adviser manuscript uploads onto shared storage/metadata services
- preserve Request Changes -> resubmit lifecycle
- preserve exact `AdviserCertification.reviewedDocumentId`
- preserve write-once behavior after `ISSUED`
- preserve CP8 authorized historical Proposal access during Final

No latest-file authority fallback.

## DL-8 — Admin document review and history

Scope:
- workflow-aware views for Admin-owned document review
- current version + historical versions
- rejection/request-resubmission reason where Admin owns review authority
- read-only views for Adviser/evaluator/system-owned official records
- no generic filesystem delete/rename/move UI

Exact per-document review states must reuse current application semantics unless a concrete need for document-level status is demonstrated and reviewed.

## DL-9 — Research Databank archival refactor

Scope:
- replace current mock Student Databank upload with real controlled archival flow
- remove `mock-thesis-id-123` and fabricated `/uploads/databank/...` paths
- bind archive entries to authenticated student's real completed research context
- reference managed documents instead of duplicate uploads where authoritative policy permits
- keep archive private/restricted by default

OPEN blocker: authoritative post-Final archival manuscript/correction policy.

## DL-10 — Research Repository publication separation

Scope:
- separate publication projection/decision from archival storage
- fix frontend/backend route contract mismatches
- expose only approved metadata and explicitly permitted publication artifact
- do not expose respondent/raw participant data without confirmed policy
- authorization/public browse/download behavior tested explicitly

## DL-11 — Storage health and operations

Scope:
- technical/admin health summary: object count/bytes, local disk capacity where applicable, stale temp files, missing/orphan records, upload failures
- explicit integrity scan capability
- no automatic destructive cleanup from normal Admin UI
- document production backup/restore procedure and monitoring hooks

## DL-12 — Migration/backfill and production-readiness verification

Scope:
- safe schema migration/backfill of legacy document rows
- deterministic integrity verification
- full backend tests/build/Prisma checks
- frontend typecheck/lint/build
- upload/resubmit/review matrices for Applicant, Title, Proposal, Final
- negative authorization tests
- deployment persistence test/rehearsal
- backup/restore rehearsal where environment permits

## Required regression invariants across all packages

- Applicant extraction never auto-promotes.
- Applicant promotion requires Admin verification and remains atomic.
- Proposal/Final certification authority remains exact-document based.
- Title has no numerical evaluator scoring.
- scores never auto-determine outcome.
- RAP `FINALIZED` remains the completion authority.
- Student never uploads system-owned RAP/Adviser Certification/Summary/Criteria.
- Admin does not gain academic override permissions.
- Panelist access remains assignment/stage scoped.
- Research Variables remains nonblocking where previously accepted.

## Open institutional decisions

Track, do not invent:
- exact allowed file types per document category
- exact post-Final correction/archive submission step
- Databank retention rules
- Repository download/publication policy
- respondent-data/instrument access policy
- legal/records retention/deletion periods
- whether malware scanning/CDR is mandatory and what service is approved.