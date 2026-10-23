"use client";

import { useMemo } from "react";
import { Line } from "react-chartjs-2";
import {
  Users,
  GraduationCap,
  TrendingUp,
  Award,
  BookOpen,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { sparklineOptions, EARIST_CHART_COLORS } from "@/lib/chartjs-registry";
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

  const getThemeColors = (index: number) => {
    switch (index % 5) {
      case 0:
        return {
          border: EARIST_CHART_COLORS.primaryMaroon,
          bgSoft: EARIST_CHART_COLORS.primaryMaroonSoft,
          iconBg: "bg-red-50 text-(--earist-primary)",
        };
      case 1:
        return {
          border: EARIST_CHART_COLORS.secondaryNavy,
          bgSoft: EARIST_CHART_COLORS.secondaryNavySoft,
          iconBg: "bg-blue-50 text-(--earist-secondary)",
        };
      case 2:
        return {
          border: EARIST_CHART_COLORS.emeraldGreen,
          bgSoft: EARIST_CHART_COLORS.emeraldGreenSoft,
          iconBg: "bg-emerald-50 text-emerald-600",
        };
      case 3:
        return {
          border: EARIST_CHART_COLORS.accentGold,
          bgSoft: EARIST_CHART_COLORS.accentGoldSoft,
          iconBg: "bg-amber-50 text-amber-600",
        };
      case 4:
        return {
          border: EARIST_CHART_COLORS.purpleIndigo,
          bgSoft: EARIST_CHART_COLORS.purpleIndigoSoft,
          iconBg: "bg-indigo-50 text-indigo-600",
        };
      default:
        return {
          border: EARIST_CHART_COLORS.primaryMaroon,
          bgSoft: EARIST_CHART_COLORS.primaryMaroonSoft,
          iconBg: "bg-red-50 text-(--earist-primary)",
        };
    }
  };

  return (
    <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-5">
      {kpis.map((card, idx) => {
        const IconComponent = getIcon(card.iconName);
        const colors = getThemeColors(idx);

        const sparklineData = {
          labels: card.sparklineData.map((_, i) => `${i}`),
          datasets: [
            {
              data: card.sparklineData,
              borderColor: colors.border,
              backgroundColor: colors.bgSoft,
              fill: true,
              borderWidth: 2,
              tension: 0.4,
              pointRadius: 0,
              pointHoverRadius: 3,
            },
          ],
        };

        const isPositive = card.changePercentage >= 0;

        return (
          <Card
            key={card.id}
            className="overflow-hidden border border-(--earist-border-gray) bg-white transition-all hover:border-(--earist-primary)/30 hover:shadow-xs"
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${colors.iconBg}`}>
                  <IconComponent className="h-5 w-5" />
                </div>
                <Badge
                  variant="outline"
                  className={`border-0 text-[11px] font-semibold ${
                    isPositive ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                  }`}
                >
                  {isPositive ? (
                    <ArrowUpRight className="mr-0.5 h-3 w-3 inline text-emerald-600" />
                  ) : (
                    <ArrowDownRight className="mr-0.5 h-3 w-3 inline text-red-600" />
                  )}
                  {isPositive ? `+${card.changePercentage}%` : `${card.changePercentage}%`}
                </Badge>
              </div>

              <div className="mt-3">
                <p className="text-xs font-medium text-(--earist-body-text) truncate">{card.label}</p>
                <p className="text-2xl font-bold tracking-tight text-gray-900 mt-0.5">{card.value}</p>
                {card.sublabel && (
                  <p className="text-[11px] text-gray-500 mt-0.5 truncate">{card.sublabel}</p>
                )}
              </div>

              {/* Chart.js Inline Sparkline */}
              <div className="mt-3 h-10 w-full">
                <Line data={sparklineData} options={sparklineOptions} />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
