/**
 * Parse the configured frontend origin(s) for REST CORS and Socket.IO.
 *
 * A single origin keeps the existing production behavior. Comma-separated
 * origins are useful in development when the app is opened from both localhost
 * and a LAN address (for example a phone on the same network).
 */
export function parseCorsOrigins(
  value: string | null | undefined,
  fallback = "http://localhost:3000",
): string[] {
  const origins = String(value ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  return origins.length > 0 ? origins : [fallback];
}
