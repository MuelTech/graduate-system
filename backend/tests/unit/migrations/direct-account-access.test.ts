import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(resolve("prisma/migrations/20261108000000_direct_account_access/migration.sql"), "utf8");

describe("FACULTY-1 migration release boundary", () => {
  it("creates only the two new tables, without bootstrapping or touching existing tables", () => {
    expect([...sql.matchAll(/CREATE TABLE `([^`]+)`/g)].map(match => match[1])).toEqual([
      "administrator_access", "account_capability_grants",
    ]);
    const statements = sql.replace(/--[^\n]*/g, "");
    expect(statements).not.toMatch(/^\s*(?:INSERT|UPDATE|DELETE|TRUNCATE|DROP|RENAME)\b/im);
    expect([...statements.matchAll(/ALTER TABLE `([^`]+)`/g)].every(match =>
      ["administrator_access", "account_capability_grants"].includes(match[1]),
    )).toBe(true);
    expect(sql).not.toMatch(/\bDEFAULT\s+'(?:FULL|RESTRICTED)'/i);
  });
});
