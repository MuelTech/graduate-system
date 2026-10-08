"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { apiClientRequest } from "@/lib/api.client";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CalendarClock,
  ChevronRight,
  CircleAlert,
  CirclePlay,
  ClipboardList,
  Clock,
  FileSignature,
  FileText,
  Gavel,
  Inbox,
  MapPin,
  NotebookPen,
  PenLine,
  RefreshCw,
  UserCheck,
} from "lucide-react";
import {
  MAX_VISIBLE_NOTIFICATIONS,
  MAX_VISIBLE_OTHER_UPCOMING,
  MAX_VISIBLE_TASKS,
  MAX_VISIBLE_WAITING,
  formatWallDate,
  formatWallTime,
  panelistDashboardQueryKey,
  type ActiveDefenseItem,
  type PanelistAttentionCategory,
  type PanelistAttentionTask,
  type PanelistDashboard,
  type PanelistNotification,
  type UpcomingDefenseItem,
  type WaitingItem,
} from "@/lib/panelist-dashboard";

const CATEGORY_ICON: Record<PanelistAttentionCategory, typeof ClipboardList> = {
  EVALUATION: PenLine,
  CHAIRMAN_CONCLUSION: Gavel,
  RAPPORTEUR_FINALIZE: NotebookPen,
  TITLE_START: CirclePlay,
  RAP_SIGNATURE: FileSignature,
  ADVISER_REQUEST: UserCheck,
  ADVISER_MANUSCRIPT_REVIEW: FileText,
};

/* ---------------------------------------------------------------- surfaces */

function SectionCard({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <h2 className="text-base font-semibold text-(--earist-secondary)">
              {title}
            </h2>
            {description ? (
              <p className="text-xs text-(--earist-body-text)">{description}</p>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-6 text-center">
      <Inbox
        className="h-6 w-6 text-(--earist-body-text)/40"
        aria-hidden="true"
      />
      <p className="text-sm text-(--earist-body-text)">{message}</p>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-64 w-full rounded-xl" />
      <Skeleton className="h-48 w-full rounded-xl" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
      <Skeleton className="h-56 w-full rounded-xl" />
    </div>
  );
}

function LoadError({
  label,
  onRetry,
  retrying,
  compact = false,
}: {
  label: string;
  onRetry: () => void;
  retrying?: boolean;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 text-center",
        compact ? "py-6" : "py-12",
      )}
    >
      <CircleAlert
        className="h-8 w-8 text-(--earist-secondary)"
        aria-hidden="true"
      />
      <div className="space-y-1">
        <p className="text-sm font-semibold text-(--earist-primary)">{label}</p>
        <p className="text-sm text-(--earist-body-text)">
          Something went wrong while loading this section. Please try again.
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={onRetry}
        disabled={retrying}
      >
        <RefreshCw
          className={cn("mr-2 h-4 w-4", retrying && "animate-spin")}
          aria-hidden="true"
        />
        Retry
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------- rows */

function TaskRow({ task }: { task: PanelistAttentionTask }) {
  const Icon = CATEGORY_ICON[task.category] ?? ClipboardList;
  return (
    <li className="flex flex-col gap-3 rounded-lg bg-(--earist-surface-gray) p-3 sm:flex-row sm:items-center">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-(--earist-secondary)">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-sm font-medium text-(--earist-primary)">
          {task.title}
        </p>
        <p className="text-xs text-(--earist-body-text)">
          {task.studentName ?? "Academic record"}
          {task.stage ? ` · ${task.stage}` : ""}
          {task.responsibility ? ` · ${task.responsibility}` : ""}
        </p>
        <p className="text-xs text-(--earist-body-text)">
          {task.statusText}
          {task.date ? ` · ${formatWallDate(task.date)}` : ""}
        </p>
      </div>
      <Link
        href={task.href}
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "shrink-0 justify-between",
        )}
      >
        {task.actionLabel}
        <ChevronRight className="ml-1 h-4 w-4" aria-hidden="true" />
      </Link>
    </li>
  );
}

function ActiveDefenseRow({ item }: { item: ActiveDefenseItem }) {
  return (
    <li>
      <Link
        href={item.href}
        className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-(--earist-surface-gray) p-3 transition-colors hover:bg-(--earist-surface-light-red) focus-visible:ring-2 focus-visible:ring-(--earist-primary) focus-visible:outline-none"
      >
        <span className="min-w-0">
          <span className="block text-sm font-medium text-(--earist-primary)">
            {item.studentName}
          </span>
          <span className="block text-xs text-(--earist-body-text)">
            {item.stageLabel} · Your role: {item.roleLabel}
            {item.programName ? ` · ${item.programName}` : ""}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <Badge className="bg-amber-100 text-amber-800">
            {item.sessionStatusLabel}
          </Badge>
          <ChevronRight
            className="h-4 w-4 text-(--earist-body-text)"
            aria-hidden="true"
          />
        </span>
      </Link>
    </li>
  );
}

function UpcomingDefenseSummary({ item }: { item: UpcomingDefenseItem }) {
  return (
    <li>
      <Link
        href={item.href}
        className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-(--earist-surface-gray) p-3 transition-colors hover:bg-(--earist-surface-light-red) focus-visible:ring-2 focus-visible:ring-(--earist-primary) focus-visible:outline-none"
      >
        <span className="min-w-0">
          <span className="block text-sm font-medium text-(--earist-primary)">
            {item.studentName}
          </span>
          <span className="block text-xs text-(--earist-body-text)">
            {item.stageLabel} · {item.roleLabel}
          </span>
        </span>
        <span className="shrink-0 text-right text-xs text-(--earist-body-text)">
          {formatWallDate(item.defenseDate)} · {formatWallTime(item.defenseTime)}
        </span>
      </Link>
    </li>
  );
}

function WaitingRow({ item }: { item: WaitingItem }) {
  const body = (
    <>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">
          {item.studentName ?? item.recordLabel}
        </span>
        <span className="block text-xs text-(--earist-body-text)">
          {item.recordLabel} · {item.requirement}
        </span>
        <span className="block text-xs text-(--earist-body-text)">
          {item.statusText} · Responsible: {item.responsibleRole}
          {item.date ? ` · ${formatWallDate(item.date)}` : ""}
        </span>
      </span>
    </>
  );
  if (!item.href) {
    return (
      <li className="rounded-lg bg-(--earist-surface-gray) p-3">{body}</li>
    );
  }
  return (
    <li>
      <Link
        href={item.href}
        className="flex items-center justify-between gap-2 rounded-lg bg-(--earist-surface-gray) p-3 transition-colors hover:bg-(--earist-surface-light-red) focus-visible:ring-2 focus-visible:ring-(--earist-primary) focus-visible:outline-none"
      >
        {body}
        <ChevronRight
          className="h-4 w-4 shrink-0 text-(--earist-body-text)"
          aria-hidden="true"
        />
      </Link>
    </li>
  );
}

/* ------------------------------------------------------------------- page */

export default function PanelistDashboard() {
  const [showAllTasks, setShowAllTasks] = useState(false);

  const {
    data,
    isLoading,
    isError,
    isFetching,
    refetch,
  } = useQuery<PanelistDashboard>({
    queryKey: panelistDashboardQueryKey,
    queryFn: () =>
      apiClientRequest(
        "/thesis/defense/panelist/dashboard",
      ) as Promise<PanelistDashboard>,
    refetchInterval: 30_000,
  });

  const {
    data: notifications = [],
    isLoading: notificationsLoading,
    isError: notificationsError,
    isFetching: notificationsFetching,
    refetch: refetchNotifications,
  } = useQuery<PanelistNotification[]>({
    queryKey: ["notifications"],
    queryFn: async () => {
      const res = await apiClientRequest("/notifications");
      return Array.isArray(res) ? (res as PanelistNotification[]) : [];
    },
    refetchInterval: 30_000,
  });

  const refreshing = isFetching || notificationsFetching;

  const refresh = () => {
    void refetch();
    void refetchNotifications();
  };

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (isError || !data) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Dashboard"
          description="Overview of your assigned defenses and academic responsibilities."
        />
        <Card>
          <CardContent>
            <LoadError
              label="Unable to load the dashboard"
              onRetry={refresh}
              retrying={refreshing}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  const { kpis, needsAttention, activeDefenses, upcomingDefenses, waitingOnOthers } =
    data;
  const nextDefense = upcomingDefenses[0] ?? null;
  const otherUpcoming = upcomingDefenses.slice(1, 1 + MAX_VISIBLE_OTHER_UPCOMING);
  const visibleTasks = showAllTasks
    ? needsAttention
    : needsAttention.slice(0, MAX_VISIBLE_TASKS);
  const hiddenTaskCount = needsAttention.length - visibleTasks.length;
  const recentNotifications = notifications.slice(0, MAX_VISIBLE_NOTIFICATIONS);
  const visibleWaiting = waitingOnOthers.slice(0, MAX_VISIBLE_WAITING);

  const kpiCards = [
    {
      label: "Upcoming Defenses",
      value: kpis.upcomingDefenses,
      supporting: "Future scheduled sessions assigned to you",
      icon: CalendarClock,
    },
    {
      label: "Pending Tasks",
      value: kpis.pendingTasks,
      supporting: "Actions currently requiring you",
      icon: ClipboardList,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Overview of your assigned defenses and academic responsibilities."
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={refreshing}
          >
            <RefreshCw
              className={cn("mr-2 h-4 w-4", refreshing && "animate-spin")}
              aria-hidden="true"
            />
            Refresh
          </Button>
        }
      />

      {/* 1. Summary KPIs */}
      <section aria-label="Summary metrics">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {kpiCards.map((kpi) => (
            <Card key={kpi.label}>
              <CardContent className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <p className="text-xs font-semibold text-(--earist-body-text)">
                    {kpi.label}
                  </p>
                  <p className="text-3xl font-bold text-(--earist-primary)">
                    {kpi.value}
                  </p>
                  <p className="text-xs text-(--earist-body-text)">
                    {kpi.supporting}
                  </p>
                </div>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-(--earist-surface-gray) text-(--earist-secondary)">
                  <kpi.icon className="h-5 w-5" aria-hidden="true" />
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* 2. Needs Your Attention */}
      <SectionCard
        title="Needs Your Attention"
        description="Your actionable academic responsibilities."
        action={
          needsAttention.length > 0 ? (
            <Badge className="bg-(--earist-primary) text-white">
              {needsAttention.length}{" "}
              {needsAttention.length === 1 ? "task" : "tasks"}
            </Badge>
          ) : null
        }
      >
        {needsAttention.length === 0 ? (
          <EmptyState message="Nothing currently requires your action." />
        ) : (
          <div className="space-y-3">
            <ul className="space-y-2">
              {visibleTasks.map((task) => (
                <TaskRow key={task.id} task={task} />
              ))}
            </ul>
            {needsAttention.length > MAX_VISIBLE_TASKS ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowAllTasks((v) => !v)}
                aria-expanded={showAllTasks}
              >
                {showAllTasks
                  ? "Show fewer tasks"
                  : `Show ${hiddenTaskCount} more ${
                      hiddenTaskCount === 1 ? "task" : "tasks"
                    }`}
              </Button>
            ) : null}
          </div>
        )}
      </SectionCard>

      {/* 3. Active Defense (conditional) */}
      {activeDefenses.length > 0 ? (
        <SectionCard
          title="Active Defense"
          description="Sessions currently in progress."
        >
          <ul className="space-y-2">
            {activeDefenses.map((item) => (
              <ActiveDefenseRow key={item.scheduleId} item={item} />
            ))}
          </ul>
        </SectionCard>
      ) : null}

      {/* 4. Upcoming Defense Sessions */}
      <SectionCard
        title="Upcoming Defense Sessions"
        description="Your next scheduled assigned defenses."
        action={
          <Link
            href="/panelist/defenses"
            className="text-xs font-medium text-(--earist-secondary) hover:underline"
          >
            View All Defenses
          </Link>
        }
      >
        {!nextDefense ? (
          <EmptyState message="No upcoming defenses are scheduled." />
        ) : (
          <div className="space-y-3">
            <div className="rounded-xl border border-(--earist-border-gray) bg-white p-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <Badge className="bg-(--earist-primary) text-white">
                  Next Defense
                </Badge>
                <Badge className="bg-amber-100 text-amber-800">
                  {nextDefense.sessionStatusLabel}
                </Badge>
              </div>
              <p className="text-base font-semibold text-foreground">
                {nextDefense.studentName}
                {nextDefense.studentNumber
                  ? ` · ${nextDefense.studentNumber}`
                  : ""}
              </p>
              <p className="text-sm text-(--earist-body-text)">
                {nextDefense.stageLabel} · Your role: {nextDefense.roleLabel}
                {nextDefense.programName ? ` · ${nextDefense.programName}` : ""}
              </p>
              <div className="mt-3 grid gap-1 text-xs text-(--earist-body-text) sm:grid-cols-3">
                <p className="flex items-center gap-1.5">
                  <CalendarClock
                    className="h-3.5 w-3.5 shrink-0"
                    aria-hidden="true"
                  />
                  {formatWallDate(nextDefense.defenseDate)}
                </p>
                <p className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {formatWallTime(nextDefense.defenseTime)}
                </p>
                <p className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span className="truncate">
                    {nextDefense.venueOrLink || "To be announced"}
                  </span>
                </p>
              </div>
              <Link
                href={nextDefense.href}
                className={cn(
                  buttonVariants({ size: "sm" }),
                  "mt-3 w-full bg-(--earist-primary) hover:bg-(--earist-primary)/90 sm:w-auto",
                )}
              >
                Open Defense Workspace
                <ChevronRight className="ml-2 h-4 w-4" aria-hidden="true" />
              </Link>
            </div>

            {otherUpcoming.length > 0 ? (
              <ul className="space-y-2">
                {otherUpcoming.map((item) => (
                  <UpcomingDefenseSummary key={item.scheduleId} item={item} />
                ))}
              </ul>
            ) : null}
          </div>
        )}
      </SectionCard>

      {/* 5. Waiting on Others */}
      <SectionCard
        title="Waiting on Others"
        description="Records that cannot progress until another authorized actor acts."
      >
        {visibleWaiting.length === 0 ? (
          <EmptyState message="Nothing is currently waiting on another actor." />
        ) : (
          <ul className="space-y-2">
            {visibleWaiting.map((item) => (
              <WaitingRow key={item.id} item={item} />
            ))}
          </ul>
        )}
      </SectionCard>

      {/* 6. Recent Notifications */}
      <SectionCard
        title="Recent Notifications"
        description="Your latest notification records."
        action={
          <Link
            href="/panelist/notifications"
            className="text-xs font-medium text-(--earist-secondary) hover:underline"
          >
            View all notifications
          </Link>
        }
      >
        {notificationsLoading ? (
          <div className="space-y-2" aria-busy="true">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        ) : notificationsError ? (
          <LoadError
            label="Unable to load notifications"
            onRetry={() => void refetchNotifications()}
            retrying={notificationsFetching}
            compact
          />
        ) : recentNotifications.length === 0 ? (
          <EmptyState message="No notifications to show." />
        ) : (
          <ul className="space-y-2">
            {recentNotifications.map((n) => (
              <li
                key={n.id}
                className="rounded-lg border border-(--earist-border-gray) p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium text-foreground">
                    {n.isRead === false ? (
                      <span
                        className="mr-2 inline-block h-2 w-2 rounded-full bg-(--earist-primary) align-middle"
                        aria-label="Unread"
                      />
                    ) : null}
                    {n.title}
                  </p>
                  <span className="shrink-0 text-[11px] text-(--earist-body-text)">
                    {n.createdAt ? formatWallDate(n.createdAt.slice(0, 10)) : ""}
                  </span>
                </div>
                {n.message ? (
                  <p className="mt-1 text-xs text-(--earist-body-text)">
                    {n.message}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

    </div>
  );
}
