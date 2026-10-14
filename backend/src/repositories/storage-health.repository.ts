import prisma from "../config/database";

/**
 * DL-11: read-only DB access for storage health and integrity diagnostics.
 *
 * Every method here is a read. This repository intentionally exposes NO create,
 * update, or delete operations — reconciliation/backfill belongs to DL-12 or an
 * explicitly reviewed maintenance operation, never to a health check.
 */

export interface ReferenceCounts {
  managedCorUploads: number;
  managedThesisDocuments: number;
  legacyCorUploads: number;
  legacyThesisDocuments: number;
}

export interface ManagedCorReference {
  id: string;
  storageKey: string | null;
  storageProvider: string | null;
  sizeBytes: number | null;
  checksum: string | null;
  checksumAlgorithm: string | null;
}

export interface ManagedThesisReference extends ManagedCorReference {
  docType: string;
  defenseStage: string | null;
}

export interface LegacyCorReference {
  id: string;
  filePath: string | null;
}

export interface LegacyThesisReference extends LegacyCorReference {
  docType: string;
  defenseStage: string | null;
}

const MANAGED_SELECT = {
  id: true,
  storageKey: true,
  storageProvider: true,
  sizeBytes: true,
  checksum: true,
  checksumAlgorithm: true,
} as const;

export class StorageHealthRepository {
  async getReferenceCounts(): Promise<ReferenceCounts> {
    const [
      managedCorUploads,
      legacyCorUploads,
      managedThesisDocuments,
      legacyThesisDocuments,
    ] = await Promise.all([
      prisma.corUpload.count({ where: { storageKey: { not: null } } }),
      prisma.corUpload.count({ where: { storageKey: { equals: null } } }),
      prisma.thesisDocument.count({ where: { storageKey: { not: null } } }),
      prisma.thesisDocument.count({ where: { storageKey: { equals: null } } }),
    ]);

    return {
      managedCorUploads,
      managedThesisDocuments,
      legacyCorUploads,
      legacyThesisDocuments,
    };
  }

  async listManagedCorUploads(): Promise<ManagedCorReference[]> {
    return prisma.corUpload.findMany({
      where: { storageKey: { not: null } },
      select: MANAGED_SELECT,
    });
  }

  async listManagedThesisDocuments(): Promise<ManagedThesisReference[]> {
    return prisma.thesisDocument.findMany({
      where: { storageKey: { not: null } },
      select: {
        ...MANAGED_SELECT,
        docType: true,
        defenseStage: true,
      },
    });
  }

  async listLegacyCorUploads(): Promise<LegacyCorReference[]> {
    return prisma.corUpload.findMany({
      where: { storageKey: { equals: null }, filePath: { not: "" } },
      select: { id: true, filePath: true },
    });
  }

  async listLegacyThesisDocuments(): Promise<LegacyThesisReference[]> {
    return prisma.thesisDocument.findMany({
      where: { storageKey: { equals: null }, filePath: { not: "" } },
      select: {
        id: true,
        filePath: true,
        docType: true,
        defenseStage: true,
      },
    });
  }
}
