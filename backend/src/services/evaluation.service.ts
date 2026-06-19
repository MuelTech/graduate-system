import { EvaluationRepository } from '../repositories/evaluation.repository';
import { CreateEvaluationRequestInput, AssignExpertInput } from '../interfaces/evaluation.interfaces';

export class EvaluationService {
  private evalRepo = new EvaluationRepository();

  // UPDATED: Added filePath argument
  async submitEvaluationRequest(studentId: string, data: CreateEvaluationRequestInput, filePath: string) {
    const thesis = await this.evalRepo.getActiveThesisForStudent(studentId);
    if (!thesis) {
      throw new Error("You must have an active Thesis Record to upload research instruments.");
    }

    return this.evalRepo.createRequest(
      thesis.id, 
      data.instrumentType, 
      data.instrumentDescription,
      filePath
    );
  }

  async assignExpert(requestId: string, data: AssignExpertInput) {
    return this.evalRepo.assignExpertToRequest(requestId, data.assignedById);
  }
}
