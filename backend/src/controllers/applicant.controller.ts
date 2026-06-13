import { Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { ApplicantService } from "../services/applicant.service";

export class ApplicantController {
    private applicantService = new ApplicantService();

    getProfile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            // Securely grab the userId directly from the verified JWT token
            const userId = req.user?.userId; 
            
            if (!userId) {
                res.status(401).json({ error: "Unauthorized access" });
                return;
            }

            const profile = await this.applicantService.getProfile(userId);
            res.status(200).json(profile);
        } catch (error: any) {
            res.status(400).json({ error: error.message });
        }
    };
}
