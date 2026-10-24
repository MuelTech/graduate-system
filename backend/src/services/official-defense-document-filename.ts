/**
 * FORM-INT-4 FIX-1 — canonical readable filenames for normal Admin official
 * document downloads. Authority for the student name and defense stage comes
 * from the exact server-side schedule context; this module only formats and
 * sanitizes already-authoritative values.
 */
import { AppError } from "../utils/AppError";

export type OfficialDefenseDocumentKind =
  | "application"
  | "evaluations"
  | "summary";

const STAGE_LABELS: Record<string, string> = {
  TITLE_DEFENSE: "Title-Defense",
  PROPOSAL_DEFENSE: "Proposal-Defense",
  FINAL_DEFENSE: "Final-Defense",
};

const KIND_LABELS: Record<OfficialDefenseDocumentKind, string> = {
  application: "Application",
  evaluations: "Individual-Evaluations",
  summary: "Oral-Examination-Summary",
};

const MAX_STUDENT_PART = 60;

export function defenseStageFilenameLabel(defenseType: string): string {
  const label = STAGE_LABELS[String(defenseType ?? "").toUpperCase()];
  if (!label) {
    throw new AppError(
      "The defense stage is not supported for official document filenames.",
      422,
    );
  }
  return label;
}

/**
 * ASCII-safe, file-system-safe part. Diacritics are normalized, unsafe runs
 * become single hyphens, traversal separators are removed, and an unusable name
 * falls back to a neutral readable token (never a UUID).
 */
export function sanitizeOfficialNamePart(
  name: string | null | undefined,
): string {
  const parts = String(name ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
  const bounded = parts.join("-").slice(0, MAX_STUDENT_PART).replace(/-+$/, "");
  return bounded || "Student";
}

export function officialDefenseDocumentFilename(
  studentName: string | null | undefined,
  defenseType: string,
  kind: OfficialDefenseDocumentKind,
): string {
  const stage = defenseStageFilenameLabel(defenseType);
  const student = sanitizeOfficialNamePart(studentName);
  const documentLabel = KIND_LABELS[kind];
  if (!documentLabel) {
    throw new AppError(
      "The official document type is not supported for filenames.",
      422,
    );
  }
  return `${student}-${stage}-${documentLabel}.pdf`;
}
