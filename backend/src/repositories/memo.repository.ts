import { MemoAudience } from "@prisma/client";
import prisma from "../config/database";

export class MemoRepository {
    async createMemo(data: {
        createdById: string;
        title: string;
        content: string;
        targetAudience: MemoAudience;
        programId?: string;
        attachmentUrl?: string | null;
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

    async findById(id: string) {
        return await prisma.memo.findUnique({
            where: { id },
            include: {
                createdBy: true,
                program: true,
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
                isArchived: false,
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
            include: { createdBy: true, program: true }
        });
    }

    async getMemosForPanelist() {
        return await prisma.memo.findMany({
            where: {
                isArchived: false,
                OR: [
                    { targetAudience: MemoAudience.ALL },
                    { targetAudience: MemoAudience.PANELISTS },
                ],
            },
            orderBy: { createdAt: "desc" },
            include: { createdBy: true, program: true },
        });
    }

    async archiveMemo(id: string) {
        return await prisma.memo.update({
            where: { id },
            data: { isArchived: true },
            include: { createdBy: true, program: true },
        });
    }
}
