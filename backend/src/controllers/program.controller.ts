import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { ProgramService } from "../services/program.service";
import { AppError } from "../utils/AppError";

function handleControllerError(
  res: Response,
  error: unknown,
  fallbackContext: string,
): void {
  if (error instanceof AppError) {
    res.status(error.statusCode).json({ error: error.message });
  } else if (error instanceof Error) {
    console.error(fallbackContext, error);
    res.status(500).json({ error: "Internal server error!" });
  } else {
    res.status(500).json({ error: "An unexpected error occurred." });
  }
}

export class ProgramController {
  private programService = new ProgramService();

  public getAllPrograms = async (req: Request, res: Response): Promise<void> => {
    try {
      const data = await this.programService.getAllPrograms();
      res.status(200).json(data);
    } catch (error: unknown) {
      handleControllerError(res, error, "Error fetching programs:");
    }
  };

  public getAdminPrograms = async (
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> => {
    try {
      const data = await this.programService.getAdminPrograms();
      res.status(200).json(data);
    } catch (error: unknown) {
      handleControllerError(res, error, "Error fetching admin programs:");
    }
  };

  public createProgram = async (
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> => {
    try {
      const actorId = req.user?.userId ?? "";
      const created = await this.programService.createProgram(req.body, actorId);
      res.status(201).json(created);
    } catch (error: unknown) {
      handleControllerError(res, error, "Error creating program:");
    }
  };

  public updateProgram = async (
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> => {
    try {
      const actorId = req.user?.userId ?? "";
      const id = String(req.params.id ?? "");
      const updated = await this.programService.updateProgram(id, req.body, actorId);
      res.status(200).json(updated);
    } catch (error: unknown) {
      handleControllerError(res, error, "Error updating program:");
    }
  };

  public updateProgramStatus = async (
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> => {
    try {
      const actorId = req.user?.userId ?? "";
      const id = String(req.params.id ?? "");
      const updated = await this.programService.updateProgramStatus(
        id,
        req.body,
        actorId,
      );
      res.status(200).json(updated);
    } catch (error: unknown) {
      handleControllerError(res, error, "Error updating program status:");
    }
  };
}
