import { Request, Response } from "express";
import { ProgramService } from "../services/program.services";

export class ProgramController {
    private programService = new ProgramService();

    public getAllPrograms = async (req: Request, res: Response): Promise<void> => {
        try {
            const data = await this.programService.getAllPrograms();
            res.status(200).json(data);
        } catch (error){
            console.error("Error fetching programs:", error);
            res.status(500).json({ error: "Internal server error!" })
        }
    }
}