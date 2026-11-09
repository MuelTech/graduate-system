import { describe, expect, it } from "vitest";
import { ACCESS_AUDIT_ACTIONS, isProtectedAccessAuditAction } from "../../../src/access/access-audit";
import { createAccessPreflightTemplate } from "../../../src/access/access-preflight";

describe("protected access audit taxonomy", () => {
  it.each(Object.values(ACCESS_AUDIT_ACTIONS))("classifies %s as protected", action => {
    expect(isProtectedAccessAuditAction(action)).toBe(true);
  });
  it("protects future access actions without requiring a whitelist update", () => {
    expect(isProtectedAccessAuditAction("ADMINISTRATOR_ACCESS_FUTURE_CHANGE")).toBe(true);
    expect(isProtectedAccessAuditAction("ACCOUNT_CAPABILITY_FUTURE_CHANGE")).toBe(true);
  });
  it.each([null, undefined, "", "DOCUMENT_ACCESS_DENIED", "DEFENSE_SCHEDULE_CORRECTED", "NOT_ACCOUNT_CAPABILITY_GRANTED"])(
    "does not misclassify unrelated action %j", action => expect(isProtectedAccessAuditAction(action)).toBe(false),
  );
});

describe("operator preflight format foundation", () => {
  it("produces only an uncollected read-only template, never a bootstrap or empty inventory claim", () => {
    const template = createAccessPreflightTemplate();
    expect(template.inventoryStatus).toBe("NOT_COLLECTED");
    expect(template.mode).toBe("READ_ONLY");
    expect(template.requiredSections).toEqual(["accounts", "integrity"]);
    expect(template).not.toHaveProperty("accounts");
    expect(template).not.toHaveProperty("grants");
    expect(template).not.toHaveProperty("databaseUrl");
    expect(Object.isFrozen(template)).toBe(true);
  });
});
