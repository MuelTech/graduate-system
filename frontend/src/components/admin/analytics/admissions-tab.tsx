"use client";

import { useState, useMemo } from "react";
import { Bar, Line, Doughnut } from "react-chartjs-2";
import {
  GraduationCap,
  Download,
  Search,
  Filter,
  FileSpreadsheet,
  Info,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  EARIST_CHART_COLORS,
  horizontalBarOptions,
  baseLineOptions,
  baseDoughnutOptions,
} from "@/lib/chartjs-registry";
import type {
  AdmissionsAnalyticsData,
  DegreeLevel,
  ProgramApplicationCount,
  UndergradFeederProgram,
} from "@/types/analytics";

interface AdmissionsTabProps {
  data: AdmissionsAnalyticsData;
}

export function AdmissionsTab({ data }: AdmissionsTabProps) {
  const [degreeFilter, setDegreeFilter] = useState<"ALL" | DegreeLevel>("ALL");
  const [searchTerm, setSearchTerm] = useState("");

  const filteredPrograms = useMemo(() => {
    if (degreeFilter === "ALL") return data.applicationsByProgram;
    return data.applicationsByProgram.filter((p) => p.degreeLevel === degreeFilter);
  }, [data.applicationsByProgram, degreeFilter]);

  const programTotals = useMemo(() => {
    const totalApplicants = filteredPrograms.reduce((acc, p) => acc + p.applicantsCount, 0);
    const totalEnrolled = filteredPrograms.reduce((acc, p) => acc + p.enrolledCount, 0);
    const conversionRate = totalApplicants > 0 ? ((totalEnrolled / totalApplicants) * 100).toFixed(1) : "0.0";
    return { totalApplicants, totalEnrolled, conversionRate };
  }, [filteredPrograms]);

  // Horizontal Bar Chart
  const barChartData = useMemo(() => {
    return {
      labels: filteredPrograms.map((p) => p.programCode),
      datasets: [
        {
          label: "Applicants",
          data: filteredPrograms.map((p) => p.applicantsCount),
          backgroundColor: EARIST_CHART_COLORS.primaryMaroon,
          borderRadius: 4,
          barPercentage: 0.7,
        },
        {
          label: "Officially Enrolled",
          data: filteredPrograms.map((p) => p.enrolledCount),
          backgroundColor: EARIST_CHART_COLORS.secondaryNavy,
          borderRadius: 4,
          barPercentage: 0.7,
        },
      ],
    };
  }, [filteredPrograms]);

  // Line Chart
  const lineChartData = useMemo(() => {
    return {
      labels: data.monthlyIntakeTrend.map((m) => m.month),
      datasets: [
        {
          label: "Applicants",
          data: data.monthlyIntakeTrend.map((m) => m.applicants),
          borderColor: EARIST_CHART_COLORS.primaryMaroon,
          backgroundColor: EARIST_CHART_COLORS.primaryMaroonSoft,
          fill: true,
          tension: 0.3,
          pointBackgroundColor: EARIST_CHART_COLORS.primaryMaroon,
        },
        {
          label: "Enrolled",
          data: data.monthlyIntakeTrend.map((m) => m.enrolled),
          borderColor: EARIST_CHART_COLORS.emeraldGreen,
          backgroundColor: "transparent",
          borderDash: [3, 3],
          tension: 0.3,
          pointBackgroundColor: EARIST_CHART_COLORS.emeraldGreen,
        },
      ],
    };
  }, [data.monthlyIntakeTrend]);

  // Doughnut Chart
  const doughnutData = useMemo(() => {
    const dist = data.alignmentDistribution;
    return {
      labels: ["Directly Aligned", "Pending Waiver", "Cleared (Bridging)", "Ineligible"],
      datasets: [
        {
          data: [dist.aligned, dist.pendingWaiver, dist.cleared, dist.rejected],
          backgroundColor: [
            EARIST_CHART_COLORS.emeraldGreen,
            EARIST_CHART_COLORS.amberWarning,
            EARIST_CHART_COLORS.secondaryNavy,
            EARIST_CHART_COLORS.dangerRed,
          ],
          borderWidth: 1,
          borderColor: "#FFFFFF",
        },
      ],
    };
  }, [data.alignmentDistribution]);

  // Filtered feeder table
  const filteredFeeders = useMemo(() => {
    if (!searchTerm.trim()) return data.feederPrograms;
    const term = searchTerm.toLowerCase();
    return data.feederPrograms.filter(
      (f) =>
        f.undergradDegree.toLowerCase().includes(term) ||
        f.category.toLowerCase().includes(term) ||
        f.intendedGraduateProgram.toLowerCase().includes(term)
    );
  }, [data.feederPrograms, searchTerm]);

  const exportProgramsCsv = () => {
    const headers = ["Program Code", "Program Name", "Degree Level", "Applicants", "Enrolled", "Conversion Rate %"];
    const rows = filteredPrograms.map((p) => [
      p.programCode,
      p.programName,
      p.degreeLevel,
      p.applicantsCount,
      p.enrolledCount,
      ((p.enrolledCount / (p.applicantsCount || 1)) * 100).toFixed(1),
    ]);
    downloadCsv("EARIST_Graduate_Applications_by_Program.csv", headers, rows);
  };

  const exportFeederCsv = () => {
    const headers = [
      "Undergraduate Degree",
      "Discipline Category",
      "Applicant Count",
      "Intended Graduate Program",
      "Alignment Rate %",
      "Pending Waivers",
    ];
    const rows = filteredFeeders.map((f) => [
      f.undergradDegree,
      f.category,
      f.applicantCount,
      f.intendedGraduateProgram,
      f.alignmentRate.toFixed(1),
      f.pendingWaivers,
    ]);
    downloadCsv("EARIST_Feeder_Programs_Alignment_Matrix.csv", headers, rows);
  };

  const totalEvaluated =
    data.alignmentDistribution.aligned +
    data.alignmentDistribution.pendingWaiver +
    data.alignmentDistribution.cleared +
    data.alignmentDistribution.rejected;

  return (
    <div className="space-y-6">
      {/* Tab Filter & Actions Bar */}
      <div className="flex flex-col gap-3 rounded-lg border border-(--earist-border-gray) bg-white p-3.5 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-bold text-(--earist-primary)">
            Admissions Pipeline & Program Alignment
          </h2>
          <p className="text-xs text-(--earist-body-text)">
            Applicant intake, matriculation yield, and undergraduate discipline alignment.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Degree Filter Chips */}
          <div className="inline-flex rounded-md border border-(--earist-border-gray) bg-(--earist-surface-gray) p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setDegreeFilter("ALL")}
              className={`rounded px-2.5 py-1 text-xs font-medium transition-all ${
                degreeFilter === "ALL"
                  ? "bg-white text-(--earist-primary) shadow-2xs font-semibold"
                  : "text-(--earist-body-text) hover:text-gray-900"
              }`}
            >
              All Programs
            </button>
            <button
              type="button"
              onClick={() => setDegreeFilter("MASTERS")}
              className={`rounded px-2.5 py-1 text-xs font-medium transition-all ${
                degreeFilter === "MASTERS"
                  ? "bg-white text-(--earist-primary) shadow-2xs font-semibold"
                  : "text-(--earist-body-text) hover:text-gray-900"
              }`}
            >
              Master&apos;s
            </button>
            <button
              type="button"
              onClick={() => setDegreeFilter("DOCTORAL")}
              className={`rounded px-2.5 py-1 text-xs font-medium transition-all ${
                degreeFilter === "DOCTORAL"
                  ? "bg-white text-(--earist-primary) shadow-2xs font-semibold"
                  : "text-(--earist-body-text) hover:text-gray-900"
              }`}
            >
              Doctoral
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={exportProgramsCsv}
            className="h-8 gap-1.5 border-(--earist-border-gray) bg-white text-xs text-(--earist-body-text) hover:bg-(--earist-surface-gray)"
          >
            <Download className="h-3.5 w-3.5 text-gray-500" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Row 1: Applications by Program + Monthly Intake Velocity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left: Applications by Program */}
        <Card className="border-(--earist-border-gray) bg-white shadow-2xs">
          <CardHeader className="border-b border-(--earist-border-gray) bg-(--earist-surface-gray) py-3 px-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold text-(--earist-primary)">
                  Applications & Enrollment by Program
                </CardTitle>
                <CardDescription className="text-xs text-(--earist-body-text)">
                  Total applicants compared to officially matriculated students
                </CardDescription>
              </div>
              <span className="text-xs font-semibold text-(--earist-body-text)">
                {filteredPrograms.length} Programs
              </span>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="h-68 w-full">
              <Bar data={barChartData} options={horizontalBarOptions} />
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-(--earist-border-gray) pt-3 text-xs text-(--earist-body-text)">
              <div>
                Applicants: <strong className="text-(--earist-primary)">{programTotals.totalApplicants}</strong>
              </div>
              <div>
                Enrolled: <strong className="text-(--earist-secondary)">{programTotals.totalEnrolled}</strong>
              </div>
              <div>
                Conversion Yield: <strong className="text-(--earist-success)">{programTotals.conversionRate}%</strong>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right: Monthly Intake Velocity Trend */}
        <Card className="border-(--earist-border-gray) bg-white shadow-2xs">
          <CardHeader className="border-b border-(--earist-border-gray) bg-(--earist-surface-gray) py-3 px-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold text-(--earist-primary)">
                  Monthly Intake & Admission Velocity
                </CardTitle>
                <CardDescription className="text-xs text-(--earist-body-text)">
                  Application influx across the current academic calendar
                </CardDescription>
              </div>
              <span className="text-xs font-medium text-(--earist-warning)">
                Peak: August (110)
              </span>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="h-68 w-full">
              <Line data={lineChartData} options={baseLineOptions} />
            </div>

            <div className="mt-3 border-t border-(--earist-border-gray) pt-3 text-xs text-(--earist-body-text)">
              Surge occurs during pre-semester registration intervals (July–August and January).
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Program Alignment Doughnut & Criteria */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Alignment Doughnut (5 cols) */}
        <Card className="border-(--earist-border-gray) bg-white shadow-2xs lg:col-span-5 flex flex-col justify-between">
          <CardHeader className="border-b border-(--earist-border-gray) bg-(--earist-surface-gray) py-3 px-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold text-(--earist-primary)">
                  Undergraduate Alignment Distribution
                </CardTitle>
                <CardDescription className="text-xs text-(--earist-body-text)">
                  Automated discipline matching per curriculum matrix
                </CardDescription>
              </div>
              <span className="text-xs text-(--earist-body-text)">
                {totalEvaluated} Total
              </span>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="h-60 w-full">
              <Doughnut data={doughnutData} options={baseDoughnutOptions} />
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-xs border-t border-(--earist-border-gray) pt-3">
              <div className="rounded border border-(--earist-border-gray) bg-(--earist-surface-gray) p-2">
                <span className="text-[11px] text-(--earist-body-text) block">Aligned</span>
                <span className="font-bold text-(--earist-success)">{data.alignmentDistribution.aligned} (65.8%)</span>
              </div>
              <div className="rounded border border-(--earist-border-gray) bg-(--earist-surface-gray) p-2">
                <span className="text-[11px] text-(--earist-body-text) block">Pending Waiver</span>
                <span className="font-bold text-(--earist-warning)">{data.alignmentDistribution.pendingWaiver} (15.6%)</span>
              </div>
              <div className="rounded border border-(--earist-border-gray) bg-(--earist-surface-gray) p-2">
                <span className="text-[11px] text-(--earist-body-text) block">Cleared</span>
                <span className="font-bold text-(--earist-secondary)">{data.alignmentDistribution.cleared} (14.1%)</span>
              </div>
              <div className="rounded border border-(--earist-border-gray) bg-(--earist-surface-gray) p-2">
                <span className="text-[11px] text-(--earist-body-text) block">Ineligible</span>
                <span className="font-bold text-(--earist-primary)">{data.alignmentDistribution.rejected} (4.4%)</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right: Institutional Alignment Policy (7 cols) */}
        <Card className="border-(--earist-border-gray) bg-white shadow-2xs lg:col-span-7 flex flex-col justify-between">
          <CardHeader className="border-b border-(--earist-border-gray) bg-(--earist-surface-gray) py-3 px-4">
            <CardTitle className="text-sm font-bold text-(--earist-primary)">
              Bridging Requirements & Alignment Matrix
            </CardTitle>
            <CardDescription className="text-xs text-(--earist-body-text)">
              Institutional policy under EARIST Graduate School and CHED CMO Guidelines
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 pt-4">
            {/* 4 Stat Tiles */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-(--earist-border-gray) bg-(--earist-surface-gray) p-3 text-center">
                <p className="text-[11px] text-(--earist-body-text)">Direct Alignment</p>
                <p className="text-xl font-bold text-(--earist-success) mt-1">65.8%</p>
                <p className="text-[10px] text-gray-500">345 Applicants</p>
              </div>

              <div className="rounded-lg border border-(--earist-border-gray) bg-(--earist-surface-gray) p-3 text-center">
                <p className="text-[11px] text-(--earist-body-text)">Under Review</p>
                <p className="text-xl font-bold text-(--earist-warning) mt-1">15.6%</p>
                <p className="text-[10px] text-gray-500">82 Pending</p>
              </div>

              <div className="rounded-lg border border-(--earist-border-gray) bg-(--earist-surface-gray) p-3 text-center">
                <p className="text-[11px] text-(--earist-body-text)">Waivers Cleared</p>
                <p className="text-xl font-bold text-(--earist-secondary) mt-1">14.1%</p>
                <p className="text-[10px] text-gray-500">74 Endorsed</p>
              </div>

              <div className="rounded-lg border border-(--earist-border-gray) bg-(--earist-surface-gray) p-3 text-center">
                <p className="text-[11px] text-(--earist-body-text)">Disqualified</p>
                <p className="text-xl font-bold text-(--earist-primary) mt-1">4.4%</p>
                <p className="text-[10px] text-gray-500">23 Ineligible</p>
              </div>
            </div>

            {/* Policy Criteria Summary */}
            <div className="space-y-2 rounded-lg border border-(--earist-border-gray) bg-(--earist-surface-gray) p-3 text-xs text-(--earist-body-text)">
              <div className="flex items-center gap-1.5 font-bold text-(--earist-primary)">
                <Info className="h-4 w-4" />
                <span>Evaluation Rules:</span>
              </div>
              <ul className="space-y-1 text-[11px] pl-5 list-disc text-(--earist-body-text)">
                <li>
                  <strong>Direct Pathway:</strong> Undergraduate discipline matches the graduate program curriculum. Regular matriculation granted without prerequisites.
                </li>
                <li>
                  <strong>Bridging Prerequisite:</strong> Non-aligned disciplines require 6–9 foundation bridging units or Dean waiver endorsement before thesis candidacy.
                </li>
                <li>
                  <strong>Flagged Records:</strong> 82 applicants currently have pending Applicant Program Alignment Form submissions requiring Program Chair recommendation.
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Feeder Programs Table */}
      <Card className="border-(--earist-border-gray) bg-white shadow-2xs">
        <CardHeader className="border-b border-(--earist-border-gray) bg-(--earist-surface-gray) py-3 px-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-sm font-bold text-(--earist-primary)">
                Feeder Undergraduate Degrees & Discipline Breakdown
              </CardTitle>
              <CardDescription className="text-xs text-(--earist-body-text)">
                Undergraduate qualifications of graduate applicants and alignment rates
              </CardDescription>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative w-56">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Filter degree..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-8 pl-8 text-xs border-(--earist-border-gray) bg-white"
                />
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={exportFeederCsv}
                className="h-8 gap-1.5 border-(--earist-border-gray) bg-white text-xs text-(--earist-body-text) hover:bg-(--earist-surface-gray)"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-gray-500" />
                Export Matrix
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-(--earist-body-text)">
              <thead className="bg-(--earist-surface-gray) text-[11px] font-semibold text-(--earist-body-text) border-b border-(--earist-border-gray)">
                <tr>
                  <th scope="col" className="px-4 py-3">Undergraduate Degree</th>
                  <th scope="col" className="px-3 py-3">Discipline</th>
                  <th scope="col" className="px-3 py-3 text-center">Applicants</th>
                  <th scope="col" className="px-4 py-3">Intended Graduate Program</th>
                  <th scope="col" className="px-3 py-3 text-center">Alignment Rate</th>
                  <th scope="col" className="px-3 py-3 text-center">Pending Waivers</th>
                  <th scope="col" className="px-4 py-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-(--earist-border-gray)">
                {filteredFeeders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-xs text-gray-400">
                      No undergraduate feeder degrees match your filter.
                    </td>
                  </tr>
                ) : (
                  filteredFeeders.map((item, idx) => (
                    <tr key={idx} className="hover:bg-(--earist-surface-gray)/60 transition-colors">
                      <td className="px-4 py-3 font-semibold text-foreground">
                        {item.undergradDegree}
                      </td>
                      <td className="px-3 py-3 text-xs text-(--earist-body-text)">
                        {item.category}
                      </td>
                      <td className="px-3 py-3 text-center font-bold text-foreground">
                        {item.applicantCount}
                      </td>
                      <td className="px-4 py-3 text-xs text-(--earist-body-text)">
                        {item.intendedGraduateProgram}
                      </td>
                      <td className="px-3 py-3 text-center font-medium">
                        {item.alignmentRate.toFixed(1)}%
                      </td>
                      <td className="px-3 py-3 text-center">
                        {item.pendingWaivers > 0 ? (
                          <span className="font-semibold text-(--earist-warning)">
                            {item.pendingWaivers} Pending
                          </span>
                        ) : (
                          <span className="text-(--earist-success)">Cleared</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {item.alignmentRate >= 80 ? (
                          <Badge variant="outline" className="border-(--earist-success) text-(--earist-success) text-[10px]">
                            Direct Pathway
                          </Badge>
                        ) : item.alignmentRate >= 50 ? (
                          <Badge variant="outline" className="border-(--earist-secondary) text-(--earist-secondary) text-[10px]">
                            Bridging Required
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-(--earist-warning) text-(--earist-warning) text-[10px]">
                            Waiver Review
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const content = [
    headers.join(","),
    ...rows.map((row) =>
      row
        .map((val) => {
          const stringVal = String(val ?? "");
          return `"${stringVal.replace(/"/g, '""')}"`;
        })
        .join(",")
    ),
  ].join("\r\n");

  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
