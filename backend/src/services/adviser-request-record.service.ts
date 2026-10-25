import type { AdviserRequestOfficialRecord, Prisma } from "@prisma/client";
import prisma from "../config/database";
import { AppError } from "../utils/AppError";
import { renderAdviserRequest } from "../documents/official-defense/adviser-request/adviser-request.renderer";
import { loadOfficialFormLogos } from "./official-form-assets";
import { sanitizeOfficialNamePart } from "./official-defense-document-filename";
import {
  adviserRequestEvidenceHash, parseSignedAdviserRequestState, validateStudentRequestSignature,
  type SignedAdviserRequestState,
} from "./adviser-request-signed-state";

export interface AdviserRequestRecordActor { userId: string; role: string }
export interface AdviserRequestSnapshot extends SignedAdviserRequestState {
  formCode: "EARIST-QSF-GS-020";
  revision: "Rev. 00";
  effectiveDate: "06.20.25";
  adviserStatus: "CONFORMED";
  adviserRespondedAt: string;
  deanStatus: "APPROVED";
  deanReviewedById: string;
  deanReviewedAt: string;
  finalizedAt: string;
  printedDeanName: "";
  printedDeanSignature: null;
}

/** Signing-bound display values come exclusively from the preserved signed state. */
export function finalizedAdviserRequestSnapshot(
  signed: SignedAdviserRequestState, adviserRespondedAt: Date | null, deanUserId: string, now: Date,
): AdviserRequestSnapshot {
  if (!adviserRespondedAt || !Number.isFinite(adviserRespondedAt.getTime()) || !deanUserId) {
    throw new AppError("The exact Adviser confirmation and Graduate School approval evidence are required.", 409);
  }
  return {
    ...signed, formCode: "EARIST-QSF-GS-020", revision: "Rev. 00", effectiveDate: "06.20.25",
    adviserStatus: "CONFORMED", adviserRespondedAt: adviserRespondedAt.toISOString(),
    deanStatus: "APPROVED", deanReviewedById: deanUserId, deanReviewedAt: now.toISOString(),
    finalizedAt: now.toISOString(), printedDeanName: "", printedDeanSignature: null,
  };
}

const RECORD_SELECT = {
  requestId: true, studentUserId: true, requestedAdviserId: true, snapshot: true,
  signatureData: true, evidenceHash: true, finalizedAt: true,
  request: { select: { status: true, adviserStatus: true, deanStatus: true } },
} as const satisfies Prisma.AdviserRequestOfficialRecordSelect;
type RecordSource = Prisma.AdviserRequestOfficialRecordGetPayload<{ select: typeof RECORD_SELECT }>;

function assertActor(actor: AdviserRequestRecordActor) {
  if (!actor.userId || !["STUDENT", "PANELIST", "ADMIN"].includes(actor.role)) {
    throw new AppError("Adviser Request record not found.", 404);
  }
}

function snapshotOf(row: AdviserRequestOfficialRecord & { request: { status: string; adviserStatus: string; deanStatus: string } }) {
  const snapshot = parseSignedAdviserRequestState(row.snapshot) as AdviserRequestSnapshot;
  if (snapshot.formCode !== "EARIST-QSF-GS-020" || snapshot.revision !== "Rev. 00" || snapshot.effectiveDate !== "06.20.25"
    || snapshot.requestId !== row.requestId || snapshot.studentUserId !== row.studentUserId
    || snapshot.requestedAdviserId !== row.requestedAdviserId || snapshot.adviserStatus !== "CONFORMED"
    || snapshot.deanStatus !== "APPROVED" || row.request.status !== "APPROVED"
    || row.request.adviserStatus !== "CONFORMED" || row.request.deanStatus !== "APPROVED"
    || !snapshot.deanReviewedById || !Number.isFinite(Date.parse(snapshot.adviserRespondedAt))
    || !Number.isFinite(Date.parse(snapshot.deanReviewedAt)) || snapshot.finalizedAt !== row.finalizedAt.toISOString()
    || snapshot.printedDeanName !== "" || snapshot.printedDeanSignature !== null
    || adviserRequestEvidenceHash(snapshot, row.signatureData) !== row.evidenceHash) {
    throw new AppError("The finalized Adviser Request record is incomplete or unsupported.", 409);
  }
  return snapshot;
}

/** Read-only metadata and on-demand PDF; never rebuild a legacy request from current profiles. */
export class AdviserRequestRecordService {
  private async source(id: string, actor: AdviserRequestRecordActor): Promise<RecordSource> {
    assertActor(actor);
    const row = await prisma.adviserRequestOfficialRecord.findUnique({ where: { requestId: id }, select: RECORD_SELECT });
    if (!row || !(actor.role === "ADMIN" || (actor.role === "STUDENT" && row.studentUserId === actor.userId)
      || (actor.role === "PANELIST" && row.requestedAdviserId === actor.userId))) {
      throw new AppError("Adviser Request record not found.", 404);
    }
    return row;
  }

  async list(actor: AdviserRequestRecordActor) {
    assertActor(actor);
    const rows = await prisma.adviserRequestOfficialRecord.findMany({
      where: {
        ...(actor.role === "STUDENT" ? { studentUserId: actor.userId } : {}),
        ...(actor.role === "PANELIST" ? { requestedAdviserId: actor.userId } : {}),
        request: { status: "APPROVED", adviserStatus: "CONFORMED", deanStatus: "APPROVED" },
      },
      select: RECORD_SELECT, orderBy: [{ finalizedAt: "desc" }, { requestId: "desc" }],
    });
    return Promise.all(rows.map(async row => {
      const snapshot = snapshotOf(row);
      let pdfAvailable = true;
      try { await validateStudentRequestSignature(row.signatureData); } catch { pdfAvailable = false; }
      return {
        id: row.requestId, studentName: snapshot.studentName, requestedAdviserName: snapshot.requestedAdviserName,
        requestDate: snapshot.requestDateDisplay, finalizedAt: snapshot.finalizedAt, status: "APPROVED" as const, pdfAvailable,
      };
    }));
  }

  async generatePdf(id: string, actor: AdviserRequestRecordActor) {
    const row = await this.source(id, actor);
    const snapshot = snapshotOf(row);
    const signature = await validateStudentRequestSignature(row.signatureData);
    try {
      const pdf = await renderAdviserRequest({
        logos: await loadOfficialFormLogos(), requestDate: snapshot.requestDateDisplay,
        requestedAdviserName: snapshot.requestedAdviserName, reason: snapshot.reason,
        studentName: snapshot.studentName, studentNumber: snapshot.studentNumber,
        programName: snapshot.programName, studentSignature: signature,
      });
      return { pdf, filename: `${sanitizeOfficialNamePart(snapshot.studentName)}-Adviser-Request.pdf` };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("The finalized Adviser Request could not be rendered.", 409);
    }
  }
}
