import cron, { type ScheduledTask } from "node-cron";
import prisma from "../config/database";
import { EmailService } from "../services/email.service";
import { buildPortalUrl } from "../services/email-layout";
import {
  EXAM_SCHEDULE_TIMEZONE,
  manilaCalendarDate,
} from "../services/exam-schedule-time";

export interface ExamReminderRunSummary {
  targetDate: string;
  matchedCount: number;
  queuedCount: number;
  skippedCount: number;
}

function formatWallClockDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

function formatWallClockTime(time: Date | null): string {
  if (!time) return "Scheduled Time";
  const hours = time.getUTCHours();
  const minutes = time.getUTCMinutes();
  const suffix = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 || 12;
  return `${hour12}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

/**
 * Checks for PENDING (unreleased, active) Entrance Examinations scheduled for
 * tomorrow in Asia/Manila that have not yet received a 24-hour reminder,
 * enqueues personalized reminders via the MySQL persistent queue, and stamps
 * `reminder24hSentAt` so applicants are never reminded twice.
 */
export async function runExamReminder24hCheck(
  now = new Date(),
  triggeredById?: string,
): Promise<ExamReminderRunSummary> {
  const todayManila = new Date(`${manilaCalendarDate(now)}T00:00:00.000Z`);
  const tomorrowManila = new Date(todayManila.getTime() + 24 * 60 * 60 * 1000);
  const targetDateIso = tomorrowManila.toISOString().slice(0, 10);

  const upcomingExams = await prisma.entranceExamApplication.findMany({
    where: {
      examDate: tomorrowManila,
      status: "PENDING",
      seatReleasedAt: null,
      reminder24hSentAt: null,
      student: {
        user: {
          isActive: true,
        },
      },
    },
    include: {
      program: { select: { programName: true } },
      student: {
        include: {
          user: {
            select: {
              email: true,
              firstName: true,
              lastName: true,
              isActive: true,
            },
          },
        },
      },
    },
  });

  if (upcomingExams.length === 0) {
    return {
      targetDate: targetDateIso,
      matchedCount: 0,
      queuedCount: 0,
      skippedCount: 0,
    };
  }

  let queuedCount = 0;
  let skippedCount = 0;
  const formattedDate = formatWallClockDate(tomorrowManila);
  const portalLink = buildPortalUrl("/applicant/exam");
  const batchId = `exam_reminder_24h_${targetDateIso}`;

  for (const app of upcomingExams) {
    const email = app.student?.user?.email?.trim();
    if (!email) {
      skippedCount += 1;
      continue;
    }

    const fullName =
      `${app.student.user.firstName ?? ""} ${app.student.user.lastName ?? ""}`.trim() ||
      "Applicant";

    try {
      const res = await EmailService.sendTemplateEmail(
        email,
        "exam_reminder_24h",
        {
          recipient_name: fullName,
          program_name: app.program?.programName ?? "Graduate Program",
          exam_date: formattedDate,
          exam_time: formatWallClockTime(app.examTime),
          portal_link: portalLink,
        },
        {
          recipientName: fullName,
          batchId,
          idempotencyKey: `exam-reminder-24h-${app.id}`,
          triggeredById,
        },
      );

      if (res.queued && !res.skipped) {
        await prisma.entranceExamApplication.update({
          where: { id: app.id },
          data: { reminder24hSentAt: new Date() },
        });
        queuedCount += 1;
      } else {
        skippedCount += 1;
      }
    } catch (error: unknown) {
      skippedCount += 1;
      console.error(
        `[Cron] Failed to enqueue 24h exam reminder for application ${app.id}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  return {
    targetDate: targetDateIso,
    matchedCount: upcomingExams.length,
    queuedCount,
    skippedCount,
  };
}

export function startCronJobs(): { stop: () => void } {
  console.log(
    `[Cron] Scheduling daily 24h Entrance Exam Reminder at 08:00 (${EXAM_SCHEDULE_TIMEZONE}).`,
  );

  const task: ScheduledTask = cron.schedule(
    "0 8 * * *",
    async () => {
      try {
        const summary = await runExamReminder24hCheck();
        if (summary.matchedCount > 0) {
          console.log(
            `[Cron] 24h Exam Reminder (${summary.targetDate}): queued=${summary.queuedCount}, skipped=${summary.skippedCount}`,
          );
        }
      } catch (error: unknown) {
        console.error(
          "[Cron] Failed to process 24h exam reminders:",
          error instanceof Error ? error.message : error,
        );
      }
    },
    { timezone: EXAM_SCHEDULE_TIMEZONE },
  );

  return {
    stop() {
      task.stop();
    },
  };
}
