# EC7E — Items Consolidation + Q40 Source Fidelity

Date: 2026-10-31 (Asia/Manila).

Implementation and focused automated evidence. Independent remote review and
owner Admin/Applicant physical-source QA remain required. This report does not
formally accept EXAM-CONTENT-7 or Phase A. EC7D remains independently reviewed PASS.

## Git checkpoint

- Repository: `MuelTech/graduate-system`.
- Existing branch: `feat/exam-content-integration`.
- Starting local and verified remote feature HEAD:
  `8451bd9971f6b4df2250200ba91a0dec258eed0d`.
- Verified remote main HEAD:
  `c8b05814924cdc3c741dc75f7bf0d06aeba5b6d0`.
- Starting working tree: clean.
- Implementation commit:
  `052ddcf1ce96c625da8a2618f131c98c017d1051` —
  `fix(exam): consolidate items and correct Q40 source order`.
- The separate evidence delivery commit contains this report and the bounded
  EMPHASIS operator note, titled `docs(exam): record EC7E re-import and integrity evidence`.
  Its exact hash is recorded in the final handoff after push; a commit cannot
  contain its own hash. Resolve it with `git log -1 --format=%H --
  docs/superpowers/reports/2026-10-31-exam-content-7-items-and-q40-source-fidelity.md`.

All ten requested canonical documents were read before implementation, along with
the existing editor/helper/shared renderer, focused tests, canonical manifest,
reviewed sidecar, importer/source identity, media cleanup implementation, Prisma
relations, and the accepted development-bank replacement report. No scans were
reinterpreted and no source fact or emphasis was inferred.

## Structured authoring and generic rendering

Before EC7E, the accepted EC7D editor exposed Grid / Table, Inline Items, and
Numbered List. EC7E exposes exactly **Grid / Table** and **Items**. MATRIX and
GROUPED_NUMBER_ROWS load under Grid / Table; WORD_BANK, NUMBER_SEQUENCE,
ALPHANUMERIC_SEQUENCE, WORD_SERIES, LETTER_SEQUENCE, and LOGICAL_PREMISES load
under Items. The visible Text / Number primitive selector remains removed.

The compatibility adapter retains all eight internal subtypes. ITEMS is only a
frontend selection key; newly authored Items use the existing WORD_SERIES shape.
Unchanged legacy data preserves exact JSON, subtype, field shape, item order,
string/number primitives, fractions and gaps. Selecting Items on existing
LOGICAL_PREMISES is a no-op and retains its subtype and semantic metadata.
The accepted bounded adaptation for actual edits is retained, as are text limits,
count limits, fail-closed malformed-content handling, and stale-emphasis clearing.

The shared LOGICAL_PREMISES renderer now emits a container with one paragraph
per item in order. It has no ordered/unordered list elements, list marker classes,
or automatic numbers. Each string still passes through SemanticText, preserving
escaped BOLD/UNDERLINE/ITALIC rendering and invalid-metadata fallback. There is no
Q40 string check, dynamic split, frontend exception, backend correction service,
new persisted discriminator, or schema change.

## Canonical Q40 before and after

Before:

- questionText: `Assume that the following statements are true. We know that —`;
- LOGICAL_PREMISES.items: the three premises only.

After, using the manifest's established em-dash punctuation normalization:

- questionText: `Assume that —`;
- LOGICAL_PREMISES.items, in order:
  `All As are Cs.`, `Some Ds are Cs.`, `No Bs are Cs.`, `We know that —`;
- the existing composition renders leading prompt, the three premises, trailing
  prompt, then choices, through generic shared components.

Q40 choice labels/order remain F/0, G/1, H/2, J/3, K/4; every choice text is
unchanged and the correct answer remains G. The other 71 canonical questions,
including the other 28 structured payloads and corrected Q24 option J, are exactly
unchanged. All 108 assets remain unchanged (2,701,556 bytes). The manifest's
existing line endings and lack of terminal newline are retained.

## Source and emphasis identities

| Identity | Before | After |
| --- | --- | --- |
| Manifest SHA-256 | `6fd4a1e7a0e9efe1d68b25d93198168f363a02f71c67ba7e1bc271ae4ffb1ed6` | `2cd14cd6578eafe14536db36833a07a085e7d7e091ed2f6d2a934f79b6f30c95` |
| Package/import fingerprint | `8fa052874c6276e8fefca396d3e9387febf90978cabc8fc43bcb627186af5738` | `01ad6b100f65e312387779852a352dcff97d5fd2a0b707ba1901dc2c8aeac343` |

Both package fingerprints were recomputed with the production length-prefixed
manifest/sorted-assets algorithm. Recomputing the old fingerprint with the old
manifest and current assets also matched the accepted old identity, proving asset
invariance collectively. Source preflight validates 72 questions, 108 assets and
109 files with unchanged category/subtype totals.

Every one of the 38 reviewed target strings was compared against the starting
manifest and remains equal and textSha256-compatible. The sidecar changes only
manifestSha256; verification metadata, target identities, text hashes, offsets,
styles and ordering are unchanged. Totals remain 28 annotated questions,
38 targets, 59 spans (33 BOLD / 8 UNDERLINE / 18 ITALIC). Q40 receives no invented
emphasis. Q25/Q45 retain their exact reviewed question and structured marks.
The existing OLSAT_MANIFEST_SHA256 operator guard and the two real-package/map
identity regression assertions follow the corrected manifest. The importer
algorithm, package key, and persistence model are unchanged.

## Development database operations

The importer correctly rejects a changed fingerprint under an existing `olsat`
marker, so the accepted development-only clean replacement path is required.
The configured target was verified as local and NODE_ENV=development.

The initial read-only bank gate found one pre-existing noncanonical live edit:
Q26 stored WORD_BANK items `20, 15`, `40, 30`, `60, ?`, while the canonical package
defines a MATRIX. All other canonical question/option fields matched the starting
package. No reset or write occurred on that failed gate. A clarification was
requested because the clean import would replace that live Q26 edit.

Read-only dependency checks: 0 ApplicantAnswer references to bank questions,
0 selected-option references, 0 outside question-media references, and 0 outside
option-media references. Incoming live foreign keys match the six expected bank
relations. Initial bank counts: 72 questions / 360 options / 108 referenced media;
marker is the accepted old fingerprint and declared count 72.

The owner explicitly replied **Restore canonical development bank**. That
authorizes restoring Q26's canonical MATRIX during this clean development import;
its manifest was never changed. A fresh capture required the exact discovered
Q26 WORD_BANK payload, with every other canonical field matching the old source.
The initial live semantic counts were 27 question fields / 0 option fields /
2 structured fields. The five reviewed Q24 option marks were absent in that
initial state; this observation does not change the accepted historical EC7C
review. The authorized deterministic reapplication restores the reviewed map.

The temporary workspace-external operator captured explicit bank IDs, complete
bank/media state, and counts/hashes for the 62 unrelated/non-OLSAT model sets.
It verified every source answer mapping and all 108 managed objects against
source checksum/length before mutation. No personal records were dumped to Git.
The cleanup selection was the captured 72 question IDs, their 360 option IDs,
108 exclusively referenced media IDs, and only marker olsat. Sorted ID-list
SHA-256 bindings identify those old selected sets:

| Set | Count | SHA-256 |
| --- | ---: | --- |
| Questions | 72 | `05ac77a5302303981ad20c4714abaebd513e875fa377bace139698156acb5632` |
| Options | 360 | `aad7115476d15fd2467e2e6a6be6d1ce2f875a6acfc9b16247bc1d28a1f887a0` |
| Media | 108 | `ae8ce934aadec5ff01921b4b916a8ae85c429b00998c83fe40c508613333610d` |

A Serializable transaction locked the selected marker/questions/options,
rechecked the complete captured state, live FK set, four zero dependency counts,
and unrelated hashes, then removed exactly 360 options, 72 questions, and 1 marker.
It asserted the empty sourced bank and unchanged unrelated hashes before commit.
The existing ExamMediaService.discardUnreferencedImage then removed exactly
108 owned media rows/objects, with provider/namespace containment and live
unreferenced guards. Every old row/object was confirmed absent. No answer,
application, score, slot, or other business record was deleted or rewritten.

Only the normal retained CLI created the replacement bank and applied marks:

```powershell
npm run exam-content:preflight
npm run exam-content:import
npm run exam-emphasis:preflight
npm run exam-emphasis:apply
npm run exam-content:import
npm run exam-emphasis:apply
```

Source preflight returned PREFLIGHT_OK (72 questions / 108 assets / 109 files).
First import returned IMPORTED (72 questions / 108 media created). Before emphasis,
full bank reconciliation passed with all three metadata columns null. The actual
live emphasis preflight then returned:

```json
{"status":"PREFLIGHT_OK","annotationsValidated":38,"fieldsChanged":0,"fieldsWouldChange":34}
```

First apply returned:

```json
{"status":"APPLIED","annotationsValidated":38,"fieldsChanged":34,"fieldsWouldChange":34}
```

Exact normalized readback matched the entire reviewed sidecar, including null
remainders, Q24 option subjects, Q25/Q45 structured marks, and no Q40 annotations.
Only the expected 34 metadata fields changed between base import and first apply.
The source-binding-only revised sidecar's on-disk SHA-256 is
`912b96d775d101705cc324bbcad2c4fd503ec8f8059fb33a2a49485c4840c7fb`.

| Final live verification | Result |
| --- | --- |
| Questions / options / bank media | 72 / 360 / 108 |
| Source numbers | 1–72, exactly once each |
| Verified answer mappings | 72/72, exactly one correct option each |
| Canonical content | All 72 questions and 360 choices match corrected source |
| Q26 | Restored to canonical MATRIX with owner authorization |
| Q40 | Leading prompt → three premises → trailing prompt → unchanged choices |
| Managed source media bytes | 108/108 checksum/length matches; 2,701,556 bytes |
| Question / option / structured marked fields | 27 / 5 / 2 |
| Remaining null fields | 45 / 355 / 70 |
| Q25/Q45 | Exact reviewed instruction and item spans restored |
| Import marker | olsat, corrected fingerprint, questionCount 72 |
| Broken bank references | 0 across all six bank/answer checks |

Question/option/media IDs were intentionally replaced by disjoint new sets;
the dependency gates proved no live answers relied on the old IDs. Total media
is 114 = 108 newly imported + 6 unrelated preserved; no old bank media remain.

Identical import returned **ALREADY_IMPORTED**, 0 questions / 0 media created.
Identical emphasis apply returned **ALREADY_APPLIED**, 38 validated targets,
0 fields changed / 0 fields would change. Complete bank/marker/options/media
snapshots before and after both repeat commands matched exactly, with SHA-256:
`f1b4ddd141387a1378bf1fed856d51affa089d3aff955345eadc9f179ffc6468`.
The existing reviewed importer/reconciler paths and zero-change summaries also
confirm neither repeat issued creation/update work.

All 62 unrelated/non-OLSAT sets retained their exact counts/hashes throughout
cleanup, base import, apply, and repeats: 56 Users, 44 Students, 3 applications,
1 score, 0 answers, 9 slots, and 6 unrelated media, among the preserved data.
Snapshots and source-integrity evidence are local only under
`C:/Users/admin/.codex/visualizations/2026/10/31/01a19216-2a3a-7943-a46a-1244e505eca0/`
(`ec7e-before.json`, `ec7e-reset.json`, `ec7e-base.json`,
`ec7e-after-first.json`, `ec7e-after-repeat.json`, and `ec7e-source-integrity.json`).
The temporary destructive operator was removed after verification and is not
retained as application/reset/reconciler machinery.

## Focused automated verification

From backend:

```powershell
npm run build
npm test -- tests/unit/services/structured-authoring.contract.test.ts tests/unit/services/admin-exam-editor.contract.test.ts tests/unit/services/structured-emphasis.test.ts tests/unit/services/structured-emphasis-rendering.contract.test.ts tests/unit/services/exam-content-real-package.test.ts tests/unit/services/exam-emphasis-real-map.test.ts tests/unit/services/exam-content-package.test.ts tests/unit/services/exam-content-import.test.ts tests/unit/repositories/exam-content-import.repository.test.ts tests/unit/cli/exam-content-import.test.ts tests/unit/services/exam-emphasis.test.ts tests/unit/cli/exam-emphasis.test.ts tests/unit/services/exam-media.service.test.ts tests/unit/repositories/exam-media.repository.test.ts
```

Backend TypeScript build: PASS. Focused Vitest: **14 files / 280 tests PASS**,
0 failures/skips. Existing Vite config-loader advisory is informational. An initial
new rendering assertion expected adjacent text after a strong element; the
existing semantic renderer wraps the remainder in a span. The assertion was
corrected to check semantic output without imposing a changed wrapper contract.

From frontend:

```powershell
npx tsc --noEmit
npx eslint src/lib/exam-content.ts src/components/exam-content/structured-stimulus-editor.tsx src/components/exam-content/stimulus-renderer.tsx
```

Both PASS. Scoped Prettier check and git diff --check PASS. React review checked
the controlled editor, derived layout state, labeled inputs, bounded callbacks,
shared semantic renderer, and absence of new effects or injected markup.

Tests exercise exactly two layout labels, rejection/removal of Numbered List,
all eight mappings, existing LOGICAL_PREMISES editing under Items, unnumbered
stacked rendering with emphasis, all 29 real structured round trips/renderability,
primitive preservation and restrictive-grammar adaptation, Q25/Q45 unchanged-save
metadata, and canonical Q40 ordering/choices/answer. Shared-component static
composition and source assertions protect Admin/Applicant text → stimulus →
choice order. These are automated checks, not owner browser/visual QA.

## Changed files and boundaries

- `frontend/src/lib/exam-content.ts`
- `frontend/src/components/exam-content/structured-stimulus-editor.tsx`
- `frontend/src/components/exam-content/stimulus-renderer.tsx`
- `backend/exam-content/olsat/manifest.json`
- `backend/exam-content/olsat-emphasis.json`
- `backend/exam-content/EMPHASIS.md`
- `backend/src/services/exam-emphasis.service.ts` (source hash guard only)
- `backend/tests/unit/services/structured-authoring.contract.test.ts`
- `backend/tests/unit/services/structured-emphasis-rendering.contract.test.ts`
- `backend/tests/unit/services/exam-content-real-package.test.ts`
- `backend/tests/unit/services/exam-emphasis-real-map.test.ts`
- this report.

No Prisma/schema/migration, API type, scoring, attempts, timers, scheduling,
autosave, submission, essay lifecycle, thesis/dissertation, or Phase B source
change. No permanent reset/reconciler machinery is added. No branch creation,
merge to main, reset, rebase, history rewrite, or force push.

There is no unresolved implementation/integrity issue. The discovered live Q26
difference was explicitly resolved by the owner before destructive operations.
Independent review and owner QA remain outstanding acceptance steps.

Not executed/claimed: owner Admin/Applicant browser/manual QA, visual/source
comparison, scans review, formal EC7 or Phase A acceptance, Phase B, hosted CI,
deployment, full-repository suites, frontend production build, Prisma generation
or migration commands, production-bank reset, or broad media garbage collection.

Stop after bounded delivery. Next step: independent review of actual pushed
remote source; owner QA resumes only after that review passes.
