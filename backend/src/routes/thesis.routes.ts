import { Router } from "express";
import { ThesisController } from "../controllers/thesis.controller";
import { authenticateJWT, requireRole } from "../middlewares/auth.middleware";
import { upload } from "../middlewares/upload.middleware";

const router = Router();
const thesisController = new ThesisController();

// STUDENT ONLY: Title Defense
router.post(
  "/defense/title",
  authenticateJWT,
  requireRole(["STUDENT"]),
  upload.fields([
    { name: "conceptPaper", maxCount: 1 },
    { name: "cor", maxCount: 1 },
    { name: "receipt", maxCount: 1 },
  ]),
  thesisController.applyTitle,
);

// STUDENT ONLY: Proposal Defense — stage-scoped document + cor + receipt
router.post(
  "/defense/proposal",
  authenticateJWT,
  requireRole(["STUDENT"]),
  upload.fields([
    { name: "document", maxCount: 1 },
    { name: "cor", maxCount: 1 },
    { name: "receipt", maxCount: 1 },
  ]),
  thesisController.applyProposal,
);

// STUDENT ONLY: Final Defense — stage-scoped document + cor + receipt
router.post(
  "/defense/final",
  authenticateJWT,
  requireRole(["STUDENT"]),
  upload.fields([
    { name: "document", maxCount: 1 },
    { name: "cor", maxCount: 1 },
    { name: "receipt", maxCount: 1 },
  ]),
  thesisController.applyFinal,
);

// STUDENT: ODP adviser candidates from passed Title Defense (GS-020)
router.get(
  "/adviser/candidates",
  authenticateJWT,
  requireRole(["STUDENT"]),
  thesisController.getAdviserCandidates,
);

// STUDENT: Request an adviser (GS-020) — does NOT create AdviserAssignment
router.post(
  "/adviser/request",
  authenticateJWT,
  requireRole(["STUDENT"]),
  thesisController.requestAdviser,
);

// ADMIN: Get all adviser requests
router.get(
  "/adviser/requests",
  authenticateJWT,
  requireRole(["ADMIN"]),
  thesisController.getAdviserRequests,
);

// PANELIST/ADVISER: own GS-020 inbox only (never the Admin-wide list)
router.get(
  "/adviser/requests/mine",
  authenticateJWT,
  requireRole(["PANELIST"]),
  thesisController.getMyAdviserRequests,
);

// PANELIST/ADVISER: CONFORME / Decline (does not create AdviserAssignment)
router.post(
  "/adviser/requests/:id/adviser-response",
  authenticateJWT,
  requireRole(["PANELIST"]),
  thesisController.respondAdviserRequest,
);

// ADMIN/DEAN: review queue (CONFORMED + Dean PENDING)
router.get(
  "/adviser/requests/dean-review",
  authenticateJWT,
  requireRole(["ADMIN"]),
  thesisController.getDeanReviewRequests,
);

// ADMIN/DEAN: APPROVE / REJECT after Adviser CONFORME (creates AdviserAssignment only on APPROVED)
router.post(
  "/adviser/requests/:id/dean-response",
  authenticateJWT,
  requireRole(["ADMIN"]),
  thesisController.deanRespondAdviserRequest,
);

// ADMIN: Get all active assignments
router.get(
  "/adviser/assignments",
  authenticateJWT,
  requireRole(["ADMIN"]),
  thesisController.getActiveAssignments,
);

// ADMIN & STUDENTS: Get available advisers (panelists)
router.get(
  "/adviser/available",
  authenticateJWT,
  requireRole(["ADMIN", "STUDENT"]),
  thesisController.getAvailableAdvisers,
);

// ADMIN: Approve and Assign the adviser
router.post(
  "/adviser/assign",
  authenticateJWT,
  requireRole(["ADMIN"]),
  thesisController.assignAdviser,
);

// ADMIN: Approve application requirements only (does NOT select title / schedule)
router.put(
  "/defense/:id/status",
  authenticateJWT,
  requireRole(["ADMIN"]),
  thesisController.updateStatus,
);

// ADMIN: Reject application with reason
router.put(
  "/defense/:id/reject",
  authenticateJWT,
  requireRole(["ADMIN"]),
  thesisController.rejectApplication,
);

// STUDENT: Resubmit a rejected application (REJECTED -> PENDING)
router.put(
  "/defense/:id/resubmit",
  authenticateJWT,
  requireRole(["STUDENT"]),
  thesisController.resubmitApplication,
);

// ADMIN: Active PANELIST candidates for defense committee
router.get(
  "/panelist-candidates",
  authenticateJWT,
  requireRole(["ADMIN"]),
  thesisController.getActivePanelistCandidates,
);

// ADMIN: Paginated approved applications (Scheduling & Panels)
router.get(
  "/defense/approved-applications",
  authenticateJWT,
  requireRole(["ADMIN"]),
  thesisController.getApprovedApplicationsPaginated,
);

// ADMIN: Server-backed panelist search (committee combobox)
router.get(
  "/panelist-search",
  authenticateJWT,
  requireRole(["ADMIN"]),
  thesisController.searchActivePanelists,
);

// STUDENT/ADMIN: eligibility read model (same rules as apply/schedule gates)
router.get(
  "/eligibility/:defenseType",
  authenticateJWT,
  thesisController.getMyEligibility,
);

// ADMIN: Committee policy (allowed roles, evaluators) for the builder UI
router.get(
  "/committee-policy",
  authenticateJWT,
  requireRole(["ADMIN"]),
  thesisController.getCommitteePolicy,
);

// ADMIN: Schedule a defense (Requires venueOrLink string)
router.post(
  "/defense/:id/schedule",
  authenticateJWT,
  requireRole(["ADMIN"]),
  thesisController.scheduleDefense,
);

// ADMIN: Get pending applications
router.get(
  "/defense/pending",
  authenticateJWT,
  requireRole(["ADMIN"]),
  thesisController.getPendingDefenses,
);

// ADMIN: Get approved applications ready for scheduling
router.get(
  "/defense/approved",
  authenticateJWT,
  requireRole(["ADMIN"]),
  thesisController.getApprovedDefenses,
);

// ADMIN: Paginated defense applications (review UI)
router.get(
  "/defense/applications",
  authenticateJWT,
  requireRole(["ADMIN"]),
  thesisController.getDefenseApplicationsPaginated,
);

// ADMIN: Workflow bucket counts (Needs Review / Ready / Active / History)
router.get(
  "/defense/applications/summary",
  authenticateJWT,
  requireRole(["ADMIN"]),
  thesisController.getDefenseWorkflowSummary,
);

// ADMIN: Get ALL applications (for full status view)
router.get(
  "/defense/all",
  authenticateJWT,
  requireRole(["ADMIN"]),
  thesisController.getAllDefenses,
);

// PANELIST: Get assigned defenses
router.get(
  "/defense/panelist/assignments",
  authenticateJWT,
  requireRole(["PANELIST"]),
  thesisController.getPanelistAssignments,
);

// PANELIST: Submit Score
router.post(
  "/defense/:scheduleId/score",
  authenticateJWT,
  requireRole(["PANELIST"]),
  thesisController.submitOralExamScore,
);

// PANELIST: Get Pending RAP Reports
router.get(
  "/defense/rap-reports/pending",
  authenticateJWT,
  requireRole(["PANELIST"]),
  thesisController.getPendingRapReports,
);

// PANELIST: Sign RAP Report
router.post(
  "/defense/rap-reports/:sigId/sign",
  authenticateJWT,
  requireRole(["PANELIST"]),
  thesisController.signRapReport,
);

// LOBBY POLLING ROUTES
router.get("/defense/:scheduleId/lobby", authenticateJWT, thesisController.getLobbyStatus);
router.put("/defense/:scheduleId/notes", authenticateJWT, thesisController.updateRapporteurNotes);
// Formal conclusion — sole writer of academic outcome (interim: ADMIN until OPEN_QUESTION §14.4).
// Score completion never concludes; RAP is created only here.
router.post(
  "/defense/:scheduleId/conclude",
  authenticateJWT,
  requireRole(["ADMIN"]),
  thesisController.concludeDefense,
);

// ADMIN: Manage RAP Reports
router.get(
  "/defense/rap-reports/all",
  authenticateJWT,
  requireRole(["ADMIN"]),
  thesisController.getAllRapReports,
);

router.post(
  "/defense/rap-reports/:rapId/distribute",
  authenticateJWT,
  requireRole(["ADMIN"]),
  thesisController.distributeRapReport,
);

router.post(
  "/defense/rap-reports/:rapId/remind",
  authenticateJWT,
  requireRole(["ADMIN"]),
  thesisController.remindRapReportPanelists,
);

export default router;
