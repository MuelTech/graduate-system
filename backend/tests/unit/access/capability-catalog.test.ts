import { describe, expect, it } from "vitest";
import {
  CAPABILITY_CATALOG, CAPABILITY_KEYS, FULL_ADMINISTRATOR_CAPABILITIES,
  expandCapabilityPrerequisites, isCapabilityKey, validateDirectCapabilityKeys,
} from "../../../src/access/capability-catalog";

describe("direct-access capability catalog", () => {
  it("contains only one configured Faculty capability and no Program/assignment capability", () => {
    expect(CAPABILITY_KEYS.filter(key => CAPABILITY_CATALOG[key].category === "FACULTY")).toEqual(["essay.evaluate"]);
    expect(CAPABILITY_KEYS.some(key => /program|chairman|rapporteur|facilitator|adviser\.access/i.test(key))).toBe(false);
    expect(FULL_ADMINISTRATOR_CAPABILITIES).not.toContain("essay.evaluate");
    expect(FULL_ADMINISTRATOR_CAPABILITIES).toContain("administrator_access.manage");
  });

  it.each([undefined, null, "", "unknown.manage", "toString", "__proto__", "constructor", "/admin/students", "ESSAY.EVALUATE", {}])(
    "denies non-catalog key %j", value => {
      expect(isCapabilityKey(value)).toBe(false);
      expect(() => validateDirectCapabilityKeys("ADMIN", [value])).toThrow();
    },
  );

  it.each(CAPABILITY_KEYS)("validates category and grantability for %s", key => {
    const definition = CAPABILITY_CATALOG[key];
    const other = definition.category === "ADMIN" ? "FACULTY" : "ADMIN";
    expect(() => validateDirectCapabilityKeys(other, [key])).toThrow();
    if (definition.directGrantable) {
      expect(validateDirectCapabilityKeys(definition.category, [key])).toEqual([key]);
    } else {
      expect(() => validateDirectCapabilityKeys(definition.category, [key])).toThrow();
    }
  });

  it("rejects duplicate rows rather than choosing one", () => {
    expect(() => validateDirectCapabilityKeys("FACULTY", ["essay.evaluate", "essay.evaluate"])).toThrow(/Duplicate/);
  });

  it("expands only the exact read prerequisites, not unrelated registries", () => {
    expect(expandCapabilityPrerequisites(["defense.schedules.manage"])).toEqual([
      "defense.schedules.manage", "defense.schedules.view",
    ]);
    expect(expandCapabilityPrerequisites(["cor.verify"])).toEqual(["cor.verify", "cor.view"]);
    expect(expandCapabilityPrerequisites(["essay.evaluate"])).toEqual(["essay.evaluate"]);
    expect(expandCapabilityPrerequisites(["exam.starts.authorize", "exam.records.view"])).toEqual([
      "exam.records.view", "exam.starts.authorize",
    ]);
  });

  it("keeps every dependency known, directly grantable and in the same category", () => {
    for (const key of CAPABILITY_KEYS) {
      for (const dependency of CAPABILITY_CATALOG[key].requires) {
        expect(isCapabilityKey(dependency)).toBe(true);
        if (isCapabilityKey(dependency)) {
          expect(CAPABILITY_CATALOG[dependency].category).toBe(CAPABILITY_CATALOG[key].category);
          expect(CAPABILITY_CATALOG[dependency].directGrantable).toBe(true);
        }
      }
    }
    expect(Object.isFrozen(CAPABILITY_CATALOG)).toBe(true);
  });
});
