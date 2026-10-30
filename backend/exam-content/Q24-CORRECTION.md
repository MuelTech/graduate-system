# Q24 Option J source correction (EC6-CORR1)

Authority: the owner-reviewed 12-page physical-source audit,
`docs/superpowers/reports/2026-10-30-olsat-physical-source-audit.md` (page-004.jpg),
and explicit owner authorization for EC6-CORR1. The sole corrected source text is
Q24 Option J: `Paul is younger than Dick` → `Paul is younger than Dick and John`.
Question text, F/G/H/J/K labels, order, correctness, IDs and media are unchanged.

| Identity | Historical package | Corrected canonical package |
| --- | --- | --- |
| Manifest SHA-256 | `0327342827f9afafeadb65b88f18e9bb4f21b2c513fe6edfdb9104ab16abd3d9` | `6fd4a1e7a0e9efe1d68b25d93198168f363a02f71c67ba7e1bc271ae4ffb1ed6` |
| Exact package fingerprint | `a0126af9597439db7b8536ec2cae6a753cfeece68d3b038f9c1eb6c7dd83f263` | `8fa052874c6276e8fefca396d3e9387febf90978cabc8fc43bcb627186af5738` |

All 108 asset bytes and the existing length-prefixed manifest/sorted-assets
fingerprint algorithm remain unchanged. The hashes above are computed from exact
bytes. The original manifest is reconstructed in memory by reversing only the
authorized string change; its historical SHA and asset-bound fingerprint must
both match. Any unrelated source-byte/asset edit fails this correction command.

## Existing imported environment

After pulling this reviewed package, from `backend`:

```powershell
npm run build
npm run exam-content:preflight
npm run exam-content:q24:preflight
npm run exam-content:q24:apply
npm run exam-content:q24:apply
npm run exam-content:import
```

Default/no arguments and `--dry-run` are read-only. The Q24 CLI accepts only the
fixed package and the existing explicit `--apply` argument contract. No HTTP
endpoint, caller-selected path, generic source-revision framework, or schema
migration was introduced.

Before writing, one Serializable transaction validates the import marker/count
and all 72 source question identities, 360 option identities/labels/orders/text/
correctness, structured payloads and 108 distinct valid imported media references.
It rejects unrelated canonical drift, unexpected Q24 text/labels/order/linkage,
duplicate IDs, incomplete banks, broken media references, unknown fingerprints,
and inconsistent partial-correction states. Q24 J must have null text emphasis;
the command never guesses how to shift source typography marks.

After all validation, guarded exact-ID updates change **only** Q24 J's
`optionText` and the `olsat` import marker's `fingerprint`, in the same transaction.
Both update counts must be 1 or the transaction rolls back. No question/option is
created/deleted; source/option IDs, correctness, media, timestamps, answers, scores,
applications, profiles, and unrelated records are not written.

Expected results:

- Q24 preflight: `PREFLIGHT_OK`, zero writes, `wouldChange: true` for the old bank.
- First Q24 apply: `RECONCILED`, 1 option and 1 import marker changed.
- Identical repeat: `ALREADY_RECONCILED`, zero writes, after full state validation.
- Normal importer afterward: `ALREADY_IMPORTED`, 0 questions / 0 media created.

The normal importer still refuses the old fingerprint for the corrected source;
it does not silently invoke this correction. Run the explicit reviewed operation
instead of deleting/re-importing or manually changing SQL. CLI failures return a
safe error and do not automatically retry or repair partial/inconsistent states.

## Fresh environment and deferred work

A fresh environment imports the corrected canonical manifest normally through
`exam-content:preflight` / `exam-content:import`; it does not need a correction
first. An already corrected fresh bank can also run Q24 apply safely as an
idempotent no-op.

Current emphasis source bindings use the corrected manifest SHA. Historical
reports retain the old SHA as evidence of the package they actually verified.
No real `olsat-emphasis.json` is created or applied here. ITALIC/structured-text
support, the final verified typography map, physical-source/browser verification,
and formal acceptance remain separate. Phase B must not begin automatically.
