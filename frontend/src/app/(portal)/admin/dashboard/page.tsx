import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  FileCheck2,
  Upload,
  Library,
  ArrowRight,
  Clock,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  FileText,
  PenLine,
  CalendarClock,
  ShieldCheck,
  BarChart3,
  ClipboardList,
  UserCheck,
} from "lucide-react";

export default function AdminDashboard() {
  const kpis = [
    {
      label: "Total Active Students",
      value: "142",
      trend: "+12 vs last semester",
      icon: Users,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Pending Defense Applications",
      value: "8",
      trend: "3 Title, 3 Proposal, 2 Final",
      icon: FileCheck2,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
    {
      label: "Pending COR Verifications",
      value: "5",
      trend: "Oldest: 2 days ago",
      icon: Upload,
      color: "text-(--earist-primary)",
      bg: "bg-(--earist-surface-light-red)",
    },
    {
      label: "Repository Entries",
      value: "87",
      trend: "+4 this semester",
      icon: Library,
      color: "text-green-600",
      bg: "bg-green-50",
    },
  ];

  const pipelineStages = [
    { label: "Title Defense", count: 24, color: "bg-blue-500" },
    { label: "Proposal Defense", count: 31, color: "bg-amber-500" },
    { label: "Final Defense", count: 18, color: "bg-green-500" },
    { label: "Repository", count: 87, color: "bg-(--earist-primary)" },
  ];

  const maxCount = Math.max(...pipelineStages.map((s) => s.count));

  const pendingActions = [
    {
      action: "Validate bridging waiver",
      detail: "Juan Dela Cruz — BSIT vs MSCS",
      href: "/admin/exam/waiver",
      priority: "high",
      time: "2 hours ago",
    },
    {
      action: "Verify COR upload",
      detail: "Maria Santos — 2026-GS-00456",
      href: "/admin/exam/cor",
      priority: "high",
      time: "3 hours ago",
    },
    {
      action: "Review Title Defense application",
      detail: "Pedro Reyes — 3 proposed titles",
      href: "/admin/thesis/applications",
      priority: "medium",
      time: "5 hours ago",
    },
    {
      action: "Assign panel for Proposal Defense",
      detail: "Ana Garcia — Chapters 1-3 approved",
      href: "/admin/thesis/scheduling",
      priority: "medium",
      time: "1 day ago",
    },
    {
      action: "Finalize RAP Report",
      detail: "Carlos Luna — Title Defense completed",
      href: "/admin/thesis/rap-reports",
      priority: "low",
      time: "1 day ago",
    },
  ];

  const recentActivity = [
    {
      actor: "Admin",
      action: "Validated bridging waiver",
      target: "Maria Santos",
      time: "10 min ago",
    },
    {
      actor: "System",
      action: "Exam slot confirmed",
      target: "Juan Dela Cruz",
      time: "30 min ago",
    },
    {
      actor: "Admin",
      action: "Assigned panelists",
      target: "Proposal Defense — Ana Garcia",
      time: "1 hour ago",
    },
    {
      actor: "System",
      action: "COR verified, student promoted",
      target: "Pedro Reyes",
      time: "2 hours ago",
    },
    {
      actor: "Admin",
      action: "Published memo",
      target: "Enrollment Deadline Reminder",
      time: "3 hours ago",
    },
    {
      actor: "System",
      action: "RAP Report e-signed",
      target: "Title Defense — Carlos Luna",
      time: "5 hours ago",
    },
  ];

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div>
        <h2
          className="text-2xl font-bold text-(--earist-primary)"
          style={{ fontFamily: '"Calibri", sans-serif' }}
        >
          Administrator Dashboard
        </h2>
        <p className="text-sm text-(--earist-body-text)">
          Graduate School Information System
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-(--earist-body-text)">
                    {kpi.label}
                  </p>
                  <p className="mt-1 text-2xl font-bold text-(--earist-primary)">
                    {kpi.value}
                  </p>
                  <p className="mt-0.5 text-[11px] text-(--earist-body-text)">
                    {kpi.trend}
                  </p>
                </div>
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-lg ${kpi.bg}`}
                >
                  <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Bento Grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        {/* Thesis Pipeline Summary — spans 2 cols */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-(--earist-secondary)">
                Thesis Pipeline Summary
              </CardTitle>
              <BarChart3 className="h-5 w-5 text-(--earist-accent)" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pipelineStages.map((stage) => (
                <div key={stage.label} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 text-xs text-(--earist-body-text)">
                    {stage.label}
                  </span>
                  <div className="flex-1">
                    <div className="h-6 w-full overflow-hidden rounded bg-(--earist-surface-gray)">
                      <div
                        className={`flex h-full items-center justify-end rounded px-2 ${stage.color}`}
                        style={{
                          width: `${(stage.count / maxCount) * 100}%`,
                        }}
                      >
                        <span className="text-xs font-bold text-white">
                          {stage.count}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Exam Pipeline Status — spans 2 cols */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-(--earist-secondary)">
                Exam Pipeline Status
              </CardTitle>
              <FileCheck2 className="h-5 w-5 text-(--earist-accent)" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {[
                {
                  label: "Pending Waivers",
                  value: "3",
                  icon: ShieldCheck,
                  color: "text-amber-600",
                  bg: "bg-amber-50",
                },
                {
                  label: "Scheduled Exams",
                  value: "12",
                  icon: CalendarClock,
                  color: "text-blue-600",
                  bg: "bg-blue-50",
                },
                {
                  label: "Pending Essay Grading",
                  value: "4",
                  icon: FileText,
                  color: "text-purple-600",
                  bg: "bg-purple-50",
                },
                {
                  label: "Pending COR",
                  value: "5",
                  icon: Upload,
                  color: "text-(--earist-primary)",
                  bg: "bg-(--earist-surface-light-red)",
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-3 rounded-lg bg-(--earist-surface-gray) p-3"
                >
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded ${item.bg}`}
                  >
                    <item.icon className={`h-4 w-4 ${item.color}`} />
                  </div>
                  <div>
                    <p className="text-lg font-bold text-(--earist-primary)">
                      {item.value}
                    </p>
                    <p className="text-[11px] text-(--earist-body-text)">
                      {item.label}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Pending Actions — spans 2 cols */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-(--earist-secondary)">
                Pending Actions
              </CardTitle>
              <Badge className="bg-(--earist-surface-light-red) text-(--earist-primary)">
                {pendingActions.length} items
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pendingActions.map((item, i) => (
                <Link
                  key={i}
                  href={item.href}
                  className="flex items-center gap-3 rounded-lg bg-(--earist-surface-gray) p-2.5 transition-colors hover:bg-(--earist-surface-light-red)"
                >
                  <div
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      item.priority === "high"
                        ? "bg-red-500"
                        : item.priority === "medium"
                          ? "bg-amber-500"
                          : "bg-gray-400"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-(--earist-primary)">
                      {item.action}
                    </p>
                    <p className="truncate text-xs text-(--earist-body-text)">
                      {item.detail}
                    </p>
                  </div>
                  <span className="shrink-0 text-[11px] text-(--earist-body-text)">
                    {item.time}
                  </span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity — spans 2 cols */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-(--earist-secondary)">
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentActivity.map((item, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 rounded-lg p-2.5"
                >
                  <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-(--earist-accent)" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-(--earist-primary)">
                      <span className="font-medium">{item.actor}</span>{" "}
                      {item.action}
                    </p>
                    <p className="text-xs text-(--earist-body-text)">
                      {item.target}
                    </p>
                  </div>
                  <span className="shrink-0 text-[11px] text-(--earist-body-text)">
                    {item.time}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions — full width */}
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-(--earist-secondary)">
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {[
                {
                  href: "/admin/settings",
                  label: "New Memo",
                  icon: PenLine,
                },
                {
                  href: "/admin/exam/slots",
                  label: "Manage Exam Slots",
                  icon: CalendarClock,
                },
                {
                  href: "/admin/exam/applications",
                  label: "Pending Applications",
                  icon: ClipboardList,
                },
                {
                  href: "/admin/exam/waiver",
                  label: "View Waivers",
                  icon: ShieldCheck,
                },
                {
                  href: "/admin/analytics",
                  label: "Generate Report",
                  icon: BarChart3,
                },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center gap-2 rounded-lg bg-(--earist-surface-gray) p-3 text-xs font-medium text-(--earist-body-text) transition-colors hover:bg-(--earist-surface-light-red) hover:text-(--earist-primary)"
                >
                  <link.icon className="h-4 w-4 shrink-0" />
                  {link.label}
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
