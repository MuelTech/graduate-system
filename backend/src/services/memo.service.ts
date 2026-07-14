import { MemoRepository } from "../repositories/memo.repository";
import { NotificationRepository } from "../repositories/notification.repository";
import { MemoAudience, NotificationType } from "@prisma/client";
import prisma from "../config/database";

export class MemoService {
    private memoRepo = new MemoRepository();
    private notifRepo = new NotificationRepository();

    async createMemo(
        adminId: string,
        title: string,
        content: string,
        targetAudience: MemoAudience,
        programId?: string
    ) {
        const memo = await this.memoRepo.createMemo({
            createdById: adminId,
            title,
            content,
            targetAudience,
            programId
        });

        // Determine target users
        let targetUsers: {
            id: string,
            email: string
        }[] = [];

        if (targetAudience === MemoAudience.ALL) {
            targetUsers = await prisma.user.findMany({
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

            targetUsers = students.map(s => s.user);
        } else if (targetAudience === MemoAudience.PROGRAM && programId) {
            const students = await prisma.student.findMany({
                where: { programId },
                include: { user: true }
            });

            targetUsers = students.map(s => s.user);
        } else if (targetAudience === MemoAudience.PANELISTS) {
            const panelists = await prisma.panelist.findMany({ include: { user: true }});
            targetUsers = panelists.map(p => p.user);
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

            // Trigger Email Broadcast
            // We will return to this once we setup the Email Module
            // This is a temporary alert response
            console.log(`[EMAIL DISPATCH] Sent 'memo_broadcast' template to ${targetUsers.length} users.`);
            /*
        EmailService.sendBatch(targetUsers.map(u => u.email), 'memo_broadcast', { 
           title, 
           content, 
           portalLink: 'http://localhost:3000/portal' 
        });
      */
        }

        return memo;
    }

    async getAllMemos() {
        return await this.memoRepo.getAllMemos();
    }

    async getMemosForUser(
        userId: string,
        role: string
    ) {
        if (role === "STUDENT") {
            const student = await prisma.student.findUnique({
                where: { userId }
            });

            if (!student) return [];
            
            return await this.memoRepo.getMemosForStudent(student.programId);
        } else if (role === "PANELIST") {
            return await this.memoRepo.getMemosForPanelist();
        }

        return await this.getAllMemos();
    }
}