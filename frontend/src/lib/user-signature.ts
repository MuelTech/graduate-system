import { apiClientRequest } from "@/lib/api.client";

export type SignatureCaptureMethod = "DRAW" | "UPLOAD";

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

export function normalizeUploadedSignatureImage(file: File): Promise<string> {
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
        const canvas = document.createElement("canvas");
        canvas.width = 720;
        canvas.height = 240;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Browser canvas is unavailable."));
          return;
        }
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const padX = 24;
        const padY = 16;
        const maxW = canvas.width - padX * 2;
        const maxH = canvas.height - padY * 2;
        const scale = Math.min(maxW / img.width, maxH / img.height, 1);
        const drawW = Math.max(1, Math.round(img.width * scale));
        const drawH = Math.max(1, Math.round(img.height * scale));
        const offsetX = Math.round((canvas.width - drawW) / 2);
        const offsetY = Math.round((canvas.height - drawH) / 2);

        ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
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
