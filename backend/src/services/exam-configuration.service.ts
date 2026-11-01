import { ExamConfigurationRepository } from "../repositories/exam-configuration.repository";
import { examConfigurationDto, validateExamConfiguration } from "./exam-configuration.rules";

export class ExamConfigurationService {
  private repository = new ExamConfigurationRepository();

  async getCurrent() {
    return examConfigurationDto(await this.repository.getCurrent());
  }

  async replaceCurrent(body: unknown, actorId: string) {
    const values = validateExamConfiguration(body);
    return examConfigurationDto(await this.repository.replaceCurrent(values, actorId));
  }
}
