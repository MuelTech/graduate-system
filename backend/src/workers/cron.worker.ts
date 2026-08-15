import cron from "node-cron";
import prisma from "../config/database";
import { EmailService } from "../services/email.service";

export function startCronJobs() {
    console.log("Starting background Cron Jobs...");

    // This schedule runs every day at 8:00 AM
    // For development purposes, change " 0 8 * * *" to "* * * * *" to run every minute!

    cron.schedule("* * * * *", async () => {
        console.log("[Cron] Checking for exams happening in exactly 24 hours...");
        try {
            // Calculate exactly tomorrow's start and end times
            const tomorrowStart = new Date();
            tomorrowStart.setDate(tomorrowStart.getDate() + 1);
            tomorrowStart.setHours(0, 0, 0, 0);
            const tomorrowEnd = new Date(tomorrowStart);
            tomorrowEnd.setHours(23, 59, 59, 999);
            // Query the database for exams happening tomorrow
            const upcomingExams = await prisma.entranceExamApplication.findMany({
                where: {
                    examDate: {
                        gte: tomorrowStart,
                        lte: tomorrowEnd
                    },
                    status: "APPROVED" // Change this to "PENDING" or "SCHEDULED" depending on your exact Enum!
                },
                include: {
                    student: {
                        include: { user: true }
                    }
                }
            });
            if (upcomingExams.length === 0) {
                console.log("[Cron] No exams found for tomorrow.");
                return;
            }
            console.log(`[Cron] Found ${upcomingExams.length} students taking an exam tomorrow. Sending reminders...`);
            // Extract the emails and send them efficiently using our batch queue!
            const emails = upcomingExams.map(app => app.student.user.email);
            
            await EmailService.sendBatch(emails, "exam_reminder_24h", {
                student_name: "Applicant", 
                exam_date: tomorrowStart.toDateString(),
                portal_link: process.env.FRONTEND_URL || "http://localhost:3000"
            });
            console.log("[Cron] ✅ Exam reminders successfully queued!");
        } catch (error) {
            console.error("[Cron] ❌ Failed to process exam reminders:", error);
        }
    });
}