import { MemoAudience } from "@prisma/client";
import prisma from "../config/database";

export class MemoRepository {
    async createMemo(data: {
        createdById: string;
        title: string;
        content: string;
        targetAudience: MemoAudience;
        programId?: string
    }) {
        return await prisma.memo.create({
            data: {
                ...data,
                sentAt: new Date(),
            },
            include: {
                createdBy: true,
                program: true
            },
        });
    }

    async getAllMemos() {
        return await prisma.memo.findMany({
            orderBy: { createdAt: "desc" },
            include: { createdBy: true, program: true },
        });
    }

    async getMemosForStudent(programId: string) {
        return await prisma.memo.findMany({
            where: {
                OR: [
                    { targetAudience: MemoAudience.ALL },
                    { targetAudience: MemoAudience.STUDENTS },
                    {
                        targetAudience: MemoAudience.PROGRAM,
                        programId: programId
                    }
                ],
            },
            orderBy: { createdAt: "desc" },
            include: { createdBy: true }
        });
    }

    async getMemosForPanelist() {
        return await prisma.memo.findMany({
            where: {
                OR: [
                    { targetAudience: MemoAudience.ALL },
                    { targetAudience: MemoAudience.PANELISTS },
                ],
            },
            orderBy: { createdAt: "desc" },
            include: { createdBy: true },
        });
    }
}