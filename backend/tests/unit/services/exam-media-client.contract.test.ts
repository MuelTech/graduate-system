import { describe, expect, it, vi } from "vitest";
import { startExamImageRequest } from "../../../../frontend/src/lib/exam-media.client";
import { EXAM_PNG } from "../../fixtures/exam-images";

const mediaId = "00000000-0000-4000-8000-000000000001";
function setup(response = new Response(new Uint8Array(EXAM_PNG), { headers: { "Content-Type": "image/png" } })) {
  const fetcher = vi.fn().mockResolvedValue(response);
  const urls = { createObjectURL: vi.fn().mockReturnValue("blob:synthetic-image"), revokeObjectURL: vi.fn() };
  const onLoad = vi.fn(), onError = vi.fn(), onSessionExpired = vi.fn();
  const options = { baseUrl: "http://backend.test:5000", mediaId, token: "current-access-token", fetcher, urls, onLoad, onError, onSessionExpired };
  return { ...options, start: () => startExamImageRequest(options) };
}

describe("authenticated image request/object-URL lifecycle without a browser", () => {
  it("fetches through the backend base URL with the token and revokes exactly once on cleanup", async () => {
    const request = setup();
    const cleanup = request.start();
    await vi.waitFor(() => expect(request.onLoad).toHaveBeenCalledWith("blob:synthetic-image"));
    expect(request.fetcher).toHaveBeenCalledWith(`http://backend.test:5000/api/exam-engine/media/${mediaId}`, expect.objectContaining({ headers: { Authorization: "Bearer current-access-token" }, cache: "no-store", signal: expect.any(AbortSignal) }));
    cleanup(); cleanup();
    expect(request.urls.revokeObjectURL).toHaveBeenCalledExactlyOnceWith("blob:synthetic-image");
  });

  it("aborts an in-flight fetch and ignores a late response after replacement/unmount", async () => {
    let resolve!: (response: Response) => void;
    const request = setup();
    request.fetcher.mockImplementation(() => new Promise<Response>(done => { resolve = done; }));
    const cleanup = request.start();
    cleanup();
    expect(request.fetcher.mock.calls[0][1].signal.aborted).toBe(true);
    resolve(new Response(new Uint8Array(EXAM_PNG), { headers: { "Content-Type": "image/png" } }));
    await new Promise(done => setTimeout(done, 0));
    expect(request.urls.createObjectURL).not.toHaveBeenCalled();
    expect(request.onLoad).not.toHaveBeenCalled();
    expect(request.onError).not.toHaveBeenCalled();
  });

  it.each([401, 403])("uses existing session-expiry behavior for %i", async status => {
    const request = setup(new Response("private storage metadata", { status }));
    const cleanup = request.start();
    await vi.waitFor(() => expect(request.onSessionExpired).toHaveBeenCalledOnce());
    expect(request.urls.createObjectURL).not.toHaveBeenCalled();
    expect(request.onError).toHaveBeenCalledWith("Image unavailable. Try again or check your session.");
    cleanup();
  });

  it.each(["application/pdf", "image/svg+xml", "text/html"])("rejects unsupported response content %s without creating a URL", async mime => {
    const request = setup(new Response("fake image", { headers: { "Content-Type": mime } }));
    const cleanup = request.start();
    await vi.waitFor(() => expect(request.onError).toHaveBeenCalledOnce());
    expect(request.urls.createObjectURL).not.toHaveBeenCalled();
    cleanup();
  });

  it("rejects oversized image blobs", async () => {
    const request = setup(new Response(new Uint8Array(5 * 1024 * 1024 + 1), { headers: { "Content-Type": "image/png" } }));
    const cleanup = request.start();
    await vi.waitFor(() => expect(request.onError).toHaveBeenCalledOnce());
    expect(request.urls.createObjectURL).not.toHaveBeenCalled();
    cleanup();
  });

  it("rejects path-like identity and never logs/returns backend error text", async () => {
    const request = setup();
    startExamImageRequest({ ...request, mediaId: "../private/storage" });
    await vi.waitFor(() => expect(request.onError).toHaveBeenCalledOnce());
    expect(request.fetcher).not.toHaveBeenCalled();
    expect(JSON.stringify(request.onError.mock.calls)).not.toContain("private/storage");
  });
});
