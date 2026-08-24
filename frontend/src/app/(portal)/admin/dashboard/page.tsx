"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { apiClientRequest } from "@/lib/api.client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  FileCheck2,
  Upload,
  Library,
  CheckCircle2,
  TrendingUp,
  BarChart3,
  PenLine,
  CalendarClock,
  ClipboardList,
  ShieldCheck,
  Loader2,
} from "lucide-react";

// Type definitions for our new backend data
interface DashboardData {
  kpis: {
    label: string;
    value: string;
    trend: string;
    color: string;
    bg: string;
  }[];
  pipelineStages: {
    label: string;
    count: number;
    color: string;
  }[];
  pendingActions: {
    action: string;
    detail: string;
    href: string;
    priority: "high" | "medium" | "low";
    time: string;
  }[];
  recentActivity: {
    actor: string;
    action: string;
    target: string;
    time: string;
  }[];
}

// Icon mapper since we can't send React components via JSON API
const getIcon = (label: string) => {
  if (label.includes("Students")) return Users;
  if (label.includes("Defense")) return FileCheck2;
  if (label.includes("COR")) return Upload;
  if (label.includes("Repository")) return Library;
  return TrendingUp;
};

export default function AdminDashboard() {
  // Fetch real data from our new endpoint
  const { data, isLoading, isError } = useQuery<DashboardData>({
    queryKey: ["adminDashboard"],
    queryFn: () => apiClientRequest("/admin/dashboard", { method: "GET" }),
  });

  if (isLoading) {
    return (
      <div className="flex h-96 flex-col items-center justify-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-(--earist-primary)" />
        <p className="text-sm text-(--earist-body-text)">Loading real-time metrics...</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex h-96 items-center justify-center text-red-500">
        Failed to load dashboard data. Please verify your backend is running.
      </div>
    );
  }

  const maxCount = Math.max(...data.pipelineStages.map((s) => s.count), 1);

  // Helper to format ISO strings to "X mins ago"
  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 60000); 
    if (diff < 1) return "Just now";
    if (diff < 60) return `${diff} min ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)} hours ago`;
    return `${Math.floor(diff / 1440)} days ago`;
  };

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

      {/* KPI Cards (Real Data) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {data.kpis.map((kpi) => {
          const Icon = getIcon(kpi.label);
          return (
            <Card key={kpi.label}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-(--earist-body-text)">{kpi.label}</p>
                    <p className="mt-1 text-2xl font-bold text-(--earist-primary)">
                      {kpi.value}
                    </p>
                    <p className="mt-0.5 text-[11px] text-(--earist-body-text)">
                      {kpi.trend}
                    </p>
                  </div>
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${kpi.bg}`}>
                    <Icon className={`h-5 w-5 ${kpi.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Bento Grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        
        {/* Thesis Pipeline Summary (Real Data) */}
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
              {data.pipelineStages.map((stage) => (
                <div key={stage.label} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 text-xs text-(--earist-body-text)">
                    {stage.label}
                  </span>
                  <div className="flex-1">
                    <div className="h-6 w-full overflow-hidden rounded bg-(--earist-surface-gray)">
                      <div
                        className={`flex h-full items-center justify-end rounded px-2 ${stage.color}`}
                        style={{ width: `${(stage.count / maxCount) * 100}%` }}
                      >
                        <span className="text-xs font-bold text-white">
                          {stage.count}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {data.pipelineStages.every(s => s.count === 0) && (
                <p className="text-sm text-gray-500 text-center py-2">No thesis data available yet.</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Pending Actions (Real Data) */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-(--earist-secondary)">
                Pending Actions
              </CardTitle>
              <Badge className="bg-(--earist-surface-light-red) text-(--earist-primary)">
                {data.pendingActions.length} items
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.pendingActions.map((item, i) => (
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
                    {formatTime(item.time)}
                  </span>
                </Link>
              ))}
              {data.pendingActions.length === 0 && (
                <div className="p-4 text-center text-sm text-gray-500">
                  <CheckCircle2 className="mx-auto mb-2 h-6 w-6 text-green-500" />
                  No pending actions. You&apos;re all caught up!
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity (Real Data) */}
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-(--earist-secondary)">
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
              {data.recentActivity.map((item, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 rounded-lg bg-(--earist-surface-gray) p-3"
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
                    {formatTime(item.time)}
                  </span>
                </div>
              ))}
              {data.recentActivity.length === 0 && (
                <p className="col-span-full py-4 text-center text-sm text-gray-500">
                  No recent activity logged in the system.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions (Static Layout) */}
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-(--earist-secondary)">
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {[
                { href: "/admin/settings", label: "New Memo", icon: PenLine },
                { href: "/admin/exam/slots", label: "Manage Exam Slots", icon: CalendarClock },
                { href: "/admin/exam/applications", label: "Pending Applications", icon: ClipboardList },
                { href: "/admin/exam/waiver", label: "View Waivers", icon: ShieldCheck },
                { href: "/admin/analytics", label: "Generate Report", icon: BarChart3 },
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
