/**
 * DEV-NET-1 — pure backend-origin normalization shared by client and server.
 *
 * This module intentionally reads no environment variables and touches no
 * browser globals so the same rules cannot drift between REST, Socket.IO, and
 * server-side callers.
 */

export const DEFAULT_BACKEND_PORT = 5000;
export const DEV_BACKEND_FALLBACK = `http://localhost:${DEFAULT_BACKEND_PORT}`;

/**
 * Normalize a configured backend origin. The app appends `/api` and `/api/...`
 * itself, so trailing slashes and an accidental trailing `/api` are removed.
 */
export function normalizeBackendBaseUrl(
  raw: string | null | undefined,
): string {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return "";

  return trimmed
    .replace(/\/+$/, "")
    .replace(/\/api$/i, "")
    .replace(/\/+$/, "");
}

/** Format a hostname for use in an HTTP origin, including IPv6 brackets. */
export function formatHostForUrl(hostname: string): string {
  const host = hostname.trim();
  if (!host) return "";
  if (host.startsWith("[") && host.endsWith("]")) return host;
  if (host.includes(":")) return `[${host}]`;
  return host;
}

/**
 * Development fallback: follow the host through which the frontend was opened.
 * The backend port remains the existing project development port.
 */
export function buildDevelopmentBackendUrl(hostname: string): string {
  const host = formatHostForUrl(hostname);
  return host ? `http://${host}:${DEFAULT_BACKEND_PORT}` : DEV_BACKEND_FALLBACK;
}
