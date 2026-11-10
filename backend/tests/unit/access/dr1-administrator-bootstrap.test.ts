import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { isProtectedAccessAuditAction } from "../../../src/access/access-audit";
import {
  DIRECT_ACCESS_ENFORCEMENT_ENABLED,
  resolveConfiguredAccountAccess,
} from "../../../src/access/account-access";
import { ADMINISTRATOR_MANAGEMENT_ENABLED } from "../../../src/access/administrator-management";
import { FULL_ADMINISTRATOR_CAPABILITIES } from "../../../src/access/capability-catalog";
import {
  assertAuthorizedLocalDevDatabaseTarget,
  bootstrapInitialFullAdministrator,
  parseDr1BootstrapArgs,
} from "../../../src/access/dr1-administrator-bootstrap";

interface MockUserRow {
  id: string;
  email: string;
  emailAdminKey: string | null;
  emailFacultyKey: string | null;
  role: string;
  passwordHash: string;
  isActive: boolean;
  mustChangePassword: boolean;
  panelist: { isActive: boolean } | null;
  administratorAccess: { level: string; createdById?: string; updatedById?: string } | null;
  capabilityGrants: Array<{ capabilityKey: string }>;
}

function createLocalDevDatabaseDouble(seedUsers?: MockUserRow[]) {
  let state = {
    users: seedUsers ?? [
      {
        id: "admin-1-id",
        email: "admin@earist.edu.ph",
        emailAdminKey: "admin@earist.edu.ph",
        emailFacultyKey: null,
        role: "ADMIN",
        passwordHash: "$2b$10$synthetic_preserved_hash_never_mutated",
        isActive: true,
        mustChangePassword: false,
        panelist: null,
        administratorAccess: null,
        capabilityGrants: [],
      },
      {
        id: "other-admin-id",
        email: "other.admin@earist.edu.ph",
        emailAdminKey: "other.admin@earist.edu.ph",
        emailFacultyKey: null,
        role: "ADMIN",
        passwordHash: "$2b$10$other_admin_hash_untouched",
        isActive: true,
        mustChangePassword: false,
        panelist: null,
        administratorAccess: null,
        capabilityGrants: [],
      },
      {
        id: "faculty-1-id",
        email: "panelist1@earist.edu.ph",
        emailAdminKey: null,
        emailFacultyKey: "panelist1@earist.edu.ph",
        role: "PANELIST",
        passwordHash: "$2b$10$faculty_hash_untouched",
        isActive: true,
        mustChangePassword: false,
        panelist: { isActive: true },
        administratorAccess: null,
        capabilityGrants: [],
      },
      {
        id: "student-1-id",
        email: "student1@earist.edu.ph",
        emailAdminKey: null,
        emailFacultyKey: null,
        role: "STUDENT",
        passwordHash: "$2b$10$student_hash_untouched",
        isActive: true,
        mustChangePassword: false,
        panelist: null,
        administratorAccess: null,
        capabilityGrants: [],
      },
    ],
    audits: [] as Array<Record<string, unknown>>,
  };

  const control = {
    missingFence: false,
    failAudit: false,
    trace: [] as string[],
    grantWrites: 0,
    userUpdates: 0,
    get state() {
      return state;
    },
  };

  const database = {
    $transaction: vi.fn(async (operation: (tx: any) => Promise<any>) => {
      let draft: typeof state | undefined;
      const requireLock = () => {
        if (!draft) throw new Error("Accessed state prior to administrator_access_lock fence.");
        return draft;
      };
      const tx = {
        $queryRaw: vi.fn(async (strings: TemplateStringsArray) => {
          const sql = strings.join("?");
          control.trace.push(sql.trim());
          if (sql.includes("administrator_access_lock")) {
            draft = structuredClone(state);
            return control.missingFence ? [] : [{ id: 1 }];
          }
          requireLock();
          return [];
        }),
        user: {
          findMany: vi.fn(async ({ where }: any) => {
            const current = requireLock();
            control.trace.push("user.findMany");
            return current.users.filter(row => {
              if (where.role && row.role !== where.role) return false;
              if (where.emailAdminKey !== undefined && row.emailAdminKey !== where.emailAdminKey) return false;
              if (where.emailFacultyKey !== undefined && row.emailFacultyKey !== where.emailFacultyKey) return false;
              return true;
            });
          }),
          findUnique: vi.fn(async ({ where }: any) => {
            const current = requireLock();
            return current.users.find(row => row.id === where.id) ?? null;
          }),
          update: vi.fn(async () => {
            control.userUpdates++;
            throw new Error("Bootstrap must never update User rows.");
          }),
        },
        administratorAccess: {
          findMany: vi.fn(async () => {
            const current = requireLock();
            return current.users
              .filter(row => row.administratorAccess !== null)
              .map(row => ({ userId: row.id, level: row.administratorAccess!.level }));
          }),
          create: vi.fn(async ({ data }: any) => {
            const current = requireLock();
            control.trace.push(`administratorAccess.create:${data.userId}:${data.level}`);
            const user = current.users.find(row => row.id === data.userId);
            if (!user) throw new Error("Missing target user");
            if (user.administratorAccess) throw new Error("Duplicate administrator_access row");
            user.administratorAccess = {
              level: data.level,
              createdById: data.createdById,
              updatedById: data.updatedById,
            };
            return data;
          }),
        },
        accountCapabilityGrant: {
          createMany: vi.fn(async () => {
            control.grantWrites++;
            throw new Error("FULL bootstrap must never create direct capability grants.");
          }),
        },
        auditLog: {
          create: vi.fn(async ({ data }: any) => {
            const current = requireLock();
            control.trace.push(`auditLog.create:${data.actionType}`);
            if (control.failAudit) {
              throw new Error("Synthetic audit failure");
            }
            current.audits.push(data);
            return data;
          }),
        },
      };

      const result = await operation(tx);
      state = requireLock();
      return result;
    }),
  };

  return { database, control };
}

const LOCAL_DEV_URL = "mysql://root:local_secret@localhost:3306/graduate_system";

describe("DR-1 local-dev initial Full Administrator bootstrap", () => {
  it("parses strict operator CLI arguments and refuses implicit execution", () => {
    expect(parseDr1BootstrapArgs(["--help"]).help).toBe(true);
    expect(
      parseDr1BootstrapArgs(["--email", "admin@earist.edu.ph", "--confirm-local-dev"]),
    ).toEqual({
      help: false,
      email: "admin@earist.edu.ph",
      confirmLocalDev: true,
      authorizationReference: "OWNER-DR1-LOCAL-DEV-ADMIN",
    });

    expect(() => parseDr1BootstrapArgs(["--email", "admin@earist.edu.ph"])).toThrow(/confirm-local-dev/);
    expect(() => parseDr1BootstrapArgs(["--confirm-local-dev"])).toThrow(/--email/);
    expect(() => parseDr1BootstrapArgs(["--email", "admin@earist.edu.ph", "--confirm-local-dev", "--force"])).toThrow(/Unknown/);
  });

  it("enforces local-development graduate_system target guard without leaking credentials", () => {
    expect(assertAuthorizedLocalDevDatabaseTarget(LOCAL_DEV_URL)).toEqual({
      hostname: "localhost",
      port: "3306",
      database: "graduate_system",
    });
    expect(assertAuthorizedLocalDevDatabaseTarget("mysql://user:pw@127.0.0.1:3306/graduate_system")).toEqual({
      hostname: "127.0.0.1",
      port: "3306",
      database: "graduate_system",
    });

    for (const badUrl of [
      undefined,
      "",
      "not-a-url",
      "postgresql://root:secret_pw@localhost:3306/graduate_system",
      "mysql://root:secret_pw@prod-db.earist.edu.ph:3306/graduate_system",
      "mysql://root:secret_pw@localhost:3307/graduate_system",
      "mysql://root:secret_pw@localhost:3306/graduate_system_prod",
    ]) {
      let caught: Error | undefined;
      try {
        assertAuthorizedLocalDevDatabaseTarget(badUrl);
      } catch (error) {
        caught = error as Error;
      }
      expect(caught).toBeInstanceOf(Error);
      expect(caught!.message).not.toContain("secret_pw");
    }
  });

  it("bootstraps only the designated active ADMIN account with FULL access and protected audit, leaving identity/hashes/other users unchanged", async () => {
    const double = createLocalDevDatabaseDouble();
    const targetBefore = structuredClone(double.control.state.users[0]);
    expect(resolveConfiguredAccountAccess(targetBefore).status).toBe("MISSING_ADMIN_LEVEL");

    const fixedTime = new Date("2026-11-11T02:15:00.000Z");
    const result = await bootstrapInitialFullAdministrator(
      { email: "  ADMIN@EARIST.EDU.PH ", authorizationReference: "OWNER-DR1-LOCAL-DEV" },
      { database: double.database as never, databaseUrl: LOCAL_DEV_URL, now: () => fixedTime },
    );

    expect(result).toEqual({
      outcome: "BOOTSTRAPPED",
      targetDatabase: { hostname: "localhost", port: "3306", database: "graduate_system" },
      account: {
        userId: "admin-1-id",
        email: "admin@earist.edu.ph",
        role: "ADMIN",
        isActive: true,
        mustChangePassword: false,
        administratorLevel: "FULL",
        directGrantCount: 0,
        resolvedStatus: "RESOLVED",
        capabilityCount: FULL_ADMINISTRATOR_CAPABILITIES.length,
      },
      auditAction: "ADMINISTRATOR_ACCESS_BOOTSTRAPPED",
      auditLogged: true,
    });

    // Lock order + no User update + no direct capability grant rows
    expect(double.control.trace[0]).toContain("administrator_access_lock");
    expect(double.control.trace[1]).toContain("FROM users");
    expect(double.control.userUpdates).toBe(0);
    expect(double.control.grantWrites).toBe(0);

    // Exact User row preserved; unrelated accounts untouched
    const targetAfter = double.control.state.users[0];
    expect(targetAfter.id).toBe(targetBefore.id);
    expect(targetAfter.email).toBe(targetBefore.email);
    expect(targetAfter.passwordHash).toBe(targetBefore.passwordHash);
    expect(targetAfter.isActive).toBe(true);
    expect(targetAfter.mustChangePassword).toBe(false);
    expect(targetAfter.role).toBe("ADMIN");
    expect(targetAfter.administratorAccess).toEqual({
      level: "FULL",
      createdById: "admin-1-id",
      updatedById: "admin-1-id",
    });
    expect(targetAfter.capabilityGrants).toEqual([]);

    expect(double.control.state.users[1].administratorAccess).toBeNull();
    expect(double.control.state.users[2].role).toBe("PANELIST");
    expect(double.control.state.users[2].administratorAccess).toBeNull();
    expect(double.control.state.users[3].administratorAccess).toBeNull();

    // Resolved access equals complete approved Full Administrator catalog
    const postResolved = resolveConfiguredAccountAccess(targetAfter);
    expect(postResolved).toEqual({
      userId: "admin-1-id",
      status: "RESOLVED",
      category: "ADMIN",
      administratorLevel: "FULL",
      capabilities: FULL_ADMINISTRATOR_CAPABILITIES,
    });

    // Audit row matches protected contract and leaks no secrets
    expect(double.control.state.audits).toHaveLength(1);
    const audit = double.control.state.audits[0] as Record<string, any>;
    expect(audit.actorId).toBe("admin-1-id");
    expect(audit.actionType).toBe("ADMINISTRATOR_ACCESS_BOOTSTRAPPED");
    expect(isProtectedAccessAuditAction(audit.actionType)).toBe(true);
    expect(audit.targetTable).toBe("administrator_access");
    expect(audit.targetId).toBe("admin-1-id");
    expect(JSON.parse(audit.oldValue)).toEqual({
      administratorLevel: null,
      capabilities: [],
      isActive: true,
    });
    expect(JSON.parse(audit.newValue)).toEqual({
      administratorLevel: "FULL",
      capabilities: [],
      isActive: true,
    });
    expect(JSON.parse(audit.description)).toMatchObject({
      version: 1,
      action: "ADMINISTRATOR_ACCESS_BOOTSTRAPPED",
      actorUserId: "admin-1-id",
      targetUserId: "admin-1-id",
      occurredAt: "2026-11-11T02:15:00.000Z",
      bootstrapScope: "DR-1_LOCAL_DEV_ONLY",
      authorizationReference: "OWNER-DR1-LOCAL-DEV",
    });
    expect(JSON.stringify({ result, audits: double.control.state.audits })).not.toMatch(/local_secret|passwordHash|synthetic_preserved_hash/);

    // Repeat execution is an idempotent no-op with zero new writes or audit duplicates
    const repeatResult = await bootstrapInitialFullAdministrator(
      { email: "admin@earist.edu.ph" },
      { database: double.database as never, databaseUrl: LOCAL_DEV_URL },
    );
    expect(repeatResult).toEqual({
      ...result,
      outcome: "ALREADY_FULL_NOOP",
      auditAction: null,
      auditLogged: false,
    });
    expect(double.control.state.audits).toHaveLength(1);
  });

  it("rolls back completely when audit creation fails", async () => {
    const double = createLocalDevDatabaseDouble();
    double.control.failAudit = true;

    await expect(
      bootstrapInitialFullAdministrator(
        { email: "admin@earist.edu.ph" },
        { database: double.database as never, databaseUrl: LOCAL_DEV_URL },
      ),
    ).rejects.toThrow("Synthetic audit failure");

    expect(double.control.state.users[0].administratorAccess).toBeNull();
    expect(double.control.state.audits).toEqual([]);
  });

  it("fails closed on missing, non-ADMIN, inactive, password-reset-required, pre-restricted, direct-grant, multi-admin, or missing-fence states", async () => {
    // Missing ADMIN (including attempting a PANELIST email)
    const missingDouble = createLocalDevDatabaseDouble();
    await expect(
      bootstrapInitialFullAdministrator(
        { email: "panelist1@earist.edu.ph" },
        { database: missingDouble.database as never, databaseUrl: LOCAL_DEV_URL },
      ),
    ).rejects.toMatchObject({ statusCode: 404 });

    // Inactive ADMIN
    const inactiveDouble = createLocalDevDatabaseDouble();
    inactiveDouble.control.state.users[0].isActive = false;
    await expect(
      bootstrapInitialFullAdministrator(
        { email: "admin@earist.edu.ph" },
        { database: inactiveDouble.database as never, databaseUrl: LOCAL_DEV_URL },
      ),
    ).rejects.toMatchObject({ statusCode: 409 });

    // mustChangePassword = true
    const mcpDouble = createLocalDevDatabaseDouble();
    mcpDouble.control.state.users[0].mustChangePassword = true;
    await expect(
      bootstrapInitialFullAdministrator(
        { email: "admin@earist.edu.ph" },
        { database: mcpDouble.database as never, databaseUrl: LOCAL_DEV_URL },
      ),
    ).rejects.toMatchObject({ statusCode: 409 });

    // Unexpected RESTRICTED level
    const restrictedDouble = createLocalDevDatabaseDouble();
    restrictedDouble.control.state.users[0].administratorAccess = { level: "RESTRICTED" };
    await expect(
      bootstrapInitialFullAdministrator(
        { email: "admin@earist.edu.ph" },
        { database: restrictedDouble.database as never, databaseUrl: LOCAL_DEV_URL },
      ),
    ).rejects.toMatchObject({ statusCode: 409 });

    // Unexpected direct grants even before or after FULL
    const grantsDouble = createLocalDevDatabaseDouble();
    grantsDouble.control.state.users[0].capabilityGrants = [{ capabilityKey: "students.view" }];
    await expect(
      bootstrapInitialFullAdministrator(
        { email: "admin@earist.edu.ph" },
        { database: grantsDouble.database as never, databaseUrl: LOCAL_DEV_URL },
      ),
    ).rejects.toMatchObject({ statusCode: 409 });

    // Another ADMIN already has administratorAccess
    const otherFullDouble = createLocalDevDatabaseDouble();
    otherFullDouble.control.state.users[1].administratorAccess = { level: "FULL" };
    await expect(
      bootstrapInitialFullAdministrator(
        { email: "admin@earist.edu.ph" },
        { database: otherFullDouble.database as never, databaseUrl: LOCAL_DEV_URL },
      ),
    ).rejects.toMatchObject({ statusCode: 409 });

    // Missing singleton fence row
    const noFenceDouble = createLocalDevDatabaseDouble();
    noFenceDouble.control.missingFence = true;
    await expect(
      bootstrapInitialFullAdministrator(
        { email: "admin@earist.edu.ph" },
        { database: noFenceDouble.database as never, databaseUrl: LOCAL_DEV_URL },
      ),
    ).rejects.toMatchObject({ statusCode: 503 });

    expect(noFenceDouble.control.state.users[0].administratorAccess).toBeNull();
    expect(noFenceDouble.control.state.audits).toEqual([]);
  });

  it("keeps direct access and management rollout gates disabled", () => {
    expect(DIRECT_ACCESS_ENFORCEMENT_ENABLED).toBe(false);
    expect(ADMINISTRATOR_MANAGEMENT_ENABLED).toBe(false);
    expect(Prisma.TransactionIsolationLevel.ReadCommitted).toBe("ReadCommitted");
  });
});
