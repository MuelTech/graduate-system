import { AppError } from "./AppError";

export const PH_MOBILE_REGEX = /^(?:\+639|09)\d{9}$/;

/**
 * Validates a Philippine mobile number (`+639XXXXXXXXX` or `09XXXXXXXXX`).
 * Trims surrounding whitespace and throws a 400 AppError if invalid.
 */
export function validatePhilippineMobile(raw: unknown): string {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) {
    throw new AppError("Cellphone number is required.", 400);
  }
  if (!PH_MOBILE_REGEX.test(value)) {
    throw new AppError(
      "Invalid cellphone number. Please provide a valid Philippine mobile number (e.g., +639171234567).",
      400,
    );
  }
  return value;
}
