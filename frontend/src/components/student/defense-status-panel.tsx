"use client";

import { CalendarDays, Clock, MapPin, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { StudentOfficialApplicationRecord } from "@/components/student/official-defense-application-record";

export function DefenseScheduleSummary({
  session,
}: {
  session: DefenseSessionSummary | null | undefined;
}) {
  if (!session) return null;
  const isConcluded = session.sessionStatus === "CONCLUDED";

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="border-b border-gray-100 pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base font-bold text-[#333333]">
              <CalendarDays className="h-4 w-4 text-[#e02b20]" />
              Defense Schedule
            </CardTitle>
            <Badge
              variant="outline"
              className={
                isConcluded
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-blue-200 bg-blue-50 text-blue-700"
              }
            >
              {sessionStatusLabel(session.sessionStatus)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-4 text-sm text-[#333333]">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-gray-100 bg-gray-50/70 p-3">
              <p className="text-xs font-semibold tracking-wider text-gray-500 uppercase">
                Date
              </p>
              <p className="mt-1 flex items-center gap-2 font-semibold text-[#333333]">
                <CalendarDays className="h-4 w-4 shrink-0 text-[#e02b20]" />
                <span>{formatDefenseDate(session.defenseDate)}</span>
              </p>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50/70 p-3">
              <p className="text-xs font-semibold tracking-wider text-gray-500 uppercase">
                Time
              </p>
              <p className="mt-1 flex items-center gap-2 font-semibold text-[#333333]">
                <Clock className="h-4 w-4 shrink-0 text-[#e02b20]" />
                <span>{formatDefenseTime(session.defenseTime)}</span>
              </p>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50/70 p-3">
              <p className="text-xs font-semibold tracking-wider text-gray-500 uppercase">
                Venue / Meeting Link
              </p>
              <p className="mt-1 flex items-center gap-2 font-semibold text-[#333333]">
                <MapPin className="h-4 w-4 shrink-0 text-[#e02b20]" />
                <span className="truncate">
                  {session.venueOrLink?.trim() || "To be announced"}
                </span>
              </p>
            </div>
          </div>

          {session.scheduleId && !isConcluded && (
            <StudentOfficialApplicationRecord scheduleId={session.scheduleId} />
          )}
        </CardContent>
      </Card>

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
    <div className="space-y-4">
      <Card>
        <CardHeader className="border-b border-gray-100 pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base font-bold text-[#333333]">
              <Clock className="h-4 w-4 text-[#f9a825]" />
              {heading}
            </CardTitle>
            {onRefresh && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onRefresh}
                disabled={isRefreshing}
              >
                <RefreshCw
                  className={`mr-1.5 h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`}
                />
                {isRefreshing ? "Refreshing…" : "Refresh Status"}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-4 text-sm text-[#333333]">
          <p className="text-gray-600">{description}</p>
          {status === "APPROVED_WAITING_SCHEDULE" && (
            <p className="text-gray-600">
              Application approved — waiting for defense schedule.
            </p>
          )}
          {step?.nextAction && (
            <p className="font-medium text-[#333333]">{step.nextAction}</p>
          )}
          {extra ? <div className="pt-1">{extra}</div> : null}
        </CardContent>
      </Card>

      <DefenseScheduleSummary session={step?.defenseSession} />
    </div>
  );
}
