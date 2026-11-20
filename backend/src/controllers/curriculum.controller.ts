import { Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { CurriculumService } from "../services/curriculum.service";
import { AppError } from "../utils/AppError";

export function handleCurriculumControllerError(
  res: Response,
  error: unknown,
  fallbackContext: string,
): void {
  if (error instanceof AppError) {
    res.status(error.statusCode).json({ error: error.message });
    return;
  }
  if (error instanceof Error) {
    console.error(fallbackContext, error);
    res.status(500).json({ error: "Internal server error!" });
    return;
  }
  res.status(500).json({ error: "An unexpected error occurred." });
}

export class CurriculumController {
  constructor(private readonly service = new CurriculumService()) {}

  listVersions = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const programId =
        typeof req.query.programId === "string" && req.query.programId.trim()
          ? req.query.programId.trim()
          : undefined;
      const result = await this.service.listVersions(programId);
      res.status(200).json(result);
    } catch (error) {
      handleCurriculumControllerError(res, error, "Error listing curriculum versions:");
    }
  };

  getVersion = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const result = await this.service.getVersion(String(req.params.versionId ?? ""));
      res.status(200).json(result);
    } catch (error) {
      handleCurriculumControllerError(res, error, "Error loading curriculum version:");
    }
  };

  listProgramVersions = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const result = await this.service.listProgramVersions(
        String(req.params.programId ?? ""),
      );
      res.status(200).json(result);
    } catch (error) {
      handleCurriculumControllerError(res, error, "Error listing program versions:");
    }
  };

  createVersion = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const adminId = req.user?.userId ?? "";
      const result = await this.service.createVersion(adminId, req.body ?? {});
      res.status(201).json(result);
    } catch (error) {
      handleCurriculumControllerError(res, error, "Error creating curriculum version:");
    }
  };

  updateVersion = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const adminId = req.user?.userId ?? "";
      const result = await this.service.updateVersion(
        adminId,
        String(req.params.versionId ?? ""),
        req.body ?? {},
      );
      res.status(200).json(result);
    } catch (error) {
      handleCurriculumControllerError(res, error, "Error updating curriculum version:");
    }
  };

  createGroup = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const adminId = req.user?.userId ?? "";
      const result = await this.service.createGroup(
        adminId,
        String(req.params.versionId ?? ""),
        req.body ?? {},
      );
      res.status(201).json(result);
    } catch (error) {
      handleCurriculumControllerError(res, error, "Error creating curriculum group:");
    }
  };

  updateGroup = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const adminId = req.user?.userId ?? "";
      const result = await this.service.updateGroup(
        adminId,
        String(req.params.groupId ?? ""),
        req.body ?? {},
      );
      res.status(200).json(result);
    } catch (error) {
      handleCurriculumControllerError(res, error, "Error updating curriculum group:");
    }
  };

  deleteGroup = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const adminId = req.user?.userId ?? "";
      const result = await this.service.deleteGroup(
        adminId,
        String(req.params.groupId ?? ""),
      );
      res.status(200).json(result);
    } catch (error) {
      handleCurriculumControllerError(res, error, "Error deleting curriculum group:");
    }
  };

  createCourse = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const adminId = req.user?.userId ?? "";
      const result = await this.service.createCourse(
        adminId,
        String(req.params.groupId ?? ""),
        req.body ?? {},
      );
      res.status(201).json(result);
    } catch (error) {
      handleCurriculumControllerError(res, error, "Error creating curriculum subject:");
    }
  };

  updateCourse = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const adminId = req.user?.userId ?? "";
      const result = await this.service.updateCourse(
        adminId,
        String(req.params.courseId ?? ""),
        req.body ?? {},
      );
      res.status(200).json(result);
    } catch (error) {
      handleCurriculumControllerError(res, error, "Error updating curriculum subject:");
    }
  };

  deleteCourse = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const adminId = req.user?.userId ?? "";
      const result = await this.service.deleteCourse(
        adminId,
        String(req.params.courseId ?? ""),
      );
      res.status(200).json(result);
    } catch (error) {
      handleCurriculumControllerError(res, error, "Error deleting curriculum subject:");
    }
  };
}
