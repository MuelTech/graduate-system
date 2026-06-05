import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  Clock,
  FileText,
  ArrowRight,
  BookOpen,
  Calendar,
  Library,
  Megaphone,
  User,
  AlertCircle,
  ExternalLink,
} from "lucide-react";

export default function StudentDashboard() {
  const student = {
    firstName: "Maria",
    lastName: "Santos",
    studentNumber: "2026-GS-00456",
    program: "Master of Science in Computer Science",
    currentStage: "proposal_defense" as
      | "title_defense"
      | "proposal_defense"
      | "final_defense"
      | "repository",
    compExamStatus: "passed" as "pending" | "passed" | "failed",
    activeApplication: {
      stage: "Proposal Defense",
      dateSubmitted: "May 28, 2026",
      status: "pending_review" as
        | "pending_review"
        | "approved"
        | "scheduled"
        | "completed",
    },
    upcomingDefense: null as null | {
      stage: string;
      date: string;
      time: string;
      teamsLink: string;
    },
    requirements: { submitted: 4, total: 6 },
  };

  const stages = [
    { key: "title_defense", label: "Title Defense" },
    { key: "proposal_defense", label: "Proposal Defense" },
    { key: "final_defense", label: "Final Defense" },
    { key: "repository", label: "Repository" },
  ];

  const currentStageIndex = stages.findIndex(
    (s) => s.key === student.currentStage
  );

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
          {getGreeting()}, {student.firstName}
        </h2>
        <p className="text-sm text-[var(--earist-body-text)]">
          {student.program}
        </p>
        <p className="text-xs text-[var(--earist-body-text)]">
          Student Number: {student.studentNumber}
        </p>
      </div>

      {/* Thesis Pipeline Progress */}
      <div className="rounded-xl border border-[var(--earist-border-gray)] bg-white px-6 py-4">
        <p className="mb-3 text-xs font-semibold text-[var(--earist-secondary)]">
          Thesis Pipeline
        </p>
        <div className="relative">
          {/* Connector lines */}
          <div className="absolute top-4 left-4 right-4 h-1 -translate-y-1/2 rounded bg-[var(--earist-border-gray)]" />
          <div
            className="absolute top-4 left-4 h-1 -translate-y-1/2 rounded bg-green-500"
            style={{
              width: `calc(${currentStageIndex / (stages.length - 1)} * (100% - 2rem))`,
            }}
          />
          {/* Steps */}
          <div className="relative flex justify-between">
            {stages.map((stage, i) => {
              const isCompleted = i < currentStageIndex;
              const isCurrent = i === currentStageIndex;

              return (
                <div key={stage.key} className="flex flex-col items-center">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                      isCompleted
                        ? "bg-green-500 text-white"
                        : isCurrent
                          ? "bg-[var(--earist-accent)] text-[var(--earist-primary)] ring-2 ring-[var(--earist-accent)]/20"
                          : "bg-[var(--earist-surface-gray)] text-[var(--earist-body-text)]"
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      i + 1
                    )}
                  </div>
                  <span
                    className={`mt-1.5 text-center text-[11px] font-medium ${
                      isCurrent
                        ? "text-[var(--earist-primary)]"
                        : isCompleted
                          ? "text-green-600"
                          : "text-[var(--earist-body-text)]"
                    }`}
                  >
                    {stage.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bento Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Active Defense Application — spans 2 cols */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-[var(--earist-secondary)]">
                Active Defense Application
              </CardTitle>
              <Badge className="bg-amber-100 text-amber-700">
                <Clock className="mr-1 h-3 w-3" />
                Pending Review
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-3 rounded-lg bg-[var(--earist-surface-gray)] p-3">
              <p className="text-sm font-semibold text-[var(--earist-primary)]">
                {student.activeApplication.stage}
              </p>
              <p className="text-xs text-[var(--earist-body-text)]">
                Submitted: {student.activeApplication.dateSubmitted}
              </p>
            </div>
            <Link
              href="/student/thesis/proposal-defense"
              className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--earist-secondary)] transition-colors hover:text-[var(--earist-primary)]"
            >
              View Application <ArrowRight className="h-3 w-3" />
            </Link>
          </CardContent>
        </Card>

        {/* Comp Exam Status — compact */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-[var(--earist-secondary)]">
              Comprehensive Exam
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-50">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <Badge className="bg-green-100 text-green-700">Passed</Badge>
                <p className="mt-1 text-xs text-[var(--earist-body-text)]">
                  For academic tracking only
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Requirements Status — spans 2 cols */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-[var(--earist-secondary)]">
                Requirements Status
              </CardTitle>
              <FileText className="h-5 w-5 text-[var(--earist-accent)]" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-3">
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-bold text-[var(--earist-primary)]">
                  {student.requirements.submitted}
                  <span className="text-base font-normal text-[var(--earist-body-text)]">
                    {" "}
                    / {student.requirements.total}
                  </span>
                </span>
                <span className="text-xs text-[var(--earist-body-text)]">
                  submitted
                </span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[var(--earist-border-gray)]">
                <div
                  className="h-full rounded-full bg-[var(--earist-primary)]"
                  style={{
                    width: `${(student.requirements.submitted / student.requirements.total) * 100}%`,
                  }}
                />
              </div>
            </div>
            <Link
              href="/student/thesis/proposal-defense"
              className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--earist-secondary)] transition-colors hover:text-[var(--earist-primary)]"
            >
              View Requirements <ArrowRight className="h-3 w-3" />
            </Link>
          </CardContent>
        </Card>

        {/* Upcoming Defense / No Scheduled Defense — spans 2 cols */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-[var(--earist-secondary)]">
              Upcoming Defense
            </CardTitle>
          </CardHeader>
          <CardContent>
            {student.upcomingDefense ? (
              <div>
                <div className="mb-3 rounded-lg bg-[var(--earist-surface-gray)] p-3">
                  <p className="text-sm font-semibold text-[var(--earist-primary)]">
                    {student.upcomingDefense.stage}
                  </p>
                  <p className="text-xs text-[var(--earist-body-text)]">
                    {student.upcomingDefense.date} &middot;{" "}
                    {student.upcomingDefense.time}
                  </p>
                </div>
                <a
                  href={student.upcomingDefense.teamsLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--earist-secondary)] transition-colors hover:text-[var(--earist-primary)]"
                >
                  Join MS Teams <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            ) : (
              <div className="flex items-center justify-center rounded-lg bg-[var(--earist-surface-gray)] py-6">
                <div className="text-center">
                  <Calendar className="mx-auto mb-2 h-8 w-8 text-[var(--earist-body-text)]/40" />
                  <p className="text-sm text-[var(--earist-body-text)]">
                    No defense scheduled yet
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Links — spans 2 cols */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-[var(--earist-secondary)]">
              Quick Links
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {[
                {
                  href: "/student/thesis",
                  label: "Thesis Pipeline",
                  icon: FileText,
                },
                {
                  href: "/student/curriculum",
                  label: "Curriculum",
                  icon: BookOpen,
                },
                {
                  href: "/student/journey",
                  label: "Academic Journey",
                  icon: ArrowRight,
                },
                {
                  href: "/student/repository",
                  label: "Repository",
                  icon: Library,
                },
                {
                  href: "/student/announcements",
                  label: "Announcements",
                  icon: Megaphone,
                },
                {
                  href: "/student/profile",
                  label: "Profile",
                  icon: User,
                },
                {
                  href: "/student/plagiarism",
                  label: "STRIKE Check",
                  icon: AlertCircle,
                },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center gap-2 rounded-lg bg-[var(--earist-surface-gray)] p-2.5 text-xs font-medium text-[var(--earist-body-text)] transition-colors hover:bg-[var(--earist-surface-light-red)] hover:text-[var(--earist-primary)]"
                >
                  <link.icon className="h-4 w-4 shrink-0" />
                  {link.label}
                </Link>
              ))}
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
                href="/student/notifications"
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
                  title: "Proposal Defense application under review",
                  desc: "Your application is being reviewed by the GS Office.",
                  time: "1 hour ago",
                  unread: true,
                },
                {
                  title: "Adviser assigned",
                  desc: "Dr. Reyes has been assigned as your thesis adviser.",
                  time: "3 hours ago",
                  unread: true,
                },
                {
                  title: "Title Defense RAP Report signed",
                  desc: "All panelists have signed your Title Defense RAP Report.",
                  time: "2 days ago",
                  unread: true,
                },
                {
                  title: "Curriculum checklist updated",
                  desc: "New subjects added for the current semester.",
                  time: "3 days ago",
                  unread: false,
                },
                {
                  title: "Welcome to Student Portal",
                  desc: "Your account has been activated. Explore your dashboard.",
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
