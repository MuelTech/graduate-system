import { describe, expect, it } from "vitest";
import { resolvePanelistAdviserFlags } from "../../../src/repositories/admin-panelist.repository";

describe("resolvePanelistAdviserFlags", () => {
  it("status-only update preserves external and availability", () => {
    expect(
      resolvePanelistAdviserFlags({}, {
        isExternal: true,
        isAvailableAsAdviser: false,
      }),
    ).toEqual({ isExternal: true, isAvailableAsAdviser: false });

    expect(
      resolvePanelistAdviserFlags({}, {
        isExternal: false,
        isAvailableAsAdviser: true,
      }),
    ).toEqual({ isExternal: false, isAvailableAsAdviser: true });
  });

  it("explicit external forces availability false even if requested true", () => {
    expect(
      resolvePanelistAdviserFlags(
        { isExternal: true, isAvailableAsAdviser: true },
        { isExternal: false, isAvailableAsAdviser: true },
      ),
    ).toEqual({ isExternal: true, isAvailableAsAdviser: false });
  });

  it("external → internal respects submitted availability", () => {
    expect(
      resolvePanelistAdviserFlags(
        { isExternal: false, isAvailableAsAdviser: true },
        { isExternal: true, isAvailableAsAdviser: false },
      ),
    ).toEqual({ isExternal: false, isAvailableAsAdviser: true });

    expect(
      resolvePanelistAdviserFlags(
        { isExternal: false, isAvailableAsAdviser: false },
        { isExternal: true, isAvailableAsAdviser: false },
      ),
    ).toEqual({ isExternal: false, isAvailableAsAdviser: false });
  });

  it("status-only external keeps availability false", () => {
    expect(
      resolvePanelistAdviserFlags({}, {
        isExternal: true,
        isAvailableAsAdviser: true,
      }),
    ).toEqual({ isExternal: true, isAvailableAsAdviser: false });
  });
});
