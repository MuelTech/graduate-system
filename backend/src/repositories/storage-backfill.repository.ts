import prisma from "../config/database";

/**
 * DL-12: read + concurrency-safe conditional metadata backfill for the only two
 * models that already carry the DL-1 storage metadata shape:
 *   - CorUpload
 *   - ThesisDocument
 *
 * It never creates/deletes/physically moves files, never touches legacy-only
 * path models, and never overwrites newer state (conditional updateMany).
 */

export type BackfillSource = "COR_UPLOAD" | "THESIS_DOCUMENT";

export interface LegacyCorBackfillRow {
  id: string;
  filePath: string;
  storageKey: string | null;
  storageProvider: string | null;
  sizeBytes: number | null;
  checksum: string | null;
  checksumAlgorithm: string | null;
}

export interface LegacyThesisBackfillRow extends LegacyCorBackfillRow {
  docType: string;
  defenseStage: string | null;
}

export interface BackfillUpdateData {
  storageKey: string;
  storageProvider?: string;
  sizeBytes?: number;
  checksum?: string;
  checksumAlgorithm?: string;
}

export interface ManagedReferenceCounts {
  managedCorUploads: number;
  managedThesisDocuments: number;
}

export interface LegacyStorageDebtCounts {
  studentRequirement: number;
  plagiarismResult: number;
  rapReport: number;
  adviserCertification: number;
  statisticianCertification: number;
  grammarianCertification: number;
  researchVariableForm: number;
  expertEvaluation: number;
  studentFile: number;
  manuscriptDistributionSignature: number;
  eLibraryFullPaper: number;
  eLibraryRespondentData: number;
}

const LEGACY_CANDIDATE_WHERE = {
  storageKey: { equals: null },
  filePath: { not: "" },
} as const;

const COR_SELECT = {
  id: true,
  filePath: true,
  storageKey: true,
  storageProvider: true,
  sizeBytes: true,
  checksum: true,
  checksumAlgorithm: true,
} as const;

export class StorageBackfillRepository {
  async listLegacyCandidates(): Promise<{
    cor: LegacyCorBackfillRow[];
    thesis: LegacyThesisBackfillRow[];
  }> {
    const [cor, thesis] = await Promise.all([
      prisma.corUpload.findMany({
        where: LEGACY_CANDIDATE_WHERE,
        select: COR_SELECT,
      }),
      prisma.thesisDocument.findMany({
        where: LEGACY_CANDIDATE_WHERE,
        select: {
          ...COR_SELECT,
          docType: true,
          defenseStage: true,
        },
      }),
    ]);
    return { cor, thesis };
  }

  async countManaged(): Promise<ManagedReferenceCounts> {
    const [managedCorUploads, managedThesisDocuments] = await Promise.all([
      prisma.corUpload.count({ where: { storageKey: { not: null } } }),
      prisma.thesisDocument.count({ where: { storageKey: { not: null } } }),
    ]);
    return { managedCorUploads, managedThesisDocuments };
  }

  /**
   * Conditional write: only succeeds while the row is still the exact legacy
   * candidate (id + storageKey null + same filePath). Returns rows changed.
   */
  async applyCorBackfill(
    id: string,
    expectedFilePath: string,
    data: BackfillUpdateData,
  ): Promise<number> {
    const result = await prisma.corUpload.updateMany({
      where: { id, storageKey: { equals: null }, filePath: expectedFilePath },
      data,
    });
    return result.count;
  }

  async applyThesisBackfill(
    id: string,
    expectedFilePath: string,
    data: BackfillUpdateData,
  ): Promise<number> {
    const result = await prisma.thesisDocument.updateMany({
      where: { id, storageKey: { equals: null }, filePath: expectedFilePath },
      data,
    });
    return result.count;
  }

  /** Read-only inventory of path-only models outside the backfill scope. */
  async countLegacyPathDebt(): Promise<LegacyStorageDebtCounts> {
    const [
      studentRequirement,
      plagiarismResult,
      rapReport,
      adviserCertification,
      statisticianCertification,
      grammarianCertification,
      researchVariableForm,
      expertEvaluation,
      studentFile,
      manuscriptDistributionSignature,
      eLibraryFullPaper,
      eLibraryRespondentData,
    ] = await Promise.all([
      prisma.studentRequirement.count({ where: { filePath: { not: null } } }),
      prisma.plagiarismResult.count({ where: { filePath: { not: "" } } }),
      prisma.rapReport.count({ where: { filePath: { not: null } } }),
      prisma.adviserCertification.count({ where: { filePath: { not: null } } }),
      prisma.statisticianCertification.count({
        where: { filePath: { not: null } },
      }),
      prisma.grammarianCertification.count({
        where: { filePath: { not: null } },
      }),
      prisma.researchVariableForm.count({ where: { filePath: { not: null } } }),
      prisma.expertEvaluation.count({ where: { filePath: { not: null } } }),
      prisma.studentFile.count({ where: { filePath: { not: "" } } }),
      prisma.manuscriptDistribution.count({
        where: { signaturePath: { not: null } },
      }),
      prisma.eLibrary.count({ where: { fullPaperPath: { not: null } } }),
      prisma.eLibrary.count({ where: { respondentDataPath: { not: null } } }),
    ]);

    return {
      studentRequirement,
      plagiarismResult,
      rapReport,
      adviserCertification,
      statisticianCertification,
      grammarianCertification,
      researchVariableForm,
      expertEvaluation,
      studentFile,
      manuscriptDistributionSignature,
      eLibraryFullPaper,
      eLibraryRespondentData,
    };
  }
}
