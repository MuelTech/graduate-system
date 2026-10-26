"use client";

import { useState, useMemo } from "react";
import {
  FileText,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Download,
  Printer,
  Search,
  UserCheck,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  InstitutionalReportsData,
  ResidencyRiskStatus,
} from "@/types/analytics";

interface InstitutionalReportsTabProps {
  data: InstitutionalReportsData;
}

export function InstitutionalReportsTab({ data }: InstitutionalReportsTabProps) {
  const [residencyStatusFilter, setResidencyStatusFilter] = useState<"ALL" | ResidencyRiskStatus>("ALL");
  const [residencySearch, setResidencySearch] = useState("");
  const [expandedAdviserId, setExpandedAdviserId] = useState<string | null>(null);
  const [warningSentIds, setWarningSentIds] = useState<Record<string, string>>({
    "res-01": "2026-02-10",
    "res-02": "2026-02-12",
    "res-03": "2025-09-15",
    "res-05": "2026-01-20",
    "res-06": "2025-06-10",
    "res-07": "2026-02-15",
  });

  const filteredResidency = useMemo(() => {
    return data.residencyRegistry.filter((item) => {
      const matchesStatus =
        residencyStatusFilter === "ALL" ? true : item.status === residencyStatusFilter;
      const term = residencySearch.toLowerCase().trim();
      const matchesSearch =
        !term ||
        item.name.toLowerCase().includes(term) ||
        item.studentNumber.toLowerCase().includes(term) ||
        item.program.toLowerCase().includes(term);
      return matchesStatus && matchesSearch;
    });
  }, [data.residencyRegistry, residencyStatusFilter, residencySearch]);

  const residencyStats = useMemo(() => {
    const overstaying = data.residencyRegistry.filter((r) => r.status === "OVERSTAYING").length;
    const approaching = data.residencyRegistry.filter((r) => r.status === "APPROACHING_LIMIT").length;
    const normal = data.residencyRegistry.filter((r) => r.status === "NORMAL").length;
    return { overstaying, approaching, normal, total: data.residencyRegistry.length };
  }, [data.residencyRegistry]);

  const adviserStats = useMemo(() => {
    const totalAdvisers = data.adviserLoadMatrix.length;
    const atCapacity = data.adviserLoadMatrix.filter((a) => a.capacityStatus === "AT_CAPACITY").length;
    const totalAdvisees = data.adviserLoadMatrix.reduce((acc, a) => acc + a.activeAdviseesCount, 0);
    const maxCapacitySlots = data.adviserLoadMatrix.reduce((acc, a) => acc + a.maxCapacity, 0);
    const availableSlots = maxCapacitySlots - totalAdvisees;
    return { totalAdvisers, atCapacity, totalAdvisees, availableSlots };
  }, [data.adviserLoadMatrix]);

  const handleSendWarning = (studentId: string) => {
    const today = new Date().toISOString().split("T")[0];
    setWarningSentIds((prev) => ({ ...prev, [studentId]: today }));
  };

  const exportResidencyCsv = () => {
    const headers = [
      "Student Number",
      "Student Name",
      "Program",
      "Degree Level",
      "Enrollment Date",
      "Elapsed Years",
      "Max Residency Years",
      "Remaining Months",
      "Status",
      "Warning Sent Date",
    ];
    const rows = filteredResidency.map((r) => [
      r.studentNumber,
      r.name,
      r.program,
      r.degreeLevel,
      r.enrollmentDate,
      r.elapsedYears,
      r.maxResidencyYears,
      r.remainingMonths,
      r.status,
      warningSentIds[r.id] || "None",
    ]);
    downloadCsv("EARIST_Residency_Risk_Registry.csv", headers, rows);
  };

  const exportAdviserCsv = () => {
    const headers = [
      "Faculty Adviser",
      "Department",
      "Specialization",
      "Active Advisees",
      "Max Capacity",
      "Capacity Status",
      "Assigned Programs",
    ];
    const rows = data.adviserLoadMatrix.map((a) => [
      a.name,
      a.department,
      a.specialization,
      a.activeAdviseesCount,
      a.maxCapacity,
      a.capacityStatus,
      a.assignedPrograms.join("; "),
    ]);
    downloadCsv("EARIST_Faculty_Adviser_Load_Matrix.csv", headers, rows);
  };

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col gap-3 rounded-lg border border-(--earist-border-gray) bg-white p-3.5 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-bold text-(--earist-primary)">
            Institutional Compliance & Official Reports Registry
          </h2>
          <p className="text-xs text-(--earist-body-text)">
            Compliance tracking for student maximum residency limits, faculty mentorship caps, and official accreditation reports.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            className="h-8 gap-1.5 border-(--earist-border-gray) bg-white text-xs text-(--earist-body-text) hover:bg-(--earist-surface-gray)"
          >
            <Printer className="h-3.5 w-3.5 text-gray-500" />
            Print / Save PDF
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={exportResidencyCsv}
            className="h-8 gap-1.5 border-(--earist-border-gray) bg-white text-xs text-(--earist-body-text) hover:bg-(--earist-surface-gray)"
          >
            <Download className="h-3.5 w-3.5 text-gray-500" />
            Export Residency CSV
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={exportAdviserCsv}
            className="h-8 gap-1.5 border-(--earist-border-gray) bg-white text-xs text-(--earist-body-text) hover:bg-(--earist-surface-gray)"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-gray-500" />
            Export Adviser CSV
          </Button>
        </div>
      </div>

      {/* Top Compliance Metric Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card className="border-(--earist-border-gray) bg-white shadow-2xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-xs font-semibold text-(--earist-primary)">
              <span>Overstaying Breaches</span>
              <AlertTriangle className="h-4 w-4 text-(--earist-primary)" />
            </div>
            <p className="text-2xl font-bold text-(--earist-primary) mt-1">{residencyStats.overstaying} Students</p>
            <p className="text-[11px] text-(--earist-body-text) mt-0.5">Exceeded maximum residency</p>
          </CardContent>
        </Card>

        <Card className="border-(--earist-border-gray) bg-white shadow-2xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-xs font-semibold text-(--earist-warning)">
              <span>Approaching Limit</span>
              <Clock className="h-4 w-4 text-(--earist-warning)" />
            </div>
            <p className="text-2xl font-bold text-(--earist-warning) mt-1">{residencyStats.approaching} Students</p>
            <p className="text-[11px] text-(--earist-body-text) mt-0.5">&le; 6 months remaining</p>
          </CardContent>
        </Card>

        <Card className="border-(--earist-border-gray) bg-white shadow-2xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-xs font-semibold text-(--earist-secondary)">
              <span>Advisers At Capacity</span>
              <Users className="h-4 w-4 text-(--earist-secondary)" />
            </div>
            <p className="text-2xl font-bold text-(--earist-secondary) mt-1">{adviserStats.atCapacity} Faculty</p>
            <p className="text-[11px] text-(--earist-body-text) mt-0.5">Reached 5/5 advisee limit</p>
          </CardContent>
        </Card>

        <Card className="border-(--earist-border-gray) bg-white shadow-2xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-xs font-semibold text-(--earist-success)">
              <span>Available Capacity</span>
              <UserCheck className="h-4 w-4 text-(--earist-success)" />
            </div>
            <p className="text-2xl font-bold text-(--earist-success) mt-1">{adviserStats.availableSlots} Slots</p>
            <p className="text-[11px] text-(--earist-body-text) mt-0.5">Across {adviserStats.totalAdvisers} faculty members</p>
          </CardContent>
        </Card>
      </div>

      {/* Section 1: Residency Registry */}
      <Card className="border-(--earist-border-gray) bg-white shadow-2xs">
        <CardHeader className="border-b border-(--earist-border-gray) bg-(--earist-surface-gray) py-3 px-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-sm font-bold text-(--earist-primary)">
                Student Maximum Residency Compliance Registry
              </CardTitle>
              <CardDescription className="text-xs text-(--earist-body-text)">
                Policy ceiling: 5 years for Master&apos;s degrees, 7 years for Doctoral degrees
              </CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-md border border-(--earist-border-gray) bg-white p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setResidencyStatusFilter("ALL")}
                  className={`rounded px-2.5 py-1 text-xs font-medium transition-all ${
                    residencyStatusFilter === "ALL"
                      ? "bg-(--earist-surface-gray) text-(--earist-primary) font-semibold"
                      : "text-(--earist-body-text) hover:text-gray-900"
                  }`}
                >
                  All ({residencyStats.total})
                </button>
                <button
                  type="button"
                  onClick={() => setResidencyStatusFilter("OVERSTAYING")}
                  className={`rounded px-2.5 py-1 text-xs font-medium transition-all ${
                    residencyStatusFilter === "OVERSTAYING"
                      ? "bg-(--earist-surface-gray) text-(--earist-primary) font-semibold"
                      : "text-(--earist-body-text) hover:text-gray-900"
                  }`}
                >
                  Overstaying ({residencyStats.overstaying})
                </button>
                <button
                  type="button"
                  onClick={() => setResidencyStatusFilter("APPROACHING_LIMIT")}
                  className={`rounded px-2.5 py-1 text-xs font-medium transition-all ${
                    residencyStatusFilter === "APPROACHING_LIMIT"
                      ? "bg-(--earist-surface-gray) text-(--earist-warning) font-semibold"
                      : "text-(--earist-body-text) hover:text-gray-900"
                  }`}
                >
                  Approaching ({residencyStats.approaching})
                </button>
              </div>

              <div className="relative w-48">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search student..."
                  value={residencySearch}
                  onChange={(e) => setResidencySearch(e.target.value)}
                  className="h-8 pl-8 text-xs border-(--earist-border-gray) bg-white"
                />
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-(--earist-body-text)">
              <thead className="bg-(--earist-surface-gray) text-[11px] font-semibold text-(--earist-body-text) border-b border-(--earist-border-gray)">
                <tr>
                  <th scope="col" className="px-4 py-3">Student Name & ID</th>
                  <th scope="col" className="px-3 py-3">Program</th>
                  <th scope="col" className="px-3 py-3 text-center">Enrolled</th>
                  <th scope="col" className="px-4 py-3 text-center">Residency Elapsed</th>
                  <th scope="col" className="px-3 py-3 text-center">Remaining</th>
                  <th scope="col" className="px-3 py-3 text-center">Status</th>
                  <th scope="col" className="px-4 py-3 text-right">Dean Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-(--earist-border-gray)">
                {filteredResidency.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-xs text-gray-400">
                      No student records match your filter.
                    </td>
                  </tr>
                ) : (
                  filteredResidency.map((s) => {
                    const percentage = Math.min((s.elapsedYears / s.maxResidencyYears) * 100, 100);
                    const isOverstaying = s.status === "OVERSTAYING";
                    const isApproaching = s.status === "APPROACHING_LIMIT";

                    return (
                      <tr key={s.id} className="hover:bg-(--earist-surface-gray)/60 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-foreground">{s.name}</p>
                          <p className="text-[11px] text-gray-500 font-mono">{s.studentNumber}</p>
                        </td>

                        <td className="px-3 py-3">
                          <p className="text-foreground">{s.program}</p>
                          <span className="text-[10px] text-gray-500">
                            {s.degreeLevel} (Max {s.maxResidencyYears} yrs)
                          </span>
                        </td>

                        <td className="px-3 py-3 text-center font-mono text-[11px] text-(--earist-body-text)">
                          {s.enrollmentDate}
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex flex-col items-center gap-1">
                            <div className="h-1.5 w-28 rounded-full bg-gray-200 overflow-hidden">
                              <div
                                className={`h-full ${
                                  isOverstaying
                                    ? "bg-(--earist-primary)"
                                    : isApproaching
                                    ? "bg-(--earist-warning)"
                                    : "bg-(--earist-success)"
                                }`}
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-(--earist-body-text)">
                              {s.elapsedYears} / {s.maxResidencyYears} Years ({percentage.toFixed(0)}%)
                            </span>
                          </div>
                        </td>

                        <td className="px-3 py-3 text-center">
                          {isOverstaying ? (
                            <span className="font-bold text-(--earist-primary) text-[11px]">Overdue</span>
                          ) : (
                            <span className={`text-[11px] font-medium ${isApproaching ? "text-(--earist-warning)" : ""}`}>
                              {s.remainingMonths} Months
                            </span>
                          )}
                        </td>

                        <td className="px-3 py-3 text-center">
                          {isOverstaying ? (
                            <Badge variant="outline" className="border-(--earist-primary) text-(--earist-primary) text-[10px]">
                              Overstaying
                            </Badge>
                          ) : isApproaching ? (
                            <Badge variant="outline" className="border-(--earist-warning) text-(--earist-warning) text-[10px]">
                              Approaching Limit
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-(--earist-success) text-(--earist-success) text-[10px]">
                              Compliant
                            </Badge>
                          )}
                        </td>

                        <td className="px-4 py-3 text-right">
                          {warningSentIds[s.id] ? (
                            <span className="text-[10px] text-(--earist-body-text)">
                              Notice Sent {warningSentIds[s.id]}
                            </span>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleSendWarning(s.id)}
                              className="h-7 border-(--earist-border-gray) bg-white text-xs text-(--earist-body-text) hover:bg-(--earist-surface-gray)"
                            >
                              Issue Warning
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Faculty Adviser Load Matrix */}
      <Card className="border-(--earist-border-gray) bg-white shadow-2xs">
        <CardHeader className="border-b border-(--earist-border-gray) bg-(--earist-surface-gray) py-3 px-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-bold text-(--earist-primary)">
                Faculty Adviser Workload & Capacity Matrix
              </CardTitle>
              <CardDescription className="text-xs text-(--earist-body-text)">
                Active thesis candidates per faculty member (maximum cap: 5 advisees)
              </CardDescription>
            </div>

            <span className="text-xs font-semibold text-(--earist-body-text)">
              {adviserStats.totalAdvisees} Active / {adviserStats.totalAdvisers * 5} Capacity
            </span>
          </div>
        </CardHeader>

        <CardContent className="pt-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {data.adviserLoadMatrix.map((adviser) => {
              const isAtCapacity = adviser.capacityStatus === "AT_CAPACITY";
              const isExpanded = expandedAdviserId === adviser.id;
              const loadPercent = (adviser.activeAdviseesCount / adviser.maxCapacity) * 100;

              return (
                <div
                  key={adviser.id}
                  className="rounded-lg border border-(--earist-border-gray) bg-white p-3.5 shadow-2xs flex flex-col justify-between"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-foreground">{adviser.name}</h4>
                        <p className="text-[11px] text-gray-500">{adviser.department}</p>
                      </div>

                      {isAtCapacity ? (
                        <Badge variant="outline" className="border-(--earist-primary) text-(--earist-primary) text-[10px]">
                          At Capacity (5/5)
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-(--earist-success) text-(--earist-success) text-[10px]">
                          Available ({adviser.activeAdviseesCount}/5)
                        </Badge>
                      )}
                    </div>

                    <p className="text-[11px] text-(--earist-body-text) line-clamp-2">
                      Specialization: {adviser.specialization}
                    </p>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-(--earist-body-text)">
                        <span>Load:</span>
                        <span className="font-bold text-foreground">
                          {adviser.activeAdviseesCount} of 5 Slots ({loadPercent.toFixed(0)}%)
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-gray-200 overflow-hidden">
                        <div
                          className={`h-full ${isAtCapacity ? "bg-(--earist-primary)" : "bg-(--earist-success)"}`}
                          style={{ width: `${loadPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 mt-3 border-t border-(--earist-border-gray)">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedAdviserId(isExpanded ? null : adviser.id)}
                      className="w-full h-7 text-xs text-(--earist-primary) hover:bg-(--earist-surface-gray) justify-between p-1"
                    >
                      <span>{isExpanded ? "Hide Advisees" : `View ${adviser.advisees.length} Advisees`}</span>
                      {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </Button>

                    {isExpanded && (
                      <div className="mt-2 space-y-1 rounded bg-(--earist-surface-gray) p-2 text-xs border border-(--earist-border-gray)">
                        {adviser.advisees.map((adv, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between text-[11px] bg-white p-1.5 rounded border border-(--earist-border-gray)"
                          >
                            <div>
                              <p className="font-semibold text-foreground">{adv.studentName}</p>
                              <p className="text-[10px] text-gray-500">{adv.studentNumber} &bull; {adv.program}</p>
                            </div>
                            <span className="text-[10px] font-medium text-(--earist-body-text)">
                              {adv.stage}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Section 3: Official Reports Export Suite */}
      <Card className="border-(--earist-border-gray) bg-white shadow-2xs">
        <CardHeader className="border-b border-(--earist-border-gray) bg-(--earist-surface-gray) py-3 px-4">
          <CardTitle className="text-sm font-bold text-(--earist-primary)">
            Consolidated Reports & Accreditation Data Suite
          </CardTitle>
          <CardDescription className="text-xs text-(--earist-body-text)">
            Official institutional exports for CHED, AACCUP accreditation, and administrative records
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded border border-(--earist-border-gray) bg-white p-3 space-y-2">
              <span className="text-xs font-bold text-foreground block">Admissions & Alignment</span>
              <p className="text-[11px] text-(--earist-body-text)">
                Applicant yield and undergraduate Applicant Program Alignment Form records.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={exportResidencyCsv}
                className="w-full h-7 text-xs border-(--earist-border-gray) text-(--earist-primary) hover:bg-(--earist-surface-gray)"
              >
                <Download className="h-3 w-3 mr-1" />
                Download Report
              </Button>
            </div>

            <div className="rounded border border-(--earist-border-gray) bg-white p-3 space-y-2">
              <span className="text-xs font-bold text-foreground block">ECAT & Comp Exam Ledger</span>
              <p className="text-[11px] text-(--earist-body-text)">
                Entrance score breakdown and FR15 comprehensive exam verifications.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={exportResidencyCsv}
                className="w-full h-7 text-xs border-(--earist-border-gray) text-(--earist-primary) hover:bg-(--earist-surface-gray)"
              >
                <Download className="h-3 w-3 mr-1" />
                Download Report
              </Button>
            </div>

            <div className="rounded border border-(--earist-border-gray) bg-white p-3 space-y-2">
              <span className="text-xs font-bold text-foreground block">Thesis & STRIKE Log</span>
              <p className="text-[11px] text-(--earist-body-text)">
                Defense funnel milestones and plagiarism similarity clearance.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={exportResidencyCsv}
                className="w-full h-7 text-xs border-(--earist-border-gray) text-(--earist-primary) hover:bg-(--earist-surface-gray)"
              >
                <Download className="h-3 w-3 mr-1" />
                Download Report
              </Button>
            </div>

            <div className="rounded border border-(--earist-border-gray) bg-white p-3 space-y-2">
              <span className="text-xs font-bold text-foreground block">Residency & Adviser Audit</span>
              <p className="text-[11px] text-(--earist-body-text)">
                Residency compliance tracking and faculty workload allocations.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={exportAdviserCsv}
                className="w-full h-7 text-xs border-(--earist-border-gray) text-(--earist-primary) hover:bg-(--earist-surface-gray)"
              >
                <Download className="h-3 w-3 mr-1" />
                Download Report
              </Button>
            </div>
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
