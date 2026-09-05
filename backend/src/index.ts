import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import prisma from "./config/database";
import masterRouter from "./routes";
import "./workers/email.worker";
import { startCronJobs } from "./workers/cron.worker";

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
    exposedHeaders: ["Content-Disposition", "Content-Type"],
  }),
);

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get("/api/health", (req: Request, res: Response) => {
  res.json({ status: "ok", message: "Graduate School System API is running" });
});

// Connect to master router
app.use("/api", masterRouter);

// Block direct file access — files only served through /api/documents
app.use("/uploads", (_req, res) => {
  res.status(403).json({ error: "Direct file access is not allowed. Use the documents API." });
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});

startCronJobs();

export { prisma };
