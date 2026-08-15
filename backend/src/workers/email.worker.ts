import { Worker, Job } from "bullmq";
import IORedis from "ioredis";
import { EmailService } from "../services/email.service";
import dotenv from "dotenv";

dotenv.config();

const redisConnection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
    maxRetriesPerRequest: null
});

redisConnection.on("ready", () => {
    console.log("✅ [BullMQ] Successfully connected to Redis Cloud!");
});
console.log("Starting BullMQ Email Worker...");

const emailWorker = new Worker(
    "email-queue",
    async (job: Job) => {
        const { to, subject, html, templateKey } = job.data;

        console.log(`Processing job ${job.id} - Template ${templateKey} | To: ${to}`);

        try {
            await EmailService.sendDirectEmail(to, subject, html, templateKey);
            console.log(`[EmailWorker] Successfully completed job ${job.id}`);
        } catch (error: any) {
            console.error(`Failed to do job ${job.id}:`, error.message);
            throw error;
        }
    },
    {
        connection: redisConnection,
        concurrency: 5, // Process up to 5 emails at the exact same time
        limiter: {
            max: 10,
            duration: 1000 // Rate limit: Max 10 emails per second to prevent overwhelming your SMTP provider
        }
    }
);

emailWorker.on("error", err => {
    console.error("Redis/Internal Error:", err.message);
});

export default emailWorker;