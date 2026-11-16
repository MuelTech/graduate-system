import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import masterRouter from "./routes";
import { parseCorsOrigins } from "./utils/cors-origins";

/**
 * Builds the Express application without starting a network listener. The
 * production entrypoint attaches this app and the defense Socket.IO server to
 * one shared Node HTTP server.
 */
export function createApp() {
  const app = express();

  // Middleware
  app.use(
    cors({
      origin: parseCorsOrigins(process.env.FRONTEND_URL),
      credentials: true,
      exposedHeaders: ["Content-Disposition", "Content-Type"],
    }),
  );

  app.use(cookieParser());
  // Only these signing endpoints accept bounded base64 envelopes for signature images.
  app.use("/api/thesis/adviser/request", (req, res, next) => {
    express.json({ limit: "1500kb" })(req, res, (error) => {
      if (error?.type === "entity.too.large") { res.status(413).json({ error: "The Student signature submission is too large." }); return; }
      next(error);
    });
  });
  app.use("/api/settings/institutional-officials", (req, res, next) => {
    express.json({ limit: "4mb" })(req, res, (error) => {
      if (error?.type === "entity.too.large") { res.status(413).json({ error: "The Institutional Officials signature payload is too large." }); return; }
      next(error);
    });
  });
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

  return app;
}
