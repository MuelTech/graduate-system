# EXAM-CONTENT-6-CORR1 — Q24 canonical source correction

Date: 2026-10-30 (Asia/Manila). Implementation and automated/source/database
evidence only. **This corrective package and Phase A are NOT formally accepted
by this report. Independent review and project-owner verification remain pending.**

Repository: `MuelTech/graduate-system`. Existing branch:
`feat/exam-content-integration`. Verified clean local and fetched remote starting
HEAD: **`20669937e5696f1ad247652246a11b32dab24fc6`**. No fast-forward was needed.
No branch creation, reset, rebase, stash, force operation, merge, or change to
`main` occurred.

Exact final implementation HEAD:
**`9430c833f11c46b3de43a2eb0e9b8e6486b55233`** —
`fix(exam): reconcile Q24 source text`. This evidence report follows in a separate
documentation commit so it can identify the exact implementation commit.

## Source authority and exact change

Authority: the owner-reviewed 12-page physical-source audit at
`docs/superpowers/reports/2026-10-30-olsat-physical-source-audit.md`, plus the
owner's explicit EC6-CORR1 instruction. Source: **Q24, page-004.jpg, Option J**.
The physical images were not reinterpreted and no additional content was inferred.

- Old canonical/imported text: `Paul is younger than Dick`
- Corrected canonical/imported text: `Paul is younger than Dick and John`

The manifest was changed by one exact byte-string replacement, adding only the
nine UTF-8 bytes ` and John`. Parsed old/new manifests are deeply equal after
reverting that one target. Every other question/stimulus/option/source field and
every correct-answer mapping is unchanged. Q24 labels remain F/G/H/J/K, and its
correct answer remains exactly the existing source-authoritative answer.

## Exact source/package identities

| Identity | Historical package | Corrected canonical package |
| --- | --- | --- |
| Manifest SHA-256 | `0327342827f9afafeadb65b88f18e9bb4f21b2c513fe6edfdb9104ab16abd3d9` | `6fd4a1e7a0e9efe1d68b25d93198168f363a02f71c67ba7e1bc271ae4ffb1ed6` |
| Exact package / import fingerprint | `a0126af9597439db7b8536ec2cae6a753cfeece68d3b038f9c1eb6c7dd83f263` | `8fa052874c6276e8fefca396d3e9387febf90978cabc8fc43bcb627186af5738` |

These values were computed from exact bytes, not assigned by guess. The package
still contains **72 VERIFIED questions and 109 files: 1 manifest + 108 assets**.
All 108 asset blobs match the approved starting commit byte for byte. Paths,
stimulus structure, labels/order, inventory, and `.gitattributes` are unchanged.

The existing length-prefixed manifest/sorted-assets fingerprint calculation was
extracted unchanged into one pure helper, reused by normal preflight and the
bounded correction. Reversing just the authorized string in memory reproduces
the historical manifest SHA and historical asset-bound package fingerprint;
the new bytes reproduce the new identities. Any unrelated source/asset change
fails the correction's exact identity checks.

The live emphasis-validator manifest constant and `EMPHASIS.md` now bind to the
corrected SHA. Historical EC3/EC6/EC7 implementation reports retain the old hashes
as evidence of the package they actually verified. Those historical facts were
not rewritten and canonical acceptance/checklist status was not marked complete.

## Bounded reproducible reconciliation

No schema shape changed. **No Prisma schema migration was created or applied**:
the existing option-text and import-fingerprint columns already represent the
two permitted data changes. A documented operator CLI was added instead of a
manual SQL edit, destructive re-import, or general revision framework.

Operator instructions: `backend/exam-content/Q24-CORRECTION.md`.

From `backend`, after building:

```powershell
npm run exam-content:preflight
npm run exam-content:q24:preflight
npm run exam-content:q24:apply
npm run exam-content:q24:apply
npm run exam-content:import
```

The fixed-package CLI defaults to read-only operation and reuses the existing
fail-closed argument contract. Unknown paths/force/ambiguous arguments are rejected.
It completes source-package validation before loading the DB repository. It does
not load private storage or expose an HTTP route.

Inside one **Serializable Prisma transaction** (60-second timeout, 10-second
maximum wait), the repository reads the import marker, whole question/option
bank, and valid media identities. Before any write it validates:

- the `olsat` marker and exact old or corrected package fingerprint, declared 72
  questions, and complete unique source-question identity set;
- all 72 questions and 360 options against source canonical text, types, order,
  structured payloads, option labels/order, correctness, and question linkage;
- 108 distinct source-asset/media mappings resolving to existing media rows;
- Q24 Option J's expected text for the marker's state, label J, order 3, null
  media, and null text-emphasis metadata;
- absence of incomplete/partial correction, duplicate identities, unrelated
  canonical drift, unexpected source state, or broken media references.

Only then do guarded exact-ID updates write Q24 J's `optionText` and the `olsat`
marker's `fingerprint`. Each update must affect exactly one row; any failure
rolls back both. The marker's creation timestamp and all other fields remain
unchanged. Existing emphasis elsewhere is retained; stale target emphasis is
rejected rather than shifted or cleared by this correction.

A corrected bank is validated in full again before returning an idempotent no-op.
The normal importer still rejects an old/conflicting fingerprint; it does not
silently reconcile it. Fresh environments import the corrected package normally.

## Before/after development-database evidence

Before mutation, a read-only snapshot captured sorted complete-row SHA-256
digests/counts for **all 62 Prisma models**, Q24 identity/target metadata, the
import marker, all correct-answer mappings, and imported media-reference counts.
Evidence files/harness were kept outside the repository; no personal data dump,
private storage keys, or unnecessary protected content is committed here.

| Check | Before | After |
| --- | --- | --- |
| Authoritative questions | 72 | 72 |
| Options | 360 | 360 |
| Q24 question ID | `30774044-fdf5-4aec-9a6d-8dbab3116190` | Same |
| Source identity | `olsat` / 24 | Same |
| Q24 question text | Baseline exact text digest captured | Same |
| Q24 Option J ID | `ae32a61e-35d3-4d3f-99bc-ea0ce076fd56` | Same |
| Option label/order | J / 3 | Same |
| Option correctness | `false` | Same |
| Option media / emphasis | null / null | Same |
| Option text | `Paul is younger than Dick` | `Paul is younger than Dick and John` |
| Import marker | `olsat`, questionCount 72, historical fingerprint | Same ID/count, corrected fingerprint |
| Correct-answer mappings | 72/72 source matches | Same 72/72 mappings |
| Imported media references | 108 | Same 108 distinct references |
| Users / Students | 56 / 44 | Same |
| Answers / scores / applications | 0 / 1 / 3 | Same |

For the post-operation comparison, **only these two fields were normalized back
to their historical values** before comparing every model digest:

1. `ExamOption.optionText` for the exact Q24 J option ID above;
2. `ExamContentImport.fingerprint` for marker `olsat`.

Every normalized digest and count matched the before snapshot across all 62
models. Thus all question/option IDs, all other canonical text, labels/order,
correctness, media/source identities, metadata, timestamps, accounts/profiles,
answers, scores, applications, and unrelated records remain unchanged.

The ordered 72-question correct-label mapping digest remained
`1c6a106d44f6e40063f143768c0873ad756dc586fbba3e04aed689a5540a4292`.
All question→import, option→question, stimulus/option→media, answer→question,
selected-option→option, answer→application and score→application broken-reference
counts were **0** after correction and after repeated commands.

After the first successful operation, complete unnormalized row digests were
captured again. The second correction and normal-import idempotency invocation
left **all 62 model digests/counts exactly unchanged**. No duplicate bank or media
record was created and no question/option was deleted or re-imported.

## Actual operational results

| Command | Result |
| --- | --- |
| `npm run exam-content:q24:preflight` | PREFLIGHT_OK; 0 option / 0 marker writes; wouldChange true |
| `npm run exam-content:q24:apply`, first invocation | RECONCILED; exactly 1 option and 1 marker changed; exit 0 |
| Same correction command, identical repeat | ALREADY_RECONCILED; 0 option / 0 marker writes; exit 0 |
| `npm run exam-content:preflight` afterward | PREFLIGHT_OK; 72 validated, 108 assets, 109 files, 0 imported / 0 media created; exit 0 |
| `npm run exam-content:import` afterward | ALREADY_IMPORTED; 0 questions / 0 media created; exit 0 |
| Read-only post-operation preservation harness | Q24_PRESERVATION_OK, all 62 original model sets preserved except the two permitted fields; exit 0 |
| Same harness after both repeat commands | Q24_PRESERVATION_OK; all unnormalized post-first-operation digests unchanged; exit 0 |

One additional read-only npm preflight invocation printed PREFLIGHT_OK, then the
process ended with native exit `-1073741819` (`0xC0000005`) under Node v26.5.0.
No writes were requested or performed by that invocation. Its cause was not
established or attributed to application code. A direct repeat of
`node dist/cli/exam-q24-correction.js --dry-run` completed with the same valid
summary and **process exit 0 before mutation**. An earlier complete npm preflight
also exited 0. All apply/idempotency and post-preservation commands above exited 0;
the anomalous process exit is not presented as a clean command result.

## Focused tests, build and formatting

Exact final focused command, from `backend`:

```powershell
npm test -- tests/unit/services/exam-q24-correction.test.ts tests/unit/cli/exam-q24-correction.test.ts tests/unit/services/exam-content-package.test.ts tests/unit/services/exam-content-import.test.ts tests/unit/services/exam-content-real-package.test.ts tests/unit/repositories/exam-content-import.repository.test.ts tests/unit/cli/exam-content-import.test.ts tests/unit/services/exam-emphasis.test.ts tests/unit/cli/exam-emphasis.test.ts
```

**9 files / 133 tests passed, 0 failed/skipped, exit 0.** Coverage includes the
single source edit and historical hash reconstruction, label/order/key preservation,
old→corrected transaction, identical no-op, unexpected text/label/order/linkage/
IDs/correctness/source/media/fingerprint, incomplete/partial state, stale target
emphasis, rollback on marker failure/zero-row guard, exact update-field scope,
CLI delegation/arguments/disconnection, fresh corrected import, normal-import
ALREADY_IMPORTED behavior, and unchanged SOURCE_CONFLICT handling. DB/CLI mutation
tests use isolated synthetic identities and mocked persistence/transaction
rollback, separate from the real development operations documented above.

`npm run build` from `backend`: **PASS**, TypeScript exit 0.
Focused Prettier write/check on the six new TypeScript implementation/test files:
**PASS**. The existing installed frontend formatter executable was used only as a
tool on backend targets; no frontend source/config/package file changed.
No backend lint script/configuration exists for a scoped lint run; type build,
focused tests and formatting were used. No unrelated lint tooling was installed.
`git diff --check` and staged `git diff --cached --check`: **PASS**.
The existing Vite CommonJS/config-loader advisory was informational.

## Exact repository files changed

```text
backend/exam-content/EMPHASIS.md
backend/exam-content/Q24-CORRECTION.md
backend/exam-content/olsat/manifest.json
backend/package.json
backend/src/cli/exam-q24-correction.ts
backend/src/repositories/exam-q24-correction.repository.ts
backend/src/services/exam-content-package.service.ts
backend/src/services/exam-emphasis.service.ts
backend/src/services/exam-package-fingerprint.ts
backend/src/services/exam-q24-correction.service.ts
backend/tests/unit/cli/exam-q24-correction.test.ts
backend/tests/unit/services/exam-q24-correction.test.ts
docs/superpowers/reports/2026-10-30-exam-content-6-q24-source-correction.md
```

## Non-executed work and review stop

No full delete/re-import, media rewrite/GC, DB reset, schema migration, frontend
change/build/lint, broad unrelated test suite, hosted CI, deployment, browser QA,
or independent physical-image reinterpretation ran. The normal import command was
executed only to prove ALREADY_IMPORTED after reconciliation, with zero writes.

No real `olsat-emphasis.json` was created or applied. No emphasis preflight/apply
operation ran against the real bank; emphasis unit/CLI tests used isolated mocked
fixtures to verify the updated hash binding. No ITALIC, structured/WORD_SERIES
emphasis, renderer/editor extension, or final typography-map work was implemented.
The only EC7 runtime change is the source-hash constant required to bind to the
corrected manifest.

No Phase B duration/timer, timeout, autosave/recovery/reload, essay lifecycle,
scheduling, submission/scoring, or activation/selection work was started.
Canonical acceptance/checklist status remains untouched. The accepted EC6 UI
follow-up was not reopened.

**STOP for independent review and project-owner verification** of the exact source
wording, preserved Q24 identities/semantics, package/import identities, and
operational evidence. This report does not formally accept EC6-CORR1 or Phase A,
and does not authorize starting the next EC7 extension automatically.
