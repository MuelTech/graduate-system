"use client";

import { useState } from "react";
import {
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Lightbulb,
  ChevronDown,
  ChevronUp,
  Bot,
  Info,
  Clock,
  Send,
  HelpCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AiAnalyticsBriefing } from "@/types/analytics";

interface AiAnalyticsAssistantProps {
  briefing: AiAnalyticsBriefing;
  isOpen: boolean;
  onToggle: () => void;
}

const PRESET_QUERIES = [
  {
    id: "bottlenecks",
    label: "Explain Thesis Bottlenecks",
    response:
      "Data analysis indicates an average turnaround duration of 184 days from Proposal to Final Defense, with the MA in Education (MAED-EM) and MBA programs showing prolonged revision intervals. Contributing factors include post-proposal panel comments requiring extensive manuscript rewrites and adviser capacity saturation.",
  },
  {
    id: "ecat-trends",
    label: "Analyze ECAT & Alignment",
    response:
      "The Entrance Examination pass rate reached 78.4% (411/524). The automated Program Alignment Check flagged 82 misaligned applicants (15.6%), primarily from undergraduate Allied Health and Engineering shifting into MBA/MPA programs. With 74 bridging waivers validated and cleared, applicant retention proceeded without pre-enrollment stalls.",
  },
  {
    id: "adviser-residency",
    label: "Review Residency & Adviser Risk",
    response:
      "4 graduate students are approaching or have breached their maximum residency limit (5 years for Masters, 7 years for Doctoral), predominantly in the MPA and EdD tracks. Additionally, 2 senior advisers (Dr. Cruz and Dr. Mercado) are at maximum capacity (5/5 advisees), requiring assignment redistribution.",
  },
];

export function AiAnalyticsAssistant({
  briefing,
  isOpen,
  onToggle,
}: AiAnalyticsAssistantProps) {
  const [selectedQuery, setSelectedQuery] = useState<string | null>(null);
  const [customInput, setCustomInput] = useState("");
  const [customResponse, setCustomResponse] = useState<string | null>(null);

  const handleSelectPreset = (id: string) => {
    setSelectedQuery(selectedQuery === id ? null : id);
    setCustomResponse(null);
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customInput.trim()) return;

    // Simulate AI synthesis based on data context
    setCustomResponse(
      `Based on the AY 2025–2026 data: "${customInput.trim()}" — Academic performance demonstrates high research productivity with 189 repository publications and an overall 91% STRIKE plagiarism pass rate. Continued focus on reducing Proposal-to-Final turnaround duration will optimize graduation completion velocity.`
    );
    setSelectedQuery(null);
  };

  if (!isOpen) return null;

  return (
    <Card className="overflow-hidden border border-indigo-200 bg-gradient-to-b from-indigo-50/50 via-white to-white shadow-xs">
      <CardHeader className="border-b border-indigo-100 bg-indigo-50/60 pb-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-xs">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-bold text-indigo-950">
                  AI-Powered Analytics Assistant
                </CardTitle>
                <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100 text-[10px]">
                  Capstone Decision Support
                </Badge>
              </div>
              <p className="text-xs text-indigo-800">
                Automated textual synthesis and explanation of academic, examination, and research trends.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-[11px] text-gray-500">
              <Clock className="h-3 w-3" />
              Generated for current cycle
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggle}
              className="h-7 w-7 p-0 text-indigo-800 hover:bg-indigo-100"
              aria-label="Collapse AI Assistant"
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 p-4 text-xs leading-relaxed text-gray-700">
        {/* Executive Summary */}
        <div className="rounded-lg border border-indigo-100 bg-white p-3.5 shadow-2xs">
          <p className="text-xs font-semibold text-indigo-900 uppercase tracking-wider mb-1">
            Executive Academic Summary
          </p>
          <p className="text-gray-800 leading-relaxed">{briefing.executiveSummary}</p>
        </div>

        {/* 3 Columns: Observations, Bottlenecks, Recommendations */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {/* Key Observations */}
          <div className="rounded-lg border border-emerald-100 bg-emerald-50/40 p-3 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>Key Strengths & Trends</span>
            </div>
            <ul className="space-y-1.5 text-[11px] text-emerald-950">
              {briefing.keyObservations.map((obs, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="text-emerald-500 font-bold">&bull;</span>
                  <span>{obs}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Detected Bottlenecks */}
          <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
              <span>Operational Bottlenecks</span>
            </div>
            <ul className="space-y-1.5 text-[11px] text-amber-950">
              {briefing.bottlenecks.map((btn, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="text-amber-500 font-bold">&bull;</span>
                  <span>{btn}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Actionable Recommendations */}
          <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 p-3 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900">
              <Lightbulb className="h-4 w-4 text-indigo-600 shrink-0" />
              <span>Dean & Admin Actions</span>
            </div>
            <ul className="space-y-1.5 text-[11px] text-indigo-950">
              {briefing.actionableRecommendations.map((rec, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="text-indigo-500 font-bold">&bull;</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Quick Analytical Question Chips */}
        <div className="space-y-2 pt-1 border-t border-indigo-50">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold text-gray-600 flex items-center gap-1">
              <Bot className="h-3.5 w-3.5 text-indigo-600" />
              Ask AI Analytics Assistant (Instant Synthesis):
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {PRESET_QUERIES.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleSelectPreset(preset.id)}
                className={`rounded-lg border px-2.5 py-1 text-xs transition-all ${
                  selectedQuery === preset.id
                    ? "border-indigo-600 bg-indigo-600 text-white font-medium"
                    : "border-indigo-200 bg-white text-indigo-900 hover:bg-indigo-50"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Active Preset Response */}
          {selectedQuery && (
            <div className="rounded-lg border border-indigo-200 bg-white p-3 text-xs text-gray-800 shadow-2xs animate-in fade-in-50">
              <p className="font-semibold text-indigo-900 mb-1">
                Insight: {PRESET_QUERIES.find((p) => p.id === selectedQuery)?.label}
              </p>
              <p className="text-gray-700 leading-relaxed">
                {PRESET_QUERIES.find((p) => p.id === selectedQuery)?.response}
              </p>
            </div>
          )}

          {/* Custom Query Input */}
          <form onSubmit={handleCustomSubmit} className="flex items-center gap-2 pt-1">
            <input
              type="text"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              placeholder="Ask a specific question about current graduate school trends..."
              className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <Button
              type="submit"
              size="sm"
              className="h-7 bg-indigo-600 text-white hover:bg-indigo-700 text-xs px-2.5"
            >
              <Send className="h-3 w-3 mr-1" />
              Ask
            </Button>
          </form>

          {/* Custom Query Response */}
          {customResponse && (
            <div className="rounded-lg border border-indigo-200 bg-white p-3 text-xs text-gray-800 shadow-2xs animate-in fade-in-50">
              <p className="font-semibold text-indigo-900 mb-1">AI Response:</p>
              <p className="text-gray-700 leading-relaxed">{customResponse}</p>
            </div>
          )}
        </div>

        {/* Academic Governance Boundary Notice */}
        <div className="flex items-start gap-2 rounded-lg bg-gray-50 p-2.5 text-[11px] text-gray-500">
          <Info className="h-3.5 w-3.5 text-gray-400 shrink-0 mt-0.5" />
          <span>
            <strong>Scope & Academic Governance:</strong> In compliance with Capstone Chapter 1 specifications,
            this AI assistant strictly provides textual interpretation and data summaries. It does not replace or
            automate official academic decisions, which remain the exclusive responsibility of academic officials.
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
