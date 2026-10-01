# Document Lifecycle Source of Truth

Status: Canonical design baseline for `refactor/document-lifecycle`.
Scope: all user-uploaded and system-owned documents that participate in Applicant, Student, Thesis/Defense, Research Databank, and Research Repository workflows.

## 1. Non-negotiable principles

1. Files are private by default. A database record or storage object must never imply public access.
2. Every upload is bound to an authenticated actor and a business context; the client must not choose ownership or authority.
3. Server-side validation is authoritative. Client `accept`, filename extension, and client MIME are hints only.
4. A rejected or superseded submission is not silently overwritten. Resubmission creates a new version/history record unless a specific legacy model is being migrated.
5. Workflow authority determines the official version. 'Latest upload' is never a universal authority rule.
6. Admin review, Adviser review, evaluator actions, and system-owned records remain separate authorities.
7. Direct storage paths are implementation details and are not API contracts.
8. Applicant COR extraction assists review only. Extraction must never promote an Applicant automatically.
9. Databank and Research Repository are distinct business concepts even if they share storage infrastructure.
10. Accepted Defense Workflow semantics remain authoritative and must not be weakened by this refactor.

## 2. Document classes and authority

| Class | Typical examples | Uploader/creator | Primary reviewer/authority | Public by default? |
|---|---|---|---|---|
| Applicant evidence | Certificate of Registration (COR) | Applicant | Admin | No |
| Defense supporting evidence | COR, receipt/proof image/file, Title package | Student | Admin/workflow gate as currently defined | No |
| Proposal/Final manuscripts | Proposal chapters, Final manuscript | Student | Active Adviser | No |
| Official defense records | Criteria, Oral Examination Summary, RAP, conclusion | System / assigned defense actors | Existing Defense authority | No |
| Research Databank archive | Approved archival metadata/files | Determined by archival workflow | Admin/archive authority | No |
| Research Repository publication | approved metadata and permitted publication artifact | Derived from approved archive | publication/Admin authority | Only explicitly published content |

## 3. Shared document metadata

The target shared metadata capability must support, where applicable:

- `uploadedBy`, `uploadedAt`
- `reviewedBy`, `reviewedAt`, `reviewStatus`, `reviewRemarks`
- `version` and/or `supersedesDocumentId`
- `originalFilename`
- `verifiedMimeType`
- `sizeBytes`
- cryptographic checksum (prefer SHA-256 at application level)
- storage provider/key abstraction (`storageKey`), not a public URL
- document/business type and context (owner, thesis, defense stage, application, etc.)
- optional processing metadata: extraction method/status/version, scan status

These fields need not all live on one universal table. The architecture may use shared storage metadata plus domain-specific records, provided authority and history are unambiguous.

## 4. Applicant COR lifecycle

Canonical flow:

Applicant passes required entrance-exam gate -> uploads COR -> secure validation/storage -> native PDF text extraction when possible -> extracted values shown as suggestions -> Admin compares against the actual COR -> Admin confirms/corrects values -> one transaction verifies the COR and promotes Applicant to Student.

Rules:

- Applicant may upload PDF/JPEG/PNG only according to the confirmed COR policy. Current backend already validates magic bytes for these types.
- Native PDF text extraction is first priority for text-based PDFs. OCR is fallback for scanned/image-only PDFs and may remain deferred initially.
- Extracted values and confirmed values are different concepts.
- Admin verification is mandatory before role promotion.
- Promotion must remain transactional: verified COR, confirmed student data, enrollment state, Student number, and `APPLICANT -> STUDENT` role transition must not partially commit.
- A rejected COR may be resubmitted. The rejected version remains auditable; the next upload becomes the current pending version.
- A pending COR blocks another active pending upload, but a rejected upload must not permanently block resubmission.

Target extracted fields will be finalized after authoritative EARIST COR samples are supplied. Expected candidates include Student Number, Name, Program, Department/College, academic year, and semester. Do not invent parser rules before samples are available.

## 5. Defense document lifecycle

### Title

- Student uploads confirmed Title-stage evidence (currently Title proposal/package, COR, and receipt/proof).
- Evidence must be stage-bound to `TITLE`.
- Title has no Proposal/Final numerical-scoring semantics.

### Proposal

- Student manuscript submission for Adviser review is distinct from final Defense application evidence.
- Student may resubmit a new Proposal manuscript after Adviser Request Changes.
- Once Proposal Adviser Certification is `ISSUED`, the exact `reviewedDocumentId` is authoritative and ordinary Student replacement is blocked.
- Proposal Defense application supplies only the supporting evidence currently required by the accepted workflow (COR and receipt/proof); it must not ask for a second manuscript upload.

### Final

- Same authority pattern as Proposal.
- Final manuscript may be resubmitted during Adviser review until certification is issued.
- Exact Final `AdviserCertification.reviewedDocumentId` is authoritative.
- Final application supplies supporting evidence without duplicating the certified manuscript.

### Supporting evidence resubmission

Rejected/corrected COR or receipt/proof evidence should support replacement by a new version without requiring unrelated accepted/certified documents to be reuploaded. Exact review granularity (application-level rejection versus per-document review states) is an implementation/design decision and must preserve current workflow semantics.

## 6. System-owned records

Adviser Certification, evaluator Criteria, Oral Examination Summary, RAP, signatures, and formal Defense conclusions are not Student uploads. They must remain generated/persisted by their authoritative workflows. Admin does not gain a generic replace/delete override through document management.

## 7. Databank versus Research Repository

Research Databank = controlled archival record and potentially restricted research materials.

Research Repository = discovery/publication layer containing only explicitly approved metadata and permitted publication artifacts.

Rules:

- Repository publication must not be implemented as an unrelated second upload pipeline when a verified archival source can be referenced.
- `isPublic` alone is not sufficient conceptual separation for all future archive/privacy rules.
- Respondent/raw participant data must not be exposed merely because a research entry is published. Access requires an explicit institutional/privacy policy.
- The exact post-Final archival manuscript and publication-approval policy remain OPEN until confirmed.

## 8. Storage and retrieval

- Production storage must be persistent across process restarts and application deployments.
- Local VPS storage is acceptable for a single-node deployment when placed outside the application release/webroot, permissioned to the service account, monitored, and backed up.
- Object storage may be adopted later through the same storage abstraction; business services must not depend on absolute filesystem paths.
- Ordinary retrieval goes through authenticated/authorized document handlers or controlled time-limited object access.
- Direct `/uploads/...` access remains forbidden.
- Missing physical objects, orphan objects, integrity mismatches, and capacity pressure must be detectable.

## 9. Admin capabilities

Admin document management is workflow-aware, not a generic filesystem manager.

Allowed examples:
- view authorized evidence
- verify/accept where Admin owns review authority
- reject/request resubmission with reason
- view version/history and metadata
- inspect storage/integrity health when authorized

Not allowed by default:
- arbitrary physical delete/rename/move
- replacing certified manuscripts
- overriding Adviser/evaluator/Chairman/RAP authority
- publishing restricted data without an explicit publication decision

## 10. Current-code audit classification

### KEEP
- authenticated document streaming through `/api/documents/...`
- direct `/uploads` blocking
- `PRIVATE_UPLOAD_ROOT` concept
- random server-generated filenames
- `file-type` magic-byte validation already used by Applicant COR and Adviser manuscript flows
- Applicant COR transactional `verifyAndPromote` path
- Proposal/Final exact `reviewedDocumentId` authority
- stage-aware Panelist document authorization and CP8 prior-Proposal exception

### REFACTOR
- shared Multer currently writes immediately into the permanent upload root before all workflow validation completes
- Defense Title/COR/receipt supporting uploads lack the same content validation/cleanup discipline as COR/manuscript services
- `ThesisDocument` lacks original filename, verified MIME, size, checksum, uploader and version/supersession metadata
- file serving infers MIME from stored random filenames; extensionless stored files may become `application/octet-stream`
- absolute/relative `filePath` is coupled to storage implementation
- Applicant COR has overlapping Admin pathways (`/cor/*` and `/admin/applicants/*`) that should converge on one authority
- OCR fields and Tesseract dependency exist, but active extraction behavior is not a reliable implemented contract

### REPLACE / COMPLETE
- Student Databank submission is a stub using `mock-thesis-id-123` and fabricated `/uploads/databank/...` paths instead of real uploads
- Repository/Databank frontend route contracts are inconsistent with current backend routes
- `ELibrary` currently conflates archival record and publication state too heavily for the target lifecycle

### ADD
- storage provider abstraction and stable `storageKey`
- upload validation policy per document type
- temp/quarantine -> validate -> promote-to-permanent lifecycle (or equivalent atomic-safe pattern)
- checksum/size/original filename metadata
- generic failure cleanup and orphan detection
- version/supersession history for resubmittable documents
- storage integrity/health metrics
- native PDF extraction service for COR with parser-versioning; OCR fallback interface
- tests for malicious/invalid uploads, cleanup, authorization, versioning, missing objects, and deployment persistence assumptions

### DEFER / NEEDS INSTITUTIONAL CONFIRMATION
- exact allowed formats per document category beyond current confirmed behavior
- exact post-Final archival manuscript/correction process
- which Databank materials are publishable/downloadable
- respondent data/instrument access policy
- retention periods and legal/records deletion policy
- malware scanning/CDR operational requirement and provider

## 11. Supersession

This document governs the new Document Lifecycle work. Existing Defense source-of-truth documents remain authoritative for Defense business rules. If this document conflicts with accepted Defense semantics, Defense semantics win until an explicit reviewed update is made.