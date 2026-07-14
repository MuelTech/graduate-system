import { Request, Response } from 'express';
import { EvaluationService } from '../services/evaluation.service';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';

export class EvaluationController {
  private evalService = new EvaluationService();

  // For Student Role
  submitRequest = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) throw new Error('Unauthorized!');
      
      if (!req.file) throw new Error('Instrument file is required');

      // Grab the path of the file Multer just saved
      const filePath = req.file.path; 

      //  Pass it to the service
      const result = await this.evalService.submitEvaluationRequest(
        req.user.userId, 
        req.body, 
        filePath
      );
      
      res.status(201).json({ message: 'Instrument submitted for evaluation successfully', result });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  };

  // For Admin Role
  assignExpert = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) throw new Error('Unauthorized');
      
      const  id  = req.params.id as string; // requestId
      const data = { assignedById: req.user.userId }; 
      
      const result = await this.evalService.assignExpert(id, data);
      res.status(200).json({ message: 'Expert assigned successfully', result });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  };
}
