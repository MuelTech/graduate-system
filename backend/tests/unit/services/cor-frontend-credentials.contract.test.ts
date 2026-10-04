import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";

/**
 * Static contract guards for the accepted frontend COR credential surfaces.
 * These read source text (no frontend unit-test framework exists); this matches
 * the accepted COR-7 source-contract style. The COR-9 browser walkthrough
 * remains separate. The Admin COR contract reflects the 2026-10-05 authority
 * correction / COR-AUTH-2 (+FIX1) and COR-AUTH-3 regression locks.
 */
const PAGE_PATH = "../frontend/src/app/(portal)/admin/exam/cor/page.tsx";

/** Returns the source slice from `start` up to the next `end` marker. */
function sliceBetween(source: string, start: string, end: string): string {
  const i = source.indexOf(start);
  if (i === -1) return "";
  const j = source.indexOf(end, i + start.length);
  return j === -1 ? source.slice(i) : source.slice(i, j);
}

describe("COR frontend credential contracts", () => {
  it("Admin COR page sends the COR-AUTH-1 confirmation payload with no deferred authority fields", () => {
    const page = readFileSync(PAGE_PATH, "utf8");

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

  it("review statuses are presentation-only and never auto-authorize", () => {
    const page = readFileSync(PAGE_PATH, "utf8");

    // A. All four statuses exist.
    const badge = sliceBetween(page, "function StatusBadge(", "function MutedValue(");
    expect(badge).not.toBe("");
    expect(badge).toContain('"MATCH"');
    expect(badge).toContain('"DIFFERENT"');
    expect(badge).toContain('"NO_DATA"');
    expect(badge).toContain("Match");
    expect(badge).toContain("Different");
    expect(badge).toContain("No existing data");
    expect(badge).toContain("Not extracted");

    // B. StatusBadge must not invoke authority.
    expect(badge).not.toMatch(
      /verifyMutation|rejectMutation|\.mutate\(|apiClientRequest|handleConfirmVerify/,
    );

    // E. "Different" stays non-destructive (amber warning, never red).
    const differentCase = sliceBetween(badge, 'case "DIFFERENT"', 'case "NO_DATA"');
    expect(differentCase).not.toBe("");
    expect(differentCase).toMatch(/amber/);
    expect(differentCase).not.toMatch(/red/);

    // C. Status computation must not invoke authority, and must derive from the
    // extraction suggestions.
    const statusCalc = sliceBetween(page, "const nameStatus", "function openVerify(");
    expect(statusCalc).not.toBe("");
    expect(statusCalc).toMatch(/suggestions\?\.studentName/);
    expect(statusCalc).toMatch(/suggestions\?\.emailAddress/);
    expect(statusCalc).toMatch(/suggestions\?\.program/);
    expect(statusCalc).not.toMatch(
      /verifyMutation|rejectMutation|\.mutate\(|apiClientRequest|handleConfirmVerify/,
    );
  });

  it("explicit Admin Verify and Reject are the only authority paths", () => {
    const page = readFileSync(PAGE_PATH, "utf8");

    // Verify must open the explicit confirmation, which then submits.
    const openVerify = sliceBetween(page, "function openVerify(", "const verifyMutation");
    expect(openVerify).toContain("canVerify");
    expect(openVerify).toContain("setShowVerifyConfirm(true)");

    const confirm = sliceBetween(page, "function handleConfirmVerify(", "const rejectMutation");
    expect(confirm).toContain("verifyMutation.mutate");

    // UI actions are wired to the explicit handlers.
    expect(page).toContain("onClick={openVerify}");
    expect(page).toContain("onClick={handleConfirmVerify}");

    // Reject is its own explicit action, isolated from verify/status paths.
    const rejectModal = sliceBetween(page, "{/* Reject Modal */}", "{selectedDoc &&");
    expect(rejectModal).toContain("rejectMutation.mutate");
    expect(rejectModal).not.toContain("verifyMutation");
    expect(confirm).not.toContain("rejectMutation");
  });

  it("Program authority locks unique exact match, manual precedence, gating and payload", () => {
    const page = readFileSync(PAGE_PATH, "utf8");

    // Unique exact normalized match; no fuzzy/nearest match; no creation.
    const resolver = sliceBetween(page, "function resolveProgramId(", "function StatusBadge(");
    expect(resolver).not.toBe("");
    expect(resolver).toContain("normalizeForCompare");
    expect(resolver).toContain("matches.length === 1");
    expect(resolver).toMatch(/filter\(/);
    expect(resolver).not.toMatch(/fuzzy|nearest|startsWith|includes\(/i);
    expect(resolver).not.toMatch(/\.create\(|createProgram/i);

    // Manual selection precedence over auto exact-match preselection.
    const derived = sliceBetween(page, "const autoProgramId", "function setField");
    expect(derived).toContain(
      "resolveProgramId(suggestions?.program, graduatePrograms)",
    );
    expect(derived).toMatch(/programSelection\s*\?\?\s*autoProgramId/);

    // Verify gating depends on the confirmed Program (unresolved blocks).
    const canVerify = sliceBetween(page, "const canVerify", "const confirmedName");
    expect(canVerify).toContain("confirmedProgramId");

    // Payload sends the confirmed Program id, never the raw/auto value.
    const confirm = sliceBetween(page, "function handleConfirmVerify(", "const rejectMutation");
    expect(confirm).toContain("programId: confirmedProgramId");
    expect(confirm).not.toContain("suggestions?.program");

    // Loading/failure disable Program selection; Verify cannot validate without it.
    expect(page).toContain("disabled={programsLoading || programsError}");
    expect(page).toContain("Loading programs");
    expect(page).not.toMatch(/createProgram|create program/i);
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
