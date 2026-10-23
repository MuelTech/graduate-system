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
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  Users,
  GraduationCap,
  Calendar,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  InstitutionalReportsData,
  ResidencyStudentItem,
  AdviserLoadItem,
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

  // Filtered Residency Registry
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

  // Residency Summary Stats
  const residencyStats = useMemo(() => {
    const overstaying = data.residencyRegistry.filter((r) => r.status === "OVERSTAYING").length;
    const approaching = data.residencyRegistry.filter((r) => r.status === "APPROACHING_LIMIT").length;
    const normal = data.residencyRegistry.filter((r) => r.status === "NORMAL").length;
    return { overstaying, approaching, normal, total: data.residencyRegistry.length };
  }, [data.residencyRegistry]);

  // Adviser Summary Stats
  const adviserStats = useMemo(() => {
    const totalAdvisers = data.adviserLoadMatrix.length;
    const atCapacity = data.adviserLoadMatrix.filter((a) => a.capacityStatus === "AT_CAPACITY").length;
    const totalAdvisees = data.adviserLoadMatrix.reduce((acc, a) => acc + a.activeAdviseesCount, 0);
    const maxCapacitySlots = data.adviserLoadMatrix.reduce((acc, a) => acc + a.maxCapacity, 0);
    const availableSlots = maxCapacitySlots - totalAdvisees;
    return { totalAdvisers, atCapacity, totalAdvisees, availableSlots };
  }, [data.adviserLoadMatrix]);

  // Handle Send Warning Action
  const handleSendWarning = (studentId: string) => {
    const today = new Date().toISOString().split("T")[0];
    setWarningSentIds((prev) => ({ ...prev, [studentId]: today }));
  };

  // CSV Exporters
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
      {/* Tab Header Banner */}
      <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <FileText className="h-5 w-5 text-(--earist-primary)" />
            Institutional Compliance & Official Reports Registry
          </h2>
          <p className="text-xs text-gray-600">
            Real-time compliance tracking for student maximum residency limits (5-yr Masters / 7-yr Doctoral), faculty mentorship caps, and accreditation reports.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            className="h-8 gap-1.5 border-gray-200 text-xs text-gray-700 hover:bg-gray-50"
          >
            <Printer className="h-3.5 w-3.5 text-gray-500" />
            Print / Save PDF
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={exportResidencyCsv}
            className="h-8 gap-1.5 border-gray-200 text-xs text-gray-700 hover:bg-gray-50"
          >
            <Download className="h-3.5 w-3.5 text-gray-500" />
            Export Residency CSV
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={exportAdviserCsv}
            className="h-8 gap-1.5 border-gray-200 text-xs text-gray-700 hover:bg-gray-50"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
            Export Adviser CSV
          </Button>
        </div>
      </div>

      {/* Top Compliance KPI Metric Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {/* Overstaying Breaches */}
        <Card className="border-red-200 bg-red-50/30 shadow-2xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-xs text-red-800 font-medium">
              <span>Overstaying Breaches</span>
              <AlertTriangle className="h-4 w-4 text-red-600" />
            </div>
            <p className="text-2xl font-bold text-red-700 mt-1">{residencyStats.overstaying} Students</p>
            <p className="text-[11px] text-red-800 mt-0.5">Exceeded maximum residency</p>
          </CardContent>
        </Card>

        {/* Approaching Maximum Limit */}
        <Card className="border-amber-200 bg-amber-50/40 shadow-2xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-xs text-amber-800 font-medium">
              <span>Approaching Limit</span>
              <Clock className="h-4 w-4 text-amber-600" />
            </div>
            <p className="text-2xl font-bold text-amber-700 mt-1">{residencyStats.approaching} Students</p>
            <p className="text-[11px] text-amber-800 mt-0.5">&le; 6 months remaining</p>
          </CardContent>
        </Card>

        {/* Advisers at Max Capacity */}
        <Card className="border-indigo-200 bg-indigo-50/30 shadow-2xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-xs text-indigo-800 font-medium">
              <span>Advisers At Capacity</span>
              <Users className="h-4 w-4 text-indigo-600" />
            </div>
            <p className="text-2xl font-bold text-indigo-700 mt-1">{adviserStats.atCapacity} Faculty</p>
            <p className="text-[11px] text-indigo-800 mt-0.5">Reached 5/5 advisee cap</p>
          </CardContent>
        </Card>

        {/* Available Advisee Slots */}
        <Card className="border-emerald-200 bg-emerald-50/30 shadow-2xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-xs text-emerald-800 font-medium">
              <span>Available Capacity</span>
              <UserCheck className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="text-2xl font-bold text-emerald-700 mt-1">{adviserStats.availableSlots} Slots</p>
            <p className="text-[11px] text-emerald-800 mt-0.5">Across {adviserStats.totalAdvisers} faculty advisers</p>
          </CardContent>
        </Card>
      </div>

      {/* Section 1: Institutional Residency Risk Registry */}
      <Card className="border-gray-200 shadow-2xs">
        <CardHeader className="border-b border-gray-100 pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-bold text-gray-900">
                  Student Maximum Residency Compliance Registry
                </CardTitle>
                <Badge className="bg-(--earist-primary)/10 text-(--earist-primary) hover:bg-(--earist-primary)/10 text-[10px]">
                  CHED & GS Manual Policy
                </Badge>
              </div>
              <CardDescription className="text-xs text-gray-500">
                Mandatory monitoring: 5 years for Master&apos;s degrees, 7 years for Doctoral degrees
              </CardDescription>
            </div>

            {/* Filter and Search Controls */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setResidencyStatusFilter("ALL")}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                    residencyStatusFilter === "ALL"
                      ? "bg-white text-gray-900 shadow-2xs"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  All ({residencyStats.total})
                </button>
                <button
                  type="button"
                  onClick={() => setResidencyStatusFilter("OVERSTAYING")}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                    residencyStatusFilter === "OVERSTAYING"
                      ? "bg-white text-red-700 shadow-2xs"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Overstaying ({residencyStats.overstaying})
                </button>
                <button
                  type="button"
                  onClick={() => setResidencyStatusFilter("APPROACHING_LIMIT")}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                    residencyStatusFilter === "APPROACHING_LIMIT"
                      ? "bg-white text-amber-700 shadow-2xs"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Approaching ({residencyStats.approaching})
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative w-48">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Filter student..."
                  value={residencySearch}
                  onChange={(e) => setResidencySearch(e.target.value)}
                  className="h-8 pl-8 text-xs border-gray-200"
                />
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-700">
              <thead className="bg-gray-50 text-[11px] font-semibold uppercase tracking-wider text-gray-500 border-b border-gray-100">
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
              <tbody className="divide-y divide-gray-100">
                {filteredResidency.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-xs text-gray-400">
                      No student records match your residency filter.
                    </td>
                  </tr>
                ) : (
                  filteredResidency.map((s) => {
                    const percentage = Math.min((s.elapsedYears / s.maxResidencyYears) * 100, 100);
                    const isOverstaying = s.status === "OVERSTAYING";
                    const isApproaching = s.status === "APPROACHING_LIMIT";

                    return (
                      <tr key={s.id} className="hover:bg-gray-50/60 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-gray-900">{s.name}</p>
                          <p className="text-[11px] text-gray-500 font-mono">{s.studentNumber}</p>
                        </td>

                        <td className="px-3 py-3">
                          <p className="text-gray-800 line-clamp-1">{s.program}</p>
                          <Badge variant="outline" className="text-[9px] py-0 px-1 text-gray-500 border-gray-200">
                            {s.degreeLevel} (Max {s.maxResidencyYears} yrs)
                          </Badge>
                        </td>

                        <td className="px-3 py-3 text-center text-gray-600 font-mono text-[11px]">
                          {s.enrollmentDate}
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex flex-col items-center gap-1">
                            <div className="h-2 w-28 rounded-full bg-gray-100 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  isOverstaying
                                    ? "bg-red-600"
                                    : isApproaching
                                    ? "bg-amber-500"
                                    : "bg-emerald-500"
                                }`}
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-gray-500 font-medium">
                              {s.elapsedYears} / {s.maxResidencyYears} Years ({percentage.toFixed(0)}%)
                            </span>
                          </div>
                        </td>

                        <td className="px-3 py-3 text-center">
                          {isOverstaying ? (
                            <span className="font-bold text-red-600 text-[11px]">Overdue (0 Mos)</span>
                          ) : (
                            <span
                              className={`font-semibold text-[11px] ${
                                isApproaching ? "text-amber-700" : "text-gray-700"
                              }`}
                            >
                              {s.remainingMonths} Months
                            </span>
                          )}
                        </td>

                        <td className="px-3 py-3 text-center">
                          {isOverstaying ? (
                            <Badge className="bg-red-100 text-red-800 hover:bg-red-100 text-[10px] font-bold">
                              <AlertTriangle className="h-3 w-3 mr-1 text-red-600" />
                              Overstaying
                            </Badge>
                          ) : isApproaching ? (
                            <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 text-[10px] font-semibold">
                              <Clock className="h-3 w-3 mr-1 text-amber-600" />
                              Approaching Limit
                            </Badge>
                          ) : (
                            <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50 text-[10px]">
                              <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-600" />
                              Compliant
                            </Badge>
                          )}
                        </td>

                        <td className="px-4 py-3 text-right">
                          {warningSentIds[s.id] ? (
                            <Badge
                              variant="outline"
                              className="text-[10px] border-gray-200 text-gray-600 bg-gray-50 font-normal"
                            >
                              Notice Sent {warningSentIds[s.id]}
                            </Badge>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleSendWarning(s.id)}
                              className="h-7 border-amber-300 bg-white text-xs text-amber-900 hover:bg-amber-50"
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

      {/* Section 2: Faculty Adviser Load & Mentorship Capacity Matrix */}
      <Card className="border-gray-200 shadow-2xs">
        <CardHeader className="border-b border-gray-100 pb-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-bold text-gray-900">
                  Faculty Adviser Workload & Capacity Matrix
                </CardTitle>
                <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-[10px]">
                  Max 5 Advisees Cap
                </Badge>
              </div>
              <CardDescription className="text-xs text-gray-500">
                Institutional distribution of active thesis candidates across accredited graduate faculty
              </CardDescription>
            </div>

            <Badge variant="outline" className="text-xs text-gray-600 bg-gray-50 border-gray-200">
              {adviserStats.totalAdvisees} Active Advisees / {adviserStats.totalAdvisers * 5} Capacity
            </Badge>
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
                  className={`rounded-xl border p-4 transition-all ${
                    isAtCapacity
                      ? "border-amber-200 bg-amber-50/20"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  } shadow-2xs flex flex-col justify-between`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-gray-900">{adviser.name}</h4>
                        <p className="text-[11px] text-gray-500 line-clamp-1">{adviser.department}</p>
                      </div>

                      {isAtCapacity ? (
                        <Badge className="bg-red-100 text-red-800 hover:bg-red-100 text-[10px] font-bold">
                          At Capacity (5/5)
                        </Badge>
                      ) : (
                        <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50 text-[10px]">
                          Available ({adviser.activeAdviseesCount}/{adviser.maxCapacity})
                        </Badge>
                      )}
                    </div>

                    <p className="text-[11px] text-gray-600 line-clamp-2 italic">
                      Specialization: {adviser.specialization}
                    </p>

                    {/* Workload Progress Bar */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-gray-600">
                        <span>Advisee Load:</span>
                        <span className="font-bold text-gray-900">
                          {adviser.activeAdviseesCount} of {adviser.maxCapacity} Slots ({loadPercent.toFixed(0)}%)
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            isAtCapacity ? "bg-red-500" : loadPercent >= 80 ? "bg-amber-500" : "bg-emerald-500"
                          }`}
                          style={{ width: `${loadPercent}%` }}
                        />
                      </div>
                    </div>

                    {/* Assigned Programs */}
                    <div className="flex flex-wrap gap-1">
                      {adviser.assignedPrograms.map((prog, i) => (
                        <Badge
                          key={i}
                          variant="outline"
                          className="text-[9px] bg-white border-gray-200 text-gray-600 py-0"
                        >
                          {prog}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Expand Advisees Toggle */}
                  <div className="pt-3 mt-3 border-t border-gray-100">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedAdviserId(isExpanded ? null : adviser.id)}
                      className="w-full h-7 text-xs text-indigo-700 hover:bg-indigo-50 justify-between p-1"
                    >
                      <span>{isExpanded ? "Hide Advisees" : `View ${adviser.advisees.length} Advisees`}</span>
                      {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </Button>

                    {/* Expanded Advisee Roster */}
                    {isExpanded && (
                      <div className="mt-2 space-y-1.5 rounded-lg bg-gray-50 p-2 text-xs border border-gray-100">
                        {adviser.advisees.map((adv, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between text-[11px] bg-white p-1.5 rounded border border-gray-100"
                          >
                            <div>
                              <p className="font-semibold text-gray-900">{adv.studentName}</p>
                              <p className="text-[10px] text-gray-500 font-mono">{adv.studentNumber} &bull; {adv.program}</p>
                            </div>
                            <Badge
                              className={`text-[9px] py-0 px-1.5 ${
                                adv.stage === "FINAL"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : adv.stage === "PROPOSAL"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-blue-100 text-blue-800"
                              }`}
                            >
                              {adv.stage}
                            </Badge>
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

      {/* Section 3: Official Accreditation & Audit Export Suite */}
      <Card className="border-gray-200 bg-gradient-to-r from-gray-50 via-white to-gray-50 shadow-2xs">
        <CardHeader className="pb-3 border-b border-gray-100">
          <CardTitle className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <Download className="h-4 w-4 text-(--earist-primary)" />
            Consolidated Institutional Reports & Audit Data Suite
          </CardTitle>
          <CardDescription className="text-xs text-gray-500">
            Export comprehensive, pre-formatted datasets across all 4 analytics domains for CHED, AACCUP accreditation, and Administrative Council reports.
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-gray-200 bg-white p-3 space-y-2">
              <span className="text-xs font-bold text-gray-900 block">Admissions & Alignment Ledger</span>
              <p className="text-[11px] text-gray-500">
                Applicant counts, enrollment yield, and feeder undergraduate degrees with bridging waiver logs.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={exportResidencyCsv}
                className="w-full h-7 text-xs border-gray-200 text-(--earist-primary) hover:bg-gray-50"
              >
                <Download className="h-3 w-3 mr-1" />
                Download Report
              </Button>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-3 space-y-2">
              <span className="text-xs font-bold text-gray-900 block">Examination Results & FR15 Ledger</span>
              <p className="text-[11px] text-gray-500">
                ECAT multiple choice and essay scores, Comprehensive Examination written and oral verification dates.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={exportResidencyCsv}
                className="w-full h-7 text-xs border-gray-200 text-(--earist-primary) hover:bg-gray-50"
              >
                <Download className="h-3 w-3 mr-1" />
                Download Report
              </Button>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-3 space-y-2">
              <span className="text-xs font-bold text-gray-900 block">Thesis Pipeline & STRIKE Log</span>
              <p className="text-[11px] text-gray-500">
                Defense funnel milestones, average turnaround intervals, and Turnitin/STRIKE similarity audit certificates.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={exportResidencyCsv}
                className="w-full h-7 text-xs border-gray-200 text-(--earist-primary) hover:bg-gray-50"
              >
                <Download className="h-3 w-3 mr-1" />
                Download Report
              </Button>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-3 space-y-2">
              <span className="text-xs font-bold text-gray-900 block">Residency & Adviser Load Audit</span>
              <p className="text-[11px] text-gray-500">
                Full residency tracking registry, formal warning notices, and faculty mentor capacity allocations.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={exportAdviserCsv}
                className="w-full h-7 text-xs border-gray-200 text-(--earist-primary) hover:bg-gray-50"
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
