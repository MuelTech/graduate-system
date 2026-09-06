import { Request, Response } from 'express';
import { ThesisService } from '../services/thesis.service';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';

export class ThesisController {
  private thesisService = new ThesisService();

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
      res.status(400).json({ error: error.message });
    }
  };

  applyProposal = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) throw new Error('Unauthorized');
      
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      const document = files?.['document']?.[0];
      const cor = files?.['cor']?.[0];

      if (!document) throw new Error('Chapters 1-3 document is required');
      if (!cor) throw new Error('COR is required');

      const result = await this.thesisService.applyProposalDefense(req.user.userId, document.path, cor.path);
      res.status(200).json({ message: 'Proposal Defense application submitted successfully', result });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  };

  applyFinal = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) throw new Error('Unauthorized');
      
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      const document = files?.['document']?.[0];
      const cor = files?.['cor']?.[0];

      if (!document) throw new Error('Final Manuscript document is required');
      if (!cor) throw new Error('COR is required');

      const result = await this.thesisService.applyFinalDefense(req.user.userId, document.path, cor.path);
      res.status(200).json({ message: 'Final Defense application submitted successfully', result });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  };

  requestAdviser = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) throw new Error('Unauthorized');
      const result = await this.thesisService.requestAdviser(req.user.userId, req.body);
      res.status(201).json({ message: 'Adviser request submitted', result });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  };

  assignAdviser = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) throw new Error('Unauthorized');
      const result = await this.thesisService.assignAdviser(req.user.userId, req.body);
      res.status(200).json({ message: 'Adviser officially assigned', result });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  };

  updateStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string; // thesisId
      const result = await this.thesisService.updateDefenseStatus(id, req.body);
      res.status(200).json({ message: 'Thesis status updated', result });
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
      res.status(400).json({ error: error.message });
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


  public updateSecretariatNotes = async (req: Request, res: Response): Promise<void> => {
    try {
      const data = await this.thesisService.updateSecretariatNotes(req.params.scheduleId as string, req.body.notes);
      res.status(200).json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  };

  public concludeDefense = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.userId; // Adjust based on your auth middleware
      const rapReport = await this.thesisService.concludeDefense(req.params.scheduleId as string, userId);
      res.status(200).json({ message: "Defense concluded.", rapReport });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
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
