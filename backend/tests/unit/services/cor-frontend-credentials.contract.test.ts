import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";

/**
 * COR-8: static contract guards for the accepted frontend COR credential
 * surfaces. These read source text (no frontend unit-test framework exists);
 * this matches the accepted COR-7 source-contract style. The COR-9 browser
 * walkthrough remains separate.
 */
describe("COR-8 frontend credential contracts", () => {
  it("Admin COR form is extraction-assisted with no Academic Year/Semester and no password claim", () => {
    const page = readFileSync(
      "../frontend/src/app/(portal)/admin/exam/cor/page.tsx",
      "utf8",
    );

    expect(page).toContain("studentNumber");
    expect(page).toContain("registrationNumber");
    // The v1 form removed AY/Semester inputs (a code comment may name them).
    expect(page).not.toMatch(/academicYear/i);
    expect(page).not.toContain("FIRST_SEM");
    expect(page).not.toMatch(/formData\.semester/);
    expect(page).toContain(
      "This form does not generate, reset, or display a password.",
    );
    expect(page).not.toMatch(/date of birth/i);
    expect(page).not.toContain("default_password");
  });

  it("Student login sends only Student Number + password to NextAuth", () => {
    const login = readFileSync("../frontend/src/app/(auth)/login/page.tsx", "utf8");

    // No DOB anywhere on the login page.
    expect(login).not.toMatch(/birthdate/i);
    expect(login).not.toContain("Date of Birth");

    // Extract each role-specific signIn call in order.
    const marker = 'res = await signIn("credentials", {';
    const calls: string[] = [];
    let idx = login.indexOf(marker);
    while (idx !== -1) {
      const end = login.indexOf("});", idx);
      calls.push(login.slice(idx, end + 3));
      idx = login.indexOf(marker, idx + 1);
    }
    expect(calls).toHaveLength(3);
    const [applicantCall, studentCall, staffCall] = calls;

    expect(studentCall).toContain("studentNumber");
    expect(studentCall).toContain("password");
    expect(studentCall).not.toContain("email");
    expect(studentCall).not.toContain("applicantId");
    expect(studentCall).not.toContain("birthdate");

    expect(applicantCall).toContain("applicantId");
    expect(applicantCall).toContain("password");
    expect(applicantCall).not.toContain("studentNumber");
    expect(applicantCall).not.toContain("email");

    expect(staffCall).toContain("email");
    expect(staffCall).toContain("password");
    expect(staffCall).not.toContain("applicantId");
    expect(staffCall).not.toContain("studentNumber");
  });

  it("NextAuth builds a role-specific Student backend payload with no DOB/studentId", () => {
    const auth = readFileSync("../frontend/src/auth.ts", "utf8");

    expect(auth).not.toMatch(/birthdate|studentId|dateOfBirth/i);
    expect(auth).not.toContain("JSON.stringify(credentials)");
    expect(auth).toContain("JSON.stringify(payload)");

    const studentStart = auth.indexOf('role === "student"');
    const staffStart = auth.indexOf(": { role, email", studentStart);
    const studentPayload = auth.slice(studentStart, staffStart);
    expect(studentPayload).toContain("studentNumber");
    expect(studentPayload).toContain("password");
    expect(studentPayload).not.toContain("applicantId");
    expect(studentPayload).not.toContain("email");
    expect(studentPayload).not.toContain("birthdate");
  });
});
