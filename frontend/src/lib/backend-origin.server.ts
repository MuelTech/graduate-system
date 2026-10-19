/**
 * DEV-NET-1 — server-only backend-origin resolution.
 *
 * Explicit BACKEND_API_URL always wins. Development may fall back to loopback;
 * production requires explicit configuration and never infers from a browser.
 *
 * This module must never read NEXT_PUBLIC_BACKEND_API_URL.
 */
import {
  DEV_BACKEND_FALLBACK,
  normalizeBackendBaseUrl,
} from "./backend-origin.shared.ts";

export interface ServerBackendOriginOptions {
  /** Test/injection seam; defaults to BACKEND_API_URL. */
  configuredUrl?: string | null;
  /** Defaults to NODE_ENV === "production". */
  isProduction?: boolean;
}

export function resolveServerBackendBaseUrl(
  options: ServerBackendOriginOptions = {},
): string {
  const configuredUrl =
    options.configuredUrl !== undefined
      ? options.configuredUrl
      : process.env.BACKEND_API_URL;
  const explicit = normalizeBackendBaseUrl(configuredUrl);
  if (explicit) return explicit;

  const isProduction =
    options.isProduction ?? process.env.NODE_ENV === "production";
  if (isProduction) {
    throw new Error("BACKEND_API_URL must be configured in production.");
  }

  return DEV_BACKEND_FALLBACK;
}

/** Runtime entry point for server components, auth, and proxy routes. */
export function getServerBackendBaseUrl(): string {
  return resolveServerBackendBaseUrl();
}
