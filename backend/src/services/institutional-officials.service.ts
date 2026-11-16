import prisma from "../config/database";
import { AppError } from "../utils/AppError";
import { validateOfficialFormSignatureImage } from "./official-form-signature-image";

export const INSTITUTIONAL_OFFICIALS_SETTING_KEY = "institutional_officials";
export const INSTITUTIONAL_OFFICIAL_ROLES = ["dean", "vpaa", "president"] as const;
export type InstitutionalOfficialRole = (typeof INSTITUTIONAL_OFFICIAL_ROLES)[number];

export interface InstitutionalOfficialEntry {
  name: string;
  signatureData: string | null;
  updatedAt: string | null;
}

export interface InstitutionalOfficialsConfig {
  dean: InstitutionalOfficialEntry;
  vpaa: InstitutionalOfficialEntry;
  president: InstitutionalOfficialEntry;
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

const ROLE_LABELS: Record<InstitutionalOfficialRole, string> = {
  dean: "Dean, Graduate School",
  vpaa: "Vice President for Academic Affairs",
  president: "University President",
};

const MAX_OFFICIAL_NAME_LENGTH = 120;

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
    }
  }

  const serialized = JSON.stringify(next);
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
