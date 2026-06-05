import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  FileCheck2,
  PenTool,
  FolderOpen,
  Library,
  Bell,
  ArrowRight,
  ExternalLink,
  Clock,
  Calendar,
  User,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";

export default function PanelistDashboard() {
  const panelist = {
    firstName: "Dr. Roberto",
    lastName: "Reyes",
    qualification: "Ph.D. in Computer Science",
    affiliation: "EARIST Faculty",
    isAvailableAsAdviser: true,
  };

  const upcomingDefenses = [
    {
      stage: "Final Defense",
      researcher: "Maria Santos",
      program: "MSCS",
      date: "June 10, 2026",
      time: "9:00 AM",
      teamsLink: "https://teams.microsoft.com/l/meetup-join/1",
    },
    {
      stage: "Proposal Defense",
      researcher: "Juan Dela Cruz",
      program: "MSCS",
      date: "June 12, 2026",
      time: "1:00 PM",
      teamsLink: "https://teams.microsoft.com/l/meetup-join/2",
    },
    {
      stage: "Title Defense",
      researcher: "Ana Garcia",
      program: "MIT",
      date: "June 15, 2026",
      time: "10:00 AM",
      teamsLink: "https://teams.microsoft.com/l/meetup-join/3",
    },
  ];

  const pendingSignatures = 2;

  const recentAssignments = [
    {
      stage: "Title Defense",
      researcher: "Carlos Luna",
      date: "May 28, 2026",
      status: "completed",
    },
    {
      stage: "Proposal Defense",
      researcher: "Pedro Reyes",
      date: "May 20, 2026",
      status: "completed",
    },
    {
      stage: "Final Defense",
      researcher: "Elena Torres",
      date: "May 15, 2026",
      status: "completed",
    },
  ];

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="space-y-4">
      {/* Welcome Header */}
      <div>
        <h2
          className="text-2xl font-bold text-[var(--earist-primary)]"
          style={{ fontFamily: '"Calibri", sans-serif' }}
        >
          {getGreeting()}, {panelist.firstName}
        </h2>
        <p className="text-sm text-[var(--earist-body-text)]">
          {panelist.qualification}
        </p>
        <p className="text-xs text-[var(--earist-body-text)]">
          {panelist.affiliation}
        </p>
      </div>

      {/* Bento Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Upcoming Defenses — spans 2 cols */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-[var(--earist-secondary)]">
                Upcoming Defenses
              </CardTitle>
              <Calendar className="h-5 w-5 text-[var(--earist-accent)]" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {upcomingDefenses.map((defense, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-lg bg-[var(--earist-surface-gray)] p-3"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--earist-surface-light-red)]">
                    <FileCheck2 className="h-5 w-5 text-[var(--earist-primary)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[var(--earist-primary)]">
                      {defense.stage}
                    </p>
                    <p className="text-xs text-[var(--earist-body-text)]">
                      {defense.researcher} &middot; {defense.program}
                    </p>
                    <p className="text-xs text-[var(--earist-body-text)]">
                      {defense.date} at {defense.time}
                    </p>
                  </div>
                  <a
                    href={defense.teamsLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-[var(--earist-primary)] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[var(--earist-primary)]/90"
                  >
                    Join Meeting <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Pending E-Signatures — compact */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-[var(--earist-secondary)]">
              E-Signatures
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-50">
                <PenTool className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[var(--earist-primary)]">
                  {pendingSignatures}
                </p>
                <p className="text-xs text-[var(--earist-body-text)]">
                  awaiting signature
                </p>
              </div>
            </div>
            <Link
              href="/panelist/signatures"
              className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[var(--earist-secondary)] transition-colors hover:text-[var(--earist-primary)]"
            >
              Sign Now <ArrowRight className="h-3 w-3" />
            </Link>
          </CardContent>
        </Card>

        {/* Adviser Availability — compact */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-[var(--earist-secondary)]">
              Adviser Availability
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between rounded-lg bg-[var(--earist-surface-gray)] p-3">
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-[var(--earist-body-text)]" />
                <span className="text-sm text-[var(--earist-body-text)]">
                  Thesis Adviser
                </span>
              </div>
              {panelist.isAvailableAsAdviser ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-green-600">
                    ON
                  </span>
                  <ToggleRight className="h-6 w-6 text-green-600" />
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-gray-400">
                    OFF
                  </span>
                  <ToggleLeft className="h-6 w-6 text-gray-400" />
                </div>
              )}
            </div>
            <p className="mt-2 text-xs text-[var(--earist-body-text)]">
              {panelist.isAvailableAsAdviser
                ? "You are visible to students seeking an adviser."
                : "Toggle ON to appear in the adviser request list."}
            </p>
          </CardContent>
        </Card>

        {/* Recent Assignments — 1 col */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-[var(--earist-secondary)]">
              Recent Assignments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentAssignments.map((assignment, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-lg bg-[var(--earist-surface-gray)] p-2.5"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded bg-green-50">
                    <FileCheck2 className="h-4 w-4 text-green-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--earist-primary)]">
                      {assignment.stage}
                    </p>
                    <p className="text-xs text-[var(--earist-body-text)]">
                      {assignment.researcher}
                    </p>
                  </div>
                  <span className="shrink-0 text-[11px] text-[var(--earist-body-text)]">
                    {assignment.date}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Repository Quick Access — compact */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-[var(--earist-secondary)]">
              Repository
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center rounded-lg bg-[var(--earist-surface-gray)] py-6">
              <Library className="mb-2 h-8 w-8 text-[var(--earist-body-text)]/40" />
              <p className="mb-3 text-xs text-[var(--earist-body-text)]">
                Browse published research
              </p>
              <Link
                href="/panelist/repository"
                className="inline-flex items-center gap-1 rounded-lg bg-[var(--earist-primary)] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[var(--earist-primary)]/90"
              >
                Browse Repository
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Notifications — spans 2 cols */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-[var(--earist-secondary)]">
                Recent Notifications
              </CardTitle>
              <Link
                href="/panelist/notifications"
                className="text-xs font-semibold text-[var(--earist-secondary)] transition-colors hover:text-[var(--earist-primary)]"
              >
                View All
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[
                {
                  title: "Final Defense scheduled",
                  desc: "Maria Santos — June 10, 2026 at 9:00 AM.",
                  time: "1 hour ago",
                  unread: true,
                },
                {
                  title: "RAP Report ready for e-signature",
                  desc: "Carlos Luna — Title Defense RAP Report.",
                  time: "3 hours ago",
                  unread: true,
                },
                {
                  title: "Defense materials available",
                  desc: "Juan Dela Cruz — Proposal chapters uploaded.",
                  time: "5 hours ago",
                  unread: true,
                },
                {
                  title: "Scoring submitted",
                  desc: "Elena Torres — Final Defense evaluation recorded.",
                  time: "2 days ago",
                  unread: false,
                },
                {
                  title: "Welcome to Panelist Portal",
                  desc: "Your account is active. Check your upcoming defenses.",
                  time: "1 week ago",
                  unread: false,
                },
              ].map((notif, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-3 rounded-lg p-2.5 ${
                    notif.unread
                      ? "bg-[var(--earist-surface-light-red)]"
                      : "bg-[var(--earist-surface-gray)]"
                  }`}
                >
                  <div
                    className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${
                      notif.unread
                        ? "bg-[var(--earist-accent)]"
                        : "bg-transparent"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[var(--earist-primary)]">
                      {notif.title}
                    </p>
                    <p className="text-xs text-[var(--earist-body-text)] truncate">
                      {notif.desc}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-[var(--earist-body-text)]">
                    {notif.time}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
