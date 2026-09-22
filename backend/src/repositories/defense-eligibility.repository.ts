import prisma from "../config/database";
import type {
  EligibilitySnapshot,
  ResearchVariablesState,
  StageEvidenceFlags,
} from "../interfaces/defense-eligibility.interfaces";

export type { EligibilitySnapshot };

type DocRow = { docType: string; defenseStage: string | null };

/**
 * Stage-scoped evidence (source of truth §16).
 * A file only satisfies the stage it belongs to. Legacy rows with null stage
 * count only for the thesis record's current stage (never silently for later stages).
 */
export function hasStageDoc(
  docs: DocRow[],
  docType: string,
  stage: "TITLE" | "PROPOSAL" | "FINAL",
  currentStage: "TITLE" | "PROPOSAL" | "FINAL" | null,
): boolean {
  return docs.some(
    (d) =>
      d.docType === docType &&
      (d.defenseStage === stage ||
        (d.defenseStage == null && stage === currentStage)),
  );
}

function buildEvidence(
  docs: DocRow[],
  currentStage: "TITLE" | "PROPOSAL" | "FINAL" | null,
): StageEvidenceFlags {
  return {
    titlePackage:
      hasStageDoc(docs, "TITLE_PROPOSAL", "TITLE", currentStage) ||
      hasStageDoc(docs, "PROPOSAL_CHAPTERS", "TITLE", currentStage),
    proposalChapters: hasStageDoc(
      docs,
      "PROPOSAL_CHAPTERS",
      "PROPOSAL",
      currentStage,
    ),
    finalManuscript: hasStageDoc(
      docs,
      "FINAL_MANUSCRIPT",
      "FINAL",
      currentStage,
    ),
    corTitle: hasStageDoc(docs, "COR", "TITLE", currentStage),
    corProposal: hasStageDoc(docs, "COR", "PROPOSAL", currentStage),
    corFinal: hasStageDoc(docs, "COR", "FINAL", currentStage),
    receiptTitle: hasStageDoc(docs, "RECEIPT", "TITLE", currentStage),
    receiptProposal: hasStageDoc(docs, "RECEIPT", "PROPOSAL", currentStage),
    receiptFinal: hasStageDoc(docs, "RECEIPT", "FINAL", currentStage),
    instruments: hasStageDoc(docs, "INSTRUMENTS", "FINAL", currentStage),
  };
}

function mapResearchVariables(rows: {
  status: string;
  hasAllSignatures: boolean | null;
}[]): ResearchVariablesState {
  if (
    rows.some(
      (r) => r.status === "APPROVED_BY_PANEL" && r.hasAllSignatures === true,
    )
  ) {
    return "APPROVED";
  }
  if (rows.some((r) => r.status === "NOT_APPLICABLE")) {
    return "NOT_APPLICABLE";
  }
  if (rows.some((r) => r.status === "APPROVED_BY_PANEL")) {
    return "PENDING"; // approved flag without signatures still pending
  }
  if (rows.length > 0) return "PENDING";
  return "NONE";
}

export class DefenseEligibilityRepository {
  private async buildSnapshot(
    studentId: string,
    thesisId: string | null,
  ): Promise<EligibilitySnapshot> {
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

    let thesis: {
      id: string;
      stage: "TITLE" | "PROPOSAL" | "FINAL";
      status: string;
      outcome: "PASSED" | "REVISION_REQUIRED" | "FAILED" | null;
      thesisDocuments: DocRow[];
      thesisTitles: { id: string; isSelected: boolean }[];
    } | null = null;

    if (thesisId) {
      thesis = await prisma.thesisRecord.findUnique({
        where: { id: thesisId },
        include: {
          thesisDocuments: {
            select: { docType: true, defenseStage: true },
          },
          thesisTitles: { select: { id: true, isSelected: true } },
        },
      });
    }

    const thesisIdForDocs = thesis?.id ?? null;
    const docs = thesis?.thesisDocuments ?? [];
    const currentStage = thesis?.stage ?? null;

    // Adviser certifications are stage-scoped (§16.3): Proposal cert ≠ Final cert.
    const adviserCertProposal = thesisIdForDocs
      ? (await prisma.adviserCertification.count({
          where: {
            thesisId: thesisIdForDocs,
            status: "ISSUED",
            defenseStage: "PROPOSAL_DEFENSE",
          },
        })) > 0
      : false;

    const adviserCertFinal = thesisIdForDocs
      ? (await prisma.adviserCertification.count({
          where: {
            thesisId: thesisIdForDocs,
            status: "ISSUED",
            defenseStage: "FINAL_DEFENSE",
          },
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

    const researchVariableRows = thesisIdForDocs
      ? await prisma.researchVariableForm.findMany({
          where: { thesisId: thesisIdForDocs },
          select: { status: true, hasAllSignatures: true },
        })
      : [];

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
      thesisOutcome: thesis?.outcome ?? null,
      hasSelectedTitle: (thesis?.thesisTitles ?? []).some((t) => t.isSelected),
      compExamPassed,
      compExamDismissed: failedStrikes >= 2,
      activeAdviser: (student?.adviserAssignments ?? []).length > 0,
      titleCount: thesis?.thesisTitles.length ?? 0,
      evidence: buildEvidence(docs, currentStage),
      adviserCerts: { proposal: adviserCertProposal, final: adviserCertFinal },
      titleRapSigned,
      proposalRapSigned,
      researchVariables: mapResearchVariables(researchVariableRows),
      statisticianCert,
      plagiarismEligible,
    };
  }

  async loadForStudent(studentId: string): Promise<EligibilitySnapshot> {
    const thesis = await prisma.thesisRecord.findFirst({
      where: { studentId },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    return this.buildSnapshot(studentId, thesis?.id ?? null);
  }

  async loadForThesis(thesisId: string): Promise<EligibilitySnapshot> {
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
