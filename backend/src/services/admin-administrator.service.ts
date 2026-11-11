import bcrypt from "bcryptjs";
import { AdminAdministratorRepository } from "../repositories/admin-administrator.repository";
import { AppError } from "../utils/AppError";

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

    return repo.updateAdministrator(id, data, actorId, passwordHash);
  }
}
