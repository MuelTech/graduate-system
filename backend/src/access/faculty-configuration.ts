import type { Prisma } from "@prisma/client";
import { OperationalAuthorization } from "./operational-authorization";
import { validateDirectCapabilityKeys, type CapabilityKey } from "./capability-catalog";
import { AppError } from "../utils/AppError";
import { normalizeAccountEmail } from "../utils/account-email";

/** Code-owned composition only. No request, environment or DB setting activates Faculty configuration. */
export const FACULTY_CONFIGURATION_ENABLED: boolean = false;
export const facultyAuthorization = new OperationalAuthorization(FACULTY_CONFIGURATION_ENABLED);

export interface FacultyPatch {
  email?: string; firstName?: string; lastName?: string;
  title?: string | null; suffix?: string | null;
  highestEducationalAttainment?: string | null; officeAffiliation?: string | null; specialization?: string | null;
  isActive?: boolean; isExternal?: boolean; isAvailableAsAdviser?: boolean;
  capabilityKeys?: readonly CapabilityKey[];
}
export type FacultyCreate = FacultyPatch & { email: string; firstName: string; lastName: string };
const requiredText = ["email", "firstName", "lastName"] as const;
const nullableText = ["title", "suffix", "highestEducationalAttainment", "officeAffiliation", "specialization"] as const;
const booleans = ["isActive", "isExternal", "isAvailableAsAdviser"] as const;
const allowed = [...requiredText, ...nullableText, ...booleans, "capabilityKeys"];

export function facultyCapabilityKeys(value: unknown): readonly CapabilityKey[] {
  try {
    const keys = validateDirectCapabilityKeys("FACULTY", value as readonly unknown[]);
    if (keys.some(key => key !== "essay.evaluate")) throw new Error("Unsupported Faculty capability.");
    return keys;
  } catch { throw new AppError("Invalid Faculty access selection.", 400); }
}
function text(value: unknown, nullable = false): string | null {
  if (nullable && (value === null || value === "")) return null;
  if (typeof value !== "string" || !value.trim() || value.trim().length > 191) {
    throw new AppError("Profile fields must contain valid text of at most 191 characters.", 400);
  }
  return value.trim();
}
export function facultyId(value: unknown): string { return text(value) as string; }
export function parseFacultyPatch(input: unknown): FacultyPatch {
  if (!input || typeof input !== "object" || Array.isArray(input) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(input)) ||
      !Object.keys(input).length || Reflect.ownKeys(input).some(key => typeof key !== "string" || !allowed.includes(key))) {
    throw new AppError("Invalid Faculty configuration fields.", 400);
  }
  const data = input as Record<string, unknown>; const result: FacultyPatch = {};
  for (const key of requiredText) if (key in data) result[key] = text(data[key]) as string;
  if (result.email) result.email = normalizeAccountEmail(result.email);
  if (result.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email)) throw new AppError("A valid email address is required.", 400);
  for (const key of nullableText) if (key in data) result[key] = text(data[key], true);
  for (const key of booleans) if (key in data) {
    if (typeof data[key] !== "boolean") throw new AppError("Profile options must be true or false.", 400);
    result[key] = data[key] as boolean;
  }
  if ("capabilityKeys" in data) result.capabilityKeys = facultyCapabilityKeys(data.capabilityKeys);
  return result;
}
export function parseFacultyCreate(input: unknown): FacultyCreate {
  const result = parseFacultyPatch(input);
  for (const key of requiredText) if (!result[key]) throw new AppError("Email, first name and last name are required.", 400);
  return result as FacultyCreate;
}

/** Same shared fence as administrative writes, then actor/target User locks. */
export async function lockFacultyEligibility(tx: Prisma.TransactionClient, actorId: string, targetId: string) {
  const fence = await tx.$queryRaw<Array<{ id: number }>>`SELECT id FROM administrator_access_lock WHERE id = 1 FOR UPDATE`;
  if (fence.length !== 1) throw new AppError("Account configuration is unavailable.", 503);
  await tx.$queryRaw`SELECT user_id FROM users WHERE user_id = ${actorId} FOR UPDATE`;
  await tx.$queryRaw`SELECT user_id FROM users WHERE user_id = ${targetId} FOR UPDATE`;
}

/** Existing protected prefix covers these profile/status/access configuration events. */
export const FACULTY_AUDIT_ACTIONS = Object.freeze({
  CREATED: "ACCOUNT_CAPABILITY_FACULTY_CREATED", CONFIGURED: "ACCOUNT_CAPABILITY_FACULTY_CONFIGURED",
});
