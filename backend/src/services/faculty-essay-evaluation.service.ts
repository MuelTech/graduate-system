import { facultyEssayAuthorization } from "../access/faculty-essay-authorization";
import { FacultyEssayEvaluationRepository } from "../repositories/faculty-essay-evaluation.repository";
import { essayEvaluationBody } from "./exam-essay-evaluation.rules";

export class FacultyEssayEvaluationService {
  constructor(private readonly repository = new FacultyEssayEvaluationRepository(), private readonly authorization = facultyEssayAuthorization) {}
  async queue(actorId: string, cursor?: unknown) {
    await this.authorization.assert(actorId);
    return this.repository.queue(actorId, cursor);
  }
  async detail(id: string, actorId: string) {
    await this.authorization.assert(actorId);
    return this.repository.detail(id, actorId);
  }
  async grade(id: string, body: unknown, actorId: string) {
    await this.authorization.assert(actorId);
    return this.repository.grade(id, essayEvaluationBody(body), actorId);
  }
}
