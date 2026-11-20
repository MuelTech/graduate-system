import { Request, Response } from "express";
import { AuthService } from "../services/auth.service";
import { PasswordResetService } from "../services/password-reset.service";
import { UserSignatureService } from "../services/user-signature.service";
import { AppError } from "../utils/AppError";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";

export class AuthController {
    private authService = new AuthService();
    private passwordResetService = new PasswordResetService();
    private userSignatureService = new UserSignatureService();

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

    forgotPassword = async (req: Request, res: Response): Promise<void> => {
        try {
            const forwarded = req.headers["x-forwarded-for"];
            const requestedIp =
                typeof forwarded === "string"
                    ? forwarded.split(",")[0]?.trim()
                    : req.ip || req.socket.remoteAddress || null;
            const result = await this.passwordResetService.requestPasswordReset(
                req.body?.email,
                requestedIp,
            );
            res.status(200).json(result);
        } catch (error: unknown) {
            if (error instanceof AppError) {
                res.status(error.statusCode).json({ error: error.message });
            } else {
                res.status(500).json({ error: "Unable to process password reset request." });
            }
        }
    };

    validateResetToken = async (req: Request, res: Response): Promise<void> => {
        try {
            const token = String(req.query.token ?? "");
            const result = await this.passwordResetService.validateResetToken(token);
            res.status(200).json(result);
        } catch (error: unknown) {
            if (error instanceof AppError) {
                res.status(error.statusCode).json({ error: error.message });
            } else {
                res.status(500).json({ error: "Unable to validate reset link." });
            }
        }
    };

    resetPassword = async (req: Request, res: Response): Promise<void> => {
        try {
            const result = await this.passwordResetService.completePasswordReset(
                req.body?.token,
                req.body?.newPassword,
            );
            res.status(200).json(result);
        } catch (error: unknown) {
            if (error instanceof AppError) {
                res.status(error.statusCode).json({ error: error.message });
            } else {
                res.status(500).json({ error: "Unable to reset password." });
            }
        }
    };

    changePassword = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                res.status(401).json({ error: "Unauthorized" });
                return;
            }

            const { newPassword } = req.body;
            if (!newPassword || newPassword.length < 6) {
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

    getMe = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                res.status(401).json({ error: "Unauthorized" });
                return;
            }
            const user = await this.authService.getMe(userId);
            res.status(200).json(user);
        } catch (error: unknown) {
            if (error instanceof AppError) {
                res.status(error.statusCode).json({ error: error.message });
            } else {
                res.status(500).json({ error: "An unexpected error occurred." });
            }
        }
    }

    getMySignature = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                res.status(401).json({ error: "Unauthorized" });
                return;
            }
            const vault = await this.userSignatureService.getVault(userId);
            res.status(200).json(vault);
        } catch (error: unknown) {
            if (error instanceof AppError) {
                res.status(error.statusCode).json({ error: error.message });
            } else {
                res.status(500).json({ error: "An unexpected error occurred." });
            }
        }
    }

    saveMySignature = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                res.status(401).json({ error: "Unauthorized" });
                return;
            }
            const vault = await this.userSignatureService.saveVault(userId, req.body);
            res.status(200).json(vault);
        } catch (error: unknown) {
            if (error instanceof AppError) {
                res.status(error.statusCode).json({ error: error.message });
            } else {
                res.status(500).json({ error: "An unexpected error occurred." });
            }
        }
    }

    deleteMySignature = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                res.status(401).json({ error: "Unauthorized" });
                return;
            }
            const vault = await this.userSignatureService.deleteVault(userId);
            res.status(200).json(vault);
        } catch (error: unknown) {
            if (error instanceof AppError) {
                res.status(error.statusCode).json({ error: error.message });
            } else {
                res.status(500).json({ error: "An unexpected error occurred." });
            }
        }
    }
}
