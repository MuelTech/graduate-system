"use client";

import {
  FileText,
  AlertTriangle,
  CheckCircle2,
  Lightbulb,
  ChevronUp,
  Clock,
  Info,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { AiAnalyticsBriefing } from "@/types/analytics";

interface AiAnalyticsAssistantProps {
  briefing: AiAnalyticsBriefing;
  isOpen: boolean;
  onToggle: () => void;
}

export function AiAnalyticsAssistant({
  briefing,
  isOpen,
  onToggle,
}: AiAnalyticsAssistantProps) {
  if (!isOpen) return null;

  return (
    <Card className="border-(--earist-border-gray) bg-white shadow-2xs">
      <CardHeader className="border-b border-(--earist-border-gray) bg-(--earist-surface-gray) py-3 px-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white border border-(--earist-border-gray) text-(--earist-primary)">
              <FileText className="h-4 w-4" />
            </span>
            <div>
              <CardTitle className="text-sm font-bold text-(--earist-primary)">
                Dean&apos;s Executive Briefing & Decision Support
              </CardTitle>
              <p className="text-xs text-(--earist-body-text)">
                Automated textual synthesis of admissions, examination throughput, and thesis velocity.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-[11px] text-(--earist-body-text)">
              <Clock className="h-3.5 w-3.5 text-gray-400" />
              Generated for current academic cycle
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggle}
              className="h-7 w-7 p-0 text-(--earist-body-text) hover:bg-gray-200"
              aria-label="Collapse Executive Briefing"
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 p-4 text-xs leading-relaxed text-(--earist-body-text)">
        {/* Executive Summary Narrative */}
        <div className="rounded-lg border border-(--earist-border-gray) bg-(--earist-surface-gray) p-3.5">
          <p className="text-xs font-semibold text-(--earist-primary) uppercase tracking-wider mb-1">
            Executive Summary
          </p>
          <p className="text-sm text-foreground leading-relaxed">{briefing.executiveSummary}</p>
        </div>

        {/* 3 Columns: Observations, Bottlenecks, Recommendations */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {/* Key Observations */}
          <div className="rounded-lg border border-(--earist-border-gray) border-l-4 border-l-(--earist-success) bg-white p-3 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
              <CheckCircle2 className="h-4 w-4 text-(--earist-success) shrink-0" />
              <span>Key Strengths & Trends</span>
            </div>
            <ul className="space-y-1.5 text-[11px] text-(--earist-body-text)">
              {briefing.keyObservations.map((obs, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="text-(--earist-success) font-bold">&bull;</span>
                  <span>{obs}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Detected Bottlenecks */}
          <div className="rounded-lg border border-(--earist-border-gray) border-l-4 border-l-(--earist-warning) bg-white p-3 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
              <AlertTriangle className="h-4 w-4 text-(--earist-warning) shrink-0" />
              <span>Operational Bottlenecks</span>
            </div>
            <ul className="space-y-1.5 text-[11px] text-(--earist-body-text)">
              {briefing.bottlenecks.map((btn, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="text-(--earist-warning) font-bold">&bull;</span>
                  <span>{btn}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Actionable Recommendations */}
          <div className="rounded-lg border border-(--earist-border-gray) border-l-4 border-l-(--earist-primary) bg-white p-3 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
              <Lightbulb className="h-4 w-4 text-(--earist-primary) shrink-0" />
              <span>Dean & Admin Actions</span>
            </div>
            <ul className="space-y-1.5 text-[11px] text-(--earist-body-text)">
              {briefing.actionableRecommendations.map((rec, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="text-(--earist-primary) font-bold">&bull;</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Institutional Governance Notice */}
        <div className="flex items-start gap-2 rounded-lg bg-(--earist-surface-gray) border border-(--earist-border-gray) p-2.5 text-[11px] text-(--earist-body-text)">
          <Info className="h-3.5 w-3.5 text-gray-500 shrink-0 mt-0.5" />
          <span>
            <strong>Institutional Governance:</strong> In accordance with Capstone Chapter 1 specifications and CHED standards, this executive briefing strictly provides textual data synthesis to support administrative decision-making. Official policy and academic decisions remain under the authority of the Dean and Graduate School Council.
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
