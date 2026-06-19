import { Request, Response } from 'express';
import { ThesisService } from '../services/thesis.service';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';

export class ThesisController {
  private thesisService = new ThesisService();

  applyTitle = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) throw new Error('Unauthorized');
      if (!req.file) throw new Error('Title concept document is required');

      const result = await this.thesisService.applyTitleDefense(req.user.userId, req.body, req.file.path);
      res.status(201).json({ message: 'Title Defense application submitted successfully', result });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  };

  applyProposal = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) throw new Error('Unauthorized');
      if (!req.file) throw new Error('Chapters 1-3 document is required');

      const result = await this.thesisService.applyProposalDefense(req.user.userId, req.file.path);
      res.status(200).json({ message: 'Proposal Defense application submitted successfully', result });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  };

  applyFinal = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) throw new Error('Unauthorized');
      if (!req.file) throw new Error('Final Manuscript document is required');

      const result = await this.thesisService.applyFinalDefense(req.user.userId, req.file.path);
      res.status(200).json({ message: 'Final Defense application submitted successfully', result });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  };
}
