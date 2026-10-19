# Engineering Verification Policy

**Project:** EARIST Graduate School Information System (GS-IS)  
**Status:** CANONICAL CROSS-CUTTING ENGINEERING / CODING-AGENT GUARDRAIL  
**Applies to:** bounded feature/fix/refactor/documentation packages across the repository  
**Date:** 2026-10-19

---

## 1. Purpose

Verification must provide meaningful confidence without turning every bounded task into a repository-wide test cycle.

The project uses a package-based implementation/review workflow. The amount of verification for a package must therefore be proportional to:

- what changed;
- how widely the changed code is shared;
- the failure impact;
- the number of domains/modules affected;
- whether the package changes security, authorization, persistence, schema, migrations, or shared infrastructure;
- whether the package is a local refinement or a final acceptance/release gate.

**Core rule:** use the smallest verification set that proves the changed behavior and its directly affected regressions, then broaden only when risk justifies it.

This policy is about reducing redundant execution, not reducing correctness.

---

## 2. Evidence classes are separate

Do not collapse different forms of evidence into one claim.

- **Focused automated tests/verifiers:** prove targeted behavior.
- **Broader/full regression suites:** provide wider regression confidence.
- **Typecheck/lint/build:** prove compilation/static/build integrity; they are not behavior tests.
- **Manual/browser QA:** proves real interaction only when actually executed.
- **Hosted CI:** proves the checks actually run by the hosted CI provider.
- **Independent remote source review:** verifies the actual pushed commit/diff instead of trusting the coding-agent report.

Agent-local tests/builds are not GitHub Actions/hosted CI evidence.

Manual QA is not passed merely because source tests are green.

---

## 3. Default verification by change type

### 3.1 Documentation-only

Default:

- inspect the exact diff;
- validate links/headings/references where relevant;
- `git diff --check`.

Do not run frontend/backend builds or full tests merely because a Markdown file changed.

### 3.2 Isolated UI copy / microcopy / label refinement

Default:

- focused verifier/test for the affected surface when one exists;
- TypeScript when the changed file is typed application source;
- scoped lint on changed source files;
- `git diff --check`;
- targeted manual visual review when appropriate.

A full frontend verifier sweep or production build is not required by default for a bounded text-only change.

### 3.3 Bounded frontend behavior/component change

Default:

- focused tests/verifiers for the changed behavior;
- directly affected regression verifiers;
- TypeScript;
- scoped lint;
- `git diff --check`.

Add a production build when the change affects component/API/type wiring, routing/build behavior, framework boundaries, or when build-level confidence is materially useful.

### 3.4 Bounded backend business-rule/service change

Default:

- focused unit/integration tests for the changed rule;
- directly affected regression tests;
- backend type/build validation when affected;
- `git diff --check`.

Do not automatically run every backend test file when the changed rule is isolated and focused regressions establish its boundaries.

### 3.5 Shared infrastructure / authorization / security / schema / migration

Use broader verification because blast radius is higher.

Examples:

- authentication/session changes;
- shared request/response infrastructure;
- storage/security boundary;
- permissions used by many modules;
- Prisma schema/migration changes;
- common framework/runtime configuration;
- shared realtime transport;
- deployment/runtime configuration.

Typical evidence may include:

- focused tests;
- broader or full related suites;
- production builds;
- schema validation/generation/migration checks;
- security/negative regressions;
- deployment/runtime checks where applicable.

### 3.6 Final acceptance / release / deployment milestone

A final gate may intentionally require broad/full suites even if the last code change was small, because the purpose of the gate is system-level confidence.

This must be explicit in the package/gate definition.

---

## 4. When a full suite is justified

Run full or near-full regression when at least one is true:

- the change affects a shared primitive used across many unrelated modules;
- the change crosses multiple domains with meaningful coupling;
- authorization/security behavior has broad reach;
- schema/migration behavior changed;
- framework/runtime/build infrastructure changed;
- focused regressions reveal uncertainty or unexpected failures;
- a release/deployment/final-acceptance gate explicitly requires broad confidence.

If none applies, focused + directly affected verification is normally sufficient.

When a coding agent chooses a full suite for a bounded package, the final report should state the concrete reason.

---

## 5. Avoid redundant expensive commands

Do not rerun an identical expensive command merely because it appears in a generic checklist.

Examples:

- do not run `npm run build` twice without a reason;
- do not run every frontend verifier after a text-only copy change unless the surface is shared broadly;
- do not run the entire backend suite after a frontend-only isolated change;
- do not run Prisma validation/generation when Prisma is not affected;
- do not run schema migration commands for packages with no schema change.

A failed focused test can justify broader investigation. A passing focused test does not automatically require a full suite afterward.

---

## 6. Test the risk that changed

For bug fixes, regression coverage should reproduce the failure mode and prove the corrected ordering/authority/invariant.

Examples:

- stale draft finalization bug -> test dirty/in-flight save ordering before irreversible finalization;
- authorization bug -> test authorized and unauthorized actors at the exact boundary;
- UI wording bug -> test exact approved wording and absence of leaked internal terminology;
- concurrency bug -> test competing operations and idempotency.

The strongest first test is usually the one that would have failed before the fix.

---

## 7. Static/build checks are not substitutes for behavior tests

TypeScript, lint, and production builds are valuable but answer different questions.

- TypeScript: are the types consistent?
- Lint: does code satisfy configured static rules?
- Build: can the application compile/package?
- Behavior tests: does the intended domain/product behavior work?

Choose each because it covers a real risk, not because every package must accumulate every category.

---

## 8. Manual QA policy

Manual/browser QA is especially useful for:

- interaction sequencing;
- responsive layout;
- visual hierarchy;
- modal/focus behavior;
- real multi-role workflows;
- realtime synchronization;
- browser/runtime/environment-specific issues.

Coding agents must report manual/browser QA as **NOT EXECUTED** when they did not actually perform it.

Source review and automated tests must never be rewritten as manual acceptance.

---

## 9. Coding-agent prompt rule

Future coding-agent prompts should state the required verification depth explicitly.

Preferred prompt language:

> Run focused tests/verifiers for the changed behavior and directly affected regressions. Do not run the entire frontend/backend suite by default. Broaden verification only when this change touches shared infrastructure, security/auth/schema/runtime boundaries, focused failures create uncertainty, or the package is an explicit final acceptance/release gate. If you broaden to a full suite, state why.

For a high-risk/final gate, say so explicitly and name the required broad/full checks.

Do not use vague boilerplate such as "run everything" for every package.

---

## 10. Final report requirements

An implementation report should distinguish:

- focused tests/verifiers and exact results;
- broader/full suites, if run, and why;
- typecheck/lint/build results;
- schema/migration status;
- manual/browser QA status;
- hosted CI status;
- final git/worktree/push state.

Do not inflate confidence by listing commands unrelated to the changed risk.

---

## 11. Independent review remains mandatory

Risk-based testing does not replace independent source review.

The reviewer must still verify:

- actual remote HEAD;
- exact base/head relationship;
- actual changed files/diff;
- domain/security boundaries;
- whether the implementation matches canonical docs;
- whether the verification evidence is appropriate for the change.

If review finds a concrete correctness gap, fix the same package before advancing.

---

## 12. Summary matrix

| Change | Default verification |
|---|---|
| Docs only | diff/reference review + `git diff --check` |
| Isolated copy/UI wording | focused verifier + typecheck if applicable + scoped lint + diff check |
| Bounded frontend behavior | focused + directly affected regressions + typecheck + scoped lint; build when justified |
| Bounded backend rule | focused + directly affected backend regressions + build/typecheck when affected |
| Shared/auth/security/schema/runtime | broader suites + relevant build/schema/security checks |
| Final acceptance/release/deploy | explicit broad/full regression appropriate to the gate |

**Default is focused. Broad verification is deliberate, not automatic.**
