import prisma from "../config/database";
import { AppError } from "../utils/AppError";
import {
  RepositoryPublicationRepository,
  type AdminEntryRow,
  type PublishedEntryRow,
} from "../repositories/repository-publication.repository";

/**
 * DL-10: Research Repository publication service.
 *
 * Boundary rules:
 * - The public projection is metadata-only and identical for every viewer.
 *   This service never receives or inspects a caller role.
 * - `publicationArtifact` is always unavailable and unresolved; the post-Final
 *   archival manuscript / download policy is an OPEN institutional decision.
 * - Publishing metadata never publishes manuscripts, respondent data, or
 *   documents, and never mutates the DL-9 private archive registration.
 * - The private archive remains the property of the DL-9 archive service.
 */

export interface RepositoryArtifactPolicyDto {
  available: false;
  policyResolved: false;
}

export interface CallerContext {
  userId?: string;
  role?: string;
}

export interface RepositoryPublicationDto {
  id: string;
  title: string;
  author: string | null;
  program: string | null;
  abstract: string | null;
  keywords: string[];
  publishedAt: string | null;
  hasManuscript: boolean;
  hasRespondentData: boolean;
  downloadUrl?: string | null;
  respondentDataUrl?: string | null;
  canDownloadManuscript: boolean;
  canDownloadRespondentData: boolean;
  artifact: RepositoryArtifactPolicyDto;
}

export interface RepositoryAdminEntryDto {
  id: string;
  title: string;
  author: string | null;
  studentNumber: string | null;
  program: string | null;
  abstract: string | null;
  keywords: string[];
  archiveRegisteredAt: string;
  hasManuscript: boolean;
  hasRespondentData: boolean;
  documents?: Array<{
    id: string;
    docType: string;
    defenseStage: string | null;
    originalFilename: string | null;
    verifiedMimeType: string | null;
    sizeBytes: number | null;
  }>;
  publication: {
    isPublished: boolean;
    publishedAt: string | null;
  };
  artifact: RepositoryArtifactPolicyDto;
}

const ARTIFACT_POLICY: RepositoryArtifactPolicyDto = {
  available: false,
  policyResolved: false,
};

/** Comma-separated archive value -> trimmed, non-empty keyword array. */
function normalizeKeywords(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((keyword) => keyword.trim())
    .filter((keyword) => keyword.length > 0);
}

function displayName(
  user: { firstName: string; lastName: string } | null | undefined,
): string | null {
  if (!user) return null;
  const name = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();
  return name.length > 0 ? name : null;
}

function toPublicDto(
  row: PublishedEntryRow,
  caller?: CallerContext,
): RepositoryPublicationDto {
  const student = row.thesis?.student ?? null;
  const isOwner = Boolean(caller?.userId && student?.userId && caller.userId === student.userId);
  const isAdmin = caller?.role === "ADMIN";
  const isAuthenticated = Boolean(caller?.userId);

  // DL-10 & Data Privacy Act Rules:
  // 1. Unauthenticated users: Titles & abstracts only. No downloads. Raw paths stripped from payload.
  // 2. Authenticated members (students, panelists, admins): Can stream published manuscript.
  // 3. Raw respondent datasets: Strictly restricted to Admin and original researcher.
  const canDownloadManuscript = isAuthenticated && Boolean(row.fullPaperPath);
  const canDownloadRespondentData = (isAdmin || isOwner) && Boolean(row.respondentDataPath);

  return {
    id: row.id,
    title: row.title,
    author: displayName(student?.user),
    program: student?.program?.programName ?? null,
    abstract: row.abstract ?? null,
    keywords: normalizeKeywords(row.keywords),
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    hasManuscript: Boolean(row.fullPaperPath),
    hasRespondentData: Boolean(row.respondentDataPath),
    downloadUrl: canDownloadManuscript
      ? `/api/documents/elibrary-manuscript/${row.id}/file`
      : null,
    respondentDataUrl: canDownloadRespondentData
      ? `/api/documents/elibrary-respondent-data/${row.id}/file`
      : null,
    canDownloadManuscript,
    canDownloadRespondentData,
    artifact: { ...ARTIFACT_POLICY },
  };
}

function toAdminDto(row: AdminEntryRow): RepositoryAdminEntryDto {
  const student = row.thesis?.student ?? null;
  return {
    id: row.id,
    title: row.title,
    author: displayName(student?.user),
    studentNumber: student?.studentNumber ?? null,
    program: student?.program?.programName ?? null,
    abstract: row.abstract ?? null,
    keywords: normalizeKeywords(row.keywords),
    archiveRegisteredAt: row.createdAt.toISOString(),
    hasManuscript: Boolean(row.fullPaperPath),
    hasRespondentData: Boolean(row.respondentDataPath),
    documents: row.thesis?.thesisDocuments?.map((d) => ({
      id: d.id,
      docType: d.docType,
      defenseStage: d.defenseStage,
      originalFilename: d.originalFilename,
      verifiedMimeType: d.verifiedMimeType,
      sizeBytes: d.sizeBytes,
    })),
    publication: {
      isPublished: row.isPublic,
      publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    },
    artifact: { ...ARTIFACT_POLICY },
  };
}

export class RepositoryPublicationService {
  constructor(
    private readonly repo: RepositoryPublicationRepository =
      new RepositoryPublicationRepository(),
  ) {}

  /** Public list. Projects safe metadata, stripping download links for unauthenticated guests. */
  async listPublished(
    searchQuery?: string,
    caller?: CallerContext,
  ): Promise<RepositoryPublicationDto[]> {
    const rows = await this.repo.searchPublished(searchQuery);
    return rows.map((r) => toPublicDto(r, caller));
  }

  /** Public detail. Private/unknown ids both surface as 404. */
  async getPublished(
    id: string,
    caller?: CallerContext,
  ): Promise<RepositoryPublicationDto> {
    const row = await this.repo.findPublishedById(id);
    if (!row) {
      throw new AppError("Publication not found.", 404);
    }
    return toPublicDto(row, caller);
  }

  /** ADMIN publication queue. */
  async listAdminEntries(): Promise<RepositoryAdminEntryDto[]> {
    const rows = await this.repo.findAllForAdmin();
    return rows.map(toAdminDto);
  }

  /**
   * Admin publishes Repository metadata for a private archive. The actor MUST
   * come from the authenticated JWT; this method never trusts a body field.
   */
  async publishMetadata(
    id: string,
    adminId: string,
  ): Promise<RepositoryAdminEntryDto> {
    const state = await this.repo.getPublicationState(id);
    if (!state) {
      throw new AppError("Archive not found.", 404);
    }
    if (state.isPublic) {
      throw new AppError("Publication is already published.", 409);
    }

    const count = await this.repo.publishIfPrivate(id, adminId, new Date());
    if (count === 0) {
      // Lost a concurrent race: the row changed between probe and update.
      throw new AppError("Publication is already published.", 409);
    }

    const updated = await this.repo.findAdminById(id);
    if (!updated) {
      throw new AppError("Archive not found.", 404);
    }

    // Audit Log: REPOSITORY_ENTRY_PUBLISHED (NFR7 Compliance)
    await prisma.auditLog.create({
      data: {
        actorId: adminId,
        actionType: "REPOSITORY_ENTRY_PUBLISHED",
        targetTable: "e_library",
        targetId: id,
        description: `Admin published research entry "${updated.title}" to the public repository.`,
        newValue: JSON.stringify({
          id,
          title: updated.title,
          isPublic: true,
          publishedAt: updated.publishedAt,
        }),
      },
    });

    return toAdminDto(updated);
  }

  /**
   * Admin removes metadata from the public Repository. This does NOT delete or
   * mutate the private archive registration.
   */
  async unpublishMetadata(id: string, adminId?: string): Promise<RepositoryAdminEntryDto> {
    const state = await this.repo.getPublicationState(id);
    if (!state) {
      throw new AppError("Archive not found.", 404);
    }
    if (!state.isPublic) {
      throw new AppError("Publication is already private.", 409);
    }

    const count = await this.repo.unpublishIfPublic(id);
    if (count === 0) {
      throw new AppError("Publication is already private.", 409);
    }

    const updated = await this.repo.findAdminById(id);
    if (!updated) {
      throw new AppError("Archive not found.", 404);
    }

    // Audit Log: REPOSITORY_ENTRY_UNPUBLISHED (NFR7 Compliance)
    await prisma.auditLog.create({
      data: {
        actorId: adminId ?? null,
        actionType: "REPOSITORY_ENTRY_UNPUBLISHED",
        targetTable: "e_library",
        targetId: id,
        description: `Admin unpublished research entry "${updated.title}" from the public repository.`,
        newValue: JSON.stringify({
          id,
          title: updated.title,
          isPublic: false,
        }),
      },
    });

    return toAdminDto(updated);
  }

  /**
   * Admin updates metadata (title, abstract, keywords) to fix typos prior to or
   * after publication without deleting the entry.
   */
  async updateMetadata(
    id: string,
    adminId: string,
    input: {
      title?: string;
      abstract?: string | null;
      keywords?: string[] | string | null;
    },
  ): Promise<RepositoryAdminEntryDto> {
    const current = await this.repo.findAdminById(id);
    if (!current) {
      throw new AppError("Archive not found.", 404);
    }

    const title = input.title !== undefined ? input.title.trim() : undefined;
    if (title !== undefined && title.length === 0) {
      throw new AppError("Title cannot be empty.", 400);
    }

    const abstract = input.abstract !== undefined
      ? (typeof input.abstract === "string" ? input.abstract.trim() || null : null)
      : undefined;

    let keywords: string | null | undefined = undefined;
    if (input.keywords !== undefined) {
      if (Array.isArray(input.keywords)) {
        keywords = input.keywords.map((k) => k.trim()).filter((k) => k.length > 0).join(", ");
      } else if (typeof input.keywords === "string") {
        keywords = input.keywords.trim() || null;
      } else {
        keywords = null;
      }
    }

    const updated = await this.repo.updateMetadata(id, {
      title,
      abstract,
      keywords,
    });

    if (!updated) {
      throw new AppError("Archive not found.", 404);
    }

    // Audit Log: REPOSITORY_METADATA_UPDATED (NFR7 Compliance)
    await prisma.auditLog.create({
      data: {
        actorId: adminId,
        actionType: "REPOSITORY_METADATA_UPDATED",
        targetTable: "e_library",
        targetId: id,
        description: `Admin updated metadata for research entry "${updated.title}".`,
        oldValue: JSON.stringify({
          title: current.title,
          abstract: current.abstract,
          keywords: current.keywords,
        }),
        newValue: JSON.stringify({
          title: updated.title,
          abstract: updated.abstract,
          keywords: updated.keywords,
        }),
      },
    });

    return toAdminDto(updated);
  }
}
