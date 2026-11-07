import { examAdministrationAuthorization } from "../access/exam-administration-authorization";
import { ExamConfigurationRepository } from "../repositories/exam-configuration.repository";
import { examConfigurationDto, validateExamConfiguration } from "./exam-configuration.rules";

export class ExamConfigurationService {
  constructor(private readonly access = examAdministrationAuthorization) {}
  private repository = new ExamConfigurationRepository(this.access);

  async getCurrent(actorId: string) {
    await this.access.assert(actorId, "exam.configuration.manage");
    return examConfigurationDto(await this.repository.getCurrent());
  }

  async replaceCurrent(body: unknown, actorId: string) {
    await this.access.assert(actorId, "exam.configuration.manage");
    const values = validateExamConfiguration(body);
    return examConfigurationDto(await this.repository.replaceCurrent(values, actorId));
  }
}
