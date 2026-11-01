import { AppError } from "../utils/AppError";

export function selectionIds(payload: unknown): string[] {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)
    || Object.keys(payload).some(key => key !== "questionIds")
    || !Array.isArray((payload as { questionIds?: unknown }).questionIds)) {
    throw new AppError("Provide questionIds as an array.", 400);
  }
  const ids = (payload as { questionIds: unknown[] }).questionIds.map(value => {
    if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
      throw new AppError("Select valid question identities.", 400);
    }
    return value.toLowerCase();
  });
  if (new Set(ids).size !== ids.length) throw new AppError("Duplicate questions are not allowed.", 400);
  return ids;
}
