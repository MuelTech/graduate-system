import { Router } from "express";
import { DatabankController } from "../controllers/databank.controller";
import { authenticateJWT, requireRole } from "../middlewares/auth.middleware";

const router = Router();
const controller = new DatabankController();

// 1. DEPRECATED public read aliases.
//    These MUST delegate to the canonical /repository publication service so
//    they can never expose a private archive or vary their payload by caller
//    role. They no longer use optional authentication.
router.get("/public", controller.searchPublic);
router.get("/public/:id", controller.getEntryById);

// 2. Legacy ADMIN archive list. Publication mutations are NOT served here;
//    Admin publishes through /repository/admin/entries/:id/publish|unpublish.
router.get("/", authenticateJWT, requireRole(["ADMIN"]), controller.getAllEntries);

// 3. Protected Student archive routes (DL-9 — private Databank registration)
router.get(
  "/archive/me",
  authenticateJWT,
  requireRole(["STUDENT"]),
  controller.getArchiveContext,
);
router.post(
  "/archive",
  authenticateJWT,
  requireRole(["STUDENT"]),
  controller.registerArchive,
);

// DEPRECATED compatibility alias: delegates to the safe archive contract and
// ignores any client-supplied thesisId/title/path authority fields.
router.post("/", authenticateJWT, requireRole(["STUDENT"]), controller.createEntry);

export default router;
