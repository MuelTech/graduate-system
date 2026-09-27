"use client";

import { CalendarDays, Clock, MapPin, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  defenseStatusDescription,
  defenseStatusHeading,
  formatDefenseDate,
  formatDefenseTime,
  sessionStatusLabel,
} from "@/lib/student-thesis-journey";
import type {
  DefenseSessionSummary,
  DefenseSubstatus,
  JourneyStepView,
} from "@/types/student-thesis-journey";
import { StudentRapPanel } from "@/components/student/student-rap-panel";

export function DefenseScheduleSummary({
  session,
}: {
  session: DefenseSessionSummary | null | undefined;
}) {
  if (!session) return null;
  return (
    <div className="space-y-2 rounded-lg border border-(--earist-border-gray) bg-(--earist-surface-gray) p-3 text-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-(--earist-secondary)">
        Defense Schedule
      </p>
      <div className="grid gap-2 text-(--earist-body-text) sm:grid-cols-2">
        <p className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-(--earist-primary)" />
          <span>
            <span className="font-medium">Date:</span>{" "}
            {formatDefenseDate(session.defenseDate)}
          </span>
        </p>
        <p className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-(--earist-primary)" />
          <span>
            <span className="font-medium">Time:</span>{" "}
            {formatDefenseTime(session.defenseTime)}
          </span>
        </p>
        <p className="flex items-center gap-2 sm:col-span-2">
          <MapPin className="h-4 w-4 text-(--earist-primary)" />
          <span>
            <span className="font-medium">Venue / Link:</span>{" "}
            {session.venueOrLink?.trim() || "To be announced"}
          </span>
        </p>
        <p className="sm:col-span-2">
          <span className="font-medium">Status:</span>{" "}
          {sessionStatusLabel(session.sessionStatus)}
        </p>
      </div>
      {session.scheduleId && (
        <StudentRapPanel scheduleId={session.scheduleId} />
      )}
    </div>
  );
}

/**
 * Shared Student defense waiting/active status presentation.
 * Maps backend defenseStatus → readable headings; does not invent progression.
 */
export function DefenseStatusPanel({
  kind,
  step,
  onRefresh,
  isRefreshing,
  extra,
}: {
  kind: "Title" | "Proposal" | "Final";
  step: JourneyStepView | undefined;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  extra?: React.ReactNode;
}) {
  const status: DefenseSubstatus | null | undefined = step?.defenseStatus;
  const heading = defenseStatusHeading(status, "Application in progress");
  const description =
    step?.detail || defenseStatusDescription(status, kind, step?.lockReason);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Clock className="h-5 w-5 text-amber-600" />
          {heading}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-(--earist-body-text)">{description}</p>
        {status === "APPROVED_WAITING_SCHEDULE" && (
          <p className="text-(--earist-body-text)">
            Application approved — waiting for defense schedule.
          </p>
        )}
        <DefenseScheduleSummary session={step?.defenseSession} />
        {step?.nextAction && (
          <p className="text-(--earist-body-text)">{step.nextAction}</p>
        )}
        {extra}
        {onRefresh && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
            />
            {isRefreshing ? "Refreshing…" : "Refresh Status"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
