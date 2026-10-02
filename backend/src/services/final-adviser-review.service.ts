/**
 * CP4 — Final Adviser review and Final Adviser Certification workflow.
 *
 * Same authoritative pattern as Proposal (CP3/CP3-FIX*):
 * - exact reviewedDocumentId binding
 * - expectedReviewedDocumentId optimistic concurrency
 * - atomic AWAITING_REVIEW transitions
 * - ISSUED write-once
 * - active AdviserAssignment authorization
 */
import { fileTypeFromFile } from "file-type";
import fs from "fs/promises";
import prisma from "../config/database";
import { AppError } from "../utils/AppError";
import {
  evaluateActiveAdviserGate,
  evaluateCertifyGate,
  evaluateRequestChangesGate,
  isAllowedProposalManuscriptMime,
  mapCertStatusToReviewStatus,
  FINAL_MANUSCRIPT_DOC_STAGE,
  FINAL_MANUSCRIPT_DOC_TYPE,
  FINAL_REVIEW_STAGE,
  type ProposalReviewStatus,
} from "./proposal-adviser-review.rules";
import { isProposalStageComplete } from "./stage-completion";
import { getFinalOptionalGates, resolveStrikePolicy } from "./strike-policy";

const MANUSCRIPT_DOC_TYPE = FINAL_MANUSCRIPT_DOC_TYPE;
const DOC_STAGE = FINAL_MANUSCRIPT_DOC_STAGE;

export interface FinalAdviserReviewDto {
  thesisId: string | null;
  student: { id: string; name: string; studentNumber: string | null } | null;
  officialTitle: string | null;
  activeAdviser: { userId: string; name: string } | null;
  reviewStatus: ProposalReviewStatus;
  reviewRemarks: string | null;
  manuscript: { documentId: string; uploadedAt: string | null } | null;
  certification: {
    issued: boolean;
    adviserName: string | null;
    signedAt: string | null;
    defenseStage: string;
  } | null;
  isAuthorizedAdviser: boolean;
  strikeRequired: boolean;
  strikeEligible: boolean;
  proposalStageComplete: boolean;
  /** Non-null when Adviser Request Changes / Certify are blocked. */
  actionBlockedReason?: string | null;
}

export interface FinalReviewQueueItem {
  thesisId: string;
  student: { id: string; name: string; studentNumber: string | null };
  officialTitle: string | null;
  reviewStatus: ProposalReviewStatus;
  reviewRemarks: string | null;
  manuscriptDocumentId: string | null;
  manuscriptUploadedAt: string | null;
  stage: "FINAL";
}

async function safeUnlink(filePath: string | null | undefined) {
  if (!filePath) return;
  try {
    await fs.unlink(filePath);
  } catch {
    // best-effort
  }
}

export class FinalAdviserReviewService {
  private async findThesisForStudent(userId: string) {
    const student = await prisma.student.findUnique({
      where: { userId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!student) throw new AppError("Student profile not found.", 404);
    const thesis = await prisma.thesisRecord.findFirst({
      where: { studentId: student.id },
      orderBy: { createdAt: "desc" },
    });
    return { student, thesis };
  }

  private async isActiveAdviserForStudent(
    adviserUserId: string,
    studentId: string,
  ): Promise<boolean> {
    const assignment = await prisma.adviserAssignment.findFirst({
      where: { studentId, adviserId: adviserUserId, isActive: true },
    });
    return Boolean(assignment);
  }

  private async loadReviewContext(thesisId: string) {
    const thesis = await prisma.thesisRecord.findUnique({
      where: { id: thesisId },
      include: {
        student: {
          select: {
            id: true,
            studentNumber: true,
            user: { select: { id: true, firstName: true, lastName: true } },
            adviserAssignments: {
              where: { isActive: true },
              include: {
                adviser: {
                  select: { id: true, firstName: true, lastName: true },
                },
              },
              take: 1,
            },
          },
        },
        defenseSchedules: {
          where: {
            defenseType: { in: ["TITLE_DEFENSE", "PROPOSAL_DEFENSE"] },
          },
          include: {
            conclusion: {
              where: { outcome: "PASSED" },
              include: {
                selectedTitle: { select: { titleText: true } },
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
        thesisDocuments: {
          where: { docType: MANUSCRIPT_DOC_TYPE, defenseStage: DOC_STAGE },
          orderBy: { uploadedAt: "desc" },
          take: 5,
        },
        adviserCertifications: {
          where: { defenseStage: FINAL_REVIEW_STAGE },
          orderBy: { updatedAt: "desc" },
          include: {
            adviser: { select: { id: true, firstName: true, lastName: true } },
            reviewedDocument: true,
          },
        },
        plagiarismResults: {
          orderBy: { submittedAt: "desc" },
          take: 5,
        },
      },
    });
    if (!thesis) throw new AppError("Thesis Record not found.", 404);
    return thesis;
  }

  /**
   * CP4-FIX1: re-check Proposal completion + centralized STRIKE before
   * Adviser mutations (not only at Student upload).
   */
  private async assertFinalReviewPrerequisites(thesisId: string): Promise<void> {
    const proposalComplete = await this.proposalStageCompleteFor(thesisId);
    if (!proposalComplete) {
      throw new AppError(
        "Proposal Defense must be formally PASSED with a finalized Proposal RAP before Final Adviser review actions.",
        400,
      );
    }
    const gates = getFinalOptionalGates();
    if (gates.requireStrike) {
      const eligible = await prisma.plagiarismResult.count({
        where: { thesisId, isEligible: true },
      });
      if (eligible === 0) {
        throw new AppError(
          "Required STRIKE / plagiarism clearance is still pending.",
          400,
        );
      }
    }
  }

  private async proposalStageCompleteFor(thesisId: string): Promise<boolean> {
    const titleConclusion = await prisma.defenseConclusion.findFirst({
      where: {
        thesisId,
        outcome: "PASSED",
        schedule: { defenseType: "TITLE_DEFENSE" },
      },
      orderBy: { concludedAt: "desc" },
      select: { selectedTitleId: true, scheduleId: true },
    });
    const proposalConclusion = await prisma.defenseConclusion.findFirst({
      where: {
        thesisId,
        schedule: { defenseType: "PROPOSAL_DEFENSE" },
      },
      orderBy: { concludedAt: "desc" },
      select: { outcome: true, scheduleId: true },
    });
    const proposalRapFinalized = proposalConclusion?.scheduleId
      ? (await prisma.rapReport.count({
          where: {
            scheduleId: proposalConclusion.scheduleId,
            defenseType: "PROPOSAL_DEFENSE",
            status: "FINALIZED",
          },
        })) > 0
      : false;
    return isProposalStageComplete({
      outcome:
        proposalConclusion?.outcome === "PASSED"
          ? "PASSED"
          : proposalConclusion?.outcome === "REVISION_REQUIRED"
            ? "REVISION_REQUIRED"
            : proposalConclusion?.outcome === "FAILED"
              ? "FAILED"
              : null,
      proposalRapFinalized,
    });
  }

  private toDto(
    thesis: Awaited<ReturnType<FinalAdviserReviewService["loadReviewContext"]>>,
    authenticatedUserId: string,
  ): FinalAdviserReviewDto {
    const assignment = thesis.student.adviserAssignments[0] ?? null;
    const cert =
      thesis.adviserCertifications.find((c) => c.status === "ISSUED") ??
      thesis.adviserCertifications[0] ??
      null;
    const boundDocId = cert?.reviewedDocumentId ?? null;
    const manuscript = boundDocId
      ? (thesis.thesisDocuments.find((d) => d.id === boundDocId) ??
        cert?.reviewedDocument ??
        null)
      : (thesis.thesisDocuments[0] ?? null);
    const reviewStatus = cert ? mapCertStatusToReviewStatus(cert.status) : "NONE";
    const titleSchedule = thesis.defenseSchedules.find(
      (s) => s.defenseType === "TITLE_DEFENSE",
    );
    const officialTitle =
      titleSchedule?.conclusion?.selectedTitle?.titleText ?? null;
    const strikePolicy = getFinalOptionalGates();
    const strikeRequired = strikePolicy.requireStrike;
    const strikeEligible = thesis.plagiarismResults.some((p) => p.isEligible);

    return {
      thesisId: thesis.id,
      student: {
        id: thesis.student.id,
        name: `${thesis.student.user.firstName} ${thesis.student.user.lastName}`,
        studentNumber: thesis.student.studentNumber,
      },
      officialTitle,
      activeAdviser: assignment
        ? {
            userId: assignment.adviser.id,
            name: `${assignment.adviser.firstName} ${assignment.adviser.lastName}`,
          }
        : null,
      reviewStatus: manuscript || cert ? reviewStatus : "NONE",
      reviewRemarks: cert?.reviewRemarks ?? null,
      manuscript: manuscript
        ? {
            documentId: manuscript.id,
            uploadedAt: manuscript.uploadedAt.toISOString(),
          }
        : null,
      certification:
        cert?.status === "ISSUED"
          ? {
              issued: true,
              adviserName: `${cert.adviser.firstName} ${cert.adviser.lastName}`,
              signedAt: cert.signedAt ? cert.signedAt.toISOString() : null,
              defenseStage: cert.defenseStage,
            }
          : null,
      isAuthorizedAdviser: assignment?.adviser.id === authenticatedUserId,
      strikeRequired,
      strikeEligible,
      proposalStageComplete: true, // refined in getStudentReviewState
      actionBlockedReason: strikeRequired && !strikeEligible
        ? "Required STRIKE / plagiarism clearance is still pending."
        : null,
    };
  }

  async getStudentReviewState(userId: string): Promise<FinalAdviserReviewDto> {
    const { student, thesis } = await this.findThesisForStudent(userId);
    const proposalComplete = thesis
      ? await this.proposalStageCompleteFor(thesis.id)
      : false;
    const strikePolicy = getFinalOptionalGates();
    const strikeRequired = strikePolicy.requireStrike;

    if (!thesis) {
      return {
        thesisId: null,
        student: {
          id: student.id,
          name: `${student.user.firstName} ${student.user.lastName}`,
          studentNumber: student.studentNumber,
        },
        officialTitle: null,
        activeAdviser: null,
        reviewStatus: "NONE",
        reviewRemarks: null,
        manuscript: null,
        certification: null,
        isAuthorizedAdviser: false,
        strikeRequired,
        strikeEligible: false,
        proposalStageComplete: false,
      };
    }
    const full = await this.loadReviewContext(thesis.id);
    const dto = this.toDto(full, userId);
    const strikeEligible = full.plagiarismResults.some((p) => p.isEligible);
    return {
      ...dto,
      strikeRequired,
      strikeEligible,
      proposalStageComplete: proposalComplete,
      actionBlockedReason: !proposalComplete
        ? "Proposal Defense must be formally PASSED with a finalized Proposal RAP before Final Adviser review actions."
        : strikeRequired && !strikeEligible
          ? "Required STRIKE / plagiarism clearance is still pending."
          : null,
    };
  }

  /**
   * Student uploads/resubmits Final manuscript for Adviser review.
   * Does NOT submit the Final defense application to Admin.
   *
   * DL-2 FIX1: returns immediately after the authoritative transaction
   * commits (see ProposalAdviserReviewService for the invariant rationale).
   */
  async submitManuscriptForReview(
    userId: string,
    file: Express.Multer.File,
  ): Promise<void> {
    const { student, thesis } = await this.findThesisForStudent(userId);
    if (!thesis) {
      await safeUnlink(file?.path);
      throw new AppError(
        "No active Thesis Record found. Complete Title Defense first.",
        400,
      );
    }

    const assignment = await prisma.adviserAssignment.findFirst({
      where: { studentId: student.id, isActive: true },
    });

    const proposalComplete = await this.proposalStageCompleteFor(thesis.id);
    const strikePolicy = getFinalOptionalGates();
    const strikeRequired = strikePolicy.requireStrike;
    const strikeEligible = thesis
      ? (await prisma.plagiarismResult.count({
          where: { thesisId: thesis.id, isEligible: true },
        })) > 0
      : false;

    if (!assignment) {
      await safeUnlink(file?.path);
      throw new AppError(
        "An active Thesis Adviser is required before submitting the Final manuscript for review.",
        400,
      );
    }
    if (!proposalComplete) {
      await safeUnlink(file?.path);
      throw new AppError(
        "Proposal Defense must be formally PASSED with a finalized Proposal RAP before Final manuscript review.",
        400,
      );
    }
    if (strikeRequired && !strikeEligible) {
      await safeUnlink(file?.path);
      throw new AppError(
        "Required STRIKE / plagiarism clearance is still pending.",
        400,
      );
    }
    if (!file?.path) {
      await safeUnlink(file?.path);
      throw new AppError("Final manuscript is required.", 400);
    }

    const detected = await fileTypeFromFile(file.path);
    const mime = detected?.mime ?? null;
    const ext = file.originalname?.toLowerCase()?.split(".").pop() ?? "";
    const extOk = ["pdf", "doc", "docx"].includes(ext);
    if (!isAllowedProposalManuscriptMime(mime) && !(extOk && !mime)) {
      await safeUnlink(file.path);
      throw new AppError(
        "Invalid Final manuscript file type. Allowed: PDF, DOC, DOCX.",
        400,
      );
    }

    const existingIssued = await prisma.adviserCertification.findFirst({
      where: {
        thesisId: thesis.id,
        defenseStage: FINAL_REVIEW_STAGE,
        status: "ISSUED",
      },
    });
    if (existingIssued) {
      await safeUnlink(file.path);
      throw new AppError(
        "Final Adviser Certification is already issued. Contact the Graduate School if a new review is required.",
        409,
      );
    }

    const adviserId = assignment.adviserId;
    try {
      await prisma.$transaction(async (tx) => {
        const issuedInTx = await tx.adviserCertification.findFirst({
          where: {
            thesisId: thesis.id,
            defenseStage: FINAL_REVIEW_STAGE,
            status: "ISSUED",
          },
        });
        if (issuedInTx) {
          throw new AppError(
            "Final Adviser Certification is already issued. Contact the Graduate School if a new review is required.",
            409,
          );
        }
        const document = await tx.thesisDocument.create({
          data: {
            thesisId: thesis.id,
            docType: MANUSCRIPT_DOC_TYPE,
            defenseStage: DOC_STAGE,
            filePath: file.path,
            uploadedAt: new Date(),
          },
        });
        const existing = await tx.adviserCertification.findFirst({
          where: { thesisId: thesis.id, defenseStage: FINAL_REVIEW_STAGE },
          orderBy: { updatedAt: "desc" },
        });
        if (existing) {
          const updated = await tx.adviserCertification.updateMany({
            where: {
              id: existing.id,
              status: { not: "ISSUED" },
              defenseStage: FINAL_REVIEW_STAGE,
            },
            data: {
              status: "AWAITING_REVIEW",
              reviewRemarks:
                existing.status === "CHANGES_REQUESTED"
                  ? existing.reviewRemarks
                  : null,
              reviewedDocumentId: document.id,
              adviserId,
              signatureData: null,
              signedAt: null,
              certifiedAt: null,
            },
          });
          if (updated.count === 0) {
            throw new AppError(
              "Final Adviser Certification is already issued. Contact the Graduate School if a new review is required.",
              409,
            );
          }
        } else {
          await tx.adviserCertification.create({
            data: {
              thesisId: thesis.id,
              adviserId,
              defenseStage: FINAL_REVIEW_STAGE,
              status: "AWAITING_REVIEW",
              reviewedDocumentId: document.id,
            },
          });
        }
      });
    } catch (err) {
      await safeUnlink(file.path);
      throw err;
    }
  }

  async listReviewTasks(adviserUserId: string): Promise<FinalReviewQueueItem[]> {
    const assignments = await prisma.adviserAssignment.findMany({
      where: { adviserId: adviserUserId, isActive: true },
      include: {
        student: {
          select: {
            id: true,
            studentNumber: true,
            user: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });
    const items: FinalReviewQueueItem[] = [];
    for (const assignment of assignments) {
      const thesis = await prisma.thesisRecord.findFirst({
        where: { studentId: assignment.studentId },
        orderBy: { createdAt: "desc" },
        include: {
          defenseSchedules: {
            where: { defenseType: "TITLE_DEFENSE" },
            include: {
              conclusion: {
                where: { outcome: "PASSED" },
                include: { selectedTitle: { select: { titleText: true } } },
              },
            },
            take: 1,
          },
          thesisDocuments: {
            where: { docType: MANUSCRIPT_DOC_TYPE, defenseStage: DOC_STAGE },
            orderBy: { uploadedAt: "desc" },
            take: 5,
          },
          adviserCertifications: {
            where: { defenseStage: FINAL_REVIEW_STAGE },
            orderBy: { updatedAt: "desc" },
            take: 1,
            include: { reviewedDocument: true },
          },
        },
      });
      if (!thesis) continue;
      const cert = thesis.adviserCertifications[0] ?? null;
      const boundDocId = cert?.reviewedDocumentId ?? null;
      const manuscript = boundDocId
        ? (thesis.thesisDocuments.find((d) => d.id === boundDocId) ??
          cert?.reviewedDocument ??
          null)
        : (thesis.thesisDocuments[0] ?? null);
      const status = cert
        ? mapCertStatusToReviewStatus(cert.status)
        : manuscript
          ? "NONE"
          : "NONE";
      if (!manuscript && status === "NONE") continue;
      if (status === "ISSUED") continue;
      items.push({
        thesisId: thesis.id,
        student: {
          id: assignment.student.id,
          name: `${assignment.student.user.firstName} ${assignment.student.user.lastName}`,
          studentNumber: assignment.student.studentNumber,
        },
        officialTitle:
          thesis.defenseSchedules[0]?.conclusion?.selectedTitle?.titleText ??
          null,
        reviewStatus: status === "NONE" ? "AWAITING_REVIEW" : status,
        reviewRemarks: cert?.reviewRemarks ?? null,
        manuscriptDocumentId: manuscript?.id ?? cert?.reviewedDocumentId ?? null,
        manuscriptUploadedAt: manuscript?.uploadedAt?.toISOString() ?? null,
        stage: "FINAL",
      });
    }
    return items;
  }

  async getReviewTask(
    adviserUserId: string,
    thesisId: string,
  ): Promise<FinalAdviserReviewDto> {
    const thesis = await this.loadReviewContext(thesisId);
    const isActive = await this.isActiveAdviserForStudent(
      adviserUserId,
      thesis.student.id,
    );
    const auth = evaluateActiveAdviserGate({
      isAuthenticated: true,
      isActiveAdviserForStudent: isActive,
    });
    if (!auth.allowed) throw new AppError(auth.reason, auth.statusCode);
    return this.toDto(thesis, adviserUserId);
  }

  async requestChanges(
    adviserUserId: string,
    thesisId: string,
    input: { remarks: string; expectedReviewedDocumentId: string },
  ): Promise<FinalAdviserReviewDto> {
    const expectedReviewedDocumentId = String(
      input.expectedReviewedDocumentId ?? "",
    ).trim();
    if (!expectedReviewedDocumentId) {
      throw new AppError("Reviewed manuscript identifier is required.", 400);
    }
    const thesis = await this.loadReviewContext(thesisId);
    const isActive = await this.isActiveAdviserForStudent(
      adviserUserId,
      thesis.student.id,
    );
    // CP4-FIX2: authorize BEFORE workflow-state checks (no 400 leak to non-advisers).
    const auth = evaluateActiveAdviserGate({
      isAuthenticated: true,
      isActiveAdviserForStudent: isActive,
    });
    if (!auth.allowed) throw new AppError(auth.reason, auth.statusCode);

    const cert = thesis.adviserCertifications[0] ?? null;
    const reviewStatus = mapCertStatusToReviewStatus(cert?.status);
    // CP4-FIX1: Proposal + STRIKE re-checked at mutation time (authorized only).
    await this.assertFinalReviewPrerequisites(thesisId);
    const gate = evaluateRequestChangesGate({
      isActiveAdviser: isActive,
      reviewStatus,
      hasRemarks: Boolean(input.remarks?.trim()),
      hasReviewedDocument: Boolean(cert?.reviewedDocumentId),
      hasExpectedReviewedDocument: true,
    });
    if (!gate.allowed) throw new AppError(gate.reason, gate.statusCode);

    const updated = await prisma.adviserCertification.updateMany({
      where: {
        id: cert!.id,
        defenseStage: FINAL_REVIEW_STAGE,
        status: "AWAITING_REVIEW",
        reviewedDocumentId: expectedReviewedDocumentId,
      },
      data: {
        status: "CHANGES_REQUESTED",
        reviewRemarks: input.remarks.trim(),
        adviserId: adviserUserId,
      },
    });
    if (updated.count === 0) {
      throw new AppError(
        "Final review state changed. Refresh the task and try again.",
        409,
      );
    }
    return this.getReviewTask(adviserUserId, thesisId);
  }

  async certify(
    adviserUserId: string,
    thesisId: string,
    input: {
      signatureData: string;
      remarks?: string | null;
      expectedReviewedDocumentId: string;
    },
  ): Promise<FinalAdviserReviewDto> {
    const expectedReviewedDocumentId = String(
      input.expectedReviewedDocumentId ?? "",
    ).trim();
    if (!expectedReviewedDocumentId) {
      throw new AppError("Reviewed manuscript identifier is required.", 400);
    }
    const thesis = await this.loadReviewContext(thesisId);
    const isActive = await this.isActiveAdviserForStudent(
      adviserUserId,
      thesis.student.id,
    );
    // CP4-FIX2: authorize BEFORE workflow-state checks (no 400 leak to non-advisers).
    const auth = evaluateActiveAdviserGate({
      isAuthenticated: true,
      isActiveAdviserForStudent: isActive,
    });
    if (!auth.allowed) throw new AppError(auth.reason, auth.statusCode);

    const cert = thesis.adviserCertifications[0] ?? null;
    const boundDocId = cert?.reviewedDocumentId ?? null;
    const manuscript = boundDocId
      ? (thesis.thesisDocuments.find((d) => d.id === boundDocId) ??
        cert?.reviewedDocument ??
        null)
      : null;
    const alreadyIssued = thesis.adviserCertifications.some(
      (c) => c.status === "ISSUED",
    );
    // CP4-FIX1: Proposal + STRIKE re-checked at mutation time (authorized only).
    await this.assertFinalReviewPrerequisites(thesisId);
    const gate = evaluateCertifyGate({
      isActiveAdviser: isActive,
      reviewStatus: mapCertStatusToReviewStatus(cert?.status),
      hasManuscript: Boolean(manuscript),
      hasSignature: Boolean(input.signatureData?.trim()),
      alreadyIssued,
      hasReviewedDocument: Boolean(boundDocId),
      hasExpectedReviewedDocument: true,
    });
    if (!gate.allowed) throw new AppError(gate.reason, gate.statusCode);

    const signedAt = new Date();
    await prisma.$transaction(async (tx) => {
      const issued = await tx.adviserCertification.findFirst({
        where: {
          thesisId,
          defenseStage: FINAL_REVIEW_STAGE,
          status: "ISSUED",
        },
      });
      if (issued) {
        throw new AppError("Final Adviser Certification is already issued.", 409);
      }
      const result = await tx.adviserCertification.updateMany({
        where: {
          id: cert!.id,
          defenseStage: FINAL_REVIEW_STAGE,
          status: "AWAITING_REVIEW",
          reviewedDocumentId: expectedReviewedDocumentId,
        },
        data: {
          status: "ISSUED",
          adviserId: adviserUserId,
          reviewRemarks: input.remarks?.trim() || cert?.reviewRemarks || null,
          signatureData: input.signatureData.trim(),
          signedAt,
          certifiedAt: signedAt,
        },
      });
      if (result.count === 0) {
        throw new AppError(
          "Final review state changed. Refresh the task and try again.",
          409,
        );
      }
    });
    return this.getReviewTask(adviserUserId, thesisId);
  }
}

// Re-export for callers that need policy visibility
export { resolveStrikePolicy };
