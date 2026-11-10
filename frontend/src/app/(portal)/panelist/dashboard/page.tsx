"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Bell,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Clock,
  FileSignature,
  Gavel,
  PlayCircle,
  RefreshCw,
  UserCheck,
  Users,
  Video,
} from "lucide-react";
import { apiClientRequest } from "@/lib/api.client";
import { facultyKey } from "@/lib/faculty-access";
import {
  formatWallDate,
  formatWallTime,
  MAX_VISIBLE_NOTIFICATIONS,
  MAX_VISIBLE_OTHER_UPCOMING,
  MAX_VISIBLE_TASKS,
  projectFacultyDashboard,
  type PanelistAttentionCategory,
  type PanelistDashboard,
  type PanelistNotification,
} from "@/lib/panelist-dashboard";
import {
  useFacultyAccess,
  FacultyAccessLoading,
} from "@/components/faculty/faculty-access-provider";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const countLabel = (count: number, label: string) =>
  `${count} ${label}${count === 1 ? "" : "s"}`;

function categoryIcon(category: PanelistAttentionCategory) {
  switch (category) {
    case "EVALUATION":
      return (
        <ClipboardCheck
          aria-hidden="true"
          className="h-4 w-4 shrink-0 text-(--earist-primary)"
        />
      );
    case "CHAIRMAN_CONCLUSION":
    case "RAPPORTEUR_FINALIZE":
      return (
        <Gavel
          aria-hidden="true"
          className="h-4 w-4 shrink-0 text-(--earist-primary)"
        />
      );
    case "TITLE_START":
      return (
        <PlayCircle
          aria-hidden="true"
          className="h-4 w-4 shrink-0 text-(--earist-primary)"
        />
      );
    case "RAP_SIGNATURE":
      return (
        <FileSignature
          aria-hidden="true"
          className="h-4 w-4 shrink-0 text-(--earist-primary)"
        />
      );
    case "ADVISER_REQUEST":
    case "ADVISER_MANUSCRIPT_REVIEW":
      return (
        <UserCheck
          aria-hidden="true"
          className="h-4 w-4 shrink-0 text-(--earist-primary)"
        />
      );
  }
}

export default function FacultyDashboard() {
  const { accountId, work, loading } = useFacultyAccess();
  const [showAllTasks, setShowAllTasks] = useState(false);
  const [waitingOpen, setWaitingOpen] = useState(false);

  const detailed = Boolean(
    work?.myAdvisees.relevant || work?.myDefenses.relevant,
  );
  const tasks = useQuery<PanelistDashboard>({
    queryKey: facultyKey(accountId, "dashboard"),
    queryFn: ({ signal }) =>
      apiClientRequest("/thesis/defense/panelist/dashboard", {
        signal,
        cache: "no-store",
      }),
    enabled: detailed,
  });
  const notifications = useQuery<PanelistNotification[]>({
    queryKey: facultyKey(accountId, "notifications"),
    queryFn: ({ signal }) =>
      apiClientRequest("/notifications", {
        signal,
        cache: "no-store",
      }),
    enabled: Boolean(work),
  });

  if (loading || !work) return <FacultyAccessLoading />;

  const projection = projectFacultyDashboard(work, tasks.data);
  const areas = [
    ...(work.essayEvaluations.relevant
      ? [
          {
            title: "Essay Evaluations",
            description: "Review pending entrance-exam essays.",
            href: "/panelist/essay-evaluations",
            action: "Review Essays",
            icon: ClipboardCheck,
          },
        ]
      : []),
    ...(work.myAdvisees.relevant
      ? [
          {
            title: "My Advisees",
            description: [
              work.myAdvisees.activeAdviseeCount
                ? countLabel(
                    work.myAdvisees.activeAdviseeCount,
                    "active advisee",
                  )
                : "",
              work.myAdvisees.addressedRequestCount
                ? countLabel(
                    work.myAdvisees.addressedRequestCount,
                    "addressed request",
                  )
                : "",
              work.myAdvisees.issuedCertificationCount
                ? countLabel(
                    work.myAdvisees.issuedCertificationCount,
                    "issued certification",
                  )
                : "",
            ]
              .filter(Boolean)
              .join(" · "),
            href: "/panelist/advisees",
            action: "Open My Advisees",
            icon: Users,
          },
        ]
      : []),
    ...(work.myDefenses.relevant
      ? [
          {
            title: "My Defenses",
            description: countLabel(
              work.myDefenses.assignmentCount,
              "defense assignment",
            ),
            href: "/panelist/defenses",
            action: "Open My Defenses",
            icon: CalendarDays,
          },
        ]
      : []),
  ];

  const visibleTasks = showAllTasks
    ? projection.attention
    : projection.attention.slice(0, MAX_VISIBLE_TASKS);
  const hiddenTaskCount = Math.max(
    0,
    projection.attention.length - MAX_VISIBLE_TASKS,
  );
  const nextDefense = projection.upcomingDefenses[0] ?? null;
  const otherUpcoming = projection.upcomingDefenses.slice(
    1,
    1 + MAX_VISIBLE_OTHER_UPCOMING,
  );
  const visibleNotifications = Array.isArray(notifications.data)
    ? notifications.data.slice(0, MAX_VISIBLE_NOTIFICATIONS)
    : [];

  const refreshDashboard = () => {
    if (detailed) void tasks.refetch();
    void notifications.refetch();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Faculty Dashboard"
        description="Your academic work and next actions."
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={refreshDashboard}
            className="gap-2"
          >
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
            Refresh
          </Button>
        }
      />

      {!areas.length ? (
        <Card>
          <CardContent className="py-12 text-center text-(--earist-body-text)">
            No current academic work.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle role="heading" aria-level={2}>
              Your Work
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            {areas.map((area) => (
              <div
                key={area.title}
                className="flex flex-col gap-4 py-5 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <area.icon
                    aria-hidden="true"
                    className="mt-1 h-5 w-5 shrink-0 text-(--earist-primary)"
                  />
                  <div className="min-w-0">
                    <h3 className="font-semibold text-(--earist-secondary)">
                      {area.title}
                    </h3>
                    <p className="mt-1 text-sm text-(--earist-body-text)">
                      {area.description}
                    </p>
                  </div>
                </div>
                <Link
                  className="inline-flex shrink-0 items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold text-(--earist-primary) hover:bg-(--earist-surface-light-red)"
                  href={area.href}
                >
                  {area.action}
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </Link>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {(projection.showUpcomingDefensesKpi ||
        projection.showPendingTasksKpi) && (
        <div
          className={
            projection.showUpcomingDefensesKpi && projection.showPendingTasksKpi
              ? "grid grid-cols-1 gap-4 sm:grid-cols-2"
              : "grid grid-cols-1 gap-4 sm:max-w-md"
          }
        >
          {projection.showUpcomingDefensesKpi && (
            <Card data-testid="kpi-upcoming-defenses">
              <CardContent className="flex items-start justify-between gap-4 p-5">
                <div className="min-w-0">
                  <p className="text-xs font-medium tracking-wider text-(--earist-muted-text) uppercase">
                    Upcoming Defenses
                  </p>
                  {tasks.isPending ? (
                    <Skeleton className="mt-2 h-8 w-14" />
                  ) : (
                    <p className="mt-1 text-2xl font-bold text-(--earist-secondary)">
                      {tasks.isError
                        ? "—"
                        : (projection.upcomingDefensesCount ?? 0)}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-(--earist-body-text)">
                    Scheduled defense sessions assigned to you
                  </p>
                </div>
                <div className="rounded-lg bg-(--earist-surface-light-red) p-2.5 text-(--earist-primary)">
                  <CalendarDays aria-hidden="true" className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          )}

          {projection.showPendingTasksKpi && (
            <Card data-testid="kpi-pending-tasks">
              <CardContent className="flex items-start justify-between gap-4 p-5">
                <div className="min-w-0">
                  <p className="text-xs font-medium tracking-wider text-(--earist-muted-text) uppercase">
                    Pending Tasks
                  </p>
                  {tasks.isPending ? (
                    <Skeleton className="mt-2 h-8 w-14" />
                  ) : (
                    <p className="mt-1 text-2xl font-bold text-(--earist-secondary)">
                      {tasks.isError
                        ? "—"
                        : (projection.pendingTasksCount ?? 0)}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-(--earist-body-text)">
                    Actionable items needing your response
                  </p>
                </div>
                <div className="rounded-lg bg-(--earist-surface-light-red) p-2.5 text-(--earist-primary)">
                  <ClipboardCheck aria-hidden="true" className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {!tasks.isPending &&
        !tasks.isError &&
        projection.activeDefenses.length > 0 && (
          <Card
            data-testid="active-defense-card"
            className="border-(--earist-primary)/30 bg-(--earist-surface-light-red)/40"
          >
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle
                  role="heading"
                  aria-level={2}
                  className="flex items-center gap-2 text-base font-bold text-(--earist-primary)"
                >
                  <Video aria-hidden="true" className="h-4 w-4 shrink-0" />
                  Active Defense
                </CardTitle>
                <span className="inline-flex items-center rounded-full bg-(--earist-primary) px-2.5 py-0.5 text-xs font-semibold text-white">
                  In progress
                </span>
              </div>
            </CardHeader>
            <CardContent className="divide-y pt-0">
              {projection.activeDefenses.map((item) => (
                <div
                  key={item.scheduleId}
                  className="flex flex-col justify-between gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0">
                    <p className="font-semibold break-words text-(--earist-secondary)">
                      {item.studentName}
                    </p>
                    <p className="mt-0.5 text-sm break-words text-(--earist-body-text)">
                      {[item.stageLabel, item.roleLabel, item.programName]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <Link
                    href={item.href}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-(--earist-primary) px-3.5 py-2 text-xs font-semibold text-white hover:bg-(--earist-primary-dark)"
                  >
                    Open Defense Workspace
                    <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
                  </Link>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

      {projection.showNeedsAttention && (
        <Card data-testid="needs-attention-card">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
            <CardTitle role="heading" aria-level={2}>
              Needs Your Attention
            </CardTitle>
            {!tasks.isPending &&
              !tasks.isError &&
              projection.attention.length > 0 && (
                <span className="inline-flex items-center rounded-full bg-(--earist-surface-light-red) px-2.5 py-0.5 text-xs font-semibold text-(--earist-primary)">
                  {countLabel(projection.attention.length, "task")}
                </span>
              )}
          </CardHeader>
          <CardContent className="space-y-4">
            {tasks.isPending ? (
              <Skeleton className="h-24 w-full" />
            ) : tasks.isError ? (
              <div role="alert" className="space-y-3">
                <p>Unable to load your tasks.</p>
                <Button variant="outline" onClick={() => void tasks.refetch()}>
                  Retry tasks
                </Button>
              </div>
            ) : projection.attention.length ? (
              <div className="space-y-3">
                <ul className="divide-y">
                  {visibleTasks.map((task) => (
                    <li
                      key={task.id}
                      className="flex flex-col justify-between gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center"
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="mt-1 rounded-md bg-(--earist-surface-light-red) p-1.5">
                          {categoryIcon(task.category)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold break-words text-(--earist-secondary)">
                            {task.title}
                          </p>
                          <p className="mt-0.5 text-sm break-words text-(--earist-body-text)">
                            {[task.studentName, task.stage, task.responsibility]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                          <p className="mt-0.5 text-xs break-words text-(--earist-muted-text)">
                            {[
                              task.statusText,
                              task.date ? formatWallDate(task.date) : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        </div>
                      </div>
                      <Link
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold text-(--earist-primary) hover:bg-(--earist-surface-light-red)"
                        href={task.href}
                      >
                        {task.actionLabel}
                        <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
                      </Link>
                    </li>
                  ))}
                </ul>
                {hiddenTaskCount > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAllTasks((prev) => !prev)}
                  >
                    {showAllTasks
                      ? "Show fewer tasks"
                      : `Show ${countLabel(hiddenTaskCount, "more task")}`}
                  </Button>
                )}
              </div>
            ) : (
              <p className="text-sm text-(--earist-body-text)">
                No tasks need your attention.
              </p>
            )}

            {!tasks.isPending &&
              !tasks.isError &&
              projection.waiting.length > 0 && (
                <div
                  data-testid="waiting-on-others-section"
                  className="rounded-lg border border-dashed bg-(--earist-surface-neutral)/40 p-3"
                >
                  <button
                    type="button"
                    aria-expanded={waitingOpen}
                    onClick={() => setWaitingOpen((prev) => !prev)}
                    className="flex w-full items-center justify-between gap-2 text-left"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Clock
                        aria-hidden="true"
                        className="h-4 w-4 shrink-0 text-(--earist-muted-text)"
                      />
                      <span className="text-xs font-semibold text-(--earist-secondary)">
                        Waiting on Others
                      </span>
                      <span
                        data-testid="waiting-on-others-count"
                        className="inline-flex items-center rounded-full border bg-white px-2 py-0.5 text-xs font-medium text-(--earist-muted-text)"
                      >
                        {projection.waiting.length} waiting
                      </span>
                      <span className="text-xs text-(--earist-muted-text)">
                        Informational — not counted in Pending Tasks
                      </span>
                    </div>
                    {waitingOpen ? (
                      <ChevronUp
                        aria-hidden="true"
                        className="h-4 w-4 shrink-0 text-(--earist-muted-text)"
                      />
                    ) : (
                      <ChevronDown
                        aria-hidden="true"
                        className="h-4 w-4 shrink-0 text-(--earist-muted-text)"
                      />
                    )}
                  </button>

                  {waitingOpen && (
                    <ul className="mt-3 divide-y border-t pt-2">
                      {projection.waiting.map((item) => (
                        <li
                          key={item.id}
                          className="flex flex-col justify-between gap-2 py-2.5 first:pt-1 last:pb-0 sm:flex-row sm:items-center"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-semibold break-words text-(--earist-secondary)">
                              {[item.recordLabel, item.studentName]
                                .filter(Boolean)
                                .join(" — ")}
                            </p>
                            <p className="mt-0.5 text-xs break-words text-(--earist-body-text)">
                              {[
                                item.requirement,
                                item.responsibleRole
                                  ? `Awaiting ${item.responsibleRole}`
                                  : null,
                                item.statusText,
                                item.date ? formatWallDate(item.date) : null,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          </div>
                          {item.href && (
                            <Link
                              href={item.href}
                              className="shrink-0 text-xs font-semibold text-(--earist-primary) underline"
                            >
                              View record
                            </Link>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
          </CardContent>
        </Card>
      )}

      <div
        className={
          projection.showUpcomingDefensesSection
            ? "grid grid-cols-1 gap-6 lg:grid-cols-2"
            : "grid grid-cols-1 gap-6"
        }
      >
        {projection.showUpcomingDefensesSection && (
          <Card data-testid="upcoming-defenses-section">
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
              <CardTitle role="heading" aria-level={2}>
                Upcoming Defense Sessions
              </CardTitle>
              <Link
                href="/panelist/defenses"
                className="inline-flex items-center gap-1 text-xs font-semibold text-(--earist-primary) hover:underline"
              >
                View All Defenses
                <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
              </Link>
            </CardHeader>
            <CardContent className="space-y-4">
              {tasks.isPending ? (
                <Skeleton className="h-28 w-full" />
              ) : tasks.isError ? (
                <p className="text-sm text-(--earist-body-text)">
                  Unable to load upcoming defense sessions.
                </p>
              ) : nextDefense ? (
                <div className="space-y-4">
                  <div
                    data-testid="next-defense-highlight"
                    className="rounded-lg border bg-(--earist-surface-neutral)/40 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-semibold tracking-wider text-(--earist-primary) uppercase">
                        Next Defense
                      </span>
                      <span className="inline-flex items-center rounded-full border bg-white px-2.5 py-0.5 text-xs font-medium text-(--earist-secondary)">
                        {nextDefense.roleLabel}
                      </span>
                    </div>
                    <p className="mt-2 font-semibold break-words text-(--earist-secondary)">
                      {nextDefense.studentName}
                    </p>
                    <p className="mt-0.5 text-sm break-words text-(--earist-body-text)">
                      {[nextDefense.stageLabel, nextDefense.programName]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    <p className="mt-2 text-xs text-(--earist-body-text)">
                      {formatWallDate(nextDefense.defenseDate)} ·{" "}
                      {formatWallTime(nextDefense.defenseTime)}
                    </p>
                    {nextDefense.venueOrLink && (
                      <p className="mt-1 text-xs break-words text-(--earist-muted-text)">
                        Venue / Link: {nextDefense.venueOrLink}
                      </p>
                    )}
                    <div className="mt-3">
                      <Link
                        href={nextDefense.href}
                        className="inline-flex items-center gap-1.5 rounded-lg border bg-white px-3 py-1.5 text-xs font-semibold text-(--earist-primary) hover:bg-(--earist-surface-light-red)"
                      >
                        Open Defense Workspace
                        <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>

                  {otherUpcoming.length > 0 && (
                    <ul className="divide-y">
                      {otherUpcoming.map((item) => (
                        <li
                          key={item.scheduleId}
                          className="flex flex-col justify-between gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-semibold break-words text-(--earist-secondary)">
                              {item.studentName}
                            </p>
                            <p className="text-xs break-words text-(--earist-body-text)">
                              {[item.stageLabel, item.roleLabel]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                            <p className="text-xs text-(--earist-muted-text)">
                              {formatWallDate(item.defenseDate)} ·{" "}
                              {formatWallTime(item.defenseTime)}
                              {item.venueOrLink ? ` · ${item.venueOrLink}` : ""}
                            </p>
                          </div>
                          <Link
                            href={item.href}
                            className="shrink-0 text-xs font-semibold text-(--earist-primary) underline"
                          >
                            Open
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                <p className="text-sm text-(--earist-body-text)">
                  No upcoming defenses are scheduled.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        <Card data-testid="recent-notifications-section">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
            <CardTitle
              role="heading"
              aria-level={2}
              className="flex items-center gap-2"
            >
              <Bell
                aria-hidden="true"
                className="h-4 w-4 text-(--earist-primary)"
              />
              Recent Notifications
            </CardTitle>
            <Link
              href="/panelist/notifications"
              className="inline-flex items-center gap-1 text-xs font-semibold text-(--earist-primary) hover:underline"
            >
              View All Notifications
              <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
            </Link>
          </CardHeader>
          <CardContent>
            {notifications.isPending ? (
              <Skeleton className="h-24 w-full" />
            ) : notifications.isError ? (
              <div role="alert" className="space-y-3">
                <p className="text-sm text-(--earist-body-text)">
                  Unable to load notifications.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void notifications.refetch()}
                >
                  Retry notifications
                </Button>
              </div>
            ) : visibleNotifications.length > 0 ? (
              <ul className="divide-y">
                {visibleNotifications.map((item) => (
                  <li key={item.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-2.5">
                        {!item.isRead && (
                          <span
                            aria-label="Unread"
                            className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-(--earist-primary)"
                          />
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-semibold break-words text-(--earist-secondary)">
                            {item.title}
                          </p>
                          <p className="mt-0.5 text-xs break-words text-(--earist-body-text)">
                            {item.message}
                          </p>
                        </div>
                      </div>
                      <span className="shrink-0 text-xs text-(--earist-muted-text)">
                        {formatWallDate(item.createdAt.slice(0, 10))}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-(--earist-body-text)">
                No notifications to show.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
