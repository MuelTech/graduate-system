import { PDFDocument } from "pdf-lib";
import { AppError } from "../utils/AppError";
import { decodeOfficialFormSignature } from "./official-form-signature";

/** Shared image validation only; callers supply their own workflow error context. */
export async function validateOfficialFormSignatureImage(value: string | null | undefined) {
  const image = decodeOfficialFormSignature(value);
  // pdf-lib's JPEG reader needs a view starting at byte zero, including for pooled Node Buffers.
  const validated = image.mimeType === "image/jpeg" ? { ...image, bytes: Uint8Array.from(image.bytes) } : image;
  if (image.mimeType === "image/png") {
    const bytes = Buffer.from(image.bytes);
    if (bytes.length < 24 || bytes.readUInt32BE(16) > 4096 || bytes.readUInt32BE(20) > 4096
      || bytes.readUInt32BE(16) * bytes.readUInt32BE(20) > 4_000_000) {
      throw new AppError("Signature image dimensions exceed the official-form limit.", 422);
    }
  }
  const doc = await PDFDocument.create();
  const embedded = image.mimeType === "image/png" ? await doc.embedPng(validated.bytes) : await doc.embedJpg(validated.bytes);
  if (embedded.width <= 0 || embedded.height <= 0 || embedded.width > 4096 || embedded.height > 4096
    || embedded.width * embedded.height > 4_000_000) throw new AppError("Invalid signature image dimensions.", 422);
  return validated;
}
