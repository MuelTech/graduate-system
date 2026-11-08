"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ClipboardCheck, Users, CalendarDays } from "lucide-react";
import { apiClientRequest } from "@/lib/api.client";
import { facultyKey } from "@/lib/faculty-access";
import type { PanelistDashboard } from "@/lib/panelist-dashboard";
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

export default function FacultyDashboard() {
  const { accountId, work, loading } = useFacultyAccess();
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
  if (loading || !work) return <FacultyAccessLoading />;
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
  const attention = (tasks.data?.needsAttention ?? []).filter((task) =>
    ["ADVISER_REQUEST", "ADVISER_MANUSCRIPT_REVIEW"].includes(task.category)
      ? work.myAdvisees.relevant
      : work.myDefenses.relevant,
  );
  return (
    <div className="space-y-6">
      <PageHeader
        title="Faculty Dashboard"
        description="Your academic work and next actions."
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
                    <h2 className="font-semibold text-(--earist-secondary)">
                      {area.title}
                    </h2>
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
      {detailed && (
        <Card>
          <CardHeader>
            <CardTitle role="heading" aria-level={2}>
              Needs Your Attention
            </CardTitle>
          </CardHeader>
          <CardContent>
            {tasks.isPending ? (
              <Skeleton className="h-24 w-full" />
            ) : tasks.isError ? (
              <div role="alert" className="space-y-3">
                <p>Unable to load your tasks.</p>
                <Button variant="outline" onClick={() => void tasks.refetch()}>
                  Retry tasks
                </Button>
              </div>
            ) : attention.length ? (
              <ul className="divide-y">
                {attention.slice(0, 5).map((task) => (
                  <li
                    key={task.id}
                    className="flex flex-col justify-between gap-3 py-4 sm:flex-row sm:items-center"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold break-words">{task.title}</p>
                      <p className="text-sm break-words text-(--earist-body-text)">
                        {task.studentName} · {task.statusText}
                      </p>
                    </div>
                    <Link
                      className="shrink-0 rounded px-2 py-1 font-semibold text-(--earist-primary) underline"
                      href={task.href}
                    >
                      {task.actionLabel}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-(--earist-body-text)">
                No tasks need your attention.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
