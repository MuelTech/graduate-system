"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { apiClientRequest } from "@/lib/api.client";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertCircle,
  CalendarClock,
  ChevronRight,
  ClipboardList,
  FileCheck2,
  GraduationCap,
  Inbox,
  RefreshCw,
  ShieldCheck,
  UserCheck,
} from "lucide-react";

/* ------------------------------------------------------------------ types */

type DegreeLevel = "MASTERS" | "DOCTORAL";
type ThesisStageKey = "TITLE" | "PROPOSAL" | "FINAL";

interface DashboardData {
  kpis: {
    enrolledStudents: number;
    defenseApplicationsToReview: number;
    defensesReadyForScheduling: number;
    corSubmissionsToReview: number;
  };
  needsAttention: {
    defenseApplications: number;
    corSubmissions: number;
    defensesReadyForScheduling: number;
    bridgingWaivers: number;
    adviserRequestsForDeanReview: number;
  };
  enrollment: {
    total: number;
    byDegreeLevel: { degreeLevel: DegreeLevel; count: number }[];
    topPrograms: {
      programName: string;
      degreeLevel: DegreeLevel;
      count: number;
    }[];
  };
  thesisPipeline: { stage: ThesisStageKey; count: number }[];
  upcomingDefenses: {
    scheduleId: string;
    studentName: string;
    studentNumber: string | null;
    programName: string;
    defenseType: string;
    defenseDate: string;
    defenseTime: string;
    venueOrLink: string | null;
    sessionStatus: string;
  }[];
  workflowMonitoring: {
    defensesAwaitingConclusion: number;
    rapReportsAwaitingSignatures: number;
  };
  recentActivity: {
    actor: string;
    action: string;
    detail: string | null;
    time: string;
  }[];
}

/* ------------------------------------------------------------- formatting */

const DEGREE_LEVEL_LABEL: Record<DegreeLevel, string> = {
  MASTERS: "Master's",
  DOCTORAL: "Doctoral",
};

const STAGE_LABEL: Record<ThesisStageKey, string> = {
  TITLE: "Title",
  PROPOSAL: "Proposal",
  FINAL: "Final",
};

const DEFENSE_TYPE_LABEL: Record<string, string> = {
  TITLE_DEFENSE: "Title Defense",
  PROPOSAL_DEFENSE: "Proposal Defense",
  FINAL_DEFENSE: "Final Defense",
};

/** Parse a wall-clock `YYYY-MM-DD` without UTC->local day shifting. */
function formatWallClockDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const minutes = Math.floor((Date.now() - then) / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} hr ago`;
  if (minutes < 10080) return `${Math.floor(minutes / 1440)} d ago`;
  return new Date(iso).toLocaleDateString();
}

/* ---------------------------------------------------------------- helpers */

function SectionCard({
  title,
  description,
  action,
  fullWidth = false,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  fullWidth?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card className={fullWidth ? "lg:col-span-2" : undefined}>
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
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-64 w-full rounded-xl" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Skeleton className="h-72 w-full rounded-xl" />
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Skeleton className="h-72 w-full rounded-xl" />
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
      <Skeleton className="h-56 w-full rounded-xl" />
    </div>
  );
}

/* ------------------------------------------------------------------- page */

export default function AdminDashboard() {
  const {
    data,
    isLoading,
    isError,
    isFetching,
    refetch,
  } = useQuery<DashboardData>({
    queryKey: ["adminDashboard"],
    queryFn: () => apiClientRequest("/admin/dashboard", { method: "GET" }),
  });

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (isError || !data) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <AlertCircle
            className="h-8 w-8 text-(--earist-secondary)"
            aria-hidden="true"
          />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-(--earist-primary)">
              Unable to load the dashboard
            </p>
            <p className="text-sm text-(--earist-body-text)">
              Something went wrong while loading operations data. Please try
              again.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw
              className={cn("mr-2 h-4 w-4", isFetching && "animate-spin")}
              aria-hidden="true"
            />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const kpiCards = [
    {
      label: "Enrolled Graduate Students",
      value: data.kpis.enrolledStudents,
      supporting: "Currently enrolled in the system",
      icon: GraduationCap,
    },
    {
      label: "Defense Applications to Review",
      value: data.kpis.defenseApplicationsToReview,
      supporting: "Awaiting your review",
      icon: ClipboardList,
    },
    {
      label: "Defenses Ready for Scheduling",
      value: data.kpis.defensesReadyForScheduling,
      supporting: "Approved, awaiting scheduling",
      icon: CalendarClock,
    },
    {
      label: "COR Submissions to Review",
      value: data.kpis.corSubmissionsToReview,
      supporting: "Awaiting verification",
      icon: FileCheck2,
    },
  ];

  const attentionQueues = [
    {
      key: "defenseApplications",
      label: "Defense Applications to Review",
      description: "Submitted defense applications awaiting your review.",
      href: "/admin/thesis/applications",
      count: data.needsAttention.defenseApplications,
      icon: ClipboardList,
    },
    {
      key: "corSubmissions",
      label: "COR Submissions to Review",
      description:
        "Certificate of Registration submissions awaiting verification.",
      href: "/admin/exam/cor",
      count: data.needsAttention.corSubmissions,
      icon: FileCheck2,
    },
    {
      key: "defensesReadyForScheduling",
      label: "Defenses Ready for Scheduling",
      description:
        "Approved applications ready for committee and schedule assignment.",
      href: "/admin/thesis/scheduling",
      count: data.needsAttention.defensesReadyForScheduling,
      icon: CalendarClock,
    },
    {
      key: "bridgingWaivers",
      label: "Bridging Waivers to Review",
      description: "Program-alignment waivers awaiting validation.",
      href: "/admin/exam/waiver",
      count: data.needsAttention.bridgingWaivers,
      icon: ShieldCheck,
    },
    {
      key: "adviserRequestsForDeanReview",
      label: "Adviser Requests for Dean Review",
      description: "Requests with adviser CONFORME awaiting a Dean decision.",
      href: "/admin/thesis/advisers",
      count: data.needsAttention.adviserRequestsForDeanReview,
      icon: UserCheck,
    },
  ];

  const totalAttention = attentionQueues.reduce((sum, q) => sum + q.count, 0);
  const pipelineTotal = data.thesisPipeline.reduce((s, r) => s + r.count, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Administrator Dashboard"
        description="Overview of Graduate School operations and items requiring attention."
      />

      {/* 1. Primary operational KPIs */}
      <section aria-label="Key operational metrics">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
        description="Admin work that currently requires action."
        action={
          totalAttention > 0 ? (
            <Badge className="bg-(--earist-primary) text-white">
              {totalAttention} {totalAttention === 1 ? "item" : "items"}
            </Badge>
          ) : null
        }
      >
        {totalAttention === 0 ? (
          <EmptyState message="No items currently need your attention." />
        ) : (
          <ul className="space-y-2">
            {attentionQueues.map((queue) => (
              <li key={queue.key}>
                <Link
                  href={queue.href}
                  className="flex items-center gap-3 rounded-lg bg-(--earist-surface-gray) p-3 transition-colors hover:bg-(--earist-surface-light-red) focus-visible:ring-2 focus-visible:ring-(--earist-primary) focus-visible:outline-none"
                >
                  <queue.icon
                    className="h-5 w-5 shrink-0 text-(--earist-secondary)"
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-(--earist-primary)">
                      {queue.label}
                    </span>
                    <span className="block text-xs text-(--earist-body-text)">
                      {queue.description}
                    </span>
                  </span>
                  <Badge
                    className={cn(
                      "shrink-0",
                      queue.count > 0
                        ? "bg-(--earist-primary) text-white"
                        : "bg-white text-(--earist-body-text)",
                    )}
                  >
                    {queue.count}
                  </Badge>
                  <ChevronRight
                    className="h-4 w-4 shrink-0 text-(--earist-body-text)"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {/* 3. Enrollment Snapshot + Thesis Pipeline */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionCard
          title="Enrollment Snapshot"
          description="Authoritative enrolled population by degree level and program."
        >
          <div className="space-y-4">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-(--earist-primary)">
                {data.enrollment.total}
              </span>
              <span className="text-sm text-(--earist-body-text)">
                enrolled students
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {data.enrollment.byDegreeLevel.map((level) => (
                <div
                  key={level.degreeLevel}
                  className="rounded-lg bg-(--earist-surface-gray) p-3"
                >
                  <p className="text-xs text-(--earist-body-text)">
                    {DEGREE_LEVEL_LABEL[level.degreeLevel]}
                  </p>
                  <p className="text-xl font-semibold text-foreground">
                    {level.count}
                  </p>
                </div>
              ))}
            </div>

            <div>
              <h3 className="mb-2 text-xs font-semibold text-(--earist-body-text)">
                Top programs by enrollment
              </h3>
              {data.enrollment.topPrograms.length === 0 ? (
                <p className="text-sm text-(--earist-body-text)">
                  No program enrollment data available yet.
                </p>
              ) : (
                <ul className="space-y-2">
                  {data.enrollment.topPrograms.map((program) => (
                    <li
                      key={`${program.degreeLevel}-${program.programName}`}
                      className="flex items-start justify-between gap-3"
                    >
                      <span className="min-w-0 flex-1 break-words text-sm text-foreground">
                        {program.programName}
                      </span>
                      <span className="flex shrink-0 items-center gap-2 pt-0.5">
                        <span className="text-xs text-(--earist-body-text)">
                          {DEGREE_LEVEL_LABEL[program.degreeLevel]}
                        </span>
                        <span className="text-sm font-semibold text-foreground">
                          {program.count}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Students by Thesis Stage"
          description="Share of students currently at each thesis stage."
        >
          {pipelineTotal === 0 ? (
            <EmptyState message="No thesis records are in progress yet." />
          ) : (
            <div className="space-y-3">
              {data.thesisPipeline.map((row) => {
                const percent =
                  pipelineTotal > 0
                    ? Math.round((row.count / pipelineTotal) * 100)
                    : 0;
                return (
                  <div key={row.stage}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="text-(--earist-body-text)">
                        {STAGE_LABEL[row.stage]}
                      </span>
                      <span className="font-semibold text-foreground">
                        {row.count}
                      </span>
                    </div>
                    <div
                      className="h-2 w-full overflow-hidden rounded-full bg-(--earist-surface-gray)"
                      role="presentation"
                    >
                      <div
                        className="h-full rounded-full bg-(--earist-primary)"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              <p className="pt-1 text-xs text-(--earist-body-text)">
                {pipelineTotal} students with an active thesis record.
              </p>
            </div>
          )}
        </SectionCard>
      </div>

      {/* 4. Upcoming Defenses + Workflow Monitoring */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionCard
          title="Upcoming Defenses"
          description="Next scheduled defense sessions."
        >
          {data.upcomingDefenses.length === 0 ? (
            <EmptyState message="No upcoming defenses are scheduled." />
          ) : (
            <ul className="space-y-2">
              {data.upcomingDefenses.map((defense) => (
                <li key={defense.scheduleId}>
                  <Link
                    href={`/admin/thesis/defense-records/${defense.scheduleId}`}
                    className="block rounded-lg bg-(--earist-surface-gray) p-3 transition-colors hover:bg-(--earist-surface-light-red) focus-visible:ring-2 focus-visible:ring-(--earist-primary) focus-visible:outline-none"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="text-sm font-medium text-(--earist-primary)">
                        {defense.studentName}
                      </p>
                      <span className="shrink-0 text-xs text-(--earist-body-text)">
                        {formatWallClockDate(defense.defenseDate)} ·{" "}
                        {defense.defenseTime}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-(--earist-body-text)">
                      {defense.programName} ·{" "}
                      {DEFENSE_TYPE_LABEL[defense.defenseType] ??
                        defense.defenseType}
                    </p>
                    {defense.venueOrLink ? (
                      <p className="mt-0.5 text-xs text-(--earist-body-text)">
                        {defense.venueOrLink}
                      </p>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title="Workflow Monitoring"
          description="Processes currently waiting on another responsible actor."
        >
          <div className="space-y-2">
            <div className="rounded-lg bg-(--earist-surface-gray) p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-(--earist-primary)">
                  Defenses Awaiting Conclusion
                </p>
                <span className="text-sm font-semibold text-foreground">
                  {data.workflowMonitoring.defensesAwaitingConclusion}
                </span>
              </div>
              <p className="mt-1 text-xs text-(--earist-body-text)">
                The formal result is recorded by the authorized session
                Chairman.
              </p>
              <Link
                href="/admin/thesis/defense-records"
                className="mt-1 inline-block text-xs font-medium text-(--earist-secondary) hover:underline"
              >
                View defense records
              </Link>
            </div>

            <div className="rounded-lg bg-(--earist-surface-gray) p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-(--earist-primary)">
                  RAP Reports Awaiting Signatures
                </p>
                <span className="text-sm font-semibold text-foreground">
                  {data.workflowMonitoring.rapReportsAwaitingSignatures}
                </span>
              </div>
              <p className="mt-1 text-xs text-(--earist-body-text)">
                Awaiting the required signatories; not yet finalized.
              </p>
              <Link
                href="/admin/thesis/rap-reports"
                className="mt-1 inline-block text-xs font-medium text-(--earist-secondary) hover:underline"
              >
                View RAP reports
              </Link>
            </div>
          </div>
        </SectionCard>
      </div>

      {/* 5. Recent System Activity */}
      <SectionCard
        title="Recent System Activity"
        description="Latest recorded actions across the system."
        fullWidth
      >
        {data.recentActivity.length === 0 ? (
          <EmptyState message="No recent system activity to show." />
        ) : (
          <ul className="space-y-1">
            {data.recentActivity.map((item, index) => (
              <li
                key={`${item.time}-${index}`}
                className="flex items-start justify-between gap-3 py-1.5"
              >
                <div className="min-w-0">
                  <p className="text-sm text-foreground">
                    <span className="font-medium">{item.actor}</span>{" "}
                    {item.action}
                  </p>
                  {item.detail ? (
                    <p className="text-xs text-(--earist-body-text)">
                      {item.detail}
                    </p>
                  ) : null}
                </div>
                <span className="shrink-0 text-xs text-(--earist-body-text)">
                  {formatRelativeTime(item.time)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
