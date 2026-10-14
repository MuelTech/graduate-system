"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CalendarClock, Eye, FileText } from "lucide-react";
import type { ApprovedApplicationDto } from "@/types";
import {
  STAGE_LABELS,
  activeScheduleAction,
  defenseRecordHref,
  displayStatusKey,
  displayStatusLabel,
  formatDefenseDate,
  formatDefenseTime,
  parseVenueOrLink,
  scheduleDetailHref,
  schedulingHref,
  sessionStatusLabel,
  type ApplicationTableVariant,
} from "./labels";

export type DefenseApplicationDto = ApprovedApplicationDto & {
  rejectionReason?: string | null;
  thesisDocuments: Array<{ id: string; docType: string; isCurrent?: boolean }>;
};

/** Workflow-bucket display projection, never raw ThesisRecord.status alone. */
const STATUS_BADGE_CLASS: Record<string, string> = {
  PENDING: "text-(--earist-warning)",
  APPROVED: "text-(--earist-success)",
  SCHEDULED: "text-(--earist-secondary)",
  PASSED: "text-(--earist-success)",
  REJECTED: "text-destructive",
  REVISION: "text-(--earist-warning)",
  FAILED: "text-destructive",
};

/** Session-status projection — text label always rendered, color is secondary. */
const SESSION_BADGE_CLASS: Record<string, string> = {
  SCHEDULED: "text-(--earist-secondary)",
  RESCHEDULED: "text-(--earist-secondary)",
  IN_PROGRESS: "text-(--earist-warning)",
  AWAITING_CONCLUSION: "text-(--earist-warning)",
  CONCLUDED: "text-(--earist-success)",
  CANCELLED: "text-destructive",
};

/** Owner of the row-detail navigation for the application-oriented columns. */
export function rowActionLabel(bucket?: string): string {
  return bucket === "NEEDS_REVIEW" ? "Review Application" : "View Application";
}

export function applicationDetailHref(app: {
  id: string;
  thesisId?: string;
}): string {
  return `/admin/thesis/applications/${app.thesisId ?? app.id}`;
}

/**
 * Application-oriented row action. Ready communicates the next operational step;
 * a History row with an actual defense session routes to Defense Records, while
 * rejected/no-session history stays on the application detail page.
 */
function applicationAction(app: DefenseApplicationDto): {
  label: string;
  href: string;
  icon: "eye" | "record";
} {
  if (app.workflowBucket === "READY") {
    return {
      label: "Assign Panel & Schedule",
      href: schedulingHref(app.thesisId ?? app.id),
      icon: "eye",
    };
  }
  if (app.workflowBucket === "HISTORY" && app.currentSchedule?.id) {
    return {
      label: "View Defense Record",
      href: defenseRecordHref(app.currentSchedule.id),
      icon: "record",
    };
  }
  return {
    label: rowActionLabel(app.workflowBucket),
    href: applicationDetailHref(app),
    icon: "eye",
  };
}

function formatSubmitted(value: string): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
}

function ActionButton({
  href,
  label,
  studentName,
  icon,
}: {
  href: string;
  label: string;
  studentName: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={`${label} — ${studentName}`}
      className={cn(buttonVariants({ variant: "outline", size: "sm" }), "ml-auto")}
    >
      {icon}
      {label}
    </Link>
  );
}

export function DefenseApplicationRow({
  app,
  variant,
}: {
  app: DefenseApplicationDto;
  variant: ApplicationTableVariant;
}) {
  const student = app.student;
  const studentName = `${student.user.firstName} ${student.user.lastName}`;
  const docCount = app.thesisDocuments?.length ?? 0;
  const statusKey = displayStatusKey(app);
  const identitySecondary =
    [student.studentNumber, student.program?.programName]
      .filter(Boolean)
      .join(" · ") || student.user.email;

  if (variant === "schedule") {
    const schedule = app.currentSchedule;
    const venue = parseVenueOrLink(schedule?.venueOrLink);
    const action = activeScheduleAction(schedule?.sessionStatus);
    return (
      <tr className="border-b border-(--earist-border-gray) last:border-0 hover:bg-(--earist-surface-gray)/60">
        <td className="px-4 py-3 align-top">
          <p className="text-sm font-semibold break-words text-foreground">
            {studentName}
          </p>
          <p className="mt-0.5 text-xs break-words text-(--earist-body-text)">
            {identitySecondary}
          </p>
        </td>
        <td className="px-4 py-3 align-top">
          <p className="text-sm break-words text-(--earist-body-text)">
            {STAGE_LABELS[app.stage] ?? app.stage}
          </p>
        </td>
        <td className="px-4 py-3 align-top">
          {schedule?.defenseDate ? (
            <>
              <p className="text-sm break-words text-foreground">
                {formatDefenseDate(schedule.defenseDate)}
              </p>
              <p className="mt-0.5 text-xs tabular-nums text-(--earist-body-text)">
                {formatDefenseTime(schedule.defenseTime)}
              </p>
            </>
          ) : (
            <p className="text-sm text-(--earist-body-text)">Not set</p>
          )}
        </td>
        <td className="px-4 py-3 align-top">
          {venue.kind === "url" ? (
            <a
              href={venue.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm break-words text-(--earist-primary) underline underline-offset-2 hover:text-(--earist-secondary)"
            >
              {venue.label}
            </a>
          ) : venue.kind === "text" ? (
            <p
              className="truncate text-sm text-(--earist-body-text)"
              title={venue.text}
            >
              {venue.text}
            </p>
          ) : (
            <p className="text-sm text-(--earist-body-text)">Not set</p>
          )}
        </td>
        <td className="px-4 py-3 align-top">
          <Badge
            variant="outline"
            className={cn(
              "font-medium",
              SESSION_BADGE_CLASS[String(schedule?.sessionStatus ?? "").toUpperCase()],
            )}
          >
            {sessionStatusLabel(schedule?.sessionStatus)}
          </Badge>
        </td>
        <td className="px-4 py-3 text-right align-top">
          {schedule ? (
            action.kind === "record" ? (
              <ActionButton
                href={defenseRecordHref(schedule.id)}
                label="View Defense Record"
                studentName={studentName}
                icon={<FileText className="mr-1.5 h-4 w-4" aria-hidden="true" />}
              />
            ) : (
              <ActionButton
                href={scheduleDetailHref(schedule.id)}
                label="View Schedule"
                studentName={studentName}
                icon={
                  <CalendarClock className="mr-1.5 h-4 w-4" aria-hidden="true" />
                }
              />
            )
          ) : (
            <span className="ml-auto text-sm text-(--earist-body-text)">—</span>
          )}
        </td>
      </tr>
    );
  }

  const action = applicationAction(app);

  return (
    <tr className="border-b border-(--earist-border-gray) last:border-0 hover:bg-(--earist-surface-gray)/60">
      <td className="px-4 py-3 align-top">
        <p className="text-sm font-semibold break-words text-foreground">
          {studentName}
        </p>
        <p className="mt-0.5 text-xs break-words text-(--earist-body-text)">
          {identitySecondary}
        </p>
      </td>
      <td className="px-4 py-3 align-top">
        <p className="text-sm break-words text-(--earist-body-text)">
          {STAGE_LABELS[app.stage] ?? app.stage}
        </p>
      </td>
      <td className="px-4 py-3 align-top">
        <p className="text-sm break-words text-(--earist-body-text)">
          {formatSubmitted(app.createdAt)}
        </p>
      </td>
      <td className="px-4 py-3 align-top">
        <p className="text-sm break-words text-(--earist-body-text)">
          {docCount} document{docCount === 1 ? "" : "s"} submitted
        </p>
      </td>
      <td className="px-4 py-3 align-top">
        <Badge
          variant="outline"
          className={cn("font-medium", STATUS_BADGE_CLASS[statusKey])}
        >
          {displayStatusLabel(app)}
        </Badge>
      </td>
      <td className="px-4 py-3 text-right align-top">
        <ActionButton
          href={action.href}
          label={action.label}
          studentName={studentName}
          icon={
            action.icon === "record" ? (
              <FileText className="mr-1.5 h-4 w-4" aria-hidden="true" />
            ) : (
              <Eye className="mr-1.5 h-4 w-4" aria-hidden="true" />
            )
          }
        />
      </td>
    </tr>
  );
}
