/**
 * FORM-INT-4 — authenticated official-defense PDF retrieval.
 *
 * Browser-only helper. It obtains the NextAuth access token, calls the existing
 * Admin-only backend PDF endpoints with a Bearer header, validates that the
 * response is a real PDF, and hands the bytes to a temporary download. Tokens
 * never appear in URLs, and object URLs are revoked immediately after use.
 *
 * The module deliberately has no top-level relative imports so it can be
 * exercised by the repository's Node verifier with injected dependencies.
 */

export class OfficialDocumentError extends Error {
  statusCode?: number;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = "OfficialDocumentError";
    this.statusCode = statusCode;
  }
}

export interface PdfSaveEnvironment {
  createObjectURL?: (blob: Blob) => string;
  revokeObjectURL?: (url: string) => void;
  document?: {
    createElement(tagName: "a"): HTMLAnchorElement;
    body: { appendChild(node: Node): void };
  };
}

export interface OfficialPdfDeps {
  /** Test seam; defaults to the current NextAuth session. */
  getToken?: () => Promise<string | null>;
  /** Test seam; defaults to the shared client backend origin resolver. */
  backendBaseUrl?: () => string;
  fetchImpl?: typeof fetch;
  saveEnv?: PdfSaveEnvironment;
}

export interface OfficialPdfResult {
  blob: Blob;
  filename: string;
}

const DEFAULT_FILENAME = "official-defense-document.pdf";
const MAX_FILENAME_STEM = 100;

function assertRelativeApiPath(path: string): void {
  if (
    typeof path !== "string" ||
    !path.startsWith("/") ||
    path.startsWith("//") ||
    path.includes("?") ||
    path.includes("#")
  ) {
    throw new OfficialDocumentError("Invalid official document path.");
  }
}

/** Keep a header-derived filename path-safe and printable. */
export function sanitizePdfFilename(name: string | null): string | null {
  if (!name) return null;
  const base = name.split(/[\\/]/).pop() ?? "";
  const stem = base.replace(/\.pdf$/i, "");
  const cleaned = stem
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[.\-]+/, "")
    .replace(/[.\-]+$/, "");
  if (!cleaned) return null;
  return `${cleaned.slice(0, MAX_FILENAME_STEM)}.pdf`;
}

export function parsePdfFilename(header: string | null): string | null {
  if (!header) return null;
  const utf8 = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(header);
  const plain = /filename\s*=\s*"?([^";]+)"?/i.exec(header);
  const raw = utf8?.[1] ?? plain?.[1] ?? null;
  if (!raw) return null;
  let decoded = raw.trim();
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    // Keep the raw value; sanitization below neutralizes unsafe characters.
  }
  return sanitizePdfFilename(decoded);
}

async function resolveAccessToken(deps: OfficialPdfDeps): Promise<string | null> {
  if (deps.getToken) return deps.getToken();
  const { getSession } = await import("next-auth/react");
  const session = await getSession();
  return session?.user?.accessToken ?? null;
}

async function resolveBackendBaseUrl(deps: OfficialPdfDeps): Promise<string> {
  if (deps.backendBaseUrl) return deps.backendBaseUrl();
  const { getClientBackendBaseUrl } = await import("./backend-origin.client");
  return getClientBackendBaseUrl();
}

async function readBackendError(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { error?: unknown } | null;
    if (typeof data?.error === "string" && data.error.trim()) {
      return data.error;
    }
  } catch {
    // Non-JSON error body: use the generic fallback below.
  }
  return `Official document request failed (${response.status}).`;
}

async function readPdfBlob(response: Response): Promise<Blob> {
  const contentType = (response.headers.get("Content-Type") ?? "").toLowerCase();
  if (!contentType.includes("application/pdf")) {
    throw new OfficialDocumentError(
      "The server did not return a PDF document.",
      response.status,
    );
  }
  const blob = await response.blob();
  if (blob.size === 0) {
    throw new OfficialDocumentError(
      "The server returned an empty PDF document.",
      response.status,
    );
  }
  const head = new Uint8Array(await blob.slice(0, 5).arrayBuffer());
  const signature = String.fromCharCode(...head);
  if (signature !== "%PDF-") {
    throw new OfficialDocumentError(
      "The server returned an invalid PDF document.",
      response.status,
    );
  }
  return blob;
}

/**
 * Fetch one official PDF with the current authenticated session.
 * The endpoint path must be relative to the backend `/api` root.
 */
export async function fetchOfficialDefensePdf(
  path: string,
  fallbackFilename: string,
  deps: OfficialPdfDeps = {},
): Promise<OfficialPdfResult> {
  assertRelativeApiPath(path);

  const token = await resolveAccessToken(deps);
  if (!token) {
    throw new OfficialDocumentError(
      "Your session has expired. Please log in again.",
      401,
    );
  }

  const base = (await resolveBackendBaseUrl(deps)).replace(/\/+$/, "");
  const fetchImpl = deps.fetchImpl ?? fetch;
  const response = await fetchImpl(`${base}/api${path}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new OfficialDocumentError(
      await readBackendError(response),
      response.status,
    );
  }

  const blob = await readPdfBlob(response);
  const filename =
    parsePdfFilename(response.headers.get("Content-Disposition")) ??
    sanitizePdfFilename(fallbackFilename) ??
    DEFAULT_FILENAME;

  return { blob, filename };
}

/** Trigger a temporary browser download and always revoke the object URL. */
export function savePdfBlob(
  blob: Blob,
  filename: string,
  env: PdfSaveEnvironment = {},
): void {
  const createUrl = env.createObjectURL ?? URL.createObjectURL.bind(URL);
  const revokeUrl = env.revokeObjectURL ?? URL.revokeObjectURL.bind(URL);
  const doc: PdfSaveEnvironment["document"] =
    env.document ?? (typeof document !== "undefined" ? document : undefined);
  if (!doc) {
    throw new OfficialDocumentError(
      "Downloads are not available in this environment.",
    );
  }

  const objectUrl = createUrl(blob);
  try {
    const anchor = doc.createElement("a");
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.rel = "noopener";
    anchor.style.display = "none";
    doc.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    revokeUrl(objectUrl);
  }
}

/** Fetch and download one official PDF for the Admin user. */
export async function downloadOfficialDefensePdf(
  path: string,
  fallbackFilename: string,
  deps: OfficialPdfDeps = {},
): Promise<void> {
  const { blob, filename } = await fetchOfficialDefensePdf(
    path,
    fallbackFilename,
    deps,
  );
  savePdfBlob(blob, filename, deps.saveEnv);
}
