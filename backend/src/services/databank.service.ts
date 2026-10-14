import { DatabankRepository } from "../repositories/databank.repository";

/**
 * DL-10: Databank no longer owns any Repository publication behavior. The only
 * remaining responsibility here is the legacy ADMIN archive list. Repository
 * publication lives in `RepositoryPublicationService`.
 */
export class DatabankService {
  private repository = new DatabankRepository();

  async getAllEntries(userRole: string) {
    if (userRole !== "ADMIN") {
      throw new Error(
        "Unauthorized: Only admin can view the complete databank queue.",
      );
    }

    return this.repository.findAll();
  }
}
