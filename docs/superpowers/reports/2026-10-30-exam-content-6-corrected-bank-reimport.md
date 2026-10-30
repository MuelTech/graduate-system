# EXAM-CONTENT-6-CORR2 — Corrected development-bank clean import

Executed **2026-10-31 (Asia/Manila)**. The filename follows the owner's requested
report path. Implementation/operational evidence only: **EC6-CORR2, EC7 and Phase A
are NOT formally accepted by this report. Independent/owner review remains pending.**

Repository: `MuelTech/graduate-system`. Existing branch:
`feat/exam-content-integration`. Verified clean local and fetched remote starting
HEAD: **`29d98bbdd7bc47a4cdb9fb4f0415f427c27f641f`**. No pull was necessary.

Final implementation HEAD:
**`9da2b2608efb7537bb08ec2ea527b956ffcbc22a`** —
`refactor(exam): replace Q24 reconciler with clean bank import`.
This report is added in a separate documentation commit.

## Replacement decision and forward Git history

The current canonical source of truth, plan, checklist, physical-source audit,
and EMPHASIS operator documentation supersede the earlier CORR1 architecture.
The CORR1 implementation `9430c833f11c46b3de43a2eb0e9b8e6486b55233` and report
commit `c988ae86528fe0ff6c44c7809519d3b2f1659c09` remain published ancestors.
Their code/report are removed from the final tree with normal forward commits;
no `git revert`, reset, force push, rebase, history rewrite, branch creation,
merge, or change to `main` was used. Later canonical strategy documents remain
unchanged. CORR1 is superseded, not accepted as retained architecture.

## Exact repository changes

Removed eight files:

```text
backend/src/cli/exam-q24-correction.ts
backend/src/repositories/exam-q24-correction.repository.ts
backend/src/services/exam-q24-correction.service.ts
backend/tests/unit/cli/exam-q24-correction.test.ts
backend/tests/unit/services/exam-q24-correction.test.ts
backend/exam-content/Q24-CORRECTION.md
backend/src/services/exam-package-fingerprint.ts
docs/superpowers/reports/2026-10-30-exam-content-6-q24-source-correction.md
```

Changed three retained files:

```text
backend/package.json
backend/src/services/exam-content-package.service.ts
backend/tests/unit/services/exam-content-real-package.test.ts
```

Added only this replacement report:

```text
docs/superpowers/reports/2026-10-30-exam-content-6-corrected-bank-reimport.md
```

The two `exam-content:q24:preflight` / `exam-content:q24:apply` npm scripts were
removed. The extracted fingerprint helper had no independent caller/value after
the reconciler's removal, so normal preflight now uses its original inline
length-prefixed manifest/sorted-assets SHA-256 calculation. Source comparison
confirmed that service matches its pre-CORR1 implementation exactly, apart from
checkout line endings. **Fingerprint behavior did not change.**

The existing real-package test now also asserts the corrected manifest/package
identity, Q24 J wording, F/G/H/J/K labels, order, and answer F. These are ordinary
canonical-package regression assertions, not a retained correction workflow.
The dedicated Q24 correction tests no longer exist.

Stale ignored compiled Q24/helper artifacts were also removed by exact generated
module names. The current backend build does not recreate them. No permanent
reset/cleanup utility, generic revision framework, endpoint, or Admin reset UI
was added.

## Canonical source retained and recomputed

Q24 Option J remains exactly **`Paul is younger than Dick and John`**, with labels
**F/G/H/J/K**, existing source order, and correct answer **F**. No manifest field
changed during CORR2. All other 71 questions, all remaining Q24 content, and all
108 assets are byte-for-byte unchanged from the approved starting commit.
The fixed inventory remains **109 files: 1 manifest + 108 assets**.

Recomputed from the final exact bytes using normal preflight:

- Manifest SHA-256:
  `6fd4a1e7a0e9efe1d68b25d93198168f363a02f71c67ba7e1bc271ae4ffb1ed6`.
- Package/import fingerprint:
  `8fa052874c6276e8fefca396d3e9387febf90978cabc8fc43bcb627186af5738`.

The corrected emphasis source binding and current EMPHASIS documentation were
already accurate and remain unchanged. `.gitattributes`, schema/migrations,
frontend, and canonical strategy/acceptance documents were not modified.
Historical reports for earlier packages retain the package identities they
actually verified; past evidence was not rewritten.

## Dependency safety gate before deletion

Both the current Prisma schema and live MySQL foreign keys were inspected. The
complete incoming relation set for the four bank models is:

| Referencing field | Target | Treatment |
| --- | --- | --- |
| ApplicantAnswer.questionId | ExamQuestion | **0 OLSAT references required** |
| ApplicantAnswer.selectedOptionId | ExamOption | **0 OLSAT references required** |
| ExamOption.questionId | ExamQuestion | 360 owned options in the selected bank |
| ExamQuestion.stimulusMediaId | ExamMedia | 18 owned stimulus references |
| ExamOption.mediaId | ExamMedia | 90 owned option references |
| ExamQuestion.sourceImportId | ExamContentImport | 72 owned questions → olsat |

No additional schema/business relation was found. The temporary operator
asserted the exact six live foreign-key column/target signatures; an unexpected
additional relation would stop cleanup. Both ApplicantAnswer counts were **0**.
References to the 108 media IDs from questions or options outside the selected
OLSAT bank were also **0 / 0**.

Immediately before destructive writes, the transaction locked the exact selected
marker/question/option rows, rechecked the foreign-key set and dependency counts,
and required the complete captured bank digest and all ID sets to match. The
in-transaction gate again returned **question answers 0, selected-option answers
0, outside question-media refs 0, outside option-media refs 0**. No meaningful
external business record was cascade-deleted or rewritten.

## Pre-reset selection and preservation baseline

The selected bank contained 72 questions, 360 options, 108 distinct media rows,
and marker `olsat` with declared count 72 and the corrected fingerprint above.
Q24 already had the corrected J text and answer F. All 72 source answer mappings
and all source/content/media checks passed before removal. All broken-reference
checks were zero. Existing real emphasis was absent: 0 marked questions/options.

Exact cleanup selection: the complete captured **explicit question IDs** for
`sourceImportId = olsat`, their **explicit option IDs**, the **explicit media IDs
reached from those rows**, and the single marker `olsat`. Sorted-ID-list SHA-256
digests identify the captured sets used by the one-time deletion:

| Selected set | Count | ID-list SHA-256 |
| --- | ---: | --- |
| OLSAT question IDs | 72 | `645d16c6c2fb56a07c8e27d18d28b4ea7b4bd8cd1065ad01b41faff7f6df130f` |
| Owned option IDs | 360 | `113f6c08229dc72524d914c01242eee5d48a93f3c527b86e0f81cd3a2ecf2ee9` |
| Exclusively owned imported media IDs | 108 | `c5a624d08dd2d12bb722707f3912a4ea0a2566d51b281f17eeab1d2e126dee14` |

No deletion targeted an assumed count alone, all unsourced content, or an entire
table. Before mutation, sorted row digests/counts were saved for all **58 other
Prisma models plus non-OLSAT subsets of the four bank models** (62 preserved
model/row sets). Non-OLSAT question/option/import counts were 0/0/0; unrelated
media count was 6. Baselines included 56 Users, 44 Students, 3 applications,
1 score, 0 answers and 9 slots. All scalar fields and unrelated institutional/
profile/thesis records were covered, not only counts. No personal-data dump was
committed; local evidence contains counts/digests and bank-selection metadata.

## Development-only cleanup and media removal

A temporary workspace-external harness performed one Serializable Prisma
transaction (60-second timeout, 10-second max wait), after the gate above:

1. Deleted exactly the captured 360 option IDs, constrained to their selected
   question IDs, and required delete count 360.
2. Deleted exactly the captured 72 question IDs, constrained to `olsat`, and
   required count 72.
3. Deleted only marker `olsat` with expected count/fingerprint; required count 1.
4. Verified empty OLSAT question/marker state and unchanged unrelated digests.

It then used the existing **`ExamMediaService.discardUnreferencedImage`** for each
of the 108 captured media IDs. That service verifies managed namespace/provider,
uses guarded unreferenced-row deletion, and deletes the private object through
the storage provider's containment checks. No arbitrary private-file deletion,
broad garbage collection, or new media endpoint was used. No media record was
referenced outside the bank before deletion; the existing per-media deletion
guard checked live references again.

**Cleanup result: 72 questions, 360 options, 1 marker, 108 media rows and 108
private objects removed.** Every old media ID was absent and every associated
managed object was confirmed absent before import. OLSAT question/marker/media
remaining counts were all 0, unrelated digests still matched, and broken-reference
counts remained 0. Six unrelated staging-media records were preserved.

No full DB reset, `prisma migrate reset`, schema/data migration, truncation,
answer/application deletion, or institutional-data reset occurred. The temporary
destructive harness was deleted after verification and was never tracked or
committed. No replacement reset machinery remains in runtime source.

## Normal clean import and complete reconciliation

Only the retained normal workflow was used after cleanup:

```powershell
npm run exam-content:preflight
npm run exam-content:import
```

Preflight returned **PREFLIGHT_OK**, 72 validated / 108 assets / 109 files, with
zero imports/media writes. The fresh import returned **IMPORTED**, creating
**72 questions and 108 media objects**, exit 0. No Q24 command or manual SQL
insertion was used to create the resulting bank.

Full source-to-DB comparison passed for every question and option: source
identity, exact canonical text, runtime type/order, structured JSON, labels/order,
text/image mode, correctness, and exact managed media bytes.

| Final bank check | Result |
| --- | --- |
| OLSAT questions / options | **72 / 360** |
| Source question numbers | **1–72 exactly once**, no null/duplicate identities |
| Runtime response type | 72 MULTIPLE_CHOICE |
| Source categories | TEXT_MULTIPLE_CHOICE 25; STRUCTURED_STIMULUS_TEXT_CHOICES 29; VISUAL_STIMULUS_VISUAL_CHOICES 18 |
| Stimuli | NONE 25; STRUCTURED 29; IMAGE 18 |
| Correct-answer mappings | **72/72** source matches, exactly one correct option each |
| Imported images | **18 stimuli + 90 choices = 108 distinct references/media** |
| Marker | One `olsat`, questionCount 72, corrected fingerprint |
| Q24 J / labels / answer | **Paul is younger than Dick and John / F G H J K / F** |
| Real emphasis metadata | All null; no source sidecar/population |

Structured subtype counts: MATRIX **12**, WORD_BANK **4**, NUMBER_SEQUENCE **4**,
ALPHANUMERIC_SEQUENCE **1**, WORD_SERIES **2**, GROUPED_NUMBER_ROWS **4**,
LETTER_SEQUENCE **1**, LOGICAL_PREMISES **1**. Deep comparison preserves row/group
boundaries, numeric/string/fraction values, question marks, and list ordering.

All **108 new media records** match exact source SHA-256/size/MIME, and all
108 actual stored objects were byte-compared to their source assets:
**2,701,556 bytes, 108/108 matches**. This passed after the first import and again
after idempotency. None of the old 108 media IDs/objects remains. Total media
rows are **114 = 6 preserved unrelated + 108 newly imported**, not 108 retained
old OLSAT rows plus 108 duplicates.

All old development question/option/media IDs were replaced by disjoint new ID
sets, intentionally. No live external references existed to those old IDs.
The source question identities and canonical semantics remain authoritative.

Global broken-reference counts are all **0** for question→import, option→question,
stimulus→media, option→media, answer→question, selected-option→option,
answer→application and score→application.

## Unrelated preservation and identical-import idempotency

All 62 preserved model/row sets match their pre-reset digests/counts, including
every User/Student/profile/application/score/slot and non-OLSAT record. Counts
remain Users **56**, Students **44**, applications **3**, scores **1**, answers
**0**, slots **9**, unrelated media **6**. No unrelated model was truncated or
rewritten. Private storage operations targeted only the captured old bank objects
and the normal importer's newly created objects.

After the first successful import/reconciliation, complete row digests for all
62 models were captured again. The identical normal `exam-content:import` repeat
returned **ALREADY_IMPORTED**, **0 questions / 0 media created**, exit 0. Every
complete row digest/count remained identical afterward, proving no changed IDs,
content, timestamps, media records, or other persisted state on that repeat.

## Focused verification

From `backend`:

```powershell
npm run build
npm test -- tests/unit/services/exam-content-package.test.ts tests/unit/services/exam-content-import.test.ts tests/unit/services/exam-content-real-package.test.ts tests/unit/repositories/exam-content-import.repository.test.ts tests/unit/cli/exam-content-import.test.ts tests/unit/services/exam-emphasis.test.ts tests/unit/cli/exam-emphasis.test.ts tests/unit/services/exam-media.service.test.ts tests/unit/repositories/exam-media.repository.test.ts
```

Backend TypeScript build: **PASS**. Focused run: **9 files / 146 tests passed,
0 failed/skipped**, exit 0. This covers normal package/import validation,
transaction/compensation, corrected real-package integrity, updated emphasis
source identity, and the existing guarded media deletion/retrieval behavior.
The dedicated Q24-only tests are absent.

After scoped formatting of the retained real-package test, its focused rerun
passed **1 file / 1 test**, exit 0. Prettier check on that file passed.
`git diff --check` and staged `git diff --cached --check` passed. No backend lint
script exists; no unrelated lint configuration was installed. The existing Vite
CommonJS/config-loader advisory remained informational. All real operational
commands, safety/cleanup/verification harness runs, and normal imports exited 0.

## Non-executed work and stop boundary

Intentionally not run: full backend suite, frontend build/lint/tests (no frontend
change), Prisma generation/migration/reset commands, browser/manual/content QA,
hosted CI, deployment, broad media GC, or a production-bank reset. No superseded
Q24 CLI was invoked. The source scans were not reinterpreted.

No real `olsat-emphasis.json` exists or was applied. No real emphasis CLI workflow
ran; emphasis tests use their isolated synthetic/mocked persistence. No ITALIC,
WORD_SERIES/structured-text emphasis, semantic editor/renderer extension, or
final typography map was implemented. No Phase B duration/timer/timeout,
autosave/recovery, essay lifecycle, scheduling, submission/scoring, or
activation/selection work was started.

**STOP for independent/owner review.** This report does not formally accept
EC6-CORR2, EC7, or Phase A, and does not start the next package automatically.


## Independent review acceptance addendum — 2026-10-31

Independent review of the actual pushed branch confirmed:

- the superseded Q24-only CLI/service/repository/tests/operator documentation and
  npm commands are absent from the final tree;
- the temporary fingerprint helper is absent and normal package preflight uses
  the original inline fingerprint algorithm;
- Q24 Option J remains exactly `Paul is younger than Dick and John`, labels remain
  F/G/H/J/K, and the correct answer remains F;
- corrected manifest/package identity bindings remain accurate;
- the normal importer is the retained continuing path;
- no permanent reset/cleanup utility was introduced;
- `main` remained untouched;
- no EC7 ITALIC/structured-text implementation, real emphasis sidecar/application,
  or Phase B work was introduced.

The operational evidence in this report is accepted for the development-bank
replacement: dependency safety gate passed, the old imported OLSAT bank/media
were removed without unrelated-data loss, the corrected package was clean-imported,
the final bank reconciled to 72 questions / 360 options / 108 media with 72/72
correct-answer mappings and zero broken references, and the identical repeat import
returned `ALREADY_IMPORTED` with zero writes.

**EC6-CORR2 is formally ACCEPTED as of 2026-10-31.**

This acceptance closes the bounded post-acceptance Q24/corrected-bank checkpoint
only. The earlier Q24-specific reconciliation implementation remains historical
and superseded. EXAM-CONTENT-7 and Phase A are still not accepted; the next Phase A
package is the bounded ITALIC + structured textual-stimulus fidelity extension.
