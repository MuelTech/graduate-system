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

The repository documentation must not duplicate the complete copyrighted assessment bank or source-page images merely for implementation planning.

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

First-phase stimulus forms must support at least:

- `NONE`
- `IMAGE`
- `MATRIX`
- `WORD_BANK`

Do not flatten meaningful matrix or word-bank structure into ordinary prose.

Answer options must support text-only and image-only forms. The architecture should not permanently block a later text+image option, but first implementation scope should remain bounded to forms demonstrated by the verified package.

Plain question text remains canonical searchable/accessibility/fallback content. Rich-text emphasis such as bold may be added later through Admin editing and is not a first-import blocker unless the formatting changes an item's meaning.

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
    ├── IMAGE
    ├── MATRIX
    └── WORD_BANK

OptionRenderer
├── TEXT
└── IMAGE
```

Admin preview and Applicant exam presentation must use the same authoritative question semantics.

## 10. Phase A — Exam Content Integration

| Package | Scope |
| --- | --- |
| EXAM-CONTENT-1 | Mixed-content question/stimulus architecture and migration/API contract. |
| EXAM-CONTENT-2 | Private exam-media storage/retrieval and authorization. |
| EXAM-CONTENT-3 | Verified `manifest.json + assets/` importer with fail-closed validation. |
| EXAM-CONTENT-4 | Admin Question Bank mixed-content renderer/editor support. |
| EXAM-CONTENT-5 | Applicant Exam mixed-content renderer and bounded UI/UX integration. |
| EXAM-CONTENT-6 | Import verified question bank and complete content-focused QA. |

Phase A proves content representation/import/rendering fidelity. It does **not** prove the whole exam lifecycle is production-ready.

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

System capability is separate from authorization to digitally reproduce/administer a commercial assessment. Before production use, EARIST/project stakeholders must confirm applicable rights/license for electronic administration.

Implementation documentation should describe data contracts and system behavior without unnecessarily reproducing protected test content.

## 14. Acceptance boundary

Phase A is accepted only after its bounded packages are implemented/reviewed, private-media authorization is verified, importer validation is proven, Admin and Applicant render the same semantics, and project-owner content/manual QA is completed where applicable.

After Phase A acceptance, proceed directly to Phase B.
