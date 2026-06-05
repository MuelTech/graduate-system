import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ClipboardCheck,
  CalendarClock,
  BadgeCheck,
  Upload,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  Download,
} from "lucide-react";

export default function ApplicantDashboard() {
  const applicant = {
    firstName: "Juan",
    program: "Master of Science in Computer Science",
    applicantId: "APP-2026-00123",
    alignmentStatus: "aligned" as "aligned" | "pending_waiver" | "cleared",
    currentStep: 1,
    examDate: "June 15, 2026",
    examTime: "9:00 AM — 12:00 PM",
    strikeCount: 0,
  };

  return (
    <div className="space-y-4">
      {/* Welcome Header */}
      <div>
        <h2
          className="text-2xl font-bold text-[var(--earist-primary)]"
          style={{ fontFamily: '"Calibri", sans-serif' }}
        >
          Welcome, {applicant.firstName}
        </h2>
        <p className="text-sm text-[var(--earist-body-text)]">
          {applicant.program}
        </p>
        <p className="text-xs text-[var(--earist-body-text)]">
          Applicant ID: {applicant.applicantId}
        </p>
      </div>

      {/* Progress Stepper */}
      <div className="rounded-xl border border-[var(--earist-border-gray)] bg-white px-6 py-4">
        <p className="mb-3 text-xs font-semibold text-[var(--earist-secondary)]">
          Applicant Progress
        </p>
        <div className="relative">
          {/* Connector lines */}
          <div className="absolute top-4 left-4 right-4 h-1 -translate-y-1/2 rounded bg-[var(--earist-border-gray)]" />
          <div
            className="absolute top-4 left-4 h-1 -translate-y-1/2 rounded bg-[var(--earist-primary)]"
            style={{
              width: `calc(${applicant.currentStep / 2} * (100% - 2rem))`,
            }}
          />
          {/* Steps */}
          <div className="relative flex justify-between">
            {[
              { label: "Register & Align", icon: ClipboardCheck },
              { label: "Schedule & Take Exam", icon: CalendarClock },
              { label: "Upload COR", icon: Upload },
            ].map((step, i) => {
              const isCompleted = i < applicant.currentStep;
              const isCurrent = i === applicant.currentStep;

              return (
                <div key={i} className="flex flex-col items-center">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                      isCompleted
                        ? "bg-[var(--earist-primary)] text-white"
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
                        : "text-[var(--earist-body-text)]"
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bento Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">

        {/* Program Alignment — spans 2 cols */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-[var(--earist-secondary)]">
                Program Alignment
              </CardTitle>
              <Badge
                variant={
                  applicant.alignmentStatus === "pending_waiver"
                    ? "destructive"
                    : "default"
                }
                className={
                  applicant.alignmentStatus === "aligned"
                    ? "bg-green-100 text-green-700"
                    : applicant.alignmentStatus === "cleared"
                      ? "bg-blue-100 text-blue-700"
                      : ""
                }
              >
                {applicant.alignmentStatus === "aligned" && (
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                )}
                {applicant.alignmentStatus === "pending_waiver" && (
                  <AlertTriangle className="mr-1 h-3 w-3" />
                )}
                {applicant.alignmentStatus === "cleared" && (
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                )}
                {applicant.alignmentStatus === "aligned"
                  ? "Aligned"
                  : applicant.alignmentStatus === "pending_waiver"
                    ? "Pending Waiver"
                    : "Cleared"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {applicant.alignmentStatus === "pending_waiver" && (
              <Alert className="mb-3 border-amber-200 bg-amber-50">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-700">
                  Your account is pending — download and submit your Bridging
                  Waiver to the GS Office.
                </AlertDescription>
                <Button
                  size="sm"
                  className="mt-2 bg-amber-600 hover:bg-amber-700"
                >
                  <Download className="mr-1 h-3 w-3" />
                  Download Waiver Form
                </Button>
              </Alert>
            )}
            <p className="mb-3 text-sm text-[var(--earist-body-text)]">
              {applicant.alignmentStatus === "aligned"
                ? "Your undergraduate program is aligned. You may proceed to schedule your exam."
                : applicant.alignmentStatus === "pending_waiver"
                  ? "Exam scheduling is locked until your waiver is validated."
                  : "Your waiver has been cleared. You may schedule your exam."}
            </p>
            <Link
              href="/applicant/alignment"
              className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--earist-secondary)] transition-colors hover:text-[var(--earist-primary)]"
            >
              View Details <ArrowRight className="h-3 w-3" />
            </Link>
          </CardContent>
        </Card>

        {/* Current Status — compact */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-[var(--earist-secondary)]">
              Current Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--earist-surface-light-red)]">
                <Clock className="h-5 w-5 text-[var(--earist-primary)]" />
              </div>
              <div>
                <Badge className="bg-[var(--earist-accent)] text-[var(--earist-primary)]">
                  Exam Scheduled
                </Badge>
                <p className="mt-1 text-xs text-[var(--earist-body-text)]">
                  Your entrance exam is scheduled
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Exam Schedule — spans 2 cols */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-[var(--earist-secondary)]">
                Exam Schedule
              </CardTitle>
              <CalendarClock className="h-5 w-5 text-[var(--earist-accent)]" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-3 rounded-lg bg-[var(--earist-surface-gray)] p-3">
              <p className="text-sm font-semibold text-[var(--earist-primary)]">
                {applicant.examDate}
              </p>
              <p className="text-xs text-[var(--earist-body-text)]">
                {applicant.examTime}
              </p>
              <p className="text-xs text-[var(--earist-body-text)]">
                {applicant.program}
              </p>
            </div>
            {applicant.strikeCount > 0 && (
              <Alert className="mb-3 border-amber-200 bg-amber-50">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-700">
                  Warning: You have {applicant.strikeCount} missed attempt(s).
                  Two missed attempts result in disqualification.
                </AlertDescription>
              </Alert>
            )}
            <Link
              href="/applicant/schedule"
              className={`inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                applicant.alignmentStatus === "pending_waiver"
                  ? "cursor-not-allowed bg-gray-200 text-gray-400"
                  : "bg-[var(--earist-primary)] text-white hover:bg-[var(--earist-primary)]/90"
              }`}
            >
              Select Exam Schedule
            </Link>
          </CardContent>
        </Card>

        {/* Exam Results — spans 2 cols */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-[var(--earist-secondary)]">
                Exam Results
              </CardTitle>
              <BadgeCheck className="h-5 w-5 text-[var(--earist-accent)]" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-3 flex items-center justify-center rounded-lg bg-[var(--earist-surface-gray)] py-6">
              <div className="text-center">
                <FileText className="mx-auto mb-2 h-8 w-8 text-[var(--earist-body-text)]/40" />
                <p className="text-sm text-[var(--earist-body-text)]">
                  Results will appear here after your exam
                </p>
              </div>
            </div>
            <Link
              href="/applicant/results"
              className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--earist-secondary)] transition-colors hover:text-[var(--earist-primary)]"
            >
              View Detailed Results <ArrowRight className="h-3 w-3" />
            </Link>
          </CardContent>
        </Card>

        {/* COR Upload — spans 2 cols */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-[var(--earist-secondary)]">
                Certificate of Registration (COR)
              </CardTitle>
              <Upload className="h-5 w-5 text-[var(--earist-accent)]" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-4 rounded-lg bg-[var(--earist-surface-gray)] p-4">
              <div>
                <p className="text-sm text-[var(--earist-body-text)]">
                  Upload your COR after passing the exam and completing
                  enrollment.
                </p>
                <p className="mt-1 text-xs text-[var(--earist-body-text)]">
                  Accepted formats: PDF, JPG, PNG (max 5MB)
                </p>
              </div>
              <Link
                href="/applicant/cor-upload"
                className="shrink-0 rounded-lg bg-[var(--earist-primary)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--earist-primary)]/90"
              >
                Upload COR
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
                href="/applicant/notifications"
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
                  title: "Exam schedule confirmed",
                  desc: "Your entrance exam is scheduled for June 15, 2026 at 9:00 AM.",
                  time: "2 hours ago",
                  unread: true,
                },
                {
                  title: "Alignment check passed",
                  desc: "Your undergraduate program is aligned with your intended graduate program.",
                  time: "5 hours ago",
                  unread: true,
                },
                {
                  title: "Registration successful",
                  desc: "Your applicant account has been created successfully.",
                  time: "1 day ago",
                  unread: true,
                },
                {
                  title: "Welcome to EARIST GS",
                  desc: "Thank you for registering. Schedule your entrance exam to proceed.",
                  time: "1 day ago",
                  unread: false,
                },
                {
                  title: "Account created",
                  desc: "Your applicant portal is now active.",
                  time: "2 days ago",
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
