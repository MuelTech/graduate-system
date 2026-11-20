export interface FacultyDefenseImpactItem {
  scheduleId: string;
  defenseType: string;
  sessionStatus: string;
  role: string;
  defenseDate: string;
  studentName: string;
}

export interface FacultyAdviseeImpactItem {
  assignmentId: string;
  studentId: string;
  studentName: string;
  studentNumber: string | null;
}

export interface FacultyPendingRequestImpactItem {
  requestId: string;
  studentName: string;
  requestDate: string;
}

export interface FacultyDeactivationImpact {
  panelistId: string;
  userId: string;
  canDeactivate: boolean;
  blockedReason: string | null;
  requiresHandoffConfirmation: boolean;
  blockingDefenses: FacultyDefenseImpactItem[];
  scheduledDefenses: FacultyDefenseImpactItem[];
  activeAdvisees: FacultyAdviseeImpactItem[];
  pendingAdviserRequests: FacultyPendingRequestImpactItem[];
}

export interface FacultyDeactivationImpactInput {
  panelistId: string;
  userId: string;
  panelAssignments: Array<{
    role: string;
    schedule: {
      id: string;
      defenseType: string;
      sessionStatus: string;
      defenseDate: Date | string;
      thesis?: {
        student?: {
          user?: { firstName?: string | null; lastName?: string | null } | null;
        } | null;
      } | null;
    };
  }>;
  adviserAssignments: Array<{
    id: string;
    studentId: string;
    student?: {
      studentNumber?: string | null;
      user?: { firstName?: string | null; lastName?: string | null } | null;
    } | null;
  }>;
  pendingAdviserRequests: Array<{
    id: string;
    requestDate: Date | string;
    student?: {
      user?: { firstName?: string | null; lastName?: string | null } | null;
    } | null;
  }>;
}

const BLOCKING_DEFENSE_STATUSES = new Set([
  "IN_PROGRESS",
  "AWAITING_CONCLUSION",
]);

function formatPersonName(
  user?: { firstName?: string | null; lastName?: string | null } | null,
): string {
  const full = `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim();
  return full || "Unnamed Student";
}

function toIsoDate(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

export function evaluateFacultyDeactivationImpact(
  input: FacultyDeactivationImpactInput,
): FacultyDeactivationImpact {
  const blockingDefenses: FacultyDefenseImpactItem[] = [];
  const scheduledDefenses: FacultyDefenseImpactItem[] = [];

  for (const assignment of input.panelAssignments) {
    const status = String(assignment.schedule.sessionStatus);
    const item: FacultyDefenseImpactItem = {
      scheduleId: assignment.schedule.id,
      defenseType: String(assignment.schedule.defenseType),
      sessionStatus: status,
      role: String(assignment.role),
      defenseDate: toIsoDate(assignment.schedule.defenseDate),
      studentName: formatPersonName(assignment.schedule.thesis?.student?.user),
    };

    if (BLOCKING_DEFENSE_STATUSES.has(status)) {
      blockingDefenses.push(item);
    } else if (status === "SCHEDULED") {
      scheduledDefenses.push(item);
    }
  }

  const activeAdvisees: FacultyAdviseeImpactItem[] = input.adviserAssignments.map(
    (assignment) => ({
      assignmentId: assignment.id,
      studentId: assignment.studentId,
      studentName: formatPersonName(assignment.student?.user),
      studentNumber: assignment.student?.studentNumber ?? null,
    }),
  );

  const pendingAdviserRequests: FacultyPendingRequestImpactItem[] =
    input.pendingAdviserRequests.map((request) => ({
      requestId: request.id,
      studentName: formatPersonName(request.student?.user),
      requestDate: toIsoDate(request.requestDate),
    }));

  const canDeactivate = blockingDefenses.length === 0;
  const blockedReason = canDeactivate
    ? null
    : "This faculty member is assigned to an active defense session. Conclude the defense before deactivating this account.";

  const requiresHandoffConfirmation =
    canDeactivate &&
    (scheduledDefenses.length > 0 ||
      activeAdvisees.length > 0 ||
      pendingAdviserRequests.length > 0);

  return {
    panelistId: input.panelistId,
    userId: input.userId,
    canDeactivate,
    blockedReason,
    requiresHandoffConfirmation,
    blockingDefenses,
    scheduledDefenses,
    activeAdvisees,
    pendingAdviserRequests,
  };
}
