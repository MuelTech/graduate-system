"use client";

import { useState, useMemo } from "react";
import { Doughnut, Bar } from "react-chartjs-2";
import {
  FileCheck2,
  TrendingUp,
  Download,
  AlertCircle,
  CheckCircle2,
  Clock,
  Award,
  Layers,
  Search,
  FileSpreadsheet,
  HelpCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const [candidateSearch, setCandidateSearch] = useState("");

  // Doughnut Chart: ECAT Pass vs Fail
  const ecatChartData = useMemo(() => {
    return {
      labels: ["Passed ECAT", "Did Not Meet Cutoff"],
      datasets: [
        {
          data: [data.ecatPassFail.passed, data.ecatPassFail.failed],
          backgroundColor: [
            EARIST_CHART_COLORS.emeraldGreen,
            EARIST_CHART_COLORS.dangerRed,
          ],
          borderWidth: 2,
          borderColor: "#FFFFFF",
          hoverOffset: 6,
        },
      ],
    };
  }, [data.ecatPassFail]);

  // Grouped Bar Chart: Program MCQ vs Essay Breakdown
  const scoreBreakdownChartData = useMemo(() => {
    return {
      labels: data.programScoreAverages.map((p) => p.programCode),
      datasets: [
        {
          label: "MCQ Score (Max 50)",
          data: data.programScoreAverages.map((p) => p.mcqAverage),
          backgroundColor: EARIST_CHART_COLORS.primaryMaroon,
          borderRadius: 6,
          barPercentage: 0.65,
        },
        {
          label: "Essay & Analytical (Max 50)",
          data: data.programScoreAverages.map((p) => p.essayAverage),
          backgroundColor: EARIST_CHART_COLORS.accentGold,
          borderRadius: 6,
          barPercentage: 0.65,
        },
      ],
    };
  }, [data.programScoreAverages]);

  // Filtered Comp Exam Programs
  const filteredCompPrograms = useMemo(() => {
    if (selectedCompProgram === "ALL") return data.compExamSummary.byProgram;
    return data.compExamSummary.byProgram.filter((p) => p.programName === selectedCompProgram);
  }, [data.compExamSummary.byProgram, selectedCompProgram]);

  // CSV Exporters
  const exportEcatCsv = () => {
    const headers = [
      "Program Code",
      "Program Name",
      "MCQ Average (/50)",
      "Essay Average (/50)",
      "Total Average (/100)",
      "Passing Threshold",
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
      {/* Tab Header Banner */}
      <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <FileCheck2 className="h-5 w-5 text-(--earist-primary)" />
            Examination Performance & Institutional Evaluation
          </h2>
          <p className="text-xs text-gray-600">
            Comprehensive analytics of Entrance Examination (ECAT) results and FR15 Comprehensive Examination records.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={exportEcatCsv}
            className="h-8 gap-1.5 border-gray-200 text-xs text-gray-700 hover:bg-gray-50"
          >
            <Download className="h-3.5 w-3.5 text-gray-500" />
            Export ECAT Scores
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={exportCompExamCsv}
            className="h-8 gap-1.5 border-gray-200 text-xs text-gray-700 hover:bg-gray-50"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
            Export Comp Exam Report
          </Button>
        </div>
      </div>

      {/* Row 1: ECAT Pass/Fail Doughnut + Grouped Bar (MCQ vs Essay) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: ECAT Pass vs Fail Doughnut (5 cols) */}
        <Card className="border-gray-200 shadow-2xs lg:col-span-5 flex flex-col justify-between">
          <CardHeader className="pb-3 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold text-gray-900">
                  Entrance Examination (ECAT) Results
                </CardTitle>
                <CardDescription className="text-xs text-gray-500">
                  Overall qualification rate for Current Cycle
                </CardDescription>
              </div>
              <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 text-xs font-bold">
                {data.ecatPassFail.passingRate}% Pass Rate
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="pt-4">
            <div className="h-64 w-full">
              <Doughnut data={ecatChartData} options={baseDoughnutOptions} />
            </div>

            {/* Metric Summary Cards */}
            <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-3">
                <div className="flex items-center justify-between text-emerald-900 font-semibold">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    Passed
                  </span>
                  <span className="text-base font-bold text-emerald-700">{data.ecatPassFail.passed}</span>
                </div>
                <p className="text-[11px] text-emerald-800 mt-1">Qualified for graduate enrollment</p>
              </div>

              <div className="rounded-lg border border-red-100 bg-red-50/50 p-3">
                <div className="flex items-center justify-between text-red-900 font-semibold">
                  <span className="flex items-center gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5 text-red-600" />
                    Failed
                  </span>
                  <span className="text-base font-bold text-red-700">{data.ecatPassFail.failed}</span>
                </div>
                <p className="text-[11px] text-red-800 mt-1">Below passing cut-off score</p>
              </div>
            </div>

            <div className="mt-3 rounded-lg bg-gray-50 p-2.5 text-[11px] text-gray-600 flex items-center justify-between">
              <span>Total Examinees Evaluated:</span>
              <span className="font-bold text-gray-900">{data.ecatPassFail.totalExaminees} Candidates</span>
            </div>
          </CardContent>
        </Card>

        {/* Right: Program Score Breakdown Grouped Bar (7 cols) */}
        <Card className="border-gray-200 shadow-2xs lg:col-span-7 flex flex-col justify-between">
          <CardHeader className="pb-3 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold text-gray-900">
                  Program-by-Program Score Breakdown
                </CardTitle>
                <CardDescription className="text-xs text-gray-500">
                  Multiple Choice Questions (MCQ) vs. Essay & Analytical writing performance
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-xs text-gray-600">
                7 Programs
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="pt-4">
            <div className="h-72 w-full">
              <Bar data={scoreBreakdownChartData} options={baseBarOptions} />
            </div>

            {/* Score Profile Observations */}
            <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2 text-xs">
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-2.5">
                <span className="font-bold text-gray-800 block mb-0.5">Objective Knowledge (MCQ):</span>
                <p className="text-[11px] text-gray-600">
                  Highest technical scores in <strong className="text-gray-900">MSIT (43.6/50)</strong> and Doctoral tracks, showing strong prerequisite foundational retention.
                </p>
              </div>

              <div className="rounded-lg border border-amber-100 bg-amber-50/50 p-2.5">
                <span className="font-bold text-amber-900 block mb-0.5">Essay & Analytical Writing:</span>
                <p className="text-[11px] text-amber-900">
                  Doctoral applicants averaged <strong className="text-amber-950">44.0/50</strong> in qualitative discourse, satisfying institutional research writing readiness.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Comprehensive Examination Tracking Matrix (FR15) */}
      <Card className="border-gray-200 shadow-2xs">
        <CardHeader className="border-b border-gray-100 pb-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-bold text-gray-900">
                  Comprehensive Examination Tracking & Committee Verifications
                </CardTitle>
                <Badge className="bg-(--earist-primary)/10 text-(--earist-primary) hover:bg-(--earist-primary)/10 text-[10px] font-bold">
                  FR15 Compliant
                </Badge>
              </div>
              <CardDescription className="text-xs text-gray-500">
                Admin-verified tracking of Written Comprehensive Examination and Oral Defense milestones
              </CardDescription>
            </div>

            {/* Program Filter Chips */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 font-medium hidden sm:inline">Filter:</span>
              <select
                value={selectedCompProgram}
                onChange={(e) => setSelectedCompProgram(e.target.value)}
                className="h-8 rounded-lg border border-gray-200 bg-white px-2.5 text-xs text-gray-700 focus:border-indigo-500 focus:outline-none"
              >
                <option value="ALL">All Graduate Programs</option>
                {data.compExamSummary.byProgram.map((p, idx) => (
                  <option key={idx} value={p.programName}>
                    {p.programName}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-5 pt-4">
          {/* FR15 Top KPI Stat Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-gray-200 bg-white p-3.5 shadow-2xs">
              <div className="flex items-center justify-between text-gray-500 text-xs font-medium">
                <span>Total Candidates</span>
                <Layers className="h-4 w-4 text-gray-400" />
              </div>
              <p className="text-2xl font-bold text-gray-900 mt-1">{data.compExamSummary.totalTracked}</p>
              <p className="text-[11px] text-gray-500 mt-0.5">Active examination registry</p>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3.5 shadow-2xs">
              <div className="flex items-center justify-between text-emerald-800 text-xs font-medium">
                <span>Passed & Verified</span>
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              </div>
              <p className="text-2xl font-bold text-emerald-700 mt-1">{data.compExamSummary.passed}</p>
              <p className="text-[11px] text-emerald-800 mt-0.5">{data.compExamSummary.passRate}% Institutional Pass Rate</p>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3.5 shadow-2xs">
              <div className="flex items-center justify-between text-amber-800 text-xs font-medium">
                <span>Pending Verification</span>
                <Clock className="h-4 w-4 text-amber-600" />
              </div>
              <p className="text-2xl font-bold text-amber-700 mt-1">{data.compExamSummary.pending}</p>
              <p className="text-[11px] text-amber-800 mt-0.5">Awaiting committee signed forms</p>
            </div>

            <div className="rounded-xl border border-red-200 bg-red-50/40 p-3.5 shadow-2xs">
              <div className="flex items-center justify-between text-red-800 text-xs font-medium">
                <span>Failed / Retake Required</span>
                <AlertCircle className="h-4 w-4 text-red-600" />
              </div>
              <p className="text-2xl font-bold text-red-700 mt-1">{data.compExamSummary.failed}</p>
              <p className="text-[11px] text-red-800 mt-0.5">Eligible for re-examination</p>
            </div>
          </div>

          {/* Program Distribution Progress Bars */}
          <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4 space-y-3">
            <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
              Program-Level Comprehensive Exam Throughput
            </h4>

            <div className="space-y-3">
              {filteredCompPrograms.map((prog, idx) => {
                const total = prog.passed + prog.pending;
                const percentage = total > 0 ? (prog.passed / total) * 100 : 0;
                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-gray-800">{prog.programName}</span>
                      <span className="text-gray-600 text-[11px]">
                        <strong className="text-emerald-600">{prog.passed} Passed</strong> /{" "}
                        <span className="text-amber-600">{prog.pending} Pending</span> ({percentage.toFixed(0)}%)
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-gray-200 overflow-hidden flex">
                      <div
                        className="bg-emerald-500 h-full rounded-l-full"
                        style={{ width: `${percentage}%` }}
                      />
                      <div
                        className="bg-amber-400 h-full rounded-r-full"
                        style={{ width: `${100 - percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* FR15 Institutional Regulatory Alert */}
          <div className="flex items-start gap-2.5 rounded-lg border border-indigo-100 bg-indigo-50/60 p-3 text-xs text-indigo-950">
            <Award className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold text-indigo-900">
                FR15 Administrative Verification & Eligibility Rules:
              </span>
              <p className="text-[11px] leading-relaxed text-indigo-900/90">
                Per EARIST Graduate School regulations, a graduate student is eligible to enroll in Thesis/Dissertation writing only after passing the Comprehensive Examination. Official completion requires the Administrator to manually verify that signed Form CE-02 (Written Examination) and Form CE-03 (Oral Panel Deliberation) have been physically deposited in the Dean&apos;s Office records.
              </p>
            </div>
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
