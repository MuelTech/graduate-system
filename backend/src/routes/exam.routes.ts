import { Router } from "express";
import { ExamController } from "../controllers/exam.controller";
import { authenticateJWT, requireRole } from "../middlewares/auth.middleware";

const router = Router();
const examController = new ExamController();

// 🔒 ADMIN ONLY: Create slots
router.post('/slots', authenticateJWT, requireRole(['ADMIN']), examController.createSlot);

// 🔒 APPLICANT ONLY: View available slots and schedule
router.get('/slots/available', authenticateJWT, requireRole(['APPLICANT']), examController.getAvailableSlots);
router.post('/schedule', authenticateJWT, requireRole(['APPLICANT']), examController.scheduleExam);

export default router;
