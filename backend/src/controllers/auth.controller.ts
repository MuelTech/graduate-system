import { Request, Response } from "express";
import { AuthService } from "../services/auth.service";
import { AppError } from "../utils/AppError";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import { currentAccountResponse } from "../services/current-account";

export class AuthController {
    private authService = new AuthService();

    currentAccount = (req: AuthenticatedRequest, res: Response): void => {
        res.setHeader("Cache-Control", "no-store");
        if (!req.currentAccount) {
            res.status(503).json({ error: "Current account is unavailable." });
            return;
        }
        res.json(currentAccountResponse(req.currentAccount));
    };

    register = async (req: Request, res: Response): Promise<void> => {
        try {
            const result = await this.authService.register(req.body);
            res.status(201).json({ message: "Registration successful!", user: result });
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

    login = async (req: Request, res: Response): Promise<void> => {
        try {
            const result = await this.authService.login(req.body);
            res.status(200).json({ message: "Login successful!", ...result });
        } catch (error: unknown) {
            if (error instanceof AppError) {
                res.status(error.statusCode).json({ error: error.message });
            } else if (error instanceof Error) {
                res.status(401).json({ error: error.message });
            } else {
                res.status(500).json({ error: "An unexpected error occurred." });
            }
        }
    }

    changePassword = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                res.status(401).json({ error: "Unauthorized" });
                return;
            }

            const { newPassword } = req.body;
            if (typeof newPassword !== "string" || newPassword.length < 6) {
                res.status(400).json({ error: "New password must be at least 6 characters" });
                return;
            }

            const result = await this.authService.changePassword(userId, newPassword);
            res.status(200).json({ message: "Password changed successfully", token: result.token });
        } catch (error: unknown) {
            if (error instanceof AppError) {
                res.status(error.statusCode).json({ error: error.message });
            } else if (error instanceof Error) {
                res.status(400).json({ error: error.message });
            } else {
                res.status(500).json({ error: "An unexpected error occurred." });
            }
        }
    }
}
