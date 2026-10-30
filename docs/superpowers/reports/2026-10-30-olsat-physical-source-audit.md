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

### Step 1 — bounded Q24 source correction

Correct the exact Q24 option-J canonical text and reconcile the imported row.
Review package fingerprint/import-marker implications explicitly because changing
the canonical manifest changes protected source identity assumptions.

Required proof:

- exact old/new source field;
- exact old/new database field;
- no unrelated question/option change;
- answer mapping remains correct;
- IDs/labels/order/media remain unchanged;
- revised canonical package identity is intentional and documented.

### Step 2 — bounded EC7 fidelity extension

Extend the safe semantic typography architecture to support verified source
requirements:

- add controlled `ITALIC` style support;
- preserve existing BOLD/UNDERLINE behavior;
- support typography for structured textual stimulus values demonstrated by the
  physical source, with the smallest additive representation possible;
- continue using escaped React string nodes and controlled semantic elements;
- do not introduce arbitrary HTML, stored Markdown, dynamic style injection, or
  a broad rich-text document model;
- extend validation, Admin/source tooling, projections/renderers, and focused
  tests only as required.

A new Prisma migration should not be assumed merely for ITALIC because the
existing emphasis columns are JSON. Any schema change for structured stimulus
typography must be justified by the chosen bounded representation.

### Step 3 — final owner-verified real typography map

Only after Steps 1 and 2 are reviewed/accepted:

- compare all 12 physical pages again;
- enumerate the exact real targets;
- compute exact canonical UTF-16 offsets/hashes through deterministic tooling;
- create the reviewed production sidecar/structured-text annotations;
- do not let Codex or an LLM independently decide what the scan means.

### Step 4 — controlled application

Run the reviewed preflight/application sequence and verify:

- full fail-closed preflight;
- expected target/span counts;
- first apply succeeds;
- identical second apply is idempotent / `ALREADY_APPLIED`;
- no unrelated bank content changes.

### Step 5 — source QA and acceptance

Compare the physical source against Admin and Applicant presentation.

Only then may:

- the Q24 post-acceptance correction be closed;
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
