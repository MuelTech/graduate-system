import { createServer } from "http";
import { createApp } from "./app";
import prisma from "./config/database";
import { initializeDefenseRealtime } from "./realtime/defense-realtime.server";
import { startEmailWorker } from "./workers/email.worker";
import { startCronJobs } from "./workers/cron.worker";
import { startExamExpiryWorker } from "./workers/exam-expiry.worker";

const app = createApp();
const PORT = process.env.PORT || 5000;

// Express REST and the defense Socket.IO namespace share one HTTP server.
const httpServer = createServer(app);
initializeDefenseRealtime(httpServer);

// Start server
httpServer.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});

const emailWorker = startEmailWorker();
const cronJobs = startCronJobs();
const examExpiryWorker = startExamExpiryWorker();

const stopBackgroundWorkers = () => {
  emailWorker.stop();
  cronJobs.stop();
  examExpiryWorker.stop();
};

httpServer.on("close", stopBackgroundWorkers);

const handleShutdownSignal = (signal: string) => {
  console.log(`[Server] Received ${signal}; shutting down gracefully...`);
  stopBackgroundWorkers();
  httpServer.close(() => {
    void prisma.$disconnect().finally(() => process.exit(0));
  });
};

process.once("SIGTERM", () => handleShutdownSignal("SIGTERM"));
process.once("SIGINT", () => handleShutdownSignal("SIGINT"));

export { app, httpServer, prisma };
