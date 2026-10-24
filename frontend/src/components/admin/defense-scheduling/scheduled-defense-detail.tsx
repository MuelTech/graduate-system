"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ApiError, apiClientRequest } from "@/lib/api.client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { AlertCircle, ExternalLink, RefreshCw } from "lucide-react";
import type { CommitteePolicyDto, ScheduledDefenseDetailDto } from "@/types";
import {
  defenseRecordHref,
  formatDefenseDate,
  formatDefenseTime,
  sessionStatusLabel,
} from "@/components/admin/defense-applications/labels";
import { ReadOnlyCommitteeRoster } from "./read-only-committee-roster";
import { defenseTypeLabel, stageFromDefenseType } from "./types";
import { ScheduledDefenseSubmission } from "./scheduled-defense-submission";

const SESSION_BADGE_CLASS: Record<string, string> = {
  SCHEDULED: "text-(--earist-secondary)",
  RESCHEDULED: "text-(--earist-secondary)",
  IN_PROGRESS: "text-(--earist-warning)",
  AWAITING_CONCLUSION: "text-(--earist-warning)",
  CONCLUDED: "text-(--earist-success)",
  CANCELLED: "text-destructive",
};

/** Only a complete http/https URL becomes an openable meeting link (§16). */
function safeMeetingLink(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!/^https?:\/\//i.test(trimmed)) return null;
  try {
    const url = new URL(trimmed);
    return /^https?:$/.test(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

function ContextItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium text-(--earist-body-text)">{label}</p>
      <p className="text-sm break-words text-foreground">{value}</p>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-4 w-40" />
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="h-3 w-16" />
              <Skeleton className="mt-2 h-4 w-28" />
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-4 w-36" />
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="h-3 w-16" />
              <Skeleton className="mt-2 h-4 w-28" />
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-4 w-40" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-12" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * UIUX-2L FIX-3: read-only exact scheduled-defense detail (scheduleId mode).
 * Answers WHEN / WHERE / WHO only; no editing and no academic authority.
 */
export function ScheduledDefenseDetail({
  scheduleId,
  onBack,
}: {
  scheduleId: string;
  /** Optional: clear the selected schedule without leaving the workspace. */
  onBack?: () => void;
}) {
  const detailQuery = useQuery<ScheduledDefenseDetailDto>({
    queryKey: ["scheduledDefenseDetail", scheduleId],
    queryFn: async () =>
      (await apiClientRequest(
        `/thesis/defense/schedules/${scheduleId}`,
      )) as ScheduledDefenseDetailDto,
  });

  const detail = detailQuery.data;
  const defenseType = detail?.defenseType ?? "";
  const programType = detail?.programType ?? null;

  const policyQuery = useQuery<CommitteePolicyDto>({
    queryKey: ["committeePolicy", defenseType, programType ?? ""],
    enabled: !!detail,
    queryFn: async () => {
      const params = new URLSearchParams({ defenseType });
      if (programType) params.set("programType", programType);
      return (await apiClientRequest(
        `/thesis/committee-policy?${params.toString()}`,
      )) as CommitteePolicyDto;
    },
  });

  if (detailQuery.isLoading) {
    return <DetailSkeleton />;
  }

  const notFound =
    detailQuery.error instanceof ApiError && detailQuery.error.statusCode === 404;

  if (notFound) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-(--earist-border-gray) p-12 text-center">
        <AlertCircle
          className="h-8 w-8 text-(--earist-secondary)"
          aria-hidden="true"
        />
        <p className="text-sm font-semibold text-(--earist-primary)">
          Scheduled defense not found
        </p>
        <p className="text-sm text-(--earist-body-text)">
          This schedule may no longer exist, or the link is incorrect.
        </p>
        {onBack ? (
          <Button variant="outline" size="sm" onClick={onBack}>
            Back to scheduled list
          </Button>
        ) : (
          <Link
            href="/admin/thesis/scheduling"
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "mt-1",
            )}
          >
            Back to Scheduling &amp; Panels
          </Link>
        )}
      </div>
    );
  }

  if (detailQuery.isError || !detail) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-(--earist-border-gray) p-12 text-center">
        <AlertCircle
          className="h-8 w-8 text-(--earist-secondary)"
          aria-hidden="true"
        />
        <div className="space-y-1">
          <p className="text-sm font-semibold text-(--earist-primary)">
            Unable to load the scheduled defense
          </p>
          <p className="text-sm text-(--earist-body-text)">
            The schedule could not be loaded. Please try again.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => detailQuery.refetch()}
          disabled={detailQuery.isFetching}
        >
          <RefreshCw
            className={cn("mr-2 h-4 w-4", detailQuery.isFetching && "animate-spin")}
            aria-hidden="true"
          />
          Retry
        </Button>
      </div>
    );
  }

  const stage = stageFromDefenseType(detail.defenseType);
  const meetingLink = safeMeetingLink(detail.venueOrLink);
  const venueText = detail.venueOrLink?.trim() ?? "";

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-sm font-semibold text-(--earist-secondary)">
              Selected Defense
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="text-(--earist-secondary)">
                {defenseTypeLabel(stage)}
              </Badge>
              <Badge
                variant="outline"
                className={cn(
                  "font-medium",
                  SESSION_BADGE_CLASS[detail.sessionStatus.toUpperCase()],
                )}
              >
                {sessionStatusLabel(detail.sessionStatus)}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <ContextItem label="Student" value={detail.studentName || "Not recorded"} />
          <ContextItem
            label="Student No."
            value={detail.studentNumber || "Not recorded"}
          />
          <ContextItem label="Program" value={detail.program || "Not recorded"} />
          <ContextItem label="Defense Stage" value={defenseTypeLabel(stage)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-(--earist-secondary)">
            Defense Schedule
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <ContextItem label="Date" value={formatDefenseDate(detail.defenseDate)} />
          <ContextItem label="Time" value={formatDefenseTime(detail.defenseTime)} />
          <div className="min-w-0">
            <p className="text-xs font-medium text-(--earist-body-text)">
              Venue / Meeting Details
            </p>
            {meetingLink ? (
              <a
                href={meetingLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm break-words text-(--earist-primary) underline underline-offset-2 hover:text-(--earist-secondary)"
              >
                Open Meeting Link
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            ) : (
              <p className="text-sm break-words text-foreground">
                {venueText || "Not recorded"}
              </p>
            )}
          </div>
          <ContextItem
            label="Session Status"
            value={sessionStatusLabel(detail.sessionStatus)}
          />
        </CardContent>
      </Card>

      <ScheduledDefenseSubmission scheduleId={detail.scheduleId} />

      <ReadOnlyCommitteeRoster
        committee={detail.committee}
        defenseType={detail.defenseType}
        defenseStageLabel={defenseTypeLabel(stage)}
        programType={programType}
        policy={policyQuery.data}
      />

      <div className="flex flex-wrap justify-end gap-2">
        <Link
          href={defenseRecordHref(detail.scheduleId)}
          className={buttonVariants({ variant: "outline" })}
        >
          View Defense Record
        </Link>
      </div>

      <p className="text-xs text-(--earist-body-text)">
        Read-only view of the confirmed schedule and committee. Editing is not
        available here; scheduling changes are handled through a separate
        audited process.
      </p>
    </div>
  );
}
