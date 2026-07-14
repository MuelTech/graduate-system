import { Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { ApplicantService } from "../services/applicant.service";
import { AppError } from "../utils/AppError";

export class ApplicantController {
    private applicantService = new ApplicantService();

    getProfile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const userId = req.user?.userId; 
            
            if (!userId) {
                res.status(401).json({ error: "Unauthorized access" });
                return;
            }

            const profile = await this.applicantService.getProfile(userId);
            res.status(200).json(profile);
        } catch (error: unknown) {
            if (error instanceof AppError) {
                res.status(error.statusCode).json({ error: error.message });
            } else if (error instanceof Error) {
                res.status(400).json({ error: error.message });
            } else {
                res.status(500).json({ error: "An unexpected error occurred." });
            }
        }
    };
}
