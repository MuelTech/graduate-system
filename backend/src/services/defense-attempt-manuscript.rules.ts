/**
 * CDW-2 correction — authoritative attempt-manuscript selection.
 *
 * ONE shared rule for "which exact ThesisDocument is the manuscript evidence for
 * this defense attempt", used by scheduling (to bind DefenseSchedule), by the
 * workspace read model (to return the bound document), and by collaboration
 * live-write authorization. Centralizing this avoids conflicting authorities.
 *
 * Rules:
 *  - TITLE_DEFENSE  → the newest Title Proposal package (TITLE_PROPOSAL, stage
 *                     TITLE or legacy null);
 *  - PROPOSAL_DEFENSE → the exact ISSUED AdviserCertification.reviewedDocumentId;
 *  - FINAL_DEFENSE  → the exact ISSUED AdviserCertification.reviewedDocumentId.
 * Fails closed (null) when the authoritative document cannot be proven.
 */

import {
  selectCertifiedFinalManuscript,
  selectCertifiedProposalManuscript,
} from "./proposal-adviser-review.rules";

export interface AttemptManuscriptDoc {
  id: string;
  thesisId?: string | null;
  docType: string;
  defenseStage: string | null;
  /**
   * DL-6 version chain head flag. The authoritative Title package must be the
   * CURRENT version (`isCurrent === true`); a superseded tail is never bound even
   * when its uploadedAt is newer.
   */
  isCurrent?: boolean | null;
  uploadedAt?: Date | string | null;
}

export interface AttemptCertification {
  status: string;
  defenseStage: string;
  reviewedDocumentId?: string | null;
}

/** Stage + manuscript doc types per defense type (cross-stage injection guard). */
export const ATTEMPT_STAGE_DOC_BINDING: Record<
  string,
  { stage: string; docTypes: readonly string[] }
> = {
  TITLE_DEFENSE: { stage: "TITLE", docTypes: ["TITLE_PROPOSAL"] },
  PROPOSAL_DEFENSE: { stage: "PROPOSAL", docTypes: ["PROPOSAL_CHAPTERS"] },
  FINAL_DEFENSE: { stage: "FINAL", docTypes: ["FINAL_MANUSCRIPT"] },
};

function toTime(value: Date | string | null | undefined): number {
  if (!value) return 0;
  const time = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(time) ? time : 0;
}

export function selectAuthoritativeAttemptManuscript<T extends AttemptManuscriptDoc>(
  docs: T[],
  certs: AttemptCertification[],
  defenseType: string,
  thesisId: string,
): T | null {
  if (defenseType === "TITLE_DEFENSE") {
    // Authoritative Title authority = the CURRENT (isCurrent === true) Title
    // Proposal package. A superseded row is never bound merely because its
    // uploadedAt is newer. Among current rows (inconsistent data), pick the
    // newest deterministically with an id tie-break; never fail to a stale row.
    const candidates = docs
      .filter(
        (d) =>
          d.docType === "TITLE_PROPOSAL" &&
          (d.defenseStage === "TITLE" || d.defenseStage == null) &&
          d.isCurrent === true,
      )
      .sort((a, b) => {
        const byTime = toTime(b.uploadedAt) - toTime(a.uploadedAt);
        if (byTime !== 0) return byTime;
        return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
      });
    return candidates[0] ?? null;
  }

  if (defenseType !== "PROPOSAL_DEFENSE" && defenseType !== "FINAL_DEFENSE") {
    return null;
  }

  const cert =
    certs.find((c) => c.defenseStage === defenseType && c.status === "ISSUED") ?? null;
  const like = docs.map((d) => ({
    id: d.id,
    thesisId: d.thesisId ?? thesisId,
    docType: d.docType,
    defenseStage: d.defenseStage,
  }));
  const certified =
    defenseType === "PROPOSAL_DEFENSE"
      ? selectCertifiedProposalManuscript(like, cert, thesisId)
      : selectCertifiedFinalManuscript(like, cert, thesisId);

  if (!certified) return null;
  return docs.find((d) => d.id === certified.id) ?? null;
}
