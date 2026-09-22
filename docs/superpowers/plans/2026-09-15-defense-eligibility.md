# Defense Eligibility Gates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Only students with validated stage requirements can apply for Title/Proposal/Final Defense, and admin can schedule a defense only when the thesis is APPROVED and those requirements still hold (Title has **no adviser** requirement per client).

**Architecture:** A read-only `DefenseEligibilityRepository` loads requirement data; `DefenseEligibilityService` evaluates a stage matrix and returns `MissingRequirement[]`. `ThesisService.apply*` and `scheduleDefense` call `assert*` before any write. Controllers attach `missing` to 400 responses.

**Tech Stack:** Express 5, Prisma 7, TypeScript, Vitest (backend unit tests), Next.js App Router (admin/student UI), existing `AppError`.

**Spec:** `docs/superpowers/specs/2026-09-15-defense-eligibility-design.md`

## Global Constraints

- Client truth overrides `/references`: **Title Defense application does not require an adviser.**
- Backend pattern: Route → Controller → Service → Repository → Prisma; errors via `AppError`.
- Filenames: backend kebab-case; frontend components kebab-case / pages `page.tsx`.
- Brand CSS: `--earist-primary` `#8B1A1A`, `--earist-secondary` `#A83240`, `--earist-accent` `#D4A843`.
- API errors for eligibility: HTTP 400, body `{ error: string, missing: MissingRequirement[] }`.
- Do not implement STRIKE network calls; gate on existing `PlagiarismResult` rows.
- Do not fix defense-lobby JWT/status bugs in this plan.
- Prefer editing existing files; no drive-by refactors of `thesis.repository.ts` write paths.

---

## File Structure

| Path | Role |
|------|------|
| `backend/src/interfaces/defense-eligibility.interfaces.ts` | Shared eligibility types |
| `backend/src/repositories/defense-eligibility.repository.ts` | Read-only requirement queries |
| `backend/src/services/defense-eligibility.service.ts` | Rules + assert helpers |
| `backend/src/services/defense-eligibility.service.test.ts` | Vitest unit tests |
| `backend/src/services/thesis.service.ts` | Call gates on apply/schedule |
| `backend/src/controllers/thesis.controller.ts` | Return `missing` on 400 |
| `backend/vitest.config.ts` | Test runner config |
| `backend/package.json` | Add `test` script + vitest |
| `backend/prisma/seed.ts` | Pass/fail fixtures |
| `frontend/src/app/(portal)/admin/thesis/applications/page.tsx` | Real missing list |
| `frontend/src/app/(portal)/admin/thesis/scheduling/page.tsx` | Block schedule when ineligible |
| `frontend/src/app/(portal)/student/thesis/title-defense/page.tsx` | No adviser prerequisite copy |
| `frontend/src/types/index.ts` | `MissingRequirement` if needed for UI |

---

### Task 1: Vitest setup + eligibility types

**Files:**
- Create: `backend/src/interfaces/defense-eligibility.interfaces.ts`
- Create: `backend/vitest.config.ts`
- Modify: `backend/package.json`
- Test: `backend/src/services/defense-eligibility.service.test.ts` (scaffold only in this task)

**Interfaces:**
- Consumes: none
- Produces: `DefenseStage`, `MissingRequirementCode`, `MissingRequirement`, `EligibilityResult`, `DefenseTypeStageMap`

- [ ] **Step 1: Add dependency and test script**

```bash
cd backend
npm install -D vitest
```

In `backend/package.json`, set scripts:

```json
"scripts": {
  "build": "tsc",
  "start": "node dist/index.js",
  "dev": "nodemon src/index.ts",
  "test": "vitest run",
  "test:watch": "vitest",
  "prisma:generate": "prisma generate",
  "prisma:migrate": "prisma migrate dev",
  "prisma:studio": "prisma studio"
}
```

(Keep existing script names if `dev` differs; only add `test` / `test:watch`.)

- [ ] **Step 2: Write failing test for types module (compile/import)**

Create `backend/src/services/defense-eligibility.service.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import {
  DEFENSE_TYPE_STAGE,
  type MissingRequirement,
} from "../interfaces/defense-eligibility.interfaces";

describe("defense-eligibility interfaces", () => {
  it("maps defense types to thesis stages", () => {
    expect(DEFENSE_TYPE_STAGE.TITLE_DEFENSE).toBe("TITLE");
    expect(DEFENSE_TYPE_STAGE.PROPOSAL_DEFENSE).toBe("PROPOSAL");
    expect(DEFENSE_TYPE_STAGE.FINAL_DEFENSE).toBe("FINAL");
  });

  it("defines missing requirement shape", () => {
    const item: MissingRequirement = {
      code: "COMP_EXAM_PASSED",
      message: "Comprehensive Exam must be PASSED.",
      stage: "TITLE",
    };
    expect(item.code).toBe("COMP_EXAM_PASSED");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd backend && npm test
```

Expected: FAIL — cannot find `../interfaces/defense-eligibility.interfaces`

- [ ] **Step 4: Create interfaces + vitest config**

Create `backend/src/interfaces/defense-eligibility.interfaces.ts`:

```typescript
export type DefenseStage = "TITLE" | "PROPOSAL" | "FINAL";

export type MissingRequirementCode =
  | "COMP_EXAM_PASSED"
  | "COMP_EXAM_DISMISSED"
  | "STUDENT_NOT_FOUND"
  | "ACTIVE_ADVISER"
  | "NO_ACTIVE_THESIS"
  | "THESIS_STAGE"
  | "THESIS_NOT_APPROVED"
  | "THREE_TITLES"
  | "CONCEPT_PAPER"
  | "PROPOSAL_CHAPTERS"
  | "FINAL_MANUSCRIPT"
  | "COR"
  | "RECEIPT"
  | "ADVISER_CERT"
  | "PRIOR_RAP"
  | "RESEARCH_VARIABLES"
  | "INSTRUMENTS"
  | "STATISTICIAN_CERT"
  | "PLAGIARISM_ELIGIBLE";

export interface MissingRequirement {
  code: MissingRequirementCode;
  message: string;
  stage: DefenseStage;
}

export interface EligibilityResult {
  eligible: boolean;
  missing: MissingRequirement[];
}

export const DEFENSE_TYPE_STAGE = {
  TITLE_DEFENSE: "TITLE",
  PROPOSAL_DEFENSE: "PROPOSAL",
  FINAL_DEFENSE: "FINAL",
} as const;

export type DefenseTypeName = keyof typeof DEFENSE_TYPE_STAGE;
```

Create `backend/vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd backend && npm test
```

Expected: PASS (1 file, 2 tests)

- [ ] **Step 6: Commit**

```bash
git add backend/package.json backend/package-lock.json backend/vitest.config.ts backend/src/interfaces/defense-eligibility.interfaces.ts backend/src/services/defense-eligibility.service.test.ts
git commit -m "test(backend): add vitest and defense eligibility types"
```

---

### Task 2: DefenseEligibilityRepository (reads)

**Files:**
- Create: `backend/src/repositories/defense-eligibility.repository.ts`
- Test: none (covered via service tests with a fake repo)

**Interfaces:**
- Consumes: `prisma` from `../config/database`
- Produces:

```typescript
export interface EligibilitySnapshot {
  studentId: string | null;
  thesisId: string | null;
  thesisStage: "TITLE" | "PROPOSAL" | "FINAL" | null;
  thesisStatus: string | null;
  compExamPassed: boolean;
  compExamDismissed: boolean;
  activeAdviser: boolean;
  selectedOrAnyTitleCount: number;
  conceptPaper: boolean;
  proposalChapters: boolean;
  finalManuscript: boolean;
  cor: boolean;
  receipt: boolean;
  adviserCertIssued: boolean;
  priorRapSigned: boolean;
  researchVariablesApproved: boolean;
  instruments: boolean;
  statisticianCert: boolean;
  plagiarismEligible: boolean;
}

export class DefenseEligibilityRepository {
  async loadForStudent(studentId: string): Promise<EligibilitySnapshot>;
  async loadForThesis(thesisId: string): Promise<EligibilitySnapshot>;
}
```

`loadForThesis` resolves `studentId` from the thesis row. Boolean helpers: any matching `ThesisDocument` row counts as present (per thesisId + docType). `priorRapSigned` is computed by the **service** for a given stage using `rapReports` on the thesis (repository returns prior RAP count by type/status).

Extend snapshot with:

```typescript
  titleRapSigned: boolean;
  proposalRapSigned: boolean;
```

- [ ] **Step 1: Write repository with explicit queries**

Create `backend/src/repositories/defense-eligibility.repository.ts`:

```typescript
import prisma from "../config/database";

export interface EligibilitySnapshot {
  studentId: string | null;
  thesisId: string | null;
  thesisStage: "TITLE" | "PROPOSAL" | "FINAL" | null;
  thesisStatus: string | null;
  compExamPassed: boolean;
  compExamDismissed: boolean;
  activeAdviser: boolean;
  titleCount: number;
  conceptPaper: boolean;
  proposalChapters: boolean;
  finalManuscript: boolean;
  cor: boolean;
  receipt: boolean;
  adviserCertIssued: boolean;
  titleRapSigned: boolean;
  proposalRapSigned: boolean;
  researchVariablesApproved: boolean;
  instruments: boolean;
  statisticianCert: boolean;
  plagiarismEligible: boolean;
}

const DOC = {
  conceptPaper: "PROPOSAL_CHAPTERS",
  proposalChapters: "PROPOSAL_CHAPTERS",
  finalManuscript: "FINAL_MANUSCRIPT",
  cor: "COR",
  receipt: "RECEIPT",
  instruments: "INSTRUMENTS",
} as const;

function hasDoc(
  docs: { docType: string }[],
  docType: string,
): boolean {
  return docs.some((d) => d.docType === docType);
}

export class DefenseEligibilityRepository {
  private async buildSnapshot(studentId: string, thesisId: string | null) {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        compExamRecords: { orderBy: { createdAt: "desc" } },
        adviserAssignments: { where: { isActive: true }, take: 1 },
      },
    });

    const failedStrikes = (student?.compExamRecords ?? []).filter(
      (r) => r.status === "FAILED",
    ).length;
    const compExamPassed = (student?.compExamRecords ?? []).some(
      (r) => r.status === "PASSED",
    );

    let thesis = null as null | {
      id: string;
      stage: "TITLE" | "PROPOSAL" | "FINAL";
      status: string;
      thesisDocuments: { docType: string }[];
      thesisTitles: { id: string }[];
      adviserAssignments?: unknown;
    };

    if (thesisId) {
      thesis = await prisma.thesisRecord.findUnique({
        where: { id: thesisId },
        include: {
          thesisDocuments: { select: { docType: true } },
          thesisTitles: { select: { id: true } },
        },
      });
    }

    const thesisIdForDocs = thesis?.id ?? null;
    const docs = thesis?.thesisDocuments ?? [];

    const adviserCertIssued = thesisIdForDocs
      ? (await prisma.adviserCertification.count({
          where: { thesisId: thesisIdForDocs, status: "ISSUED" },
        })) > 0
      : false;

    const titleRapSigned = thesisIdForDocs
      ? (await prisma.rapReport.count({
          where: {
            thesisId: thesisIdForDocs,
            defenseType: "TITLE_DEFENSE",
            status: { in: ["ALL_SIGNED", "FINALIZED"] },
          },
        })) > 0
      : false;

    const proposalRapSigned = thesisIdForDocs
      ? (await prisma.rapReport.count({
          where: {
            thesisId: thesisIdForDocs,
            defenseType: "PROPOSAL_DEFENSE",
            status: { in: ["ALL_SIGNED", "FINALIZED"] },
          },
        })) > 0
      : false;

    const researchVariablesApproved = thesisIdForDocs
      ? (await prisma.researchVariableForm.count({
          where: {
            thesisId: thesisIdForDocs,
            status: "APPROVED",
            hasAllSignatures: true,
          },
        })) > 0
      : false;

    const statisticianCert = thesisIdForDocs
      ? (await prisma.statisticianCertification.findUnique({
          where: { thesisId: thesisIdForDocs },
        })) !== null
      : false;

    const plagiarismEligible = thesisIdForDocs
      ? (await prisma.plagiarismResult.count({
          where: { thesisId: thesisIdForDocs, isEligible: true },
        })) > 0
      : false;

    return {
      studentId: student?.id ?? studentId,
      thesisId: thesis?.id ?? thesisId,
      thesisStage: thesis?.stage ?? null,
      thesisStatus: thesis?.status ?? null,
      compExamPassed,
      compExamDismissed: failedStrikes >= 2,
      activeAdviser: (student?.adviserAssignments ?? []).length > 0,
      titleCount: thesis?.thesisTitles.length ?? 0,
      conceptPaper: hasDoc(docs, DOC.conceptPaper),
      proposalChapters: hasDoc(docs, DOC.proposalChapters),
      finalManuscript: hasDoc(docs, DOC.finalManuscript),
      cor: hasDoc(docs, DOC.cor),
      receipt: hasDoc(docs, DOC.receipt),
      instruments: hasDoc(docs, DOC.instruments),
      adviserCertIssued,
      titleRapSigned,
      proposalRapSigned,
      researchVariablesApproved,
      statisticianCert,
      plagiarismEligible,
    };
  }

  async loadForStudent(studentId: string) {
    const thesis = await prisma.thesisRecord.findFirst({
      where: { studentId },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    return this.buildSnapshot(studentId, thesis?.id ?? null);
  }

  async loadForThesis(thesisId: string) {
    const thesis = await prisma.thesisRecord.findUnique({
      where: { id: thesisId },
      select: { studentId: true },
    });
    if (!thesis) {
      return this.buildSnapshot("unknown", thesisId);
    }
    return this.buildSnapshot(thesis.studentId, thesisId);
  }
}
```

Note: Title apply uses `loadForStudent` before a thesis exists; then document booleans may be false until files are saved. Apply gates that need uploads use **request files**, not snapshot docs (see Task 4). Snapshot doc booleans are for **schedule** re-validation.

- [ ] **Step 2: Typecheck**

```bash
cd backend && npx tsc --noEmit -p tsconfig.json
```

Expected: PASS (no output)

- [ ] **Step 3: Commit**

```bash
git add backend/src/repositories/defense-eligibility.repository.ts
git commit -m "feat(backend): add read-only defense eligibility repository"
```

---

### Task 3: DefenseEligibilityService + unit tests (TDD)

**Files:**
- Create: `backend/src/services/defense-eligibility.service.ts`
- Modify: `backend/src/services/defense-eligibility.service.test.ts`
- Create: `backend/src/utils/AppError.ts` only if missing (reuse existing `backend/src/utils/AppError.ts` — **do not recreate** if present)

**Interfaces:**
- Consumes: `EligibilitySnapshot` from repository (injected), `EligibilityResult`, `MissingRequirement`
- Produces:

```typescript
export class DefenseEligibilityService {
  evaluateApplyTitle(input: ApplyTitleEligibilityInput): EligibilityResult;
  evaluateApplyProposal(snap: EligibilitySnapshot): EligibilityResult;
  evaluateApplyFinal(snap: EligibilitySnapshot): EligibilityResult;
  evaluateSchedule(
    snap: EligibilitySnapshot,
    defenseType: "TITLE_DEFENSE" | "PROPOSAL_DEFENSE" | "FINAL_DEFENSE",
  ): EligibilityResult;
  assertEligible(result: EligibilityResult): void;
}

export interface ApplyTitleEligibilityInput {
  studentExists: boolean;
  compExamPassed: boolean;
  compExamDismissed: boolean;
  hasActiveThesisBlocking: boolean;
  titleCountFromRequest: number;
  hasConceptPaper: boolean;
  hasCor: boolean;
  hasReceipt: boolean;
}
```

- [ ] **Step 1: Write failing unit tests**

Replace body of `backend/src/services/defense-eligibility.service.test.ts` (keep Task 1 describe or merge):

```typescript
import { describe, expect, it } from "vitest";
import {
  DEFENSE_TYPE_STAGE,
  type EligibilitySnapshot,
  type MissingRequirement,
} from "../interfaces/defense-eligibility.interfaces";
import {
  DefenseEligibilityService,
  type ApplyTitleEligibilityInput,
} from "./defense-eligibility.service";

const baseSnap = (): EligibilitySnapshot => ({
  studentId: "s1",
  thesisId: "t1",
  thesisStage: "TITLE",
  thesisStatus: "PENDING",
  compExamPassed: true,
  compExamDismissed: false,
  activeAdviser: true,
  titleCount: 3,
  conceptPaper: true,
  proposalChapters: true,
  finalManuscript: true,
  cor: true,
  receipt: true,
  adviserCertIssued: true,
  titleRapSigned: true,
  proposalRapSigned: true,
  researchVariablesApproved: true,
  instruments: true,
  statisticianCert: true,
  plagiarismEligible: true,
});

const titleInput = (
  over: Partial<ApplyTitleEligibilityInput> = {},
): ApplyTitleEligibilityInput => ({
  studentExists: true,
  compExamPassed: true,
  compExamDismissed: false,
  hasActiveThesisBlocking: false,
  titleCountFromRequest: 3,
  hasConceptPaper: true,
  hasCor: true,
  hasReceipt: true,
  ...over,
});

const codes = (m: MissingRequirement[]) => m.map((x) => x.code);

describe("evaluateApplyTitle", () => {
  const svc = new DefenseEligibilityService();

  it("allows title apply WITHOUT adviser (client rule)", () => {
    const result = svc.evaluateApplyTitle(titleInput());
    expect(result.eligible).toBe(true);
    expect(result.missing).toHaveLength(0);
  });

  it("requires comprehensive exam PASSED", () => {
    const result = svc.evaluateApplyTitle(
      titleInput({ compExamPassed: false }),
    );
    expect(result.eligible).toBe(false);
    expect(codes(result.missing)).toContain("COMP_EXAM_PASSED");
  });

  it("blocks dismissed students (2 strikes)", () => {
    const result = svc.evaluateApplyTitle(
      titleInput({ compExamDismissed: true }),
    );
    expect(codes(result.missing)).toContain("COMP_EXAM_DISMISSED");
  });

  it("requires three titles and files", () => {
    const result = svc.evaluateApplyTitle(
      titleInput({
        titleCountFromRequest: 2,
        hasConceptPaper: false,
        hasCor: false,
        hasReceipt: false,
      }),
    );
    expect(codes(result.missing)).toEqual(
      expect.arrayContaining([
        "THREE_TITLES",
        "CONCEPT_PAPER",
        "COR",
        "RECEIPT",
      ]),
    );
  });
});

describe("evaluateApplyProposal", () => {
  const svc = new DefenseEligibilityService();

  it("requires title PASSED and proposal matrix", () => {
    const ok = svc.evaluateApplyProposal({
      ...baseSnap(),
      thesisStage: "TITLE",
      thesisStatus: "PASSED",
    });
    expect(ok.eligible).toBe(true);

    const bad = svc.evaluateApplyProposal({
      ...baseSnap(),
      thesisStage: "TITLE",
      thesisStatus: "PENDING",
      adviserCertIssued: false,
      titleRapSigned: false,
      researchVariablesApproved: false,
    });
    expect(bad.eligible).toBe(false);
    expect(codes(bad.missing)).toEqual(
      expect.arrayContaining([
        "THESIS_STAGE",
        "ADVISER_CERT",
        "PRIOR_RAP",
        "RESEARCH_VARIABLES",
      ]),
    );
  });

  it("requires active adviser for proposal", () => {
    const result = svc.evaluateApplyProposal({
      ...baseSnap(),
      thesisStage: "TITLE",
      thesisStatus: "PASSED",
      activeAdviser: false,
    });
    expect(codes(result.missing)).toContain("ACTIVE_ADVISER");
  });
});

describe("evaluateApplyFinal", () => {
  const svc = new DefenseEligibilityService();

  it("requires proposal PASSED, plagiarism, statistician, instruments", () => {
    const ok = svc.evaluateApplyFinal({
      ...baseSnap(),
      thesisStage: "PROPOSAL",
      thesisStatus: "PASSED",
    });
    expect(ok.eligible).toBe(true);

    const bad = svc.evaluateApplyFinal({
      ...baseSnap(),
      thesisStage: "PROPOSAL",
      thesisStatus: "APPROVED",
      plagiarismEligible: false,
      statisticianCert: false,
      instruments: false,
      proposalRapSigned: false,
    });
    expect(codes(bad.missing)).toEqual(
      expect.arrayContaining([
        "THESIS_STAGE",
        "PLAGIARISM_ELIGIBLE",
        "STATISTICIAN_CERT",
        "INSTRUMENTS",
        "PRIOR_RAP",
      ]),
    );
  });
});

describe("evaluateSchedule", () => {
  const svc = new DefenseEligibilityService();

  it("requires APPROVED thesis and matching stage", () => {
    const ok = svc.evaluateSchedule(
      {
        ...baseSnap(),
        thesisStage: "TITLE",
        thesisStatus: "APPROVED",
        adviserCertIssued: false,
        titleRapSigned: false,
        proposalRapSigned: false,
        researchVariablesApproved: false,
        instruments: false,
        statisticianCert: false,
        plagiarismEligible: false,
        activeAdviser: false,
      },
      "TITLE_DEFENSE",
    );
    expect(ok.eligible).toBe(true);

    const notApproved = svc.evaluateSchedule(
      { ...baseSnap(), thesisStatus: "PENDING" },
      "TITLE_DEFENSE",
    );
    expect(codes(notApproved.missing)).toContain("THESIS_NOT_APPROVED");

    const wrongStage = svc.evaluateSchedule(
      { ...baseSnap(), thesisStage: "PROPOSAL", thesisStatus: "APPROVED" },
      "TITLE_DEFENSE",
    );
    expect(codes(wrongStage.missing)).toContain("THESIS_STAGE");
  });

  it("maps defense type to stage via DEFENSE_TYPE_STAGE", () => {
    expect(DEFENSE_TYPE_STAGE.FINAL_DEFENSE).toBe("FINAL");
  });
});

describe("assertEligible", () => {
  const svc = new DefenseEligibilityService();

  it("throws when missing is non-empty", () => {
    expect(() =>
      svc.assertEligible({
        eligible: false,
        missing: [
          {
            code: "COMP_EXAM_PASSED",
            message: "Comprehensive Exam must be PASSED.",
            stage: "TITLE",
          },
        ],
      }),
    ).toThrowError(/requirements not met/i);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && npm test
```

Expected: FAIL — `defense-eligibility.service` not found

- [ ] **Step 3: Implement service**

Create `backend/src/services/defense-eligibility.service.ts`:

```typescript
import {
  DEFENSE_TYPE_STAGE,
  type DefenseStage,
  type EligibilityResult,
  type MissingRequirement,
  type MissingRequirementCode,
  type EligibilitySnapshot,
} from "../interfaces/defense-eligibility.interfaces";
import { AppError } from "../utils/AppError";

export interface ApplyTitleEligibilityInput {
  studentExists: boolean;
  compExamPassed: boolean;
  compExamDismissed: boolean;
  hasActiveThesisBlocking: boolean;
  titleCountFromRequest: number;
  hasConceptPaper: boolean;
  hasCor: boolean;
  hasReceipt: boolean;
}

function miss(
  code: MissingRequirementCode,
  message: string,
  stage: DefenseStage,
): MissingRequirement {
  return { code, message, stage };
}

export class DefenseEligibilityService {
  evaluateApplyTitle(input: ApplyTitleEligibilityInput): EligibilityResult {
    const missing: MissingRequirement[] = [];
    const stage: DefenseStage = "TITLE";

    if (!input.studentExists) {
      missing.push(miss("STUDENT_NOT_FOUND", "Student profile not found.", stage));
    }
    if (input.compExamDismissed) {
      missing.push(
        miss(
          "COMP_EXAM_DISMISSED",
          "Student is dismissed after two Comprehensive Exam failures.",
          stage,
        ),
      );
    }
    if (!input.compExamPassed) {
      missing.push(
        miss(
          "COMP_EXAM_PASSED",
          "Comprehensive Exam must be PASSED before Title Defense application.",
          stage,
        ),
      );
    }
    if (input.hasActiveThesisBlocking) {
      missing.push(
        miss(
          "NO_ACTIVE_THESIS",
          "You already have an active Thesis Record in progress.",
          stage,
        ),
      );
    }
    if (input.titleCountFromRequest < 3) {
      missing.push(
        miss("THREE_TITLES", "Three (3) proposed research titles are required.", stage),
      );
    }
    if (!input.hasConceptPaper) {
      missing.push(miss("CONCEPT_PAPER", "Concept paper is required.", stage));
    }
    if (!input.hasCor) {
      missing.push(miss("COR", "Certificate of Registration (COR) is required.", stage));
    }
    if (!input.hasReceipt) {
      missing.push(
        miss("RECEIPT", "Application receipt / proof of payment is required.", stage),
      );
    }

    // Client: Title proposal has NO adviser requirement.

    return { eligible: missing.length === 0, missing };
  }

  evaluateApplyProposal(snap: EligibilitySnapshot): EligibilityResult {
    const missing: MissingRequirement[] = [];
    const stage: DefenseStage = "PROPOSAL";
    const titlePassed =
      (snap.thesisStage === "TITLE" && snap.thesisStatus === "PASSED") ||
      snap.thesisStage === "PROPOSAL" ||
      snap.thesisStage === "FINAL";

    if (!snap.compExamPassed) {
      missing.push(
        miss(
          "COMP_EXAM_PASSED",
          "Comprehensive Exam must be PASSED before continuing.",
          stage,
        ),
      );
    }
    if (snap.compExamDismissed) {
      missing.push(
        miss("COMP_EXAM_DISMISSED", "Student is dismissed (two exam failures).", stage),
      );
    }
    if (!titlePassed) {
      missing.push(
        miss("THESIS_STAGE", "Title Defense must be PASSED before Proposal application.", stage),
      );
    }
    if (!snap.activeAdviser) {
      missing.push(
        miss("ACTIVE_ADVISER", "An active Thesis Adviser is required for Proposal Defense.", stage),
      );
    }
    if (!snap.adviserCertIssued) {
      missing.push(
        miss("ADVISER_CERT", "Adviser certification must be issued for Proposal Defense.", stage),
      );
    }
    if (!snap.titleRapSigned) {
      missing.push(
        miss("PRIOR_RAP", "Approved (signed) Title Defense RAP Report is required.", stage),
      );
    }
    if (!snap.researchVariablesApproved) {
      missing.push(
        miss(
          "RESEARCH_VARIABLES",
          "Approved research variables (panel-signed) are required.",
          stage,
        ),
      );
    }
    // Document/cor/receipt for the Proposal application itself are supplied
    // on the request; the caller overlays them before assertEligible (Task 4).

    return { eligible: missing.length === 0, missing };
  }

  evaluateApplyFinal(snap: EligibilitySnapshot): EligibilityResult {
    const missing: MissingRequirement[] = [];
    const stage: DefenseStage = "FINAL";
    const proposalPassed =
      (snap.thesisStage === "PROPOSAL" && snap.thesisStatus === "PASSED") ||
      snap.thesisStage === "FINAL";

    if (!snap.compExamPassed) {
      missing.push(
        miss("COMP_EXAM_PASSED", "Comprehensive Exam must be PASSED.", stage),
      );
    }
    if (snap.compExamDismissed) {
      missing.push(
        miss("COMP_EXAM_DISMISSED", "Student is dismissed (two exam failures).", stage),
      );
    }
    if (!proposalPassed) {
      missing.push(
        miss("THESIS_STAGE", "Proposal Defense must be PASSED before Final application.", stage),
      );
    }
    if (!snap.activeAdviser) {
      missing.push(
        miss("ACTIVE_ADVISER", "An active Thesis Adviser is required for Final Defense.", stage),
      );
    }
    if (!snap.adviserCertIssued) {
      missing.push(
        miss("ADVISER_CERT", "Adviser certification must be issued for Final Defense.", stage),
      );
    }
    if (!snap.proposalRapSigned) {
      missing.push(
        miss("PRIOR_RAP", "Approved (signed) Proposal Defense RAP Report is required.", stage),
      );
    }
    if (!snap.instruments) {
      missing.push(miss("INSTRUMENTS", "Research instruments are required.", stage));
    }
    if (!snap.statisticianCert) {
      missing.push(
        miss("STATISTICIAN_CERT", "Statistician certification is required.", stage),
      );
    }
    if (!snap.plagiarismEligible) {
      missing.push(
        miss(
          "PLAGIARISM_ELIGIBLE",
          "STRIKE plagiarism check must be below 20% similarity (eligible).",
          stage,
        ),
      );
    }

    return { eligible: missing.length === 0, missing };
  }

  evaluateSchedule(
    snap: EligibilitySnapshot,
    defenseType: keyof typeof DEFENSE_TYPE_STAGE,
  ): EligibilityResult {
    const stage = DEFENSE_TYPE_STAGE[defenseType] as DefenseStage;
    const missing: MissingRequirement[] = [];

    if (!snap.studentId || snap.studentId === "unknown") {
      missing.push(miss("STUDENT_NOT_FOUND", "Student profile not found.", stage));
    }
    if (snap.thesisStatus !== "APPROVED") {
      missing.push(
        miss(
          "THESIS_NOT_APPROVED",
          "Thesis application must be APPROVED by admin before scheduling.",
          stage,
        ),
      );
    }
    if (snap.thesisStage !== stage) {
      missing.push(
        miss(
          "THESIS_STAGE",
          `Thesis stage must be ${stage} for ${defenseType}.`,
          stage,
        ),
      );
    }
    if (snap.compExamDismissed) {
      missing.push(
        miss("COMP_EXAM_DISMISSED", "Student is dismissed (two exam failures).", stage),
      );
    }
    if (!snap.compExamPassed) {
      missing.push(
        miss("COMP_EXAM_PASSED", "Comprehensive Exam must be PASSED.", stage),
      );
    }
    if (!snap.cor) {
      missing.push(miss("COR", "Certificate of Registration (COR) is required.", stage));
    }
    if (!snap.receipt) {
      missing.push(
        miss("RECEIPT", "Application receipt / proof of payment is required.", stage),
      );
    }

    if (stage === "TITLE") {
      if (snap.titleCount < 3) {
        missing.push(
          miss("THREE_TITLES", "Three (3) proposed research titles are required.", stage),
        );
      }
      if (!snap.conceptPaper) {
        missing.push(miss("CONCEPT_PAPER", "Concept paper is required.", stage));
      }
    }

    if (stage === "PROPOSAL") {
      if (!snap.activeAdviser) {
        missing.push(
          miss("ACTIVE_ADVISER", "An active Thesis Adviser is required.", stage),
        );
      }
      if (!snap.adviserCertIssued) {
        missing.push(miss("ADVISER_CERT", "Adviser certification is required.", stage));
      }
      if (!snap.titleRapSigned) {
        missing.push(miss("PRIOR_RAP", "Signed Title Defense RAP is required.", stage));
      }
      if (!snap.researchVariablesApproved) {
        missing.push(
          miss("RESEARCH_VARIABLES", "Approved research variables are required.", stage),
        );
      }
      if (!snap.proposalChapters) {
        missing.push(
          miss("PROPOSAL_CHAPTERS", "Chapters 1–3 document is required.", stage),
        );
      }
    }

    if (stage === "FINAL") {
      if (!snap.activeAdviser) {
        missing.push(
          miss("ACTIVE_ADVISER", "An active Thesis Adviser is required.", stage),
        );
      }
      if (!snap.adviserCertIssued) {
        missing.push(miss("ADVISER_CERT", "Adviser certification is required.", stage));
      }
      if (!snap.proposalRapSigned) {
        missing.push(
          miss("PRIOR_RAP", "Signed Proposal Defense RAP is required.", stage),
        );
      }
      if (!snap.finalManuscript) {
        missing.push(
          miss("FINAL_MANUSCRIPT", "Final manuscript (Chapters 1–5) is required.", stage),
        );
      }
      if (!snap.instruments) {
        missing.push(miss("INSTRUMENTS", "Research instruments are required.", stage));
      }
      if (!snap.statisticianCert) {
        missing.push(
          miss("STATISTICIAN_CERT", "Statistician certification is required.", stage),
        );
      }
      if (!snap.plagiarismEligible) {
        missing.push(
          miss(
            "PLAGIARISM_ELIGIBLE",
            "STRIKE plagiarism check must be eligible (below 20%).",
            stage,
          ),
        );
      }
    }

    return { eligible: missing.length === 0, missing };
  }

  assertEligible(result: EligibilityResult): void {
    if (!result.eligible) {
      const err = new AppError("Defense requirements not met", 400) as AppError & {
        missing?: MissingRequirement[];
      };
      err.missing = result.missing;
      throw err;
    }
  }
}
```

If `AppError` does not support extra fields, attach `missing` in the controller from `error.missing ?? error.message`. Prefer extending usage as above.

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && npm test
```

Expected: PASS (all eligibility tests)

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/defense-eligibility.service.ts backend/src/services/defense-eligibility.service.test.ts
git commit -m "feat(backend): add defense eligibility service with stage gates"
```

---

### Task 4: Wire apply gates (Title without adviser)

**Files:**
- Modify: `backend/src/services/thesis.service.ts:32-80`
- Modify: `backend/src/controllers/thesis.controller.ts` (error `missing`)

**Interfaces:**
- Consumes: `DefenseEligibilityService`, `DefenseEligibilityRepository`
- Produces: apply endpoints throw `AppError` with `missing` when ineligible

- [ ] **Step 1: Update `thesis.service.ts` apply methods**

Replace `applyTitleDefense` / `applyProposalDefense` / `applyFinalDefense` with:

```typescript
import { DefenseEligibilityRepository } from "../repositories/defense-eligibility.repository";
import {
  DefenseEligibilityService,
  type ApplyTitleEligibilityInput,
} from "./defense-eligibility.service";
import { AppError } from "../utils/AppError";

// inside ThesisService:
private eligibilityRepo = new DefenseEligibilityRepository();
private eligibility = new DefenseEligibilityService();

async applyTitleDefense(
  userId: string,
  data: ApplyTitleDefenseInput,
  conceptPaperPath: string,
  corPath: string,
  receiptPath: string,
) {
  const student = await this.thesisRepo.getStudentByUserId(userId);
  const snap = student
    ? await this.eligibilityRepo.loadForStudent(student.id)
    : null;

  const titles = [data.title1, data.title2, data.title3];
  const existingThesis = student
    ? await this.thesisRepo.getActiveThesis(student.id)
    : null;

  const input: ApplyTitleEligibilityInput = {
    studentExists: !!student,
    compExamPassed: snap?.compExamPassed ?? false,
    compExamDismissed: snap?.compExamDismissed ?? false,
    hasActiveThesisBlocking:
      !!existingThesis && existingThesis.status !== "FAILED",
    titleCountFromRequest: titles.filter((t) => t && t.trim()).length,
    hasConceptPaper: !!conceptPaperPath,
    hasCor: !!corPath,
    hasReceipt: !!receiptPath,
  };

  this.eligibility.assertEligible(this.eligibility.evaluateApplyTitle(input));

  if (!student) throw new AppError("Student profile not found.", 404);
  if (input.hasActiveThesisBlocking) {
    throw new AppError("You already have an active Thesis Record in progress.", 400);
  }

  return this.thesisRepo.createTitleDefense(
    student.id,
    "PENDING_ADVISER", // not used as adviser gate — see note below
    titles,
    conceptPaperPath,
    corPath,
    receiptPath,
  );
}
```

**Schema note:** `ThesisRecord.assignmentId` is required (`AdviserAssignment`). Title apply currently uses an adviser assignment id. Client says title has **no adviser**. Implementation choice for Task 4:

1. Prefer: make `assignmentId` optional in a **follow-up migration** if product agrees title can exist without assignment.
2. Interim (this task): if no active adviser, create the thesis with a **placeholder is invalid** — instead **extend schema**:

```prisma
model ThesisRecord {
  assignmentId String? @map("assignment_id")
  assignment   AdviserAssignment? @relation(fields: [assignmentId], references: [id])
}
```

Migration SQL:

```sql
ALTER TABLE `thesis_records` MODIFY COLUMN `assignment_id` VARCHAR(191) NULL;
```

`createTitleDefense` accepts `assignmentId: string | null` and writes `assignmentId: null` when none.

Add migration folder `backend/prisma/migrations/<timestamp>_make_thesis_assignment_optional/migration.sql`.

- [ ] **Step 2: Update `createTitleDefense` signature**

In `thesis.repository.ts`, change `assignmentId: string` to `assignmentId: string | null` and:

```typescript
const thesis = await tx.thesisRecord.create({
  data: {
    studentId,
    assignmentId,
    stage: "TITLE",
    status: "PENDING",
  },
});
```

Prisma accepts `null` for optional relation.

- [ ] **Step 3: Proposal / Final service gates**

```typescript
async applyProposalDefense(userId: string, filePath: string, corPath: string) {
  const student = await this.thesisRepo.getStudentByUserId(userId);
  if (!student) throw new AppError("Student profile not found.", 404);
  const snap = await this.eligibilityRepo.loadForStudent(student.id);

  const result = this.eligibility.evaluateApplyProposal({
    ...snap,
    proposalChapters: !!filePath,
    cor: !!corPath,
  });
  // Require request files explicitly:
  if (!filePath) {
    result.missing.push({
      code: "PROPOSAL_CHAPTERS",
      message: "Chapters 1–3 document is required.",
      stage: "PROPOSAL",
    });
    result.eligible = false;
  }
  if (!corPath) {
    result.missing.push({
      code: "COR",
      message: "Certificate of Registration (COR) is required.",
      stage: "PROPOSAL",
    });
    result.eligible = false;
  }
  this.eligibility.assertEligible(result);

  const thesis = await this.thesisRepo.getActiveThesis(student.id);
  if (!thesis) {
    throw new AppError("No active Thesis Record found. Please apply for Title Defense first.", 400);
  }
  return this.thesisRepo.updateThesisToProposal(thesis.id, filePath, corPath);
}

async applyFinalDefense(userId: string, filePath: string, corPath: string) {
  const student = await this.thesisRepo.getStudentByUserId(userId);
  if (!student) throw new AppError("Student profile not found.", 404);
  const snap = await this.eligibilityRepo.loadForStudent(student.id);

  const result = this.eligibility.evaluateApplyFinal({
    ...snap,
    finalManuscript: !!filePath,
    cor: !!corPath,
  });
  if (!filePath) {
    result.missing.push({
      code: "FINAL_MANUSCRIPT",
      message: "Final manuscript is required.",
      stage: "FINAL",
    });
    result.eligible = false;
  }
  if (!corPath) {
    result.missing.push({
      code: "COR",
      message: "Certificate of Registration (COR) is required.",
      stage: "FINAL",
    });
    result.eligible = false;
  }
  this.eligibility.assertEligible(result);

  const thesis = await this.thesisRepo.getActiveThesis(student.id);
  if (!thesis) throw new AppError("No active Thesis Record found.", 400);
  return this.thesisRepo.updateThesisToFinal(thesis.id, filePath, corPath);
}
```

Remove old `STRICT VALIDATION` adviser block from Title and old stage-only checks (eligibility covers them).

- [ ] **Step 4: Controller errors include `missing`**

In `thesis.controller.ts` catch blocks for apply/schedule:

```typescript
} catch (error: any) {
  const missing = (error as { missing?: unknown }).missing;
  if (missing) {
    res.status(error.statusCode || 400).json({ error: error.message, missing });
    return;
  }
  res.status(error.statusCode || 400).json({ error: error.message });
}
```

- [ ] **Step 5: Generate client + typecheck + unit tests**

```bash
cd backend && npx prisma generate && npx tsc --noEmit -p tsconfig.json && npm test
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/prisma backend/src/interfaces backend/src/repositories backend/src/services backend/src/controllers
git commit -m "feat(backend): enforce defense eligibility on apply (title has no adviser)"
```

---

### Task 5: Wire `scheduleDefense` hard gate

**Files:**
- Modify: `backend/src/services/thesis.service.ts:96-100`
- Modify: `backend/src/controllers/thesis.controller.ts` (`scheduleDefense`)

**Interfaces:**
- Consumes: `evaluateSchedule`, `assertEligible`, `loadForThesis`
- Produces: `scheduleDefense` only writes when eligible

- [ ] **Step 1: Replace `scheduleDefense` in `thesis.service.ts`**

```typescript
async scheduleDefense(thesisId: string, adminId: string, data: any) {
  const snap = await this.eligibilityRepo.loadForThesis(thesisId);
  const defenseType = String(data.defenseType || "").toUpperCase() as
    | "TITLE_DEFENSE"
    | "PROPOSAL_DEFENSE"
    | "FINAL_DEFENSE";

  if (!["TITLE_DEFENSE", "PROPOSAL_DEFENSE", "FINAL_DEFENSE"].includes(defenseType)) {
    throw new AppError("Invalid defense type.", 400);
  }

  this.eligibility.assertEligible(
    this.eligibility.evaluateSchedule(snap, defenseType),
  );

  return this.thesisRepo.scheduleDefense(thesisId, adminId, data);
}
```

- [ ] **Step 2: Ensure controller uses `missing` (Task 4 pattern) on schedule errors**

- [ ] **Step 3: Typecheck + tests**

```bash
cd backend && npx tsc --noEmit -p tsconfig.json && npm test
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add backend/src/services/thesis.service.ts backend/src/controllers/thesis.controller.ts
git commit -m "feat(backend): block defense scheduling without approved thesis and requirements"
```

---

### Task 6: Seed pass/fail fixtures

**Files:**
- Modify: `backend/prisma/seed.ts` (defense lobby section and/or student section)

**Interfaces:**
- Consumes: existing users (`student@earist.edu.ph`, `student2@earist.edu.ph`)
- Produces: logs of eligible vs blocked scenarios

- [ ] **Step 1: Ensure data matrix for Student 1 (Title-ready)**

Already largely present (comp exam PASSED). Add if missing:

```typescript
// receipt + concept paper on thesis documents for Jane's thesis
// title count >= 3
```

For a **blocked** student (use `student2@earist.edu.ph` if comp exam is FAILED/PENDING — seed already has Student 2 with FAILED strike): do **not** create a Title-ready set.

Add explicit log:

```typescript
console.log("Eligibility fixtures:");
console.log("  student@earist.edu.ph → Title apply should SUCCEED (no adviser required)");
console.log("  student2@earist.edu.ph → Title apply should FAIL (comp exam not PASSED)");
```

- [ ] **Step 2: Run seed**

```bash
cd backend && npx prisma db seed
```

Expected: fixture logs printed; no errors

- [ ] **Step 3: Commit**

```bash
git add backend/prisma/seed.ts
git commit -m "test(backend): seed defense eligibility pass and fail fixtures"
```

---

### Task 7: Admin UI — real missing requirements

**Files:**
- Modify: `frontend/src/app/(portal)/admin/thesis/applications/page.tsx`
- Modify: `frontend/src/app/(portal)/admin/thesis/scheduling/page.tsx`
- Modify: `frontend/src/types/index.ts` (optional `MissingRequirement`)

**Interfaces:**
- Consumes: API `{ error, missing }` and/or eligibility on `GET /thesis/defense/approved`
- Produces: `missing` badge/list; schedule button disabled when POST would fail

- [ ] **Step 1: Add type**

In `frontend/src/types/index.ts`:

```typescript
export interface MissingRequirement {
  code: string;
  message: string;
  stage: string;
}
```

- [ ] **Step 2: Applications page — stop faking `met: true`**

Map documents honestly and show a “Requirements incomplete” alert when approving/scheduling will fail. On approve/schedule error:

```typescript
onError: (error: any) => {
  const missing = error?.missing as MissingRequirement[] | undefined;
  if (missing?.length) {
    alert("Requirements not met:\n" + missing.map((m) => `• ${m.message}`).join("\n"));
  } else {
    alert(error.message || "Action failed");
  }
},
```

(Adjust `apiClientRequest` error shape if it stringifies errors — surface `missing` via thrown object.)

- [ ] **Step 3: Scheduling page — require confirm only when eligible**

Before `scheduleMutation.mutate`, disable the primary button when a local pre-check is false; after API 400, render `missing` under the form:

```tsx
{missingItems.length > 0 && (
  <Alert>
    <AlertDescription>
      <ul>
        {missingItems.map((m) => (
          <li key={m.code}>{m.message}</li>
        ))}
      </ul>
    </AlertDescription>
  </Alert>
)}
```

- [ ] **Step 4: Frontend typecheck**

```bash
cd frontend && npx tsc --noEmit -p tsconfig.json
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/types/index.ts frontend/src/app/\(portal\)/admin/thesis
git commit -m "feat(admin): show real defense requirement gaps before schedule"
```

---

### Task 8: Student Title UI — remove adviser prerequisite copy

**Files:**
- Modify: `frontend/src/app/(portal)/student/thesis/title-defense/page.tsx`
- Modify: `frontend/src/app/(portal)/student/thesis/page.tsx` (checklist copy if it implies adviser-first)

**Interfaces:**
- Consumes: none new
- Produces: Title apply allowed without adviser messaging

- [ ] **Step 1: Update title-defense page**

- Remove any disabled state or help text that says an adviser is required before Title application.
- Keep comp exam gate copy: “You must pass the Comprehensive Exam first.”
- On API error, display `missing` messages from the response if present.

- [ ] **Step 2: Align student thesis hub checklist**

Item “Passed Comprehensive Exam” stays. Do not list “Has Adviser” as a Title prerequisite. Adviser items may appear under a later “Proposal” group labeled “Required for Proposal Defense”.

- [ ] **Step 3: Frontend typecheck**

```bash
cd frontend && npx tsc --noEmit -p tsconfig.json
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/\(portal\)/student/thesis
git commit -m "fix(student): title defense apply does not require adviser"
```

---

### Task 9: End-to-end verification checklist

**Files:** none (manual / API)

- [ ] **Step 1: Backend tests + typecheck**

```bash
cd backend && npm test && npx tsc --noEmit -p tsconfig.json
```

- [ ] **Step 2: API smoke (seeded data)**

```bash
# Login as student@earist.edu.ph → POST /api/thesis/defense/title with 3 titles + conceptPaper + cor + receipt
# Expect 201 (no adviser needed)

# Login as student2@earist.edu.ph → same
# Expect 400 + missing COMP_EXAM_PASSED (or DISMISSED)

# Admin schedules a PENDING thesis
# Expect 400 + missing THESIS_NOT_APPROVED
```

- [ ] **Step 3: Commit verification notes if anything fixed**

```bash
git add -A
git commit -m "test: verify defense eligibility gates against seed fixtures"
```

---

## Self-review notes

- **Client rule covered:** Title has no adviser (`evaluateApplyTitle` never emits `ACTIVE_ADVISER`).
- **Spec matrix:** Tasks 3–5 implement apply + schedule gates; Task 6–8 UI/seed; STRIKE writer not in scope (gate only).
- **Type consistency:** `MissingRequirement`, `EligibilitySnapshot`, `evaluateApply*` / `evaluateSchedule` names match across Tasks 1–5.
- **Open default:** Proposal/Final still require adviser + cert (spec §2); confirm with client before changing.
