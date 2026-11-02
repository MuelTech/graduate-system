import { AppError } from "../utils/AppError";
import { parseScheduleDate, parseScheduleTime } from "./exam-schedule-time";

// Transitional existing blocking behavior; this is not an examination-period policy.
export const BLOCKING_EXAM_STATUSES = ["PENDING", "APPROVED", "TAKEN", "PASSED", "APPEALED", "DISQUALIFIED"] as const;

export function scheduleIdentifier(value: unknown, name: string): string {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    throw new AppError(`${name} must be an opaque UUID.`, 400);
  }
  return value.toLowerCase();
}

function body(value: unknown, fields: string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      Object.keys(value).some(key => !fields.includes(key))) {
    throw new AppError("Schedule payload contains malformed or unsupported fields.", 400);
  }
  return value as Record<string, unknown>;
}

export function validateSlotBody(value: unknown) {
  const data = body(value, ["programId", "examDate", "examTime", "maxSlots"]);
  if (typeof data.maxSlots !== "number" || !Number.isInteger(data.maxSlots) || data.maxSlots <= 0 || data.maxSlots > 2_147_483_647) {
    throw new AppError("maxSlots must be a positive database integer.", 400);
  }
  return {
    programId: scheduleIdentifier(data.programId, "programId"),
    examDate: parseScheduleDate(data.examDate), examTime: parseScheduleTime(data.examTime),
    maxSlots: data.maxSlots,
  };
}

export function validateBookingBody(value: unknown): string {
  return scheduleIdentifier(body(value, ["slotId"]).slotId, "slotId");
}

export function validateBookingStatusBody(value: unknown): boolean {
  const data = body(value, ["isActive"]);
  if (typeof data.isActive !== "boolean") throw new AppError("isActive must be a boolean.", 400);
  return data.isActive;
}

export function requireEligibleAlignment(status: unknown): void {
  if (status !== "ALIGNED" && status !== "CLEARED") {
    throw new AppError("Cannot schedule exam. Alignment must be ALIGNED or CLEARED.", 403);
  }
}

export function requireConsistentCounter(slot: { slotsTaken: number }, actualCount: number): void {
  if (!Number.isInteger(slot.slotsTaken) || slot.slotsTaken < 0 || slot.slotsTaken !== actualCount) {
    throw new AppError("Schedule booking counter disagrees with assigned applications; owner reconciliation is required.", 409);
  }
}

export function requireConsistentCapacity(slot: { slotsTaken: number; maxSlots: number }, actualCount: number): void {
  requireConsistentCounter(slot, actualCount);
  if (!Number.isInteger(slot.maxSlots) || slot.maxSlots <= 0 || slot.slotsTaken > slot.maxSlots) {
    throw new AppError("Schedule capacity is invalid; owner review is required.", 409);
  }
}
