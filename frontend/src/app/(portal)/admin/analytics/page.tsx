"use client";

import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  GraduationCap,
  FileCheck2,
  BookOpen,
  FileText,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// Analytics Sub-Components
import { AnalyticsHeader } from "@/components/admin/analytics/analytics-header";
import { AnalyticsKpiRow } from "@/components/admin/analytics/analytics-kpi-row";
import { AiAnalyticsAssistant } from "@/components/admin/analytics/ai-analytics-assistant";
import { AdmissionsTab } from "@/components/admin/analytics/admissions-tab";
import { ExaminationsTab } from "@/components/admin/analytics/examinations-tab";
import { ThesisPipelineTab } from "@/components/admin/analytics/thesis-pipeline-tab";
import { InstitutionalReportsTab } from "@/components/admin/analytics/institutional-reports-tab";

// Mock Data Source
import {
  MOCK_ANALYTICS_KPIS,
  MOCK_AI_ANALYTICS_BRIEFING,
  MOCK_ADMISSIONS_ANALYTICS,
  MOCK_EXAMINATION_ANALYTICS,
  MOCK_THESIS_PIPELINE_ANALYTICS,
  MOCK_INSTITUTIONAL_REPORTS,
} from "@/lib/mock/analytics-data";

export default function AdminAnalyticsPage() {
  // Global Filter States
  const [selectedAy, setSelectedAy] = useState("AY 2025–2026");
  const [selectedSemester, setSelectedSemester] = useState("1st Semester");
  const [selectedProgram, setSelectedProgram] = useState("ALL");
  const [isAiAssistantOpen, setIsAiAssistantOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("admissions");

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  const handleExportSummary = () => {
    const headers = ["Metric ID", "Indicator Label", "Current Value", "Supporting Note", "YoY Change %"];
    const rows = MOCK_ANALYTICS_KPIS.map((kpi) => [
      kpi.id,
      kpi.label,
      kpi.value,
      kpi.sublabel || "",
      `${kpi.isPositiveTrend ? "+" : "-"}${kpi.changePercentage}%`,
    ]);
    const content = [
      headers.join(","),
      ...rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")),
    ].join("\r\n");

    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `EARIST_Executive_Analytics_Summary_${selectedAy.replace(/\s+/g, "_")}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Global Filter Header */}
      <AnalyticsHeader
        selectedAy={selectedAy}
        onAyChange={setSelectedAy}
        selectedSemester={selectedSemester}
        onSemesterChange={setSelectedSemester}
        selectedProgram={selectedProgram}
        onProgramChange={setSelectedProgram}
        isAiAssistantOpen={isAiAssistantOpen}
        onToggleAiAssistant={() => setIsAiAssistantOpen((prev) => !prev)}
        onPrint={handlePrint}
        onExportCsv={handleExportSummary}
      />

      {/* 2. Top Summary KPI Row with Chart.js Sparklines */}
      <AnalyticsKpiRow kpis={MOCK_ANALYTICS_KPIS} />

      {/* 3. AI-Powered Analytics Assistant Drawer / Panel */}
      <AiAnalyticsAssistant
        briefing={MOCK_AI_ANALYTICS_BRIEFING}
        isOpen={isAiAssistantOpen}
        onToggle={() => setIsAiAssistantOpen((prev) => !prev)}
      />

      {/* 4. Tabbed Analytics Modules */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="border-b border-gray-200 bg-white px-2 py-1.5 rounded-xl shadow-2xs">
          <TabsList className="h-10 bg-transparent p-0 gap-1.5">
            <TabsTrigger
              value="admissions"
              className="h-9 gap-1.5 rounded-lg px-3.5 text-xs font-semibold data-[state=active]:bg-(--earist-primary) data-[state=active]:text-white data-[state=active]:shadow-xs"
            >
              <GraduationCap className="h-3.5 w-3.5" />
              Admissions & Alignment
            </TabsTrigger>

            <TabsTrigger
              value="examinations"
              className="h-9 gap-1.5 rounded-lg px-3.5 text-xs font-semibold data-[state=active]:bg-(--earist-primary) data-[state=active]:text-white data-[state=active]:shadow-xs"
            >
              <FileCheck2 className="h-3.5 w-3.5" />
              Examination Performance
            </TabsTrigger>

            <TabsTrigger
              value="thesis"
              className="h-9 gap-1.5 rounded-lg px-3.5 text-xs font-semibold data-[state=active]:bg-(--earist-primary) data-[state=active]:text-white data-[state=active]:shadow-xs"
            >
              <BookOpen className="h-3.5 w-3.5" />
              Thesis & STRIKE Pipeline
            </TabsTrigger>

            <TabsTrigger
              value="institutional"
              className="h-9 gap-1.5 rounded-lg px-3.5 text-xs font-semibold data-[state=active]:bg-(--earist-primary) data-[state=active]:text-white data-[state=active]:shadow-xs"
            >
              <FileText className="h-3.5 w-3.5" />
              Institutional Reports & Compliance
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab 1 Content: Admissions & Program Alignment */}
        <TabsContent value="admissions" className="m-0 focus-visible:outline-none">
          <AdmissionsTab data={MOCK_ADMISSIONS_ANALYTICS} />
        </TabsContent>

        {/* Tab 2 Content: Examination Performance */}
        <TabsContent value="examinations" className="m-0 focus-visible:outline-none">
          <ExaminationsTab data={MOCK_EXAMINATION_ANALYTICS} />
        </TabsContent>

        {/* Tab 3 Content: Thesis & STRIKE Pipeline */}
        <TabsContent value="thesis" className="m-0 focus-visible:outline-none">
          <ThesisPipelineTab data={MOCK_THESIS_PIPELINE_ANALYTICS} />
        </TabsContent>

        {/* Tab 4 Content: Institutional Reports */}
        <TabsContent value="institutional" className="m-0 focus-visible:outline-none">
          <InstitutionalReportsTab data={MOCK_INSTITUTIONAL_REPORTS} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
