"use client";

import { useState, useMemo } from "react";
import { Bar, Line, Doughnut } from "react-chartjs-2";
import {
  BookOpen,
  TrendingDown,
  Download,
  Search,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Award,
  Layers,
  FileSpreadsheet,
  ExternalLink,
  Eye,
  CheckCircle2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  EARIST_CHART_COLORS,
  baseBarOptions,
  horizontalBarOptions,
  baseLineOptions,
  baseDoughnutOptions,
} from "@/lib/chartjs-registry";
import type { ThesisPipelineAnalyticsData } from "@/types/analytics";

interface ThesisPipelineTabProps {
  data: ThesisPipelineAnalyticsData;
}

export function ThesisPipelineTab({ data }: ThesisPipelineTabProps) {
  const [searchTerm, setSearchTerm] = useState("");

  // Horizontal Bar Chart: Defense Funnel Stages (Active vs Completed)
  const funnelChartData = useMemo(() => {
    return {
      labels: data.defenseFunnel.map((f) => f.stageLabel),
      datasets: [
        {
          label: "Active Candidates",
          data: data.defenseFunnel.map((f) => f.activeCount),
          backgroundColor: EARIST_CHART_COLORS.primaryMaroon,
          borderRadius: 6,
          barPercentage: 0.65,
        },
        {
          label: "Completed & Cleared",
          data: data.defenseFunnel.map((f) => f.completedCount),
          backgroundColor: EARIST_CHART_COLORS.secondaryNavy,
          borderRadius: 6,
          barPercentage: 0.65,
        },
      ],
    };
  }, [data.defenseFunnel]);

  // Grouped Bar Chart: Stage Completion Pass Rates by Program
  const stageRatesChartData = useMemo(() => {
    return {
      labels: data.stageCompletionRates.map((p) => {
        // Shorten program name for axis readability
        if (p.programName.includes("Business")) return "MBA";
        if (p.programName.includes("Public")) return "MPA";
        if (p.programName.includes("Education -")) return "MAED-EM";
        if (p.programName.includes("Information")) return "MSIT";
        if (p.programName.includes("Doctor of Education")) return "EdD";
        return p.programName;
      }),
      datasets: [
        {
          label: "Title Defense (%)",
          data: data.stageCompletionRates.map((p) => p.titlePassRate),
          backgroundColor: EARIST_CHART_COLORS.primaryMaroon,
          borderRadius: 5,
        },
        {
          label: "Proposal Defense (%)",
          data: data.stageCompletionRates.map((p) => p.proposalPassRate),
          backgroundColor: EARIST_CHART_COLORS.accentGold,
          borderRadius: 5,
        },
        {
          label: "Final Defense (%)",
          data: data.stageCompletionRates.map((p) => p.finalPassRate),
          backgroundColor: EARIST_CHART_COLORS.emeraldGreen,
          borderRadius: 5,
        },
      ],
    };
  }, [data.stageCompletionRates]);

  // Line Chart: STRIKE Monthly Plagiarism Similarity Trend
  const strikeTrendChartData = useMemo(() => {
    return {
      labels: data.plagiarism.monthlySimilarityTrend.map((m) => m.month),
      datasets: [
        {
          label: "Avg. Similarity Index (%)",
          data: data.plagiarism.monthlySimilarityTrend.map((m) => m.averageSimilarity),
          borderColor: EARIST_CHART_COLORS.purpleIndigo,
          backgroundColor: EARIST_CHART_COLORS.purpleIndigoSoft,
          fill: true,
          tension: 0.35,
          pointBackgroundColor: EARIST_CHART_COLORS.purpleIndigo,
        },
      ],
    };
  }, [data.plagiarism.monthlySimilarityTrend]);

  // Doughnut Chart: STRIKE Similarity Brackets
  const strikeBracketsChartData = useMemo(() => {
    const sb = data.plagiarism.similarityBrackets;
    return {
      labels: ["<10% Highly Original", "10–19.9% Acceptable", "≥20% Flagged / Revision"],
      datasets: [
        {
          data: [sb.belowTenPercent, sb.tenToNineteenPercent, sb.twentyPercentAndAbove],
          backgroundColor: [
            EARIST_CHART_COLORS.emeraldGreen,
            EARIST_CHART_COLORS.cyanBlue,
            EARIST_CHART_COLORS.dangerRed,
          ],
          borderWidth: 2,
          borderColor: "#FFFFFF",
          hoverOffset: 6,
        },
      ],
    };
  }, [data.plagiarism.similarityBrackets]);

  // Doughnut Chart: Repository Publications by Department
  const repositoryDeptChartData = useMemo(() => {
    return {
      labels: data.repository.downloadsByDepartment.map((d) => d.department.replace("Graduate ", "")),
      datasets: [
        {
          data: data.repository.downloadsByDepartment.map((d) => d.publicationsCount),
          backgroundColor: [
            EARIST_CHART_COLORS.primaryMaroon,
            EARIST_CHART_COLORS.secondaryNavy,
            EARIST_CHART_COLORS.accentGold,
            EARIST_CHART_COLORS.emeraldGreen,
          ],
          borderWidth: 2,
          borderColor: "#FFFFFF",
          hoverOffset: 6,
        },
      ],
    };
  }, [data.repository.downloadsByDepartment]);

  // Filtered Top Manuscripts
  const filteredManuscripts = useMemo(() => {
    if (!searchTerm.trim()) return data.repository.topDownloadedManuscripts;
    const term = searchTerm.toLowerCase();
    return data.repository.topDownloadedManuscripts.filter(
      (m) =>
        m.title.toLowerCase().includes(term) ||
        m.author.toLowerCase().includes(term) ||
        m.program.toLowerCase().includes(term)
    );
  }, [data.repository.topDownloadedManuscripts, searchTerm]);

  // Total Plagiarism Evaluated
  const totalStrikeSubmissions =
    data.plagiarism.similarityBrackets.belowTenPercent +
    data.plagiarism.similarityBrackets.tenToNineteenPercent +
    data.plagiarism.similarityBrackets.twentyPercentAndAbove;

  // CSV Exporters
  const exportFunnelCsv = () => {
    const headers = ["Defense Stage", "Active Candidates", "Completed Count", "Avg Turnaround Days"];
    const rows = data.defenseFunnel.map((f) => [
      f.stageLabel,
      f.activeCount,
      f.completedCount,
      f.averageTurnaroundDays,
    ]);
    downloadCsv("EARIST_Thesis_Defense_Funnel.csv", headers, rows);
  };

  const exportStrikeCsv = () => {
    const headers = ["Month", "Average Similarity %", "Institutional Max Threshold %"];
    const rows = data.plagiarism.monthlySimilarityTrend.map((t) => [t.month, t.averageSimilarity, 20.0]);
    downloadCsv("EARIST_STRIKE_Plagiarism_Trend.csv", headers, rows);
  };

  const exportRepositoryCsv = () => {
    const headers = ["Rank", "Manuscript Title", "Author", "Program", "Published Year", "Downloads", "Views"];
    const rows = data.repository.topDownloadedManuscripts.map((m) => [
      m.rank,
      m.title,
      m.author,
      m.program,
      m.publishedYear,
      m.downloads,
      m.views,
    ]);
    downloadCsv("EARIST_Research_Repository_Downloads.csv", headers, rows);
  };

  return (
    <div className="space-y-6">
      {/* Tab Header Banner */}
      <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-(--earist-primary)" />
            Thesis Defense Pipeline & STRIKE Plagiarism Analytics
          </h2>
          <p className="text-xs text-gray-600">
            End-to-end monitoring of thesis stage throughput (Title &rarr; Proposal &rarr; Final), STRIKE similarity benchmarks, and E-Library research output.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={exportFunnelCsv}
            className="h-8 gap-1.5 border-gray-200 text-xs text-gray-700 hover:bg-gray-50"
          >
            <Download className="h-3.5 w-3.5 text-gray-500" />
            Export Funnel
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={exportStrikeCsv}
            className="h-8 gap-1.5 border-gray-200 text-xs text-gray-700 hover:bg-gray-50"
          >
            <ShieldCheck className="h-3.5 w-3.5 text-indigo-600" />
            Export STRIKE Log
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={exportRepositoryCsv}
            className="h-8 gap-1.5 border-gray-200 text-xs text-gray-700 hover:bg-gray-50"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
            Export Repository
          </Button>
        </div>
      </div>

      {/* Row 1: Sequential Defense Funnel + Turnaround Velocity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Sequential Funnel Horizontal Bar (6 cols) */}
        <Card className="border-gray-200 shadow-2xs lg:col-span-6 flex flex-col justify-between">
          <CardHeader className="pb-3 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold text-gray-900">
                  Sequential Defense Stage Funnel
                </CardTitle>
                <CardDescription className="text-xs text-gray-500">
                  Candidate volume across Title, Proposal, and Final Defense
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-xs text-gray-600">
                3 Milestones
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="pt-4">
            <div className="h-64 w-full">
              <Bar data={funnelChartData} options={horizontalBarOptions} />
            </div>

            {/* Turnaround Velocity Cards */}
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
              {data.defenseFunnel.map((stage, idx) => (
                <div key={idx} className="rounded-lg border border-gray-100 bg-gray-50/80 p-2.5">
                  <p className="text-[10px] uppercase font-semibold text-gray-500">{stage.stageLabel}</p>
                  <p className="text-base font-bold text-gray-900 mt-0.5">{stage.averageTurnaroundDays} Days</p>
                  <p className="text-[10px] text-gray-400">Avg. Turnaround</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Right: Stage Completion Rates by Program (6 cols) */}
        <Card className="border-gray-200 shadow-2xs lg:col-span-6 flex flex-col justify-between">
          <CardHeader className="pb-3 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold text-gray-900">
                  Stage Pass Rates by Graduate Program
                </CardTitle>
                <CardDescription className="text-xs text-gray-500">
                  Defense success rates across Title, Proposal, and Final stages
                </CardDescription>
              </div>
              <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 text-xs">
                EdD Leading (92%)
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="pt-4">
            <div className="h-64 w-full">
              <Bar data={stageRatesChartData} options={baseBarOptions} />
            </div>

            <div className="mt-4 flex items-center gap-2 rounded-lg bg-amber-50/60 p-2.5 text-xs text-amber-900 border border-amber-200">
              <Clock className="h-4 w-4 text-amber-600 shrink-0" />
              <span>
                <strong>Proposal-to-Final Bottleneck:</strong> The average revision interval is 184 days. Master in Education (MAED-EM) experiences the lowest Proposal clearance velocity (74.5%).
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 2: STRIKE Plagiarism Analytics (Line Trend + Brackets Doughnut) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Monthly Similarity Score Trend Line (7 cols) */}
        <Card className="border-gray-200 shadow-2xs lg:col-span-7 flex flex-col justify-between">
          <CardHeader className="pb-3 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-sm font-bold text-gray-900">
                    STRIKE Plagiarism Similarity Score Trend
                  </CardTitle>
                  <Badge className="bg-indigo-100 text-indigo-800 hover:bg-indigo-100 text-[10px]">
                    STRIKE Engine
                  </Badge>
                </div>
                <CardDescription className="text-xs text-gray-500">
                  Monthly average similarity index compared to the 20% institutional threshold
                </CardDescription>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-bold bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100">
                <TrendingDown className="h-3.5 w-3.5" />
                -5.4% YoY Improvement
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-4">
            <div className="h-64 w-full">
              <Line data={strikeTrendChartData} options={baseLineOptions} />
            </div>

            {/* Threshold Banner */}
            <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-lg bg-gray-50 p-2.5 text-xs text-gray-600">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-red-500"></span>
                <span>Max Allowable Institutional Cap: <strong className="text-gray-900">20.0%</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-indigo-500"></span>
                <span>Current Cycle Average: <strong className="text-indigo-600">12.8% (Cleared)</strong></span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right: Similarity Brackets Doughnut (5 cols) */}
        <Card className="border-gray-200 shadow-2xs lg:col-span-5 flex flex-col justify-between">
          <CardHeader className="pb-3 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold text-gray-900">
                  Similarity Bracket Distribution
                </CardTitle>
                <CardDescription className="text-xs text-gray-500">
                  Breakdown of {totalStrikeSubmissions} examined manuscripts
                </CardDescription>
              </div>
              <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 text-xs font-bold">
                91.0% Passed
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="pt-4">
            <div className="h-60 w-full">
              <Doughnut data={strikeBracketsChartData} options={baseDoughnutOptions} />
            </div>

            {/* Custom Interactive Legend Cards */}
            <div className="mt-4 space-y-1.5 text-xs">
              <div className="flex items-center justify-between rounded-lg border border-emerald-100 bg-emerald-50/50 px-2.5 py-1.5">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
                  <span className="text-emerald-950 font-medium">&lt; 10% Highly Original</span>
                </div>
                <span className="font-bold text-emerald-700">
                  {data.plagiarism.similarityBrackets.belowTenPercent} (58.2%)
                </span>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-blue-100 bg-blue-50/50 px-2.5 py-1.5">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-blue-500"></span>
                  <span className="text-blue-950 font-medium">10%–19.9% Acceptable</span>
                </div>
                <span className="font-bold text-blue-700">
                  {data.plagiarism.similarityBrackets.tenToNineteenPercent} (32.8%)
                </span>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50/50 px-2.5 py-1.5">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-500"></span>
                  <span className="text-red-950 font-medium">&ge; 20% Flagged / Revision</span>
                </div>
                <span className="font-bold text-red-700">
                  {data.plagiarism.similarityBrackets.twentyPercentAndAbove} (9.0%)
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Institutional Research Repository Activity & Top Dissertations */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Department Publications Doughnut (4 cols) */}
        <Card className="border-gray-200 shadow-2xs lg:col-span-4 flex flex-col justify-between">
          <CardHeader className="pb-3 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold text-gray-900">
                  Publications by Department
                </CardTitle>
                <CardDescription className="text-xs text-gray-500">
                  Institutional Research Repository distribution
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-xs text-gray-600">
                {data.repository.totalPublications} Theses
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="pt-4">
            <div className="h-56 w-full">
              <Doughnut data={repositoryDeptChartData} options={baseDoughnutOptions} />
            </div>

            <div className="mt-4 rounded-lg bg-gray-50 p-2.5 text-center text-xs">
              <p className="text-gray-500 font-medium">Total Research Downloads YTD:</p>
              <p className="text-2xl font-bold text-(--earist-primary) mt-0.5">
                {data.repository.totalDownloads.toLocaleString()}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">Global academic citation access</p>
            </div>
          </CardContent>
        </Card>

        {/* Right: Top Downloaded Research Manuscripts Table (8 cols) */}
        <Card className="border-gray-200 shadow-2xs lg:col-span-8 flex flex-col justify-between">
          <CardHeader className="pb-3 border-b border-gray-100">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-sm font-bold text-gray-900">
                  Top Cited & Downloaded Graduate Research Manuscripts
                </CardTitle>
                <CardDescription className="text-xs text-gray-500">
                  Most accessed theses and dissertations in the institutional repository
                </CardDescription>
              </div>

              {/* Search Bar */}
              <div className="relative w-52">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Filter title or author..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-8 pl-8 text-xs border-gray-200"
                />
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-gray-700">
                <thead className="bg-gray-50 text-[11px] font-semibold uppercase tracking-wider text-gray-500 border-b border-gray-100">
                  <tr>
                    <th scope="col" className="px-3 py-3 text-center">Rank</th>
                    <th scope="col" className="px-4 py-3">Manuscript Title & Author</th>
                    <th scope="col" className="px-3 py-3">Program</th>
                    <th scope="col" className="px-3 py-3 text-center">Year</th>
                    <th scope="col" className="px-3 py-3 text-center">Downloads</th>
                    <th scope="col" className="px-3 py-3 text-center">Views</th>
                    <th scope="col" className="px-4 py-3 text-right">STRIKE Clearance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredManuscripts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-xs text-gray-400">
                        No manuscripts match your query.
                      </td>
                    </tr>
                  ) : (
                    filteredManuscripts.map((m) => (
                      <tr key={m.id} className="hover:bg-gray-50/60 transition-colors">
                        <td className="px-3 py-3 text-center font-bold">
                          <span
                            className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
                              m.rank === 1
                                ? "bg-amber-100 text-amber-800 font-bold"
                                : m.rank === 2
                                ? "bg-gray-200 text-gray-800"
                                : m.rank === 3
                                ? "bg-amber-50 text-amber-900 border border-amber-200"
                                : "text-gray-500"
                            }`}
                          >
                            {m.rank}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-gray-900 line-clamp-1">{m.title}</p>
                          <p className="text-[11px] text-gray-500">{m.author}</p>
                        </td>
                        <td className="px-3 py-3 text-gray-600">
                          {m.program.replace("Master in ", "").replace("Master of Science in ", "MS ")}
                        </td>
                        <td className="px-3 py-3 text-center text-gray-600">{m.publishedYear}</td>
                        <td className="px-3 py-3 text-center font-bold text-(--earist-primary)">
                          {m.downloads}
                        </td>
                        <td className="px-3 py-3 text-center text-gray-500">{m.views}</td>
                        <td className="px-4 py-3 text-right">
                          <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50 text-[10px] border border-emerald-200">
                            <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-600" />
                            &lt; 20% Verified
                          </Badge>
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
