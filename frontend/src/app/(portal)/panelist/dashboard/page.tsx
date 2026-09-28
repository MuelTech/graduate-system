"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { apiClientRequest } from "@/lib/api.client";
import {
  CalendarClock,
  MapPin,
  Clock,
  ArrowRight,
  ClipboardSignature,
  FileSignature,
  UserCheck,
  Activity,
  RefreshCw,
} from "lucide-react";
import { useSession } from "next-auth/react";
import {
  PanelistAssignmentData as AssignmentData,
  PanelistEvaluationStatus,
} from "@/types";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  panelistAdviserRequestsQueryKey,
  resolvePanelistRequestUiState,
  type PanelistAdviserRequestDto,
} from "@/lib/panelist-adviser-requests";

const NUMERICAL_DEFENSES = new Set(["PROPOSAL_DEFENSE", "FINAL_DEFENSE"]);

function evaluationStatusLabel(status: PanelistEvaluationStatus | undefined) {
  switch (status) {
    case "NOT_STARTED":
      return "Not started";
    case "DRAFT":
      return "Draft saved";
    case "FINALIZED":
      return "Finalized";
    default:
      return "—";
  }
}

function defenseTypeLabel(defenseType: string) {
  switch (defenseType) {
    case "TITLE_DEFENSE":
      return "Title Defense";
    case "PROPOSAL_DEFENSE":
      return "Proposal Defense";
    case "FINAL_DEFENSE":
      return "Final Defense";
    default:
      return defenseType.replace(/_/g, " ");
  }
}

function sessionStatusLabel(sessionStatus: string | undefined) {
  switch (sessionStatus) {
    case "SCHEDULED":
      return "Scheduled";
    case "IN_PROGRESS":
      return "In progress";
    case "AWAITING_CONCLUSION":
      return "Awaiting conclusion";
    case "CONCLUDED":
      return "Concluded";
    case "CANCELLED":
      return "Cancelled";
    default:
      return sessionStatus ?? "—";
  }
}

export default function PanelistDashboard() {
  const { data: session } = useSession();
  const user = session?.user;
  const queryClient = useQueryClient();

  const {
    data: assignments = [],
    isLoading: assignmentsLoading,
    isError: assignmentsError,
    refetch: refetchAssignments,
  } = useQuery({
    queryKey: ["panelistAssignments"],
    queryFn: async () => {
      const res = await apiClientRequest("/thesis/defense/panelist/assignments");
      return Array.isArray(res) ? (res as AssignmentData[]) : [];
    },
    refetchInterval: 30_000,
  });

  const { data: profile } = useQuery({
    queryKey: ["panelistProfile"],
    queryFn: async () => await apiClientRequest("/panelists/me"),
  });

  const {
    data: pendingRap = [],
    isLoading: rapLoading,
    isError: rapError,
  } = useQuery({
    queryKey: ["pendingRapReports"],
    queryFn: async () => {
      const res = await apiClientRequest("/thesis/defense/rap-reports/pending");
      return Array.isArray(res) ? res : [];
    },
    refetchInterval: 30_000,
  });

  const {
    data: adviserRequests = [],
    isLoading: adviserLoading,
    isError: adviserError,
  } = useQuery({
    queryKey: panelistAdviserRequestsQueryKey,
    queryFn: async () => {
      const res = await apiClientRequest("/thesis/adviser/requests/mine");
      return Array.isArray(res)
        ? (res as PanelistAdviserRequestDto[])
        : [];
    },
    refetchInterval: 30_000,
  });

  const {
    data: notifications = [],
    isLoading: notificationsLoading,
    isError: notificationsError,
  } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const res = await apiClientRequest("/notifications");
      return Array.isArray(res) ? res : [];
    },
    refetchInterval: 30_000,
  });

  const toggleMutation = useMutation({
    mutationFn: async (isAvailable: boolean) => {
      return await apiClientRequest("/panelists/me/availability", {
        method: "PATCH",
        body: JSON.stringify({ isAvailable }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["panelistProfile"] });
    },
  });

  // ── Derived summary (no parallel task state machine) ──────────────
  const upcoming = assignments.filter(
    (a) => a.schedule?.sessionStatus === "SCHEDULED",
  );
  const active = assignments.filter(
    (a) => a.schedule?.sessionStatus === "IN_PROGRESS",
  );

  const evaluationsToComplete = assignments.filter((a) => {
    const st = a.schedule?.sessionStatus;
    const isNumerical = NUMERICAL_DEFENSES.has(String(a.schedule?.defenseType));
    const evalStatus = a.evaluationStatus;
    return (
      isNumerical &&
      (st === "SCHEDULED" || st === "IN_PROGRESS") &&
      (evalStatus === "NOT_STARTED" || evalStatus === "DRAFT")
    );
  });

  const pendingRapCount = Array.isArray(pendingRap) ? pendingRap.length : 0;

  const pendingAdviserCount = adviserRequests.filter(
    (r) => resolvePanelistRequestUiState(r) === "ACTIONABLE",
  ).length;

  const recentNotifications = Array.isArray(notifications)
    ? notifications.slice(0, 5)
    : [];

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleDateString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatTime = (timeString?: string) => {
    if (!timeString) return "—";
    return new Date(timeString).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  return (
    <div className="space-y-6">
      {/* Welcome + availability */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2
            suppressHydrationWarning
            className="text-2xl font-bold text-(--earist-primary)"
            style={{ fontFamily: '"Calibri", sans-serif' }}
          >
            {getGreeting()},{" "}
            {(user as { firstName?: string })?.firstName || "Panelist"}
          </h2>
          <p className="text-sm text-(--earist-body-text)">
            Actionable summary of your defense assignments, evaluations, and
            requests.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {profile && (
            <div className="flex items-center gap-3 rounded-xl border border-(--earist-border-gray) bg-white px-4 py-3 shadow-sm">
              <span className="text-sm font-semibold text-(--earist-secondary)">
                Available as Thesis/Dissertation Adviser
              </span>
              <button
                type="button"
                aria-label="Toggle adviser availability"
                onClick={() =>
                  toggleMutation.mutate(!profile.isAvailableAsAdviser)
                }
                disabled={toggleMutation.isPending}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-(--earist-primary) focus:ring-offset-2 ${
                  profile.isAvailableAsAdviser ? "bg-green-500" : "bg-gray-300"
                } ${toggleMutation.isPending ? "cursor-not-allowed opacity-50" : ""}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    profile.isAvailableAsAdviser
                      ? "translate-x-6"
                      : "translate-x-1"
                  }`}
                />
              </button>
              <span
                className={`text-xs font-bold ${profile.isAvailableAsAdviser ? "text-green-600" : "text-gray-500"}`}
              >
                {profile.isAvailableAsAdviser ? "Available" : "Not available"}
              </span>
            </div>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              void refetchAssignments();
              queryClient.invalidateQueries({ queryKey: ["pendingRapReports"] });
              queryClient.invalidateQueries({
                queryKey: panelistAdviserRequestsQueryKey,
              });
              queryClient.invalidateQueries({ queryKey: ["notifications"] });
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-(--earist-body-text)">Upcoming Defenses</p>
            {assignmentsLoading ? (
              <p className="text-lg font-bold text-(--earist-body-text)">…</p>
            ) : assignmentsError ? (
              <p className="text-sm text-red-600">Failed to load</p>
            ) : (
              <p className="text-2xl font-bold text-(--earist-primary)">
                {upcoming.length}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-(--earist-body-text)">
              Evaluations to Complete
            </p>
            {assignmentsLoading ? (
              <p className="text-lg font-bold text-(--earist-body-text)">…</p>
            ) : assignmentsError ? (
              <p className="text-sm text-red-600">Failed to load</p>
            ) : (
              <p className="text-2xl font-bold text-amber-600">
                {evaluationsToComplete.length}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-(--earist-body-text)">
              RAP Signatures Pending
            </p>
            {rapLoading ? (
              <p className="text-lg font-bold text-(--earist-body-text)">…</p>
            ) : rapError ? (
              <p className="text-sm text-red-600">Failed to load</p>
            ) : (
              <p className="text-2xl font-bold text-purple-700">
                {pendingRapCount}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-(--earist-body-text)">
              Adviser Requests Pending
            </p>
            {adviserLoading ? (
              <p className="text-lg font-bold text-(--earist-body-text)">…</p>
            ) : adviserError ? (
              <p className="text-sm text-red-600">Failed to load</p>
            ) : (
              <p className="text-2xl font-bold text-emerald-700">
                {pendingAdviserCount}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Evaluations to Complete */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-(--earist-secondary)">
            Evaluations to Complete
          </h3>
          {evaluationsToComplete.length > 0 && (
            <Link
              href={`/panelist/defense-workspace/${evaluationsToComplete[0].schedule.id}`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Open next
            </Link>
          )}
        </div>
        {assignmentsLoading ? (
          <p className="animate-pulse text-sm text-gray-500">Loading…</p>
        ) : assignmentsError ? (
          <p className="text-sm text-red-600">
            Unable to load evaluation tasks.
          </p>
        ) : evaluationsToComplete.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-(--earist-body-text)">
              No evaluations awaiting completion.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {evaluationsToComplete.map((a) => (
              <Card key={`eval-${a.id}`}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <Badge className="bg-amber-100 text-amber-800">
                      {evaluationStatusLabel(a.evaluationStatus)}
                    </Badge>
                    <Badge variant="outline">{a.role}</Badge>
                  </div>
                  <p className="text-sm font-semibold">
                    {a.schedule?.thesis?.student?.user?.firstName}{" "}
                    {a.schedule?.thesis?.student?.user?.lastName}
                  </p>
                  <p className="text-xs text-(--earist-body-text)">
                    {defenseTypeLabel(String(a.schedule?.defenseType))} ·{" "}
                    {formatDate(String(a.schedule?.defenseDate))}
                  </p>
                  <Link
                    href={`/panelist/defense-workspace/${a.schedule.id}`}
                    className={buttonVariants({
                      variant: "outline",
                      size: "sm",
                      className: "w-full",
                    })}
                  >
                    Open Defense Workspace
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Defense assignments */}
      <section className="space-y-3">
        <h3 className="text-lg font-bold text-(--earist-secondary)">
          Defense Assignments
          {active.length > 0 && (
            <span className="ml-2 text-sm font-normal text-(--earist-body-text)">
              {active.length} active
            </span>
          )}
        </h3>
        {assignmentsLoading ? (
          <p className="animate-pulse text-sm text-gray-500">
            Loading assignments...
          </p>
        ) : assignmentsError ? (
          <p className="text-sm text-red-600">
            Unable to load defense assignments.
          </p>
        ) : upcoming.length === 0 && active.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <ClipboardSignature className="mb-4 h-12 w-12 text-gray-300" />
              <p className="text-gray-500">
                No upcoming defenses scheduled.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...upcoming, ...active].map((assignment) => {
              const schedule = assignment.schedule;
              const thesis = schedule?.thesis;
              const student = thesis?.student?.user;
              if (!schedule || !thesis) return null;

              return (
                <Card
                  key={assignment.id}
                  className="overflow-hidden transition-all hover:shadow-md"
                >
                  <div className="h-1.5 w-full bg-(--earist-primary)"></div>
                  <CardContent className="space-y-3 p-5">
                    <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                      <Badge className="bg-purple-100 text-purple-700">
                        {defenseTypeLabel(schedule.defenseType)}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        Your role: {assignment.role}
                      </Badge>
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900">
                        {student?.firstName} {student?.lastName}
                      </h4>
                      <p className="text-xs text-gray-500">
                        {thesis.student?.program?.programName ||
                          thesis.student?.programId ||
                          "Program N/A"}
                      </p>
                    </div>
                    <div className="space-y-2 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <CalendarClock className="h-4 w-4 text-gray-400" />
                        <span>{formatDate(schedule.defenseDate)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-gray-400" />
                        <span>{formatTime(schedule.defenseTime)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-gray-400" />
                        <span className="truncate">
                          {schedule.venueOrLink || "—"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={
                            schedule.sessionStatus === "IN_PROGRESS"
                              ? "border-amber-500 text-amber-700"
                              : ""
                          }
                        >
                          {sessionStatusLabel(schedule.sessionStatus)}
                        </Badge>
                      </div>
                    </div>
                    <Link
                      href={`/panelist/defense-workspace/${schedule.id}`}
                      className={buttonVariants({
                        className:
                          "w-full bg-(--earist-primary) hover:bg-(--earist-primary)/90",
                      })}
                    >
                      Open Defense Workspace
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* RAP + Adviser + Activity */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <FileSignature className="h-4 w-4 text-(--earist-primary)" />
              RAP Signatures Pending
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {rapLoading ? (
              <p className="text-(--earist-body-text)">Loading…</p>
            ) : rapError ? (
              <p className="text-red-600">Unable to load pending signatures.</p>
            ) : pendingRapCount === 0 ? (
              <p className="text-(--earist-body-text)">
                No pending RAP signatures.
              </p>
            ) : (
              <>
                <p>
                  <strong>{pendingRapCount}</strong> signature slot
                  {pendingRapCount === 1 ? "" : "s"} awaiting you.
                </p>
                <ul className="space-y-1 text-xs text-(--earist-body-text)">
                  {pendingRap.slice(0, 3).map((slot: Record<string, unknown>) => (
                    <li key={String(slot.id ?? "")}>
                      {String(
                        (slot.rapReport as { defenseType?: string } | undefined)
                          ?.defenseType ?? "RAP",
                      ).replace(/_/g, " ")}
                    </li>
                  ))}
                </ul>
              </>
            )}
            <Link
              href="/panelist/signatures"
              className={buttonVariants({
                variant: "outline",
                size: "sm",
                className: "w-full",
              })}
            >
              Open Signatures
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <UserCheck className="h-4 w-4 text-(--earist-primary)" />
              Adviser Requests Pending
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {adviserLoading ? (
              <p className="text-(--earist-body-text)">Loading…</p>
            ) : adviserError ? (
              <p className="text-red-600">Unable to load Adviser Requests.</p>
            ) : pendingAdviserCount === 0 ? (
              <p className="text-(--earist-body-text)">
                No Adviser Requests awaiting your response.
              </p>
            ) : (
              <p>
                <strong>{pendingAdviserCount}</strong> request
                {pendingAdviserCount === 1 ? "" : "s"} awaiting your response.
              </p>
            )}
            <p className="text-[11px] text-(--earist-body-text)">
              CONFORME is not an active Adviser assignment; Dean approval is
              still required.
            </p>
            <Link
              href="/panelist/adviser-requests"
              className={buttonVariants({
                variant: "outline",
                size: "sm",
                className: "w-full",
              })}
            >
              Open Adviser Requests
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Activity className="h-4 w-4 text-(--earist-primary)" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {notificationsLoading ? (
              <p className="text-(--earist-body-text)">Loading…</p>
            ) : notificationsError ? (
              <p className="text-red-600">Unable to load recent activity.</p>
            ) : recentNotifications.length === 0 ? (
              <p className="text-(--earist-body-text)">No recent activity.</p>
            ) : (
              <ul className="space-y-2">
                {recentNotifications.map((n: Record<string, unknown>, i: number) => (
                  <li
                    key={String(n.id ?? i)}
                    className="rounded border border-(--earist-border-gray) p-2"
                  >
                    <p className="text-xs font-semibold">
                      {String(n.title ?? n.message ?? "Notification")}
                    </p>
                    {n.message && n.title ? (
                      <p className="text-[11px] text-(--earist-body-text)">
                        {String(n.message)}
                      </p>
                    ) : null}
                    <p className="text-[10px] text-(--earist-body-text)">
                      {n.createdAt
                        ? new Date(String(n.createdAt)).toLocaleString()
                        : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <Link
              href="/panelist/notifications"
              className={buttonVariants({
                variant: "outline",
                size: "sm",
                className: "w-full",
              })}
            >
              View all notifications
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
