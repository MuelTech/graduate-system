import { AppError } from "../utils/AppError";
import { normalizeAccountEmail } from "../utils/account-email";
import { resolveConfiguredAccountAccess, type AccountAccessSnapshot, type AdminAccessLevel } from "./account-access";
import { validateDirectCapabilityKeys, type CapabilityKey } from "./capability-catalog";

/** Code-owned rollout boundary. No environment variable, DTO or stored setting enables it. */
export const ADMINISTRATOR_MANAGEMENT_ENABLED: boolean = false;

export function assertFullAdministrator(account: (AccountAccessSnapshot & { mustChangePassword: boolean }) | null) {
  const access = resolveConfiguredAccountAccess(account);
  if (!account || account.mustChangePassword !== false || access.status !== "RESOLVED" ||
      access.category !== "ADMIN" || access.administratorLevel !== "FULL") {
    throw new AppError("Full Administrator authority is required.", 403);
  }
}

function boundedObject(input: unknown, allowed: readonly string[]): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(input)) ||
      Object.keys(input).some(key => !allowed.includes(key))) {
    throw new AppError("Invalid Administrator management fields.", 400);
  }
  return input as Record<string, unknown>;
}
function level(value: unknown): AdminAccessLevel {
  if (value !== "FULL" && value !== "RESTRICTED") throw new AppError("Invalid Administrator access level.", 400);
  return value;
}
function keys(value: unknown): readonly CapabilityKey[] {
  try { return validateDirectCapabilityKeys("ADMIN", value as readonly unknown[]); }
  catch { throw new AppError("Invalid administrative capability list.", 400); }
}
function text(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 191) {
    throw new AppError("Administrator identity fields must be non-empty text of at most 191 characters.", 400);
  }
  return value.trim();
}
export interface AdministratorAccessInput {
  level: AdminAccessLevel;
  capabilityKeys: readonly CapabilityKey[];
}
export function validateAdministratorConfiguration(input: AdministratorAccessInput): AdministratorAccessInput {
  // Preserve FACULTY-1 storage semantics: Full resolves the enumerated Admin catalog;
  // any stored direct keys still undergo category/duplicate validation.
  return { level: level(input.level), capabilityKeys: keys(input.capabilityKeys) };
}
export function parseAdministratorCreate(input: unknown) {
  const data = boundedObject(input, ["email", "firstName", "lastName", "level", "capabilityKeys"]);
  const email = normalizeAccountEmail(text(data.email));
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AppError("A valid email address is required.", 400);
  return { email, firstName: text(data.firstName), lastName: text(data.lastName),
    ...validateAdministratorConfiguration({ level: level(data.level), capabilityKeys: keys(data.capabilityKeys) }) };
}
export function parseAdministratorPatch(input: unknown) {
  const data = boundedObject(input, ["level", "capabilityKeys", "isActive"]);
  if (!Object.keys(data).length) throw new AppError("At least one Administrator change is required.", 400);
  if ("isActive" in data && typeof data.isActive !== "boolean") throw new AppError("Account status must be a boolean.", 400);
  return {
    ...("level" in data ? { level: level(data.level) } : {}),
    ...("capabilityKeys" in data ? { capabilityKeys: keys(data.capabilityKeys) } : {}),
    ...("isActive" in data ? { isActive: data.isActive as boolean } : {}),
  };
}
export function parseAdministratorPage(input: unknown) {
  const data = boundedObject(input, ["page", "pageSize"]);
  function number(value: unknown, fallback: number, max: number) {
    if (value === undefined) return fallback;
    if (typeof value !== "string" || !/^[1-9]\d*$/.test(value) || Number(value) > max) {
      throw new AppError("Invalid Administrator list pagination.", 400);
    }
    return Number(value);
  }
  return { page: number(data.page, 1, 100000), pageSize: number(data.pageSize, 25, 100) };
}
export function administratorId(input: unknown): string { return text(input); }
