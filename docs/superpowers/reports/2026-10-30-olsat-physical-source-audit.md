# OLSAT physical-source fidelity audit

Date: 2026-10-30 (Asia/Manila)

Repository: `MuelTech/graduate-system`

Branch: `feat/exam-content-integration`

## Purpose

The project owner supplied the complete 12 physical OLSAT test-page images
covering Q1-Q72. The pages were visually reviewed against the canonical
`backend/exam-content/olsat/manifest.json` to determine the real source
typography required for EXAM-CONTENT-7 and to catch any source-text mismatch
before generating the production emphasis sidecar.

The physical pages are the authority for this audit. Do not infer real
source-specific typography from wording, capitalization, answer correctness,
OCR output, or model judgment.

This report records audit findings and implementation boundaries. It is **not**
the final exhaustive `olsat-emphasis.json` annotation map.

## High-confidence audit findings

### 1. The physical source uses three relevant text styles

The assessment demonstrates intentional:

- `BOLD`;
- `UNDERLINE`;
- `ITALIC`.

The current EC7 v1 runtime contract supports only `BOLD` and `UNDERLINE`.
Therefore the current contract cannot yet be treated as complete physical-source
fidelity.

ITALIC must not be dismissed as purely decorative. Representative source items
include emphasized instructional/semantic terms such as `best`, `same`,
`most clearly`, and `not`; `not` in Q11/Q61 is a clear example where the
typography participates in the intended reading of the item.

### 2. Structured textual stimuli can carry source typography

The physical source demonstrates emphasis inside structured stimulus text, not
only inside `questionText` and textual answer choices.

Representative examples:

- Q25 WORD_SERIES: `peaceful`, `serene`, `tranquil` are visibly bold;
- Q45 WORD_SERIES: `forward`, `sideways`, `down` are visibly bold.

The current structured-stimulus renderer displays these values as ordinary text
and the current v1 emphasis sidecar targets only question/option fields.
EXAM-CONTENT-7 therefore needs a bounded structured-text fidelity extension.

### 3. Q24 option J has a real source-text mismatch

Physical source wording:

`Paul is younger than Dick and John`

Current canonical manifest/imported wording:

`Paul is younger than Dick`

This is a content-fidelity defect, not a typography-only issue.

The Q24 field must be corrected and the already imported bank reconciled before
final text hashes/offsets are generated for the real typography map.

The correction must preserve unrelated:

- question/option identities;
- option label/order;
- correctness mapping;
- media;
- source identity;
- all other questions/options.

Do not solve this by deleting/reimporting the whole 72-question bank unless a
separately reviewed recovery path proves that is required.

## Representative source typography observed

The following examples are safe implementation references, but they are **not**
a substitute for the final exhaustive owner-verified annotation map.

### BOLD examples

- Q5: key analogy terms including `First`, `original`, `only`;
- Q10: `confinement`;
- Q20: `Increase`, `reveal`, `decrease`;
- Q28: `discord`;
- Q33: `Possible`, `maybe`, `probable`;
- Q35: `moderate`;
- Q50: `Electricity`, `light bulb`;
- Q57: `scarcity`;
- Q58: source-language/meaning phrases, including the final target `cold`;
- Q25/Q45 structured WORD_SERIES terms as described above.

### UNDERLINE examples

Representative instruction targets visibly underlined in the physical source
include:

- Q6: `first` and `begin`;
- Q18: `last` and `begin`;
- Q27: `first` and `begin`;
- Q62: `last` and `begin`.

### ITALIC examples

Representative italicized source terms include:

- recurring `best` instruction wording;
- recurring `same` rule wording;
- Q11/Q61 `not`;
- Q25/Q45 `most clearly`.

The final map must be prepared by exact physical-source comparison rather than
assuming every occurrence of these words is styled identically.

## Current implementation gap

At the time of this audit:

- `TextEmphasisSpan.style` accepts only `BOLD | UNDERLINE`;
- the controlled React semantic renderer emits only `<strong>` / `<u>`;
- the Admin semantic editor exposes Bold / Underline only;
- the real sidecar schema targets `questionText` and `optionText` only;
- structured stimulus values do not carry emphasis metadata;
- the production `backend/exam-content/olsat-emphasis.json` is intentionally
  absent.

No real OLSAT typography should be populated while those source requirements are
unsupported.

## Required implementation sequence

### Step 1 — corrected Q24 package + clean development-bank replacement

The initially implemented Q24-specific reconciliation utility was technically
reviewed but later rejected by the project owner as unnecessary permanent
one-off machinery for the current development-stage bank. It is
**SUPERSEDED / NOT ACCEPTED as the retained correction architecture**.

The selected replacement path was completed and independently reviewed on
2026-10-31:

1. Q24-only CLI/service/repository/tests/npm commands/operator documentation were
   removed while preserving published Git history;
2. the exact canonical Q24 Option J wording remains
   `Paul is younger than Dick and John`;
3. corrected manifest/package identity bindings were verified from exact bytes;
4. dependency checks confirmed no live ApplicantAnswer/question-option references
   blocked the development reset;
5. only the imported OLSAT bank state and exclusively owned media were removed;
6. unrelated users, students, profiles, applications, scores and non-OLSAT data
   were preserved;
7. the normal importer clean-created the corrected authoritative bank;
8. final verification passed for 72 questions, 360 options, 108 media, exact
   source identities, 72/72 answer mappings, zero broken references, corrected
   Q24 wording, and an identical repeat import returning `ALREADY_IMPORTED`.

The corrected-bank EC6 checkpoint is therefore **CLOSED / ACCEPTED**. This remains
explicitly a development-stage cleanup strategy and must not be treated as a
production migration policy for a bank with live answers/attempts.

### Step 2 — bounded EC7 fidelity extension — IMPLEMENTED / REVIEW PASS

The EC7A architecture/support extension at
`3d8a7cbb7121f5aaf24291327a8e9c1f7d88e473` has been implemented and
independently reviewed with no blocking issue found.

It now provides:

- controlled `ITALIC` alongside existing BOLD/UNDERLINE;
- separate bounded structured textual-stimulus emphasis metadata;
- supported string-item structured targets needed by the verified physical source;
- safe shared Admin/Applicant semantic rendering;
- sidecar schema v2 and grouped transactional structured-item reconciliation;
- focused migration/test/build evidence without changing the protected OLSAT
  manifest/assets or populating any real source marks.

Owner manual/browser QA for this new capability is **DEFERRED until the actual
owner-verified OLSAT typography map is populated/applied**, so the final pass can
compare real source-derived formatting rather than synthetic temporary marks.

### Step 3 — final owner-verified real typography map — COMPLETE / REVIEW PASS

The explicit schema-v2 map was created in EC7B at
`backend/exam-content/olsat-emphasis.json` and independently reviewed with no
blocking issue found.

Accepted EC7B map evidence:

- 28 annotated source questions;
- 38 annotation targets;
- 59 spans total: 33 BOLD / 8 UNDERLINE / 18 ITALIC;
- Q24 option subjects encoded exactly;
- Q25/Q45 structured WORD_SERIES indexes 0/1/2 encoded exactly;
- Q58 terminal `cold` disambiguated from the earlier phrase;
- Q67 explicitly excluded;
- exact canonical hashes/offsets validated by the real parser/integrity test;
- manifest/assets/package fingerprint unchanged;
- live read-only preflight returned `PREFLIGHT_OK` with 34 fields that would
  change and zero writes.

No real emphasis metadata has been applied yet.

### Step 4 — controlled application — COMPLETE / REVIEW PASS

EC7C applied the unchanged reviewed sidecar through the existing transactional
operator path.

Reviewed evidence:

- immediate preflight: `PREFLIGHT_OK`, 38 annotations, 34 fields planned;
- first apply: `APPLIED`, exactly 34 persisted fields changed;
- normalized readback matched the reviewed sidecar;
- canonical question/option/structured content, identities, correctness, media,
  import marker and selected 108 managed-media metadata remained unchanged;
- identical second apply: `ALREADY_APPLIED`, zero fields changed / zero fields
  would change;
- second-run before/after snapshots matched exactly;
- focused EC7C verification: 3 files / 53 tests PASS;
- no migration/reset/re-import/frontend/runtime/Phase-B change occurred.

### Step 5 — source QA and acceptance — PAUSED FOR EC7D

Owner Admin browser QA began against the populated bank and confirmed that the
question/option content itself is rendering correctly, but exposed an Admin
structured-stimulus configuration UX defect before formal acceptance.

The defect is in authoring/configuration, not in the verified imported bank:

- the editor exposes eight source-oriented structured subtype names;
- grid/numeric forms additionally expose a per-cell `Text / Number` selector;
- that combination is redundant and can lead the Admin into invalid/confusing
  states even though the underlying rendered assessment content is correct.

The bounded correction is EC7D. It must simplify the Admin authoring surface to
three layout families — Grid / Table, Inline Items, Numbered List — while keeping
all existing internal structured subtype/payload values readable and round-trip
compatible. Untouched imported questions must not be rewritten merely because
the UI is simplified. No schema migration, bank reset, source-package rewrite,
or re-import is authorized for this correction.

After EC7D is implemented and independently reviewed, resume the owner Admin and
Applicant physical-source comparison. Only then may:

- EXAM-CONTENT-7 be formally accepted;
- Phase A be formally accepted.

Phase B must not begin before Phase A acceptance.

## Codex handoff rule

The raw scans do not need to be reinterpreted by Codex.

The preferred workflow is:

1. project owner supplies physical pages;
2. owner + review session establish verified textual findings;
3. Codex receives the exact verified source facts and implementation boundaries;
4. Codex performs deterministic implementation, hashing, offsets, reconciliation,
   and tests;
5. independent source review + owner visual QA complete acceptance.

If a requested implementation fact is not explicitly supported by the verified
source mapping, Codex must stop/report rather than infer it.
