"use client";

import { Calendar, Download, Filter, GraduationCap, Printer, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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
      {/* Top Banner & Title */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1
              className="text-2xl font-bold tracking-tight text-(--earist-primary) sm:text-3xl"
              style={{ fontFamily: '"Calibri", sans-serif' }}
            >
              Academic Analytics & Reports
            </h1>
            <Badge variant="outline" className="border-amber-300 bg-amber-50 text-[11px] font-semibold text-amber-800">
              Institutional View
            </Badge>
          </div>
          <p className="mt-1 text-sm text-(--earist-body-text)">
            Visualize admissions pipeline, examination pass rates, thesis progression, STRIKE plagiarism trends, and institutional compliance.
          </p>
        </div>

        {/* Global Quick Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {onToggleAiAssistant && (
            <Button
              variant="outline"
              size="sm"
              onClick={onToggleAiAssistant}
              className={`border-indigo-300 text-xs font-medium transition-all ${
                isAiAssistantOpen
                  ? "bg-indigo-50 text-indigo-700 ring-2 ring-indigo-400/30"
                  : "bg-white text-indigo-700 hover:bg-indigo-50/70"
              }`}
            >
              <Sparkles className="mr-1.5 h-3.5 w-3.5 text-indigo-600" />
              AI Briefing Assistant
            </Button>
          )}

          {onExportCsv && (
            <Button
              variant="outline"
              size="sm"
              onClick={onExportCsv}
              className="border-(--earist-border-gray) bg-white text-xs text-gray-700 hover:bg-gray-50"
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
              className="border-(--earist-border-gray) bg-white text-xs text-gray-700 hover:bg-gray-50"
            >
              <Printer className="mr-1.5 h-3.5 w-3.5 text-gray-500" />
              Print View
            </Button>
          )}
        </div>
      </div>

      {/* Global Interactive Filter Bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-(--earist-border-gray) bg-white p-3.5 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-(--earist-secondary)">
            <Filter className="h-3.5 w-3.5" />
            <span>Scope Filters:</span>
          </div>

          {/* Academic Year Selector */}
          <div className="relative">
            <select
              aria-label="Select Academic Year"
              value={selectedAy}
              onChange={(e) => onAyChange(e.target.value)}
              className="h-8 rounded-lg border border-(--earist-border-gray) bg-white px-2.5 text-xs font-medium text-gray-800 transition-colors focus:border-(--earist-primary) focus:outline-none focus:ring-2 focus:ring-(--earist-primary)/20"
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
              className="h-8 rounded-lg border border-(--earist-border-gray) bg-white px-2.5 text-xs font-medium text-gray-800 transition-colors focus:border-(--earist-primary) focus:outline-none focus:ring-2 focus:ring-(--earist-primary)/20"
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
              className="h-8 rounded-lg border border-(--earist-border-gray) bg-white px-2.5 text-xs font-medium text-gray-800 transition-colors focus:border-(--earist-primary) focus:outline-none focus:ring-2 focus:ring-(--earist-primary)/20"
            >
              {PROGRAMS.map((prog) => (
                <option key={prog.value} value={prog.value}>
                  {prog.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Filter State Pill */}
        <div className="flex items-center gap-2 text-xs text-(--earist-body-text)">
          <span className="flex items-center gap-1 text-[11px] text-gray-500">
            <Calendar className="h-3 w-3" />
            Showing: <strong className="text-gray-800">{selectedAy}</strong> &middot; {selectedSemester}
          </span>
          {selectedProgram !== "ALL" && (
            <Badge variant="secondary" className="text-[10px] bg-(--earist-surface-light-red) text-(--earist-primary)">
              {selectedProgram}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}
