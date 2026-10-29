# Applicant Examination Mixed-Content Integration — Implementation Plan

**Date:** 2026-10-29  
**Repository:** `MuelTech/graduate-system`  
**Planning baseline `main` before this documentation update:** `0dc91c822e5d10d549463372c41f9ce09ea33ebc`  
**Content authority:** `docs/superpowers/EXAM_CONTENT_SOURCE_OF_TRUTH.md`  
**Tracking index:** `docs/superpowers/GSIS_IMPLEMENTATION_CHECKLIST.md`  
**Status:** PLANNED — DOCUMENTATION ONLY; THIS COMMIT DOES NOT AUTHORIZE SCHEMA/BACKEND/FRONTEND/IMPORT IMPLEMENTATION

## 1. Goal

Upgrade the existing Applicant Entrance Examination question bank so GS-IS can faithfully represent and render the verified mixed-content question package.

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

Do not commit the complete copyrighted assessment bank merely to satisfy this plan.

## 3. EXAM-CONTENT-1 — Mixed-content question architecture

**Goal:** implement the minimum persistent/API contract capable of representing the verified manifest semantics.

Must support:

- existing plain question text;
- explicit content/stimulus type;
- optional `IMAGE`, `MATRIX`, and `WORD_BANK` stimulus;
- ordered text/image options;
- verified correct-option mapping;
- compatibility for existing text-only questions where reasonable.

Expected work may include Prisma/schema changes, additive migration(s), DTO/repository/service/interface updates, validation, and focused tests.

Do not include full media transport, importer, broad Admin redesign, Applicant redesign, timer, or scheduling work.

**Stop after review.**

## 4. EXAM-CONTENT-2 — Private exam media

**Goal:** store/retrieve visual question and option assets without exposing assessment media publicly.

Must:

- use managed/private storage semantics;
- validate supported media server-side;
- authorize retrieval for legitimate Admin/exam contexts;
- avoid raw public static URLs/storage keys;
- preserve exact source-derived crops.

Do not implement the manifest importer or exam-engine changes.

**Stop after review.**

## 5. EXAM-CONTENT-3 — Verified manifest importer

**Goal:** import a verified `manifest.json + assets/` package deterministically.

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
- matrix stimulus;
- word bank;
- text/image options;
- correct answer;
- ordering and existing management behavior where already supported.

Bold/rich-text emphasis is deferred unless required by a specific item's meaning.

Do not redesign timer/scheduling/submission behavior.

**Stop after review.**

## 7. EXAM-CONTENT-5 — Applicant Exam renderer/UI

**Goal:** render the same authoritative mixed-content payload correctly during examination.

Prefer bounded components such as:

- `QuestionRenderer`
- `StimulusRenderer`
- `OptionRenderer`

Support responsive/readable text, matrices, word banks, image stimuli, and image answer choices.

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

- Exam visual assets are private.
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
2. create/use a dedicated feature branch;
3. re-read the source of truth, this plan, and checklist;
4. inspect current Prisma exam models, exam engine/repository/service/controller/routes, Admin question page, Applicant exam page, and storage abstraction;
5. propose the smallest additive architecture supporting the verified manifest.

Do not begin EXAM-CONTENT-2 or later packages until the previous package is reviewed and explicitly authorized.
