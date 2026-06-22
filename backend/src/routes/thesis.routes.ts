import { Router } from 'express';
import { ThesisController } from '../controllers/thesis.controller';
import { authenticateJWT, requireRole } from '../middlewares/auth.middleware';
import { upload } from '../middlewares/upload.middleware';

const router = Router();
const thesisController = new ThesisController();

// 🔒 STUDENT ONLY: Title Defense
router.post(
  '/defense/title', 
  authenticateJWT, 
  requireRole(['STUDENT']), 
  upload.fields([
    { name: 'conceptPaper', maxCount: 1 },
    { name: 'cor', maxCount: 1 },
    { name: 'receipt', maxCount: 1 }
  ]), 
  thesisController.applyTitle
);

// 🔒 STUDENT ONLY: Proposal Defense (Expects file 'document')
router.post(
  '/defense/proposal', 
  authenticateJWT, 
  requireRole(['STUDENT']), 
  upload.single('document'), 
  thesisController.applyProposal
);

// 🔒 STUDENT ONLY: Final Defense (Expects file 'document')
router.post(
  '/defense/final', 
  authenticateJWT, 
  requireRole(['STUDENT']), 
  upload.single('document'), 
  thesisController.applyFinal
);

// 🔒 STUDENT: Request an adviser
router.post(
  '/adviser/request', 
  authenticateJWT, 
  requireRole(['STUDENT']), 
  thesisController.requestAdviser
);

// 🔒 ADMIN: Get all adviser requests
router.get(
  '/adviser/requests',
  authenticateJWT,
  requireRole(['ADMIN']),
  thesisController.getAdviserRequests
);

// 🔒 ADMIN: Get all active assignments
router.get(
  '/adviser/assignments',
  authenticateJWT,
  requireRole(['ADMIN']),
  thesisController.getActiveAssignments
);

// 🔒 ADMIN: Get available advisers (panelists)
router.get(
  '/adviser/available',
  authenticateJWT,
  requireRole(['ADMIN']),
  thesisController.getAvailableAdvisers
);

// 🔒 ADMIN: Approve and Assign the adviser
router.post(
  '/adviser/assign', 
  authenticateJWT, 
  requireRole(['ADMIN']), 
  thesisController.assignAdviser
);

// 🔒 ADMIN: Approve or reject a defense application (Update Status)
router.put(
  '/defense/:id/status', 
  authenticateJWT, 
  requireRole(['ADMIN']), 
  thesisController.updateStatus
);

// 🔒 ADMIN: Schedule a defense (Requires venueOrLink string)
router.get(
  '/defense/pending', 
  authenticateJWT, 
  requireRole(['ADMIN']), 
  thesisController.getPendingDefenses
);

// 🔒 ADMIN: Get approved applications ready for scheduling
router.get(
  '/defense/approved', 
  authenticateJWT, 
  requireRole(['ADMIN']), 
  thesisController.getApprovedDefenses
);

router.post(
  '/defense/:id/schedule', 
  authenticateJWT, 
  requireRole(['ADMIN']), 
  thesisController.scheduleDefense
);

export default router;
