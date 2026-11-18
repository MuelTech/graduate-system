"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { CheckCircle2, ChevronLeft, ChevronRight, Search } from "lucide-react";
import type { ApprovedApplicationDto, PaginatedResponse } from "@/types";
import { defenseTypeLabel } from "./types";
import {
  formatDefenseDate,
  formatDefenseTime,
  parseVenueOrLink,
  sessionStatusLabel,
} from "@/components/admin/defense-applications/labels";

export type SchedulingQueueTab = "READY" | "SCHEDULED";

type ListState = {
  data: PaginatedResponse<ApprovedApplicationDto> | undefined;
  isLoading: boolean;
  isError: boolean;
  page: number;
  onPageChange: (page: number) => void;
};

type Props = {
  activeTab: SchedulingQueueTab;
  onTabChange: (tab: SchedulingQueueTab) => void;
  readyCount: number;
  scheduledCount: number;
  search: string;
  defenseType: string;
  programId: string;
  programs: Array<{ id: string; programName: string }>;
  onSearchChange: (value: string) => void;
  onDefenseTypeChange: (value: string) => void;
  onProgramChange: (value: string) => void;
  ready: ListState & {
    selectedId: string | null;
    onSelect: (app: ApprovedApplicationDto) => void;
  };
  scheduled: ListState & {
    selectedScheduleId: string | null;
    onSelect: (app: ApprovedApplicationDto) => void;
  };
};

function QueueSkeleton() {
  return (
    <div className="space-y-2" aria-hidden="true">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className="rounded-lg border border-(--earist-border-gray) p-3"
        >
          <Skeleton className="h-4 w-36" />
          <Skeleton className="mt-2 h-3 w-28" />
          <Skeleton className="mt-2 h-3 w-40" />
        </div>
      ))}
    </div>
  );
}

function Pagination({
  list,
  total,
}: {
  list: ListState;
  total: number;
}) {
  const pageSize = list.data?.pageSize ?? 10;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex items-center justify-between border-t border-(--earist-border-gray) pt-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={list.page <= 1 || list.isLoading}
        onClick={() => list.onPageChange(list.page - 1)}
        aria-label="Previous page"
      >
        <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
        Previous
      </Button>
      <span className="text-xs text-(--earist-body-text)">
        Page {Math.min(list.page, totalPages)} of {totalPages}
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={list.page >= totalPages || list.isLoading}
        onClick={() => list.onPageChange(list.page + 1)}
        aria-label="Next page"
      >
        Next
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
      </Button>
    </div>
  );
}

function stageBadgeClass(stage?: string | null): string {
  switch (stage) {
    case "TITLE":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "PROPOSAL":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "FINAL":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    default:
      return "border-gray-200 bg-gray-50 text-[#333333]";
  }
}

function ReadyList({
  list,
  filtered,
}: {
  list: Props["ready"];
  filtered: boolean;
}) {
  const items = list.data?.data ?? [];
  const total = list.data?.total ?? 0;
  const selectedId = list.selectedId;
  const onSelect = list.onSelect;
  if (list.isLoading) return <QueueSkeleton />;
  if (list.isError) {
    return (
      <p className="py-8 text-center text-sm text-destructive">
        Unable to load approved applications.
      </p>
    );
  }
  if (items.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-gray-500">
        {filtered
          ? "No approved applications match the selected filters."
          : "No approved defense applications are ready for scheduling."}
      </p>
    );
  }
  return (
    <>
      <div className="space-y-2">
        {items.map((app) => {
          const selected = selectedId === app.id;
          const student = app.student;
          return (
            <button
              key={app.id}
              type="button"
              aria-current={selected ? "true" : undefined}
              onClick={() => onSelect(app)}
              className={cn(
                "w-full rounded-xl border p-3 text-left transition-all",
                selected
                  ? "border-l-4 border-[#e02b20]/40 border-l-[#e02b20] bg-red-50/40 shadow-2xs"
                  : "border-gray-200/80 bg-white hover:border-gray-300 hover:bg-gray-50/60",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p
                    className={cn(
                      "truncate text-sm font-semibold",
                      selected ? "text-[#91060c]" : "text-[#333333]",
                    )}
                  >
                    {student.user.firstName} {student.user.lastName}
                  </p>
                  <p className="truncate text-xs text-gray-500">
                    {student.studentNumber || student.user.email}
                  </p>
                  <p className="truncate text-xs text-gray-500">
                    {student.program?.programName || "Program N/A"}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Badge
                    variant="outline"
                    className={cn("text-[11px]", stageBadgeClass(app.stage))}
                  >
                    {defenseTypeLabel(app.stage)}
                  </Badge>
                  <span className="text-[11px] text-gray-500">
                    Approved {new Date(app.createdAt).toLocaleDateString()}
                  </span>
                  {selected && (
                    <CheckCircle2
                      className="h-4 w-4 text-[#e02b20]"
                      aria-label="Selected"
                    />
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
      <Pagination list={list} total={total} />
    </>
  );
}

function ScheduledList({
  list,
  filtered,
}: {
  list: Props["scheduled"];
  filtered: boolean;
}) {
  const items = list.data?.data ?? [];
  const total = list.data?.total ?? 0;
  const selectedScheduleId = list.selectedScheduleId;
  const onSelect = list.onSelect;
  if (list.isLoading) return <QueueSkeleton />;
  if (list.isError) {
    return (
      <p className="py-8 text-center text-sm text-destructive">
        Unable to load scheduled defenses.
      </p>
    );
  }
  if (items.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-gray-500">
        {filtered
          ? "No scheduled defenses match the selected filters."
          : "No defenses are currently scheduled."}
      </p>
    );
  }
  return (
    <>
      <div className="space-y-2">
        {items.map((app) => {
          const schedule = app.currentSchedule;
          const scheduleId = schedule?.id ?? null;
          const selected = !!scheduleId && selectedScheduleId === scheduleId;
          const student = app.student;
          const venue = parseVenueOrLink(schedule?.venueOrLink);
          const venueText =
            venue.kind === "url"
              ? venue.label
              : venue.kind === "text"
                ? venue.text
                : "Venue not set";
          return (
            <button
              key={scheduleId ?? app.id}
              type="button"
              aria-current={selected ? "true" : undefined}
              disabled={!scheduleId}
              onClick={() => onSelect(app)}
              className={cn(
                "w-full rounded-xl border p-3 text-left transition-all",
                selected
                  ? "border-l-4 border-[#e02b20]/40 border-l-[#e02b20] bg-red-50/40 shadow-2xs"
                  : "border-gray-200/80 bg-white hover:border-gray-300 hover:bg-gray-50/60",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <p
                  className={cn(
                    "min-w-0 truncate text-sm font-semibold",
                    selected ? "text-[#91060c]" : "text-[#333333]",
                  )}
                >
                  {student.user.firstName} {student.user.lastName}
                </p>
                <Badge
                  variant="outline"
                  className={cn("shrink-0 text-[11px]", stageBadgeClass(app.stage))}
                >
                  {defenseTypeLabel(app.stage)}
                </Badge>
              </div>
              <p className="mt-0.5 truncate text-xs text-gray-500">
                {student.studentNumber || student.user.email}
              </p>
              <p className="mt-1 text-xs font-medium tabular-nums text-[#333333]">
                {schedule?.defenseDate
                  ? `${formatDefenseDate(schedule.defenseDate)} · ${formatDefenseTime(schedule.defenseTime)}`
                  : "Schedule not set"}
              </p>
              <div className="mt-1 flex items-center justify-between gap-2">
                <p
                  className="min-w-0 truncate text-xs text-gray-500"
                  title={venueText}
                >
                  {venueText}
                </p>
                <Badge
                  variant="outline"
                  className="shrink-0 border-blue-200 bg-blue-50 text-[11px] font-medium text-blue-700"
                >
                  {sessionStatusLabel(schedule?.sessionStatus)}
                </Badge>
              </div>
            </button>
          );
        })}
      </div>
      <Pagination list={list} total={total} />
    </>
  );
}

/**
 * UIUX-2L FIX-3A: single left-hand master-detail panel for Scheduling & Panels.
 * Two compact operational tabs (Ready / Scheduled) share the same
 * Search / Defense Stage / Program filters; the list under them is read from the
 * corresponding authoritative projection.
 */
export function SchedulingQueuePanel({
  activeTab,
  onTabChange,
  readyCount,
  scheduledCount,
  search,
  defenseType,
  programId,
  programs,
  onSearchChange,
  onDefenseTypeChange,
  onProgramChange,
  ready,
  scheduled,
}: Props) {
  const [searchDraft, setSearchDraft] = useState(search);

  useEffect(() => {
    const t = setTimeout(() => {
      if (searchDraft !== search) onSearchChange(searchDraft);
    }, 350);
    return () => clearTimeout(t);
  }, [searchDraft, search, onSearchChange]);

  const filtered = search !== "" || defenseType !== "ALL" || programId !== "ALL";

  const tabClass = (isActive: boolean) =>
    cn(
      "flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all sm:text-sm",
      isActive
        ? "bg-[#e02b20] text-white shadow-xs"
        : "text-gray-600 hover:bg-white hover:text-[#333333]",
    );

  const countClass = (isActive: boolean) =>
    cn(
      "rounded-full px-1.5 py-0.5 text-[11px] leading-none font-semibold tabular-nums",
      isActive
        ? "bg-white/20 text-white"
        : "bg-gray-200/80 text-gray-700",
    );

  return (
    <Card className="h-full border-gray-100 bg-white shadow-sm">
      <CardHeader className="pb-3">
        <div
          role="group"
          aria-label="Scheduling views"
          className="grid grid-cols-2 gap-1 rounded-xl border border-gray-200/80 bg-gray-100/90 p-1"
        >
          <button
            type="button"
            aria-pressed={activeTab === "READY"}
            className={tabClass(activeTab === "READY")}
            onClick={() => onTabChange("READY")}
          >
            Ready for Scheduling
            <span className={countClass(activeTab === "READY")}>{readyCount}</span>
          </button>
          <button
            type="button"
            aria-pressed={activeTab === "SCHEDULED"}
            className={tabClass(activeTab === "SCHEDULED")}
            onClick={() => onTabChange("SCHEDULED")}
          >
            Scheduled
            <span className={countClass(activeTab === "SCHEDULED")}>
              {scheduledCount}
            </span>
          </button>
        </div>
        <p className="mt-1.5 text-xs text-gray-500">
          {activeTab === "READY"
            ? `${readyCount} approved application${readyCount === 1 ? "" : "s"} awaiting panel assignment and a schedule.`
            : `${scheduledCount} scheduled defense${scheduledCount === 1 ? "" : "s"} to inspect.`}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative">
          <Search
            className="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-gray-400"
            aria-hidden="true"
          />
          <Input
            aria-label="Search defenses"
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            placeholder="Search student, student number, or email…"
            className="border-gray-200 bg-gray-50/40 pl-8 focus:bg-white"
          />
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div>
            <Label
              className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase"
              htmlFor="defense-type-filter"
            >
              Defense Stage
            </Label>
            <select
              id="defense-type-filter"
              value={defenseType}
              onChange={(e) => onDefenseTypeChange(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-gray-50/50 px-2.5 py-1.5 text-xs font-medium text-[#333333] focus:border-[#e02b20] focus:bg-white focus:outline-none"
            >
              <option value="ALL">All Stages</option>
              <option value="TITLE_DEFENSE">Title Defense</option>
              <option value="PROPOSAL_DEFENSE">Proposal Defense</option>
              <option value="FINAL_DEFENSE">Final Defense</option>
            </select>
          </div>
          <div>
            <Label
              className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase"
              htmlFor="program-filter"
            >
              Program
            </Label>
            <select
              id="program-filter"
              value={programId}
              onChange={(e) => onProgramChange(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-gray-50/50 px-2.5 py-1.5 text-xs font-medium text-[#333333] focus:border-[#e02b20] focus:bg-white focus:outline-none"
            >
              <option value="ALL">All Programs</option>
              {programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.programName}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="min-h-[280px] space-y-3">
          {activeTab === "READY" ? (
            <ReadyList list={ready} filtered={filtered} />
          ) : (
            <ScheduledList list={scheduled} filtered={filtered} />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
