# Applicant Examination Content Source of Truth

**Status:** Canonical design baseline for mixed-content Applicant Entrance Examination questions and verified question-bank import.  
**Date:** 2026-10-29  
**Repository:** `MuelTech/graduate-system`  
**Tracking index:** `docs/superpowers/GSIS_IMPLEMENTATION_CHECKLIST.md`  
**Implementation plan:** `docs/superpowers/plans/2026-10-29-exam-content-integration.md`

## 1. Scope

This document governs how GS-IS represents, imports, stores, and renders mixed-content Applicant Entrance Examination questions.

It covers text questions, visual stimuli/options, structured stimuli such as matrices and word banks, private exam media, the verified extraction-package contract, bulk import, Admin Question Bank support, and Applicant exam rendering.

It does **not** certify the complete examination lifecycle as production-ready. Timer semantics, autosave/recovery, essay behavior, submission/timeout rules, scheduling semantics, question activation/selection, and broader regression coverage belong to the later **Phase B — Exam Engine / Scheduling Audit**.

## 2. Current baseline

The repository already contains `ExamQuestion`, `ExamOption.isCorrect`, Applicant answers, essay-related records, exam applications/slots, score configuration, and Admin/Applicant exam surfaces.

The existing question representation is primarily text-oriented. The verified assessment source demonstrates that GS-IS must support mixed content.

The project owner has completed and manually reviewed the extraction output. Extraction is no longer the implementation blocker; the verified package is now controlled input to GS-IS integration.

## 3. Verified extraction-package contract

Primary import inputs:

```text
manifest.json
assets/
```

- `manifest.json` is the machine-readable question-bank authority for import.
- `assets/` contains exact visual crops referenced by the manifest.

Supporting extraction artifacts may remain archived for review/provenance but are not production importer dependencies once the manifest is finalized:

- `questions.csv`
- `review.csv`
- `answer_key_candidates.csv`
- `crop_plan.csv`
- `extraction-notes.md`

The project owner has confirmed client authorization to include the actual verified assessment package in the private project repository for development synchronization. When the integration package requires it, the authoritative source package may therefore be committed under a controlled non-public path such as `backend/exam-content/olsat/` so normal Git clone/pull workflows carry the same `manifest.json + assets/` across authorized development machines.

Repository presence does **not** make those files runtime/public assets. Do not place the package under `frontend/public` or expose repository-relative asset paths directly to Applicants. EXAM-CONTENT-3 consumes the committed package as controlled import input; EXAM-CONTENT-2/3 move validated media into GS-IS managed/private storage for authorized runtime delivery.

Source-page scans and supporting extraction artifacts remain unnecessary repository payload unless separately approved for a concrete project need.

## 4. Human verification contract

AI extraction status and human approval are separate.

A multiple-choice question may be imported as authoritative only when:

1. its extracted question/stimulus/options have been reviewed;
2. its answer-key mapping has been reviewed;
3. `verificationStatus === "VERIFIED"`;
4. `correctAnswer` is non-null;
5. `correctAnswer` matches an actual option label;
6. every referenced asset exists and passes validation.

`answerKeyCandidate` may remain as provenance, but runtime scoring uses the verified `correctAnswer`.

Fail closed on ambiguous/unverified content.

## 5. Mixed-content representation

Do not model the real exam as only `questionText + optionText`.

Conceptually:

```text
Question
├── question text / instruction
├── optional stimulus
└── ordered answer options
    ├── text
    └── image
```

First-phase persistence/API semantics should distinguish the broad stimulus category from the structured subtype:

- `NONE`
- `IMAGE`
- `STRUCTURED`

For `STRUCTURED`, preserve a bounded discriminator + payload validated against forms demonstrated by the verified manifest. The verified package currently demonstrates eight structured subtypes: `MATRIX`, `WORD_BANK`, `NUMBER_SEQUENCE`, `ALPHANUMERIC_SEQUENCE`, `WORD_SERIES`, `GROUPED_NUMBER_ROWS`, `LETTER_SEQUENCE`, and `LOGICAL_PREMISES`. The validator should fail closed on unknown/invalid structured subtypes rather than silently flattening them.

Do not encode every structured subtype as a permanent top-level Prisma enum merely because it appears in one assessment package. Do not flatten meaningful matrices, word banks, sequences, grouped rows, letter sequences, or logical-premise sets into ordinary prose.

Answer options must support text-only and image-only forms. The architecture should not permanently block a later text+image option, but first implementation scope should remain bounded to forms demonstrated by the verified package.

Plain text remains the canonical searchable/accessibility/fallback content, but semantic emphasis must be preserved when the physical assessment uses formatting to carry meaning.

Project-owner comparison of the real imported bank against the physical assessment after EXAM-CONTENT-6 confirmed that the source uses **bold** and **underline** inside question/instruction text, and that some answer-option text also contains meaningful bold emphasis. This is no longer optional presentation polish: when emphasis identifies terms such as a negation, exception, target word, or otherwise changes interpretation, losing it is a content-fidelity defect.

The follow-up implementation must remain bounded rather than introducing arbitrary HTML. Preserve at least semantic `BOLD` and `UNDERLINE` spans for both question text and textual answer options, retain plain text as the fallback/searchable value, and render the same emphasis in Admin preview/editing and Applicant presentation.

## 6. Visual-asset integrity

For assessment figures:

- never redraw, regenerate, or substitute AI-created versions;
- use exact crops from institutionally supplied source material;
- do not infer correct answers from circles/marks on question pages;
- preserve option labels and ordering;
- use only the necessary stimulus/option crops rather than whole source pages when possible.

## 7. Private exam-media handling

Package paths such as `assets/q008/stimulus.png` are import references, not production URLs.

Target flow:

```text
manifest asset path
        ↓
validated source asset
        ↓
GS-IS managed/private storage
        ↓
media/storage identifier
        ↓
authorized Admin/Applicant rendering
```

Requirements:

- no unrestricted public static exam-assets directory;
- server-side type/content/size validation;
- private managed storage semantics;
- authorized retrieval only;
- raw storage paths are not public API contracts.

## 8. Verified manifest importer

The importer is a controlled administrative/deployment operation, not an Applicant-facing upload feature.

At minimum it must validate:

- manifest schema/version;
- unique question identity/number within the package;
- supported question/stimulus/option forms;
- ordered option labels;
- `verificationStatus === "VERIFIED"`;
- required `correctAnswer`;
- correct-answer label exists among options;
- all referenced assets exist and validate;
- import failure does not silently leave a misleading partial bank.

The importer should produce a deterministic created/skipped/rejected summary.

`answer_key_candidates.csv` is not a runtime dependency.

## 9. Rendering contract

Prefer reusable bounded rendering instead of OLSAT-specific branches scattered through pages:

```text
QuestionRenderer
├── text/instruction
└── StimulusRenderer
    ├── NONE
    ├── IMAGE
    └── STRUCTURED
        └── subtype renderer selected from validated manifest semantics
            ├── MATRIX / WORD_BANK
            └── sequence / grouped-row forms demonstrated by the package

OptionRenderer
├── TEXT
└── IMAGE
```

Admin preview and Applicant exam presentation must use the same authoritative question semantics.

Question/instruction and option body text should use a neutral, high-readability body color by default. EARIST primary red may remain an accent for headings, selection/focus state, or other intentional emphasis, but should not color the complete assessment text by default.

Admin bank pagination must also be discoverable for a real 72-question bank. Page status without readily visible navigation is insufficient when controls are only reachable after scrolling through a long page of cards.

## 10. Phase A — Exam Content Integration

| Package | Scope |
| --- | --- |
| EXAM-CONTENT-1 | Mixed-content question/stimulus architecture and migration/API contract. |
| EXAM-CONTENT-2 | Private exam-media storage/retrieval and authorization. |
| EXAM-CONTENT-3 | Verified `manifest.json + assets/` importer with fail-closed validation. |
| EXAM-CONTENT-4 | Admin Question Bank mixed-content renderer/editor support. |
| EXAM-CONTENT-5 | Applicant Exam mixed-content renderer and bounded UI/UX integration. |
| EXAM-CONTENT-6 | Import verified question bank, complete content-focused QA, and close bounded real-bank presentation issues such as pagination discoverability and assessment-text color. |
| EXAM-CONTENT-7 | Preserve semantically meaningful source typography required for assessment meaning/fidelity, including BOLD, UNDERLINE, and ITALIC where verified, across question/instruction text, textual answer choices, and supported structured textual stimuli, with matching Admin/Applicant rendering. |

Phase A proves content representation/import/rendering fidelity only after the verified physical-source audit is reconciled. This includes the bounded Q24 source-text correction discovered after the original EC6 acceptance and EXAM-CONTENT-7 source typography fidelity. It does **not** prove the whole exam lifecycle is production-ready.

### 10.1 Physical-source audit checkpoint — 2026-10-30

The project owner supplied all 12 physical OLSAT test-page images for direct visual comparison against the canonical manifest. This audit is the source authority for typography and exposed one content discrepancy that must be corrected before final Phase A acceptance.

Confirmed findings:

- the physical source uses **BOLD**, **UNDERLINE**, and **ITALIC** as meaningful/intentional typography;
- ITALIC is not purely decorative in all cases; representative examples include the emphasized word `not` in Q11/Q61, so EC7 cannot claim complete source fidelity while supporting only BOLD/UNDERLINE;
- structured textual stimuli can themselves carry source emphasis; representative examples include the bold WORD_SERIES terms in Q25 (`peaceful / serene / tranquil`) and Q45 (`forward / sideways / down`);
- the current EC7 v1 runtime/sidecar contract supports only question/option text BOLD/UNDERLINE and therefore is insufficient for the complete verified physical-source typography;
- Q24 option J is a real source-text mismatch: the physical page reads `Paul is younger than Dick and John`, while the current canonical manifest/imported bank contains `Paul is younger than Dick`.

Do not generate/apply the final real OLSAT emphasis sidecar against the current source state. The exact text hashes/offsets must be generated only after the Q24 canonical source correction is represented in the final cleaned package/database state and the EC7 typography contract supports the verified source requirements.

### Development correction strategy decision — 2026-10-30

A Q24-specific transactional reconciliation utility was implemented and independently reviewed after the discrepancy was found. Although technically bounded and fail-closed, the project owner rejected that approach for this development-stage bank because it leaves permanent one-off CLI/service/repository/test machinery for a single source typo.

That implementation is **SUPERSEDED / NOT ACCEPTED as the continuing architecture**. Do not treat the Q24-specific reconciliation command as the required operator path.

The selected development strategy has now been completed and independently reviewed:

1. the Q24-only reconciliation machinery and dedicated npm commands/tests/operator documentation were removed through normal forward history;
2. the verified Q24 Option J canonical correction remains in `manifest.json`;
3. the corrected manifest/package identity bindings remain accurate;
4. dependency safety checks confirmed no live ApplicantAnswer/question-option dependency blocked reset;
5. only the imported OLSAT development-bank state was removed, including its owned exam media;
6. the corrected 72-question package was clean-imported through the normal importer;
7. verification passed for 72 questions / 360 options / 108 media, 72/72 answer mappings, zero broken references, corrected Q24 wording, and identical repeat import returning `ALREADY_IMPORTED`.

Therefore the corrected-bank EC6 post-acceptance checkpoint is **CLOSED / ACCEPTED as of 2026-10-31**. The Q24-specific reconciliation implementation remains historical and superseded; it is not part of the retained architecture.

The next Phase A work is the bounded EC7 ITALIC + structured textual-stimulus fidelity extension, followed by the owner-verified real typography map, controlled sidecar application, physical-source comparison, and final EC7/Phase A acceptance.

This reset/re-import choice is explicitly **development-stage only**. It is not a general production migration policy for banks with live attempts/answers.

Do not infer typography from wording, answer correctness, capitalization, OCR, or model judgment. Only the owner-reviewed physical source may authorize real source-specific marks.

## 11. Phase B follows Phase A

Immediately after Phase A is accepted, proceed to **Phase B — Exam Engine / Scheduling Audit**.

Audit/correct as required:

- timer source of truth and frontend/backend duration alignment;
- timeout auto-submit/lock behavior;
- autosave and refresh/reconnect recovery;
- essay-question lifecycle and assumptions;
- submission and incomplete-answer behavior;
- scheduling-window semantics;
- question activation/selection rules;
- focused and regression automated coverage.

The Applicant Entrance Examination must not be marked production-ready until Phase B is completed and accepted.

## 12. Policy separation

Mixed-content representation must not decide unrelated institutional rules such as:

- number of essay questions;
- essay weight/scoring;
- exact duration;
- passing policy;
- reschedule/appeal rules;
- slot capacity;
- Program Chair grading authority;
- unanswered-question policy.

Those belong to Phase B and/or institutional policy.

## 13. Licensing/data guardrail

The project owner has confirmed client authorization to include the current assessment package in the private project repository for development synchronization. That repository authorization should not be treated as automatic proof of broader production rights for electronic administration of a commercial assessment; before production use, EARIST/project stakeholders must still confirm any applicable administration/license requirements.

Implementation documentation should describe data contracts and system behavior without unnecessarily reproducing protected test content.

## 14. Acceptance boundary

Phase A is accepted only after its bounded packages are implemented/reviewed, private-media authorization is verified, importer validation is proven, canonical text matches the verified physical source, Admin and Applicant render the same assessment semantics, required BOLD/UNDERLINE/ITALIC source typography is preserved on all supported textual surfaces demonstrated by the assessment, and project-owner source/manual QA is completed where applicable.

EXAM-CONTENT-6 was **formally accepted on 2026-10-30 based on the evidence then available**. Its original verified bank import and bounded UI follow-up at `78c76fb6bd84b17368ca94ebacd8f5a6ad778437` remain valid historical checkpoints. However, the later 12-page physical-source audit found a bounded Q24 option-J truncation. That corrected-bank replacement verification is now **CLOSED / ACCEPTED as of 2026-10-31** after the superseded one-off reconciler was removed, the development OLSAT bank was safely reset, the corrected canonical package was imported through the normal importer, and the resulting 72/360/108 bank plus 72/72 mappings/Q24 wording/idempotency were independently reviewed. The accepted pagination/color work was never reopened.

Current EC7 checkpoint: the bounded EC7A fidelity-support extension at `3d8a7cbb7121f5aaf24291327a8e9c1f7d88e473` has passed independent source review. EC7B then created the explicit owner-verified schema-v2 map at `backend/exam-content/olsat-emphasis.json`; independent review of the pushed map found no blocking issue.

EC7B verified exactly 28 source questions / 38 annotation targets / 59 spans (33 BOLD, 8 UNDERLINE, 18 ITALIC), including the bounded Q24 option targets, Q25/Q45 structured WORD_SERIES targets, Q58 terminal-`cold` disambiguation, and explicit Q67 exclusion. Protected manifest/assets/package identity remain unchanged. Read-only live preflight returned `PREFLIGHT_OK`, `annotationsValidated: 38`, `fieldsChanged: 0`, `fieldsWouldChange: 34`, and before/after evidence reported all real emphasis metadata still null.

Therefore **EC7B real-map creation/review/preflight is PASS**. The sidecar exists and is reviewed, but it has **not yet been applied** to the development database. Project-owner manual/browser QA remains intentionally deferred until after the reviewed real map is applied, so the final visual pass can compare actual source-derived BOLD/UNDERLINE/ITALIC/structured-item presentation rather than synthetic formatting.

The next Phase A task is the controlled EC7C apply/idempotency checkpoint: re-run preflight, apply the reviewed sidecar, verify exactly the expected semantic metadata fields change with no canonical-content/unrelated-data mutation, repeat the identical apply and require `ALREADY_APPLIED` with zero writes, then stop for independent review. Final owner Admin/Applicant source comparison and formal EC7/Phase A acceptance remain after that checkpoint. Keep all of this separate from Phase B.

After Phase A acceptance, proceed directly to Phase B.
