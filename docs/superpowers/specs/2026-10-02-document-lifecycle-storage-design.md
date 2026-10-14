# Document Lifecycle and Storage Design

Date: 2026-10-02
Branch: `refactor/document-lifecycle`
Base: `ef62ff302386142ebab098668102cdf7a6e429e3`

## 1. Goal

Refactor the current ad-hoc upload paths into a production-ready document platform while preserving accepted Applicant and Defense business authority.

## 2. Current architecture summary

- Shared `multer.diskStorage` writes random extensionless filenames to `PRIVATE_UPLOAD_ROOT` (`UPLOAD_DIR` or `./uploads`).
- `/uploads` is explicitly blocked; `DocumentService` resolves records and streams authorized files.
- Applicant COR is the strongest existing upload path: magic-byte validation, extension correction, original filename/MIME persistence, cleanup on validation/DB failure, pending-upload guard, and transactional verify/promote.
- Proposal/Final Adviser manuscript flows validate file content and cleanup on rejected gates/transaction errors.
- Title/Proposal/Final application supporting files are written by Multer before business validation and do not receive equivalent post-write type validation/cleanup.
- `ThesisDocument` stores stage/type/path but lacks rich storage/version metadata.
- Databank submission UI does not perform real file upload and is not production-ready.

## 3. Target layers

### 3.1 Storage provider

Introduce an internal storage abstraction with operations conceptually equivalent to:

- `putTemporary(stream/file)`
- `promote(tempKey, permanentKey)` or atomic final write
- `openRead(storageKey)`
- `exists(storageKey)`
- `delete(storageKey)` for controlled maintenance/cleanup only
- `stat(storageKey)`

Initial provider may be private local VPS storage. Business code stores a provider/key identity rather than depending on a machine-specific path. An S3-compatible provider can be added later without changing Applicant/Defense authority.

Recommended local production root: a persistent service-owned directory outside the release/webroot (exact path configured by deployment, e.g. `/var/lib/...` or `/srv/...`). Do not bake the example path into domain logic.

### 3.2 Upload policy

Each document category owns an allowlist policy: max size, allowed verified MIME/signatures, optional extension rules, and whether extraction/scanning applies.

Validation order:
1. authenticate and authorize the business action
2. enforce multipart/file-count and byte limits
3. write to temporary/private storage
4. detect actual content type from bytes
5. reject mismatched/disallowed content
6. compute size and checksum
7. run optional extraction/security processing
8. create domain/storage metadata in a transaction
9. promote/commit permanent object
10. cleanup temporary/orphaned object on any failure

Exact transaction choreography differs between filesystem and object storage; the invariant is no accepted DB record should silently point to a failed/missing object, and failed requests must not leak unbounded orphan files.

### 3.3 Metadata

Do not force every domain into one mega-table. Prefer a normalized storage/document metadata entity or compatible extension plus domain records.

Required capabilities:
- stable document id
- storage provider/key
- original filename
- verified MIME
- size bytes
- checksum + algorithm
- uploader identity/time
- version/supersedes relationship when resubmittable
- lifecycle/review metadata where the document itself is reviewed
- domain linkage (Applicant COR, ThesisDocument, archive/publication, etc.)

Legacy `filePath` rows must remain readable during migration. New code may resolve either legacy path or storage key until backfill is complete.

## 4. Retrieval security

Preserve the current authenticated document endpoint model.

- owner/admin/role/domain checks occur before bytes are served
- Panelist ThesisDocument access remains stage-aware
- Final participants receive only the accepted CP8 authoritative prior Proposal exception
- raw storage keys/absolute paths should not be serialized as downloadable URLs
- use stored verified MIME/original filename rather than deriving MIME from an extensionless random stored filename
- continue realpath/root containment checks for local storage
- log material access/denials at a useful level without logging document contents/secrets

## 5. Applicant COR extraction design

### 5.1 Priority

Native PDF extraction first for text-based COR PDFs. OCR is fallback only for scanned/image-only or unusable text PDFs.

Add an extraction service boundary such as:

- `NativePdfTextExtractor` (implement first)
- `OcrExtractor` (interface/design now, implementation deferred unless needed)
- `Manual` fallback

PDF.js is preferred for the first implementation because `getTextContent()` exposes text items plus position/transform data, which supports deterministic label/value extraction from a known COR layout.

Persist extraction method/status and parser/extractor version. Store extracted suggestions separately from Admin-confirmed values.

COR parser implementation is deferred until authoritative EARIST COR samples are supplied. Do not hardcode labels/coordinates prematurely.

### 5.2 Promotion

Admin verification remains the only promotion authority. Native extraction/OCR may prefill Student Number/name/program/department fields but cannot trigger `APPLICANT -> STUDENT` by itself.

Consolidate duplicate Admin COR verification paths around one service/transaction so all UIs apply identical rules.

## 6. Versioning/resubmission

Use append-only version creation for user corrections. A new accepted upload supersedes, but does not physically overwrite, its predecessor.

Examples:
- rejected Applicant COR -> new COR version
- Adviser Request Changes -> new Proposal/Final manuscript version
- corrected supporting COR/receipt -> new evidence version as permitted

Certified Proposal/Final manuscripts are immutable from normal Student upload once Adviser Certification is `ISSUED`; the certificate's `reviewedDocumentId` remains authority.

## 7. Databank and Repository

Refactor the current `ELibrary` concept into two explicit concerns, which may initially share a migration-compatible table/service if necessary:

1. archival/Databank record: controlled, private/restricted by default, references approved archival files and metadata
2. Repository publication: explicit publication decision and permitted public/authenticated projection

Do not expose respondent/raw participant data through Repository merely because the archive record is published.

Prefer reference to an authoritative managed document rather than duplicate physical upload, subject to the unresolved post-Final archival manuscript policy.

## 8. Storage health

Provide lightweight operational visibility, not a filesystem browser:

- total managed objects/bytes where available
- free/capacity threshold for local storage
- temporary objects older than threshold
- orphan physical objects (no DB reference)
- missing objects (DB reference but no file)
- checksum mismatch on explicit integrity scans
- recent upload failures
- last known backup status only if the deployment/backup system exposes a trustworthy signal

Integrity checks report first; do not automatically delete orphan/history records during ordinary Admin actions.

## 9. Deployment and backups

- `UPLOAD_DIR=./uploads` is development-friendly but not a sufficient production decision.
- production deployment must point to persistent storage outside disposable application release directories
- service account gets minimum required filesystem permissions
- backup must include both database and document storage with a restore procedure
- restoration/integrity should be testable, not assumed
- multi-instance/stateless deployment should use shared/object storage rather than node-local disk

## 10. Security research basis

Design follows these external references:

- OWASP File Upload Cheat Sheet: allowlist extensions/types, validate file signatures/content, randomize filenames, limit size, authorize uploaders, store outside webroot/use application handler, consider AV/sandbox/CDR, protect upload endpoints.
- Express Multer documentation: enforce multipart limits; memory storage has memory-exhaustion risk, supporting a disk/temp-streaming approach for this system.
- Mozilla PDF.js API: `getTextContent()` returns text items including strings, transforms/position, dimensions and line-break information suitable for native COR parsing.
- AWS S3 documentation (future provider option): private objects, time-limited presigned access and checksums are available; S3 is optional, not required for a production single-node VPS.

## 11. Compatibility strategy

1. introduce schema additions/backward-compatible storage resolver
2. keep reading legacy `filePath`
3. route new uploads through new storage service
4. migrate/backfill legacy metadata where safely derivable
5. switch consumers away from direct paths
6. only remove legacy path assumptions after verification

No destructive migration is allowed merely for architectural cleanliness.