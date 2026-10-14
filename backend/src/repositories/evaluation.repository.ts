import prisma from '../config/database';

/**
 * DL-2: verified storage metadata for a migrated managed upload.
 * The file has already been byte-validated and promoted by the secure upload
 * middleware before the domain service persists this record.
 */
export interface EvaluationUploadInput {
  filePath: string;
  storageKey?: string | null;
  storageProvider?: string | null;
  originalFilename?: string | null;
  verifiedMimeType?: string | null;
  sizeBytes?: number | null;
  checksum?: string | null;
  checksumAlgorithm?: string | null;
  uploadedById?: string | null;
}

export class EvaluationRepository {
  async createRequest(
    thesisId: string,
    type: string | undefined,
    desc: string | undefined,
    upload: EvaluationUploadInput,
  ) {
    return prisma.$transaction(async (tx) => {
      // 1. Create the Evaluation Request
      const request = await tx.expertEvaluationRequest.create({
        data: {
          thesisId,
          instrumentType: type,
          instrumentDescription: desc,
          status: 'PENDING'
        }
      });

      // 2. Create the Document record so the Admin can download it.
      //    DL-2: persist managed storage identity + verified metadata.
      await tx.thesisDocument.create({
        data: {
          thesisId,
          docType: 'INSTRUMENTS',
          filePath: upload.filePath,
          storageKey: upload.storageKey ?? null,
          storageProvider: upload.storageProvider ?? null,
          originalFilename: upload.originalFilename ?? null,
          verifiedMimeType: upload.verifiedMimeType ?? null,
          sizeBytes: upload.sizeBytes ?? null,
          checksum: upload.checksum ?? null,
          checksumAlgorithm: upload.checksumAlgorithm ?? null,
          uploadedById: upload.uploadedById ?? null,
          uploadedAt: new Date()
        }
      });

      return request;
    });
  }

  async assignExpertToRequest(requestId: string, adminId: string) {
    return prisma.expertEvaluationRequest.update({
      where: { id: requestId },
      data: {
        assignedById: adminId,
        status: 'ASSIGNED'
      }
    });
  }

    async getActiveThesisForStudent(userId: string) {
    // 1. Find the student using the userId from the JWT
    const student = await prisma.student.findUnique({
      where: { userId }
    });

    if (!student) return null;

    // 2. Find their active thesis
    return prisma.thesisRecord.findFirst({
      where: { studentId: student.id },
      orderBy: { createdAt: 'desc' }
    });
  }
}
