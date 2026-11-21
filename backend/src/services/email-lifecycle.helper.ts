import prisma from "../config/database";
import { EmailService } from "./email.service";
import { buildPortalUrl } from "./email-layout";

function formatFullName(firstName?: string | null, lastName?: string | null): string {
  const joined = `${firstName ?? ""} ${lastName ?? ""}`.trim();
  return joined || "User";
}

function formatUtcDate(date: Date | string | null | undefined): string {
  if (!date) return "To be announced";
  const parsed = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(parsed.getTime())) return "To be announced";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(parsed);
}

function formatUtcTime(time: Date | string | null | undefined): string {
  if (!time) return "To be announced";
  const parsed = time instanceof Date ? time : new Date(time);
  if (Number.isNaN(parsed.getTime())) return "To be announced";
  const hours = parsed.getUTCHours();
  const minutes = parsed.getUTCMinutes();
  const suffix = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 || 12;
  return `${hour12}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

function toTitleCaseWords(raw: string): string {
  return raw
    .trim()
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

export function formatDefenseStageLabel(stage: string | null | undefined): string {
  const normalized = String(stage ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s_]+DEFENSE$/i, "");
  if (normalized === "TITLE") return "Title";
  if (normalized === "PROPOSAL") return "Proposal";
  if (normalized === "FINAL") return "Final";
  return normalized ? toTitleCaseWords(normalized) : "Thesis";
}

export function formatPanelRoleLabel(role: string | null | undefined): string {
  const upper = String(role ?? "").trim().toUpperCase();
  const map: Record<string, string> = {
    CHAIRMAN: "Chairman",
    PANELIST: "Panelist",
    ADVISER: "Adviser",
    RAPPORTEUR: "Rapporteur",
    FACILITATOR: "Facilitator",
  };
  return map[upper] ?? (upper ? toTitleCaseWords(upper) : "Committee Member");
}

export function formatDefenseOutcomeLabel(outcome: string | null | undefined): string {
  const upper = String(outcome ?? "").trim().toUpperCase();
  const map: Record<string, string> = {
    PASSED: "Passed",
    PASSED_WITH_MINOR_REVISIONS: "Passed with Minor Revisions",
    PASSED_WITH_MAJOR_REVISIONS: "Passed with Major Revisions",
    REVISION_REQUIRED: "Revision Required",
    REDEFENSE_REQUIRED: "Re-Defense Required",
    REDEFENSE: "Re-Defense Required",
    FAILED: "Failed",
    APPROVED: "Approved",
  };
  return map[upper] ?? (upper ? toTitleCaseWords(upper) : "Recorded");
}

export function formatCompExamResultLabel(result: "PASSED" | "FAILED" | string): string {
  const upper = String(result ?? "").trim().toUpperCase();
  if (upper === "PASSED") return "Passed";
  if (upper === "FAILED") return "Did Not Pass";
  return upper ? toTitleCaseWords(upper) : "Recorded";
}

function studentStagePortalPath(stage: string | null | undefined): string {
  const normalized = String(stage ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s_]+DEFENSE$/i, "");
  if (normalized === "TITLE") return "/student/thesis/title-defense";
  if (normalized === "PROPOSAL") return "/student/thesis/proposal-defense";
  if (normalized === "FINAL") return "/student/thesis/final-defense";
  return "/student/journey";
}

function safeFire(label: string, task: Promise<unknown>) {
  void task.catch((error: unknown) => {
    console.error(
      `[EmailLifecycle] ${label} failed:`,
      error instanceof Error ? error.message : error,
    );
  });
}

/**
 * Best-effort post-commit transactional email dispatchers across all 4 GS-IS cycles.
 * Never throws into callers so email delivery issues can never roll back domain mutations.
 */
export const EmailLifecycle = {
  // ── Cycle 1: Accounts & Security ──────────────────────────────────────────
  sendApplicantRegistered(params: {
    email: string;
    firstName: string;
    lastName: string;
    applicantId: string;
    programName: string;
  }) {
    const name = formatFullName(params.firstName, params.lastName);
    safeFire(
      "applicant_registered",
      EmailService.sendTemplateEmail(
        params.email,
        "applicant_registered",
        {
          recipient_name: name,
          applicant_id: params.applicantId,
          program_name: params.programName,
          portal_link: buildPortalUrl("/login"),
        },
        { recipientName: name },
      ),
    );
  },

  sendFacultyAccountCreated(params: {
    email: string;
    firstName: string;
    lastName: string;
    triggeredById?: string;
  }) {
    const name = formatFullName(params.firstName, params.lastName);
    safeFire(
      "faculty_account_created",
      EmailService.sendTemplateEmail(
        params.email,
        "faculty_account_created",
        {
          recipient_name: name,
          login_email: params.email,
          portal_link: buildPortalUrl("/login"),
        },
        { recipientName: name, triggeredById: params.triggeredById },
      ),
    );
  },

  sendAdminAccountCreated(params: {
    email: string;
    firstName: string;
    lastName: string;
    accessLevel?: string | null;
    triggeredById?: string;
  }) {
    const name = formatFullName(params.firstName, params.lastName);
    const accessLabel =
      params.accessLevel === "RESTRICTED"
        ? "Restricted Administrator"
        : "Full Administrator";
    safeFire(
      "admin_account_created",
      EmailService.sendTemplateEmail(
        params.email,
        "admin_account_created",
        {
          recipient_name: name,
          login_email: params.email,
          access_level: accessLabel,
          portal_link: buildPortalUrl("/login"),
        },
        { recipientName: name, triggeredById: params.triggeredById },
      ),
    );
  },

  async sendAccountPasswordReset(params: {
    email: string;
    firstName: string;
    lastName: string;
    loginIdentifier: string;
    triggeredById?: string;
  }): Promise<boolean> {
    const name = formatFullName(params.firstName, params.lastName);
    try {
      const res = await EmailService.sendTemplateEmail(
        params.email,
        "account_password_reset",
        {
          recipient_name: name,
          login_identifier: params.loginIdentifier,
          portal_link: buildPortalUrl("/login"),
        },
        { recipientName: name, triggeredById: params.triggeredById },
      );
      return Boolean(res.queued && !res.skipped);
    } catch (error: unknown) {
      console.error(
        "[EmailLifecycle] account_password_reset failed:",
        error instanceof Error ? error.message : error,
      );
      return false;
    }
  },

  sendAccountStatusChanged(params: {
    email: string;
    firstName: string;
    lastName: string;
    isActive: boolean;
    triggeredById?: string;
  }) {
    const name = formatFullName(params.firstName, params.lastName);
    const statusLabel = params.isActive ? "Reactivated" : "Deactivated";
    const statusMessage = params.isActive
      ? "Your portal access has been restored and you may sign in normally."
      : "Your portal account has been deactivated and active sessions have been signed out. Please contact the Office of the Graduate School if you need assistance.";
    safeFire(
      "account_status_changed",
      EmailService.sendTemplateEmail(
        params.email,
        "account_status_changed",
        {
          recipient_name: name,
          status_label: statusLabel,
          status_message: statusMessage,
          portal_link: buildPortalUrl("/login"),
        },
        { recipientName: name, triggeredById: params.triggeredById },
      ),
    );
  },

  // ── Cycle 2: Entrance Exam & COR Onboarding ───────────────────────────────
  sendExamScheduledByApplicationId(applicationId: string, triggeredById?: string) {
    safeFire(
      "exam_scheduled",
      (async () => {
        const app = await prisma.entranceExamApplication.findUnique({
          where: { id: applicationId },
          include: {
            program: { select: { programName: true } },
            student: {
              include: {
                user: { select: { email: true, firstName: true, lastName: true } },
              },
            },
          },
        });
        const email = app?.student?.user?.email?.trim();
        if (!app || !email) return;
        const name = formatFullName(app.student.user.firstName, app.student.user.lastName);
        await EmailService.sendTemplateEmail(
          email,
          "exam_scheduled",
          {
            recipient_name: name,
            program_name: app.program?.programName ?? "Graduate Program",
            exam_date: formatUtcDate(app.examDate),
            exam_time: formatUtcTime(app.examTime),
            portal_link: buildPortalUrl("/applicant/schedule"),
          },
          {
            recipientName: name,
            idempotencyKey: `exam-scheduled-${app.id}`,
            triggeredById,
          },
        );
      })(),
    );
  },

  sendExamResultReconsideredByApplicationId(applicationId: string, triggeredById?: string) {
    safeFire(
      "ecat_result_reconsidered",
      (async () => {
        const app = await prisma.entranceExamApplication.findUnique({
          where: { id: applicationId },
          include: {
            student: {
              include: {
                user: { select: { email: true, firstName: true, lastName: true } },
              },
            },
          },
        });
        const email = app?.student?.user?.email?.trim();
        if (!app || !email) return;
        const name = formatFullName(app.student.user.firstName, app.student.user.lastName);
        await EmailService.sendTemplateEmail(
          email,
          "ecat_result_reconsidered",
          {
            recipient_name: name,
            portal_link: buildPortalUrl("/applicant/cor-upload"),
          },
          {
            recipientName: name,
            idempotencyKey: `exam-reconsidered-${app.id}`,
            triggeredById,
          },
        );
      })(),
    );
  },

  sendCorRejected(params: {
    email: string;
    firstName: string;
    lastName: string;
    remarks: string;
    triggeredById?: string;
  }) {
    const name = formatFullName(params.firstName, params.lastName);
    safeFire(
      "cor_rejected",
      EmailService.sendTemplateEmail(
        params.email,
        "cor_rejected",
        {
          recipient_name: name,
          remarks: params.remarks,
          portal_link: buildPortalUrl("/applicant/cor-upload"),
        },
        { recipientName: name, triggeredById: params.triggeredById },
      ),
    );
  },

  // ── Cycle 3: Academic & Written Comprehensive Exam ────────────────────────
  sendCompExamRecorded(params: {
    email: string;
    firstName: string;
    lastName: string;
    attemptNumber: number;
    result: "PASSED" | "FAILED";
    isDismissed: boolean;
    attemptsRemaining: number;
    triggeredById?: string;
  }) {
    const name = formatFullName(params.firstName, params.lastName);
    const outcomeNote =
      params.result === "PASSED"
        ? "You are now eligible to apply for your Title Defense."
        : params.isDismissed
          ? "All three (3) permitted attempts have been exhausted. Please coordinate with the Office of the Graduate School regarding your academic standing."
          : `You have ${params.attemptsRemaining} remaining attempt${params.attemptsRemaining === 1 ? "" : "s"}.`;

    safeFire(
      "comp_exam_recorded",
      EmailService.sendTemplateEmail(
        params.email,
        "comp_exam_recorded",
        {
          recipient_name: name,
          attempt_number: String(params.attemptNumber),
          result: formatCompExamResultLabel(params.result),
          outcome_note: outcomeNote,
          portal_link: buildPortalUrl("/student/journey"),
        },
        { recipientName: name, triggeredById: params.triggeredById },
      ),
    );
  },

  // ── Cycle 4: Thesis & Dissertation Lifecycle ──────────────────────────────
  sendAdviserRequestReceivedByRequestId(requestId: string) {
    safeFire(
      "adviser_request_received",
      (async () => {
        const req = await prisma.adviserRequest.findUnique({
          where: { id: requestId },
          include: {
            requestedAdviser: { select: { email: true, firstName: true, lastName: true } },
            student: {
              include: {
                program: { select: { programName: true } },
                user: { select: { firstName: true, lastName: true } },
              },
            },
          },
        });
        const email = req?.requestedAdviser?.email?.trim();
        if (!req || !email) return;
        const adviserName = formatFullName(
          req.requestedAdviser.firstName,
          req.requestedAdviser.lastName,
        );
        const studentName = formatFullName(
          req.student.user.firstName,
          req.student.user.lastName,
        );
        await EmailService.sendTemplateEmail(
          email,
          "adviser_request_received",
          {
            recipient_name: adviserName,
            student_name: studentName,
            program_name: req.student.program?.programName ?? "Graduate Program",
            portal_link: buildPortalUrl("/panelist/adviser-requests"),
          },
          { recipientName: adviserName, idempotencyKey: `adviser-req-new-${req.id}` },
        );
      })(),
    );
  },

  sendAdviserAssignedByRequestId(requestId: string, triggeredById?: string) {
    safeFire(
      "adviser_assigned",
      (async () => {
        const req = await prisma.adviserRequest.findUnique({
          where: { id: requestId },
          include: {
            requestedAdviser: { select: { email: true, firstName: true, lastName: true } },
            student: {
              include: {
                user: { select: { email: true, firstName: true, lastName: true } },
              },
            },
          },
        });
        if (!req?.student?.user || !req?.requestedAdviser) return;
        const studentName = formatFullName(
          req.student.user.firstName,
          req.student.user.lastName,
        );
        const adviserName = formatFullName(
          req.requestedAdviser.firstName,
          req.requestedAdviser.lastName,
        );

        const targets: Array<{
          to: string;
          recipientName: string;
          variables: Record<string, string>;
          idempotencyKey: string;
        }> = [];
        if (req.student.user.email) {
          targets.push({
            to: req.student.user.email,
            recipientName: studentName,
            variables: {
              recipient_name: studentName,
              student_name: studentName,
              adviser_name: adviserName,
              portal_link: buildPortalUrl("/student/thesis/adviser-request"),
            },
            idempotencyKey: `adviser-assigned-student-${req.id}`,
          });
        }
        if (req.requestedAdviser.email) {
          targets.push({
            to: req.requestedAdviser.email,
            recipientName: adviserName,
            variables: {
              recipient_name: adviserName,
              student_name: studentName,
              adviser_name: adviserName,
              portal_link: buildPortalUrl("/panelist/advisees"),
            },
            idempotencyKey: `adviser-assigned-faculty-${req.id}`,
          });
        }
        if (targets.length > 0) {
          await EmailService.sendBatch(targets, "adviser_assigned", {}, {
            batchId: `adviser_assigned_${req.id}`,
            triggeredById,
          });
        }
      })(),
    );
  },

  sendAdviserRequestDeclinedByRequestId(
    requestId: string,
    decisionLabel: string,
    remarks: string | null | undefined,
    triggeredById?: string,
  ) {
    safeFire(
      "adviser_request_declined",
      (async () => {
        const req = await prisma.adviserRequest.findUnique({
          where: { id: requestId },
          include: {
            student: {
              include: {
                user: { select: { email: true, firstName: true, lastName: true } },
              },
            },
          },
        });
        const email = req?.student?.user?.email?.trim();
        if (!req || !email) return;
        const studentName = formatFullName(
          req.student.user.firstName,
          req.student.user.lastName,
        );
        await EmailService.sendTemplateEmail(
          email,
          "adviser_request_declined",
          {
            recipient_name: studentName,
            decision_label: decisionLabel,
            remarks: remarks?.trim() || "No additional remarks provided.",
            portal_link: buildPortalUrl("/student/thesis/adviser-request"),
          },
          { recipientName: studentName, triggeredById },
        );
      })(),
    );
  },

  sendDefenseApplicationReviewedByThesisId(params: {
    thesisId: string;
    stage: string;
    approved: boolean;
    remarks?: string | null;
    triggeredById?: string;
  }) {
    safeFire(
      "defense_application_status",
      (async () => {
        const thesis = await prisma.thesisRecord.findUnique({
          where: { id: params.thesisId },
          include: {
            student: {
              include: {
                user: { select: { email: true, firstName: true, lastName: true } },
              },
            },
          },
        });
        const email = thesis?.student?.user?.email?.trim();
        if (!thesis || !email) return;
        const studentName = formatFullName(
          thesis.student.user.firstName,
          thesis.student.user.lastName,
        );
        const stageLabel = formatDefenseStageLabel(params.stage);
        await EmailService.sendTemplateEmail(
          email,
          "defense_application_status",
          {
            recipient_name: studentName,
            defense_stage: stageLabel,
            status_label: params.approved
              ? "Approved for Scheduling"
              : "Returned for Revision",
            remarks:
              params.remarks?.trim() ||
              (params.approved
                ? "Your submitted requirements have been verified. Please wait for your defense schedule."
                : "Please review the remarks in your Student Portal and resubmit your application."),
            portal_link: buildPortalUrl(studentStagePortalPath(params.stage)),
          },
          { recipientName: studentName, triggeredById: params.triggeredById },
        );
      })(),
    );
  },

  sendDefenseScheduleAndPanelEmails(params: {
    scheduleId: string;
    isCorrection: boolean;
    triggeredById?: string;
    scheduleSnapshot?: {
      id: string;
      defenseType?: string | null;
      defenseDate: Date | string;
      defenseTime: Date | string;
      venueOrLink?: string | null;
      thesis?: {
        student?: {
          user?: { email?: string | null; firstName?: string | null; lastName?: string | null } | null;
        } | null;
      } | null;
      panelAssignments?: Array<{
        role: string;
        isActive?: boolean;
        user?: { email?: string | null; firstName?: string | null; lastName?: string | null } | null;
      }> | null;
    } | null;
    removedPanelists?: Array<{ email: string; name: string; role: string }>;
  }) {
    safeFire(
      "defense_schedule_and_panel",
      (async () => {
        const schedule =
          params.scheduleSnapshot ??
          (typeof prisma.defenseSchedule?.findUnique === "function"
            ? await prisma.defenseSchedule.findUnique({
                where: { id: params.scheduleId },
                include: {
                  thesis: {
                    include: {
                      student: {
                        include: {
                          user: { select: { email: true, firstName: true, lastName: true } },
                        },
                      },
                    },
                  },
                  panelAssignments: {
                    where: { isActive: true },
                    include: {
                      user: { select: { email: true, firstName: true, lastName: true } },
                    },
                  },
                },
              })
            : null);
        if (!schedule) return;

        const stageLabel = formatDefenseStageLabel(schedule.defenseType);
        const defenseDate = formatUtcDate(schedule.defenseDate);
        const defenseTime = formatUtcTime(schedule.defenseTime);
        const venue = schedule.venueOrLink?.trim() || "To be announced";
        const studentUser = schedule.thesis?.student?.user;
        const studentName = formatFullName(
          studentUser?.firstName,
          studentUser?.lastName,
        );

        if (studentUser?.email) {
          const scheduleMessage = params.isCorrection
            ? `Please be informed that the schedule details for your ${stageLabel} Defense have been updated by the Office of the Graduate School.`
            : `Please be informed that your ${stageLabel} Defense has been officially scheduled by the Office of the Graduate School.`;
          await EmailService.sendTemplateEmail(
            studentUser.email,
            "defense_schedule",
            {
              recipient_name: studentName,
              student_name: studentName,
              defense_stage: stageLabel,
              schedule_action: params.isCorrection ? "Updated" : "Scheduled",
              schedule_message: scheduleMessage,
              defense_date: defenseDate,
              defense_time: defenseTime,
              venue,
              portal_link: buildPortalUrl(studentStagePortalPath(schedule.defenseType)),
            },
            {
              recipientName: studentName,
              batchId: `defense_sched_${schedule.id}`,
              triggeredById: params.triggeredById,
            },
          );
        }

        const panelBatch: Array<{
          to: string;
          recipientName: string;
          variables: Record<string, string>;
        }> = [];

        for (const assignment of schedule.panelAssignments ?? []) {
          if (assignment.isActive === false) continue;
          const email = assignment.user?.email?.trim();
          if (!email) continue;
          const facultyName = formatFullName(
            assignment.user?.firstName,
            assignment.user?.lastName,
          );
          const panelRole = formatPanelRoleLabel(assignment.role);
          const assignmentMessage = params.isCorrection
            ? `Please be informed that the schedule details for your ${stageLabel} Defense committee assignment as ${panelRole} for ${studentName} have been updated.`
            : `You have been formally designated to serve as ${panelRole} for the ${stageLabel} Defense of ${studentName}.`;
          panelBatch.push({
            to: email,
            recipientName: facultyName,
            variables: {
              recipient_name: facultyName,
              assignment_action: params.isCorrection ? "Schedule Update" : "Assignment",
              assignment_message: assignmentMessage,
              panel_role: panelRole,
              student_name: studentName,
              defense_stage: stageLabel,
              defense_date: defenseDate,
              defense_time: defenseTime,
              venue,
              portal_link: buildPortalUrl(`/panelist/defense-workspace/${schedule.id}`),
            },
          });
        }

        for (const removed of params.removedPanelists ?? []) {
          if (!removed.email?.trim()) continue;
          const panelRole = formatPanelRoleLabel(removed.role);
          panelBatch.push({
            to: removed.email.trim(),
            recipientName: removed.name,
            variables: {
              recipient_name: removed.name,
              assignment_action: "Update",
              assignment_message: `Please be informed that your designation as ${panelRole} for the ${stageLabel} Defense of ${studentName} has been updated, and you are no longer included in this defense committee.`,
              panel_role: panelRole,
              student_name: studentName,
              defense_stage: stageLabel,
              defense_date: defenseDate,
              defense_time: defenseTime,
              venue,
              portal_link: buildPortalUrl("/panelist/defenses"),
            },
          });
        }

        if (panelBatch.length > 0) {
          await EmailService.sendBatch(panelBatch, "defense_panel_assignment", {}, {
            batchId: `defense_panel_${schedule.id}`,
            triggeredById: params.triggeredById,
          });
        }
      })(),
    );
  },

  sendDefenseConcludedByScheduleId(params: {
    scheduleId: string;
    outcome: string;
    remarks?: string | null;
    triggeredById?: string;
  }) {
    safeFire(
      "defense_concluded",
      (async () => {
        const schedule = await prisma.defenseSchedule.findUnique({
          where: { id: params.scheduleId },
          include: {
            thesis: {
              include: {
                student: {
                  include: {
                    user: { select: { email: true, firstName: true, lastName: true } },
                  },
                },
              },
            },
          },
        });
        const studentUser = schedule?.thesis?.student?.user;
        if (!schedule || !studentUser?.email) return;

        const studentName = formatFullName(studentUser.firstName, studentUser.lastName);
        await EmailService.sendTemplateEmail(
          studentUser.email,
          "defense_concluded",
          {
            recipient_name: studentName,
            defense_stage: formatDefenseStageLabel(schedule.defenseType),
            verdict_label: formatDefenseOutcomeLabel(params.outcome),
            remarks:
              params.remarks?.trim() ||
              "Sign in to view the official defense record and next requirements.",
            portal_link: buildPortalUrl("/student/journey"),
          },
          {
            recipientName: studentName,
            idempotencyKey: `defense-concluded-${schedule.id}`,
            triggeredById: params.triggeredById,
          },
        );
      })(),
    );
  },
};
