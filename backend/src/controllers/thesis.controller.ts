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
      const result = await this.thesisService.scheduleDefense(id, req.user.userId, req.body);
      res.status(201).json({ message: 'Defense scheduled and panelists notified', result });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  };
}
