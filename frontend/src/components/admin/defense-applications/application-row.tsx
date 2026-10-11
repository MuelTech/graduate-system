"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Eye } from "lucide-react";
import type { ApprovedApplicationDto } from "@/types";
import { STAGE_LABELS, displayStatusKey, displayStatusLabel } from "./labels";

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

/** Owner of the row-detail navigation; other buckets use a read-only label. */
export function rowActionLabel(bucket?: string): string {
  return bucket === "NEEDS_REVIEW" ? "Review Application" : "View Application";
}

export function applicationDetailHref(app: {
  id: string;
  thesisId?: string;
}): string {
  return `/admin/thesis/applications/${app.thesisId ?? app.id}`;
}

function formatSubmitted(value: string): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
}

export function DefenseApplicationRow({ app }: { app: DefenseApplicationDto }) {
  const student = app.student;
  const docCount = app.thesisDocuments?.length ?? 0;
  const statusKey = displayStatusKey(app);
  const actionLabel = rowActionLabel(app.workflowBucket);
  const identitySecondary =
    [student.studentNumber, student.program?.programName]
      .filter(Boolean)
      .join(" · ") || student.user.email;

  return (
    <tr className="border-b border-(--earist-border-gray) last:border-0 hover:bg-(--earist-surface-gray)/60">
      <td className="px-4 py-3 align-top">
        <p className="text-sm font-semibold break-words text-foreground">
          {student.user.firstName} {student.user.lastName}
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
        <Link
          href={applicationDetailHref(app)}
          aria-label={`${actionLabel} — ${student.user.firstName} ${student.user.lastName}`}
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "ml-auto",
          )}
        >
          <Eye className="mr-1.5 h-4 w-4" aria-hidden="true" />
          {actionLabel}
        </Link>
      </td>
    </tr>
  );
}
