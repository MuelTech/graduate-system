import type {
  CorExtractionSuggestions,
  CorStudentNameSuggestion,
} from "./cor-extraction.types";

/**
 * COR-1: deterministic EARIST Certificate of Registration parser.
 *
 * This module is a pure function of normalized extracted text. It maps the
 * first supported EARIST COR layout (`SURNAME, FIRST NAME MIDDLE NAME/INITIAL`)
 * into bounded, typed Admin review suggestions.
 *
 * Authority: extraction is assistive only. The returned suggestions are never
 * authoritative profile data and never verify a COR or promote an Applicant.
 * Admin confirmation remains the sole promotion authority (later packages).
 *
 * v1 scope (see DOCUMENT_LIFECYCLE_SOURCE_OF_TRUTH.md §4.1):
 *   Student Number, Registration Number, Student Name (raw + components),
 *   Program, College, Email Address.
 * Academic Year, Semester, Curriculum Year, residency, subject rows, fees,
 * payments, receipts and signatures are deliberately NOT parsed.
 */

export const EARIST_COR_PARSER_VERSION = "earist-cor-parser@1";

/**
 * The real EARIST COR PDF text layer is overprinted: each text run is emitted
 * twice adjacently, e.g. `Registration No :Registration No : 1234567890...`.
 * When that shape is detected, adjacent duplicated runs are collapsed before
 * parsing so labels and values are single. Clean (non-overprinted) text is
 * parsed unchanged.
 */
const OVERPRINT_SIGNAL =
  /(?:Program\s*Program|College\s*College|Student\s*No\s*Student\s*No|Registration\s*No\s*Registration\s*No|Email\s*Address\s*Email\s*Address|Name\s*Name)/i;

/** Bounds for the adjacent-tandem scan; COR text runs are short. */
const MAX_TANDEM_LENGTH = 80;
const MIN_TANDEM_LENGTH = 2;

function collapseLineOverprint(line: string): string {
  let out = "";
  let index = 0;

  while (index < line.length) {
    const maxLength = Math.min(
      MAX_TANDEM_LENGTH,
      Math.floor((line.length - index) / 2),
    );
    let collapsed = false;

    for (let length = maxLength; length >= MIN_TANDEM_LENGTH; length -= 1) {
      const run = line.slice(index, index + length);
      if (line.startsWith(run, index + length)) {
        out += run;
        index += length * 2;
        collapsed = true;
        break;
      }
    }

    if (!collapsed) {
      out += line[index];
      index += 1;
    }
  }

  return out;
}

/** Collapses the COR overprint duplication when present; otherwise no-op. */
export function collapseOverprintText(text: string): string {
  if (!OVERPRINT_SIGNAL.test(text)) return text;
  return text
    .split("\n")
    .map(collapseLineOverprint)
    .join("\n");
}

/** Whitespace-normalizes text into a single bounded line. */
function normalizeCorText(text: string | null | undefined): string {
  return String(text ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Boundary that ends a free-text value at the next supported/known COR label.
 * Requires leading whitespace so a label word is never matched inside a value
 * (e.g. "age" inside "Management").
 */
const NEXT_LABEL =
  String.raw`\s+(?:Registration\s*No|Student\s*No|Name|Program|College|Gender|Major|Curriculum|Age|Year\s*Level|Scholarship(?:\/Discount)?|Email\s*Address)\b`;

const REGISTRATION_NUMBER_RE =
  /(?<![A-Za-z])Registration\s*No[:\s]*([A-Za-z0-9][A-Za-z0-9-]*)/i;
const STUDENT_NUMBER_RE =
  /(?<![A-Za-z])Student\s*No[:\s]*([A-Za-z0-9][A-Za-z0-9-]*)/i;
const EMAIL_RE =
  /(?<![A-Za-z])Email\s*Address[:\s]*([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/i;
const NAME_RE = new RegExp(
  String.raw`(?<![A-Za-z])Name[:\s]*(.+?)(?=${NEXT_LABEL}|$)`,
  "i",
);
const PROGRAM_RE = new RegExp(
  String.raw`(?<![A-Za-z])Program[:\s]*(.+?)(?=${NEXT_LABEL}|$)`,
  "i",
);
const COLLEGE_RE = new RegExp(
  String.raw`(?<![A-Za-z])College[:\s]*(.+?)(?=${NEXT_LABEL}|$)`,
  "i",
);

function firstCapturedValue(text: string, pattern: RegExp): string | null {
  const match = pattern.exec(text);
  const value = match?.[1]?.trim();
  return value ? value : null;
}

/**
 * Parses the COR name into components using the comma as the primary supported
 * surname boundary. Ambiguous names keep the raw value and leave components
 * null rather than guessing.
 */
function parseStudentName(raw: string | null): CorStudentNameSuggestion | null {
  if (!raw) return null;

  const cleaned = raw.replace(/\s+/g, " ").trim();
  if (!cleaned) return null;

  const commaCount = (cleaned.match(/,/g) ?? []).length;
  if (commaCount !== 1) {
    return {
      raw: cleaned,
      surname: null,
      firstName: null,
      middleNameOrInitial: null,
    };
  }

  const [surnamePart, remainderPart] = cleaned.split(",");
  const surname = surnamePart.trim() || null;
  const remainder = remainderPart.trim();

  if (!remainder) {
    return {
      raw: cleaned,
      surname,
      firstName: null,
      middleNameOrInitial: null,
    };
  }

  const parts = remainder.split(/\s+/).filter(Boolean);
  const firstName = parts[0] ?? null;
  const middleNameOrInitial =
    parts.length > 1 ? parts.slice(1).join(" ") : null;

  return { raw: cleaned, surname, firstName, middleNameOrInitial };
}

function emptySuggestions(): CorExtractionSuggestions {
  return {
    studentNumber: null,
    registrationNumber: null,
    studentName: null,
    program: null,
    college: null,
    emailAddress: null,
  };
}

/**
 * Deterministic EARIST COR parser entry point. Tolerates missing/ambiguous
 * fields and returns partial suggestions instead of throwing for ordinary
 * layout variance.
 */
export function parseEaristCorText(
  text: string | null | undefined,
): CorExtractionSuggestions {
  const normalized = normalizeCorText(collapseOverprintText(String(text ?? "")));
  if (!normalized) return emptySuggestions();

  return {
    studentNumber: firstCapturedValue(normalized, STUDENT_NUMBER_RE),
    registrationNumber: firstCapturedValue(normalized, REGISTRATION_NUMBER_RE),
    studentName: parseStudentName(firstCapturedValue(normalized, NAME_RE)),
    program: firstCapturedValue(normalized, PROGRAM_RE),
    college: firstCapturedValue(normalized, COLLEGE_RE),
    emailAddress: firstCapturedValue(normalized, EMAIL_RE),
  };
}

/** Object wrapper so the parser carries an explicit version identifier. */
export class EaristCorParser {
  get version(): string {
    return EARIST_COR_PARSER_VERSION;
  }

  parse(text: string | null | undefined): CorExtractionSuggestions {
    return parseEaristCorText(text);
  }
}
