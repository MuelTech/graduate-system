import bcrypt from "bcryptjs";
import { AdminAdministratorRepository } from "../repositories/admin-administrator.repository";
import { AppError } from "../utils/AppError";
import { EmailLifecycle } from "./email-lifecycle.helper";

const repo = new AdminAdministratorRepository();

export class AdminAdministratorService {
  async getAllAdministrators() {
    return repo.findAll();
  }

  async getAdministratorById(id: string) {
    const admin = await repo.findById(id);
    if (!admin) {
      throw new AppError("Administrator not found!", 404);
    }
    return admin;
  }

  async createAdministrator(data: any, actorId: string) {
    if (!data.email || !data.firstName || !data.lastName) {
      throw new AppError("First name, last name, and email are required.", 400);
    }
    const existing = await repo.checkEmailInUse(data.email.trim());
    if (existing) {
      throw new AppError("Email is already in use by another account.", 400);
    }

    const salt = await bcrypt.genSalt(10);
    const defaultPassword = String(data.lastName).trim().toUpperCase();
    const passwordHash = await bcrypt.hash(defaultPassword, salt);

    const created = await repo.createAdministrator(data, passwordHash, actorId);

    EmailLifecycle.sendAdminAccountCreated({
      email: String(data.email).trim(),
      firstName: String(data.firstName).trim(),
      lastName: String(data.lastName).trim(),
      accessLevel: data.adminAccessLevel ?? "FULL",
      triggeredById: actorId,
    });

    return { ...created, defaultPassword };
  }

  async updateAdministrator(id: string, data: any, actorId: string) {
    const existing = await repo.findById(id);
    if (!existing) {
      throw new AppError("Administrator not found!", 404);
    }

    if (data.email && data.email.trim() !== existing.email) {
      const emailInUse = await repo.checkEmailInUse(data.email.trim(), id);
      if (emailInUse) {
        throw new AppError("Email is already in use by another account.", 400);
      }
    }

    let passwordHash: string | undefined;
    if (data.password && String(data.password).trim() !== "") {
      const salt = await bcrypt.genSalt(10);
      passwordHash = await bcrypt.hash(String(data.password).trim(), salt);
    }

    const updated = await repo.updateAdministrator(id, data, actorId, passwordHash);

    const targetEmail = (data.email ? String(data.email).trim() : existing.email) || "";
    const targetFirst = (data.firstName ? String(data.firstName).trim() : existing.firstName) || "";
    const targetLast = (data.lastName ? String(data.lastName).trim() : existing.lastName) || "";

    if (targetEmail && typeof data.isActive === "boolean" && data.isActive !== existing.isActive) {
      EmailLifecycle.sendAccountStatusChanged({
        email: targetEmail,
        firstName: targetFirst,
        lastName: targetLast,
        isActive: data.isActive,
        triggeredById: actorId,
      });
    }
    if (targetEmail && passwordHash) {
      void EmailLifecycle.sendAccountPasswordReset({
        email: targetEmail,
        firstName: targetFirst,
        lastName: targetLast,
        loginIdentifier: targetEmail,
        triggeredById: actorId,
      });
    }

    return updated;
  }
}
