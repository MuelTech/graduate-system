import prisma from "../config/database";
import { AdminAccessLevel, UserRole } from "@prisma/client";
import { sanitizeAdminCapabilities } from "../config/admin-capabilities";
import { AppError } from "../utils/AppError";

const adminSelect = {
  id: true,
  title: true,
  firstName: true,
  lastName: true,
  suffix: true,
  email: true,
  isActive: true,
  mustChangePassword: true,
  adminAccessLevel: true,
  adminCapabilities: true,
  createdAt: true,
  updatedAt: true,
  createdBy: {
    select: {
      firstName: true,
      lastName: true,
    },
  },
  updatedBy: {
    select: {
      firstName: true,
      lastName: true,
    },
  },
};

export class AdminAdministratorRepository {
  async findAll() {
    const rows = await prisma.user.findMany({
      where: { role: UserRole.ADMIN },
      select: adminSelect,
      orderBy: { createdAt: "desc" },
    });
    return rows.map((row) => ({
      ...row,
      adminAccessLevel: row.adminAccessLevel ?? "FULL",
      adminCapabilities:
        (row.adminAccessLevel ?? "FULL") === "RESTRICTED"
          ? sanitizeAdminCapabilities(row.adminCapabilities)
          : [],
    }));
  }

  async findById(id: string) {
    const row = await prisma.user.findFirst({
      where: { id, role: UserRole.ADMIN },
      select: adminSelect,
    });
    if (!row) return null;
    return {
      ...row,
      adminAccessLevel: row.adminAccessLevel ?? "FULL",
      adminCapabilities:
        (row.adminAccessLevel ?? "FULL") === "RESTRICTED"
          ? sanitizeAdminCapabilities(row.adminCapabilities)
          : [],
    };
  }

  async checkEmailInUse(email: string, excludeId?: string) {
    return prisma.user.findFirst({
      where: {
        email,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
  }

  async createAdministrator(data: any, passwordHash: string, actorId: string) {
    const accessLevel: AdminAccessLevel =
      data.adminAccessLevel === "RESTRICTED"
        ? AdminAccessLevel.RESTRICTED
        : AdminAccessLevel.FULL;
    const capabilities =
      accessLevel === AdminAccessLevel.RESTRICTED
        ? sanitizeAdminCapabilities(data.adminCapabilities)
        : [];

    return prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: data.email.trim(),
          passwordHash,
          title: data.title || null,
          firstName: data.firstName.trim(),
          lastName: data.lastName.trim(),
          suffix: data.suffix || null,
          role: UserRole.ADMIN,
          isActive: true,
          mustChangePassword: true,
          adminAccessLevel: accessLevel,
          adminCapabilities: capabilities,
          createdById: actorId,
          updatedById: actorId,
        },
        select: adminSelect,
      });

      await tx.auditLog.create({
        data: {
          actorId,
          actionType: "ADMIN_ACCOUNT_CREATED",
          targetTable: "users",
          targetId: created.id,
          description: `Created ${accessLevel} Administrator account for ${created.email}.`,
          newValue: JSON.stringify({
            email: created.email,
            adminAccessLevel: accessLevel,
            adminCapabilities: capabilities,
          }),
        },
      });

      return {
        ...created,
        adminAccessLevel: created.adminAccessLevel ?? "FULL",
        adminCapabilities: capabilities,
      };
    });
  }

  async updateAdministrator(
    id: string,
    data: any,
    actorId: string,
    passwordHash?: string,
  ) {
    return prisma.$transaction(async (tx) => {
      const current = await tx.user.findFirst({
        where: { id, role: UserRole.ADMIN },
      });
      if (!current) {
        throw new AppError("Administrator account not found.", 404);
      }

      const nextIsActive =
        typeof data.isActive === "boolean" ? data.isActive : current.isActive;
      const nextAccessLevel: AdminAccessLevel =
        data.adminAccessLevel === "RESTRICTED"
          ? AdminAccessLevel.RESTRICTED
          : data.adminAccessLevel === "FULL"
            ? AdminAccessLevel.FULL
            : (current.adminAccessLevel ?? AdminAccessLevel.FULL);

      const wasActiveFull =
        current.isActive &&
        (current.adminAccessLevel ?? AdminAccessLevel.FULL) ===
          AdminAccessLevel.FULL;
      const willBeActiveFull =
        nextIsActive && nextAccessLevel === AdminAccessLevel.FULL;

      // Safeguard: At least one active Full Administrator must always remain.
      if (wasActiveFull && !willBeActiveFull) {
        const otherActiveFullCount = await tx.user.count({
          where: {
            role: UserRole.ADMIN,
            isActive: true,
            id: { not: id },
            OR: [
              { adminAccessLevel: AdminAccessLevel.FULL },
              { adminAccessLevel: null },
            ],
          },
        });
        if (otherActiveFullCount < 1) {
          throw new AppError(
            "Cannot deactivate or demote the last active Full Administrator.",
            400,
          );
        }
      }

      const nextCapabilities =
        nextAccessLevel === AdminAccessLevel.RESTRICTED
          ? data.adminCapabilities !== undefined
            ? sanitizeAdminCapabilities(data.adminCapabilities)
            : sanitizeAdminCapabilities(current.adminCapabilities)
          : [];

      const updateData: Record<string, unknown> = {
        updatedById: actorId,
        isActive: nextIsActive,
        adminAccessLevel: nextAccessLevel,
        adminCapabilities: nextCapabilities,
      };

      if (typeof data.firstName === "string" && data.firstName.trim()) {
        updateData.firstName = data.firstName.trim();
      }
      if (typeof data.lastName === "string" && data.lastName.trim()) {
        updateData.lastName = data.lastName.trim();
      }
      if (data.title !== undefined) {
        updateData.title = data.title || null;
      }
      if (data.suffix !== undefined) {
        updateData.suffix = data.suffix || null;
      }
      if (typeof data.email === "string" && data.email.trim()) {
        updateData.email = data.email.trim();
      }
      if (passwordHash) {
        updateData.passwordHash = passwordHash;
      }

      const updated = await tx.user.update({
        where: { id },
        data: updateData,
        select: adminSelect,
      });

      await tx.auditLog.create({
        data: {
          actorId,
          actionType: "ADMIN_ACCOUNT_UPDATED",
          targetTable: "users",
          targetId: id,
          description: `Updated Administrator account ${updated.email} (${nextAccessLevel}, active=${nextIsActive}).`,
          oldValue: JSON.stringify({
            isActive: current.isActive,
            adminAccessLevel: current.adminAccessLevel ?? "FULL",
            adminCapabilities: current.adminCapabilities,
          }),
          newValue: JSON.stringify({
            isActive: nextIsActive,
            adminAccessLevel: nextAccessLevel,
            adminCapabilities: nextCapabilities,
          }),
        },
      });

      return {
        ...updated,
        adminAccessLevel: updated.adminAccessLevel ?? "FULL",
        adminCapabilities: nextCapabilities,
      };
    });
  }
}
