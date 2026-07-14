import { Request, Response } from 'express';
import { StudentService } from '../services/student.service';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';

export class StudentController {
  private studentService = new StudentService();

  // For Student Role
  getJourney = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) throw new Error('Unauthorized');
      
      const journey = await this.studentService.getStudentJourney(req.user.userId);
      res.status(200).json(journey);
    } catch (error: any) {
      res.status(404).json({ error: error.message });
    }
  };

  // For Admin Role
  updateCompExam = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string; // studentId
      const result = await this.studentService.updateCompExam(id, req.body);
      res.status(200).json({ message: 'Comprehensive Exam updated successfully', result });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  };
}
