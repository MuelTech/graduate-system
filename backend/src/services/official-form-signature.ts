import { AppError } from "../utils/AppError";
import type { PdfImageInput } from "../documents/official-defense/shared/pdf-layout";

/** Conservative scoped limit for one evaluator signature image. */
export const MAX_SIGNATURE_BYTES = 1024 * 1024;

const SIGNATURE_DATA_URL = /^data:(image\/png|image\/jpeg);base64,([A-Za-z0-9+/]+={0,2})$/;
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
function matchesMagic(bytes: Uint8Array, mimeType: "image/png" | "image/jpeg"): boolean {
  if (mimeType === "image/png") {
    return bytes.length >= PNG_MAGIC.length && PNG_MAGIC.every((byte, i) => bytes[i] === byte);
  }
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

/**
 * Decode the exact evaluator's stored signature evidence. The data URL prefix is
 * authoritative; unsupported MIME, malformed base64, mismatched image bytes,
 * missing evidence, and oversized payloads all fail closed.
 */
export function decodeOfficialFormSignature(
  signatureData: string | null | undefined,
): PdfImageInput {
  const evidence = typeof signatureData === "string" ? signatureData.trim() : "";
  if (!evidence) {
    throw new AppError(
      "The finalized evaluation has no required evaluator signature evidence.",
      409,
    );
  }

  const match = SIGNATURE_DATA_URL.exec(evidence);
  if (!match) {
    throw new AppError(
      "The evaluator signature evidence is malformed or uses an unsupported image type.",
      422,
    );
  }

  const mimeType = match[1] as "image/png" | "image/jpeg";
  const payload = match[2];
  if (!payload || payload.length % 4 !== 0) {
    throw new AppError(
      "The evaluator signature evidence contains invalid base64 data.",
      422,
    );
  }

  const bytes = Buffer.from(payload, "base64");
  if (bytes.length === 0) {
    throw new AppError(
      "The evaluator signature evidence contains invalid base64 data.",
      422,
    );
  }
  if (bytes.length > MAX_SIGNATURE_BYTES) {
    throw new AppError(
      `The evaluator signature evidence exceeds the ${MAX_SIGNATURE_BYTES}-byte official-form limit.`,
      413,
    );
  }
  if (!matchesMagic(bytes, mimeType)) {
    throw new AppError(
      "The evaluator signature image data does not match its declared image type.",
      422,
    );
  }

  return { bytes, mimeType };
}
