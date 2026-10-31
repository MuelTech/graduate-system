# EXAM-CONTENT-7C — Verified typography application and idempotency

Date: 2026-10-31 (Asia/Manila).

**Operational application and idempotency checks passed. STOP for independent
review. This report does not certify manual/browser QA or accept EC7/Phase A.**

## Git checkpoint and scope

- Repository: `MuelTech/graduate-system`.
- Existing branch only: `feat/exam-content-integration`.
- Approved starting remote HEAD:
  `4d4404f1cae8215528bc2b136b19f6677f2e5282`.
- Local branch initially stood at the previous delivery, with a clean tree. It
  was fast-forwarded to that exact reviewed remote checkpoint before operations.
- Final pushed HEAD is the delivery commit containing this report and the bounded
  operator-status note, titled `docs(exam): record verified typography application`.
  Its exact verified hash is recorded in the final handoff after push; it cannot
  be embedded in its own commit content. Resolve the delivery commit with
  `git log -1 --format=%H -- docs/superpowers/reports/2026-10-31-exam-content-7-typography-application.md`.
- Remote main remains `c8b05814924cdc3c741dc75f7bf0d06aeba5b6d0`;
  local main remains `f5d5cbae4e8948a9a0065e0cfd469975f6427c86`.
  Their pre-existing difference was left untouched. No branch creation, merge
  to main, reset, rebase, force push, or rewritten history.

Current authority, the independently reviewed EC7A/EC7B reports, operator contract,
real sidecar, and transactional parser/reconciler/CLI were read before execution.
No architecture or typography decision was changed. Only the existing operator
CLI performed real metadata writes; verification tooling performed read-only
queries and wrote local evidence files outside the repository.

## Protected source and reviewed-map binding

The reviewed `backend/exam-content/olsat-emphasis.json` was not modified, including
between the two applies. Its exact on-disk SHA-256 remained:
`fa85f4241291b209cedc0a05b6961b97971c5aff9031167e5f128e1308680632`.

Each snapshot phase re-ran source-package validation and the real schema-v2 parser,
checking the exact verification metadata, 28 source questions, 38 targets,
59 spans, and style totals 33 BOLD / 8 UNDERLINE / 18 ITALIC. Verification remains
`PROJECT_OWNER_APPROVED_PHYSICAL_SOURCE_MAP` at `2026-10-31T09:39:09Z`.

Manifest SHA-256 remains:
`6fd4a1e7a0e9efe1d68b25d93198168f363a02f71c67ba7e1bc271ae4ffb1ed6`.

Computed protected package fingerprint remains:
`8fa052874c6276e8fefca396d3e9387febf90978cabc8fc43bcb627186af5738`.

The bank contains 72 questions / 360 options / 108 referenced, existing managed
exam-media records. All source numbers 1–72 and import marker identity/count
were complete. Corrected Q24 option J remains exactly
`Paul is younger than Dick and John`. The manifest and all 108 source assets are
unchanged; no bank import, media recreation, or option replacement occurred.

## Before-apply gate and snapshot scope

The narrow read-only snapshot selected only the imported OLSAT bank:

- question IDs, source numbers/import IDs, text, response type/order, stimulus
  type, canonical structured content, stimulus media reference, and two question
  semantic fields;
- option IDs/owning question IDs, labels/orders, exact text, media references,
  correctness, and option semantic metadata;
- OLSAT import marker, including its identity/fingerprint/count/creation time;
- only the 108 referenced media records: IDs, MIME/size/checksum/provider metadata
  and creation times, without private storage keys or image-body dumps.

No unrelated institutional tables or Applicant attempts/answers were dumped.
All 72 questionTextEmphasis, 72 structuredStimulusEmphasis, and 360
optionTextEmphasis values were strictly null before apply. The expected normalized
persistence result was constructed from the reviewed sidecar and resolved stored
source identities; its planned change count was exactly 34 fields.

## Immediate preflight and first real apply

The mandatory preflight ran immediately before the first apply:

```powershell
npm run exam-emphasis:preflight
```

Exact emitted result, exit 0:

```json
{
  "status": "PREFLIGHT_OK",
  "annotationsValidated": 38,
  "fieldsChanged": 0,
  "fieldsWouldChange": 34
}
```

Only after that exact gate passed, the existing command ran once for the first
application:

```powershell
npm run exam-emphasis:apply
```

Exact emitted result, exit 0:

```json
{
  "status": "APPLIED",
  "annotationsValidated": 38,
  "fieldsChanged": 34,
  "fieldsWouldChange": 34
}
```

The reviewed CLI used its existing Serializable Prisma transaction. It resolved
all targets before updates, wrote only changed semantic columns, grouped the six
structuredItem annotations into two question JSON fields, and retained its
existing rollback/disconnect behavior. No manual SQL metadata writes, Prisma
Studio edits, or alternative apply path were used.

## First-apply readback and canonical invariance

Immediate readback matched the expected normalized persistence result for the
entire snapshot, including every null remainder, not just non-null totals:

| Semantic field | Before non-null/null | After first apply non-null/null | After second apply non-null/null |
| --- | ---: | ---: | ---: |
| questionTextEmphasis | 0 / 72 | 27 / 45 | 27 / 45 |
| structuredStimulusEmphasis | 0 / 72 | 2 / 70 | 2 / 70 |
| optionTextEmphasis | 0 / 360 | 5 / 355 | 5 / 355 |

The 34 changes are exactly 27 question fields + 5 option fields + 2 grouped
structured fields. All actual metadata arrays match the reviewed sidecar's exact
normalized ranges/styles. No extra metadata was introduced on omitted targets.

Persisted special cases:

- **Q24:** labels/orders F/0, G/1, H/2, J/3, K/4 have exactly one BOLD `[0,4)`
  span each, resolving respectively to Dick, Paul, Paul, Paul, Dick. QuestionText
  and structured metadata remain null. Corrected option J text is unchanged.
- **Q25:** questionText has only ITALIC `[16,28)` for `most clearly`;
  structured indexes 0/1/2 contain full-word BOLD for peaceful `[0,8)`, serene
  `[0,6)`, tranquil `[0,8)`. Index 3 has no metadata.
- **Q45:** questionText has only ITALIC `[16,28)` for `most clearly`;
  structured indexes 0/1/2 contain full-word BOLD for forward `[0,7)`, sideways
  `[0,8)`, down `[0,4)`. Index 3 has no metadata.
- **Q58:** exactly seven BOLD spans persist at `[22,36)`, `[43,58)`, `[60,69)`,
  `[76,85)`, `[91,100)`, `[107,116)`, `[135,139)`. The last span resolves to
  terminal `cold`; the earlier whole `very cold water` phrase remains a single
  `[43,58)` span, without another independent cold span inside it.
- **Q67:** question, structured, and all option metadata remain null.

Canonical snapshots were compared for exact deep equality after excluding only
questionTextEmphasis, structuredStimulusEmphasis, and optionTextEmphasis. Equality
passed across question/option IDs, all canonical text, type/order, labels/orders,
correctness, structured content, media references, source/import identities,
marker fields, counts, and selected metadata of all 108 managed bank media.

The normalized canonical snapshot SHA-256 was identical in all four phases:
`25f7f0bc6ab455a3413f02e0fc4f48994637e3d5465401b0e1c9fec162e28955`.

This is a narrow bank invariance check, not a broad institutional digest sweep.
The reviewed write path contains no attempt/answer or unrelated institutional
operations; none were issued by the verification tooling.

## Second identical apply and zero-change proof

After first-apply verification passed, a fresh narrow snapshot immediately before
the second apply matched the first readback. The sidecar and source identities
were unchanged. The exact same command then ran once more:

```powershell
npm run exam-emphasis:apply
```

Exact emitted result, exit 0:

```json
{
  "status": "ALREADY_APPLIED",
  "annotationsValidated": 38,
  "fieldsChanged": 0,
  "fieldsWouldChange": 0
}
```

The immediate after-second snapshot matched the before-second snapshot exactly,
including all three semantic fields, canonical content, row identities, selected
media metadata, and import marker. Independent field comparison found zero
second-run changes. The full normalized snapshot hash was identical after first,
before second, and after second:
`8a70d3a81adcd3f86a77efb420917ebe81197e67cb0d698b69596b585df75318`.

The returned zero change plan and reviewed reconciler's empty-change loop prove
no update call on the second run; matching snapshots independently confirm zero
persisted changes. There were exactly two real apply invocations in this package.

Local evidence remains outside Git under
`C:/Users/admin/.codex/visualizations/2026/10/29/01a18826-bd61-7a00-bf49-2364b4121782/`:
`ec7c-before.json`, `ec7c-after-first.json`, `ec7c-before-second.json`, and
`ec7c-after-second.json`. The local snapshot tool has read-only database access
paths and is not retained as application runtime or committed operational machinery.

## Focused verification and delivery boundary

From backend, before the real apply:

```powershell
npm test -- tests/unit/services/exam-emphasis-real-map.test.ts tests/unit/services/exam-emphasis.test.ts tests/unit/cli/exam-emphasis.test.ts
```

Result: **3 files / 53 tests passed, 0 failed/skipped**, exit 0. This reran the
committed real-map integrity test and directly relevant v2 reconciliation/CLI
tests. Synthetic apply/clear tests use mocked persistence. The existing Vite
config-loader advisory was informational. No runtime implementation was changed;
the existing dist CLI corresponds to the unchanged reviewed source. No backend
or frontend rebuild was needed or run.

Only this evidence report and a bounded operational-status update to
`backend/exam-content/EMPHASIS.md` are changed in Git. Diff/staged checks passed.
The reviewed sidecar, manifest/assets, Prisma schema/migrations, importer, and all
runtime/frontend files are unchanged.

No migration, reset, bank re-import, question/option/media recreation, infrastructure
repair/configuration change, unrelated suite, broad institutional dump, deployment,
or manual/browser QA was performed. No timer/autosave/scheduling/scoring/submission,
essay lifecycle, or other Phase B work occurred. Canonical source-of-truth,
checklist, plan, and acceptance status were not updated by this package.

**STOP for independent EC7C review.** Owner Admin/Applicant browser QA and final
physical-source comparison remain deferred. Formal EXAM-CONTENT-7 and Phase A
acceptance remain pending independent application review plus owner browser QA.


## Independent review addendum — 2026-10-31

Independent review of the actual pushed EC7C branch found **no blocking issue**.

Reviewed checkpoint evidence:

- repository diff from the approved EC7C start contains only this report and the
  bounded `backend/exam-content/EMPHASIS.md` status update;
- the reviewed sidecar, manifest/assets, Prisma schema/migrations, importer,
  runtime source and frontend are unchanged;
- immediate preflight produced exactly `PREFLIGHT_OK`,
  `annotationsValidated: 38`, `fieldsChanged: 0`,
  `fieldsWouldChange: 34`;
- first real apply produced exactly `APPLIED`, `fieldsChanged: 34`;
- post-apply counts are exactly 27 questionText, 5 Q24 optionText, and 2
  Q25/Q45 structured metadata fields non-null, with all expected remainders null;
- reported normalized readback matches the reviewed map, including Q24, Q25,
  Q45, Q58 and Q67 special cases;
- canonical bank/media/import-marker comparison reports exact invariance outside
  the three semantic metadata fields;
- the identical second apply produced `ALREADY_APPLIED`,
  `fieldsChanged: 0`, `fieldsWouldChange: 0`;
- second-run before/after evidence reports exact equality;
- focused verification passed 3 files / 53 tests;
- no migration, reset, re-import, deployment, browser QA, or Phase B work occurred.

**EC7C controlled application + real-environment idempotency checkpoint: PASS.**

This addendum does not certify the deferred owner visual comparison. The next and
final EC7 fidelity step is owner manual/browser QA against the actual populated
Admin and Applicant presentation and the physical source. Formal EXAM-CONTENT-7
and Phase A acceptance remain pending that owner source comparison only.
