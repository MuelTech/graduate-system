import type { Response } from "express";
import type { AuthenticatedRequest } from "../middlewares/auth.middleware";
import {
  ExamAmendmentRepository,
  type AmendmentAction,
} from "../repositories/exam-amendment.repository";
import { AppError } from "../utils/AppError";

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
      this.respond(res, () =>
        repository.amend(
          req.params.id as string,
          kind,
          req.body,
          req.user!.userId,
        ),
      );
  options = (req: AuthenticatedRequest, res: Response) =>
    this.respond(res, () =>
      repository.options(req.params.id as string, req.user!.userId),
    );
  reconsider = (req: AuthenticatedRequest, res: Response) =>
    this.respond(res, () =>
      repository.reconsider(
        req.params.id as string,
        req.body,
        req.user!.userId,
      ),
    );
}
