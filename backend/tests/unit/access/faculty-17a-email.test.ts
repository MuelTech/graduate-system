import { describe, expect, it } from "vitest";
import { accountEmailWhere, hasEmailIdentityConflict, normalizeAccountEmail, studentLifecycleEmailWhere } from "../../../src/utils/account-email";
import { syntheticCutoverManifest, syntheticCutoverSnapshot } from "../../fixtures/faculty-16";
import { validateManifest } from "../../../src/access/cutover-rehearsal";

describe("FACULTY-17A account identity policy", () => {
  it("normalizes ASCII outer spaces/case without Gmail dot/plus rewriting", () => {
    expect(normalizeAccountEmail(" Person.Name+Tag@Gmail.COM ")).toBe("person.name+tag@gmail.com");
    expect(normalizeAccountEmail("personname@gmail.com")).not.toBe(normalizeAccountEmail("person.name@gmail.com"));
  });
  it("a Faculty lookup includes legacy PANELIST but never ADMIN; exclusive roles keep their own role filter", () => {
    expect(accountEmailWhere(" Person@gmail.COM ", "FACULTY")).toEqual({ emailFacultyKey: "person@gmail.com", role: { in: ["FACULTY", "PANELIST"] } });
    expect(accountEmailWhere("person@gmail.com", "PANELIST")).toEqual(accountEmailWhere("person@gmail.com", "FACULTY"));
    for (const role of ["ADMIN", "APPLICANT", "STUDENT"] as const) expect(accountEmailWhere("Person@gmail.com", role)).toEqual({ emailAdminKey: "person@gmail.com", role });
  });
  it("the synthetic operator accepts the approved pair and never broadens it into arbitrary duplicates", () => {
    const baseline = syntheticCutoverSnapshot(); baseline.tables.users.find(row => row.user_id === "faculty")!.email = " OPERATOR@example.invalid ";
    expect(() => validateManifest(baseline, syntheticCutoverManifest(baseline))).not.toThrow();
    baseline.tables.users.find(row => row.user_id === "external")!.email = "operator@example.invalid";
    expect(() => validateManifest(baseline, syntheticCutoverManifest(baseline))).toThrow(/Duplicate authoritative account identity/);
  });
  it("seed lifecycle lookup preserves Applicant-to-Student identity and cannot choose a privileged same-email account", () => {
    expect(studentLifecycleEmailWhere(" Student@gmail.COM ")).toEqual({ emailAdminKey: "student@gmail.com", role: { in: ["APPLICANT", "STUDENT"] } });
  });
  it.each(["APPLICANT", "STUDENT", "PANELIST", "FACULTY"])("exclusive identities cannot join an Admin/Faculty pair (%s)", role => {
    expect(hasEmailIdentityConflict([{ role: "ADMIN", email: "shared@gmail.com" }, { role: "FACULTY", email: "SHARED@gmail.com" }, { role, email: " shared@gmail.com " }])).toBe(true);
  });
});
