import prisma from "../config/database";
import type { EligibilitySnapshot } from "../interfaces/defense-eligibility.interfaces";

export type { EligibilitySnapshot };

function hasDoc(
  docs: { docType: string }[],
  docType: string,
): boolean {
  return docs.some((d) => d.docType === docType);
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
      thesisDocuments: { docType: string }[];
      thesisTitles: { id: string }[];
    } | null = null;

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
            status: "APPROVED_BY_PANEL",
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
      conceptPaper: hasDoc(docs, "PROPOSAL_CHAPTERS"),
      proposalChapters: hasDoc(docs, "PROPOSAL_CHAPTERS"),
      finalManuscript: hasDoc(docs, "FINAL_MANUSCRIPT"),
      cor: hasDoc(docs, "COR"),
      receipt: hasDoc(docs, "RECEIPT"),
      instruments: hasDoc(docs, "INSTRUMENTS"),
      adviserCertIssued,
      titleRapSigned,
      proposalRapSigned,
      researchVariablesApproved,
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
