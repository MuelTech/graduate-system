import nodemailer from "nodemailer";
import { Queue } from "bullmq";
import IORedis from "ioredis";
import Handlebars from "handlebars";
import dotenv from "dotenv";
import { EmailRepository } from "../repositories/email.repository";

dotenv.config();

const emailRepository = new EmailRepository();

// Strict merge tags validation
const TEMPLATE_VARIABLES: Record<string, string[]> = {
  ecat_result_pass: ["student_name", "portal_link"],
  ecat_result_fail: ["student_name", "portal_link"],
  credential_dispatch: ["student_name", "student_number", "default_password", "portal_link"],
  defense_schedule: ["student_name", "defense_date", "defense_time", "venue"],
  cor_verified: ["student_name", "portal_link"],
  bridging_waiver_validated: ["student_name", "portal_link"],
  bridging_waiver_rejected: ["student_name", "portal_link"],
  memo_broadcast: ["student_name", "memo_title", "memo_content", "portal_link"],
  residency_warning: ["student_name", "warning_details", "portal_link"],
  alignment_aligned: ["student_name", "portal_link"],
  alignment_misaligned: ["student_name", "portal_link"],
  exam_reminder_24h: ["student_name", "exam_date", "portal_link"],
  rap_distributed: ["panelist_name", "rap_link"],
  rap_finalized: ["student_name", "rap_link"],
  strike_result: ["student_name", "similarity_percentage", "instructions"],
  adviser_assigned: ["student_name", "adviser_name", "portal_link"],
  comp_exam_recorded: ["student_name", "result", "portal_link"]
};

// Transporter & Redis queue setup
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 2525,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

const redisConnection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
    maxRetriesPerRequest: null
});

redisConnection.on("error", (err) => {
    console.error("❌ [Redis Error] Connection failed:", err.message);
});

export const emailQueue = new Queue("email-queue", { connection: redisConnection });

// Core Service Methods
export class EmailService {
    // Used internally by the Worker to actually dispatch the email and update logs
    static async sendDirectEmail(
        to: string,
        subject: string,
        html: string,
        templateKey?: string
    ) {
        const emailLog = await emailRepository.createLog({
            recipient: to,
            subject,
            templateKey,
            status: "QUEUED"
        });

        try {
            const info = await transporter.sendMail({
                from: process.env.EMAIL_FROM || "noreply@graduate-system.edu.ph",
                to,
                subject,
                html,
            });

            await emailRepository.updateLogStatus(emailLog.id, "SENT");
            return info;
        } catch (error: any) {
            await emailRepository.updateLogStatus(emailLog.id, "FAILED", error.message);
            throw error; // Rethrow so BullMQ knows the job failed and can retry
        }
    }

    // Pushes a single transactional email to the background queue
    static async sendTemplateEmail(
        to: string,
        templateKey: string,
        variables: Record<string, string>
    ) {
        const template = await emailRepository.getTemplateByKey(templateKey);

        if (!template) throw new Error(`Email template '${templateKey}' not found!`);

        // Strict validation
        const allowedTags = TEMPLATE_VARIABLES[templateKey] || [];
        for (const key of Object.keys(variables)) {
            if (!allowedTags.includes(key)) {
                console.warn(`[Warning] Tag '${key}' is not registered for template '${templateKey}'!`);
            }
        }

        let compileHtml = "";
        try {
            const hbTemplate = Handlebars.compile(template.bodyHtml);
            compileHtml = hbTemplate(variables);
        } catch (error: any) {
            await emailRepository.createLog({
                recipient: to,
                subject: template.subject,
                templateKey,
                status: "FAILED",
                errorMessage: `Handlebars Compilation Error: ${error.message}`,
            });
            console.error(`[EmailService] Handlebars error on template '${templateKey}':`, error.message);
            return;
        }

        await emailQueue.add("send-single-email", {
            to,
            subject: template.subject,
            html: compileHtml,
            templateKey,
        });
    }

    // Bulk dispatch emails immediately to the queue
    static async sendBatch(
        tos: string[],
        templateKey: string,
        variables: Record<string, string>
    ) {
        const template = await emailRepository.getTemplateByKey(templateKey);
        if (!template) throw new Error(`Email template '${templateKey}' not found!`);

        let compiledHtml = "";
        try {
            // Compile HTML once for speed
            const hbTemplate = Handlebars.compile(template.bodyHtml);
            compiledHtml = hbTemplate(variables);
        } catch (error: any) {
            console.error(`[EmailService] Batch compilation failed: ${error.message}`);
            return;
        }

        // Map multiple users to BullMQ jobs
        const jobs = tos.map(to => ({
            name: "send-batch-email",
            data: {
                to,
                subject: template.subject,
                html: compiledHtml,
                templateKey
            }
        }));

        await emailQueue.addBulk(jobs);
        console.log(`✅ [EmailService] Added ${jobs.length} jobs to the queue.`);
    }
}