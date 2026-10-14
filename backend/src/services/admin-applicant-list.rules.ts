/**
 * Admin Applicants LIST read-model rules (pure, no I/O).
 *
 * The Applicants list is the registry of people still inside the Applicant
 * lifecycle. "Admission stage" below is a PRESENTATION/read-model projection
 * only — it is never persisted and never grants domain authority.
 */
import { Prisma } from "@prisma/client";

export type AdmissionStage = "ALIGNMENT" | "EXAM" | "COR";

/** Alignment is complete only for these authoritative values. */
const ALIGNMENT_COMPLETE = ["ALIGNED", "CLEARED"] as const;

/**
 * Fail-closed active Applicant scope. Both authorities must agree; a promoted
 * account (ENROLLED/STUDENT) leaves this registry and belongs in Students.
 */
const ACTIVE_APPLICANT_SCOPE: Prisma.StudentWhereInput = {
  admissionStatus: "APPLICANT",
  user: { role: "APPLICANT" },
};

/**
 * Single source of the stage -> predicate mapping. `deriveAdmissionStage` must
 * stay consistent with these clauses; the filter/derivation invariant test
 * enforces that agreement.
 */
function alignmentCompleteClause(): Prisma.StudentWhereInput {
  return { alignmentStatus: { in: [...ALIGNMENT_COMPLETE] } };
}

function alignmentIncompleteClause(): Prisma.StudentWhereInput {
  return {
    OR: [
      { alignmentStatus: null },
      { alignmentStatus: { notIn: [...ALIGNMENT_COMPLETE] } },
    ],
  };
}

function passedExamClause(): Prisma.StudentWhereInput {
  return { examApplications: { some: { status: "PASSED" } } };
}

function noPassedExamClause(): Prisma.StudentWhereInput {
  return { examApplications: { none: { status: "PASSED" } } };
}

export function alignmentIsComplete(status?: string | null): boolean {
  return (ALIGNMENT_COMPLETE as readonly string[]).includes(String(status ?? ""));
}

/**
 * Canonical passed-exam gate: the authoritative existence of a PASSED
 * Entrance Exam application. Mirrors the meaning used by COR authority.
 */
export function hasAuthoritativePassedExam(
  applications: Array<{ status: string }>,
): boolean {
  return applications.some((application) => application.status === "PASSED");
}

/**
 * Presentation stage derivation.
 *
 * - ALIGNMENT: alignment not cleared (incl. missing/unknown authority).
 * - EXAM: alignment cleared but no authoritative PASSED exam yet.
 * - COR: alignment cleared AND an authoritative PASSED exam exists
 *   (person still an Applicant). Historical PASSED alone is not sufficient.
 */
export function deriveAdmissionStage(input: {
  alignmentStatus?: string | null;
  hasPassedExam: boolean;
}): AdmissionStage {
  if (!alignmentIsComplete(input.alignmentStatus)) return "ALIGNMENT";
  if (!input.hasPassedExam) return "EXAM";
  return "COR";
}

/**
 * Build the list where clause so that row selection and the pagination total
 * always describe the same filtered dataset.
 */
export function buildApplicantListWhere(filters: {
  search?: string;
  programId?: string;
  stage?: string;
}): Prisma.StudentWhereInput {
  const and: Prisma.StudentWhereInput[] = [{ ...ACTIVE_APPLICANT_SCOPE }];

  const search = filters.search?.trim();
  if (search) {
    and.push({
      OR: [
        { user: { firstName: { contains: search } } },
        { user: { lastName: { contains: search } } },
        { user: { email: { contains: search } } },
        { pinnacleApplicantId: { contains: search } },
      ],
    });
  }

  if (filters.programId) {
    and.push({ programId: filters.programId });
  }

  const stage = String(filters.stage ?? "").toUpperCase();
  if (stage === "ALIGNMENT") {
    and.push(alignmentIncompleteClause());
  } else if (stage === "EXAM") {
    and.push(alignmentCompleteClause());
    and.push(noPassedExamClause());
  } else if (stage === "COR") {
    and.push(alignmentCompleteClause());
    and.push(passedExamClause());
  }

  return { AND: and };
}
