import { Request, Response } from "express";
import { AuthService } from "../services/auth.service";

export class AuthController {
    private authService = new AuthService();

    register = async (req: Request, res: Response): Promise<void> => {
        try {
            //The frontend sends the entire nested form state in req.body
            const result = await this.authService.register(req.body);
            res.status(201).json({ message: "Registration successful!", user: result });
        } catch (error: any) {
            res.status(400).json({ error: error.message });
        }
    };

    login = async (req: Request, res: Response): Promise<void> => {
        try {
            //Receives dynamic role fields from NextAuth authorize() callback
            const result = await this.authService.login(req.body);
            res.status(200).json({ message: "Login successful!", ...result });
        } catch (error: any) {
            res.status(401).json({ error: error.message });
        }
    }
}