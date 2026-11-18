"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
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
  orNumber?: string | null;
  amountPaid?: string | null;
  thesisDocuments: Array<{ id: string; docType: string; isCurrent?: boolean }>;
};

/** Workflow-bucket display projection, never raw ThesisRecord.status alone. */
const STATUS_BADGE_CLASS: Record<string, string> = {
  PENDING: "border-amber-200 bg-amber-50 text-amber-800",
  APPROVED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  SCHEDULED: "border-blue-200 bg-blue-50 text-blue-700",
  PASSED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  REJECTED: "border-red-200 bg-red-50 text-red-700",
  REVISION: "border-amber-200 bg-amber-50 text-amber-800",
  FAILED: "border-red-200 bg-red-50 text-red-700",
};

/** Session-status projection — text label always rendered, color is secondary. */
const SESSION_BADGE_CLASS: Record<string, string> = {
  SCHEDULED: "border-blue-200 bg-blue-50 text-blue-700",
  RESCHEDULED: "border-blue-200 bg-blue-50 text-blue-700",
  IN_PROGRESS: "border-amber-200 bg-amber-50 text-amber-800",
  AWAITING_CONCLUSION: "border-amber-200 bg-amber-50 text-amber-800",
  CONCLUDED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  CANCELLED: "border-red-200 bg-red-50 text-red-700",
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
      <TableRow>
        <TableCell>
          <p className="text-sm font-semibold break-words text-[#333333]">
            {studentName}
          </p>
          <p className="mt-0.5 text-xs break-words text-gray-500">
            {identitySecondary}
          </p>
        </TableCell>
        <TableCell>
          <span className="inline-flex items-center rounded-md border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-xs font-medium text-[#333333]">
            {STAGE_LABELS[app.stage] ?? app.stage}
          </span>
        </TableCell>
        <TableCell>
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
        </TableCell>
        <TableCell>
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
        </TableCell>
        <TableCell>
          <Badge
            variant="outline"
            className={cn(
              "font-medium",
              SESSION_BADGE_CLASS[String(schedule?.sessionStatus ?? "").toUpperCase()],
            )}
          >
            {sessionStatusLabel(schedule?.sessionStatus)}
          </Badge>
        </TableCell>
        <TableCell className="text-right">
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
        </TableCell>
      </TableRow>
    );
  }

  const action = applicationAction(app);

  return (
    <TableRow>
      <TableCell>
        <p className="text-sm font-semibold break-words text-[#333333]">
          {studentName}
        </p>
        <p className="mt-0.5 text-xs break-words text-gray-500">
          {identitySecondary}
        </p>
      </TableCell>
      <TableCell>
        <span className="inline-flex items-center rounded-md border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-xs font-medium text-[#333333]">
          {STAGE_LABELS[app.stage] ?? app.stage}
        </span>
      </TableCell>
      <TableCell>
        <p className="text-sm break-words text-gray-600">
          {formatSubmitted(app.createdAt)}
        </p>
      </TableCell>
      <TableCell>
        <p className="text-sm break-words text-gray-600">
          {docCount} document{docCount === 1 ? "" : "s"} submitted
        </p>
      </TableCell>
      <TableCell>
        <Badge
          variant="outline"
          className={cn("font-medium", STATUS_BADGE_CLASS[statusKey])}
        >
          {displayStatusLabel(app)}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
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
      </TableCell>
    </TableRow>
  );
}
