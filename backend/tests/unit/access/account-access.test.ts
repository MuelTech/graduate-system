import { describe, expect, it } from "vitest";
import {
  canAuthorizeDirectCapability, DIRECT_ACCESS_PHASE, hasConfiguredCapability,
  resolveConfiguredAccountAccess, type AccountAccessSnapshot,
} from "../../../src/access/account-access";
import { FULL_ADMINISTRATOR_CAPABILITIES } from "../../../src/access/capability-catalog";

function account(overrides: Partial<AccountAccessSnapshot> = {}): AccountAccessSnapshot {
  return {
    id: "synthetic-user", role: "ADMIN", isActive: true, panelist: null,
    administratorAccess: { level: "RESTRICTED" }, capabilityGrants: [], ...overrides,
  };
}

describe("fail-closed configured account access (not live authorization)", () => {
  it("does not infer Full or Restricted from an existing ADMIN role", () => {
    const access = resolveConfiguredAccountAccess(account({ administratorAccess: null, capabilityGrants: [{ capabilityKey: "students.view" }] }));
    expect(access.status).toBe("MISSING_ADMIN_LEVEL");
    expect(access.capabilities).toEqual([]);
    expect(access.administratorLevel).toBeNull();
  });

  it("derives Full from explicit metadata only, with no academic capability", () => {
    const access = resolveConfiguredAccountAccess(account({ administratorAccess: { level: "FULL" } }));
    expect(access.capabilities).toEqual(FULL_ADMINISTRATOR_CAPABILITIES);
    expect(access.administratorLevel).toBe("FULL");
    expect(hasConfiguredCapability(access, "essay.evaluate")).toBe(false);
    expect(hasConfiguredCapability(access, "administrator_access.manage")).toBe(true);
    expect(hasConfiguredCapability(access, "chairman.conclude")).toBe(false);
  });

  it("Restricted has only explicit grants and catalog prerequisites", () => {
    const access = resolveConfiguredAccountAccess(account({ capabilityGrants: [{ capabilityKey: "faculty.manage" }] }));
    expect(access.capabilities).toEqual(["faculty.manage", "faculty.view"]);
    expect(hasConfiguredCapability(access, "administrator_access.manage")).toBe(false);
    expect(hasConfiguredCapability(access, "students.view")).toBe(false);
  });

  it("an explicitly Restricted empty account has no capabilities", () => {
    expect(resolveConfiguredAccountAccess(account()).capabilities).toEqual([]);
  });

  it("legacy academic identity gets only the configured school-wide essay capability", () => {
    const access = resolveConfiguredAccountAccess(account({ role: "PANELIST", panelist: { isActive: true }, administratorAccess: null,
      capabilityGrants: [{ capabilityKey: "essay.evaluate" }] }));
    expect(access.status).toBe("RESOLVED");
    expect(access.category).toBe("FACULTY");
    expect(access.administratorLevel).toBeNull();
    expect(access.capabilities).toEqual(["essay.evaluate"]);
  });

  it("academic profile/availability never creates a configured capability", () => {
    expect(resolveConfiguredAccountAccess(account({ role: "PANELIST", panelist: { isActive: true }, administratorAccess: null })).capabilities).toEqual([]);
  });

  it.each(["APPLICANT", "STUDENT", "CUSTOM", "SUPER_ADMIN", "admin", ""])(
    "does not infer supported account identity for %s", role => {
      const access = resolveConfiguredAccountAccess(account({ role, administratorAccess: { level: "FULL" } }));
      expect(access.status).toBe("UNSUPPORTED_ACCOUNT");
      expect(access.capabilities).toEqual([]);
    },
  );

  it.each(["SUPER_ADMIN", "full", "", null, undefined])("rejects invalid Admin metadata %j", level => {
    expect(resolveConfiguredAccountAccess(account({ administratorAccess: { level: level as string } })).status).toBe("INVALID_CONFIGURATION");
  });

  it.each(["essay.evaluate", "administrator_access.manage", "unknown", "__proto__"])(
    "rejects an invalid/cross-category/Full-only direct grant %s", capabilityKey => {
      for (const level of ["FULL", "RESTRICTED"]) {
        const access = resolveConfiguredAccountAccess(account({ administratorAccess: { level }, capabilityGrants: [{ capabilityKey }] }));
        expect(access.status).toBe("INVALID_CONFIGURATION");
        expect(access.capabilities).toEqual([]);
      }
    },
  );

  it("denies the entire configuration on duplicate or malformed rows", () => {
    for (const grants of [[{ capabilityKey: "students.view" }, { capabilityKey: "students.view" }], [null], undefined]) {
      expect(resolveConfiguredAccountAccess(account({ capabilityGrants: grants as never })).status).toBe("INVALID_CONFIGURATION");
    }
  });

  it("denies inactive/missing Users and inactive/missing academic profiles", () => {
    expect(resolveConfiguredAccountAccess(null).status).toBe("NOT_FOUND");
    expect(resolveConfiguredAccountAccess(account({ isActive: false })).capabilities).toEqual([]);
    for (const panelist of [null, { isActive: false }]) {
      expect(resolveConfiguredAccountAccess(account({ role: "PANELIST", panelist, administratorAccess: null })).status).toBe("INACTIVE");
    }
  });

  it("denies misplaced Admin metadata on an academic account", () => {
    expect(resolveConfiguredAccountAccess(account({ role: "PANELIST", panelist: { isActive: true } })).status).toBe("INVALID_CONFIGURATION");
  });

  it("does not retain permissions across changed snapshots", () => {
    const before = account({ capabilityGrants: [{ capabilityKey: "students.view" }] });
    expect(hasConfiguredCapability(resolveConfiguredAccountAccess(before), "students.view")).toBe(true);
    expect(hasConfiguredCapability(resolveConfiguredAccountAccess(account()), "students.view")).toBe(false);
    expect(hasConfiguredCapability(resolveConfiguredAccountAccess({ ...before, isActive: false }), "students.view")).toBe(false);
  });

  it("cannot activate live authorization even for a configured Full account", () => {
    const preview = resolveConfiguredAccountAccess(account({ administratorAccess: { level: "FULL" } }));
    expect(DIRECT_ACCESS_PHASE).toBe("FOUNDATION_ONLY");
    expect(canAuthorizeDirectCapability(preview, "administrator_access.manage")).toBe(false);
    expect(hasConfiguredCapability(preview, undefined)).toBe(false);
    expect(Object.isFrozen(preview.capabilities)).toBe(true);
  });
});
