import type { Prisma } from "@prisma/client";
import { MemoAudience } from "@prisma/client";
import prisma from "../config/database";

const CREATOR_SELECT = { id: true, firstName: true, lastName: true, role: true } as const;

export class MemoRepository {
    constructor(private readonly db: Pick<Prisma.TransactionClient, "memo"> = prisma) {}
    async createMemo(data: {
        createdById: string;
        title: string;
        content: string;
        targetAudience: MemoAudience;
        programId?: string;
        attachmentUrl?: string | null;
    }) {
        return await this.db.memo.create({
            data: {
                ...data,
                sentAt: new Date(),
            },
            include: {
                createdBy: { select: CREATOR_SELECT },
                program: true
            },
        });
    }

    async findById(id: string) {
        return await this.db.memo.findUnique({
            where: { id },
            include: {
                createdBy: { select: CREATOR_SELECT },
                program: true,
            },
        });
    }

    async getAllMemos() {
        return await this.db.memo.findMany({
            orderBy: { createdAt: "desc" },
            include: { createdBy: { select: CREATOR_SELECT }, program: true },
        });
    }

    async getMemosForStudent(programId: string) {
        return await this.db.memo.findMany({
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
            include: { createdBy: { select: CREATOR_SELECT }, program: true }
        });
    }

    async getMemosForGeneralAudience() {
        return this.db.memo.findMany({
            where: { isArchived: false, targetAudience: MemoAudience.ALL },
            orderBy: { createdAt: "desc" },
            include: { createdBy: { select: CREATOR_SELECT }, program: true },
        });
    }

    async getMemosForPanelist() {
        return await this.db.memo.findMany({
            where: {
                isArchived: false,
                OR: [
                    { targetAudience: MemoAudience.ALL },
                    { targetAudience: MemoAudience.PANELISTS },
                ],
            },
            orderBy: { createdAt: "desc" },
            include: { createdBy: { select: CREATOR_SELECT }, program: true },
        });
    }

    async archiveMemo(id: string) {
        return await this.db.memo.update({
            where: { id },
            data: { isArchived: true },
            include: { createdBy: { select: CREATOR_SELECT }, program: true },
        });
    }
}
