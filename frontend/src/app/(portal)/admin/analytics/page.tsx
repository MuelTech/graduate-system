"use client";

import { Card, CardContent } from "@/components/ui/card";
import { BarChart3, PieChart, TrendingUp, Users } from "lucide-react";

export default function AdminAnalyticsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2
          className="text-2xl font-bold text-(--earist-primary)"
          style={{ fontFamily: '"Calibri", sans-serif' }}
        >
          Academic Analytics
        </h2>
        <p className="text-sm text-(--earist-body-text)">
          Visualize system data, tracking rates, and thesis stage completion.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { icon: Users, label: "Total Students", bg: "bg-blue-50", text: "text-blue-600" },
          { icon: TrendingUp, label: "Entrance Pass Rate", bg: "bg-green-50", text: "text-green-600" },
          { icon: PieChart, label: "Thesis Completion", bg: "bg-purple-50", text: "text-purple-600" },
          { icon: BarChart3, label: "Repository Uploads", bg: "bg-orange-50", text: "text-orange-600" },
        ].map((stat, i) => (
          <Card key={i} className="opacity-60 grayscale transition-all hover:grayscale-0">
            <CardContent className="flex items-center gap-4 p-6">
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${stat.bg}`}>
                <stat.icon className={`h-6 w-6 ${stat.text}`} />
              </div>
              <div>
                <p className="text-sm font-medium text-(--earist-secondary)">{stat.label}</p>
                <p className="text-2xl font-bold text-(--earist-primary)">--</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-dashed border-2 border-(--earist-border-gray) bg-gray-50/50">
        <CardContent className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-(--earist-surface-gray)">
            <BarChart3 className="h-10 w-10 text-(--earist-primary)/50" />
          </div>
          <h3 className="mb-2 text-xl font-bold text-(--earist-primary)">
            Module Coming Soon
          </h3>
          <p className="max-w-md text-sm text-(--earist-body-text)">
            The Academic Analytics dashboard using Chart.js is scheduled for development in <strong>Phase 6</strong>. This module will provide visual dashboards and exportable reports for the Administrator.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
