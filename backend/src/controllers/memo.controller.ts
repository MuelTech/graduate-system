import { Request, Response } from "express";
import { MemoService } from "../services/memo.service";

export class MemoController {
    private service = new MemoService();

    createMemo = async (req: Request, res: Response) => {
        try {
            const adminId = (req as any).user.userId; // From JWT
            const { title, content, targetAudience, programId } = req.body;
            const memo = await this.service.createMemo(adminId, title, content, targetAudience, programId);
            res.status(201).json(memo);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    };

    getMemos = async (req: Request, res: Response) => {
        try {
            const user = (req as any).user;
            const memos = await this.service.getMemosForUser(user.userId, user.role);
            res.json(memos);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    };
}