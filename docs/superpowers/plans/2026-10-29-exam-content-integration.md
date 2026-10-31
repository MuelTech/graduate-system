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

### Current EXAM-CONTENT-2 acceptance checkpoint

Implementation commit:

`c080222877380b2124c40ef49e6fbf04aa0fe2c9` — `feat(exam): add private exam media lifecycle`

Independent remote review on 2026-10-29 found the package aligned with the approved EXAM-CONTENT-2 persistence, managed-storage, authorization, retrieval-integrity, migration, and scope boundaries.

Acceptance evidence:

- implementation/source review: **PASS**;
- private-storage and image-policy review: **PASS**;
- Admin/Applicant authorization review: **PASS**;
- retrieval integrity and non-leakage review: **PASS**;
- focused automated verification: **PASS**;
- migration source review: **PASS**;
- development-database migration rehearsal: **PASS** — `20261029010000_exam_private_media` applied successfully and `prisma migrate status` reported the database schema up to date;
- project-owner post-migration XAMPP integrity checks: **PASS** — the new media schema remained clean before any EXAM-CONTENT-3 import, with no broken media references reported;
- hosted CI on the feature commit: **not present / not claimed**;
- manual/browser/content QA: **not required / not claimed for this backend infrastructure package**;
- EXAM-CONTENT-2 formal acceptance: **ACCEPTED — 2026-10-29**.

EXAM-CONTENT-3 is now the next authorized Phase A package. Continue on `feat/exam-content-integration` from this accepted checkpoint and preserve the package stop/review boundary.

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

### Current EXAM-CONTENT-3 acceptance checkpoint

Implementation commit:

`80816ad130dfdfa61fadb7e97fc4aa5d309d51f3` — `feat(exam): add verified exam content importer`

Independent remote review on 2026-10-29 found the package aligned with the approved EXAM-CONTENT-3 importer, source-package, path-containment, media, duplicate/idempotency, transaction/compensation, migration, and scope boundaries.

Acceptance evidence:

- implementation/source review: **PASS**;
- committed real-package verification: **PASS** — 72 verified questions and 108 referenced/committed image assets reconciled with no missing or extra assets;
- structured-stimulus and answer-label mapping review: **PASS**;
- package path-containment and source-integrity review: **PASS**;
- private-media integration and compensation review: **PASS**;
- duplicate/idempotency and transaction-boundary review: **PASS**;
- focused automated verification and real-package preflight: **PASS**;
- migration source review: **PASS**;
- development-database migration rehearsal: **PASS** — `20261029020000_exam_import_identity` applied successfully and `prisma migrate status` reported the database schema up to date;
- project-owner post-migration XAMPP integrity checks: **PASS** — import marker, sourced-question fields, and broken import-reference checks all remained at the expected zero pre-import state;
- full 72-question development DB import: **NOT RUN / intentionally deferred to EXAM-CONTENT-6**;
- hosted CI on the feature commit: **not present / not claimed**;
- browser/manual/UI/content QA: **not required / not claimed for this importer package**;
- EXAM-CONTENT-3 formal acceptance: **ACCEPTED — 2026-10-29**.

EXAM-CONTENT-4 is now the next authorized Phase A package. Continue on `feat/exam-content-integration` from this accepted checkpoint and preserve the package stop/review boundary.

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

### Current EXAM-CONTENT-4 acceptance checkpoint

Implementation commit:

`23180a40b3b236fe66432bd33fea9ab14fecb1b9` — `feat(exam): add admin mixed-content question support`

Independent remote review on 2026-10-29 found the package aligned with the approved EXAM-CONTENT-4 mixed-content Admin rendering/editing, private-media preview/upload, option-identity preservation, structured-content, security, and scope boundaries.

Acceptance evidence:

- implementation/source review: **PASS**;
- Admin mixed-content DTO/type alignment: **PASS**;
- option ID/label/order/media preservation review: **PASS**;
- all eight structured stimulus preview/editor paths: **PASS**;
- authenticated private-image Blob/object-URL lifecycle review: **PASS**;
- Admin-only secure image upload integration: **PASS**;
- focused automated verification: **PASS** — 8 focused files / 184 tests;
- backend build: **PASS**;
- frontend TypeScript/build/lint verification: **PASS**;
- project-owner browser/visual QA: **PASS** — the updated Admin Question Bank rendered the existing seven development/demo questions successfully and the owner approved the visible result;
- real 72-question development DB import: **NOT RUN / intentionally deferred to EXAM-CONTENT-6**;
- hosted CI on the feature commit: **not present / not claimed**;
- EXAM-CONTENT-4 formal acceptance: **ACCEPTED — 2026-10-29**.

EXAM-CONTENT-5 is now the next authorized Phase A package. Continue on `feat/exam-content-integration` from this accepted checkpoint and preserve the package stop/review boundary.

**Stop after review.**

## 7. EXAM-CONTENT-5 — Applicant Exam renderer/UI

**Goal:** render the same authoritative mixed-content payload correctly during examination.

Prefer bounded components such as:

- `QuestionRenderer`
- `StimulusRenderer`
- `OptionRenderer`

Support responsive/readable text, validated structured stimuli (including matrices, word banks, sequence/grouped-row forms demonstrated by the verified package), image stimuli, and image answer choices.

Preserve unrelated existing exam behavior unless a direct compatibility fix is necessary. Timer/autosave/submission/scheduling corrections remain Phase B.

### Current EXAM-CONTENT-5 acceptance checkpoint

Implementation commit:

`ae54992cb87acad6e420c8788f14910c1035adf9` — `feat(exam): add applicant mixed-content rendering`

Independent remote source/diff review on 2026-10-29: **PASS**.

Project-owner browser QA on the Applicant exam page: **PASS**.

Browser QA verified:

- existing development/demo text questions still render correctly;
- a temporary structured `MATRIX` stimulus renders correctly;
- persisted non-A/B/C labels `F / G / H / J / K` render exactly as stored;
- a temporary visual/image stimulus renders correctly;
- image answer options render correctly;
- selected-answer state remains visible when navigating away and back within the current page session;
- the current navigation shell remains usable with mixed-content questions.

The current Applicant examination UX is still not considered final production UX. Real-bank presentation refinements discovered during EXAM-CONTENT-6 content QA may still be made where directly necessary for faithful question rendering.

The owner also confirmed the known lifecycle limitation that MCQ selections are lost after a full browser reload. This is **not an EXAM-CONTENT-5 blocker** and remains explicitly deferred to Phase B together with:

- complete MCQ autosave/persisted recovery;
- refresh/reconnect answer restoration;
- server-authoritative remaining-time restoration;
- the current fixed three-hour timer;
- missing Admin-side authoritative exam-duration configuration;
- timeout/lock/auto-submit and related exam-attempt lifecycle semantics.

**EXAM-CONTENT-5 formal acceptance: ACCEPTED — 2026-10-29.**

EXAM-CONTENT-6 is now the next authorized Phase A package. Continue on `feat/exam-content-integration` from this accepted checkpoint and preserve the package stop/review boundary.

**Stop after review.**

## 8. EXAM-CONTENT-6 — Verified bank import + content QA

Before import:

- confirm final verified package;
- confirm required `verificationStatus` values are `VERIFIED`;
- confirm required `correctAnswer` values are populated;
- run importer validation/dry-run if provided;
- confirm asset-path/count validation;
- retain the seven existing development/demo questions only through EXAM-CONTENT-5 for Applicant baseline/regression QA;
- after EXAM-CONTENT-5 acceptance, remove/clean those seven development/demo questions before the controlled EXAM-CONTENT-6 import;
- verify the pre-import development bank contains `0` development/demo questions so final content QA evaluates only the authoritative 72-question OLSAT import.

The seven development/demo questions are temporary QA data only. They are not part of the authoritative OLSAT package and must not be counted as part of the final verified bank.

Content QA must verify representative items across every supported type plus:

- numbering/order;
- option labels/order;
- exact visual assets;
- correct-answer mapping;
- Admin preview vs Applicant rendering consistency.

Project-owner manual/browser/content QA remains distinct from coding-agent automated/source evidence and must not be claimed unless actually performed.

### Current EXAM-CONTENT-6 owner-QA checkpoint

Verified-bank import evidence is recorded at commit:

`5313c5934b3f3f6a2f98a316246810b284ab0e05` — `docs(exam): record verified bank import evidence`

The controlled development import/reconciliation passed: 72 authoritative questions, 108 imported-bank media references, source numbers 1–72, all eight structured forms, 72/72 answer mappings, private-media byte reconciliation, and identical-import idempotency. The authoritative source package remained unchanged.

Project-owner real-bank browser/content review has now started and produced the following concrete presentation findings:

- Admin Question Bank correctly reports `72 questions · Page 1 of 9`; pagination logic already exists, but the Previous/Next controls are only after the long eight-card page, so navigation is not discoverable enough during review;
- full assessment question/instruction text is currently styled with EARIST primary red in both Admin and Applicant surfaces; normal questionnaire body text should use a neutral readable body color, reserving red for accents/selection/focus where appropriate;
- comparison against the physical assessment confirmed semantically meaningful **bold** and **underline** inside question/instruction text;
- the physical assessment also uses meaningful **bold** emphasis inside some textual answer choices;
- the current plain-text source/import/runtime representation does not preserve those emphasis semantics.

The pagination discoverability and neutral assessment-text color are bounded EXAM-CONTENT-6 presentation follow-ups. They do not require re-importing or changing the verified 72-question bank.

Semantic emphasis is larger than a color/layout correction and must be handled as a separate bounded Phase A package, EXAM-CONTENT-7, before Phase A can claim faithful presentation.

**EXAM-CONTENT-6 is formally ACCEPTED — 2026-10-30.**

Acceptance combines the previously verified 72-question import/reconciliation evidence with the bounded UI follow-up implemented at `78c76fb6bd84b17368ca94ebacd8f5a6ad778437`. Independent review of the actual pushed GitHub source/diff found no blocking issue. The project owner visually reviewed the resulting UI and reported satisfaction with the output. Focused automated/source evidence covers top/bottom pagination state behavior and the three neutral question/instruction text surfaces.

The earlier sequencing exception is closed for the EC6 pagination/color work. However, a later 2026-10-30 owner-supplied 12-page physical-source audit exposed a bounded source-text defect in Q24 option J. The original EC6 acceptance remains part of the history, but EC6 content fidelity is reopened only for this corrective item:

- physical source: `Paul is younger than Dick and John`;
- current manifest/imported text: `Paul is younger than Dick`.

Do not re-open the accepted pagination/color follow-up and do not broaden this into a general re-extraction package. Correct/reconcile the exact Q24 field with source-integrity evidence before final Phase A acceptance.

## 8.1 EXAM-CONTENT-7 — Semantic text-emphasis fidelity

**OWNER-AUTHORIZED NEXT — 2026-10-29.** This package remains part of Phase A and may proceed on the existing feature branch under the sequencing exception above.

Required scope, revised after the complete 12-page physical-source audit:

- preserve semantically meaningful `BOLD`, `UNDERLINE`, and `ITALIC` typography verified from the authorized physical assessment;
- support typography in question/instruction text;
- support typography in textual answer choices;
- support verified typography inside structured textual stimuli demonstrated by the source (including WORD_SERIES);
- retain canonical plain text for search/accessibility/fallback;
- avoid arbitrary/untrusted HTML as the data contract;
- provide bounded source/import representation for emphasis metadata;
- preserve the same semantics in Admin editing/preview and Applicant rendering;
- add focused validation so emphasis ranges cannot point outside the canonical text or become structurally ambiguous;
- verify representative real items where emphasis changes interpretation.

General document-style rich text, fonts, colors, arbitrary HTML, and unrelated formatting remain out of scope. The ITALIC extension and structured-text emphasis are included only because the owner-reviewed physical assessment demonstrates them as source fidelity requirements.

No Phase B timer/autosave/scheduling/submission work belongs in EXAM-CONTENT-7.

Phase A must not be marked fully presentation-faithful until this package is reviewed and project-owner source/browser QA confirms meaningful emphasis is preserved.

### EXAM-CONTENT-7 review / owner-QA checkpoint

Implementation commit:

`09e09260e5b1ab539b567b3b51b1e7b146e928d5` — `feat(exam): add semantic text emphasis support`

Independent remote review of the actual GitHub diff/source: **PASS — no blocking architectural or package-scope defect found.**

Verified review points include:

- one additive migration adding nullable question/option emphasis metadata only;
- canonical `questionText` / `optionText` remain plain strings;
- bounded `BOLD` / `UNDERLINE` span validation;
- no arbitrary HTML / `dangerouslySetInnerHTML`;
- Admin and Applicant share the controlled semantic renderer;
- Applicant projections continue to exclude correctness/answer-key/source/storage authority;
- the verified-sidecar/apply workflow does not guess real OLSAT formatting;
- EC6 pagination/color changes and all Phase B lifecycle work remain outside EC7.

Project-owner manual/browser evidence: **Admin bold/underline authoring/rendering observed working.**

The owner intentionally elected not to perform a separate full Applicant browser QA pass for this checkpoint because the Applicant path uses the same reviewed semantic renderer and is covered by focused automated/source evidence. This must be recorded as **owner-skipped**, not as manual Applicant QA.

EC7B has now created and independently reviewed the real owner-verified schema-v2 map at `backend/exam-content/olsat-emphasis.json`.

Current EC7 status:

- original EC7 BOLD/UNDERLINE architecture/support review: **PASS**;
- EC7A ITALIC + structured textual-stimulus support at `3d8a7cbb7121f5aaf24291327a8e9c1f7d88e473`: **INDEPENDENT REVIEW PASS**;
- EC7B real typography map implementation at `b25a6c486c341cc67cbc9c6b264c15293d238bd4`: **INDEPENDENT REVIEW PASS — no blocking issue found**;
- real map inventory: **28 questions / 38 targets / 59 spans = 33 BOLD / 8 UNDERLINE / 18 ITALIC**;
- protected manifest/assets/package identity: **UNCHANGED**;
- live read-only preflight: **PASS** — `PREFLIGHT_OK`, `annotationsValidated: 38`, `fieldsChanged: 0`, `fieldsWouldChange: 34`;
- real database emphasis application: **NOT YET RUN**;
- EC7A/EC7B owner manual/browser QA: **DEFERRED BY OWNER until after the reviewed map is applied**;
- formal EC7 acceptance: **PENDING EC7C application/idempotency plus final owner Admin/Applicant physical-source comparison**.

The deferred browser pass must not be described as completed QA. The next implementation checkpoint is EC7C, which applies only the already-reviewed map and proves identical re-apply is zero-write idempotent.

The EXAM-CONTENT-6 pagination/color UI follow-up remains complete and accepted at `78c76fb6bd84b17368ca94ebacd8f5a6ad778437`.

### Revised remaining Phase A sequence after physical-source audit

EC7A support and EC7B real-map creation/review/preflight are complete. The real sidecar exists and is reviewed but has not yet been applied.

#### Corrected-bank checkpoint — ACCEPTED 2026-10-31

The Q24-specific reconciliation implementation at `9430c833f11c46b3de43a2eb0e9b8e6486b55233` remains historical and **SUPERSEDED / NOT ACCEPTED as retained architecture**. The accepted CORR2 path preserved the corrected canonical Q24 wording and clean-imported/verified the 72-question bank through the normal importer.

### Remaining Phase A sequence

1. **EC7C — controlled real-map application + idempotency**
   - re-run preflight and require the reviewed 38-target / 34-field change plan;
   - apply the reviewed `olsat-emphasis.json`;
   - verify only the expected semantic metadata fields change;
   - verify canonical exam content, identities, correctness, media and unrelated data remain unchanged;
   - run the identical apply again and require `ALREADY_APPLIED` with zero writes.

2. **Independent review of EC7C application evidence**.

3. **Deferred owner manual/browser QA**
   - compare the actual populated OLSAT formatting in Admin and Applicant surfaces against the physical assessment;
   - include question/option BOLD/UNDERLINE/ITALIC and Q25/Q45 structured WORD_SERIES rendering.

4. **Formal EC7 and Phase A acceptance** after application/idempotency and owner source comparison pass.

Do not begin Phase B until EC7 and Phase A are formally accepted.

## 9. Mandatory Phase B after Phase A

After EXAM-CONTENT-7 acceptance and final Phase A acceptance, immediately proceed to a separate **Exam Engine / Scheduling Audit** covering:

1. authoritative exam-duration configuration, including the required Admin-side configuration surface and persistence model;
2. timer source of truth and removal of duplicated/hard-coded duration assumptions;
3. frontend/backend duration alignment and remaining-time restoration after refresh/reconnect;
4. timeout auto-submit/lock and server enforcement;
5. MCQ autosave persistence;
6. essay autosave lifecycle review;
7. persisted answer recovery after refresh/reconnect, including answered/unanswered navigator state;
8. incomplete-answer/submission behavior, retries/idempotency, and final lock state;
9. scheduling eligibility/window semantics and scheduled-start vs actual-attempt semantics;
10. question activation/selection;
11. scoring/submission integrity checks;
12. regression coverage.

The Phase B direction should treat the backend/server-side attempt state as authoritative, with the frontend rendering configured duration/remaining time rather than owning an independent hard-coded timer. Admin configuration, timer enforcement, autosave, recovery, timeout, and final submission should be designed as one coherent exam-attempt lifecycle rather than separate frontend patches.

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

For EXAM-CONTENT-2 through EXAM-CONTENT-7, continue on the same `feat/exam-content-integration` branch from the last accepted package checkpoint. Do not create a new package branch unless the project owner explicitly changes this strategy.

Do not begin EXAM-CONTENT-2 or later packages until the previous package is reviewed and explicitly authorized.
