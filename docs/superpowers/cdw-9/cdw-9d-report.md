# CDW-9D — Measured Performance and Query Hardening

- **System:** EARIST Graduate School Information System (GS-IS)
- **Repository:** MuelTech/graduate-system
- **Branch:** `refactor/collaborative-defense-workspace`
- **Starting HEAD:** `63adf1879611fbb423c1e3cee39b96febfe2fdf3`
- **Implementation commit:** `801f3524282b71ecf7cb6f9f7e2b725680709064`
- **Status:** IMPLEMENTED / PENDING INDEPENDENT REVIEW
- **Date:** 2026-10-19
- **Schema change:** NONE
- **Migration:** NONE
- **Frontend change:** NONE
- **Targeted CDW-9D Manual QA:** NOT EXECUTED
- **Hosted CI:** NOT OBSERVED / NOT CLAIMED
- **CDW-9E:** PLANNED / NOT YET IMPLEMENTED — NOT STARTED

---

## 1. Environment

- Node.js: `v26.5.0`
- OS: Windows `10.0.26200`
- CPU: 13th Gen Intel Core i5-13490F
- Database: **not used**. The service measurement harness uses deterministic
  mocked Prisma reads; no production or local MySQL latency is claimed.
- File transfer measurement: local filesystem read of a generated fixture.
- Measurement harness:
  `backend/tests/performance/cdw9d-performance.test.ts`
- Warm-up runs preceded measured iterations; medians are reported.

## 2. Representative workload

### Workspace / report read

- 1 defense schedule (`FINAL_DEFENSE`, `IN_PROGRESS`);
- 7 committee assignments (Chairman, 3 Panelists, Rapporteur, Adviser,
  Facilitator);
- 4 evaluator score rows;
- 5 required Committee Report signature rows;
- 5 thesis document versions plus the exact bound manuscript;
- RAP status `FINALIZED`;
- 3 proposed titles and student/program metadata.

### Annotation-heavy document

- 250 annotations;
- 3 comments/replies per annotation = 750 comments;
- multiple synthetic authors;
- exact `scheduleId` + `thesisDocumentId` scoping.

### Large manuscript

- Generated 250-page synthetic PDF;
- 10.26 MiB total after adding a large synthetic payload to model a
  media-rich manuscript;
- generated at runtime and deleted after measurement; no binary fixture is
  committed.

## 3. Baseline measurements

Baseline performed before production changes.

| Path | Cardinality | Queries | Median service time | Payload |
|---|---:|---:|---:|---:|
| Workspace read | 7 assignments, 4 evaluations, 5 docs | **2** | 0.008 ms | 1,696 B |
| Committee Report read | 5 signatures | **2** | 0.011 ms | 1,596 B |
| Live annotation read | 250 annotations / 750 comments | **4** | 1.091 ms | 329,841 B (322.11 KiB) |
| Historical annotation read | 250 annotations / 750 comments | **1** | 1.127 ms | same DTO |
| Local manuscript read | 250 pages / 10.26 MiB | n/a | 2.98–3.11 ms | 10.26 MiB |

Query counts for the annotation path are: exact schedule, exact assignment,
exact document, and one nested annotation/comment/author read.

## 4. Bottleneck found

`DefenseWorkspaceService.getWorkspace()` and
`DefenseCollaborationService.getReportReadModel()` each loaded the exact
schedule roster and then issued a second query for the caller's assignment.

The second query was redundant: the aggregate attempt snapshot already contained
the exact `panelAssignments` used to authorize the caller. This path is polled:

- workspace: every 20 seconds for active sessions;
- Committee Report read-only viewers: every 20 seconds.

At 5 simultaneous active participants, the baseline workspace path was modeled at
15 workspace reads/minute × 2 queries = **30 queries/minute**. Removing the
redundant read reduces that to **15 queries/minute** for the same participants.

## 5. Optimization accepted

`backend/src/services/defense-workspace.service.ts`
`backend/src/services/defense-collaboration.service.ts`

- resolve the caller's assignment from the exact `panelAssignments` already
  loaded with the attempt;
- fail with the same `403` when the caller is not assigned;
- do not add fallback reads, caching, or a specialized loader.

No authorization rule changed: the roster is the same exact-schedule assignment
snapshot, and the caller must still be present in it.

## 6. After measurements

| Path | Cardinality | Queries | Median service time | Payload |
|---|---:|---:|---:|---:|
| Workspace read | same fixture | **1** | 0.007–0.009 ms | 1,696 B |
| Committee Report read | same fixture | **1** | 0.007–0.011 ms | 1,596 B |
| Live annotation read | same fixture | **4** | 0.99–1.15 ms | 322.11 KiB |
| Historical annotation read | same fixture | **1** | 1.09–1.15 ms | same DTO |
| Local manuscript read | same 10.26 MiB fixture | n/a | 2.98–3.11 ms | ~3.3–3.4 GiB/s local read |

The workspace and report query counts fell by **50%** with identical payload
shape and authorization outcome. Service-time differences are within mock/JS
noise and are not presented as production latency improvements.

## 7. Optimizations rejected

No product change was made for:

- **annotation pagination** — 250 annotations / 750 comments serialize to about
  322 KiB and load through one nested read in roughly 1 ms in the harness;
- **annotation lazy loading** — no missing-row or blocking-load evidence;
- **application caching** — no measured cacheable bottleneck;
- **polling interval change** — the 20-second workspace and 15-second annotation
  fallbacks remain accepted;
- **realtime changes** — one workspace socket owner, finite invalidation
  mappings (1–3 query targets per event), and no duplicate subscriber evidence;
- **denormalization** — no measured need;
- **indexes/schema changes** — no trustworthy MySQL query-plan evidence was
  available, and no slow query was demonstrated;
- **manuscript bytes/storage changes** — transfer is dominated by bytes, and the
  secure serving model is unchanged.

## 8. Query-plan evidence

A trustworthy MySQL `EXPLAIN` was **not available** in this environment. The
service harness uses mocked persistence, so no production query plan is claimed.
Evidence is limited to deterministic query counts, row cardinality, DTO size,
and isolated local timing.

No index was added or changed.

## 9. Preserved behavior

- exact-assignment authorization: **NO CHANGE**
- exact-document authorization: **NO CHANGE**
- evaluator DRAFT privacy: **NO CHANGE**
- signature privacy: **NO CHANGE**
- audit coverage: **NO CHANGE**
- concluded/historical immutability: **NO CHANGE**
- report body/version/hash semantics: **NO CHANGE**
- signature retry convergence: **NO CHANGE**
- Summary convergence: **NO CHANGE**
- Chairman verdict authority: **NO CHANGE**
- signer policy: **NO CHANGE**
- FIX-6 parallel Evaluation / Committee Report sequencing: **NO CHANGE**
- realtime persisted-event count and event taxonomy: **NO CHANGE**
- 20-second polling fallback: **NO CHANGE**
- manuscript bytes/storage semantics: **NO CHANGE**
- schema/migration: **NONE**

## 10. Verification

| Check | Result |
|---|---|
| CDW-9D performance harness | **6 passed / 0 failed** |
| Directly affected service suites | **135 passed / 0 failed** |
| Full backend suite | **161 files / 1888 passed / 5 skipped / 0 failed** |
| Backend build (`tsc`) | **PASS** |
| `git diff --check` | **clean** (line-ending notices only) |
| `git show --check` | **clean** |
| Frontend tests/build | Not run — frontend unchanged |
| Hosted CI | **NOT OBSERVED / NOT CLAIMED** |
| Targeted CDW-9D Manual QA | **NOT EXECUTED** |

## 11. Known limitations

- Timings are service-harness measurements with mocked Prisma/DB I/O; they do
  not represent production database or network latency.
- No real MySQL query plan or production dataset was available.
- The large-manuscript fixture models transfer size and page count but not
  browser PDF parsing/rendering.
- No browser/multi-user performance QA was executed.
- CDW-9D remains pending independent review and is not marked accepted here.
