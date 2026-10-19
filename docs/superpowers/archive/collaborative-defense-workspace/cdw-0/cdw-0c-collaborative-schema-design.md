# CDW-0C — Collaborative schema design review (additive recommendation)

**Package:** CDW-0 (design review), part C
**Date:** 2026-10-16
**Branch:** `refactor/collaborative-defense-workspace`
**Baseline:** `origin/main` @ `68f58b9`
**Status:** RECOMMENDATION ONLY — no schema change applied in CDW-0.
Production migration belongs to **CDW-1**.

---

## 1. Current model facts (verified)

- Assignment model is **`PanelAssignment`** (`panel_id`), `@@unique([scheduleId, userId])`, role enum `PanelRole { CHAIRMAN, PANELIST, ADVISER, RAPPORTEUR, FACILITATOR }`.
- Attempt/session is **`DefenseSchedule`** (`schedule_id`), with `defenseType`, `sessionStatus`, and legacy `rapporteurNotes`.
- Document is **`ThesisDocument`** (`document_id`), with `defenseStage`, `docType`, versioning (`supersedesDocumentId`, `isCurrent`).
- **`RapReport`** (`rap_id`, `@@unique scheduleId`) has `decisionsAndRecommendations`, `status (RapStatus)`, `finalizedAt` — **no freeze/version/hash fields**.
- **`RapReportSignature`** (`sig_id`, `@@unique([rapId, userId])`) has `roleAtDefense`, `required`, `isSigned`, `signatureData`, `signedAt` — **not bound to any content version/hash**.
- There is **no annotation/comment model** anywhere.

## 2. Proposed additive models

Naming/style follows repository conventions (uuid PKs, `@map` snake_case columns, `@@map` snake_case tables).

### 2.1 `DefenseAnnotation`

```prisma
model DefenseAnnotation {
  id                 String   @id @default(uuid()) @map("annotation_id")
  scheduleId         String   @map("schedule_id")
  thesisDocumentId   String   @map("thesis_document_id")
  authorAssignmentId String   @map("author_assignment_id") // -> PanelAssignment (attempt-scoped author)
  pageNumber         Int      @map("page_number")
  selectedText       String   @db.Text @map("selected_text")
  anchorData         Json     @map("anchor_data")          // { rects[], prefix, suffix }
  anchorVersion      Int      @default(1) @map("anchor_version")
  createdAt          DateTime @default(now()) @map("created_at")
  updatedAt          DateTime @default(now()) @updatedAt @map("updated_at")

  schedule           DefenseSchedule @relation(fields: [scheduleId], references: [id])
  thesisDocument     ThesisDocument  @relation(fields: [thesisDocumentId], references: [id])
  author             PanelAssignment @relation(fields: [authorAssignmentId], references: [id])
  comments           DefenseAnnotationComment[]

  @@index([scheduleId, thesisDocumentId])
  @@index([thesisDocumentId])
  @@index([authorAssignmentId])
  @@map("defense_annotations")
}
```

`anchorData` mirrors the CDW-0A anchor (`rects` normalized 0..1 + `prefix`/`suffix`),
so the proven POC format is the persisted format. `pageNumber` is also stored as a
column for querying/sorting; `user` identity is resolved through `authorAssignmentId`.

### 2.2 `DefenseAnnotationComment`

```prisma
model DefenseAnnotationComment {
  id                 String   @id @default(uuid()) @map("comment_id")
  annotationId       String   @map("annotation_id")
  authorAssignmentId String   @map("author_assignment_id")
  body               String   @db.Text
  parentCommentId    String?  @map("parent_comment_id") // optional single-level reply
  createdAt          DateTime @default(now()) @map("created_at")
  updatedAt          DateTime @default(now()) @updatedAt @map("updated_at")

  annotation         DefenseAnnotation @relation(fields: [annotationId], references: [id])
  author             PanelAssignment   @relation(fields: [authorAssignmentId], references: [id])
  parent             DefenseAnnotationComment?  @relation("AnnotationCommentReplies", fields: [parentCommentId], references: [id])
  replies            DefenseAnnotationComment[] @relation("AnnotationCommentReplies")

  @@index([annotationId])
  @@index([authorAssignmentId])
  @@index([parentCommentId])
  @@map("defense_annotation_comments")
}
```

Flat thread with an **optional single parent** for one level of replies (no nested
trees) — matching the SOT's "flat thread / no overengineered nesting" guidance.
No hard delete (history integrity).

### 2.3 Rapporteur report body + freeze/version/hash (additive on `RapReport`)

```prisma
// added to model RapReport
  bodyDocument      Json?     @map("body_document")        // Rapporteur-owned rich-text document model
  bodyVersion       Int       @default(0) @map("body_version")
  bodyUpdatedAt     DateTime? @map("body_updated_at")
  contentVersion    Int       @default(0) @map("content_version")
  frozenAt          DateTime? @map("frozen_at")
  frozenById        String?   @map("frozen_by")
  frozenContent     Json?     @map("frozen_content")       // IMMUTABLE snapshot (body + rendered metadata)
  frozenContentHash String?   @map("frozen_content_hash")  // SHA-256 of canonical serialization

  frozenBy          User? @relation("RapReportFrozenBy", fields: [frozenById], references: [id])
```

- `bodyDocument` is the **free-form rich-text body** (safe JSON document model, no
  fixed mandatory sections). System metadata (student, stage, roster, dates,
  prepared-by, status) is rendered outside the editable body.
- `decisionsAndRecommendations` (legacy) is **kept** for historical readability; no
  destructive overwrite.
- `frozenContent` + `frozenContentHash` are written once by Rapporteur
  Finalize-for-Signatures and never mutated.

### 2.4 Signature → frozen-content binding (additive on `RapReportSignature`)

```prisma
// added to model RapReportSignature
  signedContentHash    String? @map("signed_content_hash")
  signedContentVersion Int?    @map("signed_content_version")
```

Every required signer's slot records the **exact frozen hash/version** they signed.
A signature whose hash ≠ the current frozen hash is not accepted.

## 3. Relationship description

```
DefenseSchedule 1───* DefenseAnnotation          (attempt binding)
ThesisDocument  1───* DefenseAnnotation          (exact document binding)
PanelAssignment 1───* DefenseAnnotation          (author)
PanelAssignment 1───* DefenseAnnotationComment   (author)
DefenseAnnotation 1──* DefenseAnnotationComment  (thread; optional single-level reply)
RapReport       1───* RapReportSignature         (existing; now hash/version-bound)
RapReport.frozenBy ── User                        (freeze actor)
```

Cross-cutting guards: `DefenseAnnotation.scheduleId` and `thesisDocumentId` must be
the **exact** authorized pair for the attempt (validated in the service layer, not by
FK existence alone).

## 4. Authorization ownership

| Role | Annotate / comment | Edit report body | Freeze for signatures | RAP signature | Formal verdict |
|---|---|---|---|---|---|
| Chairman | Yes | No | No | Yes | Yes |
| Panelist | Yes | No | No | Yes | No |
| Rapporteur | Comment/reply | **Yes (sole editor)** | **Yes (assigned)** | Yes | No |
| Adviser (Proposal/Final) | **View-only (OPEN)** | No | No | Yes | No |
| Facilitator | View-only | No | No | No | No |
| Student | No access to live comments | No | No | No | No |

Writes are rejected when the attempt is **concluded**, or when the report is
**frozen** (academic collaboration lock). All writes are server-authorized against
the authenticated user's `PanelAssignment` for the exact `scheduleId`.

## 5. Report serialization approach

- Store the report body as a **controlled JSON document model** (typed nodes:
  `paragraph`, `heading`, `list`, `listItem`, text runs with marks) in
  `RapReport.bodyDocument`.
- Canonicalize (stable key/array order + normalized whitespace) before hashing so
  `frozenContentHash` is deterministic.
- **Insert into Report traceability**: retain `sourceAnnotationId` /
  `sourceCommentId` as **non-visible node attributes** inside the JSON document.
  No join table (YAGNI); inserted text becomes ordinary editable content and is not
  live-bound to its source.
- Freeze stores `frozenContent` = the canonical document + the rendered system
  metadata needed to reproduce the signed RAP, so a later Chairman verdict never
  mutates signed content.

## 6. Legacy compatibility

- `DefenseSchedule.rapporteurNotes` and `RapReport.decisionsAndRecommendations`
  remain readable; new rich-text bodies live alongside them.
- Existing `RapReport` rows have `bodyDocument = null` → render legacy text; no
  fabricated annotations/comments/bodies.
- Legacy `DefenseOutcome` values and nullable `selectedTitleId` are untouched.
- New columns are nullable/defaulted → existing rows stay valid.

## 7. Migration safety

- **Additive only**: two new tables + nullable/defaulted columns; no drops, no row
  rewrites, no enum value removal.
- No backfill. Historical attempts keep their existing shape.
- Rollback is safe (new objects unused by old code paths).

## 8. Proposed migration (NOT applied — CDW-1 owns it)

Illustrative MySQL DDL (Prisma would generate the committed migration in CDW-1):

```sql
-- PROPOSAL ONLY. Do NOT apply during CDW-0.
CREATE TABLE `defense_annotations` (
  `annotation_id` VARCHAR(191) NOT NULL,
  `schedule_id` VARCHAR(191) NOT NULL,
  `thesis_document_id` VARCHAR(191) NOT NULL,
  `author_assignment_id` VARCHAR(191) NOT NULL,
  `page_number` INTEGER NOT NULL,
  `selected_text` TEXT NOT NULL,
  `anchor_data` JSON NOT NULL,
  `anchor_version` INTEGER NOT NULL DEFAULT 1,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`annotation_id`),
  INDEX `defense_annotations_schedule_document_idx` (`schedule_id`, `thesis_document_id`),
  INDEX `defense_annotations_document_idx` (`thesis_document_id`),
  INDEX `defense_annotations_author_idx` (`author_assignment_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `defense_annotation_comments` (
  `comment_id` VARCHAR(191) NOT NULL,
  `annotation_id` VARCHAR(191) NOT NULL,
  `author_assignment_id` VARCHAR(191) NOT NULL,
  `body` TEXT NOT NULL,
  `parent_comment_id` VARCHAR(191) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`comment_id`),
  INDEX `defense_annotation_comments_annotation_idx` (`annotation_id`),
  INDEX `defense_annotation_comments_author_idx` (`author_assignment_id`),
  INDEX `defense_annotation_comments_parent_idx` (`parent_comment_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `rap_reports`
  ADD COLUMN `body_document` JSON NULL,
  ADD COLUMN `body_version` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `body_updated_at` DATETIME(3) NULL,
  ADD COLUMN `content_version` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `frozen_at` DATETIME(3) NULL,
  ADD COLUMN `frozen_by` VARCHAR(191) NULL,
  ADD COLUMN `frozen_content` JSON NULL,
  ADD COLUMN `frozen_content_hash` VARCHAR(191) NULL,
  ADD INDEX `rap_reports_frozen_by_fkey` (`frozen_by`);

ALTER TABLE `rap_report_signatures`
  ADD COLUMN `signed_content_hash` VARCHAR(191) NULL,
  ADD COLUMN `signed_content_version` INTEGER NULL;
```

Foreign keys (to `defense_schedules`, `thesis_documents`, `panel_assignments`,
`defense_annotation_comments`, `users`) would be included by Prisma's generated
migration in CDW-1.

## 9. Verdict

The additive model above satisfies every authorization/immutability rule in the
task and the SOT, reuses the proven CDW-0A anchor format, and introduces no
destructive migration. It is ready to be implemented in **CDW-1**.
