import { Router } from "express";
import { authenticateJWT, type AuthenticatedRequest } from "../middlewares/auth.middleware";
import { assertFullAdministrator } from "../access/administrator-management";
import { AdministratorAccessController } from "../controllers/administrator-access.controller";
import { AdministratorAccessService } from "../services/administrator-access.service";
import { AppError } from "../utils/AppError";

/** Dependency seam for synthetic tests; production always uses the dormant default service. */
export function createAdministratorAccessRouter(service = new AdministratorAccessService()) {
  const router = Router(); const controller = new AdministratorAccessController(service);
  router.use(authenticateJWT);
  router.use((req: AuthenticatedRequest, res, next) => {
    res.setHeader("Cache-Control", "private, no-store");
    try { assertFullAdministrator(req.currentAccount ?? null); next(); }
    catch (error) { res.status(error instanceof AppError ? error.statusCode : 503).json({ error: "Full Administrator authority is required." }); }
  });
  router.get("/", controller.list);
  router.get("/:userId", controller.get);
  router.post("/", controller.create);
  router.patch("/:userId", controller.update);
  router.delete("/:userId/access", controller.removeAccess);
  return router;
}
export default createAdministratorAccessRouter();
