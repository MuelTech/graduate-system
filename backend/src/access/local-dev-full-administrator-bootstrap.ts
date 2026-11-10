import { Prisma, type PrismaClient } from "@prisma/client";
import { ACCESS_AUDIT_ACTIONS, type AccessAuditEvent, type AccessAuditState } from "./access-audit";
import {
  resolveConfiguredAccountAccess,
  type ConfiguredAccountAccess,
} from "./account-access";
import { ACCOUNT_ACCESS_SELECT } from "./account-access.store";
import { FULL_ADMINISTRATOR_CAPABILITIES } from "./capability-catalog";
import { accountEmailWhere, normalizeAccountEmail } from "../utils/account-email";
import { AppError } from "../utils/AppError";

export const AUTHORIZED_LOCAL_DEV_HOSTS = Object.freeze(["localhost", "127.0.0.1"] as const);
export const AUTHORIZED_LOCAL_DEV_PORT = "3306";
export const AUTHORIZED_LOCAL_DEV_DATABASE = "graduate_system";
export const DEFAULT_LOCAL_DEV_AUTHORIZATION_REF = "OWNER-DR1-LOCAL-DEV-ADMIN";
const MAX_AUTHORIZATION_REF_LENGTH = 128;

export interface LocalDevDatabaseTarget {
  readonly hostname: string;
  readonly port: string;
  readonly database: string;
}

export interface LocalDevFullAdministratorBootstrapCliArgs {
  readonly help: boolean;
  readonly email: string;
  readonly confirmLocalDev: boolean;
  readonly authorizationReference: string;
}

export interface LocalDevFullAdministratorBootstrapInput {
  readonly email: string;
  readonly authorizationReference?: string;
}

export interface LocalDevFullAdministratorBootstrapDependencies {
  readonly database?: Pick<PrismaClient, "$transaction">;
  readonly databaseUrl?: string;
  readonly now?: () => Date;
}

export interface LocalDevFullAdministratorBootstrapResult {
  readonly outcome: "BOOTSTRAPPED" | "ALREADY_FULL_NOOP";
  readonly targetDatabase: LocalDevDatabaseTarget;
  readonly account: {
    readonly userId: string;
    readonly email: string;
    readonly role: "ADMIN";
    readonly isActive: boolean;
    readonly mustChangePassword: boolean;
    readonly administratorLevel: "FULL";
    readonly directGrantCount: number;
    readonly resolvedStatus: ConfiguredAccountAccess["status"];
    readonly capabilityCount: number;
  };
  readonly auditAction: typeof ACCESS_AUDIT_ACTIONS.ADMINISTRATOR_BOOTSTRAPPED | null;
  readonly auditLogged: boolean;
}

const BOOTSTRAP_TARGET_SELECT = {
  ...ACCOUNT_ACCESS_SELECT,
  email: true,
  emailAdminKey: true,
  mustChangePassword: true,
} as const satisfies Prisma.UserSelect;

export type LocalDevFullAdministratorBootstrapCandidate = Prisma.UserGetPayload<{
  select: typeof BOOTSTRAP_TARGET_SELECT;
}>;

/**
 * Parses explicit CLI arguments for bounded local-dev Full Administrator bootstrap.
 * Never defaults email or local-dev confirmation.
 */
export function parseLocalDevFullAdministratorBootstrapArgs(
  argv: readonly string[],
): LocalDevFullAdministratorBootstrapCliArgs {
  if (argv.includes("--help")) {
    return {
      help: true,
      email: "",
      confirmLocalDev: false,
      authorizationReference: DEFAULT_LOCAL_DEV_AUTHORIZATION_REF,
    };
  }

  let email: string | undefined;
  let confirmLocalDev = false;
  let authorizationReference: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--confirm-local-dev") {
      if (confirmLocalDev) throw new AppError("Duplicate --confirm-local-dev flag.", 400);
      confirmLocalDev = true;
      continue;
    }
    if (arg === "--email" || arg === "--authorization-ref") {
      const value = argv[i + 1];
      if (!value || value.startsWith("--")) {
        throw new AppError(`Missing value for ${arg}.`, 400);
      }
      if (arg === "--email") {
        if (email !== undefined) throw new AppError("Duplicate --email flag.", 400);
        email = value;
      } else {
        if (authorizationReference !== undefined) {
          throw new AppError("Duplicate --authorization-ref flag.", 400);
        }
        authorizationReference = value;
      }
      i++;
      continue;
    }
    throw new AppError(`Unknown CLI option: ${arg}`, 400);
  }

  if (!confirmLocalDev) {
    throw new AppError("Explicit --confirm-local-dev flag is required for local DR-1 bootstrap.", 400);
  }
  if (!email) {
    throw new AppError("Explicit --email <address> is required for DR-1 bootstrap.", 400);
  }

  return {
    help: false,
    email,
    confirmLocalDev: true,
    authorizationReference: sanitizeAuthorizationReference(authorizationReference),
  };
}

function sanitizeAuthorizationReference(value?: string): string {
  const trimmed = (value ?? DEFAULT_LOCAL_DEV_AUTHORIZATION_REF).trim();
  if (!trimmed || trimmed.length > MAX_AUTHORIZATION_REF_LENGTH || /[\r\n\0]/.test(trimmed)) {
    throw new AppError("Invalid DR-1 authorization reference.", 400);
  }
  return trimmed;
}

/**
 * Enforces that the target DB is strictly local development (`localhost`/`127.0.0.1`:3306 `graduate_system`).
 * Never logs or reflects the raw URL, username, or password in errors or return values.
 */
export function assertAuthorizedLocalDevDatabaseTarget(
  databaseUrl: string | undefined,
): LocalDevDatabaseTarget {
  if (typeof databaseUrl !== "string" || !databaseUrl.trim()) {
    throw new AppError("DATABASE_URL must be configured before running local DR-1 bootstrap.", 500);
  }
  let parsed: URL;
  try {
    parsed = new URL(databaseUrl.trim());
  } catch {
    throw new AppError("DATABASE_URL is malformed; refusing DR-1 bootstrap.", 500);
  }
  if (parsed.protocol !== "mysql:" && parsed.protocol !== "mariadb:") {
    throw new AppError("Unsupported database protocol; refusing DR-1 bootstrap.", 403);
  }
  const hostname = parsed.hostname.toLowerCase();
  const port = parsed.port || AUTHORIZED_LOCAL_DEV_PORT;
  const database = parsed.pathname.replace(/^\/+/, "");
  if (
    !AUTHORIZED_LOCAL_DEV_HOSTS.includes(hostname as (typeof AUTHORIZED_LOCAL_DEV_HOSTS)[number]) ||
    port !== AUTHORIZED_LOCAL_DEV_PORT ||
    database !== AUTHORIZED_LOCAL_DEV_DATABASE
  ) {
    throw new AppError(
      `DR-1 local-development bootstrap refuses non-authorized target (${hostname}:${port}/${database || "<none>"}).`,
      403,
    );
  }
  return Object.freeze({ hostname, port, database });
}

function normalizeTargetEmail(rawEmail: string): string {
  const normalized = normalizeAccountEmail(rawEmail);
  if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new AppError("Designated administrator email is invalid.", 400);
  }
  return normalized;
}

function assertCleanAdminIdentity(
  target: LocalDevFullAdministratorBootstrapCandidate,
  normalizedEmail: string,
): void {
  if (target.role !== "ADMIN") {
    throw new AppError("Designated account does not hold role ADMIN.", 409);
  }
  if (normalizeAccountEmail(target.email) !== normalizedEmail) {
    throw new AppError("Designated account email does not match normalized target.", 409);
  }
  if (target.emailAdminKey !== undefined && target.emailAdminKey !== null && target.emailAdminKey !== normalizedEmail) {
    throw new AppError("Designated account emailAdminKey mismatch.", 409);
  }
  if (target.isActive !== true) {
    throw new AppError("Designated ADMIN account is inactive; refusing DR-1 bootstrap.", 409);
  }
  if (target.mustChangePassword !== false) {
    throw new AppError("Designated ADMIN account requires a password change; refusing DR-1 bootstrap.", 409);
  }
  if (target.panelist !== null) {
    throw new AppError("Designated ADMIN account unexpectedly carries a panelist profile.", 409);
  }
  if (target.capabilityGrants.length > 0) {
    throw new AppError("Designated ADMIN account already has direct capability grants; refusing implicit mutation.", 409);
  }
}

function formatResult(
  outcome: LocalDevFullAdministratorBootstrapResult["outcome"],
  targetDatabase: LocalDevDatabaseTarget,
  target: LocalDevFullAdministratorBootstrapCandidate,
  resolved: ConfiguredAccountAccess,
  auditLogged: boolean,
): LocalDevFullAdministratorBootstrapResult {
  if (
    resolved.status !== "RESOLVED" ||
    resolved.category !== "ADMIN" ||
    resolved.administratorLevel !== "FULL" ||
    resolved.capabilities.length !== FULL_ADMINISTRATOR_CAPABILITIES.length
  ) {
    throw new AppError("Post-bootstrap configured access did not resolve cleanly as FULL.", 500);
  }
  return {
    outcome,
    targetDatabase,
    account: {
      userId: target.id,
      email: target.email,
      role: "ADMIN",
      isActive: target.isActive,
      mustChangePassword: target.mustChangePassword,
      administratorLevel: "FULL",
      directGrantCount: target.capabilityGrants.length,
      resolvedStatus: resolved.status,
      capabilityCount: resolved.capabilities.length,
    },
    auditAction: auditLogged ? ACCESS_AUDIT_ACTIONS.ADMINISTRATOR_BOOTSTRAPPED : null,
    auditLogged,
  };
}

/**
 * Performs an explicit, operator-invoked, bounded DR-1 initial Full Administrator
 * bootstrap for a designated existing ADMIN account on local development only.
 * Leaves User identity fields, credentials, and unrelated accounts untouched.
 */
export async function bootstrapInitialFullAdministrator(
  input: LocalDevFullAdministratorBootstrapInput,
  dependencies: LocalDevFullAdministratorBootstrapDependencies = {},
): Promise<LocalDevFullAdministratorBootstrapResult> {
  const databaseUrl = dependencies.databaseUrl ?? process.env.DATABASE_URL;
  const now = dependencies.now ?? (() => new Date());

  const targetDatabase = assertAuthorizedLocalDevDatabaseTarget(databaseUrl);
  const normalizedEmail = normalizeTargetEmail(input.email);
  const authorizationReference = sanitizeAuthorizationReference(input.authorizationReference);
  const adminWhere = accountEmailWhere(normalizedEmail, "ADMIN");
  const database = dependencies.database ?? (await import("../config/database")).default;

  return database.$transaction(async tx => {
    const fence = await tx.$queryRaw<Array<{ id: number }>>`SELECT id FROM administrator_access_lock WHERE id = 1 FOR UPDATE`;
    if (fence.length !== 1 || fence[0].id !== 1) {
      throw new AppError("Administrator access fence is unavailable.", 503);
    }
    await tx.$queryRaw`SELECT user_id FROM users WHERE role = 'ADMIN' ORDER BY user_id FOR UPDATE`;

    const matches = await tx.user.findMany({
      where: adminWhere,
      select: BOOTSTRAP_TARGET_SELECT,
    });
    if (matches.length === 0) {
      throw new AppError("Designated ADMIN account was not found.", 404);
    }
    if (matches.length > 1) {
      throw new AppError("Designated ADMIN account identity is ambiguous.", 409);
    }

    const target = matches[0];
    assertCleanAdminIdentity(target, normalizedEmail);

    if (target.administratorAccess !== null) {
      if (target.administratorAccess.level !== "FULL") {
        throw new AppError("Designated account already has non-FULL administrator metadata.", 409);
      }
      const existingResolved = resolveConfiguredAccountAccess(target);
      return formatResult("ALREADY_FULL_NOOP", targetDatabase, target, existingResolved, false);
    }

    const existingAdminAccessRows = await tx.administratorAccess.findMany({
      select: { userId: true, level: true },
    });
    if (existingAdminAccessRows.some(row => row.userId !== target.id)) {
      throw new AppError(
        "Another administrator access record already exists; refusing initial DR-1 bootstrap.",
        409,
      );
    }

    const occurredAt = now();
    const before: AccessAuditState = {
      administratorLevel: null,
      capabilities: [],
      isActive: target.isActive,
    };
    const after: AccessAuditState = {
      administratorLevel: "FULL",
      capabilities: [],
      isActive: target.isActive,
    };
    const auditEvent: AccessAuditEvent & {
      bootstrapScope: "DR-1_LOCAL_DEV_ONLY";
      authorizationReference: string;
    } = {
      version: 1,
      action: ACCESS_AUDIT_ACTIONS.ADMINISTRATOR_BOOTSTRAPPED,
      actorUserId: target.id,
      targetUserId: target.id,
      occurredAt: occurredAt.toISOString(),
      before,
      after,
      bootstrapScope: "DR-1_LOCAL_DEV_ONLY",
      authorizationReference,
    };

    await tx.administratorAccess.create({
      data: {
        userId: target.id,
        level: "FULL",
        createdById: target.id,
        updatedById: target.id,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: target.id,
        actionType: ACCESS_AUDIT_ACTIONS.ADMINISTRATOR_BOOTSTRAPPED,
        targetTable: "administrator_access",
        targetId: target.id,
        oldValue: JSON.stringify(before),
        newValue: JSON.stringify(after),
        description: JSON.stringify(auditEvent),
        createdAt: occurredAt,
      },
    });

    const reloaded = await tx.user.findUnique({
      where: { id: target.id },
      select: BOOTSTRAP_TARGET_SELECT,
    });
    if (!reloaded) {
      throw new AppError("Bootstrapped ADMIN account could not be reloaded.", 500);
    }
    const resolved = resolveConfiguredAccountAccess(reloaded);
    return formatResult("BOOTSTRAPPED", targetDatabase, reloaded, resolved, true);
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
    maxWait: 10000,
    timeout: 15000,
  });
}
