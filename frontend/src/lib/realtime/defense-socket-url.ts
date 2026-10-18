/**
 * CDW-8B / DEV-NET-1 — backend origin normalization for the Socket.IO client.
 *
 * REST and Socket.IO share the same pure normalization rules. The live socket
 * client resolves through the shared client backend-origin module; this helper
 * remains for compatibility and focused normalization tests.
 */
import {
  DEV_BACKEND_FALLBACK,
  normalizeBackendBaseUrl,
} from "../backend-origin.shared.ts";

export const DEFAULT_DEFENSE_BACKEND_URL = DEV_BACKEND_FALLBACK;

export function normalizeDefenseRealtimeBaseUrl(
  raw: string | null | undefined,
): string {
  return normalizeBackendBaseUrl(raw) || DEFAULT_DEFENSE_BACKEND_URL;
}
