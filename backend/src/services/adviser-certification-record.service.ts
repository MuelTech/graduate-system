import prisma from "../config/database";
import type { Prisma } from "@prisma/client";
import { AppError } from "../utils/AppError";
import { isValidCertifiedFinalManuscript, isValidCertifiedProposalManuscript } from "./proposal-adviser-review.rules";

export interface CertificationActor { userId: string; role: string }
export type CertificationStage = "PROPOSAL" | "FINAL";

/** Only exact relations; no current-document, working-title, or assignment lookup. */
const CERTIFICATION_SELECT = {
  id: true, thesisId: true, adviserId: true, defenseStage: true, status: true,
  reviewedDocumentId: true, signedAt: true, signatureData: true,
  adviser: { select: { id: true, firstName: true, lastName: true } },
  thesis: { select: { id: true, student: { select: {
    userId: true, user: { select: { firstName: true, lastName: true } },
    program: { select: { programName: true } },
  } } } },
  reviewedDocument: { select: {
    id: true, thesisId: true, docType: true, defenseStage: true,
    manuscriptTitle: true, originalFilename: true,
  } },
} as const satisfies Prisma.AdviserCertificationSelect;

export type AdviserCertificationSource = Prisma.AdviserCertificationGetPayload<{ select: typeof CERTIFICATION_SELECT }>;

export function certificationStage(value: string): CertificationStage {
  if (value === "PROPOSAL_DEFENSE") return "PROPOSAL";
  if (value === "FINAL_DEFENSE") return "FINAL";
  throw new AppError("GS-017 is available only for Proposal or Final certification.", 409);
}

export function assertIssuedCertificationSource(row: AdviserCertificationSource): CertificationStage {
  const stage = certificationStage(row.defenseStage);
  if (row.thesis?.id !== row.thesisId || !exactCertificationDocument(row)) {
    throw new AppError("An issued certification with an exact same-thesis manuscript binding is required for GS-017.", 409);
  }
  if (!row.reviewedDocument?.manuscriptTitle?.trim()) {
    throw new AppError("The exact certified manuscript has no recorded title. GS-017 is unavailable.", 409);
  }
  if (!row.adviser || row.adviser.id !== row.adviserId || !personName(row.adviser)) {
    throw new AppError("The certification issuer identity cannot be verified.", 409);
  }
  if (!row.signedAt || !Number.isFinite(new Date(row.signedAt).getTime())) {
    throw new AppError("The certification has no valid server-owned issue timestamp.", 409);
  }
  if (!personName(row.thesis.student.user) || !row.thesis.student.program?.programName?.trim()) {
    throw new AppError("The certification Student or program identity is incomplete.", 409);
  }
  return stage;
}

export function exactCertificationDocument(row: AdviserCertificationSource) {
  return isValidCertifiedProposalManuscript(row, row.reviewedDocument, row.thesisId)
    || isValidCertifiedFinalManuscript(row, row.reviewedDocument, row.thesisId) ? row.reviewedDocument : null;
}

export function personName(user: { firstName: string; lastName: string } | null | undefined): string {
  return `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim();
}

function authorizeActor(actor: CertificationActor): void {
  if (!actor.userId || !["ADMIN", "STUDENT", "PANELIST"].includes(actor.role)) {
    throw new AppError("Adviser certification not found.", 404);
  }
}

export class AdviserCertificationRecordService {
  async getSource(id: string, actor: CertificationActor): Promise<AdviserCertificationSource> {
    authorizeActor(actor);
    const row = await prisma.adviserCertification.findUnique({ where: { id }, select: CERTIFICATION_SELECT });
    const authorized = row && (actor.role === "ADMIN"
      || (actor.role === "STUDENT" && row.thesis.student.userId === actor.userId)
      || (actor.role === "PANELIST" && row.adviserId === actor.userId));
    if (!authorized) throw new AppError("Adviser certification not found.", 404);
    return row;
  }

  async listSources(actor: CertificationActor, thesisId?: string, stage?: string): Promise<AdviserCertificationSource[]> {
    authorizeActor(actor);
    if (stage !== undefined && stage !== "PROPOSAL" && stage !== "FINAL") {
      throw new AppError("GS-017 stage must be Proposal or Final.", 400);
    }
    if (actor.role === "ADMIN" && !thesisId) throw new AppError("An exact thesis identifier is required.", 400);
    return prisma.adviserCertification.findMany({
      where: {
        status: "ISSUED",
        defenseStage: stage ? (stage === "PROPOSAL" ? "PROPOSAL_DEFENSE" : "FINAL_DEFENSE") : { in: ["PROPOSAL_DEFENSE", "FINAL_DEFENSE"] },
        ...(thesisId ? { thesisId } : {}),
        ...(actor.role === "STUDENT" ? { thesis: { student: { userId: actor.userId } } } : {}),
        ...(actor.role === "PANELIST" ? { adviserId: actor.userId } : {}),
      },
      select: CERTIFICATION_SELECT,
      orderBy: { signedAt: "desc" },
    });
  }
}
