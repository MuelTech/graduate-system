import {
  EvaluationRepository,
  type EvaluationUploadInput,
} from '../repositories/evaluation.repository';
import { CreateEvaluationRequestInput, AssignExpertInput } from '../interfaces/evaluation.interfaces';
import { AppError } from '../utils/AppError';

export class EvaluationService {
  private evalRepo = new EvaluationRepository();

  /**
   * DL-2: the instrument file has already been byte-validated, checksummed,
   * and promoted to managed storage by the secure upload middleware. This
   * service owns domain authorization only (active Thesis Record required).
   */
  async submitEvaluationRequest(
    studentId: string,
    data: CreateEvaluationRequestInput,
    upload: EvaluationUploadInput,
  ) {
    const thesis = await this.evalRepo.getActiveThesisForStudent(studentId);
    if (!thesis) {
      throw new AppError(
        "You must have an active Thesis Record to upload research instruments.",
        400,
      );
    }

    return this.evalRepo.createRequest(
      thesis.id,
      data.instrumentType,
      data.instrumentDescription,
      upload,
    );
  }

  async assignExpert(requestId: string, data: AssignExpertInput) {
    return this.evalRepo.assignExpertToRequest(requestId, data.assignedById);
  }
}
