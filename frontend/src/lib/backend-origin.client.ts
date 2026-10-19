/**
 * DEV-NET-1 — browser-only backend-origin resolution.
 *
 * Explicit NEXT_PUBLIC_BACKEND_API_URL always wins. In development, an unset
 * override follows the hostname through which the frontend was opened. In
 * production, the explicit value is mandatory; hostname inference is forbidden.
 *
 * This module must never read server-only BACKEND_API_URL.
 */
import {
  DEV_BACKEND_FALLBACK,
  buildDevelopmentBackendUrl,
  normalizeBackendBaseUrl,
} from "./backend-origin.shared.ts";

export interface ClientBackendOriginOptions {
  /** Test/injection seam; defaults to NEXT_PUBLIC_BACKEND_API_URL. */
  configuredUrl?: string | null;
  /** Test/injection seam; defaults to window.location.hostname when available. */
  hostname?: string | null;
  /** Defaults to NODE_ENV === "production". */
  isProduction?: boolean;
  /** Test/injection seam for SSR/no-window behavior. */
  hasWindow?: boolean;
}

export function resolveClientBackendBaseUrl(
  options: ClientBackendOriginOptions = {},
): string {
  const configuredUrl =
    options.configuredUrl !== undefined
      ? options.configuredUrl
      : process.env.NEXT_PUBLIC_BACKEND_API_URL;
  const explicit = normalizeBackendBaseUrl(configuredUrl);
  if (explicit) return explicit;

  const isProduction =
    options.isProduction ?? process.env.NODE_ENV === "production";
  if (isProduction) {
    throw new Error(
      "NEXT_PUBLIC_BACKEND_API_URL must be configured in production.",
    );
  }

  if (options.hostname) {
    return buildDevelopmentBackendUrl(options.hostname);
  }

  const hasWindow = options.hasWindow ?? typeof window !== "undefined";
  if (hasWindow && typeof window !== "undefined") {
    const hostname = window.location?.hostname;
    if (hostname) return buildDevelopmentBackendUrl(hostname);
  }

  return DEV_BACKEND_FALLBACK;
}

/** Production runtime entry point for browser code. */
export function getClientBackendBaseUrl(): string {
  return resolveClientBackendBaseUrl();
}
