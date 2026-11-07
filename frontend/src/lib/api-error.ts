import type { MissingRequirement } from "@/types";

export class ApiError extends Error {
  constructor(message: string, public statusCode?: number, public missing?: MissingRequirement[]) {
    super(message);
    this.name = "ApiError";
  }
}
