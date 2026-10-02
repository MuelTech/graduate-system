import { Router } from "express";
import { RepositoryController } from "../controllers/repository.controller";
import { authenticateJWT, requireRole } from "../middlewares/auth.middleware";

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

// Public publication routes (auth is deliberately not applied).
router.get("/", controller.listPublic);
router.get("/:id", controller.getPublic);

export default router;
