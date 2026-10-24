import { PDFDocument } from "pdf-lib";
import { AppError } from "../utils/AppError";
import { decodeOfficialFormSignature } from "./official-form-signature";
import type { PdfImageInput } from "../documents/official-defense/shared/pdf-layout";

/** Reuse official-form evidence validation; also verify that the image is usable. */
export async function validateAdviserCertificationSignature(value: string | null | undefined): Promise<PdfImageInput> {
  try {
    const image = decodeOfficialFormSignature(value);
    if (image.mimeType === "image/png") {
      const bytes = Buffer.from(image.bytes);
      if (bytes.length < 24 || bytes.readUInt32BE(16) > 4096 || bytes.readUInt32BE(20) > 4096
        || bytes.readUInt32BE(16) * bytes.readUInt32BE(20) > 4_000_000) {
        throw new AppError("Signature image dimensions exceed the official-form limit.", 422);
      }
    }
    const doc = await PDFDocument.create();
    const embedded = image.mimeType === "image/png" ? await doc.embedPng(image.bytes) : await doc.embedJpg(image.bytes);
    if (embedded.width <= 0 || embedded.height <= 0 || embedded.width > 4096 || embedded.height > 4096
      || embedded.width * embedded.height > 4_000_000) throw new AppError("Invalid signature image dimensions.", 422);
    return image;
  } catch (error) {
    throw new AppError("The Adviser signature evidence is missing, invalid, or unsupported for GS-017.",
      error instanceof AppError ? error.statusCode : 422);
  }
}
