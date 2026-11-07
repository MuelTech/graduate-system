import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isolatedAdministratorDatabaseServer } from "../../helpers/isolated-administrator-database";

const sql = readFileSync(path.resolve("prisma/migrations/20261108020000_administrator_access_lock/migration.sql"), "utf8").replace(/--[^\n]*/g, "");
describe("FACULTY-4 minimal fence migration", () => {
  it("only creates/seeds the constrained singleton; no account/bootstrap/grant/history changes", () => {
    expect([...sql.matchAll(/CREATE TABLE `([^`]+)`/g)].map(match => match[1])).toEqual(["administrator_access_lock"]);
    expect([...sql.matchAll(/INSERT INTO `([^`]+)`/g)].map(match => match[1])).toEqual(["administrator_access_lock"]);
    expect(sql).toMatch(/CHECK \(`id` = 1\)/); expect(sql).toMatch(/VALUES \(1\)/);
    expect(sql).not.toMatch(/\b(UPDATE|DELETE|DROP|ALTER|TRUNCATE|RENAME)\b/);
    expect(sql).not.toMatch(/`users`|`administrator_access`|`account_capability_grants`|`audit_logs`/);
  });
});
describe("FACULTY-4 real-DB test safety", () => {
  it.each(["localhost", "127.0.0.1", "[::1]"])("rejects normal application port through %s alias", host => {
    expect(() => isolatedAdministratorDatabaseServer(`mysql://synthetic@${host}:3306/`, "mysql://synthetic@localhost:3306/graduate_system")).toThrow(/different port/);
  });
  it("accepts a genuinely separate local port", () => {
    expect(isolatedAdministratorDatabaseServer("mysql://synthetic@localhost:3307/", "mysql://synthetic@localhost:3306/graduate_system").port).toBe("3307");
  });
  it.each(["mysql://synthetic@localhost:3307/graduate_system", "mysql://synthetic@localhost:3307/faculty4_test_manual", "mysql://synthetic@remote:3307/"])("rejects unsafe test server %s", url => {
    expect(() => isolatedAdministratorDatabaseServer(url, "mysql://synthetic@localhost:3306/graduate_system")).toThrow();
  });
});
