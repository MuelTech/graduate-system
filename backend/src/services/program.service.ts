import { ProgramType } from "@prisma/client";
import {
  defaultMaxResidencyYears,
  formatCanonicalProgramName,
} from "../config/graduate-programs";
import {
  ProgramRepository,
  ProgramWriteInput,
} from "../repositories/program.repository";
import { AppError } from "../utils/AppError";

function parseProgramType(value: unknown): ProgramType {
  if (typeof value === "string") {
    const normalized = value.trim().toUpperCase();
    if (normalized === "MASTERS" || normalized === "DOCTORAL") {
      return normalized;
    }
  }
  throw new AppError("Program type must be MASTERS or DOCTORAL.", 400);
}

function parseRequiredDegreeName(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new AppError("Degree title is required.", 400);
  }
  const trimmed = value.trim();
  if (trimmed.length > 191) {
    throw new AppError("Degree title must not exceed 191 characters.", 400);
  }
  return trimmed;
}

function parseOptionalString(
  value: unknown,
  label: string,
  maxLength: number,
): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    throw new AppError(`${label} must be text.`, 400);
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > maxLength) {
    throw new AppError(`${label} must not exceed ${maxLength} characters.`, 400);
  }
  return trimmed;
}

function parseMaxResidencyYears(
  value: unknown,
  programType: ProgramType,
): number {
  if (value === undefined || value === null || value === "") {
    return defaultMaxResidencyYears(programType);
  }
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(num) || num < 1 || num > 15) {
    throw new AppError(
      "Maximum residency years must be a whole number between 1 and 15.",
      400,
    );
  }
  return num;
}

function parseOptionalBoolean(value: unknown, defaultValue: boolean, label: string): boolean {
  if (value === undefined || value === null) return defaultValue;
  if (typeof value !== "boolean") {
    throw new AppError(`${label} must be true or false.`, 400);
  }
  return value;
}

function validateProgramPayload(
  input: unknown,
  defaultActive: boolean,
): ProgramWriteInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new AppError("Program payload must be an object.", 400);
  }
  const body = input as Record<string, unknown>;
  const programType = parseProgramType(body.programType);
  const degreeName = parseRequiredDegreeName(body.degreeName);
  const majorName = parseOptionalString(body.majorName, "Major / specialization", 191);
  const programCode = parseOptionalString(body.programCode, "Program code", 64);
  const maxResidencyYears = parseMaxResidencyYears(body.maxResidencyYears, programType);
  const isActive = parseOptionalBoolean(body.isActive, defaultActive, "Active status");
  const programName = formatCanonicalProgramName({
    degreeName,
    majorName,
    programCode,
  });

  if (programName.length > 191) {
    throw new AppError(
      "Combined program display name must not exceed 191 characters.",
      400,
    );
  }

  return {
    programName,
    degreeName,
    majorName,
    programCode,
    programType,
    maxResidencyYears,
    isActive,
  };
}

export class ProgramService {
  constructor(private readonly programRepository = new ProgramRepository()) {}

  async getAllPrograms() {
    const graduate = await this.programRepository.getAllGraduatePrograms();

    return {
      graduatePrograms: graduate,
    };
  }

  async getAdminPrograms() {
    const programs = await this.programRepository.getAllAdminGraduatePrograms();
    return { programs };
  }

  async createProgram(input: unknown, actorId: string) {
    if (!actorId) {
      throw new AppError("Authenticated Admin identity is required.", 401);
    }
    const payload = validateProgramPayload(input, true);
    const duplicate = await this.programRepository.findProgramByNameInsensitive(
      payload.programName,
    );
    if (duplicate) {
      throw new AppError(
        `A program named "${payload.programName}" already exists.`,
        409,
      );
    }

    const { program } = await this.programRepository.createProgram(payload, actorId);
    return program;
  }

  async updateProgram(id: string, input: unknown, actorId: string) {
    if (!actorId) {
      throw new AppError("Authenticated Admin identity is required.", 401);
    }
    const programId = String(id ?? "").trim();
    if (!programId) {
      throw new AppError("Program ID is required.", 400);
    }

    const existing = await this.programRepository.findProgramById(programId);
    if (!existing || existing.department === "UIUX Fixture") {
      throw new AppError("Program not found.", 404);
    }

    const payload = validateProgramPayload(input, existing.isActive);
    const duplicate = await this.programRepository.findProgramByNameInsensitive(
      payload.programName,
      existing.id,
    );
    if (duplicate) {
      throw new AppError(
        `A program named "${payload.programName}" already exists.`,
        409,
      );
    }

    const { program } = await this.programRepository.updateProgram(
      existing.id,
      existing,
      payload,
      actorId,
    );
    return program;
  }

  async updateProgramStatus(id: string, input: unknown, actorId: string) {
    if (!actorId) {
      throw new AppError("Authenticated Admin identity is required.", 401);
    }
    const programId = String(id ?? "").trim();
    if (!programId) {
      throw new AppError("Program ID is required.", 400);
    }
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      throw new AppError("Status payload must be an object.", 400);
    }
    const rawActive = (input as Record<string, unknown>).isActive;
    if (typeof rawActive !== "boolean") {
      throw new AppError("isActive must be true or false.", 400);
    }

    const existing = await this.programRepository.findProgramById(programId);
    if (!existing || existing.department === "UIUX Fixture") {
      throw new AppError("Program not found.", 404);
    }

    if (existing.isActive === rawActive) {
      return existing;
    }

    const { program } = await this.programRepository.updateProgramStatus(
      existing.id,
      existing,
      rawActive,
      actorId,
    );
    return program;
  }
}
