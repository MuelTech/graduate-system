import type { Response } from "express";
import type { AuthenticatedRequest } from "../middlewares/auth.middleware";
import {
  ExamAmendmentRepository,
  type AmendmentAction,
} from "../repositories/exam-amendment.repository";
import { AppError } from "../utils/AppError";
import { EmailLifecycle } from "../services/email-lifecycle.helper";

const repository = new ExamAmendmentRepository();
export class ExamAmendmentController {
  private respond = async (
    res: Response,
    operation: () => Promise<unknown>,
  ) => {
    res.setHeader("Cache-Control", "private, no-store");
    try {
      res.status(200).json(await operation());
    } catch (error) {
      res
        .status(error instanceof AppError ? error.statusCode : 500)
        .json({
          error:
            error instanceof AppError
              ? error.message
              : "Could not complete the examination action. Reload and try again.",
        });
    }
  };
  action =
    (kind: AmendmentAction) => (req: AuthenticatedRequest, res: Response) =>
      this.respond(res, async () => {
        const result = await repository.amend(
          req.params.id as string,
          kind,
          req.body,
          req.user!.userId,
        );
        if (kind === "APPROVE_APPEAL" || kind === "ADMIN_RESCHEDULE") {
          const replacementId =
            (result as { replacementApplicationId?: string | null; replacement?: { id?: string } | null })
              ?.replacementApplicationId ??
            (result as { replacement?: { id?: string } | null })?.replacement?.id ??
            null;
          if (replacementId) {
            EmailLifecycle.sendExamScheduledByApplicationId(
              replacementId,
              req.user!.userId,
            );
          }
        }
        return result;
      });
  options = (req: AuthenticatedRequest, res: Response) =>
    this.respond(res, () =>
      repository.options(req.params.id as string, req.user!.userId),
    );
  reconsider = (req: AuthenticatedRequest, res: Response) =>
    this.respond(res, async () => {
      const result = await repository.reconsider(
        req.params.id as string,
        req.body,
        req.user!.userId,
      );
      EmailLifecycle.sendExamResultReconsideredByApplicationId(
        req.params.id as string,
        req.user!.userId,
      );
      return result;
    });
}
