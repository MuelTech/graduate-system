"use client";

import { Calendar, Download, Filter, FileText, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface AnalyticsHeaderProps {
  selectedAy: string;
  onAyChange: (ay: string) => void;
  selectedSemester: string;
  onSemesterChange: (sem: string) => void;
  selectedProgram: string;
  onProgramChange: (prog: string) => void;
  onExportCsv?: () => void;
  onPrint?: () => void;
  onToggleAiAssistant?: () => void;
  isAiAssistantOpen?: boolean;
}

const ACADEMIC_YEARS = [
  { value: "AY 2025–2026", label: "AY 2025–2026 (Current)" },
  { value: "AY 2024–2025", label: "AY 2024–2025" },
  { value: "AY 2023–2024", label: "AY 2023–2024" },
  { value: "ALL", label: "All Academic Years" },
];

const SEMESTERS = [
  { value: "ALL", label: "All Semesters" },
  { value: "1st Semester", label: "1st Semester" },
  { value: "2nd Semester", label: "2nd Semester" },
  { value: "Summer", label: "Summer Term" },
];

const PROGRAMS = [
  { value: "ALL", label: "All Graduate Programs" },
  { value: "MBA", label: "Master in Business Administration (MBA)" },
  { value: "MPA", label: "Master in Public Administration (MPA)" },
  { value: "MAED-EM", label: "MA in Education - Educational Management (MAED)" },
  { value: "MSIT", label: "MS in Information Technology (MSIT)" },
  { value: "MS Crim", label: "MS in Criminology (MS Crim)" },
  { value: "EdD", label: "Doctor of Education (EdD)" },
  { value: "DPA", label: "Doctor in Public Administration (DPA)" },
];

export function AnalyticsHeader({
  selectedAy,
  onAyChange,
  selectedSemester,
  onSemesterChange,
  selectedProgram,
  onProgramChange,
  onExportCsv,
  onPrint,
  onToggleAiAssistant,
  isAiAssistantOpen,
}: AnalyticsHeaderProps) {
  return (
    <div className="space-y-4">
      {/* Title & Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div>
          <h1
            className="text-2xl font-bold tracking-tight text-(--earist-primary) sm:text-3xl"
            style={{ fontFamily: '"Calibri", "Segoe UI", Roboto, sans-serif' }}
          >
            Academic Analytics & Reports
          </h1>
          <p className="mt-1 text-sm text-(--earist-body-text)">
            Official institutional metrics for graduate admissions, examinations, thesis throughput, and compliance.
          </p>
        </div>

        {/* Global Quick Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {onToggleAiAssistant && (
            <Button
              variant="outline"
              size="sm"
              onClick={onToggleAiAssistant}
              className={`text-xs border-(--earist-border-gray) ${
                isAiAssistantOpen
                  ? "bg-(--earist-surface-light-red) text-(--earist-primary) border-(--earist-secondary)"
                  : "bg-white text-(--earist-body-text) hover:bg-(--earist-surface-gray)"
              }`}
            >
              <FileText className="mr-1.5 h-3.5 w-3.5 text-(--earist-primary)" />
              {isAiAssistantOpen ? "Hide Executive Briefing" : "Dean's Executive Briefing"}
            </Button>
          )}

          {onExportCsv && (
            <Button
              variant="outline"
              size="sm"
              onClick={onExportCsv}
              className="border-(--earist-border-gray) bg-white text-xs text-(--earist-body-text) hover:bg-(--earist-surface-gray)"
            >
              <Download className="mr-1.5 h-3.5 w-3.5 text-gray-500" />
              Export Summary (CSV)
            </Button>
          )}

          {onPrint && (
            <Button
              variant="outline"
              size="sm"
              onClick={onPrint}
              className="border-(--earist-border-gray) bg-white text-xs text-(--earist-body-text) hover:bg-(--earist-surface-gray)"
            >
              <Printer className="mr-1.5 h-3.5 w-3.5 text-gray-500" />
              Print View
            </Button>
          )}
        </div>
      </div>

      {/* Global Interactive Filter Bar */}
      <div className="flex flex-col gap-3 rounded-lg border border-(--earist-border-gray) bg-white p-3 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-(--earist-primary)">
            <Filter className="h-3.5 w-3.5 text-(--earist-secondary)" />
            <span>Scope Filters:</span>
          </div>

          {/* Academic Year Selector */}
          <div className="relative">
            <select
              aria-label="Select Academic Year"
              value={selectedAy}
              onChange={(e) => onAyChange(e.target.value)}
              className="h-8 rounded-md border border-(--earist-border-gray) bg-white px-2.5 text-xs text-(--earist-body-text) focus:border-(--earist-primary) focus:outline-none"
            >
              {ACADEMIC_YEARS.map((ay) => (
                <option key={ay.value} value={ay.value}>
                  {ay.label}
                </option>
              ))}
            </select>
          </div>

          {/* Semester Selector */}
          <div className="relative">
            <select
              aria-label="Select Semester"
              value={selectedSemester}
              onChange={(e) => onSemesterChange(e.target.value)}
              className="h-8 rounded-md border border-(--earist-border-gray) bg-white px-2.5 text-xs text-(--earist-body-text) focus:border-(--earist-primary) focus:outline-none"
            >
              {SEMESTERS.map((sem) => (
                <option key={sem.value} value={sem.value}>
                  {sem.label}
                </option>
              ))}
            </select>
          </div>

          {/* Graduate Program Selector */}
          <div className="relative">
            <select
              aria-label="Select Graduate Program"
              value={selectedProgram}
              onChange={(e) => onProgramChange(e.target.value)}
              className="h-8 rounded-md border border-(--earist-border-gray) bg-white px-2.5 text-xs text-(--earist-body-text) focus:border-(--earist-primary) focus:outline-none"
            >
              {PROGRAMS.map((prog) => (
                <option key={prog.value} value={prog.value}>
                  {prog.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Filter State Note */}
        <div className="flex items-center gap-2 text-xs text-(--earist-body-text)">
          <Calendar className="h-3.5 w-3.5 text-gray-400" />
          <span>
            Scope: <strong>{selectedAy}</strong> &middot; {selectedSemester}
          </span>
        </div>
      </div>
    </div>
  );
}
