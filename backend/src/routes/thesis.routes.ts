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

// STUDENT ONLY: Proposal Defense application — COR + fee proof only.
// Certified Proposal manuscript is resolved internally (CP3-FIX1).
router.post(
  "/defense/proposal",
  authenticateJWT,
  requireRole(["STUDENT"]),
  upload.fields([
    { name: "cor", maxCount: 1 },
    { name: "receipt", maxCount: 1 },
  ]),
  thesisController.applyProposal,
);

// STUDENT ONLY: Final Defense application — COR + fee proof (certified manuscript internal)
router.post(
  "/defense/final",
  authenticateJWT,
  requireRole(["STUDENT"]),
  upload.fields([
    { name: "cor", maxCount: 1 },
    { name: "receipt", maxCount: 1 },
  ]),
  thesisController.applyFinal,
);

// ── CP4: Final Adviser review (pre-application manuscript) ──

router.get(
  "/final-adviser-review",
  authenticateJWT,
  requireRole(["STUDENT"]),
  thesisController.getFinalAdviserReviewState,
);

router.post(
  "/final-adviser-review/manuscript",
  authenticateJWT,
  requireRole(["STUDENT"]),
  upload.single("document"),
  thesisController.submitFinalManuscriptForReview,
);

router.get(
  "/final-adviser-review/tasks",
  authenticateJWT,
  requireRole(["PANELIST"]),
  thesisController.listMyFinalAdviserReviews,
);

router.get(
  "/final-adviser-review/tasks/:thesisId",
  authenticateJWT,
  requireRole(["PANELIST"]),
  thesisController.getFinalAdviserReviewTask,
);

router.post(
  "/final-adviser-review/tasks/:thesisId/request-changes",
  authenticateJWT,
  requireRole(["PANELIST"]),
  thesisController.requestFinalAdviserChanges,
);

router.post(
  "/final-adviser-review/tasks/:thesisId/certify",
  authenticateJWT,
  requireRole(["PANELIST"]),
  thesisController.certifyFinalAdviserReview,
);

// STUDENT: central Thesis Journey read model (authoritative progression)
router.get(
  "/journey",
  authenticateJWT,
  requireRole(["STUDENT"]),
  thesisController.getStudentThesisJourney,
);

// ── CP3: Proposal Adviser review (pre-application manuscript) ──

// STUDENT: Proposal adviser-review state
router.get(
  "/proposal-adviser-review",
  authenticateJWT,
  requireRole(["STUDENT"]),
  thesisController.getProposalAdviserReviewState,
);

// STUDENT: upload/resubmit Proposal manuscript for Adviser review (not Admin application)
router.post(
  "/proposal-adviser-review/manuscript",
  authenticateJWT,
  requireRole(["STUDENT"]),
  upload.single("document"),
  thesisController.submitProposalManuscriptForReview,
);

// ACTIVE ADVISER: own Proposal review queue
router.get(
  "/proposal-adviser-review/tasks",
  authenticateJWT,
  requireRole(["PANELIST"]),
  thesisController.listMyProposalAdviserReviews,
);

// ACTIVE ADVISER: authorized review task detail
router.get(
  "/proposal-adviser-review/tasks/:thesisId",
  authenticateJWT,
  requireRole(["PANELIST"]),
  thesisController.getProposalAdviserReviewTask,
);

// ACTIVE ADVISER: request changes
router.post(
  "/proposal-adviser-review/tasks/:thesisId/request-changes",
  authenticateJWT,
  requireRole(["PANELIST"]),
  thesisController.requestProposalAdviserChanges,
);

// ACTIVE ADVISER: certify + e-sign
router.post(
  "/proposal-adviser-review/tasks/:thesisId/certify",
  authenticateJWT,
  requireRole(["PANELIST"]),
  thesisController.certifyProposalAdviserReview,
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

// PANELIST: legacy score → own DRAFT only (never FINALIZED)
router.post(
  "/defense/:scheduleId/score",
  authenticateJWT,
  requireRole(["PANELIST"]),
  thesisController.submitOralExamScore,
);

// PANELIST: own evaluation lifecycle (CP5)
router.get(
  "/defense/:scheduleId/evaluation/me",
  authenticateJWT,
  requireRole(["PANELIST"]),
  thesisController.getMyOralEvaluation,
);

router.put(
  "/defense/:scheduleId/evaluation/draft",
  authenticateJWT,
  requireRole(["PANELIST"]),
  thesisController.saveOralEvaluationDraft,
);

router.post(
  "/defense/:scheduleId/evaluation/finalize",
  authenticateJWT,
  requireRole(["PANELIST"]),
  thesisController.finalizeOralEvaluation,
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
// CP6 Defense Workspace (role-safe read model)
router.get(
  "/defense/:scheduleId/workspace",
  authenticateJWT,
  requireRole(["PANELIST"]),
  thesisController.getDefenseWorkspace,
);

// CP6: secure Rapporteur draft notes (session RAPPORTEUR only)
router.put(
  "/defense/:scheduleId/workspace/rapporteur-notes",
  authenticateJWT,
  requireRole(["PANELIST"]),
  thesisController.saveRapporteurWorkspaceNotes,
);

// Legacy lobby — compatibility only
router.get("/defense/:scheduleId/lobby", authenticateJWT, thesisController.getLobbyStatus);
// Legacy notes — same Rapporteur authorization as workspace notes
router.put(
  "/defense/:scheduleId/notes",
  authenticateJWT,
  requireRole(["PANELIST"]),
  thesisController.saveRapporteurWorkspaceNotes,
);
// CP7 formal conclusion — session CHAIRMAN assignment is authoritative (not account role).
// Score completion never concludes; RAP is created only here.
router.post(
  "/defense/:scheduleId/conclusion",
  authenticateJWT,
  requireRole(["PANELIST"]),
  thesisController.recordFormalConclusion,
);
// Legacy path delegates to the same secure service.
router.post(
  "/defense/:scheduleId/conclude",
  authenticateJWT,
  requireRole(["PANELIST"]),
  thesisController.concludeDefense,
);

// CP7: Rapporteur finalize defense notes (irreversible)
router.post(
  "/defense/:scheduleId/rapporteur/finalize",
  authenticateJWT,
  requireRole(["PANELIST"]),
  thesisController.finalizeRapporteurNotes,
);

// CP7: Official Criteria (ADMIN or owning evaluator)
router.get(
  "/defense/:scheduleId/records/criteria/:panelAssignmentId",
  authenticateJWT,
  requireRole(["ADMIN", "PANELIST"]),
  thesisController.getOfficialCriteria,
);

// CP7: Oral Examination Summary — ADMIN or session CHAIRMAN only (auth inside service)
router.get(
  "/defense/:scheduleId/records/summary",
  authenticateJWT,
  requireRole(["ADMIN", "PANELIST"]),
  thesisController.getOralExamSummary,
);

// CP7: Admin Defense Records (read-only)
router.get(
  "/defense/records",
  authenticateJWT,
  requireRole(["ADMIN"]),
  thesisController.getAdminDefenseRecords,
);
router.get(
  "/defense/:scheduleId/records",
  authenticateJWT,
  requireRole(["ADMIN"]),
  thesisController.getAdminDefenseRecordDetail,
);

// CP7: Student-owned RAP access
router.get(
  "/student/defense/:scheduleId/rap",
  authenticateJWT,
  requireRole(["STUDENT"]),
  thesisController.getStudentDefenseRap,
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
