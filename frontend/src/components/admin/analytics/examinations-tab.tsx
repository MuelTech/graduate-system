"use client";

import { useState, useMemo } from "react";
import { Doughnut, Bar } from "react-chartjs-2";
import {
  FileCheck2,
  Download,
  FileSpreadsheet,
  Layers,
  CheckCircle2,
  Clock,
  AlertCircle,
  Info,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  EARIST_CHART_COLORS,
  baseDoughnutOptions,
  baseBarOptions,
} from "@/lib/chartjs-registry";
import type { ExaminationAnalyticsData } from "@/types/analytics";

interface ExaminationsTabProps {
  data: ExaminationAnalyticsData;
}

export function ExaminationsTab({ data }: ExaminationsTabProps) {
  const [selectedCompProgram, setSelectedCompProgram] = useState<string>("ALL");

  // Doughnut Chart: ECAT Pass vs Fail
  const ecatChartData = useMemo(() => {
    return {
      labels: ["Passed ECAT", "Below Cut-Off"],
      datasets: [
        {
          data: [data.ecatPassFail.passed, data.ecatPassFail.failed],
          backgroundColor: [
            EARIST_CHART_COLORS.emeraldGreen,
            EARIST_CHART_COLORS.primaryMaroon,
          ],
          borderWidth: 1,
          borderColor: "#FFFFFF",
        },
      ],
    };
  }, [data.ecatPassFail]);

  // Grouped Bar Chart: Program Score Breakdown
  const scoreBreakdownChartData = useMemo(() => {
    return {
      labels: data.programScoreAverages.map((p) => p.programCode),
      datasets: [
        {
          label: "MCQ Score (Max 50)",
          data: data.programScoreAverages.map((p) => p.mcqAverage),
          backgroundColor: EARIST_CHART_COLORS.primaryMaroon,
          borderRadius: 4,
          barPercentage: 0.65,
        },
        {
          label: "Essay & Analytical (Max 50)",
          data: data.programScoreAverages.map((p) => p.essayAverage),
          backgroundColor: EARIST_CHART_COLORS.accentGold,
          borderRadius: 4,
          barPercentage: 0.65,
        },
      ],
    };
  }, [data.programScoreAverages]);

  const filteredCompPrograms = useMemo(() => {
    if (selectedCompProgram === "ALL") return data.compExamSummary.byProgram;
    return data.compExamSummary.byProgram.filter((p) => p.programName === selectedCompProgram);
  }, [data.compExamSummary.byProgram, selectedCompProgram]);

  const exportEcatCsv = () => {
    const headers = [
      "Program Code",
      "Program Name",
      "MCQ Average (/50)",
      "Essay Average (/50)",
      "Total Average (/100)",
      "Passing Cut-Off",
    ];
    const rows = data.programScoreAverages.map((p) => [
      p.programCode,
      p.programName,
      p.mcqAverage,
      p.essayAverage,
      p.totalAverage,
      p.passingScore,
    ]);
    downloadCsv("EARIST_ECAT_Score_Breakdown.csv", headers, rows);
  };

  const exportCompExamCsv = () => {
    const headers = ["Graduate Program", "Candidates Passed", "Pending Committee Verification", "Pass Rate %"];
    const rows = data.compExamSummary.byProgram.map((p) => {
      const total = p.passed + p.pending;
      const rate = total > 0 ? ((p.passed / total) * 100).toFixed(1) : "0.0";
      return [p.programName, p.passed, p.pending, rate];
    });
    downloadCsv("EARIST_FR15_Comprehensive_Exam_Tracking.csv", headers, rows);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col gap-3 rounded-lg border border-(--earist-border-gray) bg-white p-3.5 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-bold text-(--earist-primary)">
            Examination Performance & Institutional Evaluation
          </h2>
          <p className="text-xs text-(--earist-body-text)">
            Entrance Examination (ECAT) results and FR15 Comprehensive Examination verification ledger.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={exportEcatCsv}
            className="h-8 gap-1.5 border-(--earist-border-gray) bg-white text-xs text-(--earist-body-text) hover:bg-(--earist-surface-gray)"
          >
            <Download className="h-3.5 w-3.5 text-gray-500" />
            Export ECAT Scores
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={exportCompExamCsv}
            className="h-8 gap-1.5 border-(--earist-border-gray) bg-white text-xs text-(--earist-body-text) hover:bg-(--earist-surface-gray)"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-gray-500" />
            Export Comp Exam Report
          </Button>
        </div>
      </div>

      {/* Row 1: ECAT Pass/Fail Doughnut + Grouped Bar */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: ECAT Pass vs Fail Doughnut (5 cols) */}
        <Card className="border-(--earist-border-gray) bg-white shadow-2xs lg:col-span-5 flex flex-col justify-between">
          <CardHeader className="border-b border-(--earist-border-gray) bg-(--earist-surface-gray) py-3 px-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold text-(--earist-primary)">
                  Entrance Examination (ECAT) Results
                </CardTitle>
                <CardDescription className="text-xs text-(--earist-body-text)">
                  Qualification rate for current intake cycle
                </CardDescription>
              </div>
              <span className="text-xs font-bold text-(--earist-success)">
                {data.ecatPassFail.passingRate}% Pass Rate
              </span>
            </div>
          </CardHeader>

          <CardContent className="pt-4">
            <div className="h-60 w-full">
              <Doughnut data={ecatChartData} options={baseDoughnutOptions} />
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-xs border-t border-(--earist-border-gray) pt-3">
              <div className="rounded border border-(--earist-border-gray) bg-(--earist-surface-gray) p-2.5">
                <span className="text-[11px] text-(--earist-body-text) block">Passed & Qualified</span>
                <span className="text-lg font-bold text-(--earist-success)">{data.ecatPassFail.passed}</span>
                <p className="text-[10px] text-gray-500">Eligible for matriculation</p>
              </div>

              <div className="rounded border border-(--earist-border-gray) bg-(--earist-surface-gray) p-2.5">
                <span className="text-[11px] text-(--earist-body-text) block">Below Cut-Off</span>
                <span className="text-lg font-bold text-(--earist-primary)">{data.ecatPassFail.failed}</span>
                <p className="text-[10px] text-gray-500">Below passing threshold</p>
              </div>
            </div>

            <div className="mt-2 text-center text-xs text-(--earist-body-text)">
              Total Examinees: <strong>{data.ecatPassFail.totalExaminees}</strong>
            </div>
          </CardContent>
        </Card>

        {/* Right: Program Score Breakdown Grouped Bar (7 cols) */}
        <Card className="border-(--earist-border-gray) bg-white shadow-2xs lg:col-span-7 flex flex-col justify-between">
          <CardHeader className="border-b border-(--earist-border-gray) bg-(--earist-surface-gray) py-3 px-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold text-(--earist-primary)">
                  Program-by-Program Score Breakdown
                </CardTitle>
                <CardDescription className="text-xs text-(--earist-body-text)">
                  Objective Knowledge (MCQ) vs. Essay & Analytical writing performance
                </CardDescription>
              </div>
              <span className="text-xs text-(--earist-body-text)">
                {data.programScoreAverages.length} Programs
              </span>
            </div>
          </CardHeader>

          <CardContent className="pt-4">
            <div className="h-68 w-full">
              <Bar data={scoreBreakdownChartData} options={baseBarOptions} />
            </div>

            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 text-xs border-t border-(--earist-border-gray) pt-3">
              <div className="text-(--earist-body-text)">
                <strong className="text-foreground">Objective Knowledge (MCQ):</strong> Highest scores in MSIT (43.6/50) and Doctoral tracks.
              </div>
              <div className="text-(--earist-body-text)">
                <strong className="text-foreground">Essay Discourse:</strong> Doctoral examinees averaged 44.0/50 in research writing readiness.
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 2: FR15 Comprehensive Examination Tracking Matrix */}
      <Card className="border-(--earist-border-gray) bg-white shadow-2xs">
        <CardHeader className="border-b border-(--earist-border-gray) bg-(--earist-surface-gray) py-3 px-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-sm font-bold text-(--earist-primary)">
                Comprehensive Examination Tracking & Committee Verifications (FR15)
              </CardTitle>
              <CardDescription className="text-xs text-(--earist-body-text)">
                Manual Administrator verification ledger for Written Examination and Oral Defense milestones
              </CardDescription>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-(--earist-body-text)">Filter Program:</span>
              <select
                value={selectedCompProgram}
                onChange={(e) => setSelectedCompProgram(e.target.value)}
                className="h-8 rounded-md border border-(--earist-border-gray) bg-white px-2.5 text-xs text-(--earist-body-text) focus:border-(--earist-primary) focus:outline-none"
              >
                <option value="ALL">All Programs</option>
                {data.compExamSummary.byProgram.map((p, idx) => (
                  <option key={idx} value={p.programName}>
                    {p.programName}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-4">
          {/* FR15 Top Metric Tiles */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-(--earist-border-gray) bg-(--earist-surface-gray) p-3">
              <p className="text-xs text-(--earist-body-text)">Total Candidates Tracked</p>
              <p className="text-2xl font-bold text-(--earist-primary) mt-1">{data.compExamSummary.totalTracked}</p>
              <p className="text-[10px] text-gray-500">Active examination roster</p>
            </div>

            <div className="rounded-lg border border-(--earist-border-gray) bg-(--earist-surface-gray) p-3">
              <p className="text-xs text-(--earist-body-text)">Passed & Verified</p>
              <p className="text-2xl font-bold text-(--earist-success) mt-1">{data.compExamSummary.passed}</p>
              <p className="text-[10px] text-(--earist-body-text)">{data.compExamSummary.passRate}% Pass Rate</p>
            </div>

            <div className="rounded-lg border border-(--earist-border-gray) bg-(--earist-surface-gray) p-3">
              <p className="text-xs text-(--earist-body-text)">Pending Verification</p>
              <p className="text-2xl font-bold text-(--earist-warning) mt-1">{data.compExamSummary.pending}</p>
              <p className="text-[10px] text-gray-500">Awaiting committee signed forms</p>
            </div>

            <div className="rounded-lg border border-(--earist-border-gray) bg-(--earist-surface-gray) p-3">
              <p className="text-xs text-(--earist-body-text)">Re-examination Required</p>
              <p className="text-2xl font-bold text-(--earist-secondary) mt-1">{data.compExamSummary.failed}</p>
              <p className="text-[10px] text-gray-500">Eligible for re-take</p>
            </div>
          </div>

          {/* Program Distribution Progress Bars */}
          <div className="rounded-lg border border-(--earist-border-gray) bg-(--earist-surface-gray) p-3 space-y-3">
            <p className="text-xs font-bold text-(--earist-primary) uppercase tracking-wider">
              Program-Level Comprehensive Exam Throughput
            </p>

            <div className="space-y-2.5">
              {filteredCompPrograms.map((prog, idx) => {
                const total = prog.passed + prog.pending;
                const percentage = total > 0 ? (prog.passed / total) * 100 : 0;
                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-foreground">{prog.programName}</span>
                      <span className="text-xs text-(--earist-body-text)">
                        <strong className="text-(--earist-success)">{prog.passed} Passed</strong> /{" "}
                        <span className="text-(--earist-warning)">{prog.pending} Pending</span> ({percentage.toFixed(0)}%)
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-gray-200 overflow-hidden flex">
                      <div
                        className="bg-(--earist-success) h-full"
                        style={{ width: `${percentage}%` }}
                      />
                      <div
                        className="bg-(--earist-warning) h-full"
                        style={{ width: `${100 - percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Policy Context */}
          <div className="flex items-start gap-2 rounded-lg border border-(--earist-border-gray) bg-(--earist-surface-gray) p-3 text-xs text-(--earist-body-text)">
            <Info className="h-4 w-4 text-(--earist-secondary) shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed">
              <strong>FR15 Institutional Verification Procedure:</strong> Per Graduate School regulations, candidate thesis registration requires prior verification of passed Comprehensive Examinations. Official clearance is recorded by the Administrator upon receipt of signed Form CE-02 (Written Result) and Form CE-03 (Oral Deliberation) filed in the Dean&apos;s Office.
            </p>
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
