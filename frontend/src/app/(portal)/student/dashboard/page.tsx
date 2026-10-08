"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { apiClientRequest } from "@/lib/api.client";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { useStudentThesisJourney } from "@/hooks/use-student-thesis-journey";
import {
  JOURNEY_STEP_ORDER,
  formatDefenseDate,
  formatDefenseTime,
  journeyLabelFor,
  sessionStatusLabel,
} from "@/lib/student-thesis-journey";
import {
  activeDefense,
  compExamStatusLabel,
  milestoneStateLabel,
  resolveDefenseVenue,
  resolveNextStep,
  type NextStepKind,
} from "@/lib/student-dashboard";
import type {
  JourneyStepView,
  StudentThesisJourney,
} from "@/types/student-thesis-journey";
import type { NotificationItem } from "@/types";
import {
  AlertCircle,
  ArrowRight,
  Bell,
  BookOpen,
  CalendarClock,
  ClipboardList,
  ExternalLink,
  FileText,
  Megaphone,
  Milestone,
  RefreshCw,
} from "lucide-react";

/* ------------------------------------------------------------------- types */

interface StudentOverview {
  user?: { firstName?: string; lastName?: string };
  program?: { programName?: string } | null;
  studentNumber?: string | null;
  compExamRecords?: Array<{ status?: string }>;
}

interface MemoItem {
  id: string;
  title: string;
  content: string;
  createdAt: string;
}

const MAX_NOTIFICATIONS = 3;
const MAX_ANNOUNCEMENTS = 2;

/* -------------------------------------------------------------- primitives */

function SectionError({
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
        "flex flex-col items-center gap-2 text-center",
        compact ? "py-4" : "py-8",
      )}
    >
      <AlertCircle
        className="h-6 w-6 text-(--earist-secondary)"
        aria-hidden="true"
      />
      <p className="text-sm text-(--earist-body-text)">{label}</p>
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

const NEXT_STEP_BADGE: Record<NextStepKind, string> = {
  ACTION: "bg-(--earist-primary) text-white",
  WAITING: "bg-amber-100 text-amber-800",
  LOCKED: "bg-gray-200 text-gray-700",
  REJECTED: "bg-amber-100 text-amber-800",
  FAILED: "bg-red-100 text-red-700",
  REVISION: "bg-amber-100 text-amber-800",
  CANCELLED: "bg-gray-200 text-gray-700",
  COMPLETED: "bg-emerald-100 text-emerald-700",
  UNAVAILABLE: "bg-gray-100 text-gray-700",
};

function milestoneTone(
  step: JourneyStepView | undefined,
  strikeRequired: boolean,
): string {
  if (!step) return "bg-gray-100 text-gray-500";
  if (step.key === "STRIKE" && !strikeRequired) {
    return "bg-gray-100 text-gray-600";
  }
  switch (step.state) {
    case "COMPLETED":
      return "bg-emerald-50 text-emerald-700";
    case "CURRENT":
      return "bg-(--earist-surface-light-red) text-(--earist-primary)";
    case "AVAILABLE":
      return "bg-sky-50 text-sky-700";
    case "WAITING":
      return "bg-amber-100 text-amber-800";
    case "LOCKED":
      return "bg-gray-100 text-gray-600";
    default:
      return "bg-gray-100 text-gray-600";
  }
}

/* ------------------------------------------------------- next-step content */

function NextStepContent({
  journey,
}: {
  journey: StudentThesisJourney;
}) {
  const nextStep = resolveNextStep(journey);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-lg font-semibold text-foreground sm:text-xl">
          {nextStep.heading}
        </h3>
        {nextStep.statusLabel ? (
          <Badge
            className={cn("shrink-0", NEXT_STEP_BADGE[nextStep.kind])}
          >
            {nextStep.statusLabel}
          </Badge>
        ) : null}
      </div>
      <p className="max-w-3xl text-sm text-(--earist-body-text)">
        {nextStep.explanation}
      </p>
      <div className="flex flex-wrap items-center gap-3 pt-1">
        {nextStep.action ? (
          <Link
            href={nextStep.action.href}
            className={cn(
              buttonVariants({ size: "default" }),
              "justify-center",
            )}
          >
            {nextStep.action.label}
            <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
          </Link>
        ) : null}
        {nextStep.secondaryAction ? (
          <Link
            href={nextStep.secondaryAction.href}
            className="text-sm font-medium text-(--earist-secondary) hover:underline"
          >
            {nextStep.secondaryAction.label}
          </Link>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- page */

export default function StudentDashboard() {
  const overviewQuery = useQuery<StudentOverview>({
    queryKey: ["student", "journey-overview"],
    queryFn: async () =>
      (await apiClientRequest("/student/journey")) as StudentOverview,
  });

  const journeyQuery = useStudentThesisJourney();

  const notificationsQuery = useQuery<NotificationItem[]>({
    queryKey: ["notifications"],
    queryFn: async () => {
      const res = await apiClientRequest("/notifications");
      return Array.isArray(res) ? (res as NotificationItem[]) : [];
    },
  });

  const memosQuery = useQuery<MemoItem[]>({
    queryKey: ["student-memos"],
    queryFn: async () => {
      const res = await apiClientRequest("/memos");
      return Array.isArray(res) ? (res as MemoItem[]) : [];
    },
  });

  const overview = overviewQuery.data;
  const firstName = overview?.user?.firstName?.trim() || "Student";
  const programName = overview?.program?.programName?.trim() || "Graduate Program";
  const studentNumber = overview?.studentNumber?.trim() || null;
  const compExamStatus = overview?.compExamRecords?.[0]?.status ?? null;

  const journey = journeyQuery.data;
  const currentStep = journey?.currentStep
    ? journey.steps.find((s) => s.key === journey.currentStep)
    : null;
  const currentStageLabel = journey
    ? currentStep
      ? journeyLabelFor(currentStep.key, currentStep.label)
      : "Completed"
    : null;

  const active = journey ? activeDefense(journey) : null;
  const recentNotifications = (notificationsQuery.data ?? []).slice(
    0,
    MAX_NOTIFICATIONS,
  );
  const recentAnnouncements = (memosQuery.data ?? []).slice(
    0,
    MAX_ANNOUNCEMENTS,
  );

  return (
    <div className="space-y-6">
      {/* A. Welcome + identity */}
      {overviewQuery.isLoading ? (
        <div className="space-y-2" aria-busy="true" aria-live="polite">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-56 max-w-full" />
          <Skeleton className="h-3 w-40" />
        </div>
      ) : (
        <PageHeader
          title={`Welcome back, ${firstName}!`}
          description={programName}
        >
          {studentNumber ? (
            <p className="text-xs text-(--earist-body-text)">
              Student Number: {studentNumber}
            </p>
          ) : null}
        </PageHeader>
      )}

      {overviewQuery.isError ? (
        <p className="text-xs text-(--earist-body-text)">
          Some account details could not be loaded.
        </p>
      ) : null}

      {/* B. Academic status summary */}
      <section aria-label="Academic status summary">
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardContent className="space-y-1 p-4">
              <p className="flex items-center gap-2 text-xs font-semibold text-(--earist-body-text)">
                <BookOpen className="h-4 w-4" aria-hidden="true" />
                Comprehensive Examination
              </p>
              {overviewQuery.isLoading ? (
                <Skeleton className="h-7 w-24" />
              ) : overviewQuery.isError ? (
                <p className="text-sm text-(--earist-body-text)">Unavailable</p>
              ) : (
                <p className="text-2xl font-bold text-(--earist-primary)">
                  {compExamStatusLabel(compExamStatus)}
                </p>
              )}
              <p className="text-xs text-(--earist-body-text)">
                Required before Title Defense.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-1 p-4">
              <p className="flex items-center gap-2 text-xs font-semibold text-(--earist-body-text)">
                <Milestone className="h-4 w-4" aria-hidden="true" />
                Current Thesis Stage
              </p>
              {journeyQuery.isLoading ? (
                <Skeleton className="h-7 w-32" />
              ) : journeyQuery.isError ? (
                <p className="text-sm text-(--earist-body-text)">Unavailable</p>
              ) : (
                <p className="text-2xl font-bold text-(--earist-primary)">
                  {currentStageLabel}
                </p>
              )}
              <p className="text-xs text-(--earist-body-text)">
                Based on your Student Thesis Journey.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* C. Your Next Step — primary focus */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardList
              className="h-4 w-4 text-(--earist-secondary)"
              aria-hidden="true"
            />
            Your Next Step
          </CardTitle>
        </CardHeader>
        <CardContent>
          {journeyQuery.isLoading ? (
            <div className="space-y-3" aria-busy="true">
              <Skeleton className="h-6 w-64" />
              <Skeleton className="h-4 w-full max-w-2xl" />
              <Skeleton className="h-9 w-44" />
            </div>
          ) : journeyQuery.isError || !journey ? (
            <SectionError
              label="Unable to load your current thesis status."
              onRetry={() => journeyQuery.refetch()}
              retrying={journeyQuery.isRefetching}
            />
          ) : (
            <NextStepContent journey={journey} />
          )}
        </CardContent>
      </Card>

      {/* D. Thesis Journey overview */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText
                className="h-4 w-4 text-(--earist-secondary)"
                aria-hidden="true"
              />
              Thesis Journey
            </CardTitle>
            <Link
              href="/student/thesis"
              className="shrink-0 text-xs font-medium text-(--earist-secondary) hover:underline"
            >
              Open Thesis Journey
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {journeyQuery.isLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          ) : journeyQuery.isError || !journey ? (
            <SectionError
              label="Unable to load your thesis milestones."
              onRetry={() => journeyQuery.refetch()}
              retrying={journeyQuery.isRefetching}
              compact
            />
          ) : (
            <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {JOURNEY_STEP_ORDER.map((key, index) => {
                const step = journey.steps.find((s) => s.key === key);
                const label = journeyLabelFor(key, step?.label);
                const stateLabel = step
                  ? milestoneStateLabel(step, journey.policy.strikeRequired)
                  : "—";
                return (
                  <li
                    key={key}
                    className="rounded-lg border border-(--earist-border-gray) p-3"
                  >
                    <p className="text-[11px] font-semibold text-(--earist-body-text)">
                      Step {index + 1}
                    </p>
                    <p className="mt-0.5 text-sm font-medium break-words text-foreground">
                      {label}
                    </p>
                    <span
                      className={cn(
                        "mt-2 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold",
                        milestoneTone(step, journey.policy.strikeRequired),
                      )}
                    >
                      {stateLabel}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </CardContent>
      </Card>

      {/* E. Defense Schedule — conditional */}
      {active ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock
                className="h-4 w-4 text-(--earist-secondary)"
                aria-hidden="true"
              />
              Defense Schedule
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm font-semibold text-foreground">
              {active.label}
            </p>
            <dl className="grid gap-x-6 gap-y-3 text-xs sm:grid-cols-3">
              <div className="min-w-0">
                <dt className="text-(--earist-body-text)">Date</dt>
                <dd className="mt-0.5 font-medium break-words text-foreground">
                  {formatDefenseDate(active.session.defenseDate)}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-(--earist-body-text)">Time</dt>
                <dd className="mt-0.5 font-medium break-words text-foreground">
                  {formatDefenseTime(active.session.defenseTime)}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-(--earist-body-text)">Session Status</dt>
                <dd className="mt-0.5 font-medium text-foreground">
                  {sessionStatusLabel(active.session.sessionStatus)}
                </dd>
              </div>
              <div className="min-w-0 sm:col-span-3">
                <dt className="text-(--earist-body-text)">
                  Venue / Meeting Details
                </dt>
                <dd className="mt-0.5 font-medium break-words text-foreground">
                  <ScheduleVenue venueOrLink={active.session.venueOrLink} />
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      ) : null}

      {/* F. Recent updates */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Bell
                  className="h-4 w-4 text-(--earist-secondary)"
                  aria-hidden="true"
                />
                Recent Notifications
              </CardTitle>
              <Link
                href="/student/notifications"
                className="shrink-0 text-xs font-medium text-(--earist-secondary) hover:underline"
              >
                View All
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {notificationsQuery.isLoading ? (
              <div className="space-y-2" aria-busy="true">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-lg" />
                ))}
              </div>
            ) : notificationsQuery.isError ? (
              <SectionError
                label="Unable to load notifications."
                onRetry={() => notificationsQuery.refetch()}
                retrying={notificationsQuery.isFetching}
                compact
              />
            ) : recentNotifications.length === 0 ? (
              <p className="py-4 text-sm text-(--earist-body-text)">
                No notifications to show.
              </p>
            ) : (
              <ul className="space-y-2">
                {recentNotifications.map((n) => (
                  <li
                    key={n.id}
                    className="rounded-lg border border-(--earist-border-gray) p-3"
                  >
                    <p className="text-sm font-medium text-foreground">
                      {!n.isRead ? (
                        <span
                          className="mr-2 inline-block h-2 w-2 rounded-full bg-(--earist-primary) align-middle"
                          aria-label="Unread"
                        />
                      ) : null}
                      {n.title}
                    </p>
                    {n.message ? (
                      <p className="mt-1 line-clamp-2 text-xs text-(--earist-body-text)">
                        {n.message}
                      </p>
                    ) : null}
                    <p className="mt-1 text-[11px] text-(--earist-body-text)">
                      {n.createdAt
                        ? new Date(n.createdAt).toLocaleDateString()
                        : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Megaphone
                  className="h-4 w-4 text-(--earist-secondary)"
                  aria-hidden="true"
                />
                Announcements
              </CardTitle>
              <Link
                href="/student/announcements"
                className="shrink-0 text-xs font-medium text-(--earist-secondary) hover:underline"
              >
                View All
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {memosQuery.isLoading ? (
              <div className="space-y-2" aria-busy="true">
                {Array.from({ length: 2 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-lg" />
                ))}
              </div>
            ) : memosQuery.isError ? (
              <SectionError
                label="Unable to load announcements."
                onRetry={() => memosQuery.refetch()}
                retrying={memosQuery.isFetching}
                compact
              />
            ) : recentAnnouncements.length === 0 ? (
              <p className="py-4 text-sm text-(--earist-body-text)">
                No announcements to show.
              </p>
            ) : (
              <ul className="space-y-2">
                {recentAnnouncements.map((memo) => (
                  <li
                    key={memo.id}
                    className="rounded-lg border border-(--earist-border-gray) p-3"
                  >
                    <p className="text-sm font-medium text-foreground">
                      {memo.title}
                    </p>
                    {memo.content ? (
                      <p className="mt-1 line-clamp-2 text-xs text-(--earist-body-text)">
                        {memo.content}
                      </p>
                    ) : null}
                    <p className="mt-1 text-[11px] text-(--earist-body-text)">
                      {memo.createdAt
                        ? new Date(memo.createdAt).toLocaleDateString()
                        : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* Venue / meeting details: only a verified whole HTTP(S) URL is clickable. */
function ScheduleVenue({
  venueOrLink,
}: {
  venueOrLink: string | null | undefined;
}) {
  const venue = resolveDefenseVenue(venueOrLink);
  if (venue.kind === "none") {
    return (
      <span className="font-normal text-(--earist-body-text)">
        Not provided
      </span>
    );
  }
  if (venue.kind === "physical") {
    return <span className="font-normal">{venue.text}</span>;
  }
  return (
    <a
      href={venue.url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 font-medium break-all text-(--earist-secondary) hover:underline focus-visible:ring-2 focus-visible:ring-(--earist-primary) focus-visible:outline-none"
    >
      <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      Open Meeting Link
    </a>
  );
}
