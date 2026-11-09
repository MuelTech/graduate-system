import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const prismaDir = path.resolve(__dirname, "../../../prisma");
const schema = readFileSync(path.join(prismaDir, "schema.prisma"), "utf8");
const sql = readFileSync(path.join(prismaDir, "migrations/20261108010000_faculty_identity_compatibility/migration.sql"), "utf8")
  .replace(/--[^\n]*/g, "").trim();
const values = (name: string) => schema.match(new RegExp(`enum ${name} \\{([^}]+)\\}`))![1]
  .split("\n").map(line => line.trim()).filter(line => line && !line.startsWith("@@"));

describe("FACULTY-3 enum-only forward migration", () => {
  it("historical expansion appends FACULTY without rewriting the migration", () => {
    expect(values("UserRole")).toEqual(["ADMIN", "STUDENT", "PANELIST", "APPLICANT", "FACULTY"]);
    expect(sql).toBe("ALTER TABLE `users` MODIFY `role` ENUM('ADMIN', 'STUDENT', 'PANELIST', 'CUSTOM', 'APPLICANT', 'FACULTY') NOT NULL DEFAULT 'APPLICANT';");
  });
  it("contains one DDL statement and no data conversion, profile/history/grant mutation", () => {
    expect(sql.split(";").filter(part => part.trim())).toHaveLength(1);
    expect(sql).not.toMatch(/\b(UPDATE|INSERT|DELETE|DROP|TRUNCATE|RENAME|CREATE|REPLACE)\b/i);
    expect(sql).not.toMatch(/panelists|assignments|signatures|scores|snapshots|hash|grants|custom_roles/i);
  });
  it("preserves all Defense PanelRole values and the Panelist model/table", () => {
    expect(values("PanelRole")).toEqual(["CHAIRMAN", "PANELIST", "ADVISER", "RAPPORTEUR", "FACILITATOR"]);
    expect(schema).toMatch(/model Panelist \{[^}]+@@map\("panelists"\)/s);
  });
});
