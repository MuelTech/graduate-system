import { beforeEach, describe, expect, it, vi } from "vitest";
const fixture = vi.hoisted(() => ({ resolve: vi.fn(), stream: vi.fn(), pipe: vi.fn(), on: vi.fn() }));
vi.mock("../../../src/services/document.service", () => ({ DocumentService: class { resolveDocument = fixture.resolve; } }));
vi.mock("fs", () => ({ default: { createReadStream: fixture.stream } }));
import { DocumentController } from "../../../src/controllers/document.controller";
import { AppError } from "../../../src/utils/AppError";
const controller = new DocumentController();
beforeEach(() => { vi.resetAllMocks(); fixture.stream.mockReturnValue({ on: fixture.on, pipe: fixture.pipe }); });
const request = () => ({ params: { modelType: "cor-upload", id: "doc" }, user: { userId: "actor", role: "ADMIN" } } as any);
const response = () => ({ setHeader: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn() } as any);
describe("FACULTY-8 generic document streaming contract", () => {
  it("streams after authorization with private/no-store, nosniff and safe filename", async () => {
    fixture.resolve.mockResolvedValue({ filePath: "private/internal.pdf", mimeType: "application/pdf", originalFilename: 'COR\r\n".pdf' });
    const res = response(); await controller.getFile(request(), res);
    expect(fixture.resolve).toHaveBeenCalledWith("cor-upload", "doc", "actor", "ADMIN");
    expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "private, no-store");
    expect(res.setHeader).toHaveBeenCalledWith("X-Content-Type-Options", "nosniff");
    expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "application/pdf");
    expect(res.setHeader).toHaveBeenCalledWith("Content-Disposition", 'inline; filename="COR___.pdf"');
    expect(fixture.pipe).toHaveBeenCalledWith(res); expect(res.json).not.toHaveBeenCalled();
  });
  it("denied authorization never creates a stream", async () => {
    fixture.resolve.mockRejectedValue(new AppError("Access denied", 403)); const res = response();
    await controller.getFile(request(), res); expect(res.status).toHaveBeenCalledWith(403); expect(fixture.stream).not.toHaveBeenCalled();
  });
  it("unexpected filesystem errors do not disclose absolute paths or storage keys", async () => {
    fixture.resolve.mockRejectedValue(new Error("ENOENT C:\\private\\secret.pdf storage-key")); const res = response();
    await controller.getFile(request(), res); expect(res.json).toHaveBeenCalledWith({ error: "Document could not be retrieved." });
    expect(fixture.stream).not.toHaveBeenCalled();
  });
});
