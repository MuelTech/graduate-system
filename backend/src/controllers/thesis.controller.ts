import { Request, Response } from 'express';
import { ThesisService } from '../services/thesis.service';
import { StudentThesisJourneyService } from '../services/student-thesis-journey.service';
import { ProposalAdviserReviewService } from '../services/proposal-adviser-review.service';
import { FinalAdviserReviewService } from '../services/final-adviser-review.service';
import { OralEvaluationService } from '../services/oral-evaluation.service';
import { DefenseWorkspaceService } from '../services/defense-workspace.service';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import type { MissingRequirement } from '../interfaces/defense-eligibility.interfaces';
import { AppError } from '../utils/AppError';
import {
  cleanupRequestUploads,
  commitRequestUploads,
} from '../storage/request-uploads';

function sendEligibilityError(res: Response, error: any): void {
  const missing = (error as { missing?: MissingRequirement[] }).missing;
  const status = error?.statusCode || 400;
  if (missing) {
    res.status(status).json({ error: error.message, missing });
    return;
  }
  res.status(status).json({ error: error.message });
}

/**
 * CP5-FIX2: preserve absent vs explicit-null for PATCH optional fields.
 * Absent property is omitted from input so the service can keep stored value.
 */
function pickOptionalPatchFields(
  body: Record<string, unknown> | undefined,
  fields: readonly string[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const src = body ?? {};
  for (const key of fields) {
    if (Object.prototype.hasOwnProperty.call(src, key)) {
      out[key] = src[key];
    }
  }
  return out;
}

export class ThesisController {
  private thesisService = new ThesisService();
  private journeyService = new StudentThesisJourneyService();
  private proposalAdviserReview = new ProposalAdviserReviewService();
  private finalAdviserReview = new FinalAdviserReviewService();
  private oralEvaluation = new OralEvaluationService();
  private defenseWorkspace = new DefenseWorkspaceService();

  getPendingDefenses = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const result = await this.thesisService.getPendingDefenses();
      res.status(200).json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  };

  getApprovedDefenses = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const result = await this.thesisService.getApprovedDefenses();
      res.status(200).json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  };

  getAllDefenses = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const result = await this.thesisService.getAllDefenses();
      res.status(200).json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  };

  getDefenseApplicationsPaginated = async (
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> => {
    try {
      const result = await this.thesisService.getDefenseApplicationsPaginated({
        page: Number(req.query.page),
        pageSize: Number(req.query.pageSize),
        search: req.query.search as string | undefined,
        stage: req.query.stage as string | undefined,
        status: req.query.status as string | undefined,
        bucket: req.query.bucket as string | undefined,
        programId: req.query.programId as string | undefined,
      });
      res.status(200).json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  };

  getDefenseWorkflowSummary = async (
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> => {
    try {
      const result = await this.thesisService.getDefenseWorkflowSummary({
        search: req.query.search as string | undefined,
        stage: req.query.stage as string | undefined,
        programId: req.query.programId as string | undefined,
        status: req.query.status as string | undefined,
      });
      res.status(200).json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  };

  getAdviserRequests = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const result = await this.thesisService.getAllAdviserRequests();
      res.status(200).json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  };

  getActiveAssignments = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const result = await this.thesisService.getAllActiveAssignments();
      res.status(200).json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  };

  getAvailableAdvisers = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const result = await this.thesisService.getAvailableAdvisers();
      res.status(200).json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  };

  applyTitle = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) throw new Error('Unauthorized');
      
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      if (!files || !files.conceptPaper || !files.cor || !files.receipt) {
        throw new Error('Concept Paper, COR, and Receipt are all required.');
      }

      const result = await this.thesisService.applyTitleDefense(
        req.user.userId, 
        req.body, 
        files.conceptPaper[0].path,
        files.cor[0].path,
        files.receipt[0].path
      );
      commitRequestUploads(req);
      res.status(201).json({ message: 'Title Defense application submitted successfully', result });
    } catch (error: any) {
      await cleanupRequestUploads(req);
      console.error("APPLY TITLE ERROR:", error);
      sendEligibilityError(res, error);
    }
  };

  applyProposal = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) throw new Error('Unauthorized');

      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      // CP3-FIX1: certified Proposal manuscript is system-owned — no second upload.
      const cor = files?.['cor']?.[0];
      const receipt = files?.['receipt']?.[0];

      if (!cor) throw new Error('COR is required');
      if (!receipt) throw new Error('Defense-fee proof of payment is required');

      const result = await this.thesisService.applyProposalDefense(
        req.user.userId,
        cor.path,
        receipt.path,
      );
      commitRequestUploads(req);
      res.status(200).json({ message: 'Proposal Defense application submitted successfully', result });
    } catch (error: any) {
      await cleanupRequestUploads(req);
      sendEligibilityError(res, error);
    }
  };

  applyFinal = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) throw new Error('Unauthorized');

      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      // CP4: certified Final manuscript is system-owned — no second upload.
      const cor = files?.['cor']?.[0];
      const receipt = files?.['receipt']?.[0];

      if (!cor) throw new Error('COR is required');
      if (!receipt) throw new Error('Defense-fee proof of payment is required');

      const result = await this.thesisService.applyFinalDefense(
        req.user.userId,
        cor.path,
        receipt.path,
      );
      commitRequestUploads(req);
      res.status(200).json({ message: 'Final Defense application submitted successfully', result });
    } catch (error: any) {
      await cleanupRequestUploads(req);
      sendEligibilityError(res, error);
    }
  };

  requestAdviser = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) throw new Error('Unauthorized');
      const result = await this.thesisService.requestAdviser(req.user.userId, {
        requestedAdviserId: req.body?.requestedAdviserId,
        reason: req.body?.reason,
      });
      res.status(201).json({ message: 'Adviser request submitted', result });
    } catch (error: any) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      res.status(400).json({ error: error.message });
    }
  };

  /** STUDENT: ODP adviser candidates from the passed Title Defense session. */
  /** STUDENT: central Thesis Journey read model (sidebar, locks, currentStep). */
  getStudentThesisJourney = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) throw new Error('Unauthorized');
      const result = await this.journeyService.getJourney(req.user.userId);
      res.status(200).json(result);
    } catch (error: any) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      res.status(400).json({ error: error.message });
    }
  };

  getAdviserCandidates = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) throw new Error('Unauthorized');
      const result = await this.thesisService.listAdviserCandidates(req.user.userId);
      res.status(200).json(result);
    } catch (error: any) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      res.status(400).json({ error: error.message });
    }
  };

  /** PANELIST: own GS-020 inbox only (requestedAdviserId === me). */
  getMyAdviserRequests = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) throw new Error('Unauthorized');
      const result = await this.thesisService.listMyAdviserRequests(req.user.userId);
      res.status(200).json(result);
    } catch (error: any) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      res.status(400).json({ error: error.message });
    }
  };

  /** PANELIST: CONFORME / Decline for own requested-Adviser requests. */
  respondAdviserRequest = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) throw new Error('Unauthorized');
      const decision = String(req.body?.decision || "").toUpperCase();
      const result = await this.thesisService.respondAdviserRequest(
        req.user.userId,
        String(req.params.id),
        { decision, remarks: req.body?.remarks },
      );
      res.status(200).json(result);
    } catch (error: any) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      res.status(400).json({ error: error.message });
    }
  };

  /** ADMIN/Dean: review queue (CONFORMED + Dean PENDING). */
  getDeanReviewRequests = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const result = await this.thesisService.listDeanReviewRequests();
      res.status(200).json(result);
    } catch (error: any) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      res.status(400).json({ error: error.message });
    }
  };

  /** ADMIN/Dean: APPROVE / REJECT after Adviser CONFORME. */
  deanRespondAdviserRequest = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) throw new Error('Unauthorized');
      const decision = String(req.body?.decision || "").toUpperCase();
      const result = await this.thesisService.deanDecideAdviserRequest(
        req.user.userId,
        String(req.params.id),
        { decision, remarks: req.body?.remarks },
      );
      res.status(200).json(result);
    } catch (error: any) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      res.status(400).json({ error: error.message });
    }
  };

  assignAdviser = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) throw new Error('Unauthorized');
      const result = await this.thesisService.assignAdviser(req.user.userId, req.body);
      res.status(200).json({ message: 'Adviser officially assigned', result });
    } catch (error: any) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      res.status(400).json({ error: error.message });
    }
  };

  updateStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string; // thesisId
      // Application review only — never selects a winning title (Title Defense conclusion owns that).
      const result = await this.thesisService.updateDefenseStatus(id, {
        status: req.body.status,
      });
      res.status(200).json({ message: 'Thesis status updated', result });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  };

  rejectApplication = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const result = await this.thesisService.rejectApplication(id, req.body.reason ?? '');
      res.status(200).json({ message: 'Application rejected', result });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  };

  resubmitApplication = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) throw new Error('Unauthorized');
      const id = req.params.id as string;
      const result = await this.thesisService.resubmitApplication(req.user.userId, id);
      res.status(200).json({ message: 'Application resubmitted for review', result });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  };

  getActivePanelistCandidates = async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const result = await this.thesisService.getActivePanelistCandidates();
      res.status(200).json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  };

  getApprovedApplicationsPaginated = async (
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> => {
    try {
      const result = await this.thesisService.getApprovedApplicationsPaginated({
        page: Number(req.query.page),
        pageSize: Number(req.query.pageSize),
        search: req.query.search as string | undefined,
        defenseType: req.query.defenseType as string | undefined,
        programId: req.query.programId as string | undefined,
      });
      res.status(200).json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  };

  searchActivePanelists = async (
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> => {
    try {
      const result = await this.thesisService.searchActivePanelists({
        page: Number(req.query.page),
        pageSize: Number(req.query.pageSize),
        search: req.query.search as string | undefined,
      });
      res.status(200).json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  };

  getMyEligibility = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) throw new Error('Unauthorized');
      const result = await this.thesisService.getMyEligibility(
        req.user.userId,
        String(req.params.defenseType || req.query.defenseType || ''),
      );
      res.status(200).json(result);
    } catch (error: any) {
      sendEligibilityError(res, error);
    }
  };

  getCommitteePolicy = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const defenseType = String(req.query.defenseType || "").toUpperCase();
      const programType = req.query.programType
        ? String(req.query.programType)
        : undefined;
      const result = this.thesisService.getCommitteePolicy(defenseType, programType);
      res.status(200).json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  };

  scheduleDefense = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) throw new Error('Unauthorized');
      const id = req.params.id as string; // thesisId
      const schedule = await this.thesisService.scheduleDefense(id, req.user.userId, req.body);      
      // Email each panelist asynchronously via BullMQ
      if (schedule && schedule.panelAssignments) {
        for (const panel of schedule.panelAssignments) {
          if (panel.user && panel.user.email) {
            await import("../services/email.service").then(module => {
              module.EmailService.sendTemplateEmail(
                panel.user.email,
                "defense_scheduled",
                {
                  panelist_name: `${panel.user.firstName} ${panel.user.lastName}`,
                  defense_date: schedule.defenseDate.toDateString(),
                  lobby_link: `${process.env.FRONTEND_URL || "http://localhost:3000"}/defense-lobby/${schedule.id}`
                }
              ).catch(err => console.error("Failed to queue email:", err));
            });
          }
        }
      }

      res.status(201).json({ message: 'Defense scheduled and panelists notified', result: schedule });
    } catch (error: any) {
      sendEligibilityError(res, error);
    }
  };

  getPanelistAssignments = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) throw new Error('Unauthorized');
      const result = await this.thesisService.getPanelistAssignments(req.user.userId);
      res.status(200).json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  };

  submitOralExamScore = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) throw new Error("Unauthorized");
      const scheduleId  = req.params.scheduleId as string;
      const { panelId, scores } = req.body;
      // CP5: legacy /score = own Draft only (client panelId is not ownership).
      const result = await this.thesisService.submitOralExamScore(
        req.user.userId,
        panelId,
        scheduleId,
        scores,
      );
      res.status(200).json({ message: "Evaluation draft saved.", result });
    } catch (error: any) {
      res.status(error?.statusCode || 400).json({ error: error.message });
    }
  }

  // ── CP5 evaluator evaluation lifecycle ───────────────────────────

  getMyOralEvaluation = async (
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const scheduleId = req.params.scheduleId as string;
      res
        .status(200)
        .json(await this.oralEvaluation.getMyEvaluation(scheduleId, req.user.userId));
    } catch (error: any) {
      res.status(error?.statusCode || 400).json({ error: error.message });
    }
  };

  saveOralEvaluationDraft = async (
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const scheduleId = req.params.scheduleId as string;
      const optional = pickOptionalPatchFields(req.body, [
        "rating",
        "recommendations",
      ]);
      res.status(200).json(
        await this.oralEvaluation.saveDraft(scheduleId, req.user.userId, {
          criteria: req.body?.criteria ?? {},
          ...optional,
          clientPanelId: req.body?.panelId ?? null,
        } as Parameters<typeof this.oralEvaluation.saveDraft>[2]),
      );
    } catch (error: any) {
      res.status(error?.statusCode || 400).json({ error: error.message });
    }
  };

  finalizeOralEvaluation = async (
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const scheduleId = req.params.scheduleId as string;
      const optional = pickOptionalPatchFields(req.body, [
        "rating",
        "recommendations",
      ]);
      res.status(200).json(
        await this.oralEvaluation.finalize(scheduleId, req.user.userId, {
          signatureData: String(req.body?.signatureData ?? ""),
          criteria: req.body?.criteria ?? {},
          ...optional,
          clientPanelId: req.body?.panelId ?? null,
          clientSignedAt: req.body?.signedAt ?? null,
          clientFinalizedAt: req.body?.finalizedAt ?? null,
        } as Parameters<typeof this.oralEvaluation.finalize>[2]),
      );
    } catch (error: any) {
      res.status(error?.statusCode || 400).json({ error: error.message });
    }
  };

  getPendingRapReports = async(req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) throw new Error("Unauthorized!");
      const result = await this.thesisService.getPendingRapReports(req.user.userId);
      res.status(200).json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  };

  signRapReport = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) throw new Error("Unauthorized!");
      const sigId = req.params.sigId as string;
      const { signatureData } = req.body;
      const result = await this.thesisService.signRapReport(sigId, req.user.userId, signatureData);
      res.status(200).json({ message: "Rap Report successfully signed", result });
    } catch (error: any) {
      // CP7-FIX1: preserve AppError status (400/403/404/409).
      sendEligibilityError(res, error);
    }
  };


  public updateRapporteurNotes = async (req: Request, res: Response): Promise<void> => {
    try {
      const data = await this.thesisService.updateRapporteurNotes(req.params.scheduleId as string, req.body.notes);
      res.status(200).json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  };

  /**
   * CP7: formal conclusion — session CHAIRMAN only.
   * Explicit outcome required. Never defaults to PASSED.
   */
  public concludeDefense = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: "Unauthorized." });
        return;
      }
      const result = await this.thesisService.concludeDefense(
        req.params.scheduleId as string,
        userId,
        {
          outcome: req.body?.outcome,
          selectedTitleId: req.body?.selectedTitleId ?? null,
          finalRemarks: req.body?.finalRemarks ?? null,
        },
      );
      res.status(200).json({
        message: "Formal defense result recorded.",
        conclusion: result.conclusion,
        rapReport: {
          id: result.rapReport.id,
          status: result.rapReport.status,
          generatedAt: result.rapReport.generatedAt,
        },
      });
    } catch (error: any) {
      sendEligibilityError(res, error);
    }
  };

  /** CP7 alias endpoint: POST /thesis/defense/:scheduleId/conclusion */
  public recordFormalConclusion = this.concludeDefense;

  /** CP7: Rapporteur finalize defense notes (irreversible). */
  public finalizeRapporteurNotes = async (
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: "Unauthorized." });
        return;
      }
      const result = await this.thesisService.finalizeDefenseNotes(
        req.params.scheduleId as string,
        userId,
      );
      res.status(200).json(result);
    } catch (error: any) {
      sendEligibilityError(res, error);
    }
  };

  /** CP7: official individual Criteria (ADMIN or owning evaluator; auth inside service). */
  public getOfficialCriteria = async (
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const accountRole = String(req.user?.role ?? "");
      if (!userId) {
        res.status(401).json({ error: "Unauthorized." });
        return;
      }
      const criteria = await this.thesisService.getOfficialCriteria(
        req.params.scheduleId as string,
        req.params.panelAssignmentId as string,
        { userId, role: accountRole },
      );
      res.status(200).json(criteria);
    } catch (error: any) {
      sendEligibilityError(res, error);
    }
  };

  /** CP7: Oral Examination Summary — ADMIN or session CHAIRMAN only (auth inside service). */
  public getOralExamSummary = async (
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const accountRole = String(req.user?.role ?? "");
      if (!userId) {
        res.status(401).json({ error: "Unauthorized." });
        return;
      }
      const summary = await this.thesisService.getOralExamSummaryRecord(
        req.params.scheduleId as string,
        { userId, role: accountRole },
      );
      res.status(200).json(summary);
    } catch (error: any) {
      sendEligibilityError(res, error);
    }
  };

  /** CP7: Student-owned finalized RAP access. */
  public getStudentDefenseRap = async (
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: "Unauthorized." });
        return;
      }
      const result = await this.thesisService.getStudentDefenseRap(
        req.params.scheduleId as string,
        userId,
      );
      res.status(200).json(result);
    } catch (error: any) {
      sendEligibilityError(res, error);
    }
  };

  /** CP7: Admin Defense Records list (read-only). */
  public getAdminDefenseRecords = async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    try {
      const result = await this.thesisService.getAdminDefenseRecords({
        page: Number(req.query.page ?? 1),
        pageSize: Number(req.query.pageSize ?? 10),
        search: (req.query.search as string) ?? undefined,
      });
      res.status(200).json(result);
    } catch (error: any) {
      sendEligibilityError(res, error);
    }
  };

  /** CP7: Admin Defense Record detail (read-only). */
  public getAdminDefenseRecordDetail = async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    try {
      const result = await this.thesisService.getAdminDefenseRecordDetail(
        req.params.scheduleId as string,
      );
      res.status(200).json(result);
    } catch (error: any) {
      sendEligibilityError(res, error);
    }
  };

  public getAllRapReports = async (req: Request, res: Response): Promise<void> => {
    try {
      const reports = await this.thesisService.getAllRapReports();
      res.status(200).json(reports);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  };

  public distributeRapReport = async (req: Request, res: Response): Promise<void> => {
    // CP7-FIX1: Manual RAP distribution is retired. Lifecycle is signature-driven only.
    res.status(409).json({
      error:
        "Manual RAP distribution is retired. Signature routing begins automatically after formal conclusion.",
    });
  };

  public remindRapReportPanelists = async (req: Request, res: Response): Promise<void> => {
    try {
      const rapId = req.params.rapId as string;
      const missingSignatures = await this.thesisService.getMissingSignaturesForRap(rapId);
      
      for (const sig of missingSignatures) {
        await import("../services/email.service").then(module => {
          module.EmailService.sendTemplateEmail(
            sig.user.email,
            "rap_distributed",
            {
              panelist_name: `${sig.user.firstName} ${sig.user.lastName}`,
              rap_link: `${process.env.FRONTEND_URL || "http://localhost:3000"}/panelist/rap-reports`
            }
          ).catch(err => console.error("Failed to queue email:", err));
        });
      }

      res.status(200).json({ success: true, remindedCount: missingSignatures.length });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  };
  // ── CP6 Defense Workspace ───────────────────────────────────────

  getDefenseWorkspace = async (
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const scheduleId = req.params.scheduleId as string;
      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      res
        .status(200)
        .json(await this.defenseWorkspace.getWorkspace(scheduleId, userId));
    } catch (error: any) {
      res.status(error?.statusCode || 400).json({ error: error.message });
    }
  };

  saveRapporteurWorkspaceNotes = async (
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const scheduleId = req.params.scheduleId as string;
      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const notes = String(req.body?.notes ?? "");
      res
        .status(200)
        .json(
          await this.defenseWorkspace.saveRapporteurNotes(
            scheduleId,
            userId,
            notes,
          ),
        );
    } catch (error: any) {
      res.status(error?.statusCode || 400).json({ error: error.message });
    }
  };

  public getLobbyStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const scheduleId = req.params.scheduleId as string;
      const userId = req.user?.userId;
      const role = req.user?.role;

      if (!userId || !role) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      // CP7-FIX1: legacy lobby delegates to role-safe workspace authorization.
      // Never returns Rapporteur draft notes to ordinary Panelists/unassigned users.
      const workspace = await this.defenseWorkspace.getWorkspace(
        scheduleId,
        userId,
      );
      res.status(200).json({
        studentName: workspace.student.name,
        defenseType: workspace.schedule.defenseType,
        proposedTitles: workspace.proposedTitles,
        // Draft/finalized notes only for Rapporteur (and Chairman after finalization).
        rapporteurNotes: workspace.rapporteurDraft?.notes ?? null,
        isConcluded: workspace.conclusionsPresent,
        panelStatuses: workspace.roster.map((r) => ({
          userId: r.userId,
          panelistName: r.name,
          role: r.role,
          status:
            r.evaluationStatus === "FINALIZED"
              ? "Ready"
              : r.evaluationStatus === "DRAFT"
                ? "Draft"
                : r.evaluationStatus === "NONE"
                  ? "Ready"
                  : "Scoring...",
        })),
        sessionStatus: workspace.sessionStatus,
      });
    } catch (error: any) {
      sendEligibilityError(res, error);
    }
  };

  // ── CP3 Proposal Adviser review / certification ──────────────────

  getProposalAdviserReviewState = async (
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const result = await this.proposalAdviserReview.getStudentReviewState(userId);
      res.status(200).json(result);
    } catch (error: any) {
      sendEligibilityError(res, error);
    }
  };

  submitProposalManuscriptForReview = async (
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const file = req.file;
      if (!file) {
        res.status(400).json({ error: "Proposal manuscript file is required." });
        return;
      }
      await this.proposalAdviserReview.submitManuscriptForReview(userId, file);
      // DL-2 FIX1: the authoritative transaction has committed — protect the
      // managed file before any fallible post-commit read.
      commitRequestUploads(req);
      res
        .status(200)
        .json(await this.proposalAdviserReview.getStudentReviewState(userId));
    } catch (error: any) {
      await cleanupRequestUploads(req);
      sendEligibilityError(res, error);
    }
  };

  listMyProposalAdviserReviews = async (
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const result = await this.proposalAdviserReview.listReviewTasks(userId);
      res.status(200).json(result);
    } catch (error: any) {
      sendEligibilityError(res, error);
    }
  };

  getProposalAdviserReviewTask = async (
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const thesisId = req.params.thesisId as string;
      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const result = await this.proposalAdviserReview.getReviewTask(userId, thesisId);
      res.status(200).json(result);
    } catch (error: any) {
      sendEligibilityError(res, error);
    }
  };

  requestProposalAdviserChanges = async (
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const thesisId = req.params.thesisId as string;
      const remarks = String(req.body?.remarks ?? "");
      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      // CP3-FIX4: client must identify the manuscript it acted on.
      const expectedReviewedDocumentId = req.body?.expectedReviewedDocumentId;
      if (!expectedReviewedDocumentId || typeof expectedReviewedDocumentId !== "string") {
        res.status(400).json({
          error: "Reviewed manuscript identifier is required.",
        });
        return;
      }
      const result = await this.proposalAdviserReview.requestChanges(
        userId,
        thesisId,
        {
          remarks,
          expectedReviewedDocumentId,
        },
      );
      res.status(200).json(result);
    } catch (error: any) {
      sendEligibilityError(res, error);
    }
  };

  certifyProposalAdviserReview = async (
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const thesisId = req.params.thesisId as string;
      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const expectedReviewedDocumentId = req.body?.expectedReviewedDocumentId;
      if (!expectedReviewedDocumentId || typeof expectedReviewedDocumentId !== "string") {
        res.status(400).json({
          error: "Reviewed manuscript identifier is required.",
        });
        return;
      }
      const result = await this.proposalAdviserReview.certify(userId, thesisId, {
        signatureData: String(req.body?.signatureData ?? ""),
        remarks: req.body?.remarks ?? null,
        // Client timestamps are ignored — server time is authoritative.
        clientIssuedAt: req.body?.issuedAt ?? null,
        // CP3-FIX4: required expected manuscript — no DB fallback.
        expectedReviewedDocumentId,
      });
      res.status(200).json(result);
    } catch (error: any) {
      sendEligibilityError(res, error);
    }
  };

  // ── CP4 Final Adviser review / certification ────────────────────

  getFinalAdviserReviewState = async (
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      res.status(200).json(await this.finalAdviserReview.getStudentReviewState(userId));
    } catch (error: any) {
      sendEligibilityError(res, error);
    }
  };

  submitFinalManuscriptForReview = async (
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const file = req.file;
      if (!file) {
        res.status(400).json({ error: "Final manuscript file is required." });
        return;
      }
      await this.finalAdviserReview.submitManuscriptForReview(userId, file);
      // DL-2 FIX1: protect the committed managed file before any post-commit read.
      commitRequestUploads(req);
      res
        .status(200)
        .json(await this.finalAdviserReview.getStudentReviewState(userId));
    } catch (error: any) {
      await cleanupRequestUploads(req);
      sendEligibilityError(res, error);
    }
  };

  listMyFinalAdviserReviews = async (
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      res.status(200).json(await this.finalAdviserReview.listReviewTasks(userId));
    } catch (error: any) {
      sendEligibilityError(res, error);
    }
  };

  getFinalAdviserReviewTask = async (
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const thesisId = req.params.thesisId as string;
      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      res.status(200).json(await this.finalAdviserReview.getReviewTask(userId, thesisId));
    } catch (error: any) {
      sendEligibilityError(res, error);
    }
  };

  requestFinalAdviserChanges = async (
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const thesisId = req.params.thesisId as string;
      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const expectedReviewedDocumentId = req.body?.expectedReviewedDocumentId;
      if (!expectedReviewedDocumentId || typeof expectedReviewedDocumentId !== "string") {
        res.status(400).json({ error: "Reviewed manuscript identifier is required." });
        return;
      }
      res.status(200).json(
        await this.finalAdviserReview.requestChanges(userId, thesisId, {
          remarks: String(req.body?.remarks ?? ""),
          expectedReviewedDocumentId,
        }),
      );
    } catch (error: any) {
      sendEligibilityError(res, error);
    }
  };

  certifyFinalAdviserReview = async (
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const thesisId = req.params.thesisId as string;
      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const expectedReviewedDocumentId = req.body?.expectedReviewedDocumentId;
      if (!expectedReviewedDocumentId || typeof expectedReviewedDocumentId !== "string") {
        res.status(400).json({ error: "Reviewed manuscript identifier is required." });
        return;
      }
      res.status(200).json(
        await this.finalAdviserReview.certify(userId, thesisId, {
          signatureData: String(req.body?.signatureData ?? ""),
          remarks: req.body?.remarks ?? null,
          expectedReviewedDocumentId,
        }),
      );
    } catch (error: any) {
      sendEligibilityError(res, error);
    }
  };
}
