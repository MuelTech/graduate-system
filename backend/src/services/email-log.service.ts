import { OperationalAuthorization, operationalAuthorization } from "../access/operational-authorization";
import { EmailRepository } from "../repositories/email.repository";

/** Log reads are separate from template configuration and delivery infrastructure. */
export class EmailLogService {
  constructor(private readonly authorization: OperationalAuthorization = operationalAuthorization,
    private readonly repository = new EmailRepository()) {}

  async getLogs(actorId: string, page: number, limit: number) {
    await this.authorization.assert(actorId, "email.logs.view");
    return this.repository.getPaginatedLogs(page, limit);
  }
}
