/**
 * CDW-8B — backend origin normalization for the Socket.IO client.
 *
 * The REST client appends `/api` itself, so the realtime URL must be the bare
 * backend origin. Trailing slashes and an accidentally supplied trailing `/api`
 * are removed; `/api` is never appended.
 */
export const DEFAULT_DEFENSE_BACKEND_URL = "http://localhost:5000";

export function normalizeDefenseRealtimeBaseUrl(
  raw: string | null | undefined,
): string {
  const trimmed = (raw ?? "").trim();
  const base = trimmed.length > 0 ? trimmed : DEFAULT_DEFENSE_BACKEND_URL;

  return base
    .replace(/\/+$/, "")
    .replace(/\/api$/i, "")
    .replace(/\/+$/, "");
}
