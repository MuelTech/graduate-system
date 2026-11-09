import type { Prisma, UserRole } from "@prisma/client";

/** Match SQL LOWER(TRIM(email)); no Gmail dot/plus rewriting or identity merging. */
export function normalizeAccountEmail(email: string): string {
  return email.replace(/^ +| +$/g, "").toLowerCase();
}

/** A unique lookup always includes the intended current account category. */
export function accountEmailWhere(email: string, role: UserRole): Prisma.UserWhereUniqueInput {
  const normalized = normalizeAccountEmail(email);
  if (role === "FACULTY" || role === "PANELIST") {
    return { emailFacultyKey: normalized, role: { in: ["FACULTY", "PANELIST"] } };
  }
  return { emailAdminKey: normalized, role };
}

/** Existence only, for exclusive Applicant registration; never authentication. */
export function accountEmailConflictWhere(email: string): Prisma.UserWhereInput {
  const normalized = normalizeAccountEmail(email);
  return { OR: [{ emailAdminKey: normalized }, { emailFacultyKey: normalized }] };
}

/** Seed-only same-record lifecycle lookup: never reseed a promoted Student as a new Applicant. */
export function studentLifecycleEmailWhere(email: string): Prisma.UserWhereUniqueInput {
  return { emailAdminKey: normalizeAccountEmail(email), role: { in: ["APPLICANT", "STUDENT"] } };
}

/** Synthetic operator preflight; SQL indexes remain authoritative for collation/concurrency. */
export function hasEmailIdentityConflict(accounts: readonly { email: string; role: string }[]): boolean {
  const admin = new Set<string>(), faculty = new Set<string>();
  for (const account of accounts) {
    const email = normalizeAccountEmail(account.email);
    if (!email) return true;
    if (account.role !== "FACULTY" && account.role !== "PANELIST") {
      if (admin.has(email)) return true;
      admin.add(email);
    }
    if (account.role !== "ADMIN") {
      if (faculty.has(email)) return true;
      faculty.add(email);
    }
  }
  return false;
}
