import { createServer } from "http";
import { createApp } from "./app";
import prisma from "./config/database";
import { initializeDefenseRealtime } from "./realtime/defense-realtime.server";
// import "./workers/email.worker";
// import { startCronJobs } from "./workers/cron.worker";

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

// startCronJobs();

export { app, httpServer, prisma };
