import { Router } from "express";
import { ApplicantController } from "../controllers/applicant.controller";
import { authenticateJWT, requireRole } from "../middlewares/auth.middleware";

const router = Router();
const applicantController = new ApplicantController();

//GET api/applicant/profile
//authenticateJWT checks if they are logged in
//requireRole makes sure they are an AAPLICANT
router.get(
  "/profile",
  authenticateJWT,
  requireRole(["APPLICANT"]),
  applicantController.getProfile,
);

export default router;
