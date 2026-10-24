"use client";

import { useState, useMemo } from "react";
import { Bar, Line, Doughnut } from "react-chartjs-2";
import {
  BookOpen,
  Download,
  Search,
  ShieldCheck,
  FileSpreadsheet,
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

  // Horizontal Bar: Defense Funnel
  const funnelChartData = useMemo(() => {
    return {
      labels: data.defenseFunnel.map((f) => f.stageLabel),
      datasets: [
        {
          label: "Active Candidates",
          data: data.defenseFunnel.map((f) => f.activeCount),
          backgroundColor: EARIST_CHART_COLORS.primaryMaroon,
          borderRadius: 4,
          barPercentage: 0.65,
        },
        {
          label: "Completed & Cleared",
          data: data.defenseFunnel.map((f) => f.completedCount),
          backgroundColor: EARIST_CHART_COLORS.secondaryNavy,
          borderRadius: 4,
          barPercentage: 0.65,
        },
      ],
    };
  }, [data.defenseFunnel]);

  // Grouped Bar: Pass rates by program
  const stageRatesChartData = useMemo(() => {
    return {
      labels: data.stageCompletionRates.map((p) => {
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
          borderRadius: 4,
        },
        {
          label: "Proposal Defense (%)",
          data: data.stageCompletionRates.map((p) => p.proposalPassRate),
          backgroundColor: EARIST_CHART_COLORS.accentGold,
          borderRadius: 4,
        },
        {
          label: "Final Defense (%)",
          data: data.stageCompletionRates.map((p) => p.finalPassRate),
          backgroundColor: EARIST_CHART_COLORS.emeraldGreen,
          borderRadius: 4,
        },
      ],
    };
  }, [data.stageCompletionRates]);

  // Line Chart: STRIKE Plagiarism Trend
  const strikeTrendChartData = useMemo(() => {
    return {
      labels: data.plagiarism.monthlySimilarityTrend.map((m) => m.month),
      datasets: [
        {
          label: "Avg. Similarity Index (%)",
          data: data.plagiarism.monthlySimilarityTrend.map((m) => m.averageSimilarity),
          borderColor: EARIST_CHART_COLORS.secondaryCrimson,
          backgroundColor: EARIST_CHART_COLORS.secondaryCrimsonSoft,
          fill: true,
          tension: 0.3,
          pointBackgroundColor: EARIST_CHART_COLORS.secondaryCrimson,
        },
      ],
    };
  }, [data.plagiarism.monthlySimilarityTrend]);

  // Doughnut Chart: STRIKE Brackets
  const strikeBracketsChartData = useMemo(() => {
    const sb = data.plagiarism.similarityBrackets;
    return {
      labels: ["<10% Original", "10–19.9% Acceptable", "≥20% Revision Required"],
      datasets: [
        {
          data: [sb.belowTenPercent, sb.tenToNineteenPercent, sb.twentyPercentAndAbove],
          backgroundColor: [
            EARIST_CHART_COLORS.emeraldGreen,
            EARIST_CHART_COLORS.secondaryNavy,
            EARIST_CHART_COLORS.primaryMaroon,
          ],
          borderWidth: 1,
          borderColor: "#FFFFFF",
        },
      ],
    };
  }, [data.plagiarism.similarityBrackets]);

  // Doughnut: Publications by Department
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
          borderWidth: 1,
          borderColor: "#FFFFFF",
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
    const headers = ["Month", "Average Similarity %", "Institutional Cap %"];
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
      {/* Header Banner */}
      <div className="flex flex-col gap-3 rounded-lg border border-(--earist-border-gray) bg-white p-3.5 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-bold text-(--earist-primary)">
            Thesis Defense Pipeline & STRIKE Plagiarism Analytics
          </h2>
          <p className="text-xs text-(--earist-body-text)">
            Monitoring thesis stage progression, STRIKE similarity benchmarks, and research repository metrics.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={exportFunnelCsv}
            className="h-8 gap-1.5 border-(--earist-border-gray) bg-white text-xs text-(--earist-body-text) hover:bg-(--earist-surface-gray)"
          >
            <Download className="h-3.5 w-3.5 text-gray-500" />
            Export Funnel
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={exportStrikeCsv}
            className="h-8 gap-1.5 border-(--earist-border-gray) bg-white text-xs text-(--earist-body-text) hover:bg-(--earist-surface-gray)"
          >
            <ShieldCheck className="h-3.5 w-3.5 text-(--earist-secondary)" />
            Export STRIKE Log
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={exportRepositoryCsv}
            className="h-8 gap-1.5 border-(--earist-border-gray) bg-white text-xs text-(--earist-body-text) hover:bg-(--earist-surface-gray)"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-gray-500" />
            Export Repository
          </Button>
        </div>
      </div>

      {/* Row 1: Sequential Funnel + Stage Pass Rates */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Sequential Funnel (6 cols) */}
        <Card className="border-(--earist-border-gray) bg-white shadow-2xs lg:col-span-6 flex flex-col justify-between">
          <CardHeader className="border-b border-(--earist-border-gray) bg-(--earist-surface-gray) py-3 px-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold text-(--earist-primary)">
                  Sequential Defense Stage Funnel
                </CardTitle>
                <CardDescription className="text-xs text-(--earist-body-text)">
                  Candidate progression from Title Defense through Final Oral Defense
                </CardDescription>
              </div>
              <span className="text-xs text-(--earist-body-text)">
                3 Milestones
              </span>
            </div>
          </CardHeader>

          <CardContent className="pt-4">
            <div className="h-64 w-full">
              <Bar data={funnelChartData} options={horizontalBarOptions} />
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2 border-t border-(--earist-border-gray) pt-3 text-center text-xs">
              {data.defenseFunnel.map((stage, idx) => (
                <div key={idx} className="rounded border border-(--earist-border-gray) bg-(--earist-surface-gray) p-2">
                  <p className="text-[10px] uppercase font-semibold text-(--earist-body-text)">{stage.stageLabel}</p>
                  <p className="text-base font-bold text-foreground mt-0.5">{stage.averageTurnaroundDays} Days</p>
                  <p className="text-[10px] text-gray-500">Average Turnaround</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Right: Stage Pass Rates by Program (6 cols) */}
        <Card className="border-(--earist-border-gray) bg-white shadow-2xs lg:col-span-6 flex flex-col justify-between">
          <CardHeader className="border-b border-(--earist-border-gray) bg-(--earist-surface-gray) py-3 px-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold text-(--earist-primary)">
                  Defense Pass Rates by Program
                </CardTitle>
                <CardDescription className="text-xs text-(--earist-body-text)">
                  Success rates across Title, Proposal, and Final stages
                </CardDescription>
              </div>
              <span className="text-xs text-(--earist-body-text)">
                {data.stageCompletionRates.length} Programs
              </span>
            </div>
          </CardHeader>

          <CardContent className="pt-4">
            <div className="h-64 w-full">
              <Bar data={stageRatesChartData} options={baseBarOptions} />
            </div>

            <div className="mt-3 border-t border-(--earist-border-gray) pt-3 text-xs text-(--earist-body-text)">
              <strong>Proposal-to-Final Duration:</strong> Averages 184 days, with MAED-EM and MBA candidates experiencing the longest revision intervals.
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 2: STRIKE Plagiarism (Line Trend + Brackets Doughnut) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Plagiarism Trend Line (7 cols) */}
        <Card className="border-(--earist-border-gray) bg-white shadow-2xs lg:col-span-7 flex flex-col justify-between">
          <CardHeader className="border-b border-(--earist-border-gray) bg-(--earist-surface-gray) py-3 px-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold text-(--earist-primary)">
                  STRIKE Plagiarism Similarity Score Trend
                </CardTitle>
                <CardDescription className="text-xs text-(--earist-body-text)">
                  Monthly average similarity index vs 20.0% institutional ceiling
                </CardDescription>
              </div>
              <span className="text-xs font-semibold text-(--earist-success)">
                12.8% Current Cycle Avg
              </span>
            </div>
          </CardHeader>

          <CardContent className="pt-4">
            <div className="h-60 w-full">
              <Line data={strikeTrendChartData} options={baseLineOptions} />
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-(--earist-border-gray) pt-3 text-xs text-(--earist-body-text)">
              <span>Institutional Maximum Cap: <strong className="text-foreground">20.0%</strong></span>
              <span>Overall Clearance Rate: <strong className="text-(--earist-success)">91.0% Passed</strong></span>
            </div>
          </CardContent>
        </Card>

        {/* Right: Similarity Brackets Doughnut (5 cols) */}
        <Card className="border-(--earist-border-gray) bg-white shadow-2xs lg:col-span-5 flex flex-col justify-between">
          <CardHeader className="border-b border-(--earist-border-gray) bg-(--earist-surface-gray) py-3 px-4">
            <CardTitle className="text-sm font-bold text-(--earist-primary)">
              Similarity Bracket Distribution
            </CardTitle>
            <CardDescription className="text-xs text-(--earist-body-text)">
              Manuscript distribution by similarity tier
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-4">
            <div className="h-56 w-full">
              <Doughnut data={strikeBracketsChartData} options={baseDoughnutOptions} />
            </div>

            <div className="mt-3 space-y-1.5 border-t border-(--earist-border-gray) pt-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-(--earist-body-text)">&lt; 10% Original:</span>
                <span className="font-bold text-(--earist-success)">{data.plagiarism.similarityBrackets.belowTenPercent} (58.2%)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-(--earist-body-text)">10%–19.9% Acceptable:</span>
                <span className="font-bold text-(--earist-secondary)">{data.plagiarism.similarityBrackets.tenToNineteenPercent} (32.8%)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-(--earist-body-text)">&ge; 20% Flagged / Revision:</span>
                <span className="font-bold text-(--earist-primary)">{data.plagiarism.similarityBrackets.twentyPercentAndAbove} (9.0%)</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Repository Output & Top Manuscripts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Department Distribution (4 cols) */}
        <Card className="border-(--earist-border-gray) bg-white shadow-2xs lg:col-span-4 flex flex-col justify-between">
          <CardHeader className="border-b border-(--earist-border-gray) bg-(--earist-surface-gray) py-3 px-4">
            <CardTitle className="text-sm font-bold text-(--earist-primary)">
              Publications by Department
            </CardTitle>
            <CardDescription className="text-xs text-(--earist-body-text)">
              Institutional repository distribution
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-4">
            <div className="h-52 w-full">
              <Doughnut data={repositoryDeptChartData} options={baseDoughnutOptions} />
            </div>

            <div className="mt-3 border-t border-(--earist-border-gray) pt-3 text-center text-xs text-(--earist-body-text)">
              Total Repository Publications: <strong className="text-foreground">{data.repository.totalPublications}</strong>
              <br />
              Total Citation Downloads: <strong className="text-(--earist-primary)">{data.repository.totalDownloads.toLocaleString()}</strong>
            </div>
          </CardContent>
        </Card>

        {/* Right: Top Manuscripts Table (8 cols) */}
        <Card className="border-(--earist-border-gray) bg-white shadow-2xs lg:col-span-8 flex flex-col justify-between">
          <CardHeader className="border-b border-(--earist-border-gray) bg-(--earist-surface-gray) py-3 px-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-sm font-bold text-(--earist-primary)">
                  Top Cited & Downloaded Research Manuscripts
                </CardTitle>
                <CardDescription className="text-xs text-(--earist-body-text)">
                  Most accessed theses and dissertations in the repository
                </CardDescription>
              </div>

              <div className="relative w-52">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Filter title..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-8 pl-8 text-xs border-(--earist-border-gray) bg-white"
                />
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-(--earist-body-text)">
                <thead className="bg-(--earist-surface-gray) text-[11px] font-semibold text-(--earist-body-text) border-b border-(--earist-border-gray)">
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
                <tbody className="divide-y divide-(--earist-border-gray)">
                  {filteredManuscripts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-xs text-gray-400">
                        No manuscripts match your query.
                      </td>
                    </tr>
                  ) : (
                    filteredManuscripts.map((m) => (
                      <tr key={m.id} className="hover:bg-(--earist-surface-gray)/60 transition-colors">
                        <td className="px-3 py-3 text-center font-bold text-foreground">
                          {m.rank}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-foreground line-clamp-1">{m.title}</p>
                          <p className="text-[11px] text-gray-500">{m.author}</p>
                        </td>
                        <td className="px-3 py-3 text-xs text-(--earist-body-text)">
                          {m.program.replace("Master in ", "").replace("Master of Science in ", "MS ")}
                        </td>
                        <td className="px-3 py-3 text-center text-xs">{m.publishedYear}</td>
                        <td className="px-3 py-3 text-center font-bold text-(--earist-primary)">
                          {m.downloads}
                        </td>
                        <td className="px-3 py-3 text-center text-gray-500">{m.views}</td>
                        <td className="px-4 py-3 text-right">
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-(--earist-success)">
                            <CheckCircle2 className="h-3 w-3" />
                            Verified (&lt;20%)
                          </span>
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
