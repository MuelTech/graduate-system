import { OperationalAuthorization, operationalAuthorization } from "../access/operational-authorization";
import { isAcademicAccountRole } from "../utils/academic-account";
import { MemoRepository } from "../repositories/memo.repository";
import { NotificationRepository } from "../repositories/notification.repository";
import { MemoAudience, NotificationType } from "@prisma/client";
import prisma from "../config/database";
import { EmailService } from "./email.service";

export class MemoService {
    constructor(private readonly authorization: OperationalAuthorization = operationalAuthorization) {}
    private memoRepo = new MemoRepository();
    private notifRepo = new NotificationRepository();

    async createMemo(
        adminId: string,
        title: string,
        content: string,
        targetAudience: MemoAudience,
        programId?: string,
        attachmentUrl?: string | null
    ) {
        const memo = await this.authorization.write(adminId, "memos.manage", async tx => {
            const repo = tx ? new MemoRepository(tx) : this.memoRepo;
            const memo = await repo.createMemo({
                createdById: adminId,
                title,
                content,
                targetAudience,
                programId,
                attachmentUrl: attachmentUrl || null
            });

            // Audit Log: Memo Published (NFR7 Compliance)
            await (tx ?? prisma).auditLog.create({
                data: {
                    actorId: adminId,
                    actionType: "MEMO_PUBLISHED",
                    targetTable: "memos",
                    targetId: memo.id,
                    description: `Published memo "${title}" targeting ${targetAudience}${programId ? ` (Program: ${programId})` : ""}${attachmentUrl ? " with circular attachment" : ""}.`,
                    newValue: JSON.stringify({
                        id: memo.id,
                        title,
                        targetAudience,
                        programId: programId || null,
                        hasAttachment: !!attachmentUrl
                    }),
                }
            });

            return memo;
        });

        // Determine target users
        let targetUsers: {
            id: string,
            email: string
        }[] = [];

        if (targetAudience === MemoAudience.ALL) {
            targetUsers = await prisma.user.findMany({
                where: { isActive: true },
                select: {
                    id: true,
                    email: true
                }
            });
        } else if (targetAudience === MemoAudience.STUDENTS) {
            const students = await prisma.student.findMany({
                include: {
                    user: true
                }
            });

            targetUsers = students.filter(s => s.user?.isActive).map(s => s.user);
        } else if (targetAudience === MemoAudience.PROGRAM && programId) {
            const students = await prisma.student.findMany({
                where: { programId },
                include: { user: true }
            });

            targetUsers = students.filter(s => s.user?.isActive).map(s => s.user);
        } else if (targetAudience === MemoAudience.PANELISTS) {
            const panelists = await prisma.panelist.findMany({ include: { user: true }});
            targetUsers = panelists.filter(p => p.isActive && p.user?.isActive && isAcademicAccountRole(p.user.role)).map(p => p.user);
        }

        if (targetUsers.length > 0) {
            // Create In-App Notifications
            const notifs = targetUsers.map(user => ({
                userId: user.id,
                title: "New Announcement",
                message: title,
                type: NotificationType.MEMO,
                relatedRecordType: "MEMO",
                relatedRecordId: memo.id,
            }));
            await this.notifRepo.createMany(notifs);

            // Trigger Email Broadcast via BullMQ Job Queue
            const emails = targetUsers.map(user => user.email);

            await EmailService.sendBatch(emails, "memo_broadcast", {
                student_name: "Student",
                memo_title: title,
                memo_content: content,
                portal_link: process.env.FRONTEND_URL || "http://localhost:3000"
            });
        }

        return this.project([memo])[0];
    }

    async archiveMemo(adminId: string, memoId: string) {
        return this.authorization.write(adminId, "memos.manage", async tx => {
            const repo = tx ? new MemoRepository(tx) : this.memoRepo;
            const existing = await repo.findById(memoId);
            if (!existing) {
                throw new Error("Memo not found");
            }

            if (existing.isArchived) {
                throw new Error("Memo is already archived");
            }

            const archived = await repo.archiveMemo(memoId);

            // Audit Log: Memo Archived (NFR7 Compliance)
            await (tx ?? prisma).auditLog.create({
                data: {
                    actorId: adminId,
                    actionType: "MEMO_ARCHIVED",
                    targetTable: "memos",
                    targetId: memoId,
                    description: `Archived memo "${existing.title}".`,
                    oldValue: JSON.stringify({ isArchived: false }),
                    newValue: JSON.stringify({ isArchived: true }),
                }
            });

            return this.project([archived])[0];
        });
    }

    private project<T extends { id: string; attachmentUrl: string | null }>(rows: T[]): T[] {
        return rows.map(row => ({ ...row, attachmentUrl: row.attachmentUrl ? `/api/documents/memo/${row.id}/file` : null }));
    }

    async getAllMemos(actorId = "") {
        await this.authorization.assert(actorId, "memos.manage");
        return this.project(await this.memoRepo.getAllMemos());
    }

    async getMemosForUser(
        userId: string,
        role: string
    ) {
        const actor = await this.authorization.current({ userId, role });
        role = actor.role;
        if (this.authorization.enabled && role === "ADMIN") return this.getAllMemos(actor.userId);
        if (role === "STUDENT") {
            const student = await prisma.student.findUnique({
                where: { userId }
            });

            if (!student) return [];
            
            return this.project(await this.memoRepo.getMemosForStudent(student.programId));
        } else if (isAcademicAccountRole(role)) {
            return this.project(await this.memoRepo.getMemosForPanelist());
        }

        if (this.authorization.enabled) return this.project(await this.memoRepo.getMemosForGeneralAudience());
        return await this.getAllMemos(userId);
    }
}
