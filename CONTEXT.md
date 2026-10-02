# Project Context: EARIST Graduate School Information System

> **Agent instruction:** Read this file first for project orientation, then read the canonical documents listed below before implementing or changing any domain behavior.
>
> **Important:** `CONTEXT.md` is an onboarding/index document. It is **not** the highest authority for detailed Defense or Document Lifecycle rules. When this file and a canonical source-of-truth document differ, the canonical source-of-truth document wins.

---

## 1. Current project state

Repository:

`MuelTech/graduate-system`

Active initiative branch:

`refactor/document-lifecycle`

Document Lifecycle documentation baseline:

`8815f68e0242a84bf8b235b7f9914af8249243e5`  
`docs: define document lifecycle architecture`

The branch was created from the accepted/current Defense correction branch checkpoint:

`refactor/defense-workflow-corrections`  
`ef62ff302386142ebab098668102cdf7a6e429e3`

Document Lifecycle production implementation has **not** started yet. The next implementation package is **DL-1 — Core storage metadata and provider abstraction** after this context refresh is reviewed.

### Historical Defense checkpoint

The backend/domain correction pass CP1-CP10 was completed and accepted. CP10 was accepted at:

`5de128505cfe356388c441ff3aa7c3ed0756eb11`

Seven later frontend/docs integration commits advanced the Defense correction branch to `ef62ff...`. Those later commits did not change the accepted backend Defense semantics.

Do not resume old WP/CP roadmaps as if they were pending work. They are implementation history unless a current canonical plan explicitly references them.

---

## 2. Canonical documentation hierarchy

Read these in this order for work that touches Thesis/Defense or documents.

### Tier 1 — canonical business/domain rules

1. `docs/superpowers/DEFENSE_WORKFLOW_SOURCE_OF_TRUTH.md`
2. `docs/superpowers/DOCUMENT_LIFECYCLE_SOURCE_OF_TRUTH.md`

### Tier 2 — current technical design

3. `docs/superpowers/specs/2026-09-26-defense-session-workflow-design.md`
4. `docs/superpowers/specs/2026-10-02-document-lifecycle-storage-design.md`

### Tier 3 — current implementation plans

5. `docs/superpowers/plans/2026-09-26-post-qa-defense-workflow-corrections.md` — completed correction history/reference
6. `docs/superpowers/plans/2026-10-02-document-lifecycle-implementation.md` — active plan

### Tier 4 — implementation reference/history

7. `docs/superpowers/STUDENT_THESIS_JOURNEY_IMPLEMENTATION_REFERENCE.md`

Historical documents remain useful background but are superseded where they conflict with newer canonical sources, especially:

- `docs/superpowers/specs/2026-09-25-student-thesis-journey-design.md`
- `docs/superpowers/plans/2026-09-25-student-thesis-journey-refactor.md`

### Conflict rule

When sources disagree:

```text
Current repository code
+ current canonical SOURCE_OF_TRUTH
+ current accepted spec/plan
        ↓
wins over
        ↓
old CONTEXT.md text / old plans / comments / retired branches
```

Do not infer EARIST institutional policy from stale code, old documents, or UI labels.

---

## 3. System overview

```text
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js)                   │
│                    App Router                           │
├─────────────────────────────────────────────────────────┤
│ shadcn/ui │ Tailwind │ TanStack Query │ NextAuth       │
└─────────────────────────────────────────────────────────┘
                           │
                       JWT/API
                           │
┌─────────────────────────────────────────────────────────┐
│                    BACKEND (Express)                    │
├─────────────────────────────────────────────────────────┤
│ Route → Controller → Service → Repository → Prisma     │
└─────────────────────────────────────────────────────────┘
                           │
                    MariaDB / MySQL
```

Use package manifests as the authority for exact dependency versions. Current major technologies include:

- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui
- TanStack Query
- NextAuth
- Express
- Prisma
- MariaDB/MySQL
- JWT
- Multer
- `file-type`
- `pdf-lib`
- Tesseract.js dependency exists, but OCR is **not** the primary COR extraction strategy
- PM2/Nginx deployment direction

---

## 4. Repository structure

```text
graduate-system/
├── frontend/
│   └── src/
│       ├── app/
│       │   ├── (auth)/
│       │   ├── (public)/
│       │   └── (portal)/
│       │       ├── admin/
│       │       ├── applicant/
│       │       ├── student/
│       │       └── panelist/
│       ├── components/
│       ├── lib/
│       ├── types/
│       ├── auth.ts
│       └── middleware.ts
├── backend/
│   ├── src/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── repositories/
│   │   ├── routes/
│   │   ├── middlewares/
│   │   ├── interfaces/
│   │   ├── config/
│   │   └── utils/
│   └── prisma/
│       ├── schema.prisma
│       ├── migrations/
│       └── seed.ts
└── docs/
    └── superpowers/
        ├── *_SOURCE_OF_TRUTH.md
        ├── specs/
        └── plans/
```

---

## 5. Coding conventions

### Backend layering

Primary pattern:

```text
Route → Controller → Service → Repository → Prisma
```

Responsibilities:

- **Route:** authentication, role middleware, multipart middleware, route composition.
- **Controller:** HTTP request/response mapping and basic boundary checks.
- **Service:** business rules, authorization decisions not handled by generic middleware, lifecycle logic.
- **Repository:** Prisma/data access and database transaction implementation.
- **Prisma schema/migrations:** durable model and constraints.

Do not bypass established layers casually. However, existing patterns are **not immutable**: the active Document Lifecycle work intentionally refactors storage/upload plumbing while preserving domain behavior.

### Database

- Prisma model names: PascalCase.
- Mapped table/column names: snake_case.
- New schema changes require new migrations.
- Do not rewrite historical migrations unless a concrete replay defect is proven.
- Use transactions for multi-record authority transitions.

### Frontend

- Reuse existing UI components before adding duplicates.
- Use the shared `DataTableFilter` for Admin list filters where applicable.
- Use TanStack Query for client data fetching/mutations.
- Follow established EARIST CSS variables.
- Backend/domain state remains authoritative; UI state must not invent academic progression.

### Error handling

Use `AppError` for expected operational errors and preserve meaningful HTTP status codes.

---

## 6. Accepted Defense Workflow summary

This is a short orientation only. The Defense source of truth controls all details.

### 6.1 Title Defense

Canonical progression:

```text
Title deliberation
→ Rapporteur finalizes notes
→ AWAITING_CONCLUSION
→ Chairman explicitly records formal result
   + selects official title when PASSED
→ RAP FOR_SIGNATURE
→ required signatures
→ RAP FINALIZED
→ Title stage complete
→ Adviser Request unlocks
```

Title completion requires all three:

1. formal Title outcome = PASSED;
2. one official selected title;
3. matching Title RAP = FINALIZED.

Title does **not** use Proposal/Final Group I/II numerical scoring.

### 6.2 Proposal / Final Defense

Canonical progression:

```text
Evaluator DRAFT
→ evaluator e-sign/finalize
→ all required evaluator records FINALIZED
→ persistent Oral Examination Summary
→ Rapporteur finalizes notes
→ Chairman successfully reviews detailed Summary
→ Chairman explicitly records formal result
→ RAP FOR_SIGNATURE
→ PARTIALLY_SIGNED
→ FINALIZED
→ stage complete
```

Critical rules:

- scores/averages never automatically PASS or FAIL the defense;
- the Chairman records the formal academic result for the exact defense session;
- Chairman authority comes from authenticated session assignment, not broad account role alone;
- Proposal/Final result submission requires successful detailed Summary loading;
- only actual assigned evaluators with FINALIZED scores contribute to the Summary;
- Facilitator, Rapporteur, Adviser, legacy non-evaluators, and drafts are excluded unless a future confirmed policy explicitly changes evaluator status;
- `finalRating` remains nullable where the average-to-rating institutional formula is unresolved.

### 6.3 RAP

Canonical active lifecycle:

`FOR_SIGNATURE → PARTIALLY_SIGNED → FINALIZED`

Only `FINALIZED` completes the stage.

Current centralized signatory policy uses Chairman + evaluator Panelist roles. Do not silently add Facilitator, Rapporteur, Adviser, or Dean as required signatories.

RAP is system-owned. Students do not upload/reupload RAP.

### 6.4 Defense authority boundaries

- **Evaluator:** own evaluation only.
- **Rapporteur:** session notes and irreversible note finalization.
- **Chairman:** formal result for the exact assigned session.
- **RAP signatory:** own signature slot only.
- **Admin:** scheduling and read-only official Defense Records; no score/notes/title/result edits and no RAP lifecycle override.
- **Student:** own workflow and own authorized official records; no other evaluator Criteria.
- **Facilitator:** no digital action currently.
- **Adviser:** no evaluator scoring unless explicitly configured/confirmed.

---

## 7. Adviser Request / GS-020

Title completion unlocks Adviser Request.

Canonical flow:

```text
Student selects eligible candidate
→ requested Adviser CONFORME / Decline
→ Dean decision
→ active AdviserAssignment only after Dean approval
```

Rules:

- pending request is not an active AdviserAssignment;
- CONFORME alone is not Dean approval;
- candidate source derives from the passed Title ODP under the accepted policy;
- Facilitator and Rapporteur are excluded;
- external panelists cannot receive new Adviser Requests or become active advisers;
- internal panelist adviser availability must respect `isAvailableAsAdviser`;
- Student does not upload generated GS-020.

---

## 8. Proposal / Final manuscript authority

### Proposal pre-defense

```text
active Adviser
→ Student manuscript
→ Adviser review
→ REQUEST CHANGES / resubmit as needed
→ Adviser e-signs Proposal Adviser Certification
→ exact certified manuscript becomes authoritative
→ Student supplies Proposal COR + receipt/proof
→ Admin review/scheduling
```

The Proposal Defense application must **not** ask the Student to upload a duplicate Proposal manuscript.

### Final pre-defense

```text
Proposal complete + active Adviser
→ Final manuscript
→ centralized STRIKE check if configured
→ Adviser review
→ REQUEST CHANGES / resubmit as needed
→ Final Adviser Certification
→ exact certified Final manuscript becomes authoritative
→ Student supplies Final COR + receipt/proof
→ Admin review/scheduling
```

Proposal and Final certifications are distinct records.

### Exact-document rule

For Proposal and Final, the authoritative current manuscript is the exact:

`AdviserCertification.reviewedDocumentId`

Never replace this with a generic “latest ThesisDocument” fallback.

After certification is `ISSUED`, ordinary Student replacement is blocked.

---

## 9. Document Lifecycle initiative

The system is moving from several ad-hoc upload paths to one secure document infrastructure with domain-specific authority layered on top.

### 9.1 Non-negotiable principles

- Files are private by default.
- Every upload is bound server-side to an authenticated actor and business context.
- Client MIME/filename/extension are not authoritative.
- Workflow authority determines the official version; “latest upload” is not a universal authority rule.
- Rejected/superseded documents are not silently overwritten.
- Storage paths/keys are implementation details, not public API contracts.
- Admin, Adviser, evaluator, Chairman, and system-owned records retain separate authorities.
- Databank and Research Repository remain separate business concepts.

### 9.2 Target metadata capability

Where applicable, managed documents should support:

- uploader and upload time;
- reviewer, review time, review status, review remarks;
- version and/or `supersedesDocumentId`;
- original filename;
- verified MIME type;
- size in bytes;
- checksum (target SHA-256);
- stable storage key/provider abstraction;
- domain context (Applicant COR, thesis, defense stage, application, archive/publication, etc.);
- optional extraction/scan status.

Do **not** assume all metadata must live in one universal mega-table. Shared storage metadata plus domain records is acceptable if authority is clear.

### 9.3 Target upload flow

```text
authenticate / authorize business action
→ enforce multipart count + size limits
→ temporary/private write
→ actual content-type / magic-byte validation
→ size + checksum
→ optional extraction/security processing
→ DB/domain metadata transaction
→ promote/commit permanent object
→ cleanup on any failure
```

The exact filesystem/object-store transaction choreography may differ, but failed requests must not leak unbounded orphan files and accepted DB records must not silently reference missing objects.

---

## 10. Current upload/storage implementation audit

### KEEP

- `PRIVATE_UPLOAD_ROOT` concept;
- direct `/uploads` access is blocked;
- authenticated `/api/documents/.../file` retrieval;
- random server-generated physical filenames;
- `file-type` magic-byte validation in Applicant COR and Adviser manuscript flows;
- Applicant COR cleanup on validation/DB failure;
- Applicant COR transactional verify/promote path;
- Proposal/Final exact `reviewedDocumentId` authority;
- stage-aware Panelist ThesisDocument access;
- CP8 narrow access to authoritative prior Proposal during Final.

### REFACTOR

- shared Multer writes into the current upload root before all business validation;
- Title/Proposal/Final supporting COR/receipt files do not yet share the same strong validation/cleanup pipeline;
- `ThesisDocument` lacks original filename, verified MIME, size, checksum, uploader, version/supersession metadata;
- current document MIME serving can fall back incorrectly for random extensionless stored filenames;
- `filePath` couples domain rows to storage implementation;
- Applicant COR has overlapping Admin service/routes that should converge on one authority;
- existing OCR-related schema/dependency must not be treated as proof that OCR is the active/primary extraction strategy.

### REPLACE / COMPLETE

- Student Databank submission currently contains mock/fabricated upload behavior;
- current Repository/Databank frontend route contracts contain mismatches with backend routes;
- current `ELibrary` model/service usage conflates archive/publication concepts more than the target design permits.

### ADD

- storage provider abstraction + stable `storageKey`;
- shared per-document upload policy;
- checksum and richer metadata;
- version/supersession lifecycle;
- generic failure cleanup/orphan detection;
- integrity/storage-health reporting;
- native COR PDF extraction service;
- OCR fallback interface;
- production persistence/backup/restore guidance and verification.

---

## 11. Applicant COR lifecycle

Applicant COR is enrollment evidence uploaded after the required entrance-exam gate.

Current canonical target flow:

```text
Applicant passes required exam gate
→ uploads COR
→ secure validation/storage
→ native PDF text extraction when possible
→ extracted values become suggestions
→ Admin reviews actual COR + suggested values
→ Admin confirms/corrects values
→ one transaction:
     verify COR
     save confirmed data
     enroll Student profile
     assign Student Number
     APPLICANT → STUDENT
→ commit
```

### Critical authority rule

**PDF extraction or OCR must never automatically promote an Applicant to Student.**

Extraction is assistive only. Admin verification remains authoritative.

### Extraction priority

For PDF COR documents:

1. **native PDF text extraction first** for PDFs with a usable text layer;
2. deterministic COR-template parsing after authoritative EARIST sample(s) are provided;
3. OCR only as fallback for scanned/image-only or unusable-text PDFs;
4. manual review remains a safe fallback.

The target Node implementation should expose a native PDF extraction strategy with positional text information. The current design prefers PDF.js/`pdfjs-dist` for this purpose, subject to implementation review.

Do not hardcode EARIST COR labels/coordinates until representative official COR format(s) are supplied.

### COR resubmission

- PENDING upload may block a second active pending upload.
- REJECTED upload must allow resubmission.
- New submission becomes a new version/history item; do not silently overwrite the rejected file.
- Admin should be able to review the current version and history.

---

## 12. COR / receipt terminology

There is **no payment-processing feature** in this system.

“Receipt” means a Student-uploaded **file/image used as proof for thesis/defense requirements**.

Do not add:

- payment gateway logic;
- billing;
- online transaction processing;
- payment settlement/status integration.

Use language such as:

- COR;
- receipt/proof;
- supporting evidence;
- supporting requirement document.

---

## 13. Databank vs Research Repository

These must not be treated as synonyms.

### Research Databank

Controlled archival/source collection for institutional research records.

May include:

- archival metadata;
- approved archival manuscript reference;
- controlled/restricted materials where policy permits;
- publication-readiness state.

Private/restricted by default.

### Research Repository

Publication/discovery layer derived from approved archival material.

May expose only explicitly permitted:

- title;
- author;
- program/year;
- abstract;
- keywords;
- approved publication artifact;
- permitted view/download behavior.

### Critical privacy rule

Respondent/raw participant data must **not** become public merely because a record is published.

The exact rules for respondent data, research instruments, Repository download access, and post-Final archival manuscript remain institutional-policy questions.

### Avoid duplicate upload architecture

Preferred direction:

```text
managed authoritative document
        ↓
Databank/archive reference
        ↓
explicit publication decision
        ↓
Repository projection/access
```

Do not build three unrelated physical upload pipelines for Defense, Databank, and Repository when a verified managed document can be referenced safely.

---

## 14. Storage and retrieval security

### Current retrieval model

Files are served through authorized application endpoints rather than direct public paths.

Preserve:

- authentication;
- owner/domain authorization;
- active-user checks;
- stage-aware Panelist checks;
- path/root containment;
- symlink-safe realpath validation for local storage;
- no-store behavior for sensitive records;
- audit logging for material views/denials.

### Target production storage

Development default `UPLOAD_DIR=./uploads` is not a production architecture decision.

For single-node deployment, persistent local private storage is acceptable when:

- outside disposable application release directories;
- outside public webroot;
- owned/permissioned for the service account;
- backed up together with database state;
- capacity/integrity monitored;
- restore procedure is tested.

The storage abstraction must permit future S3-compatible/shared storage without changing Defense or Applicant domain rules.

---

## 15. Storage monitoring

Storage monitoring is an operational feature, not a generic file manager.

Useful technical/Admin health information may include:

- total managed objects/bytes;
- free/capacity threshold for local disk;
- stale temporary uploads;
- failed uploads;
- orphan physical objects;
- DB references whose file is missing;
- checksum mismatches from explicit integrity scans;
- reliable backup-status signal if deployment exposes one.

Do not expose arbitrary folder browsing, physical rename/move, or unrestricted delete controls.

Operational backup/restore and monitoring guidance (single-node private local storage) is documented in:

`docs/operations/storage-backup-restore.md`

The Admin storage health surface is read-only (detect/report/diagnose only). It has no delete, repair, move, rename, checksum-rewrite, or backfill controls.

Production readiness, legacy storage metadata backfill (dry-run/apply CLI), and deployment verification are documented in:

`docs/operations/document-lifecycle-production-readiness.md`

Backfill is an explicit operator action only (never automatic, never in the Admin UI), adds metadata pointing at the existing contained object, and never copies/moves/deletes files or removes `filePath`.

---

## 16. Admin document authority

Admin document management must be workflow-aware.

### Admin may

- view documents they are authorized to review;
- verify/reject/request replacement where Admin owns that authority;
- see document history/metadata;
- inspect official records read-only where applicable;
- access storage health if the role/policy permits.

### Admin must not automatically gain power to

- replace certified Proposal/Final manuscripts;
- edit evaluator Criteria;
- edit the Oral Examination Summary;
- change Chairman conclusions;
- override RAP signatures/lifecycle;
- replace system-owned Adviser Certification/RAP records;
- publish restricted research material without an explicit publication decision.

---

## 17. Committee policy — known and unresolved

Confirmed client shorthand:

- Master's: 5 panelists + 1 Facilitator + 1 Rapporteur.
- Doctoral: 6 panelists + 1 Facilitator + 1 Rapporteur.

Current forms add nuance, especially Master's GS-006 Adviser vs Panelist rows.

Do not hardcode “5 Master's scorers” until evaluator/adviser interpretation is confirmed.

Keep evaluator/signatory policy centralized and derived from functional assignments rather than printed labels alone.

Known unresolved committee questions include:

- exact Master's evaluator count;
- Adviser scoring/concurrence behavior;
- whether the same person may be evaluator + Rapporteur;
- stage-to-stage committee reuse/re-defense policy.

---

## 18. Other unresolved institutional decisions

Do not invent these:

- Proposal/Final average-to-rating boundaries;
- GS-011 Adviser concurrence / Dean attestation e-sign details;
- exact RAP printed layout;
- re-defense/multiple-attempt policy;
- broad account terminology refactor from `PANELIST` to a wider faculty model;
- exact post-Final clearance/corrected archival manuscript authority;
- exact file-type policy by document category beyond confirmed current behavior;
- Research Databank retention;
- Repository publication/download rules;
- respondent-data/instrument access;
- formal retention/deletion periods;
- malware scanning/CDR requirement/provider.

When implementation reaches one of these boundaries, fail closed or surface the decision rather than inventing policy.

---

## 19. Data and privacy rules

- Backend/domain records are authoritative over UI display state.
- Application `APPROVED` is not Defense `PASSED`.
- Scheduled is not completed.
- Scores complete is not formal conclusion.
- Average is not automatic PASS/FAIL.
- PASSED is not RAP FINALIZED.
- Adviser CONFORME is not Dean approval.
- Requested Adviser is not active Adviser.
- Current Proposal/Final authority is not arbitrary document history.
- Files are private unless an explicit workflow/publication policy says otherwise.
- Ordinary APIs should not serialize raw Base64 signature image payloads.
- Signature images belong only in authorized official rendering/use.

---

## 20. Testing and validation conventions

Use package-appropriate checks.

Backend packages commonly require:

- focused unit/integration tests;
- backend build/typecheck;
- Prisma generate/migration validation when schema changes;
- deterministic fixture checks when relevant.

Frontend packages commonly require:

- typecheck/lint/build as available;
- focused functional inspection;
- manual browser QA when executable.

Document/storage packages additionally need negative tests for:

- MIME spoofing;
- unsupported content;
- oversized uploads;
- failed-transaction cleanup;
- unauthorized retrieval;
- path traversal/symlink escape;
- missing objects;
- version/supersession behavior;
- legacy `filePath` compatibility;
- persistence across deployment/restart assumptions where environment permits.

Do not turn every bounded package into an unrelated full-system rewrite.

---

## 21. Work-package and review protocol

The project owner uses a strict package/review workflow.

For every implementation package:

1. verify the exact remote branch HEAD before work;
2. read current canonical docs;
3. implement one bounded package only;
4. run package-appropriate validation;
5. commit and push;
6. report exact changed files, tests/build, migration status, worktree/push state;
7. stop;
8. independent review verifies the **actual remote commit/diff** rather than trusting the implementation report;
9. only an accepted package allows progression to the next package.

If rejected, fix the same package. Do not advance automatically.

No merge, force push, branch deletion, or unrelated feature work unless explicitly authorized.

---

## 22. Active Document Lifecycle package roadmap

Current active plan:

```text
DL-0  Documentation/audit baseline — COMPLETE
↓
DL-1  Core storage metadata + provider abstraction — NEXT
↓
DL-2  Secure upload pipeline + cleanup
↓
DL-3  Applicant COR lifecycle consolidation
↓
DL-4  Native COR PDF extraction framework
↓
DL-5  EARIST COR parser — BLOCKED until COR sample is supplied
↓
DL-6  Defense supporting evidence lifecycle
↓
DL-7  Proposal/Final manuscript integration
↓
DL-8  Admin document review/history
↓
DL-9  Research Databank archival refactor
↓
DL-10 Research Repository publication separation
↓
DL-11 Storage health/operations
↓
DL-12 Migration/backfill + production-readiness verification
```

The exact active plan is maintained in:

`docs/superpowers/plans/2026-10-02-document-lifecycle-implementation.md`

If this summary and the active plan differ, the active plan wins.

---

## 23. Development commands

Use package scripts from the current manifests.

Typical backend:

```bash
cd backend
npm run build
npm test
npx prisma generate
npx prisma migrate dev
npx prisma db seed
```

Typical frontend:

```bash
cd frontend
npm run dev
npm run build
```

Do not assume every command is required for every package. Run the checks appropriate to the changed scope.

---

## 24. Important implementation rules

1. Read this file for orientation, then read the relevant canonical source-of-truth/spec/plan.
2. Preserve accepted business behavior unless an approved canonical document explicitly changes it.
3. Do not treat old plans, retired branches, comments, or UI text as institutional authority.
4. Do not add new policy to resolve an ambiguity.
5. Use backend checks for security/authority; hiding a frontend button is not authorization.
6. Use transactions for atomic multi-record authority transitions.
7. Keep storage mechanics separate from domain authority.
8. Never trust client MIME/filename/extension as proof of content.
9. Never expose private storage paths as public document URLs.
10. Clean up failed uploads and design for orphan/missing-object detection.
11. Use exact certified Proposal/Final document authority via `reviewedDocumentId`.
12. Do not let scoring auto-conclude a defense.
13. Do not let document extraction auto-promote an Applicant.
14. Do not turn Databank publication into automatic Repository publication.
15. Do not create a generic Admin filesystem manager.
16. Do not implement payment processing; receipt is supporting proof only.
17. Keep changes bounded to the requested work package.
18. Verify actual remote state before review or next-package planning.

---

## 25. Quick start for a fresh coding-agent session

Before implementing:

1. confirm branch = `refactor/document-lifecycle`;
2. confirm remote HEAD;
3. read this `CONTEXT.md`;
4. read:
   - `docs/superpowers/DEFENSE_WORKFLOW_SOURCE_OF_TRUTH.md`;
   - `docs/superpowers/DOCUMENT_LIFECYCLE_SOURCE_OF_TRUTH.md`;
   - `docs/superpowers/specs/2026-10-02-document-lifecycle-storage-design.md`;
   - `docs/superpowers/plans/2026-10-02-document-lifecycle-implementation.md`;
5. inspect the actual current code involved in the assigned package;
6. implement only that package;
7. stop and report for independent review.

---

*Updated: 2026-10-02 — refreshed after accepted Defense Workflow corrections and creation of the Document Lifecycle architecture. This file is intentionally an onboarding/index document; canonical source-of-truth files govern detailed domain behavior.*
