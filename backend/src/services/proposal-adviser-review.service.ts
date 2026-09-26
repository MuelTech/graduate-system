/**
 * CP3 — Proposal Adviser review and Adviser Certification workflow.
 *
 * Student uploads Proposal manuscript for Adviser review (not the Admin application).
 * Active Adviser requests changes or certifies with e-signature.
 * Only ISSUED PROPOSAL_DEFENSE certifications satisfy ADVISER_CERT.
 */
import { fileTypeFromFile } from "file-type";
import fs from "fs/promises";
import prisma from "../config/database";
import { AppError } from "../utils/AppError";
import {
  evaluateActiveAdviserGate,
  evaluateCertifyGate,
  evaluateRequestChangesGate,
  evaluateSubmitManuscriptGate,
  isAllowedProposalManuscriptMime,
  isValidCertifiedProposalManuscript,
  mapCertStatusToReviewStatus,
  PROPOSAL_REVIEW_STAGE,
  type ProposalReviewStatus,
} from "./proposal-adviser-review.rules";
import { isTitleStageComplete } from "./stage-completion";

const MANUSCRIPT_DOC_TYPE = "PROPOSAL_CHAPTERS" as const;

export interface ProposalAdviserReviewDto {
  thesisId: string | null;
  student: { id: string; name: string; studentNumber: string | null } | null;
  officialTitle: string | null;
  activeAdviser: { userId: string; name: string } | null;
  reviewStatus: ProposalReviewStatus;
  reviewRemarks: string | null;
  manuscript: {
    documentId: string;
    uploadedAt: string | null;
  } | null;
  certification: {
    issued: boolean;
    adviserName: string | null;
    signedAt: string | null;
    defenseStage: string;
  } | null;
  /** True when the authenticated user is the active adviser for this student. */
  isAuthorizedAdviser: boolean;
}

export interface AdviserReviewQueueItem {
  thesisId: string;
  student: { id: string; name: string; studentNumber: string | null };
  officialTitle: string | null;
  reviewStatus: ProposalReviewStatus;
  reviewRemarks: string | null;
  manuscriptDocumentId: string | null;
  manuscriptUploadedAt: string | null;
}

async function safeUnlink(filePath: string | null | undefined) {
  if (!filePath) return;
  try {
    await fs.unlink(filePath);
  } catch {
    // best-effort cleanup
  }
}

export class ProposalAdviserReviewService {
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
        thesisTitles: {
          where: { isSelected: true },
          select: { titleText: true },
          take: 1,
        },
        defenseSchedules: {
          where: { defenseType: "TITLE_DEFENSE" },
          include: {
            conclusion: {
              where: { outcome: "PASSED" },
              include: {
                selectedTitle: { select: { titleText: true } },
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        thesisDocuments: {
          where: {
            docType: MANUSCRIPT_DOC_TYPE,
            defenseStage: "PROPOSAL",
          },
          orderBy: { uploadedAt: "desc" },
          take: 5,
        },
        adviserCertifications: {
          where: { defenseStage: PROPOSAL_REVIEW_STAGE },
          orderBy: { updatedAt: "desc" },
          include: {
            adviser: { select: { id: true, firstName: true, lastName: true } },
            reviewedDocument: true,
          },
        },
      },
    });
    if (!thesis) throw new AppError("Thesis Record not found.", 404);
    return thesis;
  }

  private toStudentDto(
    thesis: Awaited<ReturnType<ProposalAdviserReviewService["loadReviewContext"]>>,
    authenticatedUserId: string,
  ): ProposalAdviserReviewDto {
    const assignment = thesis.student.adviserAssignments[0] ?? null;
    const cert =
      thesis.adviserCertifications.find((c) => c.status === "ISSUED") ??
      thesis.adviserCertifications[0] ??
      null;
    // CP3-FIX1: current review manuscript is cert.reviewedDocumentId (not latest upload).
    const boundDocId = cert?.reviewedDocumentId ?? null;
    const manuscript = boundDocId
      ? (thesis.thesisDocuments.find((d) => d.id === boundDocId) ??
        cert?.reviewedDocument ??
        null)
      : (thesis.thesisDocuments[0] ?? null);
    const reviewStatus = cert
      ? mapCertStatusToReviewStatus(cert.status)
      : "NONE";
    const officialTitle =
      thesis.defenseSchedules[0]?.conclusion?.selectedTitle?.titleText ??
      thesis.thesisTitles[0]?.titleText ??
      null;

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
    };
  }

  /** Student-facing Proposal adviser-review state. */
  async getStudentReviewState(userId: string): Promise<ProposalAdviserReviewDto> {
    const { student, thesis } = await this.findThesisForStudent(userId);
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
      };
    }
    const full = await this.loadReviewContext(thesis.id);
    return this.toStudentDto(full, userId);
  }

  /**
   * Student uploads/resubmits Proposal Chapters 1–3 for Adviser review.
   * Does NOT submit the Proposal defense application to Admin.
   */
  async submitManuscriptForReview(
    userId: string,
    file: Express.Multer.File,
  ): Promise<ProposalAdviserReviewDto> {
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

    // Title stage completion (formal) required before Proposal manuscript review.
    const titleRap = await prisma.rapReport.findFirst({
      where: {
        thesisId: thesis.id,
        defenseType: "TITLE_DEFENSE",
        status: { in: ["ALL_SIGNED", "FINALIZED"] },
      },
    });
    const titleConclusion = await prisma.defenseConclusion.findFirst({
      where: {
        thesisId: thesis.id,
        outcome: "PASSED",
        schedule: { defenseType: "TITLE_DEFENSE" },
      },
      orderBy: { concludedAt: "desc" },
      select: { selectedTitleId: true, scheduleId: true },
    });
    const titleRapFinalized = titleConclusion?.scheduleId
      ? (await prisma.rapReport.count({
          where: {
            scheduleId: titleConclusion.scheduleId,
            defenseType: "TITLE_DEFENSE",
            status: { in: ["ALL_SIGNED", "FINALIZED"] },
          },
        })) > 0
      : Boolean(titleRap);

    const titleStageComplete = isTitleStageComplete({
      outcome: titleConclusion ? "PASSED" : null,
      hasSelectedTitle: Boolean(titleConclusion?.selectedTitleId),
      titleRapFinalized,
    });

    const gate = evaluateSubmitManuscriptGate({
      hasActiveAdviser: Boolean(assignment),
      titleStageComplete,
      hasManuscriptFile: Boolean(file?.path),
    });
    if (!gate.allowed) {
      await safeUnlink(file?.path);
      throw new AppError(gate.reason, gate.statusCode);
    }

    // Magic-byte validation for manuscript files.
    const detected = await fileTypeFromFile(file.path);
    const mime = detected?.mime ?? null;
    // file-type may not detect .doc; allow extension fallback for legacy Word.
    const ext = file.originalname?.toLowerCase()?.split(".").pop() ?? "";
    const extOk = ["pdf", "doc", "docx"].includes(ext);
    if (!isAllowedProposalManuscriptMime(mime) && !(extOk && !mime)) {
      await safeUnlink(file.path);
      throw new AppError(
        "Invalid Proposal manuscript file type. Allowed: PDF, DOC, DOCX.",
        400,
      );
    }

    // CP3-FIX1: reject AFTER ISSUED before any ThesisDocument row is created.
    const existingIssued = await prisma.adviserCertification.findFirst({
      where: {
        thesisId: thesis.id,
        defenseStage: PROPOSAL_REVIEW_STAGE,
        status: "ISSUED",
      },
    });
    if (existingIssued) {
      await safeUnlink(file.path);
      throw new AppError(
        "Proposal Adviser Certification is already issued. Contact the Graduate School if a new review is required.",
        409,
      );
    }

    const adviserId = assignment!.adviserId;

    try {
      await prisma.$transaction(async (tx) => {
        // CP3-FIX2: re-check ISSUED inside the transaction (race with Adviser certify).
        const existingIssuedInTx = await tx.adviserCertification.findFirst({
          where: {
            thesisId: thesis.id,
            defenseStage: PROPOSAL_REVIEW_STAGE,
            status: "ISSUED",
          },
        });
        if (existingIssuedInTx) {
          throw new AppError(
            "Proposal Adviser Certification is already issued. Contact the Graduate School if a new review is required.",
            409,
          );
        }

        const document = await tx.thesisDocument.create({
          data: {
            thesisId: thesis.id,
            docType: MANUSCRIPT_DOC_TYPE,
            defenseStage: "PROPOSAL",
            filePath: file.path,
            uploadedAt: new Date(),
          },
        });

        // Bind the new manuscript as the current review cycle document.
        const existing = await tx.adviserCertification.findFirst({
          where: { thesisId: thesis.id, defenseStage: PROPOSAL_REVIEW_STAGE },
          orderBy: { updatedAt: "desc" },
        });

        if (existing) {
          // Atomic conditional write: never downgrade an ISSUED certification.
          const updated = await tx.adviserCertification.updateMany({
            where: {
              id: existing.id,
              status: { not: "ISSUED" },
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
              "Proposal Adviser Certification is already issued. Contact the Graduate School if a new review is required.",
              409,
            );
          }
        } else {
          await tx.adviserCertification.create({
            data: {
              thesisId: thesis.id,
              adviserId,
              defenseStage: PROPOSAL_REVIEW_STAGE,
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

    return this.getStudentReviewState(userId);
  }

  /** Adviser review queue — only students where caller is the active adviser. */
  async listReviewTasks(adviserUserId: string): Promise<AdviserReviewQueueItem[]> {
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

    const items: AdviserReviewQueueItem[] = [];
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
            where: { docType: MANUSCRIPT_DOC_TYPE, defenseStage: "PROPOSAL" },
            orderBy: { uploadedAt: "desc" },
            take: 5,
          },
          adviserCertifications: {
            where: { defenseStage: PROPOSAL_REVIEW_STAGE },
            orderBy: { updatedAt: "desc" },
            take: 1,
            include: { reviewedDocument: true },
          },
        },
      });
      if (!thesis) continue;
      const cert = thesis.adviserCertifications[0] ?? null;
      // CP3-FIX2: queue follows reviewedDocumentId when a binding exists.
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
      // Queue only when there is review work (manuscript present and not issued).
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
          thesis.defenseSchedules[0]?.conclusion?.selectedTitle?.titleText ?? null,
        reviewStatus: status === "NONE" ? "AWAITING_REVIEW" : status,
        reviewRemarks: cert?.reviewRemarks ?? null,
        manuscriptDocumentId: manuscript?.id ?? cert?.reviewedDocumentId ?? null,
        manuscriptUploadedAt: manuscript?.uploadedAt?.toISOString() ?? null,
      });
    }
    return items;
  }

  async getReviewTask(adviserUserId: string, thesisId: string): Promise<ProposalAdviserReviewDto> {
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
    return this.toStudentDto(thesis, adviserUserId);
  }

  /**
   * CP3-FIX4: expectedReviewedDocumentId is the client's optimistic concurrency
   * token — never derived from the current DB row.
   */
  async requestChanges(
    adviserUserId: string,
    thesisId: string,
    input: {
      remarks: string;
      expectedReviewedDocumentId: string;
    },
  ): Promise<ProposalAdviserReviewDto> {
    const expectedReviewedDocumentId = String(
      input.expectedReviewedDocumentId ?? "",
    ).trim();
    if (!expectedReviewedDocumentId) {
      throw new AppError("Reviewed manuscript identifier is required.", 400);
    }

    const thesis = await this.loadReviewContext(thesisId);
    // Re-check active adviser immediately before write (TOCTOU).
    const isActive = await this.isActiveAdviserForStudent(
      adviserUserId,
      thesis.student.id,
    );
    const cert = thesis.adviserCertifications[0] ?? null;
    const reviewStatus = mapCertStatusToReviewStatus(cert?.status);

    const gate = evaluateRequestChangesGate({
      isActiveAdviser: isActive,
      reviewStatus,
      hasRemarks: Boolean(input.remarks?.trim()),
      hasReviewedDocument: Boolean(cert?.reviewedDocumentId),
      hasExpectedReviewedDocument: true,
    });
    if (!gate.allowed) throw new AppError(gate.reason, gate.statusCode);

    // Atomic: status AWAITING_REVIEW + client expected document (may be stale vs DB).
    const updated = await prisma.adviserCertification.updateMany({
      where: {
        id: cert!.id,
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
        "Proposal review state changed. Refresh the task and try again.",
        409,
      );
    }
    return this.getReviewTask(adviserUserId, thesisId);
  }

  /**
   * Adviser certifies Proposal manuscript with e-signature.
   * Server timestamps are authoritative; client timestamps are ignored.
   * CP3-FIX3: atomic AWAITING_REVIEW + expected reviewedDocumentId → ISSUED.
   */
  async certify(
    adviserUserId: string,
    thesisId: string,
    input: {
      signatureData: string;
      remarks?: string | null;
      clientIssuedAt?: string | null;
      /** CP3-FIX4: required — document the Adviser acted on; never inferred from DB. */
      expectedReviewedDocumentId: string;
    },
  ): Promise<ProposalAdviserReviewDto> {
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

    const signedAt = new Date(); // server-authoritative
    const reviewRemarks = input.remarks?.trim() || cert?.reviewRemarks || null;

    await prisma.$transaction(async (tx) => {
      const issued = await tx.adviserCertification.findFirst({
        where: {
          thesisId,
          defenseStage: PROPOSAL_REVIEW_STAGE,
          status: "ISSUED",
        },
      });
      if (issued) {
        throw new AppError("Proposal Adviser Certification is already issued.", 409);
      }

      // CP3-FIX4: WHERE uses client expected id (not inferred current DB value).
      const result = await tx.adviserCertification.updateMany({
        where: {
          id: cert!.id,
          status: "AWAITING_REVIEW",
          reviewedDocumentId: expectedReviewedDocumentId,
        },
        data: {
          status: "ISSUED",
          adviserId: adviserUserId,
          reviewRemarks,
          signatureData: input.signatureData.trim(),
          signedAt,
          certifiedAt: signedAt,
        },
      });
      if (result.count === 0) {
        throw new AppError(
          "Proposal review state changed. Refresh the task and try again.",
          409,
        );
      }
    });

    return this.getReviewTask(adviserUserId, thesisId);
  }
}
