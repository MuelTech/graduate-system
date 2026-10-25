import type { NotificationType } from "@prisma/client";
import type { DefenseScheduleAuditSnapshot } from "./defense-audit";

export interface DefenseCorrectionNotification {
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  relatedRecordType: string;
  relatedRecordId: string;
}

function stageLabel(defenseType: string): string {
  if (defenseType === "PROPOSAL_DEFENSE") return "Proposal Defense";
  if (defenseType === "FINAL_DEFENSE") return "Final Defense";
  return "Title Defense";
}

function roleLabel(role: string): string {
  if (role === "CHAIRMAN") return "Chairman";
  if (role === "PANELIST") return "Panelist";
  if (role === "ADVISER") return "Adviser";
  if (role === "RAPPORTEUR") return "Rapporteur";
  if (role === "FACILITATOR") return "Facilitator";
  return role;
}

function wallDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "the scheduled date";
  return date.toLocaleDateString("en-PH", {
    timeZone: "UTC",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function wallTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "the scheduled time";
  return date.toLocaleTimeString("en-PH", {
    timeZone: "UTC",
    hour: "numeric",
    minute: "2-digit",
  });
}

function scheduleChanged(
  before: DefenseScheduleAuditSnapshot,
  after: DefenseScheduleAuditSnapshot,
): boolean {
  return (
    before.schedule.defenseDate !== after.schedule.defenseDate ||
    before.schedule.defenseTime !== after.schedule.defenseTime ||
    (before.schedule.venueOrLink ?? "") !==
      (after.schedule.venueOrLink ?? "")
  );
}

/**
 * Bounded DEF-CORR-1 notification projection. One notice per affected user,
 * derived only from the authoritative before/after snapshots.
 */
export function buildDefenseCorrectionNotifications(input: {
  studentUserId: string;
  before: DefenseScheduleAuditSnapshot;
  after: DefenseScheduleAuditSnapshot;
}): DefenseCorrectionNotification[] {
  const { studentUserId, before, after } = input;
  const stage = stageLabel(after.defenseType);
  const date = wallDate(after.schedule.defenseDate);
  const time = wallTime(after.schedule.defenseTime);
  const venue = after.schedule.venueOrLink
    ? ` at ${after.schedule.venueOrLink}`
    : "";
  const place = `${date} at ${time}${venue}`;

  const beforeByUser = new Map(
    before.committee.map((member) => [member.userId, member]),
  );
  const afterByUser = new Map(
    after.committee.map((member) => [member.userId, member]),
  );
  const added = after.committee.filter(
    (member) => !beforeByUser.has(member.userId),
  );
  const removed = before.committee.filter(
    (member) => !afterByUser.has(member.userId),
  );
  const roleChanged = after.committee.filter((member) => {
    const previous = beforeByUser.get(member.userId);
    return previous && previous.role !== member.role;
  });
  const scheduleDidChange = scheduleChanged(before, after);

  const notices = new Map<string, DefenseCorrectionNotification>();
  const add = (notice: DefenseCorrectionNotification) => {
    if (!notices.has(notice.userId)) notices.set(notice.userId, notice);
  };
  const related = {
    relatedRecordType: "DEFENSE_SCHEDULE",
    relatedRecordId: after.scheduleId,
  };

  for (const member of removed) {
    add({
      userId: member.userId,
      title: "Defense assignment removed",
      message: `Your ${roleLabel(member.role)} assignment for the ${stage} is no longer active.`,
      type: "DEFENSE_ASSIGNMENT" as NotificationType,
      ...related,
    });
  }

  for (const member of [...added, ...roleChanged]) {
    add({
      userId: member.userId,
      title: "Defense committee assignment",
      message: `You are assigned as ${roleLabel(member.role)} for the ${stage} on ${place}.`,
      type: "DEFENSE_ASSIGNMENT" as NotificationType,
      ...related,
    });
  }

  if (scheduleDidChange) {
    add({
      userId: studentUserId,
      title: "Defense schedule updated",
      message: `Your ${stage} has been updated to ${place}.`,
      type: "DEFENSE_SCHEDULE" as NotificationType,
      ...related,
    });

    const roleChangedUsers = new Set(roleChanged.map((member) => member.userId));
    const addedUsers = new Set(added.map((member) => member.userId));
    for (const member of after.committee) {
      if (addedUsers.has(member.userId) || roleChangedUsers.has(member.userId)) {
        continue;
      }
      add({
        userId: member.userId,
        title: "Defense schedule updated",
        message: `The ${stage} schedule is now ${place}.`,
        type: "DEFENSE_SCHEDULE" as NotificationType,
        ...related,
      });
    }
  }

  return [...notices.values()].sort((a, b) => a.userId.localeCompare(b.userId));
}
