export const PH_MOBILE_REGEX = /^\+639\d{9}$/;

/**
 * Extracts up to 10 digits after the Philippine `+63` country code,
 * handling pasted `+639...`, `639...`, or `09...` formats cleanly.
 */
export function extractPhilippineMobileSuffix(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("63") && digits.length > 2) {
    digits = digits.slice(2);
  }
  if (digits.startsWith("0")) {
    digits = digits.slice(1);
  }
  return digits.slice(0, 10);
}

/**
 * Normalizes user input into a canonical `+63XXXXXXXXXX` value (or `""` when empty).
 */
export function toPhilippineMobileValue(raw: string): string {
  const suffix = extractPhilippineMobileSuffix(raw);
  return suffix ? `+63${suffix}` : "";
}
