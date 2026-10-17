import { describe, expect, it } from "vitest";

import { parseCorsOrigins } from "../../../src/utils/cors-origins";

describe("parseCorsOrigins", () => {
  it("keeps a single configured origin", () => {
    expect(parseCorsOrigins("http://localhost:3000")).toEqual([
      "http://localhost:3000",
    ]);
  });

  it("supports comma-separated dev origins", () => {
    expect(
      parseCorsOrigins(
        "http://localhost:3000, http://192.168.1.101:3000",
      ),
    ).toEqual(["http://localhost:3000", "http://192.168.1.101:3000"]);
  });

  it("drops empty entries and falls back when unset", () => {
    expect(parseCorsOrigins(" , ")).toEqual(["http://localhost:3000"]);
    expect(parseCorsOrigins(undefined)).toEqual(["http://localhost:3000"]);
  });
});
