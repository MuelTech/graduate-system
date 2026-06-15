import { Request, Response } from "express";
import { AuthService } from "../services/auth.service";
import { AppError } from "../utils/AppError";

export class AuthController {
    private authService = new AuthService();

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
}
