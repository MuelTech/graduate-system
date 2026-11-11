"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClientRequest } from "@/lib/api.client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Printer } from "lucide-react";

interface StudentRapAccess {
  scheduleId: string;
  defenseType: string;
  formalOutcome: string | null;
  rapStatus: string | null;
  finalizedAt: string | null;
  officialContent: {
    selectedTitle: string | null;
    decisionsAndRecommendations: string | null;
    venue: string | null;
    reportDate: string | null;
    signatories: Array<{
      name: string | null;
      roleAtDefense: string | null;
      isSigned: boolean;
      signedAt: string | null;
    }>;
  } | null;
  message: string;
}

/**
 * Student-safe RAP status/access.
 * Never shows live Rapporteur draft notes or private evaluator score sheets.
 */
export function StudentRapPanel({ scheduleId }: { scheduleId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["studentRap", scheduleId],
    queryFn: async () =>
      (await apiClientRequest(
        `/thesis/student/defense/${scheduleId}/rap`,
      )) as StudentRapAccess,
    enabled: Boolean(scheduleId),
  });

  if (!scheduleId || isLoading) return null;
  if (error || !data) return null;

  // Canonical RAP completion is FINALIZED only (ALL_SIGNED/DISTRIBUTED are legacy).
  const finalized = data.rapStatus === "FINALIZED";

  return (
    <Card>
      <CardHeader className="border-b border-gray-100 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base font-bold text-[#333333]">
            <FileText className="h-4 w-4 text-[#e02b20]" />
            Official Defense RAP (Report of Action and Proceedings)
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            {data.formalOutcome && (
              <Badge
                className={
                  data.formalOutcome === "PASSED"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : data.formalOutcome === "FAILED"
                      ? "border-red-200 bg-red-50 text-red-700"
                      : "border-amber-200 bg-amber-50 text-amber-700"
                }
              >
                {data.formalOutcome}
              </Badge>
            )}
            {data.rapStatus && (
              <Badge variant="outline">RAP: {data.rapStatus}</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-4 text-sm text-[#333333]">
        <p className="text-gray-600">{data.message}</p>

        {finalized && data.officialContent ? (
          <div className="space-y-4">
            {data.officialContent.selectedTitle && (
              <div className="rounded-lg border border-gray-100 bg-gray-50/70 p-3">
                <p className="text-xs font-semibold tracking-wider text-gray-500 uppercase">
                  Official Approved Title
                </p>
                <p className="mt-1 font-semibold text-[#333333]">
                  {data.officialContent.selectedTitle}
                </p>
              </div>
            )}
            {data.officialContent.decisionsAndRecommendations && (
              <div className="rounded-lg border border-gray-100 bg-gray-50/70 p-3.5">
                <p className="mb-2 text-xs font-semibold tracking-wider text-gray-500 uppercase">
                  Official RAP Decisions &amp; Recommendations
                </p>
                <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-[#333333]">
                  {data.officialContent.decisionsAndRecommendations}
                </pre>
              </div>
            )}
            <div>
              <p className="mb-2 text-xs font-semibold tracking-wider text-gray-500 uppercase">
                Defense Committee Signatories
              </p>
              <ul className="divide-y divide-gray-100 rounded-lg border border-gray-100 bg-white text-xs">
                {data.officialContent.signatories.map((s, i) => (
                  <li key={i} className="flex items-center justify-between px-3.5 py-2.5">
                    <span className="font-medium text-[#333333]">
                      {s.name}{" "}
                      {s.roleAtDefense ? (
                        <span className="text-gray-500">({s.roleAtDefense})</span>
                      ) : (
                        ""
                      )}
                    </span>
                    <Badge
                      variant="outline"
                      className={
                        s.isSigned
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-amber-200 bg-amber-50 text-amber-700"
                      }
                    >
                      {s.isSigned ? "Signed" : "Pending"}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.print()}
            >
              <Printer className="mr-2 h-4 w-4" />
              View / Print / Download Official RAP
            </Button>
          </div>
        ) : (
          <p className="text-xs text-gray-500">
            Official RAP content becomes available after the RAP is finalized.
            Internal draft notes and private evaluator score sheets are not
            shared.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
