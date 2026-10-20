import { DEFENSE_TYPE_TO_DOCUMENT_STAGE } from "./defense-history.rules";

/**
 * ADV-5 — the ONLY thesis documents an active Adviser may read merely by
 * current active-Adviser authority. Supporting/administrative evidence is
 * explicitly excluded.
 */
export type AdviserAcademicDocumentStage = "TITLE" | "PROPOSAL" | "FINAL";

export type AdviserAcademicDocumentKind =
  | "TITLE_PROPOSAL_PACKAGE"
  | "PROPOSAL_MANUSCRIPT"
  | "FINAL_MANUSCRIPT";

interface AcademicDocumentIdentity {
  stage: AdviserAcademicDocumentStage;
  kind: AdviserAcademicDocumentKind;
}

const ACADEMIC_DOCUMENT_IDENTITY: Record<string, AcademicDocumentIdentity> = {
  TITLE_PROPOSAL: {
    stage: "TITLE",
    kind: "TITLE_PROPOSAL_PACKAGE",
  },
  PROPOSAL_CHAPTERS: {
    stage: "PROPOSAL",
    kind: "PROPOSAL_MANUSCRIPT",
  },
  FINAL_MANUSCRIPT: {
    stage: "FINAL",
    kind: "FINAL_MANUSCRIPT",
  },
};

export const ADVISER_ACADEMIC_DOC_TYPES = Object.freeze(
  Object.keys(ACADEMIC_DOCUMENT_IDENTITY),
);

/**
 * Resolve one document's academic identity. An explicit defenseStage must
 * agree with the docType; contradictory or ambiguous rows fail closed.
 * A legacy null stage may be inferred only from a known academic docType.
 */
export function resolveAdviserAcademicDocument(input: {
  docType?: string | null;
  defenseStage?: string | null;
}): AcademicDocumentIdentity | null {
  const identity = ACADEMIC_DOCUMENT_IDENTITY[String(input.docType ?? "")];
  if (!identity) return null;
  const stage = input.defenseStage ?? null;
  if (stage !== null && stage !== identity.stage) return null;
  return identity;
}

/**
 * Narrow active-Adviser document authority. Exactly one active Adviser row is
 * allowed, and it must be the caller. Duplicate/inconsistent relationship data
 * fails closed.
 */
export function canActiveAdviserAccessAcademicThesisDocument(input: {
  userId: string;
  activeAdviserIds: readonly string[];
  docType?: string | null;
  defenseStage?: string | null;
}): boolean {
  if (input.activeAdviserIds.length !== 1) return false;
  if (input.activeAdviserIds[0] !== input.userId) return false;
  return (
    resolveAdviserAcademicDocument({
      docType: input.docType,
      defenseStage: input.defenseStage,
    }) !== null
  );
}

/**
 * Exact attempt-bound manuscript identity for Adviser defense history.
 * The schedule's own manuscriptDocumentId is the only authority; the document
 * must belong to the same thesis, use the stage's academic type, and agree with
 * the attempt's defense type.
 */
export function resolveAdviserBoundAcademicManuscript(input: {
  thesisId: string;
  defenseType: string;
  manuscriptDocumentId?: string | null;
  document?: {
    id: string;
    thesisId: string;
    docType?: string | null;
    defenseStage?: string | null;
  } | null;
}): AcademicDocumentIdentity | null {
  const expectedStage = DEFENSE_TYPE_TO_DOCUMENT_STAGE[input.defenseType] ?? null;
  if (!expectedStage) return null;
  if (!input.manuscriptDocumentId) return null;
  const document = input.document ?? null;
  if (!document) return null;
  if (document.id !== input.manuscriptDocumentId) return null;
  if (document.thesisId !== input.thesisId) return null;

  const identity = resolveAdviserAcademicDocument({
    docType: document.docType,
    defenseStage: document.defenseStage,
  });
  if (!identity || identity.stage !== expectedStage) return null;
  return identity;
}
