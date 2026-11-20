import prisma from "../config/database";
import { AppError } from "../utils/AppError";
import { validateOfficialFormSignatureImage } from "./official-form-signature-image";

export const INSTITUTIONAL_OFFICIALS_SETTING_KEY = "institutional_officials";
export const INSTITUTIONAL_OFFICIAL_ROLES = ["dean", "vpaa", "president"] as const;
export type InstitutionalOfficialRole = (typeof INSTITUTIONAL_OFFICIAL_ROLES)[number];
export type InstitutionalOfficialDbRole = "DEAN" | "VPAA" | "PRESIDENT";

export interface InstitutionalOfficialEntry {
  name: string;
  signatureData: string | null;
  updatedAt: string | null;
  effectiveFrom?: string | null;
}

export interface InstitutionalOfficialsConfig {
  dean: InstitutionalOfficialEntry;
  vpaa: InstitutionalOfficialEntry;
  president: InstitutionalOfficialEntry;
}

export interface InstitutionalOfficialTermDto {
  id: string;
  role: InstitutionalOfficialRole;
  name: string;
  hasSignature: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
  isCurrent: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InstitutionalOfficialHistoryResponse {
  current: InstitutionalOfficialsConfig;
  terms: Record<InstitutionalOfficialRole, InstitutionalOfficialTermDto[]>;
}

export type InstitutionalOfficialUpdatePayload = Partial<
  Record<
    InstitutionalOfficialRole,
    {
      name?: string | null;
      signatureData?: string | null;
    }
  >
>;

export interface InstitutionalOfficialTransitionInput {
  role: InstitutionalOfficialRole;
  name: string;
  signatureData?: string | null;
  effectiveFrom: string;
}

export interface OfficialTermRecord {
  id: string;
  role: InstitutionalOfficialDbRole;
  name: string;
  signatureData: string | null;
  effectiveFrom: Date | string;
  effectiveTo: Date | string | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

const ROLE_LABELS: Record<InstitutionalOfficialRole, string> = {
  dean: "Dean, Graduate School",
  vpaa: "Vice President for Academic Affairs",
  president: "University President",
};

const ROLE_TO_DB: Record<InstitutionalOfficialRole, InstitutionalOfficialDbRole> = {
  dean: "DEAN",
  vpaa: "VPAA",
  president: "PRESIDENT",
};

const DB_TO_ROLE: Record<InstitutionalOfficialDbRole, InstitutionalOfficialRole> = {
  DEAN: "dean",
  VPAA: "vpaa",
  PRESIDENT: "president",
};

const MAX_OFFICIAL_NAME_LENGTH = 120;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function emptyEntry(): InstitutionalOfficialEntry {
  return { name: "", signatureData: null, updatedAt: null };
}

export function emptyInstitutionalOfficials(): InstitutionalOfficialsConfig {
  return {
    dean: emptyEntry(),
    vpaa: emptyEntry(),
    president: emptyEntry(),
  };
}

export function isValidIsoDateString(value: string): boolean {
  if (!ISO_DATE_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

export function formatIsoCalendarDate(value: Date | string): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (ISO_DATE_RE.test(trimmed)) return trimmed;
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
    return trimmed.slice(0, 10);
  }
  return value.toISOString().slice(0, 10);
}

export function formatManilaCalendarDate(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(date);
}

export function parseIsoDateToUtcDate(isoDate: string): Date {
  if (!isValidIsoDateString(isoDate)) {
    throw new AppError("Effective date must be a valid YYYY-MM-DD date.", 400);
  }
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function previousCalendarDayIso(isoDate: string): string {
  const dt = parseIsoDateToUtcDate(isoDate);
  dt.setUTCDate(dt.getUTCDate() - 1);
  return dt.toISOString().slice(0, 10);
}

export function normalizeAsOfDateIso(
  asOfDate: Date | string | null | undefined,
): string | null {
  if (asOfDate === null || asOfDate === undefined) return null;
  if (typeof asOfDate === "string") {
    const trimmed = asOfDate.trim();
    if (!trimmed) return null;
    if (ISO_DATE_RE.test(trimmed) && isValidIsoDateString(trimmed)) {
      return trimmed;
    }
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) return null;
    return formatManilaCalendarDate(parsed);
  }
  if (Number.isNaN(asOfDate.getTime())) return null;
  return formatManilaCalendarDate(asOfDate);
}

/**
 * Pure date-anchored resolution of an office holder for a given role.
 *
 * Terms are evaluated by inclusive calendar-date bounds [effectiveFrom, effectiveTo].
 * - When `asOfDate` is omitted/null: resolves the current open term (`effectiveTo === null`),
 *   or the latest term if all are closed.
 * - When `asOfDate` is provided:
 *   1. Returns the matching term with the latest `effectiveFrom` whose bounds cover `asOfDate`.
 *   2. If `asOfDate` predates all recorded terms, falls back to the earliest recorded term
 *      so older documents never print blank due to term tracking starting later.
 *   3. Otherwise falls back to the latest term whose `effectiveFrom <= asOfDate`, or latest overall.
 */
export function resolveOfficialTermForDate(
  terms: readonly OfficialTermRecord[],
  asOfDate?: Date | string | null,
): OfficialTermRecord | null {
  if (!terms || terms.length === 0) return null;

  const sorted = [...terms].sort((a, b) => {
    const fromA = formatIsoCalendarDate(a.effectiveFrom);
    const fromB = formatIsoCalendarDate(b.effectiveFrom);
    if (fromA !== fromB) return fromA.localeCompare(fromB);
    const createdA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const createdB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return createdA - createdB;
  });

  const targetIso = normalizeAsOfDateIso(asOfDate);
  if (!targetIso) {
    const openTerms = sorted.filter((term) => term.effectiveTo === null);
    if (openTerms.length > 0) {
      return openTerms[openTerms.length - 1];
    }
    return sorted[sorted.length - 1];
  }

  const exactMatches = sorted.filter((term) => {
    const fromIso = formatIsoCalendarDate(term.effectiveFrom);
    const toIso =
      term.effectiveTo !== null ? formatIsoCalendarDate(term.effectiveTo) : null;
    return fromIso <= targetIso && (toIso === null || targetIso <= toIso);
  });

  if (exactMatches.length > 0) {
    return exactMatches[exactMatches.length - 1];
  }

  const earliestFrom = formatIsoCalendarDate(sorted[0].effectiveFrom);
  if (targetIso < earliestFrom) {
    return sorted[0];
  }

  const priorTerms = sorted.filter(
    (term) => formatIsoCalendarDate(term.effectiveFrom) <= targetIso,
  );
  if (priorTerms.length > 0) {
    return priorTerms[priorTerms.length - 1];
  }

  return sorted[sorted.length - 1];
}

function normalizeEntry(raw: unknown): InstitutionalOfficialEntry {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return emptyEntry();
  }
  const obj = raw as Record<string, unknown>;
  const name = typeof obj.name === "string" ? obj.name.trim() : "";
  const signatureData =
    typeof obj.signatureData === "string" && obj.signatureData.trim().length > 0
      ? obj.signatureData.trim()
      : null;
  const updatedAt =
    typeof obj.updatedAt === "string" && obj.updatedAt.trim().length > 0
      ? obj.updatedAt.trim()
      : null;
  return { name, signatureData, updatedAt };
}

export function parseInstitutionalOfficialsSetting(
  rawValue: string | null | undefined,
): InstitutionalOfficialsConfig {
  if (!rawValue || typeof rawValue !== "string") {
    return emptyInstitutionalOfficials();
  }
  try {
    const parsed = JSON.parse(rawValue) as Record<string, unknown> | null;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return emptyInstitutionalOfficials();
    }
    return {
      dean: normalizeEntry(parsed.dean),
      vpaa: normalizeEntry(parsed.vpaa),
      president: normalizeEntry(parsed.president),
    };
  } catch {
    return emptyInstitutionalOfficials();
  }
}

export async function loadInstitutionalOfficials(
  db: any = prisma,
): Promise<InstitutionalOfficialsConfig> {
  if (!db || typeof db.systemSetting?.findUnique !== "function") {
    return emptyInstitutionalOfficials();
  }
  const row = await db.systemSetting.findUnique({
    where: { settingKey: INSTITUTIONAL_OFFICIALS_SETTING_KEY },
    select: { settingValue: true },
  });
  return parseInstitutionalOfficialsSetting(row?.settingValue ?? null);
}

/**
 * Resolves authoritative Dean, VPAA, and University President names & e-signatures
 * effective on `asOfDate` (or current active office holders when omitted).
 * Falls back cleanly to `system_settings.institutional_officials` for any role
 * that does not yet have explicit term rows.
 */
export async function loadInstitutionalOfficialsAsOf(
  asOfDate?: Date | string | null,
  db: any = prisma,
): Promise<InstitutionalOfficialsConfig> {
  const baseline = await loadInstitutionalOfficials(db);
  if (!db || typeof db.institutionalOfficialTerm?.findMany !== "function") {
    return baseline;
  }

  const allTerms = (await db.institutionalOfficialTerm.findMany({
    orderBy: [{ effectiveFrom: "asc" }, { createdAt: "asc" }],
  })) as OfficialTermRecord[];

  if (!Array.isArray(allTerms) || allTerms.length === 0) {
    return baseline;
  }

  const resolved: InstitutionalOfficialsConfig = {
    dean: { ...baseline.dean },
    vpaa: { ...baseline.vpaa },
    president: { ...baseline.president },
  };

  for (const role of INSTITUTIONAL_OFFICIAL_ROLES) {
    const dbRole = ROLE_TO_DB[role];
    const roleTerms = allTerms.filter((t) => t.role === dbRole);
    if (roleTerms.length === 0) continue;

    const matched = resolveOfficialTermForDate(roleTerms, asOfDate);
    if (matched) {
      resolved[role] = {
        name: matched.name.trim(),
        signatureData:
          typeof matched.signatureData === "string" &&
          matched.signatureData.trim().length > 0
            ? matched.signatureData.trim()
            : null,
        updatedAt: matched.updatedAt
          ? new Date(matched.updatedAt).toISOString()
          : baseline[role].updatedAt,
        effectiveFrom: formatIsoCalendarDate(matched.effectiveFrom),
      };
    }
  }

  return resolved;
}

export async function listInstitutionalOfficialHistory(
  db: any = prisma,
): Promise<InstitutionalOfficialHistoryResponse> {
  const current = await loadInstitutionalOfficialsAsOf(null, db);
  const termsByRole: Record<
    InstitutionalOfficialRole,
    InstitutionalOfficialTermDto[]
  > = {
    dean: [],
    vpaa: [],
    president: [],
  };

  if (db && typeof db.institutionalOfficialTerm?.findMany === "function") {
    const rows = (await db.institutionalOfficialTerm.findMany({
      orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
    })) as OfficialTermRecord[];

    for (const row of rows) {
      const role = DB_TO_ROLE[row.role];
      if (!role) continue;
      termsByRole[role].push({
        id: row.id,
        role,
        name: row.name,
        hasSignature: Boolean(row.signatureData && row.signatureData.trim()),
        effectiveFrom: formatIsoCalendarDate(row.effectiveFrom),
        effectiveTo:
          row.effectiveTo !== null
            ? formatIsoCalendarDate(row.effectiveTo)
            : null,
        isCurrent: row.effectiveTo === null,
        createdAt: row.createdAt
          ? new Date(row.createdAt).toISOString()
          : new Date().toISOString(),
        updatedAt: row.updatedAt
          ? new Date(row.updatedAt).toISOString()
          : new Date().toISOString(),
      });
    }
  }

  return { current, terms: termsByRole };
}

export async function updateInstitutionalOfficials(
  input: InstitutionalOfficialUpdatePayload,
  actorId: string,
  db: any = prisma,
): Promise<InstitutionalOfficialsConfig> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new AppError("Institutional officials payload must be an object.", 400);
  }
  if (!actorId) {
    throw new AppError("Authenticated Admin identity is required.", 401);
  }

  const current = await loadInstitutionalOfficials(db);
  const nowIso = new Date().toISOString();
  const next: InstitutionalOfficialsConfig = {
    dean: { ...current.dean },
    vpaa: { ...current.vpaa },
    president: { ...current.president },
  };
  const changedRoles = new Set<InstitutionalOfficialRole>();

  for (const role of INSTITUTIONAL_OFFICIAL_ROLES) {
    if (!Object.prototype.hasOwnProperty.call(input, role)) continue;
    const patch = input[role];
    if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
      throw new AppError(`Invalid payload for ${ROLE_LABELS[role]}.`, 400);
    }

    let changed = false;
    if (Object.prototype.hasOwnProperty.call(patch, "name")) {
      const rawName = patch.name ?? "";
      if (typeof rawName !== "string") {
        throw new AppError(`${ROLE_LABELS[role]} name must be text.`, 400);
      }
      const trimmedName = rawName.trim();
      if (trimmedName.length > MAX_OFFICIAL_NAME_LENGTH) {
        throw new AppError(
          `${ROLE_LABELS[role]} name must be ${MAX_OFFICIAL_NAME_LENGTH} characters or fewer.`,
          400,
        );
      }
      if (trimmedName !== next[role].name) {
        next[role].name = trimmedName;
        changed = true;
      }
    }

    if (Object.prototype.hasOwnProperty.call(patch, "signatureData")) {
      const rawSig = patch.signatureData;
      if (rawSig === null || (typeof rawSig === "string" && rawSig.trim() === "")) {
        if (next[role].signatureData !== null) {
          next[role].signatureData = null;
          changed = true;
        }
      } else if (typeof rawSig === "string") {
        const trimmedSig = rawSig.trim();
        try {
          await validateOfficialFormSignatureImage(trimmedSig);
        } catch (error) {
          if (error instanceof AppError) {
            throw new AppError(
              `${ROLE_LABELS[role]} signature must be a valid PNG or JPEG image within official-form limits.`,
              error.statusCode === 413 ? 413 : 422,
            );
          }
          throw error;
        }
        if (trimmedSig !== next[role].signatureData) {
          next[role].signatureData = trimmedSig;
          changed = true;
        }
      } else {
        throw new AppError(
          `${ROLE_LABELS[role]} signature must be a valid image data URL or null.`,
          400,
        );
      }
    }

    if (changed) {
      next[role].updatedAt = nowIso;
      changedRoles.add(role);
    }
  }

  const serialized = JSON.stringify({
    dean: {
      name: next.dean.name,
      signatureData: next.dean.signatureData,
      updatedAt: next.dean.updatedAt,
    },
    vpaa: {
      name: next.vpaa.name,
      signatureData: next.vpaa.signatureData,
      updatedAt: next.vpaa.updatedAt,
    },
    president: {
      name: next.president.name,
      signatureData: next.president.signatureData,
      updatedAt: next.president.updatedAt,
    },
  });

  const runWrite = async (client: any) => {
    await client.systemSetting.upsert({
      where: { settingKey: INSTITUTIONAL_OFFICIALS_SETTING_KEY },
      update: {
        settingValue: serialized,
        lastModifiedById: actorId,
      },
      create: {
        settingKey: INSTITUTIONAL_OFFICIALS_SETTING_KEY,
        settingValue: serialized,
        settingType: "JSON",
        label: "Institutional Officials",
        description:
          "Authoritative names and e-signatures for Dean, VPAA, and University President on official defense forms.",
        isEditableByAdmin: true,
        lastModifiedById: actorId,
      },
    });

    // Keep the current active term row synchronized when updating current holder details in place.
    if (
      changedRoles.size > 0 &&
      typeof client.institutionalOfficialTerm?.findFirst === "function"
    ) {
      const todayDate = parseIsoDateToUtcDate(formatManilaCalendarDate());
      for (const role of changedRoles) {
        const dbRole = ROLE_TO_DB[role];
        const activeTerm = await client.institutionalOfficialTerm.findFirst({
          where: { role: dbRole, effectiveTo: null },
          orderBy: { effectiveFrom: "desc" },
        });
        if (activeTerm) {
          await client.institutionalOfficialTerm.update({
            where: { id: activeTerm.id },
            data: {
              name: next[role].name,
              signatureData: next[role].signatureData,
              updatedById: actorId,
            },
          });
        } else if (next[role].name.trim().length > 0) {
          await client.institutionalOfficialTerm.create({
            data: {
              role: dbRole,
              name: next[role].name,
              signatureData: next[role].signatureData,
              effectiveFrom: todayDate,
              effectiveTo: null,
              createdById: actorId,
              updatedById: actorId,
            },
          });
        }
      }
    }

    if (typeof client.auditLog?.create === "function") {
      await client.auditLog.create({
        data: {
          actorId,
          actionType: "INSTITUTIONAL_OFFICIALS_UPDATED",
          targetTable: "system_settings",
          targetId: INSTITUTIONAL_OFFICIALS_SETTING_KEY,
          oldValue: JSON.stringify({
            dean: { name: current.dean.name, hasSignature: Boolean(current.dean.signatureData) },
            vpaa: { name: current.vpaa.name, hasSignature: Boolean(current.vpaa.signatureData) },
            president: {
              name: current.president.name,
              hasSignature: Boolean(current.president.signatureData),
            },
          }),
          newValue: JSON.stringify({
            dean: { name: next.dean.name, hasSignature: Boolean(next.dean.signatureData) },
            vpaa: { name: next.vpaa.name, hasSignature: Boolean(next.vpaa.signatureData) },
            president: {
              name: next.president.name,
              hasSignature: Boolean(next.president.signatureData),
            },
          }),
          description: "Updated Institutional Officials names and e-signatures.",
        },
      });
    }
  };

  if (typeof db.$transaction === "function") {
    await db.$transaction(async (tx: any) => {
      await runWrite(tx);
    });
  } else {
    await runWrite(db);
  }

  return next;
}

/**
 * Records a formal office-holder term transition for Dean, VPAA, or President:
 * - Closes the previous active term on the calendar day prior to `effectiveFrom`
 * - Preserves an existing unversioned `system_settings` holder as a closed baseline term if needed
 * - Creates the new active term with `effectiveTo = null`
 * - Synchronizes `system_settings.institutional_officials` and writes an immutable `AuditLog`
 */
export async function recordInstitutionalOfficialTransition(
  input: InstitutionalOfficialTransitionInput,
  actorId: string,
  db: any = prisma,
): Promise<InstitutionalOfficialHistoryResponse> {
  if (!actorId) {
    throw new AppError("Authenticated Admin identity is required.", 401);
  }
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new AppError("Term transition payload must be an object.", 400);
  }
  if (!INSTITUTIONAL_OFFICIAL_ROLES.includes(input.role)) {
    throw new AppError("Invalid institutional official role.", 400);
  }

  const role = input.role;
  const dbRole = ROLE_TO_DB[role];
  const label = ROLE_LABELS[role];

  const trimmedName = typeof input.name === "string" ? input.name.trim() : "";
  if (!trimmedName) {
    throw new AppError(`${label} name is required.`, 400);
  }
  if (trimmedName.length > MAX_OFFICIAL_NAME_LENGTH) {
    throw new AppError(
      `${label} name must be ${MAX_OFFICIAL_NAME_LENGTH} characters or fewer.`,
      400,
    );
  }

  const effectiveFromIso =
    typeof input.effectiveFrom === "string" ? input.effectiveFrom.trim() : "";
  const effectiveFromDate = parseIsoDateToUtcDate(effectiveFromIso);

  let normalizedSignature: string | null = null;
  if (
    typeof input.signatureData === "string" &&
    input.signatureData.trim().length > 0
  ) {
    const trimmedSig = input.signatureData.trim();
    try {
      await validateOfficialFormSignatureImage(trimmedSig);
    } catch (error) {
      if (error instanceof AppError) {
        throw new AppError(
          `${label} signature must be a valid PNG or JPEG image within official-form limits.`,
          error.statusCode === 413 ? 413 : 422,
        );
      }
      throw error;
    }
    normalizedSignature = trimmedSig;
  }

  const runTransition = async (client: any) => {
    const currentSettings = await loadInstitutionalOfficials(client);
    const existingTerms = (await client.institutionalOfficialTerm.findMany({
      where: { role: dbRole },
      orderBy: [{ effectiveFrom: "asc" }, { createdAt: "asc" }],
    })) as OfficialTermRecord[];

    const dayBeforeIso = previousCalendarDayIso(effectiveFromIso);
    const dayBeforeDate = parseIsoDateToUtcDate(dayBeforeIso);

    let previousHolderName: string | null = null;

    if (existingTerms.length === 0) {
      // Preserve an existing pre-history holder from system_settings as a closed baseline term.
      const priorEntry = currentSettings[role];
      if (priorEntry.name.trim().length > 0) {
        previousHolderName = priorEntry.name.trim();
        const priorUpdatedIso = priorEntry.updatedAt
          ? normalizeAsOfDateIso(priorEntry.updatedAt)
          : null;
        const baselineStartIso =
          priorUpdatedIso && priorUpdatedIso <= dayBeforeIso
            ? priorUpdatedIso
            : dayBeforeIso;
        await client.institutionalOfficialTerm.create({
          data: {
            role: dbRole,
            name: previousHolderName,
            signatureData: priorEntry.signatureData,
            effectiveFrom: parseIsoDateToUtcDate(baselineStartIso),
            effectiveTo: dayBeforeDate,
            createdById: actorId,
            updatedById: actorId,
          },
        });
      }
    } else {
      const latestTerm = existingTerms[existingTerms.length - 1];
      const latestFromIso = formatIsoCalendarDate(latestTerm.effectiveFrom);
      if (effectiveFromIso <= latestFromIso) {
        throw new AppError(
          `Effective date must be after the current ${label} term start date (${latestFromIso}).`,
          400,
        );
      }
      previousHolderName = latestTerm.name;
      if (latestTerm.effectiveTo === null) {
        await client.institutionalOfficialTerm.update({
          where: { id: latestTerm.id },
          data: {
            effectiveTo: dayBeforeDate,
            updatedById: actorId,
          },
        });
      }
    }

    const createdTerm = await client.institutionalOfficialTerm.create({
      data: {
        role: dbRole,
        name: trimmedName,
        signatureData: normalizedSignature,
        effectiveFrom: effectiveFromDate,
        effectiveTo: null,
        createdById: actorId,
        updatedById: actorId,
      },
    });

    const nowIso = new Date().toISOString();
    const nextSettings: InstitutionalOfficialsConfig = {
      dean: {
        name: currentSettings.dean.name,
        signatureData: currentSettings.dean.signatureData,
        updatedAt: currentSettings.dean.updatedAt,
      },
      vpaa: {
        name: currentSettings.vpaa.name,
        signatureData: currentSettings.vpaa.signatureData,
        updatedAt: currentSettings.vpaa.updatedAt,
      },
      president: {
        name: currentSettings.president.name,
        signatureData: currentSettings.president.signatureData,
        updatedAt: currentSettings.president.updatedAt,
      },
    };
    nextSettings[role] = {
      name: trimmedName,
      signatureData: normalizedSignature,
      updatedAt: nowIso,
    };

    await client.systemSetting.upsert({
      where: { settingKey: INSTITUTIONAL_OFFICIALS_SETTING_KEY },
      update: {
        settingValue: JSON.stringify(nextSettings),
        lastModifiedById: actorId,
      },
      create: {
        settingKey: INSTITUTIONAL_OFFICIALS_SETTING_KEY,
        settingValue: JSON.stringify(nextSettings),
        settingType: "JSON",
        label: "Institutional Officials",
        description:
          "Authoritative names and e-signatures for Dean, VPAA, and University President on official defense forms.",
        isEditableByAdmin: true,
        lastModifiedById: actorId,
      },
    });

    if (typeof client.auditLog?.create === "function") {
      await client.auditLog.create({
        data: {
          actorId,
          actionType: "INSTITUTIONAL_OFFICIAL_TERM_RECORDED",
          targetTable: "institutional_official_terms",
          targetId: createdTerm.id,
          oldValue: JSON.stringify({
            role,
            name: previousHolderName,
          }),
          newValue: JSON.stringify({
            role,
            name: trimmedName,
            effectiveFrom: effectiveFromIso,
            hasSignature: Boolean(normalizedSignature),
          }),
          description: `Recorded ${label} term transition to ${trimmedName} effective ${effectiveFromIso}.`,
        },
      });
    }
  };

  if (typeof db.$transaction === "function") {
    await db.$transaction(async (tx: any) => {
      await runTransition(tx);
    });
  } else {
    await runTransition(db);
  }

  return listInstitutionalOfficialHistory(db);
}
