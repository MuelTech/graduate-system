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

// Mock Data Source
import {
  MOCK_ANALYTICS_KPIS,
  MOCK_AI_ANALYTICS_BRIEFING,
  MOCK_ADMISSIONS_ANALYTICS,
  MOCK_EXAMINATION_ANALYTICS,
} from "@/lib/mock/analytics-data";

export default function AdminAnalyticsPage() {
  // Global Filter States
  const [selectedAy, setSelectedAy] = useState("AY 2025–2026");
  const [selectedSemester, setSelectedSemester] = useState("1st Semester");
  const [selectedProgram, setSelectedProgram] = useState("ALL");
  const [isAiAssistantOpen, setIsAiAssistantOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("admissions");

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
              <Badge variant="outline" className="ml-1 text-[9px] py-0 px-1 border-gray-300">
                Task 7
              </Badge>
            </TabsTrigger>

            <TabsTrigger
              value="institutional"
              className="h-9 gap-1.5 rounded-lg px-3.5 text-xs font-semibold data-[state=active]:bg-(--earist-primary) data-[state=active]:text-white data-[state=active]:shadow-xs"
            >
              <FileText className="h-3.5 w-3.5" />
              Institutional Reports & Compliance
              <Badge variant="outline" className="ml-1 text-[9px] py-0 px-1 border-gray-300">
                Task 8
              </Badge>
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

        {/* Tab 3 Content: Thesis & STRIKE Pipeline Placeholder (Upcoming Task 7) */}
        <TabsContent value="thesis" className="m-0 focus-visible:outline-none">
          <Card className="border-dashed border-2 border-indigo-200 bg-indigo-50/20">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700">
                <BookOpen className="h-7 w-7" />
              </div>
              <Badge className="mb-2 bg-indigo-100 text-indigo-800 text-xs">
                Upcoming Task 7
              </Badge>
              <h3 className="text-base font-bold text-gray-900">
                Thesis Defense Pipeline & STRIKE Plagiarism Analytics
              </h3>
              <p className="mt-1 max-w-md text-xs text-gray-600">
                Interactive stage funnel (Title &rarr; Proposal &rarr; Final), turnaround duration metrics, STRIKE similarity trend charts, and E-Library research repository download statistics.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4 Content: Institutional Reports Placeholder (Upcoming Task 8) */}
        <TabsContent value="institutional" className="m-0 focus-visible:outline-none">
          <Card className="border-dashed border-2 border-emerald-200 bg-emerald-50/20">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                <FileText className="h-7 w-7" />
              </div>
              <Badge className="mb-2 bg-emerald-100 text-emerald-800 text-xs">
                Upcoming Task 8
              </Badge>
              <h3 className="text-base font-bold text-gray-900">
                Institutional Compliance & Official Exportable Reports
              </h3>
              <p className="mt-1 max-w-md text-xs text-gray-600">
                Residency Risk Registry (students approaching maximum residency years), Faculty Adviser Load Matrix, and client-side consolidated CSV/PDF export triggers.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
