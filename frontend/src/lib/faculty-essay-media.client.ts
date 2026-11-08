import { essayMediaEndpoint } from "./faculty-essays";

/** Exact Faculty entitlement; no generic exam media URL or persistent bytes. */
export function startFacultyEssayImageRequest(request: {
  baseUrl: string;
  applicationId: string;
  mediaId: string;
  token: string;
  onLoad: (url: string) => void;
  onError: () => void;
  onUnauthorized: () => void;
  onForbidden: () => void;
  fetcher?: typeof fetch;
  urls?: Pick<typeof URL, "createObjectURL" | "revokeObjectURL">;
}): () => void {
  const abort = new AbortController();
  const urls = request.urls ?? URL;
  let disposed = false;
  let blobUrl: string | null = null;
  void (async () => {
    try {
      if (!request.token) throw new Error("Unavailable");
      const response = await (request.fetcher ?? fetch)(
        `${request.baseUrl}/api${essayMediaEndpoint(request.applicationId, request.mediaId)}`,
        {
          signal: abort.signal,
          cache: "no-store",
          headers: { Authorization: `Bearer ${request.token}` },
        },
      );
      if (disposed) return;
      if (response.status === 401) request.onUnauthorized();
      if (response.status === 403) request.onForbidden();
      const mime = response.headers.get("Content-Type")?.split(";")[0].trim();
      if (!response.ok || !["image/png", "image/jpeg"].includes(mime ?? ""))
        throw new Error("Unavailable");
      const blob = await response.blob();
      if (disposed) return;
      if (!blob.size || blob.size > 5 * 1024 * 1024 || blob.type !== mime)
        throw new Error("Unavailable");
      blobUrl = urls.createObjectURL(blob);
      request.onLoad(blobUrl);
    } catch {
      if (!disposed) request.onError();
    }
  })();
  return () => {
    disposed = true;
    abort.abort();
    if (blobUrl) {
      urls.revokeObjectURL(blobUrl);
      blobUrl = null;
    }
  };
}
