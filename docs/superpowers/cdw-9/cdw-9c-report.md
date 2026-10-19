# CDW-9C — Security and Audit Hardening

- **System:** EARIST Graduate School Information System (GS-IS)
- **Repository:** MuelTech/graduate-system
- **Branch:** `refactor/collaborative-defense-workspace`
- **Starting HEAD:** `b462562521ac55f9c4a6051801193097d7ae81f8`
- **Implementation commit:** `c530a237eb7ad43da5ed99ddf6684f93ccfeb6e1`
- **Status:** IMPLEMENTED / PENDING INDEPENDENT REVIEW
- **Date:** 2026-10-19
- **Schema change:** NONE
- **Migration:** NONE
- **Frontend change:** NONE
- **Manual browser/security QA:** NOT EXECUTED
- **Hosted CI:** NOT OBSERVED / NOT CLAIMED
- **CDW-9D:** PLANNED / NOT YET IMPLEMENTED — NOT STARTED

---

## 1. Source audit findings

The existing implementation already enforced the core authorization and privacy
boundaries:

- workspace authority derives from the caller's exact `PanelAssignment` for the
  exact schedule, not account role alone;
- live annotation writes bind the exact attempt manuscript, stage, and document
  type;
- historical annotation reads are scoped by both `scheduleId` and the exact
  document, with historical manuscript authority derived from the exact attempt
  binding and a current committee assignment;
- evaluator reads are own-record only; another evaluator's DRAFT criteria,
  averages, recommendations, and signature evidence are not exposed;
- Committee Report signature read models expose status metadata but not raw
  `signatureData`;
- concluded/cancelled collaboration writes, finalized evaluations, frozen report
  bodies, and signed signature evidence are rejected by their owning paths;
- realtime join, pre-delivery assignment revalidation, stale-member eviction,
  concluded/cancelled exclusion, and report-preview sender/recipient
  reauthorization were already implemented with fail-closed behavior.

No concrete authorization, cross-attempt isolation, evaluator-privacy, signature
privacy, document-binding, immutability, or realtime-authorization defect was
found in the audited surface.

## 2. Concrete gap found

The five material defense actions had no persisted production `AuditLog`
coverage:

1. defense session started;
2. evaluator evaluation finalized;
3. Committee Report finalized/frozen for signatures;
4. Committee Report signature recorded;
5. formal defense conclusion/verdict recorded.

The existing `AuditLog` model was sufficient. No schema or migration change was
required, and no second audit system was introduced.

## 3. Fixes made

### Shared audit writer

`backend/src/services/defense-audit.ts`

- reuses the existing `AuditLog` model;
- defines stable explicit action names:
  - `DEFENSE_SESSION_STARTED`
  - `DEFENSE_EVALUATION_FINALIZED`
  - `DEFENSE_REPORT_FINALIZED`
  - `DEFENSE_REPORT_SIGNED`
  - `DEFENSE_VERDICT_RECORDED`
- uses a runtime allow-list for metadata keys;
- stores `ipAddress` as `null` rather than fabricating a request IP;
- stores no `oldValue`; lifecycle change metadata goes into `newValue`;
- derives a fixed, non-sensitive description from the action name;
- excludes sensitive keys even if a caller accidentally supplies them.

### Audit write points

- `DefenseWorkspaceService.startDefense()` writes the audit record in the same
  transaction as the winning `SCHEDULED -> IN_PROGRESS` update.
- `OralEvaluationService.finalize()` writes the audit record in the same
  transaction as the successful DRAFT -> FINALIZED transition.
- `DefenseCollaborationService.freezeReportForSignatures()` writes the audit
  record in the same transaction as the successful freeze and signer-slot
  reconciliation.
- `DefenseCollaborationService.signReportForSignatures()` and the
  legacy-compatible `RapReportService.signRapSlot()` write the audit record in
  the same transaction as the successful own-slot signature update.
- `ThesisRepository.concludeDefense()` writes the audit record in the same
  transaction as the conclusion, thesis mirror update, and session conclusion.

Idempotent/no-op and failed paths return or throw before the audit write, so they
do not create a success audit record.

## 4. Audit payload policy

Allowed audit metadata is limited to:

- `scheduleId`
- `thesisId`
- `defenseType`
- `previousStatus`
- `newStatus`
- `panelAssignmentId`
- `reportId`
- `signatureId`
- `contentVersion`
- `requiredSigners`
- `outcome`

Never persisted in audit metadata, descriptions, or values:

- signature image evidence;
- evaluator criteria, scores, averages, or recommendations;
- report body text or snapshots;
- manuscript text or bytes;
- storage paths or file URLs;
- passwords, tokens, or session credentials;
- final remarks or other free-form academic content.

Audit rows are operational records only. They are not realtime events and do not
drive workflow.

## 5. Preserved boundaries

- Role authority: **NO CHANGE**.
- Signer policy: **NO CHANGE**.
- Chairman verdict authority: **NO CHANGE**.
- FIX-6 parallel Evaluation / Committee Report sequencing: **NO CHANGE**.
- FIX-4 Summary arithmetic: **NO CHANGE**.
- Evaluation CAS/stale-draft protection: **NO CHANGE**.
- Report `bodyVersion` CAS and finalization edit boundary: **NO CHANGE**.
- Signature retry healing and immutable hash/version binding: **NO CHANGE**.
- Realtime persisted-event count: **NO CHANGE**.
- Schema/migration: **NONE**.

## 6. Test evidence

Focused CDW-9C audit tests:

- `backend/tests/unit/services/cdw9c-defense-audit.test.ts` — **1 passed / 0 failed**;
- allow-list excludes sensitive fields and does not fabricate IP data.

Updated material-action suites cover:

- winning start transition writes one audit; idempotent/lost-race/unauthorized
  paths write none;
- successful evaluation finalization writes one audit; unauthorized/duplicate
  finalization writes none;
- successful report freeze writes one audit; non-Rapporteur and idempotent freeze
  write none;
- successful signature writes one audit; non-signer/duplicate signing writes
  none;
- successful conclusion writes one audit; rejected finalization/conclusion paths
  write none;
- metadata action/target/actor correctness and sensitive-field exclusion.

Verification results:

| Check | Result |
|---|---|
| Focused CDW-9C and directly affected suites (13 files) | **343 passed / 0 failed** |
| Full backend suite | **160 files / 1882 passed / 5 skipped / 0 failed** |
| Backend `npm run build` (`tsc`) | **PASS** |
| `git diff --check` | **clean** (line-ending notices only) |
| `git show --check` | **clean** |
| Schema/migration change | **NONE** |
| Frontend change | **NONE** |
| Hosted CI | **NOT OBSERVED / NOT CLAIMED** |
| Manual browser/security QA | **NOT EXECUTED** |

## 7. Limitations

- This package is not a live penetration test or a multi-user browser security
  exercise.
- Audit writes are transactional; an audit persistence failure fails the material
  mutation rather than allowing an unaudited success.
- Audit metadata is intentionally minimal and does not include a trusted request
  IP.
- No audit dashboard or audit retention feature was added.
- No performance, indexing, accessibility, or official-form work was started.
- CDW-9C remains pending independent review and is not marked accepted here.
