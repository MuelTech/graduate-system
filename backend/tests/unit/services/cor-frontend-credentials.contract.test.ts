import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";

/**
 * Static contract guards for the accepted frontend COR credential surfaces.
 * These read source text (no frontend unit-test framework exists); this matches
 * the accepted COR-7 source-contract style. The COR-9 browser walkthrough
 * remains separate. The Admin COR contract reflects the 2026-10-05 authority
 * correction / COR-AUTH-2.
 */
describe("COR frontend credential contracts", () => {
  it("Admin COR page sends the COR-AUTH-1 confirmation payload with no deferred authority fields", () => {
    const page = readFileSync(
      "../frontend/src/app/(portal)/admin/exam/cor/page.tsx",
      "utf8",
    );

    // A. Confirmed authority fields are present/editable.
    for (const field of [
      "studentNumber",
      "registrationNumber",
      "surname",
      "firstName",
      "middleNameOrInitial",
      "email",
      "programId",
    ]) {
      expect(page).toContain(field);
    }

    // F. Program options come from the existing graduate Program endpoint.
    expect(page).toContain('"/programs"');
    expect(page).toContain("graduatePrograms");
    // FIX1: a unique exact-match preselects safely; manual selection is guarded.
    expect(page).toContain("resolveProgramId");
    expect(page).toContain("programSelection");
    expect(page).toMatch(/Loading programs/i);
    expect(page).not.toMatch(/createProgram|create program/i);

    // D. The authorized private document route is still used.
    expect(page).toContain("/api/documents/cor-upload/");

    // G. Required fields gate the final Verify action; final summary exists.
    expect(page).toContain("canVerify");
    expect(page).toContain("Confirm Verification");

    // J. No password/default-password claim; existing password retained wording.
    expect(page).not.toContain("default_password");
    expect(page).not.toMatch(/default password|initial password|last name in all caps/i);
    expect(page).toMatch(/existing password/i);

    // B/C. No deferred or non-authoritative fields in the verification flow.
    expect(page).not.toMatch(/academicYear|semester|curriculumYear/i);
    expect(page).not.toMatch(/dateOfBirth|birthdate|date of birth/i);
    expect(page).not.toMatch(/verificationMethod/);
    expect(page).not.toMatch(/college/i);
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
