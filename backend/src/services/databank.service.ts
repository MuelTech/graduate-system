import { DatabankRepository } from "../repositories/databank.repository";
import { OperationalAuthorization, operationalAuthorization, type OperationalActor } from "../access/operational-authorization";
import { AppError } from "../utils/AppError";

/**
 * DL-10: Databank no longer owns any Repository publication behavior. The only
 * remaining responsibility here is the legacy ADMIN archive list. Repository
 * publication lives in `RepositoryPublicationService`.
 */
export class DatabankService {
  private repository = new DatabankRepository();
  constructor(private readonly authorization: OperationalAuthorization = operationalAuthorization) {}

  async getAllEntries(actor: OperationalActor) {
    if (!actor?.userId) throw new AppError("Access denied.", 403);
    await this.authorization.assert(actor.userId, "repository.view");
    if (!this.authorization.enabled && actor.role !== "ADMIN") throw new AppError("Access denied.", 403);

    return this.repository.findAll();
  }
}
