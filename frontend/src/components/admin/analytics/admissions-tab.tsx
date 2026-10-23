"use client";

import { useState, useMemo } from "react";
import { Bar, Line, Doughnut } from "react-chartjs-2";
import {
  GraduationCap,
  TrendingUp,
  Download,
  Search,
  CheckCircle2,
  AlertTriangle,
  Info,
  Filter,
  FileSpreadsheet,
  ArrowUpRight,
  ShieldAlert,
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

  // Filtered applications by selected degree level
  const filteredPrograms = useMemo(() => {
    if (degreeFilter === "ALL") return data.applicationsByProgram;
    return data.applicationsByProgram.filter((p) => p.degreeLevel === degreeFilter);
  }, [data.applicationsByProgram, degreeFilter]);

  // Totals for summary badges
  const programTotals = useMemo(() => {
    const totalApplicants = filteredPrograms.reduce((acc, p) => acc + p.applicantsCount, 0);
    const totalEnrolled = filteredPrograms.reduce((acc, p) => acc + p.enrolledCount, 0);
    const conversionRate = totalApplicants > 0 ? ((totalEnrolled / totalApplicants) * 100).toFixed(1) : "0.0";
    return { totalApplicants, totalEnrolled, conversionRate };
  }, [filteredPrograms]);

  // Horizontal Bar Chart: Applications & Enrollment by Program
  const barChartData = useMemo(() => {
    return {
      labels: filteredPrograms.map((p) => p.programCode),
      datasets: [
        {
          label: "Applicants",
          data: filteredPrograms.map((p) => p.applicantsCount),
          backgroundColor: EARIST_CHART_COLORS.primaryMaroon,
          borderRadius: 6,
          barPercentage: 0.7,
        },
        {
          label: "Officially Enrolled",
          data: filteredPrograms.map((p) => p.enrolledCount),
          backgroundColor: EARIST_CHART_COLORS.secondaryNavy,
          borderRadius: 6,
          barPercentage: 0.7,
        },
      ],
    };
  }, [filteredPrograms]);

  // Line Chart: Monthly Intake Velocity
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
          tension: 0.35,
          pointBackgroundColor: EARIST_CHART_COLORS.primaryMaroon,
        },
        {
          label: "Enrolled",
          data: data.monthlyIntakeTrend.map((m) => m.enrolled),
          borderColor: EARIST_CHART_COLORS.emeraldGreen,
          backgroundColor: "transparent",
          borderDash: [4, 4],
          tension: 0.35,
          pointBackgroundColor: EARIST_CHART_COLORS.emeraldGreen,
        },
      ],
    };
  }, [data.monthlyIntakeTrend]);

  // Doughnut Chart: Alignment Distribution
  const doughnutData = useMemo(() => {
    const dist = data.alignmentDistribution;
    return {
      labels: ["Directly Aligned", "Pending Waiver", "Cleared (Bridging)", "Rejected / Ineligible"],
      datasets: [
        {
          data: [dist.aligned, dist.pendingWaiver, dist.cleared, dist.rejected],
          backgroundColor: [
            EARIST_CHART_COLORS.emeraldGreen,
            EARIST_CHART_COLORS.amberWarning,
            EARIST_CHART_COLORS.secondaryNavy,
            EARIST_CHART_COLORS.dangerRed,
          ],
          borderWidth: 2,
          borderColor: "#FFFFFF",
          hoverOffset: 6,
        },
      ],
    };
  }, [data.alignmentDistribution]);

  // Feeder table filtered by search
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

  // CSV Exporters
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
      {/* Tab Header Banner */}
      <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-(--earist-primary)" />
            Admissions Pipeline & Program Alignment Analytics
          </h2>
          <p className="text-xs text-gray-600">
            Real-time tracking of applicant intake, enrollment conversion velocity, and undergraduate curriculum alignment.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Degree Filter Chips */}
          <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setDegreeFilter("ALL")}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                degreeFilter === "ALL"
                  ? "bg-white text-gray-900 shadow-2xs"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              All Levels
            </button>
            <button
              type="button"
              onClick={() => setDegreeFilter("MASTERS")}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                degreeFilter === "MASTERS"
                  ? "bg-white text-(--earist-primary) shadow-2xs"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Master&apos;s
            </button>
            <button
              type="button"
              onClick={() => setDegreeFilter("DOCTORAL")}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                degreeFilter === "DOCTORAL"
                  ? "bg-white text-(--earist-secondary) shadow-2xs"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Doctoral
            </button>
          </div>

          {/* Quick CSV Export */}
          <Button
            variant="outline"
            size="sm"
            onClick={exportProgramsCsv}
            className="h-8 gap-1.5 border-gray-200 text-xs text-gray-700 hover:bg-gray-50"
          >
            <Download className="h-3.5 w-3.5 text-gray-500" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Row 1: Applications by Program (Horizontal Bar) + Monthly Intake Trend (Line) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left: Applications by Program */}
        <Card className="border-gray-200 shadow-2xs">
          <CardHeader className="pb-3 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold text-gray-900">
                  Applications & Enrollment by Program
                </CardTitle>
                <CardDescription className="text-xs text-gray-500">
                  Comparison between total applicants and matriculated students
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-xs bg-gray-50 border-gray-200">
                {filteredPrograms.length} Programs
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="h-72 w-full">
              <Bar data={barChartData} options={horizontalBarOptions} />
            </div>

            {/* Program Conversion Callout Footer */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-gray-50 p-2.5 text-xs text-gray-600">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-gray-800">Total Applicants:</span>
                <span className="font-bold text-(--earist-primary)">{programTotals.totalApplicants}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-gray-800">Officially Enrolled:</span>
                <span className="font-bold text-(--earist-secondary)">{programTotals.totalEnrolled}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-gray-800">Yield Conversion:</span>
                <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 text-[11px] font-bold">
                  {programTotals.conversionRate}%
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right: Monthly Intake Velocity Trend */}
        <Card className="border-gray-200 shadow-2xs">
          <CardHeader className="pb-3 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold text-gray-900">
                  Monthly Intake & Admission Velocity
                </CardTitle>
                <CardDescription className="text-xs text-gray-500">
                  Intake distribution across the current academic calendar cycle
                </CardDescription>
              </div>
              <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 text-xs">
                Peak Intake: Aug (110)
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="h-72 w-full">
              <Line data={lineChartData} options={baseLineOptions} />
            </div>

            {/* Velocity Note */}
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-indigo-50/60 p-2.5 text-xs text-indigo-900">
              <TrendingUp className="h-4 w-4 text-indigo-600 shrink-0" />
              <span>
                Enrollment peaks during the pre-semester months (July–August and January), reflecting traditional 1st and 2nd Semester intake surge.
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Program Alignment Doughnut & Automated Discipline Evaluation */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Alignment Doughnut (5 cols on lg) */}
        <Card className="border-gray-200 shadow-2xs lg:col-span-5">
          <CardHeader className="pb-3 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold text-gray-900">
                  Undergraduate Alignment Distribution
                </CardTitle>
                <CardDescription className="text-xs text-gray-500">
                  Automated prerequisite evaluation per curriculum matrix
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-xs text-gray-600">
                {totalEvaluated} Evaluated
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="h-64 w-full">
              <Doughnut data={doughnutData} options={baseDoughnutOptions} />
            </div>

            {/* Custom Interactive Legend Cards */}
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-2">
                <div className="flex items-center justify-between text-emerald-900 font-semibold">
                  <span>Aligned</span>
                  <span>{((data.alignmentDistribution.aligned / totalEvaluated) * 100).toFixed(1)}%</span>
                </div>
                <p className="text-[11px] text-emerald-700 font-bold">{data.alignmentDistribution.aligned} applicants</p>
              </div>

              <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-2">
                <div className="flex items-center justify-between text-amber-900 font-semibold">
                  <span>Pending Waiver</span>
                  <span>{((data.alignmentDistribution.pendingWaiver / totalEvaluated) * 100).toFixed(1)}%</span>
                </div>
                <p className="text-[11px] text-amber-700 font-bold">{data.alignmentDistribution.pendingWaiver} applicants</p>
              </div>

              <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-2">
                <div className="flex items-center justify-between text-blue-900 font-semibold">
                  <span>Cleared</span>
                  <span>{((data.alignmentDistribution.cleared / totalEvaluated) * 100).toFixed(1)}%</span>
                </div>
                <p className="text-[11px] text-blue-700 font-bold">{data.alignmentDistribution.cleared} applicants</p>
              </div>

              <div className="rounded-lg border border-red-100 bg-red-50/50 p-2">
                <div className="flex items-center justify-between text-red-900 font-semibold">
                  <span>Ineligible</span>
                  <span>{((data.alignmentDistribution.rejected / totalEvaluated) * 100).toFixed(1)}%</span>
                </div>
                <p className="text-[11px] text-red-700 font-bold">{data.alignmentDistribution.rejected} applicants</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right: Alignment Evaluation & Institutional Policy Context (7 cols on lg) */}
        <Card className="border-gray-200 shadow-2xs lg:col-span-7 flex flex-col justify-between">
          <CardHeader className="pb-3 border-b border-gray-100">
            <CardTitle className="text-sm font-bold text-gray-900">
              Alignment Criteria & Bridging Compliance
            </CardTitle>
            <CardDescription className="text-xs text-gray-500">
              Institutional criteria mandated by EARIST Graduate School and CHED CMO Guidelines
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 pt-4">
            {/* 4 Summary Stat Tiles */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-gray-100 bg-gray-50/80 p-3 text-center">
                <p className="text-[11px] text-gray-500 font-medium">Direct Alignment</p>
                <p className="text-xl font-bold text-emerald-600 mt-1">65.8%</p>
                <p className="text-[10px] text-gray-400 mt-0.5">345 Applicants</p>
              </div>

              <div className="rounded-lg border border-gray-100 bg-gray-50/80 p-3 text-center">
                <p className="text-[11px] text-gray-500 font-medium">Under Review</p>
                <p className="text-xl font-bold text-amber-600 mt-1">15.6%</p>
                <p className="text-[10px] text-gray-400 mt-0.5">82 Pending</p>
              </div>

              <div className="rounded-lg border border-gray-100 bg-gray-50/80 p-3 text-center">
                <p className="text-[11px] text-gray-500 font-medium">Waivers Cleared</p>
                <p className="text-xl font-bold text-blue-600 mt-1">14.1%</p>
                <p className="text-[10px] text-gray-400 mt-0.5">74 Endorsed</p>
              </div>

              <div className="rounded-lg border border-gray-100 bg-gray-50/80 p-3 text-center">
                <p className="text-[11px] text-gray-500 font-medium">Disqualified</p>
                <p className="text-xl font-bold text-red-600 mt-1">4.4%</p>
                <p className="text-[10px] text-gray-400 mt-0.5">23 Ineligible</p>
              </div>
            </div>

            {/* Workflow Guidance & Institutional Policy Alert */}
            <div className="space-y-2.5 rounded-lg border border-blue-100 bg-blue-50/40 p-3 text-xs text-blue-950">
              <div className="flex items-center gap-1.5 font-bold text-blue-900">
                <Info className="h-4 w-4 text-(--earist-secondary)" />
                <span>Undergraduate Alignment Evaluation Procedure</span>
              </div>
              <ul className="space-y-1.5 text-[11px] leading-relaxed text-blue-900/90 pl-5 list-disc">
                <li>
                  <strong>Aligned Discipline:</strong> Applicant undergraduate major directly matches Graduate Program requirements (e.g., BSBA into MBA). Unconditional matriculation granted.
                </li>
                <li>
                  <strong>Bridging Waiver Required:</strong> Non-aligned disciplines (e.g., Nursing/Engineering shifting to MBA or MPA) require completion of 6–9 foundation bridging units or Dean&apos;s waiver clearance prior to candidacy.
                </li>
                <li>
                  <strong>Automated Pre-Check:</strong> The system automatically flags discrepancies during applicant document upload to prevent post-enrollment curriculum invalidation.
                </li>
              </ul>
            </div>

            {/* Pending Waivers Urgent Callout */}
            <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-950">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0" />
                <div>
                  <span className="font-bold">82 Pending Bridging Waivers</span>
                  <p className="text-[11px] text-amber-800">
                    Awaiting Academic Council endorsement and program chair prerequisite assignment.
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-7 border-amber-300 bg-white text-xs text-amber-900 hover:bg-amber-100"
                onClick={() => setSearchTerm("Career Shift")}
              >
                Review Flagged
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Top Feeder Undergraduate Programs Breakdown Table */}
      <Card className="border-gray-200 shadow-2xs">
        <CardHeader className="border-b border-gray-100 pb-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-sm font-bold text-gray-900">
                Feeder Undergraduate Programs & Alignment Matrix
              </CardTitle>
              <CardDescription className="text-xs text-gray-500">
                Breakdown of bachelor&apos;s degrees supplying the graduate student body
              </CardDescription>
            </div>

            <div className="flex items-center gap-2">
              {/* Search Bar */}
              <div className="relative w-56">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Filter degree or program..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-8 pl-8 text-xs border-gray-200"
                />
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={exportFeederCsv}
                className="h-8 gap-1.5 border-gray-200 text-xs text-gray-700 hover:bg-gray-50"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                Export Matrix
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-700">
              <thead className="bg-gray-50 text-[11px] font-semibold uppercase tracking-wider text-gray-500 border-b border-gray-100">
                <tr>
                  <th scope="col" className="px-4 py-3">Undergraduate Degree</th>
                  <th scope="col" className="px-3 py-3">Discipline Category</th>
                  <th scope="col" className="px-3 py-3 text-center">Applicants</th>
                  <th scope="col" className="px-4 py-3">Intended Graduate Program</th>
                  <th scope="col" className="px-3 py-3 text-center">Alignment Rate</th>
                  <th scope="col" className="px-3 py-3 text-center">Pending Waivers</th>
                  <th scope="col" className="px-4 py-3 text-right">Pathway Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredFeeders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-xs text-gray-400">
                      No undergraduate feeder degrees match your search filter.
                    </td>
                  </tr>
                ) : (
                  filteredFeeders.map((item, idx) => (
                    <tr key={idx} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-4 py-3 font-semibold text-gray-900">
                        {item.undergradDegree}
                      </td>
                      <td className="px-3 py-3">
                        <Badge variant="outline" className="text-[10px] bg-gray-50 border-gray-200 font-normal">
                          {item.category}
                        </Badge>
                      </td>
                      <td className="px-3 py-3 text-center font-bold text-gray-800">
                        {item.applicantCount}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {item.intendedGraduateProgram}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <div className="h-2 w-16 rounded-full bg-gray-100 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                item.alignmentRate >= 80
                                  ? "bg-emerald-500"
                                  : item.alignmentRate >= 50
                                  ? "bg-amber-500"
                                  : "bg-red-500"
                              }`}
                              style={{ width: `${Math.min(item.alignmentRate, 100)}%` }}
                            />
                          </div>
                          <span className="font-semibold text-gray-700 text-[11px]">
                            {item.alignmentRate.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center">
                        {item.pendingWaivers > 0 ? (
                          <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 text-[10px] font-semibold">
                            {item.pendingWaivers} Pending
                          </Badge>
                        ) : (
                          <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50 text-[10px]">
                            Cleared
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {item.alignmentRate >= 85 ? (
                          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 text-[10px]">
                            Direct Pathway
                          </Badge>
                        ) : item.alignmentRate >= 40 ? (
                          <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 text-[10px]">
                            Bridging Required
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 text-[10px]">
                            Special Waiver
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

/**
 * Client-side CSV generation and instant browser download
 */
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
