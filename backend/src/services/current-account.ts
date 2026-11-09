import { ACADEMIC_ACCOUNT_ROLES, isAcademicAccountRole } from "../utils/academic-account";
import prisma from "../config/database";
import { ACCOUNT_ACCESS_SELECT } from "../access/account-access.store";
import { DIRECT_ACCESS_ENFORCEMENT_ENABLED, deniedConfiguredAccess, resolveConfiguredAccountAccess } from "../access/account-access";
import { AppError } from "../utils/AppError";

export const CURRENT_ACCOUNT_SELECT = {
  ...ACCOUNT_ACCESS_SELECT, email: true, mustChangePassword: true,
} as const;

/** Fresh per request; token role/credential claims are never account authority. */
export async function loadCurrentAccount(userId: string) {
  let account;
  try {
    account = await prisma.user.findUnique({ where: { id: userId }, select: CURRENT_ACCOUNT_SELECT });
  } catch {
    throw new AppError("Current account could not be loaded.", 503);
  }
  if (!account) throw new AppError("Authentication account no longer exists.", 401);
  if (account.id !== userId || !["APPLICANT", "STUDENT", "ADMIN", ...ACADEMIC_ACCOUNT_ROLES].includes(account.role)) {
    throw new AppError("Current account could not be established.", 503);
  }
  if (account.isActive !== true) throw new AppError("Account is inactive.", 403);
  if (isAcademicAccountRole(account.role) && account.panelist?.isActive !== true) {
    throw new AppError("Academic profile is inactive or unavailable.", 403);
  }
  if (typeof account.mustChangePassword !== "boolean") {
    throw new AppError("Current credential state could not be established.", 503);
  }
  return account;
}

export type CurrentAccount = Awaited<ReturnType<typeof loadCurrentAccount>>;

/** Configuration preview only: FACULTY-1 enforcement remains deliberately off. */
export function currentAccountResponse(account: CurrentAccount) {
  const access = account.mustChangePassword
    ? deniedConfiguredAccess(account.id, "UNAVAILABLE")
    : resolveConfiguredAccountAccess(account);
  return {
    user: { id: account.id, email: account.email, role: account.role, mustChangePassword: account.mustChangePassword },
    configuredAccess: {
      status: access.status, administratorLevel: access.administratorLevel, capabilities: access.capabilities,
    },
    directAccessEnforcementEnabled: DIRECT_ACCESS_ENFORCEMENT_ENABLED,
  };
}
