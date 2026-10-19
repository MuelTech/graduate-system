# CDW-8C — Acceptance / Regression / Multi-user QA

- **Branch:** `refactor/collaborative-defense-workspace`
- **Starting SHA:** `a9a179446284ea928faca8991de34deadc856e1b`
- **Accepted CDW-8 production implementation HEAD:** `a9a179446284ea928faca8991de34deadc856e1b`
- **CDW-8C acceptance/test commit:** `180c492a3e0312384da855e7cedb31fd13b2ae4d`
- **CDW-8C package final HEAD (tests + acceptance documentation):** `f6011c1eaa73706cce0fb950ceea2a64dad80fc7`
- **Date:** 2026-10-17
- **Scope:** prove that the accepted CDW-8 realtime layer accelerates synchronization without weakening the accepted CDW-1 through CDW-7 REST/database workflow.
- **Migration:** NONE. No Prisma schema or migration change.
- **Production code:** NONE changed in CDW-8C. This package adds acceptance tests and this report only.

---

## 1. Acceptance verdict

| Category | Verdict |
|---|---|
| **AUTOMATED** | **PASS** |
| **SOURCE REVIEW** | **PASS** |
| **MANUAL MULTI-USER (browser)** | **NOT EXECUTED — ENVIRONMENT LIMITATION** |
| **SCRIPTED REAL TWO-USER INTEGRATION** | **PASS** (ad hoc, not committed) |

CDW-8 is **ACCEPTED / CLOSED** following automated acceptance, source review, scripted two-user integration evidence, and independent remote-source review. Manual browser multi-user QA remains **user-owned and not executed**; it is not reported as passed and was not treated as a discovered blocker.

---

## 2. What changed in CDW-8C

No application/domain/realtime production file was changed.

| File | Change |
|---|---|
| `backend/tests/unit/realtime/defense-realtime.server.test.ts` | Added identity-spoofing join coverage and duplicate-delivery coverage |
| `backend/tests/unit/realtime/defense-realtime.authorization.test.ts` | Added full CANCELLED event matrix |
| `backend/tests/unit/realtime/defense-realtime.publisher.test.ts` | Added comprehensive privacy allow-list tests and verdict/outcome exclusion |
| `frontend/scripts/verify-cdw8c-acceptance.mjs` | New CDW-8C acceptance verifier (24 tests) |
| `docs/superpowers/cdw-8/cdw-8c-acceptance-report.md` | This report |

No socket academic writes were added. No new realtime event was added. No polling interval changed.

---

## 3. Defects found and corrections

### Acceptance-blocking application defects

**None found.**

### Non-application findings

- The ad hoc two-user integration harness initially wrapped a spoofed join payload incorrectly (`{ scheduleId: { ... } }`), producing a test-harness `NOT_FOUND` instead of exercising the intended identity-spoof case. The harness was corrected to send a raw join payload; the rerun passed. This was not an application defect.
- No production correction was necessary. CDW-8C therefore added tests and documentation only.

---

## 4. Automated verification totals

| Verification | Result |
|---|---|
| Focused backend (CDW-8 realtime + publication + RAP/workspace regression set) | **13 files / 264 tests passed** |
| Full backend suite | **151 files / 1711 passed / 5 skipped / 0 failed** |
| Frontend verification scripts | **12 scripts / 235 tests passed / 0 failed** |
| Backend `npm run build` (`tsc`) | **exit 0** |
| Frontend `npx tsc --noEmit` | **clean** |
| Frontend scoped `npx eslint` | **clean** |
| Frontend `npm run build` (Next.js 16.3.8 / Turbopack) | **success**; all routes built |
| `npx prisma validate` | **valid** |
| `npx prisma generate` | **success** (Prisma Client v7.10.0) |
| `git diff --check` | **clean** |

Only the pre-existing Next.js middleware deprecation warning was emitted during the frontend build; it is unrelated to CDW-8.

---

## 5. Scripted real two-user integration exercise

**Environment:** running dev backend on `http://localhost:5000`, seeded panelist accounts, temporary `DefenseSchedule`/`ThesisDocument` rows, real REST + real Socket.IO clients.

**Data safety:** temporary rows were deleted in a `finally` block. Post-run verification reported `tempSchedules: 0` and `tempDocuments: 0`.

**This exercise was ad hoc and is not committed** because it depends on local seeded accounts and temporary database rows. It is not a CI test.

### Executed results

| Check | Result |
|---|---|
| Missing JWT denied | PASS |
| Invalid JWT denied | PASS |
| Query-string token ignored/denied | PASS |
| Assigned Chairman + Rapporteur joined `defense:<scheduleId>` | PASS |
| Unassigned user denied | PASS |
| Join payload identity spoof (`userId`/`role`) denied | PASS |
| Real `SCHEDULED -> IN_PROGRESS` delivered `defense.started` to both authorized clients | PASS |
| Idempotent already-active start emitted no event | PASS |
| Annotation creation delivered `annotation.created` with persisted ids | PASS |
| Comment creation delivered `annotation.comment.created` with authoritative document id; no comment body | PASS |
| Removed Rapporteur assignment: member evicted before the next delivery | PASS |
| Removed Rapporteur reconnect: `defense:join` denied | PASS |
| CANCELLED schedule join denied | PASS |
| CONCLUDED schedule join denied | PASS |
| `defense:leave` acknowledged | PASS |

### Not covered by the scripted real integration

Report draft, freeze, signature, and formal conclusion realtime delivery were verified at the controller/handler test level, not through a real multi-user browser transport. This is acceptable for CDW-8C automated evidence; browser QA remains user-owned.

---

## 6. Authorization regression

| Case | Evidence | Result |
|---|---|---|
| Missing JWT denied | Socket auth tests + real scripted handshake | PASS |
| Invalid JWT denied | Socket auth tests + real scripted handshake | PASS |
| Expired JWT denied | Socket auth tests | PASS |
| Valid JWT authenticates | Socket auth tests + real scripted handshake | PASS |
| Query-string token ignored | Socket auth tests + real scripted handshake | PASS |
| Client-supplied `userId` ignored | Socket auth + join-handler tests + real scripted spoof | PASS |
| Client-supplied `role` ignored | Socket auth + join-handler tests + real scripted spoof | PASS |
| Exact current `PanelAssignment` required | Authorization tests + real scripted unassigned/spoof | PASS |
| Broad `PANELIST` account role alone insufficient | Join-handler test + real scripted unassigned user | PASS |
| `SCHEDULED` allowed | Authorization + join tests | PASS |
| `IN_PROGRESS` allowed | Authorization + join tests | PASS |
| `AWAITING_CONCLUSION` allowed | Authorization + join tests | PASS |
| `CONCLUDED` join denied | Authorization tests + real scripted join | PASS |
| `CANCELLED` join denied | Authorization tests + real scripted join | PASS |
| Missing schedule denied | Authorization tests | PASS |
| Malformed schedule id denied | Authorization tests | PASS |
| Server derives `defense:<scheduleId>` | Join tests | PASS |
| Client cannot join an arbitrary raw room | Join tests | PASS |
| One tracked room per socket; previous room left | Join tests | PASS |

---

## 7. Replacement / removed committee member

- Pre-delivery stale-member eviction: **PASS** — unit delivery tests and the real scripted two-user exercise both proved the removed Rapporteur received no later event and was evicted before delivery.
- Reconnect-time denial: **PASS** — unit join tests and the real scripted reconnect both returned `FORBIDDEN`.
- No account-role shortcut was used; authorization remained the exact current `PanelAssignment`.

---

## 8. CONCLUDED / CANCELLED boundaries

| Check | Result |
|---|---|
| New join denied for CONCLUDED | PASS |
| Reconnect join denied for CONCLUDED | PASS (same authorization path) |
| Ordinary events dropped for CONCLUDED | PASS — all eight non-conclusion events covered by authorization tests |
| `defense.concluded` delivered immediately after conclusion commit | PASS — delivery-layer test |
| Client invalidates authoritative queries then disconnects | PASS — pure invalidation map + hook source contract |
| Client does not rejoin once REST state becomes CONCLUDED | PASS — active-state gating + disconnect source contract |
| Historical UI does not create/join a socket | PASS — only the workspace page owns the hook; history UI is socket-free |
| CANCELLED join denied | PASS |
| CANCELLED event delivery dropped for all nine events | PASS |
| No historical realtime room | PASS — concluded/cancelled joins denied; history remains REST-only |

---

## 9. Event payload privacy

**Publisher-side:** forced extra fields are stripped by the runtime allow-list. The comprehensive test covers criteria, criterion values, grades, group/overall averages, rating, recommendations, signature data (evaluation and RAP), report body/document, comment/thread body, document bytes, storage path, file URL, outcome, verdict, final remarks, student document, and official snapshot. `defense.concluded` additionally proves the verdict/outcome is absent.

**Frontend parser-side:** the same forced private fields are stripped at the client boundary; only documented envelope and metadata fields survive.

No realtime payload contains evaluator scores, averages, ratings, recommendations, signature evidence, report/comment bodies, document bytes, storage paths, file URLs, or verdicts.

---

## 10. Duplicate / stale / out-of-order safety

| Case | Result |
|---|---|
| Duplicate event causes repeated harmless invalidation only | PASS — pure mapping + delivery tests; no mutation path |
| Duplicate event does not mutate academic data twice | PASS — realtime layer has no academic write path; authorization port is read-only |
| Stale event invalidates; REST refetch returns current DB truth | PASS — invalidate-only architecture; no payload cache writes |
| Stale payload never overwrites newer state | PASS — no `setQueryData` / academic cache writes in the hook |
| `rap.finalized` before/after `rap.signature.recorded` | PASS — both map to the same authoritative report/workspace/readiness invalidations |
| Out-of-order delivery changes final UI state | PASS — final state comes from REST/database, not socket ordering |
| Event log / replay / sequence conflict resolution added | NONE — intentionally not implemented |

---

## 11. Reconnect convergence

| Check | Result |
|---|---|
| Active workspace initially joins | PASS — unit/handler + real scripted join |
| Transport disconnect then reconnect re-authenticates | PASS — Socket.IO reconnect uses handshake auth; hook recreates/rejoins |
| `defense:join` re-runs on every `connect` | PASS — hook source contract |
| Exact `PanelAssignment` rechecked | PASS — join authorization + real scripted reconnect denial |
| Successful join invalidates convergence targets | PASS — `convergenceQueryTargets` exact test |
| Convergence targets | `defenseWorkspace`, exact annotations (when document known), `committeeReport`, `conclusionReadiness`, `oralEvaluation` — PASS |
| REST refetch converges UI | PASS — invalidate/refetch architecture; no replay required |
| Missed-event replay | NOT IMPLEMENTED — by design |

---

## 12. Socket-unavailable fallback

| Check | Result |
|---|---|
| Socket server unavailable / connection error | PASS — hook logs diagnostically, does not throw into the page |
| Join timeout / join denial | PASS — client disconnects, REST/polling continue |
| REST workspace still loads | PASS — page query is independent of socket lifecycle |
| Existing mutations still use REST | PASS — collaboration hooks remain `useMutation` + `apiClientRequest` |
| Socket failure does not force logout | PASS — no `signOut` in the realtime layer; `UNAUTHORIZED` only disconnects |
| Polling remains | PASS — workspace 20s; annotations 15s; Committee Report read-only 20s; conclusion readiness 15s |
| No academic action becomes unusable solely because realtime is down | PASS — realtime is invalidation-only |

---

## 13. Nine-event publication regression

| Event | Post-commit source | Failure/no-op suppression | Payload | Result |
|---|---|---|---|---|
| `defense.started` | Start route after real `SCHEDULED -> IN_PROGRESS` | Idempotent active start, failed/unauthorized start | `scheduleId`, `sessionStatus: IN_PROGRESS` | PASS |
| `annotation.created` | Annotation route after persisted write | Failed persistence/authorization | `scheduleId`, `thesisDocumentId`, `annotationId` | PASS |
| `annotation.comment.created` | Comment route after persisted write | Failed persistence/authorization | `scheduleId`, authoritative `thesisDocumentId`, `annotationId`, `commentId` | PASS |
| `report.draft.updated` | Explicit draft save after persistence | Stale CAS/409, validation failure | `scheduleId`, `reportId`, `bodyVersion` | PASS |
| `evaluation.finalized` | Evaluation finalize after full service completion | Already finalized/rejected/failure | `scheduleId` only | PASS |
| `report.ready_for_signature` | First successful freeze | `alreadyFrozen`, failed readiness | `scheduleId`, `reportId`, `contentVersion` | PASS |
| `rap.signature.recorded` | Canonical and legacy active signing after persistence | Already signed, concluded/cancelled, invalid signer/evidence, CAS failure | `scheduleId`, `reportId`, `contentVersion` | PASS |
| `rap.finalized` | The signature that moves RAP to FINALIZED | Non-final signature, failures | `scheduleId`, `reportId`, `contentVersion` | PASS |
| `defense.concluded` | Formal conclusion after commit (both route aliases) | Duplicate/failed conclusion | `scheduleId`, `sessionStatus: CONCLUDED`; no verdict | PASS |

Atomic highlight + initial comment emits only `annotation.created`; no duplicate comment event. Signature events are ordered `rap.signature.recorded` then `rap.finalized` when the last required signer finalizes.

---

## 14. React Query invalidation regression

| Event | Exact invalidation targets | Result |
|---|---|---|
| `defense.started` | workspace, oralEvaluation | PASS |
| `annotation.created` | exact annotations key for event `thesisDocumentId` | PASS |
| `annotation.comment.created` | exact annotations key for event `thesisDocumentId` | PASS |
| `report.draft.updated` | committeeReport | PASS |
| `evaluation.finalized` | workspace, committeeReport, conclusionReadiness | PASS |
| `report.ready_for_signature` | committeeReport, workspace, conclusionReadiness | PASS |
| `rap.signature.recorded` | committeeReport, workspace, conclusionReadiness | PASS |
| `rap.finalized` | committeeReport, workspace, conclusionReadiness | PASS |
| `defense.concluded` | workspace, committeeReport, conclusionReadiness | PASS |

Wrong `scheduleId` is ignored. Annotation events use the exact event document id. `evaluation.finalized` does not invalidate another evaluator's private evaluation. No `setQueryData` or socket-triggered REST mutation exists.

---

## 15. Single socket owner

- `useDefenseRealtime(...)` is called exactly once, from the Defense Workspace page.
- No socket connection exists in `StudentDocumentCollaboration`, `SharedCommentsRail`, `CommitteeReportPanel`, `OralEvaluationForm`, `RapSignaturePanel`, `ChairmanVerdictPanel`, `RoleRail`, `WorkspaceShell`, or Defense History UI.
- One mounted active workspace owns one socket connection.

**Result: PASS.**

---

## 16. Manual browser multi-user QA matrix

The environment exposes one desktop browser session; it cannot hold two independent authenticated committee identities concurrently (shared origin/session cookies). The following browser scenarios were therefore **NOT EXECUTED** and are not reported as passed. Scripted real integration evidence is listed separately.

| Scenario | Manual browser | Scripted/automated coverage |
|---|---|---|
| A — Pre-defense annotation/comment visibility | **NOT EXECUTED — ENVIRONMENT LIMITATION** | Real two-user scripted join/annotation/comment PASS |
| B — Chairman Start Defense | **NOT EXECUTED — ENVIRONMENT LIMITATION** | Real two-user scripted start + event PASS |
| C — Evaluation finalize/privacy | **NOT EXECUTED — ENVIRONMENT LIMITATION** | Controller/service privacy/finalize tests PASS |
| D — Report authoring / explicit save | **NOT EXECUTED — ENVIRONMENT LIMITATION** | Controller publication + source contracts PASS |
| E — Freeze / signatures | **NOT EXECUTED — ENVIRONMENT LIMITATION** | Freeze/signature controller + service tests PASS |
| F — Formal conclusion | **NOT EXECUTED — ENVIRONMENT LIMITATION** | Conclusion publication + delivery tests PASS |
| G — Socket-unavailable fallback | **NOT EXECUTED — ENVIRONMENT LIMITATION** | Source/fallback contracts + polling verification PASS |
| H — Replacement/removal | **NOT EXECUTED — ENVIRONMENT LIMITATION** | Real two-user scripted eviction + reconnect denial PASS |

Manual browser QA remains user-owned. No scenario is marked PASS without execution.

---

## 17. Remaining limitations

- Browser/manual multi-user QA was not executable in this environment and remains user-owned.
- The real two-user integration exercise is ad hoc, depends on local seeded accounts and temporary database rows, and is not committed as a CI test. It was run successfully and cleaned up (`tempSchedules: 0`, `tempDocuments: 0`).
- Report draft/freeze/signature/conclusion realtime delivery is verified at controller/handler level, not through a real browser transport in this package.
- No Redis adapter, horizontal scaling, presence, typing, cursors, CRDT/Yjs, or event replay exists; the design remains single-instance and invalidation-only.
- The pre-existing Next.js middleware deprecation warning remains unrelated to CDW-8.

---

## 18. Confirmation

- No Prisma schema or migration change.
- No academic workflow/authority change.
- No tenth realtime event.
- No polling removal or interval reduction.
- No private academic data broadcast.
- No historical realtime room.
- No Redis/CRDT/presence/cursor/typing.
- No socket academic write path.
- No CDW-9 work started.

---

## 19. Final recommendation

**CDW-8 ACCEPTED / CLOSED.**

Automated, source-review, scripted real two-user integration evidence, and independent remote-source review found no acceptance-blocking defect. Manual browser multi-user QA remains **NOT EXECUTED** and is explicitly user-owned; it is the only outstanding verification item and is not a discovered blocker.
