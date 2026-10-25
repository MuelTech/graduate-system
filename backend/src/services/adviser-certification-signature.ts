import { AppError } from "../utils/AppError";
import { validateOfficialFormSignatureImage } from "./official-form-signature-image";
import type { PdfImageInput } from "../documents/official-defense/shared/pdf-layout";

/** Reuse official-form evidence validation; also verify that the image is usable. */
export async function validateAdviserCertificationSignature(value: string | null | undefined): Promise<PdfImageInput> {
  try {
    return await validateOfficialFormSignatureImage(value);
  } catch (error) {
    throw new AppError("The Adviser signature evidence is missing, invalid, or unsupported for GS-017.",
      error instanceof AppError ? error.statusCode : 422);
  }
}
