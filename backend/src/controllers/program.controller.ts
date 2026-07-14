import { Request, Response } from "express";
import { ProgramService } from "../services/program.service";
import { AppError } from "../utils/AppError";

export class ProgramController {
    private programService = new ProgramService();

    public getAllPrograms = async (req: Request, res: Response): Promise<void> => {
        try {
            const data = await this.programService.getAllPrograms();
            res.status(200).json(data);
        } catch (error: unknown) {
            if (error instanceof AppError) {
                res.status(error.statusCode).json({ error: error.message });
            } else if (error instanceof Error) {
                console.error("Error fetching programs:", error);
                res.status(500).json({ error: "Internal server error!" });
            } else {
                res.status(500).json({ error: "An unexpected error occurred." });
            }
        }
    }
}
