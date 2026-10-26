"use client";

import {
  Users,
  GraduationCap,
  TrendingUp,
  Award,
  BookOpen,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { AnalyticsKpiCard } from "@/types/analytics";

interface AnalyticsKpiRowProps {
  kpis: AnalyticsKpiCard[];
}

export function AnalyticsKpiRow({ kpis }: AnalyticsKpiRowProps) {
  const getIcon = (iconName: AnalyticsKpiCard["iconName"]) => {
    switch (iconName) {
      case "users":
        return Users;
      case "graduation-cap":
        return GraduationCap;
      case "trending-up":
        return TrendingUp;
      case "award":
        return Award;
      case "book-open":
        return BookOpen;
      default:
        return Users;
    }
  };

  return (
    <section aria-label="Key institutional metrics">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {kpis.map((kpi) => {
          const Icon = getIcon(kpi.iconName);
          const isPositive = kpi.isPositiveTrend;

          return (
            <Card key={kpi.id} className="border-(--earist-border-gray) bg-white shadow-2xs">
              <CardContent className="flex items-start justify-between gap-3 p-4">
                <div className="min-w-0 space-y-1">
                  <p className="text-xs font-semibold text-(--earist-body-text)">
                    {kpi.label}
                  </p>
                  <p className="text-2xl font-bold text-(--earist-primary)">
                    {kpi.value}
                  </p>
                  <p className="text-[11px] text-(--earist-body-text)">
                    <span
                      className={`font-semibold ${
                        isPositive ? "text-(--earist-success)" : "text-(--earist-secondary)"
                      }`}
                    >
                      {isPositive ? "+" : "-"}{kpi.changePercentage}%
                    </span>{" "}
                    vs last cycle
                  </p>
                </div>

                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-(--earist-surface-gray) text-(--earist-secondary)">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
