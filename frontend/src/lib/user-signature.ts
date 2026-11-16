import { apiClientRequest } from "./api.client";

export type SignatureCaptureMethod = "DRAW" | "UPLOAD";

export type BackgroundCleanupStrength = "light" | "standard" | "strong";

export interface NormalizeSignatureOptions {
  removeBackground?: boolean;
  strength?: BackgroundCleanupStrength;
}

export interface SignatureImageBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  hasInk: boolean;
}

export interface UserSignatureVaultDto {
  hasSignature: boolean;
  signatureData: string | null;
  method: SignatureCaptureMethod | null;
  version: number;
  updatedAt: string | null;
}

export const MY_SIGNATURE_VAULT_QUERY_KEY = ["mySignatureVault"] as const;
export const SIGNATURE_ONBOARDING_SKIP_STORAGE_KEY =
  "gsis_skip_signature_onboarding";

export const MAX_SIGNATURE_UPLOAD_BYTES = 1024 * 1024;
const MAX_WORKING_DIMENSION = 1440;

export async function fetchMySignatureVault(): Promise<UserSignatureVaultDto> {
  return (await apiClientRequest(
    "/auth/me/signature",
  )) as UserSignatureVaultDto;
}

export async function saveMySignatureVault(payload: {
  signatureData: string;
  method: SignatureCaptureMethod;
}): Promise<UserSignatureVaultDto> {
  return (await apiClientRequest("/auth/me/signature", {
    method: "PUT",
    body: JSON.stringify(payload),
  })) as UserSignatureVaultDto;
}

export async function deleteMySignatureVault(): Promise<UserSignatureVaultDto> {
  return (await apiClientRequest("/auth/me/signature", {
    method: "DELETE",
  })) as UserSignatureVaultDto;
}

export function formatSignatureMethodLabel(
  method: SignatureCaptureMethod | null | undefined,
): string {
  switch (method) {
    case "DRAW":
      return "Drawn";
    case "UPLOAD":
      return "Uploaded Image";
    default:
      return "Saved";
  }
}

/**
 * Pure pixel processor for captured/scanned signatures on paper.
 * Uses adaptive 85th-percentile luminance thresholding + saturation boost
 * (to preserve blue/colored pen ink), soft Hermite alpha feathering, and
 * tight ink bounding-box detection.
 */
export function processSignatureImageData(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  options?: NormalizeSignatureOptions,
): SignatureImageBounds {
  const removeBackground = options?.removeBackground !== false;
  const strength: BackgroundCleanupStrength = options?.strength ?? "standard";
  const totalPixels = Math.min(width * height, Math.floor(data.length / 4));

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  if (!removeBackground) {
    for (let i = 0; i < totalPixels; i++) {
      const idx = i * 4;
      if (data[idx + 3] > 24) {
        const x = i % width;
        const y = Math.floor(i / width);
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    return {
      minX,
      minY,
      maxX,
      maxY,
      hasInk: maxX >= minX && maxY >= minY,
    };
  }

  // Pass 1: Estimate paper background luminance via 256-bin histogram (O(N)).
  const hist = new Uint32Array(256);
  let opaqueCount = 0;
  for (let i = 0; i < totalPixels; i++) {
    const idx = i * 4;
    if (data[idx + 3] >= 32) {
      const lum = Math.min(
        255,
        Math.max(
          0,
          Math.round(
            0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2],
          ),
        ),
      );
      hist[lum]++;
      opaqueCount++;
    }
  }

  let rawPaperLum = 240;
  if (opaqueCount > 0) {
    const target = Math.floor(opaqueCount * 0.85);
    let cumulative = 0;
    for (let bin = 0; bin < 256; bin++) {
      cumulative += hist[bin];
      if (cumulative >= target) {
        rawPaperLum = bin;
        break;
      }
    }
  }

  const paperLum = Math.min(248, Math.max(175, rawPaperLum));
  const paperCutoff =
    strength === "light"
      ? Math.max(165, paperLum - 12)
      : strength === "strong"
        ? Math.max(140, paperLum - 36)
        : Math.max(155, paperLum - 22);
  const inkSpan =
    strength === "light" ? 45 : strength === "strong" ? 65 : 55;
  const inkCutoff = Math.max(40, paperCutoff - inkSpan);

  // Pass 2: Threshold paper -> alpha 0, feather edges, enhance ink contrast, track ink bounds.
  for (let i = 0; i < totalPixels; i++) {
    const idx = i * 4;
    const origAlpha = data[idx + 3];
    if (origAlpha === 0) continue;

    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    const sat = Math.max(r, g, b) - Math.min(r, g, b);
    const effectiveL = lum - 0.35 * sat;

    let nextAlpha = origAlpha;
    if (effectiveL >= paperCutoff) {
      nextAlpha = 0;
      data[idx + 3] = 0;
    } else if (effectiveL <= inkCutoff) {
      data[idx] = Math.round(r * 0.65);
      data[idx + 1] = Math.round(g * 0.65);
      data[idx + 2] = Math.round(b * 0.65);
    } else {
      const t = (paperCutoff - effectiveL) / (paperCutoff - inkCutoff);
      const smooth = t * t * (3 - 2 * t);
      nextAlpha = Math.round(origAlpha * smooth);
      const darken = 1 - 0.35 * smooth;
      data[idx] = Math.round(r * darken);
      data[idx + 1] = Math.round(g * darken);
      data[idx + 2] = Math.round(b * darken);
      data[idx + 3] = nextAlpha;
    }

    if (nextAlpha > 24) {
      const x = i % width;
      const y = Math.floor(i / width);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    hasInk: maxX >= minX && maxY >= minY,
  };
}

export function normalizeUploadedSignatureImage(
  file: File,
  options?: NormalizeSignatureOptions,
): Promise<string> {
  const nameLower = file.name.toLowerCase();
  const validType =
    file.type === "image/png" ||
    file.type === "image/jpeg" ||
    nameLower.endsWith(".png") ||
    nameLower.endsWith(".jpg") ||
    nameLower.endsWith(".jpeg");

  if (!validType) {
    return Promise.reject(
      new Error("Please upload a PNG or JPEG image file."),
    );
  }
  if (file.size <= 0) {
    return Promise.reject(new Error("The selected image file is empty."));
  }
  if (file.size > MAX_SIGNATURE_UPLOAD_BYTES) {
    return Promise.reject(
      new Error("Signature image must be 1 MB or smaller."),
    );
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => {
      reject(new Error("Unable to read the selected image file."));
    };
    reader.onload = () => {
      const rawUrl = typeof reader.result === "string" ? reader.result : "";
      if (!rawUrl) {
        reject(new Error("Unable to read the selected image file."));
        return;
      }

      const img = new Image();
      img.onerror = () => {
        reject(new Error("The selected file is not a valid image."));
      };
      img.onload = () => {
        if (img.width <= 0 || img.height <= 0) {
          reject(new Error("Invalid image dimensions."));
          return;
        }

        const workScale = Math.min(
          1,
          MAX_WORKING_DIMENSION / Math.max(img.width, img.height),
        );
        const workW = Math.max(1, Math.round(img.width * workScale));
        const workH = Math.max(1, Math.round(img.height * workScale));

        const workCanvas = document.createElement("canvas");
        workCanvas.width = workW;
        workCanvas.height = workH;
        const workCtx = workCanvas.getContext("2d");
        if (!workCtx) {
          reject(new Error("Browser canvas is unavailable."));
          return;
        }

        workCtx.clearRect(0, 0, workW, workH);
        workCtx.drawImage(img, 0, 0, workW, workH);

        const imageData = workCtx.getImageData(0, 0, workW, workH);
        const bounds = processSignatureImageData(
          imageData.data,
          workW,
          workH,
          options,
        );
        workCtx.putImageData(imageData, 0, 0);

        const canvas = document.createElement("canvas");
        canvas.width = 720;
        canvas.height = 240;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Browser canvas is unavailable."));
          return;
        }
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const sx = bounds.hasInk ? bounds.minX : 0;
        const sy = bounds.hasInk ? bounds.minY : 0;
        const sw = bounds.hasInk ? bounds.maxX - bounds.minX + 1 : workW;
        const sh = bounds.hasInk ? bounds.maxY - bounds.minY + 1 : workH;

        const padX = 24;
        const padY = 16;
        const maxW = canvas.width - padX * 2;
        const maxH = canvas.height - padY * 2;
        const scale = Math.min(maxW / sw, maxH / sh);
        const drawW = Math.max(1, Math.round(sw * scale));
        const drawH = Math.max(1, Math.round(sh * scale));
        const offsetX = Math.round((canvas.width - drawW) / 2);
        const offsetY = Math.round((canvas.height - drawH) / 2);

        ctx.drawImage(workCanvas, sx, sy, sw, sh, offsetX, offsetY, drawW, drawH);
        const pngDataUrl = canvas.toDataURL("image/png");
        if (!pngDataUrl.startsWith("data:image/png;base64,")) {
          reject(new Error("Failed to encode signature PNG."));
          return;
        }
        resolve(pngDataUrl);
      };
      img.src = rawUrl;
    };
    reader.readAsDataURL(file);
  });
}
