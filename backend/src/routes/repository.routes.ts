import { Router } from "express";
import { RepositoryController } from "../controllers/repository.controller";
import { authenticateJWT, optionalAuthenticateJWT, requireRole } from "../middlewares/auth.middleware";

/**
 * DL-10: canonical Research Repository API.
 *
 *   PUBLIC (no auth, identical payload for every viewer)
 *     GET /repository
 *     GET /repository/:id
 *
 *   ADMIN (publication decision)
 *     GET /repository/admin/entries
 *     PUT /repository/admin/entries/:id/publish
 *     PUT /repository/admin/entries/:id/unpublish
 *
 * Admin routes are registered before `/:id` so the literal `admin` segment can
 * never be interpreted as a publication id.
 */

const router = Router();
const controller = new RepositoryController();

// Admin publication routes first.
router.get(
  "/admin/entries",
  authenticateJWT,
  requireRole(["ADMIN"]),
  controller.listAdmin,
);
router.put(
  "/admin/entries/:id/publish",
  authenticateJWT,
  requireRole(["ADMIN"]),
  controller.publish,
);
router.put(
  "/admin/entries/:id/unpublish",
  authenticateJWT,
  requireRole(["ADMIN"]),
  controller.unpublish,
);
router.put(
  "/admin/entries/:id/metadata",
  authenticateJWT,
  requireRole(["ADMIN"]),
  controller.updateMetadata,
);

// Public publication routes with optional JWT authentication.
router.get("/", optionalAuthenticateJWT, controller.listPublic);
router.get("/:id", optionalAuthenticateJWT, controller.getPublic);

export default router;
