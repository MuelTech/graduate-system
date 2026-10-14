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

export interface RepositoryPublicationDto {
  id: string;
  title: string;
  author: string | null;
  program: string | null;
  abstract: string | null;
  keywords: string[];
  publishedAt: string | null;
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

function toPublicDto(row: PublishedEntryRow): RepositoryPublicationDto {
  const student = row.thesis?.student ?? null;
  return {
    id: row.id,
    title: row.title,
    author: displayName(student?.user),
    program: student?.program?.programName ?? null,
    abstract: row.abstract ?? null,
    keywords: normalizeKeywords(row.keywords),
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
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

  /** Public list. No caller identity is involved. */
  async listPublished(
    searchQuery?: string,
  ): Promise<RepositoryPublicationDto[]> {
    const rows = await this.repo.searchPublished(searchQuery);
    return rows.map(toPublicDto);
  }

  /** Public detail. Private/unknown ids both surface as 404. */
  async getPublished(id: string): Promise<RepositoryPublicationDto> {
    const row = await this.repo.findPublishedById(id);
    if (!row) {
      throw new AppError("Publication not found.", 404);
    }
    return toPublicDto(row);
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
    return toAdminDto(updated);
  }

  /**
   * Admin removes metadata from the public Repository. This does NOT delete or
   * mutate the private archive registration.
   */
  async unpublishMetadata(id: string): Promise<RepositoryAdminEntryDto> {
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
    return toAdminDto(updated);
  }
}
