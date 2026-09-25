import { Request, Response } from 'express';
import { ThesisService } from '../services/thesis.service';
import { StudentThesisJourneyService } from '../services/student-thesis-journey.service';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import type { MissingRequirement } from '../interfaces/defense-eligibility.interfaces';
import { AppError } from '../utils/AppError';

function sendEligibilityError(res: Response, error: any): void {
  const missing = (error as { missing?: MissingRequirement[] }).missing;
  const status = error?.statusCode || 400;
  if (missing) {
    res.status(status).json({ error: error.message, missing });
    return;
  }
  res.status(status).json({ error: error.message });
}

export class ThesisController {
  private thesisService = new ThesisService();
  private journeyService = new StudentThesisJourneyService();

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
      res.status(201).json({ message: 'Title Defense application submitted successfully', result });
    } catch (error: any) {
      console.error("APPLY TITLE ERROR:", error);
      sendEligibilityError(res, error);
    }
  };

  applyProposal = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) throw new Error('Unauthorized');
      
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      const document = files?.['document']?.[0];
      const cor = files?.['cor']?.[0];
      const receipt = files?.['receipt']?.[0];

      if (!document) throw new Error('Chapters 1-3 document is required');
      if (!cor) throw new Error('COR is required');
      if (!receipt) throw new Error('Defense-fee proof of payment is required');

      const result = await this.thesisService.applyProposalDefense(
        req.user.userId,
        document.path,
        cor.path,
        receipt.path,
      );
      res.status(200).json({ message: 'Proposal Defense application submitted successfully', result });
    } catch (error: any) {
      sendEligibilityError(res, error);
    }
  };

  applyFinal = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) throw new Error('Unauthorized');
      
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      const document = files?.['document']?.[0];
      const cor = files?.['cor']?.[0];
      const receipt = files?.['receipt']?.[0];

      if (!document) throw new Error('Final Manuscript document is required');
      if (!cor) throw new Error('COR is required');
      if (!receipt) throw new Error('Defense-fee proof of payment is required');

      const result = await this.thesisService.applyFinalDefense(
        req.user.userId,
        document.path,
        cor.path,
        receipt.path,
      );
      res.status(200).json({ message: 'Final Defense application submitted successfully', result });
    } catch (error: any) {
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
      const scheduleId  = req.params.scheduleId as string;
      const { panelId, scores } = req.body;
      const result = await this.thesisService.submitOralExamScore(panelId, scheduleId, scores);
      res.status(201).json({ message: "Score submitted!", result });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

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
      res.status(400).json({ error: error.message });
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

  public concludeDefense = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.userId;
      const actorRole = String((req as any).user?.role ?? "");
      const rapReport = await this.thesisService.concludeDefense(
        req.params.scheduleId as string,
        userId,
        actorRole,
        {
          outcome: req.body?.outcome,
          selectedTitleId: req.body?.selectedTitleId ?? null,
        },
      );
      res.status(200).json({ message: "Defense concluded.", rapReport });
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
    try {
      const rapId = req.params.rapId as string;
      const rap = await this.thesisService.distributeRapReport(rapId);
      
      // Email each panelist asynchronously via BullMQ
      for (const sig of rap.signatures) {
        if (!sig.isSigned) {
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
      }
      
      res.status(200).json({ success: true, rapReport: rap });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
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
  public getLobbyStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const scheduleId = req.params.scheduleId as string;
      const userId = req.user?.userId;
      const role = req.user?.role;

      if (!userId || !role) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      // Fetch the lobby status first to check panel assignments
      const lobbyData = await this.thesisService.getLobbyStatus(scheduleId);

      // 1. Must be a panelist account
      if (role !== "PANELIST") {
        res.status(403).json({ error: "Forbidden: The lobby is restricted to Panelists only." });
        return;
      }

      // 2. Must be officially assigned to this specific defense
      const isAssigned = lobbyData.panelStatuses.some(
        (panel: any) => panel.userId === userId
      );
      if (!isAssigned) {
        res.status(403).json({ error: "Forbidden: You are not assigned to this defense panel." });
        return;
      }

      res.status(200).json(lobbyData);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  };
}
