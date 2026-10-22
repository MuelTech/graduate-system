import { PDFDocument, PDFImage, PDFPage, PageSizes } from "pdf-lib";

export const A4 = { width: PageSizes.A4[0], height: PageSizes.A4[1] } as const;

export interface PdfImageInput {
  readonly bytes: Uint8Array;
  readonly mimeType: "image/jpeg" | "image/png";
}

export interface PdfBox {
  readonly x: number;
  /** Distance from the top of the page, in PDF points. */
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export function rule(page: PDFPage, x1: number, top: number, x2: number, thickness = 0.5): void {
  page.drawLine({
    start: { x: x1, y: page.getHeight() - top },
    end: { x: x2, y: page.getHeight() - top },
    thickness,
  });
}

/** Preserve aspect ratio; center inside the box. No fetching or file access. */
export async function drawContainedImage(
  doc: PDFDocument,
  page: PDFPage,
  input: PdfImageInput,
  box: PdfBox,
): Promise<void> {
  let image: PDFImage;
  if (input.mimeType === "image/png") image = await doc.embedPng(input.bytes);
  else if (input.mimeType === "image/jpeg") image = await doc.embedJpg(input.bytes);
  else throw new TypeError("Official-form images must be PNG or JPEG.");
  const scale = Math.min(box.width / image.width, box.height / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  page.drawImage(image, {
    x: box.x + (box.width - width) / 2,
    y: page.getHeight() - box.top - (box.height + height) / 2,
    width,
    height,
  });
}
