import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getHealth: vi.fn(),
  runIntegrityScan: vi.fn(),
}));

vi.mock("../../../src/services/storage-health.service", () => ({
  StorageHealthService: class {
    getHealth = mocks.getHealth;
    runIntegrityScan = mocks.runIntegrityScan;
  },
}));

import { AppError } from "../../../src/utils/AppError";
import { StorageHealthController } from "../../../src/controllers/storage-health.controller";

function makeRes() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as any;
}

describe("DL-11 StorageHealthController", () => {
  const controller = new StorageHealthController();

  beforeEach(() => vi.clearAllMocks());

  it("returns the health summary", async () => {
    mocks.getHealth.mockResolvedValue({ provider: "local" });
    const res = makeRes();
    await controller.getHealth({} as any, res);
    expect(res.json).toHaveBeenCalledWith({ provider: "local" });
  });

  it("preserves the 409 scan-in-progress conflict", async () => {
    mocks.runIntegrityScan.mockRejectedValue(
      new AppError("Integrity scan already in progress.", 409),
    );
    const res = makeRes();
    await controller.runIntegrityScan({} as any, res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      error: "Integrity scan already in progress.",
    });
  });

  it("maps unexpected failures to a controlled 500 without leaking internals", async () => {
    mocks.runIntegrityScan.mockRejectedValue(new Error("boom at /srv/secret"));
    const res = makeRes();
    await controller.runIntegrityScan({} as any, res);
    expect(res.status).toHaveBeenCalledWith(500);
    const payload = res.json.mock.calls[0][0];
    expect(payload).toEqual({ error: "Unexpected storage diagnostics error." });
  });

  it("health errors preserve AppError status codes", async () => {
    mocks.getHealth.mockRejectedValue(new AppError("nope", 403));
    const res = makeRes();
    await controller.getHealth({} as any, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
