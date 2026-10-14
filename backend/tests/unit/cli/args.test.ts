import { describe, expect, it } from "vitest";
import { parseStorageBackfillArgs } from "../../../src/cli/args";

/**
 * DL-12: the backfill CLI must default to DRY RUN and only mutate with --apply.
 */
describe("DL-12 backfill CLI arguments", () => {
  it("defaults to dry-run with no arguments", () => {
    expect(parseStorageBackfillArgs([])).toEqual({ apply: false });
    expect(parseStorageBackfillArgs(["--verbose"])).toEqual({ apply: false });
  });

  it("requires the explicit --apply flag to mutate", () => {
    expect(parseStorageBackfillArgs(["--apply"])).toEqual({ apply: true });
  });
});
