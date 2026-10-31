# EXAM-CONTENT-7B — Real owner-verified OLSAT typography map

Date: 2026-10-31 (Asia/Manila).

**Sidecar created and validated; database preflight only. STOP for independent
review. No real emphasis has been applied.**

## Git and authorization checkpoint

- Repository: `MuelTech/graduate-system`.
- Existing branch: `feat/exam-content-integration`.
- Approved starting local/remote HEAD:
  `43883037a2aa74b6575e343d91a57ba73a215e6d`.
- Starting working tree: clean.
- Final implementation HEAD: `b25a6c486c341cc67cbc9c6b264c15293d238bd4`
  (`data(exam): add verified OLSAT typography map`).
- This evidence report is delivered in a separate commit after the implementation;
  its commit is the final delivery HEAD reported in the handoff.
- Remote main remains `c8b05814924cdc3c741dc75f7bf0d06aeba5b6d0`;
  local main remains `f5d5cbae4e8948a9a0065e0cfd469975f6427c86`.
  The pre-existing difference is untouched. No new branch, merge to main, reset,
  rebase, rewritten history, or force push.

Current authority was read: source of truth, integration plan, implementation
checklist, physical-source audit, independently reviewed EC7A report, EMPHASIS.md,
canonical manifest, and schema-v2 parser/reconciler. The explicit owner map in the
EC7B request is the sole authorization for these annotations. No scans were
reinterpreted and no extra typography was inferred from words, answers, case,
question type, or repeated wording. EC7A runtime architecture is unchanged.

## Sidecar and protected package identity

Created `backend/exam-content/olsat-emphasis.json`, a sibling of the protected
base package, using only the existing schema-v2 contract. Verification is exactly:

```json
{
  "status": "VERIFIED",
  "verifiedBy": "PROJECT_OWNER_APPROVED_PHYSICAL_SOURCE_MAP",
  "verifiedAt": "2026-10-31T09:39:09Z"
}
```

That timestamp records the supplied owner-authorization checkpoint, not an inferred
scan review time. Package key is `olsat`, schemaVersion is 2, and indexConvention
is `UTF16_CODE_UNITS`.

Manifest SHA-256 remains:
`6fd4a1e7a0e9efe1d68b25d93198168f363a02f71c67ba7e1bc271ae4ffb1ed6`.

Computed base-package fingerprint remains:
`8fa052874c6276e8fefca396d3e9387febf90978cabc8fc43bcb627186af5738`.

Neither manifest nor any of the 108 assets changed. Corrected Q24 option J remains
`Paul is younger than Dick and John`. No importer, Prisma schema/migration,
runtime source, frontend, or bank row was changed by this package.

## Exact map inventory

| Inventory | Count |
| --- | ---: |
| Distinct source questions | 28 |
| Annotation targets | 38 |
| questionText targets | 27 |
| optionText targets (Q24) | 5 |
| structuredItem targets (Q25/Q45) | 6 |
| Total spans | 59 |
| BOLD spans | 33 |
| UNDERLINE spans | 8 |
| ITALIC spans | 18 |

BOLD consists of 22 question-text spans, 5 option spans, and 6 structured-item
spans. Annotated question numbers are exactly:

`1, 5, 6, 7, 10, 11, 15, 18, 20, 24, 25, 26, 27, 28, 33, 35, 42, 45, 49, 50, 51, 55, 57, 58, 61, 62, 64, 72`.

Annotations sort by source number, questionText first, then option order, then
structured index. Spans use the validator's deterministic normalized order.
Q6/Q18/Q27/Q62 each have one questionText annotation combining the authorized
italic and underline spans, rather than duplicate field targets.

All offsets were calculated programmatically in JavaScript UTF-16 code units,
zero-based/end-exclusive. Each range was checked by slicing the exact canonical
string and matching the owner phrase; ordinary phrases must resolve exactly once.
All target hashes bind the entire exact canonical UTF-8 question/option/item
string, with no trimming, case folding, Unicode/newline normalization, or
phrase-only hash for question/option fields.

### Special target evidence

- **Q24:** exactly five optionText targets, no questionText target. Labels/orders
  resolved from the prepared source are F/0, G/1, H/2, J/3, K/4. Their first subject
  words are respectively Dick, Paul, Paul, Paul, Dick, each BOLD from offset 0 to
  4. Corrected J text and its full-field hash are preserved.
- **Q25/Q45:** each has one questionText ITALIC `most clearly` target and three
  structuredItem BOLD targets, indexes 0/1/2. Their exact WORD_SERIES values are
  peaceful/serene/tranquil and forward/sideways/down respectively. Each item is
  marked in full; index 3 (`?`) is not annotated.
- **Q58:** exactly one questionText target containing seven BOLD spans. Terminal
  `cold` resolves inside the unique final `Which word means cold?` clause at
  UTF-16 `[135,139)`. The earlier `very cold water` is a single whole-phrase span
  `[43,58)`; there is no additional independent cold span inside it.
- **Q67:** zero annotations. No image, MATRIX cell, grouped numeric row, numeric
  sequence item, arbitrary path, gap marker, or unlisted field is annotated.

## Source validation and focused tests

Before database access, normal source-package preflight and the real schema-v2
parser validated all 38 identities and 59 spans, exact hashes, supported surfaces,
strict metadata, and unique targets. Generated counts matched all owner integrity
assertions without adjustment. Source validation result: **PASS**.

Added one read-only real-map integrity test in the existing Vitest infrastructure.
It loads the actual sidecar and actual canonical package, checks exact style and
field totals, all question numbers, every authorized substring and occurrence,
deterministic ordering, Q24/Q25/Q45/Q58 cases, Q67 exclusion, and protected package
identity. Real-map test: **1 file / 1 test PASS**.

Final focused command, from backend:

```powershell
npm test -- tests/unit/services/exam-emphasis-real-map.test.ts tests/unit/services/exam-emphasis.test.ts tests/unit/services/text-emphasis.test.ts tests/unit/services/structured-emphasis.test.ts tests/unit/cli/exam-emphasis.test.ts tests/unit/services/exam-content-real-package.test.ts
```

Result: **6 files / 121 tests passed, 0 failed/skipped**, exit 0. This covers the
real map/package, v2 parser, text/structured validation, and existing read-only CLI
preflight behavior. Existing CLI apply/clear unit tests use synthetic mocked
persistence only. No new test framework or runtime dependency was introduced.
The existing Vite config-loader advisory was informational.

Prettier checks on the sidecar and new test passed. Working/staged diff checks
passed. Backend build was not rerun: no runtime source/type contract changed and
the existing dist CLI was built from the unchanged reviewed source. Frontend
build, the full 273-test EC7A set, full repository suites, unrelated tests, schema
generation/migration commands, and broad database digest sweeps were not run.

## Live database preflight and unchanged metadata

Initial narrow reads encountered connection failures while XAMPP was unavailable.
An attempt to start its existing configuration exited with the existing missing
Aria-log startup error. No database files were repaired or removed. The owner then
restored working XAMPP and explicitly instructed continuation. Successful live
verification followed; the startup issue did not require runtime changes.

The existing operator command was executed in read-only mode:

```powershell
npm run exam-emphasis:preflight
```

It returned, on both successful executions:

```json
{
  "status": "PREFLIGHT_OK",
  "annotationsValidated": 38,
  "fieldsChanged": 0,
  "fieldsWouldChange": 34
}
```

The actual 34 fields are 27 question-text fields + 5 option-text fields + 2 grouped
structured metadata fields. Six structuredItem targets coalesce into two stored
fields, explaining the difference from 38 annotation targets. The live preflight
confirmed marker fingerprint/count, the complete 72-question source identity set,
and source/database canonical text/structured matches for all targeted fields.

The second preflight was bracketed by matching read-only snapshots selecting
only the OLSAT marker, question IDs/source numbers/semantic metadata, and option
IDs/semantic metadata. They contained 72 questions and 360 options and matched
exactly, without inspecting unrelated application/institutional records:

| Stored metadata | Before non-null | After non-null |
| --- | ---: | ---: |
| questionTextEmphasis (72 questions) | 0 | 0 |
| structuredStimulusEmphasis (72 questions) | 0 | 0 |
| optionTextEmphasis (360 options) | 0 | 0 |

Local snapshot evidence is outside the repository in `ec7b-db-before.json` and
`ec7b-db-after.json`. Temporary mechanical tooling is not committed.
**No `npm run exam-emphasis:apply` command was executed. No real emphasis metadata,
canonical assessment content, or institutional data was written.**

## Exact changed files and stop boundary

Implementation commit changes only:

- `backend/exam-content/olsat-emphasis.json` — new real schema-v2 map.
- `backend/tests/unit/services/exam-emphasis-real-map.test.ts` — new read-only
  integrity test.
- `backend/exam-content/EMPHASIS.md` — bounded current-map/preflight-only status.

The separate evidence commit adds only:

- `docs/superpowers/reports/2026-10-31-exam-content-7-real-typography-map.md`.

No frontend work, timer/autosave/scheduling/scoring/submission changes, essay
lifecycle changes, or Phase B work. No deployment or manual/browser QA was
performed. Canonical acceptance documents are unchanged.

Independent sidecar review, separately authorized application/idempotency, deferred
owner Admin/Applicant manual/browser source comparison, and formal EXAM-CONTENT-7
and Phase A acceptance remain **PENDING**. Stop here; do not apply the map or start
Phase B automatically.
