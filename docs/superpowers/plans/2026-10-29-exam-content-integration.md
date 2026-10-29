# Applicant Examination Mixed-Content Integration — Implementation Plan

**Date:** 2026-10-29  
**Repository:** `MuelTech/graduate-system`  
**Planning baseline `main` before this documentation update:** `0dc91c822e5d10d549463372c41f9ce09ea33ebc`  
**Content authority:** `docs/superpowers/EXAM_CONTENT_SOURCE_OF_TRUTH.md`  
**Tracking index:** `docs/superpowers/GSIS_IMPLEMENTATION_CHECKLIST.md`  
**Status:** PLANNED — DOCUMENTATION ONLY; THIS COMMIT DOES NOT AUTHORIZE SCHEMA/BACKEND/FRONTEND/IMPORT IMPLEMENTATION

## 1. Goal

Upgrade the existing Applicant Entrance Examination question bank so GS-IS can faithfully represent and render the verified mixed-content question package.

### Phase A branch strategy

Use one dedicated working branch for the complete Phase A content-integration sequence:

```text
feat/exam-content-integration
```

Create this branch from the current approved `main` baseline when EXAM-CONTENT-1 begins. Continue EXAM-CONTENT-2 through EXAM-CONTENT-6 on the same branch unless the project owner explicitly changes the strategy.

A shared Phase A branch does **not** remove package boundaries. After each EXAM-CONTENT package, stop implementation, report the exact commit/verification evidence, complete independent review, and wait for explicit project-owner authorization before starting the next package.

Phase B — Exam Engine / Scheduling Audit is a separate workstream and must not be absorbed into `feat/exam-content-integration`.

```text
verified manifest.json + assets/
        ↓
EXAM-CONTENT-1 mixed-content architecture
        ↓
EXAM-CONTENT-2 private exam media
        ↓
EXAM-CONTENT-3 verified manifest importer
        ↓
EXAM-CONTENT-4 Admin Question Bank support
        ↓
EXAM-CONTENT-5 Applicant Exam rendering/UI
        ↓
EXAM-CONTENT-6 verified bank import + content QA
        ↓
Phase B Exam Engine / Scheduling Audit
```

The extraction workflow is considered validated for planning purposes. Phase A consumes the verified package; it does not redesign OCR/image extraction.

## 2. Controlled input

Primary integration inputs:

```text
manifest.json
assets/
```

Supporting extraction files remain review/provenance artifacts and must not become runtime importer dependencies:

- `questions.csv`
- `review.csv`
- `answer_key_candidates.csv`
- `crop_plan.csv`
- `extraction-notes.md`

For this project, client authorization to include the actual verified package in the private repository is confirmed. When EXAM-CONTENT-3 requires the package, use a controlled non-public source location such as:

```text
backend/exam-content/olsat/
├── manifest.json
└── assets/
```

This is source/import data, not frontend static content. Do not place the package under `frontend/public`. Git distribution is permitted so authorized development machines receive the same package through normal clone/pull workflows. Runtime visual media must still be validated and imported into GS-IS managed/private storage before Applicant delivery.

## 3. EXAM-CONTENT-1 — Mixed-content question architecture

**Goal:** implement the minimum persistent/API contract capable of representing the verified manifest semantics.

Must support:

- existing plain question text;
- broad stimulus semantics of `NONE`, `IMAGE`, or `STRUCTURED`;
- a bounded validated discriminator/payload for structured forms demonstrated by the verified manifest instead of a closed top-level enum for every subtype;
- structured examples demonstrated by the verified manifest, including matrices, word banks, numeric/alphanumeric sequences, word series, grouped-number rows, letter sequences, and logical-premise sets without flattening their meaning;
- ordered text/image options with source option labels/order preserved;
- verified correct-option mapping while retaining existing runtime scoring authority;
- package-local image paths as import references, not production URLs;
- compatibility for existing text-only questions where reasonable.

Expected work may include Prisma/schema changes, additive migration(s), DTO/repository/service/interface updates, validation, and focused tests.

Do not include full media transport, importer, broad Admin redesign, Applicant redesign, timer, or scheduling work.

### Current EXAM-CONTENT-1 implementation checkpoint

Implementation branch:

`feat/exam-content-integration`

Reviewed implementation commit:

`3506707552e66c03d8e59bb9afdf394077995b9f` — `feat(exam): add mixed-content question architecture`

Independent remote source/diff review on 2026-10-29 found the package aligned with the approved EXAM-CONTENT-1 architecture and scope. The implementation also validated all eight structured subtypes observed in the verified manifest, including `LETTER_SEQUENCE` and `LOGICAL_PREMISES`.

Current acceptance state:

- implementation/source review: **PASS**;
- manifest-shape compatibility review: **PASS**;
- migration source review: **PASS**;
- development-database migration rehearsal: **PASS** — `20261029000000_exam_mixed_content` applied successfully with `prisma migrate deploy`, and `prisma migrate status` reported the database schema up to date;
- post-migration integrity verification: **PASS** — all 7 pre-existing exam questions report `stimulus_type = NONE`, and the selected-option referential check reports 0 broken references;
- hosted CI on the feature commit: **not present / not claimed**;
- project-owner manual/browser/content QA: **not applicable / not claimed for this package**;
- EXAM-CONTENT-1 formal acceptance: **ACCEPTED — 2026-10-29**.

EXAM-CONTENT-2 is now the next authorized Phase A package. Continue on `feat/exam-content-integration` from the accepted EXAM-CONTENT-1 checkpoint and preserve the package stop/review boundary.

**Stop after review.**

## 4. EXAM-CONTENT-2 — Private exam media

**Goal:** store/retrieve visual question and option assets without exposing assessment media publicly.

Must:

- use managed/private storage semantics;
- validate supported media server-side;
- authorize retrieval for legitimate Admin/exam contexts;
- avoid raw public static URLs/storage keys;
- preserve exact source-derived crops;
- treat any repository-committed `exam-content/olsat/assets/` files as controlled import sources, never as directly served Applicant assets.

Do not implement the manifest importer or exam-engine changes.

**Stop after review.**

## 5. EXAM-CONTENT-3 — Verified manifest importer

**Goal:** import the verified `manifest.json + assets/` package deterministically from its controlled package root (for example `backend/exam-content/olsat/` when committed to the repository).

Reject at least:

- malformed/unsupported manifest;
- non-`VERIFIED` item;
- missing `correctAnswer` for auto-checked MCQ;
- answer label absent from options;
- missing/invalid asset;
- duplicate question identity/number;
- unsupported stimulus/option type.

Importer should resolve package-local asset paths, create private media, create questions/options preserving order, map verified answers to scoring authority, and report a deterministic import summary without silent partial success.

Do not depend on `answer_key_candidates.csv`.

**Stop after review.**

## 6. EXAM-CONTENT-4 — Admin Question Bank support

**Goal:** faithfully preview/maintain supported mixed-content questions.

Must support Admin preview/editing for:

- question text;
- image stimulus;
- validated structured stimulus forms demonstrated by the verified package;
- text/image options;
- correct answer;
- source option labels/order and existing management behavior where already supported.

Bold/rich-text emphasis is deferred unless required by a specific item's meaning.

Do not redesign timer/scheduling/submission behavior.

**Stop after review.**

## 7. EXAM-CONTENT-5 — Applicant Exam renderer/UI

**Goal:** render the same authoritative mixed-content payload correctly during examination.

Prefer bounded components such as:

- `QuestionRenderer`
- `StimulusRenderer`
- `OptionRenderer`

Support responsive/readable text, validated structured stimuli (including matrices, word banks, sequence/grouped-row forms demonstrated by the verified package), image stimuli, and image answer choices.

Preserve unrelated existing exam behavior unless a direct compatibility fix is necessary. Timer/autosave/submission/scheduling corrections remain Phase B.

**Stop after review.**

## 8. EXAM-CONTENT-6 — Verified bank import + content QA

Before import:

- confirm final verified package;
- confirm required `verificationStatus` values are `VERIFIED`;
- confirm required `correctAnswer` values are populated;
- run importer validation/dry-run if provided;
- confirm asset-path/count validation.

Content QA must verify representative items across every supported type plus:

- numbering/order;
- option labels/order;
- exact visual assets;
- correct-answer mapping;
- Admin preview vs Applicant rendering consistency.

Project-owner manual/browser/content QA remains distinct from coding-agent automated/source evidence and must not be claimed unless actually performed.

**Stop after acceptance.**

## 9. Mandatory Phase B after Phase A

After EXAM-CONTENT-6 acceptance, immediately proceed to a separate **Exam Engine / Scheduling Audit** covering:

1. timer source of truth;
2. frontend/backend duration alignment;
3. timeout auto-submit/lock;
4. autosave persistence;
5. refresh/reconnect recovery;
6. essay-question assumptions/management;
7. incomplete-answer/submission behavior;
8. scheduling eligibility/window semantics;
9. question activation/selection;
10. regression coverage.

Phase A acceptance must never be documented as proof these concerns are solved.

## 10. Security/integrity guardrails

- Exam visual assets remain private at runtime even when the authorized source package is committed to the private repository.
- Import data is server-validated.
- Candidate/unverified answers never become scoring authority automatically.
- AI-redrawn/generated assessment figures are prohibited.
- Existing Applicant authorization/attempt ownership must not be weakened by rendering/media changes.
- Import failure must not leave an authoritative-looking partial bank.

## 11. Verification expectations

Each package should report:

- branch + exact starting HEAD;
- exact files/schema/migrations changed;
- focused tests;
- type/build/lint checks appropriate to scope;
- migration validation where applicable;
- authorization tests for private media;
- importer rollback/validation tests where applicable;
- explicit not-executed items;
- unresolved issues.

Independent remote source review should occur before package acceptance.

## 12. Implementation kickoff

Before EXAM-CONTENT-1:

1. verify current `main` HEAD;
2. create `feat/exam-content-integration` from that approved `main` baseline, or verify that the existing Phase A branch is at the expected approved checkpoint before continuing;
3. do all Phase A implementation work on that branch;
4. re-read the source of truth, this plan, and checklist;
5. inspect current Prisma exam models, exam engine/repository/service/controller/routes, Admin question page, Applicant exam page, and storage abstraction;
6. propose the smallest additive architecture supporting the verified manifest.

For EXAM-CONTENT-2 through EXAM-CONTENT-6, continue on the same `feat/exam-content-integration` branch from the last accepted package checkpoint. Do not create a new package branch unless the project owner explicitly changes this strategy.

Do not begin EXAM-CONTENT-2 or later packages until the previous package is reviewed and explicitly authorized.
