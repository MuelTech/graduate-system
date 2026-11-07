import { requireExamAdministrationCapability, excludeExamAdministrationAction } from "../middlewares/exam-administration-capability.middleware";
import { Router } from "express";
import { ExamController } from "../controllers/exam.controller";
import { ExamAmendmentController } from "../controllers/exam-amendment.controller";
import { authenticateJWT, requireRole } from "../middlewares/auth.middleware";

const router = Router();
const examController = new ExamController();
const amendments = new ExamAmendmentController();
router.post('/applications/:id/missed-appeal', authenticateJWT, requireRole(['APPLICANT']), amendments.action('MISSED_APPEAL'));
router.post('/applications/:id/missed-appeal/approve', authenticateJWT, requireRole(['ADMIN']), requireExamAdministrationCapability("exam.schedules.manage"), amendments.action('APPROVE_APPEAL'));
router.post('/applications/:id/missed-appeal/reject', authenticateJWT, requireRole(['ADMIN']), requireExamAdministrationCapability("exam.schedules.manage"), amendments.action('REJECT_APPEAL'));
router.post('/applications/:id/reschedule', authenticateJWT, requireRole(['ADMIN']), requireExamAdministrationCapability("exam.schedules.manage"), amendments.action('ADMIN_RESCHEDULE'));
router.post('/applications/:id/cancel-appointment', authenticateJWT, requireRole(['ADMIN']), requireExamAdministrationCapability("exam.schedules.manage"), amendments.action('ADMIN_CANCELLATION'));
router.get('/applications/:id/amendment-options', authenticateJWT, requireRole(['ADMIN']), requireExamAdministrationCapability("exam.schedules.view"), amendments.options);
router.post('/applications/:id/reconsider-result', authenticateJWT, requireRole(['ADMIN']), requireExamAdministrationCapability("exam.results.reconsider"), amendments.reconsider);

// ADMIN ONLY: Create slots
router.post('/slots', authenticateJWT, requireRole(['ADMIN']), requireExamAdministrationCapability("exam.schedules.manage"), examController.createSlot);

// APPLICANT ONLY: View available slots and schedule
router.get('/slots/available', authenticateJWT, requireRole(['APPLICANT']), examController.getAvailableSlots);
router.post('/schedule', authenticateJWT, requireRole(['APPLICANT']), examController.scheduleExam);

// ADMIN ONLY: View all slots
router.get('/slots', authenticateJWT, requireRole(['ADMIN']), requireExamAdministrationCapability("exam.schedules.view"), examController.getAllSlots);
router.get('/slots/:id/bookings', authenticateJWT, requireRole(['ADMIN']), requireExamAdministrationCapability("exam.schedules.view"), examController.getSlotBookings);

// Routes for Admin Exam Applications
router.get('/assignment-options/:studentId', authenticateJWT, requireRole(['ADMIN']), requireExamAdministrationCapability("exam.schedules.view"), examController.getAssignmentOptions);
router.post('/assignments', authenticateJWT, requireRole(['ADMIN']), requireExamAdministrationCapability("exam.schedules.manage"), examController.assignApplicant);
router.get('/applications', authenticateJWT, requireRole(['ADMIN']), requireExamAdministrationCapability("exam.records.view"), examController.getAllApplications);
router.get('/applications/:id', authenticateJWT, requireRole(['ADMIN']), requireExamAdministrationCapability("exam.records.view"), examController.getApplicationDetail);

// APPLICANT ONLY: Get applicant status
router.get('/status', authenticateJWT, requireRole(['APPLICANT']), examController.getApplicantStatus);

// ADMIN ONLY: Update a slot
router.put('/slots/:id', authenticateJWT, requireRole(['ADMIN']), requireExamAdministrationCapability("exam.schedules.manage"), examController.updateSlot);

// ADMIN ONLY: Toggle slot active status
router.patch('/slots/:id/status', authenticateJWT, requireRole(['ADMIN']), requireExamAdministrationCapability("exam.schedules.manage"), examController.toggleSlotStatus);

// APPLICANT ONLY: Entrance Exam Reschedule Appeal
router.post('/appeal', authenticateJWT, requireRole(['APPLICANT']), examController.appealMissedExam);

// ADMIN ONLY: Appeal Management
router.get('/appeals', authenticateJWT, requireRole(['ADMIN']), requireExamAdministrationCapability("exam.schedules.view"), examController.getAppeals);
router.patch('/appeals/:id/approve', authenticateJWT, requireRole(['ADMIN']), requireExamAdministrationCapability("exam.schedules.manage"), examController.approveAppeal);
router.patch('/appeals/:id/reject', authenticateJWT, requireRole(['ADMIN']), requireExamAdministrationCapability("exam.schedules.manage"), examController.rejectAppeal);

// APPLICANT ONLY: Exam Result
router.get('/result', authenticateJWT, requireRole(['APPLICANT']), examController.getExamResult);

// ADMIN ONLY: Exam Scores Management
// UIUX-2E: the legacy grading-queue and score-review READ routes were retired
// together with the Score Management workspace. The mutations below are
// intentionally retained (and keep the /exam/scores namespace).
router.post('/scores/:id/grade', authenticateJWT, requireRole(['ADMIN']), excludeExamAdministrationAction("ESSAY_EVALUATION"), examController.gradeEssay);
router.post('/scores/:id/finalize', authenticateJWT, requireRole(['ADMIN']), requireExamAdministrationCapability("exam.results.finalize"), examController.finalizeResult);
router.post('/scores/:id/send-email', authenticateJWT, requireRole(['ADMIN']), excludeExamAdministrationAction("RESULT_EMAIL"), examController.confirmResultAndEmail);

export default router;
