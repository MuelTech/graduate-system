import Link from "next/link";
import { auth } from "@/auth";
import { getServerBackendBaseUrl } from "@/lib/backend-origin.server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
export default async function ApplicantDashboard() {
  // 1. Grab the secure session
  const session = await auth();
  if (!session?.user?.accessToken) {
    return <div>Please log in to view your dashboard.</div>;
  }
  // 2. Fetch the real data from our new secure backend API
  const apiUrl = getServerBackendBaseUrl();
  const res = await fetch(`${apiUrl}/api/applicant/profile`, {
    headers: {
      Authorization: `Bearer ${session.user.accessToken}`,
    },
    cache: "no-store", // Ensure we always get the freshest status
  });
  if (!res.ok) {
    return <div>Error loading profile data.</div>;
  }
  // 3. This dynamically replaces the hardcoded data!
  const applicant = await res.json();

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#333333]">
          Welcome, {applicant.firstName}
        </h1>
        <p className="mt-1 text-sm text-gray-500">{applicant.program}</p>
        <p className="text-xs text-gray-500">
          Applicant ID: {applicant.applicantId}
        </p>
      </div>

      {/* Progress Stepper */}
      <div className="rounded-xl border border-gray-100 bg-white px-6 py-5 shadow-sm">
        <p className="mb-3 text-xs font-semibold tracking-wider text-gray-500 uppercase">
          Applicant Progress
        </p>
        <div className="relative">
          {/* Connector lines */}
          <div className="absolute top-4 right-4 left-4 h-1 -translate-y-1/2 rounded bg-gray-100" />
          <div
            className="absolute top-4 left-4 h-1 -translate-y-1/2 rounded bg-[#e02b20]"
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
                        ? "bg-[#e02b20] text-white"
                        : isCurrent
                          ? "bg-[#f9a825] text-[#333333] ring-2 ring-[#f9a825]/30"
                          : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                  </div>
                  <span
                    className={`mt-1.5 text-center text-[11px] font-medium ${
                      isCurrent
                        ? "font-semibold text-[#333333]"
                        : "text-gray-500"
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
              <CardTitle className="text-base font-bold text-[#333333]">
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
                <AlertDescription className="text-amber-700 font-semibold">
                  Action Required: You have a pending Bridging Waiver.
                </AlertDescription>
              </Alert>
            )}
            <p className="mb-4 text-sm text-gray-600">
              {applicant.alignmentStatus === "aligned"
                ? "Your undergraduate program is aligned. You may proceed to schedule your exam."
                : applicant.alignmentStatus === "cleared"
                  ? "Your waiver has been cleared. You may schedule your exam."
                  : "Exam scheduling is locked until your waiver is submitted and validated."}
            </p>
            {applicant.alignmentStatus === "aligned" ||
            applicant.alignmentStatus === "cleared" ? (
              <Link
                href="/applicant/schedule"
                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-[#333333] shadow-xs transition-colors hover:bg-gray-50"
              >
                Proceed to Exam Schedule Page <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <Link
                href="/applicant/alignment"
                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-[#333333] shadow-xs transition-colors hover:bg-gray-50"
              >
                Proceed to Program Alignment Page{" "}
                <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </CardContent>
        </Card>

        {/* Current Status — compact */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base font-bold text-[#333333]">
              Current Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {applicant.currentStep === 2 ? (
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                  <CheckCircle2 className="h-5 w-5 text-green-700" />
                </div>
                <div>
                  <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                    Exam Passed
                  </Badge>
                  <p className="mt-1 text-xs text-gray-500">
                    Congratulations! You may now upload your COR.
                  </p>
                </div>
              </div>
            ) : applicant.currentStep === 1 ? (
              applicant.examDate ? (
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e02b20]/10">
                    <Clock className="h-5 w-5 text-[#e02b20]" />
                  </div>
                  <div>
                    <Badge className="bg-[#f9a825]/20 text-amber-900 hover:bg-[#f9a825]/20">
                      Exam Scheduled
                    </Badge>
                    <p className="mt-1 text-xs text-gray-500">
                      Your entrance exam is scheduled.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                    <CalendarClock className="h-5 w-5 text-blue-700" />
                  </div>
                  <div>
                    <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
                      Ready to Schedule
                    </Badge>
                    <p className="mt-1 text-xs text-gray-500">
                      You may now select your exam schedule.
                    </p>
                  </div>
                </div>
              )
            ) : (
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
                  <AlertTriangle className="h-5 w-5 text-amber-700" />
                </div>
                <div>
                  <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
                    Pending Alignment
                  </Badge>
                  <p className="mt-1 text-xs text-gray-500">
                    Waiting for program alignment validation.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Exam Schedule — spans 2 cols */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-bold text-[#333333]">
                Exam Schedule
              </CardTitle>
              <CalendarClock className="h-5 w-5 text-[#e02b20]" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-3 rounded-lg border border-gray-100 bg-gray-50/70 p-3">
              <p className="text-sm font-semibold text-[#333333]">
                {applicant.examDate}
              </p>
              <p className="text-xs text-gray-500">
                {applicant.examTime}
              </p>
              <p className="text-xs text-gray-500">
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
                  : "bg-[#e02b20] text-white hover:bg-[#c62828]"
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
              <CardTitle className="text-base font-bold text-[#333333]">
                Exam Results
              </CardTitle>
              <BadgeCheck className="h-5 w-5 text-[#e02b20]" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-3 flex items-center justify-center rounded-lg border border-gray-100 bg-gray-50/70 py-6">
              <div className="text-center">
                <FileText className="mx-auto mb-2 h-8 w-8 text-gray-300" />
                <p className="text-sm text-gray-500">
                  Results will appear here after your exam
                </p>
              </div>
            </div>
            <Link
              href="/applicant/results"
              className="inline-flex items-center gap-1 text-sm font-semibold text-[#e02b20] transition-colors hover:underline"
            >
              View Detailed Results <ArrowRight className="h-3 w-3" />
            </Link>
          </CardContent>
        </Card>

        {/* COR Upload — spans 2 cols */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-bold text-[#333333]">
                Certificate of Registration (COR)
              </CardTitle>
              <Upload className="h-5 w-5 text-[#e02b20]" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-4 rounded-lg border border-gray-100 bg-gray-50/70 p-4">
              <div>
                <p className="text-sm text-gray-600">
                  Upload your COR after passing the exam and completing
                  enrollment.
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Accepted formats: PDF, JPG, PNG (max 5MB)
                </p>
              </div>
              <Link
                href="/applicant/cor-upload"
                className="shrink-0 rounded-lg bg-[#e02b20] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#c62828]"
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
              <CardTitle className="text-base font-bold text-[#333333]">
                Recent Notifications
              </CardTitle>
              <Link
                href="/applicant/notifications"
                className="text-xs font-semibold text-[#e02b20] transition-colors hover:underline"
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
                  className={`flex items-start gap-3 rounded-lg border border-gray-100 p-3 ${
                    notif.unread
                      ? "bg-[#FFF8F0]"
                      : "bg-gray-50/50"
                  }`}
                >
                  <div
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                      notif.unread ? "bg-[#e02b20]" : "bg-transparent"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[#333333]">
                      {notif.title}
                    </p>
                    <p className="truncate text-xs text-gray-500">
                      {notif.desc}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-gray-400">
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
